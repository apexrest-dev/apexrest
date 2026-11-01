import { get, isRef, ref, str, type ApxComponent, type ApxObject, type ApxValue } from '../apexlang.ts';
import { oracleRegExp } from '../database.ts';
import { registerExtension, type ProcessResult } from '../extensions.ts';
import type { ApexError, ApexRenderer, RenderContext, Session } from '../render.ts';
import { runOraclePlsql } from '../oracle/plsql.ts';
import { escapeHtml } from '../theme.ts';
import { enforcing, hasRole } from './devtools/view-as.ts';
import { rememberRenderer, setAuthorizer, type Runtime } from './server/apex-api.ts';
import { itemText, runPlsql, truthy, type ExecResult, type PlsqlOwner } from './server/plsql.ts';
import { pageRowValidation } from './server/rows.ts';

/**
 * Server-side logic for the local preview: a PL/SQL subset interpreter wired into processes,
 * conditions, validations, computations, item defaults and sources, branches, PL/SQL dynamic
 * content regions, dynamic actions and application-level processes, computations and
 * authorization schemes.
 */

type Mode = 'block' | 'functionBody' | 'plsqlExpression' | 'sqlExpression';

const owner = (component: ApxComponent): PlsqlOwner => ({
  label: `${component.type} ${component.id}`,
  component: component.id,
});

function sorted(components: ApxComponent[]): ApxComponent[] {
  const sequence = (component: ApxComponent) =>
    Number(get(component.props, 'execution.sequence') ?? get(component.props, 'layout.sequence') ?? 0);
  return [...components].sort((a, b) => sequence(a) - sequence(b));
}

/** Reports a failed unit; returns the user-facing message for application errors. */
function report(
  renderer: ApexRenderer,
  ctx: RenderContext,
  who: PlsqlOwner,
  result: ExecResult,
  consequence: string,
): string | undefined {
  const failure = result.failure;
  if (!failure) return undefined;
  const where = failure.line ? ` (line ${failure.line})` : '';
  if (failure.kind === 'app') {
    renderer.diagnose('info', `${who.label} raised: ${failure.message}${where}`, ctx.pageId, who.component);
    return failure.message.replace(/^ORA-20\d{3}:\s*/u, '');
  }
  renderer.diagnose(
    failure.kind === 'unsupported' ? 'info' : 'warning',
    `${who.label}: ${failure.kind === 'unsupported' ? (renderer.oracle ? 'PL/SQL not run' : 'PL/SQL not interpreted locally') : 'PL/SQL failed'} — ${failure.message}${where}; ${consequence}`,
    ctx.pageId,
    who.component,
  );
  return undefined;
}

/** The user-facing error of a failed process (its Error Message with #SQLERRM# when set). */
function failureError(component: ApxComponent, result: ExecResult, message: string): ApexError {
  const custom = str(component.props, 'error.errorMessage');
  return {
    type: 'error',
    location: ['page'],
    message: custom
      ? custom.replaceAll('#SQLERRM#', result.failure!.message).replaceAll('#SQLERRM_TEXT#', message)
      : message,
    unsafe: false,
  };
}

function run(
  renderer: ApexRenderer,
  ctx: RenderContext,
  code: string,
  mode: Mode,
  who: PlsqlOwner,
): ExecResult {
  rememberRenderer(renderer);
  // Connected mode: the whole unit runs in Oracle, with project packages and real data.
  if (renderer.oracle) return runOraclePlsql(renderer, ctx, renderer.oracle, code, mode, who);
  return runPlsql(renderer, ctx, code, mode, who);
}

// ------------------------------------------------------------------ processes

function processCode(process: ApxComponent): string {
  return (
    str(process.props, 'source.plsqlCode') ||
    str(process.props, 'settings.plsqlCode') ||
    str(process.props, 'source.code')
  );
}

