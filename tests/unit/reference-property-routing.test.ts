import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { referenceRead, referenceSearch, type Reference } from '../../packages/core/src/references.ts';
import { writeJson } from '../../packages/core/src/fs.ts';

test('property questions route through real owner/group productions without changing generation or filters', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-property-routing-'));
  const previous = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = previous;
    await rm(root, { recursive: true, force: true });
  });
  const grammar = (id: string, symbol: string, definition: string): Reference => ({
    id,
    title: symbol,
    text: `<${symbol}> ::= ${definition}\n`,
    kind: 'grammar',
    family: 'grammar',
    version: '26.1@pinned',
    source: 'local-fixture',
  });
  const entries: Reference[] = [
    {
      id: 'panel-example',
      title: 'interactive-panel',
      kind: 'template',
      family: 'panels',
      version: '26.1@pinned',
      source: 'local-fixture',
      text: 'Interactive panel example. Configure panel cache policy expiration or layout; a general composition, not the property definition.',
    },
    grammar('panel', 'panel-z', '"panel" "(" { <panel-z-cache-policy> | <panel-z-layout> } ")"'),
    grammar(
      'cache-group',
      'panel-z-cache-policy',
      '<indent> "cachePolicy" "{" { <panel-z-cache-policy-property-line> } "}"',
    ),
    grammar('cache-line', 'panel-z-cache-policy-property-line', '<panel-z-cache-policy-property>'),
    grammar('cache-properties', 'panel-z-cache-policy-property', '"ttlSeconds" ":" <number>'),
    grammar('layout-group', 'panel-z-layout', '<indent> "layout" "{" { <panel-z-layout-property> } "}"'),
    grammar('layout-properties', 'panel-z-layout-property', '"columns" ":" <number>'),
    grammar('page', 'page', '"page" "(" <page-cache-policy> ")"'),
    grammar(
      'page-cache',
      'page-cache-policy',
      '<indent> "cachePolicy" "{" { <page-cache-policy-property> } "}"',
    ),
    grammar('page-cache-properties', 'page-cache-policy-property', '"ttlSeconds" ":" <number>'),
    // Matching symbol prefixes do not establish ownership when the actual group links elsewhere.
    grammar('unrelated', 'panel-q', '"panel" "(" <panel-q-cache-policy> ")"'),
    grammar(
      'false-group',
      'panel-q-cache-policy',
      '<indent> "cachePolicy" "{" <unrelated-property> "}" (* <panel-q-cache-policy-property> *)',
    ),
    grammar('false-properties', 'panel-q-cache-policy-property', '"ttlSeconds" ":" <number>'),
    {
      id: 'menu-example',
      title: 'interactive-menu',
      kind: 'template',
      family: 'menus',
      version: '26.1@pinned',
      source: 'local-fixture',
      text: 'Configure interactive menu cache policy expiration. A genuine matching composition.',
    },
    // A real owner can be cyclic and mention the apparent group in comments or
    // quoted terminals without ever containing that group as a production edge.
    grammar(
      'disconnected-owner',
      'menu-z',
      '"menu" "(" <menu-z-body-line> ")" "<menu-z-cache-policy>" (* outer (* nested *) <menu-z-cache-policy> *)',
    ),
    grammar('menu-body', 'menu-z-body-line', '<menu-z-loop>'),
    grammar('menu-loop', 'menu-z-loop', '<menu-z-body-line>'),
    grammar(
      'disconnected-group',
      'menu-z-cache-policy',
      '<indent> "cachePolicy" "{" <menu-z-cache-policy-property> "}"',
    ),
    grammar('disconnected-property', 'menu-z-cache-policy-property', '"ttlSeconds" ":" <number>'),
  ];
  await writeJson(path.join(root, 'references/index.json'), entries);
  const query = 'configure an interactive panel cache policy expiration';
  const first = (await referenceSearch(query, '26.1'))[0]!;
  assert.equal(first.id, 'cache-properties');
  assert.match(first.text, /ttlSeconds/);
  assert.ok('relatedReferences' in first);
  assert.deepEqual(
    first.relatedReferences.map((link) => link.id),
    ['cache-group', 'panel'],
  );
  const read = await referenceRead(first.id, 0, 4096, undefined, '26.1');
  assert.ok('relatedReferences' in read);
  assert.deepEqual(
    read.relatedReferences.slice(0, 2).map((link) => link.id),
    ['cache-group', 'panel'],
  );
  assert.equal((await referenceSearch('panel cachePolicy', '26.1'))[0]?.id, first.id);
  assert.equal((await referenceSearch('panel cachepolicy', '26.1'))[0]?.id, first.id);
  assert.equal((await referenceSearch('panel layout properties', '26.1'))[0]?.id, 'layout-properties');
  assert.equal((await referenceSearch('page cache policy', '26.1'))[0]?.id, 'page-cache-properties');
  assert.equal((await referenceSearch('interactive panel', '26.1'))[0]?.id, 'panel-example');
  assert.equal((await referenceSearch(query, '26.1', { kind: 'template' }))[0]?.id, 'panel-example');
  assert.ok(
    (await referenceSearch(query, '26.1', { family: 'panels' })).every((hit) => hit.kind === 'template'),
  );
  assert.deepEqual(await referenceSearch(query, '26.1@other'), []);
  assert.deepEqual(await referenceSearch(query, '26.2'), []);
  assert.equal((await referenceSearch('false-properties', '26.1'))[0]?.id, 'false-properties');
  assert.equal(
    (await referenceSearch('configure interactive menu cache policy expiration', '26.1'))[0]?.id,
    'menu-example',
  );
  const disconnected = await referenceRead('disconnected-property', 0, 4096, undefined, '26.1');
  assert.ok('relatedReferences' in disconnected);
  assert.ok(
    disconnected.relatedReferences.every(
      (link) => !['disconnected-owner', 'disconnected-group'].includes(link.id),
    ),
  );
  const falseGroup = await referenceRead('false-properties', 0, 4096, undefined, '26.1');
  assert.ok('relatedReferences' in falseGroup);
  assert.ok(falseGroup.relatedReferences.every((link) => !['unrelated', 'false-group'].includes(link.id)));
});

