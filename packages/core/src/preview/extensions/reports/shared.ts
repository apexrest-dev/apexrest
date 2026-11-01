import { bool, get, isObject, isRef, list, num, ref, str, type ApxComponent } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { ApexRenderer, RenderContext, Session } from '../../render.ts';
import { columnRenderer } from '../../extensions.ts';
import { escapeHtml } from '../../theme.ts';
import { applyTemplate } from '../components/directives.ts';
import { formatValue, SUPPORTED_MASK } from './masks.ts';
import type { IrViews } from './ir-views.ts';

/** Shared plumbing for the classic report, interactive report and interactive grid simulations. */

export interface ReportFilter {
  /** Column name for column filters; empty for row (all columns) filters. */
  column: string;
  operator: string;
  value: string;
  value2?: string;
  /** Unit of the relative date operators (`isInTheLast` ...): min, hours, days, weeks, months, years. */
  unit?: string;
  enabled: boolean;
}

export interface ReportSort {
  column: string;
  direction: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}

export interface ReportState {
  filters: ReportFilter[];
  sort: ReportSort[];
  /** Displayed column names in order; undefined means the saved-report default. */
  columns?: string[];
  rowsPerPage?: number;
  /** Interactive grid: record identity selected in a master grid. */
  selected?: string;
  /** Interactive grid: changes posted before a page submit, applied by the row processing process. */
  pending?: GridChanges | undefined;
  /** Interactive report views and formatting: breaks, highlights, computations, group by, pivot, chart. */
  views?: IrViews;
}

export interface GridChange {
  op: 'insert' | 'update' | 'delete';
  /** Identity of the original row (primary key values joined by `|`, or the SQLite rowid). */
  id?: string;
  values: Record<string, string | null>;
}

export interface GridChanges {
  changes: GridChange[];
}

const STATES = new WeakMap<Session, Map<string, ReportState>>();

export const stateKey = (pageId: string, regionId: string) => `${pageId}:${regionId}`;

/** Per-session UI state of one report region; `init` seeds it from the saved-report defaults. */
export function reportState(session: Session, key: string, init: () => ReportState): ReportState {
  let states = STATES.get(session);
  if (!states) STATES.set(session, (states = new Map()));
  let state = states.get(key);
  if (!state) states.set(key, (state = init()));
  return state;
}

export function peekState(session: Session, key: string): ReportState | undefined {
  return STATES.get(session)?.get(key);
}

export function resetState(session: Session, key: string): void {
  STATES.get(session)?.delete(key);
}

export function sequenceOf(component: ApxComponent): number {
  return num(component.props, 'layout.sequence', num(component.props, 'sequence', 0));
}

export function bySequence<T extends ApxComponent>(components: T[]): T[] {
  return [...components].sort((a, b) => sequenceOf(a) - sequenceOf(b));
}

export function initcap(name: string): string {
  return name
    .toLowerCase()
    .replace(/_/gu, ' ')
    .replace(/\b\w/gu, (char) => char.toUpperCase());
}

export function syntheticColumn(name: string): ApxComponent {
  return { type: 'column', id: name, props: {}, children: [], file: '', line: 0 } as ApxComponent;
}

/** Declared columns in sequence order, or the query columns when the region declares none. */
export function regionColumns(region: ApxComponent, resultColumns: string[]): ApxComponent[] {
  const declared = region.children.filter((child) => child.type === 'column');
  if (!declared.length) return resultColumns.map(syntheticColumn);
  const names = new Set(declared.map((column) => column.id.toUpperCase()));
  // Query columns the region does not declare still exist (APEX would add them on the next save).
  return [...bySequence(declared), ...resultColumns.filter((name) => !names.has(name)).map(syntheticColumn)];
}

export function isSpecialColumn(name: string): boolean {
  return /^(APEX\$|ROWID$)/u.test(name.toUpperCase());
}

