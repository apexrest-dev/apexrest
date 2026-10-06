import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm, symlink, mkdtemp, mkdir, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fixture } from '../fixtures/project.ts';
import { exists, writeJson } from '../../packages/core/src/fs.ts';
import { PanelService } from '../../packages/core/src/panel.ts';
import { runProcess } from '../../packages/core/src/process.ts';
import { success } from '../../packages/core/src/result.ts';
import { toolOutput } from '../../packages/mcp/src/output.ts';
import { dispatch } from '../../packages/core/src/service.ts';
import { schemas, toolCatalog } from '../../packages/core/src/operations.ts';

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
test('status snapshot preserves failed results and unknown workers, redacts secrets and reports effective settings', async (t) => {
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
  assert.equal(s.trusted, true);
  assert.equal(s.configured, true);
});
test('status is read-only: no panel state is created, untrusted projects are reported, not blocked', async (t) => {
  const { ctx, service } = await setup(t, false);
  const snapshot = await service.snapshot();
  assert.equal(snapshot.trusted, false);
  assert.deepEqual(snapshot.preferences, { browserMode: 'codex' });
  assert.equal(await exists(path.join(ctx.root, '.apexrest/panel')), false);
  const result = await dispatch('panel.status', { project: ctx.root });
  assert.equal(result.ok, true);
  assert.equal((result.data as { trusted: boolean }).trusted, false);
  assert.equal(await exists(path.join(ctx.root, '.apexrest/panel')), false);
  assert.equal(schemas['panel.status'].safeParse({ team: randomUUID() }).success, false);
  assert.equal('panel.open' in schemas, false);
  assert.equal('panel.action' in schemas, false);
  assert.equal(
    toolCatalog.some((tool) => tool.operation.startsWith('panel.')),
    false,
  );
  const status = toolCatalog.find((tool) => tool.operation === 'status')!;
  assert.equal(status.readOnly, true);
  const viaStatus = await dispatch('status', { project: ctx.root, detail: 'project' });
  assert.equal(viaStatus.operation, 'status');
  assert.deepEqual(
    { ...(viaStatus.data as { updatedAt: string }), updatedAt: '' },
    { ...(result.data as { updatedAt: string }), updatedAt: '' },
  );
});
test('legacy preferences are read safely and removed workflow settings never reach the snapshot', async (t) => {
  const { ctx, service } = await setup(t);
  await writeJson(path.join(ctx.root, '.apexrest/panel/preferences.json'), {
    browserMode: 'external',
    executionMode: 'team',
    multiAgentEnabled: true,
    developers: 3,
    sandbox: 'workspace-write',
    timeoutSeconds: 3600,
  });
  assert.deepEqual(await service.preferences(), { browserMode: 'external' });
  const snapshot = await service.snapshot();
  assert.deepEqual(snapshot.preferences, { browserMode: 'external' });
  assert.equal('teams' in snapshot, false);
  assert.equal('team' in snapshot, false);
  assert.equal('task' in snapshot, false);
});
test('status rejects state directory symlinks outside its project', async (t) => {
  const { ctx, service } = await setup(t),
    outside = await mkdtemp(path.join(tmpdir(), 'panel-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await mkdir(path.join(ctx.root, '.apexrest'), { recursive: true });
  await symlink(outside, path.join(ctx.root, '.apexrest/jobs'));
  await assert.rejects(service.snapshot(), /escape|outside/i);
});
test('status lists the newest records of a large history and reports how many were omitted', async (t) => {
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
test('one unreadable job status does not hide the snapshot', async (t) => {
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

test('status returns only the lock digest and preserves essential fields after compaction', async (t) => {
  const { ctx, service } = await setup(t);
  await writeJson(path.join(ctx.root, ctx.config.toolchain.lockFile), { payload: 'x'.repeat(6500) });
  const snapshot = await service.snapshot();
  assert.match((snapshot.toolchain as { digest: string }).digest, /^[a-f0-9]{64}$/);
  assert.ok(JSON.stringify(snapshot.toolchain).length < 100);
  const output = await toolOutput(
    success('status', { ...snapshot, jobs: [{ summary: 'x'.repeat(20000) }] }),
    ctx.root,
  );
  const data = JSON.parse(output.content[0]!.text).data as Record<string, unknown>;
  for (const key of ['connections', 'permissions', 'changes', 'toolchain']) assert.ok(key in data, key);
});

test(
  'untrusted Git status disables a configured fsmonitor hook',
  { skip: process.platform === 'win32' },
  async (t) => {
    const { ctx, service } = await setup(t, false);
    const launch = (args: string[]) => runProcess({ executable: 'git', args, cwd: ctx.root });
    assert.equal((await launch(['init'])).code, 0);
    const marker = path.join(ctx.root, 'hook-ran');
    const hook = path.join(ctx.root, 'fsmonitor');
    await writeFile(hook, '#!/bin/sh\ntouch "' + marker + '"\n', { mode: 0o755 });
    assert.equal((await launch(['config', 'core.fsmonitor', hook])).code, 0);
    const snapshot = await service.snapshot();
    assert.equal(snapshot.changes.status, 'available');
    assert.equal(await exists(marker), false);
  },
);
