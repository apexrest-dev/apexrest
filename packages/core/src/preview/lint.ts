import {
  get,
  isObject,
  isRef,
  ref,
  str,
  type ApxApplication,
  type ApxComponent,
  type ApxObject,
  type ApxValue,
} from './apexlang.ts';

/**
 * Offline source checks for faults the APEXlang compiler accepts and the local rendering hides:
 * region slots that do not exist, references to page items nobody defines, duplicate DOM ids, and
 * the accessibility rules Oracle APEX Advisor enforces. Everything here is read from the sources;
 * nothing is rendered and no database is used. A finding is reported only when the sources settle
 * it, so a clean result does not prove that APEX resolves every reference.
 */
export interface LintFinding {
  code: string;
  level: 'warning' | 'info';
  page: string;
  component: string;
  file: string;
  line: number;
  message: string;
}

/** Slots a region offers to its buttons, items and sub-regions; undefined when the template is unknown. */
export interface RegionSlots {
  template: string;
  slots: string[];
}

export interface LintOptions {
  /** Template slots of a region (from the installed theme). Without it slots are not checked. */
  regionSlots?: (region: ApxComponent) => RegionSlots | undefined;
}

// ---------------------------------------------------------------- slots

/**
 * Slots a region offers whatever its template: the body (default) positions. The template and the
 * region type add theirs.
 */
const BODY_SLOTS = ['regionBody', 'body', 'contentBody', 'subRegions'];

/** Slots the region type itself provides, on top of its template's. */
const TYPE_SLOTS: Record<string, string[]> = {
  interactiveReport: ['rightOfInteractiveReportSearchBar'],
};

/**
 * Template-independent button positions (above, below, top and bottom of the region). The catalog
 * lists their stored values (`button.layout.horizontalAlignment` applies to TOP, TOP_AND_BOTTOM,
 * ABOVE_BOX, BELOW_BOX and BOTTOM); the APEXlang names seen in Oracle's applications are these.
 */
const LEGACY_BUTTON_SLOTS = ['top', 'bottom', 'belowBox'];
const LEGACY_BUTTON_POSITIONS = new Set(['top', 'topandbottom', 'abovebox', 'belowbox', 'bottom']);

