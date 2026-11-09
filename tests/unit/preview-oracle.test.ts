import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeJson } from '../../packages/core/src/fs.ts';
import { OracleAppData, type ConnectedOracle } from '../../packages/core/src/preview/oracle/app-data.ts';
import { WorkerBridge, type OracleLink } from '../../packages/core/src/preview/oracle/bridge.ts';
import {
  connectOracle,
  savedConnectionProperties,
  warmUp,
} from '../../packages/core/src/preview/oracle/connect.ts';
import {
  codeOutsideLiterals,
  oracleBlock,
  runOraclePlsql,
  transactionRisk,
} from '../../packages/core/src/preview/oracle/plsql.ts';
import {
  OracleError,
  declareBinds,
  initSession,
  jsonRows,
  plsqlSegment,
  querySegment,
  scriptLineRisk,
  segmentError,
  segments,
  sqlText,
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

async function oraclePreview(
  t: import('node:test').TestContext,
  answer: (segment: string) => string,
  commit = false,
) {
  const { app, assets } = await workspace(t);
  const fake = fakeOracle(answer);
  const oracle: ConnectedOracle = {
    data: new OracleAppData(fake.link, 'DEMO', { commit }),
    environment: 'dev',
    target: 'DEVDB/devdb_svc',
    ...(commit ? { commit } : {}),
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

  // A saved connection with JDBC auto-commit (SQLcl's MCP server default) cannot roll back:
  // the preview refuses before any page query and names the properties file to fix.
  const store = path.join(home, '.dbtools', 'connections', 'abc123');
  await mkdir(store, { recursive: true });
  await writeFile(path.join(store, 'dbtools.properties'), 'name=fixture-dev\ntype=ORACLE_DATABASE\n');
  assert.equal(savedConnectionProperties('fixture-dev', home), path.join(store, 'ojdbc.properties'));
  assert.equal(savedConnectionProperties('other', home), undefined);
  const autocommit = fakeOracle((segment) =>
    /^rollback;/mu.test(segment) && !/select/u.test(segment)
      ? 'Error starting at line : 1 in command -\nrollback\nError report -\nORA-17274: Could not rollback with auto-commit enabled.'
      : identity('fixture')(segment),
  );
  await assert.rejects(
    connectOracle(ctx.root, 'dev', () => autocommit.link),
    (error: Error & { code: string }) => {
      assert.equal(error.code, 'PREVIEW_AUTOCOMMIT_ON');
      assert.match(error.message, /autoCommit=false/u);
      return true;
    },
  );
  assert.equal(autocommit.link.closed, true, 'the refused session is closed');
  assert.ok(
    !autocommit.inputs.some((input) => /apex_application_page_items|all_source/u.test(input)),
    'no page or source query ran after the refusal',
  );
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

test('code and values cannot leave their block through SQLcl terminator lines', async (t) => {
  const breakout = 'null;\nend;\n/\ndrop table orders purge\n/\nbegin\nnull;';
  // Lines SQLcl acts on regardless of quoting, with every Java line break.
  assert.match(scriptLineRisk(breakout, 'plsql')!, /only "\/" \(line 3\)/u);
  assert.match(scriptLineRisk('null;\r/\rdrop table t', 'plsql')!, /only "\/"/u);
  assert.match(scriptLineRisk('null;\r\n  /  \r\n', 'plsql')!, /only "\/"/u);
  assert.match(scriptLineRisk("x := 'a\n.\n';", 'plsql')!, /only "\."/u);
  assert.match(scriptLineRisk('null;\n  #host id', 'plsql')!, /starting with "#"/u);
  assert.match(scriptLineRisk('select 1 from dual;\ndrop table t', 'sql')!, /ending with ";"/u);
  assert.match(scriptLineRisk('select 1 from dual; -- end\ndrop table t', 'sql')!, /ending with ";"/u);
  // Ordinary code keeps working: semicolons in PL/SQL, division, blank lines, inline ';'.
  assert.equal(scriptLineRisk('x := a\n  / 2;\n\nif x > 0 then\n  y := 1;\nend if;', 'plsql'), undefined);
  assert.equal(scriptLineRisk("select ';' x, 4/2 y\n\nfrom dual -- a/b", 'sql'), undefined);

  assert.throws(() => plsqlSegment(`begin\n${breakout}\nend;`), { code: -20989 });
  assert.throws(() => querySegment('select 1 x from dual) where 1 = 1;\ndrop table orders purge', 10), {
    code: -20989,
  });
  assert.equal(plsqlSegment('begin\n  null;\nend;'), 'begin\n  null;\nend;\n/');

  // Bind values never put a raw line break into the script.
  assert.equal(sqlText("a'b"), "'a''b'");
  assert.equal(sqlText('x\n/\ny'), "'x' || chr(10) || '/' || chr(10) || 'y'");
  assert.equal(sqlText('\r\n'), 'chr(13) || chr(10)');
  assert.equal(sqlText(''), "''");
  const declared = declareBinds({ P1_X: 'ok\n/\ndrop table orders purge\n/\n' });
  const lines = declared.split(/\r\n|\r|\n/u);
  assert.equal(lines.filter((line) => line.trim() === '/').length, 1, declared);
  assert.equal(lines.at(-1), '/');

  // Nothing is sent: not the query, not the DML, not the PL/SQL unit.
  const { inputs, link } = fakeOracle();
  const data = new OracleAppData(link, 'demo');
  assert.throws(() => data.query('select 1 from dual;\ndrop table orders purge'), { code: -20989 });
  assert.throws(() => data.execute('update t set x = 1\n/\ndrop table orders purge'), { code: -20989 });
  assert.throws(() => data.plsql({ block: oracleBlock(breakout, 'block', 'text'), binds: {} }), {
    code: -20989,
  });
  assert.equal(inputs.length, 0);

  const preview = await oraclePreview(t, () => '');
  const renderer = preview.server.renderer;
  const session: Session = { id: '1', user: 'DEV', items: {}, pagination: {} };
  const ctx = renderer.prepare(session, '1');
  const sent = preview.inputs.length;
  const skipped = runOraclePlsql(renderer, ctx, preview.oracle, breakout, 'block', { label: 'p' });
  assert.equal(skipped.ok, false);
  assert.equal(skipped.failure?.kind, 'unsupported');
  assert.match(skipped.failure!.message, /only "\/" \(line 3\)/u);
  assert.equal(preview.inputs.length, sent, 'a unit with a terminator line is not sent');
  assert.equal(preview.oracle.apexError, undefined, 'the refusal does not disable the APEX session context');
});

test('transaction checks read comments, strings and q-quotes in one pass, as Oracle does', () => {
  // Bypasses of the former two-pass check: a q-quote opener inside a comment.
  assert.equal(transactionRisk("/* q'[ */ commit; /* ]' */"), 'COMMIT');
  assert.equal(transactionRisk("-- q'[\ncommit;\n-- ]'"), 'COMMIT');
  assert.equal(transactionRisk("-- it's\ncommit;\n-- done'"), 'COMMIT');
  assert.equal(transactionRisk("x := '/*'; commit; y := '*/';"), 'COMMIT');
  // A line comment ends at CR too: SQLcl splits lines on it.
  assert.equal(transactionRisk('null; -- note\rcommit;'), 'COMMIT');
  // Exact q-quote closers and prefixes.
  assert.equal(transactionRisk("x := q'[ a )' ]'; commit;"), 'COMMIT');
  assert.equal(transactionRisk("x := nq'{a}'; execute immediate 'x';"), 'EXECUTE IMMEDIATE');
  assert.equal(transactionRisk("x := Q'!a!'; rollback;"), 'ROLLBACK');
  // Never closed: refused rather than guessed.
  assert.match(transactionRisk('null; /* commit')!, /unterminated/u);
  assert.match(transactionRisk("x := 'abc; commit;")!, /unterminated/u);
  assert.match(transactionRisk("x := q'[abc; commit;")!, /unterminated/u);
  // Text that only mentions the words stays allowed.
  assert.equal(transactionRisk("x := 'commit'; -- commit\n/* rollback */ y := q'[commit]';"), undefined);
  assert.equal(transactionRisk("y := q'!it's a commit!'; z := 'O''Hara commit';"), undefined);
  assert.equal(transactionRisk('select "COMMIT" into x from t; -- it\'s fine'), undefined);
  assert.equal(transactionRisk("n := seq_q('commit');"), undefined);
  // Masking keeps offsets and line breaks.
  const masked = codeOutsideLiterals("a := 'x';\n-- c\nb := q'<y>';")!;
  assert.equal(masked.length, "a := 'x';\n-- c\nb := q'<y>';".length);
  assert.equal(masked, 'a :=    ;\n    \nb :=       ;');
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
  // Stop here, not in t.after: after hooks run in registration order, so the workspace removal
  // would run first. On Windows it cannot delete the open SQLite file, and its failure would skip
  // the stop and leave the server keeping the test process alive.
  try {
    assert.equal(started.database, path.join(await realpath(root), '.apexrest/preview/preview.sqlite'));
    const html = await (await fetch(`${started.url}/r/demo/home`)).text();
    assert.match(html, /From project data/u);
    assert.equal(existsSync(path.join(app, '.apex-local')), false, 'nothing is written into the source tree');
  } finally {
    await previewStop(root, { all: true });
  }
});

test('the warm-up reads schema metadata once and opens the first APEX session before the URL', () => {
  const columns = envelope(
    [
      ['TABLE_NAME', 'VARCHAR2'],
      ['COLUMN_NAME', 'VARCHAR2'],
      ['DATA_TYPE', 'VARCHAR2'],
      ['IS_PK', 'VARCHAR2'],
      ['HAS_DEFAULT', 'VARCHAR2'],
    ],
    [
      ['ORDERS', 'ID', 'NUMBER', 'Y', 'Y'],
      ['ORDERS', 'STATUS', 'VARCHAR2', 'N', 'N'],
      ['ITEMS', 'ID', 'NUMBER', 'Y', 'N'],
    ],
  );
  const fake = fakeOracle((segment) => {
    if (/from user_tab_columns c/u.test(segment)) return columns;
    if (/from user_triggers/u.test(segment)) return envelope([['TABLE_NAME', 'VARCHAR2']], [['ITEMS']]);
    if (/"APEXREST_DBMS"/u.test(segment)) return outBinds(segment, {});
    if (/select \* from \(/u.test(segment)) return envelope([['COLUMN_NAME', 'VARCHAR2']], []);
    return '';
  });
  const data = new OracleAppData(fake.link, 'demo');
  const result = warmUp(data, { applicationId: 102, items: new Set(['P1_X']), pages: [0, 1, 3] });
  assert.equal(result.tables, 2);
  assert.equal(result.apexSession, 'ready');
  assert.equal(fake.inputs.length, 3, 'columns, triggers and one APEX session call');
  assert.match(
    fake.inputs[2]!,
    /apex_session\.create_session\(p_app_id => 102, p_page_id => 1, p_username => 'APEXREST_PREVIEW'\)/u,
  );
  // Later lookups come from the prefetched metadata, without another round trip.
  assert.deepEqual(data.tableColumns('orders'), [
    { name: 'ID', pk: true, type: 'NUMBER' },
    { name: 'STATUS', pk: false, type: 'VARCHAR2' },
  ]);
  assert.equal(data.tableExists('"DEMO"."ITEMS"'), true);
  assert.equal(data.tableExists('missing_table'), false);
  assert.equal(data.keySource('orders', 'id'), 'default');
  assert.equal(data.keySource('orders', 'status'), 'none');
  assert.equal(data.keySource('items', 'id'), 'default', 'an insert trigger fills the key');
  assert.equal(fake.inputs.length, 3);
  // Other schemas keep the per-table lookup.
  data.tableColumns('other.audit');
  assert.equal(fake.inputs.length, 4);
  assert.match(fake.inputs[3]!, /all_tab_columns/u);
});

test('a failed or truncated warm-up leaves per-request lookups in place', () => {
  const failing = fakeOracle((segment) =>
    /has_default/u.test(segment)
      ? 'ORA-00904: "C"."IDENTITY_COLUMN": invalid identifier'
      : /select \* from \(/u.test(segment)
        ? envelope([['COLUMN_NAME', 'VARCHAR2']], [])
        : '',
  );
  const data = new OracleAppData(failing.link, 'DEMO');
  assert.equal(warmUp(data).tables, 'skipped');
  const before = failing.inputs.length;
  data.tableColumns('orders');
  assert.equal(failing.inputs.length, before + 1, 'the table is still looked up on demand');

  const full = fakeOracle((segment) =>
    /select \* from \(/u.test(segment)
      ? envelope(
          [
            ['TABLE_NAME', 'VARCHAR2'],
            ['COLUMN_NAME', 'VARCHAR2'],
          ],
          [['T', 'A']],
        )
      : '',
  );
  const truncated = new OracleAppData(full.link, 'DEMO');
  assert.deepEqual(truncated.prefetchSchema(1), { tables: 0, complete: false });
  truncated.tableColumns('t');
  assert.equal(full.inputs.length, 2, 'a truncated prefetch caches nothing');
});

test('commit mode is refused for a database that is not confirmed local', async (t) => {
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
    read: { kind: 'sqlcl-store', name: 'fixture-dev' },
  });
  const identity = (segment: string) =>
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
                ['identity', 'fixture', 'fixture', 'FIXTURE', null],
                ['workspace', null, null, null, 'FIXTURE'],
              ]
            : [],
        )
      : '';

  let opened = false;
  await assert.rejects(
    connectOracle(
      ctx.root,
      'dev',
      () => {
        opened = true;
        return fakeOracle(identity).link;
      },
      { commit: true, locality: async () => ({ local: false, evidence: 'remote-endpoint' }) },
    ),
    (error: Error & { code: string }) => {
      assert.equal(error.code, 'PREVIEW_COMMIT_REMOTE_REFUSED');
      assert.match(error.message, /remote-endpoint/u);
      return true;
    },
  );
  assert.equal(opened, false, 'a refused commit mode opens no session');
  await assert.rejects(
    connectOracle(ctx.root, 'dev', () => fakeOracle(identity).link, {
      commit: true,
      locality: async () => {
        throw new Error('show connection failed');
      },
    }),
    { code: 'PREVIEW_COMMIT_REMOTE_REFUSED' },
  );

  let settings: { commit?: boolean } | undefined;
  const local = fakeOracle(identity);
  const connected = await connectOracle(
    ctx.root,
    'dev',
    (worker) => {
      settings = worker;
      return local.link;
    },
    { commit: true, locality: async () => ({ local: true, evidence: 'loopback+local-server-identity' }) },
  );
  assert.equal(connected.commit, true);
  assert.equal(settings?.commit, true, 'the worker session allows COMMIT in procedures');
  assert.ok(connected.warnings.some((warning) => /Commit mode/u.test(warning)));
  assert.ok(!connected.warnings.some((warning) => /not undone by the rollback/u.test(warning)));
  connected.data.query('select 1 from dual');
  connected.data.endRequest(true);
  assert.match(local.inputs.at(-1)!, /^commit;/u);
  connected.data.query('select 1 from dual');
  connected.data.endRequest(false);
  assert.match(local.inputs.at(-1)!, /^rollback;/u);
  connected.data.close();

  assert.match(initSession(false), /disable commit in procedure/u);
  assert.doesNotMatch(initSession(true), /disable commit/u);
  assert.match(initSession(true), /set autocommit off/u);
});

test('commit mode sends committing code, commits successful requests and rolls back failed ones', async (t) => {
  let rejected = false;
  const { server, oracle, inputs } = await oraclePreview(
    t,
    (segment) => {
      // Bind declarations and the unit are separate segments of one batch.
      if (/:P1_TITLE := /u.test(segment)) rejected = /:P1_TITLE := 'BAD'/u.test(segment);
      if (/insert into tasks/u.test(segment) && rejected)
        return 'ORA-20100: Title rejected\nORA-06512: at line 2';
      if (/"APEXREST_TX_BEFORE"/u.test(segment))
        return outBinds(segment, { APEXREST_TX_BEFORE: '5.1.900', APEXREST_TX_AFTER: null });
      if (/select \* from \(/u.test(segment))
        return envelope(
          [
            ['TASK_ID', 'NUMBER'],
            ['TITLE', 'VARCHAR2'],
            ['STATUS', 'VARCHAR2'],
          ],
          [[1, 'Row', 'OPEN']],
        );
      return '';
    },
    true,
  );
  const renderer = server.renderer;
  const ctx = renderer.prepare({ id: '1', user: 'DEV', items: {}, pagination: {} }, '1');
  const sent = inputs.length;
  const committing = runOraclePlsql(renderer, ctx, oracle, 'insert into t values (1);\ncommit;', 'block', {
    label: 'p',
  });
  assert.equal(committing.ok, true, 'a unit that ends the transaction is not an error in commit mode');
  assert.equal(inputs.length, sent + 1, 'a unit with COMMIT is sent');
  assert.match(inputs.at(-1)!, /commit;/u);
  oracle.data.endRequest(false);

  await server.start();
  const ended = () => inputs.filter((input) => /^(commit|rollback);/u.test(input)).length;
  const settle = async (count: number) => {
    for (let i = 0; i < 100 && ended() < count; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  };
  const first = await fetch(`${server.url}/r/demo/home`);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  assert.match(await first.text(), /Row/u);
  let before = ended();
  await settle(before + 1);
  assert.match(inputs.filter((input) => /^(commit|rollback);/u.test(input)).at(-1)!, /^commit;/u);

  const submit = (title: string) =>
    fetch(`${server.url}/r/demo/wwv_flow.accept`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        p_flow_step_id: '1',
        p_request: 'ADD',
        p_json: JSON.stringify({ pageItems: { itemsToSubmit: [{ n: 'P1_TITLE', v: title }] } }),
      }),
    }).then((response) => response.json() as Promise<{ errors?: unknown[] }>);

  before = ended();
  const failed = await submit('BAD');
  assert.ok(failed.errors?.length, 'the failing process returns errors');
  await settle(before + 1);
  assert.match(inputs.filter((input) => /^(commit|rollback);/u.test(input)).at(-1)!, /^rollback;/u);

  before = ended();
  const saved = await submit('Good');
  assert.equal(saved.errors, undefined);
  await settle(before + 1);
  assert.match(inputs.filter((input) => /^(commit|rollback);/u.test(input)).at(-1)!, /^commit;/u);
  assert.ok(inputs.some((input) => /insert into tasks/u.test(input) && /:P1_TITLE := 'Good'/u.test(input)));
});
