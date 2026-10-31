import { bool, num, ref, str, type ApxComponent } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { ApexRenderer, RenderContext, Session } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import { chartModel, type ChartSeries } from '../charts/model.ts';
import { renderChartSvg } from '../charts/svg.ts';
import {
  bySequence,
  type Cells,
  columnRef,
  compareValues,
  formatValue,
  matches,
  normalizeOperator,
  SUPPORTED_OPERATORS,
  type ReportSort,
  type ReportState,
} from './shared.ts';

/**
 * Interactive report Actions-menu views and formatting: control breaks, highlights, computed
 * columns, aggregates, group by, pivot and chart views, and named saved reports per session.
 * Everything is evaluated over the rows the report already filtered and sorted.
 */

export interface IrBreak {
  column: string;
  enabled: boolean;
}

export interface IrHighlight {
  name: string;
  type: 'row' | 'cell';
  column: string;
  operator: string;
  value: string;
  value2?: string | undefined;
  unit?: string | undefined;
  background: string;
  text: string;
  enabled: boolean;
  sequence: number;
  /** Interactive grid cell highlights name the highlighted column separately from the condition. */
  target?: string | undefined;
}

export interface IrComputation {
  /** Column name of the computed value (APEX uses APXWS_CC_001 ...). */
  name: string;
  label: string;
  /** SQL expression over column identifiers (A, B, ...) or column names. */
  expression: string;
  formatMask: string;
}

export interface IrAggregate {
  fn: string;
  column: string;
  /** Interactive grid: show the overall value too (APEX `showGrandTotal`). */
  grandTotal?: boolean;
  enabled?: boolean;
}

export interface IrFunction {
  fn: string;
  column: string;
  label: string;
  formatMask: string;
  sum: boolean;
}

export interface IrGroupBy {
  columns: string[];
  functions: IrFunction[];
  sort: ReportSort[];
}

export interface IrPivot {
  pivot: string[];
  rows: string[];
  functions: IrFunction[];
  sort: ReportSort[];
}

export interface IrChart {
  type: string;
  label: string;
  value: string;
  fn: string;
  orientation: 'vertical' | 'horizontal';
  sort: string;
  labelTitle: string;
  valueTitle: string;
}

export type IrView = 'report' | 'groupBy' | 'pivot' | 'chart';

export interface IrViews {
  breaks: IrBreak[];
  highlights: IrHighlight[];
  computations: IrComputation[];
  aggregates: IrAggregate[];
  groupBy?: IrGroupBy | undefined;
  pivot?: IrPivot | undefined;
  chart?: IrChart | undefined;
  view: IrView;
  /** Single row view: position of the row in the filtered and sorted rows. */
  single?: number | undefined;
}

export const emptyViews = (): IrViews => ({
  breaks: [],
  highlights: [],
  computations: [],
  aggregates: [],
  view: 'report',
});

export const AGGREGATE_LABELS: Record<string, string> = {
  sum: 'Sum',
  average: 'Average',
  count: 'Count',
  countDistinct: 'Count Distinct',
  min: 'Minimum',
  max: 'Maximum',
  median: 'Median',
  percentOfTotalSum: 'Percent of Total Sum',
  percentOfTotalCount: 'Percent of Total Count',
  ratioToReportSum: 'Ratio to Report Sum',
  ratioToReportCount: 'Ratio to Report Count',
};

export const CHART_TYPES = new Set(['bar', 'line', 'lineWithArea', 'pie']);

// ---------------------------------------------------------------- saved-report definitions

const upper = (value: string | undefined) => (value ?? '').toUpperCase();

function children(saved: ApxComponent, type: string): ApxComponent[] {
  return bySequence(saved.children.filter((child) => child.type === type));
}

