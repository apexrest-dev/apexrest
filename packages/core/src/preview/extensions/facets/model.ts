import {
  bool,
  get,
  isObject,
  list,
  num,
  ref,
  str,
  type ApxComponent,
  type ApxValue,
} from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';

/**
 * The faceted search engine shared by Faceted Search and Smart Filters: facet definitions,
 * session values, and the SQL predicates that filter the bound region and compute counts.
 * Values use the genuine facets item format: `:` separates values, `|` separates range bounds,
 * search terms are newline separated, and exclude-capable facets prefix `I`/`E`.
 */

export type FacetKind =
  'list' | 'rangeList' | 'range' | 'selectList' | 'input' | 'search' | 'starRating' | 'checkbox' | 'group';

export interface Lov {
  d: string;
  r: string;
}

export interface Facet {
  component: ApxComponent;
  /** Item / session state name (upper case). */
  name: string;
  kind: FacetKind;
  label: string;
  column: string;
  /** Search columns (search facets). */
  columns: string[];
  number: boolean;
  multiple: boolean;
  allowExclude: boolean;
  /** Checkbox facets: the value that is stored when checked. */
  checkedValue: string;
  /** Group facets: member checkboxes; members point at their group. */
  members: Facet[];
  group?: Facet | undefined;
  combine: 'or' | 'and';
  operator: string;
  /** Static LOV entries, when known without querying the data. */
  staticValues?: Lov[] | undefined;
}

export const FILTER_REGION_TYPES = new Set(['facetedSearch', 'smartFilters']);

const FACET_KINDS: Record<string, FacetKind> = {
  checkboxGroup: 'list',
  radioGroup: 'list',
  range: 'rangeList',
  selectList: 'selectList',
  inputField: 'input',
  textField: 'input',
  numberField: 'input',
  search: 'search',
  starRating: 'starRating',
  checkbox: 'checkbox',
};

const OPERATORS = new Set(['EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE', 'STARTS', 'NSTARTS', 'C', 'NC']);

const COMPARISON: Record<string, string> = {
  equals: 'EQ',
  notEquals: 'NEQ',
  lessThan: 'LT',
  lessThanOrEqualTo: 'LTE',
  greaterThan: 'GT',
  greaterThanOrEqualTo: 'GTE',
  startsWith: 'STARTS',
  doesNotStartWith: 'NSTARTS',
  contains: 'C',
  doesNotContain: 'NC',
};

export const quoteIdent = (name: string) => `"${name.replaceAll('"', '').toUpperCase()}"`;
export const quoteText = (value: string) => `'${value.replaceAll("'", "''")}'`;
const numeric = (value: string) => value.trim() !== '' && Number.isFinite(Number(value));
const literal = (value: string, number: boolean) =>
  number && numeric(value) ? String(Number(value)) : quoteText(value);

/** Faceted Search / Smart Filters regions on this page that filter `region`. */
export function filterRegionsFor(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
): ApxComponent[] {
  return renderer
    .pageComponents(ctx, 'region')
    .filter(
      (candidate) =>
        FILTER_REGION_TYPES.has(str(candidate.props, 'type')) &&
        ref(candidate.props, 'source.filteredRegion') === region.id,
    );
}

export function filteredRegion(
  renderer: ApexRenderer,
  ctx: RenderContext,
  filters: ApxComponent,
): ApxComponent | undefined {
  const id = ref(filters.props, 'source.filteredRegion');
  return renderer.pageComponents(ctx, 'region').find((candidate) => candidate.id === id);
}

function sequence(component: ApxComponent): number {
  return num(component.props, 'layout.sequence', num(component.props, 'sequence', 0));
}

/** Static LOV text with the `#G#` / `#D#` group and decimal separator tokens resolved. */
export function staticLov(renderer: ApexRenderer, value: string): Lov[] {
  return renderer.staticLov(value).map((entry) => ({
    d: entry.d.replaceAll('#G#', ',').replaceAll('#D#', '.'),
    r: entry.r,
  }));
}

