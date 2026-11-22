import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { externalEvidenceRequirements } from '../../scripts/lib/release-evidence.mjs';

const local = ['composer-local.json', 'local-checks.json', 'oracle-local.json'];
const external = [
  'composer-runtime.json',
  'composer-native-new-chat.json',
  'native-codex-compat.json',
  'native-linux-x64.json',
  'native-win32-x64.json',
  'oracle-integration.json',
];
const json = (file, value) => writeFile(file, JSON.stringify(value) + '\n');
const npmReadiness = { version: '2.0.0', qualification: 'local' };
const kinds = [
  'composer-runtime',
  'composer-native-new-chat',
  'native-macos',
  'native-linux',
  'native-windows',
  'oracle-integration',
];
test('native gate scenarios match the documented Codex and Claude host catalogs', async () => {
  const expected = [];
  for (const file of ['host-codex.cases.json', 'host-claude.cases.json']) {
    const catalog = JSON.parse(await readFile(path.join('tests/plugin-server', file), 'utf8'));
    expected.push(...catalog.cases.map((row) => row.id));
  }
  for (const kind of ['native-macos', 'native-linux', 'native-windows'])
    assert.deepEqual(externalEvidenceRequirements[kind].checks, expected);
});
async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-readiness-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of [
    'packages',
    'scripts/lib',
    'plugins',
    'resources',
    'schemas',
    'templates',
    'toolchains',
    'site',
    'docs/evidence',
  ])
    await mkdir(path.join(root, dir), { recursive: true });
  for (const file of [
    'scripts/check-release-readiness.mjs',
    'scripts/lib/release.mjs',
    'scripts/lib/release-evidence.mjs',
  ])
    await cp(file, path.join(root, file));
  await json(path.join(root, 'package.json'), { version: '2.0.0', type: 'module' });
  await json(path.join(root, 'publisher.config.json'), { enabled: true, npmEnabled: true, npmReadiness });
  for (const file of [
    'package-lock.json',
    'docs/deployment-safety.md',
    'tsconfig.base.json',
    'LICENSE',
    'NOTICE',
  ])
    await writeFile(path.join(root, file), 'readiness fixture\n');
  const run = (args = []) => {
    const result = spawnSync(process.execPath, ['scripts/check-release-readiness.mjs', ...args], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(result.error, undefined);
    return { code: result.status, report: JSON.parse(result.stdout) };
  };
  const digest = run().report.sourceDigest;
  // Structural contract claims use explicitly synthetic proof bytes in a temporary tree.
  // Their schema validity is not native/Oracle execution evidence.
  const proofBytes = 'Synthetic contract proof only. No native host or Oracle was run.\n';
  const proof = {
    path: 'contract-proof.txt',
    sha256: createHash('sha256').update(proofBytes).digest('hex'),
  };
  await writeFile(path.join(root, 'docs/evidence', proof.path), proofBytes);
  const record = async (file, status = 'passed', sourceDigest = digest, overrides = {}) => {
    const kind = kinds[external.indexOf(file)];
    if (!kind) return json(path.join(root, 'docs/evidence', file), { status, sourceDigest, fixture: true });
    const required = externalEvidenceRequirements[kind];
    const hosts = required.hosts ?? (required.anyNativeHost ? ['codex'] : []);
    const tools = [...new Set([...required.tools, ...hosts])];
    const report = {
      schemaVersion: 1,
      kind,
      status,
      sourceDigest,
      mock: false,
      execution: required.execution,
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
      platform: required.platform ?? 'darwin',
      arch: required.arch ?? 'arm64',
      node: 'v24.21.0',
      tools: tools.map((name) => ({ name, version: '1.0.0', proofs: [proof] })),
      hosts: hosts.map((name) => ({
        name,
        version: '1.0.0',
        sessionId: 'synthetic-contract-session',
        freshSession: true,
        model: 'synthetic-contract-model',
        effort: 'medium',
        pluginSourceDigest: sourceDigest,
        runtimeSha256: proof.sha256,
        manifestSha256: proof.sha256,
        proofs: [proof],
      })),
      checks: required.checks.map((id) => ({ id, status: 'passed', proofs: [proof] })),
      ...(required.browser || required.browserDisclosure
        ? { browserObservation: { status: 'observed', proofs: [proof] } }
        : {}),
      ...overrides,
    };
    await json(path.join(root, 'docs/evidence', file), report);
    return report;
  };
  for (const file of local) await record(file);
  return { root, run, record, digest, proof };
}

test('npm permits absent external evidence while full qualification remains incomplete', async (t) => {
  const { run } = await fixture(t);
  const npm = run(['--npm']);
  assert.equal(npm.code, 0);
  assert.equal(npm.report.npmReady, true);
  assert.equal(npm.report.stableReady, false);
  assert.equal(npm.report.qualification, 'incomplete');
  assert.equal(npm.report.requirements.filter((r) => !r.requiredForNpm && r.status === 'missing').length, 6);
  assert.equal(run().code, 3, 'Default full-release gate is retained');
});

