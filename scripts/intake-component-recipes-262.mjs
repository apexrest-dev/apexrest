// Intake of a bounded APEX 26.2 component recipe set from Oracle's Universal Theme 26.2 Reference
// application (oracle/apex, sample-apps/universal-theme-reference, UPL-1.0).
//
//   node scripts/intake-component-recipes-262.mjs --source=<checkout of oracle/apex at COMMIT> --scaffold=<26.2 app>
//
// Each recipe is one region block copied verbatim from an upstream page, with only the listed
// adaptations: it moves to page level (`slot: body`) of page 1 of the scaffold, and a query reading
// the reference app's demo tables is replaced by self-contained synthetic SQL that projects the same
// columns. Provenance records the pinned commit, path, upstream file SHA-256 and the derivation.
// Compiler qualification is separate: run scripts/verify-component-recipes.mjs --catalog=resources/components-26.2.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const COMMIT = 'fbe095e4c6e783b3fa930ffae927e4826e549190';
const REPOSITORY = 'https://github.com/oracle/apex';
const APP = 'sample-apps/universal-theme-reference/apexlang/ut';
const catalog = path.resolve('resources/components-26.2');
const argument = (name) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = argument('source');
const scaffold = argument('scaffold');
if (!source || !scaffold)
  throw new Error('Pass --source=<oracle/apex checkout> and --scaffold=<26.2 application>.');
const sha = (value) => createHash('sha256').update(value).digest('hex');

const TASKS = `select 'Design review' as task_name, date '2026-01-05' as start_date, 'Open' as status, 'Ada' as assigned_to from dual
union all select 'Ship release', date '2026-02-10', 'Closed', 'Grace' from dual
union all select 'Write guide', date '2026-03-02', 'Pending', 'Linus' from dual`;
const CARDS = `select 1 as id, 'badge' as category, 'Customer onboarding' as title, 'Team A' as subtitle,
       'Welcome pack and first call.' as body, 'Due this week' as secondary_body, 'fa-user' as icon_class,
       'badge' as badge, null as image, '5 January 2026 9:00 AM' as start_date, '10:00 AM' as end_date
  from dual
union all
select 2, 'badge', 'Quarterly review', 'Team B', 'Revenue and pipeline.', 'Next month', 'fa-line-chart',
       'badge', null, '2 February 2026 2:00 PM', '3:00 PM'
  from dual`;

const RECIPES = [
  {
    id: 'regions-content-block-basic',
    componentId: 'component:regions/content-block',
    title: 'Content Block Region',
    family: 'regions',
    page: 'p01201-standard-region.apx',
    region: 'demo',
  },
  {
    id: 'regions-alert-basic',
    componentId: 'component:regions/alert',
    title: 'Alert Region',
    family: 'regions',
    page: 'p01202-alert-region.apx',
    region: 'alert-region',
  },
  {
    id: 'reports-classic-basic',
    componentId: 'component:reports/classic-report',
    title: 'Classic Report',
    family: 'reports',
    page: 'p01401-standard-reports.apx',
    region: 'demo',
    sql: TASKS,
    sqlColumns: ['TASK_NAME', 'START_DATE', 'STATUS', 'ASSIGNED_TO'],
  },
  {
    id: 'reports-interactive-basic',
    componentId: 'component:reports/interactive-report',
    title: 'Interactive Report',
    family: 'reports',
    page: 'p01402-interactive-report.apx',
    region: 'simple-interactive-report',
    sql: TASKS,
    sqlColumns: ['TASK_NAME', 'START_DATE', 'STATUS', 'ASSIGNED_TO'],
  },
  {
    id: 'regions-cards-badges',
    componentId: 'component:regions/cards',
    title: 'Cards Region with Badges',
    family: 'regions',
    page: 'p03110-card-regions.apx',
    region: 'badges-cards',
    sql: CARDS,
    sqlColumns: ['ID', 'TITLE', 'SUBTITLE', 'BODY', 'SECONDARY_BODY', 'ICON_CLASS', 'BADGE'],
  },
  {
    id: 'charts-bar-basic',
    componentId: 'component:regions/chart',
    title: 'Bar Chart',
    family: 'regions',
    page: 'p01902-charts.apx',
    region: '1-bar',
  },
];

