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
 * The projects APEXREST last worked in live beside it in recent-projects.json, which
 * never leaves the machine.
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

const usageOff = () => /^(?:0|false|off)$/i.test(process.env.APEXREST_USAGE ?? '');
/** Local records never create APEXREST_HOME: a machine without one stays untouched. */
const recordable = async () => !usageOff() && (await exists(managedHome()));

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
    },
    recentProjects: await recentProjects(),
  };
}
