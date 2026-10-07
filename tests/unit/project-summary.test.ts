import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { fixture } from '../fixtures/project.ts';
import { projectInspect, projectSummary } from '../../packages/core/src/project.ts';
import { schemas } from '../../packages/core/src/operations.ts';

test('project summary needs no source reads and exposes only bounded configured identity', async (t) => {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const full = await projectInspect(ctx);
  assert.ok(full.sources.apex);
  ctx.config.environments = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [
      'dev' + i,
      {
        ...ctx.config.environments.dev!,
        readConnectionRef: 'private-read',
        deployConnectionRef: 'private-write',
      },
    ]),
  );
  const missing = { ...ctx, root: path.join(ctx.root, 'not-created') };
  const summary = await projectInspect(missing, 'summary');
  assert.deepEqual(summary, projectSummary(missing));
  assert.equal(summary.environments.length, 8);
  assert.equal(summary.environmentsOmitted, 2);
  assert.equal(summary.sourceDirectories.apex, ctx.config.application.sourceDir);
  assert.equal(summary.verification, 'host-browser');
  assert.equal(summary.targetVerified, false);
  assert.equal('sources' in summary, false);
  assert.doesNotMatch(JSON.stringify(summary), /private-read|private-write/);
  assert.equal(schemas['project.inspect'].parse({}).detail, 'full');
});
