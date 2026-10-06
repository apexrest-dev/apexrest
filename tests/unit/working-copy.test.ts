import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { chmod, readFile, rm, symlink, stat, rename } from 'node:fs/promises';
import { runTypeScriptChild } from './child-runner.ts';
import { workingCopyFixture as baseFixture } from '../fixtures/working-copy.ts';
import { SyncStore, checkpoint, syncPath } from '../../packages/core/src/sync.ts';
import { DeploymentService, planDigest } from '../../packages/core/src/deploy.ts';
import type { DeployPlan } from '../../packages/core/src/deploy.ts';
import { writeJson, atomicWrite, canonical, hash, inventory } from '../../packages/core/src/fs.ts';
import { LocalDeploymentControl } from '../../packages/core/src/deployment-control.ts';
import { Fault } from '../../packages/core/src/result.ts';
import { ArtifactService } from '../../packages/core/src/artifacts.ts';

// Deploy grants must bind the exact plan digest. Emulate recording the user's
// authorization for each non-restore plan; restores still need their own grant.
async function workingCopyFixture() {
  const f = await baseFixture();
  const apply = f.service.apply.bind(f.service);
  f.service.apply = async (context, value, signal) => {
    const plan = value as DeployPlan;
    if (!plan.restore)
      await writeJson(path.join(process.env.APEXREST_HOME!, 'policy.json'), {
        schemaVersion: 1,
        trustedProjects: [f.ctx.root],
        grants: [
          {
            projectRoot: f.ctx.root,
            targetDigest: plan.targetDigest,
            planDigest: plan.digest,
            operations: ['deploy'],
            expiresAt: plan.expiresAt,
          },
        ],
      });
    return apply(context, value, signal);
  };
  return f;
}
async function initialized() {
  const f = await workingCopyFixture();
  const initial = await f.service.sync(f.ctx, 'dev', 'init');
  const store = new SyncStore(f.ctx, f.env, 'dev');
  const state = (await store.read())!;
  return { ...f, initial, store, state };
}
const exportsOnly = (calls: string[]) => calls.filter((c) => c.startsWith('export:'));

test('initial dual-format sync, restart/repeated init and local status never re-export', async () => {
  const { ctx, env, service, store, calls, state } = await initialized();
  assert.deepEqual(exportsOnly(calls), ['export:APEXLANG', 'export:SQL']);
  assert.equal(state.status, 'ready');
  if (process.platform !== 'win32') assert.equal((await stat(await store.file())).mode & 0o777, 0o600);
  calls.length = 0;
  await service.sync(ctx, 'dev', 'init');
  assert.deepEqual(calls, []);
  const child = await runTypeScriptChild(`
    import {SyncStore} from './packages/core/src/sync.ts';
    import {DeploymentService} from './packages/core/src/deploy.ts';
    const ctx=${JSON.stringify(ctx)};
    console.log(JSON.stringify(await new DeploymentService({}).sync(ctx,'dev','init')));
  `);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(JSON.parse(child.stdout).syncId, state.syncId);
  assert.equal((await new SyncStore(ctx, env, 'dev').read())!.syncId, state.syncId);
  await service.sync(ctx, 'dev', 'status');
  assert.deepEqual(calls, []);
});

test('three edits use real plan/apply: three complete imports, no further exports and stale plans rejected', async () => {
  const { ctx, service, store, calls } = await initialized();
  calls.length = 0;
  for (let edit = 0; edit < 3; edit++) {
    await atomicWrite(
      path.join(ctx.root, ctx.config.application.sourceDir, 'application.apx'),
      'fixture edit ' + edit,
    );
    const plan = await service.plan(ctx, 'dev');
    assert.equal(plan.schemaVersion, 2);
    if (plan.schemaVersion !== 2) throw new Error('Expected v2');
    assert.equal(plan.mode, 'working-copy');
    assert.equal(plan.backupStrategy, 'initial-backup');
    const stale = await service.plan(ctx, 'dev');
    await service.apply(ctx, plan);
    await assert.rejects(service.apply(ctx, stale), { code: 'SYNC_REPLAN_REQUIRED' });
    assert.equal((await store.read())!.revision, edit + 1);
    assert.equal((await store.status()).dirty, false);
  }
  assert.deepEqual(exportsOnly(calls), []);
  assert.equal(calls.filter((c) => c === 'import').length, 3);
});

