import { oracleNumberText, type Binds, type Row } from '../../database.ts';
import type { ApexError, ApexRenderer, RenderContext } from '../../render.ts';
import { RESERVED_BUILTINS } from '../../render.ts';
import { findStub, stubArgs, withRuntime, type Runtime } from './apex-api.ts';
import { commitWork, rollbackWork, savepoint } from './transaction.ts';
import { buildLibrary, pickOverload, type PlsqlLibrary, type PlsqlPackage } from './packages.ts';
import {
  isOp,
  isWord,
  matchParen,
  parseArgs,
  parseExpression,
  parseProgram,
  Parser,
  PlsqlSyntaxError,
  type Arg,
  type Block,
  type Decl,
  type Expr,
  type Routine,
  type Stmt,
  type Target,
  type Token,
} from './parser.ts';

/**
 * A small PL/SQL interpreter for the local preview. Control flow runs in JavaScript;
 * every expression and SQL statement is handed to SQLite (through the Oracle shims in
 * database.ts) with PL/SQL variables passed as bind values.
 */

export class RecordValue {
  readonly fields: Record<string, Value>;
  constructor(fields: Record<string, Value> = {}) {
    this.fields = fields;
  }
}

export class Collection {
  readonly items = new Map<number | string, Value>();
  static of(values: Value[]): Collection {
    const collection = new Collection();
    values.forEach((value, index) => collection.items.set(index + 1, value));
    return collection;
  }
  keys(): (number | string)[] {
    return [...this.items.keys()].sort((a, b) =>
      typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)),
    );
  }
  values(): Value[] {
    return this.keys().map((key) => this.items.get(key) ?? null);
  }
}

export type Value = string | number | boolean | null | RecordValue | Collection;
type VarType = 'number' | 'string' | 'boolean' | 'record' | 'collection' | 'any';

interface Variable {
  value: Value;
  type: VarType;
  constant: boolean;
}

interface CursorDef {
  params: { name: string; type: string; init?: Expr }[];
  sql: Expr;
}

class Scope {
  readonly vars = new Map<string, Variable>();
  readonly cursors = new Map<string, CursorDef>();
  readonly exceptions = new Set<string>();
  readonly routines = new Map<string, { routine: Routine; scope: Scope }>();
  /** All routines of a name declared in this scope (package overloads). */
  readonly overloads = new Map<string, Routine[]>();
  readonly collectionTypes = new Set<string>();
  readonly parent: Scope | undefined;
  constructor(parent?: Scope) {
    this.parent = parent;
  }
  find<T>(pick: (scope: Scope) => T | undefined): T | undefined {
    for (let scope: Scope | undefined = this; scope; scope = scope.parent) {
      const found = pick(scope);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  variable(name: string) {
    return this.find((scope) => scope.vars.get(name));
  }
}

const PREDEFINED: Record<string, number> = {
  no_data_found: 100,
  too_many_rows: -1422,
  zero_divide: -1476,
  value_error: -6502,
  dup_val_on_index: -1,
  invalid_number: -1722,
  case_not_found: -6592,
  program_error: -6501,
  others: -20999,
};

const PREDEFINED_TEXT: Record<string, string> = {
  no_data_found: 'ORA-01403: no data found',
  too_many_rows: 'ORA-01422: exact fetch returns more than requested number of rows',
  zero_divide: 'ORA-01476: divisor is equal to zero',
  value_error: 'ORA-06502: PL/SQL: numeric or value error',
  dup_val_on_index: 'ORA-00001: unique constraint violated',
  invalid_number: 'ORA-01722: invalid number',
  case_not_found: 'ORA-06592: CASE not found while executing CASE statement',
};

/** A PL/SQL exception. `app` errors are raised by the application; `engine` errors come from SQLite. */
export class PlsqlException extends Error {
  readonly exName: string;
  readonly code: number;
  readonly kind: 'app' | 'engine';
  readonly sqlerrm: string;
  constructor(exName: string, code: number, message: string, kind: 'app' | 'engine', sqlerrm?: string) {
    super(message);
    this.exName = exName;
    this.code = code;
    this.kind = kind;
    this.sqlerrm = sqlerrm ?? message;
  }
}

/** A construct the interpreter cannot run; reported and the unit is abandoned. */
export class PlsqlUnsupported extends Error {
  readonly line: number;
  constructor(message: string, line: number) {
    super(message);
    this.line = line;
  }
}

type Signal = { kind: 'exit' | 'continue'; label?: string } | { kind: 'return'; value: Value } | undefined;

const COLLECTION_TYPES = new Set([
  'apex_t_varchar2',
  'apex_t_number',
  'apex_t_clob',
  'apex_application_global.vc_arr2',
  'apex_application_global.n_arr',
  'sys.odcivarchar2list',
  'sys.odcinumberlist',
  'odcivarchar2list',
  'odcinumberlist',
  'dbms_sql.varchar2_table',
  'dbms_sql.number_table',
  'apex_plugin_util.t_column_value_list',
  'apex_plugin_util.t_column_value_list2',
  'apex_plugin_util.t_column_list',
  'apex_t_string_pairs',
]);

const COMPARISON = new Set(['=', '<', '>', '<=', '>=', '<>', '!=', '~=', '^=']);
const LOOP_LIMIT = 100_000;
const MAX_CALL_DEPTH = 50;

function typeOf(type: string, scope: Scope): VarType {
  const lower = type.toLowerCase().replace(/\s+/gu, ' ').trim();
  if (/%rowtype$/u.test(lower)) return 'record';
  if (COLLECTION_TYPES.has(lower) || scope.find((s) => (s.collectionTypes.has(lower) ? true : undefined)))
    return 'collection';
  if (
    /^(number|integer|int|pls_integer|binary_integer|simple_integer|natural|naturaln|positive|positiven|signtype|float|real|decimal|numeric|dec|smallint|binary_double|binary_float)\b/u.test(
      lower,
    )
  )
    return 'number';
  if (/^boolean\b/u.test(lower)) return 'boolean';
  if (/^(n?varchar2?|n?char|n?clob|long|string|date|timestamp|interval|rowid|urowid|raw)\b/u.test(lower))
    return 'string';
  return 'any';
}

function toSql(value: Value | undefined): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Collection) return JSON.stringify(value.values().map((item) => toSql(item)));
  if (value instanceof RecordValue) return null;
  if (value === '') return null;
  return value;
}

