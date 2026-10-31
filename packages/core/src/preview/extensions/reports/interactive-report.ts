import { bool, get, list, num, str, type ApxComponent } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import {
  aggregateLabel,
  aggregateText,
  aggregateValue,
  chartView,
  computedColumns,
  computedQuery,
  definedReports,
  emptyViews,
  groupByTable,
  highlightRow,
  identifiers,
  pivotTable,
  reportList,
  reportSelection,
  savedViews,
  snapshot,
  type IrViews,
} from './ir-views.ts';
import {
  applyFiltersAndSort,
  bySequence,
  Cells,
  columnRef,
  compareValues,
  diagnoseSavedReport,
  filterLabel,
  headingAlignment,
  isSpecialColumn,
  primarySavedReport,
  regionColumns,
  reportState,
  rowLimit,
  savedFilters,
  savedSorts,
  stateKey,
  stringList,
  type ReportState,
} from './shared.ts';

export const ROWS_PER_PAGE = [1, 5, 10, 15, 20, 25, 50, 100, 200, 500, 1000];

/** Download formats the preview produces (PDF is a print-friendly HTML page). */
export const DOWNLOAD_FORMATS = ['csv', 'html', 'excel', 'pdf'];

/** The saved report a session currently shows (primary unless another was selected). */
export function currentSavedReport(region: ApxComponent, current: string): ApxComponent | undefined {
  return (
    definedReports(region).find((report) => report.id === current)?.component ?? primarySavedReport(region)
  );
}

function stateFromSaved(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  saved: ApxComponent | undefined,
): ReportState {
  const rowsPerPage = num(saved?.props ?? {}, 'view.rowsPerPage', 0);
  const display = bySequence(saved?.children.filter((child) => child.type === 'displayColumn') ?? []).map(
    columnRef,
  );
  return {
    filters: savedFilters(renderer, ctx, region, saved),
    sort: savedSorts(saved),
    ...(rowsPerPage ? { rowsPerPage } : {}),
    ...(display.length ? { columns: display } : {}),
    views: savedViews(renderer, ctx, region, saved),
  };
}

export function irState(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): ReportState {
  const key = stateKey(ctx.pageId, region.id);
  return reportState(ctx.session, key, () => {
    const selection = reportSelection(ctx.session, key);
    const own = selection.privates.find((report) => report.id === selection.current);
    if (own) return snapshot(own.state);
    return stateFromSaved(renderer, ctx, region, currentSavedReport(region, selection.current));
  });
}

export interface IrModel {
  state: ReportState;
  views: IrViews;
  cells: Cells;
  /** Every user-visible column (declared, not hidden), computed columns included. */
  available: ApxComponent[];
  displayed: ApxComponent[];
  /** Enabled control break columns, outermost first. */
  breaks: ApxComponent[];
  byName: Map<string, ApxComponent>;
  /** Column identifiers (A, B, ...) for computation expressions. */
  identifiers: { id: string; name: string }[];
  rows: Row[];
  error?: string;
  moreData: boolean;
  limit: number;
}

/** Computations that SQLite can evaluate over the region query; failures are reported. */
function workingComputations(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  sql: string,
  views: IrViews,
  ids: { id: string; name: string }[],
) {
  const binds = renderer.binds(ctx.session, ctx.page);
  return views.computations.filter((computation) => {
    try {
      renderer.db.query(computedQuery(sql, [computation], ids), binds, 1);
      return true;
    } catch (error) {
      renderer.diagnose(
        'warning',
        `Interactive report ${region.id}: computation ${computation.label} (${computation.expression}) could not be evaluated locally: ${(error as Error).message}`,
        ctx.pageId,
        region.id,
      );
      return false;
    }
  });
}

