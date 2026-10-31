import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

export type Binds = Record<string, string | number | null | undefined>;
export type Row = Record<string, string | number | null>;

export interface QueryResult {
  columns: string[];
  rows: Row[];
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function oracleDate(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const raw = String(value).trim();
  const oracle = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/u.exec(raw);
  if (oracle) {
    const month = MONTH_NAMES.findIndex(
      (name) => name.slice(0, 3).toUpperCase() === oracle[2]!.toUpperCase(),
    );
    const year = Number(oracle[3]!.length === 2 ? `20${oracle[3]}` : oracle[3]);
    if (month >= 0)
      return new Date(
        year,
        month,
        Number(oracle[1]),
        Number(oracle[4] ?? 0),
        Number(oracle[5] ?? 0),
        Number(oracle[6] ?? 0),
      );
  }
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/u.test(raw) ? `${raw}T00:00:00` : raw.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const pad = (value: number, size = 2) => String(value).padStart(size, '0');

/** `YYYY-MM-DD HH24:MI:SS`, the canonical date text stored in SQLite. */
export function isoDate(date: Date, time = true): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return time ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` : day;
}

const DATE_TOKENS = [
  'SSSSS',
  'SYYYY',
  'MONTH',
  'A.M.',
  'P.M.',
  'HH24',
  'HH12',
  'RRRR',
  'YYYY',
  'IYYY',
  'YYY',
  'DDD',
  'DAY',
  'MON',
  'TZR',
  'TZH',
  'TZM',
  'FF1',
  'FF2',
  'FF3',
  'FF4',
  'FF5',
  'FF6',
  'FF7',
  'FF8',
  'FF9',
  'FF',
  'YY',
  'RR',
  'MM',
  'DD',
  'DY',
  'HH',
  'MI',
  'SS',
  'AM',
  'PM',
  'FM',
  'WW',
  'IW',
  'Y',
  'D',
  'Q',
  'W',
  'J',
];

function isoWeek(date: Date): number {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - day + 3);
  const first = new Date(target.getFullYear(), 0, 4);
  return (
    1 + Math.round(((target.getTime() - first.getTime()) / 86_400_000 - 3 + ((first.getDay() + 6) % 7)) / 7)
  );
}

const dayOfYear = (date: Date) =>
  Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 1)) /
      86_400_000,
  ) + 1;

function formatDate(date: Date, mask: string): string {
  let out = '';
  let fm = false;
  for (let index = 0; index < mask.length;) {
    if (mask[index] === '"') {
      const end = mask.indexOf('"', index + 1);
      out += mask.slice(index + 1, end < 0 ? mask.length : end);
      index = end < 0 ? mask.length : end + 1;
      continue;
    }
    const token = DATE_TOKENS.find(
      (candidate) => mask.slice(index, index + candidate.length).toUpperCase() === candidate,
    );
    if (!token) {
      out += mask[index];
      index += 1;
      continue;
    }
    const raw = mask.slice(index, index + token.length);
    index += token.length;
    const number = (value: number, width: number) => (fm ? String(value) : pad(value, width));
    const cased = (word: string) =>
      raw === raw.toUpperCase()
        ? word.toUpperCase()
        : raw[0] === raw[0]!.toUpperCase()
          ? word[0]!.toUpperCase() + word.slice(1).toLowerCase()
          : word.toLowerCase();
    const hours12 = date.getHours() % 12 || 12;
    switch (token) {
      case 'FM':
        fm = !fm;
        break;
      case 'YYYY':
      case 'SYYYY':
      case 'RRRR':
      case 'IYYY':
        out += String(date.getFullYear());
        break;
      case 'YYY':
        out += pad(date.getFullYear() % 1000, 3);
        break;
      case 'YY':
      case 'RR':
        out += pad(date.getFullYear() % 100);
        break;
      case 'Y':
        out += String(date.getFullYear() % 10);
        break;
      case 'MONTH':
        out += cased(MONTH_NAMES[date.getMonth()]!);
        break;
      case 'MON':
        out += cased(MONTH_NAMES[date.getMonth()]!.slice(0, 3));
        break;
      case 'MM':
        out += number(date.getMonth() + 1, 2);
        break;
      case 'DDD':
        out += number(dayOfYear(date), 3);
        break;
      case 'DD':
        out += number(date.getDate(), 2);
        break;
      case 'DAY':
        out += cased(DAY_NAMES[date.getDay()]!);
        break;
      case 'DY':
        out += cased(DAY_NAMES[date.getDay()]!.slice(0, 3));
        break;
      case 'D':
        out += String(date.getDay() + 1);
        break;
      case 'HH24':
        out += number(date.getHours(), 2);
        break;
      case 'HH12':
      case 'HH':
        out += number(hours12, 2);
        break;
      case 'MI':
        out += number(date.getMinutes(), 2);
        break;
      case 'SS':
        out += number(date.getSeconds(), 2);
        break;
      case 'SSSSS':
        out += String(date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds());
        break;
      case 'AM':
      case 'PM':
        out += cased(date.getHours() < 12 ? 'AM' : 'PM');
        break;
      case 'A.M.':
      case 'P.M.':
        out += cased(date.getHours() < 12 ? 'A.M.' : 'P.M.');
        break;
      case 'Q':
        out += String(Math.floor(date.getMonth() / 3) + 1);
        break;
      case 'WW':
        out += number(Math.floor((dayOfYear(date) - 1) / 7) + 1, 2);
        break;
      case 'IW':
        out += number(isoWeek(date), 2);
        break;
      case 'W':
        out += String(Math.floor((date.getDate() - 1) / 7) + 1);
        break;
      case 'J':
        out += String(Math.floor(date.getTime() / 86_400_000 + 2_440_587.5));
        break;
      case 'TZR':
      case 'TZH':
      case 'TZM':
        break;
      default:
        out += pad(date.getMilliseconds(), 3)
          .padEnd(9, '0')
          .slice(0, Number(token.slice(2) || 6));
    }
  }
  return out;
}

function formatNumber(value: unknown, upper: string): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (/X/u.test(upper))
    return Math.round(number).toString(16)[upper.includes('x') ? 'toLowerCase' : 'toUpperCase']();
  const body = upper
    .replace(/^FM/u, '')
    .replace(/^[L$S]/u, '')
    .replace(/(MI|PR|S)$/u, '');
  const [whole = '', fraction = ''] = body.split(/[D.]/u);
  const decimals = fraction.replace(/[^09]/gu, '').length;
  const zeros = whole.includes('0') ? whole.slice(whole.indexOf('0')).replace(/[^09]/gu, '').length : 0;
  let text = Math.abs(number).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    minimumIntegerDigits: Math.max(1, zeros),
    useGrouping: /[G,]/u.test(whole),
  });
  if (!zeros && !decimals && text === '0' && whole && !whole.includes('0')) text = '0';
  if (!zeros && text.startsWith('0.') && !whole.includes('0') && whole) text = text.slice(1);
  if (/^FM?[L$]|^[L$]/u.test(upper.replace(/^FM/u, 'F'))) text = `$${text}`;
  if (number < 0) return upper.endsWith('MI') ? `${text}-` : upper.endsWith('PR') ? `<${text}>` : `-${text}`;
  return upper.endsWith('S') && upper.startsWith('S') ? `+${text}` : text;
}

/** Oracle TO_CHAR for datetime and number masks. */
export function formatOracle(value: unknown, mask: string | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!mask) return String(value);
  const upper = mask.trim().toUpperCase();
  if (upper === 'TM' || upper === 'TM9') return String(Number(value));
  if (/[90X]/u.test(upper) && /^(?:FM)?[L$S]?[09GD,.X]+(?:MI|PR|S)?$/u.test(upper))
    return formatNumber(value, upper);
  if (upper === 'DS' || upper === 'DL') {
    const date = oracleDate(value);
    if (!date) return String(value);
    return upper === 'DS'
      ? date.toLocaleDateString('en-US')
      : date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  const date = oracleDate(value);
  return date ? formatDate(date, mask) : String(value);
}

/** Oracle TO_DATE with a format mask; falls back to free-form parsing. */
export function parseOracleDate(value: unknown, mask?: string): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (!mask) return oracleDate(value);
  const source = String(value).trim();
  const parts = {
    year: new Date().getFullYear(),
    month: 0,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    pm: false,
  };
  let position = 0;
  const digits = (max: number) => {
    const match = new RegExp(`^\\d{1,${max}}`, 'u').exec(source.slice(position));
    if (!match) throw new Error('mismatch');
    position += match[0].length;
    return Number(match[0]);
  };
  try {
    for (let index = 0; index < mask.length;) {
      const token = DATE_TOKENS.find(
        (candidate) => mask.slice(index, index + candidate.length).toUpperCase() === candidate,
      );
      if (!token) {
        index += 1;
        if (/[^\w]/u.test(source[position] ?? '')) position += 1;
        continue;
      }
      index += token.length;
      switch (token) {
        case 'YYYY':
        case 'RRRR':
        case 'SYYYY':
          parts.year = digits(4);
          break;
        case 'YY':
        case 'RR': {
          const year = digits(2);
          parts.year = year < 50 ? 2000 + year : 1900 + year;
          break;
        }
        case 'MM':
          parts.month = digits(2) - 1;
          break;
        case 'MON':
        case 'MONTH': {
          const word = /^[A-Za-z]+/u.exec(source.slice(position))?.[0] ?? '';
          position += word.length;
          parts.month = MONTH_NAMES.findIndex(
            (name) => name.slice(0, 3).toUpperCase() === word.slice(0, 3).toUpperCase(),
          );
          if (parts.month < 0) throw new Error('mismatch');
          break;
        }
        case 'DD':
          parts.day = digits(2);
          break;
        case 'HH24':
        case 'HH':
        case 'HH12':
          parts.hour = digits(2);
          break;
        case 'MI':
          parts.minute = digits(2);
          break;
        case 'SS':
          parts.second = digits(2);
          break;
        case 'AM':
        case 'PM':
          parts.pm = /^p/iu.test(source.slice(position));
          position += 2;
          break;
        default:
          break;
      }
    }
  } catch {
    return oracleDate(value);
  }
  const hour = parts.pm && parts.hour < 12 ? parts.hour + 12 : parts.hour;
  const date = new Date(parts.year, parts.month, parts.day, hour, parts.minute, parts.second);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Oracle TRUNC(date, unit). */
export function truncDate(date: Date, unit = 'DD'): string {
  const upper = unit.toUpperCase();
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (['YYYY', 'YEAR', 'SYYYY', 'YYY', 'YY', 'Y', 'RRRR', 'RR', 'IYYY'].includes(upper))
    result.setMonth(0, 1);
  else if (['MM', 'MON', 'MONTH', 'RM'].includes(upper)) result.setDate(1);
  else if (upper === 'Q') result.setMonth(Math.floor(date.getMonth() / 3) * 3, 1);
  else if (upper === 'IW') result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  else if (['DAY', 'DY', 'D'].includes(upper)) result.setDate(result.getDate() - result.getDay());
  else if (['HH', 'HH24', 'HH12'].includes(upper)) {
    result.setHours(date.getHours());
    return isoDate(result);
  } else if (upper === 'MI') {
    result.setHours(date.getHours(), date.getMinutes());
    return isoDate(result);
  }
  return isoDate(result, false);
}

// ---------------------------------------------------------------- package functions in SQL

export type SqlValue = string | number | null;
/** SQL values as blob-aware functions see them: BLOB arguments arrive as bytes. */
export type BlobSqlValue = SqlValue | Uint8Array;

interface OracleFunction {
  sqlName: string;
  params: string[];
  impl: (args: BlobSqlValue[]) => BlobSqlValue;
  blobs: boolean;
}

/** Package functions (`apex_escape.html(...)`) callable from SQL, keyed by lowercase dotted name. */
const oracleFunctions = new Map<string, OracleFunction>();

export function registerOracleFunction(
  name: string,
  params: string[],
  impl: (args: SqlValue[]) => SqlValue,
): void;
/** With `blobs`, BLOB arguments (and BLOB tokens) arrive as bytes and bytes may be returned. */
export function registerOracleFunction(
  name: string,
  params: string[],
  impl: (args: BlobSqlValue[]) => BlobSqlValue,
  options: { blobs: true },
): void;
export function registerOracleFunction(
  name: string,
  params: string[],
  impl: (args: never[]) => BlobSqlValue,
  options?: { blobs?: boolean },
): void {
  const key = name.toLowerCase();
  oracleFunctions.set(key, {
    sqlName: key.replaceAll('.', '__'),
    params,
    impl: impl as (args: BlobSqlValue[]) => BlobSqlValue,
    blobs: options?.blobs ?? false,
  });
}

/**
 * Table functions (`table(apex_data_parser.parse(...)) p`): the implementation returns rows
 * whose keys are the upper-case column names. Arguments may reference earlier FROM items.
 */
interface TableFunction {
  columns: string[];
}
const tableFunctions = new Map<string, TableFunction>();

export function registerTableFunction(
  name: string,
  params: string[],
  columns: string[],
  impl: (args: BlobSqlValue[]) => Record<string, SqlValue>[],
): void {
  const key = name.toLowerCase();
  const upper = columns.map((column) => column.toUpperCase());
  registerOracleFunction(
    name,
    params,
    (args) => JSON.stringify(impl(args).map((row) => upper.map((column) => row[column] ?? null))),
    { blobs: true },
  );
  tableFunctions.set(key.replaceAll('.', '__'), { columns: upper });
}

/** Schema the preview runtime needs in every database (APEX views and tables); run on open. */
const databaseSetups: ((db: LocalDatabase) => void)[] = [];
export function registerDatabaseSetup(setup: (db: LocalDatabase) => void): void {
  databaseSetups.push(setup);
}

const MASK = /\u0000(\d+)\u0000/gu;

function maskLiterals(sql: string): { text: string; literals: string[] } {
  const literals: string[] = [];
  const text = sql.replace(/'(?:[^']|'')*'/gu, (literal) => {
    literals.push(literal);
    return `\u0000${literals.length - 1}\u0000`;
  });
  return { text, literals };
}

const unmask = (text: string, literals: string[]) =>
  text.replace(MASK, (_match, index: string) => literals[Number(index)]!);

/** Index of the `)` matching the `(` at `open` in literal-masked text. */
function closingParen(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '(') depth += 1;
    else if (text[index] === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** Splits on commas outside parentheses. */
function topLevelCommas(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  if (current.trim() || parts.length) parts.push(current);
  return parts;
}

/** `pkg.fn(p_b => 1, p_a => 2)` → `pkg__fn(2, 1)` for registered package functions. */
function rewritePackageCalls(text: string): string {
  const pattern = /\b(?:sys\s*\.\s*)?([A-Za-z_][\w$#]*)\s*\.\s*([A-Za-z_][\w$#]*)\s*\(/gu;
  let out = '';
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const fn = oracleFunctions.get(`${match[1]!.toLowerCase()}.${match[2]!.toLowerCase()}`);
    if (!fn) continue;
    const open = match.index + match[0].length - 1;
    const close = closingParen(text, open);
    if (close < 0) continue;
    const args = topLevelCommas(rewritePackageCalls(text.slice(open + 1, close)));
    const positional: string[] = [];
    for (const arg of args) {
      const named = /^\s*([A-Za-z_][\w$#]*)\s*=>\s*([\s\S]*)$/u.exec(arg);
      if (!named) positional.push(arg.trim());
      else {
        const index = fn.params.indexOf(named[1]!.toLowerCase());
        if (index >= 0) positional[index] = named[2]!.trim();
      }
    }
    out += `${text.slice(last, match.index)}${fn.sqlName}(${Array.from(positional, (arg) => arg ?? 'null').join(', ')})`;
    last = close + 1;
    pattern.lastIndex = close + 1;
  }
  return out + text.slice(last);
}

/** Built-in APEX table functions without arguments, inlined as row sets. */
const TABLE_FUNCTIONS: Record<string, string> = {
  'apex_util.get_timeframe_lov_data': [
    ['Last 15 Minutes', 900],
    ['Last Hour', 3600],
    ['Last 2 Hours', 7200],
    ['Last 4 Hours', 14_400],
    ['Last 8 Hours', 28_800],
    ['Last 16 Hours', 57_600],
    ['Last Day', 86_400],
    ['Last 2 Days', 172_800],
    ['Last 3 Days', 259_200],
    ['Last 4 Days', 345_600],
    ['Last 5 Days', 432_000],
    ['Last Week', 604_800],
    ['Last 2 Weeks', 1_209_600],
    ['Last 4 Weeks', 2_419_200],
  ]
    .map(([disp, val], index) => `select '${disp}' as disp, ${val} as val, ${index + 1} as insert_order`)
    .join(' union all '),
};

/** `table(expr)` over a collection-returning function → rows of `column_value`. */
function rewriteTableCollections(text: string): string {
  const pattern = /\btable\s*\(/giu;
  const lateral: { alias: string; columns: string[] }[] = [];
  let out = '';
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const open = match.index + match[0].length - 1;
    const close = closingParen(text, open);
    if (close < 0) continue;
    const inner = text.slice(open + 1, close).trim();
    const builtin = TABLE_FUNCTIONS[inner.toLowerCase().replace(/^sys\./u, '')];
    const registered = tableFunctions.get(/^([\w$#]+)\s*\(/u.exec(inner)?.[1]?.toLowerCase() ?? '');
    if (registered) {
      const alias =
        /^\s*(?:as\s+)?(?!(?:where|on|join|left|inner|cross|group|order|union|connect|start)\b)([A-Za-z_][\w$#]*)/iu.exec(
          text.slice(close + 1),
        );
      const columns = registered.columns
        .map((column, index) => `json_extract(value, '$[${index}]') as ${column.toLowerCase()}`)
        .join(', ');
      // Arguments that reference other FROM items (f.blob_content) need a lateral join: json_each
      // is a table-valued function, so `alias.column` references are rewritten onto its rows.
      const args = inner.slice(inner.indexOf('(') + 1, -1);
      if (alias && /\b[A-Za-z_][\w$#]*\s*\.\s*[A-Za-z_"]/u.test(args)) {
        out += `${text.slice(last, match.index)}json_each(${inner})`;
        last = close + 1;
        lateral.push({ alias: alias[1]!, columns: registered.columns });
      } else {
        out += `${text.slice(last, match.index)}(select ${columns} from json_each(${inner}))`;
        last = close + 1;
      }
      pattern.lastIndex = close + 1;
      continue;
    }
    out += builtin
      ? `${text.slice(last, match.index)}(${builtin})`
      : `${text.slice(last, match.index)}(select value as column_value from json_each(${inner}))`;
    last = close + 1;
    pattern.lastIndex = close + 1;
  }
  out += text.slice(last);
  for (const { alias, columns } of lateral) {
    // a bare select-list item keeps its column name: `select p.col001, ...` -> `... as col001`
    out = out.replace(
      new RegExp(
        `(\\bselect\\s+(?:distinct\\s+)?|,\\s*)(${alias}\\s*\\.\\s*([A-Za-z_][\\w$#]*))(?=\\s*(?:,|\\bfrom\\b))`,
        'giu',
      ),
      (whole, lead: string, reference: string, column: string) =>
        columns.includes(column.toUpperCase()) ? `${lead}${reference} as ${column}` : whole,
    );
    out = out.replace(
      new RegExp(`\\b${alias}\\s*\\.\\s*([A-Za-z_][\\w$#]*)\\b`, 'giu'),
      (whole, column: string) => {
        const index = columns.indexOf(column.toUpperCase());
        return index < 0 ? whole : `json_extract(${alias}.value, '$[${index}]')`;
      },
    );
  }
  return out;
}

/** `where rownum <= 5` → `limit 5` on the enclosing query; other `rownum` uses → row_number(). */
function rewriteRownum(text: string): string {
  if (!/\brownum\b/iu.test(text)) return text;
  const predicate = /\b(where|and)\s+rownum\s*(<=|<|=)\s*(\d+|:\w+)\s*(and\b)?/giu;
  for (const match of [...text.matchAll(predicate)].reverse()) {
    let depth = 0;
    let scopeEnd = text.length;
    for (let index = match.index + match[0].length; index < text.length; index += 1) {
      if (text[index] === '(') depth += 1;
      else if (text[index] === ')') {
        if (depth === 0) {
          scopeEnd = index;
          break;
        }
        depth -= 1;
      }
    }
    const tail = text.slice(match.index + match[0].length, scopeEnd);
    if (/\blimit\b/iu.test(tail)) continue;
    const [, keyword, op, bound, trailingAnd] = match;
    const limit =
      op === '<'
        ? /^\d+$/u.test(bound!)
          ? String(Number(bound) - 1)
          : `${bound} - 1`
        : op === '='
          ? '1'
          : bound!;
    const replacement =
      keyword!.toLowerCase() === 'where' ? (trailingAnd ? 'where ' : '') : trailingAnd ? 'and ' : '';
    text = `${text.slice(0, match.index)}${`${replacement}${tail.trimStart()}`.trimEnd()} limit ${limit}${text.slice(scopeEnd)}`;
  }
  return text.replace(/\brownum\b/giu, 'row_number() over ()');
}

/** `connect by level <= N` row generators → a recursive CTE joined to the query's FROM (or replacing it). */
function rewriteConnectBy(text: string): string {
  const pattern =
    /(\bfrom\s+[\w$#.]+(?:\s+(?!connect\b)[\w$#]+)?\s+)?\bconnect\s+by\s+(?:level|rownum)\s*(<=|<)\s*/giu;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < text.length; end += 1) {
      const char = text[end]!;
      if (char === '(') depth += 1;
      else if (char === ')') {
        if (depth === 0) break;
        depth -= 1;
      } else if (
        depth === 0 &&
        /^\s(?:order|union|group|minus|intersect)\b/iu.test(text.slice(end, end + 12))
      )
        break;
    }
    const bound = text.slice(match.index + match[0].length, end).trim();
    const generator = `(with recursive apex_local_levels(level) as (select 1 union all select level + 1 from apex_local_levels where level < (${bound})${match[2] === '<' ? ' - 1' : ''}) select level from apex_local_levels)`;
    const replacement = match[1] ? `${match[1].trimEnd()}, ${generator} ` : `from ${generator} `;
    text = text.slice(0, match.index) + replacement + text.slice(end);
    pattern.lastIndex = match.index + replacement.length;
  }
  return text;
}

/** Rewrites the most common Oracle-only syntax into SQLite. Function differences are covered by UDFs. */
export function translateOracleSql(sql: string): string {
  const trimmed = sql
    .trim()
    .replace(/;\s*\/?\s*$/u, '')
    .replace(/\n\/\s*$/u, '');
  const masked = maskLiterals(trimmed);
  let text = masked.text
    .replace(/\bfrom\s+dual\b/giu, '')
    .replace(
      /\bsys(?:date|timestamp)\s*([+-])\s*(\d+(?:\.\d+)?)\b(?!\s*[/*])/giu,
      (_whole, sign: string, days: string) => `datetime('now','localtime','${sign}${days} days')`,
    )
    // sysdate - n/24, sysdate + (expr), sysdate - :BIND: day arithmetic with any simple operand.
    .replace(
      /\b(?:sys(?:date|timestamp)|current_(?:date|timestamp)|localtimestamp)\s*([+-])\s*(\(\s*[^()]*\)|:\w+|\d+(?:\.\d+)?(?:\s*[/*]\s*(?:\d+(?:\.\d+)?|:\w+))+)/giu,
      (_whole, sign: string, operand: string) =>
        `datetime('now','localtime', printf('%+.6f days', ${sign === '-' ? '-' : ''}(${operand.replace(/\//gu, '*1.0/')})))`,
    )
    .replace(
      /\bsys(?:date|timestamp)\b|\bcurrent_(?:date|timestamp)\b|\blocaltimestamp\b/giu,
      "datetime('now','localtime')",
    )
    .replace(
      /\boffset\s+(\d+|:\w+)\s+rows?\s+fetch\s+(?:first|next)\s+(\d+|:\w+)\s+rows?\s+(?:only|with\s+ties)\b/giu,
      'limit $2 offset $1',
    )
    .replace(/\bfetch\s+(?:first|next)\s+(\d+|:\w+)\s+rows?\s+(?:only|with\s+ties)\b/giu, 'limit $1')
    .replace(
      /\blistagg\s*\(\s*(distinct\s+)?([^(),]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^(),]*)*)\s*(?:,\s*([^(),]+?))?\s*(?:on\s+overflow\s+\w+(?:\s+\S+)?(?:\s+(?:with|without)\s+count)?)?\s*\)\s*within\s+group\s*\(\s*(order\s+by\s+[^()]*(?:\([^()]*\)[^()]*)*)\)/giu,
      (_whole, distinct: string | undefined, value: string, separator: string | undefined, order: string) =>
        distinct
          ? `group_concat(distinct ${value})`
          : `group_concat(${value}, ${separator ?? "''"} ${order})`,
    )
    .replace(/\bextract\s*\(\s*(year|month|day|hour|minute|second)\s+from\s+/giu, "apex_local_extract('$1', ")
    // trim(both|leading|trailing 'x' from expr) -> trim/ltrim/rtrim(expr, 'x')
    .replace(
      /\btrim\s*\(\s*(both|leading|trailing)\s+(\u0000\d+\u0000)\s+from\s+([^()]*?(?:\([^()]*\)[^()]*?)*)\)/giu,
      (_whole, side: string, chars: string, value: string) =>
        `${{ both: 'trim', leading: 'ltrim', trailing: 'rtrim' }[side.toLowerCase() as 'both']}(${value.trim()}, ${chars})`,
    )
    .replace(
      /\bcast\s*\(([^()]*(?:\([^()]*\)[^()]*)*?)\s+as\s+(?:date|timestamp(?:\s*\(\s*\d\s*\))?(?:\s+with(?:\s+local)?\s+time\s+zone)?)\s*\)/giu,
      '($1)',
    )
    .replace(/\s+at\s+(?:local\b|time\s+zone\s+(?:\u0000\d+\u0000|[\w$#.:+-]+))/giu, '')
    .replace(
      /\b(?:[A-Za-z_][\w$#]*\.)?([A-Za-z_][\w$#]*)\.(nextval|currval)\b/giu,
      (_whole, name: string, kind: string) => `apex_local_${kind.toLowerCase()}('${name.toUpperCase()}')`,
    )
    // Oracle identity/sequence DDL
    .replace(/\bgenerated\s+(?:always|by\s+default(?:\s+on\s+null)?)\s+as\s+identity(?:\s*\([^)]*\))?/giu, '')
    .replace(/\bvarchar2\s*\((\d+)\s*(?:char|byte)\)/giu, 'varchar2($1)')
    .replace(/\busing\s+index\b(?:\s+\w+)?/giu, '')
    .replace(/\benable\b|\bnovalidate\b/giu, '');
  text = rewriteRownum(rewriteConnectBy(rewriteTableCollections(rewritePackageCalls(text))));
  return unmask(text, masked.literals);
}

/** MERGE is not SQLite: an UPDATE of matched rows followed by an INSERT of unmatched ones. */
export function translateMerge(sql: string): string[] | undefined {
  const masked = maskLiterals(translateOracleSql(sql));
  const text = masked.text;
  const head = /^\s*merge\s+into\s+([\w$#."]+)(?:\s+(?:as\s+)?(?!using\b)([\w$#]+))?\s+using\s+/iu.exec(text);
  if (!head) return undefined;
  const table = head[1]!;
  const alias = head[2] ?? table;
  let position = head[0].length;
  let source: string;
  if (text[position] === '(') {
    const close = closingParen(text, position);
    if (close < 0) return undefined;
    source = text.slice(position + 1, close);
    position = close + 1;
  } else {
    const name = /^[\w$#."]+/u.exec(text.slice(position))![0];
    source = name.toLowerCase() === 'dual' ? 'select 1 as dummy' : `select * from ${name}`;
    position += name.length;
  }
  const sourceAlias = /^\s*(?:as\s+)?(?!on\b)([\w$#]+)/iu.exec(text.slice(position));
  const sAlias = sourceAlias ? sourceAlias[1]! : 'apex_local_src';
  if (sourceAlias) position += sourceAlias[0].length;
  const on = /^\s*on\s*\(/iu.exec(text.slice(position));
  if (!on) return undefined;
  const open = position + on[0].length - 1;
  const close = closingParen(text, open);
  const condition = text.slice(open + 1, close);
  const rest = text.slice(close + 1);
  const from = `from (${source}) as ${sAlias}`;
  const statements: string[] = [];
  const matched = /\bwhen\s+matched\s+then\s+update\s+set\s+([\s\S]*?)(?=\bwhen\s+not\s+matched\b|$)/iu.exec(
    rest,
  );
  if (matched) {
    const [assignments, where] = matched[1]!.split(/\bwhere\b/iu);
    const sets = topLevelCommas(assignments!.replace(/\bdelete\s+where[\s\S]*$/iu, '')).map((assignment) => {
      const [column, ...value] = assignment.split('=');
      const name = column!.trim().replace(/^[\w$#]+\./u, '');
      return `${name} = (select ${value.join('=').trim()} ${from} where ${condition})`;
    });
    statements.push(
      `update ${table} as ${alias} set ${sets.join(', ')} where exists (select 1 ${from} where ${condition}${where ? ` and (${where})` : ''})`,
    );
  }
  const insert =
    /\bwhen\s+not\s+matched\s+then\s+insert\s*(\([^)]*\))?\s*values\s*\(([\s\S]*)\)\s*(?:where\s+([\s\S]*))?$/iu.exec(
      rest.replace(/\bwhen\s+matched\s+then\s+update[\s\S]*?(?=\bwhen\s+not\s+matched\b)/iu, ''),
    );
  if (insert) {
    statements.push(
      `insert into ${table} ${insert[1] ?? ''} select ${insert[2]} ${from} where not exists (select 1 from ${table} as ${alias} where ${condition})${insert[3] ? ` and (${insert[3]})` : ''}`,
    );
  }
  return statements.length ? statements.map((statement) => unmask(statement, masked.literals)) : undefined;
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

/** `[blob 1234 bytes #0123456789abcdef]`: how BLOB values travel through text-only session state and PL/SQL. */
const BLOB_TOKEN = /^\[blob (\d+) bytes #([0-9a-f]{16})\]$/u;
const BLOB_CACHE_BYTES = 128 * 1_048_576;

export class LocalDatabase {
  readonly db: DatabaseSync;
  readonly file: string;
  #binds: Binds = {};
  #blobs = new Map<string, Uint8Array>();
  #blobBytes = 0;
  #functions = new Set<string>();
  #sequences = new Map<string, { value: number | null; increment: number; start: number }>();
  #dirtySequences = new Set<string>();

  constructor(file: string) {
    this.file = file;
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.#registerOracleFunctions();
    for (const setup of databaseSetups) setup(this);
  }

  /**
   * Query results carry BLOBs as tokens (`[blob N bytes #hash]`) so they fit session state,
   * PL/SQL variables and bind values; binding a token, or passing it to a blob-aware function,
   * restores the bytes. Recently seen BLOBs are kept in memory for that.
   */
  blobToken(bytes: Uint8Array): string {
    const key = crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 16);
    const token = `[blob ${bytes.length} bytes #${key}]`;
    if (this.#blobs.has(token)) this.#blobs.delete(token);
    else this.#blobBytes += bytes.length;
    this.#blobs.set(token, bytes);
    for (const [oldest, value] of this.#blobs) {
      if (this.#blobBytes <= BLOB_CACHE_BYTES || oldest === token) break;
      this.#blobs.delete(oldest);
      this.#blobBytes -= value.length;
    }
    return token;
  }

  /** Bytes of a BLOB value or token; undefined for anything else. */
  blob(value: unknown): Uint8Array | undefined {
    if (value instanceof Uint8Array) return value;
    if (typeof value !== 'string' || !BLOB_TOKEN.test(value)) return undefined;
    return this.#blobs.get(value);
  }

  static isBlobToken(value: unknown): boolean {
    return typeof value === 'string' && BLOB_TOKEN.test(value);
  }

  #sqlValue(value: unknown): SQLInputValue {
    if (typeof value === 'bigint') return Number(value);
    if (value instanceof Uint8Array) return this.blobToken(value);
    return (value ?? null) as SQLInputValue;
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
    fn('to_date', (value, mask) => {
      const date = parseOracleDate(value, typeof mask === 'string' ? mask : undefined);
      return date ? isoDate(date) : null;
    });
    fn('to_timestamp', (value, mask) => {
      const date = parseOracleDate(value, typeof mask === 'string' ? mask : undefined);
      return date ? isoDate(date) : null;
    });
    fn('trunc', (value, unit) => {
      if (typeof value === 'number')
        return Math.trunc(value * 10 ** Number(unit ?? 0)) / 10 ** Number(unit ?? 0);
      if (typeof value === 'string' && /^\s*-?\d+(\.\d+)?\s*$/u.test(value)) return Math.trunc(Number(value));
      const date = oracleDate(value);
      return date ? truncDate(date, typeof unit === 'string' ? unit : 'DD') : (value ?? null);
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
    fn('regexp_replace', (value, pattern, replacement, position, occurrence, flags) => {
      if (value === null) return null;
      const text = String(value);
      const offset = Number(position ?? 1) - 1;
      const nth = Number(occurrence ?? 0);
      const regex = new RegExp(String(pattern), `g${String(flags ?? '').includes('i') ? 'i' : ''}u`);
      const replace = String(replacement ?? '').replace(/\\(\d)/gu, '$$$1');
      let count = 0;
      return (
        text.slice(0, offset) +
        text.slice(offset).replace(regex, (...match) => {
          count += 1;
          if (nth && count !== nth) return match[0] as string;
          return (match[0] as string).replace(
            new RegExp(String(pattern), `${String(flags ?? '').includes('i') ? 'i' : ''}u`),
            replace,
          );
        })
      );
    });
    // Oracle: a NULL (or missing) replacement removes the search string; SQLite would return NULL.
    fn('replace', (value, search, replacement) =>
      value === null || value === undefined
        ? null
        : search === null || search === undefined || search === ''
          ? String(value)
          : String(value)
              .split(String(search))
              .join(replacement === null || replacement === undefined ? '' : String(replacement)),
    );
    fn('v', (name) => this.#binds[String(name).toUpperCase()] ?? null);
    fn('nv', (name) => {
      const value = this.#binds[String(name).toUpperCase()];
      return value === null || value === undefined || value === '' ? null : Number(value);
    });
    fn('sys_context', (namespace, parameter) => {
      const key = String(parameter ?? '').toUpperCase();
      if (String(namespace).toUpperCase() === 'APEX$SESSION')
        return this.#binds[key === 'APP_SESSION' ? 'APP_SESSION' : key] ?? null;
      if (key === 'SESSION_USER' || key === 'CURRENT_USER' || key === 'CURRENT_SCHEMA') return 'APEX_LOCAL';
      if (key === 'LANG' || key === 'LANGUAGE') return 'US';
      return null;
    });
    fn('instr', (value, search, start, occurrence) => {
      if (value === null || search === null) return null;
      const text = String(value);
      const needle = String(search);
      let from = Number(start ?? 1);
      let count = Number(occurrence ?? 1);
      if (from > 0) {
        let index = from - 2;
        while (count > 0) {
          index = text.indexOf(needle, index + 1);
          if (index < 0) return 0;
          count -= 1;
        }
        return index + 1;
      }
      let index = text.length + from + 1;
      while (count > 0) {
        index = text.lastIndexOf(needle, index - 1);
        if (index < 0) return 0;
        count -= 1;
      }
      from = index + 1;
      return from;
    });
    fn('chr', (code) => (code === null ? null : String.fromCharCode(Number(code))));
    fn('ascii', (value) => (value === null || value === '' ? null : String(value).charCodeAt(0)));
    fn('bitand', (left, right) => (left === null || right === null ? null : Number(left) & Number(right)));
    fn('translate', (value, from, to) => {
      if (value === null || from === null) return null;
      const source = String(from);
      const target = String(to ?? '');
      return [...String(value)]
        .map((char) => {
          const index = source.indexOf(char);
          return index < 0 ? char : (target[index] ?? '');
        })
        .join('');
    });
    fn('regexp_substr', (value, pattern, position, occurrence, flags, group) => {
      if (value === null || pattern === null) return null;
      const regex = new RegExp(String(pattern), `g${String(flags ?? '').includes('i') ? 'i' : ''}u`);
      const matches = [
        ...String(value)
          .slice(Number(position ?? 1) - 1)
          .matchAll(regex),
      ];
      const match = matches[Number(occurrence ?? 1) - 1];
      return match ? (match[Number(group ?? 0)] ?? null) : null;
    });
    fn('regexp_instr', (value, pattern, position, occurrence) => {
      if (value === null || pattern === null) return null;
      const offset = Number(position ?? 1) - 1;
      const matches = [
        ...String(value)
          .slice(offset)
          .matchAll(new RegExp(String(pattern), 'gu')),
      ];
      const match = matches[Number(occurrence ?? 1) - 1];
      return match ? match.index + offset + 1 : 0;
    });
    fn('regexp_count', (value, pattern, position, flags) =>
      value === null || pattern === null
        ? null
        : [
            ...String(value)
              .slice(Number(position ?? 1) - 1)
              .matchAll(new RegExp(String(pattern), `g${String(flags ?? '').includes('i') ? 'i' : ''}u`)),
          ].length,
    );
    fn('last_day', (value) => {
      const date = oracleDate(value);
      return date ? isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0), false) : null;
    });
    fn('next_day', (value, day) => {
      const date = oracleDate(value);
      if (!date) return null;
      const target = DAY_NAMES.findIndex(
        (name) => name.slice(0, 3).toUpperCase() === String(day).slice(0, 3).toUpperCase(),
      );
      const result = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      while (target >= 0 && result.getDay() !== target) result.setDate(result.getDate() + 1);
      return isoDate(result, false);
    });
    fn('to_clob', (value) => value ?? null);
    fn('from_tz', (value) => value ?? null);
    fn('to_nchar', (value) => (value === null || value === undefined ? null : String(value)));
    fn('empty_clob', () => null);
    fn('empty_blob', () => new Uint8Array());
    fn('to_blob', (value) => (typeof value === 'string' ? (this.blob(value) ?? value) : (value ?? null)));
    fn('apex_local_num', (value) => {
      if (typeof value !== 'string') return value ?? null;
      const trimmed = value.trim();
      return trimmed !== '' && Number.isFinite(Number(trimmed)) ? Number(trimmed) : value;
    });
    fn('apex_local_extract', (unit, value) => {
      const date = oracleDate(value);
      if (!date) return null;
      switch (String(unit).toLowerCase()) {
        case 'year':
          return date.getFullYear();
        case 'month':
          return date.getMonth() + 1;
        case 'day':
          return date.getDate();
        case 'hour':
          return date.getHours();
        case 'minute':
          return date.getMinutes();
        default:
          return date.getSeconds();
      }
    });
    fn('apex_local_nextval', (name) => this.#nextval(String(name)));
    fn('apex_local_currval', (name) => this.#sequences.get(String(name))?.value ?? null);
    fn('sys_guid', () => crypto.randomUUID().replaceAll('-', '').toUpperCase());
  }

  /** Package functions registered after this database was opened. */
  #syncFunctions(): void {
    if (this.#functions.size === oracleFunctions.size) return;
    for (const [name, fn] of oracleFunctions) {
      if (this.#functions.has(name)) continue;
      this.#functions.add(name);
      this.db.function(fn.sqlName, { varargs: true, deterministic: false }, (...args) => {
        if (!fn.blobs) return fn.impl(args.map((arg) => this.#sqlValue(arg) as SqlValue)) as SQLInputValue;
        const values = args.map((arg) =>
          typeof arg === 'bigint' ? Number(arg) : (this.blob(arg) ?? (arg as BlobSqlValue) ?? null),
        );
        return fn.impl(values) as SQLInputValue;
      });
    }
  }

  #loadSequences(): void {
    this.db.exec(
      'create table if not exists apex_local_sequences (name text primary key, value integer, increment integer, start integer)',
    );
    for (const row of this.db
      .prepare('select name, value, increment, start from apex_local_sequences')
      .all() as {
      name: string;
      value: number | null;
      increment: number;
      start: number;
    }[])
      if (!this.#dirtySequences.has(row.name))
        this.#sequences.set(row.name, { value: row.value, increment: row.increment, start: row.start });
  }

  #nextval(name: string): number {
    const sequence = this.#sequences.get(name) ?? { value: null, increment: 1, start: 1 };
    sequence.value = sequence.value === null ? sequence.start : sequence.value + sequence.increment;
    this.#sequences.set(name, sequence);
    this.#dirtySequences.add(name);
    return sequence.value;
  }

  #flushSequences(): void {
    if (!this.#dirtySequences.size) return;
    const upsert = this.db.prepare(
      'insert into apex_local_sequences (name, value, increment, start) values (?, ?, ?, ?) on conflict(name) do update set value = excluded.value',
    );
    for (const name of this.#dirtySequences) {
      const sequence = this.#sequences.get(name)!;
      upsert.run(name, sequence.value, sequence.increment, sequence.start);
    }
    this.#dirtySequences.clear();
  }

  /** `create sequence` / `drop sequence` DDL, kept in a bookkeeping table. */
  #sequenceDdl(sql: string): boolean {
    const create =
      /^\s*create\s+(?:or\s+replace\s+)?sequence\s+(?:[\w$#"]+\.)?"?([\w$#]+)"?([\s\S]*)$/iu.exec(sql);
    const drop = /^\s*drop\s+sequence\s+(?:[\w$#"]+\.)?"?([\w$#]+)"?/iu.exec(sql);
    if (!create && !drop) return false;
    this.#loadSequences();
    const name = (create ?? drop)![1]!.toUpperCase();
    if (drop) {
      this.#sequences.delete(name);
      this.db.prepare('delete from apex_local_sequences where name = ?').run(name);
      return true;
    }
    const options = create![2] ?? '';
    const start = Number(/\bstart\s+with\s+(-?\d+)/iu.exec(options)?.[1] ?? 1);
    const increment = Number(/\bincrement\s+by\s+(-?\d+)/iu.exec(options)?.[1] ?? 1);
    this.#sequences.set(name, { value: null, increment, start });
    this.#dirtySequences.add(name);
    this.#flushSequences();
    return true;
  }

  #prepare(sql: string, binds: Binds) {
    this.#binds = Object.fromEntries(Object.entries(binds).map(([key, value]) => [key.toUpperCase(), value]));
    this.#syncFunctions();
    const translated = translateOracleSql(sql);
    if (/\bapex_local_(?:nextval|currval)\(/u.test(translated)) this.#loadSequences();
    const values: Record<string, SQLInputValue> = {};
    for (const name of bindNames(translated)) {
      const value = this.#binds[name.toUpperCase()] ?? null;
      // node:sqlite binds JS numbers as REAL; keep integers INTEGER so `1 || ''` is '1', not '1.0'
      values[name] =
        typeof value === 'number' && Number.isSafeInteger(value)
          ? BigInt(value)
          : (this.blob(value) ?? value);
    }
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
      for (const [key, value] of Object.entries(raw))
        row[key.toUpperCase()] = this.#sqlValue(value) as string | number | null;
      rows.push(row);
      if (rows.length >= maxRows) break;
    }
    this.#flushSequences();
    return { columns, rows };
  }

  /** Like query, with BLOB columns as bytes and columns in select order. */
  rawQuery(
    sql: string,
    binds: Binds = {},
    maxRows = 10_000,
  ): { columns: string[]; rows: (SqlValue | Uint8Array)[][] } {
    const { statement, values } = this.#prepare(sql, binds);
    statement.setReturnArrays(true);
    const columns = statement.columns().map((column) => column.name.toUpperCase());
    const rows: (SqlValue | Uint8Array)[][] = [];
    for (const raw of statement.iterate(values) as Iterable<SQLInputValue[]>) {
      rows.push(
        raw.map((value) => (typeof value === 'bigint' ? Number(value) : (value as SqlValue | Uint8Array))),
      );
      if (rows.length >= maxRows) break;
    }
    this.#flushSequences();
    return { columns, rows };
  }

  execute(sql: string, binds: Binds = {}): { changes: number; lastInsertRowid: number } {
    if (this.#sequenceDdl(sql)) return { changes: 0, lastInsertRowid: 0 };
    if (/^\s*merge\s+into\b/iu.test(sql)) {
      const statements = translateMerge(sql);
      if (!statements) throw new Error('MERGE statement form is not supported locally');
      let changes = 0;
      let lastInsertRowid = 0;
      for (const statement of statements) {
        const result = this.execute(statement, binds);
        changes += result.changes;
        lastInsertRowid = result.lastInsertRowid || lastInsertRowid;
      }
      return { changes, lastInsertRowid };
    }
    const { statement, values } = this.#prepare(sql, binds);
    const result = statement.run(values);
    this.#flushSequences();
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
