import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { patternRead, patternSearch, type PatternReference } from '../../packages/core/src/patterns.ts';
import { componentRead, componentSearch } from '../../packages/core/src/components.ts';
import { referenceRead, referenceSearch, references } from '../../packages/core/src/references.ts';
import { schemas } from '../../packages/core/src/operations.ts';
import { dispatch } from '../../packages/core/src/service.ts';
import { redact } from '../../packages/core/src/result.ts';
import { toolOutput } from '../../packages/mcp/src/output.ts';
import { hash, writeJson } from '../../packages/core/src/fs.ts';

const compatibility = { apexVersion: '26.1', themeVersion: '26.1', mmdVersion: '26.1.0+3102' };
function entry(id: string, overrides: Partial<PatternReference> = {}): PatternReference {
  return {
    id: `pattern:${id}`,
    title: 'Master detail',
    searchText: 'master detail головний запис деталі pageItemsToSubmit',
    kind: 'template',
    family: id.split('/')[0]!,
    version: '26.1@fixture',
    source: 'https://example.test/patterns',
    document: `docs/${id}.md`,
    sha256: '',
    requires: [],
    related: [],
    readiness: 'ready',
    compatibility,
    ...overrides,
  };
}
async function fixture(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-patterns-'));
  const previous = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = previous;
    await rm(root, { recursive: true, force: true });
  });
  return root;
}
async function catalog(root: string, inputs: PatternReference[], content?: string, directory = 'patterns') {
  const files: Record<string, string> = {};
  const entries = [];
  for (const input of inputs) {
    const raw = content ?? `# ${input.title}\n\n${input.searchText}\n`;
    const file = path.join(root, directory, input.document);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, raw);
    files[input.document] = hash(raw);
    entries.push({ ...input, sha256: hash(raw), length: raw.length });
  }
  const index = JSON.stringify(entries, null, 2) + '\n';
  await writeFile(path.join(root, directory, 'index.json'), index);
  files['index.json'] = hash(index);
  const manifest = {
    schemaVersion: 1,
    catalogVersion: 'fixture',
    source: compatibility,
    indexSha256: hash(index),
    files,
    counts: { entries: entries.length },
  };
  await writeJson(path.join(root, directory, 'manifest.json'), manifest);
  return { entries, manifest };
}

test('patterns route separately with bilingual ranking, filters and lazy cross-corpus references', async (t) => {
  const root = await fixture(t);
  const basic = entry('forms/master-detail', {
    requires: ['component:reports/interactive-grid', 'oracle:region'],
    related: ['pattern:forms/master-detail/parameters'],
  });
  const parameters = entry('forms/master-detail/parameters', {
    kind: 'contract',
    readiness: 'reference',
    title: 'Master detail parameters',
  });
  const report = entry('reports/master-detail', { title: 'Master detail report' });
  await catalog(root, [basic, parameters, report]);
  assert.equal(
    (await referenceSearch('головний запис деталі', '26.1', { corpus: 'patterns', kind: 'template' }))[0]!.id,
    basic.id,
  );
  assert.equal((await patternSearch('master detail', '26.1@fixture'))[0]!.id, basic.id);
  assert.equal(
    (await patternSearch('pageItemsToSubmit', '26.1', { kind: 'contract' }))[0]!.id,
    parameters.id,
  );
  assert.equal((await patternSearch('master detail', '26.1', { family: 'reports' }))[0]!.id, report.id);
  assert.equal(
    (await patternSearch('master detail', '26.1', { family: 'forms', limit: 1, offset: 1 }))[0]!.id,
    parameters.id,
  );
  assert.deepEqual(await patternSearch('master detail', '26.2'), []);
  assert.deepEqual(await patternSearch('master detail', '26.1@different'), []);
  assert.deepEqual(await patternSearch('master detail', undefined, { kind: 'grammar' }), []);
  assert.equal((await patternSearch(basic.id))[0]!.id, basic.id);
  const page = await referenceRead(basic.id, 0, 8192);
  assert.equal(page.classification, 'pattern-reference-data');
  assert.deepEqual(page.requires, basic.requires);
  assert.ok('compatibility' in page);
  assert.deepEqual(page.compatibility, compatibility);
  assert.ok(page.content.includes('component:reports/interactive-grid'));
  assert.deepEqual(await referenceSearch('головний запис деталі'), []);
  assert.equal((await referenceRead('apexlang-lifecycle', 0, 8192)).content, references[0]!.text);
  await assert.rejects(componentSearch('master detail'), { code: 'COMPONENT_CATALOG_UNAVAILABLE' });
  await catalog(
    root,
    [
      entry('forms/master-detail', {
        id: 'component:forms/master-detail',
        document: 'documents/forms/master-detail.md',
        title: 'Separate component',
      }),
    ],
    undefined,
    'components',
  );
  assert.equal((await componentSearch('master detail'))[0]!.title, 'Separate component');
  assert.equal((await patternSearch('master detail'))[0]!.title, basic.title);
  assert.equal(
    (await componentRead('component:forms/master-detail', 0, 20)).classification,
    'component-reference-data',
  );
  await rm(path.join(root, 'patterns/docs'), { recursive: true });
  assert.equal((await patternSearch('master detail'))[0]!.readiness, 'ready');
  await assert.rejects(patternRead(basic.id, 0, 10), { code: 'PATTERN_CATALOG_INVALID' });
});

