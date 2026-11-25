import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import type { ProjectContext } from '../config.ts';
import { contained, exists } from '../fs.ts';
import { Fault } from '../result.ts';
import { sourceRelease } from '../partial-import.ts';
import type { SourceChange } from '../revision.ts';
import {
  ApexLangDocument,
  applyEdits,
  digestOf,
  parseApexLang,
  readProperty,
  removeComponent,
  scalarText,
  setFencedText,
  setProperty,
  type ComponentNode,
  type TextEdit,
} from './apexlang-edit.ts';
import { guardedEdit } from './transaction.ts';

/**
 * Shared LOV editing (`project action:lov_context` / `lov_edit`). The LOV is located by its id or
 * `name` in the release's qualified layout — 26.2: one `lov` per `shared-components/lovs/*.apx`
 * file; 26.1: every `lov` in `shared-components/lovs.apx` — and edited in place: static entries are
 * replaced as a complete ordered list (entries keep their id and bytes when their return value is
 * kept), or a SQL-query LOV gets complete caller-supplied SQL. Other declarations in the same file
 * keep their bytes. A shared LOV is shared-component scope: consumers found in page sources are
 * listed, but the change is never reported as page-only, and Oracle's page-only scoped export is
 * not extended to it.
 */

export interface LovEntry {
  display: string;
  return: string;
}
export interface LovEditInput {
  lov: string;
  /** Static LOV: every entry in display order. */
  entries?: LovEntry[] | undefined;
  /** SQL-query LOV: complete replacement SQL, optionally with its display and return columns. */
  query?: { sql: string; display?: string | undefined; return?: string | undefined } | undefined;
  expectedDigest?: string | undefined;
  dryRun?: boolean | undefined;
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 60) || 'entry';

/** Candidate files of the release's qualified layout, relative to the application root. */
async function lovFiles(app: string, release: string | null): Promise<string[]> {
  if (release === '26.1') {
    const file = 'shared-components/lovs.apx';
    return (await exists(path.join(app, file))) ? [file] : [];
  }
  if (release !== '26.2')
    throw new Fault(
      'LAYOUT_UNSUPPORTED',
      'Shared LOV editing needs an Oracle-generated 26.1 or 26.2 application.',
      2,
    );
  const dir = path.join(app, 'shared-components/lovs');
  if (!(await exists(dir))) return [];
  return (await readdir(dir))
    .filter((name) => name.endsWith('.apx'))
    .sort()
    .map((name) => `shared-components/lovs/${name}`);
}

interface Located {
  app: string;
  file: string;
  relative: string;
  source: string;
  doc: ApexLangDocument;
  node: ComponentNode;
}

async function locate(ctx: ProjectContext, key: string): Promise<Located> {
  const app = await contained(ctx.root, ctx.config.application.sourceDir);
  const release = await sourceRelease(app);
  const matches: Located[] = [];
  for (const name of await lovFiles(app, release)) {
    const file = path.join(app, name);
    const source = await readFile(file, 'utf8');
    if (!/^\s*lov\s/mu.test(source)) continue;
    const doc = new ApexLangDocument(source);
    const lovs = doc.roots.filter((root) => root.kind === 'lov');
    if (release === '26.2' && lovs.length > 1)
      throw new Fault(
        'LAYOUT_UNSUPPORTED',
        `${name} declares ${lovs.length} LOVs; 26.2 keeps one per file.`,
        2,
      );
    for (const node of lovs) {
      const named = String(node.properties.get('name')?.value ?? '').replace(/^"|"$/gu, '');
      if (node.key.toUpperCase() === key.toUpperCase() || named.toUpperCase() === key.toUpperCase())
        matches.push({
          app,
          file,
          relative: path.relative(ctx.root, file).split(path.sep).join('/'),
          source,
          doc,
          node,
        });
    }
  }
  if (matches.length !== 1)
    throw new Fault(
      matches.length ? 'TARGET_AMBIGUOUS' : 'TARGET_NOT_FOUND',
      matches.length ? `Several shared LOVs match ${key}.` : `No shared LOV ${key}.`,
      matches.length ? 5 : 2,
    );
  return matches[0]!;
}

