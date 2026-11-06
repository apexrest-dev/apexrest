import { referenceQueryTerms, referenceStems, stemmedReference } from './reference-index.ts';

export type SelectionEntry = {
  id: string;
  title: string;
  kind: string;
  family: string;
  version: string;
  readiness: string;
  text: string;
};
export type SelectionCandidate = Omit<SelectionEntry, 'text'> & { summary: string; score: number };

// Path segments that structure the inventory rather than name a component.
const structural = new Set(['inventory', 'app', 'page', 'plugin-variants', 'template-component']);
// Requests describe some components by what they do rather than by their Oracle name.
const nameAliases: Record<string, string[]> = {
  'execute-code': ['pl sql', 'plsql'],
  'page-item': ['item'],
};
const named = (phrase: string, name: string) =>
  [name.replace(/-/g, ' '), ...(nameAliases[name] ?? [])].some((words) =>
    phrase.includes(stemmedReference(words)),
  );

/**
 * Inventory contracts whose component name the request states (switch, select list, breadcrumb
 * entry, button) outrank contracts that merely share vocabulary. Property inventories of large
 * regions mention most UI words, so term overlap alone would crowd out the components named.
 */
function componentNameBoost(id: string, phrase: string) {
  const at = id.indexOf('inventory/');
  if (at < 0) return 0;
  const segments = id
    .slice(at)
    .split('/')
    .filter((segment) => !structural.has(segment));
  const name = segments.at(-1);
  if (!name) return 0;
  const parent = [...segments].reverse().find((segment) => segment !== name);
  return (named(phrase, name) ? 2000 : 0) + (parent && named(phrase, parent) ? 1000 : 0);
}

/** Broad OR retrieval for prose requests; ordinary search keeps its stricter matching rule. */
export function rankSelection(
  entries: SelectionEntry[],
  request: string,
  version: string,
): SelectionCandidate[] {
  const terms = referenceQueryTerms(request, 128);
  const phrase = stemmedReference(request);
  return entries
    .filter(
      (entry) =>
        entry.readiness !== 'unresolved' &&
        (entry.version === version || (!version.includes('@') && entry.version.split('@')[0] === version)),
    )
    .flatMap((entry) => {
      const title = new Set(referenceStems(entry.title));
      const all = new Set(referenceStems(`${entry.id} ${entry.title} ${entry.text}`));
      const matches = (stems: Set<string>) =>
        terms.filter((term) =>
          term.alternatives.some((alternative) => alternative.every((stem) => stems.has(stem))),
        );
      const matched = matches(all);
      if (!matched.length) return [];
      const score =
        componentNameBoost(entry.id, phrase) +
        matched.length * 100 +
        matches(title).length * 200 +
        (stemmedReference(entry.title).includes(phrase) ? 500 : 0) +
        (entry.kind === 'template' ? 20 : 0) +
        (entry.readiness === 'ready' ? 10 : 0);
      // The outbound summary is routing data, never a source document or application code.
      const words = entry.text.toLowerCase();
      const positions = matched.map((term) => words.indexOf(term.stem)).filter((n) => n >= 0);
      const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 80);
      // Construct the projection explicitly: catalog objects also carry full search text and paths.
      return [
        {
          id: entry.id,
          title: entry.title,
          kind: entry.kind,
          family: entry.family,
          version: entry.version,
          readiness: entry.readiness,
          summary: entry.text.slice(start, start + 600),
          score,
        },
      ];
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, 'en'))
    .slice(0, 64);
}
