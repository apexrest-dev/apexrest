import path from 'node:path';
import { hostname } from 'node:os';
import { LocalDeploymentControl } from './deployment-control.ts';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { environment, refuseProductionDeployment, targetDigest, type ProjectContext } from './config.ts';
import { atomicWrite, canonical, contained, exists, hash, readJson } from './fs.ts';
import { Fault } from './result.ts';
import { sourceInventory, type DeploymentService } from './deploy.ts';
import { importOptions, sourceRelease, type ImportOptions } from './partial-import.ts';
import { sourceRevision } from './revision.ts';
import { shipApply, shipPlan, type DiagnosticParser } from './ship.ts';
import type { JobPhase } from './jobs.ts';

/**
 * Ship intents (`apexrest_ship mode:apply` without a saved plan). Queueing captures the source
 * revision, its inventory, the configured target, the import scope and the user's literal request
 * locally: no connection, export or compiler work. The job that runs the intent holds one exclusive
 * claim for preparation and apply. A captured intent deploys exactly its revision or nothing: when
 * the sources no longer match it, it is superseded before planning, and the plan's own source
 * digests (re-checked when the apply freezes them) must equal the captured ones. An intent is a
 * task scope, not a grant: the apply records its usual short plan-bound grant.
 */
export interface ShipIntent {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  env: string;
  targetDigest: string;
  revision: string;
  configuration: string;
  inventory: Record<string, string>;
  importMode: NonNullable<ImportOptions['importMode']>;
  files?: string[];
  /**
   * Files this intent changed relative to the previous intent of the same environment (absent for
   * the first one): the edits that coalescing must carry or report as overridden.
   */
  changedFiles?: string[];
  /** SQLcl selection and runtime version: a resident compiler of another toolchain is not reused. */
  toolchain?: string;
  /** Which client queued it (provenance only). */
  client?: 'cli' | 'mcp';
  userRequest: string;
  digest: string;
}

/** Identity of the compiler toolchain a preparation would use. */
export async function toolchainIdentity() {
  const { sqlclConfig } = await import('./sqlcl-config.ts');
  const { VERSION } = await import('./version.ts');
  return hash(
    canonical({
      sqlcl: await sqlclConfig(),
      executable: process.env.APEXREST_SQLCL ?? null,
      runtime: VERSION,
    }),
  );
}
export type IntentStatus =
  'queued' | 'preparing' | 'planned' | 'applying' | 'superseded' | 'succeeded' | 'failed' | 'outcome_unknown';

const intentPath = (ctx: ProjectContext, id: string) => contained(ctx.root, `.apexrest/intents/${id}.json`);
const statePath = (ctx: ProjectContext, id: string) =>
  contained(ctx.root, `.apexrest/intents/${id}.state.json`);

/** Configuration and source-level refusals that need no connection (same rules as planning). */
export async function checkShipRequest(ctx: ProjectContext, name: string, options: ImportOptions) {
  // Production is refused from configuration first; an unknown environment is reported after the
  // source-level checks, as planning does.
  const configured = Object.hasOwn(ctx.config.environments, name) ? ctx.config.environments[name] : undefined;
  if (configured) await refuseProductionDeployment(configured, name);
  const requested = importOptions(options);
  if (requested.importMode === 'files') {
    const release = await sourceRelease(await contained(ctx.root, ctx.config.application.sourceDir));
    if (release !== '26.2')
      throw new Fault(
        'PARTIAL_IMPORT_UNSUPPORTED',
        'File import requires an Oracle-exported 26.2 source tree.',
        3,
      );
  }
  return { env: environment(ctx, name), requested };
}

