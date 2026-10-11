/** Oracle SQL inspection. Comments and string contents are data, not commands. */
export interface DatabaseOperation {
  action: string;
  object: string | null;
  column?: string;
  renamedTo?: string;
  dangerous: boolean;
  consequence: string;
}
type Token = { value: string; literal?: boolean; start: number; end: number };
export function sqlTokens(sql: string): Token[] {
  const tokens: Token[] = [];
  for (let i = 0; i < sql.length;) {
    if (/\s/.test(sql[i]!)) {
      i++;
      continue;
    }
    if (sql.startsWith('--', i)) {
      i = sql.indexOf('\n', i);
      if (i < 0) break;
      continue;
    }
    if (sql.startsWith('/*', i)) {
      const end = sql.indexOf('*/', i + 2);
      i = end < 0 ? sql.length : end + 2;
      continue;
    }
    if (
      !sql.slice(sql.lastIndexOf('\n', i - 1) + 1, i).trim() &&
      /^REM(?:ARK)?(?:[ \t]|$)(?![ \t]*:=)/i.test(sql.slice(i))
    ) {
      const end = sql.indexOf('\n', i);
      if (end < 0) break;
      i = end + 1;
      continue;
    }
    const start = i;
    const q = /^[qQ]'([\[({<]|[^\w\s])/.exec(sql.slice(i));
    if (q) {
      const closing = ({ '[': ']', '(': ')', '{': '}', '<': '>' } as Record<string, string>)[q[1]!] ?? q[1]!;
      const end = sql.indexOf(closing + "'", i + 3);
      tokens.push({
        value: sql.slice(i + 3, end < 0 ? sql.length : end),
        literal: true,
        start,
        end: end < 0 ? sql.length : end + 2,
      });
      i = end < 0 ? sql.length : end + 2;
      continue;
    }
    if (sql[i] === "'") {
      let value = '';
      i++;
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            value += "'";
            i += 2;
          } else {
            i++;
            break;
          }
        } else value += sql[i++]!;
      }
      tokens.push({ value, literal: true, start, end: i });
      continue;
    }
    if (sql[i] === '"') {
      let value = '"';
      i++;
      while (i < sql.length) {
        value += sql[i]!;
        if (sql[i++] === '"') {
          if (sql[i] === '"') value += sql[i++]!;
          else break;
        }
      }
      tokens.push({ value, start, end: i });
      continue;
    }
    const word = /^[A-Za-z][\w$#]*/.exec(sql.slice(i));
    if (word) {
      i += word[0].length;
      tokens.push({ value: word[0].toUpperCase(), start, end: i });
    } else {
      const value = sql[i++]!;
      tokens.push({ value, start, end: i });
    }
  }
  return tokens;
}
export function executableSql(sql: string) {
  const code = sql.split('').map((char) => (/\s/.test(char) ? char : ' '));
  for (const token of sqlTokens(sql))
    if (!token.literal) for (let i = token.start; i < token.end; i++) code[i] = sql[i]!;
  return code.join('');
}
/** Oracle object kinds whose plain CREATE is ordinary schema work; everything else is reviewed as dangerous. */
const plainCreateKinds = new Set(['TABLE', 'VIEW', 'INDEX', 'SEQUENCE', 'SYNONYM', 'MATERIALIZED-VIEW']);
const programKinds = new Set(['PACKAGE', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'TYPE', 'JAVA', 'LIBRARY']);
/** Modifier words that may precede an object kind in CREATE/DROP/ALTER. */
const kindModifiers = new Set([
  'OR',
  'REPLACE',
  'FORCE',
  'NOFORCE',
  'EDITIONABLE',
  'NONEDITIONABLE',
  'UNIQUE',
  'BITMAP',
  'MULTIVALUE',
  'PUBLIC',
  'PRIVATE',
  'GLOBAL',
  'TEMPORARY',
  'SHARDED',
  'DUPLICATED',
  'IMMUTABLE',
  'BLOCKCHAIN',
  'BIGFILE',
  'SMALLFILE',
  'AND',
  'RESOLVE',
  'COMPILE',
]);
/** Two-word object kinds, joined with a hyphen. */
const compoundKinds: Record<string, string[]> = {
  MATERIALIZED: ['VIEW', 'ZONEMAP'],
  DATABASE: ['LINK'],
  PACKAGE: ['BODY'],
  TYPE: ['BODY'],
  ROLLBACK: ['SEGMENT'],
  RESTORE: ['POINT'],
  FLASHBACK: ['ARCHIVE'],
  ANALYTIC: ['VIEW'],
  ATTRIBUTE: ['DIMENSION'],
  LOCKDOWN: ['PROFILE'],
};
/** SQL words and built-in functions that may legitimately precede `(` in a query. */
const queryBuiltins = new Set(
  (
    'ABS ACOS ADD_MONTHS ALL AND ANY ASCII ASCIISTR ASIN ATAN ATAN2 AVG BETWEEN BIN_TO_NUM BINARY_DOUBLE ' +
    'BINARY_FLOAT BITAND BY CARDINALITY CASE CAST CEIL CHAR CHARTOROWID CHR COALESCE COLLECT COMPOSE CONCAT ' +
    'CONNECT CONVERT CORR COS COSH COUNT COVAR_POP COVAR_SAMP CUBE CUME_DIST CURRENT_DATE CURRENT_TIMESTAMP ' +
    'CV DATE DBTIMEZONE DECODE DECOMPOSE DENSE_RANK DEREF DISTINCT DUMP ELSE EMPTY_BLOB EMPTY_CLOB EXISTS EXP ' +
    'EXTRACT FILTER FIRST FIRST_VALUE FLOAT FLOOR FOR FROM FROM_TZ GREATEST GROUP GROUPING GROUPING_ID HAVING ' +
    'HEXTORAW IN INITCAP INSTR INSTRB INSTRC INTERVAL IS JOIN JSON_ARRAY JSON_ARRAYAGG JSON_EXISTS JSON_MERGEPATCH ' +
    'JSON_OBJECT JSON_OBJECTAGG JSON_QUERY JSON_SCALAR JSON_SERIALIZE JSON_TABLE JSON_TRANSFORM JSON_VALUE KEEP ' +
    'LAG LAST LAST_DAY LAST_VALUE LATERAL LEAD LEAST LENGTH LENGTHB LENGTHC LIKE LISTAGG LN LNNVL LOCALTIMESTAMP ' +
    'LOG LOWER LPAD LTRIM MAX MEDIAN MIN MOD MONTHS_BETWEEN NANVL NCHAR NCHR NEW_TIME NEXT_DAY NLS_INITCAP ' +
    'NLS_LOWER NLS_UPPER NLSSORT NOT NTH_VALUE NTILE NULLIF NUMBER NUMTODSINTERVAL NUMTOYMINTERVAL NVARCHAR2 NVL ' +
    'NVL2 ON ONLY OR ORA_HASH ORDER OVER PARTITION PERCENT_RANK PERCENTILE_CONT PERCENTILE_DISC PIVOT POWER ' +
    'RANGE RANK RATIO_TO_REPORT RAW RAWTOHEX REGEXP_COUNT REGEXP_INSTR REGEXP_LIKE REGEXP_REPLACE REGEXP_SUBSTR ' +
    'REMAINDER REPLACE REVERSE ROLLUP ROUND ROW_NUMBER ROWIDTOCHAR ROWS RPAD RTRIM SELECT SESSIONTIMEZONE SETS ' +
    'SIGN SIN SINH SOME SOUNDEX SQRT STANDARD_HASH STATS_MODE STDDEV STDDEV_POP STDDEV_SAMP SUBSTR SUBSTRB ' +
    'SUBSTRC SUM SYS_CONNECT_BY_PATH SYS_CONTEXT SYS_EXTRACT_UTC SYS_GUID SYSDATE SYSTIMESTAMP TAN TANH THEN ' +
    'TIMESTAMP TO_BINARY_DOUBLE TO_BINARY_FLOAT TO_BLOB TO_CHAR TO_CLOB TO_DATE TO_DSINTERVAL TO_LOB TO_MULTI_BYTE ' +
    'TO_NCHAR TO_NCLOB TO_NUMBER TO_SINGLE_BYTE TO_TIMESTAMP TO_TIMESTAMP_TZ TO_YMINTERVAL TRANSLATE TREAT TRIM ' +
    'TRUNC TZ_OFFSET UNION UNISTR UNPIVOT UPPER USING VALIDATE_CONVERSION VALUE VALUES VAR_POP VAR_SAMP VARCHAR ' +
    'VARCHAR2 VARIANCE VSIZE WHEN WHERE WIDTH_BUCKET WITH WITHIN XMLAGG XMLELEMENT XMLFOREST XMLTABLE XMLTYPE'
  ).split(' '),
);
export function inspectSql(sql: string, depth = 0): DatabaseOperation[] {
  const tokens = sqlTokens(sql),
    operations: DatabaseOperation[] = [];
  const at = (i: number) => (tokens[i]?.literal ? '' : (tokens[i]?.value ?? ''));
  const objectAt = (i: number) => (at(i + 1) === '.' ? at(i) + '.' + at(i + 2) : at(i) || null);
  const add = (action: string, object: string | null, dangerous: boolean, consequence: string, extra = {}) =>
    operations.push({ action, object, dangerous, consequence, ...extra });
  // Program definitions do not execute their body at CREATE time. Inspect other
  // script units separately, including anonymous blocks after a SQLcl slash.
  const units = sql.split(/^\s*\/\s*$/m);
  if (units.length > 1) return units.flatMap((unit) => inspectSql(unit, depth));
  /** Object kind after CREATE/DROP/ALTER at `i`, skipping modifiers; returns the kind and the object position. */
  const kindAt = (i: number) => {
    let cursor = i;
    while (kindModifiers.has(at(cursor))) cursor++;
    let kind = at(cursor);
    if (!/^[A-Z]/.test(kind)) return null;
    cursor++;
    const second = compoundKinds[kind];
    if (second?.includes(at(cursor))) kind += '-' + at(cursor++);
    return { kind, cursor };
  };
  const header = tokens
    .filter((token) => !token.literal)
    .slice(0, 6)
    .map((token) => token.value);
  if (header[0] === 'CREATE') {
    const found = kindAt(1);
    if (found && programKinds.has(found.kind.split('-')[0]!))
      return [
        {
          action: 'create-program',
          object: objectAt(found.cursor),
          dangerous: true,
          consequence:
            'Creates or replaces executable database code; callers and triggers can change behavior.',
        },
      ];
  }
  const statementStart = (i: number) => i === 0 || at(i - 1) === ';' || at(i - 1) === '/';
  let anonymousBlock = false;
  for (let i = 0; i < tokens.length; i++) {
    const word = at(i);
    if (word === 'EXECUTE' && at(i + 1) === 'IMMEDIATE') {
      const literal = tokens[i + 2];
      if (literal?.literal && at(i + 3) !== '|' && depth < 4)
        operations.push(...inspectSql(literal.value, depth + 1));
      else
        add(
          'dynamic-sql',
          null,
          true,
          'Dynamic SQL cannot be resolved statically; review the complete script.',
        );
    } else if ((word === 'EXEC' || word === 'EXECUTE') && statementStart(i)) {
      // SQLcl EXEC[UTE] shorthand runs an anonymous block.
      add(
        'plsql-block',
        null,
        true,
        'Executes a database block or routine; review its data and schema effects.',
      );
    } else if ((word === 'DECLARE' || word === 'BEGIN') && statementStart(i)) {
      // Any anonymous block executes code; calls in assignments or expressions are not resolved statically.
      anonymousBlock = true;
    } else if (word === 'DROP') {
      const found = kindAt(i + 1);
      add(
        'drop-' + (found?.kind.toLowerCase() ?? 'object'),
        found ? objectAt(found.cursor) : null,
        true,
        'Removes the database object; dependent code can become invalid. Dropping a table removes its data and constraints.',
      );
    } else if (word === 'TRUNCATE' && ['TABLE', 'CLUSTER'].includes(at(i + 1))) {
      add(
        'truncate-' + at(i + 1).toLowerCase(),
        objectAt(i + 2),
        true,
        'Removes all table rows with DDL commit semantics; application metadata backup does not restore data.',
      );
    } else if (word === 'ALTER' && at(i + 1) === 'TABLE') {
      const object = objectAt(i + 2),
        cursor = at(i + 3) === '.' ? i + 5 : i + 3;
      if (at(cursor) === 'RENAME' && at(cursor + 1) === 'COLUMN')
        add(
          'rename-column',
          object,
          true,
          'Renames the column; dependent SQL, views, constraints and application queries must be updated.',
          { column: at(cursor + 2), renamedTo: at(cursor + 4) },
        );
      else
        add(
          'alter-table',
          object,
          true,
          'Changes the table definition; inspect constraints, stored data and dependent application queries.',
        );
    } else if (word === 'RENAME') {
      if (at(i - 1) !== 'TABLE' && at(i + 1) !== 'COLUMN')
        add(
          'rename-object',
          objectAt(i + 1),
          true,
          'Renames an object; dependent references require review.',
        );
    } else if (['INSERT', 'UPDATE', 'DELETE', 'MERGE'].includes(word)) {
      const cursor = ['INTO', 'FROM'].includes(at(i + 1)) ? i + 2 : i + 1;
      add(
        word.toLowerCase(),
        objectAt(cursor),
        true,
        'Mutates business data; an APEX application backup does not restore affected rows.',
      );
    } else if (
      ['GRANT', 'REVOKE', 'AUDIT', 'NOAUDIT', 'ADMINISTER'].includes(word) ||
      (word === 'ALTER' && ['USER', 'SYSTEM', 'DATABASE', 'SESSION', 'PROFILE', 'ROLE'].includes(at(i + 1)))
    ) {
      add(
        'privileged-sql',
        null,
        true,
        'Changes database privileges, session context or administration settings.',
      );
    } else if (word === 'ALTER' && statementStart(i)) {
      const found = kindAt(i + 1);
      add(
        'alter-' + (found?.kind.toLowerCase() ?? 'object'),
        found ? objectAt(found.cursor) : null,
        true,
        'Changes an existing database object; dependent code, triggers or constraints can change behavior.',
      );
    } else if (['PURGE', 'FLASHBACK'].includes(word) && statementStart(i)) {
      add(
        word.toLowerCase(),
        null,
        true,
        'Permanently removes or rewinds database objects; review the affected data.',
      );
    } else if (word === 'CREATE' && statementStart(i)) {
      const found = kindAt(i + 1);
      const replaces = at(i + 1) === 'OR' && at(i + 2) === 'REPLACE';
      if (!found) continue;
      const kind = found.kind.toLowerCase();
      if (programKinds.has(found.kind.split('-')[0]!))
        add(
          'create-program',
          objectAt(found.cursor),
          true,
          'Creates or replaces executable database code; callers and triggers can change behavior.',
        );
      else if (plainCreateKinds.has(found.kind))
        add(
          'create-' + kind,
          objectAt(found.cursor),
          replaces,
          replaces
            ? 'Replaces an existing database object; dependent queries and code can change behavior.'
            : 'Creates a database object in the reviewed application schema.',
        );
      else
        add(
          'create-' + kind,
          objectAt(found.cursor),
          true,
          'Creates a privileged or executable database object (users, roles, links, jobs, directories, contexts); review its scope.',
        );
    } else if ((word === 'SELECT' || word === 'WITH') && statementStart(i)) {
      // A query can invoke user-defined functions with side effects.
      let j = i;
      for (; j < tokens.length && at(j) !== ';'; j++) {
        if (tokens[j]!.literal || at(j + 1) !== '(' || !/^[A-Z][\w$#]*$/.test(at(j))) continue;
        const qualified = at(j - 1) === '.';
        if (qualified || !queryBuiltins.has(at(j))) {
          add(
            'query-routine-call',
            qualified ? at(j - 2) + '.' + at(j) : at(j),
            true,
            'Queries a user-defined routine; functions can perform autonomous data or schema changes.',
          );
          break;
        }
      }
    }
  }
  const controlWords = new Set([
    'NULL',
    'EXIT',
    'RETURN',
    'END',
    'LOOP',
    'IF',
    'WHILE',
    'FOR',
    'RAISE',
    'CONTINUE',
  ]);
  const routineCall = tokens.some(
    (token, i) =>
      !token.literal &&
      (token.value === 'CALL' ||
        (!controlWords.has(token.value) &&
          /^[A-Z][\w$#]*$/.test(token.value) &&
          ['BEGIN', ';', 'THEN', 'ELSE', 'LOOP'].includes(at(i - 1)) &&
          ['.', '(', ';'].includes(at(i + 1)))),
  );
  // A block whose only words are PL/SQL control syntax (begin null; end;) executes nothing.
  const harmlessBlockWords = new Set([
    ...controlWords,
    'DECLARE',
    'BEGIN',
    'EXCEPTION',
    'WHEN',
    'OTHERS',
    'THEN',
    'ELSE',
    'ELSIF',
    'IS',
    'NOT',
    'AND',
    'OR',
    'TRUE',
    'FALSE',
  ]);
  const executableBlock =
    anonymousBlock &&
    tokens.some(
      (token) => !token.literal && /^[A-Z][\w$#]*$/.test(token.value) && !harmlessBlockWords.has(token.value),
    );
  if (routineCall || executableBlock)
    add(
      'plsql-block',
      null,
      true,
      'Executes a database block or routine; review its data and schema effects.',
    );
  return operations.filter(
    (operation, i) =>
      operations.findIndex((other) => JSON.stringify(other) === JSON.stringify(operation)) === i,
  );
}