function executeCode(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
  point: string,
): ProcessResult {
  const who = owner(process);
  const language = str(process.props, 'source.language');
  if (str(process.props, 'source.location') === 'restEnabledSql' || /^javascript/iu.test(language)) {
    renderer.diagnose(
      'info',
      `${who.label}: ${language || 'REST-enabled SQL'} code is not simulated locally; skipped`,
      ctx.pageId,
      process.id,
    );
    return { ran: false };
  }
  const code = processCode(process);
  if (!code.trim()) return { ran: true };
  const result = run(renderer, ctx, code, 'block', who);
  const errors: ApexError[] = [...result.errors];
  if (!result.ok) {
    // An unhandled error stops page processing and is shown (APEX rolls the transaction back);
    // code the interpreter cannot run is a preview limitation and is only skipped.
    const unsupported = result.failure?.kind === 'unsupported';
    const message =
      report(
        renderer,
        ctx,
        who,
        result,
        unsupported ? 'the process was skipped' : 'processing stopped with this error',
      ) ?? (unsupported ? undefined : result.failure!.message);
    if (message === undefined) return { ran: false };
    errors.push(failureError(process, result, message));
  }
  if (errors.length) {
    if (point === 'beforeHeader') {
      ctx.session.errors = [...(ctx.session.errors ?? []), ...errors];
      return { ran: false };
    }
    return { ran: false, errors };
  }
  return { ran: true, ...(result.redirectURL ? { redirectURL: result.redirectURL } : {}) };
}

// ------------------------------------------------------------------ conditions and expressions

function conditionCode(condition: ApxObject): { code: string; mode: Mode } | undefined {
  const type = str(condition, 'type');
  const body = str(condition, 'plsqlFunctionBody') || str(condition, 'functionBody');
  if (body && (type === 'functionBody' || type.toLowerCase().includes('function') || !type))
    return { code: body, mode: 'functionBody' };
  const sql = str(condition, 'sqlExpression');
  if (sql) return { code: sql, mode: 'sqlExpression' };
  const expression = str(condition, 'plsqlExpression') || str(condition, 'expression1');
  if (expression) return { code: expression, mode: 'plsqlExpression' };
  if (body) return { code: body, mode: 'functionBody' };
  return undefined;
}

function evaluateCondition(
  renderer: ApexRenderer,
  ctx: RenderContext,
  condition: ApxObject,
): boolean | undefined {
  const spec = conditionCode(condition);
  if (!spec) return undefined;
  const who = { label: `Server-side condition (${str(condition, 'type')})` };
  const result = run(renderer, ctx, spec.code, spec.mode, who);
  if (!result.ok) {
    report(renderer, ctx, who, result, 'treated as true');
    return true;
  }
  return truthy(result.value);
}

// ------------------------------------------------------------------ validations

function validationMessage(validation: ApxComponent): string {
  return str(validation.props, 'error.errorMessage', `${validation.id} failed`);
}

function validationItemValue(ctx: RenderContext, validation: ApxComponent): string {
  const item = str(validation.props, 'validation.item').toUpperCase();
  return ctx.session.items[item] ?? '';
}

function validationCode(validation: ApxComponent, mode: Mode): string {
  const props = validation.props;
  if (mode === 'functionBody') return str(props, 'validation.plsqlFunctionBody');
  if (mode === 'sqlExpression') return str(props, 'validation.sqlExpression');
  if (mode === 'block')
    return str(props, 'validation.plsqlCodeRaisingError') || str(props, 'validation.plsqlCode');
  return str(props, 'validation.plsqlExpression');
}

function runValidation(
  renderer: ApexRenderer,
  ctx: RenderContext,
  validation: ApxComponent,
  mode: Mode,
): ExecResult | undefined {
  const code = validationCode(validation, mode);
  if (!code.trim()) return undefined;
  const result = run(renderer, ctx, code, mode, owner(validation));
  return result;
}