export async function captureShipIntent(
  ctx: ProjectContext,
  input: {
    env: string;
    userRequest: string;
    importMode?: ImportOptions['importMode'];
    files?: string[];
    client?: 'cli' | 'mcp';
  },
): Promise<ShipIntent> {
  const { env, requested } = await checkShipRequest(ctx, input.env, {
    importMode: input.importMode ?? 'auto',
    ...(input.files ? { files: input.files } : {}),
  });
  const inventory = await sourceInventory(ctx);
  const { revision, configuration } = sourceRevision(inventory, ctx.config);
  const previous = await latestIntent(ctx, input.env);
  const changedFiles = previous
    ? [...new Set([...Object.keys(previous.inventory), ...Object.keys(inventory)])]
        .filter((file) => previous.inventory[file] !== inventory[file])
        .sort()
    : undefined;
  const body = {
    schemaVersion: 1 as const,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    env: input.env,
    targetDigest: targetDigest(env),
    revision,
    configuration,
    inventory,
    importMode: requested.importMode,
    ...(input.files ? { files: [...input.files] } : {}),
    ...(changedFiles ? { changedFiles } : {}),
    toolchain: await toolchainIdentity(),
    ...(input.client ? { client: input.client } : {}),
    userRequest: input.userRequest,
  };
  const intent: ShipIntent = { ...body, digest: hash(canonical(body)) };
  await atomicWrite(await intentPath(ctx, intent.id), JSON.stringify(intent) + '\n');
  await setIntentStatus(ctx, intent.id, 'queued');
  return intent;
}

/** The most recently captured readable intent of an environment. */
async function latestIntent(ctx: ProjectContext, env: string): Promise<ShipIntent | undefined> {
  const dir = await contained(ctx.root, '.apexrest/intents');
  if (!(await exists(dir))) return undefined;
  let latest: ShipIntent | undefined;
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.json') || name.endsWith('.state.json')) continue;
    const intent = await readShipIntent(ctx, name.slice(0, -5)).catch(() => undefined);
    if (intent?.env === env && (!latest || intent.createdAt > latest.createdAt)) latest = intent;
  }
  return latest;
}

export async function readShipIntent(ctx: ProjectContext, id: string): Promise<ShipIntent> {
  const file = await intentPath(ctx, id);
  if (!(await exists(file))) throw new Fault('SHIP_INTENT_NOT_FOUND', `Ship intent ${id} does not exist.`, 2);
  const intent = JSON.parse(await readFile(file, 'utf8')) as ShipIntent;
  const { digest, ...body } = intent;
  if (intent.schemaVersion !== 1 || intent.id !== id || hash(canonical(body)) !== digest)
    throw new Fault('SHIP_INTENT_INVALID', `Ship intent ${id} was changed after it was captured.`, 5);
  return intent;
}

async function setIntentStatus(ctx: ProjectContext, id: string, status: IntentStatus, detail?: string) {
  await atomicWrite(
    await statePath(ctx, id),
    JSON.stringify({ id, status, ...(detail ? { detail } : {}), at: new Date().toISOString() }) + '\n',
  );
}
export async function shipIntentStatus(ctx: ProjectContext, id: string) {
  const file = await statePath(ctx, id);
  return (await exists(file))
    ? ((await readJson(file)) as { status: IntentStatus; detail?: string; at: string })
    : undefined;
}

const superseded = (intent: ShipIntent, detail: string) =>
  new Fault(
    'SHIP_INTENT_SUPERSEDED',
    `Ship intent ${intent.id} was not applied: ${detail} Ship again to deploy the current sources.`,
    5,
    'superseded',
    { intentId: intent.id, revision: intent.revision },
  );