function functionsOf(saved: ApxComponent, type: string): IrFunction[] {
  return children(saved, type).map((child) => {
    const fn = str(child.props, 'aggregate.function', str(child.props, 'function', 'sum'));
    const column = upper(ref(child.props, 'aggregate.column') ?? ref(child.props, 'column'));
    return {
      fn,
      column,
      label: str(child.props, 'heading', `${AGGREGATE_LABELS[fn] ?? fn} ${column}`.trim()),
      formatMask: str(child.props, 'appearance.formatMask'),
      sum: bool(child.props, 'aggregate.displaySum', false),
    };
  });
}

function sortsOf(saved: ApxComponent, type: string): ReportSort[] {
  return children(saved, type)
    .sort((a, b) => num(a.props, 'sort.sequence', 0) - num(b.props, 'sort.sequence', 0))
    .map((child) => {
      const nulls = str(child.props, 'sort.nulls');
      return {
        column: columnRef(child),
        direction: str(child.props, 'sort.direction', 'asc') === 'desc' ? 'desc' : 'asc',
        ...(nulls === 'first' || nulls === 'last' ? { nulls } : {}),
      } satisfies ReportSort;
    });
}

/** Breaks, highlights, computations, aggregates and views of an APEXlang saved report. */
export function savedViews(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  saved: ApxComponent | undefined,
): IrViews {
  const views = emptyViews();
  if (!saved) return views;
  const note = (message: string) => renderer.diagnose('info', message, ctx.pageId, region.id);
  views.breaks = children(saved, 'controlBreak').map((child) => ({
    column: columnRef(child),
    enabled: bool(child.props, 'advanced.enabled', true),
  }));
  views.highlights = saved.children
    .filter((child) => child.type === 'highlight')
    .map((child, index): IrHighlight => {
      const operator = normalizeOperator(str(child.props, 'condition.operator', '='));
      if (!SUPPORTED_OPERATORS.has(operator))
        note(
          `Highlight ${str(child.props, 'name', child.id)} in ${region.id}: operator ${operator} is not simulated`,
        );
      return {
        name: str(child.props, 'name', child.id || `Highlight ${index + 1}`),
        type: str(child.props, 'highlight.type', 'row') === 'cell' ? 'cell' : 'row',
        column: upper(ref(child.props, 'condition.column')),
        operator,
        value: str(child.props, 'condition.value', str(child.props, 'condition.from')),
        value2: str(child.props, 'condition.to') || undefined,
        unit: str(child.props, 'condition.unit') || undefined,
        background: str(child.props, 'colors.background'),
        text: str(child.props, 'colors.text'),
        enabled: bool(child.props, 'advanced.enabled', true),
        sequence: num(child.props, 'execution.sequence', (index + 1) * 10),
      };
    })
    .sort((a, b) => a.sequence - b.sequence);
  views.computations = saved.children
    .filter((child) => child.type === 'computation')
    .map((child, index) => {
      const name = upper(str(child.props, 'columnName')) || `APXWS_CC_${String(index + 1).padStart(3, '0')}`;
      return {
        name,
        label: str(child.props, 'label.column', name),
        expression: str(child.props, 'source.expression'),
        formatMask: str(child.props, 'appearance.formatMask'),
      };
    });
  views.aggregates = saved.children
    .filter((child) => child.type === 'aggregate')
    .map((child) => ({ fn: str(child.props, 'function', 'sum'), column: columnRef(child) }));
  const groupColumns = children(saved, 'groupByColumn').map(columnRef);
  if (groupColumns.length)
    views.groupBy = {
      columns: groupColumns,
      functions: functionsOf(saved, 'groupByAggregate'),
      sort: sortsOf(saved, 'groupBySort'),
    };
  const pivotColumns = children(saved, 'pivotColumn').map(columnRef);
  if (pivotColumns.length)
    views.pivot = {
      pivot: pivotColumns,
      rows: children(saved, 'pivotRowColumn').map(columnRef),
      functions: functionsOf(saved, 'pivotAggregate'),
      sort: sortsOf(saved, 'pivotSort'),
    };
  const chartType = str(saved.props, 'chart.type');
  if (bool(saved.props, 'view.chart', false) || chartType) {
    views.chart = {
      type: CHART_TYPES.has(chartType) ? chartType : 'bar',
      label: upper(ref(saved.props, 'chart.label')),
      value: upper(ref(saved.props, 'chart.value')),
      fn: str(saved.props, 'chart.valueAggregation', 'sum'),
      orientation:
        str(saved.props, 'chartAppearance.orientation') === 'horizontal' ? 'horizontal' : 'vertical',
      sort: str(saved.props, 'sort.by', 'default'),
      labelTitle: str(saved.props, 'axisTitle.label'),
      valueTitle: str(saved.props, 'axisTitle.value'),
    };
  }
  const view = str(saved.props, 'view.default', 'report');
  if (view === 'groupBy' && views.groupBy) views.view = 'groupBy';
  else if (view === 'pivot' && views.pivot) views.view = 'pivot';
  else if (view === 'chart' && views.chart) views.view = 'chart';
  return views;
}

