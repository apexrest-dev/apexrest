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
  type ApxValue,
} from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { templateOptions } from '../../theme.ts';
import { applyTemplate, escapeValue, type EscapeMode } from './directives.ts';
import { componentIndex, type PluginAttribute, type TemplateComponent } from './plugins.ts';

/**
 * Universal Theme template components (`themeTemplateComponent/<name>` regions) rendered with the
 * genuine partial / report templates of the theme export: Single (Partial), Multiple (Report) with
 * groups, pagination and actions, and Region Only with slots.
 */

const SOURCE_TYPES = new Set(['SESSION STATE VALUE', 'MEDIA']);

type Values = Record<string, string>;

const strings = (values: ApxValue[]) =>
  values.map((value) => (typeof value === 'string' ? value : isRef(value) ? value.ref : String(value)));

export function findComponent(renderer: ApexRenderer, name: string): TemplateComponent | undefined {
  return componentIndex(renderer.assets.theme).byApexlang.get(name.toLowerCase());
}

/** The APEXlang value of an attribute: `settings.<name>` or `plugin-<group>.<name>`. */
function configured(owner: ApxComponent, attribute: PluginAttribute): ApxValue | undefined {
  const paths = attribute.group
    ? [`plugin-${attribute.group}.${attribute.apexlangName}`, `settings.${attribute.apexlangName}`]
    : [`settings.${attribute.apexlangName}`];
  for (const path of paths) {
    const value = get(owner.props, path);
    if (value !== undefined) return value;
  }
  return undefined;
}

function stored(attribute: PluginAttribute, value: ApxValue): string {
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  if (Array.isArray(value)) return strings(value).join(' ');
  if (isRef(value)) return value.ref;
  if (isObject(value)) {
    // Media: { type: url|urlColumn|blobColumn, url|urlColumn|column: ... }
    const pick = ['url', 'urlColumn', 'column', 'blobColumn', 'value'].find(
      (key) => typeof value[key] === 'string',
    );
    return pick ? (value[pick] as string) : '';
  }
  if (attribute.type === 'CHECKBOX')
    return /^(true|y|yes)$/iu.test(value) ? 'Y' : /^(false|n|no)$/iu.test(value) ? 'N' : value;
  return attribute.values.get(value) ?? value;
}

export class ComponentRenderer {
  readonly renderer: ApexRenderer;
  readonly ctx: RenderContext;
  readonly owner: ApxComponent;
  readonly component: TemplateComponent;
  readonly domId: string;
  #byId = new Map<string, PluginAttribute>();
  #menuCount = 0;

  constructor(
    renderer: ApexRenderer,
    ctx: RenderContext,
    owner: ApxComponent,
    component: TemplateComponent,
    domId: string,
  ) {
    this.renderer = renderer;
    this.ctx = ctx;
    this.owner = owner;
    this.component = component;
    this.domId = domId;
    for (const attribute of component.attributes) this.#byId.set(attribute.id, attribute);
  }

  get named() {
    return componentIndex(this.renderer.assets.theme).named;
  }

  warn = (message: string) =>
    this.renderer.diagnose(
      'warning',
      `${this.component.displayName} ${this.owner.id}: ${message}`,
      this.ctx.pageId,
      this.owner.id,
    );

  /** Configuration value before row substitution, honoring defaults and attribute dependencies. */
  setting(attribute: PluginAttribute, seen = new Set<string>()): string {
    if (attribute.dependsOn && !seen.has(attribute.id)) {
      const parent = this.#byId.get(attribute.dependsOn);
      if (parent) {
        seen.add(attribute.id);
        const value = this.setting(parent, seen);
        const expected = attribute.dependsExpression ?? '';
        const holds = (() => {
          switch (attribute.dependsCondition) {
            case 'NOT_NULL':
              return value !== '';
            case 'NULL':
              return value === '';
            case 'NOT_EQUALS':
              return value !== expected;
            case 'IN_LIST':
              return expected.split(',').includes(value);
            case 'NOT_IN_LIST':
              return !expected.split(',').includes(value);
            default:
              return value === expected;
          }
        })();
        if (!holds) return '';
      }
    }
    const value = configured(this.owner, attribute);
    if (value === undefined) return attribute.defaultValue ?? '';
    return stored(attribute, value);
  }

