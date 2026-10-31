import fs from 'node:fs';
import path from 'node:path';
import { get, isObject, ref, str, type ApxComponent, type ApxObject } from '../../apexlang.ts';
import type { ProcessResult } from '../../extensions.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import type { Runtime, Stub, StubArgs } from '../server/apex-api.ts';
import { ensureDictionary } from './dictionary.ts';
import { all, bySequence, findShared, insertRow, now, one, raw, refName, replaceTable, staticIdOf } from './store.ts';

/**
 * REST without a network: REST Data Sources, the Invoke API process and
 * `apex_web_service.make_rest_request` are answered from JSON fixtures in
 * `<app>/.apex-local/rest/`. A fixture file holds either the response body itself or an
 * envelope `{ "status": 200, "headers": {...}, "body": ... }`. Lookup order for a REST Data
 * Source operation: `<staticId>.<operation>.json`, `<staticId>.<httpMethod>.json`, then
 * `<staticId>.json`; for a URL: the path segments joined with `_`, then the last segment.
 */

export interface Fixture {
  file: string;
  status: number;
  headers: Record<string, string>;
  body: unknown;
  text: string;
}

const restDir = (renderer: ApexRenderer) => path.join(renderer.app.root, '.apex-local', 'rest');

const safe = (name: string) => name.replace(/[^\w.-]+/gu, '_');

export function readFixture(renderer: ApexRenderer, candidates: string[]): Fixture | undefined {
  const dir = restDir(renderer);
  for (const candidate of candidates.filter(Boolean)) {
    const file = path.join(dir, `${safe(candidate)}.json`);
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      renderer.diagnose('warning', `REST fixture ${path.relative(renderer.app.root, file)} is not valid JSON: ${(error as Error).message}`);
      return { file, status: 200, headers: {}, body: source, text: source };
    }
    const envelope =
      isPlainObject(parsed) &&
      'body' in parsed &&
      Object.keys(parsed).every((key) => ['status', 'headers', 'body'].includes(key));
    const body = envelope ? (parsed as { body: unknown }).body : parsed;
    return {
      file,
      status: envelope ? Number((parsed as { status?: number }).status ?? 200) : 200,
      headers: envelope ? ((parsed as { headers?: Record<string, string> }).headers ?? {}) : {},
      body,
      text: typeof body === 'string' ? body : JSON.stringify(body),
    };
  }
  return undefined;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function logCall(
  renderer: ApexRenderer,
  ctx: RenderContext | undefined,
  entry: { source: string; method: string; url: string; fixture?: Fixture; body?: string | null; note?: string },
): void {
  ensureDictionary(renderer);
  const db = raw(renderer);
  insertRow(db, 'apex_local_rest_log', {
    id: Number(one(db, 'select coalesce(max(id), 0) + 1 as id from apex_local_rest_log')?.id ?? 1),
    application_id: Number(renderer.appId) || 0,
    session_id: ctx?.session.id ?? null,
    source: entry.source,
    method: entry.method.toUpperCase(),
    url: entry.url,
    fixture: entry.fixture ? path.relative(renderer.app.root, entry.fixture.file) : null,
    status_code: entry.fixture?.status ?? 404,
    request_body: entry.body ?? null,
    response_body: entry.fixture ? entry.fixture.text.slice(0, 4000) : null,
    note: entry.note ?? (entry.fixture ? null : 'no fixture'),
    created_on: now(),
  });
}

export const restLog = (renderer: ApexRenderer) => {
  ensureDictionary(renderer);
  return all(raw(renderer), 'select * from apex_local_rest_log order by id desc limit 200');
};

// ------------------------------------------------------------------ REST data sources

const operations = (source: ApxComponent) => source.children.filter((child) => child.type === 'operation');

function operationOf(source: ApxComponent, key?: string): ApxComponent | undefined {
  const all = operations(source);
  if (key) {
    const lower = key.toLowerCase();
    return all.find(
      (operation) =>
        operation.id.toLowerCase() === lower ||
        str(operation.props, 'advanced.staticId').toLowerCase() === lower ||
        str(operation.props, 'name').toLowerCase() === lower,
    );
  }
  return (
    all.find((operation) => str(operation.props, 'operation.databaseOperation') === 'fetchRows') ??
    all.find((operation) => str(operation.props, 'operation.httpMethod', 'get') === 'get')
  );
}

