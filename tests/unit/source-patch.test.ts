import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import { patchPage, _forTests } from '../../packages/core/src/edit/patch.ts';
import { ApexLangDocument, digestOf, scalarText } from '../../packages/core/src/edit/apexlang-edit.ts';

const { transform } = _forTests;

/** A page with the constructs a lossless edit must keep byte for byte. */
const PAGE = [
  'page 7 (',
  '    name: Orders',
  '    title: Orders',
  '    // A line comment the editor must keep.',
  '    /* A block comment',
  '       over two lines */',
  '    region orders (',
  '        name: Commandes "ouvertes" — Überblick',
  '        type: interactiveReport',
  '        source {',
  '            sqlQuery:',
  '                ```sql',
  '                select id, amount, name: from orders -- heading { looks like a group',
  '                ```',
  '        }',
  '        link {',
  '            target: {',
  '                page: 8',
  '                items: {',
  '                    P8_ID: #ID#',
  '                }',
  '            }',
  '        }',
  '        column AMOUNT (',
  '            type: plainText',
  '            heading {',
  '                heading: Amount',
  '            }',
  '            layout {',
  '                sequence: 20',
  '            }',
  '        )',
  '        column NAME (',
  '            type: plainText',
  '        )',
  '    )',
  '    pageItem P7_SEARCH (',
  '        type: textField',
  '        layout {',
  '            sequence: 5',
  '        }',
  '    )',
  '    button create (',
  '        label: Create',
  '    )',
  ')',
  '',
].join('\n');

const changedLines = (before: string, after: string) => {
  const a = before.split(/(?<=\n)/u);
  const b = after.split(/(?<=\n)/u);
  return { removed: a.filter((line) => !b.includes(line)), added: b.filter((line) => !a.includes(line)) };
};

test('property edits replace only the value bytes and keep comments, literals and other components', () => {
  const { result } = transform(PAGE, '7', [
    { target: 'column:orders.AMOUNT', property: 'heading', value: 'Amount, EUR' },
    { target: 'region:orders', property: 'title', value: 'Offene Bestellungen' },
    { target: 'item:p7_search', property: 'sequence', value: '15' },
  ]);
  assert.deepEqual(changedLines(PAGE, result), {
    removed: [
      '        name: Commandes "ouvertes" — Überblick\n',
      '                heading: Amount\n',
      '            sequence: 5\n',
    ],
    added: [
      '        name: Offene Bestellungen\n',
      '                heading: Amount, EUR\n',
      '            sequence: 15\n',
    ],
  });
});

test('missing properties and groups are inserted with the file indentation and line endings', () => {
  const crlf = PAGE.replaceAll('\n', '\r\n');
  const { result } = transform(crlf, '7', [
    { target: 'column:orders.NAME', property: 'heading', value: 'Customer' },
    { target: 'column:orders.NAME', property: 'format', value: 'FM999G990D00' },
    { target: 'item:P7_SEARCH', property: 'label', value: 'Search' },
    { target: 'button:create', property: 'sequence', value: '30' },
  ]);
  assert.ok(!/[^\r]\n/u.test(result), 'every line keeps CRLF');
  assert.ok(
    result.includes(
      '        column NAME (\r\n            type: plainText\r\n            heading {\r\n                heading: Customer\r\n            }\r\n            appearance {\r\n                formatMask: FM999G990D00\r\n            }\r\n        )',
    ),
  );
  assert.ok(result.includes('        label {\r\n            label: Search\r\n        }\r\n    )'));
  assert.ok(result.includes('        layout {\r\n            sequence: 30\r\n        }\r\n    )\r\n)'));
  // Everything before the first insertion is unchanged.
  assert.equal(
    result.slice(0, crlf.indexOf('            type: plainText\r\n        )')),
    crlf.slice(0, crlf.indexOf('            type: plainText\r\n        )')),
  );
});

test('values that would read as references, booleans or quotes are written as quoted text', () => {
  assert.equal(scalarText('Amount, EUR'), 'Amount, EUR');
  assert.equal(scalarText('@home'), '"@home"');
  assert.equal(scalarText('true'), '"true"');
  assert.equal(scalarText(' padded'), '" padded"');
  assert.equal(scalarText('"quoted"'), '"\\"quoted\\""');
  assert.throws(() => scalarText('two\nlines'), /single-line/u);
  const { result } = transform(PAGE, '7', [{ target: 'page', property: 'title', value: '@orders' }]);
  assert.ok(result.includes('    title: "@orders"\n'));
});

