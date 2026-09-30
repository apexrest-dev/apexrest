import { Fault } from '../result.ts';
import { hash } from '../fs.ts';

export interface Declaration {
  kind: string;
  key: string;
  start: number;
  end: number;
  depth: number;
  digest: string;
}
/** Bounded line/CST scanner. Fenced literals are opaque; original bytes are retained. */
export function declarations(source: string): Declaration[] {
  if (Buffer.byteLength(source) > 8 * 1024 * 1024)
    throw new Fault('TRANSFORM_UNSUPPORTED', 'Source exceeds the bounded reader limit.', 5);
  const lines = [...source.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)].filter((m) => m[0].length);
  const stack: { kind: string; key: string; start: number; depth: number }[] = [],
    out: Declaration[] = [];
  let fence = false;
  for (const line of lines) {
    const text = line[0].replace(/[\r\n]+$/, '');
    if (/^\s*```/.test(text)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const open = text.match(/^( *)([A-Za-z][\w]*)(?:\s+(.*?))?\s*\(\s*$/);
    if (open) stack.push({ kind: open[2]!, key: open[3] ?? '', start: line.index!, depth: open[1]!.length });
    else if (/^ *\)\s*$/.test(text)) {
      const node = stack.pop();
      if (!node || node.depth !== text.indexOf(')'))
        throw new Fault('TRANSFORM_UNSUPPORTED', 'Unbalanced declaration boundary.', 5);
      const end = line.index! + line[0].length;
      out.push({ ...node, end, digest: hash(source.slice(node.start, end)) });
    }
  }
  if (fence || stack.length) throw new Fault('TRANSFORM_UNSUPPORTED', 'Unclosed literal or declaration.', 5);
  return out.sort((a, b) => a.start - b.start);
}
export function inventorySymbols(sources: Record<string, string>) {
  const pages = new Set<number>(),
    symbols = new Set<string>();
  for (const source of Object.values(sources))
    for (const node of declarations(source)) {
      if (node.kind === 'page' && /^\d+$/.test(node.key)) pages.add(Number(node.key));
      if (node.key) symbols.add(node.key.toUpperCase());
    }
  return { pages, symbols };
}
export function editSpans(
  source: string,
  edits: { start: number; end: number; expectedDigest: string; content: string }[],
) {
  let result = source,
    previous = source.length + 1;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    if (
      edit.start < 0 ||
      edit.end > previous ||
      edit.start > edit.end ||
      hash(source.slice(edit.start, edit.end)) !== edit.expectedDigest
    )
      throw new Fault('TRANSFORM_CONFLICT', 'Overlapping or stale structural edit.', 5);
    result = result.slice(0, edit.start) + edit.content + result.slice(edit.end);
    previous = edit.start;
  }
  return result;
}
/** Merge only disjoint, same-line typed property edits. Unknown structural/code edits conflict. */
export function threeWay(base: string, local: string, next: string) {
  if (local === base) return next;
  if (next === base || local === next) return local;
  const variants = [base, local, next],
    roots = variants.map(declarations);
  const rootDepth = roots[0]?.[0]?.depth;
  if (rootDepth !== undefined && roots.every((nodes) => nodes[0]?.depth === rootDepth)) {
    const children = roots.map((nodes) => nodes.filter((node) => node.depth === rootDepth + 4));
    const maps = children.map(
      (nodes, i) =>
        new Map(
          nodes.map((node) => [
            node.kind + ':' + node.key,
            { node, content: variants[i]!.slice(node.start, node.end) },
          ]),
        ),
    );
    if (maps.some((map, i) => map.size !== children[i]!.length))
      throw new Fault('COMPOSITION_CONFLICT', 'Repeated sibling anchors are unsupported.', 5);
    const scaffold = (value: string, nodes: Declaration[]) =>
      editSpans(
        value,
        nodes.map((node) => ({ ...node, expectedDigest: node.digest, content: '' })),
      );
    const wrappers = variants.map((v, i) => scaffold(v, children[i]!));
    const wrapper = mergeLines(wrappers[0]!, wrappers[1]!, wrappers[2]!);
    const edits: { start: number; end: number; expectedDigest: string; content: string }[] = [];
    const additions: string[] = [];
    for (const key of new Set([...maps[1]!.keys(), ...maps[2]!.keys()])) {
      const b = maps[0]!.get(key),
        l = maps[1]!.get(key),
        n = maps[2]!.get(key);
      let content: string | undefined;
      if (!b) {
        if (l && n && l.content !== n.content)
          throw new Fault('COMPOSITION_CONFLICT', 'New declaration collides with local source.', 5);
        content = l?.content ?? n?.content;
      } else if (!n) {
        if (l && l.content !== b.content)
          throw new Fault('COMPOSITION_CONFLICT', 'Removing an edited declaration requires detach.', 5);
        content = '';
      } else if (!l) {
        if (n.content !== b.content)
          throw new Fault(
            'COMPOSITION_CONFLICT',
            'A locally removed declaration changed in the generator.',
            5,
          );
      } else content = threeWay(b.content, l.content, n.content);
      if (l && content !== undefined && content !== l.content)
        edits.push({ ...l.node, expectedDigest: l.node.digest, content });
      else if (!l && !b && content) additions.push(content);
    }
    // Translate scaffold offsets back to local offsets. Unmanaged children and all gaps
    // retain their exact positions/bytes; only changed spans are replaced.
    const translate = (offset: number) => {
      let skipped = 0;
      for (const child of children[1]!) {
        if (child.start - skipped > offset) break;
        skipped += child.end - child.start;
      }
      return offset + skipped;
    };
    let cursor = 0;
    const originalLines = wrappers[1]!.split('\n'),
      mergedLines = wrapper.split('\n');
    originalLines.forEach((line, i) => {
      if (line !== mergedLines[i]) {
        const start = translate(cursor),
          end = start + line.length;
        edits.push({ start, end, expectedDigest: hash(local.slice(start, end)), content: mergedLines[i]! });
      }
      cursor += line.length + 1;
    });
    if (additions.length) {
      const root = roots[1]![0]!,
        close = local.lastIndexOf(')', root.end - 1),
        start = local.lastIndexOf('\n', close) + 1;
      edits.push({ start, end: start, expectedDigest: hash(''), content: additions.join('') });
    }
    return editSpans(local, edits);
  }
  return mergeLines(base, local, next);
}
function mergeLines(base: string, local: string, next: string) {
  if (local === base) return next;
  if (next === base || local === next) return local;
  const literals = [base, local, next].map((source) =>
    [...source.matchAll(/```[^\r\n]*[\r\n]+[\s\S]*?^[ \t]*```/gm)].map((match) => match[0]),
  );
  if (
    literals[0]!.length !== literals[1]!.length ||
    literals[0]!.length !== literals[2]!.length ||
    literals[0]!.some(
      (value, i) =>
        value !== literals[1]![i] && value !== literals[2]![i] && literals[1]![i] !== literals[2]![i],
    )
  )
    throw new Fault(
      'COMPOSITION_CONFLICT',
      'Concurrent changes to an opaque code literal require explicit review.',
      5,
    );
  const b = base.split('\n'),
    l = local.split('\n'),
    n = next.split('\n');
  if (b.length !== l.length || b.length !== n.length)
    throw new Fault(
      'COMPOSITION_CONFLICT',
      'Structural changes require explicit adoption or conflict resolution.',
      5,
    );
  return b
    .map((line, i) => {
      if (l[i] === line) return n[i]!;
      if (n[i] === line || l[i] === n[i]) return l[i]!;
      throw new Fault('COMPOSITION_CONFLICT', `Both local and generated source changed line ${i + 1}.`, 5);
    })
    .join('\n');
}
