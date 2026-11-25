// Manually invoked: node scripts/bench/run.mjs scripts/bench/scenarios.ts --project <26.2 customer-crm project>
//   [--reps 5] [--large-pages 300] [--out FILE]
//
// Fast-development scenario pack (V12), on a temporary copy of the project:
//   1. page creation from the reviewed report-form recipe, from a declared initial state (the copy
//      without pages 30/31) to the preview serving the new report with its expected components;
//   2. a functional filter: addFilter on the customers report, then changing the item value must
//      change that region's rows, and clearing it must restore them;
//   3. a compound presentation change (page title, region title and column order in one edit);
//   4. one-page edits in a large application (the customers page copied to --large-pages pages).
// Each scenario reports repetitions, failures, success rate, median and p95, the cold first run
// separately, and the dataset size. Timings end when the preview serves the expected HTML: browser
// paint is not observed here (see scripts/bench/visible-change.ts), so the proposed paint targets
// (<= 1 s semantic edit, 1-3 s prepared recipe) are assessed against preview readiness only.
// Preview results are not native APEX qualification. Results describe this dataset and host only.
import { cp, mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { cpus, platform, release, tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { loadProject } from '../../packages/core/src/config.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { defaultAssetsDir } from '../../packages/core/src/preview/assets.ts';
import { runRecipe } from '../../packages/core/src/recipes.ts';
import { editPage } from '../../packages/core/src/edit/page-edit.ts';
import { pageContext } from '../../packages/core/src/edit/patch.ts';
import { summarize, assessTarget, type ScenarioRow } from './lib/scenario-stats.ts';

const argument = (name: string) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const projectArg = argument('--project');
if (!projectArg) throw new Error('Pass --project <26.2 customer-crm project>.');
const reps = Number(argument('--reps') ?? 5);
const largePages = Number(argument('--large-pages') ?? 300);
const out = argument('--out');

const CONTRACT = {
  schemaVersion: 1,
  id: 'customer',
  label: 'Customer',
  pluralLabel: 'Customers',
  read: { table: 'APEXREST_CUSTOMERS' },
  key: ['ID'],
  fields: {
    ID: { type: 'number', label: 'ID', required: true, readOnly: true },
    NAME: { type: 'varchar2', label: 'Name', required: true, maxLength: 200 },
    EMAIL: { type: 'varchar2', label: 'Email', required: true, maxLength: 320 },
    STATUS: {
      type: 'varchar2',
      label: 'Status',
      lov: {
        values: [
          { label: 'Active', value: 'ACTIVE' },
          { label: 'Inactive', value: 'INACTIVE' },
        ],
      },
    },
  },
  // The sample's existing scheme, so the recipe pages bind the application's own authorization.
  authorization: { read: { scheme: 'administration-rights' }, write: { scheme: 'administration-rights' } },
  write: { table: 'APEXREST_CUSTOMERS', operations: ['insert', 'update', 'delete'], lostUpdate: 'rowValues' },
};
const SEED = [
  "insert into apexrest_customers (name, email, status) values ('Ada Active', 'ada@example.test', 'ACTIVE');",
  "insert into apexrest_customers (name, email, status) values ('Ian Inactive', 'ian@example.test', 'INACTIVE');",
  "insert into apexrest_customers (name, email, status) values ('Ann Active', 'ann@example.test', 'ACTIVE');",
].join('\n');

const rows: ScenarioRow[] = [];
/** Why repetitions failed (first message per scenario and cause), reported with the rows. */
const failureReasons: Record<string, string[]> = {};
const reason = (scenario: string, error: unknown) => {
  const message = error instanceof Error ? error.message.slice(0, 300) : String(error);
  const list = (failureReasons[scenario] ??= []);
  if (!list.includes(message)) list.push(message);
};
const until = async (check: () => Promise<boolean>, timeoutMs = 10000) => {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (await check()) return performance.now();
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return undefined;
};

async function workspace(extraPages = 0) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-scenarios-'));
  await cp(projectArg!, root, { recursive: true });
  const ctx = await loadProject(root);
  const app = path.join(root, ctx.config.application.sourceDir);
  const seed = path.join(root, '.bench-seed');
  await mkdir(seed, { recursive: true });
  await writeFile(path.join(seed, '01-rows.sql'), SEED + '\n');
  await mkdir(path.join(root, 'entities'), { recursive: true });
  await writeFile(path.join(root, 'entities/customer.json'), JSON.stringify(CONTRACT, null, 2));
  if (extraPages) {
    const template = await readFile(path.join(app, 'pages/p00010-customers.apx'), 'utf8');
    for (let i = 0; i < extraPages; i++) {
      const page = 2000 + i;
      await writeFile(
        path.join(app, 'pages', `p0${page}-copy.apx`),
        template
          .replace(/^page 10 \(/mu, `page ${page} (`)
          .replace(/^ {4}alias: .*$/mu, `    alias: COPY${page}`)
          .replaceAll('P10_', `P${page}_`)
          .replaceAll('htmlDomId: customers_report', `htmlDomId: customers_report_${page}`),
      );
    }
  }
  const server = new PreviewServer({
    sourceDir: app,
    assetsDir: defaultAssetsDir(),
    database: ':memory:',
    seedDirs: [path.join(root, ctx.config.database.migrationsDir), seed],
  });
  await server.start();
  const fileCount = (await readdir(path.join(app, 'pages'))).length;
  const close = async () => {
    await server.stop();
    await rm(root, { recursive: true, force: true });
  };
  return { root, ctx, app, server, fileCount, close };
}
const html = async (server: PreviewServer, page: string, query = '') => {
  const entry = (await server.pages()).find((candidate) => candidate.id === page);
  if (!entry) return '';
  return (await fetch(new URL(entry.url + query, server.url))).text();
};

// 1. Page creation from the reviewed recipe.
{
  const samples: number[] = [];
  let failures = 0;
  let files = 0;
  for (let i = 0; i < reps + 1; i++) {
    const w = await workspace();
    files = w.fileCount;
    try {
      // Declared initial state: pages 30 and 31 do not exist and the preview does not serve them.
      if (await html(w.server, '30')) throw new Error('initial state already has page 30');
      const started = performance.now();
      await runRecipe(w.ctx, {
        request: { recipe: 'report-form', entity: 'customer', pages: { report: 30, form: 31 } },
      });
      const seen = await until(async () => {
        const page = await html(w.server, '30');
        return (
          page.includes('customer-report') && page.includes('Ada Active') && page.includes('create-customer')
        );
      });
      if (seen === undefined) {
        failures++;
        reason('page creation', new Error('the new page did not show its report, rows and create button'));
      } else if (i === 0)
        rows.push(summarize('page creation from recipe (cold)', [seen - started], 0, { files }));
      else samples.push(seen - started);
    } catch (error) {
      failures++;
      reason('page creation', error);
    } finally {
      await w.close();
    }
  }
  rows.push(summarize('page creation from recipe (warm)', samples, failures, { files }));
}

// 2. Functional filter, 3. compound presentation change, 4. large application.
for (const [scenario, extra] of [
  ['small', 0],
  ['large', largePages],
] as const) {
  const w = await workspace(extra);
  try {
    const firstRender = performance.now();
    await html(w.server, '10');
    rows.push(
      summarize(`first render (${scenario}, cold)`, [performance.now() - firstRender], 0, {
        files: w.fileCount,
      }),
    );
    const file = path.join(w.app, 'pages/p00010-customers.apx');
    const original = await readFile(file, 'utf8');
    if (scenario === 'small') {
      const filterSamples: number[] = [];
      let filterFailures = 0;
      for (let i = 0; i < reps; i++) {
        await writeFile(file, original);
        await until(async () => !(await html(w.server, '10')).includes('P10_BENCH_STATUS'), 3000);
        const started = performance.now();
        try {
          await editPage(w.ctx, {
            page: '10',
            expectedDigest: (await pageContext(w.ctx, '10')).digest,
            operations: [
              {
                op: 'addFilter',
                region: { id: 'bench-filters', type: 'staticContent', name: 'Filters' },
                item: {
                  name: 'P10_BENCH_STATUS',
                  region: 'bench-filters',
                  type: 'textField',
                  label: 'Status',
                },
                targets: [
                  {
                    region: 'customers',
                    sql: 'select id, name, email, status from apexrest_customers where (:P10_BENCH_STATUS is null or status = :P10_BENCH_STATUS)',
                    columns: [{ name: 'ID' }, { name: 'NAME' }, { name: 'EMAIL' }, { name: 'STATUS' }],
                  },
                ],
              },
            ],
          });
          const ready = await until(async () => (await html(w.server, '10')).includes('P10_BENCH_STATUS'));
          // Functional: the item value changes the region's rows, and clearing it restores them.
          const all = await html(w.server, '10');
          const inactive = await html(w.server, '10', '?p10_bench_status=INACTIVE');
          const cleared = await html(w.server, '10', '?p10_bench_status=');
          const works =
            all.includes('Ada Active') &&
            all.includes('Ian Inactive') &&
            inactive.includes('Ian Inactive') &&
            !inactive.includes('Ada Active') &&
            cleared.includes('Ada Active') &&
            cleared.includes('Ian Inactive');
          if (ready === undefined || !works) {
            filterFailures++;
            reason(
              'functional filter',
              new Error(
                ready === undefined
                  ? 'filter item not rendered'
                  : 'item value did not change or restore the rows',
              ),
            );
          } else filterSamples.push(ready - started);
        } catch (error) {
          filterFailures++;
          reason('functional filter', error);
        }
      }
      rows.push(
        summarize('functional filter (addFilter, value and clear verified)', filterSamples, filterFailures, {
          files: w.fileCount,
        }),
      );
      await writeFile(file, original);
    }
    // Compound presentation change and one-page edit, timed to preview readiness.
    const edits: number[] = [];
    let editFailures = 0;
    for (let i = 0; i < reps; i++) {
      const marker = `Bench${Date.now().toString(36)}${i}`;
      const started = performance.now();
      try {
        await editPage(w.ctx, {
          page: '10',
          expectedDigest: (await pageContext(w.ctx, '10')).digest,
          operations:
            scenario === 'small'
              ? [
                  { op: 'set', target: 'page', property: 'title', value: marker },
                  { op: 'set', target: 'region:customers', property: 'title', value: `${marker} list` },
                  { op: 'orderColumns', region: 'customers', order: ['NAME', 'ID', 'EMAIL', 'STATUS'] },
                ]
              : [{ op: 'set', target: 'page', property: 'title', value: marker }],
        });
        const seen = await until(async () => (await html(w.server, '10')).includes(marker));
        if (seen === undefined) editFailures++;
        else edits.push(seen - started);
      } catch (error) {
        editFailures++;
        reason(scenario === 'small' ? 'compound change' : 'large application edit', error);
      }
    }
    rows.push(
      summarize(
        scenario === 'small'
          ? 'compound presentation change (3 operations)'
          : `one-page edit in a large application`,
        edits,
        editFailures,
        { files: w.fileCount },
      ),
    );
  } finally {
    await w.close();
  }
}

const report = {
  kind: 'manually invoked fast-development scenario pack (preview readiness)',
  date: new Date().toISOString(),
  host: { platform: platform(), release: release(), cpu: cpus()[0]?.model, node: process.version },
  dataset: `${path.basename(projectArg)} (customer-crm), 3 seeded customers, large application ${largePages} copied pages`,
  repetitions: reps,
  rows,
  failureReasons,
  targets: [
    assessTarget(
      'semantic edit',
      rows.filter((row) => /compound|one-page/u.test(row.scenario)),
      1000,
    ),
    assessTarget(
      'prepared recipe',
      rows.filter((row) => /recipe \(warm\)/u.test(row.scenario)),
      3000,
    ),
  ],
  outcomes: { preview: 'measured', browserPaint: 'not observed', nativeApex: 'not part of this pack' },
};
const text = JSON.stringify(report, null, 2) + '\n';
if (out) await writeFile(out, text);
process.stdout.write(text);
