import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultCatalog,
  loadHarness,
  budgetKey,
  inspectResponse,
  regressionGate,
  prerequisite,
  readQualificationEnv,
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

test('legacy qualification ENV is literal and still rejects malformed or duplicate keys', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises'),
    os = await import('node:os'),
    path = await import('node:path');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qualification-env-')),
    file = path.join(dir, 'test.env');
  const helper = {
    readLocalEnv: async () => {
      throw Object.assign(new Error('synthetic notation'), { code: 'ENV_FILE_INVALID' });
    },
  };
  try {
    await writeFile(file, 'workspace:\n  name: TEST\n  password: $(not-executed)\n');
    const result = await readQualificationEnv(file, helper);
    assert.equal(result['workspace.password'], '$(not-executed)');
    await writeFile(file, 'workspace:\n  name: TEST\n  name: OTHER\n');
    await assert.rejects(readQualificationEnv(file, helper), /Duplicate/);
    await writeFile(file, 'not valid\n');
    await assert.rejects(readQualificationEnv(file, helper), /Unrecognized/);
    await assert.rejects(
      readQualificationEnv(file, {
        readLocalEnv: async () => {
          throw Object.assign(new Error('unsafe'), { code: 'ENV_FILE_UNSAFE' });
        },
      }),
      /unsafe/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
test(
  'harness subprocess timeout kills descendants that ignore TERM',
  { skip: process.platform === 'win32' },
  async () => {
    const { runProcess } = await import('../../scripts/lib/plugin-harness.mjs');
    const result = await runProcess('sh', ['-c', 'sh -c \'trap "" TERM; sleep 30\' & echo $!; wait'], {
      timeoutMs: 100,
    });
    assert.equal(result.timedOut, true);
    const pid = Number(result.stdout.trim());
    assert.ok(pid > 0);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  },
);
