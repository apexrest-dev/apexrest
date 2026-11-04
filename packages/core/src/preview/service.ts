import fs from 'node:fs';
import path from 'node:path';
import { loadProject } from '../config.ts';
import { Fault } from '../result.ts';
import { APEX_DOWNLOAD_URL, APEX_FULL_VERSION, defaultAssetsDir, loadAssets, setupAssets } from './assets.ts';
import type { Diagnostic } from './render.ts';
import { connectOracle } from './oracle/connect.ts';
import { checkApplication, PreviewServer } from './server.ts';
import {
  onPreviewShutdown,
  otherPreviews,
  registerPreview,
  stopOtherPreview,
  unregisterPreview,
  type PreviewEntry,
} from './registry.ts';

const running = new Map<string, PreviewServer>();
onPreviewShutdown(async () => {
  for (const [source, server] of [...running]) await stopServer(source, server);
});
const DIAGNOSTICS_LIMIT = 60;

/** Explicit sourceDir, else apexrest.json application.sourceDir, else a folder that holds application.apx. */
async function resolveSource(root: string, explicit: string | undefined): Promise<string> {
  let source = explicit ? path.resolve(root, explicit) : undefined;
  if (!source) {
    try {
      const ctx = await loadProject(root);
      source = path.resolve(ctx.root, ctx.config.application.sourceDir);
    } catch {
      source = path.resolve(root);
    }
  }
  if (!fs.existsSync(path.join(source, 'application.apx')))
    throw new Fault(
      'PREVIEW_SOURCE_MISSING',
      `${source} has no application.apx. Pass sourceDir with the APEXlang application folder.`,
      2,
    );
  return fs.realpathSync(source);
}

/**
 * Preview data for a project's own application: the SQLite file under `.apexrest/preview/` and seeds
 * from the migrations (schema; PL/SQL units are skipped) followed by `<project>/.apex-local/*.sql`.
 * Nothing is written inside the deployed source tree. A legacy `<sourceDir>/.apex-local` keeps priority.
 */
async function projectData(
  root: string,
  sourceDir: string,
): Promise<{ database?: string; seedDirs?: string[] }> {
  if (fs.existsSync(path.join(sourceDir, '.apex-local'))) return {};
  let ctx;
  try {
    ctx = await loadProject(root);
  } catch {
    return {};
  }
  const appDir = path.resolve(ctx.root, ctx.config.application.sourceDir);
  if (!fs.existsSync(appDir) || fs.realpathSync(appDir) !== sourceDir) return {};
  return {
    database: path.join(ctx.root, '.apexrest', 'preview', 'preview.sqlite'),
    seedDirs: [path.resolve(ctx.root, ctx.config.database.migrationsDir), path.join(ctx.root, '.apex-local')],
  };
}

function summarize(diagnostics: Diagnostic[]) {
  const count = (level: Diagnostic['level']) => diagnostics.filter((entry) => entry.level === level).length;
  const ranked = [...diagnostics].sort(
    (a, b) => ['error', 'warning', 'info'].indexOf(a.level) - ['error', 'warning', 'info'].indexOf(b.level),
  );
  return {
    counts: { error: count('error'), warning: count('warning'), info: count('info') },
    diagnostics: ranked.slice(0, DIAGNOSTICS_LIMIT),
    truncated: diagnostics.length > DIAGNOSTICS_LIMIT,
  };
}

function assetsReady(assetsDir: string | undefined): void {
  try {
    loadAssets(assetsDir);
  } catch (error) {
    throw new Fault('PREVIEW_ASSETS_MISSING', (error as Error).message, 3, 'blocked', {
      nextActions: [
        'Run apexrest preview setup (downloads the APEX 26.2 distribution once) or pass --zip with a local apex_26.2 zip.',
      ],
    });
  }
}

export async function previewSetup(input: {
  zip?: string | undefined;
  assetsDir?: string | undefined;
  sha256?: string | undefined;
}) {
  const assets = await setupAssets({
    ...(input.assetsDir ? { assetsDir: input.assetsDir } : {}),
    ...(input.zip ? { zipPath: input.zip } : {}),
    ...(input.sha256 ? { expectedSha256: input.sha256 } : {}),
    onProgress: (message) => process.stderr.write(`[preview] ${message}\n`),
  });
  return {
    assetsDir: assets.dir,
    apexVersion: assets.manifest.apexVersion,
    files: assets.manifest.files,
    sha256: assets.manifest.sha256,
    source: assets.manifest.source,
    templates: assets.theme.length,
  };
}