/** Control breaks, highlights and aggregates of an interactive grid saved report. */
export function gridViews(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  saved: ApxComponent | undefined,
): IrViews {
  const views = emptyViews();
  if (!saved) return views;
  views.breaks = children(saved, 'controlBreak').map((child) => ({
    column: columnRef(child),
    enabled: bool(child.props, 'advanced.enabled', true),
  }));
  views.highlights = saved.children
    .filter((child) => child.type === 'highlight')
    .map((child, index): IrHighlight => {
      const rowSearch = str(child.props, 'condition.type', 'column') === 'rowSearch';
      const operator = rowSearch
        ? 'contains'
        : normalizeOperator(str(child.props, 'condition.operator', 'equals'));
      if (!SUPPORTED_OPERATORS.has(operator))
        renderer.diagnose(
          'info',
          `Highlight ${str(child.props, 'name', child.id)} in ${region.id}: operator ${operator} is not simulated`,
          ctx.pageId,
          region.id,
        );
      const condition = rowSearch ? '' : upper(ref(child.props, 'condition.column'));
      return {
        name: str(child.props, 'name', child.id || `Highlight ${index + 1}`),
        type: str(child.props, 'highlight.type', 'row') === 'cell' ? 'cell' : 'row',
        column: condition,
        operator,
        value: rowSearch
          ? str(child.props, 'condition.search')
          : str(child.props, 'condition.value', str(child.props, 'condition.from')),
        value2: str(child.props, 'condition.to') || undefined,
        unit: str(child.props, 'condition.unit') || undefined,
        background: str(child.props, 'colors.background'),
        text: str(child.props, 'colors.text'),
        enabled: bool(child.props, 'advanced.enabled', true),
        sequence: num(child.props, 'execution.sequence', (index + 1) * 10),
        target: upper(ref(child.props, 'highlight.column')) || condition || undefined,
      };
    })
    .sort((a, b) => a.sequence - b.sequence);
  views.aggregates = saved.children
    .filter((child) => child.type === 'aggregate')
    .map((child) => ({
      fn: str(child.props, 'function', 'sum'),
      column: columnRef(child),
      grandTotal: bool(child.props, 'showGrandTotal', true),
      enabled: bool(child.props, 'advanced.enabled', true),
    }));
  return views;
}

// ---------------------------------------------------------------- saved reports per session

export interface PrivateReport {
  id: string;
  name: string;
  description: string;
  state: ReportState;
}

export interface ReportSelection {
  /** '' is the primary report; `s:<id>` an APEXlang saved report; `p:<n>` a private report. */
  current: string;
  privates: PrivateReport[];
  next: number;
}

const SELECTIONS = new WeakMap<Session, Map<string, ReportSelection>>();

export function reportSelection(session: Session, key: string): ReportSelection {
  let map = SELECTIONS.get(session);
  if (!map) SELECTIONS.set(session, (map = new Map()));
  let selection = map.get(key);
  if (!selection) map.set(key, (selection = { current: '', privates: [], next: 1 }));
  return selection;
}

