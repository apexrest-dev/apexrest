import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fixture } from '../fixtures/project.ts';
import { dispatch } from '../../packages/core/src/service.ts';
import { effectiveDecisionApi, recentProjects } from '../../packages/core/src/global-settings.ts';

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
  assert.equal('usage' in data.catalog, false);
  assert.equal('timings' in data, false);
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

test('turning the catalog off blocks reference tools', async (t) => {
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
  await dispatch('settings.configure', { catalog: 'on' });
  const search = await dispatch('docs.search', { query: 'interactive grid' });
  assert.equal(search.ok, true);
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

test('statistics files are no longer written and recent projects never create APEXREST_HOME', async (t) => {
  const dir = await home(t);
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  await dispatch('docs.search', { query: 'interactive grid' });
  await dispatch('project.inspect', { project: ctx.root });
  for (const file of ['catalog-usage.json', 'operation-timings.json'])
    await assert.rejects(readFile(path.join(dir, file)), file);
  process.env.APEXREST_HOME = path.join(dir, 'not-created');
  await dispatch('project.inspect', { project: ctx.root });
  await assert.rejects(readFile(path.join(dir, 'not-created', 'recent-projects.json')));
  process.env.APEXREST_HOME = dir;
  process.env.APEXREST_USAGE = '0';
  await rm(path.join(dir, 'recent-projects.json'), { force: true });
  await dispatch('project.inspect', { project: ctx.root });
  assert.deepEqual(await recentProjects(), []);
});
