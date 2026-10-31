import {
  bool,
  get,
  isObject,
  list,
  num,
  ref,
  str,
  type ApxComponent,
  type ApxObject,
} from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { RouteResponse } from '../../extensions.ts';
import type { ApexRenderer, RenderContext, Session } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';

/**
 * Search regions on Oracle's own `apex.search` widget. Search configurations (shared components)
 * with local SQL, table or list sources are searched in SQLite; Oracle Text, ubiquitous, vector
 * and REST configurations are reported and skipped.
 */

/** Plug-in attributes live in differently named groups; find a key in any of them. */
function setting(props: ApxObject, key: string): ApxObject[string] | undefined {
  if (props[key] !== undefined) return props[key];
  for (const group of ['settings', 'pagination', 'appearance', 'messages', 'sort', 'performance']) {
    const value = get(props, `${group}.${key}`);
    if (value !== undefined) return value;
  }
  for (const value of Object.values(props))
    if (isObject(value) && value[key] !== undefined) return value[key];
  return undefined;
}
const settingStr = (props: ApxObject, key: string, fallback = '') => {
  const value = setting(props, key);
  return value === undefined || value === null || typeof value === 'object' ? fallback : String(value);
};
const settingBool = (props: ApxObject, key: string, fallback: boolean) => {
  const value = setting(props, key);
  if (value === undefined) return fallback;
  return value === true || value === 'Y' || value === 'true';
};

export interface SearchQuery {
  query?: string;
  firstRow?: number;
  maxRows?: number;
}

interface ConfigResult {
  results: { row: string }[];
  resultsCount: number;
  noDataFound?: string;
}

function sources(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): ApxComponent[] {
  return region.children
    .filter((child) => child.type === 'searchSource' && renderer.visible(ctx, child))
    .sort((a, b) => num(a.props, 'layout.sequence', 0) - num(b.props, 'layout.sequence', 0));
}

export function searchItem(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const explicit = settingStr(region.props, 'searchPageItem') || settingStr(region.props, 'externalPageItem');
  if (explicit) return explicit.toUpperCase();
  const slotted = renderer
    .pageComponents(ctx, 'pageItem')
    .find(
      (item) =>
        ref(item.props, 'layout.region') === region.id && str(item.props, 'layout.slot') === 'searchField',
    );
  return slotted ? slotted.id.toUpperCase() : '';
}

const quote = (name: string) => `"${name.replaceAll('"', '').toUpperCase()}"`;

function highlight(text: string, terms: string[]): string {
  let html = escapeHtml(text);
  for (const term of terms) {
    const safe = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    if (safe)
      html = html.replace(
        new RegExp(`(${safe})(?![^<]*>)`, 'giu'),
        '<mark class="a-SearchResults-highlight">$1</mark>',
      );
  }
  return html;
}

