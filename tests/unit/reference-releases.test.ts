import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  referenceRead,
  referenceSearch,
  referenceSync,
  resolveReferenceVersion,
} from '../../packages/core/src/references.ts';
import { hash, readJson, writeJson } from '../../packages/core/src/fs.ts';
import { success, sanitized, failure, Fault } from '../../packages/core/src/result.ts';
import { fixture } from '../fixtures/project.ts';

const resources = path.resolve('resources');
const newRoot = path.join(resources, 'references/26.2');
test('release lookup defaults to immutable 26.1 and keeps 26.2 links and snapshots isolated', async (t) => {
  const old = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = resources;
  t.after(() =>
    old === undefined ? delete process.env.APEXREST_RESOURCES : (process.env.APEXREST_RESOURCES = old),
  );
  assert.equal(
    hash(await readFile(path.join(resources, 'references/index.json'))),
    '958d789e5f05c273bb6b6b0cc22cf8e52bb78fa7532ef2353fdd2c8689d2fb0e',
  );
  assert.equal((await referenceRead('oracle-form-example', 0, 100)).version, '26.1@b94ccf4');
  assert.ok((await referenceSearch('reasoningEffort')).every((hit) => hit.version !== '26.2'));
  const id = 'oracle:26.2:guide/ai-provider-effort';
  const hit = (await referenceSearch(id, '26.2'))[0]!;
  assert.equal(hit.id, id);
  const page = await referenceRead(id, 0, 8000);
  assert.equal(page.version, '26.2');
  assert.match(page.content, /xhigh and max differ/);
  assert.ok('relatedReferences' in page);
  for (const link of page.relatedReferences) {
    assert.match(link.id, /^oracle:26\.2:/);
    assert.notEqual(link.title, null);
    assert.match((await referenceRead(link.id, 0, 100)).version, /^26\.2/);
  }
  await assert.rejects(referenceRead(id, 0, 100, undefined, '26.1'), { code: 'REFERENCE_NOT_FOUND' });
  await assert.rejects(referenceRead('oracle-form-example', 0, 100, undefined, '26.2'), {
    code: 'REFERENCE_NOT_FOUND',
  });
  assert.deepEqual(await referenceSearch(id, '26.1'), []);
  assert.deepEqual(await referenceSearch('reasoningEffort', '26.2@unreviewed'), []);
  assert.match(
    (await referenceRead('apexlang-lifecycle', 0, 100, undefined, '26.2')).content,
    /selected-file import/,
  );
  assert.equal((await referenceSearch(id))[0]?.id, id, 'version-qualified search IDs select their corpus');
});

