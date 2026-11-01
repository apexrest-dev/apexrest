import { get, list, num, ref, str, type ApxComponent } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import { columnRenderer } from '../../extensions.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import {
  defaultStaticId,
  escapeHtml,
  fill,
  templateOptions,
  text,
  type TemplateParams,
} from '../../theme.ts';
import {
  applyFiltersAndSort,
  Cells,
  headingAlignment,
  isSpecialColumn,
  regionColumns,
  reportState,
  rowLimit,
  stateKey,
  stringList,
  type ReportSort,
  type ReportState,
} from './shared.ts';

/** Default sort from column `sorting.defaultSequence` / `sorting.direction`. */
function defaultSort(columns: ApxComponent[]): ReportSort[] {
  return columns
    .filter((column) => str(column.props, 'sorting.defaultSequence'))
    .sort((a, b) => num(a.props, 'sorting.defaultSequence', 0) - num(b.props, 'sorting.defaultSequence', 0))
    .map((column) => ({
      column: column.id.toUpperCase(),
      direction: str(column.props, 'sorting.direction') === 'desc' ? 'desc' : 'asc',
    }));
}

export function classicState(ctx: RenderContext, region: ApxComponent): ReportState {
  return reportState(ctx.session, stateKey(ctx.pageId, region.id), () => ({
    filters: [],
    sort: defaultSort(region.children.filter((child) => child.type === 'column')),
  }));
}

const PAGINATION_TYPES = new Set([
  'showAll',
  'externalPaginationButtons',
  'rowRangesXToY',
  'rowRangesXToYOfZ',
  'rowRangesXToYNoPagination',
  'rowRangesXToYOfZNoPagination',
  'rowRangesXToYOfZWithPagination',
  'setPaginationLinks',
  'setPaginationSelectList',
  'setPaginationSearchEngine',
  'nextAndPreviousLinks',
]);

interface Pager {
  domId: string;
  page: number;
  perPage: number;
  total: number;
  shown: number;
  align: string;
}

/** Pagination markup built from the report template's pagination templates. */
function pagination(template: TemplateParams, type: string, pager: Pager): string {
  const { domId, page, perPage, total, shown, align } = pager;
  // `showAll` (No Pagination) and `externalPaginationButtons` (computed but not displayed) print no pager.
  if (!shown || type === 'showAll' || type === 'externalPaginationButtons') return '';
  const first = (page - 1) * perPage + 1;
  const last = first + shown - 1;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const link = (target: number) => `javascript:apexLocalReports.paginate('${escapeHtml(domId)}',${target})`;
  const textTemplate =
    text(template, 'pagination_template') || '<span class="t-Report-paginationText">#TEXT#</span>';
  const ofTotal = /OfZ/u.test(type) ? ` of ${total}` : '';
  const range = fill(textTemplate, { TEXT: `${first} - ${last}${ofTotal}` });
  if (/NoPagination$/u.test(type)) return `<tr><td colspan="99"${align}>${range}</td></tr>`;
  const previous =
    page > 1
      ? fill(
          text(template, 'previous_page_template') ||
            '<a href="#LINK#" class="t-Report-paginationLink t-Report-paginationLink--prev">#PAGINATION_PREVIOUS#</a>',
          { LINK: link(page - 1), PAGINATION_PREVIOUS: 'Previous' },
        )
      : '';
  const next =
    last < total
      ? fill(
          text(template, 'next_page_template') ||
            '<a href="#LINK#" class="t-Report-paginationLink t-Report-paginationLink--next">#PAGINATION_NEXT#</a>',
          { LINK: link(page + 1), PAGINATION_NEXT: 'Next' },
        )
      : '';
  if (type === 'nextAndPreviousLinks') return `<tr><td colspan="99"${align}>${previous}${next}</td></tr>`;
  if (type === 'setPaginationSelectList') {
    const options = Array.from({ length: pages }, (_unused, index) => {
      const from = index * perPage + 1;
      const to = Math.min(total, from + perPage - 1);
      return `<option value="${index + 1}"${index + 1 === page ? ' selected' : ''}>${from} - ${to} of ${total}</option>`;
    }).join('');
    return `<tr><td colspan="99"${align}>${previous}<select class="t-Report-paginationSelect apex-item-select" aria-label="Pagination" onchange="apexLocalReports.paginate('${escapeHtml(domId)}',this.value)">${options}</select>${next}</td></tr>`;
  }
  if (type === 'setPaginationLinks' || type === 'setPaginationSearchEngine') {
    const links = Array.from({ length: pages }, (_unused, index) => {
      const from = index * perPage + 1;
      const to = Math.min(total, from + perPage - 1);
      const label = type === 'setPaginationLinks' ? `${from}-${to}` : String(index + 1);
      return index + 1 === page
        ? `<span class="t-Report-paginationText"><b>${label}</b></span>`
        : `<a href="${link(index + 1)}" class="t-Report-paginationLink">${label}</a>`;
    }).join(' ');
    return `<tr><td colspan="99"${align}>${previous}${links}${next}</td></tr>`;
  }
  return `<tr><td colspan="99"${align}>${previous}${range}${next}</td></tr>`;
}

