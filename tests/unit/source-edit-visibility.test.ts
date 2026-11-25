import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import { editGroups, editPage, type EditOperation } from '../../packages/core/src/edit/page-edit.ts';
import { transformPage } from '../../packages/core/src/edit/transaction.ts';
import { contextOf } from '../../packages/core/src/edit/context.ts';
import { digestOf } from '../../packages/core/src/edit/apexlang-edit.ts';

const PAGE = `page 6 (
    name: Orders
    region orders (
        name: Orders
        type: interactiveReport
        source {
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select id, customer, amount, secret from orders
                \`\`\`
        }
        column ID (
            type: plainText
            layout {
                sequence: 10
            }
        )
        column CUSTOMER (
            type: plainText
            heading {
                heading: Customer
            }
            layout {
                sequence: 20
            }
        )
        column AMOUNT (
            type: plainText
            layout {
                sequence: 30
            }
        )
        column SECRET (
            type: hidden
            layout {
                sequence: 40
            }
        )
        savedReport 1 (
            visibility: primaryDefault
            displayColumn ID (
                sequence: 1
            )
            displayColumn AMOUNT (
                sequence: 2
            )
        )
    )
    region recent (
        name: Recent
        type: classicReport
        source {
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select id, name from customers
                \`\`\`
        }
        column ID (
            type: hidden
        )
        column NAME (
            type: link
            link {
                target: {
                    page: 2
                }
            }
        )
    )
)
`;
const apply = (operations: EditOperation[], source = PAGE) =>
  transformPage(source, '6', editGroups(operations)).result;
const visible = (text: string) =>
  Object.fromEntries(
    contextOf(text, 'p.apx')
      .regions.flatMap((region) => region.columns)
      .map((column) => [column.target, column.visible]),
  );
const set = (target: string, value: string): EditOperation => ({
  op: 'set',
  target,
  property: 'visible',
  value,
});

