import { randomUUID } from 'node:crypto';
import type { Binds, Row } from '../database.ts';

/**
 * SQLcl batch text for the connected preview and parsing of its output. Every
 * batch is a list of segments; each segment ends with a private marker so one
 * reply can carry several JSON envelopes and error texts without ambiguity.
 * Nothing here commits: the session is opened with exit/auto commit off and
 * COMMIT disabled in procedures (see INIT_SESSION).
 */

export const INIT_SESSION = [
  'set define off',
  'set escape off',
  'set echo off',
  'set feedback off',
  'set verify off',
  'set serveroutput off',
  'set sqlblanklines on',
  'set exitcommit off',
  'set autocommit off',
  'alter session disable commit in procedure;',
  "alter session set nls_date_format = 'YYYY-MM-DD HH24:MI:SS';",
  "alter session set nls_timestamp_format = 'YYYY-MM-DD HH24:MI:SS.FF';",
  "alter session set nls_numeric_characters = '.,';",
  'exec dbms_output.enable(null);',
].join('\n');

const NAME = /^[A-Za-z][\w$#]{0,127}$/u;
export const RESULT_BIND = 'APEXREST_RESULT';
export const ROWS_BIND = 'APEXREST_ROWS';
export const ROWID_BIND = 'APEXREST_ROWID';
export const OUTPUT_BIND = 'APEXREST_DBMS';
export const HTP_BIND = 'APEXREST_HTP';

export class OracleError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export function bindName(name: string): string {
  if (!NAME.test(name))
    throw new OracleError(-20990, `Bind :${name} cannot be passed to Oracle by the preview`);
  return name.toUpperCase();
}

export function sqlText(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function statementBody(sql: string): string {
  return sql.trim().replace(/;\s*$/u, '');
}

/** VARIABLE declarations plus one PL/SQL block that assigns every value. */
export function declareBinds(binds: Record<string, string | number | null | undefined>): string {
  const names = Object.keys(binds);
  if (!names.length) return '';
  const declare = names.map((name) => `variable ${bindName(name)} varchar2(32767)`).join('\n');
  const assign = names
    .map((name) => {
      const value = binds[name];
      return `  :${bindName(name)} := ${value === null || value === undefined || value === '' ? 'null' : sqlText(String(value))};`;
    })
    .join('\n');
  return `${declare}\nbegin\n${assign}\nend;\n/`;
}

/** Only the binds a statement references; absent values bind as NULL like empty APEX items. */
export function referencedBinds(names: string[], binds: Binds): Record<string, string | number | null> {
  const known = new Map(Object.entries(binds).map(([key, value]) => [key.toUpperCase(), value]));
  return Object.fromEntries(names.map((name) => [name.toUpperCase(), known.get(name.toUpperCase()) ?? null]));
}

export interface Batch {
  text: string;
  markers: string[];
}

/** Builds a batch from segments; segment i's output is everything before markers[i]. */
export function batch(segments: string[]): Batch {
  const token = `APEXREST_SEGMENT_${randomUUID().replaceAll('-', '')}`;
  const markers = segments.map((_, index) => `${token}_${index}`);
  return {
    text: segments.map((segment, index) => `${segment}\nprompt ${markers[index]}`).join('\n') + '\n',
    markers,
  };
}

export function querySegment(sql: string, maxRows: number): string {
  return `set sqlformat json\nselect * from (\n${statementBody(sql)}\n) where rownum <= ${Math.max(1, Math.trunc(maxRows))}\n/\nset sqlformat default`;
}

export function selectBindsSegment(names: string[]): string {
  if (!names.length) return 'set sqlformat default';
  return `set sqlformat json\nselect ${names.map((name) => `:${bindName(name)} "${bindName(name)}"`).join(', ')} from dual\n/\nset sqlformat default`;
}

export function plsqlSegment(block: string): string {
  return `${block.trim()}\n/`;
}

/** DML inside PL/SQL so SQL%ROWCOUNT (and an inserted ROWID) come back as binds. */
export function dmlBlock(sql: string, returningRowid: boolean): string {
  const body = statementBody(sql);
  const returning =
    returningRowid && /^\s*insert\b[\s\S]*\bvalues\s*\(/iu.test(body) && !/\breturning\b/iu.test(body)
      ? ` returning rowidtochar(rowid) into :${ROWID_BIND}`
      : '';
  return `begin\n${body}${returning};\n:${ROWS_BIND} := sql%rowcount;\nend;`;
}

export const DBMS_OUTPUT_BLOCK = `declare
  l_lines dbmsoutput_linesarray;
  l_count integer := 10000;
  l_text varchar2(32767);
begin
  dbms_output.get_lines(l_lines, l_count);
  for i in 1 .. l_count loop
    exit when nvl(lengthb(l_text), 0) + nvl(lengthb(l_lines(i)), 0) > 32000;
    l_text := l_text || l_lines(i) || chr(10);
  end loop;
  :${OUTPUT_BIND} := l_text;
end;`;

export const HTP_INIT_BLOCK = `declare
  l_names owa.vc_arr;
  l_values owa.vc_arr;
begin
  l_names(1) := 'REQUEST_PROTOCOL';
  l_values(1) := 'HTTP';
  owa.init_cgi_env(1, l_names, l_values);
  htp.init;
end;`;

export const HTP_READ_BLOCK = `declare
  l_page htp.htbuf_arr;
  l_rows integer := 99999;
  l_text varchar2(32767);
begin
  owa.get_page(l_page, l_rows);
  for i in 1 .. l_rows loop
    exit when nvl(lengthb(l_text), 0) + nvl(lengthb(l_page(i)), 0) > 32000;
    l_text := l_text || l_page(i);
  end loop;
  :${HTP_BIND} := l_text;
end;`;

/** Splits a reply into the per-segment texts; a missing marker means the reply is incomplete. */
export function segments(output: string, markers: string[]): string[] {
  // SQLcl's JSON formatter can omit its final newline before PROMPT output.
  const text = output.replace(/\}(APEXREST_SEGMENT_[0-9a-f]+_\d+)/gu, '}\n$1');
  const lines = text.split(/\r?\n/u);
  const parts: string[] = [];
  let from = 0;
  for (const marker of markers) {
    const at = lines.findIndex((line, index) => index >= from && line.trim() === marker);
    if (at < 0) throw new OracleError(-20991, 'SQLcl did not confirm every preview statement');
    parts.push(lines.slice(from, at).join('\n'));
    from = at + 1;
  }
  return parts;
}

/** The first Oracle/SQLcl error in a segment, with the full ORA- stack as its message. */
export function segmentError(text: string): OracleError | undefined {
  const lines = text.split(/\r?\n/u).filter((line) => /\b(?:ORA|PLS|SP2)-\d{4,5}\b/u.test(line));
  if (!lines.length) return undefined;
  const first = /\b(ORA|PLS|SP2)-(\d{4,5})\b/u.exec(lines[0]!)!;
  const code = first[1] === 'ORA' ? -Number(first[2]) : -20992;
  const message = lines
    .map((line) => line.trim())
    .filter((line, index, all) => all.indexOf(line) === index)
    .join('\n');
  return new OracleError(code, message);
}

function normalizeValue(value: unknown, type: string | undefined): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value !== 'string') return JSON.stringify(value);
  // SQLcl may render DATE/TIMESTAMP as ISO 8601; the preview stores canonical 'YYYY-MM-DD HH24:MI:SS'.
  if (type && /^(DATE|TIMESTAMP)/iu.test(type)) {
    const iso = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?Z?$/u.exec(value);
    if (iso) return /^DATE/iu.test(type) || iso[2] !== '00:00:00' ? `${iso[1]} ${iso[2]}` : iso[1]!;
  }
  return value;
}

/** Rows of a `set sqlformat json` envelope with upper-case column names in select order. */
export function jsonRows(text: string): { columns: string[]; rows: Row[] } {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new OracleError(-20993, 'SQLcl returned no JSON result');
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new OracleError(-20993, 'SQLcl returned an unreadable JSON result');
  }
  const set = (json as { results?: { columns?: { name?: string; type?: string }[]; items?: unknown[] }[] })
    .results?.[0];
  if (!set || !Array.isArray(set.items)) throw new OracleError(-20993, 'SQLcl JSON result has no items');
  const items = set.items as Record<string, unknown>[];
  const declared = (set.columns ?? []).map((column) => ({
    name: String(column.name ?? ''),
    type: column.type,
  }));
  const columns = declared.length
    ? declared
    : Object.keys(items[0] ?? {}).map((name) => ({ name, type: undefined }));
  const rows = items.map((item) => {
    const byKey = new Map(Object.entries(item).map(([key, value]) => [key.toUpperCase(), value]));
    const row: Row = {};
    for (const column of columns)
      row[column.name.toUpperCase()] = normalizeValue(byKey.get(column.name.toUpperCase()), column.type);
    return row;
  });
  return { columns: columns.map((column) => column.name.toUpperCase()), rows };
}