/** Classic report with sorting, pagination types, break formatting and CSV download. */
export function classicReport(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const sql = renderer.regionSql(ctx, region);
  if (!sql)
    return `<div class="apex-local-unsupported">Report “${escapeHtml(str(region.props, 'name', region.id))}” has no local source.</div>`;
  const limit = rowLimit(region, 500);
  const result = renderer.query(ctx, region, sql, limit + 1);
  if (result.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(result.error)}</div></div>`;
  const domId = renderer.regionDomId(region);
  ctx.clientConfig.regions.push({ id: domId, kind: 'classicReport' });
  diagnoseClassic(renderer, ctx, region);

  const state = classicState(ctx, region);
  const cells = new Cells(renderer, ctx, region);
  const all = regionColumns(region, result.columns);
  const byName = new Map(all.map((column) => [column.id.toUpperCase(), column]));
  const moreData = result.rows.length > limit;
  const rows = applyFiltersAndSort(result.rows.slice(0, limit), cells, byName, [], [], state.sort);
  const columns = all.filter(
    (column) => !/^hidden/u.test(str(column.props, 'type')) && !isSpecialColumn(column.id),
  );

  const type = str(region.props, 'pagination.type', 'rowRangesXToY');
  // No Pagination (Show All Rows) renders every processed row on one page.
  const perPage =
    type === 'showAll'
      ? Math.max(1, rows.length)
      : Math.max(1, num(region.props, 'reportLayout.numberOfRows', 15));
  const noPaging = /NoPagination$/u.test(type) || type === 'showAll';
  const key = stateKey(ctx.pageId, region.id);
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const page = noPaging ? 1 : Math.min(pages, Math.max(1, ctx.session.pagination[key] ?? 1));
  const visible = rows.slice((page - 1) * perPage, page * perPage);

  const noData = renderer.substitute(
    ctx.session,
    str(region.props, 'messages.whenNoDataFound', 'no data found'),
    ctx.page,
    'HTML',
  );
  const moreMessage = moreData
    ? `<div class="t-Report-moreData apex-local-moreData">${escapeHtml(
        str(
          region.props,
          'messages.whenMoreDataFound',
          'This query returns more than #MAX_ROW_COUNT# rows, please filter your data to ensure complete results.',
        ).replaceAll('#MAX_ROW_COUNT#', String(limit)),
      )}</div>`
    : '';

  const templateId = (
    ref(region.props, 'componentAppearance.template') ??
    ref(region.props, 'appearance.reportTemplate') ??
    defaultStaticId(renderer.theme, 'default_report_template', 'standard')
  ).toLowerCase();
  const template = renderer.theme.reports.get(templateId) ?? renderer.theme.reports.get('standard')!;
  if (!renderer.theme.reports.has(templateId))
    renderer.diagnose(
      'warning',
      `Report template @/${templateId} not found; used Standard`,
      ctx.pageId,
      region.id,
    );
  const cssClasses = templateOptions(
    stringList(list(region.props, 'componentAppearance.templateOptions')),
    text(template, 'preset_template_options').replaceAll(':', ' '),
  );
  const pager = pagination(template, type, {
    domId,
    page,
    perPage,
    total: rows.length,
    shown: visible.length,
    align: /Right$/u.test(str(region.props, 'pagination.displayPosition', 'bottomRight'))
      ? ' align="right"'
      : '',
  });
  const position = str(region.props, 'pagination.displayPosition', 'bottomRight');
  const csv =
    get(region.props, 'download.csvExportEnabled') === true
      ? `<a href="javascript:apexLocalReports.download('${escapeHtml(domId)}','csv')" class="t-Report-csvLink">${escapeHtml(str(region.props, 'download.linkText', 'Download'))}</a>`
      : '';
  const shared = {
    DOM_ID: domId,
    REGION_ID: domId,
    REGION_STATIC_ID: domId,
    REGION_TITLE: escapeHtml(str(region.props, 'title', str(region.props, 'name'))),
    COMPONENT_CSS_CLASSES: [cssClasses, ...stringList(list(region.props, 'componentAppearance.cssClasses'))]
      .filter(Boolean)
      .join(' '),
    REPORT_ATTRIBUTES: renderer.substitute(
      ctx.session,
      str(region.props, 'componentAppearance.customAttributes'),
      ctx.page,
      'RAW',
    ),
    TOP_PAGINATION: /^top/u.test(position) ? pager : '',
    PAGINATION: /^top(Left|Right)$/u.test(position) ? '' : pager,
    CSV_LINK: csv,
    EXTERNAL_LINK: '',
  };
  if (!visible.length)
    return `<div class="t-Report ${escapeHtml(shared.COMPONENT_CSS_CLASSES)}" id="report_${escapeHtml(domId)}" data-region-id="${escapeHtml(domId)}"><div class="t-Report-wrap"><span class="nodatafound">${noData}</span></div></div>`;

  const breakCount =
    { col1: 1, 'cols1-2': 2, 'cols1-3': 3 }[str(region.props, 'breakFormatting.breakColumns')] ?? 0;
  const display = (column: ApxComponent, row: Row, index: number) => {
    const position = columns.indexOf(column);
    if (position >= 0 && position < breakCount && index > 0) {
      // Break formatting: repeated leading values are shown once per group.
      const previous = visible[index - 1]!;
      if (
        columns
          .slice(0, position + 1)
          .every((entry) => previous[entry.id.toUpperCase()] === row[entry.id.toUpperCase()])
      )
        return '';
    }
    if (str(column.props, 'type') === 'rowSelector')
      return `<input type="checkbox" class="u-selector" value="${escapeHtml(String(row[column.id.toUpperCase()] ?? ''))}" aria-label="Select row">`;
    return cells.html(column, row);
  };

  // `#1#`, `#2#` ... name query columns by position (1-based), escaped like named placeholders.
  const positional = (markup: string, row: Row, index: number) =>
    markup.replace(/#(\d+)#/gu, (whole, digits: string) => {
      const name = result.columns[Number(digits) - 1];
      if (name === undefined) return whole;
      const column = byName.get(name);
      return column ? display(column, row, index) : escapeHtml(row[name] ?? '');
    });

  if (text(template, 'row_template_type') === 'NAMED_COLUMNS') {
    const rowHtml = visible
      .map((row, index) =>
        fill(positional(text(template, 'row_template1'), row, index), {
          ...Object.fromEntries(Object.keys(row).map((name) => [name, escapeHtml(row[name] ?? '')])),
          ...Object.fromEntries(all.map((column) => [column.id.toUpperCase(), display(column, row, index)])),
          ROWNUM: String((page - 1) * perPage + index + 1),
          COLCOUNT: String(columns.length),
        }),
      )
      .join('\n');
    return (
      fill(text(template, 'row_template_before_rows'), shared) +
      rowHtml +
      fill(text(template, 'row_template_after_rows'), shared) +
      moreMessage
    );
  }

  // Like APEX, only the primary sort column shows the sort indicator.
  const sorted = new Map(state.sort.slice(0, 1).map((entry) => [entry.column, entry.direction]));
  const showHeadings = str(region.props, 'heading.type') !== 'none';
  const headings = showHeadings
    ? columns
        .map((column) => {
          const name = column.id.toUpperCase();
          const label = cells.heading(column);
          const sortable =
            get(column.props, 'sorting.sortable') !== false && str(column.props, 'type') !== 'rowSelector';
          const direction = sorted.get(name);
          const header = sortable
            ? `<a class="u-Report-sort" href="#" data-apex-local-sort="${escapeHtml(name)}" data-region="${escapeHtml(domId)}" title="Sort by this column"><span class="u-Report-sortHeading">${label}</span>${direction ? `<span class="u-Report-sortIcon a-Icon icon-rpt-sort-${direction}" aria-hidden="true"></span>` : ''}</a>`
            : label;
          const alignment = headingAlignment(renderer, column, visible[0]?.[name]);
          return fill(text(template, 'column_heading_template'), {
            COLUMN_HEADER: header,
            COLUMN_HEADER_NAME: escapeHtml(name),
            ALIGNMENT: `align="${alignment === 'u-tR' ? 'right' : alignment === 'u-tC' ? 'center' : 'left'}"`,
            ARIA_SORT: direction ? `aria-sort="${direction === 'asc' ? 'ascending' : 'descending'}"` : '',
            COLUMN_WIDTH: '',
            COLUMN_NUM: String(columns.indexOf(column) + 1),
          });
        })
        .join('')
    : '';
  const body = visible
    .map(
      (row, index) =>
        fill(positional(text(template, 'row_template_before_first'), row, index), {
          ROWNUM: String(index + 1),
        }) +
        columns
          .map((column) => {
            const alignment = renderer.alignment(column, row[column.id.toUpperCase()]);
            return fill(text(template, 'row_template1'), {
              COLUMN_VALUE: display(column, row, index),
              ALIGNMENT: `align="${alignment === 'u-tR' ? 'right' : alignment === 'u-tC' ? 'center' : 'left'}"`,
              ACCESSIBLE_HEADERS: `headers="${escapeHtml(column.id.toUpperCase())}"`,
              COLUMN_HEADER: cells.heading(column),
              COLUMN_NUM: String(columns.indexOf(column) + 1),
            });
          })
          .join('') +
        positional(text(template, 'row_template_after_last'), row, index),
    )
    .join('\n');
  return (
    fill(text(template, 'row_template_before_rows'), shared) +
    (showHeadings
      ? text(template, 'before_column_heading') + headings + text(template, 'after_column_heading')
      : '<tbody>') +
    body +
    fill(text(template, 'row_template_after_rows'), shared) +
    moreMessage
  );
}

