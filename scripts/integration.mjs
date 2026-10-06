import { readFile, writeFile, mkdir, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { sourceDigest, files, sha256 } from './lib/release.mjs';

// Happy-path Oracle integration. Writes go only through `ship --mode apply`, which
// records the operator's consent as a short-lived deploy grant bound to the exact
// project, target and plan digest, and removes it after the attempt. The harness
// never edits policy grants; it only reads policy.json to confirm the removal.
const evidence = {
  schemaVersion: 2,
  timestamp: new Date().toISOString(),
  sourceDigest: await sourceDigest(),
  mock: false,
  status: 'running',
  authorization: 'ship-plan-bound-grant',
  checks: [],
  knownBlockers: [],
  prerequisites: [
    'APEXREST_INTEGRATION_PROJECT',
    'APEXREST_INTEGRATION_ENV',
    'APEXREST_INTEGRATION_ALLOW_WRITES=true',
    'Trusted project, existing test authorization, named SQLcl connections, APEX 26.1+, utPLSQL, dedicated E2E test user',
  ],
};
const project = process.env.APEXREST_INTEGRATION_PROJECT,
  env = process.env.APEXREST_INTEGRATION_ENV,
  cli = path.resolve('dist/runtime/apexrest.mjs');
const run = (args) => {
  const r = spawnSync(process.execPath, [cli, ...args, '--project', project, '--json'], {
    encoding: 'utf8',
    timeout: 900000,
    maxBuffer: 4 * 1024 * 1024,
  });
  let result = {};
  try {
    result = JSON.parse(r.stdout || '{}');
  } catch {
    /* reported below as an operation failure */
  }
  return { r, result, codes: result.diagnostics?.map((d) => d.code) ?? [] };
};
const invoke = (args) => {
  const { r, result, codes } = run(args);
  if (r.status !== 0 || !result.ok)
    throw new Error(
      `${args.slice(0, 2).join(' ')}: ${codes.join(',') || r.error?.message || 'operation failed'}`,
    );
  return result;
};
const readJsonFile = async (file) => JSON.parse(await readFile(file, 'utf8'));
const listDir = (dir) => readdir(dir).catch(() => []);
const policyFile = () =>
  path.join(path.resolve(process.env.APEXREST_HOME ?? path.join(os.homedir(), '.apexrest')), 'policy.json');

try {
  if (!project || !env || process.env.APEXREST_INTEGRATION_ALLOW_WRITES !== 'true')
    throw new Error(
      'Authorized disposable integration project/environment/write consent are not configured. No DB write attempted.',
    );
  const root = await realpath(project);
  const config = await readJsonFile(path.join(project, 'apexrest.json'));
  const target = config.environments[env];
  if (!target || target.kind === 'production')
    throw new Error('Integration requires an explicitly configured non-production target.');
  if (!config.tests.requiredSuites.includes('sql') || !config.tests.requiredSuites.includes('e2e'))
    throw new Error('Integration requires SQL and authenticated E2E suites; an empty gate is forbidden.');
  // The operator's APEXREST_INTEGRATION_ALLOW_WRITES=true is the consent; the request text
  // names exactly this project, environment and application and nothing wider.
  const userRequest =
    process.env.APEXREST_INTEGRATION_USER_REQUEST ??
    `Integration harness (APEXREST_INTEGRATION_ALLOW_WRITES=true): import application ${target.applicationId} of project ${config.projectId} into non-production environment ${env}.`;
  evidence.target = { projectId: config.projectId, environment: env, applicationId: target.applicationId };
  const directory = '.apexrest/integration/' + randomUUID();
  await mkdir(path.join(project, directory), { recursive: true });
  const record = (name, result, extra = {}) => {
    evidence.checks.push({ name, ok: result.ok, runId: result.runId, data: result.data, ...extra });
  };

  const assertNoShipGrant = async (step) => {
    let grants = [];
    try {
      grants = (await readJsonFile(policyFile())).grants ?? [];
    } catch {
      /* no policy file means no grant */
    }
    if (grants.some((g) => g.grantedBy === 'ship' && g.projectRoot === root))
      throw new Error(`${step}: a ship grant for this project remained in policy.json after the attempt.`);
  };

  // ship apply runs the required suites after import. A full application import ends
  // existing APEX sessions, so saved-state E2E reaches the login page (separate task).
  // Accept exactly that shape — import verified, SQL passed, only E2E failed after a
  // full import — as a known blocker; the final standalone suite run decides E2E.
  const ship = async (name) => {
    const deployments = path.join(project, '.apexrest/deployments'),
      testRuns = path.join(project, '.apexrest/test-runs');
    const seenRuns = new Set(await listDir(deployments)),
      seenTests = new Set(await listDir(testRuns));
    const { r, result, codes } = run([
      'ship',
      '--env',
      env,
      '--mode',
      'apply',
      '--user-request',
      userRequest,
    ]);
    await assertNoShipGrant(name);
    if (r.status === 0 && result.ok) {
      if (!result.data?.grant?.removed) throw new Error(`${name}: ship did not confirm grant removal.`);
      record(name, result, { resolvedMode: result.data.importSelection?.resolvedMode });
      return result;
    }
    const failure = `ship apply: ${codes.join(',') || r.error?.message || 'operation failed'}`;
    if (!codes.includes('POST_DEPLOY_TEST_FAILED')) throw new Error(`${name}: ${failure}`);
    const newRuns = (await listDir(deployments)).filter((d) => !seenRuns.has(d)),
      newTests = (await listDir(testRuns)).filter((f) => !seenTests.has(f));
    if (newRuns.length !== 1 || newTests.length !== 1) throw new Error(`${name}: ${failure}`);
    const runDir = path.join(deployments, newRuns[0]);
    const plan = await readJsonFile(path.join(runDir, 'plan.json'));
    const states = (await readFile(path.join(runDir, 'journal.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line).state);
    const report = await readJsonFile(path.join(testRuns, newTests[0]));
    const suite = (s) => report.results.find((x) => x.suite === s)?.status;
    const fullImport = plan.schemaVersion !== 4 || plan.importSelection?.resolvedMode === 'full';
    if (
      !states.includes('testing') ||
      states.at(-1) !== 'failed' ||
      !fullImport ||
      suite('sql') !== 'passed' ||
      !['failed', 'blocked'].includes(suite('e2e')) ||
      report.results.some((x) => x.suite !== 'e2e' && ['failed', 'blocked'].includes(x.status))
    )
      throw new Error(`${name}: ${failure}`);
    evidence.checks.push({
      name,
      ok: false,
      runId: newRuns[0],
      classification: 'post-deploy-e2e-after-full-import',
      importVerified: true,
      planDigest: plan.digest,
      testRunId: report.runId,
      suites: Object.fromEntries(report.results.map((x) => [x.suite, x.status])),
    });
    if (!evidence.knownBlockers.includes('post-deploy-e2e-session-loss'))
      evidence.knownBlockers.push('post-deploy-e2e-session-loss');
    return null;
  };

  record('real-compiler', invoke(['apex', 'validate']));
  const planned = invoke(['ship', '--env', env, '--mode', 'plan', '--user-request', userRequest]);
  record('plan-identity', planned, { resolvedMode: planned.data?.importSelection?.resolvedMode });
  await ship('ship-apply-with-backup-and-required-tests');
  record('export-before-noop', invoke(['apex', 'export', '--env', env, '--output', directory + '/before']));
  await ship('noop-ship-apply');
  record('export-after-noop', invoke(['apex', 'export', '--env', env, '--output', directory + '/after']));
  const inventory = async (dir) =>
    Object.fromEntries(
      await Promise.all((await files(dir)).map(async (f) => [f, sha256(await readFile(path.join(dir, f)))])),
    );
  const before = await inventory(path.join(project, directory, 'before')),
    after = await inventory(path.join(project, directory, 'after'));
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error(
      'No-op export differs; inspect exact component/MMD differences before accepting a normalization.',
    );
  evidence.checks.push({
    name: 'noop-complete-file-and-mmd-preservation',
    ok: true,
    files: Object.keys(before).length,
  });
  // After full imports the saved browser state no longer holds a live APEX session.
  // Authenticate again in a local interactive terminal; never script credentials here.
  if (evidence.knownBlockers.length) {
    if (!process.stdin.isTTY)
      throw new Error(
        'Post-deploy E2E failed after a full import and no interactive terminal is available to authenticate again; run `apexrest test auth` and `apexrest test all` manually.',
      );
    const auth = spawnSync(process.execPath, [cli, 'test', 'auth', '--env', env, '--project', project], {
      stdio: 'inherit',
      timeout: 600000,
    });
    if (auth.status !== 0) throw new Error('test auth: interactive re-authentication did not complete.');
    evidence.checks.push({ name: 'interactive-reauthentication', ok: true });
  }
  record('actual-utplsql-and-authenticated-crud', invoke(['test', 'all', '--env', env]));
  // Other acceptance fixtures (target drift, cross-runner contention, unsupported components)
  // must be executed in a separately approved fault-injection environment.
  evidence.status = 'partial';
  evidence.blocker = [
    ...(evidence.knownBlockers.length
      ? [
          'Required E2E inside ship apply fails after a full application import because the saved APEX session ends; standalone SQL+E2E passed after re-authentication.',
        ]
      : []),
    'Cross-runner/fault-injection and existing-app page/LOV preservation fixtures require additional actual target evidence.',
  ].join(' ');
  process.exitCode = 3;
} catch (error) {
  evidence.status = 'blocked';
  evidence.blocker = String(error);
  process.exitCode = 3;
}
await mkdir('docs/evidence', { recursive: true });
await writeFile('docs/evidence/oracle-integration.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(
  JSON.stringify({
    status: evidence.status,
    blocker: evidence.blocker,
    evidence: 'docs/evidence/oracle-integration.json',
  }),
);