/** First message added with apex_error.add_error, if any. */
const addedError = (result: ExecResult) => result.errors[0]?.message;

const booleanValidation =
  (mode: Mode) =>
  (renderer: ApexRenderer, ctx: RenderContext, validation: ApxComponent): string | null | undefined => {
    const result = runValidation(renderer, ctx, validation, mode);
    if (!result) return undefined;
    if (!result.ok) {
      const message = report(renderer, ctx, owner(validation), result, 'treated as passed');
      return message ?? null;
    }
    return addedError(result) ?? (truthy(result.value) ? null : validationMessage(validation));
  };

function errorTextValidation(
  renderer: ApexRenderer,
  ctx: RenderContext,
  validation: ApxComponent,
): string | null | undefined {
  const result = runValidation(renderer, ctx, validation, 'functionBody');
  if (!result) return undefined;
  if (!result.ok) return report(renderer, ctx, owner(validation), result, 'treated as passed') ?? null;
  const text = itemText(result.value);
  return addedError(result) ?? (text ? text : null);
}

function plsqlErrorValidation(
  renderer: ApexRenderer,
  ctx: RenderContext,
  validation: ApxComponent,
): string | null | undefined {
  const result = runValidation(renderer, ctx, validation, 'block');
  if (!result) return undefined;
  if (result.ok) return addedError(result) ?? null;
  const message = report(renderer, ctx, owner(validation), result, 'treated as passed');
  if (message === undefined) return null;
  return str(validation.props, 'error.errorMessage') || message;
}

function expressionValidation(
  renderer: ApexRenderer,
  ctx: RenderContext,
  validation: ApxComponent,
): string | null | undefined {
  const mode: Mode =
    str(validation.props, 'validation.language') === 'sql' ||
    str(validation.props, 'validation.sqlExpression')
      ? 'sqlExpression'
      : 'plsqlExpression';
  return booleanValidation(mode)(renderer, ctx, validation);
}

function queryValidation(found: boolean) {
  return (
    renderer: ApexRenderer,
    ctx: RenderContext,
    validation: ApxComponent,
  ): string | null | undefined => {
    const sql = str(validation.props, 'validation.sqlQuery');
    if (!sql) return undefined;
    const binds = renderer.binds(ctx.session, ctx.page);
    for (const [key, value] of Object.entries(binds)) if (value === '') binds[key] = null;
    binds.REQUEST = ctx.request || null;
    try {
      const rows = renderer.data.query(sql, binds, 1).rows.length > 0;
      return rows === found ? null : validationMessage(validation);
    } catch (error) {
      renderer.diagnose(
        'warning',
        `validation ${validation.id}: query failed — ${(error as Error).message}; treated as passed`,
        ctx.pageId,
        validation.id,
      );
      return null;
    }
  };
}

const itemCheck =
  (test: (value: string, validation: ApxComponent) => boolean) =>
  (_renderer: ApexRenderer, ctx: RenderContext, validation: ApxComponent): string | null =>
    test(validationItemValue(ctx, validation), validation) ? null : validationMessage(validation);

const compareValue = (validation: ApxComponent) => str(validation.props, 'validation.value');
const isDate = (value: string) => !Number.isNaN(new Date(value.replace(' ', 'T')).getTime());

// ------------------------------------------------------------------ regions

function dynamicContent(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const body = str(region.props, 'source.plsqlFunctionBody');
  const code = body || str(region.props, 'source.plsqlCode');
  const result = run(renderer, ctx, code, body ? 'functionBody' : 'block', owner(region));
  if (!result.ok) {
    const message = report(renderer, ctx, owner(region), result, 'the region shows a placeholder');
    return `<div class="apex-local-unsupported"><span class="fa fa-info-circle" aria-hidden="true"></span> PL/SQL dynamic content “${escapeHtml(str(region.props, 'name', region.id))}” could not run locally${message ? `: ${escapeHtml(message)}` : ''}.</div>`;
  }
  return result.output + (body ? itemText(result.value) : '');
}

