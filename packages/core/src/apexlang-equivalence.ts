import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { canonical, contained, hash } from './fs.ts';

export const APEXLANG_EQUIVALENCE_POLICY = 'apex262-selected-source-v1';
const formattingRule = 'structural-whitespace-and-comments';
const defaultRule = 'pageItem.selectList.layout.startNewRow:true-default';
const limit = 8 * 1024 * 1024;

type Node =
  | { kind: 'property'; name: string; value: string }
  | { kind: 'literal'; value: string }
  | { kind: 'component' | 'group' | 'map'; name: string; key: string; children: Node[] };

/**
 * This is a deliberately incomplete reader, not a replacement Oracle compiler.
 * Scalar values (including unquoted strings) and fenced code retain their exact
 * bytes. Unknown forms fail closed. The vendor lexer treats an entire property
 * line as a value, so // and /* inside those values must never become comments.
 */
function readStructure(source: string): Node[] {
  if (Buffer.byteLength(source) > limit) throw new Error('Source exceeds the comparison limit.');
  const lines = source.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g)?.filter(Boolean) ?? [];
  const roots: Node[] = [];
  const stack: Array<Extract<Node, { children: Node[] }>> = [];
  const append = (node: Node) => (stack.at(-1)?.children ?? roots).push(node);
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index]!;
    const line = raw.replace(/[\r\n]+$/, '');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    if (trimmed.startsWith('/*')) {
      let comment = trimmed;
      while (!comment.includes('*/') && ++index < lines.length) comment += lines[index]!;
      const end = comment.indexOf('*/');
      if (end < 0 || comment.slice(end + 2).trim()) throw new Error('Unsupported comment boundary.');
      continue;
    }
    if (trimmed.startsWith('```')) {
      if (!/^```[A-Za-z0-9_-]*[ \t]*$/.test(trimmed)) throw new Error('Unsupported fenced literal.');
      // Preserve the complete code payload, including its line endings and indentation.
      let literal = line.replace(/^[ \t]*/, '') + raw.slice(line.length);
      let closed = false;
      while (++index < lines.length) {
        const next = lines[index]!;
        if (/^[ \t]*```[ \t]*(?:\r\n|\r|\n)?$/.test(next)) {
          literal += next.replace(/^[ \t]*/, '');
          closed = true;
          break;
        }
        literal += next;
      }
      if (!closed) throw new Error('Unclosed fenced literal.');
      append({ kind: 'literal', value: literal });
      continue;
    }
    const property = /^[ \t]*([A-Za-z][\w]*):[ \t]*(.*)$/.exec(line);
    if (property) {
      const value = property[2]!;
      if (value.includes('```') || value.startsWith('"""') || value.startsWith("'''"))
        throw new Error('Unsupported inline or multiline literal.');
      if (value === '{') {
        const node = { kind: 'map' as const, name: property[1]!, key: '', children: [] };
        append(node);
        stack.push(node);
      } else append({ kind: 'property', name: property[1]!, value });
      continue;
    }
    const component = /^([A-Za-z][\w]*)(?:[ \t]+(.*?))?[ \t]*\([ \t]*$/.exec(trimmed);
    if (component) {
      const node = { kind: 'component' as const, name: component[1]!, key: component[2] ?? '', children: [] };
      append(node);
      stack.push(node);
      continue;
    }
    const group = /^([A-Za-z][\w]*)[ \t]*\{[ \t]*$/.exec(trimmed);
    if (group) {
      const node = { kind: 'group' as const, name: group[1]!, key: '', children: [] };
      append(node);
      stack.push(node);
      continue;
    }
    if (trimmed === ')' || trimmed === '}') {
      const node = stack.pop();
      if (!node || (trimmed === ')') !== (node.kind === 'component'))
        throw new Error('Unbalanced structural boundary.');
      continue;
    }
    throw new Error('Unsupported source form.');
  }
  if (stack.length) throw new Error('Unclosed structural boundary.');
  return roots;
}

/**
 * Oracle 26.2 MMD 26.2.0+3479 componentTypes[5120].properties[105]:
 * default Y, only when the item is VISIBLE and layout.startNewLayout is N/absent.
 * The initial qualification covers native selectList; custom/other types remain
 * byte/structurally strict. Inventory source: oracle/skills commit
 * 03ee10d02273bc4002fd527089e7fbb5884f94c4, page-item.md layout.startNewRow.
 */
