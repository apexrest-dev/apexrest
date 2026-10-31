import fs from 'node:fs';
import path from 'node:path';
import {
  bool,
  get,
  isObject,
  isRef,
  list,
  num,
  ref,
  str,
  type ApxComponent,
  type ApxObject,
  type ApxValue,
} from '../../apexlang.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';

export type LovEntry = { d: string; r: string };

/** Script URLs as Universal Theme writes them; `renderPage` resolves the prefixes. */
export const apexScript = (name: string) =>
  `#APEX_FILES#libraries/apex/#MIN_DIRECTORY#${name}#MIN#.js?v=#APEX_VERSION#`;

const LIBRARY_DEFAULTS: Record<string, string> = { markedjs: '18.0.11', purify: '3.4.14' };
const libraryCache = new Map<string, string>();

/** Version folder of a third-party library in the extracted runtime (`libraries/<name>/<version>`). */
export function libraryVersion(renderer: ApexRenderer, library: string): string {
  const key = `${renderer.assets.imagesDir}|${library}`;
  if (!libraryCache.has(key)) {
    let version = LIBRARY_DEFAULTS[library] ?? '';
    try {
      const found = fs
        .readdirSync(path.join(renderer.assets.imagesDir, 'libraries', library), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d/u.test(entry.name))
        .map((entry) => entry.name)
        .sort();
      if (found.length) version = found.at(-1)!;
    } catch {
      // library not part of the extracted runtime
    }
    libraryCache.set(key, version);
  }
  return libraryCache.get(key)!;
}

/** `apex.libVersions` as the APEX page head defines it; widgets load optional libraries with it. */
export function libVersions(renderer: ApexRenderer): Record<string, string> {
  const entries: [string, string][] = [
    ['domPurify', 'purify'],
    ['cropperJs', 'cropperjs'],
    ['jquery', 'jquery'],
    ['jqueryUi', 'jquery-ui'],
    ['hammer', 'hammer'],
    ['markedJs', 'markedjs'],
  ];
  return Object.fromEntries(
    entries
      .map(([key, library]) => [key, libraryVersion(renderer, library)] as [string, string])
      .filter(([, version]) => version),
  );
}

/** Per-item facts the element renderer learns and the label template needs afterwards. */
export interface ItemState {
  /** Replaces the `apex-item-wrapper--<type>` modifier. */
  wrapper?: string[];
  /** Extra container classes such as `is-readonly`. */
  container?: string[];
}

export const itemState = new WeakMap<ApxComponent, ItemState>();

export function state(item: ApxComponent): ItemState {
  let entry = itemState.get(item);
  if (!entry) {
    entry = {};
    itemState.set(item, entry);
  }
  return entry;
}

export function strings(value: ApxValue | undefined): string[] {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((entry) => (typeof entry === 'string' ? entry : isRef(entry) ? entry.ref : String(entry)))
    .flatMap((entry) => entry.split(/[\s,]+/u))
    .filter(Boolean);
}

/** Attribute markup from a record; `false`/`undefined` values are skipped, `true` renders bare. */
export function attrs(values: Record<string, string | number | boolean | undefined | null>): string {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${escapeHtml(value)}"`))
    .join('');
}

/** Item settings fall back to the application's component settings unless `useDefaults: false`. */
export function setting(renderer: ApexRenderer, item: ApxComponent, key: string, fallback = ''): string {
  const own = get(item.props, `settings.${key}`);
  if (own !== undefined) return strings(own).join(':') || str(item.props, `settings.${key}`, fallback);
  if (bool(item.props, 'settings.useDefaults', true)) {
    const type = str(item.props, 'type');
    const component = renderer.app.shared.find(
      (entry) =>
        entry.type === 'componentSetting' &&
        str(entry.props, 'type') === 'item' &&
        str(entry.props, 'name') === type,
    );
    const shared = component ? get(component.props, `settings.${key}`) : undefined;
    if (shared !== undefined)
      return Array.isArray(shared) ? strings(shared).join(':') : str(component!.props, `settings.${key}`);
  }
  return fallback;
}