export async function previewStart(
  root: string,
  input: {
    sourceDir?: string | undefined;
    assetsDir?: string | undefined;
    port?: number | undefined;
    reset?: boolean | undefined;
    sampleRows?: number | undefined;
    user?: string | undefined;
    toolbar?: boolean | undefined;
    env?: string | undefined;
  },
) {
  const sourceDir = await resolveSource(root, input.sourceDir);
  assetsReady(input.assetsDir);
  const previous = running.get(sourceDir);
  if (
    previous &&
    !input.reset &&
    input.port === undefined &&
    (previous.options.oracle?.environment ?? undefined) === input.env
  )
    return describe(previous, true);
  if (previous) await stopServer(sourceDir, previous);
  const oracle = input.env ? await connectOracle(root, input.env) : undefined;
  const data = await projectData(root, sourceDir);
  const server = new PreviewServer({
    ...(oracle ? { oracle } : {}),
    ...(data.seedDirs ? { seedDirs: data.seedDirs } : {}),
    ...(data.database && !oracle ? { database: data.database } : {}),
    sourceDir,
    ...(input.assetsDir ? { assetsDir: input.assetsDir } : {}),
    ...(input.port === undefined ? {} : { port: input.port }),
    ...(input.reset ? { reset: true } : {}),
    ...(input.sampleRows === undefined ? {} : { sampleRows: input.sampleRows }),
    ...(input.user ? { user: input.user } : {}),
    ...(input.toolbar === undefined ? {} : { toolbar: input.toolbar }),
  });
  await server.start();
  running.set(sourceDir, server);
  const address = new URL(server.url);
  registerPreview({
    port: Number(address.port),
    host: address.hostname.replace(/^\[|\]$/g, ''),
    url: server.url,
    sourceDir,
    ...(server.options.oracle ? { environment: server.options.oracle.environment } : {}),
  });
  return describe(server, false);
}

async function stopServer(sourceDir: string, server: PreviewServer): Promise<void> {
  let port: number | undefined;
  try {
    port = Number(new URL(server.url).port);
  } catch {
    // Already stopped.
  }
  await server.stop();
  running.delete(sourceDir);
  if (port !== undefined) unregisterPreview(port);
}

function describe(server: PreviewServer, reused: boolean) {
  return {
    url: server.url,
    reused,
    sourceDir: server.options.sourceDir,
    database: server.db.file,
    apexVersion: APEX_FULL_VERSION,
    pages: server.pages(),
    note: server.options.oracle
      ? `Connected preview: application data and PL/SQL run in Oracle environment ${server.options.oracle.environment} (${server.options.oracle.target}); every request is rolled back. Rendering is still simulated; not import or browser evidence.`
      : 'Local simulation with Universal Theme 26.2 assets and SQLite. Not Oracle evidence; PL/SQL beyond the local interpreter is skipped.',
    data: server.options.oracle
      ? {
          mode: 'oracle',
          environment: server.options.oracle.environment,
          target: server.options.oracle.target,
        }
      : { mode: 'sqlite' },
    ...summarize(server.diagnostics()),
  };
}

interface PreviewSelector {
  project?: string | undefined;
  sourceDir?: string | undefined;
  port?: number | undefined;
}

interface Listed {
  url: string;
  port: number;
  sourceDir: string;
  pid: number;
  owner: PreviewEntry['owner'] | 'this-process';
  environment?: string;
  entry?: PreviewEntry;
  server?: PreviewServer;
}

/** In-process servers first, then live servers of other processes from the registry. */
async function listPreviews(): Promise<Listed[]> {
  const local: Listed[] = [...running].map(([sourceDir, server]) => ({
    url: server.url,
    port: Number(new URL(server.url).port),
    sourceDir,
    pid: process.pid,
    owner: 'this-process' as const,
    ...(server.options.oracle ? { environment: server.options.oracle.environment } : {}),
    server,
  }));
  const others: Listed[] = (await otherPreviews()).map((entry) => ({
    url: entry.url,
    port: entry.port,
    sourceDir: entry.sourceDir,
    pid: entry.pid,
    owner: entry.owner,
    ...(entry.environment ? { environment: entry.environment } : {}),
    entry,
  }));
  return [...local, ...others];
}

/**
 * Builds a filter from the selectors: sourceDir matches that application folder exactly, project
 * alone matches every preview whose folder lies inside the project, port matches the port. With no
 * selector, stop targets the project's own application (as before) and status lists everything.
 */
async function selector(root: string, input: PreviewSelector, fallback: 'project-source' | 'all') {
  const tests: ((entry: Listed) => boolean)[] = [];
  const described: string[] = [];
  const none = input.sourceDir === undefined && input.project === undefined && input.port === undefined;
  if (input.sourceDir !== undefined || (fallback === 'project-source' && none)) {
    const source = await resolveSource(root, input.sourceDir);
    tests.push((entry) => entry.sourceDir === source);
    described.push(source);
  } else if (input.project !== undefined) {
    let projectRoot: string;
    try {
      projectRoot = fs.realpathSync(path.resolve(input.project));
    } catch {
      throw new Fault('INVALID_INPUT', `Project directory ${input.project} does not exist.`, 2);
    }
    tests.push(
      (entry) => entry.sourceDir === projectRoot || entry.sourceDir.startsWith(projectRoot + path.sep),
    );
    described.push(`project ${projectRoot}`);
  }
  if (input.port !== undefined) {
    const port = input.port;
    tests.push((entry) => entry.port === port);
    described.push(`port ${port}`);
  }
  return {
    match: (entry: Listed) => tests.every((check) => check(entry)),
    described: described.join(', '),
  };
}

