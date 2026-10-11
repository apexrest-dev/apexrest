import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('26.2 golden queries trace every expected ID to the pinned corpus', async () => {
  const golden = JSON.parse(await readFile('tests/plugin-server/reference-golden-26.2.json', 'utf8'));
  const index = JSON.parse(await readFile('resources/references/26.2/index.json', 'utf8'));
  assert.equal(golden.profile, '26.2');
  assert.ok(golden.queries.length >= 20);
  for (const query of golden.queries) {
    assert.ok(query.query);
    for (const id of query.expectedIds) {
      const entry = index.find((e) => e.id === id);
      assert.ok(entry);
      assert.equal(query.trace.entryId, id);
      assert.equal(query.trace.sha256, entry.sha256);
      assert.equal(query.trace.source, entry.source);
    }
  }
});
