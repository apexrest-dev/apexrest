/**
 * Lexer and parser for the PL/SQL subset the local preview interprets.
 * Expressions are kept as token slices; the interpreter translates them to SQLite.
 */

export interface Token {
  kind: 'word' | 'bind' | 'string' | 'number' | 'op' | 'qident';
  /** Source text (string literals normalized to '...' form). */
  text: string;
  /** Lowercased word, uppercased bind name, string content, or operator. */
  value: string;
  /** Whitespace and comments before the token. */
  pre: string;
  line: number;
}

export class PlsqlSyntaxError extends Error {
  readonly line: number;
  constructor(message: string, line: number) {
    super(message);
    this.line = line;
  }
}

const TWO_CHAR_OPS = new Set([':=', '=>', '..', '||', '<=', '>=', '<>', '!=', '<<', '>>', '**', '~=', '^=']);
const Q_CLOSE: Record<string, string> = { '[': ']', '{': '}', '(': ')', '<': '>' };

export function lex(src: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let gapStart = 0;
  const push = (kind: Token['kind'], text: string, value: string, start: number, end: number) => {
    tokens.push({ kind, text, value, pre: src.slice(gapStart, start), line });
    for (const char of src.slice(start, end)) if (char === '\n') line += 1;
    index = end;
    gapStart = end;
  };
  while (index < src.length) {
    const char = src[index]!;
    const next = src[index + 1] ?? '';
    if (char === '\n') {
      line += 1;
      index += 1;
      continue;
    }
    if (/\s/u.test(char)) {
      index += 1;
      continue;
    }
    if (char === '-' && next === '-') {
      const end = src.indexOf('\n', index);
      index = end < 0 ? src.length : end;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = src.indexOf('*/', index + 2);
      const stop = end < 0 ? src.length : end + 2;
      for (const c of src.slice(index, stop)) if (c === '\n') line += 1;
      index = stop;
      continue;
    }
    const start = index;
    if ((char === 'q' || char === 'Q') && next === "'") {
      const open = src[index + 2] ?? '';
      const close = Q_CLOSE[open] ?? open;
      const end = src.indexOf(`${close}'`, index + 3);
      if (end < 0) throw new PlsqlSyntaxError('Unterminated q-quoted string', line);
      const value = src.slice(index + 3, end);
      push('string', `'${value.replaceAll("'", "''")}'`, value, start, end + 2);
      continue;
    }
    if (char === "'") {
      let cursor = index + 1;
      let value = '';
      for (;;) {
        if (cursor >= src.length) throw new PlsqlSyntaxError('Unterminated string literal', line);
        if (src[cursor] === "'") {
          if (src[cursor + 1] === "'") {
            value += "'";
            cursor += 2;
            continue;
          }
          break;
        }
        value += src[cursor];
        cursor += 1;
      }
      push('string', src.slice(start, cursor + 1), value, start, cursor + 1);
      continue;
    }
    if (char === '"') {
      const end = src.indexOf('"', index + 1);
      if (end < 0) throw new PlsqlSyntaxError('Unterminated quoted identifier', line);
      push('qident', src.slice(start, end + 1), src.slice(start + 1, end), start, end + 1);
      continue;
    }
    if (/\d/u.test(char) || (char === '.' && /\d/u.test(next))) {
      const match = /^(?:\d+(?:\.(?!\.)\d*)?|\.\d+)(?:[eE][+-]?\d+)?[fFdD]?/u.exec(src.slice(index))!;
      const text = match[0].replace(/[fFdD]$/u, '');
      push('number', text, text, start, start + match[0].length);
      continue;
    }
    if (char === ':' && /[A-Za-z]/u.test(next)) {
      const match = /^:[A-Za-z][\w$#]*/u.exec(src.slice(index))!;
      push('bind', match[0], match[0].slice(1).toUpperCase(), start, start + match[0].length);
      continue;
    }
    if (/[A-Za-z_]/u.test(char)) {
      const match = /^[A-Za-z_][\w$#]*/u.exec(src.slice(index))!;
      push('word', match[0], match[0].toLowerCase(), start, start + match[0].length);
      continue;
    }
    const two = src.slice(index, index + 2);
    if (TWO_CHAR_OPS.has(two)) {
      push('op', two, two, start, start + 2);
      continue;
    }
    push('op', char, char, start, start + 1);
  }
  return tokens;
}

export const tokenText = (tokens: Token[]): string =>
  tokens
    .map((token, index) => (index === 0 ? '' : token.pre) + token.text)
    .join('')
    .trim();

// ------------------------------------------------------------------ AST

export type Expr = Token[];

export type Target =
  | { kind: 'bind'; name: string }
  | { kind: 'var'; name: string; field?: string; index?: Expr }
  | { kind: 'global'; name: string };

export interface Arg {
  name?: string;
  expr: Expr;
}

export interface Param {
  name: string;
  mode: 'in' | 'out' | 'in out';
  type: string;
  init?: Expr;
}

export type Decl =
  | { kind: 'var'; name: string; type: string; constant: boolean; init?: Expr; line: number }
  | { kind: 'cursor'; name: string; params: Param[]; sql: Expr; line: number }
  | { kind: 'exception'; name: string }
  | { kind: 'type'; name: string; collection: boolean }
  | { kind: 'routine'; routine: Routine };

export interface Routine {
  name: string;
  params: Param[];
  isFunction: boolean;
  block: Block;
}

export interface Handler {
  names: string[];
  body: Stmt[];
}

export interface Block {
  decls: Decl[];
  body: Stmt[];
  handlers: Handler[];
  label?: string;
}

export type Stmt = { line: number } & (
  | { k: 'null' }
  | { k: 'assign'; target: Target; expr: Expr }
  | { k: 'if'; branches: { cond: Expr; body: Stmt[] }[]; otherwise?: Stmt[] }
  | { k: 'case'; selector?: Expr; whens: { expr: Expr; body: Stmt[] }[]; otherwise?: Stmt[] }
  | { k: 'loop'; body: Stmt[]; label?: string }
  | { k: 'while'; cond: Expr; body: Stmt[]; label?: string }
  | { k: 'forRange'; name: string; reverse: boolean; from: Expr; to: Expr; body: Stmt[]; label?: string }
  | { k: 'forQuery'; name: string; sql?: Expr; cursor?: string; args?: Arg[]; body: Stmt[]; label?: string }
  | { k: 'exit' | 'continue'; when?: Expr; label?: string }
  | { k: 'return'; expr?: Expr }
  | { k: 'raise'; name?: string }
  | { k: 'selectInto'; sql: Expr; targets: Target[]; bulk: boolean }
  | { k: 'dml'; sql: Expr; targets?: Target[] }
  | { k: 'call'; name: string[]; args: Arg[] }
  | { k: 'block'; block: Block }
  | { k: 'noop' }
  | { k: 'tx'; op: 'commit' | 'rollback' | 'savepoint'; savepoint?: string }
  | { k: 'unsupported'; what: string }
);

const BLOCK_END = new Set(['end', 'elsif', 'else', 'when', 'exception']);

const isWord = (token: Token | undefined, ...words: string[]) =>
  token?.kind === 'word' && words.includes(token.value);
const isOp = (token: Token | undefined, ...ops: string[]) =>
  token?.kind === 'op' && ops.includes(token.value);

/** Splits tokens on top-level commas (outside parentheses). */
export function splitTopLevel(tokens: Token[], separator = ','): Token[][] {
  const parts: Token[][] = [[]];
  let depth = 0;
  for (const token of tokens) {
    if (isOp(token, '(')) depth += 1;
    if (isOp(token, ')')) depth -= 1;
    if (depth === 0 && isOp(token, separator)) parts.push([]);
    else parts.at(-1)!.push(token);
  }
  return parts.filter((part, index) => part.length || index < parts.length - 1);
}

export function parseArgs(tokens: Token[]): Arg[] {
  if (!tokens.length) return [];
  return splitTopLevel(tokens).map((part) =>
    part[0]?.kind === 'word' && isOp(part[1], '=>')
      ? { name: part[0].value, expr: part.slice(2) }
      : { expr: part },
  );
}

/** Index of the parenthesis matching the `(` at `open`. */
export function matchParen(tokens: Token[], open: number): number {
  let depth = 0;
  for (let index = open; index < tokens.length; index += 1) {
    if (isOp(tokens[index], '(')) depth += 1;
    else if (isOp(tokens[index], ')')) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new PlsqlSyntaxError('Unbalanced parentheses', tokens[open]?.line ?? 0);
}

export class Parser {
  readonly tokens: Token[];
  pos = 0;

  constructor(source: string) {
    this.tokens = lex(source.replace(/\n\s*\/\s*$/u, '\n'));
  }

  get line(): number {
    return this.peek()?.line ?? this.tokens.at(-1)?.line ?? 0;
  }

  peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  next(): Token {
    const token = this.tokens[this.pos];
    if (!token) throw new PlsqlSyntaxError('Unexpected end of code', this.line);
    this.pos += 1;
    return token;
  }

  expectWord(...words: string[]): Token {
    const token = this.next();
    if (!isWord(token, ...words))
      throw new PlsqlSyntaxError(`Expected ${words.join('/')} but found "${token.text}"`, token.line);
    return token;
  }

  expectOp(op: string): void {
    const token = this.next();
    if (!isOp(token, op))
      throw new PlsqlSyntaxError(`Expected "${op}" but found "${token.text}"`, token.line);
  }

  acceptWord(...words: string[]): boolean {
    if (!isWord(this.peek(), ...words)) return false;
    this.pos += 1;
    return true;
  }

  acceptOp(op: string): boolean {
    if (!isOp(this.peek(), op)) return false;
    this.pos += 1;
    return true;
  }

  /** Reads an expression until `stop` matches at depth 0 (outside parentheses and CASE). */
  readUntil(stop: (token: Token) => boolean): Expr {
    const out: Token[] = [];
    let depth = 0;
    let cases = 0;
    for (;;) {
      const token = this.peek();
      if (!token) {
        if (depth || cases) throw new PlsqlSyntaxError('Unexpected end of code in expression', this.line);
        return out;
      }
      if (depth === 0 && cases === 0 && stop(token)) return out;
      if (isOp(token, '(')) depth += 1;
      else if (isOp(token, ')')) depth -= 1;
      else if (isWord(token, 'case')) cases += 1;
      else if (isWord(token, 'end') && cases > 0) cases -= 1;
      out.push(token);
      this.pos += 1;
    }
  }

  untilWord(...words: string[]): Expr {
    const expr = this.readUntil((token) => isWord(token, ...words) || isOp(token, ';'));
    if (!isWord(this.peek(), ...words)) throw new PlsqlSyntaxError(`Expected ${words.join('/')}`, this.line);
    return expr;
  }

  untilSemicolon(): Expr {
    const expr = this.readUntil((token) => isOp(token, ';'));
    this.expectOp(';');
    return expr;
  }

  /** Whole program: a statement list (APEX accepts bodies without BEGIN/END). */
  program(): Stmt[] {
    const body = this.statements(new Set());
    if (this.peek()) throw new PlsqlSyntaxError(`Unexpected "${this.peek()!.text}"`, this.line);
    return body;
  }

  block(label?: string): Block {
    const decls = this.acceptWord('declare') ? this.declarations() : [];
    this.expectWord('begin');
    const body = this.statements(BLOCK_END);
    const handlers: Handler[] = [];
    if (this.acceptWord('exception')) {
      while (this.acceptWord('when')) {
        const names = [this.next().value];
        while (this.acceptWord('or')) names.push(this.next().value);
        this.expectWord('then');
        handlers.push({ names, body: this.statements(BLOCK_END) });
      }
    }
    this.expectWord('end');
    if (this.peek()?.kind === 'word' && !isOp(this.peek(), ';')) this.pos += 1;
    return { decls, body, handlers, ...(label ? { label } : {}) };
  }

  declarations(): Decl[] {
    const decls: Decl[] = [];
    while (this.peek() && !isWord(this.peek(), 'begin')) {
      const token = this.next();
      const line = token.line;
      if (isWord(token, 'pragma', 'subtype')) {
        this.untilSemicolon();
        continue;
      }
      if (isWord(token, 'cursor')) {
        const name = this.next().value;
        const params = isOp(this.peek(), '(') ? this.params() : [];
        if (this.acceptWord('return')) this.untilWord('is');
        this.expectWord('is');
        decls.push({ kind: 'cursor', name, params, sql: this.untilSemicolon(), line });
        continue;
      }
      if (isWord(token, 'type')) {
        const name = this.next().value;
        const body = this.untilSemicolon();
        decls.push({
          kind: 'type',
          name,
          collection: body.some((part) => isWord(part, 'table', 'varray', 'varying')),
        });
        continue;
      }
      if (isWord(token, 'function', 'procedure')) {
        const routine = this.routine(token.value === 'function');
        if (routine) decls.push({ kind: 'routine', routine });
        continue;
      }
      const name = token.value;
      if (this.acceptWord('exception')) {
        this.expectOp(';');
        decls.push({ kind: 'exception', name });
        continue;
      }
      const constant = this.acceptWord('constant');
      const type = tokenText(this.readUntil((part) => isOp(part, ':=', ';') || isWord(part, 'default')));
      const init = this.acceptOp(':=') || this.acceptWord('default') ? this.untilSemicolon() : undefined;
      if (!init) this.expectOp(';');
      decls.push({ kind: 'var', name, type, constant, ...(init ? { init } : {}), line });
    }
    return decls;
  }

  params(): Param[] {
    this.expectOp('(');
    const start = this.pos;
    const close = matchParen(this.tokens, start - 1);
    const inner = this.tokens.slice(start, close);
    this.pos = close + 1;
    return splitTopLevel(inner).map((part) => {
      let index = 1;
      let mode: Param['mode'] = 'in';
      if (isWord(part[index], 'in')) index += 1;
      if (isWord(part[index], 'out')) {
        mode = index === 2 ? 'in out' : 'out';
        index += 1;
      }
      if (isWord(part[index], 'nocopy')) index += 1;
      const rest = part.slice(index);
      const split = rest.findIndex((item) => isOp(item, ':=') || isWord(item, 'default'));
      const type = tokenText(split < 0 ? rest : rest.slice(0, split));
      return {
        name: part[0]!.value,
        mode,
        type,
        ...(split >= 0 ? { init: rest.slice(split + 1) } : {}),
      };
    });
  }

  routine(isFunction: boolean): Routine | undefined {
    const name = this.next().value;
    const params = isOp(this.peek(), '(') ? this.params() : [];
    if (isFunction) {
      this.expectWord('return');
      this.readUntil((token) => isWord(token, 'is', 'as') || isOp(token, ';'));
    }
    if (this.acceptOp(';')) return undefined;
    this.expectWord('is', 'as');
    const decls = this.declarations();
    this.expectWord('begin');
    this.pos -= 1;
    const block = this.block();
    block.decls = decls;
    this.expectOp(';');
    return { name, params, isFunction, block };
  }

  statements(terminators: Set<string>): Stmt[] {
    const list: Stmt[] = [];
    for (;;) {
      const token = this.peek();
      if (!token) return list;
      if (token.kind === 'word' && terminators.has(token.value)) return list;
      list.push(this.statement());
    }
  }

  label(): string | undefined {
    if (!isOp(this.peek(), '<<')) return undefined;
    this.pos += 1;
    const name = this.next().value;
    this.expectOp('>>');
    return name;
  }

  endLoop(): void {
    this.expectWord('end');
    this.expectWord('loop');
    if (this.peek()?.kind === 'word') this.pos += 1;
    this.expectOp(';');
  }

  statement(): Stmt {
    const label = this.label();
    const token = this.peek()!;
    const line = token.line;
    if (isOp(token, ';')) {
      this.pos += 1;
      return { k: 'noop', line };
    }
    if (token.kind === 'word') {
      switch (token.value) {
        case 'declare':
        case 'begin': {
          const block = this.block(label);
          this.expectOp(';');
          return { k: 'block', block, line };
        }
        case 'null':
          if (isOp(this.peek(1), ';')) {
            this.pos += 2;
            return { k: 'null', line };
          }
          break;
        case 'if': {
          this.pos += 1;
          const branches: { cond: Expr; body: Stmt[] }[] = [];
          let otherwise: Stmt[] | undefined;
          const ends = new Set(['elsif', 'else', 'end']);
          let cond = this.untilWord('then');
          this.expectWord('then');
          branches.push({ cond, body: this.statements(ends) });
          while (this.acceptWord('elsif')) {
            cond = this.untilWord('then');
            this.expectWord('then');
            branches.push({ cond, body: this.statements(ends) });
          }
          if (this.acceptWord('else')) otherwise = this.statements(new Set(['end']));
          this.expectWord('end');
          this.expectWord('if');
          this.expectOp(';');
          return { k: 'if', branches, ...(otherwise ? { otherwise } : {}), line };
        }
        case 'case': {
          this.pos += 1;
          const selector = isWord(this.peek(), 'when') ? undefined : this.untilWord('when');
          const whens: { expr: Expr; body: Stmt[] }[] = [];
          const ends = new Set(['when', 'else', 'end']);
          while (this.acceptWord('when')) {
            const expr = this.untilWord('then');
            this.expectWord('then');
            whens.push({ expr, body: this.statements(ends) });
          }
          const otherwise = this.acceptWord('else') ? this.statements(new Set(['end'])) : undefined;
          this.expectWord('end');
          this.expectWord('case');
          if (this.peek()?.kind === 'word') this.pos += 1;
          this.expectOp(';');
          return {
            k: 'case',
            ...(selector ? { selector } : {}),
            whens,
            ...(otherwise ? { otherwise } : {}),
            line,
          };
        }
        case 'loop': {
          this.pos += 1;
          const body = this.statements(new Set(['end']));
          this.endLoop();
          return { k: 'loop', body, ...(label ? { label } : {}), line };
        }
        case 'while': {
          this.pos += 1;
          const cond = this.untilWord('loop');
          this.expectWord('loop');
          const body = this.statements(new Set(['end']));
          this.endLoop();
          return { k: 'while', cond, body, ...(label ? { label } : {}), line };
        }
        case 'for':
          return this.forLoop(label, line);
        case 'exit':
        case 'continue': {
          this.pos += 1;
          const name =
            this.peek()?.kind === 'word' && !isWord(this.peek(), 'when') ? this.next().value : undefined;
          const when = this.acceptWord('when') ? this.untilSemicolon() : undefined;
          if (!when) this.expectOp(';');
          return {
            k: token.value as 'exit' | 'continue',
            ...(when ? { when } : {}),
            ...(name ? { label: name } : {}),
            line,
          };
        }
        case 'return': {
          this.pos += 1;
          const expr = this.untilSemicolon();
          return { k: 'return', ...(expr.length ? { expr } : {}), line };
        }
        case 'raise': {
          this.pos += 1;
          const name = this.untilSemicolon();
          return {
            k: 'raise',
            ...(name.length ? { name: name.map((part) => part.value).join('.') } : {}),
            line,
          };
        }
        case 'select':
        case 'with':
          return this.selectInto(line);
        case 'insert':
        case 'update':
        case 'delete':
        case 'merge':
          return this.dml(line);
        case 'commit':
        case 'rollback':
        case 'savepoint': {
          this.pos += 1;
          const words = this.untilSemicolon()
            .filter((part) => part.kind === 'word' || part.kind === 'qident')
            .map((part) => part.value);
          const op = token.value as 'commit' | 'rollback' | 'savepoint';
          // SAVEPOINT name / ROLLBACK [WORK] TO [SAVEPOINT] name
          const to = words.indexOf('to');
          const name =
            op === 'savepoint'
              ? words[0]
              : op === 'rollback' && to >= 0
                ? words.slice(to + 1).find((word) => word !== 'savepoint')
                : undefined;
          return { k: 'tx', op, ...(name ? { savepoint: name } : {}), line };
        }
        case 'lock':
          this.untilSemicolon();
          return { k: 'noop', line };
        case 'set':
          if (isWord(this.peek(1), 'transaction')) {
            this.untilSemicolon();
            return { k: 'noop', line };
          }
          break;
        case 'execute':
        case 'open':
        case 'fetch':
        case 'close':
        case 'goto':
        case 'forall':
        case 'pipe': {
          this.untilSemicolon();
          return { k: 'unsupported', what: `${token.value.toUpperCase()} statements`, line };
        }
        default:
          break;
      }
    }
    return this.assignmentOrCall(line);
  }

  forLoop(label: string | undefined, line: number): Stmt {
    this.expectWord('for');
    const name = this.next().value;
    this.expectWord('in');
    const reverse = this.acceptWord('reverse');
    const tag = label ? { label } : {};
    if (isOp(this.peek(), '(') && isWord(this.peek(1), 'select', 'with')) {
      const close = matchParen(this.tokens, this.pos);
      const sql = this.tokens.slice(this.pos + 1, close);
      this.pos = close + 1;
      this.expectWord('loop');
      const body = this.statements(new Set(['end']));
      this.endLoop();
      return { k: 'forQuery', name, sql, body, ...tag, line };
    }
    const from = this.readUntil((token) => isOp(token, '..') || isWord(token, 'loop'));
    if (this.acceptOp('..')) {
      const to = this.untilWord('loop');
      this.expectWord('loop');
      const body = this.statements(new Set(['end']));
      this.endLoop();
      return { k: 'forRange', name, reverse, from, to, body, ...tag, line };
    }
    this.expectWord('loop');
    const cursor = from[0]?.value ?? '';
    const args = isOp(from[1], '(') ? parseArgs(from.slice(2, matchParen(from, 1))) : [];
    const body = this.statements(new Set(['end']));
    this.endLoop();
    return { k: 'forQuery', name, cursor, args, body, ...tag, line };
  }

  /** `select ... into a, b from ...` — the INTO clause is removed from the SQL. */
  selectInto(line: number): Stmt {
    const tokens = this.untilSemicolon();
    let depth = 0;
    let into = -1;
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]!;
      if (isOp(token, '(')) depth += 1;
      else if (isOp(token, ')')) depth -= 1;
      else if (depth === 0 && isWord(token, 'into')) {
        into = index;
        break;
      }
    }
    if (into < 0) throw new PlsqlSyntaxError('SELECT without INTO in PL/SQL', line);
    const bulk = isWord(tokens[into - 1], 'collect') && isWord(tokens[into - 2], 'bulk');
    let end = into + 1;
    depth = 0;
    while (end < tokens.length && !(depth === 0 && isWord(tokens[end], 'from'))) {
      if (isOp(tokens[end], '(')) depth += 1;
      if (isOp(tokens[end], ')')) depth -= 1;
      end += 1;
    }
    const targets = splitTopLevel(tokens.slice(into + 1, end)).map((part) => this.target(part));
    const head = tokens.slice(0, bulk ? into - 2 : into);
    const tail = tokens.slice(end);
    return { k: 'selectInto', sql: [...head, ...tail], targets, bulk, line };
  }

  dml(line: number): Stmt {
    const tokens = this.untilSemicolon();
    let depth = 0;
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]!;
      if (isOp(token, '(')) depth += 1;
      else if (isOp(token, ')')) depth -= 1;
      else if (depth === 0 && isWord(token, 'returning', 'return')) {
        const rest = tokens.slice(index + 1);
        const into = rest.findIndex((part) => isWord(part, 'into'));
        if (into < 0) break;
        const targets = splitTopLevel(rest.slice(into + 1)).map((part) => this.target(part));
        const returning: Token = { ...token, text: 'returning', value: 'returning' };
        return {
          k: 'dml',
          sql: [...tokens.slice(0, index), returning, ...rest.slice(0, into)],
          targets,
          line,
        };
      }
    }
    return { k: 'dml', sql: tokens, line };
  }

  target(tokens: Token[]): Target {
    const [first, second, third] = tokens;
    if (first?.kind === 'bind' && tokens.length === 1) return { kind: 'bind', name: first.value };
    if (first?.kind === 'word') {
      if (tokens.length === 1) return { kind: 'var', name: first.value };
      if (isOp(second, '.') && third && tokens.length === 3) {
        if (first.value === 'apex_application')
          return { kind: 'global', name: `${first.value}.${third.value}` };
        return { kind: 'var', name: first.value, field: third.value };
      }
      if (isOp(second, '(') && matchParen(tokens, 1) === tokens.length - 1)
        return { kind: 'var', name: first.value, index: tokens.slice(2, -1) };
    }
    throw new PlsqlSyntaxError(`Unsupported assignment target "${tokenText(tokens)}"`, first?.line ?? 0);
  }

  assignmentOrCall(line: number): Stmt {
    const tokens = this.untilSemicolon();
    let depth = 0;
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]!;
      if (isOp(token, '(')) depth += 1;
      else if (isOp(token, ')')) depth -= 1;
      else if (depth === 0 && isOp(token, ':=')) {
        return {
          k: 'assign',
          target: this.target(tokens.slice(0, index)),
          expr: tokens.slice(index + 1),
          line,
        };
      }
    }
    const name: string[] = [];
    let index = 0;
    while (tokens[index]?.kind === 'word' || tokens[index]?.kind === 'qident') {
      name.push(tokens[index]!.value.toLowerCase());
      index += 1;
      if (!isOp(tokens[index], '.')) break;
      index += 1;
    }
    if (!name.length)
      throw new PlsqlSyntaxError(`Unsupported statement "${tokenText(tokens).slice(0, 60)}"`, line);
    let args: Arg[] = [];
    if (isOp(tokens[index], '(')) {
      const close = matchParen(tokens, index);
      args = parseArgs(tokens.slice(index + 1, close));
      index = close + 1;
    }
    if (index < tokens.length)
      throw new PlsqlSyntaxError(`Unsupported statement "${tokenText(tokens).slice(0, 60)}"`, line);
    return { k: 'call', name, args, line };
  }
}

export function parseProgram(source: string): Stmt[] {
  return new Parser(source).program();
}

export function parseExpression(source: string): Expr {
  return lex(source.trim().replace(/;\s*$/u, ''));
}

export { isOp, isWord };
