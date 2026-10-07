import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  OracleAdapter,
  compilerFault,
  diagnosticHint,
  jsonDocuments,
  oracleDiagnostics,
  parseCompilerDiagnostics,
} from '../../packages/core/src/oracle.ts';
import type { ProcessRequest, ProcessResult } from '../../packages/core/src/process.ts';

// Verbatim SQLcl 26.1.2 `apex validate` output shapes (offline compiler).
const report = `APEXLang Compile Errors:
File: pages/p00080-customer.apx
Line: 6
Column: 8
Type: LOV_NOT_FOUND
Error: Invalid LOV required parameter: appearance - pageMode (string)
Valid parameters are: modalDialog
-nonModalDialog
-normal

File: pages/p00080-customer.apx
Line: 55
Column: 12
Type: REFERENCE_NOT_FOUND
Error: Reference not found: @formx

File: pages/p00001-home.apx
Line: 10
Column: 4
Type: MISSING_REQUIRED_PROPERTY
Error: Missing required parameter (961): source - tableName (string)


`;
const completed = (stdout: string, changes: Partial<ProcessResult> = {}): ProcessResult => ({
  code: 0,
  stdout,
  stderr: '',
  timedOut: false,
  cancelled: false,
  truncated: false,
  ...changes,
});

test('compiler report parses into file/line/column/type/message with valid values', () => {
  assert.deepEqual(parseCompilerDiagnostics(report), [
    {
      code: 'LOV_NOT_FOUND',
      severity: 'error',
      file: 'pages/p00080-customer.apx',
      line: 6,
      column: 8,
      type: 'LOV_NOT_FOUND',
      message: 'Invalid LOV required parameter: appearance - pageMode (string)',
      validValues: ['modalDialog', 'nonModalDialog', 'normal'],
    },
    {
      code: 'REFERENCE_NOT_FOUND',
      severity: 'error',
      file: 'pages/p00080-customer.apx',
      line: 55,
      column: 12,
      type: 'REFERENCE_NOT_FOUND',
      message: 'Reference not found: @formx',
    },
    {
      code: 'MISSING_REQUIRED_PROPERTY',
      severity: 'error',
      file: 'pages/p00001-home.apx',
      line: 10,
      column: 4,
      type: 'MISSING_REQUIRED_PROPERTY',
      message: 'Missing required parameter (961): source - tableName (string)',
    },
  ]);
  assert.deepEqual(parseCompilerDiagnostics('Validation successful.\n'), []);
  assert.deepEqual(parseCompilerDiagnostics('Could not find file or directory with inputPath: /x\n'), []);
  // ANSI colour, CRLF and an unterminated final block still parse.
  const colored =
    '\x1b[31mAPEXLang Compile Errors:\x1b[0m\r\nFile: a.apx\r\nLine: 1\r\nColumn: 2\r\nType: T\r\nError: m\r\nmore';
  assert.deepEqual(
    parseCompilerDiagnostics(colored).map((d) => [d.file, d.line, d.message]),
    [['a.apx', 1, 'm more']],
  );
});