/** Page files that reference the LOV by `@id` (`lov { type: sharedComponent  lov: @id }` and the like). */
async function consumers(app: string, id: string): Promise<string[]> {
  const dir = path.join(app, 'pages');
  if (!(await exists(dir))) return [];
  const pattern = new RegExp(`^\\s*lov:\\s*@${id.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\s*$`, 'mu');
  const pages: string[] = [];
  for (const name of (await readdir(dir)).filter((file) => file.endsWith('.apx')).sort()) {
    const page = /^p(\d{1,5})/u.exec(name);
    if (page && pattern.test(await readFile(path.join(dir, name), 'utf8')))
      pages.push(String(Number(page[1])));
  }
  return pages;
}

function describe(located: Pick<Located, 'source' | 'relative' | 'node'>) {
  const parsed = parseApexLang(located.source, located.relative).find(
    (c) => c.type === 'lov' && c.id === located.node.key,
  )!;
  const text = (dotted: string) => {
    const value = readProperty(parsed, dotted);
    return typeof value === 'string' && value ? value : undefined;
  };
  const entries = parsed.children
    .filter((c) => c.type === 'entry')
    .map((entry) => ({
      id: entry.id,
      sequence: Number(readProperty(entry, 'sequence')) || 0,
      display: String(readProperty(entry, 'display') ?? ''),
      return: String(readProperty(entry, 'return') ?? ''),
    }))
    .sort((a, b) => a.sequence - b.sequence);
  return {
    id: parsed.id,
    name: text('name'),
    location: text('source.location'),
    type: text('source.type'),
    ...(entries.length ? { entries } : {}),
    ...(text('source.sqlQuery') ? { query: text('source.sqlQuery') } : {}),
    ...(text('columnMapping.display') ? { display: text('columnMapping.display') } : {}),
    ...(text('columnMapping.return') ? { return: text('columnMapping.return') } : {}),
  };
}

/** The file declaring a shared LOV (by id or name) in the qualified layout. */
export async function lovFile(ctx: ProjectContext, key: string): Promise<string> {
  return (await locate(ctx, key)).file;
}

export async function lovContext(ctx: ProjectContext, key: string) {
  const located = await locate(ctx, key);
  return {
    file: located.relative,
    digest: digestOf(located.source),
    lov: describe(located),
    consumers: await consumers(located.app, located.node.key),
    scope: 'sharedComponent' as const,
    next: 'Edit with project action:lov_edit and this digest.',
  };
}

