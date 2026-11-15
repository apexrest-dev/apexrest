import type { LocalDatabase } from './database.ts';
import { translateOracleSql } from './database.ts';
import { describeUnit, unitBody } from './seed.ts';
import {
  isOp,
  isWord,
  Parser,
  PlsqlSyntaxError,
  type Expr,
  type Stmt,
  type Token,
} from './extensions/server/parser.ts';

/**
 * Oracle row triggers in the local SQLite database.
 *
 * Install scripts fill audit and key columns in BEFORE INSERT/UPDATE row triggers
 * (`:new.created := sysdate`, `:new.id := seq.nextval`, `:new.row_version := nvl(:old.row_version, 0) + 1`).
 * SQLite triggers cannot change the row being written, so each Oracle trigger becomes an AFTER
 * trigger per event that updates the written row with the values Oracle would have assigned, and
 * the columns it fills lose their NOT NULL constraint locally (Oracle checks them after the trigger).
 *
 * The body is evaluated per event: `inserting`/`updating`/`deleting` are constants, IF and CASE
 * become CASE expressions, local variables are substituted and `SELECT ... INTO :new.x FROM dual`
 * is a scalar subquery. Statements without a SQL meaning (package calls, DML on other tables,
 * RAISE) are skipped and reported once per trigger.
 */

type Event = 'insert' | 'update' | 'delete';
const PREDICATE: Record<Event, string> = { insert: 'inserting', update: 'updating', delete: 'deleting' };
/** APEX package globals a trigger may read; locally they come from session state. */
const APEX_GLOBALS: Record<string, string> = {
  'wwv_flow.g_user': "v('APP_USER')",
  'apex_application.g_user': "v('APP_USER')",
  'wwv_flow.g_flow_id': "v('APP_ID')",
  'apex_application.g_flow_id': "v('APP_ID')",
  'wwv_flow.g_instance': "v('APP_SESSION')",
  'apex_application.g_instance': "v('APP_SESSION')",
  'wwv_flow_security.g_security_group_id': "v('WORKSPACE_ID')",
};
const and = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' and ') || undefined;

interface Header {
  name: string;
  timing: 'before' | 'after' | 'instead of';
  events: Event[];
  updateColumns: string[];
  table: string;
  row: boolean;
  when?: string;
  body: string;
}

