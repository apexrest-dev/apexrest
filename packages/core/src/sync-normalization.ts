import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { canonical, contained } from './fs.ts';

/** One local source file that sync init may replace with the server's equivalent bytes. */
export interface SourceNormalization {
  file: string;
  rule: 'deployment-app-id-target' | 'empty-deinstall-script' | 'last-import-rewrite';
  action: 'replaced' | 'removed' | 'added';
}

/** How one local file differs from the inventory sync expected (the server export on init). */
export interface SourceDifference {
  file: string;
  /** added: only local; removed: only expected; changed: different bytes. */
  change: 'added' | 'removed' | 'changed';
}

/** Every file whose local bytes differ from the expected inventory, sorted by path. */
export function sourceDifferences(
  local: Record<string, string>,
  expected: Record<string, string>,
): SourceDifference[] {
  return [...new Set([...Object.keys(local), ...Object.keys(expected)])]
    .filter((file) => local[file] !== expected[file])
    .sort()
    .map((file) => ({
      file,
      change: !expected[file] ? 'added' : !local[file] ? 'removed' : 'changed',
    }));
}

/**
 * Oracle's import rewrites of sources this project imported itself, adopted file by file from
 * the server export. The caller must first prove that the local sources are exactly the last
 * successful full import to this target and that the server is unchanged since that import;
 * every difference is then Oracle's canonical form of the imported bytes.
 */
export function lastImportRewrites(
  local: Record<string, string>,
  server: Record<string, string>,
): SourceNormalization[] {
  return sourceDifferences(local, server).map(({ file, change }) => ({
    file,
    rule: 'last-import-rewrite' as const,
    action:
      change === 'added'
        ? ('removed' as const)
        : change === 'removed'
          ? ('added' as const)
          : ('replaced' as const),
  }));
}

const DEPLOYMENT_FILE = 'deployments/default.json';
const SUPPORTING_OBJECTS = 'supporting-objects/supporting-objects.apx';
const DEINSTALL_BLOCK = /^([ \t]*)deinstall \{\r?\n[ \t]*scriptFile: ([^\s]+)\r?\n\1\}\r?\n/mu;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The deployment JSON without app.id (and without an app object left empty by that). */
function withoutAppId(value: Record<string, unknown>) {
  const copy: Record<string, unknown> = structuredClone(value);
  if (isObject(copy.app)) {
    delete copy.app.id;
    if (!Object.keys(copy.app).length) delete copy.app;
  }
  return copy;
}

/**
 * Differences between freshly generated local sources and the server export of the same
 * application that Oracle introduces on import and that carry no meaning:
 *  - deployments/default.json gains `app.id`, equal to the configured application ID;
 *  - an empty deinstall script and its `deinstall { scriptFile }` reference are dropped.
 * Returns the files to adopt from the server, or undefined when any difference is outside
 * these two rules (the caller then keeps reporting a source conflict).
 */
export async function generatedSourceNormalizations(
  localRoot: string,
  serverRoot: string,
  local: Record<string, string>,
  server: Record<string, string>,
  applicationId: number,
): Promise<SourceNormalization[] | undefined> {
  const differing = [...new Set([...Object.keys(local), ...Object.keys(server)])]
    .filter((file) => local[file] !== server[file])
    .sort();
  const read = async (root: string, file: string) => readFile(await contained(root, file), 'utf8');
  const result: SourceNormalization[] = [];
  const explained = new Set<string>();

  if (differing.includes(DEPLOYMENT_FILE) && local[DEPLOYMENT_FILE] && server[DEPLOYMENT_FILE]) {
    let localJson: unknown, serverJson: unknown;
    try {
      localJson = JSON.parse(await read(localRoot, DEPLOYMENT_FILE));
      serverJson = JSON.parse(await read(serverRoot, DEPLOYMENT_FILE));
    } catch {
      return undefined;
    }
    if (!isObject(localJson) || !isObject(serverJson)) return undefined;
    const serverId = isObject(serverJson.app) ? serverJson.app.id : undefined;
    const localId = isObject(localJson.app) ? localJson.app.id : undefined;
    if (serverId !== applicationId || (localId !== undefined && localId !== applicationId)) return undefined;
    if (canonical(withoutAppId(localJson)) !== canonical(withoutAppId(serverJson))) return undefined;
    result.push({ file: DEPLOYMENT_FILE, rule: 'deployment-app-id-target', action: 'replaced' });
    explained.add(DEPLOYMENT_FILE);
  }

  if (differing.includes(SUPPORTING_OBJECTS) && local[SUPPORTING_OBJECTS] && server[SUPPORTING_OBJECTS]) {
    const localText = await read(localRoot, SUPPORTING_OBJECTS);
    const match = DEINSTALL_BLOCK.exec(localText);
    if (!match) return undefined;
    const script = path.posix.normalize(path.posix.join(path.posix.dirname(SUPPORTING_OBJECTS), match[2]!));
    if (script.startsWith('..') || !local[script] || server[script]) return undefined;
    if ((await read(localRoot, script)).trim() !== '') return undefined;
    const stripped = localText.slice(0, match.index) + localText.slice(match.index + match[0].length);
    if (stripped !== (await read(serverRoot, SUPPORTING_OBJECTS))) return undefined;
    result.push(
      { file: SUPPORTING_OBJECTS, rule: 'empty-deinstall-script', action: 'replaced' },
      { file: script, rule: 'empty-deinstall-script', action: 'removed' },
    );
    explained.add(SUPPORTING_OBJECTS).add(script);
  }

  return differing.every((file) => explained.has(file)) && result.length ? result : undefined;
}
