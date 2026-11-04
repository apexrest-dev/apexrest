import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { acceptKey, encodeFrame, FrameReader } from '../../packages/core/src/preview/websocket.ts';
import { serverRefs, withActions, workspace } from '../fixtures/preview.ts';

const SEED = `create table tasks (
  task_id integer primary key,
  title varchar2(200) not null,
  status varchar2(20)
);
insert into tasks (title, status) values ('Design review', 'OPEN');
insert into tasks (title, status) values ('Ship it', 'DONE');
create table task_log (task_id integer, note varchar2(200));
create view open_tasks as select * from tasks where status = 'OPEN';
`;

const PAGE = `page 7 (
    name: Board
    alias: BOARD

    region open (
        name: Open tasks
        type: classicReport
        source {
            location: localDatabase
            sqlQuery:
                \`\`\`sql
                select title from open_tasks -- not task_log
                \`\`\`
        }
    )

    region editor (
        name: Editor
        type: form
        source {
            location: localDatabase
            tableName: TASKS
        }
    )

    region note (
        name: Note
        type: staticContent
        source {
            htmlCode: <p>Rows come from tasks and open_tasks.</p>
        }
    )
)
`;

// The write comes from a declared Execute Server-side Code action; the browser sends only its reference.
const ADD_TASK = `
    dynamicAction add-task (
        name: Add task
        when {
            event: click
            selectionType: jQuerySelector
            jQuerySelector: '#never'
        }
        action add (
            action: executeServerSideCode
            settings {
                plsqlCode: insert into tasks (title, status) values ('Live', 'OPEN');
            }
            execution {
                sequence: 10
            }
        )
    )`;

/** A test client that queues the server's JSON messages. */
function socket(url: string, cookie?: string, origin?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  const ws = new WebSocket(url, { headers } as unknown as string[]);
  const queue: Record<string, unknown>[] = [];
  const waiters: (() => void)[] = [];
  ws.onmessage = (event) => {
    queue.push(JSON.parse(String(event.data)) as Record<string, unknown>);
    waiters.splice(0).forEach((wake) => wake());
  };
  const next = async (type: string, timeout = 3000) => {
    const deadline = Date.now() + timeout;
    for (;;) {
      const index = queue.findIndex((message) => message.type === type);
      if (index >= 0) return queue.splice(index, 1)[0]!;
      if (Date.now() > deadline) throw new Error(`No ${type} message`);
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
        setTimeout(resolve, 50);
      });
    }
  };
  const opened = new Promise<boolean>((resolve) => {
    ws.onopen = () => resolve(true);
    ws.onerror = () => resolve(false);
  });
  return { ws, next, opened, queue };
}

test('WebSocket frames: handshake key, server frames and masked client frames', () => {
  // RFC 6455 section 1.3.
  assert.equal(acceptKey('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  assert.deepEqual([...encodeFrame(0x1, Buffer.from('Hi'))], [0x81, 2, 0x48, 0x69]);
  assert.equal(encodeFrame(0x1, Buffer.alloc(300))[1], 126);
  assert.equal(encodeFrame(0x1, Buffer.alloc(70_000))[1], 127);

  const mask = Buffer.from([1, 2, 3, 4]);
  const payload = Buffer.from('{"type":"x"}');
  const masked = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]!));
  const frame = Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, masked]);
  const reader = new FrameReader();
  // Split across chunks the way TCP may deliver it.
  assert.deepEqual(reader.push(frame.subarray(0, 5)), []);
  const frames = reader.push(frame.subarray(5))!;
  assert.equal(frames.length, 1);
  assert.equal(frames[0]!.payload.toString(), '{"type":"x"}');
  // Unmasked client frames are a protocol error.
  assert.equal(new FrameReader().push(Buffer.from([0x81, 0x01, 0x41])), undefined);
});

