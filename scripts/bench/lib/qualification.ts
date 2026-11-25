/**
 * Qualification of the fast-development candidates (V13): paired baseline/candidate runs per
 * cohort and scenario, summarized without dropping failures, retries, conflicts or unknown
 * outcomes, and a scoped decision per candidate. Pure functions; the runner is
 * scripts/bench/qualify.ts.
 */
export type Cohort = 'cold-cli' | 'resident-cli' | 'warm-mcp' | 'resident-mcp';
export type Outcome = 'succeeded' | 'failed' | 'conflict' | 'outcome_unknown' | 'superseded' | 'retried';

export interface RunRecord {
  candidate: string;
  arm: 'baseline' | 'candidate';
  cohort: Cohort;
  scenario: string;
  /** Transport, residency and compiler/MMD tuple, target and application size of this run. */
  identity: {
    transport: string;
    residency: 'cold' | 'resident' | 'warm';
    compiler: string;
    mmdVersion: string;
    target: string;
    applicationFiles: number;
  };
  /** The first run of a process is cold; only warm runs of resident cohorts are compared. */
  warm: boolean;
  outcome: Outcome;
  totalMs: number | null;
  phases: Record<string, number>;
  sqlclInvocations: number;
  observation: string | null;
  /** Required safeguards observed in this run (drift checks, prewrite observation, recovery read). */
  safeguards: string[];
}

/** Below this many successful samples a p95 is not reported. */
export const P95_MIN_SAMPLES = 20;

const quantile = (values: number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]!;
};

export function armSummary(records: RunRecord[]) {
  const comparable = records.filter((record) => record.warm || record.cohort === 'cold-cli');
  const outcomes: Partial<Record<Outcome, number>> = {};
  for (const record of comparable) outcomes[record.outcome] = (outcomes[record.outcome] ?? 0) + 1;
  const times = comparable
    .filter((record) => record.outcome === 'succeeded' && record.totalMs !== null)
    .map((record) => record.totalMs!);
  return {
    runs: comparable.length,
    excludedColdRuns: records.length - comparable.length,
    outcomes,
    successRate: comparable.length ? (outcomes.succeeded ?? 0) / comparable.length : 0,
    medianMs: times.length ? quantile(times, 0.5) : null,
    p95Ms: times.length >= P95_MIN_SAMPLES ? quantile(times, 0.95) : null,
    sqlclInvocations: comparable.length
      ? comparable.reduce((total, record) => total + record.sqlclInvocations, 0) / comparable.length
      : null,
    observations: [...new Set(comparable.map((record) => record.observation ?? 'none'))],
    safeguards: [...new Set(comparable.flatMap((record) => record.safeguards))].sort(),
  };
}

/**
 * Promote only on paired evidence: enough samples on both arms, a success rate no worse than the
 * baseline, every safeguard the baseline observed still observed, no unknown outcomes, and a
 * material median improvement (at least `minimumGain`, default 10 %). Otherwise retain the
 * candidate as experimental, or reject it when it lost a safeguard or success.
 */
export function decide(candidate: string, records: RunRecord[], minimumSamples = 10, minimumGain = 0.1) {
  const own = records.filter((record) => record.candidate === candidate);
  const baseline = armSummary(own.filter((record) => record.arm === 'baseline'));
  const proposed = armSummary(own.filter((record) => record.arm === 'candidate'));
  const lostSafeguards = baseline.safeguards.filter((name) => !proposed.safeguards.includes(name));
  const reasons: string[] = [];
  let decision: 'promote' | 'retain-experimental' | 'reject';
  if (lostSafeguards.length) {
    decision = 'reject';
    reasons.push(`omits safeguards: ${lostSafeguards.join(', ')}`);
  } else if (proposed.successRate < baseline.successRate) {
    decision = 'reject';
    reasons.push(`success rate ${proposed.successRate} below baseline ${baseline.successRate}`);
  } else if ((proposed.outcomes.outcome_unknown ?? 0) > 0) {
    decision = 'retain-experimental';
    reasons.push('unknown outcomes need investigation');
  } else if (baseline.runs < minimumSamples || proposed.runs < minimumSamples) {
    decision = 'retain-experimental';
    reasons.push(`fewer than ${minimumSamples} comparable runs per arm`);
  } else if (
    baseline.medianMs === null ||
    proposed.medianMs === null ||
    proposed.medianMs > baseline.medianMs * (1 - minimumGain)
  ) {
    decision = 'retain-experimental';
    reasons.push(`median gain below ${minimumGain * 100} %`);
  } else {
    decision = 'promote';
    reasons.push(`median ${baseline.medianMs} ms to ${proposed.medianMs} ms with equal safeguards`);
  }
  return {
    candidate,
    decision,
    reasons,
    baseline,
    candidateArm: proposed,
    scope: 'this target, cohort set and dataset only',
  };
}
