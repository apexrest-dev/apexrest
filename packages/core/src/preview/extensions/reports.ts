import { ref, str, type ApxComponent } from '../apexlang.ts';
import { registerExtension, type RouteRequest, type RouteResponse } from '../extensions.ts';
import type { ApexRenderer, RenderContext, Session } from '../render.ts';
import { escapeHtml } from '../theme.ts';
import { classicReport, classicState } from './reports/classic-report.ts';
import { REPORT_MESSAGES, REPORTS_CLIENT, REPORTS_CSS } from './reports/client.ts';
import {
  gridExport,
  gridModel,
  igState,
  interactiveGrid,
  pageErrors,
  saveGrid,
} from './reports/interactive-grid.ts';
import {
  CHART_WIDTH,
  interactiveReport,
  irDistinct,
  irModel,
  irState,
} from './reports/interactive-report.ts';
import {
  AGGREGATE_LABELS,
  CHART_TYPES,
  chartView,
  computedQuery,
  emptyViews,
  nextComputationName,
  reportList,
  reportSelection,
  snapshot,
  type IrFunction,
  type IrHighlight,
  type IrView,
} from './reports/ir-views.ts';
import { toPrintHtml, toXlsx } from './reports/xlsx.ts';
import {
  findRegion,
  normalizeOperator,
  peekState,
  resetState,
  stateKey,
  SUPPORTED_OPERATORS,
  toCsv,
  type GridChange,
  type ReportFilter,
  type ReportSort,
  type ReportState,
} from './reports/shared.ts';

/**
 * Report regions that feel like APEX 26.2: interactive report (search, column menu, actions,
 * chips, control breaks, highlights, computations, aggregates, group by, pivot and chart views,
 * single row view, saved reports, CSV/HTML/Excel/PDF downloads), interactive grid (genuine
 * grid/toolbar widgets, inline editing, row processing) and classic report (sorting, pagination
 * types, break formatting).
 */

const json = (body: unknown, status = 200): RouteResponse => ({
  status,
  type: 'json',
  body: JSON.stringify(body),
});

interface Target {
  ctx: RenderContext;
  region: ApxComponent;
  type: string;
  state: ReportState;
  key: string;
}

function target(renderer: ApexRenderer, session: Session, page: string, regionId: string): Target | string {
  if (!page || !regionId) return 'page and region are required';
  let ctx: RenderContext;
  try {
    ctx = renderer.prepare(session, page);
  } catch (error) {
    return (error as Error).message;
  }
  const region = findRegion(renderer, ctx, regionId);
  if (!region) return `Region ${regionId} not found`;
  const type = str(region.props, 'type');
  const state =
    type === 'interactiveGrid'
      ? igState(renderer, ctx, region)
      : type === 'interactiveReport'
        ? irState(renderer, ctx, region)
        : classicState(ctx, region);
  return { ctx, region, type, state, key: stateKey(ctx.pageId, region.id) };
}