function diagnoseClassic(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): void {
  const note = (message: string) => renderer.diagnose('info', message, ctx.pageId, region.id);
  const type = str(region.props, 'pagination.type');
  if (type && !PAGINATION_TYPES.has(type))
    note(`Classic report ${region.id}: pagination type ${type} is shown as row ranges`);
  if (str(region.props, 'componentAppearance.templateType') === 'predefined')
    note(
      `Classic report ${region.id}: predefined template ${str(region.props, 'componentAppearance.template')} is shown with the theme report template`,
    );
  if (str(region.props, 'reportLayout.numberOfRowsType') === 'itemValue')
    note(`Classic report ${region.id}: rows per page from an item is not simulated; 15 rows are shown`);
  if (str(region.props, 'breakFormatting.style') === 'repeatHeadings')
    note(`Classic report ${region.id}: repeat-heading break style is shown as default breaks`);
  if (get(region.props, 'printing.enabled') === true)
    note(`Classic report ${region.id}: printing is not simulated`);
  if (get(region.props, 'externalProcessing.enabled') === true)
    note(`Classic report ${region.id}: external processing link is not simulated`);
  if (str(region.props, 'componentAdvanced.sortNulls'))
    note(`Classic report ${region.id}: sort nulls setting uses Oracle defaults`);
  for (const column of region.children.filter((child) => child.type === 'column')) {
    const columnType = str(column.props, 'type', 'plainText');
    if (
      !columnRenderer(columnType) &&
      !/^(plainText|plainTextBasedOnLov|link|hidden|hiddenSavesState|rowSelector|richText|percentGraph|displayAsTextSavesState|plainTextSavesState)$/u.test(
        columnType,
      )
    )
      note(`Classic report column ${region.id}.${column.id} of type ${columnType} is shown as text`);
    if (
      get(column.props, 'columnFormatting.cssClasses') !== undefined ||
      get(column.props, 'columnFormatting.cssStyle') !== undefined
    )
      note(`Classic report column ${region.id}.${column.id}: column CSS formatting is not applied`);
  }
}
