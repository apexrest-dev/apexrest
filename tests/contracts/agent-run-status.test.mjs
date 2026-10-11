import test from 'node:test';
import assert from 'node:assert/strict';
import { agentRunSummary } from '../../scripts/lib/agent-run-status.mjs';
test('blocked runs do not lower pass rate or become quality failures', () => {
  const result = agentRunSummary([{ status: 'passed' }, { status: 'blocked' }]);
  assert.equal(result.status, 'partial');
  assert.equal(result.passRate, 1);
  assert.equal(result.blockedIterations, 1);
  assert.equal(agentRunSummary([{ status: 'blocked' }]).status, 'blocked');
  assert.equal(
    agentRunSummary([{ status: 'passed' }, { status: 'failed' }, { status: 'blocked' }]).passRate,
    0.5,
  );
});
test('manual review is separate from evaluated pass rate', () => {
  const result = agentRunSummary([{ status: 'needs_review' }]);
  assert.equal(result.status, 'partial');
  assert.equal(result.passRate, null);
  assert.equal(result.reviewedIterations, 1);
});
