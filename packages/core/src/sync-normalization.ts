import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { canonical, contained } from './fs.ts';

/** One local source file that sync init may replace with the server's equivalent bytes. */
export interface SourceNormalization {
  file: string;
  rule: 'deployment-app-id-target' | 'empty-deinstall-script';
  action: 'replaced' | 'removed';
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
