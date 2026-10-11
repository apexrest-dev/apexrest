export function agentRunSummary(runs) {
  const passed = runs.filter((r) => r.status === 'passed').length;
  const failed = runs.filter((r) => r.status === 'failed').length;
  const blockedIterations = runs.filter((r) => r.status === 'blocked').length;
  const reviewedIterations = runs.filter((r) => ['partial', 'needs_review'].includes(r.status)).length;
  const evaluatedIterations = passed + failed;
  const status = failed
    ? 'failed'
    : passed === runs.length && runs.length
      ? 'passed'
      : blockedIterations === runs.length && runs.length
        ? 'blocked'
        : 'partial';
  return {
    passed,
    blockedIterations,
    reviewedIterations,
    evaluatedIterations,
    passRate: evaluatedIterations ? passed / evaluatedIterations : null,
    status,
  };
}
