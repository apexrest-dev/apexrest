import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { managedHome, parse, type ProjectContext } from './config.ts';
import { exists, readJson, withLock, writeJson } from './fs.ts';
import { resourceRoot } from './project.ts';
import { Fault } from './result.ts';

/**
 * Machine-wide APEXREST settings in APEXREST_HOME/settings.json.
 *
 * - `decisionApi`: the default for projects whose apexrest.json has no `decisionApi`.
 *   A project setting always wins. The global default reads its key only from the
 *   process environment; a private ENV file remains a project setting.
 * - `catalog.enabled`: false turns off the reference catalog tools (search, read,
 *   select) for every host on this machine.
 *
 * Local catalog usage counts live beside it in catalog-usage.json, and the projects
 * APEXREST last worked in live in recent-projects.json. Neither leaves the machine.
 */
export const globalSettingsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  decisionApi: z
    .strictObject({
      enabled: z.boolean().default(false),
      apiKeyEnv: z
        .string()
        .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
        .default('OPENAI_API_KEY'),
      timeoutMs: z.number().int().min(250).max(10000).default(3000),
    })
    .optional(),
  catalog: z.strictObject({ enabled: z.boolean().default(true) }).optional(),
});
export type GlobalSettings = z.infer<typeof globalSettingsSchema>;
type DecisionSettings = NonNullable<ProjectContext['config']['decisionApi']>;

const settingsFile = () => path.join(managedHome(), 'settings.json');
const usageFile = () => path.join(managedHome(), 'catalog-usage.json');
const recentFile = () => path.join(managedHome(), 'recent-projects.json');
const empty: GlobalSettings = { schemaVersion: 1 };

export async function globalSettings(): Promise<GlobalSettings> {
  const file = settingsFile();
  return (await exists(file)) ? parse(globalSettingsSchema, await readJson(file)) : empty;
}

export async function configureGlobalSettings(change: {
  decisionApi?: boolean;
  apiKeyEnv?: string;
  decisionTimeoutMs?: number;
  catalog?: boolean;
}) {
  if (
    change.decisionApi === undefined &&
    change.apiKeyEnv === undefined &&
    change.decisionTimeoutMs === undefined &&
    change.catalog === undefined
  )
    throw new Fault(
      'INVALID_INPUT',
      'Name a setting to change: --decision-api, --api-key-env, --decision-timeout-ms or --catalog.',
      2,
    );
  return withLock(path.join(managedHome(), 'settings.lock'), async () => {
    const previous = await globalSettings();
    const decisionChanged =
      change.decisionApi !== undefined ||
      change.apiKeyEnv !== undefined ||
      change.decisionTimeoutMs !== undefined;
    const next = parse(globalSettingsSchema, {
      ...previous,
      ...(decisionChanged
        ? {
            decisionApi: {
              ...previous.decisionApi,
              ...(change.decisionApi !== undefined ? { enabled: change.decisionApi } : {}),
              ...(change.apiKeyEnv !== undefined ? { apiKeyEnv: change.apiKeyEnv } : {}),
              ...(change.decisionTimeoutMs !== undefined ? { timeoutMs: change.decisionTimeoutMs } : {}),
            },
          }
        : {}),
      ...(change.catalog !== undefined ? { catalog: { enabled: change.catalog } } : {}),
    });
    await writeJson(settingsFile(), next);
    return next;
  });
}

/** Project decisionApi wins; otherwise the machine default; otherwise selection stays local. */
export async function effectiveDecisionApi(
  ctx: ProjectContext,
): Promise<{ settings?: DecisionSettings; source: 'project' | 'global' | 'default' }> {
  if (ctx.config.decisionApi) return { settings: ctx.config.decisionApi, source: 'project' };
  const global = (await globalSettings()).decisionApi;
  return global ? { settings: global, source: 'global' } : { source: 'default' };
}

export async function catalogEnabled() {
  return (await globalSettings()).catalog?.enabled !== false;
}

export async function requireCatalog() {
  if (!(await catalogEnabled()))
    throw new Fault(
      'CATALOG_DISABLED',
      'The reference catalog is turned off in APEXREST settings. Continue without catalog lookups: write APEXlang from the project sources and fix compiler diagnostics. The user can turn it on with: apexrest settings configure --catalog on',
      3,
      'blocked',
    );
}

/* ---------- Local catalog usage counters ---------- */

