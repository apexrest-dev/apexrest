import test from 'node:test';
import assert from 'node:assert/strict';
import { rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import { ArtifactService } from '../../packages/core/src/artifacts.ts';
import { success, failure, Fault, sanitized } from '../../packages/core/src/result.ts';
import { toolOutput } from '../../packages/mcp/src/output.ts';
import { exists, hash, writeJson } from '../../packages/core/src/fs.ts';
import { randomUUID } from 'node:crypto';

async function isolated(t: import('node:test').TestContext) {
  const { ctx, plan } = await fixture();
  const before = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = path.join(ctx.root, 'managed');
  t.after(async () => {
    if (before === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = before;
    await rm(ctx.root, { recursive: true, force: true });
  });
  return { ctx, plan };
}

test('large source results retain their outcome and can be reconstructed through artifact windows', async (t) => {
  const { ctx } = await isolated(t);
  const files = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`page-${i}.apx`, 'a'.repeat(64)]));
  const original = success('project.inspect', { projectId: 'fixture', sources: { apex: files } });
  const response = await toolOutput(original, ctx.root);
  const compact = JSON.parse(response.content[0]!.text);
  assert.equal(response.isError, false);
  assert.equal(compact.status, original.status);
  assert.equal(compact.runId, original.runId);
  assert.equal(compact.data.sourceCounts.apex, 1000);
  assert.ok(response.content[0]!.text.length < 2000);
  assert.equal(compact.artifacts[0], compact.data.output.artifactId);
  const reader = new ArtifactService(ctx);
  let offset: number | null = 0,
    text = '';
  while (offset !== null) {
    const page = await reader.read(compact.data.output.artifactId, offset, 4096);
    text += page.content;
    offset = page.nextOffset;
  }
  assert.deepEqual(JSON.parse(text), original);
});

test('large failed and unknown operations retain failures even when output archival is unavailable', async () => {
  for (const status of ['failed', 'outcome_unknown']) {
    const original = failure('deploy.apply', new Fault('FIXTURE', 'detail '.repeat(6000), 6, status));
    const response = await toolOutput(original);
    const compact = JSON.parse(response.content[0]!.text);
    assert.equal(response.isError, true);
    assert.equal(compact.status, status);
    assert.equal(compact.exitCode, 6);
    assert.equal(compact.diagnostics[0].code, 'FIXTURE');
    assert.equal(compact.data.output.recovery, 'unavailable');
    assert.match(compact.nextActions[0], /do not rerun/);
    assert.ok(response.content[0]!.text.length < 2000);
  }
});

test('nested job failure remains visible and no UI metadata channel exists', async (t) => {
  const { ctx } = await isolated(t);
  const job = {
    status: 'completed',
    result: { ok: false, status: 'failed', summary: 'Compiler failed', data: 'x'.repeat(40000) },
  };
  const response = await toolOutput(success('jobs.status', job), ctx.root);
  const jobResponse = JSON.parse(response.content[0]!.text);
  assert.equal(jobResponse.data.status, 'completed');
  assert.equal(jobResponse.data.result.ok, false);
  assert.equal(jobResponse.data.result.status, 'failed');
  assert.equal('_meta' in response, false);
  assert.equal('structuredContent' in response, false);
});

