import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { fixture } from '../fixtures/project.ts';
import { loadProject, projectSchema } from '../../packages/core/src/config.ts';
import { canonical, hash, writeJson } from '../../packages/core/src/fs.ts';
import { projectInspect } from '../../packages/core/src/project.ts';

test('full project inspection binds authoritative schema defaults without exposing raw configuration', async (t) => {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const explicit = projectSchema.parse({ ...ctx.config, composer: {}, decisionApi: {}, peerReview: {} });
  await writeJson(path.join(ctx.root, 'apexrest.json'), explicit);
  const original = await projectInspect(await loadProject(ctx.root));
  assert.equal(original.configurationDigest, hash(canonical(explicit)));
  assert.equal('config' in original, false);
  const { allowedOrigins: _defaultOrigins, ...dev } = explicit.environments.dev!;
  const omitted = {
    ...explicit,
    environments: { ...explicit.environments, dev },
    composer: {},
    decisionApi: {},
    peerReview: {},
  };
  await writeJson(path.join(ctx.root, 'apexrest.json'), omitted);
  const equivalent = await loadProject(ctx.root);
  assert.deepEqual(equivalent.config, explicit);
  assert.equal((await projectInspect(equivalent)).configurationDigest, original.configurationDigest);
  omitted.environments.dev.applicationId++;
  await writeJson(path.join(ctx.root, 'apexrest.json'), omitted);
  assert.notEqual(
    (await projectInspect(await loadProject(ctx.root))).configurationDigest,
    original.configurationDigest,
  );
});