function facetOf(
  renderer: ApexRenderer,
  ctx: RenderContext,
  component: ApxComponent,
  owner: ApxComponent,
): Facet | undefined {
  const type = str(component.props, 'type');
  const kind = FACET_KINDS[type];
  const name = component.id.toUpperCase();
  if (!kind) {
    renderer.diagnose(
      'warning',
      `Facet ${name} of type ${type || '(none)'} is not simulated; it is ignored`,
      ctx.pageId,
      owner.id,
    );
    return undefined;
  }
  const props = component.props;
  const lovType = str(props, 'lov.type');
  const label = str(props, 'label.label', str(props, 'name', name));
  const dataType = str(props, 'source.dataType').toLowerCase();
  const column = str(props, 'source.databaseColumn', kind === 'search' ? '' : name);
  for (const unsupported of ['cascadingLov.parentFacet', 'dependingOn.facet', 'multipleValues.type'])
    if (get(props, unsupported) !== undefined)
      renderer.diagnose(
        'info',
        `Facet ${name}: ${unsupported.split('.')[0]} is not simulated locally`,
        ctx.pageId,
        owner.id,
      );
  return {
    component,
    name,
    kind,
    label,
    column,
    columns: str(props, 'source.dbColumns')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    number: dataType === 'number' || kind === 'starRating' || type === 'numberField',
    multiple:
      type === 'checkboxGroup' || (kind === 'rangeList' && bool(props, 'settings.selectMultiple', false)),
    allowExclude: ['list', 'rangeList'].includes(kind) && bool(props, 'listEntries.allowToExclude', false),
    checkedValue: str(props, 'settings.checkedValue', 'Y'),
    members: [],
    combine: 'or',
    operator:
      COMPARISON[str(props, 'settings.comparisonOperator')] ??
      (type === 'textField' || dataType === 'number' ? 'EQ' : 'C'),
    staticValues:
      lovType === 'staticValues' || (kind === 'rangeList' && str(props, 'lov.staticValues'))
        ? staticLov(renderer, str(props, 'lov.staticValues'))
        : undefined,
  };
}

/**
 * Facets of a Faceted Search (`facet`, `facetGroup`) or Smart Filters (`filter`, `filterGroup`)
 * region in sequence order, groups followed by their checkbox members.
 */
export function facetsOf(renderer: ApexRenderer, ctx: RenderContext, filters: ApxComponent): Facet[] {
  const result: Facet[] = [];
  const children = [...filters.children]
    .filter((child) => ['facet', 'facetGroup', 'filter', 'filterGroup'].includes(child.type))
    .sort((a, b) => sequence(a) - sequence(b));
  for (const child of children) {
    if (!renderer.condition(ctx, child.props)) continue;
    if (child.type === 'facetGroup' || child.type === 'filterGroup') {
      const name = (str(child.props, 'advanced.staticId') || child.id).toUpperCase();
      const group: Facet = {
        component: child,
        name,
        kind: 'group',
        label: str(child.props, 'label', child.id),
        column: '',
        columns: [],
        number: false,
        multiple: true,
        allowExclude: false,
        checkedValue: '',
        members: [],
        combine: str(child.props, 'advanced.combineFilters', 'or') === 'and' ? 'and' : 'or',
        operator: 'EQ',
      };
      result.push(group);
      for (const member of [...child.children]
        .filter((entry) => ['checkbox', 'facet', 'filter'].includes(entry.type))
        .sort((a, b) => sequence(a) - sequence(b))) {
        if (!renderer.condition(ctx, member.props)) continue;
        const facet = facetOf(renderer, ctx, member, filters);
        if (!facet) continue;
        facet.kind = 'checkbox';
        facet.group = group;
        group.members.push(facet);
        result.push(facet);
      }
      continue;
    }
    const facet = facetOf(renderer, ctx, child, filters);
    if (facet) result.push(facet);
  }
  // Smart Filters always have a search field; synthesize it (all columns) when the app has none.
  if (str(filters.props, 'type') === 'smartFilters' && !result.some((facet) => facet.kind === 'search')) {
    const component: ApxComponent = {
      type: 'filter',
      id: `${renderer.regionDomId(filters).toUpperCase()}_SEARCH`,
      props: { type: 'search', label: { label: 'Search' } },
      children: [],
      file: filters.file,
      line: filters.line,
    };
    const search = facetOf(renderer, ctx, component, filters);
    if (search) result.push(search);
  }
  return result;
}

