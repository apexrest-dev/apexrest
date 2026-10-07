import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { workingCopyFixture } from '../fixtures/working-copy.ts';
import { atomicWrite, canonical, hash, inventory, writeJson } from '../../packages/core/src/fs.ts';
import { deployPlanSchema, planDigest, type DeployPlan } from '../../packages/core/src/deploy.ts';
import { SyncStore, checkpoint } from '../../packages/core/src/sync.ts';
import { LocalDeploymentControl } from '../../packages/core/src/deployment-control.ts';
import type { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { evaluatePartialImportCompatibility } from '../../packages/core/src/compatibility.ts';
import { selectImport } from '../../packages/core/src/partial-import.ts';
import { Fault } from '../../packages/core/src/result.ts';

const page = 'pages/p00010-customers.apx';
const sibling = 'pages/p00020-orders.apx';
const lov = 'shared-components/lovs/status.apx';

/** Fake Oracle transport only. Real planning, grants, backups, merge and reconciliation run. */
async function initialized(t: import('node:test').TestContext) {
  const previousHome = process.env.APEXREST_HOME;
  const f = await workingCopyFixture();
  t.after(async () => {
    if (previousHome === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = previousHome;
    await rm(f.ctx.root, { recursive: true, force: true });
  });
  const local = path.join(f.ctx.root, f.ctx.config.application.sourceDir);
  f.ctx.config.toolchain.profile = '26.2';
  f.controls.compilerVersion = 'SQLcl: Release 26.3.0.260.1620 Production';
  for (const source of [local, f.server]) {
    await writeJson(path.join(source, '.apex/apexlang.json'), { mmdVersion: '26.2.0+3479' });
    for (const file of [page, sibling, lov]) await atomicWrite(path.join(source, file), 'baseline ' + file);
  }
  const oracle = f.oracle as unknown as OracleAdapter;
  oracle.targetVersions = async () => ({ apexVersion: '26.2.0', databaseVersion: '23.26.0' });
  oracle.partialImportCapabilities = async () =>
    evaluatePartialImportCompatibility({
      apexVersion: '26.2.0',
      databaseVersion: '23.26.0',
      compilerVersion: f.controls.compilerVersion,
      mmdVersion: '26.2.0+3479',
      importFiles: true,
      mode: 'cli',
      databaseTransport: 'direct',
      helpHash: hash('fixture help'),
    });
  const imports: Array<string[] | undefined> = [];
  const hooks: { afterImport?: () => Promise<void> } = {};
  oracle.importApplication = async (_ctx, _env, _conn, source, _signal, files) => {
    f.calls.push('import');
    imports.push(files ? [...files] : undefined);
    if (f.controls.failImport)
      throw new Fault('PROCESS_TIMEOUT', 'Fixture import response lost.', 6, 'outcome_unknown');
    if (files) {
      for (const file of files) {
        await mkdir(path.dirname(path.join(f.server, file)), { recursive: true });
        await cp(path.join(source, file), path.join(f.server, file));
      }
    } else {
      await rm(f.server, { recursive: true });
      await cp(source, f.server, { recursive: true });
    }
    f.controls.metadata.lastUpdatedOn += '1';
    await hooks.afterImport?.();
    return 'Import successful';
  };
  await f.service.sync(f.ctx, 'dev', 'init');
  const store = new SyncStore(f.ctx, f.env, 'dev');
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
        },
      ],
    });
  const apply = async (plan: DeployPlan) => {
    await grant(plan);
    return f.service.apply(f.ctx, plan);
  };
  const edit = async (file: string, content: string, server = false) => {
    await atomicWrite(path.join(server ? f.server : local, file), content);
    if (server) f.controls.metadata.lastUpdatedOn += 'r';
  };
  const content = (file: string, server = false) =>
    readFile(path.join(server ? f.server : local, file), 'utf8');
  f.calls.length = 0;
  return { ...f, local, oracle, imports, hooks, store, grant, apply, edit, content };
}

function selected(plan: DeployPlan) {
  assert.equal(plan.schemaVersion, 4);
  if (plan.schemaVersion !== 4) throw new Error('Expected selected-import plan');
  assert.equal(plan.importSelection.resolvedMode, 'files');
  return plan.importSelection;
}

