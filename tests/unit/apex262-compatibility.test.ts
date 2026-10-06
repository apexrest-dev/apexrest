import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import {
  databaseMeetsApex262Minimum,
  evaluatePartialImportCompatibility,
  sourceMmdVersion,
} from '../../packages/core/src/compatibility.ts';
import { auditUpgradeSource, parseCodeScan } from '../../packages/core/src/upgrade-audit.ts';
import type { ProjectContext, Environment } from '../../packages/core/src/config.ts';

test('APEX 26.2 minimum database releases reject older RU and unknown version values', () => {
  for (const version of ['19.18.0.0.0', '21.3.0.0.0', '23.26.0.0.0', '23.26.3.0.0'])
    assert.equal(databaseMeetsApex262Minimum(version), true, version);
  for (const version of ['19.17.0.0.0', '18.0.0.0.0', '23.25.0.0.0', '', 'unknown'])
    assert.equal(databaseMeetsApex262Minimum(version), false, version);
});

const tuple = {
  compilerVersion: 'SQLcl: Release 26.3.0.0 Production Build: 26.3.0.260.1620',
  mmdVersion: '26.2.0+3479',
  apexVersion: '26.2.0',
  databaseVersion: '23.26.3.0.0',
  importFiles: true,
  mode: 'cli' as const,
  databaseTransport: 'direct' as const,
  helpHash: 'help',
};
test('partial import requires the actual supported tuple and explicit -files capability', () => {
  assert.equal(evaluatePartialImportCompatibility(tuple).supported, true);
  for (const changed of [
    { mmdVersion: '26.1.0+3102' },
    { mmdVersion: null },
    { apexVersion: '26.1.4' },
    { apexVersion: '27.1.0' },
    { compilerVersion: 'SQLcl Release 26.1.2' },
    { importFiles: false },
    { mode: 'mcp' as const },
    { databaseTransport: 'ords' as const },
  ])
    assert.equal(evaluatePartialImportCompatibility({ ...tuple, ...changed }).supported, false);
});

test('target version discovery is read-only and fails on absent or ambiguous results', async () => {
  const oracle = new OracleAdapter();
  oracle.jsonQuery = async (sql) => {
    assert.match(sql, /product like 'Oracle%Database%'/);
    assert.doesNotMatch(sql, /\b(?:insert|update|delete|alter|create|drop)\b/i);
    return [{ apex_version: '26.2.0', database_version: '23.26.3.0.0' }];
  };
  assert.deepEqual(await oracle.targetVersions({ kind: 'sqlcl-store', name: 'fixture' }), {
    apexVersion: '26.2.0',
    databaseVersion: '23.26.3.0.0',
  });
  oracle.jsonQuery = async () => [];
  await assert.rejects(oracle.targetVersions({ kind: 'sqlcl-store', name: 'fixture' }), {
    code: 'TARGET_VERSION_UNCONFIRMED',
  });
  oracle.jsonQuery = async () => [{ apex_version: '26.2.0', database_version: null }];
  await assert.rejects(oracle.targetVersions({ kind: 'sqlcl-store', name: 'fixture' }), {
    code: 'TARGET_VERSION_UNCONFIRMED',
  });
});

test('application metadata accepts omitted NULLs only with explicit database null evidence', async () => {
  const oracle = new OracleAdapter();
  const env = { applicationId: 92620, workspace: 'TEST', parsingSchema: 'TEST' } as Environment;
  oracle.jsonQuery = async () => [{ last_updated_on_is_null: 'Y', last_updated_by_is_null: 'Y' }];
  assert.deepEqual(await oracle.applicationMetadata(env, { kind: 'sqlcl-store', name: 'fixture' }), {
    lastUpdatedOn: null,
    lastUpdatedBy: null,
  });
  oracle.jsonQuery = async () => [{}];
  await assert.rejects(oracle.applicationMetadata(env, { kind: 'sqlcl-store', name: 'fixture' }), {
    code: 'SYNC_METADATA_UNCONFIRMED',
  });
});

