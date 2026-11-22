import fs from 'node:fs';
import path from 'node:path';
import { isObject, isRef, type ApxApplication, type ApxComponent, type ApxValue } from './apexlang.ts';

/**
 * Source index of a previewed application: one signature per `.apx` file (size and mtime), the
 * files that changed between two loads, and the pages a change affects. Page files affect their
 * own page; a shared component file affects the pages that reference one of its components; the
 * application, the global page, a theme or anything unrecognized affects every page.
 */

export type Signatures = Map<string, string>;

/** Every `.apx` file (relative, '/'-separated) with its size and modification time. */
export function apxSignatures(root: string): Signatures {
  const out: Signatures = new Map();
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'static-files') continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith('.apx')) {
        const info = fs.statSync(full);
        out.set(path.relative(root, full).split(path.sep).join('/'), `${info.size}:${info.mtimeMs}`);
      }
    }
  };
  visit(root);
  return out;
}

export function changedFiles(before: Signatures, after: Signatures): string[] {
  const files = new Set<string>();
  for (const [file, signature] of after) if (before.get(file) !== signature) files.add(file);
  for (const file of before.keys()) if (!after.has(file)) files.add(file);
  return [...files].sort();
}

function refsOf(value: ApxValue | undefined, into: Set<string>): void {
  if (value === undefined) return;
  if (isRef(value)) into.add(value.ref.toLowerCase());
  else if (Array.isArray(value)) for (const entry of value) refsOf(entry, into);
  else if (isObject(value)) for (const entry of Object.values(value)) refsOf(entry, into);
}

function componentRefs(component: ApxComponent, into: Set<string>): Set<string> {
  refsOf(component.props, into);
  for (const child of component.children) componentRefs(child, into);
  return into;
}

function ids(component: ApxComponent, into: Set<string>): Set<string> {
  into.add(component.id.toLowerCase());
  for (const child of component.children) ids(child, into);
  return into;
}

/** Pages a set of changed files affects, judged against the applications before and after. */
export function affectedPages(
  files: string[],
  applications: (ApxApplication | undefined)[],
): string[] | 'all' {
  const pages = new Set<string>();
  for (const file of files) {
    let known = false;
    for (const app of applications) {
      if (!app) continue;
      for (const [id, page] of app.pages)
        if (page.file === file) {
          known = true;
          if (id === '0') return 'all';
          pages.add(id);
        }
      const defined = app.shared.filter((component) => component.file === file);
      if (app.app.file === file || defined.some((component) => component.type === 'theme')) return 'all';
      if (!defined.length) continue;
      known = true;
      const names = new Set<string>();
      for (const component of defined) ids(component, names);
      for (const [id, page] of app.pages) {
        const refs = componentRefs(page, new Set());
        if ([...names].some((name) => refs.has(name))) {
          if (id === '0') return 'all';
          pages.add(id);
        }
      }
    }
    // A file neither application knows (a parse error, a new kind of file): reload everything.
    if (!known) return 'all';
  }
  return [...pages].sort((a, b) => Number(a) - Number(b));
}

/** Region types whose server-rendered body can be replaced in place by the preview's refresh. */
export const REPLACEABLE_REGIONS = new Set(['staticContent', 'classicReport', 'interactiveReport', 'cards']);

const shape = (component: ApxComponent): string =>
  JSON.stringify(component, (key, value) => (key === 'line' || key === 'file' ? undefined : value));

/**
 * When a page edit changed only allowlisted regions in place, the ids of those regions; otherwise
 * undefined and the page reloads. Anything else that changed (page properties, items, buttons,
 * processes, dynamic actions, added or removed components, sub-regions) needs a full reload.
 */
export function replaceableRegions(
  before: ApxComponent | undefined,
  after: ApxComponent | undefined,
  domId: (region: ApxComponent) => string,
): string[] | undefined {
  if (!before || !after) return undefined;
  const strip = (page: ApxComponent) => ({ ...page, children: [] as ApxComponent[] });
  if (shape(strip(before)) !== shape(strip(after))) return undefined;
  if (before.children.length !== after.children.length) return undefined;
  const changed: ApxComponent[] = [];
  for (let index = 0; index < after.children.length; index++) {
    const old = before.children[index]!;
    const next = after.children[index]!;
    if (old.type !== next.type || old.id !== next.id) return undefined;
    if (shape(old) === shape(next)) continue;
    if (next.type !== 'region' || !REPLACEABLE_REGIONS.has(String(next.props.type ?? ''))) return undefined;
    changed.push(next);
  }
  if (!changed.length) return undefined;
  // A region that holds sub-regions renders them inside itself: reload instead.
  for (const region of changed)
    for (const child of after.children)
      if (
        child.type === 'region' &&
        JSON.stringify(child.props.layout ?? {}).includes(`"ref":"${region.id}"`)
      )
        return undefined;
  return changed.map(domId);
}
