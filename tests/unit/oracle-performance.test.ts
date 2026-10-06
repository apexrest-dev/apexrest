import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import type { Runner } from '../../packages/core/src/oracle.ts';
import type { Environment } from '../../packages/core/src/config.ts';
import type { ProcessRequest, ProcessResult } from '../../packages/core/src/process.ts';

const result = (stdout: string, changes: Partial<ProcessResult> = {}): ProcessResult => ({
  code: 0,
  stdout,
  stderr: '',
  timedOut: false,
  cancelled: false,
  truncated: false,
  ...changes,
});
const target = {
  workspace: 'FIXTURE',
  parsingSchema: 'FIXTURE',
  applicationId: 1001,
  databaseIdentity: { dbUniqueName: 'DB', serviceName: 'SERVICE' },
} as Environment;
const connection = { kind: 'sqlcl-store', name: 'fixture' } as const;
const rows = () => [
  {
    target_record: 'identity',
    db_unique_name: 'DB',
    service_name: 'SERVICE',
    parsing_schema: 'FIXTURE',
  },
  { target_record: 'workspace', workspace_id: 123, workspace: 'FIXTURE' },
  {
    target_record: 'application',
    application_id: 1001,
    alias: 'fixture',
    owner: 'FIXTURE',
    workspace: 'FIXTURE',
  },
];
async function adapter(runner: Runner, identifiable = true) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-oracle-performance-'));
  const executable = identifiable ? path.join(root, 'sqlcl/bin/sql') : 'sql';
  const library = path.join(root, 'sqlcl/lib/dbtools-apex.jar');
  if (identifiable) {
    await mkdir(path.dirname(executable), { recursive: true });
    await mkdir(path.dirname(library), { recursive: true });
    await writeFile(executable, 'fixture launcher, never executable');
    await writeFile(library, 'fixture library, never executable');
  }
  const oracle = new OracleAdapter(runner);
  oracle.stage = async () => root;
  oracle.settings = async () => ({
    executable,
    javaHome: '/fixture/java',
    schemaVersion: 1,
    mode: 'cli',
    mcpRestrictLevel: '4',
  });
  return { oracle, executable, library };
}

