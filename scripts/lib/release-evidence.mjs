import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

const nativeChecks = [
  ...Array.from({ length: 9 }, (_, i) => `HCX-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 11 }, (_, i) => `HCL-${String(i + 1).padStart(3, '0')}`),
];
const connectedTools = ['node', 'sqlcl', 'java'];
const nativeRequirement = (platform, arch) => ({
  execution: 'native-host',
  platform,
  arch,
  hosts: ['codex', 'claude'],
  tools: [...connectedTools, 'codex', 'claude'],
  checks: nativeChecks,
});
// These IDs describe existing host catalogs and connected acceptance scopes.
// A schema-valid report is an inspectable claim, not independent proof of execution.
export const externalEvidenceRequirements = {
  'native-macos': nativeRequirement('darwin', 'arm64'),
  'native-linux': nativeRequirement('linux', 'x64'),
  'native-windows': nativeRequirement('win32', 'x64'),
  'composer-native-new-chat': {
    execution: 'native-host',
    anyNativeHost: true,
    tools: connectedTools,
    checks: ['fresh-discovery', 'composition-workflow'],
  },
  'composer-runtime': {
    execution: 'connected-oracle',
    tools: connectedTools,
    checks: ['CMP014', 'CMP016', 'CMP027'],
    browser: true,
  },
  'oracle-integration': {
    execution: 'connected-oracle',
    tools: connectedTools,
    checks: [
      'real-compiler',
      'same-session-exact-identity',
      'reviewed-plan-source-and-environment-binding',
      'verified-backup-before-import',
      'confirmed-error-free-import/readback',
      'repeated-noop-full-file-and-MMD-preservation',
      'existing-page-and-LOV-preservation',
      'source-drift-rejection',
      'target-identity-drift-rejection',
      'restore-reviewed-backup-alias-verification',
      'interrupted-import-server-first-recovery',
      'shared-home-schema-contention',
      'unsupported-component-refusal',
    ],
    browserDisclosure: true,
  },
};

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;
const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const timestamp = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};
function simulated(value) {
  if (!object(value) && !Array.isArray(value)) return false;
  return Object.entries(value).some(
    ([key, child]) => ((key === 'mock' || key === 'fixture') && child === true) || simulated(child),
  );
}

/** Validate a passed external claim and its local proof bytes without executing its contents. */
export async function validateExternalEvidence(
  evidence,
  kind,
  sourceDigest,
  { evidenceRoot = path.resolve('docs/evidence'), now = Date.now() } = {},
) {
  const requirement = externalEvidenceRequirements[kind];
  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };
  if (!requirement) return { valid: false, errors: ['Unsupported external evidence kind.'] };
  if (!object(evidence)) return { valid: false, errors: ['Report must be a JSON object.'] };
  check(evidence.schemaVersion === 1, 'Use external evidence schemaVersion 1.');
  check(evidence.kind === kind, `Report kind must be ${kind}.`);
  check(evidence.status === 'passed', 'Every required scenario must pass before promotion.');
  check(
    digest(evidence.sourceDigest) && evidence.sourceDigest === sourceDigest,
    'Source digest is not current.',
  );
  check(
    evidence.mock === false && !simulated(evidence),
    'Real execution requires mock:false and no fixture:true or mock:true markers.',
  );
  check(evidence.execution === requirement.execution, `Execution must be ${requirement.execution}.`);
  check(
    timestamp(evidence.startedAt) && timestamp(evidence.completedAt),
    'Record ISO UTC startedAt and completedAt timestamps.',
  );
  if (timestamp(evidence.startedAt) && timestamp(evidence.completedAt))
    check(
      Date.parse(evidence.startedAt) <= Date.parse(evidence.completedAt) &&
        Date.parse(evidence.completedAt) <= now + 300000,
      'Execution timestamps are out of order or in the future.',
    );
  check(
    ['darwin', 'linux', 'win32'].includes(evidence.platform),
    'Record the actual supported process.platform.',
  );
  check(['arm64', 'x64'].includes(evidence.arch), 'Record the actual supported process.arch.');
  check(/^v(?:24|25|26)\.\d+\.\d+$/.test(evidence.node ?? ''), 'Record the actual supported Node version.');
  if (requirement.platform)
    check(evidence.platform === requirement.platform, `This gate requires ${requirement.platform}.`);
  if (requirement.arch) check(evidence.arch === requirement.arch, `This gate requires ${requirement.arch}.`);

  const verified = new Map();
  let references = 0;
  const rootInfo = await lstat(evidenceRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink())
    return { valid: false, errors: [...errors, 'Evidence root must be a regular directory.'] };
  const root = await realpath(evidenceRoot);
  if (root !== path.resolve(evidenceRoot))
    return { valid: false, errors: [...errors, 'Evidence root must have no symlink ancestors.'] };
  async function proofs(rows, label) {
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 64) {
      errors.push(`${label}: supply bounded content-addressed proof references.`);
      return;
    }
    for (const ref of rows) {
      if (++references > 512) {
        errors.push('Too many proof references.');
        return;
      }
      if (
        !object(ref) ||
        !digest(ref.sha256) ||
        !text(ref.path) ||
        ref.path.includes('\\') ||
        ref.path.includes(':') ||
        ref.path.split('/').some((part) => !part || part === '.' || part === '..') ||
        path.isAbsolute(ref.path)
      ) {
        errors.push(`${label}: proof paths must be contained relative paths with SHA-256.`);
        continue;
      }
      const key = ref.path + ':' + ref.sha256;
      if (verified.has(key)) {
        if (!verified.get(key)) errors.push(`${label}: proof failed verification: ${ref.path}.`);
        continue;
      }
      let valid = false;
      try {
        let file = root;
        for (const [i, part] of ref.path.split('/').entries()) {
          file = path.join(file, part);
          const info = await lstat(file);
          if (info.isSymbolicLink() || (i < ref.path.split('/').length - 1 && !info.isDirectory()))
            throw new Error('Symlink or unsupported ancestor.');
        }
        const info = await lstat(file);
        if (!info.isFile() || info.size === 0 || info.size > 64 * 1024 * 1024)
          throw new Error('Proof must be a nonempty regular file of at most 64 MiB.');
        const hash = createHash('sha256');
        for await (const bytes of createReadStream(file)) hash.update(bytes);
        valid = hash.digest('hex') === ref.sha256;
      } catch {
        // Missing/changed/unsafe local proof never establishes external execution.
      }
      verified.set(key, valid);
      check(valid, `${label}: proof is missing, changed or unsafe: ${ref.path}.`);
    }
  }

  const tools = Array.isArray(evidence.tools) ? evidence.tools : [];
  check(tools.length <= 32, 'Too many tool provenance entries.');
  const toolNames = new Set();
  for (const tool of tools.slice(0, 32)) {
    if (!object(tool)) {
      errors.push('Tool provenance must be an object.');
      continue;
    }
    check(text(tool.name) && !toolNames.has(tool.name), 'Tool names must be present and unique.');
    toolNames.add(tool.name);
    check(text(tool.version), `Record the actual ${tool.name} version.`);
    await proofs(tool.proofs, `Tool ${tool.name}`);
  }
  for (const name of requirement.tools) check(toolNames.has(name), `Missing ${name} provenance.`);

  const hosts = Array.isArray(evidence.hosts) ? evidence.hosts : [];
  check(hosts.length <= 2, 'At most two native host provenance entries are supported.');
  const hostNames = new Set();
  for (const host of hosts.slice(0, 2)) {
    if (!object(host)) {
      errors.push('Native host provenance must be an object.');
      continue;
    }
    check(
      ['codex', 'claude'].includes(host.name) && !hostNames.has(host.name),
      'Native host names must be supported and unique.',
    );
    hostNames.add(host.name);
    check(toolNames.has(host.name) && text(host.version), `Record actual ${host.name} tool provenance.`);
    check(
      tools.find((tool) => tool?.name === host.name)?.version === host.version,
      `Native ${host.name} version must match its tool provenance.`,
    );
    check(text(host.sessionId) && host.freshSession === true, `Record a fresh ${host.name} native session.`);
    check(text(host.model) && text(host.effort), `Record observed ${host.name} model and effort.`);
    check(
      host.pluginSourceDigest === sourceDigest && digest(host.runtimeSha256) && digest(host.manifestSha256),
      `Bind ${host.name} to the exact installed plugin and payload hashes.`,
    );
    await proofs(host.proofs, `Host ${host.name}`);
  }
  for (const name of requirement.hosts ?? [])
    check(hostNames.has(name), `Missing fresh ${name} native execution.`);
  if (requirement.anyNativeHost)
    check(hostNames.size > 0, 'At least one real fresh native host is required.');

  const checks = Array.isArray(evidence.checks) ? evidence.checks : [];
  check(checks.length <= 128, 'Too many scenario entries.');
  const ids = new Set();
  for (const row of checks.slice(0, 128)) {
    if (!object(row)) {
      errors.push('Each scenario must be an object.');
      continue;
    }
    check(text(row.id) && !ids.has(row.id), 'Scenario IDs must be present and unique.');
    ids.add(row.id);
    check(row.status === 'passed', `Scenario ${row.id} has not passed.`);
    await proofs(row.proofs, `Scenario ${row.id}`);
  }
  for (const id of requirement.checks) check(ids.has(id), `Missing required scenario ${id}.`);
  if (requirement.browser || requirement.browserDisclosure) {
    const browser = evidence.browserObservation;
    check(
      object(browser) && ['observed', 'unobserved'].includes(browser.status),
      'Disclose browser observation separately from Oracle import.',
    );
    if (requirement.browser)
      check(
        browser?.status === 'observed',
        'Composer runtime requires actual authenticated browser evidence (CMP027).',
      );
    if (browser?.status === 'observed') await proofs(browser.proofs, 'Browser observation');
    else check(text(browser?.reason), 'State why native browser behavior remains unobserved.');
  }
  return { valid: errors.length === 0, errors };
}
