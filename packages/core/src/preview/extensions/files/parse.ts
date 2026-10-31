import { createHash } from 'node:crypto';
import path from 'node:path';
import { isoDate } from '../../database.ts';
import { ZipReader } from '../../assets.ts';

/**
 * File parsers behind apex_data_parser and data loading: CSV/TSV, JSON, XML and XLSX (read from
 * the OOXML zip). Every parser yields a header list and rows of text cells.
 */

export type FileFormat = 'csv' | 'json' | 'xml' | 'xlsx';

export interface ParseOptions {
  format?: FileFormat | undefined;
  separator?: string | undefined;
  enclosedBy?: string | undefined;
  /** First line holds headers (CSV/XLSX); JSON/XML always name their columns. */
  headers?: boolean | undefined;
  skipRows?: number | undefined;
  sheet?: string | undefined;
  rowSelector?: string | undefined;
  encoding?: string | undefined;
  maxRows?: number | undefined;
}

export interface ParsedTable {
  format: FileFormat;
  /** Column names: headers of the first line, JSON keys or XML element names; COL001... otherwise. */
  columns: string[];
  rows: string[][];
  /** The first line when it holds headers (CSV/XLSX). */
  headerRow?: string[];
}

export function formatOf(filename: string | undefined, bytes?: Uint8Array): FileFormat {
  const extension = path.extname(filename ?? '').toLowerCase();
  if (extension === '.xlsx' || extension === '.xlsm') return 'xlsx';
  if (extension === '.json') return 'json';
  if (extension === '.xml') return 'xml';
  if (extension === '.csv' || extension === '.tsv' || extension === '.txt') return 'csv';
  if (bytes && bytes[0] === 0x50 && bytes[1] === 0x4b) return 'xlsx';
  const head = bytes ? Buffer.from(bytes.subarray(0, 64)).toString('utf8').trimStart() : '';
  if (head.startsWith('{') || head.startsWith('[')) return 'json';
  if (head.startsWith('<')) return 'xml';
  return 'csv';
}

