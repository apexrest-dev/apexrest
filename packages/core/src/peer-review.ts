import { z } from 'zod';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import type { ProjectContext } from './config.ts';
import { deployPlanSchema, sourceInventory, type DeployPlan } from './deploy.ts';
import { canonical, contained, exists, hash, readJson, writeJson } from './fs.ts';
import { runProcess } from './process.ts';
import { Fault } from './result.ts';
import { planPreview } from './ship.ts';

/**
 * Cross-vendor peer review: the host agent (Claude Code or Codex) asks the
 * other vendor's CLI, signed in with the user's own subscription or API key,
 * for a read-only review of one saved ship plan. The verdict is bound to the
 * plan digest; the host alone applies. Without a plan (local-only work, no
 * Oracle target) it reviews the current sources; that advisory record is
 * bound to the source digest and never satisfies the apply gate. This is a workflow gate for a single
 * user, not a security boundary against the host agent.
 */
export const peerVendors = ['codex', 'claude'] as const;
export type PeerVendor = (typeof peerVendors)[number];
export type PeerReviewMode = 'off' | 'advisory' | 'required';

const severity = z.enum(['critical', 'major', 'minor', 'info']);
export const peerVerdictSchema = z.strictObject({
  verdict: z.enum(['approve', 'changes_requested']),
  summary: z.string().max(4000),
  findings: z
    .array(
      z.strictObject({
        severity,
        title: z.string().max(300),
        detail: z.string().max(4000),
        file: z.string().max(1024).nullable(),
        line: z.number().int().min(0).nullable(),
      }),
    )
    .max(50),
});
export type PeerVerdict = z.infer<typeof peerVerdictSchema>;
export const peerReviewRecordSchema = peerVerdictSchema.safeExtend({
  schemaVersion: z.literal(1),
  planDigest: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  planId: z.string().optional(),
  environment: z.string().optional(),
  sourceDigest: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  vendor: z.enum(peerVendors),
  cliVersion: z.string().max(200),
  reviewedAt: z.iso.datetime(),
  durationMs: z.number().int().min(0),
});
export type PeerReviewRecord = z.infer<typeof peerReviewRecordSchema>;

// Strict structured-output schema accepted by both `codex exec --output-schema`
// and `claude -p --json-schema`: every property required, no extras.
const verdictJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'summary', 'findings'],
  properties: {
    verdict: { type: 'string', enum: ['approve', 'changes_requested'] },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'title', 'detail', 'file', 'line'],
        properties: {
          severity: { type: 'string', enum: severity.options },
          title: { type: 'string' },
          detail: { type: 'string' },
          file: { type: ['string', 'null'] },
          line: { type: ['integer', 'null'] },
        },
      },
    },
  },
};

const executable = (vendor: PeerVendor) =>
  (vendor === 'codex' ? process.env.APEXREST_CODEX_BIN : process.env.APEXREST_CLAUDE_BIN) || vendor;

/** The host the MCP server runs in, from an explicit override or the host's own environment. */
export function hostAgent(env: NodeJS.ProcessEnv = process.env): PeerVendor | undefined {
  if (env.APEXREST_HOST === 'codex' || env.APEXREST_HOST === 'claude') return env.APEXREST_HOST;
  if (env.CLAUDECODE === '1' || env.CLAUDE_CODE_ENTRYPOINT) return 'claude';
  if (Object.keys(env).some((key) => key.startsWith('CODEX_') && key !== 'CODEX_HOME')) return 'codex';
  return undefined;
}

/** The peer is the other vendor: explicit input, then project setting, then the opposite of the host. */
export function resolvePeer(ctx: ProjectContext | undefined, requested?: PeerVendor): PeerVendor {
  if (requested) return requested;
  const configured = ctx?.config.peerReview?.vendor;
  if (configured && configured !== 'auto') return configured;
  const host = hostAgent();
  if (host) return host === 'claude' ? 'codex' : 'claude';
  throw new Fault(
    'PEER_VENDOR_REQUIRED',
    'The host agent is unknown. Pass vendor codex or claude, or set peerReview.vendor in apexrest.json.',
    2,
  );
}

// A nested Claude Code run must not inherit the host session's identity.
const hostSessionKeys = [
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_HOST_SESSION_ID',
  'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDE_CODE_SESSION_ATTENDED',
  'CLAUDE_CODE_MESSAGING_SOCKET',
  'CLAUDE_CODE_MESSAGING_TOKEN',
  'CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH',
  'CLAUDE_AGENT_SDK_VERSION',
  'CLAUDE_PID',
];
function peerEnv() {
  const env = { ...process.env };
  for (const key of hostSessionKeys) delete env[key];
  return env;
}

