import path from 'node:path';
import { contained, writeJson } from './fs.ts';
import {
  environment,
  isProductionTarget,
  parse,
  updatePolicy,
  type PolicyGrant,
  type ProjectContext,
} from './config.ts';
import {
  DeploymentService,
  deployPlanSchema,
  type DeployPlan,
  type DeployState,
  type DeploymentPlanOptions,
} from './deploy.ts';
import type { OracleAdapter } from './oracle.ts';
import type { JobPhase } from './jobs.ts';
import { Fault, type StructuredDiagnostic } from './result.ts';
import { auditUpgradeSource } from './upgrade-audit.ts';

// apexrest_ship: validate -> plan -> (apply) record a plan-bound grant -> deploy
// -> verify -> remove the grant. The grant records the user's literal request
// for one reviewed plan; it never widens to other plans, targets or operations.

export type DiagnosticParser = (output: string) => StructuredDiagnostic[];
export interface ShipPhase {
  phase: JobPhase;
  ms: number;
}
const compilerFaults = new Set(['ORACLE_COMMAND_FAILED', 'VALIDATION_UNCONFIRMED', 'VALIDATION_FAILED']);

/**
 * Fallback parser used until the Oracle adapter exports parseCompilerDiagnostics.
 * It keeps one entry per error/warning line and extracts file/line/column
 * when the line carries them; unknown layouts still yield the raw message.
 */
export function fallbackCompilerDiagnostics(output: string): StructuredDiagnostic[] {
  const entries: StructuredDiagnostic[] = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (!line || !/\b(?:error|warning|ORA-\d+|PLS-\d+)\b/i.test(line)) continue;
    if (/^\d+\s+(?:errors?|warnings?)\b|validation (?:failed|completed)/i.test(line)) continue;
    const entry: StructuredDiagnostic = {
      severity: /\bwarning\b/i.test(line) && !/\berror\b/i.test(line) ? 'warning' : 'error',
      message: line.slice(0, 2000),
    };
    const file = /([\w./-]+\.apx)\b/.exec(line)?.[1];
    if (file) entry.file = file;
    const position = /(?:line\s+(\d+)(?:[,\s]+col(?:umn)?\s+(\d+))?)|\.apx:(\d+)(?::(\d+))?/i.exec(line);
    if (position) {
      const l = position[1] ?? position[3],
        c = position[2] ?? position[4];
      if (l) entry.line = Number(l);
      if (c) entry.column = Number(c);
    }
    entries.push(entry);
  }
  return entries;
}

/** Convert a raw compiler failure into VALIDATION_FAILED with structured diagnostics. */
export function compilerFault(error: unknown, parseDiagnostics: DiagnosticParser): unknown {
  if (!(error instanceof Fault) || !compilerFaults.has(error.code)) return error;
  const recorded = Array.isArray(error.details?.diagnostics) ? error.details.diagnostics : [];
  const diagnostics = recorded.length ? recorded : parseDiagnostics(error.message);
  const errors = diagnostics.filter((d) => (d.severity ?? 'error') === 'error').length;
  return new Fault(
    'VALIDATION_FAILED',
    diagnostics.length
      ? `Oracle compiler reported ${errors} error(s) and ${diagnostics.length - errors} warning(s).`
      : error.message.slice(0, 2000),
    1,
    'failed',
    {
      ...error.details,
      diagnostics: diagnostics.length ? diagnostics : [{ message: error.message.slice(0, 4000) }],
    },
  );
}

/** In-process compiler validation with structured diagnostics; no job, no database call. */
export async function validateApplication(
  oracle: OracleAdapter,
  source: string,
  parseDiagnostics: DiagnosticParser,
  signal?: AbortSignal,
) {
  const started = Date.now();
  let validated: Awaited<ReturnType<OracleAdapter['validate']>>;
  try {
    validated = await oracle.validate(source, signal);
  } catch (error) {
    throw compilerFault(error, parseDiagnostics);
  }
  const { output, mmd: _mmd, ...rest } = validated;
  const warnings = parseDiagnostics(output).filter((d) => d.severity === 'warning');
  const advisory = async <T>(action: () => Promise<T>) => {
    try {
      return await action();
    } catch (error) {
      if (signal?.aborted || (error instanceof Fault && error.code === 'CANCELLED')) throw error;
      return {
        status: 'unavailable' as const,
        findings: [],
        reason: error instanceof Error ? error.message : 'Advisory analysis did not complete.',
      };
    }
  };
  const [staticAnalysis, upgradeAudit] = await Promise.all([
    advisory(async () =>
      typeof oracle.codeScan === 'function'
        ? oracle.codeScan(source, signal)
        : {
            status: 'unavailable' as const,
            findings: [],
            reason: 'The selected adapter does not provide CodeScan.',
          },
    ),
    advisory(() => auditUpgradeSource(source)),
  ]);
  return {
    ...rest,
    diagnostics: warnings.slice(0, 50),
    warningCount: warnings.length,
    staticAnalysis,
    upgradeAudit,
    ms: Date.now() - started,
    output: output.length > 4000 ? output.slice(0, 4000) : output,
    outputTruncated: output.length > 4000,
  };
}

