import { loadHarness, inspectResponse } from './lib/plugin-harness.mjs';
import { parseArgs } from 'node:util';
import { readFile, writeFile, realpath, readdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { sha256, sourceDigest } from './lib/release.mjs';
import {
  savePrivateJson,
  tokenSnapshot,
  usageSelection,
  tokenDelta,
  statistics,
} from './lib/plugin-test-metrics.mjs';

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    env: { type: 'string', default: 'test' },
    mode: { type: 'string', default: 'plan' },
    page: { type: 'string', default: 'pages/p00001-home.apx' },
    rollout: { type: 'string' },
    transcript: { type: 'string' },
    'usage-source': { type: 'string' },
    'user-request': { type: 'string' },
  },
});
assert.ok(values.project && ['plan', 'apply'].includes(values.mode));
assert.ok(
  values.mode !== 'apply' || values['user-request'],
  'Apply requires explicit human application-import authorization.',
);
const project = await realpath(values.project);
const config = JSON.parse(await readFile(path.join(project, 'apexrest.json'), 'utf8'));
const target = config.environments[values.env];
assert.equal(config.toolchain.profile, '26.1');
assert.ok(target && ['test', 'dev', 'development', 'qa'].includes(target.kind));
for (const dir of Object.values(config.database))
  assert.equal(
    (await readdir(path.join(project, dir))).length,
    0,
    'Application-only tests require empty database inputs.',
  );
const sourceRoot = await realpath(path.join(project, config.application.sourceDir));
const page = await realpath(path.resolve(sourceRoot, values.page));
assert.ok(page.startsWith(sourceRoot + path.sep) && /^pages\/p\d+[^/]*\.apx$/.test(values.page));
const preparedFile = path.join(project, '.apexrest/plugin-tests/import-prepared.json');
const output = 'docs/evidence/plugin-server/imports-261.json';
const { quality } = await loadHarness({});
const report = {
  schemaVersion: 1,
  apexProfile: '26.1',
  sourceDigest: await sourceDigest(),
  startedAt: new Date().toISOString(),
  target: {
    applicationId: target.applicationId,
    workspace: target.workspace,
    parsingSchema: target.parsingSchema,
  },
  mode: values.mode,
  changedFiles: [values.page],
  responseChecks: [],
  checks: [],
  status: 'running',
};
const usage = await tokenSnapshot(usageSelection(values)),
  started = performance.now();
let client,
  calls = 0;
async function connect() {
  client = new Client({ name: 'apexrest-261-import-cases', version: '1.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve('dist/runtime/mcp.mjs')],
      stderr: 'pipe',
    }),
  );
}
async function call(name, args) {
  calls++;
  let r = JSON.parse(
    (await client.callTool({ name, arguments: args }, undefined, { timeout: 600000 })).content[0].text,
  );
  report.responseChecks.push(inspectResponse(quality, name, args, r));
  const jobId = r.data?.jobId ?? r.data?.id;
  for (
    let i = 0;
    !r.data?.result && ['queued', 'running', 'outcome_unknown'].includes(r.data?.status) && i < 30;
    i++
  ) {
    assert.ok(jobId);
    calls++;
    r = JSON.parse(
      (
        await client.callTool(
          { name: 'apexrest_job', arguments: { action: 'status', project, jobId, waitSeconds: 20 } },
          undefined,
          { timeout: 600000 },
        )
      ).content[0].text,
    );
    report.responseChecks.push(inspectResponse(quality, 'apexrest_job', { action: 'status' }, r));
  }
  const result = r.data?.result ?? r;
  return result;
}
function passed(r) {
  if (!r.ok || r.status !== 'succeeded')
    throw Object.assign(
      new Error('Import scenario stopped; preserve original run and reconcile before retry.'),
      { code: r.diagnostics?.[0]?.code ?? 'OUTCOME_UNCONFIRMED', runId: r.runId },
    );
}
const ship = (mode, extra = {}) =>
  call('apexrest_ship', {
    project,
    env: values.env,
    mode,
    importMode: 'full',
    userRequest:
      values['user-request'] ?? 'Read-only review of APEX 26.1 page-title test plan; no import authorized.',
    waitSeconds: 0,
    ...extra,
  });
