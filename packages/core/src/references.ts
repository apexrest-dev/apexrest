import path from 'node:path';
import { stat, readFile } from 'node:fs/promises';
import {
  referenceWords,
  referenceTerms,
  referenceStem,
  referenceStems,
  referenceQueryTerms,
  queryPhrase,
  stemmedReference,
  routingReference,
  navigationalQuery,
  identifierQuery,
  canonicalReference,
  primaryCodeBlock,
  boundCode,
  scoreReference,
  buildReferencePostings,
  fitResults,
  codeWanted,
  CODE_LIMIT,
  SEARCH_LINKS,
  type CodeBlock,
} from './reference-index.ts';
import { resourceRoot } from './project.ts';
import { loadProject, managedHome } from './config.ts';
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
  /** Reviewed source or compiler evidence; never implies a deployed runtime check. */
  verification?: string;
};
/** A resolved link: the agent can choose the next read without fetching the target first. */
export type ReferenceLink = { id: string; title: string | null; kind: string | null };
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
    text: 'Use an explicit environment. Plans bind source hashes and target identity. Recheck drift, acquire local coordination and create an export backup before writes. Clean APEX deployment needs no service tables. Local runners must share one managed home; independent machines need external serialization. DDL cannot be generally rolled back. Interrupted writes require reconciliation. Production requires an external approval boundary.',
  },
];
function versionMatches(actual: string, requested?: string) {
  if (!requested) return true;
  // A release selector includes its pinned snapshot. An explicit snapshot remains exact.
  return actual === requested || (!requested.includes('@') && actual.split('@')[0] === requested);
}
function indexReferences(upstream: Reference[], file?: string, digest?: string, release = '26.1') {
  const builtins = references.filter(
    (entry) => entry.version === release || entry.id === 'deployment-safety',
  );
  const entries = [...builtins, ...upstream];
  const byId = new Map<string, Reference>();
  const bySymbol = new Map<string, string>();
  const positionById = new Map<string, number>();
  const searchable = entries.map((reference, position) => {
    if (!byId.has(reference.id)) {
      byId.set(reference.id, reference);
      positionById.set(reference.id, position);
    }
    const symbol = reference.text.match(/^<([^>\n]+)>\s*::=/)?.[1];
    if (symbol) bySymbol.set(symbol, reference.id);
    const title = reference.title ?? symbol ?? reference.id;
    return {
      reference,
      title,
      // Title stems, routing/canonical flags and normalized bodies are derived on first use.
      titleText: undefined as string | undefined,
      titleStems: undefined as Set<string> | undefined,
      routing: undefined as boolean | undefined,
      canonical: undefined as boolean | undefined,
      lower: undefined as string | undefined,
      bodyText: undefined as string | undefined,
      code: undefined as CodeBlock | null | undefined,
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
            const result = buildReferencePostings(builtins);
            for (const [term, list] of Object.entries(prebuilt.postings as Record<string, number[]>))
              result[term] = [...(result[term] ?? []), ...list.map((position) => position + builtins.length)];
            return result;
          }
        } catch {
          /* Missing/stale/corrupt optional accelerator: rebuild from the actual corpus. */
        }
      }
      return buildReferencePostings(entries);
    })());
  // Stems group the raw posting words once per corpus revision; stem membership sets are
  // built on demand and shared by every query that uses the same stem.
  let stemWords: Map<string, string[]> | undefined;
  const stemSets = new Map<string, Set<number>>();
  const positionsForStem = async (stem: string) => {
    let set = stemSets.get(stem);
    if (set) return set;
    const lists = await postings();
    if (!stemWords) {
      stemWords = new Map();
      for (const word of Object.keys(lists)) {
        const key = referenceStem(word);
        const group = stemWords.get(key);
        if (group) group.push(word);
        else stemWords.set(key, [word]);
      }
    }
    set = new Set<number>();
    for (const word of stemWords.get(stem) ?? []) for (const position of lists[word] ?? []) set.add(position);
    stemSets.set(stem, set);
    return set;
  };
  const link = (id: string): ReferenceLink => {
    const position = positionById.get(id);
    const entry = position === undefined ? undefined : searchable[position];
    return { id, title: entry?.title ?? null, kind: entry?.reference.kind ?? null };
  };
  return {
    upstream,
    byId,
    bySymbol,
    positionById,
    searchable,
    postings,
    positionsForStem,
    link,
    queries: new Map<string, number[]>(),
  };
}
const cached = new Map<string, { stamp: string; pending: Promise<ReturnType<typeof indexReferences>> }>();
/** Explicit selectors win; absent project/profile keeps the established 26.1 default. */
export async function resolveReferenceVersion(project?: string, version?: string) {
  if (version) return version;
  return project ? ((await loadProject(project)).config.toolchain.profile ?? '26.1') : '26.1';
}
async function referenceIndex(version = '26.1') {
  const release = version.split('@')[0] === '26.2' ? '26.2' : '26.1';
  const file = path.join(resourceRoot(), 'references', ...(release === '26.2' ? ['26.2'] : []), 'index.json');
  let info;
  try {
    info = await stat(file, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    cached.delete(file);
    return indexReferences([], undefined, undefined, release);
  }
  let stamp = `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
  if (release === '26.2') {
    const manifestInfo = await stat(path.join(path.dirname(file), 'oracle-snapshot.json'), { bigint: true });
    stamp += `:${manifestInfo.ino}:${manifestInfo.size}:${manifestInfo.mtimeNs}:${manifestInfo.ctimeNs}`;
  }
  const prior = cached.get(file);
  if (prior?.stamp === stamp) return prior.pending;
  const pending = readFile(file, 'utf8').then(async (raw) => {
    const entries = JSON.parse(raw) as Reference[];
    if (release === '26.2') {
      const manifest = (await readJson(path.join(path.dirname(file), 'oracle-snapshot.json'))) as {
        release?: string;
        indexSha256?: string;
        records?: number;
      };
      if (
        manifest.release !== release ||
        manifest.indexSha256 !== hash(raw) ||
        manifest.records !== entries.length ||
        new Set(entries.map((entry) => entry.id)).size !== entries.length ||
        entries.some(
          (entry) =>
            !entry.id.startsWith('oracle:26.2:') ||
            !versionMatches(entry.version, release) ||
            typeof entry.text !== 'string' ||
            entry.text.length > 600_000 ||
            entry.sha256 !== hash(entry.text),
        )
      )
        throw new Fault(
          'REFERENCE_CATALOG_INVALID',
          'The reviewed 26.2 reference snapshot failed integrity checks.',
          3,
        );
    }
    return indexReferences(entries, file, hash(raw), release);
  });
  // Keep a bounded cache even when callers switch many resource roots during tests.
  if (cached.size >= 8) cached.delete(cached.keys().next().value!);
  cached.set(file, { stamp, pending });
  try {
    return await pending;
  } catch (error) {
    if (cached.get(file)?.pending === pending) cached.delete(file);
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
  /** `code`: inline the primary code block of every hit; `metadata`: none. Default: top hit only. */
  include?: 'code' | 'metadata' | undefined;
  /** Component/pattern corpora hide `unresolved` records unless this is set. */
  includeUnresolved?: boolean | undefined;
};
function snippet(text: string, lower: string, query: string, terms: string[]) {
  let matchOffset = lower.indexOf(query.trim().toLowerCase());
  if (matchOffset < 0) {
    const pattern = referenceWords(query).join('[\\s._:-]*');
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
  const selectedVersion = await resolveReferenceVersion(
    options.project,
    version ?? (query.trim().startsWith('oracle:26.2:') ? '26.2' : undefined),
  );
  if (query.trim().startsWith('oracle:26.2:') && selectedVersion.split('@')[0] !== '26.2') return [];
  // The separate release corpus also preserves custom fixture versions in the legacy index.
  const filterVersion = version || (options.project ? selectedVersion : undefined);
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
  if (options.corpus === 'components') return componentSearch(query, selectedVersion, options);
  if (options.corpus === 'patterns') return patternSearch(query, selectedVersion, options);
  const terms = referenceQueryTerms(query);
  if (!terms.length) return [];
  const index = await referenceIndex(selectedVersion);
  const key = JSON.stringify([query.trim(), filterVersion, options.kind, options.family]);
  let ranked = index.queries.get(key);
  if (!ranked) {
    // Per-term membership from postings alone: an alternative with several stems is an
    // intersection, a term is the union of its alternatives, and a candidate must satisfy at
    // least half of the terms. No document body is touched in this pass.
    const total = index.searchable.length;
    const counts = new Uint8Array(total);
    for (const term of terms) {
      const positions = new Set<number>();
      for (const alternative of term.alternatives) {
        const sets: Set<number>[] = [];
        for (const stem of alternative) sets.push(await index.positionsForStem(stem));
        sets.sort((a, b) => a.size - b.size);
        for (const position of sets[0]!) if (sets.every((set) => set.has(position))) positions.add(position);
      }
      for (const position of positions) counts[position]!++;
    }
    const phrase = queryPhrase(terms);
    const navigational = navigationalQuery(query);
    const identifier = identifierQuery(query);
    // A bare production name is an identifier lookup; a prose word that happens to equal a
    // grammar symbol ("button", "region") still ranks the family templates first.
    const symbolic = identifier || options.kind === 'grammar' || query.trim().startsWith('grammar:');
    const exactId =
      index.byId.get(query.trim()) ??
      (symbolic
        ? index.byId.get(index.bySymbol.get(query.trim().replace(/^grammar:/, '')) ?? '')
        : undefined);
    const quotedQuery = '"' + query.trim() + '"';
    const quotable = identifier || options.kind === 'grammar';
    const scoreAt = (position: number, final: boolean) => {
      const entry = index.searchable[position]!;
      const { reference } = entry;
      const kind = reference.kind;
      if (!entry.titleStems) {
        const titleStems = referenceStems(entry.title);
        entry.titleText = ' ' + titleStems.join(' ') + ' ';
        entry.titleStems = new Set(titleStems);
        entry.routing = routingReference(reference.id, entry.title);
        entry.canonical = canonicalReference(reference.id);
      }
      return scoreReference({
        terms,
        phrase,
        navigational,
        exact: reference === exactId,
        matched: counts[position]!,
        titleText: entry.titleText!,
        titleStems: entry.titleStems,
        // A production name wins outright; in prose queries the template of that family does.
        titleWeight: kind === 'grammar' && !identifier && options.kind !== 'grammar' ? 150 : 2000,
        // Prefer concrete templates, then the owning contract; grammar wrappers and incidental
        // productions rank below unless a production or property name is being looked up.
        prior:
          kind === 'template'
            ? 100
            : kind === 'contract'
              ? 5 + (identifier ? 100 : 0)
              : kind === 'grammar'
                ? (identifier || options.kind === 'grammar' ? 0 : -40) +
                  (entry.title.endsWith('-line') ? -20 : 0)
                : 0,
        routing: entry.routing!,
        canonical: entry.canonical!,
        length: reference.text.length,
        // A quoted token marks the production that defines a property or keyword.
        quoted: quotable && reference.text.includes(quotedQuery),
        bodyText: final ? () => (entry.bodyText ??= stemmedReference(reference.text)) : undefined,
      });
    };
    const first: { position: number; score: number }[] = [];
    const half = terms.length / 2;
    for (let position = 0; position < total; position++) {
      const r = index.searchable[position]!.reference;
      if (counts[position]! < half && r !== exactId) continue;
      if (
        !versionMatches(r.version, filterVersion) ||
        (options.kind && r.kind !== options.kind) ||
        (options.family && r.family !== options.family && !r.family?.startsWith(options.family + '/'))
      )
        continue;
      const score = scoreAt(position, false);
      if (score !== null) first.push({ position, score });
    }
    first.sort((a, b) => b.score - a.score || a.position - b.position);
    // Phrase and adjacency bonuses need the normalized body (built once per corpus revision)
    // and at least two terms. Every full-coverage candidate near the top
    // joins the pool (a defining production can trail title-only matches until its phrase and
    // quoted-token bonuses are known), bounded by the amount of body text to normalize.
    let pool = 0;
    if (terms.length > 1) {
      let budget = 800_000;
      for (const { position } of first) {
        const full = counts[position]! === terms.length;
        budget -= index.searchable[position]!.reference.text.length;
        if (pool >= 400 || (budget < 0 && pool >= 60) || (!full && pool >= 120)) break;
        pool++;
      }
    }
    const final = first
      .slice(0, pool)
      .map(({ position }) => ({ position, score: scoreAt(position, true)! }))
      .sort((a, b) => b.score - a.score || a.position - b.position);
    ranked = [...final, ...first.slice(pool)].map(({ position }) => position);
    if (index.queries.size >= 64) index.queries.delete(index.queries.keys().next().value!);
    index.queries.set(key, ranked);
  }
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 3;
  const link = index.link;
  const words = referenceTerms(query);
  const results = ranked.slice(offset, offset + limit).map((position, i) => {
    const entry = index.searchable[position]!;
    const { reference: r, title } = entry;
    const requires = r.requires ?? [];
    const related = r.related ?? [];
    const code = codeWanted(options.include, offset, i)
      ? (entry.code ??= r.kind === 'grammar' ? null : primaryCodeBlock(r.text, CODE_LIMIT))
      : undefined;
    return {
      id: r.id,
      title,
      version: r.version,
      source: r.source,
      kind: r.kind ?? 'guide',
      family: r.family ?? 'workflow',
      ...(r.verification ? { verification: r.verification } : {}),
      ...snippet(r.text, (entry.lower ??= r.text.toLowerCase()), query, words),
      ...(code ? { code: boundCode(code, CODE_LIMIT) } : {}),
      requires,
      requiresReferences: requires.slice(0, SEARCH_LINKS).map(link),
      requiresCount: requires.length,
      relatedReferences: related.slice(0, SEARCH_LINKS).map(link),
      relatedCount: related.length,
      totalMatches: ranked.length,
      nextResultOffset: offset + limit < ranked.length ? offset + limit : null,
    };
  });
  return fitResults(results, Math.min(16000, 2500 * limit), (page) => JSON.stringify(page).length);
}
export async function referenceRead(
  id: string,
  offset: number,
  limit: number,
  project?: string,
  version?: string,
) {
  if (id.startsWith('block:') || id.startsWith('blueprint:')) return catalogRead(id, offset, limit, project);
  const qualifiedVersion = id.startsWith('oracle:26.2:') ? '26.2' : undefined;
  if (version && qualifiedVersion && !versionMatches(version, qualifiedVersion))
    throw new Fault('REFERENCE_NOT_FOUND', 'The reference ID belongs to a different APEX release.', 2);
  const selectedVersion = await resolveReferenceVersion(project, version ?? qualifiedVersion);
  if (id === 'apexlang-lifecycle' && selectedVersion.split('@')[0] === '26.2')
    id = 'oracle:26.2:guide/file-import';
  if (id.startsWith('component:')) return componentRead(id, offset, limit, selectedVersion);
  if (id.startsWith('pattern:')) return patternRead(id, offset, limit, selectedVersion);
  const index = await referenceIndex(selectedVersion);
  const item = index.byId.get(id) ?? index.byId.get(index.bySymbol.get(id.replace(/^grammar:/, '')) ?? '');
  if (!item || (version && !versionMatches(item.version, version)))
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
  const link = index.link;
  const requires = item.requires ?? [];
  return {
    id: item.id,
    title: index.link(item.id).title ?? item.id,
    version: item.version,
    source: item.source,
    kind: item.kind ?? 'guide',
    ...(item.verification ? { verification: item.verification } : {}),
    content,
    offset,
    length: item.text.length,
    nextOffset: offset + limit < item.text.length ? offset + limit : null,
    requires,
    requiresReferences: requires.slice(0, 16).map(link),
    related: related.slice(0, 16),
    // Grammar productions resolve to their names so a relation can be followed without a read.
    relatedReferences: related.slice(0, 16).map(link),
    relatedCount: related.length,
    relatedOmittedCount: Math.max(0, related.length - 16),
    classification: 'vendor-reference-data',
  };
}
export async function referenceSync(version: string, dryRun: boolean) {
  const entries = (await referenceIndex(version)).upstream.filter((r) => versionMatches(r.version, version));
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