test('selected-file import stays rooted in frozen source and rejects unbounded selections and transports', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-262-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'pages'));
  await mkdir(path.join(root, '.apex'));
  await writeFile(path.join(root, 'pages/p00001.apx'), 'page test {}');
  await writeFile(path.join(root, '.apex/apexlang.json'), JSON.stringify({ mmdVersion: tuple.mmdVersion }));
  assert.equal(await sourceMmdVersion(root), tuple.mmdVersion);
  const oracle = new OracleAdapter();
  oracle.requireCapability = async () => ({ version: tuple.compilerVersion, helpHash: 'help' });
  oracle.settings = async () => ({
    schemaVersion: 1,
    executable: 'sql',
    javaHome: undefined,
    mode: 'cli',
    mcpRestrictLevel: '4',
    databaseTransport: 'direct',
  });
  oracle.nativeDeployment = async () => path.join(root, 'deployment.json');
  oracle.discardStage = async () => {};
  const calls: {
    input: string;
    cwd: string | undefined;
    mutation: boolean;
    restriction: string | undefined;
  }[] = [];
  oracle.session = async (input, _connection, mutation = false, _signal, cwd, _format, restriction) => {
    calls.push({ input, cwd, mutation, restriction });
    const output = input === 'help apex import' ? ' -files|-fi <files>' : 'Import successful';
    return {
      code: 0,
      stdout: output,
      stderr: '',
      output,
      timedOut: false,
      cancelled: false,
      truncated: false,
      work: root,
    };
  };
  const ctx = { root, config: { application: { alias: 'test' } } } as ProjectContext;
  const env = { applicationId: 92620, workspace: 'TEST', parsingSchema: 'TEST' } as Environment;
  await oracle.importApplication(ctx, env, { kind: 'sqlcl-store', name: 'fixture' }, root, undefined, [
    'pages/p00001.apx',
  ]);
  // SQLcl tokens always use forward slashes, including on Windows.
  const sqlclRoot = root.replaceAll('\\', '/');
  assert.deepEqual(calls.at(-1), {
    input: `apex import -input "${sqlclRoot}" -deployment "${sqlclRoot}/deployment.json" -workspace "TEST" -schema "TEST" -id 92620 -files "pages/p00001.apx"`,
    cwd: root,
    mutation: true,
    restriction: '2',
  });
  for (const files of [
    [],
    ['pages/*.apx'],
    ['../x.apx'],
    ['pages/p00001.apx', 'pages/p00001.apx'],
    ['/tmp/x.apx'],
    ['pages/missing.apx'],
  ])
    await assert.rejects(
      oracle.importApplication(ctx, env, { kind: 'sqlcl-store', name: 'fixture' }, root, undefined, files),
      {
        code: 'PARTIAL_IMPORT_FILES_INVALID',
      },
    );
  await symlink(path.join(root, 'pages/p00001.apx'), path.join(root, 'pages/alias.apx'));
  await assert.rejects(
    oracle.importApplication(ctx, env, { kind: 'sqlcl-store', name: 'fixture' }, root, undefined, [
      'pages/alias.apx',
    ]),
    { code: 'PARTIAL_IMPORT_FILES_INVALID' },
  );
  oracle.settings = async () => ({
    schemaVersion: 1,
    executable: 'sql',
    javaHome: undefined,
    mode: 'cli',
    mcpRestrictLevel: '4',
    databaseTransport: 'ords',
  });
  await assert.rejects(
    oracle.importApplication(ctx, env, { kind: 'sqlcl-store', name: 'fixture' }, root, undefined, [
      'pages/p00001.apx',
    ]),
    { code: 'PARTIAL_IMPORT_TRANSPORT_UNSUPPORTED' },
  );
  assert.equal(calls.filter((call) => call.mutation).length, 1);
});

test('CodeScan parser preserves advisory locations and rejects malformed or external report paths', () => {
  const report = [
    {
      file: '/source/application.apx',
      issues: [{ line: 0, col: 0, ruleNo: 'APEX-002', msg: 'Review authentication.' }],
    },
  ];
  assert.deepEqual(parseCodeScan('16 files, 1 warning\n' + JSON.stringify(report), '/source'), [
    {
      code: 'APEX-002',
      file: 'application.apx',
      line: 0,
      column: 0,
      message: 'Review authentication.',
      severity: 'warning',
    },
  ]);
  assert.throws(() => parseCodeScan('no report', '/source'));
  assert.throws(() => parseCodeScan(JSON.stringify([{ ...report[0], file: '/outside.apx' }]), '/source'));
});

test('upgrade source audit reports bounded text hints without editing source', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-audit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    path.join(root, 'logic.sql'),
    'declare r apex_ai.t_chat_response;\nbegin r.tool_calls := null; end;',
  );
  await writeFile(path.join(root, 'large.apx'), 'x'.repeat(1024 * 1024 + 1));
  await writeFile(path.join(root, 'client.js'), 'apex.message.showErrors([]);');
  await symlink(path.join(root, 'logic.sql'), path.join(root, 'linked.sql'));
  const audit = await auditUpgradeSource(root);
  assert.equal(audit.status, 'advisory');
  assert.equal(audit.scannedFiles, 2);
  assert.deepEqual(audit.skipped.sort(), ['large.apx', 'linked.sql']);
  assert.deepEqual(
    audit.findings.map((f) => f.code),
    ['APEX262_AI_TOOL_CALLS', 'APEX262_AI_MESSAGE'],
  );
});