export interface NamedReport {
  id: string;
  name: string;
  group: 'default' | 'public' | 'private';
  primary: boolean;
  component?: ApxComponent;
}

/** APEXlang saved reports (primary, alternative and public) of a region. */
export function definedReports(region: ApxComponent): NamedReport[] {
  return region.children
    .filter((child) => child.type === 'savedReport')
    .map((child, index) => {
      const visibility = str(child.props, 'visibility', 'primaryDefault');
      const primary = /^primary/u.test(visibility);
      return {
        id: `s:${child.id || index}`,
        name: str(child.props, 'name') || (primary ? 'Primary Report' : `Report ${index + 1}`),
        group: /^(public|private)$/u.test(visibility) ? 'public' : 'default',
        primary,
        component: child,
      } satisfies NamedReport;
    })
    .filter((report) => !/^private$/u.test(str(report.component.props, 'visibility')));
}

export function reportList(region: ApxComponent, selection: ReportSelection): NamedReport[] {
  return [
    ...definedReports(region),
    ...selection.privates.map((report) => ({
      id: report.id,
      name: report.name,
      group: 'private' as const,
      primary: false,
    })),
  ];
}

/** Session copy of a report state (pending grid changes and selections are not part of it). */
export function snapshot(state: ReportState): ReportState {
  const { pending: _pending, selected: _selected, ...rest } = state;
  void _pending;
  void _selected;
  return JSON.parse(JSON.stringify(rest)) as ReportState;
}

// ---------------------------------------------------------------- computations

const RESERVED = new Set([
  'AND',
  'OR',
  'NOT',
  'IS',
  'IN',
  'AS',
  'NULL',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'LIKE',
  'BETWEEN',
  'DATE',
]);

/** Column identifiers like APEX assigns them: A, B, ... Z, AA, AB ... in column order. */
export function identifiers(columns: ApxComponent[]): { id: string; name: string }[] {
  const id = (index: number) => {
    let name = '';
    for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26))
      name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
    return name;
  };
  return columns.map((column, index) => ({ id: id(index), name: column.id.toUpperCase() }));
}

/** Rewrites identifiers and column names of a computation expression to subquery columns. */
export function computationSql(
  expression: string,
  ids: { id: string; name: string }[],
  alias = 'apex_local_q',
): string {
  const byId = new Map(ids.map((entry) => [entry.id, entry.name]));
  const names = new Set(ids.map((entry) => entry.name));
  return expression.replace(/'(?:[^']|'')*'|"[^"]*"|\b[A-Za-z][\w$#]*\b(?!\s*\()/gu, (token) => {
    if (token.startsWith("'") || token.startsWith('"')) return token;
    const key = token.toUpperCase();
    if (RESERVED.has(key)) return token;
    const name = byId.get(key) ?? (names.has(key) ? key : undefined);
    return name ? `${alias}."${name}"` : token;
  });
}

/** The region query with computed columns appended. */
export function computedQuery(
  sql: string,
  computations: IrComputation[],
  ids: { id: string; name: string }[],
): string {
  const parts = computations.map(
    (computation) => `(${computationSql(computation.expression, ids)}) as "${computation.name}"`,
  );
  return `select apex_local_q.*, ${parts.join(', ')} from (${sql}) apex_local_q`;
}

/** Synthetic column components for computed columns (heading and format mask). */
export function computedColumns(computations: IrComputation[]): ApxComponent[] {
  return computations.map((computation) => ({
    type: 'column',
    id: computation.name,
    props: {
      type: 'plainText',
      heading: { heading: escapeHtml(computation.label) },
      ...(computation.formatMask ? { appearance: { formatMask: computation.formatMask } } : {}),
    },
    children: [],
    file: '',
    line: 0,
  }));
}

export function nextComputationName(views: IrViews): string {
  const used = new Set(views.computations.map((computation) => computation.name));
  for (let index = 1; ; index += 1) {
    const name = `APXWS_CC_${String(index).padStart(3, '0')}`;
    if (!used.has(name)) return name;
  }
}