test('structured compiler diagnostics travel complete and the compacted summary keeps the first five', async (t) => {
  const { ctx } = await isolated(t);
  const entries = Array.from({ length: 60 }, (_, i) => ({
    message: `Unknown property ${i} ` + 'detail '.repeat(120),
    file: `pages/p000${i}.apx`,
    line: i + 1,
    column: 7,
    type: 'unknown-property',
    hint: 'Use a listed property.',
    validValues: ['title', 'label'],
  }));
  const failed = failure(
    'apex.validate',
    new Fault('VALIDATION_FAILED', 'Oracle compiler reported 60 error(s).', 1, 'failed', {
      diagnostics: entries,
    }),
  );
  assert.equal(failed.diagnostics.length, 50);
  assert.deepEqual(failed.diagnostics[0], {
    severity: 'error',
    code: 'VALIDATION_FAILED',
    message: entries[0]!.message,
    file: 'pages/p0000.apx',
    line: 1,
    column: 7,
    type: 'unknown-property',
    hint: 'Use a listed property.',
    validValues: ['title', 'label'],
  });
  assert.equal((failed.data as { diagnosticsOmitted: number }).diagnosticsOmitted, 10);
  assert.match(failed.nextActions[0]!, /rerun apexrest_apex_validate/);
  const response = await toolOutput(failed, ctx.root);
  const compact = JSON.parse(response.content[0]!.text);
  assert.equal(response.isError, true);
  assert.equal(compact.diagnostics.length, 5);
  assert.deepEqual(compact.diagnostics[4], failed.diagnostics[4]);
  assert.equal(compact.data.output.diagnosticsCount, 50);
  assert.match(compact.nextActions[0], /rerun apexrest_apex_validate/);
  assert.ok(compact.data.output.artifactId);
  assert.ok(response.content[0]!.text.length < inlineBudget);
});
const inlineBudget = 8192;

test('JSON artifacts redact before pagination without corrupting quotes or split secret fields', async (t) => {
  const { ctx } = await isolated(t);
  const service = new ArtifactService(ctx);
  const original = {
    password: 'sensitive',
    text: 'password=hidden',
    rows: Array.from({ length: 50 }, () => ({
      note: 'line\nquote " and slash \\',
      authorization: 'Bearer private',
    })),
  };
  const id = await service.saveJson(original, 'mcp-result');
  let offset: number | null = 0,
    content = '';
  while (offset !== null) {
    const page = await service.read(id, offset, 37);
    const transported = JSON.parse(
      (await toolOutput(success('artifacts.read', page), ctx.root)).content[0]!.text,
    ).data;
    content += transported.content;
    offset = transported.nextOffset;
  }
  assert.deepEqual(JSON.parse(content), sanitized(original));
  assert.doesNotMatch(content, /sensitive|hidden|Bearer private/);
});

test('automatic archives ignore source directories and repeated identical results reuse a capture', async (t) => {
  const { ctx } = await isolated(t);
  ctx.config.artifacts.directory = ctx.config.database.migrationsDir;
  await writeJson(path.join(ctx.root, 'apexrest.json'), ctx.config);
  const data = {
    projectId: 'fixture',
    sources: { apex: Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`p${i}.apx`, 'failed'])) },
  };
  const first = JSON.parse((await toolOutput(success('project.inspect', data), ctx.root)).content[0]!.text);
  const second = JSON.parse((await toolOutput(success('project.inspect', data), ctx.root)).content[0]!.text);
  assert.equal(first.data.output.artifactId, second.data.output.artifactId);
  assert.equal(first.data.output.capturedRunId, second.data.output.capturedRunId);
  const sources = await readdir(path.join(ctx.root, ctx.config.database.migrationsDir)).catch(() => []);
  assert.deepEqual(sources, []);
  assert.match((await new ArtifactService(ctx).read(first.data.output.artifactId)).content, /failed/);
});