const HEADER =
  /^()\s*(before|after|instead\s+of)\s+((?:insert|update(?:\s+of\s+[\w$#",\s]+?)?|delete)(?:\s+or\s+(?:insert|update(?:\s+of\s+[\w$#",\s]+?)?|delete))*)\s+on\s+(?:"?[\w$#]+"?\s*\.\s*)?"?([\w$#]+)"?((?:\s+referencing\s+(?:(?:new|old|parent)\s+as\s+\w+\s*)+)?)(\s+for\s+each\s+row)?(?:\s+(?:enable|disable|follows\s+\S+|precedes\s+\S+))*(?:\s+when\s*\(([\s\S]*?)\))?\s+((?:declare|begin|compound\b)[\s\S]*)$/iu;

export function parseTriggerHeader(source: string): Header | undefined {
  const match = HEADER.exec(unitBody(source).replace(/--[^\n]*/gu, ' '));
  if (!match) return undefined;
  const events = match[3]!.toLowerCase();
  const of = /update\s+of\s+([\w$#",\s]+?)(?=\s+or\b|$)/iu.exec(events);
  return {
    name: describeUnit(source).name,
    timing: match[2]!.toLowerCase().replace(/\s+/gu, ' ') as Header['timing'],
    events: (['insert', 'update', 'delete'] as Event[]).filter((event) =>
      new RegExp(`\\b${event}\\b`, 'u').test(events),
    ),
    updateColumns: of
      ? of[1]!.split(',').map((column) => column.replaceAll('"', '').trim().toLowerCase())
      : [],
    table: match[4]!,
    row: Boolean(match[6]),
    ...(match[7] ? { when: match[7] } : {}),
    body: match[8]!,
  };
}

class Untranslatable extends Error {}

/** The SQL of trigger expressions for one event, with `:new` values as assigned so far. */
class Translation {
  readonly assigned = new Map<string, string>();
  readonly variables = new Map<string, string>();
  readonly skipped = new Set<string>();
  constructor(readonly event: Event) {}

  /** Current SQL value of `:new.column`. */
  newValue(column: string): string {
    return this.assigned.get(column) ?? `NEW."${column.toUpperCase()}"`;
  }

  expression(tokens: Expr): string {
    let text = '';
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]!;
      const pre = index === 0 ? '' : token.pre.replace(/\s+/gu, ' ');
      if (token.kind === 'bind' && ['NEW', 'OLD'].includes(token.value) && isOp(tokens[index + 1], '.')) {
        const column = tokens[index + 2]!.value.toLowerCase();
        text +=
          pre +
          (token.value === 'NEW'
            ? `(${this.newValue(column)})`
            : this.event === 'insert'
              ? 'null'
              : `OLD."${column.toUpperCase()}"`);
        index += 2;
        continue;
      }
      if (token.kind === 'word') {
        if (['inserting', 'updating', 'deleting'].includes(token.value)) {
          // `updating('COL')` is true for any update locally.
          if (isOp(tokens[index + 1], '(')) {
            let depth = 0;
            for (index += 1; index < tokens.length; index += 1) {
              if (isOp(tokens[index], '(')) depth += 1;
              if (isOp(tokens[index], ')') && --depth === 0) break;
            }
          }
          text += pre + (token.value === PREDICATE[this.event] ? '1' : '0');
          continue;
        }
        const global =
          isOp(tokens[index + 1], '.') && tokens[index + 2]?.kind === 'word'
            ? APEX_GLOBALS[`${token.value}.${tokens[index + 2]!.value}`]
            : undefined;
        if (global) {
          text += pre + global;
          index += 2;
          continue;
        }
        if (token.value === 'user' && !isOp(tokens[index + 1], '.')) {
          text += `${pre}coalesce(v('APP_USER'), 'APEX_LOCAL')`;
          continue;
        }
        const variable = this.variables.get(token.value);
        if (variable !== undefined && !isOp(tokens[index + 1], '.') && !isOp(tokens[index - 1], '.')) {
          text += `${pre}(${variable})`;
          continue;
        }
        if (isWord(token, 'true')) {
          text += `${pre}1`;
          continue;
        }
        if (isWord(token, 'false')) {
          text += `${pre}0`;
          continue;
        }
      }
      if (token.kind === 'bind') throw new Untranslatable(`bind :${token.value}`);
      text += pre + token.text;
    }
    const translated = translateOracleSql(`select ${text}`).replace(/^\s*select\s+/iu, '');
    return translated;
  }

  run(statements: Stmt[], condition?: string): void {
    for (const statement of statements) this.statement(statement, condition);
  }

  assign(column: string, value: string, condition?: string): void {
    this.assigned.set(
      column,
      condition ? `case when ${condition} then ${value} else ${this.newValue(column)} end` : value,
    );
  }

  statement(statement: Stmt, condition?: string): void {
    try {
      switch (statement.k) {
        case 'null':
        case 'noop':
          return;
        case 'assign': {
          const value = this.expression(statement.expr);
          if (statement.target.kind === 'row' && statement.target.row === 'new')
            return this.assign(statement.target.column, value, condition);
          if (statement.target.kind === 'var' && !statement.target.field && !statement.target.index) {
            const name = statement.target.name;
            const previous = this.variables.get(name) ?? 'null';
            this.variables.set(
              name,
              condition ? `case when ${condition} then ${value} else ${previous} end` : value,
            );
            return;
          }
          throw new Untranslatable('assignment');
        }
        case 'if': {
          // Earlier branches' conditions: a later branch runs only when none of them held.
          const previous: string[] = [];
          for (const branch of statement.branches) {
            const test = this.expression(branch.cond);
            const constant = /^\(*\s*([01])\s*\)*$/u.exec(test.trim())?.[1];
            if (constant === '0') continue;
            const guard = and(
              condition,
              ...previous.map((other) => `not coalesce(${other}, 0)`),
              constant === '1' ? undefined : `coalesce(${test}, 0)`,
            );
            this.run(branch.body, guard);
            if (constant === '1') return;
            previous.push(test);
          }
          if (statement.otherwise)
            this.run(
              statement.otherwise,
              and(condition, ...previous.map((other) => `not coalesce(${other}, 0)`)),
            );
          return;
        }
        case 'selectInto': {
          // The parser has already taken the INTO list out of the statement.
          if (statement.targets.length !== 1 || statement.bulk) throw new Untranslatable('select into');
          const target = statement.targets[0]!;
          const value = `(${this.expression(statement.sql)})`;
          if (target.kind === 'row' && target.row === 'new')
            return this.assign(target.column, value, condition);
          if (target.kind === 'var' && !target.field) {
            this.variables.set(target.name, value);
            return;
          }
          throw new Untranslatable('select into');
        }
        case 'block':
          this.declare(statement.block.decls);
          this.run(statement.block.body, condition);
          return;
        case 'call':
          throw new Untranslatable(`call to ${statement.name.join('.')}`);
        default:
          throw new Untranslatable(statement.k);
      }
    } catch (error) {
      if (!(error instanceof Untranslatable)) throw error;
      this.skipped.add(`${error.message} (line ${statement.line})`);
    }
  }

  declare(decls: ReturnType<Parser['declarations']>): void {
    for (const decl of decls)
      if (decl.kind === 'var') this.variables.set(decl.name, decl.init ? this.expression(decl.init) : 'null');
  }
}

/** Removes NOT NULL from the given columns of a table definition (SQLite DDL text). */
export function relaxNotNull(ddl: string, columns: string[]): string {
  const open = ddl.indexOf('(');
  const close = ddl.lastIndexOf(')');
  if (open < 0 || close < open) return ddl;
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of ddl.slice(open + 1, close)) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  const wanted = new Set(columns.map((column) => column.toLowerCase()));
  const rewritten = parts.map((part) => {
    const name = /^\s*"?([\w$#]+)"?/u.exec(part)?.[1]?.toLowerCase();
    if (!name || !wanted.has(name)) return part;
    return part.replace(/\s+not\s+null\b/giu, '').replace(/\s+constraint\s+"?[\w$#]+"?\s*(?=,|$)/giu, '');
  });
  return `${ddl.slice(0, open + 1)}${rewritten.join(',')}${ddl.slice(close)}`;
}

/** Applies an Oracle row trigger to SQLite; returns problems worth reporting. */
export function applyTrigger(db: LocalDatabase, source: string): string[] {
  const header = parseTriggerHeader(source);
  if (!header) return [`trigger: the trigger header is not understood locally; the trigger does not run`];
  const label = `trigger ${header.name}`;
  if (!header.row || header.timing !== 'before' || /^compound\b/iu.test(header.body))
    return [`${label}: ${header.timing} ${header.row ? 'row' : 'statement'} triggers do not run locally`];
  if (!db.tableExists(header.table)) return [`${label}: table ${header.table} does not exist`];
  let block;
  try {
    const parser = new Parser(header.body);
    block = parser.block();
  } catch (error) {
    return [
      `${label}: ${error instanceof PlsqlSyntaxError ? error.message : String(error)}; the trigger does not run`,
    ];
  }
  const problems: string[] = [];
  const created: string[] = [];
  const relax = new Set<string>();
  const table = header.table.replaceAll('"', '');
  for (const event of header.events.filter((entry) => entry !== 'delete')) {
    const translation = new Translation(event);
    try {
      translation.declare(block.decls);
      translation.run(block.body);
    } catch (error) {
      problems.push(`${label}: ${(error as Error).message}`);
      continue;
    }
    // SQLite resolves names in trigger bodies only when the trigger fires: an expression it cannot
    // run would make every insert fail, so each one is checked now and dropped when it fails.
    for (const [column, value] of [...translation.assigned]) {
      try {
        db.db.prepare(`select ${value} from "${table}" as NEW, "${table}" as OLD`);
      } catch (error) {
        translation.assigned.delete(column);
        translation.skipped.add(`:new.${column} (${(error as Error).message})`);
      }
    }
    if (translation.skipped.size)
      problems.push(`${label} (${event}): not run locally: ${[...translation.skipped].join(', ')}`);
    if (!translation.assigned.size) continue;
    if (event === 'insert') for (const column of translation.assigned.keys()) relax.add(column);
    const when = header.when
      ? ` when ${new Translation(event).expression(lex(header.when.replace(/\b(new|old)\s*\./giu, ':$1.')))}`
      : '';
    const of =
      event === 'update' && header.updateColumns.length
        ? ` of ${header.updateColumns.map((c) => `"${c.toUpperCase()}"`).join(', ')}`
        : '';
    const sets = [...translation.assigned]
      .map(([column, value]) => `"${column.toUpperCase()}" = ${value}`)
      .join(', ');
    created.push(
      `create trigger "apex_local_${header.name}_${event}" after ${event}${of} on "${table}" for each row${when} begin update "${table}" set ${sets} where rowid = NEW.rowid; end`,
    );
  }
  if (relax.size) relaxColumns(db, table, [...relax]);
  for (const statement of created) {
    try {
      db.db.exec(`drop trigger if exists ${/"apex_local_[^"]+"/u.exec(statement)![0]}`);
      db.db.exec(statement);
    } catch (error) {
      problems.push(`${label}: ${(error as Error).message}; the trigger does not run`);
    }
  }
  return problems;
}

function lex(text: string): Token[] {
  return new Parser(text).tokens;
}

/** Rewrites a table definition in place so the given columns accept NULL until the trigger fills them. */
function relaxColumns(db: LocalDatabase, table: string, columns: string[]): void {
  const row = db.db
    .prepare("select name, sql from sqlite_master where type = 'table' and upper(name) = upper(?)")
    .get(table) as { name: string; sql: string } | undefined;
  if (!row) return;
  const relaxed = relaxNotNull(row.sql, columns);
  if (relaxed === row.sql) return;
  const database = db.db as typeof db.db & { enableDefensive?: (on: boolean) => void };
  if (typeof database.enableDefensive !== 'function') return;
  const version = (db.db.prepare('pragma schema_version').get() as { schema_version: number }).schema_version;
  database.enableDefensive(false);
  try {
    db.db.exec('pragma writable_schema = on');
    db.db
      .prepare("update sqlite_master set sql = ? where type = 'table' and name = ?")
      .run(relaxed, row.name);
    db.db.exec(`pragma schema_version = ${version + 1}`);
  } finally {
    db.db.exec('pragma writable_schema = off');
    database.enableDefensive(true);
  }
}
