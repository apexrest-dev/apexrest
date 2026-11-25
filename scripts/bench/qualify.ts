// Manually invoked, writes to an explicitly authorized target only:
//   node scripts/bench/run.mjs scripts/bench/qualify.ts --project <project> --env <DEV|QA|TEST env>
//     --authorized-target <same env> [--pairs 10] [--candidates d05-resident,d06-shared-reads,d07-export-profile]
//     [--scenarios one-page,several-pages,shared] [--export-profile FILE] [--out FILE]
//
// Paired qualification of the fast-development candidates (V13). Each pair ships the same declared
// edit through the baseline and the candidate arm with the public CLI (`apexrest ship --mode apply`),
// in the cohort the candidate concerns: cold CLI (a new process per ship), resident CLI (a running
// development broker) and warm MCP (one MCP server process). Every edit is reverted afterwards and
// shipped back. D07 compares per-page exports (no profile) with an explicitly supplied, measured
// export profile (--export-profile, copied to .apexrest/export-profiles/ for the candidate arm).
// The warm MCP cohort and the D02 intent path need a host MCP session and are not automated here;
// the report lists them as not run. The report keeps every failure, retry, conflict and unknown outcome and decides per
// candidate (scripts/bench/lib/qualification.ts). Production-marked environments are refused, and
// nothing runs unless --authorized-target names the same environment as --env.
import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadProject } from '../../packages/core/src/config.ts';
import { decide, type Cohort, type RunRecord } from './lib/qualification.ts';

const argument = (name: string) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const project = argument('--project');
const env = argument('--env');
if (!project || !env) throw new Error('Pass --project and --env.');
if (argument('--authorized-target') !== env)
  throw new Error(
    'Qualification ships to the target: pass --authorized-target with the same environment name.',
  );
const ctx = await loadProject(project);
const environment = ctx.config.environments[env];
if (!environment) throw new Error(`Unknown environment ${env}.`);
if (!['dev', 'qa', 'test'].includes(String(environment.kind ?? '').toLowerCase()))
  throw new Error('Qualification runs only on a DEV, QA or TEST environment.');
const pairs = Number(argument('--pairs') ?? 10);
const candidates = (argument('--candidates') ?? 'd05-resident,d06-shared-reads,d07-export-profile').split(
  ',',
);
const scenarios = (argument('--scenarios') ?? 'one-page,several-pages,shared').split(',');
const out = argument('--out');
const runtime = path.resolve('plugins/apexrest-apex/runtime/apexrest.mjs');
const app = path.join(ctx.root, ctx.config.application.sourceDir);

/** The arms of each candidate: environment switches and the cohort they run in. */
const arms: Record<
  string,
  Record<'baseline' | 'candidate', { cohort: Cohort; env: Record<string, string> }>
> = {
  'd05-resident': {
    baseline: { cohort: 'cold-cli', env: {} },
    candidate: { cohort: 'resident-cli', env: {} },
  },
  'd06-shared-reads': {
    baseline: { cohort: 'resident-cli', env: {} },
    candidate: { cohort: 'resident-cli', env: { APEXREST_SHIP_SHARED_READS: '1' } },
  },
  'd07-export-profile': {
    baseline: { cohort: 'resident-cli', env: {} },
    candidate: { cohort: 'resident-cli', env: {} },
  },
};

