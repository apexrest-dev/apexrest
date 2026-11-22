import { componentRead, componentRecipeGroups } from './components.ts';
import {
  canonicalReference,
  primaryCodeBlock,
  referenceStems,
  referenceQueryTerms,
  CODE_LIMIT,
  type CodeBlock,
} from './reference-index.ts';
import { Fault } from './result.ts';

type Document = Awaited<ReturnType<typeof componentRead>>;
type Group = Awaited<ReturnType<typeof componentRecipeGroups>>['groups'][number];
type Recipe = Group['recipes'][number];
type Hit = {
  id: string;
  kind: string;
  version: string;
  recipes?: { id: string; title: string; kind: string }[];
  code?: CodeBlock;
  codeReference?: { id: string; sha256: string; requires: string[] };
  [key: string]: unknown;
};
const BUDGET = 7000;
function check(signal?: AbortSignal) {
  if (signal?.aborted) throw new Fault('CANCELLED', 'Component selection cancelled.', 6, 'cancelled');
}
/** Hydrate already-fitted 26.1 selections without changing selected identities or response caps. */
export async function hydrate261Recipes<T extends Hit>(
  results: T[],
  request: string,
  profile: string,
  size: (hits: T[]) => number,
  signal?: AbortSignal,
) {
  check(signal);
  if (profile.split('@')[0] !== '26.1') return;
  const working = results.map((hit) => ({ ...hit }));
  const compatible = (entry: Pick<Document, 'version' | 'compatibility'>, hit: T) => {
    const expected = hit.compatibility as Document['compatibility'] | undefined;
    return (
      entry.version === hit.version &&
      entry.compatibility.apexVersion === '26.1' &&
      !!expected &&
      (['apexVersion', 'themeVersion', 'mmdVersion'] as const).every(
        (key) => entry.compatibility[key] === expected[key],
      )
    );
  };
  const words = referenceStems(request),
    terms = referenceQueryTerms(request, 128);
  const named = (recipe: Recipe) => {
    const tail = referenceStems(recipe.id.split('/').at(-1)!);
    return (
      tail.length > 0 &&
      (words.some((_, start) => tail.every((word, offset) => words[start + offset] === word)) ||
        terms.some((term) =>
          term.alternatives.some(
            (alternative) =>
              alternative.length === tail.length &&
              alternative.every((word, offset) => word === tail[offset]),
          ),
        ))
    );
  };
  const groups: { owner: T; root: Group['root']; recipes: Recipe[] }[] = [];
  const owned = new Set<string>();
  for (const hit of working) {
    if (!hit.id.startsWith('component:') || hit.kind !== 'contract' || hit.version.split('@')[0] !== '26.1')
      continue;
    const context = await componentRecipeGroups(hit.id, profile);
    check(signal);
    if (!compatible(context.selected, hit)) continue;
    for (const group of context.groups) {
      if (owned.has(group.root.id)) continue;
      owned.add(group.root.id);
      const explicit = group.recipes.filter(named);
      const recipes = explicit.length
        ? explicit.slice(0, 4)
        : [group.recipes.find((recipe) => canonicalReference(recipe.id)) ?? group.recipes[0]!];
      groups.push({ owner: hit, root: group.root, recipes });
    }
  }
  if (!groups.length) return;
  for (const hit of working)
    if (groups.some((group) => group.root.id === hit.id || group.root.requires.includes(hit.id))) {
      delete hit.text;
      delete hit.code;
    }
  if (size(working) > BUDGET) return;
  const accepted: { owner: T; recipe: Recipe; document: Document }[] = [];
  for (const group of groups)
    for (const recipe of group.recipes) {
      // Verify only chosen documents. Structured relation discovery does not load every body.
      const document = await componentRead(recipe.id, 0, 8192, profile);
      check(signal);
      if (document.sha256 !== recipe.sha256 || !compatible(document, group.owner))
        throw new Fault(
          'COMPONENT_CATALOG_INVALID',
          'Ready recipe metadata changed while hydrating selection.',
          3,
        );
      const previousLinks = group.owner.recipes ?? [];
      if (previousLinks.some((link) => link.id === recipe.id)) continue;
      group.owner.recipes = [...previousLinks, { id: recipe.id, title: recipe.title, kind: recipe.kind }];
      if (size(working) > BUDGET) {
        if (previousLinks.length) group.owner.recipes = previousLinks;
        else delete group.owner.recipes;
        continue;
      }
      accepted.push({ owner: group.owner, recipe, document });
    }
  for (const { owner, recipe, document } of accepted) {
    if (owner.code) continue;
    const code = primaryCodeBlock(document.content, CODE_LIMIT);
    if (!code || code.language !== 'apexlang' || code.truncated) continue;
    owner.code = code;
    owner.codeReference = { id: recipe.id, sha256: recipe.sha256, requires: recipe.requires };
    if (size(working) > BUDGET) {
      delete owner.code;
      delete owner.codeReference;
    }
  }
  for (let i = 0; i < working.length; i++) {
    const originalCode = results[i]!.code;
    if (!working[i]!.code && originalCode) {
      working[i]!.code = originalCode;
      if (size(working) > BUDGET) delete working[i]!.code;
    }
  }
  check(signal);
  if (size(working) <= BUDGET) results.splice(0, results.length, ...working);
}