for (const broken of ['state', 'missing-state', 'baseline', 'backup', 'applied'] as const) {
  test(`corrupt ${broken} blocks before Oracle writes or fallback exports`, async () => {
    const { ctx, service, store, calls, state } = await initialized();
    if (broken === 'applied') {
      await service.apply(ctx, await service.plan(ctx, 'dev'));
      const latest = (await store.read())!.lastSuccessfulImport!.snapshot;
      await atomicWrite(path.join(ctx.root, latest.directory, 'application.apx'), 'corrupt');
    } else if (broken === 'missing-state') await rm(await store.file());
    else if (broken === 'state') await atomicWrite(await store.file(), '{invalid');
    else if (broken === 'baseline')
      await atomicWrite(path.join(ctx.root, state.baseline.directory, 'application.apx'), 'corrupt');
    else
      await atomicWrite(
        path.join(ctx.root, '.apexrest/backups', state.backup.backupId, 'application/f123.sql'),
        'corrupt',
      );
    calls.length = 0;
    await assert.rejects(service.plan(ctx, 'dev'));
    assert.deepEqual(exportsOnly(calls), []);
    assert.ok(!calls.includes('import'));
  });
}

test('source drift, changed metadata and query failures block without auto refresh', async () => {
  const { ctx, service, controls, calls } = await initialized();
  const plan = await service.plan(ctx, 'dev');
  await atomicWrite(path.join(ctx.root, ctx.config.application.sourceDir, 'application.apx'), 'later edit');
  await assert.rejects(service.apply(ctx, plan), { code: 'SOURCE_DRIFT' });
  controls.metadata.lastUpdatedOn = 'external';
  calls.length = 0;
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'SYNC_SERVER_CHANGED' });
  controls.failMetadata = true;
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'QUERY_FAILED' });
  assert.deepEqual(exportsOnly(calls), []);
  assert.ok(!calls.includes('import'));
});

for (const mapping of ['target', 'root', 'source', 'toolchain', 'runtime'] as const) {
  test(`changed ${mapping} cannot silently take the full-export path`, async () => {
    const { ctx, env, service, store, state, calls } = await initialized();
    if (mapping === 'target') env.applicationId++;
    if (mapping === 'root') await store.write({ ...state, projectRoot: '/previous/root' });
    if (mapping === 'source') ctx.config.application.sourceDir = 'src/other';
    if (mapping === 'toolchain')
      await writeJson(path.join(ctx.root, ctx.config.toolchain.lockFile), { version: 'changed' });
    if (mapping === 'runtime') await store.write({ ...state, runtimeVersion: 'old' });
    calls.length = 0;
    await assert.rejects(service.plan(ctx, 'dev'), { code: 'SYNC_MAPPING_CHANGED' });
    assert.deepEqual(exportsOnly(calls), []);
  });
}

test('dirty refresh is rejected before exports; clean refresh safely replaces external edits and retains backups', async () => {
  const { ctx, service, store, state, calls, server, controls } = await initialized();
  await atomicWrite(path.join(ctx.root, ctx.config.application.sourceDir, 'application.apx'), 'local dirty');
  calls.length = 0;
  await assert.rejects(service.sync(ctx, 'dev', 'refresh'), { code: 'SYNC_DIRTY' });
  assert.deepEqual(exportsOnly(calls), []);
  await atomicWrite(
    path.join(ctx.root, ctx.config.application.sourceDir, 'application.apx'),
    await readFile(path.join(ctx.root, state.baseline.directory, 'application.apx')),
  );
  await atomicWrite(path.join(server, 'application.apx'), 'external clean refresh');
  controls.metadata.lastUpdatedOn = 'changed';
  await service.sync(ctx, 'dev', 'refresh');
  assert.deepEqual(exportsOnly(calls), ['export:APEXLANG', 'export:SQL']);
  assert.equal(
    await readFile(path.join(ctx.root, ctx.config.application.sourceDir, 'application.apx'), 'utf8'),
    'external clean refresh',
  );
  assert.notEqual((await store.read())!.backup.backupId, state.backup.backupId);
  assert.ok(await stat(path.join(ctx.root, '.apexrest/backups', state.backup.backupId, 'backup.json')));
});