export function flag(renderer: ApexRenderer, item: ApxComponent, key: string, fallback: boolean): boolean {
  const value = setting(renderer, item, key, '');
  if (value === '') return fallback;
  return value === 'true' || value === 'Y';
}

/** Element-level classes and attributes (`advanced.cssClasses`, `advanced.customAttributes`). */
export function elementExtras(renderer: ApexRenderer, ctx: RenderContext, item: ApxComponent) {
  const custom = str(item.props, 'advanced.customAttributes');
  return {
    classes: strings(get(item.props, 'advanced.cssClasses')),
    attributes: custom ? ` ${renderer.substitute(ctx.session, custom, ctx.page, 'RAW')}` : '',
  };
}

export function placeholder(renderer: ApexRenderer, ctx: RenderContext, item: ApxComponent): string {
  const value = str(item.props, 'appearance.valuePlaceholder', str(item.props, 'appearance.placeholder'));
  return value ? renderer.substitute(ctx.session, value, ctx.page, 'RAW') : '';
}

export const required = (item: ApxComponent) => bool(item.props, 'validation.valueRequired', false);

/** `readOnly` condition of the item or of its region (any parent region). */
export function isReadOnly(renderer: ApexRenderer, ctx: RenderContext, item: ApxComponent): boolean {
  const own = (props: ApxObject) =>
    isObject(get(props, 'readOnly')) && str(props, 'readOnly.type') !== ''
      ? renderer.condition(ctx, props, 'readOnly')
      : false;
  if (own(item.props)) return true;
  const regions = renderer.pageComponents(ctx, 'region');
  let regionId = ref(item.props, 'layout.region');
  for (let guard = 0; regionId && guard < 10; guard += 1) {
    const region = regions.find((candidate) => candidate.id === regionId);
    if (!region) break;
    if (own(region.props)) return true;
    regionId = ref(region.props, 'layout.parentRegion');
  }
  return false;
}

/** Multi-value separator: `multipleValues.separator`, default `:`; JSON arrays are supported. */
export function separator(item: ApxComponent): string {
  return str(item.props, 'multipleValues.separator', ':') || ':';
}

export function splitValues(item: ApxComponent, value: string): string[] {
  if (value === '') return [];
  if (str(item.props, 'multipleValues.type') === 'jsonArray' || value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // fall through to the delimited form
    }
  }
  return value.split(separator(item));
}

export function ajaxIdentifier(ctx: RenderContext, name: string): string {
  return `LOCAL:${ctx.pageId}:${name}`;
}

/** `#P1_A,#P1_B` selectors for cascading parents and items to submit. */
export function cascading(item: ApxComponent): { parents: string; submit: string; required: boolean } {
  const selector = (key: string) =>
    strings(get(item.props, key))
      .map((name) => `#${name.toUpperCase()}`)
      .join(',');
  return {
    parents: selector('cascadingLov.parentItems'),
    submit: selector('cascadingLov.itemsToSubmit'),
    required: bool(item.props, 'cascadingLov.parentRequired', true),
  };
}

/** LOV entries with the configured null entry and, when allowed, the current value as an extra entry. */
export function lovEntries(
  renderer: ApexRenderer,
  ctx: RenderContext,
  item: ApxComponent,
  options: { nullDefault?: boolean; nullText?: string; values?: string[] } = {},
): LovEntry[] {
  const name = item.id.toUpperCase();
  const parents = cascading(item);
  // A cascading child with an empty required parent renders no rows, as APEX does.
  const parentEmpty =
    parents.parents !== '' &&
    parents.required &&
    strings(get(item.props, 'cascadingLov.parentItems')).some(
      (parent) => (ctx.session.items[parent.toUpperCase()] ?? '') === '',
    );
  const rows = parentEmpty ? [] : renderer.lov(ctx, get(item.props, 'lov'), name);
  const entries: LovEntry[] = [];
  if (bool(item.props, 'lov.displayNullValue', options.nullDefault ?? false))
    entries.push({
      d: str(item.props, 'lov.nullDisplayValue', options.nullText ?? ''),
      r: str(item.props, 'lov.nullReturnValue'),
    });
  entries.push(...rows);
  if (bool(item.props, 'lov.displayExtraValues', true))
    for (const value of options.values ?? [])
      if (value !== '' && !entries.some((entry) => entry.r === value)) entries.push({ d: value, r: value });
  return entries;
}

