import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import type { ProjectContext } from '../config.ts';
import { atomicWrite, contained, withLock } from '../fs.ts';
import { Fault } from '../result.ts';
import { sourceInventory } from '../deploy.ts';
import { sourceChange, type SourceChange } from '../revision.ts';
import {
  ApexLangDocument,
  applyEdits,
  digestOf,
  parseApexLang,
  readProperty,
  setProperty,
  setFencedText,
  removeComponent,
  appendChild,
  scalarText,
  type ComponentNode,
  type TextEdit,
} from './apexlang-edit.ts';

/**
 * Semantic page edits (`project action:patch`): small, named property changes resolved through
 * stable component identities and applied to the page's own file without rewriting anything else.
 * The caller binds the change to the file digest it read; the digest is checked again under the
 * project's source-edit lock immediately before the atomic replace. Source-edit success says
 * nothing about preview, compiler or import results.
 */

export const PATCH_PROPERTIES = ['title', 'label', 'heading', 'format', 'sequence', 'query'] as const;
export type PatchProperty = (typeof PATCH_PROPERTIES)[number];
export interface PatchOperation {
  /** `page`, `region:ID`, `item:NAME`, `button:ID` or `column:REGION.COLUMN`. */
  target: string;
  property: PatchProperty;
  value: string;
  /** `query` only: the report's complete column contract after the change, in display order. */
  columns?: QueryColumn[] | undefined;
}
export interface QueryColumn {
  name: string;
  heading?: string | undefined;
  dataType?: 'varchar2' | 'number' | 'date' | 'timestamp' | undefined;
}
const REPORTS = new Set(['interactiveReport', 'classicReport']);
const DATA_TYPES: Record<string, string> = {
  varchar2: 'STRING',
  number: 'NUMBER',
  date: 'DATE',
  timestamp: 'TIMESTAMP',
};

/** The supported APEXlang property path of each semantic property, by component kind. */
const PATHS: Record<string, Partial<Record<PatchProperty, string>>> = {
  page: { title: 'title' },
  region: { title: 'name', sequence: 'layout.sequence', query: 'source.sqlQuery' },
  pageItem: { label: 'label.label', sequence: 'layout.sequence' },
  button: { label: 'label', sequence: 'layout.sequence' },
  column: { heading: 'heading.heading', format: 'appearance.formatMask', sequence: 'layout.sequence' },
};
const KINDS: Record<string, string> = {
  region: 'region',
  item: 'pageItem',
  button: 'button',
  column: 'column',
};

interface Resolved {
  node: ComponentNode;
  path: string;
  /** Locates the same component in the parsed result. */
  find: (
    page: ReturnType<typeof parseApexLang>[number],
  ) => ReturnType<typeof parseApexLang>[number] | undefined;
}

function resolve(page: ComponentNode, operation: PatchOperation): Resolved {
  const where = `Page ${page.key}`;
  const [kindToken, rest = ''] = operation.target.includes(':')
    ? [
        operation.target.slice(0, operation.target.indexOf(':')),
        operation.target.slice(operation.target.indexOf(':') + 1),
      ]
    : [operation.target, ''];
  let node: ComponentNode;
  let find: Resolved['find'];
  if (kindToken === 'page' && !rest) {
    node = page;
    find = (parsed) => parsed;
  } else if (kindToken === 'column') {
    const [region, column] = rest.split('.');
    if (!region || !column) throw new Fault('INVALID_INPUT', 'Column targets are column:REGION.COLUMN.', 2);
    const owner = ApexLangDocument.one(page.children, 'region', region, where);
    node = ApexLangDocument.one(owner.children, 'column', column, `Region ${owner.key}`);
    find = (parsed) =>
      parsed.children
        .find((c) => c.type === 'region' && c.id.toUpperCase() === owner.key.toUpperCase())
        ?.children.find((c) => c.type === 'column' && c.id.toUpperCase() === node.key.toUpperCase());
  } else if (KINDS[kindToken] && rest) {
    node = ApexLangDocument.one(page.children, KINDS[kindToken]!, rest, where);
    find = (parsed) =>
      parsed.children.find((c) => c.type === node.kind && c.id.toUpperCase() === node.key.toUpperCase());
  } else
    throw new Fault(
      'INVALID_INPUT',
      `Unknown target ${operation.target}; use page, region:ID, item:NAME, button:ID or column:REGION.COLUMN.`,
      2,
    );
  const pathFor = PATHS[node.kind]?.[operation.property];
  if (!pathFor)
    throw new Fault(
      'OPERATION_UNSUPPORTED',
      `${operation.property} is not supported on ${node.kind}; supported: ${Object.keys(PATHS[node.kind] ?? {}).join(', ')}.`,
      2,
    );
  if (operation.property === 'sequence' && !/^[1-9]\d{0,8}$/u.test(operation.value))
    throw new Fault('INVALID_INPUT', 'sequence must be a positive integer.', 2);
  return { node, path: pathFor, find };
}

