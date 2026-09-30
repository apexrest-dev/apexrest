import path from 'node:path';
import { lstat, mkdir, readdir, realpath, open, cp, chmod } from 'node:fs/promises';
import { z } from 'zod';
import type { Environment, ProjectContext } from './config.ts';
import { relativePath } from './config.ts';
import { canonical, contained, exists, hash, inventory, readJson, withLock, writeJson } from './fs.ts';
import { Fault } from './result.ts';
import { LocalDeploymentControl, coordination } from './deployment-control.ts';
import { VERSION } from './version.ts';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const snapshotSchema = z.strictObject({
  directory: relativePath,
  files: z.record(relativePath, digest),
  digest,
});
export const serverMetadataSchema = z.strictObject({
  lastUpdatedOn: z.string().nullable(),
  lastUpdatedBy: z.string().nullable(),
});
export const syncStateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  syncId: z.uuid(),
  revision: z.number().int().nonnegative(),
  projectRoot: z.string(),
  projectId: z.string(),
  environment: z.string(),
  targetDigest: digest,
  target: z.record(z.string(), z.unknown()),
  sourceDir: relativePath,
  toolchainDigest: digest,
  runtimeVersion: z.string(),
  compilerVersion: z.string().min(1),
  exportedAt: z.iso.datetime(),
  baseline: snapshotSchema,
  backup: z.strictObject({ backupId: z.uuid(), checksum: digest }),
  observedMetadata: serverMetadataSchema,
  lastSuccessfulImport: z
    .strictObject({
      at: z.iso.datetime(),
      runId: z.uuid(),
      snapshot: snapshotSchema,
    })
    .nullable(),
  status: z.enum(['ready', 'importing', 'verification_failed', 'outcome_unknown', 'invalidated']),
  importingRunId: z.uuid().nullable(),
});
export type SyncState = z.infer<typeof syncStateSchema>;
export type SourceSnapshot = z.infer<typeof snapshotSchema>;
export type ServerMetadata = z.infer<typeof serverMetadataSchema>;
export function targetDigest(env: Environment) {
  return hash(
    canonical({
      ...env.databaseIdentity,
      workspace: env.workspace,
      schema: env.parsingSchema,
      applicationId: env.applicationId,
    }),
  );
}