test('archiving prunes expired result records at most once per hour per project', async (t) => {
  const { ctx } = await isolated(t);
  const service = new ArtifactService(ctx);
  const expire = async () => {
    const id = await service.saveJson({ fixture: true }, 'mcp-result');
    const results = path.join(process.env.APEXREST_HOME!, 'results', hash(ctx.root));
    await writeJson(path.join(results, id + '.json'), {
      id,
      kind: 'mcp-result',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    return path.join(results, id + '.json');
  };
  const large = () =>
    success('project.inspect', { sources: { apex: { 'a.apx': 'x'.repeat(9000) } }, nonce: randomUUID() });
  const expired = await expire();
  await toolOutput(large(), ctx.root);
  assert.equal(await exists(expired), false, 'The first archive in a process prunes expired results');
  const later = await expire();
  await toolOutput(large(), ctx.root);
  assert.equal(await exists(later), true, 'Pruning runs at most hourly');
});

test('escaped artifact pages shrink without creating another archive or losing the cursor', async (t) => {
  const { ctx } = await isolated(t);
  const service = new ArtifactService(ctx);
  const id = await service.save('\u0000'.repeat(18000), 'fixture');
  let offset: number | null = 0,
    content = '';
  while (offset !== null) {
    const result = await toolOutput(
      success('artifacts.read', await service.read(id, offset, 16384)),
      ctx.root,
    );
    assert.ok(result.content[0]!.text.length < 32768);
    const page = JSON.parse(result.content[0]!.text).data;
    assert.equal(page.output, undefined);
    assert.equal(page.id, id);
    content += page.content;
    offset = page.nextOffset;
  }
  assert.equal(content, '\u0000'.repeat(18000));
});

test('untrusted large source keys and nested summaries cannot bypass the aggregate preview limit', async () => {
  const result = await toolOutput(
    success('project.inspect', {
      sources: Object.fromEntries(
        Array.from({ length: 1000 }, (_, i) => ['long-key-' + i + 'x'.repeat(1000), {}]),
      ),
      result: { summary: { text: 'x'.repeat(50000) } },
    }),
  );
  assert.ok(result.content[0]!.text.length < 8192);
});

test('compacted job failures retain actionable nested diagnostics without exposing secrets', async (t) => {
  const { ctx } = await isolated(t);
  const failed = failure(
    'apex.validate',
    new Fault('COMPILER_FAILURE', 'Unknown item in page 10; password=private', 1),
  );
  failed.artifacts = ['compiler-report'];
  failed.nextActions = ['Repair the item reference before importing.'];
  failed.data = { log: 'x'.repeat(40000) };
  const transported = JSON.parse(
    (
      await toolOutput(
        success('jobs.status', {
          jobId: 'known-job',
          status: 'completed',
          result: failed,
        }),
        ctx.root,
      )
    ).content[0]!.text,
  );
  assert.equal(transported.data.result.ok, false);
  assert.equal(transported.data.result.exitCode, 1);
  assert.equal(transported.data.result.diagnostics[0].code, 'COMPILER_FAILURE');
  assert.match(transported.data.result.diagnostics[0].message, /page 10/);
  assert.deepEqual(transported.data.result.artifacts, ['compiler-report']);
  assert.deepEqual(transported.data.result.nextActions, failed.nextActions);
  assert.doesNotMatch(JSON.stringify(transported), /password=private/);
  assert.ok(JSON.stringify(transported).length < 3000);
  assert.ok(transported.data.output.artifactId);
});

test('large plan previews preserve safety fields, source counts and operation counts', async (t) => {
  const { ctx, plan } = await isolated(t);
  const largePlan = {
    ...plan,
    sources: Object.fromEntries(Array.from({ length: 300 }, (_, i) => ['page-' + i, 'a'.repeat(64)])),
    risks: ['destructive-or-privileged-sql'],
    backupRequired: true,
    target: { workspace: 'FIXTURE', application: 123 },
  };
  const transported = JSON.parse(
    (
      await toolOutput(
        success('jobs.status', {
          jobId: 'plan-job',
          status: 'completed',
          result: success('deploy.plan', largePlan),
        }),
        ctx.root,
      )
    ).content[0]!.text,
  );
  const summary = transported.data.result.data;
  assert.equal(summary.digest, plan.digest);
  assert.equal(summary.targetDigest, plan.targetDigest);
  assert.equal(summary.environment, 'dev');
  assert.equal(summary.backupRequired, true);
  assert.equal(summary.approval, 'external-policy-required');
  assert.deepEqual(summary.risks, largePlan.risks);
  assert.deepEqual(summary.target, largePlan.target);
  assert.equal(summary.sourceCount, 300);
  assert.equal(summary.operationCounts.import, 1);
  assert.equal(summary.sources, undefined);
  assert.ok(JSON.stringify(transported).length < 4000);
});
