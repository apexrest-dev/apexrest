import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fixture } from '../fixtures/project.ts';
import { DeploymentService, planDigest, targetDigest } from '../../packages/core/src/deploy.ts';
import type { DeployPlan } from '../../packages/core/src/deploy.ts';
import { TestService, qualityGate, reauthRequired } from '../../packages/core/src/testing.ts';
import type { SuiteResult } from '../../packages/core/src/testing.ts';
import type { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { LocalDeploymentControl, coordination } from '../../packages/core/src/deployment-control.ts';
import { atomicWrite, canonical, exists, hash, inventory, writeJson } from '../../packages/core/src/fs.ts';

const passed = (suite: SuiteResult['suite']): SuiteResult => ({
  suite,
  status: 'passed',
  tests: 5,
  failures: 0,
  skipped: 0,
});
const ended: SuiteResult = {
  suite: 'e2e',
  status: 'blocked',
  reason: 'reauth_required',
  tests: 0,
  failures: 0,
  skipped: 0,
};

test('re-authentication is classified only when it is the sole gap in the required gate', () => {
  const required = ['sql', 'e2e'] as const;
  assert.equal(qualityGate([passed('sql'), ended], [...required]), false);
  assert.equal(reauthRequired([passed('sql'), ended], [...required]), true);
  // A failing SQL suite stays a test failure even when E2E also needs a login.
  assert.equal(
    reauthRequired([{ ...passed('sql'), status: 'failed', failures: 1 }, ended], [...required]),
    false,
  );
  // Missing state is an ordinary block, not an ended session.
  assert.equal(
    reauthRequired([passed('sql'), { ...ended, reason: undefined } as unknown as SuiteResult], [...required]),
    false,
  );
  // An ended session of a non-required suite is not a deployment re-auth case.
  assert.equal(reauthRequired([passed('sql'), ended], ['sql']), false);
});

/** Fake managed Playwright: the probe imports this module; the CLI only records that it ran. */
async function fakePlaywright(ctx: { root: string }, session: 'login' | 'authenticated' | 'crash') {
  const home = path.join(ctx.root, 'managed'),
    runner = path.join(home, 'runner'),
    pkg = path.join(runner, 'node_modules/@playwright/test'),
    ran = path.join(ctx.root, 'playwright-ran');
  process.env.APEXREST_HOME = home;
  await mkdir(pkg, { recursive: true });
  await writeJson(path.join(pkg, 'package.json'), {
    name: '@playwright/test',
    type: 'module',
    exports: './index.mjs',
  });
  const visible = (value: boolean) => `({ first: () => ({ isVisible: async () => ${value} }) })`;
  await writeFile(
    path.join(pkg, 'index.mjs'),
    `export const chromium = { async launch() {
      if (${JSON.stringify(session)} === 'crash') throw new Error('fixture browser crash');
      return { async close() {}, async newContext(options) {
        if (!options.storageState) throw new Error('storage state expected');
        return { async route() {}, async newPage() { return {
          async goto() {},
          getByTestId: () => ${visible(session === 'authenticated')},
          locator: () => ${visible(session === 'login')},
        }; } };
      } };
    } };\n`,
  );
  await writeFile(
    path.join(pkg, 'cli.cjs'),
    `require('node:fs').writeFileSync(${JSON.stringify(ran)}, 'ran'); process.exit(1);\n`,
  );
  await writeJson(path.join(home, 'runtime.json'), {
    schemaVersion: 1,
    components: {},
    playwright: path.join(pkg, 'cli.cjs'),
    node: process.execPath,
  });
  return { home, ran };
}
async function e2eProject(session: 'login' | 'authenticated' | 'crash') {
  const { ctx } = await fixture();
  const env = ctx.config.environments.dev!;
  env.baseUrl = 'https://apex.example.test/ords/r/fixture/app/';
  env.expectedMarker = 'fixture-marker';
  const { home, ran } = await fakePlaywright(ctx, session);
  await writeJson(path.join(home, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [ctx.root],
    grants: [
      {
        projectRoot: ctx.root,
        targetDigest: targetDigest(env),
        operations: ['test'],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    ],
  });
  await atomicWrite(path.join(ctx.root, 'tests/e2e/app.spec.mjs'), '// fixture only\n');
  const state = path.join(ctx.root, '.apexrest/auth/dev/state.json');
  await writeJson(state, { cookies: [], origins: [] });
  await writeJson(state + '.meta.json', { expiresAt: new Date(Date.now() + 3600000).toISOString() });
  return { ctx, ran };
}

test('an ended browser session blocks E2E as re-auth required without running the specs', async () => {
  const { ctx, ran } = await e2eProject('login');
  const result = await new TestService({} as OracleAdapter).run(ctx, 'e2e', 'dev');
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'reauth_required');
  assert.equal(result.failures, 0);
  assert.match(result.diagnostic!, /test auth/);
  assert.equal(await exists(ran), false);
});

for (const session of ['authenticated', 'crash'] as const)
  test(`a ${session} probe leaves the E2E specs to decide the result`, async () => {
    const { ctx, ran } = await e2eProject(session);
    const result = await new TestService({} as OracleAdapter).run(ctx, 'e2e', 'dev');
    assert.equal(await exists(ran), true);
    assert.equal(result.status, 'failed');
    assert.equal(result.reason, undefined);
  });

/** Full-import deployment with migrations: the case working-copy imports cannot take. */
async function deployment() {
  const { ctx, plan } = await fixture(),
    home = path.join(ctx.root, 'managed');
  await mkdir(home);
  process.env.APEXREST_HOME = home;
  plan.coordination = coordination(ctx.config.environments.dev!);
  plan.target = { identity: {}, workspace: {}, application: null };
  plan.digest = planDigest(plan);
  await writeJson(path.join(home, 'connections.json'), {
    read: { kind: 'sqlcl-store', name: 'read' },
    deploy: { kind: 'sqlcl-store', name: 'deploy' },
  });
  const calls: string[] = [];
  const controls = {
    lastUpdatedOn: 'imported',
    results: [] as { ok: boolean; reauthRequired?: boolean }[],
  };
  const app = { application_id: 123, alias: 'fixture' };
  const fake = {
    async requireMutationSupport() {},
    async verifyTarget() {
      return { application: app };
    },
    async requireCapability() {
      return { version: plan.compiler };
    },
    async applicationMetadata() {
      return { lastUpdatedOn: controls.lastUpdatedOn };
    },
    async importApplication() {
      calls.push('import');
    },
    async session() {
      return { output: 'fixture-only' };
    },
    async exportApplication() {
      const dir = path.join(ctx.root, 'fixture-backup');
      await atomicWrite(path.join(dir, 'f123.sql'), '-- fixture export, never executable against Oracle');
      const files = await inventory(dir);
      return { directory: dir, digest: hash(canonical(files)), files };
    },
  };
  const service = new DeploymentService(fake as unknown as OracleAdapter, async () => {
    calls.push('tests');
    return { ...(controls.results.shift() ?? { ok: true }), data: { fixture: true } };
  });
  service.fingerprint = async () =>
    ({
      target: plan.target,
      history: [],
      exported: null,
      fingerprint: plan.fingerprint,
    }) as unknown as Awaited<ReturnType<DeploymentService['fingerprint']>>;
  await writeJson(path.join(home, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [ctx.root],
    grants: [
      {
        projectRoot: ctx.root,
        targetDigest: plan.targetDigest,
        planDigest: plan.digest,
        expiresAt: plan.expiresAt,
        operations: ['deploy'],
      },
    ],
  });
  return { ctx, plan, calls, controls, service };
}
const journal = async (directory: string) =>
  (await readFile(path.join(directory, 'journal.jsonl'), 'utf8'))
    .trim()
    .split('\n')
    .map((line) => (JSON.parse(line) as { state: string }).state);

test('post-import re-auth is a distinct blocked outcome, never success or a test failure', async () => {
  const { ctx, plan, service, controls } = await deployment();
  controls.results.push({ ok: false, reauthRequired: true });
  const error = await service.apply(ctx, plan as DeployPlan).then(
    () => assert.fail('apply must not succeed'),
    (e: unknown) => e as { code: string; exitCode: number; status: string; details: { runId: string } },
  );
  assert.equal(error.code, 'POST_DEPLOY_REAUTH_REQUIRED');
  assert.equal(error.exitCode, 4);
  assert.equal(error.status, 'blocked');
  const directory = path.join(ctx.root, '.apexrest/deployments', error.details.runId);
  assert.deepEqual((await journal(directory)).slice(-2), ['testing', 'awaiting_reauth']);
  // Ownership is released: the user can log in and resume without reconciliation.
  assert.equal(await new LocalDeploymentControl(ctx.config.environments.dev!).owner(), undefined);
});

test('verification resumes after re-auth without importing again and then succeeds', async () => {
  const { ctx, plan, service, controls, calls } = await deployment();
  controls.results.push({ ok: false, reauthRequired: true }, { ok: false, reauthRequired: true });
  const runId = await service.apply(ctx, plan as DeployPlan).then(
    () => assert.fail('apply must not succeed'),
    (e: { details: { runId: string } }) => e.details.runId,
  );
  // Still no renewed login: the run stays resumable.
  await assert.rejects(service.resumeVerification(ctx, runId), { code: 'POST_DEPLOY_REAUTH_REQUIRED' });
  const resumed = await service.resumeVerification(ctx, runId);
  assert.equal(resumed.state, 'succeeded');
  assert.deepEqual(
    calls.filter((c) => c === 'import' || c === 'tests'),
    ['import', 'tests', 'tests', 'tests'],
  );
  const directory = path.join(ctx.root, '.apexrest/deployments', runId);
  assert.deepEqual((await journal(directory)).slice(-5), [
    'awaiting_reauth',
    'testing',
    'awaiting_reauth',
    'testing',
    'succeeded',
  ]);
  await assert.rejects(service.resumeVerification(ctx, runId), { code: 'DEPLOY_NOT_AWAITING_REAUTH' });
});

test('resumed verification keeps the gate: failures fail and a changed target is drift', async () => {
  const failing = await deployment();
  failing.controls.results.push({ ok: false, reauthRequired: true }, { ok: false });
  const runId = await failing.service
    .apply(failing.ctx, failing.plan as DeployPlan)
    .catch((e: { details: { runId: string } }) => e.details.runId);
  await assert.rejects(failing.service.resumeVerification(failing.ctx, runId as string), {
    code: 'POST_DEPLOY_TEST_FAILED',
  });
  await assert.rejects(failing.service.resumeVerification(failing.ctx, runId as string), {
    code: 'DEPLOY_NOT_AWAITING_REAUTH',
  });

  const drifted = await deployment();
  drifted.controls.results.push({ ok: false, reauthRequired: true });
  const driftRun = await drifted.service
    .apply(drifted.ctx, drifted.plan as DeployPlan)
    .catch((e: { details: { runId: string } }) => e.details.runId);
  drifted.controls.lastUpdatedOn = 'edited elsewhere';
  await assert.rejects(drifted.service.resumeVerification(drifted.ctx, driftRun as string), {
    code: 'TARGET_DRIFT',
  });
  assert.equal(drifted.calls.filter((c) => c === 'tests').length, 1);
});

test('only an awaiting run can resume, and a failed run is never resumable', async () => {
  const { ctx, plan, service, controls } = await deployment();
  controls.results.push({ ok: false });
  const runId = await service
    .apply(ctx, plan as DeployPlan)
    .catch((e: { code: string }) => (assert.equal(e.code, 'POST_DEPLOY_TEST_FAILED'), null));
  assert.equal(runId, null);
  const runs = path.join(ctx.root, '.apexrest/deployments');
  const [failed] = await import('node:fs/promises').then((fs) => fs.readdir(runs));
  await assert.rejects(service.resumeVerification(ctx, failed!), { code: 'DEPLOY_NOT_AWAITING_REAUTH' });
  await assert.rejects(service.resumeVerification(ctx, 'not-a-run'));
});
