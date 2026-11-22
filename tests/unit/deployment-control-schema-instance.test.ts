import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, utimes, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalDeploymentControl } from '../../packages/core/src/deployment-control.ts';
import type { Environment } from '../../packages/core/src/config.ts';

const env = {
  databaseIdentity: { dbUniqueName: 'FREE', serviceName: 'freepdb1' },
  parsingSchema: 'APEXREST_262_TEST',
} as Environment;
const history = [
  {
    version: '0001__customers.sql',
    checksum: 'deb7676676dc52c59e8e7195616197586ea49830f9cca7a0a8ab2eda4b67e800',
    status: 'succeeded',
    run_id: 'old-run',
  },
];

async function home(t: import('node:test').TestContext) {
  const previous = process.env.APEXREST_HOME;
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-control-'));
  process.env.APEXREST_HOME = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = previous;
    await rm(root, { recursive: true, force: true });
  });
  const control = new LocalDeploymentControl(env);
  return { root, control };
}

async function seed(control: LocalDeploymentControl, writtenAt: Date) {
  await mkdir(control.directory, { recursive: true });
  await writeFile(control.file('history.json'), JSON.stringify(history));
  await writeFile(
    control.file('packages.json'),
    JSON.stringify({ 'crm:src/database/packages/0010__api.sql': history[0]!.checksum }),
  );
  for (const name of ['history.json', 'packages.json'])
    await utimes(control.file(name), writtenAt, writtenAt);
}

test('a schema created after the local history was written does not inherit its migrations', async (t) => {
  const { control } = await home(t);
  await seed(control, new Date('2026-11-04T10:00:00Z'));
  const result = await control.reconcileSchemaInstance('2026-11-22T15:02:00Z');
  assert.ok(result.archived?.includes('archived-schema-unrecorded-'));
  assert.deepEqual(await control.history(), []);
  assert.deepEqual(await control.packages('crm'), {});
  // Nothing is deleted: the earlier history is kept aside for inspection.
  assert.deepEqual(JSON.parse(await readFile(path.join(result.archived!, 'history.json'), 'utf8')), history);
  assert.deepEqual(JSON.parse(await readFile(control.file('schema-instance.json'), 'utf8')), {
    created: '2026-11-22T15:02:00Z',
  });
  assert.deepEqual(await control.reconcileSchemaInstance('2026-11-22T15:02:00Z'), {});
});

test('an existing store is adopted when its schema is older than its history', async (t) => {
  const { control } = await home(t);
  await seed(control, new Date('2026-11-20T10:00:00Z'));
  assert.deepEqual(await control.reconcileSchemaInstance('2026-11-04T09:00:00Z'), {});
  assert.equal((await control.history()).length, 1);
  // Once recorded, any other creation time is a different schema instance.
  const result = await control.reconcileSchemaInstance('2026-11-21T08:00:00Z');
  assert.ok(result.archived?.includes('archived-schema-20261104T090000Z-'));
  assert.deepEqual(await control.history(), []);
});

test('a recreated schema with an active deployment owner needs reconciliation first', async (t) => {
  const { control } = await home(t);
  await seed(control, new Date('2026-11-04T10:00:00Z'));
  const owner = (createdAt: string) =>
    writeFile(
      control.file('active.json'),
      JSON.stringify({ runId: 'new-run', pid: 1, hostname: 'h', phase: 'writing', createdAt }),
    );
  // The run started before the schema was created again: it belongs to the old schema.
  await owner('2026-11-22T15:00:00.000Z');
  await assert.rejects(control.reconcileSchemaInstance('2026-11-22T15:02:00Z'), {
    code: 'CONTROL_SCHEMA_RECREATED',
  });
  assert.equal((await control.history()).length, 1);
  // A run that started on the new schema keeps its own rows; the old schema's rows move aside.
  await owner('2026-11-22T15:03:20.000Z');
  const mine = { ...history[0]!, version: '0002__more.sql', status: 'started', run_id: 'new-run' };
  await writeFile(control.file('history.json'), JSON.stringify([...history, mine]));
  await utimes(
    control.file('history.json'),
    new Date('2026-11-04T10:00:00Z'),
    new Date('2026-11-04T10:00:00Z'),
  );
  const result = await control.reconcileSchemaInstance('2026-11-22T15:02:00Z');
  assert.ok(result.archived);
  assert.deepEqual(await control.history(), [mine]);
});

test('reads of a target without local history create no control store', async (t) => {
  const { root, control } = await home(t);
  assert.deepEqual(await control.reconcileSchemaInstance('2026-11-22T15:02:00Z'), {});
  assert.deepEqual(await readdir(root), []);
});
