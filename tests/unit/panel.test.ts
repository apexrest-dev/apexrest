import test from 'node:test';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { connect } from 'node:net';
import { rm, symlink, mkdtemp, mkdir, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fixture } from '../fixtures/project.ts';
import { readJson, writeJson } from '../../packages/core/src/fs.ts';
import { PanelService } from '../../packages/core/src/panel.ts';
import { startPanelServer, panelDocument, openPanel } from '../../packages/core/src/panel-server.ts';
import { panelActionSchema } from '../../packages/core/src/panel-schema.ts';
import { sqlclConfig } from '../../packages/core/src/sqlcl-config.ts';
import { dispatch } from '../../packages/core/src/service.ts';
import { exists } from '../../packages/core/src/fs.ts';
import { panelLines } from '../../packages/cli/src/panel-tui.ts';
import { schemas } from '../../packages/core/src/operations.ts';

async function setup(t: import('node:test').TestContext, trusted = true) {
  const { ctx } = await fixture(),
    before = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = path.join(ctx.root, 'managed');
  await writeJson(path.join(process.env.APEXREST_HOME, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: trusted ? [ctx.root] : [],
    grants: [],
  });
  t.after(async () => {
    if (before === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = before;
    await rm(ctx.root, { recursive: true, force: true });
  });
  return { ctx, service: new PanelService(ctx.root) };
}
test('panel preserves failed results and unknown workers, redacts secrets and reports effective settings', async (t) => {
  const { ctx, service } = await setup(t);
  const failed = randomUUID(),
    stale = randomUUID();
  await writeJson(path.join(ctx.root, '.apexrest/jobs', failed, 'state.json'), {
    status: 'completed',
    updatedAt: new Date().toISOString(),
    result: { operation: 'apex.validate', status: 'failed', summary: 'password=hidden' },
  });
  await writeJson(path.join(ctx.root, '.apexrest/jobs', stale, 'state.json'), {
    operation: 'test.run',
    status: 'running',
    updatedAt: new Date(0).toISOString(),
  });
  const s = await service.snapshot();
  assert.equal(s.jobs.find((j) => j.id === failed)?.status, 'failed');
  assert.equal(s.jobs.find((j) => j.id === stale)?.status, 'outcome_unknown');
  assert.ok(!JSON.stringify(s).includes('hidden'));
  assert.deepEqual(s.permissions.activeGrants, []);
  assert.equal(s.configuration?.environments.dev?.applicationId, 123);
  assert.ok(panelLines(s, 1).some((line) => line.includes('failed')));
});
test('panel trust and action allowlist cannot be bypassed; saved preferences round-trip without granting trust', async (t) => {
  const { ctx, service } = await setup(t, false);
  await assert.rejects(
    service.act({
      kind: 'preferences',
      settings: { browserMode: 'external' },
    }),
    /trust/i,
  );
  await writeJson(path.join(process.env.APEXREST_HOME!, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [ctx.root],
    grants: [],
  });
  await service.act({
    kind: 'preferences',
    settings: { browserMode: 'external' },
  });
  assert.equal((await service.snapshot()).preferences.browserMode, 'external');
  await service.act({ kind: 'preferences', settings: {} });
  assert.equal((await service.snapshot()).preferences.browserMode, 'external');
  assert.deepEqual(await readJson(path.join(ctx.root, '.apexrest/panel/preferences.json')), {
    browserMode: 'external',
  });
  assert.equal(schemas['panel.status'].safeParse({ team: randomUUID() }).success, false);
});
test('panel saves plugin ORDS settings, preserves direct connections, and never returns passwords', async (t) => {
  const { service } = await setup(t);
  await service.act({ kind: 'connection', name: 'dev-read', sqlclName: 'direct-read' });
  const result = await service.act({
    kind: 'connection',
    name: 'dev-read',
    ordsUrl: 'https://example.test/ords/app/',
    ordsUsername: 'app',
    password: 'local-test-secret',
  });
  await service.act({
    kind: 'sqlcl',
    settings: { schemaVersion: 1, mode: 'cli', databaseTransport: 'ords', mcpRestrictLevel: '4' },
  });
  const snapshot = await service.snapshot();
  assert.equal(snapshot.sqlcl.databaseTransport, 'ords');
  assert.equal(snapshot.connections['dev-read']?.name, 'direct-read');
  assert.deepEqual(snapshot.connections['dev-read']?.ords, {
    url: 'https://example.test/ords/app/',
    username: 'app',
  });
  assert.doesNotMatch(JSON.stringify({ result, snapshot }), /local-test-secret/);
  assert.ok(panelLines(snapshot, 2).includes('Database network: ORDS HTTP(S)'));
  await service.act({
    kind: 'connection',
    name: 'dev-read',
    ordsUrl: 'https://example.test/ords/app/',
    ordsUsername: 'app',
  });
  await assert.rejects(
    service.act({
      kind: 'connection',
      name: 'dev-read',
      ordsUrl: 'https://other.test/ords/app/',
      ordsUsername: 'app',
    }),
    /credential|password|match|changed/i,
  );
});
test('panel loads saved SQLcl names only on an explicit trusted action', async (t) => {
  const { ctx } = await setup(t, false);
  let calls = 0;
  let failure = false;
  const saved = { source: 'sqlcl-store', connections: [{ name: 'Dev / Київ' }, { name: 'QA exact name' }] };
  const service = new PanelService(ctx.root, {
    savedConnections: async () => {
      calls++;
      if (failure) throw new Error('SQLcl fixture unavailable');
      return saved;
    },
  });
  assert.equal(
    schemas['panel.action'].safeParse({ project: ctx.root, action: { kind: 'saved-connections' } }).success,
    true,
  );
  assert.equal(
    schemas['panel.action'].safeParse({ action: { kind: 'saved-connections', password: 'forbidden' } })
      .success,
    false,
  );
  await service.snapshot();
  assert.equal(calls, 0);
  await assert.rejects(service.act({ kind: 'saved-connections' }), { code: 'PROJECT_TRUST_REQUIRED' });
  assert.equal(calls, 0);
  await writeJson(path.join(process.env.APEXREST_HOME!, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [ctx.root],
    grants: [],
  });
  assert.deepEqual(await service.act({ kind: 'saved-connections' }), saved);
  assert.equal(calls, 1);
  await service.snapshot();
  assert.equal(calls, 1, 'Status polling must not read the SQLcl store');
  failure = true;
  await assert.rejects(service.act({ kind: 'saved-connections' }), /SQLcl fixture unavailable/);
  assert.equal(calls, 2);
});
test('panel HTTP rejects unauthenticated, foreign-origin and unlisted mutations; no arbitrary file serving', async (t) => {
  const { ctx } = await setup(t),
    handle = await startPanelServer(ctx.root);
  t.after(() => handle.close());
  const base = `http://127.0.0.1:${handle.session.port}`,
    headers = { Authorization: 'Bearer ' + handle.session.token };
  assert.equal((await fetch(base + '/api/status')).status, 401);
  assert.equal(
    (await fetch(base + '/api/status', { headers: { ...headers, Origin: 'https://outside.invalid' } }))
      .status,
    403,
  );
  const foreignHost = await new Promise<number | undefined>((resolve, reject) => {
    const req = request(base + '/api/status', { headers: { ...headers, Host: 'outside.invalid' } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.end();
  });
  assert.equal(foreignHost, 403);
  assert.equal((await fetch(base + '/api/status', { headers })).status, 200);
  assert.equal((await fetch(base + '/apexrest.json', { headers })).status, 404);
  const post = (action: unknown) =>
    fetch(base + '/api/action', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    });
  assert.equal((await post({ kind: 'deploy.apply', approved: true })).status, 400);
  assert.equal((await post({ kind: 'preferences', settings: { developers: 9 } })).status, 400);
  assert.equal(
    (
      await post({
        kind: 'preferences',
        settings: { browserMode: 'external' },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      (await (await fetch(base + '/api/status', { headers })).json()) as {
        preferences: { browserMode: string };
      }
    ).preferences.browserMode,
    'external',
  );
  const html = await fetch(base + '/');
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-security-policy')!, /frame-ancestors 'self'/);
  assert.ok(!(await html.text()).includes(handle.session.token));
});
test('panel rejects state directory symlinks outside its project', async (t) => {
  const { ctx, service } = await setup(t),
    outside = await mkdtemp(path.join(tmpdir(), 'panel-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await mkdir(path.join(ctx.root, '.apexrest'), { recursive: true });
  await symlink(outside, path.join(ctx.root, '.apexrest/jobs'));
  await assert.rejects(service.snapshot(), /escape|outside/i);
});
test('bundled MCP panel contains its assets and only current-session operation controls', async () => {
  const html = await panelDocument();
  assert.ok(!html.includes('src="/panel.js"'));
  assert.ok(!html.includes('href="/panel.css"'));
  assert.ok(html.indexOf('<script>') > html.indexOf('id="connection-form"'));
  assert.ok(html.indexOf('<script>') < html.indexOf('</body>'));
  assert.match(html, /Current Codex session/);
  assert.match(html, /id="open-browser"/);
  assert.doesNotMatch(html, /id="(?:task-form|team-select|new-task)"|data-page="team"|Agent team|avatar/);
});

test('removed workflow settings and actions are rejected while legacy preferences are safely read', async (t) => {
  const { ctx, service } = await setup(t);
  const file = path.join(ctx.root, '.apexrest/panel/preferences.json');
  await writeJson(file, {
    browserMode: 'external',
    executionMode: 'team',
    multiAgentEnabled: true,
    developers: 3,
    sandbox: 'workspace-write',
    timeoutSeconds: 3600,
  });
  assert.deepEqual(await service.preferences(), { browserMode: 'external' });
  const snapshot = await service.snapshot();
  assert.equal('teams' in snapshot, false);
  assert.equal('team' in snapshot, false);
  assert.equal('task' in snapshot, false);
  for (const action of [
    { kind: 'preferences', settings: { executionMode: 'team' } },
    { kind: 'preferences', settings: { multiAgentEnabled: true } },
    { kind: 'start', request: { task: 'Start a task.' } },
    { kind: 'message', id: randomUUID(), message: 'Change this.' },
    { kind: 'cancel-team', id: randomUUID() },
  ])
    assert.equal(schemas['panel.action'].safeParse({ action }).success, false);
  await service.act({ kind: 'preferences', settings: { browserMode: 'codex' } });
  assert.deepEqual(await readJson(file), { browserMode: 'codex' });
});

test('MCP and CLI panel actions cannot change global SQLcl settings; the local dashboard still can', async (t) => {
  const { ctx } = await setup(t);
  const action = {
    kind: 'sqlcl',
    settings: { schemaVersion: 1, mode: 'mcp', mcpRestrictLevel: '1', databaseTransport: 'direct' },
  } as const;
  assert.equal(schemas['panel.action'].safeParse({ project: ctx.root, action }).success, false);
  assert.equal(panelActionSchema.safeParse({ action }).success, true);
  const before = await sqlclConfig();
  const result = await dispatch('panel.action', { project: ctx.root, action });
  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 2);
  assert.deepEqual(await sqlclConfig(), before);
});

test('panel open and connection-resolving operations require a configured, trusted project first', async (t) => {
  const { ctx } = await setup(t, false);
  const empty = await mkdtemp(path.join(tmpdir(), 'panel-unconfigured-'));
  t.after(() => rm(empty, { recursive: true, force: true }));
  await assert.rejects(openPanel(empty), { code: 'PROJECT_NOT_CONFIGURED' });
  assert.equal(await exists(path.join(empty, '.apexrest')), false);
  await assert.rejects(openPanel(ctx.root), { code: 'PROJECT_TRUST_REQUIRED' });
  assert.equal(
    (await dispatch('panel.open', { project: ctx.root })).diagnostics[0]?.code,
    'PROJECT_TRUST_REQUIRED',
  );
  assert.equal(await exists(path.join(ctx.root, '.apexrest/panel')), false);
  for (const [operation, input] of [
    ['metadata.read', { env: 'dev', kind: 'objects', schema: 'FIXTURE' }],
    ['deploy.status', { run: randomUUID() }],
    ['deploy.restore-plan', { backup: randomUUID(), out: 'plans/restore.json' }],
  ] as const) {
    const result = await dispatch(operation, { project: ctx.root, ...input });
    assert.equal(result.ok, false, operation);
    assert.equal(result.diagnostics[0]?.code, 'PROJECT_TRUST_REQUIRED', operation);
  }
});

test('panel lists the newest records of a large history and reports how many were omitted', async (t) => {
  const { ctx, service } = await setup(t);
  const jobs = path.join(ctx.root, '.apexrest/jobs');
  const old = new Date(Date.now() - 86400000);
  await mkdir(jobs, { recursive: true });
  const ids = Array.from({ length: 2004 }, () => randomUUID());
  for (const id of ids) {
    await mkdir(path.join(jobs, id));
    await utimes(path.join(jobs, id), old, old);
  }
  const newest = randomUUID();
  await writeJson(path.join(jobs, newest, 'state.json'), {
    id: newest,
    operation: 'apex.validate',
    status: 'running',
    updatedAt: new Date().toISOString(),
  });
  const snapshot = await service.snapshot();
  assert.equal(snapshot.history.jobsOmitted, 5);
  assert.equal(snapshot.history.deploymentsOmitted, 0);
  assert.deepEqual(
    snapshot.jobs.map((job) => [job.id, job.status]),
    [[newest, 'running']],
  );
});

test('one unreadable job status does not hide the panel snapshot', async (t) => {
  const { ctx, service } = await setup(t);
  const broken = randomUUID(),
    healthy = randomUUID();
  await mkdir(path.join(ctx.root, '.apexrest/jobs', broken), { recursive: true });
  await writeFile(path.join(ctx.root, '.apexrest/jobs', broken, 'state.json'), 'null');
  await writeJson(path.join(ctx.root, '.apexrest/jobs', healthy, 'state.json'), {
    operation: 'apex.validate',
    status: 'failed',
    updatedAt: new Date().toISOString(),
  });
  const snapshot = await service.snapshot();
  assert.equal(snapshot.jobs.find((job) => job.id === broken)?.status, 'unavailable');
  assert.deepEqual(snapshot.jobs.find((job) => job.id === broken)?.diagnostics, [
    'Cannot read this job status.',
  ]);
  assert.equal(snapshot.jobs.find((job) => job.id === healthy)?.status, 'failed');
});

test('panel shutdown closes stalled connections after a grace period and releases only its own session', async (t) => {
  const { ctx } = await setup(t);
  const file = path.join(ctx.root, '.apexrest/panel/session.json');
  const handle = await startPanelServer(ctx.root, 3600000, 100);
  await writeJson(file, handle.session);
  // An authorized request with an incomplete body keeps its connection active.
  const socket = connect(handle.session.port, '127.0.0.1');
  await new Promise<void>((resolve) => socket.once('connect', () => resolve()));
  socket.on('error', () => undefined);
  socket.write(
    [
      'POST /api/action HTTP/1.1',
      `Host: 127.0.0.1:${handle.session.port}`,
      'Authorization: Bearer ' + handle.session.token,
      'Content-Type: application/json',
      'Content-Length: 100',
      '',
      '{"kind":',
    ].join('\r\n'),
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  const closedSocket = new Promise<void>((resolve) => socket.once('close', () => resolve()));
  const started = Date.now();
  await handle.close();
  await closedSocket;
  assert.ok(Date.now() - started < 5000, 'Shutdown must not wait for request timeouts');
  assert.equal(await exists(file), false);

  const other = await startPanelServer(ctx.root, 3600000, 100);
  const replacement = { ...other.session, token: 'a'.repeat(64) };
  await writeJson(file, replacement);
  await other.close();
  assert.deepEqual(await readJson(file), replacement);
});
