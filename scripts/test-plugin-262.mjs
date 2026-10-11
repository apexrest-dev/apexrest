import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { readFile, writeFile, cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  loadHarness,
  connectHarness,
  privateCopy,
  runProcess,
  inspectResponse,
  fileInventory,
} from './lib/plugin-harness.mjs';
import { statistics, savePrivateJson } from './lib/plugin-test-metrics.mjs';
const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    env: { type: 'string', default: 'dev' },
    profile: { type: 'string', default: '26.2' },
    catalog: { type: 'string', default: 'tests/plugin-server/apex-26.2.extensions.json' },
    output: { type: 'string', default: 'docs/evidence/qp-harness/extension-26.2.json' },
    'allow-app-writes': { type: 'boolean', default: false },
    'user-request': { type: 'string' },
    'mismatch-source-project': { type: 'string' },
  },
});
assert.ok(values.project);
assert.ok(!values['allow-app-writes'] || values['user-request']);
const project = path.resolve(values.project),
  output = path.resolve(values.output),
  directory = path.dirname(output),
  selection = await loadHarness(values);
assert.equal(selection.profile, '26.2');
assert.ok(output.startsWith(path.resolve('docs/evidence') + path.sep));
const config = JSON.parse(await readFile(path.join(project, 'apexrest.json'), 'utf8'));
assert.equal(config.toolchain.profile, '26.2');
assert.ok(['dev', 'development', 'qa', 'test'].includes(config.environments[values.env]?.kind));
const h = await connectHarness(),
  report = {
    schemaVersion: 1,
    suite: selection.catalog.suite,
    catalogDigest: selection.catalogDigest,
    profile: '26.2',
    startedAt: new Date().toISOString(),
    checks: [],
    measurements: [],
    responseChecks: [],
    findings: [],
    mutation: false,
  };
