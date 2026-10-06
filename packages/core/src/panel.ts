import path from 'node:path';
import { readdir, realpath, stat } from 'node:fs/promises';
import { z } from 'zod';
import { canonical, hash, contained, exists, readJson } from './fs.ts';
import { loadProject, policy } from './config.ts';
import { sanitized, Fault } from './result.ts';
import { sqlclConfig } from './sqlcl-config.ts';
import { connections } from './connections.ts';
import { JobService } from './jobs.ts';
import { browserPreferences } from './browser-preferences.ts';
import { SyncStore } from './sync.ts';
import { VERSION } from './version.ts';
import { runProcess } from './process.ts';

// Read-only development status snapshot for `panel.status`. It reads local
// project state (jobs, deployment journal, working-copy sync, Git changes and
// settings) and never starts a server, a worker, a job or a database call.
type Row = Record<string, unknown>;
const safe = <T>(value: T) => sanitized(value) as T;
const historyLimit = 2000;
export class PanelService {
  constructor(private root: string) {}
  async preferences() {
    return browserPreferences(this.root);
  }
  private async records(folder: string) {
    const base = await contained(this.root, '.apexrest/' + folder);
    if (!(await exists(base))) return { rows: [] as Row[], omitted: 0 };
    let entries = (await readdir(base, { withFileTypes: true })).filter(
      (e) => e.isDirectory() && z.uuid().safeParse(e.name).success,
    );
    // Large histories stay readable: inspect only the most recently modified
    // directories and report how many older records were not considered.
    let omitted = 0;
    if (entries.length > historyLimit) {
      const dated = await Promise.all(
        entries.map(async (entry) => ({
          entry,
          at: (await stat(path.join(base, entry.name)).catch(() => null))?.mtimeMs ?? 0,
        })),
      );
      omitted = entries.length - historyLimit;
      entries = dated
        .sort((a, b) => b.at - a.at)
        .slice(0, historyLimit)
        .map((d) => d.entry);
    }
    const files = await Promise.all(
      entries.map(async (entry) => {
        const file = await contained(base, entry.name + '/state.json');
        const info = await stat(file).catch(() => null);
        return { id: entry.name, file, at: info?.mtimeMs ?? 0, size: info?.size ?? 0 };
      }),
    );
    const rows = await Promise.all(
      files
        .filter((f) => f.size > 0)
        .sort((a, b) => b.at - a.at)
        .slice(0, 12)
        .map(async (f) => {
          if (f.size > 2 * 1024 * 1024)
            return {
              id: f.id,
              status: 'unavailable',
              diagnostics: ['Record exceeds the status limit.'],
            } as Row;
          try {
            return { ...((await readJson(f.file)) as Row), id: f.id };
          } catch {
            return {
              id: f.id,
              status: 'unavailable',
              diagnostics: ['Cannot read this operation record.'],
            } as Row;
          }
        }),
    );
    return { rows, omitted };
  }
  async snapshot() {
    this.root = await realpath(this.root);
    const ctx = await loadProject(this.root).catch((error: unknown) => {
      if (error instanceof Fault && error.code === 'PROJECT_NOT_CONFIGURED') return null;
      throw error;
    });
    const [prefs, sqlcl, refs, security, jobRecords, deploymentRecords] = await Promise.all([
      this.preferences(),
      sqlclConfig(),
      connections(),
      policy(),
      this.records('jobs'),
      this.records('deployments'),
    ]);
    const jobs = await Promise.all(
      jobRecords.rows.map(async (row) => {
        let state: Row = row;
        if (ctx)
          try {
            state = (await new JobService(ctx).status(String(row.id))) as Row;
          } catch {
            // One unreadable job record must not hide the rest of the snapshot.
            state = {
              ...row,
              status: 'unavailable',
              diagnostics: ['Cannot read this job status.'],
            };
          }
        const result = (state.result ?? {}) as Row;
        const diagnostics = Array.isArray(result.diagnostics)
          ? result.diagnostics
          : Array.isArray(state.diagnostics)
            ? state.diagnostics
            : [];
        return {
          id: String(row.id),
          operation: String(row.operation ?? result.operation ?? 'operation'),
          status: String(result.status ?? state.status),
          updatedAt: String(state.updatedAt ?? ''),
          summary: String(result.summary ?? '').slice(0, 1000),
          diagnostics: diagnostics.slice(0, 5),
          artifacts: Array.isArray(result.artifacts) ? result.artifacts.slice(0, 10) : [],
        };
      }),
    );
    const deployments = deploymentRecords.rows.map((row) => ({
      id: String(row.id),
      status: String(row.state ?? 'unknown'),
      at: String(row.at ?? ''),
      details: JSON.stringify(safe(row.details ?? {})).slice(0, 1200),
    }));
    let changes: { status: string; files: string[] } = { status: 'unavailable', files: [] };
    try {
      const git = await runProcess({
        executable: 'git',
        args: [
          '-c',
          'core.fsmonitor=false',
          '-c',
          'core.untrackedCache=false',
          'status',
          '--porcelain=v1',
          '--untracked-files=normal',
        ],
        cwd: this.root,
        timeoutMs: 3000,
      });
      if (git.code === 0)
        changes = { status: 'available', files: git.stdout.split('\n').filter(Boolean).slice(0, 80) };
    } catch {
      /* A configured APEX project does not require Git. */
    }
    let toolchain: unknown = null;
    if (ctx) {
      const file = await contained(this.root, ctx.config.toolchain.lockFile);
      if (await exists(file)) {
        if ((await stat(file)).size <= 128000) toolchain = { digest: hash(canonical(await readJson(file))) };
      }
    }
    const sync = ctx
      ? await Promise.all(
          Object.entries(ctx.config.environments).map(async ([name, env]) => {
            try {
              return { environment: name, ...(await new SyncStore(ctx, env, name).status()) };
            } catch (error) {
              return {
                environment: name,
                status: 'blocked',
                blocked: true,
                blockedReason: error instanceof Fault ? error.code : 'SYNC_STATE_INVALID',
                serverFreshness: 'not-checked',
              };
            }
          }),
        )
      : [];
    return safe({
      sync,
      version: VERSION,
      updatedAt: new Date().toISOString(),
      project: this.root,
      configured: !!ctx,
      trusted: security.trustedProjects.includes(this.root),
      configuration: ctx?.config ?? null,
      sqlcl,
      preferences: prefs,
      connections: refs,
      toolchain,
      jobs,
      deployments,
      history: { jobsOmitted: jobRecords.omitted, deploymentsOmitted: deploymentRecords.omitted },
      changes,
      permissions: {
        activeGrants: security.grants
          .filter((g) => g.projectRoot === this.root && Date.parse(g.expiresAt) > Date.now())
          .map((g) => ({ operations: g.operations, expiresAt: g.expiresAt, exactPlan: !!g.planDigest })),
      },
    });
  }
}
export type PanelSnapshot = Awaited<ReturnType<PanelService['snapshot']>>;
