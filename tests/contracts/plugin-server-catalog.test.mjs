import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('APEX 26.1 reusable catalog maps every current acceptance criterion without claiming execution', async () => {
  const catalog = JSON.parse(await readFile('tests/plugin-server/apex-26.1.cases.json', 'utf8'));
  const matrix = JSON.parse(await readFile('docs/acceptance.json', 'utf8'));
  assert.equal(catalog.apexRelease, '26.1.x');
  assert.match(catalog.extensionPolicy, /separate extension/);
  const ids = catalog.cases.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  const acceptance = new Set(matrix.criteria.map((c) => c.id));
  const covered = new Set();
  for (const c of catalog.cases) {
    assert.match(c.id, /^A261-\d{3}$/);
    assert.ok(c.steps.length && c.expected.length && c.evidence.length && c.authorization);
    assert.ok(['manual', 'harness'].includes(c.execution));
    assert.equal(c.status, undefined, 'Definitions must not pretend to be execution results.');
    for (const id of c.acceptance) {
      assert.ok(acceptance.has(id), `${c.id}: unknown acceptance ${id}`);
      covered.add(id);
    }
  }
  for (const id of acceptance) assert.ok(covered.has(id), `Missing scenario coverage: ${id}`);
});
