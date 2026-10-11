import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { hash } from '../../packages/core/src/fs.ts';
import { publicTemplateRead, publicTemplateSearch } from '../../packages/core/src/public-templates.ts';
import type { CatalogReference } from '../../packages/core/src/reference-catalog.ts';
import { referenceRead, referenceSearch } from '../../packages/core/src/references.ts';
import { redact } from '../../packages/core/src/result.ts';

const resources = path.resolve('resources');
const prefix = 'oracle:26.2:public-template/';
const directory = 'public-templates/26.2';
const compatibility = { apexVersion: '26.2', themeVersion: '26.2', mmdVersion: '26.2.0+3479' };
function useResources(t: TestContext, root: string) {
  const previous = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = root;
  t.after(() => {
    if (previous === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = previous;
  });
}

test('public source templates are naturally discoverable with bounded code and dependency navigation', async (t) => {
  useResources(t, resources);
  const hits = await publicTemplateSearch('faceted search cards', '26.2', {
    kind: 'template',
    family: 'public-templates/ux-pattern-catalog',
    limit: 3,
  });
  const first = hits[0]!;
  assert.equal(first.id, prefix + 'ux-pattern-catalog/p00210-faceted-search-cards');
  assert.equal(first.readiness, 'reference');
  assert.deepEqual(first.compatibility, compatibility);
  assert.equal(first.code?.language, 'apexlang');
  assert.match(first.code!.text, /^page 210 \(/);
  assert.ok(first.code!.text.length <= 2500);
  assert.equal(first.code!.truncated, true);
  assert.ok(first.code!.length > first.code!.text.length);
  assert.deepEqual(first.requiresReferences, [
    {
      id: prefix + 'ux-pattern-catalog/dependencies',
      title: 'Ux Pattern Catalog source dependencies',
      kind: 'guide',
    },
  ]);
  assert.ok(hits.slice(1).every((hit) => hit.code === undefined));
  assert.ok(Buffer.byteLength(JSON.stringify(hits)) <= 7000);
  for (const query of ['calendar', 'interactive grid', 'dashboard']) {
    const found = await publicTemplateSearch(query, '26.2', { kind: 'template', limit: 3 });
    assert.ok(found.length > 0, query);
    assert.ok(
      found.every((hit) => hit.id.startsWith(prefix) && hit.readiness === 'reference'),
      query,
    );
  }
  const ukrainianCalendar = await publicTemplateSearch('календар', '26.2', { kind: 'template', limit: 3 });
  assert.ok(ukrainianCalendar.length > 0);
  assert.ok(
    ['public-templates/sample-calendar', 'public-templates/team-calendar'].includes(
      ukrainianCalendar[0]!.family,
    ),
    'The Ukrainian calendar query should prioritize a calendar application.',
  );
  assert.ok(
    (await publicTemplateSearch('calendar', '26.2', { include: 'metadata' })).every(
      (hit) => hit.code === undefined,
    ),
  );
  assert.deepEqual(await publicTemplateSearch('qzxvunrelated654321', '26.2'), []);
});

test('component template routing preserves default inventory contracts and 26.1 isolation', async (t) => {
  useResources(t, resources);
  const id = prefix + 'ux-pattern-catalog/p00210-faceted-search-cards';
  const templates = await referenceSearch('faceted search cards', '26.2', {
    corpus: 'components',
    kind: 'template',
  });
  const expected = new Set([id, prefix + 'sample-cards/p00012-faceted-search-with-cards']);
  assert.ok(templates[0] && expected.has(templates[0].id), 'A verified faceted-card page should rank first.');
  assert.ok(templates.some((hit) => hit.id === id));
  assert.equal((await referenceSearch(id))[0]?.id, id);
  assert.equal((await referenceSearch(id, '26.2', { corpus: 'components' }))[0]?.id, id);
  const contracts = await referenceSearch('interactive grid', '26.2', { corpus: 'components' });
  assert.ok(contracts.length > 0);
  assert.ok(contracts.every((hit) => hit.id.startsWith('oracle:26.2:inventory/')));
  assert.deepEqual(await publicTemplateSearch('calendar', '26.1'), []);
  assert.deepEqual(await publicTemplateSearch('calendar', '26.2@unreviewed'), []);
  assert.deepEqual(await referenceSearch(id, '26.1', { corpus: 'components', kind: 'template' }), []);
  assert.ok(
    (await referenceSearch('calendar', '26.1', { corpus: 'components', kind: 'template' })).every(
      (hit) => !hit.id.startsWith(prefix),
    ),
  );
  await assert.rejects(referenceRead(id, 0, 100, undefined, '26.1'), { code: 'REFERENCE_NOT_FOUND' });
});

test('complete large source and dependency documents survive paginated reads without source promotion', async (t) => {
  useResources(t, resources);
  const index = JSON.parse(
    await readFile(path.join(resources, directory, 'index.json'), 'utf8'),
  ) as CatalogReference[];
  const ids = [prefix + 'strategic-planner/p00003-project-details', prefix + 'sample-calendar/dependencies'];
  for (const id of ids) {
    const entry = index.find((item) => item.id === id)!;
    assert.ok(entry);
    const raw = await readFile(path.join(resources, directory, entry.document), 'utf8');
    let offset = 0;
    let content = '';
    let pages = 0;
    do {
      const page = await publicTemplateRead(id, offset, 8192, '26.2');
      assert.equal(page.offset, offset);
      assert.equal(page.readiness, 'reference');
      assert.equal(page.sha256, hash(raw));
      assert.equal(page.sourceDocumentLength, raw.length);
      assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 30000);
      content += page.content;
      pages++;
      if (page.nextOffset === null) break;
      assert.ok(page.nextOffset > offset);
      offset = page.nextOffset;
    } while (pages < 100);
    const navigation =
      '\n\n## Catalog navigation\n\n' +
      entry.requires.map((target) => `- requires: ${target}\n`).join('') +
      entry.related.map((target) => `- related: ${target}\n`).join('');
    assert.equal(content, redact(raw) + redact(navigation));
    assert.match(content, /Source reference only/);
    assert.match(content, /No local compiler, SQL execution, import or browser verification is implied/);
    if (entry.kind === 'template') assert.ok(pages > 20, 'A complete large source needs many bounded reads.');
    else {
      assert.match(content, /## Source files/);
      assert.match(content, /shared-components\//);
      assert.match(content, /not a statement that every file is required by each page/);
    }
  }
});

test('public template document and index corruption fail closed with the catalog-specific error', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-public-template-unit-'));
  useResources(t, root);
  t.after(() => rm(root, { recursive: true, force: true }));
  const raw = '# Calendar source\n\n````apexlang\npage 1 (\n    name: Calendar\n)\n````\n';
  const entry: CatalogReference = {
    id: prefix + 'fixture/p00001-calendar',
    title: 'Calendar source',
    kind: 'template',
    family: 'public-templates/fixture',
    version: '26.2@fixture',
    source: 'https://github.com/oracle/apex/blob/' + 'a'.repeat(40) + '/page.apx',
    document: 'documents/fixture/p00001-calendar.md',
    sha256: hash(raw),
    searchText: 'calendar source',
    requires: [],
    related: [],
    readiness: 'reference',
    compatibility,
    length: raw.length,
  };
  const catalog = path.join(root, directory);
  await mkdir(path.dirname(path.join(catalog, entry.document)), { recursive: true });
  const index = JSON.stringify([entry]);
  await writeFile(path.join(catalog, entry.document), 'tampered source');
  await writeFile(path.join(catalog, 'index.json'), index);
  await writeFile(
    path.join(catalog, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      catalogVersion: '26.2@fixture',
      source: compatibility,
      indexSha256: hash(index),
      files: { 'index.json': hash(index), [entry.document]: hash(raw) },
      counts: { records: 1 },
    }),
  );
  const hits = await publicTemplateSearch('calendar', '26.2');
  assert.equal(hits[0]?.code, undefined, 'A corrupt source must never become inline code.');
  await assert.rejects(publicTemplateRead(entry.id, 0, 100), { code: 'PUBLIC_TEMPLATE_CATALOG_INVALID' });
  await writeFile(path.join(catalog, entry.document), raw);
  assert.match((await publicTemplateRead(entry.id, 0, 100)).content, /Calendar source/);
  await writeFile(path.join(catalog, 'index.json'), index.replace('Calendar source', 'Tampered source'));
  await assert.rejects(publicTemplateSearch('calendar', '26.2'), { code: 'PUBLIC_TEMPLATE_CATALOG_INVALID' });
});
