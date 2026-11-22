import test from 'node:test';
import assert from 'node:assert/strict';
import fsPromises, { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  OracleAdapter,
  compilerDetails,
  compilerFault,
  diagnosticHint,
  jsonDocuments,
  missingSavedConnection,
  oracleDiagnostics,
  parseCompilerDiagnostics,
} from '../../packages/core/src/oracle.ts';
import type { ProcessRequest, ProcessResult } from '../../packages/core/src/process.ts';
import {
  compilerFault as shipCompilerFault,
  fallbackCompilerDiagnostics,
  validateApplication,
} from '../../packages/core/src/ship.ts';
import { Fault, failure, success } from '../../packages/core/src/result.ts';
import { fixture } from '../fixtures/project.ts';
import { ArtifactService } from '../../packages/core/src/artifacts.ts';
import { toolOutput } from '../../packages/mcp/src/output.ts';
import { loadApplication } from '../../packages/core/src/preview/apexlang.ts';

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

test('the blank application starter explicitly enables session state protection', () => {
  const app = loadApplication(path.resolve('templates/blank-app/application'));
  assert.equal((app.app.props.sessionStateProtection as { enabled?: boolean }).enabled, true);
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

const warningReport = `APEXlang Compile Warnings:
File: pages/p00070-activity-calendar.apx
Line: 22
Column: 12
Type: INVALID_LOV
Warning: Invalid Slot value: layout - slot (STRING) : contentBody
Valid values are :
banner
-body
-footer
Validation successful.
`;

test('compiler warnings preserve severity, repair options and unlocated WARN/ERROR lines', () => {
  assert.deepEqual(parseCompilerDiagnostics(warningReport), [
    {
      code: 'INVALID_LOV',
      severity: 'warning',
      file: 'pages/p00070-activity-calendar.apx',
      line: 22,
      column: 12,
      type: 'INVALID_LOV',
      message: 'Invalid Slot value: layout - slot (STRING) : contentBody',
      validValues: ['banner', 'body', 'footer'],
    },
  ]);
  assert.deepEqual(
    parseCompilerDiagnostics(report + warningReport).map(({ severity }) => severity),
    ['error', 'error', 'error', 'warning'],
  );
  assert.deepEqual(
    parseCompilerDiagnostics('[WARN] Source option was ignored\nERROR: Invalid source\n').map(
      ({ severity, message }) => [severity, message],
    ),
    [
      ['warning', 'Source option was ignored'],
      ['error', 'Invalid source'],
    ],
  );
});

test('large successful validation retains every compiler warning and complete archived raw output', async (t) => {
  const { ctx } = await fixture();
  const previousHome = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = path.join(ctx.root, 'managed');
  t.after(async () => {
    if (previousHome === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = previousHome;
    await rm(ctx.root, { recursive: true, force: true });
  });
  const output = Array.from({ length: 70 }, (_, index) =>
    warningReport.replace('22\nColumn', index + 1 + '\nColumn'),
  ).join('\n');
  const oracle = {
    async validate() {
      return { status: 'passed', compiler: { version: 'fixture' }, output };
    },
  } as unknown as OracleAdapter;
  const result = await validateApplication(
    oracle,
    path.join(ctx.root, ctx.config.application.sourceDir),
    parseCompilerDiagnostics,
  );
  assert.equal(result.warningCount, 70);
  assert.equal(result.diagnostics.length, 70);
  assert.equal(result.output, output);
  assert.equal(result.outputTruncated, false);
  const response = await toolOutput(success('apex.validate', result), ctx.root);
  assert.ok(response.content[0]!.text.length < 8192);
  const compact = JSON.parse(response.content[0]!.text);
  assert.equal(compact.data.warningCount, 70);
  const service = new ArtifactService(ctx);
  let offset: number | null = 0;
  let content = '';
  while (offset !== null) {
    const page = await service.read(compact.data.output.artifactId, offset, 4096);
    content += page.content;
    offset = page.nextOffset;
  }
  const archived = JSON.parse(content);
  assert.equal(archived.data.output, output);
  assert.equal(archived.data.diagnostics.length, 70);
});

test('compiler failure capture keeps errors after the bounded SQLcl message', async () => {
  const output = warningReport.repeat(30) + report;
  assert.throws(
    () => oracleDiagnostics(completed(output), false, 'text', true),
    (error) => {
      assert.ok(error instanceof Fault);
      assert.ok(error.message.length <= 6000);
      const captured = error.details?.output;
      assert.equal(captured, output + '\n');
      assert.equal(
        parseCompilerDiagnostics(String(captured)).filter(({ severity }) => severity === 'error').length,
        3,
      );
      return true;
    },
  );
  const fault = await compilerFault(output);
  assert.equal(fault.details?.output, output);
  assert.equal(fault.details?.diagnostics?.length, 33);
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
  // The compiler reports a missing required property at the opening line of the component that
  // lacks it: the hint names that component, not only its parent.
  assert.equal(
    await diagnosticHint(root, at(8, 'MISSING_REQUIRED_PROPERTY')),
    'inside region bad (type: form) of page 1',
  );
  assert.equal(await diagnosticHint(root, at(8)), 'inside page 1');
  assert.equal(await diagnosticHint(root, { ...at(5), file: '../outside.apx' }), undefined);
  assert.equal(await diagnosticHint(root, { ...at(5), file: 'pages/missing.apx' }), undefined);
  assert.equal(await diagnosticHint(root, at(0)), undefined);
  const fault = await compilerFault(report, root);
  assert.equal(fault.code, 'VALIDATION_FAILED');
  assert.equal(fault.details!.diagnostics!.length, 3);
  // A missing required property names its component and what to add.
  assert.match(
    fault.details!.diagnostics![2]!.hint!,
    /^inside region bad \(type: form\) of page 1\. Fix: add to region bad: source \{ tableName: <STRING> \} \(required when source\.location = localDatabase and source\.type = tableView/u,
  );
  assert.match(fault.message, /^APEXLang Compile Errors:/);
  const unconfirmed = await compilerFault('Nothing recognizable', root);
  assert.equal(unconfirmed.code, 'VALIDATION_UNCONFIRMED');
  assert.equal(unconfirmed.details, undefined);
});

test('compiler details reuse contained source lines only within one report', async (t) => {
  const temporary = await fsPromises.realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-diag-cache-')));
  const root = path.join(temporary, 'project');
  await mkdir(path.join(root, 'pages'), { recursive: true });
  const source = (page: number, section = 'navigation') =>
    `page ${page} (\n    name: Fixture\n    ${section} {\n        cursorFocus: doNotFocusCursor\n        bogusProperty: true\n    }\n)\n`;
  const a = path.join(root, 'pages/a.apx');
  const b = path.join(root, 'pages/b.apx');
  const missing = path.join(root, 'pages/missing.apx');
  const outside = path.join(temporary, 'outside.apx');
  await writeFile(a, source(1));
  await writeFile(b, source(2));
  await writeFile(outside, source(99));
  // Windows file symlinks require privileges that ordinary CI users may not have.
  const checkFileSymlinks = process.platform !== 'win32';
  if (checkFileSymlinks) await fsPromises.symlink(outside, path.join(root, 'pages/escaped.apx'));
  else t.diagnostic('Skipping the POSIX file symlink subcase; cache and freshness assertions still run.');
  const cases = [
    ['pages/a.apx', 'a-1', 5, 'INVALID_PROPERTY'],
    ['pages/b.apx', 'b-1', 5, 'REFERENCE_NOT_FOUND'],
    ['pages/./a.apx', 'a-2', 5, 'INVALID_PROPERTY'],
    ['pages/missing.apx', 'missing-1', 5, 'INVALID_PROPERTY'],
    ['../outside.apx', 'outside', 5, 'INVALID_PROPERTY'],
    ...(checkFileSymlinks ? [['pages/escaped.apx', 'symlink', 5, 'INVALID_PROPERTY'] as const] : []),
    ['pages/b.apx', 'b-2', 5, 'MISSING_REQUIRED_PROPERTY'],
    ['pages/missing.apx', 'missing-2', 5, 'INVALID_PROPERTY'],
    ['pages/\0broken.apx', 'malformed', 5, 'INVALID_PROPERTY'],
    ['pages/a.apx', 'unlocated', 0, 'INVALID_PROPERTY'],
    ['pages/a.apx', 'ineligible', 5, 'SYNTAX'],
  ] as const;
  const output =
    'APEXLang Compile Errors:\n' +
    cases
      .map(
        ([file, label, line, type]) =>
          `File: ${file}\nLine: ${line}\nColumn: 8\nType: ${type}\nError: fixture ${label}\n\n`,
      )
      .join('');
  const parsed = parseCompilerDiagnostics(output);
  assert.equal(parsed.length, cases.length);
  const sourceHints: Record<string, string> = {
    'a-1': 'inside navigation of page 1',
    'b-1': 'inside navigation of page 2',
    'a-2': 'inside navigation of page 1',
    'b-2': 'inside navigation of page 2',
  };
  const hints = cases.map(([, label]) => sourceHints[label]);
  const expected = (values: (string | undefined)[]) =>
    parsed.map((diagnostic, index) =>
      values[index] ? { ...diagnostic, hint: values[index] } : { ...diagnostic },
    );
  const originalRead = fsPromises.readFile;
  const reads = new Map<string, number>();
  const spy = t.mock.method(fsPromises, 'readFile', (...args: Parameters<typeof originalRead>) => {
    const file = String(args[0]);
    reads.set(file, (reads.get(file) ?? 0) + 1);
    return originalRead(...args);
  });
  syncBuiltinESMExports();
  try {
    // The existing standalone contract remains fresh and gives exactly the same source hints.
    for (const [index, diagnostic] of parsed.entries())
      assert.equal(await diagnosticHint(root, diagnostic), hints[index]);
    reads.clear();
    assert.deepEqual(await compilerDetails(output), { diagnostics: parsed, output });
    assert.equal(reads.size, 0);
    const first = await compilerDetails(output, root);
    assert.equal(JSON.stringify(first), JSON.stringify({ diagnostics: expected(hints), output }));
    assert.deepEqual(Object.fromEntries(reads), { [a]: 1, [b]: 1, [missing]: 1 });

    await writeFile(a, source(1, 'appearance'));
    await writeFile(missing, source(3));
    const updatedHints = cases.map(([, label], index) =>
      label.startsWith('a-')
        ? 'inside appearance of page 1'
        : label.startsWith('missing-')
          ? 'inside navigation of page 3'
          : hints[index],
    );
    assert.deepEqual(await compilerDetails(output, root), {
      diagnostics: expected(updatedHints),
      output,
    });
    assert.deepEqual(Object.fromEntries(reads), { [a]: 2, [b]: 2, [missing]: 2 });

    await writeFile(a, source(1, 'layout'));
    assert.equal(await diagnosticHint(root, parsed[0]!), 'inside layout of page 1');
    assert.equal(await diagnosticHint(root, parsed[0]!), 'inside layout of page 1');
    assert.equal(reads.get(a), 4);
  } finally {
    spy.mock.restore();
    syncBuiltinESMExports();
    await rm(temporary, { recursive: true, force: true });
  }
});

test(
  'cached source hints still recheck containment for each diagnostic',
  {
    skip:
      process.platform === 'win32' &&
      'requires POSIX file symlinks; cache and freshness are tested separately',
  },
  async (t) => {
    const temporary = await fsPromises.realpath(
      await mkdtemp(path.join(tmpdir(), 'apexrest-diag-containment-')),
    );
    const root = path.join(temporary, 'project');
    await mkdir(root);
    const file = path.join(root, 'page.apx');
    const outside = path.join(temporary, 'outside.apx');
    const source = 'page 1 (\n    navigation {\n        bogusProperty: true\n    }\n)\n';
    await writeFile(file, source);
    await writeFile(outside, source.replace('page 1', 'page 99'));
    const block = 'File: page.apx\nLine: 3\nColumn: 8\nType: INVALID_PROPERTY\nError: fixture\n\n';
    const output = 'APEXLang Compile Errors:\n' + block + block;
    const originalRead = fsPromises.readFile;
    const reads: string[] = [];
    const spy = t.mock.method(fsPromises, 'readFile', async (...args: Parameters<typeof originalRead>) => {
      reads.push(String(args[0]));
      const text = await originalRead(...args);
      if (String(args[0]) === file) {
        await rm(file);
        await fsPromises.symlink(outside, file);
      }
      return text;
    });
    syncBuiltinESMExports();
    try {
      const parsed = parseCompilerDiagnostics(output);
      assert.deepEqual(await compilerDetails(output, root), {
        diagnostics: [{ ...parsed[0]!, hint: 'inside navigation of page 1' }, parsed[1]],
        output,
      });
      assert.deepEqual(reads, [file]);
    } finally {
      spy.mock.restore();
      syncBuiltinESMExports();
      await rm(temporary, { recursive: true, force: true });
    }
  },
);

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
          hint: 'inside navigation of page 1. Fix: page has no bogus; navigation: cursorFocus, warnOnUnsavedChanges',
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
      assert.equal(
        error.details?.diagnostics?.[0]?.hint,
        'inside navigation of page 1. Fix: page has no bogus; navigation: cursorFocus, warnOnUnsavedChanges',
      );
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

test('an unknown SQLcl saved connection is a blocked connection fault, not a validation failure', () => {
  // Verbatim SQLcl 26.3 output of `sql -S -L -name <missing>` (exit code 1).
  const missing = completed('Unknown connection apexrest_missing\n', { code: 1 });
  let fault: unknown;
  assert.throws(
    () => oracleDiagnostics(missing),
    (error: unknown) => {
      fault = error;
      return (
        error instanceof Fault &&
        error.code === 'SQLCL_CONNECTION_NOT_FOUND' &&
        error.status === 'blocked' &&
        error.details?.savedConnection === 'apexrest_missing'
      );
    },
  );
  // ship planning maps compiler faults to VALIDATION_FAILED; this one passes through unchanged.
  assert.equal(shipCompilerFault(fault, fallbackCompilerDiagnostics), fault);
  const result = failure('ship', fault);
  assert.equal(result.diagnostics[0]!.code, 'SQLCL_CONNECTION_NOT_FOUND');
  assert.ok(result.nextActions.some((action) => /conn -save/.test(action) && /connection test/.test(action)));
  assert.ok(result.nextActions.every((action) => !/\.apx/.test(action)));
  assert.equal(missingSavedConnection('Unknown connection "dev read"'), 'dev read');
  assert.equal(missingSavedConnection("Connection 'dev-read' not found"), 'dev-read');
  // Successful output carrying the phrase as data, or mid-line, is not a missing connection.
  assert.equal(oracleDiagnostics(completed('Unknown connection x\n')), 'Unknown connection x\n\n');
  assert.equal(missingSavedConnection('row: Unknown connection x'), undefined);
});

test('a long compiler report says it was truncated and points at the full diagnostics', async () => {
  const entry = (n: number) =>
    `File: pages/p${String(n).padStart(5, '0')}-x.apx\nLine: 4\nColumn: 8\nType: INVALID_PROPERTY\nError: Invalid property: bogus${n}\n`;
  const output = `APEXLang Compile Errors:\n${Array.from({ length: 60 }, (_, n) => entry(n + 1)).join('')}`;
  const fault = await compilerFault(output);
  assert.equal(fault.code, 'VALIDATION_FAILED');
  assert.equal(fault.details?.diagnostics?.length, 60);
  assert.match(fault.message, /report truncated; all 60 diagnostics are in details\.diagnostics\.$/);
  // A short report is passed through unchanged.
  assert.equal(
    (await compilerFault(`APEXLang Compile Errors:\n${entry(1)}`)).message,
    `APEXLang Compile Errors:\n${entry(1)}`,
  );
});
