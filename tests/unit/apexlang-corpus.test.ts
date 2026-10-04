import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, cp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { referenceSearch, referenceRead, type Reference } from '../../packages/core/src/references.ts';
import { buildReferencePostings } from '../../packages/core/src/reference-index.ts';
const corpusRoot = path.resolve('resources');
const digest = (text: string) => createHash('sha256').update(text).digest('hex');

test('pinned corpus retains complete documents, resolvable contracts, grammar and Codex routes', async () => {
  const raw = await readFile(path.join(corpusRoot, 'references/index.json'), 'utf8');
  const entries = JSON.parse(raw) as Reference[];
  const snapshot = JSON.parse(
    await readFile(path.join(corpusRoot, 'references/oracle-snapshot.json'), 'utf8'),
  );
  const search = JSON.parse(await readFile(path.join(corpusRoot, 'references/search.json'), 'utf8'));
  const sourceLock = JSON.parse(await readFile('toolchains/sources.lock.json', 'utf8'));
  assert.equal(sourceLock.oracleSkills.commit, snapshot.commit);
  assert.equal(sourceLock.oracleSkills.indexSha256, snapshot.indexSha256);
  assert.equal(digest(raw), snapshot.indexSha256);
  assert.equal(search.indexSha256, snapshot.indexSha256);
  assert.deepEqual(search.postings, { ...buildReferencePostings(entries) });
  assert.equal(entries.length, snapshot.records);
  const ids = new Set(entries.map((entry) => entry.id));
  assert.equal(ids.size, entries.length);
  for (const entry of entries) {
    assert.ok(entry.id.length <= 200, entry.id);
    if (entry.sha256) {
      assert.equal(digest(entry.text), entry.sha256, entry.id);
      const sourceFile = entry.source.split('/apex/apexlang/')[1];
      assert.equal(entry.sha256, snapshot.sourceFiles[sourceFile!], entry.id);
    }
    for (const link of [...(entry.requires ?? []), ...(entry.related ?? [])]) assert.ok(ids.has(link), link);
  }
  for (const id of ['oracle-form-example', 'oracle-report-example', 'oracle-dashboard-example'])
    assert.ok(entries.find((entry) => entry.id === id)!.requires!.length >= 2, id);
  const routes = await readFile(
    'plugins/apexrest-apex/skills/apexrest-apexlang/references/component-routes.md',
    'utf8',
  );
  for (const match of routes.matchAll(/`(oracle:[^`]+)`/g)) assert.ok(ids.has(match[1]!), match[1]);
  const grammar = entries
    .filter(({ kind }) => kind === 'grammar')
    .map(({ text }) => text)
    .join('');
  assert.equal(digest(grammar), snapshot.sourceFiles['assets/grammar/apexlang.ebnf']);
});

test('an application-process scenario requires its contracts without loading alternative execution points', async () => {
  const entries = JSON.parse(
    await readFile(path.join(corpusRoot, 'references/index.json'), 'utf8'),
  ) as Reference[];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const prefix = 'oracle:templates/shared-components/app-processes/app-processes.';
  const selected = prefix + 'ajax-callback';
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const required of byId.get(id)!.requires ?? []) visit(required);
  };
  visit(selected);
  assert.deepEqual([...visited].sort(), [selected, prefix + '_index', prefix + '_common'].sort());
  const common = byId.get(prefix + '_common')!;
  const alternatives = entries.filter(
    (entry) => entry.family === 'shared-components/app-processes' && entry.kind === 'template',
  );
  assert.equal(alternatives.length, 10);
  for (const alternative of alternatives) assert.ok(common.related?.includes(alternative.id), alternative.id);
  assert.match(common.text, /imports:\n  - app-processes.before-header.md/);
});

test('real Oracle retrieval covers properties, component families and dependency traversal with and without accelerator', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-corpus-'));
  const previous = process.env.APEXREST_RESOURCES;
  t.after(async () => {
    if (previous === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = previous;
    await rm(root, { recursive: true, force: true });
  });
  process.env.APEXREST_RESOURCES = corpusRoot;
  const cases = JSON.parse(await readFile('tests/fixtures/apexlang-retrieval.json', 'utf8')) as {
    query: string;
    kind: 'grammar' | 'template' | 'contract' | 'guide';
    expected: string;
    visible?: string;
  }[];
  const results = [];
  for (const entry of cases) {
    const found = await referenceSearch(entry.query, '26.1', { kind: entry.kind, limit: 3 });
    assert.ok(found[0]?.title.includes(entry.expected), entry.query);
    if (entry.kind === 'grammar') assert.ok(found[0]!.text.includes(entry.query), entry.query);
    assert.ok(JSON.stringify(found).length < 8000);
    const defaults = await referenceSearch(entry.query, '26.1', { kind: entry.kind });
    const expanded = await referenceSearch(entry.query, '26.1', { kind: entry.kind, limit: 8 });
    assert.deepEqual(defaults, found);
    assert.deepEqual(
      defaults.map(({ id }) => id),
      expanded.slice(0, 3).map(({ id }) => id),
    );
    results.push(found);
  }
  const chart = await referenceRead('oracle:templates/region-components/chart/chart.bar', 0, 8192);
  assert.ok(chart.requires.some((id) => id.endsWith('chart._series._common')));
  assert.ok(chart.requires.some((id) => id.endsWith('chart._axis._common')));
  const page = await referenceRead('oracle:templates/page-examples/form-page/form-page._index', 0, 4096);
  assert.ok(page.requires.some((id) => id.endsWith('form-page._common')));
  const map = await referenceRead('oracle:templates/region-components/map/map._index', 0, 8192);
  assert.equal(map.related.length, 16);
  assert.equal(map.relatedCount, 22);
  assert.equal(map.relatedOmittedCount, 6);
  assert.equal(map.nextOffset, null);
  assert.match(map.content, /map\.layer\.heat-map\.md/);
  assert.equal(page.relatedOmittedCount, 0);
  await cp(path.join(corpusRoot, 'references'), path.join(root, 'references'), { recursive: true });
  await writeFile(path.join(root, 'references/search.json'), '{invalid accelerator');
  process.env.APEXREST_RESOURCES = root;
  for (const [i, entry] of cases.entries())
    assert.deepEqual(await referenceSearch(entry.query, '26.1', { kind: entry.kind, limit: 3 }), results[i]);
});

test('generation queries resolve to adaptable templates and recipes across the bundled corpora', async (t) => {
  type Link = { id: string; title: string | null; kind: string | null };
  type Hit = {
    id: string;
    kind: string;
    readiness?: string;
    code?: { language: string; text: string; truncated: boolean; length: number };
    requiresReferences: Link[];
    relatedReferences: Link[];
    requiresCount: number;
    nextResultOffset: number | null;
  };
  const search = async (...args: Parameters<typeof referenceSearch>) =>
    (await referenceSearch(...args)) as unknown as Hit[];
  const read = async (...args: Parameters<typeof referenceRead>) =>
    (await referenceRead(...args)) as unknown as {
      id: string;
      kind: string;
      related: string[];
      relatedReferences: Link[];
    };
  const previous = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = corpusRoot;
  t.after(() => {
    if (previous === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = previous;
  });
  const cases = JSON.parse(await readFile('tests/fixtures/generation-queries.json', 'utf8')) as {
    query: string;
    corpus?: 'components' | 'patterns';
    kind?: 'grammar' | 'template' | 'contract' | 'guide';
    expected: string[];
  }[];
  assert.ok(cases.length >= 30);
  let top1 = 0;
  let top3 = 0;
  const misses: string[] = [];
  for (const entry of cases) {
    const found = await search(entry.query, undefined, {
      limit: 3,
      ...(entry.kind ? { kind: entry.kind } : {}),
      ...(entry.corpus ? { corpus: entry.corpus } : {}),
    });
    assert.ok(found.length, entry.query);
    assert.ok(JSON.stringify(found).length <= 7500, entry.query);
    if (entry.expected.includes(found[0]!.id)) top1++;
    else misses.push(`${entry.query} -> ${found[0]!.id}`);
    if (found.some((hit) => entry.expected.includes(hit.id))) top3++;
    // A ready template on top ships its primary code block inline.
    if (entry.expected.includes(found[0]!.id) && found[0]!.kind === 'template' && !entry.corpus)
      assert.ok(found[0]!.code?.text.length, entry.query);
  }
  // Measured 48/48 at both cut-offs for the pinned corpora; tolerate small corpus revisions.
  assert.ok(
    top1 >= Math.ceil(cases.length * 0.9),
    `precision@1 ${top1}/${cases.length}: ${misses.join('; ')}`,
  );
  assert.ok(top3 >= Math.ceil(cases.length * 0.95), `precision@3 ${top3}/${cases.length}`);
  // Routing documents sink below the concrete template unless the query asks for them.
  const report = await search('interactive report', '26.1');
  assert.equal(
    report[0]!.id,
    'oracle:templates/region-components/interactive-report/interactive-report.standard',
  );
  assert.ok(report[0]!.code?.text.includes('type: interactiveReport'));
  assert.ok(report[0]!.requiresReferences.every((link) => link.title && link.kind === 'contract'));
  const index = await search('interactive report index', '26.1');
  assert.equal(
    index[0]!.id,
    'oracle:templates/region-components/interactive-report/interactive-report._index',
  );
  // Grammar reads resolve related productions to their names.
  const production = await read('grammar:dynamic-action', 0, 4096);
  assert.equal(production.id, 'oracle-grammar-1193');
  assert.ok(production.relatedReferences.some((link) => link.title === 'dynamic-action-body-line'));
  const grammar = await search('dynamic action refresh region', '26.1', { kind: 'grammar' });
  assert.ok(grammar.length >= 3, 'any-term fallback replaces the previous empty result');
  // Unresolved recipes stay hidden unless requested.
  const hidden = await search('master detail', undefined, { corpus: 'patterns', limit: 8 });
  assert.ok(hidden.every((hit) => hit.readiness !== 'unresolved'));
  const shown = await search('master detail', undefined, {
    corpus: 'patterns',
    limit: 8,
    includeUnresolved: true,
  });
  assert.ok(shown.some((hit) => hit.readiness === 'unresolved'));
});
