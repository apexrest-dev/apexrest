import { bool, get, num, str, type ApxComponent } from '../../apexlang.ts';
import type { RouteRequest, RouteResponse } from '../../extensions.ts';
import type { ApexRenderer, RenderContext, Session } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import {
  facetCounts,
  facetLov,
  facetsOf,
  facetValue,
  filteredRegion,
  filterRegionsFor,
  FILTER_REGION_TYPES,
  predicates,
  queryColumns,
  totalCount,
  where,
  type Facet,
  type FilterContext,
  type Lov,
} from './model.ts';

/** True while the engine reads the unfiltered query of a region (counts, distinct values). */
let unfiltered = 0;

export function baseSql(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
): string | undefined {
  unfiltered += 1;
  try {
    return renderer.regionSql(ctx, region);
  } finally {
    unfiltered -= 1;
  }
}

/** `regionSql` hook: wraps the region query with the predicates of every facet that has a value. */
export function filterSql(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  sql: string,
): string | undefined {
  if (unfiltered) return undefined;
  let result = sql;
  for (const filters of filterRegionsFor(renderer, ctx, region)) {
    const facets = facetsOf(renderer, ctx, filters);
    if (!facets.some((facet) => facet.kind !== 'group' && facetValue(renderer, ctx, facet) !== '')) continue;
    const columns = queryColumns(renderer, ctx, region, sql);
    result = where(result, predicates({ renderer, ctx, filters, columns }, facets));
  }
  return result === sql ? undefined : result;
}

const yes = (value: string, fallback: boolean) => (value === '' ? fallback : value !== 'false');

function control(
  renderer: ApexRenderer,
  ctx: RenderContext,
  facet: Facet,
  lov: Lov[],
  smart: boolean,
): Record<string, unknown> {
  const props = facet.component.props;
  const label = renderer.substitute(ctx.session, facet.label, ctx.page, 'RAW');
  const common: Record<string, unknown> = {
    name: facet.name,
    label,
    collapsible: bool(props, 'advanced.collapsible', !smart),
    initialCollapsed: bool(props, 'advanced.initiallyCollapsed', false),
    hasFeedback: bool(props, 'listEntries.computeCounts', true),
    showCounts: bool(props, 'listEntries.showCounts', true),
    displayAs: str(props, 'appearance.display') === 'addFilterDialog' ? 'FILTER_DIALOG' : 'INLINE',
    escape: bool(props, 'security.escapeSpecialChars', true),
    includeLabel: bool(props, 'label.showLabelForCurrentFacet', true),
  };
  const icon = str(props, 'appearance.icon');
  if (icon) common.icon = /(^|\s)fa-/u.test(icon) && !/(^|\s)fa(\s|$)/u.test(icon) ? `fa ${icon}` : icon;
  const cssClasses = str(props, 'advanced.cssClasses');
  if (cssClasses) common.cssClasses = cssClasses;
  const maxHeight = num(props, 'layout.maxHeight', 0);
  if (maxHeight) common.maxHeight = maxHeight;
  if (smart) common.suggestedValues = suggestions(renderer, ctx, facet);
  const listOptions = {
    values: lov,
    hideEmpty: str(props, 'listEntries.zeroCountEntries') === 'hide',
    disabledLast: str(props, 'listEntries.zeroCountEntries') === 'showLast',
    orderByCount: bool(props, 'listEntries.sortByTopCounts', facet.kind === 'list'),
    checkedFirst: bool(props, 'listEntries.showSelectedFirst', false),
    showAllCount: num(props, 'listEntries.maxDisplayedEntries', 7),
    allowExclude: facet.allowExclude,
    filterValues: bool(props, 'listEntries.displayFilterInitially', false),
    actionsFilter: bool(props, 'actionsMenu.filter', false),
  };
  const numberType = facet.number ? 'NUMBER' : 'VARCHAR2';
  switch (facet.kind) {
    case 'group':
      return { ...common, type: 'group', name: facet.name, showCounts: common.showCounts };
    case 'checkbox':
      return { ...common, type: 'checkbox', value: facet.checkedValue, altLabel: label };
    case 'list':
      return {
        ...common,
        ...listOptions,
        type: 'list',
        multiple: facet.multiple,
        hideRadioButton: bool(props, 'settings.hideRadioButtons', false),
      };
    case 'selectList':
      return {
        ...common,
        type: 'selectList',
        values: lov,
        hideEmpty: listOptions.hideEmpty,
        nullLabel: str(props, 'appearance.valuePlaceholder', '- Select -'),
      };
    case 'rangeList':
      if (!lov.length)
        return { ...common, type: 'range', dataType: numberType, allowOpen: true, ...rangeText(props) };
      return {
        ...common,
        ...listOptions,
        orderByCount: false,
        type: 'rangeList',
        multiple: facet.multiple,
        noManualEntry: !bool(props, 'settings.manualEntry', true),
        allowOpen: true,
        dataType: numberType,
        ...rangeText(props),
      };
    case 'starRating':
      return {
        ...common,
        ...listOptions,
        orderByCount: false,
        type: 'starRating',
        activeIcon: 'fa fa-star',
        activeColor: str(props, 'settings.activeColor') || undefined,
        inactiveColor: str(props, 'settings.inactiveColor') || undefined,
        itemLabel: 'APEX.FS.STAR_RATING_LABEL',
      };
    default:
      return {
        ...common,
        type: 'input',
        dataType: numberType,
        inputLabel: str(props, 'appearance.valuePlaceholder') || undefined,
        suffixText: str(props, 'settings.suffixText') || undefined,
        flexibleOperator: bool(props, 'settings.userCanChooseOperator', false),
      };
  }
}

