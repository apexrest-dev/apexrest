import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import { editGroups, editPage, type EditOperation } from '../../packages/core/src/edit/page-edit.ts';
import { transformPage } from '../../packages/core/src/edit/transaction.ts';
import { digestOf, parseApexLang, readProperty } from '../../packages/core/src/edit/apexlang-edit.ts';

const PAGE = `page 5 (
    name: Layout
    region left (
        name: Left
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
    )
    region right (
        name: Right
        type: staticContent
        layout {
            sequence: 20
            slot: body
        }
    )
    region nested (
        name: Nested
        type: staticContent
        layout {
            parentRegion: @left
            slot: subRegions
            sequence: 10
        }
    )
    pageItem P5_NAME (
        id: 141421356
        type: textField
        layout {
            sequence: 10
            region: @left
            slot: regionBody
        }
    )
    button save (
        label: Save
    )
    dynamicAction on-name (
        name: On name
        when {
            event: change
            selectionType: items
            items: P5_NAME
        }
    )
)
`;
const apply = (operations: EditOperation[]) => transformPage(PAGE, '5', editGroups(operations)).result;
const component = (text: string, type: string, id: string) =>
  parseApexLang(text)[0]!.children.find((c) => c.type === type && c.id === id)!;
const ref = (value: unknown) => (value as { ref?: string } | undefined)?.ref;

test('an item moves to another region and slot; only its layout lines change', () => {
  const result = apply([
    { op: 'moveComponent', component: 'item:P5_NAME', to: { region: 'right', slot: 'body', sequence: 5 } },
  ]);
  const item = component(result, 'pageItem', 'P5_NAME');
  assert.equal(ref(readProperty(item, 'layout.region')), 'right');
  assert.equal(readProperty(item, 'layout.slot'), 'body');
  assert.equal(readProperty(item, 'layout.sequence'), '5');
  assert.ok(
    result.includes(
      '        id: 141421356\n        type: textField\n        layout {\n            sequence: 5\n            region: @right\n            slot: body\n        }',
    ),
  );
  // The dynamic action that references the item is untouched and still resolves.
  assert.ok(result.includes('            items: P5_NAME\n'));
});

test('regions move under another parent or back to page level; a button gets a layout group', () => {
  const up = apply([{ op: 'moveComponent', component: 'region:nested', to: { slot: 'body' } }]);
  const nested = component(up, 'region', 'nested');
  assert.equal(readProperty(nested, 'layout.parentRegion'), undefined);
  assert.equal(readProperty(nested, 'layout.slot'), 'body');
  const down = apply([
    { op: 'moveComponent', component: 'region:right', to: { region: 'left', slot: 'subRegions' } },
  ]);
  assert.equal(ref(readProperty(component(down, 'region', 'right'), 'layout.parentRegion')), 'left');
  const button = apply([
    { op: 'moveComponent', component: 'button:save', to: { region: 'right', slot: 'next', sequence: 10 } },
  ]);
  assert.ok(
    button.includes(
      '    button save (\n        label: Save\n        layout {\n            region: @right\n            slot: next\n            sequence: 10\n        }\n    )',
    ),
  );
});

test('a pure sequence change uses the existing patch path', () => {
  const result = apply([{ op: 'set', target: 'item:P5_NAME', property: 'sequence', value: '30' }]);
  assert.equal(readProperty(component(result, 'pageItem', 'P5_NAME'), 'layout.sequence'), '30');
});

test('invalid slots, missing or cyclic destinations and stale sources are refused without writing', async (t) => {
  const refuse = (operation: EditOperation, code: string) =>
    assert.throws(() => apply([operation]), { code }, code);
  refuse(
    { op: 'moveComponent', component: 'item:P5_NAME', to: { region: 'right', slot: 'dialogFooter' } },
    'OPERATION_UNSUPPORTED',
  );
  refuse(
    { op: 'moveComponent', component: 'region:left', to: { slot: 'contentBody' } },
    'OPERATION_UNSUPPORTED',
  );
  refuse(
    { op: 'moveComponent', component: 'item:P5_NAME', to: { region: 'missing', slot: 'body' } },
    'TARGET_NOT_FOUND',
  );
  refuse({ op: 'moveComponent', component: 'item:P5_NAME', to: { slot: 'body' } }, 'INVALID_INPUT');
  refuse(
    { op: 'moveComponent', component: 'region:left', to: { region: 'nested', slot: 'subRegions' } },
    'INVALID_INPUT',
  );
  refuse({ op: 'moveComponent', component: 'chart:x', to: { slot: 'body' } }, 'INVALID_INPUT');
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const file = path.join(ctx.root, 'src/apex/app/pages/p00005-layout.apx');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, PAGE);
  await assert.rejects(
    editPage(ctx, {
      page: '5',
      operations: [{ op: 'moveComponent', component: 'item:P5_NAME', to: { region: 'right', slot: 'body' } }],
      expectedDigest: digestOf('older'),
    }),
    { code: 'TRANSFORM_CONFLICT' },
  );
  assert.equal(await readFile(file, 'utf8'), PAGE);
});
