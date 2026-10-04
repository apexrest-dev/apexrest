import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { buildPatternCatalog } from '../../scripts/build-pattern-catalog.mjs';
import { reusableCompilerRun } from '../../scripts/component-recipe-verification.mjs';
import { files, sha256 } from '../../scripts/lib/release.mjs';

const catalog = path.resolve('resources/patterns');
const readJson = async (root, file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const sorted = (value) =>
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')));
async function temporary(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-pattern-package-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function assertStructuralOnly(value, location = 'source') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.doesNotMatch(
      key,
      /^(?:workspace|schema|parsingSchema|connection|credentials|password|apiKey|accessToken|sqlQuery|plSqlCode|htmlCode|javaScriptCode|cssInline|declaration|body|text)$/i,
      `${location}.${key}`,
    );
    assertStructuralOnly(child, `${location}.${key}`);
  }
}

test('pattern sources remain structural facts and every reviewed pattern page is accounted for', async () => {
  const registry = await readJson(catalog, 'recipes/registry.json');
  const manifest = await readJson(catalog, 'manifest.json');
  const index = await readJson(catalog, 'index.json');
  const patternIds = new Set(registry.patterns.map((pattern) => pattern.id));
  const componentIds = new Set(
    (await readJson(path.dirname(catalog), 'components/index.json')).map((entry) => entry.id),
  );
  const sources = await readdir(path.join(catalog, 'source'));
  assert.equal(sources.length, manifest.counts.sources);
  assert.deepEqual(Object.keys(registry.sourceReviews).sort(), sources.slice().sort());
  let pages = 0;
  let variants = 0;
  for (const sourceId of sources) {
    const root = path.join(catalog, 'source', sourceId);
    assert.deepEqual((await files(root)).sort(), ['inventory.json', 'snapshot.json']);
    const snapshot = await readJson(root, 'snapshot.json');
    const inventory = await readJson(root, 'inventory.json');
    assert.equal(snapshot.sourceId, sourceId);
    assert.equal(inventory.sourceId, sourceId);
    assertStructuralOnly(snapshot);
    assertStructuralOnly(inventory);
    assert.equal(snapshot.rights.sourceCodeRedistributed, false);
    assert.equal(snapshot.rights.sourceProseRedistributed, false);
    assert.equal(snapshot.rights.sourceAssetsRedistributed, false);
    assert.ok(snapshot.sourceDigests.files.every((file) => file.contentPublished === false));
    assert.ok(inventory.resources.every((resource) => resource.redistribution === 'not-included'));
    const classifications = registry.sourceClassifications?.[sourceId] ?? {};
    for (const kind of [
      'pages',
      'regions',
      'items',
      'buttons',
      'dynamicActions',
      'dynamicActionSteps',
      'actions',
      'processes',
      'validations',
      'branches',
      'sharedComponents',
      'sharedReferences',
      'objects',
      'resources',
      'lists',
      'listEntries',
      'plugins',
    ])
      assert.equal(inventory[kind].length, snapshot.counts[kind], `${sourceId}/${kind}`);
    assert.equal(new Set(inventory.objects.map((object) => object.id)).size, inventory.objects.length);
    assert.equal(new Set(inventory.pages.map((page) => page.pageId)).size, inventory.pages.length);
    const reviews = registry.sourceReviews[sourceId];
    assert.deepEqual(
      Object.keys(reviews).sort(),
      inventory.pages.map((page) => String(page.pageId)).sort(),
      `${sourceId}: every source page needs exactly one review`,
    );
    for (const page of inventory.pages) {
      const classification = classifications[page.pageId] ?? page.classification;
      const review = reviews[page.pageId];
      const label = `${sourceId}/${page.pageId}`;
      assert.equal(review.sourceSha256, page.provenance.sha256, `${label}: stale source review`);
      assert.equal(review.classification, classification, label);
      assert.ok(review.reason?.trim(), label);
      assert.ok(Array.isArray(review.variants) && review.variants.length > 0, label);
      for (const id of review.patternIds) assert.ok(patternIds.has(id), `${label}: unknown ${id}`);
      for (const id of review.componentIds) assert.ok(componentIds.has(id), `${label}: unknown ${id}`);
      if (classification === 'pattern') assert.ok(review.patternIds.length > 0, label);
      for (const variant of review.variants) {
        assert.ok(variant.name?.trim() && variant.reason?.trim(), label);
        assert.ok(
          ['pattern', 'component', 'visual', 'documentation', 'unresolved'].includes(variant.disposition),
          label,
        );
        assert.ok(Array.isArray(variant.patternIds), label);
        if (variant.disposition === 'pattern') assert.ok(variant.patternIds.length > 0, label);
        for (const id of variant.patternIds)
          assert.ok(patternIds.has(id) && review.patternIds.includes(id), `${label}: unknown ${id}`);
      }
      variants += review.variants.length;
      const guide = index.find(
        (entry) => entry.id === `pattern:source/${sourceId}/review/page-${page.pageId}`,
      );
      assert.ok(guide, `${label}: missing installed coverage guide`);
      assert.equal(guide.kind, 'guide');
      assert.equal(guide.family, 'coverage');
      assert.deepEqual(
        guide.related.slice().sort(),
        [...new Set([...review.patternIds, ...review.componentIds])].sort(),
        label,
      );
      assert.ok(
        ['pattern', 'group', 'primitives', 'documentation', 'scaffolding', 'placeholder'].includes(
          classification,
        ),
      );
      if (classification === 'pattern')
        assert.ok(
          registry.patterns.some(
            (pattern) => pattern.sourceId === sourceId && pattern.sourcePageIds.includes(page.pageId),
          ),
          `${sourceId}/${page.pageId}`,
        );
    }
    pages += inventory.pages.length;
  }
  assert.equal(pages, 150, 'The reviewed reference snapshots contain 122 + 28 pages.');
  assert.equal(manifest.counts.pages, pages);
  assert.equal(manifest.counts.reviewedPages, pages);
  assert.equal(manifest.counts.reviewedVariants, variants);
  assert.equal(
    index.filter((entry) => /^pattern:source\/[^/]+\/review\/page-\d+$/.test(entry.id)).length,
    pages,
  );
  assert.equal(manifest.counts.patterns, registry.patterns.length);
  assert.equal(manifest.counts.recipes, registry.recipes.length);
  for (const readiness of ['ready', 'unresolved'])
    assert.equal(
      manifest.counts[readiness + 'Recipes'],
      registry.recipes.filter((recipe) => recipe.readiness === readiness).length,
    );
  for (const recipe of registry.recipes.filter((recipe) => recipe.readiness === 'unresolved'))
    assert.ok(recipe.reason?.trim(), recipe.id);
  for (const recipe of registry.recipes) {
    assert.ok(recipe.titleUk?.trim(), `${recipe.id}: missing Ukrainian variant name`);
    for (const language of ['en', 'uk']) {
      const query = recipe.searchQueries?.[language];
      assert.ok(query?.trim(), `${recipe.id}: missing ${language} variant query`);
      assert.doesNotMatch(query, /pattern:|\/recipes\/|component:/, recipe.id);
    }
    assert.match(recipe.searchQueries.uk, /[А-Яа-яІіЇїЄєҐґ]/u, recipe.id);
  }
});