try {
  await connect();
  if (values.mode === 'plan') {
    let prior;
    try {
      prior = JSON.parse(await readFile(preparedFile, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const current = await readFile(page, 'utf8');
    if (prior) {
      assert.equal(prior.page, values.page);
      assert.equal(sha256(prior.original), prior.originalDigest);
      assert.ok(
        [prior.originalDigest, prior.changedDigest].includes(sha256(current)),
        'Prepared source drifted; preserve and review it before replanning.',
      );
    }
    const original = prior?.original ?? current;
    assert.match(original, /^    title: .+$/m);
    const marker = 'APEXREST 26.1 plugin test cycle 1';
    // Preserve original bytes even if planning fails after the local edit.
    await savePrivateJson(preparedFile, {
      original,
      originalDigest: sha256(original),
      page: values.page,
      changedDigest: sha256(original.replace(/^    title: .+$/m, '    title: ' + marker)),
    });
    await writeFile(page, original.replace(/^    title: .+$/m, '    title: ' + marker), { mode: 0o600 });
    const planned = await ship('plan');
    passed(planned);
    assert.deepEqual(planned.data.risks, []);
    assert.equal(planned.data.sources.migrations, 0);
    assert.equal(planned.data.sources.packages, 0);
    assert.equal(planned.data.importSelection.resolvedMode, 'full');
    await savePrivateJson(preparedFile, {
      original,
      originalDigest: sha256(original),
      marker,
      changedDigest: sha256(await readFile(page)),
      page: values.page,
      planPath: planned.data.planPath,
      planDigest: planned.data.planDigest,
      expiresAt: planned.data.expiresAt,
    });
    report.prepared = {
      page: values.page,
      marker,
      planPath: planned.data.planPath,
      planDigest: planned.data.planDigest,
      expiresAt: planned.data.expiresAt,
      importMode: 'full',
      risks: [],
      migrations: 0,
      packages: 0,
      backupRequired: planned.data.backupRequired,
    };
    report.status = 'awaiting-import-authorization';
  } else {
    const prepared = JSON.parse(await readFile(preparedFile, 'utf8'));
    assert.equal(prepared.page, values.page);
    assert.equal(sha256(prepared.original), prepared.originalDigest);
    assert.equal(
      sha256(await readFile(page)),
      prepared.changedDigest,
      'Prepared source drifted; review a new plan.',
    );
    const timings = [];
    for (let cycle = 1; cycle <= 3; cycle++) {
      if (cycle > 1) {
        await client.close();
        await connect();
        await writeFile(
          page,
          prepared.original.replace(
            /^    title: .+$/m,
            '    title: APEXREST 26.1 plugin test cycle ' + cycle,
          ),
        );
      }
      const began = performance.now();
      const r = await ship('apply', cycle === 1 ? { plan: prepared.planPath } : {});
      passed(r);
      assert.equal(r.data.grant?.removed, true);
      timings.push(performance.now() - began);
      report.checks.push({
        id: 'A261-028',
        cycle,
        status: 'passed',
        runId: r.data?.runId,
        operationRunId: r.runId,
        deploymentRunId: r.data.runId,
        grantRemoved: true,
        wallTimeMs: timings.at(-1),
        serverEvidence: 'Plugin confirmed full-import server verification; no browser claim.',
      });
      await savePrivateJson(output, report);
      console.log(
        JSON.stringify({ case: 'A261-028', cycle, status: 'passed', wallTimeMs: Math.round(timings.at(-1)) }),
      );
    }
    // Restore through the ordinary fresh-plan pipeline, only after all imports were confirmed.
    await writeFile(page, prepared.original);
    const restoreStart = performance.now();
    const restored = await ship('apply');
    passed(restored);
    assert.equal(restored.data.grant?.removed, true);
    report.checks.push({
      id: 'A261-032',
      status: 'partial',
      scope: 'Fresh application ship of original title; not the separate backup-restore command.',
      wallTimeMs: performance.now() - restoreStart,
      runId: restored.runId,
      originalLocalBytesRestored: sha256(await readFile(page)) === prepared.originalDigest,
    });
    report.latency = statistics(timings);
    report.status = 'passed-scoped-imports';
  }
} catch (error) {
  report.status = 'blocked';
  report.blocker = error.code ?? 'SCENARIO_FAILED';
  report.originalRun = error.runId;
  report.operationRunId = error.operationRunId;
  report.recovery =
    'Preserve staged desired source, preparation backup and durable journals. Reconcile actual server state with the original run before any import or cleanup.';
} finally {
  await client?.close().catch(() => {});
  report.finishedAt = new Date().toISOString();
  report.wallTimeMs = performance.now() - started;
  report.mcpCalls = calls;
  report.tokens = tokenDelta(usage, await tokenSnapshot(usageSelection(values)));
  await savePrivateJson(output, report);
  console.log(
    JSON.stringify({
      status: report.status,
      evidence: output,
      blocker: report.blocker,
      prepared: report.prepared,
    }),
  );
  process.exitCode = report.status === 'blocked' ? 1 : 0;
}
