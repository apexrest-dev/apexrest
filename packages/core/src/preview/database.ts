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

/**
 * Oracle's default NUMBER → VARCHAR2 conversion (TO_CHAR without a mask, `||`, implicit
 * conversion): no trailing zeros or ".0", no leading "0" before the decimal point (".5"), and
 * binary floating-point noise rounded away at 15 significant digits (0.15 * 100 is "15").
 */
export function oracleNumberText(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? '~' : '-~';
  if (Number.isInteger(value)) return Math.abs(value) < 1e21 ? String(value || 0) : BigInt(value).toString();
  const rounded = Number(value.toPrecision(15));
  if (Number.isInteger(rounded)) return String(rounded || 0);
  let text = String(rounded);
  if (/e/iu.test(text)) {
    const exponent = Number(text.split(/e/iu)[1]);
    text = rounded.toFixed(Math.min(100, Math.max(0, 15 - exponent))).replace(/\.?0+$/u, '');
  }
  return text.replace(/^(-?)0\./u, '$1.');
}

/** Text of a SQL value as Oracle converts it implicitly; null stays null. */
export function oracleText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return oracleNumberText(value);
  if (typeof value === 'bigint') return value.toString();
  return String(value);
}

/** A REAL from SQLite as the decimal NUMBER Oracle would hold (0.1 + 0.2 is 0.3). */
export function decimalNumber(value: number): number {
  return Number.isFinite(value) && !Number.isInteger(value) ? Number(value.toPrecision(15)) : value;
}

const DATE_TEXT = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/u;

function arithmeticNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const number = Number(value.trim());
  return Number.isFinite(number) ? number : undefined;
}

function arithmeticDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || arithmeticNumber(value) !== undefined) return undefined;
  const text = value.trim();
  return DATE_TEXT.test(text) || /^\d{1,2}-[A-Za-z]{3}-\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/u.test(text)
    ? oracleDate(text)
    : undefined;
}

const sqlNumber = (value: number) => (Number.isSafeInteger(value) ? BigInt(value) : decimalNumber(value));

/**
 * Oracle `+`/`-` with run-time typing: date ± days (fractions are hours/minutes), date - date in
 * days, and plain arithmetic otherwise. Dates are the stored `YYYY-MM-DD[ HH24:MI:SS]` text; a
 * result keeps the time part when the input had one or the result is not midnight.
 */
export function sqlArithmetic(
  left: unknown,
  operator: string,
  right: unknown,
): string | number | bigint | null {
  if (left === null || left === undefined || right === null || right === undefined) return null;
  const leftDate = arithmeticDate(left);
  const rightDate = arithmeticDate(right);
  if (leftDate && rightDate && operator === '-') {
    const utc = (date: Date) =>
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
      );
    return sqlNumber((utc(leftDate) - utc(rightDate)) / 86_400_000);
  }
  const date = leftDate ?? (operator === '+' ? rightDate : undefined);
  if (date) {
    const days = arithmeticNumber(leftDate ? right : left);
    if (days === undefined) return null;
    const signed = operator === '-' ? -days : days;
    const whole = Math.trunc(signed);
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate() + whole);
    result.setHours(date.getHours(), date.getMinutes(), date.getSeconds());
    result.setTime(result.getTime() + Math.round((signed - whole) * 86_400) * 1000);
    const source = String(leftDate ? left : right);
    const timed = /\d:\d/u.test(source) || result.getHours() || result.getMinutes() || result.getSeconds();
    return isoDate(result, Boolean(timed));
  }
  const a = arithmeticNumber(left);
  const b = arithmeticNumber(right);
  if (a === undefined || b === undefined) return null;
  return sqlNumber(operator === '-' ? a - b : a + b);
}

// ---------------------------------------------------------------- SQL/JSON

type JsonStep =
  | { kind: 'field'; name: string }
  | { kind: 'any' }
  | { kind: 'index'; indexes: (number | 'last' | [number | 'last', number | 'last'])[] }
  | { kind: 'all' };

