/**
 * APEX template directives, after `apex.util.applyTemplate` (libraries/apex/util.js, 26.2):
 *
 * - `#NAME#`, `#NAME!HTML|ATTR|RAW|STRIPHTML|JS|URL#` placeholders
 * - `{if [!][?|=]NAME[%assigned]/}` … `{elseif …/}` (also `{elsif …/}`) … `{else/}` … `{endif/}`
 * - `{case NAME/}{when VALUE/}…{otherwise/}…{endcase/}`
 * - `{loop ["SEP"] NAME/}` … `&APEX$ITEM.` / `#APEX$ITEM#`, `&APEX$I.` / `#APEX$I#` … `{endloop/}`
 * - `{with/} ARG:=value … {apply TEMPLATE_NAME/}` named-template composition
 * - `{!comment/}` and `{{/}` (a literal `{`)
 *
 * Truthiness follows the client implementation: a plain test is false for empty values and
 * FALSE/F/f/N/n/0; `?` only tests for a non-empty value; `=` only tests the false values.
 */

export type EscapeMode = 'HTML' | 'ATTR' | 'RAW' | 'STRIPHTML' | 'JS' | 'URL';

export interface FormalArgument {
  name: string;
  escape?: EscapeMode | undefined;
  default?: string | undefined;
}

/** A template callable through `{apply NAME/}`, e.g. `THEME$BADGE`. */
export interface NamedTemplate {
  template: string;
  args: FormalArgument[];
  defaultEscape?: EscapeMode | undefined;
}

export interface TemplateOptions {
  /** Resolve `#NAME#` placeholders. When false only directives (and loop variables) are processed. */
  placeholders?: boolean;
  /** Escape mode by placeholder name for placeholders without an explicit `!FILTER`. */
  escapes?: Record<string, EscapeMode>;
  /** Escape mode for other placeholders; false inserts raw values. Default HTML. */
  defaultEscape?: EscapeMode | false;
  /** Lookup for `{apply NAME/}`. Defaults to the templates registered with `registerNamedTemplates`. */
  templates?: (name: string) => NamedTemplate | undefined;
  /** Remove placeholders that have no value (true, as APEX drops unused template positions) or keep them. */
  removeUnknown?: boolean;
  /** Called for template mistakes APEX would log with apex.debug. */
  warn?: (message: string) => void;
}

const FALSE_VALUES = new Set(['FALSE', 'F', 'f', 'N', 'n', '0', 'false']);

const TOKEN_RE = /#([_$A-Z0-9]+)(?:!([A-Z]+))?#|\{([iIcClLeEoOwWaA{!](?:[^/\r\n]|\/(?!\}))*)\/\}/gu;
const DIRECTIVE_RE = /^(!|\w+(?:\s+|$))([\s\S]*)?$/u;
const ARGUMENT_RE = /(?:^|\n)[ \t]*([_$A-Z0-9]+)[ \t]*:=/gu;
const LOOP_VARIABLE_RE = /&(APEX\$I(?:TEM)?)(?:!([A-Z]+))?\./gu;
const LOOP_ARG_RE = /^"([^"]+)"\s+(.+)$/u;

let registry = new Map<string, NamedTemplate>();

/** Named templates available to `{apply/}` when the caller does not pass its own lookup. */
export function registerNamedTemplates(templates: Map<string, NamedTemplate>): void {
  registry = templates;
}

export const namedTemplate = (name: string) => registry.get(name);

export function escapeValue(value: string, mode: EscapeMode | string | undefined): string {
  switch ((mode ?? 'HTML').toUpperCase()) {
    case 'RAW':
      return value;
    case 'ATTR':
    case 'HTML':
      return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#x27;');
    case 'STRIPHTML':
      return escapeValue(value.replace(/<[^>]*>/gu, '').replaceAll('&nbsp;', ''), 'HTML');
    case 'JS':
      return JSON.stringify(value).slice(1, -1).replaceAll('<', '\\u003c').replaceAll("'", '\\u0027');
    case 'URL':
      return encodeURIComponent(value);
    default:
      return escapeValue(value, 'HTML');
  }
}

type Token =
  | { type: 'text'; text: string }
  | { type: 'ph'; text: string; name: string; filter: string | undefined }
  | { type: 'directive'; text: string; name: string; arg: string };

function tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  const push = (token: Token) => {
    const previous = tokens.at(-1);
    if (token.type === 'text' && previous?.type === 'text') previous.text += token.text;
    else tokens.push(token);
  };
  for (const match of template.matchAll(TOKEN_RE)) {
    if (match.index > last) push({ type: 'text', text: template.slice(last, match.index) });
    last = match.index + match[0].length;
    if (match[0] === '{{/}') push({ type: 'text', text: '{' });
    else if (match[1]) push({ type: 'ph', text: match[0], name: match[1], filter: match[2] });
    else {
      const directive = DIRECTIVE_RE.exec(match[3]!);
      if (directive)
        push({
          type: 'directive',
          text: match[0],
          name: directive[1]!.trim().toLowerCase(),
          arg: (directive[2] ?? '').trim(),
        });
      else push({ type: 'text', text: match[0] });
    }
  }
  if (template.length > last) push({ type: 'text', text: template.slice(last) });
  return tokens;
}

