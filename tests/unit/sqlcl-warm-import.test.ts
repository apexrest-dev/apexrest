import test from 'node:test';
import assert from 'node:assert/strict';
import { WarmImportServer } from '../../packages/core/src/sqlcl-warm.ts';
import type { SqlclMcpClient } from '../../packages/core/src/sqlcl-mcp.ts';

/** A scripted stand-in for the restricted SQLcl server: records what was sent to it. */
function fake(
  options: { refusesHost?: boolean; connectFails?: boolean; executeFails?: boolean; hang?: boolean } = {},
) {
  const sent: string[] = [];
  const client = {
    alive: true,
    async open() {},
    async connect(name: string) {
      sent.push(`connect ${name}`);
      if (options.connectFails) throw new Error('connection refused');
      return { isError: false };
    },
    async execute(command: string, _options: unknown, _write: () => boolean) {
      sent.push(command);
      if (command.startsWith('host '))
        return {
          text: options.refusesHost === false ? 'APEXREST_RESTRICT_PROBE' : 'SP2-0738: Restricted command',
        };
      if (command.startsWith('apex validate')) return { text: 'ok' };
      if (options.hang) await new Promise((resolve) => setTimeout(resolve, 200));
      if (options.executeFails) throw new Error('transport lost');
      return { text: 'Import done\nAPEXREST_DONE' };
    },
    text(result: { text: string }) {
      return result.text;
    },
    async close() {
      client.alive = false;
    },
  };
  return { client: client as unknown as SqlclMcpClient, sent };
}

const request = { executable: 'sql', restrictLevel: '2', warmup: 'apex validate -input x', cwd: '/tmp' };
const run = (server: WarmImportServer, signal?: AbortSignal) =>
  server.run({
    connectionName: 'dev',
    completionMarker: 'APEXREST_DONE',
    input: 'apex import ...',
    ...(signal ? { signal } : {}),
  });

test('a server that does not refuse HOST is never used: the ordinary import process runs', async () => {
  const { client, sent } = fake({ refusesHost: false });
  assert.equal(await run(new WarmImportServer(request, client)), undefined);
  assert.equal(sent.includes('apex import ...'), false);
  assert.equal(
    sent.some((line) => line.startsWith('connect')),
    false,
  );
});

test('a failed connection submits nothing and falls back', async () => {
  const { client, sent } = fake({ connectFails: true });
  assert.equal(await run(new WarmImportServer(request, client)), undefined);
  assert.equal(sent.includes('apex import ...'), false);
});

test('after the batch is submitted a failure is never a fallback: it is reported as an interrupted import', async () => {
  const { client, sent } = fake({ executeFails: true });
  const server = new WarmImportServer(request, client);
  await assert.rejects(run(server));
  assert.ok(sent.includes('apex import ...'));
  // One server, one import: it is closed and never runs a second batch.
  assert.equal(await run(server), undefined);
});

test('cancellation after submission reports cancelled, not a fallback', async () => {
  const { client } = fake({ hang: true });
  const controller = new AbortController();
  const server = new WarmImportServer(request, client);
  const pending = run(server, controller.signal);
  setTimeout(() => controller.abort(), 20);
  const result = await pending;
  // The fake finishes its batch; the result must still be a real result or an interruption, never undefined.
  assert.notEqual(result, undefined);
});

test('a successful import returns the server output and closes the server', async () => {
  const { client } = fake();
  const server = new WarmImportServer(request, client);
  const result = await run(server);
  assert.match(String(result?.stdout ?? ''), /APEXREST_DONE/u);
  assert.equal((client as unknown as { alive: boolean }).alive, false);
});