async function probe(vendor: PeerVendor, cwd: string) {
  const run = (args: string[]) =>
    runProcess({ executable: executable(vendor), args, cwd, env: peerEnv(), timeoutMs: 15000 }).catch(
      () => undefined,
    );
  const version = await run(['--version']);
  if (!version || version.code !== 0) return { available: false, signedIn: false } as const;
  const login = await run(vendor === 'codex' ? ['login', 'status'] : ['auth', 'status', '--json']);
  let signedIn = login?.code === 0,
    method: string | undefined;
  if (vendor === 'claude' && login?.code === 0) {
    try {
      const status = JSON.parse(login.stdout) as { loggedIn?: boolean; authMethod?: string };
      signedIn = status.loggedIn === true;
      method = status.authMethod;
    } catch {
      signedIn = false;
    }
  } else if (signedIn) method = (login!.stdout + login!.stderr).trim().split('\n')[0];
  return {
    available: true,
    version: version.stdout.trim().split('\n')[0]!.slice(0, 200),
    signedIn,
    ...(method ? { authMethod: method.slice(0, 200) } : {}),
  };
}

export async function peerStatus(ctx: ProjectContext | undefined) {
  const cwd = ctx?.root ?? process.cwd();
  const host = hostAgent();
  let peer: PeerVendor | undefined;
  try {
    peer = resolvePeer(ctx);
  } catch {
    peer = undefined;
  }
  const [codex, claude] = await Promise.all([probe('codex', cwd), probe('claude', cwd)]);
  return {
    host: host ?? 'unknown',
    peer: peer ?? 'unresolved',
    mode: ctx?.config.peerReview?.mode ?? 'off',
    vendors: { codex, claude },
    nextActions: [
      ...(peer && !{ codex, claude }[peer].available
        ? [`Install the ${peer} CLI and sign in, then rerun apexrest_peer_review action:status.`]
        : []),
      ...(peer && { codex, claude }[peer].available && !{ codex, claude }[peer].signedIn
        ? [peer === 'codex' ? 'Run: codex login' : 'Run: claude auth login']
        : []),
    ],
  };
}

const reviewPath = (digest: string) => '.apexrest/reviews/' + digest + '.json';
const sourceReviewPath = (digest: string) => '.apexrest/reviews/source-' + digest + '.json';

export async function readPeerReview(ctx: ProjectContext, digest: string) {
  const file = await contained(ctx.root, reviewPath(digest));
  if (!(await exists(file))) return undefined;
  const parsed = peerReviewRecordSchema.safeParse(await readJson(file).catch(() => undefined));
  return parsed.success && parsed.data.planDigest === digest ? parsed.data : undefined;
}

/** Bounded working-tree diff of the deployable sources; absent outside Git. */
async function sourceDiff(ctx: ProjectContext, signal?: AbortSignal) {
  const dirs = [
    ctx.config.application.sourceDir,
    ctx.config.database.migrationsDir,
    ctx.config.database.packagesDir,
  ];
  const result = await runProcess({
    executable: 'git',
    args: ['diff', '--no-color', '--no-ext-diff', 'HEAD', '--', ...dirs],
    cwd: ctx.root,
    timeoutMs: 15000,
    maxBytes: 200_000,
    ...(signal ? { signal } : {}),
  }).catch(() => undefined);
  if (!result || result.code !== 0) return undefined;
  const limit = 60_000;
  return result.stdout.length > limit
    ? result.stdout.slice(0, limit) + '\n[diff truncated; read the listed files directly]\n'
    : result.stdout;
}