test('automatic page import preserves remote sibling edits and repeated imports cannot revert them', async (t) => {
  const f = await initialized(t);
  await f.edit(page, 'local first page edit');
  await f.edit(sibling, 'remote sibling edit', true);
  const first = await f.service.plan(f.ctx, 'dev');
  assert.deepEqual(selected(first).files, [page]);
  assert.equal(first.backupRequired, true);
  assert.equal(first.schemaVersion !== 1 && first.backupStrategy, 'fresh-export');
  await f.apply(first);
  assert.deepEqual(f.imports, [[page]]);
  assert.equal(await f.content(page, true), 'local first page edit');
  assert.equal(await f.content(sibling, true), 'remote sibling edit');
  assert.equal(
    await f.content(sibling),
    'baseline ' + sibling,
    'unselected server content is not exported into local context',
  );
  assert.equal((await f.store.read())!.status, 'ready');
  assert.equal((await f.store.status()).dirty, false);
  await f.edit(page, 'local second page edit');
  const second = await f.service.plan(f.ctx, 'dev');
  assert.deepEqual(selected(second).files, [page]);
  await f.apply(second);
  assert.equal(await f.content(sibling, true), 'remote sibling edit');
  assert.equal(
    f.calls.filter((call) => call === 'export:SQL').length,
    0,
    'no SQL backups for selective imports',
  );
  assert.equal((await f.store.read())!.revision, 2);
});

test('shared-component imports bind full APEXlang observation and preserve unselected local work', async (t) => {
  const f = await initialized(t);
  await f.edit(page, 'page using updated LOV');
  await f.edit(lov, 'updated LOV');
  const combined = await f.service.plan(f.ctx, 'dev');
  assert.equal(combined.schemaVersion, 4);
  assert.deepEqual(selected(combined).files, [page, lov].sort());
  assert.equal(selected(combined).exportScope, 'full');
  assert.ok(selected(combined).reasons.includes('shared-components-require-full-apexlang-observation'));
  await f.apply(combined);
  assert.deepEqual(f.imports, [[page, lov].sort()]);
  await f.edit(page, 'second selected page edit');
  await f.edit(sibling, 'unselected local work');
  const explicit = await f.service.plan(f.ctx, 'dev', { importMode: 'files', files: [page] });
  assert.deepEqual(selected(explicit).files, [page]);
  await f.apply(explicit);
  assert.equal(await f.content(sibling), 'unselected local work');
  assert.equal(await f.content(sibling, true), 'baseline ' + sibling);
  assert.equal((await f.store.status()).dirty, true);
  const server = await inventory(f.server);
  assert.deepEqual(
    checkpoint((await f.store.read())!).files,
    server,
    'checkpoint records actual Oracle readback, not unselected local work',
  );
});

test('overlapping local and remote edits block before import rather than becoming a full import', async (t) => {
  const f = await initialized(t);
  await f.edit(page, 'local conflict');
  await f.edit(page, 'remote conflict', true);
  await assert.rejects(f.service.plan(f.ctx, 'dev'), {
    code: 'IMPORT_CONFLICT',
    message: `Local and server changes overlap; reconcile before planning: ${page}`,
  });
  assert.deepEqual(f.imports, []);
  assert.equal(await f.content(page, true), 'remote conflict');
  assert.equal((await f.store.read())!.status, 'ready');
});

test('26.1 remains full and automatic ineligible changes expose reasons while explicit files refuse widening', async (t) => {
  const f = await initialized(t);
  await f.edit('application.apx', 'changed application metadata');
  const full = await f.service.plan(f.ctx, 'dev');
  assert.equal(full.schemaVersion, 4);
  if (full.schemaVersion !== 4) throw new Error('Expected versioned selection');
  assert.equal(full.importSelection.resolvedMode, 'full');
  assert.ok(full.importSelection.reasons.includes('unsupported-component-files'));
  await assert.rejects(f.service.plan(f.ctx, 'dev', { importMode: 'files', files: ['application.apx'] }), {
    code: 'PARTIAL_IMPORT_UNSUPPORTED',
  });
  await writeJson(path.join(f.local, '.apex/apexlang.json'), { mmdVersion: '26.1.0+3102' });
  const legacy = await f.service.plan(f.ctx, 'dev');
  assert.equal(legacy.scope, 'full-application-import');
  assert.ok(legacy.schemaVersion === 2 || legacy.schemaVersion === 3);
  await assert.rejects(f.service.plan(f.ctx, 'dev', { importMode: 'files', files: [page] }), {
    code: 'PARTIAL_IMPORT_UNSUPPORTED',
  });
  assert.deepEqual(f.imports, []);
});

