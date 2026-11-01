import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeJson } from '../../packages/core/src/fs.ts';
import { OracleAppData, type ConnectedOracle } from '../../packages/core/src/preview/oracle/app-data.ts';
import { WorkerBridge, type OracleLink } from '../../packages/core/src/preview/oracle/bridge.ts';
import { connectOracle } from '../../packages/core/src/preview/oracle/connect.ts';
import {
  oracleBlock,
  runOraclePlsql,
  transactionRisk,
} from '../../packages/core/src/preview/oracle/plsql.ts';
import {
  OracleError,
  declareBinds,
  jsonRows,
  segmentError,
  segments,
} from '../../packages/core/src/preview/oracle/protocol.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { previewStart, previewStop } from '../../packages/core/src/preview/service.ts';
import type { Session } from '../../packages/core/src/preview/render.ts';
import { fixture } from '../fixtures/project.ts';
import { workspace } from '../fixtures/preview.ts';

/** SQLcl `set sqlformat json` envelope with SQLcl's lower-case item keys. */
function envelope(columns: [string, string][], rows: unknown[][]) {
  return JSON.stringify({
    results: [
      {
        columns: columns.map(([name, type]) => ({ name, type })),
        items: rows.map((row) =>
          Object.fromEntries(columns.map(([name], index) => [name.toLowerCase(), row[index]])),
        ),
      },
    ],
  });
}

/** A scripted Oracle: `answer` returns each segment's output; markers are echoed like SQLcl PROMPT. */
function fakeOracle(answer: (segment: string) => string = () => '') {
  const inputs: string[] = [];
  const link: OracleLink & { closed: boolean } = {
    closed: false,
    run(input) {
      inputs.push(input);
      const output: string[] = [];
      let segment: string[] = [];
      for (const line of input.split('\n')) {
        const marker = /^prompt (APEXREST_SEGMENT_\w+)$/u.exec(line)?.[1];
        if (!marker) {
          segment.push(line);
          continue;
        }
        output.push(answer(segment.join('\n')), marker);
        segment = [];
      }
      return output.join('\n');
    },
    close() {
      this.closed = true;
    },
  };
  return { inputs, link };
}

/** Answers the out-bind SELECT of a PL/SQL call with the given values. */
function outBinds(segment: string, values: Record<string, string | null>) {
  const names = [...segment.matchAll(/:(\w+) "\w+"/gu)].map((match) => match[1]!);
  return envelope(
    names.map((name) => [name, 'VARCHAR2']),
    [names.map((name) => (name in values ? values[name] : null))],
  );
}

test('protocol quotes bind values, reads SQLcl JSON and splits segments', () => {
  const declared = declareBinds({ P1_NAME: "O'Hara", P1_EMPTY: '', P1_ID: 7 });
  assert.match(declared, /variable P1_NAME varchar2\(32767\)/u);
  assert.match(declared, /:P1_NAME := 'O''Hara';/u);
  assert.match(declared, /:P1_EMPTY := null;/u);
  assert.match(declared, /:P1_ID := '7';/u);
  assert.throws(() => declareBinds({ 'bad name': 'x' }), OracleError);

  const rows = jsonRows(
    envelope(
      [
        ['ID', 'NUMBER'],
        ['CREATED', 'DATE'],
        ['Name', 'VARCHAR2'],
      ],
      [[1, '2026-11-01T10:20:30Z', 'Lamp']],
    ),
  );
  assert.deepEqual(rows.columns, ['ID', 'CREATED', 'NAME']);
  assert.deepEqual(rows.rows, [{ ID: 1, CREATED: '2026-11-01 10:20:30', NAME: 'Lamp' }]);

  // SQLcl can glue PROMPT output to the closing brace of its JSON.
  assert.deepEqual(segments('a\nM_0\n{"x":1}APEXREST_SEGMENT_ab_1\n', ['M_0', 'APEXREST_SEGMENT_ab_1']), [
    'a',
    '{"x":1}',
  ]);
  assert.throws(() => segments('no markers', ['M_0']), OracleError);

  const error = segmentError('Error starting at line : 3\nORA-20100: SKU must be set\nORA-06512: at line 2');
  assert.equal(error?.code, -20100);
  assert.equal(error?.message, 'ORA-20100: SKU must be set\nORA-06512: at line 2');
  assert.equal(segmentError('PL/SQL procedure successfully completed.'), undefined);
});

