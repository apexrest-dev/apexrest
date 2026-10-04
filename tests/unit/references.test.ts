import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  referenceRead,
  referenceSearch,
  referenceSync,
  references,
} from '../../packages/core/src/references.ts';
import { readJson, writeJson } from '../../packages/core/src/fs.ts';

test('reference cache preserves ordering and bounds and refreshes after replacement, root changes or failure', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-reference-'));
  const previous = { resources: process.env.APEXREST_RESOURCES, home: process.env.APEXREST_HOME };
  t.after(async () => {
    for (const [key, value] of [
      ['APEXREST_RESOURCES', previous.resources],
      ['APEXREST_HOME', previous.home],
    ] as const)
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    await rm(root, { recursive: true, force: true });
  });
  process.env.APEXREST_RESOURCES = root;
  process.env.APEXREST_HOME = path.join(root, 'home');
  const file = path.join(root, 'references/index.json');
  const entries = Array.from({ length: 12 }, (_, i) => ({
    id: 'fixture-' + i,
    version: 'fixture',
    source: 'local-fixture',
    text: 'keyword ' + 'a'.repeat(2000),
  }));
  await writeJson(file, entries);
  const results = await Promise.all(Array.from({ length: 4 }, () => referenceSearch('keyword', 'fixture')));
  assert.ok(
    results.every(
      (result) => result.length === 3 && result[0]?.id === 'fixture-0' && result[0]?.text.length === 1200,
    ),
  );
  const expanded = await referenceSearch('keyword', 'fixture', { limit: 8 });
  assert.equal(expanded.length, 8);
  assert.deepEqual(
    results[0]!.map(({ id }) => id),
    expanded.slice(0, 3).map(({ id }) => id),
  );
  assert.equal(results[0]![0]!.nextResultOffset, 3);
  assert.equal(expanded[0]!.nextResultOffset, 8);
  const page = await referenceRead('fixture-9', 7, 10);
  assert.equal(page.content, entries[9]!.text.slice(7, 17));
  assert.equal(page.nextOffset, 17);
  await referenceSync('fixture', false);
  assert.deepEqual(await readJson(path.join(root, 'home/references/fixture.json')), entries);

  await writeJson(file, [{ ...entries[0], text: 'replacement keyword' }]);
  assert.equal((await referenceRead('fixture-0', 0, 100)).content, 'replacement keyword');
  assert.equal((await referenceSearch('keyword')).length, 1);
  await referenceSync('fixture', false);
  assert.deepEqual(await readJson(path.join(root, 'home/references/fixture.json')), [
    { ...entries[0], text: 'replacement keyword' },
  ]);

  await writeFile(file, '{invalid json');
  assert.deepEqual(await referenceSearch('!!!'), [], 'empty search must not load the corpus');
  await assert.rejects(referenceSearch('keyword'));
  await writeJson(file, entries);
  assert.equal((await referenceSearch('keyword')).length, 3);
  await rm(file);
  assert.deepEqual(await referenceSearch('keyword'), []);
  await writeJson(file, entries);
  assert.equal((await referenceSearch('keyword')).length, 3);

  const other = path.join(root, 'other');
  await mkdir(other);
  process.env.APEXREST_RESOURCES = other;
  assert.deepEqual(await referenceSearch('keyword'), []);
  assert.equal((await referenceRead(references[0]!.id, 0, 5000)).content, references[0]!.text);
});