async function save() {
  await savePrivateJson(output, report);
}
async function call(name, args) {
  const r = await h.call(name, args);
  report.responseChecks.push(inspectResponse(selection.quality, name, args, r));
  return r;
}
async function check(id, scenario, fn) {
  try {
    await fn();
    report.checks.push({ id, scenario, status: 'passed' });
  } catch (e) {
    report.checks.push({ id, scenario, status: 'failed', code: e.code ?? 'EXPECTATION_FAILED' });
  }
  await save();
}
try {
  await check('A262-001', 'offline-profile-identity', async () => {
    const doctor = await call('apexrest_status', { project, detail: 'doctor' });
    assert.equal(doctor.ok, true);
    const source = path.join(project, config.application.sourceDir),
      mmd = JSON.parse(await readFile(path.join(source, '.apex', 'apexlang.json'), 'utf8'));
    assert.match(mmd.mmdVersion, /26\.2/);
    report.identity = {
      profile: '26.2',
      mmdVersion: mmd.mmdVersion,
      lockDigest: (await fileInventory(project))['apexrest.toolchain.lock.json'],
      doctor: doctor.data,
    };
  });
  const connection = await call('apexrest_project', {
    project,
    action: 'connection_test',
    name: config.environments[values.env].readConnectionRef,
  });
  report.mismatchPrerequisite = {
    connectionAvailable: connection.ok,
    code: connection.diagnostics?.[0]?.code ?? null,
    exitClass: connection.exitCode,
    sourceProjectSupplied: !!values['mismatch-source-project'],
  };
  if (!connection.ok || !values['mismatch-source-project']) {
    report.checks.push({
      id: 'A262-001',
      scenario: 'profile-target-mismatch-refusal',
      status: 'not_run',
      reason: !connection.ok
        ? '26.2 connected target unavailable; mismatchPrerequisite records code/exit class.'
        : 'Requires a valid 26.1 source/lock via --mismatch-source-project; changing the profile of 26.2 sources tests the compiler, not the target.',
    });
    await save();
  } else
    await check('A262-001', 'profile-target-mismatch-refusal', async () => {
      const sourceProject = path.resolve(values['mismatch-source-project']);
      const sourceConfig = JSON.parse(await readFile(path.join(sourceProject, 'apexrest.json'), 'utf8'));
      assert.equal(sourceConfig.toolchain.profile, '26.1');
      const copy = await privateCopy(sourceProject, path.join(directory, 'mismatch-261'));
      const c = structuredClone(config);
      c.toolchain.profile = '26.1';
      c.application.sourceDir = sourceConfig.application.sourceDir;
      await writeFile(path.join(copy, 'apexrest.json'), JSON.stringify(c));
      const validation = await call('apexrest_apex_validate', { project: copy });
      assert.equal(validation.ok, true);
      const identity = await call('apexrest_metadata_read', {
        project,
        env: values.env,
        kind: 'apex-capabilities',
        schema: config.environments[values.env].parsingSchema,
      });
      assert.equal(identity.ok, true);
      assert.match(JSON.stringify(identity.data.rows), /26\.2/);
      const r = await call('apexrest_ship', {
        project: copy,
        env: values.env,
        mode: 'plan',
        importMode: 'full',
        userRequest: 'Read-only release mismatch qualification; no apply.',
      });
      report.mismatchCode = r.diagnostics?.[0]?.code;
      report.mismatchExitClass = r.exitCode;
      assert.equal(r.ok, false);
      assert.match(report.mismatchCode, /RELEASE|PROFILE|MMD|VERSION/);
    });
  await check('A262-003', 'golden-search', async () => {
    const golden = JSON.parse(await readFile('tests/plugin-server/reference-golden-26.2.json', 'utf8'));
    assert.ok(golden.queries.length >= 20);
    const rows = [];
    for (const item of golden.queries) {
      const args = { project, mode: 'search', query: item.query, version: '26.2', limit: 3 };
      await call('apexrest_reference', args);
      const start = performance.now(),
        r = await call('apexrest_reference', args);
      assert.equal(r.ok, true);
      const ids = r.data.map((e) => e.id);
      rows.push({
        query: item.query,
        expectedIds: item.expectedIds,
        actualIds: ids,
        hit: item.expectedIds.some((id) => ids.includes(id)),
        elapsedMs: performance.now() - start,
        only262: r.data.every((e) => e.version.startsWith('26.2')),
      });
      await save();
    }
    report.golden = {
      rows,
      hitRate: rows.filter((r) => r.hit).length / rows.length,
      warmLatency: statistics(rows.map((r) => r.elapsedMs)),
      exclusivity: '26.2 corpus isolation verified; not all features were introduced in 26.2.',
    };
    report.measurements.push({ id: 'A262-003', ...report.golden });
    assert.ok(report.golden.hitRate >= 0.9);
    assert.ok(report.golden.warmLatency.medianMs <= 50);
    assert.ok(rows.every((r) => r.only262));
  });
  await check('A262-008', 'offline-recipes-and-starters', async () => {
    const root = path.join(directory, 'compiler-262');
    await mkdir(root, { recursive: true, mode: 0o700 });
    const sqlcl = process.env.APEXREST_SQLCL ?? 'sql';
    const recipes = JSON.parse(await readFile('resources/references/26.2/recipes/manifest.json', 'utf8'));
    const runs = [];
    for (const starter of ['blank-app', 'customer-crm']) {
      const generationRoot = path.join(root, starter + '-' + Date.now());
      const generated = path.join(generationRoot, 'qp');
      const gen = await runProcess(sqlcl, ['-s', '/nolog'], {
        input: `apex generate -name QP -alias qp -dir "${generationRoot}"\nexit\n`,
      });
      assert.equal(gen.code, 0);
      const mmd = JSON.parse(await readFile(path.join(generated, '.apex', 'apexlang.json'), 'utf8'));
      assert.match(mmd.mmdVersion, /26\.2/);
      if (starter === 'customer-crm')
        await cp('templates/customer-crm/apex-overlay-26.2', generated, { recursive: true });
      for (const recipe of recipes.files) {
        await mkdir(path.dirname(path.join(generated, recipe.target)), { recursive: true });
        await cp(
          path.join('resources/references/26.2/recipes', recipe.file),
          path.join(generated, recipe.target),
        );
      }
      const r = await runProcess(sqlcl, ['-s', '/nolog'], {
        input: `apex validate -input "${generated}"\nexit\n`,
      });
      const passed = r.code === 0 && /Validation successful/i.test(r.stdout + r.stderr);
      runs.push({
        starter,
        recipes: recipes.files.map((f) => f.file),
        passed,
        exitCode: r.code,
        mmdVersion: mmd.mmdVersion,
        diagnosticCodes: [...new Set((r.stdout + r.stderr).match(/ORA-\d+|\bERROR\b/gi) ?? [])],
        codescanAdvisories: { available: false },
      });
      const scan = await runProcess(sqlcl, ['-s', '/nolog'], {
        input: `codescan -path "${generated}" -extensions apx -format json\nexit\n`,
      });
      const codes = [
        ...new Set((scan.stdout + scan.stderr).match(/\b[A-Z][A-Z0-9_-]*[0-9][A-Z0-9_-]*\b/g) ?? []),
      ];
      runs.at(-1).codescanAdvisories = {
        available: scan.code === 0,
        exitCode: scan.code,
        codes,
        outputBytes: Buffer.byteLength(scan.stdout + scan.stderr),
        scope: 'Offline advisory scan; source/output text not persisted.',
      };
      report.compilerRuns = runs;
      await save();
      assert.ok(passed);
    }
    report.measurements.push({ id: 'A262-008', runs });
  });
  for (const c of selection.catalog.cases.filter((c) => !report.checks.some((check) => check.id === c.id))) {
    report.checks.push({
      id: c.id,
      status: 'not_run',
      reason: ['A262-002', 'A262-010'].includes(c.id)
        ? 'Separate parity/session/cost report; connected local saved connection prerequisite must pass.'
        : c.id === 'A262-015'
          ? '26.2 host tasks not executed in this read-only task.'
          : !values['allow-app-writes']
            ? 'Requires --allow-app-writes and literal --user-request; writes are excluded from this task.'
            : 'Manual/operator fixture and exact target/reset/readback prerequisites required; automatic writes unsupported for this definition.',
    });
  }
} finally {
  await h.client.close();
  report.finishedAt = new Date().toISOString();
  report.status = report.checks.some((c) => c.status === 'failed') ? 'failed' : 'partial';
  await save();
  console.log(JSON.stringify({ status: report.status, checks: report.checks }));
  process.exitCode = report.status === 'failed' ? 1 : 0;
}