test('PL/SQL units are wrapped for their APEX role', () => {
  assert.equal(oracleBlock('x := 1;', 'block', 'text'), 'begin\nx := 1;\nend;');
  assert.match(oracleBlock('return 1;', 'functionBody', 'text'), /function apexrest_fn return varchar2/u);
  assert.match(oracleBlock('return true;', 'functionBody', 'boolean'), /return boolean[\s\S]*'Y'[\s\S]*'N'/u);
  assert.match(oracleBlock(":P1_X = 'A'", 'plsqlExpression', 'boolean'), /l_result := \(:P1_X = 'A'\)/u);
  assert.equal(
    oracleBlock('upper(:P1_X)', 'sqlExpression', 'text'),
    'begin\n  select (upper(:P1_X)) into :APEXREST_RESULT from dual;\nend;',
  );
});

test('application data runs in Oracle with only referenced binds and refuses DDL', () => {
  const { inputs, link } = fakeOracle((segment) => {
    if (/select \* from \(/u.test(segment))
      return envelope(
        [
          ['TASK_ID', 'NUMBER'],
          ['TITLE', 'VARCHAR2'],
        ],
        [[1, 'Design review']],
      );
    if (/:APEXREST_ROWS "APEXREST_ROWS"/u.test(segment))
      return outBinds(segment, { APEXREST_ROWS: '1', APEXREST_ROWID: 'AAAR3sAAEAAAACXAAA' });
    return '';
  });
  const data = new OracleAppData(link, 'demo');
  const result = data.query('select task_id, title from tasks where status = :P1_STATUS', {
    P1_STATUS: 'OPEN',
    P1_OTHER: 'not sent',
  });
  assert.deepEqual(result.rows, [{ TASK_ID: 1, TITLE: 'Design review' }]);
  assert.match(inputs[0]!, /:P1_STATUS := 'OPEN';/u);
  assert.doesNotMatch(inputs[0]!, /P1_OTHER/u);
  assert.match(inputs[0]!, /where rownum <= 10000/u);

  const inserted = data.execute('insert into tasks (title) values (:P1_TITLE)', { P1_TITLE: 'Ship' });
  assert.deepEqual(inserted, { changes: 1, lastInsertRowid: 'AAAR3sAAEAAAACXAAA' });
  assert.match(
    inputs[1]!,
    /returning rowidtochar\(rowid\) into :APEXREST_ROWID;\n:APEXREST_ROWS := sql%rowcount;/u,
  );

  assert.throws(() => data.execute('create table t (x number)'), /DDL is not run/u);
  assert.throws(() => data.execute('  truncate table tasks'), /DDL is not run/u);
  const before = inputs.length;
  assert.deepEqual(data.execute('release savepoint apex_local_ig'), { changes: 0, lastInsertRowid: 0 });
  assert.equal(inputs.length, before, 'SQLite-only savepoint release is not sent');
  data.execute('savepoint apex_local_ig');
  assert.match(inputs.at(-1)!, /begin\nsavepoint apex_local_ig;\nend;/u);
});

test('every request that touched Oracle ends with one rollback', () => {
  const { inputs, link } = fakeOracle((segment) =>
    /select \* from \(/u.test(segment) ? envelope([['X', 'NUMBER']], [[1]]) : '',
  );
  const data = new OracleAppData(link, 'demo');
  data.endRequest();
  assert.equal(inputs.length, 0, 'an untouched request sends nothing');
  data.scalar('select 1 x from dual');
  data.endRequest();
  assert.match(inputs.at(-1)!, /^rollback;\nprompt /u);
  const count = inputs.length;
  data.endRequest();
  assert.equal(inputs.length, count, 'the rollback itself does not mark the session dirty');
  data.close();
  assert.equal(link.closed, true);
});

async function oraclePreview(t: import('node:test').TestContext, answer: (segment: string) => string) {
  const { app, assets } = await workspace(t);
  const fake = fakeOracle(answer);
  const oracle: ConnectedOracle = {
    data: new OracleAppData(fake.link, 'DEMO'),
    environment: 'dev',
    target: 'DEVDB/devdb_svc',
    warnings: ['Sequences advance'],
  };
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, oracle });
  t.after(() => server.stop());
  return { server, oracle, ...fake };
}