function sourceCandidates(source: ApxComponent, operation: ApxComponent | undefined): string[] {
  const ids = [...new Set([staticIdOf(source), source.id])];
  const opKeys = operation
    ? [...new Set([str(operation.props, 'advanced.staticId'), operation.id, str(operation.props, 'operation.httpMethod')])]
    : [];
  return [
    ...ids.flatMap((id) => opKeys.filter(Boolean).map((key) => `${id}.${key}`)),
    ...(operation && str(operation.props, 'operation.httpMethod', 'get') !== 'get' ? [] : ids),
  ];
}

interface ProfileColumn {
  name: string;
  selector: string;
  type: string;
}

function profileColumns(source: ApxComponent): ProfileColumn[] {
  return bySequence(source.children.filter((child) => child.type === 'dataProfileColumn'))
    .filter((column) => str(column.props, 'source.type', 'data') === 'data')
    .map((column) => {
      const name = (str(column.props, 'columnName') || column.id).toUpperCase();
      return {
        name,
        selector:
          str(column.props, 'parsing.selector') ||
          str(column.props, 'parsing.pathExpression') ||
          str(column.props, 'advanced.sourceAttributeName') ||
          name.toLowerCase(),
        type: str(column.props, 'source.dataType', 'varchar2'),
      };
    });
}

/** Value at a dotted path (`a.b[0].c`), case-insensitive on keys. */
function pick(value: unknown, selector: string): unknown {
  let current: unknown = value;
  for (const part of selector.replace(/^\$\.?/u, '').split(/\.|\[(\d+)\]/u).filter((piece) => piece !== undefined && piece !== '')) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current) && /^\d+$/u.test(part)) current = current[Number(part)];
    else if (isPlainObject(current)) {
      const key = Object.keys(current).find((candidate) => candidate.toLowerCase() === part.toLowerCase());
      current = key === undefined ? undefined : current[key];
    } else return undefined;
  }
  return current;
}

function rowsOf(body: unknown, rowSelector: string, single: boolean): Record<string, unknown>[] {
  let rows = rowSelector ? pick(body, rowSelector) : body;
  if (!rowSelector && isPlainObject(rows) && !single) {
    const items = pick(rows, 'items') ?? pick(rows, 'value') ?? pick(rows, 'data') ?? pick(rows, 'results');
    if (Array.isArray(items)) rows = items;
  }
  if (Array.isArray(rows)) return rows.map((row) => (isPlainObject(row) ? row : { value: row }));
  return isPlainObject(rows) ? [rows] : [];
}

const scalar = (value: unknown) =>
  value === null || value === undefined
    ? null
    : typeof value === 'object'
      ? JSON.stringify(value)
      : typeof value === 'boolean'
        ? value
          ? 'true'
          : 'false'
        : (value as string | number);

const regionCache = new WeakMap<RenderContext, Map<string, string>>();

