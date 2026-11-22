import test from 'node:test';
import assert from 'node:assert/strict';
import { SCRIPT_SESSION_RESET, ScriptSession } from '../../packages/core/src/sqlcl-warm.ts';
import type { SqlclMcpClient } from '../../packages/core/src/sqlcl-mcp.ts';

function fake(
  script: (command: string) => { text: string; isError?: boolean } | Error,
  options: { refusesHost?: boolean } = {},
) {
  const sent: string[] = [];
  const client = {
    alive: true,
    connects: 0,
    async open() {},
    async connect() {
      client.connects++;
      return { isError: false };
    },
    async execute(command: string) {
      sent.push(command);
      if (command.startsWith('host '))
        return { text: options.refusesHost === false ? 'APEXREST_RESTRICT_PROBE' : 'SP2-0738' };
      const answer = script(command);
      if (answer instanceof Error) throw answer;
      return answer;
    },
    text(result: { text: string }) {
      return result.text;
    },
    async close() {
      client.alive = false;
    },
  };
  return { client: client as unknown as SqlclMcpClient & { connects: number; alive: boolean }, sent };
}
const request = { executable: 'sql', cwd: '/tmp', restrictLevel: '2' as const };
const run = (session: ScriptSession, n: number) =>
  session.run({
    connectionName: 'dev',
    completionMarker: `M${n}`,
    input: `@s${n}.sql\ncommit;\nprompt M${n}`,
  });

test('several scripts share one proven, connected server and each is followed by a reset', async () => {
  const { client, sent } = fake((command) => ({
    text: command === SCRIPT_SESSION_RESET ? '' : command.slice(-2),
  }));
  const session = new ScriptSession(request, client);
  for (const n of [1, 2, 3]) assert.match(String((await run(session, n))?.stdout), new RegExp(`M${n}`));
  assert.equal(client.connects, 1);
  assert.equal(sent.filter((command) => command === SCRIPT_SESSION_RESET).length, 3);
  assert.equal(session.usable, true);
  await session.close();
  assert.equal(client.alive, false);
});

test('without the HOST refusal nothing is submitted and the caller runs the ordinary process', async () => {
  const { client, sent } = fake(() => ({ text: 'M1' }), { refusesHost: false });
  const session = new ScriptSession(request, client);
  assert.equal(await run(session, 1), undefined);
  assert.equal(
    sent.some((command) => command.startsWith('@')),
    false,
  );
  assert.equal(session.usable, false);
});

test('a script without its marker is returned as is and the session is discarded', async () => {
  const { client } = fake((command) => ({
    text: command.startsWith('@s2') ? 'ORA-01476: divisor is equal to zero' : command.slice(-2),
  }));
  const session = new ScriptSession(request, client);
  await run(session, 1);
  const failed = await run(session, 2);
  assert.doesNotMatch(String(failed?.stdout), /M2/u);
  assert.equal(session.usable, false);
  assert.equal(await run(session, 3), undefined, 'a discarded session takes no further script');
});

test('a transport failure after submission is never a fallback', async () => {
  const { client } = fake((command) =>
    command.startsWith('@') ? new Error('Connection closed') : { text: '' },
  );
  const session = new ScriptSession(request, client);
  await assert.rejects(run(session, 1));
  assert.equal(session.usable, false);
});

test('a failed reset keeps the confirmed script result but discards the session', async () => {
  const { client } = fake((command) =>
    command === SCRIPT_SESSION_RESET ? { text: 'ORA-00942', isError: true } : { text: command.slice(-2) },
  );
  const session = new ScriptSession(request, client);
  assert.match(String((await run(session, 1))?.stdout), /M1/u);
  assert.equal(session.usable, false);
});
