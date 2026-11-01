/**
 * APEXlang property check for the components the preview renders: property paths and enumerated
 * values are compared with the component catalog (resources/components/source/parameters.json,
 * Oracle MMD metadata). The catalog does not describe every group (plug-in settings, most process
 * and dynamic action settings), so only what it covers is checked and anything else is accepted.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isObject, isRef, type ApxComponent, type ApxObject, type ApxValue } from './apexlang.ts';

interface Parameter {
  context: string;
  apexlangPath: string | null;
  nativeType: string | null;
  type: string;
  values: { name: string }[];
}

interface UtAttribute {
  apexlangPath: string;
  apexlangRelativePath: string;
}

interface ContextCatalog {
  /** Paths valid for every component type of the context. */
  generic: Set<string>;
  /** Paths valid only for one native type (item, region or column type). */
  byType: Map<string, Set<string>>;
  /** Top-level groups of the generic paths. */
  genericGroups: Set<string>;
  /** Properties whose value is an object (links, static LOVs, order-by items). */
  structured: Set<string>;
  /** Enumerated values: path -> native type ('' for generic) -> APEXlang names. */
  values: Map<string, Map<string, Set<string>>>;
}

export interface PropertyFinding {
  message: string;
  page?: string;
  component: string;
}

/**
 * Component types that are checked. The catalog covers their groups completely for the 33 Oracle
 * sample applications; processes, dynamic action actions, saved reports and other children carry
 * groups the catalog does not describe, so they are not checked.
 */
const CHECKED = new Set([
  'page',
  'region',
  'pageItem',
  'button',
  'dynamicAction',
  'validation',
  'computation',
  'branch',
  'layer',
  'series',
  'axis',
]);

/** Groups present in valid sample applications that the catalog does not list. */
const EXTRA_GROUPS: Record<string, string[]> = {
  // Report printing attributes and map region attributes.
  region: ['attributes', 'columnHeadings', 'columns', 'page', 'pageHeader'],
};

/** Known catalog gaps found in the valid Oracle sample applications: extra paths and values. */
const EXTRA_PATHS: Record<string, string[]> = {
  region: ['settings.enableExport'],
};
const EXTRA_VALUES: Record<string, string[]> = {
  'region pagination.type': ['showAll'],
};
/** Enumerated properties that also accept a page item name. */
const ITEM_VALUES = new Set(['pageItem geocodingInput.country']);

const TYPED_CONTEXTS = new Set(['region', 'pageItem']);

const STRUCTURED_TYPES = new Set([
  'LINK',
  'LINK_IN_APP',
  'LINK_IN_DIFF_APP',
  'LINK_BRANCH',
  'linkToTargetPageUrl',
  'STATIC LOV',
  'ORDER BY ITEM',
]);
const ENUMERATED_TYPES = new Set(['SELECT LIST', 'PILL BUTTONS', 'CHECKBOXES', 'selectList', 'checkboxes']);

let cached: Map<string, ContextCatalog> | null | undefined;

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

function add(catalog: Map<string, ContextCatalog>, context: string): ContextCatalog {
  let entry = catalog.get(context);
  if (!entry) {
    entry = {
      generic: new Set(),
      byType: new Map(),
      genericGroups: new Set(),
      structured: new Set(),
      values: new Map(),
    };
    catalog.set(context, entry);
  }
  return entry;
}

/** Parses the catalog JSON (exported for tests). */
export function buildCatalog(json: {
  nativeParameters: Parameter[];
  utAttributes?: UtAttribute[];
}): Map<string, ContextCatalog> {
  const catalog = new Map<string, ContextCatalog>();
  const record = (context: string, relative: string, parameter?: Parameter) => {
    const entry = add(catalog, context);
    // Only regions and page items carry their own native type; for children the MMD native type
    // names the parent region type, so their paths are generic.
    const type = TYPED_CONTEXTS.has(context) ? (parameter?.nativeType ?? '') : '';
    // Plug-in attribute groups appear as `plugin-display` in MMD and as `display` in exports.
    const forms = new Set([relative, relative.replace(/(^|\.)plugin-/gu, '$1')]);
    for (const form of forms) {
      if (type) {
        if (!entry.byType.has(type)) entry.byType.set(type, new Set());
        entry.byType.get(type)!.add(form);
      } else {
        entry.generic.add(form);
        entry.genericGroups.add(form.split('.')[0]!);
      }
      if (!parameter) continue;
      if (STRUCTURED_TYPES.has(parameter.type)) entry.structured.add(form);
      if (ENUMERATED_TYPES.has(parameter.type) && parameter.values.length) {
        if (!entry.values.has(form)) entry.values.set(form, new Map());
        const byType = entry.values.get(form)!;
        if (!byType.has(type)) byType.set(type, new Set());
        for (const value of parameter.values) byType.get(type)!.add(value.name);
      }
    }
  };
  for (const parameter of json.nativeParameters) {
    if (!parameter.apexlangPath) continue;
    let relative = parameter.apexlangPath.slice(parameter.context.length + 1);
    let context = parameter.context;
    // Region attributes (`attributes.map.height`) are region groups in APEXlang (`map { height }`).
    if (context === 'attributes') {
      context = 'region';
      relative = relative.replace(/^attributes\./u, '');
    }
    record(context, relative, parameter);
  }
  // Universal Theme template component attributes (`settings.*` of themeTemplateComponent types).
  for (const attribute of json.utAttributes ?? []) {
    const context = attribute.apexlangPath.split('.')[0]!;
    add(catalog, context).generic.add(attribute.apexlangRelativePath);
  }
  return catalog;
}

