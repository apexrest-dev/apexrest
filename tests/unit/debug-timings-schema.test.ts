import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../../packages/core/src/service.ts';
import { schemas } from '../../packages/core/src/operations.ts';
test('debug timings remain strict and are honoured only on declared schemas', async () => {
  for (const operation of ['doctor', 'connection.list', 'apex.export']) {
    const r = await dispatch(operation, { debugTimings: true });
    assert.equal(r.ok, false);
    assert.equal(r.diagnostics[0]?.code, 'INVALID_INPUT');
  }
  assert.equal(schemas['apex.validate'].safeParse({ debugTimings: true }).success, true);
  assert.equal(
    schemas.ship.safeParse({
      env: 'test',
      mode: 'plan',
      userRequest: 'Review this test application plan.',
      debugTimings: true,
    }).success,
    true,
  );
});