interface Scope {
  values: Record<string, string>;
  /** `{with/}` arguments of the current `{apply/}` call (evaluated values). */
  args?: Record<string, string> | undefined;
  /** Unevaluated argument text, for `%assigned`. */
  assigned?: Map<string, string> | undefined;
  /** Escapes of the formal arguments of the applied template. */
  argEscapes?: Record<string, EscapeMode> | undefined;
  loop: Record<string, string>[];
}

const IF_MATCH = { else: 1, elseif: 1, elsif: 1, endif: 1 };

class Engine {
  readonly #tokens: Token[];
  readonly #options: TemplateOptions;
  readonly #scope: Scope;
  #output = '';
  #lastDirective = false;
  readonly #ifStack: { matched: boolean; hasElse?: boolean }[] = [];
  readonly #caseStack: { value: string; matched: boolean; hasOtherwise?: boolean }[] = [];
  #loopDepth = 0;

  constructor(template: string, options: TemplateOptions, scope: Scope) {
    this.#tokens = tokenize(template);
    this.#options = options;
    this.#scope = scope;
  }

  run(): string {
    for (let index = 0; index < this.#tokens.length;) index = this.#process(index);
    if (this.#ifStack.length) this.#warn("'if' without 'endif'");
    if (this.#caseStack.length) this.#warn("'case' without 'endcase'");
    return this.#output;
  }

  #warn(message: string): void {
    this.#options.warn?.(`Template directive: ${message}`);
  }

  #lookup(name: string): string | undefined {
    for (let index = this.#scope.loop.length - 1; index >= 0; index -= 1) {
      const local = this.#scope.loop[index]!;
      if (Object.hasOwn(local, name)) return local[name];
    }
    if (this.#scope.args && Object.hasOwn(this.#scope.args, name)) return this.#scope.args[name];
    return Object.hasOwn(this.#scope.values, name) ? this.#scope.values[name] : undefined;
  }

  #isLoopVariable(name: string): boolean {
    return this.#scope.loop.some((local) => Object.hasOwn(local, name));
  }

  /** A placeholder's output, or undefined to keep its text. */
  #placeholder(name: string, filter: string | undefined): string | undefined {
    const resolve = this.#options.placeholders !== false || this.#isLoopVariable(name);
    if (!resolve) return undefined;
    const value = this.#lookup(name);
    if (value === undefined) return this.#options.removeUnknown === false ? undefined : '';
    if (filter) return escapeValue(value, filter);
    if (this.#scope.args && Object.hasOwn(this.#scope.args, name)) {
      // A named template argument is escaped by its formal escape mode where it is used.
      const escape = this.#scope.argEscapes?.[name];
      return escape ? escapeValue(value, escape) : value;
    }
    if (this.#options.defaultEscape === false || this.#options.placeholders === false) return value;
    return escapeValue(value, this.#options.escapes?.[name] ?? this.#options.defaultEscape ?? 'HTML');
  }

  #text(text: string): string {
    if (!this.#scope.loop.length) return text;
    return text.replace(LOOP_VARIABLE_RE, (whole, name: string, filter?: string) => {
      const value = this.#lookup(name);
      if (value === undefined) return whole;
      if (filter) return escapeValue(value, filter);
      const raw = this.#options.defaultEscape === false || this.#options.placeholders === false;
      return raw ? value : escapeValue(value, 'HTML');
    });
  }

  #process(index: number): number {
    const token = this.#tokens[index]!;
    const next = index + 1;
    if (token.type === 'text') {
      // APEX normalizes the whitespace that follows a directive to a single space.
      const text = this.#lastDirective ? token.text.replace(/^\s+/u, ' ') : token.text;
      this.#output += this.#text(text);
      this.#lastDirective = false;
      return next;
    }
    if (token.type === 'ph') {
      const value = this.#placeholder(token.name, token.filter);
      this.#output += value ?? token.text;
      this.#lastDirective = false;
      return next;
    }
    const handler = this.#directives[token.name];
    if (!handler) {
      this.#output += this.#text(token.text);
      this.#lastDirective = false;
      return next;
    }
    this.#lastDirective = true;
    return handler(next, token.arg);
  }

  /** Index of the next directive in `match` at nesting level 0 (or the end). */
  #lookAhead(index: number, match: Record<string, number>, open: string, close: string): number {
    let level = 0;
    let position = index;
    for (; position < this.#tokens.length; position += 1) {
      const token = this.#tokens[position]!;
      if (token.type !== 'directive') continue;
      if (Object.hasOwn(match, token.name) && level === 0) break;
      if (token.name === open) level += 1;
      else if (token.name === close) level -= 1;
      if (level < 0) break;
    }
    return position;
  }

  #value(name: string, assigned: boolean): string {
    if (assigned && this.#scope.assigned?.has(name))
      return this.#scope.assigned.get(name)!.trim().length > 0 ? 'Y' : '';
    return this.#lookup(name) ?? '';
  }

  #test(condition: string): boolean {
    let rest = condition.trim();
    let not = false;
    if (rest.startsWith('!')) {
      not = true;
      rest = rest.slice(1).trim();
    }
    let type: string | null = rest.slice(0, 1);
    if (type === '?' || type === '=') rest = rest.slice(1).trim();
    else type = null;
    const assigned = /%assigned\s*$/iu.test(rest);
    if (assigned) {
      // Like the server implementation, %assigned ignores the condition type operator.
      type = null;
      rest = rest.replace(/%assigned\s*$/iu, '');
    }
    const name = rest.replace(/^"([^"]+)"$/u, '$1').trim();
    const value = this.#value(name, assigned).trim();
    let result =
      type === '?'
        ? value !== ''
        : type === '='
          ? !FALSE_VALUES.has(value)
          : value !== '' && !FALSE_VALUES.has(value);
    if (not) result = !result;
    return result;
  }

  readonly #directives: Record<string, (index: number, arg: string) => number> = {
    if: (index, arg) => {
      const frame = { matched: false };
      this.#ifStack.push(frame);
      if (this.#test(arg)) {
        frame.matched = true;
        return index;
      }
      return this.#lookAhead(index, IF_MATCH, 'if', 'endif');
    },
    elseif: (index, arg) => this.#elseif(index, arg),
    elsif: (index, arg) => this.#elseif(index, arg),
    else: (index) => {
      const frame = this.#ifStack.at(-1);
      if (!frame) {
        this.#warn("'else' without 'if'");
        return index;
      }
      if (frame.hasElse) this.#warn("'if' must have only one 'else'");
      frame.hasElse = true;
      if (!frame.matched) {
        frame.matched = true;
        return index;
      }
      return this.#lookAhead(index, { endif: 1 }, 'if', 'endif');
    },
    endif: (index) => {
      if (!this.#ifStack.pop()) this.#warn("'endif' without 'if'");
      return index;
    },
    case: (index, arg) => {
      let position = index;
      const blank = this.#tokens[position];
      if (blank?.type === 'text' && blank.text.trim() === '') position += 1;
      const when = this.#tokens[position];
      if (when?.type !== 'directive' || when.name !== 'when') {
        this.#warn("'case' must be followed by 'when'");
        return position;
      }
      this.#caseStack.push({
        value: this.#value(arg.replace(/^"([^"]+)"$/u, '$1'), false).trim(),
        matched: false,
      });
      return position;
    },
    when: (index, arg) => {
      const frame = this.#caseStack.at(-1);
      if (!frame) {
        this.#warn("'when' without 'case'");
        return index;
      }
      if (frame.hasOtherwise) this.#warn("'when' must come before 'otherwise'");
      if (frame.matched) return this.#lookAhead(index, { endcase: 1 }, 'case', 'endcase');
      if (frame.value === arg.trim()) {
        frame.matched = true;
        return index;
      }
      return this.#lookAhead(index, { when: 1, otherwise: 1, endcase: 1 }, 'case', 'endcase');
    },
    otherwise: (index) => {
      const frame = this.#caseStack.at(-1);
      if (!frame) {
        this.#warn("'otherwise' without 'case'");
        return index;
      }
      if (frame.hasOtherwise) this.#warn("'case' must have only one 'otherwise'");
      frame.hasOtherwise = true;
      if (frame.matched) return this.#lookAhead(index, { endcase: 1 }, 'case', 'endcase');
      frame.matched = true;
      return index;
    },
    endcase: (index) => {
      if (!this.#caseStack.pop()) this.#warn("'endcase' without 'case'");
      return index;
    },
    loop: (index, arg) => this.#loop(index, arg),
    endloop: (index) => {
      if (this.#loopDepth === 0) this.#warn("'endloop' without 'loop'");
      return index;
    },
    with: (index) => this.#with(index),
    apply: (index, arg) => {
      this.#warn(`'apply ${arg}' without 'with'`);
      return index;
    },
    '!': (index) => index,
  };

  #elseif(index: number, arg: string): number {
    const frame = this.#ifStack.at(-1);
    if (!frame) {
      this.#warn("'elseif' without 'if'");
      return index;
    }
    if (frame.hasElse) this.#warn("'elseif' must come before 'else'");
    if (!frame.matched && this.#test(arg)) {
      frame.matched = true;
      return index;
    }
    return this.#lookAhead(index, frame.matched ? { endif: 1 } : IF_MATCH, 'if', 'endif');
  }

  #loop(index: number, arg: string): number {
    const end = this.#lookAhead(index, { endloop: 1 }, 'loop', 'endloop');
    const parsed = LOOP_ARG_RE.exec(arg);
    const separator = parsed ? parsed[1]! : ':';
    const name = (parsed ? parsed[2]! : arg).trim();
    const value = this.#lookup(name) ?? '';
    const items =
      value === '' ? [] : value.split(separator.length > 1 ? new RegExp(separator, 'u') : separator);
    this.#loopDepth += 1;
    items.forEach((item, position) => {
      this.#scope.loop.push({ APEX$ITEM: item, APEX$I: String(position + 1) });
      this.#lastDirective = true;
      for (let cursor = index; cursor < end;) cursor = this.#process(cursor);
      this.#scope.loop.pop();
    });
    this.#loopDepth -= 1;
    this.#lastDirective = true;
    return end < this.#tokens.length ? end + 1 : end;
  }

  #with(index: number): number {
    const end = this.#lookAhead(index, { apply: 1 }, 'with', 'apply');
    const apply = this.#tokens[end];
    if (apply?.type !== 'directive' || apply.name !== 'apply') {
      this.#warn("'with' without 'apply'");
      return end;
    }
    const source = this.#tokens
      .slice(index, end)
      .map((token) => token.text)
      .join('');
    // Split `NAME:=value` assignments, keeping nested {with/}…{apply/} blocks inside one value.
    const argumentText = new Map<string, string>();
    const matches = [...source.matchAll(ARGUMENT_RE)];
    let depth = 0;
    let current: { name: string; start: number } | undefined;
    for (let position = 0; position < matches.length; position += 1) {
      const match = matches[position]!;
      if (depth === 0) current = { name: match[1]!, start: match.index + match[0].length };
      const stop = matches[position + 1]?.index ?? source.length;
      const piece = source.slice(match.index + match[0].length, stop);
      depth += (piece.match(/\{with/gu)?.length ?? 0) - (piece.match(/\{apply/gu)?.length ?? 0);
      if (depth <= 0 && current) {
        argumentText.set(current.name, source.slice(current.start, stop).trim());
        depth = 0;
      }
    }
    this.#output += this.#apply(apply.arg, argumentText);
    this.#lastDirective = true;
    return end + 1;
  }

  #apply(name: string, argumentText: Map<string, string>): string {
    const definition = (this.#options.templates ?? namedTemplate)(name);
    if (!definition) {
      this.#warn(`'apply' unknown template ${name}`);
      return '';
    }
    const args: Record<string, string> = { ...this.#scope.args };
    const argEscapes: Record<string, EscapeMode> = {};
    for (const formal of definition.args) {
      if (!argumentText.has(formal.name)) argumentText.set(formal.name, formal.default ?? '');
      const escape = formal.escape ?? definition.defaultEscape;
      if (escape && escape !== 'RAW') argEscapes[formal.name] = escape;
    }
    for (const [argument, text] of argumentText) {
      const escaped = Object.hasOwn(argEscapes, argument);
      // Arguments are templates in the caller's context. A non-RAW formal argument is escaped
      // where the applied template uses it, so it is evaluated raw here (no double escaping).
      args[argument] = /[#&{]|\/\}/u.test(text)
        ? new Engine(
            text,
            {
              ...this.#options,
              placeholders: true,
              ...(escaped ? { defaultEscape: false as const } : {}),
            },
            { ...this.#scope, argEscapes: undefined, loop: [...this.#scope.loop] },
          ).run()
        : text;
    }
    return new Engine(
      definition.template,
      {
        ...this.#options,
        placeholders: true,
        escapes: {},
        defaultEscape: definition.defaultEscape ?? 'HTML',
      },
      { values: this.#scope.values, args, assigned: new Map(argumentText), argEscapes, loop: [] },
    ).run();
  }
}

/**
 * Applies directives and (unless `placeholders: false`) placeholders to `template`.
 * `values` are keyed by upper-case placeholder name and hold raw values; escaping happens on output.
 */
export function applyTemplate(
  template: string,
  values: Record<string, string>,
  options: TemplateOptions = {},
): string {
  if (!/[#{&]/u.test(template)) return template;
  return new Engine(template, options, { values, loop: [] }).run();
}

/** The theme.ts `applyDirectives` contract: directives only, values are already escaped. */
export function processDirectives(template: string, values: Record<string, string>): string {
  if (!template.includes('{')) return template;
  return applyTemplate(template, values, { placeholders: false, defaultEscape: false });
}
