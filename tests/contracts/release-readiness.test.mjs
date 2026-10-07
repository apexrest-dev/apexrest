import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';

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
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-readiness-'));
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
  for (const file of ['scripts/check-release-readiness.mjs', 'scripts/lib/release.mjs'])
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
  const record = (file, status = 'passed', sourceDigest = digest) =>
    json(path.join(root, 'docs/evidence', file), { status, sourceDigest, fixture: true });
  for (const file of local) await record(file);
  return { root, run, record };
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