test('initial adoption conflict retains private staging and does not overwrite local sources', async () => {
  const { ctx, service, server, calls, env } = await workingCopyFixture();
  await atomicWrite(path.join(server, 'application.apx'), 'server edit');
  await assert.rejects(service.sync(ctx, 'dev', 'init'), { code: 'SYNC_SOURCE_CONFLICT' });
  assert.equal(
    await readFile(path.join(ctx.root, ctx.config.application.sourceDir, 'application.apx'), 'utf8'),
    'mock-only-fixture',
  );
  assert.equal(await new SyncStore(ctx, env, 'dev').read(), null);
  assert.deepEqual(exportsOnly(calls), ['export:APEXLANG', 'export:SQL']);
});

test('init installs sources when source directory is absent', async () => {
  const { ctx, service } = await workingCopyFixture();
  await rm(path.join(ctx.root, ctx.config.application.sourceDir), { recursive: true });
  await service.sync(ctx, 'dev', 'init');
  assert.equal(
    await readFile(path.join(ctx.root, ctx.config.application.sourceDir, 'application.apx'), 'utf8'),
    'mock-only-fixture',
  );
});

test('confirmed import failing required suites preserves previous successful checkpoint', async () => {
  const { ctx, service, controls, store, calls } = await initialized();
  await service.apply(ctx, await service.plan(ctx, 'dev'));
  const previous = (await store.read())!;
  await atomicWrite(path.join(ctx.root, ctx.config.application.sourceDir, 'application.apx'), 'second edit');
  controls.testsPass = false;
  await assert.rejects(service.apply(ctx, await service.plan(ctx, 'dev')), {
    code: 'POST_DEPLOY_TEST_FAILED',
  });
  const failed = (await store.read())!;
  assert.equal(failed.status, 'verification_failed');
  assert.deepEqual(failed.lastSuccessfulImport, previous.lastSuccessfulImport);
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'SYNC_BLOCKED' });
  assert.equal(calls.filter((c) => c === 'import').length, 2);
});

test('working copy awaiting re-auth stays blocked until resumed verification passes', async () => {
  const { ctx, service, controls, store, calls } = await initialized();
  await atomicWrite(path.join(ctx.root, ctx.config.application.sourceDir, 'application.apx'), 'reauth edit');
  controls.testsPass = false;
  controls.reauthRequired = true;
  const before = (await store.read())!;
  const runId = await service.apply(ctx, await service.plan(ctx, 'dev')).then(
    () => assert.fail('apply must not succeed'),
    (e: { code: string; details: { runId: string } }) => (
      assert.equal(e.code, 'POST_DEPLOY_REAUTH_REQUIRED'),
      e.details.runId
    ),
  );
  const waiting = (await store.read())!;
  assert.equal(waiting.status, 'verification_failed');
  assert.equal(waiting.importingRunId, runId);
  assert.deepEqual(waiting.lastSuccessfulImport, before.lastSuccessfulImport);
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'SYNC_BLOCKED' });
  controls.testsPass = true;
  controls.reauthRequired = false;
  await service.resumeVerification(ctx, runId);
  const ready = (await store.read())!;
  assert.equal(ready.status, 'ready');
  assert.equal(ready.revision, before.revision + 1);
  assert.equal(ready.lastSuccessfulImport!.runId, runId);
  assert.equal(calls.filter((c) => c === 'import').length, 1);
});