export function peerPrompt(
  ctx: ProjectContext,
  subject: { plan: DeployPlan; planPath: string } | { sources: string[] },
  diff: string | undefined,
  focus?: string,
) {
  const planned = 'plan' in subject ? subject : undefined;
  const files = planned
    ? planned.plan.operations
        .map((o) => ('file' in o && typeof o.file === 'string' ? `${o.kind}: ${o.file}` : undefined))
        .filter(Boolean)
    : [];
  const listed = planned ? 'the files named in the plan' : 'the source files listed above';
  return [
    'You are the peer reviewer of an Oracle APEX change prepared by another coding agent.',
    'Review only; do not modify files, run deployments, or contact any database.',
    `Project root: ${ctx.root}. Application sources: ${ctx.config.application.sourceDir} (APEXlang .apx).`,
    planned
      ? `Saved deployment plan: ${planned.planPath} (digest ${planned.plan.digest}).`
      : 'Local-only change: there is no deployment plan or Oracle target yet. Review the sources as they would be imported.',
    '',
    'Check, in priority order:',
    '1. Correctness of the APEXlang change against the stated intent and the existing application.',
    '2. Security: authorization schemes, session state protection, escaping/XSS, SQL and PL/SQL injection, exposed data.',
    '3. Database migrations and packages: destructive or non-idempotent statements, data loss, missing grants.',
    planned
      ? '4. Plan risks and import scope below: anything broader than the change needs.'
      : '4. Consistency between pages, shared components and database objects they reference.',
    '5. Maintainability issues worth fixing now. Skip style nits.',
    'Approve when nothing critical or major remains. Request changes otherwise, with file and line where possible.',
    ...(focus ? ['', 'Requested focus: ' + focus] : []),
    '',
    ...(planned
      ? ['Plan preview (JSON):', JSON.stringify(planPreview(ctx, planned.plan), null, 2)]
      : ['Source files:', ...(subject as { sources: string[] }).sources.slice(0, 400)]),
    ...(files.length ? ['', 'Database operations:', ...files] : []),
    '',
    diff === undefined
      ? `No Git diff is available; read ${listed}.`
      : diff.trim()
        ? 'Working-tree diff of deployable sources against HEAD:\n' + diff
        : `The deployable sources match HEAD; review ${listed}.`,
    '',
    'Answer only with the JSON object required by the output schema.',
  ].join('\n');
}

function parseVerdict(text: string): PeerVerdict {
  const value = JSON.parse(text) as unknown;
  const parsed = peerVerdictSchema.safeParse(value);
  if (!parsed.success)
    throw new Fault(
      'PEER_OUTPUT_INVALID',
      'The peer reviewer returned output outside the verdict schema.',
      1,
    );
  return parsed.data;
}