/** Prepares (validate, plan) and applies one captured intent inside the job that claimed it. */
export async function runShipIntent(
  ctx: ProjectContext,
  id: string,
  deployment: DeploymentService,
  parseDiagnostics: DiagnosticParser,
  signal?: AbortSignal,
  progress?: (phase: JobPhase) => void,
) {
  const intent = await readShipIntent(ctx, id);
  const env = environment(ctx, intent.env);
  try {
    if (targetDigest(env) !== intent.targetDigest)
      throw superseded(intent, 'the configured target changed after it was queued.');
    if (intent.toolchain && intent.toolchain !== (await toolchainIdentity()))
      throw superseded(intent, 'the SQLcl toolchain or runtime changed after it was queued.');
    // The intent names its own bytes: different local sources are a newer revision, never this one.
    const current = await sourceInventory(ctx);
    const { revision, configuration } = sourceRevision(current, ctx.config);
    if (revision !== intent.revision || configuration !== intent.configuration)
      throw superseded(intent, 'the project sources changed after it was queued (a newer revision).');
    // Plan only against a confirmed checkpoint: after every earlier ship of this environment has
    // a known outcome. The fresh plan then binds the checkpoint that predecessor left.
    const predecessor = await awaitConfirmedPredecessor(ctx, intent, signal);
    await setIntentStatus(ctx, id, 'preparing');
    const planned = await shipPlan(ctx, intent.env, deployment, parseDiagnostics, progress, {
      importMode: intent.importMode,
      ...(intent.files ? { files: intent.files } : {}),
    });
    for (const [file, sha] of Object.entries(planned.plan.sources))
      if (intent.inventory[file] !== sha)
        throw superseded(intent, `${file} changed while it was being prepared.`);
    await setIntentStatus(ctx, id, 'planned');
    progress?.('planned');
    if (signal?.aborted) throw new Fault('CANCELLED', 'Ship intent cancelled before apply.', 6, 'cancelled');
    await setIntentStatus(ctx, id, 'applying');
    const applied = await shipApply(ctx, planned.plan, intent.userRequest, deployment, signal, progress);
    await setIntentStatus(ctx, id, 'succeeded');
    return {
      mode: 'apply',
      ...applied,
      planPath: planned.planPath,
      phases: [...planned.phases, ...applied.phases],
      intent: { id, revision: intent.revision, status: 'succeeded' as const, predecessor },
      plan: { planPath: planned.planPath, ...planned.preview },
    };
  } catch (error) {
    const status: IntentStatus =
      error instanceof Fault && error.code === 'SHIP_INTENT_SUPERSEDED'
        ? 'superseded'
        : error instanceof Fault && error.status === 'outcome_unknown'
          ? 'outcome_unknown'
          : 'failed';
    await setIntentStatus(ctx, id, status, error instanceof Fault ? error.code : undefined).catch(
      () => undefined,
    );
    throw error;
  }
}

/** How long an earlier intent in flight is waited for; a job never runs longer (jobs.ts). */
const IN_FLIGHT_MS = 900_000;

/**
 * Waits until no earlier ship of this environment is in flight: no live deployment owner and no
 * earlier intent preparing, planned or applying. An interrupted write (an owner left in its
 * writing phase) or an earlier intent with an unknown outcome blocks: recovery
 * (`apexrest_ship mode:recover`) must establish what happened first, and nothing is replayed.
 */
