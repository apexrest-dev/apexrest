import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, symlink, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  componentRead,
  componentSearch,
  type ComponentReference,
} from '../../packages/core/src/components.ts';
import { referenceRead, referenceSearch, references } from '../../packages/core/src/references.ts';
import { schemas } from '../../packages/core/src/operations.ts';
import { dispatch } from '../../packages/core/src/service.ts';
import { redact, success } from '../../packages/core/src/result.ts';
import { toolOutput } from '../../packages/mcp/src/output.ts';
import { hash, writeJson } from '../../packages/core/src/fs.ts';

const compatibility = { apexVersion: '26.1', themeVersion: '26.1', mmdVersion: '26.1.0+3102' };
function entry(
  id: string,
  title: string,
  searchText: string,
  overrides: Partial<ComponentReference> = {},
): ComponentReference {
  return {
    id: `component:${id}`,
    title,
    searchText,
    kind: 'template',
    family: id.split('/')[0]!,
    version: '26.1@fixture',
    source: 'https://example.test/universal-theme',
    document: `documents/${id}.md`,
    sha256: '',
    requires: [],
    related: [],
    readiness: 'ready',
    compatibility,
    ...overrides,
  };
}
async function fixture(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-components-'));
  const previous = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = previous;
    await rm(root, { recursive: true, force: true });
  });
  return root;
}
async function catalog(root: string, inputs: ComponentReference[], content?: string) {
  const files: Record<string, string> = {};
  const entries = [];
  for (const input of inputs) {
    const raw = content ?? `# ${input.title}\n\n${input.searchText}\n`;
    const file = path.join(root, 'components', input.document);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, raw);
    files[input.document] = hash(raw);
    entries.push({ ...input, sha256: hash(raw), length: raw.length });
  }
  const index = JSON.stringify(entries, null, 2) + '\n';
  await writeFile(path.join(root, 'components/index.json'), index);
  files['index.json'] = hash(index);
  const manifest = {
    schemaVersion: 1,
    catalogVersion: 'fixture',
    source: compatibility,
    indexSha256: hash(index),
    files,
    counts: { entries: entries.length },
  };
  await writeJson(path.join(root, 'components/manifest.json'), manifest);
  return { entries, manifest };
}

test('component lookup is separate, bilingual, ranked and filtered without loading documents', async (t) => {
  const root = await fixture(t);
  const { entries } = await catalog(root, [
    entry(
      'template-components/metric-card/recipes/basic',
      'Metric Card',
      'картка показника metric card settings.value pageItemsToSubmit',
    ),
    entry('lists/media-list/recipes/basic', 'Media List (List)', 'media list classic navigation'),
    entry(
      'template-components/media-list/recipes/basic',
      'Media List (Template Component)',
      'media list report partial',
    ),
    entry('reports/comments/recipes/basic', 'Comments (Classic Report)', 'comments classic report'),
    entry(
      'template-components/comments/recipes/basic',
      'Comments (Template Component)',
      'comments template component',
    ),
    entry(
      'template-components/metric-card/parameters',
      'Metric Card Parameters',
      'settings.value pageItemsToSubmit картка показника',
      { kind: 'contract' },
    ),
  ]);
  const english = await referenceSearch('metric card', '26.1', { corpus: 'components', kind: 'template' });
  const ukrainian = await referenceSearch('картка показника', '26.1', {
    corpus: 'components',
    kind: 'template',
  });
  assert.equal(english[0]!.id, entries[0]!.id);
  assert.equal(ukrainian[0]!.id, english[0]!.id);
  assert.equal((await componentSearch('pageItemsToSubmit', '26.1'))[0]!.id, entries[5]!.id);
  assert.equal((await componentSearch('page items to submit', '26.1')).length, 2);
  assert.equal((await componentSearch('media list', '26.1', { family: 'lists' }))[0]!.id, entries[1]!.id);
  assert.equal(
    (await componentSearch('media list', '26.1', { family: 'template-components' }))[0]!.id,
    entries[2]!.id,
  );
  assert.equal((await componentSearch('comments', '26.1', { family: 'reports' }))[0]!.id, entries[3]!.id);
  assert.equal((await componentSearch('metric card', '26.1@fixture')).length, 2);
  assert.deepEqual(await componentSearch('metric card', '26.2'), []);
  assert.deepEqual(await componentSearch('metric card', '26.1@different'), []);
  assert.deepEqual(await componentSearch('metric card', undefined, { kind: 'grammar' }), []);
  assert.equal((await componentSearch(entries[0]!.id))[0]!.id, entries[0]!.id);
  assert.equal((await referenceRead(entries[0]!.id, 0, 20)).classification, 'component-reference-data');
  assert.deepEqual(await referenceSearch('картка показника'), []);
  assert.deepEqual(await referenceSearch('картка показника', undefined, { corpus: 'apexlang' }), []);
  assert.equal((await referenceRead('apexlang-lifecycle', 0, 8192)).content, references[0]!.text);
  await rm(path.join(root, 'components/documents'), { recursive: true });
  assert.equal((await componentSearch('metric card'))[0]!.readiness, 'ready');
  await assert.rejects(componentRead(entries[0]!.id, 0, 10), { code: 'COMPONENT_CATALOG_INVALID' });
});

