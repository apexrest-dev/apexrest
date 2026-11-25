import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { workingCopyFixture } from '../fixtures/working-copy.ts';
import { fallbackCompilerDiagnostics } from '../../packages/core/src/ship.ts';
import { captureShipIntent, runShipIntent, shipThroughBroker } from '../../packages/core/src/ship-intent.ts';
import { coverage, type PendingShip } from '../../packages/core/src/coalesce.ts';
import { JobService, type JobExecutor } from '../../packages/core/src/jobs.ts';
import { liveBroker, runBroker, stopBroker } from '../../packages/core/src/broker.ts';
import { failure, success } from '../../packages/core/src/result.ts';
import {
  executionTiming,
  recordSqlclTiming,
  withSqlclTimings,
} from '../../packages/core/src/sqlcl-timings.ts';
import { traceReport, type TraceReport } from '../../packages/core/src/spans.ts';

async function resident(t: test.TestContext, withBroker = true) {
  const f = await workingCopyFixture();
  // The configuration lives on disk: an intent captured by a client binds that file's identity.
  f.ctx.config.environments.dev!.baseUrl = 'https://localhost/ords/';
  const { writeJson } = await import('../../packages/core/src/fs.ts');
  await writeJson(`${f.ctx.root}/apexrest.json`, f.ctx.config);
  const { loadProject } = await import('../../packages/core/src/config.ts');
  f.ctx = await loadProject(f.ctx.root);
  // The fixture compiler reports a SQLcl validate timing: the first call starts a session, every
  // later call in the same process reuses it (as the pooled offline compiler does).
  let compiles = 0;
  const validate = f.oracle.validate.bind(f.oracle);
  f.oracle.validate = async (...args: Parameters<typeof validate>) => {
    recordSqlclTiming('validate', { ...executionTiming('mcp-pool'), reused: compiles++ > 0 });
    return validate(...args);
  };
  const ranIn: string[] = [];
  const execute =
    (runner: string): JobExecutor =>
    async (_operation, input, signal, progress) => {
      ranIn.push(runner);
      // As dispatch does for every operation: one SQLcl timing scope per run.
      try {
        const data = await withSqlclTimings(() =>
          runShipIntent(
            f.ctx,
            String(input.intent),
            f.service,
            fallbackCompilerDiagnostics,
            signal,
            progress,
          ),
        );
        return success('ship.intent', { ...data, operations: traceReport() });
      } catch (error) {
        return failure('ship.intent', error);
      }
    };
  let ended!: () => void;
  const stopped = new Promise<void>((resolve) => (ended = resolve));
  if (withBroker) {
    await runBroker(f.ctx, execute('broker'), () => ended());
    for (let i = 0; i < 100 && !(await liveBroker(f.ctx.root)); i++)
      await new Promise((r) => setTimeout(r, 20));
  }
  t.after(async () => {
    if (withBroker) {
      await stopBroker(f.ctx, 5);
      await stopped;
    }
    await rm(f.ctx.root, { recursive: true, force: true });
  });
  const input = {
    project: f.ctx.root,
    env: 'dev',
    mode: 'apply',
    userRequest: 'Deploy the customers page to dev',
  };
  return { f, ranIn, execute, input };
}

test('two one-shot CLI ships prepare and apply in the resident broker and reuse its compiler session', async (t) => {
  const { f, ranIn, execute, input } = await resident(t);
  const first = (await shipThroughBroker(input, execute('cli')))!;
  const file = `${f.ctx.root}/${f.ctx.config.application.sourceDir}/application.apx`;
  const { appendFile } = await import('node:fs/promises');
  await appendFile(file, '\n');
  const second = (await shipThroughBroker(input, execute('cli')))!;
  for (const result of [first, second]) {
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.equal((result.data as { provenance: string }).provenance, 'resident-cli');
  }
  assert.deepEqual(ranIn, ['broker', 'broker'], 'both preparations ran in the resident process');
  const planning = (result: typeof first) =>
    ((result.data as { operations: TraceReport }).operations.spans.find((span) => span.name === 'planning')!
      .attributes ?? {}) as Record<string, unknown>;
  assert.equal(planning(first).compilerReused, false);
  assert.equal(planning(second).compilerReused, true, 'the second ship reused the resident compiler');
});

test('without a broker the CLI ships in its own process, and a refused handoff runs exactly once', async (t) => {
  const { f, ranIn, execute, input } = await resident(t, false);
  assert.equal(await shipThroughBroker(input, execute('cli')), undefined, 'cold CLI path');
  assert.equal(await shipThroughBroker({ ...input, mode: 'plan' }, execute('cli')), undefined);
  assert.equal(
    await shipThroughBroker({ ...input, plan: '.apexrest/plans/x.json' }, execute('cli')),
    undefined,
  );
  // The job API falls back to this process when no broker confirms it; the claim is exclusive.
  const intent = await captureShipIntent(f.ctx, { env: 'dev', userRequest: 'Deploy', client: 'cli' });
  const jobs = new JobService(f.ctx);
  const submitted = await jobs.submit('ship.intent', { env: 'dev', intent: intent.id }, execute('cli'));
  assert.equal(submitted.runner, 'in-process');
  assert.deepEqual(ranIn, ['cli']);
  assert.equal(f.calls.filter((call) => call === 'import').length, 1);
});

test('a toolchain change invalidates a queued intent and keeps intents of different toolchains apart', async (t) => {
  const { f } = await resident(t, false);
  const intent = await captureShipIntent(f.ctx, { env: 'dev', userRequest: 'Deploy' });
  const previous = process.env.APEXREST_SQLCL;
  process.env.APEXREST_SQLCL = '/opt/other-sqlcl/bin/sql';
  t.after(() => {
    if (previous === undefined) delete process.env.APEXREST_SQLCL;
    else process.env.APEXREST_SQLCL = previous;
  });
  await assert.rejects(runShipIntent(f.ctx, intent.id, f.service, fallbackCompilerDiagnostics), {
    code: 'SHIP_INTENT_SUPERSEDED',
  });
  assert.equal(f.calls.includes('validate'), false);
  const pending = (toolchain: string, createdAt: number): PendingShip => ({
    jobId: String(createdAt),
    kind: 'intent',
    env: 'dev',
    targetDigest: 't',
    configuration: 'c',
    requested: 'auto',
    files: [],
    inventory: {},
    revision: String(createdAt),
    createdAt,
    confirmed: false,
    toolchain,
  });
  assert.deepEqual(coverage(pending('a', 1), pending('b', 2)), {
    covered: false,
    reason: 'different toolchain',
  });
});
