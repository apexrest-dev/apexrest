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

test('quality/performance extension catalogs stay definitions with valid acceptance mappings', async () => {
  const read = async (file) => JSON.parse(await readFile(`tests/plugin-server/${file}`, 'utf8'));
  const matrix = await read('../../docs/acceptance.json');
  const acceptance = new Set(matrix.criteria.map((c) => c.id));
  const metrics = await read('quality-performance.json');
  const catalogs = [
    ['apex-26.1.cases.json', 'cases', /^A261-\d{3}$/],
    ['apex-26.2.extensions.json', 'cases', /^A262-\d{3}$/],
    ['agent-tasks.cases.json', 'tasks', /^AGT-\d{3}$/],
    ['host-codex.cases.json', 'cases', /^HCX-\d{3}$/],
    ['host-claude.cases.json', 'cases', /^HCL-\d{3}$/],
    ['scenario-bitcoin-dashboard.json', 'checks', /^BTC-\d{3}$/],
  ];
  const all = new Set();
  for (const [file, key, pattern] of catalogs) {
    assert.ok(metrics.appliesTo.includes(file), `${file} not covered by quality-performance.json`);
    const catalog = await read(file);
    assert.equal(catalog.metrics, 'quality-performance.json', file);
    for (const c of catalog[key]) {
      assert.match(c.id, pattern);
      assert.ok(!all.has(c.id), `duplicate ${c.id}`);
      all.add(c.id);
      assert.ok(c.title && c.authorization && c.expected.length && c.evidence.length, c.id);
      assert.ok(c.acceptance.length, `${c.id}: no acceptance mapping`);
      assert.equal(c.status, undefined, `${c.id}: definitions must not pretend to be execution results`);
      for (const id of c.acceptance) assert.ok(acceptance.has(id), `${c.id}: unknown acceptance ${id}`);
      if (c.category) assert.ok(['speed', 'quality', 'speed+quality'].includes(c.category), c.id);
    }
  }
  const a262 = await read('apex-26.2.extensions.json');
  assert.equal(a262.apexRelease, '26.2.x');
  assert.match(a262.isolationPolicy, /Never count 26\.2 results as 26\.1/);
  const btc = await read('scenario-bitcoin-dashboard.json');
  const phases = new Set(btc.phases.map((p) => p.id));
  assert.equal(btc.checks.filter((c) => c.phase === 'P7' && c.dashboard).length, 10, 'ten dashboards');
  for (const c of btc.checks) {
    assert.ok(phases.has(c.phase), `${c.id}: unknown phase`);
    assert.equal(typeof c.critical, 'boolean', c.id);
  }
  for (const b of metrics.baselines) assert.ok(['26.1', '26.2'].includes(b.profile) && b.samples > 0);
});
