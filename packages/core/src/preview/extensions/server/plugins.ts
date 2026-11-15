import fs from 'node:fs';
import path from 'node:path';
import { get, isObject, list, str, type ApxComponent, type ApxValue } from '../../apexlang.ts';
import { registerExtension, type RouteHandler, type RouteResponse } from '../../extensions.ts';
import type { ApexRenderer, RenderContext, Session } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import { registerStubs, type Runtime } from './apex-api.ts';
import { Collection, Interpreter, itemText, RecordValue, type Value } from './plsql.ts';

/**
 * Application plug-ins written in PL/SQL (`shared-components/plugins/<kind>/<name>/plugin.apx` with
 * `source.plsqlCode` and `callbacks.renderProcedureName` / `ajaxProcedureName`).
 *
 * A region or item of type `plugin/<name>` runs the plug-in's render callback in the interpreter
 * with `apex_plugin.t_region`/`t_item` and `t_plugin` records built from the component and the
 * plug-in's custom attributes (`settings.<apexlangName>`, defaulted as the plug-in declares). The
 * HTML it prints with `htp` is the region body or item element; `apex_javascript` and `apex_css`
 * add page code and files. The plug-in's `static-files` are served as `#PLUGIN_FILES#`, and
 * `apex.server.plugin` calls with its ajax identifier run its ajax callback.
 */

interface CustomAttribute {
  number: number;
  apexlangName: string;
  defaultValue: string;
  application: boolean;
}

interface AppPlugin {
  component: ApxComponent;
  name: string;
  kind: string;
  staticId: string;
  code: string;
  render: string;
  ajax: string;
  substitute: boolean;
  attributes: CustomAttribute[];
  filePrefix: string;
  /** `static-files` folder of the plug-in. */
  filesDir: string;
  /** File URLs the plug-in declares to load (`css.fileUrls`, `javaScript.fileUrls`). */
  cssFiles: string[];
  jsFiles: string[];
}

const indexes = new WeakMap<ApexRenderer, Map<string, AppPlugin>>();

/** A file URL property: one value, a list, or several lines. */
function fileUrls(component: ApxComponent, property: string): string[] {
  const value = get(component.props, property);
  const values = Array.isArray(value) ? value.map(String) : value === undefined ? [] : [String(value)];
  return values
    .flatMap((entry) => entry.split(/\r?\n/u))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function pluginIndex(renderer: ApexRenderer): Map<string, AppPlugin> {
  let index = indexes.get(renderer);
  if (index) return index;
  index = new Map();
  const attributesByDir = new Map<string, CustomAttribute[]>();
  for (const component of renderer.app.shared) {
    if (component.type !== 'customAttribute') continue;
    const dir = path.dirname(component.file);
    const entries = attributesByDir.get(dir) ?? [];
    entries.push({
      number: Number(str(component.props, 'attribute', component.id.replace(/\D/gu, ''))) || 0,
      apexlangName: str(component.props, 'apexlangName', component.id),
      defaultValue: str(component.props, 'default.value'),
      application: /^application$/iu.test(str(component.props, 'scope')),
    });
    attributesByDir.set(dir, entries);
  }
  for (const component of renderer.app.shared) {
    if (component.type !== 'plugin') continue;
    const code = str(component.props, 'source.plsqlCode');
    const kind = str(component.props, 'type');
    const relative = path.relative(renderer.app.root, path.dirname(component.file)).split(path.sep);
    index.set(component.id, {
      component,
      name: component.id,
      kind,
      staticId: str(component.props, 'staticId', component.id),
      code,
      render: str(component.props, 'callbacks.renderProcedureName'),
      ajax: str(component.props, 'callbacks.ajaxProcedureName'),
      substitute: str(component.props, 'advanced.substituteAttributeValues', 'true') !== 'false',
      attributes: attributesByDir.get(path.dirname(component.file)) ?? [],
      filePrefix: `${renderer.baseUrl}/files/plugin/${relative.at(-2) ?? kind}/${relative.at(-1) ?? component.id}/`,
      filesDir: path.join(path.dirname(component.file), 'static-files'),
      cssFiles: fileUrls(component, 'css.fileUrls'),
      jsFiles: fileUrls(component, 'javaScript.fileUrls'),
    });
  }
  indexes.set(renderer, index);
  return index;
}

/** Text of a setting value as APEX stores it: lists joined by `:`, booleans as Y/N. */
function settingText(value: ApxValue | undefined): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map((entry) => settingText(entry)).join(':');
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  if (isObject(value)) return '';
  return String(value);
}

