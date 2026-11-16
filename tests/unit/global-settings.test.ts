import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fixture } from '../fixtures/project.ts';
import { dispatch } from '../../packages/core/src/service.ts';
import {
  catalogUsage,
  effectiveDecisionApi,
  operationTimings,
  recordOperationTiming,
  recordCatalogUse,
  recentProjects,
} from '../../packages/core/src/global-settings.ts';

async function home(t: import('node:test').TestContext) {
  const dir = await mkdtemp(path.join(tmpdir(), 'apexrest-settings-'));
  const before = { home: process.env.APEXREST_HOME, usage: process.env.APEXREST_USAGE };
  process.env.APEXREST_HOME = dir;
  delete process.env.APEXREST_USAGE;
  t.after(async () => {
    if (before.home === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = before.home;
    if (before.usage === undefined) delete process.env.APEXREST_USAGE;
    else process.env.APEXREST_USAGE = before.usage;
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}

test('global settings default to local selection with the catalog on', async (t) => {
  await home(t);
  const result = await dispatch('settings.status', {});
  assert.equal(result.ok, true);
  const data = result.data as Record<string, any>;
  assert.deepEqual(data.settings, { schemaVersion: 1 });
  assert.equal(data.decisionApi.enabled, false);
  assert.equal(data.catalog.enabled, true);
  assert.ok(data.catalog.components > 0);
  assert.deepEqual(data.catalog.usage.total, {
    search: 0,
    read: 0,
    select: 0,
    decisions: 0,
    inputTokens: 0,
    cachedTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    apiMs: 0,
    apiCalls: 0,
  });
  assert.deepEqual(data.timings, []);
  assert.deepEqual(data.recentProjects, []);
});

test('settings configure writes a strict file and keeps unrelated settings', async (t) => {
  const dir = await home(t);
  assert.equal((await dispatch('settings.configure', {})).ok, false);
  await dispatch('settings.configure', { decisionApi: 'on', apiKeyEnv: 'MY_KEY' });
  const result = await dispatch('settings.configure', { catalog: 'off' });
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'settings.json'), 'utf8')), {
    schemaVersion: 1,
    decisionApi: { enabled: true, apiKeyEnv: 'MY_KEY', timeoutMs: 3000 },
    catalog: { enabled: false },
  });
  const bad = await dispatch('settings.configure', { decisionTimeoutMs: 20000 });
  assert.equal(bad.ok, false);
  await writeFile(path.join(dir, 'settings.json'), JSON.stringify({ schemaVersion: 1, extra: true }));
  assert.equal((await dispatch('settings.status', {})).ok, false);
});

test('a project decisionApi overrides the global default', async (t) => {
  await home(t);
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  assert.deepEqual(await effectiveDecisionApi(ctx), { source: 'default' });
  await dispatch('settings.configure', { decisionApi: 'on' });
  const global = await effectiveDecisionApi(ctx);
  assert.equal(global.source, 'global');
  assert.equal(global.settings?.enabled, true);
  ctx.config.decisionApi = { enabled: false, apiKeyEnv: 'OPENAI_API_KEY', timeoutMs: 3000 };
  const project = await effectiveDecisionApi(ctx);
  assert.equal(project.source, 'project');
  assert.equal(project.settings?.enabled, false);
});

test('turning the catalog off blocks reference tools without counting them', async (t) => {
  await home(t);
  await dispatch('settings.configure', { catalog: 'off' });
  for (const [operation, input] of [
    ['docs.search', { query: 'interactive grid' }],
    ['docs.read', { id: 'anything' }],
    ['reference', { mode: 'search', query: 'interactive grid' }],
  ] as const) {
    const result = await dispatch(operation, input);
    assert.equal(result.ok, false, operation);
    assert.equal(result.diagnostics[0]?.code, 'CATALOG_DISABLED', operation);
  }
  assert.equal((await catalogUsage()).total.search, 0);
  await dispatch('settings.configure', { catalog: 'on' });
  const search = await dispatch('docs.search', { query: 'interactive grid' });
  assert.equal(search.ok, true);
  assert.equal((await catalogUsage()).total.search, 1);
});