function removeQualifiedDefault(nodes: Node[], parent?: Extract<Node, { children: Node[] }>): Node[] {
  return nodes.map((node) => {
    if (!('children' in node)) return node;
    let children = node.children;
    if (
      node.kind === 'component' &&
      node.name === 'pageItem' &&
      parent?.kind === 'component' &&
      parent.name === 'page'
    ) {
      const types = children.filter((child) => child.kind === 'property' && child.name === 'type');
      const layouts = children.filter((child) => child.kind === 'group' && child.name === 'layout');
      if (
        types.length === 1 &&
        types[0]!.kind === 'property' &&
        types[0]!.value === 'selectList' &&
        layouts.length === 1
      ) {
        children = children.map((child) => {
          if (child.kind !== 'group' || child.name !== 'layout') return child;
          const rows = child.children.filter(
            (entry) => entry.kind === 'property' && entry.name === 'startNewRow',
          );
          const layouts = child.children.filter(
            (entry) => entry.kind === 'property' && entry.name === 'startNewLayout',
          );
          if (
            rows.length !== 1 ||
            rows[0]!.kind !== 'property' ||
            rows[0]!.value !== 'true' ||
            layouts.length > 1 ||
            (layouts.length === 1 && (layouts[0]!.kind !== 'property' || layouts[0]!.value !== 'false'))
          )
            return child;
          return { ...child, children: child.children.filter((entry) => entry !== rows[0]) };
        });
      }
    }
    return { ...node, children: removeQualifiedDefault(children, node) };
  });
}

export interface SourceEquivalence {
  equivalent: boolean;
  rules: string[];
  reason?: string;
}

export function compareApexlangSource(expected: string, actual: string): SourceEquivalence {
  if (expected === actual) return { equivalent: true, rules: [] };
  try {
    const left = readStructure(expected),
      right = readStructure(actual);
    if (canonical(left) === canonical(right)) return { equivalent: true, rules: [formattingRule] };
    if (canonical(removeQualifiedDefault(left)) === canonical(removeQualifiedDefault(right)))
      return { equivalent: true, rules: [formattingRule, defaultRule] };
    return {
      equivalent: false,
      rules: [],
      reason: 'Source differs beyond the qualified formatting/default rules.',
    };
  } catch (error) {
    return {
      equivalent: false,
      rules: [],
      reason: error instanceof Error ? error.message : 'Source form is unsupported.',
    };
  }
}

export interface ExportComparison {
  equivalent: boolean;
  policy: typeof APEXLANG_EQUIVALENCE_POLICY;
  normalizations: Array<{ file: string; expectedSha256: string; actualSha256: string; rules: string[] }>;
  mismatchedFiles: string[];
  mismatches: Array<{ file: string; reason: string }>;
}

/** Only explicitly selected .apx files may use the narrow equivalence policy. */
export async function compareApplicationExports(
  expectedRoot: string,
  actualRoot: string,
  expectedFiles: Record<string, string>,
  actualFiles: Record<string, string>,
  allowedFiles: readonly string[],
): Promise<ExportComparison> {
  const allowed = new Set(allowedFiles);
  const result: ExportComparison = {
    equivalent: true,
    policy: APEXLANG_EQUIVALENCE_POLICY,
    normalizations: [],
    mismatchedFiles: [],
    mismatches: [],
  };
  for (const file of [...new Set([...Object.keys(expectedFiles), ...Object.keys(actualFiles)])].sort()) {
    if (expectedFiles[file] === actualFiles[file]) continue;
    let reason = 'File bytes differ outside the selected APEXlang normalization scope.';
    if (
      expectedFiles[file] &&
      actualFiles[file] &&
      allowed.has(file) &&
      path.posix.extname(file) === '.apx'
    ) {
      const [expected, actual] = await Promise.all([
        readFile(await contained(expectedRoot, file)),
        readFile(await contained(actualRoot, file)),
      ]);
      if (hash(expected) !== expectedFiles[file] || hash(actual) !== actualFiles[file])
        reason = 'Source changed during readback comparison.';
      else {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        let comparison: SourceEquivalence;
        try {
          comparison = compareApexlangSource(decoder.decode(expected), decoder.decode(actual));
        } catch {
          comparison = { equivalent: false, rules: [], reason: 'Source is not valid UTF-8.' };
        }
        if (comparison.equivalent) {
          result.normalizations.push({
            file,
            expectedSha256: expectedFiles[file]!,
            actualSha256: actualFiles[file]!,
            rules: comparison.rules,
          });
          continue;
        }
        reason = comparison.reason ?? reason;
      }
    }
    result.equivalent = false;
    result.mismatchedFiles.push(file);
    result.mismatches.push({ file, reason });
  }
  return result;
}