// ------------------------------------------------------------------ application components

/** Application-level components live in shared-components/ files or inside application.apx. */
const sharedOf = (renderer: ApexRenderer, type: string) =>
  [...renderer.app.shared, ...renderer.app.app.children].filter((component) => component.type === type);

const startedSessions = new WeakSet<Session>();

function appComputations(renderer: ApexRenderer, ctx: RenderContext, points: string[]): void {
  for (const computation of sorted(sharedOf(renderer, 'appComputation'))) {
    if (!points.includes(str(computation.props, 'execution.point', 'beforeHeader'))) continue;
    if (renderer.condition(ctx, computation.props)) renderer.compute(ctx, computation);
  }
}

function appProcesses(
  renderer: ApexRenderer,
  ctx: RenderContext,
  points: string[],
  point: string,
): ApexError[] {
  const errors: ApexError[] = [];
  for (const process of sorted(sharedOf(renderer, 'appProcess'))) {
    if (!points.includes(str(process.props, 'execution.point', 'beforeHeader'))) continue;
    if (!renderer.condition(ctx, process.props)) continue;
    const type = str(process.props, 'type', 'executeCode');
    renderer.trace(ctx, {
      type: 'process',
      name: process.id,
      detail: `application process (${type}, ${point})`,
    });
    if (type !== 'executeCode') {
      renderer.diagnose(
        'info',
        `Application process ${process.id} (${type}) is not simulated`,
        ctx.pageId,
        process.id,
      );
      continue;
    }
    errors.push(...(executeCode(renderer, ctx, process, point).errors ?? []));
  }
  return errors;
}

function pageComponentsAt(renderer: ApexRenderer, ctx: RenderContext, type: string, points: string[]) {
  return sorted(renderer.pageComponents(ctx, type)).filter((component) =>
    points.includes(
      str(component.props, 'execution.point', type === 'process' ? 'processing' : 'beforeHeader'),
    ),
  );
}

// ------------------------------------------------------------------ authorization

const authorizationCache = new WeakMap<Session, Map<string, number | undefined>>();

const findScheme = (renderer: ApexRenderer, name: string) => {
  const lower = name.toLowerCase();
  return sharedOf(renderer, 'authorization').find(
    (component) =>
      component.id.toLowerCase() === lower || str(component.props, 'name').toLowerCase() === lower,
  );
};

/**
 * Evaluates an authorization scheme (1 allows, 0 denies, undefined when not evaluable). Denials
 * are only reported unless the toolbar's "view as" is active (see devtools/view-as.ts).
 */
