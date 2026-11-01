import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);

// packages/core/src/preview/oracle/protocol.ts
import { randomUUID } from "node:crypto";
var INIT_SESSION = [
  "set define off",
  "set escape off",
  "set echo off",
  "set feedback off",
  "set verify off",
  "set serveroutput off",
  "set sqlblanklines on",
  "set exitcommit off",
  "set autocommit off",
  "alter session disable commit in procedure;",
  "alter session set nls_date_format = 'YYYY-MM-DD HH24:MI:SS';",
  "alter session set nls_timestamp_format = 'YYYY-MM-DD HH24:MI:SS.FF';",
  "alter session set nls_numeric_characters = '.,';",
  "exec dbms_output.enable(null);"
].join("\n");
var NAME = /^[A-Za-z][\w$#]{0,127}$/u;
var RESULT_BIND = "APEXREST_RESULT";
var ROWS_BIND = "APEXREST_ROWS";
var ROWID_BIND = "APEXREST_ROWID";
var OUTPUT_BIND = "APEXREST_DBMS";
var HTP_BIND = "APEXREST_HTP";
var OracleError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
function bindName(name) {
  if (!NAME.test(name))
    throw new OracleError(-20990, `Bind :${name} cannot be passed to Oracle by the preview`);
  return name.toUpperCase();
}
function sqlText(value) {
  return `'${value.replaceAll("'", "''")}'`;
}
function statementBody(sql) {
  return sql.trim().replace(/;\s*$/u, "");
}
function declareBinds(binds) {
  const names = Object.keys(binds);
  if (!names.length) return "";
  const declare = names.map((name) => `variable ${bindName(name)} varchar2(32767)`).join("\n");
  const assign = names.map((name) => {
    const value = binds[name];
    return `  :${bindName(name)} := ${value === null || value === void 0 || value === "" ? "null" : sqlText(String(value))};`;
  }).join("\n");
  return `${declare}
begin
${assign}
end;
/`;
}
function referencedBinds(names, binds) {
  const known = new Map(Object.entries(binds).map(([key, value]) => [key.toUpperCase(), value]));
  return Object.fromEntries(names.map((name) => [name.toUpperCase(), known.get(name.toUpperCase()) ?? null]));
}
function batch(segments2) {
  const token = `APEXREST_SEGMENT_${randomUUID().replaceAll("-", "")}`;
  const markers = segments2.map((_, index) => `${token}_${index}`);
  return {
    text: segments2.map((segment, index) => `${segment}
prompt ${markers[index]}`).join("\n") + "\n",
    markers
  };
}
function querySegment(sql, maxRows) {
  return `set sqlformat json
select * from (
${statementBody(sql)}
) where rownum <= ${Math.max(1, Math.trunc(maxRows))}
/
set sqlformat default`;
}
function selectBindsSegment(names) {
  if (!names.length) return "set sqlformat default";
  return `set sqlformat json
select ${names.map((name) => `:${bindName(name)} "${bindName(name)}"`).join(", ")} from dual
/
set sqlformat default`;
}
function plsqlSegment(block) {
  return `${block.trim()}
/`;
}
function dmlBlock(sql, returningRowid) {
  const body = statementBody(sql);
  const returning = returningRowid && /^\s*insert\b[\s\S]*\bvalues\s*\(/iu.test(body) && !/\breturning\b/iu.test(body) ? ` returning rowidtochar(rowid) into :${ROWID_BIND}` : "";
  return `begin
${body}${returning};
:${ROWS_BIND} := sql%rowcount;
end;`;
}
var DBMS_OUTPUT_BLOCK = `declare
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
var HTP_INIT_BLOCK = `declare
  l_names owa.vc_arr;
  l_values owa.vc_arr;
begin
  l_names(1) := 'REQUEST_PROTOCOL';
  l_values(1) := 'HTTP';
  owa.init_cgi_env(1, l_names, l_values);
  htp.init;
end;`;
var HTP_READ_BLOCK = `declare
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
function segments(output, markers) {
  const text = output.replace(/\}(APEXREST_SEGMENT_[0-9a-f]+_\d+)/gu, "}\n$1");
  const lines = text.split(/\r?\n/u);
  const parts = [];
  let from = 0;
  for (const marker of markers) {
    const at = lines.findIndex((line, index) => index >= from && line.trim() === marker);
    if (at < 0) throw new OracleError(-20991, "SQLcl did not confirm every preview statement");
    parts.push(lines.slice(from, at).join("\n"));
    from = at + 1;
  }
  return parts;
}
function segmentError(text) {
  const lines = text.split(/\r?\n/u).filter((line) => /\b(?:ORA|PLS|SP2)-\d{4,5}\b/u.test(line));
  if (!lines.length) return void 0;
  const first = /\b(ORA|PLS|SP2)-(\d{4,5})\b/u.exec(lines[0]);
  const code = first[1] === "ORA" ? -Number(first[2]) : -20992;
  const message = lines.map((line) => line.trim()).filter((line, index, all) => all.indexOf(line) === index).join("\n");
  return new OracleError(code, message);
}
function normalizeValue(value, type) {
  if (value === null || value === void 0) return null;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value !== "string") return JSON.stringify(value);
  if (type && /^(DATE|TIMESTAMP)/iu.test(type)) {
    const iso = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?Z?$/u.exec(value);
    if (iso) return /^DATE/iu.test(type) || iso[2] !== "00:00:00" ? `${iso[1]} ${iso[2]}` : iso[1];
  }
  return value;
}
function jsonRows(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new OracleError(-20993, "SQLcl returned no JSON result");
  let json;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new OracleError(-20993, "SQLcl returned an unreadable JSON result");
  }
  const set = json.results?.[0];
  if (!set || !Array.isArray(set.items)) throw new OracleError(-20993, "SQLcl JSON result has no items");
  const items = set.items;
  const declared = (set.columns ?? []).map((column) => ({
    name: String(column.name ?? ""),
    type: column.type
  }));
  const columns = declared.length ? declared : Object.keys(items[0] ?? {}).map((name) => ({ name, type: void 0 }));
  const rows = items.map((item) => {
    const byKey = new Map(Object.entries(item).map(([key, value]) => [key.toUpperCase(), value]));
    const row = {};
    for (const column of columns)
      row[column.name.toUpperCase()] = normalizeValue(byKey.get(column.name.toUpperCase()), column.type);
    return row;
  });
  return { columns: columns.map((column) => column.name.toUpperCase()), rows };
}

export {
  INIT_SESSION,
  RESULT_BIND,
  ROWS_BIND,
  ROWID_BIND,
  OUTPUT_BIND,
  HTP_BIND,
  OracleError,
  bindName,
  sqlText,
  declareBinds,
  referencedBinds,
  batch,
  querySegment,
  selectBindsSegment,
  plsqlSegment,
  dmlBlock,
  DBMS_OUTPUT_BLOCK,
  HTP_INIT_BLOCK,
  HTP_READ_BLOCK,
  segments,
  segmentError,
  jsonRows
};