/** Query, columns and filtered/sorted rows of an interactive report for the session's state. */
export function irModel(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): IrModel {
  const state = irState(renderer, ctx, region);
  const views = (state.views ??= emptyViews());
  const cells = new Cells(renderer, ctx, region);
  const sql = renderer.regionSql(ctx, region);
  const limit = rowLimit(region, 100_000);
  let result: { columns: string[]; rows: Row[]; error?: string } = sql
    ? renderer.query(ctx, region, sql, limit + 1)
    : { columns: [], rows: [], error: 'no local source' };
  const base = regionColumns(region, result.columns);
  const ids = identifiers(base.filter((column) => !isSpecialColumn(column.id)));
  let computed: ApxComponent[] = [];
  if (sql && !result.error && views.computations.length) {
    const working = workingComputations(renderer, ctx, region, sql, views, ids);
    if (working.length) {
      try {
        result = renderer.db.query(
          computedQuery(sql, working, ids),
          renderer.binds(ctx.session, ctx.page),
          limit + 1,
        );
        computed = computedColumns(working);
      } catch (error) {
        renderer.diagnose(
          'warning',
          `Interactive report ${region.id}: computed columns failed: ${(error as Error).message}`,
          ctx.pageId,
          region.id,
        );
      }
    }
  }
  const computedNames = new Set(computed.map((column) => column.id));
  const all = [
    ...regionColumns(
      region,
      result.columns.filter((name) => !computedNames.has(name)),
    ),
    ...computed,
  ];
  const available = all.filter(
    (column) => str(column.props, 'type') !== 'hidden' && !isSpecialColumn(column.id),
  );
  const byName = new Map(available.map((column) => [column.id.toUpperCase(), column]));
  const breaks = views.breaks
    .filter((entry) => entry.enabled && byName.has(entry.column))
    .map((entry) => byName.get(entry.column)!);
  let order = state.columns;
  if (!order) {
    const saved = primarySavedReport(region);
    const display = bySequence(saved?.children.filter((child) => child.type === 'displayColumn') ?? []);
    order = display.length ? display.map(columnRef) : available.map((column) => column.id.toUpperCase());
  }
  const displayed = order
    .map((name) => byName.get(name))
    .filter((column) => column !== undefined)
    .filter((column) => !breaks.includes(column));
  let rows = applyFiltersAndSort(
    result.rows.slice(0, limit),
    cells,
    byName,
    [...breaks, ...displayed],
    state.filters,
    state.sort,
  );
  if (breaks.length) {
    // Control break columns sort first; the report sort applies within each break.
    const indexed = rows.map((row, index) => ({ row, index }));
    indexed.sort((a, b) => {
      for (const column of breaks) {
        const name = column.id.toUpperCase();
        const lov = cells.lov(column);
        const left = lov ? cells.text(column, a.row) : a.row[name];
        const right = lov ? cells.text(column, b.row) : b.row[name];
        const empty = (value: unknown) => value === null || value === undefined || value === '';
        if (empty(left) || empty(right)) {
          if (empty(left) && empty(right)) continue;
          return empty(left) ? 1 : -1;
        }
        const compared = compareValues(left, right);
        if (compared) return compared;
      }
      return a.index - b.index;
    });
    rows = indexed.map((entry) => entry.row);
  }
  return {
    state,
    views,
    cells,
    available,
    displayed,
    breaks,
    byName,
    identifiers: ids.filter((entry) => byName.has(entry.name)),
    rows,
    ...(result.error ? { error: result.error } : {}),
    moreData: result.rows.length > limit,
    limit,
  };
}

/** Actions menu entries the region enables (APEX defaults are on). */
export function actionsMenu(region: ApxComponent) {
  const flag = (name: string) => get(region.props, `actionsMenu.${name}`) !== false;
  const include =
    get(region.props, 'searchBar.includeSearchBar') !== false &&
    get(region.props, 'actionsMenu.includeActionsMenu') !== false;
  const on = (name: string) => include && flag(name);
  return {
    include,
    columns: on('selectColumns'),
    filter: on('filter'),
    rowsPerPage: on('rowsPerPage'),
    sort: on('sort'),
    controlBreak: on('controlBreak'),
    highlight: on('highlight'),
    compute: on('compute'),
    aggregate: on('aggregate'),
    chart: on('chart'),
    groupBy: on('groupBy'),
    pivot: on('pivot'),
    flashback: on('flashback'),
    saveReport: on('saveReport'),
    reset: on('reset'),
    download: on('download'),
    subscription: on('subscription'),
    help: on('help'),
  };
}

export function linkMode(region: ApxComponent): 'single' | 'custom' | 'none' {
  const link = str(region.props, 'link.linkColumn', 'singleRowView');
  return link === 'customTarget' ? 'custom' : link === 'exclude' ? 'none' : 'single';
}

function diagnoseIr(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): void {
  const note = (message: string) => renderer.diagnose('info', message, ctx.pageId, region.id);
  const menu = actionsMenu(region);
  const missing = (['flashback', 'subscription'] as const).filter((name) => menu[name]);
  if (missing.length)
    note(`Interactive report ${region.id}: Actions menu ${missing.join(', ')} are not simulated`);
  if (str(region.props, 'heading.fixedTo') && str(region.props, 'heading.fixedTo') !== 'none')
    note(`Interactive report ${region.id}: fixed headers are not simulated`);
  const formats = stringList(list(region.props, 'download.formats'));
  const other = formats.filter((format) => !DOWNLOAD_FORMATS.includes(format));
  if (other.length)
    note(`Interactive report ${region.id}: download formats ${other.join(', ')} are not simulated`);
  if (formats.includes('pdf'))
    note(`Interactive report ${region.id}: PDF download is a print-friendly HTML page locally`);
  if (bool(region.props, 'download.sendAsEmail', false))
    note(`Interactive report ${region.id}: send as email is not simulated`);
  for (const column of region.children.filter((child) => child.type === 'column')) {
    const type = str(column.props, 'type', 'plainText');
    if (!/^(plainText|plainTextBasedOnLov|link|hidden|htmlExpression|percentGraph|richText)$/u.test(type))
      note(`Interactive report column ${region.id}.${column.id} of type ${type} is shown as text`);
  }
}