test('unsupported, ambiguous, overlapping and malformed edits fail before anything is written', () => {
  const fail = (operations: Parameters<typeof transform>[2], code: string, source = PAGE) =>
    assert.throws(() => transform(source, '7', operations), { code });
  fail([{ target: 'column:orders.MISSING', property: 'heading', value: 'x' }], 'TARGET_NOT_FOUND');
  fail([{ target: 'region:orders', property: 'heading', value: 'x' }], 'OPERATION_UNSUPPORTED');
  fail([{ target: 'item:P7_SEARCH', property: 'sequence', value: '1.5' }], 'INVALID_INPUT');
  fail([{ target: 'chart:x', property: 'title', value: 'x' }], 'INVALID_INPUT');
  fail(
    [
      { target: 'region:orders', property: 'title', value: 'a' },
      { target: 'region:orders', property: 'title', value: 'b' },
    ],
    'TRANSFORM_CONFLICT',
  );
  const duplicate = PAGE.replace(
    '    pageItem P7_SEARCH (',
    '    region orders (\n        name: Second\n    )\n    pageItem P7_SEARCH (',
  );
  fail([{ target: 'region:orders', property: 'title', value: 'x' }], 'TARGET_AMBIGUOUS', duplicate);
  assert.throws(
    () => new ApexLangDocument(PAGE.replace('        )\n        column NAME', '        column NAME')),
    {
      code: 'TRANSFORM_UNSUPPORTED',
    },
  );
});

test('patch binds to the page file digest, rechecks it and reports the source change', async (t) => {
  const { ctx } = await fixture();
  const root = ctx.root;
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'src/apex/app/pages/p00007-orders.apx');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, PAGE);
  const operations = [{ target: 'column:orders.AMOUNT', property: 'heading' as const, value: 'Amount, EUR' }];

  await assert.rejects(
    patchPage(ctx, { page: '7', operations }),
    (error: { code: string; details?: { currentDigest?: string } }) => {
      assert.equal(error.code, 'EXPECTED_DIGEST_REQUIRED');
      assert.equal(error.details?.currentDigest, digestOf(PAGE));
      return true;
    },
  );
  const dry = await patchPage(ctx, { page: '7', operations, dryRun: true });
  assert.equal(dry.written, false);
  assert.equal(await readFile(file, 'utf8'), PAGE);

  await assert.rejects(patchPage(ctx, { page: '7', operations, expectedDigest: digestOf('stale') }), {
    code: 'TRANSFORM_CONFLICT',
  });
  const applied = await patchPage(ctx, { page: '7', operations, expectedDigest: digestOf(PAGE) });
  assert.equal(applied.written, true);
  assert.equal(applied.file, 'src/apex/app/pages/p00007-orders.apx');
  assert.equal(applied.afterDigest, digestOf(await readFile(file, 'utf8')));
  assert.deepEqual(applied.change?.changedFiles, ['src/apex/app/pages/p00007-orders.apx']);
  assert.deepEqual(applied.change?.affectedPages, ['7']);
  // Repeating the same request against the new base cannot apply silently.
  await assert.rejects(patchPage(ctx, { page: '7', operations, expectedDigest: digestOf(PAGE) }), {
    code: 'TRANSFORM_CONFLICT',
  });
  await assert.rejects(patchPage(ctx, { page: '99', operations, expectedDigest: digestOf(PAGE) }), {
    code: 'TARGET_NOT_FOUND',
  });
});

