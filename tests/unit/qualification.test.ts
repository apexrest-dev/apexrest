import test from 'node:test';
import assert from 'node:assert/strict';
import {
  armSummary,
  decide,
  P95_MIN_SAMPLES,
  type RunRecord,
} from '../../scripts/bench/lib/qualification.ts';

const SAFEGUARDS = ['backup', 'prewriteObservation', 'readback', 'targetObservation'];
const run = (
  arm: 'baseline' | 'candidate',
  totalMs: number | null,
  change: Partial<RunRecord> = {},
): RunRecord => ({
  candidate: 'd05-resident',
  arm,
  cohort: arm === 'baseline' ? 'cold-cli' : 'resident-cli',
  scenario: 'one-page',
  identity: {
    transport: 'cli',
    residency: 'resident',
    compiler: '26.3',
    mmdVersion: '26.2',
    target: 'dev',
    applicationFiles: 8,
  },
  warm: true,
  outcome: totalMs === null ? 'failed' : 'succeeded',
  totalMs,
  phases: {},
  sqlclInvocations: 5,
  observation: 'page-exports',
  safeguards: SAFEGUARDS,
  ...change,
});
const pairs = (baseline: number, candidate: number, n = 10, change: Partial<RunRecord> = {}) => [
  ...Array.from({ length: n }, () => run('baseline', baseline)),
  ...Array.from({ length: n }, () => run('candidate', candidate, change)),
];

test('a material, safe improvement on enough paired runs is promoted', () => {
  const decision = decide('d05-resident', pairs(20000, 12000));
  assert.equal(decision.decision, 'promote');
  assert.equal(decision.baseline.medianMs, 20000);
  assert.equal(decision.candidateArm.medianMs, 12000);
  assert.match(decision.scope, /this target/u);
});

test('omitted safeguards or lost successes are rejected; weak evidence stays experimental', () => {
  assert.equal(
    decide('d05-resident', pairs(20000, 5000, 10, { safeguards: ['backup', 'readback'] })).decision,
    'reject',
  );
  const failing = [...pairs(20000, 12000), run('candidate', null)];
  assert.equal(decide('d05-resident', failing).decision, 'reject');
  assert.equal(decide('d05-resident', pairs(20000, 12000, 5)).decision, 'retain-experimental');
  assert.equal(decide('d05-resident', pairs(20000, 19000)).decision, 'retain-experimental');
  const unknown = [
    ...pairs(20000, 12000),
    run('baseline', null, { outcome: 'outcome_unknown' }),
    run('candidate', null, { outcome: 'outcome_unknown' }),
  ];
  assert.equal(decide('d05-resident', unknown).decision, 'retain-experimental');
});

test('summaries keep every outcome, exclude cold runs of resident cohorts and gate p95 on samples', () => {
  const records = [
    run('candidate', 30000, { warm: false }),
    ...Array.from({ length: 5 }, () => run('candidate', 10000)),
    run('candidate', null, { outcome: 'conflict' }),
    run('candidate', null, { outcome: 'retried' }),
  ];
  const summary = armSummary(records);
  assert.equal(summary.excludedColdRuns, 1, 'cold startup is not mixed into warm runs');
  assert.deepEqual(summary.outcomes, { succeeded: 5, conflict: 1, retried: 1 });
  assert.equal(summary.successRate, 5 / 7);
  assert.equal(summary.p95Ms, null, `p95 needs ${P95_MIN_SAMPLES} samples`);
  assert.equal(
    armSummary(Array.from({ length: P95_MIN_SAMPLES }, (_, i) => run('baseline', 1000 + i))).p95Ms,
    1018,
  );
});