const icon = (name: string) => `<span class="a-Icon ${name}" aria-hidden="true"></span>`;

interface Chip {
  kind: string;
  index: number;
  label: string;
  icon: string;
  enabled?: boolean;
  removable: boolean;
  editable: boolean;
  swatch?: string;
}

const CHIP_CLASS: Record<string, string> = { breaks: 'controlBreak', highlights: 'highlight' };

function chipHtml(id: string, chip: Chip): string {
  const control = `${chip.kind}:${chip.index}`;
  const checkbox =
    chip.enabled === undefined
      ? ''
      : `<div class="a-IRR-controls-cell"><input type="checkbox" class="a-IRR-controlsCheckbox" id="${id}_${chip.kind}_${chip.index}" data-apex-local-ir-chip-toggle="${control}"${chip.enabled ? ' checked' : ''} aria-label="${escapeHtml(chip.label)}"><label class="a-IRR-controlsCheckboxLabel" for="${id}_${chip.kind}_${chip.index}"></label></div>`;
  const swatch = chip.swatch
    ? `<span class="apex-local-swatch" style="${escapeHtml(chip.swatch)}" aria-hidden="true"></span>`
    : '';
  const label = chip.editable
    ? `<button type="button" class="a-IRR-controlsLabel" data-apex-local-ir-chip-edit="${control}">${swatch}<span class="a-Chip-value">${escapeHtml(chip.label)}</span></button>`
    : `<span class="a-IRR-controlsLabel">${swatch}<span class="a-Chip-value">${escapeHtml(chip.label)}</span></span>`;
  return `<li class="a-IRR-controls-item a-IRR-controls-item--${CHIP_CLASS[chip.kind] ?? chip.kind} a-Chip a-Chip--applied">${checkbox}<div class="a-IRR-controls-cell a-Chip-label">${icon(chip.icon)}</div><div class="a-IRR-controls-cell a-IRR-controls-cell--label a-Chip-text">${label}</div>${
    chip.removable
      ? `<div class="a-IRR-controls-cell a-IRR-controls-cell--remove"><button type="button" class="a-Button a-IRR-button a-IRR-button--remove a-Chip-remove" data-apex-local-ir-chip-remove="${control}" title="Remove" aria-label="Remove ${escapeHtml(chip.label)}">${icon('icon-remove')}</button></div>`
      : ''
  }</li>`;
}

const style = (value: string | undefined) => (value ? ` style="${escapeHtml(value)}"` : '');

interface TableOptions {
  renderer: ApexRenderer;
  ctx: RenderContext;
  region: ApxComponent;
  model: IrModel;
  id: string;
  domId: string;
  visible: Row[];
  start: number;
  lastPage: boolean;
  link: 'single' | 'custom' | 'none';
}

