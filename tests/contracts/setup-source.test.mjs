import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const repository = path.resolve('.');
const builtPlugin = path.join(repository, 'dist/codex-compat/plugins/apexrest-apex');
const config = 'hide_agent_reasoning = true\n';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-setup-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = path.join(root, 'managed');
  const codexHome = path.join(root, 'codex');
  const cache = path.join(root, 'cache');
  for (const folder of [home, codexHome, cache]) await mkdir(folder);
  await writeFile(path.join(codexHome, 'config.toml'), config);
  const env = {
    ...process.env,
    APEXREST_HOME: home,
    APEXREST_SQLCL: path.join(root, 'no-sqlcl'),
    APEXREST_JAVA_HOME: path.join(root, 'no-java'),
  };
  delete env.APEXREST_RESOURCES;
  return {
    root,
    run: (cli, ...args) =>
      spawnSync(
        process.execPath,
        [
          '--import',
          pathToFileURL(path.join(repository, 'tests/fixtures/codex-preview.mjs')).href,
          cli,
          'setup',
          '--dry-run',
          '--offline',
          '--home',
          home,
          '--codex-home',
          codexHome,
          '--cache-dir',
          cache,
          ...args,
          '--json',
        ],
        { cwd: root, env, encoding: 'utf8', timeout: 30000 },
      ),
    assertNoWrites: async () => {
      assert.deepEqual(await readdir(home), []);
      assert.deepEqual(await readdir(cache), []);
      assert.deepEqual(await readdir(codexHome), ['config.toml']);
      assert.equal(await readFile(path.join(codexHome, 'config.toml'), 'utf8'), config);
    },
  };
}

function plan(result) {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.status, 'planned');
  assert.equal(envelope.data.package.status, 'valid');
  assert.equal(envelope.data.native.state, 'planned');
  assert.equal(envelope.data.native.scope, 'apexrest-plugin-only');
  assert.ok(path.isAbsolute(envelope.data.native.source));
  assert.match(envelope.data.native.sourceDigest, /^[a-f0-9]{64}$/);
  return envelope.data;
}

test('setup preview resolves the checked-in plugin without inventorying the checkout', async (t) => {
  const { run, assertNoWrites } = await fixture(t);
  plan(run(path.join(repository, 'plugins/apexrest-apex/runtime/apexrest.mjs')));
  await assertNoWrites();
});

test('setup preview resolves the built runtime to its native package', async (t) => {
  const { run, assertNoWrites } = await fixture(t);
  plan(run(path.join(repository, 'dist/runtime/apexrest.mjs')));
  await assertNoWrites();
});

test('setup preview accepts a relocated standalone plugin by default and explicit source', async (t) => {
  const { root, run, assertNoWrites } = await fixture(t);
  const plugin = path.join(root, 'standalone-plugin');
  await cp(builtPlugin, plugin, { recursive: true });
  const cli = path.join(plugin, 'runtime/apexrest.mjs');
  const implicit = plan(run(cli));
  const explicit = plan(run(cli, '--from', plugin));
  assert.equal(implicit.native.sourceDigest, explicit.native.sourceDigest);
  await assertNoWrites();
});

test('setup preview scopes a marketplace source to its plugin, ignoring unrelated files and links', async (t) => {
  const { root, run, assertNoWrites } = await fixture(t);
  const source = path.join(root, 'checkout');
  await cp(path.join(repository, 'dist/codex-compat'), source, { recursive: true });
  const cli = path.join(source, 'plugins/apexrest-apex/runtime/apexrest.mjs');
  const initial = plan(run(cli, '--from', source));
  await mkdir(path.join(source, 'node_modules'));
  await symlink(
    path.join(root, 'missing-workspace-package'),
    path.join(source, 'node_modules/workspace'),
    'dir',
  );
  await writeFile(path.join(source, 'unrelated.txt'), 'This file is outside the plugin payload.\n');
  const changed = plan(run(cli, '--from', source));
  assert.equal(changed.native.sourceDigest, initial.native.sourceDigest);
  await assertNoWrites();
});

test('setup preview still rejects symlinks within the selected plugin payload', async (t) => {
  const { root, run, assertNoWrites } = await fixture(t);
  const plugin = path.join(root, 'standalone-plugin');
  await cp(builtPlugin, plugin, { recursive: true });
  const outside = path.join(root, 'outside.txt');
  await writeFile(outside, 'Not a plugin resource.\n');
  await symlink(outside, path.join(plugin, 'resources/unsafe-link'));
  const result = run(path.join(plugin, 'runtime/apexrest.mjs'), '--from', plugin);
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).diagnostics[0].code, 'SYMLINK_NOT_ALLOWED');
  await assertNoWrites();
});

test('setup preview rejects a symlinked plugin root inside a marketplace', async (t) => {
  const { root, run, assertNoWrites } = await fixture(t);
  const source = path.join(root, 'marketplace');
  await mkdir(path.join(source, 'plugins'), { recursive: true });
  await symlink(builtPlugin, path.join(source, 'plugins/apexrest-apex'), 'dir');
  const result = run(path.join(builtPlugin, 'runtime/apexrest.mjs'), '--from', source);
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).diagnostics[0].code, 'SYMLINK_NOT_ALLOWED');
  await assertNoWrites();
});
