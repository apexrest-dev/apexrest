// Fast-development clocks (plan §2.1, §7). Explicitly invoked only; writes nothing outside its
// temporary copy and the requested output file. Connected cases run only with --env and write
// only to that environment through the normal guarded ship path.
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rename, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir, cpus, totalmem } from 'node:os';
import path from 'node:path';
import { loadProject } from '../../packages/core/src/config.ts';
import { sourceInventory } from '../../packages/core/src/deploy.ts';
import { revisionOf } from '../../packages/core/src/revision.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { closeSqlclSessions } from '../../packages/core/src/sqlcl-session.ts';
import { pageContext, patchPage } from '../../packages/core/src/edit/patch.ts';
import { insertComponents } from '../../packages/core/src/edit/insert.ts';

type Row = {
  scenario: string;
  commit: string;
  source_revision: string;
  application_size: string;
  toolchain_and_target: string;
  transport: string;
  cold_or_warm: 'cold' | 'warm';
  sample_count: number;
  success_count: number;
  failure_count: number;
  median_ms: number | null;
  p95_ms: number | null;
  clock: string;
  limitations: string;
};

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i]!.replace(/^--/u, ''), process.argv[i + 1] ?? '');
const projectArg = args.get('project');
if (!projectArg) throw new Error('--project PATH is required');
const reps = Math.max(1, Number(args.get('reps') ?? 20));
const env = args.get('env');
const connectedReps = Math.max(1, Math.min(5, Number(args.get('connected-reps') ?? 3)));
const out = args.get('out');
const runtime = args.get('runtime') ?? path.resolve('dist/runtime/apexrest.mjs');

const quantile = (values: number[], q: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]! * 10) / 10;
};
const commit =
  spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || 'unknown';
const dirty = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.trim() ? '+dirty' : '';
const rows: Row[] = [];

const ctx0 = await loadProject(path.resolve(projectArg));
const work = await mkdtemp(path.join(tmpdir(), 'apexrest-fast-dev-'));
await cp(ctx0.root, work, {
  recursive: true,
  filter: (source) => !source.split(path.sep).some((part) => part === '.apexrest' || part === '.git'),
});
const ctx = await loadProject(work);
const app = path.join(work, ctx.config.application.sourceDir);
const files = await sourceInventory(ctx);
const pageFiles = Object.keys(files).filter((file) => /\/pages\/p\d+/u.test(file));
const size = `${Object.keys(files).length} files, ${pageFiles.length} pages`;
const host = `${process.platform}-${process.arch}, ${cpus().length} cpu, ${Math.round(totalmem() / 2 ** 30)} GiB, node ${process.version}`;
const row = (
  scenario: string,
  clock: string,
  samples: number[],
  failures: number,
  extra: Partial<Row> = {},
): Row => ({
  scenario,
  commit: commit + dirty,
  source_revision: revisionOf(files).slice(0, 12),
  application_size: size,
  toolchain_and_target: host,
  transport: 'local',
  cold_or_warm: 'warm',
  sample_count: samples.length + failures,
  success_count: samples.length,
  failure_count: failures,
  median_ms: quantile(samples, 0.5),
  p95_ms: quantile(samples, 0.95),
  clock,
  limitations: '',
  ...extra,
});

// --- Local transformation proxy: computing the source revision (inventory digest).
{
  const samples: number[] = [];
  for (let i = 0; i < reps; i++) {
    const started = performance.now();
    await sourceInventory(ctx);
    samples.push(performance.now() - started);
  }
  rows.push(row('source revision (inventory digest)', 'revision computed', samples, 0));
}