test('live preview maps regions to tables and pushes writes, presence and source reloads', async (t) => {
  const { app, assets } = await workspace(t, {
    '.apex-local/01-seed.sql': SEED,
    'pages/p00007-board.apx': withActions(PAGE, ADD_TASK),
  });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const live = `${server.url.replace('http', 'ws')}/r/demo/__apex/live?page=7`;

  const first = await fetch(`${server.url}/r/demo/board`);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  const html = await first.text();
  const config = JSON.parse(/apexLocal\.live\.start\((.*?)\);/u.exec(html)![1]!) as {
    page: string;
    regions: Record<string, { tables: string[]; form?: boolean }>;
  };
  // The view resolves to its base table; comments, literals and static regions are ignored.
  assert.deepEqual(config, {
    page: '7',
    regions: { open: { tables: ['TASKS'] }, editor: { tables: ['TASKS'], form: true } },
  });
  assert.match(await (await fetch(`${server.url}/__apex/runtime.js`)).text(), /apexLocal\.live = /);

  // Foreign origins cannot listen; an unknown session (a restarted server) only learns that it expired.
  assert.equal(await socket(live, cookie, 'http://evil.example').opened, false);
  // DNS rebinding: a Host that is not this server is refused before the session is looked at.
  const rebound = await new Promise<number>((resolve) => {
    const port = Number(new URL(server.url).port);
    http
      .get({
        host: '127.0.0.1',
        port,
        path: '/r/demo/__apex/live?page=7',
        headers: {
          host: `evil.example:${port}`,
          cookie,
          connection: 'Upgrade',
          upgrade: 'websocket',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'sec-websocket-version': '13',
        },
      })
      .on('upgrade', (_response, upgraded) => {
        upgraded.destroy();
        resolve(101);
      })
      .on('response', (response) => resolve(response.statusCode ?? 0))
      .on('error', () => resolve(0));
  });
  assert.equal(rebound, 403);
  const stale = socket(live, 'APEX_LOCAL_SESSION=1');
  assert.equal(await stale.opened, true);
  assert.deepEqual(await stale.next('expired'), { type: 'expired' });
  assert.equal(server.live.size, 0);

  const mine = socket(live, cookie, server.url);
  assert.equal(await mine.opened, true);
  t.after(() => mine.ws.close());
  assert.deepEqual(await mine.next('hello'), { type: 'hello', data: true });
  assert.equal((await mine.next('presence')).viewers, 1);

  // A second user in another session sees the first one's changes as someone else's.
  const login = await fetch(`${server.url}/r/demo/board`);
  const other = login.headers.get('set-cookie')!.split(';')[0]!;
  await login.text();
  const theirs = socket(`${live}&tab=tab1`, other);
  assert.equal(await theirs.opened, true);
  t.after(() => theirs.ws.close());
  assert.deepEqual(await theirs.next('presence'), {
    type: 'presence',
    viewers: 2,
    sessions: 2,
    users: ['DEVELOPER'],
  });
  assert.equal((await mine.next('presence')).viewers, 2);

  const write = await fetch(`${server.url}/r/demo/__apex/server-code?page=7`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', 'x-apex-local-tab': 'tab1' },
    body: JSON.stringify({ ref: serverRefs(html).add }),
  });
  assert.deepEqual(await write.json(), {});
  assert.deepEqual(await mine.next('changed'), {
    type: 'changed',
    tables: ['TASKS'],
    user: 'DEVELOPER',
    self: true,
    here: false,
  });
  // The tab id of the request marks the socket of that tab, whatever the session.
  assert.deepEqual(await theirs.next('changed'), {
    type: 'changed',
    tables: ['TASKS'],
    user: 'DEVELOPER',
    self: false,
    here: true,
  });

  // Reads and region refreshes push nothing.
  await (await fetch(`${server.url}/r/demo/board`, { headers: { cookie } })).text();
  await (
    await fetch(`${server.url}/r/demo/__apex/region?page=7&region=open`, { headers: { cookie } })
  ).text();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(
    mine.queue.some((message) => message.type === 'changed'),
    false,
  );

  // Editing the APEXlang source reloads every open page.
  await writeFile(
    path.join(app, 'pages', 'p00007-board.apx'),
    withActions(PAGE, ADD_TASK).replace('Open tasks', 'Open work'),
  );
  assert.equal((await mine.next('reload', 5000)).type, 'reload');
  await theirs.next('reload', 5000);
  assert.match(
    await (await fetch(`${server.url}/r/demo/board`, { headers: { cookie } })).text(),
    /Open work/,
  );
  // Re-reading the source regenerates the APEX_* dictionary tables; that is not a data change.
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.deepEqual(
    mine.queue.filter((message) => message.type === 'changed'),
    [],
  );

  theirs.ws.close();
  assert.equal((await mine.next('presence')).viewers, 1);
});

test('connected mode keeps source reloads but pushes no data changes', async (t) => {
  const { app, assets } = await workspace(t, { '.apex-local/01-seed.sql': SEED });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  // The hub decides from the data mode; a hub without data ignores writes.
  assert.equal(server.live.data, true);
  const { LiveHub } = await import('../../packages/core/src/preview/live.ts');
  const hub = new LiveHub({ sourceDir: app, data: false, onSource: () => undefined });
  assert.deepEqual(hub.changed({ tables: ['TASKS'], user: 'X' }), []);
  assert.deepEqual(server.live.changed({ tables: ['sqlite_master', 'apex_local_sequences'], user: 'X' }), []);
  hub.close();
  server.db.close();
});
