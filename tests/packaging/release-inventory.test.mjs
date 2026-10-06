import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { files } from '../../scripts/lib/release.mjs';

test('release inventory ignores local artifacts and sorts by code units while preserving host/source dotfiles', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-inventory-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ['z', 'B', 'a', '.DS_Store', '.env', 'debug.log', '.mcp.json'])
    await writeFile(path.join(root, name), 'fixture');
  await mkdir(path.join(root, '.apex'));
  await writeFile(path.join(root, '.apex/apexlang.json'), '{}');
  await mkdir(path.join(root, '.git'));
  await writeFile(path.join(root, '.git/config'), 'fixture');
  assert.deepEqual(await files(root), ['.apex/apexlang.json', '.mcp.json', 'B', 'a', 'z']);
});
