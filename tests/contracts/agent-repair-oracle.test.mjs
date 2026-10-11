import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { repairedSourceMatches } from '../../scripts/lib/agent-repair-oracle.mjs';
test('repair permits trailing whitespace but rejects retained fault and other source edits', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'repair-oracle-')),
    a = path.join(root, 'a'),
    b = path.join(root, 'b');
  try {
    await mkdir(a);
    await mkdir(b);
    await writeFile(path.join(b, 'page.apx'), '  name: Home\n');
    await writeFile(path.join(a, 'page.apx'), '  name: Home  \r\n\r\n');
    assert.equal(await repairedSourceMatches(a, b), true);
    await writeFile(path.join(a, 'page.apx'), ' name: Home\n');
    assert.equal(await repairedSourceMatches(a, b), false);
    await writeFile(path.join(a, 'page.apx'), '  name: Other\n');
    assert.equal(await repairedSourceMatches(a, b), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