test('component checksums fail closed and cache refreshes after index, manifest or resource root changes', async (t) => {
  const root = await fixture(t);
  const initial = entry('test/recipe', 'Initial recipe', 'keyword');
  const { entries } = await catalog(root, [initial]);
  assert.equal((await componentSearch('keyword'))[0]!.title, 'Initial recipe');
  await writeFile(path.join(root, 'components', entries[0]!.document), 'tampered');
  await assert.rejects(componentRead(initial.id, 0, 100), { code: 'COMPONENT_CATALOG_INVALID' });
  await catalog(root, [{ ...initial, title: 'Changed recipe' }]);
  assert.equal((await componentSearch('keyword'))[0]!.title, 'Changed recipe');
  const index = path.join(root, 'components/index.json');
  const info = await stat(index);
  await writeFile(index, (await readFile(index, 'utf8')).replace('Changed', 'Tampered'));
  await utimes(index, info.atime, info.mtime);
  await assert.rejects(componentSearch('keyword'), { code: 'COMPONENT_CATALOG_INVALID' });
  await catalog(root, [initial]);
  assert.equal((await componentSearch('keyword'))[0]!.title, initial.title);
  await writeFile(path.join(root, 'components/manifest.json'), '{bad json');
  await assert.rejects(componentSearch('keyword'), { code: 'COMPONENT_CATALOG_INVALID' });
  const other = path.join(root, 'other');
  await catalog(other, [{ ...initial, title: 'Different root' }]);
  process.env.APEXREST_RESOURCES = other;
  assert.equal((await componentSearch('keyword'))[0]!.title, 'Different root');
  process.env.APEXREST_RESOURCES = path.join(root, 'missing');
  assert.deepEqual(await componentSearch('!!!'), []);
  await assert.rejects(componentSearch('keyword'), { code: 'COMPONENT_CATALOG_UNAVAILABLE' });
});

