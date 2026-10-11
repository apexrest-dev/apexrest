import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { sha256, sourceDigest } from './lib/release.mjs';
import {
  tokenSnapshot,
  usageSelection,
  tokenDelta,
  statistics,
  savePrivateJson,
} from './lib/plugin-test-metrics.mjs';

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    env: { type: 'string', default: 'test' },
    samples: { type: 'string', default: '3' },
    output: { type: 'string' },
    rollout: { type: 'string' },
    transcript: { type: 'string' },
    'usage-source': { type: 'string' },
    'allow-app-writes': { type: 'boolean', default: false },
    'user-request': { type: 'string' },
    'initialize-baseline': { type: 'boolean', default: false },
  },
});
if (!values.project)
  throw new Error(
    'An adopted private project and --project are required. See tests/plugin-server/README.md.',
  );
const project = path.resolve(values.project),
  env = values.env;
const samples = Number(values.samples);
assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 30, 'samples must be 1..30');
const config = JSON.parse(await readFile(path.join(project, 'apexrest.json'), 'utf8'));
const target = config.environments[env];
assert.ok(
  target && ['test', 'qa', 'dev', 'development'].includes(target.kind),
  'Explicit non-production target required.',
);
assert.equal(config.toolchain.profile, '26.1', 'This suite qualifies only APEX 26.1.');
assert.ok(!values['allow-app-writes'] || values['user-request'], 'Writes require the literal human request.');
const catalog = JSON.parse(await readFile('tests/plugin-server/apex-26.1.cases.json', 'utf8'));
const output = values.output ?? 'docs/evidence/plugin-server/latest.json';
assert.ok(
  path.resolve(output).startsWith(path.resolve('docs/evidence') + path.sep),
  'Output must remain in ignored docs/evidence/.',
);
const client = new Client({ name: 'apexrest-server-qualification', version: '1.0.0' });
const runtime = path.resolve('dist/runtime/mcp.mjs');
const evidence = {
  schemaVersion: 1,
  suite: catalog.suite,
  apexProfile: '26.1',
  startedAt: new Date().toISOString(),
  sourceDigest: await sourceDigest(),
  catalogDigest: sha256(await readFile('tests/plugin-server/apex-26.1.cases.json')),
  runtimeDigest: sha256(await readFile(runtime)),
  executionSurface: 'current-build-stdio-MCP; not native model-host discovery',
  target: {
    applicationId: target.applicationId,
    workspace: target.workspace,
    parsingSchema: target.parsingSchema,
    environment: env,
  },
  checks: [],
  measurements: [],
  tokens: null,
  limits: [
    'No browser verification requested.',
    'APEX 26.2 is a separate extension.',
    'No business DML, authentication changes, destructive fault injection or production operations.',
  ],
};
const before = await tokenSnapshot(usageSelection(values));
const start = performance.now();
let calls = 0;
async function measure(id, invoke, verify, repeat = 1) {
  const elapsed = [],
    bytes = [];
  let status = 'passed',
    code;
  for (let sample = 0; sample < repeat; sample++) {
    const began = performance.now();
    try {
      const result = await invoke();
      bytes.push(Buffer.byteLength(JSON.stringify(result)));
      await verify(result);
      elapsed.push(performance.now() - began);
    } catch (error) {
      elapsed.push(performance.now() - began);
      status = 'failed';
      code =
        error.testCode ??
        error.code ??
        (error.name === 'AssertionError' ? 'EXPECTATION_FAILED' : 'OPERATION_FAILED');
      break;
    }
  }
  const definition = catalog.cases.find((c) => c.id === id);
  const latency = statistics(elapsed);
  const budgetMs = definition?.budgetMs ?? null;
  const measurement = {
    id,
    status,
    code,
    latency,
    responseBytes: bytes,
    budgetMs,
    budgetExceeded: budgetMs == null ? null : latency.p95Ms > budgetMs,
    tokenUsage: { available: false, reason: 'CLI/MCP supplies no model token billing.' },
  };
  evidence.measurements.push(measurement);
  evidence.checks.push({ id, status, ...(code ? { code } : {}) });
  console.log(JSON.stringify({ id, status, medianMs: Math.round(latency.medianMs), code }));
  await savePrivateJson(output, evidence);
  return status === 'passed';
}
async function call(name, args) {
  calls++;
  const response = await client.callTool({ name, arguments: args }, undefined, { timeout: 600000 });
  const text = response.content?.find((c) => c.type === 'text')?.text;
  if (!text) throw Object.assign(new Error('No domain envelope.'), { testCode: 'ENVELOPE_MISSING' });
  return JSON.parse(text);
}
function success(r) {
  if (!r.ok)
    throw Object.assign(new Error('Operation failed.'), {
      testCode: r.diagnostics?.[0]?.code ?? 'DOMAIN_FAILED',
    });
  assert.equal(r.status, 'succeeded');
}
function rejected(...codes) {
  return (r) => {
    assert.equal(r.ok, false);
    assert.ok(r.diagnostics.some((d) => codes.includes(d.code)));
  };
}
async function finishJob(r) {
  if (r.data?.result) return r.data.result;
  if (!['running', 'queued', 'outcome_unknown'].includes(r.data?.status)) return r;
  const jobId = r.data?.jobId ?? r.data?.id;
  assert.ok(jobId, 'Running operation must return its existing job ID.');
  for (let attempt = 0; attempt < 30; attempt++) {
    const job = await call('apexrest_job', { action: 'status', jobId, project, waitSeconds: 20 });
    if (job.data?.result) return job.data.result;
    success(job);
    if (['failed', 'cancelled'].includes(job.data?.status))
      throw Object.assign(new Error('Job failed.'), { testCode: job.data.status });
  }
  throw Object.assign(new Error('Job did not complete; do not retry write.'), {
    testCode: 'JOB_COMPLETION_UNCONFIRMED',
  });
}
try {
  const connected = await measure(
    'A261-001',
    async () => {
      await client.connect(
        new StdioClientTransport({ command: process.execPath, args: [runtime], stderr: 'pipe' }),
      );
      return client.listTools();
    },
    (r) => {
      assert.equal(r.tools.length, 10);
      assert.equal(new Set(r.tools.map((t) => t.name)).size, 10);
    },
  );
  if (!connected) throw Object.assign(new Error('MCP unavailable.'), { testCode: 'MCP_UNAVAILABLE' });
  await measure('A261-002', () => call('apexrest_status', { detail: 'doctor', project }), success);
  await measure(
    'A261-003',
    () => call('apexrest_project', { action: 'inspect', project, detail: 'summary' }),
    success,
    samples,
  );
  await measure(
    'A261-004',
    () => call('apexrest_project', { action: 'connection_test', name: target.readConnectionRef, project }),
    (r) => {
      success(r);
      assert.equal(r.data.db_unique_name, target.databaseIdentity.dbUniqueName);
      assert.equal(r.data.service_name, target.databaseIdentity.serviceName);
      assert.equal(r.data.parsing_schema, target.parsingSchema);
    },
  );
  const request = (kind, extra = {}) => ({ kind, schema: target.parsingSchema, limit: 30, ...extra });
  const identity = await measure(
    'A261-005',
    () =>
      call('apexrest_metadata_read', {
        project,
        env,
        requests: [request('applications'), request('pages'), request('apex-capabilities')],
      }),
    (r) => {
      success(r);
      assert.equal(r.data.targetVerifiedOnce, true);
      assert.equal(r.data.results.length, 3);
      assert.equal(r.data.results[0].rows.length, 1);
      assert.equal(r.data.results[0].rows[0].application_id, target.applicationId);
      assert.ok(r.data.results[1].rows.length > 0);
      const serialized = JSON.stringify(r.data.results[2].rows);
      assert.match(serialized, /26\.1(?:\.|\")/, 'Connected release must be 26.1.');
    },
    samples,
  );
  if (!identity)
    throw Object.assign(new Error('Target/release unconfirmed.'), { testCode: 'TARGET_RELEASE_UNCONFIRMED' });
  await measure(
    'A261-006',
    async () => {
      const first = await call('apexrest_metadata_read', { project, env, ...request('pages', { limit: 1 }) });
      success(first);
      const second = await call('apexrest_metadata_read', {
        project,
        env,
        ...request('pages', { limit: 1, offset: first.data.nextOffset }),
      });
      return { first, second };
    },
    ({ first, second }) => {
      success(second);
      assert.equal(first.data.rows.length, 1);
      assert.equal(first.data.nextOffset, 1);
      assert.equal(first.data.dataClassification, 'untrusted_database_content');
      assert.equal(second.data.offset, 1);
      assert.equal(second.data.rows.length, 1);
      assert.notEqual(first.data.rows[0].page_id, second.data.rows[0].page_id);
    },
  );
  await measure(
    'A261-007',
    () => call('apexrest_metadata_read', { project, env, kind: 'objects', schema: 'OTHER_SCHEMA' }),
    rejected('SCHEMA_DENIED'),
  );
  await measure(
    'A261-008',
    () => call('apexrest_metadata_read', { project, env, ...request('columns') }),
    rejected('OBJECT_REQUIRED'),
  );
  for (const [id, corpus, query] of [
    ['A261-009', 'apexlang', 'page'],
    ['A261-010', 'components', 'interactive report'],
    ['A261-011', 'patterns', 'dashboard'],
    ['A261-012', 'blocks', 'list'],
    ['A261-013', 'blueprints', 'crm'],
  ])
    await measure(
      id,
      () =>
        call('apexrest_reference', {
          mode: 'search',
          query,
          corpus,
          limit: 3,
          project,
          ...(['blocks', 'blueprints'].includes(corpus)
            ? { profile: 'profile:apex261-ut261-mmd3102' }
            : { version: '26.1' }),
        }),
      (r) => {
        success(r);
        assert.ok(Array.isArray(r.data) && r.data.length > 0);
        assert.ok(r.data.length <= 3);
      },
      samples,
    );
  await measure(
    'A261-014',
    () =>
      call('apexrest_reference', { mode: 'read', id: 'grammar:page', version: '26.1', limit: 512, project }),
    success,
    samples,
  );
  await measure('A261-015', () => call('apexrest_apex_sync', { action: 'status', project, env }), success);
  if (values['initialize-baseline'])
    await measure(
      'A261-016',
      async () =>
        finishJob(await call('apexrest_apex_sync', { action: 'init', project, env, waitSeconds: 0 })),
      success,
    );
  await measure(
    'A261-017',
    () => call('apexrest_apex_validate', { project }),
    (r) => {
      success(r);
      assert.ok(r.data, 'Compiler result required.');
    },
  );
  const requestText =
    values['user-request'] ?? 'Read-only APEX 26.1 plugin qualification: compile and plan only; no apply.';
  await measure(
    'A261-018',
    async () =>
      finishJob(
        await call('apexrest_ship', {
          project,
          env,
          mode: 'plan',
          importMode: 'full',
          userRequest: requestText,
          waitSeconds: 0,
        }),
      ),
    success,
  );
  if (values['allow-app-writes']) {
    // The adopted baseline is the only source. Do not introduce DB scripts or change security.
    await measure(
      'A261-019',
      async () =>
        finishJob(
          await call('apexrest_ship', {
            project,
            env,
            mode: 'apply',
            importMode: 'full',
            userRequest: requestText,
            waitSeconds: 0,
          }),
        ),
      (r) => {
        success(r);
        assert.equal(r.data.grant?.removed, true);
      },
    );
  }
  await measure(
    'A261-020',
    () => call('apexrest_browser_open', { project, env }),
    (r) => {
      success(r);
      assert.ok(JSON.stringify(r.data).includes(target.baseUrl));
    },
  );
  await measure(
    'A261-021',
    () => call('apexrest_job', { project, action: 'status', jobId: '00000000-0000-0000-0000-000000000000' }),
    rejected('JOB_NOT_FOUND'),
  );
  await measure(
    'A261-022',
    () => call('apexrest_artifact_read', { project, id: 'unknown', offset: 0, limit: 128 }),
    rejected('ARTIFACT_NOT_FOUND', 'INVALID_INPUT', 'ARTIFACT_REFERENCE_INVALID'),
  );
} catch (error) {
  evidence.blocker = error.testCode ?? 'RUN_FAILED';
} finally {
  await client.close().catch(() => {
    evidence.closeFailed = true;
  });
  const executed = new Set(evidence.checks.map((c) => c.id));
  evidence.notRun = catalog.cases
    .filter((c) => !executed.has(c.id))
    .map((c) => ({
      id: c.id,
      reason:
        c.execution === 'manual'
          ? 'Requires agent-led scenario and applicable authorization.'
          : 'Not reached or option not enabled.',
    }));
  evidence.finishedAt = new Date().toISOString();
  evidence.wallTimeMs = performance.now() - start;
  evidence.mcpCalls = calls;
  evidence.tokens = tokenDelta(before, await tokenSnapshot(usageSelection(values)));
  evidence.status =
    evidence.blocker || evidence.checks.some((c) => c.status === 'failed') ? 'failed' : 'partial';
  await savePrivateJson(output, evidence);
  console.log(
    JSON.stringify({
      status: evidence.status,
      checks: evidence.checks.length,
      mcpCalls: calls,
      evidence: output,
      blocker: evidence.blocker,
    }),
  );
  process.exitCode = evidence.status === 'failed' ? 1 : 0;
}