const summaryOf = (entry: Listed) => ({
  url: entry.url,
  port: entry.port,
  sourceDir: entry.sourceDir,
  pid: entry.pid,
  owner: entry.owner,
  ...(entry.environment ? { environment: entry.environment } : {}),
  ...(entry.server ? summarize(entry.server.diagnostics()).counts : {}),
});

/**
 * Stops matching previews: in-process servers directly, CLI-owned servers of other processes by
 * SIGTERM (waiting for the port to close). Previews hosted by another MCP process are never
 * signalled. A stop that stops nothing fails (`not_found`, or `blocked` when only hosted ones match).
 */
export async function previewStop(root: string, input: PreviewSelector & { all?: boolean | undefined }) {
  const listed = await listPreviews();
  const filter = input.all ? undefined : await selector(root, input, 'project-source');
  const targets = filter ? listed.filter(filter.match) : listed;
  const stopped: string[] = [];
  const notStopped: { url: string; sourceDir: string; pid: number; reason: string }[] = [];
  let hosted = false;
  for (const target of targets) {
    if (target.server) {
      await stopServer(target.sourceDir, target.server);
      stopped.push(target.sourceDir);
    } else if (target.entry?.owner === 'cli') {
      if (await stopOtherPreview(target.entry)) stopped.push(target.sourceDir);
      else
        notStopped.push({
          url: target.url,
          sourceDir: target.sourceDir,
          pid: target.pid,
          reason: `Process ${target.pid} did not close port ${target.port} within 10 seconds.`,
        });
    } else {
      hosted = true;
      notStopped.push({
        url: target.url,
        sourceDir: target.sourceDir,
        pid: target.pid,
        reason: `Hosted by another APEXREST MCP process (pid ${target.pid}); stop it from that session with apexrest_preview action:stop.`,
      });
    }
  }
  if (!stopped.length && notStopped.length)
    throw new Fault(
      'PREVIEW_STOP_FAILED',
      notStopped.map((entry) => `${entry.url}: ${entry.reason}`).join(' '),
      hosted ? 5 : 1,
      hosted ? 'blocked' : 'failed',
    );
  if (!stopped.length) {
    const others = listed.map((entry) => `${entry.url} (${entry.sourceDir})`).join('; ');
    throw new Fault(
      'PREVIEW_NOT_RUNNING',
      `No running preview matches ${filter?.described || 'the selection'}; nothing was stopped.` +
        (others ? ` Running: ${others}.` : ' No preview is running.'),
      2,
      'not_found',
      {
        nextActions: [
          'Run apexrest preview status to list running previews with their source folders and ports.',
        ],
      },
    );
  }
  const remaining = (await listPreviews()).map((entry) => entry.sourceDir);
  return { stopped, ...(notStopped.length ? { notStopped } : {}), running: remaining };
}

/** Assets state and every running preview (this process and others), optionally filtered. */
export async function previewStatus(root = process.cwd(), input: PreviewSelector = {}) {
  const filter = await selector(root, input, 'all');
  return {
    assetsDir: defaultAssetsDir(),
    assetsInstalled: fs.existsSync(path.join(defaultAssetsDir(), 'manifest.json')),
    download: APEX_DOWNLOAD_URL,
    running: (await listPreviews()).filter(filter.match).map(summaryOf),
  };
}

export async function previewCheck(
  root: string,
  input: {
    sourceDir?: string | undefined;
    assetsDir?: string | undefined;
    pages?: string[] | undefined;
    sampleRows?: number | undefined;
    env?: string | undefined;
  },
) {
  const sourceDir = await resolveSource(root, input.sourceDir);
  assetsReady(input.assetsDir);
  const oracle = input.env ? await connectOracle(root, input.env) : undefined;
  const { seedDirs } = await projectData(root, sourceDir);
  const result = checkApplication({
    sourceDir,
    ...(oracle ? { oracle } : {}),
    ...(seedDirs ? { seedDirs } : {}),
    ...(input.assetsDir ? { assetsDir: input.assetsDir } : {}),
    ...(input.pages ? { pages: input.pages } : {}),
    ...(input.sampleRows === undefined ? {} : { sampleRows: input.sampleRows }),
    toolbar: false,
  });
  return { sourceDir, pages: result.pages, ...summarize(result.diagnostics) };
}

/** Routes the composite MCP tool and the granular CLI commands. */
export async function previewDispatch(operation: string, parsed: Record<string, unknown>, root: string) {
  const { action, ...input } = parsed as Record<string, never> & { action?: string };
  const selected = operation === 'preview' ? String(action) : operation.slice('preview.'.length);
  switch (selected) {
    case 'setup':
      return previewSetup(input);
    case 'start':
      return previewStart(root, input);
    case 'check':
      return previewCheck(root, input);
    case 'stop':
      return previewStop(root, input);
    case 'status':
      // The MCP tool always carries its project; its status keeps listing every running preview.
      return operation === 'preview'
        ? previewStatus(root, { sourceDir: input.sourceDir, port: input.port })
        : previewStatus(root, input);
    default:
      throw new Fault('INVALID_INPUT', `Unknown preview action: ${selected}`, 2);
  }
}