test('Universal Theme primitive guides retain observed Avatar and Badge examples', async () => {
  const index = await readJson(catalog, 'index.json');
  const inventory = await readJson(catalog, 'source/universal-theme-reference/inventory.json');
  for (const [pageId, expectedExamples] of [
    [3001, [{ key: 'avatar', type: 'themeTemplateComponent/avatar' }]],
    [
      3002,
      [
        { key: 'cr', type: 'classicReport' },
        { key: 'ir', type: 'interactiveReport' },
      ],
    ],
  ]) {
    const guide = index.find(
      (entry) => entry.id === `pattern:source/universal-theme-reference/page-${pageId}`,
    );
    assert.ok(guide, `Missing primitive guide for page ${pageId}`);
    assert.equal(guide.kind, 'guide');
    assert.equal(guide.family, 'primitives');
    const document = await readFile(path.join(catalog, guide.document), 'utf8');
    const block = document.match(/```json\n([\s\S]*?)\n```/);
    assert.ok(block, guide.id);
    const facts = JSON.parse(block[1]);
    assert.equal(facts.sourceId, 'universal-theme-reference');
    assert.equal(facts.pageId, pageId);
    assert.ok(facts.examples.length > 0, `${guide.id}: empty primitive examples`);
    for (const expected of expectedExamples)
      assert.ok(
        facts.examples.some((example) => example.key === expected.key && example.type === expected.type),
        `${guide.id}: missing ${expected.key} (${expected.type})`,
      );
    for (const example of facts.examples)
      assert.ok(
        inventory.regions.some(
          (region) => region.pageId === pageId && region.key === example.key && region.type === example.type,
        ),
        `${guide.id}: unknown source example ${example.key}`,
      );
  }
});