test('catalog rejects traversals, document symlink escapes, index symlink escapes and dangling references', async (t) => {
  const root = await fixture(t);
  const recipe = entry('test/recipe', 'Recipe', 'keyword');
  const updateIndex = async (
    entries: unknown[],
    manifest: Awaited<ReturnType<typeof catalog>>['manifest'],
  ) => {
    const index = JSON.stringify(entries);
    manifest.indexSha256 = hash(index);
    manifest.files['index.json'] = hash(index);
    await writeFile(path.join(root, 'components/index.json'), index);
    await writeJson(path.join(root, 'components/manifest.json'), manifest);
  };
  for (const document of [
    '../private.md',
    '/private.md',
    'documents/../private.md',
    'documents\\private.md',
  ]) {
    const { entries, manifest } = await catalog(root, [recipe]);
    entries[0]!.document = document;
    manifest.files[document] = entries[0]!.sha256;
    await updateIndex(entries, manifest);
    await assert.rejects(componentSearch('keyword'), { code: 'COMPONENT_CATALOG_INVALID' });
  }
  const { entries } = await catalog(root, [recipe]);
  const file = path.join(root, 'components', entries[0]!.document);
  const outside = path.join(root, 'outside.md');
  await writeFile(outside, await readFile(file));
  await rm(file);
  await symlink(outside, file);
  await assert.rejects(componentRead(recipe.id, 0, 100), { code: 'COMPONENT_CATALOG_INVALID' });
  await rm(file);
  await catalog(root, [recipe]);
  const index = path.join(root, 'components/index.json'),
    outsideIndex = path.join(root, 'outside.json');
  await writeFile(outsideIndex, await readFile(index));
  await rm(index);
  await symlink(outsideIndex, index);
  await assert.rejects(componentSearch('keyword'), { code: 'COMPONENT_CATALOG_INVALID' });
  await rm(index);
  await catalog(root, [{ ...recipe, requires: ['component:missing'] }]);
  await assert.rejects(componentSearch('keyword'), { code: 'COMPONENT_CATALOG_INVALID' });
});

test('bounded projectless search pagination recovers every result through actual MCP formatting', async (t) => {
  const root = await fixture(t);
  const recipes = Array.from({ length: 23 }, (_, i) =>
    entry(`test/recipe-${i}`, 'Картка "значення" 😀 '.repeat(8), 'keyword ' + '😀 Україна\\"\n'.repeat(100), {
      requires: Array.from({ length: 80 }, (_, n) => 'oracle:' + 'x'.repeat(150) + n),
    }),
  );
  await catalog(root, recipes);
  const ids: string[] = [];
  let offset: number | null = 0;
  do {
    const result = await dispatch('docs.search', {
      query: 'keyword',
      corpus: 'components',
      offset,
      limit: 8,
    });
    assert.equal(result.ok, true);
    assert.ok(Buffer.byteLength(JSON.stringify(result), 'utf8') < 8192);
    const output = await toolOutput(result);
    const data = JSON.parse(output.content[0]!.text).data;
    assert.ok(
      Array.isArray(data),
      'MCP must not replace offline data with an unrecoverable artifact summary',
    );
    assert.ok(data.length);
    ids.push(...data.map((hit: { id: string }) => hit.id));
    const next = data[0].nextResultOffset;
    assert.ok(next === null || next > offset!);
    offset = next;
  } while (offset !== null);
  assert.equal(ids.length, recipes.length);
  assert.equal(new Set(ids).size, recipes.length);
});

test('read pages are bounded, preserve Unicode and recover all omitted dependency and related IDs', async (t) => {
  const root = await fixture(t);
  const recipe = entry('test/recipe', 'Recipe', 'keyword', {
    requires: Array.from({ length: 180 }, (_, n) => 'oracle:requires-' + n),
    related: Array.from({ length: 170 }, (_, n) => 'oracle:related-' + n),
  });
  const raw = '😀\\"\nУкраїна'.repeat(2500);
  await catalog(root, [recipe], raw);
  const first = await componentRead(recipe.id, 0, 8192);
  assert.equal(first.requiresOmittedCount, 164);
  assert.equal(first.relatedOmittedCount, 154);
  assert.equal(first.navigationOffset, raw.length);
  const pieces = [];
  let offset: number | null = 0;
  do {
    const result = await componentRead(recipe.id, offset, 8192);
    assert.ok(Buffer.byteLength(JSON.stringify(success('docs.read', result)), 'utf8') < 32768);
    assert.ok(result.content.length);
    assert.equal(Buffer.from(result.content, 'utf8').toString('utf8'), result.content);
    pieces.push(result.content);
    assert.ok(result.nextOffset === null || result.nextOffset > offset);
    offset = result.nextOffset;
  } while (offset !== null);
  const full = pieces.join('');
  assert.equal(full.slice(0, raw.length), raw);
  assert.equal(full.length, first.length);
  for (const id of [...recipe.requires, ...recipe.related])
    assert.ok(full.slice(first.navigationOffset).includes(id));
  const tiny = await componentRead(recipe.id, 0, 1);
  assert.equal(tiny.content, '😀');
  assert.equal(tiny.nextOffset, 2);
});

