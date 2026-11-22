import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import { reconcileRun } from '../../packages/core/src/deploy-reconcile.ts';
import { LocalDeploymentControl } from '../../packages/core/src/deployment-control.ts';
import { targetDigest } from '../../packages/core/src/config.ts';

const RUN = '08e6e532-db75-4e14-9a35-ba79295ec15f';
const SHA = (c: string) => c.repeat(64);

async function held(t: import('node:test').TestContext, options: { pid?: number; state?: string } = {}) {
  const previous = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = await mkdtemp(path.join(tmpdir(), 'apexrest-home-'));
  const { ctx } = await fixture();
  t.after(async () => {
    if (previous === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = previous;
    await rm(ctx.root, { recursive: true, force: true });
  });
  const env = ctx.config.environments.dev!;
  const runDir = path.join(ctx.root, '.apexrest/deployments', RUN);
  await mkdir(runDir, { recursive: true });
  const plan = {
    digest: SHA('d'),
    environment: 'dev',
    targetDigest: targetDigest(env),
    operations: [
      { kind: 'migration', file: 'src/db/migrations/0001__customers.sql', sha256: SHA('1') },
      { kind: 'package', file: 'src/db/packages/0010__api.sql', sha256: SHA('2') },
      { kind: 'import' },
    ],
  };
  await writeFile(path.join(runDir, 'plan.json'), JSON.stringify(plan));
  await writeFile(
    path.join(runDir, 'state.json'),
    JSON.stringify({ runId: RUN, state: options.state ?? 'outcome_unknown' }),
  );
  await writeFile(
    path.join(runDir, 'journal.jsonl'),
    JSON.stringify({ runId: RUN, state: 'outcome_unknown' }) + '\n',
  );
  const control = new LocalDeploymentControl(env);
  await mkdir(control.directory, { recursive: true });
  await writeFile(
    control.file('active.json'),
    JSON.stringify({
      runId: RUN,
      pid: options.pid ?? 2147480000,
      hostname: hostname(),
      phase: 'writing',
      createdAt: new Date().toISOString(),
    }),
  );
  await writeFile(
    control.file('history.json'),
    JSON.stringify([{ version: '0001__customers.sql', checksum: SHA('1'), status: 'started', run_id: RUN }]),
  );
  return { ctx, control, runDir };
}

const statements = [
  { file: 'src/db/migrations/0001__customers.sql', outcome: 'not_applied' as const },
  { file: 'src/db/packages/0010__api.sql', outcome: 'applied' as const },
];
const base = {
  env: 'dev',
  run: RUN,
  statements,
  userRequest: 'I dropped the partial package and checked the table is absent.',
};

test('reconciliation needs every script stated and the exact typed confirmation', async (t) => {
  const { ctx, control } = await held(t);
  await assert.rejects(reconcileRun(ctx, { ...base, statements: statements.slice(0, 1) }), {
    code: 'RECONCILIATION_INCOMPLETE',
  });
  await assert.rejects(
    reconcileRun(ctx, {
      ...base,
      statements: [...statements, { file: 'src/db/migrations/0002__x.sql', outcome: 'applied' }],
    }),
    { code: 'RECONCILIATION_INCOMPLETE' },
  );
  await assert.rejects(
    reconcileRun(ctx, base),
    (error: { code: string; details?: { expected?: string } }) => {
      assert.equal(error.code, 'RECONCILIATION_CONFIRMATION_REQUIRED');
      assert.equal(error.details?.expected, `${RUN}:${SHA('d').slice(0, 12)}`);
      return true;
    },
  );
  await assert.rejects(reconcileRun(ctx, { ...base, confirm: `${RUN}:wrong` }), {
    code: 'RECONCILIATION_CONFIRMATION_REQUIRED',
  });
  await assert.rejects(
    reconcileRun(ctx, { ...base, env: 'qa', confirm: `${RUN}:${SHA('d').slice(0, 12)}` }),
    {
      code: 'PLAN_TARGET_MISMATCH',
    },
  );
  assert.equal((await control.owner())?.runId, RUN, 'nothing was released');
});

test('a confirmed statement updates the history as stated, keeps evidence and releases the run', async (t) => {
  const { ctx, control, runDir } = await held(t);
  const result = await reconcileRun(ctx, { ...base, confirm: `${RUN}:${SHA('d').slice(0, 12)}` });
  assert.equal(result.released, true);
  assert.equal(await control.owner(), undefined);
  assert.deepEqual(await control.history(), [], 'the migration stated not applied runs again');
  assert.deepEqual(await control.packages(ctx.config.projectId), {
    'src/db/packages/0010__api.sql': SHA('2'),
  });
  const evidence = JSON.parse(await readFile(path.join(runDir, 'reconciliation.json'), 'utf8'));
  assert.equal(evidence.userRequest, base.userRequest);
  assert.equal(evidence.releasedOwner.runId, RUN);
  assert.equal(JSON.parse(await readFile(path.join(runDir, 'state.json'), 'utf8')).state, 'outcome_unknown');
  assert.match(await readFile(path.join(runDir, 'journal.jsonl'), 'utf8'), /"state":"reconciled"/u);
  // A second attempt finds no held ownership.
  await assert.rejects(reconcileRun(ctx, { ...base, confirm: `${RUN}:${SHA('d').slice(0, 12)}` }), {
    code: 'RUN_NOT_OWNER',
  });
});

test('a live run process and a production target are refused', async (t) => {
  const alive = await held(t, { pid: process.ppid });
  await assert.rejects(reconcileRun(alive.ctx, { ...base, confirm: `${RUN}:${SHA('d').slice(0, 12)}` }), {
    code: 'RUN_STILL_ALIVE',
  });
  const production = await held(t);
  production.ctx.config.environments.dev!.kind = 'production';
  await assert.rejects(
    reconcileRun(production.ctx, { ...base, confirm: `${RUN}:${SHA('d').slice(0, 12)}` }),
    {
      code: 'PRODUCTION_DEPLOY_DENIED',
    },
  );
  assert.equal((await production.control.owner())?.runId, RUN);
});

test('succeeded runs are not reconciled', async (t) => {
  const done = await held(t, { state: 'succeeded' });
  await assert.rejects(reconcileRun(done.ctx, { ...base, confirm: `${RUN}:${SHA('d').slice(0, 12)}` }), {
    code: 'RUN_NOT_HELD',
  });
});