test('connected preview runs PL/SQL in Oracle, writes binds back and maps errors', async (t) => {
  let shapeAttempts = 0;
  const { server, oracle, inputs } = await oraclePreview(t, (segment) => {
    if (/apexrest_fn return varchar2/u.test(segment) && /return true/u.test(segment)) {
      shapeAttempts += 1;
      return 'ORA-06550: line 4, column 1:\nPLS-00382: expression is of wrong type';
    }
    if (/raise_application_error/u.test(segment)) return 'ORA-20100: SKU must be set\nORA-06512: at line 2';
    if (/"APEXREST_DBMS"/u.test(segment))
      return outBinds(segment, { P1_TITLE: 'From Oracle', APEXREST_RESULT: 'Y', APEXREST_DBMS: 'hello\n' });
    return '';
  });
  const renderer = server.renderer;
  const session: Session = { id: '1', user: 'DEV', items: { P1_TITLE: 'Local' }, pagination: {} };
  const ctx = renderer.prepare(session, '1');
  const who = { label: 'process demo' };

  const block = runOraclePlsql(renderer, ctx, oracle, ':P1_TITLE := pkg.title(:P1_TITLE);', 'block', who);
  assert.equal(block.ok, true);
  assert.equal(session.items.P1_TITLE, 'From Oracle');
  assert.match(inputs.at(-1)!, /:P1_TITLE := 'Local';/u);
  assert.match(inputs.at(-1)!, /begin\n:P1_TITLE := pkg.title\(:P1_TITLE\);\nend;/u);
  assert.ok(renderer.diagnostics.some((entry) => /DBMS_OUTPUT hello/u.test(entry.message)));

  const condition = runOraclePlsql(renderer, ctx, oracle, 'return true;', 'functionBody', who);
  assert.equal(condition.ok, true);
  assert.equal(condition.value, true, 'a boolean body is retried once with a boolean wrapper');
  runOraclePlsql(renderer, ctx, oracle, 'return true;', 'functionBody', who);
  assert.equal(shapeAttempts, 1, 'the learned shape is reused');

  const failed = runOraclePlsql(
    renderer,
    ctx,
    oracle,
    "raise_application_error(-20100, 'SKU must be set');",
    'block',
    who,
  );
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.failure, { message: 'ORA-20100: SKU must be set', kind: 'app' });
});

