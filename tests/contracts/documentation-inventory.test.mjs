import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { files } from '../../scripts/lib/release.mjs';

test('documentation excludes ignored evidence before inspecting its contents', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-doc-inventory-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of [
    'docs/evidence',
    'docs/guide',
    'site/content',
    'templates',
    'plugins/apexrest-apex/skills',
  ])
    await mkdir(path.join(root, directory), { recursive: true });
  for (const file of [
    'README.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'CHANGELOG.md',
    'AGENTS.md',
    'docs/index.md',
    'docs/guide/work.md',
    'docs/implementation-status.md',
    'docs/next-actions.md',
  ])
    await writeFile(path.join(root, file), '# Documentation\n');
  for (const [file, data] of Object.entries({
    'docs/acceptance.json': {},
    'package.json': { scripts: {} },
    'site/site.config.json': { basePath: '/apexrest/', pages: [] },
    'publisher.config.json': { siteOrigin: 'https://example.test' },
  }))
    await writeFile(path.join(root, file), JSON.stringify(data));
  // A junction works without symlink privileges on Windows and is still a link
  // to the release walker. Its target must never be traversed or removed.
  const target = path.join(root, 'docs', 'guide');
  await symlink(target, path.join(root, 'docs', 'evidence', 'private-tree'), 'junction');
  const result = spawnSync(process.execPath, [path.resolve('scripts/check-docs.mjs')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Documentation: 8 documents/);
});

test('release inventories still reject symlinks and exclusions match exact relative paths', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-release-inventory-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'evidence-copy'));
  await mkdir(path.join(root, 'content'));
  await writeFile(path.join(root, 'content', 'page.md'), '# Page\n');
  await symlink(path.join(root, 'content'), path.join(root, 'evidence-copy', 'linked'), 'junction');
  await assert.rejects(files(root), /Symlink in release source: evidence-copy\/linked/);
  await assert.rejects(files(root, '', ['evidence']), /Symlink in release source: evidence-copy\/linked/);
});