test('the pinned Oracle column Read Only definition is useful on the first contextual search', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-oracle-property-'));
  const previous = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = previous;
    await rm(root, { recursive: true, force: true });
  });
  const entries = JSON.parse(await readFile('resources/references/index.json', 'utf8')) as Reference[];
  await writeJson(path.join(root, 'references/index.json'), entries);
  for (const query of [
    'interactive grid column read only condition',
    'interactive grid column read only condition another column',
    'IG column readOnly condition',
  ]) {
    const first = (await referenceSearch(query, '26.1', { limit: 3 }))[0]!;
    assert.equal(first.id, 'oracle-grammar-2341');
    assert.equal(first.version, '26.1@b94ccf4');
    assert.match(first.text, /plsqlExpression/);
    assert.ok('relatedReferences' in first);
    assert.equal(first.relatedReferences[0]?.title, 'column-g-read-only');
    const definition = await referenceRead(first.id, 0, 4096, undefined, '26.1');
    assert.match(definition.content, /"execute".*"forEachRow"/);
    assert.equal(definition.nextOffset, null);
  }
  assert.equal((await referenceSearch('page read only', '26.1'))[0]?.title, 'page-read-only-property');
  assert.equal((await referenceSearch('region read only', '26.1'))[0]?.title, 'region-read-only-property');
  assert.equal((await referenceSearch('interactive grid', '26.1'))[0]?.kind, 'template');
  assert.equal((await referenceSearch('oracle-grammar-2339', '26.1'))[0]?.id, 'oracle-grammar-2339');
  assert.equal((await referenceSearch('grammar:column-g-read-only', '26.1'))[0]?.id, 'oracle-grammar-2339');
  const query = 'interactive grid column read only condition';
  const firstPage = await referenceSearch(query, '26.1', { limit: 1 });
  const nextPage = await referenceSearch(query, '26.1', { offset: 1, limit: 1 });
  assert.equal(firstPage[0]?.id, 'oracle-grammar-2341');
  assert.equal(firstPage[0]?.nextResultOffset, 1);
  assert.notEqual(nextPage[0]?.id, firstPage[0]?.id);
  assert.equal(nextPage[0]?.totalMatches, firstPage[0]?.totalMatches);
});