test('selection tampering, source drift, target drift and backup failure stop before selected writes', async (t) => {
  const f = await initialized(t);
  await f.edit(page, 'selected edit');
  const plan = await f.service.plan(f.ctx, 'dev');
  selected(plan).files.push(sibling);
  await assert.rejects(f.apply(plan), { code: 'PLAN_TAMPERED' });
  const clean = await f.service.plan(f.ctx, 'dev');
  await f.edit(page, 'post-plan local drift');
  await assert.rejects(f.apply(clean), { code: 'SOURCE_DRIFT' });
  const remote = await f.service.plan(f.ctx, 'dev');
  await f.edit(page, 'post-plan selected server drift', true);
  await assert.rejects(f.apply(remote), { code: 'TARGET_DRIFT' });
  await f.edit(page, 'baseline ' + page, true);
  const backup = await f.service.plan(f.ctx, 'dev');
  const state = (await f.store.read())!;
  await atomicWrite(
    path.join(f.ctx.root, '.apexrest/backups', state.backup.backupId, 'application/application.apx'),
    'corrupt retained backup',
  );
  await assert.rejects(f.apply(backup), { code: 'BACKUP_INVALID' });
  assert.deepEqual(f.imports, []);
});

test('changing selection and recomputing a digest cannot reuse the original grant', async (t) => {
  const f = await initialized(t);
  await f.edit(page, 'selected edit');
  const plan = await f.service.plan(f.ctx, 'dev');
  await f.grant(plan);
  selected(plan).requestedMode = 'files';
  plan.digest = planDigest(plan);
  await assert.rejects(f.service.apply(f.ctx, plan), { code: 'DEPLOY_APPROVAL_REQUIRED' });
  assert.deepEqual(f.imports, []);
});

test('confirmed import with mismatched readback retains evidence and blocks further writes', async (t) => {
  const f = await initialized(t);
  await f.edit(page, 'selected edit');
  const plan = await f.service.plan(f.ctx, 'dev');
  f.hooks.afterImport = () => f.edit(page, 'unexpected selected edit after import', true);
  await assert.rejects(f.apply(plan), { code: 'POST_DEPLOY_CONTENT_FAILED' });
  const state = (await f.store.read())!;
  assert.equal(state.status, 'verification_failed');
  assert.ok(state.importingRunId);
  const observed = await inventory(
    path.join(
      f.ctx.root,
      '.apexrest/deployments',
      state.importingRunId!,
      'server',
      f.ctx.config.application.sourceDir,
    ),
  );
  assert.equal(observed[page], hash('unexpected selected edit after import'));
  await assert.rejects(f.service.plan(f.ctx, 'dev'), { code: 'SYNC_BLOCKED' });
});

test('interrupted selected import observes unchanged server but read-only reconciliation retains ownership', async (t) => {
  const f = await initialized(t);
  await f.edit(page, 'selected edit');
  const plan = await f.service.plan(f.ctx, 'dev');
  f.controls.failImport = true;
  await assert.rejects(f.apply(plan), { code: 'OUTCOME_UNKNOWN' });
  const state = (await f.store.read())!;
  assert.equal(state.status, 'outcome_unknown');
  assert.equal((await new LocalDeploymentControl(f.env).owner())!.phase, 'writing');
  const reconciliation = await f.service.reconcile(f.ctx, state.importingRunId!);
  assert.equal(reconciliation.comparisonProvenance, 'explicit-live-export');
  assert.equal(reconciliation.recoveryStatus, 'safe-to-replan');
  assert.equal(reconciliation.importedSourcesMatch, false);
  assert.deepEqual(reconciliation.conflictFiles, []);
  assert.equal(reconciliation.targetUnchanged, true);
  assert.equal(reconciliation.retryAllowed, true, 'only a fresh unchanged server export permits a new plan');
  assert.equal(f.imports.length, 1, 'read-only reconciliation does not retry or release ownership');
  assert.equal((await new LocalDeploymentControl(f.env).owner())!.phase, 'writing');
  await assert.rejects(f.service.plan(f.ctx, 'dev'), { code: 'SYNC_BLOCKED' });
});

