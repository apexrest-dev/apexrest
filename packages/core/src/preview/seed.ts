/**
 * Oracle install scripts in the local SQLite database. Supporting objects are written for Oracle:
 * they carry statements that only matter to Oracle (comments, grants, trigger enabling, session
 * settings, domain indexes) and constraint DDL that SQLite cannot add after CREATE TABLE. These
 * rules turn each such statement into what it means locally, or into nothing.
 */

const Q = String.raw`"?[\w$#]+"?`;
const NAME = String.raw`(?:${Q}\s*\.\s*)?(${Q})`;
const unquote = (name: string) => name.replaceAll('"', '');

/** Statements with no local effect: they are skipped without a diagnostic. */
const NO_LOCAL_EFFECT = [
  /^comment\s+on\s+(?:table|column|materialized\s+view|view)\b/iu,
  /^alter\s+(?:trigger|session|system|index|package|procedure|function|view|type|sequence|user)\b/iu,
  /^(?:grant|revoke|analyze|purge|audit|noaudit|truncate\s+cluster|associate\s+statistics)\b/iu,
  /^create\s+(?:or\s+replace\s+)?(?:public\s+)?synonym\b/iu,
  /^create\s+(?:or\s+replace\s+)?(?:context|directory|database\s+link|role|user|profile|tablespace)\b/iu,
  /^(?:drop|create)\s+(?:materialized\s+view\s+log|search\s+index)\b/iu,
  // Oracle Text, spatial and other domain indexes
  /^create\s+(?:unique\s+|bitmap\s+)?index\b[\s\S]*\bindextype\s+is\b/iu,
  /^create\s+(?:or\s+replace\s+)?(?:json\s+)?(?:relational\s+)?duality\s+view\b/iu,
  // constraint state changes and constraints SQLite does not enforce after creation
  /^alter\s+table\s+\S+\s+(?:enable|disable|modify|rename|drop)\s+(?:constraint|primary|unique|novalidate|validate)\b/iu,
  /^alter\s+table\s+\S+\s+add\s+(?:constraint\s+\S+\s+)?(?:foreign\s+key|check)\b/iu,
  /^alter\s+table\s+\S+\s+(?:move|shrink|parallel|noparallel|logging|nologging|cache|nocache|compress|nocompress)\b/iu,
];

/**
 * The local form of one Oracle seed statement: an empty list when it has no local effect, the
 * rewritten statements otherwise (usually the statement itself).
 */
export function oracleSeedStatements(sql: string): string[] {
  const text = sql.replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*/u, '').trim();
  if (!text) return [];
  if (NO_LOCAL_EFFECT.some((rule) => rule.test(text))) return [];
  // `drop ... if exists ... cascade constraints` and `purge`: SQLite keeps `if exists`, not the rest.
  const drop = new RegExp(
    String.raw`^drop\s+(table|view|index|trigger)\s+(?:if\s+exists\s+)?${NAME}`,
    'iu',
  ).exec(text);
  if (drop) return [`drop ${drop[1]!.toLowerCase()} if exists "${unquote(drop[2]!)}"`];
  // ALTER TABLE ... ADD [CONSTRAINT name] PRIMARY KEY|UNIQUE (cols): a unique index.
  const key = new RegExp(
    String.raw`^alter\s+table\s+${NAME}\s+add\s+(?:constraint\s+(${Q})\s+)?(primary\s+key|unique)\s*\(([^)]*)\)`,
    'iu',
  ).exec(text);
  if (key) {
    const table = unquote(key[1]!);
    const index = unquote(key[2] ?? `${table}_${key[3]!.toLowerCase().startsWith('primary') ? 'pk' : 'uk'}`);
    return [`create unique index if not exists "${index}" on "${table}" (${key[4]})`];
  }
  // ALTER TABLE ... ADD (col type, col type): one ADD COLUMN per column.
  const columns = new RegExp(String.raw`^alter\s+table\s+${NAME}\s+add\s*\(([\s\S]*)\)\s*$`, 'iu').exec(text);
  if (columns && !/^\s*(?:constraint|primary|unique|foreign|check)\b/iu.test(columns[2]!)) {
    return splitColumns(columns[2]!).map(
      (column) => `alter table "${unquote(columns[1]!)}" add column ${column}`,
    );
  }
  return [text];
}

/** Splits a column list on top-level commas. */
function splitColumns(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of list) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Oracle column and table clauses SQLite rejects, removed from CREATE TABLE. Applied to the
 * literal-masked text of a table DDL statement, after identity columns were marked.
 */
