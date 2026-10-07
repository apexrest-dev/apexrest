import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Resolve the documented host adapters and execute their actual packaged server.
// This is a subprocess contract, not a native agent session or Oracle import.
test('both host manifests launch the same scoped ship contract, references and managed state outside the checkout', async (t) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-host-parity-')));
  const clients = [];
  t.after(async () => {
    // Windows cannot remove a directory while an MCP process uses it as its cwd.
    const closed = await Promise.allSettled(clients.map((client) => client.close()));
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    const failure = closed.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  });
  const plugin = path.join(root, 'plugin cache with spaces café');
  const project = path.join(root, 'application');
  const home = path.join(root, 'shared managed home');
  await cp('dist/codex-compat/plugins/apexrest-apex', plugin, { recursive: true });
  await mkdir(home);
  const env = { ...process.env, APEXREST_HOME: home };
  delete env.APEXREST_RESOURCES;
  delete env.NODE_TEST_CONTEXT;
  const init = spawnSync(
    process.execPath,
    [
      path.join(plugin, 'runtime/apexrest.mjs'),
      'project',
      'init',
      project,
      '--template',
      'existing-app',
      '--json',
    ],
    { env, cwd: root, encoding: 'utf8' },
  );
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const codex = JSON.parse(await readFile(path.join(plugin, '.codex-plugin/plugin.json')));
  const claude = JSON.parse(await readFile(path.join(plugin, '.claude-plugin/plugin.json')));
  assert.equal(codex.skills, claude.skills, 'Both hosts load one canonical skill tree');
  const shared = JSON.parse(await readFile(path.join(plugin, codex.mcpServers)));
  // Claude loads .mcp.json first; its inline map replaces the same named server.
  const launches = {
    codex: { ...shared.mcpServers.apexrest, cwd: plugin },
    claude: { ...shared.mcpServers, ...claude.mcpServers }.apexrest,
  };
  for (const [host, server] of Object.entries(launches)) {
    const args = server.args.map((arg) => arg.replaceAll('${CLAUDE_PLUGIN_ROOT}', plugin));
    assert.equal(
      path.resolve(host === 'codex' ? plugin : root, args[0]),
      path.join(plugin, 'runtime/mcp.mjs'),
    );
    const client = new Client({ name: `host-parity-${host}`, version: '1' });
    clients.push(client);
    await client.connect(
      new StdioClientTransport({
        ...server,
        args,
        cwd: host === 'codex' ? plugin : root,
        env,
        stderr: 'pipe',
      }),
    );
  }
  const catalogs = await Promise.all(clients.map((client) => client.listTools()));
  assert.deepEqual(catalogs[0], catalogs[1]);
  const ship = catalogs[0].tools.find((tool) => tool.name === 'apexrest_ship');
  assert.equal(ship.inputSchema.properties.importMode.default, 'auto');
  assert.deepEqual(ship.inputSchema.properties.importMode.enum, ['auto', 'full', 'files']);
  const call = async (client, name, args) =>
    JSON.parse((await client.callTool({ name, arguments: args })).content[0].text);
  const added = await call(clients[0], 'apexrest_project', {
    action: 'connection_add',
    name: 'shared-read',
    sqlclName: 'fixture-not-connected',
  });
  assert.equal(added.ok, true, JSON.stringify(added));
  const listings = await Promise.all(
    clients.map((client) => call(client, 'apexrest_project', { action: 'connection_list' })),
  );
  assert.deepEqual(listings[0].data, listings[1].data, 'Both hosts see the same APEXREST_HOME state');
  assert.match(JSON.stringify(listings[1].data), /shared-read/);
  const references = await Promise.all(
    clients.map((client) =>
      call(client, 'apexrest_reference', { mode: 'search', query: 'chart', version: '26.2', limit: 1 }),
    ),
  );
  assert.ok(references.every((result) => result.ok));
  assert.deepEqual(references[0].data, references[1].data);
  for (const client of clients) {
    const result = await call(client, 'apexrest_ship', {
      project,
      env: 'dev',
      mode: 'apply',
      importMode: 'files',
      files: ['pages/p00010-test.apx'],
      userRequest: 'Update only the identified development page',
    });
    assert.equal(result.ok, false);
    assert.equal(
      result.diagnostics[0].code,
      'PARTIAL_IMPORT_UNSUPPORTED',
      'Absent 26.2 source refuses explicit files before Oracle; never silently widens',
    );
    assert.equal(result.data, undefined, 'Refused selection starts no deployment job');
  }
});