/** Current value: session state, else the facet default (static or item). */
export function facetValue(renderer: ApexRenderer, ctx: RenderContext, facet: Facet): string {
  if (facet.name in ctx.session.items) return ctx.session.items[facet.name] ?? '';
  const props = facet.component.props;
  const type = str(props, 'default.type');
  if (type === 'item') {
    const item = str(props, 'default.item').toUpperCase();
    return ctx.session.items[item] ?? '';
  }
  const value = str(props, 'default.staticValue');
  return value ? renderer.substitute(ctx.session, value, ctx.page, 'RAW') : '';
}

interface Parsed {
  exclude: boolean;
  values: string[];
}

export function parseValue(facet: Facet, raw: string): Parsed {
  let value = raw;
  let exclude = false;
  if (facet.allowExclude && /^[IE]/u.test(value)) {
    exclude = value[0] === 'E';
    value = value.slice(1);
  }
  if (facet.kind === 'search') return { exclude, values: value.split('\n').filter((term) => term.trim()) };
  if (facet.kind === 'input') return { exclude, values: value === '' ? [] : [value] };
  return { exclude, values: value === '' ? [] : value.split(':') };
}

function inList(column: string, values: string[]): string {
  const literals = new Set<string>();
  for (const value of values) {
    // SQLite compares untyped subquery columns by storage class; match numbers in both forms.
    literals.add(quoteText(value));
    if (numeric(value)) literals.add(String(Number(value)));
  }
  return `${column} in (${[...literals].join(', ')})`;
}

/** LOV ranges are `begin|end` with an exclusive end; manually entered ranges include the end. */
function rangePredicate(column: string, value: string, inclusiveEnd: boolean): string {
  const [begin = '', end = ''] = value.split('|');
  const parts = [
    begin !== '' ? `${column} >= ${literal(begin, true)}` : '',
    end !== '' ? `${column} ${inclusiveEnd ? '<=' : '<'} ${literal(end, true)}` : '',
  ].filter(Boolean);
  return parts.length ? `(${parts.join(' and ')})` : '';
}

function inputPredicate(column: string, facet: Facet, raw: string): string {
  let operator = facet.operator;
  let value = raw;
  const prefix = /^([A-Z]+):([\s\S]*)$/u.exec(raw);
  if (prefix && OPERATORS.has(prefix[1]!)) {
    operator = prefix[1]!;
    value = prefix[2]!;
  }
  if (value === '') return '';
  const text = `upper(${column})`;
  const needle = `upper(${quoteText(value)})`;
  switch (operator) {
    case 'NEQ':
      return `${column} <> ${literal(value, facet.number)}`;
    case 'LT':
      return `${column} < ${literal(value, facet.number)}`;
    case 'LTE':
      return `${column} <= ${literal(value, facet.number)}`;
    case 'GT':
      return `${column} > ${literal(value, facet.number)}`;
    case 'GTE':
      return `${column} >= ${literal(value, facet.number)}`;
    case 'STARTS':
      return `instr(${text}, ${needle}) = 1`;
    case 'NSTARTS':
      return `coalesce(instr(${text}, ${needle}), 0) <> 1`;
    case 'C':
      return `instr(${text}, ${needle}) > 0`;
    case 'NC':
      return `coalesce(instr(${text}, ${needle}), 0) = 0`;
    default:
      return inList(column, [value]);
  }
}