export function primarySavedReport(region: ApxComponent): ApxComponent | undefined {
  const saved = region.children.filter((child) => child.type === 'savedReport');
  return (
    saved.find((child) => /^primary/u.test(str(child.props, 'visibility', 'primaryDefault'))) ?? saved[0]
  );
}

/** Column name a saved-report child points at (`column: @X`, `column: X` or the component id). */
export function columnRef(component: ApxComponent): string {
  return (ref(component.props, 'column') ?? component.id).toUpperCase();
}

export function findRegion(renderer: ApexRenderer, ctx: RenderContext, id: string): ApxComponent | undefined {
  return renderer
    .pageComponents(ctx, 'region')
    .find((candidate) => renderer.regionDomId(candidate) === id || candidate.id === id);
}

export { formatValue, since } from './masks.ts';

/**
 * Renders cell values like APEX: format masks, LOV display values, HTML expressions, links and
 * escaping. LOVs are looked up once per region render.
 */
export class Cells {
  #lovs = new Map<string, Map<string, string>>();
  readonly renderer: ApexRenderer;
  readonly ctx: RenderContext;
  readonly region: ApxComponent;

  constructor(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent) {
    this.renderer = renderer;
    this.ctx = ctx;
    this.region = region;
  }

  lov(column: ApxComponent): Map<string, string> | undefined {
    const type = str(column.props, 'type', 'plainText');
    const spec = get(column.props, 'lov');
    if (!isObject(spec) || !/lov|selectList|radioGroup|popupLov|BasedOnLov/iu.test(type)) return undefined;
    const name = column.id.toUpperCase();
    let map = this.#lovs.get(name);
    if (!map) {
      map = new Map(
        this.renderer.lov(this.ctx, spec, `${this.region.id}.${name}`).map((entry) => [entry.r, entry.d]),
      );
      this.#lovs.set(name, map);
    }
    return map;
  }

  /** Plain display text (no markup): used for searching, filtering, sorting by display and CSV. */
  text(column: ApxComponent, row: Row): string {
    const raw = row[column.id.toUpperCase()];
    if (raw === null || raw === undefined) return '';
    const lov = this.lov(column);
    if (lov) {
      const value = String(raw);
      return lov.get(value) ?? value;
    }
    const mask = str(column.props, 'appearance.formatMask');
    if (mask && !SUPPORTED_MASK.test(mask))
      this.renderer.diagnose(
        'info',
        `Format mask ${mask} of ${this.region.id}.${column.id} is approximated`,
        this.ctx.pageId,
        this.region.id,
      );
    return formatValue(raw, mask);
  }

  escapes(column: ApxComponent): boolean {
    return bool(
      column.props,
      'security.escapeSpecialChars',
      bool(this.region.props, 'security.escapeSpecialChars', true),
    );
  }

