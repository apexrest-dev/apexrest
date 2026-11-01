import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  assertPinnedCompilerVersion,
  reusableCompilerRun,
} from '../../scripts/component-recipe-verification.mjs';

const root = path.resolve('resources/components');
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const sorted = (value: Record<string, string>) =>
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')));
async function files(directory: string, prefix = ''): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    assert.equal(entry.isSymbolicLink(), false, `unexpected symlink ${entry.name}`);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) output.push(...(await files(directory, relative)));
    else output.push(relative);
  }
  return output.sort();
}
async function load() {
  return {
    registry: JSON.parse(await readFile(path.join(root, 'recipes/registry.json'), 'utf8')),
    evidence: JSON.parse(await readFile(path.join(root, 'recipes/compiler-evidence.json'), 'utf8')),
  };
}

test('every ready component recipe is bound to real, warning-free compiler evidence and its complete current inputs', async () => {
  const { registry, evidence } = await load();
  assert.equal(evidence.mock, false);
  assert.equal(evidence.mmdVersion, registry.mmdVersion);
  assert.equal(registry.compilerVersion, 'SQLcl: Release 26.3.0.0 Production Build: 26.3.0.260.1620');
  assert.equal(evidence.compiler, registry.compilerVersion);
  const scaffold: Record<string, string> = {};
  for (const file of await files(path.join(root, registry.scaffold.directory)))
    scaffold[file] = sha(await readFile(path.join(root, registry.scaffold.directory, file)));
  assert.deepEqual(evidence.scaffoldFiles, sorted(scaffold));
  assert.equal(evidence.scaffoldSha256, sha(JSON.stringify(sorted(scaffold))));
  const ids = new Set<string>();
  for (const recipe of registry.recipes) {
    assert.equal(ids.has(recipe.id), false, recipe.id);
    ids.add(recipe.id);
    if (recipe.provenance) {
      assert.deepEqual(recipe.sourcePageIds, [], `${recipe.id}: external sources are not captured UT pages`);
      assert.match(recipe.provenance.sourceSha256, /^[a-f0-9]{64}$/);
    } else assert.ok(recipe.sourcePageIds.length, recipe.id);
    for (const kind of ['sql', 'import', 'browser'])
      assert.equal(recipe.verification[kind], 'not-run', `${recipe.id}: compiler cannot assert ${kind}`);
    if (recipe.readiness !== 'ready') {
      assert.ok(recipe.reason?.length > 20, `${recipe.id}: unresolved needs a concrete reason`);
      continue;
    }
    assert.equal(recipe.verification.compiler.status, 'passed', recipe.id);
    const run = evidence.runs.find((entry: any) => entry.recipeId === recipe.id);
    assert.ok(run, recipe.id);
    assert.equal(run.passed, true, recipe.id);
    assert.equal(run.exitCode, 0, recipe.id);
    assert.equal(run.inputUnchanged, true, recipe.id);
    assert.match(run.output, /Validation successful/);
    assert.doesNotMatch(run.output, /\b(?:Warning|Error):|ORA-\d{5}/i);
    const current = { ...scaffold };
    const directory = path.join(root, recipe.directory);
    assert.deepEqual(
      await files(directory),
      [...recipe.files].sort(),
      `${recipe.id}: all shipped overlay files must be declared`,
    );
    for (const file of recipe.files) {
      assert.equal(path.isAbsolute(file), false);
      assert.equal(file.split('/').includes('..'), false);
      current[file] = sha(await readFile(path.join(directory, file)));
    }
    assert.deepEqual(run.inputFiles, sorted(current), recipe.id);
    const digest = sha(JSON.stringify(sorted(current)));
    assert.equal(run.sourceSha256, digest, recipe.id);
    assert.equal(recipe.verification.compiler.sourceSha256, digest, recipe.id);
    assert.equal(
      reusableCompilerRun({
        recipe,
        evidence,
        run,
        inputFiles: current,
        scaffoldFiles: scaffold,
        scaffoldSha256: evidence.scaffoldSha256,
        compilerVersion: registry.compilerVersion,
        mmdVersion: registry.mmdVersion,
      }),
      true,
      recipe.id,
    );
  }
});

