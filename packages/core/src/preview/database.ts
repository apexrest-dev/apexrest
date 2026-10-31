import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

export type Binds = Record<string, string | null | undefined>;
export type Row = Record<string, string | number | null>;

export interface QueryResult {
  columns: string[];
  rows: Row[];
}

function oracleDate(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const date = new Date(typeof value === 'number' ? value : String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const pad = (value: number, size = 2) => String(value).padStart(size, '0');
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Common Oracle datetime/number masks; anything else falls back to an ISO-like rendering. */
export function formatOracle(value: unknown, mask: string | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!mask) return String(value);
  const upper = mask.toUpperCase();
  if (
    /^(FM)?[L$]?[9990GD,.]+$/u.test(upper.replace(/^FML/u, 'L').replace(/^FM/u, '')) ||
    upper.includes('999')
  ) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    const decimals = (upper.split(/[D.]/u)[1] ?? '').replace(/[^09]/gu, '').length;
    const grouped = /[G,]/u.test(upper);
    const text = number.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: grouped,
    });
    return /[L$]/u.test(upper) ? `$${text}` : text;
  }
  const date = oracleDate(value);
  if (!date) return String(value);
  if (upper === 'DS' || upper === 'DL') return date.toLocaleDateString('en-US');
  return upper
    .replace(/YYYY/gu, String(date.getFullYear()))
    .replace(/RR|YY/gu, pad(date.getFullYear() % 100))
    .replace(/MONTH/gu, date.toLocaleString('en-US', { month: 'long' }))
    .replace(/MON/gu, MONTHS[date.getMonth()]!)
    .replace(/MM/gu, pad(date.getMonth() + 1))
    .replace(/DD/gu, pad(date.getDate()))
    .replace(/HH24/gu, pad(date.getHours()))
    .replace(/HH12|HH/gu, pad(date.getHours() % 12 || 12))
    .replace(/MI/gu, pad(date.getMinutes()))
    .replace(/SS/gu, pad(date.getSeconds()))
    .replace(/AM|PM/gu, date.getHours() < 12 ? 'AM' : 'PM');
}

/** Rewrites the most common Oracle-only syntax into SQLite. Function differences are covered by UDFs. */
export function translateOracleSql(sql: string): string {
  let text = sql
    .trim()
    .replace(/;\s*\/?\s*$/u, '')
    .replace(/\n\/\s*$/u, '');
  const literals: string[] = [];
  text = text.replace(/'(?:[^']|'')*'/gu, (literal) => {
    literals.push(literal);
    return `\u0000${literals.length - 1}\u0000`;
  });
  text = text
    .replace(/\bfrom\s+dual\b/giu, '')
    .replace(
      /\bsys(?:date|timestamp)\b|\bcurrent_(?:date|timestamp)\b|\blocaltimestamp\b/giu,
      "datetime('now','localtime')",
    )
    .replace(
      /\boffset\s+(\d+|:\w+)\s+rows?\s+fetch\s+(?:first|next)\s+(\d+|:\w+)\s+rows?\s+only\b/giu,
      'limit $2 offset $1',
    )
    .replace(/\bfetch\s+(?:first|next)\s+(\d+|:\w+)\s+rows?\s+only\b/giu, 'limit $1')
    .replace(
      /\blistagg\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*within\s+group\s*\([^)]*\)/giu,
      'group_concat($1)',
    )
    // Oracle identity/sequence DDL
    .replace(/\bgenerated\s+(?:always|by\s+default(?:\s+on\s+null)?)\s+as\s+identity(?:\s*\([^)]*\))?/giu, '')
    .replace(/\bvarchar2\s*\((\d+)\s*(?:char|byte)\)/giu, 'varchar2($1)')
    .replace(/\busing\s+index\b(?:\s+\w+)?/giu, '')
    .replace(/\benable\b|\bnovalidate\b/giu, '');
  return text.replace(/\u0000(\d+)\u0000/gu, (_match, index: string) => literals[Number(index)]!);
}