  /**
   * `#COLUMN#` substitutions inside templates use the escaped (or raw) column values; template
   * directives (`{if/}`, `{case/}`, `{loop/}` ...) are evaluated over the row like APEX does for
   * report HTML expressions. `&ITEM.` session state is substituted first.
   */
  substituteRow(template: string, row: Row, escape = true): string {
    if (!template) return '';
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(row))
      values[key.toUpperCase()] = value === null || value === undefined ? '' : String(value);
    const substituted = this.renderer.substitute(this.ctx.session, template, this.ctx.page, 'HTML');
    return applyTemplate(substituted, values, {
      defaultEscape: escape ? 'HTML' : false,
      removeUnknown: false,
    });
  }

  /** Cell HTML. `trigger` is the JavaScript expression used as triggering element for dialog links. */
  html(column: ApxComponent, row: Row, trigger?: string): string {
    const type = str(column.props, 'type', 'plainText');
    // Column types owned by other modules (e.g. template components) render themselves.
    const custom = columnRenderer(type);
    if (custom) return custom(this.renderer, this.ctx, this.region, column, row);
    const value = this.text(column, row);
    let html = this.escapes(column) ? escapeHtml(value) : value;
    const expression =
      str(column.props, 'columnFormatting.htmlExpression') || str(column.props, 'settings.htmlExpression');
    if (expression) html = this.substituteRow(expression, row);
    const target = get(column.props, 'link.target');
    if (type === 'link' || target !== undefined) {
      const text = this.substituteRow(
        str(column.props, 'link.linkText', `#${column.id.toUpperCase()}#`),
        row,
      );
      const attributes = this.substituteRow(str(column.props, 'link.linkAttributes'), row);
      const href = this.renderer.link(
        this.ctx,
        target,
        row,
        trigger ?? `apex.jQuery('#${this.renderer.regionDomId(this.region)}')`,
      );
      html = `<a href="${escapeHtml(href)}"${attributes ? ` ${attributes}` : ''}>${text}</a>`;
    }
    if (type === 'percentGraph' || /^pct_graph/iu.test(str(column.props, 'appearance.formatMask'))) {
      const percent = Math.max(0, Math.min(100, Number(row[column.id.toUpperCase()]) || 0));
      html = `<div class="a-Report-percentChart"><div class="a-Report-percentChart-fill" style="width:${percent}%"></div><span class="u-VisuallyHidden">${percent}%</span></div>`;
    }
    return html;
  }

  heading(column: ApxComponent): string {
    const explicit = get(column.props, 'heading.heading');
    if (explicit !== undefined)
      return this.renderer.substitute(this.ctx.session, str(column.props, 'heading.heading'), this.ctx.page);
    const type = str(this.region.props, 'heading.type');
    if (type === 'none') return '';
    if (type === 'columnNames') return escapeHtml(column.id.toUpperCase());
    return escapeHtml(initcap(column.id));
  }

  /** Heading without markup, for menus and chips. */
  label(column: ApxComponent): string {
    const html = this.heading(column)
      .replace(/<[^>]*>/gu, '')
      .trim();
    return (
      html
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#x27;', "'")
        .replaceAll('&amp;', '&') || initcap(column.id)
    );
  }
}

/** Heading alignment class: `heading.alignment`, falling back to the column alignment. */
export function headingAlignment(renderer: ApexRenderer, column: ApxComponent, sample: unknown): string {
  const alignment = str(column.props, 'heading.alignment');
  if (/end|right/u.test(alignment)) return 'u-tR';
  if (/center/u.test(alignment)) return 'u-tC';
  if (/start|left/u.test(alignment)) return 'u-tL';
  return renderer.alignment(column, sample);
}

