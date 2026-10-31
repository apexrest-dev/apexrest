import { bool, get, list, num, str, type ApxComponent } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import {
  applyFiltersAndSort,
  bySequence,
  Cells,
  columnRef,
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

export function irState(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): ReportState {
  return reportState(ctx.session, stateKey(ctx.pageId, region.id), () => {
    const saved = primarySavedReport(region);
    const rowsPerPage = num(saved?.props ?? {}, 'view.rowsPerPage', 0);
    return {
      filters: savedFilters(renderer, ctx, region, saved),
      sort: savedSorts(saved),
      ...(rowsPerPage ? { rowsPerPage } : {}),
    };
  });
}

export interface IrModel {
  state: ReportState;
  cells: Cells;
  /** Every user-visible column (declared, not hidden). */
  available: ApxComponent[];
  displayed: ApxComponent[];
  byName: Map<string, ApxComponent>;
  rows: Row[];
  error?: string;
  moreData: boolean;
  limit: number;
}

/** Query, columns and filtered/sorted rows of an interactive report for the session's state. */
export function irModel(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): IrModel {
  const state = irState(renderer, ctx, region);
  const cells = new Cells(renderer, ctx, region);
  const sql = renderer.regionSql(ctx, region);
  const limit = rowLimit(region, 100_000);
  const result = sql
    ? renderer.query(ctx, region, sql, limit + 1)
    : { columns: [], rows: [], error: 'no local source' };
  const all = regionColumns(region, result.columns);
  const available = all.filter(
    (column) => str(column.props, 'type') !== 'hidden' && !isSpecialColumn(column.id),
  );
  const byName = new Map(available.map((column) => [column.id.toUpperCase(), column]));
  let order = state.columns;
  if (!order) {
    const saved = primarySavedReport(region);
    const display = bySequence(saved?.children.filter((child) => child.type === 'displayColumn') ?? []);
    order = display.length ? display.map(columnRef) : available.map((column) => column.id.toUpperCase());
  }
  const displayed = order.map((name) => byName.get(name)).filter((column) => column !== undefined);
  const rows = applyFiltersAndSort(
    result.rows.slice(0, limit),
    cells,
    byName,
    displayed,
    state.filters,
    state.sort,
  );
  return {
    state,
    cells,
    available,
    displayed,
    byName,
    rows,
    ...(result.error ? { error: result.error } : {}),
    moreData: result.rows.length > limit,
    limit,
  };
}

/** Actions menu entries the region enables (APEX defaults are on). */
function actionsMenu(region: ApxComponent) {
  const flag = (name: string) => get(region.props, `actionsMenu.${name}`) !== false;
  const include =
    get(region.props, 'searchBar.includeSearchBar') !== false &&
    get(region.props, 'actionsMenu.includeActionsMenu') !== false;
  return {
    include,
    columns: include && flag('selectColumns'),
    filter: include && flag('filter'),
    rowsPerPage: include && flag('rowsPerPage'),
    sort: include && flag('sort'),
    reset: include && flag('reset'),
    download: include && flag('download'),
    help: include && flag('help'),
  };
}

function diagnoseIr(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): void {
  const note = (message: string) => renderer.diagnose('info', message, ctx.pageId, region.id);
  const menu = actionsMenu(region);
  if (menu.include) {
    const missing = [
      'controlBreak',
      'highlight',
      'compute',
      'aggregate',
      'chart',
      'groupBy',
      'pivot',
      'flashback',
      'saveReport',
      'subscription',
    ].filter((name) => get(region.props, `actionsMenu.${name}`) !== false);
    if (missing.length)
      note(`Interactive report ${region.id}: Actions menu ${missing.join(', ')} are not simulated`);
  }
  if (get(region.props, 'searchBar.reportsSelectList') === true)
    note(`Interactive report ${region.id}: only the primary saved report is available`);
  if (str(region.props, 'heading.fixedTo') && str(region.props, 'heading.fixedTo') !== 'none')
    note(`Interactive report ${region.id}: fixed headers are not simulated`);
  const link = str(region.props, 'link.linkColumn', 'linkToSingleRowView');
  if (link === 'linkToSingleRowView')
    note(`Interactive report ${region.id}: single row view link column is not simulated`);
  const formats = stringList(list(region.props, 'download.formats')).filter(
    (format) => !/^(csv|html)$/u.test(format),
  );
  if (formats.length)
    note(`Interactive report ${region.id}: download formats ${formats.join(', ')} are not simulated`);
  for (const column of region.children.filter((child) => child.type === 'column')) {
    const type = str(column.props, 'type', 'plainText');
    if (!/^(plainText|plainTextBasedOnLov|link|hidden|htmlExpression|percentGraph|richText)$/u.test(type))
      note(`Interactive report column ${region.id}.${column.id} of type ${type} is shown as text`);
  }
}

const icon = (name: string) => `<span class="a-Icon ${name}" aria-hidden="true"></span>`;

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
  diagnoseIr(renderer, ctx, region);
  diagnoseSavedReport(renderer, ctx, region, primarySavedReport(region));
  const domId = renderer.regionDomId(region);
  const id = escapeHtml(domId);
  ctx.clientConfig.regions.push({ id: domId, kind: 'interactiveReport' });
  const { state, cells, displayed, rows } = model;
  const menu = actionsMenu(region);

  const perPage = state.rowsPerPage && state.rowsPerPage > 0 ? state.rowsPerPage : 50;
  const all = state.rowsPerPage === -1;
  const key = stateKey(ctx.pageId, region.id);
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
    })),
    sort: state.sort,
    filters: state.filters,
    menu,
    rowsPerPage: all ? -1 : perPage,
    rowsPerPageOptions: ROWS_PER_PAGE.filter(
      (value) => value <= num(region.props, 'componentAdvanced.maxRowsPerPageInSelector', 1000),
    ),
    formats: stringList(list(region.props, 'download.formats')).filter((format) =>
      /^(csv|html)$/u.test(format),
    ),
  };
  if (!config.formats.length) config.formats = ['csv', 'html'];

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

  const chips = state.filters.length
    ? `<div class="a-IRR-controlsContainer" id="${id}_control_panel"><ul class="a-IRR-controls a-Chips" role="group" aria-label="Report Settings">${state.filters
        .map((filter, index) => {
          const column = filter.column ? model.byName.get(filter.column) : undefined;
          const label = filterLabel(filter, column ? cells.label(column) : filter.column);
          return `<li class="a-IRR-controls-item a-IRR-controls-item--${filter.column ? 'filter' : 'search'} a-Chip a-Chip--applied"><div class="a-IRR-controls-cell"><input type="checkbox" class="a-IRR-controlsCheckbox" id="${id}_control_${index}" data-apex-local-ir-toggle="${index}"${filter.enabled ? ' checked' : ''} aria-label="${escapeHtml(label)}"><label class="a-IRR-controlsCheckboxLabel" for="${id}_control_${index}"></label></div><div class="a-IRR-controls-cell a-Chip-label">${icon(filter.column ? 'icon-irr-filter' : 'icon-irr-search')}</div><div class="a-IRR-controls-cell a-IRR-controls-cell--label a-Chip-text"><button type="button" class="a-IRR-controlsLabel" data-apex-local-ir-edit="${index}"><span class="a-Chip-value">${escapeHtml(label)}</span></button></div><div class="a-IRR-controls-cell a-IRR-controls-cell--remove"><button type="button" class="a-Button a-IRR-button a-IRR-button--remove a-Chip-remove" data-apex-local-ir-remove="${index}" title="Remove Filter" aria-label="Remove Filter">${icon('icon-remove')}</button></div></li>`;
        })
        .join('')}</ul></div>`
    : '';

  const link = str(region.props, 'link.linkColumn') === 'customTarget';
  const linkIcon = renderer.substitute(
    ctx.session,
    str(region.props, 'link.linkIcon', '<span class="fa fa-edit" aria-hidden="true"></span>'),
    ctx.page,
    'RAW',
  );
  const sorted = new Map(state.sort.map((entry, index) => [entry.column, { ...entry, index }]));
  const headerId = (column: ApxComponent) => `${id}_${escapeHtml(column.id.toUpperCase())}`;
  const header = `<tr>${link ? `<th class="a-IRR-header a-IRR-header--linkCol" id="${id}_LINK"><span class="u-VisuallyHidden">Link</span></th>` : ''}${displayed
    .map((column) => {
      const name = column.id.toUpperCase();
      const sort = sorted.get(name);
      const alignment = headingAlignment(renderer, column, visible[0]?.[name]);
      return `<th class="a-IRR-header ${alignment}" id="${headerId(column)}"${sort?.index === 0 ? ` aria-sort="${sort.direction === 'asc' ? 'ascending' : 'descending'}"` : ''}><a class="a-IRR-headerLink" href="#" data-column="${escapeHtml(name)}" data-region="${id}" role="button" aria-haspopup="dialog">${cells.heading(column)}${sort ? `<span class="a-IRR-headerSort a-Icon icon-irr-sort-${sort.direction}" aria-hidden="true"></span>` : ''}</a></th>`;
    })
    .join('')}</tr>`;
  const trigger = `apex.jQuery('#${domId}')`;
  const body = visible
    .map(
      (row) =>
        `<tr>${link ? `<td class="a-IRR-linkCol u-tC"><a href="${escapeHtml(renderer.link(ctx, get(region.props, 'link.target'), row, trigger))}">${linkIcon}</a></td>` : ''}${displayed
          .map((column) => {
            const name = column.id.toUpperCase();
            const classes = [
              renderer.alignment(column, row[name]),
              ...stringList(list(column.props, 'appearance.cssClasses')),
            ]
              .filter(Boolean)
              .join(' ');
            return `<td class="${escapeHtml(classes)}" headers="${headerId(column)}">${cells.html(column, row, trigger)}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('\n');

  const noData = renderer.substitute(
    ctx.session,
    str(region.props, 'messages.whenNoDataFound', 'No data found.'),
    ctx.page,
    'HTML',
  );
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

  return `<div class="a-IRR-container" id="${id}_ir" data-apex-local-ir="${escapeHtml(JSON.stringify(config))}"><div class="a-IRR" id="${id}_worksheet_id" role="group" aria-label="${escapeHtml(str(region.props, 'title', str(region.props, 'name')))}">
${toolbar}
${chips}${more}
<div class="a-IRR-content" id="${id}_content"><div class="a-IRR-reportView"><div class="a-IRR-tableContainer">${
    visible.length
      ? `<table class="a-IRR-table" id="${id}_table" aria-label="${escapeHtml(str(region.props, 'title', str(region.props, 'name')))}">${header}${body}</table>`
      : `<div class="a-IRR-noDataMsg"><span class="a-IRR-noDataMsg-icon a-Icon icon-irr-no-results" aria-hidden="true"></span><span class="a-IRR-noDataMsg-text">${noData}</span></div>`
  }</div>
${pagination}</div></div></div></div>`;
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
