import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fixture } from '../fixtures/project.ts';
import { workingCopyFixture } from '../fixtures/working-copy.ts';
import { policy } from '../../packages/core/src/config.ts';
import { readJson, writeJson } from '../../packages/core/src/fs.ts';
import { JobService, executeJob } from '../../packages/core/src/jobs.ts';
import { Fault, failure, success } from '../../packages/core/src/result.ts';
import { schemas, toolCatalog } from '../../packages/core/src/operations.ts';
import {
  checkShipTarget,
  compilerFault,
  fallbackCompilerDiagnostics,
  shipApply,
  shipPlan,
} from '../../packages/core/src/ship.ts';
import { dispatch } from '../../packages/core/src/service.ts';
import { detachedJob, listTools } from '../../packages/mcp/src/server.ts';
import { toolOutput } from '../../packages/mcp/src/output.ts';

const parseDiagnostics = fallbackCompilerDiagnostics;

test('ship plan validates, plans and writes a reviewable plan without touching policy', async (t) => {
  const f = await workingCopyFixture();
  f.ctx.config.environments.dev!.baseUrl = 'https://localhost/ords/';
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  const before = await policy();
  const planned = await shipPlan(f.ctx, 'dev', f.service, parseDiagnostics);
  assert.equal(planned.preview.planDigest, planned.plan.digest);
  assert.equal(planned.preview.sources.application, 2, 'application.apx and .apex/apexlang.json');
  assert.equal(planned.phases[0]!.phase, 'planning');
  assert.ok(planned.phases[0]!.ms >= 0);
  const stored = await readJson(path.join(f.ctx.root, planned.planPath));
  assert.deepEqual(stored, planned.plan);
  assert.deepEqual(await policy(), before);
  assert.ok(f.calls.includes('validate'));
  assert.ok(!f.calls.includes('import'));
});

test('ship apply records a plan-bound grant, imports, verifies and removes the grant', async (t) => {
  const f = await workingCopyFixture();
  f.ctx.config.environments.dev!.baseUrl = 'https://localhost/ords/';
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  const planned = await shipPlan(f.ctx, 'dev', f.service, parseDiagnostics);
  const phases: string[] = [];
  let observedGrant: unknown;
  const original = f.oracle.importApplication.bind(f.oracle);
  f.oracle.importApplication = async (...args: Parameters<typeof original>) => {
    // While the import runs, the policy must carry exactly this plan's grant.
    observedGrant = (await policy()).grants.find((g) => g.grantedBy === 'ship');
    return original(...args);
  };
  const result = await shipApply(
    f.ctx,
    planned.plan,
    'Deploy the customers page to dev',
    f.service,
    () => ({ fixture: true }),
    undefined,
    (phase) => phases.push(phase),
  );
  assert.equal(result.status, 'succeeded');
  assert.ok(result.runId);
  assert.equal(result.planDigest, planned.plan.digest);
  assert.deepEqual(observedGrant, {
    projectRoot: f.ctx.root,
    targetDigest: planned.plan.targetDigest,
    planDigest: planned.plan.digest,
    expiresAt: (observedGrant as { expiresAt: string }).expiresAt,
    operations: ['deploy'],
    note: 'Deploy the customers page to dev',
    grantedBy: 'ship',
    workerPid: process.pid,
    grantedAt: (observedGrant as { grantedAt: string }).grantedAt,
  });
  const after = await policy();
  assert.equal(
    after.grants.some((g) => g.grantedBy === 'ship'),
    false,
    'ship grant removed',
  );
  assert.equal(after.grants.length, 1, 'unrelated user grants are preserved');
  assert.deepEqual(result.grant, {
    recorded: true,
    removed: true,
    expiresAt: (observedGrant as { expiresAt: string }).expiresAt,
    planDigest: planned.plan.digest,
  });
  assert.deepEqual(phases, ['backing_up', 'migrating', 'importing', 'verifying', 'testing']);
  assert.deepEqual(
    result.phases.map((p) => p.phase),
    ['backing_up', 'migrating', 'importing', 'verifying', 'testing'],
  );
  assert.ok(result.phases.every((p) => p.ms >= 0));
  assert.deepEqual(result.application, {
    id: 123,
    alias: 'fixture',
    workspace: 'FIXTURE',
    url: 'https://localhost/ords/f?p=123',
  });
  assert.deepEqual(result.tests, { fixture: true });
  assert.ok(f.calls.includes('import'));
  assert.ok(f.calls.includes('tests'));
});

