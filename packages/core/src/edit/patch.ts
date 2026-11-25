import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { ProjectContext } from '../config.ts';
import { Fault } from '../result.ts';
import type { SourceChange } from '../revision.ts';
import { pageFile } from './page-file.ts';
import { isLayoutProperty, layoutEdit, LAYOUT_PROPERTIES, themeCatalog } from './layout.ts';
import {
  afterColumns,
  checkNames,
  columnText,
  columnsOf,
  queryNames,
  reportRegion,
  savedReportEdits,
  columnVisible,
  visibilityEdits,
  type Release,
} from './columns.ts';
import { contextOf, type ContextDelta, type PageContext } from './context.ts';
import {
  runPageTransaction,
  transformPage,
  type ContextMode,
  type PageSnapshot,
  type PlannedEdit,
} from './transaction.ts';
import {
  ApexLangDocument,
  digestOf,
  parseApexLang,
  readProperty,
  setProperty,
  setPropertyText,
  scalarText,
  setFencedText,
  removeComponent,
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

export const PATCH_PROPERTIES = [
  'title',
  'label',
  'heading',
  'format',
  'sequence',
  'query',
  'visible',
  ...LAYOUT_PROPERTIES,
] as const;
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

/** The supported APEXlang property path of each semantic property, by component kind. */
const PATHS: Record<string, Partial<Record<PatchProperty, string>>> = {
  page: {
    title: 'title',
    template: 'appearance.pageTemplate',
    templateOptions: 'appearance.templateOptions',
  },
  region: {
    title: 'name',
    sequence: 'layout.sequence',
    query: 'source.sqlQuery',
    template: 'appearance.template',
    templateOptions: 'appearance.templateOptions',
    column: 'layout.column',
    columnSpan: 'layout.columnSpan',
    startNewRow: 'layout.startNewRow',
  },
  pageItem: {
    label: 'label.label',
    sequence: 'layout.sequence',
    column: 'layout.column',
    columnSpan: 'layout.columnSpan',
    startNewRow: 'layout.startNewRow',
  },
  button: { label: 'label', sequence: 'layout.sequence' },
  column: {
    heading: 'heading.heading',
    format: 'appearance.formatMask',
    sequence: 'layout.sequence',
    visible: 'visible',
  },
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
  if (operation.property === 'visible' && !['true', 'false'].includes(operation.value))
    throw new Fault('INVALID_INPUT', 'visible is "true" or "false".', 2);
  return { node, path: pathFor, find };
}

export { pageFile };

/** Plans property and query operations against the page snapshot; throws before anything is written. */
export function planSets(snapshot: PageSnapshot, operations: PatchOperation[]): PlannedEdit {
  const { doc, node: page } = snapshot;
  const resolved = operations.map((operation) => ({ operation, ...resolve(page, operation) }));
  const seen = new Set<string>();
  for (const entry of resolved) {
    const key = `${entry.node.open}:${entry.path}`;
    if (seen.has(key))
      throw new Fault('TRANSFORM_CONFLICT', `Two operations set ${entry.path} of the same component.`, 5);
    seen.add(key);
  }
  const edits: TextEdit[] = [];
  // Visibility changes of one report are planned together.
  const visibility = new Map<ComponentNode, { column: ComponentNode; visible: boolean }[]>();
  // New properties of one missing group become one group, never several groups of the same name.
  const grouped = new Map<string, { node: ComponentNode; group: string; lines: string[] }>();
  const set = (node: ComponentNode, path: string, text: string) => {
    const [group, key] = path.split('.');
    if (key && !node.groups.has(group!) && !node.properties.has(path)) {
      const id = `${node.open}:${group}`;
      const entry = grouped.get(id) ?? { node, group: group!, lines: [] };
      entry.lines.push(`${key}: ${text}`);
      grouped.set(id, entry);
    } else edits.push(setPropertyText(doc, node, path, text));
  };
  const catalog = resolved.some((entry) => isLayoutProperty(entry.operation.property))
    ? themeCatalog()
    : undefined;
  for (const entry of resolved) {
    const property = entry.operation.property;
    if (property === 'query') edits.push(...queryEdits(doc, entry.node, entry.operation, snapshot.release));
    else if (property === 'visible') {
      const region = entry.node.parent!;
      visibility.set(region, [
        ...(visibility.get(region) ?? []),
        { column: entry.node, visible: entry.operation.value === 'true' },
      ]);
    } else if (isLayoutProperty(property)) {
      // Template options are checked against the template the same batch sets, if any.
      const template = resolved.find(
        (other) =>
          other.node === entry.node && other.operation.property === 'template' && other.operation.value,
      )?.operation.value;
      const change = layoutEdit(doc, entry.node, property, entry.operation.value, {
        release: snapshot.release,
        catalog: catalog!,
        template,
        grid: {
          column: resolved.find((other) => other.node === entry.node && other.operation.property === 'column')
            ?.operation.value,
          columnSpan: resolved.find(
            (other) => other.node === entry.node && other.operation.property === 'columnSpan',
          )?.operation.value,
        },
      });
      if ('edit' in change) {
        if (change.edit) edits.push(change.edit);
      } else set(entry.node, change.path, change.text);
    } else set(entry.node, entry.path, scalarText(entry.operation.value));
  }
  for (const { node, group, lines } of grouped.values()) {
    const indent = ' '.repeat(node.indent + 4);
    const anchor = doc.lines[node.children[0]?.open ?? node.close]!;
    const body = lines
      .flatMap((line) => line.split(doc.eol))
      .map((line, index) => (index === 0 || !line.startsWith(' ') ? `${indent}    ${line}` : line));
    edits.push({
      start: anchor.offset,
      end: anchor.offset,
      content: [`${indent}${group} {`, ...body, `${indent}}`].join(doc.eol) + doc.eol,
    });
  }
  for (const [region, changes] of visibility) edits.push(...visibilityEdits(doc, region, changes));
  // Validation: every target reads the new value from the parsed result.
  const verify = (parsedPage: ReturnType<typeof parseApexLang>[number]) => {
    for (const entry of resolved) {
      const component = entry.find(parsedPage);
      const value = component && readProperty(component, entry.path);
      if (isLayoutProperty(entry.operation.property)) {
        const read = (raw: unknown): string =>
          raw === undefined
            ? ''
            : Array.isArray(raw)
              ? raw.map(String).join(' ')
              : raw && typeof raw === 'object' && 'ref' in raw
                ? String((raw as { ref: unknown }).ref).replace(/^\//u, '')
                : String(raw);
        const expected =
          entry.operation.property === 'templateOptions'
            ? [...new Set(entry.operation.value.split(/[\s,]+/u).filter(Boolean))].join(' ')
            : entry.operation.value;
        if (read(value) !== expected)
          throw new Fault(
            'TRANSFORM_INVALID',
            `${entry.operation.target} ${entry.operation.property} did not read back.`,
            5,
          );
        continue;
      }
      if (entry.operation.property === 'visible') {
        const region = parsedPage.children.find(
          (c) => c.type === 'region' && c.id.toUpperCase() === entry.node.parent!.key.toUpperCase(),
        );
        if (!region || columnVisible(region, entry.node.key) !== (entry.operation.value === 'true'))
          throw new Fault('TRANSFORM_INVALID', `${entry.operation.target} visibility did not read back.`, 5);
        continue;
      }
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
  };
  return { edits, verify, targets: resolved.map((entry) => entry.operation.target) };
}

/** Computes the edited text and validates it; throws before anything is written. */
function transform(source: string, pageId: string, operations: PatchOperation[]) {
  const { result, edits } = transformPage(source, pageId, [(snapshot) => planSets(snapshot, operations)]);
  return { result, edits };
}

/**
 * Replaces a report's SQL and makes its columns match the given contract in one change: kept
 * columns keep every property and id (a given heading replaces theirs), dropped ones are removed,
 * and new ones are added with a heading, data type and the next layout sequence. Every column must
 * appear in the query text; the compiler checks the full contract when the page is validated.
 */
export function queryEdits(
  doc: ApexLangDocument,
  region: ComponentNode,
  operation: PatchOperation,
  release: Release = '26.2',
): TextEdit[] {
  const type = reportRegion(region, 'query');
  const columns = operation.columns ?? [];
  if (!columns.length) throw new Fault('INVALID_INPUT', 'query needs the complete columns contract.', 2);
  const names = columns.map((column) => column.name.toUpperCase());
  checkNames(names);
  queryNames(operation.value, names);
  const edits = [setFencedText(doc, region, 'source.sqlQuery', operation.value)];
  const existing = columnsOf(region);
  const dropped = existing.map((column) => column.key.toUpperCase()).filter((name) => !names.includes(name));
  for (const column of existing)
    if (dropped.includes(column.key.toUpperCase())) edits.push(removeComponent(doc, column));
  let sequence = Math.max(
    0,
    ...existing.map((column) => Number(column.properties.get('layout.sequence')?.value) || 0),
  );
  let added = '';
  const news: string[] = [];
  for (const column of columns) {
    const kept = existing.find((entry) => entry.key.toUpperCase() === column.name.toUpperCase());
    if (kept) {
      if (column.heading !== undefined) edits.push(setProperty(doc, kept, 'heading.heading', column.heading));
      continue;
    }
    sequence += 10;
    added += columnText(doc, region, column, sequence, release);
    news.push(column.name.toUpperCase());
  }
  if (added) edits.push(afterColumns(doc, region, added));
  // Interactive reports: saved reports drop removed columns and show new ones at the end.
  if (type === 'interactiveReport')
    edits.push(
      ...savedReportEdits(
        doc,
        region,
        dropped,
        news.map((name) => ({ name })),
      ),
    );
  return edits;
}

/** Compact, digest-bound context of one page for an agent: components and their editable values. */
export async function pageContext(ctx: ProjectContext, page: string) {
  if (!/^\d{1,5}$/u.test(page)) throw new Fault('INVALID_INPUT', 'page is a page number.', 2);
  const file = await pageFile(ctx, String(Number(page)));
  return contextOf(await readFile(file, 'utf8'), path.relative(ctx.root, file).split(path.sep).join('/'));
}

export interface PatchInput {
  page: string;
  operations: PatchOperation[];
  expectedDigest?: string | undefined;
  dryRun?: boolean | undefined;
  /** What the result carries of the edited page: the delta (default), the whole context or none. */
  context?: ContextMode | undefined;
}

export interface PatchResult {
  file: string;
  page: string;
  beforeDigest: string;
  afterDigest: string;
  written: boolean;
  operations: number;
  change?: SourceChange;
  context?: ContextDelta | PageContext;
  next?: string;
}

export async function patchPage(ctx: ProjectContext, input: PatchInput): Promise<PatchResult> {
  const {
    result: _text,
    targets: _targets,
    ...outcome
  } = await runPageTransaction(ctx, input, (operations) => [(snapshot) => planSets(snapshot, operations)]);
  return outcome;
}

export const _forTests = { transform };