function body(request: RouteRequest): Record<string, unknown> {
  try {
    const parsed = JSON.parse(request.body || '{}') as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const text = (value: unknown) => (value === undefined || value === null ? '' : String(value));

/** Columns currently displayed, used by "hide column". */
function displayedColumns(renderer: ApexRenderer, found: Target): string[] {
  if (found.type === 'interactiveReport')
    return irModel(renderer, found.ctx, found.region).displayed.map((column) => column.id.toUpperCase());
  const model = gridModel(renderer, found.ctx, found.region);
  const visible = model.columns
    .filter((column) => !column.hidden && !/^APEX\$/u.test(column.name))
    .map((column) => column.name);
  return found.state.columns?.filter((name) => visible.includes(name) || /^APEX\$/u.test(name)) ?? visible;
}

const objects = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object') : [];

const upperText = (value: unknown) => text(value).trim().toUpperCase();

function functionsOf(value: unknown): IrFunction[] {
  return objects(value)
    .map((entry) => {
      const fn = text(entry.fn) || 'sum';
      const column = upperText(entry.column);
      return {
        fn,
        column,
        label: text(entry.label).trim() || `${AGGREGATE_LABELS[fn] ?? fn} ${column}`.trim(),
        formatMask: text(entry.formatMask),
        sum: entry.sum === true,
      };
    })
    .filter((entry) => AGGREGATE_LABELS[entry.fn] && (entry.column || entry.fn === 'count'));
}

function sortsOf(value: unknown): ReportSort[] {
  return objects(value)
    .filter((entry) => entry.column)
    .map((entry) => ({
      column: upperText(entry.column),
      direction: entry.direction === 'desc' ? 'desc' : 'asc',
    }));
}

/** Interactive report Actions-menu changes: breaks, highlights, computations, views, saved reports. */
function irViewsAction(
  renderer: ApexRenderer,
  session: Session,
  found: Target,
  input: Record<string, unknown>,
): RouteResponse | null | undefined {
  const gridActions = new Set(['controlBreak', 'highlight', 'aggregate', 'toggle', 'remove']);
  if (
    found.type !== 'interactiveReport' &&
    !(found.type === 'interactiveGrid' && gridActions.has(text(input.action)))
  )
    return undefined;
  const { state } = found;
  const views = (state.views ??= emptyViews());
  const selection = reportSelection(session, found.key);
  const index = Number(input.index);
  const kind = text(input.kind);
  switch (text(input.action)) {
    case 'controlBreak':
      views.breaks = objects(input.breaks)
        .map((entry) => ({ column: upperText(entry.column), enabled: entry.enabled !== false }))
        .filter(
          (entry, position, all) =>
            entry.column && all.findIndex((other) => other.column === entry.column) === position,
        )
        .slice(0, 6);
      views.single = undefined;
      return null;
    case 'highlight': {
      const raw = (input.highlight ?? {}) as Record<string, unknown>;
      const operator = normalizeOperator(text(raw.operator) || '=');
      const highlight: IrHighlight = {
        name: text(raw.name).trim() || 'Highlight',
        type: raw.type === 'cell' ? 'cell' : 'row',
        column: upperText(raw.column),
        operator,
        value: text(raw.value),
        value2: text(raw.value2) || undefined,
        unit: text(raw.unit) || undefined,
        background: text(raw.background),
        text: text(raw.text),
        enabled: raw.enabled !== false,
        sequence: Number(raw.sequence) || (views.highlights.length + 1) * 10,
      };
      if (!highlight.column) return json({ error: 'Select a column for the highlight condition.' });
      if (!SUPPORTED_OPERATORS.has(operator)) return json({ error: `Unsupported operator ${operator}` });
      const replace = Number(input.replace);
      if (Number.isInteger(replace) && views.highlights[replace]) views.highlights[replace] = highlight;
      else views.highlights.push(highlight);
      views.highlights.sort((a, b) => a.sequence - b.sequence);
      return null;
    }
    case 'compute': {
      const raw = (input.computation ?? {}) as Record<string, unknown>;
      const expression = text(raw.expression).trim();
      if (!expression) return json({ error: 'Enter a computation expression.' });
      const replace = Number(input.replace);
      const existing = Number.isInteger(replace) ? views.computations[replace] : undefined;
      const name = existing?.name ?? nextComputationName(views);
      const computation = {
        name,
        label: text(raw.label).trim() || name,
        expression,
        formatMask: text(raw.formatMask).trim(),
      };
      const model = irModel(renderer, found.ctx, found.region);
      const sql = renderer.regionSql(found.ctx, found.region);
      try {
        renderer.db.query(
          computedQuery(sql ?? 'select 1 from dual', [computation], model.identifiers),
          renderer.binds(session, found.ctx.page),
          1,
        );
      } catch (error) {
        return json({ error: `Invalid computation expression: ${(error as Error).message}` });
      }
      if (existing) views.computations[replace] = computation;
      else {
        state.columns = [...model.displayed.map((column) => column.id.toUpperCase()), name];
        views.computations.push(computation);
      }
      return null;
    }
    case 'aggregate': {
      const fn = text(input.fn);
      const column = upperText(input.column);
      if (!column || !['sum', 'average', 'count', 'countDistinct', 'min', 'max', 'median'].includes(fn))
        return json({ error: 'Select an aggregation and a column.' });
      if (!views.aggregates.some((entry) => entry.fn === fn && entry.column === column))
        views.aggregates.push({ fn, column });
      return null;
    }
    case 'groupBy': {
      const raw = (input.groupBy ?? {}) as Record<string, unknown>;
      const columns = (Array.isArray(raw.columns) ? raw.columns : []).map(upperText).filter(Boolean);
      if (!columns.length) return json({ error: 'Select at least one group by column.' });
      views.groupBy = { columns, functions: functionsOf(raw.functions), sort: sortsOf(raw.sort) };
      views.view = 'groupBy';
      return null;
    }
    case 'pivot': {
      const raw = (input.pivot ?? {}) as Record<string, unknown>;
      const pivot = (Array.isArray(raw.pivot) ? raw.pivot : []).map(upperText).filter(Boolean);
      const rows = (Array.isArray(raw.rows) ? raw.rows : []).map(upperText).filter(Boolean);
      const functions = functionsOf(raw.functions);
      if (!pivot.length || !rows.length || !functions.length)
        return json({ error: 'Select pivot columns, row columns and at least one function.' });
      views.pivot = { pivot, rows, functions, sort: sortsOf(raw.sort) };
      views.view = 'pivot';
      return null;
    }
    case 'chart': {
      const raw = (input.chart ?? {}) as Record<string, unknown>;
      const fn = text(raw.fn) || 'sum';
      const chart = {
        type: CHART_TYPES.has(text(raw.type)) ? text(raw.type) : 'bar',
        label: upperText(raw.label),
        value: upperText(raw.value),
        fn,
        orientation: raw.orientation === 'horizontal' ? ('horizontal' as const) : ('vertical' as const),
        sort: text(raw.sort) || 'default',
        labelTitle: text(raw.labelTitle),
        valueTitle: text(raw.valueTitle),
      };
      if (!chart.label || (!chart.value && fn !== 'count'))
        return json({ error: 'Select a label column and a value column.' });
      views.chart = chart;
      views.view = 'chart';
      return null;
    }
    case 'view': {
      const view = text(input.view) as IrView;
      views.view = view === 'groupBy' || view === 'pivot' || view === 'chart' ? view : 'report';
      views.single = undefined;
      return null;
    }
    case 'toggle': {
      const entry =
        kind === 'breaks' ? views.breaks[index] : kind === 'highlights' ? views.highlights[index] : undefined;
      if (entry) entry.enabled = input.enabled === true;
      return null;
    }
    case 'remove':
      if (kind === 'breaks' || kind === 'highlights' || kind === 'aggregates') views[kind].splice(index, 1);
      else if (kind === 'computations') {
        const [removed] = views.computations.splice(index, 1);
        if (removed) {
          if (state.columns) state.columns = state.columns.filter((name) => name !== removed.name);
          views.aggregates = views.aggregates.filter((entry) => entry.column !== removed.name);
          views.highlights = views.highlights.filter((entry) => entry.column !== removed.name);
          views.breaks = views.breaks.filter((entry) => entry.column !== removed.name);
        }
      } else if (kind === 'groupBy' || kind === 'pivot' || kind === 'chart') {
        views[kind] = undefined;
        if (views.view === kind) views.view = 'report';
      }
      return null;
    case 'singleRow':
      views.single = Number.isInteger(index) && index >= 0 ? index : undefined;
      return json({ ok: true });
    case 'saveReport': {
      const name = text(input.name).trim();
      if (!name) return json({ error: 'Enter a name for the report.' });
      const existing = selection.privates.find((report) => report.name.toLowerCase() === name.toLowerCase());
      const copy = snapshot(state);
      if (copy.views) copy.views.single = undefined;
      if (existing) {
        existing.state = copy;
        existing.description = text(input.description);
        selection.current = existing.id;
      } else {
        const id = `p:${selection.next++}`;
        selection.privates.push({ id, name, description: text(input.description), state: copy });
        selection.current = id;
      }
      return json({ ok: true, report: selection.current });
    }
    case 'selectReport': {
      const id = text(input.id);
      const report = reportList(found.region, selection).find((entry) => entry.id === id);
      if (!report) return json({ error: `Saved report ${id} not found` });
      selection.current = report.primary ? '' : report.id;
      resetState(session, found.key);
      return null;
    }
    case 'deleteReport': {
      const position = selection.privates.findIndex((report) => report.id === selection.current);
      if (position < 0) return json({ error: 'Only private reports can be deleted.' });
      selection.privates.splice(position, 1);
      selection.current = '';
      resetState(session, found.key);
      return null;
    }
    default:
      return undefined;
  }
}

function reportRoute(renderer: ApexRenderer, session: Session, request: RouteRequest): RouteResponse {
  const input = body(request);
  const found = target(renderer, session, text(input.page), text(input.region));
  if (typeof found === 'string') return json({ error: found }, 404);
  const { state } = found;
  const column = text(input.column).toUpperCase();
  switch (text(input.action)) {
    case 'search': {
      const value = text(input.text).trim();
      if (value) state.filters.push({ column, operator: 'contains', value, enabled: true });
      break;
    }
    case 'filter': {
      const operator = normalizeOperator(text(input.operator) || '=');
      if (!column || !SUPPORTED_OPERATORS.has(operator))
        return json({ error: `Unsupported filter ${operator}` });
      const filter: ReportFilter = {
        column,
        operator,
        value: text(input.value),
        ...(operator === 'between' || operator === 'notBetween' ? { value2: text(input.value2) } : {}),
        ...(text(input.unit) ? { unit: text(input.unit) } : {}),
        enabled: true,
      };
      const replace = Number(input.replace);
      if (Number.isInteger(replace) && state.filters[replace]) state.filters[replace] = filter;
      else state.filters.push(filter);
      break;
    }
    case 'toggleFilter': {
      const filter = state.filters[Number(input.index)];
      if (filter) filter.enabled = input.enabled === true;
      break;
    }
    case 'removeFilter':
      state.filters.splice(Number(input.index), 1);
      break;
    case 'sort': {
      const sort = Array.isArray(input.sort)
        ? (input.sort as { column?: unknown; direction?: unknown }[])
        : [];
      state.sort = sort
        .filter((entry) => entry && entry.column)
        .map((entry) => ({
          column: text(entry.column).toUpperCase(),
          direction: entry.direction === 'desc' ? 'desc' : 'asc',
        }));
      break;
    }
    case 'classicSort': {
      const current = state.sort[0];
      state.sort = [
        { column, direction: current?.column === column && current.direction === 'asc' ? 'desc' : 'asc' },
      ];
      break;
    }
    case 'hide':
      state.columns = displayedColumns(renderer, found).filter((name) => name !== column);
      break;
    case 'columns':
      state.columns = (Array.isArray(input.columns) ? input.columns : []).map((name) =>
        text(name).toUpperCase(),
      );
      break;
    case 'rowsPerPage': {
      const value = Number(input.value);
      if (value === -1 || (Number.isInteger(value) && value > 0)) state.rowsPerPage = value;
      break;
    }
    case 'select':
      state.selected = text(input.id);
      return json({ ok: true });
    case 'reset':
      resetState(session, found.key);
      break;
    default: {
      const handled = irViewsAction(renderer, session, found, input);
      if (handled === undefined) return json({ error: `Unknown report action ${text(input.action)}` }, 400);
      if (handled) return handled;
    }
  }
  session.pagination[found.key] = 1;
  return json({ ok: true });
}

function valuesRoute(renderer: ApexRenderer, session: Session, request: RouteRequest): RouteResponse {
  const found = target(
    renderer,
    session,
    request.params.get('page') ?? '',
    request.params.get('region') ?? '',
  );
  if (typeof found === 'string') return json({ error: found }, 404);
  const name = (request.params.get('column') ?? '').toUpperCase();
  if (found.type === 'interactiveReport')
    return json(irDistinct(irModel(renderer, found.ctx, found.region), name));
  if (found.type !== 'interactiveGrid') return json([]);
  const model = gridModel(renderer, found.ctx, found.region);
  const column = model.byName.get(name);
  const values = new Set<string>();
  for (const row of column ? model.rows : []) {
    values.add(model.cells.text(column!.component, row));
    if (values.size >= 500) break;
  }
  return json([...values].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })));
}

