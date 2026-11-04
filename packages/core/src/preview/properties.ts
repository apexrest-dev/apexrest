/**
 * APEXlang property check for the components the preview renders: property paths and enumerated
 * values are compared with the component catalog (resources/components/source/parameters.json,
 * Oracle MMD metadata and SQLcl native plug-in declarations).
 *
 * The MMD describes one component type per identity (`column` of a classic report, of an
 * interactive report, of an interactive grid…) together with the condition under which it applies
 * (`region.type = NATIVE_SQL_REPORT`). Each APEXlang component is matched to the identities whose
 * condition holds for it and its ancestors, so a classic report column is checked against classic
 * report column properties only. Property display conditions are evaluated too: the compiler
 * rejects a property whose condition is false (a legend position on a pyramid chart, a fill color
 * on a heat map layer). Conditions that cannot be decided locally (plug-in features such as the
 * column span of a hidden item, application settings, data types derived from SQL) never produce
 * findings. Groups the catalog does not describe (process groups, dynamic action and plug-in
 * settings) are accepted.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, isObject, isRef, type ApxComponent, type ApxObject, type ApxValue } from './apexlang.ts';

interface CatalogValue {
  name: string;
  returnValue?: string;
}

interface Parameter {
  id: string;
  context: string;
  componentTypeId?: string;
  parentContext?: string;
  parentComponentTypeId?: string;
  componentCondition?: RawCondition | null;
  propertyId?: string;
  apexlangPath: string | null;
  nativeType: string | null;
  type: string;
  required?: boolean;
  defaultValue?: string | null;
  values: CatalogValue[];
  condition?: RawCondition | Record<string, unknown> | null;
}

interface RawCondition {
  operator?: string;
  conditions?: RawCondition[];
  type?: string;
  path?: string;
  propertyId?: string;
  value?: string;
  values?: string[];
  hasToExist?: boolean;
}

/** Normalized condition: `path` is `context.relative` (MMD) or `@relative` (same component). */
interface Condition {
  operator?: 'AND' | 'OR';
  conditions?: Condition[];
  type?: string;
  path?: string;
  values?: string[];
  /** `hasToExist: false`: an absent property leaves the condition undecided. */
  optional?: boolean;
  /** Plug-in `dependingOn`: a hidden referenced attribute counts as null, it does not hide this one. */
  plugin?: boolean;
}

interface Property {
  path: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  values: CatalogValue[];
  condition: Condition | null;
}

interface Variant {
  context: string;
  id: string;
  parentId: string | null;
  parentContext: string | null;
  condition: Condition | null;
  properties: Map<string, Property[]>;
}

export interface PropertyCatalog {
  /** Component identities by APEXlang component type. */
  variants: Map<string, Variant[]>;
  /** Region attribute identities (`attributes` in MMD, region groups in APEXlang). */
  attributes: Variant[];
  /** Native plug-in settings: `region calendar`, `pageItem numberField` -> path -> properties. */
  native: Map<string, Map<string, Property[]>>;
  /** APEXlang region type -> MMD type (`classicReport` -> `NATIVE_SQL_REPORT`). */
  regionTypes: Map<string, string>;
}

export interface PropertyFinding {
  message: string;
  page?: string;
  component: string;
}

export interface PropertyCheckOptions {
  /** `mmdVersion` of the application (`.apex/apexlang.json`); gates values added after 26.1. */
  mmdVersion?: string;
}

/**
 * Component types that are checked, with the MMD parent contexts they are checked under. The
 * catalog covers their groups for the Oracle sample applications; processes, saved reports and
 * their children, column groups, facets and filters carry groups the catalog does not describe
 * (type-specific process groups, saved report views), so they are not checked.
 */
const CHECKED: Record<string, string[]> = {
  page: ['app'],
  region: ['page'],
  pageItem: ['page'],
  button: ['page'],
  dynamicAction: ['page'],
  action: ['dynamicAction'],
  validation: ['page'],
  computation: ['page'],
  branch: ['page'],
  column: ['region', 'attributes'],
  layer: ['attributes'],
  series: ['attributes'],
  axis: ['attributes'],
};

/** Groups present in valid sample applications that the catalog does not list. */
const EXTRA_GROUPS: Record<string, string[]> = {
  // Report printing attributes and map region attributes.
  region: ['attributes', 'columnHeadings', 'columns', 'page', 'pageHeader'],
};