function initials(text: string): string {
  return text
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

/** Rows of one search configuration that match every term in at least one searchable column. */
function configRows(
  renderer: ApexRenderer,
  ctx: RenderContext,
  config: ApxComponent,
  terms: string[],
  limit: number,
): { rows: Row[]; error?: string } {
  const type = str(config.props, 'type', 'simple');
  if (type === 'apexList') {
    const listComponent = renderer.shared('list', ref(config.props, 'source.list'));
    const entries = (listComponent?.children ?? []).filter((child) => child.type === 'entry');
    const rows = entries.map((entry, index) => ({
      ID: index + 1,
      TITLE: renderer.substitute(ctx.session, str(entry.props, 'label', entry.id), ctx.page, 'RAW'),
      DESCRIPTION: str(entry.props, 'userDefinedAttributes.1'),
      ICON: str(entry.props, 'icon.iconCssClasses') || str(entry.props, 'icon.imageIconCssClasses'),
      LINK: renderer.link(ctx, get(entry.props, 'link.target')),
    }));
    return {
      rows: rows
        .filter((row) =>
          terms.every((term) => `${row.TITLE} ${row.DESCRIPTION}`.toLowerCase().includes(term)),
        )
        .slice(0, limit),
    };
  }
  if (type !== 'simple') return { rows: [], error: `search configuration type ${type} is not simulated` };
  const location = str(config.props, 'source.location', 'localDatabase');
  if (location !== 'localDatabase' && location !== 'sampleData')
    return { rows: [], error: `source location ${location} is not simulated` };
  const table = str(config.props, 'source.tableName');
  let sql = str(config.props, 'source.sqlQuery');
  if (!sql && table) sql = `select * from ${table}`;
  if (!sql) return { rows: [], error: 'no local source' };
  const where = str(config.props, 'source.whereClause');
  if (where) sql = `select * from (${sql}) where ${where}`;
  const mapping = (key: string) => str(config.props, `columnMapping.${key}`);
  const searchable = list(config.props, 'source.searchableColumns').map(String);
  const columns = (
    searchable.length ? searchable : [mapping('titleColumn'), mapping('descriptionColumn')]
  ).filter(Boolean);
  if (terms.length && columns.length) {
    const like = (term: string) => `'%${term.replaceAll("'", "''")}%'`;
    const conditions = terms.map(
      (term) => `(${columns.map((column) => `lower(${quote(column)}) like ${like(term)}`).join(' or ')})`,
    );
    sql = `select * from (${sql}) where ${conditions.join(' and ')}`;
  }
  const order = str(config.props, 'orderBy.orderByClause');
  if (order) sql = `${sql} order by ${order}`;
  // Sample tables grow the same way region sources do; failures are reported for the configuration.
  const result = renderer.query(ctx, { ...config, type: 'region' }, sql, limit);
  return result.error ? { rows: [], error: result.error } : { rows: result.rows };
}

function resultRow(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  source: ApxComponent,
  config: ApxComponent,
  row: Row,
  terms: string[],
): string {
  const column = (key: string) => {
    const name = str(config.props, `columnMapping.${key}`).replaceAll('"', '').toUpperCase();
    return name && row[name] !== null && row[name] !== undefined ? String(row[name]) : '';
  };
  const isList = str(config.props, 'type') === 'apexList';
  const title = isList ? String(row.TITLE ?? '') : column('titleColumn');
  const description = isList ? String(row.DESCRIPTION ?? '') : column('descriptionColumn');
  const rowValues = (template: string, escape = true) =>
    template.replace(/#([A-Z0-9_$]+)#/giu, (whole, name: string) => {
      const key = name.toUpperCase();
      if (!(key in row)) return whole;
      const raw = row[key] === null || row[key] === undefined ? '' : String(row[key]);
      return escape ? escapeHtml(raw) : raw;
    });
  const linkType = str(config.props, 'link.type');
  let link = isList ? String(row.LINK ?? '') : '';
  if (linkType === 'redirectThisApp' || linkType === 'redirectOtherApp')
    link = renderer.link(ctx, get(config.props, 'link.target'), row);
  else if (linkType === 'redirectUrl')
    link = rowValues(
      renderer.substitute(ctx.session, str(config.props, 'link.targetUrl'), ctx.page, 'RAW'),
      false,
    );
  else if (linkType === 'redirectUrlReturnedByFirstCol') link = String(Object.values(row)[0] ?? '');
  // Custom templates: the region's result row template, or the configuration's HTML expression.
  const custom =
    (settingBool(region.props, 'customLayout', false) &&
      settingStr(region.props, 'appearanceResultRowTemplate')) ||
    str(config.props, 'columnFormatting.htmlExpression');
  if (custom)
    return rowValues(
      custom
        .replaceAll('#SEARCH_TITLE#', escapeHtml(title))
        .replaceAll('#SEARCH_DESC#', escapeHtml(description))
        .replaceAll('#SEARCH_LINK#', escapeHtml(link)),
    );
  const iconSource = str(config.props, 'iconAndBadge.iconSource');
  const iconClass =
    str(source.props, 'iconAndBadge.iconCssClasses') ||
    (isList ? String(row.ICON ?? '') : '') ||
    (iconSource === 'iconClass' ? str(config.props, 'iconAndBadge.iconCssClasses') : '') ||
    (iconSource === 'iconClassColumn'
      ? String(row[str(config.props, 'iconAndBadge.iconColumn').toUpperCase()] ?? '')
      : '');
  const imageUrl =
    iconSource === 'imageUrl' ? rowValues(str(config.props, 'iconAndBadge.imageUrl'), false) : '';
  if (iconSource === 'imageBlobColumn')
    renderer.diagnose(
      'info',
      `Search configuration ${config.id}: BLOB images are shown as initials`,
      ctx.pageId,
      region.id,
    );
  const icon = imageUrl
    ? `<div class="a-ResultsItem-icon u-color"><img class="a-ResultsItem-image" src="${escapeHtml(imageUrl)}" alt=""></div>`
    : iconClass
      ? `<div class="a-ResultsItem-icon u-color"><span class="a-Icon ${escapeHtml(/(^|\s)fa-/u.test(iconClass) && !/(^|\s)fa(\s|$)/u.test(iconClass) ? `fa ${iconClass}` : iconClass)}" aria-hidden="true"></span></div>`
      : iconSource === 'initials' || iconSource === 'imageBlobColumn'
        ? `<div class="a-ResultsItem-icon u-color"><span class="a-ResultsItem-initials" aria-hidden="true">${escapeHtml(initials(title))}</span></div>`
        : '';
  const badge = column('badgeColumn');
  const subtitle = column('subtitleColumn');
  const modified = column('lastModifiedColumn');
  const attributes = [
    ...['customColumn1', 'customColumn2', 'customColumn3'].map(column),
    modified ? modified : '',
  ].filter(Boolean);
  const heading = link
    ? `<a href="${escapeHtml(link)}">${highlight(title, terms)}</a>`
    : highlight(title, terms);
  const label = str(source.props, 'appearance.overrideLabel') || str(source.props, 'name');
  return (
    `<div class="a-ResultsItem a-ResultsItem--${escapeHtml(source.id)}">${icon}<div class="a-ResultsItem-content">` +
    `<div class="a-ResultsItem-header"><h3 class="a-ResultsItem-title">${heading}</h3>${badge ? `<span class="a-ResultsItem-badge">${escapeHtml(badge)}</span>` : ''}</div>` +
    (subtitle ? `<div class="a-ResultsItem-subTitle">${highlight(subtitle, terms)}</div>` : '') +
    (description ? `<p class="a-ResultsItem-description">${highlight(description, terms)}</p>` : '') +
    `<div class="a-ResultsItem-attributes">${label ? `<span class="a-ResultsItem-attribute">${escapeHtml(label)}</span>` : ''}${attributes
      .map((value) => `<span class="a-ResultsItem-attribute">${escapeHtml(value)}</span>`)
      .join('')}</div>` +
    `</div></div>`
  );
}