async function runPeer(
  vendor: PeerVendor,
  ctx: ProjectContext,
  prompt: string,
  options: { model?: string | undefined; timeoutMs: number; signal?: AbortSignal | undefined },
) {
  const scratch = await contained(ctx.root, '.apexrest/reviews/run-' + randomUUID());
  await mkdir(scratch, { recursive: true });
  try {
    const schemaFile = path.join(scratch, 'verdict.schema.json');
    const lastFile = path.join(scratch, 'last-message.json');
    await writeJson(schemaFile, verdictJsonSchema);
    const args =
      vendor === 'codex'
        ? [
            'exec',
            '--sandbox',
            'read-only',
            '--ephemeral',
            '--skip-git-repo-check',
            '--color',
            'never',
            '-C',
            ctx.root,
            '--output-schema',
            schemaFile,
            '-o',
            lastFile,
            ...(options.model ? ['-m', options.model] : []),
            '-',
          ]
        : [
            '-p',
            '--output-format',
            'json',
            '--json-schema',
            JSON.stringify(verdictJsonSchema),
            '--tools',
            'Read,Grep,Glob',
            '--restricted',
            '--strict-mcp-config',
            '--no-session-persistence',
            '--permission-prompts',
            'none',
            ...(options.model ? ['--model', options.model] : []),
          ];
    const result = await runProcess({
      executable: executable(vendor),
      args,
      cwd: ctx.root,
      input: prompt,
      env: peerEnv(),
      timeoutMs: options.timeoutMs,
      maxBytes: 8 * 1024 * 1024,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (result.cancelled) throw new Fault('CANCELLED', 'Peer review cancelled.', 6, 'cancelled');
    if (result.timedOut)
      throw new Fault('PEER_TIMEOUT', `The ${vendor} reviewer did not finish within the timeout.`, 1);
    if (result.code !== 0)
      throw new Fault(
        'PEER_FAILED',
        `The ${vendor} reviewer exited with code ${result.code}: ${result.stderr.trim().slice(-600) || 'no diagnostics'}`,
        1,
      );
    if (vendor === 'codex') return parseVerdict(await readFile(lastFile, 'utf8'));
    const envelope = JSON.parse(result.stdout) as {
      is_error?: boolean;
      result?: string;
      structured_output?: unknown;
    };
    if (envelope.is_error)
      throw new Fault('PEER_FAILED', 'The claude reviewer reported an error: ' + (envelope.result ?? ''), 1);
    return envelope.structured_output !== undefined
      ? parseVerdict(JSON.stringify(envelope.structured_output))
      : parseVerdict(envelope.result ?? '');
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Fault('PEER_OUTPUT_INVALID', 'The peer reviewer returned no parseable verdict.', 1);
    if (error instanceof Fault && error.code === 'DEPENDENCY_MISSING')
      throw new Fault(
        'PEER_UNAVAILABLE',
        `The ${vendor} CLI is not installed or not on PATH.`,
        3,
        'dependency_missing',
      );
    throw error;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

export async function peerReview(
  ctx: ProjectContext,
  input: { plan?: string | undefined; vendor?: PeerVendor | undefined; focus?: string | undefined },
  signal?: AbortSignal,
) {
  const plan = input.plan
    ? deployPlanSchema.parse(await readJson(await contained(ctx.root, input.plan)))
    : undefined;
  if (plan && Date.parse(plan.expiresAt) <= Date.now())
    throw new Fault(
      'PLAN_EXPIRED',
      'The saved plan has expired; create a new plan before review.',
      4,
      'blocked',
    );
  const sources = plan ? undefined : await sourceInventory(ctx);
  if (sources && !Object.keys(sources).length)
    throw new Fault('INPUT_INVALID', 'The project has no application or database sources to review.', 2);
  const vendor = resolvePeer(ctx, input.vendor);
  const settings = ctx.config.peerReview;
  const started = performance.now();
  const verdict = await runPeer(
    vendor,
    ctx,
    peerPrompt(
      ctx,
      plan ? { plan, planPath: input.plan! } : { sources: Object.keys(sources!) },
      await sourceDiff(ctx, signal),
      input.focus,
    ),
    {
      model: settings?.model,
      timeoutMs: (settings?.timeoutSeconds ?? 600) * 1000,
      signal,
    },
  );
  const version = await runProcess({
    executable: executable(vendor),
    args: ['--version'],
    cwd: ctx.root,
    env: peerEnv(),
    timeoutMs: 15000,
  }).catch(() => undefined);
  const sourceDigest = sources ? hash(canonical(sources)) : undefined;
  const record: PeerReviewRecord = {
    schemaVersion: 1,
    ...(plan
      ? { planDigest: plan.digest, planId: plan.id, environment: plan.environment }
      : { sourceDigest: sourceDigest! }),
    vendor,
    cliVersion: version?.stdout.trim().split('\n')[0]?.slice(0, 200) ?? 'unknown',
    reviewedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    ...verdict,
  };
  const file = plan ? reviewPath(plan.digest) : sourceReviewPath(sourceDigest!);
  await writeJson(await contained(ctx.root, file), record);
  return {
    ...record,
    reviewPath: file,
    gate: ctx.config.peerReview?.mode ?? 'off',
    nextActions: !plan
      ? [
          record.verdict === 'approve'
            ? 'Source review approved. It is advisory: a deployment still needs apexrest_ship mode:plan and, when peerReview.mode is required, a review of that plan.'
            : 'Address the findings and rerun apexrest_peer_review on the updated sources. Report every finding to the user.',
        ]
      : record.verdict === 'approve'
        ? ['Apply this exact saved plan with apexrest_ship mode:apply plan:' + input.plan]
        : [
            'Address the findings, rerun apexrest_ship mode:plan, then review the new plan. Report every finding to the user.',
          ],
  };
}

/**
 * Apply-time gate. off: nothing. advisory: report the review state. required:
 * an approving review of this exact plan digest must exist before any grant.
 */
export async function peerReviewGate(ctx: ProjectContext, plan: DeployPlan) {
  const mode: PeerReviewMode = ctx.config.peerReview?.mode ?? 'off';
  if (mode === 'off') return undefined;
  const record = await readPeerReview(ctx, plan.digest);
  if (mode === 'required' && !record)
    throw new Fault(
      'PEER_REVIEW_REQUIRED',
      'peerReview.mode is required and this exact plan has no peer review.',
      4,
      'blocked',
      { planDigest: plan.digest },
    );
  if (mode === 'required' && record!.verdict !== 'approve')
    throw new Fault(
      'PEER_REVIEW_CHANGES_REQUESTED',
      `The ${record!.vendor} peer review requested changes to this plan: ${record!.summary.slice(0, 600)}`,
      4,
      'blocked',
      { planDigest: plan.digest },
    );
  return {
    mode,
    status: record ? record.verdict : 'missing',
    ...(record
      ? {
          vendor: record.vendor,
          reviewedAt: record.reviewedAt,
          findings: record.findings.length,
          blocking: record.findings.filter((f) => f.severity === 'critical' || f.severity === 'major').length,
        }
      : {}),
  };
}