export function decodeText(bytes: Uint8Array, encoding?: string): string {
  const label = (encoding ?? 'utf-8').toLowerCase().replace(/^al32utf8$/u, 'utf-8');
  let text: string;
  try {
    text = new TextDecoder(label, { fatal: label === 'utf-8' }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return text.replace(/^﻿/u, '');
}

// ---------------------------------------------------------------- CSV

function detectSeparator(text: string, enclosedBy: string): string {
  const sample = text.split(/\r?\n/u).slice(0, 10);
  let best = ',';
  let bestScore = -1;
  for (const candidate of [',', ';', '\t', '|']) {
    const counts = sample
      .filter((line) => line.trim())
      .map((line) => splitCsv(line, candidate, enclosedBy)[0]?.length ?? 0);
    if (!counts.length) continue;
    const consistent = counts.every((count) => count === counts[0]);
    const score = (counts[0] ?? 0) > 1 ? (counts[0] ?? 0) + (consistent ? 100 : 0) : 0;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export function splitCsv(text: string, separator: string, enclosedBy = '"'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let wasQuoted = false;
  const quote = enclosedBy || '\u0000';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === quote) {
        if (text[index + 1] === quote) {
          cell += quote;
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === quote && cell === '' && !wasQuoted) {
      quoted = true;
      wasQuoted = true;
    } else if (text.startsWith(separator, index)) {
      row.push(cell);
      cell = '';
      wasQuoted = false;
      index += separator.length - 1;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      wasQuoted = false;
    } else cell += char;
  }
  if (cell !== '' || row.length || wasQuoted) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.length > 1 || entry[0] !== '');
}

// ---------------------------------------------------------------- XML

export interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export const xmlDecode = (value: string) =>
  value.replace(/&(#x[0-9a-f]+|#\d+|\w+);/giu, (whole, entity: string) =>
    entity.startsWith('#x') || entity.startsWith('#X')
      ? String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
      : entity.startsWith('#')
        ? String.fromCodePoint(Number(entity.slice(1)))
        : (ENTITIES[entity] ?? whole),
  );

const localName = (name: string) => name.replace(/^.*:/u, '');

/** A forgiving XML reader: elements, attributes and text; namespaces are reduced to local names. */
export function parseXml(text: string): XmlNode {
  const root: XmlNode = { name: '#document', attributes: {}, children: [], text: '' };
  const stack = [root];
  const pattern =
    /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/gu;
  for (const match of text.matchAll(pattern)) {
    const current = stack.at(-1)!;
    if (match[1] !== undefined) current.text += match[1];
    else if (match[6] !== undefined) current.text += xmlDecode(match[6]);
    else if (match[3]) {
      if (match[2]) {
        if (stack.length > 1) stack.pop();
        continue;
      }
      const attributes: Record<string, string> = {};
      for (const attribute of (match[4] ?? '').matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu))
        attributes[localName(attribute[1]!)] = xmlDecode(attribute[2] ?? attribute[3] ?? '');
      const node: XmlNode = { name: localName(match[3]), attributes, children: [], text: '' };
      current.children.push(node);
      if (!match[5]) stack.push(node);
    }
  }
  return root;
}

function xmlRows(
  text: string,
  rowSelector?: string,
): { columns: string[]; records: Record<string, string>[] } {
  const document = parseXml(text);
  let rows: XmlNode[] = [];
  const steps = (rowSelector ?? '')
    .replace(/^\/+/u, '')
    .split('/')
    .map((step) => localName(step.trim()))
    .filter(Boolean);
  if (steps.length) {
    rows = [document];
    for (const step of steps)
      rows = rows.flatMap((node) => node.children.filter((child) => child.name === step));
  } else {
    // the first element whose children repeat one name holds the rows
    const visit = (node: XmlNode): XmlNode[] | undefined => {
      const names = node.children.map((child) => child.name);
      if (names.length > 1 && names.every((name) => name === names[0])) return node.children;
      for (const child of node.children) {
        const found = visit(child);
        if (found) return found;
      }
      return undefined;
    };
    rows = visit(document) ?? document.children[0]?.children ?? [];
  }
  const columns: string[] = [];
  const records = rows.map((row) => {
    const record: Record<string, string> = {};
    for (const [name, value] of Object.entries(row.attributes)) record[`@${name}`] = value;
    for (const child of row.children)
      record[child.name] = child.children.length ? flattenXml(child) : child.text.trim();
    for (const key of Object.keys(record)) if (!columns.includes(key)) columns.push(key);
    return record;
  });
  return { columns, records };
}

const flattenXml = (node: XmlNode): string =>
  node.children.length ? node.children.map(flattenXml).join(' ') : node.text.trim();

// ---------------------------------------------------------------- JSON

function selectJson(value: unknown, selector?: string): unknown {
  const steps = (selector ?? '')
    .replace(/^\$\.?/u, '')
    .split('.')
    .filter(Boolean);
  let current = value;
  for (const step of steps) {
    const key = step.replace(/\[\*?\]$/u, '');
    current = current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
  }
  if (!steps.length && current && typeof current === 'object' && !Array.isArray(current)) {
    // `{ "items": [...] }` without a selector: the first array of objects
    const array = Object.values(current).find((entry) => Array.isArray(entry));
    if (array) return array;
  }
  return current;
}

function flattenJson(value: unknown, prefix: string, out: Record<string, string>): void {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, entry] of Object.entries(value))
      flattenJson(entry, prefix ? `${prefix}.${key}` : key, out);
    return;
  }
  out[prefix || 'VALUE'] =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
}

function jsonRows(
  text: string,
  rowSelector?: string,
): { columns: string[]; records: Record<string, string>[] } {
  const selected = selectJson(JSON.parse(text) as unknown, rowSelector);
  const array = Array.isArray(selected) ? selected : selected === undefined ? [] : [selected];
  const columns: string[] = [];
  const records = array.map((entry) => {
    const record: Record<string, string> = {};
    flattenJson(entry, '', record);
    for (const key of Object.keys(record)) if (!columns.includes(key)) columns.push(key);
    return record;
  });
  return { columns, records };
}

// ---------------------------------------------------------------- XLSX

export interface Worksheet {
  sequence: number;
  name: string;
  file: string;
  path: string;
}

function zipText(zip: ZipReader, name: string): string | undefined {
  const entry = zip.entries.find((candidate) => candidate.name === name);
  return entry ? zip.read(entry).toString('utf8') : undefined;
}

