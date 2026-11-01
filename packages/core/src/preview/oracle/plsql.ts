import { bindNames } from '../database.ts';
import type { ApexRenderer, RenderContext } from '../render.ts';
import type { ExecResult, PlsqlOwner } from '../extensions/server/plsql.ts';
import type { ConnectedOracle } from './app-data.ts';
import { OracleError, RESULT_BIND } from './protocol.ts';

type Mode = 'block' | 'functionBody' | 'plsqlExpression' | 'sqlExpression';
type Shape = 'text' | 'boolean';

// Which result shape compiled for a piece of code; booleans are found by one failed text attempt.
const shapes = new Map<string, Shape>();

const BOOLEAN_RESULT = `:${RESULT_BIND} := case when l_result then 'Y' when not l_result then 'N' end;`;

/** The anonymous block that runs `code` in its APEX role and leaves any result in :APEXREST_RESULT. */
export function oracleBlock(code: string, mode: Mode, shape: Shape): string {
  const body = code.trim().replace(/;\s*$/u, mode === 'block' || mode === 'functionBody' ? ';' : '');
  switch (mode) {
    case 'block':
      return `begin\n${body}\nend;`;
    case 'functionBody':
      return shape === 'boolean'
        ? `declare\n  l_result boolean;\n  function apexrest_fn return boolean is\n  begin\n${body}\n  end;\nbegin\n  l_result := apexrest_fn;\n  ${BOOLEAN_RESULT}\nend;`
        : `declare\n  function apexrest_fn return varchar2 is\n  begin\n${body}\n  end;\nbegin\n  :${RESULT_BIND} := apexrest_fn;\nend;`;
    case 'plsqlExpression':
      return shape === 'boolean'
        ? `declare\n  l_result boolean;\nbegin\n  l_result := (${body});\n  ${BOOLEAN_RESULT}\nend;`
        : `begin\n  :${RESULT_BIND} := (${body});\nend;`;
    case 'sqlExpression':
      return shape === 'boolean'
        ? `begin\n  select case when (${body}) then 'Y' else 'N' end into :${RESULT_BIND} from dual;\nend;`
        : `begin\n  select (${body}) into :${RESULT_BIND} from dual;\nend;`;
  }
}

/**
 * Why a unit must not reach Oracle. `DISABLE COMMIT IN PROCEDURE` stops COMMIT only in stored
 * code; COMMIT in an anonymous block, dynamic SQL and autonomous blocks would persist changes.
 */
export function transactionRisk(code: string): string | undefined {
  const bare = code
    .replace(/q'([[{(<])[\s\S]*?[\]})>]'|q'(.)[\s\S]*?\2'/giu, ' ')
    .replace(/'(?:[^']|'')*'|--[^\n]*|\/\*[\s\S]*?\*\//gu, ' ');
  if (/\bcommit\b/iu.test(bare)) return 'COMMIT';
  if (/\brollback\b(?!\s+to\b)/iu.test(bare)) return 'ROLLBACK';
  if (/\bexecute\s+immediate\b/iu.test(bare)) return 'EXECUTE IMMEDIATE';
  if (/\bdbms_sql\s*\./iu.test(bare)) return 'DBMS_SQL';
  if (/\bpragma\s+autonomous_transaction\b/iu.test(bare)) return 'PRAGMA AUTONOMOUS_TRANSACTION';
  return undefined;
}

/** APEX sessions need an installed page; a page that exists only in the local source uses the first installed one. */
function apexPage(installed: number[], page: number): number {
  return installed.includes(page) ? page : (installed.find((id) => id > 0) ?? installed[0] ?? page);
}

/** A text attempt failed because the code is a condition, not a value. */
function wrongShape(error: OracleError, mode: Mode): boolean {
  if (mode === 'block') return false;
  if (/PLS-00382|PLS-00306/u.test(error.message)) return true;
  return mode === 'sqlExpression' && /ORA-00(?:905|907|920|923|933|936)\b/u.test(error.message);
}

function failure(error: OracleError): NonNullable<ExecResult['failure']> {
  const first = error.message.split('\n')[0] ?? error.message;
  if (error.code === -20997) return { message: error.message, kind: 'engine' };
  if (error.code === -34)
    return {
      message: `${first} (the connected preview disables COMMIT; every request is rolled back)`,
      kind: 'engine',
    };
  // raise_application_error text is the application's own message, as APEX shows it.
  if (error.code <= -20000 && error.code >= -20999) return { message: first, kind: 'app' };
  return { message: error.message, kind: 'engine' };
}

