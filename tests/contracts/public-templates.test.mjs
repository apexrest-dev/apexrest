import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkPublicTemplateCatalog } from '../../scripts/build-public-template-catalog.mjs';
import { sha256 } from '../../scripts/lib/release.mjs';

const root = path.resolve('resources/public-templates/26.2');
const prefix = 'oracle:26.2:public-template/';
const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const json = (value) => JSON.stringify(value, null, 2) + '\n';

test('public library retains all 1350 source pages and 33 dependency inventories with pinned provenance', async () => {
  assert.deepEqual(await checkPublicTemplateCatalog(root), {
    status: 'verified',
    applications: 33,
    pageTemplates: 1350,
    records: 1384,
  });
  const [manifest, index, lock] = await Promise.all([
    readJson('manifest.json'),
    readJson('index.json'),
    readJson('source-lock.json'),
  ]);
  assert.equal(lock.source.repository, 'https://github.com/oracle/apex');
  assert.equal(lock.source.commit, 'fbe095e4c6e783b3fa930ffae927e4826e549190');
  assert.equal(lock.source.license, 'UPL-1.0');
  assert.match(lock.source.archiveSha256, /^[a-f0-9]{64}$/);
  assert.equal(lock.apps.length, 33);
  assert.equal(new Set(lock.apps.map((app) => app.id)).size, 33);
  assert.equal(index.filter((entry) => entry.kind === 'template').length, 1350);
  const byId = new Map(index.map((entry) => [entry.id, entry]));
  for (const app of lock.apps) {
    const guide = byId.get(prefix + app.id + '/dependencies');
    assert.equal(guide.kind, 'guide');
    assert.equal(guide.related.length, app.includedPages);
    assert.equal(app.mmdVersion, '26.2.0+3479');
    assert.ok(app.sourceFiles.includes('.apex/apexlang.json'));
    assert.ok(app.sourceFiles.some((file) => file.startsWith('shared-components/')));
  }
  for (const entry of index) {
    assert.equal(entry.readiness, 'reference');
    assert.deepEqual(entry.compatibility, {
      apexVersion: '26.2',
      themeVersion: '26.2',
      mmdVersion: '26.2.0+3479',
    });
    assert.equal(entry.sha256, manifest.files[entry.document]);
    if (entry.kind !== 'template') continue;
    const source = lock.pages[entry.id];
    assert.ok(source, entry.id);
    assert.equal(entry.source, `${lock.source.repository}/blob/${lock.source.commit}/${source.path}`);
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(entry.requires, [prefix + source.application + '/dependencies']);
    const id = Number(path.basename(source.path).slice(1, 6));
    assert.ok(id > 0 && id < 9999, source.path);
  }
  assert.match(await readFile(path.join(root, 'ORACLE-LICENSE.txt'), 'utf8'), /Universal Permissive License/);
});

async function compactFixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'apexrest-public-template-contract-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const [originalIndex, originalLock, originalManifest] = await Promise.all([
    readJson('index.json'),
    readJson('source-lock.json'),
    readJson('manifest.json'),
  ]);
  const page = originalIndex.find((entry) => entry.kind === 'template');
  const source = originalLock.pages[page.id];
  // Keep the 33 application declarations, their small guides and one page; no full catalog copy.
  const index = originalIndex
    .filter((entry) => entry.id === page.id || entry.id.endsWith('/dependencies'))
    .map((entry) => ({ ...entry, related: entry.related.filter((id) => id === page.id) }));
  const lock = {
    ...originalLock,
    apps: originalLock.apps.map((app) => ({ ...app, includedPages: app.id === source.application ? 1 : 0 })),
    pages: { [page.id]: source },
  };
  const documents = Object.fromEntries(
    await Promise.all(
      index.map(async (entry) => [entry.document, await readFile(path.join(root, entry.document), 'utf8')]),
    ),
  );
  documents['ORACLE-LICENSE.txt'] = await readFile(path.join(root, 'ORACLE-LICENSE.txt'), 'utf8');
  const baseline = { index, lock, documents };
  async function save(value = structuredClone(baseline), changeManifest = () => {}) {
    const content = {
      ...value.documents,
      'index.json': json(value.index),
      'source-lock.json': json(value.lock),
    };
    const manifest = {
      ...originalManifest,
      generatorSha256: sha256(await readFile('scripts/build-public-template-catalog.mjs')),
      indexSha256: sha256(content['index.json']),
      files: Object.fromEntries(Object.entries(content).map(([file, text]) => [file, sha256(text)])),
      counts: { applications: 33, pageTemplates: 1, records: value.index.length },
    };
    changeManifest(manifest);
    for (const [file, text] of Object.entries({ ...content, 'manifest.json': json(manifest) })) {
      await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
      await writeFile(path.join(directory, file), text);
    }
  }
  await save();
  return { directory, page, baseline, save };
}

