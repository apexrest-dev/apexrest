import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { sourceDigest, sha256 } from './lib/release.mjs';
import {
  integrationOptions,
  readReviewedIntegrationPlan,
  integrationChecks,
  integrationStatus,
  privateIntegrationDirectory,
  integrationToolProbes,
  integrationExportInventory,
  integrationApplyConfirmed,
} from './lib/integration.mjs';

// Prepare never imports. Apply consumes exactly one reviewed saved plan; another
// no-op/restore/recovery needs its own normal plan/review. Flags are not consent.
const startedAt = new Date().toISOString();
const evidence = {
  schemaVersion: 1,
  kind: 'oracle-integration',
  sourceDigest: await sourceDigest(),
  mock: false,
  execution: 'connected-oracle',
  startedAt,
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  tools: [],
  status: 'running',
  checks: integrationChecks(),
  runs: [],
  browserObservation: {
    status: 'unobserved',
    reason: 'Browser observations are recorded separately from compiler/import/metadata evidence.',
  },
};
const cli = path.resolve('dist/runtime/apexrest.mjs');
const evidenceRoot = path.resolve('docs/evidence');
let directory = path.join(evidenceRoot, 'integration-attempts', randomUUID());
const json = (file) => readFile(file, 'utf8').then(JSON.parse);
const proof = (file, bytes) => ({
  path: path.relative(evidenceRoot, file).split(path.sep).join('/'),
  sha256: sha256(bytes),
});
try {
  const options = integrationOptions();
  directory = await privateIntegrationDirectory(evidenceRoot, options.output ?? directory);
  await writeFile(path.join(directory, 'started.json'), JSON.stringify({ startedAt, mode: options.mode }), {
    flag: 'wx',
    mode: 0o600,
  });
  const root = await realpath(options.project);
  const config = await json(path.join(root, 'apexrest.json'));
  const manifestBytes = await readFile('plugins/apexrest-apex/bundle-manifest.json');
  const manifest = JSON.parse(manifestBytes);
  evidence.runtime = {
    sourceDigest: manifest.sourceDigest,
    manifestSha256: sha256(manifestBytes),
    cliSha256: sha256(await readFile(cli)),
    current: manifest.sourceDigest === evidence.sourceDigest,
  };
  if (options.mode === 'apply' && !evidence.runtime.current)
    throw new Error('Apply requires the final built runtime to match current product sources.');
  if (!Object.hasOwn(config.environments, options.environment))
    throw new Error('Named environment is absent.');
  const target = config.environments[options.environment];
  if (target.kind === 'production') throw new Error('Integration requires a non-production target.');
  evidence.target = {
    projectId: config.projectId,
    projectRoot: root,
    environment: options.environment,
    ...target,
  };
  // Bad/mismatched reviews fail locally before any compiler or database process.
  let reviewed = null;
  const record = (id, bytes, file) => {
    const check = evidence.checks.find((check) => check.id === id);
    if (!check) throw new Error('Unknown integration scenario.');
    check.status = 'passed';
    check.proofs.push(proof(file, bytes));
  };
  const invoke = async (label, args) => {
    const start = performance.now(),
      commandStartedAt = new Date().toISOString();
    const result = spawnSync(process.execPath, [cli, ...args, '--project', root, '--json'], {
      encoding: 'utf8',
      timeout: 900000,
      maxBuffer: 16 * 1024 * 1024,
    });
    const payload =
      JSON.stringify(
        {
          args,
          startedAt: commandStartedAt,
          completedAt: new Date().toISOString(),
          elapsedMs: performance.now() - start,
          code: result.status,
          signal: result.signal,
          error: result.error?.message,
          stdout: result.stdout,
          stderr: result.stderr,
        },
        null,
        2,
      ) + '\n';
    const file = path.join(directory, label + '.json');
    await writeFile(file, payload, { flag: 'wx', mode: 0o600 });
    let value;
    try {
      value = JSON.parse(result.stdout);
    } catch {
      /* retain raw output */
    }
    evidence.runs.push({ label, proof: proof(file, payload), ok: result.status === 0 && value?.ok === true });
    if (result.status !== 0 || value?.ok !== true)
      throw new Error(
        `${label} failed or has an unknown outcome. Preserve the original run; do not replay. See ${file}`,
      );
    return { value, payload, file };
  };
  if (options.mode === 'apply') {
    const inspected = await invoke('local-project-inspection', ['project', 'inspect', '--detail', 'full']);
    options.configurationDigest = inspected.value.data?.configurationDigest;
    reviewed = await readReviewedIntegrationPlan(options, config);
  }
  const doctor = await invoke('tools', ['doctor']);
  const probes = doctor.value.data?.probes ?? [];
  evidence.tools.push({
    name: 'node',
    version: process.version,
    proofs: [proof(doctor.file, doctor.payload)],
  });
  for (const { name, probe } of integrationToolProbes(probes))
    evidence.tools.push({ name, version: probe.version, proofs: [proof(doctor.file, doctor.payload)] });
  const validated = await invoke('compiler', ['apex', 'validate']);
  record('real-compiler', validated.payload, validated.file);
  if (options.mode === 'prepare') {
    const out = '.apexrest/integration/' + randomUUID() + '.plan.json';
    const planned = await invoke('plan', [
      'deploy',
      'plan',
      '--env',
      options.environment,
      '--out',
      out,
      '--import-mode',
      'full',
    ]);
    evidence.preparedPlan = { path: out, result: planned.value.data };
    const workspaceId = planned.value.data?.target?.workspace?.workspace_id;
    if (typeof workspaceId !== 'string' || !/^[1-9][0-9]*$/.test(workspaceId))
      throw new Error('Plan did not retain the exact workspace ID as decimal text.');
    record('same-session-exact-identity', planned.payload, planned.file);
  } else {
    const reviewBytes = JSON.stringify({ ...reviewed.review, plan: reviewed.plan }, null, 2) + '\n';
    const reviewFile = path.join(directory, 'reviewed-plan.json');
    await writeFile(reviewFile, reviewBytes, { flag: 'wx', mode: 0o600 });
    record('reviewed-plan-source-and-environment-binding', reviewBytes, reviewFile);
    const relativeDirectory = '.apexrest/integration/' + randomUUID();
    let before;
    if (options.expectNoop) {
      await invoke('before-noop-export', [
        'apex',
        'export',
        '--env',
        options.environment,
        '--output',
        relativeDirectory + '/before',
      ]);
      before = await integrationExportInventory(path.join(root, relativeDirectory, 'before'));
    }
    const args = [
      'ship',
      '--env',
      options.environment,
      '--mode',
      'apply',
      '--plan',
      options.plan,
      '--user-request',
      options.userRequest,
    ];
    if (reviewed.confirmation) args.push('--confirmation', JSON.stringify(reviewed.confirmation));
    const applied = await invoke('saved-plan-apply', args);
    if (!integrationApplyConfirmed(applied.value, reviewed.plan.digest))
      throw new Error(
        'Apply did not confirm the exact plan import and temporary grant removal. Preserve its original outcome; do not replay.',
      );
    const policy = path.join(
      path.resolve(process.env.APEXREST_HOME ?? path.join(os.homedir(), '.apexrest')),
      'policy.json',
    );
    const grants = (await json(policy)).grants ?? [];
    if (grants.some((grant) => grant.grantedBy === 'ship' && grant.projectRoot === root))
      throw new Error('A ship grant remains after apply. Stop before another operation.');
    record('confirmed-error-free-import/readback', applied.payload, applied.file);
    if (options.expectNoop) {
      await invoke('after-noop-export', [
        'apex',
        'export',
        '--env',
        options.environment,
        '--output',
        relativeDirectory + '/after',
      ]);
      const after = await integrationExportInventory(path.join(root, relativeDirectory, 'after'));
      const comparison =
        JSON.stringify({ before, after, equal: JSON.stringify(before) === JSON.stringify(after) }, null, 2) +
        '\n';
      const file = path.join(directory, 'noop-inventory.json');
      await writeFile(file, comparison, { flag: 'wx', mode: 0o600 });
      if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error('Complete no-op export/MMD differs. Do not normalize differences.');
      record('repeated-noop-full-file-and-MMD-preservation', comparison, file);
    }
  }
  if ((await sourceDigest()) !== evidence.sourceDigest)
    throw new Error('Product sources changed during qualification.');
  if (!evidence.runtime.current)
    throw new Error(
      'Preliminary read-only evidence uses an earlier built runtime; repeat qualification after the final source build.',
    );
  evidence.status = integrationStatus(evidence.checks);
} catch (error) {
  evidence.status = 'blocked';
  evidence.blocker = String(error);
} finally {
  evidence.completedAt = new Date().toISOString();
  directory = await privateIntegrationDirectory(evidenceRoot, directory);
  await writeFile(path.join(directory, 'report.json'), JSON.stringify(evidence, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
}
console.log(
  JSON.stringify({
    status: evidence.status,
    blocker: evidence.blocker,
    evidence: path.join(directory, 'report.json'),
  }),
);
// All remaining matrix scenarios retain explicit not_run entries. No happy-path
// run overwrites the canonical full-qualification report or implies browser success.
if (evidence.status !== 'passed') process.exitCode = 3;
