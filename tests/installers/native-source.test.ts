import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  symlink,
} from 'node:fs/promises';
import { atomicWrite, exists, inventory, readJson, writeJson } from '../../packages/core/src/fs.ts';
import { toolCatalog } from '../../packages/core/src/operations.ts';
import { VERSION } from '../../packages/core/src/version.ts';
import { installNative } from '../../packages/installer/src/native.ts';
import { setup, uninstallNative } from '../../packages/installer/src/setup.ts';
import { nativeMarketplace, validateNative } from '../../packages/installer/src/package-source.ts';

const quote = (value: string) => "'" + value.replaceAll("'", "'\"'\"'") + "'";

async function fixture(t: TestContext, dualHost = false) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-native-source-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'checkout');
  const plugin = path.join(source, 'plugins/apexrest-apex');
  const home = path.join(root, 'managed');
  const codexHome = path.join(root, 'profile');
  const originalConfig = 'hide_agent_reasoning = true\n';
  await mkdir(home);
  await atomicWrite(path.join(codexHome, 'config.toml'), originalConfig);
  await writeJson(path.join(plugin, '.codex-plugin/plugin.json'), {
    name: 'apexrest-apex',
    version: '0.1.0-test',
    skills: './skills/',
    mcpServers: './.mcp.json',
  });
  await writeJson(path.join(plugin, '.mcp.json'), {
    mcpServers: { apexrest: { command: 'node', args: ['runtime/mcp.mjs'], cwd: '.' } },
  });
  if (dualHost)
    await writeJson(path.join(plugin, '.claude-plugin/plugin.json'), {
      name: 'apexrest',
      version: '0.1.0-test',
      description: 'Dual-host installer fixture',
      author: { name: 'APEXREST' },
      skills: './skills/',
      mcpServers: { apexrest: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/runtime/mcp.mjs'] } },
    });
  for (const file of [
    'runtime/mcp.mjs',
    'runtime/apexrest.mjs',
    'skills/apexrest-setup/SKILL.md',
    'resources/toolchains/fixture.json',
    'assets/logo.svg',
    'LICENSE',
    'NOTICE',
  ])
    await atomicWrite(path.join(plugin, file), `Local installer fixture: ${file}\n`);
  const unrelated = {
    '.git/config': 'private repository configuration\n',
    'node_modules/fixture/package.json': '{"name":"workspace-fixture"}\n',
    '.env': 'FIXTURE_SECRET=must-not-be-copied\n',
    'plugins/other-plugin/plugin.json': '{"name":"other-plugin"}\n',
    '.agents/plugins/marketplace.json': JSON.stringify({
      name: 'unrelated-marketplace',
      plugins: [{ name: 'other-plugin', source: { source: 'local', path: './plugins/other-plugin' } }],
    }),
  };
  for (const [file, contents] of Object.entries(unrelated))
    await atomicWrite(path.join(source, file), contents);
  const workspaceTarget = path.join(root, 'outside-workspace');
  await mkdir(workspaceTarget);
  const workspaceLink = path.join(source, 'node_modules/workspace');
  await symlink(workspaceTarget, workspaceLink, 'dir');

  // This executable is a local test fixture. Its responses are never native-host evidence.
  const stubRoot = path.join(root, 'codex-fixture');
  const stubState = path.join(stubRoot, 'marketplaces.json');
  const stubCalls = path.join(stubRoot, 'calls.jsonl');
  const stubProgram = path.join(stubRoot, 'fixture.mjs');
  await writeJson(stubState, { marketplaces: [] });
  await atomicWrite(
    stubProgram,
    `import { appendFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const stateFile = ${JSON.stringify(stubState)};
const state = JSON.parse(readFileSync(stateFile, 'utf8'));
appendFileSync(${JSON.stringify(stubCalls)}, JSON.stringify(args) + '\\n');
const save = () => writeFileSync(stateFile, JSON.stringify(state));
const emit = value => console.log(JSON.stringify(value));
const fail = message => { console.error(message); process.exit(1); };
const updateConfig = root => {
  if (!state.scoped) return;
  const file = path.join(process.env.CODEX_HOME, 'config.toml');
  const marker = '# fixture-owned-apexrest\\n';
  const prefix = readFileSync(file, 'utf8').split(marker)[0];
  writeFileSync(file, prefix + marker + (root ? '[marketplaces.apexrest]\\nsource_type = "local"\\nsource = ' + JSON.stringify(root) + '\\n[plugins."apexrest-apex@apexrest"]\\nenabled = true\\n' : ''));
};
const command = args.slice(0, 3).join(' ');
if (args[0] === '--version') {
  console.log('codex-cli 0.154.0');
} else if (command === 'plugin marketplace list') {
  if (state.cwdSensitive) {
    if (state.observedCwd && state.observedCwd !== process.cwd()) fail('Discovery working directory changed.');
    state.observedCwd = process.cwd(); save();
  }
  if (state.scoped) fail('Unrelated marketplace manifest is missing.');
  if (state.invalidList) { console.log('{"marketplaces": ['); process.exit(0); }
  emit({ marketplaces: state.marketplaces });
} else if (command === 'plugin marketplace remove') {
  state.marketplaces = state.marketplaces.filter(m => m.name !== args[3]);
  updateConfig(undefined);
  save(); emit({ marketplaceName: args[3], installedRoot: null });
} else if (command === 'plugin marketplace add') {
  const root = args[3];
  if (state.failAddSource === root) {
    delete state.failAddSource; save(); fail('Injected local registration failure.');
  }
  const existing = state.marketplaces.find(m => m.name === 'apexrest');
  if (existing && existing.root !== root) fail('Remove the existing marketplace before changing source.');
  state.marketplaces = state.marketplaces.filter(m => m.name !== 'apexrest');
  state.marketplaces.push({ name: 'apexrest', root, marketplaceSource: { sourceType: 'local', source: root } });
  updateConfig(root);
  save(); emit({ marketplaceName: 'apexrest', installedRoot: root });
} else if (args[0] === 'plugin' && args[1] === 'add') {
  const market = state.marketplaces.find(m => m.name === 'apexrest');
  if (!market) fail('Marketplace is missing.');
  const source = path.join(market.root, 'plugins/apexrest-apex');
  const manifest = JSON.parse(readFileSync(path.join(source, '.codex-plugin/plugin.json'), 'utf8'));
  const installedPath = path.join(process.env.CODEX_HOME, 'plugins/cache/apexrest/apexrest-apex', manifest.version);
  mkdirSync(path.dirname(installedPath), { recursive: true });
  rmSync(installedPath, { recursive: true, force: true });
  cpSync(source, installedPath, { recursive: true });
  state.installed = { pluginId: 'apexrest-apex@apexrest', name: 'apexrest-apex', marketplaceName: 'apexrest', installedPath, version: manifest.version, enabled: true };
  save(); emit(state.installed);
} else if (args[0] === 'plugin' && args[1] === 'list') {
  const market = state.marketplaces.find(m => m.name === 'apexrest');
  const entry = market ? { ...state.installed, pluginId: 'apexrest-apex@apexrest', name: 'apexrest-apex', marketplaceName: 'apexrest', source: { source: 'local', path: path.join(market.root, 'plugins/apexrest-apex') }, marketplaceSource: market.marketplaceSource } : undefined;
  emit(state.scoped ? { installed: entry && state.installed ? [entry] : [], available: entry && !state.installed ? [entry] : [] } : { installed: state.installed ? [state.installed] : [], available: [] });
} else if (args[0] === 'plugin' && args[1] === 'remove') {
  if (state.installed) rmSync(state.installed.installedPath, { recursive: true, force: true });
  delete state.installed; save(); emit({ pluginId: 'apexrest-apex@apexrest' });
} else fail('Unexpected fixture command: ' + args.join(' '));
`,
  );
  const codex = path.join(stubRoot, 'codex');
  await atomicWrite(codex, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(stubProgram)} "$@"\n`);
  await chmod(codex, 0o700);
  return {
    root,
    source,
    plugin,
    home,
    codexHome,
    codex,
    stubState,
    stubCalls,
    request: { source, home, codexHome, codex },
    calls: async () =>
      (await readFile(stubCalls, 'utf8'))
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]),
    existing: async (enabled?: boolean) => {
      const oldRoot = path.join(root, 'previous-local-marketplace');
      await cp(plugin, path.join(oldRoot, 'plugins/apexrest-apex'), { recursive: true });
      await atomicWrite(
        path.join(oldRoot, 'plugins/apexrest-apex/resources/old-build.txt'),
        'Previous local bundle.\n',
      );
      await writeJson(path.join(oldRoot, '.agents/plugins/marketplace.json'), nativeMarketplace);
      const registration = {
        name: 'apexrest',
        root: oldRoot,
        marketplaceSource: { sourceType: 'local', source: oldRoot },
      };
      const unrelatedMarket = {
        name: 'other',
        root: path.join(root, 'unrelated-marketplace'),
        marketplaceSource: { sourceType: 'local', source: path.join(root, 'unrelated-marketplace') },
      };
      let installed;
      if (enabled !== undefined) {
        const installedPath = path.join(codexHome, 'plugins/cache/apexrest/apexrest-apex/0.1.0-test');
        await cp(path.join(oldRoot, 'plugins/apexrest-apex'), installedPath, { recursive: true });
        installed = {
          pluginId: 'apexrest-apex@apexrest',
          name: 'apexrest-apex',
          marketplaceName: 'apexrest',
          installedPath,
          version: '0.1.0-test',
          enabled,
        };
      }
      await writeJson(stubState, { marketplaces: [unrelatedMarket, registration], installed });
      return { oldRoot, registration, unrelatedMarket };
    },
    assertSourceUnchanged: async (before: Record<string, string>) => {
      assert.deepEqual(await inventory(plugin), before);
      for (const [file, contents] of Object.entries(unrelated))
        assert.equal(await readFile(path.join(source, file), 'utf8'), contents);
      assert.equal(await readlink(workspaceLink), workspaceTarget);
      assert.equal(await readFile(path.join(codexHome, 'config.toml'), 'utf8'), originalConfig);
    },
  };
}

test(
  'dual-host installation binds the same managed Node/home and remains portable and reinstallable (local fixture)',
  { skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false },
  async (t) => {
    const f = await fixture(t, true);
    const before = await inventory(f.plugin);
    const installed = await installNative(f.request);
    assert.ok('root' in installed);
    const codex = (await readJson(path.join(installed.root, '.mcp.json'))) as {
      mcpServers: Record<string, { command: string; args: string[]; env: object }>;
    };
    const claude = (await readJson(path.join(installed.root, '.claude-plugin/plugin.json'))) as {
      mcpServers: typeof codex.mcpServers;
    };
    assert.equal(claude.mcpServers.apexrest!.command, codex.mcpServers.apexrest!.command);
    assert.deepEqual(claude.mcpServers.apexrest!.env, { APEXREST_HOME: f.home, APEXREST_HOST: 'claude' });
    assert.deepEqual(codex.mcpServers.apexrest!.env, { APEXREST_HOME: f.home, APEXREST_HOST: 'codex' });
    assert.deepEqual(claude.mcpServers.apexrest!.args, ['${CLAUDE_PLUGIN_ROOT}/runtime/mcp.mjs']);
    const market = (await readJson(path.join(installed.destination, '.claude-plugin/marketplace.json'))) as {
      plugins: { name: string; version: string; source: string }[];
    };
    assert.deepEqual(
      market.plugins.map(({ name, version, source }) => ({ name, version, source })),
      [{ name: 'apexrest', version: '0.1.0-test', source: './plugins/apexrest-apex' }],
    );
    assert.equal((await validateNative(installed.root)).status, 'valid');
    const repeat = await installNative({ ...f.request, source: installed.root, dryRun: true });
    assert.equal(repeat.sourceDigest, installed.sourceDigest);
    assert.equal(repeat.destination, installed.destination);
    await f.assertSourceUnchanged(before);
  },
);

test(
  'dual-host validation refuses different skills, versions or runtime entrypoints',
  { skip: process.platform === 'win32' ? 'Fixture uses POSIX links.' : false },
  async (t) => {
    const f = await fixture(t, true);
    const file = path.join(f.plugin, '.claude-plugin/plugin.json');
    const original = (await readJson(file)) as Record<string, unknown>;
    for (const patch of [
      { version: '0.2.0' },
      { skills: './other-skills/' },
      { mcpServers: { apexrest: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/runtime/other.mjs'] } } },
    ]) {
      await writeJson(file, { ...original, ...patch });
      await assert.rejects(validateNative(f.plugin), { code: 'MANIFEST_SCHEMA_INVALID' });
    }
  },
);

test(
  'native install copies only the selected plugin and own marketplace (local Codex fixture)',
  {
    skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false,
  },
  async (t) => {
    const f = await fixture(t);
    const before = await inventory(f.plugin);
    const request = { source: f.source, home: f.home, codexHome: f.codexHome, codex: f.codex };
    const preview = await installNative({ ...request, dryRun: true });
    const standalone = await installNative({ ...request, source: f.plugin, dryRun: true });
    assert.equal(preview.sourceDigest, standalone.sourceDigest);
    assert.deepEqual(await readdir(f.home), []);
    const installed = await installNative(request);
    assert.equal(installed.state, 'registered');
    assert.equal(installed.sourceDigest, preview.sourceDigest);
    assert.equal(installed.destination, preview.destination);
    assert.ok('root' in installed);
    assert.equal(installed.root, path.join(installed.destination, 'plugins/apexrest-apex'));

    const destinationFiles = Object.keys(await inventory(installed.destination)).sort();
    const expectedFiles = [
      '.agents/plugins/marketplace.json',
      ...Object.keys(before).map((file) => 'plugins/apexrest-apex/' + file),
    ].sort();
    assert.deepEqual(destinationFiles, expectedFiles);
    const marketplace = (await readJson(
      path.join(installed.destination, '.agents/plugins/marketplace.json'),
    )) as {
      name: string;
      plugins: { name: string; source: { source: string; path: string }; policy: { products: string[] } }[];
    };
    assert.equal(marketplace.name, 'apexrest');
    assert.equal(marketplace.plugins.length, 1);
    assert.equal(marketplace.plugins[0]!.name, 'apexrest-apex');
    assert.deepEqual(marketplace.plugins[0]!.source, { source: 'local', path: './plugins/apexrest-apex' });
    assert.deepEqual(marketplace.plugins[0]!.policy.products, ['codex']);
    const mcp = (await readJson(path.join(installed.root, '.mcp.json'))) as {
      mcpServers: { apexrest: { command: string; args: string[]; env: Record<string, string> } };
    };
    assert.equal(mcp.mcpServers.apexrest.command, process.execPath);
    assert.deepEqual(mcp.mcpServers.apexrest.args, [path.join(installed.root, 'runtime/mcp.mjs')]);
    assert.deepEqual(mcp.mcpServers.apexrest.env, { APEXREST_HOME: f.home, APEXREST_HOST: 'codex' });
    const launcher = await readFile(path.join(f.home, 'bin/apexrest'), 'utf8');
    assert.ok(launcher.includes(quote(path.join(installed.root, 'runtime/apexrest.mjs'))));
    assert.ok(launcher.includes(quote(process.execPath)));
    assert.ok(launcher.includes('export APEXREST_HOME=' + quote(f.home)));
    const mutations = (await f.calls()).filter(
      (args) => args[1] === 'add' || (args[1] === 'marketplace' && args[2] !== 'list'),
    );
    assert.deepEqual(mutations, [
      ['plugin', 'marketplace', 'add', installed.destination, '--json'],
      ['plugin', 'add', 'apexrest-apex@apexrest', '--json'],
    ]);
    await f.assertSourceUnchanged(before);
  },
);

test(
  'native ownership conflict preserves existing installation and profile (local Codex fixture)',
  {
    skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false,
  },
  async (t) => {
    const f = await fixture(t);
    const beforeSource = await inventory(f.plugin);
    const previous = path.join(f.home, 'native/previous');
    await atomicWrite(path.join(previous, 'preserved.txt'), 'Existing installed payload.\n');
    await writeJson(path.join(f.home, 'installation.json'), { destination: previous });
    await writeJson(f.stubState, {
      marketplaces: [{ name: 'apexrest', root: path.join(f.root, 'another-installation') }],
    });
    const beforeHome = await inventory(f.home);
    const beforeProfile = await inventory(f.codexHome);
    await assert.rejects(
      installNative({ source: f.source, home: f.home, codexHome: f.codexHome, codex: f.codex }),
      { code: 'MARKETPLACE_OWNERSHIP_CONFLICT' },
    );
    assert.deepEqual(await inventory(f.home), beforeHome);
    assert.deepEqual(await inventory(f.codexHome), beforeProfile);
    assert.ok((await f.calls()).every((args) => args.slice(0, 3).join(' ') === 'plugin marketplace list'));
    await f.assertSourceUnchanged(beforeSource);
  },
);

test(
  'native setup adopts its existing local marketplace without a managed receipt (local Codex fixture)',
  {
    skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false,
  },
  async (t) => {
    const f = await fixture(t);
    const beforeSource = await inventory(f.plugin);
    const { oldRoot, unrelatedMarket } = await f.existing();
    const beforeOld = await inventory(oldRoot);
    const preview = await installNative({ ...f.request, dryRun: true });
    assert.equal(preview.registration.action, 'adopt');
    assert.deepEqual(await readdir(f.home), []);
    const installed = await installNative(f.request);
    assert.equal(installed.state, 'registered');
    assert.equal(installed.sourceDigest, preview.sourceDigest);
    const state = (await readJson(f.stubState)) as {
      marketplaces: { name: string; root: string }[];
      installed: { installedPath: string };
    };
    assert.deepEqual(
      state.marketplaces.filter((market) => market.name !== 'apexrest'),
      [unrelatedMarket],
    );
    assert.equal(
      state.marketplaces.find((market) => market.name === 'apexrest')!.root,
      installed.destination,
    );
    assert.deepEqual(await inventory(oldRoot), beforeOld);
    assert.ok('root' in installed);
    assert.deepEqual(await inventory(state.installed.installedPath), await inventory(installed.root));
    assert.ok((await readdir(f.home)).some((name) => name.startsWith('config-before-install-')));
    const receipt = (await readJson(path.join(f.home, 'installation.json'))) as { destination: string };
    assert.equal(receipt.destination, installed.destination);
    assert.ok('transition' in installed.registration);
    const transition = (await readJson(installed.registration.transition)) as {
      status: string;
      registration: { action: string; previousRoot: string };
    };
    assert.equal(transition.status, 'completed');
    assert.equal(transition.registration.action, 'adopt');
    assert.equal(transition.registration.previousRoot, oldRoot);
    const mutations = (await f.calls()).filter(
      (args) => args[1] === 'add' || (args[1] === 'marketplace' && args[2] !== 'list'),
    );
    assert.deepEqual(mutations, [
      ['plugin', 'marketplace', 'remove', 'apexrest', '--json'],
      ['plugin', 'marketplace', 'add', installed.destination, '--json'],
      ['plugin', 'add', 'apexrest-apex@apexrest', '--json'],
    ]);
    await f.assertSourceUnchanged(beforeSource);
  },
);

test(
  'native setup refuses adoption when the same-named marketplace contains another plugin (local Codex fixture)',
  {
    skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false,
  },
  async (t) => {
    const f = await fixture(t);
    const { oldRoot } = await f.existing();
    await writeJson(path.join(oldRoot, '.agents/plugins/marketplace.json'), {
      ...nativeMarketplace,
      plugins: [
        ...nativeMarketplace.plugins,
        { name: 'unrelated-plugin', source: { source: 'local', path: './plugins/unrelated-plugin' } },
      ],
    });
    const before = await inventory(oldRoot);
    const profileBefore = await inventory(f.codexHome);
    await assert.rejects(installNative(f.request), { code: 'MARKETPLACE_OWNERSHIP_CONFLICT' });
    assert.deepEqual(await inventory(oldRoot), before);
    assert.deepEqual(await inventory(f.codexHome), profileBefore);
    assert.deepEqual(await readdir(f.home), []);
    assert.ok((await f.calls()).every((args) => args.slice(0, 3).join(' ') === 'plugin marketplace list'));
  },
);

test(
  'setup checks the candidate MCP server before replacing a working registration',
  { skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false },
  async (t) => {
    const f = await fixture(t);
    const manifest = path.join(f.plugin, '.codex-plugin/plugin.json');
    await writeJson(manifest, { ...((await readJson(manifest)) as object), version: VERSION });
    const runtime = path.join(f.plugin, 'runtime/mcp.mjs');
    const catalog = toolCatalog.map(({ name }) => ({ name, inputSchema: { type: 'object' } }));
    const server = (tools: typeof catalog) => `
import { createInterface } from 'node:readline';
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.id === undefined) continue;
  const result = request.method === 'initialize'
    ? { protocolVersion: request.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'apexrest-apex', version: ${JSON.stringify(VERSION)} } }
    : { tools: ${JSON.stringify(tools)} };
  console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
}
`;
    const input = { ...f.request, from: f.source, nativeOnly: true, yes: true };
    await atomicWrite(runtime, server(catalog));
    const installed = await setup(input);
    assert.ok('components' in installed);
    assert.equal(installed.components.mcp, 'verified');
    const previous = {
      profile: await inventory(f.codexHome),
      native: await inventory(path.join(f.home, 'native')),
      launchers: await inventory(path.join(f.home, 'bin')),
      registration: await readJson(f.stubState),
      receipt: await readJson(path.join(f.home, 'installation.json')),
    };
    for (const [contents, code] of [
      ['process.exit(1);\n', 'MCP_STARTUP_FAILED'],
      [server([]), 'MCP_CATALOG_MISMATCH'],
      [server(catalog.slice(0, -1)), 'MCP_CATALOG_MISMATCH'],
    ] as const) {
      await atomicWrite(runtime, contents);
      const calls = (await f.calls()).length;
      await assert.rejects(setup(input), { code });
      assert.deepEqual(await inventory(f.codexHome), previous.profile);
      assert.deepEqual(await inventory(path.join(f.home, 'native')), previous.native);
      assert.deepEqual(await inventory(path.join(f.home, 'bin')), previous.launchers);
      assert.deepEqual(await readJson(f.stubState), previous.registration);
      assert.deepEqual(await readJson(path.join(f.home, 'installation.json')), previous.receipt);
      assert.ok(
        (await f.calls())
          .slice(calls)
          .every((args) => args.slice(0, 3).join(' ') === 'plugin marketplace list'),
      );
    }
  },
);

test(
  'failed native adoption restores the prior registration and retains its payload (local Codex fixture)',
  {
    skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false,
  },
  async (t) => {
    const f = await fixture(t);
    const beforeSource = await inventory(f.plugin);
    const { oldRoot, registration, unrelatedMarket } = await f.existing(true);
    const beforeOld = await inventory(oldRoot);
    const preview = await installNative({ ...f.request, dryRun: true });
    await writeJson(f.stubState, {
      ...((await readJson(f.stubState)) as object),
      failAddSource: preview.destination,
    });
    await assert.rejects(installNative(f.request));
    const state = (await readJson(f.stubState)) as { marketplaces: { name: string; root: string }[] };
    assert.deepEqual(
      state.marketplaces.filter((market) => market.name !== 'apexrest'),
      [unrelatedMarket],
    );
    assert.deepEqual(
      state.marketplaces.find((market) => market.name === 'apexrest'),
      registration,
    );
    assert.deepEqual(await inventory(oldRoot), beforeOld);
    assert.ok(!(await readdir(f.home)).includes('installation.json'));
    const records = (await readdir(f.home)).filter((name) => name.startsWith('registration-before-install-'));
    assert.equal(records.length, 1);
    const transition = (await readJson(path.join(f.home, records[0]!))) as {
      status: string;
      recovery: string;
    };
    assert.equal(transition.status, 'failed');
    assert.equal(transition.recovery, 'previous-registration-restored');
    assert.ok(
      (await f.calls()).some((args) => args.slice(0, 4).join(' ') === 'plugin marketplace add ' + oldRoot),
    );
    await f.assertSourceUnchanged(beforeSource);
  },
);

test(
  'failed adoption does not enable an absent or disabled previous plugin (local Codex fixture)',
  {
    skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false,
  },
  async (t) => {
    for (const enabled of [undefined, false]) {
      const f = await fixture(t);
      const { oldRoot, registration, unrelatedMarket } = await f.existing(enabled);
      const beforeOld = await inventory(oldRoot);
      const beforeProfile = await inventory(f.codexHome);
      const beforeState = (await readJson(f.stubState)) as {
        marketplaces: unknown[];
        installed?: { enabled: boolean };
      };
      const preview = await installNative({ ...f.request, dryRun: true });
      await writeJson(f.stubState, { ...beforeState, failAddSource: preview.destination });
      await assert.rejects(installNative(f.request));
      const state = (await readJson(f.stubState)) as typeof beforeState;
      assert.deepEqual(state.marketplaces, [unrelatedMarket, registration]);
      assert.deepEqual(state.installed, beforeState.installed);
      assert.deepEqual(await inventory(f.codexHome), beforeProfile);
      assert.deepEqual(await inventory(oldRoot), beforeOld);
      assert.ok((await f.calls()).every((args) => args[0] !== 'plugin' || args[1] !== 'add'));
      const records = (await readdir(f.home)).filter((name) =>
        name.startsWith('registration-before-install-'),
      );
      assert.equal(records.length, 1);
      const transition = (await readJson(path.join(f.home, records[0]!))) as {
        status: string;
        recovery: string;
      };
      assert.equal(transition.status, 'failed');
      assert.equal(transition.recovery, 'previous-marketplace-restored; plugin-state-needs-review');
      assert.ok(!(await readdir(f.home)).includes('installation.json'));
    }
  },
);

test(
  'native preflight detects external registration drift before changing the profile (local Codex fixture)',
  {
    skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false,
  },
  async (t) => {
    const f = await fixture(t);
    const { oldRoot, registration, unrelatedMarket } = await f.existing();
    const preview = await installNative({ ...f.request, dryRun: true });
    const externalRoot = path.join(f.root, 'externally-selected-marketplace');
    await cp(oldRoot, externalRoot, { recursive: true });
    const externalRegistration = {
      ...registration,
      root: externalRoot,
      marketplaceSource: { sourceType: 'local', source: externalRoot },
    };
    await writeJson(f.stubState, { marketplaces: [unrelatedMarket, externalRegistration] });
    const beforeProfile = await inventory(f.codexHome);
    const beforeOld = await inventory(oldRoot);
    const beforeExternal = await inventory(externalRoot);
    await assert.rejects(
      installNative({ ...f.request, expectedRegistration: preview.registration.fingerprint }),
      { code: 'MARKETPLACE_CHANGED' },
    );
    assert.deepEqual(await inventory(f.codexHome), beforeProfile);
    assert.deepEqual(await inventory(oldRoot), beforeOld);
    assert.deepEqual(await inventory(externalRoot), beforeExternal);
    assert.deepEqual(await readdir(f.home), []);
    const state = (await readJson(f.stubState)) as { marketplaces: unknown[] };
    assert.deepEqual(state.marketplaces, [unrelatedMarket, externalRegistration]);
    assert.ok((await f.calls()).every((args) => args.slice(0, 3).join(' ') === 'plugin marketplace list'));
  },
);

test(
  'changing the managed Node binding preserves the previous installed payload (local Codex fixture)',
  {
    skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false,
  },
  async (t) => {
    const f = await fixture(t, true);
    const previousNode = path.join(f.root, 'node-before');
    const nextNode = path.join(f.root, 'node-after');
    const first = await installNative({ ...f.request, node: previousNode });
    assert.ok('root' in first);
    const before = await inventory(first.destination);
    const repeat = await installNative({ ...f.request, node: previousNode, dryRun: true });
    assert.equal(repeat.destination, first.destination);
    const preview = await installNative({ ...f.request, node: nextNode, dryRun: true });
    assert.equal(preview.sourceDigest, first.sourceDigest);
    assert.notEqual(preview.destination, first.destination);
    assert.equal(preview.registration.action, 'update');
    const second = await installNative({
      ...f.request,
      node: nextNode,
      expectedRegistration: preview.registration.fingerprint,
    });
    assert.ok('root' in second);
    assert.equal(second.registration.action, 'update');
    assert.equal(second.destination, preview.destination);
    assert.deepEqual(await inventory(first.destination), before);
    const oldMcp = (await readJson(path.join(first.root, '.mcp.json'))) as {
      mcpServers: { apexrest: { command: string } };
    };
    const nextMcp = (await readJson(path.join(second.root, '.mcp.json'))) as {
      mcpServers: { apexrest: { command: string } };
    };
    assert.equal(oldMcp.mcpServers.apexrest.command, previousNode);
    assert.equal(nextMcp.mcpServers.apexrest.command, nextNode);
    for (const [root, node] of [
      [first.root, previousNode],
      [second.root, nextNode],
    ]) {
      const claude = (await readJson(path.join(root!, '.claude-plugin/plugin.json'))) as {
        mcpServers: { apexrest: { command: string } };
      };
      assert.equal(claude.mcpServers.apexrest.command, node);
    }
    const state = (await readJson(f.stubState)) as { marketplaces: { name: string; root: string }[] };
    assert.equal(state.marketplaces.find((market) => market.name === 'apexrest')!.root, second.destination);
  },
);

test(
  'reused content-addressed payload is verified and rebuilt when modified (local Codex fixture)',
  {
    skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false,
  },
  async (t) => {
    const f = await fixture(t, true);
    const first = await installNative(f.request);
    assert.ok('root' in first);
    const expected = await inventory(first.destination);
    await atomicWrite(path.join(first.root, 'runtime/mcp.mjs'), 'tampered runtime\n');
    await atomicWrite(path.join(first.root, 'runtime/injected.mjs'), 'extra file\n');
    const second = await installNative(f.request);
    assert.ok('root' in second);
    assert.equal(second.destination, first.destination);
    assert.deepEqual(await inventory(second.destination), expected);
    assert.deepEqual(
      (await readdir(path.join(f.home, 'native'))).filter((name) => name.includes('.broken-')),
      [],
    );
    // An untouched payload is reused as is (only the installer-owned MCP binding differs from source).
    const third = await installNative(f.request);
    assert.ok('root' in third);
    assert.deepEqual(await inventory(third.destination), expected);
    const claudePath = path.join(third.root, '.claude-plugin/plugin.json');
    const claude = (await readJson(claudePath)) as { description: string };
    claude.description = 'Modified manifest metadata';
    await writeJson(claudePath, claude);
    const repairedClaude = await installNative(f.request);
    assert.ok('root' in repairedClaude);
    assert.deepEqual(
      await inventory(repairedClaude.destination),
      expected,
      'Claude metadata is integrity checked, not ignored with its launch binding',
    );
  },
);

test(
  'native uninstall uses the selected Codex, the install lock and a strict payload path (local Codex fixture)',
  {
    skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false,
  },
  async (t) => {
    const f = await fixture(t);
    const installed = await installNative(f.request);
    assert.ok('root' in installed);
    const receipt = path.join(f.home, 'installation.json');
    const record = (await readJson(receipt)) as Record<string, unknown>;

    // The receipt may not redirect removal to the home itself or outside <home>/native/<digest>.
    for (const destination of [f.home, path.join(f.home, 'native'), path.join(f.root, 'checkout')]) {
      await writeJson(receipt, { ...record, destination });
      await assert.rejects(uninstallNative(f.home, false, { codex: f.codex }), {
        code: 'MARKETPLACE_OWNERSHIP_CONFLICT',
      });
    }
    await writeJson(receipt, record);

    // Unparseable Codex output is an unknown outcome; nothing is removed.
    const state = (await readJson(f.stubState)) as Record<string, unknown>;
    await writeJson(f.stubState, { ...state, invalidList: true });
    await assert.rejects(uninstallNative(f.home, false, { codex: f.codex }), {
      code: 'CODEX_REGISTRATION_UNKNOWN',
      status: 'outcome_unknown',
    });
    await writeJson(f.stubState, state);
    assert.ok((await f.calls()).every((args) => args[1] !== 'remove' && args[2] !== 'remove'));

    // A concurrent installer holding the lock blocks uninstall.
    const lock = path.join(f.home, 'install.lock');
    await atomicWrite(
      lock,
      JSON.stringify({ pid: process.pid, hostname: (await import('node:os')).hostname() }),
    );
    await assert.rejects(uninstallNative(f.home, false, { codex: f.codex }), { code: 'LOCKED' });
    await rm(lock);

    const result = await uninstallNative(f.home, false, { codex: f.codex });
    assert.equal(result.status, 'uninstalled');
    assert.equal(
      await inventory(f.home).then((files) => Object.keys(files).some((file) => file.startsWith('native/'))),
      false,
    );
    const after = (await readJson(f.stubState)) as { marketplaces: { name: string }[]; installed?: unknown };
    assert.equal(after.installed, undefined);
    assert.ok(!after.marketplaces.some((market) => market.name === 'apexrest'));
  },
);

test(
  'scoped native update preserves foreign config/source/cache when an unrelated marketplace is broken (local fixture)',
  { skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false },
  async (t) => {
    for (const failAdd of [false, true]) {
      const f = await fixture(t);
      const previous = await f.existing(true);
      const marker = '# fixture-owned-apexrest\n';
      await atomicWrite(
        path.join(f.codexHome, 'config.toml'),
        `hide_agent_reasoning = true
