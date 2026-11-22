// APE-385 qualification probe: SQLcl `apex export` versus documented
// APEX_EXPORT.GET_APPLICATION(p_type => 'APEXLANG') on the same target and scope.
// Read-only: it exports an application and compares the files; nothing is imported or written to
// the database. Explicitly invoked on an authorized DEV/QA/TEST connection.
// Usage: node scripts/bench/export-direct.mjs --connection NAME --app ID --page N
//        [--shared TYPE:ID] [--reps 5] [--out FILE]
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const name = args.get('connection');
const app = Number(args.get('app'));
const page = Number(args.get('page'));
const shared = args.get('shared');
const reps = Number(args.get('reps') ?? 5);
if (!name || !app || !page) throw new Error('--connection, --app and --page are required');
if (shared && !/^[A-Z_]+:\d+$/.test(shared)) throw new Error('--shared is TYPE:ID');

const sql = (body) => {
  const started = performance.now();
  const run = spawnSync('sql', ['-S', '/nolog'], {
    input: `conn -name ${name}\nset feedback off heading off pagesize 0 long 20000000 longchunksize 32767 linesize 32767 trimspool on serveroutput on size unlimited\n${body}\nexit\n`,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  return {
    code: run.status,
    out: run.stdout.replace(/\u001b\[[0-9;]*m/g, ''),
    ms: performance.now() - started,
  };
};
const components = (list) =>
  list.length ? `apex_t_varchar2(${list.map((c) => `'${c}'`).join(',')})` : 'null';
const direct = (list) =>
  `select '@@FILE '||name||chr(10)||contents||chr(10)||'@@END' from table(apex_export.get_application(p_application_id=>${app},p_type=>'APEXLANG',p_components=>${components(list)},p_with_original_ids=>true,p_with_date=>false));`;
const sqlcl = (dir, list) =>
  `apex export -applicationid ${app} -exptype APEXLANG -skipExportDate -expOriginalIds -dir ${dir}${list.length ? ` -expComponents ${list[0]}` : ''}`;
const mark = (tag) =>
  `select '@@T ${tag} '||to_char(extract(second from systimestamp)+60*extract(minute from systimestamp)+3600*extract(hour from systimestamp),'FM99999.000') from dual;`;
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

function parseDirect(out) {
  const files = {};
  for (const match of out.matchAll(/@@FILE (.+)\n([\s\S]*?)\n@@END/g)) files[match[1].trim()] = match[2];
  return files;
}
function readTree(root) {
  const files = {};
  const visit = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) visit(full);
      else files[path.relative(root, full).split(path.sep).join('/')] = readFileSync(full, 'utf8');
    }
  };
  visit(root);
  return files;
}
// SQLcl writes <dir>/<alias>/...; the direct API names files relative to the application root.
function sqlclFiles(dir) {
  const tree = readTree(dir);
  const roots = new Set(Object.keys(tree).map((file) => file.split('/')[0]));
  if (roots.size !== 1) return tree;
  const [root] = roots;
  return Object.fromEntries(Object.entries(tree).map(([file, text]) => [file.slice(root.length + 1), text]));
}
// Canonical form for comparison only: line endings and trailing whitespace.
const canonical = (text) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trimEnd();
function compare(a, b) {
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const onlyA = names.filter((n) => !(n in b));
  const onlyB = names.filter((n) => !(n in a));
  const both = names.filter((n) => n in a && n in b);
  const byteDiff = both.filter((n) => a[n] !== b[n]);
  const canonicalDiff = both.filter((n) => canonical(a[n]) !== canonical(b[n]));
  return {
    files: [Object.keys(a).length, Object.keys(b).length],
    onlySqlcl: onlyA,
    onlyDirect: onlyB,
    byteEqual: !onlyA.length && !onlyB.length && !byteDiff.length,
    canonicalEqual: !onlyA.length && !onlyB.length && !canonicalDiff.length,
    byteDifferent: byteDiff,
    canonicalDifferent: canonicalDiff,
    digests: {
      sqlcl: hash(JSON.stringify(Object.entries(a).sort())),
      direct: hash(JSON.stringify(Object.entries(b).sort())),
    },
  };
}
const median = (values) =>
  values.length ? [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)] : null;
const round = (v) => (v == null ? null : Math.round(v));