function evaluateAuthorization(renderer: ApexRenderer, ctx: RenderContext, name: string): number | undefined {
  const lower = name.toLowerCase();
  if (lower === 'mustnotbepublicuser' || lower === 'must_not_be_public_user') return 1;
  const scheme = findScheme(renderer, name);
  if (!scheme) return undefined;
  const cache = authorizationCache.get(ctx.session) ?? new Map<string, number | undefined>();
  authorizationCache.set(ctx.session, cache);
  const viewAs = ctx.session.viewAs;
  const key = `${scheme.id}|${ctx.session.user}|${ctx.pageId}|${viewAs ? JSON.stringify(viewAs) : ''}`;
  if (cache.has(key)) return cache.get(key);
  const type = str(scheme.props, 'type');
  let allowed: number | undefined;
  const who = owner(scheme);
  const started = performance.now();
  if (viewAs?.deny.some((denied) => denied.toLowerCase() === scheme.id.toLowerCase())) allowed = 0;
  else if (/isinroleorgroup/iu.test(type)) {
    const names = get(scheme.props, 'settings.names');
    const wanted = (Array.isArray(names) ? names.map(String) : String(names ?? '').split(/[,:]/u)).filter(
      Boolean,
    );
    // Without "view as" the preview has no ACL to consult; every role is granted.
    allowed = !viewAs || wanted.some((role) => hasRole(renderer, viewAs, role)) ? 1 : 0;
  } else if (/functionbody/iu.test(type)) {
    const result = run(renderer, ctx, str(scheme.props, 'settings.plsqlFunctionBody'), 'functionBody', who);
    if (result.ok) allowed = truthy(result.value) ? 1 : 0;
    else report(renderer, ctx, who, result, 'access is allowed');
  } else if (/exists/iu.test(type)) {
    const result = run(
      renderer,
      ctx,
      `(select count(*) from (${str(scheme.props, 'settings.sqlQuery')}))`,
      'sqlExpression',
      who,
    );
    if (result.ok) allowed = Number(result.value) > 0 === !/not/iu.test(type) ? 1 : 0;
    else report(renderer, ctx, who, result, 'access is allowed');
  } else if (/itemisnotnull|itemIsNull/iu.test(type)) {
    const value = ctx.session.items[str(scheme.props, 'settings.item').toUpperCase()] ?? '';
    allowed = (value !== '') === /notnull/iu.test(type) ? 1 : 0;
  }
  cache.set(key, allowed);
  renderer.trace(ctx, {
    type: 'authorization',
    name: scheme.id,
    detail: `${type}: ${allowed === undefined ? 'not evaluated, allowed' : allowed ? 'allowed' : viewAs ? 'denied' : 'denied (allowed anyway: view as is off)'}`,
    level: allowed === 0 ? 'warning' : undefined,
    ms: performance.now() - started,
  });
  if (allowed === 0 && !viewAs)
    renderer.diagnose(
      'info',
      `Authorization scheme ${scheme.id} denies ${ctx.session.user} locally; the preview allows access anyway`,
      ctx.pageId,
      scheme.id,
    );
  if (allowed === undefined && viewAs)
    renderer.diagnose(
      'info',
      `Authorization scheme ${scheme.id} (${type}) is not evaluated locally; view as allows it`,
      ctx.pageId,
      scheme.id,
    );
  return allowed;
}

/** 0 only when "view as" enforces a denial; otherwise 1 (the default stays permissive). */
function enforcedAuthorization(renderer: ApexRenderer, ctx: RenderContext, name: string): number {
  const allowed = evaluateAuthorization(renderer, ctx, name);
  return allowed === 0 && enforcing(ctx.session) ? 0 : 1;
}

setAuthorizer((rt: Runtime | undefined, name: string | null) =>
  rt && name ? enforcedAuthorization(rt.renderer, rt.ctx, name) : 1,
);

const schemeName = (value: ApxValue | undefined) =>
  isRef(value) ? value.ref : typeof value === 'string' ? value : '';

/** Application-level, then page-level authorization; "view as" turns a denial into an error page. */
function checkPageAuthorization(renderer: ApexRenderer, ctx: RenderContext): void {
  for (const name of [
    schemeName(get(renderer.app.app.props, 'authorization.scheme')),
    schemeName(get(ctx.page.props, 'security.authorizationScheme')),
  ]) {
    if (!name || enforcedAuthorization(renderer, ctx, name)) continue;
    ctx.denied =
      str(findScheme(renderer, name)?.props ?? {}, 'error.errorMessage') ||
      `Authorization scheme ${name} denies access.`;
    return;
  }
}

// ------------------------------------------------------------------ item sources

