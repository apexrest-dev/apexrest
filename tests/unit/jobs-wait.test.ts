import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fixture } from '../fixtures/project.ts';
import { exists, readJson, writeJson } from '../../packages/core/src/fs.ts';
import { JobService, executeJob, failQueuedJob, jobOutcome } from '../../packages/core/src/jobs.ts';
import { Fault, failure, success } from '../../packages/core/src/result.ts';

async function setup(t: import('node:test').TestContext, status = 'running') {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const id = randomUUID(),
    root = path.join(ctx.root, '.apexrest/jobs', id),
    file = path.join(root, 'state.json'),
    state = { id, status, operation: 'apex.validate', updatedAt: new Date().toISOString() };
  await writeJson(file, state);
  return { id, root, file, state, service: new JobService(ctx) };
}

test('job status keeps immediate reads as the default and validates wait bounds', async (t) => {
  const { id, state, service } = await setup(t, 'queued');
  assert.deepEqual(await service.status(id), state);
  assert.deepEqual(await service.status(id, 0), state);
  for (const invalid of [-1, 0.5, 30.01, NaN, Infinity])
    await assert.rejects(service.status(id, invalid), { code: 'INVALID_INPUT' });
});

test('job status waits through heartbeat changes and returns completion in the same call', async (t) => {
  const { id, file, state, service } = await setup(t, 'queued');
  const completed = {
    ...state,
    status: 'completed',
    result: { ok: true, status: 'succeeded', artifacts: ['validation.json'] },
  };
  const worker = (async () => {
    await delay(30);
    await writeJson(file, { ...state, status: 'running', updatedAt: new Date().toISOString() });
    await delay(300);
    await writeJson(file, completed);
  })();
  const waiting = service.status(id, 2);
  await worker;
  assert.deepEqual(await waiting, completed);
});

test('job status returns active state when the bounded wait expires without modifying the job', async (t) => {
  const { id, root, file, state, service } = await setup(t);
  const started = Date.now();
  assert.deepEqual(await service.status(id, 1), state);
  assert.ok(Date.now() - started >= 900);
  assert.deepEqual(await readJson(file), state);
  assert.equal(await exists(path.join(root, 'request.json')), false);
  assert.equal(await exists(path.join(root, 'cancel.json')), false);
});

test('aborting a status wait returns the state promptly without cancelling the job', async (t) => {
  const { id, root, file, state, service } = await setup(t);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30);
  t.after(() => clearTimeout(timeout));
  const started = Date.now();
  assert.deepEqual(await service.status(id, 30, controller.signal), state);
  assert.ok(Date.now() - started < 2000);
  assert.deepEqual(await service.status(id, 30, controller.signal), state);
  assert.deepEqual(await readJson(file), state);
  assert.equal(await exists(path.join(root, 'cancel.json')), false);
});

test('job status preserves unknown outcomes when a worker heartbeat has expired', async (t) => {
  const { id, file, state, service } = await setup(t);
  const stale = { ...state, updatedAt: new Date(0).toISOString() };
  await writeJson(file, stale);
  assert.deepEqual(await service.status(id, 30), {
    ...stale,
    status: 'outcome_unknown',
    nextAction: 'Worker heartbeat expired. Reconcile target before retrying.',
  });
  assert.deepEqual(await readJson(file), stale);
});

test('job status preserves failed results, cancellation and recorded unknown outcomes', async (t) => {
  const { id, file, state, service } = await setup(t);
  for (const status of ['failed', 'cancelled', 'cancellation_requested', 'outcome_unknown', 'completed']) {
    const terminal = {
      ...state,
      status,
      result: { ok: false, status: 'failed', diagnostics: [{ code: 'FIXTURE_FAILURE' }], exitCode: 6 },
    };
    await writeJson(file, terminal);
    assert.deepEqual(await service.status(id, 30), terminal);
  }
});

async function trusted(t: import('node:test').TestContext, root: string) {
  const before = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = path.join(root, 'managed');
  await writeJson(path.join(process.env.APEXREST_HOME, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [root],
    grants: [],
  });
  t.after(() => {
    if (before === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = before;
  });
}

test('a worker that cannot spawn records a failed job instead of a queued one', async (t) => {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  await trusted(t, ctx.root);
  const executable = process.execPath;
  process.execPath = path.join(ctx.root, 'missing-node');
  try {
    await assert.rejects(new JobService(ctx).start('apex.validate', {}, '/runtime/apexrest.mjs'));
  } finally {
    process.execPath = executable;
  }
  const [id] = await readdir(path.join(ctx.root, '.apexrest/jobs'));
  const state = (await readJson(path.join(ctx.root, '.apexrest/jobs', id!, 'state.json'))) as {
    status: string;
    operation: string;
    result: { ok: boolean; operation: string; exitCode: number };
  };
  assert.equal(state.status, 'failed');
  assert.equal(state.operation, 'apex.validate');
  assert.equal(state.result.ok, false);
  assert.equal(state.result.operation, 'apex.validate');
  assert.equal((await new JobService(ctx).status(id!, 0)).status, 'failed');
});

test('only a job that never started can be marked failed by its worker', async (t) => {
  const queued = await setup(t, 'queued');
  assert.equal(
    await failQueuedJob(path.dirname(path.dirname(path.dirname(queued.root))), queued.id, new Error('x')),
    true,
  );
  assert.equal(((await readJson(queued.file)) as { status: string }).status, 'failed');
  const running = await setup(t, 'running');
  const projectRoot = path.dirname(path.dirname(path.dirname(running.root)));
  assert.equal(
    await failQueuedJob(projectRoot, running.id, new Fault('PROJECT_TRUST_REQUIRED', 'x', 4)),
    false,
  );
  assert.deepEqual(await readJson(running.file), running.state);
  assert.equal(await failQueuedJob(projectRoot, randomUUID(), new Error('x')), false);
});

test('completed workers record the operation outcome rather than plain completion', async (t) => {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  await trusted(t, ctx.root);
  const outcomes = [
    [success('apex.validate', {}), 'completed'],
    [failure('apex.validate', new Fault('COMPILE_FAILED', 'Compiler failed.', 1)), 'failed'],
    [
      failure('deploy.apply', new Fault('IMPORT_INTERRUPTED', 'Unknown.', 6, 'outcome_unknown')),
      'outcome_unknown',
    ],
    [failure('apex.validate', new Fault('CANCELLED', 'Stopped.', 6, 'cancelled')), 'cancelled'],
  ] as const;
  for (const [result, status] of outcomes) {
    const id = randomUUID(),
      root = path.join(ctx.root, '.apexrest/jobs', id);
    await writeJson(path.join(root, 'request.json'), { id, operation: result.operation, input: {} });
    await writeJson(path.join(root, 'state.json'), {
      id,
      status: 'queued',
      operation: result.operation,
      updatedAt: new Date().toISOString(),
    });
    await executeJob(ctx, id, async () => result);
    const state = (await readJson(path.join(root, 'state.json'))) as { status: string; result: unknown };
    assert.equal(state.status, status);
    assert.deepEqual(state.result, result);
  }
  assert.equal(jobOutcome({ ok: false, status: 'running' }), 'failed');
  assert.equal(jobOutcome(undefined), 'completed');
});