/** Known catalog gaps found in the valid Oracle sample applications: extra paths and values. */
const EXTRA_PATHS: Record<string, { paths: string[]; since?: string }[]> = {
  region: [
    { paths: ['settings.enableExport'] },
    // Lazy loading of chart regions (the 26.1 compiler rejects it).
    { paths: ['performance.lazyLoading'], since: '26.2' },
  ],
};
/**
 * Values accepted beyond the 26.1 catalog. `since` gates values the 26.1 compiler rejects: they
 * are accepted only when the application declares that MMD version or later (or none).
 */
const EXTRA_VALUES: Record<string, { values: string[]; since?: string }> = {
  'region pagination.type': { values: ['showAll'], since: '26.2' },
};
/** Enumerated properties that also accept a page item name. */
const ITEM_VALUES = new Set(['pageItem geocodingInput.country']);

/** MMD region types whose APEXlang name the catalog does not record. */
const REGION_TYPES: Record<string, string> = {
  interactiveReport: 'NATIVE_IR',
  classicReport: 'NATIVE_SQL_REPORT',
};
/** MMD region types without an APEXlang region type (legacy tabular forms): no region matches them. */
const UNNAMED_REGION_TYPES = ['NATIVE_TABFORM'];

const STRUCTURED_TYPES = new Set([
  'LINK',
  'LINK_IN_APP',
  'LINK_IN_DIFF_APP',
  'LINK_BRANCH',
  'linkToTargetPageUrl',
  'STATIC LOV',
  'ORDER BY ITEM',
]);
const LINK_TYPES = new Set(['LINK', 'LINK_IN_APP', 'LINK_IN_DIFF_APP', 'LINK_BRANCH', 'linkToTargetPageUrl']);
const ENUMERATED_TYPES = new Set(['SELECT LIST', 'PILL BUTTONS', 'CHECKBOXES', 'selectList', 'checkboxes']);
/** The component identifier is the static ID in APEXlang; the compiler rejects the property. */
const IDENTIFIER_TYPES = new Set(['STATIC ID']);

const NULL = '$NULL$';
/** Template component types (`TMPL_*` in MMD). */
const TEMPLATE_COMPONENT = /^(?:themeTemplateComponent|appTemplateComponent|templateComponent)\//u;
/** Component types whose groups depend on their type (dynamic action types): unknown groups pass. */
const OPEN_GROUPS = new Set(['action']);

let cached: PropertyCatalog | null | undefined;

function catalogFile(): string | undefined {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.APEXREST_RESOURCES,
    path.resolve(here, '../resources'),
    path.resolve(here, '../../../../resources'),
  ].filter((entry): entry is string => Boolean(entry));
  for (const root of candidates) {
    const file = path.join(root, 'components', 'source', 'parameters.json');
    if (fs.existsSync(file)) return file;
  }
  return undefined;
}

function normalize(condition: RawCondition | null | undefined): Condition | null {
  if (!condition) return null;
  if (condition.conditions) {
    const children = condition.conditions
      .map(normalize)
      .filter((entry): entry is Condition => Boolean(entry));
    return children.length
      ? { operator: condition.operator === 'OR' ? 'OR' : 'AND', conditions: children }
      : null;
  }
  if (!condition.type) return null;
  return {
    type: condition.type,
    ...(condition.path ? { path: condition.path } : {}),
    values: condition.values ?? (condition.value === undefined ? [] : [condition.value]),
    ...(condition.hasToExist === false ? { optional: true } : {}),
  };
}

/** SQLcl native declarations: `dependingOn.attribute: @show_time/component` -> same component. */
function nativeCondition(
  condition: Record<string, unknown> | null | undefined,
  prefix: string,
  paths: Map<string, string>,
): Condition | null {
  const attribute = condition?.['dependingOn.attribute'];
  if (typeof attribute !== 'string') return null;
  // `@show_time/component` names the attribute and its scope; ids are `…/component/show_time`.
  const [name, scope] = attribute.replace(/^@/u, '').split('/');
  const target = paths.get(`${prefix}${scope}/${name}`);
  if (!target) return null;
  const operator = String(condition?.['dependingOn.conditionType'] ?? '');
  const raw = condition?.['dependingOn.value'] ?? condition?.['dependingOn.list'];
  const values = Array.isArray(raw) ? raw.map(String) : raw === undefined ? [] : String(raw).split(',');
  const type =
    { '=': 'EQUALS', '!=': 'NOT_EQUALS', isNotNull: 'NOT_NULL', isNull: 'NULL', inList: 'IN_LIST' }[
      operator
    ] ?? '';
  if (!type || (['EQUALS', 'NOT_EQUALS', 'IN_LIST'].includes(type) && !values.length)) return null;
  return { type, path: `@${target}`, values, plugin: true };
}

