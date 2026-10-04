import path from 'node:path';
import { readFile, realpath, stat } from 'node:fs/promises';
import { z } from 'zod';
import { hash } from './fs.ts';
import { resourceRoot } from './project.ts';
import { artifactPage, Fault, redact, sanitized } from './result.ts';
import {
  referenceStems,
  referenceTerms,
  referenceQueryTerms,
  queryPhrase,
  stemmedReference,
  navigationalQuery,
  identifierQuery,
  canonicalReference,
  primaryCodeBlock,
  boundCode,
  scoreReference,
  fitResults,
  codeWanted,
  CODE_LIMIT,
  SEARCH_LINKS,
  type CodeBlock,
} from './reference-index.ts';
import type { ReferenceLink, SearchOptions } from './references.ts';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const ascii = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^[\x20-\x7e]+$/);
const referenceId = ascii(200);
const compatibilitySchema = z.object({
  apexVersion: ascii(64),
  themeVersion: ascii(64),
  mmdVersion: ascii(64),
});
const entrySchema = z.object({
  id: referenceId,
  title: z.string().min(1).max(240),
  kind: z.enum(['contract', 'template', 'guide']),
  family: ascii(200),
  version: ascii(120),
  source: ascii(2048),
  document: ascii(240),
  sha256: digest,
  searchText: z.string().max(200000),
  requires: z.array(referenceId),
  related: z.array(referenceId),
  readiness: z.enum(['ready', 'reference', 'unresolved']),
  compatibility: compatibilitySchema,
  length: z.number().int().nonnegative().optional(),
});
const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  catalogVersion: ascii(120),
  source: z.object({ apexVersion: ascii(64), themeVersion: ascii(64), mmdVersion: ascii(64) }).passthrough(),
  indexSha256: digest,
  files: z.record(z.string(), digest),
  counts: z.record(z.string(), z.unknown()),
});
export type CatalogReference = z.infer<typeof entrySchema>;

/** Shared offline catalog engine. Each instance owns its own lazy index cache. */
export function createReferenceCatalog<
  Classification extends 'component-reference-data' | 'pattern-reference-data',
