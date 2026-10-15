import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { canonical, contained, hash } from './fs.ts';

export const APEXLANG_EQUIVALENCE_POLICY = 'apex262-selected-source-v1';
const formattingRule = 'structural-whitespace-and-comments';
const defaultRule = 'pageItem.selectList.layout.startNewRow:true-default';
const pageDefaultRule = 'page.security.pageAccessProtection:argumentsMustHaveChecksum-default';
const regionDefaultRule = 'region.layout.startNewRow:true-default';
const chartDefaultRule = 'region.chart.type:bar-default';
const cursorDefaultRule = 'page.navigation.cursorFocus:doNotFocusCursor-default';
const autocompleteDefaultRule = 'page.security.formAutoComplete:false-default';
const paginationDefaultRule = 'region.classicReport.pagination.type:nextAndPreviousLinks-default';
const orderRule = 'explicit-unique-region-and-chart-component-order';
const columnOrderRule = 'explicit-unique-report-column-order';
const memberOrderRule = 'unique-property-and-group-order';
const quotedLiteralRule = 'single-line-literal-quoting';
const invokeDefaultRule = 'invokeApi.parameter.direction:in,dataType:varchar2,ignoreOutput:false-default';
const invokeCaseRule = 'invokeApi.invoke.identifier-case';
const eventDefaultRule = 'dynamicAction.when.items.event:change-default';
const componentOrderRule = 'key-ordered-page-components';
const limit = 8 * 1024 * 1024;