  /** Substitutes `&COLUMN.` (and `#COLUMN#`) row values and session state into an attribute value. */
  resolve(attribute: PluginAttribute, raw: string, row: Row | undefined): string {
    if (!raw) return '';
    const columnValue = (name: string) => {
      const key = name.toUpperCase();
      return row && key in row ? String(row[key] ?? '') : undefined;
    };
    if (SOURCE_TYPES.has(attribute.type) && /^[A-Za-z][\w$#]*$/u.test(raw)) {
      const value = columnValue(raw);
      if (value !== undefined) return value;
      if (row && attribute.type === 'SESSION STATE VALUE')
        this.warn(`column ${raw.toUpperCase()} for ${attribute.apexlangName} is not in the source`);
    }
    // RAW attributes insert column values escaped (as APEX does by default); others are escaped on output.
    const escape: EscapeMode = attribute.escape === 'RAW' ? 'HTML' : 'RAW';
    const replaced = raw
      .replace(
        /&(?:"([^"]+)"|([A-Za-z][\w$#]*))(?:!([A-Z]+))?\./gu,
        (whole, quoted?: string, plain?: string, filter?: string) => {
          const value = columnValue(quoted ?? plain ?? '');
          return value === undefined ? whole : escapeValue(value, filter ?? escape);
        },
      )
      .replace(/#([A-Z][A-Z0-9_$]*)(?:!([A-Z]+))?#/gu, (whole, name: string, filter?: string) => {
        const value = columnValue(name);
        return value === undefined ? whole : escapeValue(value, filter ?? escape);
      });
    return this.renderer.substitute(
      this.ctx.session,
      replaced,
      this.ctx.page,
      attribute.escape === 'RAW' ? 'HTML' : 'RAW',
    );
  }

  attributes(scope: string, row: Row | undefined): { values: Values; escapes: Record<string, EscapeMode> } {
    const values: Values = {};
    const escapes: Record<string, EscapeMode> = {};
    for (const attribute of this.component.attributes) {
      if (attribute.scope !== scope) continue;
      const value = this.resolve(attribute, this.setting(attribute), row);
      // Font APEX icons need the base class next to the fa-* name, as APEX adds it for icon attributes.
      values[attribute.staticId] =
        attribute.type === 'ICON' && /(^|\s)fa-/u.test(value) && !/(^|\s)fa(\s|$)/u.test(value)
          ? `fa ${value}`
          : value;
      escapes[attribute.staticId] = attribute.escape;
    }
    return { values, escapes };
  }

  apply(
    template: string,
    values: Values,
    escapes: Record<string, EscapeMode>,
    defaultEscape = this.component.defaultEscape,
  ) {
    return applyTemplate(template, values, {
      escapes,
      defaultEscape,
      templates: (name) => this.named.get(name),
      warn: this.warn,
    });
  }

  // ------------------------------------------------------------ actions

  actions(): ApxComponent[] {
    return this.owner.children
      .filter((child) => child.type === 'action')
      .sort((a, b) => num(a.props, 'layout.sequence', 0) - num(b.props, 'layout.sequence', 0));
  }

  target(action: ApxComponent, row: Row | undefined): string {
    const behavior = get(action.props, 'behavior');
    if (!isObject(behavior)) return '';
    const type = str(behavior, 'type', behavior.target !== undefined ? 'redirectThisApp' : 'redirectUrl');
    if (type === 'triggerAction') return '#';
    if (type === 'redirectUrl' || behavior.targetUrl !== undefined) {
      const raw = str(behavior, 'targetUrl');
      return this.resolve({ ...LINK_ATTRIBUTE }, raw, row);
    }
    return this.renderer.link(this.ctx, get(behavior, 'target'), row, `apex.jQuery('#${this.domId}')`);
  }

  menu(action: ApxComponent, row: Row | undefined): { id: string; html: string } {
    const id = `tc_menu_a${this.domId.replace(/\W/gu, '_')}_${(this.#menuCount += 1)}`;
    const entries = action.children.filter(
      (child) => child.type === 'menu' && this.renderer.visible(this.ctx, child),
    );
    const render = (parent: string | undefined): string =>
      entries
        .filter((entry) => ref(entry.props, 'parentMenu') === parent)
        .sort((a, b) => num(a.props, 'layout.sequence', 0) - num(b.props, 'layout.sequence', 0))
        .map((entry) => {
          const type = str(entry.props, 'type', 'menuEntry');
          if (type === 'separator') return '<li class="a-Menu-hSeparator" role="separator"></li>';
          const label = escapeValue(
            this.resolve({ ...TEXT_ATTRIBUTE }, str(entry.props, 'label', entry.id), row),
            'HTML',
          );
          const icon = str(entry.props, 'appearance.icon');
          const iconHtml = icon ? `<span class="${escapeValue(icon, 'ATTR')}"></span>` : '';
          if (type === 'subMenu')
            return `<li>${iconHtml}<span>${label}</span><ul>${render(entry.id)}</ul></li>`;
          return `<li><a href="${escapeValue(this.target(entry, row), 'ATTR')}" ${this.resolve({ ...TEXT_ATTRIBUTE }, str(entry.props, 'behavior.linkAttributes'), row)}>${iconHtml}${label}</a></li>`;
        })
        .join('');
    return {
      id,
      html: `<div id="${id}" style="display:none" data-apex-local-menu><ul>${render(undefined)}</ul></div>`,
    };
  }

  /** Placeholder values of the action positions for one row. */
  positions(row: Row | undefined): Values {
    const values: Values = {};
    const actions = this.actions();
    for (const position of this.component.positions) {
      const own = actions.filter(
        (action) =>
          str(action.props, 'position').toLowerCase() === position.apexlangName.toLowerCase() &&
          this.renderer.visible(this.ctx, action),
      );
      if (!own.length) continue;
      if (position.type === 'LINK') {
        const first = own[0]!;
        values[position.staticId] = this.target(first, row);
        values[`${position.staticId}_ATTR`] = this.resolve(
          { ...TEXT_ATTRIBUTE },
          str(first.props, 'behavior.linkAttributes'),
          row,
        );
        continue;
      }
      values[position.staticId] = own
        .map((action) => {
          const name = str(action.props, 'template').toLowerCase();
          const template =
            this.component.actionTemplates.find((entry) => entry.apexlangName.toLowerCase() === name) ??
            this.component.actionTemplates.find((entry) => entry.id === position.templateId) ??
            this.component.actionTemplates.find(
              (entry) => entry.type === (action.children.length ? 'MENU' : 'BUTTON'),
            );
          if (!template) {
            this.warn(`no action template for ${position.apexlangName}`);
            return '';
          }
          const displayType = str(action.props, 'appearance.displayType', 'text');
          const isMenu = template.type === 'MENU';
          const menu = isMenu ? this.menu(action, row) : undefined;
          const values: Values = {
            LABEL: this.resolve({ ...TEXT_ATTRIBUTE }, str(action.props, 'label', action.id), row),
            LINK_URL: isMenu ? '' : this.target(action, row),
            LINK_ATTR: this.resolve({ ...TEXT_ATTRIBUTE }, str(action.props, 'behavior.linkAttributes'), row),
            ICON_CLASSES: displayType === 'text' ? '' : str(action.props, 'appearance.icon'),
            CSS_CLASSES: strings(list(action.props, 'appearance.cssClasses')).join(' '),
            IS_HOT: bool(action.props, 'appearance.hot', false) ? 'Y' : 'N',
            IS_ICON_ONLY: displayType === 'icon' ? 'Y' : 'N',
            IS_DISABLED: bool(action.props, 'appearance.showAsDisabled', false) ? 'Y' : 'N',
            MENU_ID: menu?.id ?? '',
            MENU: menu?.html ?? '',
          };
          if (menu) this.ctx.onload.push(`apex.jQuery('#${menu.id}').menu({owningRegion:'${this.domId}'});`);
          return this.apply(
            template.template,
            values,
            { MENU: 'RAW', LINK_ATTR: 'RAW', LABEL: 'RAW' },
            'HTML',
          );
        })
        .join('');
    }
    return values;
  }

  // ------------------------------------------------------------ rendering

  builtins(): Values {
    return {
      APEX$DOM_ID: this.domId,
      APEX$IS_LAZY_LOADING: '',
      APEX$SELECTOR: '',
      APEX$HAS_MESSAGE: '',
      APEX$COMPONENT_CSS_CLASSES: [
        templateOptions(strings(list(this.owner.props, 'componentAppearance.templateOptions')), ''),
        strings(list(this.owner.props, 'componentAppearance.cssClasses')).join(' '),
      ]
        .filter(Boolean)
        .join(' '),
    };
  }

  partial(row: Row | undefined, extra: Values = {}, domSuffix = ''): string {
    const report = this.attributes('REPORT', undefined);
    const own = this.attributes('COMPONENT', row);
    const values = { ...this.builtins(), ...report.values, ...own.values, ...this.positions(row), ...extra };
    if (domSuffix) values.APEX$DOM_ID = `${this.domId}${domSuffix}`;
    return this.apply(this.component.partial, values, {
      ...report.escapes,
      ...own.escapes,
      ...EXTRA_ESCAPES,
    });
  }

  rows(): { rows: Row[]; error?: string } | undefined {
    let sql = this.renderer.regionSql(this.ctx, this.owner);
    if (!sql) {
      const location = str(this.owner.props, 'source.location');
      if (location && location !== 'localDatabase')
        this.renderer.diagnose(
          'info',
          `Template component ${this.owner.id}: source location ${location} is not simulated`,
          this.ctx.pageId,
          this.owner.id,
        );
      return undefined;
    }
    const orderBy = str(this.owner.props, 'orderBy.orderByClause');
    if (orderBy) sql = `select * from (${sql}) order by ${orderBy}`;
    const result = this.renderer.query(this.ctx, this.owner, sql);
    return result.error ? { rows: [], error: result.error } : { rows: result.rows };
  }

  rowId(row: Row): string {
    const key = this.owner.children.find(
      (child) => child.type === 'column' && bool(child.props, 'source.primaryKey', false),
    );
    const value = key ? row[key.id.toUpperCase()] : undefined;
    return value === undefined || value === null ? '' : String(value);
  }

  report(rows: Row[], pagination: string): string {
    const report = this.attributes('REPORT', undefined);
    const groupColumns = this.owner.children
      .filter((child) => child.type === 'column' && bool(child.props, 'appearance.group', false))
      .map((child) => child.id.toUpperCase());
    const rowHtml = (row: Row, index: number) => {
      const id = this.rowId(row);
      return this.apply(
        this.component.reportRow || '<li #APEX$ROW_IDENTIFICATION#>#APEX$PARTIAL#</li>',
        {
          ...this.builtins(),
          ...report.values,
          APEX$ROW_IDENTIFICATION: `data-id="${escapeValue(id || String(index + 1), 'ATTR')}"`,
          APEX$PARTIAL: this.partial(row, {}, `_${index + 1}`),
        },
        { ...report.escapes, ...EXTRA_ESCAPES },
      );
    };
    let body = '';
    if (groupColumns.length && this.component.reportGroup) {
      let start = 0;
      let groupIndex = 0;
      const key = (row: Row) => groupColumns.map((column) => String(row[column] ?? '')).join('\u0001');
      while (start < rows.length) {
        let end = start + 1;
        while (end < rows.length && key(rows[end]!) === key(rows[start]!)) end += 1;
        const group = this.attributes('REPORT_GROUP', rows[start]);
        groupIndex += 1;
        body += this.apply(
          this.component.reportGroup,
          {
            ...this.builtins(),
            ...report.values,
            ...group.values,
            APEX$DOM_ID: `${this.domId}_group${groupIndex}`,
            APEX$GROUP_IDENTIFICATION: `data-group-id="${escapeValue(key(rows[start]!).replaceAll('\u0001', '_'), 'ATTR')}"`,
            APEX$ROWS: rows
              .slice(start, end)
              .map((row, offset) => rowHtml(row, start + offset))
              .join('\n'),
          },
          { ...report.escapes, ...group.escapes, ...EXTRA_ESCAPES },
        );
        start = end;
      }
    } else {
      if (groupColumns.length) this.warn('grouping is not supported by this template component');
      body = rows.map(rowHtml).join('\n');
    }
    return (
      this.apply(
        this.component.reportBody || '<ul>#APEX$ROWS#</ul>',
        { ...this.builtins(), ...report.values, APEX$ROWS: body },
        { ...report.escapes, ...EXTRA_ESCAPES },
      ) + pagination
    );
  }
}