test('ship apply removes its grant after a failed import and refuses production before any grant', async (t) => {
  const f = await workingCopyFixture();
  f.ctx.config.environments.dev!.baseUrl = 'https://localhost/ords/';
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  const planned = await shipPlan(f.ctx, 'dev', f.service, parseDiagnostics);
  f.controls.failImport = true;
  await assert.rejects(
    shipApply(f.ctx, planned.plan, 'Deploy the customers page', f.service, () => undefined),
    { code: 'OUTCOME_UNKNOWN' },
  );
  assert.equal(
    (await policy()).grants.some((g) => g.grantedBy === 'ship'),
    false,
  );
  f.controls.failImport = false;
  const production = {
    ...f.ctx,
    config: {
      ...f.ctx.config,
      environments: { dev: { ...f.ctx.config.environments.dev!, kind: 'production' as const } },
    },
  };
  await assert.rejects(checkShipTarget(production, planned.plan), {
    code: 'PRODUCTION_CI_REQUIRED',
    status: 'blocked',
  });
  await assert.rejects(
    shipApply(production, planned.plan, 'Deploy the customers page', f.service, () => undefined),
    { code: 'PRODUCTION_CI_REQUIRED' },
  );
  assert.equal(
    (await policy()).grants.some((g) => g.grantedBy === 'ship'),
    false,
  );
  assert.ok(!f.calls.slice(f.calls.indexOf('import') + 1).includes('import'));
  const risky = { ...planned.plan, risks: ['destructive-or-privileged-sql:db/x.sql'] };
  await assert.rejects(checkShipTarget(f.ctx, risky), { code: 'RECOVERY_REVIEW_REQUIRED' });
});

test('ship schemas require the literal user request and refuse production apply through dispatch', async (t) => {
  const f = await workingCopyFixture();
  f.ctx.config.environments.dev!.baseUrl = 'https://localhost/ords/';
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  assert.equal(schemas.ship.safeParse({ env: 'dev', userRequest: 'short' }).success, false);
  assert.equal(schemas.ship.parse({ env: 'dev', userRequest: 'Deploy page ten' }).mode, 'plan');
  const config = {
    ...f.ctx.config,
    environments: { dev: { ...f.ctx.config.environments.dev!, kind: 'production' as const } },
  };
  await writeJson(path.join(f.ctx.root, 'apexrest.json'), config);
  const refused = await dispatch('ship.apply', {
    project: f.ctx.root,
    env: 'dev',
    plan: '.apexrest/plans/none.json',
    userRequest: 'Deploy page ten to production',
  });
  assert.equal(refused.ok, false);
  assert.notEqual(refused.diagnostics[0]!.code, 'PRODUCTION_CI_REQUIRED', 'missing plan fails before policy');
  assert.equal(
    (await policy()).grants.some((g) => g.grantedBy === 'ship'),
    false,
  );
});