// ---------------------------------------------------------------- highlights

export interface RowHighlight {
  row?: string;
  cells: Map<string, string>;
}

const colorStyle = (highlight: IrHighlight) =>
  [
    highlight.background ? `background-color:${highlight.background}` : '',
    highlight.text ? `color:${highlight.text}` : '',
  ]
    .filter(Boolean)
    .join(';');

/** Inline styles of the highlights matching a row; the lowest sequence wins. */
export function highlightRow(
  highlights: IrHighlight[],
  row: Row,
  cells: Cells,
  byName: Map<string, ApxComponent>,
): RowHighlight {
  const result: RowHighlight = { cells: new Map() };
  for (const highlight of highlights) {
    if (!highlight.enabled) continue;
    const column = byName.get(highlight.column);
    if (!column && highlight.column) continue;
    const needle = highlight.value.toLowerCase();
    const ok = !column
      ? [...byName.values()].some((entry) => cells.text(entry, row).toLowerCase().includes(needle))
      : matches(
          {
            column: highlight.column,
            operator: highlight.operator,
            value: highlight.value,
            ...(highlight.value2 ? { value2: highlight.value2 } : {}),
            ...(highlight.unit ? { unit: highlight.unit } : {}),
            enabled: true,
          },
          row[highlight.column],
          cells.text(column, row),
        );
    if (!ok) continue;
    const style = colorStyle(highlight);
    const target = highlight.target ?? highlight.column;
    if (highlight.type === 'row') result.row ??= style;
    else if (!result.cells.has(target)) result.cells.set(target, style);
  }
  return result;
}

// ---------------------------------------------------------------- aggregates

const numberOf = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(String(value).replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Raw aggregate over values; percent functions need the report total. */
export function aggregateValue(fn: string, values: unknown[], total?: unknown[]): number | string | null {
  const present = values.filter((value) => value !== null && value !== undefined && value !== '');
  const numbers = present.map(numberOf).filter((value) => value !== undefined);
  const sum = (list: number[]) => list.reduce((acc, value) => acc + value, 0);
  switch (fn) {
    case 'count':
      return present.length;
    case 'countDistinct':
      return new Set(present.map(String)).size;
    case 'sum':
      return numbers.length ? sum(numbers) : null;
    case 'average':
      return numbers.length ? sum(numbers) / numbers.length : null;
    case 'median': {
      if (!numbers.length) return null;
      const sorted = [...numbers].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
    }
    case 'min':
    case 'max': {
      if (!present.length) return null;
      const ordered = [...present].sort(compareValues);
      const value = fn === 'min' ? ordered[0] : ordered[ordered.length - 1];
      return typeof value === 'number' || typeof value === 'string' ? value : String(value);
    }
    case 'percentOfTotalSum':
    case 'ratioToReportSum': {
      const all = sum((total ?? values).map(numberOf).filter((value) => value !== undefined));
      return all ? (sum(numbers) / all) * 100 : null;
    }
    case 'percentOfTotalCount':
    case 'ratioToReportCount': {
      const all = (total ?? values).filter(
        (value) => value !== null && value !== undefined && value !== '',
      ).length;
      return all ? (present.length / all) * 100 : null;
    }
    default:
      return null;
  }
}

/** Display text of an aggregate, using the column (or function) format mask. */
export function aggregateText(fn: string, value: number | string | null, mask: string): string {
  if (value === null) return '';
  if (fn === 'count' || fn === 'countDistinct') return String(value);
  if (typeof value === 'string') return value;
  if (/^(percentOf|ratioTo)/u.test(fn) && !mask) return `${Math.round(value * 100) / 100}%`;
  if (mask) return formatValue(value, mask);
  return String(Math.round(value * 1000) / 1000);
}

export function aggregateLabel(fn: string, overall: boolean): string {
  const label = AGGREGATE_LABELS[fn] ?? fn;
  return overall ? `Overall ${label}` : label;
}

// ---------------------------------------------------------------- group by and pivot

export interface ViewModel {
  rows: Row[];
  cells: Cells;
  byName: Map<string, ApxComponent>;
}

interface Table {
  html: string;
  rows: number;
}

const columnLabel = (model: ViewModel, name: string) => {
  const column = model.byName.get(name);
  return column ? model.cells.label(column) : name;
};

const display = (model: ViewModel, name: string, row: Row) => {
  const column = model.byName.get(name);
  return column ? model.cells.text(column, row) : String(row[name] ?? '');
};

const maskOf = (model: ViewModel, fn: IrFunction) => {
  const column = model.byName.get(fn.column);
  return fn.formatMask || (column ? str(column.props, 'appearance.formatMask') : '');
};

function groupRows(rows: Row[], key: (row: Row) => string): Map<string, Row[]> {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const value = key(row);
    let group = groups.get(value);
    if (!group) groups.set(value, (group = []));
    group.push(row);
  }
  return groups;
}

