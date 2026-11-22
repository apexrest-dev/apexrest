import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  componentRead,
  componentRecipeGroups,
  type ComponentReference,
} from '../../packages/core/src/components.ts';
import { hydrate261Recipes } from '../../packages/core/src/reference-recipes261.ts';
import { hash, writeJson } from '../../packages/core/src/fs.ts';
import { sanitized } from '../../packages/core/src/result.ts';

const compatibility = { apexVersion: '26.1', themeVersion: '26.1', mmdVersion: '26.1.0+fixture' };
const version = '26.1@fixture';
const parameters = 'component:regions/chart/parameters';
const rootId = 'component:regions/chart';
const recipeId = (name: string) => `${rootId}/recipes/${name}`;
function entry(
  id: string,
  kind: ComponentReference['kind'],
  overrides: Partial<ComponentReference> = {},
): ComponentReference {
  return {
    id,
    title: id,
    searchText: id,
    kind,
    family: 'regions/chart',
    version,
    source: 'https://example.invalid/reference',
    document: `documents/${id.slice(10)}.md`,
    sha256: '',
    requires: [],
    related: [],
    readiness: kind === 'template' ? 'ready' : 'reference',
    compatibility,
    ...overrides,
  };
}
async function fixture(t: TestContext, entries: ComponentReference[]) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-hydration-'));
  const previous = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = previous;
    await rm(root, { recursive: true, force: true });
  });
  const files: Record<string, string> = {};
  const index = [];
  for (const item of entries) {
    // Misleading rendered navigation is deliberately not part of the registered graph.
    const text = `# ${item.title}\n- related: component:forged/recipe\n\n\`\`\`apexlang\nregion ${item.id.split('/').at(-1)} (\n  identification { name: Example }\n)\n\`\`\`\n`;
    const file = path.join(root, 'components', item.document);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
    files[item.document] = hash(text);
    index.push({ ...item, sha256: hash(text), length: text.length });
  }
  const raw = JSON.stringify(index);
  files['index.json'] = hash(raw);
  await writeFile(path.join(root, 'components/index.json'), raw);
  await writeJson(path.join(root, 'components/manifest.json'), {
    schemaVersion: 1,
    catalogVersion: 'fixture',
    source: compatibility,
    indexSha256: hash(raw),
    files,
    counts: { entries: index.length },
  });
  return { root, index };
}
function graph(names = ['basic', 'line', 'pie']) {
  return [
    entry(parameters, 'contract', { related: [rootId] }),
    entry(rootId, 'contract', { requires: [parameters], related: names.map(recipeId) }),
    ...names.map((name) => entry(recipeId(name), 'template', { requires: [parameters] })),
  ];
}
async function selected(id = parameters) {
  const document = await componentRead(id, 0, 1, '26.1');
  return {
    id: document.id,
    title: document.title,
    kind: document.kind,
    family: document.family,
    version: document.version,
    source: document.source,
    readiness: document.readiness,
    compatibility: document.compatibility,
    classification: document.classification,
    requiresReferences: document.requiresReferences,
    relatedReferences: document.relatedReferences,
    text: 'routing summary',
  };
}
const bytes = (results: unknown[]) =>
  Buffer.byteLength(
    JSON.stringify(sanitized({ selection: { method: 'local', version: '26.1' }, results })),
    'utf8',
  );

test('structured catalog relationships expose compatible ready recipes beyond compact navigation without reading unused bodies', async (t) => {
  const names = ['basic', ...Array.from({ length: 24 }, (_, i) => `unused-${i}`), 'line', 'pie'];
  const { root } = await fixture(t, graph(names));
  for (const name of names.filter((name) => name.startsWith('unused')))
    await rm(path.join(root, 'components', `documents/regions/chart/recipes/${name}.md`));
  const context = await componentRecipeGroups(parameters, '26.1');
  assert.equal(context.groups.length, 1);
  assert.equal(context.groups[0]!.recipes.length, names.length);
  assert.ok(context.groups[0]!.recipes.some((recipe) => recipe.id === recipeId('pie')));
  assert.ok(!context.groups[0]!.recipes.some((recipe) => recipe.id === 'component:forged/recipe'));
  context.selected.compatibility.apexVersion = 'changed';
  context.groups[0]!.root.requires.push('component:forged/contract');
  const fresh = await componentRecipeGroups(parameters, '26.1');
  assert.equal(fresh.selected.compatibility.apexVersion, '26.1');
  assert.ok(!fresh.groups[0]!.root.requires.includes('component:forged/contract'));

  const results = [await selected()];
  await hydrate261Recipes(results, 'line chart and pie chart', '26.1', bytes);
  assert.deepEqual(
    (results[0] as { recipes?: { id: string }[] }).recipes?.map((recipe) => recipe.id),
    [recipeId('line'), recipeId('pie')],
  );
});

