// Read-only quality/performance extension. Unsupported prerequisites stay explicit.
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import {
  loadHarness,
  inspectResponse,
  prerequisite,
  regressionGate,
  machineFingerprint,
  connectHarness,
  privateCopy,
  fileInventory,
  runProcess,
  coreHelpers,
} from './lib/plugin-harness.mjs';
import { savePrivateJson, statistics } from './lib/plugin-test-metrics.mjs';
import { sha256, sourceDigest } from './lib/release.mjs';

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    env: { type: 'string', default: 'test' },
    profile: { type: 'string' },
    catalog: { type: 'string' },
    samples: { type: 'string', default: '20' },
    cases: { type: 'string' },
    output: { type: 'string', default: 'docs/evidence/qp-harness/quality-26.1.json' },
    'allow-app-writes': { type: 'boolean', default: false },
    'user-request': { type: 'string' },
  },
});
assert.ok(values.project);
assert.ok(!values['allow-app-writes'] || values['user-request']);
const project = path.resolve(values.project),
  output = path.resolve(values.output),
  directory = path.dirname(output),
  selection = await loadHarness(values);
assert.ok(output.startsWith(path.resolve('docs/evidence') + path.sep));
const config = JSON.parse(await readFile(path.join(project, 'apexrest.json'), 'utf8')),
  target = config.environments[values.env];
assert.equal(config.toolchain.profile, selection.profile);
assert.ok(['dev', 'development', 'test', 'qa'].includes(target?.kind));
const samples = Number(values.samples);
assert.ok(Number.isInteger(samples) && samples >= 20 && samples <= 30);
const ids = values.cases?.split(',');
const enabled = (id) => !ids || ids.includes(id);
const report = {
  schemaVersion: 1,
  suite: selection.catalog.suite,
  apexProfile: selection.profile,
  catalogDigest: selection.catalogDigest,
  sourceDigest: await sourceDigest(),
  runtimeDigest: sha256(await readFile('dist/runtime/mcp.mjs')),
  startedAt: new Date().toISOString(),
  executionSurface: 'current-build stdio MCP; read-only Oracle and offline private source copies',
  environment: {
    machine: machineFingerprint(),
    target: {
      applicationId: target.applicationId,
      workspace: target.workspace,
      schema: target.parsingSchema,
    },
  },
  checks: [],
  measurements: [],
  responseChecks: [],
  findings: [],
  mutation: false,
  tokens: { available: false, reason: 'No model host in this harness.' },
};
const h = await connectHarness(),
  timings = (r) => r.data?.sqlclTimings ?? r.data?.details?.sqlclTimings ?? [];
