// Local preview over Oracle's public APEX 26.2 applications: every page of every application is
// rendered without a database, and the diagnostics are counted by kind. Run by
// scripts/preview-corpus.mjs; the scorecard measures how much of real applications the preview
// runs. It is a development check, not Oracle evidence.
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { checkApplication } from '../../packages/core/src/preview/server.ts';

interface Diagnostic {
  level: string;
  message: string;
}

const RULES: [string, (message: string) => boolean][] = [
  ['placeholders', (m) => m.includes('a placeholder is shown')],
  [
    'applicationCallsNotRun',
    (m) =>
      /is not simulated locally; (?:returned|skipped)/u.test(m) &&
      !/\b(?:apex_|htp|htmldb_|wwv_|owa_|dbms_|utl_|sys\.)/u.test(m),
  ],
  ['apiCallsNotRun', (m) => /is not simulated locally; (?:returned|skipped)/u.test(m)],
  ['seedFailures', (m) => m.startsWith('Seed script')],
  ['sqlFailures', (m) => /(?:SQL|query) failed|PL\/SQL failed|failed —/u.test(m)],
  ['authorizationDenied', (m) => m.includes('denies') && m.includes('allows access anyway')],
  ['autoCreatedTables', (m) => m.includes('did not exist; created it')],
  ['notEvaluated', (m) => m.includes('not evaluated')],
  ['otherNotSimulated', (m) => /not simulated|not shown|not available locally/u.test(m)],
];

function applications(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (existsSync(path.join(dir, 'application.apx'))) {
      found.push(dir);
      return;
    }
    if (depth > 5) return;
    for (const entry of readdirSync(dir, { withFileTypes: true }))
      if (entry.isDirectory() && entry.name !== 'node_modules') walk(path.join(dir, entry.name), depth + 1);
  };
  walk(root, 0);
  return found.sort();
}

export function scoreCorpus(root: string) {
  const totals: Record<string, number> = { pages: 0, pageErrors: 0, error: 0, warning: 0, info: 0 };
  for (const [name] of RULES) totals[name] = 0;
  const perApp: { app: string; pages: number; pageErrors: number; diagnostics: number; ms: number }[] = [];
  const samples: Record<string, string[]> = {};
  for (const app of applications(root)) {
    const started = Date.now();
    const result = checkApplication({ sourceDir: app, toolbar: false });
    const pageErrors = result.pages.filter((page) => page.error).length;
    totals.pages! += result.pages.length;
    totals.pageErrors! += pageErrors;
    for (const diagnostic of result.diagnostics as Diagnostic[]) {
      totals[diagnostic.level] = (totals[diagnostic.level] ?? 0) + 1;
      const rule = RULES.find(([, matches]) => matches(diagnostic.message));
      if (!rule) continue;
      totals[rule[0]]! += 1;
      const list = (samples[rule[0]] ??= []);
      if (list.length < 5) list.push(`${path.basename(app)}: ${diagnostic.message.slice(0, 200)}`);
    }
    perApp.push({
      app: path.basename(app),
      pages: result.pages.length,
      pageErrors,
      diagnostics: result.diagnostics.length,
      ms: Date.now() - started,
    });
  }
  return { totals, perApp, samples };
}

const [root, output] = process.argv.slice(2);
if (root) {
  const score = scoreCorpus(root);
  if (output) writeFileSync(output, JSON.stringify(score, null, 2) + '\n');
  console.log(JSON.stringify(score.totals, null, 2));
}
