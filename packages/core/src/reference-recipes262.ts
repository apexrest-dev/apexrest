import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resourceRoot } from './project.ts';
import { referenceStems } from './reference-index.ts';
import { Fault } from './result.ts';

/**
 * Qualified 26.2 component recipes (`resources/components-26.2`) in reference selection. A recipe
 * is offered only when it is ready, its compiler run passed for the catalog's 26.2 MMD and its
 * current bytes and scaffold still hash to that run's inputs; anything else is left out rather
 * than offered as qualified. The returned example is the recipe's whole region block — never cut —
 * with its identity, digest, dependencies, data contract and the qualification it actually has
 * (compiler only). `apexrest_reference mode:read id:<recipe id>` returns the complete page.
 */

const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const sorted = (value: Record<string, string>) =>
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')));
/** A recipe example larger than this is returned by id only (read it), never truncated. */
export const RECIPE_TEXT_LIMIT = 6000;

interface Registry {
  apexVersion: string;
  mmdVersion: string;
  compilerVersion: string;
  scaffold: { directory: string };
  recipes: {
    id: string;
    componentId: string;
    title: string;
    directory: string;
    files: string[];
    requires: string[];
    readiness: string;
    dataContract: Record<string, unknown>;
    adaptation: string[];
    provenance: { sourceUrl: string; commit: string; license: string };
    verification: { compiler: { status: string; sourceSha256?: string; mmdVersion?: string } };
  }[];
}
export interface QualifiedRecipe {
  id: string;
  title: string;
  /** Region `type` (and template, for static content) the recipe demonstrates. */
  regionType: string;
  template: string | undefined;
  sha256: string;
  requires: string[];
  dataContract: Record<string, unknown>;
  adaptation: string[];
  source: string;
  qualification: {
    compiler: 'passed';
    compilerVersion: string;
    mmdVersion: string;
    import: 'not-run';
    browser: 'not-run';
  };
  page: string;
  region: string;
}