test('public corpus schema remains optional and dispatch works without project setup', async (t) => {
  const root = await fixture(t);
  await catalog(root, [entry('test/recipe', 'Recipe', 'keyword')]);
  assert.equal(schemas['docs.search'].parse({ query: 'validate' }).corpus, 'apexlang');
  assert.equal((await dispatch('docs.search', { query: 'keyword', corpus: 'components' })).ok, true);
  assert.equal((await dispatch('docs.search', { query: 'keyword', corpus: 'other' })).exitCode, 2);
  assert.equal((await dispatch('docs.read', { id: 'component:test/recipe' })).ok, true);
  assert.equal(
    (await dispatch('docs.read', { id: 'component:test/missing' })).diagnostics[0]!.code,
    'REFERENCE_NOT_FOUND',
  );
});

test('search budget contraction terminates for emoji-only prefixes and never splits snippet Unicode', async (t) => {
  const root = await fixture(t);
  const recipes = Array.from({ length: 8 }, (_, i) =>
    entry(`test/emoji-${i}`, 'Example', '😀'.repeat(80) + ' keyword', {
      source: 'https://example.test/' + 'x'.repeat(1980),
    }),
  );
  await catalog(root, recipes);
  const seen = [];
  let offset: number | null = 0;
  do {
    const hits = await componentSearch('keyword', undefined, { offset, limit: 8 });
    assert.ok(hits.length > 0 && hits.length < 8);
    assert.ok(hits.every((hit) => Buffer.from(hit.text, 'utf8').toString('utf8') === hit.text));
    for (const hit of hits) {
      assert.equal(hit.text, recipes[0]!.searchText.slice(hit.offset, hit.offset + hit.text.length));
      seen.push(hit.id);
    }
    offset = hits[0]!.nextResultOffset;
  } while (offset !== null);
  assert.equal(new Set(seen).size, recipes.length);
});

test('component document redaction precedes pagination and full MCP recovery keeps split markers exact', async (t) => {
  const root = await fixture(t);
  const recipe = entry('test/redaction', 'Redaction example', 'keyword');
  const raw =
    'A public syntax example\n{"token": "illustrative-value", "mode": "sample"}\n' +
    'secret=illustrative-value\npassword: illustrative-value\n' +
    '😀\n'.repeat(80);
  await catalog(root, [recipe], raw);
  let offset: number | null = 0;
  const chunks = [];
  let length = 0;
  do {
    const result = await dispatch('docs.read', { id: recipe.id, offset, limit: 7 });
    const output = await toolOutput(result);
    const page = JSON.parse(output.content[0]!.text).data;
    assert.equal(page.offset, offset);
    assert.equal(page.documentLength, redact(raw).length);
    assert.equal(page.sourceDocumentLength, raw.length);
    assert.equal(page.navigationOffset, redact(raw).length);
    assert.equal(page.contentSanitized, true);
    chunks.push(page.content);
    length = page.length;
    offset = page.nextOffset;
  } while (offset !== null);
  const recovered = chunks.join('');
  assert.equal(recovered.length, length);
  assert.equal(recovered.slice(0, redact(raw).length), redact(raw));
  assert.ok(!recovered.includes('illustrative-value'));
  assert.equal(Buffer.from(recovered, 'utf8').toString('utf8'), recovered);
});