const plain = (relative: string) => relative.replace(/(^|\.)plugin-/gu, '$1');

function property(parameter: Parameter, relative: string, condition: Condition | null): Property {
  return {
    path: relative,
    type: parameter.type,
    required: Boolean(parameter.required),
    defaultValue: parameter.defaultValue ?? null,
    values: parameter.values ?? [],
    condition,
  };
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  if (!map.has(key)) map.set(key, []);
  map.get(key)!.push(value);
}

/** Parses the catalog JSON (exported for tests). */
export function buildCatalog(json: { nativeParameters: Parameter[] }): PropertyCatalog {
  const variants = new Map<string, Variant[]>();
  const byId = new Map<string, Variant>();
  const native = new Map<string, Map<string, Property[]>>();
  const regionTypes = new Map(Object.entries(REGION_TYPES));
  // `native:region/calendar/component/show_time` -> settings path, for native conditions.
  const nativePaths = new Map<string, string>();
  for (const parameter of json.nativeParameters)
    if (parameter.id.startsWith('native:') && parameter.apexlangPath)
      nativePaths.set(
        parameter.id.replace(/^native:/u, ''),
        plain(parameter.apexlangPath.slice(parameter.context.length + 1)),
      );
  for (const parameter of json.nativeParameters) {
    if (!parameter.apexlangPath) continue;
    const relative = plain(parameter.apexlangPath.slice(parameter.context.length + 1));
    if (parameter.id.startsWith('native:')) {
      // Component-scope native plug-in settings of one region or item type.
      if (!['region', 'pageItem'].includes(parameter.context) || !parameter.nativeType) continue;
      const kind = parameter.id.split('/')[0]!.replace(/^native:/u, '');
      const prefix = `${parameter.id
        .split('/')
        .slice(0, 2)
        .join('/')
        .replace(/^native:/u, '')}/`;
      const key = `${kind === 'item' ? 'pageItem' : 'region'} ${parameter.nativeType}`;
      if (!native.has(key)) native.set(key, new Map());
      const condition = nativeCondition(parameter.condition as Record<string, unknown>, prefix, nativePaths);
      push(native.get(key)!, relative, property(parameter, relative, condition));
      continue;
    }
    if (!parameter.componentTypeId) continue;
    let variant = byId.get(parameter.componentTypeId);
    if (!variant) {
      variant = {
        context: parameter.context,
        id: parameter.componentTypeId,
        parentId: parameter.parentComponentTypeId ?? null,
        parentContext: parameter.parentContext ?? null,
        condition: normalize(parameter.componentCondition),
        properties: new Map(),
      };
      byId.set(variant.id, variant);
      push(variants, variant.context, variant);
    }
    push(
      variant.properties,
      relative,
      property(parameter, relative, normalize(parameter.condition as RawCondition)),
    );
    // Region types the catalog names: `region.type = NATIVE_IG` identities carry `interactiveGrid`.
    const leaf = variant.condition?.conditions?.length === 1 ? variant.condition.conditions[0] : undefined;
    if (leaf?.path === 'region.type' && leaf.type === 'EQUALS' && parameter.nativeType)
      regionTypes.set(parameter.nativeType, leaf.values![0]!);
  }
  return {
    variants,
    attributes: (variants.get('attributes') ?? []).filter(
      (variant) => byId.get(variant.parentId ?? '')?.context === 'region',
    ),
    native,
    regionTypes,
  };
}

