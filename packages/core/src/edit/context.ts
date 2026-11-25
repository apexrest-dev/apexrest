import { Fault } from '../result.ts';
import { digestOf, parseApexLang, readProperty } from './apexlang-edit.ts';

/**
 * The compact, digest-bound context of one page (`project action:context`) and the delta between
 * two versions of the same page file. Both are computed from exact text, never from a later reread:
 * an edit's delta describes the bytes it wrote.
 */

const REPORTS = new Set(['interactiveReport', 'classicReport']);
/** Query text in a delta beyond this is cut; `action:context` returns it whole. */
const DELTA_QUERY_CHARS = 2000;
/** Entries in a delta beyond this are counted, not listed. */
const DELTA_ENTRIES = 40;

type Parsed = ReturnType<typeof parseApexLang>[number];
export interface ContextEntry {
  target: string;
  line?: number;
  [property: string]: unknown;
}

const text = (component: Parsed, dotted: string) => {
  const value = readProperty(component, dotted);
  return typeof value === 'string' && value ? value : undefined;
};
const compact = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== '')) as T;

function columnEntries(region: Parsed): ContextEntry[] {
  return region.children
    .filter((c) => c.type === 'column')
    .map((column) =>
      compact({
        target: `column:${region.id}.${column.id}`,
        heading: text(column, 'heading.heading'),
        format: text(column, 'appearance.formatMask'),
        sequence: text(column, 'layout.sequence'),
      }),
    );
}

export function contextOf(source: string, file: string) {
  const parsed = parseApexLang(source, file).find((c) => c.type === 'page');
  if (!parsed) throw new Fault('TARGET_NOT_FOUND', `No page in ${file}.`, 2);
  return {
    file,
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
          columns: columnEntries(region),
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
    next: 'Change titles, labels, headings, formats, sequences or a report query with project patch or edit and this digest.',
  };
}
export type PageContext = ReturnType<typeof contextOf>;

/** Every target of a context as one flat entry (a region entry lists its column targets only). */
function flatten(context: PageContext): Map<string, ContextEntry> {
  const entries = new Map<string, ContextEntry>();
  entries.set('page', { target: 'page', ...context.page });
  for (const { columns, ...region } of context.regions) {
    entries.set(region.target, { ...region, columns: columns.map((c) => c.target) });
    for (const column of columns) entries.set(column.target, column);
  }
  for (const item of context.items) entries.set(item.target, item);
  for (const button of context.buttons) entries.set(button.target, button);
  return entries;
}
/** Line numbers move with any insertion above; they are reported but do not make an entry changed. */
const comparable = ({ line: _line, ...entry }: ContextEntry) => JSON.stringify(entry);

export interface ContextDelta {
  digest: string;
  changed: ContextEntry[];
  inserted: ContextEntry[];
  removed: string[];
  /** Entries left out of `changed`/`inserted` because the delta is bounded. */
  omitted?: number;
  next: string;
}

/** What differs between two versions of one page file, bounded for tool output. */
export function contextDelta(before: string, after: string, file: string): ContextDelta {
  const old = flatten(contextOf(before, file));
  const now = flatten(contextOf(after, file));
  const changed: ContextEntry[] = [];
  const inserted: ContextEntry[] = [];
  for (const [target, entry] of now) {
    const previous = old.get(target);
    if (!previous) inserted.push(entry);
    else if (comparable(previous) !== comparable(entry)) changed.push(entry);
  }
  const removed = [...old.keys()].filter((target) => !now.has(target));
  const bound = (entry: ContextEntry): ContextEntry =>
    typeof entry.query === 'string' && entry.query.length > DELTA_QUERY_CHARS
      ? { ...entry, query: entry.query.slice(0, DELTA_QUERY_CHARS), queryTruncated: true }
      : entry;
  const listed = [...changed, ...inserted].slice(0, DELTA_ENTRIES);
  const omitted = changed.length + inserted.length - listed.length;
  return {
    digest: digestOf(after),
    changed: changed.filter((entry) => listed.includes(entry)).map(bound),
    inserted: inserted.filter((entry) => listed.includes(entry)).map(bound),
    removed,
    ...(omitted ? { omitted } : {}),
    next: omitted
      ? 'Delta is bounded; use project action:context for the whole page.'
      : 'Edit again with this digest and these targets.',
  };
}
