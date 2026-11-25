/** Statistics of the scenario pack (V12): every failure counts; nothing is dropped as an outlier. */
export interface ScenarioRow {
  scenario: string;
  repetitions: number;
  successes: number;
  failures: number;
  successRate: number;
  medianMs: number | null;
  p95Ms: number | null;
  files?: number;
}

export function quantile(values: number[], q: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]!;
}

export function summarize(
  scenario: string,
  samples: number[],
  failures: number,
  extra: { files?: number } = {},
): ScenarioRow {
  const repetitions = samples.length + failures;
  const round = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);
  return {
    scenario,
    repetitions,
    successes: samples.length,
    failures,
    successRate: repetitions ? samples.length / repetitions : 0,
    medianMs: round(quantile(samples, 0.5)),
    p95Ms: round(quantile(samples, 0.95)),
    ...extra,
  };
}

/**
 * A proposed scenario target, assessed against preview readiness: met only when every repetition
 * succeeded and the p95 is within the target. It is never a measured paint time or an SLA.
 */
export function assessTarget(name: string, scenarioRows: ScenarioRow[], targetMs: number) {
  const measured = scenarioRows.filter((row) => row.repetitions > 0);
  const met =
    measured.length > 0 &&
    measured.every((row) => row.failures === 0 && row.p95Ms !== null && row.p95Ms <= targetMs);
  return {
    target: name,
    proposedMs: targetMs,
    basis: 'preview readiness (server HTML); browser paint not observed',
    scenarios: measured.map((row) => ({ scenario: row.scenario, p95Ms: row.p95Ms, failures: row.failures })),
    assessment: measured.length
      ? met
        ? 'within target on this dataset'
        : 'not met on this dataset'
      : 'not measured',
  };
}