type Node =
  | { kind: 'property'; name: string; value: string; literal?: string; indent?: string }
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
      // A fenced payload belongs to the empty-valued property directly before it.
      const siblings = stack.at(-1)?.children ?? roots;
      const owner = siblings.at(-1);
      if (owner?.kind === 'property' && owner.value === '' && owner.literal === undefined) {
        owner.literal = literal;
        owner.indent = /^[ \t]*/.exec(line)![0];
      } else append({ kind: 'literal', value: literal });
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
      } else if (value === '[') {
        // Scalar lists (templateOptions, items, pageItemsToSubmit) keep their item order.
        const items: string[] = [];
        let closed = false;
        while (++index < lines.length) {
          const entry = lines[index]!.trim();
          if (entry === ']') {
            closed = true;
            break;
          }
          if (!entry || /[[\]{}()]$|^```/.test(entry)) throw new Error('Unsupported list entry.');
          items.push(entry);
        }
        if (!closed) throw new Error('Unclosed list.');
        append({ kind: 'property', name: property[1]!, value: '[' + items.join('\n') + ']' });
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
    // Defaults pinned by the Oracle 26.2 reference (page.md: cursorFocus NO_FIRST_ITEM,
    // formAutoComplete OFF; region.md classic report pagination NEXT_PREVIOUS_LINKS)
    // and confirmed by native page exports that omit them.
    if (node.kind === 'group' && node.name === 'security' && parent?.name === 'page') {
      omit('pageAccessProtection', 'argumentsMustHaveChecksum', pageDefaultRule);
      omit('formAutoComplete', 'false', autocompleteDefaultRule);
    }
    if (node.kind === 'group' && node.name === 'navigation' && parent?.name === 'page')
      omit('cursorFocus', 'doNotFocusCursor', cursorDefaultRule);
    if (
      node.kind === 'group' &&
      node.name === 'pagination' &&
      parent?.kind === 'component' &&
      parent.name === 'region' &&
      parent.children.some(
        (entry) => entry.kind === 'property' && entry.name === 'type' && entry.value === 'classicReport',
      )
    )
      omit('type', 'nextAndPreviousLinks', paginationDefaultRule);
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
            ['axis', 'series'].includes(entry.name)) ||
          (node.name === 'region' &&
            node.children.some(
              (child) =>
                child.kind === 'property' && child.name === 'type' && child.value === 'classicReport',
            ) &&
            entry.name === 'column')),
    );
    if (sortable.length > 1) {
      const sequence = (entry: Node) => {
        if (!('children' in entry)) return undefined;
        if (entry.name === 'axis') return entry.key === 'x' || entry.key === 'y' ? entry.key : undefined;
        const group = entry.children.find(
          (child) =>
            child.kind === 'group' && child.name === (entry.name === 'series' ? 'execution' : 'layout'),
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
        rules.add(
          sortable.some((entry) => 'name' in entry && entry.name === 'column') ? columnOrderRule : orderRule,
        );
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
        ((parent?.name === 'page' && ['security', 'navigation'].includes(node.name)) ||
          (parent?.name === 'region' && ['chart', 'layout', 'pagination'].includes(node.name)))
      ),
  );
}

const identifier = /^[A-Za-z][A-Za-z0-9_$#]*$/;

/**
 * Forms observed in real Oracle APEX 26.2.0 APEXlang exports of authored pages
 * (local DEV readbacks, 2026-10-15): single-line fenced code is exported as a
 * JSON-quoted scalar, invokeApi parameter defaults and empty parameter groups are
 * elided, invoke identifiers are upper-cased, and an items-selection dynamic
 * action omits its default change event. Nothing else is rewritten.
 */
function normalizeForms(
  nodes: Node[],
  rules: Set<string>,
  parent?: Extract<Node, { children: Node[] }>,
): Node[] {
  const result: Node[] = [];
  for (const node of nodes) {
    if (node.kind === 'property') {
      if (node.literal !== undefined) {
        const lines = node.literal.split(/\r\n|\r|\n/);
        // [fence, content, fence, ''] — exactly one content line without a trailing fence on it.
        const content = lines.length === 4 && lines[3] === '' ? lines[1]! : undefined;
        if (content !== undefined && content.startsWith(node.indent ?? '') && lines[2] === '```') {
          result.push({
            kind: 'property',
            name: node.name,
            value: JSON.stringify(content.slice((node.indent ?? '').length)),
          });
          rules.add(quotedLiteralRule);
          continue;
        }
        result.push(node);
        continue;
      }
      if (/^".*"$/.test(node.value)) {
        try {
          const decoded = JSON.parse(node.value);
          if (typeof decoded === 'string' && JSON.stringify(decoded) !== node.value) {
            result.push({ ...node, value: JSON.stringify(decoded) });
            continue;
          }
        } catch {
          // Not JSON: keep the exact scalar.
        }
      }
      if (
        parent?.kind === 'group' &&
        parent.name === 'invoke' &&
        ['package', 'procedureOrFunction'].includes(node.name) &&
        identifier.test(node.value)
      ) {
        if (node.value !== node.value.toUpperCase()) rules.add(invokeCaseRule);
        result.push({ ...node, value: node.value.toUpperCase() });
        continue;
      }
      result.push(node);
      continue;
    }
    if (!('children' in node)) {
      result.push(node);
      continue;
    }
    let children = normalizeForms(node.children, rules, node);
    const scalar = (name: string) => {
      const matches = children.filter((entry) => entry.kind === 'property' && entry.name === name);
      return matches.length === 1 && matches[0]!.kind === 'property' ? matches[0]! : undefined;
    };
    if (
      node.kind === 'group' &&
      node.name === 'parameter' &&
      parent?.kind === 'component' &&
      parent.name === 'parameter'
    ) {
      for (const [name, value] of [
        ['direction', 'in'],
        ['dataType', 'varchar2'],
        ['ignoreOutput', 'false'],
      ] as const) {
        const entry = scalar(name);
        if (entry?.kind === 'property' && entry.value === value) {
          children = children.filter((child) => child !== entry);
          rules.add(invokeDefaultRule);
        }
      }
      if (!children.length) {
        rules.add(invokeDefaultRule);
        continue;
      }
    }
    if (
      node.kind === 'group' &&
      node.name === 'when' &&
      parent?.kind === 'component' &&
      parent.name === 'dynamicAction'
    ) {
      const event = scalar('event'),
        selection = scalar('selectionType');
      if (
        event?.kind === 'property' &&
        event.value === 'change' &&
        selection?.kind === 'property' &&
        selection.value === 'items'
      ) {
        children = children.filter((child) => child !== event);
        rules.add(eventDefaultRule);
      }
    }
    result.push({ ...node, children });
  }
  return result;
}

