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
  assert.equal(catalog.tools.length, 10);
  const jobSchema = catalog.tools.find((tool) => tool.name === 'apexrest_job').inputSchema;
  assert.equal(jobSchema.properties.waitSeconds.default, 0);
  assert.equal(jobSchema.properties.waitSeconds.maximum, 120);
  assert.ok(!jobSchema.required.includes('waitSeconds'));
  assert.ok(jobSchema.required.includes('jobId'));
  for (const tool of catalog.tools.filter((tool) => ['apexrest_apex_sync'].includes(tool.name))) {
    assert.equal(tool.inputSchema.properties.waitSeconds.default, 25);
    assert.ok(!tool.inputSchema.required.includes('waitSeconds'));
  }
  const ship = catalog.tools.find((tool) => tool.name === 'apexrest_ship');
  assert.equal(ship.inputSchema.properties.waitSeconds.default, 25);
  assert.equal(ship.inputSchema.properties.waitSeconds.maximum, 120);
  assert.ok(ship.inputSchema.required.includes('userRequest'));
  assert.equal(ship.inputSchema.properties.importMode.default, 'auto');
  assert.deepEqual(ship.inputSchema.properties.importMode.enum, ['auto', 'full', 'files']);
  assert.equal(ship.inputSchema.properties.files.type, 'array');
  assert.equal(ship.annotations.destructiveHint, true);
  const validate = catalog.tools.find((tool) => tool.name === 'apexrest_apex_validate');
  assert.equal(validate.inputSchema.properties.waitSeconds, undefined, 'validate runs in-process');
  assert.equal(validate.annotations.readOnlyHint, true);
  assert.equal(validate.annotations.destructiveHint, false);
  const searchSchema = catalog.tools.find((tool) => tool.name === 'apexrest_reference').inputSchema;
  assert.ok(!searchSchema.required.includes('limit'));
  assert.ok(!searchSchema.required.includes('offset'));
  assert.ok(!searchSchema.required.includes('corpus'));
  assert.ok(searchSchema.required.includes('mode'));
  assert.deepEqual(searchSchema.properties.corpus.enum, [
    'apexlang',
    'components',
    'patterns',
    'blocks',
    'blueprints',
  ]);
  assert.equal(searchSchema.properties.corpus.default, 'apexlang');
  for (const removed of [
    'apexrest_panel_open',
    'apexrest_panel_action',
    'apexrest_panel_status',
    'apexrest_doctor',
    'apexrest_deploy_plan',
    'apexrest_deploy_apply',
    'apexrest_apex_generate',
    'apexrest_apex_export',
    'apexrest_compose_plan',
    'apexrest_compose_materialize',
    'apexrest_job_status',
    'apexrest_job_cancel',
    'apexrest_reference_search',
    'apexrest_reference_read',
    'apexrest_project_inspect',
  ])
    assert.equal(
      catalog.tools.find((tool) => tool.name === removed),
      undefined,
      removed,
    );
  const status = catalog.tools.find((tool) => tool.name === 'apexrest_status');
  assert.equal(status.annotations.readOnlyHint, true);
  assert.equal(status._meta, undefined);
  assert.equal(client.getServerCapabilities().resources, undefined);
  assert.ok(performance.now() - start < 10000);
  const reference = await client.callTool({
    name: 'apexrest_reference',
    arguments: { mode: 'search', query: 'validate' },
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
    name: 'apexrest_reference',
    arguments: {
      mode: 'search',
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
    name: 'apexrest_reference',
    arguments: { mode: 'read', id: componentDomain.data[0].id },
  });
  const componentPageDomain = JSON.parse(componentPage.content[0].text);
  assert.equal(componentPageDomain.ok, true);
  assert.equal(componentPageDomain.data.classification, 'component-reference-data');
  assert.equal(componentPageDomain.data.compatibility.apexVersion, '26.1');
  assert.ok(Buffer.byteLength(componentPage.content[0].text, 'utf8') < 32768);
  const invalid = await client.callTool({
    name: 'apexrest_ship',
    arguments: { env: 'dev', userRequest: 'Deploy page ten to dev', approved: true },
  });
  assert.equal(JSON.parse(invalid.content[0].text).exitCode, 2);
  assert.equal(invalid.isError, true);
  for (const selection of [
    { importMode: 'files' },
    { importMode: 'full', files: ['pages/p00010.apx'] },
    { importMode: 'files', files: ['../outside.apx'] },
  ]) {
    const refusedSelection = await client.callTool({
      name: 'apexrest_ship',
      arguments: { project: '/private/tmp', env: 'dev', userRequest: 'Deploy page ten to dev', ...selection },
    });
    assert.equal(JSON.parse(refusedSelection.content[0].text).diagnostics[0].code, 'INVALID_INPUT');
  }
  const noProject = await client.callTool({
    name: 'apexrest_ship',
    arguments: { env: 'dev', userRequest: 'Deploy page ten to dev', mode: 'apply', project: '/private/tmp' },
  });
  const noProjectResult = JSON.parse(noProject.content[0].text);
  assert.equal(noProjectResult.ok, false);
  assert.equal(noProjectResult.operation, 'ship');
  assert.equal(noProjectResult.data, undefined, 'An unconfigured project never starts a job');
  await client.close();
});
test('CLI stdout remains a single JSON envelope for invalid options', () => {
  for (const args of [
    ['deploy', 'apply', '--env', 'prod', '--approved', '--json'],
    ['ship', '--env', 'prod', '--mode', 'apply', '--json'],
  ]) {
    const r = spawnSync(process.execPath, [path.join(runtime, 'apexrest.mjs'), ...args], {
      encoding: 'utf8',
    });
    assert.equal(r.status, 2, args.join(' '));
    assert.equal(JSON.parse(r.stdout).ok, false);
  }
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
    apexrest_browser_open: { env: 'dev' },
    apexrest_metadata_read: { env: 'dev', kind: 'objects', schema: 'FIXTURE' },
    apexrest_apex_sync: { env: 'dev', action: 'status' },
    apexrest_apex_validate: {},
    apexrest_ship: { env: 'dev', mode: 'apply', userRequest: 'Deploy page ten to dev' },
    apexrest_job: { action: 'status', jobId: '12345678-1234-4123-8123-123456789abc' },
    apexrest_artifact_read: { id: '12345678-1234-4123-8123-123456789abc' },
    // Optional-project tools still reject relative paths.
    apexrest_project: { action: 'inspect' },
    apexrest_reference: { mode: 'search', query: 'validate' },
    apexrest_status: { detail: 'project' },
  };
  const catalog = await client.listTools();
  for (const tool of catalog.tools) {
    assert.match(tool.inputSchema.properties.project.description, /Absolute project.*plugin cache/);
    if (['apexrest_reference', 'apexrest_status', 'apexrest_project'].includes(tool.name)) {
      assert.ok(!tool.inputSchema.required?.includes('project'), tool.name);
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
  test(`${profile} copied outside checkout resolves shared chunks and references via both entrypoints`, async (t) => {
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
          (await client.callTool({ name: 'apexrest_project', arguments: { project, action: 'inspect' } }))
            .content[0].text,
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
              name: 'apexrest_reference',
              arguments: { mode: 'read', id: 'oracle-form-example', limit: 80 },
            })
          ).content[0].text,
        );
        assert.equal(found.ok, true);
        assert.ok(found.data.source.startsWith('https://github.com/oracle/skills/'));
        assert.equal(found.data.content.length, 80);
      } finally {
        await client.close();
      }
    }
  });
