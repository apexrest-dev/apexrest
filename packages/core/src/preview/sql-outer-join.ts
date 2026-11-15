/**
 * Oracle outer joins written with `(+)`:
 *
 *   select ... from emp e, emp m, dept d where e.mgr = m.empno (+) and e.deptno = d.deptno (+)
 *
 * become ANSI joins that SQLite understands:
 *
 *   select ... from emp e left join emp m on e.mgr = m.empno left join dept d on e.deptno = d.deptno
 *
 * Each query block is rewritten on its own, subqueries first. Conditions with `(+)` move into the
 * ON clause of the table that carries the marker; the other conditions stay in WHERE. A block the
 * rewrite cannot express safely (ANSI joins already present, a marker on an unqualified column,
 * markers on two tables in one condition) is left as written. Literals must already be masked.
 */

const BOUNDARY =
  /^(?:group\s+by|order\s+by|having|union|intersect|minus|except|connect\s+by|start\s+with|fetch|offset|window|limit|for\s+update|model)\b/iu;

/** Indexes of top-level occurrences of `pattern` (outside parentheses). */
function topLevel(text: string, pattern: RegExp): { index: number; length: number }[] {
  const found: { index: number; length: number }[] = [];
  // A keyword starts a word; punctuation (`,`) may follow anything.
  const word = /^\^?[a-z(]/iu.test(pattern.source.replace(/^\^\(\?:/u, '^'));
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (depth === 0 && (!word || index === 0 || /[\s,)]/u.test(text[index - 1]!))) {
      const match = pattern.exec(text.slice(index));
      if (match && match.index === 0) {
        found.push({ index, length: match[0].length });
        index += match[0].length - 1;
      }
    }
  }
  return found;
}

function splitTop(text: string, separator: RegExp): string[] {
  const parts: string[] = [];
  let last = 0;
  for (const hit of topLevel(text, separator)) {
    parts.push(text.slice(last, hit.index));
    last = hit.index + hit.length;
  }
  parts.push(text.slice(last));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** Splits WHERE on top-level AND, keeping `between x and y` together. */
function conjuncts(where: string): string[] {
  const raw = splitTop(where, /^and\b/iu);
  const out: string[] = [];
  for (const part of raw) {
    const previous = out.at(-1);
    if (previous && /\bbetween\s+[^]*$/iu.test(previous) && !/\bbetween\s+[^]*\band\b/iu.test(previous))
      out[out.length - 1] = `${previous} and ${part}`;
    else out.push(part);
  }
  return out;
}

function aliasOf(item: string): string | undefined {
  const words = item
    .replace(/\s+as\s+/iu, ' ')
    .trim()
    .split(/\s+/u);
  const last = words.at(-1);
  if (!last) return undefined;
  if (words.length === 1) return last.replace(/^.*\./u, '').replaceAll('"', '').toLowerCase();
  return last.replaceAll('"', '').toLowerCase();
}

function rewriteBlock(block: string): string {
  if (!block.includes('(+)')) return block;
  const froms = topLevel(block, /^from\b/iu);
  if (froms.length !== 1) return block;
  const from = froms[0]!;
  const afterFrom = block.slice(from.index + from.length);
  const where = topLevel(afterFrom, /^where\b/iu)[0];
  const boundary = topLevel(afterFrom, BOUNDARY)[0];
  const fromEnd = where?.index ?? boundary?.index ?? afterFrom.length;
  const items = splitTop(afterFrom.slice(0, fromEnd), /^,/u);
  if (!where || items.some((item) => /\bjoin\b/iu.test(item))) return block;
  const whereEnd = boundary && boundary.index > where.index ? boundary.index : afterFrom.length;
  const conditions = conjuncts(afterFrom.slice(where.index + where.length, whereEnd));
  const aliases = items.map(aliasOf);
  const outer = new Map<string, string[]>();
  const kept: string[] = [];
  for (const condition of conditions) {
    if (!condition.includes('(+)')) {
      kept.push(condition);
      continue;
    }
    const marked = [...condition.matchAll(/(?:"?([\w$#]+)"?\s*\.\s*)?"?[\w$#]+"?\s*\(\+\)/gu)].map((match) =>
      match[1]?.toLowerCase(),
    );
    const owners = new Set(marked);
    if (owners.size !== 1 || owners.has(undefined)) return block;
    const owner = [...owners][0]!;
    if (!aliases.includes(owner)) return block;
    outer.set(owner, [...(outer.get(owner) ?? []), condition.replaceAll(/\s*\(\+\)/gu, '')]);
  }
  const inner = items.filter((_item, index) => !outer.has(aliases[index]!));
  if (!inner.length) return block;
  const joined = [
    inner.join(', '),
    ...items
      .map((item, index) => ({ item, alias: aliases[index]! }))
      .filter((entry) => outer.has(entry.alias))
      .map((entry) => `left join ${entry.item} on ${outer.get(entry.alias)!.join(' and ')}`),
  ].join(' ');
  const rest = afterFrom.slice(whereEnd);
  return `${block.slice(0, from.index + from.length)} ${joined}${kept.length ? ` where ${kept.join(' and ')}` : ''}${rest ? ` ${rest.trimStart()}` : ''}`;
}

/** Rewrites every query block, innermost first. */
export function rewriteOuterJoins(text: string): string {
  if (!text.includes('(+)')) return text;
  let out = '';
  let index = 0;
  while (index < text.length) {
    const char = text[index]!;
    if (char !== '(') {
      out += char;
      index += 1;
      continue;
    }
    let depth = 0;
    let close = index;
    for (; close < text.length; close += 1) {
      if (text[close] === '(') depth += 1;
      else if (text[close] === ')' && --depth === 0) break;
    }
    const inner = text.slice(index + 1, close);
    out += `(${/^\s*(?:select|with)\b/iu.test(inner) ? rewriteOuterJoins(inner) : inner})`;
    index = close + 1;
  }
  // Top level: each UNION branch is its own block.
  const branches = topLevel(out, /^(?:union\s+all|union|intersect|minus|except)\b/iu);
  if (!branches.length) return rewriteBlock(out);
  let result = '';
  let last = 0;
  for (const branch of branches) {
    result += `${rewriteBlock(out.slice(last, branch.index))} ${out.slice(branch.index, branch.index + branch.length)} `;
    last = branch.index + branch.length;
  }
  return result + rewriteBlock(out.slice(last));
}
