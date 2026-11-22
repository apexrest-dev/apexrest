import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import { storeSchemas } from '../../scripts/lib/schema-storage.mjs';

test('schema checks reject changed and missing contracts without rewriting them', async (t) => {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-schema-check-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const schemas = { 'composer-field': { type: 'array', uniqueItems: true } };
  await storeSchemas(schemas, { directory });
  assert.equal((await storeSchemas(schemas, { directory, check: true })).status, 'checked');
  const file = path.join(directory, 'composer-field.schema.json');
  const stale = '{"type":"array","uniqueItems":false}\n';
  await writeFile(file, stale);
  await assert.rejects(storeSchemas(schemas, { directory, check: true }), /Stale generated schemas/);
  assert.equal(await readFile(file, 'utf8'), stale);
  await storeSchemas(schemas, { directory });
  await assert.rejects(
    storeSchemas({ ...schemas, 'composer-shared-resource': {} }, { directory, check: true }),
    /composer-shared-resource/,
  );
  await assert.rejects(readFile(path.join(directory, 'composer-shared-resource.schema.json')), {
    code: 'ENOENT',
  });
  await assert.rejects(storeSchemas({ '../escape': {} }, { directory }), /contained lowercase/);
});

test('published Composer field schema rejects Oracle NULL, empty and duplicate enums', async () => {
  const schema = JSON.parse(await readFile('schemas/composer-field.schema.json', 'utf8'));
  const validate = new Ajv({ strict: false }).compile(schema);
  const field = { column: 'STATUS', type: 'string', nullable: false };
  for (const values of [[], [''], ['', 'ACTIVE'], ['ACTIVE', 'ACTIVE']])
    assert.equal(validate({ ...field, enum: values }), false, JSON.stringify(values));
  for (const nullable of [false, true])
    assert.equal(validate({ ...field, nullable, enum: ['ACTIVE', '<10', "O'Reilly"] }), true);
});

test('published Composer state declares optional shared resources and strict enum membership', async () => {
  const state = JSON.parse(await readFile('schemas/composer-state.schema.json', 'utf8'));
  const resource = JSON.parse(await readFile('schemas/composer-shared-resource.schema.json', 'utf8'));
  assert.ok(state.properties.sharedResources);
  assert.equal(state.required.includes('sharedResources'), false);
  const validate = new Ajv({ strict: false }).compile(resource.properties.values);
  assert.equal(validate(['ACTIVE', 'ACTIVE']), false);
  assert.equal(validate(['']), false);
  assert.equal(validate(['ACTIVE', 'INACTIVE']), true);
});

test('published blueprint schema accepts actual source inputs which omit runtime defaults', async () => {
  const schema = JSON.parse(await readFile('schemas/composer-blueprint.schema.json', 'utf8'));
  const source = JSON.parse(await readFile('tests/fixtures/composer/crm.blueprint.yaml', 'utf8'));
  const validate = new Ajv({ strict: false }).compile(schema);
  assert.equal(validate(source), true, JSON.stringify(validate.errors));
  assert.equal(source.contracts['project:save-customer'].parameters.P_CUSTOMER_ID.defaulted, undefined);
});
