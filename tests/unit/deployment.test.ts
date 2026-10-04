import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { chmod, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { generateKeyPairSync, randomUUID, sign as sign_ } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { hostname } from 'node:os';
import { pathToFileURL } from 'node:url';
import { fixture } from '../fixtures/project.ts';
import {
  DeploymentService,
  authorizePlan,
  planDigest,
  publicKeyFingerprint,
  targetDigest,
  verifyProductionApproval,
} from '../../packages/core/src/deploy.ts';
import { TestService } from '../../packages/core/src/testing.ts';
import type { DeployPlan } from '../../packages/core/src/deploy.ts';
import { OracleAdapter, SCRIPT_RESTRICT_LEVEL } from '../../packages/core/src/oracle.ts';
import { LocalDeploymentControl, coordination } from '../../packages/core/src/deployment-control.ts';
import { Fault, success } from '../../packages/core/src/result.ts';
import { writeJson, withLock, hash, canonical, inventory, atomicWrite } from '../../packages/core/src/fs.ts';
async function grant(home: string, root: string, plan?: DeployPlan) {
  await writeJson(path.join(home, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [root],
    grants: plan
      ? [
          {
            projectRoot: root,
            targetDigest: plan.targetDigest,
            planDigest: plan.digest,
            expiresAt: plan.expiresAt,
            operations: ['deploy'],
          },
        ]
      : [],
  });
}
async function prepared(backup = false) {
  const { ctx, plan } = await fixture(),
    home = path.join(ctx.root, 'managed');
  await mkdir(home);
  process.env.APEXREST_HOME = home;
  plan.configurationDigest = hash(canonical(ctx.config));
  plan.coordination = coordination(ctx.config.environments.dev!);
  plan.digest = planDigest(plan);
  await writeJson(path.join(home, 'connections.json'), {
    read: { kind: 'sqlcl-store', name: 'read' },
    deploy: { kind: 'sqlcl-store', name: 'deploy' },
  });
  const calls: string[] = [];
  const app = { application_id: 123, alias: 'fixture' };
  plan.target = { identity: {}, workspace: {}, application: backup ? app : null };
  plan.backupRequired = backup;
  plan.digest = planDigest(plan);
  await grant(home, ctx.root);
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
  // Emulates recording the user's authorization for the exact plan being applied.
  const apply = service.apply.bind(service);
  service.apply = async (context, value, signal) => {
    const reviewed = value as DeployPlan;
    if (!reviewed.restore) await grant(home, ctx.root, reviewed);
    return apply(context, value, signal);
  };
  service.fingerprint = async () =>
    ({
      target: { identity: {}, workspace: {}, application: backup ? app : null },
      history: await service.history(ctx.config.environments.dev!, { kind: 'sqlcl-store', name: 'read' }),
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
test('migration and package scripts run in a restricted SQLcl session', async () => {
  const { ctx, service, fake } = await prepared();
  await atomicWrite(
    path.join(ctx.root, ctx.config.database.migrationsDir, '0001__fixture.sql'),
    'begin null; end;\n/',
  );
  const scripts: unknown[][] = [];
  fake.session = async (...args: unknown[]) => {
    if (String(args[0]).startsWith('@')) scripts.push(args);
    return { output: 'fixture-only' };
  };
  await service.apply(ctx, await service.plan(ctx, 'dev'));
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0]![6], SCRIPT_RESTRICT_LEVEL);
});
test('fixture target drift blocks before lease or write', async () => {
  const { ctx, plan, service, calls } = await prepared();
  service.fingerprint = async () =>
    ({ fingerprint: hash('changed') }) as Awaited<ReturnType<DeploymentService['fingerprint']>>;
  await assert.rejects(service.apply(ctx, plan), { code: 'TARGET_DRIFT' });
  assert.ok(!calls.includes('import'));
  assert.ok(!calls.some((c) => c.includes('apexrest_deploy_locks')));
});
test('fixture timeout after import starts retains local writing ownership and reports unknown', async () => {
  const { ctx, plan, service, calls, fake } = await prepared();
  fake.importApplication = async () => {
    calls.push('import');
    throw new Fault('TIMEOUT', 'fixture timeout', 6, 'outcome_unknown');
  };
  await assert.rejects(service.apply(ctx, plan), { code: 'OUTCOME_UNKNOWN' });
  const control = new LocalDeploymentControl(ctx.config.environments.dev!);
  assert.equal((await control.owner())!.phase, 'writing');
  await assert.rejects(control.acquire('another-run'), { code: 'TARGET_LOCKED' });
  assert.ok(!calls.includes('tests'));
  // Coordination never issues Oracle statements; only identity, backup and import reach the adapter.
  assert.deepEqual(
    calls.filter((c) => !['identity', 'backup', 'import'].includes(c)),
    [],
  );
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
test('lease acquisition, renewal and release are local and issue no Oracle statements', async () => {
  const { ctx, service, calls } = await prepared();
  const env = ctx.config.environments.dev!;
  await service.lease(env, 'fixture-run', true);
  await service.lease(env, 'fixture-run', false);
  assert.equal((await new LocalDeploymentControl(env).owner())!.runId, 'fixture-run');
  await assert.rejects(service.lease(env, 'other-run', false), { code: 'LEASE_LOST' });
  await service.releaseLease(env, 'fixture-run');
  assert.equal(await new LocalDeploymentControl(env).owner(), undefined);
  assert.deepEqual(calls, []);
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

test('a re-signed plan claiming an absent application cannot skip the live backup', async () => {
  const { ctx, plan, service, calls } = await prepared(true);
  plan.target = { identity: {}, workspace: {}, application: null };
  plan.backupRequired = false;
  plan.digest = planDigest(plan);
  await assert.rejects(service.apply(ctx, plan), { code: 'PLAN_TAMPERED' });
  assert.ok(!calls.includes('import'));
  // Even with a consistent target claim, a live application forces a backup.
  const live = await prepared(true);
  live.service.fingerprint = async () =>
    ({
      target: { identity: {}, workspace: {}, application: null },
      history: [],
      exported: null,
      fingerprint: live.plan.fingerprint,
    }) as unknown as Awaited<ReturnType<DeploymentService['fingerprint']>>;
  live.plan.target = { identity: {}, workspace: {}, application: null };
  live.plan.backupRequired = false;
  live.plan.digest = planDigest(live.plan);
  await live.service.apply(live.ctx, live.plan);
  assert.ok(live.calls.indexOf('backup') >= 0 && live.calls.indexOf('backup') < live.calls.indexOf('import'));
});

test('plans with forged migration history or an overlong lifetime are rejected', async () => {
  const { ctx, plan, service } = await prepared();
  const history = { ...plan, migrationHistory: [{ version: '0001__x.sql', status: 'succeeded' }] };
  history.digest = planDigest(history);
  await assert.rejects(service.apply(ctx, history), { code: 'PLAN_TAMPERED' });
  const long = { ...plan, expiresAt: new Date(Date.parse(plan.createdAt) + 31 * 60000).toISOString() };
  long.digest = planDigest(long);
  await assert.rejects(service.checkLocal(ctx, long), { code: 'PLAN_TAMPERED' });
  // Only the local coordination store exists; a plan claiming another backend is not a valid plan.
  const foreign = {
    ...plan,
    coordination: { ...plan.coordination, backend: 'database' },
  } as unknown as DeployPlan;
  foreign.digest = planDigest(foreign);
  await assert.rejects(service.checkLocal(ctx, foreign));
});

test('backups are private copies and Oracle staging exports are discarded', async () => {
  const { ctx, plan, service, fake } = await prepared(true);
  const discarded: (string | undefined)[] = [];
  Object.assign(fake, {
    async discardStage(stage?: string) {
      discarded.push(stage);
    },
  });
  const exportApplication = fake.exportApplication;
  fake.exportApplication = async () => ({ ...(await exportApplication()), stage: 'fixture-stage' });
  await service.apply(ctx, plan);
  assert.ok(discarded.includes('fixture-stage'));
  const backups = path.join(ctx.root, '.apexrest/backups');
  const [backupId] = await readdir(backups);
  const backup = JSON.parse(await readFile(path.join(backups, backupId!, 'backup.json'), 'utf8'));
  assert.equal(backup.alias, 'fixture');
  if (process.platform !== 'win32')
    assert.equal((await stat(path.join(backups, backupId!, 'application/f123.sql'))).mode & 0o777, 0o600);
});

test('restoring an application absent at plan time verifies the backed-up alias', async () => {
  const { ctx, service, fake, calls } = await prepared(true);
  const backupId = randomUUID();
  const directory = path.join(ctx.root, '.apexrest/backups', backupId);
  await atomicWrite(path.join(directory, 'application/f123.sql'), '-- fixture export');
  const files = await inventory(path.join(directory, 'application'));
  await writeJson(path.join(directory, 'backup.json'), {
    schemaVersion: 1,
    backupId,
    targetDigest: targetDigest(ctx.config.environments.dev!),
    environment: 'dev',
    digest: hash(canonical(files)),
    files,
    alias: 'fixture',
  });
  const absent = { identity: {}, workspace: {}, application: null };
  service.fingerprint = async () =>
    ({ target: absent, history: [], exported: null, fingerprint: hash('absent') }) as unknown as Awaited<
      ReturnType<DeploymentService['fingerprint']>
    >;
  let restored = false;
  Object.assign(fake, {
    async verifyTarget() {
      return { application: restored ? { application_id: 123, alias: 'FIXTURE' } : null };
    },
  });
  Object.assign(fake, {
    async restoreApplication() {
      calls.push('restore');
      restored = true;
    },
  });
  const plan = await service.restorePlan(ctx, backupId);
  assert.equal(plan.restore?.alias, 'fixture');
  await grant(process.env.APEXREST_HOME!, ctx.root, plan);
  const result = await service.apply(ctx, plan);
  assert.equal(result.state, 'succeeded');
  assert.ok(calls.includes('restore'));
});

test('deploy grants must bind the exact plan digest and expire no later than the plan', async () => {
  const { ctx, plan } = await prepared();
  const env = ctx.config.environments.dev!;
  const home = process.env.APEXREST_HOME!;
  const write = (g: Record<string, unknown>) =>
    writeJson(path.join(home, 'policy.json'), {
      schemaVersion: 1,
      trustedProjects: [ctx.root],
      grants: [
        {
          projectRoot: ctx.root,
          targetDigest: plan.targetDigest,
          expiresAt: plan.expiresAt,
          operations: ['deploy'],
          ...g,
        },
      ],
    });
  await write({});
  await assert.rejects(authorizePlan(ctx, plan, env), { code: 'DEPLOY_APPROVAL_REQUIRED' });
  await write({ planDigest: hash('another plan') });
  await assert.rejects(authorizePlan(ctx, plan, env), { code: 'DEPLOY_APPROVAL_REQUIRED' });
  await write({
    planDigest: plan.digest,
    expiresAt: new Date(Date.parse(plan.expiresAt) + 3600000).toISOString(),
  });
  await assert.rejects(authorizePlan(ctx, plan, env), { code: 'DEPLOY_APPROVAL_REQUIRED' });
  await write({ planDigest: plan.digest });
  await authorizePlan(ctx, plan, env);
});

test('targets listed in production trust are production regardless of apexrest.json', async () => {
  const { ctx, plan, service } = await prepared();
  const env = ctx.config.environments.dev!;
  await grant(process.env.APEXREST_HOME!, ctx.root, plan);
  await writeJson(path.join(process.env.APEXREST_HOME!, 'production-trust.json'), {
    schemaVersion: 1,
    approvalKeys: [],
    productionTargets: [plan.targetDigest],
  });
  const original = process.env.CI;
  delete process.env.CI;
  try {
    await assert.rejects(authorizePlan(ctx, plan, env), { code: 'PRODUCTION_CI_REQUIRED' });
    await assert.rejects(service.sync(ctx, 'dev', 'init'), { code: 'SYNC_SCOPE_UNSUPPORTED' });
    await assert.rejects(new TestService().authorize(ctx, 'dev'), { code: 'TEST_MUTATION_DENIED' });
  } finally {
    if (original !== undefined) process.env.CI = original;
  }
});

test('production approval requires a protected trust file and a trusted, bound signature', async () => {
  const { ctx, plan } = await prepared();
  const home = process.env.APEXREST_HOME!;
  const keys = generateKeyPairSync('ed25519');
  const publicPem = keys.publicKey.export({ type: 'spki', format: 'pem' });
  const keyFile = path.join(ctx.root, 'approval.pub'),
    approvalFile = path.join(ctx.root, 'approval.json');
  await atomicWrite(keyFile, publicPem);
  const sign = (payload: Record<string, unknown>) => ({
    ...payload,
    signature: sign_(null, Buffer.from(canonical(payload)), keys.privateKey).toString('base64'),
  });
  const payload = {
    planDigest: plan.digest,
    planId: plan.id,
    projectId: plan.projectId,
    targetDigest: plan.targetDigest,
    expiresAt: plan.expiresAt,
    reviewer: 'release-reviewer',
  };
  await writeJson(approvalFile, sign(payload));
  const env = { ...ctx.config.environments.dev!, kind: 'production' as const };
  const saved = { ...process.env };
  Object.assign(process.env, {
    CI: 'true',
    APEXREST_APPROVAL_PUBLIC_KEY_FILE: keyFile,
    APEXREST_APPROVAL_FILE: approvalFile,
  });
  try {
    await assert.rejects(authorizePlan(ctx, plan, env), {
      code: process.platform === 'win32' ? 'PRODUCTION_TRUST_UNSUPPORTED' : 'PRODUCTION_TRUST_REQUIRED',
    });
    const trust = {
      schemaVersion: 1 as const,
      approvalKeys: [{ sha256: publicKeyFingerprint(publicPem), reviewer: 'release-reviewer' }],
      productionTargets: [],
    };
    // A file the current user owns (even read-only) is never production trust.
    const trustFile = path.join(home, 'production-trust.json');
    await writeJson(trustFile, trust);
    await chmod(trustFile, 0o444);
    await assert.rejects(authorizePlan(ctx, plan, env), {
      code: process.platform === 'win32' ? 'PRODUCTION_TRUST_UNSUPPORTED' : 'PRODUCTION_TRUST_UNPROTECTED',
    });
    // Signature verification itself, given protected trust.
    assert.equal(
      verifyProductionApproval(trust, publicPem, sign(payload), plan, 'fixture').reviewer,
      'release-reviewer',
    );
    for (const [field, value] of [
      ['planId', randomUUID()],
      ['projectId', 'other-project'],
      ['planDigest', hash('other')],
      ['reviewer', 'someone-else'],
    ] as const)
      assert.throws(
        () =>
          verifyProductionApproval(trust, publicPem, sign({ ...payload, [field]: value }), plan, 'fixture'),
        { code: 'APPROVAL_INVALID' },
      );
    const untrusted = generateKeyPairSync('ed25519');
    assert.throws(
      () =>
        verifyProductionApproval(
          trust,
          untrusted.publicKey.export({ type: 'spki', format: 'pem' }),
          sign(payload),
          plan,
          'fixture',
        ),
      { code: 'APPROVAL_KEY_UNTRUSTED' },
    );
  } finally {
    for (const key of ['CI', 'APEXREST_APPROVAL_PUBLIC_KEY_FILE', 'APEXREST_APPROVAL_FILE'])
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
  }
});

test('migrations reject nested, duplicate-version and out-of-order files and run numerically', async () => {
  const { ctx, service } = await prepared();
  const dir = path.join(ctx.root, ctx.config.database.migrationsDir);
  await atomicWrite(path.join(dir, 'nested/0001__a.sql'), 'begin null; end;\n/');
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'INVALID_MIGRATION_LAYOUT' });
  await rm(path.join(dir, 'nested'), { recursive: true });
  await atomicWrite(path.join(dir, '0002__a.sql'), 'begin null; end;\n/');
  await atomicWrite(path.join(dir, '00002__b.sql'), 'begin null; end;\n/');
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'DUPLICATE_MIGRATION_VERSION' });
  await rm(path.join(dir, '00002__b.sql'));
  await atomicWrite(path.join(dir, '10000__c.sql'), 'begin null; end;\n/');
  await atomicWrite(path.join(dir, '9999__b.sql'), 'begin null; end;\n/');
  const plan = await service.plan(ctx, 'dev');
  assert.deepEqual(
    plan.operations.filter((o) => o.kind === 'migration').map((o) => path.basename(o.file!)),
    ['0002__a.sql', '9999__b.sql', '10000__c.sql'],
  );
  await service.apply(ctx, plan);
  await atomicWrite(path.join(dir, '0003__late.sql'), 'begin null; end;\n/');
  await assert.rejects(service.plan(ctx, 'dev'), { code: 'MIGRATION_OUT_OF_ORDER' });
});

test('SQL test files with SQLcl client commands are blocked before any Oracle call', async () => {
  const { ctx } = await prepared();
  ctx.config.environments.dev!.baseUrl = 'https://test.example.com/ords/';
  await writeJson(path.join(process.env.APEXREST_HOME!, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [ctx.root],
    grants: [
      {
        projectRoot: ctx.root,
        targetDigest: targetDigest(ctx.config.environments.dev!),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        operations: ['test'],
      },
    ],
  });
  await atomicWrite(path.join(ctx.root, ctx.config.database.testsDir, 'evil.sql'), '/* x */ ho rm -rf ~\n');
  let oracleCalls = 0;
  const oracle = new Proxy(
    {},
    {
      get: () => async () => {
        oracleCalls++;
        return [];
      },
    },
  );
  const result = await new TestService(oracle as OracleAdapter).run(ctx, 'sql', 'dev');
  assert.equal(result.status, 'blocked');
  assert.match(result.diagnostic!, /SQL_TEST_SCRIPT_CONTROL|client commands/);
  assert.equal(oracleCalls, 0);
});