/** Rows and headings of a report download: displayed columns with current filters and sort. */
function exportData(renderer: ApexRenderer, found: Target) {
  const { region, ctx } = found;
  if (found.type === 'interactiveGrid') {
    const model = gridModel(renderer, ctx, region);
    const data = gridExport(model);
    return { ...data, numeric: data.columns.map((column) => /number/iu.test(column.type)) };
  }
  const model = irModel(renderer, ctx, region);
  const columns = (
    found.type === 'interactiveReport' ? [...model.breaks, ...model.displayed] : model.available
  ).filter((column) => str(column.props, 'exportPrinting.includeInExportPrint') !== 'false');
  return {
    headings: columns.map((column) => model.cells.label(column)),
    rows: model.rows.map((row) => columns.map((column) => model.cells.text(column, row))),
    numeric: columns.map((column) => {
      const sample = model.rows.find((row) => row[column.id.toUpperCase()] !== null)?.[
        column.id.toUpperCase()
      ];
      return typeof sample === 'number' && !model.cells.lov(column);
    }),
  };
}

function downloadRoute(renderer: ApexRenderer, session: Session, request: RouteRequest): RouteResponse {
  const found = target(
    renderer,
    session,
    request.params.get('page') ?? '',
    request.params.get('region') ?? '',
  );
  if (typeof found === 'string') return json({ error: found }, 404);
  const { region } = found;
  const requested = request.params.get('format') ?? 'csv';
  const format =
    requested === 'excel' || requested === 'xlsx'
      ? 'xlsx'
      : requested === 'pdf'
        ? 'pdf'
        : requested === 'html'
          ? 'html'
          : 'csv';
  const { headings, rows, numeric } = exportData(renderer, found);
  const title = str(region.props, 'title', str(region.props, 'name', region.id));
  const filename = (str(region.props, 'download.filename') || str(region.props, 'name', region.id)).replace(
    /[^\w .-]+/gu,
    '_',
  );
  switch (format) {
    case 'xlsx':
      return json({
        filename: `${filename}.xlsx`,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        encoding: 'base64',
        content: toXlsx(filename, headings, rows).toString('base64'),
      });
    case 'pdf':
      renderer.diagnose(
        'info',
        `PDF download of ${region.id} is a print-friendly HTML page in the local preview`,
        found.ctx.pageId,
        region.id,
      );
      return json({
        filename: `${filename} (print).html`,
        mime: 'text/html',
        note: 'PDF is not generated locally; this print-friendly page stands in for it.',
        content: toPrintHtml(title, headings, rows, numeric),
      });
    case 'html':
      return json({
        filename: `${filename}.html`,
        mime: 'text/html',
        content: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(filename)}</title></head><body><table border="1"><tr>${headings.map((heading) => `<th>${escapeHtml(heading)}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</table></body></html>`,
      });
    default:
      return json({
        filename: `${filename}.csv`,
        mime: 'text/csv',
        content: toCsv(
          headings,
          rows,
          str(region.props, 'download.csvSeparator') || ',',
          str(region.props, 'download.csvEnclosedBy', '"'),
        ),
      });
  }
}

/** Chart view SVG redrawn at the width of the report in the browser. */
function chartRoute(renderer: ApexRenderer, session: Session, request: RouteRequest): RouteResponse {
  const found = target(
    renderer,
    session,
    request.params.get('page') ?? '',
    request.params.get('region') ?? '',
  );
  if (typeof found === 'string') return { status: 404, type: 'text', body: found };
  const model = irModel(renderer, found.ctx, found.region);
  if (!model.views.chart) return { status: 404, type: 'text', body: 'No chart view' };
  const width = Math.max(240, Math.min(4000, Number(request.params.get('width')) || CHART_WIDTH));
  return {
    type: 'html',
    body: chartView(renderer, found.ctx, found.region, model, model.views.chart, width),
  };
}

function changesOf(input: Record<string, unknown>): GridChange[] {
  if (!Array.isArray(input.changes)) return [];
  return (input.changes as Record<string, unknown>[])
    .filter((change) => change && /^(insert|update|delete)$/u.test(text(change.op)))
    .map((change) => ({
      op: text(change.op) as GridChange['op'],
      ...(change.id !== undefined ? { id: text(change.id) } : {}),
      values: Object.fromEntries(
        Object.entries((change.values as Record<string, unknown>) ?? {}).map(([name, value]) => [
          name.toUpperCase(),
          value === null || value === undefined ? null : String(value),
        ]),
      ),
    }));
}

function rowProcess(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
): ApxComponent | undefined {
  return renderer
    .pageComponents(ctx, 'process')
    .find(
      (process) =>
        str(process.props, 'type') === 'interactiveGridAutoRowProcessing' &&
        ref(process.props, 'editableRegion') === region.id,
    );
}

function saveRoute(renderer: ApexRenderer, session: Session, request: RouteRequest): RouteResponse {
  const input = body(request);
  const found = target(renderer, session, text(input.page), text(input.region));
  if (typeof found === 'string') return json({ ok: false, errors: [{ message: found }] }, 404);
  if (!rowProcess(renderer, found.ctx, found.region)) {
    renderer.diagnose(
      'warning',
      `Interactive Grid ${found.region.id} has no Interactive Grid - Automatic Row Processing (DML) process; changes are not saved`,
      found.ctx.pageId,
      found.region.id,
    );
    return json({
      ok: false,
      saved: 0,
      errors: [
        {
          message: `No Interactive Grid - Automatic Row Processing (DML) process exists for ${str(found.region.props, 'name', found.region.id)}.`,
        },
      ],
    });
  }
  return json(saveGrid(renderer, found.ctx, found.region, changesOf(input)));
}

function stageRoute(renderer: ApexRenderer, session: Session, request: RouteRequest): RouteResponse {
  const input = body(request);
  const found = target(renderer, session, text(input.page), text(input.region));
  if (typeof found === 'string') return json({ error: found }, 404);
  found.state.pending = { changes: changesOf(input) };
  return json({ ok: true, staged: found.state.pending.changes.length });
}

registerExtension({
  name: 'reports',
  regions: {
    classicReport: (renderer, ctx, region) => classicReport(renderer, ctx, region),
    interactiveReport: (renderer, ctx, region, slots) => interactiveReport(renderer, ctx, region, slots),
    interactiveGrid: (renderer, ctx, region) => interactiveGrid(renderer, ctx, region),
  },
  processes: {
    // Applies grid changes staged by the browser before the page was submitted.
    interactiveGridAutoRowProcessing: (renderer, ctx, process, point) => {
      if (point !== 'submit') return { ran: false };
      const regionId = ref(process.props, 'editableRegion');
      const region = regionId ? findRegion(renderer, ctx, regionId) : undefined;
      if (!region) {
        renderer.diagnose(
          'warning',
          `Process ${process.id}: editable region not found`,
          ctx.pageId,
          process.id,
        );
        return { ran: false };
      }
      const state = peekState(ctx.session, stateKey(ctx.pageId, region.id));
      const pending = state?.pending;
      if (!state || !pending?.changes.length) return { ran: true };
      state.pending = undefined;
      const result = saveGrid(renderer, ctx, region, pending.changes);
      return result.ok ? { ran: true } : { ran: false, errors: pageErrors(region, result) };
    },
  },
  routes: {
    report: reportRoute,
    'report-values': valuesRoute,
    'report-download': downloadRoute,
    'report-chart': chartRoute,
    'ig-save': saveRoute,
    'ig-stage': stageRoute,
  },
  client: `apex.lang.addMessages(${JSON.stringify(REPORT_MESSAGES)});\n${REPORTS_CLIENT}\napex.jQuery(function () { apexLocalReports.init(); });`,
  css: REPORTS_CSS,
});