test('public catalog checker rejects document/index tampering and unregistered files', async (t) => {
  const fixture = await compactFixture(t);
  const { directory, page, save } = fixture;
  assert.equal((await checkPublicTemplateCatalog(directory)).pageTemplates, 1);
  await writeFile(path.join(directory, page.document), 'tampered');
  await assert.rejects(checkPublicTemplateCatalog(directory), /content checksum mismatch/);
  await save();
  await writeFile(path.join(directory, 'index.json'), '[]');
  await assert.rejects(checkPublicTemplateCatalog(directory), /index checksum mismatch/);
  await save();
  for (const file of ['extra.txt', '.env', '.env.local', '.cache/private.json']) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await writeFile(path.join(directory, file), 'unregistered fixture data');
    await assert.rejects(
      checkPublicTemplateCatalog(directory),
      /Unexpected or missing/,
      `Exact catalog membership must reject ${file}, including paths omitted by release packaging helpers.`,
    );
    await rm(path.join(directory, file));
  }
});

test('public source hashes, attribution, page membership and application counts remain checked after manifest rehash', async (t) => {
  const { directory, page, baseline, save } = await compactFixture(t);
  const variants = [
    {
      reason: 'pinned attribution',
      change(value) {
        value.index.find((entry) => entry.id === page.id).source += '?unreviewed=1';
      },
      error: /Incorrect attribution/,
    },
    {
      reason: 'original source bytes',
      change(value) {
        value.documents[page.document] = value.documents[page.document].replace(
          /(\n`{4,}apexlang\n)/,
          '$1// changed upstream source\n',
        );
        value.index.find((entry) => entry.id === page.id).sha256 = sha256(value.documents[page.document]);
      },
      error: /Original APEXlang source checksum mismatch/,
    },
    {
      reason: 'source lock to template bijection',
      change(value) {
        value.lock.pages[prefix + 'missing/p00001-page'] = value.lock.pages[page.id];
        delete value.lock.pages[page.id];
      },
      error: /source coverage mismatch/,
    },
    {
      reason: 'application membership',
      change(value) {
        value.lock.pages[page.id].application = 'missing-application';
      },
      error: /membership mismatch|Unknown public template application/,
    },
    {
      reason: 'required dependency resolution',
      change(value) {
        value.index.find((entry) => entry.id === page.id).requires = [prefix + 'missing/dependencies'];
      },
      error: /Invalid public template record/,
    },
  ];
  for (const variant of variants) {
    const value = structuredClone(baseline);
    variant.change(value);
    await save(value);
    await assert.rejects(checkPublicTemplateCatalog(directory), variant.error, variant.reason);
  }
  await save(structuredClone(baseline), (manifest) => {
    manifest.counts.applications = 34;
  });
  await assert.rejects(checkPublicTemplateCatalog(directory), /application or page source coverage mismatch/);
  await save(structuredClone(baseline), (manifest) => {
    manifest.source.commit = '0'.repeat(40);
  });
  await assert.rejects(checkPublicTemplateCatalog(directory), /source pin changed/);
});
