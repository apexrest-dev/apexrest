import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import { editPage, editGroups, type EditOperation } from '../../packages/core/src/edit/page-edit.ts';
import { transformPage } from '../../packages/core/src/edit/transaction.ts';
import { digestOf, parseApexLang } from '../../packages/core/src/edit/apexlang-edit.ts';

const PAGE = [
  'page 7 (',
  '    name: Orders',
  '    title: Orders',
  '    // Kept comment.',
  '    region orders (',
  '        name: Orders',
  '        type: interactiveReport',
  '        source {',
  '            sqlQuery:',
  '                ```sql',
  '                select id, amount from orders',
  '                ```',
  '        }',
  '        column AMOUNT (',
  '            id: 4815162342',
  '            type: plainText',
  '            heading {',
  '                heading: Amount',
  '            }',
  '        )',
  '    )',
  '    pageItem P7_SEARCH (',
  '        type: textField',
  '    )',
  ')',
  '',
].join('\n');

const filter: EditOperation = {
  op: 'insert',
  components: {
    regions: [{ id: 'filters', type: 'staticContent', name: 'Filters' }],
    items: [
      {
        name: 'P7_STATUS',
        region: 'filters',
        type: 'selectList',
        label: 'Status',
        lov: [{ label: 'Open', value: 'O' }],
      },
    ],
    refreshes: [{ items: ['P7_STATUS'], regions: ['orders'] }],
  },
};
const compound: EditOperation[] = [
  { op: 'set', target: 'page', property: 'title', value: 'Open orders' },
  {
    op: 'set',
    target: 'region:orders',
    property: 'query',
    value: 'select id, amount, status from orders where status = :P7_STATUS',
    columns: [{ name: 'AMOUNT' }, { name: 'STATUS', heading: 'Status', dataType: 'varchar2' }],
  },
  filter,
];

async function page(t: test.TestContext) {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const file = path.join(ctx.root, 'src/apex/app/pages/p00007-orders.apx');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, PAGE);
  return { ctx, file };
}

test('one transaction combines property, query and insert operations in a single write', async (t) => {
  const { ctx, file } = await page(t);
  const applied = await editPage(ctx, { page: '7', operations: compound, expectedDigest: digestOf(PAGE) });
  assert.equal(applied.written, true);
  assert.equal(applied.operations, 3);
  const text = await readFile(file, 'utf8');
  assert.equal(applied.afterDigest, digestOf(text));
  assert.deepEqual(applied.change?.changedFiles, ['src/apex/app/pages/p00007-orders.apx']);
  assert.deepEqual(applied.change?.affectedPages, ['7']);
  // Oracle ids, comments and the kept column survive; every operation reads back.
  assert.match(text, /\/\/ Kept comment\./u);
  assert.match(text, /id: 4815162342/u);
  const [parsed] = parseApexLang(text);
  assert.equal(parsed!.props.title, 'Open orders');
  assert.deepEqual(
    parsed!.children.map((c) => `${c.type}:${c.id}`),
    [
      'region:orders',
      'pageItem:P7_SEARCH',
      'region:filters',
      'pageItem:P7_STATUS',
      'dynamicAction:refresh-1',
    ],
  );
  assert.deepEqual(
    parsed!.children[0]!.children.map((c) => c.id),
    ['AMOUNT', 'STATUS'],
  );
  assert.deepEqual(applied.targets, [
    'page',
    'region:orders',
    'region:filters',
    'item:P7_STATUS',
    'dynamicAction:refresh-1',
  ]);
});

test('any invalid operation leaves the page byte-identical', async (t) => {
  const { ctx, file } = await page(t);
  const failures: [EditOperation[], string][] = [
    [[compound[0]!, { op: 'set', target: 'button:none', property: 'label', value: 'x' }], 'TARGET_NOT_FOUND'],
    [
      [
        compound[0]!,
        { op: 'insert', components: { regions: [{ id: 'orders', type: 'staticContent', name: 'x' }] } },
      ],
      'TARGET_EXISTS',
    ],
    [
      [
        { op: 'set', target: 'page', property: 'title', value: 'A' },
        { op: 'set', target: 'page', property: 'title', value: 'B' },
      ],
      'TRANSFORM_CONFLICT',
    ],
    [
      [filter, { op: 'insert', components: { refreshes: [{ items: ['P7_MISSING'], regions: ['orders'] }] } }],
      'TARGET_NOT_FOUND',
    ],
  ];
  for (const [operations, code] of failures) {
    await assert.rejects(editPage(ctx, { page: '7', operations, expectedDigest: digestOf(PAGE) }), { code });
    assert.equal(await readFile(file, 'utf8'), PAGE, code);
  }
});