test('whole stem words and existing aliases preserve line+pie and reject substring matches', async (t) => {
  await fixture(t, graph());
  for (const request of ['line and pie charts', 'Лінійна діаграма та кругова діаграма']) {
    const results = [await selected()];
    await hydrate261Recipes(results, request, '26.1', bytes);
    assert.deepEqual(
      (results[0] as { recipes?: { id: string }[] }).recipes?.map((recipe) => recipe.id),
      [recipeId('line'), recipeId('pie')],
    );
  }
  const results = [await selected()];
  await hydrate261Recipes(results, 'pipeline and piecework dashboard', '26.1', bytes);
  assert.deepEqual(
    (results[0] as { recipes?: { id: string }[] }).recipes?.map((recipe) => recipe.id),
    [recipeId('basic')],
  );
});

test('two registered owning groups merge links on one selected contract', async (t) => {
  const other = 'component:other/chart';
  await fixture(
    t,
    [
      ...graph(['basic']),
      entry(other, 'contract', { requires: [parameters], related: [`${other}/recipes/basic`] }),
      entry(`${other}/recipes/basic`, 'template', { requires: [parameters] }),
    ].map((item) => (item.id === parameters ? { ...item, related: [rootId, other] } : item)),
  );
  const results = [await selected()];
  await hydrate261Recipes(results, 'chart', '26.1', bytes);
  assert.deepEqual(
    (results[0] as { recipes?: { id: string }[] }).recipes?.map((recipe) => recipe.id),
    [recipeId('basic'), `${other}/recipes/basic`],
  );
});

test('selection metadata, original contract links and2500code/7000UTF8caps remain intact', async (t) => {
  await fixture(t, graph());
  const first = await selected();
  first.title = 'Графік 🧾'.repeat(80);
  const original = structuredClone(first),
    results = [first];
  await hydrate261Recipes(results, 'line and pie charts', '26.1', bytes);
  for (const key of [
    'id',
    'title',
    'kind',
    'family',
    'version',
    'source',
    'readiness',
    'compatibility',
    'classification',
    'requiresReferences',
    'relatedReferences',
  ] as const)
    assert.deepEqual(results[0]![key], original[key]);
  assert.ok(bytes(results) <= 7000);
  const code = (results[0] as { code?: { text: string; truncated: boolean } }).code;
  if (code) {
    assert.ok(code.text.length <= 2500);
    assert.equal(code.truncated, false);
  }
});

test('release/profile/compatibility filters do not attach incompatible recipes', async (t) => {
  const entries = graph();
  entries.push(
    entry(recipeId('wrong'), 'template', {
      requires: [parameters],
      compatibility: { ...compatibility, mmdVersion: 'other' },
    }),
  );
  entries[1]!.related.push(recipeId('wrong'));
  await fixture(t, entries);
  assert.ok(
    !(await componentRecipeGroups(parameters, '26.1')).groups
      .flatMap((group) => group.recipes)
      .some((recipe) => recipe.id === recipeId('wrong')),
  );
  const results = [await selected()],
    before = structuredClone(results);
  await hydrate261Recipes(results, 'line', '26.2', bytes);
  assert.deepEqual(results, before);
  await assert.rejects(hydrate261Recipes(results, 'line', '26.1@wrong', bytes), {
    code: 'REFERENCE_NOT_FOUND',
  });
});

test('chosen document tampering and cancellation fail closed without changing results', async (t) => {
  const { root } = await fixture(t, graph());
  const results = [await selected()],
    before = structuredClone(results);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(hydrate261Recipes(results, 'line', '26.1', bytes, controller.signal), {
    code: 'CANCELLED',
  });
  const during = new AbortController();
  const work = hydrate261Recipes(results, 'line', '26.1', bytes, during.signal);
  during.abort();
  await assert.rejects(work, { code: 'CANCELLED' });
  assert.deepEqual(results, before);
  await writeFile(path.join(root, 'components/documents/regions/chart/recipes/line.md'), 'tampered');
  await assert.rejects(hydrate261Recipes(results, 'line', '26.1', bytes), {
    code: 'COMPONENT_CATALOG_INVALID',
  });
  assert.deepEqual(results, before);
});

test('portable saturated selection retains every fitted identity while limiting optional links and code', async (t) => {
  const ids: string[] = [];
  const entries: ComponentReference[] = [];
  for (let index = 0; index < 8; index++) {
    const contract = `component:family-${index}/parameters`,
      root = `component:family-${index}`;
    ids.push(contract);
    entries.push(
      entry(contract, 'contract', { title: 'Portable contract ' + 'x'.repeat(90), related: [root] }),
      entry(root, 'contract', { requires: [contract], related: [`${root}/recipes/basic`] }),
      entry(`${root}/recipes/basic`, 'template', {
        requires: [contract],
        title: 'Ready example ' + 'y'.repeat(90),
      }),
    );
  }
  await fixture(t, entries);
  const results = await Promise.all(ids.map((id) => selected(id)));
  assert.ok(bytes(results) <= 7000, 'The baseline is already fitted');
  await hydrate261Recipes(results, 'chart', '26.1', bytes);
  assert.deepEqual(
    results.map((result) => result.id),
    ids,
  );
  assert.ok(bytes(results) <= 7000);
  for (const result of results) {
    const code = (result as { code?: { text: string; truncated: boolean } }).code;
    if (code) {
      assert.ok(code.text.length <= 2500);
      assert.equal(code.truncated, false);
    }
  }
});