const TEXT_ATTRIBUTE: PluginAttribute = {
  id: '',
  staticId: '',
  apexlangName: '',
  scope: 'COMPONENT',
  type: 'TEXT',
  escape: 'RAW',
  values: new Map(),
};
const LINK_ATTRIBUTE: PluginAttribute = { ...TEXT_ATTRIBUTE, type: 'LINK', escape: 'ATTR' };

const EXTRA_ESCAPES: Record<string, EscapeMode> = {
  APEX$ROWS: 'RAW',
  APEX$PARTIAL: 'RAW',
  APEX$SELECTOR: 'RAW',
  APEX$ROW_IDENTIFICATION: 'RAW',
  APEX$GROUP_IDENTIFICATION: 'RAW',
  APEX$COMPONENT_CSS_CLASSES: 'ATTR',
  APEX$DOM_ID: 'ATTR',
  BODY: 'RAW',
  PRIMARY_ACTIONS: 'RAW',
  ACTIONS: 'RAW',
  FULL_ROW_LINK_ATTR: 'RAW',
  TITLE_LINK_ATTR: 'RAW',
  AVATAR_LINK_ATTR: 'RAW',
  BADGE_LINK_ATTR: 'RAW',
  USER_NAME_LINK_ATTR: 'RAW',
  LINK_ATTR: 'RAW',
};

