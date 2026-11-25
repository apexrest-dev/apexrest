import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readdir, readFile, rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { workingCopyFixture } from '../fixtures/working-copy.ts';
import { fallbackCompilerDiagnostics, shipApply, shipPlan } from '../../packages/core/src/ship.ts';
import { JobService } from '../../packages/core/src/jobs.ts';
import { success } from '../../packages/core/src/result.ts';
import { Fault } from '../../packages/core/src/result.ts';
import {
  measuredSpan,
  openSpan,
  spanned,
  traceReport,
  withTrace,
  type TraceReport,
} from '../../packages/core/src/spans.ts';

type Spans = TraceReport['spans'];
const one = (spans: Spans, name: string, stage?: string) => {
  const found = spans.filter((span) => span.name === name && (!stage || span.attributes?.stage === stage));
  assert.equal(found.length, 1, `one ${name} span`);
  return found[0]!;
};
const duration = (span: Spans[number]) => span.endMs! - span.startMs;

async function shipFixture(t: test.TestContext) {
  const f = await workingCopyFixture();
  f.ctx.config.environments.dev!.baseUrl = 'https://localhost/ords/';
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  const planned = await shipPlan(f.ctx, 'dev', f.service, fallbackCompilerDiagnostics);
  return { f, planned };
}

test('setup before the backup event and the prewrite export before import are attributed to their operations', async (t) => {
  const { f, planned } = await shipFixture(t);
  // Deterministic costs: apply setup 40 ms, the prewrite observation 60 ms, the import 80 ms.
  const mutation = f.oracle.requireMutationSupport.bind(f.oracle);
  f.oracle.requireMutationSupport = async () => {
    await delay(40);
    return mutation();
  };
  const fingerprint = f.service.fingerprint.bind(f.service);
  f.service.fingerprint = async (...args: Parameters<typeof fingerprint>) => {
    await delay(60);
    return fingerprint(...args);
  };
  const importApplication = f.oracle.importApplication.bind(f.oracle);
  f.oracle.importApplication = async (...args: Parameters<typeof importApplication>) => {
    await delay(80);
    return importApplication(...args);
  };
  const result = await shipApply(f.ctx, planned.plan, 'Deploy the customers page to dev', f.service);
  const report = result.operations!;
  assert.equal(result.correlationId, report.correlationId);
  const spans = report.spans;
  const setup = one(spans, 'setup', 'apply');
  const backup = one(spans, 'backup');
  const prewrite = one(spans, 'prewriteObservation');
  const submission = one(spans, 'importSubmission');
  // The client phase names are unchanged: backing_up still starts before the apply setup and
  // importing still contains the prewrite export...
  const phase = (name: string) => result.phases.find((entry) => entry.phase === name)!.ms;
  assert.ok(phase('backing_up') >= 38, 'backing_up includes the setup');
  assert.ok(phase('importing') >= 135, 'importing includes the prewrite export');
  // ...while the spans put each cost on the operation that ran.
  assert.ok(duration(setup) >= 38 && setup.endMs! <= backup.startMs);
  assert.ok(duration(backup) < 38, 'the backup span holds no setup time');
  assert.ok(duration(prewrite) >= 58 && prewrite.endMs! <= submission.startMs);
  assert.ok(duration(submission) >= 78 && duration(submission) < 138, 'no prewrite time in the import');
  assert.equal(backup.attributes?.path, 'retained-plan-observation');
  // Nested work is not counted twice; sequential time never exceeds the wall time.
  assert.ok(report.overlapMs < 1);
  assert.ok(report.sequentialMs <= report.wallMs);
  // The run journal carries the same correlation id and the spans on its last event.
  const runDir = path.join(f.ctx.root, '.apexrest/deployments', result.runId);
  const journal = (
    await readFile(path.join(runDir, 'journal.jsonl'), 'utf8').catch(async () => {
      const files = await readdir(runDir);
      return readFile(
        path.join(
          runDir,
          files.find((file) => file.startsWith('journal'))!,
        ),
        'utf8',
      );
    })
  )
    .trim()
    .split('\n')
    .map(
      (line) =>
        JSON.parse(line) as { correlationId?: string; state: string; details: { operations?: TraceReport } },
    );
  assert.ok(journal.every((event) => event.correlationId === report.correlationId));
  assert.equal(journal.at(-1)!.state, 'succeeded');
  assert.equal(journal.at(-1)!.details.operations?.correlationId, report.correlationId);
  // No credentials, connection details or sources in the report.
  const text = JSON.stringify(report);
  assert.doesNotMatch(text, /sqlcl-store|password|application\.apx|connections/u);
});

