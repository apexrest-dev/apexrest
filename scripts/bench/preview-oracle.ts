// APE-379 qualification probe: Oracle round trips, batch segments, APEX session creations and
// main-thread blocking per connected preview page request. Every request is rolled back (the
// preview default); the source edit is restored afterwards. Explicitly invoked only.
// Usage: node --experimental-strip-types scripts/bench/preview-oracle.ts --project PATH --env NAME
//        [--pages 1,10] [--reps 5] [--out FILE]
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { loadProject } from '../../packages/core/src/config.ts';
import { connectOracle } from '../../packages/core/src/preview/oracle/connect.ts';
import { WorkerBridge, type OracleLink } from '../../packages/core/src/preview/oracle/bridge.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i]!.replace(/^--/u, ''), process.argv[i + 1] ?? '');
const ctx = await loadProject(path.resolve(args.get('project')!));
const env = args.get('env')!;
const reps = Number(args.get('reps') ?? 5);
const sourceDir = path.resolve(ctx.root, ctx.config.application.sourceDir);

interface Counter {
  calls: number;
  segments: number;
  apexSessions: number;
  queries: number;
  plsqlUnits: number;
  blockedMs: number;
  callMs: number[];
}
const fresh = (): Counter => ({
  calls: 0,
  segments: 0,
  apexSessions: 0,
  queries: 0,
  plsqlUnits: 0,
  blockedMs: 0,
  callMs: [],
});
let counter = fresh();

/** Counts what the synchronous renderer sends; time inside run() is main-thread time blocked in Atomics.wait. */
class CountingLink implements OracleLink {
  readonly inner: OracleLink;
  constructor(inner: OracleLink) {
    this.inner = inner;
  }
  run(input: string): string {
    const started = performance.now();
    try {
      return this.inner.run(input);
    } finally {
      const ms = performance.now() - started;
      counter.calls++;
      counter.blockedMs += ms;
      counter.callMs.push(ms);
      counter.segments += (input.match(/^prompt \S+_\d+$/gmu) ?? []).length;
      counter.apexSessions += (input.match(/apex_session\.create_session/gu) ?? []).length;
      counter.queries += (input.match(/^set sqlformat json/gimu) ?? []).length;
      const queries = (input.match(/^set sqlformat json/gimu) ?? []).length;
      counter.plsqlUnits += (input.match(/^\/$/gmu) ?? []).length - queries;
    }
  }
  close(): void {
    this.inner.close();
  }
}

const connectStarted = performance.now();
const oracle = await connectOracle(
  ctx.root,
  env,
  (settings) => new CountingLink(new WorkerBridge({ settings })),
);
const connect = { ms: Math.round(performance.now() - connectStarted), ...counter, callMs: undefined };
counter = fresh();
const server = new PreviewServer({ oracle, sourceDir, toolbar: false });
await server.start();
const pages = (args.get('pages') ?? '').split(',').filter(Boolean);
const urls = new Map(server.pages().map((p) => [p.id, p.url]));
const targets = pages.length ? pages : [...urls.keys()].filter((id) => id !== '9999');

const median = (values: number[]) => [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)] ?? 0;
const round = (value: number) => Math.round(value * 10) / 10;
async function request(page: string) {
  counter = fresh();
  const started = performance.now();
  const response = await fetch(urls.get(page)!);
  const body = await response.text();
  const ms = performance.now() - started;
  return { status: response.status, body, bytes: body.length, ms, ...counter };
}
// Event-loop responsiveness while a page renders: a 1 ms timer's worst lateness.
async function lateness(page: string) {
  let worst = 0;
  let running = true;
  const tick = async () => {
    while (running) {
      const before = performance.now();
      await delay(1);
      worst = Math.max(worst, performance.now() - before - 1);
    }
  };
  const ticking = tick();
  await request(page);
  running = false;
  await ticking;
  return worst;
}

const rows = [];
try {
  for (const page of targets) {
    const first = await request(page);
    const repeat = [];
    for (let i = 0; i < reps; i++) repeat.push(await request(page));
    const worstLateness = await lateness(page);
    const last = repeat.at(-1)!;
    const row = {
      page,
      status: last.status,
      first: {
        ms: round(first.ms),
        calls: first.calls,
        segments: first.segments,
        apexSessions: first.apexSessions,
        blockedMs: round(first.blockedMs),
      },
      repeatMedian: {
        ms: round(median(repeat.map((r) => r.ms))),
        blockedMs: round(median(repeat.map((r) => r.blockedMs))),
        calls: median(repeat.map((r) => r.calls)),
        segments: median(repeat.map((r) => r.segments)),
        queries: median(repeat.map((r) => r.queries)),
        plsqlUnits: median(repeat.map((r) => r.plsqlUnits)),
        apexSessions: median(repeat.map((r) => r.apexSessions)),
        medianCallMs: round(median(repeat.flatMap((r) => r.callMs))),
      },
      blockedShare: round(median(repeat.map((r) => r.blockedMs / r.ms))),
      worstEventLoopLatenessMs: round(worstLateness),
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  // Edit/render loop: title edit on the first target, then the next request of that page.
  const file = path.join(
    sourceDir,
    'pages',
    (await import('node:fs'))
      .readdirSync(path.join(sourceDir, 'pages'))
      .find((f) => f.startsWith(`p${targets[0]!.padStart(5, '0')}`))!,
  );
  const original = await readFile(file, 'utf8');
  const edits = [];
  try {
    for (let i = 0; i < reps; i++) {
      const marker = `Bench ${i} ${Date.now().toString(36)}`;
      await writeFile(
        file,
        original.replace(/^(\s{4}title:\s*)(.+)$/mu, (_w, prefix: string) => `${prefix}${marker}`),
      );
      const started = performance.now();
      let seen;
      for (;;) {
        seen = await request(targets[0]!);
        if (seen.body.includes(marker)) break;
        if (performance.now() - started > 15_000) break;
      }
      edits.push({ ms: performance.now() - started, blockedMs: seen.blockedMs, calls: seen.calls });
    }
  } finally {
    await writeFile(file, original);
  }
  const editRow = {
    scenario: `title edit -> connected page ${targets[0]} has it`,
    medianMs: round(median(edits.map((e) => e.ms))),
    medianBlockedMs: round(median(edits.map((e) => e.blockedMs))),
    medianCalls: median(edits.map((e) => e.calls)),
  };
  console.log(JSON.stringify(editRow));
  const report = {
    at: new Date().toISOString(),
    project: ctx.config.projectId,
    env,
    reps,
    connect,
    pages: rows,
    edit: editRow,
  };
  if (args.get('out')) await writeFile(args.get('out')!, JSON.stringify(report, null, 2) + '\n');
} finally {
  await server.stop();
}
process.exit(0);