function attributeFields(
  renderer: ApexRenderer,
  ctx: RenderContext,
  plugin: AppPlugin,
  component: ApxComponent | undefined,
  application: boolean,
  count: number,
): Record<string, Value> {
  const fields: Record<string, Value> = {};
  for (let number = 1; number <= count; number += 1)
    fields[`ATTRIBUTE_${String(number).padStart(2, '0')}`] = null;
  for (const attribute of plugin.attributes) {
    if (attribute.application !== application || !attribute.number) continue;
    const set = component ? get(component.props, `settings.${attribute.apexlangName}`) : undefined;
    let value = set === undefined ? attribute.defaultValue : settingText(set);
    if (plugin.substitute && value) value = renderer.substitute(ctx.session, value, ctx.page, 'RAW');
    fields[`ATTRIBUTE_${String(attribute.number).padStart(2, '0')}`] = value === '' ? null : value;
  }
  return fields;
}

function pluginRecord(renderer: ApexRenderer, ctx: RenderContext, plugin: AppPlugin): RecordValue {
  return new RecordValue({
    NAME: plugin.staticId,
    FILE_PREFIX: plugin.filePrefix,
    ESCAPE_OUTPUT: true,
    ...attributeFields(renderer, ctx, plugin, plugin.component, true, 15),
  });
}