test('ranked lookup returns owning syntax, exact versions, match windows and stable pagination', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-ranked-'));
  const previous = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = previous;
    await rm(root, { recursive: true, force: true });
  });
  const entries = Array.from({ length: 12 }, (_, i) => ({
    id: 'incidental-' + i,
    title: 'Unrelated example ' + i,
    kind: 'template',
    family: 'examples',
    version: '26.1@pinned',
    source: 'local-fixture',
    text: 'A chart series example. ' + 'x'.repeat(1800),
  }));
  entries.push({
    id: 'owner',
    title: 'chart-series',
    kind: 'grammar',
    family: 'grammar',
    version: '26.1@pinned',
    source: 'local-fixture',
    text: '<chart-series> ::= ' + 'x'.repeat(2500) + ' "pageItemsToSubmit" <query-source>\n',
  });
  entries.push({
    id: 'query-rule',
    title: 'query-source',
    kind: 'grammar',
    family: 'grammar',
    version: '26.1@pinned',
    source: 'local-fixture',
    text: '<query-source> ::= "sqlQuery"\n',
  });
  await writeJson(path.join(root, 'references/index.json'), entries);
  const first = await referenceSearch('chart series', '26.1', { limit: 3 });
  assert.equal(first[0]?.id, 'owner', 'owning production must outrank earlier incidental mentions');
  assert.equal(first[0]?.totalMatches, 13);
  assert.equal(first[0]?.nextResultOffset, 3);
  const second = await referenceSearch('chart series', '26.1', { offset: 3, limit: 3 });
  assert.ok(second.every((hit) => !first.some((prior) => prior.id === hit.id)));
  assert.equal((await referenceSearch('chart series', '26.1@other')).length, 0);
  assert.equal((await referenceSearch('chart series', '26.2')).length, 0);
  assert.equal((await referenceSearch('chart series', '26.1@pinned', { kind: 'grammar' })).length, 1);
  assert.equal((await referenceSearch('chart series', '26.1', { family: 'grammar' })).length, 1);
  const property = (await referenceSearch('pageItemsToSubmit', '26.1'))[0]!;
  assert.ok(property.offset > 1200);
  assert.match(property.text, /pageItemsToSubmit/);
  assert.equal(property.text, entries[12]!.text.slice(property.offset, property.offset + 1200));
  const spaced = (await referenceSearch('page items to submit', '26.1'))[0]!;
  assert.equal(spaced.id, property.id);
  assert.match(spaced.text, /pageItemsToSubmit/);
  assert.equal((await referenceSearch('owner'))[0]?.id, 'owner');
  assert.deepEqual(await referenceSearch('!!!'), []);
  assert.deepEqual(await referenceSearch('   '), []);
  assert.deepEqual(await referenceSearch('not-present anywhere'), []);
  const production = await referenceRead('grammar:chart-series', 2400, 500);
  assert.equal(production.id, 'owner');
  assert.ok(production.related.includes('query-rule'));
  assert.equal(production.content, entries[12]!.text.slice(2400, 2900));

  // Reuse the same matched entries across distinct queries, then change the corpus
  // in place without changing its size or mtime. Derived ranking must also refresh.
  assert.equal((await referenceSearch('chart', '26.1'))[0]?.id, 'owner');
  const file = path.join(root, 'references/index.json');
  const before = await stat(file);
  entries[12]!.text = entries[12]!.text.replace('pageItemsToSubmit', 'otherItemsToFetch');
  await writeFile(file, JSON.stringify(entries, null, 2) + '\n');
  await utimes(file, before.atime, before.mtime);
  assert.equal((await stat(file)).size, before.size);
  assert.equal((await referenceSearch('pageItemsToSubmit', '26.1')).length, 0);
  const updated = (await referenceSearch('other items to fetch', '26.1'))[0]!;
  assert.equal(updated.id, 'owner');
  assert.match(updated.text, /otherItemsToFetch/);
});