/**
 * Oracle 26.2 exports page items, buttons, dynamic actions, validations,
 * processes, process parameters and dynamic-action steps ordered by key. Their
 * runtime order comes from explicit sequence properties, so file order is
 * ignored only when every sibling has a unique key and an explicit sequence.
 */
const sequencedComponents: Record<string, Record<string, [string, string]>> = {
  page: {
    region: ['layout', 'sequence'],
    pageItem: ['layout', 'sequence'],
    button: ['layout', 'sequence'],
    dynamicAction: ['execution', 'sequence'],
    validation: ['execution', 'sequence'],
    process: ['execution', 'sequence'],
    computation: ['execution', 'sequence'],
    branch: ['execution', 'sequence'],
  },
  process: { parameter: ['advanced', 'displaySequence'] },
  dynamicAction: { action: ['execution', 'sequence'] },
};
const componentKey = (node: Node) =>
  ('name' in node ? node.name : '') + ':' + ('key' in node ? node.key : '');
function orderComponents(nodes: Node[], rules: Set<string>): Node[] {
  return nodes.map((node) => {
    if (!('children' in node)) return node;
    let children = orderComponents(node.children, rules);
    const allowed = node.kind === 'component' ? sequencedComponents[node.name] : undefined;
    const components = children.filter((child) => child.kind === 'component');
    if (allowed && components.length > 1) {
      const qualified = components.every((child) => {
        if (child.kind !== 'component' || !allowed[child.name]) return false;
        const [groupName, propertyName] = allowed[child.name]!;
        const group = child.children.find((entry) => entry.kind === 'group' && entry.name === groupName);
        return (
          !!group &&
          'children' in group &&
          group.children.some(
            (entry) => entry.kind === 'property' && entry.name === propertyName && /^\d+$/.test(entry.value),
          )
        );
      });
      const keys = components.map(componentKey);
      if (qualified && new Set(keys).size === keys.length) {
        const sorted = [...components].sort((left, right) =>
          componentKey(left).localeCompare(componentKey(right)),
        );
        if (sorted.some((child, index) => child !== components[index])) rules.add(componentOrderRule);
        let index = 0;
        children = children.map((child) => (child.kind === 'component' ? sorted[index++]! : child));
      }
    }
    return { ...node, children };
  });
}

/** Properties, groups and maps are keyed by unique name; only components keep sequence rules. */
function orderMembers(nodes: Node[], rules: Set<string>): Node[] {
  return nodes.map((node) => {
    if (!('children' in node)) return node;
    let children = orderMembers(node.children, rules);
    if (!children.some((child) => child.kind === 'literal')) {
      const members = children.filter((child) => child.kind !== 'component');
      const names = members.map((child) => child.kind + ':' + ('name' in child ? child.name : ''));
      if (new Set(names).size === names.length) {
        const sorted = [...members].sort((left, right) =>
          (left.kind + ':' + ('name' in left ? left.name : '')).localeCompare(
            right.kind + ':' + ('name' in right ? right.name : ''),
          ),
        );
        if (sorted.some((child, index) => child !== members[index])) rules.add(memberOrderRule);
        children = [...sorted, ...children.filter((child) => child.kind === 'component')];
      }
    }
    return { ...node, children };
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
    const formRules = new Set(rules);
    const normalized = (nodes: Node[]) =>
      orderComponents(
        orderMembers(
          normalizeExport(normalizeForms(removeQualifiedDefault(nodes), formRules), formRules),
          formRules,
        ),
        formRules,
      );
    if (canonical(normalized(left)) === canonical(normalized(right)))
      return { equivalent: true, rules: [formattingRule, ...formRules] };
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
