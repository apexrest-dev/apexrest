import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import { checkEntityBinding, type EntityCheckDependencies } from '../../packages/core/src/entity-check.ts';
import { loadEntity } from '../../packages/core/src/entities.ts';
import type { Environment } from '../../packages/core/src/config.ts';
import type { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { Fault } from '../../packages/core/src/result.ts';

const CONTRACT = {
  schemaVersion: 1,
  id: 'customer',
  label: 'Customer',
  pluralLabel: 'Customers',
  read: { table: 'CUSTOMERS' },
  key: ['ID'],
  fields: {
    ID: { type: 'number', label: 'ID', required: true, readOnly: true },
    NAME: { type: 'varchar2', label: 'Name', required: true, maxLength: 100 },
    STATUS: { type: 'varchar2', label: 'Status', lov: { shared: 'STATUS' } },
    ROW_VERSION: { type: 'number', label: 'Version', readOnly: true },
  },
  authorization: { read: { scheme: 'crm-reader' }, write: { scheme: 'crm-editor' } },
  write: { table: 'CUSTOMERS', operations: ['update'], lostUpdate: { rowVersion: 'ROW_VERSION' } },
};
const env = { parsingSchema: 'CRM', workspace: 'CRM_WS', applicationId: 100 } as Environment;
const COLUMNS = [
  { column_name: 'ID', data_type: 'NUMBER', data_length: 22, nullable: 'N' },
  { column_name: 'NAME', data_type: 'VARCHAR2', data_length: 100, char_length: 100, nullable: 'N' },
  { column_name: 'STATUS', data_type: 'VARCHAR2', data_length: 1, char_length: 1, nullable: 'Y' },
  { column_name: 'ROW_VERSION', data_type: 'NUMBER', data_length: 22, nullable: 'N' },
];
const PRIMARY = [{ constraint_type: 'P', column_name: 'ID', position: 1 }];

/** A local adapter: answers metadata queries from fixtures and records them; not Oracle behavior. */
function oracle(
  columns: Record<string, unknown>[] = COLUMNS,
  constraints: Record<string, unknown>[] = PRIMARY,
  identityOk = true,
) {
  const calls: { sql: string; name?: string }[] = [];
  const adapter = {
    async verifyTarget() {
      if (!identityOk) throw new Fault('TARGET_MISMATCH', 'The target is not the configured application.', 4);
    },
    async jsonQueryBatch(queries: { sql: string; bindings?: Record<string, string | number> }[]) {
      return queries.map((query) => {
        calls.push({ sql: query.sql, name: String(query.bindings?.p_name ?? '') });
        if (/all_tab_columns/u.test(query.sql))
          return columns.slice(
            Number(query.bindings!.p_offset),
            Number(query.bindings!.p_offset) + Number(query.bindings!.p_limit),
          );
        if (/all_cons_columns/u.test(query.sql)) return constraints;
        return [{ workspace: 'CRM_WS' }];
      });
    },
  };
  return { adapter: adapter as unknown as OracleAdapter, calls };
}

async function project(t: test.TestContext, contract: object = CONTRACT) {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  await mkdir(path.join(ctx.root, 'entities'), { recursive: true });
  await writeFile(path.join(ctx.root, 'entities/customer.json'), JSON.stringify(contract));
  return ctx;
}
const deps = (adapter: OracleAdapter, lovs = ['STATUS']): EntityCheckDependencies => ({
  oracle: adapter,
  environment: () => env,
  connection: async () => ({ kind: 'sqlcl-store', name: 'crm' }) as never,
  lovExists: async (key) => lovs.includes(key.toUpperCase()),
});

test('offline validation makes no database call and lists what it cannot verify', async (t) => {
  const ctx = await project(t);
  const { adapter, calls } = oracle();
  const result = await checkEntityBinding(ctx, { entity: 'customer' }, deps(adapter, []));
  assert.equal(result.mode, 'offline');
  assert.equal(calls.length, 0);
  assert.equal(result.verified, false);
  assert.deepEqual(
    result.diagnostics.map((d) => d.code),
    ['ENTITY_LOV_MISSING'],
  );
  assert.ok(result.assumptions.some((a) => /CUSTOMERS exists/u.test(a)));
  assert.ok(result.assumptions.some((a) => /crm-editor/u.test(a)));
});

test('connected validation reads each table once, verifies the target and binds digest and target', async (t) => {
  const ctx = await project(t);
  const { adapter, calls } = oracle();
  const result = await checkEntityBinding(ctx, { entity: 'customer', env: 'dev' }, deps(adapter));
  assert.equal(result.mode, 'connected');
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.verified, true);
  assert.equal(result.digest, (await loadEntity(ctx, 'customer')).digest);
  assert.deepEqual(result.target, { env: 'dev', workspace: 'CRM_WS', applicationId: 100, schema: 'CRM' });
  // CUSTOMERS is both the read and the write table: one columns and one constraints read.
  const reads = calls.filter((call) => call.name === 'CUSTOMERS');
  assert.equal(reads.length, 2);
  // A target that is not the configured application yields no result.
  await assert.rejects(
    checkEntityBinding(
      ctx,
      { entity: 'customer', env: 'dev' },
      deps(oracle(COLUMNS, PRIMARY, false).adapter),
    ),
    {
      code: 'TARGET_MISMATCH',
    },
  );
});