function workbookSheets(zip: ZipReader): Worksheet[] {
  const workbook = zipText(zip, 'xl/workbook.xml') ?? '';
  const rels = zipText(zip, 'xl/_rels/workbook.xml.rels') ?? '';
  const targets = new Map<string, string>();
  for (const match of rels.matchAll(/<Relationship\b([^>]*)\/?>/gu)) {
    const id = /\bId="([^"]*)"/u.exec(match[1]!)?.[1];
    const target = /\bTarget="([^"]*)"/u.exec(match[1]!)?.[1];
    if (id && target) targets.set(id, target.replace(/^\/?xl\//u, ''));
  }
  return [...workbook.matchAll(/<sheet\b([^>]*)\/?>/gu)].map((match, index) => {
    const name = xmlDecode(/\bname="([^"]*)"/u.exec(match[1]!)?.[1] ?? `Sheet${index + 1}`);
    const id = /\br:id="([^"]*)"/u.exec(match[1]!)?.[1] ?? '';
    const target = targets.get(id) ?? `worksheets/sheet${index + 1}.xml`;
    return { sequence: index + 1, name, file: path.posix.basename(target), path: `xl/${target}` };
  });
}

export function xlsxWorksheets(bytes: Uint8Array): Worksheet[] {
  const zip = new ZipReader(bytes);
  try {
    return workbookSheets(zip);
  } finally {
    zip.close();
  }
}

const DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function excelDate(serial: number): string {
  const milliseconds = Math.round((serial - 25_569) * 86_400_000);
  const date = new Date(milliseconds);
  const local = new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  );
  return isoDate(local, serial % 1 !== 0);
}

function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/u.exec(reference)?.[0] ?? 'A';
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function xlsxRows(bytes: Uint8Array, sheet?: string, maxRows = Infinity): string[][] {
  const zip = new ZipReader(bytes);
  try {
    const sheets = workbookSheets(zip);
    const wanted = (sheet ?? '').toLowerCase();
    const target =
      sheets.find(
        (candidate) =>
          wanted &&
          (candidate.file.toLowerCase() === wanted ||
            candidate.name.toLowerCase() === wanted ||
            candidate.path.toLowerCase() === wanted),
      ) ?? sheets[0];
    if (!target) return [];
    const shared = [...(zipText(zip, 'xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/gu)].map(
      (match) =>
        [...match[1]!.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gu)]
          .map((part) => xmlDecode(part[1]!))
          .join(''),
    );
    const styles = zipText(zip, 'xl/styles.xml') ?? '';
    const custom = new Map<number, string>();
    for (const match of styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/gu))
      custom.set(Number(match[1]), xmlDecode(match[2]!));
    const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/u.exec(styles)?.[1] ?? '';
    const dateStyles = [...cellXfs.matchAll(/<xf\b([^>]*)/gu)].map((match) => {
      const id = Number(/numFmtId="(\d+)"/u.exec(match[1]!)?.[1] ?? 0);
      const code = (custom.get(id) ?? '').replace(/"[^"]*"|\[[^\]]*\]/gu, '');
      return DATE_FORMATS.has(id) || (/[dy]/iu.test(code) && /[dmy]/iu.test(code));
    });
    const xml = zipText(zip, target.path) ?? '';
    const rows: string[][] = [];
    for (const rowMatch of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/gu)) {
      if (rows.length >= maxRows) break;
      const rowNumber = Number(/\br="(\d+)"/u.exec(rowMatch[1]!)?.[1] ?? rows.length + 1);
      while (rows.length < rowNumber - 1) rows.push([]);
      const row: string[] = [];
      for (const cell of (rowMatch[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gu)) {
        const attributes = cell[1]!;
        const reference = /\br="([A-Z]+\d+)"/u.exec(attributes)?.[1];
        const index = reference ? columnIndex(reference) : row.length;
        const type = /\bt="(\w+)"/u.exec(attributes)?.[1] ?? 'n';
        const style = Number(/\bs="(\d+)"/u.exec(attributes)?.[1] ?? 0);
        const body = cell[2] ?? '';
        const raw = /<v>([\s\S]*?)<\/v>/u.exec(body)?.[1];
        let value = '';
        if (type === 's') value = shared[Number(raw)] ?? '';
        else if (type === 'inlineStr')
          value = [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gu)]
            .map((part) => xmlDecode(part[1]!))
            .join('');
        else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
        else if (type === 'str' || type === 'e') value = xmlDecode(raw ?? '');
        else if (raw !== undefined) {
          const number = Number(raw);
          value = dateStyles[style] && Number.isFinite(number) ? excelDate(number) : raw;
        }
        while (row.length < index) row.push('');
        row[index] = value;
      }
      rows.push(row);
    }
    return rows;
  } finally {
    zip.close();
  }
}