test('generation queries fall back to any-term ranking with stemming, aliases, routing demotion and inline code', async (t) => {
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
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-generation-'));
  const previous = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = previous;
    await rm(root, { recursive: true, force: true });
  });
  const template = (
    id: string,
    title: string,
    text: string,
    kind = 'template',
    family = 'items/text-area',
  ) => ({
    id,
    title,
    kind,
    family,
    version: '26.1@pinned',
    source: 'local-fixture',
    text,
  });
  const code = '```apexlang\nitem P1_NOTES (\n  type: textarea\n)\n```';
  await writeJson(path.join(root, 'references/index.json'), [
    template(
      'oracle:templates/items/text-area/text-area._index',
      'items/text-area/text-area._index',
      'Routing entrypoint for text-area templates. Load order: text area common then one scenario.',
      'contract',
    ),
    template(
      'oracle:templates/items/text-area/text-area._common',
      'items/text-area/text-area._common',
      'Shared text area contract. Properties: textAreaHeight, resizable. ' + 'x'.repeat(6000),
      'contract',
    ),
    {
      ...template(
        'oracle:templates/items/text-area/text-area.minimal',
        'items/text-area/text-area.minimal',
        '# Minimal text area item\n\n' + code + '\n',
      ),
      requires: ['oracle:templates/items/text-area/text-area._common'],
      related: ['oracle-grammar-7'],
    },
    template(
      'oracle:templates/region-components/cards/cards.standard',
      'region-components/cards/cards.standard',
      '# Cards region item list\n\n```apexlang\nregion cards (\n  type: cards\n)\n```\n',
      'template',
      'region-components/cards',
    ),
    template(
      'oracle-grammar-7',
      'page-item-appearance-property',
      '<page-item-appearance-property> ::= "textAreaHeight" ":" <ws> <number>\n',
      'grammar',
      'grammar',
    ),
    template(
      'oracle-grammar-8',
      'page-item',
      '<page-item> ::= "item" <ws> <page-item-appearance-property>\n',
      'grammar',
      'grammar',
    ),
  ]);
  // "textarea" is one word in the query and two in the corpus; "items" is plural.
  const alias = await search('textarea items', '26.1');
  assert.equal(alias[0]?.id, 'oracle:templates/items/text-area/text-area.minimal');
  assert.ok(alias.every((hit) => !hit.id.endsWith('._index') || hit !== alias[0]));
  // Only the concrete template matches the whole query; routing documents trail it.
  const partial = await search('text area item with resizable height', '26.1');
  assert.equal(partial[0]?.id, 'oracle:templates/items/text-area/text-area.minimal');
  assert.ok(partial.length >= 2, 'any-term fallback keeps partial matches');
  // Fewer than half of the terms is noise, not a match.
  assert.deepEqual(await search('zebra giraffe antelope text', '26.1'), []);
  // A navigational query keeps the routing document on top.
  assert.equal(
    (await search('text area index', '26.1'))[0]?.id,
    'oracle:templates/items/text-area/text-area._index',
  );
  // Ukrainian aliases reach the English corpus.
  assert.equal(
    (await search('картки регіон', '26.1'))[0]?.id,
    'oracle:templates/region-components/cards/cards.standard',
  );
  // The top hit carries its primary fenced block and resolved links; other hits do not by default.
  const top = alias[0]!;
  assert.equal(top.code?.language, 'apexlang');
  assert.match(top.code?.text ?? '', /item P1_NOTES/);
  assert.equal(top.code?.truncated, false);
  assert.deepEqual(top.requiresReferences, [
    {
      id: 'oracle:templates/items/text-area/text-area._common',
      title: 'items/text-area/text-area._common',
      kind: 'contract',
    },
  ]);
  assert.deepEqual(top.relatedReferences, [
    { id: 'oracle-grammar-7', title: 'page-item-appearance-property', kind: 'grammar' },
  ]);
  assert.equal(alias[1]?.code, undefined);
  const all = await search('item', '26.1', { include: 'code', limit: 8 });
  assert.equal(all.filter((hit) => hit.code).length, 2, 'every template hit carries code on request');
  const none = await search('textarea items', '26.1', { include: 'metadata' });
  assert.ok(none.every((hit) => hit.code === undefined));
  assert.ok((await search('textarea items', '26.1', { offset: 1 })).every((hit) => hit.code === undefined));
  // Grammar symbols resolve by name without a kind filter only for identifier-like queries.
  assert.equal((await search('page-item', '26.1'))[0]?.id, 'oracle-grammar-8');
  assert.equal((await search('textAreaHeight', '26.1'))[0]?.id, 'oracle-grammar-7');
  // Reading a production resolves the productions it references to their names.
  const production = await read('grammar:page-item', 0, 4096);
  assert.equal(production.kind, 'grammar');
  assert.deepEqual(production.relatedReferences, [
    { id: 'oracle-grammar-7', title: 'page-item-appearance-property', kind: 'grammar' },
  ]);
  assert.deepEqual(production.related, ['oracle-grammar-7']);
});

test('search pages stay within their character budget while keeping every hit', async (t) => {
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
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-budget-'));
  const previous = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = previous;
    await rm(root, { recursive: true, force: true });
  });
  const big = Array.from({ length: 8 }, (_, i) => ({
    id: 'template-' + i,
    title: 'keyword template ' + i,
    kind: 'template',
    family: 'fixtures',
    version: '26.1@pinned',
    source: 'local-fixture',
    text:
      '# keyword\n\n```apexlang\n' +
      ('region keyword (\n  name: ' + 'k'.repeat(90) + '\n)\n').repeat(60) +
      '```\n',
    requires: Array.from({ length: 5 }, (_, n) => 'template-' + n),
    related: Array.from({ length: 5 }, (_, n) => 'template-' + n),
  }));
  await writeJson(path.join(root, 'references/index.json'), big);
  const three = await search('keyword', '26.1');
  assert.equal(three.length, 3);
  assert.ok(JSON.stringify(three).length <= 7500);
  assert.ok(three[0]!.code && three[0]!.code.truncated && three[0]!.code.length > three[0]!.code.text.length);
  assert.equal(three[0]!.requiresReferences.length, 3);
  assert.equal(three[0]!.requiresCount, 5);
  const eight = await search('keyword', '26.1', { limit: 8, include: 'code' });
  assert.equal(eight.length, 8);
  assert.ok(JSON.stringify(eight).length <= 16000);
  assert.equal(eight[0]!.nextResultOffset, null);
});
