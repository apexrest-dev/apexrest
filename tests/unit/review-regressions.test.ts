import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { configureConnection, resolveConnection } from '../../packages/core/src/connections.ts';
import { configureSqlcl } from '../../packages/core/src/sqlcl-config.ts';
import { SqlclMcpClient } from '../../packages/core/src/sqlcl-mcp.ts';
import { runProcess } from '../../packages/core/src/process.ts';
import { schemas } from '../../packages/core/src/operations.ts';
import { dispatch, sharedOracle } from '../../packages/core/src/service.ts';
import { mcpSchemas } from '../../packages/mcp/src/server.ts';
import { shipWaitSeconds } from '../../packages/mcp/src/job-tools.ts';
import { projectInit } from '../../packages/core/src/project.ts';
import { loadProject, policy, updatePolicy, projectSchema } from '../../packages/core/src/config.ts';
import { checkShipTarget, reconcileShipGrants } from '../../packages/core/src/ship.ts';
import { workingCopyFixture } from '../fixtures/working-copy.ts';
import { writeJson } from '../../packages/core/src/fs.ts';

// These fixtures exercise local contracts only, never Oracle or a native host.
test('60-second job observation passes both composite and internal dispatch schemas', async (t) => {
  const f = await workingCopyFixture();
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  const jobId = randomUUID();
  await writeJson(path.join(f.ctx.root, '.apexrest/jobs', jobId, 'state.json'), {
    id: jobId,
    status: 'completed',
    updatedAt: new Date().toISOString(),
    operation: 'apex.validate',
  });
  assert.equal(schemas['jobs.status'].parse({ id: jobId, waitSeconds: 60 }).waitSeconds, 60);
  const result = await dispatch('job', { project: f.ctx.root, jobId, waitSeconds: 60 });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(shipWaitSeconds.parse(undefined), 25);
});

test('process stdout preserves PL/SQL JSON and UTF-8 split across chunks', async () => {
  const source = "l_password := apex_util.get_hash('fixture'); Україна";
  const payload = JSON.stringify({ source });
  const result = await runProcess({
    executable: process.execPath,
    args: [
      '-e',
      `const b=Buffer.from(${JSON.stringify(payload)});let i=0;const timer=setInterval(()=>{process.stdout.write(b.subarray(i,i+1));if(++i===b.length)clearInterval(timer)},1)`,
    ],
    cwd: tmpdir(),
  });
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.stdout), { source });
  assert.doesNotMatch(result.stdout, /\uFFFD/);
});

test('truncated UTF-8 output never inserts a replacement character', async () => {
  const result = await runProcess({
    executable: process.execPath,
    args: ['-e', "process.stdout.write('ЇЇЇ')"],
    cwd: tmpdir(),
    maxBytes: 3,
  });
  assert.equal(result.truncated, true);
  assert.equal(result.stdout, 'Ї');
});

test('required remote tests refuse ship before grant or import without widening authorization', async (t) => {
  const f = await workingCopyFixture();
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  f.ctx.config.tests.requiredSuites = ['sql', 'api', 'e2e'];
  const plan = await f.service.plan(f.ctx, 'dev');
  await updatePolicy((p) => ({ ...p, grants: p.grants.map((g) => ({ ...g, operations: ['deploy'] })) }));
  const before = await policy();
  await assert.rejects(checkShipTarget(f.ctx, plan), { code: 'TEST_APPROVAL_REQUIRED' });
  assert.deepEqual(await policy(), before);
  assert.ok(!f.calls.includes('import'));
  await updatePolicy((p) => ({
    ...p,
    grants: p.grants.map((g) => ({ ...g, operations: ['deploy', 'test'] })),
  }));
  f.ctx.config.tests.mutationAllowedEnvironments = [];
  await assert.rejects(checkShipTarget(f.ctx, plan), { code: 'TEST_APPROVAL_REQUIRED' });
  f.ctx.config.environments.dev!.baseUrl = 'https://localhost/ords/';
  f.ctx.config.tests.mutationAllowedEnvironments = ['dev'];
  await checkShipTarget(f.ctx, plan);
  // Unit-only projects have no remote test authorization requirement.
  f.ctx.config.tests.requiredSuites = ['unit'];
  await checkShipTarget(f.ctx, plan);
});