/** The page's own file: exactly one `.apx` under `pages/` declaring `page <id>`. */
export async function pageFile(ctx: ProjectContext, page: string): Promise<string> {
  const app = await contained(ctx.root, ctx.config.application.sourceDir);
  const dir = path.join(app, 'pages');
  const matches: string[] = [];
  for (const name of (await readdir(dir)).filter((file) => file.endsWith('.apx')).sort()) {
    const head = (await readFile(path.join(dir, name), 'utf8')).slice(0, 4096);
    if (new RegExp(`^page\\s+${page}\\s*\\(`, 'mu').test(head)) matches.push(path.join(dir, name));
  }
  if (matches.length !== 1)
    throw new Fault(
      matches.length ? 'TARGET_AMBIGUOUS' : 'TARGET_NOT_FOUND',
      matches.length ? `Several files declare page ${page}.` : `No page file declares page ${page}.`,
      matches.length ? 5 : 2,
    );
  return matches[0]!;
}

/** Computes the edited text and validates it; throws before anything is written. */
function transform(source: string, pageId: string, operations: PatchOperation[]) {
  const doc = new ApexLangDocument(source);
  const page = ApexLangDocument.one(doc.roots, 'page', pageId, 'The file');
  const resolved = operations.map((operation) => ({ operation, ...resolve(page, operation) }));
  const seen = new Set<string>();
  for (const entry of resolved) {
    const key = `${entry.node.open}:${entry.path}`;
    if (seen.has(key))
      throw new Fault('TRANSFORM_CONFLICT', `Two operations set ${entry.path} of the same component.`, 5);
    seen.add(key);
  }
  // Insertions at the same anchor (two new groups before one child) are combined in order.
  const edits: TextEdit[] = [];
  const add = (edit: TextEdit) => {
    const same = edits.find(
      (other) => other.start === edit.start && other.end === edit.start && edit.end === edit.start,
    );
    if (same) same.content += edit.content;
    else edits.push(edit);
  };
  for (const entry of resolved) {
    if (entry.operation.property === 'query') {
      for (const edit of queryEdits(doc, entry.node, entry.operation)) add(edit);
      continue;
    }
    const edit = setProperty(doc, entry.node, entry.path, entry.operation.value);
    add(edit);
  }
  const result = applyEdits(source, edits);
  // Validation: the result parses, every target reads the new value, and the scanner still accepts it.
  let parsed;
  try {
    parsed = parseApexLang(result, 'patch');
  } catch (error) {
    throw new Fault('TRANSFORM_INVALID', `The edited page does not parse: ${(error as Error).message}`, 5);
  }
  new ApexLangDocument(result);
  const parsedPage = parsed.find((c) => c.type === 'page' && c.id === page.key);
  for (const entry of resolved) {
    const component = parsedPage && entry.find(parsedPage);
    const value = component && readProperty(component, entry.path);
    if (entry.operation.property === 'query') {
      const names = component?.children
        .filter((child) => child.type === 'column')
        .map((child) => child.id.toUpperCase());
      const expected = (entry.operation.columns ?? []).map((column) => column.name.toUpperCase());
      if (
        String(value ?? '').trim() !== entry.operation.value.trim() ||
        JSON.stringify(names) !== JSON.stringify(expected)
      )
        throw new Fault(
          'TRANSFORM_INVALID',
          `${entry.operation.target} query or columns did not read back.`,
          5,
        );
      continue;
    }
    if (value !== entry.operation.value)
      throw new Fault(
        'TRANSFORM_INVALID',
        `${entry.operation.target} ${entry.operation.property} did not read back.`,
        5,
      );
  }
  return { result, edits: edits.length };
}

