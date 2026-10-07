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
      /^REM(?:ARK)?(?:[ \t]|$)/i.test(sql.slice(i))
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
  const header = tokens
    .filter((token) => !token.literal)
    .slice(0, 6)
    .map((token) => token.value);
  if (header[0] === 'CREATE') {
    let offset = header[1] === 'OR' && header[2] === 'REPLACE' ? 3 : 1;
    while (['FORCE', 'EDITIONABLE', 'NONEDITIONABLE'].includes(at(offset))) offset++;
    if (['PACKAGE', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'TYPE'].includes(header[offset] ?? '')) {
      const position = at(offset + 1) === 'BODY' ? offset + 2 : offset + 1;
      return [
        {
          action: 'create-program',
          object: objectAt(position),
          dangerous: true,
          consequence:
            'Creates or replaces executable database code; callers and triggers can change behavior.',
        },
      ];
    }
  }
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
    } else if (
      word === 'DROP' &&
      [
        'TABLE',
        'VIEW',
        'INDEX',
        'PACKAGE',
        'PROCEDURE',
        'FUNCTION',
        'TRIGGER',
        'TYPE',
        'SEQUENCE',
        'USER',
      ].includes(at(i + 1))
    ) {
      add(
        'drop-' + at(i + 1).toLowerCase(),
        objectAt(i + 2),
        true,
        'Removes the database object; dependent code can become invalid. Dropping a table removes its data and constraints.',
      );
    } else if (word === 'TRUNCATE' && at(i + 1) === 'TABLE') {
      add(
        'truncate-table',
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
      ['GRANT', 'REVOKE'].includes(word) ||
      (word === 'ALTER' && ['USER', 'SYSTEM', 'DATABASE'].includes(at(i + 1)))
    ) {
      add('privileged-sql', null, true, 'Changes database privileges or administration settings.');
    } else if (word === 'CREATE') {
      const replaces = at(i + 1) === 'OR' && at(i + 2) === 'REPLACE';
      let cursor = replaces ? i + 3 : i + 1;
      while (['FORCE', 'EDITIONABLE', 'NONEDITIONABLE', 'UNIQUE', 'BITMAP'].includes(at(cursor))) cursor++;
      if (['TABLE', 'VIEW', 'INDEX', 'SEQUENCE', 'SYNONYM', 'MATERIALIZED'].includes(at(cursor)))
        add(
          'create-' + at(cursor).toLowerCase(),
          objectAt(cursor + 1),
          replaces,
          replaces
            ? 'Replaces an existing database object; dependent queries and code can change behavior.'
            : 'Creates a database object in the reviewed application schema.',
        );
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
  if (routineCall)
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