test('lost import response blocks retries and invalidate cannot clear unknown ownership', async () => {
  const { ctx, service, controls, store, calls, env } = await initialized();
  controls.failImport = true;
  await assert.rejects(service.apply(ctx, await service.plan(ctx, 'dev')), { code: 'OUTCOME_UNKNOWN' });
  const unknown = (await store.read())!;
  assert.equal(unknown.status, 'outcome_unknown');
  assert.equal(unknown.lastSuccessfulImport, null);
  assert.equal((await new LocalDeploymentControl(env).owner())!.phase, 'writing');
  await assert.rejects(service.sync(ctx, 'dev', 'invalidate'), { code: 'SYNC_BLOCKED' });
  await assert.rejects(service.sync(ctx, 'dev', 'refresh'), { code: 'SYNC_BLOCKED' });
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'SYNC_BLOCKED' });
  const reconciliation = await service.reconcile(ctx, unknown.importingRunId!);
  assert.equal(reconciliation.retryAllowed, false);
  assert.equal(calls.filter((c) => c === 'import').length, 1);
});

test('leftover importing state blocks after crash even without a live process', async () => {
  const { ctx, service, store, state } = await initialized();
  await store.write({
    ...state,
    status: 'importing',
    importingRunId: '12345678-1234-4123-8123-123456789abc',
  });
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'SYNC_BLOCKED' });
  await assert.rejects(service.sync(ctx, 'dev', 'invalidate'), { code: 'SYNC_BLOCKED' });
});

test('concurrent applies serialize through deployment ownership and sync revision', async () => {
  const { ctx, service, oracle, calls } = await initialized();
  const plan = await service.plan(ctx, 'dev');
  const original = oracle.importApplication;
  let release!: () => void, started!: () => void;
  const writing = new Promise<void>((r) => {
    started = r;
  });
  const wait = new Promise<void>((r) => {
    release = r;
  });
  oracle.importApplication = async (...args: Parameters<typeof original>) => {
    started();
    await wait;
    return original(...args);
  };
  const first = service.apply(ctx, plan);
  await writing;
  await assert.rejects(service.apply(ctx, plan), { code: 'SYNC_BLOCKED' });
  release();
  await first;
  assert.equal(calls.filter((c) => c === 'import').length, 1);
});

test('legacy/full-export path, new applications and production retain normal planning', async () => {
  const { ctx, service, controls, calls, env } = await workingCopyFixture();
  await service.apply(ctx, await service.plan(ctx, 'dev'));
  assert.deepEqual(exportsOnly(calls), [
    'export:APEXLANG',
    'export:APEXLANG',
    'export:SQL',
    'export:APEXLANG',
  ]);
  calls.length = 0;
  controls.exists = false;
  await service.plan(ctx, 'dev');
  assert.deepEqual(exportsOnly(calls), []);
  await assert.rejects(service.sync(ctx, 'dev', 'init'), { code: 'SYNC_SCOPE_UNSUPPORTED' });
  env.kind = 'production';
  controls.exists = true;
  await assert.rejects(service.sync(ctx, 'dev', 'init'), { code: 'SYNC_SCOPE_UNSUPPORTED' });
  const plan = await service.plan(ctx, 'dev');
  assert.equal(plan.schemaVersion === 2 && plan.mode, 'full-export');
});

test('initial backup restore requires separate authorization and invalidates sync before write', async () => {
  const { ctx, service, state, store, oracle, calls } = await initialized();
  const plan = await service.restorePlan(ctx, state.backup.backupId);
  await assert.rejects(service.apply(ctx, plan), { code: 'DEPLOY_APPROVAL_REQUIRED' });
  const home = process.env.APEXREST_HOME!;
  await writeJson(path.join(home, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [ctx.root],
    grants: [
      {
        projectRoot: ctx.root,
        targetDigest: plan.targetDigest,
        planDigest: plan.digest,
        operations: ['deploy'],
        expiresAt: plan.expiresAt,
      },
    ],
  });
  const restore = oracle.restoreApplication;
  oracle.restoreApplication = async () => {
    assert.equal((await store.read())!.status, 'invalidated');
    return restore();
  };
  await service.apply(ctx, plan);
  assert.ok(calls.includes('restore'));
  assert.equal((await store.read())!.status, 'invalidated');
});