/** Reject even contained symlinks: private durable records must not alias other project files. */
export async function syncPath(ctx: ProjectContext, relative: string) {
  const file = await contained(ctx.root, relative);
  let probe = ctx.root;
  for (const part of path.relative(ctx.root, file).split(path.sep).filter(Boolean)) {
    probe = path.join(probe, part);
    if (await exists(probe)) {
      if ((await lstat(probe)).isSymbolicLink())
        throw new Fault('SYNC_PATH_UNSAFE', 'Working-copy storage rejects symlinks.', 5);
    }
  }
  return file;
}
export async function privateCopy(source: string, destination: string) {
  await cp(source, destination, { recursive: true });
  async function secure(directory: string) {
    await chmod(directory, 0o700);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Fault('SYNC_PATH_UNSAFE', 'Private copies reject symlinks.', 5);
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await secure(file);
      else if (entry.isFile()) await chmod(file, 0o600);
      else throw new Fault('SYNC_PATH_UNSAFE', 'Private copies accept regular files only.', 5);
    }
  }
  await secure(destination);
}
export async function checkSnapshot(ctx: ProjectContext, snapshot: SourceSnapshot) {
  if (!snapshot.directory.startsWith('.apexrest/'))
    throw new Fault('SYNC_ARTIFACT_INVALID', 'Snapshot must be private project storage.', 5);
  const actual = await inventory(await syncPath(ctx, snapshot.directory));
  if (
    !Object.keys(actual).length ||
    canonical(actual) !== canonical(snapshot.files) ||
    hash(canonical(actual)) !== snapshot.digest
  )
    throw new Fault('SYNC_ARTIFACT_INVALID', 'Working-copy snapshot checksum verification failed.', 5);
  return actual;
}
export async function checkSyncBackup(
  ctx: ProjectContext,
  backup: SyncState['backup'],
  envDigest: string,
  environmentName: string,
) {
  const directory = await syncPath(ctx, '.apexrest/backups/' + backup.backupId);
  const metadata = (await readJson(
    await syncPath(ctx, '.apexrest/backups/' + backup.backupId + '/backup.json'),
  )) as {
    schemaVersion: number;
    environment: string;
    backupId: string;
    digest: string;
    targetDigest: string;
    files: Record<string, string>;
  };
  const files = await inventory(await syncPath(ctx, '.apexrest/backups/' + backup.backupId + '/application'));
  if (
    metadata.schemaVersion !== 1 ||
    metadata.environment !== environmentName ||
    metadata.backupId !== backup.backupId ||
    metadata.targetDigest !== envDigest ||
    metadata.digest !== backup.checksum ||
    hash(canonical(files)) !== backup.checksum ||
    canonical(metadata.files) !== canonical(files) ||
    !Object.keys(files).length
  )
    throw new Fault('BACKUP_INVALID', 'Initial SQL backup checksum or target verification failed.', 5);
}
export function checkpoint(state: SyncState) {
  return state.lastSuccessfulImport?.snapshot ?? state.baseline;
}
export class SyncStore {
  constructor(
    readonly ctx: ProjectContext,
    readonly env: Environment,
    readonly name: string,
  ) {}
  async file(key = targetDigest(this.env)) {
    return syncPath(this.ctx, '.apexrest/sync/' + key + '/state.json');
  }
  async lock<T>(action: () => Promise<T>) {
    return withLock(await syncPath(this.ctx, '.apexrest/sync/state.lock'), action);
  }
  /** Scan environment records so a changed target cannot silently become a legacy project. */
  async read(allowMappingChange = false): Promise<SyncState | null> {
    const base = await syncPath(this.ctx, '.apexrest/sync');
    if (!(await exists(base))) return null;
    const matches: SyncState[] = [];
    for (const entry of await readdir(base, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Fault('SYNC_PATH_UNSAFE', 'Sync storage contains a symlink.', 5);
      if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
      const file = await this.file(entry.name);
      if (!(await exists(file))) {
        if (await exists(await syncPath(this.ctx, '.apexrest/sync/' + entry.name + '/journal.jsonl')))
          throw new Fault(
            'SYNC_STATE_INVALID',
            'A durable sync journal exists but its state is missing. Recover it explicitly; no export fallback.',
            5,
          );
        continue;
      }
      let state: SyncState;
      try {
        state = syncStateSchema.parse(await readJson(file));
      } catch {
        throw new Fault(
          'SYNC_STATE_INVALID',
          'Corrupt working-copy state requires explicit recovery; no export fallback.',
          5,
        );
      }
      if (state.targetDigest !== entry.name)
        throw new Fault('SYNC_STATE_INVALID', 'Sync record storage key differs from its target.', 5);
      if (
        state.targetDigest === targetDigest(this.env) &&
        state.environment !== this.name &&
        state.status !== 'invalidated'
      )
        throw new Fault(
          'SYNC_MAPPING_CHANGED',
          'This target is bound to another environment. Explicitly invalidate the previous mapping first.',
          5,
        );
      if (state.environment === this.name && state.status !== 'invalidated') matches.push(state);
      else if (state.targetDigest === targetDigest(this.env) && state.environment === this.name)
        matches.push(state);
    }
    const active = matches.filter((s) => s.status !== 'invalidated');
    if (active.length > 1)
      throw new Fault('SYNC_STATE_INVALID', 'Multiple active records require reconciliation.', 5);
    const state = active[0] ?? matches[0] ?? null;
    if (state && state.status !== 'invalidated' && !allowMappingChange) await this.checkMapping(state);
    return state;
  }
  async checkMapping(state: SyncState) {
    const { readFile } = await import('node:fs/promises');
    if (
      state.projectRoot !== (await realpath(this.ctx.root)) ||
      state.projectId !== this.ctx.config.projectId ||
      state.environment !== this.name ||
      state.targetDigest !== targetDigest(this.env) ||
      state.sourceDir !== this.ctx.config.application.sourceDir ||
      state.runtimeVersion !== VERSION ||
      state.toolchainDigest !==
        hash(await readFile(await contained(this.ctx.root, this.ctx.config.toolchain.lockFile))) ||
      this.env.kind === 'production'
    )
      throw new Fault(
        'SYNC_MAPPING_CHANGED',
        'Project, target, source directory or toolchain changed. Explicit refresh or invalidate is required.',
        5,
      );
  }
  async validate(state: SyncState, ready = true) {
    await this.checkMapping(state);
    if (ready && state.status !== 'ready')
      throw new Fault(
        'SYNC_BLOCKED',
        `Working copy is ${state.status}. Inspect the existing run and reconcile before writes.`,
        5,
      );
    if (
      state.baseline.directory !==
        '.apexrest/sync/' + state.targetDigest + '/baselines/' + state.syncId + '/application' ||
      (state.lastSuccessfulImport &&
        state.lastSuccessfulImport.snapshot.directory !==
          '.apexrest/deployments/' + state.lastSuccessfulImport.runId + '/snapshot/' + state.sourceDir)
    )
      throw new Fault(
        'SYNC_ARTIFACT_INVALID',
        'Snapshot reference does not match its sync or deployment owner.',
        5,
      );
    if (
      state.status === 'ready' &&
      coordination(this.env).backend === 'local' &&
      (await new LocalDeploymentControl(this.env).owner())?.phase === 'writing'
    )
      throw new Fault('SYNC_BLOCKED', 'A writing owner must complete or be reconciled before reuse.', 5);
    await checkSnapshot(this.ctx, state.baseline);
    if (state.lastSuccessfulImport) await checkSnapshot(this.ctx, state.lastSuccessfulImport.snapshot);
    await checkSyncBackup(this.ctx, state.backup, state.targetDigest, this.name);
  }
  async write(state: SyncState) {
    const valid = syncStateSchema.parse(state);
    const file = await this.file(valid.targetDigest);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const journalFile = await syncPath(this.ctx, '.apexrest/sync/' + valid.targetDigest + '/journal.jsonl');
    const journal = await open(journalFile, 'a', 0o600);
    try {
      await journal.writeFile(
        JSON.stringify({
          at: new Date().toISOString(),
          syncId: valid.syncId,
          revision: valid.revision,
          status: valid.status,
          importingRunId: valid.importingRunId,
          baseline: valid.baseline.directory,
          backupId: valid.backup.backupId,
          latestApplied: valid.lastSuccessfulImport?.snapshot.directory ?? null,
        }) + '\n',
      );
      await journal.sync();
    } finally {
      await journal.close();
    }
    await writeJson(file, valid);
    // Persist the renamed directory entry as well as the file contents.
    const directory = process.platform !== 'win32' ? await open(path.dirname(file), 'r') : null;
    try {
      await directory?.sync();
    } finally {
      await directory?.close();
    }
  }
  async status() {
    const state = await this.read(true);
    if (!state) return { mode: 'full-export', status: 'absent', serverFreshness: 'not-checked' };
    let blockedReason: string | null = null;
    try {
      await this.validate(state, false);
    } catch (error) {
      blockedReason = error instanceof Fault ? error.code : 'SYNC_ARTIFACT_INVALID';
    }
    if (
      coordination(this.env).backend === 'local' &&
      (await new LocalDeploymentControl(this.env).owner())?.phase === 'writing'
    )
      blockedReason = 'SYNC_BLOCKED';
    const source = await syncPath(this.ctx, state.sourceDir);
    const files = (await exists(source)) ? await inventory(source) : {};
    return {
      mode: state.status === 'invalidated' ? 'full-export' : 'working-copy',
      syncId: state.syncId,
      revision: state.revision,
      status: state.status,
      exportedAt: state.exportedAt,
      lastSuccessfulImport: state.lastSuccessfulImport
        ? {
            at: state.lastSuccessfulImport.at,
            runId: state.lastSuccessfulImport.runId,
            digest: state.lastSuccessfulImport.snapshot.digest,
          }
        : null,
      backupId: state.backup.backupId,
      importingRunId: state.importingRunId,
      dirty: canonical(files) !== canonical(checkpoint(state).files),
      blocked: !!blockedReason || !['ready', 'invalidated'].includes(state.status),
      blockedReason,
      serverFreshness: 'not-checked',
      assumption: 'single-editor',
    };
  }
}