/** Results in the shape `widget.search` renders: one group per search configuration. */
export function runSearch(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  request: SearchQuery,
): { configs: ConfigResult[] } {
  const query = (request.query ?? '').trim();
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
  const first = Math.max(1, request.firstRow ?? 1);
  const perPage = request.maxRows ?? 0;
  const configs: ConfigResult[] = [];
  if (settingStr(region.props, 'overallSort'))
    renderer.diagnose(
      'info',
      `Search ${region.id}: overall sort is not simulated; results stay grouped by source`,
      ctx.pageId,
      region.id,
    );
  for (const source of sources(renderer, ctx, region)) {
    if (!terms.length && !bool(source.props, 'useAsInitialResult', false)) continue;
    const config = renderer.shared('searchConfig', ref(source.props, 'searchConfig'));
    if (!config) {
      renderer.diagnose(
        'warning',
        `Search ${region.id}: search configuration @${ref(source.props, 'searchConfig')} not found`,
        ctx.pageId,
        region.id,
      );
      continue;
    }
    if (str(config.props, 'searchQueryPrefix'))
      renderer.diagnose(
        'info',
        `Search configuration ${config.id}: search prefixes are ignored locally`,
        ctx.pageId,
        region.id,
      );
    const limit = Math.min(
      num(source.props, 'appearance.maxResults', 0) || 10_000,
      num(config.props, 'performance.maxRowsToReturn', 0) || 10_000,
    );
    const { rows, error } = configRows(renderer, ctx, config, terms, limit);
    if (error)
      renderer.diagnose('info', `Search configuration ${config.id}: ${error}`, ctx.pageId, region.id);
    const page = perPage ? rows.slice(first - 1, first - 1 + perPage + 1) : rows;
    const noData = str(config.props, 'messages.whenNoDataFound');
    configs.push({
      results: page.map((row) => ({ row: resultRow(renderer, ctx, region, source, config, row, terms) })),
      resultsCount: rows.length,
      ...(noData ? { noDataFound: escapeHtml(noData) } : {}),
    });
  }
  return { configs };
}

export interface SearchClientConfig {
  region: string;
  item: string;
  searchAsYouType: boolean;
  minChars: number;
  resultsPerPage: number | null;
  showResultCount: boolean;
  resultCountSelector: string | null;
  noQueryEnteredMessage: string | null;
  noResultsFoundMessage: string | null;
  initial: boolean;
}