/** Names of `:BIND` variables outside string literals and quoted identifiers. */
export function bindNames(sql: string): string[] {
  const names = new Set<string>();
  const stripped = sql.replace(/'(?:[^']|'')*'|"[^"]*"|--[^\n]*|\/\*[\s\S]*?\*\//gu, ' ');
  for (const match of stripped.matchAll(/(?<![:\w]):([A-Za-z][\w$#]*)/gu)) names.add(match[1]!);
  return [...names];
}

/** Splits a SQL*Plus style script into executable statements, skipping PL/SQL units. */
export function splitScript(script: string): string[] {
  const statements: string[] = [];
  let current = '';
  let plsql = false;
  for (const line of script.replace(/\r\n?/gu, '\n').split('\n')) {
    const trimmed = line.trim();
    if (!current.trim() && /^(?:prompt|set|spool|whenever|exec|@|rem\b)/iu.test(trimmed)) continue;
    if (
      !current.trim() &&
      /^(?:begin|declare|create\s+(?:or\s+replace\s+)?(?:editionable\s+)?(?:package|procedure|function|trigger|type)\b)/iu.test(
        trimmed,
      )
    ) {
      plsql = true;
    }
    if (trimmed === '/') {
      if (!plsql && current.trim()) statements.push(current);
      current = '';
      plsql = false;
      continue;
    }
    current += `${line}\n`;
    if (!plsql && /;\s*(?:--.*)?$/u.test(trimmed)) {
      statements.push(current);
      current = '';
    }
  }
  if (current.trim() && !plsql) statements.push(current);
  return statements.map((statement) => statement.trim().replace(/;\s*$/u, '')).filter(Boolean);
}

export class LocalDatabase {
  readonly db: DatabaseSync;
  readonly file: string;
  #binds: Binds = {};

  constructor(file: string) {
    this.file = file;
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.#registerOracleFunctions();
  }

  #registerOracleFunctions(): void {
    const fn = (name: string, implementation: (...args: SQLInputValue[]) => SQLInputValue, varargs = true) =>
      this.db.function(name, { varargs, deterministic: false }, implementation);
    fn('nvl', (value, fallback) => value ?? fallback ?? null);
    fn('nvl2', (value, whenSet, whenNull) =>
      value !== null && value !== undefined ? (whenSet ?? null) : (whenNull ?? null),
    );
    fn('decode', (...args) => {
      const [expression, ...pairs] = args;
      for (let index = 0; index + 1 < pairs.length; index += 2) {
        if (pairs[index] === expression || (pairs[index] === null && expression === null))
          return pairs[index + 1] ?? null;
      }
      return pairs.length % 2 === 1 ? (pairs.at(-1) ?? null) : null;
    });
    fn('to_char', (value, mask) => formatOracle(value, typeof mask === 'string' ? mask : undefined));
    fn('to_number', (value) => (value === null || value === '' ? null : Number(value)));
    fn('to_date', (value) => {
      const date = oracleDate(value);
      return date
        ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
        : null;
    });
    fn('trunc', (value, unit) => {
      if (typeof value === 'number')
        return Math.trunc(value * 10 ** Number(unit ?? 0)) / 10 ** Number(unit ?? 0);
      const date = oracleDate(value);
      return date
        ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        : (value ?? null);
    });
    fn('initcap', (value) =>
      value === null
        ? null
        : String(value)
            .toLowerCase()
            .replace(/\b\w/gu, (char) => char.toUpperCase()),
    );
    fn('lpad', (value, size, fill) =>
      value === null
        ? null
        : String(value)
            .padStart(Number(size), String(fill ?? ' '))
            .slice(0, Number(size)),
    );
    fn('rpad', (value, size, fill) =>
      value === null
        ? null
        : String(value)
            .padEnd(Number(size), String(fill ?? ' '))
            .slice(0, Number(size)),
    );
    fn('add_months', (value, months) => {
      const date = oracleDate(value);
      if (!date) return null;
      date.setMonth(date.getMonth() + Number(months));
      return date.toISOString().slice(0, 19).replace('T', ' ');
    });
    fn('months_between', (left, right) => {
      const a = oracleDate(left);
      const b = oracleDate(right);
      return a && b
        ? (a.getFullYear() - b.getFullYear()) * 12 +
            (a.getMonth() - b.getMonth()) +
            (a.getDate() - b.getDate()) / 31
        : null;
    });
    fn('greatest', (...args) =>
      args.some((arg) => arg === null) ? null : args.reduce((a, b) => ((a ?? 0) > (b ?? 0) ? a : b)),
    );
    fn('least', (...args) =>
      args.some((arg) => arg === null) ? null : args.reduce((a, b) => ((a ?? 0) < (b ?? 0) ? a : b)),
    );
    fn('regexp_like', (value, pattern, flags) =>
      value !== null &&
      new RegExp(String(pattern), String(flags ?? '').includes('i') ? 'iu' : 'u').test(String(value))
        ? 1
        : 0,
    );
    fn('regexp_replace', (value, pattern, replacement) =>
      value === null
        ? null
        : String(value).replace(new RegExp(String(pattern), 'gu'), String(replacement ?? '')),
    );
    fn('v', (name) => this.#binds[String(name).toUpperCase()] ?? null);
    fn('sys_guid', () => crypto.randomUUID().replaceAll('-', '').toUpperCase());
  }

  #prepare(sql: string, binds: Binds) {
    this.#binds = Object.fromEntries(Object.entries(binds).map(([key, value]) => [key.toUpperCase(), value]));
    const translated = translateOracleSql(sql);
    const values: Record<string, SQLInputValue> = {};
    for (const name of bindNames(translated)) values[name] = this.#binds[name.toUpperCase()] ?? null;
    const statement = this.db.prepare(translated);
    statement.setAllowUnknownNamedParameters(true);
    return { statement, values };
  }

  query(sql: string, binds: Binds = {}, maxRows = 10_000): QueryResult {
    const { statement, values } = this.#prepare(sql, binds);
    const columns = statement.columns().map((column) => column.name.toUpperCase());
    const rows: Row[] = [];
    for (const raw of statement.iterate(values) as Iterable<Record<string, SQLInputValue>>) {
      const row: Row = {};
      for (const [key, value] of Object.entries(raw)) {
        row[key.toUpperCase()] =
          typeof value === 'bigint'
            ? Number(value)
            : value instanceof Uint8Array
              ? `[blob ${value.length} bytes]`
              : (value as string | number | null);
      }
      rows.push(row);
      if (rows.length >= maxRows) break;
    }
    return { columns, rows };
  }

  execute(sql: string, binds: Binds = {}): { changes: number; lastInsertRowid: number } {
    const { statement, values } = this.#prepare(sql, binds);
    const result = statement.run(values);
    return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
  }

  scalar(sql: string, binds: Binds = {}): string | number | null {
    const result = this.query(sql, binds, 1);
    const row = result.rows[0];
    return row ? (row[result.columns[0]!] ?? null) : null;
  }

  tableExists(table: string): boolean {
    return (
      this.db
        .prepare("select 1 from sqlite_master where type in ('table','view') and upper(name) = upper(?)")
        .get(table) !== undefined
    );
  }

  tableColumns(table: string): { name: string; pk: boolean; type: string }[] {
    return (
      this.db.prepare(`pragma table_info("${table.replaceAll('"', '')}")`).all() as {
        name: string;
        pk: number;
        type: string;
      }[]
    ).map((column) => ({
      name: column.name.toUpperCase(),
      pk: column.pk > 0,
      type: column.type.toUpperCase(),
    }));
  }

  /** Runs a script statement by statement; failures are reported, not fatal. */
  runScript(script: string, source: string): string[] {
    const problems: string[] = [];
    for (const statement of splitScript(script)) {
      try {
        this.execute(statement);
      } catch (error) {
        problems.push(
          `${source}: ${(error as Error).message} — ${statement.replace(/\s+/gu, ' ').slice(0, 140)}`,
        );
      }
    }
    return problems;
  }

  close(): void {
    if (this.db.isOpen) this.db.close();
  }
}