/** Report view table with control breaks, highlights and aggregates. */
function reportTable(options: TableOptions): string {
  const { renderer, ctx, region, model, id, domId, visible, start, lastPage, link } = options;
  const { state, views, cells, displayed, breaks, byName } = model;
  const linkIcon = renderer.substitute(
    ctx.session,
    str(
      region.props,
      'link.linkIcon',
      link === 'custom' ? '<span class="fa fa-edit" aria-hidden="true"></span>' : icon('icon-irr-details'),
    ),
    ctx.page,
    'RAW',
  );
  const sorted = new Map(state.sort.map((entry, index) => [entry.column, { ...entry, index }]));
  const headerId = (column: ApxComponent) => `${id}_${escapeHtml(column.id.toUpperCase())}`;
  const header = (withIds: boolean) =>
    `<tr>${link !== 'none' ? `<th class="a-IRR-header a-IRR-header--linkCol"${withIds ? ` id="${id}_LINK"` : ''}><span class="u-VisuallyHidden">${link === 'single' ? 'Single Row View' : 'Link'}</span></th>` : ''}${displayed
      .map((column) => {
        const name = column.id.toUpperCase();
        const sort = sorted.get(name);
        const alignment = headingAlignment(renderer, column, visible[0]?.[name]);
        return `<th class="a-IRR-header ${alignment}"${withIds ? ` id="${headerId(column)}"` : ''}${sort?.index === 0 ? ` aria-sort="${sort.direction === 'asc' ? 'ascending' : 'descending'}"` : ''}><a class="a-IRR-headerLink" href="#" data-column="${escapeHtml(name)}" data-region="${id}" role="button" aria-haspopup="dialog">${cells.heading(column)}${sort ? `<span class="a-IRR-headerSort a-Icon icon-irr-sort-${sort.direction}" aria-hidden="true"></span>` : ''}</a></th>`;
      })
      .join('')}</tr>`;
  const trigger = `apex.jQuery('#${domId}')`;
  const breakKey = (row: Row) => JSON.stringify(breaks.map((column) => row[column.id.toUpperCase()] ?? ''));
  const groups = new Map<string, Row[]>();
  if (breaks.length)
    for (const row of model.rows) {
      const key = breakKey(row);
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }
  const aggregates = views.aggregates.filter(
    (aggregate) =>
      byName.has(aggregate.column) &&
      displayed.some((column) => column.id.toUpperCase() === aggregate.column),
  );
  const span = displayed.length + (link !== 'none' ? 1 : 0);
  const aggregateRow = (rows: Row[], overall: boolean) =>
    `<tr class="apex-local-aggregateRow">${link !== 'none' ? '<td class="a-IRR-aggregate"></td>' : ''}${displayed
      .map((column) => {
        const name = column.id.toUpperCase();
        const entries = aggregates.filter((aggregate) => aggregate.column === name);
        if (!entries.length) return '<td class="a-IRR-aggregate"></td>';
        const mask = str(column.props, 'appearance.formatMask');
        return `<td class="a-IRR-aggregate ${renderer.alignment(column, rows[0]?.[name])}">${entries
          .map((aggregate) => {
            const value = aggregateValue(
              aggregate.fn,
              rows.map((row) => row[name]),
            );
            return `<span class="a-IRR-aggregateLabel">${escapeHtml(aggregateLabel(aggregate.fn, overall))}: </span>${escapeHtml(aggregateText(aggregate.fn, value, mask))}`;
          })
          .join('<br>')}</td>`;
      })
      .join('')}</tr>`;
  const dataRow = (row: Row, index: number) => {
    const highlight = views.highlights.length
      ? highlightRow(views.highlights, row, cells, byName)
      : { cells: new Map<string, string>() };
    const rowStyle = 'row' in highlight ? highlight.row : undefined;
    const linkCell =
      link === 'custom'
        ? `<td class="a-IRR-linkCol u-tC"${style(rowStyle)}><a href="${escapeHtml(renderer.link(ctx, get(region.props, 'link.target'), row, trigger))}">${linkIcon}</a></td>`
        : link === 'single'
          ? `<td class="a-IRR-linkCol u-tC"${style(rowStyle)}><a href="#" class="apex-local-singleRowLink" data-apex-local-ir-single="${index}" title="Single Row View" aria-label="Single Row View">${linkIcon}</a></td>`
          : '';
    return `<tr>${linkCell}${displayed
      .map((column) => {
        const name = column.id.toUpperCase();
        const classes = [
          renderer.alignment(column, row[name]),
          ...stringList(list(column.props, 'appearance.cssClasses')),
        ]
          .filter(Boolean)
          .join(' ');
        return `<td class="${escapeHtml(classes)}" headers="${headerId(column)}"${style(highlight.cells.get(name) ?? rowStyle)}>${cells.html(column, row, trigger)}</td>`;
      })
      .join('')}</tr>`;
  };
  let html = breaks.length ? '' : header(true);
  let previous: string | undefined;
  let firstGroup = true;
  visible.forEach((row, offset) => {
    const index = start + offset;
    const key = breaks.length ? breakKey(row) : '';
    if (breaks.length && key !== previous) {
      const label = breaks
        .map((column) => `${escapeHtml(cells.label(column))} : ${cells.html(column, row, trigger)}`)
        .join(', ');
      html += `<tr><th class="a-IRR-header a-IRR-header--group" colspan="${span}" id="${id}_break_${index}"><span class="a-IRR-headerLabel">${label}</span></th></tr>${header(firstGroup)}`;
      firstGroup = false;
      previous = key;
    }
    html += dataRow(row, index);
    if (breaks.length && aggregates.length) {
      const next = model.rows[index + 1];
      if (!next || breakKey(next) !== key) html += aggregateRow(groups.get(key) ?? [row], false);
    }
  });
  if (lastPage && aggregates.length) html += aggregateRow(model.rows, breaks.length > 0);
  return `<table class="a-IRR-table" id="${id}_table" aria-label="${escapeHtml(str(region.props, 'title', str(region.props, 'name')))}">${html}</table>`;
}