function parseJsonPath(path: string): JsonStep[] | undefined {
  const text = path.trim().replace(/^(?:lax|strict)\s+/iu, '');
  if (!text.startsWith('$')) return undefined;
  const steps: JsonStep[] = [];
  let index = 1;
  while (index < text.length) {
    const rest = text.slice(index);
    let match: RegExpExecArray | null;
    if ((match = /^\.\*/u.exec(rest))) steps.push({ kind: 'any' });
    else if ((match = /^\.([A-Za-z_$][\w$]*)/u.exec(rest))) steps.push({ kind: 'field', name: match[1]! });
    else if ((match = /^\."((?:[^"\\]|\\.)*)"/u.exec(rest)))
      steps.push({ kind: 'field', name: match[1]!.replace(/\\(.)/gu, '$1') });
    else if ((match = /^\[\s*\*\s*\]/u.exec(rest))) steps.push({ kind: 'all' });
    else if ((match = /^\[([^\]]*)\]/u.exec(rest))) {
      const position = (part: string) => (part.trim().toLowerCase() === 'last' ? 'last' : Number(part));
      const indexes = match[1]!.split(',').map((part) => {
        const range = /^(.+?)\s+to\s+(.+)$/iu.exec(part.trim());
        return range
          ? ([position(range[1]!), position(range[2]!)] as [number | 'last', number | 'last'])
          : position(part);
      });
      if (indexes.some((entry) => typeof entry === 'number' && !Number.isInteger(entry))) return undefined;
      steps.push({ kind: 'index', indexes });
    } else return undefined;
    index += match[0].length;
  }
  return steps;
}

/** Matches of an Oracle JSON path in lax mode; undefined when the document or path is invalid. */
function jsonMatches(doc: unknown, pathText: unknown): unknown[] | undefined {
  if (doc === null || doc === undefined || pathText === null || pathText === undefined) return undefined;
  const steps = parseJsonPath(String(pathText));
  if (!steps) return undefined;
  let data: unknown;
  try {
    data = typeof doc === 'string' ? JSON.parse(doc) : doc;
  } catch {
    return undefined;
  }
  let current: unknown[] = [data];
  for (const step of steps) {
    const next: unknown[] = [];
    for (const value of current) {
      if (step.kind === 'field' || step.kind === 'any') {
        // lax mode: a member step over an array applies to its elements
        for (const target of Array.isArray(value) ? value : [value]) {
          if (!target || typeof target !== 'object' || Array.isArray(target)) continue;
          if (step.kind === 'any') next.push(...Object.values(target));
          else if (Object.hasOwn(target, step.name))
            next.push((target as Record<string, unknown>)[step.name]);
        }
      } else {
        const array = Array.isArray(value) ? value : [value];
        if (step.kind === 'all') {
          next.push(...array);
          continue;
        }
        const resolve = (entry: number | 'last') => (entry === 'last' ? array.length - 1 : entry);
        for (const entry of step.indexes) {
          if (Array.isArray(entry)) {
            for (let cursor = resolve(entry[0]); cursor <= resolve(entry[1]); cursor += 1)
              if (cursor >= 0 && cursor < array.length) next.push(array[cursor]);
          } else {
            const at = resolve(entry);
            if (at >= 0 && at < array.length) next.push(array[at]);
          }
        }
      }
    }
    current = next;
  }
  return current;
}

function jsonValue(doc: unknown, pathText: unknown, returning: unknown): string | number | null {
  const matches = jsonMatches(doc, pathText);
  if (!matches || matches.length !== 1) return null;
  const value = matches[0];
  if (value === null || typeof value === 'object') return null;
  if (
    returning === 'number' ||
    returning === 'integer' ||
    returning === 'float' ||
    returning === 'binary_double'
  ) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  if (typeof value === 'number') return oracleNumberText(value);
  return String(value);
}

function jsonQuery(doc: unknown, pathText: unknown, wrapper: boolean): string | null {
  const matches = jsonMatches(doc, pathText);
  if (!matches?.length) return null;
  if (wrapper) return JSON.stringify(matches);
  if (matches.length !== 1 || matches[0] === null || typeof matches[0] !== 'object') return null;
  return JSON.stringify(matches[0]);
}

const POSIX_CLASSES: Record<string, string> = {
  alpha: 'a-zA-Z',
  digit: '0-9',
  alnum: 'a-zA-Z0-9',
  upper: 'A-Z',
  lower: 'a-z',
  space: '\\s',
  blank: ' \\t',
  punct: '!"#$%&\'()*+,\\-./:;<=>?@\\[\\\\\\]\\^_`{|}~',
  xdigit: '0-9A-Fa-f',
  cntrl: '\\x00-\\x1f\\x7f',
  print: '\\x20-\\x7e',
  graph: '\\x21-\\x7e',
  word: '\\w',
};

/**
 * An Oracle (POSIX ERE + Perl extensions) regular expression as a JavaScript RegExp: bracket
 * classes such as `[[:space:]]` and the match parameter (`i`, `c`, `n`, `m`, `x`; the last of
 * `i`/`c` wins) are translated. Patterns JavaScript's Unicode mode rejects are retried without it.
 */