function slotFindings(page: ApxComponent, global: ApxComponent | undefined, options: LintOptions) {
  const findings: LintFinding[] = [];
  const regionSlots = options.regionSlots;
  if (!regionSlots) return findings;
  const components = [...page.children, ...(global && global !== page ? global.children : [])];
  const regions = new Map<string, ApxComponent>();
  for (const component of components) if (component.type === 'region') regions.set(component.id, component);
  for (const component of page.children) {
    const kind =
      component.type === 'button'
        ? 'Button'
        : component.type === 'pageItem'
          ? 'Item'
          : component.type === 'region'
            ? 'Sub-region'
            : undefined;
    if (!kind) continue;
    const parentId = ref(
      component.props,
      component.type === 'region' ? 'layout.parentRegion' : 'layout.region',
    );
    const slot = str(component.props, 'layout.slot');
    if (!parentId || !slot || /[&#]/u.test(slot)) continue;
    const parent = regions.get(parentId);
    if (!parent) continue;
    const type = str(parent.props, 'type');
    // Plug-in and template component regions define their own slots; the theme index has no record.
    if (!type || type.includes('/')) continue;
    const template = regionSlots(parent);
    if (!template) continue;
    const valid = [
      ...new Set([
        ...BODY_SLOTS,
        ...template.slots,
        ...(TYPE_SLOTS[type] ?? []),
        ...(component.type === 'button' ? LEGACY_BUTTON_SLOTS : []),
      ]),
    ];
    const lower = slot.toLowerCase();
    if (valid.some((entry) => entry.toLowerCase() === lower)) continue;
    if (component.type === 'button' && LEGACY_BUTTON_POSITIONS.has(lower.replace(/[^a-z]/gu, ''))) continue;
    const elsewhere = Object.entries(TYPE_SLOTS).find(([, slots]) =>
      slots.some((entry) => entry.toLowerCase() === lower),
    );
    findings.push({
      code: 'SLOT-001',
      level: 'warning',
      page: page.id,
      component: component.id,
      file: component.file,
      line: component.line,
      message: `${kind} ${component.id} uses slot "${slot}", which region ${parent.id} (type ${type}, template ${template.template}) does not provide${
        elsewhere ? ` (only ${elsewhere[0]} regions have it)` : ''
      }; APEX compiles and imports it but does not show the component. Valid slots: ${valid.join(', ')}`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------- item references

const ITEM_NAME = /^P(\d+)_[A-Z0-9_$#]+$/iu;
const BIND = /(?<![\w$#:]):(P\d+_[A-Za-z0-9_$#]+)/gu;
const SUBSTITUTION = /&(P\d+_[A-Za-z0-9_$#]+)(?:![A-Z]+)?\./gu;
const SESSION_STATE = /\bn?v\s*\(\s*'(P\d+_[A-Za-z0-9_$#]+)'\s*\)/giu;
/** Property names whose text APEX parses as SQL, PL/SQL or an expression (bind variables). */
const CODE_KEY = /sql|plsql|code|expression|query|functionBody|whereClause|orderByClause/iu;

/** HTML, CSS and JavaScript sources: a colon there is not a bind variable. */
const MARKUP_KEY = /html|css|javascript|^js|Js[A-Z]/iu;

function stripSqlComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/--[^\n]*/gu, ' ');
}

function walk(component: ApxComponent, visit: (component: ApxComponent) => void): void {
  visit(component);
  for (const child of component.children) walk(child, visit);
}

/** Names every page item, facet, filter and application item of the sources answers to. */
function definedItems(app: ApxApplication): Set<string> {
  const names = new Set<string>();
  for (const page of app.pages.values())
    walk(page, (component) => {
      if (component.type === 'pageItem' || ITEM_NAME.test(component.id))
        names.add(component.id.toUpperCase());
    });
  for (const component of app.shared)
    walk(component, (entry) => {
      if (entry.type === 'appItem' || ITEM_NAME.test(entry.id)) names.add(entry.id.toUpperCase());
    });
  return names;
}

interface ItemReference {
  name: string;
  /** Dotted property the reference sits in. */
  property: string;
  how: 'property' | 'bind' | 'substitution';
}

function references(props: ApxObject): ItemReference[] {
  const found: ItemReference[] = [];
  const names = (value: ApxValue | undefined): string[] => {
    if (typeof value === 'string') return value.split(/[\s,:]+/u).filter((token) => ITEM_NAME.test(token));
    if (isRef(value)) return ITEM_NAME.test(value.ref) ? [value.ref] : [];
    if (Array.isArray(value)) return value.flatMap(names);
    return [];
  };
  const visit = (value: ApxValue, key: string, path: string) => {
    if (typeof value === 'string') {
      // Help and comments describe items in prose; APEX does not resolve them.
      if (/help|comment/iu.test(path)) return;
      if (/item/iu.test(key))
        for (const name of names(value)) found.push({ name, property: path, how: 'property' });
      for (const match of value.matchAll(SUBSTITUTION))
        found.push({ name: match[1]!, property: path, how: 'substitution' });
      if (CODE_KEY.test(key) && !MARKUP_KEY.test(key)) {
        const code = stripSqlComments(value);
        for (const match of code.matchAll(BIND)) found.push({ name: match[1]!, property: path, how: 'bind' });
        for (const match of code.matchAll(SESSION_STATE))
          found.push({ name: match[1]!, property: path, how: 'bind' });
      }
      return;
    }
    if (isRef(value)) {
      if (/item/iu.test(key))
        for (const name of names(value)) found.push({ name, property: path, how: 'property' });
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, key, path);
      return;
    }
    if (isObject(value)) {
      for (const [name, entry] of Object.entries(value)) {
        // `link.target.items { P2_ID: … }`: the names are the items the link sets.
        if (key === 'items' && ITEM_NAME.test(name))
          found.push({ name, property: `${path}.${name}`, how: 'property' });
        visit(entry, name, path ? `${path}.${name}` : name);
      }
    }
  };
  visit(props, '', '');
  return found;
}

function itemFindings(app: ApxApplication): LintFinding[] {
  const findings: LintFinding[] = [];
  const defined = definedItems(app);
  const check = (pageId: string, component: ApxComponent) => {
    const seen = new Set<string>();
    for (const reference of references(component.props)) {
      const name = reference.name.toUpperCase();
      const owner = ITEM_NAME.exec(name)![1]!;
      // Only names that follow P<page>_ of a page these sources contain: nothing else is certain.
      if (!app.pages.has(String(Number(owner))) || defined.has(name)) continue;
      const key = `${name}|${reference.how === 'property' ? 'p' : 'c'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const where =
        reference.how === 'property'
          ? `${reference.property} names`
          : reference.how === 'bind'
            ? `${reference.property} reads the value of`
            : `${reference.property} substitutes &${name}., the value of`;
      findings.push({
        code: reference.how === 'property' ? 'ITEM-001' : 'ITEM-002',
        level: 'warning',
        page: pageId,
        component: component.id,
        file: component.file,
        line: component.line,
        message: `${component.type} ${component.id}: ${where} item ${name}, which no page item or application item in these sources defines; APEX leaves it empty or fails at run time`,
      });
    }
  };
  for (const [pageId, page] of app.pages) walk(page, (component) => check(pageId, component));
  return findings;
}

// ---------------------------------------------------------------- duplicates

/** Components shown under a condition can share an id with their alternative. */
function conditional(component: ApxComponent): boolean {
  return (
    isObject(component.props.serverSideCondition) ||
    get(component.props, 'config.buildOption') !== undefined ||
    get(component.props, 'security.authorizationScheme') !== undefined
  );
}

function duplicateFindings(page: ApxComponent): LintFinding[] {
  const findings: LintFinding[] = [];
  const items = new Map<string, ApxComponent>();
  for (const component of page.children) {
    if (component.type !== 'pageItem') continue;
    const name = component.id.toUpperCase();
    const first = items.get(name);
    if (!first) {
      items.set(name, component);
      continue;
    }
    findings.push({
      code: 'DUP-001',
      level: 'warning',
      page: page.id,
      component: component.id,
      file: component.file,
      line: component.line,
      message: `Page item ${component.id} is defined twice on page ${page.id} (first at ${first.file}:${first.line}); item names must be unique`,
    });
  }
  // DOM ids: the HTML DOM ID of regions and buttons, and every item name.
  const ids = new Map<string, { component: ApxComponent; label: string }>();
  for (const [name, component] of items)
    if (!conditional(component)) ids.set(name, { component, label: `page item ${component.id}` });
  for (const component of page.children) {
    if (component.type !== 'region' && component.type !== 'button') continue;
    const id = str(component.props, 'advanced.htmlDomId');
    if (!id || /[&#]/u.test(id) || conditional(component)) continue;
    const label = `${component.type} ${component.id}`;
    const first = ids.get(id);
    if (!first) {
      ids.set(id, { component, label });
      continue;
    }
    findings.push({
      code: 'DUP-002',
      level: 'warning',
      page: page.id,
      component: component.id,
      file: component.file,
      line: component.line,
      message: `${label}: HTML DOM ID "${id}" is already used by ${first.label} (${first.component.file}:${first.component.line}) on page ${page.id}; duplicate ids break dynamic actions, JavaScript and accessibility`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------- accessibility (APEX Advisor)

/** Report regions whose columns carry `accessibility.valueIdentifiesRow`. */
const ROW_HEADER_REGIONS = new Set(['classicReport', 'interactiveReport', 'interactiveGrid']);
/** Column types that show no data cell, so they cannot be the row header. */
const NO_HEADER_COLUMN_TYPES = new Set([
  'hidden',
  'hiddenColumn',
  'rowSelector',
  'rowActions',
  'actionsMenu',
]);

/** Item types that show no field: hidden values and the grid layout markers. */
const UNLABELLED_ITEM_TYPES = new Set(['hidden', 'stopAndStartGridLayout']);

function accessibilityFindings(page: ApxComponent): LintFinding[] {
  const findings: LintFinding[] = [];
  const add = (code: string, level: LintFinding['level'], component: ApxComponent, message: string) =>
    findings.push({
      code,
      level,
      page: page.id,
      component: component.id,
      file: component.file,
      line: component.line,
      message,
    });
  if (page.id !== '0' && !str(page.props, 'title').trim())
    add(
      'A11Y-001',
      'warning',
      page,
      `Page ${page.id} has no title; screen readers announce the page title (APEX Advisor: page has a title)`,
    );
  for (const component of page.children) {
    if (component.type === 'pageItem') {
      const type = str(component.props, 'type');
      if (
        type &&
        !UNLABELLED_ITEM_TYPES.has(type) &&
        !type.includes('/') &&
        !str(component.props, 'label.label').trim()
      )
        add(
          'A11Y-002',
          'warning',
          component,
          `Page item ${component.id} (${type}) has no label${
            str(component.props, 'appearance.valuePlaceholder') ? '; a placeholder does not replace it' : ''
          }. Set label.label; a hidden-label field template keeps it off screen (APEX Advisor: page item has a label)`,
        );
      if (
        type === 'displayImage' &&
        !str(component.props, 'settings.altText').trim() &&
        !str(component.props, 'settings.altTextColumn').trim()
      )
        add(
          'A11Y-004',
          'warning',
          component,
          `Display Image item ${component.id} has no alternative text; set settings.altText or settings.altTextColumn (APEX Advisor: image has ALT text)`,
        );
      const action = str(component.props, 'settings.pageActionOnSelection');
      if (
        (type === 'selectList' || type === 'radioGroup') &&
        (action === 'submitPage' || action === 'redirectSetValue')
      )
        add(
          'A11Y-005',
          'info',
          component,
          `Page item ${component.id} reloads the page when its value changes (settings.pageActionOnSelection: ${action}); tell users in the label or help text, or use a button or a dynamic action (APEX Advisor: avoid unexpected context change)`,
        );
    }
    if (component.type === 'region' && ROW_HEADER_REGIONS.has(str(component.props, 'type'))) {
      // Classic reports drawn by a list-like template (cards, value pairs, badges) have no table.
      const reportTemplate = (
        ref(component.props, 'componentAppearance.template') ??
        ref(component.props, 'appearance.reportTemplate') ??
        'standard'
      ).toLowerCase();
      if (str(component.props, 'type') === 'classicReport' && reportTemplate !== 'standard') continue;
      const columns = component.children.filter(
        (child) => child.type === 'column' && !NO_HEADER_COLUMN_TYPES.has(str(child.props, 'type')),
      );
      if (
        columns.length &&
        !columns.some((column) => get(column.props, 'accessibility.valueIdentifiesRow') === true)
      )
        add(
          'A11Y-003',
          // Advisory: most reports, Oracle's samples included, set no row header.
          'info',
          component,
          `${str(component.props, 'type')} region ${component.id} has no row header column; set accessibility.valueIdentifiesRow: true on the column that identifies a row (APEX Advisor: report has a row header)`,
        );
    }
  }
  return findings;
}

/** Runs every source check; findings are ordered by page, then by source position. */
export function lintApplication(app: ApxApplication, options: LintOptions = {}): LintFinding[] {
  const findings: LintFinding[] = [];
  const global = app.pages.get('0');
  for (const page of app.pages.values()) {
    findings.push(...slotFindings(page, global, options));
    findings.push(...duplicateFindings(page));
    findings.push(...accessibilityFindings(page));
  }
  findings.push(...itemFindings(app));
  return findings.sort(
    (a, b) => Number(a.page) - Number(b.page) || a.file.localeCompare(b.file) || a.line - b.line,
  );
}