test('expired and dead-worker ship grants are reconciled without deleting user grants', async (t) => {
  const f = await workingCopyFixture();
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  await updatePolicy((p) => ({
    ...p,
    grants: [
      ...p.grants,
      { ...p.grants[0]!, grantedBy: 'ship', workerPid: process.pid, expiresAt: new Date(0).toISOString() },
      { ...p.grants[0]!, grantedBy: 'ship', workerPid: 2147483647 },
      { ...p.grants[0]!, grantedBy: 'ship' },
      { ...p.grants[0]!, grantedBy: 'ship', workerPid: process.pid },
    ],
  }));
  await reconcileShipGrants();
  const grants = (await policy()).grants;
  assert.equal(grants.length, 2);
  assert.equal(grants.filter((g) => g.grantedBy === 'ship').length, 1);
});

test('MCP rejects relative init directory and passwordFile', () => {
  const schema = mcpSchemas.get('project')!;
  assert.equal(schema.safeParse({ action: 'init', directory: './customer' }).success, false);
  assert.equal(
    schema.safeParse({ action: 'connection_add', name: 'dev', sqlclName: 'dev', passwordFile: './password' })
      .success,
    false,
  );
  assert.equal(
    schema.safeParse({ action: 'init', directory: path.join(tmpdir(), 'customer') }).success,
    true,
  );
});

test('failed initialization leaves the destination empty and permits retry', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-init-failure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const oldResources = process.env.APEXREST_RESOURCES;
  process.env.APEXREST_RESOURCES = path.join(root, 'missing-resources');
  try {
    await assert.rejects(projectInit(path.join(root, 'project'), 'existing-app', 'test'));
  } finally {
    if (oldResources === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = oldResources;
  }
  assert.deepEqual(await readdir(root), []);
  await projectInit(path.join(root, 'project'), 'existing-app', 'test');
  const ctx = await loadProject(path.join(root, 'project'));
  assert.equal(projectSchema.safeParse({ ...ctx.config, deploymentControl: 'local' }).success, true);
  assert.equal(projectSchema.safeParse({ ...ctx.config, deploymentControl: 'database' }).success, false);
});

test('dispatch adapters observe edited connections and rotated credentials across operations', async (t) => {
  const f = await workingCopyFixture();
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  await configureSqlcl('cli', undefined, 'ords');
  await configureConnection('read', {
    ordsUrl: 'https://localhost/ords/first/',
    ordsUsername: 'reader',
    password: 'first-fixture-pass',
  });
  const first = await sharedOracle();
  const resolved = await first.selectedConnection(await resolveConnection('read'));
  assert.equal(resolved.ords!.password, 'first-fixture-pass');
  await configureConnection('read', {
    ordsUrl: 'https://localhost/ords/second/',
    ordsUsername: 'reader',
    password: 'rotated-fixture-pass',
  });
  const second = await sharedOracle();
  assert.notEqual(second, first);
  const refreshed = await second.selectedConnection(await resolveConnection('read'));
  assert.equal(refreshed.ords!.url, 'https://localhost/ords/second/');
  assert.equal(refreshed.ords!.password, 'rotated-fixture-pass');
});

test('SQLcl MCP JSON output preserves password-like PL/SQL source before parsing', () => {
  const client = new SqlclMcpClient({ executable: process.execPath, args: [], cwd: tmpdir() });
  const row = { source: "l_password := apex_util.get_hash('fixture');" };
  const output = client.text({
    content: [{ type: 'text', text: JSON.stringify({ results: [{ items: [row] }] }) }],
  });
  assert.deepEqual(JSON.parse(output).results[0].items, [row]);
});