export function oracleRegExp(pattern: string, matchParameter = '', global = false): RegExp {
  let ignoreCase = false;
  let dotAll = false;
  let multiline = false;
  let extended = false;
  for (const flag of matchParameter) {
    if (flag === 'i') ignoreCase = true;
    else if (flag === 'c') ignoreCase = false;
    else if (flag === 'n') dotAll = true;
    else if (flag === 'm') multiline = true;
    else if (flag === 'x') extended = true;
  }
  let source = '';
  let inClass = false;
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]!;
    if (char === '\\') {
      source += pattern.slice(index, index + 2);
      index += 1;
      continue;
    }
    if (inClass) {
      const posix = /^\[:([a-z]+):\]/u.exec(pattern.slice(index));
      if (posix && POSIX_CLASSES[posix[1]!] !== undefined) {
        source += POSIX_CLASSES[posix[1]!];
        index += posix[0].length - 1;
        continue;
      }
      const equivalence = /^\[[=.](.)[=.]\]/u.exec(pattern.slice(index));
      if (equivalence) {
        source += equivalence[1]!.replace(/[\\\]^-]/u, '\\$&');
        index += equivalence[0].length - 1;
        continue;
      }
      if (char === ']') inClass = false;
      else if (char === '[') {
        source += '\\[';
        continue;
      }
      source += char;
      continue;
    }
    if (char === '[') {
      inClass = true;
      source += char;
      if (pattern[index + 1] === '^') {
        source += '^';
        index += 1;
      }
      // a leading `]` is a literal in POSIX brackets
      if (pattern[index + 1] === ']') {
        source += '\\]';
        index += 1;
      }
      continue;
    }
    if (extended && /\s/u.test(char)) continue;
    source += char;
  }
  const flags = `${global ? 'g' : ''}${ignoreCase ? 'i' : ''}${dotAll ? 's' : ''}${multiline ? 'm' : ''}`;
  try {
    return new RegExp(source, `${flags}u`);
  } catch {
    return new RegExp(source, flags);
  }
}

/** Oracle TO_CHAR for datetime and number masks. */
export function formatOracle(value: unknown, mask: string | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!mask) return oracleText(value);
  const upper = mask.trim().toUpperCase();
  if (upper === 'TM' || upper === 'TM9' || upper === 'TME')
    return value === '' ? null : oracleNumberText(Number(value));
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

/**
 * A date item value in the canonical stored form (`YYYY-MM-DD HH24:MI:SS`): display text is
 * parsed with the item's format mask; values that are not dates are returned unchanged.
 */