test('target verification uses one live read-only session and preserves the existing result shape', async () => {
  const calls: ProcessRequest[] = [];
  const { oracle } = await adapter(async (request) => {
    calls.push(request);
    return result(JSON.stringify({ results: [{ items: rows() }] }));
  });
  assert.deepEqual(await oracle.verifyTarget(target, connection), {
    identity: { db_unique_name: 'DB', service_name: 'SERVICE', parsing_schema: 'FIXTURE' },
    workspace: { workspace_id: 123, workspace: 'FIXTURE' },
    application: { application_id: 1001, alias: 'fixture', owner: 'FIXTURE', workspace: 'FIXTURE' },
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.input!, /union all/);
  assert.match(calls[0]!.input!, /workspace = :p_workspace/);
  assert.match(calls[0]!.input!, /application_id = :p_app_id/);
  assert.doesNotMatch(calls[0]!.input!, /\b(?:insert|update|delete|merge|alter|create|drop)\b/i);
});

test('target identity is always refreshed, including immediately after a successful check', async () => {
  let calls = 0;
  const { oracle } = await adapter(async () => {
    const items = rows();
    if (calls++) items[0]!.db_unique_name = 'OTHER_DB';
    return result(JSON.stringify({ results: [{ items }] }));
  });
  await oracle.verifyTarget(target, connection);
  await assert.rejects(oracle.verifyTarget(target, connection), { code: 'TARGET_MISMATCH' });
  assert.equal(calls, 2);
});

test('batched target verification keeps identity, workspace and application failure boundaries', async () => {
  for (const [items, code] of [
    [rows().slice(1), 'IDENTITY_UNCONFIRMED'],
    [rows().filter((r) => r.target_record !== 'workspace'), 'WORKSPACE_UNCONFIRMED'],
    [[...rows(), rows()[1]!], 'WORKSPACE_UNCONFIRMED'],
    [[...rows(), rows()[2]!], 'APPLICATION_TARGET_MISMATCH'],
    [
      rows().map((r) => (r.target_record === 'application' ? { ...r, owner: 'OTHER' } : r)),
      'APPLICATION_TARGET_MISMATCH',
    ],
    [
      rows().map((r) => (r.target_record === 'application' ? { ...r, workspace: 'OTHER' } : r)),
      'APPLICATION_TARGET_MISMATCH',
    ],
  ] as const) {
    const { oracle } = await adapter(async () => result(JSON.stringify({ results: [{ items }] })));
    await assert.rejects(oracle.verifyTarget(target, connection), { code });
  }
  const { oracle } = await adapter(async () =>
    result(JSON.stringify({ results: [{ items: rows().filter((r) => r.target_record !== 'application') }] })),
  );
  assert.equal((await oracle.verifyTarget(target, connection)).application, null);
});

test('one capability probe per installation per process; a replaced launcher re-probes version and help', async () => {
  const calls: ProcessRequest[] = [];
  let version = 'SQLcl: Release 26.1.2';
  const { oracle, executable } = await adapter(async (request) => {
    calls.push(request);
    return result(request.args[0] === '-version' ? version : 'apex generate export validate import');
  });
  const first = await oracle.requireCapability('validate');
  assert.deepEqual(await oracle.requireCapability('import'), first);
  assert.equal(calls.filter((r) => r.args[0] === '-version').length, 1);
  assert.equal(calls.filter((r) => r.input?.includes('help apex')).length, 1);
  // A second adapter in the same process (one per dispatch) shares the answer.
  const sibling = new OracleAdapter(async (request) => {
    calls.push(request);
    return result('unexpected');
  });
  sibling.settings = oracle.settings;
  assert.deepEqual(await sibling.requireCapability('import'), first);
  assert.equal(calls.length, 2);
  version = 'SQLcl: Release 26.2.0';
  await writeFile(executable, 'replaced fixture launcher with a different size');
  assert.notEqual((await oracle.requireCapability('import')).version, first.version);
  assert.equal(calls.filter((r) => r.args[0] === '-version').length, 2);
  assert.equal(calls.filter((r) => r.input?.includes('help apex')).length, 2);
});

test('replacing SQLcl libraries invalidates cached help even when the reported version is unchanged', async () => {
  let help = 'apex generate export validate import';
  let probes = 0;
  const { oracle, library } = await adapter(async (request) => {
    if (request.args[0] === '-version') return result('SQLcl: Release 26.1.2');
    probes++;
    return result(help);
  });
  await oracle.requireCapability('import');
  await writeFile(library, 'replaced fixture dependency');
  help = 'apex generate export validate';
  await assert.rejects(oracle.requireCapability('import'), { code: 'UNSUPPORTED_CAPABILITY' });
  assert.equal(probes, 2);
});

test('SQLcl 26.3 lib/ext compiler replacement invalidates the capability cache', async () => {
  let help = 'apex generate export validate import',
    probes = 0;
  const { oracle, library } = await adapter(async (request) => {
    if (request.args[0] === '-version') return result('SQLcl: Release 26.3.0');
    probes++;
    return result(help);
  });
  const compiler = path.join(path.dirname(library), 'ext/apexlang-compiler.jar');
  await mkdir(path.dirname(compiler), { recursive: true });
  await writeFile(compiler, 'original compiler');
  await oracle.requireCapability('import');
  await writeFile(compiler, 'replaced compiler with changed help');
  help = 'apex generate export validate';
  await assert.rejects(oracle.requireCapability('import'), { code: 'UNSUPPORTED_CAPABILITY' });
  assert.equal(probes, 2);
});

test('concurrent capability checks share one probe and evict a failed shared probe', async () => {
  let versions = 0;
  let helps = 0;
  let fail = true;
  const { oracle } = await adapter(async (request) => {
    if (request.args[0] === '-version') {
      versions++;
      return result('SQLcl: fixture');
    }
    helps++;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return result(fail ? 'SQLCL-12345 fixture failure' : 'apex generate export validate import');
  });
  const failures = await Promise.allSettled([
    oracle.requireCapability('validate'),
    oracle.requireCapability('export'),
    oracle.requireCapability('import'),
  ]);
  assert.ok(failures.every((r) => r.status === 'rejected'));
  assert.equal(versions, 1);
  assert.equal(helps, 1);
  fail = false;
  await Promise.all([oracle.requireCapability('validate'), oracle.requireCapability('export')]);
  assert.equal(versions, 2);
  assert.equal(helps, 2);
});

test('a cancelled caller never cancels the shared probe of another caller', async () => {
  const one = new AbortController();
  const two = new AbortController();
  const helpSignals: (AbortSignal | undefined)[] = [];
  const { oracle } = await adapter(async (request) => {
    if (request.args[0] === '-version') return result('SQLcl: fixture');
    helpSignals.push(request.signal);
    await new Promise((resolve) => setTimeout(resolve, 60));
    return result('apex validate');
  });
  const first = oracle.requireCapability('validate', one.signal);
  const second = oracle.requireCapability('validate', two.signal);
  setTimeout(() => one.abort(), 10);
  await assert.rejects(first, { code: 'CANCELLED', status: 'cancelled' });
  await second;
  assert.deepEqual(helpSignals, [undefined]);
  await oracle.requireCapability('validate');
  assert.equal(helpSignals.length, 1);
});

test('unidentified SQLcl layouts do not reuse help and unsuccessful probes never populate the cache', async () => {
  let probes = 0;
  const { oracle } = await adapter(async (request) => {
    if (request.args[0] === '-version') return result('SQLcl: fixture');
    probes++;
    return result('apex generate export validate import');
  }, false);
  await oracle.requireCapability('validate');
  await oracle.requireCapability('validate');
  assert.equal(probes, 2);
  let fail = true;
  const { oracle: retry } = await adapter(async (request) => {
    if (request.args[0] === '-version') return result('SQLcl: fixture');
    return result(fail ? 'SQLCL-12345 fixture failure' : 'apex validate');
  });
  await assert.rejects(retry.requireCapability('validate'), { code: 'ORACLE_COMMAND_FAILED' });
  fail = false;
  await retry.requireCapability('validate');
});

test('a warm capability cache still honours cancellation and a failed probe after the launcher changes', async () => {
  const controller = new AbortController();
  let failVersion = false;
  const { oracle, executable } = await adapter(async (request) =>
    result(
      request.args[0] === '-version'
        ? failVersion
          ? 'SQLCL-12345 fixture version failure'
          : 'SQLcl: fixture'
        : 'apex generate export validate import',
    ),
  );
  await oracle.requireCapability('validate');
  controller.abort();
  await assert.rejects(oracle.requireCapability('validate', controller.signal), { code: 'CANCELLED' });
  failVersion = true;
  await writeFile(executable, 'replaced fixture launcher with a different size');
  await assert.rejects(oracle.requireCapability('validate'), { code: 'ORACLE_COMMAND_FAILED' });
  failVersion = false;
  await oracle.requireCapability('validate');
});

test('successful JSON rows may contain historical Oracle errors without changing their data', async () => {
  const items = [
    { error_message: 'ORA-06512: previous page error\nORA-01017 historic authentication error' },
  ];
  const { oracle } = await adapter(async () => result(JSON.stringify({ results: [{ items }] })));
  assert.deepEqual(
    await oracle.jsonQuery('select error_message from apex_workspace_activity_log', connection),
    items,
  );
});

test('JSON row handling never hides SQLcl errors, stderr, failed exits or envelope errors', async () => {
  const json = JSON.stringify({ results: [{ items: [{ error_message: 'ORA-06512 old error' }] }] });
  for (const [processResult, code] of [
    [result(json, { stderr: 'ORA-01031: insufficient privileges' }), 'DB_PRIVILEGE'],
    [result('ORA-01017: invalid username\n' + json), 'AUTHENTICATION_FAILED'],
    [result(json + '\nORA-20000: query failed'), 'ORACLE_COMMAND_FAILED'],
    [result(json, { code: 1 }), 'ORACLE_COMMAND_FAILED'],
    [
      result(JSON.stringify({ results: [{ items: [], errorDetails: 'ORA-20000: query failed' }] })),
      'ORACLE_COMMAND_FAILED',
    ],
    [
      result(JSON.stringify({ results: [{ errorDetails: 'ORA-01031: insufficient privileges' }] })),
      'DB_PRIVILEGE',
    ],
    [result('{ malformed JSON ORA-20000: query failed'), 'ORACLE_COMMAND_FAILED'],
    [result(json, { timedOut: true }), 'TIMEOUT'],
    [result(json, { cancelled: true }), 'CANCELLED'],
    [result(json, { truncated: true }), 'OUTPUT_LIMIT'],
  ] as const) {
    const { oracle } = await adapter(async () => processResult);
    await assert.rejects(oracle.jsonQuery('select 1 from dual', connection), { code });
  }
});