/** The declared edits of a scenario: a name marker on one or three pages, or one shared LOV. */
async function edit(scenario: string, marker: string) {
  const { readdir } = await import('node:fs/promises');
  const pages = (await readdir(path.join(app, 'pages')))
    .filter((file) => /^p\d{5}.*\.apx$/u.test(file) && !file.startsWith('p00000'))
    .map((file) => path.join('pages', file));
  const files =
    scenario === 'shared'
      ? (await readdir(path.join(app, 'shared-components/lovs')))
          .slice(0, 1)
          .map((file) => path.join('shared-components/lovs', file))
      : pages.slice(0, scenario === 'several-pages' ? 3 : 1);
  const restored: [string, string][] = [];
  for (const relative of files) {
    const file = path.join(app, relative);
    const original = await readFile(file, 'utf8');
    restored.push([file, original]);
    await writeFile(file, original.replace(/^(\s{4}name:\s*)(.+)$/mu, `$1$2 ${marker}`));
  }
  return async () => {
    for (const [file, original] of restored) await writeFile(file, original);
  };
}
/** D07: the candidate arm plans with the supplied measured profile, the baseline without one. */
async function exportProfile(arm: 'baseline' | 'candidate') {
  const { mkdir, rm, copyFile } = await import('node:fs/promises');
  const { targetDigest } = await import('../../packages/core/src/config.ts');
  const target = path.join(ctx.root, '.apexrest/export-profiles', `${targetDigest(environment!)}.json`);
  await rm(target, { force: true });
  if (arm === 'candidate') {
    const supplied = argument('--export-profile');
    if (!supplied) throw new Error('d07-export-profile needs --export-profile with a measured profile.');
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(supplied, target);
  }
}
function ship(extraEnv: Record<string, string>) {
  const started = Date.now();
  const result = spawnSync(
    process.execPath,
    [
      runtime,
      'ship',
      '--project',
      ctx.root,
      '--env',
      env!,
      '--mode',
      'apply',
      '--user-request',
      'Qualification ship to the authorized test target',
      '--json',
    ],
    { encoding: 'utf8', env: { ...process.env, ...extraEnv }, maxBuffer: 64 * 1024 * 1024 },
  );
  const parsed = JSON.parse(result.stdout.trim().split('\n').at(-1) || '{}') as Record<string, unknown>;
  return { parsed, wallMs: Date.now() - started };
}
function record(
  candidate: string,
  arm: 'baseline' | 'candidate',
  cohort: Cohort,
  scenario: string,
  warm: boolean,
  shipped: ReturnType<typeof ship>,
): RunRecord {
  const data = (shipped.parsed.data ?? {}) as Record<string, any>;
  const status = String(shipped.parsed.status ?? 'failed');
  const outcome: RunRecord['outcome'] = shipped.parsed.ok
    ? 'succeeded'
    : status === 'outcome_unknown'
      ? 'outcome_unknown'
      : status === 'conflict'
        ? 'conflict'
        : status === 'superseded'
          ? 'superseded'
          : 'failed';
  const spans = (data.operations?.spans ?? []) as { name: string; startMs: number; endMs: number | null }[];
  const phases = Object.fromEntries(
    spans.filter((span) => span.endMs !== null).map((span) => [span.name, span.endMs! - span.startMs]),
  );
  return {
    candidate,
    arm,
    cohort,
    scenario,
    identity: {
      transport: String(data.details?.sqlclTimings?.[0]?.transport ?? 'unknown'),
      residency: cohort === 'cold-cli' ? 'cold' : cohort === 'warm-mcp' ? 'warm' : 'resident',
      compiler: String(data.plan?.compiler ?? 'unknown'),
      mmdVersion: 'see plan',
      target: String(data.planDigest ? 'plan-bound' : 'unknown'),
      applicationFiles: 0,
    },
    warm,
    outcome,
    totalMs: shipped.parsed.ok ? shipped.wallMs : null,
    phases,
    sqlclInvocations: Array.isArray(data.details?.sqlclTimings) ? data.details.sqlclTimings.length : 0,
    observation: data.plan?.importSelection?.observation?.strategy ?? null,
    safeguards: spans
      .map((span) => span.name)
      .filter((name) => ['prewriteObservation', 'targetObservation', 'readback', 'backup'].includes(name)),
  };
}

const records: RunRecord[] = [];
let broker: ReturnType<typeof spawn> | undefined;
try {
  for (const candidate of candidates) {
    for (const scenario of scenarios)
      for (let pair = 0; pair < pairs; pair++)
        for (const arm of ['baseline', 'candidate'] as const) {
          const { cohort, env: armEnv } = arms[candidate]![arm];
          if (cohort === 'resident-cli' && !broker) {
            broker = spawn(process.execPath, [runtime, '--broker', ctx.root], { stdio: 'ignore' });
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
          if (candidate === 'd07-export-profile') await exportProfile(arm);
          const revert = await edit(scenario, `Q${Date.now().toString(36)}`);
          const shipped = ship(armEnv);
          records.push(record(candidate, arm, cohort, scenario, pair > 0, shipped));
          await revert();
          ship(armEnv); // ship the reverted source back; not measured
        }
  }
} finally {
  broker?.kill();
}
const report = {
  kind: 'manually invoked paired qualification on an authorized non-production target',
  date: new Date().toISOString(),
  environment: env,
  pairs,
  records,
  decisions: candidates.map((candidate) => decide(candidate, records)),
  notRun: ['warm-mcp cohort and the D02 intent path (need a host MCP session)'],
  limitations:
    'No production target; no browser or application test suite. Decisions are scoped to this target and dataset.',
};
const text = JSON.stringify(report, null, 2) + '\n';
if (out) await writeFile(out, text);
process.stdout.write(text);