export function truthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return !['', '0', 'false', 'n', 'no'].includes(value.trim().toLowerCase());
  return true;
}

/** Session-state text for a PL/SQL value. */
export function itemText(value: Value | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Collection) return value.values().map(itemText).join(':');
  if (value instanceof RecordValue) return '';
  return typeof value === 'number' ? oracleNumberText(value) : String(value);
}

function sameValue(left: Value, right: Value): boolean {
  if (left === null || right === null) return false;
  const a = toSql(left);
  const b = toSql(right);
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return a === b;
}

function engineError(error: unknown): PlsqlException {
  if (error instanceof PlsqlException) return error;
  const message = (error as Error).message ?? String(error);
  if (/UNIQUE constraint failed/u.test(message))
    return new PlsqlException('dup_val_on_index', -1, `ORA-00001: ${message}`, 'engine');
  return new PlsqlException('others', -20999, message, 'engine');
}

interface Piece {
  pre: string;
  text: string;
  token?: Token;
  direct?: { value: Value };
}

export interface PlsqlOwner {
  /** Human label used in diagnostics, e.g. `process save-task`. */
  label: string;
  component?: string;
}

export interface ExecResult {
  ok: boolean;
  value: Value;
  output: string;
  errors: ApexError[];
  redirectURL?: string;
  failure?: { message: string; kind: 'app' | 'engine' | 'unsupported'; line?: number };
}

const parseCache = new Map<string, Stmt[] | PlsqlSyntaxError>();
function parsed(code: string): Stmt[] {
  let entry = parseCache.get(code);
  if (!entry) {
    try {
      entry = parseProgram(code);
    } catch (error) {
      if (!(error instanceof PlsqlSyntaxError)) throw error;
      entry = error;
    }
    if (parseCache.size > 500) parseCache.clear();
    parseCache.set(code, entry);
  }
  if (entry instanceof PlsqlSyntaxError) throw entry;
  return entry;
}

const libraries = new WeakMap<ApexRenderer, PlsqlLibrary>();
/**
 * The application's PL/SQL units from the local database (see packages.ts). Connected previews
 * run the application's packages in Oracle, so they have none locally.
 */
export function plsqlLibrary(renderer: ApexRenderer): PlsqlLibrary {
  let library = libraries.get(renderer);
  if (!library) {
    library = renderer.oracle
      ? buildLibrary([])
      : buildLibrary(typeof renderer.db.plsqlUnits === 'function' ? renderer.db.plsqlUnits() : []);
    libraries.set(renderer, library);
    for (const problem of library.problems) renderer.diagnose('warning', `PL/SQL unit: ${problem}`);
  }
  return library;
}

/** Package state lives for one request, like a pooled APEX database session that was reset. */
const packageStates = new WeakMap<RenderContext, Map<string, Scope>>();

/** `[schema.]package.member` or `[schema.]routine` in a call chain of lower-case names. */
function libraryTarget(
  library: PlsqlLibrary,
  names: string[],
):
  | { pkg?: PlsqlPackage; member: string; rest: string[] }
  | { routine: Routine[]; rest: string[] }
  | undefined {
  for (const offset of names.length > 2 ? [0, 1] : [0]) {
    const pkg = library.packages.get(names[offset]!);
    if (pkg && names[offset + 1]) return { pkg, member: names[offset + 1]!, rest: names.slice(offset + 2) };
  }
  const standalone = library.routines.get(names.at(-1)!);
  if (standalone && names.length <= 2 && (names.length === 1 || !library.packages.has(names[0]!)))
    return { routine: standalone, rest: [] };
  return undefined;
}

const declarationCache = new Map<string, Decl[] | PlsqlSyntaxError>();
function declarations(code: string): Decl[] {
  let entry = declarationCache.get(code);
  if (!entry) {
    try {
      entry = new Parser(code).declarations();
    } catch (error) {
      if (!(error instanceof PlsqlSyntaxError)) throw error;
      entry = error;
    }
    if (declarationCache.size > 200) declarationCache.clear();
    declarationCache.set(code, entry);
  }
  if (entry instanceof PlsqlSyntaxError) throw entry;
  return entry;
}

export class Interpreter implements Runtime {
  readonly renderer: ApexRenderer;
  readonly ctx: RenderContext;
  readonly owner: PlsqlOwner;
  readonly output: string[] = [];
  readonly errors: ApexError[] = [];
  redirectURL?: string;
  line = 0;
  #bindSeq = 0;
  #iterations = 0;
  #depth = 0;
  #rowcount: number | null = null;
  #current: PlsqlException | undefined;

  constructor(renderer: ApexRenderer, ctx: RenderContext, owner: PlsqlOwner) {
    this.renderer = renderer;
    this.ctx = ctx;
    this.owner = owner;
  }

  note(level: 'info' | 'warning', message: string): void {
    this.renderer.diagnose(
      level,
      `${this.owner.label}: ${message}${this.line ? ` (line ${this.line})` : ''}`,
      this.ctx.pageId,
      this.owner.component,
    );
  }

  // ------------------------------------------------------------ entry points

