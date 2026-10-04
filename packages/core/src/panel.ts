import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, realpath, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { contained, exists, readJson, writeJson } from './fs.ts';
import { loadProject, parse, policy, requireTrust } from './config.ts';
import { sanitized, Fault } from './result.ts';
import { sqlclConfig, configureSqlcl } from './sqlcl-config.ts';
import { connections, configureConnection } from './connections.ts';
import { JobService } from './jobs.ts';
import { panelActionSchema, type PanelAction } from './panel-schema.ts';
import { browserPreferences } from './browser-preferences.ts';
import { openVerificationBrowser } from './browser.ts';
import { SyncStore } from './sync.ts';
import { catalogSearch, catalogRead } from './composer/catalog.ts';
import { blueprintAdd } from './composer/service.ts';
import { blueprintSchema } from './composer/schemas.ts';
import { readDocument, semanticDigest } from './composer/formats.ts';
import { assessPlan } from './composer/materializer.ts';
import { VERSION } from './version.ts';
import { runProcess } from './process.ts';
import { OracleAdapter } from './oracle.ts';

type Row = Record<string, unknown>;
const safe = <T>(value: T) => sanitized(value) as T;
const historyLimit = 2000;
export class PanelService {
  constructor(
    private root: string,
    private oracle: Pick<OracleAdapter, 'savedConnections'> = new OracleAdapter(),
  ) {}
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
              diagnostics: ['Record exceeds the panel limit.'],
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
            // One unreadable job record must not hide the rest of the panel.
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
        args: ['status', '--porcelain=v1', '--untracked-files=normal'],
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
        if ((await stat(file)).size <= 128000) toolchain = await readJson(file);
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
  async act(action: PanelAction) {
    action = parse(panelActionSchema, { action }).action;
    this.root = await realpath(this.root);
    await requireTrust(this.root);
    if (action.kind === 'saved-connections') return this.oracle.savedConnections();
    if (action.kind === 'preferences') {
      const settings = { ...(await this.preferences()), ...action.settings };
      await writeJson(await contained(this.root, '.apexrest/panel/preferences.json'), settings);
      return { saved: true, appliesTo: 'browser-verification' };
    }
    if (action.kind === 'sqlcl') {
      return configureSqlcl(
        action.settings.mode,
        action.settings.mcpRestrictLevel,
        action.settings.databaseTransport,
      );
    }
    if (action.kind === 'connection') return configureConnection(action.name, action);
    if (action.kind === 'catalog-search')
      return catalogSearch(action.query, {
        project: this.root,
        limit: 8,
        ...(action.profile ? { profile: action.profile } : {}),
      });
    if (action.kind === 'catalog-read') return catalogRead(action.id, action.offset, 8192, this.root);
    const ctx = await loadProject(this.root);
    if (action.kind === 'blueprint-read') {
      const blueprint = await readDocument(this.root, action.blueprint, blueprintSchema);
      return { blueprint, digest: semanticDigest(blueprint) };
    }
    if (action.kind === 'blueprint-add')
      return blueprintAdd(
        ctx,
        action.blueprint,
        action.instanceId,
        action.instance,
        action.expectedDigest,
        action.apply,
      );
    if (action.kind === 'compose-status') {
      const job = await new JobService(ctx).status(action.id);
      const result = ('result' in job ? job.result : null) as {
        data?: { plan?: string; planDigest?: string };
      } | null;
      let materializable = false;
      if (result?.data?.plan && result.data.planDigest)
        materializable = await assessPlan(ctx, result.data.plan, result.data.planDigest);
      return { job, materializable };
    }
    if (action.kind === 'compose-plan' || action.kind === 'compose-materialize') {
      const { kind, ...input } = action;
      return new JobService(ctx).start(
        kind === 'compose-plan' ? 'compose.plan' : 'compose.materialize',
        input,
        path.join(path.dirname(fileURLToPath(import.meta.url)), 'apexrest.mjs'),
      );
    }
    if (action.kind === 'browser') return openVerificationBrowser(ctx, action.env);
    if (action.kind === 'cancel-job') return new JobService(ctx).cancel(action.id);
    const operation =
      action.kind === 'validate' ? 'apex.validate' : action.kind === 'plan' ? 'deploy.plan' : 'test.run';
    const input =
      action.kind === 'plan'
        ? { env: action.env, out: '.apexrest/plans/' + randomUUID() + '.json' }
        : action.kind === 'test'
          ? { suite: action.suite, ...(action.env ? { env: action.env } : {}) }
          : {};
    return new JobService(ctx).start(
      operation,
      input,
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'apexrest.mjs'),
    );
  }
}
export type PanelSnapshot = Awaited<ReturnType<PanelService['snapshot']>>;
