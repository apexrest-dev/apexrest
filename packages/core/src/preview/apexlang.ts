import fs from 'node:fs';
import path from 'node:path';

/** `@id` (same scope) or `@/id` (global page / built-in Universal Theme). */
export interface ApxRef {
  ref: string;
  global: boolean;
}

export type ApxValue = string | boolean | ApxRef | ApxValue[] | ApxObject;
export interface ApxObject {
  [key: string]: ApxValue;
}

export interface ApxComponent {
  type: string;
  id: string;
  props: ApxObject;
  children: ApxComponent[];
  file: string;
  line: number;
}

export class ApexLangError extends Error {
  readonly file: string;
  readonly line: number;

  constructor(message: string, file: string, line: number) {
    super(`${file}:${line}: ${message}`);
    this.file = file;
    this.line = line;
  }
}

const PROPERTY = /^("(?:[^"\\]|\\.)*"|[A-Za-z0-9_$.#-]+)\s*:(?:\s+(.*))?$/u;
const GROUP = /^([A-Za-z][\w-]*)\s*\{$/u;
const COMPONENT = /^([A-Za-z][\w]*)(?:\s+(.+?))?\s*\($/u;

export function isRef(value: ApxValue | undefined): value is ApxRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as ApxRef).ref === 'string' &&
    Object.keys(value).length === 2 &&
    'global' in value
  );
}

export function isObject(value: ApxValue | undefined): value is ApxObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !isRef(value);
}

function unquote(raw: string): string {
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    try {
      return JSON.parse(raw) as string;
    } catch {
      return raw.slice(1, -1);
    }
  }
  return raw;
}

function scalar(raw: string): ApxValue {
  const text = raw.trim();
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) return unquote(text);
  // `\#COLUMN#\` keeps substitution strings literal.
  if (text.length >= 2 && text.startsWith('\\') && text.endsWith('\\')) return text.slice(1, -1);
  if (/^@\S+$/u.test(text) && !text.endsWith('@')) {
    return text.startsWith('@/')
      ? { ref: text.slice(2), global: true }
      : { ref: text.slice(1), global: false };
  }
  return text;
}

function inlineArray(text: string): ApxValue[] {
  const body = text.slice(1, -1).trim();
  if (!body) return [];
  const values: ApxValue[] = [];
  for (const match of body.matchAll(/"(?:[^"\\]|\\.)*"|\S+/gu)) values.push(scalar(match[0]));
  return values;
}

function stripComments(lines: string[]): string[] {
  let block = false;
  let fence = false;
  return lines.map((line) => {
    const trimmed = line.trim();
    if (fence) {
      if (trimmed === '```') fence = false;
      return line;
    }
    if (trimmed.startsWith('```')) {
      fence = !(trimmed.length >= 6 && trimmed.endsWith('```'));
      return line;
    }
    if (block) {
      const end = line.indexOf('*/');
      if (end === -1) return '';
      block = false;
      return line.slice(end + 2);
    }
    if (trimmed.startsWith('//')) return '';
    if (trimmed.startsWith('/*')) {
      const end = line.indexOf('*/', line.indexOf('/*') + 2);
      if (end === -1) {
        block = true;
        return '';
      }
      return line.slice(0, line.indexOf('/*')) + line.slice(end + 2);
    }
    return line;
  });
}

/** Parses one `.apx` source into its top-level components. */
export function parseApexLang(source: string, file = '<memory>'): ApxComponent[] {
  const lines = stripComments(source.replace(/\r\n?/gu, '\n').split('\n'));
  let index = 0;
  const fail = (message: string): never => {
    throw new ApexLangError(message, file, index + 1);
  };

  const readFence = (): string => {
    const opening = lines[index] ?? '';
    const indent = opening.length - opening.trimStart().length;
    const body: string[] = [];
    index += 1;
    while (index < lines.length && (lines[index] ?? '').trim() !== '```') {
      const line = lines[index] ?? '';
      const leading = line.length - line.trimStart().length;
      body.push(line.slice(Math.min(indent, leading)));
      index += 1;
    }
    if (index >= lines.length) fail('unterminated ``` block');
    index += 1;
    return body.join('\n');
  };

  const readValue = (raw: string | undefined): ApxValue => {
    const text = (raw ?? '').trim();
    if (text === '') {
      const next = (lines[index] ?? '').trim();
      if (next.startsWith('```')) return readFence();
      return '';
    }
    if (text === '{') return readBlock('}');
    if (text === '[') return readArray();
    if (text.startsWith('[') && text.endsWith(']')) return inlineArray(text);
    if (text.startsWith('```') && text.endsWith('```') && text.length >= 6) return text.slice(3, -3);
    return scalar(text);
  };

  const readArray = (): ApxValue[] => {
    const values: ApxValue[] = [];
    while (index < lines.length) {
      const text = (lines[index] ?? '').trim();
      index += 1;
      if (!text) continue;
      if (text === ']') return values;
      if (text === '{') values.push(readBlock('}'));
      else if (text.startsWith('```')) {
        index -= 1;
        values.push(readFence());
      } else values.push(scalar(text));
    }
    return fail('unterminated array');
  };

  // Reads properties/groups until `close`; components are collected when `children` is supplied.
  function readBlock(close: string, children?: ApxComponent[]): ApxObject {
    const props: ApxObject = {};
    while (index < lines.length) {
      const text = (lines[index] ?? '').trim();
      const lineNumber = index + 1;
      index += 1;
      if (!text) continue;
      if (text === close) return props;
      const property = PROPERTY.exec(text);
      if (property) {
        props[unquote(property[1]!)] = readValue(property[2]);
        continue;
      }
      const group = GROUP.exec(text);
      if (group) {
        const nested = readBlock('}', children);
        const existing = props[group[1]!];
        props[group[1]!] = isObject(existing) ? { ...existing, ...nested } : nested;
        continue;
      }
      const component = COMPONENT.exec(text);
      if (component && children) {
        children.push(readComponent(component[1]!, component[2] ?? '', lineNumber));
        continue;
      }
      index -= 1;
      fail(`unexpected line: ${text.slice(0, 120)}`);
    }
    if (close === '') return props;
    return fail(`missing closing "${close}"`);
  }

  function readComponent(type: string, rawId: string, line: number): ApxComponent {
    const children: ApxComponent[] = [];
    const props = readBlock(')', children);
    return { type, id: unquote(rawId.trim()), props, children, file, line };
  }

  const components: ApxComponent[] = [];
  while (index < lines.length) {
    const text = (lines[index] ?? '').trim();
    const lineNumber = index + 1;
    index += 1;
    if (!text) continue;
    const component = COMPONENT.exec(text);
    if (!component) {
      index -= 1;
      fail(`expected a component declaration, found: ${text.slice(0, 120)}`);
    }
    components.push(readComponent(component![1]!, component![2] ?? '', lineNumber));
  }
  return components;
}

