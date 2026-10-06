import test from 'node:test';
import assert from 'node:assert/strict';
import { metadataRead } from '../../packages/core/src/metadata.ts';
import { apexCapabilitiesQuery } from '../../packages/core/src/apex-capabilities.ts';
import type { OracleAdapter } from '../../packages/core/src/oracle.ts';
import type { Environment } from '../../packages/core/src/config.ts';
import { Fault } from '../../packages/core/src/result.ts';

// These adapter fixtures establish read boundaries and reporting semantics, not Oracle evidence.
const env = { parsingSchema: 'FIXTURE', workspace: 'FIXTURE_WORKSPACE', applicationId: 1001 } as Environment;
const connection = { kind: 'sqlcl-store', name: 'fixture' } as const;
const request = { kind: 'apex-capabilities', schema: 'FIXTURE' };
function fixture() {
  let verified = 0;
  const calls: { sql: string; bindings: Record<string, string | number> }[] = [];
  let rows: Record<string, unknown>[] = [
    { capability: 'apex-version', status: 'observed', observed_value: '26.2.0' },
    { capability: 'dbms-cloud', status: 'not-observed', observed_value: 'DBMS_CLOUD' },
    { capability: 'deep-data-security-runtime', status: 'operator-verification-required' },
  ];
  const adapter = {
    async verifyTarget() {
      verified++;
    },
    async jsonQuery(sql: string, _connection: unknown, bindings: Record<string, string | number>) {
      calls.push({ sql, bindings });
      return rows;
    },
    async jsonQueryBatch(queries: { sql: string; bindings: Record<string, string | number> }[]) {
      calls.push(...queries);
      return queries.map(() => rows);
    },
  };
  return {
    adapter,
    calls,
    verified: () => verified,
    rows: (next: Record<string, unknown>[]) => {
      rows = next;
    },
    read: (value: unknown) => metadataRead(adapter as unknown as OracleAdapter, env, connection, value),
  };
}

test('APEX capability diagnostics use a fixed read-only package allowlist and do not infer readiness', () => {
  assert.match(apexCapabilitiesQuery, /from apex_release/);
  assert.match(apexCapabilitiesQuery, /from product_component_version/);
  assert.match(
    apexCapabilitiesQuery,
    /join all_procedures p on p.owner=s.table_owner and p.object_name=s.table_name/,
  );
  assert.match(apexCapabilitiesQuery, /s.owner='PUBLIC' and s.db_link is null/);
  assert.match(
    apexCapabilitiesQuery,
    /'DBMS_CLOUD','APEX_APPLICATION_ADMIN','APEX_WORKFLOW','APEX_HUMAN_TASK'/,
  );
  assert.match(apexCapabilitiesQuery, /sys_context\('USERENV','CURRENT_SCHEMA'\)=:p_owner/);
  assert.match(
    apexCapabilitiesQuery,
    /where owner=:p_owner and workspace=:p_workspace and application_id=:p_app_id/,
  );
  assert.match(
    apexCapabilitiesQuery,
    /select locked_by,is_working_copy,working_copy_name from apex_applications/,
  );
  assert.match(apexCapabilitiesQuery, /parent application is not inferred/);
  assert.doesNotMatch(
    apexCapabilitiesQuery,
    /\b(?:insert|update|delete|merge|alter|create|drop|grant|revoke|execute|begin)\s/i,
  );
  assert.doesNotMatch(apexCapabilitiesQuery, /(?:version_no|version_full)\s*(?:>=|>|like|between)/i);
  for (const feature of [
    'deep-data-security-runtime',
    'oci-iam',
    'oci-credential-binding',
    'outbound-network',
  ])
    assert.ok(apexCapabilitiesQuery.includes(`'${feature}', 'operator-verification-required'`));
  assert.match(apexCapabilitiesQuery, /metadata visibility only, execution not tested/);
});

test('capability pages retain observed values and unknown readiness after one fresh target check', async () => {
  const f = fixture();
  const result = await f.read({ ...request, offset: 4, limit: 3 });
  assert.equal(f.verified(), 1);
  assert.equal(f.calls.length, 1);
  assert.equal(
    f.calls[0]!.sql,
    apexCapabilitiesQuery + ' offset :p_offset rows fetch next :p_limit rows only',
  );
  assert.equal(f.calls[0]!.bindings.p_owner, 'FIXTURE');
  assert.equal(f.calls[0]!.bindings.p_app_id, 1001);
  assert.equal(f.calls[0]!.bindings.p_workspace, 'FIXTURE_WORKSPACE');
  assert.equal(f.calls[0]!.bindings.p_offset, 4);
  assert.equal(f.calls[0]!.bindings.p_limit, 3);
  assert.ok('rows' in result);
  assert.equal(result.rows[0]!.observed_value, '26.2.0');
  assert.equal(result.rows[1]!.status, 'not-observed');
  assert.equal(result.rows[2]!.status, 'operator-verification-required');
  assert.equal(result.nextOffset, 7);
  assert.equal(result.dataClassification, 'untrusted_database_content');
});

test('capabilities stay in bounded metadata batches without extra sessions or cross-schema probes', async () => {
  const f = fixture();
  f.rows([]);
  const result = await f.read({ requests: [request, { kind: 'objects', schema: 'FIXTURE', limit: 1 }] });
  assert.ok('results' in result);
  assert.equal(f.verified(), 1);
  assert.equal(f.calls.length, 2);
  assert.equal(result.results[0]!.kind, 'apex-capabilities');
  assert.equal(result.results[0]!.nextOffset, null);
  assert.match(f.calls[1]!.sql, /from all_objects where owner=:p_owner/);
  for (const invalid of [
    { ...request, schema: 'SYS' },
    { requests: [request, { ...request, schema: 'OTHER' }] },
    { ...request, sql: 'select * from dba_users' },
    { ...request, limit: 101 },
    { requests: Array(9).fill(request) },
  ]) {
    const denied = fixture();
    await assert.rejects(denied.read(invalid));
    assert.equal(denied.verified(), 0);
    assert.deepEqual(denied.calls, []);
  }
});

test('failed identity or inaccessible dictionary rejects diagnostics instead of claiming ready', async () => {
  const identity = fixture();
  identity.adapter.verifyTarget = async () => {
    throw new Fault('TARGET_MISMATCH', 'Fixture mismatch.', 5);
  };
  await assert.rejects(identity.read(request), { code: 'TARGET_MISMATCH' });
  assert.deepEqual(identity.calls, []);
  const dictionary = fixture();
  dictionary.adapter.jsonQuery = async () => {
    throw new Fault('QUERY_FAILED', 'Dictionary inaccessible.', 1);
  };
  await assert.rejects(dictionary.read(request), { code: 'QUERY_FAILED' });
});
