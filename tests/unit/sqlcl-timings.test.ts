import test from 'node:test';
import assert from 'node:assert/strict';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { metadataRead } from '../../packages/core/src/metadata.ts';
import type { Environment } from '../../packages/core/src/config.ts';
import {
  executionTiming,
  recordSqlclTiming,
  sqlclTimings,
  withSqlclTimings,
} from '../../packages/core/src/sqlcl-timings.ts';
import { runProcess } from '../../packages/core/src/process.ts';

const env = {
  workspace: 'FIXTURE',
  parsingSchema: 'FIXTURE',
  applicationId: 123,
  databaseIdentity: { dbUniqueName: 'DB', serviceName: 'SERVICE' },
} as Environment;
const identity = [
  { target_record: 'identity', db_unique_name: 'DB', service_name: 'SERVICE', parsing_schema: 'FIXTURE' },
  { target_record: 'workspace', workspace: 'FIXTURE', workspace_id: 1 },
  {
    target_record: 'application',
    workspace: 'FIXTURE',
    application_id: 123,
    owner: 'FIXTURE',
    alias: 'fixture',
  },
];
test('metadata execution timings contain exact labels and never SQL, binds or usernames', async () => {
  const oracle = new OracleAdapter(async (request) => {
    const sql = request.input ?? '';
    // Injected transport timings test explicit sanitization, not Oracle performance.
    request.onSqlclTiming?.({
      ...executionTiming('cli', false, true),
      spawnMs: 2,
      executeMs: 3,
      totalMs: 5,
      sql,
      bindings: { password: 'fixture-secret' },
      username: 'PRIVATE_USER',
    } as never);
    const markers = [...sql.matchAll(/prompt (APEXREST_ROWS_\w+_\d+)/g)].map((m) => m[1]);
    const envelope = (items: unknown[]) => JSON.stringify({ results: [{ items }] });
    return {
      code: 0,
      stdout: markers.length
        ? markers
            .map(
              (m, i) =>
                envelope(sql.includes("'identity' target_record") && i === 0 ? identity : [{ page_id: 1 }]) +
                '\n' +
                m,
            )
            .join('\n')
        : envelope(identity),
      stderr: '',
      timedOut: false,
      cancelled: false,
      truncated: false,
    };
  });
  oracle.settings = async () => ({
    schemaVersion: 1,
    mode: 'cli',
    mcpRestrictLevel: '4',
    executable: 'sql',
    javaHome: undefined,
  });
  const records = await withSqlclTimings(async () => {
    await metadataRead(
      oracle,
      env,
      { kind: 'sqlcl-store', name: 'fixture' },
      { requests: [{ kind: 'pages', schema: 'FIXTURE' }] },
    );
    return sqlclTimings();
  });
  assert.deepEqual(
    records.map((r) => r.label),
    ['verifyTarget', 'metadata-batch'],
  );
  assert.equal(records.length, 2);
  assert.ok(records.every((r) => r.spawnMs === 2 && r.executeMs === 3 && r.totalMs === 5));
  assert.doesNotMatch(
    JSON.stringify(records),
    /select|password|fixture-secret|PRIVATE_USER|bindings|sqlcl:|connection/,
  );
});
test('timing recorders isolate concurrent operations and share nested observations', async () => {
  const counts = await Promise.all(
    [1, 2].map((count) =>
      withSqlclTimings(async () => {
        for (let i = 0; i < count; i++) {
          await new Promise(setImmediate);
          recordSqlclTiming('session', executionTiming('cli'));
        }
        await withSqlclTimings(async () => recordSqlclTiming('validate', executionTiming('mcp-pool')));
        return sqlclTimings().length;
      }),
    ),
  );
  assert.deepEqual(counts, [2, 3]);
  assert.deepEqual(sqlclTimings(), []);
});
test('CLI timings measure spawn and execution without inventing a connect split', async () => {
  const records: unknown[] = [];
  const result = await runProcess({
    executable: process.execPath,
    args: ['-e', 'setTimeout(()=>console.log("done"),20)'],
    cwd: process.cwd(),
    sqlclConnected: true,
    onSqlclTiming: (r) => records.push(r),
  });
  assert.equal(result.code, 0);
  assert.equal(records.length, 1);
  const r = records[0] as ReturnType<typeof executionTiming>;
  assert.equal(r.connectMs, null);
  assert.equal(r.transport, 'cli');
  assert.equal(r.connected, true);
  assert.ok(r.spawnMs !== null && r.spawnMs >= 0 && r.executeMs >= 20 && r.totalMs >= r.executeMs);
});
