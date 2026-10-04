// Verify an installed package's CLI/stdio MCP. This is not a native model-session test.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// The 2026-10-04 redesign: eleven MCP tools and five skills; Composer and panel
// tools are gone from MCP (Composer keeps its CLI), see packages/core/src/operations.ts.
const expectedTools = [
  'apexrest_project',
  'apexrest_reference',
  'apexrest_metadata_read',
  'apexrest_apex_validate',
  'apexrest_ship',
  'apexrest_apex_sync',
  'apexrest_test_run',
  'apexrest_browser_open',
  'apexrest_job',
  'apexrest_artifact_read',
  'apexrest_status',
];
const expectedSkills = [
  'apexrest-apexlang',
  'apexrest-pattern-catalog',
  'apexrest-safety',
  'apexrest-setup',
  'apexrest-work',
];
const root = path.resolve(process.argv[2] ?? 'plugins/apexrest-apex');
const temporary = await mkdtemp(path.join(tmpdir(), 'apexrest-package-smoke-'));
const project = path.join(await realpath(temporary), 'project');
const env = { ...process.env, APEXREST_HOME: path.join(temporary, 'managed') };
delete env.APEXREST_RESOURCES;
const client = new Client({ name: 'package-smoke', version: '1' });
try {
  const manifest = JSON.parse(await readFile(path.join(root, '.codex-plugin/plugin.json'), 'utf8'));
  const claude = JSON.parse(await readFile(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
  assert.equal(claude.name, 'apexrest');
  assert.equal(claude.version, manifest.version);
  assert.equal(claude.skills, './skills/');
  assert.deepEqual(claude.mcpServers.apexrest.args, ['${CLAUDE_PLUGIN_ROOT}/runtime/mcp.mjs']);
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
  assert.deepEqual(
    catalog.tools.map((tool) => tool.name),
    expectedTools,
  );
  assert.ok(catalog.tools.every((tool) => !/^apexrest_(team|work|compose|panel)_/.test(tool.name)));
  const skills = (await readdir(path.join(root, 'skills'))).sort();
  assert.deepEqual(skills, expectedSkills);
  const query = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, false, JSON.stringify(result.content));
    const envelope = JSON.parse(result.content.find((item) => item.type === 'text').text);
    assert.equal(envelope.ok, true, envelope.summary);
    return envelope.data;
  };
  const hits = (data) => (Array.isArray(data) ? data : (data.results ?? data.hits ?? data.items));
  const summary = await query('apexrest_project', { action: 'inspect', project, detail: 'summary' });
  assert.equal(summary.projectId, 'package-smoke');
  assert.equal(summary.targetVerified, false);
  const refs = await query('apexrest_reference', { mode: 'search', query: 'validate' });
  assert.ok(Array.isArray(refs) && refs.length > 0, 'reference search returns hits');
  assert.match(JSON.stringify(refs), /validate/i);
  const blocks = hits(
    await query('apexrest_reference', { mode: 'search', query: 'підсумки', corpus: 'blocks' }),
  );
  assert.equal(blocks[0].id, 'block:analytics/status-summary@1.0.0');
  assert.equal(blocks[0].status, 'experimental');
  const block = await query('apexrest_reference', { mode: 'read', id: blocks[0].id, limit: 8192 });
  assert.match(block.content, /compiler/);
  const components = hits(
    await query('apexrest_reference', {
      mode: 'search',
      corpus: 'components',
      query: 'картка показника',
      kind: 'template',
      version: '26.1',
      limit: 3,
    }),
  );
  assert.ok(components.some((entry) => entry.id.includes('template-components/metric-card/recipes/')));
  const component = await query('apexrest_reference', {
    mode: 'read',
    id: components.find((entry) => entry.id.includes('template-components/metric-card/recipes/')).id,
    limit: 2048,
  });
  assert.equal(component.readiness, 'ready');
  assert.equal(component.compatibility.mmdVersion, '26.1.0+3102');
  const patternSearch = await query('apexrest_reference', {
    mode: 'search',
    corpus: 'patterns',
    query: 'Повносторінковий пошук',
    kind: 'template',
    family: 'browse',
    version: '26.1',
    limit: 3,
  });
  const patterns = hits(patternSearch);
  const patternId = 'pattern:browse/full-page-search/recipes/basic';
  assert.ok(patterns.some((entry) => entry.id === patternId));
  const pattern = await query('apexrest_reference', { mode: 'read', id: patternId, limit: 2048 });
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
  assert.deepEqual(patternCli.data, patternSearch);
  assert.equal(cli('docs', 'read', patternId, '--limit', '2048', '--json').data.content, pattern.content);
  const status = await query('apexrest_status', { project, detail: 'project' });
  assert.equal(status.configured, true);
  console.log(
    JSON.stringify({
      status: 'passed',
      version: manifest.version,
      tools: catalog.tools.length,
      skills: skills.length,
      checks: [
        'CLI version',
        'Codex and Claude Code manifests',
        'isolated project initialization',
        'stdio MCP catalog',
        'project summary',
        'pinned reference search',
        'Composer block discovery and compiler evidence read through the reference corpus',
        'offline Ukrainian component search and recipe read',
        'projectless Ukrainian pattern search and recipe read through CLI and MCP',
        'read-only project status snapshot',
      ],
      scope: 'Local installed files and stdio MCP; no model, Oracle or native-host execution.',
    }),
  );
} finally {
  await client.close();
  await rm(temporary, { recursive: true, force: true });
}
