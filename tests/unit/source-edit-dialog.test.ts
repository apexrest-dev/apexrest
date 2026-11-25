import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import { editPage, type EditOperation } from '../../packages/core/src/edit/page-edit.ts';
import { digestOf, parseApexLang, readProperty } from '../../packages/core/src/edit/apexlang-edit.ts';

const LIST = `page 10 (
    name: Customers
    region customers (
        name: Customers
        type: interactiveReport
        source {
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select id, name from customers
                \`\`\`
        }
        link {
            linkColumn: exclude
        }
        column ID (
            id: 31415926535
            type: plainText
        )
        column NAME (
            type: plainText
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
            type: plainText
        )
        column NAME (
            type: plainText
        )
    )
    dynamicAction dialog-closed-customers (
        name: Refresh customers after dialog
        when {
            event: apexafterclosedialog
            selectionType: region
            region: @customers
        }
        action refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @customers
            }
        )
    )
)
`;
const MODAL = `page 20 (
    name: Customer
    appearance {
        pageMode: modalDialog
    }
    pageItem P20_ID (
        type: hidden
    )
    process save (
        type: formAutomaticRowProcessing
    )
)
`;
const NORMAL = `page 30 (
    name: Report
    pageItem P30_ID (
        type: hidden
    )
)
`;

async function project(t: test.TestContext) {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const dir = path.join(ctx.root, 'src/apex/app/pages');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'p00010-customers.apx'), LIST);
  await writeFile(path.join(dir, 'p00020-customer.apx'), MODAL);
  await writeFile(path.join(dir, 'p00030-report.apx'), NORMAL);
  return { ctx, file: path.join(dir, 'p00010-customers.apx') };
}
const edit = (ctx: Awaited<ReturnType<typeof project>>['ctx'], operations: EditOperation[]) =>
  editPage(ctx, { page: '10', operations, expectedDigest: digestOf(LIST) });

test('a row link opens the modal page with item mappings and reuses the existing dialog-closed refresh', async (t) => {
  const { ctx, file } = await project(t);
  const result = await edit(ctx, [
    {
      op: 'addDialogAction',
      link: { region: 'customers' },
      target: { page: 20, items: { P20_ID: '#ID#' }, clearCache: [20] },
    },
  ]);
  assert.equal(result.written, true);
  const text = await readFile(file, 'utf8');
  assert.ok(
    text.includes(
      '        link {\n            linkColumn: customTarget\n            target: {\n                page: 20\n',
    ),
  );
  assert.ok(!text.includes('linkColumn: exclude'));
  assert.ok(text.includes('id: 31415926535'));
  const [page] = parseApexLang(text);
  const customers = page!.children.find((c) => c.id === 'customers')!;
  assert.deepEqual(readProperty(customers, 'link.target'), {
    page: '20',
    items: { P20_ID: '#ID#' },
    clearCache: '20',
  });
  // The existing refresh covers this link: no second dynamic action.
  assert.equal(page!.children.filter((c) => c.type === 'dynamicAction').length, 1);
  // A modal page that changes data without page authorization is reported, not changed.
  assert.match(String(result.warnings?.[0]), /authorization/u);
  assert.equal(await readFile(path.join(path.dirname(file), 'p00020-customer.apx'), 'utf8'), MODAL);
});

test('a classic column link and a button each get their own native dialog-closed refresh', async (t) => {
  const { ctx, file } = await project(t);
  await edit(ctx, [
    {
      op: 'addDialogAction',
      link: { region: 'recent', column: 'NAME' },
      target: { page: 20, items: { P20_ID: '#ID#' } },
    },
    {
      op: 'addDialogAction',
      button: { id: 'create', label: 'Create', region: 'customers' },
      target: { page: 20, clearCache: [20] },
      refresh: 'customers',
    },
  ]);
  const [page] = parseApexLang(await readFile(file, 'utf8'));
  const name = page!.children.find((c) => c.id === 'recent')!.children.find((c) => c.id === 'NAME')!;
  assert.equal(name.props.type, 'link');
  assert.equal(readProperty(name, 'link.linkText'), '#NAME#');
  const button = page!.children.find((c) => c.type === 'button' && c.id === 'create')!;
  assert.equal(readProperty(button, 'behavior.action'), 'redirectThisApp');
  assert.equal(readProperty(button, 'layout.slot'), 'NEXT');
  const actions = page!.children
    .filter((c) => c.type === 'dynamicAction')
    .map((c) => [c.id, readProperty(c, 'when.selectionType')]);
  assert.deepEqual(actions, [
    ['dialog-closed-customers', 'region'],
    ['dialog-closed-recent', 'region'],
    ['dialog-closed-customers-2', 'button'],
  ]);
});

test('non-modal targets, unknown items or columns, duplicates and a stale modal page are refused', async (t) => {
  const { ctx, file } = await project(t);
  const refuse = async (operation: EditOperation, code: string) => {
    await assert.rejects(edit(ctx, [operation]), { code }, code);
    assert.equal(await readFile(file, 'utf8'), LIST);
  };
  const link = { region: 'customers' };
  await refuse({ op: 'addDialogAction', link, target: { page: 30 } }, 'TARGET_NOT_MODAL');
  await refuse({ op: 'addDialogAction', link, target: { page: 99 } }, 'TARGET_NOT_FOUND');
  await refuse(
    { op: 'addDialogAction', link, target: { page: 20, items: { P20_NOPE: '1' } } },
    'TARGET_NOT_FOUND',
  );
  await refuse(
    { op: 'addDialogAction', link, target: { page: 20, items: { P20_ID: '#NOPE#' } } },
    'TARGET_NOT_FOUND',
  );
  await refuse({ op: 'addDialogAction', link: { region: 'recent' }, target: { page: 20 } }, 'INVALID_INPUT');
  await refuse(
    { op: 'addDialogAction', button: { id: 'go', label: 'Go', region: 'customers' }, target: { page: 20 } },
    'INVALID_INPUT',
  );
  await refuse(
    {
      op: 'addDialogAction',
      link,
      target: { page: 20 },
      expectedTargetDigest: digestOf('an older modal page'),
    },
    'TRANSFORM_CONFLICT',
  );
  const bound = await edit(ctx, [
    { op: 'addDialogAction', link, target: { page: 20 }, expectedTargetDigest: digestOf(MODAL) },
  ]);
  assert.equal(bound.written, true);
});