/** Resolves a facet column against the columns the filtered query really returns. */
export function resolveColumn(columns: string[], name: string): string | undefined {
  const upper = name.replaceAll('"', '').toUpperCase();
  return columns.find((column) => column.toUpperCase() === upper);
}

export interface FilterContext {
  renderer: ApexRenderer;
  ctx: RenderContext;
  filters: ApxComponent;
  /** Columns of the unfiltered region query. */
  columns: string[];
}

/** SQL predicate of one facet for a raw value, or '' when it does not filter. */
export function predicate(context: FilterContext, facet: Facet, raw: string): string {
  const { renderer, ctx, filters, columns } = context;
  const parsed = parseValue(facet, raw);
  if (!parsed.values.length || facet.kind === 'group') return '';
  if (facet.kind === 'search') {
    const searchable = (facet.columns.length ? facet.columns : columns)
      .map((name) => resolveColumn(columns, name))
      .filter((name): name is string => Boolean(name));
    if (!searchable.length) return '';
    const terms = parsed.values.map(
      (term) =>
        `(${searchable.map((name) => `instr(upper(${quoteIdent(name)}), upper(${quoteText(term.trim())})) > 0`).join(' or ')})`,
    );
    return terms.join(' and ');
  }
  const resolved = resolveColumn(columns, facet.column);
  if (!resolved) {
    renderer.diagnose(
      'warning',
      `Facet ${facet.name} filters column ${facet.column.toUpperCase()}, which the filtered region does not return`,
      ctx.pageId,
      filters.id,
    );
    return '';
  }
  const column = quoteIdent(resolved);
  let sql = '';
  switch (facet.kind) {
    case 'list':
    case 'selectList':
    case 'checkbox':
      sql = inList(column, parsed.values);
      break;
    case 'starRating': {
      const stars = parsed.values.map(Number).filter(Number.isFinite);
      sql = stars.length ? `${column} >= ${Math.min(...stars)}` : '';
      break;
    }
    case 'rangeList':
    case 'range': {
      const known = new Set((facet.staticValues ?? []).map((entry) => entry.r));
      const ranges = parsed.values
        .map((value) => rangePredicate(column, value, facet.kind === 'range' || !known.has(value)))
        .filter(Boolean);
      sql = ranges.length ? `(${ranges.join(' or ')})` : '';
      break;
    }
    case 'input':
      sql = inputPredicate(column, facet, parsed.values[0]!);
      break;
  }
  if (!sql) return '';
  return parsed.exclude ? `not coalesce(${sql}, 0)` : sql;
}

/**
 * Predicates of all facets with a value. `except` leaves one facet (or a whole OR group)
 * out, which is how counts for that facet's own options are computed.
 */
export function predicates(context: FilterContext, facets: Facet[], except?: Facet): string[] {
  const { renderer, ctx } = context;
  const skip = except?.group && except.group.combine === 'or' ? except.group : except;
  const result: string[] = [];
  for (const facet of facets) {
    if (facet === skip || facet.kind === 'checkbox') continue;
    if (facet.kind === 'group') {
      const members = facet.members
        .filter((member) => member !== skip)
        .map((member) => predicate(context, member, facetValue(renderer, ctx, member)))
        .filter(Boolean);
      if (members.length) result.push(`(${members.join(facet.combine === 'and' ? ' and ' : ' or ')})`);
      continue;
    }
    const sql = predicate(context, facet, facetValue(renderer, ctx, facet));
    if (sql) result.push(sql);
  }
  return result;
}

export const where = (sql: string, parts: string[]) =>
  parts.length ? `select * from (${sql}) where ${parts.map((part) => `(${part})`).join(' and ')}` : sql;

/** Columns returned by a region query (runs it once with one row, repairing sample tables). */
export function queryColumns(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  sql: string,
): string[] {
  return renderer.query(ctx, region, sql, 1).columns;
}

