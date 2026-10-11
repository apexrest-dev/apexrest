import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OracleAdapter, parseStatementMs } from '../../packages/core/src/oracle.ts';
import { sqlclTimings, withSqlclTimings } from '../../packages/core/src/sqlcl-timings.ts';

test('SQLcl elapsed parsing is bounded, exact and independent of JSON strings', () => {
  assert.equal(parseStatementMs('{"elapsed":"Elapsed: 90:00:00"}\nElapsed: 01:02:03.045\n'), 3723045);
  assert.equal(parseStatementMs('{\"items\":[]}Elapsed: 00:00:00.074\n'), 74);
  for (const invalid of ['', 'Elapsed: 00:90:01', 'Elapsed: 00:00:01\nElapsed: 00:00:02'])
    assert.throws(() => parseStatementMs(invalid), { code: 'SQLCL_TIMING_UNCONFIRMED' });
});

test('debug statement markers retain batch all-or-nothing semantics and privacy', async () => {
  let omit = false;
  const oracle = new OracleAdapter(async (request) => {
    const markers = [...(request.input ?? '').matchAll(/prompt (APEXREST_ROWS_\w+_\d+)/g)].map((m) => m[1]);
    return {
      code: 0,
      stdout: markers
        .slice(0, omit ? 1 : 2)
        .map(
          (marker) =>
            JSON.stringify({ results: [{ items: [{ v: 1 }] }] }) + '\nElapsed: 00:00:00.012\n' + marker,
        )
        .join('\n'),
      stderr: '',
      timedOut: false,
      cancelled: false,
      truncated: false,
    };
  });
  oracle.stage = async () => mkdtemp(path.join(tmpdir(), 'apexrest-statement-'));
  oracle.settings = async () => ({
    schemaVersion: 1,
    mode: 'cli',
    mcpRestrictLevel: '4',
    executable: 'sql',
    javaHome: undefined,
  });
  const connection = { kind: 'sqlcl-store', name: 'fixture' } as const;
  await withSqlclTimings(async () => {
    assert.equal(
      (
        await oracle.jsonQueryBatch(
          [{ sql: 'select 1 v from dual' }, { sql: 'select 1 v from dual' }],
          connection,
          undefined,
          'metadata-batch',
          true,
        )
      ).length,
      2,
    );
    assert.deepEqual(sqlclTimings()[0]!.statementMs, [12, 12]);
    assert.doesNotMatch(JSON.stringify(sqlclTimings()), /select|from dual|fixture/);
  });
  omit = true;
  await assert.rejects(
    oracle.jsonQueryBatch(
      [{ sql: 'select 1 v from dual' }, { sql: 'select 1 v from dual' }],
      connection,
      undefined,
      'metadata-batch',
      true,
    ),
    { code: 'EMPTY_QUERY_RESULT' },
  );
});