test('pattern manifests exactly match both distributions with hashes, closed links and no private exports', async () => {
  const expectedManifest = await readFile(path.join(catalog, 'manifest.json'), 'utf8');
  for (const root of [
    catalog,
    path.resolve('dist/resources/patterns'),
    path.resolve('dist/codex-compat/plugins/apexrest-apex/resources/patterns'),
  ]) {
    assert.equal(await readFile(path.join(root, 'manifest.json'), 'utf8'), expectedManifest);
    const manifest = await readJson(root, 'manifest.json');
    assert.deepEqual((await files(root)).sort(), [...Object.keys(manifest.files), 'manifest.json'].sort());
    for (const [file, digest] of Object.entries(manifest.files)) {
      const content = await readFile(path.join(root, file));
      assert.equal(sha256(content), digest, `${root}/${file}`);
      assert.match(
        file,
        /^(?:source\/[a-z0-9-]+\/(?:snapshot|inventory)\.json|recipes\/.+\.(?:apx|json|sql|svg)|docs\/[a-z0-9/-]+\.md|index\.json)$/,
        file,
      );
      assert.doesNotMatch(
        file,
        /(?:^|\/)(?:f101|application-101|private|exports?|wallet|node_modules)(?:\.|\/)|\.(?:jar|zip|html?|sqlcl|wallet)$/i,
        file,
      );
      assert.doesNotMatch(
        content.toString('utf8'),
        /\/Users\/|\/private\/var\/folders\/|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|wwv_flow_imp\.(?:import_begin|create_flow)|oraclecloudapps\.com|BEGIN APEX APPLICATION EXPORT|\bWKSP_[A-Z0-9_]+\b|"(?:password|client_secret|access_token)"\s*:\s*"[^"\s]+"/i,
        file,
      );
    }
    assert.equal(manifest.files['index.json'], manifest.indexSha256);
    const index = await readJson(root, 'index.json');
    const componentIds = new Set(
      (await readJson(path.dirname(root), 'components/index.json')).map((entry) => entry.id),
    );
    const oracle = await readJson(path.dirname(root), 'references/index.json');
    const oracleIds = new Set(oracle.map((entry) => entry.id));
    const grammarIds = new Set(
      oracle.flatMap((entry) => entry.symbols ?? []).map((symbol) => 'grammar:' + symbol),
    );
    const known = new Set(index.map((entry) => entry.id));
    assert.equal(known.size, index.length);
    assert.equal(manifest.counts.records, index.length);
    for (const entry of index) {
      assert.ok(entry.id.startsWith('pattern:'), entry.id);
      assert.equal(entry.sha256, manifest.files[entry.document], entry.id);
      assert.equal(entry.length, (await readFile(path.join(root, entry.document), 'utf8')).length, entry.id);
      for (const link of [...entry.requires, ...entry.related])
        assert.ok(
          known.has(link) || componentIds.has(link) || oracleIds.has(link) || grammarIds.has(link),
          `${entry.id}: unresolved ${link}`,
        );
    }
    const registry = await readJson(root, 'recipes/registry.json');
    const compilerPin = await readJson(root, `${registry.scaffold.directory}/.apex/apexlang.json`);
    assert.deepEqual(compilerPin, { mmdVersion: registry.mmdVersion });
  }
});