/** Region source: materializes the REST Data Source response into a table and returns its SQL. */
export function restRegionSql(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string | undefined {
  const sourceProps = isObject(region.props.source) ? region.props.source : undefined;
  if (!sourceProps || str(sourceProps, 'location') !== 'restSource') return undefined;
  const cache = regionCache.get(ctx) ?? new Map<string, string>();
  regionCache.set(ctx, cache);
  const cached = cache.get(region.id);
  if (cached) return cached;
  const sql = materialize(renderer, ctx, region, sourceProps);
  cache.set(region.id, sql);
  return sql;
}

function materialize(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  sourceProps: ApxObject,
): string {
  const key = ref(sourceProps, 'restSource') ?? str(sourceProps, 'restSource');
  const source = key ? findShared(renderer, 'restDataSource', key) : undefined;
  const table = `apex_local_rest_${safe((source ? staticIdOf(source) : key || region.id).toLowerCase()).replaceAll('.', '_')}`;
  const declared = profileColumns(source ?? { type: '', id: '', props: {}, children: [], file: '', line: 0 });
  const regionColumns = region.children
    .filter((child) => child.type === 'column')
    .map((column) => ({ name: column.id.toUpperCase(), selector: column.id.toLowerCase(), type: str(column.props, 'source.dataType', 'varchar2') }));
  let rows: Record<string, unknown>[] = [];
  if (!source) {
    renderer.diagnose('warning', `Region ${region.id}: REST Data Source ${key || '(none)'} is not defined in the APEXlang source`, ctx.pageId, region.id);
  } else {
    const operation = operationOf(source);
    const candidates = sourceCandidates(source, operation);
    const fixture = readFixture(renderer, candidates);
    logCall(renderer, ctx, {
      source: `region ${region.id} · ${staticIdOf(source)}`,
      method: str(operation?.props ?? {}, 'operation.httpMethod', 'get'),
      url: `${str(source.props, 'source.urlPathPrefix')}${str(operation?.props ?? {}, 'operation.urlPattern')}`,
      ...(fixture ? { fixture } : {}),
    });
    if (!fixture)
      renderer.diagnose(
        'warning',
        `Region ${region.id}: no REST fixture for ${staticIdOf(source)}; add .apex-local/rest/${candidates.at(-1) ?? staticIdOf(source)}.json (the region is empty)`,
        ctx.pageId,
        region.id,
      );
    else
      rows = rowsOf(
        fixture.body,
        str(source.props, 'dataProfile.rowSelector'),
        str(source.props, 'dataProfile.containsSingleRow') === 'true',
      );
  }
  let columns = declared.length ? declared : regionColumns;
  if (!columns.length && rows[0])
    columns = Object.keys(rows[0]).map((name) => ({ name: name.toUpperCase(), selector: name, type: 'varchar2' }));
  if (!columns.length) columns = [{ name: 'VALUE', selector: 'value', type: 'varchar2' }];
  const spec = columns.map((column) => `${column.name} ${column.type === 'number' ? 'n' : /date|timestamp/u.test(column.type) ? 'd' : ''}`).join(', ');
  replaceTable(
    raw(renderer),
    table,
    spec,
    rows.map((row) =>
      Object.fromEntries(
        columns.map((column) => {
          const value = scalar(pick(row, column.selector));
          return [column.name, column.type === 'number' && value !== null && value !== '' ? Number(value) : value];
        }),
      ),
    ),
  );
  const post = str(sourceProps, 'sqlQuery') || str(sourceProps, 'postProcessing.sqlQuery');
  if (post && /#APEX\$SOURCE_DATA#/u.test(post)) return post.replaceAll('#APEX$SOURCE_DATA#', table);
  return `select * from ${table}`;
}

// ------------------------------------------------------------------ Invoke API process

function parameterValue(renderer: ApexRenderer, ctx: RenderContext, parameter: ApxComponent): string | null | undefined {
  const value = isObject(parameter.props.value) ? parameter.props.value : {};
  const type = str(value, 'type', str(value, 'item') ? 'item' : 'staticValue');
  if (type === 'item') return ctx.session.items[str(value, 'item').toUpperCase()] ?? null;
  if (type === 'staticValue') return renderer.substitute(ctx.session, str(value, 'staticValue'), ctx.page, 'RAW');
  if (type === 'restSourceDefault' || type === 'apiDefault') return undefined;
  if (type === 'null') return null;
  return undefined;
}

export function invokeApiProcess(renderer: ApexRenderer, ctx: RenderContext, process: ApxComponent): ProcessResult {
  const type = str(process.props, 'invoke.type', 'restSource');
  const parameters = process.children.filter((child) => child.type === 'parameter');
  if (type !== 'restSource') {
    const pkg = str(process.props, 'invoke.package');
    const routine = str(process.props, 'invoke.procedureOrFunction');
    const name = [pkg, routine].filter(Boolean).join('.');
    if (!name) return { ran: false };
    const args = parameters
      .map((parameter) => {
        const value = isObject(parameter.props.value) ? parameter.props.value : {};
        const item = str(value, 'item');
        const param = refName(get(parameter.props, 'name')) || parameter.id;
        if (item) return `${param} => :${item.toUpperCase()}`;
        const literal = parameterValue(renderer, ctx, parameter);
        return literal === undefined ? '' : `${param} => ${literal === null ? 'null' : `'${literal.replaceAll("'", "''")}'`}`;
      })
      .filter(Boolean);
    const ok = renderer.runCode(ctx, {
      ...process,
      props: { ...process.props, source: { plsqlCode: `begin ${name}(${args.join(', ')}); end;` } },
    });
    return { ran: ok };
  }
  const key = ref(process.props, 'invoke.restSource') ?? str(process.props, 'invoke.restSource');
  const source = key ? findShared(renderer, 'restDataSource', key) : undefined;
  if (!source) {
    renderer.diagnose('warning', `process ${process.id}: REST Data Source ${key || '(none)'} is not defined`, ctx.pageId, process.id);
    return { ran: false };
  }
  const operation = operationOf(source, ref(process.props, 'invoke.operation') ?? str(process.props, 'invoke.operation'));
  const method = str(operation?.props ?? {}, 'operation.httpMethod', 'get');
  const inputs: Record<string, string | null> = {};
  for (const parameter of parameters) {
    const value = parameterValue(renderer, ctx, parameter);
    if (value !== undefined) inputs[refName(get(parameter.props, 'name')) || parameter.id] = value;
  }
  const fixture = readFixture(renderer, sourceCandidates(source, operation));
  logCall(renderer, ctx, {
    source: `process ${process.id} · ${staticIdOf(source)}`,
    method,
    url: `${str(source.props, 'source.urlPathPrefix')}${str(operation?.props ?? {}, 'operation.urlPattern')}`,
    body: JSON.stringify(inputs),
    ...(fixture ? { fixture } : {}),
  });
  if (!fixture) {
    renderer.diagnose(
      'warning',
      `process ${process.id}: no REST fixture for ${staticIdOf(source)}.${operation?.id ?? method}; add .apex-local/rest/${staticIdOf(source)}.${operation?.id ?? method}.json`,
      ctx.pageId,
      process.id,
    );
    return { ran: false };
  }
  // Output parameters (ignoreOutput: false) take the same-named response attribute or header.
  for (const parameter of parameters) {
    if (str(parameter.props, 'parameter.ignoreOutput', 'true') !== 'false') continue;
    const value = isObject(parameter.props.value) ? parameter.props.value : {};
    const item = str(value, 'item');
    if (!item) continue;
    const name = refName(get(parameter.props, 'name')) || parameter.id;
    const header = Object.entries(fixture.headers).find(([header]) => header.toLowerCase() === name.toLowerCase());
    const output = header ? header[1] : /^(status|status_code|http_status)$/iu.test(name) && pick(fixture.body, name) === undefined ? fixture.status : pick(fixture.body, name);
    if (output !== undefined) ctx.session.items[item.toUpperCase()] = output === null ? '' : String(scalar(output));
  }
  if (fixture.status >= 400)
    return {
      ran: false,
      errors: [
        {
          type: 'error',
          location: ['page'],
          message: str(process.props, 'error.errorMessage') || `REST call returned HTTP ${fixture.status}`,
          unsafe: false,
        },
      ],
    };
  return { ran: true };
}

// ------------------------------------------------------------------ apex_web_service

let lastStatus: number | null = null;
let lastHeaders: Record<string, string> = {};

function urlCandidates(url: string, method: string): string[] {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url.split('?')[0] ?? url;
  }
  const segments = pathname.split('/').filter(Boolean);
  const joined = segments.join('_');
  const last = segments.at(-1) ?? '';
  const lower = method.toLowerCase();
  return [`${lower}.${joined}`, joined, `${lower}.${last}`, last];
}

function makeRequest(args: StubArgs, rt: Runtime | undefined): string | null {
  const renderer = rt?.renderer;
  if (!renderer) return null;
  const url = String(args.p_url ?? '');
  const method = String(args.p_http_method ?? 'GET');
  const candidates = urlCandidates(url, method);
  const fixture = readFixture(renderer, candidates);
  logCall(renderer, rt.ctx, {
    source: 'apex_web_service',
    method,
    url,
    body: args.p_body === undefined || args.p_body === null ? null : String(args.p_body),
    ...(fixture ? { fixture } : {}),
  });
  if (!fixture) {
    rt.note('warning', `apex_web_service: no REST fixture for ${url}; add .apex-local/rest/${candidates[1] || 'response'}.json (returned NULL, status 404)`);
    lastStatus = 404;
    lastHeaders = {};
    return null;
  }
  lastStatus = fixture.status;
  lastHeaders = fixture.headers;
  return fixture.text;
}

const requestParams = [
  'p_url',
  'p_http_method',
  'p_username',
  'p_password',
  'p_scheme',
  'p_proxy_override',
  'p_transfer_timeout',
  'p_body',
  'p_body_blob',
  'p_parm_name',
  'p_parm_value',
  'p_wallet_path',
  'p_wallet_pwd',
  'p_https_host',
  'p_credential_static_id',
  'p_token_url',
];

export const REST_STUBS: Record<string, Stub> = {
  'apex_web_service.make_rest_request': { params: requestParams, fn: makeRequest },
  'apex_web_service.make_rest_request_b': { params: requestParams, fn: makeRequest },
  'apex_web_service.g_status_code': { params: [], fn: () => lastStatus },
  'apex_web_service.g_reason_phrase': {
    params: [],
    fn: () => (lastStatus === null ? null : lastStatus < 400 ? 'OK' : 'Not Found'),
  },
  'apex_web_service.clear_request_headers': { params: [], fn: () => null },
  'apex_web_service.set_request_headers': { params: ['p_name_01', 'p_value_01'], fn: () => null },
  'apex_web_service.get_response_header': {
    params: ['p_name'],
    fn: (args) =>
      Object.entries(lastHeaders).find(([name]) => name.toLowerCase() === String(args.p_name ?? '').toLowerCase())?.[1] ?? null,
  },
};