test('a missing kept plan observation records the fresh-export fallback path, not a duration guess', async (t) => {
  const { f, planned } = await shipFixture(t);
  await rm(path.join(f.ctx.root, '.apexrest/plans', planned.plan.id, 'live-before'), {
    recursive: true,
    force: true,
  });
  const result = await shipApply(f.ctx, planned.plan, 'Deploy the customers page to dev', f.service);
  const spans = result.operations!.spans;
  assert.equal(one(spans, 'targetObservation').attributes?.observation, 'fresh-export');
  assert.equal(one(spans, 'backup').attributes?.path, 'start-observation-export');
});

test('failed and unknown imports keep completed and unfinished spans without inventing an end', async (t) => {
  const { f, planned } = await shipFixture(t);
  f.oracle.importApplication = async () => {
    throw new Fault(
      'OUTCOME_UNKNOWN',
      'SQLcl stopped before Oracle confirmed the import.',
      6,
      'outcome_unknown',
      {
        cause: 'killed',
      },
    );
  };
  f.service.recover = async () => {
    throw new Fault('RECOVERY_DEFERRED', 'Recovery is not part of this fixture.', 6, 'outcome_unknown');
  };
  const error = (await shipApply(f.ctx, planned.plan, 'Deploy the customers page to dev', f.service).then(
    () => assert.fail('the import must not succeed'),
    (caught: unknown) => caught,
  )) as Fault;
  assert.equal(typeof error.details?.correlationId, 'string');
  const runDir = path.join(f.ctx.root, '.apexrest/deployments');
  const [run] = await readdir(runDir);
  const files = await readdir(path.join(runDir, run!));
  const journal = (
    await readFile(
      path.join(
        runDir,
        run!,
        files.find((file) => file.startsWith('journal'))!,
      ),
      'utf8',
    )
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { state: string; details: { operations?: TraceReport } });
  const last = journal.at(-1)!;
  assert.equal(last.state, 'outcome_unknown');
  const spans = last.details.operations!.spans;
  const submission = one(spans, 'importSubmission');
  assert.equal(submission.status, 'unknown');
  assert.equal(submission.endMs, null, 'an unknown outcome has no completion time');
  assert.equal(one(spans, 'prewriteObservation').status, 'ok');
  assert.equal(one(spans, 'sourceFreeze').status, 'ok');
  assert.equal(last.details.operations!.correlationId, error.details?.correlationId);
});

test('span totals separate wall time, overlap and background work; failures and cancellation end, unknowns do not', async () => {
  await withTrace(
    async () => {
      const origin = Date.now();
      // Measured spans give exact intervals: two sequential spans overlapping by 10 ms, a child
      // and a background span that never count as sequential time.
      const first = measuredSpan('targetObservation', origin, origin + 50)!;
      measuredSpan('backupCopyHash', origin + 10, origin + 30, undefined, first);
      measuredSpan('backup', origin + 40, origin + 100);
      const background = openSpan('compilerPreparation', undefined, { background: true });
      background.end();
      const report = traceReport()!;
      assert.equal(report.correlationId, 'fixed-id');
      assert.equal(report.spanTotalMs, 110);
      assert.equal(report.sequentialMs, 100);
      assert.equal(report.overlapMs, 10);
      await assert.rejects(
        spanned('importSubmission', async () => {
          throw new Fault('CANCELLED', 'Cancelled.', 6, 'cancelled');
        }),
      );
      await assert.rejects(
        spanned('readback', async () => {
          throw new Fault('POST_DEPLOY_VERIFICATION_FAILED', 'Differs.', 1);
        }),
      );
      openSpan('scripts');
      const final = traceReport()!.spans;
      assert.equal(one(final, 'importSubmission').status, 'cancelled');
      assert.notEqual(one(final, 'importSubmission').endMs, null);
      assert.equal(one(final, 'readback').status, 'failed');
      assert.deepEqual(
        { status: one(final, 'scripts').status, endMs: one(final, 'scripts').endMs },
        { status: 'unfinished', endMs: null },
      );
    },
    { correlationId: 'fixed-id', origin: Date.now() },
  );
  // Outside a trace nothing is recorded.
  assert.equal(traceReport(), undefined);
});

test('a job measures its queue delay and keeps its id as the correlation id', async (t) => {
  const f = await workingCopyFixture();
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  const jobs = new JobService(f.ctx);
  let report: TraceReport | undefined;
  const job = await jobs.startInline('apex.validate', {}, async () => {
    report = traceReport();
    return success('apex.validate', {});
  });
  assert.equal((await jobs.status(job.jobId, 2)).status, 'completed');
  assert.equal(report?.correlationId, job.jobId);
  const queue = one(report!.spans, 'queue');
  assert.equal(queue.attributes?.runner, 'in-process');
  assert.ok(queue.startMs === 0 && queue.endMs! >= 0);
  // An in-process runner has no worker process to start.
  assert.equal(
    report!.spans.some((span) => span.name === 'workerStartup'),
    false,
  );
});