const keyOf = (columns: string[]) => (row: Row) =>
  JSON.stringify(columns.map((name) => (row[name] === null || row[name] === undefined ? '' : row[name])));

function sortGroups(
  entries: { first: Row; values: (number | string | null)[] }[],
  columns: string[],
  functions: IrFunction[],
  sort: ReportSort[],
): void {
  const order: ReportSort[] = sort.length ? sort : columns.map((column) => ({ column, direction: 'asc' }));
  entries.sort((a, b) => {
    for (const entry of order) {
      const fn = functions.findIndex((candidate) => candidate.label.toUpperCase() === entry.column);
      const left = fn >= 0 ? a.values[fn] : a.first[entry.column];
      const right = fn >= 0 ? b.values[fn] : b.first[entry.column];
      const empty = (value: unknown) => value === null || value === undefined || value === '';
      if (empty(left) || empty(right)) {
        if (empty(left) && empty(right)) continue;
        return empty(left) ? 1 : -1;
      }
      const compared = compareValues(left, right);
      if (compared) return entry.direction === 'desc' ? -compared : compared;
    }
    return 0;
  });
}

const numericClass = (fn: string) => (fn === 'min' || fn === 'max' ? '' : ' u-tR');

/** Group By view: one row per distinct combination of the group columns. */
export function groupByTable(model: ViewModel, spec: IrGroupBy, domId: string): Table {
  const columns = spec.columns.filter((name) => model.byName.has(name));
  const functions = spec.functions.filter((fn) => fn.fn === 'count' || model.byName.has(fn.column));
  const groups = [...groupRows(model.rows, keyOf(columns)).values()].map((rows) => ({
    first: rows[0]!,
    rows,
    values: functions.map((fn) =>
      aggregateValue(
        fn.fn,
        rows.map((row) => (fn.column ? row[fn.column] : 1)),
        model.rows.map((row) => (fn.column ? row[fn.column] : 1)),
      ),
    ),
  }));
  sortGroups(groups, columns, functions, spec.sort);
  const id = escapeHtml(domId);
  const header = `<tr>${columns.map((name) => `<th class="a-IRR-header" id="${id}_gb_${escapeHtml(name)}">${escapeHtml(columnLabel(model, name))}</th>`).join('')}${functions
    .map(
      (fn, index) =>
        `<th class="a-IRR-header${numericClass(fn.fn)}" id="${id}_gbf_${index}">${escapeHtml(fn.label)}</th>`,
    )
    .join('')}</tr>`;
  const body = groups
    .map(
      (group) =>
        `<tr>${columns.map((name) => `<td>${escapeHtml(display(model, name, group.first))}</td>`).join('')}${functions
          .map(
            (fn, index) =>
              `<td class="${numericClass(fn.fn).trim()}">${escapeHtml(aggregateText(fn.fn, group.values[index] ?? null, maskOf(model, fn)))}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');
  const sums = functions.some((fn) => fn.sum)
    ? `<tr>${columns.map((_name, index) => `<td class="a-IRR-aggregate">${index === 0 ? '<span class="a-IRR-aggregateLabel">Sum</span>' : ''}</td>`).join('')}${functions
        .map((fn, index) => {
          if (!fn.sum) return '<td class="a-IRR-aggregate"></td>';
          const total = groups.reduce((acc, group) => acc + (numberOf(group.values[index]) ?? 0), 0);
          return `<td class="a-IRR-aggregate u-tR">${escapeHtml(aggregateText(fn.fn === 'count' || fn.fn === 'countDistinct' ? 'count' : 'sum', total, maskOf(model, fn)))}</td>`;
        })
        .join('')}</tr>`
    : '';
  return {
    rows: groups.length,
    html: `<table class="a-IRR-table" id="${id}_group_by_table" aria-label="Group By">${header}${body}${sums}</table>`,
  };
}

const PIVOT_LIMIT = 100;

/** Pivot view: row columns down, distinct pivot column values across, one cell per function. */
export function pivotTable(
  renderer: ApexRenderer,
  ctx: RenderContext,
  regionId: string,
  model: ViewModel,
  spec: IrPivot,
  domId: string,
): Table {
  const pivot = spec.pivot.filter((name) => model.byName.has(name));
  const rowColumns = spec.rows.filter((name) => model.byName.has(name));
  const functions = spec.functions.filter((fn) => fn.fn === 'count' || model.byName.has(fn.column));
  const pivotKey = keyOf(pivot);
  const pivotGroups = [...groupRows(model.rows, pivotKey).entries()]
    .map(([key, rows]) => ({ key, first: rows[0]! }))
    .sort((a, b) => {
      for (const name of pivot) {
        const compared = compareValues(a.first[name] ?? '', b.first[name] ?? '');
        if (compared) return compared;
      }
      return 0;
    });
  if (pivotGroups.length > PIVOT_LIMIT)
    renderer.diagnose(
      'info',
      `Pivot view of ${regionId} shows the first ${PIVOT_LIMIT} of ${pivotGroups.length} pivot values`,
      ctx.pageId,
      regionId,
    );
  const shown = pivotGroups.slice(0, PIVOT_LIMIT);
  const valuesFor = (rows: Row[], fn: IrFunction) =>
    aggregateValue(
      fn.fn,
      rows.map((row) => (fn.column ? row[fn.column] : 1)),
      model.rows.map((row) => (fn.column ? row[fn.column] : 1)),
    );
  const rowGroups = [...groupRows(model.rows, keyOf(rowColumns)).values()].map((rows) => {
    const byPivot = groupRows(rows, pivotKey);
    return {
      first: rows[0]!,
      cells: shown.map((group) => functions.map((fn) => valuesFor(byPivot.get(group.key) ?? [], fn))),
      values: [] as (number | string | null)[],
    };
  });
  sortGroups(rowGroups, rowColumns, [], spec.sort);
  const id = escapeHtml(domId);
  const span = Math.max(1, functions.length);
  const top = `<tr>${rowColumns.map((name) => `<th class="a-IRR-header a-IRR-header--pivotRow" rowspan="2">${escapeHtml(columnLabel(model, name))}</th>`).join('')}${shown
    .map(
      (group) =>
        `<th class="a-IRR-header a-IRR-header--pivotColumn u-tC" colspan="${span}">${escapeHtml(pivot.map((name) => display(model, name, group.first)).join(', ') || '-')}</th>`,
    )
    .join('')}</tr>`;
  const second = `<tr>${shown.map(() => functions.map((fn) => `<th class="a-IRR-header u-tR">${escapeHtml(fn.label)}</th>`).join('')).join('')}</tr>`;
  const body = rowGroups
    .map(
      (group) =>
        `<tr>${rowColumns.map((name) => `<td>${escapeHtml(display(model, name, group.first))}</td>`).join('')}${group.cells
          .map((values) =>
            values
              .map(
                (value, index) =>
                  `<td class="u-tR">${escapeHtml(aggregateText(functions[index]!.fn, value, maskOf(model, functions[index]!)))}</td>`,
              )
              .join(''),
          )
          .join('')}</tr>`,
    )
    .join('');
  const sums = functions.some((fn) => fn.sum)
    ? `<tr>${rowColumns.map((_name, index) => `<td class="a-IRR-aggregate">${index === 0 ? '<span class="a-IRR-aggregateLabel">Sum</span>' : ''}</td>`).join('')}${shown
        .map((_group, groupIndex) =>
          functions
            .map((fn, index) => {
              if (!fn.sum) return '<td class="a-IRR-aggregate"></td>';
              const total = rowGroups.reduce(
                (acc, row) => acc + (numberOf(row.cells[groupIndex]![index]) ?? 0),
                0,
              );
              return `<td class="a-IRR-aggregate u-tR">${escapeHtml(aggregateText(fn.fn === 'count' || fn.fn === 'countDistinct' ? 'count' : 'sum', total, maskOf(model, fn)))}</td>`;
            })
            .join(''),
        )
        .join('')}</tr>`
    : '';
  return {
    rows: rowGroups.length,
    html: `<table class="a-IRR-table a-IRR-pivotLayout" id="${id}_pivot_table" aria-label="Pivot">${top}${second}${body}${sums}</table>`,
  };
}

// ---------------------------------------------------------------- chart

/** Chart view drawn by the local SVG chart renderer from the report rows. */
export function chartView(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  model: ViewModel,
  spec: IrChart,
  width: number,
): string {
  const label = model.byName.get(spec.label);
  const value = spec.fn === 'count' ? undefined : model.byName.get(spec.value);
  const base = chartModel(renderer, ctx, {
    type: 'region',
    id: `${region.id}_chart`,
    props: {
      name: str(region.props, 'name', region.id),
      chart: { type: spec.type },
      chartAppearance: { orientation: spec.orientation },
      legend: { show: spec.type === 'pie', position: 'auto' },
      chartLayout: { height: '420' },
    },
    children: [],
    file: region.file,
    line: region.line,
  });
  if (!label) {
    base.errors.push('Select a label column for the chart.');
    return renderChartSvg(base, width);
  }
  const groups = [...groupRows(model.rows, (row) => model.cells.text(label, row)).entries()].map(
    ([group, rows]) => ({
      group,
      first: rows[0]!,
      value:
        numberOf(
          aggregateValue(
            spec.fn,
            rows.map((row) => (value ? row[spec.value] : 1)),
          ),
        ) ?? null,
    }),
  );
  switch (spec.sort) {
    case 'valueAsc':
      groups.sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
      break;
    case 'valueDesc':
      groups.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      break;
    case 'labelAsc':
      groups.sort((a, b) => compareValues(a.group, b.group));
      break;
    case 'labelDesc':
      groups.sort((a, b) => compareValues(b.group, a.group));
      break;
    default:
      break;
  }
  const seriesName = value
    ? `${AGGREGATE_LABELS[spec.fn] ?? spec.fn} ${model.cells.label(value)}`
    : (AGGREGATE_LABELS[spec.fn] ?? 'Count');
  const series: ChartSeries = {
    id: `${region.id}_chart_series`,
    name: seriesName,
    type: spec.type === 'pie' ? 'pie' : spec.type,
    y2: false,
    stackCategory: '',
    points: groups.map((group) => ({ group: group.group, value: group.value })),
    label: { show: false, position: 'auto', displayAs: spec.type === 'pie' ? 'percentage' : 'value' },
    line: { style: 'solid', type: 'auto', width: 3 },
    marker: { show: 'auto', shape: 'auto' },
    referenceLines: [],
  };
  base.series = [series];
  base.groups = groups.map((group) => group.group);
  base.axes.x.title = spec.labelTitle;
  base.axes.y.title = spec.valueTitle;
  if (value) base.value.format = undefined;
  return renderChartSvg(base, width);
}
