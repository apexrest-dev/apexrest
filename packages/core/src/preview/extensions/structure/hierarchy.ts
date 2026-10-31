/**
 * Oracle hierarchical queries (`start with … connect by prior …`) rewritten into a SQLite
 * recursive CTE. Supports `level`, `connect_by_isleaf`, `sys_connect_by_path(expr, 'sep')`,
 * `connect_by_root expr`, `nocycle` and `order siblings by`. The FROM clause must be a single
 * table, view or subquery (with an optional alias). `connect by level <= n` row generators are
 * handled by the database shims, not here.
 */

export interface HierarchyResult {
  sql: string;
  /** Set when a hierarchical query was found but could not be translated. */
  unsupported?: string;
}

const LITERAL = '\u0001';

function mask(sql: string): { text: string; literals: string[] } {
  const literals: string[] = [];
  const text = sql.replace(/'(?:[^']|'')*'/gu, (literal) => {
    literals.push(literal);
    return `${LITERAL}${literals.length - 1}${LITERAL}`;
  });
  return { text, literals };
}

function unmask(text: string, literals: string[]): string {
  return text.replace(new RegExp(`${LITERAL}(\\d+)${LITERAL}`, 'gu'), (_whole, index: string) =>
    String(literals[Number(index)]),
  );
}

/** Depth of every character position (parentheses), on masked text. */
function depths(text: string): number[] {
  const result: number[] = [];
  let depth = 0;
  for (const char of text) {
    if (char === ')') depth -= 1;
    result.push(depth);
    if (char === '(') depth += 1;
  }
  return result;
}

/** Positions of a keyword pattern at the given depth. */
function find(
  text: string,
  level: number[],
  pattern: RegExp,
  depth: number,
): { index: number; end: number }[] {
  const found: { index: number; end: number }[] = [];
  const regex = new RegExp(pattern.source, 'giu');
  for (let match = regex.exec(text); match; match = regex.exec(text)) {
    if (level[match.index] === depth) found.push({ index: match.index, end: match.index + match[0].length });
  }
  return found;
}