function numeric(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value.replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function compareValues(a: unknown, b: unknown): number {
  const left = numeric(a);
  const right = numeric(b);
  if (left !== undefined && right !== undefined) return left - right;
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}

const isEmpty = (value: unknown) => value === null || value === undefined || value === '';

/** IR (`=`, `contains`) and IG (`equals`, `contains`) operator names share one implementation. */
const OPERATOR_ALIASES: Record<string, string> = {
  equals: '=',
  notEquals: '!=',
  greaterThan: '>',
  greaterThanOrEquals: '>=',
  lessThan: '<',
  lessThanOrEquals: '<=',
  isEmpty: 'isNull',
  isNotEmpty: 'isNotNull',
  notContains: 'doesNotContain',
  inTheLast: 'isInTheLast',
  notInTheLast: 'isNotInTheLast',
  inTheNext: 'isInTheNext',
  notInTheNext: 'isNotInTheNext',
  matchesRegularExpression: 'regexp',
};

export const OPERATOR_LABELS: Record<string, string> = {
  '=': '=',
  '!=': '!=',
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
  contains: 'contains',
  doesNotContain: 'does not contain',
  startsWith: 'starts with',
  isNull: 'is empty',
  isNotNull: 'is not empty',
  like: 'like',
  notLike: 'not like',
  in: 'in',
  notIn: 'not in',
  between: 'between',
  notBetween: 'not between',
  regexp: 'matches regular expression',
  isInTheLast: 'is in the last',
  isNotInTheLast: 'is not in the last',
  isInTheNext: 'is in the next',
  isNotInTheNext: 'is not in the next',
};

export function normalizeOperator(operator: string): string {
  return OPERATOR_ALIASES[operator] ?? operator;
}

export const SUPPORTED_OPERATORS = new Set(Object.keys(OPERATOR_LABELS));

function likeRegex(pattern: string): RegExp {
  const source = pattern
    .split('')
    .map((char) => (char === '%' ? '.*' : char === '_' ? '.' : char.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')))
    .join('');
  return new RegExp(`^${source}$`, 'isu');
}

const UNIT_MS: Record<string, number> = {
  min: 60_000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 604_800_000,
  months: 2_629_800_000,
  years: 31_557_600_000,
};

function dateOf(raw: unknown): number | undefined {
  if (isEmpty(raw)) return undefined;
  const time = new Date(typeof raw === 'number' ? raw : String(raw).replace(' ', 'T')).getTime();
  return Number.isNaN(time) ? undefined : time;
}

/** `isInTheLast 2 days` and friends, relative to now. */
function inWindow(raw: unknown, amount: string, unit: string | undefined, future: boolean, now = Date.now()) {
  const time = dateOf(raw);
  if (time === undefined) return false;
  const span = (Number(amount) || 0) * (UNIT_MS[unit ?? 'days'] ?? UNIT_MS.days!);
  return future ? time >= now && time <= now + span : time <= now && time >= now - span;
}

/** True when the raw value or its display text satisfies the filter. */
export function matches(filter: ReportFilter, raw: unknown, display: string): boolean {
  const operator = normalizeOperator(filter.operator);
  const value = filter.value;
  const text = display.toLowerCase();
  const needle = value.toLowerCase();
  const equalsEither = (candidate: string) =>
    (!isEmpty(raw) && compareValues(raw, candidate) === 0 && numeric(raw) !== undefined) ||
    String(raw ?? '') === candidate ||
    display === candidate;
  switch (operator) {
    case '=':
      return equalsEither(value);
    case '!=':
      return !equalsEither(value);
    case '>':
      return !isEmpty(raw) && compareValues(raw, value) > 0;
    case '>=':
      return !isEmpty(raw) && compareValues(raw, value) >= 0;
    case '<':
      return !isEmpty(raw) && compareValues(raw, value) < 0;
    case '<=':
      return !isEmpty(raw) && compareValues(raw, value) <= 0;
    case 'contains':
      return text.includes(needle);
    case 'doesNotContain':
      return !text.includes(needle);
    case 'startsWith':
      return text.startsWith(needle);
    case 'isNull':
      return isEmpty(raw);
    case 'isNotNull':
      return !isEmpty(raw);
    case 'like':
      return likeRegex(value).test(display) || likeRegex(value).test(String(raw ?? ''));
    case 'notLike':
      return !likeRegex(value).test(display) && !likeRegex(value).test(String(raw ?? ''));
    case 'in':
      return value.split(',').some((entry) => equalsEither(entry.trim()));
    case 'notIn':
      return !value.split(',').some((entry) => equalsEither(entry.trim()));
    case 'between':
      return (
        !isEmpty(raw) && compareValues(raw, value) >= 0 && compareValues(raw, filter.value2 ?? value) <= 0
      );
    case 'notBetween':
      return (
        !isEmpty(raw) && !(compareValues(raw, value) >= 0 && compareValues(raw, filter.value2 ?? value) <= 0)
      );
    case 'regexp':
      try {
        return new RegExp(value, 'iu').test(display) || new RegExp(value, 'iu').test(String(raw ?? ''));
      } catch {
        return false;
      }
    case 'isInTheLast':
      return inWindow(raw, value, filter.unit, false);
    case 'isNotInTheLast':
      return dateOf(raw) !== undefined && !inWindow(raw, value, filter.unit, false);
    case 'isInTheNext':
      return inWindow(raw, value, filter.unit, true);
    case 'isNotInTheNext':
      return dateOf(raw) !== undefined && !inWindow(raw, value, filter.unit, true);
    default:
      return true;
  }
}

/** Applies enabled filters (row filters search every listed column) and the sort order. */
export function applyFiltersAndSort(
  rows: Row[],
  cells: Cells,
  columns: Map<string, ApxComponent>,
  searchable: ApxComponent[],
  filters: ReportFilter[],
  sort: ReportSort[],
): Row[] {
  let result = rows;
  for (const filter of filters) {
    if (!filter.enabled) continue;
    if (!filter.column) {
      const needle = filter.value.toLowerCase();
      result = result.filter((row) =>
        searchable.some((column) => cells.text(column, row).toLowerCase().includes(needle)),
      );
      continue;
    }
    const column = columns.get(filter.column);
    if (!column) continue;
    result = result.filter((row) => matches(filter, row[filter.column], cells.text(column, row)));
  }
  const order = sort.filter((entry) => columns.has(entry.column));
  if (order.length) {
    result = [...result].sort((a, b) => {
      for (const entry of order) {
        const column = columns.get(entry.column)!;
        const lov = cells.lov(column);
        const left = lov ? cells.text(column, a) : a[entry.column];
        const right = lov ? cells.text(column, b) : b[entry.column];
        const direction = entry.direction === 'desc' ? -1 : 1;
        // Oracle default: nulls last ascending, first descending.
        const nullsFirst = entry.nulls ? entry.nulls === 'first' : entry.direction === 'desc';
        if (isEmpty(left) || isEmpty(right)) {
          if (isEmpty(left) && isEmpty(right)) continue;
          return isEmpty(left) === nullsFirst ? -1 : 1;
        }
        const compared = compareValues(left, right);
        if (compared) return compared * direction;
      }
      return 0;
    });
  }
  return result;
}

export function filterLabel(filter: ReportFilter, label: string): string {
  const operator = normalizeOperator(filter.operator);
  if (!filter.column) return `Row text contains '${filter.value}'`;
  if (operator === 'isNull' || operator === 'isNotNull') return `${label} ${OPERATOR_LABELS[operator]}`;
  if (operator === 'between' || operator === 'notBetween')
    return `${label} ${OPERATOR_LABELS[operator]} '${filter.value}' and '${filter.value2 ?? ''}'`;
  if (/^isN?o?t?In/u.test(operator) && filter.unit)
    return `${label} ${OPERATOR_LABELS[operator]} ${filter.value} ${filter.unit}`;
  if (operator === 'in' || operator === 'notIn')
    return `${label} ${OPERATOR_LABELS[operator]} '${filter.value.split(',').join(`', '`)}'`;
  return `${label} ${OPERATOR_LABELS[operator] ?? operator} '${filter.value}'`;
}

/** Saved-report `filter` children; unsupported filter kinds are reported. */
export function savedFilters(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  saved: ApxComponent | undefined,
): ReportFilter[] {
  const filters: ReportFilter[] = [];
  for (const child of saved?.children.filter((entry) => entry.type === 'filter') ?? []) {
    const type = str(child.props, 'type', 'column');
    const enabled = bool(child.props, 'advanced.enabled', bool(child.props, 'enabled', true));
    if (type === 'rowSearch') {
      filters.push({ column: '', operator: 'contains', value: str(child.props, 'search'), enabled });
      continue;
    }
    const operator = normalizeOperator(str(child.props, 'operator', '='));
    if (type !== 'column' || !SUPPORTED_OPERATORS.has(operator)) {
      renderer.diagnose(
        'info',
        `Saved report filter ${type === 'column' ? `operator ${operator}` : type} in ${region.id} is not simulated`,
        ctx.pageId,
        region.id,
      );
      continue;
    }
    filters.push({
      column: (ref(child.props, 'column') ?? '').toUpperCase(),
      operator,
      value: str(child.props, 'value', str(child.props, 'from')),
      ...(str(child.props, 'to') ? { value2: str(child.props, 'to') } : {}),
      ...(str(child.props, 'unit') ? { unit: str(child.props, 'unit') } : {}),
      enabled,
    });
  }
  return filters;
}

/** Saved-report `sort` children (IR and IG share the shape). */
export function savedSorts(saved: ApxComponent | undefined): ReportSort[] {
  return bySequence(saved?.children.filter((entry) => entry.type === 'sort') ?? [])
    .sort((a, b) => num(a.props, 'sort.sequence', 0) - num(b.props, 'sort.sequence', 0))
    .map((entry) => {
      const nulls = str(entry.props, 'sort.nulls');
      return {
        column: columnRef(entry),
        direction: str(entry.props, 'sort.direction', 'asc') === 'desc' ? 'desc' : 'asc',
        ...(nulls === 'first' || nulls === 'last' ? { nulls } : {}),
      } satisfies ReportSort;
    });
}

export interface SavedReportSupport {
  /** Saved-report child types the caller simulates. */
  children?: Set<string>;
  /** Default views the caller simulates besides `report` and `grid`. */
  views?: Set<string>;
  /** True when the caller offers alternative/public saved reports. */
  alternatives?: boolean;
}

/** Reports saved-report children and settings that are not simulated. */
export function diagnoseSavedReport(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  saved: ApxComponent | undefined,
  support: SavedReportSupport = {},
): void {
  if (!saved) return;
  const unsupported = new Set(
    ['aggregate', 'computation', 'controlBreak', 'highlight'].filter((type) => !support.children?.has(type)),
  );
  for (const child of saved.children)
    if (unsupported.has(child.type))
      renderer.diagnose(
        'info',
        `Saved report ${child.type} in ${region.id} is not simulated`,
        ctx.pageId,
        region.id,
      );
  const view = str(saved.props, 'view.default');
  if (view && view !== 'report' && view !== 'grid' && !support.views?.has(view))
    renderer.diagnose(
      'info',
      `Saved report view ${view} in ${region.id} is shown as a report`,
      ctx.pageId,
      region.id,
    );
  if (get(saved.props, 'flashback.minutesAgo') !== undefined)
    renderer.diagnose('info', `Flashback in ${region.id} is not simulated`, ctx.pageId, region.id);
  const others = region.children.filter(
    (child) =>
      child.type === 'savedReport' && child !== saved && !/^primary/u.test(str(child.props, 'visibility')),
  );
  if (others.length && !support.alternatives)
    renderer.diagnose(
      'info',
      `${others.length} alternative/public saved report(s) of ${region.id} are not offered locally`,
      ctx.pageId,
      region.id,
    );
}

/** Row values as text for CSV export. */
export function toCsv(headings: string[], rows: string[][], separator = ',', enclosure = '"'): string {
  const quote = (value: string) =>
    enclosure && (value.includes(separator) || value.includes(enclosure) || /[\r\n]/u.test(value))
      ? `${enclosure}${value.replaceAll(enclosure, enclosure + enclosure)}${enclosure}`
      : value;
  return [headings, ...rows].map((line) => line.map(quote).join(separator)).join('\r\n') + '\r\n';
}

export function stringList(values: ReturnType<typeof list>): string[] {
  return values.map((value) =>
    typeof value === 'string' ? value : isRef(value) ? value.ref : String(value),
  );
}

/** Rows above the processing limit are dropped and reported with `whenMoreDataFound`. */
export function rowLimit(region: ApxComponent, fallback: number): number {
  return Math.max(1, num(region.props, 'performance.maxRowsToProcess', fallback));
}