export function renderSearch(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const domId = renderer.regionDomId(region);
  const item = searchItem(renderer, ctx, region);
  if (!item)
    renderer.diagnose(
      'warning',
      `Search ${region.id} has no search page item; results cannot be queried`,
      ctx.pageId,
      region.id,
    );
  ctx.jsFiles.add('#APEX_FILES#libraries/apex/#MIN_DIRECTORY#widget.search#MIN#.js?v=#APEX_VERSION#');
  const all = sources(renderer, ctx, region);
  if (!all.length)
    renderer.diagnose('warning', `Search ${region.id} has no search sources`, ctx.pageId, region.id);
  const usePagination = settingBool(region.props, 'usePagination', true);
  const perPage = Number(settingStr(region.props, 'resultsPerPage', '15')) || 15;
  if (settingStr(region.props, 'resultsPerPageType') === 'basedOnItemValue')
    renderer.diagnose(
      'info',
      `Search ${region.id}: results per page from an item is not simulated`,
      ctx.pageId,
      region.id,
    );
  const showCount = settingStr(region.props, 'showResultCount', 'false');
  const config: SearchClientConfig = {
    region: domId,
    item,
    searchAsYouType: settingBool(region.props, 'searchAsYouType', true),
    minChars: Number(settingStr(region.props, 'minChars', '0')) || 0,
    resultsPerPage: usePagination ? perPage : null,
    showResultCount:
      showCount === 'true' || showCount === 'selector' || showCount === 'Y' || showCount === 'E',
    resultCountSelector: settingStr(region.props, 'paginationResultCountSelector') || null,
    noQueryEnteredMessage: settingStr(region.props, 'noQueryEnteredMessage') || null,
    noResultsFoundMessage: settingStr(region.props, 'noResultsFoundMessage') || null,
    initial: all.some((source) => bool(source.props, 'useAsInitialResult', false)),
  };
  // First page of results rendered on the server, so the region is useful before the widget loads.
  const query = item ? (ctx.session.items[item] ?? '') : '';
  let rows = '';
  if (query.trim() || config.initial) {
    const { configs } = runSearch(renderer, ctx, region, {
      query,
      ...(config.resultsPerPage ? { firstRow: 1, maxRows: config.resultsPerPage } : {}),
    });
    rows = configs
      .flatMap((entry) =>
        entry.results.length
          ? entry.results
              .slice(0, config.resultsPerPage ?? undefined)
              .map((result) => `<li class="a-SearchResults-item">${result.row}</li>`)
          : entry.noDataFound
            ? [`<li class="a-SearchResults-noData">${entry.noDataFound}</li>`]
            : [],
      )
      .join('');
    if (!rows && config.noResultsFoundMessage)
      rows = `<li class="a-SearchResults-noData">${escapeHtml(config.noResultsFoundMessage)}</li>`;
  } else if (config.noQueryEnteredMessage)
    rows = `<li class="a-SearchResults-emptySearch">${escapeHtml(config.noQueryEnteredMessage)}</li>`;
  return `<div id="${escapeHtml(domId)}_search" class="a-SearchResults apex-local-search" data-apex-local-search="${escapeHtml(JSON.stringify(config))}"><ol class="a-SearchResults-list">${rows}</ol></div>`;
}

export function searchRoute(
  renderer: ApexRenderer,
  session: Session,
  params: URLSearchParams,
  body: { items?: Record<string, string>; x02?: string },
): RouteResponse {
  const json = (value: unknown, status = 200): RouteResponse => ({
    status,
    type: 'json',
    body: JSON.stringify(value),
  });
  const page = params.get('page') ?? '';
  const regionId = params.get('region') ?? '';
  let ctx: RenderContext;
  try {
    for (const [name, value] of Object.entries(body.items ?? {}))
      session.items[name.toUpperCase()] = String(value);
    ctx = renderer.prepare(session, page);
  } catch (error) {
    return json({ error: (error as Error).message }, 404);
  }
  const region = renderer
    .pageComponents(ctx, 'region')
    .find((candidate) => renderer.regionDomId(candidate) === regionId || candidate.id === regionId);
  if (!region || str(region.props, 'type') !== 'search')
    return json({ error: `Search region ${regionId} not found` }, 404);
  let request: SearchQuery = {};
  try {
    request = JSON.parse(body.x02 || '{}') as SearchQuery;
  } catch {
    request = {};
  }
  return json(runSearch(renderer, ctx, region, request));
}
