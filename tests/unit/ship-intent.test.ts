import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { workingCopyFixture } from '../fixtures/working-copy.ts';
import { fallbackCompilerDiagnostics, shipApply, shipPlan } from '../../packages/core/src/ship.ts';
import {
  captureShipIntent,
  intentCreated,
  readShipIntent,
  runShipIntent,
  shipIntentStatus,
} from '../../packages/core/src/ship-intent.ts';
import { executeJob, JobService, type JobPhase } from '../../packages/core/src/jobs.ts';
import { failure, success } from '../../packages/core/src/result.ts';

async function intentFixture(t: test.TestContext) {
  const f = await workingCopyFixture();
  f.ctx.config.environments.dev!.baseUrl = 'https://localhost/ords/';
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  const capture = () =>
    captureShipIntent(f.ctx, { env: 'dev', userRequest: 'Deploy the customers page to dev' });
  return { f, capture };
}
const expensive = (calls: string[]) => calls.filter((call) => !call.startsWith('capability'));

test('queueing an intent captures its revision locally with no export, compiler or database call', async (t) => {
  const { f, capture } = await intentFixture(t);
  const intent = await capture();
  assert.deepEqual(f.calls, [], 'no Oracle, SQLcl or compiler call');
  assert.match(intent.revision, /^[a-f0-9]{64}$/u);
  assert.equal(intent.userRequest, 'Deploy the customers page to dev');
  assert.ok(Object.keys(intent.inventory).length > 0);
  assert.deepEqual(await readShipIntent(f.ctx, intent.id), intent);
  assert.equal((await shipIntentStatus(f.ctx, intent.id))?.status, 'queued');
  assert.equal(await intentCreated(f.ctx, intent.id), Date.parse(intent.createdAt));
  // An intent is a task scope, not a grant: nothing is written to the deploy policy.
  const policy = JSON.parse(await readFile(path.join(process.env.APEXREST_HOME!, 'policy.json'), 'utf8'));
  assert.equal(
    policy.grants.some((grant: { grantedBy?: string }) => grant.grantedBy === 'ship'),
    false,
  );
});

test('a captured intent is prepared and applied in one run and deploys exactly its revision', async (t) => {
  const { f, capture } = await intentFixture(t);
  const intent = await capture();
  const phases: JobPhase[] = [];
  const result = await runShipIntent(
    f.ctx,
    intent.id,
    f.service,
    fallbackCompilerDiagnostics,
    undefined,
    (phase) => phases.push(phase),
  );
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(result.intent, { id: intent.id, revision: intent.revision, status: 'succeeded' });
  assert.ok(expensive(f.calls).includes('validate') && f.calls.includes('import'));
  assert.deepEqual(phases.slice(0, 3), ['validating', 'planned', 'backing_up']);
  assert.equal((await shipIntentStatus(f.ctx, intent.id))?.status, 'succeeded');
  const plan = JSON.parse(await readFile(path.join(f.ctx.root, result.planPath), 'utf8'));
  for (const [file, sha] of Object.entries(plan.sources as Record<string, string>))
    assert.equal(intent.inventory[file], sha, `${file} is the captured byte digest`);
});

test('later edits never change a captured intent: it is superseded and a new revision is a new intent', async (t) => {
  const { f, capture } = await intentFixture(t);
  const first = await capture();
  const file = path.join(f.ctx.root, f.ctx.config.application.sourceDir, 'application.apx');
  await writeFile(file, (await readFile(file, 'utf8')) + '\n');
  await assert.rejects(runShipIntent(f.ctx, first.id, f.service, fallbackCompilerDiagnostics), {
    code: 'SHIP_INTENT_SUPERSEDED',
    status: 'superseded',
  });
  assert.deepEqual(expensive(f.calls), [], 'a superseded intent pays for no export or compile');
  assert.equal((await shipIntentStatus(f.ctx, first.id))?.status, 'superseded');
  const second = await capture();
  assert.notEqual(second.id, first.id);
  assert.notEqual(second.revision, first.revision);
  // A changed intent file is refused, never repaired or trusted.
  const stored = path.join(f.ctx.root, '.apexrest/intents', `${second.id}.json`);
  const tampered = JSON.parse(await readFile(stored, 'utf8'));
  tampered.userRequest = 'Deploy everything to production';
  await writeFile(stored, JSON.stringify(tampered));
  await assert.rejects(readShipIntent(f.ctx, second.id), { code: 'SHIP_INTENT_INVALID' });
});

test('configuration refusals stay immediate and write no intent', async (t) => {
  const { f } = await intentFixture(t);
  const production = {
    ...f.ctx,
    config: {
      ...f.ctx.config,
      environments: { dev: { ...f.ctx.config.environments.dev!, kind: 'production' as const } },
    },
  };
  await assert.rejects(captureShipIntent(production, { env: 'dev', userRequest: 'Deploy' }), {
    code: 'PRODUCTION_DEPLOY_DENIED',
  });
  await assert.rejects(
    captureShipIntent(f.ctx, {
      env: 'dev',
      userRequest: 'Deploy',
      importMode: 'files',
      files: ['pages/p1.apx'],
    }),
    { code: 'PARTIAL_IMPORT_UNSUPPORTED' },
  );
  await assert.rejects(captureShipIntent(f.ctx, { env: 'missing', userRequest: 'Deploy' }));
  const intents = path.join(f.ctx.root, '.apexrest/intents');
  assert.equal(await readFile(intents).catch((error: NodeJS.ErrnoException) => error.code), 'ENOENT');
});

test('one exclusive job claim covers preparation and apply; status shows the planned phase', async (t) => {
  const { f, capture } = await intentFixture(t);
  const intent = await capture();
  const jobs = new JobService(f.ctx);
  const execute = async (
    _operation: string,
    input: Record<string, unknown>,
    signal: AbortSignal,
    progress: (phase: JobPhase) => void,
  ) => {
    try {
      return success(
        'ship.intent',
        await runShipIntent(
          f.ctx,
          String(input.intent),
          f.service,
          fallbackCompilerDiagnostics,
          signal,
          progress,
        ),
      );
    } catch (error) {
      return failure('ship.intent', error);
    }
  };
  const job = await jobs.startInline('ship.intent', { env: 'dev', intent: intent.id }, execute);
  const done = await jobs.status(job.jobId, 10);
  assert.equal(done.status, 'completed');
  // A second runner (an uncertain broker handoff) cannot take the same job again.
  await assert.rejects(executeJob(f.ctx, job.jobId, execute, 'broker'), { code: 'JOB_ALREADY_CLAIMED' });
  assert.equal(f.calls.filter((call) => call === 'import').length, 1, 'imported exactly once');
  // A superseded intent reports its own terminal status.
  const stale = await capture();
  const file = path.join(f.ctx.root, f.ctx.config.application.sourceDir, 'application.apx');
  await writeFile(file, (await readFile(file, 'utf8')) + '\n');
  const second = await jobs.startInline('ship.intent', { env: 'dev', intent: stale.id }, execute);
  assert.equal((await jobs.status(second.jobId, 10)).status, 'superseded');
});

test('an explicit saved plan is still applied exactly, without an intent', async (t) => {
  const { f } = await intentFixture(t);
  const planned = await shipPlan(f.ctx, 'dev', f.service, fallbackCompilerDiagnostics);
  const result = await shipApply(f.ctx, planned.plan, 'Deploy the customers page to dev', f.service);
  assert.equal(result.planDigest, planned.plan.digest);
  assert.equal('intent' in result, false);
});
