import path from 'node:path';
import { lstat, readFile } from 'node:fs/promises';
import { canonical, hash } from '../../core/src/fs.ts';
import { Fault } from '../../core/src/result.ts';

const MARKET = 'apexrest';
const PLUGIN = 'apexrest-apex@apexrest';
const LIMIT = 1024 * 1024;
type Scalar = string | boolean | number | string[];
export interface ForeignConfigSnapshot {
  file: string;
  wholeSha256: string;
  /** All foreign content bytes, excluding leading blank table-separator lines. */
  foreignContentSha256: string;
  foreignRegistrySha256: string;
  apexrest?: { source_type: 'local'; source: string };
}

const unsupported = (): never => {
  throw new Fault(
    'CODEX_CONFIG_SNAPSHOT_UNAVAILABLE',
    'Scoped Codex registration requires a regular, bounded config.toml with supported unambiguous registry tables. Inspect the current profile and any saved transition before retrying.',
    3,
    'blocked',
  );
};

/** Single-line TOML subset only. Unknown syntax must never widen the owned byte range. */
function uncomment(line: string) {
  let quote = '',
    escaped = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quote) {
      if (escaped) escaped = false;
      else if (quote === '"' && ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '#') return line.slice(0, i);
  }
  if (quote) unsupported();
  return line;
}

function keyPath(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest) {
    const match = /^("(?:[^"\\]|\\.)*"|'[^']*'|[A-Za-z0-9_-]+)\s*/u.exec(rest);
    if (!match) return unsupported();
    const raw = match[1]!;
    const value = raw[0] === '"' ? (JSON.parse(raw) as unknown) : raw[0] === "'" ? raw.slice(1, -1) : raw;
    if (typeof value !== 'string') return unsupported();
    parts.push(value);
    rest = rest.slice(match[0].length);
    if (!rest) break;
    if (!rest.startsWith('.')) unsupported();
    rest = rest.slice(1).trimStart();
    if (!rest) unsupported();
  }
  if (!parts.length) unsupported();
  return parts;
}

function valueOf(text: string): Scalar {
  if (text.startsWith("'") && text.endsWith("'") && !text.slice(1, -1).includes("'"))
    return text.slice(1, -1);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return unsupported();
  }
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value as string[];
  return unsupported();
}

/** Hash foreign content and independently project registry values; retain no secrets. */
export async function snapshotForeignConfig(
  codexHome: string,
  allowOwnedRemoval = false,
): Promise<ForeignConfigSnapshot> {
  const file = path.join(codexHome, 'config.toml');
  try {
    const before = await lstat(file);
    if (!before.isFile() || before.isSymbolicLink() || before.size > LIMIT) unsupported();
    const bytes = await readFile(file);
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return unsupported();
    const after = await lstat(file);
    if (
      bytes.length > LIMIT ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs
    )
      return unsupported();
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.includes('"""') || text.includes("'''")) unsupported();
    const registries: Record<string, Record<string, Scalar>> = {};
    const foreign: string[] = [];
    let table: string[] = [],
      owned = false;
    for (const line of text.match(/[^\n]*\n|[^\n]+$/gu) ?? []) {
      const clean = uncomment(line.replace(/\r?\n$/u, '')).trim();
      if (clean.startsWith('[')) {
        const array = clean.startsWith('[[');
        if (!(array ? clean.endsWith(']]') : clean.endsWith(']'))) unsupported();
        table = keyPath(clean.slice(array ? 2 : 1, array ? -2 : -1));
        const registry = table[0] === 'marketplaces' || table[0] === 'plugins';
        if (registry && (array || table.length !== 2)) unsupported();
        owned =
          (table[0] === 'marketplaces' && table[1] === MARKET) ||
          (table[0] === 'plugins' && table[1] === PLUGIN);
        if (registry) {
          const key = canonical(table);
          if (registries[key]) unsupported();
          registries[key] = {};
        }
      } else if (clean && (table[0] === 'marketplaces' || table[0] === 'plugins')) {
        const at = clean.indexOf('=');
        if (at < 1) unsupported();
        const keys = keyPath(clean.slice(0, at));
        if (keys.length !== 1) unsupported();
        const key = keys[0]!;
        const allowed =
          table[0] === 'marketplaces' ? ['source_type', 'source', 'ref', 'sparse_paths'] : ['enabled'];
        if (!allowed.includes(key)) unsupported();
        const values = registries[canonical(table)]!;
        if (Object.hasOwn(values, key)) unsupported();
        values[key] = valueOf(clean.slice(at + 1).trim());
      }
      if (!owned) foreign.push(line);
    }
    const own = registries[canonical(['marketplaces', MARKET])];
    if (!own && !allowOwnedRemoval) return unsupported();
    if (
      own &&
      (own.source_type !== 'local' || typeof own.source !== 'string' || !path.isAbsolute(own.source))
    )
      return unsupported();
    delete registries[canonical(['marketplaces', MARKET])];
    delete registries[canonical(['plugins', PLUGIN])];
    return {
      file,
      wholeSha256: hash(bytes),
      // Codex may leave a leading blank separator when removing an owned first table.
      // Preserve comments, values and every other byte; only these initial blank lines normalize.
      foreignContentSha256: hash(foreign.join('').replace(/^(?:[ \t]*\r?\n)+/u, '')),
      foreignRegistrySha256: hash(canonical(registries)),
      ...(own ? { apexrest: { source_type: 'local' as const, source: own.source as string } } : {}),
    };
  } catch (error) {
    if (error instanceof Fault) throw error;
    return unsupported();
  }
}