function loadCatalog(): Map<string, ContextCatalog> | null {
  if (cached !== undefined) return cached;
  const file = catalogFile();
  try {
    cached = file ? buildCatalog(JSON.parse(fs.readFileSync(file, 'utf8'))) : null;
  } catch {
    cached = null;
  }
  return cached;
}

const isSubstitution = (value: string) => /[&#][A-Za-z_][\w$#]*[.#]|^#|^&/u.test(value);

/** Checks one component tree; `page` labels the findings. */
export function checkComponentProperties(
  components: ApxComponent[],
  page?: string,
  catalog: Map<string, ContextCatalog> | null = loadCatalog(),
): PropertyFinding[] {
  if (!catalog) return [];
  const findings: PropertyFinding[] = [];
  const visit = (component: ApxComponent) => {
    const entry = catalog.get(component.type);
    if (entry && CHECKED.has(component.type)) checkComponent(component, entry, page, findings);
    for (const child of component.children) visit(child);
  };
  for (const component of components) visit(component);
  return findings;
}

function checkComponent(
  component: ApxComponent,
  entry: ContextCatalog,
  page: string | undefined,
  findings: PropertyFinding[],
): void {
  const type = typeof component.props.type === 'string' ? component.props.type : '';
  const typed = entry.byType.get(type);
  // Plug-in and template component types (`plugin/x`, `themeTemplateComponent/x`) define their own
  // attribute groups; native types without catalog settings keep their `settings` unchecked.
  const custom = type.includes('/');
  const extra = new Set(EXTRA_GROUPS[component.type] ?? []);
  const typedGroups = new Set([...(typed ?? [])].map((dotted) => dotted.split('.')[0]!));
  const extraPaths = new Set(EXTRA_PATHS[component.type] ?? []);
  const known = (dotted: string) =>
    entry.generic.has(dotted) || Boolean(typed?.has(dotted)) || extraPaths.has(dotted);
  const label = `${component.type} ${component.id}`;
  const report = (message: string) =>
    findings.push({ message: `${label}: ${message}`, ...(page ? { page } : {}), component: component.id });
  const walk = (props: ApxObject, prefix: string) => {
    for (const [key, value] of Object.entries(props)) {
      const dotted = prefix ? `${prefix}.${key}` : key;
      const group = dotted.split('.')[0]!;
      const groupKnown = entry.genericGroups.has(group) || typedGroups.has(group);
      if (extra.has(group)) continue;
      if (custom && !entry.genericGroups.has(group)) continue;
      if (group === 'settings' && (custom || !typed)) continue;
      if (entry.structured.has(dotted)) {
        checkValue(component.type, dotted, value, entry, type, report);
        continue;
      }
      if (!groupKnown) {
        report(`unknown property group "${group}"`);
        continue;
      }
      if (isObject(value) && !known(dotted)) {
        walk(value, dotted);
        continue;
      }
      if (!known(dotted)) {
        report(`unknown property "${dotted}"${type ? ` for type ${type}` : ''}`);
        continue;
      }
      checkValue(component.type, dotted, value, entry, type, report);
    }
  };
  walk(component.props, '');
}

function checkValue(
  context: string,
  dotted: string,
  value: ApxValue,
  entry: ContextCatalog,
  type: string,
  report: (message: string) => void,
): void {
  const allowed = entry.values.get(dotted);
  if (!allowed) return;
  let names = allowed.get(type);
  const generic = allowed.get('');
  if (!names && !generic) {
    // Enumerated only for other native types: accept the union (the property is shared).
    names = new Set([...allowed.values()].flatMap((set) => [...set]));
  }
  const accepted = new Set([
    ...(names ?? []),
    ...(generic ?? []),
    ...(EXTRA_VALUES[`${context} ${dotted}`] ?? []),
  ]);
  const items = ITEM_VALUES.has(`${context} ${dotted}`);
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || isRef(candidate)) continue;
    if (isSubstitution(candidate)) continue;
    // Multi-value selections are exported as `a:b`.
    for (const part of candidate.split(':')) {
      if (part === '' || accepted.has(part) || (items && /^P\d+_\w+$/iu.test(part))) continue;
      report(
        `unknown value "${part}" for ${dotted} (expected ${[...accepted].sort().slice(0, 12).join(', ')}${accepted.size > 12 ? ', …' : ''})`,
      );
      return;
    }
  }
}