[marketplaces.other]
source_type = "local"
source = ${JSON.stringify(previous.unrelatedMarket.root)}
[plugins."other@other"]
enabled = true
${marker}[marketplaces.apexrest]
source_type = "local"
source = ${JSON.stringify(previous.oldRoot)}
[plugins."apexrest-apex@apexrest"]
enabled = true
`,
      );
      const state = (await readJson(f.stubState)) as Record<string, unknown>;
      state.scoped = true;
      await writeJson(f.stubState, state);
      const { snapshotForeignConfig } = await import('../../packages/installer/src/registration-config.ts');
      const before = await snapshotForeignConfig(f.codexHome);
      const priorSource = await inventory(previous.oldRoot);
      const foreignCache = path.join(f.codexHome, 'plugins/cache/other/other/1.0.0');
      await atomicWrite(
        path.join(foreignCache, 'fixture.txt'),
        'Unrelated installed plugin remains byte-identical.',
      );
      const priorForeign = await inventory(foreignCache);
      const plan = await installNative({ ...f.request, dryRun: true });
      assert.equal(plan.registration.discovery.scope, 'apexrest');
      assert.equal('markets' in plan.registration, false);
      if (failAdd) {
        state.failAddSource = plan.destination;
        await writeJson(f.stubState, state);
        await assert.rejects(
          installNative({ ...f.request, expectedRegistration: plan.registration.fingerprint }),
          /Recovery: previous-registration-restored/u,
        );
        const restored = (await readJson(f.stubState)) as { marketplaces: { name: string; root: string }[] };
        assert.equal(restored.marketplaces.find((m) => m.name === 'apexrest')?.root, previous.oldRoot);
        const cache = path.join(f.codexHome, 'plugins/cache/apexrest/apexrest-apex/0.1.0-test');
        assert.deepEqual(
          await inventory(cache),
          await inventory(path.join(previous.oldRoot, 'plugins/apexrest-apex')),
        );
      } else {
        const result = await installNative({
          ...f.request,
          expectedRegistration: plan.registration.fingerprint,
        });
        assert.equal(result.registration.discovery.scope, 'apexrest');
        assert.ok('root' in result);
        const cached = result.installed as { installedPath: string };
        assert.deepEqual(await inventory(cached.installedPath), await inventory(result.root));
      }
      const after = await snapshotForeignConfig(f.codexHome);
      assert.equal(after.foreignContentSha256, before.foreignContentSha256);
      assert.equal(after.foreignRegistrySha256, before.foreignRegistrySha256);
      assert.deepEqual(await inventory(previous.oldRoot), priorSource);
      assert.deepEqual(await inventory(foreignCache), priorForeign);
      const calls = await f.calls();
      assert.ok(
        calls.some((args) => args.join(' ') === 'plugin list --marketplace apexrest --available --json'),
      );
      assert.ok(
        calls
          .filter((args) => args.slice(0, 3).join(' ') === 'plugin marketplace remove')
          .every((args) => args[3] === 'apexrest'),
      );
    }
  },
);

test(
  'fresh managed-home creation keeps user registration discovery independent of the invoking repository (local fixture)',
  { skip: process.platform === 'win32' ? 'Fixture launcher uses a POSIX shell.' : false },
  async (t) => {
    const f = await fixture(t);
    await rm(f.home, { recursive: true, force: true });
    await rm(f.codexHome, { recursive: true, force: true });
    await writeJson(f.stubState, {
      marketplaces: [{ name: 'implicit-other', root: path.join(f.root, 'implicit-other') }],
      cwdSensitive: true,
    });
    const plan = await installNative({ ...f.request, dryRun: true });
    assert.equal(await exists(f.home), false);
    assert.equal(await exists(f.codexHome), true);
    assert.equal(await exists(path.join(f.codexHome, 'config.toml')), false);
    const result = await installNative({ ...f.request, expectedRegistration: plan.registration.fingerprint });
    assert.ok('root' in result);
    const state = (await readJson(f.stubState)) as { observedCwd: string };
    const { homedir } = await import('node:os');
    assert.equal(state.observedCwd, await realpath(homedir()));
  },
);