function itemSources(renderer: ApexRenderer, ctx: RenderContext): void {
  for (const item of renderer.pageComponents(ctx, 'pageItem')) {
    if (ref(item.props, 'source.formRegion')) continue;
    const type = str(item.props, 'source.type');
    if (
      ![
        'expression',
        'functionBody',
        'sqlQuerySingleValue',
        'sqlQueryMultipleValues',
        'item',
        'staticValue',
      ].includes(type)
    )
      continue;
    const name = item.id.toUpperCase();
    const always = str(item.props, 'source.used') === 'always';
    if (!always && (ctx.session.items[name] ?? '') !== '') continue;
    const who = { label: `item ${name} source`, component: name };
    let value: string | undefined;
    if (type === 'staticValue')
      value = renderer.substitute(ctx.session, str(item.props, 'source.staticValue'), ctx.page, 'RAW');
    else if (type === 'item') value = ctx.session.items[str(item.props, 'source.item').toUpperCase()] ?? '';
    else {
      const body = str(item.props, 'source.plsqlFunctionBody');
      const sql = str(item.props, 'source.sqlQuery');
      const mode: Mode =
        type === 'functionBody'
          ? 'functionBody'
          : sql || str(item.props, 'source.sqlExpression')
            ? 'sqlExpression'
            : 'plsqlExpression';
      const code =
        type === 'functionBody'
          ? body
          : sql
            ? type === 'sqlQueryMultipleValues'
              ? `(select group_concat(v, ':') from (select (${sql}) as v))`
              : `(${sql})`
            : str(item.props, 'source.sqlExpression') || str(item.props, 'source.plsqlExpression');
      if (type === 'sqlQueryMultipleValues') {
        try {
          const result = renderer.data.query(sql, renderer.binds(ctx.session, ctx.page));
          value = result.rows.map((row) => String(row[result.columns[0]!] ?? '')).join(':');
        } catch (error) {
          renderer.diagnose(
            'warning',
            `${who.label}: query failed — ${(error as Error).message}`,
            ctx.pageId,
            name,
          );
        }
      } else if (code) {
        const result = run(renderer, ctx, code, mode, who);
        if (result.ok) value = itemText(result.value);
        else report(renderer, ctx, who, result, 'the item keeps its session value');
      }
    }
    if (value !== undefined) ctx.session.items[name] = value;
  }
}

// ------------------------------------------------------------------ registration

const RENDER_POINTS = ['afterHeader', 'beforeRegions', 'afterRegions', 'beforeFooter', 'afterFooter'];