export function canonicalDate(value: string, mask?: string): string {
  const text = value.trim();
  if (text === '') return value;
  const date = DATE_TEXT.test(text) ? oracleDate(text) : parseOracleDate(text, mask);
  return date ? isoDate(date) : value;
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

// ---------------------------------------------------------------- expression-level rewrites

interface SqlToken {
  pre: string;
  text: string;
  kind: 'word' | 'number' | 'literal' | 'bind' | 'op' | 'atom';
}

const SQL_TOKEN =
  /(\s*)(\u0000\d+\u0000|"[^"]*"|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|:[A-Za-z_][\w$#]*|:\d+|[A-Za-z_][\w$#]*|\|\||<=|>=|<>|!=|\^=|~=|->>|->|=>|:=|[\s\S])/uy;

function tokenizeSql(text: string): { tokens: SqlToken[]; tail: string } {
  const tokens: SqlToken[] = [];
  SQL_TOKEN.lastIndex = 0;
  let position = 0;
  for (let match = SQL_TOKEN.exec(text); match && match[2]; match = SQL_TOKEN.exec(text)) {
    const value = match[2];
    const kind: SqlToken['kind'] = value.startsWith('\u0000')
      ? 'literal'
      : /^[\d.]/u.test(value) && value !== '.'
        ? 'number'
        : /^:[\w]/u.test(value)
          ? 'bind'
          : /^[A-Za-z_"]/u.test(value)
            ? 'word'
            : 'op';
    tokens.push({ pre: match[1]!, text: value, kind });
    position = SQL_TOKEN.lastIndex;
  }
  return { tokens, tail: text.slice(position) };
}

const renderTokens = (tokens: SqlToken[]) =>
  tokens.map((token, index) => (index === 0 ? '' : token.pre) + token.text).join('');

/** Words that never start or end an operand. */
const SQL_KEYWORDS = new Set(
  (
    'select from where and or not when then else end as on by group order having union all intersect ' +
    'minus except in is like between escape asc desc nulls limit offset join left right inner outer ' +
    'cross natural into values set distinct exists over within partition using with recursive ' +
    'returning default collate glob regexp isnull notnull prior connect ' +
    'interval return'
  ).split(' '),
);

const isOpToken = (token: SqlToken | undefined, ...values: string[]) =>
  token?.kind === 'op' && values.includes(token.text);
const isWordToken = (token: SqlToken | undefined, ...values: string[]) =>
  token?.kind === 'word' && values.includes(token.text.toLowerCase());

function matchForward(tokens: SqlToken[], open: number): number {
  let depth = 0;
  for (let index = open; index < tokens.length; index += 1) {
    if (isOpToken(tokens[index], '(')) depth += 1;
    else if (isOpToken(tokens[index], ')')) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function matchBackward(tokens: SqlToken[], close: number): number {
  let depth = 0;
  for (let index = close; index >= 0; index -= 1) {
    if (isOpToken(tokens[index], ')')) depth += 1;
    else if (isOpToken(tokens[index], '(')) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** `over (...)`, `within group (...)`, `keep (...)`, `filter (...)` after an aggregate call. */
function callSuffix(tokens: SqlToken[], end: number): number {
  for (;;) {
    const next = tokens[end + 1];
    if (isWordToken(next, 'over', 'keep', 'filter') && isOpToken(tokens[end + 2], '(')) {
      const close = matchForward(tokens, end + 2);
      if (close < 0) return end;
      end = close;
    } else if (
      isWordToken(next, 'within') &&
      isWordToken(tokens[end + 2], 'group') &&
      isOpToken(tokens[end + 3], '(')
    ) {
      const close = matchForward(tokens, end + 3);
      if (close < 0) return end;
      end = close;
    } else return end;
  }
}

/** Last token index of the operand starting at `index`, or -1. */
function operandEnd(tokens: SqlToken[], index: number): number {
  const token = tokens[index];
  if (!token) return -1;
  if (isOpToken(token, '+', '-')) return operandEnd(tokens, index + 1);
  if (isOpToken(token, '(')) {
    const close = matchForward(tokens, index);
    return close < 0 ? -1 : close;
  }
  if (token.kind === 'word') {
    const lower = token.text.toLowerCase();
    if (lower === 'case') {
      let depth = 0;
      for (let cursor = index; cursor < tokens.length; cursor += 1) {
        if (isWordToken(tokens[cursor], 'case')) depth += 1;
        else if (isWordToken(tokens[cursor], 'end')) {
          depth -= 1;
          if (depth === 0) return cursor;
        }
      }
      return -1;
    }
    if (SQL_KEYWORDS.has(lower)) return -1;
    let end = index;
    while (isOpToken(tokens[end + 1], '.') && tokens[end + 2]?.kind === 'word') end += 2;
    if (isOpToken(tokens[end + 1], '(')) {
      const close = matchForward(tokens, end + 1);
      if (close < 0) return -1;
      end = callSuffix(tokens, close);
    }
    return end;
  }
  return token.kind === 'op' ? -1 : index;
}

/** First token index of the operand ending at `index`, or -1. */
function operandStart(tokens: SqlToken[], index: number): number {
  const token = tokens[index];
  if (!token) return -1;
  if (isOpToken(token, ')')) {
    let open = matchBackward(tokens, index);
    if (open < 0) return -1;
    if (isWordToken(tokens[open - 1], 'over', 'keep', 'filter')) return operandStart(tokens, open - 2);
    if (isWordToken(tokens[open - 1], 'group') && isWordToken(tokens[open - 2], 'within'))
      return operandStart(tokens, open - 3);
    const name = tokens[open - 1];
    if (name?.kind === 'word' && !SQL_KEYWORDS.has(name.text.toLowerCase())) {
      open -= 1;
      while (isOpToken(tokens[open - 1], '.') && tokens[open - 2]?.kind === 'word') open -= 2;
    }
    return open;
  }
  if (isWordToken(token, 'end')) {
    let depth = 0;
    for (let cursor = index; cursor >= 0; cursor -= 1) {
      if (isWordToken(tokens[cursor], 'end')) depth += 1;
      else if (isWordToken(tokens[cursor], 'case')) {
        depth -= 1;
        if (depth === 0) return cursor;
      }
    }
    return -1;
  }
  if (token.kind === 'word') {
    if (SQL_KEYWORDS.has(token.text.toLowerCase())) return -1;
    let start = index;
    while (isOpToken(tokens[start - 1], '.') && tokens[start - 2]?.kind === 'word') start -= 2;
    return start;
  }
  return token.kind === 'op' ? -1 : index;
}

/** Whether the operator at `index` is binary (it follows a complete operand). */
function isBinaryAt(tokens: SqlToken[], index: number): boolean {
  const previous = tokens[index - 1];
  if (!previous) return false;
  if (isOpToken(previous, ')')) return true;
  if (previous.kind === 'word')
    return isWordToken(previous, 'end') || !SQL_KEYWORDS.has(previous.text.toLowerCase());
  return previous.kind !== 'op';
}

/** Start of the left operand of a `+ - ||` level operator: every earlier term at that level. */
function leftOperand(tokens: SqlToken[], operator: number): number {
  let start = operandStart(tokens, operator - 1);
  while (start > 0) {
    const previous = start - 1;
    if (isOpToken(tokens[previous], '*', '/', '%', '+', '-') && isBinaryAt(tokens, previous)) {
      const earlier = operandStart(tokens, previous - 1);
      if (earlier < 0) break;
      start = earlier;
    } else if (isOpToken(tokens[previous], '+', '-')) {
      start = previous;
      break;
    } else break;
  }
  return start;
}

/** End of the right operand of a `+ - ||` level operator: one multiplicative term. */
function rightOperand(tokens: SqlToken[], operator: number): number {
  let end = operandEnd(tokens, operator + 1);
  while (end >= 0 && isOpToken(tokens[end + 1], '*', '/', '%')) {
    const later = operandEnd(tokens, end + 2);
    if (later < 0) break;
    end = later;
  }
  return end;
}

/** `a || b || c` → `concat(a, b, c)`: Oracle precedence (same as `+ -`), NULL as '', numbers as text. */
function rewriteConcatTokens(tokens: SqlToken[]): SqlToken[] {
  const out = [...tokens];
  for (let index = 0; index < out.length; index += 1) {
    if (!isOpToken(out[index], '||')) continue;
    const start = leftOperand(out, index);
    if (start < 0) continue;
    const operands = [renderTokens(out.slice(start, index))];
    let cursor = index;
    let end = index;
    while (isOpToken(out[cursor], '||')) {
      const last = rightOperand(out, cursor);
      if (last < 0) break;
      operands.push(renderTokens(rewriteConcatTokens(out.slice(cursor + 1, last + 1))));
      end = last;
      cursor = last + 1;
    }
    if (end === index) continue;
    out.splice(start, end - start + 1, {
      pre: out[start]!.pre,
      text: `concat(${operands.join(', ')})`,
      kind: 'atom',
    });
    index = start;
  }
  return out;
}

/** Calls whose result may be a date: `+`/`-` on them is date arithmetic in Oracle. */
const DATE_CAPABLE_CALLS = new Set([
  'trunc',
  'round',
  'to_date',
  'to_timestamp',
  'last_day',
  'next_day',
  'add_months',
  'datetime',
  'date',
  'nvl',
  'coalesce',
  'greatest',
  'least',
  'max',
  'min',
  'decode',
  'nullif',
  'new_time',
  'from_tz',
  'cast',
  'apex_local_arith',
]);

function dateCapable(tokens: SqlToken[]): boolean {
  if (!tokens.length || operandEnd(tokens, 0) !== tokens.length - 1) return false;
  const first = tokens[0]!;
  if (first.kind === 'bind') return true;
  if (first.kind === 'atom') return /^apex_local_arith\(/u.test(first.text);
  if (isOpToken(first, '(')) return dateCapable(tokens.slice(1, -1));
  if (first.kind !== 'word' || isWordToken(first, 'case', 'null')) return false;
  const open = tokens.findIndex((token) => isOpToken(token, '('));
  if (open < 0) return !isWordToken(tokens.at(-1), 'level', 'rownum');
  return DATE_CAPABLE_CALLS.has(tokens[open - 1]!.text.toLowerCase());
}

/**
 * `date ± number` and `date - date` for any operand that may be a date (columns, binds,
 * trunc/to_date/... calls): the operation goes through `apex_local_arith`, which does day
 * arithmetic on dates and plain arithmetic on numbers at run time.
 */
function rewriteDateArithmeticTokens(tokens: SqlToken[]): SqlToken[] {
  const out = [...tokens];
  for (let index = 1; index < out.length; index += 1) {
    if (!isOpToken(out[index], '+', '-') || !isBinaryAt(out, index)) continue;
    const start = leftOperand(out, index);
    if (start < 0 || !dateCapable(out.slice(start, index))) continue;
    const end = rightOperand(out, index);
    if (end < 0) continue;
    const right = renderTokens(rewriteDateArithmeticTokens(out.slice(index + 1, end + 1)));
    out.splice(start, end - start + 1, {
      pre: out[start]!.pre,
      text: `apex_local_arith(${renderTokens(out.slice(start, index))}, '${out[index]!.text}', ${right})`,
      kind: 'atom',
    });
    index = start;
  }
  return out;
}

function rewriteExpressions(text: string, rewrite: (tokens: SqlToken[]) => SqlToken[]): string {
  const { tokens, tail } = tokenizeSql(text);
  if (!tokens.length) return text;
  const lead = tokens[0]!.pre;
  return lead + renderTokens(rewrite(tokens)) + tail;
}

/** `listagg(expr, sep) within group (order by ...)` → `group_concat(expr, sep order by ...)`. */
function rewriteListagg(text: string): string {
  const pattern = /\blistagg\s*\(/giu;
  let out = '';
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const open = match.index + match[0].length - 1;
    const close = closingParen(text, open);
    if (close < 0) continue;
    const within = /^\s*within\s+group\s*\(/iu.exec(text.slice(close + 1));
    const orderOpen = within ? close + within[0].length : -1;
    const orderClose = within ? closingParen(text, orderOpen) : -1;
    let inner = rewriteListagg(text.slice(open + 1, close))
      .replace(/\s+on\s+overflow\s+\w+(?:\s+\u0000\d+\u0000)?(?:\s+(?:with|without)\s+count)?\s*$/iu, '')
      .trim();
    const distinct = /^distinct\s+/iu.exec(inner);
    if (distinct) inner = inner.slice(distinct[0].length);
    const [value = 'null', separator] = topLevelCommas(inner).map((part) => part.trim());
    const order = orderClose > 0 ? text.slice(orderOpen + 1, orderClose).trim() : '';
    const measure = `apex_local_text(${value})`;
    out += text.slice(last, match.index);
    out += distinct
      ? `group_concat(distinct ${measure})`
      : `group_concat(${measure}, ${separator || "''"}${order ? ` ${order}` : ''})`;
    last = orderClose > 0 ? orderClose + 1 : close + 1;
    pattern.lastIndex = last;
  }
  return out + text.slice(last);
}

/** `json_value(doc, '$.a' returning number null on error)` → the local UDF's positional form. */
function rewriteJsonFunctions(text: string): string {
  const pattern = /\bjson_(value|query|exists)\s*\(/giu;
  let out = '';
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const open = match.index + match[0].length - 1;
    const close = closingParen(text, open);
    if (close < 0) continue;
    const args = topLevelCommas(rewriteJsonFunctions(text.slice(open + 1, close)));
    if (args.length < 2) continue;
    const doc = args[0]!.replace(/\s+format\s+json\s*$/iu, '').trim();
    const rest = args.slice(1).join(',').trim();
    const path = /^(\u0000\d+\u0000|:\w+)/u.exec(rest)?.[1];
    if (!path) continue;
    const clauses = rest.slice(path.length);
    const kind = match[1]!.toLowerCase();
    const option =
      kind === 'value'
        ? (/\breturning\s+(number|integer|float|binary_double|date|timestamp)/iu
            .exec(clauses)?.[1]
            ?.toLowerCase() ?? '')
        : kind === 'query' && /\bwith\s+(?:(?:un)?conditional\s+)?(?:array\s+)?wrapper\b/iu.test(clauses)
          ? 'wrapper'
          : '';
    out += `${text.slice(last, match.index)}json_${kind}(${doc}, ${path}${option ? `, '${option}'` : ''})`;
    last = close + 1;
    pattern.lastIndex = last;
  }
  return out + text.slice(last);
}

/** Left in local DDL where Oracle declares an identity column. */
export const IDENTITY_MARKER = '/*apex_local_identity*/';

/** DDL keeps plain expressions: SQLite rejects application functions in CHECK constraints and indexes. */
const PLAIN_DDL = /^\s*(?:create|alter)\s+(?:global\s+temporary\s+)?(?:table|(?:unique\s+)?index)\b/iu;

/** Rewrites the most common Oracle-only syntax into SQLite. Function differences are covered by UDFs. */
export function translateOracleSql(sql: string): string {
  const trimmed = sql
    .trim()
    .replace(/;\s*\/?\s*$/u, '')
    .replace(/\n\/\s*$/u, '');
  const masked = maskLiterals(trimmed);
  const literal = (value: string) => {
    masked.literals.push(value);
    return `\u0000${masked.literals.length - 1}\u0000`;
  };
  const uncommented = masked.text.replace(/--[^\n]*|\/\*[\s\S]*?\*\//gu, ' ');
  const ddl = PLAIN_DDL.test(uncommented) && !/\bas\s*\(?\s*select\b/iu.test(uncommented);
  let text = uncommented
    .replace(/\bfrom\s+dual\b/giu, '')
    // DEFAULT expressions must be parenthesized in SQLite; DEFAULT ON NULL is a plain default.
    .replace(/\bdefault\s+on\s+null\b/giu, 'default')
    .replace(
      /\bdefault\s+(?:sys(?:date|timestamp)|current_(?:date|timestamp)|localtimestamp)\b/giu,
      "default (datetime('now','localtime'))",
    )
    .replace(/\bdefault\s+(?:date|timestamp)\s+(\u0000\d+\u0000)/giu, 'default $1')
    .replace(/\bdefault\s+(sys_guid\s*\(\s*\))/giu, 'default ($1)')
    // ANSI datetime literals
    .replace(/\bdate\s+(\u0000\d+\u0000)/giu, 'to_date($1)')
    .replace(/\btimestamp\s+(\u0000\d+\u0000)/giu, 'to_timestamp($1)')
    .replace(
      /\bsys(?:date|timestamp)\s*([+-])\s*(\d+(?:\.\d+)?)\b(?!\s*[/*])/giu,
      (_whole, sign: string, days: string) =>
        `datetime('now','localtime',${literal(`'${sign}${days} days'`)})`,
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
    .replace(/\bdefault\s+(apex_local_(?:nextval|currval)\('[\w$#]+'\))/giu, 'default ($1)')
    // Oracle identity/sequence DDL; the marker tells form processing the key is generated.
    .replace(
      /\bgenerated\s+(?:always|by\s+default(?:\s+on\s+null)?)\s+as\s+identity(?:\s*\([^)]*\))?/giu,
      IDENTITY_MARKER,
    )
    // an inline identity primary key becomes SQLite's auto-numbered INTEGER PRIMARY KEY
    .replace(
      /\b(?:number|integer|int)(?:\s*\(\s*\d+\s*\))?(\s+\/\*apex_local_identity\*\/(?:\s+not\s+null)?\s+(?:constraint\s+[\w$#"]+\s+)?primary\s+key)\b/giu,
      'integer$1',
    )
    .replace(/\bvarchar2\s*\((\d+)\s*(?:char|byte)\)/giu, 'varchar2($1)')
    .replace(/\busing\s+index\b(?:\s+\w+)?/giu, '')
    .replace(/\benable\b|\bnovalidate\b/giu, '')
    // Oracle `/` is always real division; SQLite truncates integer operands.
    .replace(/(?<!\*\s*1\.0\s*|\*)\/(?!\*)/gu, '* 1.0 /');
  text = rewriteJsonFunctions(
    rewriteListagg(rewriteRownum(rewriteConnectBy(rewriteTableCollections(rewritePackageCalls(text))))),
  );
  if (!ddl)
    text = rewriteExpressions(rewriteExpressions(text, rewriteConcatTokens), rewriteDateArithmeticTokens);
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
    if (!current.trim() && /^(?:prompt|set|spool|whenever|exec|@|rem\b|--)/iu.test(trimmed)) continue;
    // a comment line never ends a statement, even when it ends with `;`
    if (!plsql && trimmed.startsWith('--')) {
      current += `${line}\n`;
      continue;
    }
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
    if (typeof value === 'number') return decimalNumber(value);
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
    // Oracle `||` / CONCAT: NULL is '', numbers convert as TO_CHAR does (15, not 15.0).
    fn('concat', (...args) => {
      if (args.every((arg) => arg === null || arg === undefined)) return null;
      return args.map((arg) => oracleText(arg) ?? '').join('');
    });
    fn('apex_local_text', (value) => oracleText(value));
    fn('apex_local_arith', (left, operator, right) => sqlArithmetic(left, String(operator), right));
    fn('json_value', (doc, pathText, returning) => jsonValue(doc, pathText, returning));
    fn('json_query', (doc, pathText, wrapper) => jsonQuery(doc, pathText, wrapper === 'wrapper'));
    fn('json_exists', (doc, pathText) => {
      const matches = jsonMatches(doc, pathText);
      return matches === undefined ? null : matches.length ? 1 : 0;
    });
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
    const flagText = (flags: SQLInputValue | undefined) => (typeof flags === 'string' ? flags : '');
    fn('regexp_like', (value, pattern, flags) =>
      value === null || pattern === null || value === undefined || pattern === undefined
        ? null
        : oracleRegExp(String(pattern), flagText(flags)).test(String(oracleText(value)))
          ? 1
          : 0,
    );
    fn('regexp_replace', (value, pattern, replacement, position, occurrence, flags) => {
      if (value === null) return null;
      const text = String(value);
      const offset = Number(position ?? 1) - 1;
      const nth = Number(occurrence ?? 0);
      const regex = oracleRegExp(String(pattern ?? ''), flagText(flags), true);
      const single = oracleRegExp(String(pattern ?? ''), flagText(flags));
      const replace = String(replacement ?? '').replace(/\\(\d)/gu, '$$$1');
      let count = 0;
      return (
        text.slice(0, offset) +
        text.slice(offset).replace(regex, (...match) => {
          count += 1;
          if (nth && count !== nth) return match[0] as string;
          return (match[0] as string).replace(single, replace);
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
    fn('v', (name) => {
      const value = this.#binds[String(name).toUpperCase()];
      return value === undefined || value === '' ? null : value;
    });
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
      const regex = oracleRegExp(String(pattern), flagText(flags), true);
      const matches = [
        ...String(value)
          .slice(Number(position ?? 1) - 1)
          .matchAll(regex),
      ];
      const match = matches[Number(occurrence ?? 1) - 1];
      return match ? (match[Number(group ?? 0)] ?? null) : null;
    });
    fn('regexp_instr', (value, pattern, position, occurrence, returnOption, flags) => {
      if (value === null || pattern === null) return null;
      const offset = Number(position ?? 1) - 1;
      const matches = [
        ...String(value)
          .slice(offset)
          .matchAll(oracleRegExp(String(pattern), flagText(flags), true)),
      ];
      const match = matches[Number(occurrence ?? 1) - 1];
      if (!match) return 0;
      return match.index + offset + 1 + (Number(returnOption ?? 0) ? match[0].length : 0);
    });
    fn('regexp_count', (value, pattern, position, flags) =>
      value === null || pattern === null
        ? null
        : [
            ...String(value)
              .slice(Number(position ?? 1) - 1)
              .matchAll(oracleRegExp(String(pattern), flagText(flags), true)),
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
  #sequenceDdl(statement: string): boolean {
    const sql = statement.replace(/^(?:\s+|--[^\n]*|\/\*[\s\S]*?\*\/)+/u, '');
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
      const bound = this.#binds[name.toUpperCase()] ?? null;
      // Oracle has no empty string: '' binds as NULL, so `:P1_X is null` holds for a cleared item.
      const value = bound === '' ? null : bound;
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
        raw.map((value) =>
          typeof value === 'bigint'
            ? Number(value)
            : typeof value === 'number'
              ? decimalNumber(value)
              : (value as SqlValue | Uint8Array),
        ),
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

  /**
   * How a missing primary key value is filled on insert: an identity column, a column default
   * (`default seq.nextval`), a `before insert` trigger from a seed script, or nothing.
   */
  keySource(table: string, column: string): 'identity' | 'default' | 'trigger' | 'none' {
    const name = table.replaceAll('"', '').toUpperCase();
    const ddl = (
      this.db.prepare("select sql from sqlite_master where type = 'table' and upper(name) = ?").get(name) as
        { sql?: string } | undefined
    )?.sql;
    const definition = ddl
      ? new RegExp(`[(,]\\s*"?${column.replace(/[^\w$#]/gu, '')}"?\\s[^,]*`, 'iu').exec(ddl)?.[0]
      : undefined;
    if (definition?.includes(IDENTITY_MARKER)) return 'identity';
    const info = (
      this.db.prepare(`pragma table_info("${name}")`).all() as { name: string; dflt_value: unknown }[]
    ).find((entry) => entry.name.toUpperCase() === column.toUpperCase());
    if (info && info.dflt_value !== null && info.dflt_value !== undefined) return 'default';
    if (this.tableExists('apex_local_insert_triggers')) {
      const trigger = this.db
        .prepare('select 1 from apex_local_insert_triggers where table_name = ?')
        .get(name.replace(/^.*\./u, ''));
      if (trigger) return 'trigger';
    }
    return 'none';
  }

  /** Runs a script statement by statement; failures are reported, not fatal. */
  runScript(script: string, source: string): string[] {
    const problems: string[] = [];
    // Triggers do not run locally; remember which tables Oracle fills on insert.
    const triggers = [
      ...script.matchAll(
        /\bcreate\s+(?:or\s+replace\s+)?(?:editionable\s+)?trigger\s+[\w$#."]+\s+before\s+insert\b[\s\S]*?\bon\s+(?:[\w$#"]+\.)?"?([\w$#]+)"?/giu,
      ),
    ].map((match) => match[1]!.toUpperCase());
    if (triggers.length) {
      this.db.exec('create table if not exists apex_local_insert_triggers (table_name text primary key)');
      const insert = this.db.prepare('insert or ignore into apex_local_insert_triggers values (?)');
      for (const table of triggers) insert.run(table);
    }
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
