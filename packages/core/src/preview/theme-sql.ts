/**
 * Extracts Universal Theme definitions from the APEX installation export
 * (`core/themes/f8842.<version>.sql`). The export is a sequence of PL/SQL calls such as
 * `wwv_flow_imp_shared.create_plug_template(p_static_id=>'standard', p_template=>...)`.
 * Only literal arguments are evaluated; anything that needs a database becomes undefined.
 */

export type SqlValue = string | number | boolean | null | undefined | SqlValue[];

export interface ThemeCall {
  kind: string;
  params: Record<string, SqlValue>;
}

const FUNCTIONS: Record<string, (args: SqlValue[]) => SqlValue> = {
  'wwv_flow_string.join': (args) =>
    Array.isArray(args[0]) ? args[0].map((item) => item ?? '').join('\n') : args[0],
  wwv_flow_t_varchar2: (args) => args,
  'wwv_flow_imp.id': (args) => (args[0] === undefined || args[0] === null ? undefined : String(args[0])),
  nvl: (args) => args[0] ?? args[1],
};

class Parser {
  #text: string;
  #index = 0;

  constructor(text: string) {
    this.#text = text;
  }

  get done(): boolean {
    return this.#index >= this.#text.length;
  }

  skipSpace(): void {
    while (!this.done) {
      const char = this.#text[this.#index]!;
      if (/\s/u.test(char)) this.#index += 1;
      else if (this.#text.startsWith('--', this.#index)) {
        const end = this.#text.indexOf('\n', this.#index);
        this.#index = end === -1 ? this.#text.length : end + 1;
      } else break;
    }
  }

  peek(token: string): boolean {
    this.skipSpace();
    return this.#text.startsWith(token, this.#index);
  }

  take(token: string): boolean {
    if (!this.peek(token)) return false;
    this.#index += token.length;
    return true;
  }

  expect(token: string): void {
    if (!this.take(token)) throw new Error(`Expected "${token}" at offset ${this.#index}`);
  }

  identifier(): string {
    this.skipSpace();
    const match = /^[A-Za-z_][\w$#.]*/u.exec(this.#text.slice(this.#index, this.#index + 200));
    if (!match) throw new Error(`Expected identifier at offset ${this.#index}`);
    this.#index += match[0].length;
    return match[0];
  }

  string(): string {
    this.expect("'");
    let value = '';
    for (;;) {
      const end = this.#text.indexOf("'", this.#index);
      if (end === -1) throw new Error('Unterminated SQL string');
      value += this.#text.slice(this.#index, end);
      this.#index = end + 1;
      if (this.#text[this.#index] === "'") {
        value += "'";
        this.#index += 1;
      } else return value;
    }
  }

  primary(): SqlValue {
    this.skipSpace();
    if (this.peek("'")) return this.string();
    const numberMatch = /^-?\d+(?:\.\d+)?/u.exec(this.#text.slice(this.#index, this.#index + 64));
    if (numberMatch) {
      this.#index += numberMatch[0].length;
      const value = Number(numberMatch[0]);
      // Component IDs exceed 2^53; keep them exact.
      return Number.isSafeInteger(value) || numberMatch[0].includes('.') ? value : numberMatch[0];
    }
    if (this.take('(')) {
      const value = this.expression();
      this.expect(')');
      return value;
    }
    const name = this.identifier();
    const lower = name.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    if (lower === 'null') return null;
    if (!this.take('(')) return undefined;
    const args: SqlValue[] = [];
    if (!this.take(')')) {
      do {
        // Named arguments inside nested calls are evaluated positionally.
        if (/^\s*[A-Za-z_]\w*\s*=>/u.test(this.#text.slice(this.#index, this.#index + 80))) {
          this.identifier();
          this.expect('=>');
        }
        args.push(this.expression());
      } while (this.take(','));
      this.expect(')');
    }
    return FUNCTIONS[lower]?.(args);
  }

  expression(): SqlValue {
    let value = this.primary();
    while (this.take('||')) {
      const right = this.primary();
      value = `${value ?? ''}${right ?? ''}`;
    }
    return value;
  }

  /** `p_a=>expr, p_b=>expr )` */
  namedArguments(): Record<string, SqlValue> {
    const params: Record<string, SqlValue> = {};
    if (this.take(')')) return params;
    do {
      const name = this.identifier().toLowerCase().replace(/^p_/u, '');
      this.expect('=>');
      params[name] = this.expression();
    } while (this.take(','));
    this.expect(')');
    return params;
  }

  seek(pattern: RegExp): RegExpExecArray | null {
    pattern.lastIndex = this.#index;
    const match = pattern.exec(this.#text);
    if (match) this.#index = match.index + match[0].length;
    else this.#index = this.#text.length;
    return match;
  }
}

/** Every `wwv_flow_imp_shared.create_*` call with literal-evaluated parameters. */
export function parseThemeSql(sql: string): ThemeCall[] {
  const parser = new Parser(sql);
  const calls: ThemeCall[] = [];
  const start = /wwv_flow_imp_shared\.(create_\w+)\s*\(/gu;
  for (;;) {
    const match = parser.seek(start);
    if (!match) break;
    try {
      calls.push({ kind: match[1]!.replace(/^create_/u, ''), params: parser.namedArguments() });
    } catch {
      // A construct this evaluator does not understand only costs that one call.
    }
  }
  return calls;
}
