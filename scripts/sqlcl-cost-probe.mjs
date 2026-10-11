import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { coreHelpers, machineFingerprint, runProcess } from './lib/plugin-harness.mjs';
import { savePrivateJson, statistics } from './lib/plugin-test-metrics.mjs';

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    env: { type: 'string', default: 'test' },
    samples: { type: 'string', default: '20' },
    output: { type: 'string', default: 'docs/evidence/qp-harness/cost.json' },
  },
});
assert.ok(values.project);
assert.ok(path.resolve(values.output).startsWith(path.resolve('docs/evidence') + path.sep));
const config = JSON.parse(await readFile(path.join(values.project, 'apexrest.json'), 'utf8')),
  target = config.environments[values.env];
assert.ok(['dev', 'development', 'test', 'qa'].includes(target?.kind));
const { resolveConnection } = await coreHelpers(path.dirname(values.output));
const connection = await resolveConnection(target.readConnectionRef);
assert.equal(connection.kind, 'sqlcl-store');
assert.ok(connection.name && !/[\r\n]/.test(connection.name));
const executable = process.env.APEXREST_SQLCL ?? 'sql',
  version = await runProcess(executable, ['-version']);
const count = Number(values.samples);
assert.ok(Number.isInteger(count) && count >= 20 && count <= 30);
const report = {
  schemaVersion: 1,
  profile: config.toolchain.profile,
  startedAt: new Date().toISOString(),
  environment: {
    machine: machineFingerprint(),
    sqlcl: version.stdout.trim(),
    target: { applicationId: target.applicationId, workspace: target.workspace },
  },
  probes: [],
  checks: [],
  measurements: [],
  mutation: false,
  accounting:
    'Connect cost is paired-scenario latency difference; it includes SQLcl command handling and server variability, not a separately observed login phase.',
};
for (const [id, input] of [
  ['bare', 'exit\n'],
  ['connect', `connect -name "${connection.name}"\nexit\n`],
  ['select', `connect -name "${connection.name}"\nset sqlformat json\nselect 1 probe from dual;\nexit\n`],
]) {
  const samples = [];
  for (let iteration = 0; iteration <= count; iteration++) {
    const start = performance.now(),
      r = await runProcess(executable, ['-s', '/nolog'], { input });
    samples.push({
      iteration,
      excluded: iteration === 0,
      elapsedMs: performance.now() - start,
      status:
        r.code === 0 &&
        !/ORA-\d|SP2-\d|Error:|Unknown connection/i.test(r.stdout + r.stderr) &&
        (id !== 'select' || /"probe"\s*:\s*1/.test(r.stdout))
          ? 'passed'
          : 'failed',
      exitCode: r.code,
    });
    await savePrivateJson(values.output, report);
  }
  const measured = samples.filter((s) => !s.excluded);
  const p = {
    id,
    samples,
    latency: statistics(measured.map((s) => s.elapsedMs)),
    status: samples.every((s) => s.status === 'passed') ? 'passed' : 'failed',
  };
  report.probes.push(p);
  report.measurements.push(p);
  report.checks.push({ id, status: p.status });
  await savePrivateJson(values.output, report);
  console.log(JSON.stringify({ probe: id, status: p.status, medianMs: p.latency.medianMs }));
}
report.decomposition = {
  bareMs: report.probes[0].latency.medianMs,
  connectIncrementMs:
    report.probes[1].status === 'passed'
      ? report.probes[1].latency.medianMs - report.probes[0].latency.medianMs
      : null,
  selectIncrementMs: report.probes.slice(1).every((p) => p.status === 'passed')
    ? report.probes[2].latency.medianMs - report.probes[1].latency.medianMs
    : null,
  comparable: report.probes.every((p) => p.status === 'passed'),
  reason: report.probes.every((p) => p.status === 'passed')
    ? 'Scenario median differences include uncontrolled host/network variability.'
    : 'Failed saved-connect/query probes measure refusal overhead, not a database connection.',
};
report.finishedAt = new Date().toISOString();
await savePrivateJson(values.output, report);
process.exitCode = report.checks.some((c) => c.status === 'failed') ? 1 : 0;