/**
 * Runs a PL/SQL unit in the connected Oracle session instead of the local
 * interpreter. Bind variables are IN OUT session state; with the application
 * installed in the target, an APEX session makes v() and apex_util work too.
 */
export function runOraclePlsql(
  renderer: ApexRenderer,
  ctx: RenderContext,
  oracle: ConnectedOracle,
  code: string,
  mode: Mode,
  owner: PlsqlOwner,
): ExecResult {
  const result: ExecResult = { ok: true, value: null, output: '', errors: [] };
  const risk = transactionRisk(code);
  if (risk) {
    result.ok = false;
    result.failure = {
      message: `${risk} is not sent to Oracle by the connected preview because it could commit; the unit was skipped`,
      kind: 'unsupported',
    };
    return result;
  }
  const builtins = renderer.builtin(ctx.session, ctx.page);
  const all: Record<string, string | number | null | undefined> = {
    ...renderer.binds(ctx.session, ctx.page),
    REQUEST: ctx.request,
  };
  const names = bindNames(code).map((name) => name.toUpperCase());
  const binds = Object.fromEntries(
    [...names, RESULT_BIND].map((name) => [name, all[name] === '' ? null : (all[name] ?? null)]),
  );
  const apex = oracle.apex && !oracle.apexError ? oracle.apex : undefined;
  // Package code can change page items through apex_util; read them back from APEX session state.
  const after = apex
    ? Object.fromEntries(
        renderer
          .pageComponents(ctx, 'pageItem')
          .map((item) => item.id.toUpperCase())
          .filter((name) => apex.items.has(name) && !names.includes(name))
          .map((name) => [name, `v('${name}')`]),
      )
    : {};
  // Their current values go into the APEX session first, so an untouched item reads back unchanged.
  for (const name of Object.keys(after)) binds[name] = ctx.session.items[name] || null;
  const key = `${mode}\n${code}`;
  let shape: Shape = shapes.get(key) ?? 'text';
  try {
    for (let attempt = 0; ; attempt += 1) {
      let reply;
      try {
        reply = oracle.data.plsql({
          block: oracleBlock(code, mode, shape),
          binds,
          after,
          apex: apex
            ? {
                ...apex,
                pageId: apexPage(apex.pages, Number(ctx.pageId)),
                user: ctx.session.user || 'APEXREST_PREVIEW',
              }
            : undefined,
          htp: mode === 'block' || mode === 'functionBody',
        });
      } catch (error) {
        if (!apex || !(error instanceof OracleError) || error.code === -20994 || error.code === -20995)
          throw error;
        // APEX session setup failed (privileges, session commit, app mismatch): continue with binds only.
        oracle.apexError = error.message.split('\n')[0] ?? error.message;
        renderer.diagnose(
          'warning',
          `Connected preview: APEX session context is unavailable (${oracle.apexError}); v() returns NULL in database code`,
        );
        return runOraclePlsql(renderer, ctx, oracle, code, mode, owner);
      }
      if (reply.error && attempt === 0 && shape === 'text' && wrongShape(reply.error, mode)) {
        shape = 'boolean';
        continue;
      }
      shapes.set(key, shape);
      if (reply.error?.code === -20997)
        renderer.diagnose('error', `${owner.label}: ${reply.error.message}`, ctx.pageId, owner.component);
      if (reply.output.trim())
        renderer.diagnose(
          'info',
          `${owner.label}: DBMS_OUTPUT ${reply.output.trim().slice(0, 500)}`,
          ctx.pageId,
          owner.component,
        );
      result.output = reply.htp;
      if (reply.error) {
        result.ok = false;
        result.failure = failure(reply.error);
        return result;
      }
      const value = reply.values[RESULT_BIND] ?? null;
      result.value = shape === 'boolean' ? value === 'Y' : value;
      for (const name of [...names, ...Object.keys(after)]) {
        if (name in builtins || name === 'REQUEST') continue;
        const next = reply.values[name] ?? '';
        if (next !== (ctx.session.items[name] ?? '')) ctx.session.items[name] = next;
      }
      return result;
    }
  } catch (error) {
    result.ok = false;
    result.failure =
      error instanceof OracleError
        ? failure(error)
        : { message: (error as Error).message ?? String(error), kind: 'engine' };
    return result;
  }
}
