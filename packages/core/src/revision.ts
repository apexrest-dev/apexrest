import path from 'node:path';
import type { ProjectContext } from './config.ts';
import { canonical, exists, hash, readJson, withLock, writeJson } from './fs.ts';

/**
 * Source revisions: one identity for a consistent set of project sources, shared by validation,
 * preview, plan/apply and the state report. The revision is the existing deploy `sourceDigest`
 * (hash of the canonical source inventory: application, migrations, packages, package manifests),
 * so a plan, a compiler result and a deployment name the same thing. Configuration is bound beside
 * it, as plans already do.
 *
 * Results are recorded per kind. An outcome replaces the recorded one only when its work started
 * at or after the recorded work, so a late result never overwrites a newer one; a result is always
 * stored with the revision it was produced for, never with the latest local revision.
 */

export type Inventory = Record<string, string>;

export interface SourceRevision {
  revision: string;
  configuration: string;
}

/** The change between two inventories, as consumed by preview invalidation and the reports. */
export interface SourceChange {
  revision: string;
  previousRevision: string | null;
  changedFiles: string[];
  addedFiles: string[];
  removedFiles: string[];
  /** Page ids whose own files changed; `unknown` when shared or application files changed. */
  affectedPages: string[] | 'unknown';
}

export const revisionOf = (files: Inventory) => hash(canonical(files));

export function sourceRevision(files: Inventory, config: unknown): SourceRevision {
  return { revision: revisionOf(files), configuration: hash(canonical(config)) };
}

/** Compares inventories; `applicationDir` is the project-relative APEXlang folder. */
export function sourceChange(
  previous: Inventory | null,
  next: Inventory,
  applicationDir: string,
): SourceChange {
  const before = previous ?? {};
  const changedFiles: string[] = [];
  const addedFiles: string[] = [];
  const removedFiles: string[] = [];
  for (const [file, sha] of Object.entries(next))
    if (!(file in before)) addedFiles.push(file);
    else if (before[file] !== sha) changedFiles.push(file);
  for (const file of Object.keys(before)) if (!(file in next)) removedFiles.push(file);
  const prefix = applicationDir.replace(/\/+$/u, '') + '/pages/';
  const pages = new Set<string>();
  let unknown = previous === null;
  for (const file of [...changedFiles, ...addedFiles, ...removedFiles]) {
    // Page files are pNNNNN-name.apx directly under pages/; page 0 is shared by every page.
    const page = file.startsWith(prefix)
      ? /^p(\d{1,5})(?:-[^/]*)?\.apx$/u.exec(file.slice(prefix.length))
      : null;
    if (page && Number(page[1]) !== 0) pages.add(String(Number(page[1])));
    else unknown = true;
  }
  return {
    revision: revisionOf(next),
    previousRevision: previous ? revisionOf(previous) : null,
    changedFiles: changedFiles.sort(),
    addedFiles: addedFiles.sort(),
    removedFiles: removedFiles.sort(),
    affectedPages: unknown ? 'unknown' : [...pages].sort((a, b) => Number(a) - Number(b)),
  };
}

export type RevisionKind = 'preview' | 'validated' | 'importing' | 'deployed' | 'failed';

export interface RevisionRecord {
  revision: string;
  /** When the work that produced the outcome started; orders concurrent and late results. */
  startedAt: string;
  finishedAt: string;
  environment?: string;
  runId?: string;
  /** Short outcome detail: compiler counts, failure code. */
  detail?: Record<string, string | number | boolean>;
}

interface RevisionFile {
  version: 1;
  /** validated/preview are local; importing/deployed/failed are keyed by environment. */
  validated?: RevisionRecord;
  preview?: RevisionRecord;
  importing: Record<string, RevisionRecord>;
  deployed: Record<string, RevisionRecord>;
  failed: Record<string, RevisionRecord>;
}

const fileOf = (root: string) => path.join(root, '.apexrest', 'revisions.json');

async function read(root: string): Promise<RevisionFile> {
  const file = fileOf(root);
  if (!(await exists(file))) return { version: 1, importing: {}, deployed: {}, failed: {} };
  const value = (await readJson(file)) as Partial<RevisionFile>;
  if (value?.version !== 1) return { version: 1, importing: {}, deployed: {}, failed: {} };
  return { version: 1, importing: {}, deployed: {}, failed: {}, ...value } as RevisionFile;
}

const newer = (record: RevisionRecord, existing: RevisionRecord | undefined) =>
  !existing || Date.parse(record.startedAt) >= Date.parse(existing.startedAt);

/**
 * Records an outcome for its own revision. Returns false when a result of later-started work is
 * already recorded (the late result is dropped, never applied to another revision).
 */
export async function recordRevision(
  root: string,
  kind: RevisionKind,
  record: RevisionRecord,
): Promise<boolean> {
  const file = fileOf(root);
  return withLock(file + '.lock', async () => {
    const state = await read(root);
    let applied = false;
    if (kind === 'validated' || kind === 'preview') {
      if (newer(record, state[kind])) {
        state[kind] = record;
        applied = true;
      }
    } else {
      const env = record.environment ?? 'default';
      const table = state[kind];
      if (newer(record, table[env])) {
        table[env] = record;
        applied = true;
      }
      // A deployment outcome ends its own import; another run's import stays visible.
      if (kind !== 'importing' && state.importing[env]?.runId === record.runId) delete state.importing[env];
    }
    if (applied || kind !== 'importing') await writeJson(file, state);
    return applied;
  });
}

export interface RevisionStatus {
  latestLocal: SourceRevision;
  validated: (RevisionRecord & { current: boolean }) | null;
  preview: (RevisionRecord & { current: boolean }) | null;
  importing: Record<string, RevisionRecord>;
  deployed: Record<string, RevisionRecord & { current: boolean }>;
  failed: Record<string, RevisionRecord>;
}

/** Each state separately, marked current only when it is for the latest local revision. */
export async function revisionStatus(root: string, latestLocal: SourceRevision): Promise<RevisionStatus> {
  const state = await read(root);
  const mark = <T extends RevisionRecord>(record: T | undefined) =>
    record ? { ...record, current: record.revision === latestLocal.revision } : null;
  return {
    latestLocal,
    validated: mark(state.validated),
    preview: mark(state.preview),
    importing: state.importing,
    deployed: Object.fromEntries(Object.entries(state.deployed).map(([env, record]) => [env, mark(record)!])),
    failed: state.failed,
  };
}

/** The current revision of a project, from the same inventory as deploy plans. */
export async function projectRevision(
  ctx: ProjectContext,
  inventory: (ctx: ProjectContext) => Promise<Inventory>,
): Promise<SourceRevision & { files: Inventory }> {
  const files = await inventory(ctx);
  return { ...sourceRevision(files, ctx.config), files };
}