/** LOV entries of a list-like facet. Distinct values come from the unfiltered region query. */
export function facetLov(
  renderer: ApexRenderer,
  ctx: RenderContext,
  facet: Facet,
  base: { region: ApxComponent; sql: string; columns: string[] },
): Lov[] {
  const props = facet.component.props;
  if (facet.kind === 'starRating') {
    const stars = num(props, 'settings.noOfStars', 5);
    return Array.from({ length: stars }, (_, index) => ({ d: String(index + 1), r: String(index + 1) }));
  }
  if (facet.staticValues) return facet.staticValues;
  const lovType = str(props, 'lov.type');
  if (lovType === 'distinctValues' || (!lovType && facet.kind !== 'checkbox')) {
    const column = resolveColumn(base.columns, facet.column);
    if (!column) return [];
    const direction = str(props, 'lov.sortDirection') === 'desc' ? 'desc' : 'asc';
    const result = renderer.query(
      ctx,
      base.region,
      `select distinct ${quoteIdent(column)} as R from (${base.sql}) where ${quoteIdent(column)} is not null order by 1 ${direction}`,
      5_000,
    );
    return result.rows.map((row: Row) => ({ d: String(row.R ?? ''), r: String(row.R ?? '') }));
  }
  const spec = get(props, 'lov') as ApxValue | undefined;
  const entries = isObject(spec) ? renderer.lov(ctx, spec, facet.name) : [];
  if (bool(props, 'lov.includeNullOption', false))
    entries.unshift({ d: str(props, 'lov.nullDisplayValue', '- No Value -'), r: '' });
  return entries.map((entry) => ({
    d: entry.d.replaceAll('#G#', ',').replaceAll('#D#', '.'),
    r: entry.r,
  }));
}

/** Counts per LOV value for one facet with all other facet filters applied. */
export function facetCounts(
  context: FilterContext,
  facets: Facet[],
  facet: Facet,
  base: { region: ApxComponent; sql: string },
  lov: Lov[],
): Record<string, number> {
  const { renderer, ctx, columns } = context;
  const filtered = where(base.sql, predicates(context, facets, facet));
  const counts: Record<string, number> = {};
  if (facet.kind === 'checkbox') {
    const sql = predicate(context, facet, facet.checkedValue);
    if (!sql) return counts;
    const row = renderer.query(ctx, base.region, `select count(*) as C from (${filtered}) where ${sql}`, 1)
      .rows[0];
    counts[facet.checkedValue] = Number(row?.C ?? 0);
    return counts;
  }
  const column = resolveColumn(columns, facet.column);
  if (!column) return counts;
  if (facet.kind === 'list' || facet.kind === 'selectList') {
    const result = renderer.query(
      ctx,
      base.region,
      `select ${quoteIdent(column)} as V, count(*) as C from (${filtered}) group by ${quoteIdent(column)}`,
      10_000,
    );
    for (const row of result.rows) counts[String(row.V ?? '')] = Number(row.C ?? 0);
    return counts;
  }
  // Ranges and star ratings: one conditional sum per LOV entry.
  if (!lov.length) return counts;
  const sums = lov.map((entry, index) => {
    const sql = predicate(context, { ...facet, allowExclude: false, multiple: false }, entry.r);
    return `sum(case when ${sql || '1 = 0'} then 1 else 0 end) as C${index}`;
  });
  const row = renderer.query(ctx, base.region, `select ${sums.join(', ')} from (${filtered})`, 1).rows[0];
  lov.forEach((entry, index) => {
    counts[entry.r] = Number(row?.[`C${index}`] ?? 0);
  });
  return counts;
}

export function totalCount(
  context: FilterContext,
  facets: Facet[],
  base: { region: ApxComponent; sql: string },
): number {
  const sql = where(base.sql, predicates(context, facets));
  const row = context.renderer.query(context.ctx, base.region, `select count(*) as C from (${sql})`, 1)
    .rows[0];
  return Number(row?.C ?? 0);
}

/** `list()` of string-ish values. */
export const strings = (props: ApxComponent['props'], key: string) =>
  list(props, key).map((value) => (typeof value === 'string' ? value : String(value)));
