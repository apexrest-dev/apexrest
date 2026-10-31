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
  type ApxApplication,
  type ApxComponent,
  type ApxObject,
  type ApxValue,
} from './apexlang.ts';
import { APEX_FULL_VERSION, type ApexAssets } from './assets.ts';
import {
  columnRenderer,
  conditionHandler,
  evaluateExpression,
  extensions,
  filterRegionSql,
  itemRenderer,
  processHandler,
  regionRenderer,
  runCodeExtensions,
  runPointExtensions,
  validationHandler,
} from './extensions.ts';
import './extensions/index.ts';
import { formatOracle, LocalDatabase, splitScript, type Binds, type Row } from './database.ts';
import {
  applyEscape,
  defaultStaticId,
  escapeHtml,
  escapeJs,
  fill,
  indexTheme,
  templateOptions,
  text,
  type TemplateParams,
  type ThemeIndex,
} from './theme.ts';

export const LOCAL_PREFIX = '/__apex';
export const IMAGE_PREFIX = '/i/';

interface Column {
  name: string;
  type: string;
  pk?: boolean | undefined;
  label?: string | undefined;
  max?: number | undefined;
}

export interface Diagnostic {
  level: 'error' | 'warning' | 'info';
  page?: string;
  component?: string;
  message: string;
}

export interface ApexError {
  type: 'error';
  location: string[];
  pageItem?: string;
  message: string;
  unsafe: boolean;
}

export interface Session {
  id: string;
  user: string;
  items: Record<string, string>;
  success?: string | undefined;
  errors?: ApexError[] | undefined;
  pagination: Record<string, number>;
  /** Theme style chosen from the preview toolbar; overrides the application's current style. */
  themeStyle?: string | undefined;
}

interface RenderContext {
  session: Session;
  page: ApxComponent;
  pageId: string;
  request: string;
  onload: string[];
  jsFiles: Set<string>;
  cssFiles: Set<string>;
  clientConfig: { regions: { id: string; kind: string }[]; dynamicActions: unknown[] };
  itemErrors: Map<string, string>;
  messageTemplates: Record<string, string>;
}

export interface RenderOptions {
  /** Developer toolbar with diagnostics; disable for pixel comparisons. */
  toolbar?: boolean;
  sampleRows?: number;
}

type Lov = { d: string; r: string }[];

export const MESSAGES: Record<string, string> = {
  APEX_PAGE_NOSCRIPT: 'You must run this web page with JavaScript enabled.',
  UI_PAGE_SKIP_TO_CONTENT: 'Skip to Main Content',
  'APEX.TEMPLATE.MAIN_NAV_LABEL': 'Main Navigation',
  'APEX.TEMPLATE.APPLICATION': 'Application',
  'APEX.SUCCESS': 'Success',
  'APEX.SUCCESS_MESSAGE_HEADING': 'Success Message',
  'APEX.ERROR_MESSAGE_HEADING': 'Error Message',
  'APEX.ERROR': 'Error',
  'APEX.INFORMATION': 'Information',
  'APEX.GV.SELECTION_COUNT': '%0 rows selected',
  'APEX.GV.ROW_ADDED': 'Added',
  'APEX.GV.ROW_CHANGED': 'Changed',
  'APEX.GV.ROW_DELETED': 'Deleted',
  'APEX.IG.SAVE': 'Save',
  'APEX.IG.EDIT': 'Edit',
  'APEX.IG.ADD_ROW': 'Add Row',
  'APEX.IG.ACTIONS': 'Actions',
  'APEX.IG.CHANGES_SAVED': 'Changes saved',
  'APEX.DIALOG.SAVE': 'Save',
  'APEX.DIALOG.HELP': 'Help',
  'APEX.NO_DATA_FOUND': 'No data found',
  'APEX.ITEM.TEXT.CHARACTER_COUNT': '%0 of %1',
  'APEX.ITEM_TYPE.YES_NO.YES_LABEL': 'Yes',
  'APEX.ITEM_TYPE.YES_NO.NO_LABEL': 'No',
  'APEX.ITEM_TYPE.CHECKBOX.CHECKED': 'Checked',
  'APEX.ITEM_TYPE.CHECKBOX.UNCHECKED': 'Unchecked',
  'APEX.REGION.COLLAPSE': 'Collapse',
  'APEX.REGION.EXPAND': 'Expand',
  'APEX.RDS.SHOW_ALL': 'Show All',
  'APEX.TABS.NEXT': 'Next',
  'APEX.TABS.PREVIOUS': 'Previous',
  'APEX.MENU.OVERFLOW_LABEL': 'More',
  'APEX.ACTIVE_STATE': 'Active',
  'APEX.LOADING': 'Loading',
  'APEX.GV.LOADING_INDICATOR': 'Loading',
  WARNING: 'Warning',
  'APEX.UI.BACK_TO_TOP': 'Start of page',
  DELETE_MSG: 'Would you like to perform this delete action?',
  'APEX.DIALOG.CLOSE': 'Close',
  'APEX.DIALOG.OK': 'OK',
  'APEX.DIALOG.CANCEL': 'Cancel',
  'APEX.ERROR.PAGE_ERRORS': 'Errors',
  'FLOW.VALIDATION_ERROR': '%0 errors have occurred',
  'FLOW.SINGLE_VALIDATION_ERROR': '1 error has occurred',
  'APEX.ERROR.PAGE_ERROR': 'Error',
  'APEX.PAGE.CONTEXT.SINGLE_ERROR': '1 error has occurred',
  'APEX.PAGE.CONTEXT.MULTIPLE_ERRORS': '%0 errors have occurred',
  'APEX.WARN_ON_UNSAVED_CHANGES': 'This page has unsaved changes.',
  'APEX.PROCESSING': 'Processing',
  'APEX.IG.SEARCH': 'Search',
  'APEX.REGION.SEARCH': 'Search',
  'APEX.DATEPICKER_VALUE_INVALID': '#LABEL# does not match format %0.',
  'APEX.VALUE_REQUIRED': '#LABEL# must have some value.',
  'APEX.NUMBER_FIELD.VALUE_INVALID': '#LABEL# must be Numeric.',
  'APEX.ITEM.HELP': 'Help',
};

const PAGE_DEFAULT_SLOTS = new Set(['body', 'contentBody', 'regionBody', '']);

function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/gu, '_');
}

function sequence(component: ApxComponent): number {
  return num(
    component.props,
    'layout.sequence',
    num(component.props, 'execution.sequence', num(component.props, 'sequence', 0)),
  );
}

function bySequence<T extends ApxComponent>(components: T[]): T[] {
  return [...components].sort((a, b) => sequence(a) - sequence(b));
}

function heading(name: string): string {
  return name
    .toLowerCase()
    .replace(/_/gu, ' ')
    .replace(/\b\w/gu, (char) => char.toUpperCase());
}

/** APEX prefixes Font APEX icon names with the base `fa` class. */
function iconClasses(value: string): string {
  return /(^|\s)fa-/u.test(value) && !/(^|\s)fa(\s|$)/u.test(value) ? `fa ${value}` : value;
}

/** Universal Theme styles item containers by these wrapper modifiers. */
const WRAPPER_CLASSES: Record<string, string> = {
  radioGroup: 'radiogroup',
  checkboxGroup: 'checkbox',
  checkbox: 'single-checkbox',
  switch: 'yes-no',
  selectList: 'select-list',
  textarea: 'textarea',
  displayOnly: 'display-only',
  datePicker: 'date-picker-apex',
  popupLov: 'popup-lov',
  fileBrowse: 'file',
  imageUpload: 'image-upload',
  richTextEditor: 'rich-text-editor',
  markdownEditor: 'markdown-editor',
  shuttle: 'shuttle',
  starRating: 'star-rating',
  colorPicker: 'color-picker',
  combobox: 'combobox',
};

function strings(values: ApxValue[]): string[] {
  return values.map((value) =>
    typeof value === 'string' ? value : isRef(value) ? value.ref : String(value),
  );
}

/**
 * Renders APEXlang pages with the genuine Universal Theme 26.2 templates and runs the
 * declarative pieces (forms, reports, LOVs, simple DML) against a SQLite stand-in.
 */
export class ApexRenderer {
  readonly app: ApxApplication;
  readonly assets: ApexAssets;
  readonly theme: ThemeIndex;
  readonly db: LocalDatabase;
  readonly alias: string;
  readonly appId: string;
  readonly diagnostics: Diagnostic[] = [];
  readonly options: Required<RenderOptions>;
  #autoTables = new Set<string>();
  #diagnosticKeys = new Set<string>();

  constructor(app: ApxApplication, assets: ApexAssets, db: LocalDatabase, options: RenderOptions = {}) {
    this.app = app;
    this.assets = assets;
    this.db = db;
    this.theme = indexTheme(assets.theme);
    this.alias = slug(app.app.id || 'app').toLowerCase();
    this.appId = app.substitutions.APP_ID ?? '100';
    this.options = { toolbar: options.toolbar ?? true, sampleRows: options.sampleRows ?? 8 };
  }

  get baseUrl(): string {
    return `/r/${this.alias}`;
  }

  diagnose(level: Diagnostic['level'], message: string, page?: string, component?: string): void {
    const key = `${level}|${page}|${component}|${message}`;
    if (this.#diagnosticKeys.has(key)) return;
    this.#diagnosticKeys.add(key);
    this.diagnostics.push({ level, message, ...(page ? { page } : {}), ...(component ? { component } : {}) });
  }

  // ---------------------------------------------------------------- lookups

  shared(type: string, id: string | undefined): ApxComponent | undefined {
    if (!id) return undefined;
    const lower = id.toLowerCase();
    return this.app.shared.find(
      (component) => component.type === type && component.id.toLowerCase() === lower,
    );
  }

  findPage(key: string): ApxComponent | undefined {
    const byId = this.app.pages.get(key);
    if (byId) return byId;
    const lower = key.toLowerCase();
    for (const page of this.app.pages.values()) {
      if (str(page.props, 'alias').toLowerCase() === lower) return page;
    }
    return undefined;
  }

  homePage(): string {
    const home = get(this.app.app.props, 'navigation.homeUrl');
    if (isObject(home) && home.page !== undefined) return this.findPage(String(home.page))?.id ?? '1';
    return this.app.pages.has('1') ? '1' : ([...this.app.pages.keys()].find((id) => id !== '0') ?? '1');
  }

  pagePath(page: ApxComponent): string {
    const alias = str(page.props, 'alias');
    return `${this.baseUrl}/${alias ? alias.toLowerCase() : page.id}`;
  }

  pageComponents(ctx: RenderContext, type: string): ApxComponent[] {
    const own = ctx.page.children.filter((child) => child.type === type);
    const global =
      ctx.page.id !== '0'
        ? (this.app.pages.get('0')?.children.filter((child) => child.type === type) ?? [])
        : [];
    return [...own, ...global];
  }

  themeComponent(): ApxComponent | undefined {
    const current = ref(this.app.app.props, 'userInterface.currentTheme');
    return this.shared('theme', current) ?? this.app.shared.find((component) => component.type === 'theme');
  }

  // ---------------------------------------------------------------- substitutions

  filePrefix(): string {
    return `${IMAGE_PREFIX}themes/theme_42/${this.assets.manifest.apexVersion.split('.').slice(0, 2).join('.')}/`;
  }

  /** `#APEX_FILES#`-style prefixes used in file URLs and HTML. */
  urls(value: string): string {
    return value
      .replaceAll('#APEX_FILES#', IMAGE_PREFIX)
      .replaceAll('#IMAGE_PREFIX#', IMAGE_PREFIX)
      .replaceAll('#THEME_FILES#', this.filePrefix())
      .replaceAll('#THEME_IMAGES#', this.filePrefix())
      .replaceAll('#APP_FILES#', `${this.baseUrl}/files/static/v1/`)
      .replaceAll('#APP_IMAGES#', `${this.baseUrl}/files/static/v1/`)
      .replaceAll('#WORKSPACE_FILES#', `${this.baseUrl}/files/workspace/`)
      .replaceAll('#WORKSPACE_IMAGES#', `${this.baseUrl}/files/workspace/`)
      .replaceAll('#MIN_DIRECTORY#', 'minified/')
      .replaceAll('#MIN#', '.min')
      .replaceAll('#APEX_VERSION#', APEX_FULL_VERSION)
      .replaceAll('#APEX_BASE_VERSION#', APEX_FULL_VERSION.split('.').slice(0, 2).join('.'))
      .replaceAll('#APP_VERSION#', '');
  }

  builtin(session: Session, page?: ApxComponent): Record<string, string> {
    const app = this.app.app.props;
    return {
      APP_ID: this.appId,
      APP_ALIAS: this.alias.toUpperCase(),
      APP_NAME: str(app, 'name', this.app.app.id),
      APP_TITLE: str(app, 'name', this.app.app.id),
      APP_USER: session.user,
      APP_SESSION: session.id,
      SESSION: session.id,
      APP_PAGE_ID: page?.id ?? '',
      APP_PAGE_ALIAS: str(page?.props ?? {}, 'alias').toUpperCase(),
      APP_VERSION: '',
      APP_TENANT_ID: '',
      BROWSER_LANGUAGE: 'en',
      LOGOUT_URL: `${this.baseUrl}/__logout`,
      APP_IMAGES: `${this.baseUrl}/files/static/v1/`,
      APP_FILES: `${this.baseUrl}/files/static/v1/`,
      IMAGE_PREFIX,
      DEBUG: 'NO',
      REQUEST: '',
      ...Object.fromEntries(
        this.app.shared
          .filter((component) => component.type === 'substitution')
          .map((component) => [
            component.id.toUpperCase(),
            str(component.props, 'value.staticValue', str(component.props, 'value')),
          ]),
      ),
      ...Object.fromEntries(
        this.app.app.children
          .filter((component) => component.type === 'substitution')
          .map((component) => [
            component.id.toUpperCase(),
            str(component.props, 'value.staticValue', str(component.props, 'value')),
          ]),
      ),
    };
  }

  /** Session state, built-ins, and `&APP_TEXT$...` messages for `&NAME.` substitutions. */
  substitute(
    session: Session,
    value: string,
    page?: ApxComponent,
    defaultEscape: 'HTML' | 'RAW' = 'HTML',
  ): string {
    const builtins = this.builtin(session, page);
    const replaced = value.replace(
      /&(?:"([^"]+)"|([A-Za-z][\w$#.]*?))(?:!([A-Z]+))?\./gu,
      (whole, quoted?: string, plain?: string, filter?: string) => {
        const name = (quoted ?? plain ?? '').toUpperCase();
        let resolved: string | undefined;
        if (name.startsWith('APP_TEXT$')) resolved = MESSAGES[name.slice(9)] ?? name.slice(9);
        else if (name in session.items) resolved = session.items[name];
        else if (name in builtins) resolved = builtins[name];
        else if (this.isKnownItem(name)) resolved = '';
        if (resolved === undefined) return whole;
        return applyEscape(resolved, filter ?? defaultEscape);
      },
    );
    return this.urls(replaced);
  }

  isKnownItem(name: string): boolean {
    for (const page of this.app.pages.values()) {
      if (page.children.some((child) => child.type === 'pageItem' && child.id.toUpperCase() === name))
        return true;
    }
    return this.app.shared.some(
      (component) => component.type === 'appItem' && component.id.toUpperCase() === name,
    );
  }

  binds(session: Session, page?: ApxComponent): Binds {
    const builtins = this.builtin(session, page);
    return { ...builtins, ...session.items };
  }

  // ---------------------------------------------------------------- conditions