test('catalog usage keeps totals and a 30-day window', async (t) => {
  await home(t);
  const start = Date.parse('2026-10-01T12:00:00Z');
  for (let i = 0; i < 35; i++) await recordCatalogUse('read', false, new Date(start + i * 86400000));
  await recordCatalogUse('select', true, new Date(start + 34 * 86400000));
  const usage = await catalogUsage(new Date(start + 34 * 86400000));
  assert.deepEqual(
    [usage.total.search, usage.total.read, usage.total.select, usage.total.decisions],
    [0, 35, 1, 1],
  );
  assert.deepEqual(
    [usage.today.search, usage.today.read, usage.today.select, usage.today.decisions],
    [0, 1, 1, 1],
  );
  assert.equal(usage.last7Days.read, 7);
  process.env.APEXREST_USAGE = '0';
  await recordCatalogUse('search');
  assert.equal((await catalogUsage()).total.search, 0);
  assert.equal((await catalogUsage()).recording, false);
});

test('successful project operations set the current project; status reads do not', async (t) => {
  await home(t);
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  await dispatch('panel.status', { project: ctx.root });
  assert.deepEqual(await recentProjects(), []);
  const inspected = await dispatch('project.inspect', { project: ctx.root });
  assert.equal(inspected.ok, true);
  const recent = await recentProjects();
  assert.equal(recent.length, 1);
  assert.equal(recent[0]!.path, ctx.root);
  assert.equal(recent[0]!.projectId, 'fixture');
});

test('Decisions token use and API time add up per day and in total', async (t) => {
  await home(t);
  const at = new Date('2026-11-16T10:00:00Z');
  await recordCatalogUse('select', true, at, {
    inputTokens: 1200,
    cachedTokens: 800,
    outputTokens: 40,
    totalTokens: 1240,
    apiMs: 900,
  });
  await recordCatalogUse('select', false, at, {
    inputTokens: 0,
    cachedTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    apiMs: 3000,
  });
  await recordCatalogUse('search', false, at);
  const usage = await catalogUsage(at);
  assert.equal(usage.total.totalTokens, 1240);
  assert.equal(usage.today.cachedTokens, 800);
  assert.equal(usage.last7Days.outputTokens, 40);
  assert.equal(usage.total.apiCalls, 2);
  assert.equal(usage.total.apiMs, 3900);
  assert.equal(usage.total.select, 2);
  assert.equal(usage.total.decisions, 1);
});

test('operations are timed; composite routes and status reads are not', async (t) => {
  await home(t);
  await dispatch('reference', { mode: 'search', query: 'interactive grid' });
  await dispatch('settings.status', {});
  await dispatch('docs.read', { id: 'no-such-reference' });
  const timings = await operationTimings();
  assert.deepEqual(timings.map((x) => x.operation).sort(), ['docs.read', 'docs.search']);
  const read = timings.find((x) => x.operation === 'docs.read')!;
  assert.equal(read.count, 1);
  assert.equal(read.failed, 1);
  assert.equal(read.lastOk, false);
  await recordOperationTiming('apex.validate', 4000, true, 3000, new Date('2026-11-16T10:00:00Z'));
  await recordOperationTiming('apex.validate', 2000, true, 1000, new Date('2026-11-16T10:01:00Z'));
  await recordOperationTiming('Bad Name', 1, true);
  const validate = (await operationTimings()).find((x) => x.operation === 'apex.validate')!;
  assert.deepEqual(
    {
      count: validate.count,
      averageMs: validate.averageMs,
      maxMs: validate.maxMs,
      lastMs: validate.lastMs,
      sqlcl: validate.averageSqlclMs,
    },
    { count: 2, averageMs: 3000, maxMs: 4000, lastMs: 2000, sqlcl: 2000 },
  );
  assert.equal((await dispatch('settings.status', {})).ok, true);
  assert.ok(((await dispatch('settings.status', {})).data as { timings: unknown[] }).timings.length >= 3);
});

test('local records never create APEXREST_HOME and skip dry runs', async (t) => {
  const dir = await home(t);
  const missing = path.join(dir, 'not-created');
  process.env.APEXREST_HOME = missing;
  await recordOperationTiming('apex.validate', 10, true);
  await recordCatalogUse('search');
  await assert.rejects(readFile(path.join(missing, 'operation-timings.json')));
  process.env.APEXREST_HOME = dir;
  await dispatch('docs.sync', { version: '26.2', dryRun: true });
  assert.deepEqual(await operationTimings(), []);
});