/** A stable numeric id for a component, as APEX gives every component one. */
function numericId(id: string): number {
  let hash = 0;
  for (const char of id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return Math.abs(hash) + 1;
}

function regionSource(region: ApxComponent): string {
  return (
    str(region.props, 'source.sqlQuery') ||
    str(region.props, 'source.plsqlCode') ||
    str(region.props, 'source.htmlCode') ||
    str(region.props, 'source.text') ||
    (str(region.props, 'source.tableName') ? `select * from ${str(region.props, 'source.tableName')}` : '')
  );
}

function regionRecord(
  renderer: ApexRenderer,
  ctx: RenderContext,
  plugin: AppPlugin,
  region: ApxComponent,
): RecordValue {
  return new RecordValue({
    ID: numericId(region.id),
    STATIC_ID: renderer.regionDomId(region),
    NAME: str(region.props, 'name', region.id),
    TYPE: str(region.props, 'type'),
    SOURCE: regionSource(region) || null,
    AJAX_ITEMS_TO_SUBMIT:
      list(region.props, 'source.pageItemsToSubmit').map(String).join(',') ||
      str(region.props, 'source.pageItemsToSubmit') ||
      null,
    ESCAPE_OUTPUT: true,
    NO_DATA_FOUND_MESSAGE: str(region.props, 'messages.whenNoDataFound') || null,
    FETCHED_ROWS: 15,
    ERROR_MESSAGE: null,
    ...attributeFields(renderer, ctx, plugin, region, false, 25),
  });
}

function itemRecord(
  renderer: ApexRenderer,
  ctx: RenderContext,
  plugin: AppPlugin,
  item: ApxComponent,
  name: string,
): RecordValue {
  const label = renderer.label(item);
  return new RecordValue({
    ID: numericId(item.id),
    NAME: name,
    LABEL: label,
    PLAIN_LABEL: label.replace(/<[^>]*>/gu, ''),
    FORMAT_MASK: str(item.props, 'appearance.formatMask') || null,
    IS_REQUIRED: str(item.props, 'validation.valueRequired') === 'true',
    PLACEHOLDER: str(item.props, 'appearance.valuePlaceholder') || null,
    ELEMENT_WIDTH: str(item.props, 'appearance.width') || null,
    ELEMENT_MAX_LENGTH: str(item.props, 'validation.maxLength') || null,
    ELEMENT_HEIGHT: str(item.props, 'appearance.height') || null,
    ELEMENT_ATTRIBUTES: str(item.props, 'advanced.customAttributes') || null,
    ELEMENT_CSS_CLASSES: str(item.props, 'advanced.cssClasses') || null,
    ICON_CSS_CLASSES: str(item.props, 'appearance.icon') || null,
    ESCAPE_OUTPUT: true,
    LOV_DEFINITION: str(item.props, 'lov.sqlQuery') || null,
    LOV_DISPLAY_NULL: str(item.props, 'lov.displayNullValue') === 'true',
    LOV_NULL_TEXT: str(item.props, 'lov.nullDisplayValue') || null,
    LOV_NULL_VALUE: str(item.props, 'lov.nullReturnValue') || null,
    LOV_CASCADE_PARENT_ITEMS: list(item.props, 'cascadingLov.parentItems').map(String).join(',') || null,
    AJAX_ITEMS_TO_SUBMIT: list(item.props, 'cascadingLov.itemsToSubmit').map(String).join(',') || null,
    SESSION_STATE_NAME: name,
    ...attributeFields(renderer, ctx, plugin, item, false, 25),
  });
}

/** The plug-in and component an interpreter is running a callback for (apex_plugin.get_ajax_identifier). */
const running = new WeakMap<Runtime, { pageId: string; kind: 'region' | 'item'; id: string }>();
/** x01-x20, f01-f20 and widget fields of the plug-in ajax request being answered. */
const ajaxForms = new WeakMap<RenderContext, URLSearchParams>();

/** Adds the plug-in's declared files to the page, once; `#MIN#` picks the file that exists. */
function loadDeclaredFiles(renderer: ApexRenderer, ctx: RenderContext, plugin: AppPlugin): void {
  const resolve = (url: string) => {
    const local = url.startsWith('#PLUGIN_FILES#');
    let resolved = url.replaceAll('#PLUGIN_FILES#', plugin.filePrefix);
    if (resolved.includes('#MIN#')) {
      const plain = url.replace('#PLUGIN_FILES#', '').replaceAll('#MIN#', '');
      const useMin = local && !fs.existsSync(path.join(plugin.filesDir, plain));
      resolved = resolved.replaceAll('#MIN#', useMin ? '.min' : '');
    }
    return renderer.urls(resolved);
  };
  for (const url of plugin.cssFiles) ctx.cssFiles.add(resolve(url));
  for (const url of plugin.jsFiles) ctx.jsFiles.add(resolve(url));
}

function runCallback(
  renderer: ApexRenderer,
  ctx: RenderContext,
  plugin: AppPlugin,
  callback: string,
  values: Record<string, Value>,
  owner: { kind: 'region' | 'item'; id: string },
) {
  const interpreter = new Interpreter(renderer, ctx, {
    label: `plug-in ${plugin.name}`,
    component: owner.id,
  });
  running.set(interpreter, { pageId: ctx.pageId, ...owner });
  return interpreter.runDeclared(plugin.code, callback, values);
}

function failureBox(message: string): string {
  return `<div class="apex-local-unsupported"><span class="fa fa-warning" aria-hidden="true"></span> ${escapeHtml(message)}</div>`;
}

function placeholder(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  type: string,
  reason: string,
): string {
  renderer.diagnose(
    'warning',
    `Region type ${type} (${region.id}) is not simulated; a placeholder is shown (${reason})`,
    ctx.pageId,
    region.id,
  );
  return `<div class="apex-local-unsupported"><span class="fa fa-info-circle" aria-hidden="true"></span> <strong>${escapeHtml(type)}</strong> is not simulated locally.</div>`;
}

function renderRegion(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const type = str(region.props, 'type');
  const plugin = pluginIndex(renderer).get(type.slice('plugin/'.length));
  if (!plugin)
    return placeholder(renderer, ctx, region, type, 'the plug-in definition is not in the application');
  if (!plugin.code || !plugin.render)
    return placeholder(renderer, ctx, region, type, 'the plug-in has no PL/SQL render callback');
  loadDeclaredFiles(renderer, ctx, plugin);
  const result = runCallback(
    renderer,
    ctx,
    plugin,
    plugin.render,
    {
      p_region: regionRecord(renderer, ctx, plugin, region),
      p_plugin: pluginRecord(renderer, ctx, plugin),
      p_is_printer_friendly: false,
      p_param: new RecordValue({ IS_PRINTER_FRIENDLY: false }),
    },
    { kind: 'region', id: region.id },
  );
  if (!result.ok) {
    const message = `Plug-in ${plugin.name} (region ${region.id}): ${result.failure?.message ?? 'render failed'}${result.failure?.line ? ` (line ${result.failure.line})` : ''}`;
    renderer.diagnose(
      result.failure?.kind === 'unsupported' ? 'warning' : 'error',
      message,
      ctx.pageId,
      region.id,
    );
    return result.output + failureBox(message);
  }
  return result.output;
}

function renderItem(
  renderer: ApexRenderer,
  ctx: RenderContext,
  item: ApxComponent,
  name: string,
  value: string,
): string {
  const type = str(item.props, 'type');
  const plugin = pluginIndex(renderer).get(type.slice('plugin/'.length));
  if (!plugin?.code || !plugin.render) {
    renderer.diagnose(
      'warning',
      `Item type ${type} (${name}) is not simulated; a text field is shown`,
      ctx.pageId,
      name,
    );
    return `<input type="text" id="${escapeHtml(name)}" name="${escapeHtml(name)}" class="text_field apex-item-text" value="${escapeHtml(value)}" />`;
  }
  loadDeclaredFiles(renderer, ctx, plugin);
  const readOnly = str(item.props, 'readOnly.type') === 'always';
  const result = runCallback(
    renderer,
    ctx,
    plugin,
    plugin.render,
    {
      p_item: itemRecord(renderer, ctx, plugin, item, name),
      p_plugin: pluginRecord(renderer, ctx, plugin),
      p_value: value === '' ? null : value,
      p_is_readonly: readOnly,
      p_is_printer_friendly: false,
      p_param: new RecordValue({
        VALUE: value === '' ? null : value,
        VALUE_SET_BY_CONTROLLER: false,
        IS_READONLY: readOnly,
        IS_PRINTER_FRIENDLY: false,
      }),
    },
    { kind: 'item', id: item.id },
  );
  if (!result.ok) {
    const message = `Plug-in ${plugin.name} (item ${name}): ${result.failure?.message ?? 'render failed'}`;
    renderer.diagnose('error', message, ctx.pageId, name);
    return result.output + failureBox(message);
  }
  return result.output;
}

const reply = (body: unknown, status = 200): RouteResponse => ({
  status,
  type: 'json',
  body: JSON.stringify(body),
});

/** `apex.server.plugin` with an identifier from apex_plugin.get_ajax_identifier. */
const ajax: RouteHandler = (renderer, session: Session, request) => {
  const form = new URLSearchParams(request.body);
  const identifier = (form.get('p_request') ?? '').replace(/^PLUGIN=/u, '');
  const [prefix, pageId, kind, id] = identifier.split(':');
  if (prefix !== 'APEXPLUGIN' || !pageId || !id || (kind !== 'region' && kind !== 'item'))
    return reply({ error: `Unknown ajax identifier ${identifier}` }, 400);
  let json: {
    pageItems?: { itemsToSubmit?: { n: string; v: string | string[] }[] } | { n: string; v: string }[];
  } = {};
  try {
    json = JSON.parse(form.getAll('p_json').join('') || '{}') as typeof json;
  } catch {
    return reply({ error: 'p_json is not valid JSON' }, 400);
  }
  const submitted = Array.isArray(json.pageItems) ? json.pageItems : (json.pageItems?.itemsToSubmit ?? []);
  for (const entry of submitted)
    session.items[entry.n.toUpperCase()] = Array.isArray(entry.v) ? entry.v.join(':') : String(entry.v ?? '');
  if (!renderer.findPage(pageId)) return reply({ error: `Page ${pageId} not found` }, 404);
  const ctx = renderer.prepareSubmit(session, pageId, '');
  ajaxForms.set(ctx, form);
  const component = renderer
    .pageComponents(ctx, kind === 'region' ? 'region' : 'pageItem')
    .find((candidate) => candidate.id.toUpperCase() === id.toUpperCase());
  if (!component) return reply({ error: `${kind} ${id} not found on page ${pageId}` }, 404);
  const plugin = pluginIndex(renderer).get(str(component.props, 'type').slice('plugin/'.length));
  if (!plugin?.code || !plugin.ajax) return reply({ error: `${kind} ${id} has no ajax callback` }, 404);
  const values: Record<string, Value> =
    kind === 'region'
      ? {
          p_region: regionRecord(renderer, ctx, plugin, component),
          p_plugin: pluginRecord(renderer, ctx, plugin),
        }
      : {
          p_item: itemRecord(renderer, ctx, plugin, component, component.id.toUpperCase()),
          p_plugin: pluginRecord(renderer, ctx, plugin),
        };
  values.p_param = new RecordValue({});
  const result = runCallback(renderer, ctx, plugin, plugin.ajax, values, { kind, id: component.id });
  if (!result.ok) {
    const message = `Plug-in ${plugin.name} ajax (${kind} ${id}): ${result.failure?.message ?? 'failed'}`;
    renderer.diagnose('error', message, pageId, component.id);
    return reply({ error: message }, 500);
  }
  const body = result.output.trim();
  return { status: 200, type: /^[{[]/u.test(body) ? 'json' : 'text', body: result.output };
};

// ------------------------------------------------------------------ APIs plug-ins call

const dataParams = [
  'p_sql_statement',
  'p_min_columns',
  'p_max_columns',
  'p_data_type_list',
  'p_component_name',
  'p_search_type',
  'p_search_column_no',
  'p_search_string',
  'p_first_row',
  'p_max_rows',
];

const textOf = (value: unknown) => (value === null || value === undefined ? null : itemText(value as Value));

/** Runs a plug-in's region or LOV query with the session's binds; rows keep their column order. */
function pluginData(rt: Runtime | undefined, args: Record<string, unknown>) {
  const sql = text(args.p_sql_statement);
  if (!rt || !sql)
    return {
      columns: [] as string[],
      rows: [] as Record<string, unknown>[],
      types: new Map<string, string>(),
    };
  const binds = rt.renderer.binds(rt.ctx.session, rt.ctx.page);
  const result = rt.renderer.data.query(
    rt.renderer.substitute(rt.ctx.session, sql, rt.ctx.page, 'RAW'),
    binds,
    10_000,
  );
  let rows: Record<string, unknown>[] = result.rows;
  const search = text(args.p_search_string);
  const column = Number(args.p_search_column_no ?? 0);
  if (search && column > 0 && result.columns[column - 1]) {
    const name = result.columns[column - 1]!;
    const needle = search.toLowerCase();
    rows = rows.filter((row) => {
      const value = String(row[name] ?? '').toLowerCase();
      return /^EXACT/iu.test(String(args.p_search_type ?? '')) ? value === needle : value.includes(needle);
    });
  }
  const first = Math.max(1, Number(args.p_first_row ?? 1));
  const max =
    args.p_max_rows === null || args.p_max_rows === undefined ? rows.length : Number(args.p_max_rows);
  rows = rows.slice(first - 1, first - 1 + max);
  const declared = String(args.p_data_type_list ?? '')
    .split(',')
    .map((entry) => entry.trim().toUpperCase());
  const types = new Map<string, string>();
  result.columns.forEach((name, index) => {
    const sample = rows.find((row) => row[name] !== null && row[name] !== undefined)?.[name];
    types.set(name, declared[index] || (typeof sample === 'number' ? 'NUMBER' : 'VARCHAR2'));
  });
  return { columns: result.columns, rows, types };
}

/** One `apex_plugin_util.t_value`: the value in the field of its data type. */
function columnValue(value: unknown, type = 'VARCHAR2'): RecordValue {
  const fields: Record<string, Value> = {
    VARCHAR2_VALUE: null,
    NUMBER_VALUE: null,
    DATE_VALUE: null,
    TIMESTAMP_VALUE: null,
    CLOB_VALUE: null,
  };
  const plain = value === null || value === undefined ? null : (value as Value);
  if (/^NUMBER/u.test(type)) fields.NUMBER_VALUE = plain === null ? null : Number(plain);
  else if (/^DATE/u.test(type)) fields.DATE_VALUE = plain;
  else if (/^TIMESTAMP/u.test(type)) fields.TIMESTAMP_VALUE = plain;
  else if (type === 'CLOB') fields.CLOB_VALUE = plain;
  else fields.VARCHAR2_VALUE = plain === null ? null : itemText(plain);
  return new RecordValue(fields);
}

const text = (value: unknown) =>
  value === null || value === undefined || value === '' ? null : String(value);
const truthy = (value: unknown, fallback: boolean) =>
  value === null || value === undefined
    ? fallback
    : value === true || /^(?:y|yes|true|1)$/iu.test(String(value));

function jsValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  return JSON.stringify(String(value)).replaceAll('</', '<\\/');
}

/** apex_json output state of one running unit. */
interface JsonWriter {
  stack: { array: boolean; count: number }[];
}
const writers = new WeakMap<Runtime, JsonWriter>();
function writer(rt: Runtime): JsonWriter {
  let state = writers.get(rt);
  if (!state) writers.set(rt, (state = { stack: [] }));
  return state;
}
function emit(rt: Runtime | undefined, name: unknown, value: string): null {
  if (!rt) return null;
  const state = writer(rt);
  const top = state.stack.at(-1);
  const comma = top && top.count > 0 ? ',' : '';
  if (top) top.count += 1;
  const key =
    top && !top.array && name !== null && name !== undefined ? `${JSON.stringify(String(name))}:` : '';
  rt.output.push(`${comma}${key}${value}`);
  return null;
}
function open(rt: Runtime | undefined, name: unknown, array: boolean): null {
  if (!rt) return null;
  emit(rt, name, array ? '[' : '{');
  writer(rt).stack.push({ array, count: 0 });
  return null;
}
function close(rt: Runtime | undefined, array: boolean): null {
  if (!rt) return null;
  const state = writer(rt);
  if (state.stack.length) state.stack.pop();
  rt.output.push(array ? ']' : '}');
  return null;
}
function writeJson(rt: Runtime | undefined, args: Record<string, unknown> & { _: unknown[] }): null {
  // write(p_name, p_value[, p_write_null]) in an object, write(p_value) in an array
  const top = rt ? writer(rt).stack.at(-1) : undefined;
  const positional = args._;
  const inArray = top?.array ?? false;
  const name = inArray ? null : (args.p_name ?? positional[0]);
  const value = inArray ? (args.p_value ?? positional[0]) : (args.p_value ?? positional[1]);
  const writeNull = truthy(args.p_write_null ?? (inArray ? positional[1] : positional[2]), false);
  if ((value === null || value === undefined) && !writeNull && !inArray) return null;
  return emit(
    rt,
    name,
    value === null || value === undefined
      ? 'null'
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(String(value)),
  );
}

function addFile(rt: Runtime | undefined, args: Record<string, unknown>, extension: 'js' | 'css'): null {
  if (!rt) return null;
  const name = text(args.p_name);
  if (!name) return null;
  const directory = rt.renderer
    .urls(text(args.p_directory) ?? `${'#IMAGE_PREFIX#'}libraries/`)
    .replace(/#PLUGIN_FILES#/gu, '');
  const version = text(args.p_version) ?? '';
  const skip = truthy(args.p_skip_extension, false);
  const url = `${directory}${name}${version}${skip ? '' : `.${extension}`}`;
  (extension === 'js' ? rt.ctx.jsFiles : rt.ctx.cssFiles).add(url);
  return null;
}

registerStubs({
  'apex_javascript.add_value': {
    params: ['p_value', 'p_add_comma'],
    fn: (args) => `${jsValue(args.p_value)}${truthy(args.p_add_comma, true) ? ',' : ''}`,
    sql: true,
  },
  'apex_javascript.add_attribute': {
    params: ['p_name', 'p_value', 'p_omit_null', 'p_add_comma'],
    fn: (args) => {
      const omit = truthy(args.p_omit_null, true);
      if (omit && (args.p_value === null || args.p_value === undefined || args.p_value === '')) return '';
      return `${JSON.stringify(String(args.p_name ?? ''))}:${jsValue(args.p_value)}${truthy(args.p_add_comma, true) ? ',' : ''}`;
    },
    sql: true,
  },
  'apex_javascript.escape': {
    params: ['p_text'],
    fn: (args) => (text(args.p_text) === null ? null : JSON.stringify(String(args.p_text)).slice(1, -1)),
    sql: true,
  },
  'apex_javascript.add_onload_code': {
    params: ['p_code', 'p_key'],
    fn: (args, rt) => {
      if (rt && text(args.p_code)) rt.ctx.onload.push(String(args.p_code));
      return null;
    },
  },
  'apex_javascript.add_inline_code': {
    params: ['p_code', 'p_key'],
    fn: (args, rt) => {
      if (rt && text(args.p_code)) rt.ctx.onload.unshift(String(args.p_code));
      return null;
    },
  },
  'apex_javascript.add_library': {
    params: ['p_name', 'p_directory', 'p_version', 'p_skip_extension', 'p_check_to_add_minified', 'p_key'],
    fn: (args, rt) => addFile(rt, args, 'js'),
  },
  'apex_javascript.add_3rd_party_library_file': {
    params: ['p_library', 'p_file_name', 'p_directory', 'p_version'],
    fn: (args, rt) =>
      addFile(
        rt,
        {
          p_name: args.p_file_name,
          p_directory: args.p_directory ?? `#IMAGE_PREFIX#libraries/${String(args.p_library ?? '')}/`,
        },
        'js',
      ),
  },
  'apex_css.add_file': {
    params: [
      'p_name',
      'p_directory',
      'p_version',
      'p_skip_extension',
      'p_media_query',
      'p_attributes',
      'p_key',
    ],
    fn: (args, rt) => addFile(rt, args, 'css'),
  },
  'apex_css.add': {
    params: ['p_css', 'p_key'],
    fn: (args, rt) => {
      if (rt && text(args.p_css))
        rt.ctx.onload.push(
          `apex.jQuery('head').append(${JSON.stringify(`<style>${String(args.p_css)}</style>`)});`,
        );
      return null;
    },
  },
  'apex_plugin.get_ajax_identifier': {
    params: [],
    fn: (_args, rt) => {
      const current = rt ? running.get(rt) : undefined;
      return current ? `APEXPLUGIN:${current.pageId}:${current.kind}:${current.id}` : null;
    },
  },
  'apex_plugin_util.escape': {
    params: ['p_value', 'p_escape'],
    fn: (args) =>
      text(args.p_value) === null
        ? null
        : truthy(args.p_escape, true)
          ? escapeHtml(String(args.p_value))
          : String(args.p_value),
    sql: true,
  },
  'apex_plugin_util.replace_substitutions': {
    params: ['p_value', 'p_escape'],
    fn: (args, rt) =>
      text(args.p_value) === null || !rt
        ? text(args.p_value)
        : rt.renderer.substitute(
            rt.ctx.session,
            String(args.p_value),
            rt.ctx.page,
            truthy(args.p_escape, true) ? 'HTML' : 'RAW',
          ),
  },
  'apex_plugin_util.page_item_names_to_jquery': {
    params: ['p_page_item_names'],
    fn: (args) =>
      (text(args.p_page_item_names) ?? '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => `#${name.toUpperCase()}`)
        .join(',') || null,
    sql: true,
  },
  'apex_plugin_util.debug_region': { params: [], fn: () => null },
  'apex_plugin_util.debug_page_item': { params: [], fn: () => null },
  'apex_plugin_util.debug_dynamic_action': { params: [], fn: () => null },
  'apex_plugin_util.debug_process': { params: [], fn: () => null },
  'apex_plugin_util.set_component_values': { params: [], fn: () => null },
  'apex_plugin_util.clear_component_values': { params: [], fn: () => null },
  'apex_plugin_util.get_display_data': {
    params: [
      'p_sql_statement',
      'p_min_columns',
      'p_max_columns',
      'p_component_name',
      'p_display_column_no',
      'p_search_column_no',
      'p_search_string',
      'p_display_extra',
    ],
    fn: (args, rt) => {
      if (!rt || text(args.p_sql_statement) === null) return text(args.p_search_string);
      try {
        const rows = rt.renderer.data.query(
          String(args.p_sql_statement),
          rt.renderer.binds(rt.ctx.session, rt.ctx.page),
          10_000,
        );
        const search = text(args.p_search_string);
        const display = Number(args.p_display_column_no ?? 1) - 1;
        const searched = Number(args.p_search_column_no ?? 2) - 1;
        const row = rows.rows.find(
          (entry) => String(entry[rows.columns[searched]!] ?? '') === (search ?? ''),
        );
        return row ? itemText((row[rows.columns[display]!] ?? null) as Value) : search;
      } catch {
        return text(args.p_search_string);
      }
    },
  },
  'apex_plugin_util.c_data_type_varchar2': { params: [], fn: () => 'VARCHAR2' },
  'apex_plugin_util.c_data_type_number': { params: [], fn: () => 'NUMBER' },
  'apex_plugin_util.c_data_type_date': { params: [], fn: () => 'DATE' },
  'apex_plugin_util.c_data_type_timestamp': { params: [], fn: () => 'TIMESTAMP' },
  'apex_plugin_util.c_data_type_timestamp_tz': { params: [], fn: () => 'TIMESTAMP WITH TIME ZONE' },
  'apex_plugin_util.c_data_type_timestamp_ltz': { params: [], fn: () => 'TIMESTAMP WITH LOCAL TIME ZONE' },
  'apex_plugin_util.c_data_type_clob': { params: [], fn: () => 'CLOB' },
  'apex_plugin_util.c_data_type_blob': { params: [], fn: () => 'BLOB' },
  'apex_plugin_util.c_search_like_ignore': { params: [], fn: () => 'LIKE_IGNORE' },
  'apex_plugin_util.c_search_contains_ignore': { params: [], fn: () => 'CONTAINS_IGNORE' },
  'apex_plugin_util.c_search_exact_ignore': { params: [], fn: () => 'EXACT_IGNORE' },
  'apex_plugin_util.get_data': {
    params: dataParams,
    fn: (args, rt) => {
      const result = pluginData(rt, args);
      return Collection.of(
        result.columns.map((column) => Collection.of(result.rows.map((row) => textOf(row[column])))),
      );
    },
  },
  'apex_plugin_util.get_data2': {
    params: dataParams,
    fn: (args, rt) => {
      const result = pluginData(rt, args);
      return Collection.of(
        result.columns.map(
          (column) =>
            new RecordValue({
              NAME: column,
              DATA_TYPE: result.types.get(column) ?? 'VARCHAR2',
              FORMAT_MASK: null,
              VALUE_LIST: Collection.of(
                result.rows.map((row) => columnValue(row[column] ?? null, result.types.get(column))),
              ),
            }),
        ),
      );
    },
  },
  'apex_plugin_util.get_column_no': {
    params: ['p_attribute_label', 'p_column_alias', 'p_column_value_list', 'p_is_required', 'p_data_type'],
    raw: true,
    fn: (args) => {
      const alias = text(args.p_column_alias);
      if (alias === null) {
        if (truthy(args.p_is_required, true))
          throw new Error(`ORA-20001: ${String(args.p_attribute_label ?? 'Column')} is required and not set`);
        return null;
      }
      const list = args.p_column_value_list;
      const columns = list instanceof Collection ? list.values() : [];
      const index = columns.findIndex(
        (column) =>
          (column instanceof RecordValue ? String(column.fields.NAME ?? '') : '').toUpperCase() ===
          alias.toUpperCase(),
      );
      if (index < 0) {
        if (/^\d+$/u.test(alias)) return Number(alias);
        throw new Error(
          `ORA-20001: column ${alias} for ${String(args.p_attribute_label ?? 'attribute')} is not in the region source`,
        );
      }
      return index + 1;
    },
  },
  'apex_plugin_util.get_value_as_varchar2': {
    params: ['p_data_type', 'p_value', 'p_format_mask'],
    raw: true,
    fn: (args) => {
      const value = args.p_value;
      if (!(value instanceof RecordValue)) return text(value);
      for (const field of ['VARCHAR2_VALUE', 'NUMBER_VALUE', 'DATE_VALUE', 'TIMESTAMP_VALUE', 'CLOB_VALUE']) {
        const entry = value.fields[field];
        if (entry !== null && entry !== undefined) return itemText(entry as Value);
      }
      return null;
    },
  },
  'apex_json.initialize_output': { params: [], fn: () => null },
  'apex_json.initialize_clob_output': { params: [], fn: () => null },
  'apex_json.flush': { params: [], fn: () => null },
  'apex_json.open_object': { params: ['p_name'], fn: (args, rt) => open(rt, args.p_name, false) },
  'apex_json.open_array': { params: ['p_name'], fn: (args, rt) => open(rt, args.p_name, true) },
  'apex_json.close_object': { params: [], fn: (_args, rt) => close(rt, false) },
  'apex_json.close_array': { params: [], fn: (_args, rt) => close(rt, true) },
  'apex_json.close_all': {
    params: [],
    fn: (_args, rt) => {
      if (!rt) return null;
      const state = writer(rt);
      while (state.stack.length) close(rt, state.stack.at(-1)!.array);
      return null;
    },
  },
  'apex_json.write': { params: ['p_name', 'p_value', 'p_write_null'], fn: (args, rt) => writeJson(rt, args) },
  ...Object.fromEntries(
    Array.from({ length: 20 }, (_, index) => {
      const field = `x${String(index + 1).padStart(2, '0')}`;
      return [
        `apex_application.g_${field}`,
        {
          params: [],
          fn: (_args: unknown, rt: Runtime | undefined) =>
            rt ? text(ajaxForms.get(rt.ctx)?.get(field)) : null,
        },
      ];
    }),
  ),
  'apex_application.g_widget_action': {
    params: [],
    fn: (_args, rt) => (rt ? text(ajaxForms.get(rt.ctx)?.get('p_widget_action')) : null),
  },
  'apex_application.g_widget_name': {
    params: [],
    fn: (_args, rt) => (rt ? text(ajaxForms.get(rt.ctx)?.get('p_widget_name')) : null),
  },
});

const CLIENT = String.raw`
(function ($) {
  "use strict";
  var base = location.pathname.replace(/\/[^/]*$/, "");
  // Calls of plug-ins written in PL/SQL carry identifiers from apex_plugin.get_ajax_identifier.
  $.ajaxPrefilter(function (options) {
    if (typeof options.url === "string" && /(^|\/)wwv_flow\.ajax/.test(options.url) &&
        typeof options.data === "string" && /(^|&)p_request=PLUGIN%3DAPEXPLUGIN%3A/.test(options.data)) {
      options.url = base + "/__apex/x/plugins.ajax";
    }
  });
})(apex.jQuery);
`;

registerExtension({
  name: 'plsql-plugins',
  regions: { plugin: (renderer, ctx, region) => renderRegion(renderer, ctx, region) },
  items: { plugin: (renderer, ctx, item, name, value) => renderItem(renderer, ctx, item, name, value) },
  routes: { 'plugins.ajax': ajax },
  client: CLIENT,
});