test('each missing, failed or stale local report still blocks npm', async (t) => {
  const { root, run, record } = await fixture(t);
  for (const file of local) {
    await rm(path.join(root, 'docs/evidence', file));
    assert.equal(run(['--npm']).code, 3, `missing ${file}`);
    await record(file, 'failed');
    assert.equal(run(['--npm']).code, 3, `failed ${file}`);
    await record(file, 'passed', 'old-source');
    assert.equal(run(['--npm']).code, 3, `stale ${file}`);
    await record(file);
  }
  assert.equal(run(['--npm']).code, 0);
});

test('advisory external failures are visible and cannot establish full qualification', async (t) => {
  const { run, record } = await fixture(t);
  for (const file of external) await record(file, 'failed');
  const npm = run(['--npm']);
  assert.equal(npm.code, 0);
  assert.equal(npm.report.requirements.filter((r) => !r.requiredForNpm && r.status === 'blocked').length, 6);
  assert.equal(npm.report.allEvidencePassed, false);
  for (const file of external) await record(file, 'passed', 'old-source');
  assert.equal(run().code, 3);
  assert.equal(run(['--npm']).report.requirements.filter((r) => r.status === 'stale').length, 6);
  for (const file of external) await record(file);
  assert.equal(run().code, 0);
  assert.equal(run().report.qualification, 'passed');
});

test('npm requires both publishing opt-ins and current evidence after configuration changes', async (t) => {
  const { root, run, record } = await fixture(t);
  for (const config of [
    { enabled: false, npmEnabled: true },
    { enabled: true, npmEnabled: false },
  ]) {
    await json(path.join(root, 'publisher.config.json'), { ...config, npmReadiness });
    const digest = run().report.sourceDigest;
    for (const file of local) await record(file, 'passed', digest);
    const result = run(['--npm']);
    assert.equal(result.report.localEvidencePassed, true);
    assert.equal(result.report.npmPublishingEnabled, false);
    assert.equal(result.code, 3);
  }
  await json(path.join(root, 'publisher.config.json'), { enabled: true, npmEnabled: true, npmReadiness });
  const digest = run().report.sourceDigest;
  for (const file of local) await record(file, 'passed', digest);
  assert.equal(run(['--npm']).code, 0);
  await writeFile(path.join(root, 'packages/new-source.txt'), 'Changed release source\n');
  assert.equal(run(['--npm']).code, 3, 'A source change invalidates all prior local reports');
});

test('the temporary npm exception does not waive qualification for another version', async (t) => {
  const { root, run, record } = await fixture(t);
  await json(path.join(root, 'package.json'), { version: '2.0.1', type: 'module' });
  const digest = run().report.sourceDigest;
  for (const file of local) await record(file, 'passed', digest);
  const next = run(['--npm']);
  assert.equal(next.report.localEvidencePassed, true);
  assert.equal(next.report.npmReadinessPolicy, 'full-qualification');
  assert.equal(next.report.requirements.filter((r) => r.requiredForNpm).length, 9);
  assert.equal(next.code, 3);
  for (const file of external) await record(file, 'passed', digest);
  assert.equal(run(['--npm']).code, 0);
});

test('minimal passed labels and fixture markers cannot qualify an external host', async (t) => {
  const { root, run, record, digest } = await fixture(t);
  const file = 'native-linux-x64.json';
  await json(path.join(root, 'docs/evidence', file), { status: 'passed', sourceDigest: digest });
  let requirement = run().report.requirements.find((r) => r.id === 'native-linux');
  assert.equal(requirement.status, 'invalid');
  assert.match(requirement.reasons.join(' '), /schemaVersion|provenance/);
  for (const marker of [{ fixture: true }, { mock: true }, { metadata: { fixture: true } }]) {
    await record(file, 'passed', digest, marker);
    requirement = run().report.requirements.find((r) => r.id === 'native-linux');
    assert.equal(requirement.status, 'invalid');
    assert.match(requirement.reasons.join(' '), /mock:false/);
  }
});

test('native platform, installed payload and full documented scenario scopes are required', async (t) => {
  const { run, record, digest } = await fixture(t);
  const file = 'native-win32-x64.json';
  const original = await record(file);
  for (const overrides of [
    { platform: 'darwin' },
    { arch: 'arm64' },
    { execution: 'offline-compiler' },
    { hosts: [] },
    { hosts: original.hosts.map((h) => ({ ...h, version: '99.0.0' })) },
    { hosts: original.hosts.map((h) => ({ ...h, pluginSourceDigest: 'a'.repeat(64) })) },
    { checks: original.checks.filter((c) => c.id !== 'HCX-005') },
    { checks: original.checks.map((c) => (c.id === 'HCL-005' ? { ...c, status: 'not_run' } : c)) },
    { tools: [] },
    { completedAt: 'not-a-date' },
    { completedAt: '2025-12-31T23:59:59.000Z' },
    { completedAt: '2999-01-01T00:00:00.000Z' },
  ]) {
    await record(file, 'passed', digest, overrides);
    const r = run().report.requirements.find((r) => r.id === 'native-windows');
    assert.equal(r.status, 'invalid', JSON.stringify(overrides));
    assert.ok(r.reasons.length);
  }
  await record(file);
  assert.equal(run().report.requirements.find((r) => r.id === 'native-windows').status, 'passed');
});

