import { createHash } from 'node:crypto';
import { parseApexLang, type ApxComponent, type ApxValue } from '../preview/apexlang.ts';
import { Fault } from '../result.ts';

/**
 * Bounded, lossless property editing of one APEXlang file. The file is scanned line by line into
 * components, groups and property lines with their exact offsets; an edit replaces only the value
 * bytes of one property line (or inserts the missing line or group with the file's own indentation
 * and line ending). Everything else — comments, ``` literals, object/array values, other
 * components, Oracle metadata and ids — keeps its bytes. Constructs the scanner does not
 * understand are refused rather than rewritten. The preview parser only validates the result; it
 * never serializes the file.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const COMPONENT = /^( *)([A-Za-z]\w*)(?:\s+(.+?))?\s*\(\s*$/u;
const GROUP = /^( *)([A-Za-z][\w-]*)\s*\{\s*$/u;
const PROPERTY = /^( *)("(?:[^"\\]|\\.)*"|[A-Za-z0-9_$.#-]+)\s*:(?:([ \t]+)(.*?))?\s*$/u;

interface Line {
  text: string;
  eol: string;
  offset: number;
}
interface PropertyLine {
  line: number;
  /** Offsets of the value bytes (empty range right after the colon when the value is empty). */
  valueStart: number;
  valueEnd: number;
  value: string;
  /** Multi-line (``` literal, object or array) values are never edited as scalars. */
  opaque: boolean;
  /** Lines of a ``` literal value: the opening and closing fence lines. */
  fence?: { open: number; close: number };
}
interface GroupNode {
  open: number;
  close: number;
  indent: number;
}
export interface ComponentNode {
  kind: string;
  key: string;
  indent: number;
  open: number;
  close: number;
  parent: ComponentNode | undefined;
  children: ComponentNode[];
  /** Dotted path (`heading.heading`) to property line. */
  properties: Map<string, PropertyLine>;
  groups: Map<string, GroupNode>;
}

const unsupported = (message: string) => new Fault('TRANSFORM_UNSUPPORTED', message, 5);
const unquote = (raw: string) => {
  if (!raw.startsWith('"')) return raw;
  try {
    return JSON.parse(raw) as string;
  } catch {
    throw unsupported(`Invalid quoted identifier ${raw}`);
  }
};

export const digestOf = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

export class ApexLangDocument {
  readonly lines: Line[];
  readonly roots: ComponentNode[] = [];
  readonly eol: string;