function loadCatalog(): PropertyCatalog | null {
  if (cached !== undefined) return cached;
  const file = catalogFile();
  try {
    cached = file ? buildCatalog(JSON.parse(fs.readFileSync(file, 'utf8'))) : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Reads `mmdVersion` from `<sourceDir>/.apex/apexlang.json`. */
export function applicationMmdVersion(sourceDir: string): string | undefined {
  try {
    const json = JSON.parse(fs.readFileSync(path.join(sourceDir, '.apex', 'apexlang.json'), 'utf8')) as {
      mmdVersion?: unknown;
    };
    return typeof json.mmdVersion === 'string' ? json.mmdVersion : undefined;
  } catch {
    return undefined;
  }
}

function atLeast(version: string | undefined, since: string): boolean {
  if (!version) return true;
  const parts = (text: string) => text.split(/[.+]/u).map((part) => Number(part) || 0);
  const [a, b] = [parts(version), parts(since)];
  for (let index = 0; index < b.length; index++) {
    if ((a[index] ?? 0) !== b[index]) return (a[index] ?? 0) > b[index]!;
  }
  return true;
}

const isSubstitution = (value: string) => /[&#][A-Za-z_][\w$#]*[.#]|^#|^&/u.test(value);

/** A component in the tree with the catalog identities that apply to it. */
interface Scope {
  component: ApxComponent;
  variants: Variant[];
  parent: Scope | undefined;
}

type Tri = boolean | null;

/**
 * A component has one MMD identity: identities whose condition is false are dropped, and when one
 * condition certainly holds, the undecided ones (plug-in features) are dropped too.
 */
function exclusive(variants: Variant[], scope: Scope, checker: Checker): Variant[] {
  const results = variants.map((variant) => ({ variant, holds: checker.holds(variant.condition, scope) }));
  const certain = results.filter((entry) => entry.holds === true);
  return (certain.length ? certain : results.filter((entry) => entry.holds !== false)).map(
    (entry) => entry.variant,
  );
}

const and = (values: Tri[]): Tri => (values.includes(false) ? false : values.includes(null) ? null : true);
const or = (values: Tri[]): Tri =>
  values.includes(true) ? true : values.every((value) => value === false) ? false : null;

class Checker {
  readonly findings: PropertyFinding[] = [];
  readonly catalog: PropertyCatalog;
  readonly page: string | undefined;
  readonly options: PropertyCheckOptions;

  constructor(catalog: PropertyCatalog, page: string | undefined, options: PropertyCheckOptions) {
    this.catalog = catalog;
    this.page = page;
    this.options = options;
  }

  visit(component: ApxComponent, parent: Scope | undefined): void {
    const scope: Scope = { component, variants: [], parent };
    scope.variants = this.identify(scope);
    const checked = CHECKED[component.type];
    if (scope.variants.some((variant) => checked?.includes(variant.parentContext ?? ''))) this.check(scope);
    else if (scope.variants.length) this.checkRules(scope, this.reporter(component));
    for (const child of component.children) this.visit(child, scope);
  }

  /** Catalog identities whose parent and condition fit the component. */
  identify(scope: Scope): Variant[] {
    const { component, parent } = scope;
    const candidates = this.catalog.variants.get(component.type) ?? [];
    const parents = new Set(parent?.variants.map((variant) => variant.id) ?? []);
    const matching = exclusive(
      candidates.filter((variant) => (parent ? parents.has(variant.parentId ?? '') : true)),
      scope,
      this,
    );
    if (component.type !== 'region' || !matching.length) return matching;
    return [...matching, ...exclusive(this.catalog.attributes, scope, this)];
  }

  /** Three-valued condition: null when it depends on something the preview cannot decide. */
  holds(condition: Condition | null, scope: Scope, depth = 0): Tri {
    if (!condition) return true;
    if (condition.conditions) {
      const values = condition.conditions.map((child) => this.holds(child, scope, depth));
      return condition.operator === 'OR' ? or(values) : and(values);
    }
    if (!condition.path) return null;
    const target = this.target(condition.path, scope);
    if (!target) return null;
    const values = condition.values ?? [];
    if (condition.optional && get(target.scope.component.props, target.path) === undefined) return null;
    // The referenced property has to exist: when its own condition fails, this one fails too.
    if (!condition.optional && !condition.plugin && depth < 4) {
      const referenced = this.properties(target.scope, target.path);
      if (
        referenced.length &&
        referenced.every((entry) => this.holds(entry.condition, target.scope, depth + 1) === false)
      )
        return false;
    }
    const actual = this.actual(target.scope, target.path);
    if (actual === null) return null;
    const upper = values.map((value) => value.toUpperCase());
    const test = (raw: string): Tri => {
      // Unlisted codes are compared without case (`date` and `DATE`).
      const candidate = upper.includes(raw.toUpperCase()) ? values[upper.indexOf(raw.toUpperCase())]! : raw;
      switch (condition.type) {
        case 'EQUALS':
        case 'IN_LIST':
          return values.includes(candidate);
        case 'NOT_EQUALS':
        case 'NOT_IN_LIST':
          return !values.includes(candidate);
        case 'NULL':
          return candidate === NULL;
        case 'NOT_NULL':
          return candidate !== NULL;
        case 'STARTS_WITH':
        case 'STARTS_WITH_ANY':
          return values.some((value) => candidate.startsWith(value));
        case 'NOT_STARTS_WITH_ANY':
          return !values.some((value) => candidate.startsWith(value));
        default:
          return null;
      }
    };
    if (actual.kind === 'region' || actual.kind === 'item')
      return actual.kind === 'region'
        ? this.regionTest(condition, actual.type)
        : this.itemTest(condition, actual.type);
    if (actual.kind === 'boolean') {
      // Y/N for most switches, on/off for a few chart attributes.
      const onOff = values.some((value) => value === 'on' || value === 'off');
      return test(actual.value ? (onOff ? 'on' : 'Y') : onOff ? 'off' : 'N');
    }
    // Several candidates (a default, or a multi-value selection): true if any satisfies it.
    return or(actual.values.map(test));
  }

  regionTest(condition: Condition, type: string): Tri {
    const values = condition.values ?? [];
    const raw = this.catalog.regionTypes.get(type);
    const custom = TEMPLATE_COMPONENT.test(type)
      ? 'TMPL_'
      : type.startsWith('plugin/')
        ? 'PLUGIN_'
        : undefined;
    const known = new Set([...this.catalog.regionTypes.values(), ...UNNAMED_REGION_TYPES]);
    const equals = (value: string): Tri =>
      raw
        ? raw === value
        : custom
          ? value.startsWith(custom)
            ? null
            : false
          : known.has(value)
            ? false
            : null;
    switch (condition.type) {
      case 'EQUALS':
      case 'IN_LIST':
        return or(values.map(equals));
      case 'NOT_EQUALS':
      case 'NOT_IN_LIST': {
        const result = or(values.map(equals));
        return result === null ? null : !result;
      }
      case 'STARTS_WITH':
        if (raw) return values.some((value) => raw.startsWith(value));
        if (custom)
          return values.some((value) => custom.startsWith(value))
            ? true
            : values.some((value) => value.startsWith(custom))
              ? null
              : false;
        return values.every((value) => value.startsWith('TMPL_') || value.startsWith('PLUGIN_'))
          ? false
          : null;
      default:
        return null;
    }
  }

  /** Item and column types are `SUPPORTED UI` without a value list: only exact name matches count. */
  itemTest(condition: Condition, type: string): Tri {
    const values = condition.values ?? [];
    const same = (value: string) =>
      value
        .replace(/^NATIVE_/u, '')
        .replace(/_/gu, '')
        .toLowerCase() === type.toLowerCase();
    const custom = type.includes('/');
    switch (condition.type) {
      case 'EQUALS':
      case 'IN_LIST':
        return values.some(same)
          ? true
          : custom && values.every((value) => value.startsWith('NATIVE_'))
            ? false
            : null;
      case 'NOT_EQUALS':
      case 'NOT_IN_LIST':
        return values.some(same)
          ? false
          : custom && values.every((value) => value.startsWith('NATIVE_'))
            ? true
            : null;
      case 'STARTS_WITH':
        return TEMPLATE_COMPONENT.test(type)
          ? values.some((value) => value === 'TMPL_') || null
          : values.every((value) => value === 'TMPL_')
            ? false
            : null;
      default:
        return null;
    }
  }

  /** Resolves `region.type`, `attributes.chart.type` or `@settings.showTime` to a component. */
  target(dotted: string, scope: Scope): { scope: Scope; path: string } | undefined {
    if (dotted.startsWith('@')) return { scope, path: dotted.slice(1) };
    const [context, ...rest] = dotted.split('.');
    const relative = rest.join('.');
    if (!context || !relative) return undefined;
    for (let current: Scope | undefined = scope; current; current = current.parent) {
      const type = current.component.type;
      if (type === context || (context === 'attributes' && type === 'region'))
        return { scope: current, path: relative };
    }
    return undefined;
  }

  /** The MMD value(s) of a property: return values, Y/N for booleans, defaults when absent. */
  actual(
    scope: Scope,
    dotted: string,
  ):
    | { kind: 'values'; values: string[] }
    | { kind: 'region'; type: string }
    | { kind: 'item'; type: string }
    | { kind: 'boolean'; value: boolean }
    | null {
    const value = get(scope.component.props, dotted);
    const properties = this.properties(scope, dotted);
    if (dotted === 'type' && typeof value === 'string') {
      if (scope.component.type === 'region') return { kind: 'region', type: value };
      if (!properties.some((entry) => entry.values.length)) return { kind: 'item', type: value };
    }
    if (value === undefined) {
      // A required property without a default is derived by the compiler (a column data type).
      if (!properties.length || properties.some((entry) => entry.required && entry.defaultValue === null))
        return null;
      // Plug-in switches default to unchecked and store `true`/`false` defaults.
      const flag = (entry: Property) =>
        entry.type === 'yesNo'
          ? ({ true: 'Y', false: 'N' }[entry.defaultValue ?? ''] ?? entry.defaultValue)
          : entry.defaultValue;
      const defaults = properties.map(flag).filter((entry): entry is string => entry !== null);
      if (!defaults.length && properties.some((entry) => entry.type === 'yesNo'))
        return { kind: 'values', values: [NULL, 'N'] };
      return { kind: 'values', values: defaults.length ? defaults : [NULL] };
    }
    if (isRef(value)) return { kind: 'values', values: [`@${value.ref}`] };
    if (typeof value === 'boolean') return { kind: 'boolean', value };
    if (isObject(value)) return null;
    const parts = (Array.isArray(value) ? value : [value]).flatMap((entry) =>
      typeof entry === 'string' ? entry.split(':') : [],
    );
    if (!parts.length) return { kind: 'values', values: [NULL] };
    const named = new Map<string, string>();
    for (const entry of properties)
      for (const option of entry.values)
        if (option.returnValue !== undefined) named.set(option.name, option.returnValue);
    if (parts.some(isSubstitution)) return null;
    // Values of a list the catalog does not enumerate (template slots) cannot be compared.
    const listed = properties.some(
      (entry) => (ENUMERATED_TYPES.has(entry.type) && !entry.values.length) || entry.type === 'SUPPORTED UI',
    );
    if (parts.some((part) => !named.has(part)) && (listed || !properties.length)) return null;
    return { kind: 'values', values: parts.map((part) => named.get(part) ?? part) };
  }

  /** Catalog properties of one path for the component (its identities and native settings). */
  properties(scope: Scope, dotted: string): Property[] {
    const found: Property[] = [];
    for (const variant of scope.variants) found.push(...(variant.properties.get(dotted) ?? []));
    found.push(...(this.typed(scope)?.get(dotted) ?? []));
    return found;
  }

  /** Native plug-in settings for the component type (interactive grid columns use item types). */
  typed(scope: Scope): Map<string, Property[]> | undefined {
    const { component } = scope;
    const type = typeof component.props.type === 'string' ? component.props.type : '';
    if (!type || type.includes('/')) return undefined;
    if (component.type === 'region' || component.type === 'pageItem')
      return this.catalog.native.get(`${component.type} ${type}`);
    if (component.type === 'column' && scope.parent?.component.type === 'region') {
      const grid = scope.variants.some((variant) =>
        variant.condition?.conditions?.some(
          (leaf) => leaf.path === 'region.type' && leaf.values?.includes('NATIVE_IG'),
        ),
      );
      if (grid) return this.catalog.native.get(`pageItem ${type}`);
    }
    return undefined;
  }

  check(scope: Scope): void {
    const { component } = scope;
    const type = typeof component.props.type === 'string' ? component.props.type : '';
    const typed = this.typed(scope);
    // Plug-in and template component types define their own attribute groups; native types
    // without catalog settings keep their `settings` unchecked.
    const custom = type.includes('/');
    const paths = new Map<string, Property[]>();
    for (const variant of scope.variants)
      for (const [dotted, entries] of variant.properties)
        for (const entry of entries) push(paths, dotted, entry);
    const groups = new Set([...paths.keys()].map((dotted) => dotted.split('.')[0]!));
    for (const [dotted, entries] of typed ?? []) for (const entry of entries) push(paths, dotted, entry);
    const typedGroups = new Set([...(typed?.keys() ?? [])].map((dotted) => dotted.split('.')[0]!));
    const extra = new Set(EXTRA_GROUPS[component.type] ?? []);
    const extraPaths = new Set(
      (EXTRA_PATHS[component.type] ?? [])
        .filter((entry) => !entry.since || atLeast(this.options.mmdVersion, entry.since))
        .flatMap((entry) => entry.paths),
    );
    for (const dotted of extraPaths) if (!paths.has(dotted)) typedGroups.add(dotted.split('.')[0]!);
    const report = this.reporter(component);

    // The component type itself: a rejected type also invalidates the settings it would define.
    const typeRejected = type ? this.checkValue(scope, 'type', type, paths.get('type') ?? [], report) : false;

    const walk = (props: ApxObject, prefix: string) => {
      for (const [key, value] of Object.entries(props)) {
        const dotted = prefix ? `${prefix}.${key}` : key;
        if (dotted === 'type') continue;
        const group = dotted.split('.')[0]!;
        if (extra.has(group)) continue;
        if (group === 'settings' && typeRejected) {
          if (isObject(value)) {
            walk(value, dotted);
          } else report(`unknown property "${dotted}" (type ${type} is not valid here)`);
          continue;
        }
        if (custom && !groups.has(group)) continue;
        if (group === 'settings' && (custom || !typed)) continue;
        const entries = (paths.get(dotted) ?? []).filter((entry) => !IDENTIFIER_TYPES.has(entry.type));
        if (entries.some((entry) => STRUCTURED_TYPES.has(entry.type))) {
          this.checkStructured(dotted, value, entries, report);
          continue;
        }
        if (!groups.has(group) && !typedGroups.has(group)) {
          if (OPEN_GROUPS.has(component.type)) continue;
          report(`unknown property group "${group}"`);
          continue;
        }
        if (isObject(value) && !entries.length) {
          walk(value, dotted);
          continue;
        }
        if (!entries.length) {
          if (extraPaths.has(dotted)) continue;
          const identifier = (paths.get(dotted) ?? []).some((entry) => IDENTIFIER_TYPES.has(entry.type));
          report(
            identifier
              ? `unknown property "${dotted}" (the component identifier is its static ID)`
              : `unknown property "${dotted}"${type ? ` for type ${type}` : ''}`,
          );
          continue;
        }
        // Display conditions: the compiler rejects a property whose condition is false.
        if (entries.every((entry) => this.holds(entry.condition, scope) === false)) {
          report(`property "${dotted}" does not apply here (its display condition is not met)`);
          continue;
        }
        this.checkValue(scope, dotted, value, entries, report);
      }
    };
    walk(component.props, '');
    this.checkRules(scope, report);
  }

  reporter(component: ApxComponent): (message: string) => void {
    const label = `${component.type} ${component.id}`;
    return (message: string) =>
      this.findings.push({
        message: `${label}: ${message}`,
        ...(this.page ? { page: this.page } : {}),
        component: component.id,
      });
  }

  /** Required properties and identifier formats, also for component types that are not checked. */
  checkRules(scope: Scope, report: (message: string) => void): void {
    this.checkRequired(scope, report);
    for (const variant of scope.variants)
      for (const [dotted, format] of Object.entries(
        FORMATS[`${variant.parentContext} ${variant.context}`] ?? {},
      )) {
        const value = get(scope.component.props, dotted);
        if (typeof value === 'string' && !format.pattern.test(value))
          report(`invalid value "${value}" for ${dotted} (expected ${format.expected})`);
      }
  }

  /** Link targets: a URL needs `type: url`. */
  checkStructured(
    dotted: string,
    value: ApxValue,
    entries: Property[],
    report: (message: string) => void,
  ): void {
    if (!entries.some((entry) => LINK_TYPES.has(entry.type)) || !isObject(value)) return;
    if ('url' in value && value.type !== 'url')
      report(`property "${dotted}" has "url" without "type: url" (the compiler does not recognize it)`);
  }

  /** Reports a value outside the enumeration; returns true when it did. */
  checkValue(
    scope: Scope,
    dotted: string,
    value: ApxValue,
    entries: Property[],
    report: (message: string) => void,
  ): boolean {
    const applicable = entries.filter((entry) => this.holds(entry.condition, scope) !== false);
    const candidates = applicable.length ? applicable : entries;
    if (
      !candidates.length ||
      candidates.some((entry) => !ENUMERATED_TYPES.has(entry.type) || !entry.values.length)
    )
      return false;
    const context = scope.component.type;
    const extra = EXTRA_VALUES[`${context} ${dotted}`];
    const accepted = new Set([
      ...candidates.flatMap((entry) => entry.values.map((option) => option.name)),
      ...(extra && (!extra.since || atLeast(this.options.mmdVersion, extra.since)) ? extra.values : []),
    ]);
    const items = ITEM_VALUES.has(`${context} ${dotted}`);
    for (const candidate of Array.isArray(value) ? value : [value]) {
      if (typeof candidate !== 'string' || isRef(candidate)) continue;
      if (isSubstitution(candidate)) continue;
      // Multi-value selections are exported as `a:b`; template component types contain `/`.
      for (const part of dotted === 'type' ? [candidate] : candidate.split(':')) {
        if (part === '' || accepted.has(part) || (items && /^P\d+_\w+$/iu.test(part))) continue;
        report(
          `unknown value "${part}" for ${dotted} (expected ${[...accepted].sort().slice(0, 12).join(', ')}${accepted.size > 12 ? ', …' : ''})`,
        );
        return true;
      }
    }
    return false;
  }

  /** Required properties whose identity and display condition certainly apply. */
  checkRequired(scope: Scope, report: (message: string) => void): void {
    for (const variant of scope.variants) {
      if (this.holds(variant.condition, scope) !== true) continue;
      for (const [dotted, entries] of variant.properties) {
        if (!REQUIRED_CHECKED.has(`${scope.component.type} ${dotted}`)) continue;
        if (get(scope.component.props, dotted) !== undefined) continue;
        if (
          entries.some(
            (entry) =>
              entry.required && entry.defaultValue === null && this.holds(entry.condition, scope) === true,
          )
        )
          report(`missing required property "${dotted}"`);
      }
    }
  }
}

/**
 * Required properties that are checked. Many required MMD properties are derived in APEXlang (the
 * identifier, names, defaults applied by the compiler), so only the ones verified against the
 * compiler and the Oracle sample applications are reported.
 */
const REQUIRED_CHECKED = new Set([
  'pageItem layout.slot',
  'column layout.sequence',
  'savedReport settings.appUser',
]);

/**
 * Identifier formats the compiler enforces but the catalog does not describe: interactive report
 * computations are named `C01`, `C02`… (`parentContext context` -> path -> pattern).
 */
const FORMATS: Record<string, Record<string, { pattern: RegExp; expected: string }>> = {
  'savedReport computation': {
    identifier: { pattern: /^C\d{2}$/u, expected: '"C" followed by two digits, such as C01' },
  },
};

/** Checks one component tree; `page` labels the findings. */
export function checkComponentProperties(
  components: ApxComponent[],
  page?: string,
  catalog: PropertyCatalog | null = loadCatalog(),
  options: PropertyCheckOptions = {},
): PropertyFinding[] {
  if (!catalog) return [];
  const checker = new Checker(catalog, page, options);
  for (const component of components) checker.visit(component, undefined);
  return checker.findings;
}

/**
 * Shared component files of Oracle APEXlang exports: flat files (`lists.apx`) and one folder per
 * component type (`rest-data-sources/<id>.apx`). The compiler reads only these names, so a
 * component kept in `lists-b.apx` is never compiled and references to it fail to resolve.
 */
const SHARED_FILES = [
  'acl-roles',
  'app-computations',
  'app-items',
  'app-processes',
  'authentications',
  'authorizations',
  'breadcrumbs',
  'build-options',
  'classic-navigation-bar-entries',
  'component-settings',
  'concatenated-files',
  'dynamic-translations',
  'lists',
  'lovs',
  'map-backgrounds',
  'messages',
  'search-configs',
  'shortcuts',
  'static-files',
];
const SHARED_FOLDERS = [
  'ai-agents',
  'automations',
  'data-load-definitions',
  'duality-view-sources',
  'email-templates',
  'json-collection-sources',
  'plugins',
  'report-layouts',
  'rest-data-sources',
  'task-definitions',
  'workflows',
];

/** Shared component files the APEXlang compiler does not read (`shared-components/lists-b.apx`). */
export function checkSharedComponentFiles(root: string, files: string[]): string[] {
  const findings: string[] = [];
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const match = /^shared-components\/(.+)-[^/-]+\.apx$/u.exec(relative);
    if (!match || match[1]!.includes('/')) continue;
    if (SHARED_FILES.includes(relative.slice('shared-components/'.length, -'.apx'.length))) continue;
    const base = match[1]!;
    const target = SHARED_FILES.includes(base)
      ? `shared-components/${base}.apx`
      : SHARED_FOLDERS.includes(base)
        ? `shared-components/${base}/<component>.apx`
        : undefined;
    if (target)
      findings.push(
        `${relative}: the APEXlang compiler does not read this file, so references to its components do not resolve; move them to ${target}`,
      );
  }
  return findings;
}
