import test from 'node:test';
import assert from 'node:assert/strict';
import { editGroups, type EditOperation } from '../../packages/core/src/edit/page-edit.ts';
import { transformPage } from '../../packages/core/src/edit/transaction.ts';
import { parseApexLang } from '../../packages/core/src/edit/apexlang-edit.ts';

const PAGE = `page 4 (
    name: Orders
    region orders (
        name: Orders
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select id, customer, amount from orders
                \`\`\`
        }

        column ID (
            type: plainText
            heading {
                heading: ID
            }
            layout {
                sequence: 10
            }
        )

        column CUSTOMER (
            type: link
            heading {
                heading: Customer
            }
            layout {
                sequence: 20
            }
            link {
                target: {
                    page: 5
                }
            }
        )

        column AMOUNT (
            type: plainText
            heading {
                heading: Amount
            }
            layout {
                sequence: 30
            }
            appearance {
                formatMask: FML999G990D00
            }
        )

        savedReport 1001 (
            visibility: primaryDefault
            view {
                rowsPerPage: 25
            }

            displayColumn ID (
                sequence: 1
            )

            displayColumn CUSTOMER (
                sequence: 2
            )

            displayColumn AMOUNT (
                sequence: 3
            )

            sort (
                column: AMOUNT
                sort {
                    direction: desc
                    sequence: 1
                }
            )
        )
    )
    region recent (
        name: Recent
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select id, amount from orders
                \`\`\`
        }
        column ID (
            type: plainText
            layout {
                sequence: 1
            }
        )
        column AMOUNT (
            type: plainText
            layout {
                sequence: 2
            }
        )
    )
)
`;
const SQL = 'select id, customer, status, amount from orders';
const apply = (operations: EditOperation[], release: '26.1' | '26.2' = '26.2') =>
  transformPage(PAGE, '4', editGroups(operations), release).result;
const region = (text: string, id: string) =>
  parseApexLang(text)[0]!.children.find((c) => c.type === 'region' && c.id === id)!;
const order = (text: string, id: string) =>
  region(text, id)
    .children.filter((c) => c.type === 'column')
    .sort(
      (a, b) =>
        Number((a.props.layout as { sequence: string }).sequence) -
        Number((b.props.layout as { sequence: string }).sequence),
    )
    .map((c) => c.id);
const shown = (text: string) =>
  region(text, 'orders')
    .children.find((c) => c.type === 'savedReport')!
    .children.filter((c) => c.type === 'displayColumn')
    .sort((a, b) => Number(a.props.sequence) - Number(b.props.sequence))
    .map((c) => c.id);