test('interrupted selected import can replan while preserving unrelated server changes', async (t) => {
  const f = await initialized(t);
  await f.edit(page, 'selected edit');
  const plan = await f.service.plan(f.ctx, 'dev');
  f.controls.failImport = true;
  await assert.rejects(f.apply(plan), { code: 'OUTCOME_UNKNOWN' });
  const run = (await f.store.read())!.importingRunId!;
  await f.edit(sibling, 'unrelated server change', true);
  const observed = await f.service.reconcile(f.ctx, run);
  assert.equal(observed.comparisonProvenance, 'explicit-live-export');
  assert.equal(observed.recoveryStatus, 'safe-to-replan');
  assert.equal(observed.retryAllowed, true);
  assert.deepEqual(observed.conflictFiles, []);
  const recovered = await f.service.recover(f.ctx, run);
  assert.equal(recovered.status, 'replan_required');
  assert.equal(f.imports.length, 1);
  assert.equal(await new LocalDeploymentControl(f.env).owner(), undefined);
  assert.equal(await f.content(sibling, true), 'unrelated server change');
});

test('concurrent local edits after confirmed import survive and require local reconciliation', async (t) => {
  const f = await initialized(t);
  await f.edit(page, 'selected edit');
  const plan = await f.service.plan(f.ctx, 'dev');
  f.hooks.afterImport = () => f.edit(sibling, 'concurrent local work');
  await assert.rejects(f.apply(plan), { code: 'LOCAL_RECONCILIATION_REQUIRED' });
  assert.equal(await f.content(sibling), 'concurrent local work');
  assert.equal(await f.content(page, true), 'selected edit');
  assert.equal((await f.store.read())!.status, 'verification_failed');
});

test('three-way selection preserves remote-only files and detects removal and unsupported component reasons', () => {
  const base = { [page]: 'a', [sibling]: 'b', [lov]: 'c' };
  const local = { ...base, [page]: 'new-a' };
  const remote = { ...base, [sibling]: 'remote-b' };
  const result = selectImport(base, local, remote, {});
  assert.deepEqual(result.files, [page]);
  assert.equal(result.effective[sibling], 'remote-b');
  assert.deepEqual(result.reasons, []);
  const removed: Record<string, string> = { ...local };
  delete removed[lov];
  assert.ok(selectImport(base, removed, remote, {}).reasons.includes('deleted-files-require-full-import'));
  assert.ok(
    selectImport(
      base,
      { ...local, 'shared-components/themes/theme.apx': 'changed' },
      remote,
      {},
    ).reasons.includes('unsupported-component-files'),
  );
  assert.equal(canonical(result.effective), canonical({ ...remote, [page]: 'new-a' }));
});

test('frozen selected sources are checked after the last target read and before any Oracle write', async (t) => {
  const f = await initialized(t);
  await f.edit(page, 'reviewed selected edit');
  const plan = await f.service.plan(f.ctx, 'dev');
  await f.grant(plan);
  let atImport = false;
  const verify = f.oracle.verifyTarget.bind(f.oracle);
  f.oracle.verifyTarget = async (env, connection) => {
    const target = await verify(env, connection);
    if (atImport) {
      atImport = false;
      const deployments = path.join(f.ctx.root, '.apexrest/deployments');
      const [run] = await readdir(deployments);
      await atomicWrite(
        path.join(deployments, run!, 'snapshot', f.ctx.config.application.sourceDir, page),
        'unreviewed frozen edit',
      );
    }
    return target;
  };
  await assert.rejects(
    f.service.apply(f.ctx, plan, undefined, (phase) => {
      if (phase === 'importing') atImport = true;
    }),
    { code: 'SOURCE_DRIFT' },
  );
  assert.deepEqual(f.imports, [], 'changed snapshot must never reach importApplication');
  assert.equal(await f.content(page, true), 'baseline ' + page);
});

