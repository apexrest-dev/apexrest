import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, cp, readFile, writeFile, readdir, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('relocated offline Composer stays CLI-only with exact local materialization; MCP keeps reference parity', async (t) => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-compose-contract-'))),
    plugin = path.join(base, 'plugin'),
    project = path.join(base, 'project'),
    home = path.join(base, 'home');
  await cp('dist/codex-compat/plugins/apexrest-apex', plugin, { recursive: true });
  await cp('dist/resources/templates/blank-app/application', path.join(project, 'app'), { recursive: true });
  await cp('resources/blueprints/crm.yaml', path.join(project, 'app.blueprint.yaml'));
  const json = async (file, data) => {
    await import('node:fs/promises').then((m) => m.mkdir(path.dirname(file), { recursive: true }));
    await writeFile(file, JSON.stringify(data, null, 2) + '\n');
  };
  await json(path.join(project, 'apexrest.json'), {
    schemaVersion: 1,
    projectId: 'clean-composer',
    application: { sourceDir: 'app', alias: 'composer' },
    database: { migrationsDir: 'db/migrations', packagesDir: 'db/packages', testsDir: 'tests/sql' },
    toolchain: { lockFile: 'toolchain.json' },
    environments: {},
    composer: { allowSourceOnly: true },
    tests: {
      unitDir: 'tests/unit',
      apiDir: 'tests/api',
      e2eDir: 'tests/e2e',
      requiredSuites: [],
      defaultBrowser: 'chromium',
      mutationAllowedEnvironments: [],
    },
    artifacts: { directory: '.apexrest/artifacts', retentionDays: 7 },
  });
  await json(path.join(project, 'toolchain.json'), {
    scope: 'explicit source-only contract fixture, not compiler evidence',
  });
  await json(path.join(home, 'policy.json'), { schemaVersion: 1, trustedProjects: [project], grants: [] });
  const env = { ...process.env, APEXREST_HOME: home };
  delete env.APEXREST_RESOURCES;
  const cli = (args) => {
    const r = spawnSync(process.execPath, [path.join(plugin, 'runtime/apexrest.mjs'), ...args, '--json'], {
      cwd: project,
      env,
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    return JSON.parse(r.stdout);
  };
  const cliPlan = cli(['compose', 'plan', '--out', 'plans/cli.json', '--validation', 'source-only']);
  assert.equal(cliPlan.ok, true);
  const client = new Client({ name: 'composer-contract', version: '1' });
  t.after(async () => {
    await client.close();
    await rm(base, { recursive: true, force: true });
  });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.join(plugin, 'runtime/mcp.mjs')],
      cwd: project,
      env,
      stderr: 'pipe',
    }),
  );
  const call = async (name, args) =>
    JSON.parse((await client.callTool({ name, arguments: args })).content[0].text);
  const tools = await client.listTools();
  for (const name of ['apexrest_compose_plan', 'apexrest_compose_materialize'])
    assert.ok(!tools.tools.some((t) => t.name === name), `${name} is CLI-only`);
  const search = await call('apexrest_reference', { mode: 'search', query: 'форма', corpus: 'blocks' });
  assert.equal(search.data[0].id, 'block:crud/report-dialog@1.0.0');
  const direct = cli(['docs', 'search', 'форма', '--corpus', 'blocks']);
  assert.deepEqual(direct.data, search.data);
  const detail = await call('apexrest_reference', {
    mode: 'read',
    id: 'block:crud/report-dialog@1.0.0/source/renderer.json',
  });
  assert.match(detail.data.content, /savedPayload/);
  const applied = cli([
    'compose',
    'materialize',
    '--plan',
    'plans/cli.json',
    '--expected-digest',
    cliPlan.data.planDigest,
  ]);
  assert.equal(applied.ok, true, JSON.stringify(applied));
  assert.equal(applied.data.deployment, 'not-run');
  const repeated = cli(['compose', 'plan', '--out', 'plans/repeat.json', '--validation', 'source-only']);
  assert.equal(repeated.data.operations.length, 0);
  const noOp = cli([
    'compose',
    'materialize',
    '--plan',
    'plans/repeat.json',
    '--expected-digest',
    repeated.data.planDigest,
  ]);
  assert.equal(noOp.data.status, 'no-op');
  const invalid = spawnSync(
    process.execPath,
    [
      path.join(plugin, 'runtime/apexrest.mjs'),
      'compose',
      'plan',
      '--out',
      'plans/invalid.json',
      '--mode',
      'connected',
      '--json',
    ],
    { cwd: project, env, encoding: 'utf8' },
  );
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stdout, /ENVIRONMENT_REQUIRED/);
  const unsafe = spawnSync(
    process.execPath,
    [
      path.join(plugin, 'runtime/apexrest.mjs'),
      'compose',
      'materialize',
      '--plan',
      'plans/repeat.json',
      '--expected-digest',
      '0'.repeat(64),
      '--json',
    ],
    { cwd: project, env, encoding: 'utf8' },
  );
  assert.notEqual(unsafe.status, 0);
  assert.match(unsafe.stdout, /PLAN_TAMPERED/);
  assert.ok(
    !(await readdir(path.join(plugin, 'skills'))).includes('apexrest-compose'),
    'Composer skill folded; CLI compose remains',
  );
  assert.deepEqual(
    await readFile(path.join(project, 'app/.apex/apexlang.json')),
    await readFile('dist/resources/templates/blank-app/application/.apex/apexlang.json'),
  );
});