const req = (kind, extra = {}) => ({ kind, schema: target.parsingSchema, limit: 30, ...extra });
const planArgs = {
  project,
  env: values.env,
  mode: 'plan',
  importMode: 'full',
  userRequest: 'Read-only quality/performance qualification; no apply.',
  debugTimings: true,
};
function success(r) {
  assert.equal(r.ok, true, r.diagnostics?.[0]?.code);
}
async function call(name, args) {
  const r = await h.call(name, args);
  report.responseChecks.push(inspectResponse(selection.quality, name, args, r));
  return r;
}
async function metadata(requests) {
  return call('apexrest_metadata_read', { project, env: values.env, requests, debugTimings: true });
}
async function save() {
  await savePrivateJson(output, report);
}
async function notRun(id, reason) {
  report.checks.push({ id, status: 'not_run', reason });
  await save();
}
async function measure(id, scenario, invoke, verify, count = 1, warmup = false) {
  const m = { id, scenario, samples: [], warmup: null, status: 'running' };
  report.measurements.push(m);
  for (let i = warmup ? 0 : 1; i <= count; i++) {
    const start = performance.now();
    let sample = { iteration: i, excluded: i === 0 };
    try {
      const r = await invoke(i);
      sample.sqlclTimings = timings(r);
      sample.responseBytes = Buffer.byteLength(JSON.stringify(r));
      await verify(r, sample);
      sample.status = 'passed';
    } catch (e) {
      sample.status = 'failed';
      sample.code = e.code ?? e.testCode ?? 'EXPECTATION_FAILED';
    }
    sample.elapsedMs = performance.now() - start;
    if (i === 0) m.warmup = sample;
    else m.samples.push(sample);
    await save();
    // Do not run 20 repeated dependency failures. Preserve the unmet count.
    if (i === 0 && sample.status === 'failed') {
      m.remainingNotRun = count;
      break;
    }
  }
  m.status = [m.warmup, ...m.samples].filter(Boolean).some((s) => s.status === 'failed')
    ? 'failed'
    : 'passed';
  m.latency = statistics(m.samples.map((s) => s.elapsedMs));
  report.checks.push({ id, scenario, status: m.status });
  await save();
  console.log(JSON.stringify({ id, scenario, status: m.status, medianMs: m.latency.medianMs }));
  return m;
}
function safeTimings(r) {
  const records = timings(r);
  for (const t of records) {
    assert.equal(t.mutation, false);
    assert.ok(Number.isFinite(t.queueMs));
    assert.ok(
      Object.keys(t).every((k) =>
        [
          'label',
          'queueMs',
          'statementMs',
          'spawnMs',
          'connectMs',
          'executeMs',
          'totalMs',
          'reused',
          'mutation',
          'connected',
          'transport',
        ].includes(k),
      ),
    );
    assert.ok(
      Object.values(t)
        .filter((v) => typeof v === 'string')
        .every((v) => v !== target.parsingSchema && !/select\s|password|binding|username/i.test(v)),
    );
  }
  return records;
}
function verifyMeta(requests, r) {
  success(r);
  assert.equal(r.data.results.length, requests.length);
  r.data.results.forEach((result, i) => {
    assert.equal(result.kind, requests[i].kind);
    if (requests[i].kind === 'applications')
      assert.equal(result.rows[0]?.application_id, target.applicationId);
    if (requests[i].kind === 'pages')
      assert.ok(result.rows.every((row) => row.application_id === target.applicationId));
  });
  const t = safeTimings(r);
  assert.equal(t.filter((t) => t.connected).length, 1);
  assert.equal(t[0].statementMs.length, requests.length + 1);
}
async function cli(op, args) {
  const argv = [path.resolve('dist/runtime/apexrest.mjs'), ...op.split(' '), '--project', project, '--json'];
  for (const [k, v] of Object.entries(args)) {
    argv.push(
      '--' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()),
      ...(Array.isArray(v) ? v.map(String) : [String(v)]),
    );
  }
  const r = await runProcess(process.execPath, argv);
  let envelope;
  try {
    envelope = JSON.parse(r.stdout);
  } catch {
    throw Object.assign(new Error('CLI envelope missing'), { code: 'CLI_ENVELOPE_MISSING' });
  }
  return { envelope, exitCode: r.code };
}
try {
  const doctor = await call('apexrest_status', { detail: 'doctor', project });
  success(doctor);
  report.environment.sqlcl =
    doctor.data.sqlcl ??
    doctor.data.probes?.find((p) => /sqlcl/i.test(p.name ?? ''))?.version ??
    doctor.data.probes;
  const identity = await metadata([req('applications'), req('pages'), req('apex-capabilities')]);
  verifyMeta([req('applications'), req('pages'), req('apex-capabilities')], identity);
  assert.match(
    JSON.stringify(identity.data.results[2].rows),
    new RegExp(selection.profile.replace('.', '\\.')),
  );
  const objects = await metadata([req('objects', { limit: 100 })]);
  success(objects);
  const table = objects.data.results[0].rows.find((r) => r.object_type === 'TABLE')?.object_name;
  const packageName = objects.data.results[0].rows.find((r) => r.object_type === 'PACKAGE')?.object_name;
  report.objectPrerequisites = {
    tableFound: !!table,
    packageFound: !!packageName,
    signatureEmptyProbe: !packageName,
  };
  const kinds = [
    'objects',
    'columns',
    'constraints',
    'constraint-columns',
    'signatures',
    'applications',
    'pages',
    'apex-capabilities',
  ];
  const requests = kinds.map((kind) =>
    req(
      kind,
      ['columns', 'constraints', 'constraint-columns'].includes(kind)
        ? { name: table ?? 'APEXREST_MISSING_TABLE' }
        : kind === 'signatures'
          ? { name: packageName ?? 'APEXREST_MISSING_PACKAGE' }
          : {},
    ),
  );
  if (enabled('A261-050')) {
    const budget = JSON.parse(await readFile('tests/plugin-server/apex-26.1.cases.json', 'utf8')).cases.find(
      (c) => c.id === 'A261-050',
    ).sessionBudget;
    for (const [scenario, name, args, connected, offline] of [
      [
        'connectionTest',
        'apexrest_project',
        { project, action: 'connection_test', name: target.readConnectionRef, debugTimings: true },
        budget.connectionTest,
        0,
      ],
      [
        'metadataBatch',
        'apexrest_metadata_read',
        {
          project,
          env: values.env,
          requests: [req('applications'), req('pages'), req('apex-capabilities')],
          debugTimings: true,
        },
        budget.metadataBatch,
        0,
      ],
      [
        'metadataSingle',
        'apexrest_metadata_read',
        { project, env: values.env, ...req('pages'), debugTimings: true },
        budget.metadataSingle,
        0,
      ],
      ['plan', 'apexrest_ship', planArgs, budget.planConnected, budget.planOffline],
      [
        'syncStatus',
        'apexrest_apex_sync',
        { project, env: values.env, action: 'status', debugTimings: true },
        budget.syncStatus,
        0,
      ],
    ])
      await measure(
        'A261-050',
        scenario,
        () => call(name, args),
        (r) => {
          success(r);
          const t = safeTimings(r);
          assert.equal(t.filter((x) => x.connected).length, connected);
          const o = t.filter((x) => !x.connected);
          assert.ok(o.length <= offline);
          assert.ok(o.every((x) => x.reused));
        },
        samples,
        true,
      );
  }
  if (enabled('A261-052')) {
    for (const request of requests)
      await measure(
        'A261-052',
        request.kind,
        () => metadata([request]),
        (r, s) => {
          verifyMeta([request], r);
          s.statementMs = timings(r)[0].statementMs.slice(1);
        },
        samples,
        true,
      );
    await measure(
      'A261-052',
      'all-kinds',
      () => metadata(requests),
      (r, s) => {
        verifyMeta(requests, r);
        s.statementMs = timings(r)[0].statementMs.slice(1);
        s.unattributedMs = timings(r)[0].executeMs - timings(r)[0].statementMs.reduce((a, b) => a + b, 0);
      },
      samples,
    );
    report.statementSummary = report.measurements
      .filter((m) => m.id === 'A261-052')
      .map((m) => ({
        kind: m.scenario,
        latency: m.latency,
        statementLatency: statistics(m.samples.flatMap((s) => s.statementMs ?? [])),
      }));
  }
  if (enabled('A261-055')) {
    const operations = [
      ...['objects', 'applications', 'pages', 'apex-capabilities'].map((kind) => ({
        name: 'apexrest_metadata_read',
        args: { project, env: values.env, requests: [req(kind)], debugTimings: true },
        verify: (r) => verifyMeta([req(kind)], r),
      })),
      { name: 'apexrest_ship', args: planArgs, verify: success },
      { name: 'apexrest_apex_validate', args: { project, debugTimings: true }, verify: success },
    ];
    const singles = [];
    for (const op of operations) {
      const m = await measure(
        'A261-055',
        'single-' + op.name + '-' + (op.args.requests?.[0]?.kind ?? ''),
        () => call(op.name, op.args),
        op.verify,
        3,
      );
      singles.push(m.latency.medianMs);
    }
    await measure(
      'A261-055',
      'parallel-six',
      async () => {
        const start = performance.now();
        const responses = await Promise.all(
          operations.map(async (op) => {
            const r = await call(op.name, op.args);
            op.verify(r);
            safeTimings(r);
            return r;
          }),
        );
        return {
          ok: true,
          data: {
            wallMs: performance.now() - start,
            sumSingleMedians: singles.reduce((a, b) => a + b, 0),
            sqlclTimings: responses.flatMap(timings),
          },
        };
      },
      (r, s) => {
        success(r);
        s.roundVsSerial = r.data.wallMs / r.data.sumSingleMedians;
        s.queueMs = timings(r).map((t) => t.queueMs);
        assert.ok(r.data.wallMs <= r.data.sumSingleMedians);
      },
      10,
    );
  }
  if (enabled('A261-057')) {
    let fingerprint;
    await measure(
      'A261-057',
      'stable-plans',
      () => call('apexrest_ship', planArgs),
      (r, s) => {
        success(r);
        const digest = r.data?.plan?.targetDigest ?? r.data?.targetDigest;
        assert.ok(digest, 'Target digest missing');
        fingerprint ??= digest;
        assert.equal(digest, fingerprint);
        s.targetDigest = digest;
      },
      20,
      true,
    );
    const sourceBefore = await fileInventory(path.join(project, config.application.sourceDir));
    let exportDigest;
    await measure(
      'A261-057',
      'independent-exports',
      async (i) => {
        const relative = path.join('.apexrest', 'qp-exports', selection.profile + '-' + Date.now() + '-' + i);
        return (await cli('apex export', { env: values.env, output: relative })).envelope;
      },
      async (r, s) => {
        success(r);
        const artifact = r.data?.directory ?? r.data?.path;
        s.exportDestinationReported = !!artifact;
      },
      3,
    );
    assert.deepEqual(await fileInventory(path.join(project, config.application.sourceDir)), sourceBefore);
    // Hash exported directories separately; output path is generated locally, never derived from untrusted Oracle content.
    const root = path.join(project, '.apexrest', 'qp-exports');
    for (const name of await readdir(root).catch(() => [])) {
      if (!name.startsWith(selection.profile + '-')) continue;
      const digest = sha256(JSON.stringify(await fileInventory(path.join(root, name))));
      exportDigest ??= digest;
      if (digest !== exportDigest)
        report.findings.push({ id: 'A261-057', reason: 'Independent export bytes differ.' });
    }
  }
  if (enabled('A261-058')) {
    const copy = await privateCopy(project, path.join(directory, 'negative-' + selection.profile));
    const c = structuredClone(config);
    c.environments[values.env].workspace = target.workspace.toLowerCase();
    await writeFile(path.join(copy, 'apexrest.json'), JSON.stringify(c));
    const negatives = [
      [
        'unknown-connection',
        'apexrest_project',
        { project, action: 'connection_test', name: 'qp-missing-reference' },
        'connection test',
        { name: 'qp-missing-reference' },
      ],
      [
        'workspace-case',
        'apexrest_metadata_read',
        { project: copy, env: values.env, ...req('pages') },
        'metadata read',
        { project: copy, env: values.env, ...req('pages') },
      ],
      [
        'foreign-schema',
        'apexrest_metadata_read',
        { project, env: values.env, kind: 'objects', schema: 'OTHER_SCHEMA' },
        'metadata read',
        { env: values.env, kind: 'objects', schema: 'OTHER_SCHEMA' },
      ],
      [
        'missing-object',
        'apexrest_metadata_read',
        { project, env: values.env, ...req('columns') },
        'metadata read',
        { env: values.env, ...req('columns') },
      ],
      [
        'missing-job',
        'apexrest_job',
        { project, action: 'status', jobId: '00000000-0000-0000-0000-000000000000' },
        'jobs status',
        { id: '00000000-0000-0000-0000-000000000000' },
      ],
    ];
    if (selection.profile === '26.1')
      negatives.push([
        'explicit-files',
        'apexrest_ship',
        { ...planArgs, importMode: 'files', files: ['pages/p00001-home.apx'] },
        'ship',
        {
          env: values.env,
          mode: 'plan',
          importMode: 'files',
          files: ['pages/p00001-home.apx'],
          userRequest: planArgs.userRequest,
        },
      ]);
    const helpers = await coreHelpers(directory);
    let secrets = [];
    try {
      const env = await helpers.readLocalEnv(path.resolve('test.env'));
      secrets = Object.entries(env)
        .filter(([k]) => /password|token|secret/i.test(k))
        .map(([, v]) => v)
        .filter((v) => v.length >= 4);
    } catch {
      report.findings.push({
        id: 'A261-058',
        reason:
          'Saved-connection password is not exposed by connection resolution; ENV secret scan only when readable.',
      });
    }
    for (const [id, name, args, op, cliArgs] of negatives)
      await measure(
        'A261-058',
        id,
        async () => {
          const mcp = await call(name, args),
            binary = await cli(op, cliArgs);
          return { mcp, cli: binary.envelope, exitCode: binary.exitCode };
        },
        (r, s) => {
          s.codes = [r.mcp.diagnostics?.[0]?.code, r.cli.diagnostics?.[0]?.code];
          s.exitClasses = [r.mcp.exitCode, r.exitCode];
          s.nextSteps = [r.mcp.nextActions?.length ?? 0, r.cli.nextActions?.length ?? 0];
          assert.equal(r.mcp.ok, false);
          assert.equal(r.cli.ok, false);
          assert.deepEqual(s.codes, [s.codes[0], s.codes[0]]);
          assert.deepEqual(s.exitClasses, [s.exitClasses[0], s.exitClasses[0]]);
          for (const result of [r.mcp, r.cli]) {
            assert.ok(result.nextActions?.length > 0);
            assert.ok(
              Buffer.byteLength(JSON.stringify(result)) <= selection.quality.responseByteBudgets.error,
            );
            assert.ok(!secrets.some((secret) => JSON.stringify(result).includes(secret)));
          }
        },
      );
    await notRun(
      'A261-058:expired-plan',
      'Expiry is checked by apply; this read-only task forbids connected apply paths.',
    );
    await notRun(
      'A261-058:tampered-plan',
      'Digest is checked by apply; no read-only plan-verification operation exists.',
    );
  }
  if (enabled('A261-059')) {
    const source = path.join(project, config.application.sourceDir),
      files = Object.keys(await fileInventory(source));
    const home = files.find((f) => /p00001.*\.apx$/.test(f));
    assert.ok(home);
    const original = await readFile(path.join(source, home), 'utf8');
    const patches = [
      ['unknown-property', (s) => s.replace('    name:', '    qpUnknownProperty: true\n    name:')],
      ['invalid-region-type', (s) => s.replace('type: staticContent', 'type: qpInvalidRegion')],
      [
        'missing-item',
        (s) =>
          s.replace('    navigation {', '    navigation {\n        warnOnUnsavedChanges: @P1_QP_MISSING'),
      ],
      [
        'duplicate-static-id',
        (s) =>
          s.replace(
            '        type: staticContent',
            '        staticId: qpDuplicate\n        staticId: qpDuplicate\n        type: staticContent',
          ),
      ],
      [
        'invalid-sql',
        (s) =>
          s.replace(
            'type: staticContent',
            'type: report\n        source { type: sqlQuery sqlQuery: "select qp_missing from qp_no_table" }',
          ),
      ],
      ['broken-indent', (s) => s.replace('    name:', '   name:')],
    ];
    for (const [id, patch] of patches) {
      const copy = await privateCopy(project, path.join(directory, 'faults', selection.profile, id));
      const injected = patch(original);
      assert.notEqual(injected, original);
      const line = injected.split('\n').findIndex((l, i) => l !== original.split('\n')[i]) + 1;
      await writeFile(path.join(copy, config.application.sourceDir, home), injected);
      const bad = await call('apexrest_apex_validate', { project: copy, debugTimings: true });
      if (enabled('A261-058') && id === 'unknown-property')
        await measure(
          'A261-058',
          'compiler-syntax',
          async () => {
            const b = await cli('apex validate', { project: copy });
            return { mcp: bad, cli: b.envelope, exitCode: b.exitCode };
          },
          (r) => {
            assert.equal(r.mcp.ok, false);
            assert.equal(r.cli.diagnostics?.[0]?.code, r.mcp.diagnostics?.[0]?.code);
            assert.equal(r.exitCode, r.mcp.exitCode);
            assert.ok(r.mcp.nextActions?.length);
            assert.ok(Buffer.byteLength(JSON.stringify(r.cli)) <= 2048);
          },
        );
      await writeFile(path.join(copy, config.application.sourceDir, home), original);
      await measure(
        'A261-059',
        id,
        () => call('apexrest_apex_validate', { project: copy, debugTimings: true }),
        (good, s) => {
          s.injectedLine = line;
          s.reported = bad.diagnostics?.map((d) => ({
            code: d.code,
            file: d.file,
            line: d.line,
            severity: d.severity,
          }));
          s.faultRejected = bad.ok === false;
          success(good);
          assert.equal(timings(bad).filter((t) => t.connected).length, 0);
          assert.equal(timings(good).filter((t) => t.connected).length, 0);
          assert.equal(bad.ok, false);
          assert.ok(
            bad.diagnostics.some(
              (d) => d.severity === 'error' && d.file?.endsWith(home) && Math.abs(d.line - line) <= 2,
            ),
          );
        },
      );
    }
  }
  if (enabled('A261-060')) {
    const r = await call('apexrest_ship', { ...planArgs, waitSeconds: 0 });
    success(r);
    if (!r.data?.jobId)
      await notRun(
        'A261-060',
        'ship mode=plan executes inline and supplies no job ID/completion timestamp; long-polling an apply job would violate this read-only scope.',
      );
    else {
      await notRun(
        'A261-060',
        'Read-only job completion timestamp schema must be confirmed before qualified overhead measurements.',
      );
    }
  }
  if (enabled('A261-062')) {
    const pid = h.transport.pid,
      owned = new Set();
    async function processes() {
      const r = await runProcess('ps', ['-axo', 'pid=,ppid=,rss=,comm=']);
      return r.stdout
        .trim()
        .split('\n')
        .map((l) => {
          const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(l);
          return m ? { pid: +m[1], ppid: +m[2], rss: +m[3], command: m[4] } : null;
        })
        .filter(Boolean);
    }
    async function observe() {
      const rows = await processes();
      const parents = new Set([pid]);
      let changed;
      do {
        changed = false;
        for (const r of rows)
          if (parents.has(r.ppid) && !parents.has(r.pid)) {
            parents.add(r.pid);
            changed = true;
            if (/java/.test(r.command)) owned.add(r.pid);
          }
      } while (changed);
      return rows;
    }
    async function fds() {
      const r = await runProcess('lsof', ['-p', String(pid), '-F', 'f'], { timeoutMs: 5000 });
      return r.code === 0 ? r.stdout.split('\n').filter((l) => /^f\d/.test(l)).length : null;
    }
    const stageRoot = path.join(process.env.APEXREST_HOME ?? path.join(os.homedir(), '.apexrest'), 'staging'),
      stages = async () => readdir(stageRoot).catch(() => []);
    const before = await observe(),
      beforeFds = await fds(),
      beforeStages = await stages();
    let observing = false;
    const timer = setInterval(() => {
      if (!observing) {
        observing = true;
        observe().finally(() => {
          observing = false;
        });
      }
    }, 500);
    const m = await measure(
      'A261-062',
      '120-reads',
      () => metadata([req('pages')]),
      (r) => verifyMeta([req('pages')], r),
      120,
    );
    clearInterval(timer);
    const after = await observe(),
      afterFds = await fds(),
      afterStages = await stages();
    await h.client.close();
    const closed = await processes();
    report.resources = {
      serverPid: pid,
      observedOwnedSqlclPids: [...owned],
      orphanedOwnedSqlclPids: closed.filter((r) => owned.has(r.pid)).map((r) => r.pid),
      rssBeforeKiB: before.find((r) => r.pid === pid)?.rss,
      rssAfterKiB: after.find((r) => r.pid === pid)?.rss,
      beforeFds,
      afterFds,
      stageCountBefore: beforeStages.length,
      stageCountAfter: afterStages.length,
      stageOwnership:
        'Shared stage root counts cannot attribute concurrent process activity; directory names are not persisted.',
    };
    const resourcePass =
      m.status === 'passed' &&
      report.resources.orphanedOwnedSqlclPids.length === 0 &&
      report.resources.rssAfterKiB - report.resources.rssBeforeKiB <= 50 * 1024 &&
      beforeFds != null &&
      afterFds <= beforeFds &&
      afterStages.length <= beforeStages.length;
    report.checks.push({
      id: 'A261-062',
      scenario: 'resource-postconditions',
      status: resourcePass ? 'passed' : 'failed',
    });
  }
  if (enabled('A261-063')) {
    report.regressions = [];
    for (const baseline of selection.quality.baselines.filter((b) => b.profile === selection.profile)) {
      const current = report.measurements.find(
        (m) =>
          m.scenario ===
          (baseline.scenario === 'read-only-full-import-plan'
            ? 'stable-plans'
            : baseline.scenario === 'live-metadata-batch-three-kinds'
              ? 'metadataBatch'
              : baseline.scenario),
      );
      let previous;
      try {
        previous = JSON.parse(await readFile(baseline.evidence, 'utf8'));
      } catch {}
      report.regressions.push({
        scenario: baseline.scenario,
        ...regressionGate(
          selection.quality,
          baseline,
          current?.latency ?? {},
          previous?.environment,
          report.environment,
          current?.status === 'passed' && previous?.status === 'passed',
        ),
      });
    }
    report.checks.push({
      id: 'A261-063',
      status: 'passed',
      meaning: 'Gate classifications recorded; not_comparable does not claim speed parity.',
    });
  }
  for (const id of ['A261-053', 'A261-054', 'A261-067'])
    if (enabled(id)) {
      const definitions = JSON.parse(await readFile('tests/plugin-server/apex-26.1.cases.json', 'utf8'));
      await notRun(id, prerequisite(definitions.cases.find((c) => c.id === id)) ?? 'Capability unavailable.');
    }
  if (enabled('A261-056'))
    report.checks.push({
      id: 'A261-056',
      status: report.responseChecks.some((r) => r.stackTrace) ? 'failed' : 'passed',
      budgetOverruns: report.responseChecks.filter((r) => r.overrun).length,
      meaning: 'Budget overruns are diagnostic and separate from functional status.',
    });
} catch (e) {
  report.blocker = e.code ?? 'PRECONDITION_OR_HARNESS_FAILED';
  report.checks.push({ id: 'preflight', status: 'blocked', reason: report.blocker });
} finally {
  await h.client.close().catch(() => {});
  const executed = new Set(report.checks.map((c) => c.id));
  report.notRun = selection.catalog.cases
    .filter((c) => !executed.has(c.id))
    .map((c) => ({
      id: c.id,
      reason:
        c.prerequisite ??
        (c.authorization?.includes('import') || c.authorization?.includes('scoped')
          ? 'Connected writes not authorized for this task.'
          : 'Separate baseline/manual scenario or not reached.'),
    }));
  report.finishedAt = new Date().toISOString();
  report.status = report.blocker
    ? 'blocked'
    : report.checks.some((c) => c.status === 'failed')
      ? 'failed'
      : 'partial';
  await save();
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      measurements: report.measurements.length,
    }),
  );
  process.exitCode = report.status === 'failed' || report.status === 'blocked' ? 1 : 0;
}