/** Single row view of the row at `index` (displayed columns first, then the others). */
function singleRowView(model: IrModel, id: string, domId: string, index: number): string {
  const row = model.rows[index]!;
  const trigger = `apex.jQuery('#${domId}')`;
  const shown = new Set([...model.breaks, ...model.displayed]);
  const columns = [
    ...model.breaks,
    ...model.displayed,
    ...model.available.filter((column) => !shown.has(column)),
  ];
  const nav = (target: number, label: string, iconName: string, enabled: boolean) =>
    `<button type="button" class="a-Button a-IRR-button a-IRR-button--pagination" data-apex-local-ir-single="${target}"${enabled ? '' : ' disabled'} title="${label}" aria-label="${label}">${icon(iconName)}</button>`;
  return `<div class="a-IRR-singleRowView" id="${id}_single_row_view"><div class="a-IRR-toolbar a-IRR-toolbar--singleRow"><div class="a-IRR-controlGroup"><button type="button" class="a-Button a-IRR-button" data-apex-local-ir-single="-1">${icon('icon-irr-report')} Report View</button></div><div class="a-IRR-singleRowNav">${nav(index - 1, 'Previous', 'icon-left-chevron', index > 0)}<span class="a-IRR-pagination-label">Row ${index + 1} of ${model.rows.length}</span>${nav(index + 1, 'Next', 'icon-right-chevron', index < model.rows.length - 1)}</div><div class="a-IRR-controlGroup a-IRR-viewOptionsContainer"><label class="a-IRR-viewOption"><input type="checkbox" class="a-IRR-viewOptions-checkbox" data-apex-local-ir-single-option="nulls"> Exclude Null Values</label> <label class="a-IRR-viewOption"><input type="checkbox" class="a-IRR-viewOptions-checkbox" data-apex-local-ir-single-option="displayed"> Displayed Columns</label></div></div><div class="a-IRR-singleRow-group"><div class="a-IRR-singleRow-rows is-expanded">${columns
    .map((column) => {
      const name = column.id.toUpperCase();
      const empty = row[name] === null || row[name] === undefined || row[name] === '';
      return `<div class="a-IRR-singleRow-row${shown.has(column) ? ' is-displayed' : ''}${empty ? ' is-null' : ''}"><div class="a-IRR-singleRow-name">${escapeHtml(model.cells.label(column))}</div><div class="a-IRR-singleRow-value">${model.cells.html(column, row, trigger)}</div></div>`;
    })
    .join('')}</div></div></div>`;
}

const VIEW_LABELS = { report: 'Report', groupBy: 'Group By', pivot: 'Pivot', chart: 'Chart' } as const;
const VIEW_ICONS = {
  report: 'icon-irr-report',
  groupBy: 'icon-irr-group-by',
  pivot: 'icon-irr-pivot',
  chart: 'icon-irr-chart',
} as const;

export const CHART_WIDTH = 720;