export interface LovColumn {
  name: string;
  heading: string;
  searchable: boolean;
}

export interface LovRows {
  columns: LovColumn[];
  display: string;
  returned: string;
  rows: Record<string, string>[];
}

/** Every column of an LOV (shared component columns, or all SQL columns) for multi-column popups. */
export function lovRows(renderer: ApexRenderer, ctx: RenderContext, item: ApxComponent): LovRows {
  const spec = get(item.props, 'lov');
  const name = item.id.toUpperCase();
  const fallback = (): LovRows => {
    const entries = lovEntries(renderer, ctx, item).filter((entry) => entry.r !== '' || entry.d !== '');
    return {
      columns: [{ name: 'D', heading: renderer.label(item), searchable: true }],
      display: 'D',
      returned: 'R',
      rows: entries.map((entry) => ({ D: entry.d, R: entry.r })),
    };
  };
  if (!isObject(spec)) return fallback();
  const shared = ref(spec, 'lov') ? renderer.shared('lov', ref(spec, 'lov')) : undefined;
  let sql = '';
  let display: string | undefined;
  let returned: string | undefined;
  let declared: LovColumn[] = [];
  if (shared) {
    const table = str(shared.props, 'source.tableName');
    sql = str(shared.props, 'source.sqlQuery') || (table ? `select * from ${table}` : '');
    display = str(shared.props, 'columnMapping.display') || undefined;
    returned = str(shared.props, 'columnMapping.return') || undefined;
    declared = shared.children
      .filter((child) => child.type === 'column' && bool(child.props, 'show', true))
      .sort((a, b) => num(a.props, 'layout.sequence', 0) - num(b.props, 'layout.sequence', 0))
      .map((child) => {
        const column = str(child.props, 'columnName', child.id).toUpperCase();
        return {
          name: column,
          heading: str(child.props, 'heading.heading', column),
          searchable: bool(child.props, 'advanced.searchable', true),
        };
      });
  } else if (str(spec, 'type') === 'sqlQuery' || spec.sqlQuery !== undefined) sql = str(spec, 'sqlQuery');
  if (!sql) return fallback();
  const parents = cascading(item);
  if (
    parents.parents &&
    parents.required &&
    strings(get(item.props, 'cascadingLov.parentItems')).some(
      (parent) => (ctx.session.items[parent.toUpperCase()] ?? '') === '',
    )
  )
    return { ...fallback(), rows: [] };
  try {
    const result = renderer.db.query(sql, renderer.binds(ctx.session, ctx.page), 5_000);
    const displayColumn = display?.toUpperCase() ?? result.columns[0]!;
    const returnColumn = returned?.toUpperCase() ?? result.columns[1] ?? displayColumn;
    // Item-level SQL LOVs are display/return pairs; only shared LOVs define extra columns.
    const columns = declared.length
      ? declared
      : [{ name: displayColumn, heading: renderer.label(item), searchable: true }];
    if (!columns.some((column) => column.name === displayColumn))
      columns.unshift({ name: displayColumn, heading: renderer.label(item), searchable: true });
    return {
      columns,
      display: displayColumn,
      returned: returnColumn,
      rows: result.rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, value === null ? '' : String(value)]),
        ),
      ),
    };
  } catch (error) {
    renderer.diagnose('warning', `LOV query failed: ${(error as Error).message}`, ctx.pageId, name);
    return fallback();
  }
}

/** Display text of value(s) through the item's LOV; unknown values display as themselves. */
export function displayFor(entries: LovEntry[], values: string[]): string[] {
  return values.map((value) => entries.find((entry) => entry.r === value)?.d ?? value);
}
