// APE-378: ship.apply jobs through the detached worker versus the development broker, on equal
// workloads, alternating; then a coalescing check (two queued applies of one environment).
// Explicitly invoked only; writes only to the --env target through the guarded ship path.
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { loadProject } from '../../packages/core/src/config.ts';
import { dispatch } from '../../packages/core/src/service.ts';
import { JobService } from '../../packages/core/src/jobs.ts';
import { startBroker, stopBroker } from '../../packages/core/src/broker.ts';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i]!.replace(/^--/u, ''), process.argv[i + 1] ?? '');
const ctx = await loadProject(path.resolve(args.get('project')!));
const env = args.get('env')!;
const reps = Number(args.get('reps') ?? 3);
const runtime = path.resolve(args.get('runtime') ?? 'dist/runtime/apexrest.mjs');
const userRequest = args.get('user-request') ?? 'Benchmark the development broker on this DEV/QA/TEST target';
const page = path.join(
  ctx.root,
  ctx.config.application.sourceDir,
  'pages',
  args.get('page-file') ?? 'p00001-home.apx',
);
const original = await readFile(page, 'utf8');
const title = (marker: string) =>
  original.replace(/^(\s{4}title:\s*)(.+)$/mu, (_w, prefix: string) => `${prefix}${marker}`);

async function plan(marker: string) {
  await writeFile(page, title(marker));
  const planned = await dispatch('ship', { project: ctx.root, env, mode: 'plan', userRequest });
  if (!planned.ok) throw new Error(`plan failed: ${planned.summary}`);
  return (planned.data as { planPath: string }).planPath;
}
async function wait(jobs: JobService, id: string) {
  for (;;) {
    const state = (await jobs.status(id, 30)) as {
      status: string;
      result?: { data?: { phases?: { phase: string; ms: number }[] } };
    };
    if (!['queued', 'running'].includes(state.status)) return state;
  }
}
const jobs = new JobService(ctx);
const samples: Record<string, number[]> = { worker: [], broker: [] };
const phases: Record<string, Record<string, number[]>> = { worker: {}, broker: {} };
try {
  for (let i = 0; i < reps; i++)
    for (const mode of i % 2 ? ['broker', 'worker'] : ['worker', 'broker']) {
      if (mode === 'broker') await startBroker(ctx, runtime);
      else await stopBroker(ctx, 60);
      const planPath = await plan(`Bench ${mode} ${i} ${Date.now().toString(36)}`);
      const started = performance.now();
      const job = await jobs.start(
        'ship.apply',
        { project: ctx.root, env, plan: planPath, userRequest },
        runtime,
      );
      const state = await wait(jobs, job.jobId);
      const ms = performance.now() - started;
      console.log(
        `${mode.padEnd(6)} rep ${i} runner=${job.runner} status=${state.status} ${Math.round(ms)} ms`,
      );
      if (state.status !== 'completed') continue;
      samples[mode]!.push(ms);
      for (const entry of state.result?.data?.phases ?? [])
        (phases[mode]![entry.phase] ??= []).push(entry.ms);
    }
  // Coalescing: two applies queued back to back with the broker; the older one is superseded.
  await startBroker(ctx, runtime);
  const first = await plan(`Coalesce A ${Date.now().toString(36)}`);
  await delay(5);
  const second = await plan(`Coalesce B ${Date.now().toString(36)}`);
  const a = await jobs.start('ship.apply', { project: ctx.root, env, plan: first, userRequest }, runtime);
  const b = await jobs.start('ship.apply', { project: ctx.root, env, plan: second, userRequest }, runtime);
  const [sa, sb] = [await wait(jobs, a.jobId), await wait(jobs, b.jobId)];
  console.log(`coalesce: A ${sa.status} (${a.runner}), B ${sb.status} (${b.runner})`);
} finally {
  await writeFile(page, original);
  await stopBroker(ctx, 60).catch(() => undefined);
}
const median = (values: number[]) => [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)];
for (const mode of ['worker', 'broker'])
  console.log(
    `${mode}: n=${samples[mode]!.length} median=${Math.round(median(samples[mode]!) ?? 0)} ms phases: ${Object.entries(
      phases[mode]!,
    )
      .map(([phase, values]) => `${phase} ${Math.round(median(values)!)}`)
      .join(', ')}`,
  );
process.exit(0);
