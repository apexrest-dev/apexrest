import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { externalEvidenceRequirements } from './release-evidence.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const required = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`);
  return value;
};
const relative = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  !path.isAbsolute(value) &&
  !/[\\:\u0000]/.test(value) &&
  !value.split('/').some((part) => !part || part === '.' || part === '..');

/** Prepare is the default. A write flag never supplies a human instruction or reviewed plan. */
export function integrationOptions(env = process.env) {
  const mode = env.APEXREST_INTEGRATION_MODE ?? 'prepare';
  if (!['prepare', 'apply'].includes(mode)) throw new Error('Use integration mode prepare or apply.');
  const result = {
    mode,
    project: required(env.APEXREST_INTEGRATION_PROJECT, 'APEXREST_INTEGRATION_PROJECT'),
    environment: required(env.APEXREST_INTEGRATION_ENV, 'APEXREST_INTEGRATION_ENV'),
    userRequest: env.APEXREST_INTEGRATION_USER_REQUEST,
    output: env.APEXREST_INTEGRATION_OUTPUT,
    expectNoop: env.APEXREST_INTEGRATION_EXPECT_NOOP === 'true',
  };
  if (mode === 'apply') {
    if (env.APEXREST_INTEGRATION_ALLOW_WRITES !== 'true')
      throw new Error('Apply requires APEXREST_INTEGRATION_ALLOW_WRITES=true and an exact reviewed plan.');
    result.userRequest = required(result.userRequest, 'Literal APEXREST_INTEGRATION_USER_REQUEST');
    result.plan = required(env.APEXREST_INTEGRATION_PLAN, 'APEXREST_INTEGRATION_PLAN');
    if (!relative(result.plan)) throw new Error('The saved plan must be a contained project-relative path.');
    result.planDigest = required(env.APEXREST_INTEGRATION_PLAN_DIGEST, 'APEXREST_INTEGRATION_PLAN_DIGEST');
    if (!/^[a-f0-9]{64}$/.test(result.planDigest)) throw new Error('Expected an exact SHA-256 plan digest.');
    result.review = required(env.APEXREST_INTEGRATION_REVIEW, 'APEXREST_INTEGRATION_REVIEW');
    result.confirmation = env.APEXREST_INTEGRATION_CONFIRMATION;
  }
  return result;
}

async function regularFile(root, relativeFile) {
  if (!relative(relativeFile)) throw new Error('Expected a contained regular project file.');
  let file = root;
  const parts = relativeFile.split('/');
  for (let i = 0; i < parts.length; i++) {
    file = path.join(file, parts[i]);
    const info = await lstat(file);
    if (info.isSymbolicLink() || (i < parts.length - 1 ? !info.isDirectory() : !info.isFile()))
      throw new Error('Plan and source paths must not contain symlinks or special files.');
  }
  return readFile(file);
}

/** Local review/preimage checks precede database commands. Runtime safeguards still apply. */
export async function readReviewedIntegrationPlan(options, config, now = Date.now()) {
  if (!/^[a-f0-9]{64}$/.test(options.configurationDigest ?? ''))
    throw new Error('Fresh authoritative project.inspect configurationDigest is required.');
  const projectRoot = await realpath(options.project);
  if (!Object.hasOwn(config.environments, options.environment)) throw new Error('Environment is absent.');
  const target = config.environments[options.environment];
  if (target.kind === 'production') throw new Error('Production integration is forbidden.');
  const bytes = await regularFile(projectRoot, options.plan);
  const plan = JSON.parse(bytes);
  const review = JSON.parse(await readFile(options.review, 'utf8'));
  if (options.mode === 'apply' && review.applyAllowed !== true)
    throw new Error(
      'A local compatibility review cannot permit apply; an explicit applyAllowed operator review is required.',
    );
  if (
    review.schemaVersion !== 1 ||
    review.status !== 'reviewed' ||
    review.projectRoot !== projectRoot ||
    review.environment !== options.environment ||
    review.planDigest !== options.planDigest ||
    review.planSha256 !== sha256(bytes) ||
    review.userRequestSha256 !== sha256(options.userRequest)
  )
    throw new Error(
      'The review must bind exact project, environment, plan bytes/digest and literal instruction.',
    );
  if (
    plan.projectRoot !== projectRoot ||
    plan.projectId !== config.projectId ||
    plan.environment !== options.environment ||
    plan.digest !== options.planDigest ||
    plan.configurationDigest !== options.configurationDigest ||
    !Number.isFinite(Date.parse(plan.expiresAt)) ||
    Date.parse(plan.expiresAt) <= now
  )
    throw new Error('Saved plan identity, environment, digest or expiry differs from the reviewed plan.');
  const identity = plan.target?.identity;
  if (
    identity?.db_unique_name !== target.databaseIdentity.dbUniqueName ||
    identity?.service_name !== target.databaseIdentity.serviceName ||
    identity?.parsing_schema !== target.parsingSchema ||
    plan.target?.workspace?.workspace !== target.workspace ||
    typeof plan.target?.workspace?.workspace_id !== 'string' ||
    !/^[1-9][0-9]*$/.test(plan.target?.workspace?.workspace_id ?? '') ||
    (plan.target?.application !== null && plan.target?.application?.application_id !== target.applicationId)
  )
    throw new Error('Saved plan target must match configuration and exact workspace ID text.');
  if (!plan.sources || !Object.keys(plan.sources).length) throw new Error('Plan source inventory is absent.');
  for (const [file, hash] of Object.entries(plan.sources))
    if (sha256(await regularFile(projectRoot, file)) !== hash)
      throw new Error(`Reviewed source drift: ${file}`);
  let confirmation;
  if (options.confirmation) {
    confirmation = JSON.parse(await readFile(options.confirmation, 'utf8'));
    if (confirmation.planDigest !== plan.digest || !confirmation.userRequest?.trim())
      throw new Error(
        'Remote-risk confirmation must bind this exact plan digest and actual human instruction.',
      );
  }
  if (plan.risks?.some((risk) => risk !== 'application-restore') && !confirmation)
    throw new Error('Remote database risks require separate exact-plan human confirmation.');
  if (
    options.expectNoop &&
    plan.operations?.some((operation) => !['import', 'verify'].includes(operation.kind))
  )
    throw new Error('No-op preservation cannot include database scripts or restores.');
  return { projectRoot, plan, review, confirmation, planSha256: sha256(bytes) };
}

