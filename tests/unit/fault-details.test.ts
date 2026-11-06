import test from 'node:test';
import assert from 'node:assert/strict';
import { Fault, failure } from '../../packages/core/src/result.ts';

test('failure results carry plain fault facts, never objects, and redact secrets', () => {
  const result = failure(
    'ship',
    new Fault('POST_DEPLOY_IDENTITY_FAILED', 'Imported with alias X202.', 1, 'failed', {
      deploymentRunId: '5ebbf54b-1f92-4ac8-a956-6bc8ba74c5d5',
      observedAlias: 'BTC-MONITOR202',
      usedBy: [201],
      retried: false,
      nested: { secret: 'value' },
      token: 'sk-proj-test-only-0123456789abcdefghijklmnop',
      nextActions: ['Change the alias.'],
    }),
  );
  assert.deepEqual(Object.keys(result.data as object).sort(), [
    'deploymentRunId',
    'observedAlias',
    'retried',
    'token',
    'usedBy',
  ]);
  const data = result.data as Record<string, unknown>;
  assert.equal(data.deploymentRunId, '5ebbf54b-1f92-4ac8-a956-6bc8ba74c5d5');
  assert.deepEqual(data.usedBy, [201]);
  assert.doesNotMatch(String(data.token), /0123456789abcdef/u);
  assert.deepEqual(result.nextActions, ['Change the alias.']);
  // No details: no data, as before.
  assert.equal(failure('x', new Fault('X', 'plain', 1)).data, undefined);
});
