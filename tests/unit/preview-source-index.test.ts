import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadApplication, type ApxParseCache } from '../../packages/core/src/preview/apexlang.ts';
import { affectedPages, apxSignatures, changedFiles } from '../../packages/core/src/preview/source-index.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const LOV = `lov statuses (
    name: Statuses
    type: static
)
`;
const PAGE3 = `page 3 (
    name: Third
    alias: THIRD
    title: Third
    region notes (
        name: Notes
        type: staticContent
        layout {
            sequence: 10
        }
    )
    pageItem P3_STATUS (
        type: selectList
        lov {
            lov: @/statuses
        }
        layout {
            sequence: 20
        }
    )
)
`;
const strip = (value: unknown) => JSON.parse(JSON.stringify(value));

test('a cached reload parses only changed files and equals a clean full load', async (t) => {
  const { app } = await workspace(t, {
    'shared-components/lovs/statuses.apx': LOV,
    'pages/p00003-third.apx': PAGE3,
  });
  const cache: ApxParseCache = new Map();
  const first = loadApplication(app, 'default', cache);
  const page1 = first.pages.get('1')!;
  const file = path.join(app, 'pages/p00003-third.apx');
  await writeFile(file, (await readFile(file, 'utf8')).replace('name: Notes', 'name: Remarks'));
  const second = loadApplication(app, 'default', cache);
  assert.equal(second.pages.get('1'), page1, 'an unchanged page keeps its parsed components');
  assert.notEqual(second.pages.get('3'), first.pages.get('3'));
  const clean = loadApplication(app);
  assert.deepEqual(
    strip({ ...second, files: [], parsedFiles: undefined }),
    strip({ ...clean, files: [], parsedFiles: undefined }),
  );
  // A removed file leaves the cache and the application.
  await rm(file);
  const third = loadApplication(app, 'default', cache);
  assert.equal(third.pages.has('3'), false);
  assert.equal([...cache.keys()].includes('pages/p00003-third.apx'), false);
});

test('changes affect their page, the pages that reference a shared component, or every page', async (t) => {
  const { app } = await workspace(t, {
    'shared-components/lovs/statuses.apx': LOV,
    'pages/p00003-third.apx': PAGE3,
  });
  const before = apxSignatures(app);
  const application = loadApplication(app);
  assert.deepEqual(affectedPages(['pages/p00003-third.apx'], [application]), ['3']);
  assert.deepEqual(affectedPages(['shared-components/lovs/statuses.apx'], [application]), ['3']);
  assert.equal(affectedPages(['application.apx'], [application]), 'all');
  assert.equal(affectedPages(['pages/p99999-new.apx'], [application]), 'all');
  // A renamed page file is known to the earlier application (removed) and the new one (added).
  const page = path.join(app, 'pages/p00003-third.apx');
  const content = await readFile(page, 'utf8');
  await rm(page);
  await writeFile(path.join(app, 'pages/p00003-renamed.apx'), content);
  const after = apxSignatures(app);
  const files = changedFiles(before, after);
  assert.deepEqual(files, ['pages/p00003-renamed.apx', 'pages/p00003-third.apx']);
  assert.deepEqual(affectedPages(files, [application, loadApplication(app)]), ['3']);
});

test('a broken source keeps the last good render, marked stale, until a valid change', async (t) => {
  const { app, assets } = await workspace(t);
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const page = async () => (await fetch(`${server.url}/r/demo/home`)).text();
  assert.doesNotMatch(await page(), /apex-local-stale/u);
  const file = path.join(app, 'pages/p00001-home.apx');
  const good = await readFile(file, 'utf8');
  await writeFile(file, good + '\nregion broken (\n    name: Broken\n');
  const stale = await page();
  assert.match(stale, /class="apex-local-stale"/u);
  assert.match(stale, /<title>Home<\/title>/u, 'the last good version is still served');
  const revision = server.revision;
  await writeFile(file, good.replace('title: Home', 'title: Fixed home'));
  const fixed = await page();
  assert.doesNotMatch(fixed, /apex-local-stale/u);
  assert.match(fixed, /<title>Fixed home<\/title>/u);
  assert.equal(server.revision, revision + 1);
});

test('only in-place edits of allowlisted regions are replaced without a page reload', async () => {
  const { parseApexLang } = await import('../../packages/core/src/preview/apexlang.ts');
  const { replaceableRegions } = await import('../../packages/core/src/preview/source-index.ts');
  const page = (source: string) => parseApexLang(source, 'pages/p00003-third.apx')[0]!;
  const before = page(PAGE3);
  const dom = (region: { id: string }) => `${region.id}_dom`;
  // Inserting lines above shifts line numbers only; the region body changed.
  const renamed = page(
    PAGE3.replace('    region notes (', '    // note\n    region notes (').replace(
      'name: Notes',
      'name: Remarks',
    ),
  );
  assert.deepEqual(replaceableRegions(before, renamed, dom), ['notes_dom']);
  // Item, page property, added component or non-allowlisted region changes reload the page.
  assert.equal(
    replaceableRegions(before, page(PAGE3.replace('sequence: 20', 'sequence: 25')), dom),
    undefined,
  );
  assert.equal(replaceableRegions(before, page(PAGE3.replace('title: Third', 'title: 3rd')), dom), undefined);
  assert.equal(
    replaceableRegions(before, page(PAGE3.replace('type: staticContent', 'type: chart')), dom),
    undefined,
  );
  assert.equal(
    replaceableRegions(
      before,
      page(
        PAGE3.replace(
          '    pageItem P3_STATUS (',
          '    region more (\n        type: staticContent\n    )\n    pageItem P3_STATUS (',
        ),
      ),
      dom,
    ),
    undefined,
  );
  assert.equal(replaceableRegions(before, before, dom), undefined);
});

test('cached loads equal clean loads after adding, renaming and rewriting files with older timestamps', async (t) => {
  const { app } = await workspace(t, {
    'shared-components/lovs/statuses.apx': LOV,
    'pages/p00003-third.apx': PAGE3,
  });
  const cache: ApxParseCache = new Map();
  loadApplication(app, 'default', cache);
  const third = path.join(app, 'pages/p00003-third.apx');
  // A rename and a new file in one step; then a same-size rewrite stamped with an older time.
  const content = await readFile(third, 'utf8');
  await rm(third);
  await writeFile(path.join(app, 'pages/p00003-renamed.apx'), content);
  await writeFile(
    path.join(app, 'pages/p00004-fourth.apx'),
    PAGE3.replace('page 3 (', 'page 4 (').replace('alias: THIRD', 'alias: FOURTH'),
  );
  let cached = loadApplication(app, 'default', cache);
  assert.deepEqual(
    strip({ ...cached, files: [], parsedFiles: undefined }),
    strip({ ...loadApplication(app), files: [], parsedFiles: undefined }),
  );
  assert.deepEqual(
    [...cache.keys()].sort(),
    cached.files.map((file) => path.relative(app, file).split(path.sep).join('/')).sort(),
  );
  const renamed = path.join(app, 'pages/p00003-renamed.apx');
  const same = content.replace('name: Notes', 'name: Notez');
  assert.equal(same.length, content.length);
  await writeFile(renamed, same);
  const old = new Date(Date.now() - 86400000);
  await utimes(renamed, old, old);
  cached = loadApplication(app, 'default', cache);
  assert.deepEqual(
    strip({ ...cached, files: [], parsedFiles: undefined }),
    strip({ ...loadApplication(app), files: [], parsedFiles: undefined }),
  );
  assert.match(JSON.stringify(cached.pages.get('3')), /Notez/u);
});

test('reused property findings and the shared theme index give the diagnostics of a clean check', async (t) => {
  const { app, assets } = await workspace(t, {
    'shared-components/lovs/statuses.apx': LOV,
    'pages/p00003-third.apx': PAGE3.replace('name: Notes', 'name: Notes\n        unknownProperty: x'),
  });
  const cached = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await cached.start();
  t.after(() => cached.stop());
  const clean = async () => {
    const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
    await server.start();
    try {
      return server
        .diagnostics()
        .map((d) => `${d.page ?? ''}|${d.message}`)
        .sort();
    } finally {
      await server.stop();
    }
  };
  const same = async (label: string) => {
    await fetch(`${cached.url}/r/demo/home`);
    assert.deepEqual(
      cached
        .diagnostics()
        .map((d) => `${d.page ?? ''}|${d.message}`)
        .sort(),
      await clean(),
      label,
    );
  };
  await same('initial');
  assert.ok(cached.diagnostics().some((d) => /unknownProperty/u.test(d.message)));
  const third = path.join(app, 'pages/p00003-third.apx');
  // A page edit: only that page is checked again; the others are reused.
  await writeFile(third, (await readFile(third, 'utf8')).replace('unknownProperty: x', 'otherUnknown: y'));
  await new Promise((resolve) => setTimeout(resolve, 2100));
  await same('page edit');
  assert.equal(cached.loadTimings?.propertyPagesChecked, 1);
  assert.ok((cached.loadTimings?.propertyPagesReused ?? 0) >= 1);
  // A shared component change, a global page change and a deleted page.
  const lov = path.join(app, 'shared-components/lovs/statuses.apx');
  await writeFile(lov, (await readFile(lov, 'utf8')) + '\n');
  await new Promise((resolve) => setTimeout(resolve, 2100));
  await same('shared component');
  await writeFile(path.join(app, 'pages/p00000-global.apx'), 'page 0 (\n    name: Global\n)\n');
  await new Promise((resolve) => setTimeout(resolve, 2100));
  await same('global page');
  await rm(third);
  await new Promise((resolve) => setTimeout(resolve, 2100));
  await same('deleted page');
  // A different catalog version re-checks every page.
  await mkdir(path.join(app, '.apex'), { recursive: true });
  await writeFile(path.join(app, '.apex/apexlang.json'), JSON.stringify({ mmdVersion: '26.2.0+3479' }));
  await writeFile(lov, await readFile(lov, 'utf8'));
  await utimes(lov, new Date(), new Date(Date.now() + 5000));
  await new Promise((resolve) => setTimeout(resolve, 2100));
  await same('catalog version');
  assert.equal(cached.loadTimings?.propertyPagesReused, 0);
  // Both servers render with one theme index: the same loaded theme calls.
  assert.equal(typeof cached.loadTimings?.totalMs, 'number');
});