test('a stale digest is a conflict checked under the edit lock; dry runs never write', async (t) => {
  const { ctx, file } = await page(t);
  const dry = await editPage(ctx, { page: '7', operations: compound, dryRun: true });
  assert.equal(dry.written, false);
  assert.equal(await readFile(file, 'utf8'), PAGE);
  await assert.rejects(editPage(ctx, { page: '7', operations: compound }), {
    code: 'EXPECTED_DIGEST_REQUIRED',
  });
  await assert.rejects(
    editPage(ctx, { page: '7', operations: compound, expectedDigest: digestOf('older') }),
    { code: 'TRANSFORM_CONFLICT' },
  );
  assert.equal(await readFile(file, 'utf8'), PAGE);
});

test('operations target only the snapshot read: an inserted region cannot be set in the same transaction', () => {
  assert.throws(
    () =>
      transformPage(
        PAGE,
        '7',
        editGroups([filter, { op: 'set', target: 'region:filters', property: 'title', value: 'x' }]),
      ),
    { code: 'TARGET_NOT_FOUND' },
  );
});

test('the MCP project action edit reaches the same transaction', async (t) => {
  const { dispatch } = await import('../../packages/core/src/service.ts');
  const { ctx, file } = await page(t);
  const first = await dispatch('project', {
    project: ctx.root,
    action: 'edit',
    page: '7',
    operations: compound,
  });
  assert.equal(first.ok, false);
  assert.equal((first.data as { currentDigest: string }).currentDigest, digestOf(PAGE));
  const applied = await dispatch('project', {
    project: ctx.root,
    action: 'edit',
    page: '7',
    operations: compound,
    expectedDigest: digestOf(PAGE),
  });
  assert.equal(applied.ok, true, JSON.stringify(applied.diagnostics));
  assert.notEqual(await readFile(file, 'utf8'), PAGE);
});

test('a successful edit returns the context delta of the bytes it wrote', async (t) => {
  const { ctx, file } = await page(t);
  const applied = await editPage(ctx, { page: '7', operations: compound, expectedDigest: digestOf(PAGE) });
  const delta = applied.context as import('../../packages/core/src/edit/context.ts').ContextDelta;
  assert.equal(delta.digest, digestOf(await readFile(file, 'utf8')));
  assert.equal(delta.digest, applied.afterDigest);
  // Changed and inserted targets carry their values; unchanged ones are left out; moved lines do not count.
  assert.deepEqual(
    delta.changed.map((entry) => entry.target),
    ['page', 'region:orders'],
  );
  assert.equal(delta.changed[0]!.title, 'Open orders');
  assert.match(String(delta.changed[1]!.query), /status = :P7_STATUS/u);
  assert.deepEqual(
    delta.inserted.map((entry) => entry.target),
    ['column:orders.STATUS', 'region:filters', 'item:P7_STATUS'],
  );
  assert.deepEqual(delta.removed, []);
  assert.ok(!delta.changed.some((entry) => entry.target === 'item:P7_SEARCH'));

  // The returned digest and targets are directly usable for the next edit.
  const next = await editPage(ctx, {
    page: '7',
    operations: [{ op: 'set', target: 'item:P7_STATUS', property: 'label', value: 'Order status' }],
    expectedDigest: delta.digest,
  });
  assert.equal(next.written, true);
  const second = next.context as typeof delta;
  assert.deepEqual(
    second.changed.map((entry) => [entry.target, entry.label]),
    [['item:P7_STATUS', 'Order status']],
  );
  // An edit made by someone else in between is still a conflict.
  await writeFile(file, (await readFile(file, 'utf8')) + '\n');
  await assert.rejects(
    editPage(ctx, {
      page: '7',
      operations: [{ op: 'set', target: 'page', property: 'title', value: 'x' }],
      expectedDigest: second.digest,
    }),
    { code: 'TRANSFORM_CONFLICT' },
  );
});

test('removed columns are listed; full and none context modes are available', async (t) => {
  const { ctx } = await page(t);
  const dropped = await editPage(ctx, {
    page: '7',
    dryRun: true,
    operations: [
      {
        op: 'set',
        target: 'region:orders',
        property: 'query',
        value: 'select id, status from orders',
        columns: [{ name: 'STATUS' }],
      },
    ],
  });
  const delta = dropped.context as import('../../packages/core/src/edit/context.ts').ContextDelta;
  assert.deepEqual(delta.removed, ['column:orders.AMOUNT']);
  const full = await editPage(ctx, { page: '7', dryRun: true, operations: [compound[0]!], context: 'full' });
  assert.equal((full.context as { page: { title: string } }).page.title, 'Open orders');
  const none = await editPage(ctx, { page: '7', dryRun: true, operations: [compound[0]!], context: 'none' });
  assert.equal(none.context, undefined);
});
