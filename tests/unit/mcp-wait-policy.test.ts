import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { listTools, mcpSchemasForClient } from '../../packages/mcp/src/server.ts';
import { codexShipWaitSeconds, mcpHost } from '../../packages/mcp/src/wait-policy.ts';
import { runJobTool } from '../../packages/mcp/src/job-tools.ts';
import { schemas } from '../../packages/core/src/operations.ts';

const id = '12345678-1234-4123-8123-123456789abc';
const request = (project: string, waitSeconds: number) => ({
  ship: { project, env: 'test', mode: 'plan', userRequest: 'Read-only timeout check.', waitSeconds },
  job: { project, action: 'status', jobId: id, waitSeconds },
});

test('protocol identity wins and registered hints identify unfamiliar Codex clients', () => {
  for (const name of ['codex', 'Codex CLI', 'codex-cli', 'OpenAI Codex', 'codex-mcp-client'])
    assert.equal(mcpHost(name, 'claude'), 'codex');
  assert.equal(mcpHost('Claude Code', 'codex'), 'claude');
  assert.equal(mcpHost('generic-client', 'codex'), 'codex');
  assert.equal(mcpHost(undefined, 'codex'), 'codex');
  assert.equal(mcpHost('generic-client', 'claude'), 'claude');
  assert.equal(mcpHost('generic-client'), undefined);
  assert.equal(mcpHost('generic-client', 'unregistered'), undefined);
});

test('Codex advertised and parsed waits agree while CLI and non-Codex semantics stay unchanged', () => {
  const project = path.resolve('missing-timeout-project');
  const codex = mcpSchemasForClient('codex');
  const genericCodex = mcpSchemasForClient('unfamiliar', 'codex');
  assert.equal(codex, genericCodex);
  for (const operation of ['ship', 'job'] as const) {
    for (const wait of [0, 25, 30])
      assert.equal(codex.get(operation)!.parse(request(project, wait)[operation]).waitSeconds, wait);
    for (const wait of [31, 60, 61, 120])
      assert.equal(codex.get(operation)!.safeParse(request(project, wait)[operation]).success, false);
    for (const [name, hint] of [
      ['Claude Code', 'codex'],
      ['generic', 'claude'],
      ['generic', undefined],
    ])
      assert.equal(
        mcpSchemasForClient(name, hint).get(operation)!.parse(request(project, 120)[operation]).waitSeconds,
        120,
      );
  }
  assert.equal(schemas['jobs.status'].parse({ project, id, waitSeconds: 120 }).waitSeconds, 120);
  assert.equal(schemas.job.parse(request(project, 120).job).waitSeconds, 120);
  const normal = listTools('claude');
  const limited = listTools('codex');
  assert.equal(limited.length, 12);
  for (const tools of [normal, limited]) {
    const bytes = Buffer.byteLength(JSON.stringify({ tools }), 'utf8');
    assert.ok(bytes < 15_500, `catalog is ${bytes} bytes`);
  }
  for (let index = 0; index < normal.length; index++) {
    const before = structuredClone(normal[index]!);
    const after = structuredClone(limited[index]!);
    if (['apexrest_ship', 'apexrest_job'].includes(after.name)) {
      const a = after.inputSchema as any,
        b = before.inputSchema as any;
      assert.equal(a.properties.waitSeconds.maximum, 30);
      assert.equal(b.properties.waitSeconds.maximum, 120);
      assert.equal(a.properties.waitSeconds.default, after.name === 'apexrest_ship' ? 25 : 0);
      assert.match(a.properties.waitSeconds.description, /Codex/);
      assert.doesNotMatch(after.description!, /120/);
      if (after.name === 'apexrest_job') assert.match(after.description!, /tool schema/);
      delete a.properties.waitSeconds;
      delete b.properties.waitSeconds;
    }
    assert.deepEqual(after, before, 'Only the client-specific wait field changes.');
  }
});

