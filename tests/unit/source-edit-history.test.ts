import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import { editPage, type EditOperation } from '../../packages/core/src/edit/page-edit.ts';
import { patchPage } from '../../packages/core/src/edit/patch.ts';
import { editHistory, HISTORY_LIMIT, redoEdit, undoEdit } from '../../packages/core/src/edit/history.ts';
import { digestOf } from '../../packages/core/src/edit/apexlang-edit.ts';

const PAGE = `page 9 (
    name: Orders
    // Kept comment.
    region orders (
        id: 1618033988
        name: Orders
        type: staticContent
    )
)
`;
const compound: EditOperation[] = [
  { op: 'set', target: 'page', property: 'title', value: 'Open orders' },
  { op: 'set', target: 'region:orders', property: 'title', value: 'Open' },
  {
    op: 'insert',
    components: { regions: [{ id: 'notes', type: 'staticContent', name: 'Notes' }] },
  },
];

async function project(t: test.TestContext) {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const file = path.join(ctx.root, 'src/apex/app/pages/p00009-orders.apx');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, PAGE);
  return { ctx, file };
}

test('one undo reverses a whole compound edit and one redo restores it byte for byte', async (t) => {
  const { ctx, file } = await project(t);
  const applied = await editPage(ctx, { page: '9', operations: compound, expectedDigest: digestOf(PAGE) });
  const edited = await readFile(file, 'utf8');
  assert.equal(applied.afterDigest, digestOf(edited));
  assert.equal((await editHistory(ctx)).undo.length, 1);
  const undone = await undoEdit(ctx);
  assert.equal(await readFile(file, 'utf8'), PAGE);
  assert.equal(undone.afterDigest, digestOf(PAGE));
  assert.deepEqual(undone.change.affectedPages, ['9']);
  assert.match(undone.next, /not reverted/u);
  const redone = await redoEdit(ctx);
  assert.equal(await readFile(file, 'utf8'), edited);
  assert.equal(redone.afterDigest, applied.afterDigest);
  assert.ok(edited.includes('id: 1618033988') && edited.includes('// Kept comment.'));
});

test('undo and redo refuse to overwrite newer work; a new edit clears the redo branch', async (t) => {
  const { ctx, file } = await project(t);
  await editPage(ctx, { page: '9', operations: compound, expectedDigest: digestOf(PAGE) });
  // Someone edits the file in between: undo would overwrite it, so nothing is written.
  const external = (await readFile(file, 'utf8')) + '\n';
  await writeFile(file, external);
  await assert.rejects(undoEdit(ctx), { code: 'TRANSFORM_CONFLICT' });
  assert.equal(await readFile(file, 'utf8'), external);
  // Back to the edited bytes: undo works; a new edit after it drops the redo entry.
  await writeFile(file, external.slice(0, -1));
  await undoEdit(ctx);
  assert.equal((await editHistory(ctx)).redo.length, 1);
  await patchPage(ctx, {
    page: '9',
    operations: [{ target: 'region:orders', property: 'title', value: 'Other' }],
    expectedDigest: digestOf(PAGE),
  });
  const history = await editHistory(ctx);
  assert.equal(history.redo.length, 0);
  await assert.rejects(redoEdit(ctx), { code: 'HISTORY_EMPTY' });
  // Dry runs and refused edits are not recorded.
  await editPage(ctx, { page: '9', operations: compound, dryRun: true });
  await assert.rejects(
    editPage(ctx, { page: '9', operations: compound, expectedDigest: digestOf('stale') }),
    { code: 'TRANSFORM_CONFLICT' },
  );
  assert.equal((await editHistory(ctx)).undo.length, 1);
});

test('the history is bounded', async (t) => {
  const { ctx, file } = await project(t);
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
    const source = await readFile(file, 'utf8');
    await patchPage(ctx, {
      page: '9',
      operations: [{ target: 'region:orders', property: 'title', value: `Title ${i}` }],
      expectedDigest: digestOf(source),
    });
  }
  const history = JSON.parse(await readFile(path.join(ctx.root, '.apexrest/edit-history.json'), 'utf8'));
  assert.equal(history.undo.length, HISTORY_LIMIT);
  assert.equal((await editHistory(ctx)).limit, HISTORY_LIMIT);
});