test('ready pattern recipes have exact compiler proof and only declared authored inputs are packaged', async () => {
  const registry = await readJson(catalog, 'recipes/registry.json');
  const evidence = await readJson(catalog, 'recipes/compiler-evidence.json');
  const scaffoldFiles = {};
  for (const file of await files(path.join(catalog, registry.scaffold.directory)))
    scaffoldFiles[file] = sha256(await readFile(path.join(catalog, registry.scaffold.directory, file)));
  const scaffoldSha256 = sha256(JSON.stringify(sorted(scaffoldFiles)));
  const expected = new Set([
    'recipes/registry.json',
    'recipes/compiler-evidence.json',
    ...Object.keys(scaffoldFiles).map((file) => `${registry.scaffold.directory}/${file}`),
    ...registry.recipes.flatMap((recipe) => recipe.files.map((file) => `${recipe.directory}/${file}`)),
  ]);
  assert.deepEqual(
    (await files(path.join(catalog, 'recipes'))).map((file) => 'recipes/' + file).sort(),
    [...expected].sort(),
  );
  assert.equal(evidence.mock, false);
  assert.equal(evidence.mmdVersion, registry.mmdVersion);
  assert.equal(evidence.scaffoldSha256, scaffoldSha256);
  const ready = registry.recipes.filter((recipe) => recipe.readiness === 'ready');
  assert.ok(ready.length > 0, 'The installed pattern catalog must contain reusable compiled recipes.');
  for (const recipe of ready) {
    assert.equal(recipe.dependenciesClosed, true, recipe.id);
    const inputFiles = { ...scaffoldFiles };
    for (const file of recipe.files)
      inputFiles[file] = sha256(await readFile(path.join(catalog, recipe.directory, file)));
    const runs = evidence.runs.filter((run) => run.recipeId === recipe.id);
    assert.equal(runs.length, 1, recipe.id);
    assert.ok(
      reusableCompilerRun({
        recipe,
        evidence,
        run: runs[0],
        inputFiles,
        scaffoldFiles,
        scaffoldSha256,
        compilerVersion: registry.compilerVersion,
        mmdVersion: registry.mmdVersion,
      }),
      recipe.id,
    );
    for (const kind of ['sql', 'import', 'browser'])
      assert.equal(recipe.verification[kind], 'not-run', `${recipe.id}: ${kind}`);
  }
});

test('offline pattern build is deterministic and rejects altered ready recipes or extra publication files', async (t) => {
  const root = await temporary(t);
  await cp(catalog, root, { recursive: true });
  await buildPatternCatalog(root, true);
  const before = await readFile(path.join(root, 'manifest.json'), 'utf8');
  await buildPatternCatalog(root);
  assert.equal(await readFile(path.join(root, 'manifest.json'), 'utf8'), before);
  await buildPatternCatalog(root, true);
  const registry = await readJson(root, 'recipes/registry.json');
  const recipe = registry.recipes.find((entry) => entry.readiness === 'ready');
  assert.ok(recipe);
  const file = path.join(root, recipe.directory, recipe.files[0]);
  const original = await readFile(file, 'utf8');
  await writeFile(file, original + '\n');
  await assert.rejects(buildPatternCatalog(root), /closure|evidence|hash|digest|input|stale/i);
  await writeFile(file, original);
  const sourceId = registry.patterns[0].sourceId;
  const inventoryFile = path.join(root, 'source', sourceId, 'inventory.json');
  const originalInventory = await readFile(inventoryFile, 'utf8');
  const inventory = JSON.parse(originalInventory);
  inventory.sourceId = 'incorrect-source-namespace';
  await writeFile(inventoryFile, JSON.stringify(inventory));
  await assert.rejects(buildPatternCatalog(root), /source|snapshot|identity|namespace|invalid/i);
  await writeFile(inventoryFile, originalInventory);
  const registryFile = path.join(root, 'recipes/registry.json');
  const originalRegistry = await readFile(registryFile, 'utf8');
  const reviewedPageId = Object.keys(registry.sourceReviews[sourceId])[0];
  const review = registry.sourceReviews[sourceId][reviewedPageId];
  const originalReview = structuredClone(review);
  review.sourceSha256 = '0'.repeat(64);
  await writeFile(registryFile, JSON.stringify(registry));
  await assert.rejects(buildPatternCatalog(root), /stale page review/i);
  registry.sourceReviews[sourceId][reviewedPageId] = structuredClone(originalReview);
  registry.sourceReviews[sourceId][reviewedPageId].patternIds.push('pattern:missing/review-target');
  await writeFile(registryFile, JSON.stringify(registry));
  await assert.rejects(buildPatternCatalog(root), /unknown reviewed pattern/i);
  delete registry.sourceReviews[sourceId][reviewedPageId];
  await writeFile(registryFile, JSON.stringify(registry));
  await assert.rejects(buildPatternCatalog(root), /incomplete page review coverage/i);
  await writeFile(registryFile, originalRegistry);
  const unexpected = path.join(root, 'source/private-export.apx');
  await writeFile(unexpected, 'page 999 ( name: Private export )\n');
  await assert.rejects(buildPatternCatalog(root), /source|file|invalid|unsafe|unregistered/i);
  await rm(unexpected);
  await writeFile(path.join(root, 'private-export.sql'), 'begin wwv_flow_imp.import_begin; end;\n/\n');
  await assert.rejects(buildPatternCatalog(root), /file|unregistered/i);
});