test('v4 plans cannot mix explicit import modes or disguise a full SQL restore as selected-file import', async (t) => {
  const f = await initialized(t);
  await f.edit(page, 'reviewed selected edit');
  const plan = await f.service.plan(f.ctx, 'dev');
  const selection = selected(plan);
  const state = (await f.store.read())!;
  assert.equal(
    deployPlanSchema.safeParse({
      ...plan,
      restore: { backupId: state.backup.backupId, checksum: state.backup.checksum },
    }).success,
    false,
  );
  assert.equal(
    deployPlanSchema.safeParse({ ...plan, importSelection: { ...selection, requestedMode: 'full' } }).success,
    false,
  );
  const full = await f.service.plan(f.ctx, 'dev', { importMode: 'full' });
  assert.equal(full.schemaVersion, 4);
  if (full.schemaVersion !== 4) throw new Error('Expected versioned full plan');
  assert.equal(
    deployPlanSchema.safeParse({
      ...full,
      importSelection: { ...full.importSelection, requestedMode: 'files' },
    }).success,
    false,
  );
});

test('automatic full fallback does not discard a known remote delta when server timestamps collide', async (t) => {
  const f = await initialized(t);
  const originalMetadata = { ...f.controls.metadata };
  await f.edit('application.apx', 'unsupported local application edit');
  await f.edit(sibling, 'remote edit within the same metadata timestamp', true);
  Object.assign(f.controls.metadata, originalMetadata);
  await assert.rejects(f.service.plan(f.ctx, 'dev'), { code: 'SYNC_SERVER_CHANGED' });
  assert.deepEqual(f.imports, []);
  assert.equal(await f.content(sibling, true), 'remote edit within the same metadata timestamp');
});

test('page-only cycle performs no full or SQL exports, and unrelated post-plan edits survive', async (t) => {
  const f = await initialized(t);
  await f.edit(page, 'single page intent');
  const plan = await f.service.plan(f.ctx, 'dev');
  await f.edit(sibling, 'parallel editor', true);
  const result = await f.apply(plan);
  assert.equal(await f.content(sibling, true), 'parallel editor');
  assert.ok(
    f.calls.filter((call) => call.startsWith('export:')).every((call) => call === 'export:selection:' + page),
  );
  const report = JSON.parse(
    await readFile(path.join(result.directory, 'readback-verification.json'), 'utf8'),
  );
  assert.equal(report.scope, 'selected');
  assert.equal(report.unselectedServerContentChecked, false);
  assert.deepEqual(report.verifiedFiles, [page]);
  const backup = JSON.parse(
    await readFile(path.join(f.ctx.root, '.apexrest/backups', result.backupId!, 'backup.json'), 'utf8'),
  );
  assert.equal(backup.format, 'APEXLANG');
  assert.deepEqual(Object.keys(backup.files), [page]);
});

test('local no-op opens no Oracle session and makes no server freshness claim', async (t) => {
  const f = await initialized(t);
  await assert.rejects(f.service.plan(f.ctx, 'dev'), { code: 'NO_LOCAL_CHANGES' });
  assert.deepEqual(f.calls, []);
});

test('APEXlang selected backup restores the previous page without replacing siblings or SQL', async (t) => {
  const f = await initialized(t);
  await f.edit(page, 'page version two');
  const applied = await f.apply(await f.service.plan(f.ctx, 'dev'));
  await f.edit(sibling, 'remote sibling before restore', true);
  const plan = await f.service.restorePlan(f.ctx, applied.backupId!);
  assert.equal(plan.restore?.format, 'APEXLANG');
  assert.deepEqual(selected(plan).files, [page]);
  await f.apply(plan);
  assert.equal(await f.content(page, true), 'baseline ' + page);
  assert.equal(await f.content(sibling, true), 'remote sibling before restore');
  assert.equal((await f.store.read())!.status, 'ready');
  assert.equal(f.calls.filter((call) => call === 'export:SQL' || call === 'restore').length, 0);
});

test('new page needs no previous source and its absence backup cannot pretend to restore deletion', async (t) => {
  const f = await initialized(t);
  const created = 'pages/p00050-new-dashboard.apx';
  await f.edit(created, 'new dashboard');
  const result = await f.apply(await f.service.plan(f.ctx, 'dev'));
  const backup = JSON.parse(
    await readFile(path.join(f.ctx.root, '.apexrest/backups', result.backupId!, 'backup.json'), 'utf8'),
  );
  assert.deepEqual(backup.files, {});
  assert.deepEqual(backup.absentFiles, [created]);
  await assert.rejects(f.service.restorePlan(f.ctx, result.backupId!), {
    code: 'RESTORE_LAYOUT_UNSUPPORTED',
  });
});
