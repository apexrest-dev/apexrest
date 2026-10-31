import { str } from '../../apexlang.ts';
import { registerOracleFunction } from '../../database.ts';
import type { ApexError, ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml, escapeJs } from '../../theme.ts';
import { aclCheck } from '../devtools/view-as.ts';

/** What package stubs can touch while PL/SQL runs. */
export interface Runtime {
  renderer: ApexRenderer;
  ctx: RenderContext;
  output: string[];
  errors: ApexError[];
  redirectURL?: string;
  note(level: 'info' | 'warning', message: string): void;
}

export type StubArgs = Record<string, unknown> & { _: unknown[] };

export interface Stub {
  params: string[];
  fn: (args: StubArgs, rt: Runtime | undefined) => unknown;
  /** Also callable from SQL (registered as a SQLite function). */
  sql?: boolean;
}

/** The runtime of the innermost running PL/SQL unit; SQL functions read session state through it. */
let active: Runtime | undefined;
let lastRenderer: ApexRenderer | undefined;
export const activeRuntime = () => active;
export function withRuntime<T>(rt: Runtime, run: () => T): T {
  const previous = active;
  active = rt;
  lastRenderer = rt.renderer;
  try {
    return run();
  } finally {
    active = previous;
  }
}
export const rememberRenderer = (renderer: ApexRenderer) => {
  lastRenderer = renderer;
};

const text = (value: unknown): string | null =>
  value === null || value === undefined || value === '' ? null : String(value);
const sessionState = (rt: Runtime | undefined) => rt?.ctx.session.items;

export const MESSAGE_FALLBACKS: Record<string, string> = {
  'APEX.FEATURE.ACL.INFO.ALL_USERS':
    'All authenticated users can access this application; users in the access control list get their assigned roles.',
  'APEX.FEATURE.ACL.INFO.ACL_ONLY':
    'Only users defined in the access control list can access this application.',
  'APEX.FEATURE.ACL.INFO.ACL_VALUE_INVALID': 'Invalid access control scope value: %0',
  'APEX.FEATURE.CONFIG.IS_ENABLED': '%0 is enabled',
  'APEX.FEATURE.CONFIG.IS_DISABLED': '%0 is disabled',
};

function format(template: string, values: unknown[]): string {
  return template.replace(/%(\d)/gu, (whole, index: string) => {
    const value = values[Number(index)];
    return value === undefined ? whole : String(value ?? '');
  });
}

