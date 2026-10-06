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
    'exact IDs must not bypass a requested release',
  );
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
  assert.equal(snapshot.commit, '03ee10d02273bc4002fd527089e7fbb5884f94c4');
  assert.equal(snapshot.archiveSha256, '5e65f9734c3e4c00054ed91e2e14c795be09d17aaa96ddb43f25f4e6d4d3a343');
  const index = await readFile(path.join(newRoot, 'index.json'));
  assert.equal(hash(index), snapshot.indexSha256);
  assert.ok(index.length < 1024 * 1024);
  assert.ok(
    Object.keys(snapshot.sourceFiles).every(
      (file) => file.includes('/assets/') && /\.(md|apx|json)$/.test(file) && !file.includes('SKILL.md'),
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