test('compiler failures become VALIDATION_FAILED with structured diagnostics and next actions', async () => {
  const output = [
    'Validating application',
    'Error at line 12, column 5 in pages/p00010-customers.apx: Unknown property "titel"',
    'Warning: pages/p00020.apx line 3: deprecated attribute',
    'Validation completed with 1 errors',
  ].join('\n');
  const diagnostics = fallbackCompilerDiagnostics(output);
  assert.equal(diagnostics.length, 2);
  assert.deepEqual(diagnostics[0], {
    severity: 'error',
    message: 'Error at line 12, column 5 in pages/p00010-customers.apx: Unknown property "titel"',
    file: 'pages/p00010-customers.apx',
    line: 12,
    column: 5,
  });
  assert.equal(diagnostics[1]!.severity, 'warning');
  const converted = compilerFault(
    new Fault('ORACLE_COMMAND_FAILED', output, 1),
    fallbackCompilerDiagnostics,
  ) as Fault;
  assert.equal(converted.code, 'VALIDATION_FAILED');
  assert.match(converted.message, /1 error\(s\) and 1 warning\(s\)/);
  const envelope = failure('apex.validate', converted);
  assert.equal(envelope.diagnostics[0]!.line, 12);
  assert.equal(envelope.diagnostics[0]!.file, 'pages/p00010-customers.apx');
  assert.match(envelope.nextActions[0]!, /apexrest_apex_validate/);
  // Engine-provided structured diagnostics take precedence over text parsing.
  const detailed = compilerFault(
    new Fault('VALIDATION_UNCONFIRMED', 'x', 1, 'failed', {
      diagnostics: [{ message: 'm', file: 'a.apx', line: 1, column: 2, type: 'syntax', hint: 'h' }],
    }),
    () => [],
  ) as Fault;
  assert.equal(detailed.details?.diagnostics?.[0]?.hint, 'h');
  assert.equal(compilerFault(new Fault('OTHER', 'x'), () => []) instanceof Fault, true);
  assert.equal((compilerFault(new Fault('OTHER', 'x'), () => []) as Fault).code, 'OTHER');
  assert.match(
    failure('deploy.apply', new Fault('DEPLOY_APPROVAL_REQUIRED', 'x', 4)).nextActions[0]!,
    /apexrest_ship/,
  );
  assert.match(failure('x', new Fault('PROJECT_TRUST_REQUIRED', 'x', 4)).nextActions[0]!, /trustedProjects/);
});