/**
 * Replaces a report's SQL and makes its columns match the given contract in one change: kept
 * columns keep every property and id (a given heading replaces theirs), dropped ones are removed,
 * and new ones are added with a heading, data type and the next layout sequence. Every column must
 * appear in the query text; the compiler checks the full contract when the page is validated.
 */
function queryEdits(doc: ApexLangDocument, region: ComponentNode, operation: PatchOperation): TextEdit[] {
  const type = doc.lines[region.open] && region.properties.get('type')?.value;
  if (!REPORTS.has(String(type)))
    throw new Fault(
      'OPERATION_UNSUPPORTED',
      `query is supported on interactive and classic reports, not ${type}.`,
      2,
    );
  const columns = operation.columns ?? [];
  if (!columns.length) throw new Fault('INVALID_INPUT', 'query needs the complete columns contract.', 2);
  const names = columns.map((column) => column.name.toUpperCase());
  if (names.some((name) => !/^[A-Z][A-Z0-9_$#]{0,127}$/u.test(name)) || new Set(names).size !== names.length)
    throw new Fault('INVALID_INPUT', 'Column names must be unique Oracle identifiers.', 2);
  const sql = operation.value;
  const missing = names.filter(
    (name) =>
      !new RegExp(`(^|[^A-Z0-9_$#])${name.replace(/[$#]/gu, '\\$&')}([^A-Z0-9_$#]|$)`, 'iu').test(sql),
  );
  if (missing.length)
    throw new Fault('COLUMN_NOT_IN_QUERY', `The query does not name ${missing.join(', ')}.`, 2);
  const edits = [setFencedText(doc, region, 'source.sqlQuery', sql)];
  const existing = region.children.filter((child) => child.kind === 'column');
  for (const column of existing)
    if (!names.includes(column.key.toUpperCase())) edits.push(removeComponent(doc, column));
  let sequence = Math.max(
    0,
    ...existing.map((column) => Number(column.properties.get('layout.sequence')?.value) || 0),
  );
  const indent = ' '.repeat(region.indent + 4);
  const eol = doc.eol;
  let added = '';
  for (const column of columns) {
    const kept = existing.find((entry) => entry.key.toUpperCase() === column.name.toUpperCase());
    if (kept) {
      if (column.heading !== undefined) edits.push(setProperty(doc, kept, 'heading.heading', column.heading));
      continue;
    }
    sequence += 10;
    const lines = [
      `column ${column.name.toUpperCase()} (`,
      '    type: plainText',
      '    heading {',
      `        heading: ${scalarText(column.heading ?? column.name)}`,
      '    }',
      '    layout {',
      `        sequence: ${sequence}`,
      '    }',
      ...(column.dataType
        ? ['    source {', `        dataType: ${DATA_TYPES[column.dataType]}`, '    }']
        : []),
      ')',
    ];
    added += lines.map((line) => indent + line).join(eol) + eol;
  }
  if (added) edits.push(appendChild(doc, region, added));
  return edits;
}

/** Compact, digest-bound context of one page for an agent: components and their editable values. */
export async function pageContext(ctx: ProjectContext, page: string) {
  if (!/^\d{1,5}$/u.test(page)) throw new Fault('INVALID_INPUT', 'page is a page number.', 2);
  const file = await pageFile(ctx, String(Number(page)));
  const source = await readFile(file, 'utf8');
  const parsed = parseApexLang(source, path.relative(ctx.root, file)).find((c) => c.type === 'page');
  if (!parsed) throw new Fault('TARGET_NOT_FOUND', `No page ${page} in its file.`, 2);
  const text = (component: ReturnType<typeof parseApexLang>[number], dotted: string) => {
    const value = readProperty(component, dotted);
    return typeof value === 'string' && value ? value : undefined;
  };
  const compact = <T extends Record<string, unknown>>(value: T) =>
    Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== '')) as T;
  return {
    file: path.relative(ctx.root, file).split(path.sep).join('/'),
    digest: digestOf(source),
    page: compact({ id: parsed.id, name: text(parsed, 'name'), title: text(parsed, 'title') }),
    regions: parsed.children
      .filter((c) => c.type === 'region')
      .map((region) =>
        compact({
          target: `region:${region.id}`,
          type: text(region, 'type'),
          title: text(region, 'name'),
          sequence: text(region, 'layout.sequence'),
          line: region.line,
          query: REPORTS.has(String(text(region, 'type'))) ? text(region, 'source.sqlQuery') : undefined,
          columns: region.children
            .filter((c) => c.type === 'column')
            .map((column) =>
              compact({
                target: `column:${region.id}.${column.id}`,
                heading: text(column, 'heading.heading'),
                format: text(column, 'appearance.formatMask'),
                sequence: text(column, 'layout.sequence'),
              }),
            ),
        }),
      ),
    items: parsed.children
      .filter((c) => c.type === 'pageItem')
      .map((item) =>
        compact({
          target: `item:${item.id}`,
          type: text(item, 'type'),
          label: text(item, 'label.label'),
          line: item.line,
        }),
      ),
    buttons: parsed.children
      .filter((c) => c.type === 'button')
      .map((button) =>
        compact({ target: `button:${button.id}`, label: text(button, 'label'), line: button.line }),
      ),
    next: 'Change titles, labels, headings, formats, sequences or a report query with project patch and this digest.',
  };
}

export interface PatchInput {
  page: string;
  operations: PatchOperation[];
  expectedDigest?: string | undefined;
  dryRun?: boolean | undefined;
}

export interface PatchResult {
  file: string;
  page: string;
  beforeDigest: string;
  afterDigest: string;
  written: boolean;
  operations: number;
  change?: SourceChange;
  next?: string;
}

export async function patchPage(ctx: ProjectContext, input: PatchInput): Promise<PatchResult> {
  if (!/^\d{1,5}$/u.test(input.page)) throw new Fault('INVALID_INPUT', 'page is a page number.', 2);
  if (!input.operations.length || input.operations.length > 50)
    throw new Fault('INVALID_INPUT', 'Give 1-50 operations.', 2);
  const file = await pageFile(ctx, String(Number(input.page)));
  const relative = path.relative(ctx.root, file).split(path.sep).join('/');
  const preview = async () => {
    const source = await readFile(file, 'utf8');
    return {
      source,
      digest: digestOf(source),
      ...transform(source, String(Number(input.page)), input.operations),
    };
  };
  if (input.dryRun || !input.expectedDigest) {
    const planned = await preview();
    if (!input.dryRun)
      throw new Fault(
        'EXPECTED_DIGEST_REQUIRED',
        `Pass expectedDigest ${planned.digest} (the ${relative} you read) to apply the edit.`,
        2,
        'blocked',
        { file: relative, currentDigest: planned.digest },
      );
    return {
      file: relative,
      page: input.page,
      beforeDigest: planned.digest,
      afterDigest: digestOf(planned.result),
      written: false,
      operations: input.operations.length,
      next: `Apply with expectedDigest ${planned.digest}.`,
    };
  }
  return withLock(path.join(ctx.root, '.apexrest', 'source-edit.lock'), async () => {
    const before = await sourceInventory(ctx);
    const planned = await preview();
    if (planned.digest !== input.expectedDigest)
      throw new Fault(
        'TRANSFORM_CONFLICT',
        `${relative} changed since it was read; read it again and retry.`,
        5,
        'conflict',
        { file: relative, currentDigest: planned.digest },
      );
    await atomicWrite(file, planned.result);
    const after = await sourceInventory(ctx);
    return {
      file: relative,
      page: input.page,
      beforeDigest: planned.digest,
      afterDigest: digestOf(planned.result),
      written: true,
      operations: input.operations.length,
      change: sourceChange(before, after, ctx.config.application.sourceDir),
      next: 'Source edited only. Validate or ship to check it with the compiler and import it.',
    };
  });
}

export const _forTests = { transform };
