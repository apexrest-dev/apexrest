import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { fixture } from '../fixtures/project.ts';
import { writeJson } from '../../packages/core/src/fs.ts';
import { openVerificationBrowser } from '../../packages/core/src/browser.ts';
import { PanelService } from '../../packages/core/src/panel.ts';
import { browserPreferences } from '../../packages/core/src/browser-preferences.ts';

async function setup(t: import('node:test').TestContext) {
  const { ctx } = await fixture();
  const before = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = path.join(ctx.root, '.apexrest/managed');
  await writeJson(path.join(process.env.APEXREST_HOME, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [ctx.root],
    grants: [],
  });
  ctx.config.environments.dev!.baseUrl = 'http://127.0.0.1:8080/ords/r/demo/home';
  t.after(async () => {
    if (before === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = before;
    await rm(ctx.root, { recursive: true, force: true });
  });
  const preferences = path.join(ctx.root, '.apexrest/panel/preferences.json');
  return { ctx, panel: new PanelService(ctx.root), preferences };
}

test('browser preferences default to Codex and ignore obsolete execution settings', async (t) => {
  const { ctx, panel, preferences } = await setup(t);
  assert.deepEqual(await browserPreferences(ctx.root), { browserMode: 'codex' });
  await writeJson(preferences, {
    executionMode: 'team',
    multiAgentEnabled: true,
    developers: 3,
    browserMode: 'host',
  });
  assert.deepEqual(await panel.preferences(), { browserMode: 'host' });
  await writeJson(preferences, { browserMode: 'codex' });
  assert.deepEqual((await panel.snapshot()).preferences, { browserMode: 'codex' });
});

test('Codex browser route requires a host action and never launches a system browser or claims verification', async (t) => {
  const { ctx } = await setup(t);
  const result = await openVerificationBrowser(ctx, 'dev');
  assert.equal(result.status, 'host_action_required');
  assert.equal(result.browserMode, 'codex');
  assert.equal(result.verified, false);
  assert.equal(result.url, ctx.config.environments.dev!.baseUrl);
});

test('host browser mode behaves like the Codex alias in every host', async (t) => {
  const { ctx, preferences } = await setup(t);
  await writeJson(preferences, { browserMode: 'host' });
  assert.deepEqual(await browserPreferences(ctx.root), { browserMode: 'host' });
  const result = await openVerificationBrowser(ctx, 'dev');
  assert.equal(result.status, 'host_action_required');
  assert.equal(result.browserMode, 'host');
  assert.equal(result.verified, false);
  assert.match(result.nextAction, /host-provided in-app browser/);
});

test('explicit browser selection takes precedence and invalid targets are never launched', async (t) => {
  const { ctx, preferences } = await setup(t);
  await writeJson(preferences, { browserMode: 'host' });
  const result = await openVerificationBrowser(ctx, 'dev', 'codex');
  assert.equal(result.browserMode, 'codex');
  ctx.config.environments.dev!.baseUrl = 'file:///etc/passwd';
  await assert.rejects(openVerificationBrowser(ctx, 'dev'), { code: 'ORIGIN_DENIED' });
  await assert.rejects(openVerificationBrowser(ctx, 'missing'), { code: 'UNKNOWN_ENVIRONMENT' });
});

test('external browser preferences are refused without launching a browser', async (t) => {
  const { ctx, preferences } = await setup(t);
  await writeJson(preferences, { browserMode: 'external' });
  await assert.rejects(openVerificationBrowser(ctx, 'dev'), { code: 'INVALID_INPUT' });
  assert.equal((await openVerificationBrowser(ctx, 'dev', 'host')).status, 'host_action_required');
});
