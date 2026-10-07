import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { canonical, contained, hash } from './fs.ts';

export const APEXLANG_EQUIVALENCE_POLICY = 'apex262-selected-source-v1';
const formattingRule = 'structural-whitespace-and-comments';
const defaultRule = 'pageItem.selectList.layout.startNewRow:true-default';
const pageDefaultRule = 'page.security.pageAccessProtection:argumentsMustHaveChecksum-default';
const regionDefaultRule = 'region.layout.startNewRow:true-default';
const chartDefaultRule = 'region.chart.type:bar-default';
const orderRule = 'explicit-unique-region-and-chart-component-order';
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

/** Pinned Oracle 26.2 page/region/chart contracts; no code or nondefault value is rewritten. */
function normalizeExport(
  nodes: Node[],
  rules: Set<string>,
  parent?: Extract<Node, { children: Node[] }>,
): Node[] {
  const result = nodes.map((node) => {
    if (!('children' in node)) return node;
    let children = normalizeExport(node.children, rules, node);
    const property = (name: string) =>
      children.filter((entry) => entry.kind === 'property' && entry.name === name);
    const omit = (name: string, value: string, rule: string) => {
      const matches = property(name);
      if (matches.length === 1 && matches[0]!.kind === 'property' && matches[0]!.value === value) {
        children = children.filter((entry) => entry !== matches[0]);
        rules.add(rule);
      }
    };
    if (node.kind === 'group' && node.name === 'security' && parent?.name === 'page')
      omit('pageAccessProtection', 'argumentsMustHaveChecksum', pageDefaultRule);
    if (
      node.kind === 'group' &&
      node.name === 'layout' &&
      parent?.kind === 'component' &&
      parent.name === 'region'
    ) {
      const starts = property('startNewLayout');
      if (
        !starts.length ||
        (starts.length === 1 && starts[0]!.kind === 'property' && starts[0]!.value === 'false')
      )
        omit('startNewRow', 'true', regionDefaultRule);
    }
    if (
      node.kind === 'group' &&
      node.name === 'chart' &&
      parent?.kind === 'component' &&
      parent.name === 'region' &&
      parent.children.some(
        (entry) => entry.kind === 'property' && entry.name === 'type' && entry.value === 'chart',
      )
    )
      omit('type', 'bar', chartDefaultRule);
    // Duplicate fields/keys are not an equivalence proof, even for an omitted default.
    const identities = node.children
      .filter((entry) => entry.kind !== 'literal')
      .map(
        (entry) =>
          entry.kind + ':' + ('name' in entry ? entry.name : '') + ':' + ('key' in entry ? entry.key : ''),
      );
    if (new Set(identities).size !== identities.length) throw new Error('Duplicate structural identity.');
    const sortable = children.filter(
      (entry) =>
        entry.kind === 'component' &&
        ((node.name === 'page' && entry.name === 'region') ||
          (node.name === 'region' &&
            node.children.some(
              (child) => child.kind === 'property' && child.name === 'type' && child.value === 'chart',
            ) &&
            ['axis', 'series'].includes(entry.name))),
    );
    if (sortable.length > 1) {
      const sequence = (entry: Node) => {
        if (!('children' in entry)) return undefined;
        if (entry.name === 'axis') return entry.key === 'x' || entry.key === 'y' ? entry.key : undefined;
        const group = entry.children.find(
          (child) =>
            child.kind === 'group' && child.name === (entry.name === 'region' ? 'layout' : 'execution'),
        );
        const value =
          group && 'children' in group
            ? group.children.find((child) => child.kind === 'property' && child.name === 'sequence')
            : undefined;
        return value?.kind === 'property' && /^\d+$/.test(value.value)
          ? entry.name + ':' + value.value
          : undefined;
      };
      const sequences = sortable.map(sequence);
      if (sequences.every(Boolean) && new Set(sequences).size === sequences.length) {
        const sorted = [...sortable].sort(
          (left, right) =>
            ('name' in left ? left.name : '').localeCompare('name' in right ? right.name : '') ||
            ('key' in left ? left.key : '').localeCompare('key' in right ? right.key : ''),
        );
        let index = 0;
        children = children.map((entry) => (sortable.includes(entry) ? sorted[index++]! : entry));
        rules.add(orderRule);
      }
    }
    return { ...node, children };
  });
  return result.filter(
    (node) =>
      !(
        'children' in node &&
        !node.children.length &&
        node.kind === 'group' &&
        ((parent?.name === 'page' && node.name === 'security') ||
          (parent?.name === 'region' && ['chart', 'layout'].includes(node.name)))
      ),
  );
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
    const rules = new Set<string>();
    if (
      canonical(left) !== canonical(removeQualifiedDefault(left)) ||
      canonical(right) !== canonical(removeQualifiedDefault(right))
    )
      rules.add(defaultRule);
    if (
      canonical(normalizeExport(removeQualifiedDefault(left), rules)) ===
      canonical(normalizeExport(removeQualifiedDefault(right), rules))
    )
      return { equivalent: true, rules: [formattingRule, ...rules] };
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
