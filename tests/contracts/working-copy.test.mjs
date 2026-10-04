import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const runtime = path.resolve('dist/runtime');

test('built CLI/MCP sync status is local, bounded and parity-compatible; adoption/diff options are exposed', async (t) => {
  const compiled = path.resolve('.apexrest/contracts-working-copy.mjs');
  await mkdir(path.dirname(compiled), { recursive: true });
  await build({
    entryPoints: ['tests/fixtures/working-copy.ts'],
    outfile: compiled,
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    target: 'node24',
  });
  const { workingCopyFixture } = await import(pathToFileURL(compiled).href);
  const f = await workingCopyFixture();
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  await f.service.sync(f.ctx, 'dev', 'init');
  const client = new Client({ name: 'working-copy-contract', version: '1.0.0' });
  t.after(() => client.close());
  // Any attempted SQLcl call fails; status must still succeed without creating a job.
  const env = { ...process.env, APEXREST_SQLCL: '/absent/sync-contract/sql' };
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.join(runtime, 'mcp.mjs')],
      env,
      stderr: 'pipe',
    }),
  );
  const tool = (await client.listTools()).tools.find((t) => t.name === 'apexrest_apex_sync');
  assert.deepEqual(tool.inputSchema.properties.action.enum, ['init', 'status', 'refresh', 'invalidate']);
  assert.ok(tool.inputSchema.required.includes('env'));
  const response = await client.callTool({
    name: tool.name,
    arguments: { project: f.ctx.root, env: 'dev', action: 'status' },
  });
  assert.notEqual(response.isError, true);
  const data = JSON.parse(response.content[0].text);
  assert.equal(data.data.status, 'ready');
  assert.equal(data.data.jobId, undefined);
  assert.equal(data.operation, 'apex.sync');
  assert.equal(data.data.serverFreshness, 'not-checked');
  assert.ok(Buffer.byteLength(JSON.stringify(response)) < 8192);
  const cli = spawnSync(
    process.execPath,
    [
      path.join(runtime, 'apexrest.mjs'),
      'apex',
      'sync',
      '--project',
      f.ctx.root,
      '--env',
      'dev',
      '--action',
      'status',
      '--json',
    ],
    { env, encoding: 'utf8' },
  );
  assert.equal(cli.status, 0, cli.stdout + cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout).data, data.data);
  const diff = spawnSync(
    process.execPath,
    [path.join(runtime, 'apexrest.mjs'), 'apex', 'diff', '--project', f.ctx.root, '--env', 'dev', '--json'],
    { env, encoding: 'utf8' },
  );
  assert.equal(diff.status, 0, diff.stdout + diff.stderr);
  assert.equal(JSON.parse(diff.stdout).data.provenance, 'initial-baseline');
  assert.deepEqual(JSON.parse(diff.stdout).data.changes, []);
  const panel = spawnSync(
    process.execPath,
    [path.join(runtime, 'apexrest.mjs'), 'panel', 'status', '--project', f.ctx.root, '--json'],
    { env, encoding: 'utf8' },
  );
  assert.equal(panel.status, 0, panel.stdout + panel.stderr);
  assert.equal(JSON.parse(panel.stdout).data.sync[0].exportedAt, data.data.exportedAt);
  const status = await client.callTool({
    name: 'apexrest_status',
    arguments: { project: f.ctx.root, detail: 'project' },
  });
  const statusData = JSON.parse(status.content[0].text);
  assert.equal(statusData.operation, 'status');
  assert.equal(statusData.data.sync[0].exportedAt, data.data.exportedAt);
  const adopt = spawnSync(
    process.execPath,
    [path.join(runtime, 'apexrest.mjs'), 'project', 'adopt', '--help'],
    { encoding: 'utf8' },
  );
  assert.match(adopt.stdout, /--working-copy/);
  const missingEnv = spawnSync(
    process.execPath,
    [
      path.join(runtime, 'apexrest.mjs'),
      'apex',
      'sync',
      '--project',
      f.ctx.root,
      '--action',
      'status',
      '--json',
    ],
    { env, encoding: 'utf8' },
  );
  assert.equal(missingEnv.status, 2);
});
