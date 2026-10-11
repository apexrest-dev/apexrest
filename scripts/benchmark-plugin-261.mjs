import { loadHarness, inspectResponse, regressionGate, machineFingerprint } from './lib/plugin-harness.mjs';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { sourceDigest, sha256 } from './lib/release.mjs';
import {
  savePrivateJson,
  statistics,
  usageSelection,
  tokenSnapshot,
  tokenDelta,
} from './lib/plugin-test-metrics.mjs';

const { values } = parseArgs({
  options: {
    catalog: { type: 'string' },
    profile: { type: 'string' },
    project: { type: 'string' },
    env: { type: 'string', default: 'test' },
    samples: { type: 'string', default: '20' },
    output: { type: 'string', default: 'docs/evidence/plugin-server/performance-20.json' },
    rollout: { type: 'string' },
    transcript: { type: 'string' },
    'usage-source': { type: 'string' },
    scenarios: { type: 'string' },
  },
});
assert.ok(values.project);
const samples = Number(values.samples);
assert.ok(Number.isInteger(samples) && samples >= 20 && samples <= 30);
assert.ok(path.resolve(values.output).startsWith(path.resolve('docs/evidence') + path.sep));
const project = await (await import('node:fs/promises')).realpath(values.project);
const config = JSON.parse(await readFile(path.join(project, 'apexrest.json'), 'utf8'));
const target = config.environments[values.env];
const selection = await loadHarness(values);
assert.equal(config.toolchain.profile, selection.profile);
assert.ok(['test', 'qa', 'dev', 'development'].includes(target?.kind));
const allowedScenarios = [
  'cold-mcp-startup-reference',
  'warm-reference-search',
  'warm-project-summary',
  'live-metadata-batch-three-kinds',
  'oracle-compiler-validation',
  'read-only-full-import-plan',
];
const selectedScenarios = values.scenarios?.split(',') ?? allowedScenarios;
assert.ok(selectedScenarios.length && selectedScenarios.every((id) => allowedScenarios.includes(id)));
const runtime = path.resolve('dist/runtime/mcp.mjs');
const report = {
  schemaVersion: 1,
  caseId: 'A261-046',
  apexProfile: selection.profile,
  catalogDigest: selection.catalogDigest,
  suite: selection.catalog.suite,
  responseChecks: [],
  startedAt: new Date().toISOString(),
  sourceDigest: await sourceDigest(),
  runtimeDigest: sha256(await readFile(runtime)),
  machine: {
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    cpuModel: os.cpus()[0]?.model,
    memoryBytes: os.totalmem(),
  },
  target: {
    applicationId: target.applicationId,
    workspace: target.workspace,
    parsingSchema: target.parsingSchema,
  },
  samplesPerScenario: samples,
  selectedScenarios,
  warmupPolicy: 'One verified invocation excluded before each scenario.',
  executionSurface: 'Current-build stdio MCP; no model session per invocation.',
  network:
    'Remote Oracle over existing direct saved SQLcl connection; no artificial latency/network isolation. Concurrent host, network or server activity may affect samples.',
  scenarios: [],
  calls: 0,
  limits: [
    'No import, business DML, authentication changes or fault injection.',
    'Separate-run comparisons do not control network latency, server load or cache state; no performance guarantee.',
    'Warm means one live MCP process; each connected SQLcl request still creates its own vendor session.',
    'Cold reference scenario includes fresh MCP process startup, initialize, discovery and call; OS/disk caches are not purged.',
  ],
  status: 'running',
};
const began = performance.now(),
  before = await tokenSnapshot(usageSelection(values));
