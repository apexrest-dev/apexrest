import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fixture } from '../fixtures/project.ts';
import { writeJson } from '../../packages/core/src/fs.ts';
import { referenceSelect } from '../../packages/core/src/reference-selection.ts';
import { referenceRead } from '../../packages/core/src/references.ts';
import {
  qualifiedRecipes262,
  recipeFor262,
  resetRecipes262,
  RECIPE_TEXT_LIMIT,
} from '../../packages/core/src/reference-recipes262.ts';

const unavailable: typeof fetch = async () => {
  throw new Error('Network must not be used');
};
async function resources(t: TestContext, root = path.resolve('resources')) {
  const before = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = root;
  resetRecipes262();
  t.after(() => {
    if (before === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = before;
    resetRecipes262();
  });
}
async function project(t: TestContext, profile: '26.1' | '26.2') {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  ctx.config.toolchain.profile = profile;
  await writeJson(path.join(ctx.root, 'apexrest.json'), ctx.config);
  return ctx;
}

test('only ready, compiler-passed 26.2 recipes with current bytes are qualified', async (t) => {
  await resources(t);
  const recipes = await qualifiedRecipes262();
  assert.deepEqual(recipes.map((recipe) => recipe.regionType).sort(), [
    'cards',
    'chart',
    'classicReport',
    'interactiveReport',
    'staticContent',
    'staticContent',
  ]);
  for (const recipe of recipes) {
    assert.match(recipe.sha256, /^[a-f0-9]{64}$/);
    assert.equal(recipe.qualification.mmdVersion.startsWith('26.2.'), true);
    assert.equal(recipe.qualification.import, 'not-run');
    assert.equal(recipe.qualification.browser, 'not-run');
  }
  // A request naming the alert template gets the alert recipe; a plain one the content block.
  assert.match(String((await recipeFor262('region', 'staticContent', 'an alert message'))?.id), /alert/u);
  assert.equal(await recipeFor262('pageItem', 'textField', 'x'), undefined);

  // Changed recipe bytes or a changed scaffold no longer match the compiler run: not offered.
  const copy = await mkdtemp(path.join(tmpdir(), 'apexrest-recipes262-'));
  t.after(() => rm(copy, { recursive: true, force: true }));
  await cp(path.resolve('resources/components-26.2'), path.join(copy, 'components-26.2'), {
    recursive: true,
  });
  await writeFile(
    path.join(copy, 'components-26.2/recipes/regions-cards-badges/pages/p00001-home.apx'),
    'page 1 (\n    name: Changed\n)\n',
  );
  await resources(t, copy);
  assert.equal(
    (await qualifiedRecipes262()).some((recipe) => recipe.regionType === 'cards'),
    false,
  );
  await writeFile(path.join(copy, 'components-26.2/recipes/_scaffold/application.apx'), 'app X (\n)\n');
  resetRecipes262();
  assert.deepEqual(await qualifiedRecipes262(), []);
});

test('a 26.2 selection returns the qualified recipe whole, with identity, digest and dependencies', async (t) => {
  await resources(t);
  const ctx = await project(t, '26.2');
  const result = await referenceSelect(
    { project: ctx.root, request: 'cards region with badges', limit: 6 },
    undefined,
    unavailable,
  );
  const withRecipe = result.results.find(
    (entry) => (entry as { example?: { qualifiedRecipe?: unknown } }).example?.qualifiedRecipe,
  ) as
    | {
        example: {
          id: string;
          text: string;
          qualifiedRecipe: { sha256: string; requires: string[]; qualification: { compiler: string } };
        };
      }
    | undefined;
  assert.ok(withRecipe, 'a selected component carries its qualified recipe');
  assert.match(withRecipe.example.id, /^component:regions\/cards\/recipes\//u);
  assert.match(withRecipe.example.text, /^ {4}region badges-cards \(\n[\s\S]*\n {4}\)$/u);
  assert.ok(withRecipe.example.text.length <= RECIPE_TEXT_LIMIT);
  assert.equal(withRecipe.example.qualifiedRecipe.qualification.compiler, 'passed');
  assert.ok(Array.isArray(withRecipe.example.qualifiedRecipe.requires));
  // The complete page it compiled in is readable by id.
  const page = (await referenceRead(withRecipe.example.id, 0, 100000, ctx.root)) as {
    sha256?: string;
    content: string;
  };
  assert.equal(page.sha256, withRecipe.example.qualifiedRecipe.sha256);
  assert.match(String(page.content), /^page 1 \(/u);
});

test('26.1 selections keep their release-specific results and never get 26.2 recipes', async (t) => {
  await resources(t);
  const ctx = await project(t, '26.1');
  const result = await referenceSelect(
    { project: ctx.root, request: 'cards region with badges', limit: 6 },
    undefined,
    unavailable,
  );
  assert.ok(result.results.length);
  assert.ok(result.results.every((entry) => String(entry.version).startsWith('26.1')));
  assert.ok(!JSON.stringify(result).includes('components-26.2'));
  assert.ok(!JSON.stringify(result).includes('regions-cards-badges'));
  await assert.rejects(
    referenceRead('component:regions/cards/recipes/regions-cards-badges', 0, 10, ctx.root),
    {
      code: 'REFERENCE_NOT_FOUND',
    },
  );
});
