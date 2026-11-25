import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import {
  canonical,
  checkEntity,
  entityContractSchema,
  listEntities,
  loadEntity,
} from '../../packages/core/src/entities.ts';

export const CUSTOMER = {
  schemaVersion: 1,
  id: 'customer',
  label: 'Customer',
  pluralLabel: 'Customers',
  read: { sql: 'select id, name, status, row_version from customers' },
  key: ['ID'],
  fields: {
    ID: { type: 'number', label: 'ID', required: true, readOnly: true },
    NAME: { type: 'varchar2', label: 'Name', required: true, maxLength: 100 },
    STATUS: { type: 'varchar2', label: 'Status', lov: { shared: 'STATUS' } },
    ROW_VERSION: { type: 'number', label: 'Version', readOnly: true },
  },
  authorization: { read: { scheme: 'crm-reader' }, write: { scheme: 'crm-editor' } },
  write: { table: 'CUSTOMERS', operations: ['insert', 'update'], lostUpdate: { rowVersion: 'ROW_VERSION' } },
  provenance: 'Reviewed with the CRM owner.',
};

async function project(t: test.TestContext, files: Record<string, unknown>) {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  await mkdir(path.join(ctx.root, 'entities'), { recursive: true });
  for (const [name, value] of Object.entries(files))
    await writeFile(
      path.join(ctx.root, 'entities', name),
      typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    );
  return ctx;
}

test('a contract has a stable id, schema version and content digest independent of key order and layout', async (t) => {
  const reordered = Object.fromEntries(Object.entries(CUSTOMER).reverse());
  const ctx = await project(t, { 'customer.json': CUSTOMER });
  const loaded = await loadEntity(ctx, 'customer');
  assert.equal(loaded.id, 'customer');
  assert.equal(loaded.schemaVersion, 1);
  assert.deepEqual(loaded.diagnostics, []);
  await writeFile(path.join(ctx.root, 'entities/customer.json'), JSON.stringify(reordered));
  assert.equal((await loadEntity(ctx, 'customer')).digest, loaded.digest);
  // Defaults are part of the reviewed content: an explicit default does not change the digest.
  assert.equal(canonical(entityContractSchema.parse(CUSTOMER)).includes('"required":false'), true);
  await writeFile(
    path.join(ctx.root, 'entities/customer.json'),
    JSON.stringify({
      ...CUSTOMER,
      fields: { ...CUSTOMER.fields, NAME: { ...CUSTOMER.fields.NAME, label: 'Full name' } },
    }),
  );
  assert.notEqual((await loadEntity(ctx, 'customer')).digest, loaded.digest);
});

test('security and write behavior are explicit and checked before any generation', () => {
  const parse = (value: unknown) => entityContractSchema.safeParse(value);
  // Read authorization is required: a named scheme or an explicit public read.
  assert.equal(parse({ ...CUSTOMER, authorization: {} }).success, false);
  assert.equal(
    parse({ ...CUSTOMER, authorization: { read: { public: true } }, write: undefined }).success,
    true,
  );
  const issues = (value: object) => checkEntity(entityContractSchema.parse(value)).map((d) => d.code);
  assert.deepEqual(issues({ ...CUSTOMER, authorization: { read: { scheme: 'crm-reader' } } }), [
    'ENTITY_WRITE_INCOMPLETE',
  ]);
  assert.deepEqual(
    issues({ ...CUSTOMER, write: { ...CUSTOMER.write, lostUpdate: { rowVersion: 'MISSING' } } }),
    ['ENTITY_WRITE_INCOMPLETE'],
  );
  assert.equal(parse({ ...CUSTOMER, write: { table: 'CUSTOMERS', operations: ['update'] } }).success, false);
  assert.deepEqual(
    issues({ ...CUSTOMER, fields: { ...CUSTOMER.fields, name: { type: 'varchar2', label: 'Dup' } } }),
    ['ENTITY_DUPLICATE_FIELD'],
  );
  assert.deepEqual(issues({ ...CUSTOMER, key: ['STATUS'] }), [
    'ENTITY_KEY_INVALID',
    'ENTITY_WRITE_INCOMPLETE',
  ]);
  assert.deepEqual(issues({ ...CUSTOMER, key: ['NOPE'] }), ['ENTITY_KEY_INVALID', 'ENTITY_WRITE_INCOMPLETE']);
  assert.deepEqual(
    issues({
      ...CUSTOMER,
      fields: {
        ...CUSTOMER.fields,
        CREATED: { type: 'date', label: 'Created', required: true, readOnly: true },
      },
    }),
    ['ENTITY_WRITE_INCOMPLETE'],
  );
  // SQL is opaque reviewed text; anything but a query is refused.
  assert.equal(parse({ ...CUSTOMER, read: { sql: 'delete from customers' } }).success, false);
  assert.equal(parse({ ...CUSTOMER, read: { sql: 'select 1 from dual\n```' } }).success, false);
});

test('the project lists contracts, their digests and diagnostics, and broken files with their fault', async (t) => {
  const ctx = await project(t, {
    'customer.json': CUSTOMER,
    'order.json': { ...CUSTOMER, id: 'order', key: ['STATUS'] },
    'broken.json': '{',
    'mismatch.json': { ...CUSTOMER, id: 'other' },
  });
  const { entities } = await listEntities(ctx);
  assert.deepEqual(
    entities.map((entity) => [entity.id, entity.diagnostics.map((d) => d.code)]),
    [
      ['broken', ['INVALID_INPUT']],
      ['customer', []],
      ['mismatch', ['ENTITY_INVALID']],
      ['order', ['ENTITY_KEY_INVALID', 'ENTITY_WRITE_INCOMPLETE']],
    ],
  );
  await assert.rejects(loadEntity(ctx, 'missing'), { code: 'TARGET_NOT_FOUND' });
  await assert.rejects(loadEntity(ctx, '../x'), { code: 'INVALID_INPUT' });
  const { dispatch } = await import('../../packages/core/src/service.ts');
  const listed = await dispatch('project', { project: ctx.root, action: 'entities' });
  assert.equal(listed.ok, true, JSON.stringify(listed.diagnostics));
});
