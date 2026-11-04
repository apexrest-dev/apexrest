import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { fixture } from '../fixtures/project.ts';
import { writeJson } from '../../packages/core/src/fs.ts';
import { referenceRead, referenceSearch } from '../../packages/core/src/references.ts';
import { dispatch } from '../../packages/core/src/service.ts';

const ids = (hits: { id: string }[]) => hits.map((hit) => hit.id);

test('a project scopes context without dropping the component recipe corpus', async (t) => {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const plain = ids(await referenceSearch('metric card', undefined, { corpus: 'components' }));
  assert.ok(plain.some((id) => id.startsWith('component:template-components/metric-card/recipes/')));
  for (const profile of ['26.1', '26.2']) {
    await writeJson(path.join(ctx.root, 'apexrest.json'), {
      ...ctx.config,
      toolchain: { ...ctx.config.toolchain, profile },
    });
    assert.deepEqual(
      ids(await referenceSearch('metric card', undefined, { corpus: 'components', project: ctx.root })),
      plain,
      `profile ${profile}`,
    );
    // MCP apexrest_reference and CLI docs search share this dispatch route.
    const mcp = await dispatch('reference', {
      mode: 'search',
      corpus: 'components',
      query: 'metric card',
      project: ctx.root,
    });
    assert.equal(mcp.ok, true);
    assert.deepEqual(ids(mcp.data as { id: string }[]), plain, `MCP profile ${profile}`);
    const read = await referenceRead(plain[0]!, 0, 200, ctx.root);
    assert.equal(read.id, plain[0]);
    assert.ok(
      (await referenceSearch('metric card', undefined, { corpus: 'patterns', project: ctx.root })).length > 0,
      `patterns for profile ${profile}`,
    );
  }
  // An explicit 26.2 version still selects the official inventory.
  const official = ids(
    await referenceSearch('metric card', '26.2', { corpus: 'components', project: ctx.root }),
  );
  assert.ok(official.length > 0);
  assert.ok(official.every((id) => id.startsWith('oracle:26.2:')));
});