export type CatalogUse = 'search' | 'read' | 'select';
const counts = z.strictObject({
  search: z.number().int().min(0).default(0),
  read: z.number().int().min(0).default(0),
  select: z.number().int().min(0).default(0),
  decisions: z.number().int().min(0).default(0),
  // OpenAI Decisions tokens as reported by the API response, and its request time.
  inputTokens: z.number().int().min(0).default(0),
  cachedTokens: z.number().int().min(0).default(0),
  outputTokens: z.number().int().min(0).default(0),
  totalTokens: z.number().int().min(0).default(0),
  apiMs: z.number().int().min(0).default(0),
  apiCalls: z.number().int().min(0).default(0),
});
type Counts = z.infer<typeof counts>;
/** What one Decisions request reported; absent when selection stayed local. */
export interface DecisionsUse {
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  totalTokens: number;
  apiMs?: number;
}
const usageSchema = z.strictObject({
  schemaVersion: z.literal(1),
  total: counts,
  days: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), counts),
  lastUsedAt: z.string().optional(),
});
const USAGE_DAYS = 30;
const zero = (): Counts => ({
  search: 0,
  read: 0,
  select: 0,
  decisions: 0,
  inputTokens: 0,
  cachedTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  apiMs: 0,
  apiCalls: 0,
});
const day = (at: Date) => at.toISOString().slice(0, 10);
const usageOff = () => /^(?:0|false|off)$/i.test(process.env.APEXREST_USAGE ?? '');
/** Local records never create APEXREST_HOME: a machine without one stays untouched. */
const recordable = async () => !usageOff() && (await exists(managedHome()));

async function readUsage() {
  const file = usageFile();
  try {
    return (await exists(file))
      ? parse(usageSchema, await readJson(file))
      : { schemaVersion: 1 as const, total: zero(), days: {} };
  } catch {
    // A damaged counter file starts over; counts are informational only.
    return { schemaVersion: 1 as const, total: zero(), days: {} };
  }
}

/** Count one successful catalog call. Best effort: counting never fails the operation. */
export async function recordCatalogUse(
  kind: CatalogUse,
  decisions = false,
  at = new Date(),
  api?: DecisionsUse,
) {
  if (!(await recordable())) return;
  try {
    await withLock(path.join(managedHome(), 'catalog-usage.lock'), async () => {
      const usage = await readUsage();
      const today = day(at);
      const bucket = (usage.days[today] ??= zero());
      for (const target of [usage.total, bucket]) {
        target[kind]++;
        if (decisions) target.decisions++;
        if (api) {
          target.inputTokens += api.inputTokens;
          target.cachedTokens += api.cachedTokens;
          target.outputTokens += api.outputTokens;
          target.totalTokens += api.totalTokens;
          if (api.apiMs !== undefined) {
            target.apiMs += Math.round(api.apiMs);
            target.apiCalls++;
          }
        }
      }
      const kept = Object.keys(usage.days).sort().slice(-USAGE_DAYS);
      usage.days = Object.fromEntries(kept.map((d) => [d, usage.days[d]!]));
      usage.lastUsedAt = at.toISOString();
      await writeJson(usageFile(), usage);
    });
  } catch {
    /* informational only */
  }
}

export async function catalogUsage(now = new Date()) {
  const usage = await readUsage();
  const today = usage.days[day(now)] ?? zero();
  const since = day(new Date(now.getTime() - 6 * 86400000));
  const week = zero();
  for (const [d, c] of Object.entries(usage.days))
    if (d >= since) for (const k of Object.keys(week) as (keyof Counts)[]) week[k] += c[k];
  return {
    recording: !usageOff(),
    today,
    last7Days: week,
    total: usage.total,
    ...(usage.lastUsedAt ? { lastUsedAt: usage.lastUsedAt } : {}),
  };
}

/** Record counts of the bundled catalogs. Reads only the shipped index files. */
export async function catalogInfo() {
  const count = async (...parts: string[]) => {
    try {
      const value = JSON.parse(await readFile(path.join(resourceRoot(), ...parts), 'utf8')) as unknown;
      return Array.isArray(value) ? value.length : 0;
    } catch {
      return 0;
    }
  };
  return {
    references: {
      '26.1': await count('references', 'index.json'),
      '26.2': await count('references', '26.2', 'index.json'),
    },
    components: await count('components', 'index.json'),
    patterns: await count('patterns', 'index.json'),
  };
}

/* ---------- Operation timings ---------- */

const timingEntry = z.strictObject({
  count: z.number().int().min(0),
  failed: z.number().int().min(0),
  totalMs: z.number().int().min(0),
  maxMs: z.number().int().min(0),
  lastMs: z.number().int().min(0),
  sqlclMs: z.number().int().min(0),
  lastAt: z.string(),
  lastOk: z.boolean(),
});
const timingsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  operations: z.record(z.string().regex(/^[a-z][a-z0-9.-]{0,60}$/), timingEntry),
});
const timingsFile = () => path.join(managedHome(), 'operation-timings.json');
const MAX_OPERATIONS = 100;