const work = mkdtempSync(path.join(tmpdir(), 'apexrest-export-bench-'));
const scopes = [
  { label: `page ${page}`, list: [`PAGE:${page}`] },
  ...(shared ? [{ label: shared, list: [shared] }] : []),
  { label: 'full application', list: [] },
];
const results = { scopes: [] };
try {
  for (const scope of scopes) {
    const cold = { sqlcl: [], direct: [] };
    let sqlclOut = {};
    let directOut = {};
    const errors = {};
    // Cold: one fresh SQLcl process per export (startup + connect + export + transfer).
    for (let i = 0; i < reps; i++)
      for (const mode of i % 2 ? ['direct', 'sqlcl'] : ['sqlcl', 'direct']) {
        if (mode === 'sqlcl') {
          const dir = mkdtempSync(path.join(work, 'sqlcl-'));
          const run = sql(sqlcl(dir, scope.list));
          if (run.code !== 0 || /ORA-\d/.test(run.out)) {
            errors.sqlcl = (/ORA-\d+[^\n]*/.exec(run.out) ?? [run.out.slice(0, 200)])[0];
            continue;
          }
          cold.sqlcl.push(run.ms);
          sqlclOut = sqlclFiles(dir);
        } else {
          const run = sql(direct(scope.list));
          if (run.code !== 0 || /ORA-\d/.test(run.out)) {
            errors.direct = (/ORA-\d+[^\n]*/.exec(run.out) ?? [run.out.slice(0, 200)])[0];
            continue;
          }
          cold.direct.push(run.ms);
          directOut = parseDirect(run.out);
        }
      }
    if (errors.sqlcl || errors.direct) {
      results.scopes.push({ scope: scope.label, components: scope.list, unsupported: errors });
      console.log(JSON.stringify(results.scopes.at(-1)));
      continue;
    }
    // Warm: one SQLcl process, several exports; server-side time between systimestamp marks.
    const dirs = Array.from({ length: reps }, () => mkdtempSync(path.join(work, 'warm-')));
    const body = dirs
      .map(
        (dir, i) =>
          `${mark(`s${i}a`)}\n${sqlcl(dir, scope.list)}\n${mark(`s${i}b`)}\n${mark(`d${i}a`)}\n${direct(scope.list)}\n${mark(`d${i}b`)}`,
      )
      .join('\n');
    const warmRun = sql(body);
    const marks = Object.fromEntries(
      [...warmRun.out.matchAll(/@@T (\S+) ([\d.]+)/g)].map((m) => [m[1], Number(m[2]) * 1000]),
    );
    const warm = { sqlcl: [], direct: [] };
    for (let i = 0; i < reps; i++) {
      if (marks[`s${i}a`] != null && marks[`s${i}b`] != null)
        warm.sqlcl.push(marks[`s${i}b`] - marks[`s${i}a`]);
      if (marks[`d${i}a`] != null && marks[`d${i}b`] != null)
        warm.direct.push(marks[`d${i}b`] - marks[`d${i}a`]);
    }
    results.scopes.push({
      scope: scope.label,
      components: scope.list.length ? scope.list : 'all',
      coldMedianMs: { sqlcl: round(median(cold.sqlcl)), direct: round(median(cold.direct)) },
      warmMedianMs: { sqlcl: round(median(warm.sqlcl)), direct: round(median(warm.direct)) },
      samples: { cold: cold.sqlcl.length, warm: warm.sqlcl.length },
      comparison: compare(sqlclOut, directOut),
    });
    console.log(JSON.stringify(results.scopes.at(-1)));
  }
  // Component-list selection: both interfaces accept one APEXlang component per call in APEX 26.2.
  const list = sql(direct([`PAGE:${page}`, 'PAGE:1']));
  results.componentList = { direct: (/ORA-\d+[^\n]*/.exec(list.out) ?? ['accepted'])[0] };
  const listSqlcl = sql(
    `apex export -applicationid ${app} -exptype APEXLANG -skipExportDate -expOriginalIds -dir ${work} -expComponents "PAGE:${page} PAGE:1"`,
  );
  results.componentList.sqlcl = (/ORA-\d+[^\n]*/.exec(listSqlcl.out) ?? ['accepted'])[0];
  const version = sql(
    `select 'APEX='||version_no from apex_release;\nselect 'DB='||version_full from product_component_version where rownum = 1;`,
  ).out;
  results.apex = (/APEX=(\S+)/.exec(version) ?? [])[1];
  results.database = (/DB=(\S+)/.exec(version) ?? [])[1];
  results.sqlcl = spawnSync('sql', ['-V'], { encoding: 'utf8' }).stdout.trim();
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(
  JSON.stringify({ componentList: results.componentList, apex: results.apex, sqlcl: results.sqlcl }),
);
if (args.get('out'))
  writeFileSync(
    args.get('out'),
    JSON.stringify({ at: new Date().toISOString(), connection: name, app, reps, ...results }, null, 2) + '\n',
  );
