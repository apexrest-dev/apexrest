import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { catalogFootprint } from '../../scripts/lib/mcp-footprint.mjs';

test('packaged select has twelve-tool MCP/CLI parity, bounded output and explicit fallback', async (t) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-selection-contract-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = {
    schemaVersion: 1,
    projectId: 'selection',
    application: { sourceDir: 'app', alias: 'selection' },
    database: { migrationsDir: 'db/migrations', packagesDir: 'db/packages' },
    toolchain: { lockFile: 'toolchain.json', profile: '26.1' },
    environments: {},
    artifacts: { directory: '.apexrest/artifacts', retentionDays: 7 },
    decisionApi: {
      enabled: true,
      apiKeyEnv: 'APEXREST_MISSING_DECISION_CONTRACT_KEY',
      envFile: 'missing.env',
    },
  };
  await writeFile(path.join(root, 'apexrest.json'), JSON.stringify(project));
  const client = new Client({ name: 'selection-contract', version: '1' });
  t.after(() => client.close());
  const env = { ...process.env, APEXREST_HOME: root };
  delete env.APEXREST_MISSING_DECISION_CONTRACT_KEY;
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve('dist/runtime/mcp.mjs')],
      env,
      stderr: 'pipe',
    }),
  );
  const catalog = await client.listTools();
  assert.equal(catalog.tools.length, 12);
  catalogFootprint(catalog);
  const reference = catalog.tools.find((tool) => tool.name === 'apexrest_reference');
  assert.equal(reference.annotations.readOnlyHint, true);
  assert.equal(reference.annotations.openWorldHint, true);
  assert.deepEqual(reference.inputSchema.properties.mode.enum, ['search', 'read', 'select']);
  const response = await client.callTool({
    name: 'apexrest_reference',
    arguments: {
      mode: 'select',
      project: root,
      request: 'картка показника та interactive grid',
      limit: 8,
    },
  });
  assert.notEqual(response.isError, true);
  assert.ok(Buffer.byteLength(JSON.stringify(response)) <= 8192);
  const mcp = JSON.parse(response.content[0].text);
  assert.equal(mcp.ok, true);
  assert.equal(mcp.data.selection.fallbackReason, 'credential_unavailable');
  const cli = (...args) =>
    spawnSync(process.execPath, [path.resolve('dist/runtime/apexrest.mjs'), ...args], {
      cwd: root,
      env,
      encoding: 'utf8',
      timeout: 10000,
    });
  const cliResult = cli('docs', 'select', 'картка показника та interactive grid', '--limit', '8', '--json');
  assert.equal(cliResult.status, 0, cliResult.stdout);
  const cliData = JSON.parse(cliResult.stdout).data;
  assert.deepEqual(cliData.results, mcp.data.results);
  const { durationMs: _cliDuration, ...cliSelection } = cliData.selection;
  const { durationMs: _mcpDuration, ...mcpSelection } = mcp.data.selection;
  assert.deepEqual(cliSelection, mcpSelection);
  const alias = cli('reference', 'select', '--request', 'cards', '--json');
  assert.equal(alias.status, 0, alias.stdout);
  const missing = await client.callTool({
    name: 'apexrest_reference',
    arguments: { mode: 'select', request: 'cards' },
  });
  assert.equal(missing.isError, true);
  const relative = await client.callTool({
    name: 'apexrest_reference',
    arguments: { mode: 'select', project: '.', request: 'cards' },
  });
  assert.equal(relative.isError, true);
  const tooMany = await client.callTool({
    name: 'apexrest_reference',
    arguments: { mode: 'select', project: root, request: 'cards', limit: 9 },
  });
  assert.equal(tooMany.isError, true);
  const localSearch = await client.callTool({
    name: 'apexrest_reference',
    arguments: { mode: 'search', project: root, corpus: 'components', query: 'metric card' },
  });
  assert.equal(JSON.parse(localSearch.content[0].text).ok, true);
  const help = cli('docs', 'select', '--help');
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--request/);
});