test('schema drift is diagnosed without rewriting the reviewed contract', async (t) => {
  const ctx = await project(t);
  const drifted = [
    { column_name: 'ID', data_type: 'VARCHAR2', data_length: 36, char_length: 36, nullable: 'N' },
    { column_name: 'NAME', data_type: 'VARCHAR2', data_length: 50, char_length: 50, nullable: 'N' },
    { column_name: 'ROW_VERSION', data_type: 'NUMBER', data_length: 22, nullable: 'N' },
  ];
  const { adapter } = oracle(drifted, [{ constraint_type: 'P', column_name: 'NAME', position: 1 }]);
  const before = await loadEntity(ctx, 'customer');
  const result = await checkEntityBinding(ctx, { entity: 'customer', env: 'dev' }, deps(adapter));
  assert.equal(result.verified, false);
  assert.deepEqual(result.diagnostics.map((d) => d.code).sort(), [
    'ENTITY_COLUMN_MISSING',
    'ENTITY_KEY_CHANGED',
    'ENTITY_LENGTH_CHANGED',
    'ENTITY_TYPE_CHANGED',
  ]);
  assert.equal((await loadEntity(ctx, 'customer')).digest, before.digest);
  const missing = await checkEntityBinding(
    ctx,
    { entity: 'customer', env: 'dev' },
    deps(oracle([], []).adapter),
  );
  assert.deepEqual(
    missing.diagnostics.map((d) => d.code),
    ['ENTITY_TABLE_MISSING'],
  );
});

test('a contract changed since review is refused; long column lists are paginated', async (t) => {
  const ctx = await project(t);
  const reviewed = (await loadEntity(ctx, 'customer')).digest;
  await writeFile(
    path.join(ctx.root, 'entities/customer.json'),
    JSON.stringify({ ...CONTRACT, label: 'Client' }),
  );
  await assert.rejects(
    checkEntityBinding(
      ctx,
      { entity: 'customer', env: 'dev', expectedDigest: reviewed },
      deps(oracle().adapter),
    ),
    { code: 'TRANSFORM_CONFLICT' },
  );
  const many = [
    ...COLUMNS,
    ...Array.from({ length: 150 }, (_, i) => ({
      column_name: `EXTRA_${i}`,
      data_type: 'NUMBER',
      nullable: 'Y',
    })),
  ];
  const { adapter, calls } = oracle(many);
  const result = await checkEntityBinding(ctx, { entity: 'customer', env: 'dev' }, deps(adapter));
  assert.deepEqual(result.diagnostics, []);
  assert.equal(calls.filter((call) => /all_tab_columns/u.test(call.sql)).length, 2);
});
