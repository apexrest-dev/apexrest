import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { cp, mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const runtime = path.resolve('dist/runtime');
test('real stdio MCP initialize/list/call, CLI parity and bounded catalog', async (t) => {
  const client = new Client({ name: 'contract-test', version: '1.0.0' });
  t.after(() => client.close());
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(runtime, 'mcp.mjs')],
    stderr: 'pipe',
  });
  const start = performance.now();
  await client.connect(transport);
  const catalog = await client.listTools();
  assert.equal(catalog.tools.length, 21);
  const jobSchema = catalog.tools.find((tool) => tool.name === 'apexrest_job_status').inputSchema;
  assert.equal(jobSchema.properties.waitSeconds.default, 0);
  assert.ok(!jobSchema.required.includes('waitSeconds'));
  for (const tool of catalog.tools.filter((tool) =>
    [
      'apexrest_apex_sync',
      'apexrest_apex_generate',
      'apexrest_apex_export',
      'apexrest_apex_validate',
      'apexrest_deploy_plan',
      'apexrest_deploy_apply',
      'apexrest_test_run',
    ].includes(tool.name),
  )) {
    assert.equal(tool.inputSchema.properties.waitSeconds.default, 25);
    assert.ok(!tool.inputSchema.required.includes('waitSeconds'));
  }
  const searchSchema = catalog.tools.find((tool) => tool.name === 'apexrest_reference_search').inputSchema;
  assert.ok(!searchSchema.required.includes('limit'));
  assert.ok(!searchSchema.required.includes('offset'));
  assert.ok(!searchSchema.required.includes('corpus'));
  assert.deepEqual(searchSchema.properties.corpus.enum, [
    'apexlang',
    'components',
    'patterns',
    'blocks',
    'blueprints',
  ]);
  assert.equal(searchSchema.properties.corpus.default, 'apexlang');
  const settings = catalog.tools
    .find((tool) => tool.name === 'apexrest_panel_action')
    .inputSchema.properties.action.oneOf.find((action) => action.properties.kind.const === 'preferences')
    .properties.settings;
  assert.deepEqual(Object.keys(settings.properties), ['browserMode']);
  const panelTool = catalog.tools.find((tool) => tool.name === 'apexrest_panel_open');
  assert.equal(panelTool._meta.ui.resourceUri, 'ui://apexrest/development-panel.html');
  const resources = await client.listResources();
  assert.equal(resources.resources[0].mimeType, 'text/html;profile=mcp-app');
  const ui = await client.readResource({ uri: panelTool._meta.ui.resourceUri });
  assert.ok(!ui.contents[0].text.includes('Agent team'));
  assert.ok(!ui.contents[0].text.includes('data-view="team"'));
  assert.ok(!ui.contents[0].text.includes('src="/panel.js"'));
  assert.ok(performance.now() - start < 10000);
  const reference = await client.callTool({
    name: 'apexrest_reference_search',
    arguments: { query: 'validate' },
  });
  const domain = JSON.parse(reference.content[0].text);
  assert.equal(domain.ok, true);
  const cli = spawnSync(
    process.execPath,
    [path.join(runtime, 'apexrest.mjs'), 'docs', 'search', 'validate', '--json'],
    { encoding: 'utf8' },
  );
  assert.equal(cli.status, 0);
  assert.deepEqual(JSON.parse(cli.stdout).data, domain.data);
  const component = await client.callTool({
    name: 'apexrest_reference_search',
    arguments: {
      query: 'картка показника',
      corpus: 'components',
      kind: 'template',
      version: '26.1',
      limit: 3,
    },
  });
  const componentDomain = JSON.parse(component.content[0].text);
  assert.equal(componentDomain.ok, true);
  assert.ok(Array.isArray(componentDomain.data) && componentDomain.data.length > 0);
  assert.ok(componentDomain.data.some((entry) => entry.id.includes('metric-card')));
  assert.ok(Buffer.byteLength(component.content[0].text, 'utf8') < 8192);
  assert.ok(componentDomain.data.every((entry) => entry.classification === 'component-reference-data'));
  const componentCli = spawnSync(
    process.execPath,
    [
      path.join(runtime, 'apexrest.mjs'),
      'docs',
      'search',
      'картка показника',
      '--corpus',
      'components',
      '--kind',
      'template',
      '--version',
      '26.1',
      '--limit',
      '3',
      '--json',
    ],
    { encoding: 'utf8', cwd: tmpdir() },
  );
  assert.equal(componentCli.status, 0, componentCli.stdout + componentCli.stderr);
  assert.deepEqual(JSON.parse(componentCli.stdout).data, componentDomain.data);
  const componentPage = await client.callTool({
    name: 'apexrest_reference_read',
    arguments: { id: componentDomain.data[0].id },
  });
  const componentPageDomain = JSON.parse(componentPage.content[0].text);
  assert.equal(componentPageDomain.ok, true);
  assert.equal(componentPageDomain.data.classification, 'component-reference-data');
  assert.equal(componentPageDomain.data.compatibility.apexVersion, '26.1');
  assert.ok(Buffer.byteLength(componentPage.content[0].text, 'utf8') < 32768);
  const invalid = await client.callTool({
    name: 'apexrest_deploy_apply',
    arguments: { plan: 'x', approved: true },
  });
  assert.equal(JSON.parse(invalid.content[0].text).exitCode, 2);
  assert.equal(invalid.isError, true);
  const noProject = await client.callTool({
    name: 'apexrest_deploy_apply',
    arguments: { plan: 'x', project: '/private/tmp' },
  });
  assert.equal(JSON.parse(noProject.content[0].text).ok, false);
  await client.close();
});
test('CLI stdout remains a single JSON envelope for invalid options', () => {
  const r = spawnSync(
    process.execPath,
    [path.join(runtime, 'apexrest.mjs'), 'deploy', 'apply', '--env', 'prod', '--approved', '--json'],
    { encoding: 'utf8' },
  );
  assert.equal(r.status, 2);
  assert.equal(JSON.parse(r.stdout).ok, false);
});
test('MCP project tools require an explicit absolute path before dispatch or job creation', async (t) => {
  const client = new Client({ name: 'explicit-project-contract', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.join(runtime, 'mcp.mjs')],
      cwd: runtime,
      stderr: 'pipe',
    }),
  );
  const inputs = {
    apexrest_compose_plan: { out: 'plans/compose.json' },
    apexrest_compose_materialize: { plan: 'plans/compose.json', expectedDigest: '0'.repeat(64) },
    apexrest_browser_open: { env: 'dev' },
    apexrest_panel_open: {},
    apexrest_panel_status: {},
    apexrest_panel_action: { action: { kind: 'validate' } },
    apexrest_project_inspect: {},
    apexrest_metadata_read: { env: 'dev', kind: 'objects', schema: 'FIXTURE' },
    apexrest_apex_generate: { name: 'Fixture', output: 'new-app' },
    apexrest_apex_sync: { env: 'dev', action: 'status' },
    apexrest_apex_export: { env: 'dev', output: 'exports/app' },
    apexrest_apex_validate: {},
    apexrest_deploy_plan: { env: 'dev', out: 'plans/dev.json' },
    apexrest_deploy_apply: { plan: 'plans/dev.json' },
    apexrest_test_run: { suite: 'unit' },
    apexrest_job_status: { id: '12345678-1234-4123-8123-123456789abc' },
    apexrest_job_cancel: { id: '12345678-1234-4123-8123-123456789abc' },
    apexrest_artifact_read: { id: '12345678-1234-4123-8123-123456789abc' },
  };
  const catalog = await client.listTools();
  for (const tool of catalog.tools) {
    if (tool.name.startsWith('apexrest_reference_')) {
      assert.match(tool.inputSchema.properties.project.description, /Absolute project/);
      assert.ok(!tool.inputSchema.required?.includes('project'));
      continue;
    }
    assert.match(tool.inputSchema.properties.project.description, /Absolute project.*plugin cache/);
    if (tool.name === 'apexrest_doctor') {
      assert.ok(!tool.inputSchema.required?.includes('project'));
    } else {
      assert.ok(tool.inputSchema.required.includes('project'), tool.name);
      assert.ok(Object.hasOwn(inputs, tool.name), `${tool.name} needs an input fixture`);
      const missing = JSON.parse(
        (await client.callTool({ name: tool.name, arguments: inputs[tool.name] })).content[0].text,
      );
      assert.equal(missing.diagnostics[0].code, 'INVALID_INPUT', tool.name);
      assert.match(missing.summary, /^project:/);
    }
    for (const project of ['.', '../project', 'project']) {
      const response = await client.callTool({
        name: tool.name,
        arguments: { ...(inputs[tool.name] ?? {}), project },
      });
      const result = JSON.parse(response.content[0].text);
      assert.equal(response.isError, true, tool.name);
      assert.equal(result.diagnostics[0].code, 'INVALID_INPUT', tool.name);
      assert.match(result.summary, /absolute project directory/);
      assert.equal(result.data, undefined, 'Invalid paths must not create a background job');
    }
  }
});
test('MCP malformed JSON yields protocol response without process banners', async () => {
  const child = spawn(process.execPath, [path.join(runtime, 'mcp.mjs')], { stdio: 'pipe' });
  let stdout = '';
  child.stdout.on('data', (b) => (stdout += b));
  child.stdin.end('{invalid json}\n');
  await new Promise((resolve) => child.on('exit', resolve));
  for (const line of stdout.trim().split('\n').filter(Boolean)) assert.doesNotThrow(() => JSON.parse(line));
});
for (const profile of ['codex-compat'])
  test(`${profile} copied outside checkout resolves shared chunks, references and job worker via both entrypoints`, async (t) => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-relocated-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    const plugin = path.join(root, 'plugin');
    await cp(`dist/${profile}/plugins/apexrest-apex`, plugin, { recursive: true });
    const cli = path.join(plugin, 'runtime/apexrest.mjs');
    const project = path.join(root, 'project');
    const env = { ...process.env, APEXREST_HOME: path.join(root, 'home') };
    delete env.APEXREST_RESOURCES;
    // The relocated CLI is a standalone process, not a nested node:test child.
    delete env.NODE_TEST_CONTEXT;
    const initialized = spawnSync(
      process.execPath,
      [cli, 'project', 'init', project, '--template', 'existing-app', '--json'],
      { cwd: root, env, encoding: 'utf8' },
    );
    assert.equal(initialized.status, 0, initialized.stdout + initialized.stderr);
    const inspectedFromCli = spawnSync(process.execPath, [cli, 'project', 'inspect', '--json'], {
      cwd: project,
      env,
      encoding: 'utf8',
    });
    assert.equal(inspectedFromCli.status, 0, inspectedFromCli.stdout + inspectedFromCli.stderr);
    assert.equal(JSON.parse(inspectedFromCli.stdout).data.root, project);
    await mkdir(env.APEXREST_HOME);
    await writeFile(
      path.join(env.APEXREST_HOME, 'policy.json'),
      JSON.stringify({ schemaVersion: 1, trustedProjects: [project], grants: [] }),
    );
    // A synthetic local unit suite exercises worker paths without Oracle or an application target.
    await writeFile(
      path.join(project, 'tests/unit/local.test.mjs'),
      "import test from 'node:test'; import assert from 'node:assert/strict'; test('fixture', () => assert.equal(2 + 2, 4));\n",
    );
    for (const args of [[path.join(plugin, 'runtime/mcp.mjs')], [cli, 'mcp']]) {
      const client = new Client({ name: 'relocated-contract', version: '1.0.0' });
      const transport = new StdioClientTransport({
        command: process.execPath,
        args,
        cwd: plugin,
        env,
        stderr: 'pipe',
      });
      try {
        await client.connect(transport);
        const catalog = await client.listTools();
        assert.deepEqual(await client.listTools(), catalog);
        const inspected = JSON.parse(
          (await client.callTool({ name: 'apexrest_project_inspect', arguments: { project } })).content[0]
            .text,
        );
        assert.equal(inspected.ok, true, JSON.stringify(inspected));
        assert.equal(
          inspected.data.root,
          project,
          'MCP must inspect the selected project outside its runtime directory',
        );
        const found = JSON.parse(
          (
            await client.callTool({
              name: 'apexrest_reference_read',
              arguments: { id: 'oracle-form-example', limit: 80 },
            })
          ).content[0].text,
        );
        assert.equal(found.ok, true);
        assert.ok(found.data.source.startsWith('https://github.com/oracle/skills/'));
        assert.equal(found.data.content.length, 80);
        let result = JSON.parse(
          (await client.callTool({ name: 'apexrest_test_run', arguments: { project, suite: 'unit' } }))
            .content[0].text,
        );
        assert.equal(result.ok, true);
        const jobId = result.data.jobId;
        assert.ok(jobId);
        // A loaded Windows runner can outlast the original tool call's bounded wait.
        // Follow the same job instead of starting the suite again.
        for (let attempt = 0; attempt < 3 && result.data.status !== 'completed'; attempt++) {
          assert.ok(['queued', 'running'].includes(result.data.status), JSON.stringify(result));
          result = JSON.parse(
            (
              await client.callTool({
                name: 'apexrest_job_status',
                arguments: { id: jobId, waitSeconds: 30 },
              })
            ).content[0].text,
          );
          assert.equal(result.ok, true, JSON.stringify(result));
        }
        assert.equal(result.data.status, 'completed', JSON.stringify(result));
        assert.equal(result.data.result.ok, true, JSON.stringify(result.data.result));
        assert.equal(result.data.result.data.tests, 1);
      } finally {
        await client.close();
      }
    }
  });
