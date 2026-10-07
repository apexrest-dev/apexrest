import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { zipSync, strToU8 } from 'fflate';
import { hash } from '../../packages/core/src/fs.ts';

// Synthetic archives establish checker decisions, never Oracle release evidence.
test('upstream discovery reports new releases independently of unchanged inventory and reviews ancillary source/license drift', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-upstream-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'resources/references/26.2'), { recursive: true });
  await mkdir(path.join(root, 'toolchains'));
  const commit = 'a'.repeat(40),
    prefix = `skills-${commit}/`;
  const inventory = 'apexlang-inventory/assets/app/app.md';
  const catalog = 'apexlang-inventory/SKILL.md';
  const example = 'apexlang-example-applications/assets/example-0/.apex/apexlang.json';
  const source = {
    [inventory]: '# Synthetic app definition\n',
    [catalog]: 'Synthetic catalog\n',
    [example]: '{"mmdVersion":"26.2.0+3479"}\n',
  };
  const license = 'Synthetic license\n';
  await writeFile(
    path.join(root, 'resources/references/26.2/oracle-snapshot.json'),
    JSON.stringify({
      commit,
      release: '26.2',
      sourceFiles: Object.fromEntries(Object.entries(source).map(([name, text]) => [name, hash(text)])),
      licenseSha256: hash(license),
    }),
  );
  await writeFile(
    path.join(root, 'toolchains/compatibility.json'),
    JSON.stringify({ profiles: [{ apex: '26.1' }, { apex: '26.2' }] }),
  );
  const script = path.resolve('scripts/check-oracle-apexlang-upstream.mjs');
  async function check(
    extra: Record<string, string> = {},
    changed: Record<string, string> = {},
    licenseText = license,
  ) {
    const entries = Object.fromEntries(
      Object.entries({ ...source, ...changed }).map(([name, text]) => [
        prefix + 'apex/apexlang/26.2/' + name,
        strToU8(text),
      ]),
    );
    for (const [name, text] of Object.entries(extra)) entries[prefix + name] = strToU8(text);
    entries[prefix + 'LICENSE.txt'] = strToU8(licenseText);
    const archive = path.join(root, 'synthetic.zip');
    await writeFile(archive, zipSync(entries));
    const result = spawnSync(
      process.execPath,
      [script, '--archive', archive, '--commit', commit, '--out', path.join(root, 'report')],
      { cwd: root, encoding: 'utf8', timeout: 30000 },
    );
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(await readFile(path.join(root, 'report/upstream.json'), 'utf8'));
  }
  const current = await check();
  assert.equal(current.inventoryStatus, 'inventory-content-current');
  assert.equal(current.status, 'bundled-26.2-source-current');
  const next = await check({
    'apex/apexlang/26.3/apexlang-inventory/assets/app/app.md': 'Synthetic future release\n',
  });
  assert.equal(next.inventoryStatus, 'inventory-content-current');
  assert.equal(next.status, 'new-release-review-required');
  assert.deepEqual(next.releaseDiscovery.newerVersions, ['26.3']);
  assert.deepEqual(next.releaseDiscovery.unbundledVersions, ['26.3']);
  const ancillary = await check(
    {},
    { [catalog]: 'Changed synthetic catalog', [example]: '{"mmdVersion":"26.2.0+9999"}' },
    'Changed synthetic license',
  );
  assert.equal(ancillary.inventoryStatus, 'inventory-content-current');
  assert.equal(ancillary.status, 'bundled-source-review-required');
  assert.deepEqual(ancillary.bundledSourceChanges, [example, catalog].sort());
  assert.equal(ancillary.licenseChanged, true);
});