test('changed-only compilation rejects stale, malformed or warning-bearing cached evidence', async () => {
  const { registry, evidence } = await load();
  const recipe = registry.recipes.find((entry: any) => entry.readiness === 'ready');
  const run = evidence.runs.find((entry: any) => entry.recipeId === recipe.id);
  const valid = {
    recipe,
    evidence,
    run,
    inputFiles: run.inputFiles,
    scaffoldFiles: evidence.scaffoldFiles,
    scaffoldSha256: evidence.scaffoldSha256,
    compilerVersion: registry.compilerVersion,
    mmdVersion: registry.mmdVersion,
  };
  assert.doesNotThrow(() => assertPinnedCompilerVersion(registry.compilerVersion, evidence.compiler));
  assert.throws(
    () => assertPinnedCompilerVersion(registry.compilerVersion, evidence.compiler + '-different-build'),
    /version mismatch/,
  );
  assert.throws(() => assertPinnedCompilerVersion(undefined, evidence.compiler), /missing pin/);
  assert.equal(reusableCompilerRun(valid), true);
  const changes: Array<[string, (entry: any) => void]> = [
    [
      'different scaffold digest',
      (entry) => {
        entry.evidence.scaffoldSha256 = 'stale';
      },
    ],
    [
      'different scaffold inputs',
      (entry) => {
        entry.evidence.scaffoldFiles = {};
      },
    ],
    [
      'missing run inputs',
      (entry) => {
        entry.run.inputFiles = null;
      },
    ],
    [
      'different run inputs with unchanged digest claim',
      (entry) => {
        entry.run.inputFiles = { 'changed.apx': 'stale' };
      },
    ],
    [
      'changed compiler inputs',
      (entry) => {
        entry.run.inputUnchanged = false;
      },
    ],
    [
      'missing unchanged assertion',
      (entry) => {
        delete entry.run.inputUnchanged;
      },
    ],
    [
      'nonzero exit',
      (entry) => {
        entry.run.exitCode = 1;
      },
    ],
    [
      'missing exit',
      (entry) => {
        delete entry.run.exitCode;
      },
    ],
    [
      'compiler warning',
      (entry) => {
        entry.run.output += '\nWarning: ignored property';
      },
    ],
    [
      'compiler error',
      (entry) => {
        entry.run.output += '\nError: failed';
      },
    ],
    [
      'missing success',
      (entry) => {
        entry.run.output = '';
      },
    ],
    [
      'wrong compiler build',
      (entry) => {
        entry.evidence.compiler = 'SQLcl: wrong';
      },
    ],
    [
      'wrong MMD',
      (entry) => {
        entry.evidence.mmdVersion = 'different';
      },
    ],
    [
      'mock evidence',
      (entry) => {
        entry.evidence.mock = true;
      },
    ],
    [
      'stale registry digest',
      (entry) => {
        entry.recipe.verification.compiler.sourceSha256 = 'stale';
      },
    ],
  ];
  for (const [label, change] of changes) {
    const candidate = structuredClone(valid);
    // Current inputs are independent of the historical evidence being corrupted.
    candidate.inputFiles = structuredClone(valid.inputFiles);
    candidate.scaffoldFiles = structuredClone(valid.scaffoldFiles);
    change(candidate);
    assert.equal(reusableCompilerRun(candidate), false, label);
  }
});

test('catalog covers distinct native hosts, all 27 source-app item types and three official-source item types without demonstration dependencies', async () => {
  const { registry } = await load();
  const ready = registry.recipes.filter((recipe: any) => recipe.readiness === 'ready');
  const items = new Set(
    ready.filter((recipe: any) => recipe.family === 'items').map((recipe: any) => recipe.componentId),
  );
  assert.equal(items.size, 30);
  for (const item of ['rich-text-editor', 'geocoded-address', 'display-image'])
    assert.ok(items.has(`component:items/${item}`), item);
  for (const component of [
    'regions/standard',
    'reports/interactive-report',
    'reports/interactive-grid',
    'regions/cards',
    'template-components/metric-card',
    'template-components/media-list',
    'template-components/comments',
    'lists/media-list',
    'reports/comments',
    'reports/legacy-cards',
    'regions/smart-filters',
    'regions/region-display-selector',
    'regions/form',
  ])
    assert.ok(
      ready.some((recipe: any) => recipe.componentId === `component:${component}`),
      component,
    );
  for (const recipe of ready) {
    for (const file of recipe.files) {
      if (!file.endsWith('.apx')) continue;
      const text = await readFile(path.join(root, recipe.directory, file), 'utf8');
      assert.doesNotMatch(
        text,
        /EBA_UT_|plugin\/(?:componentInstructions|previewTemplateOptions|regionSourceCode)|PrismJS|dm-TemplateOption|apex-app|WKSP_APEXAPP|connect\s+\w+\//i,
        recipe.id,
      );
      assert.doesNotMatch(text, /\{\{[^}]+\}\}/, `${recipe.id}: no unbound template variables`);
    }
  }
});

test('editable recipes declare their complete optional schema prerequisite without claiming its execution', async () => {
  const { registry } = await load();
  for (const component of ['reports/interactive-grid', 'regions/form']) {
    const editable = registry.recipes.find(
      (recipe: any) => recipe.componentId === `component:${component}` && recipe.dataContract.writes === true,
    );
    assert.ok(editable, component);
    assert.equal(editable.readiness, 'ready');
    assert.deepEqual(editable.dataContract.tables, ['APEXREST_EXAMPLE_ROWS']);
    assert.match(editable.dataContract.optimisticLock, /ROW_VERSION/);
    assert.equal(editable.verification.sql, 'not-run');
    const prerequisite = editable.dataContract.prerequisites[0];
    assert.ok(editable.files.includes(prerequisite.path));
    assert.match(prerequisite.execution, /Not executed/);
    const fixture = await readFile(path.join(root, editable.directory, prerequisite.path), 'utf8');
    assert.match(fixture, /create table APEXREST_EXAMPLE_ROWS/);
    assert.match(fixture, /generated by default on null as identity/);
    assert.match(fixture, /:new\.ROW_VERSION := :old\.ROW_VERSION \+ 1/);
  }
});
