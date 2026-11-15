import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, rm, symlink, utimes, writeFile, stat } from 'node:fs/promises';
import { canonical, hash, inventory } from '../../packages/core/src/fs.ts';

test('inventory keeps deterministic digests across nested files and streams large assets', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-inventory-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const expected: Record<string, string> = {};
  for (let i = 30; i >= 0; i--) {
    const name = `${i % 3}/page-${i}.apx`;
    const content = i === 0 ? Buffer.alloc(8 * 1024 * 1024, 97) : Buffer.from(`page ${i}`);
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), content);
    expected[name] = hash(content);
  }
  await writeFile(path.join(root, 'empty'), '');
  expected.empty = hash('');
  const actual = await inventory(root);
  assert.equal(canonical(actual), canonical(expected));
  assert.deepEqual(Object.keys(actual), Object.keys(expected).sort());
  const file = path.join(root, '1/page-1.apx');
  const before = await stat(file);
  await writeFile(file, 'page X');
  await utimes(file, before.atime, before.mtime);
  assert.equal((await inventory(root))['1/page-1.apx'], hash('page X'), 'same size/mtime is not a cache key');
});

test('inventory handles empty trees and rejects symlinks before reading their targets', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-inventory-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(await inventory(root), {});
  await symlink('absent', path.join(root, 'link'));
  await assert.rejects(inventory(root), { code: 'SYMLINK_NOT_ALLOWED' });
});
