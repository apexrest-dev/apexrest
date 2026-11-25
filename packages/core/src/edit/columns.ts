import { Fault } from '../result.ts';
import type { ApxComponent } from '../preview/apexlang.ts';
import {
  ApexLangDocument,
  readProperty,
  removeComponent,
  scalarText,
  setFencedText,
  setProperty,
  type ComponentNode,
  type TextEdit,
} from './apexlang-edit.ts';
import type { PageSnapshot, PlannedEdit } from './transaction.ts';

/**
 * Report columns and the declarations that depend on them. A column's display order is its
 * `layout.sequence`; an interactive report also lists the columns its saved reports display
 * (`savedReport` › `displayColumn NAME ( sequence: n )`), and sorts, filters, highlights and the
 * like may reference a column by name. Recognized declarations are updated together with the
 * column: a dropped column leaves every `displayColumn` list, a new one joins the primary default
 * report at its place. A dropped column that another saved-report declaration still references is
 * refused rather than guessed at. SQL is only ever replaced by complete caller-supplied text.
 */

export type Release = '26.1' | '26.2';
export const REPORTS = new Set(['interactiveReport', 'classicReport']);
const NAME = /^[A-Z][A-Z0-9_$#]{0,127}$/u;
const DATA_TYPES_261: Record<string, string> = {
  varchar2: 'STRING',
  number: 'NUMBER',
  date: 'DATE',
  timestamp: 'TIMESTAMP',
};

export interface ColumnSpec {
  name: string;
  heading?: string | undefined;
  dataType?: 'varchar2' | 'number' | 'date' | 'timestamp' | undefined;
  format?: string | undefined;
}

const word = (name: string) =>
  new RegExp(`(^|[^A-Z0-9_$#])${name.replace(/[$#]/gu, '\\$&')}([^A-Z0-9_$#]|$)`, 'iu');
const sequenceOf = (node: ComponentNode, path: string) => Number(node.properties.get(path)?.value) || 0;
const bySequence = (nodes: ComponentNode[], path: string) =>
  [...nodes].sort((a, b) => sequenceOf(a, path) - sequenceOf(b, path) || a.open - b.open);

export function reportRegion(region: ComponentNode, operation: string): string {
  const type = String(region.properties.get('type')?.value ?? '');
  if (!REPORTS.has(type))
    throw new Fault(
      'OPERATION_UNSUPPORTED',
      `${operation} is supported on interactive and classic reports, not ${type || 'this region'}.`,
      2,
    );
  return type;
}
export const columnsOf = (region: ComponentNode) =>
  region.children.filter((child) => child.kind === 'column');
const savedReports = (region: ComponentNode) =>
  region.children.filter((child) => child.kind === 'savedReport');
/** The report the runtime shows by default: `visibility: primary...`, else the first saved report. */
function primaryReport(region: ComponentNode) {
  const reports = savedReports(region);
  return (
    reports.find((report) =>
      String(report.properties.get('visibility')?.value ?? '').startsWith('primary'),
    ) ?? reports[0]
  );
}

export function queryNames(sql: string, names: string[]) {
  const missing = names.filter((name) => !word(name).test(sql));
  if (missing.length)
    throw new Fault('COLUMN_NOT_IN_QUERY', `The query does not name ${missing.join(', ')}.`, 2);
}
export function checkNames(names: string[]) {
  if (names.some((name) => !NAME.test(name)) || new Set(names).size !== names.length)
    throw new Fault('INVALID_INPUT', 'Column names must be unique Oracle identifiers.', 2);
}

/** Text of a new column component, indented as a child of `region`. */
export function columnText(
  doc: ApexLangDocument,
  region: ComponentNode,
  column: ColumnSpec,
  sequence: number,
  release: Release,
) {
  const dataType =
    column.dataType && (release === '26.1' ? DATA_TYPES_261[column.dataType] : column.dataType);
  const lines = [
    `column ${column.name.toUpperCase()} (`,
    '    type: plainText',
    '    heading {',
    `        heading: ${scalarText(column.heading ?? column.name)}`,
    '    }',
    '    layout {',
    `        sequence: ${sequence}`,
    '    }',
    ...(column.format
      ? ['    appearance {', `        formatMask: ${scalarText(column.format)}`, '    }']
      : []),
    ...(dataType ? ['    source {', `        dataType: ${dataType}`, '    }'] : []),
    ')',
  ];
  const indent = ' '.repeat(region.indent + 4);
  return lines.map((line) => indent + line).join(doc.eol) + doc.eol;
}

/** New child components go right after the last column (Oracle's order), else before the first saved report or the region end. */
export function afterColumns(doc: ApexLangDocument, region: ComponentNode, text: string): TextEdit {
  const last = columnsOf(region).at(-1);
  if (!last) {
    const line = doc.lines[savedReports(region)[0]?.open ?? region.close]!;
    return { start: line.offset, end: line.offset, content: text };
  }
  const line = doc.lines[last.close]!;
  const at = line.offset + line.text.length + line.eol.length;
  return { start: at, end: at, content: text };
}

/**
 * Sequence edits that put `order` (existing nodes, or `undefined` for one new node) into that
 * display order. Existing sequences are kept when they already follow the order and the new node
 * fits into a gap; otherwise the listed nodes are renumbered by `step`. Returns the new node's sequence.
 */
function placeInOrder(
  doc: ApexLangDocument,
  order: (ComponentNode | undefined)[],
  path: string,
  step: number,
): { edits: TextEdit[]; sequence: number } {
  const current = order.map((node) => (node ? sequenceOf(node, path) : undefined));
  const index = current.indexOf(undefined);
  const existing = current.filter((value): value is number => value !== undefined);
  const increasing = existing.every((value, i) => i === 0 || value > existing[i - 1]!);
  if (increasing && existing.every((value) => value > 0)) {
    if (index === -1) return { edits: [], sequence: 0 };
    const previous = index > 0 ? current[index - 1]! : 0;
    const next = index < current.length - 1 ? current[index + 1] : undefined;
    if (next === undefined) return { edits: [], sequence: previous + step };
    if (next - previous >= 2) return { edits: [], sequence: Math.floor((previous + next) / 2) };
  }
  const edits: TextEdit[] = [];
  let sequence = 0;
  order.forEach((node, i) => {
    const value = (i + 1) * step;
    if (!node) sequence = value;
    else if (sequenceOf(node, path) !== value) edits.push(setProperty(doc, node, path, String(value)));
  });
  return { edits, sequence };
}

/**
 * Saved-report declarations other than `displayColumn` that mention `name`: every line of them is
 * checked, so multi-line values the scanner keeps opaque (filter expressions, arrays) count too.
 */
function references(doc: ApexLangDocument, report: ComponentNode, name: string): string[] {
  const found: string[] = [];
  for (const child of report.children) {
    if (child.kind === 'displayColumn') continue;
    for (let line = child.open; line <= child.close; line++)
      if (word(name).test(doc.lines[line]!.text)) {
        found.push(`${child.kind} ${child.key}`.trim());
        break;
      }
  }
  return found;
}

/**
 * Saved-report edits for a column contract change: dropped columns leave every report (refused when
 * another declaration of a report still references them) and added columns join the primary report
 * after `after` (a displayed column name), else at the end.
 */
export function savedReportEdits(
  doc: ApexLangDocument,
  region: ComponentNode,
  dropped: string[],
  added: { name: string; after?: string | undefined; before?: string | undefined }[],
): TextEdit[] {
  const edits: TextEdit[] = [];
  for (const report of savedReports(region))
    for (const name of dropped) {
      const used = references(doc, report, name);
      if (used.length)
        throw new Fault(
          'COLUMN_REFERENCED',
          `Saved report ${report.key} still uses ${name} in ${used.join(', ')}. Remove that use in source first.`,
          5,
        );
      for (const display of report.children.filter(
        (child) => child.kind === 'displayColumn' && child.key.toUpperCase() === name,
      ))
        edits.push(removeComponent(doc, display));
    }
  const primary = primaryReport(region);
  if (!primary || !added.length) return edits;
  const displayed = bySequence(
    primary.children.filter(
      (child) => child.kind === 'displayColumn' && !dropped.includes(child.key.toUpperCase()),
    ),
    'sequence',
  );
  // One new display column at a time keeps the placement rule simple; several are appended in order.
  let order: (ComponentNode | undefined)[] = [...displayed];
  const news: string[] = [];
  for (const column of added) {
    const at = column.before
      ? order.findIndex((node) => node?.key.toUpperCase() === column.before)
      : column.after
        ? order.findIndex((node) => node?.key.toUpperCase() === column.after) + 1
        : order.length;
    order.splice(at < 0 ? order.length : at, 0, undefined);
    news.push(column.name);
  }
  // Renumber when more than one display column is new; a single one may use a gap.
  const holes = order.filter((node) => !node).length;
  let sequences: number[];
  if (holes === 1) {
    const placed = placeInOrder(doc, order, 'sequence', 1);
    edits.push(...placed.edits);
    sequences = [placed.sequence];
  } else {
    sequences = [];
    order.forEach((node, i) => {
      if (!node) sequences.push(i + 1);
      else if (sequenceOf(node, 'sequence') !== i + 1)
        edits.push(setProperty(doc, node, 'sequence', String(i + 1)));
    });
  }
  const indent = ' '.repeat(primary.indent + 4);
  const text = news
    .map(
      (name, i) =>
        [`displayColumn ${name} (`, `    sequence: ${sequences[i]}`, ')']
          .map((line) => indent + line)
          .join(doc.eol) + doc.eol,
    )
    .join('');
  const last = primary.children.filter((child) => child.kind === 'displayColumn').at(-1);
  const anchor = last ? doc.lines[last.close]! : doc.lines[primary.close]!;
  const at = last ? anchor.offset + anchor.text.length + anchor.eol.length : anchor.offset;
  edits.push({ start: at, end: at, content: text });
  return edits;
}

export interface AddColumnOperation {
  op: 'addColumn';
  region: string;
  /** Complete replacement SQL naming every column, the new one included. */
  sql: string;
  column: ColumnSpec;
  /** Place the new column after or before an existing column (default: last). */
  after?: string | undefined;
  before?: string | undefined;
}
export interface OrderColumnsOperation {
  op: 'orderColumns';
  region: string;
  /** Every declared column, in the new display order. The SQL is not touched. */
  order: string[];
}

export function planColumns(
  snapshot: PageSnapshot,
  operations: (AddColumnOperation | OrderColumnsOperation)[],
): PlannedEdit {
  const { doc, node: page, release } = snapshot;
  const edits: TextEdit[] = [];
  const checks: ((after: ApxComponent) => void)[] = [];
  const seen = new Set<string>();
  for (const operation of operations) {
    const region = ApexLangDocument.one(page.children, 'region', operation.region, `Page ${page.key}`);
    if (seen.has(region.key.toUpperCase()))
      throw new Fault('TRANSFORM_CONFLICT', `Two column operations change region ${operation.region}.`, 5);
    seen.add(region.key.toUpperCase());
    const type = reportRegion(region, operation.op);
    const columns = bySequence(columnsOf(region), 'layout.sequence');
    const key = (name: string) => name.toUpperCase();
    const find = (name: string | undefined) =>
      name === undefined ? undefined : columns.findIndex((column) => column.key.toUpperCase() === key(name));
    if (operation.op === 'orderColumns') {
      const order = operation.order.map(key);
      checkNames(order);
      const declared = columns.map((column) => column.key.toUpperCase());
      if (order.length !== declared.length || order.some((name) => !declared.includes(name)))
        throw new Fault(
          'INVALID_INPUT',
          `order must list every column of ${region.key} once: ${declared.join(', ')}.`,
          2,
        );
      const nodes = order.map((name) => columns[find(name)!]!);
      edits.push(...placeInOrder(doc, nodes, 'layout.sequence', 10).edits);
      const primary = type === 'interactiveReport' ? primaryReport(region) : undefined;
      if (primary) {
        const displayed = primary.children.filter((child) => child.kind === 'displayColumn');
        const shown = order
          .map((name) => displayed.find((child) => child.key.toUpperCase() === name))
          .filter((node): node is ComponentNode => Boolean(node));
        edits.push(...placeInOrder(doc, shown, 'sequence', 1).edits);
      }
      checks.push((after) => {
        const parsed = after.children.find(
          (c) => c.type === 'region' && c.id.toUpperCase() === region.key.toUpperCase(),
        );
        const now = (parsed?.children ?? [])
          .filter((c) => c.type === 'column')
          .sort(
            (a, b) => Number(readProperty(a, 'layout.sequence')) - Number(readProperty(b, 'layout.sequence')),
          )
          .map((c) => c.id.toUpperCase());
        if (JSON.stringify(now) !== JSON.stringify(order))
          throw new Fault(
            'TRANSFORM_INVALID',
            `${region.key} columns did not read back in the requested order.`,
            5,
          );
      });
      continue;
    }
    const name = key(operation.column.name);
    checkNames([name]);
    if (find(name) !== -1)
      throw new Fault('TARGET_EXISTS', `Column ${name} already exists in ${region.key}.`, 5);
    if (operation.after && operation.before)
      throw new Fault('INVALID_INPUT', 'Give after or before, not both.', 2);
    const anchor = operation.after ?? operation.before;
    const at = find(anchor);
    if (anchor !== undefined && at === -1)
      throw new Fault('TARGET_NOT_FOUND', `No column ${anchor} in ${region.key}.`, 2);
    queryNames(operation.sql, [...columns.map((column) => column.key.toUpperCase()), name]);
    const index = at === undefined ? columns.length : operation.after ? at + 1 : at;
    const order: (ComponentNode | undefined)[] = [...columns];
    order.splice(index, 0, undefined);
    const placed = placeInOrder(doc, order, 'layout.sequence', 10);
    edits.push(setFencedText(doc, region, 'source.sqlQuery', operation.sql), ...placed.edits);
    edits.push(
      afterColumns(doc, region, columnText(doc, region, operation.column, placed.sequence, release)),
    );
    if (type === 'interactiveReport') {
      // In the default report the new column follows the nearest displayed column before it.
      const primary = primaryReport(region);
      const displayed = new Set(
        (primary?.children ?? []).filter((c) => c.kind === 'displayColumn').map((c) => c.key.toUpperCase()),
      );
      const before = columns
        .slice(0, index)
        .reverse()
        .find((column) => displayed.has(column.key.toUpperCase()));
      const next = columns.slice(index).find((column) => displayed.has(column.key.toUpperCase()));
      edits.push(
        ...savedReportEdits(
          doc,
          region,
          [],
          [before ? { name, after: before.key.toUpperCase() } : { name, before: next?.key.toUpperCase() }],
        ),
      );
    }
    const expected = order.map((node) => (node ? node.key.toUpperCase() : name));
    checks.push((after) => {
      const parsed = after.children.find(
        (c) => c.type === 'region' && c.id.toUpperCase() === region.key.toUpperCase(),
      );
      const now = (parsed?.children ?? [])
        .filter((c) => c.type === 'column')
        .sort(
          (a, b) => Number(readProperty(a, 'layout.sequence')) - Number(readProperty(b, 'layout.sequence')),
        )
        .map((c) => c.id.toUpperCase());
      if (
        JSON.stringify(now) !== JSON.stringify(expected) ||
        String(readProperty(parsed!, 'source.sqlQuery') ?? '').trim() !== operation.sql.trim()
      )
        throw new Fault('TRANSFORM_INVALID', `${region.key} query or column order did not read back.`, 5);
    });
  }
  return {
    edits,
    verify: (after) => checks.forEach((check) => check(after)),
    targets: operations.map((operation) => `region:${operation.region}`),
  };
}

/**
 * Whether a column shows by default. Interactive reports: a column not declared `type: hidden`
 * that the primary default saved report lists as a `displayColumn` (every such column when the
 * report has no saved report). Classic reports: any column type other than `hidden`.
 */
export function columnVisible(region: ApxComponent, column: string): boolean {
  const declared = region.children.find(
    (c) => c.type === 'column' && c.id.toUpperCase() === column.toUpperCase(),
  );
  if (!declared || declared.props.type === 'hidden') return false;
  if (region.props.type !== 'interactiveReport') return true;
  const reports = region.children.filter((c) => c.type === 'savedReport');
  const primary =
    reports.find((report) => String(report.props.visibility ?? '').startsWith('primary')) ?? reports[0];
  if (!primary) return true;
  return primary.children.some(
    (c) => c.type === 'displayColumn' && c.id.toUpperCase() === column.toUpperCase(),
  );
}

/**
 * Edits that show or hide columns of one report by default, planned together so several changes
 * do not touch the same lines. Interactive reports change only the primary default saved report's
 * `displayColumn` list (a shown column takes its place by column order); classic reports switch
 * `type` between `plainText` and `hidden`. Structural cases are refused: an interactive-report
 * column declared `type: hidden`, a report without a default saved report, and hiding a classic
 * column whose type (a link, an LOV display) would be lost.
 */
export function visibilityEdits(
  doc: ApexLangDocument,
  region: ComponentNode,
  changes: { column: ComponentNode; visible: boolean }[],
): TextEdit[] {
  const type = reportRegion(region, 'visible');
  const edits: TextEdit[] = [];
  if (type === 'classicReport') {
    for (const { column, visible } of changes) {
      const columnType = String(column.properties.get('type')?.value ?? '');
      if (visible) {
        if (columnType === 'hidden') edits.push(setProperty(doc, column, 'type', 'plainText'));
        continue;
      }
      if (columnType === 'hidden') continue;
      if (columnType && columnType !== 'plainText')
        throw new Fault(
          'OPERATION_UNSUPPORTED',
          `${region.key}.${column.key} is a ${columnType} column; hiding it would drop that type. Edit it in source.`,
          2,
        );
      edits.push(setProperty(doc, column, 'type', 'hidden'));
    }
    return edits;
  }
  for (const { column } of changes)
    if (String(column.properties.get('type')?.value ?? '') === 'hidden')
      throw new Fault(
        'OPERATION_UNSUPPORTED',
        `${region.key}.${column.key} is declared type hidden, so users cannot show it; change its type in source.`,
        2,
      );
  const primary = primaryReport(region);
  if (!primary)
    throw new Fault(
      'OPERATION_UNSUPPORTED',
      `${region.key} has no default saved report; its displayed columns are not declared in source.`,
      2,
    );
  const hide = new Set(changes.filter((c) => !c.visible).map((c) => c.column.key.toUpperCase()));
  const displayed = bySequence(
    primary.children.filter((c) => c.kind === 'displayColumn'),
    'sequence',
  );
  for (const node of displayed) if (hide.has(node.key.toUpperCase())) edits.push(removeComponent(doc, node));
  const order: (ComponentNode | string)[] = displayed.filter((node) => !hide.has(node.key.toUpperCase()));
  const has = (name: string) =>
    order.some((entry) => (typeof entry === 'string' ? entry : entry.key.toUpperCase()) === name);
  const columns = bySequence(columnsOf(region), 'layout.sequence').map((c) => c.key.toUpperCase());
  for (const { column, visible } of changes) {
    const name = column.key.toUpperCase();
    if (!visible || has(name)) continue;
    // After the nearest shown column that precedes it in column order, else first.
    const index = columns.indexOf(name);
    const before = columns.slice(0, index).reverse().find(has);
    const at = before
      ? order.findIndex((entry) => (typeof entry === 'string' ? entry : entry.key.toUpperCase()) === before) +
        1
      : 0;
    order.splice(at, 0, name);
  }
  const news = order.filter((entry): entry is string => typeof entry === 'string');
  if (!news.length) return edits;
  // Existing display columns keep their sequence when a single new one fits a gap; else 1..n.
  const sequences = new Map<string, number>();
  const kept = order.map((entry) => (typeof entry === 'string' ? undefined : entry));
  if (news.length === 1) {
    const placed = placeInOrder(doc, kept, 'sequence', 1);
    edits.push(...placed.edits);
    sequences.set(news[0]!, placed.sequence);
  } else
    order.forEach((entry, i) => {
      if (typeof entry === 'string') sequences.set(entry, i + 1);
      else if (sequenceOf(entry, 'sequence') !== i + 1)
        edits.push(setProperty(doc, entry, 'sequence', String(i + 1)));
    });
  const indent = ' '.repeat(primary.indent + 4);
  const text = news
    .map(
      (name) =>
        [`displayColumn ${name} (`, `    sequence: ${sequences.get(name)}`, ')']
          .map((line) => indent + line)
          .join(doc.eol) + doc.eol,
    )
    .join('');
  const last = primary.children.filter((child) => child.kind === 'displayColumn').at(-1);
  const anchor = doc.lines[last ? last.close : primary.close]!;
  const at = last ? anchor.offset + anchor.text.length + anchor.eol.length : anchor.offset;
  edits.push({ start: at, end: at, content: text });
  return edits;
}
