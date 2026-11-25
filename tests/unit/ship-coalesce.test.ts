import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { workingCopyFixture } from '../fixtures/working-copy.ts';
import { coverage, type PendingShip } from '../../packages/core/src/coalesce.ts';
import { captureShipIntent, shipIntentStatus } from '../../packages/core/src/ship-intent.ts';
import { claimJob, JobService } from '../../packages/core/src/jobs.ts';
import { liveBroker, runBroker, stopBroker, submitToBroker } from '../../packages/core/src/broker.ts';

const base: PendingShip = {
  jobId: 'old',
  kind: 'intent',
  env: 'dev',
  targetDigest: 't',
  configuration: 'c',
  requested: 'auto',
  files: [],
  inventory: { 'pages/a.apx': 'a1', 'pages/b.apx': 'b0' },
  changedFiles: ['pages/a.apx'],
  revision: 'r1',
  createdAt: 1,
  confirmed: false,
};
const newer = (change: Partial<PendingShip>): PendingShip => ({
  ...base,
  jobId: 'new',
  revision: 'r2',
  createdAt: 2,
  inventory: { 'pages/a.apx': 'a1', 'pages/b.apx': 'b1' },
  ...change,
});

test('a newer compatible ship covers an older one and keeps both edits; a reversion is the latest value', () => {
  // Page A edited, then page B: the newer state contains both edits.
  const both = coverage(base, newer({}));
  assert.deepEqual(both, {
    covered: true,
    successor: 'new',
    successorRevision: 'r2',
    coveredRevision: 'r1',
    scope: { requested: 'auto' },
    overriddenFiles: [],
  });
  // A later request that no longer contains the earlier edit of A (reverted or overwritten): A
  // takes the newer value and is named, never resurrected from the older state.
  const reverted = coverage(base, newer({ inventory: { 'pages/a.apx': 'a0', 'pages/b.apx': 'b1' } }));
  assert.equal(reverted.covered, true);
  assert.deepEqual(reverted.covered && reverted.overriddenFiles, ['pages/a.apx']);
});

test('targets, configuration, authorization and explicit selections are never merged by timestamps', () => {
  const refused = (older: PendingShip, latest: PendingShip) => {
    const result = coverage(older, latest);
    assert.equal(result.covered, false);
    return result.covered ? '' : result.reason;
  };
  assert.equal(refused(base, newer({ targetDigest: 'other' })), 'different target');
  assert.equal(refused(base, newer({ env: 'qa' })), 'different environment');
  assert.equal(refused(base, newer({ configuration: 'changed' })), 'different configuration');
  assert.equal(refused({ ...base, confirmed: true }, newer({})), 'separately confirmed authorization');
  assert.equal(refused(base, newer({ confirmed: true })), 'separately confirmed authorization');
  assert.equal(refused(base, newer({ createdAt: 0 })), 'captured earlier');
  const filesA = { ...base, requested: 'files' as const, files: ['pages/a.apx'] };
  // A later explicit selection of B does not contain the earlier selection of A.
  assert.match(refused(filesA, newer({ requested: 'files', files: ['pages/b.apx'] })), /scope/u);
  // An automatic selection does not provably contain an explicit one.
  assert.match(refused(filesA, newer({ requested: 'auto' })), /scope/u);
  assert.match(refused(base, newer({ requested: 'files', files: ['pages/a.apx'] })), /scope/u);
  // A superset selection and a full import do.
  assert.equal(
    coverage(filesA, newer({ requested: 'files', files: ['pages/a.apx', 'pages/b.apx'] })).covered,
    true,
  );
  assert.deepEqual(coverage(filesA, newer({ requested: 'full' })), {
    covered: true,
    successor: 'new',
    successorRevision: 'r2',
    coveredRevision: 'r1',
    scope: { requested: 'files', files: ['pages/a.apx'] },
    overriddenFiles: [],
  });
  assert.equal(coverage(undefined, newer({})).covered, false);
});

