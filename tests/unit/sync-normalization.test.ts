import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { atomicWrite, inventory } from '../../packages/core/src/fs.ts';
import { generatedSourceNormalizations } from '../../packages/core/src/sync-normalization.ts';

/** `apex generate` output as written locally, and the same app as the server exports it. */
const GENERATED = {
  'application.apx': 'application apexrest-test (\n    name: apexrest-test\n)\n',
  'deployments/default.json': '{\n}\n',
  'supporting-objects/supporting-objects.apx':
    'supportingObject (\n    deinstall {\n        scriptFile: deinstall-script.sql\n    }\n)\n\n',
  'supporting-objects/deinstall-script.sql': '',
};
const EXPORTED = {
  'application.apx': GENERATED['application.apx'],
  'deployments/default.json': '{\n  "app" : {\n    "id" : 100\n  }\n}',
  'supporting-objects/supporting-objects.apx': 'supportingObject (\n)\n\n',
};

async function pair(
  t: import('node:test').TestContext,
  local: Record<string, string>,
  server: Record<string, string>,
) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-sync-normalization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const write = async (dir: string, files: Record<string, string>) => {
    for (const [file, content] of Object.entries(files))
      await atomicWrite(path.join(root, dir, file), content);
    return inventory(path.join(root, dir));
  };
  const localFiles = await write('local', local);
  const serverFiles = await write('server', server);
  return (applicationId = 100) =>
    generatedSourceNormalizations(
      path.join(root, 'local'),
      path.join(root, 'server'),
      localFiles,
      serverFiles,
      applicationId,
    );
}

test('a generated app and its server export differ only by recognised import rewrites', async (t) => {
  assert.deepEqual(await (await pair(t, GENERATED, EXPORTED))(), [
    { file: 'deployments/default.json', rule: 'deployment-app-id-target', action: 'replaced' },
    { file: 'supporting-objects/supporting-objects.apx', rule: 'empty-deinstall-script', action: 'replaced' },
    { file: 'supporting-objects/deinstall-script.sql', rule: 'empty-deinstall-script', action: 'removed' },
  ]);
  // Either rewrite alone is recognised too; whitespace-only scripts count as empty.
  assert.equal(
    (await (await pair(t, { ...EXPORTED, 'deployments/default.json': '{}' }, EXPORTED))())?.length,
    1,
  );
  assert.equal(
    (await (await pair(t, { ...GENERATED, 'supporting-objects/deinstall-script.sql': ' \n\n' }, EXPORTED))())
      ?.length,
    3,
  );
  // Identical sources need no normalization.
  assert.equal(await (await pair(t, EXPORTED, EXPORTED))(), undefined);
});

test('anything beyond the recognised rewrites stays a conflict', async (t) => {
  // The server app.id must be the configured application.
  assert.equal(await (await pair(t, GENERATED, EXPORTED))(101), undefined);
  // A local app.id that differs from the target.
  assert.equal(
    await (
      await pair(t, { ...GENERATED, 'deployments/default.json': '{"app":{"id":7}}' }, EXPORTED)
    )(),
    undefined,
  );
  // Another deployment setting differs.
  assert.equal(
    await (
      await pair(t, { ...GENERATED, 'deployments/default.json': '{"app":{"id":100},"build":"x"}' }, EXPORTED)
    )(),
    undefined,
  );
  // The deinstall script has content: dropping it would lose code.
  assert.equal(
    await (
      await pair(t, { ...GENERATED, 'supporting-objects/deinstall-script.sql': 'drop table t;' }, EXPORTED)
    )(),
    undefined,
  );
  // The server still has the script, or the rest of supporting-objects.apx differs.
  assert.equal(
    await (
      await pair(t, GENERATED, { ...EXPORTED, 'supporting-objects/deinstall-script.sql': '' })
    )(),
    undefined,
  );
  assert.equal(
    await (
      await pair(t, GENERATED, {
        ...EXPORTED,
        'supporting-objects/supporting-objects.apx': 'supportingObject (\n    name: x\n)\n\n',
      })
    )(),
    undefined,
  );
  // Any unrelated difference, even alongside recognised ones.
  assert.equal(
    await (
      await pair(t, { ...GENERATED, 'application.apx': 'local edit' }, EXPORTED)
    )(),
    undefined,
  );
  assert.equal(
    await (
      await pair(t, { ...GENERATED, 'pages/p00002-new.apx': 'page 2 (\n)\n' }, EXPORTED)
    )(),
    undefined,
  );
});