let loaded: Promise<QualifiedRecipe[]> | undefined;
async function files(directory: string, prefix = ''): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) output.push(...(await files(directory, relative)));
    else if (entry.isFile()) output.push(relative);
  }
  return output.sort();
}
/** The recipe's own region: the last page-level region of its page. */
function recipeRegion(page: string): string | undefined {
  const lines = page.split('\n');
  const starts = lines.flatMap((line, index) => (/^ {4}region \S+ \($/u.test(line) ? [index] : []));
  const start = starts.at(-1);
  if (start === undefined) return undefined;
  const end = lines.findIndex((line, index) => index > start && line === '    )');
  return end > start ? lines.slice(start, end + 1).join('\n') : undefined;
}

async function load(): Promise<QualifiedRecipe[]> {
  const catalog = path.join(resourceRoot(), 'components-26.2');
  let registry: Registry;
  let evidence: {
    mock: boolean;
    mmdVersion: string;
    compiler: string;
    scaffoldSha256: string;
    runs: { recipeId: string; passed: boolean; sourceSha256: string; inputFiles: Record<string, string> }[];
  };
  try {
    registry = JSON.parse(await readFile(path.join(catalog, 'recipes/registry.json'), 'utf8'));
    evidence = JSON.parse(await readFile(path.join(catalog, 'recipes/compiler-evidence.json'), 'utf8'));
  } catch {
    return [];
  }
  if (registry.apexVersion !== '26.2' || !/^26\.2\./u.test(registry.mmdVersion)) return [];
  if (
    evidence.mock ||
    evidence.mmdVersion !== registry.mmdVersion ||
    evidence.compiler !== registry.compilerVersion
  )
    return [];
  const scaffoldDir = path.join(catalog, registry.scaffold.directory);
  const scaffold: Record<string, string> = {};
  for (const file of await files(scaffoldDir))
    scaffold[file] = sha(await readFile(path.join(scaffoldDir, file)));
  if (sha(JSON.stringify(sorted(scaffold))) !== evidence.scaffoldSha256) return [];
  const qualified: QualifiedRecipe[] = [];
  for (const recipe of registry.recipes) {
    const run = evidence.runs.find((entry) => entry.recipeId === recipe.id);
    if (recipe.readiness !== 'ready' || recipe.verification.compiler.status !== 'passed' || !run?.passed)
      continue;
    const inputs = { ...scaffold };
    const texts: Record<string, string> = {};
    for (const file of recipe.files) {
      texts[file] = await readFile(path.join(catalog, recipe.directory, file), 'utf8');
      inputs[file] = sha(texts[file]);
    }
    const digest = sha(JSON.stringify(sorted(inputs)));
    // Changed bytes since the compiler run: not qualified any more, so not offered.
    if (digest !== run.sourceSha256 || digest !== recipe.verification.compiler.sourceSha256) continue;
    const page = texts['pages/p00001-home.apx'];
    const region = page && recipeRegion(page);
    if (!page || !region) continue;
    qualified.push({
      id: recipe.id,
      title: recipe.title,
      regionType: /^ {8}type: (\S+)$/mu.exec(region)?.[1] ?? '',
      template: /^ {12}template: @\/(\S+)$/mu.exec(region)?.[1],
      sha256: digest,
      requires: recipe.requires,
      dataContract: recipe.dataContract,
      adaptation: recipe.adaptation,
      source: recipe.provenance.sourceUrl,
      qualification: {
        compiler: 'passed',
        compilerVersion: registry.compilerVersion,
        mmdVersion: registry.mmdVersion,
        import: 'not-run',
        browser: 'not-run',
      },
      page,
      region,
    });
  }
  return qualified;
}
export const qualifiedRecipes262 = () => (loaded ??= load());
/** Forget the cached catalog (tests). */
export const resetRecipes262 = () => {
  loaded = undefined;
};

/**
 * The qualified 26.2 recipe for a selected component (`region` + type), preferring one whose
 * template or title the request names (an alert over a plain content block).
 */
export async function recipeFor262(kind: string, type: string | undefined, request: string) {
  if (kind !== 'region' || !type) return undefined;
  const candidates = (await qualifiedRecipes262()).filter((recipe) => recipe.regionType === type);
  if (!candidates.length) return undefined;
  const words = new Set(referenceStems(request));
  const score = (recipe: QualifiedRecipe) =>
    [...referenceStems(`${recipe.title} ${recipe.template ?? ''}`)].filter((stem) => words.has(stem)).length;
  const best = candidates.reduce((a, b) => (score(b) > score(a) ? b : a));
  const { page: _page, region, ...identity } = best;
  return region.length <= RECIPE_TEXT_LIMIT
    ? { ...identity, text: region }
    : { ...identity, read: `apexrest_reference mode:read id:${best.id}` };
}

/** `apexrest_reference mode:read` of a qualified 26.2 recipe: the complete page it compiled in. */
export async function recipe262Read(id: string, offset: number, limit: number) {
  const recipe = (await qualifiedRecipes262()).find((entry) => entry.id === id);
  if (!recipe) throw new Fault('REFERENCE_NOT_FOUND', 'No qualified 26.2 recipe with this ID.', 2);
  const content = recipe.page.slice(offset, offset + limit);
  return {
    id: recipe.id,
    title: recipe.title,
    version: '26.2',
    source: recipe.source,
    offset,
    length: recipe.page.length,
    requires: recipe.requires,
    related: [] as string[],
    relatedCount: 0,
    relatedOmittedCount: 0,
    classification: 'vendor-reference-data',
    sha256: recipe.sha256,
    content,
    nextOffset: offset + limit < recipe.page.length ? offset + limit : null,
    dataClassification: 'vendor_reference',
    qualification: recipe.qualification,
    dataContract: recipe.dataContract,
    adaptation: recipe.adaptation,
  };
}