  condition(ctx: RenderContext, props: ApxObject, key = 'serverSideCondition'): boolean {
    const condition = get(props, key);
    if (!isObject(condition)) return true;
    const type = str(condition, 'type');
    const item = str(condition, 'item').toUpperCase();
    const value = str(condition, 'value');
    const itemValue = ctx.session.items[item] ?? '';
    const request = ctx.request;
    const runQuery = () => {
      const sql = str(condition, 'sqlQuery');
      try {
        return this.db.query(sql, this.binds(ctx.session, ctx.page), 1).rows.length > 0;
      } catch (error) {
        this.diagnose(
          'warning',
          `Condition query failed (${(error as Error).message}); treated as true`,
          ctx.pageId,
        );
        return true;
      }
    };
    switch (type) {
      case 'itemIsNull':
        return itemValue === '';
      case 'itemIsNotNull':
        return itemValue !== '';
      case 'item=value':
      case 'itemEqualsValue':
        return itemValue === value;
      case 'item!=value':
      case 'itemNotEqualsValue':
        return itemValue !== value;
      case 'itemIsZero':
        return itemValue === '0';
      case 'itemIsNotZero':
        return itemValue !== '0';
      case 'itemInValue':
      case 'valueOfItemInExpression1IsContainedInExpression2':
        return value.split(',').includes(itemValue);
      case 'requestEqualsValue':
      case 'request=value':
        return request === value;
      case 'requestNotEqualsValue':
      case 'request!=value':
        return request !== value;
      case 'requestIsContainedInValue':
        return value
          .split(',')
          .map((part) => part.trim())
          .includes(request);
      case 'requestIsNotContainedInValue':
        return !value
          .split(',')
          .map((part) => part.trim())
          .includes(request);
      case 'userIsAuthenticated':
        return true;
      case 'userIsThePublicUser':
      case 'never':
        return false;
      case 'always':
      case '':
        return true;
      case 'rowsReturned':
        return runQuery();
      case 'noRowsReturned':
        return !runQuery();
      case 'currentPageEquals':
      case 'currentPage=page':
        return ctx.pageId === (str(condition, 'page') || value);
      case 'currentPageIsInValue':
        return value.split(',').includes(ctx.pageId);
      default: {
        const extension = conditionHandler(type)?.(this, ctx, condition);
        if (extension !== undefined) return extension;
        this.diagnose(
          'info',
          `Server-side condition type "${type}" is not evaluated locally; treated as true`,
          ctx.pageId,
        );
        return true;
      }
    }
  }

  whenButton(ctx: RenderContext, props: ApxObject): boolean {
    const pressed = ref(props, 'serverSideCondition.whenButtonPressed');
    if (!pressed) return true;
    const button = this.pageComponents(ctx, 'button').find((candidate) => candidate.id === pressed);
    return (
      (button ? str(button.props, 'buttonName', button.id.toUpperCase()) : pressed.toUpperCase()) ===
      ctx.request
    );
  }

  visible(ctx: RenderContext, component: ApxComponent): boolean {
    return this.condition(ctx, component.props);
  }

  // ---------------------------------------------------------------- links

  targetUrl(
    ctx: RenderContext,
    target: ApxValue | undefined,
    row?: Row,
  ): { href: string; page?: ApxComponent } {
    if (typeof target === 'string') return { href: this.substitute(ctx.session, target, ctx.page, 'RAW') };
    if (!isObject(target)) return { href: '#' };
    const rowValue = (value: string) =>
      value.replace(/#([A-Z0-9_$]+)#/gu, (whole, name: string) =>
        row && name in row ? String(row[name] ?? '') : whole,
      );
    if (str(target, 'type') === 'url' || target.url !== undefined) {
      const url = rowValue(str(target, 'url'));
      return { href: url === 'separator' ? 'separator' : this.substitute(ctx.session, url, ctx.page, 'RAW') };
    }
    const pageKey = this.substitute(ctx.session, rowValue(str(target, 'page', ctx.pageId)), ctx.page, 'RAW');
    const page = this.findPage(pageKey);
    const parameters = new URLSearchParams();
    const items = get(target, 'items');
    if (isObject(items)) {
      for (const [name, value] of Object.entries(items)) {
        const raw = typeof value === 'string' ? value : isRef(value) ? `&${value.ref}.` : String(value);
        parameters.set(name.toLowerCase(), this.substitute(ctx.session, rowValue(raw), ctx.page, 'RAW'));
      }
    }
    const clear = str(target, 'clearCache');
    if (clear) parameters.set('clear', clear);
    const request = str(target, 'request');
    if (request) parameters.set('request', request);
    const query = parameters.toString();
    const base = page ? this.pagePath(page) : `${this.baseUrl}/${pageKey}`;
    return { href: `${base}${query ? `?${query}` : ''}`, ...(page ? { page } : {}) };
  }

  isDialog(page: ApxComponent | undefined): boolean {
    const mode = str(page?.props ?? {}, 'appearance.pageMode');
    return mode === 'modalDialog' || mode === 'nonModalDialog' || mode === 'drawer';
  }

  pageTemplateId(page: ApxComponent): string {
    const theme = this.themeComponent();
    if (this.isDialog(page)) {
      return (
        ref(page.props, 'appearance.dialogTemplate') ??
        ref(theme?.props ?? {}, 'dialogDefaults.dialogPage') ??
        defaultStaticId(this.theme, 'default_dialog_template', 'modal-dialog')
      ).toLowerCase();
    }
    const explicit = ref(page.props, 'appearance.pageTemplate');
    if (explicit) return explicit.toLowerCase();
    const login = get(this.app.app.props, 'navigation.loginUrl');
    const loginPage = isObject(login) ? this.findPage(str(login, 'page')) : undefined;
    if (loginPage === page || /login/iu.test(str(page.props, 'alias'))) {
      return (ref(theme?.props ?? {}, 'componentDefaults.loginPage') ?? 'login').toLowerCase();
    }
    return (
      ref(theme?.props ?? {}, 'componentDefaults.page') ??
      defaultStaticId(this.theme, 'default_page_template', 'standard')
    ).toLowerCase();
  }

  /** Link to a page: modal targets open through the theme's dialog JavaScript. */
  link(ctx: RenderContext, target: ApxValue | undefined, row?: Row, triggeringElement = 'this'): string {
    const { href, page } = this.targetUrl(ctx, target, row);
    if (!page || !this.isDialog(page)) return href;
    return `javascript:${this.dialogJs(page, href, triggeringElement)}`;
  }