test('DB operations incompatible and active sync rejects legacy plans', async () => {
  const { ctx, service, store, calls } = await initialized();
  const plan = await service.plan(ctx, 'dev');
  if (plan.schemaVersion !== 2) throw new Error('Expected v2');
  const { mode: _mode, backupStrategy: _backup, workingCopy: _copy, ...fields } = plan;
  const legacy = { ...fields, schemaVersion: 1 as const };
  legacy.digest = planDigest(legacy);
  await assert.rejects(service.apply(ctx, legacy), { code: 'SYNC_REPLAN_REQUIRED' });
  await atomicWrite(
    path.join(ctx.root, ctx.config.database.packagesDir, 'example.sql'),
    'begin null; end;\n/',
  );
  calls.length = 0;
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'SYNC_DB_OPERATIONS_INCOMPATIBLE' });
  assert.deepEqual(exportsOnly(calls), []);
  await service.sync(ctx, 'dev', 'invalidate');
  assert.equal((await store.read())!.status, 'invalidated');
  await service.plan(ctx, 'dev');
  assert.deepEqual(exportsOnly(calls), ['export:APEXLANG']);
});

test('added and removed security components are risks, private paths reject symlinks and retention preserves baselines', async () => {
  const { ctx, service, state, store } = await initialized();
  await atomicWrite(path.join(ctx.root, ctx.config.application.sourceDir, 'authorization.apx'), 'added auth');
  assert.ok((await service.plan(ctx, 'dev')).risks.includes('authentication-or-authorization-change'));
  await new ArtifactService(ctx).prune();
  assert.deepEqual(
    await inventory(path.join(ctx.root, checkpoint(state).directory)),
    checkpoint(state).files,
  );
  const file = await store.file();
  const directory = path.dirname(file),
    preserved = directory + '-preserved';
  await rename(directory, preserved);
  await symlink(preserved, directory, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'SYNC_PATH_UNSAFE' });
  await assert.rejects(syncPath(ctx, '../escape'), { code: 'PATH_ESCAPE' });
});

test('pre-write failure restores ready state without advancing success', async () => {
  const { ctx, service, oracle, store, state, calls } = await initialized();
  const plan = await service.plan(ctx, 'dev');
  const target = oracle.verifyTarget;
  let reads = 0;
  oracle.verifyTarget = async () => {
    if (++reads === 4) throw new Fault('TARGET_MISMATCH', 'Fixture last pre-write target mismatch.', 5);
    return target();
  };
  await assert.rejects(service.apply(ctx, plan), { code: 'TARGET_MISMATCH' });
  const after = (await store.read())!;
  assert.equal(after.status, 'ready');
  assert.deepEqual(after.lastSuccessfulImport, state.lastSuccessfulImport);
  assert.ok(!calls.includes('import'));
});

test('local persistence failure after confirmed import keeps unknown state and ownership', async () => {
  const { ctx, service, store, env } = await initialized();
  const plan = await service.plan(ctx, 'dev');
  const write = SyncStore.prototype.write;
  SyncStore.prototype.write = async function (state) {
    if (state.status === 'ready') throw new Error('Fixture durable checkpoint failure');
    return write.call(this, state);
  };
  try {
    await assert.rejects(service.apply(ctx, plan), { code: 'OUTCOME_UNKNOWN' });
  } finally {
    SyncStore.prototype.write = write;
  }
  assert.equal((await store.read())!.status, 'outcome_unknown');
  assert.equal((await store.read())!.lastSuccessfulImport, null);
  assert.equal((await new LocalDeploymentControl(env).owner())!.phase, 'writing');
});

test('changed metadata during initial dual export refuses activation', async () => {
  const { ctx, service, controls, oracle, env } = await workingCopyFixture();
  const exported = oracle.exportApplication;
  oracle.exportApplication = async (...args: Parameters<typeof exported>) => {
    const result = await exported(...args);
    controls.metadata.lastUpdatedOn = 'external';
    return result;
  };
  await assert.rejects(service.sync(ctx, 'dev', 'init'), { code: 'SYNC_SERVER_CHANGED' });
  assert.equal(await new SyncStore(ctx, env, 'dev').read(), null);
});