registerExtension({
  name: 'server',
  code: (renderer, ctx, code, component) => {
    if (!code.trim()) return true;
    const who = owner(component);
    const result = run(renderer, ctx, code, 'block', who);
    const errors: ApexError[] = [...result.errors];
    if (!result.ok) {
      const unsupported = result.failure?.kind === 'unsupported';
      const message =
        report(renderer, ctx, who, result, unsupported ? 'skipped' : 'stopped with this error') ??
        (unsupported ? undefined : result.failure!.message);
      if (message !== undefined) errors.push(failureError(component, result, message));
    }
    // Submit and Ajax processing collect the errors (see ctx.processErrors); a page render shows them.
    if (errors.length) {
      if (ctx.processErrors) ctx.processErrors.push(...errors);
      else ctx.session.errors = [...(ctx.session.errors ?? []), ...errors];
    }
    return result.ok && !errors.length;
  },
  expression: (renderer, ctx, expression, language) => {
    if (!expression.trim()) return undefined;
    const mode: Mode = language === 'plsqlFunctionBody' ? 'functionBody' : language;
    const who = { label: language === 'plsqlFunctionBody' ? 'PL/SQL function body' : `${language}` };
    const result = run(renderer, ctx, expression, mode, who);
    if (!result.ok) {
      report(renderer, ctx, who, result, 'not evaluated');
      return undefined;
    }
    const value = result.value;
    return typeof value === 'object' && value !== null ? itemText(value) : value;
  },
  processes: {
    executeCode: (renderer, ctx, process, point) => executeCode(renderer, ctx, process, point),
  },
  conditions: {
    expression: evaluateCondition,
    functionBody: evaluateCondition,
    plsqlExpression: evaluateCondition,
    sqlExpression: evaluateCondition,
    functionReturningBoolean: evaluateCondition,
    plsqlFunctionBody: evaluateCondition,
    itemIsNullOrZero: (_renderer, ctx, condition) => {
      const value = ctx.session.items[str(condition, 'item').toUpperCase()] ?? '';
      return value === '' || value === '0';
    },
    itemIsNotNullAndNotZero: (_renderer, ctx, condition) => {
      const value = ctx.session.items[str(condition, 'item').toUpperCase()] ?? '';
      return value !== '' && value !== '0';
    },
    'currentPage!=page': (_renderer, ctx, condition) =>
      ctx.pageId !== str(condition, 'page', str(condition, 'value')),
    currentPageInList: (_renderer, ctx, condition) =>
      (get(condition, 'pages') instanceof Array
        ? (get(condition, 'pages') as unknown[])
        : str(condition, 'value').split(',')
      )
        .map(String)
        .includes(ctx.pageId),
    currentPageNotInList: (_renderer, ctx, condition) =>
      !(
        get(condition, 'pages') instanceof Array
          ? (get(condition, 'pages') as unknown[])
          : str(condition, 'value').split(',')
      )
        .map(String)
        .includes(ctx.pageId),
    textIsContainedInItem: (_renderer, ctx, condition) =>
      (ctx.session.items[str(condition, 'item').toUpperCase()] ?? '').includes(str(condition, 'text')),
  },
  validations: {
    functionBodyReturningBoolean: booleanValidation('functionBody'),
    functionBody: errorTextValidation,
    functionBodyReturningErrorText: errorTextValidation,
    expression: expressionValidation,
    plsqlExpression: booleanValidation('plsqlExpression'),
    sqlExpression: booleanValidation('sqlExpression'),
    plsqlError: plsqlErrorValidation,
    rowsReturned: queryValidation(true),
    exists: queryValidation(true),
    noRowsReturned: queryValidation(false),
    notExists: queryValidation(false),
    itemMatchesRegexp: itemCheck((value, validation) => {
      if (value === '') return true;
      try {
        // APEX evaluates this validation with REGEXP_LIKE (POSIX classes, Oracle semantics)
        return oracleRegExp(str(validation.props, 'validation.regexp')).test(value);
      } catch {
        return true;
      }
    }),
    'item=Value': itemCheck((value, validation) => value === compareValue(validation)),
    'item!=Value': itemCheck((value, validation) => value !== compareValue(validation)),
    itemIsContainedInValue: itemCheck(
      (value, validation) => value !== '' && compareValue(validation).includes(value),
    ),
    itemIsNotContainedInValue: itemCheck(
      (value, validation) => value === '' || !compareValue(validation).includes(value),
    ),
    itemIsNotNullOrZero: itemCheck((value) => value !== '' && Number(value) !== 0),
    itemIsNotZero: itemCheck((value) => value === '' || Number(value) !== 0),
    itemContainsNoSpaces: itemCheck((value) => !/\s/u.test(value)),
    itemIsAlphanumeric: itemCheck((value) => /^[\p{L}\p{N}]*$/u.test(value)),
    itemIsAValidDate: itemCheck((value) => value === '' || isDate(value)),
    itemIsAValidTimestamp: itemCheck((value) => value === '' || isDate(value)),
    itemContainsOnlyCharsInValue: itemCheck((value, validation) =>
      [...value].every((char) => compareValue(validation).includes(char)),
    ),
    itemContainsAtLeastOneOfCharsInValue: itemCheck((value, validation) =>
      [...compareValue(validation)].some((char) => value.includes(char)),
    ),
    itemContainsNoneOfCharsInValue: itemCheck(
      (value, validation) => ![...compareValue(validation)].some((char) => value.includes(char)),
    ),
  },
  regions: {
    plSqlDynamicContent: dynamicContent,
    dynamicContent,
  },
  routes: {
    /** Dynamic action Set Value from SQL or PL/SQL: `{ type, sqlQuery|plsqlExpression|plsqlFunctionBody, items }`. */
    'set-value': (renderer, session, request) => {
      try {
        const input = JSON.parse(request.body || '{}') as {
          type?: string;
          sqlQuery?: string;
          sqlStatement?: string;
          plsqlExpression?: string;
          plsqlFunctionBody?: string;
          items?: Record<string, string>;
        };
        const ctx = renderer.prepareSubmit(session, request.params.get('page') ?? '', '');
        for (const [name, value] of Object.entries(input.items ?? {}))
          session.items[name.toUpperCase()] = Array.isArray(value) ? value.join(':') : String(value ?? '');
        const type = input.type ?? '';
        const who = { label: `Set Value (${type || 'server'})` };
        let result: ExecResult;
        if (/^sql/iu.test(type)) {
          const sql = input.sqlQuery ?? input.sqlStatement ?? '';
          result = run(renderer, ctx, `(${sql.trim().replace(/;\s*$/u, '')})`, 'sqlExpression', who);
        } else if (/function/iu.test(type) || (input.plsqlFunctionBody && !input.plsqlExpression)) {
          result = run(renderer, ctx, input.plsqlFunctionBody ?? '', 'functionBody', who);
        } else {
          result = run(renderer, ctx, input.plsqlExpression ?? '', 'plsqlExpression', who);
        }
        if (!result.ok) {
          const message = report(renderer, ctx, who, result, 'the value was not set');
          return {
            type: 'json',
            body: JSON.stringify({ error: message ?? result.failure?.message ?? 'failed' }),
          };
        }
        return { type: 'json', body: JSON.stringify({ value: itemText(result.value) }) };
      } catch (error) {
        return { status: 400, type: 'json', body: JSON.stringify({ error: (error as Error).message }) };
      }
    },
  },
  point: (renderer, ctx, point) => {
    rememberRenderer(renderer);
    if (point === 'beforeHeader') {
      const first = !startedSessions.has(ctx.session);
      startedSessions.add(ctx.session);
      const points = first ? ['newSession', 'afterAuthentication', 'beforeHeader'] : ['beforeHeader'];
      appComputations(renderer, ctx, points);
      const errors = appProcesses(renderer, ctx, points, 'beforeHeader');
      checkPageAuthorization(renderer, ctx);
      return errors;
    }
    if (point === 'afterSubmit') {
      appComputations(renderer, ctx, ['afterSubmit']);
      for (const computation of pageComponentsAt(renderer, ctx, 'computation', ['afterSubmit']))
        if (renderer.whenButton(ctx, computation.props) && renderer.condition(ctx, computation.props))
          renderer.compute(ctx, computation);
      return appProcesses(renderer, ctx, ['afterSubmit'], 'afterSubmit');
    }
    if (point === 'processing') return appProcesses(renderer, ctx, ['processing'], 'processing');
    const errors: ApexError[] = [];
    for (const header of RENDER_POINTS) {
      appComputations(renderer, ctx, [header]);
      errors.push(...appProcesses(renderer, ctx, [header], 'beforeHeader'));
      for (const computation of pageComponentsAt(renderer, ctx, 'computation', [header]))
        if (renderer.condition(ctx, computation.props)) renderer.compute(ctx, computation);
      for (const process of pageComponentsAt(renderer, ctx, 'process', [header])) {
        if (!renderer.condition(ctx, process.props)) continue;
        if (str(process.props, 'type') === 'executeCode') executeCode(renderer, ctx, process, 'beforeHeader');
      }
      if (header === 'afterHeader') itemSources(renderer, ctx);
    }
    return errors;
  },
  rowValidation: (renderer, ctx) => pageRowValidation(renderer, ctx),
  page: (renderer) => rememberRenderer(renderer),
  authorize: (renderer, ctx, scheme) => enforcedAuthorization(renderer, ctx, scheme) === 1,
});