/** Region body of a `themeTemplateComponent/<name>` region. */
export function renderTemplateComponentRegion(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
): string {
  const type = str(region.props, 'type');
  const name = type.split('/')[1] ?? '';
  const component = findComponent(renderer, name);
  if (!component) {
    renderer.diagnose(
      'warning',
      `Template component ${name} (${region.id}) is not in the theme; nothing is rendered`,
      ctx.pageId,
      region.id,
    );
    return '';
  }
  const domId = renderer.regionDomId(region);
  const tc = new ComponentRenderer(renderer, ctx, region, component, domId);
  const display = displayMode(region, component);
  if (display === 'regionOnly') return '';
  ctx.clientConfig.regions.push({ id: domId, kind: 'templateComponent' });
  if (str(region.props, 'rowSelection.type'))
    renderer.diagnose(
      'info',
      `Template component ${region.id}: row selection is not simulated`,
      ctx.pageId,
      region.id,
    );
  const source = tc.rows();
  if (source?.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeValue(source.error, 'HTML')}</div></div>`;
  if (display === 'partial') return tc.partial(source?.rows[0]);
  const rows = source?.rows ?? [];
  if (!rows.length) {
    const message = renderer.substitute(
      ctx.session,
      str(region.props, 'messages.whenNoDataFound', 'No data found.'),
      ctx.page,
      'HTML',
    );
    const icon = str(region.props, 'messages.noDataFoundIcon', 'fa-search');
    return `<div class="a-TMV--noData"><div class="a-TMV-noDataMessage"><span class="a-Icon ${escapeValue(icon.startsWith('fa-') ? `fa ${icon}` : icon, 'ATTR')}" aria-hidden="true"></span><span class="a-TMV-noDataMessage-text">${message}</span></div></div>`;
  }
  const paged = str(region.props, 'pagination.type', 'page') === 'page';
  const perPage = paged
    ? num(region.props, 'pagination.entitiesPerPage', 15)
    : num(region.props, 'pagination.initialEntitiesCount', 50);
  const pageNumber = Math.max(1, ctx.session.pagination[`${ctx.pageId}:${region.id}`] ?? 1);
  const shown = rows.slice((pageNumber - 1) * perPage, pageNumber * perPage);
  const first = (pageNumber - 1) * perPage + 1;
  const last = first + shown.length - 1;
  const button = (target: number, label: string) =>
    `<button type="button" class="t-Button t-Button--small t-Button--noUI" data-apex-local-page="${target}" data-region="${escapeValue(domId, 'ATTR')}">${label}</button>`;
  const pagination =
    rows.length > perPage
      ? `<div class="a-GV-footer apex-local-tc-pagination"><div class="a-GV-pageSelector">${pageNumber > 1 ? button(pageNumber - 1, '<span class="a-Icon icon-left-arrow" aria-hidden="true"></span> Previous') : ''}<span class="a-GV-pageRange">${first} - ${last}${bool(region.props, 'pagination.showTotalCount', false) ? ` of ${rows.length}` : ''}</span>${last < rows.length ? button(pageNumber + 1, 'Next <span class="a-Icon icon-right-arrow" aria-hidden="true"></span>') : ''}</div></div>`
      : '';
  if (!paged && rows.length > perPage)
    renderer.diagnose(
      'info',
      `Template component ${region.id}: infinite scrolling is rendered as page pagination`,
      ctx.pageId,
      region.id,
    );
  return tc.report(shown, pagination);
}

export function displayMode(
  region: ApxComponent,
  component: TemplateComponent,
): 'partial' | 'report' | 'regionOnly' {
  const display = str(region.props, 'componentAppearance.display');
  if (display === 'partial' || display === 'report' || display === 'regionOnly') return display;
  if (component.supports.has('REGION_ONLY') && !component.supports.has('PARTIAL')) return 'regionOnly';
  return component.supports.has('REPORT') ? 'report' : 'partial';
}

/** A region displayed as "Region Only": the component's partial template is the region markup. */
export function wrapRegionOnly(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  values: Values,
  children: Map<string, { component: ApxComponent; html: string }[]>,
): string | undefined {
  const name = str(region.props, 'type').split('/')[1] ?? '';
  const component = findComponent(renderer, name);
  if (!component || displayMode(region, component) !== 'regionOnly') return undefined;
  const domId = renderer.regionDomId(region);
  const tc = new ComponentRenderer(renderer, ctx, region, component, domId);
  const slots: Values = {};
  for (const slot of component.slots.length
    ? component.slots
    : [{ placeholder: 'BODY', apexlangName: 'body' }]) {
    // Template component slots have no grid: sub-regions are placed side by side as rendered.
    const key = `PLUGIN-${slot.apexlangName.toUpperCase()}`;
    const own = [
      ...(children.get(key) ?? []),
      ...(slot.placeholder === 'BODY' ? (children.get('SUB_REGIONS') ?? []) : []),
    ];
    slots[slot.placeholder] = own.map((child) => child.html).join('\n');
  }
  if (values.BODY) slots.BODY = `${values.BODY}${slots.BODY ?? ''}`;
  const classes = [str(region.props, 'appearance.cssClasses'), tc.builtins().APEX$COMPONENT_CSS_CLASSES]
    .filter(Boolean)
    .join(' ');
  return tc.partial(undefined, { ...slots, APEX$COMPONENT_CSS_CLASSES: classes });
}

/** A report column of type `themeTemplateComponent/<name>`: the component's partial per row. */
export function renderTemplateComponentColumn(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  column: ApxComponent,
  row: Row,
): string {
  const name = str(column.props, 'type').split('/')[1] ?? '';
  const component = findComponent(renderer, name);
  if (!component?.partial) {
    renderer.diagnose(
      'warning',
      `Column ${column.id}: template component ${name} is not in the theme`,
      ctx.pageId,
      region.id,
    );
    const value = row[column.id.toUpperCase()];
    return escapeValue(value === null || value === undefined ? '' : String(value), 'HTML');
  }
  const domId = `${renderer.regionDomId(region)}_${column.id.toLowerCase()}`;
  return new ComponentRenderer(renderer, ctx, column, component, domId).partial(row);
}