export function cleanTableDdl(text: string): string {
  return identityKeys(
    withoutTableOptions(
      text
        // identity options: MINVALUE 1 MAXVALUE 999 INCREMENT BY 1 START WITH 1 CACHE 20 NOORDER NOCYCLE ...
        .replace(
          /(\/\*apex_local_identity\*\/)((?:\s+(?:(?:minvalue|maxvalue|cache)\s+-?\d+|(?:increment\s+by|start\s+with)\s+-?\d+|no(?:minvalue|maxvalue|cache|order|cycle|keep|scale)|order|cycle|keep|scale|extend|noextend))*)/giu,
          '$1',
        )
        // TIMESTAMP(6) WITH [LOCAL] TIME ZONE, INTERVAL DAY(2) TO SECOND(6), INTERVAL YEAR TO MONTH
        .replace(/\btimestamp\s*(?:\(\s*\d\s*\))?\s+with\s+(?:local\s+)?time\s+zone\b/giu, 'timestamp')
        .replace(
          /\binterval\s+(?:day|year)\s*(?:\(\s*\d+\s*\))?\s+to\s+(?:second|month)\s*(?:\(\s*\d+\s*\))?/giu,
          'text',
        )
        // NUMBER(*,0) and NUMBER(*)
        .replace(/\bnumber\s*\(\s*\*\s*(?:,\s*-?\d+\s*)?\)/giu, 'number')
        // object and spatial types
        .replace(/\b(?:mdsys\s*\.\s*)?sdo_geometry\b/giu, 'blob')
        .replace(/\b(?:sys\s*\.\s*)?(?:xmltype|anydata|uritype|sdo_topo_geometry)\b/giu, 'text')
        .replace(/\bvector\s*\([^)]*\)/giu, 'blob')
        .replace(/\bcollate\s+\w+/giu, '')
        .replace(/\bvisible\b|\binvisible\b/giu, ''),
    ),
  );
}

const MARKER = '/*apex_local_identity*/';

/**
 * Identity columns: when the table's primary key is that one column (declared inline or at the
 * end of the column list), it becomes SQLite's INTEGER PRIMARY KEY, which numbers rows as Oracle's
 * identity does. Any other identity column accepts NULL; the database numbers it after the insert.
 */
function identityKeys(text: string): string {
  if (!text.includes(MARKER)) return text;
  const tableKey = /,\s*(?:constraint\s+"?[\w$#]+"?\s+)?primary\s+key\s*\(\s*"?([\w$#]+)"?\s*\)/iu.exec(text);
  if (tableKey) {
    const column = tableKey[1]!.replace(/[^\w$#]/gu, '');
    const definition = new RegExp(
      `("?${column.replaceAll('$', '\\$')}"?\\s+)(?:number|integer|int)(?:\\s*\\(\\s*\\d+\\s*\\))?(\\s+\\/\\*apex_local_identity\\*\\/)`,
      'iu',
    );
    if (definition.test(text))
      text = text.slice(0, tableKey.index) + text.slice(tableKey.index + tableKey[0].length);
    text = text.replace(definition, '$1integer$2 primary key');
  }
  // identity columns that are not the integer key: no NOT NULL, numbered by a trigger
  return text.replace(
    /(\/\*apex_local_identity\*\/)(?!\s+primary\s+key)([^,()]*?)\s+not\s+null\b/giu,
    '$1$2',
  );
}

/**
 * Physical Oracle table options after the column list (TABLESPACE, SEGMENT CREATION, LOB storage,
 * ROWDEPENDENCIES, PARTITION BY ...) have no local meaning; SQLite only accepts its own there.
 */
function withoutTableOptions(text: string): string {
  if (!/^\s*create\s+(?:global\s+temporary\s+)?table\b/iu.test(text)) return text;
  const open = text.indexOf('(');
  if (open < 0) return text;
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '(') depth += 1;
    else if (text[index] === ')' && --depth === 0) {
      const rest = text.slice(index + 1);
      const keep = /^\s*(?:without\s+rowid|strict)(?:\s*,\s*(?:without\s+rowid|strict))?\s*$/iu.test(rest);
      return keep ? text : text.slice(0, index + 1);
    }
  }
  return text;
}

export type PlsqlUnitKind =
  'package' | 'package body' | 'function' | 'procedure' | 'trigger' | 'type' | 'type body' | 'block';

const UNIT_HEADER =
  /^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*create\s+(?:or\s+replace\s+)?(?:editionable\s+|noneditionable\s+)?(package\s+body|package|function|procedure|trigger|type\s+body|type)\s+(?:"?[\w$#]+"?\s*\.\s*)?"?([\w$#]+)"?/iu;

/** Kind and lower-case name of a PL/SQL unit; anonymous blocks are `block` with an empty name. */
export function describeUnit(source: string): { kind: PlsqlUnitKind; name: string } {
  const header = UNIT_HEADER.exec(source);
  if (!header) return { kind: 'block', name: '' };
  return {
    kind: header[1]!.toLowerCase().replace(/\s+/gu, ' ') as PlsqlUnitKind,
    name: header[2]!.toLowerCase(),
  };
}

/** The unit text after `CREATE [OR REPLACE] [EDITIONABLE] <kind> [schema.]name`. */
export function unitBody(source: string): string {
  const header = UNIT_HEADER.exec(source);
  return header ? source.slice(header.index + header[0].length) : source;
}
