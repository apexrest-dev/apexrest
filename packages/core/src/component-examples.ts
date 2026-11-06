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

type Indexed = ComponentExample & { stems: Set<string>; types: Set<string> };
let examples: Promise<Map<string, Indexed[]>> | undefined;

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

function keep(index: Map<string, Indexed[]>, key: string, example: Indexed) {
  const list = index.get(key) ?? [];
  list.push(example);
  list.sort((a, b) => a.text.length - b.text.length);
  index.set(key, list.slice(0, KEEP));
}

async function load(): Promise<Map<string, Indexed[]>> {
  const root = path.join(resourceRoot(), 'public-templates', '26.2', 'documents');
  const index = new Map<string, Indexed[]>();
  let applications: string[];
  try {
    applications = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return index;
  }
  for (const application of applications.sort()) {
    const pages = (await readdir(path.join(root, application))).filter((f) => /^p\d+.*\.md$/u.test(f)).sort();
    for (const page of pages) {
      const source = sourceOf(await readFile(path.join(root, application, page), 'utf8'));
      if (!source) continue;
      const id = `oracle:26.2:public-template/${application}/${page.replace(/\.md$/u, '')}`;
      for (const block of blocks(source.split('\n'))) {
        if (block.text.length < MIN_BLOCK || block.text.length > MAX_BLOCK) continue;
        const types = new Set(
          [...block.text.matchAll(/^\s*type: (?:[A-Za-z]+\/)?([A-Za-z]\w*)\s*$/gmu)]
            .flatMap((m) => referenceStems(m[1]!))
            .filter((stem) => !SOURCE_TYPES.has(stem)),
        );
        const example = { id, text: block.text, stems: new Set(referenceStems(block.text)), types };
        keep(index, block.type ? `${block.keyword}:${block.type}` : block.keyword, example);
        if (block.type) keep(index, `*:${block.type}`, example);
      }
    }
  }
  return index;
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
  const index = await examples;
  const key = type ? `${options.kind ?? '*'}:${type}` : options.kind;
  const list = key ? (index.get(key) ?? (type ? index.get(`*:${type}`) : undefined)) : undefined;
  if (!list?.length) return undefined;
  const wanted = new Set(referenceStems(options.request ?? ''));
  // A nested `type: line` the request names outweighs shared vocabulary; ties keep the smallest.
  const overlap = (example: Indexed) =>
    [...wanted].reduce(
      (score, stem) => score + (example.types.has(stem) ? 100 : 0) + (example.stems.has(stem) ? 1 : 0),
      0,
    );
  const best = list.reduce((a, b) => (overlap(b) > overlap(a) ? b : a));
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
