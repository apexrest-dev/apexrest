import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { canonical, hash, inventory } from '../../packages/core/src/fs.ts';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import type { Environment } from '../../packages/core/src/config.ts';

const connection = { kind: 'sqlcl-store' as const, name: 'fixture' };
const env = {
  applicationId: 123,
  workspace: 'TEST',
  parsingSchema: 'TEST',
  databaseIdentity: { dbUniqueName: 'TEST', serviceName: 'TEST' },
} as Environment;
test('native selected export emits only requested sources and does not require an application scaffold', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-selected-export-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const oracle = new OracleAdapter();
  let stages = 0;
  let emittedPages = ['p00050-oracle-current-alias.apx'];
  oracle.stage = async () => {
    const stage = path.join(root, 'stage-' + ++stages);
    await mkdir(stage);
    return stage;
  };
  oracle.settings = async () => ({
    schemaVersion: 1,
    executable: 'sql',
    javaHome: undefined,
    mode: 'cli',
    mcpRestrictLevel: '4',
    databaseTransport: 'direct',
  });
  oracle.requireCapability = async () => ({ version: 'fixture', helpHash: 'fixture' });
  oracle.jsonQuery = async () => {
    throw new Error('Existing page requires no separate collision query');
  };
  oracle.session = async (input, _connection, mutation, _signal, stage) => {
    assert.equal(mutation, false);
    assert.match(input, /-exptype APEXLANG/);
    assert.match(input, /-expComponents "PAGE:50"/);
    assert.doesNotMatch(input, /-exptype SQL/);
    await mkdir(path.join(stage!, 'fixture/pages'), { recursive: true });
    for (const file of emittedPages)
      await writeFile(path.join(stage!, 'fixture/pages', file), 'page 50 (\n)\n');
    return {
      output: 'fixture',
      stdout: 'fixture',
      stderr: '',
      code: 0,
      work: stage!,
      timedOut: false,
      cancelled: false,
      truncated: false,
    };
  };
  const result = await oracle.exportSelection(env, connection, ['pages/p00050-dashboard.apx'], root, {
    'pages/p00050-dashboard.apx': 'known',
  });
  assert.deepEqual(Object.keys(result.files), ['pages/p00050-dashboard.apx']);
  for (const pages of [['p00051-unselected.apx'], ['p00050-first.apx', 'p00050-duplicate.apx']]) {
    emittedPages = pages;
    await assert.rejects(
      oracle.exportSelection(env, connection, ['pages/p00050-dashboard.apx'], root, {
        'pages/p00050-dashboard.apx': 'known',
      }),
      { code: 'PARTIAL_EXPORT_SCOPE_FAILED' },
    );
  }
  await assert.rejects(oracle.exportSelection(env, connection, ['application.apx'], root), {
    code: 'PARTIAL_EXPORT_UNSUPPORTED',
  });
});

test('absent new page performs a read-only collision query and no native export', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-new-page-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const oracle = new OracleAdapter();
  oracle.stage = async () => {
    const stage = path.join(root, 'stage');
    await mkdir(stage);
    return stage;
  };
  oracle.settings = async () => ({
    schemaVersion: 1,
    executable: 'sql',
    javaHome: undefined,
    mode: 'cli',
    mcpRestrictLevel: '4',
    databaseTransport: 'direct',
  });
  oracle.requireCapability = async () => ({ version: 'fixture', helpHash: 'fixture' });
  oracle.jsonQuery = async (sql, _connection, bindings) => {
    assert.match(sql, /apex_application_pages/);
    assert.deepEqual(bindings, { p_app: 123 });
    return [];
  };
  oracle.session = async () => {
    throw new Error('Absent page must not export source');
  };
  const result = await oracle.exportSelection(env, connection, ['pages/p00050-dashboard.apx'], root);
  assert.deepEqual(result.files, {});
});

test('batched identity/version observation uses one live session and rejects wrong identity', async () => {
  const oracle = new OracleAdapter();
  let calls = 0;
  oracle.jsonQueryBatch = async (queries) => {
    calls++;
    assert.equal(queries.length, 2);
    return [
      [
        { target_record: 'identity', db_unique_name: 'TEST', service_name: 'TEST', parsing_schema: 'TEST' },
        { target_record: 'workspace', workspace_id: 1, workspace: 'TEST' },
        {
          target_record: 'application',
          application_id: 123,
          alias: 'test',
          owner: 'TEST',
          workspace: 'TEST',
        },
      ],
      [{ apex_version: '26.2.0', database_version: '23.26.0' }],
    ];
  };
  oracle.jsonQuery = async () => {
    throw new Error('Batch must not re-open a session');
  };
  const result = await oracle.versionedTarget(env, connection);
  assert.equal(result.versions.apexVersion, '26.2.0');
  assert.equal(calls, 1);
  await assert.rejects(oracle.versionedTarget({ ...env, parsingSchema: 'WRONG' }, connection), {
    code: 'TARGET_MISMATCH',
  });
});

test('explicit full APEXlang observation retains only selected shared components and never SQL', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-shared-export-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const oracle = new OracleAdapter();
  oracle.stage = () => mkdtemp(path.join(root, 'stage-'));
  oracle.settings = async () => ({
    schemaVersion: 1,
    executable: 'sql',
    javaHome: undefined,
    mode: 'cli',
    mcpRestrictLevel: '4',
    databaseTransport: 'direct',
  });
  oracle.requireCapability = async () => ({ version: 'fixture', helpHash: 'fixture' });
  const source = path.join(root, 'full-source');
  await mkdir(path.join(source, 'shared-components/lovs'), { recursive: true });
  await writeFile(path.join(source, 'application.apx'), 'application');
  const file = 'shared-components/lovs/status.apx';
  await writeFile(path.join(source, file), 'lov status ()');
  let fullReads = 0;
  oracle.exportApplication = async (_env, _connection, format) => {
    assert.equal(format, 'APEXLANG');
    fullReads++;
    const files = await inventory(source);
    return {
      directory: source,
      files,
      digest: hash(canonical(files)),
      format: 'APEXLANG',
      compiler: { version: 'fixture', helpHash: 'fixture' },
      output: 'fixture',
      stage: path.join(root, 'unused-full-stage'),
    };
  };
  const result = await oracle.exportSelection(env, connection, [file], root, {}, 'full');
  assert.deepEqual(Object.keys(result.files), [file]);
  assert.equal(fullReads, 1);
  await assert.rejects(oracle.exportSelection(env, connection, [file], root), {
    code: 'PARTIAL_EXPORT_UNSUPPORTED',
  });
  await assert.rejects(oracle.exportSelection(env, connection, ['application.apx'], root, {}, 'full'), {
    code: 'PARTIAL_EXPORT_UNSUPPORTED',
  });
});