  run(code: string, mode: 'block' | 'functionBody' | 'plsqlExpression' | 'sqlExpression'): ExecResult {
    const result: ExecResult = { ok: true, value: null, output: '', errors: this.errors };
    if (/\bpragma\s+autonomous_transaction\b/iu.test(code))
      this.note(
        'info',
        'PRAGMA AUTONOMOUS_TRANSACTION is not simulated; the block joins the page transaction, so its COMMIT also commits the page work done so far',
      );
    try {
      withRuntime(this, () => {
        if (mode === 'plsqlExpression' || mode === 'sqlExpression') {
          result.value = this.evaluate(parseExpression(code), new Scope());
          return;
        }
        const signal = this.execList(parsed(code), new Scope());
        if (signal?.kind === 'return') result.value = signal.value;
        else if (mode === 'functionBody')
          throw new PlsqlException(
            'others',
            -6503,
            'ORA-06503: PL/SQL: Function returned without value',
            'app',
          );
      });
    } catch (error) {
      result.ok = false;
      if (error instanceof PlsqlException) {
        result.failure = { message: error.message, kind: error.kind, line: this.line };
      } else if (error instanceof PlsqlSyntaxError || error instanceof PlsqlUnsupported) {
        result.failure = { message: error.message, kind: 'unsupported', line: error.line || this.line };
      } else {
        result.failure = {
          message: (error as Error).message ?? String(error),
          kind: 'engine',
          line: this.line,
        };
      }
    }
    result.output = this.output.join('');
    if (this.redirectURL) result.redirectURL = this.redirectURL;
    return result;
  }

  /**
   * Runs routine `name` declared in `code` (a plug-in's PL/SQL: declarations without a body) with
   * argument values by parameter name. Parameters without a value get their default, or an empty
   * record; OUT and IN OUT values come back in `outs`.
   */
  runDeclared(
    code: string,
    name: string,
    values: Record<string, Value>,
  ): ExecResult & { outs: Record<string, Value> } {
    const result: ExecResult & { outs: Record<string, Value> } = {
      ok: true,
      value: null,
      output: '',
      errors: this.errors,
      outs: {},
    };
    try {
      withRuntime(this, () => {
        const scope = new Scope();
        this.declare(declarations(code), scope);
        const routine = scope.overloads.get(name.toLowerCase())?.[0];
        if (!routine) throw new PlsqlUnsupported(`the plug-in code declares no ${name}`, 0);
        const local = new Scope(scope);
        for (const param of routine.params) {
          const type = typeOf(param.type, scope);
          const given = Object.hasOwn(values, param.name) ? values[param.name]! : undefined;
          const value =
            given !== undefined
              ? given
              : param.init
                ? this.evaluate(param.init, local)
                : /\.t_|%rowtype$/iu.test(param.type)
                  ? new RecordValue()
                  : null;
          local.vars.set(param.name, {
            value: value instanceof RecordValue ? value : this.coerce(value, type),
            type: value instanceof RecordValue ? 'record' : type,
            constant: false,
          });
        }
        result.value = this.runRoutine(routine, local);
        for (const param of routine.params)
          if (param.mode !== 'in') result.outs[param.name] = local.vars.get(param.name)?.value ?? null;
      });
    } catch (error) {
      result.ok = false;
      if (error instanceof PlsqlException)
        result.failure = { message: error.message, kind: error.kind, line: this.line };
      else if (error instanceof PlsqlSyntaxError || error instanceof PlsqlUnsupported)
        result.failure = { message: error.message, kind: 'unsupported', line: error.line || this.line };
      else
        result.failure = {
          message: (error as Error).message ?? String(error),
          kind: 'engine',
          line: this.line,
        };
    }
    result.output = this.output.join('');
    if (this.redirectURL) result.redirectURL = this.redirectURL;
    return result;
  }

  /** COMMIT, ROLLBACK [TO SAVEPOINT name] and SAVEPOINT name act on the page transaction. */
  transactionControl(op: 'commit' | 'rollback' | 'savepoint', name?: string): void {
    const db = this.renderer.db.db;
    if (op === 'commit') commitWork(db);
    else if (op === 'savepoint') savepoint(db, name ?? '');
    else if (!rollbackWork(db, name))
      throw new PlsqlException(
        'others',
        -1086,
        `ORA-01086: savepoint '${(name ?? '').toUpperCase()}' never established in this session or is invalid`,
        'app',
      );
  }

  // ------------------------------------------------------------ declarations

  declare(decls: Decl[], scope: Scope): void {
    for (const decl of decls) {
      switch (decl.kind) {
        case 'var': {
          this.line = decl.line;
          const type = typeOf(decl.type, scope);
          const initial: Value = decl.init
            ? this.evaluate(decl.init, scope)
            : type === 'record'
              ? new RecordValue()
              : type === 'collection'
                ? new Collection()
                : null;
          scope.vars.set(decl.name, { value: this.coerce(initial, type), type, constant: decl.constant });
          break;
        }
        case 'cursor':
          scope.cursors.set(decl.name, { params: decl.params, sql: decl.sql });
          break;
        case 'exception':
          scope.exceptions.add(decl.name);
          break;
        case 'type':
          if (decl.collection) scope.collectionTypes.add(decl.name);
          break;
        case 'routine': {
          scope.routines.set(decl.routine.name, { routine: decl.routine, scope });
          const list = scope.overloads.get(decl.routine.name) ?? [];
          const same = list.findIndex(
            (entry) =>
              entry.params.length === decl.routine.params.length &&
              entry.params.every((param, at) => param.name === decl.routine.params[at]!.name),
          );
          if (same >= 0) list[same] = decl.routine;
          else list.push(decl.routine);
          scope.overloads.set(decl.routine.name, list);
          break;
        }
      }
    }
  }