/** The lines of `region <id> (` … `)` at page level of an upstream page. */
function regionBlock(text, id) {
  const lines = text.split('\n');
  const start = lines.indexOf(`    region ${id} (`);
  if (start < 0) throw new Error(`No region ${id}.`);
  const end = lines.findIndex((line, index) => index > start && line === '    )');
  return lines.slice(start, end + 1);
}
/** Page level and synthetic SQL: the only adaptations; everything else keeps its upstream bytes. */
function adapt(lines, recipe, derivation) {
  const out = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (/^ {12}parentRegion: @/u.test(line)) {
      derivation.push('Moved from its upstream parent region to page level.');
      continue;
    }
    if (/^ {12}slot: subRegions$/u.test(line)) {
      out.push(line.replace('subRegions', 'body'));
      continue;
    }
    if (recipe.sql && /^ {12}sqlQuery:$/u.test(line) && /^ {16}```sql$/u.test(lines[index + 1] ?? '')) {
      out.push(line, lines[index + 1]);
      let close = index + 2;
      while (!/^ {16}```$/u.test(lines[close])) close++;
      out.push(...recipe.sql.split('\n').map((sqlLine) => ' '.repeat(16) + sqlLine), lines[close]);
      derivation.push(
        'Replaced the query on reference-app demo tables with self-contained synthetic SQL projecting the same columns.',
      );
      index = close;
      continue;
    }
    out.push(line);
  }
  return out;
}

const home = await readFile(path.join(scaffold, 'pages/p00001-home.apx'), 'utf8');
if (!home.trimEnd().endsWith(')')) throw new Error('Unexpected scaffold home page.');
const mmd = JSON.parse(await readFile(path.join(scaffold, '.apex/apexlang.json'), 'utf8'));
if (!/^26\.2\./u.test(mmd.mmdVersion)) throw new Error('The scaffold must be a 26.2 application.');
await rm(path.join(catalog, 'recipes'), { recursive: true, force: true });
await mkdir(path.join(catalog, 'recipes'), { recursive: true });
await cp(scaffold, path.join(catalog, 'recipes/_scaffold'), { recursive: true });
const license = await readFile(path.join(source, 'LICENSE.txt'), 'utf8');
if (!/Universal Permissive License \(UPL\), Version 1\.0/u.test(license))
  throw new Error('Unexpected upstream license.');
await writeFile(path.join(catalog, 'LICENSE.txt'), license);
const recipes = [];
for (const recipe of RECIPES) {
  const upstream = `${APP}/pages/${recipe.page}`;
  const text = await readFile(path.join(source, upstream), 'utf8');
  const derivation = [];
  const block = adapt(regionBlock(text, recipe.region), recipe, derivation);
  const body = home.trimEnd().slice(0, -1).trimEnd() + '\n\n' + block.join('\n') + '\n\n)\n';
  const directory = `recipes/${recipe.id}`;
  await mkdir(path.join(catalog, directory, 'pages'), { recursive: true });
  await writeFile(path.join(catalog, directory, 'pages/p00001-home.apx'), body);
  recipes.push({
    id: `${recipe.componentId}/recipes/${recipe.id}`,
    componentId: recipe.componentId,
    title: recipe.title,
    aliases: [recipe.title],
    family: recipe.family,
    sourcePageIds: [],
    description: `${recipe.title} from the Universal Theme 26.2 Reference application.`,
    directory,
    files: ['pages/p00001-home.apx'],
    requires: [],
    dataContract: {
      source: recipe.sql ? 'synthetic' : 'static',
      tables: [],
      bindings: [],
      submittedItems: [],
      ...(recipe.sqlColumns ? { columns: recipe.sqlColumns } : {}),
    },
    adaptation: [
      'Choose a free page number and keep the region id unique on the target page.',
      'Preserve the target application authentication and authorization.',
      'Replace the synthetic query with authorized project SQL that projects the same column names and types.',
    ],
    provenance: {
      sourceUrl: `${REPOSITORY}/blob/${COMMIT}/${upstream}`,
      repository: REPOSITORY,
      commit: COMMIT,
      path: upstream,
      sourceSha256: sha(text),
      license: 'UPL-1.0',
      derivation: [...new Set(derivation)].join(' ') || 'Region block copied unchanged.',
    },
    readiness: 'unresolved',
    reason: 'Compiler qualification has not run.',
    verification: { compiler: { status: 'not-run' }, sql: 'not-run', import: 'not-run', browser: 'not-run' },
  });
}
const registry = {
  schemaVersion: 1,
  apexVersion: '26.2',
  mmdVersion: mmd.mmdVersion,
  compilerVersion: 'SQLcl: Release 26.3.0.0 Production Build: 26.3.0.260.1620',
  scaffold: {
    directory: 'recipes/_scaffold',
    source: 'apexrest project init --template blank-app (26.2 profile)',
    scope:
      'Compilation fixture only; never replace an existing application authentication with this scaffold.',
  },
  upstream: { repository: REPOSITORY, branch: '26.2', commit: COMMIT, path: APP, license: 'UPL-1.0' },
  recipes,
};
await writeFile(path.join(catalog, 'recipes/registry.json'), JSON.stringify(registry, null, 2) + '\n');
console.log(`Wrote ${recipes.length} recipes to ${path.relative(process.cwd(), catalog)}.`);