test('addColumn places the new column at the start, in the middle or at the end of report and default report', () => {
  const middle = apply([
    {
      op: 'addColumn',
      region: 'orders',
      sql: SQL,
      column: { name: 'STATUS', heading: 'Status', dataType: 'varchar2' },
      after: 'CUSTOMER',
    },
  ]);
  assert.deepEqual(order(middle, 'orders'), ['ID', 'CUSTOMER', 'STATUS', 'AMOUNT']);
  assert.deepEqual(shown(middle), ['ID', 'CUSTOMER', 'STATUS', 'AMOUNT']);
  // A gap is used: retained columns keep every byte, including their sequences, link and format.
  for (const kept of [
    '        column CUSTOMER (\n            type: link\n            heading {\n                heading: Customer\n            }\n            layout {\n                sequence: 20\n            }\n            link {\n                target: {\n                    page: 5\n                }\n            }\n        )',
    '                formatMask: FML999G990D00',
  ])
    assert.ok(middle.includes(kept));
  assert.match(
    middle,
    /column STATUS \(\n {12}type: plainText[\s\S]*?sequence: 25[\s\S]*?dataType: varchar2/u,
  );
  // The new column component sits with the other columns, before the saved report.
  assert.ok(middle.indexOf('column STATUS (') < middle.indexOf('savedReport 1001 ('));
  // The sort that references AMOUNT is untouched.
  assert.ok(middle.includes('            sort (\n                column: AMOUNT\n'));

  const start = apply([
    { op: 'addColumn', region: 'orders', sql: SQL, column: { name: 'STATUS' }, before: 'ID' },
  ]);
  assert.deepEqual(order(start, 'orders'), ['STATUS', 'ID', 'CUSTOMER', 'AMOUNT']);
  assert.deepEqual(shown(start), ['STATUS', 'ID', 'CUSTOMER', 'AMOUNT']);
  const end = apply([{ op: 'addColumn', region: 'orders', sql: SQL, column: { name: 'STATUS' } }]);
  assert.deepEqual(order(end, 'orders'), ['ID', 'CUSTOMER', 'AMOUNT', 'STATUS']);
  assert.deepEqual(shown(end), ['ID', 'CUSTOMER', 'AMOUNT', 'STATUS']);
  // Without a gap the classic report is renumbered; 26.1 sources get the 26.1 data type spelling.
  const classic = apply(
    [
      {
        op: 'addColumn',
        region: 'recent',
        sql: 'select id, status, amount from orders',
        column: { name: 'STATUS', dataType: 'varchar2' },
        after: 'ID',
      },
    ],
    '26.1',
  );
  assert.deepEqual(order(classic, 'recent'), ['ID', 'STATUS', 'AMOUNT']);
  assert.match(classic, /dataType: STRING/u);
});

test('orderColumns reorders columns and the default report without touching the SQL', () => {
  const result = apply([{ op: 'orderColumns', region: 'orders', order: ['AMOUNT', 'ID', 'CUSTOMER'] }]);
  assert.deepEqual(order(result, 'orders'), ['AMOUNT', 'ID', 'CUSTOMER']);
  assert.deepEqual(shown(result), ['AMOUNT', 'ID', 'CUSTOMER']);
  assert.ok(result.includes('                select id, customer, amount from orders\n'));
  assert.throws(() => apply([{ op: 'orderColumns', region: 'orders', order: ['AMOUNT', 'ID'] }]), {
    code: 'INVALID_INPUT',
  });
});

test('the query patch keeps saved reports consistent and refuses dropping a referenced column', () => {
  const kept = apply([
    {
      op: 'set',
      target: 'region:orders',
      property: 'query',
      value: 'select id, amount, status from orders',
      columns: [{ name: 'ID' }, { name: 'AMOUNT' }, { name: 'STATUS' }],
    },
  ]);
  // CUSTOMER leaves the columns and the default report; STATUS joins both at the end.
  assert.deepEqual(order(kept, 'orders'), ['ID', 'AMOUNT', 'STATUS']);
  assert.deepEqual(shown(kept), ['ID', 'AMOUNT', 'STATUS']);
  assert.throws(
    () =>
      apply([
        {
          op: 'set',
          target: 'region:orders',
          property: 'query',
          value: 'select id, customer from orders',
          columns: [{ name: 'ID' }, { name: 'CUSTOMER' }],
        },
      ]),
    (error: { code: string; message: string }) =>
      error.code === 'COLUMN_REFERENCED' && /sort/u.test(error.message),
  );
});

test('invalid additions and conflicting column edits are refused', () => {
  const refuse = (operations: EditOperation[], code: string) =>
    assert.throws(() => apply(operations), { code }, code);
  refuse([{ op: 'addColumn', region: 'orders', sql: SQL, column: { name: 'AMOUNT' } }], 'TARGET_EXISTS');
  refuse(
    [{ op: 'addColumn', region: 'orders', sql: 'select id, status from orders', column: { name: 'STATUS' } }],
    'COLUMN_NOT_IN_QUERY',
  );
  refuse(
    [{ op: 'addColumn', region: 'orders', sql: SQL, column: { name: 'STATUS' }, after: 'NOPE' }],
    'TARGET_NOT_FOUND',
  );
  refuse(
    [
      { op: 'addColumn', region: 'orders', sql: SQL, column: { name: 'STATUS' } },
      { op: 'orderColumns', region: 'orders', order: ['AMOUNT', 'ID', 'CUSTOMER'] },
    ],
    'TRANSFORM_CONFLICT',
  );
  refuse(
    [
      { op: 'addColumn', region: 'orders', sql: SQL, column: { name: 'STATUS' } },
      { op: 'set', target: 'region:orders', property: 'title', value: 'x' },
      {
        op: 'set',
        target: 'region:orders',
        property: 'query',
        value: SQL,
        columns: [{ name: 'ID' }, { name: 'CUSTOMER' }, { name: 'STATUS' }, { name: 'AMOUNT' }],
      },
    ],
    'TRANSFORM_CONFLICT',
  );
});
