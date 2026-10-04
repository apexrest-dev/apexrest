import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-dependencies-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  // A relocated runtime with no marketplace or native manifest must suffice.
  await cp('dist/runtime', path.join(root, 'runtime'), { recursive: true });
  await cp('dist/resources/toolchains', path.join(root, 'resources/toolchains'), { recursive: true });
  const home = path.join(root, 'managed');
  const cache = path.join(root, 'cache');
  await mkdir(home);
  await mkdir(cache);
  return {
    home,
    cache,
    run: (...args) =>
      spawnSync(
        process.execPath,
        [
          path.join(root, 'runtime/apexrest.mjs'),
          'dependencies',
          'install',
          '--home',
          home,
          '--cache-dir',
          cache,
          ...args,
          '--json',
        ],
        {
          cwd: root,
          encoding: 'utf8',
          timeout: 60000,
          env: { ...process.env, APEXREST_RESOURCES: path.join(root, 'resources') },
        },
      ),
  };
}

test('dependency preview works outside a checkout without writes or native registration', async (t) => {
  const { home, cache, run } = await fixture(t);
  const result = run('--dry-run', '--offline', '--skip-browser');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const { data } = JSON.parse(result.stdout);
  assert.equal(data.status, 'planned');
  assert.equal(data.plan.home, await realpath(home));
  assert.equal(data.plan.cache, cache);
  assert.equal(data.plan.offline, true);
  assert.deepEqual(data.plan.steps.map((step) => step.artifact.id).sort(), ['java', 'node', 'sqlcl']);
  assert.equal(data.plan.browser.action, 'skip');
  assert.equal(data.plan.elevation, 'not-authorized');
  assert.deepEqual(await readdir(home), []);
  assert.deepEqual(await readdir(cache), []);
});

test('dependency install requires technical approval and rejects native registration options', async (t) => {
  const { home, cache, run } = await fixture(t);
  const refused = run('--offline', '--skip-browser');
  assert.equal(refused.status, 4, refused.stdout + refused.stderr);
  assert.equal(JSON.parse(refused.stdout).diagnostics[0].code, 'SETUP_APPROVAL_REQUIRED');
  for (const args of [['--native-only'], ['--codex-home', home], ['--from', home]]) {
    const invalid = run('--dry-run', ...args);
    assert.equal(invalid.status, 2, invalid.stdout + invalid.stderr);
  }
  assert.deepEqual(await readdir(home), []);
  assert.deepEqual(await readdir(cache), []);
});

test('dependency preview includes browser installation and preserves separate license consent', async (t) => {
  const { run } = await fixture(t);
  const initial = run('--dry-run');
  assert.equal(initial.status, 0, initial.stdout + initial.stderr);
  const plan = JSON.parse(initial.stdout).data.plan;
  assert.equal(plan.browser.action, 'install-verify');
  assert.equal(plan.browser.installOsDeps, false);
  for (const step of plan.steps.filter((step) => step.artifact.consentRequired && !step.reuse))
    assert.equal(step.consent, 'required');
  const accepted = run('--dry-run', '--yes', '--accept-oracle-license', '--install-os-deps');
  assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
  const acceptedPlan = JSON.parse(accepted.stdout).data.plan;
  assert.ok(acceptedPlan.steps.every((step) => step.consent === 'not-required'));
  assert.equal(acceptedPlan.browser.installOsDeps, true);
});
