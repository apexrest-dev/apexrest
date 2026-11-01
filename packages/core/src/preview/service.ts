import fs from 'node:fs';
import path from 'node:path';
import { loadProject } from '../config.ts';
import { Fault } from '../result.ts';
import { APEX_DOWNLOAD_URL, APEX_FULL_VERSION, defaultAssetsDir, loadAssets, setupAssets } from './assets.ts';
import type { Diagnostic } from './render.ts';
import { connectOracle } from './oracle/connect.ts';
import { checkApplication, PreviewServer } from './server.ts';

const running = new Map<string, PreviewServer>();
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
  if (previous) {
    await previous.stop();
    running.delete(sourceDir);
  }
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
  return describe(server, false);
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

export async function previewStop(root: string, input: { sourceDir?: string | undefined; all?: boolean }) {
  const targets = input.all ? [...running.keys()] : [await resolveSource(root, input.sourceDir)];
  const stopped: string[] = [];
  for (const target of targets) {
    const server = running.get(target);
    if (!server) continue;
    await server.stop();
    running.delete(target);
    stopped.push(target);
  }
  return { stopped, running: [...running.keys()] };
}

export async function previewStatus() {
  return {
    assetsDir: defaultAssetsDir(),
    assetsInstalled: fs.existsSync(path.join(defaultAssetsDir(), 'manifest.json')),
    download: APEX_DOWNLOAD_URL,
    running: [...running.values()].map((server) => ({
      url: server.url,
      sourceDir: server.options.sourceDir,
      ...summarize(server.diagnostics()).counts,
    })),
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
      return previewStatus();
    default:
      throw new Fault('INVALID_INPUT', `Unknown preview action: ${selected}`, 2);
  }
}