function since(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const units: [number, string][] = [
    [31_536_000, 'year'],
    [2_592_000, 'month'],
    [604_800, 'week'],
    [86_400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ];
  const absolute = Math.abs(seconds);
  for (const [size, unit] of units) {
    if (absolute >= size) {
      const count = Math.floor(absolute / size);
      return `${count} ${unit}${count === 1 ? '' : 's'} ${seconds >= 0 ? 'ago' : 'from now'}`;
    }
  }
  return 'Now';
}

function split(value: unknown, separator: unknown): string[] {
  const source = text(value);
  if (source === null) return [];
  const sep = separator === null || separator === undefined ? '\n' : String(separator);
  return sep === '' ? [...source] : source.split(sep);
}

function pageUrl(rt: Runtime | undefined, args: StubArgs): string {
  const renderer = rt?.renderer ?? lastRenderer;
  const pageKey = text(args.p_page) ?? rt?.ctx.pageId ?? '';
  const page = renderer?.findPage(pageKey);
  const base = renderer
    ? page
      ? renderer.pagePath(page)
      : `${renderer.baseUrl}/${pageKey}`
    : `f?p=${pageKey}`;
  const params = new URLSearchParams();
  const names = split(args.p_items, ',');
  const values = split(args.p_values, ',');
  names.forEach((name, index) => params.set(name.trim().toLowerCase(), values[index] ?? ''));
  if (text(args.p_clear_cache)) params.set('clear', String(args.p_clear_cache));
  if (text(args.p_request)) params.set('request', String(args.p_request));
  const query = params.toString();
  return `${base}${query ? `?${query}` : ''}`;
}

function addError(args: StubArgs, rt: Runtime | undefined): null {
  if (!rt) return null;
  const location = String(args.p_display_location ?? 'INLINE_IN_NOTIFICATION').toUpperCase();
  const item = text(args.p_page_item_name)?.toUpperCase();
  rt.errors.push({
    type: 'error',
    location:
      location === 'INLINE_WITH_FIELD'
        ? ['inline']
        : location === 'INLINE_WITH_FIELD_AND_NOTIFICATION'
          ? ['inline', 'page']
          : ['page'],
    ...(item ? { pageItem: item } : {}),
    message: String(args.p_message ?? args.p_error_code ?? 'Error'),
    unsafe: false,
  });
  return null;
}

const appSettings = new WeakMap<ApexRenderer, Map<string, string | null>>();
function settings(rt: Runtime | undefined): Map<string, string | null> | undefined {
  const renderer = rt?.renderer ?? lastRenderer;
  if (!renderer) return undefined;
  let map = appSettings.get(renderer);
  if (!map) {
    map = new Map();
    for (const component of [...renderer.app.shared, ...renderer.app.app.children].filter(
      (entry) => entry.type === 'appSetting',
    )) {
      const value = str(component.props, 'value.staticValue') || str(component.props, 'staticValue') || null;
      map.set((str(component.props, 'staticId') || component.id).toUpperCase(), value);
    }
    appSettings.set(renderer, map);
  }
  return map;
}

const noop = (): null => null;
const p = (...params: string[]) => params;

export const STUBS: Record<string, Stub> = {
  // session state
  'apex_util.set_session_state': {
    params: p('p_name', 'p_value', 'p_commit'),
    fn: (args, rt) => {
      const items = sessionState(rt);
      if (items) items[String(args.p_name ?? '').toUpperCase()] = text(args.p_value) ?? '';
      return null;
    },
  },
  'apex_util.get_session_state': {
    params: p('p_item'),
    fn: (args, rt) => text(sessionState(rt)?.[String(args.p_item ?? '').toUpperCase()]),
  },
  'apex_util.get_numeric_session_state': {
    params: p('p_item'),
    fn: (args, rt) => {
      const value = text(sessionState(rt)?.[String(args.p_item ?? '').toUpperCase()]);
      return value === null ? null : Number(value);
    },
  },
  'apex_util.clear_page_cache': {
    params: p('p_page_id'),
    fn: (args, rt) => {
      const page = rt?.renderer.findPage(String(args.p_page_id ?? rt.ctx.pageId));
      for (const item of page?.children.filter((child) => child.type === 'pageItem') ?? [])
        delete rt!.ctx.session.items[item.id.toUpperCase()];
      return null;
    },
  },
  'apex_util.clear_app_cache': { params: p('p_app_id'), fn: noop },
  'apex_util.clear_user_cache': { params: [], fn: noop },
  'apex_util.prepare_url': { params: p('p_url'), fn: (args) => text(args.p_url), sql: true },
  'apex_util.url_encode': {
    params: p('p_url'),
    fn: (args) => (text(args.p_url) === null ? null : encodeURIComponent(String(args.p_url))),
    sql: true,
  },
  'apex_util.string_to_table': {
    params: p('p_string', 'p_separator'),
    fn: (args) => split(args.p_string, args.p_separator ?? ':'),
  },
  'apex_util.table_to_string': {
    params: p('p_table', 'p_string'),
    fn: (args) => (Array.isArray(args.p_table) ? args.p_table.join(String(args.p_string ?? ':')) : null),
  },
  'apex_util.get_since': { params: p('p_date'), fn: (args) => since(args.p_date), sql: true },
  'apex_util.get_since_tswltz': { params: p('p_value'), fn: (args) => since(args.p_value), sql: true },
  'apex_util.feedback_enabled': { params: [], fn: () => 0 },
  'apex_util.redirect_url': {
    params: p('p_url'),
    fn: (args, rt) => {
      if (rt && text(args.p_url)) rt.redirectURL = String(args.p_url);
      return null;
    },
  },
  'apex_util.get_build_option_status': {
    params: p('p_application_id', 'p_build_option_name'),
    fn: () => 'INCLUDE',
  },
  'apex_util.public_check_authorization': {
    params: p('p_security_scheme'),
    fn: (args, rt) => authorize(rt, text(args.p_security_scheme)),
  },
  'apex_authorization.is_authorized': {
    params: p('p_authorization_name'),
    fn: (args, rt) => authorize(rt, text(args.p_authorization_name)),
  },
  // Permissive unless the developer toolbar's "view as" chose roles (devtools/view-as.ts).
  'apex_acl.has_user_role': {
    params: p('p_application_id', 'p_user_name', 'p_role_static_id'),
    fn: (args, rt) => aclCheck(rt?.renderer, rt?.ctx.session, text(args.p_role_static_id) ?? ''),
  },
  'apex_acl.has_user_any_roles': {
    params: p('p_application_id', 'p_user_name'),
    fn: (args, rt) => aclCheck(rt?.renderer, rt?.ctx.session),
  },
  'owa_util.redirect_url': {
    params: p('curl'),
    fn: (args, rt) => {
      if (rt && text(args.curl)) rt.redirectURL = String(args.curl);
      return null;
    },
  },
  v: {
    params: p('p_item'),
    fn: (args, rt) => text(sessionState(rt)?.[String(args.p_item ?? '').toUpperCase()]),
  },
  nv: {
    params: p('p_item'),
    fn: (args, rt) => {
      const value = text(sessionState(rt)?.[String(args.p_item ?? '').toUpperCase()]);
      return value === null ? null : Number(value);
    },
  },

  // apex_application globals
  'apex_application.g_flow_id': { params: [], fn: (_args, rt) => rt?.renderer.appId ?? null },
  'apex_application.g_flow_step_id': { params: [], fn: (_args, rt) => rt?.ctx.pageId ?? null },
  'apex_application.g_user': { params: [], fn: (_args, rt) => rt?.ctx.session.user ?? null },
  'apex_application.g_request': { params: [], fn: (_args, rt) => text(rt?.ctx.request) },
  'apex_application.g_instance': { params: [], fn: (_args, rt) => rt?.ctx.session.id ?? null },
  'apex_application.g_debug': { params: [], fn: () => 0 },
  'apex_application.g_print_success_message': {
    params: [],
    fn: (_args, rt) => text(rt?.ctx.session.success),
  },
  'apex_application.lf': { params: [], fn: () => '\n' },
  'apex_application.crlf': { params: [], fn: () => '\r\n' },
  'apex_application.stop_apex_engine': { params: [], fn: noop },

  // errors
  'apex_error.add_error': {
    params: p('p_message', 'p_additional_info', 'p_display_location', 'p_page_item_name'),
    fn: addError,
  },
  'apex_error.c_inline_with_field': { params: [], fn: () => 'INLINE_WITH_FIELD' },
  'apex_error.c_inline_with_field_and_notif': { params: [], fn: () => 'INLINE_WITH_FIELD_AND_NOTIFICATION' },
  'apex_error.c_inline_in_notification': { params: [], fn: () => 'INLINE_IN_NOTIFICATION' },
  'apex_error.c_on_error_page': { params: [], fn: () => 'ON_ERROR_PAGE' },
  'apex_error.have_errors_occurred': { params: [], fn: (_args, rt) => (rt?.errors.length ? 1 : 0) },

  // URLs
  'apex_page.get_url': {
    params: p(
      'p_application',
      'p_page',
      'p_session',
      'p_request',
      'p_debug',
      'p_clear_cache',
      'p_items',
      'p_values',
    ),
    fn: (args, rt) => pageUrl(rt, args),
    sql: true,
  },
  'apex_page.is_desktop_ui': { params: [], fn: () => 1 },
  'apex_page.purge_cache': { params: [], fn: noop },

  // strings
  'apex_string.split': {
    params: p('p_str', 'p_sep', 'p_limit'),
    fn: (args) => split(args.p_str, args.p_sep),
    sql: true,
  },
  'apex_string.split_numbers': {
    params: p('p_str', 'p_sep'),
    fn: (args) => split(args.p_str, args.p_sep).map(Number),
    sql: true,
  },
  'apex_string.join': {
    params: p('p_table', 'p_sep'),
    fn: (args) =>
      Array.isArray(args.p_table) ? args.p_table.join(String(args.p_sep ?? '\n')) : text(args.p_table),
  },
  'apex_string.format': {
    params: p('p_message', 'p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'),
    fn: (args) =>
      format(
        String(args.p_message ?? ''),
        Array.from({ length: 10 }, (_, index) => args[`p${index}`]),
      ),
    sql: true,
  },
  'apex_string.get_initials': {
    params: p('p_str', 'p_cnt'),
    fn: (args) =>
      text(args.p_str) === null
        ? null
        : String(args.p_str)
            .split(/\s+/u)
            .filter(Boolean)
            .map((word) => word[0]!.toUpperCase())
            .slice(0, Number(args.p_cnt ?? 2))
            .join(''),
    sql: true,
  },
  'apex_escape.html': {
    params: p('p_string'),
    fn: (args) => (text(args.p_string) === null ? null : escapeHtml(String(args.p_string))),
    sql: true,
  },
  'apex_escape.html_attribute': {
    params: p('p_string'),
    fn: (args) => (text(args.p_string) === null ? null : escapeHtml(String(args.p_string))),
    sql: true,
  },
  'apex_escape.js_literal': {
    params: p('p_string', 'p_quote'),
    fn: (args) => {
      const quote = String(args.p_quote ?? "'");
      return `${quote}${escapeJs(String(args.p_string ?? ''))}${quote}`;
    },
    sql: true,
  },
  'apex_escape.striphtml': {
    params: p('p_string'),
    fn: (args) => (text(args.p_string) === null ? null : String(args.p_string).replace(/<[^>]*>/gu, '')),
    sql: true,
  },
  'htf.escape_sc': {
    params: p('ctext'),
    fn: (args) => (text(args.ctext) === null ? null : escapeHtml(String(args.ctext))),
    sql: true,
  },
  'apex_lang.message': {
    params: p(
      'p_name',
      'p0',
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
      'p8',
      'p9',
      'p_lang',
      'p_application_id',
    ),
    fn: (args, rt) => {
      const name = String(args.p_name ?? '').toUpperCase();
      const shortcut = rt?.renderer.app.shared.find(
        (component) => component.type === 'textMessage' && component.id.toUpperCase() === name,
      );
      const template =
        (shortcut ? str(shortcut.props, 'text') || str(shortcut.props, 'message') : '') ||
        MESSAGE_FALLBACKS[name] ||
        name;
      return format(
        template,
        Array.from({ length: 10 }, (_, index) => args[`p${index}`]),
      );
    },
    sql: true,
  },
  'apex_lang.lang': {
    params: p('p_primary_text_string'),
    fn: (args) => text(args.p_primary_text_string),
    sql: true,
  },

  // output
  'htp.p': { params: p('cbuf'), fn: (args, rt) => print(rt, args.cbuf, '\n') },
  'htp.print': { params: p('cbuf'), fn: (args, rt) => print(rt, args.cbuf, '\n') },
  'htp.prn': { params: p('cbuf'), fn: (args, rt) => print(rt, args.cbuf, '') },
  'htp.prints': {
    params: p('ctext'),
    fn: (args, rt) => print(rt, args.ctext === null ? null : escapeHtml(String(args.ctext ?? '')), '\n'),
  },
  'htp.ps': {
    params: p('ctext'),
    fn: (args, rt) => print(rt, args.ctext === null ? null : escapeHtml(String(args.ctext ?? '')), ''),
  },
  'htp.br': { params: [], fn: (_args, rt) => print(rt, '<br>', '\n') },
  'htp.para': { params: [], fn: (_args, rt) => print(rt, '<p>', '\n') },
  'apex_app_setting.get_value': {
    params: p('p_name', 'p_raise_error'),
    fn: (args, rt) => settings(rt)?.get(String(args.p_name ?? '').toUpperCase()) ?? null,
    sql: true,
  },
  'apex_app_setting.set_value': {
    params: p('p_name', 'p_value', 'p_raise_error'),
    fn: (args, rt) => {
      settings(rt)?.set(String(args.p_name ?? '').toUpperCase(), text(args.p_value));
      return null;
    },
  },
  'apex_authentication.get_login_username_cookie': { params: [], fn: () => null },
  'apex_authentication.persistent_auth_enabled': { params: [], fn: () => 0 },
  'owa_util.get_cgi_env': {
    params: p('param_name'),
    fn: (args) =>
      /user-agent/iu.test(String(args.param_name ?? '')) ? 'Mozilla/5.0 (APEXlang local preview)' : null,
    sql: true,
  },
  'apex_item.hidden': {
    params: p('p_idx', 'p_value', 'p_attributes', 'p_item_id', 'p_item_label'),
    fn: (args) =>
      `<input type="hidden" name="${fname(args.p_idx)}" value="${attr(args.p_value)}"${idAttr(args.p_item_id)} ${String(args.p_attributes ?? '')}/>`,
    sql: true,
  },
  'apex_item.text': {
    params: p('p_idx', 'p_value', 'p_size', 'p_maxlength', 'p_attributes', 'p_item_id', 'p_item_label'),
    fn: (args) =>
      `<input type="text" name="${fname(args.p_idx)}" size="${attr(args.p_size ?? 20)}" maxlength="${attr(args.p_maxlength ?? 2000)}" value="${attr(args.p_value)}"${idAttr(args.p_item_id)} ${String(args.p_attributes ?? '')}/>`,
    sql: true,
  },
  'apex_item.display_and_save': {
    params: p('p_idx', 'p_value', 'p_item_id', 'p_item_label'),
    fn: (args) =>
      `<input type="hidden" name="${fname(args.p_idx)}" value="${attr(args.p_value)}"${idAttr(args.p_item_id)}/><span>${attr(args.p_value)}</span>`,
    sql: true,
  },
  'apex_item.checkbox2': {
    params: p(
      'p_idx',
      'p_value',
      'p_attributes',
      'p_checked_values',
      'p_checked_values_delimiter',
      'p_item_id',
      'p_item_label',
    ),
    fn: (args) => {
      const checked = split(args.p_checked_values, args.p_checked_values_delimiter ?? ':').includes(
        String(args.p_value ?? ''),
      );
      return `<input type="checkbox" name="${fname(args.p_idx)}" value="${attr(args.p_value)}"${checked ? ' checked="checked"' : ''}${idAttr(args.p_item_id)} ${String(args.p_attributes ?? '')}/>`;
    },
    sql: true,
  },
  'apex_item.switch': {
    params: p(
      'p_idx',
      'p_value',
      'p_on_value',
      'p_on_label',
      'p_off_value',
      'p_off_label',
      'p_item_id',
      'p_item_label',
      'p_attributes',
    ),
    fn: (args) => {
      const on = String(args.p_on_value ?? 'Y');
      const checked = String(args.p_value ?? '') === on;
      return `<span class="a-Switch"><input type="checkbox" name="${fname(args.p_idx)}" value="${attr(on)}"${checked ? ' checked' : ''}${idAttr(args.p_item_id)} aria-label="${attr(args.p_item_label)}" ${String(args.p_attributes ?? '')}/><span class="a-Switch-toggle" data-on-label="${attr(args.p_on_label ?? 'On')}" data-off-label="${attr(args.p_off_label ?? 'Off')}"></span></span>`;
    },
    sql: true,
  },
  'apex_authentication.persistent_cookies_enabled': { params: [], fn: () => 0 },
  'apex_authentication.send_login_username_cookie': { params: p('p_username'), fn: noop },
  'apex_authentication.is_public_user': { params: [], fn: () => 0 },
  'apex_authentication.is_authenticated': { params: [], fn: () => 1 },
  'apex_authentication.login': {
    params: p('p_username', 'p_password'),
    fn: (args, rt) => {
      if (rt && text(args.p_username)) rt.ctx.session.user = String(args.p_username).toUpperCase();
      return null;
    },
  },
  'apex_authentication.logout': { params: [], fn: noop },
  'apex_mail.send': {
    params: p('p_to', 'p_from', 'p_body', 'p_body_html', 'p_subj'),
    fn: (_args, rt) => {
      rt?.note('info', 'apex_mail.send: no e-mail is sent by the local preview');
      return null;
    },
  },
  'apex_mail.push_queue': { params: [], fn: noop },
};

/** Packages whose every member is accepted silently. */
const NOOP_PACKAGES = new Set([
  'apex_debug',
  'dbms_output',
  'apex_session',
  'dbms_session',
  'dbms_lock',
  'dbms_application_info',
]);

const attr = (value: unknown) => escapeHtml(value === null || value === undefined ? '' : String(value));
const fname = (index: unknown) => `f${String(Number(index ?? 1)).padStart(2, '0')}`;
const idAttr = (id: unknown) => (text(id) === null ? '' : ` id="${attr(id)}"`);

function print(rt: Runtime | undefined, value: unknown, end: string): null {
  rt?.output.push(`${value === null || value === undefined ? '' : String(value)}${end}`);
  return null;
}

/** Evaluates an authorization scheme by name; unknown or unevaluable schemes allow access. */
export let authorize = (_rt: Runtime | undefined, _name: string | null): number => 1;
export function setAuthorizer(fn: (rt: Runtime | undefined, name: string | null) => number): void {
  authorize = fn;
}

export function findStub(name: string): Stub | undefined {
  if (Object.hasOwn(STUBS, name)) return STUBS[name];
  const pkg = name.split('.')[0]!;
  if (NOOP_PACKAGES.has(pkg)) return { params: [], fn: noop };
  return undefined;
}

/** Maps positional and named arguments onto the stub's parameter names. */
export function stubArgs(stub: Stub, positional: unknown[], named: Record<string, unknown>): StubArgs {
  const args: StubArgs = { _: positional };
  positional.forEach((value, index) => {
    const name = stub.params[index];
    if (name) args[name] = value;
  });
  for (const [name, value] of Object.entries(named)) args[name] = value;
  return args;
}

for (const [name, stub] of Object.entries(STUBS)) {
  if (!stub.sql) continue;
  registerOracleFunction(name, stub.params, (values) => {
    const result = stub.fn(stubArgs(stub, values, {}), active);
    return Array.isArray(result) ? JSON.stringify(result) : (result as string | number | null);
  });
}

/**
 * Adds or replaces package stubs from a feature module (extensions/platform.ts); `sql: true`
 * stubs also become SQL functions. Call at module load, before a database is opened.
 */
export function registerStubs(stubs: Record<string, Stub>): void {
  for (const [name, stub] of Object.entries(stubs)) {
    STUBS[name] = stub;
    if (!stub.sql) continue;
    registerOracleFunction(name, stub.params, (values) => {
      const result = stub.fn(stubArgs(stub, values, {}), active);
      return Array.isArray(result) ? JSON.stringify(result) : (result as string | number | null);
    });
  }
}

/** The renderer of the running (or last) PL/SQL unit, for SQL functions called outside a unit. */
export const currentRenderer = () => active?.renderer ?? lastRenderer;