test('search budgets include redaction expansion before projectless MCP serialization', async (t) => {
  const root = await fixture(t);
  await catalog(
    root,
    Array.from({ length: 8 }, (_, i) =>
      entry(`test/expansion-${i}`, 'Example', 'keyword\n' + 'token=a\n'.repeat(100), {
        source: 'https://example.test/' + 'x'.repeat(800),
      }),
    ),
  );
  const result = await dispatch('docs.search', { query: 'keyword', corpus: 'components', limit: 8 });
  assert.equal(result.ok, true);
  assert.ok(Buffer.byteLength(JSON.stringify(result), 'utf8') < 8192);
  const output = await toolOutput(result);
  assert.ok(Array.isArray(JSON.parse(output.content[0]!.text).data));
  assert.ok(!output.content[0]!.text.includes('token=a'));
});

test('component search hides unresolved recipes by default, inlines verified recipe code and resolves links', async (t) => {
  const root = await fixture(t);
  const code = '```apexlang\npage 1 (\n    region demo (\n        type: cards\n    )\n)\n```';
  const ready = entry('regions/cards/recipes/basic', 'Native Cards', 'cards картки', {
    requires: [
      'component:regions/cards/parameters',
      'oracle:templates/region-components/cards/cards.standard',
    ],
    related: ['component:regions/cards'],
  });
  const inputs = [
    ready,
    entry('regions/cards/parameters', 'Native Cards parameters', 'cards параметри', {
      kind: 'contract',
      readiness: 'reference',
    }),
    entry('regions/cards', 'Native Cards', 'cards картки overview', {
      kind: 'contract',
      readiness: 'reference',
    }),
    entry('regions/cards/recipes/favorite', 'Cards favorite action', 'cards favorite', {
      readiness: 'unresolved',
    }),
  ];
  const { entries } = await catalog(
    root,
    inputs,
    '# Native Cards\n\nStatus: ready.\n\n## Data contract\n\n```json\n{"tables": []}\n```\n\n## pages/p00001-home.apx\n\n' +
      code +
      '\n',
  );
  const hits = await componentSearch('cards', '26.1', { limit: 8 });
  assert.equal(hits[0]!.id, ready.id, 'the ready recipe outranks its overview contract');
  assert.ok(hits.every((hit) => hit.readiness !== 'unresolved'));
  assert.equal(hits[0]!.code?.language, 'apexlang');
  assert.match(hits[0]!.code!.text, /region demo/);
  assert.ok(hits.slice(1).every((hit) => hit.code === undefined));
  assert.deepEqual(hits[0]!.requiresReferences, [
    { id: 'component:regions/cards/parameters', title: 'Native Cards parameters', kind: 'contract' },
    { id: 'oracle:templates/region-components/cards/cards.standard', title: null, kind: null },
  ]);
  assert.deepEqual(hits[0]!.relatedReferences, [
    { id: 'component:regions/cards', title: 'Native Cards', kind: 'contract' },
  ]);
  const shown = await componentSearch('cards', '26.1', { limit: 8, includeUnresolved: true });
  assert.ok(shown.some((hit) => hit.readiness === 'unresolved'));
  assert.equal((await componentSearch(entries[3]!.id))[0]?.id, entries[3]!.id, 'exact IDs bypass the filter');
  const everywhere = await componentSearch('cards', '26.1', { limit: 8, include: 'code' });
  assert.ok(everywhere.filter((hit) => hit.code).length >= 2);
  assert.ok(
    (await componentSearch('cards', '26.1', { include: 'metadata' })).every((hit) => hit.code === undefined),
  );
  const page = await componentRead(ready.id, 0, 8192);
  assert.deepEqual(page.relatedReferences, [
    { id: 'component:regions/cards', title: 'Native Cards', kind: 'contract' },
  ]);
  assert.equal(page.requiresReferences[1]!.title, null);
  // A tampered recipe document yields no inline code; search still answers and read fails closed.
  await catalog(root, inputs, '# Native Cards\n\nchanged\n');
  await writeFile(path.join(root, 'components', ready.document), 'tampered');
  const tampered = await componentSearch('cards', '26.1');
  assert.equal(tampered[0]!.id, ready.id);
  assert.equal(tampered[0]!.code, undefined);
  await assert.rejects(componentRead(ready.id, 0, 100), { code: 'COMPONENT_CATALOG_INVALID' });
});
