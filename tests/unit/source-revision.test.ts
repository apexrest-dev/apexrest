import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  recordRevision,
  revisionOf,
  revisionStatus,
  sourceChange,
  sourceRevision,
} from '../../packages/core/src/revision.ts';

const app = 'src/apex/crm';
const base = {
  [`${app}/application.apx`]: 'a1',
  [`${app}/pages/p00000-global-page.apx`]: 'g1',
  [`${app}/pages/p00007-orders.apx`]: 'o1',
  [`${app}/pages/p00010-customers.apx`]: 'c1',
  'src/database/migrations/0001__x.sql': 'm1',
};

test('a source revision is the canonical inventory digest, independent of key order', () => {
  const reversed = Object.fromEntries(Object.entries(base).reverse());
  assert.equal(revisionOf(base), revisionOf(reversed));
  assert.notEqual(revisionOf(base), revisionOf({ ...base, [`${app}/application.apx`]: 'a2' }));
  const revision = sourceRevision(base, { projectId: 'crm' });
  assert.match(revision.revision, /^[a-f0-9]{64}$/u);
  assert.notEqual(revision.configuration, sourceRevision(base, { projectId: 'other' }).configuration);
});

test('source changes name the exact files and the affected pages, or unknown scope', () => {
  const pageOnly = sourceChange(base, { ...base, [`${app}/pages/p00007-orders.apx`]: 'o2' }, app);
  assert.deepEqual(pageOnly.changedFiles, [`${app}/pages/p00007-orders.apx`]);
  assert.deepEqual(pageOnly.affectedPages, ['7']);
  assert.equal(pageOnly.previousRevision, revisionOf(base));

  const added = sourceChange(base, { ...base, [`${app}/pages/p00020-dashboard.apx`]: 'd1' }, app);
  assert.deepEqual(added.addedFiles, [`${app}/pages/p00020-dashboard.apx`]);
  assert.deepEqual(added.affectedPages, ['20']);

  const { [`${app}/pages/p00010-customers.apx`]: _removed, ...rest } = base;
  const renamed = sourceChange(base, { ...rest, [`${app}/pages/p00010-clients.apx`]: 'c1' }, app);
  assert.deepEqual(renamed.removedFiles, [`${app}/pages/p00010-customers.apx`]);
  assert.deepEqual(renamed.addedFiles, [`${app}/pages/p00010-clients.apx`]);
  assert.deepEqual(renamed.affectedPages, ['10']);

  // The global page, shared components, the application and database scripts affect every page.
  for (const file of [
    `${app}/pages/p00000-global-page.apx`,
    `${app}/application.apx`,
    'src/database/migrations/0001__x.sql',
  ])
    assert.equal(sourceChange(base, { ...base, [file]: 'changed' }, app).affectedPages, 'unknown', file);
  assert.equal(sourceChange(null, base, app).affectedPages, 'unknown');
  assert.deepEqual(sourceChange(base, base, app).affectedPages, []);
});

test('late results are kept with their own revision and never replace newer work', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-revision-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const a = revisionOf(base);
  const b = revisionOf({ ...base, [`${app}/pages/p00007-orders.apx`]: 'o2' });
  // Validation of B started later and finished first; the late result for A arrives afterwards.
  assert.equal(
    await recordRevision(root, 'validated', {
      revision: b,
      startedAt: '2026-11-22T10:00:05Z',
      finishedAt: '2026-11-22T10:00:07Z',
    }),
    true,
  );
  assert.equal(
    await recordRevision(root, 'validated', {
      revision: a,
      startedAt: '2026-11-22T10:00:01Z',
      finishedAt: '2026-11-22T10:00:09Z',
    }),
    false,
  );
  const latest = { revision: b, configuration: 'c' };
  let status = await revisionStatus(root, latest);
  assert.equal(status.validated?.revision, b);
  assert.equal(status.validated?.current, true);

  // Import of A is in progress; local B is newer: the import keeps A, nothing claims B deployed.
  await recordRevision(root, 'importing', {
    revision: a,
    startedAt: '2026-11-22T10:01:00Z',
    finishedAt: '2026-11-22T10:01:00Z',
    environment: 'dev',
    runId: 'run-a',
  });
  status = await revisionStatus(root, latest);
  assert.equal(status.importing.dev?.revision, a);
  assert.deepEqual(status.deployed, {});
  await recordRevision(root, 'deployed', {
    revision: a,
    startedAt: '2026-11-22T10:01:00Z',
    finishedAt: '2026-11-22T10:01:20Z',
    environment: 'dev',
    runId: 'run-a',
  });
  status = await revisionStatus(root, latest);
  assert.equal(status.importing.dev, undefined, 'a completed import ends');
  assert.equal(status.deployed.dev?.revision, a);
  assert.equal(status.deployed.dev?.current, false, 'deployed A is not the latest local B');

  // A failure of another, later run does not erase the confirmed deployment.
  await recordRevision(root, 'importing', {
    revision: b,
    startedAt: '2026-11-22T10:02:00Z',
    finishedAt: '2026-11-22T10:02:00Z',
    environment: 'dev',
    runId: 'run-b',
  });
  await recordRevision(root, 'failed', {
    revision: b,
    startedAt: '2026-11-22T10:02:00Z',
    finishedAt: '2026-11-22T10:02:10Z',
    environment: 'dev',
    runId: 'run-b',
    detail: { code: 'IMPORT_REJECTED' },
  });
  status = await revisionStatus(root, latest);
  assert.equal(status.deployed.dev?.revision, a);
  assert.equal(status.failed.dev?.detail?.code, 'IMPORT_REJECTED');
  assert.equal(status.importing.dev, undefined);
  assert.equal(status.preview, null);
});