async function brokered(t: test.TestContext) {
  const f = await workingCopyFixture();
  const ran: string[] = [];
  let ended!: () => void;
  const stopped = new Promise<void>((resolve) => (ended = resolve));
  await runBroker(
    f.ctx,
    async (_operation, input) => {
      ran.push(String(input.intent));
      return { schemaVersion: 1, ok: true, operation: 'ship.intent', status: 'succeeded' };
    },
    () => ended(),
  );
  // Stop the broker before the fixture folder (its record) is removed.
  t.after(async () => {
    await stopBroker(f.ctx, 5);
    await stopped;
    await rm(f.ctx.root, { recursive: true, force: true });
  });
  for (let i = 0; i < 100 && !(await liveBroker(f.ctx.root)); i++)
    await new Promise((r) => setTimeout(r, 20));
  const jobs = new JobService(f.ctx) as unknown as { enqueue(op: string, input: object): Promise<string> };
  const app = path.join(f.ctx.root, f.ctx.config.application.sourceDir);
  const queue = async () => {
    const intent = await captureShipIntent(f.ctx, { env: 'dev', userRequest: 'Deploy the change to dev' });
    return { intent, job: await jobs.enqueue('ship.intent', { env: 'dev', intent: intent.id }) };
  };
  const state = async (job: string) =>
    JSON.parse(await readFile(path.join(f.ctx.root, '.apexrest/jobs', job, 'state.json'), 'utf8'));
  const settled = async (job: string) => {
    for (let i = 0; i < 200; i++) {
      const value = await state(job);
      if (!['queued', 'running'].includes(value.status)) return value;
      await new Promise((r) => setTimeout(r, 20));
    }
    return state(job);
  };
  return { f, ran, app, queue, state, settled };
}

test('the broker prepares only the newest of rapid compatible edits and records what it covers', async (t) => {
  const { f, ran, app, queue, settled } = await brokered(t);
  const file = path.join(app, 'application.apx');
  const original = await readFile(file, 'utf8');
  await writeFile(file, original + '\n-- edit A\n');
  const first = await queue();
  await writeFile(path.join(app, 'extra.apx'), 'edit B\n');
  const second = await queue();
  assert.equal(await submitToBroker(f.ctx.root, first.job), true);
  assert.equal(await submitToBroker(f.ctx.root, second.job), true);
  const older = await settled(first.job);
  assert.equal(older.status, 'superseded');
  assert.equal(older.supersededBy, second.job);
  assert.deepEqual(older.coverage, {
    successorRevision: second.intent.revision,
    coveredRevision: first.intent.revision,
    scope: { requested: 'auto' },
    overriddenFiles: [],
  });
  assert.equal((await settled(second.job)).status, 'completed');
  assert.deepEqual(ran, [second.intent.id], 'one preparation runs');
  assert.equal((await shipIntentStatus(f.ctx, first.intent.id))?.status, 'superseded');

  // A later request that reverts the earlier edit: superseded, and the reverted file is named.
  await writeFile(file, original + '\n-- edit A2\n');
  const third = await queue();
  await writeFile(file, original);
  const fourth = await queue();
  await submitToBroker(f.ctx.root, third.job);
  await submitToBroker(f.ctx.root, fourth.job);
  const reverted = await settled(third.job);
  assert.equal(reverted.status, 'superseded');
  assert.deepEqual(reverted.coverage.overriddenFiles, [
    `${f.ctx.config.application.sourceDir}/application.apx`,
  ]);
  assert.equal((await settled(fourth.job)).status, 'completed');
});

test('a ship that already started is never superseded or run again by the broker', async (t) => {
  const { f, ran, app, queue, state, settled } = await brokered(t);
  const first = await queue();
  await writeFile(path.join(app, 'extra.apx'), 'later\n');
  const second = await queue();
  await submitToBroker(f.ctx.root, first.job);
  // A detached worker claims the older job before the broker drains: it owns that run.
  assert.equal(await claimJob(path.join(f.ctx.root, '.apexrest/jobs', first.job), 'detached-worker'), true);
  await submitToBroker(f.ctx.root, second.job);
  assert.equal((await settled(second.job)).status, 'completed');
  assert.equal((await state(first.job)).status, 'queued', 'left to the runner that claimed it');
  assert.deepEqual(ran, [second.intent.id]);
});
