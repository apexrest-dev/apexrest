import test from 'node:test';
import assert from 'node:assert/strict';
import { OracleAdapter, targetIdentitySql } from '../../packages/core/src/oracle.ts';
import type { Environment } from '../../packages/core/src/config.ts';
import type { Connection } from '../../packages/core/src/connections.ts';
import { canonical, hash } from '../../packages/core/src/fs.ts';
import { failure } from '../../packages/core/src/result.ts';
const env = {
  workspace: 'TEST',
  parsingSchema: 'APP',
  applicationId: 123,
  databaseIdentity: { dbUniqueName: 'DB', serviceName: 'SERVICE' },
} as Environment;
const connection: Connection = { kind: 'sqlcl-store', name: 'fixture' };
const adapter = new OracleAdapter(async () => {
  throw new Error('No external process is allowed');
});
const rows = (id: unknown) => [
  { target_record: 'identity', db_unique_name: 'DB', service_name: 'SERVICE', parsing_schema: 'APP' },
  { target_record: 'workspace', workspace_id: id, workspace: 'TEST' },
  { target_record: 'application', application_id: 123, alias: 'fixture', owner: 'APP', workspace: 'TEST' },
];
const observe = (id: unknown) => adapter.verifyTarget(env, connection, rows(id));
test('shared SQLcl/ORDS JSON row boundary preserves exact decimal workspace identity', async () => {
  const exact = '10934068819404041';
  const queryAdapter = new OracleAdapter(async () => {
    throw new Error('No external process is allowed');
  });
  queryAdapter.settings = async () => ({
    executable: 'fixture',
    javaHome: undefined,
    schemaVersion: 1,
    mode: 'cli',
    mcpRestrictLevel: '4',
    databaseTransport: 'direct',
  });
  queryAdapter.session = async () =>
    ({
      output: JSON.stringify({ results: [{ items: rows(exact) }] }),
    }) as Awaited<ReturnType<OracleAdapter['session']>>;
  const target = await queryAdapter.verifyTarget(env, connection);
  assert.equal(target.workspace.workspace_id, exact);
  assert.equal(typeof target.workspace.workspace_id, 'string');
  assert.match(targetIdentitySql, /cast\(null as varchar2\(64\)\) workspace_id/i);
  assert.match(targetIdentitySql, /to_char\(workspace_id, 'TM9', 'NLS_NUMERIC_CHARACTERS=''\.,'''\)/);
});
test('fresh adjacent IDs stay distinct in canonical target/fingerprint identities', async () => {
  const left = await observe('10934068819404040'),
    right = await observe('10934068819404041');
  assert.notEqual(canonical(left), canonical(right));
  const fingerprint = (target: unknown) => hash(canonical({ target, history: [], exportDigest: null }));
  assert.notEqual(fingerprint(left), fingerprint(right));
  assert.equal(fingerprint(left), fingerprint(await observe('10934068819404040')));
});
test('safe legacy numeric observations normalize explicitly without mutating captured rows', async () => {
  for (const id of [0, 123, Number.MAX_SAFE_INTEGER]) {
    const captured = rows(id),
      original = JSON.stringify(captured);
    const observed = await adapter.verifyTarget(env, connection, captured);
    assert.equal(observed.workspace.workspace_id, String(id));
    assert.equal(JSON.stringify(captured), original);
  }
});
test('unsafe legacy numbers and malformed text fail closed without inferred IDs', async () => {
  for (const id of [
    Number.MAX_SAFE_INTEGER + 1,
    10934068819404040,
    NaN,
    Infinity,
    -1,
    1.5,
    null,
    undefined,
    '',
    ' 123',
    '+123',
    '00123',
    '1e16',
    '123.0',
    '9'.repeat(65),
  ]) {
    await assert.rejects(observe(id), { code: 'WORKSPACE_ID_UNCONFIRMED', status: 'blocked' });
  }
});
test('stored numeric plans keep different canonical bytes and fingerprints after fresh text observation', async () => {
  const fresh = await observe('123');
  const stored = { ...fresh, workspace: { ...fresh.workspace, workspace_id: 123 } };
  const original = JSON.stringify(stored);
  assert.notEqual(canonical(fresh), canonical(stored));
  assert.notEqual(
    hash(canonical({ target: fresh, history: [], exportDigest: null })),
    hash(canonical({ target: stored, history: [], exportDigest: null })),
  );
  assert.equal(JSON.stringify(stored), original);
});
test('precision refusal uses the existing result guidance without suggesting held-run bypass', async () => {
  try {
    await observe(Number.MAX_SAFE_INTEGER + 1);
    assert.fail('Unsafe numeric observation must be refused');
  } catch (error) {
    const result = failure('target.verify', error);
    assert.equal(result.status, 'blocked');
    assert.equal(result.diagnostics[0]?.code, 'WORKSPACE_ID_UNCONFIRMED');
    assert.ok(result.nextActions.some((action) => action.includes('mode:plan')));
    assert.ok(result.nextActions.some((action) => action.includes('clean sources')));
    assert.ok(result.nextActions.some((action) => action.includes('keep ownership')));
    assert.ok(result.nextActions.some((action) => action.includes('before retry, refresh or invalidate')));
  }
});
