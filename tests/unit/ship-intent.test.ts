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
  assert.deepEqual(
    { ...result.intent, predecessor: undefined },
    { id: intent.id, revision: intent.revision, status: 'succeeded', predecessor: undefined },
  );
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

test('an intent is planned only after the running deployment of its environment finishes', async (t) => {
  const { f, capture } = await intentFixture(t);
  const { environment } = await import('../../packages/core/src/config.ts');
  const { LocalDeploymentControl } = await import('../../packages/core/src/deployment-control.ts');
  const control = new LocalDeploymentControl(environment(f.ctx, 'dev'));
  // A live runner (this process) owns the target: the next intent waits for its outcome.
  await control.acquire('predecessor-run');
  const intent = await capture();
  let releasedAt = 0;
  setTimeout(() => {
    releasedAt = Date.now();
    void control.release('predecessor-run');
  }, 400);
  const original = f.oracle.validate.bind(f.oracle);
  let validatedAt = 0;
  f.oracle.validate = async (...args: Parameters<typeof original>) => {
    validatedAt ||= Date.now();
    return original(...args);
  };
  const result = await runShipIntent(f.ctx, intent.id, f.service, fallbackCompilerDiagnostics);
  assert.equal(result.status, 'succeeded');
  assert.ok(releasedAt > 0 && validatedAt >= releasedAt, 'planning started after the predecessor finished');
  assert.ok(result.intent.predecessor.waitedMs >= 350);
});

test('an interrupted write or an unknown predecessor outcome blocks preparation; nothing is replayed', async (t) => {
  const { f, capture } = await intentFixture(t);
  const { environment } = await import('../../packages/core/src/config.ts');
  const { LocalDeploymentControl } = await import('../../packages/core/src/deployment-control.ts');
  const { writeJson } = await import('../../packages/core/src/fs.ts');
  const { hostname } = await import('node:os');
  const control = new LocalDeploymentControl(environment(f.ctx, 'dev'));
  await control.acquire('interrupted-run');
  // The runner died in its writing phase: its outcome is unknown and its ownership is kept.
  const active = path.join(control.directory, 'active.json');
  const stale = {
    runId: 'interrupted-run',
    pid: 2 ** 22 + 12345,
    hostname: hostname(),
    phase: 'writing',
    createdAt: new Date().toISOString(),
  };
  await writeJson(active, stale);
  const intent = await capture();
  await assert.rejects(runShipIntent(f.ctx, intent.id, f.service, fallbackCompilerDiagnostics), {
    code: 'PREDECESSOR_OUTCOME_UNKNOWN',
    status: 'blocked',
  });
  assert.deepEqual(expensive(f.calls), [], 'no planning, export or import');
  assert.deepEqual(JSON.parse(await readFile(active, 'utf8')), stale, 'ownership retained');
  await rm(active);
  // An earlier intent that ended with an unknown outcome blocks the same way.
  const unknown = await capture();
  f.oracle.importApplication = async () => {
    const { Fault } = await import('../../packages/core/src/result.ts');
    throw new Fault('OUTCOME_UNKNOWN', 'SQLcl stopped.', 6, 'outcome_unknown', { cause: 'TIMEOUT' });
  };
  // Automatic server readback cannot settle it either: the outcome stays unknown.
  f.service.recover = async () => {
    const { Fault } = await import('../../packages/core/src/result.ts');
    throw new Fault('RECOVERY_INCOMPLETE', 'The server state could not be confirmed.', 6, 'outcome_unknown');
  };
  await assert.rejects(
    runShipIntent(f.ctx, unknown.id, f.service, fallbackCompilerDiagnostics),
    { status: 'outcome_unknown' },
    'the injected unknown import',
  );
  assert.equal((await shipIntentStatus(f.ctx, unknown.id))?.status, 'outcome_unknown');
  await rm(path.join(control.directory, 'active.json'), { force: true });
  const next = await capture();
  const calls = f.calls.length;
  await assert.rejects(runShipIntent(f.ctx, next.id, f.service, fallbackCompilerDiagnostics), {
    code: 'PREDECESSOR_OUTCOME_UNKNOWN',
  });
  assert.equal(f.calls.length, calls, 'no new work after an unknown predecessor');
});

test('a predecessor that failed before submission lets the next intent prepare a fresh plan', async (t) => {
  const { f, capture } = await intentFixture(t);
  const first = await capture();
  // Oracle rejects the import and a fresh read shows the target unchanged: a known failure.
  const importApplication = f.oracle.importApplication.bind(f.oracle);
  f.oracle.importApplication = async () => {
    const { Fault } = await import('../../packages/core/src/result.ts');
    throw new Fault('ORACLE_COMMAND_FAILED', 'ORA-20987: compiler error', 1);
  };
  await assert.rejects(runShipIntent(f.ctx, first.id, f.service, fallbackCompilerDiagnostics), {
    code: 'IMPORT_REJECTED',
  });
  const recorded = (await shipIntentStatus(f.ctx, first.id))?.status;
  assert.ok(recorded === 'failed', `known outcome recorded (${recorded})`);
  f.oracle.importApplication = importApplication;
  const second = await capture();
  const result = await runShipIntent(f.ctx, second.id, f.service, fallbackCompilerDiagnostics);
  assert.equal(result.status, 'succeeded');
  // Its own exact plan and its own grant, never the predecessor's.
  assert.notEqual(result.planPath, undefined);
  assert.equal(result.grant.planDigest, result.planDigest);
});