test('project profile supplies release only when no explicit version is selected', async (t) => {
  const old = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = resources;
  const { ctx } = await fixture();
  t.after(async () => {
    if (old === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = old;
    await rm(ctx.root, { recursive: true, force: true });
  });
  assert.equal(await resolveReferenceVersion(ctx.root), '26.1');
  ctx.config.toolchain.profile = '26.2';
  await writeJson(path.join(ctx.root, 'apexrest.json'), ctx.config);
  assert.equal(await resolveReferenceVersion(ctx.root), '26.2');
  assert.equal(await resolveReferenceVersion(ctx.root, '26.1'), '26.1');
  assert.ok(
    (await referenceSearch('reasoningEffort', undefined, { project: ctx.root })).every((hit) =>
      hit.version.startsWith('26.2'),
    ),
  );
  assert.equal((await referenceRead('apexlang-lifecycle', 0, 200, ctx.root)).version, '26.2');
  const catalog = (await readJson(path.join(resources, 'components/index.json'))) as { id: string }[];
  const id = catalog[0]!.id;
  assert.deepEqual(
    await referenceSearch(id, '26.2', { corpus: 'components' }),
    [],
    '26.1 UX IDs cannot bypass release routing',
  );
  const official = 'oracle:26.2:inventory/app/page/region/plugin-variants/interactive-grid/interactive-grid';
  assert.equal((await referenceSearch(official, '26.2', { corpus: 'components' }))[0]?.id, official);
  await assert.rejects(referenceRead(id, 0, 100, ctx.root), { code: 'REFERENCE_NOT_FOUND' });
});

test('26.2 index and each reference are checksum protected, including manifest-only cache changes', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-release-refs-'));
  const old = { resources: process.env.APEXREST_RESOURCES, home: process.env.APEXREST_HOME };
  t.after(async () => {
    if (old.resources === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = old.resources;
    if (old.home === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = old.home;
    await rm(root, { recursive: true, force: true });
  });
  process.env.APEXREST_RESOURCES = root;
  process.env.APEXREST_HOME = path.join(root, 'home');
  const destination = path.join(root, 'references/26.2');
  await cp(newRoot, destination, { recursive: true });
  const manifestPath = path.join(destination, 'oracle-snapshot.json');
  const manifest = (await readJson(manifestPath)) as { release: string; indexSha256: string };
  const original = await readFile(path.join(destination, 'index.json'), 'utf8');
  assert.equal((await referenceSync('26.2', true)).status, 'planned');
  await writeJson(manifestPath, { ...manifest, indexSha256: '0'.repeat(64) });
  await assert.rejects(referenceSearch('reasoningEffort', '26.2'), { code: 'REFERENCE_CATALOG_INVALID' });
  await writeJson(manifestPath, manifest);
  assert.ok((await referenceSearch('reasoningEffort', '26.2')).length);
  const records = JSON.parse(original) as { text: string }[];
  records[0]!.text += '\nTampered';
  const changed = JSON.stringify(records);
  await writeFile(path.join(destination, 'index.json'), changed);
  await writeJson(manifestPath, { ...manifest, indexSha256: hash(changed) });
  await assert.rejects(referenceSearch('reasoningEffort', '26.2'), { code: 'REFERENCE_CATALOG_INVALID' });
});

test('reviewed 26.2 payload is data-only, bounded and records genuine offline recipe evidence', async () => {
  const snapshot = (await readJson(path.join(newRoot, 'oracle-snapshot.json'))) as {
    commit: string;
    archiveSha256: string;
    indexSha256: string;
    sourceFiles: Record<string, string>;
    recipeFiles: Record<string, string>;
  };
  const lock = (await readJson(path.resolve('toolchains/sources.lock.json'))) as {
    oracleSkills26_2: { commit: string; archiveSha256: string };
  };
  assert.match(snapshot.commit, /^[a-f0-9]{40}$/);
  assert.match(snapshot.archiveSha256, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.commit, lock.oracleSkills26_2.commit);
  assert.equal(snapshot.archiveSha256, lock.oracleSkills26_2.archiveSha256);
  const index = await readFile(path.join(newRoot, 'index.json'));
  assert.equal(hash(index), snapshot.indexSha256);
  assert.ok(index.length < 4 * 1024 * 1024);
  assert.ok(
    Object.keys(snapshot.sourceFiles).every(
      (file) =>
        (file.includes('/assets/') || file === 'apexlang-inventory/SKILL.md') &&
        /\.(md|apx|json)$/.test(file),
    ),
  );
  const evidence = (await readJson(path.join(newRoot, 'recipes/verification.json'))) as {
    status: string;
    evidenceKind: string;
    mmdVersion: string;
    sqlclVersion: string;
    files: Record<string, string>;
    scope: string;
  };
  assert.equal(evidence.status, 'passed');
  assert.equal(evidence.evidenceKind, 'oracle-offline-compiler');
  assert.equal(evidence.mmdVersion, '26.2.0+3479');
  assert.match(evidence.sqlclVersion, /26\.3\.0\.260\.1620/);
  assert.match(evidence.scope, /no Oracle database/);
  assert.equal(Object.keys(evidence.files).length, 6);
  for (const [file, digest] of Object.entries(evidence.files)) {
    assert.equal(hash(await readFile(path.join(newRoot, 'recipes', file))), digest);
    assert.equal(snapshot.recipeFiles[file], digest);
  }
});

test('full official definitions paginate past the former inline size limit and reject external-byte drift', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-full-inventory-'));
  const old = process.env.APEXREST_RESOURCES;
  t.after(async () => {
    if (old === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = old;
    await rm(root, { recursive: true, force: true });
  });
  await cp(newRoot, path.join(root, 'references/26.2'), { recursive: true });
  process.env.APEXREST_RESOURCES = root;
  const id = 'oracle:26.2:inventory/app/page/region/series/series';
  const file = path.join(root, 'references/26.2/documents/app/page/region/series/series.md');
  const raw = await readFile(file, 'utf8');
  assert.ok(raw.length > 600_000, 'the real official document exercises lazy retrieval');
  const last = await referenceRead(id, raw.length - 8192, 8192, undefined, '26.2');
  assert.equal(last.content, raw.slice(-8192));
  assert.equal(last.nextOffset, null);
  assert.equal(last.length, raw.length);
  await writeFile(file, raw + '\nChanged official source');
  await assert.rejects(referenceRead(id, 0, 100, undefined, '26.2'), { code: 'REFERENCE_CATALOG_INVALID' });
});

test('verified official contracts retain enum bytes while operation output stays redacted', async (t) => {
  const old = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = resources;
  t.after(() =>
    old === undefined ? delete process.env.APEXREST_RESOURCES : (process.env.APEXREST_RESOURCES = old),
  );
  const id = 'oracle:26.2:inventory/app/component-group/component/component';
  const raw = await readFile(
    path.join(newRoot, 'documents/app/component-group/component/component.md'),
    'utf8',
  );
  const offset = raw.indexOf('authorization:');
  assert.ok(offset >= 0);
  const page = await referenceRead(id, offset, 300, undefined, '26.2');
  const result = success('docs.read', page);
  assert.equal((sanitized(result) as typeof result).data, page);
  assert.equal(page.content, raw.slice(offset, offset + 300));
  const operation = success('connection.test', {
    connection: { password: 'private-connection-password', token: 'private-access-token' },
    environment: 'password=private-env-password',
  });
  assert.doesNotMatch(JSON.stringify(sanitized(operation)), /private-(?:connection|access|env)/);
  const diagnostic = failure(
    'connection.test',
    new Fault('CONNECTION_FAILED', 'password=private-diagnostic-password'),
  );
  assert.doesNotMatch(JSON.stringify(diagnostic), /private-diagnostic-password/);
  assert.deepEqual(
    sanitized({
      classification: 'vendor-reference-data',
      content: 'password: sensitive-value',
      token: 'secret-value',
    }),
    { classification: 'vendor-reference-data', content: 'password: [REDACTED]', token: '[REDACTED]' },
  );
});

test('ordinary discovery rebuilds empty, incomplete, misrouted and absent accelerators from verified full definitions', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-search-integrity-'));
  const old = process.env.APEXREST_RESOURCES;
  t.after(async () => {
    if (old === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = old;
    await rm(root, { recursive: true, force: true });
  });
  const destination = path.join(root, 'references/26.2');
  await cp(newRoot, destination, { recursive: true });
  process.env.APEXREST_RESOURCES = root;
  const searchFile = path.join(destination, 'search.json');
  const original = await readFile(searchFile, 'utf8');
  const prebuilt = JSON.parse(original) as {
    schemaVersion: number;
    indexSha256: string;
    postings: Record<string, number[]>;
  };
  const manifest = (await readJson(path.join(destination, 'oracle-snapshot.json'))) as {
    searchSha256: string;
  };
  assert.equal(hash(original), manifest.searchSha256, 'search bytes have an independent snapshot binding');
  const probes = [
    {
      query: 'interactive grid',
      id: 'oracle:26.2:inventory/app/page/region/plugin-variants/interactive-grid/interactive-grid',
    },
    { query: 'reasoningEffort', id: 'oracle:26.2:inventory/app/ai-agent/ai-agent' },
    { query: 'workflow', id: 'oracle:26.2:inventory/app/workflow/workflow' },
  ];
  const expected: string[][] = [];
  for (const probe of probes) {
    const ids = (
      await referenceSearch(probe.query, '26.2', { corpus: 'components', limit: 3, include: 'metadata' })
    ).map((hit) => hit.id);
    assert.ok(ids.includes(probe.id), probe.query);
    expected.push(ids);
  }
  const partial = Object.fromEntries(
    Object.entries(prebuilt.postings).filter(([term]) => !/reason|effort/.test(term)),
  );
  const misrouted = Object.fromEntries(Object.keys(prebuilt.postings).map((term) => [term, [0]]));
  for (const [name, postings] of [
    ['empty', {}],
    ['incomplete', partial],
    ['misrouted', misrouted],
  ] as const) {
    await writeFile(searchFile, JSON.stringify({ ...prebuilt, postings }));
    for (const [index, probe] of probes.entries())
      assert.deepEqual(
        (
          await referenceSearch(probe.query, '26.2', { corpus: 'components', limit: 3, include: 'metadata' })
        ).map((hit) => hit.id),
        expected[index],
        `${name}: ${probe.query}`,
      );
    assert.deepEqual(
      await referenceSearch('qzxvnoexist987654', '26.2', { corpus: 'components' }),
      [],
      `${name}: unrelated search`,
    );
  }
  await rm(searchFile);
  for (const [index, probe] of probes.entries())
    assert.deepEqual(
      (
        await referenceSearch(probe.query, '26.2', { corpus: 'components', limit: 3, include: 'metadata' })
      ).map((hit) => hit.id),
      expected[index],
      `absent: ${probe.query}`,
    );
  await writeFile(searchFile, original);
  assert.deepEqual(
    (
      await referenceSearch('interactive grid', '26.2', {
        corpus: 'components',
        limit: 3,
        include: 'metadata',
      })
    ).map((hit) => hit.id),
    expected[0],
    'restored accelerator invalidates fallback cache',
  );
  assert.deepEqual(await referenceSearch('reasoningEffort', '26.1'), [], 'release routing is unchanged');
  const unrelatedFile = path.join(destination, 'documents/app-group/app-group.md');
  await writeFile(unrelatedFile, (await readFile(unrelatedFile, 'utf8')) + '\nUnreviewed bytes');
  await writeFile(searchFile, JSON.stringify({ ...prebuilt, postings: {} }));
  await assert.rejects(
    referenceSearch('interactive grid', '26.2', { corpus: 'components' }),
    { code: 'REFERENCE_CATALOG_INVALID' },
    'fallback verifies every complete document, including documents outside the query results',
  );
});
