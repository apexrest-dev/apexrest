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