test('connected preview requests read Oracle data and are rolled back', async (t) => {
  const { server, inputs } = await oraclePreview(t, (segment) =>
    /select \* from \(/u.test(segment)
      ? envelope(
          [
            ['TASK_ID', 'NUMBER'],
            ['TITLE', 'VARCHAR2'],
            ['STATUS', 'VARCHAR2'],
          ],
          [[41, 'Real Oracle row', 'OPEN']],
        )
      : '',
  );
  await server.start();
  const html = await (await fetch(`${server.url}/r/demo/home`)).text();
  assert.match(html, /Real Oracle row/u);
  assert.match(
    inputs.find((input) => /from tasks/u.test(input))!,
    /nvl\(status, 'OPEN'\)/u,
    'Oracle SQL is sent untranslated',
  );
  // Rollback runs after the response; wait for the request's finally.
  for (let i = 0; i < 50 && !inputs.some((input) => /^rollback;/u.test(input)); i++)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(inputs.some((input) => /^rollback;/u.test(input)));
  assert.equal(server.db.tableExists('tasks'), false, 'no local seed or sample table in connected mode');
  assert.ok(
    server.diagnostics().some((entry) => /Connected preview: Sequences advance/u.test(entry.message)),
  );
});

test('connectOracle refuses production targets and ORDS-only connections', async (t) => {
  const { ctx } = await fixture();
  const home = await mkdtemp(path.join(tmpdir(), 'apexrest-home-'));
  const before = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = home;
  t.after(async () => {
    if (before === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = before;
    await rm(home, { recursive: true, force: true });
    await rm(ctx.root, { recursive: true, force: true });
  });
  await writeJson(path.join(home, 'connections.json'), {
    read: {
      kind: 'sqlcl-store',
      ords: { url: 'https://db.example.invalid/ords/fixture/', username: 'fixture' },
    },
  });
  await assert.rejects(connectOracle(ctx.root, 'dev'), { code: 'PREVIEW_SQLCL_CONNECTION_REQUIRED' });
  await writeJson(path.join(ctx.root, 'apexrest.json'), {
    ...ctx.config,
    environments: { dev: { ...ctx.config.environments.dev, kind: 'production' } },
  });
  await assert.rejects(connectOracle(ctx.root, 'dev'), { code: 'PREVIEW_PRODUCTION_REFUSED' });
  await writeJson(path.join(ctx.root, 'apexrest.json'), ctx.config);
  await writeJson(path.join(home, 'connections.json'), {
    read: { kind: 'sqlcl-store', name: 'fixture-dev' },
  });

  const identity = (name: string) => (segment: string) =>
    /select \* from \(/u.test(segment)
      ? envelope(
          [
            ['TARGET_RECORD', 'VARCHAR2'],
            ['DB_UNIQUE_NAME', 'VARCHAR2'],
            ['SERVICE_NAME', 'VARCHAR2'],
            ['PARSING_SCHEMA', 'VARCHAR2'],
            ['WORKSPACE', 'VARCHAR2'],
          ],
          /target_record/u.test(segment)
            ? [
                ['identity', name, 'fixture', 'FIXTURE', null],
                ['workspace', null, null, null, 'FIXTURE'],
              ]
            : [],
        )
      : '';
  const wrong = fakeOracle(identity('other-db'));
  await assert.rejects(
    connectOracle(ctx.root, 'dev', () => wrong.link),
    { code: 'TARGET_MISMATCH' },
  );
  assert.equal(wrong.link.closed, true, 'a refused target closes the session');

  const right = fakeOracle(identity('fixture'));
  const connected = await connectOracle(ctx.root, 'dev', () => right.link);
  assert.equal(connected.target, 'fixture/fixture');
  assert.equal(connected.apex, undefined);
  assert.ok(connected.warnings.some((warning) => /not installed/u.test(warning)));
  connected.data.close();
});

test('page code that could commit never reaches Oracle; a commit that still happens is detected', async (t) => {
  assert.equal(transactionRisk('begin\n  commit;\nend;'), 'COMMIT');
  assert.equal(transactionRisk("execute immediate 'truncate table t';"), 'EXECUTE IMMEDIATE');
  assert.equal(transactionRisk('n := dbms_sql.open_cursor;'), 'DBMS_SQL');
  assert.equal(transactionRisk('rollback;'), 'ROLLBACK');
  assert.equal(transactionRisk('rollback to savepoint before_save;'), undefined);
  assert.equal(transactionRisk("x := 'commit'; -- commit\n/* rollback */ y := q'[commit]';"), undefined);

  const { server, oracle, inputs } = await oraclePreview(t, (segment) =>
    /"APEXREST_TX_BEFORE"/u.test(segment)
      ? outBinds(segment, {
          APEXREST_TX_BEFORE: '5.1.900',
          APEXREST_TX_AFTER: null,
          APEXREST_HTP: 'Content-type: text/html\nContent-length: 5\n\n<b>x</b>',
        })
      : '',
  );
  const renderer = server.renderer;
  const session: Session = { id: '1', user: 'DEV', items: {}, pagination: {} };
  const ctx = renderer.prepare(session, '1');
  const sent = inputs.length;
  const skipped = runOraclePlsql(renderer, ctx, oracle, 'insert into t values (1);\ncommit;', 'block', {
    label: 'p',
  });
  assert.equal(skipped.failure?.kind, 'unsupported');
  assert.equal(inputs.length, sent, 'a unit with COMMIT is not sent');

  const ended = runOraclePlsql(renderer, ctx, oracle, 'pkg.save;', 'block', { label: 'process save' });
  assert.equal(ended.ok, false);
  assert.match(ended.failure!.message, /ended the Oracle transaction/u);
  assert.equal(ended.output, '<b>x</b>', 'the CGI header block is removed from HTP output');
  assert.ok(
    renderer.diagnostics.some(
      (entry) => entry.level === 'error' && /process save: The code ended/u.test(entry.message),
    ),
  );
});

const ECHO_WORKER = `
const { parentPort, workerData } = require('node:worker_threads');
const flag = new Int32Array(workerData.flag);
parentPort.on('message', (request) => {
  if (request.input === 'hang') return;
  workerData.port.postMessage({ id: request.id, ok: request.input !== 'fail', output: 'echo:' + request.input, error: 'boom' });
  Atomics.store(flag, 0, 1);
  Atomics.notify(flag, 0);
});`;

test('worker bridge answers synchronously and resets after a timeout', () => {
  const bridge = new WorkerBridge({
    settings: { executable: 'unused', args: [], cwd: '.', env: {}, connectionName: 'unused' },
    timeoutMs: 200,
    graceMs: 50,
    worker: { source: ECHO_WORKER },
  });
  try {
    assert.equal(bridge.run('select 1'), 'echo:select 1');
    assert.throws(() => bridge.run('fail'), /Oracle session failed: boom/u);
    assert.throws(
      () => bridge.run('hang'),
      (error: unknown) => (error as OracleError).code === -20994,
    );
    assert.equal(bridge.run('again'), 'echo:again', 'a fresh worker serves the next call');
  } finally {
    bridge.close();
  }
});

test('a project preview seeds from migrations and project .apex-local and writes outside the source tree', async (t) => {
  const { root, app, assets } = await workspace(t);
  // Move the fixture's legacy <sourceDir>/.apex-local into project migrations and data folders.
  const schema = await readFile(path.join(app, '.apex-local/01-schema.sql'), 'utf8');
  await rm(path.join(app, '.apex-local'), { recursive: true, force: true });
  await mkdir(path.join(root, 'db/migrations'), { recursive: true });
  await writeFile(path.join(root, 'db/migrations/0001__schema.sql'), schema.replace(/insert[^;]*;\n/giu, ''));
  await mkdir(path.join(root, '.apex-local'), { recursive: true });
  await writeFile(
    path.join(root, '.apex-local/01-data.sql'),
    "insert into tasks (title) values ('From project data');\ncommit;\n",
  );
  await writeJson(path.join(root, 'apexrest.json'), {
    schemaVersion: 1,
    projectId: 'preview-data',
    application: { sourceDir: 'app', alias: 'demo' },
    database: { migrationsDir: 'db/migrations', packagesDir: 'db/packages' },
    toolchain: { lockFile: 'toolchain.json' },
    environments: {},
    artifacts: { directory: '.apexrest/artifacts', retentionDays: 7 },
  });
  await writeJson(path.join(root, 'toolchain.json'), { version: 'fixture' });
  const started = (await previewStart(root, { assetsDir: assets, port: 0 })) as {
    url: string;
    database: string;
  };
  t.after(() => previewStop(root, { all: true }));
  assert.equal(started.database, path.join(await realpath(root), '.apexrest/preview/preview.sqlite'));
  const html = await (await fetch(`${started.url}/r/demo/home`)).text();
  assert.match(html, /From project data/u);
  assert.equal(existsSync(path.join(app, '.apex-local')), false, 'nothing is written into the source tree');
});