function rangeText(props: ApxComponent['props']): Record<string, string> {
  const result: Record<string, string> = { rangeText: 'to' };
  for (const [key, option] of [
    ['prefixText', 'prefixText'],
    ['suffixText', 'suffixText'],
    ['rangeText', 'rangeText'],
    ['currentLabel', 'currentLabel'],
    ['currentLabelOpenHi', 'currentLabelOpenHigh'],
    ['currentLabelOpenLow', 'currentLabelOpenLow'],
  ] as const) {
    const value = str(props, `settings.${option}`);
    if (value) result[key] = value;
  }
  return result;
}

function suggestions(renderer: ApexRenderer, ctx: RenderContext, facet: Facet): boolean | string[] {
  const props = facet.component.props;
  const type = str(props, 'suggestions.type');
  if (type === 'staticValues') {
    const values = get(props, 'suggestions.staticValues');
    return Array.isArray(values) ? values.map(String) : str(props, 'suggestions.staticValues').split(',');
  }
  if (type === 'sqlQuery') {
    try {
      return renderer.db
        .query(str(props, 'suggestions.sqlQuery'), renderer.binds(ctx.session, ctx.page), 50)
        .rows.map((row) => String(Object.values(row)[0] ?? ''));
    } catch (error) {
      renderer.diagnose(
        'warning',
        `Suggestions query of filter ${facet.name} failed: ${(error as Error).message}`,
        ctx.pageId,
      );
      return false;
    }
  }
  return ['list', 'rangeList', 'selectList', 'starRating', 'checkbox'].includes(facet.kind);
}

const SUPPORTED_SETTINGS = new Set([
  'batchFacetChanges',
  'compactNosThreshold',
  'currentFacetsSelector',
  'displayChartForTopNValues',
  'showCharts',
  'chartsSelector',
  'showCurrentFacets',
  'showTotalRowCount',
  'totalRowCountLabel',
  'totalRowCountSelector',
  'maximumSuggestionChips',
  'maxSuggestionChips',
  'showMoreFiltersChip',
  'collapsibleSearchBar',
]);