function sourceCounts(ctx: ProjectContext, plan: DeployPlan) {
  const under = (dir: string) => Object.keys(plan.sources).filter((f) => f.startsWith(dir + '/'));
  const application = under(ctx.config.application.sourceDir);
  const pages = application.filter((f) => /\/pages\/[^/]+\.apx$/.test(f));
  return {
    application: application.length,
    pages: pages.length,
    pageFiles: pages.slice(0, 50).map((f) => f.slice(ctx.config.application.sourceDir.length + 1)),
    migrations: plan.operations.filter((o) => o.kind === 'migration').length,
    packages: plan.operations.filter((o) => o.kind === 'package').length,
  };
}

/** Bounded plan preview for review; the full plan is the written file. */
export function planPreview(ctx: ProjectContext, plan: DeployPlan, options?: DeploymentPlanOptions) {
  const selection =
    plan.schemaVersion === 4
      ? plan.importSelection
      : {
          requestedMode: options?.importMode ?? 'full',
          resolvedMode: 'full' as const,
          files: [] as string[],
          dependencies: [] as string[],
          reasons: [
            (ctx.config.toolchain.profile ?? '26.1') === '26.1'
              ? 'apex-26.1-full-import'
              : 'legacy-full-application-plan',
          ],
        };
  return {
    planId: plan.id,
    planDigest: plan.digest,
    environment: plan.environment,
    targetDigest: plan.targetDigest,
    planMode: plan.schemaVersion === 1 ? 'full-export' : plan.mode,
    importSelection: {
      requestedMode: selection.requestedMode,
      resolvedMode: selection.resolvedMode,
      fileCount: selection.files.length,
      files: selection.files.slice(0, 50),
      filesTruncated: selection.files.length > 50,
      dependencies: selection.dependencies.slice(0, 50),
      dependencyCount: selection.dependencies.length,
      reasons: selection.reasons,
      ...(plan.schemaVersion === 4 && plan.importSelection.readbackPolicy
        ? { readbackPolicy: plan.importSelection.readbackPolicy }
        : {}),
    },
    backupRequired: plan.backupRequired,
    compiler: plan.compiler,
    createdAt: plan.createdAt,
    expiresAt: plan.expiresAt,
    risks: plan.risks,
    approval: plan.approval,
    sources: sourceCounts(ctx, plan),
    target: JSON.stringify(plan.target).length <= 1200 ? plan.target : { omitted: true },
  };
}

export function applicationLink(ctx: ProjectContext, name: string) {
  const env = environment(ctx, name);
  return {
    id: env.applicationId,
    alias: ctx.config.application.alias,
    workspace: env.workspace,
    url: new URL(`f?p=${env.applicationId}`, env.baseUrl).toString(),
  };
}

export async function shipPlan(
  ctx: ProjectContext,
  name: string,
  deployment: DeploymentService,
  parseDiagnostics: DiagnosticParser,
  progress?: (phase: JobPhase) => void,
  options: DeploymentPlanOptions = { importMode: 'auto' },
) {
  await reconcileShipGrants();
  const started = Date.now();
  progress?.('validating');
  let plan: DeployPlan;
  try {
    // Planning compiles the sources and reads the target in parallel; a
    // compiler failure is reported as structured validation diagnostics.
    plan = await deployment.plan(ctx, name, options);
  } catch (error) {
    throw compilerFault(error, parseDiagnostics);
  }
  const planPath = '.apexrest/plans/ship-' + plan.id + '.json';
  await writeJson(await contained(ctx.root, planPath), plan);
  const phases: ShipPhase[] = [{ phase: 'planning', ms: Date.now() - started }];
  return { plan, planPath, phases, preview: planPreview(ctx, plan, options) };
}

const phaseFor: Partial<Record<DeployState, JobPhase>> = {
  backing_up: 'backing_up',
  migrating: 'migrating',
  importing: 'importing',
  verifying: 'verifying',
};

