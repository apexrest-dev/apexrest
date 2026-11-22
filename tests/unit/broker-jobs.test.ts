import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import {
  claimJob,
  executeJob,
  failQueuedJob,
  jobToolResult,
  JobService,
} from '../../packages/core/src/jobs.ts';
import { brokerEndpoint, liveBroker, submitToBroker } from '../../packages/core/src/broker.ts';
import { writeJson } from '../../packages/core/src/fs.ts';

async function queued(t: import('node:test').TestContext) {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const jobs = new JobService(ctx);
  // A detached start with an unusable runtime still enqueues the request, so use enqueue directly.
  const id = await (jobs as unknown as { enqueue(op: string, input: object): Promise<string> }).enqueue(
    'ship.apply',
    {
      env: 'dev',
    },
  );
  return { ctx, id, root: path.join(ctx.root, '.apexrest/jobs', id) };
}

test('a job runs in at most one runner: the claim is exclusive and the loser changes nothing', async (t) => {
  const { ctx, id, root } = await queued(t);
  let runs = 0;
  const execute = async () => {
    runs++;
    return { ok: true };
  };
  await executeJob(ctx, id, execute, 'broker');
  await assert.rejects(executeJob(ctx, id, execute, 'detached-worker'), { code: 'JOB_ALREADY_CLAIMED' });
  assert.equal(runs, 1);
  assert.equal(JSON.parse(await readFile(path.join(root, 'claim.json'), 'utf8')).runner, 'broker');
  assert.equal(JSON.parse(await readFile(path.join(root, 'state.json'), 'utf8')).status, 'completed');
});

test('a claimed job that has not written its first heartbeat is never marked failed by a starter', async (t) => {
  const { ctx, id, root } = await queued(t);
  assert.equal(await claimJob(root, 'broker'), true);
  assert.equal(await failQueuedJob(ctx.root, id, new Error('worker exited')), false);
  assert.equal(JSON.parse(await readFile(path.join(root, 'state.json'), 'utf8')).status, 'queued');
  assert.equal(await claimJob(root, 'detached-worker'), false);
});

test('without a running broker jobs fall back to the detached worker path', async (t) => {
  const { ctx, id } = await queued(t);
  assert.equal(await liveBroker(ctx.root), undefined);
  assert.equal(await submitToBroker(ctx.root, id), false);
  // A stale record (dead endpoint) is not trusted either.
  await writeJson(path.join(ctx.root, '.apexrest/broker/broker.json'), {
    pid: 1,
    endpoint: brokerEndpoint(ctx.root),
    token: 'x',
    version: 'stale',
    root: ctx.root,
    startedAt: new Date().toISOString(),
  });
  assert.equal(await submitToBroker(ctx.root, id), false);
});

test('a superseded apply reports that it never started and names the job that applies its changes', () => {
  const result = jobToolResult('ship.apply', {
    id: 'a',
    status: 'superseded',
    supersededBy: 'b',
    nextAction: 'This apply never started.',
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'superseded');
  assert.match(result.summary, /superseded by b; it never started/u);
});
