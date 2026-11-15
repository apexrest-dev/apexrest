import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { resourceRoot } from './project.ts';
import { referenceStems } from './reference-index.ts';

/** A working APEXlang block for one component type, cut from an Oracle 26.2 sample page. */
export interface ComponentExample {
  /** Public template page the block comes from (readable with apexrest_reference mode:read). */
  id: string;
  /** The component block: from its `region|pageItem|... (` line to the matching `)`. */
  text: string;
}

const MIN_BLOCK = 250;
const MAX_BLOCK = 4000;
/** Smallest blocks kept per component; the request picks among them (a line chart over a pie). */
const KEEP = 8;
const TYPE_LINE = /^\s*type: (?:[A-Za-z]+\/)?([A-Za-z][A-Za-z0-9]*)\s*$/u;
// Data-source and code types (sqlQuery, plsqlFunctionBody) say nothing about the variant shown.
const SOURCE_TYPES = new Set([
  'sql',
  'query',
  'plsql',
  'function',
  'body',
  'expression',
  'static',
  'table',
  'local',
  'item',
  'page',
  'region',
  'none',
  'default',
  'code',
]);
const OPENER = /^(\s*)([a-z][A-Za-z]*)\b.*\($/u;
/** Page components whose property usage is counted across the samples. */
const USAGE_KINDS = new Set([
  'region',
  'pageItem',
  'button',
  'process',
  'dynamicAction',
  'validation',
  'branch',
]);

type Indexed = ComponentExample & { stems: Set<string>; types: Set<string>; chartType?: string | undefined };
/**
 * Per component key: how many sample blocks there are, how many state each `group.property` and
 * which name-like values (enum values, not free text) they give it.
 */
type Usage = { blocks: number; properties: Map<string, { count: number; values: Map<string, number> }> };
/** Distinct values remembered per property; free text exhausts it without growing further. */
const MAX_VALUES = 32;
let examples: Promise<{ index: Map<string, Indexed[]>; usage: Map<string, Usage> }> | undefined;

const indent = (line: string) => line.length - line.trimStart().length;

/** The original APEXlang inside a public template document (between its BEGIN/END markers). */
function sourceOf(document: string): string | undefined {
  const begin = document.indexOf('````apexlang\n');
  if (begin < 0) return undefined;
  const end = document.indexOf('\n````', begin + 13);
  return end < 0 ? undefined : document.slice(begin + 13, end);
}

/**
 * Every component block of a page: `keyword name (` … `)`. The key is `keyword:type` when the
 * block declares its own `type:` (a direct property, not one inside a group), otherwise `keyword`.
 */
function* blocks(lines: string[]) {
  for (const [start, line] of lines.entries()) {
    const opener = OPENER.exec(line.trimEnd());
    if (!opener) continue;
    const depth = opener[1]!.length;
    let end = start + 1;
    while (end < lines.length && !(lines[end]!.trim() === ')' && indent(lines[end]!) === depth)) end += 1;
    if (end >= lines.length) continue;
    let type: string | undefined;
    for (let at = start + 1; at < end && !type; at += 1)
      if (indent(lines[at]!) === depth + 4) type = TYPE_LINE.exec(lines[at]!)?.[1];
    yield { keyword: opener[2]!, type, text: lines.slice(start, end + 1).join('\n') };
  }
}

/** The block's own `group.property` paths (direct properties as `property`) and values, nested blocks excluded. */
function ownProperties(text: string): Map<string, string> {
  const lines = text.split('\n');
  const depth = indent(lines[0]!);
  const found = new Map<string, string>();
  let group = '';
  let skip = -1;
  for (const line of lines.slice(1, -1)) {
    const at = indent(line);
    if (!line.trim() || (skip >= 0 && at > skip)) continue;
    skip = -1;
    if (at === depth + 4) {
      group = /^\s*([A-Za-z]\w*) \{$/u.exec(line)?.[1] ?? '';
      if (OPENER.test(line.trimEnd())) skip = at;
    }
    const property = /^\s*([A-Za-z]\w*): (\S.*)$/u.exec(line);
    if (property && (at === depth + 4 || (group && at === depth + 8)))
      found.set(at === depth + 4 ? property[1]! : `${group}.${property[1]}`, property[2]!.trimEnd());
  }
  return found;
}

function keep(index: Map<string, Indexed[]>, key: string, example: Indexed) {
  const list = index.get(key) ?? [];
  list.push(example);
  list.sort((a, b) => a.text.length - b.text.length);
  index.set(key, list.slice(0, KEEP));
}

async function load(): Promise<{ index: Map<string, Indexed[]>; usage: Map<string, Usage> }> {
  const root = path.join(resourceRoot(), 'public-templates', '26.2', 'documents');
  const index = new Map<string, Indexed[]>();
  const usage = new Map<string, Usage>();
  let applications: string[];
  try {
    applications = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return { index, usage };
  }
  for (const application of applications.sort()) {
    const pages = (await readdir(path.join(root, application))).filter((f) => /^p\d+.*\.md$/u.test(f)).sort();
    for (const page of pages) {
      const source = sourceOf(await readFile(path.join(root, application, page), 'utf8'));
      if (!source) continue;
      const id = `oracle:26.2:public-template/${application}/${page.replace(/\.md$/u, '')}`;
      for (const block of blocks(source.split('\n'))) {
        const key = block.type ? `${block.keyword}:${block.type}` : block.keyword;
        if (USAGE_KINDS.has(block.keyword)) {
          const counted: Usage = usage.get(key) ?? { blocks: 0, properties: new Map() };
          counted.blocks += 1;
          for (const [property, value] of ownProperties(block.text)) {
            const seen = counted.properties.get(property) ?? { count: 0, values: new Map<string, number>() };
            seen.count += 1;
            if (/^[A-Za-z][\w/-]*$/u.test(value) && (seen.values.has(value) || seen.values.size < MAX_VALUES))
              seen.values.set(value, (seen.values.get(value) ?? 0) + 1);
            counted.properties.set(property, seen);
          }
          usage.set(key, counted);
        }
        if (block.text.length < MIN_BLOCK || block.text.length > MAX_BLOCK) continue;
        const types = new Set(
          [...block.text.matchAll(/^\s*type: (?:[A-Za-z]+\/)?([A-Za-z]\w*)\s*$/gmu)]
            .flatMap((m) => referenceStems(m[1]!))
            .filter((stem) => !SOURCE_TYPES.has(stem)),
        );
        // Oracle's pinned chart contract defaults chart.type to bar. Exported
        // bars commonly omit the whole chart group, so index that variant too.
        const chartType =
          block.keyword === 'region' && block.type === 'chart'
            ? (/\n\s*chart \{\s*\n\s*type: (\w+)/u.exec(block.text)?.[1]?.toLowerCase() ?? 'bar')
            : undefined;
        if (chartType) types.add(chartType);
        const example = {
          id,
          text: block.text,
          stems: new Set(referenceStems(block.text)),
          types,
          chartType,
        };
        keep(index, key, example);
        // Keep each chart variant independently: eight tiny pies must not evict
        // every bar/line example before request-aware ranking can see them.
        if (block.keyword === 'region' && block.type === 'chart')
          for (const variant of types) keep(index, `${key}:${variant}`, example);
        if (block.type) keep(index, `*:${block.type}`, example);
      }
    }
  }
  return { index, usage };
}

/** How Oracle's sample blocks of a component use one `group.property`. */
export interface PropertyUsage {
  property: string;
  /** Share of the component's sample blocks that state the property. */
  share: number;
  /** Name-like values the samples give it, most frequent first. */
  values: string[];
  /** Share of those values taken by the most frequent one: 1 when the samples never vary it. */
  dominance: number;
}

/**
 * The `group.property` paths that Oracle's sample blocks of a component state, most frequent
 * first: what a first draft of the component will probably set, whether or not the one attached
 * example shows it, and which values the samples really use.
 */
export async function componentUsage(kind: string, type: string | undefined): Promise<PropertyUsage[]> {
  examples ??= load();
  const counted = (await examples).usage.get(type ? `${kind}:${type}` : kind);
  if (!counted) return [];
  return [...counted.properties]
    .map(([property, seen]) => {
      const values = [...seen.values].sort((a, b) => b[1] - a[1]);
      const total = values.reduce((sum, [, count]) => sum + count, 0);
      return {
        property,
        share: seen.count / counted.blocks,
        values: values.map(([value]) => value),
        dominance: total ? values[0]![1] / total : 1,
      };
    })
    .sort((a, b) => b.share - a.share);
}

/**
 * A working block for an APEXlang component such as a classicReport region, a switch page item or
 * a button (template components are declared as themeTemplateComponent/metricCard). `kind` is the
 * block keyword (region, pageItem, process, button); `request` prefers the variant it describes.
 * Built once per process from Oracle's 26.2 sample applications.
 */
export async function componentExample(
  type: string | undefined,
  options: { kind?: string | undefined; request?: string | undefined } = {},
): Promise<ComponentExample | undefined> {
  examples ??= load();
  const { index } = await examples;
  const key = type ? `${options.kind ?? '*'}:${type}` : options.kind;
  const list = key ? (index.get(key) ?? (type ? index.get(`*:${type}`) : undefined)) : undefined;
  if (!list?.length) return undefined;
  const wanted = new Set(referenceStems(options.request ?? ''));
  // A nested `type: line` the request names outweighs shared vocabulary; ties keep the smallest.
  const overlap = (example: Indexed) =>
    (example.chartType && wanted.has(example.chartType) ? 1000 : 0) +
    [...wanted].reduce(
      (score, stem) => score + (example.types.has(stem) ? 100 : 0) + (example.stems.has(stem) ? 1 : 0),
      0,
    );
  const variants =
    type === 'chart' ? [...wanted].flatMap((stem) => index.get(`region:chart:${stem}`) ?? []) : [];
  const best = [...list, ...variants].reduce((a, b) => (overlap(b) > overlap(a) ? b : a));
  return { id: best.id, text: best.text };
}

/** The component type an inventory contract title names: `plugin-variants/classicReport — …` → classicReport. */
export function contractComponentType(title: string): string | undefined {
  const name = title.split(' — ')[0]!.split('/').at(-1)!.trim();
  return /^[A-Za-z][A-Za-z0-9]*$/u.test(name) ? name : undefined;
}

/**
 * The block keyword and type an inventory contract ID describes:
 * `…/page/page-item/plugin-variants/switch/switch` → pageItem + switch, `…/page/button/button` → button.
 */
export function contractComponent(id: string): { kind: string; type?: string } | undefined {
  const at = id.indexOf('inventory/app/page/');
  if (at < 0) return undefined;
  const segments = id.slice(at + 'inventory/app/page/'.length).split('/');
  const camel = (s: string) => s.replace(/-([a-z])/gu, (_m, c: string) => c.toUpperCase());
  const variant = segments.findIndex((s) => s === 'plugin-variants' || s === 'template-component');
  if (variant === 1) return { kind: camel(segments[0]!), type: camel(segments[2]!) };
  if (segments.length === 2 && segments[0] === segments[1]) return { kind: camel(segments[0]!) };
  return undefined;
}

/** A whole sample page for a page pattern the request describes, such as a modal form page. */
export interface PageExample extends ComponentExample {
  pattern: string;
}

// Each pattern names what its page must contain; the smallest complete Oracle sample page wins.
const PAGE_PATTERNS: { pattern: string; request: RegExp[]; contains: RegExp[] }[] = [
  {
    pattern: 'modal form page (create, save, delete, cancel, close dialog, row processing)',
    request: [/\b(?:modal|dialog)\b/iu, /\bform\b/iu],
    contains: [
      /^\s*pageMode: modalDialog\s*$/mu,
      /^\s{4}region \S+ \(\n\s+name: .*\n\s+type: form\s*$/mu,
      /^\s*type: formAutoRowProcessing\s*$/mu,
      /^\s*type: closeDialog\s*$/mu,
      /^\s*type: formInitialization\s*$/mu,
      /^\s{4}button create \(/mu,
      /^\s{4}button delete \(/mu,
      /^\s{4}button save \(/mu,
      /^\s{4}dynamicAction /mu,
    ],
  },
];
const MAX_PAGE = 9000;
let pages: Promise<Map<string, ComponentExample>> | undefined;

async function loadPages(): Promise<Map<string, ComponentExample>> {
  const root = path.join(resourceRoot(), 'public-templates', '26.2', 'documents');
  const best = new Map<string, ComponentExample>();
  let applications: string[];
  try {
    applications = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return best;
  }
  for (const application of applications.sort())
    for (const page of (await readdir(path.join(root, application)))
      .filter((f) => /^p\d+.*\.md$/u.test(f))
      .sort()) {
      const text = sourceOf(await readFile(path.join(root, application, page), 'utf8'));
      if (!text || text.length > MAX_PAGE) continue;
      for (const { pattern, contains } of PAGE_PATTERNS) {
        if (!contains.every((re) => re.test(text))) continue;
        const current = best.get(pattern);
        if (!current || text.length < current.text.length)
          best.set(pattern, {
            id: `oracle:26.2:public-template/${application}/${page.replace(/\.md$/u, '')}`,
            text,
          });
      }
    }
  return best;
}

/** Whole sample pages for the page patterns a request describes (at most one per pattern). */
export async function pageExamples(request: string): Promise<PageExample[]> {
  const wanted = PAGE_PATTERNS.filter(({ request: words }) => words.every((re) => re.test(request)));
  if (!wanted.length) return [];
  pages ??= loadPages();
  const found = await pages;
  return wanted.flatMap(({ pattern }) => {
    const page = found.get(pattern);
    return page ? [{ pattern, ...page }] : [];
  });
}
