// Verify an installed package's CLI/stdio MCP. This is not a native model-session test.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(process.argv[2] ?? 'plugins/apexrest-apex');
const temporary = await mkdtemp(path.join(tmpdir(), 'apexrest-package-smoke-'));
const project = path.join(await realpath(temporary), 'project');
const env = { ...process.env, APEXREST_HOME: path.join(temporary, 'managed') };
delete env.APEXREST_RESOURCES;
const client = new Client({ name: 'package-smoke', version: '1' });
try {
  const manifest = JSON.parse(await readFile(path.join(root, '.codex-plugin/plugin.json'), 'utf8'));
  const cli = (...args) => {
    const result = spawnSync(process.execPath, [path.join(root, 'runtime/apexrest.mjs'), ...args], {
      env,
      cwd: temporary,
      encoding: 'utf8',
      timeout: 15000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  assert.equal(cli('version', '--json').data.version, manifest.version.split('+codex.')[0]);
  cli('project', 'init', project, '--template', 'existing-app', '--alias', 'package-smoke', '--json');
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.join(root, 'runtime/mcp.mjs')],
      cwd: temporary,
      env,
      stderr: 'pipe',
    }),
  );
  const catalog = await client.listTools();
  assert.equal(catalog.tools.length, 21);
  for (const name of ['apexrest_compose_plan', 'apexrest_compose_materialize'])
    assert.ok(catalog.tools.some((tool) => tool.name === name));
  assert.ok(catalog.tools.every((tool) => !/^apexrest_(team|work)_/.test(tool.name)));
  const skills = await readdir(path.join(root, 'skills'));
  assert.equal(skills.length, 14);
  assert.ok(skills.includes('apexrest-compose'));
  assert.ok(skills.includes('apexrest-pattern-catalog'));
  assert.ok(!skills.includes('apexrest-team'));
  const query = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, false);
    const envelope = JSON.parse(result.content.find((item) => item.type === 'text').text);
    assert.equal(envelope.ok, true);
    return envelope.data;
  };
  const summary = await query('apexrest_project_inspect', { project, detail: 'summary' });
  assert.equal(summary.projectId, 'package-smoke');
  assert.equal(summary.targetVerified, false);
  const refs = await query('apexrest_reference_search', { query: 'validate' });
  assert.ok(JSON.stringify(refs).includes('validate'));
  const blocks = await query('apexrest_reference_search', { query: 'підсумки', corpus: 'blocks' });
  assert.equal(blocks[0].id, 'block:analytics/status-summary@1.0.0');
  assert.equal(blocks[0].status, 'experimental');
  const block = await query('apexrest_reference_read', { id: blocks[0].id, limit: 8192 });
  assert.match(block.content, /compiler/);
  const components = await query('apexrest_reference_search', {
    corpus: 'components',
    query: 'картка показника',
    kind: 'template',
    version: '26.1',
    limit: 3,
  });
  assert.ok(components.some((entry) => entry.id.includes('template-components/metric-card/recipes/')));
  const component = await query('apexrest_reference_read', {
    id: components.find((entry) => entry.id.includes('template-components/metric-card/recipes/')).id,
    limit: 2048,
  });
  assert.equal(component.readiness, 'ready');
  assert.equal(component.compatibility.mmdVersion, '26.1.0+3102');
  const patterns = await query('apexrest_reference_search', {
    corpus: 'patterns',
    query: 'Повносторінковий пошук',
    kind: 'template',
    family: 'browse',
    version: '26.1',
    limit: 3,
  });
  const patternId = 'pattern:browse/full-page-search/recipes/basic';
  assert.ok(patterns.some((entry) => entry.id === patternId));
  const pattern = await query('apexrest_reference_read', { id: patternId, limit: 2048 });
  assert.equal(pattern.readiness, 'ready');
  assert.equal(pattern.classification, 'pattern-reference-data');
  assert.equal(pattern.compatibility.mmdVersion, '26.1.0+3102');
  assert.ok(pattern.content.length > 0 && pattern.nextOffset > 0);
  const patternCli = cli(
    'docs',
    'search',
    'Повносторінковий пошук',
    '--corpus',
    'patterns',
    '--kind',
    'template',
    '--family',
    'browse',
    '--version',
    '26.1',
    '--limit',
    '3',
    '--json',
  );
  assert.deepEqual(patternCli.data, patterns);
  assert.equal(cli('docs', 'read', patternId, '--limit', '2048', '--json').data.content, pattern.content);
  const resource = await client.readResource({ uri: 'ui://apexrest/development-panel.html' });
  assert.equal(resource.contents[0].mimeType, 'text/html;profile=mcp-app');
  assert.doesNotMatch(resource.contents[0].text, /multiAgentEnabled|Agent team/);
  console.log(
    JSON.stringify({
      status: 'passed',
      version: manifest.version,
      tools: catalog.tools.length,
      skills: skills.length,
      checks: [
        'CLI version',
        'isolated project initialization',
        'stdio MCP catalog',
        'project summary',
        'pinned reference search',
        'Composer tools, skill, Ukrainian discovery and compiler evidence read',
        'offline Ukrainian component search and recipe read',
        'projectless Ukrainian pattern search and recipe read through CLI and MCP',
        'panel resource',
      ],
      scope: 'Local installed files and stdio MCP; no model, Oracle or native-host execution.',
    }),
  );
} finally {
  await client.close();
  await rm(temporary, { recursive: true, force: true });
}