/** Faceted Search and Smart Filters regions: the genuine `apex.facets` widget fed by a local route. */
export function renderFilters(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const smart = str(region.props, 'type') === 'smartFilters';
  const domId = renderer.regionDomId(region);
  const target = filteredRegion(renderer, ctx, region);
  if (!target) {
    renderer.diagnose(
      'warning',
      `${smart ? 'Smart Filters' : 'Faceted Search'} region ${region.id} has no filtered region`,
      ctx.pageId,
      region.id,
    );
    return `<div class="apex-local-unsupported">“${escapeHtml(str(region.props, 'name', region.id))}” has no filtered region.</div>`;
  }
  const settings = get(region.props, 'settings');
  for (const key of Object.keys(
    typeof settings === 'object' && settings && !Array.isArray(settings) ? settings : {},
  ))
    if (!SUPPORTED_SETTINGS.has(key))
      renderer.diagnose(
        'info',
        `Setting ${key} of region ${region.id} is not simulated`,
        ctx.pageId,
        region.id,
      );
  if (str(region.props, 'settings.showCharts', smart ? 'false' : 'dialog') !== 'false')
    renderer.diagnose(
      'info',
      `Facet charts of region ${region.id} need Oracle JET and are not shown locally`,
      ctx.pageId,
      region.id,
    );
  const facets = facetsOf(renderer, ctx, region);
  const sql = baseSql(renderer, ctx, target);
  const columns = sql ? queryColumns(renderer, ctx, target, sql) : [];
  const base = { region: target, sql: sql ?? 'select 1 from dual where 1 = 0', columns };
  const search = facets.find((facet) => facet.kind === 'search');
  const items: string[] = [];
  const hidden = (name: string, value: string) => {
    items.push(name);
    return `<input type="hidden" name="${escapeHtml(name)}" id="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
  };
  const inputs: string[] = [];
  const controls = facets
    .filter((facet) => facet.kind !== 'search')
    .map((facet) => {
      inputs.push(hidden(facet.name, facet.kind === 'group' ? '' : facetValue(renderer, ctx, facet)));
      const lov = ['list', 'rangeList', 'selectList', 'starRating'].includes(facet.kind)
        ? facetLov(renderer, ctx, facet, base)
        : [];
      return control(renderer, ctx, facet, lov, smart);
    });
  const searchName = search?.name ?? '';
  if (search) inputs.push(hidden(search.name, facetValue(renderer, ctx, search)));
  const currentFacets = str(region.props, 'settings.showCurrentFacets', 'true');
  const totalCountSetting = str(region.props, 'settings.showTotalRowCount', 'true');
  const options: Record<string, unknown> = {
    regionDomId: domId,
    ajaxIdentifier: `apexlocal:facets:${domId}`,
    uiMode: smart ? 'S' : 'F',
    batch: bool(region.props, 'settings.batchFacetChanges', false),
    feedback: true,
    searchField: Boolean(searchName),
    searchItem: searchName || null,
    multipleSearches: smart,
    currentFacets:
      currentFacets === 'selector'
        ? str(region.props, 'settings.currentFacetsSelector') || true
        : currentFacets !== 'false',
    showTotalCount:
      totalCountSetting === 'selector'
        ? str(region.props, 'settings.totalRowCountSelector')
        : yes(totalCountSetting, true),
    showCharts: false,
    controls,
    text: {
      searchLabel: search ? renderer.substitute(ctx.session, search.label, ctx.page, 'RAW') : 'Search',
      searchPlaceholder: (search && str(search.component.props, 'appearance.valuePlaceholder')) || 'Search',
      totalCountLabel: str(region.props, 'settings.totalRowCountLabel', 'Total Row Count'),
    },
  };
  if (smart) {
    options.maxChips = num(
      region.props,
      'settings.maximumSuggestionChips',
      num(region.props, 'settings.maxSuggestionChips', 5),
    );
    options.moreFiltersChip = bool(region.props, 'settings.showMoreFiltersChip', true);
    const collapsible = get(region.props, 'settings.collapsibleSearchBar');
    if (typeof collapsible === 'boolean') options.collapsibleSearchBar = collapsible;
  }
  const threshold = num(region.props, 'settings.compactNosThreshold', 0);
  if (threshold) options.numberFormatThreshold = threshold;
  ctx.jsFiles.add('#APEX_FILES#libraries/apex/#MIN_DIRECTORY#widget.facets#MIN#.js?v=#APEX_VERSION#');
  if (controls.some((entry) => entry.filterValues || entry.actionsFilter))
    ctx.jsFiles.add('#APEX_FILES#libraries/apex/#MIN_DIRECTORY#widget.filterable#MIN#.js?v=#APEX_VERSION#');
  const widgetId = `${domId}_FS`;
  ctx.onload.push(
    `apex.jQuery('#${widgetId}').facets(${JSON.stringify(options).replaceAll('<', '\\u003c')});`,
  );
  return `<div id="${escapeHtml(widgetId)}" data-apex-local-region="${escapeHtml(domId)}" data-apex-local-filtered="${escapeHtml(renderer.regionDomId(target))}" data-apex-local-items="${escapeHtml(items.join(','))}"></div><div class="apex-local-facet-items" hidden>${inputs.join('')}</div>`;
}

interface FacetsRequest {
  items?: Record<string, string | string[]>;
  x01?: string;
  x02?: string;
  x03?: string;
}

/**
 * POST `/__apex/x/facets?page=&region=`: stores the submitted facet items in session state and,
 * for `FETCH_COUNTS`, answers like the genuine plug-in Ajax callback: `{ counts, totalCount }`.
 * `x01: "ITEM"` stores arbitrary known page items (the cards order-by item).
 */
export function facetsRoute(renderer: ApexRenderer, session: Session, request: RouteRequest): RouteResponse {
  const json = (body: unknown, status = 200): RouteResponse => ({
    status,
    type: 'json',
    body: JSON.stringify(body),
  });
  let input: FacetsRequest;
  try {
    input = JSON.parse(request.body || '{}') as FacetsRequest;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const pageKey = request.params.get('page') ?? '';
  if (!renderer.findPage(pageKey)) return json({ error: `Page ${pageKey} does not exist` }, 404);
  const ctx = renderer.prepare(session, pageKey);
  const regionId = request.params.get('region') ?? '';
  const region = renderer
    .pageComponents(ctx, 'region')
    .find((candidate) => renderer.regionDomId(candidate) === regionId || candidate.id === regionId);
  if (!region) return json({ error: `Region ${regionId} not found` }, 404);
  const value = (raw: string | string[] | undefined) =>
    Array.isArray(raw) ? raw.join(':') : String(raw ?? '');

  if (input.x01 === 'ITEM') {
    for (const [name, raw] of Object.entries(input.items ?? {}))
      if (renderer.isKnownItem(name.toUpperCase())) session.items[name.toUpperCase()] = value(raw);
    delete session.pagination[`${ctx.pageId}:${region.id}`];
    return json({});
  }
  if (!FILTER_REGION_TYPES.has(str(region.props, 'type')))
    return json({ error: `Region ${regionId} is not a faceted search region` }, 400);
  const facets = facetsOf(renderer, ctx, region);
  const smart = str(region.props, 'type') === 'smartFilters';
  const names = new Set(facets.map((facet) => facet.name));
  const target = filteredRegion(renderer, ctx, region);
  let changed = false;
  for (const [name, raw] of Object.entries(input.items ?? {})) {
    const key = name.toUpperCase();
    if (!names.has(key)) continue;
    if ((session.items[key] ?? '') !== value(raw)) changed = true;
    session.items[key] = value(raw);
  }
  if (changed && target) delete session.pagination[`${ctx.pageId}:${target.id}`];
  if (input.x01 === 'STATE' || !target) return json({});

  const sql = baseSql(renderer, ctx, target);
  if (!sql) return json({ counts: {}, totalCount: 0 });
  const columns = queryColumns(renderer, ctx, target, sql);
  const context: FilterContext = { renderer, ctx, filters: region, columns };
  let hiddenFacets: string[] = [];
  try {
    hiddenFacets = input.x02 ? (JSON.parse(input.x02) as string[]) : [];
  } catch {
    hiddenFacets = [];
  }
  const base = { region: target, sql, columns };
  const counts: Record<string, Record<string, number>> = {};
  for (const facet of facets) {
    if (hiddenFacets.includes(facet.name) || ['search', 'input', 'group'].includes(facet.kind)) continue;
    if (!bool(facet.component.props, 'listEntries.computeCounts', true)) continue;
    const lov = ['rangeList', 'starRating'].includes(facet.kind) ? facetLov(renderer, ctx, facet, base) : [];
    counts[facet.name] = facetCounts(context, facets, facet, base, lov);
  }
  return json({ counts, totalCount: totalCount(context, facets, base) });
}
