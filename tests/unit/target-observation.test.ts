import test from 'node:test';
import assert from 'node:assert/strict';
import { observedWorkingCopy } from '../fixtures/observed-working-copy.ts';
import { sqlclTimings, withSqlclTimings } from '../../packages/core/src/sqlcl-timings.ts';

test('workingFingerprint observes identity and metadata in one connected fake-runner session', async () => {
  const f = await observedWorkingCopy();
  await withSqlclTimings(async () => {
    const result = await f.service.workingFingerprint(f.ctx, 'dev', f.state);
    assert.deepEqual(result.metadata, f.state.observedMetadata);
    assert.deepEqual(
      sqlclTimings().map((r) => [r.label, r.connected]),
      [['targetWithMetadata', true]],
    );
  });
  assert.equal(f.connections.length, 1);
});

test('combined target observations reject mismatched identity before returning metadata', async () => {
  const f = await observedWorkingCopy();
  let returned: unknown;
  await assert.rejects(
    async () => {
      returned = await f.oracle.targetWithMetadata({ ...f.env, parsingSchema: 'OTHER' }, f.connection);
    },
    { code: 'TARGET_MISMATCH' },
  );
  assert.equal(returned, undefined);
  assert.equal(f.connections.length, 1);
});

test('combined observations preserve explicit SQLcl null flags and reject missing metadata', async () => {
  const f = await observedWorkingCopy();
  const target = await f.oracle.verifyTarget(f.env, f.connection);
  const rows = [
    { target_record: 'identity', ...target.identity },
    { target_record: 'workspace', ...target.workspace },
    { target_record: 'application', ...target.application },
  ];
  f.oracle.jsonQueryBatch = async () => [
    rows,
    [{ last_updated_on_is_null: 'Y', last_updated_by_is_null: 'Y' }],
  ];
  assert.deepEqual((await f.oracle.targetWithMetadata(f.env, f.connection)).metadata, {
    lastUpdatedOn: null,
    lastUpdatedBy: null,
  });
  f.oracle.jsonQueryBatch = async () => [rows, [{}]];
  await assert.rejects(f.oracle.targetWithMetadata(f.env, f.connection), {
    code: 'SYNC_METADATA_UNCONFIRMED',
  });
});