async function trusted(t: import('node:test').TestContext) {
  const { ctx } = await fixture();
  const before = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = path.join(ctx.root, 'managed');
  await writeJson(path.join(process.env.APEXREST_HOME, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [ctx.root],
    grants: [],
  });
  t.after(async () => {
    if (before === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = before;
    await rm(ctx.root, { recursive: true, force: true });
  });
  return ctx;
}

test('in-process jobs write the same state, heartbeat and phase as a detached worker', async (t) => {
  const ctx = await trusted(t);
  const jobs = new JobService(ctx);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const started = await jobs.startInline(
    'apex.sync',
    { env: 'dev', action: 'init' },
    async (op, input, _signal, progress) => {
      progress('syncing');
      await gate;
      return success(op, { input });
    },
  );
  assert.equal(started.runner, 'in-process');
  // Never leave the executor blocked: a failed assertion would otherwise keep
  // the heartbeat alive and hang the whole test run.
  t.after(() => release());
  const until = async (ready: (state: { status: string; phase?: string }) => boolean) => {
    const deadline = Date.now() + 5000;
    for (;;) {
      const state = (await jobs.status(started.jobId)) as { status: string; phase?: string };
      if (ready(state) || Date.now() > deadline) return state;
      await delay(20);
    }
  };
  const running = await until((state) => state.status === 'running' && state.phase === 'syncing');
  assert.equal(running.status, 'running');
  assert.equal(running.phase, 'syncing');
  const request = (await readJson(path.join(ctx.root, '.apexrest/jobs', started.jobId, 'request.json'))) as {
    operation: string;
    input: Record<string, unknown>;
  };
  assert.equal(request.operation, 'apex.sync');
  assert.equal(request.input.project, ctx.root);
  release();
  const done = (await jobs.status(started.jobId, 5)) as unknown as {
    status: string;
    result: { ok: boolean };
  };
  assert.equal(done.status, 'completed');
  assert.equal(done.result.ok, true);
  await assert.rejects(jobs.status(started.jobId, 121), { code: 'INVALID_INPUT' });
  const failedStart = await jobs.startInline('apex.sync', {}, async () => {
    throw new Error('executor crashed');
  });
  for (let i = 0; i < 100 && (await jobs.status(failedStart.jobId)).status !== 'failed'; i++) await delay(50);
  assert.equal((await jobs.status(failedStart.jobId)).status, 'failed');
  await assert.rejects(
    jobs.startInline('deploy.restore-plan', {}, async () => success('x', {})),
    {
      code: 'INVALID_JOB_OPERATION',
    },
  );
});

test('workers record phases immediately and the composite job tool reads them', async (t) => {
  const ctx = await trusted(t);
  const jobs = new JobService(ctx);
  // Hold the first phase until the test has read it; a fixed delay races slow runners.
  let observed!: () => void;
  const firstRead = new Promise<void>((resolve) => (observed = resolve));
  t.after(() => observed());
  const started = await jobs.startInline('ship.apply', {}, async (_op, _input, _signal, progress) => {
    progress('backing_up');
    await firstRead;
    progress('importing');
    await delay(30);
    return failure('ship.apply', new Fault('IMPORT_FAILED', 'fixture', 1));
  });
  let first = await dispatch('job', { project: ctx.root, jobId: started.jobId });
  for (let i = 0; i < 100 && !(first.data as { phase?: string }).phase; i++) {
    await delay(10);
    first = await dispatch('job', { project: ctx.root, jobId: started.jobId });
  }
  assert.equal(first.operation, 'job');
  assert.equal((first.data as { phase: string }).phase, 'backing_up');
  observed();
  const final = await dispatch('job', { project: ctx.root, jobId: started.jobId, waitSeconds: 5 });
  assert.equal((final.data as { status: string }).status, 'failed');
  assert.equal((final.data as { phase: string }).phase, 'importing');
  assert.equal(final.ok, true, 'status reads succeed; the recorded result carries the failure');
  const cancel = await dispatch('job', { project: ctx.root, jobId: started.jobId, action: 'cancel' });
  assert.equal((cancel.data as { status: string }).status, 'failed');
});

test('MCP catalog is eleven tools with correct annotations and a bounded footprint', () => {
  const tools = listTools();
  assert.deepEqual(
    tools.map((t) => t.name),
    [
      'apexrest_project',
      'apexrest_reference',
      'apexrest_metadata_read',
      'apexrest_apex_validate',
      'apexrest_ship',
      'apexrest_apex_sync',
      'apexrest_test_run',
      'apexrest_browser_open',
      'apexrest_job',
      'apexrest_artifact_read',
      'apexrest_status',
    ],
  );
  const annotations = Object.fromEntries(tools.map((t) => [t.name, t.annotations!]));
  for (const name of [
    'apexrest_reference',
    'apexrest_apex_validate',
    'apexrest_status',
    'apexrest_metadata_read',
    'apexrest_artifact_read',
  ]) {
    assert.equal(annotations[name]!.readOnlyHint, true, name);
    assert.equal(annotations[name]!.destructiveHint, false, name);
    assert.equal(annotations[name]!.idempotentHint, true, name);
  }
  assert.deepEqual(
    tools.filter((t) => t.annotations!.destructiveHint).map((t) => t.name),
    ['apexrest_ship', 'apexrest_job'],
  );
  assert.deepEqual(
    tools.filter((t) => t.annotations!.openWorldHint).map((t) => t.name),
    [
      'apexrest_project',
      'apexrest_metadata_read',
      'apexrest_ship',
      'apexrest_apex_sync',
      'apexrest_test_run',
      'apexrest_browser_open',
    ],
  );
  const ship = tools.find((t) => t.name === 'apexrest_ship')!.inputSchema as {
    properties: Record<string, { default?: unknown; maximum?: number; minLength?: number }>;
    required: string[];
  };
  assert.equal(ship.properties.waitSeconds!.default, 25);
  assert.equal(ship.properties.waitSeconds!.maximum, 120);
  assert.equal(ship.properties.userRequest!.minLength, 10);
  assert.ok(
    ship.required.includes('project') &&
      ship.required.includes('env') &&
      ship.required.includes('userRequest'),
  );
  const job = tools.find((t) => t.name === 'apexrest_job')!.inputSchema as {
    properties: Record<string, { maximum?: number; default?: unknown }>;
  };
  assert.equal(job.properties.waitSeconds!.maximum, 120);
  const bytes = Buffer.byteLength(JSON.stringify({ tools }), 'utf8');
  assert.ok(bytes < 12500, `catalog is ${bytes} bytes`);
  assert.equal(detachedJob('ship', {}), true);
  assert.equal(detachedJob('test.run', { suite: 'sql' }), true);
  assert.equal(detachedJob('test.run', { suite: 'unit' }), false);
  assert.equal(detachedJob('apex.sync', { action: 'init' }), false);
});

test('composite project, reference and status operations reuse the granular implementations', async (t) => {
  const ctx = await trusted(t);
  const summary = await dispatch('project', { project: ctx.root, action: 'inspect' });
  assert.equal(summary.operation, 'project');
  assert.equal((summary.data as { targetVerified: boolean }).targetVerified, false);
  assert.equal('sources' in (summary.data as object), false, 'summary is the default detail');
  const direct = await dispatch('project.inspect', { project: ctx.root, detail: 'summary' });
  assert.deepEqual(summary.data, direct.data);
  const missing = await dispatch('reference', { mode: 'read' });
  assert.equal(missing.exitCode, 2);
  assert.match(missing.summary, /id: required/);
  const tooMany = await dispatch('reference', { mode: 'search', query: 'validate', limit: 9 });
  assert.equal(tooMany.exitCode, 2);
  const doctor = await dispatch('status', { detail: 'doctor' });
  assert.equal(doctor.operation, 'status');
  assert.equal(typeof (doctor.data as { platform: string }).platform, 'string');
  const output = await toolOutput(summary, ctx.root);
  assert.equal(output.isError, false);
});

test('skills are five host-neutral files within their byte budgets', async () => {
  const root = 'plugins/apexrest-apex/skills';
  const skills = (await readdir(root)).sort();
  assert.deepEqual(skills, [
    'apexrest-apexlang',
    'apexrest-pattern-catalog',
    'apexrest-safety',
    'apexrest-setup',
    'apexrest-work',
  ]);
  const budgets: Record<string, number> = {
    'apexrest-work': 3072,
    'apexrest-apexlang': 6144,
    'apexrest-safety': 3072,
    'apexrest-setup': 3072,
  };
  for (const skill of skills) {
    const file = path.join(root, skill, 'SKILL.md');
    const text = await readFile(file, 'utf8');
    assert.match(text, /^---\nname: apexrest-[a-z-]+\ndescription: .+\n---\n/, skill);
    if (budgets[skill])
      assert.ok((await stat(file)).size <= budgets[skill]!, `${skill} exceeds ${budgets[skill]} bytes`);
    assert.doesNotMatch(text, /\$apexrest-/, `${skill} uses Codex-only invocation syntax`);
    assert.doesNotMatch(
      text,
      /apexrest_(?:panel_status|doctor|deploy_plan|deploy_apply|job_status|job_cancel|reference_search|reference_read|apex_generate|apex_export|compose_plan|compose_materialize|project_inspect)\b/,
      `${skill} references a removed tool`,
    );
    await stat(path.join(root, skill, 'agents/openai.yaml'));
  }
  const work = await readFile(path.join(root, 'apexrest-work/SKILL.md'), 'utf8');
  assert.match(work, /apexrest_ship/);
  assert.match(work, /apexrest_browser_open/);
  assert.match(work, /absolute/i);
});
