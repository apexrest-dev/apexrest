import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildComponentCatalog,
  validateComponentRecipeProvenance,
} from '../../scripts/build-component-catalog.mjs';

const provenance = {
  repository: 'https://github.com/oracle/apex',
  commit: 'a'.repeat(40),
  path: 'samples/26.1/cards/pages/p00001-home.apx',
  sourceSha256: 'b'.repeat(64),
  license: 'UPL-1.0',
  derivation: 'original-adaptation',
};
provenance.sourceUrl = `${provenance.repository}/blob/${provenance.commit}/${provenance.path}`;
const externalRecipe = () => ({
  id: 'component:regions/cards/recipes/public-example',
  sourcePageIds: [],
  provenance: structuredClone(provenance),
});

test('external recipes require complete public provenance without captured UT page claims', () => {
  assert.doesNotThrow(() => validateComponentRecipeProvenance(externalRecipe()));
  assert.doesNotThrow(() =>
    validateComponentRecipeProvenance({ id: 'component:existing', sourcePageIds: [1201] }),
  );
  assert.throws(
    () => validateComponentRecipeProvenance({ id: 'component:external', sourcePageIds: [] }),
    /requires public provenance/,
  );
  for (const key of Object.keys(provenance)) {
    const recipe = externalRecipe();
    delete recipe.provenance[key];
    assert.throws(() => validateComponentRecipeProvenance(recipe), /Incomplete/, key);
  }
  for (const sourcePageIds of [undefined, [1201], '1201'])
    assert.throws(
      () => validateComponentRecipeProvenance({ ...externalRecipe(), sourcePageIds }),
      /empty sourcePageIds/,
    );
  for (const value of [null, [], 'https://github.com/oracle/apex'])
    assert.throws(
      () => validateComponentRecipeProvenance({ ...externalRecipe(), provenance: value }),
      /External recipe provenance/,
    );
});

test('MIT source adaptations require their declared license notice', () => {
  const recipe = externalRecipe();
  recipe.provenance.license = 'MIT';
  assert.throws(() => validateComponentRecipeProvenance(recipe), /complete LICENSE.txt notice/);
  recipe.files = ['pages/p00001-home.apx', 'LICENSE.txt'];
  assert.doesNotThrow(() => validateComponentRecipeProvenance(recipe));
});

test('source provenance rejects unsafe paths, unpinned URLs and unsupported redistribution claims', () => {
  const mutations = [
    ['repository', 'http://github.com/oracle/apex'],
    ['repository', 'https://user:password@github.com/oracle/apex'],
    ['repository', 'https://github.com/oracle/apex?query=1'],
    ['repository', 'https://github.com/oracle/apex/'],
    ['repository', 'https://localhost/oracle/apex'],
    ['commit', '26.1'],
    ['commit', 'a'.repeat(39)],
    ['sourceSha256', 'b'.repeat(63)],
    ['path', '/absolute.apx'],
    ['path', '../other.apx'],
    ['path', 'pages/../other.apx'],
    ['path', 'pages//other.apx'],
    ['path', 'pages\\other.apx'],
    ['path', 'pages/%2e%2e/other.apx'],
    ['path', 'pages/other.apx?token=value'],
    ['sourceUrl', 'https://github.com/oracle/apex/blob/26.1/pages/other.apx'],
    ['sourceUrl', provenance.sourceUrl + '?raw=1'],
    ['sourceUrl', provenance.sourceUrl.replace('/oracle/', '/another/')],
    ['license', 'unverified'],
    ['license', 'MIT'],
    ['derivation', 'verbatim-copy'],
    ['extra', 'unsupported'],
  ];
  for (const [key, value] of mutations) {
    const recipe = externalRecipe();
    recipe.provenance[key] = value;
    assert.throws(() => validateComponentRecipeProvenance(recipe), undefined, `${key}: ${value}`);
  }
});

test('catalog retains legacy attribution and binds external recipe records to their pinned source', async (t) => {
  const source = path.resolve('resources/components');
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-component-provenance-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const read = async (file) => JSON.parse(await readFile(path.join(source, file), 'utf8'));
  const registry = await read('recipes/registry.json');
  const recipe = registry.recipes.find((entry) => entry.id === 'component:regions/standard/recipes/basic');
  assert.ok(recipe);
  registry.recipes = [recipe];
  const evidence = await read('recipes/compiler-evidence.json');
  evidence.runs = evidence.runs.filter((run) => run.recipeId === recipe.id);
  await mkdir(path.join(root, 'recipes'), { recursive: true });
  await cp(path.join(source, 'source'), path.join(root, 'source'), { recursive: true });
  await cp(path.join(source, registry.scaffold.directory), path.join(root, registry.scaffold.directory), {
    recursive: true,
  });
  await cp(path.join(source, recipe.directory), path.join(root, recipe.directory), { recursive: true });
  await writeFile(path.join(root, 'recipes/compiler-evidence.json'), JSON.stringify(evidence));
  const saveRegistry = () => writeFile(path.join(root, 'recipes/registry.json'), JSON.stringify(registry));
  await saveRegistry();
  await buildComponentCatalog(root);
  const document = `documents/${recipe.id.slice('component:'.length)}.md`;
  assert.equal(
    await readFile(path.join(root, document), 'utf8'),
    await readFile(path.join(source, document), 'utf8'),
  );
  const legacy = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8')).find(
    (entry) => entry.id === recipe.id,
  );
  assert.equal(legacy.source, (await read('source/snapshot.json')).source.officialUrl);

  recipe.sourcePageIds = [];
  recipe.provenance = structuredClone(provenance);
  // A separate, unverified source override must not replace the checked provenance URL.
  recipe.source = 'https://example.invalid/unverified';
  await saveRegistry();
  await buildComponentCatalog(root);
  const entry = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8')).find(
    (item) => item.id === recipe.id,
  );
  assert.equal(entry.source, provenance.sourceUrl);
  assert.equal(entry.readiness, 'ready');
  const text = await readFile(path.join(root, document), 'utf8');
  assert.match(text, /## Source attribution/);
  assert.ok(text.includes(provenance.sourceUrl));
  assert.ok(text.includes(provenance.sourceSha256));
  assert.match(text, /separate from the captured Universal Theme reference application/);
  assert.doesNotMatch(text, /Source pages:/);

  const notice = await readFile(
    path.join(source, 'recipes/internet-report-template-directives/LICENSE.txt'),
    'utf8',
  );
  assert.match(notice, /Permission is hereby granted/);
  assert.match(notice, /THE SOFTWARE IS PROVIDED "AS IS"/);
  recipe.provenance.license = 'MIT';
  recipe.files.push('LICENSE.txt');
  recipe.readiness = 'unresolved';
  recipe.reason = 'This fixture checks license publication, not compiler qualification.';
  await writeFile(path.join(root, recipe.directory, 'LICENSE.txt'), notice);
  await saveRegistry();
  await buildComponentCatalog(root);
  const licensedText = await readFile(path.join(root, document), 'utf8');
  assert.ok(licensedText.includes(notice), 'The complete MIT notice is retained in the recipe document.');
  assert.match(licensedText, /"license": "MIT"/);
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  assert.match(manifest.files[recipe.directory + '/LICENSE.txt'], /^[a-f0-9]{64}$/);

  delete recipe.provenance;
  await saveRegistry();
  await assert.rejects(buildComponentCatalog(root), /requires public provenance/);
});
