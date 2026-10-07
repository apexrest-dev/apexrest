import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
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
    'Trusted project, named SQLcl connections and a supported APEX target',
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

  const ship = async (name) => {
    const result = invoke(['ship', '--env', env, '--mode', 'apply', '--user-request', userRequest]);
    await assertNoShipGrant(name);
    if (!result.data?.grant?.removed) throw new Error(`${name}: ship did not confirm grant removal.`);
    record(name, result);
    return result;
  };

  record('real-compiler', invoke(['apex', 'validate']));
  const planned = invoke(['ship', '--env', env, '--mode', 'plan', '--user-request', userRequest]);
  record('plan-identity', planned, { resolvedMode: planned.data?.importSelection?.resolvedMode });
  await ship('ship-apply-with-backup-and-verification');
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
  // Other acceptance fixtures (target drift, cross-runner contention, unsupported components)
  // must be executed in a separately approved fault-injection environment.
  evidence.status = 'partial';
  evidence.blocker = [
    'Authenticated browser interactions require separate host-browser verification.',
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