test('installed patterns support EN/UK lookup, filtering and full pagination offline outside a project', async (t) => {
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
    assert.ok(Buffer.byteLength(result.stdout, 'utf8') < (args[0] === 'read' ? 32768 : 8192));
    return body.data;
  };
  const registry = await readJson(path.join(root, 'resources/patterns'), 'recipes/registry.json');
  const ready = registry.recipes.filter((recipe) => recipe.readiness === 'ready');
  const index = await readJson(path.join(root, 'resources/patterns'), 'index.json');
  const searchVariant = (query, pattern) => {
    const found = invoke([
      'search',
      query,
      '--corpus',
      'patterns',
      '--kind',
      'template',
      '--family',
      pattern.family,
      '--version',
      registry.apexVersion,
      '--limit',
      '3',
    ]);
    assert.ok(found.length <= 3);
    assert.ok(
      found.every(
        (hit) =>
          hit.family === pattern.family &&
          hit.kind === 'template' &&
          hit.classification === 'pattern-reference-data',
      ),
    );
    return found;
  };
  // A broad pattern request can return any of its variants. Exact variant
  // requests must still retrieve that individual recipe among the first three.
  // Unresolved recipes are hidden unless includeUnresolved is set
  // (packages/core/src/references.ts), so a pattern whose recipes are all
  // unresolved must stay hidden by default while every other pattern is found.
  for (const pattern of registry.patterns) {
    const recipes = registry.recipes.filter((recipe) => recipe.patternId === pattern.id);
    const recipeIds = new Set(recipes.map((recipe) => recipe.id));
    assert.ok(recipeIds.size > 0, pattern.id);
    const hidden = recipes.every((recipe) => recipe.readiness === 'unresolved');
    for (const query of [pattern.title, pattern.titleUk]) {
      const found = searchVariant(query, pattern);
      assert.equal(
        found.some((hit) => recipeIds.has(hit.id)),
        !hidden,
        `${query}: ${found.map((hit) => hit.id)}`,
      );
    }
  }
  const covered = new Set();
  for (const recipe of ready) {
    const pattern = registry.patterns.find((entry) => entry.id === recipe.patternId);
    assert.ok(pattern);
    for (const language of ['en', 'uk']) {
      const query = recipe.searchQueries?.[language];
      assert.ok(query?.trim(), `${recipe.id}: missing ${language} variant query`);
      const found = searchVariant(query, pattern);
      assert.ok(
        found.some((hit) => hit.id === recipe.id),
        `${query}: ${found.map((hit) => hit.id)}`,
      );
    }
    covered.add(recipe.id);
  }
  assert.equal(covered.size, ready.length);
  assert.deepEqual(
    invoke(['search', 'pattern', '--corpus', 'patterns', '--version', registry.apexVersion + '@not-current']),
    [],
  );
  const all = [];
  let offset = 0;
  do {
    const found = invoke([
      'search',
      'pattern',
      '--corpus',
      'patterns',
      '--kind',
      'template',
      '--limit',
      '2',
      '--offset',
      String(offset),
    ]);
    assert.ok(found.length > 0 && found.length <= 2);
    all.push(...found.map((hit) => hit.id));
    const next = found[0].nextResultOffset;
    assert.ok(next === null || next > offset);
    offset = next;
  } while (offset !== null);
  // Full pagination lists every resolvable recipe; unresolved ones stay hidden by default.
  assert.deepEqual(
    all.slice().sort(),
    registry.recipes
      .filter((recipe) => recipe.readiness !== 'unresolved')
      .map((recipe) => recipe.id)
      .sort(),
  );
  assert.equal(new Set(all).size, all.length);
  const coverage = [];
  offset = 0;
  do {
    const found = invoke([
      'search',
      'coverage',
      '--corpus',
      'patterns',
      '--kind',
      'guide',
      '--family',
      'coverage',
      '--limit',
      '8',
      '--offset',
      String(offset),
    ]);
    assert.ok(found.length > 0 && found.length <= 8);
    assert.ok(found.every((hit) => hit.kind === 'guide' && hit.family === 'coverage'));
    coverage.push(...found.map((hit) => hit.id));
    const next = found[0].nextResultOffset;
    assert.ok(next === null || next > offset);
    offset = next;
  } while (offset !== null);
  assert.deepEqual(
    coverage.slice().sort(),
    index
      .filter((entry) => entry.family === 'coverage')
      .map((entry) => entry.id)
      .sort(),
  );
  assert.equal(new Set(coverage).size, coverage.length);
  assert.equal(coverage.filter((id) => /\/review\/page-\d+$/.test(id)).length, 150);
  const recipe = ready.find((entry) => entry.patternId === 'pattern:browse/full-page-search');
  assert.ok(recipe);
  const coverageRecords = index.filter((entry) => entry.family === 'coverage');
  const longestReview = coverageRecords.slice().sort((a, b) => b.length - a.length)[0];
  const mostLinks = coverageRecords.slice().sort((a, b) => b.related.length - a.related.length)[0];
  assert.ok(longestReview.length > 8192, 'Exercise a review larger than the maximum read window.');
  assert.ok(mostLinks.related.length >= 122, 'Exercise the complete source navigation list.');
  for (const record of [index.find((entry) => entry.id === recipe.id), longestReview, mostLinks]) {
    const chunks = [];
    offset = 0;
    let length, navigationOffset;
    do {
      const page = invoke(['read', record.id, '--offset', String(offset), '--limit', '2048']);
      assert.equal(page.readiness, record.readiness);
      assert.equal(page.classification, 'pattern-reference-data');
      assert.equal(page.compatibility.mmdVersion, registry.mmdVersion);
      assert.equal(Buffer.from(page.content, 'utf8').toString('utf8'), page.content);
      assert.ok(page.content.length > 0);
      chunks.push(page.content);
      length = page.length;
      navigationOffset = page.navigationOffset;
      assert.ok(page.nextOffset === null || page.nextOffset > offset);
      offset = page.nextOffset;
    } while (offset !== null);
    const recovered = chunks.join('');
    assert.equal(recovered.length, length);
    const original = await readFile(path.join(root, 'resources/patterns', record.document), 'utf8');
    assert.equal(recovered.slice(0, navigationOffset), original);
    for (const link of [...record.requires, ...record.related])
      assert.ok(recovered.slice(navigationOffset).includes(link), `${record.id}: ${link}`);
  }
  const skill = await readFile(path.join(root, 'skills/apexrest-pattern-catalog/SKILL.md'), 'utf8');
  assert.match(skill, /^name: apexrest-pattern-catalog$/m);
  assert.match(skill, /references\/capture-and-curation\.md/);
  assert.match(
    await readFile(path.join(root, 'skills/apexrest-apexlang/SKILL.md'), 'utf8'),
    /corpus[\s\S]{0,100}patterns/,
  );
  assert.ok((await files(path.join(root, 'skills/apexrest-pattern-catalog'))).includes('agents/openai.yaml'));
  const legacy = invoke(['search', 'validate']);
  assert.ok(legacy.length > 0 && legacy.every((entry) => !entry.id.startsWith('pattern:')));
  assert.equal(invoke(['read', 'apexlang-lifecycle']).classification, 'vendor-reference-data');
  assert.deepEqual(await files(work), [], 'Offline reference access must not initialize a project.');
});