let client;
async function connect() {
  const c = new Client({ name: 'apexrest-261-performance', version: '1.0.0' });
  try {
    await c.connect(new StdioClientTransport({ command: process.execPath, args: [runtime], stderr: 'pipe' }));
    return c;
  } catch (error) {
    await c.close().catch(() => {});
    throw error;
  }
}
async function call(c, name, args) {
  report.calls++;
  const response = await c.callTool({ name, arguments: args }, undefined, { timeout: 600000 });
  const result = JSON.parse(response.content.find((x) => x.type === 'text').text);
  report.responseChecks.push(inspectResponse(selection.quality, name, args, result));
  if (!result.ok || result.status !== 'succeeded')
    throw Object.assign(new Error('Domain failure.'), {
      code: result.diagnostics?.[0]?.code ?? 'DOMAIN_FAILED',
    });
  return result;
}
function verifyReference(r) {
  assert.ok(Array.isArray(r.data) && r.data.length > 0 && r.data.length <= 3);
  assert.ok(r.data.every((x) => x.version.startsWith(selection.profile)));
}
async function measure(id, invoke, verify) {
  if (!selectedScenarios.includes(id)) return;
  const scenario = { id, warmup: null, samples: [], status: 'running' };
  report.scenarios.push(scenario);
  const run = async (iteration, excluded) => {
    const started = performance.now(),
      initialCalls = report.calls;
    try {
      const r = await invoke();
      verify(r);
      const sqlclTimings = r.data?.sqlclTimings ?? r.data?.details?.sqlclTimings ?? [];
      if (['live-metadata-batch-three-kinds', 'read-only-full-import-plan'].includes(id))
        assert.ok(sqlclTimings.length, 'Missing SQLcl timing evidence');
      return {
        sqlclTimings,
        sessions: sqlclTimings.length,
        connectedSessions: sqlclTimings.filter((t) => t.connected).length,
        iteration,
        excluded,
        elapsedMs: performance.now() - started,
        status: 'passed',
        calls: report.calls - initialCalls,
        responseBytes: Buffer.byteLength(JSON.stringify(r)),
        tokens: { available: false, reason: 'MCP supplies no model billing.' },
      };
    } catch (error) {
      return {
        iteration,
        excluded,
        elapsedMs: performance.now() - started,
        status: 'failed',
        calls: report.calls - initialCalls,
        code: error.code ?? 'EXPECTATION_FAILED',
      };
    }
  };
  scenario.warmup = await run(0, true);
  if (scenario.warmup.status === 'failed') {
    scenario.status = 'blocked';
    await savePrivateJson(values.output, report);
    return;
  }
  for (let iteration = 1; iteration <= samples; iteration++) {
    scenario.samples.push(await run(iteration, false));
    await savePrivateJson(values.output, report);
    console.log(
      JSON.stringify({
        scenario: id,
        iteration,
        status: scenario.samples.at(-1).status,
        elapsedMs: Math.round(scenario.samples.at(-1).elapsedMs),
      }),
    );
  }
  scenario.passedSamples = scenario.samples.filter((s) => s.status === 'passed').length;
  scenario.failedSamples = samples - scenario.passedSamples;
  scenario.latency = statistics(scenario.samples.map((s) => s.elapsedMs));
  scenario.successLatency = statistics(
    scenario.samples.filter((s) => s.status === 'passed').map((s) => s.elapsedMs),
  );
  const successes = scenario.samples.filter((s) => s.status === 'passed');
  const median = (numbers) => (numbers.length ? statistics(numbers).medianMs : null);
  scenario.sqlcl = {
    medianSessions: median(successes.map((s) => s.sessions)),
    medianConnectedSessions: median(successes.map((s) => s.connectedSessions)),
    medianSpawnMs: median(successes.map((s) => s.sqlclTimings.reduce((sum, t) => sum + (t.spawnMs ?? 0), 0))),
    medianConnectMs: successes.some((s) => s.sqlclTimings.some((t) => t.connectMs !== null))
      ? median(successes.map((s) => s.sqlclTimings.reduce((sum, t) => sum + (t.connectMs ?? 0), 0)))
      : null,
    medianExecuteMs: median(successes.map((s) => s.sqlclTimings.reduce((sum, t) => sum + t.executeMs, 0))),
    splitScope:
      'Per-invocation summed session phases; CLI connect is inside executeMs, so connectMs is unavailable.',
  };
  scenario.status = scenario.failedSamples ? 'failed' : 'passed';
  await savePrivateJson(values.output, report);
}
try {
  client = await connect();
  const refArgs = { mode: 'search', query: 'page', version: selection.profile, limit: 3, project };
  const identity = await call(client, 'apexrest_project', {
    action: 'connection_test',
    project,
    name: target.readConnectionRef,
  });
  assert.equal(identity.data.db_unique_name, target.databaseIdentity.dbUniqueName);
  assert.equal(identity.data.service_name, target.databaseIdentity.serviceName);
  assert.equal(identity.data.parsing_schema, target.parsingSchema);
  const doctor = await call(client, 'apexrest_status', { detail: 'doctor', project });
  report.toolchain = {
    runtime: doctor.data.runtime,
    sqlcl: doctor.data.sqlcl,
    probes: doctor.data.probes.map((p) => ({
      state: p.state,
      version: p.version,
      informational: p.informational,
    })),
  };
  await measure(
    'cold-mcp-startup-reference',
    async () => {
      const c = await connect();
      try {
        const tools = await c.listTools();
        assert.equal(tools.tools.length, 10);
        return await call(c, 'apexrest_reference', refArgs);
      } finally {
        await c.close();
      }
    },
    verifyReference,
  );
  await measure('warm-reference-search', () => call(client, 'apexrest_reference', refArgs), verifyReference);
  await measure(
    'warm-project-summary',
    () => call(client, 'apexrest_project', { action: 'inspect', detail: 'summary', project }),
    (r) => {
      assert.equal(r.data.projectId, config.projectId);
      assert.equal(r.data.targetVerified, false);
    },
  );
  const requests = ['applications', 'pages', 'apex-capabilities'].map((kind) => ({
    kind,
    schema: target.parsingSchema,
    limit: 30,
  }));
  await measure(
    'live-metadata-batch-three-kinds',
    () => call(client, 'apexrest_metadata_read', { project, env: values.env, requests, debugTimings: true }),
    (r) => {
      assert.equal(r.data.targetVerifiedOnce, true);
      assert.equal(r.data.results.length, 3);
      assert.equal(r.data.results[0].rows[0].application_id, target.applicationId);
      assert.ok(r.data.results[1].rows.length > 0);
      const release = r.data.results[2].rows.find((x) => x.capability === 'apex-version')?.observed_value;
      assert.match(release, /^26\.1\./);
      report.serverRelease = release;
    },
  );
  await measure(
    'oracle-compiler-validation',
    () => call(client, 'apexrest_apex_validate', { project }),
    (r) => {
      assert.equal(r.data.status, 'passed');
      assert.equal(r.data.diagnostics.filter((d) => d.severity === 'error').length, 0);
      report.securityAdvisoryCount = r.data.staticAnalysis?.findings?.length ?? null;
    },
  );
  await measure(
    'read-only-full-import-plan',
    () =>
      call(client, 'apexrest_ship', {
        project,
        env: values.env,
        mode: 'plan',
        importMode: 'full',
        waitSeconds: 0,
        userRequest:
          'Read-only APEX 26.1 performance measurement requested in docs/evidence/perf-p0-p1/codex-tasks.md. Plan only; imports, writes and DDL are not authorized.',
      }),
    (r) => {
      assert.equal(r.data.status, 'planned');
      assert.equal(r.data.importSelection.resolvedMode, 'full');
      assert.equal(r.data.sources.migrations, 0);
      assert.equal(r.data.sources.packages, 0);
      assert.deepEqual(r.data.risks, []);
    },
  );
  report.status = report.scenarios.every((s) => s.status === 'passed') ? 'passed' : 'failed';
} catch (error) {
  report.status = 'blocked';
  report.blocker = error.code ?? 'RUN_FAILED';
} finally {
  await client?.close().catch(() => {
    report.closeFailed = true;
  });
  report.environment = {
    machine: machineFingerprint(),
    sqlcl: report.toolchain?.probes?.find((p) => /SQLcl/i.test(p.version ?? ''))?.version ?? null,
    target: {
      ...report.target,
      dbUniqueName: target?.databaseIdentity?.dbUniqueName ?? null,
      serviceName: target?.databaseIdentity?.serviceName ?? null,
    },
  };
  report.regressions = [];
  for (const baseline of selection.quality.baselines.filter((b) => b.profile === selection.profile)) {
    let previous;
    try {
      previous = JSON.parse(await readFile(baseline.evidence, 'utf8'));
    } catch {}
    const current = report.scenarios.find((s) => s.id === baseline.scenario);
    if (current)
      report.regressions.push({
        scenario: baseline.scenario,
        ...regressionGate(
          selection.quality,
          baseline,
          current.latency,
          previous?.environment,
          report.environment,
          current.status === 'passed' &&
            previous?.scenarios?.find((s) => s.id === baseline.scenario)?.status === 'passed',
        ),
      });
  }
  report.finishedAt = new Date().toISOString();
  report.wallTimeMs = performance.now() - began;
  report.tokens = tokenDelta(before, await tokenSnapshot(usageSelection(values)));
  await savePrivateJson(values.output, report);
  console.log(
    JSON.stringify({
      status: report.status,
      scenarios: report.scenarios.length,
      calls: report.calls,
      evidence: values.output,
    }),
  );
  process.exitCode = report.status === 'passed' ? 0 : 1;
}