test('pattern checksums and independent cache fail closed after source changes', async (t) => {
  const root = await fixture(t);
  const recipe = entry('forms/master-detail');
  await catalog(root, [recipe]);
  assert.equal((await patternSearch('master detail'))[0]!.title, recipe.title);
  await writeFile(path.join(root, 'patterns', recipe.document), 'tampered');
  await assert.rejects(patternRead(recipe.id, 0, 100), { code: 'PATTERN_CATALOG_INVALID' });
  await catalog(root, [{ ...recipe, title: 'Updated pattern' }]);
  assert.equal((await patternSearch('master detail'))[0]!.title, 'Updated pattern');
  const index = path.join(root, 'patterns/index.json');
  const info = await stat(index);
  await writeFile(index, (await readFile(index, 'utf8')).replace('Updated', 'Changed'));
  await utimes(index, info.atime, info.mtime);
  await assert.rejects(patternSearch('master detail'), { code: 'PATTERN_CATALOG_INVALID' });
  await catalog(root, [recipe]);
  await writeFile(path.join(root, 'patterns/manifest.json'), '{bad json');
  await assert.rejects(patternSearch('master detail'), { code: 'PATTERN_CATALOG_INVALID' });
  const other = path.join(root, 'other');
  await catalog(other, [{ ...recipe, title: 'Different resource root' }]);
  process.env.APEXREST_RESOURCES = other;
  assert.equal((await patternSearch('master detail'))[0]!.title, 'Different resource root');
  process.env.APEXREST_RESOURCES = path.join(root, 'missing');
  assert.deepEqual(await patternSearch('!!!'), []);
  await assert.rejects(patternSearch('master detail'), { code: 'PATTERN_CATALOG_UNAVAILABLE' });
});

