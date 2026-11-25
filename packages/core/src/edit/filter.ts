import { Fault } from '../result.ts';
import type { ApxComponent } from '../preview/apexlang.ts';
import {
  ApexLangDocument,
  readProperty,
  setFencedText,
  setProperty,
  type ComponentNode,
  type TextEdit,
} from './apexlang-edit.ts';
import { queryEdits, type QueryColumn } from './patch.ts';
import type { InsertInput } from './insert.ts';
import type { PageSnapshot, PlannedEdit } from './transaction.ts';

/**
 * A working filter on an existing page (`edit` operation `addFilter`): the filter item (and an
 * optional container region) is inserted by the insert planner together with one refresh of every
 * target region; this planner makes every target query or chart series submit the item and,
 * where the caller gives complete replacement SQL, replaces it. SQL predicates are never rewritten:
 * every target query must already reference the item as a bind variable, or the caller supplies
 * the query that does. Supported targets: interactive and classic reports, cards and charts.
 */

export interface FilterTarget {
  region: string;
  /** Complete replacement SQL (reports also need `columns`). */
  sql?: string | undefined;
  /** Reports with `sql`: the complete column contract after the change (as for a `query` patch). */
  columns?: QueryColumn[] | undefined;
  /** Charts: complete replacement SQL per series id. */
  series?: { id: string; sql: string }[] | undefined;
}
export interface AddFilterOperation {
  op: 'addFilter';
  /** Scaffold item definition (name with the page prefix, region, type, label, lov ...). */
  item: Record<string, unknown> & { name: string; region: string };
  /** Optional new container region for the item (scaffold region definition with an explicit id). */
  region?: Record<string, unknown> | undefined;
  targets: FilterTarget[];
}

const FAMILIES = new Set(['interactiveReport', 'classicReport', 'cards', 'chart']);
const REPORTS = new Set(['interactiveReport', 'classicReport']);

/** The insert fragment of a filter: region, item and one refresh of all targets. */
export function filterFragment(operation: AddFilterOperation): InsertInput['components'] {
  if (!operation.targets?.length) throw new Fault('INVALID_INPUT', 'addFilter needs at least one target.', 2);
  return {
    regions: operation.region ? [operation.region] : [],
    items: [operation.item],
    refreshes: [{ items: [operation.item.name], regions: operation.targets.map((target) => target.region) }],
  };
}

const bind = (item: string) => new RegExp(`:${item.replace(/[$#]/gu, '\\$&')}(?![A-Z0-9_$#])`, 'iu');
/** Submitted item names of a parsed value: a scalar (`A` or the scaffold's `A,B`) or an array. */
const submitted = (value: unknown): string[] =>
  (Array.isArray(value) ? value.map(String) : String(value ?? '').split(','))
    .map((name) => name.trim())
    .filter(Boolean);

/**
 * The edit that adds `item` to a component's `source.pageItemsToSubmit`: a missing property gets the
 * item as a scalar, a scalar list is extended (`A,B`, as scaffold writes it) and an Oracle-exported
 * `[ ... ]` array gets one more element line in its own indentation.
 */