/** Splits on commas at depth 0 of the given fragment. */
function splitTop(fragment: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < fragment.length; index += 1) {
    const char = fragment[index];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(fragment.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(fragment.slice(start));
  return parts;
}

const CLAUSES: [string, RegExp][] = [
  ['select', /\bselect\b/],
  ['from', /\bfrom\b/],
  ['where', /\bwhere\b/],
  ['start', /\bstart\s+with\b/],
  ['connect', /\bconnect\s+by\b/],
  ['siblings', /\border\s+siblings\s+by\b/],
  ['order', /\border\s+by\b(?<!siblings\s+by)/],
  ['group', /\bgroup\s+by\b/],
  ['set', /\b(?:union|intersect|minus|except)\b/],
];

/** Rewrites one SELECT (masked text at a single nesting depth) or returns why it cannot. */
function rewriteSelect(text: string, level: number[], depth: number): string | { unsupported: string } {
  const marks: { name: string; index: number; end: number }[] = [];
  for (const [name, pattern] of CLAUSES) {
    for (const hit of find(text, level, pattern, depth)) marks.push({ name, ...hit });
  }
  // "order siblings by" also matches "order by"-less patterns; drop overlapping order marks.
  const siblings = marks.filter((mark) => mark.name === 'siblings');
  const clauses = marks
    .filter(
      (mark) =>
        !(mark.name === 'order' && siblings.some((entry) => entry.index === mark.index)) &&
        !(mark.name === 'select' && mark.index !== marks.find((entry) => entry.name === 'select')?.index),
    )
    .sort((a, b) => a.index - b.index);
  const has = (name: string) => clauses.some((mark) => mark.name === name);
  if (has('set')) return { unsupported: 'set operators around a hierarchical query' };
  if (has('group')) return { unsupported: 'GROUP BY in a hierarchical query' };
  if (!has('select') || !has('from')) return { unsupported: 'missing SELECT or FROM' };
  const body = (name: string) => {
    const index = clauses.findIndex((mark) => mark.name === name);
    if (index < 0) return undefined;
    const mark = clauses[index]!;
    const next = clauses[index + 1];
    return text.slice(mark.end, next ? next.index : text.length).trim();
  };
  const selectList = body('select')!;
  const fromClause = body('from')!;
  const whereClause = body('where');
  const startWith = body('start');
  let connect = body('connect')!;
  const orderSiblings = body('siblings');
  if (/^distinct\b/iu.test(selectList)) return { unsupported: 'SELECT DISTINCT in a hierarchical query' };

  // FROM: one table/view/subquery with an optional alias.
  if (splitTop(fromClause).length > 1 || /\bjoin\b/iu.test(fromClause.replace(/\([^]*\)/gu, '')))
    return { unsupported: 'joins in a hierarchical query' };
  const fromMatch =
    /^(\([^]*\)|"[^"]+"(?:\."[^"]+")?|[\w$#]+(?:\.[\w$#]+)?)(?:\s+(?:as\s+)?("?[\w$#]+"?))?$/iu.exec(
      fromClause,
    );
  if (!fromMatch) return { unsupported: `FROM clause "${fromClause}"` };
  const source = fromMatch[1]!;
  const alias = fromMatch[2] ?? (source.startsWith('(') ? '"__T"' : source.split('.').at(-1)!);

  // CONNECT BY [NOCYCLE] PRIOR parent = child | child = PRIOR parent
  connect = connect.replace(/^nocycle\s+/iu, '');
  const prior = /^prior\s+([^=]+?)\s*=\s*([^=]+)$/iu.exec(connect) ?? undefined;
  const reverse = prior ? undefined : /^([^=]+?)\s*=\s*prior\s+([^=]+)$/iu.exec(connect);
  if (!prior && !reverse) return { unsupported: `CONNECT BY condition "${connect}"` };
  const parentKey = (prior ? prior[1] : reverse![2])!.trim();
  const childKey = (prior ? prior[2] : reverse![1])!.trim();
  if (/\b(?:and|or|prior)\b/iu.test(parentKey) || /\b(?:and|or|prior)\b/iu.test(childKey))
    return { unsupported: `CONNECT BY condition "${connect}"` };

  // Pseudo-columns. Paths and roots are carried through the recursion.
  const extras: string[] = [];
  const carried: { column: string; anchor: string; step: string }[] = [];
  const extra = (expression: string) => {
    extras.push(expression);
    return `"__X${extras.length}"`;
  };
  const replacePseudo = (fragment: string) =>
    fragment
      .replace(
        /\bsys_connect_by_path\s*\(\s*((?:[^(),]|\([^()]*\))+?)\s*,\s*(\u0001\d+\u0001)\s*\)/giu,
        (_whole, expression: string, separator: string) => {
          const column = extra(expression);
          const name = `"__CP${carried.length + 1}"`;
          carried.push({
            column: name,
            anchor: `${separator} || coalesce(s.${column}, '')`,
            step: `h.${name} || ${separator} || coalesce(c.${column}, '')`,
          });
          return `"__H".${name}`;
        },
      )
      .replace(
        /\bconnect_by_root\s+((?:"[^"]+"|[\w$#]+)(?:\.(?:"[^"]+"|[\w$#]+))?)/giu,
        (_whole, expression: string) => {
          const column = extra(expression);
          const name = `"__CR${carried.length + 1}"`;
          carried.push({ column: name, anchor: `s.${column}`, step: `h.${name}` });
          return `"__H".${name}`;
        },
      )
      .replace(
        /(?<![.\w$#"])connect_by_isleaf\b/giu,
        `(case when exists (select 1 from "__SRC" "__K" where "__K"."__C" = "__H"."__P") then 0 else 1 end)`,
      )
      .replace(/\bconnect_by_iscycle\b/giu, '0')
      .replace(/(?<![.\w$#"])level\b(?!\s*\()/giu, '"__H"."__LVL"');
  if (/\bprior\b/iu.test(selectList)) return { unsupported: 'PRIOR in the select list' };
  const columns = splitTop(selectList)
    .map((item) => {
      const trimmed = item.trim();
      const bare = /^(level|connect_by_isleaf)$/iu.exec(trimmed)?.[1];
      const replaced = replacePseudo(trimmed);
      if (bare) return `${replaced} as "${bare.toUpperCase()}"`;
      if (trimmed === '*') return `${alias}.*`;
      return replaced;
    })
    .join(', ');
  const where = whereClause ? replacePseudo(whereClause) : '';
  const siblingOrder = orderSiblings || '(select null)';
  const startCondition = startWith ? `case when (${startWith}) then 1 else 0 end` : '1';
  const extraColumns = extras.map((expression, index) => `, (${expression}) as "__X${index + 1}"`).join('');
  const carriedColumns = carried.map((entry) => `, ${entry.column}`).join('');
  const segment = (rank: string, row: string) => `printf('%08d%08d', ${rank}, ${row})`;
  const sql =
    `with recursive "__SRC" as materialized (select ${alias}.*, row_number() over () as "__RID", (${parentKey}) as "__P", (${childKey}) as "__C", ${startCondition} as "__S", ` +
    `row_number() over (partition by (${childKey}) order by ${siblingOrder}) as "__SIB"${extraColumns} from ${source} ${alias}), ` +
    `"__H" ("__RID", "__P", "__LVL", "__PATH"${carriedColumns}) as (` +
    `select s."__RID", s."__P", 1, ${segment(`row_number() over (order by ${siblingOrder})`, 's."__RID"')}${carried.map((entry) => `, ${entry.anchor}`).join('')} from "__SRC" s where s."__S" = 1 ` +
    `union all select c."__RID", c."__P", h."__LVL" + 1, h."__PATH" || '.' || ${segment('c."__SIB"', 'c."__RID"')}${carried.map((entry) => `, ${entry.step}`).join('')} ` +
    `from "__SRC" c join "__H" h on c."__C" = h."__P" where h."__LVL" < 64) ` +
    `select ${columns} from "__SRC" ${alias} join "__H" on "__H"."__RID" = ${alias}."__RID"${where ? ` where ${where}` : ''} order by "__H"."__PATH"`;
  // The anchor reads "__SRC" as s: sibling order written against the original alias moves there.
  return sql.replaceAll(
    `over (order by ${siblingOrder})`,
    `over (order by ${requalify(siblingOrder, alias, 's')})`,
  );
}

/** Order expressions in the anchor read "__SRC" s; rewrite `alias.column` to `s.column`. */
function requalify(expression: string, alias: string, to: string): string {
  const bare = alias.replaceAll('"', '');
  return expression.replace(new RegExp(`(^|[^\\w$#."])"?${bare}"?\\.`, 'giu'), `$1${to}.`);
}

/**
 * Translates every hierarchical SELECT in `sql` (top level or inside parentheses).
 * Returns the input unchanged when there is no `connect by prior`.
 */
export function translateHierarchy(sql: string): HierarchyResult {
  const masked = mask(sql);
  let text = masked.text;
  if (!/\bconnect\s+by\b(?!\s+(?:level|rownum)\b)/iu.test(text)) return { sql };
  for (let guard = 0; guard < 8; guard += 1) {
    const level = depths(text);
    const match = /\bconnect\s+by\b(?!\s+(?:level|rownum)\b)/iu.exec(text);
    if (!match) break;
    const depth = level[match.index]!;
    // Bounds of the enclosing SELECT: the parenthesis that opens this depth, or the whole text.
    let start = 0;
    let end = text.length;
    if (depth > 0) {
      for (let index = match.index; index >= 0; index -= 1) {
        if (text[index] === '(' && level[index] === depth - 1) {
          start = index + 1;
          break;
        }
      }
      for (let index = match.index; index < text.length; index += 1) {
        if (text[index] === ')' && level[index] === depth - 1) {
          end = index;
          break;
        }
      }
    }
    const fragment = text.slice(start, end);
    const fragmentLevel = level.slice(start, end);
    const rewritten = rewriteSelect(fragment, fragmentLevel, depth);
    if (typeof rewritten !== 'string') return { sql, unsupported: rewritten.unsupported };
    text = text.slice(0, start) + rewritten + text.slice(end);
  }
  return { sql: unmask(text, masked.literals) };
}