  constructor(readonly source: string) {
    if (Buffer.byteLength(source) > MAX_BYTES) throw unsupported('Source exceeds the bounded editor limit.');
    this.lines = [...source.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/gu)]
      .filter((match) => match[0].length)
      .map((match) => ({ text: match[1]!, eol: match[2]!, offset: match.index! }));
    this.eol = this.lines.find((line) => line.eol)?.eol ?? '\n';
    this.scan();
  }

  private scan() {
    type Frame =
      | { type: 'component'; node: ComponentNode }
      | { type: 'group'; path: string; start: number; indent: number }
      | { type: 'value'; close: '}' | ']' };
    const stack: Frame[] = [];
    const component = () => {
      for (let i = stack.length - 1; i >= 0; i--) {
        const frame = stack[i]!;
        if (frame.type === 'component') return frame.node;
      }
      return undefined;
    };
    const groupPath = () => {
      const parts: string[] = [];
      for (let i = stack.length - 1; i >= 0; i--) {
        const frame = stack[i]!;
        if (frame.type === 'component') break;
        if (frame.type === 'group') parts.unshift(frame.path);
      }
      return parts.join('.');
    };
    let fence = false;
    let block = false;
    let pendingFence: PropertyLine | undefined;
    let fenceOwner: PropertyLine | undefined;
    for (let index = 0; index < this.lines.length; index++) {
      const line = this.lines[index]!;
      const text = line.text;
      const trimmed = text.trim();
      if (fence) {
        if (trimmed === '```') {
          fence = false;
          if (fenceOwner?.fence) fenceOwner.fence.close = index;
          fenceOwner = undefined;
        }
        continue;
      }
      if (block) {
        const end = text.indexOf('*/');
        if (end === -1) continue;
        if (text.slice(end + 2).trim()) throw unsupported('Content after a block comment is not supported.');
        block = false;
        continue;
      }
      if (!trimmed || trimmed.startsWith('//')) continue;
      if (trimmed.startsWith('/*')) {
        const end = text.indexOf('*/', text.indexOf('/*') + 2);
        if (end === -1) block = true;
        else if (text.slice(end + 2).trim())
          throw unsupported('Content after a block comment is not supported.');
        continue;
      }
      if (trimmed.startsWith('```')) {
        if (!pendingFence) throw unsupported(`Unexpected literal at line ${index + 1}.`);
        fence = !(trimmed.length >= 6 && trimmed.endsWith('```'));
        if (fence) {
          pendingFence.fence = { open: index, close: -1 };
          fenceOwner = pendingFence;
        }
        pendingFence = undefined;
        continue;
      }
      pendingFence = undefined;
      const top = stack.at(-1);
      if (top?.type === 'value') {
        if (trimmed === top.close) stack.pop();
        else if (trimmed === '{' || /:\s*\{$/u.test(trimmed)) stack.push({ type: 'value', close: '}' });
        else if (trimmed === '[' || /:\s*\[$/u.test(trimmed)) stack.push({ type: 'value', close: ']' });
        continue;
      }
      if (trimmed === ')') {
        const frame = stack.pop();
        // Like the APEXlang parser, closing parentheses may use any indentation.
        if (frame?.type !== 'component') throw unsupported(`Unbalanced component at line ${index + 1}.`);
        frame.node.close = index;
        continue;
      }
      if (trimmed === '}') {
        const frame = stack.pop();
        if (frame?.type !== 'group') throw unsupported(`Unbalanced group at line ${index + 1}.`);
        const owner = component();
        if (!owner) throw unsupported(`Group outside a component at line ${index + 1}.`);
        const parent = groupPath();
        owner.groups.set(parent ? `${parent}.${frame.path}` : frame.path, {
          open: frame.start,
          close: index,
          indent: frame.indent,
        });
        continue;
      }
      const open = COMPONENT.exec(text);
      if (open) {
        const parent = component();
        if (stack.at(-1)?.type === 'group')
          throw unsupported(`Component inside a group at line ${index + 1}.`);
        const node: ComponentNode = {
          kind: open[2]!,
          key: unquote((open[3] ?? '').trim()),
          indent: open[1]!.length,
          open: index,
          close: -1,
          parent,
          children: [],
          properties: new Map(),
          groups: new Map(),
        };
        (parent ? parent.children : this.roots).push(node);
        stack.push({ type: 'component', node });
        continue;
      }
      const group = GROUP.exec(text);
      if (group) {
        if (!component()) throw unsupported(`Group outside a component at line ${index + 1}.`);
        stack.push({ type: 'group', path: group[2]!, start: index, indent: group[1]!.length });
        continue;
      }
      const property = PROPERTY.exec(text);
      if (property) {
        const owner = component();
        if (!owner) throw unsupported(`Property outside a component at line ${index + 1}.`);
        const key = unquote(property[2]!);
        const prefix = groupPath();
        const path = prefix ? `${prefix}.${key}` : key;
        const value = property[4] ?? '';
        const colon = text.indexOf(':', property[1]!.length + property[2]!.length);
        const valueStart = property[3]
          ? line.offset + colon + 1 + property[3].length
          : line.offset + colon + 1;
        const entry: PropertyLine = {
          line: index,
          valueStart,
          valueEnd: valueStart + value.length,
          value,
          opaque: value === '' || value === '{' || value === '[' || value.startsWith('```'),
        };
        if (owner.properties.has(path)) throw unsupported(`Duplicate property ${path} at line ${index + 1}.`);
        owner.properties.set(path, entry);
        if (value === '') pendingFence = entry;
        else if (value === '{') stack.push({ type: 'value', close: '}' });
        else if (value === '[') stack.push({ type: 'value', close: ']' });
        continue;
      }
      throw unsupported(`Unsupported line ${index + 1}: ${trimmed.slice(0, 80)}`);
    }
    if (fence || block || stack.length) throw unsupported('Unclosed literal, comment, group or component.');
  }

  /** Finds exactly one component by kind and key among the given nodes (case-insensitive key). */
  static one(nodes: ComponentNode[], kind: string, key: string, where: string): ComponentNode {
    const found = nodes.filter((node) => node.kind === kind && node.key.toUpperCase() === key.toUpperCase());
    if (found.length === 1) return found[0]!;
    throw new Fault(
      found.length ? 'TARGET_AMBIGUOUS' : 'TARGET_NOT_FOUND',
      found.length
        ? `${where} has ${found.length} ${kind} components named ${key}.`
        : `${where} has no ${kind} ${key}.`,
      found.length ? 5 : 2,
    );
  }
}

/** APEXlang scalar text for a plain string value, quoted when it would read as something else. */
export function scalarText(value: string): string {
  if (/[\r\n]/u.test(value)) throw new Fault('INVALID_INPUT', 'Values must be single-line text.', 2);
  if (value.length > 4000) throw new Fault('INVALID_INPUT', 'Values are limited to 4000 characters.', 2);
  const plain =
    value !== '' &&
    value === value.trim() &&
    !['true', 'false', '{', '['].includes(value) &&
    !/^["@\\[{]|^```|^\/\/|^\/\*/u.test(value);
  return plain ? value : JSON.stringify(value);
}

export interface TextEdit {
  start: number;
  end: number;
  content: string;
}

/** The edit that sets `path` (dotted, at most one group level) of a component to `value`. */
export function setProperty(
  doc: ApexLangDocument,
  node: ComponentNode,
  path: string,
  value: string,
): TextEdit {
  return setPropertyText(doc, node, path, scalarText(value));
}

/** A component reference value (`@id`), written unquoted; the id is validated, never escaped. */
export function referenceText(id: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.$#-]{0,254}$/u.test(id))
    throw new Fault('INVALID_INPUT', `${id} is not a component id.`, 2);
  return '@' + id;
}

/** Like `setProperty`, with value text already in APEXlang form (a reference or a number). */
export function setPropertyText(
  doc: ApexLangDocument,
  node: ComponentNode,
  path: string,
  text: string,
): TextEdit {
  const existing = node.properties.get(path);
  if (existing) {
    if (existing.opaque) throw unsupported(`${path} holds a multi-line value; edit it in source.`);
    return { start: existing.valueStart, end: existing.valueEnd, content: text };
  }
  const parts = path.split('.');
  if (parts.length > 2) throw unsupported(`Nested property ${path} is not supported.`);
  const indent = ' '.repeat(node.indent + 4);
  const eol = doc.eol;
  if (parts.length === 2) {
    const group = node.groups.get(parts[0]!);
    if (group) {
      const close = doc.lines[group.close]!;
      return {
        start: close.offset,
        end: close.offset,
        content: `${' '.repeat(group.indent + 4)}${parts[1]}: ${text}${eol}`,
      };
    }
    // A new group goes before the first child component, else before the closing parenthesis.
    const before = node.children[0]?.open ?? node.close;
    const anchor = doc.lines[before]!;
    return {
      start: anchor.offset,
      end: anchor.offset,
      content: `${indent}${parts[0]} {${eol}${indent}    ${parts[1]}: ${text}${eol}${indent}}${eol}`,
    };
  }
  // A new top-level property follows `name:` when present, else the component's opening line.
  const after = node.properties.get('name')?.line ?? node.open;
  const line = doc.lines[after]!;
  const at = line.offset + line.text.length + line.eol.length;
  return { start: at, end: at, content: `${indent}${path}: ${text}${eol}` };
}

/** Removes one single-line property line (a no-op `undefined` when the component lacks it). */
export function removeProperty(
  doc: ApexLangDocument,
  node: ComponentNode,
  path: string,
): TextEdit | undefined {
  const property = node.properties.get(path);
  if (!property) return undefined;
  if (property.opaque) throw unsupported(`${path} holds a multi-line value; edit it in source.`);
  const line = doc.lines[property.line]!;
  return { start: line.offset, end: line.offset + line.text.length + line.eol.length, content: '' };
}

export function applyEdits(source: string, edits: TextEdit[]): string {
  let result = source;
  let previous = source.length + 1;
  for (const edit of [...edits].sort((a, b) => b.start - a.start || b.end - a.end)) {
    if (edit.end > previous || edit.start > edit.end)
      throw new Fault('TRANSFORM_CONFLICT', 'Two operations change the same property.', 5);
    result = result.slice(0, edit.start) + edit.content + result.slice(edit.end);
    previous = edit.start;
  }
  return result;
}

/** Replaces the body of a ``` literal property, re-indented to its opening fence. */
export function setFencedText(
  doc: ApexLangDocument,
  node: ComponentNode,
  path: string,
  text: string,
): TextEdit {
  const property = node.properties.get(path);
  if (!property?.fence || property.fence.close < 0)
    throw unsupported(`${path} is not a fenced literal of ${node.kind} ${node.key}.`);
  if (/^\s*```/mu.test(text))
    throw new Fault('INVALID_INPUT', 'The text cannot contain a ``` fence line.', 2);
  const open = doc.lines[property.fence.open]!;
  const close = doc.lines[property.fence.close]!;
  const indent = open.text.slice(0, open.text.length - open.text.trimStart().length);
  const body = text
    .replace(/\r\n?/gu, '\n')
    .replace(/\n+$/u, '')
    .split('\n')
    .map((line) => (line ? indent + line : ''))
    .join(doc.eol);
  const start = open.offset + open.text.length + open.eol.length;
  return { start, end: close.offset, content: body + doc.eol };
}

/** Removes a component with its lines (from its opening line through its closing parenthesis). */
export function removeComponent(doc: ApexLangDocument, node: ComponentNode): TextEdit {
  const open = doc.lines[node.open]!;
  const close = doc.lines[node.close]!;
  return { start: open.offset, end: close.offset + close.text.length + close.eol.length, content: '' };
}

/** Inserts component text (already indented, file line endings) just before the parent's closing line. */
export function appendChild(doc: ApexLangDocument, parent: ComponentNode, text: string): TextEdit {
  const close = doc.lines[parent.close]!;
  return { start: close.offset, end: close.offset, content: text };
}

/** Reads a dotted property from a parsed component (validation of the edited result). */
export function readProperty(component: ApxComponent, path: string): ApxValue | undefined {
  let value: ApxValue | undefined = component.props;
  for (const part of path.split('.')) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    value = (value as Record<string, ApxValue>)[part];
  }
  return value;
}

export { parseApexLang };
