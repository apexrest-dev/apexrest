import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseObservation,
  extractSelected,
  type ExportProfile,
} from '../../packages/core/src/export-strategy.ts';

const page = 'pages/p00010-customers.apx';
const pages = Array.from({ length: 6 }, (_, i) => `pages/p0002${i}-page.apx`);
const profile = (change: Partial<ExportProfile> = {}): ExportProfile => ({
  schemaVersion: 1,
  targetDigest: 't',
  applicationId: 100,
  apexVersion: '26.2.0',
  compilerVersion: '26.3.0',
  pageExportMs: 900,
  fullExportMs: 3000,
  measuredAt: new Date('2026-11-20T10:00:00Z').toISOString(),
  source: 'scripts/bench/fast-dev.ts',
  ...change,
});
const choose = (files: string[], found?: ExportProfile, status: 'missing' | 'unreadable' = 'missing') =>
  chooseObservation({
    files,
    targetDigest: 't',
    applicationId: 100,
    apexVersion: '26.2.0',
    compilerVersion: '26.3.0',
    profile: found
      ? { status: 'found', relative: '.apexrest/export-profiles/t.json', profile: found }
      : { status, relative: '.apexrest/export-profiles/t.json' },
    now: Date.parse('2026-11-25T10:00:00Z'),
  });

test('a usable profile chooses the cheaper observation and records its provenance', () => {
  const few = choose([page], profile());
  assert.equal(few.exportScope, 'selected');
  assert.equal(few.strategy, 'page-exports');
  const many = choose(pages, profile());
  assert.equal(many.exportScope, 'full');
  assert.equal(many.strategy, 'full-export-extraction');
  assert.deepEqual(many.provenance, {
    kind: 'profile',
    file: '.apexrest/export-profiles/t.json',
    measuredAt: '2026-11-20T10:00:00.000Z',
    pageExportMs: 900,
    fullExportMs: 3000,
    estimatedPageExportsMs: 5400,
  });
  assert.match(many.reason, /6 page export\(s\) estimated at 5400 ms against one full export at 3000 ms/u);
});

test('missing, unreadable, stale or incompatible measurements fall back to per-page exports', () => {
  const fallback = (result: ReturnType<typeof choose>) => [result.exportScope, result.provenance];
  assert.deepEqual(fallback(choose(pages)), ['selected', { kind: 'fallback', profile: 'missing' }]);
  assert.deepEqual(fallback(choose(pages, undefined, 'unreadable')), [
    'selected',
    { kind: 'fallback', profile: 'unreadable' },
  ]);
  assert.deepEqual(fallback(choose(pages, profile({ measuredAt: '2026-09-01T00:00:00Z' }))), [
    'selected',
    { kind: 'fallback', profile: 'stale' },
  ]);
  for (const change of [
    { targetDigest: 'other' },
    { applicationId: 101 },
    { apexVersion: '26.1.0' },
    { compilerVersion: '25.4' },
  ])
    assert.deepEqual(fallback(choose(pages, profile(change))), [
      'selected',
      { kind: 'fallback', profile: 'incompatible' },
    ]);
  // Shared components are always observed in full, whatever the profile says.
  const shared = choose([page, 'shared-components/lovs/status.apx'], profile());
  assert.deepEqual([shared.exportScope, shared.provenance], ['full', { kind: 'required' }]);
});

test('full-export extraction yields exactly the artifacts of per-page exports', () => {
  // The server application: a renamed page alias, an unrelated page, a shared component.
  const server: Record<string, string> = {
    'pages/p00010-clients.apx': 'page 10 content',
    'pages/p00011-other.apx': 'unrelated page',
    'shared-components/lovs/status.apx': 'lov',
    'application.apx': 'app',
  };
  const selection = [page, 'pages/p00099-new.apx', 'shared-components/lovs/status.apx'];
  // Per-page export semantics: each selected page that exists on the server, under its reviewed
  // name; an absent (new) page has no previous source.
  const perPage = Object.fromEntries(
    selection
      .filter((file) => file.startsWith('pages/'))
      .flatMap((file) => {
        const id = /^pages\/p(\d{5})/u.exec(file)![1];
        const found = Object.keys(server).find((candidate) => candidate.startsWith(`pages/p${id}`));
        return found ? [[file, server[found]!]] : [];
      }),
  );
  const picked = extractSelected(server, selection);
  assert.deepEqual(picked, {
    [page]: 'pages/p00010-clients.apx',
    'shared-components/lovs/status.apx': 'shared-components/lovs/status.apx',
  });
  const extractedPages = Object.fromEntries(
    Object.entries(picked)
      .filter(([file]) => file.startsWith('pages/'))
      .map(([file, source]) => [file, server[source]!]),
  );
  assert.deepEqual(extractedPages, perPage);
  assert.equal('pages/p00011-other.apx' in picked || 'application.apx' in picked, false, 'nothing unrelated');
  assert.throws(() => extractSelected({ 'pages/p00010-a.apx': 'a', 'pages/p00010-b.apx': 'b' }, [page]));
});