async function awaitConfirmedPredecessor(ctx: ProjectContext, intent: ShipIntent, signal?: AbortSignal) {
  const started = Date.now();
  const control = new LocalDeploymentControl(environment(ctx, intent.env));
  for (;;) {
    if (signal?.aborted) throw new Fault('CANCELLED', 'Ship intent cancelled while waiting.', 6, 'cancelled');
    const owner = await control.owner();
    let alive = false;
    if (owner && owner.hostname === hostname())
      try {
        process.kill(owner.pid, 0);
        alive = true;
      } catch (error) {
        alive = (error as NodeJS.ErrnoException).code !== 'ESRCH';
      }
    else if (owner) alive = true; // Another host's owner cannot be probed: treat it as running.
    if (owner?.phase === 'writing' && !alive)
      throw new Fault(
        'PREDECESSOR_OUTCOME_UNKNOWN',
        `Deployment run ${owner.runId} stopped while writing; its outcome must be reconciled before another ship of ${intent.env} is prepared. Run apexrest_ship mode:recover for that run.`,
        5,
        'blocked',
        { deploymentRunId: owner.runId, intentId: intent.id },
      );
    let waitingFor: string | undefined = owner && alive ? `deployment run ${owner.runId}` : undefined;
    if (!waitingFor)
      for (const earlier of await earlierIntents(ctx, intent)) {
        const state = await shipIntentStatus(ctx, earlier.id);
        if (state?.status === 'outcome_unknown')
          throw new Fault(
            'PREDECESSOR_OUTCOME_UNKNOWN',
            `Ship intent ${earlier.id} ended with an unknown outcome; reconcile it (apexrest_ship mode:recover) before another ship of ${intent.env} is prepared.`,
            5,
            'blocked',
            { intentId: intent.id, predecessorIntentId: earlier.id },
          );
        if (
          state &&
          ['preparing', 'planned', 'applying'].includes(state.status) &&
          Date.now() - Date.parse(state.at) < IN_FLIGHT_MS
        ) {
          waitingFor = `ship intent ${earlier.id}`;
          break;
        }
      }
    if (!waitingFor) return { waitedMs: Date.now() - started };
    if (Date.now() - started > IN_FLIGHT_MS)
      throw new Fault('PREDECESSOR_TIMEOUT', `Still waiting for ${waitingFor} to finish.`, 6, 'blocked');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function earlierIntents(ctx: ProjectContext, intent: ShipIntent) {
  const dir = await contained(ctx.root, '.apexrest/intents');
  const found: ShipIntent[] = [];
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.json') || name.endsWith('.state.json')) continue;
    const other = await readShipIntent(ctx, name.slice(0, -5)).catch(() => undefined);
    if (other && other.id !== intent.id && other.env === intent.env && other.createdAt <= intent.createdAt)
      found.push(other);
  }
  return found;
}

/** An intent whose job the broker replaced by a newer one before it started. */
export async function markIntentSuperseded(ctx: ProjectContext, id: string, by: string) {
  await readShipIntent(ctx, id);
  await setIntentStatus(ctx, id, 'superseded', `job ${by}`);
}

/** Capture time of an intent job, the coalescing order of the broker (as a plan's createdAt). */
export async function intentCreated(ctx: ProjectContext, id: string): Promise<number | undefined> {
  try {
    const at = Date.parse((await readShipIntent(ctx, id)).createdAt);
    return Number.isFinite(at) ? at : undefined;
  } catch {
    return undefined;
  }
}
export const intentFile = (id: string) => path.posix.join('.apexrest/intents', `${id}.json`);

/**
 * One-shot CLI `ship --mode apply` without a saved plan, when a development broker is running:
 * the intent is captured here and prepared and applied in the resident process, which keeps its
 * offline compiler between invocations. Undefined when this route does not apply (no broker, a
 * saved plan, another mode); the caller then ships in this process as before ("cold CLI").
 */
export async function shipThroughBroker(
  raw: Record<string, unknown>,
  execute: import('./jobs.ts').JobExecutor,
): Promise<import('./result.ts').Result | undefined> {
  // Same input rules as the in-process ship: malformed requests are refused before routing.
  const { schemas } = await import('./operations.ts');
  const { parse } = await import('./config.ts');
  const input = parse(schemas.ship as import('zod').z.ZodType<Record<string, unknown>>, raw);
  if (input.mode !== 'apply' || typeof input.plan === 'string' || input.confirmation !== undefined)
    return undefined;
  const { loadProject } = await import('./config.ts');
  const ctx = await loadProject(typeof input.project === 'string' ? input.project : process.cwd());
  const { liveBroker } = await import('./broker.ts');
  if (!(await liveBroker(ctx.root))) return undefined;
  const intent = await captureShipIntent(ctx, {
    env: String(input.env),
    userRequest: String(input.userRequest),
    ...(input.importMode ? { importMode: input.importMode as 'auto' | 'full' | 'files' } : {}),
    ...(Array.isArray(input.files) ? { files: input.files as string[] } : {}),
    client: 'cli',
  });
  const { JobService } = await import('./jobs.ts');
  const jobs = new JobService(ctx);
  const { jobId, runner } = await jobs.submit(
    'ship.intent',
    { project: ctx.root, env: input.env, intent: intent.id },
    execute,
  );
  let state = await jobs.status(jobId, 30);
  while (state.status === 'queued' || state.status === 'running') state = await jobs.status(jobId, 30);
  const provenance = runner === 'broker' ? 'resident-cli' : 'cold-cli';
  const nested = (state as { result?: unknown }).result as import('./result.ts').Result | undefined;
  const { jobToolResult } = await import('./jobs.ts');
  const result =
    nested && typeof nested === 'object' && 'ok' in nested
      ? nested
      : jobToolResult('ship.intent', state as Record<string, unknown>);
  return {
    ...result,
    operation: 'ship',
    data: {
      ...((result.data as object | undefined) ?? {}),
      mode: 'apply',
      provenance,
      jobId,
      intent: { id: intent.id, revision: intent.revision, capturedAt: intent.createdAt },
      ...(state.status === 'superseded' ? { superseded: state } : {}),
    },
  };
}