test('hide and show round-trip through context without changing identity or the query', () => {
  assert.deepEqual(visible(PAGE), {
    'column:orders.ID': true,
    'column:orders.CUSTOMER': false,
    'column:orders.AMOUNT': true,
    'column:orders.SECRET': false,
    'column:recent.ID': false,
    'column:recent.NAME': true,
  });
  const shown = apply([set('column:orders.CUSTOMER', 'true'), set('column:recent.ID', 'true')]);
  assert.equal(visible(shown)['column:orders.CUSTOMER'], true);
  assert.equal(visible(shown)['column:recent.ID'], true);
  // CUSTOMER takes its place by column order: between ID and AMOUNT in the default report.
  const order = (text: string) =>
    [...text.matchAll(/displayColumn (\w+) \(\n\s+sequence: (\d+)/gu)]
      .sort((x, y) => Number(x[2]) - Number(y[2]))
      .map((match) => match[1]);
  assert.deepEqual(order(shown), ['ID', 'CUSTOMER', 'AMOUNT']);
  assert.ok(shown.includes('                select id, customer, amount, secret from orders\n'));
  const hidden = apply([set('column:orders.CUSTOMER', 'false'), set('column:recent.ID', 'false')], shown);
  assert.deepEqual(visible(hidden), visible(PAGE));
  // Hiding and showing back restores the report's display list; the column declarations keep their bytes.
  assert.ok(
    hidden.includes(
      '        column CUSTOMER (\n            type: plainText\n            heading {\n                heading: Customer\n',
    ),
  );
  // Setting the current state again changes nothing.
  assert.equal(apply([set('column:orders.ID', 'true')]), PAGE);
});

test('visibility, heading, format and sequence combine in one atomic batch', () => {
  const result = apply([
    set('column:orders.CUSTOMER', 'true'),
    { op: 'set', target: 'column:orders.CUSTOMER', property: 'heading', value: 'Client' },
    { op: 'set', target: 'column:orders.AMOUNT', property: 'format', value: 'FML999G990D00' },
    { op: 'set', target: 'column:orders.AMOUNT', property: 'sequence', value: '15' },
  ]);
  const columns = contextOf(result, 'p.apx').regions[0]!.columns;
  assert.deepEqual(
    columns.map((column) => [column.target, column.heading, column.format, column.sequence, column.visible]),
    [
      ['column:orders.ID', undefined, undefined, '10', true],
      ['column:orders.CUSTOMER', 'Client', undefined, '20', true],
      ['column:orders.AMOUNT', undefined, 'FML999G990D00', '15', true],
      ['column:orders.SECRET', undefined, undefined, '40', false],
    ],
  );
});

test('structural columns, link columns, invalid values and stale digests are refused', async (t) => {
  const refuse = (operation: EditOperation, code: string) =>
    assert.throws(() => apply([operation]), { code }, code);
  refuse(set('column:orders.SECRET', 'true'), 'OPERATION_UNSUPPORTED');
  refuse(set('column:recent.NAME', 'false'), 'OPERATION_UNSUPPORTED');
  refuse(set('column:orders.ID', 'maybe'), 'INVALID_INPUT');
  refuse(set('column:orders.NOPE', 'true'), 'TARGET_NOT_FOUND');
  refuse({ op: 'set', target: 'item:P6_X', property: 'visible', value: 'true' }, 'TARGET_NOT_FOUND');
  assert.throws(
    () =>
      apply(
        [set('column:orders.ID', 'true')],
        PAGE.replace(/        savedReport 1 \([\s\S]*?\n        \)\n/u, ''),
      ),
    { code: 'OPERATION_UNSUPPORTED' },
  );
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const file = path.join(ctx.root, 'src/apex/app/pages/p00006-orders.apx');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, PAGE);
  await assert.rejects(
    editPage(ctx, {
      page: '6',
      operations: [set('column:orders.CUSTOMER', 'true')],
      expectedDigest: digestOf('x'),
    }),
    { code: 'TRANSFORM_CONFLICT' },
  );
});

test('the local preview renders the visibility change', async (t) => {
  const { PreviewServer } = await import('../../packages/core/src/preview/server.ts');
  const { workspace } = await import('../fixtures/preview.ts');
  const page = PAGE.replace('    name: Orders\n', '    name: Orders\n    alias: ORDERS\n').replaceAll(
    'heading: Customer',
    'heading: Customer name',
  );
  const edited = apply(
    [
      set('column:orders.CUSTOMER', 'true'),
      set('column:orders.AMOUNT', 'false'),
      set('column:recent.ID', 'true'),
    ],
    page,
  ).replaceAll('\n    alias: ORDERS', '\n    alias: ORDERS');
  const { app, assets } = await workspace(t, {
    '.apex-local/01-schema.sql': `create table orders (id integer, customer varchar2(50), amount number, secret varchar2(10));
insert into orders values (1, 'Ada', 10, 'x');
create table customers (id integer, name varchar2(50));
insert into customers values (7, 'Grace');
`,
  });
  const render = async (text: string) => {
    await writeFile(path.join(app, 'pages/p00006-orders.apx'), text);
    const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
    await server.start();
    try {
      return await (await fetch(`${server.url}/r/demo/orders`)).text();
    } finally {
      await server.stop();
    }
  };
  // Table headers show what is displayed (the report's column menu lists every column).
  const before = await render(page);
  assert.doesNotMatch(before, /id="orders_CUSTOMER"/u);
  assert.match(before, /id="orders_AMOUNT"/u);
  assert.doesNotMatch(before, /<th id="ID">/u);
  const after = await render(edited);
  assert.match(after, /id="orders_CUSTOMER"/u);
  assert.doesNotMatch(after, /id="orders_AMOUNT"/u);
  assert.match(after, /<th id="ID">/u);
  assert.match(after, />Ada</u);
});
