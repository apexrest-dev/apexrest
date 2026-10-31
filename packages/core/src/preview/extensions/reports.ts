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
import { interactiveReport, irDistinct, irModel, irState } from './reports/interactive-report.ts';
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
  type ReportState,
} from './reports/shared.ts';

/**
 * Report regions that feel like APEX 26.2: interactive report (search, column menu, actions,
 * chips, saved-report defaults, CSV), interactive grid (genuine grid/toolbar widgets, inline
 * editing, row processing) and classic report (sorting, pagination types, break formatting).
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
        ...(operator === 'between' ? { value2: text(input.value2) } : {}),
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
    default:
      return json({ error: `Unknown report action ${text(input.action)}` }, 400);
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

function downloadRoute(renderer: ApexRenderer, session: Session, request: RouteRequest): RouteResponse {
  const found = target(
    renderer,
    session,
    request.params.get('page') ?? '',
    request.params.get('region') ?? '',
  );
  if (typeof found === 'string') return json({ error: found }, 404);
  const { region, ctx } = found;
  const format = request.params.get('format') === 'html' ? 'html' : 'csv';
  let headings: string[];
  let rows: string[][];
  if (found.type === 'interactiveGrid') {
    ({ headings, rows } = gridExport(gridModel(renderer, ctx, region)));
  } else {
    const model = irModel(renderer, ctx, region);
    const columns = (found.type === 'interactiveReport' ? model.displayed : model.available).filter(
      (column) => str(column.props, 'exportPrinting.includeInExportPrint') !== 'false',
    );
    headings = columns.map((column) => model.cells.label(column));
    rows = model.rows.map((row) => columns.map((column) => model.cells.text(column, row)));
  }
  const filename = (str(region.props, 'download.filename') || str(region.props, 'name', region.id)).replace(
    /[^\w .-]+/gu,
    '_',
  );
  const content =
    format === 'csv'
      ? toCsv(
          headings,
          rows,
          str(region.props, 'download.csvSeparator') || ',',
          str(region.props, 'download.csvEnclosedBy', '"'),
        )
      : `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(filename)}</title></head><body><table border="1"><tr>${headings.map((heading) => `<th>${escapeHtml(heading)}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
  return json({ filename: `${filename}.${format}`, content });
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
    'ig-save': saveRoute,
    'ig-stage': stageRoute,
  },
  client: `apex.lang.addMessages(${JSON.stringify(REPORT_MESSAGES)});\n${REPORTS_CLIENT}\napex.jQuery(function () { apexLocalReports.init(); });`,
  css: REPORTS_CSS,
});