  coerce(value: Value, type: VarType): Value {
    if (value === undefined) return null;
    switch (type) {
      case 'number': {
        if (value === null || value === '') return null;
        if (typeof value === 'boolean') return value ? 1 : 0;
        if (typeof value === 'number') return value;
        const number = Number(String(value).trim().replaceAll(',', ''));
        if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(number)) return number;
        throw new PlsqlException('value_error', -6502, PREDEFINED_TEXT.value_error!, 'app');
      }
      case 'string':
        if (value === null || value === '') return null;
        if (value instanceof Collection || value instanceof RecordValue) return value;
        if (typeof value === 'number') return oracleNumberText(value);
        return typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value);
      case 'boolean':
        return value === null ? null : truthy(value);
      case 'collection':
        if (value instanceof Collection) return value;
        return value === null ? new Collection() : Collection.of([value]);
      default:
        return value === '' ? null : value;
    }
  }

  // ------------------------------------------------------------ statements

  execList(list: Stmt[], scope: Scope): Signal {
    for (const statement of list) {
      const signal = this.exec(statement, scope);
      if (signal) return signal;
    }
    return undefined;
  }

  execBlock(block: Block, scope: Scope): Signal {
    const local = new Scope(scope);
    try {
      this.declare(block.decls, local);
      return this.execList(block.body, local);
    } catch (error) {
      if (!block.handlers.length || error instanceof PlsqlUnsupported || error instanceof PlsqlSyntaxError)
        throw error;
      const exception = engineError(error);
      const handler = block.handlers.find((entry) =>
        entry.names.some((name) => name === 'others' || name === exception.exName),
      );
      if (!handler) throw exception;
      const handling = new Scope(local);
      handling.vars.set('sqlerrm', { value: exception.sqlerrm, type: 'string', constant: true });
      handling.vars.set('sqlcode', { value: exception.code, type: 'number', constant: true });
      const previous = this.#current;
      this.#current = exception;
      try {
        return this.execList(handler.body, handling);
      } finally {
        this.#current = previous;
      }
    }
  }

  tick(): void {
    this.#iterations += 1;
    if (this.#iterations > LOOP_LIMIT)
      throw new PlsqlUnsupported(`loop exceeded ${LOOP_LIMIT} iterations`, this.line);
  }

  /** Runs a loop body; returns a signal for the caller or `'next'`/`'stop'` for the loop. */
  loopBody(body: Stmt[], scope: Scope, label: string | undefined): Signal | 'next' | 'stop' {
    this.tick();
    const signal = this.execList(body, scope);
    if (!signal) return 'next';
    if (signal.kind === 'return') return signal;
    if (signal.label && signal.label !== label) return signal;
    return signal.kind === 'exit' ? 'stop' : 'next';
  }

  exec(statement: Stmt, scope: Scope): Signal {
    this.line = statement.line;
    switch (statement.k) {
      case 'null':
      case 'noop':
        return undefined;
      case 'tx':
        this.transactionControl(statement.op, statement.savepoint);
        return undefined;
      case 'unsupported':
        this.note('info', `${statement.what} are not simulated; skipped`);
        return undefined;
      case 'assign':
        this.assign(statement.target, this.evaluate(statement.expr, scope), scope);
        return undefined;
      case 'if': {
        for (const branch of statement.branches) {
          if (truthy(this.evaluate(branch.cond, scope))) return this.execList(branch.body, new Scope(scope));
        }
        return statement.otherwise ? this.execList(statement.otherwise, new Scope(scope)) : undefined;
      }
      case 'case': {
        const selector = statement.selector ? this.evaluate(statement.selector, scope) : undefined;
        for (const when of statement.whens) {
          const value = this.evaluate(when.expr, scope);
          if (statement.selector ? sameValue(selector ?? null, value) : truthy(value))
            return this.execList(when.body, new Scope(scope));
        }
        if (statement.otherwise) return this.execList(statement.otherwise, new Scope(scope));
        throw new PlsqlException('case_not_found', -6592, PREDEFINED_TEXT.case_not_found!, 'app');
      }
      case 'loop':
        for (;;) {
          const result = this.loopBody(statement.body, new Scope(scope), statement.label);
          if (result === 'stop') return undefined;
          if (result !== 'next') return result;
        }
      case 'while':
        while (truthy(this.evaluate(statement.cond, scope))) {
          const result = this.loopBody(statement.body, new Scope(scope), statement.label);
          if (result === 'stop') return undefined;
          if (result !== 'next') return result;
        }
        return undefined;
      case 'forRange': {
        const from = Number(this.evaluate(statement.from, scope));
        const to = Number(this.evaluate(statement.to, scope));
        if (!Number.isFinite(from) || !Number.isFinite(to)) return undefined;
        const step = statement.reverse ? -1 : 1;
        for (
          let index = statement.reverse ? to : from;
          statement.reverse ? index >= from : index <= to;
          index += step
        ) {
          const local = new Scope(scope);
          local.vars.set(statement.name, { value: index, type: 'number', constant: true });
          const result = this.loopBody(statement.body, local, statement.label);
          if (result === 'stop') return undefined;
          if (result !== 'next') return result;
        }
        return undefined;
      }
      case 'forQuery': {
        const rows = this.cursorRows(statement, scope);
        for (const row of rows) {
          const local = new Scope(scope);
          local.vars.set(statement.name, { value: new RecordValue(row), type: 'record', constant: true });
          const result = this.loopBody(statement.body, local, statement.label);
          if (result === 'stop') return undefined;
          if (result !== 'next') return result;
        }
        return undefined;
      }
      case 'exit':
      case 'continue':
        if (statement.when && !truthy(this.evaluate(statement.when, scope))) return undefined;
        return { kind: statement.k, ...(statement.label ? { label: statement.label } : {}) };
      case 'return':
        return { kind: 'return', value: statement.expr ? this.evaluate(statement.expr, scope) : null };
      case 'raise':
        return this.raise(statement.name, scope);
      case 'selectInto':
        this.selectInto(statement.sql, statement.targets, statement.bulk, scope);
        return undefined;
      case 'dml':
        this.dml(statement.sql, statement.targets, scope);
        return undefined;
      case 'call':
        this.call(statement.name, statement.args, scope, false);
        return undefined;
      case 'block':
        return this.execBlock(statement.block, scope);
    }
  }

  raise(name: string | undefined, scope: Scope): never {
    if (!name) {
      if (this.#current) throw this.#current;
      throw new PlsqlException('others', -20999, 'RAISE outside an exception handler', 'app');
    }
    const short = name.split('.').at(-1)!;
    if (Object.hasOwn(PREDEFINED, short))
      throw new PlsqlException(
        short,
        PREDEFINED[short]!,
        PREDEFINED_TEXT[short] ?? short.toUpperCase(),
        'app',
      );
    if (!scope.find((s) => (s.exceptions.has(short) ? true : undefined)))
      this.note('info', `exception ${name} is not declared locally; raised as a user-defined exception`);
    throw new PlsqlException(
      short,
      1,
      'User-Defined Exception',
      'app',
      'ORA-06510: PL/SQL: unhandled user-defined exception',
    );
  }

  assign(target: Target, value: Value, scope: Scope): void {
    switch (target.kind) {
      case 'bind':
        this.ctx.session.items[target.name] = itemText(value);
        return;
      case 'row':
        throw new PlsqlUnsupported(`:${target.row}.${target.column} outside a row trigger`, this.line);
      case 'global':
        if (target.name === 'apex_application.g_print_success_message') {
          this.ctx.session.success = itemText(value) || undefined;
          return;
        }
        this.note('info', `assignment to ${target.name} is ignored locally`);
        return;
      case 'var': {
        const variable = scope.variable(target.name);
        if (!variable) {
          const global = target.field ? this.packageVariable([target.name, target.field]) : undefined;
          if (global) {
            if (global.constant)
              throw new PlsqlUnsupported(`assignment to constant ${target.name}.${target.field}`, this.line);
            global.value = this.coerce(value, global.type);
            return;
          }
          if (target.field) {
            this.note(
              'info',
              `assignment to package variable ${target.name}.${target.field} is ignored locally`,
            );
            return;
          }
          throw new PlsqlUnsupported(`assignment to undeclared variable ${target.name}`, this.line);
        }
        if (variable.constant) throw new PlsqlUnsupported(`assignment to constant ${target.name}`, this.line);
        if (target.field) {
          if (!(variable.value instanceof RecordValue)) variable.value = new RecordValue();
          (variable.value as RecordValue).fields[target.field.toUpperCase()] = value;
          return;
        }
        if (target.index) {
          if (!(variable.value instanceof Collection)) variable.value = new Collection();
          const key = this.collectionKey(this.evaluate(target.index, scope));
          (variable.value as Collection).items.set(key, value);
          return;
        }
        if (variable.type === 'record' && value instanceof RecordValue) {
          variable.value = new RecordValue({ ...value.fields });
          return;
        }
        variable.value = this.coerce(value, variable.type);
        return;
      }
    }
  }

  collectionKey(value: Value): number | string {
    const sql = toSql(value);
    return typeof sql === 'number'
      ? sql
      : sql !== null && Number.isFinite(Number(sql))
        ? Number(sql)
        : String(sql);
  }

  // ------------------------------------------------------------ SQL

  hostBinds(): Binds {
    const binds = this.renderer.binds(this.ctx.session, this.ctx.page);
    binds.REQUEST = this.ctx.request;
    for (const [key, value] of Object.entries(binds)) if (value === '') binds[key] = null;
    return binds;
  }

  query(sql: string, binds: Record<string, string | number | null>, maxRows: number) {
    try {
      return this.renderer.db.query(sql, { ...this.hostBinds(), ...binds }, maxRows);
    } catch (error) {
      throw engineError(error);
    }
  }

  cursorRows(statement: Extract<Stmt, { k: 'forQuery' }>, scope: Scope): Row[] {
    let sql = statement.sql;
    let cursorScope = scope;
    if (!sql) {
      const cursor = scope.find((s) => s.cursors.get(statement.cursor ?? ''));
      if (!cursor) throw new PlsqlUnsupported(`cursor ${statement.cursor} is not declared`, this.line);
      cursorScope = new Scope(scope);
      const args = statement.args ?? [];
      cursor.params.forEach((param, index) => {
        const arg =
          args.find((entry) => entry.name === param.name) ?? args.filter((entry) => !entry.name)[index];
        const value = arg
          ? this.evaluate(arg.expr, scope)
          : param.init
            ? this.evaluate(param.init, scope)
            : null;
        cursorScope.vars.set(param.name, { value, type: typeOf(param.type, scope), constant: true });
      });
      sql = cursor.sql;
    }
    const translated = this.translate(sql, cursorScope, 'sql');
    return this.query(translated.sql, translated.binds, 10_000).rows;
  }

  selectInto(sql: Expr, targets: Target[], bulk: boolean, scope: Scope): void {
    const translated = this.translate(sql, scope, 'sql');
    const result = this.query(translated.sql, translated.binds, bulk ? 10_000 : 2);
    if (bulk) {
      targets.forEach((target, index) => {
        const column = result.columns[index] ?? result.columns[0]!;
        const values =
          targets.length === 1 && result.columns.length > 1
            ? result.rows.map((row) => new RecordValue(row))
            : result.rows.map((row) => row[column] ?? null);
        this.assign(target, Collection.of(values), scope);
      });
      this.#rowcount = result.rows.length;
      return;
    }
    if (!result.rows.length)
      throw new PlsqlException('no_data_found', 100, PREDEFINED_TEXT.no_data_found!, 'app');
    if (result.rows.length > 1)
      throw new PlsqlException('too_many_rows', -1422, PREDEFINED_TEXT.too_many_rows!, 'app');
    this.#rowcount = 1;
    this.assignRow(result.rows[0]!, result.columns, targets, scope);
  }

  assignRow(row: Row, columns: string[], targets: Target[], scope: Scope): void {
    if (targets.length === 1 && targets[0]!.kind === 'var' && !targets[0]!.field) {
      const variable = scope.variable(targets[0]!.name);
      if (variable?.type === 'record' || (columns.length > 1 && variable)) {
        this.assign(targets[0]!, new RecordValue({ ...row }), scope);
        return;
      }
    }
    targets.forEach((target, index) => {
      const column = columns[index];
      this.assign(target, column === undefined ? null : (row[column] ?? null), scope);
    });
  }

  dml(sql: Expr, targets: Target[] | undefined, scope: Scope): void {
    const translated = this.translate(sql, scope, 'sql');
    const binds = { ...this.hostBinds(), ...translated.binds };
    try {
      if (targets) {
        const result = this.renderer.db.query(translated.sql, binds, 10_000);
        this.#rowcount = result.rows.length;
        if (result.rows[0]) this.assignRow(result.rows[0], result.columns, targets, scope);
      } else {
        this.#rowcount = this.renderer.db.execute(translated.sql, binds).changes;
      }
    } catch (error) {
      throw engineError(error);
    }
  }

  // ------------------------------------------------------------ packages

  get library(): PlsqlLibrary {
    return plsqlLibrary(this.renderer);
  }

  /** The package's state for this request, initialized on first use. */
  packageScope(pkg: PlsqlPackage): Scope {
    let states = packageStates.get(this.ctx);
    if (!states) packageStates.set(this.ctx, (states = new Map()));
    let scope = states.get(pkg.name);
    if (scope) return scope;
    scope = new Scope();
    // Registered first: a routine called from the initialization finds the package itself.
    states.set(pkg.name, scope);
    const line = this.line;
    try {
      this.declare(pkg.decls, scope);
      if (pkg.init) this.execBlock(pkg.init, scope);
    } finally {
      this.line = line;
    }
    return scope;
  }

  /** A package variable or constant (`pkg.g_x`), when the chain names one. */
  packageVariable(names: string[]): Variable | undefined {
    const target = libraryTarget(this.library, names);
    if (!target || !('pkg' in target) || !target.pkg) return undefined;
    if (target.pkg.routines.has(target.member)) return undefined;
    return this.packageScope(target.pkg).vars.get(target.member);
  }

  /** Calls an application routine by chain; undefined when the chain names none. */
  callLibrary(names: string[], args: Arg[], scope: Scope): { value: Value } | undefined {
    const target = libraryTarget(this.library, names);
    if (!target || target.rest.length) return undefined;
    const positional = args.filter((arg) => !arg.name).length;
    const named = args.filter((arg) => arg.name).map((arg) => arg.name!);
    if ('routine' in target) {
      const routine = pickOverload(target.routine, positional, named);
      return routine ? { value: this.invoke(routine, new Scope(), args, scope) } : undefined;
    }
    const overloads = target.pkg!.routines.get(target.member);
    if (!overloads) return undefined;
    const routine = pickOverload(overloads, positional, named);
    if (!routine) return undefined;
    return { value: this.invoke(routine, this.packageScope(target.pkg!), args, scope) };
  }

  /** Calls an application routine with values (from SQL); undefined when it does not exist. */
  callWithValues(names: string[], values: Value[]): { value: Value } | undefined {
    const target = libraryTarget(this.library, names);
    if (!target || target.rest.length) return undefined;
    const overloads = 'routine' in target ? target.routine : target.pkg!.routines.get(target.member);
    const routine = overloads && pickOverload(overloads, values.length, []);
    if (!routine) return undefined;
    const defining = 'routine' in target ? new Scope() : this.packageScope(target.pkg!);
    const local = new Scope(defining);
    routine.params.forEach((param, index) => {
      const type = typeOf(param.type, defining);
      const value =
        index < values.length ? values[index]! : param.init ? this.evaluate(param.init, local) : null;
      local.vars.set(param.name, { value: this.coerce(value, type), type, constant: param.mode === 'in' });
    });
    return { value: this.runRoutine(routine, local) };
  }

  // ------------------------------------------------------------ calls

  evalArgs(args: Arg[], scope: Scope): { positional: Value[]; named: Record<string, Value> } {
    const positional: Value[] = [];
    const named: Record<string, Value> = {};
    for (const arg of args) {
      const value = this.evaluate(arg.expr, scope);
      if (arg.name) named[arg.name] = value;
      else positional.push(value);
    }
    return { positional, named };
  }

  call(chain: string[], args: Arg[], scope: Scope, asFunction: boolean): Value {
    const names = chain[0] === 'sys' && chain.length > 1 ? chain.slice(1) : chain;
    const name = names.join('.');
    if (names.length === 1) {
      const local = scope.find((s) => (s.overloads.has(name) ? s : undefined));
      if (local) {
        const routine =
          pickOverload(
            local.overloads.get(name)!,
            args.filter((arg) => !arg.name).length,
            args.filter((arg) => arg.name).map((arg) => arg.name!),
          ) ?? local.routines.get(name)!.routine;
        return this.invoke(routine, local, args, scope);
      }
      if (name === 'raise_application_error') {
        const { positional, named } = this.evalArgs(args, scope);
        const code = Number(positional[0] ?? named.num ?? -20000);
        const message = itemText(positional[1] ?? named.msg ?? null);
        throw new PlsqlException(`ora${code}`, code, message, 'app', `ORA${code}: ${message}`);
      }
      if (COLLECTION_TYPES.has(name) || scope.find((s) => (s.collectionTypes.has(name) ? true : undefined)))
        return Collection.of(this.evalArgs(args, scope).positional);
    }
    if (COLLECTION_TYPES.has(name)) return Collection.of(this.evalArgs(args, scope).positional);
    const variable = names.length === 2 ? scope.variable(names[0]!) : undefined;
    if (variable?.value instanceof Collection) return this.collectionMethod(variable, names[1]!, args, scope);
    const application = this.callLibrary(names, args, scope);
    if (application) return application.value;
    const stub = findStub(name);
    if (!stub) {
      this.note('info', `${name} is not simulated locally; ${asFunction ? 'returned NULL' : 'skipped'}`);
      return null;
    }
    const { positional, named } = this.evalArgs(args, scope);
    const plain = (value: Value): unknown =>
      stub.raw
        ? value
        : value instanceof Collection
          ? value.values().map(plain)
          : value instanceof RecordValue
            ? null
            : value;
    const result = stub.fn(
      stubArgs(
        stub,
        positional.map(plain),
        Object.fromEntries(Object.entries(named).map(([key, value]) => [key, plain(value)])),
      ),
      this,
    );
    if (Array.isArray(result)) return Collection.of(result as Value[]);
    return (result ?? null) as Value;
  }

  /**
   * Reads a variable through its element and field accessors, as far as they go:
   * `rec.field`, `list(i)`, `list(i).value_list(j).varchar2_value`, `list(i).value_list.count`.
   * `start` is the index of the variable's token; returns the value and the last token consumed.
   */
  walkPath(variable: Variable, tokens: Expr, start: number, scope: Scope): { value: Value; end: number } {
    let current = variable.value;
    let holder = variable;
    let at = start;
    for (;;) {
      if (current instanceof Collection && isOp(tokens[at + 1], '(')) {
        const close = matchParen(tokens, at + 1);
        const key = this.collectionKey(this.evaluate(tokens.slice(at + 2, close), scope));
        if (!current.items.has(key))
          throw new PlsqlException('no_data_found', 100, PREDEFINED_TEXT.no_data_found!, 'app');
        current = current.items.get(key) ?? null;
        holder = { value: current, type: 'any', constant: true };
        at = close;
        continue;
      }
      if (
        isOp(tokens[at + 1], '.') &&
        (tokens[at + 2]?.kind === 'word' || tokens[at + 2]?.kind === 'qident')
      ) {
        const member = tokens[at + 2]!.value.toLowerCase();
        if (current instanceof RecordValue) {
          current = current.fields[member.toUpperCase()] ?? null;
          holder = { value: current, type: 'any', constant: true };
          at += 2;
          continue;
        }
        if (current instanceof Collection) {
          let args: Arg[] = [];
          let end = at + 2;
          if (isOp(tokens[at + 3], '(')) {
            end = matchParen(tokens, at + 3);
            args = parseArgs(tokens.slice(at + 4, end));
          }
          current = this.collectionMethod(holder, member, args, scope);
          holder = { value: current, type: 'any', constant: true };
          at = end;
          continue;
        }
      }
      return { value: current, end: at };
    }
  }

  collectionMethod(variable: Variable, method: string, args: Arg[], scope: Scope): Value {
    const collection = variable.value as Collection;
    const values = this.evalArgs(args, scope).positional;
    const numericKeys = collection.keys().filter((key): key is number => typeof key === 'number');
    switch (method) {
      case 'extend': {
        const count = Number(values[0] ?? 1);
        let next = (numericKeys.at(-1) ?? 0) + 1;
        for (let index = 0; index < count; index += 1) collection.items.set(next++, null);
        return null;
      }
      case 'delete':
        if (values.length) collection.items.delete(this.collectionKey(values[0]!));
        else collection.items.clear();
        return null;
      case 'trim': {
        const count = Number(values[0] ?? 1);
        for (const key of numericKeys.slice(-count)) collection.items.delete(key);
        return null;
      }
      case 'exists':
        return collection.items.has(this.collectionKey(values[0] ?? null));
      case 'count':
        return collection.items.size;
      case 'first':
        return collection.keys()[0] ?? null;
      case 'last':
        return collection.keys().at(-1) ?? null;
      case 'next':
      case 'prior': {
        const keys = collection.keys();
        const at = keys.indexOf(this.collectionKey(values[0] ?? null));
        return keys[method === 'next' ? at + 1 : at - 1] ?? null;
      }
      default:
        throw new PlsqlUnsupported(`collection method ${method}`, this.line);
    }
  }

  invoke(routine: Routine, defining: Scope, args: Arg[], caller: Scope): Value {
    if (this.#depth >= MAX_CALL_DEPTH) throw new PlsqlUnsupported('recursion depth exceeded', this.line);
    const local = new Scope(defining);
    const outs: { target: Target; name: string }[] = [];
    routine.params.forEach((param, index) => {
      const arg =
        args.find((entry) => entry.name === param.name) ?? args.filter((entry) => !entry.name)[index];
      const type = typeOf(param.type, defining);
      const value =
        arg && param.mode !== 'out'
          ? this.evaluate(arg.expr, caller)
          : !arg && param.init
            ? this.evaluate(param.init, local)
            : null;
      local.vars.set(param.name, { value: this.coerce(value, type), type, constant: param.mode === 'in' });
      if (arg && param.mode !== 'in') {
        outs.push({ target: targetOf(arg.expr), name: param.name });
      }
    });
    const value = this.runRoutine(routine, local);
    for (const out of outs) this.assign(out.target, local.vars.get(out.name)?.value ?? null, caller);
    return value;
  }

  /** Runs a routine body in its parameter scope; a function must return a value. */
  runRoutine(routine: Routine, local: Scope): Value {
    if (this.#depth >= MAX_CALL_DEPTH) throw new PlsqlUnsupported('recursion depth exceeded', this.line);
    this.#depth += 1;
    const line = this.line;
    try {
      const signal = this.execBlock(routine.block, local);
      if (routine.isFunction) {
        if (signal?.kind !== 'return')
          throw new PlsqlException(
            'others',
            -6503,
            'ORA-06503: PL/SQL: Function returned without value',
            'app',
          );
        return signal.value;
      }
      return null;
    } finally {
      this.#depth -= 1;
      this.line = line;
    }
  }

  // ------------------------------------------------------------ expressions

  evaluate(tokens: Expr, scope: Scope): Value {
    if (!tokens.length) return null;
    const mode = tokens.some((token) => isWord(token, 'select')) ? 'sql' : 'expr';
    const translated = this.translate(tokens, scope, mode);
    if (translated.direct) return translated.direct.value;
    const result = this.query(`select ${translated.sql}`, translated.binds, 1);
    const column = result.columns[0];
    const value = column === undefined ? null : (result.rows[0]?.[column] ?? null);
    return value === '' ? null : value;
  }

  /**
   * Turns PL/SQL expression tokens into SQLite text. Variables, record fields, collection
   * elements and package calls become bind values.
   */
  translate(
    tokens: Expr,
    scope: Scope,
    mode: 'expr' | 'sql',
  ): { sql: string; binds: Record<string, string | number | null>; direct?: { value: Value } } {
    const binds: Record<string, string | number | null> = {};
    const pieces: Piece[] = [];
    const bind = (pre: string, value: Value) => {
      const name = `PLV__${(this.#bindSeq += 1)}`;
      binds[name] = toSql(value);
      pieces.push({ pre, text: `:${name}`, direct: { value } });
    };
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]!;
      const pre = index === 0 ? '' : token.pre;
      if (token.kind === 'string') {
        pieces.push({ pre, text: token.value === '' ? 'null' : token.text, token });
        continue;
      }
      if (token.kind === 'bind') {
        const numeric =
          (isOp(tokens[index + 1], ...COMPARISON) && tokens[index + 2]?.kind === 'number') ||
          (isOp(tokens[index - 1], ...COMPARISON) && tokens[index - 2]?.kind === 'number');
        const raw = RESERVED_BUILTINS.has(token.value) ? undefined : this.ctx.session.items[token.value];
        pieces.push({
          pre,
          text: numeric ? `apex_local_num(${token.text})` : token.text,
          token,
          direct: { value: raw === undefined || raw === '' ? (this.builtinBind(token.value) ?? null) : raw },
        });
        continue;
      }
      if (token.kind === 'op' && token.value === '/') {
        pieces.push({ pre, text: '* 1.0 /', token });
        continue;
      }
      if (token.kind !== 'word') {
        pieces.push({ pre, text: token.text, token });
        continue;
      }
      // identifier chain a.b.c and %attribute
      const names = [token.value];
      let end = index;
      while (
        isOp(tokens[end + 1], '.') &&
        (tokens[end + 2]?.kind === 'word' || tokens[end + 2]?.kind === 'qident')
      ) {
        names.push(tokens[end + 2]!.value.toLowerCase());
        end += 2;
      }
      let attribute: string | undefined;
      if (isOp(tokens[end + 1], '%') && tokens[end + 2]?.kind === 'word') {
        attribute = tokens[end + 2]!.value;
        end += 2;
      }
      const callOpen = isOp(tokens[end + 1], '(') ? end + 1 : -1;
      const callClose = callOpen >= 0 ? matchParen(tokens, callOpen) : -1;
      const callArgs = callOpen >= 0 ? parseArgs(tokens.slice(callOpen + 1, callClose)) : [];
      const head = names[0]!;
      const variable = scope.variable(head);

      if (attribute) {
        if (head === 'sql' || scope.find((s) => s.cursors.get(head))) {
          const count = this.#rowcount;
          bind(
            pre,
            attribute === 'rowcount'
              ? count
              : attribute === 'found'
                ? (count ?? 0) > 0
                : attribute === 'notfound'
                  ? (count ?? 0) === 0
                  : false,
          );
          index = end;
          continue;
        }
        throw new PlsqlUnsupported(`attribute ${head}%${attribute}`, token.line);
      }

      if (
        variable &&
        (names.length === 1 || variable.value instanceof RecordValue || variable.value instanceof Collection)
      ) {
        const walked = this.walkPath(variable, tokens, index, scope);
        bind(pre, walked.value);
        index = walked.end;
        continue;
      }
      if (names.length === 1) {
        const routine =
          scope.find((s) => s.routines.get(head)) ??
          (mode === 'expr' ? this.library.routines.get(head) : undefined);
        const isCollectionType =
          COLLECTION_TYPES.has(head) || scope.find((s) => (s.collectionTypes.has(head) ? true : undefined));
        if (routine || isCollectionType || head === 'raise_application_error') {
          bind(pre, this.call(names, callArgs, scope, true));
          index = callOpen >= 0 ? callClose : end;
          continue;
        }
        if (mode === 'expr' && head === 'user') {
          bind(pre, this.ctx.session.user);
          continue;
        }
        pieces.push({ pre, text: token.text, token });
        continue;
      }

      // the application's own package: a variable, or a routine (called here outside SQL; in SQL the
      // call stays in the statement and runs per row through the database's function hook)
      const libraryChain = head === 'sys' ? names.slice(1) : names;
      const own = libraryTarget(this.library, libraryChain);
      if (own) {
        const global = this.packageVariable(libraryChain);
        if (global) {
          bind(pre, global.value);
          index = end;
          continue;
        }
        if (mode === 'expr' || callOpen < 0) {
          const result = this.callLibrary(libraryChain, callArgs, scope);
          if (result) {
            bind(pre, result.value);
            index = callOpen >= 0 ? callClose : end;
            continue;
          }
        }
      }
      // package member, possibly followed by a collection attribute (apex_application.g_f01.count)
      const dropped = head === 'sys' ? names.slice(1) : names;
      const full = dropped.join('.');
      const known = findStub(full) ?? (COLLECTION_TYPES.has(full) ? { sql: false } : undefined);
      if (mode === 'sql' && (!known || (callOpen >= 0 && (known as { sql?: boolean }).sql))) {
        // a column reference (alias.column) or a SQL-registered package function
        for (let part = index; part <= end; part += 1) {
          const piece = tokens[part]!;
          pieces.push({ pre: part === index ? pre : piece.pre, text: piece.text, token: piece });
        }
        index = end;
        continue;
      }
      bind(pre, this.call(names, callArgs, scope, true));
      index = callOpen >= 0 ? callClose : end;
    }
    // `||` stays as written: the SQL translation gives it Oracle precedence and NULL semantics.
    const meaningful = pieces.filter((piece) => piece.text.trim() !== '');
    const sql = pieces
      .map((piece, index) => (index === 0 ? '' : piece.pre) + piece.text)
      .join('')
      .trim();
    return {
      sql,
      binds,
      ...(meaningful.length === 1 && meaningful[0]!.direct ? { direct: meaningful[0]!.direct } : {}),
    };
  }

  builtinBind(name: string): string | undefined {
    if (name === 'REQUEST') return this.ctx.request || undefined;
    const value = this.renderer.builtin(this.ctx.session, this.ctx.page)[name];
    return value === '' ? undefined : value;
  }
}

function targetOf(tokens: Token[]): Target {
  const [first, second, third] = tokens;
  if (first?.kind === 'bind') return { kind: 'bind', name: first.value };
  if (first?.kind === 'word' && isOp(second, '.') && third)
    return { kind: 'var', name: first.value, field: third.value };
  if (first?.kind === 'word') return { kind: 'var', name: first.value };
  throw new PlsqlUnsupported('OUT argument must be a variable or bind', first?.line ?? 0);
}

/** Runs PL/SQL code for a component and returns the outcome; nothing is diagnosed here. */
export function runPlsql(
  renderer: ApexRenderer,
  ctx: RenderContext,
  code: string,
  mode: 'block' | 'functionBody' | 'plsqlExpression' | 'sqlExpression',
  owner: PlsqlOwner,
): ExecResult {
  return new Interpreter(renderer, ctx, owner).run(code, mode);
}
