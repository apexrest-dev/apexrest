import path from 'node:path';
import { stat, readFile } from 'node:fs/promises';
import {
  referenceWords as words,
  normalizeReference as normalize,
  buildReferencePostings,
} from './reference-index.ts';
import { resourceRoot } from './project.ts';
import { managedHome } from './config.ts';
import { readJson, exists, writeJson, canonical, hash } from './fs.ts';
import { Fault } from './result.ts';
import { catalogSearch, catalogRead } from './composer/catalog.ts';
import { componentSearch, componentRead } from './components.ts';
import { patternSearch, patternRead } from './patterns.ts';

type Kind = 'grammar' | 'template' | 'contract' | 'guide';
export type Reference = {
  id: string;
  version: string;
  source: string;
  text: string;
  title?: string;
  kind?: Kind;
  family?: string;
  requires?: string[];
  related?: string[];
  sha256?: string;
};
export const references: Reference[] = [
  {
    id: 'apexlang-lifecycle',
    version: '26.1',
    source: 'https://docs.oracle.com/en/database/oracle/sql-developer-command-line/26.1/sqcug/apexlang.html',
    text: 'Generate starter files using apex generate -name "Name" -dir ./fresh. Validate with apex validate -input ./application. Export requires a connection and always uses fresh staging. Import deploys the full application and requires a reviewed plan. Preserve .apex/apexlang.json and its compiler metadata.',
  },
  {
    id: 'deployment-safety',
    version: '1.0.0',
    source: 'docs/adr/007-clean-apex-deployment.md',
    text: 'Use an explicit environment. Plans bind source hashes and target identity. Recheck drift, acquire local coordination by default and create an export backup before writes. Clean APEX deployment needs no service tables. Local runners must share one managed home; independent machines need external serialization or explicitly selected database coordination. DDL cannot be generally rolled back. Interrupted writes require reconciliation. Production requires an external approval boundary.',
  },
];
const stopwords = new Set(['a', 'an', 'the', 'for', 'with', 'and', 'of', 'to', 'in']);
const termsFor = (text: string) => [...new Set(words(text).filter((word) => !stopwords.has(word)))];
function versionMatches(actual: string, requested?: string) {
  if (!requested) return true;
  // A release selector includes its pinned snapshot. An explicit snapshot remains exact.
  return actual === requested || (!requested.includes('@') && actual.split('@')[0] === requested);
}
function indexReferences(upstream: Reference[], file?: string, digest?: string) {
  const entries = [...references, ...upstream];
  const byId = new Map<string, Reference>();
  const bySymbol = new Map<string, string>();
  const searchable = entries.map((reference) => {
    if (!byId.has(reference.id)) byId.set(reference.id, reference);
    const symbol = reference.text.match(/^<([^>\n]+)>\s*::=/)?.[1];
    if (symbol) bySymbol.set(symbol, reference.id);
    const title = reference.title ?? symbol ?? reference.id;
    return {
      reference,
      title,
      titleText: normalize(title),
      ranking: undefined as { titleTerms: string[]; bodyText: string } | undefined,
    };
  });
  let pendingPostings: Promise<Record<string, number[]>> | undefined;
  const postings = () =>
    (pendingPostings ??= (async () => {
      if (file) {
        try {
          const prebuilt = (await readJson(path.join(path.dirname(file), 'search.json'))) as {
            schemaVersion?: unknown;
            indexSha256?: unknown;
            postings?: unknown;
          } | null;
          if (
            prebuilt &&
            prebuilt.schemaVersion === 1 &&
            prebuilt.indexSha256 === digest &&
            prebuilt.postings &&
            Object.values(prebuilt.postings as Record<string, unknown>).every(
              (list) =>
                Array.isArray(list) &&
                list.every(
                  (n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) < upstream.length,
                ),
            )
          ) {
            const result = buildReferencePostings(references);
            for (const [term, list] of Object.entries(prebuilt.postings as Record<string, number[]>))
              result[term] = [
                ...(result[term] ?? []),
                ...list.map((position) => position + references.length),
              ];
            return result;
          }
        } catch {
          /* Missing/stale/corrupt optional accelerator: rebuild from the actual corpus. */
        }
      }
      return buildReferencePostings(entries);
    })());
  return { upstream, byId, bySymbol, searchable, postings, queries: new Map<string, number[]>() };
}
let cached: { file: string; stamp: string; pending: Promise<ReturnType<typeof indexReferences>> } | undefined;
async function referenceIndex() {
  const file = path.join(resourceRoot(), 'references/index.json');
  let info;
  try {
    info = await stat(file, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    cached = undefined;
    return indexReferences([]);
  }
  const stamp = `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
  if (cached?.file === file && cached.stamp === stamp) return cached.pending;
  const pending = readFile(file, 'utf8').then((raw) =>
    indexReferences(JSON.parse(raw) as Reference[], file, hash(raw)),
  );
  cached = { file, stamp, pending };
  try {
    return await pending;
  } catch (error) {
    if (cached?.pending === pending) cached = undefined;
    throw error;
  }
}
export type SearchOptions = {
  project?: string | undefined;
  corpus?: 'apexlang' | 'components' | 'patterns' | 'blocks' | 'blueprints' | undefined;
  profile?: string | undefined;
  status?: string | undefined;
  locale?: string | undefined;
  cursor?: string | undefined;
  kind?: Kind | undefined;
  family?: string | undefined;
  offset?: number | undefined;
  limit?: number | undefined;
};
function snippet(text: string, query: string, terms: string[]) {
  const lower = text.toLowerCase();
  let matchOffset = lower.indexOf(query.trim().toLowerCase());
  if (matchOffset < 0) {
    const pattern = words(query).join('[\\s._:-]*');
    if (pattern) matchOffset = lower.search(new RegExp(pattern, 'u'));
  }
  if (matchOffset < 0) {
    const locations = terms.map((term) => lower.indexOf(term)).filter((offset) => offset >= 0);
    matchOffset = locations.length ? Math.min(...locations) : -1;
  }
  const offset = Math.max(0, Math.min(matchOffset - 160, text.length - 1200));
  return {
    text: text.slice(offset, offset + 1200),
    offset,
    matchOffset: matchOffset < 0 ? null : matchOffset,
    length: text.length,
    nextOffset: offset + 1200 < text.length ? offset + 1200 : null,
  };
}
export async function referenceSearch(query: string, version?: string, options: SearchOptions = {}) {
  if (options.corpus === 'blocks' || options.corpus === 'blueprints') {
    const found = await catalogSearch(query, { ...options, ...(version ? { version } : {}) });
    return found.results.map((hit) => ({
      ...hit,
      source: 'bundled-composer-catalog',
      version: 'version' in hit ? hit.version : '1',
      kind: 'template' as const,
      family: 'composer',
      text: hit.title,
      offset: 0,
      matchOffset: 0,
      length: hit.title.length,
      nextOffset: null,
      requires: [],
      totalMatches: found.totalMatches,
      nextResultOffset: found.nextResultOffset,
    }));
  }
  if (options.corpus === 'components') return componentSearch(query, version, options);
  if (options.corpus === 'patterns') return patternSearch(query, version, options);
  const terms = termsFor(query);
  if (!terms.length) return [];
  const index = await referenceIndex();
  const normalized = normalize(query);
  const key = JSON.stringify([query.trim(), version, options.kind, options.family]);
  let ranked = index.queries.get(key);
  if (!ranked) {
    const postings = await index.postings();
    const lists = terms.map((term) => postings[term] ?? []).sort((a, b) => a.length - b.length);
    const membership = lists.slice(1).map((list) => new Set(list));
    const candidates = (lists[0] ?? []).filter((position) => membership.every((list) => list.has(position)));
    const exactId =
      index.byId.get(query) ?? index.byId.get(index.bySymbol.get(query.replace(/^grammar:/, '')) ?? '');
    if (exactId) {
      const position = index.searchable.findIndex(({ reference }) => reference === exactId);
      if (!candidates.includes(position)) candidates.push(position);
    }
    ranked = candidates
      .filter((position) => {
        const r = index.searchable[position]!.reference;
        return (
          versionMatches(r.version, version) &&
          (!options.kind || r.kind === options.kind) &&
          (!options.family || r.family === options.family || r.family?.startsWith(options.family + '/'))
        );
      })
      .map((position) => {
        const entry = index.searchable[position]!;
        const { reference, titleText } = entry;
        const exact = reference === exactId;
        // Normalize only matched entries, once per corpus revision. Different queries and
        // filters share this work; referenceIndex invalidates it together with the corpus.
        const { titleTerms, bodyText } = (entry.ranking ??= {
          titleTerms: termsFor(titleText),
          bodyText: normalize(reference.text),
        });
        const adjacentHits = terms
          .slice(1)
          .filter((term, i) => bodyText.includes(terms[i] + ' ' + term)).length;
        const titleHits = terms.filter((term) => titleTerms.includes(term)).length;
        // Prefer the owning production/contract over incidental mentions in large examples.
        const score =
          (exact ? 10000 : 0) +
          (titleText === normalized ? 2000 : 0) +
          (titleText.includes(normalized) ? 400 : 0) +
          titleHits * 50 +
          (titleHits === terms.length ? 200 : 0) +
          (bodyText.includes(normalized) ? 40 : 0) +
          adjacentHits * 60 +
          (reference.text.includes('"' + query.trim() + '"') ? 80 : 0) +
          (reference.kind === 'contract' ? 5 : 0) +
          1 / (1 + reference.text.length / 1000);
        return { position, score };
      })
      .sort((a, b) => b.score - a.score || a.position - b.position)
      .map(({ position }) => position);
    if (index.queries.size >= 64) index.queries.delete(index.queries.keys().next().value!);
    index.queries.set(key, ranked);
  }
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 3;
  return ranked.slice(offset, offset + limit).map((position) => {
    const { reference: r, title } = index.searchable[position]!;
    return {
      id: r.id,
      title,
      version: r.version,
      source: r.source,
      kind: r.kind ?? 'guide',
      family: r.family ?? 'workflow',
      ...snippet(r.text, query, terms),
      requires: r.requires ?? [],
      totalMatches: ranked.length,
      nextResultOffset: offset + limit < ranked.length ? offset + limit : null,
    };
  });
}
export async function referenceRead(id: string, offset: number, limit: number, project?: string) {
  if (id.startsWith('block:') || id.startsWith('blueprint:')) return catalogRead(id, offset, limit, project);
  if (id.startsWith('component:')) return componentRead(id, offset, limit);
  if (id.startsWith('pattern:')) return patternRead(id, offset, limit);
  const index = await referenceIndex();
  const item = index.byId.get(id) ?? index.byId.get(index.bySymbol.get(id.replace(/^grammar:/, '')) ?? '');
  if (!item)
    throw new Fault('REFERENCE_NOT_FOUND', 'No registered reference with this ID or grammar symbol.', 2);
  const content = item.text.slice(offset, offset + limit);
  // Resolve only links in the returned window; no recursive context expansion.
  const symbols = [...content.matchAll(/<([^>\n]+)>/g)].map((match) => index.bySymbol.get(match[1]!));
  const related = [
    ...new Set(
      [...(item.related ?? []), ...symbols].filter(
        (target): target is string => Boolean(target) && target !== item.id,
      ),
    ),
  ];
  return {
    id: item.id,
    title: item.title ?? item.id,
    version: item.version,
    source: item.source,
    content,
    offset,
    length: item.text.length,
    nextOffset: offset + limit < item.text.length ? offset + limit : null,
    requires: item.requires ?? [],
    related: related.slice(0, 16),
    relatedCount: related.length,
    relatedOmittedCount: Math.max(0, related.length - 16),
    classification: 'vendor-reference-data',
  };
}
export async function referenceSync(version: string, dryRun: boolean) {
  const entries = (await referenceIndex()).upstream.filter((r) => versionMatches(r.version, version));
  if (!entries.length)
    throw new Fault(
      'REFERENCE_VERSION_UNAVAILABLE',
      'Requested version is not in this reviewed release snapshot. Install a reviewed release containing it.',
      3,
    );
  const destination = path.join(managedHome(), 'references', version + '.json');
  const before = (await exists(destination)) ? hash(canonical(await readJson(destination))) : null,
    after = hash(canonical(entries));
  if (!dryRun && before !== after) await writeJson(destination, entries);
  return {
    status: dryRun ? 'planned' : before === after ? 'unchanged' : 'synced',
    version,
    before,
    after,
    count: entries.length,
  };
}