test('the MCP project action and the CLI operation share the coordinated patch path', async (t) => {
  const { dispatch } = await import('../../packages/core/src/service.ts');
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const file = path.join(ctx.root, 'src/apex/app/pages/p00007-orders.apx');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, PAGE);
  const operations = [{ target: 'button:create', property: 'label', value: 'New order' }];
  const dry = await dispatch('project', {
    project: ctx.root,
    action: 'patch',
    page: '7',
    operations,
    dryRun: true,
  });
  assert.equal(dry.ok, true);
  const digest = (dry.data as { beforeDigest: string }).beforeDigest;
  const bad = await dispatch('project', {
    project: ctx.root,
    action: 'patch',
    page: '7',
    operations: [{ target: 'button:create', property: 'colour', value: 'x' }],
    expectedDigest: digest,
  });
  assert.equal(bad.ok, false);
  assert.equal(await readFile(file, 'utf8'), PAGE);
  const applied = await dispatch('project.patch', {
    project: ctx.root,
    page: '7',
    operations,
    expectedDigest: digest,
  });
  assert.equal(applied.ok, true, JSON.stringify(applied.diagnostics));
  assert.match(await readFile(file, 'utf8'), /    button create \(\n        label: New order\n    \)/u);
});

test('a report query and its column contract change together, keeping kept columns intact', () => {
  const { result } = transform(PAGE, '7', [
    {
      target: 'region:orders',
      property: 'query',
      value: "select id, amount, status\n  from orders\n where status <> 'X'",
      columns: [
        { name: 'AMOUNT', heading: 'Amount, EUR' },
        { name: 'STATUS', heading: 'Status', dataType: 'varchar2' },
      ],
    },
  ]);
  // The fenced SQL is replaced with the fence's own indentation; the old body is gone.
  assert.ok(
    result.includes(
      "                ```sql\n                select id, amount, status\n                  from orders\n                 where status <> 'X'\n                ```",
    ),
  );
  assert.ok(!result.includes('heading { looks like a group'));
  // NAME is dropped, AMOUNT keeps its layout and gets the new heading, STATUS is added after it.
  assert.ok(!result.includes('column NAME ('));
  assert.ok(
    result.includes(
      '                heading: Amount, EUR\n            }\n            layout {\n                sequence: 20',
    ),
  );
  assert.ok(
    result.includes(
      '        column STATUS (\n            type: plainText\n            heading {\n                heading: Status\n            }\n            layout {\n                sequence: 30\n            }\n            source {\n                dataType: STRING\n            }\n        )\n    )',
    ),
  );
  // Everything outside the region is unchanged.
  assert.ok(result.endsWith(PAGE.slice(PAGE.indexOf('    pageItem P7_SEARCH ('))));
});

test('query edits refuse a column the query does not name and non-report regions', () => {
  assert.throws(
    () =>
      transform(PAGE, '7', [
        {
          target: 'region:orders',
          property: 'query',
          value: 'select id from orders',
          columns: [{ name: 'AMOUNT' }],
        },
      ]),
    { code: 'COLUMN_NOT_IN_QUERY' },
  );
  assert.throws(
    () =>
      transform(PAGE, '7', [
        { target: 'region:orders', property: 'query', value: 'select 1 from dual', columns: [] },
      ]),
    { code: 'INVALID_INPUT' },
  );
  const staticRegion = PAGE.replace('type: interactiveReport', 'type: staticContent');
  assert.throws(
    () =>
      transform(staticRegion, '7', [
        {
          target: 'region:orders',
          property: 'query',
          value: 'select amount from t',
          columns: [{ name: 'AMOUNT' }],
        },
      ]),
    { code: 'OPERATION_UNSUPPORTED' },
  );
});

test('page context lists editable targets with their values and the digest to patch with', async (t) => {
  const { pageContext } = await import('../../packages/core/src/edit/patch.ts');
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const file = path.join(ctx.root, 'src/apex/app/pages/p00007-orders.apx');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, PAGE);
  const context = await pageContext(ctx, '7');
  assert.equal(context.digest, digestOf(PAGE));
  assert.equal(context.page.title, 'Orders');
  const region = context.regions.find((entry) => entry.target === 'region:orders')!;
  assert.equal(region.type, 'interactiveReport');
  assert.match(String(region.query), /select id, amount, name: from orders/u);
  assert.deepEqual(
    region.columns.map((column) => column.target),
    ['column:orders.AMOUNT', 'column:orders.NAME'],
  );
  assert.equal(region.columns[0]!.heading, 'Amount');
  assert.deepEqual(
    context.items.map((item) => item.target),
    ['item:P7_SEARCH'],
  );
  assert.deepEqual(context.buttons, [{ target: 'button:create', label: 'Create', line: 43 }]);
});
