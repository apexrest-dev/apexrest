import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { buildComponentCatalog } from '../../scripts/build-component-catalog.mjs';
import { files, sha256 } from '../../scripts/lib/release.mjs';

const catalog = path.resolve('resources/components');
const readJson = async (root, file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const sortedObject = (value) =>
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')));
async function temporary(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-component-package-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('component source inventory accounts for every source object, option and attribute', async () => {
  const snapshot = await readJson(catalog, 'source/snapshot.json');
  const inventory = await readJson(catalog, 'source/inventory.json');
  const parameters = await readJson(catalog, 'source/parameters.json');
  const components = await readJson(catalog, 'source/component-list.json');
  const manifest = await readJson(catalog, 'manifest.json');
  assert.deepEqual((await files(path.join(catalog, 'source'))).sort(), [
    'component-list.json',
    'inventory.json',
    'parameters.json',
    'snapshot.json',
  ]);
  const expected = {
    pages: 122,
    regions: 987,
    componentListEntries: 46,
    itemTypes: 27,
    templateOptions: 539,
    templateOptionsWithHelp: 245,
    utAttributes: 164,
    utAttributesWithHelp: 137,
  };
  for (const [key, previous] of Object.entries(expected)) {
    assert.ok(Number.isInteger(snapshot.counts[key]) && snapshot.counts[key] > 0, key);
    assert.equal(manifest.counts[key], snapshot.counts[key], key);
    if (snapshot.counts[key] !== previous)
      assert.ok(
        snapshot.baselineDiff.some(
          (change) =>
            change.metric === key && change.previous === previous && change.current === snapshot.counts[key],
        ),
        `Unexplained source drift: ${key}`,
      );
  }
  assert.equal(snapshot.source.applicationId, 100);
  for (const kind of ['pages', 'regions', 'items', 'buttons', 'lists']) {
    assert.equal(inventory[kind].length, snapshot.counts[kind], kind);
    assert.equal(new Set(inventory[kind].map((row) => row.id)).size, inventory[kind].length, kind);
    assert.ok(
      inventory[kind].every((row) =>
        ['example', 'documentation', 'scaffolding', 'historical'].includes(row.classification),
      ),
      `Missing classification in ${kind}`,
    );
  }
  assert.equal(inventory.listEntries.length, snapshot.counts.listEntries);
  const registry = await readJson(catalog, 'recipes/registry.json');
  const families = new Set(registry.recipes.map((recipe) => recipe.componentId));
  for (const family of components.families)
    assert.ok(families.has(family.id), `Unaccounted source family: ${family.id}`);
  assert.equal(components.entries.length, snapshot.counts.componentListEntries);
  assert.equal(parameters.templateOptions.length, snapshot.counts.templateOptions);
  assert.equal(parameters.utAttributes.length, snapshot.counts.utAttributes);
  assert.ok(parameters.utAttributes.every((attribute) => attribute.apexlangPath && attribute.context));
  const objects = new Map(
    [...inventory.regions, ...inventory.items, ...inventory.buttons].map((row) => [row.id, row]),
  );
  for (const link of inventory.helperLinks) {
    assert.ok(objects.has(link.sourceId));
    if (link.status === 'resolved') {
      assert.ok(objects.has(link.targetId), link.sourceId);
      assert.equal(objects.get(link.targetId).pageId, link.pageId, link.sourceId);
      assert.notEqual(link.targetId, link.sourceId);
    } else assert.ok(link.reason, link.sourceId);
  }
});

test('catalog exact manifest membership, hashes and publication boundary survive both distribution layouts', async () => {
  const expectedManifest = await readFile(path.join(catalog, 'manifest.json'), 'utf8');
  for (const root of [
    catalog,
    path.resolve('dist/resources/components'),
    path.resolve('dist/codex-compat/plugins/apexrest-apex/resources/components'),
  ]) {
    assert.equal(await readFile(path.join(root, 'manifest.json'), 'utf8'), expectedManifest);
    const manifest = await readJson(root, 'manifest.json');
    const inventory = await files(root);
    assert.deepEqual(
      inventory.slice().sort(),
      [...Object.keys(manifest.files), 'manifest.json'].sort(),
      `Unregistered or missing file in ${root}`,
    );
    for (const [file, digest] of Object.entries(manifest.files)) {
      assert.equal(sha256(await readFile(path.join(root, file))), digest, `${root}/${file}`);
      assert.ok(
        !/(?:^|\/)(?:f100|application-100)(?:\.|\/)|(?:^|\/)(?:private|exports?|node_modules)(?:\.|\/)|\.(?:jar|zip|html?|sqlcl|wallet)$/i.test(
          file,
        ),
        `Raw or private artifact: ${file}`,
      );
      assert.ok(
        /^(?:source\/[^/]+\.json|recipes\/.+\.(?:apx|json|sql|svg)|recipes\/[^/]+\/LICENSE\.txt|documents\/.+\.md|index\.json)$/.test(
          file,
        ),
        `Unsupported catalog publication path: ${file}`,
      );
      const text = await readFile(path.join(root, file), 'utf8');
      assert.ok(
        !/\/Users\/|\/private\/var\/folders\/|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|wwv_flow_imp\.(?:import_begin|create_flow)|oraclecloudapps\.com|BEGIN APEX APPLICATION EXPORT/i.test(
          text,
        ),
        `Private source or complete export: ${file}`,
      );
    }
    assert.equal(manifest.files['index.json'], manifest.indexSha256);
    const index = await readJson(root, 'index.json');
    assert.equal(new Set(index.map((entry) => entry.id)).size, index.length);
    const known = new Set(index.map((entry) => entry.id));
    for (const entry of index) {
      assert.equal(entry.sha256, manifest.files[entry.document], entry.id);
      assert.equal(entry.length, (await readFile(path.join(root, entry.document), 'utf8')).length, entry.id);
      for (const dependency of [...entry.requires, ...entry.related])
        if (dependency.startsWith('component:'))
          assert.ok(known.has(dependency), `${entry.id}: ${dependency}`);
    }
  }
});

test('every ready recipe is bound to the exact checked scaffold and overlay bytes', async () => {
  const registry = await readJson(catalog, 'recipes/registry.json');
  const evidence = await readJson(catalog, 'recipes/compiler-evidence.json');
  const scaffoldFiles = {};
  for (const file of await files(path.join(catalog, registry.scaffold.directory)))
    scaffoldFiles[file] = sha256(await readFile(path.join(catalog, registry.scaffold.directory, file)));
  const declaredInputs = new Set([
    'registry.json',
    'compiler-evidence.json',
    ...Object.keys(scaffoldFiles).map(
      (file) => registry.scaffold.directory.slice('recipes/'.length) + '/' + file,
    ),
    ...registry.recipes.flatMap((recipe) =>
      recipe.files.map((file) => recipe.directory.slice('recipes/'.length) + '/' + file),
    ),
  ]);
  assert.deepEqual(
    (await files(path.join(catalog, 'recipes'))).sort(),
    [...declaredInputs].sort(),
    'Only scaffold, evidence and declared recipe inputs may be published.',
  );
  const scaffoldSha256 = sha256(JSON.stringify(sortedObject(scaffoldFiles)));
  assert.equal(evidence.mock, false);
  assert.equal(evidence.mmdVersion, registry.mmdVersion);
  assert.equal(evidence.scaffoldSha256, scaffoldSha256);
  const ready = registry.recipes.filter((recipe) => recipe.readiness === 'ready');
  assert.ok(ready.length > 0, 'Catalog must deliver compiler-checked recipes.');
  for (const recipe of ready) {
    assert.ok(recipe.files.length > 0, recipe.id);
    const inputs = { ...scaffoldFiles };
    for (const file of recipe.files)
      inputs[file] = sha256(await readFile(path.join(catalog, recipe.directory, file)));
    const inputFiles = sortedObject(inputs),
      sourceSha256 = sha256(JSON.stringify(inputFiles));
    const run = evidence.runs.find((entry) => entry.recipeId === recipe.id);
    assert.ok(run, recipe.id);
    assert.equal(run.passed, true, recipe.id);
    assert.equal(run.inputUnchanged, true, recipe.id);
    assert.equal(run.exitCode, 0, recipe.id);
    assert.match(run.output, /Validation successful/);
    assert.doesNotMatch(run.output, /APEXLang Compile Errors|ORA-\d{5}|\bError:|\bWarning:/i);
    assert.deepEqual(run.inputFiles, inputFiles, recipe.id);
    assert.equal(run.sourceSha256, sourceSha256, recipe.id);
    assert.equal(recipe.verification.compiler.status, 'passed', recipe.id);
    assert.equal(recipe.verification.compiler.sourceSha256, sourceSha256, recipe.id);
    assert.equal(recipe.verification.compiler.scaffoldSha256, scaffoldSha256, recipe.id);
    assert.equal(recipe.verification.compiler.mmdVersion, registry.mmdVersion, recipe.id);
    for (const kind of ['sql', 'import', 'browser'])
      assert.equal(recipe.verification[kind], 'not-run', `${recipe.id}: ${kind}`);
  }
});

test('offline catalog build is deterministic and refuses stale ready evidence or unexpected source files', async (t) => {
  const root = await temporary(t);
  await cp(catalog, root, { recursive: true });
  await buildComponentCatalog(root, true);
  const before = await readFile(path.join(root, 'manifest.json'), 'utf8');
  await buildComponentCatalog(root);
  assert.equal(await readFile(path.join(root, 'manifest.json'), 'utf8'), before);
  await buildComponentCatalog(root, true);
  const registry = await readJson(root, 'recipes/registry.json');
  const recipe = registry.recipes.find((entry) => entry.readiness === 'ready');
  assert.ok(recipe);
  const file = path.join(root, recipe.directory, recipe.files[0]);
  const original = await readFile(file, 'utf8');
  await writeFile(file, original + '\n');
  await assert.rejects(buildComponentCatalog(root), /evidence|hash|digest|input|stale/i);
  await writeFile(file, original);
  await writeFile(path.join(root, 'private-export.sql'), 'begin wwv_flow_imp.import_begin; end;\n/\n');
  await assert.rejects(buildComponentCatalog(root), /unexpected|unregistered|unsafe|allow|publication|file/i);
});

test('installed plugin reads components and legacy references offline from a projectless directory', async (t) => {
  const temporaryRoot = await temporary(t);
  const root = path.join(temporaryRoot, 'plugin');
  await cp('dist/codex-compat/plugins/apexrest-apex', root, { recursive: true });
  const work = path.join(temporaryRoot, 'projectless');
  await mkdir(work);
  const env = {
    ...process.env,
    PATH: work,
    APEXREST_HOME: path.join(temporaryRoot, 'home'),
    APEXREST_SQLCL: path.join(work, 'not-installed'),
  };
  delete env.APEXREST_RESOURCES;
  const invoke = (args) => {
    const result = spawnSync(
      process.execPath,
      [path.join(root, 'runtime/apexrest.mjs'), 'docs', ...args, '--json'],
      { cwd: work, env, encoding: 'utf8', timeout: 20000 },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const body = JSON.parse(result.stdout);
    assert.equal(body.ok, true);
    return body.data;
  };
  const metric = invoke([
    'search',
    'картка показника',
    '--corpus',
    'components',
    '--kind',
    'template',
    '--version',
    '26.1',
  ]);
  assert.ok(metric.length > 0 && metric.length <= 3);
  assert.ok(metric.some((entry) => entry.id.includes('metric-card')));
  const page = invoke(['read', metric[0].id]);
  assert.equal(page.classification, 'component-reference-data');
  assert.equal(page.compatibility.apexVersion, '26.1');
  assert.ok(page.content.length);
  const scenarios = [
    ['regions/standard', 'regions', ['Standard Region', 'стандартний регіон']],
    ['reports/interactive-report', 'reports', ['Interactive Report', 'інтерактивний звіт']],
    ['reports/interactive-grid', 'reports', ['Interactive Grid', 'інтерактивний грід']],
    ['regions/cards', 'regions', ['Cards', 'картки']],
    ['template-components/metric-card', 'template-components', ['Metric Card', 'картка показника']],
    ['template-components/media-list', 'template-components', ['Media List', 'медіасписок']],
    ['template-components/comments', 'template-components', ['Comments', 'коментарі']],
    ['regions/smart-filters', 'regions', ['Smart Filters', 'розумні фільтри']],
    ['regions/region-display-selector', 'regions', ['Region Display Selector', 'перемикач регіонів']],
    ['regions/form', 'regions', ['Form', 'форма']],
  ];
  for (const [component, family, queries] of scenarios) {
    for (const query of queries) {
      const found = invoke([
        'search',
        query,
        '--corpus',
        'components',
        '--kind',
        'template',
        '--family',
        family,
        '--limit',
        '3',
      ]);
      assert.ok(
        found.some((hit) => hit.id.startsWith('component:' + component + '/recipes/')),
        `${query}: ${found.map((hit) => hit.id)}`,
      );
    }
  }
  const old = invoke(['search', 'validate']);
  assert.ok(old.some((entry) => !entry.id.startsWith('component:')));
  assert.equal(invoke(['read', 'apexlang-lifecycle']).classification, 'vendor-reference-data');
  assert.deepEqual(await files(work), [], 'Reference operations must not initialize a project.');
});
