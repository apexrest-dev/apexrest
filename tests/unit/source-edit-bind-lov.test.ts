import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import { editPage, type EditOperation } from '../../packages/core/src/edit/page-edit.ts';
import { digestOf, parseApexLang, readProperty } from '../../packages/core/src/edit/apexlang-edit.ts';

const PAGE = `page 3 (
    name: Filter
    pageItem P3_REGION (
        type: selectList
    )
    pageItem P3_STATUS (
        id: 16180339887
        type: selectList
        label {
            label: Status
        }
        lov {
            type: staticValues
            staticValues: "STATIC:Active;A,Inactive;I"
            displayNullValue: true
            nullDisplayValue: - Select -
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )
    pageItem P3_NOTES (
        type: textarea
    )
)
`;
const STATUS = `lov status (
    name: STATUS
    source {
        location: staticValues
    }
    entry a (
        sequence: 1
        display: Active
        return: A
    )
)
`;

async function project(t: test.TestContext, release = '26.2') {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const app = path.join(ctx.root, 'src/apex/app');
  await mkdir(path.join(app, '.apex'), { recursive: true });
  await writeFile(path.join(app, '.apex/apexlang.json'), JSON.stringify({ mmdVersion: `${release}.0` }));
  await mkdir(path.join(app, 'pages'), { recursive: true });
  await mkdir(path.join(app, 'shared-components/lovs'), { recursive: true });
  const file = path.join(app, 'pages/p00003-filter.apx');
  await writeFile(file, PAGE);
  await writeFile(path.join(app, 'shared-components/lovs/status.apx'), STATUS);
  return { ctx, file };
}
const bind = (ctx: Awaited<ReturnType<typeof project>>['ctx'], operations: EditOperation[]) =>
  editPage(ctx, { page: '3', operations, expectedDigest: digestOf(PAGE) });

test('bindLov writes the shared reference, drops only the superseded source and keeps the rest', async (t) => {
  const { ctx, file } = await project(t);
  await bind(ctx, [
    {
      op: 'bindLov',
      item: 'P3_STATUS',
      lov: 'STATUS',
      expectedLovDigest: digestOf(STATUS),
      cascade: { parentItems: ['P3_REGION'], parentRequired: false },
    },
  ]);
  const text = await readFile(file, 'utf8');
  assert.ok(
    text.includes(
      '        lov {\n            type: sharedComponent\n            lov: @status\n            displayNullValue: true\n            nullDisplayValue: - Select -\n        }',
    ),
  );
  assert.ok(!text.includes('staticValues'));
  // Item id, label and session state protection keep their bytes.
  for (const kept of [
    'id: 16180339887',
    '            label: Status',
    'sessionStateProtection: checksumRequiredSessionLevel',
  ])
    assert.ok(text.includes(kept), kept);
  const item = parseApexLang(text)[0]!.children.find((c) => c.id === 'P3_STATUS')!;
  assert.equal(readProperty(item, 'cascadingLov.parentItems'), 'P3_REGION');
  assert.equal(readProperty(item, 'cascadingLov.parentRequired'), false);
});

test('null value settings can be replaced or removed and a cascade can be dropped', async (t) => {
  const { ctx, file } = await project(t);
  await bind(ctx, [
    {
      op: 'bindLov',
      item: 'P3_STATUS',
      lov: 'status',
      nullValue: { display: '- All -', return: '0' },
      displayExtraValues: false,
    },
    { op: 'bindLov', item: 'P3_REGION', lov: 'status', nullValue: false, cascade: null },
  ]);
  const [page] = parseApexLang(await readFile(file, 'utf8'));
  const status = page!.children.find((c) => c.id === 'P3_STATUS')!;
  assert.equal(readProperty(status, 'lov.nullDisplayValue'), '- All -');
  assert.equal(readProperty(status, 'lov.nullReturnValue'), '0');
  assert.equal(readProperty(status, 'lov.displayExtraValues'), false);
  const region = page!.children.find((c) => c.id === 'P3_REGION')!;
  assert.equal(readProperty(region, 'lov.displayNullValue'), false);
  assert.equal(readProperty(region, 'cascadingLov'), undefined);
});

test('missing LOVs and parents, non-list items, a stale LOV and 26.1 sources are refused', async (t) => {
  const { ctx, file } = await project(t);
  const refuse = async (operation: EditOperation, code: string) => {
    await assert.rejects(bind(ctx, [operation]), { code }, code);
    assert.equal(await readFile(file, 'utf8'), PAGE);
  };
  await refuse({ op: 'bindLov', item: 'P3_STATUS', lov: 'nope' }, 'TARGET_NOT_FOUND');
  await refuse({ op: 'bindLov', item: 'P3_NOTES', lov: 'status' }, 'OPERATION_UNSUPPORTED');
  await refuse(
    { op: 'bindLov', item: 'P3_STATUS', lov: 'status', cascade: { parentItems: ['P3_NOPE'] } },
    'TARGET_NOT_FOUND',
  );
  await refuse(
    { op: 'bindLov', item: 'P3_STATUS', lov: 'status', cascade: { parentItems: ['P3_STATUS'] } },
    'INVALID_INPUT',
  );
  await refuse(
    { op: 'bindLov', item: 'P3_STATUS', lov: 'status', expectedLovDigest: digestOf('older') },
    'TRANSFORM_CONFLICT',
  );
  const older = await project(t, '26.1');
  await assert.rejects(bind(older.ctx, [{ op: 'bindLov', item: 'P3_STATUS', lov: 'status' }]), {
    code: 'OPERATION_UNSUPPORTED',
  });
});