export function interactiveReport(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  slots: Record<string, string>,
): string {
  if (!renderer.regionSql(ctx, region))
    return `<div class="apex-local-unsupported">Report “${escapeHtml(str(region.props, 'name', region.id))}” has no local source.</div>`;
  const model = irModel(renderer, ctx, region);
  if (model.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(model.error)}</div></div>`;
  const key = stateKey(ctx.pageId, region.id);
  const selection = reportSelection(ctx.session, key);
  diagnoseIr(renderer, ctx, region);
  diagnoseSavedReport(renderer, ctx, region, currentSavedReport(region, selection.current), {
    children: new Set(['aggregate', 'computation', 'controlBreak', 'highlight']),
    views: new Set(['groupBy', 'pivot', 'chart']),
    alternatives: true,
  });
  const domId = renderer.regionDomId(region);
  const id = escapeHtml(domId);
  ctx.clientConfig.regions.push({ id: domId, kind: 'interactiveReport' });
  const { state, views, cells, displayed, rows } = model;
  const menu = actionsMenu(region);
  const link = linkMode(region);

  const perPage = state.rowsPerPage && state.rowsPerPage > 0 ? state.rowsPerPage : 50;
  const all = state.rowsPerPage === -1;
  const pages = all ? 1 : Math.max(1, Math.ceil(rows.length / perPage));
  const page = Math.min(pages, Math.max(1, ctx.session.pagination[key] ?? 1));
  const size = all ? rows.length || 1 : perPage;
  const visible = rows.slice((page - 1) * size, page * size);

  const searchBar = get(region.props, 'searchBar.includeSearchBar') !== false;
  const searchField = searchBar && get(region.props, 'searchBar.searchField') !== false;
  const finder = searchField && get(region.props, 'searchBar.finderDropDown') !== false;
  const rowsSelector = searchBar && bool(region.props, 'searchBar.rowsPerPageSelector', false);
  const goLabel = str(region.props, 'searchBar.searchButtonLabel', 'Go');
  const right = slots.RIGHT_OF_INTERACTIVE_REPORT_SEARCH_BAR ?? slots.RIGHTOFINTERACTIVEREPORTSEARCHBAR ?? '';
  delete slots.RIGHT_OF_INTERACTIVE_REPORT_SEARCH_BAR;
  delete slots.RIGHTOFINTERACTIVEREPORTSEARCHBAR;

  const reports = reportList(region, selection);
  const currentReport =
    reports.find((report) => report.id === selection.current) ?? reports.find((report) => report.primary);
  const reportsSelect =
    searchBar && get(region.props, 'searchBar.reportsSelectList') !== false && reports.length > 1;
  const formats = stringList(list(region.props, 'download.formats')).filter((format) =>
    DOWNLOAD_FORMATS.includes(format),
  );

  const config = {
    region: domId,
    columns: model.available.map((column) => ({
      name: column.id.toUpperCase(),
      label: cells.label(column),
      shown: displayed.includes(column),
      sort: get(column.props, 'enableUsersTo.sort') !== false,
      filter:
        get(column.props, 'enableUsersTo.filter') !== false &&
        get(column.props, 'columnFilter.type') !== 'none',
      hide: get(column.props, 'enableUsersTo.hide') !== false,
      breakable: get(column.props, 'enableUsersTo.controlBreak') !== false,
      aggregate: get(column.props, 'enableUsersTo.aggregate') !== false,
      computed: views.computations.some((computation) => computation.name === column.id.toUpperCase()),
    })),
    identifiers: model.identifiers.map((entry) => ({
      id: entry.id,
      name: entry.name,
      label: cells.label(model.byName.get(entry.name)!),
    })),
    sort: state.sort,
    filters: state.filters,
    views,
    menu,
    rowsPerPage: all ? -1 : perPage,
    rowsPerPageOptions: ROWS_PER_PAGE.filter(
      (value) => value <= num(region.props, 'componentAdvanced.maxRowsPerPageInSelector', 1000),
    ),
    formats: formats.length ? formats : DOWNLOAD_FORMATS,
    reports: reports.map((report) => ({ id: report.id, name: report.name, group: report.group })),
    report: currentReport
      ? { id: currentReport.id, name: currentReport.name, group: currentReport.group }
      : null,
  };

  const reportOptions = (
    [
      ['default', 'Default'],
      ['public', 'Public'],
      ['private', 'Private'],
    ] as const
  )
    .map(([group, label]) => {
      const entries = reports.filter((report) => report.group === group);
      return entries.length
        ? `<optgroup label="${label}">${entries
            .map(
              (report) =>
                `<option value="${escapeHtml(report.id)}"${report === currentReport ? ' selected' : ''}>${escapeHtml(report.name)}</option>`,
            )
            .join('')}</optgroup>`
        : '';
    })
    .join('');

  const toolbar = searchBar
    ? `<div class="a-IRR-toolbar" id="${id}_toolbar">
${
  searchField
    ? `<div class="a-IRR-controlGroup a-IRR-controlGroup--search"><div class="a-IRR-search" role="search">${
        finder
          ? `<button class="a-Button a-IRR-button a-IRR-button--colSearch" type="button" id="${id}_column_search_root" aria-haspopup="menu" aria-label="Select columns to search" title="Select columns to search">${icon('icon-search')}${icon('icon-menu-drop-down')}</button><div id="${id}_column_search_drop" class="a-Menu" style="display:none"></div>`
          : ''
      }<div class="a-IRR-searchFieldContainer"><input class="a-IRR-search-field" type="search" id="${id}_search_field" placeholder="Search: All Text Columns" aria-label="Search: All Text Columns" autocomplete="off"></div><div class="a-IRR-searchButtonContainer"><button class="a-Button a-IRR-button a-IRR-button--search" type="button" id="${id}_search_button">${escapeHtml(goLabel)}</button></div></div></div>`
    : ''
}${
        reportsSelect
          ? `<div class="a-IRR-controlGroup a-IRR-controlGroup--savedReports"><label for="${id}_saved_reports" class="u-VisuallyHidden">Saved Report</label><select class="a-IRR-selectList" id="${id}_saved_reports" data-apex-local-ir-report="${id}">${reportOptions}</select></div>`
          : ''
      }${
        rowsSelector
          ? `<div class="a-IRR-controlGroup a-IRR-controlGroup--rowSelector"><label for="${id}_row_select" class="u-VisuallyHidden">Rows</label><select class="a-IRR-selectList" id="${id}_row_select" data-apex-local-ir-rows="${id}">${[
              ...config.rowsPerPageOptions,
              -1,
            ]
              .map(
                (value) =>
                  `<option value="${value}"${value === config.rowsPerPage ? ' selected' : ''}>${value === -1 ? 'All' : value}</option>`,
              )
              .join('')}</select></div>`
          : ''
      }${
        menu.include
          ? `<div class="a-IRR-controlGroup a-IRR-controlGroup--options"><div class="a-IRR-actions"><button class="a-Button a-IRR-button a-IRR-button--actions" type="button" id="${id}_actions_button" aria-haspopup="menu" aria-expanded="false"><span class="a-IRR-actionsLabel">Actions</span>${icon('icon-down-chevron')}</button><div id="${id}_actions_menu"></div></div></div>`
          : ''
      }${right ? `<div class="a-IRR-buttons">${right}</div>` : ''}
</div>`
    : '';

  const available = (['groupBy', 'pivot', 'chart'] as const).filter((view) => views[view]);
  const view = views.view !== 'report' && views[views.view] ? views.view : 'report';
  const tabs = available.length
    ? `<div class="a-IRR-viewTabs" id="${id}_view_tabs"><ul class="a-IRR-viewTabs-list" role="tablist" aria-label="Report Views">${(
        ['report', ...available] as const
      )
        .map((entry) => {
          const active = entry === view;
          return `<li class="a-IRR-viewTabs-item"><div class="a-IRR-viewTabs-tab${active ? ' is-active' : ''}${entry === 'report' ? '' : ' a-IRR-viewTabs-tab--removable'}"><button type="button" role="tab" class="a-IRR-viewTabs-tabButton${active ? ' is-active' : ''}" aria-selected="${active}" tabindex="${active ? 0 : -1}" data-view="${entry}" data-apex-local-ir-view="${entry}">${icon(VIEW_ICONS[entry])}<span class="a-IRR-viewTabs-label">${VIEW_LABELS[entry]}</span>${entry === 'report' ? '' : `<span class="a-IRR-viewTabs-close" role="button" data-view-close="${entry}" data-apex-local-ir-close-view="${entry}" title="Remove ${VIEW_LABELS[entry]}" aria-label="Remove ${VIEW_LABELS[entry]}">${icon('icon-remove')}</span>`}</button></div></li>`;
        })
        .join('')}</ul></div>`
    : '';

  const chips: string[] = [];
  if (currentReport && !currentReport.primary)
    chips.push(
      chipHtml(id, {
        kind: 'savedReport',
        index: 0,
        label: `Saved Report = "${currentReport.name}"`,
        icon: 'icon-irr-saved-report',
        removable: false,
        editable: false,
      }),
    );
  state.filters.forEach((filter, index) => {
    const column = filter.column ? model.byName.get(filter.column) : undefined;
    const label = filterLabel(filter, column ? cells.label(column) : filter.column);
    chips.push(
      `<li class="a-IRR-controls-item a-IRR-controls-item--${filter.column ? 'filter' : 'search'} a-Chip a-Chip--applied"><div class="a-IRR-controls-cell"><input type="checkbox" class="a-IRR-controlsCheckbox" id="${id}_control_${index}" data-apex-local-ir-toggle="${index}"${filter.enabled ? ' checked' : ''} aria-label="${escapeHtml(label)}"><label class="a-IRR-controlsCheckboxLabel" for="${id}_control_${index}"></label></div><div class="a-IRR-controls-cell a-Chip-label">${icon(filter.column ? 'icon-irr-filter' : 'icon-irr-search')}</div><div class="a-IRR-controls-cell a-IRR-controls-cell--label a-Chip-text"><button type="button" class="a-IRR-controlsLabel" data-apex-local-ir-edit="${index}"><span class="a-Chip-value">${escapeHtml(label)}</span></button></div><div class="a-IRR-controls-cell a-IRR-controls-cell--remove"><button type="button" class="a-Button a-IRR-button a-IRR-button--remove a-Chip-remove" data-apex-local-ir-remove="${index}" title="Remove Filter" aria-label="Remove Filter">${icon('icon-remove')}</button></div></li>`,
    );
  });
  views.breaks.forEach((entry, index) => {
    const column = model.byName.get(entry.column);
    if (!column) return;
    chips.push(
      chipHtml(id, {
        kind: 'breaks',
        index,
        label: cells.label(column),
        icon: 'icon-irr-control-break',
        enabled: entry.enabled,
        removable: true,
        editable: true,
      }),
    );
  });
  views.highlights.forEach((highlight, index) =>
    chips.push(
      chipHtml(id, {
        kind: 'highlights',
        index,
        label: highlight.name,
        icon: 'icon-irr-highlight',
        enabled: highlight.enabled,
        removable: true,
        editable: true,
        swatch: [
          highlight.background ? `background-color:${highlight.background}` : '',
          highlight.text ? `border-color:${highlight.text}` : '',
        ]
          .filter(Boolean)
          .join(';'),
      }),
    ),
  );
  const chipList = chips.length
    ? `<div class="a-IRR-controlsContainer" id="${id}_control_panel"><ul class="a-IRR-controls a-Chips" role="group" aria-label="Report Settings">${chips.join('')}</ul></div>`
    : '';

  const noData = renderer.substitute(
    ctx.session,
    str(region.props, 'messages.whenNoDataFound', 'No data found.'),
    ctx.page,
    'HTML',
  );
  const noDataHtml = `<div class="a-IRR-noDataMsg"><span class="a-IRR-noDataMsg-icon a-Icon icon-irr-no-results" aria-hidden="true"></span><span class="a-IRR-noDataMsg-text">${noData}</span></div>`;
  const first = (page - 1) * size + 1;
  const last = first + visible.length - 1;
  const ofTotal =
    str(region.props, 'pagination.type', 'rowRangesXToYOfZ') === 'rowRangesXToY' ? '' : ` of ${rows.length}`;
  const pageButton = (target: number, label: string, iconName: string) =>
    `<li class="a-IRR-pagination-item"><button class="a-Button a-IRR-button a-IRR-button--pagination" type="button" data-apex-local-ir-page="${target}" title="${label}" aria-label="${label}">${icon(iconName)}</button></li>`;
  const pagination = visible.length
    ? `<div class="a-IRR-paginationWrap a-IRR-paginationWrap--bottom"><ul class="a-IRR-pagination" role="group" aria-label="Pagination">${page > 1 ? pageButton(page - 1, 'Previous', 'icon-left-chevron') : ''}<li class="a-IRR-pagination-item"><span class="a-IRR-pagination-label">${first} - ${last}${ofTotal}</span></li>${last < rows.length ? pageButton(page + 1, 'Next', 'icon-right-chevron') : ''}</ul></div>`
    : '';
  const more = model.moreData
    ? `<div class="a-IRR-message apex-local-moreData">${escapeHtml(
        str(
          region.props,
          'messages.whenMoreDataFound',
          'The maximum row count for this report is #MAX_ROW_COUNT# rows. Please apply a filter to reduce the number of records in your query.',
        ).replaceAll('#MAX_ROW_COUNT#', String(model.limit)),
      )}</div>`
    : '';

  let content: string;
  const single = views.single;
  if (view === 'report' && single !== undefined && single >= 0 && single < rows.length) {
    content = singleRowView(model, id, domId, single);
  } else if (view === 'groupBy' && views.groupBy) {
    const table = groupByTable(model, views.groupBy, domId);
    content = `<div class="a-IRR-groupByView" id="${id}_group_by_view"><div class="a-IRR-tableContainer">${table.rows ? table.html : noDataHtml}</div></div>`;
  } else if (view === 'pivot' && views.pivot) {
    const table = pivotTable(renderer, ctx, region.id, model, views.pivot, domId);
    content = `<div class="a-IRR-pivotView" id="${id}_pivot_view"><div class="a-IRR-tableContainer">${table.rows ? table.html : noDataHtml}</div></div>`;
  } else if (view === 'chart' && views.chart) {
    content = `<div class="a-IRR-chartView" id="${id}_chart_view"><div class="apex-local-jet apex-local-irChart" data-apex-local-ir-chart="${id}" data-width="${CHART_WIDTH}">${chartView(renderer, ctx, region, model, views.chart, CHART_WIDTH)}</div></div>`;
  } else {
    content = `<div class="a-IRR-reportView"><div class="a-IRR-tableContainer">${
      visible.length
        ? reportTable({
            renderer,
            ctx,
            region,
            model,
            id,
            domId,
            visible,
            start: (page - 1) * size,
            lastPage: page === pages,
            link,
          })
        : noDataHtml
    }</div>
${pagination}</div>`;
  }

  return `<div class="a-IRR-container" id="${id}_ir" data-apex-local-ir="${escapeHtml(JSON.stringify(config))}"><div class="a-IRR" id="${id}_worksheet_id" role="group" aria-label="${escapeHtml(str(region.props, 'title', str(region.props, 'name')))}">
${toolbar}
${tabs}${chipList}${more}
<div class="a-IRR-content" id="${id}_content">${content}</div></div></div>`;
}

/** Distinct display values of a column for the column-heading menu. */
export function irDistinct(model: IrModel, column: string): string[] {
  const definition = model.byName.get(column);
  if (!definition) return [];
  const values = new Set<string>();
  for (const row of model.rows) {
    values.add(model.cells.text(definition, row));
    if (values.size >= 500) break;
  }
  return [...values].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}