async function readTimings() {
  try {
    const file = timingsFile();
    return (await exists(file))
      ? parse(timingsSchema, await readJson(file))
      : { schemaVersion: 1 as const, operations: {} };
  } catch {
    return { schemaVersion: 1 as const, operations: {} };
  }
}

/** Add one finished operation to the local timing totals. Best effort, local only. */
export async function recordOperationTiming(
  operation: string,
  durationMs: number,
  ok: boolean,
  sqlclMs = 0,
  at = new Date(),
) {
  if (!/^[a-z][a-z0-9.-]{0,60}$/.test(operation) || !(await recordable())) return;
  try {
    await withLock(path.join(managedHome(), 'operation-timings.lock'), async () => {
      const timings = await readTimings();
      const ms = Math.max(0, Math.round(durationMs));
      const entry = (timings.operations[operation] ??= {
        count: 0,
        failed: 0,
        totalMs: 0,
        maxMs: 0,
        lastMs: 0,
        sqlclMs: 0,
        lastAt: at.toISOString(),
        lastOk: ok,
      });
      entry.count++;
      if (!ok) entry.failed++;
      entry.totalMs += ms;
      entry.maxMs = Math.max(entry.maxMs, ms);
      entry.lastMs = ms;
      entry.sqlclMs += Math.max(0, Math.round(sqlclMs));
      entry.lastAt = at.toISOString();
      entry.lastOk = ok;
      // Keep the most recently used operations when an old file grows past the bound.
      const names = Object.keys(timings.operations)
        .sort((a, b) => timings.operations[b]!.lastAt.localeCompare(timings.operations[a]!.lastAt))
        .slice(0, MAX_OPERATIONS);
      timings.operations = Object.fromEntries(names.map((n) => [n, timings.operations[n]!]));
      await writeJson(timingsFile(), timings);
    });
  } catch {
    /* informational only */
  }
}

/** Timing totals per operation, most recently run first. */
export async function operationTimings() {
  const { operations } = await readTimings();
  return Object.entries(operations)
    .map(([operation, e]) => ({
      operation,
      count: e.count,
      failed: e.failed,
      averageMs: e.count ? Math.round(e.totalMs / e.count) : 0,
      maxMs: e.maxMs,
      lastMs: e.lastMs,
      averageSqlclMs: e.count ? Math.round(e.sqlclMs / e.count) : 0,
      lastAt: e.lastAt,
      lastOk: e.lastOk,
    }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/* ---------- Recent projects ---------- */

const recentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  projects: z
    .array(
      z.strictObject({
        path: z.string().min(1).max(4096),
        projectId: z.string().max(200).optional(),
        at: z.string(),
      }),
    )
    .max(20),
});
const RECENT_LIMIT = 10;

/** Remember the project an operation ran in. Best effort, local only. */
export async function recordProject(root: string, projectId?: string, at = new Date()) {
  if (!path.isAbsolute(root) || !(await recordable())) return;
  try {
    await withLock(path.join(managedHome(), 'recent-projects.lock'), async () => {
      const file = recentFile();
      let projects: z.infer<typeof recentSchema>['projects'] = [];
      try {
        if (await exists(file)) projects = parse(recentSchema, await readJson(file)).projects;
      } catch {
        projects = [];
      }
      const entry = { path: root, ...(projectId ? { projectId } : {}), at: at.toISOString() };
      projects = [entry, ...projects.filter((p) => p.path !== root)].slice(0, RECENT_LIMIT);
      await writeJson(file, { schemaVersion: 1, projects });
    });
  } catch {
    /* informational only */
  }
}

export async function recentProjects() {
  try {
    const file = recentFile();
    if (!(await exists(file))) return [];
    const projects = parse(recentSchema, await readJson(file)).projects;
    // Drop folders that no longer hold a project.
    const live = [];
    for (const p of projects) if (await exists(path.join(p.path, 'apexrest.json'))) live.push(p);
    return live;
  } catch {
    return [];
  }
}

/** Everything the settings view shows. No database, network or credential read. */
export async function settingsStatus() {
  const settings = await globalSettings();
  const decision = settings.decisionApi;
  const keyEnv = decision?.apiKeyEnv ?? 'OPENAI_API_KEY';
  return {
    file: settingsFile(),
    settings,
    decisionApi: {
      enabled: decision?.enabled ?? false,
      apiKeyEnv: keyEnv,
      timeoutMs: decision?.timeoutMs ?? 3000,
      // Presence only; the value is never read into the result.
      keyInEnvironment: Boolean(process.env[keyEnv]?.trim()),
      note: 'A project decisionApi in apexrest.json overrides this default.',
    },
    catalog: {
      enabled: settings.catalog?.enabled !== false,
      ...(await catalogInfo()),
      usage: await catalogUsage(),
    },
    recentProjects: await recentProjects(),
    timings: await operationTimings(),
  };
}