test('pattern catalog enforces its own ID prefix, document directory and internal navigation', async (t) => {
  const root = await fixture(t);
  const recipe = entry('forms/master-detail');
  for (const document of [
    '../private.md',
    '/private.md',
    'docs/../private.md',
    'docs\\private.md',
    'documents/recipe.md',
    'docs/recipe.json',
  ]) {
    const { entries, manifest } = await catalog(root, [recipe]);
    entries[0]!.document = document;
    manifest.files[document] = entries[0]!.sha256;
    const index = JSON.stringify(entries);
    manifest.indexSha256 = hash(index);
    manifest.files['index.json'] = hash(index);
    await writeFile(path.join(root, 'patterns/index.json'), index);
    await writeJson(path.join(root, 'patterns/manifest.json'), manifest);
    await assert.rejects(patternSearch('master detail'), { code: 'PATTERN_CATALOG_INVALID' });
  }
  for (const invalid of [
    { id: 'component:forms/master-detail' },
    { requires: ['pattern:missing'] },
    { related: ['pattern:missing'] },
  ]) {
    await catalog(root, [{ ...recipe, ...invalid }]);
    await assert.rejects(patternSearch('master detail'), { code: 'PATTERN_CATALOG_INVALID' });
  }
  await catalog(root, [recipe]);
  await assert.rejects(patternRead('pattern:missing', 0, 100), { code: 'REFERENCE_NOT_FOUND' });
});

test('pattern search preserves every result within actual projectless MCP response budgets', async (t) => {
  const root = await fixture(t);
  const recipes = Array.from({ length: 19 }, (_, i) =>
    entry(`forms/recipe-${i}`, {
      title: 'Зразок "головний запис" 😀 '.repeat(6),
      searchText: '😀'.repeat(80) + ' keyword\n' + 'token=a\nУкраїна\\"\n'.repeat(50),
      source: 'https://example.test/' + 'x'.repeat(1800),
      requires: Array.from({ length: 40 }, (_, n) => 'component:' + 'x'.repeat(150) + n),
    }),
  );
  await catalog(root, recipes);
  const ids: string[] = [];
  let offset: number | null = 0;
  do {
    const result = await dispatch('docs.search', { query: 'keyword', corpus: 'patterns', offset, limit: 8 });
    assert.equal(result.ok, true);
    assert.ok(Buffer.byteLength(JSON.stringify(result), 'utf8') < 8192);
    const output = await toolOutput(result);
    assert.ok(Buffer.byteLength(output.content[0]!.text, 'utf8') < 8192);
    assert.ok(!output.content[0]!.text.includes('token=a'));
    const hits = JSON.parse(output.content[0]!.text).data;
    assert.ok(Array.isArray(hits) && hits.length > 0);
    for (const hit of hits) {
      assert.equal(hit.classification, 'pattern-reference-data');
      assert.equal(Buffer.from(hit.text, 'utf8').toString('utf8'), hit.text);
      ids.push(hit.id);
    }
    const next = hits[0].nextResultOffset;
    assert.ok(next === null || next > offset!);
    offset = next;
  } while (offset !== null);
  assert.equal(ids.length, recipes.length);
  assert.equal(new Set(ids).size, recipes.length);
});

test('pattern read recovers Unicode, redacted text and all cross-corpus dependency links', async (t) => {
  const root = await fixture(t);
  const recipe = entry('forms/master-detail', {
    requires: Array.from({ length: 140 }, (_, n) => 'component:forms/required-' + n),
    related: Array.from({ length: 120 }, (_, n) => 'oracle:related-' + n),
  });
  const raw = '😀\\"\nУкраїна\n'.repeat(1800) + '{"token": "illustrative-value"}\n';
  await catalog(root, [recipe], raw);
  const first = await patternRead(recipe.id, 0, 8192);
  assert.equal(first.requiresOmittedCount, 124);
  assert.equal(first.relatedOmittedCount, 104);
  assert.equal(first.sourceDocumentLength, raw.length);
  assert.equal(first.navigationOffset, redact(raw).length);
  const pieces: string[] = [];
  let offset: number | null = 0;
  do {
    const result = await dispatch('docs.read', { id: recipe.id, offset, limit: 8192 });
    assert.equal(result.ok, true);
    const output = await toolOutput(result);
    assert.ok(Buffer.byteLength(output.content[0]!.text, 'utf8') < 32768);
    const page = JSON.parse(output.content[0]!.text).data;
    assert.ok(page.content.length > 0);
    assert.equal(Buffer.from(page.content, 'utf8').toString('utf8'), page.content);
    pieces.push(page.content);
    assert.ok(page.nextOffset === null || page.nextOffset > offset!);
    offset = page.nextOffset;
  } while (offset !== null);
  const recovered = pieces.join('');
  assert.equal(recovered.length, first.length);
  assert.equal(recovered.slice(0, first.navigationOffset), redact(raw));
  for (const id of [...recipe.requires, ...recipe.related])
    assert.ok(recovered.slice(first.navigationOffset).includes(id));
  const tiny = await patternRead(recipe.id, 0, 1);
  assert.equal(tiny.content, '😀');
  assert.equal(tiny.nextOffset, 2);
});

