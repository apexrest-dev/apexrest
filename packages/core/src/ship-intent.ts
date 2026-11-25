import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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
  userRequest: string;
  digest: string;
}
export type IntentStatus =
  'queued' | 'preparing' | 'planned' | 'applying' | 'superseded' | 'succeeded' | 'failed';

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
  input: { env: string; userRequest: string; importMode?: ImportOptions['importMode']; files?: string[] },
): Promise<ShipIntent> {
  const { env, requested } = await checkShipRequest(ctx, input.env, {
    importMode: input.importMode ?? 'auto',
    ...(input.files ? { files: input.files } : {}),
  });
  const inventory = await sourceInventory(ctx);
  const { revision, configuration } = sourceRevision(inventory, ctx.config);
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
    userRequest: input.userRequest,
  };
  const intent: ShipIntent = { ...body, digest: hash(canonical(body)) };
  await atomicWrite(await intentPath(ctx, intent.id), JSON.stringify(intent) + '\n');
  await setIntentStatus(ctx, intent.id, 'queued');
  return intent;
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
    ? ((await readJson(file)) as { status: IntentStatus; detail?: string })
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
    // The intent names its own bytes: different local sources are a newer revision, never this one.
    const current = await sourceInventory(ctx);
    const { revision, configuration } = sourceRevision(current, ctx.config);
    if (revision !== intent.revision || configuration !== intent.configuration)
      throw superseded(intent, 'the project sources changed after it was queued (a newer revision).');
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
      intent: { id, revision: intent.revision, status: 'succeeded' as const },
      plan: { planPath: planned.planPath, ...planned.preview },
    };
  } catch (error) {
    const status: IntentStatus =
      error instanceof Fault && error.code === 'SHIP_INTENT_SUPERSEDED' ? 'superseded' : 'failed';
    await setIntentStatus(ctx, id, status, error instanceof Fault ? error.code : undefined).catch(
      () => undefined,
    );
    throw error;
  }
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
