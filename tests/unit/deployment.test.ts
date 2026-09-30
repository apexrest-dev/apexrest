import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { hostname } from 'node:os';
import { pathToFileURL } from 'node:url';
import { fixture } from '../fixtures/project.ts';
import { DeploymentService, planDigest } from '../../packages/core/src/deploy.ts';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { LocalDeploymentControl, coordination } from '../../packages/core/src/deployment-control.ts';
import { Fault, success } from '../../packages/core/src/result.ts';
import { writeJson, withLock, hash, canonical, inventory, atomicWrite } from '../../packages/core/src/fs.ts';
async function prepared(backup = false, backend: 'local' | 'database' = 'local') {
  const { ctx, plan } = await fixture(),
    home = path.join(ctx.root, 'managed');
  await mkdir(home);
  process.env.APEXREST_HOME = home;
  if (backend === 'database') ctx.config.environments.dev!.deploymentControl = backend;
  plan.configurationDigest = hash(canonical(ctx.config));
  plan.coordination = coordination(ctx.config.environments.dev!);
  plan.digest = planDigest(plan);
  await writeJson(path.join(home, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [ctx.root],
    grants: [
      {
        projectRoot: ctx.root,
        targetDigest: plan.targetDigest,
        expiresAt: plan.expiresAt,
        operations: ['deploy', 'test'],
      },
    ],
  });
  await writeJson(path.join(home, 'connections.json'), {
    read: { kind: 'sqlcl-store', name: 'read' },
    deploy: { kind: 'sqlcl-store', name: 'deploy' },
  });
  const calls: string[] = [];
  const app = { application_id: 123, alias: 'fixture' };
  if (backup) {
    plan.target = { application: app };
    plan.backupRequired = true;
    plan.digest = planDigest(plan);
  }
  const fake = {
    async requireMutationSupport() {},
    async verifyTarget() {
      calls.push('identity');
      return { application: app };
    },
    async requireCapability() {
      return { version: plan.compiler };
    },
    async validate() {
      return { compiler: { version: plan.compiler } };
    },
    async session(sql: string) {
      calls.push(sql);
      return { output: 'fixture-only' };
    },
    async importApplication() {
      calls.push('import');
    },
    async exportApplication() {
      calls.push('backup');
      const dir = path.join(ctx.root, 'fixture-backup');
      await atomicWrite(path.join(dir, 'f123.sql'), '-- fixture export, never executable against Oracle');
      const files = await inventory(dir);
      return { directory: dir, digest: hash(canonical(files)), files };
    },
  };
  const service = new DeploymentService(fake as unknown as OracleAdapter, async () => {
    calls.push('tests');
    return { ok: true, data: { fixture: true } };
  });
  service.fingerprint = async () =>
    ({
      target: { identity: {}, workspace: {}, application: backup ? app : null },
      history:
        backend === 'local'
          ? await service.history(ctx.config.environments.dev!, { kind: 'sqlcl-store', name: 'read' })
          : [],
      exported: null,
      fingerprint: plan.fingerprint,
    }) as Awaited<ReturnType<DeploymentService['fingerprint']>>;
  return { ctx, plan, calls, fake, service };
}
test('fixture apply backs up before import and tests before success', async () => {
  const { ctx, plan, service, calls } = await prepared(true);
  const result = await service.apply(ctx, plan);
  assert.equal(result.state, 'succeeded');
  assert.ok(calls.indexOf('backup') < calls.indexOf('import'));
  assert.ok(calls.indexOf('import') < calls.indexOf('tests'));
  assert.ok(!calls.some((c) => /apexrest_(deploy_locks|migrations)/i.test(c)));
  const state = JSON.parse(await readFile(path.join(result.directory, 'state.json'), 'utf8'));
  assert.equal(state.state, 'succeeded');
});
test('fixture target drift blocks before lease or write', async () => {
  const { ctx, plan, service, calls } = await prepared();
  service.fingerprint = async () =>
    ({ fingerprint: hash('changed') }) as Awaited<ReturnType<DeploymentService['fingerprint']>>;
  await assert.rejects(service.apply(ctx, plan), { code: 'TARGET_DRIFT' });
  assert.ok(!calls.includes('import'));
  assert.ok(!calls.some((c) => c.includes('apexrest_deploy_locks')));
});
test('fixture timeout after import starts retains writing lease and reports unknown', async () => {
  const { ctx, plan, service, calls, fake } = await prepared(false, 'database');
  fake.importApplication = async () => {
    calls.push('import');
    throw new Fault('TIMEOUT', 'fixture timeout', 6, 'outcome_unknown');
  };
  await assert.rejects(service.apply(ctx, plan), { code: 'OUTCOME_UNKNOWN' });
  assert.ok(calls.some((c) => c.includes("phase='writing'")));
  assert.ok(!calls.some((c) => c.startsWith('delete from apexrest_deploy_locks')));
  assert.ok(!calls.includes('tests'));
});
test('forged execution map cannot add SQL even with a recomputed plan digest', async () => {
  const { ctx, plan, service } = await prepared();
  plan.operations.unshift({ kind: 'package', file: 'outside.sql', sha256: hash('evil') });
  plan.digest = planDigest(plan);
  await assert.rejects(service.checkLocal(ctx, plan), { code: 'PLAN_TAMPERED' });
});
test('source map itself is bound and cannot be replaced by a claimed sourceDigest', async () => {
  const { ctx, plan, service } = await prepared();
  plan.sources = {};
  plan.digest = planDigest(plan);
  await assert.rejects(service.checkLocal(ctx, plan), { code: 'PLAN_TAMPERED' });
});
test('expired writing leases are never automatically reclaimed by acquisition SQL', async () => {
  const { ctx, service, calls } = await prepared(false, 'database');
  await service.lease(
    ctx.config.environments.dev!,
    { kind: 'sqlcl-store', name: 'deploy' },
    'fixture-run',
    true,
  );
  assert.match(calls.join('\n'), /lease_until<systimestamp and phase='preparing'/);
});
test('same-host dead installer process lock is recovered without granting a live owner access', async () => {
  const { ctx } = await fixture();
  const lock = path.join(ctx.root, 'setup.lock');
  const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  assert.equal(child.status, 0);
  await writeJson(lock, { pid: child.pid, hostname: hostname(), createdAt: new Date().toISOString() });
  assert.equal(await withLock(lock, async () => 42), 42);
});
test('successful data responses recursively redact secrets including JSON key syntax', () => {
  const r = success('fixture', {
    token: 'sensitive',
    nested: [{ authorization: 'secret' }],
    message: '{"password":"credential"}',
  });
  assert.ok(!JSON.stringify(r).includes('credential'));
  assert.ok(!JSON.stringify(r).includes('sensitive'));
});
test('already cancelled deployment performs no Oracle calls', async () => {
  const { ctx, plan, service, calls } = await prepared();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(service.apply(ctx, plan, controller.signal), { code: 'CANCELLED' });
  assert.equal(calls.length, 0);
});
test('already cancelled process never starts a child executable', async () => {
  const { runProcess } = await import('../../packages/core/src/process.ts');
  const { exists } = await import('../../packages/core/src/fs.ts');
  const { ctx } = await fixture();
  const target = path.join(ctx.root, 'should-not-exist');
  const controller = new AbortController();
  controller.abort();
  const result = await runProcess({
    executable: process.execPath,
    args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(target)},'unexpected')`],
    cwd: ctx.root,
    signal: controller.signal,
  });
  assert.equal(result.cancelled, true);
  assert.equal(await exists(target), false);
});

test('clean APEX plan uses empty local history without a control-table query', async () => {
  const { ctx, service, calls } = await prepared();
  const plan = await service.plan(ctx, 'dev');
  assert.equal(plan.coordination.backend, 'local');
  assert.equal(plan.coordination.scope, 'managed-home-schema');
  assert.deepEqual(plan.migrationHistory, []);
  assert.deepEqual(
    plan.operations.map((o) => o.kind),
    ['import', 'verify', 'test'],
  );
  assert.ok(!calls.some((c) => /apexrest_(deploy_locks|migrations)/i.test(c)));
  await service.apply(ctx, plan);
  assert.ok(calls.includes('import'));
});

test('local migration history persists across service instances and rejects changed checksums', async () => {
  const { ctx, service, calls } = await prepared();
  const file = path.join(ctx.root, ctx.config.database.migrationsDir, '0001__fixture.sql');
  await atomicWrite(file, 'begin null; end;\n/');
  const plan = await service.plan(ctx, 'dev');
  await service.apply(ctx, plan);
  const rows = await new LocalDeploymentControl(ctx.config.environments.dev!).history();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.status, 'succeeded');
  assert.equal(rows[0]!.checksum, hash(await readFile(file)));
  const repeated = await service.plan(ctx, 'dev');
  assert.ok(!repeated.operations.some((o) => o.kind === 'migration'));
  assert.ok(!calls.some((c) => /apexrest_(deploy_locks|migrations)/i.test(c)));
  await atomicWrite(file, 'begin null; null; end;\n/');
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'MIGRATION_HISTORY_CONFLICT' });
});

test('local interrupted migration retains writing ownership and started journal without blind retry', async () => {
  const { ctx, service, fake } = await prepared();
  await atomicWrite(
    path.join(ctx.root, ctx.config.database.migrationsDir, '0001__fixture.sql'),
    'begin null; end;\n/',
  );
  const plan = await service.plan(ctx, 'dev');
  fake.session = async () => {
    throw new Fault('TIMEOUT', 'fixture interrupted DDL', 6, 'outcome_unknown');
  };
  await assert.rejects(service.apply(ctx, plan), { code: 'OUTCOME_UNKNOWN' });
  const control = new LocalDeploymentControl(ctx.config.environments.dev!);
  assert.equal((await control.owner())!.phase, 'writing');
  assert.equal((await control.history())[0]!.status, 'started');
  await assert.rejects(control.acquire('another-run'), { code: 'TARGET_LOCKED' });
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'MIGRATION_HISTORY_CONFLICT' });
});

test('same-schema apps contend locally; an independent schema does not', async () => {
  const { ctx } = await prepared();
  const env = ctx.config.environments.dev!;
  const first = new LocalDeploymentControl(env);
  await first.acquire('first');
  const second = new LocalDeploymentControl({ ...env, applicationId: 999 });
  await assert.rejects(second.acquire('second'), { code: 'TARGET_LOCKED' });
  const independent = new LocalDeploymentControl({ ...env, parsingSchema: 'OTHER' });
  await independent.acquire('independent');
  await independent.release('independent');
  await first.release('first');
  await second.acquire('second');
  await second.release('second');
});
test('status reads tolerate a released local lease while corrupt leases still block', async () => {
  const { ctx } = await prepared(),
    control = new LocalDeploymentControl(ctx.config.environments.dev!);
  for (let i = 0; i < 30; i++) {
    await control.acquire('owner');
    await Promise.all([control.release('owner'), ...Array.from({ length: 8 }, () => control.owner())]);
    assert.equal(await control.owner(), undefined);
  }
  await atomicWrite(control.file('active.json'), 'broken JSON');
  await assert.rejects(() => control.owner());
});

test('local dead preparing owner recovers but dead writing owner requires reconciliation', async () => {
  const { ctx } = await prepared();
  const control = new LocalDeploymentControl(ctx.config.environments.dev!);
  const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  const owner = {
    runId: 'dead',
    pid: child.pid,
    hostname: hostname(),
    phase: 'preparing',
    createdAt: new Date().toISOString(),
  };
  await writeJson(control.file('active.json'), owner);
  await control.acquire('recovered');
  await control.release('recovered');
  await writeJson(control.file('active.json'), { ...owner, phase: 'writing' });
  await assert.rejects(control.acquire('unsafe-retry'), { code: 'TARGET_LOCKED' });
});

test('moving the durable history store invalidates a reviewed plan', async () => {
  const { ctx, plan, service } = await prepared();
  process.env.APEXREST_HOME = path.join(ctx.root, 'other-managed-home');
  await assert.rejects(service.checkLocal(ctx, plan), { code: 'CONTROL_STORE_CHANGED' });
});

test('a separate Node runner cannot acquire an active local schema owner', async () => {
  const { ctx } = await prepared();
  const env = ctx.config.environments.dev!;
  const control = new LocalDeploymentControl(env);
  await control.acquire('parent');
  try {
    const module = pathToFileURL(path.resolve('packages/core/src/deployment-control.ts')).href;
    const script = `import {LocalDeploymentControl} from ${JSON.stringify(module)};
      try { await new LocalDeploymentControl(JSON.parse(process.argv[1])).acquire('child'); process.exitCode=1; }
      catch(e) { if(e.code==='TARGET_LOCKED') console.log(e.code); else throw e; }`;
    const child = spawnSync(
      process.execPath,
      ['--experimental-transform-types', '--input-type=module', '-e', script, JSON.stringify(env)],
      { encoding: 'utf8' },
    );
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout.trim(), 'TARGET_LOCKED');
  } finally {
    await control.release('parent');
  }
});