test('patterns are an optional public corpus and work without project or connection configuration', async (t) => {
  const root = await fixture(t);
  await catalog(root, [entry('forms/master-detail')]);
  assert.equal(schemas['docs.search'].parse({ query: 'validate' }).corpus, 'apexlang');
  assert.equal(
    schemas['docs.search'].parse({ query: 'master detail', corpus: 'patterns' }).corpus,
    'patterns',
  );
  assert.equal((await dispatch('docs.search', { query: 'master detail', corpus: 'patterns' })).ok, true);
  assert.equal((await dispatch('docs.search', { query: 'master detail', corpus: 'other' })).exitCode, 2);
  assert.equal((await dispatch('docs.read', { id: 'pattern:forms/master-detail' })).ok, true);
  assert.equal(
    (await dispatch('docs.read', { id: 'pattern:missing' })).diagnostics[0]!.code,
    'REFERENCE_NOT_FOUND',
  );
});

test('pattern search prefers ready recipes, hides unresolved variants and resolves same-catalog links', async (t) => {
  const root = await fixture(t);
  const recipe = entry('dashboards/simple/recipes/basic', {
    title: 'Simple dashboard composition / Композиція простої панелі показників',
    searchText: 'Simple dashboard Проста панель показників dashboard дашборд',
    requires: ['pattern:dashboards/simple/parameters', 'component:template-components/metric-card'],
    related: ['pattern:dashboards/simple'],
  });
  await catalog(
    root,
    [
      recipe,
      entry('dashboards/simple', {
        kind: 'contract',
        title: 'Simple dashboard',
        searchText: 'Simple dashboard dashboard',
      }),
      entry('dashboards/simple/parameters', {
        kind: 'contract',
        readiness: 'reference',
        title: 'Simple dashboard parameters',
        searchText: 'Simple dashboard parameters pageItemsToSubmit',
      }),
      entry('master-detail/split-view/recipes/basic', {
        title: 'Split-view master detail',
        searchText: 'master detail split view',
        readiness: 'unresolved',
      }),
    ],
    '# Simple dashboard\n\n```apexlang\npage 1 (\n    name: Dashboard\n)\n```\n',
  );
  const hits = await patternSearch('simple dashboard', '26.1');
  assert.equal(hits[0]!.id, recipe.id);
  assert.match(hits[0]!.code!.text, /name: Dashboard/);
  assert.deepEqual(hits[0]!.requiresReferences, [
    { id: 'pattern:dashboards/simple/parameters', title: 'Simple dashboard parameters', kind: 'contract' },
    { id: 'component:template-components/metric-card', title: null, kind: null },
  ]);
  assert.equal(
    (await patternSearch('pageItemsToSubmit', '26.1'))[0]!.id,
    'pattern:dashboards/simple/parameters',
  );
  // "дашборд" inflections and the dashboard alias both reach the recipe.
  assert.equal((await patternSearch('панель показників', '26.1'))[0]!.id, recipe.id);
  assert.deepEqual(await patternSearch('master detail', '26.1'), []);
  assert.equal(
    (await patternSearch('master detail', '26.1', { includeUnresolved: true }))[0]!.readiness,
    'unresolved',
  );
});