export function integrationChecks() {
  return externalEvidenceRequirements['oracle-integration'].checks.map((id) => ({
    id,
    status: 'not_run',
    proofs: [],
  }));
}

export function integrationStatus(checks) {
  if (checks.some((check) => check.status === 'failed' || check.status === 'blocked')) return 'blocked';
  return checks.length > 0 && checks.every((check) => check.status === 'passed') ? 'passed' : 'partial';
}

/** Public ship CLI data is flattened; state.status is not part of its result contract. */
export function integrationApplyConfirmed(result, planDigest) {
  const data = result?.data;
  return (
    result?.ok === true &&
    result?.status === 'succeeded' &&
    data?.status === 'succeeded' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data?.runId ?? '') &&
    data?.verification?.identity === 'confirmed' &&
    data?.verification?.state === 'succeeded' &&
    data?.planDigest === planDigest &&
    data?.grant?.planDigest === planDigest &&
    data?.grant?.removed === true
  );
}

/** Evidence remains under its physical root, including when an ancestor already exists. */
export async function privateIntegrationDirectory(evidenceRoot, output) {
  const root = path.resolve(evidenceRoot);
  if ((await realpath(root)) !== root || (await lstat(root)).isSymbolicLink())
    throw new Error('Evidence root and its ancestors must not be symlinks.');
  const destination = path.resolve(output);
  const relativeDirectory = path.relative(root, destination).split(path.sep).join('/');
  if (!relative(relativeDirectory)) throw new Error('Output must be below the physical evidence root.');
  let directory = root;
  for (const part of relativeDirectory.split('/')) {
    directory = path.join(directory, part);
    try {
      await mkdir(directory, { mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error('Evidence output ancestors must be regular directories, not symlinks.');
  }
  await chmod(destination, 0o700);
  return destination;
}

export function integrationToolProbes(probes) {
  return ['sqlcl', 'java'].map((name) => {
    const probe = probes.find((row) => {
      if (row?.state !== 'detected' || typeof row.command !== 'string' || typeof row.version !== 'string')
        return false;
      const command = path.basename(row.command).toLowerCase();
      return name === 'sqlcl'
        ? /^(?:sql|sqlcl)(?:\.(?:exe|cmd|bat))?$/.test(command) && /SQLcl:\s*Release\b/.test(row.version)
        : /^java(?:\.exe)?$/.test(command) && /\b(?:openjdk|java) version\b/.test(row.version);
    });
    if (!probe) throw new Error(`Doctor did not verify actual ${name} command/version provenance.`);
    return { name, probe };
  });
}

/** An Oracle export is not a release source tree: include every regular asset and metadata file. */
export async function integrationExportInventory(root) {
  if ((await realpath(root)) !== path.resolve(root))
    throw new Error('Unsafe Oracle export directory ancestors.');
  const result = {};
  async function walk(directory, prefix = '') {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe Oracle export directory.');
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name),
        relativeFile = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error('Symlink in Oracle export.');
      if (entry.isDirectory()) await walk(file, relativeFile + '/');
      else if (entry.isFile()) result[relativeFile] = sha256(await readFile(file));
      else throw new Error('Special file in Oracle export.');
    }
  }
  await walk(root);
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}