>(definition: {
  directory: string;
  prefix: string;
  documentDirectory: string;
  label: string;
  faultPrefix: string;
  classification: Classification;
}) {
  function invalid(message: string): never {
    throw new Fault(`${definition.faultPrefix}_CATALOG_INVALID`, message, 3);
  }
  function relativeFile(file: string) {
    if (
      !/^[A-Za-z0-9_./-]+$/.test(file) ||
      path.isAbsolute(file) ||
      file.split('/').some((part) => !part || part === '.' || part === '..')
    )
      invalid(`${definition.label} catalog contains an unsafe file path.`);
    return file;
  }
  async function containedFile(root: string, file: string) {
    const resolved = await realpath(path.join(root, relativeFile(file)));
    const relative = path.relative(root, resolved);
    if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative))
      invalid(`${definition.label} catalog file resolves outside its resource directory.`);
    return resolved;
  }
  async function stamp(file: string) {
    const info = await stat(file, { bigint: true });
    return `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
  }
  async function loadIndex(root: string, manifestFile: string, indexFile: string) {
    try {
      const manifest = manifestSchema.parse(JSON.parse(await readFile(manifestFile, 'utf8')));
      for (const file of Object.keys(manifest.files)) relativeFile(file);
      if (manifest.files['index.json'] !== manifest.indexSha256)
        invalid(`${definition.label} catalog manifest index hashes disagree.`);
      const raw = await readFile(indexFile, 'utf8');
      if (hash(raw) !== manifest.indexSha256)
        invalid(`${definition.label} catalog index checksum does not match its manifest.`);
      const entries = z.array(entrySchema).parse(JSON.parse(raw));
      const byId = new Map<string, CatalogReference>();
      const searchable = entries.map((entry) => {
        if (!entry.id.startsWith(definition.prefix))
          invalid(`${definition.label} catalog contains a reference ID with an invalid prefix.`);
        relativeFile(entry.document);
        if (!entry.document.startsWith(definition.documentDirectory + '/') || !entry.document.endsWith('.md'))
          invalid(
            `${definition.label} documents must be Markdown files inside ${definition.documentDirectory}/.`,
          );
        if (manifest.files[entry.document] !== entry.sha256)
          invalid(`${definition.label} document checksum is missing or disagrees with its manifest.`);
        if (byId.has(entry.id)) invalid(`${definition.label} catalog contains duplicate reference IDs.`);
        byId.set(entry.id, entry);
        const titleStems = referenceStems(entry.title);
        return {
          entry,
          stems: new Set(referenceStems(`${entry.id} ${entry.title} ${entry.searchText}`)),
          titleText: ' ' + titleStems.join(' ') + ' ',
          titleStems: new Set(titleStems),
          bodyText: undefined as string | undefined,
          code: undefined as CodeBlock | null | undefined,
        };
      });
      for (const entry of entries)
        for (const id of [...entry.requires, ...entry.related])
          if (id.startsWith(definition.prefix) && !byId.has(id))
            invalid(
              `${definition.label} catalog contains an unresolved ${definition.label.toLowerCase()} reference.`,
            );
      return { root, manifest, byId, searchable };
    } catch (error) {
      if (error instanceof Fault) throw error;
      invalid(`${definition.label} catalog manifest or index cannot be read or has an invalid format.`);
    }
  }
  let cached: { root: string; stamp: string; pending: ReturnType<typeof loadIndex> } | undefined;
  async function catalogIndex() {
    let root: string, manifestFile: string, indexFile: string, revision: string;
    try {
      root = await realpath(path.join(resourceRoot(), definition.directory));
      manifestFile = await containedFile(root, 'manifest.json');
      indexFile = await containedFile(root, 'index.json');
      revision = (await stamp(manifestFile)) + ':' + (await stamp(indexFile));
    } catch (error) {
      cached = undefined;
      if (error instanceof Fault) throw error;
      throw new Fault(
        `${definition.faultPrefix}_CATALOG_UNAVAILABLE`,
        `Install a reviewed release containing the ${definition.label.toLowerCase()} catalog.`,
        3,
      );
    }
    if (cached?.root === root && cached.stamp === revision) return cached.pending;
    const pending = loadIndex(root, manifestFile, indexFile);
    cached = { root, stamp: revision, pending };
    try {
      return await pending;
    } catch (error) {
      if (cached?.pending === pending) cached = undefined;
      throw error;
    }
  }
  // Redaction can expand short secret-like examples into longer markers. Account
  // for the actual public envelope, not only its pre-sanitization representation.
  const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(sanitized(value)), 'utf8');
  function metadata(entry: CatalogReference) {
    return {
      id: entry.id,
      title: entry.title,
      kind: entry.kind,
      family: entry.family,
      version: entry.version,
      source: entry.source,
      readiness: entry.readiness,
      compatibility: entry.compatibility,
      classification: definition.classification,
    };
  }
  function links(
    entry: CatalogReference,
    count: number,
    byId: Map<string, CatalogReference>,
    resolved: number,
  ) {
    // Same-catalog targets resolve to their title and kind; other corpora stay bare IDs.
    const link = (id: string): ReferenceLink => {
      const target = byId.get(id);
      return { id, title: target?.title ?? null, kind: target?.kind ?? null };
    };
    return {
      requires: entry.requires.slice(0, count),
      requiresReferences: entry.requires.slice(0, resolved).map(link),
      requiresCount: entry.requires.length,
      requiresOmittedCount: Math.max(0, entry.requires.length - count),
      related: entry.related.slice(0, count),
      relatedReferences: entry.related.slice(0, resolved).map(link),
      relatedCount: entry.related.length,
      relatedOmittedCount: Math.max(0, entry.related.length - count),
    };
  }
  async function verifiedDocument(root: string, entry: CatalogReference) {
    const raw = await readFile(await containedFile(root, entry.document), 'utf8');
    if (hash(raw) !== entry.sha256)
      invalid(`${definition.label} document checksum does not match the catalog.`);
    if (entry.length !== undefined && entry.length !== raw.length)
      invalid(`${definition.label} document length does not match the catalog.`);
    return raw;
  }
  function window(text: string, start: number, length: number) {
    let end = Math.min(text.length, start + length);
    // Keep valid Unicode when a page ends between the UTF-16 halves of a character.
    if (end > start && /[\uD800-\uDBFF]/.test(text[end - 1]!) && /[\uDC00-\uDFFF]/.test(text[end] ?? ''))
      end += end - start === 1 ? 1 : -1;
    return text.slice(start, end);
  }

  async function search(query: string, version?: string, options: SearchOptions = {}) {
    const terms = referenceQueryTerms(query);
    if (!terms.length) return [];
    const index = await catalogIndex();
    const phrase = queryPhrase(terms);
    const navigational = navigationalQuery(query);
    const exactId = query.trim();
    const identifier = identifierQuery(query);
    const ranked = index.searchable
      .filter(
        ({ entry }) =>
          entry.id === exactId ||
          ((!version ||
            entry.version === version ||
            (!version.includes('@') && entry.version.split('@')[0] === version)) &&
            (!options.kind || entry.kind === options.kind) &&
            (!options.family ||
              entry.family === options.family ||
              entry.family.startsWith(options.family + '/')) &&
            // Unresolved records have no usable recipe; they stay discoverable on request.
            (options.includeUnresolved || entry.readiness !== 'unresolved')),
      )
      .map((candidate) => ({
        entry: candidate.entry,
        score: scoreReference({
          terms,
          phrase,
          navigational,
          exact: candidate.entry.id === exactId,
          matched: terms.filter((term) =>
            term.alternatives.some((alternative) => alternative.every((stem) => candidate.stems.has(stem))),
          ).length,
          titleText: candidate.titleText,
          titleStems: candidate.titleStems,
          titleWeight: 2000,
          bodyText: () => (candidate.bodyText ??= stemmedReference(candidate.entry.searchText)),
          // Ready recipes first; parameter contracts for property-name lookups.
          prior:
            (candidate.entry.readiness === 'ready' ? 10 : 0) +
            (candidate.entry.kind === 'template' ? 10 : 0) +
            (candidate.entry.kind === 'contract' ? 5 + (identifier ? 100 : 0) : 0),
          routing: false,
          canonical: canonicalReference(candidate.entry.id),
          length: candidate.entry.searchText.length,
        }),
      }))
      .filter((hit): hit is { entry: CatalogReference; score: number } => hit.score !== null)
      .sort((a, b) => b.score - a.score || (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0));
    const offset = Math.max(0, options.offset ?? 0),
      limit = Math.max(1, Math.min(8, options.limit ?? 3));
    const words = referenceTerms(query);
    const candidates = [];
    for (const [i, { entry }] of ranked.slice(offset, offset + limit).entries()) {
      const first = words.map((term) => entry.searchText.toLowerCase().indexOf(term)).filter((n) => n >= 0);
      const matchOffset = first.length ? Math.min(...first) : null;
      let snippetOffset = Math.max(0, (matchOffset ?? 0) - 80);
      if (
        snippetOffset &&
        /[\uDC00-\uDFFF]/.test(entry.searchText[snippetOffset] ?? '') &&
        /[\uD800-\uDBFF]/.test(entry.searchText[snippetOffset - 1] ?? '')
      )
        snippetOffset--;
      const text = window(entry.searchText, snippetOffset, 600);
      const code = codeWanted(options.include, offset, i) ? await documentCode(index, entry) : undefined;
      candidates.push({
        ...metadata(entry),
        ...links(entry, 2, index.byId, SEARCH_LINKS),
        text,
        ...(code ? { code } : {}),
        // Index summaries are intentionally independent of documents; read a result at offset 0.
        snippetSource: 'index' as const,
        readOffset: 0,
        offset: snippetOffset,
        matchOffset,
        length: entry.searchText.length,
        nextOffset: null,
        totalMatches: ranked.length,
        nextResultOffset: null as number | null,
      });
    }
    // Reserve room for the Result envelope. Measure serialized UTF-8, including escaping.
    fitResults(candidates, 7000, bytes);
    const results: typeof candidates = [];
    for (const hit of candidates) {
      while (bytes([...results, hit]) > 7000 && hit.text.length) {
        const remaining = Math.floor(hit.text.length / 2);
        hit.text = remaining < 2 ? '' : window(hit.text, 0, remaining);
      }
      if (bytes([...results, hit]) > 7000) break;
      results.push(hit);
    }
    if (!results.length && candidates.length)
      invalid(`${definition.label} result metadata exceeds the response budget.`);
    const next = offset + results.length < ranked.length ? offset + results.length : null;
    for (const result of results) result.nextResultOffset = next;
    return results;
  }
  /** Primary code block of a verified document; unreadable or tampered documents yield no code. */
  async function documentCode(
    index: Awaited<ReturnType<typeof loadIndex>>,
    entry: CatalogReference,
  ): Promise<CodeBlock | undefined> {
    const candidate = index.searchable.find((item) => item.entry === entry)!;
    if (candidate.code === undefined) {
      try {
        candidate.code = primaryCodeBlock(redact(await verifiedDocument(index.root, entry)), CODE_LIMIT);
      } catch {
        candidate.code = null;
      }
    }
    return candidate.code ? boundCode(candidate.code, CODE_LIMIT) : undefined;
  }

  async function read(id: string, offset: number, limit: number) {
    const index = await catalogIndex();
    const entry = index.byId.get(id);
    if (!entry)
      throw new Fault(
        'REFERENCE_NOT_FOUND',
        `No registered ${definition.label.toLowerCase()} reference with this ID.`,
        2,
      );
    let raw: string;
    try {
      raw = await verifiedDocument(index.root, entry);
    } catch (error) {
      if (error instanceof Fault) throw error;
      invalid(`${definition.label} document cannot be read.`);
    }
    // All links remain readable through the existing text pagination interface, even
    // if compact navigation arrays must omit many dependencies or related recipes.
    const navigation =
      '\n\n## Catalog navigation\n\n' +
      entry.requires.map((target) => `- requires: ${target}\n`).join('') +
      entry.related.map((target) => `- related: ${target}\n`).join('');
    const safeRaw = redact(raw);
    const document = safeRaw + redact(navigation);
    const start = Math.max(0, offset);
    let count = Math.max(1, Math.min(8192, limit));
    const create = () =>
      artifactPage(document, 'text', id, start, count, {
        ...metadata(entry),
        ...links(entry, 16, index.byId, 16),
        length: document.length,
        documentLength: safeRaw.length,
        sourceDocumentLength: raw.length,
        contentSanitized: true,
        navigationOffset: safeRaw.length,
        sha256: entry.sha256,
      });
    let result = create();
    while (bytes(result) > 30000 && count > 1) {
      count = Math.max(1, Math.floor(count / 2));
      result = create();
    }
    if (bytes(result) > 30000) invalid(`${definition.label} document metadata exceeds the response budget.`);
    return result;
  }

  return { search, read };
}