test('removed security files remain risks and a plan cannot omit that risk', async () => {
  const { ctx, server, service } = await workingCopyFixture();
  const name = 'authorization.apx';
  await atomicWrite(path.join(ctx.root, ctx.config.application.sourceDir, name), 'fixture auth');
  await atomicWrite(path.join(server, name), 'fixture auth');
  await service.sync(ctx, 'dev', 'init');
  await rm(path.join(ctx.root, ctx.config.application.sourceDir, name));
  const plan = await service.plan(ctx, 'dev');
  assert.ok(plan.risks.includes('authentication-or-authorization-change'));
  plan.risks = [];
  plan.digest = planDigest(plan);
  await assert.rejects(service.apply(ctx, plan), { code: 'PLAN_TAMPERED' });
});

test('changed actual compiler requires explicit refresh without hidden exports', async () => {
  const { ctx, service, controls, calls } = await initialized();
  controls.compilerVersion = 'new SQLcl';
  calls.length = 0;
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'SYNC_COMPILER_CHANGED' });
  assert.deepEqual(exportsOnly(calls), []);
  await service.sync(ctx, 'dev', 'refresh');
  const plan = await service.plan(ctx, 'dev');
  assert.equal(plan.compiler, 'new SQLcl');
});

test('security attribute edits in ordinary files are risks; full-export apply recomputes them live', async () => {
  const securityEdit =
    'application x (\n    authentication {\n        scheme: @no-authentication\n    }\n)\n';
  const { ctx, service, calls } = await initialized();
  const file = path.join(ctx.root, ctx.config.application.sourceDir, 'application.apx');
  await atomicWrite(file, securityEdit);
  const working = await service.plan(ctx, 'dev');
  assert.ok(working.risks.includes('authentication-or-authorization-change'));
  working.risks = [];
  working.digest = planDigest(working);
  await assert.rejects(service.apply(ctx, working), { code: 'PLAN_TAMPERED' });
  const full = await workingCopyFixture();
  await atomicWrite(
    path.join(full.ctx.root, full.ctx.config.application.sourceDir, 'application.apx'),
    securityEdit,
  );
  const plan = await full.service.plan(full.ctx, 'dev');
  assert.ok(plan.risks.includes('authentication-or-authorization-change'));
  plan.risks = [];
  plan.digest = planDigest(plan);
  await assert.rejects(full.service.apply(full.ctx, plan), { code: 'PLAN_TAMPERED' });
  assert.ok(!calls.includes('import') && !full.calls.includes('import'));
});

test('a failure after the durable success checkpoint never rolls the working copy back', async (t) => {
  if (process.platform === 'win32' || process.getuid?.() === 0) return t.skip('needs POSIX permissions');
  const { ctx, service, store } = await initialized();
  await atomicWrite(path.join(ctx.root, ctx.config.application.sourceDir, 'application.apx'), 'edit');
  const plan = await service.plan(ctx, 'dev');
  const write = SyncStore.prototype.write;
  let runDir = '';
  SyncStore.prototype.write = async function (state) {
    await write.call(this, state);
    if (state.status === 'ready' && state.lastSuccessfulImport && !runDir) {
      // Make the final journal state write fail after the checkpoint is durable.
      runDir = path.join(ctx.root, '.apexrest/deployments', state.lastSuccessfulImport.runId);
      await chmod(runDir, 0o500);
    }
  };
  try {
    await assert.rejects(service.apply(ctx, plan));
  } finally {
    SyncStore.prototype.write = write;
    if (runDir) await chmod(runDir, 0o700);
  }
  const after = (await store.read())!;
  assert.ok(runDir);
  assert.equal(after.lastSuccessfulImport?.runId, path.basename(runDir));
  assert.equal(after.status, 'outcome_unknown');
});