export function shipGrant(ctx: ProjectContext, plan: DeployPlan, userRequest: string): PolicyGrant {
  return {
    projectRoot: ctx.root,
    targetDigest: plan.targetDigest,
    planDigest: plan.digest,
    expiresAt: new Date(Math.min(Date.parse(plan.expiresAt), Date.now() + 10 * 60 * 1000)).toISOString(),
    workerPid: process.pid,
    operations: ['deploy'],
    note: userRequest.slice(0, 2000),
    grantedBy: 'ship',
    grantedAt: new Date().toISOString(),
  };
}
/** Revoke expired grants and grants left behind by a dead worker. Legacy ship
 * grants have no worker identity and cannot safely authorize another attempt. */
export async function reconcileShipGrants() {
  await updatePolicy((p) => ({
    ...p,
    grants: p.grants.filter((g) => {
      if (g.grantedBy !== 'ship') return true;
      if (Date.parse(g.expiresAt) <= Date.now() || !g.workerPid) return false;
      try {
        process.kill(g.workerPid, 0);
        return true;
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'EPERM';
      }
    }),
  }));
}
const ownGrant = (ctx: ProjectContext, plan: DeployPlan) => (g: PolicyGrant) =>
  g.grantedBy === 'ship' && g.projectRoot === ctx.root && g.planDigest === plan.digest;

/** Refuse before any grant is written: production and unreviewed risks never get a runtime grant. */
export async function checkShipTarget(ctx: ProjectContext, plan: DeployPlan) {
  const env = environment(ctx, plan.environment);
  if (await isProductionTarget(env, plan.targetDigest))
    throw new Fault(
      'PRODUCTION_CI_REQUIRED',
      'Production requires a protected CI runner and externally signed approval bound to this plan.',
      4,
      'blocked',
    );
  if (plan.risks.some((r) => r !== 'application-restore'))
    throw new Fault(
      'RECOVERY_REVIEW_REQUIRED',
      'Destructive, authentication or unsupported changes need an explicit recovery implementation and reviewed external workflow.',
      4,
      'blocked',
      { nextActions: plan.risks.map((r) => 'Review risk: ' + r) },
    );
  return env;
}

export async function shipApply(
  ctx: ProjectContext,
  planValue: unknown,
  userRequest: string,
  deployment: DeploymentService,
  signal?: AbortSignal,
  progress?: (phase: JobPhase) => void,
) {
  const plan = parse(deployPlanSchema, planValue);
  await checkShipTarget(ctx, plan);
  await reconcileShipGrants();
  const phases: ShipPhase[] = [];
  let current: { phase: JobPhase; at: number } | undefined;
  const mark = (phase: JobPhase) => {
    if (current) phases.push({ phase: current.phase, ms: Date.now() - current.at });
    current = { phase, at: Date.now() };
    progress?.(phase);
  };
  const grant = shipGrant(ctx, plan, userRequest);
  await updatePolicy((p) => ({ ...p, grants: [...p.grants.filter((g) => !ownGrant(ctx, plan)(g)), grant] }));
  let grantRemoved = false;
  let applied: Awaited<ReturnType<DeploymentService['apply']>>;
  try {
    mark('backing_up');
    applied = await deployment.apply(ctx, plan, signal, (state) => {
      const phase = phaseFor[state];
      if (phase && phase !== current?.phase) mark(phase);
    });
  } finally {
    // The grant covers exactly one attempt. Removal failure is reported, never hidden.
    grantRemoved = await updatePolicy((p) => ({
      ...p,
      grants: p.grants.filter((g) => !ownGrant(ctx, plan)(g)),
    })).then(
      () => true,
      () => false,
    );
  }
  if (current) phases.push({ phase: current.phase, ms: Date.now() - current.at });
  return {
    status: 'succeeded',
    runId: applied.runId,
    planId: plan.id,
    planDigest: plan.digest,
    environment: plan.environment,
    application: applicationLink(ctx, plan.environment),
    sources: sourceCounts(ctx, plan),
    phases,
    verification: { identity: 'confirmed', state: applied.state, directory: applied.directory },
    browserVerification: { status: 'not_run', browser: 'host' },
    grant: { recorded: true, removed: grantRemoved, expiresAt: grant.expiresAt, planDigest: plan.digest },
    nextActions: grantRemoved
      ? ['Verify the affected pages in the selected browser with apexrest_browser_open.']
      : ['Remove the stale ship grant from APEXREST_HOME/policy.json before the next deployment.'],
  };
}

export function shipPlanPath(ctx: ProjectContext, relative: string) {
  return contained(ctx.root, path.normalize(relative));
}