/** Dotted property lookup through nested groups: `get(c.props, "layout.sequence")`. */
export function get(props: ApxObject, dotted: string): ApxValue | undefined {
  let value: ApxValue | undefined = props;
  for (const part of dotted.split('.')) {
    if (!isObject(value)) return undefined;
    value = value[part];
  }
  return value;
}

export function str(props: ApxObject, dotted: string, fallback = ''): string {
  const value = get(props, dotted);
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return String(value);
  if (isRef(value)) return value.ref;
  return fallback;
}

export function num(props: ApxObject, dotted: string, fallback: number): number {
  const value = Number(str(props, dotted, ''));
  return str(props, dotted, '') !== '' && Number.isFinite(value) ? value : fallback;
}

export function bool(props: ApxObject, dotted: string, fallback: boolean): boolean {
  const value = get(props, dotted);
  return typeof value === 'boolean' ? value : fallback;
}

export function ref(props: ApxObject, dotted: string): string | undefined {
  const value = get(props, dotted);
  if (isRef(value)) return value.ref;
  return typeof value === 'string' && value ? value : undefined;
}

export function list(props: ApxObject, dotted: string): ApxValue[] {
  const value = get(props, dotted);
  if (Array.isArray(value)) return value;
  return value === undefined || value === '' ? [] : [value];
}

export interface ApxApplication {
  root: string;
  app: ApxComponent;
  pages: Map<string, ApxComponent>;
  shared: ApxComponent[];
  substitutions: Record<string, string>;
  files: string[];
}

function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'static-files' ? [] : walk(full);
    return entry.name.endsWith('.apx') ? [full] : [];
  });
}

/** Values for `@NAME@` deployment placeholders, from `deployments/<name>.json` when present. */
function deploymentSubstitutions(root: string, deployment: string): Record<string, string> {
  const file = path.join(root, 'deployments', `${deployment}.json`);
  if (!fs.existsSync(file)) return {};
  const values: Record<string, string> = {};
  const collect = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (typeof nested === 'string' || typeof nested === 'number')
        values[key.toUpperCase()] = String(nested);
      else collect(nested);
    }
  };
  try {
    collect(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return {};
  }
  return values;
}

/** Loads an APEXlang source tree (the folder that contains `application.apx`). */
export function loadApplication(root: string, deployment = 'default'): ApxApplication {
  const appFile = path.join(root, 'application.apx');
  if (!fs.existsSync(appFile)) throw new Error(`${root} does not contain application.apx`);
  const substitutions = deploymentSubstitutions(root, deployment);
  const files = walk(root).sort();
  const pages = new Map<string, ApxComponent>();
  const shared: ApxComponent[] = [];
  let app: ApxComponent | undefined;
  for (const file of files) {
    const relative = path.relative(root, file);
    const text = fs
      .readFileSync(file, 'utf8')
      .replace(
        /@([A-Z][A-Z0-9_]*)@/gu,
        (whole, name: string) =>
          substitutions[name] ??
          (name === 'APP_ALIAS'
            ? path.basename(root).toLowerCase()
            : name === 'APP_NAME'
              ? path.basename(root)
              : whole),
      );
    for (const component of parseApexLang(text, relative)) {
      if (component.type === 'app') app = component;
      else if (component.type === 'page') pages.set(component.id, component);
      else shared.push(component);
    }
  }
  if (!app) throw new Error(`${appFile} does not declare an app component`);
  return { root, app, pages, shared, substitutions, files };
}