test('proof references reject missing, changed, escaping and symlinked bytes', async (t) => {
  const { root, run, record, digest, proof } = await fixture(t);
  const file = 'composer-native-new-chat.json';
  const original = await record(file);
  for (const refs of [
    [],
    [{ ...proof, path: '../contract-proof.txt' }],
    [{ ...proof, path: '/tmp/contract-proof.txt' }],
    [{ ...proof, path: 'missing.txt' }],
    [{ ...proof, sha256: '0'.repeat(64) }],
  ]) {
    await record(file, 'passed', digest, { checks: original.checks.map((c) => ({ ...c, proofs: refs })) });
    const r = run().report.requirements.find((r) => r.id === 'composer-native-new-chat');
    assert.equal(r.status, 'invalid');
    assert.match(r.reasons.join(' '), /proof/);
  }
  const real = path.join(root, 'docs/evidence', 'real-proof');
  await mkdir(real);
  await cp(path.join(root, 'docs/evidence', proof.path), path.join(real, proof.path));
  const link = path.join(root, 'docs/evidence', 'linked-proof');
  // Directory junctions need no Windows developer-mode privilege.
  await symlink(real, link, process.platform === 'win32' ? 'junction' : 'dir');
  await record(file, 'passed', digest, {
    checks: original.checks.map((c) => ({
      ...c,
      proofs: [{ ...proof, path: 'linked-proof/' + proof.path }],
    })),
  });
  assert.equal(run().report.requirements.find((r) => r.id === 'composer-native-new-chat').status, 'invalid');
  await rm(link);
  await record(file);
  await writeFile(path.join(root, 'docs/evidence', proof.path), 'Changed proof\n');
  assert.equal(run().report.requirements.find((r) => r.id === 'composer-native-new-chat').status, 'invalid');
});

test('Composer runtime cannot replace authenticated browser evidence with offline or import success', async (t) => {
  const { run, record, digest } = await fixture(t);
  await record('composer-runtime.json', 'passed', digest, {
    browserObservation: { status: 'unobserved', reason: 'No authenticated browser was used.' },
  });
  const r = run().report.requirements.find((r) => r.id === 'composer-runtime');
  assert.equal(r.status, 'invalid');
  assert.match(r.reasons.join(' '), /authenticated browser/);
  await record('oracle-integration.json', 'passed', digest, {
    browserObservation: { status: 'unobserved', reason: 'Separate browser scope was not requested.' },
  });
  assert.equal(run().report.requirements.find((r) => r.id === 'oracle-integration').status, 'passed');
});

test('malformed reports are invalid while absent reports remain missing and partial reports stay blocked', async (t) => {
  const { root, run, record } = await fixture(t);
  const file = path.join(root, 'docs/evidence/native-linux-x64.json');
  assert.equal(run().report.requirements.find((r) => r.id === 'native-linux').status, 'missing');
  for (const bytes of ['{broken', 'null', '[]']) {
    await writeFile(file, bytes);
    assert.equal(run().report.requirements.find((r) => r.id === 'native-linux').status, 'invalid');
  }
  await record('native-linux-x64.json', 'partial');
  assert.equal(run().report.requirements.find((r) => r.id === 'native-linux').status, 'blocked');
  assert.match(await readFile(file, 'utf8'), /partial/);
});

test('an evidence-root symlink cannot widen the proof directory', async (t) => {
  const { root, run, record } = await fixture(t);
  await record('native-linux-x64.json');
  const evidence = path.join(root, 'docs/evidence');
  const retained = path.join(root, 'retained-evidence');
  await cp(evidence, retained, { recursive: true });
  await rm(evidence, { recursive: true });
  await symlink(retained, evidence, process.platform === 'win32' ? 'junction' : 'dir');
  const r = run().report.requirements.find((r) => r.id === 'native-linux');
  assert.equal(r.status, 'invalid');
  assert.match(r.reasons.join(' '), /Evidence root/);
});

test('an evidence-root ancestor symlink cannot widen the proof directory', async (t) => {
  const { root, run, record } = await fixture(t);
  await record('composer-native-new-chat.json');
  const docs = path.join(root, 'docs');
  const retained = path.join(root, 'retained-docs');
  await cp(docs, retained, { recursive: true });
  await rm(docs, { recursive: true });
  await symlink(retained, docs, process.platform === 'win32' ? 'junction' : 'dir');
  const r = run().report.requirements.find((r) => r.id === 'composer-native-new-chat');
  assert.equal(r.status, 'invalid');
  assert.match(r.reasons.join(' '), /symlink ancestors/);
});
