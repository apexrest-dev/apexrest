import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('MCP large project, job and status outputs retain usable status and paged results', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-output-'));
  const project = path.join(root, 'project');
  const env = { ...process.env, APEXREST_HOME: path.join(root, 'managed') };
  t.after(() => rm(root, { recursive: true, force: true }));
  const init = spawnSync(
    process.execPath,
    [
      path.resolve('dist/runtime/apexrest.mjs'),
      'project',
      'init',
      project,
      '--template',
      'existing-app',
      '--alias',
      'fixture',
      '--json',
    ],
    { env, encoding: 'utf8' },
  );
  assert.equal(init.status, 0, init.stderr);
  const source = path.join(project, 'src/apex/fixture');
  await mkdir(source, { recursive: true });
  await Promise.all(
    Array.from({ length: 400 }, (_, i) => writeFile(path.join(source, `page-${i}.apx`), 'page fixture\n')),
  );
  const client = new Client({ name: 'output-contract', version: '1' });
  t.after(() => client.close());
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve('dist/runtime/mcp.mjs')],
      env,
      stderr: 'pipe',
    }),
  );
  const call = (name, args = {}) => client.callTool({ name, arguments: { project, ...args } });
  const inspect = await call('apexrest_project', { action: 'inspect', detail: 'full' });
  const compact = JSON.parse(inspect.content[0].text);
  assert.equal(compact.ok, true);
  assert.equal(compact.data.sourceCounts.apex, 400);
  assert.ok(inspect.content[0].text.length < 2048);
  let offset = 0,
    content = '';
  while (offset !== null) {
    const r = JSON.parse(
      (await call('apexrest_artifact_read', { id: compact.data.output.artifactId, offset })).content[0].text,
    );
    assert.equal(r.ok, true);
    content += r.data.content;
    offset = r.data.nextOffset;
  }
  assert.equal(Object.keys(JSON.parse(content).data.sources.apex).length, 400);
  const jobId = randomUUID();
  const jobRoot = path.join(project, '.apexrest/jobs', jobId);
  await mkdir(jobRoot, { recursive: true });
  const job = {
    id: jobId,
    status: 'completed',
    updatedAt: new Date().toISOString(),
    result: {
      ok: false,
      status: 'failed',
      summary: 'Compiler failed',
      diagnostics: Array.from({ length: 80 }, () => ({
        severity: 'error',
        code: 'FIXTURE',
        message: 'd'.repeat(500),
      })),
    },
  };
  await writeFile(path.join(jobRoot, 'state.json'), JSON.stringify(job));
  const status = JSON.parse((await call('apexrest_job', { jobId })).content[0].text);
  assert.equal(status.ok, true);
  assert.equal(status.data.status, 'completed');
  assert.equal(status.data.result.status, 'failed');
  assert.ok(status.data.output.artifactId);
  assert.equal(status.diagnostics.length, 0, 'status reads succeed; the recorded result carries diagnostics');
  // Twelve valid records make the full snapshot exceed the inline cap.
  for (let i = 0; i < 11; i++) {
    const id = randomUUID(),
      folder = path.join(project, '.apexrest/jobs', id);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'state.json'), JSON.stringify({ ...job, id }));
  }
  const snapshot = await call('apexrest_status', { detail: 'project' });
  const snapshotText = JSON.parse(snapshot.content[0].text);
  assert.equal(snapshotText.ok, true);
  assert.equal(snapshotText.operation, 'status');
  assert.ok(snapshot.content[0].text.length < 2048);
  assert.equal(snapshot.structuredContent, undefined);
  assert.equal(snapshot._meta, undefined, 'no UI metadata channel');
  assert.equal(snapshotText.data.jobsCount, 12);
  assert.ok(snapshotText.data.output.artifactId, 'large snapshots are archived like any result');
  const validate = JSON.parse((await call('apexrest_apex_validate')).content[0].text);
  assert.equal(validate.ok, false);
  assert.equal(validate.data?.jobId, undefined, 'validation runs in-process, never as a job');
  assert.equal(
    (await readdir(path.join(project, '.apexrest/jobs'))).length,
    12,
    'Status reads do not start a replacement job',
  );
});
