import test from 'node:test';
import assert from 'node:assert/strict';
import { assessTarget, quantile, summarize } from '../../scripts/bench/lib/scenario-stats.ts';

test('scenario rows keep every failure and report median, p95 and success rate', () => {
  const row = summarize('edit', [10, 20, 30, 40, 1000], 2, { files: 6 });
  assert.deepEqual(row, {
    scenario: 'edit',
    repetitions: 7,
    successes: 5,
    failures: 2,
    successRate: 5 / 7,
    medianMs: 30,
    p95Ms: 1000,
    files: 6,
  });
  assert.equal(quantile([], 0.5), null);
  assert.equal(summarize('none', [], 3).medianMs, null);
});

test('a proposed target is met only with no failures and a p95 within it', () => {
  const fast = summarize('fast', [10, 12], 0);
  const failing = summarize('failing', [10], 1);
  assert.equal(assessTarget('semantic edit', [fast], 1000).assessment, 'within target on this dataset');
  assert.equal(assessTarget('semantic edit', [fast, failing], 1000).assessment, 'not met on this dataset');
  assert.equal(
    assessTarget('semantic edit', [summarize('slow', [1500], 0)], 1000).assessment,
    'not met on this dataset',
  );
  assert.equal(assessTarget('recipe', [], 3000).assessment, 'not measured');
  assert.match(assessTarget('recipe', [fast], 3000).basis, /browser paint not observed/u);
});