test('Codex refused waits start no worker; supported waits retain the same running job', async () => {
  let starts = 0;
  const reads: unknown[] = [];
  const jobs = {
    async start() {
      starts++;
      return {
        jobId: id,
        status: 'queued',
        runner: 'detached-worker',
        nextAction: 'Poll the same job.',
      } as const;
    },
    async status(...args: unknown[]) {
      reads.push(args);
      return { id, status: 'running', updatedAt: 'now' };
    },
  };
  for (const waitSeconds of [31, 61, 120])
    await assert.rejects(
      runJobTool(jobs, 'ship.apply', { waitSeconds }, '/runtime', undefined, {
        waitSchema: codexShipWaitSeconds,
      }),
      { code: 'INVALID_INPUT' },
    );
  assert.equal(starts, 0);
  assert.deepEqual(reads, []);
  const result = await runJobTool(jobs, 'ship.apply', {}, '/runtime', undefined, {
    waitSchema: codexShipWaitSeconds,
  });
  assert.equal(starts, 1);
  assert.equal(result.jobId, id);
  assert.equal(result.status, 'running');
  assert.deepEqual(reads, [[id, 25, undefined]]);
});

/**
 * Runs the MCP server from source. Node 26 removed --experimental-transform-types and only strips
 * types, which cannot run parameter properties, so there the source is bundled first.
 */
async function sourceServerArgs(): Promise<string[]> {
  const entry = path.resolve('packages/mcp/src/main.ts');
  if (process.allowedNodeEnvironmentFlags.has('--experimental-transform-types'))
    return ['--experimental-transform-types', entry];
  const { build } = await import('esbuild');
  // Inside the repository, so the bundle's external packages resolve from node_modules.
  const outfile = path.resolve('.apexrest/test-build/source-mcp/main.mjs');
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    target: 'node24',
  });
  return [outfile];
}

test('source stdio initialize selects Codex caps and refuses them before project or job work', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-mcp-timeout-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const args = await sourceServerArgs();
  for (const [name, hint, maximum] of [
    ['codex', undefined, 30],
    ['unfamiliar-registered-client', 'codex', 30],
    ['Claude Code', 'codex', 120],
    ['unfamiliar-registered-client', 'claude', 120],
  ] as const) {
    const client = new Client({ name, version: '1.0.0' });
    const env: Record<string, string> = {
      ...getDefaultEnvironment(),
      APEXREST_HOME: path.join(root, 'home'),
      APEXREST_USAGE: '0',
    };
    if (hint) env.APEXREST_HOST = hint;
    const transport = new StdioClientTransport({
      command: process.execPath,
      args,
      cwd: root,
      env,
      stderr: 'pipe',
    });
    try {
      await client.connect(transport);
      const catalog = await client.listTools();
      assert.deepEqual(await client.listTools(), catalog);
      for (const tool of ['apexrest_ship', 'apexrest_job']) {
        const schema = catalog.tools.find((entry) => entry.name === tool)!.inputSchema as any;
        assert.equal(schema.properties.waitSeconds.maximum, maximum);
      }
      const project = path.join(root, 'unconfigured-project');
      for (const waitSeconds of [61, 120]) {
        for (const [operation, args] of Object.entries(request(project, waitSeconds))) {
          const response = await client.callTool({
            name: operation === 'ship' ? 'apexrest_ship' : 'apexrest_job',
            arguments: args,
          });
          const result = JSON.parse((response.content as { text: string }[])[0]!.text);
          assert.equal(result.ok, false);
          if (maximum === 30) {
            assert.equal(result.diagnostics[0].code, 'INVALID_INPUT');
            assert.match(result.summary, /waitSeconds.*30/);
          } else {
            assert.doesNotMatch(
              result.summary,
              /waitSeconds/,
              'The legacy wait passes parsing before the unconfigured-project error.',
            );
          }
        }
      }
      await assert.rejects(stat(path.join(project, '.apexrest')), { code: 'ENOENT' });
    } finally {
      await client.close();
    }
  }
});