// ---------------------------------------------------------------- entry point

const cache = new Map<string, ParsedTable>();

export const columnName = (index: number) => `COL${String(index + 1).padStart(3, '0')}`;

/** Parses a file into named columns and text rows; the first line becomes headers when asked. */
export function parseFile(
  bytes: Uint8Array,
  filename: string | undefined,
  options: ParseOptions = {},
): ParsedTable {
  const format = options.format ?? formatOf(filename, bytes);
  const key = `${createHash('sha1').update(bytes).digest('hex')}|${filename}|${JSON.stringify({ ...options, format })}`;
  const cached = cache.get(key);
  if (cached) return cached;
  let result: ParsedTable;
  if (format === 'json' || format === 'xml') {
    const text = decodeText(bytes, options.encoding);
    const { columns, records } =
      format === 'json' ? jsonRows(text, options.rowSelector) : xmlRows(text, options.rowSelector);
    result = {
      format,
      columns,
      rows: records.map((record) => columns.map((column) => record[column] ?? '')),
    };
  } else {
    let rows =
      format === 'xlsx'
        ? xlsxRows(bytes, options.sheet)
        : (() => {
            const text = decodeText(bytes, options.encoding);
            const enclosedBy = options.enclosedBy ?? '"';
            const separator =
              options.separator === '\\t' ? '\t' : options.separator || detectSeparator(text, enclosedBy);
            return splitCsv(text, separator, enclosedBy);
          })();
    rows = rows.slice(options.skipRows ?? 0);
    const width = Math.max(0, ...rows.map((row) => row.length));
    rows = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''));
    const headers = options.headers !== false && rows.length ? rows[0]! : undefined;
    result = {
      format,
      columns: Array.from({ length: width }, (_, index) =>
        headers?.[index]?.trim() ? headers[index]!.trim() : columnName(index),
      ),
      rows: headers ? rows.slice(1) : rows,
      ...(headers ? { headerRow: headers } : {}),
    };
  }
  cache.set(key, result);
  if (cache.size > 16) cache.delete(cache.keys().next().value!);
  return result;
}

// ---------------------------------------------------------------- data types

const NUMBER = /^[-+]?(?:\d{1,3}(?:[,\s]\d{3})+|\d+)?(?:\.\d+)?(?:e[-+]?\d+)?$/iu;
const DATE =
  /^(?:\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}-[a-z]{3}-\d{2,4})$/iu;

/** Detected column type as apex_data_parser.discover reports it. */
export function detectType(values: string[]): {
  type: 'NUMBER' | 'DATE' | 'VARCHAR2';
  length: number;
  mask?: string;
} {
  const filled = values.map((value) => value.trim()).filter(Boolean);
  const length = Math.max(1, ...values.map((value) => value.length));
  if (filled.length && filled.every((value) => NUMBER.test(value) && /\d/u.test(value)))
    return { type: 'NUMBER', length };
  if (filled.length && filled.every((value) => DATE.test(value))) {
    const sample = filled[0]!;
    const mask = /^\d{4}-/u.test(sample)
      ? sample.length > 10
        ? 'YYYY-MM-DD HH24:MI:SS'
        : 'YYYY-MM-DD'
      : /[a-z]/iu.test(sample)
        ? 'DD-MON-YYYY'
        : sample.includes('.')
          ? 'DD.MM.YYYY'
          : 'MM/DD/YYYY';
    return { type: 'DATE', length, mask };
  }
  return { type: 'VARCHAR2', length: Math.min(4000, Math.ceil(length / 50) * 50 || 50) };
}
