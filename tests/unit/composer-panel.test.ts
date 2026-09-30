import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { build } from 'esbuild';
import { CompositionJobs, ReviewRequests } from '../../packages/panel/src/composer-jobs.ts';

type Response = { job: { status: string }; materializable: boolean };
const response = (status: string): Response => ({ job: { status }, materializable: status === 'completed' });

test('the complete panel initializes Composer controls before requesting its first snapshot', async () => {
  const html = await readFile('packages/panel/src/index.html', 'utf8');
  const elements = new Map(
    [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => [
      match[1]!,
      {
        disabled: false,
        value: '',
        textContent: '',
        onclick: undefined as unknown,
        onsubmit: undefined as unknown,
        querySelectorAll: () => [],
      },
    ]),
  );
  const compiled = await build({
    entryPoints: ['packages/panel/src/panel.ts'],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    target: 'es2023',
    loader: { '.svg': 'dataurl' },
  });
  const window = { addEventListener: () => {} } as { addEventListener: () => void; parent: unknown };
  window.parent = window;
  let requests = 0;
  vm.runInNewContext(
    compiled.outputFiles[0]!.text,
    {
      window,
      document: {
        getElementById: (id: string) => elements.get(id) ?? null,
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener: () => {},
      },
      location: { hash: '' },
      URLSearchParams,
      AbortSignal,
      setTimeout: () => 1,
      fetch: () => {
        requests++;
        // Keep rendering out of this bootstrap test; no network is contacted.
        return new Promise(() => {});
      },
    },
    { timeout: 1000 },
  );
  assert.equal(requests, 1);
  assert.equal(elements.get('compose-plan')?.disabled, true);
  assert.equal(elements.get('compose-materialize')?.disabled, true);
  assert.equal(elements.get('compose-cancel')?.disabled, true);
  assert.equal(typeof elements.get('compose-plan')?.onclick, 'function');
  assert.equal(typeof elements.get('catalog-add')?.onsubmit, 'function');
});

test('Composer panel discards late blueprint reviews after edited inputs or a newer request', async () => {
  const reviews = new ReviewRequests();
  let complete!: (value: { blueprint: string; instance: string }) => void;
  const first = reviews.run(
    () => new Promise<{ blueprint: string; instance: string }>((resolve) => (complete = resolve)),
  );
  reviews.invalidate(); // Blueprint path, selected package, instance or parameters changed.
  complete({ blueprint: 'old.yaml', instance: 'OldInstance' });
  assert.equal(await first, undefined);

  const older = reviews.run(
    () => new Promise<{ blueprint: string; instance: string }>((resolve) => (complete = resolve)),
  );
  const latest = await reviews.run(async () => ({ blueprint: 'latest.yaml', instance: 'NewInstance' }));
  complete({ blueprint: 'old.yaml', instance: 'OldInstance' });
  assert.equal(await older, undefined);
  assert.deepEqual(latest, { blueprint: 'latest.yaml', instance: 'NewInstance' });
});

test('Composer panel retries transient status failures without starting a duplicate job', async () => {
  let starts = 0,
    reads = 0,
    waits = 0;
  const observed: string[] = [],
    failures: boolean[] = [];
  const jobs: CompositionJobs<Response> = new CompositionJobs<Response>(
    async (id) => {
      assert.equal(id, 'accepted-job');
      if (++reads === 2) throw new Error('Connection interrupted');
      return response(reads === 1 ? 'running' : 'completed');
    },
    (value) => observed.push(value.job.status),
    () => {},
    (_error, paused) => failures.push(paused),
    async () => {
      waits++;
      assert.equal(
        await jobs.run(async () => {
          starts++;
          return 'duplicate-job';
        }),
        undefined,
      );
    },
  );
  const result = await jobs.run(async () => {
    starts++;
    return 'accepted-job';
  });
  assert.equal(starts, 1);
  assert.equal(reads, 3);
  assert.equal(waits, 2);
  assert.deepEqual(observed, ['running', 'completed']);
  assert.deepEqual(failures, [false]);
  assert.equal(result?.current, true);
  assert.equal(jobs.pending, undefined);
  assert.equal(jobs.running, false);
});

test('Composer panel pauses after bounded failures and retries the same unknown job', async () => {
  let starts = 0,
    reads = 0,
    available = false;
  const failures: boolean[] = [],
    observed: string[] = [];
  const jobs: CompositionJobs<Response> = new CompositionJobs<Response>(
    async (id) => {
      assert.equal(id, 'accepted-job');
      reads++;
      if (!available) throw new Error('Offline');
      return response('completed');
    },
    (value) => observed.push(value.job.status),
    () => {},
    (_error, paused) => failures.push(paused),
    async () => {},
  );
  const start = async () => {
    starts++;
    return 'accepted-job';
  };
  assert.equal(await jobs.run(start), undefined);
  assert.equal(reads, 3);
  assert.equal(jobs.running, false);
  assert.equal(jobs.pending?.id, 'accepted-job');
  assert.deepEqual(failures, [false, false, true]);
  assert.deepEqual(observed, []);
  available = true;
  assert.equal((await jobs.run(start))?.response.job.status, 'completed');
  assert.equal(starts, 1);
  assert.equal(jobs.pending, undefined);
});

test('Composer panel cannot reinstate a plan after blueprint changes during planning or retry', async () => {
  let available = false;
  const jobs: CompositionJobs<Response> = new CompositionJobs<Response>(
    async () => {
      if (!available) throw new Error('Offline');
      return response('completed');
    },
    () => {},
    () => {},
    () => {},
    async () => {},
  );
  await jobs.run(async () => 'blueprint-a-job');
  jobs.invalidate(); // The input now points at blueprint B.
  available = true;
  const result = await jobs.run(async () => {
    assert.fail('A pending job must not be replaced');
  });
  assert.equal(result?.response.materializable, true);
  assert.equal(result?.current, false);

  const duringStart = await jobs.run(async () => {
    jobs.invalidate(); // Blueprint input changed before the start response arrived.
    return 'older-blueprint-job';
  });
  assert.equal(duringStart?.current, false);
});

test('Composer panel keeps observing cancellation until its actual terminal result', async () => {
  const states = ['queued', 'running', 'cancelling', 'cancelled'],
    observed: string[] = [];
  const jobs: CompositionJobs<Response> = new CompositionJobs<Response>(
    async () => response(states.shift()!),
    (value) => observed.push(value.job.status),
    () => {},
    () => assert.fail('No transport failures expected'),
    async () => {
      assert.equal(jobs.pending?.id, 'cancelled-job');
      assert.equal(jobs.running, true);
    },
  );
  const result = await jobs.run(async () => 'cancelled-job');
  assert.deepEqual(observed, ['queued', 'running', 'cancelling', 'cancelled']);
  assert.equal(result?.response.job.status, 'cancelled');
  assert.equal(result?.response.materializable, false);
  assert.equal(jobs.pending, undefined);
});