function submitEdit(doc: ApexLangDocument, owner: ComponentNode, item: string): TextEdit | undefined {
  const property = owner.properties.get('source.pageItemsToSubmit');
  if (!property) return setProperty(doc, owner, 'source.pageItemsToSubmit', item);
  if (property.value !== '[') {
    const items = submitted(property.value);
    if (items.some((name) => name.toUpperCase() === item)) return undefined;
    return setProperty(doc, owner, 'source.pageItemsToSubmit', [...items, item].join(','));
  }
  const elements: string[] = [];
  for (let index = property.line + 1; index < doc.lines.length; index++) {
    const line = doc.lines[index]!;
    const trimmed = line.text.trim();
    if (trimmed === ']') {
      if (elements.some((name) => name.toUpperCase() === item)) return undefined;
      const first = doc.lines[property.line + 1]!;
      const indent =
        index > property.line + 1
          ? first.text.slice(0, first.text.length - first.text.trimStart().length)
          : line.text.slice(0, line.text.length - line.text.trimStart().length) + '    ';
      return { start: line.offset, end: line.offset, content: `${indent}${item}${doc.eol}` };
    }
    if (!/^[A-Za-z0-9_$#]+,?$/u.test(trimmed))
      throw new Fault(
        'TRANSFORM_UNSUPPORTED',
        `pageItemsToSubmit of ${owner.kind} ${owner.key} has an unsupported value; edit it in source.`,
        5,
      );
    elements.push(trimmed.replace(/,$/u, ''));
  }
  throw new Fault('TRANSFORM_UNSUPPORTED', `Unclosed pageItemsToSubmit of ${owner.kind} ${owner.key}.`, 5);
}

interface Source {
  /** Where `source.pageItemsToSubmit` and `source.sqlQuery` live: the region or one chart series. */
  owner: ComponentNode;
  label: string;
  /** Text of the query after the change. */
  sql: string;
  find: (page: ApxComponent) => ApxComponent | undefined;
}

export function planFilters(snapshot: PageSnapshot, operations: AddFilterOperation[]): PlannedEdit {
  const { doc, node: page } = snapshot;
  const edits: TextEdit[] = [];
  const checks: { source: Source; item: string }[] = [];
  const seen = new Set<string>();
  for (const operation of operations) {
    const item = operation.item.name.toUpperCase();
    for (const target of operation.targets) {
      const key = `${target.region.toUpperCase()}:${item}`;
      if (seen.has(key)) throw new Fault('INVALID_INPUT', `Region ${target.region} is listed twice.`, 2);
      seen.add(key);
      const region = ApexLangDocument.one(page.children, 'region', target.region, `Page ${page.key}`);
      const type = String(region.properties.get('type')?.value ?? '');
      if (!FAMILIES.has(type))
        throw new Fault(
          'OPERATION_UNSUPPORTED',
          `addFilter supports interactive and classic reports, cards and charts, not ${type || 'this region'} (${target.region}). Add the item with insert and edit the region in source.`,
          2,
        );
      const sources: Source[] = [];
      if (type === 'chart') {
        if (target.sql || target.columns)
          throw new Fault('INVALID_INPUT', `Chart ${target.region}: give replacement SQL per series.`, 2);
        const series = region.children.filter((child) => child.kind === 'series');
        if (!series.length)
          throw new Fault('OPERATION_UNSUPPORTED', `Chart ${target.region} has no series to filter.`, 2);
        for (const given of target.series ?? [])
          if (!series.some((entry) => entry.key.toUpperCase() === given.id.toUpperCase()))
            throw new Fault('TARGET_NOT_FOUND', `Chart ${target.region} has no series ${given.id}.`, 2);
        for (const entry of series) {
          const replacement = target.series?.find(
            (given) => given.id.toUpperCase() === entry.key.toUpperCase(),
          );
          if (replacement) edits.push(setFencedText(doc, entry, 'source.sqlQuery', replacement.sql));
          sources.push({
            owner: entry,
            label: `${target.region} series ${entry.key}`,
            sql: replacement?.sql ?? fenced(doc, entry),
            find: (parsed) =>
              parsed.children
                .find((c) => c.type === 'region' && c.id.toUpperCase() === region.key.toUpperCase())
                ?.children.find((c) => c.type === 'series' && c.id.toUpperCase() === entry.key.toUpperCase()),
          });
        }
      } else {
        if (target.series) throw new Fault('INVALID_INPUT', `${target.region} is not a chart.`, 2);
        if (target.sql !== undefined) {
          if (REPORTS.has(type))
            edits.push(
              ...queryEdits(
                doc,
                region,
                {
                  target: `region:${region.key}`,
                  property: 'query',
                  value: target.sql,
                  columns: target.columns,
                },
                snapshot.release,
              ),
            );
          else {
            if (target.columns) throw new Fault('INVALID_INPUT', 'columns apply to reports only.', 2);
            edits.push(setFencedText(doc, region, 'source.sqlQuery', target.sql));
          }
        }
        sources.push({
          owner: region,
          label: target.region,
          sql: target.sql ?? fenced(doc, region),
          find: (parsed) =>
            parsed.children.find(
              (c) => c.type === 'region' && c.id.toUpperCase() === region.key.toUpperCase(),
            ),
        });
      }
      for (const source of sources) {
        if (!bind(item).test(source.sql))
          throw new Fault(
            'FILTER_NOT_BOUND',
            `The ${source.label} query does not reference :${item}. Pass complete replacement SQL that filters on it; predicates are not rewritten.`,
            2,
          );
        const edit = submitEdit(doc, source.owner, item);
        if (edit) edits.push(edit);
        checks.push({ source, item });
      }
    }
  }
  const verify = (after: ApxComponent) => {
    for (const { source, item } of checks) {
      const component = source.find(after);
      const items = submitted(component && readProperty(component, 'source.pageItemsToSubmit'));
      const sql = String((component && readProperty(component, 'source.sqlQuery')) ?? '');
      if (!items.some((name) => name.toUpperCase() === item) || !bind(item).test(sql))
        throw new Fault('TRANSFORM_INVALID', `${source.label} does not submit and bind ${item}.`, 5);
    }
  };
  return {
    edits,
    verify,
    targets: operations.flatMap((operation) => operation.targets.map((target) => `region:${target.region}`)),
  };
}

/** The current text of a component's `source.sqlQuery` literal. */
function fenced(doc: ApexLangDocument, node: ComponentNode): string {
  const property = node.properties.get('source.sqlQuery');
  if (!property?.fence || property.fence.close < 0)
    throw new Fault(
      'OPERATION_UNSUPPORTED',
      `${node.kind} ${node.key} has no SQL query literal; pass complete replacement SQL.`,
      2,
    );
  return doc.lines
    .slice(property.fence.open + 1, property.fence.close)
    .map((line) => line.text)
    .join('\n');
}