// --- Preview: file write until the server returns HTML containing the edit (server-side only).
const target = pageFiles.map((file) => path.join(work, file)).find((file) => !/p00000/u.test(file));
if (!target) throw new Error('No page file to edit');
const pageId = String(Number(/p(\d+)/u.exec(path.basename(target))![1]));
const server = new PreviewServer({ sourceDir: app, database: ':memory:', toolbar: false });
await server.start();
const pageUrl = (await server.pages()).find((page) => page.id === pageId)?.url;
if (!pageUrl) throw new Error(`Preview has no page ${pageId}`);
const fetchPage = async () => (await fetch(new URL(pageUrl, server.url))).text();
const coldStarted = performance.now();
await fetchPage();
rows.push(
  row(
    `preview first render (page ${pageId})`,
    'server ready, not browser paint',
    [performance.now() - coldStarted],
    0,
    { cold_or_warm: 'cold' },
  ),
);
const original = await readFile(target, 'utf8');
// The page title is rendered into <title>; a page without one falls back to its name.
const titleLine = /^\s{4}title:/mu.test(original) ? /^(\s{4}title:\s*)(.+)$/mu : /^(\s{4}name:\s*)(.+)$/mu;
async function waitFor(marker: string, timeoutMs = 5000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if ((await fetchPage()).includes(marker)) return performance.now();
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return undefined;
}
async function editScenario(name: string, apply: (marker: string) => Promise<void>) {
  const samples: number[] = [];
  let failures = 0;
  for (let i = 0; i < reps; i++) {
    const marker = `Bench${Date.now().toString(36)}${i}`;
    const started = performance.now();
    await apply(marker);
    const seen = await waitFor(marker);
    if (seen === undefined) failures++;
    else samples.push(seen - started);
  }
  await writeFile(target!, original);
  rows.push(
    row(name, 'file write -> server HTML has the edit', samples, failures, {
      limitations: 'server-side preview readiness; browser paint not observed',
    }),
  );
}
await editScenario(`preview page title edit (page ${pageId})`, async (marker) => {
  await writeFile(
    target,
    original.replace(titleLine, (_whole, prefix: string) => `${prefix}${marker}`),
  );
});
await editScenario('preview burst save of 3 files', async (marker) => {
  const others = pageFiles
    .map((file) => path.join(work, file))
    .filter((file) => file !== target)
    .slice(0, 2);
  for (const file of others) await writeFile(file, await readFile(file, 'utf8'));
  await writeFile(
    target,
    original.replace(titleLine, (_whole, prefix: string) => `${prefix}${marker}`),
  );
});
// Rename that keeps an older mtime: the max-mtime refresh cannot see it (plan benchmark case 8).
{
  let failures = 0;
  const samples: number[] = [];
  for (let i = 0; i < Math.min(reps, 5); i++) {
    const marker = `Renamed${Date.now().toString(36)}${i}`;
    const old = new Date(Date.now() - 86_400_000);
    const renamed = target.replace(/\.apx$/u, `-r${i}.apx`);
    const started = performance.now();
    await writeFile(
      target,
      original.replace(titleLine, (_whole, prefix: string) => `${prefix}${marker}`),
    );
    await utimes(target, old, old);
    await rename(target, renamed);
    const seen = await waitFor(marker, 3000);
    if (seen === undefined) failures++;
    else samples.push(seen - started);
    await rename(renamed, target);
  }
  await writeFile(target, original);
  rows.push(
    row('preview rename with older mtime', 'file rename -> server HTML has the edit', samples, failures, {
      limitations: 'failure = not detected within 3 s',
    }),
  );
}
// --- Semantic edits through the digest-bound services (context -> patch/insert -> preview HTML).
async function semanticScenario(
  name: string,
  page: string,
  file: string,
  apply: (marker: string, digest: string) => Promise<void>,
) {
  const url = (await server.pages()).find((entry) => entry.id === page)?.url;
  const before = await readFile(file, 'utf8');
  const samples: number[] = [];
  let failures = 0;
  for (let i = 0; i < reps; i++) {
    const marker = `Bench${Date.now().toString(36)}${i}`;
    const started = performance.now();
    await apply(marker, (await pageContext(ctx, page)).digest);
    let seen: number | undefined;
    while (url && performance.now() - started < 5000) {
      if ((await (await fetch(new URL(url, server.url))).text()).includes(marker)) {
        seen = performance.now();
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    if (seen === undefined) failures++;
    else samples.push(seen - started);
    await writeFile(file, before);
  }
  rows.push(
    row(name, 'context + service call -> server HTML has the edit', samples, failures, {
      limitations: `page ${page}; server-side preview readiness; browser paint not observed`,
    }),
  );
}
await semanticScenario('semantic property edit', pageId, target, async (marker, digest) => {
  await patchPage(ctx, {
    page: pageId,
    operations: [{ target: 'page', property: 'title', value: marker }],
    expectedDigest: digest,
  });
});
// The first page with a reportRegion region carries the reportRegion scenarios.
let reportRegion:
  { page: string; region: string; query: string; columns: string[]; file: string } | undefined;
for (const file of pageFiles) {
  const page = String(Number(/p(\d+)/u.exec(path.basename(file))![1]));
  if (page === '0') continue;
  const context = await pageContext(ctx, page);
  const region = context.regions.find((entry) => entry.query && entry.columns?.length);
  if (region)
    reportRegion = {
      page,
      region: region.target.slice('region:'.length),
      query: region.query!,
      columns: region.columns!.map((column) => column.target.split('.').pop()!),
      file: path.join(work, file),
    };
  if (reportRegion) break;
}
if (reportRegion) {
  const found = reportRegion;
  await semanticScenario(
    'add report column with projection',
    found.page,
    found.file,
    async (marker, digest) => {
      await patchPage(ctx, {
        page: found.page,
        operations: [
          {
            target: `region:${found.region}`,
            property: 'query',
            value: `select q.*, 'x' as BENCH_COLUMN from (\n${found.query}\n) q`,
            columns: [...found.columns.map((name) => ({ name })), { name: 'BENCH_COLUMN', heading: marker }],
          },
        ],
        expectedDigest: digest,
      });
    },
  );
  await semanticScenario('filter with submit/refresh', found.page, found.file, async (marker, digest) => {
    const suffix = Date.now().toString(36);
    const item = `P${found.page}_BENCH_${suffix.toUpperCase()}`;
    await insertComponents(ctx, {
      page: found.page,
      components: {
        regions: [{ id: `bench-${suffix}`, type: 'staticContent', name: marker }],
        items: [
          {
            name: item,
            type: 'selectList',
            label: 'Status',
            region: `bench-${suffix}`,
            lov: [{ label: 'A', value: 'A' }],
          },
        ],
        refreshes: [{ items: [item], regions: [found.region] }],
      },
      expectedDigest: digest,
    });
  });
} else
  for (const scenario of ['add report column with projection', 'filter with submit/refresh'])
    rows.push(
      row(scenario, 'not_run', [], 0, {
        limitations: 'not_run: the project has no reportRegion region with a query',
      }),
    );
await server.stop();

// --- Compiler validation (offline SQLcl), cold then warm in one process.
{
  const oracle = new OracleAdapter();
  let toolchain = 'SQLcl offline compiler';
  const samples: number[] = [];
  let failures = 0;
  for (let i = 0; i < Math.min(reps, 5) + 1; i++) {
    const started = performance.now();
    try {
      const result = await oracle.validate(app);
      toolchain = `SQLcl ${result.compiler.version}`;
      const ms = performance.now() - started;
      if (i === 0)
        rows.push(
          row('compiler validation', 'snapshot submitted -> compiler result', [ms], 0, {
            cold_or_warm: 'cold',
            toolchain_and_target: `${host}; ${toolchain}`,
          }),
        );
      else samples.push(ms);
    } catch (error) {
      failures++;
      if (i === 0)
        rows.push(
          row('compiler validation', 'snapshot submitted -> compiler result', [], 1, {
            cold_or_warm: 'cold',
            limitations: (error as Error).message.slice(0, 200),
          }),
        );
    }
  }
  rows.push(
    row('compiler validation', 'snapshot submitted -> compiler result', samples, failures, {
      toolchain_and_target: `${host}; ${toolchain}`,
    }),
  );
  await closeSqlclSessions().catch(() => undefined);
}

// --- Connected: small selected-page update through the guarded ship path (CLI, cold process).
if (env) {
  const page = path.join(ctx0.root, path.relative(work, target));
  const before = await readFile(page, 'utf8');
  const samples: number[] = [];
  const phases: Record<string, number[]> = {};
  let failures = 0;
  let target_ = '';
  try {
    for (let i = 0; i < connectedReps; i++) {
      await writeFile(
        page,
        before.replace(
          titleLine,
          (_whole, prefix: string) => `${prefix}Bench ${i} ${Date.now().toString(36)}`,
        ),
      );
      const started = performance.now();
      const result = spawnSync(
        process.execPath,
        [
          runtime,
          'ship',
          '--project',
          ctx0.root,
          '--env',
          env,
          '--mode',
          'apply',
          '--user-request',
          args.get('user-request') ?? 'Benchmark the fast-development clocks on this DEV/QA/TEST target',
          '--json',
        ],
        { encoding: 'utf8', maxBuffer: 64 * 2 ** 20 },
      );
      const ms = performance.now() - started;
      const parsed = JSON.parse(result.stdout || '{}') as {
        ok?: boolean;
        data?: { phases?: { phase: string; ms: number }[]; application?: { url?: string } };
      };
      if (parsed.ok) {
        samples.push(ms);
        for (const phase of parsed.data?.phases ?? []) (phases[phase.phase] ??= []).push(phase.ms);
        target_ = parsed.data?.application?.url ?? target_;
      } else failures++;
    }
  } finally {
    await writeFile(page, before);
  }
  const detail = Object.entries(phases)
    .map(([phase, values]) => `${phase} ${quantile(values, 0.5)}`)
    .join(', ');
  rows.push(
    row(
      `native selected-page update (env ${env})`,
      'ship apply started -> import and readback confirmed',
      samples,
      failures,
      {
        cold_or_warm: 'cold',
        transport: 'SQLcl CLI',
        toolchain_and_target: `${host}; ${target_}`,
        limitations: `CLI process per run; median phases ms: ${detail}. The source edit is restored locally afterwards; the target keeps the last benchmark title until the next ship.`,
      },
    ),
  );
} else
  rows.push(
    row('native selected-page update', 'not_run', [], 0, {
      limitations: 'not_run: pass --env for an authorized DEV/QA/TEST target',
    }),
  );
rows.push(
  row('page from recipe to preview', 'not_run', [], 0, {
    limitations: 'not_run: new-page scaffolding is not wired into this benchmark yet',
  }),
  row('shared LOV change', 'not_run', [], 0, {
    limitations: 'not_run: semantic edits cover page files only; shared components have no edit service',
  }),
);

await rm(work, { recursive: true, force: true });
const report = { createdAt: new Date().toISOString(), project: ctx0.config.projectId, reps, rows };
if (out) await writeFile(out, JSON.stringify(report, null, 2) + '\n');
for (const r of rows)
  console.log(
    `${r.scenario.padEnd(46)} ${r.cold_or_warm.padEnd(5)} n=${String(r.success_count).padStart(2)}/${String(r.sample_count).padEnd(2)} median=${String(r.median_ms ?? '-').padStart(8)} p95=${String(r.p95_ms ?? '-').padStart(8)}  ${r.limitations}`,
  );