test('hints name the enclosing declarations read from the source file', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-diag-'));
  t.after(() => undefined);
  await mkdir(path.join(root, 'pages'), { recursive: true });
  await writeFile(
    path.join(root, 'pages/p00001-home.apx'),
    `page 1 (
    name: Home
    navigation {
        cursorFocus: doNotFocusCursor
        bogusProperty: true
    }

    region bad (
        name: Bad
        type: form
        layout {
            sequence: 20
        }
        appearance {
            template: @/nothing
            pageMode: wrongValue
        }
    )
)
`,
  );
  const at = (line: number, type = 'INVALID_PROPERTY') => ({
    code: type,
    severity: 'error' as const,
    file: 'pages/p00001-home.apx',
    line,
    column: 8,
    type,
    message: 'fixture',
  });
  assert.equal(await diagnosticHint(root, at(5)), 'inside navigation of page 1');
  assert.equal(await diagnosticHint(root, at(16)), 'inside appearance of region bad (type: form) of page 1');
  assert.equal(
    await diagnosticHint(root, at(15, 'REFERENCE_NOT_FOUND')),
    'inside appearance of region bad (type: form) of page 1',
  );
  assert.equal(
    await diagnosticHint(root, at(9, 'MISSING_REQUIRED_PROPERTY')),
    'inside region bad (type: form) of page 1',
  );
  assert.equal(await diagnosticHint(root, { ...at(5), file: '../outside.apx' }), undefined);
  assert.equal(await diagnosticHint(root, { ...at(5), file: 'pages/missing.apx' }), undefined);
  assert.equal(await diagnosticHint(root, at(0)), undefined);
  const fault = await compilerFault(report, root);
  assert.equal(fault.code, 'VALIDATION_FAILED');
  assert.equal(fault.details!.diagnostics!.length, 3);
  assert.equal(fault.details!.diagnostics![2]!.hint, 'inside region bad (type: form) of page 1');
  assert.match(fault.message, /^APEXLang Compile Errors:/);
  const unconfirmed = await compilerFault('Nothing recognizable', root);
  assert.equal(unconfirmed.code, 'VALIDATION_UNCONFIRMED');
  assert.equal(unconfirmed.details, undefined);
});

test('validate and import surface structured compiler diagnostics on the fault', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-diag-validate-'));
  t.after(() => undefined);
  const app = path.join(root, 'app');
  await mkdir(path.join(app, '.apex'), { recursive: true });
  await mkdir(path.join(app, 'pages'), { recursive: true });
  await writeFile(path.join(app, '.apex/apexlang.json'), '{"mmdVersion":"fixture"}');
  await writeFile(path.join(app, 'application.apx'), 'application 1 (\n    name: Fixture\n)\n');
  await writeFile(
    path.join(app, 'pages/p00001-home.apx'),
    'page 1 (\n    name: Home\n    navigation {\n        bogus: true\n    }\n)\n',
  );
  const calls: ProcessRequest[] = [];
  const oracle = new OracleAdapter(async (request) => {
    calls.push(request);
    if (request.args[0] === '-version') return completed('SQLcl: fixture');
    if (request.input?.includes('help apex')) return completed('apex generate export validate import');
    if (request.input?.includes('apex import'))
      return completed(
        'APEXLang Compile Errors:\nFile: pages/p00001-home.apx\nLine: 4\nColumn: 8\nType: INVALID_PROPERTY\nError: Invalid property: bogus\n',
      );
    return completed(
      'APEXLang Compile Errors:\nFile: pages/p00001-home.apx\nLine: 4\nColumn: 8\nType: INVALID_PROPERTY\nError: Invalid property: bogus\n',
    );
  });
  // An identifiable installation layout lets the process-level capability cache apply.
  await mkdir(path.join(root, 'sqlcl/bin'), { recursive: true });
  await mkdir(path.join(root, 'sqlcl/lib'), { recursive: true });
  await writeFile(path.join(root, 'sqlcl/bin/sql'), 'fixture launcher, never executable');
  oracle.stage = () => mkdtemp(path.join(root, 'stage-'));
  oracle.settings = async () => ({
    schemaVersion: 1,
    mode: 'cli',
    mcpRestrictLevel: '4',
    executable: path.join(root, 'sqlcl/bin/sql'),
    javaHome: undefined,
  });
  await assert.rejects(
    oracle.validate(app),
    (error: Error & { code: string; details?: { diagnostics?: unknown[] } }) => {
      assert.equal(error.code, 'VALIDATION_FAILED');
      assert.deepEqual(error.details?.diagnostics, [
        {
          code: 'INVALID_PROPERTY',
          severity: 'error',
          file: 'pages/p00001-home.apx',
          line: 4,
          column: 8,
          type: 'INVALID_PROPERTY',
          message: 'Invalid property: bogus',
          hint: 'inside navigation of page 1',
        },
      ]);
      return true;
    },
  );
  const env = {
    applicationId: 100,
    workspace: 'TEST',
    parsingSchema: 'TEST',
    deployConnectionRef: 'deploy',
  } as never;
  const ctx = { config: { application: { alias: 'fixture' } } } as never;
  await assert.rejects(
    oracle.importApplication(ctx, env, { kind: 'sqlcl-store', name: 'deploy' }, app),
    (error: Error & { code: string; details?: { diagnostics?: { type: string; hint?: string }[] } }) => {
      assert.equal(error.code, 'ORACLE_COMMAND_FAILED');
      assert.equal(error.details?.diagnostics?.[0]?.type, 'INVALID_PROPERTY');
      assert.equal(error.details?.diagnostics?.[0]?.hint, 'inside navigation of page 1');
      return true;
    },
  );
  // import never re-probed capabilities once the process cache was warm
  assert.equal(calls.filter((r) => r.input?.includes('help apex')).length, 1);
});

