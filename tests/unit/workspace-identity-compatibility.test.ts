// Portable service fixtures only. Oracle process, import and script boundaries are fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, rm, readdir } from 'node:fs/promises';
import { workingCopyFixture } from '../fixtures/working-copy.ts';
import { SyncStore } from '../../packages/core/src/sync.ts';
import { LocalDeploymentControl } from '../../packages/core/src/deployment-control.ts';
import { atomicWrite, writeJson, inventory, canonical } from '../../packages/core/src/fs.ts';
import type { DeployPlan } from '../../packages/core/src/deploy.ts';
import type { OracleAdapter } from '../../packages/core/src/oracle.ts';
async function fixture(t: import('node:test').TestContext, id: number = 123) {
  const oldHome = process.env.APEXREST_HOME,
    f = await workingCopyFixture();
  t.after(async () => {
    if (oldHome === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = oldHome;
    await rm(f.ctx.root, { recursive: true, force: true });
  });
  let value: string | number = id;
  const oldVerify = f.oracle.verifyTarget.bind(f.oracle);
  f.oracle.verifyTarget = (async () => {
    const target = await oldVerify();
    return { ...target, workspace: { ...target.workspace, workspace_id: value } };
  }) as typeof f.oracle.verifyTarget;
  const exact = () => {
    value = id === 123 ? '123' : '10934068819404041';
  };
  const grant = async (plan: DeployPlan) =>
    writeJson(path.join(process.env.APEXREST_HOME!, 'policy.json'), {
      schemaVersion: 1,
      trustedProjects: [f.ctx.root],
      grants: [
        {
          projectRoot: f.ctx.root,
          targetDigest: plan.targetDigest,
          planDigest: plan.digest,
          operations: ['deploy'],
          expiresAt: plan.expiresAt,
          confirmedRisks: plan.risks,
          confirmationRequest: 'Exact fake service fixture approval',
        },
      ],
    });
  const apply = async (plan: DeployPlan) => {
    await grant(plan);
    return f.service.apply(f.ctx, plan);
  };
  const control = new LocalDeploymentControl(f.env),
    store = new SyncStore(f.ctx, f.env, 'dev');
  return { ...f, store, control, exact, apply };
}
async function frozenRunFiles(root: string) {
  const base = path.join(root, '.apexrest/deployments');
  try {
    return await inventory(base);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw e;
  }
}
test('completed legacy plan history can be freshly replanned with exact text, without replay or old-record rewriting', async (t) => {
  const f = await fixture(t, 10934068819404040);
  await atomicWrite(path.join(f.ctx.root, 'src/db/migrations/0001__fixture.sql'), 'begin null; end;\n/\n');
  (f.oracle as unknown as OracleAdapter).session = async (sql) => {
    f.calls.push('script');
    return { output: sql.match(/APEXREST_SCRIPT_COMPLETE_\w+/)?.[0] ?? '' } as Awaited<
      ReturnType<OracleAdapter['session']>
    >;
  };
  const oldPlan = await f.service.plan(f.ctx, 'dev');
  await f.apply(oldPlan);
  assert.equal(f.calls.filter((c) => c === 'script').length, 1);
  assert.equal(await f.store.read(), null);
  const oldFiles = await frozenRunFiles(f.ctx.root),
    history = await readFile(f.control.file('history.json'));
  const services = path.join(process.env.APEXREST_HOME!, 'deployment-control/schema-services');
  for (const name of await readdir(services)) if (name.endsWith('.json')) await rm(path.join(services, name));
  f.exact();
  f.calls.length = 0;
  const next = await f.service.plan(f.ctx, 'dev');
  assert.equal((next.target.workspace as { workspace_id: unknown }).workspace_id, '10934068819404041');
  assert.equal(next.operations.filter((o) => o.kind === 'migration').length, 0);
  assert.ok(!f.calls.includes('script') && !f.calls.includes('import'));
  assert.equal(canonical(await frozenRunFiles(f.ctx.root)), canonical(oldFiles));
  assert.deepEqual(await readFile(f.control.file('history.json')), history);
  assert.equal((await readdir(services)).filter((n) => n.endsWith('.json')).length, 1);
});
test('ready legacy working copy refuses automatic mixed identity but clean explicit refresh establishes a fresh exact baseline', async (t) => {
  const f = await fixture(t, 10934068819404040);
  await f.service.sync(f.ctx, 'dev', 'init');
  await f.apply(await f.service.plan(f.ctx, 'dev'));
  const oldState = await readFile(await f.store.file()),
    old = (await f.store.read())!,
    historyFiles = await frozenRunFiles(f.ctx.root),
    oldBaseline = await inventory(path.join(f.ctx.root, old.baseline.directory));
  f.exact();
  f.calls.length = 0;
  await assert.rejects(f.service.plan(f.ctx, 'dev'), { code: 'SYNC_SERVER_CHANGED' });
  await assert.rejects(f.service.plan(f.ctx, 'dev', { importMode: 'full' }), { code: 'SYNC_SERVER_CHANGED' });
  assert.deepEqual(await readFile(await f.store.file()), oldState);
  assert.ok(!f.calls.includes('import'));
  const sourceFile = path.join(f.ctx.root, f.ctx.config.application.sourceDir, 'application.apx'),
    cleanSource = await readFile(sourceFile);
  await atomicWrite(sourceFile, 'dirty local fixture');
  await assert.rejects(f.service.sync(f.ctx, 'dev', 'refresh'), { code: 'SYNC_DIRTY' });
  await atomicWrite(sourceFile, cleanSource);
  await f.service.sync(f.ctx, 'dev', 'refresh');
  const refreshed = (await f.store.read())!;
  assert.equal((refreshed.target.workspace as { workspace_id: unknown }).workspace_id, '10934068819404041');
  assert.equal(refreshed.status, 'ready');
  assert.ok(refreshed.revision > old.revision);
  assert.equal(
    canonical(await inventory(path.join(f.ctx.root, old.baseline.directory))),
    canonical(oldBaseline),
  );
  assert.equal(canonical(await frozenRunFiles(f.ctx.root)), canonical(historyFiles));
  const next = await f.service.plan(f.ctx, 'dev');
  assert.equal((next.target.workspace as { workspace_id: unknown }).workspace_id, '10934068819404041');
  assert.ok(!f.calls.includes('import'));
});
test('26.2 full read-only replanning can observe fresh exact identity while retaining the completed numeric sync record', async (t) => {
  const f = await fixture(t, 10934068819404040);
  const oracle = f.oracle as unknown as OracleAdapter;
  f.ctx.config.toolchain.profile = '26.2';
  for (const source of [path.join(f.ctx.root, f.ctx.config.application.sourceDir), f.server])
    await writeJson(path.join(source, '.apex/apexlang.json'), { mmdVersion: '26.2.0+3479' });
  oracle.targetVersions = async () => ({ apexVersion: '26.2.0', databaseVersion: '23.26.0' });
  await f.service.sync(f.ctx, 'dev', 'init');
  const old = await readFile(await f.store.file());
  f.exact();
  f.calls.length = 0;
  const next = await f.service.plan(f.ctx, 'dev', { importMode: 'full' });
  assert.equal(next.schemaVersion, 4);
  assert.equal((next.target.workspace as { workspace_id: unknown }).workspace_id, '10934068819404041');
  assert.equal(next.backupRequired, true);
  assert.equal('backupStrategy' in next && next.backupStrategy, 'fresh-export');
  assert.deepEqual(await readFile(await f.store.file()), old);
  assert.ok(!f.calls.includes('import'));
});
for (const id of [123, 10934068819404040])
  test(
    'held numeric identity ' + id + ' stays held across replan/refresh/invalidate/reconciliation',
    async (t) => {
      const f = await fixture(t, id);
      await f.service.sync(f.ctx, 'dev', 'init');
      f.controls.failImport = true;
      await assert.rejects(f.apply(await f.service.plan(f.ctx, 'dev')), { code: 'OUTCOME_UNKNOWN' });
      const state = (await f.store.read())!,
        run = state.importingRunId!;
      assert.equal(state.status, 'outcome_unknown');
      const oldState = await readFile(await f.store.file()),
        oldOwner = await readFile(f.control.file('active.json')),
        oldRuns = await frozenRunFiles(f.ctx.root);
      f.exact();
      const importCount = f.calls.filter((c) => c === 'import').length;
      for (const action of ['init', 'refresh', 'invalidate'] as const)
        await assert.rejects(f.service.sync(f.ctx, 'dev', action), { code: 'SYNC_BLOCKED' });
      await assert.rejects(f.service.plan(f.ctx, 'dev'), { code: 'SYNC_BLOCKED' });
      await assert.rejects(f.service.reconcile(f.ctx, run), { code: 'IDENTITY_MISMATCH' });
      assert.equal(f.calls.filter((c) => c === 'import').length, importCount);
      assert.deepEqual(await readFile(await f.store.file()), oldState);
      assert.deepEqual(await readFile(f.control.file('active.json')), oldOwner);
      const now = await frozenRunFiles(f.ctx.root);
      for (const [file, digest] of Object.entries(oldRuns))
        assert.equal(now[file], digest, 'Retained run file changed: ' + file);
    },
  );
