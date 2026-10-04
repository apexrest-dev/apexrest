import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { metadataInputSchema, metadataRead } from '../../packages/core/src/metadata.ts';
import type { OracleAdapter } from '../../packages/core/src/oracle.ts';
import type { Environment } from '../../packages/core/src/config.ts';
import { Fault } from '../../packages/core/src/result.ts';

const env = {
  parsingSchema: 'FIXTURE',
  workspace: 'FIXTURE_WORKSPACE',
  applicationId: 1001,
} as Environment;
const connection = { kind: 'sqlcl-store', name: 'fixture' } as const;
const columns = { kind: 'columns', schema: 'FIXTURE', name: 'CUSTOMERS' };
const constraints = { kind: 'constraints', schema: 'FIXTURE', name: 'CUSTOMERS' };

// Local adapter fixtures verify call boundaries, not connected Oracle behavior.
function fixture() {
  const calls: { sql: string; bindings: Record<string, string | number> }[] = [];
  let targetChecks = 0;
  const adapter = {
    async verifyTarget() {
      targetChecks++;
    },
    async jsonQuery(sql: string, _connection: unknown, bindings: Record<string, string | number>) {
      calls.push({ sql, bindings });
      return [{ column_name: 'CUSTOMER_ID' }];
    },
    // The real adapter answers a batch in one SQLcl session; the fixture
    // records each query in order through the same single-query boundary.
    async jsonQueryBatch(
      queries: { sql: string; bindings?: Record<string, string | number> }[],
      connection: unknown,
    ) {
      const rows = [];
      for (const q of queries) rows.push(await adapter.jsonQuery(q.sql, connection, q.bindings ?? {}));
      return rows;
    },
  };
  const read = (input: unknown) => metadataRead(adapter as unknown as OracleAdapter, env, connection, input);
  return { adapter, calls, read, targetChecks: () => targetChecks };
}

test('metadata batch validates every request before any Oracle call', async () => {
  for (const [invalid, code] of [
    [{ ...constraints, schema: 'OTHER' }, 'SCHEMA_DENIED'],
    [{ kind: 'signatures', schema: 'FIXTURE' }, 'OBJECT_REQUIRED'],
    [{ ...constraints, name: 'CUSTOMERS; DROP TABLE X' }, 'INVALID_INPUT'],
    [{ ...constraints, kind: 'arbitrary-sql' }, 'INVALID_INPUT'],
  ] as const) {
    const f = fixture();
    await assert.rejects(f.read({ requests: [columns, invalid] }), { code });
    assert.equal(f.targetChecks(), 0);
    assert.deepEqual(f.calls, []);
  }
});

test('metadata batch checks the target once, preserves order and binds each query', async () => {
  const f = fixture();
  const result = await f.read({ requests: [columns, constraints] });
  assert.equal(f.targetChecks(), 1);
  assert.equal(f.calls.length, 2);
  assert.match(f.calls[0]!.sql, /from all_tab_columns/);
  assert.match(f.calls[1]!.sql, /from all_constraints/);
  for (const call of f.calls) {
    assert.match(call.sql, /offset :p_offset rows fetch next :p_limit rows only$/);
    assert.deepEqual(call.bindings, {
      p_owner: 'FIXTURE',
      p_name: 'CUSTOMERS',
      p_app_id: 1001,
      p_workspace: 'FIXTURE_WORKSPACE',
      p_offset: 0,
      p_limit: 30,
    });
  }
  assert.deepEqual(result, {
    results: [columns, constraints].map((request, index) => ({
      index,
      kind: request.kind,
      name: 'CUSTOMERS',
      dataClassification: 'untrusted_database_content',
      rows: [{ column_name: 'CUSTOMER_ID' }],
      offset: 0,
      nextOffset: null,
    })),
    targetVerifiedOnce: true,
  });
  await f.read({ requests: [columns] });
  assert.equal(f.targetChecks(), 2, 'Separate batches always refresh target identity.');
});

test('legacy metadata reads preserve the response shape and fresh identity check', async () => {
  const f = fixture();
  assert.deepEqual(await f.read(columns), {
    dataClassification: 'untrusted_database_content',
    rows: [{ column_name: 'CUSTOMER_ID' }],
    offset: 0,
    nextOffset: null,
  });
  await f.read(constraints);
  assert.equal(f.targetChecks(), 2);
  assert.equal(f.calls.length, 2);
});

test('metadata rejects mixed forms, empty batches and requests outside bounded pages', async () => {
  for (const invalid of [
    {},
    { ...columns, requests: [constraints] },
    { requests: [columns], limit: 5 },
    { requests: [] },
    { requests: Array(9).fill(columns) },
    { requests: [{ ...columns, limit: 101 }] },
    { requests: [{ ...columns, limit: 0 }] },
    { requests: [{ ...columns, offset: 100001 }] },
    { requests: [{ ...columns, offset: -1 }] },
  ]) {
    const f = fixture();
    await assert.rejects(f.read(invalid), { code: 'INVALID_INPUT' });
    assert.equal(f.targetChecks(), 0);
    assert.deepEqual(f.calls, []);
  }
  const f = fixture();
  const result = await f.read({
    requests: Array.from({ length: 8 }, (_, index) => ({ ...columns, offset: index * 2, limit: 1 })),
  });
  assert.ok('results' in result);
  assert.deepEqual(
    result.results.map((r) => [r.offset, r.nextOffset]),
    Array.from({ length: 8 }, (_, index) => [index * 2, index * 2 + 1]),
  );
  assert.equal(f.targetChecks(), 1);
  assert.equal(f.calls.length, 8);
});

test('metadata batch reads sequentially and stops on failure without returning partial success', async () => {
  const f = fixture();
  let active = false;
  let reads = 0;
  f.adapter.jsonQuery = async () => {
    assert.equal(active, false);
    active = true;
    await new Promise(setImmediate);
    active = false;
    if (++reads === 2) throw new Fault('QUERY_FAILED', 'Fixture Oracle failure.', 1);
    return [{ column_name: 'CUSTOMER_ID' }];
  };
  await assert.rejects(f.read({ requests: [columns, constraints, columns] }), { code: 'QUERY_FAILED' });
  assert.equal(f.targetChecks(), 1);
  assert.equal(reads, 2);
});

test('failed target verification prevents all batch reads', async () => {
  const f = fixture();
  f.adapter.verifyTarget = async () => {
    throw new Fault('TARGET_MISMATCH', 'Fixture mismatched target.', 5);
  };
  await assert.rejects(f.read({ requests: [columns, constraints] }), { code: 'TARGET_MISMATCH' });
  assert.deepEqual(f.calls, []);
});

test('metadata public input stays extendable without injecting single-request defaults into batches', async () => {
  const extended = metadataInputSchema.extend({ project: z.string(), env: z.string() });
  const parsed = extended.parse({ project: '/fixture', env: 'dev', requests: [columns] });
  assert.equal('offset' in parsed, false);
  assert.equal('limit' in parsed, false);
  const { project: _project, env: _env, ...request } = parsed;
  const f = fixture();
  const result = await f.read(request);
  assert.ok('results' in result);
  assert.equal(result.results[0]!.offset, 0);
  assert.equal(f.calls[0]!.bindings.p_limit, 30);
});
