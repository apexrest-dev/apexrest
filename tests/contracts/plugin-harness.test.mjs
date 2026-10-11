import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultCatalog,
  loadHarness,
  budgetKey,
  inspectResponse,
  regressionGate,
  prerequisite,
} from '../../scripts/lib/plugin-harness.mjs';

test('default harness selects the existing 26.1 catalog and refuses mismatches', async () => {
  const h = await loadHarness({});
  assert.equal(h.profile, '26.1');
  assert.ok(h.catalogFile.endsWith(defaultCatalog));
  assert.equal(
    (await loadHarness({ profile: '26.2', catalog: 'tests/plugin-server/apex-26.2.extensions.json' }))
      .profile,
    '26.2',
  );
  await assert.rejects(loadHarness({ profile: '26.2' }), /mismatch/);
});
test('fake MCP response budgets classify tool/action and separate size from failure', async () => {
  const { quality } = await loadHarness({});
  for (const [name, args, key] of [
    ['apexrest_project', { action: 'inspect', detail: 'summary' }, 'projectSummary'],
    ['apexrest_metadata_read', {}, 'metadataPageDefaultLimit'],
    ['apexrest_reference', { mode: 'search', limit: 3 }, 'referenceSearchLimit3'],
    ['apexrest_reference', { mode: 'read' }, 'referenceRead'],
    ['apexrest_ship', { mode: 'plan' }, 'plan'],
  ])
    assert.equal(budgetKey(name, args, { ok: true }), key);
  assert.equal(budgetKey('any', {}, { ok: false }), 'error');
  const r = inspectResponse(quality, 'apexrest_ship', { mode: 'plan' }, { ok: true, data: 'x'.repeat(9000) });
  assert.equal(r.overrun, true);
  assert.equal(r.stackTrace, false);
});
test('regression gates require quality and complete equal fingerprints', async () => {
  const { quality } = await loadHarness({}),
    b = { medianMs: 100, p95Ms: 200 },
    e = { machine: { a: 1 }, sqlcl: '26', target: 1 };
  assert.equal(regressionGate(quality, b, { medianMs: 125, p95Ms: 250 }, e, e, true).regression, true);
  assert.equal(regressionGate(quality, b, { medianMs: 105, p95Ms: 205 }, e, e, true).regression, false);
  assert.equal(regressionGate(quality, b, b, null, e, true).regression, 'not_comparable');
  assert.equal(regressionGate(quality, b, b, e, e, false).regression, 'not_comparable');
});
test('unmet P2 prerequisites are never skipped-success', () => {
  const d = { id: 'A261-053', prerequisite: 'P2 read pool required' };
  assert.equal(prerequisite(d), d.prerequisite);
  assert.equal(prerequisite(d, { readPool: true }), null);
  assert.equal(
    prerequisite({ id: 'A261-067', prerequisite: 'prewarm required' }, { readPool: true }),
    'prewarm required',
  );
});