  dialogJs(page: ApxComponent, url: string, triggeringElement: string): string {
    const template = this.theme.pages.get(this.pageTemplateId(page)) ?? this.theme.pages.get('modal-dialog');
    const options = strings(list(page.props, 'appearance.templateOptions'));
    const dialogClasses = options
      .filter((option) => option.startsWith('js-dialog-class-'))
      .map((option) => option.slice(16));
    const pageClasses = options.filter(
      (option) => option !== '#DEFAULT#' && !option.startsWith('js-dialog-class-'),
    );
    const attributes: string[] = [];
    if (get(page.props, 'dialog.resizable') !== undefined)
      attributes.push(`resizable:${bool(page.props, 'dialog.resizable', true)}`);
    if (get(page.props, 'dialog.chained') !== undefined)
      attributes.push(`chained:${bool(page.props, 'dialog.chained', true)}`);
    const literal = (value: string) => `'${escapeJs(value)}'`;
    const code =
      text(template, 'dialog_js_init_code') ||
      'apex.navigation.dialog(#PAGE_URL#,{title:#TITLE#,height:#DIALOG_HEIGHT#,width:#DIALOG_WIDTH#,maxWidth:#DIALOG_MAX_WIDTH#,modal:#IS_MODAL#,dialog:#DIALOG#,#DIALOG_ATTRIBUTES#},#PAGE_CSS_CLASSES#,#TRIGGERING_ELEMENT#)';
    return fill(code, {
      PAGE_URL: literal(url),
      TITLE: literal(str(page.props, 'title', str(page.props, 'name'))),
      DIALOG_HEIGHT: literal(str(page.props, 'dialog.height', text(template, 'dialog_height') || 'auto')),
      DIALOG_WIDTH: literal(str(page.props, 'dialog.width', text(template, 'dialog_width') || '720')),
      DIALOG_MAX_WIDTH: literal(
        str(page.props, 'dialog.maxWidth', text(template, 'dialog_max_width') || '960'),
      ),
      IS_MODAL: String(str(page.props, 'appearance.pageMode') !== 'nonModalDialog'),
      DIALOG: 'null',
      DIALOG_CSS_CLASSES: literal(dialogClasses.join(' ')),
      DIALOG_ATTRIBUTES: attributes.join(','),
      PAGE_CSS_CLASSES: literal(pageClasses.join(' ')),
      TRIGGERING_ELEMENT: triggeringElement,
    }).replace(/,\}/gu, '}');
  }

  // ---------------------------------------------------------------- LOVs

  lov(ctx: RenderContext, spec: ApxValue | undefined, owner: string): Lov {
    if (!isObject(spec)) return [];
    const type = str(spec, 'type');
    if (type === 'sharedComponent' || ref(spec, 'lov')) {
      const shared = this.shared('lov', ref(spec, 'lov'));
      if (!shared) {
        this.diagnose('warning', `LOV @${ref(spec, 'lov')} not found`, ctx.pageId, owner);
        return [];
      }
      return this.sharedLov(ctx, shared);
    }
    if (type === 'staticValues' || spec.staticValues !== undefined)
      return this.staticLov(str(spec, 'staticValues'));
    if (type === 'sqlQuery' || spec.sqlQuery !== undefined)
      return this.queryLov(ctx, str(spec, 'sqlQuery'), undefined, undefined, owner);
    return [];
  }

  staticLov(value: string): Lov {
    const body = value.replace(/^STATIC2?:/u, '');
    if (!body) return [];
    return body.split(',').map((entry) => {
      const [display, returned] = entry.split(';');
      return { d: display ?? '', r: returned ?? display ?? '' };
    });
  }

  queryLov(
    ctx: RenderContext,
    sql: string,
    display: string | undefined,
    returned: string | undefined,
    owner: string,
  ): Lov {
    try {
      const result = this.db.query(sql, this.binds(ctx.session, ctx.page), 5_000);
      const displayColumn = display?.toUpperCase() ?? result.columns[0]!;
      const returnColumn = returned?.toUpperCase() ?? result.columns[1] ?? displayColumn;
      return result.rows.map((row) => ({
        d: String(row[displayColumn] ?? ''),
        r: String(row[returnColumn] ?? ''),
      }));
    } catch (error) {
      this.diagnose('warning', `LOV query failed: ${(error as Error).message}`, ctx.pageId, owner);
      return [];
    }
  }

  sharedLov(ctx: RenderContext, lov: ApxComponent): Lov {
    const entries = bySequence(lov.children.filter((child) => child.type === 'entry'));
    if (entries.length || str(lov.props, 'source.location') === 'staticValues') {
      return entries.map((entry) => ({
        d: str(entry.props, 'display'),
        r: str(entry.props, 'return', str(entry.props, 'display')),
      }));
    }
    const display = str(lov.props, 'columnMapping.display') || undefined;
    const returned = str(lov.props, 'columnMapping.return') || undefined;
    const table = str(lov.props, 'source.tableName');
    const sql = str(lov.props, 'source.sqlQuery') || (table ? `select * from ${table}` : '');
    if (!sql) return [];
    if (table)
      this.ensureTable(
        ctx,
        table,
        [display, returned]
          .filter((value): value is string => Boolean(value))
          .map((name) => ({ name, type: 'varchar2' })),
      );
    return this.queryLov(ctx, sql, display, returned, `lov ${lov.id}`);
  }

  // ---------------------------------------------------------------- data

  /** Creates an empty-but-plausible table so a design can be previewed before real DDL exists. */
  ensureTable(ctx: RenderContext, table: string, columns: Column[]): boolean {
    const name = table.replaceAll('"', '');
    if (this.db.tableExists(name)) return false;
    const unique = new Map<string, Column>();
    // Form items anywhere in the app know the column types, keys and lengths best.
    for (const column of [...this.tableHints(name), ...columns]) {
      if (!column.name) continue;
      const key = column.name.toUpperCase();
      const known = unique.get(key);
      // The first hint wins; later ones only fill what it left open (the tightest length wins).
      if (!known) unique.set(key, column);
      else
        unique.set(key, {
          ...known,
          pk: known.pk || column.pk,
          label: known.label ?? column.label,
          max: known.max && column.max ? Math.min(known.max, column.max) : (known.max ?? column.max),
          type: /varchar|char|^$/iu.test(known.type) && column.type ? column.type : known.type,
        });
    }
    if (!unique.size) unique.set('ID', { name: 'ID', type: 'number', pk: true });
    const definitions = [...unique.values()].map((column) => {
      const type =
        /number|integer/iu.test(column.type) || /(^ID|_ID)$/iu.test(column.name)
          ? 'NUMBER'
          : /date|timestamp/iu.test(column.type)
            ? 'DATE'
            : 'VARCHAR2(4000)';
      return `"${column.name.toUpperCase()}" ${column.pk && type === 'NUMBER' ? 'INTEGER PRIMARY KEY' : type}`;
    });
    this.db.execute(`create table "${name.toUpperCase()}" (${definitions.join(', ')})`);
    const rows = this.options.sampleRows;
    for (let index = 1; index <= rows; index += 1) {
      const values: Binds = {};
      for (const column of unique.values()) {
        const key = column.name.toUpperCase();
        const identifier = /(^ID|_ID)$/u.test(key);
        if (identifier || /number|integer/iu.test(column.type))
          values[key] = String(column.pk || identifier ? index : index * 10);
        else if (/date|timestamp/iu.test(column.type))
          values[key] = new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10);
        else {
          const label = (column.label ?? '').replace(/<[^>]*>/gu, '').trim() || heading(key);
          const room = column.max ? column.max - String(index).length - 1 : label.length;
          values[key] =
            room > 0 ? `${label.slice(0, room).trim()} ${index}` : String(index).slice(0, column.max);
        }
      }
      const keys = Object.keys(values);
      this.db.execute(
        `insert into "${name.toUpperCase()}" (${keys.map((key) => `"${key}"`).join(', ')}) values (${keys.map((key) => `:${key.replace(/\W/gu, '_')}`).join(', ')})`,
        Object.fromEntries(keys.map((key) => [key.replace(/\W/gu, '_'), values[key]])),
      );
    }
    this.#autoTables.add(name.toUpperCase());
    this.diagnose(
      'info',
      `Table ${name.toUpperCase()} did not exist; created it with ${rows} sample rows. Put real DDL/data in .apex-local/*.sql`,
      ctx.pageId,
    );
    return true;
  }

  tableHints(table: string): Column[] {
    const hints: Column[] = [];
    for (const page of this.app.pages.values()) {
      const regions = page.children.filter(
        (child) =>
          child.type === 'region' &&
          str(child.props, 'source.tableName').toUpperCase() === table.toUpperCase(),
      );
      for (const region of regions)
        for (const item of page.children.filter(
          (child) => child.type === 'pageItem' && ref(child.props, 'source.formRegion') === region.id,
        )) {
          const column = str(item.props, 'source.column');
          if (!column) continue;
          const itemType = str(item.props, 'type');
          hints.push({
            name: column,
            type:
              itemType === 'numberField'
                ? 'number'
                : itemType === 'datePicker'
                  ? 'date'
                  : str(item.props, 'source.dataType', 'varchar2'),
            pk: bool(item.props, 'source.primaryKey', false),
            label: str(item.props, 'label.label') || undefined,
            max: num(item.props, 'validation.maxLength', 0) || undefined,
          });
        }
    }
    // Report and grid columns of regions reading the table add types and lengths for the rest.
    const mentions = new RegExp(`\\b"?${table.replace(/[^\w$#]/gu, '')}"?\\b`, 'iu');
    for (const page of this.app.pages.values()) {
      for (const region of page.children.filter((child) => child.type === 'region')) {
        const source = str(region.props, 'source.tableName') || str(region.props, 'source.sqlQuery');
        if (!source || !mentions.test(source)) continue;
        for (const column of region.children.filter((child) => child.type === 'column')) {
          const columnType = str(column.props, 'type');
          hints.push({
            name: str(column.props, 'source.column', column.id),
            type:
              columnType === 'numberField'
                ? 'number'
                : columnType === 'datePicker'
                  ? 'date'
                  : str(column.props, 'source.dataType', 'varchar2'),
            pk: bool(column.props, 'source.primaryKey', false),
            label: str(column.props, 'heading.heading') || undefined,
            max: num(column.props, 'validation.maxLength', 0) || undefined,
          });
        }
      }
    }
    return hints;
  }

  regionColumns(ctx: RenderContext, region: ApxComponent): Column[] {
    const columns = region.children
      .filter((child) => child.type === 'column')
      .map((column) => ({
        name: column.id,
        type: str(column.props, 'source.dataType', 'varchar2'),
        label: str(column.props, 'heading.heading') || undefined,
        pk: bool(column.props, 'source.primaryKey', false),
      }));
    const items = this.pageComponents(ctx, 'pageItem')
      .filter(
        (item) => ref(item.props, 'source.formRegion') === region.id && str(item.props, 'source.column'),
      )
      .map((item) => ({
        name: str(item.props, 'source.column'),
        type: str(item.props, 'source.dataType', 'varchar2'),
        pk: bool(item.props, 'source.primaryKey', false),
        label: str(item.props, 'label.label') || undefined,
        max: num(item.props, 'validation.maxLength', 0) || undefined,
      }));
    return [...items, ...columns];
  }

  regionSql(ctx: RenderContext, region: ApxComponent): string | undefined {
    const source = region.props.source;
    if (!isObject(source)) return undefined;
    const table = str(source, 'tableName');
    const where = str(source, 'whereClause') || str(source, 'where');
    const orderBy = str(source, 'orderByClause') || str(source, 'orderBy');
    let sql = str(source, 'sqlQuery');
    if (!sql && table) {
      this.ensureTable(ctx, table, this.regionColumns(ctx, region));
      sql = `select * from ${table}`;
    }
    if (!sql) return undefined;
    if (where) sql = `select * from (${sql}) where ${where}`;
    sql = filterRegionSql(this, ctx, region, sql);
    if (orderBy) sql = `${sql} order by ${orderBy}`;
    return sql;
  }

  query(
    ctx: RenderContext,
    region: ApxComponent,
    sql: string,
    maxRows = 10_000,
  ): { columns: string[]; rows: Row[]; error?: string } {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return this.db.query(sql, this.binds(ctx.session, ctx.page), maxRows);
      } catch (error) {
        const message = (error as Error).message;
        if (attempt < 25 && this.repairSchema(ctx, region, sql, message)) continue;
        const dictionary = /no such table: (?:main\.)?"?(APEX_[\w$#]+)/iu.exec(message)?.[1];
        if (dictionary) {
          const view = dictionary.toUpperCase();
          this.diagnose(
            'warning',
            `Region ${region.id} reads APEX dictionary view ${view}, which is not available locally`,
            ctx.pageId,
            region.id,
          );
          return {
            columns: [],
            rows: [],
            error: `APEX dictionary view ${view} is not available in the local preview.`,
          };
        }
        this.diagnose('error', `SQL failed in region ${region.id}: ${message}`, ctx.pageId, region.id);
        return { columns: [], rows: [], error: message };
      }
    }
  }

  /**
   * Grows auto-created sample tables so queries written for the real schema still run:
   * missing tables are created and missing columns are added with sample values.
   */
  repairSchema(ctx: RenderContext, region: ApxComponent, sql: string, message: string): boolean {
    const missingTable = /no such table: (?:main\.)?"?([\w$#]+)"?/iu.exec(message)?.[1];
    if (missingTable) {
      if (/^APEX_/iu.test(missingTable)) {
        this.diagnose(
          'info',
          `APEX dictionary view ${missingTable.toUpperCase()} is not available locally`,
          ctx.pageId,
          region.id,
        );
        return false;
      }
      return this.ensureTable(ctx, missingTable, this.regionColumns(ctx, region));
    }
    const missingColumn = /no such column: (?:"?[\w$#]+"?\.)?"?([\w$#]+)"?/iu.exec(message)?.[1];
    if (!missingColumn) return false;
    const column = missingColumn.toUpperCase();
    const referenced = [...this.#autoTables].filter((table) =>
      new RegExp(`\\b"?${table}"?\\b`, 'iu').test(sql),
    );
    for (const table of referenced) {
      if (this.db.tableColumns(table).some((existing) => existing.name === column)) continue;
      const numeric = /(_ID|ID|_NO|COUNT|TOTAL|AMOUNT|PRICE|QTY|QUANTITY|SALARY|SAL|VALUE|NUMBER)$/u.test(
        column,
      );
      const date = /(DATE|_ON|_AT|TIMESTAMP)$/u.test(column);
      this.db.execute(
        `alter table "${table}" add column "${column}" ${numeric ? 'NUMBER' : date ? 'DATE' : 'VARCHAR2(4000)'}`,
      );
      this.db.execute(
        `update "${table}" set "${column}" = ${numeric ? 'rowid' : date ? "date('now', '-' || rowid || ' days')" : `'${heading(column).replaceAll("'", "''")} ' || rowid`}`,
      );
      this.diagnose(
        'info',
        `Added sample column ${column} to auto-created table ${table}`,
        ctx.pageId,
        region.id,
      );
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- page processing

  /** Before-header computations and form initialization. */
  prepare(session: Session, pageKey: string, request = ''): RenderContext {
    const page = this.findPage(pageKey);
    if (!page) throw new Error(`Page ${pageKey} does not exist`);
    const ctx: RenderContext = {
      session,
      page,
      pageId: page.id,
      request,
      onload: [],
      jsFiles: new Set(),
      cssFiles: new Set(),
      clientConfig: { regions: [], dynamicActions: [] },
      itemErrors: new Map(),
      messageTemplates: {},
    };
    for (const item of this.pageComponents(ctx, 'pageItem')) {
      const name = item.id.toUpperCase();
      if ((session.items[name] ?? '') !== '') continue;
      const type = str(item.props, 'default.type');
      const value = str(item.props, 'default.staticValue') || str(item.props, 'default.value');
      if (value && (type === '' || type === 'static' || type === 'staticValue'))
        session.items[name] = this.substitute(session, value, page, 'RAW');
      // hook: PL/SQL defaults and item references are evaluated by extensions (extensions/server.ts)
      else if (type === 'item')
        session.items[name] = session.items[str(item.props, 'default.item').toUpperCase()] ?? '';
      else if (
        type === 'functionBody' ||
        type === 'sqlQuerySingleValue' ||
        (type === 'expression' && str(item.props, 'default.plsqlExpression'))
      ) {
        const code =
          str(item.props, 'default.plsqlFunctionBody') ||
          str(item.props, 'default.plsqlExpression') ||
          str(item.props, 'default.sqlQuerySingleValue');
        const language =
          type === 'functionBody'
            ? 'plsqlFunctionBody'
            : type === 'expression'
              ? 'plsqlExpression'
              : 'sqlExpression';
        const result = evaluateExpression(
          this,
          ctx,
          type === 'sqlQuerySingleValue' ? `(${code})` : code,
          language,
        );
        if (result === undefined) this.diagnose('info', `Default for ${name} not evaluated`, page.id, name);
        else session.items[name] = result === null || result === false ? '' : String(result);
      } else if (type === 'sqlQuery' || type === 'expression') {
        const sql = str(item.props, 'default.sqlQuery') || str(item.props, 'default.sqlExpression');
        if (sql) {
          try {
            session.items[name] = String(
              this.db.scalar(sql.startsWith('select') ? sql : `select ${sql}`, this.binds(session, page)) ??
                '',
            );
          } catch {
            this.diagnose('info', `Default for ${name} not evaluated`, page.id, name);
          }
        }
      }
    }
    // hook: application computations/processes and authorization (extensions/server.ts)
    const pointErrors = runPointExtensions(this, ctx, 'beforeHeader');
    if (pointErrors.length) session.errors = [...(session.errors ?? []), ...pointErrors];
    for (const computation of bySequence(this.pageComponents(ctx, 'computation'))) {
      const point = str(computation.props, 'execution.point', 'beforeHeader');
      if (point === 'beforeHeader' && this.condition(ctx, computation.props)) this.compute(ctx, computation);
    }
    for (const process of bySequence(this.pageComponents(ctx, 'process'))) {
      if (str(process.props, 'execution.point') !== 'beforeHeader' || !this.condition(ctx, process.props))
        continue;
      const type = str(process.props, 'type');
      const extension = processHandler(type);
      if (extension) extension(this, ctx, process, 'beforeHeader', undefined);
      else if (type === 'formInitialization') this.initializeForm(ctx, ref(process.props, 'formRegion'));
      else if (type === 'clearSessionState') this.clearPage(ctx);
      else if (type === 'executeCode') this.runCode(ctx, process);
    }
    // hook: after-header/before-regions processing and item sources (extensions/server.ts)
    const headerErrors = runPointExtensions(this, ctx, 'afterHeader');
    if (headerErrors.length) session.errors = [...(session.errors ?? []), ...headerErrors];
    return ctx;
  }

  compute(ctx: RenderContext, computation: ApxComponent): void {
    const item = (
      str(computation.props, 'itemName') ||
      str(computation.props, 'item') ||
      computation.id
    ).toUpperCase();
    const type = str(computation.props, 'computation.type', str(computation.props, 'type'));
    // hook: item, PL/SQL and SQL expression computations are evaluated by extensions (extensions/server.ts)
    if (type === 'item') {
      ctx.session.items[item] =
        ctx.session.items[str(computation.props, 'computation.itemName').toUpperCase()] ?? '';
      return;
    }
    if (type === 'expression' || type === 'functionBody' || type === 'sqlQueryMultipleValues') {
      const code =
        str(computation.props, 'computation.plsqlFunctionBody') ||
        str(computation.props, 'computation.plsqlExpression') ||
        str(computation.props, 'computation.sqlExpression');
      const language =
        type === 'functionBody'
          ? 'plsqlFunctionBody'
          : str(computation.props, 'computation.sqlExpression')
            ? 'sqlExpression'
            : 'plsqlExpression';
      if (type === 'sqlQueryMultipleValues') {
        try {
          const result = this.db.query(
            str(computation.props, 'computation.sqlQuery'),
            this.binds(ctx.session, ctx.page),
          );
          ctx.session.items[item] = result.rows.map((row) => String(row[result.columns[0]!] ?? '')).join(':');
        } catch (error) {
          this.diagnose(
            'warning',
            `Computation ${computation.id} failed: ${(error as Error).message}`,
            ctx.pageId,
          );
        }
        return;
      }
      const result = code ? evaluateExpression(this, ctx, code, language) : undefined;
      if (result !== undefined) {
        ctx.session.items[item] = result === null || result === false ? '' : String(result);
        return;
      }
    }
    const value =
      str(computation.props, 'computation.staticValue') || str(computation.props, 'computation.value');
    const sql = str(computation.props, 'computation.sqlQuery');
    if (type.startsWith('static') || (!sql && value))
      ctx.session.items[item] = this.substitute(ctx.session, value, ctx.page, 'RAW');
    else if (sql) {
      try {
        ctx.session.items[item] = String(this.db.scalar(sql, this.binds(ctx.session, ctx.page)) ?? '');
      } catch (error) {
        this.diagnose(
          'warning',
          `Computation ${computation.id} failed: ${(error as Error).message}`,
          ctx.pageId,
        );
      }
    } else
      this.diagnose('info', `Computation ${computation.id} (${type}) is not evaluated locally`, ctx.pageId);
  }

  formItems(ctx: RenderContext, regionId: string | undefined) {
    return this.pageComponents(ctx, 'pageItem').filter(
      (item) => ref(item.props, 'source.formRegion') === regionId && str(item.props, 'source.column'),
    );
  }

  initializeForm(ctx: RenderContext, regionId: string | undefined): void {
    const region = this.pageComponents(ctx, 'region').find((candidate) => candidate.id === regionId);
    if (!region) return;
    const table = str(region.props, 'source.tableName');
    const items = this.formItems(ctx, regionId);
    const keys = items.filter((item) => bool(item.props, 'source.primaryKey', false));
    if (!table || !keys.length) return;
    this.ensureTable(ctx, table, this.regionColumns(ctx, region));
    if (keys.some((key) => !ctx.session.items[key.id.toUpperCase()])) {
      for (const item of items) if (!keys.includes(item)) delete ctx.session.items[item.id.toUpperCase()];
      return;
    }
    const where = keys
      .map((key) => `"${str(key.props, 'source.column').toUpperCase()}" = :${key.id.toUpperCase()}`)
      .join(' and ');
    const result = this.query(ctx, region, `select * from ${table} where ${where}`, 1);
    const row = result.rows[0];
    if (!row) return;
    for (const item of items) {
      const value = row[str(item.props, 'source.column').toUpperCase()];
      ctx.session.items[item.id.toUpperCase()] = value === null || value === undefined ? '' : String(value);
    }
  }

  clearPage(ctx: RenderContext): void {
    for (const item of ctx.page.children.filter((child) => child.type === 'pageItem'))
      delete ctx.session.items[item.id.toUpperCase()];
  }

  /** PL/SQL cannot run here; bodies made only of SQL DML are executed, anything else is reported. */
  runCode(ctx: RenderContext, process: ApxComponent, codeKey = 'source.plsqlCode'): boolean {
    const code =
      str(process.props, codeKey) ||
      str(process.props, 'settings.plsqlCode') ||
      str(process.props, 'source.code');
    const handled = runCodeExtensions(this, ctx, code, process);
    if (handled !== undefined) return handled;
    const body = code
      .trim()
      .replace(/^begin\b/iu, '')
      .replace(/\bend\s*;\s*$/iu, '')
      .trim();
    const statements = body ? splitScript(body.endsWith(';') ? body : `${body};`) : [];
    if (
      !statements.length ||
      statements.some(
        (statement) =>
          !/^(insert|update|delete|merge)\b/iu.test(statement.trim()) || /\breturning\b/iu.test(statement),
      )
    ) {
      this.diagnose(
        'info',
        `PL/SQL in ${process.type} ${process.id} was skipped (only plain DML runs locally)`,
        ctx.pageId,
        process.id,
      );
      return false;
    }
    try {
      for (const statement of statements) this.db.execute(statement, this.binds(ctx.session, ctx.page));
      return true;
    } catch (error) {
      this.diagnose(
        'warning',
        `DML in ${process.id} failed: ${(error as Error).message}`,
        ctx.pageId,
        process.id,
      );
      return false;
    }
  }

  // ---------------------------------------------------------------- submit

  isLoginPage(pageKey: string): boolean {
    const page = this.findPage(pageKey);
    return Boolean(page) && this.pageTemplateId(page!) === 'login';
  }

  /** Any credentials sign in locally; the username becomes APP_USER. */
  login(session: Session, values: Record<string, string>): { redirectURL: string } {
    const username = Object.entries(values).find(([name]) =>
      /USERNAME$|USER_NAME$/u.test(name.toUpperCase()),
    )?.[1];
    session.user = (username || 'DEVELOPER').toUpperCase();
    const home = this.findPage(this.homePage());
    return { redirectURL: home ? this.pagePath(home) : this.baseUrl };
  }

  /** Implements `wwv_flow.accept` for apex.page.submit (reload on submit = "S"). */
  accept(
    session: Session,
    pageKey: string,
    request: string,
    values: Record<string, string>,
  ): { redirectURL?: string; errors?: ApexError[] } {
    const ctx = this.prepareSubmit(session, pageKey, request);
    for (const [name, value] of Object.entries(values)) session.items[name.toUpperCase()] = value;
    const pressed = this.pageComponents(ctx, 'button').find(
      (button) => str(button.props, 'buttonName', button.id.toUpperCase()) === request,
    );
    // hook: after-submit computations and application processes (extensions/server.ts)
    const submitErrors = runPointExtensions(this, ctx, 'afterSubmit');
    if (submitErrors.length) return { errors: submitErrors };
    const validate = pressed ? bool(pressed.props, 'behavior.executeValidations', true) : true;
    const errors = validate ? this.validate(ctx) : [];
    if (errors.length) return { errors };
    const processingErrors = runPointExtensions(this, ctx, 'processing');
    if (processingErrors.length) return { errors: processingErrors };

    let closeDialog = false;
    let success = '';
    for (const process of bySequence(this.pageComponents(ctx, 'process'))) {
      const point = str(process.props, 'execution.point', 'processing');
      if (point !== 'processing' && point !== 'afterSubmit' && point !== 'onSubmitBeforeComputations')
        continue;
      if (!this.whenButton(ctx, process.props) || !this.condition(ctx, process.props)) continue;
      const type = str(process.props, 'type');
      let ran = true;
      const extension = processHandler(type);
      if (extension) {
        const result = extension(this, ctx, process, 'submit', pressed);
        if (result.errors?.length) return { errors: result.errors };
        if (result.redirectURL) return { redirectURL: result.redirectURL };
        ran = result.ran;
        if (result.closeDialog) closeDialog = true;
      } else if (type === 'formAutoRowProcessing')
        ran = this.processForm(ctx, ref(process.props, 'formRegion'), pressed);
      else if (type === 'closeDialog') closeDialog = true;
      else if (type === 'clearSessionState') this.clearPage(ctx);
      else if (type === 'executeCode') ran = this.runCode(ctx, process);
      else if (type === 'formInitialization') this.initializeForm(ctx, ref(process.props, 'formRegion'));
      else {
        ran = false;
        this.diagnose(
          'info',
          `Process type ${type} (${process.id}) is not simulated`,
          ctx.pageId,
          process.id,
        );
      }
      const message =
        str(process.props, 'successMessage.successMessage') ||
        str(process.props, 'successMessage') ||
        str(process.props, 'messages.successMessage');
      if (ran && message) success = this.substitute(session, message, ctx.page, 'RAW');
    }
    if (pressed && str(pressed.props, 'behavior.successMessage'))
      success = str(pressed.props, 'behavior.successMessage');
    if (success) session.success = success;
    if (closeDialog)
      return {
        redirectURL: `${this.baseUrl}${LOCAL_PREFIX}/close-dialog?page=${encodeURIComponent(ctx.pageId)}`,
      };

    for (const branch of bySequence(this.pageComponents(ctx, 'branch'))) {
      if (!this.whenButton(ctx, branch.props) || !this.condition(ctx, branch.props)) continue;
      // hook: computed branch targets (extensions/server.ts evaluates the PL/SQL)
      const branchType = str(branch.props, 'behavior.type');
      if (branchType === 'plsqlProcedure') {
        runCodeExtensions(this, ctx, str(branch.props, 'behavior.plsqlCode'), branch);
        continue;
      }
      if (branchType === 'functionReturningPage' || branchType === 'functionReturningUrl') {
        const result = evaluateExpression(
          this,
          ctx,
          str(branch.props, 'behavior.plsqlFunctionBody'),
          'plsqlFunctionBody',
        );
        if (result === undefined || result === null || result === '') continue;
        const page = branchType === 'functionReturningPage' ? this.findPage(String(result)) : undefined;
        return {
          redirectURL: page ? this.pagePath(page) : this.substitute(session, String(result), ctx.page, 'RAW'),
        };
      }
      if (branchType === 'page' || branchType === 'pageIdentifiedByItem') {
        const key =
          branchType === 'page'
            ? str(branch.props, 'behavior.pageNumber')
            : (session.items[str(branch.props, 'behavior.item').toUpperCase()] ?? '');
        const page = this.findPage(key);
        if (page) return { redirectURL: this.pagePath(page) };
        continue;
      }
      const target = get(branch.props, 'behavior.target');
      if (target !== undefined) return { redirectURL: this.targetUrl(ctx, target).href };
    }
    if (pressed && str(pressed.props, 'behavior.action') === 'redirectThisApp') {
      return { redirectURL: this.targetUrl(ctx, get(pressed.props, 'behavior.target')).href };
    }
    return { redirectURL: this.pagePath(ctx.page) };
  }

  prepareSubmit(session: Session, pageKey: string, request: string): RenderContext {
    const page = this.findPage(pageKey);
    if (!page) throw new Error(`Page ${pageKey} does not exist`);
    return {
      session,
      page,
      pageId: page.id,
      request,
      onload: [],
      jsFiles: new Set(),
      cssFiles: new Set(),
      clientConfig: { regions: [], dynamicActions: [] },
      itemErrors: new Map(),
      messageTemplates: {},
    };
  }

  label(item: ApxComponent): string {
    return str(item.props, 'label.label', heading(item.id.replace(/^P\d+_/u, '')));
  }

  validate(ctx: RenderContext): ApexError[] {
    const errors: ApexError[] = [];
    const add = (message: string, item?: string) =>
      errors.push({
        type: 'error',
        location: item ? ['inline', 'page'] : ['page'],
        ...(item ? { pageItem: item } : {}),
        message,
        unsafe: false,
      });
    for (const item of this.pageComponents(ctx, 'pageItem')) {
      if (!this.visible(ctx, item) || !this.regionVisible(ctx, ref(item.props, 'layout.region'))) continue;
      const name = item.id.toUpperCase();
      const value = ctx.session.items[name] ?? '';
      const label = this.label(item);
      if (bool(item.props, 'validation.valueRequired', false) && value === '')
        add(`${label} must have some value.`, name);
      const max = num(item.props, 'validation.maxLength', 0);
      if (max && value.length > max) add(`${label} exceeds the maximum length of ${max}.`, name);
      if (
        str(item.props, 'type') === 'numberField' &&
        value !== '' &&
        // Number items submit their formatted text (format mask), as APEX does.
        !Number.isFinite(Number(value.replace(/[,\s$€£¥%]/gu, '')))
      )
        add(`${label} must be Numeric.`, name);
    }
    for (const validation of bySequence(this.pageComponents(ctx, 'validation'))) {
      if (!this.whenButton(ctx, validation.props) || !this.condition(ctx, validation.props)) continue;
      const type = str(validation.props, 'validation.type');
      const item = str(validation.props, 'validation.item').toUpperCase();
      const message = str(validation.props, 'error.errorMessage', `${validation.id} failed`);
      const value = ctx.session.items[item] ?? '';
      const associated = str(validation.props, 'error.associatedItem').toUpperCase() || item || undefined;
      let failed: boolean | undefined;
      const extension = validationHandler(type)?.(this, ctx, validation);
      if (extension !== undefined) {
        if (extension !== null) add(this.substitute(ctx.session, extension, ctx.page, 'RAW'), associated);
        continue;
      }
      if (type === 'itemIsNotNull' || type === 'itemNotNull') failed = value === '';
      else if (type === 'itemIsNumeric') failed = value !== '' && !Number.isFinite(Number(value));
      else if (type === 'itemIsADate') failed = value !== '' && Number.isNaN(new Date(value).getTime());
      else if (
        type === 'rowsReturned' ||
        type === 'noRowsReturned' ||
        type === 'exists' ||
        type === 'notExists'
      ) {
        try {
          const found =
            this.db.query(str(validation.props, 'validation.sqlQuery'), this.binds(ctx.session, ctx.page), 1)
              .rows.length > 0;
          failed = type === 'rowsReturned' || type === 'exists' ? !found : found;
        } catch {
          failed = undefined;
        }
      }
      if (failed === undefined)
        this.diagnose(
          'info',
          `Validation ${validation.id} (${type}) is not evaluated locally`,
          ctx.pageId,
          validation.id,
        );
      else if (failed) add(this.substitute(ctx.session, message, ctx.page, 'RAW'), associated);
    }
    return errors;
  }

  regionVisible(ctx: RenderContext, regionId: string | undefined): boolean {
    if (!regionId) return true;
    const region = this.pageComponents(ctx, 'region').find((candidate) => candidate.id === regionId);
    if (!region) return true;
    return this.visible(ctx, region) && this.regionVisible(ctx, ref(region.props, 'layout.parentRegion'));
  }

  processForm(ctx: RenderContext, regionId: string | undefined, pressed: ApxComponent | undefined): boolean {
    const region = this.pageComponents(ctx, 'region').find((candidate) => candidate.id === regionId);
    if (!region) return false;
    const table = str(region.props, 'source.tableName');
    if (!table) {
      this.diagnose('info', `Form ${regionId} has no table; DML skipped`, ctx.pageId, regionId);
      return false;
    }
    this.ensureTable(ctx, table, this.regionColumns(ctx, region));
    const items = this.formItems(ctx, regionId).filter(
      (item) => !bool(item.props, 'source.queryOnly', false) || bool(item.props, 'source.primaryKey', false),
    );
    const keys = items.filter((item) => bool(item.props, 'source.primaryKey', false));
    const columns = new Set(this.db.tableColumns(table).map((column) => column.name));
    const action = pressed ? str(pressed.props, 'behavior.databaseAction') : '';
    const request = ctx.request;
    const operation =
      action === 'insert' || /^(CREATE|INSERT|ADD)$/u.test(request)
        ? 'insert'
        : action === 'update' || /^(SAVE|APPLY CHANGES|UPDATE)$/u.test(request)
          ? 'update'
          : action === 'delete' || /^(DELETE|REMOVE)$/u.test(request)
            ? 'delete'
            : '';
    if (!operation) return false;
    const binds = this.binds(ctx.session, ctx.page);
    const column = (item: ApxComponent) => str(item.props, 'source.column').toUpperCase();
    const where = keys.map((key) => `"${column(key)}" = :${key.id.toUpperCase()}`).join(' and ');
    try {
      if (operation === 'insert') {
        const values = items.filter(
          (item) =>
            columns.has(column(item)) && !(keys.includes(item) && !ctx.session.items[item.id.toUpperCase()]),
        );
        for (const key of keys) {
          const name = key.id.toUpperCase();
          if (!ctx.session.items[name]) {
            const next = this.db.scalar(`select coalesce(max("${column(key)}"), 0) + 1 from ${table}`);
            ctx.session.items[name] = String(next);
            binds[name] = String(next);
            values.push(key);
          }
        }
        this.db.execute(
          `insert into ${table} (${values.map((item) => `"${column(item)}"`).join(', ')}) values (${values.map((item) => `:${item.id.toUpperCase()}`).join(', ')})`,
          binds,
        );
        ctx.session.success = 'Action Processed.';
      } else if (operation === 'update' && where) {
        const values = items.filter((item) => !keys.includes(item) && columns.has(column(item)));
        if (values.length)
          this.db.execute(
            `update ${table} set ${values.map((item) => `"${column(item)}" = :${item.id.toUpperCase()}`).join(', ')} where ${where}`,
            binds,
          );
        ctx.session.success = 'Action Processed.';
      } else if (operation === 'delete' && where) {
        this.db.execute(`delete from ${table} where ${where}`, binds);
        ctx.session.success = 'Action Processed.';
      }
      return true;
    } catch (error) {
      this.diagnose(
        'error',
        `Automatic row processing on ${table} failed: ${(error as Error).message}`,
        ctx.pageId,
        regionId,
      );
      return false;
    }
  }

  /** Server half of the local "Execute Server-side Code" dynamic action. */
  executeServerCode(
    session: Session,
    pageKey: string,
    code: string,
    submitted: Record<string, string>,
    returnItems: string[],
  ): Record<string, string> {
    const ctx = this.prepareSubmit(session, pageKey, '');
    for (const [name, value] of Object.entries(submitted)) session.items[name.toUpperCase()] = value;
    const pseudo: ApxComponent = {
      type: 'dynamicAction',
      id: 'server-side-code',
      props: { source: { plsqlCode: code } },
      children: [],
      file: '',
      line: 0,
    };
    this.runCode(ctx, pseudo);
    return Object.fromEntries(
      returnItems.map((name) => [name.toUpperCase(), session.items[name.toUpperCase()] ?? '']),
    );
  }

  // ---------------------------------------------------------------- rendering

  renderPage(ctx: RenderContext): string {
    const page = ctx.page;
    const templateId = this.pageTemplateId(page);
    const template = this.theme.pages.get(templateId) ?? this.theme.pages.get('standard')!;
    if (!this.theme.pages.has(templateId))
      this.diagnose('warning', `Page template @/${templateId} not found; used Standard`, ctx.pageId);
    const slots = this.theme.slots.get(text(template, 'id')) ?? new Map<string, string>();
    const placeholder = (slot: string) => {
      if (slots.has(slot)) return slots.get(slot)!;
      if (PAGE_DEFAULT_SLOTS.has(slot)) return 'BODY';
      const lower = slot.toLowerCase();
      for (const [name, value] of slots) if (name.toLowerCase() === lower) return value;
      this.diagnose(
        'warning',
        `Slot "${slot}" does not exist in page template ${templateId}; rendered in Body`,
        ctx.pageId,
      );
      return 'BODY';
    };

    const positions = new Map<string, ApxComponent[]>();
    const regions = this.pageComponents(ctx, 'region');
    for (const region of regions) {
      if (ref(region.props, 'layout.parentRegion')) continue;
      const key = placeholder(str(region.props, 'layout.slot', 'body'));
      positions.set(key, [...(positions.get(key) ?? []), region]);
    }
    const pageButtons = this.pageComponents(ctx, 'button').filter(
      (button) => !ref(button.props, 'layout.region'),
    );
    const pageItems = this.pageComponents(ctx, 'pageItem').filter(
      (item) => !ref(item.props, 'layout.region'),
    );

    // Display points without grid support (e.g. the left column) stack regions and ignore column spans.
    const gridless = new Set(
      this.assets.theme
        .filter(
          (call) =>
            call.kind === 'page_tmpl_display_point' &&
            String(call.params.page_template_id) === text(template, 'id') &&
            (call.params.has_grid_support === false || call.params.has_grid_support === 'N'),
        )
        .map((call) => String(call.params.placeholder)),
    );
    const values: Record<string, string> = {};
    for (const [key, list] of positions) {
      const cells = bySequence(list)
        .filter((region) => this.visible(ctx, region))
        .map((region) => ({ component: region, html: this.renderRegion(ctx, region) }));
      values[key] = gridless.has(key)
        ? cells.map((cell) => cell.html).join('\n')
        : this.grid(template, cells);
    }
    for (const button of bySequence(pageButtons)) {
      if (!this.visible(ctx, button)) continue;
      const key = placeholder(str(button.props, 'layout.slot', 'body'));
      values[key] = (values[key] ?? '') + this.renderButton(ctx, button);
    }
    if (pageItems.length) values.BODY = (values.BODY ?? '') + this.itemsGrid(ctx, template, pageItems);

    const pageOptions = templateOptions(
      strings(list(page.props, 'appearance.templateOptions')),
      text(template, 'default_template_options'),
    );
    const themeComponent = this.themeComponent();
    const styleId = (
      ctx.session.themeStyle ??
      ref(themeComponent?.props ?? {}, 'style.currentThemeStyle') ??
      defaultStaticId(this.theme, 'current_theme_style_id', 'vita')
    ).toLowerCase();
    const style = this.theme.styles.get(styleId) ?? this.theme.styles.get('vita');
    if (!this.theme.styles.has(styleId))
      this.diagnose('info', `Theme style ${styleId} not found; used Vita`, ctx.pageId);

    const css = [
      `${IMAGE_PREFIX}app_ui/css/Core.min.css?v=${APEX_FULL_VERSION}`,
      `${IMAGE_PREFIX}libraries/font-apex/2.5.1/css/font-apex.min.css?v=${APEX_FULL_VERSION}`,
    ];
    const themeCss = strings(list(themeComponent?.props ?? {}, 'css.fileUrls'));
    const themeFiles = themeCss.length
      ? themeCss
      : text(this.theme.theme, 'css_file_urls').split('\n').filter(Boolean);
    const styleCss = [
      ...text(style, 'css_file_urls').split('\n'),
      text(style, 'theme_roller_output_file_url'),
    ].filter(Boolean);
    const appCss = strings(list(this.app.app.props, 'css.fileUrls'));
    const pageCss = strings(list(page.props, 'css.fileUrls'));
    const inlineCss = [str(this.app.app.props, 'css.inline'), str(page.props, 'css.inline')].filter(Boolean);

    const themeJs = strings(list(themeComponent?.props ?? {}, 'javaScript.fileUrls'));
    const themeJsFiles = themeJs.length
      ? themeJs
      : text(this.theme.theme, 'javascript_file_urls').split('\n').filter(Boolean);
    const appJs = strings(list(this.app.app.props, 'javaScript.fileUrls'));
    const pageJs = strings(list(page.props, 'javaScript.fileUrls'));

    this.navigation(ctx, values, template);
    const link = (url: string) =>
      `<link rel="stylesheet" href="${escapeHtml(this.urls(url))}" type="text/css" />`;
    const script = (url: string) => `<script src="${escapeHtml(this.urls(url))}"></script>`;
    const env = {
      APP_USER: ctx.session.user,
      APP_ID: this.appId,
      APP_PAGE_ID: page.id,
      APP_SESSION: ctx.session.id,
      APP_FILES: `${this.baseUrl}/files/static/v1/`,
      WORKSPACE_FILES: `${this.baseUrl}/files/workspace/`,
      APEX_VERSION: APEX_FULL_VERSION,
      APEX_BASE_VERSION: APEX_FULL_VERSION.split('.').slice(0, 2).join('.'),
    };
    for (const extension of extensions) extension.page?.(this, ctx);
    for (const action of this.pageComponents(ctx, 'dynamicAction')) {
      if (this.visible(ctx, action)) ctx.clientConfig.dynamicActions.push(this.dynamicAction(ctx, action));
    }
    const pageTemplate = text(template, 'id');
    ctx.messageTemplates[`${pageTemplate}_S`] = text(template, 'success_message');
    ctx.messageTemplates[`${pageTemplate}_E`] = text(template, 'notification_message');
    const onload = [
      `apex.message.registerTemplates(${JSON.stringify(Object.fromEntries(Object.entries(ctx.messageTemplates).map(([id, markup]) => [id, this.substitute(ctx.session, markup, page, 'HTML')]))).replaceAll('<', '\\u003c')});`,
      text(template, 'javascript_code_onload'),
      ...ctx.onload,
      `apexLocal.init(${JSON.stringify(ctx.clientConfig).replaceAll('<', '\\u003c')});`,
      this.substitute(ctx.session, str(this.app.app.props, 'javaScript.executeWhenPageLoads'), page, 'RAW'),
      this.substitute(ctx.session, str(page.props, 'javaScript.executeWhenPageLoads'), page, 'RAW'),
      // The server-generated init must end with apexreadyend; Universal Theme initializes on it.
      "apex.event.trigger(apex.gPageContext$, 'apexreadyend');",
    ].filter(Boolean);
    const functions = [
      str(this.app.app.props, 'javaScript.functionAndGlobalVariableDeclaration'),
      str(page.props, 'javaScript.functionAndGlobalVariableDeclaration'),
    ].filter(Boolean);
    const hidden = (name: string, id: string, value: string) =>
      `<input type="hidden" name="${name}" value="${escapeHtml(value)}" id="${id}" />`;
    const success = ctx.session.success;
    const errors = ctx.session.errors;
    ctx.session.success = undefined;
    ctx.session.errors = undefined;
    const builtins: Record<string, string> = {
      TITLE: escapeHtml(
        this.substitute(ctx.session, str(page.props, 'title', str(page.props, 'name')), page, 'RAW'),
      ),
      APEX_CSS: css.map(link).join('\n'),
      THEME_CSS: themeFiles.map(link).join('\n'),
      TEMPLATE_CSS: [...ctx.cssFiles].map(link).join('\n'),
      THEME_STYLE_CSS: styleCss.map(link).join('\n'),
      APPLICATION_CSS: appCss.map(link).join('\n'),
      PAGE_CSS: [
        ...pageCss.map(link),
        ...inlineCss.map((code) => `<style>\n${code}\n</style>`),
        `<link rel="stylesheet" href="${LOCAL_PREFIX}/runtime.css" />`,
      ].join('\n'),
      FAVICONS: this.favicons(),
      HEAD: '',
      PAGE_CSS_CLASSES: [pageOptions, str(page.props, 'appearance.cssClasses')].filter(Boolean).join(' '),
      DIALOG_CSS_CLASSES: '',
      ONLOAD: '',
      TEXT_DIRECTION: '',
      RTL_CLASS: '',
      FORM_OPEN: [
        `<form action="wwv_flow.accept" method="post" name="wwv_flow" id="wwvFlowForm" data-oj-binding-provider="none" novalidate autocomplete="off">`,
        hidden('p_flow_id', 'pFlowId', this.appId),
        hidden('p_flow_step_id', 'pFlowStepId', page.id),
        hidden('p_instance', 'pInstance', ctx.session.id),
        hidden('p_debug', 'pdebug', ''),
        hidden('p_request', 'pRequest', ''),
        hidden('p_reload_on_submit', 'pReloadOnSubmit', 'S'),
        hidden('p_page_submission_id', 'pPageSubmissionId', String(Date.now())),
      ].join('\n'),
      FORM_CLOSE: [
        `<input type="hidden" id="pSalt" value="local" />`,
        `<input type="hidden" id="pPageItemsRowVersion" value="" />`,
        `<input type="hidden" id="pPageItemsProtected" value="" />`,
        `<input type="hidden" id="pPageFormRegionChecksums" value="[]" />`,
        '</form>',
      ].join('\n'),
      DEVELOPER_TOOLBAR: this.options.toolbar && !this.isDialog(page) ? this.toolbar(ctx) : '',
      APEX_JAVASCRIPT: [
        `<script>var apex_img_dir = "${IMAGE_PREFIX}", htmldb_Img_Dir = apex_img_dir; window.apex = { env: ${JSON.stringify(env)} };</script>`,
        script(`#APEX_FILES#libraries/apex/#MIN_DIRECTORY#desktop_all#MIN#.js?v=#APEX_VERSION#`),
        `<script src="${LOCAL_PREFIX}/messages.js"></script>`,
        `<script src="${LOCAL_PREFIX}/runtime.js"></script>`,
      ].join('\n'),
      GENERATED_CSS: '',
      THEME_JAVASCRIPT: themeJsFiles.map(script).join('\n'),
      TEMPLATE_JAVASCRIPT: [...ctx.jsFiles].map(script).join('\n'),
      APPLICATION_JAVASCRIPT: [
        ...appJs.map(script),
        ...functions.map((code) => `<script>\n${code}\n</script>`),
      ].join('\n'),
      PAGE_JAVASCRIPT: pageJs.map(script).join('\n'),
      GENERATED_JAVASCRIPT: `<script>\napex.jQuery( function() {\n apex.page.init( this, function() {\n  try {\n${onload.join('\n')}\n  } catch( e ) { apex.debug.error( e ); }\n });\n});\n</script>`,
      // apex.message finds these placeholders and the registered sub-templates by ID.
      SUCCESS_MESSAGE: `<span id="APEX_SUCCESS_MESSAGE" data-template-id="${pageTemplate}_S" class="apex-page-success${success ? '' : ' u-hidden'}">${
        success
          ? fill(text(template, 'success_message'), {
              SUCCESS_MESSAGE: escapeHtml(success),
              SUCCESS_MESSAGE_HEADING: 'Success',
              CLOSE_NOTIFICATION: 'Close',
            })
          : ''
      }</span>`,
      NOTIFICATION_MESSAGE: `<span id="APEX_ERROR_MESSAGE" data-template-id="${pageTemplate}_E" class="apex-page-error${errors?.length ? '' : ' u-hidden'}">${
        errors?.length
          ? fill(text(template, 'notification_message'), {
              MESSAGE: errors.map((error) => escapeHtml(error.message)).join('<br>'),
              ERROR_MESSAGE_HEADING: 'Error',
              CLOSE_NOTIFICATION: 'Close',
            })
          : ''
      }</span>`,
      GLOBAL_NOTIFICATION: '',
      LOGO: this.logo(ctx),
      HOME_LINK: this.pagePath(this.findPage(this.homePage()) ?? page),
      APP_VERSION: '',
      CUSTOMIZE: '',
      BUILT_WITH_LOVE_USING_APEX: '',
      BACKGROUND_IMAGE: '',
      ...values,
    };
    const html = fill(
      `${text(template, 'header_template')}${text(template, 'box')}${text(template, 'footer_template')}`,
      builtins,
    );
    return this.substitute(ctx.session, html, page, 'HTML');
  }

  favicons(): string {
    const icon = this.app.files.length ? `${this.baseUrl}/files/static/v1/icons/app-icon-32.png` : '';
    const exists = fs.existsSync(
      path.join(this.app.root, 'shared-components', 'static-files', 'icons', 'app-icon-32.png'),
    );
    return icon && exists ? `<link rel="icon" sizes="32x32" href="${icon}">` : '';
  }

  logo(ctx: RenderContext): string {
    const type = str(this.app.app.props, 'logo.type', 'text');
    const value = str(this.app.app.props, 'logo.text', str(this.app.app.props, 'name'));
    const image = str(this.app.app.props, 'logo.imageUrl') || str(this.app.app.props, 'logo.image');
    const label = `<span class="apex-logo-text">${escapeHtml(this.substitute(ctx.session, value, ctx.page, 'RAW'))}</span>`;
    if (type === 'image' && image)
      return `<img src="${escapeHtml(this.urls(image))}" alt="" class="apex-logo-img">`;
    if (type === 'imageAndText' && image)
      return `<img src="${escapeHtml(this.urls(image))}" alt="" class="apex-logo-img">${label}`;
    return label;
  }

  toolbar(ctx: RenderContext): string {
    const own = this.diagnostics.filter((diagnostic) => !diagnostic.page || diagnostic.page === ctx.pageId);
    const counts = (level: Diagnostic['level']) =>
      own.filter((diagnostic) => diagnostic.level === level).length;
    const items = own
      .slice(0, 40)
      .map((diagnostic) => `<li class="is-${diagnostic.level}">${escapeHtml(diagnostic.message)}</li>`)
      .join('');
    const current = (ctx.session.themeStyle ?? '').toLowerCase();
    const styles = [...this.theme.styles.entries()]
      .map(
        ([id, style]) =>
          `<option value="${escapeHtml(id)}"${id === current ? ' selected' : ''}>${escapeHtml(text(style, 'name') || id)}</option>`,
      )
      .join('');
    const picker = `<label class="apex-local-style">Theme style <select onchange="location.search='apex_theme_style='+encodeURIComponent(this.value)"><option value="">Application default</option>${styles}</select></label>`;
    const tools = extensions.map((extension) => extension.toolbar?.(this, ctx) ?? '').join('');
    return `<details class="apex-local-toolbar" id="apexLocalToolbar"><summary>APEX local · page ${escapeHtml(ctx.pageId)} · ${counts('error')} errors · ${counts('warning')} warnings · ${counts('info')} notes</summary>${picker}${tools}<ul>${items || '<li>No diagnostics</li>'}</ul></details>`;
  }

  navigation(ctx: RenderContext, values: Record<string, string>, template: TemplateParams): void {
    const app = this.app.app.props;
    const box = `${text(template, 'header_template')}${text(template, 'box')}`;
    // A page can override the application's navigation menu (overrideUserInterfaceLevel).
    const nav = bool(ctx.page.props, 'navigationMenu.overrideUserInterfaceLevel', false)
      ? ctx.page.props
      : app;
    const menu = this.shared('list', ref(nav, 'navigationMenu.list'));
    if (
      menu &&
      (box.includes('#SIDE_GLOBAL_NAVIGATION_LIST#') || box.includes('#TOP_GLOBAL_NAVIGATION_LIST#'))
    ) {
      const theme = this.themeComponent();
      const position = str(
        nav,
        'navigationMenu.listPosition',
        str(
          nav,
          'navigationMenu.position',
          str(theme?.props ?? {}, 'componentDefaults.navigationMenuListPosition', 'side'),
        ),
      );
      const fallback = position === 'top' ? 'top-navigation-menu' : 'side-navigation-menu';
      const templateId = (ref(nav, 'navigationMenu.listTemplate') ?? fallback).toLowerCase();
      const options = strings(list(nav, 'navigationMenu.templateOptions'));
      const html = this.renderList(ctx, menu, templateId, options, 't_TreeNav');
      if (templateId.includes('side') && box.includes('#SIDE_GLOBAL_NAVIGATION_LIST#'))
        values.SIDE_GLOBAL_NAVIGATION_LIST = html;
      else values.TOP_GLOBAL_NAVIGATION_LIST = html;
    }
    const bar = this.shared('list', ref(app, 'navigationBar.list'));
    if (bar && box.includes('#NAVIGATION_BAR#')) {
      const templateId = (ref(app, 'navigationBar.listTemplate') ?? 'navigation-bar').toLowerCase();
      values.NAVIGATION_BAR = this.renderList(
        ctx,
        bar,
        templateId,
        strings(list(app, 'navigationBar.templateOptions')),
        'navigation_bar',
      );
    }
  }

  /** Fixed 12-column grid using the page template's container/row/column templates. */
  grid(template: TemplateParams, cells: { component: ApxComponent; html: string }[]): string {
    if (!cells.length) return '';
    const rows: { component: ApxComponent; html: string }[][] = [];
    for (const cell of cells) {
      const startNewRow =
        bool(cell.component.props, 'layout.startNewRow', true) &&
        bool(cell.component.props, 'layout.newRow', true);
      if (!rows.length || startNewRow) rows.push([cell]);
      else rows.at(-1)!.push(cell);
    }
    const max = Number(text(template, 'grid_max_columns')) || 12;
    const containerTemplate = text(template, 'grid_template') || '<div class="container">#ROWS#</div>';
    const rowTemplate =
      text(template, 'grid_row_template') || '<div class="row #CSS_CLASSES#">#COLUMNS#</div>';
    const columnTemplate =
      text(template, 'grid_column_template') ||
      '<div class="col col-#COLUMN_SPAN_NUMBER# #CSS_CLASSES#" #ATTRIBUTES#>#CONTENT#</div>';
    const html = rows
      .map((row) => {
        const explicit = row.reduce(
          (sum, cell) => sum + num(cell.component.props, 'layout.columnSpan', 0),
          0,
        );
        const automatic = row.filter((cell) => !num(cell.component.props, 'layout.columnSpan', 0)).length;
        const share = automatic ? Math.max(1, Math.floor((max - explicit) / automatic)) : 0;
        const columns = row
          .map((cell, index) => {
            const span = num(cell.component.props, 'layout.columnSpan', share) || max;
            const firstLast = [
              index === 0 ? text(template, 'grid_first_column_attributes') : '',
              index === row.length - 1 ? text(template, 'grid_last_column_attributes') : '',
            ]
              .filter(Boolean)
              .join(' ');
            return fill(columnTemplate, {
              COLUMN_SPAN_NUMBER: String(Math.min(max, span)),
              CSS_CLASSES: num(cell.component.props, 'layout.columnSpan', 0) ? '' : 'apex-col-auto',
              FIRST_LAST_COLUMN_ATTRIBUTES: firstLast,
              ATTRIBUTES: '',
              CONTENT: cell.html,
            });
          })
          .join('\n');
        return fill(rowTemplate, { CSS_CLASSES: '', COLUMNS: columns });
      })
      .join('\n');
    return fill(containerTemplate, { ROWS: html });
  }

  itemsGrid(ctx: RenderContext, template: TemplateParams, items: ApxComponent[]): string {
    const visible = bySequence(items).filter((item) => this.visible(ctx, item));
    const hidden = visible.filter((item) => str(item.props, 'type') === 'hidden');
    const shown = visible.filter((item) => str(item.props, 'type') !== 'hidden');
    return (
      this.grid(
        template,
        shown.map((item) => ({ component: item, html: this.renderItem(ctx, item) })),
      ) + hidden.map((item) => this.renderItem(ctx, item)).join('')
    );
  }

  pageTemplate(ctx: RenderContext): TemplateParams {
    return this.theme.pages.get(this.pageTemplateId(ctx.page)) ?? this.theme.pages.get('standard')!;
  }

  // ---------------------------------------------------------------- regions

  regionTemplateId(region: ApxComponent): string {
    const explicit = ref(region.props, 'appearance.template');
    if (explicit) return explicit.toLowerCase();
    const type = str(region.props, 'type');
    const theme = this.themeComponent();
    const defaults = theme?.props ?? {};
    if (type === 'breadcrumb')
      return (ref(defaults, 'regionDefaults.breadcrumbs') ?? 'title-bar').toLowerCase();
    if (type === 'interactiveReport' || type === 'interactiveGrid')
      return (ref(defaults, 'regionDefaults.interactiveReports') ?? 'interactive-report').toLowerCase();
    return (
      ref(defaults, 'componentDefaults.region') ??
      defaultStaticId(this.theme, 'default_region_template', 'standard')
    ).toLowerCase();
  }

  regionDomId(region: ApxComponent): string {
    return (
      str(region.props, 'advanced.htmlDomId') || str(region.props, 'advanced.staticId') || slug(region.id)
    );
  }

  renderRegion(ctx: RenderContext, region: ApxComponent): string {
    const templateId = this.regionTemplateId(region);
    const template = this.theme.regions.get(templateId) ?? this.theme.regions.get('standard')!;
    if (!this.theme.regions.has(templateId))
      this.diagnose(
        'warning',
        `Region template @/${templateId} not found; used Standard`,
        ctx.pageId,
        region.id,
      );
    const slots = this.theme.slots.get(text(template, 'id')) ?? new Map<string, string>();
    const domId = this.regionDomId(region);
    const values: Record<string, string> = {};
    const append = (slot: string, html: string) => {
      const key = slots.get(slot) ?? (PAGE_DEFAULT_SLOTS.has(slot) ? 'BODY' : slot.toUpperCase());
      values[key] = (values[key] ?? '') + html;
    };
    for (const button of bySequence(
      this.pageComponents(ctx, 'button').filter(
        (candidate) => ref(candidate.props, 'layout.region') === region.id,
      ),
    )) {
      if (this.visible(ctx, button))
        append(str(button.props, 'layout.slot', 'regionBody'), this.renderButton(ctx, button));
    }
    const body = this.regionBody(ctx, region, values);
    const regionItems = this.pageComponents(ctx, 'pageItem').filter(
      (item) => ref(item.props, 'layout.region') === region.id,
    );
    // Items in a template slot other than the body (e.g. the cards sort order) render there.
    const itemSlot = (item: ApxComponent) => slots.get(str(item.props, 'layout.slot')) ?? 'BODY';
    const items = regionItems.filter((item) => itemSlot(item) === 'BODY');
    for (const item of bySequence(regionItems.filter((item) => itemSlot(item) !== 'BODY')))
      values[itemSlot(item)] = (values[itemSlot(item)] ?? '') + this.renderItem(ctx, item);
    const itemsHtml = items.length ? this.itemsGrid(ctx, this.pageTemplate(ctx), items) : '';
    values.BODY = `${body}${values.BODY ?? ''}${itemsHtml}`;
    const children = this.pageComponents(ctx, 'region').filter(
      (child) => ref(child.props, 'layout.parentRegion') === region.id && this.visible(ctx, child),
    );
    const rendered = new Map<string, { component: ApxComponent; html: string }[]>();
    if (children.length) {
      const grouped = new Map<string, ApxComponent[]>();
      for (const child of bySequence(children)) {
        const slot = str(child.props, 'layout.slot', 'subRegions');
        grouped.set(slot, [...(grouped.get(slot) ?? []), child]);
      }
      for (const [slot, group] of grouped) {
        const key = slots.get(slot) ?? (slot === 'regionBody' ? 'SUB_REGIONS' : slot.toUpperCase());
        const cells = group.map((child) => ({ component: child, html: this.renderRegion(ctx, child) }));
        rendered.set(key, [...(rendered.get(key) ?? []), ...cells]);
        values[key] = (values[key] ?? '') + this.grid(this.pageTemplate(ctx), cells);
      }
    }
    const options = templateOptions(
      strings(list(region.props, 'appearance.templateOptions')),
      text(template, 'default_template_options'),
    );
    const icon = iconClasses(
      str(region.props, 'appearance.icon') || str(region.props, 'icon.iconCssClasses'),
    );
    const image = str(region.props, 'image.fileUrl');
    const title = this.substitute(
      ctx.session,
      str(region.props, 'title', str(region.props, 'name')),
      ctx.page,
      'HTML',
    );
    const filled: Record<string, string> = {
      ...values,
      TITLE: title,
      REGION_TITLE: title,
      DOM_ID: domId,
      REGION_STATIC_ID: domId,
      REGION_ID: domId,
      REGION_CSS_CLASSES: [options, str(region.props, 'appearance.cssClasses')].filter(Boolean).join(' '),
      REGION_ATTRIBUTES: this.substitute(
        ctx.session,
        str(region.props, 'advanced.customAttributes'),
        ctx.page,
        'RAW',
      ),
      REGION_LANDMARK_ATTRIBUTES: `role="region" aria-labelledby="${domId}_heading"`,
      ICON_CSS_CLASSES: icon,
      REGION_IMAGE: image
        ? fill(text(template, 'image_template'), {
            REGION_IMAGE_URL: escapeHtml(this.substitute(ctx.session, image, ctx.page, 'RAW')),
          })
        : '',
      REGION_IMAGE_URL: escapeHtml(this.substitute(ctx.session, image, ctx.page, 'RAW')),
    };
    for (let index = extensions.length - 1; index >= 0; index -= 1) {
      const html = extensions[index]!.wrapRegion?.(this, ctx, region, {
        template,
        values: filled,
        children: rendered,
      });
      if (html !== undefined) return html;
    }
    return fill(text(template, 'template'), filled);
  }

  regionBody(ctx: RenderContext, region: ApxComponent, slots: Record<string, string>): string {
    const type = str(region.props, 'type', 'staticContent');
    const extension =
      regionRenderer(type) ?? (type.includes('/') ? regionRenderer(type.split('/')[0]!) : undefined);
    if (extension) return extension(this, ctx, region, slots);
    switch (type) {
      case 'staticContent':
      case 'helpText':
        return this.substitute(
          ctx.session,
          str(region.props, 'source.htmlCode') || str(region.props, 'source.text'),
          ctx.page,
          'RAW',
        );
      case 'form':
        return '';
      case 'classicReport':
        return this.report(ctx, region, 'classic');
      case 'interactiveReport':
      case 'interactiveGrid':
        if (type === 'interactiveGrid')
          this.diagnose(
            'info',
            `Interactive Grid ${region.id} is rendered as a read-only report`,
            ctx.pageId,
            region.id,
          );
        return this.report(ctx, region, 'interactive', slots);
      case 'cards':
        return this.cards(ctx, region);
      case 'list':
        return this.listRegion(ctx, region);
      case 'breadcrumb':
        return this.breadcrumb(ctx, region);
      case 'chart':
        return this.chart(ctx, region);
      default:
        if (type.startsWith('themeTemplateComponent/')) return this.report(ctx, region, 'classic');
        this.diagnose(
          'warning',
          `Region type ${type} (${region.id}) is not simulated; a placeholder is shown`,
          ctx.pageId,
          region.id,
        );
        return `<div class="apex-local-unsupported"><span class="fa fa-info-circle" aria-hidden="true"></span> <strong>${escapeHtml(heading(type.replace(/([a-z])([A-Z])/gu, '$1_$2')))}</strong> region “${escapeHtml(str(region.props, 'name', region.id))}” is not simulated locally.</div>`;
    }
  }

  columns(region: ApxComponent, resultColumns: string[]) {
    const declared = region.children.filter((child) => child.type === 'column');
    const saved =
      region.children.find(
        (child) =>
          child.type === 'savedReport' &&
          str(child.props, 'visibility', 'primaryDefault').startsWith('primary'),
      ) ?? region.children.find((child) => child.type === 'savedReport');
    const display = saved
      ? bySequence(saved.children.filter((child) => child.type === 'displayColumn')).map((child) =>
          child.id.toUpperCase(),
        )
      : [];
    const base = declared.length
      ? bySequence(declared)
      : resultColumns.map(
          (name) =>
            ({ type: 'column', id: name, props: {}, children: [], file: '', line: 0 }) as ApxComponent,
        );
    const visible = base.filter(
      (column) =>
        str(column.props, 'type') !== 'hidden' && !/^(APEX\$|ROWID$)/u.test(column.id.toUpperCase()),
    );
    if (display.length) {
      const order = new Map(display.map((name, index) => [name, index]));
      return visible
        .filter((column) => order.has(column.id.toUpperCase()))
        .sort((a, b) => order.get(a.id.toUpperCase())! - order.get(b.id.toUpperCase())!);
    }
    return visible;
  }

  cell(ctx: RenderContext, region: ApxComponent, column: ApxComponent, row: Row): string {
    const name = column.id.toUpperCase();
    const raw = row[name];
    const type = str(column.props, 'type', 'plainText');
    const custom = columnRenderer(type);
    if (custom) return custom(this, ctx, region, column, row);
    const mask = str(column.props, 'appearance.formatMask');
    let value = raw === null || raw === undefined ? '' : mask ? (formatOracle(raw, mask) ?? '') : String(raw);
    const escape = bool(
      column.props,
      'security.escapeSpecialChars',
      bool(region.props, 'security.escapeSpecialChars', true),
    );
    if (type === 'plainTextBasedOnLov' || type === 'selectList') {
      const lov = this.lov(ctx, get(column.props, 'lov'), `${region.id}.${name}`);
      value = lov.find((entry) => entry.r === value)?.d ?? value;
    }
    let html = escape ? escapeHtml(value) : value;
    if (str(column.props, 'columnFormatting.htmlExpression')) {
      html = str(column.props, 'columnFormatting.htmlExpression').replace(
        /#([A-Z0-9_$]+)#/gu,
        (whole, key: string) => (key in row ? escapeHtml(row[key] ?? '') : whole),
      );
    }
    if (type === 'link' || get(column.props, 'link.target') !== undefined) {
      const linkText = str(column.props, 'link.linkText', '#' + name + '#').replace(
        /#([A-Z0-9_$]+)#/gu,
        (whole, key: string) => (key in row ? escapeHtml(row[key] ?? '') : whole),
      );
      html = `<a href="${escapeHtml(this.link(ctx, get(column.props, 'link.target'), row, `apex.jQuery('#${this.regionDomId(region)}')`))}">${linkText}</a>`;
    }
    return html;
  }

  alignment(column: ApxComponent, sample: unknown): string {
    const alignment =
      str(column.props, 'layout.columnAlignment') || str(column.props, 'appearance.alignment');
    if (/end|right/u.test(alignment) || (!alignment && typeof sample === 'number')) return 'u-tR';
    if (/center/u.test(alignment)) return 'u-tC';
    return 'u-tL';
  }

  report(
    ctx: RenderContext,
    region: ApxComponent,
    mode: 'classic' | 'interactive',
    slots: Record<string, string> = {},
  ): string {
    const sql = this.regionSql(ctx, region);
    if (!sql)
      return `<div class="apex-local-unsupported">Report “${escapeHtml(str(region.props, 'name', region.id))}” has no local source.</div>`;
    const result = this.query(ctx, region, sql);
    if (result.error)
      return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(result.error)}</div></div>`;
    const domId = this.regionDomId(region);
    ctx.clientConfig.regions.push({ id: domId, kind: mode });
    const saved = region.children.find((child) => child.type === 'savedReport');
    const perPage = num(
      saved?.props ?? {},
      'view.rowsPerPage',
      num(
        region.props,
        'pagination.rowsPerPage',
        num(region.props, 'layout.numberOfRowsToDisplay', mode === 'interactive' ? 50 : 15),
      ),
    );
    const pageNumber = Math.max(1, ctx.session.pagination[`${ctx.pageId}:${region.id}`] ?? 1);
    const rows = result.rows.slice((pageNumber - 1) * perPage, pageNumber * perPage);
    const columns = this.columns(region, result.columns);
    const noData = this.substitute(
      ctx.session,
      str(region.props, 'messages.whenNoDataFound', 'No data found.'),
      ctx.page,
      'HTML',
    );
    const linkColumn = mode === 'interactive' && str(region.props, 'link.linkColumn') === 'customTarget';
    const linkIcon = str(
      region.props,
      'link.linkIcon',
      '<span class="fa fa-edit" aria-hidden="true"></span>',
    );
    const first = (pageNumber - 1) * perPage + 1;
    const last = first + rows.length - 1;
    const paginate = (target: number, label: string, cls: string) =>
      `<button type="button" class="t-Button t-Button--small t-Button--noUI t-Report-paginationLink ${cls}" data-apex-local-page="${target}" data-region="${escapeHtml(domId)}">${label}</button>`;
    const pagination =
      result.rows.length > perPage || pageNumber > 1
        ? `<tr><td>${pageNumber > 1 ? paginate(pageNumber - 1, '<span class="a-Icon icon-left-arrow"></span>Previous', 't-Report-paginationLink--prev') : ''}<span class="t-Report-paginationText">${first} - ${last}</span>${last < result.rows.length ? paginate(pageNumber + 1, 'Next<span class="a-Icon icon-right-arrow"></span>', 't-Report-paginationLink--next') : ''}</td></tr>`
        : rows.length
          ? `<tr><td><span class="t-Report-paginationText">${first} - ${last}</span></td></tr>`
          : '';

    if (mode === 'interactive') {
      const searchBar =
        slots.RIGHT_OF_INTERACTIVE_REPORT_SEARCH_BAR ?? slots.RIGHTOFINTERACTIVEREPORTSEARCHBAR ?? '';
      delete slots.RIGHT_OF_INTERACTIVE_REPORT_SEARCH_BAR;
      delete slots.RIGHTOFINTERACTIVEREPORTSEARCHBAR;
      const header = `${linkColumn ? '<th class="a-IRR-header a-IRR-header--linkColumn" id="' + domId + '_link"><span class="u-VisuallyHidden">Link</span></th>' : ''}${columns
        .map(
          (column) =>
            `<th class="a-IRR-header ${this.alignment(column, rows[0]?.[column.id.toUpperCase()])}" id="${escapeHtml(domId)}_${escapeHtml(column.id)}"><a class="a-IRR-headerLink" href="#" data-column="${escapeHtml(column.id)}">${this.substitute(ctx.session, str(column.props, 'heading.heading', heading(column.id)), ctx.page, 'HTML')}</a></th>`,
        )
        .join('')}`;
      const body = rows
        .map(
          (row) =>
            `<tr>${linkColumn ? `<td class="a-IRR-linkCol u-tC"><a href="${escapeHtml(this.link(ctx, get(region.props, 'link.target'), row, `apex.jQuery('#${domId}')`))}">${linkIcon}</a></td>` : ''}${columns
              .map(
                (column) =>
                  `<td class="${this.alignment(column, row[column.id.toUpperCase()])}" headers="${escapeHtml(domId)}_${escapeHtml(column.id)}">${this.cell(ctx, region, column, row)}</td>`,
              )
              .join('')}</tr>`,
        )
        .join('\n');
      return `<div class="a-IRR-container" id="${escapeHtml(domId)}_ir"><div class="a-IRR t-fht-cell"><div class="a-IRR-toolbar"><div class="a-IRR-controls">
<div class="a-IRR-controlGroup a-IRR-controlGroup--search"><div class="a-IRR-search"><div class="a-IRR-colSelector"><button type="button" class="a-Button a-IRR-button a-IRR-button--colSearch" aria-label="Select columns to search"><span class="a-Icon icon-search"></span><span class="a-Icon icon-menu-drop-down"></span></button></div><input class="a-IRR-search-field" type="search" placeholder="Search" aria-label="Search" data-apex-local-search="${escapeHtml(domId)}"><button class="a-Button a-IRR-button a-IRR-button--search" type="button">Go</button></div></div>
<div class="a-IRR-controlGroup a-IRR-controlGroup--options"><div class="a-IRR-actions"><button class="a-Button a-IRR-button a-IRR-button--actions" type="button">Actions<span class="a-Icon icon-down-chevron" aria-hidden="true"></span></button></div></div>
${searchBar ? `<div class="a-IRR-buttons">${searchBar}</div>` : ''}</div></div>
<div class="a-IRR-content"><div class="a-IRR-reportView"><div class="a-IRR-tableContainer">${rows.length ? `<table class="a-IRR-table" id="${escapeHtml(domId)}_table" aria-label="${escapeHtml(str(region.props, 'name'))}"><tr>${header}</tr>${body}</table>` : `<div class="a-IRR-noDataMsg"><span class="a-IRR-noDataMsg-icon a-Icon icon-irr-no-results" aria-hidden="true"></span><span class="a-IRR-noDataMsg-text">${noData}</span></div>`}</div>
${pagination ? `<div class="a-IRR-paginationWrap a-IRR-paginationWrap--bottom"><table class="t-Report-pagination t-Report-pagination--bottom" role="presentation">${pagination}</table></div>` : ''}</div></div></div></div>`;
    }

    const templateId = (
      ref(region.props, 'componentAppearance.template') ??
      ref(region.props, 'appearance.reportTemplate') ??
      defaultStaticId(this.theme, 'default_report_template', 'standard')
    ).toLowerCase();
    const template = this.theme.reports.get(templateId) ?? this.theme.reports.get('standard')!;
    const cssClasses = templateOptions(
      strings(list(region.props, 'componentAppearance.templateOptions')),
      text(template, 'preset_template_options').replaceAll(':', ' '),
    );
    const shared = {
      DOM_ID: domId,
      REGION_TITLE: escapeHtml(str(region.props, 'name')),
      COMPONENT_CSS_CLASSES: cssClasses,
      REPORT_ATTRIBUTES: '',
      TOP_PAGINATION: '',
      PAGINATION: pagination,
    };
    if (!rows.length) return `<div class="t-Report-wrap"><span class="nodatafound">${noData}</span></div>`;
    if (text(template, 'row_template_type') === 'NAMED_COLUMNS') {
      const rowHtml = rows
        .map((row, index) =>
          fill(text(template, 'row_template1'), {
            ...Object.fromEntries(Object.keys(row).map((key) => [key, escapeHtml(row[key] ?? '')])),
            ...Object.fromEntries(
              columns.map((column) => [column.id.toUpperCase(), this.cell(ctx, region, column, row)]),
            ),
            ROWNUM: String(index + 1),
          }),
        )
        .join('\n');
      return (
        fill(text(template, 'row_template_before_rows'), shared) +
        rowHtml +
        fill(text(template, 'row_template_after_rows'), shared)
      );
    }
    const headings = columns
      .map((column) =>
        fill(text(template, 'column_heading_template'), {
          COLUMN_HEADER: this.substitute(
            ctx.session,
            str(column.props, 'heading.heading', heading(column.id)),
            ctx.page,
            'HTML',
          ),
          COLUMN_HEADER_NAME: escapeHtml(column.id.toUpperCase()),
          ALIGNMENT: `align="${this.alignment(column, rows[0]?.[column.id.toUpperCase()]) === 'u-tR' ? 'right' : 'left'}"`,
          ARIA_SORT: '',
          COLUMN_WIDTH: '',
        }),
      )
      .join('');
    const body = rows
      .map(
        (row) =>
          text(template, 'row_template_before_first') +
          columns
            .map((column) =>
              fill(text(template, 'row_template1'), {
                COLUMN_VALUE: this.cell(ctx, region, column, row),
                ALIGNMENT: `align="${this.alignment(column, row[column.id.toUpperCase()]) === 'u-tR' ? 'right' : 'left'}"`,
                ACCESSIBLE_HEADERS: `headers="${escapeHtml(column.id.toUpperCase())}"`,
              }),
            )
            .join('') +
          text(template, 'row_template_after_last'),
      )
      .join('\n');
    return (
      fill(text(template, 'row_template_before_rows'), shared) +
      text(template, 'before_column_heading') +
      headings +
      text(template, 'after_column_heading') +
      body +
      fill(text(template, 'row_template_after_rows'), shared)
    );
  }

  cards(ctx: RenderContext, region: ApxComponent): string {
    const sql = this.regionSql(ctx, region);
    if (!sql) return '';
    const result = this.query(ctx, region, sql, 200);
    const value = (row: Row, key: string) => {
      const column = str(region.props, key).toUpperCase();
      return column && column in row ? escapeHtml(row[column] ?? '') : '';
    };
    ctx.clientConfig.regions.push({ id: this.regionDomId(region), kind: 'cards' });
    const cards = result.rows
      .map((row) => {
        const title = value(row, 'title.column');
        const subtitle = value(row, 'subtitle.column');
        const body = value(row, 'body.column');
        const badge = value(row, 'iconAndBadge.badgeColumn');
        const iconColumn = value(row, 'iconAndBadge.iconColumn');
        const initials = iconColumn
          .split(/\s+/u)
          .map((part) => part[0] ?? '')
          .join('')
          .slice(0, 2)
          .toUpperCase();
        const icon = str(region.props, 'iconAndBadge.iconSource')
          ? `<div class="a-CardView-icon u-color" aria-hidden="true"><span class="a-CardView-initials">${initials}</span></div>`
          : '';
        return `<li class="a-CardView-item"><div class="a-CardView"><div class="a-CardView-header">${icon}<div class="a-CardView-headerBody"><h3 class="a-CardView-title">${title}</h3>${subtitle ? `<h4 class="a-CardView-subTitle">${subtitle}</h4>` : ''}</div>${badge ? `<div class="a-CardView-badge"><span class="a-CardView-badgeValue">${badge}</span></div>` : ''}</div>${body ? `<div class="a-CardView-body"><div class="a-CardView-mainContent">${body}</div></div>` : ''}</div></li>`;
      })
      .join('\n');
    return `<div class="a-CardView-region"><ul class="a-CardView-items a-CardView-items--grid">${cards}</ul></div>`;
  }

  chart(ctx: RenderContext, region: ApxComponent): string {
    const series = bySequence(region.children.filter((child) => child.type === 'series'));
    const type = str(region.props, 'chart.type', 'bar');
    const parts = series
      .map((entry) => {
        const sql =
          str(entry.props, 'source.sqlQuery') ||
          (str(entry.props, 'source.tableName')
            ? `select * from ${str(entry.props, 'source.tableName')}`
            : '');
        if (!sql) return '';
        const result = this.query(ctx, entry, sql, num(entry.props, 'performance.maxRowsToProcess', 50));
        const label = str(entry.props, 'columnMapping.label', result.columns[0] ?? '').toUpperCase();
        const valueColumn = str(entry.props, 'columnMapping.value', result.columns[1] ?? '').toUpperCase();
        const values = result.rows.map((row) => ({
          label: String(row[label] ?? ''),
          value: Number(row[valueColumn] ?? 0),
        }));
        const max = Math.max(1, ...values.map((item) => item.value));
        const bars = values
          .map(
            (item, index) =>
              `<div class="apex-local-bar"><span class="apex-local-bar-label">${escapeHtml(item.label)}</span><span class="apex-local-bar-track"><span class="apex-local-bar-fill u-color-${(index % 15) + 1}-bg" style="width:${((item.value / max) * 100).toFixed(1)}%"></span></span><span class="apex-local-bar-value">${item.value.toLocaleString('en-US')}</span></div>`,
          )
          .join('');
        return `<div class="apex-local-series"><div class="apex-local-series-name">${escapeHtml(str(entry.props, 'name'))}</div>${bars}</div>`;
      })
      .join('');
    this.diagnose(
      'info',
      `Chart ${region.id} (${type}) is drawn as a simple bar preview, not Oracle JET`,
      ctx.pageId,
      region.id,
    );
    return `<div class="apex-local-chart" data-chart-type="${escapeHtml(type)}">${parts}</div>`;
  }

  breadcrumb(ctx: RenderContext, region: ApxComponent): string {
    const breadcrumb = this.shared('breadcrumb', ref(region.props, 'source.breadcrumb'));
    if (!breadcrumb) return '';
    const templateId = (
      ref(region.props, 'componentAppearance.breadcrumbTemplate') ??
      ref(region.props, 'componentAppearance.template') ??
      'breadcrumb'
    ).toLowerCase();
    const template = this.theme.breadcrumbs.get(templateId) ?? this.theme.breadcrumbs.get('breadcrumb')!;
    const entries = breadcrumb.children.filter((child) => child.type === 'entry');
    const current = entries.find((entry) => str(entry.props, 'pageNumber') === ctx.pageId);
    if (!current) return '';
    const chain: ApxComponent[] = [];
    for (
      let entry: ApxComponent | undefined = current;
      entry && !chain.includes(entry);
      entry = entries.find((candidate) => candidate.id === ref(entry!.props, 'layout.parentEntry'))
    )
      chain.unshift(entry);
    const options = templateOptions(strings(list(region.props, 'componentAppearance.templateOptions')), '');
    return (
      fill(text(template, 'before_first'), { COMPONENT_CSS_CLASSES: options }) +
      chain
        .map((entry) =>
          fill(
            entry === current
              ? text(template, 'current_page_option')
              : text(template, 'non_current_page_option'),
            {
              NAME: escapeHtml(
                this.substitute(ctx.session, str(entry.props, 'name', entry.id), ctx.page, 'RAW'),
              ),
              LINK: escapeHtml(this.link(ctx, get(entry.props, 'link.target'))),
            },
          ),
        )
        .join('') +
      text(template, 'after_last')
    );
  }

  listRegion(ctx: RenderContext, region: ApxComponent): string {
    const listComponent = this.shared('list', ref(region.props, 'source.list'));
    if (!listComponent) {
      this.diagnose('warning', `List @${ref(region.props, 'source.list')} not found`, ctx.pageId, region.id);
      return '';
    }
    const theme = this.themeComponent();
    const templateId = (
      ref(region.props, 'componentAppearance.listTemplate') ??
      ref(theme?.props ?? {}, 'componentDefaults.list') ??
      'links-list'
    ).toLowerCase();
    return this.renderList(
      ctx,
      listComponent,
      templateId,
      strings(list(region.props, 'componentAppearance.templateOptions')),
      `${this.regionDomId(region)}_list`,
      this.regionDomId(region),
    );
  }

  renderList(
    ctx: RenderContext,
    listComponent: ApxComponent,
    templateId: string,
    options: string[],
    listId: string,
    /** Static ID of the owning region (`#PARENT_STATIC_ID#`, e.g. `<id>_menu` of Menu Popup). */
    parentId = listId,
  ): string {
    const template = this.theme.lists.get(templateId);
    if (!template) {
      this.diagnose('warning', `List template @/${templateId} not found`, ctx.pageId, listComponent.id);
      return '';
    }
    for (const file of text(template, 'javascript_file_urls').split('\n').filter(Boolean))
      ctx.jsFiles.add(file);
    for (const file of text(template, 'css_file_urls').split('\n').filter(Boolean)) ctx.cssFiles.add(file);
    const entries = listComponent.children.filter(
      (child) => child.type === 'entry' && this.visible(ctx, child),
    );
    const childrenOf = (parent: string | undefined) =>
      bySequence(entries.filter((entry) => ref(entry.props, 'layout.parentEntry') === parent));
    const isCurrent = (entry: ApxComponent): boolean => {
      const target = get(entry.props, 'link.target');
      const pages = str(entry.props, 'currentForPages') || str(entry.props, 'link.currentForPages');
      if (pages)
        return pages
          .split(',')
          .map((page) => page.trim())
          .includes(ctx.pageId);
      return (
        isObject(target) && target.page !== undefined && this.findPage(String(target.page))?.id === ctx.pageId
      );
    };
    const render = (entry: ApxComponent, level: number): string => {
      const kids = childrenOf(entry.id);
      const current = isCurrent(entry) || kids.some(isCurrent);
      const attributes = get(entry.props, 'userDefinedAttributes');
      const values: Record<string, string> = {
        LINK: escapeHtml(this.link(ctx, get(entry.props, 'link.target'))),
        TEXT: this.substitute(ctx.session, str(entry.props, 'label', entry.id), ctx.page, 'HTML'),
        TEXT_ESC_SC: this.substitute(ctx.session, str(entry.props, 'label', entry.id), ctx.page, 'HTML'),
        ICON_CSS_CLASSES: iconClasses(
          str(entry.props, 'icon.imageIconCssClasses') || str(entry.props, 'icon.iconCssClasses'),
        ),
        IMAGE: iconClasses(str(entry.props, 'icon.imageIconCssClasses')),
        IMAGE_ATTR: '',
        LINK_ATTR: '',
        LIST_ITEM_ID: `${listId}_${slug(entry.id)}`,
        PARENT_LIST_ITEM_ID: `${listId}_${slug(entry.id)}`,
        LEVEL: String(level),
      };
      for (let index = 1; index <= 20; index += 1) {
        const key = `A${String(index).padStart(2, '0')}`;
        const value = isObject(attributes) ? attributes[String(index)] : undefined;
        values[key] = typeof value === 'string' ? this.substitute(ctx.session, value, ctx.page, 'HTML') : '';
      }
      const sub = level > 1;
      const field = kids.length
        ? sub
          ? current
            ? 'sub_templ_curr_w_child'
            : 'sub_templ_noncurr_w_child'
          : current
            ? 'item_templ_curr_w_child'
            : 'item_templ_noncurr_w_child'
        : sub
          ? current
            ? 'sub_list_item_current'
            : 'sub_list_item_noncurrent'
          : current
            ? 'list_template_current'
            : 'list_template_noncurrent';
      let html = fill(
        text(template, field) ||
          text(template, current ? 'list_template_current' : 'list_template_noncurrent'),
        values,
      );
      if (kids.length) {
        html +=
          fill(text(template, 'before_sub_list'), values) +
          kids.map((kid) => render(kid, level + 1)).join('') +
          fill(text(template, 'after_sub_list'), values);
      }
      return html;
    };
    const shared = {
      LIST_ID: listId,
      PARENT_STATIC_ID: parentId,
      COMPONENT_CSS_CLASSES: templateOptions(options, text(template, 'default_template_options')),
      APEX_CSP_NONCE_ATTRIBUTE: '',
    };
    // The onload code addresses the list by #PARENT_STATIC_ID# / #LIST_ID#.
    if (text(template, 'javascript_code_onload'))
      ctx.onload.push(fill(text(template, 'javascript_code_onload'), shared, false));
    return (
      fill(text(template, 'list_template_before_rows'), shared) +
      childrenOf(undefined)
        .map((entry) => render(entry, 1))
        .join('') +
      fill(text(template, 'list_template_after_rows'), shared)
    );
  }

  // ---------------------------------------------------------------- buttons & items

  renderButton(ctx: RenderContext, button: ApxComponent): string {
    const theme = this.themeComponent();
    const templateId = (
      ref(button.props, 'appearance.buttonTemplate') ??
      ref(theme?.props ?? {}, 'componentDefaults.button') ??
      'text'
    ).toLowerCase();
    const template = this.theme.buttons.get(templateId) ?? this.theme.buttons.get('text')!;
    const hot = bool(button.props, 'appearance.hot', false);
    const domId = str(button.props, 'advanced.staticId') || `B_${slug(button.id)}`;
    const name = str(button.props, 'buttonName', button.id.toUpperCase());
    const action = str(button.props, 'behavior.action', 'submit');
    let onclick = '';
    if (action === 'submit' || action === 'submitPage' || action === '') {
      const request = escapeJs(name);
      const confirm = bool(button.props, 'behavior.requiresConfirmation', false);
      const message = escapeJs(
        this.substitute(
          ctx.session,
          str(button.props, 'confirmation.message', '&APP_TEXT$DELETE_MSG.'),
          ctx.page,
          'RAW',
        ),
      );
      onclick = confirm
        ? `apex.confirm('${message}',{request:'${request}',showWait:true${str(button.props, 'confirmation.style') === 'danger' ? ",style:'danger'" : ''}});`
        : `apex.submit({request:'${request}',showWait:true});`;
    } else if (action === 'redirectThisApp' || action === 'redirectPage' || action === 'redirectUrl') {
      const target = get(button.props, 'behavior.target') ?? str(button.props, 'behavior.targetUrl');
      const href = this.link(ctx, target, undefined, `apex.jQuery('#${domId}')`);
      onclick = href.startsWith('javascript:')
        ? href.slice(11)
        : `apex.navigation.redirect('${escapeJs(href)}');`;
    }
    const options = templateOptions(
      strings(list(button.props, 'appearance.templateOptions')),
      text(template, 'default_template_options'),
    );
    const icon = iconClasses(
      str(button.props, 'appearance.icon') || str(button.props, 'icon.iconCssClasses'),
    );
    return fill(text(template, hot && text(template, 'hot_template') ? 'hot_template' : 'template'), {
      DOM_ID: domId,
      BUTTON_ID: domId,
      BUTTON_NAME: name,
      LABEL: escapeHtml(
        this.substitute(ctx.session, str(button.props, 'label', heading(button.id)), ctx.page, 'RAW'),
      ),
      BUTTON_CSS_CLASSES: [
        options,
        str(button.props, 'appearance.cssClasses'),
        hot && !text(template, 'hot_template') ? 't-Button--hot' : '',
      ]
        .filter(Boolean)
        .join(' '),
      ICON_CSS_CLASSES: icon,
      BUTTON_ATTRIBUTES: this.substitute(
        ctx.session,
        str(button.props, 'advanced.customAttributes'),
        ctx.page,
        'RAW',
      ),
      ONCLICK: onclick ? `onclick="${escapeHtml(onclick)}"` : '',
      JAVASCRIPT: onclick ? `onclick="${escapeHtml(onclick)}"` : '',
      IS_DISABLED: '',
      MENU_ID: '',
    });
  }

  renderItem(ctx: RenderContext, item: ApxComponent): string {
    const name = item.id.toUpperCase();
    const type = str(item.props, 'type', 'textField');
    const value = ctx.session.items[name] ?? '';
    if (type === 'hidden') {
      const hidden = itemRenderer('hidden');
      return hidden
        ? hidden(this, ctx, item, name, value)
        : `<input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}">`;
    }
    const required = bool(item.props, 'validation.valueRequired', false);
    const theme = this.themeComponent();
    const templateId = (
      ref(item.props, 'appearance.template') ??
      ref(
        theme?.props ?? {},
        required ? 'componentDefaults.requiredLabel' : 'componentDefaults.optionalLabel',
      ) ??
      (required ? 'required-floating' : 'optional-floating')
    ).toLowerCase();
    const template = this.theme.fields.get(templateId) ?? this.theme.fields.get('optional-floating')!;
    const element = this.element(ctx, item, type, name, value);
    const label = escapeHtml(this.substitute(ctx.session, this.label(item), ctx.page, 'RAW'));
    const error = ctx.itemErrors.get(name);
    const singleCheckbox = type === 'checkbox';
    const values: Record<string, string> = {
      CURRENT_ITEM_NAME: name,
      CURRENT_ITEM_ID: name,
      CURRENT_ITEM_CONTAINER_ID: `${name}_CONTAINER`,
      LABEL_ID: `${name}_LABEL`,
      LABEL_OPEN: `label for="${name}"`,
      LABEL_CLOSE: '/label',
      ITEM_CSS_CLASSES: [
        `apex-item-wrapper apex-item-wrapper--${WRAPPER_CLASSES[type] ?? slug(type).replace(/[A-Z]/gu, (char) => `-${char.toLowerCase()}`)}`,
        str(item.props, 'appearance.cssClasses'),
        error ? 'is-error' : '',
      ]
        .filter(Boolean)
        .join(' '),
      CURRENT_ITEM_PRE_TEXT: str(item.props, 'appearance.preTextHtml'),
      CURRENT_ITEM_POST_TEXT: str(item.props, 'appearance.postTextHtml'),
      CURRENT_ITEM_HELP_LABEL: 'Help',
      CURRENT_ITEM_INLINE_HELP_TEXT: escapeHtml(str(item.props, 'help.inlineHelpText')),
      ERROR_MESSAGE: error ? escapeHtml(error) : '',
      IS_REQUIRED: required ? 'Y' : '',
    };
    for (const extension of extensions) extension.itemTemplate?.(this, ctx, item, values);
    values.ITEM_PRE_TEXT = values.CURRENT_ITEM_PRE_TEXT ? fill(text(template, 'item_pre_text'), values) : '';
    values.ITEM_POST_TEXT = values.CURRENT_ITEM_POST_TEXT
      ? fill(text(template, 'item_post_text'), values)
      : '';
    values.HELP_TEMPLATE = str(item.props, 'help.helpText') ? fill(text(template, 'help_link'), values) : '';
    values.INLINE_HELP_TEMPLATE = values.CURRENT_ITEM_INLINE_HELP_TEXT
      ? fill(text(template, 'inline_help_text'), values)
      : '';
    const errorTemplate = `${text(template, 'id')}_ET`;
    ctx.messageTemplates[errorTemplate] = text(template, 'error_template');
    values.ERROR_TEMPLATE = `<span id="${name}_error_placeholder" class="a-Form-error${error ? '' : ' u-hidden'}" data-template-id="${errorTemplate}">${error ? fill(text(template, 'error_template'), values) : ''}</span>`;
    const labelHtml = singleCheckbox
      ? ''
      : `${fill(text(template, 'template_body1'), values)}${label}${fill(text(template, 'template_body2'), values)}`;
    return `${fill(text(template, 'before_item'), values)}${labelHtml}${fill(text(template, 'before_element'), values)}${element}${fill(text(template, 'after_element'), values)}${fill(text(template, 'after_item'), values)}`;
  }

  element(ctx: RenderContext, item: ApxComponent, type: string, name: string, value: string): string {
    const extension = itemRenderer(type);
    if (extension) return extension(this, ctx, item, name, value);
    const v = escapeHtml(value);
    const width = num(item.props, 'appearance.width', 30);
    const max = num(item.props, 'validation.maxLength', 0);
    const placeholder = str(item.props, 'appearance.placeholder')
      ? ` placeholder="${escapeHtml(str(item.props, 'appearance.placeholder'))}"`
      : '';
    const required = bool(item.props, 'validation.valueRequired', false) ? ' required' : '';
    const readonly = str(item.props, 'readOnly.type') === 'always' ? ' readonly' : '';
    const lov = () => this.lov(ctx, get(item.props, 'lov'), name);
    const nullDisplay = (fallback: string) => escapeHtml(str(item.props, 'lov.nullDisplayValue', fallback));
    const options = (selected: string[]) =>
      lov()
        .map(
          (entry) =>
            `<option value="${escapeHtml(entry.r)}"${selected.includes(entry.r) ? ' selected' : ''}>${escapeHtml(entry.d)}</option>`,
        )
        .join('');
    switch (type) {
      case 'textField':
      case 'popupLov':
      case 'autoComplete':
      case 'colorPicker':
        return `<input type="text" id="${name}" name="${name}" class="text_field apex-item-text" value="${v}" size="${width}"${max ? ` maxlength="${max}"` : ''}${placeholder}${required}${readonly} data-trim-spaces="BOTH">`;
      case 'password':
        return `<input type="password" id="${name}" name="${name}" class="password apex-item-text" value="" size="${width}"${placeholder}${required}>`;
      case 'numberField':
        return `<input type="text" inputmode="decimal" id="${name}" name="${name}" class="number_field apex-item-text apex-item-number" value="${v}" size="${width}"${placeholder}${required}${readonly} style="text-align:end">`;
      case 'datePicker':
      case 'datePickerApex':
        return `<input type="date" id="${name}" name="${name}" class="text_field apex-item-text apex-item-datepicker" value="${v.slice(0, 10)}"${required}${readonly}>`;
      case 'textarea':
      case 'richTextEditor':
      case 'markdownEditor':
        return `<div class="apex-item-group apex-item-group--textarea"><textarea name="${name}" id="${name}" rows="${num(item.props, 'appearance.height', 5)}" cols="${width}" class="textarea apex-item-textarea"${placeholder}${required}${readonly}>${v}</textarea></div>`;
      case 'selectList':
      case 'shuttle':
      case 'selectMany':
      case 'combobox': {
        const showNull = bool(item.props, 'lov.displayNullValue', type === 'selectList');
        return `<select id="${name}" name="${name}" class="selectlist apex-item-select" data-native-menu="false" size="1"${required}>${showNull ? `<option value="">${nullDisplay('- Select -')}</option>` : ''}${options(value.split(':'))}</select>`;
      }
      case 'radioGroup':
      case 'checkboxGroup': {
        const input = type === 'radioGroup' ? 'radio' : 'checkbox';
        const selected = value.split(':');
        const choices = lov()
          .map(
            (entry, index) =>
              `<div class="apex-item-option"><input type="${input}" id="${name}_${index}" name="${name}" value="${escapeHtml(entry.r)}"${selected.includes(entry.r) ? ' checked' : ''}><label for="${name}_${index}">${escapeHtml(entry.d)}</label></div>`,
          )
          .join('');
        return `<div tabindex="-1" id="${name}" class="${input === 'radio' ? 'radio_group apex-item-radio' : 'checkbox_group apex-item-checkbox'}" role="${input === 'radio' ? 'radiogroup' : 'group'}" aria-labelledby="${name}_LABEL">${choices}</div>`;
      }
      case 'checkbox': {
        const checked = value === str(item.props, 'settings.checkedValue', 'Y');
        return `<div class="apex-item-single-checkbox"><input type="hidden" name="${name}" id="${name}_HIDDENVALUE" value="${v}"><input type="checkbox" id="${name}" value="${escapeHtml(str(item.props, 'settings.checkedValue', 'Y'))}"${checked ? ' checked' : ''}><label for="${name}" id="${name}_LABEL" class="u-checkbox">${escapeHtml(this.label(item))}</label></div>`;
      }
      case 'switch': {
        const on = str(item.props, 'settings.onValue', 'Y');
        return `<span class="a-Switch"><input type="checkbox" id="${name}" name="${name}" value="${escapeHtml(on)}" data-off-value="${escapeHtml(str(item.props, 'settings.offValue', 'N'))}"${value === on ? ' checked' : ''} class="a-Switch-input"><span class="a-Switch-toggle"></span></span>`;
      }
      case 'displayOnly': {
        const display = get(item.props, 'lov')
          ? (lov().find((entry) => entry.r === value)?.d ?? value)
          : value;
        return `<span id="${name}_DISPLAY" class="display_only apex-item-display-only">${escapeHtml(display)}</span><input type="hidden" id="${name}" name="${name}" value="${v}">`;
      }
      case 'fileBrowse':
      case 'imageUpload':
        return `<input type="file" id="${name}" name="${name}" class="file apex-item-file">`;
      case 'starRating':
        return `<input type="text" id="${name}" name="${name}" class="text_field apex-item-text" value="${v}" size="3">`;
      default:
        this.diagnose('info', `Item type ${type} (${name}) is rendered as a text field`, ctx.pageId, name);
        return `<input type="text" id="${name}" name="${name}" class="text_field apex-item-text" value="${v}" size="${width}">`;
    }
  }

  // ---------------------------------------------------------------- dynamic actions

  selector(ctx: RenderContext, props: ApxValue | undefined): string {
    if (!isObject(props)) return '';
    const type = str(props, 'selectionType');
    switch (type) {
      case 'button': {
        const id = ref(props, 'button');
        const button = this.pageComponents(ctx, 'button').find((candidate) => candidate.id === id);
        return button ? `#${str(button.props, 'advanced.staticId') || `B_${slug(button.id)}`}` : '';
      }
      case 'region': {
        const id = ref(props, 'region');
        const region = this.pageComponents(ctx, 'region').find((candidate) => candidate.id === id);
        return region ? `#${this.regionDomId(region)}` : '';
      }
      case 'items':
      case 'item':
        return strings(list(props, 'items').length ? list(props, 'items') : list(props, 'item'))
          .flatMap((value) => value.split(','))
          .map((value) => `#${value.trim().toUpperCase()}`)
          .join(',');
      case 'jQuerySelector':
      case 'jquerySelector':
        return str(props, 'jQuerySelector') || str(props, 'jquerySelector');
      case 'javascriptExpression':
      case 'jsExpression':
        return `js:${str(props, 'javaScriptExpression') || str(props, 'javascriptExpression')}`;
      case 'domObject':
        return `js:document.getElementById(${JSON.stringify(str(props, 'domObject'))}) || ${JSON.stringify(str(props, 'domObject'))}`;
      case 'columns':
        this.diagnose('info', 'Dynamic actions on interactive grid columns are not simulated', ctx.pageId);
        return '';
      case 'triggeringElement':
        return 'triggeringElement';
      default:
        return 'document';
    }
  }

  dynamicAction(ctx: RenderContext, action: ApxComponent): unknown {
    const when = action.props.when;
    const actions = bySequence(action.children.filter((child) => child.type === 'action')).map((child) => {
      const settings = isObject(child.props.settings) ? child.props.settings : {};
      return {
        action: str(child.props, 'action'),
        selector: this.selector(ctx, child.props.affectedElements),
        fireOnInit: bool(child.props, 'execution.fireOnInit', false),
        stopOnError: bool(child.props, 'execution.stopExecutionOnError', true),
        wait: bool(child.props, 'execution.waitForResult', true),
        whenFalse:
          str(child.props, 'execution.event') === 'false' ||
          str(child.props, 'execution.fireWhenEventResultIs') === 'false',
        settings: Object.fromEntries(
          Object.entries(settings).map(([key, value]) => [
            key,
            typeof value === 'string'
              ? this.substitute(ctx.session, value, ctx.page, 'RAW')
              : isRef(value)
                ? value.ref
                : value,
          ]),
        ),
      };
    });
    const condition = action.props.clientSideCondition;
    const whenProps = isObject(when) ? when : {};
    const event = str(whenProps, 'event', 'ready');
    return {
      id: action.id,
      event: event === 'custom' ? str(whenProps, 'customEvent', 'custom') : event,
      selector: this.selector(ctx, when),
      scope: str(action.props, 'execution.eventScope', 'static'),
      container: str(action.props, 'execution.staticContainer'),
      timing: str(action.props, 'execution.type', 'immediate'),
      time: num(action.props, 'execution.time', 0),
      immediate: bool(action.props, 'execution.immediate', false),
      condition: isObject(condition)
        ? {
            type: str(condition, 'type'),
            item: str(condition, 'item').toUpperCase(),
            value: str(condition, 'value'),
            list: strings(list(condition, 'list')),
            expression: str(condition, 'javaScriptExpression') || str(condition, 'javascriptExpression'),
          }
        : null,
      actions,
    };
  }

  /** HTML of a single region body for client-side refresh. */
  renderRegionFragment(session: Session, pageKey: string, regionId: string): string {
    const ctx = this.prepare(session, pageKey);
    const region = this.pageComponents(ctx, 'region').find(
      (candidate) => this.regionDomId(candidate) === regionId || candidate.id === regionId,
    );
    if (!region) throw new Error(`Region ${regionId} not found`);
    return this.renderRegion(ctx, region);
  }

  /** Loads `.apex-local/*.sql` (or supporting-object scripts) into a fresh database. */
  static seed(db: LocalDatabase, appRoot: string): string[] {
    const local = path.join(appRoot, '.apex-local');
    const scripts = fs.existsSync(local)
      ? fs
          .readdirSync(local)
          .filter((name) => name.endsWith('.sql'))
          .sort()
          .map((name) => path.join(local, name))
      : [];
    if (!scripts.length) {
      const supporting = path.join(appRoot, 'supporting-objects');
      if (fs.existsSync(supporting)) {
        scripts.push(
          ...fs
            .readdirSync(supporting, { recursive: true, encoding: 'utf8' })
            .filter((name) => name.endsWith('.sql') && !/deinstall|upgrade/iu.test(name))
            .sort()
            .map((name) => path.join(supporting, name)),
        );
      }
    }
    return scripts.flatMap((script) =>
      db.runScript(fs.readFileSync(script, 'utf8'), path.relative(appRoot, script)),
    );
  }
}

export type { RenderContext };