function plan(located: Located, input: LovEditInput): string {
  const { doc, node } = located;
  if (Boolean(input.entries) === Boolean(input.query))
    throw new Fault('INVALID_INPUT', 'Give entries (static LOV) or query (SQL LOV).', 2);
  const location = String(node.properties.get('source.location')?.value ?? '');
  const edits: TextEdit[] = [];
  if (input.entries) {
    if (location !== 'staticValues')
      throw new Fault('OPERATION_UNSUPPORTED', `${node.key} is not a static LOV (${location}).`, 2);
    if (!input.entries.length || input.entries.length > 500)
      throw new Fault('INVALID_INPUT', 'Give 1-500 entries.', 2);
    const returns = input.entries.map((entry) => entry.return);
    if (new Set(returns).size !== returns.length)
      throw new Fault('INVALID_INPUT', 'Entry return values must be unique.', 2);
    const existing = node.children.filter((child) => child.kind === 'entry');
    if (node.children.some((child) => child.kind !== 'entry'))
      throw new Fault(
        'OPERATION_UNSUPPORTED',
        `${node.key} has components other than entries; edit it in source.`,
        2,
      );
    const returnOf = (entry: ComponentNode) => String(entry.properties.get('return')?.value ?? '');
    const ids = new Set(existing.map((entry) => entry.key.toLowerCase()));
    let added = '';
    input.entries.forEach((entry, index) => {
      const sequence = String(index + 1);
      const kept = existing.find((current) => unquote(returnOf(current)) === entry.return);
      if (kept) {
        if (unquote(String(kept.properties.get('display')?.value ?? '')) !== entry.display)
          edits.push(setProperty(doc, kept, 'display', entry.display));
        if (String(kept.properties.get('sequence')?.value ?? '') !== sequence)
          edits.push(setProperty(doc, kept, 'sequence', sequence));
        return;
      }
      let id = slug(entry.return);
      for (let n = 2; ids.has(id); n++) id = `${slug(entry.return)}-${n}`;
      ids.add(id);
      const indent = ' '.repeat(node.indent + 4);
      added +=
        [
          `entry ${id} (`,
          `    sequence: ${sequence}`,
          `    display: ${scalarText(entry.display)}`,
          `    return: ${scalarText(entry.return)}`,
          ')',
        ]
          .map((line) => indent + line)
          .join(doc.eol) + doc.eol;
    });
    for (const entry of existing)
      if (!returns.includes(unquote(returnOf(entry)))) edits.push(removeComponent(doc, entry));
    if (added) {
      const last = existing.at(-1);
      const line = doc.lines[last ? last.close : node.close]!;
      const at = last ? line.offset + line.text.length + line.eol.length : line.offset;
      edits.push({ start: at, end: at, content: added });
    }
  } else {
    const query = input.query!;
    if (location !== 'localDatabase' || String(node.properties.get('source.type')?.value) !== 'sqlQuery')
      throw new Fault('OPERATION_UNSUPPORTED', `${node.key} is not a local SQL query LOV.`, 2);
    if (!/^\s*(select|with)\b/iu.test(query.sql))
      throw new Fault('INVALID_INPUT', 'Supply a SELECT query.', 2);
    const property = node.properties.get('source.sqlQuery');
    edits.push(
      property?.fence
        ? setFencedText(doc, node, 'source.sqlQuery', query.sql)
        : setProperty(doc, node, 'source.sqlQuery', query.sql),
    );
    if (query.display)
      edits.push(setProperty(doc, node, 'columnMapping.display', query.display.toUpperCase()));
    if (query.return) edits.push(setProperty(doc, node, 'columnMapping.return', query.return.toUpperCase()));
  }
  const result = applyEdits(located.source, edits);
  // The result parses, the scanner still accepts it, and the LOV reads back as requested.
  let after;
  try {
    after = describe({ source: result, relative: located.relative, node });
  } catch (error) {
    throw new Fault('TRANSFORM_INVALID', `The edited LOV does not parse: ${(error as Error).message}`, 5);
  }
  new ApexLangDocument(result);
  if (input.entries) {
    const read = (after.entries ?? []).map((entry) => [entry.display, entry.return]);
    if (JSON.stringify(read) !== JSON.stringify(input.entries.map((entry) => [entry.display, entry.return])))
      throw new Fault('TRANSFORM_INVALID', `${node.key} entries did not read back.`, 5);
  } else if (String(after.query ?? '').trim() !== input.query!.sql.trim())
    throw new Fault('TRANSFORM_INVALID', `${node.key} query did not read back.`, 5);
  return result;
}
const unquote = (value: string) => {
  if (!value.startsWith('"')) return value;
  try {
    return JSON.parse(value) as string;
  } catch {
    return value;
  }
};

export async function lovEdit(ctx: ProjectContext, input: LovEditInput) {
  const first = await locate(ctx, input.lov);
  const outcome = await guardedEdit(ctx, {
    file: first.file,
    relative: first.relative,
    expectedDigest: input.expectedDigest,
    dryRun: input.dryRun,
    plan: async () => {
      const located = await locate(ctx, input.lov);
      if (located.file !== first.file)
        throw new Fault('TRANSFORM_CONFLICT', `${input.lov} moved to ${located.relative}; read it again.`, 5);
      return {
        source: located.source,
        digest: digestOf(located.source),
        result: plan(located, input),
        node: located.node,
      };
    },
  });
  const { planned } = outcome;
  const pages = await consumers(first.app, first.node.key);
  return {
    file: first.relative,
    beforeDigest: planned.digest,
    afterDigest: digestOf(planned.result),
    written: outcome.written,
    ...(outcome.change ? { change: outcome.change as SourceChange } : {}),
    lov: describe({ source: planned.result, relative: first.relative, node: planned.node }),
    digest: digestOf(planned.result),
    // Shared-component scope: these pages use the LOV, but other references (PL/SQL, columns of
    // other components) are not resolved, so the change is never reported as page-only.
    scope: 'sharedComponent' as const,
    consumers: pages,
    next: outcome.written
      ? 'Source edited only. Ship with importMode auto or full; a shared LOV is not a page-only change.'
      : `Apply with expectedDigest ${planned.digest}.`,
  };
}
