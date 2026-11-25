import path from 'node:path';
import type { ProjectContext } from './config.ts';
import { contained, readJson } from './fs.ts';
import { revisionOf } from './revision.ts';

/**
 * Which never-started ship can replace another (broker coalescing). A newer pending ship covers an
 * older one only when both name the same environment, target and configuration, neither carries a
 * separate risk confirmation, the newer one was captured no earlier, and the newer scope contains
 * the older one: a full import contains everything; an automatic selection contains an automatic
 * one (both select every change since the same baseline); an explicit file list contains only a
 * subset of itself. Timestamps alone never merge two ships.
 *
 * The newer ship deploys one complete source state taken later from the same project tree, so
 * every file holds its latest requested value: an older edit that the newer state no longer has
 * was overwritten or reverted after it, and is reported as overridden instead of resurrected.
 */
export interface PendingShip {
  jobId: string;
  kind: 'intent' | 'plan';
  env: string;
  targetDigest: string;
  configuration: string;
  requested: 'auto' | 'full' | 'files';
  files: string[];
  inventory: Record<string, string>;
  /** The files this ship changed, when known; otherwise every file counts as its own. */
  changedFiles?: string[];
  revision: string;
  createdAt: number;
  confirmed: boolean;
}
export type Coverage =
  | {
      covered: true;
      successor: string;
      successorRevision: string;
      coveredRevision: string;
      scope: { requested: PendingShip['requested']; files?: string[] };
      /** Files whose older content the successor replaced with a later value (or removed). */
      overriddenFiles: string[];
    }
  | { covered: false; reason: string };

export async function pendingShip(ctx: ProjectContext, jobId: string): Promise<PendingShip | undefined> {
  try {
    const request = (await readJson(
      path.join(await contained(ctx.root, '.apexrest/jobs/' + jobId), 'request.json'),
    )) as { operation?: string; input?: Record<string, unknown> };
    const input = request.input ?? {};
    if (request.operation === 'ship.intent') {
      const { readShipIntent } = await import('./ship-intent.ts');
      const intent = await readShipIntent(ctx, String(input.intent ?? ''));
      return {
        jobId,
        kind: 'intent',
        env: intent.env,
        targetDigest: intent.targetDigest,
        configuration: intent.configuration,
        requested: intent.importMode === 'none' ? 'full' : intent.importMode,
        files: intent.files ?? [],
        inventory: intent.inventory,
        ...(intent.changedFiles ? { changedFiles: intent.changedFiles } : {}),
        revision: intent.revision,
        createdAt: Date.parse(intent.createdAt),
        confirmed: false,
      };
    }
    if (request.operation !== 'ship.apply') return undefined;
    const plan = (await readJson(await contained(ctx.root, String(input.plan ?? '')))) as {
      environment?: string;
      targetDigest?: string;
      configurationDigest?: string;
      sources?: Record<string, string>;
      sourceDigest?: string;
      createdAt?: string;
      risks?: string[];
      importSelection?: { requestedMode?: string; files?: string[] };
    };
    const requested = plan.importSelection?.requestedMode;
    const createdAt = Date.parse(String(plan.createdAt ?? ''));
    if (!plan.targetDigest || !plan.configurationDigest || !plan.sources || !Number.isFinite(createdAt))
      return undefined;
    return {
      jobId,
      kind: 'plan',
      env: String(plan.environment ?? input.env ?? ''),
      targetDigest: plan.targetDigest,
      configuration: plan.configurationDigest,
      requested: requested === 'auto' || requested === 'files' ? requested : 'full',
      files: requested === 'files' ? (plan.importSelection?.files ?? []) : [],
      inventory: plan.sources,
      revision: plan.sourceDigest ?? revisionOf(plan.sources),
      createdAt,
      // A separately confirmed risky plan is authorized for itself only.
      confirmed: input.confirmation !== undefined || (plan.risks?.length ?? 0) > 0,
    };
  } catch {
    return undefined;
  }
}

export function coverage(older: PendingShip | undefined, newer: PendingShip | undefined): Coverage {
  if (!older || !newer) return { covered: false, reason: 'unreadable pending ship' };
  if (older.env !== newer.env) return { covered: false, reason: 'different environment' };
  if (older.targetDigest !== newer.targetDigest) return { covered: false, reason: 'different target' };
  if (older.configuration !== newer.configuration)
    return { covered: false, reason: 'different configuration' };
  if (older.confirmed || newer.confirmed)
    return { covered: false, reason: 'separately confirmed authorization' };
  if (newer.createdAt < older.createdAt) return { covered: false, reason: 'captured earlier' };
  const scope =
    newer.requested === 'full' ||
    (newer.requested === 'auto' && older.requested === 'auto') ||
    (newer.requested === 'files' &&
      older.requested === 'files' &&
      older.files.every((file) => newer.files.includes(file)));
  if (!scope) return { covered: false, reason: 'the newer scope does not contain the older scope' };
  const overriddenFiles = (older.changedFiles ?? Object.keys(older.inventory))
    .filter((file) => newer.inventory[file] !== older.inventory[file])
    .sort();
  return {
    covered: true,
    successor: newer.jobId,
    successorRevision: newer.revision,
    coveredRevision: older.revision,
    scope: { requested: older.requested, ...(older.requested === 'files' ? { files: older.files } : {}) },
    overriddenFiles,
  };
}
