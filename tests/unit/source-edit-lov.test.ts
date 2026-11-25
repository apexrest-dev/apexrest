import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import { lovContext, lovEdit } from '../../packages/core/src/edit/lov.ts';
import { digestOf } from '../../packages/core/src/edit/apexlang-edit.ts';

const STATUS = `lov status (
    name: STATUS
    source {
        location: staticValues
    }
    // Kept comment.

    entry active (
        id: 27182818284
        sequence: 1
        display: Active
        return: A
    )

    entry inactive (
        sequence: 2
        display: Inactive
        return: I
    )

)
`;
const CUSTOMERS = `lov customers (
    name: CUSTOMERS
    source {
        location: localDatabase
        type: sqlQuery
        sqlQuery:
            \`\`\`sql
            select name d, id r from customers
            \`\`\`
    }
    columnMapping {
        display: D
        return: R
    }
)
`;
const PAGE = `page 3 (
    name: Filter
    pageItem P3_STATUS (
        type: selectList
        lov {
            type: sharedComponent
            lov: @status
        }
    )
)
`;

async function project(t: test.TestContext, release: '26.1' | '26.2' = '26.2') {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const app = path.join(ctx.root, 'src/apex/app');
  await mkdir(path.join(app, '.apex'), { recursive: true });
  await writeFile(path.join(app, '.apex/apexlang.json'), JSON.stringify({ mmdVersion: `${release}.0` }));
  await mkdir(path.join(app, 'pages'), { recursive: true });
  await writeFile(path.join(app, 'pages/p00003-filter.apx'), PAGE);
  const files = { status: '', customers: '' };
  if (release === '26.2') {
    await mkdir(path.join(app, 'shared-components/lovs'), { recursive: true });
    files.status = path.join(app, 'shared-components/lovs/status.apx');
    files.customers = path.join(app, 'shared-components/lovs/customers.apx');
    await writeFile(files.status, STATUS);
    await writeFile(files.customers, CUSTOMERS);
  } else {
    await mkdir(path.join(app, 'shared-components'), { recursive: true });
    files.status = files.customers = path.join(app, 'shared-components/lovs.apx');
    await writeFile(files.status, STATUS + '\n' + CUSTOMERS);
  }
  return { ctx, files };
}

test('static entries are replaced as an ordered list; kept entries keep their id and bytes', async (t) => {
  const { ctx, files } = await project(t);
  const context = await lovContext(ctx, 'STATUS');
  assert.equal(context.file, 'src/apex/app/shared-components/lovs/status.apx');
  assert.deepEqual(context.consumers, ['3']);
  assert.equal(context.scope, 'sharedComponent');
  const result = await lovEdit(ctx, {
    lov: 'status',
    entries: [
      { display: 'Active', return: 'A' },
      { display: 'On hold', return: 'H' },
      { display: 'Closed', return: 'C' },
    ],
    expectedDigest: context.digest,
  });
  assert.equal(result.written, true);
  const text = await readFile(files.status, 'utf8');
  assert.ok(
    text.includes(
      '    entry active (\n        id: 27182818284\n        sequence: 1\n        display: Active\n        return: A\n    )',
    ),
  );
  assert.ok(text.includes('// Kept comment.'));
  assert.ok(!text.includes('return: I'));
  assert.deepEqual(
    result.lov.entries?.map((entry) => [entry.id, entry.display, entry.return]),
    [
      ['active', 'Active', 'A'],
      ['h', 'On hold', 'H'],
      ['c', 'Closed', 'C'],
    ],
  );
  // A shared LOV is never reported as a page-only change.
  assert.equal(result.scope, 'sharedComponent');
  assert.equal(result.change?.affectedPages, 'unknown');
  // The other LOV file is untouched; a stale digest is a conflict.
  assert.equal(await readFile(files.customers, 'utf8'), CUSTOMERS);
  await assert.rejects(
    lovEdit(ctx, { lov: 'status', entries: [{ display: 'x', return: 'X' }], expectedDigest: context.digest }),
    { code: 'TRANSFORM_CONFLICT' },
  );
});

test('a SQL LOV gets complete replacement SQL; mismatched kinds and missing LOVs are refused', async (t) => {
  const { ctx, files } = await project(t);
  const { digest } = await lovContext(ctx, 'customers');
  await lovEdit(ctx, {
    lov: 'customers',
    query: { sql: 'select name d, id r from customers where active = 1 order by name' },
    expectedDigest: digest,
  });
  assert.match(
    await readFile(files.customers, 'utf8'),
    /^ {12}select name d, id r from customers where active = 1 order by name$/mu,
  );
  await assert.rejects(
    lovEdit(ctx, { lov: 'customers', entries: [{ display: 'x', return: 'X' }], dryRun: true }),
    {
      code: 'OPERATION_UNSUPPORTED',
    },
  );
  await assert.rejects(
    lovEdit(ctx, { lov: 'status', query: { sql: 'select 1 d, 1 r from dual' }, dryRun: true }),
    {
      code: 'OPERATION_UNSUPPORTED',
    },
  );
  await assert.rejects(lovContext(ctx, 'nope'), { code: 'TARGET_NOT_FOUND' });
  await assert.rejects(
    lovEdit(ctx, {
      lov: 'status',
      entries: [
        { display: 'a', return: 'A' },
        { display: 'b', return: 'A' },
      ],
      dryRun: true,
    }),
    { code: 'INVALID_INPUT' },
  );
});

test('26.1 keeps every LOV in one file: only the edited LOV changes', async (t) => {
  const { ctx, files } = await project(t, '26.1');
  const context = await lovContext(ctx, 'status');
  assert.equal(context.file, 'src/apex/app/shared-components/lovs.apx');
  await lovEdit(ctx, {
    lov: 'status',
    entries: [{ display: 'Active', return: 'A' }],
    expectedDigest: context.digest,
  });
  const text = await readFile(files.status, 'utf8');
  assert.ok(text.endsWith('\n' + CUSTOMERS));
  assert.ok(!text.includes('return: I'));
  assert.equal(digestOf(text), (await lovContext(ctx, 'customers')).digest);
});