test('JSON diagnostics strip rows of every envelope and batches split per marker', async () => {
  const rows = (items: unknown[]) => JSON.stringify({ results: [{ items }] });
  const two =
    rows([{ m: 'ORA-01017 historic' }]) +
    '\nMARK_0\n' +
    rows([{ m: 'ORA-06512 old\n{"nested": "}"}' }]) +
    '\nMARK_1\n';
  assert.equal(jsonDocuments(two).length, 2);
  assert.equal(oracleDiagnostics(completed(two), false, 'json'), two + '\n');
  assert.throws(() => oracleDiagnostics(completed(two + 'ORA-20000: real failure'), false, 'json'), {
    code: 'ORACLE_COMMAND_FAILED',
  });
  assert.throws(
    () => oracleDiagnostics(completed(two, { stderr: 'ORA-01031: insufficient privileges' }), false, 'json'),
    { code: 'DB_PRIVILEGE' },
  );
  let input = '';
  const oracle = new OracleAdapter(async (request) => {
    input = request.input!;
    const markers = [...input.matchAll(/prompt (APEXREST_ROWS_\w+)/g)].map((m) => m[1]!);
    return completed(
      markers
        .map((marker, i) => rows([{ n: i, note: 'ORA-00001 as data' }]) + (i === 0 ? '' : '\r\n') + marker)
        .join('\n') + '\n',
    );
  });
  oracle.stage = async () => tmpdir();
  oracle.settings = async () => ({
    schemaVersion: 1,
    mode: 'cli',
    mcpRestrictLevel: '4',
    executable: 'sql',
    javaHome: undefined,
  });
  const connection = { kind: 'sqlcl-store', name: 'fixture' } as const;
  assert.deepEqual(
    await oracle.jsonQueryBatch(
      [
        { sql: 'select 1 from dual', bindings: { p_a: 1 } },
        { sql: 'select 2 from dual', bindings: { p_b: 'x' } },
      ],
      connection,
    ),
    [[{ n: 0, note: 'ORA-00001 as data' }], [{ n: 1, note: 'ORA-00001 as data' }]],
  );
  assert.match(
    input,
    /variable p_a number\nexec :p_a := 1;\nset sqlformat json\nselect 1 from dual;\nprompt APEXREST_ROWS_\w+_0\nvariable p_b varchar2\(1024\)/,
  );
  assert.deepEqual(await oracle.jsonQueryBatch([], connection), []);
  const short = new OracleAdapter(async () => completed(rows([{ n: 0 }]) + '\n'));
  short.stage = oracle.stage;
  short.settings = oracle.settings;
  await assert.rejects(
    short.jsonQueryBatch([{ sql: 'select 1 from dual' }, { sql: 'select 2 from dual' }], connection),
    { code: 'EMPTY_QUERY_RESULT' },
  );
});
