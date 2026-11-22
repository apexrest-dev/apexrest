import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cp, readFile, rm } from 'node:fs/promises';
import { fixture } from '../fixtures/project.ts';
import { nativeScaffoldSpec } from '../fixtures/scaffold-native.ts';
import { scaffold } from '../../packages/core/src/scaffold.ts';
import { atomicWrite, inventory, writeJson, hash } from '../../packages/core/src/fs.ts';
import { get, parseApexLang, type ApxComponent } from '../../packages/core/src/preview/apexlang.ts';

async function prepared(t: import('node:test').TestContext) {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const root = path.join(ctx.root, ctx.config.application.sourceDir);
  await cp(path.resolve('templates/blank-app/application'), root, { recursive: true });
  await writeJson(path.join(ctx.root, 'spec.json'), nativeScaffoldSpec);
  return { ctx, root };
}
const child = (page: ApxComponent, type: string, id: string) => {
  const value = page.children.find((node) => node.type === type && node.id === id);
  assert.ok(value, `${type} ${id}`);
  return value;
};
async function page(root: string, file: string) {
  return parseApexLang(await readFile(path.join(root, file), 'utf8'), file)[0]!;
}

test('26.1 normal scaffold emits linked native components, guards and processes without changing security or theme', async (t) => {
  const { ctx, root } = await prepared(t);
  const before = await inventory(root);
  const result = await scaffold(ctx, 'spec.json');
  assert.equal(result.pages.length, 5);
  const home = await page(root, 'pages/p00001-home.apx');
  assert.equal(home.props.name, 'Overview');
  assert.ok(child(home, 'region', 'app-name'), 'Oracle header survives');
  assert.equal(get(home.props, 'security.pageAccessProtection'), 'argumentsMustHaveChecksum');
  const cards = child(home, 'region', 'totals');
  assert.equal(cards.props.type, 'cards');
  assert.equal(get(cards.props, 'card.primaryKeyColumn1'), 'ID');
  assert.equal(get(child(cards, 'action', 'open').props, 'behavior.target.page'), '10');
  const records = child(await page(root, 'pages/p00010-records.apx'), 'region', 'records');
  assert.equal(get(child(records, 'column', 'ID').props, 'source.dataType'), 'NUMBER');
  assert.equal(get(child(records, 'column', 'TITLE').props, 'source.dataType'), 'STRING');
  assert.equal(get(child(records, 'column', 'ID').props, 'link.target.items.P20_ID'), '#ID#');
  for (const report of [records, child(await page(root, 'pages/p00010-records.apx'), 'region', 'summary')]) {
    const columns = report.children.filter((node) => node.type === 'column');
    assert.equal(get(columns[0]!.props, 'accessibility.valueIdentifiesRow'), true);
    assert.equal(get(columns[1]!.props, 'accessibility.valueIdentifiesRow'), undefined);
  }
  const edit = await page(root, 'pages/p00020-edit-record.apx');
  const quantity = child(edit, 'pageItem', 'P20_QUANTITY');
  assert.equal(
    get(quantity.props, 'appearance.template') && get(quantity.props, 'appearance.formatMask'),
    'FM9990D00',
  );
  assert.equal(get(quantity.props, 'default.staticValue'), '1');
  assert.equal(
    get(child(edit, 'button', 'calculate').props, 'confirmation.message'),
    'Recalculate this draft?',
  );
  assert.equal(
    get(child(edit, 'process', 'calculate-record').props, 'serverSideCondition.whenButtonPressed') &&
      get(child(edit, 'process', 'calculate-record').props, 'execution.point'),
    'afterSubmit',
  );
  assert.equal(get(child(edit, 'process', 'load-record').props, 'serverSideCondition.item'), 'P20_ID');
  const calendar = child(await page(root, 'pages/p00030-schedule.apx'), 'region', 'schedule');
  assert.equal(get(calendar.props, 'settings.viewEditLink.items.P20_ID'), '&ID.');
  assert.match(
    String(get(calendar.props, 'componentAdvanced.initJavaScriptFunction')),
    /initialDate = "2027-03-01"/,
  );
  const form = await page(root, 'pages/p00040-record-detail.apx');
  assert.equal(child(form, 'process', 'initialize-detail').props.type, 'formInitialization');
  assert.equal(get(child(form, 'pageItem', 'P40_TITLE').props, 'validation.valueRequired'), undefined);
  const shared = await page(root, 'shared-components/app-processes.apx');
  assert.equal(shared.type, 'appProcess');
  assert.equal(get(shared.props, 'execution.point'), 'beforeHeader');
  const after = await inventory(root);
  for (const file of Object.keys(before).filter((file) =>
    /authentications|authorizations|themes|\.apex\//.test(file),
  ))
    assert.equal(after[file], before[file], file);
  await scaffold(ctx, 'spec.json');
  assert.deepEqual(await inventory(root), after, 'same spec remains byte-identical');
});

test('26.2 normal scaffold identifies the first linked or plain classic column as a row header', async (t) => {
  const { ctx, root } = await prepared(t);
  await writeJson(path.join(root, '.apex/apexlang.json'), { mmdVersion: '26.2.0+3479' });
  await atomicWrite(
    path.join(root, 'shared-components/lists/navigation-menu.apx'),
    'list navigation-menu (\n    name: Navigation Menu\n    entry home (\n        label: Home\n        link {\n            target: {\n                page: 1\n            }\n        }\n    )\n)\n',
  );
  const reports = nativeScaffoldSpec.pages.find((entry) => entry.id === 10)!;
  const classic = reports.regions.find((region) => region.type === 'classicReport')!;
  assert.ok('columns' in classic);
  await writeJson(path.join(ctx.root, 'spec.json'), {
    pages: [
      {
        id: 10,
        name: 'Records',
        regions: [
          classic,
          { ...classic, id: 'plain', columns: classic.columns.map(({ link: _link, ...column }) => column) },
        ],
      },
      { id: 20, name: 'Record detail', regions: [{ type: 'staticContent', name: 'Details' }] },
    ],
  });
  await scaffold(ctx, 'spec.json');
  const source = await page(root, 'pages/p00010-records.apx');
  for (const id of ['summary', 'plain']) {
    const columns = child(source, 'region', id).children.filter((node) => node.type === 'column');
    assert.equal(get(columns[0]!.props, 'accessibility.valueIdentifiesRow'), true);
    assert.equal(get(columns[1]!.props, 'accessibility.valueIdentifiesRow'), undefined);
  }
});

test('monolithic navigation and existing application processes retain unrelated declarations byte for byte', async (t) => {
  const { ctx, root } = await prepared(t);
  const navFile = path.join(root, 'shared-components/lists.apx');
  const original = await readFile(navFile, 'utf8');
  const sentinel = '\nlist private-links (\n    name: Private links\n)\n';
  await atomicWrite(navFile, original + sentinel);
  const foreign =
    'appProcess foreign-process (\n    name: Foreign process\n    type: executeCode\n    source {\n        plsqlCode: begin null; end;\n    }\n    execution {\n        sequence: 1\n        point: beforeHeader\n    }\n)\n';
  await atomicWrite(path.join(root, 'shared-components/app-processes.apx'), foreign);
  await scaffold(ctx, 'spec.json');
  const lists = await readFile(navFile, 'utf8');
  assert.ok(lists.endsWith(sentinel));
  const oldBar = original.slice(0, original.indexOf('list navigation-menu'));
  assert.equal(lists.slice(0, lists.indexOf('list navigation-menu')), oldBar);
  const menu = parseApexLang(lists).find((node) => node.id === 'navigation-menu')!;
  assert.equal(menu.children.find((node) => node.id === 'home')!.props.label, 'Overview');
  assert.equal(
    menu.children.some((node) => String(get(node.props, 'link.target.page')) === '20'),
    false,
  );
  assert.ok(
    (await readFile(path.join(root, 'shared-components/app-processes.apx'), 'utf8')).startsWith(foreign),
  );
  const after = await inventory(root);
  await scaffold(ctx, 'spec.json');
  assert.deepEqual(await inventory(root), after);
});

test('invalid references, missing submitted filters, injection and duplicate native identities fail before source writes', async (t) => {
  const { ctx, root } = await prepared(t);
  const before = await inventory(root);
  const examples = [
    {
      pages: [
        {
          id: 10,
          name: 'Missing region',
          regions: [{ type: 'staticContent', name: 'Controls' }],
          items: [{ name: 'P10_X', type: 'textField', region: 'missing' }],
        },
      ],
    },
    {
      pages: [
        {
          id: 10,
          name: 'Wrong page item',
          regions: [{ id: 'controls', type: 'staticContent', name: 'Controls' }],
          items: [{ name: 'P20_X', type: 'textField', region: 'controls' }],
        },
      ],
    },
    {
      pages: [
        {
          id: 10,
          name: 'Missing submit',
          regions: [
            {
              id: 'records',
              type: 'cards',
              name: 'Records',
              sql: 'select 1 ID, 2 VALUE from dual',
              titleColumn: 'ID',
              bodyColumn: 'VALUE',
            },
          ],
          items: [{ name: 'P10_X', type: 'textField', region: 'records' }],
          refreshes: [{ items: ['P10_X'], regions: ['records'] }],
        },
      ],
    },
    {
      pages: [
        {
          id: 10,
          name: 'Injected code',
          regions: [{ type: 'staticContent', name: 'Controls' }],
          processes: [{ id: 'run', plsql: 'begin null; end;\n```\n)\npage 999 (' }],
        },
      ],
    },
    {
      pages: [
        { id: 1, name: 'Collision', regions: [{ id: 'app-name', type: 'staticContent', name: 'Collision' }] },
      ],
    },
  ];
  for (const spec of examples) {
    await writeJson(path.join(ctx.root, 'spec.json'), spec);
    await assert.rejects(scaffold(ctx, 'spec.json'));
    assert.deepEqual(await inventory(root), before);
  }
});

test('preserved process IDs and shared identifiers cannot collide with newly emitted source', async (t) => {
  const { ctx, root } = await prepared(t);
  await atomicWrite(
    path.join(root, 'pages/p00050-existing.apx'),
    'page 50 (\n    name: Existing\n    process existing (\n        type: executeCode\n        advanced {\n            executionMappingIdentifier: 760000000020001\n        }\n    )\n)\n',
  );
  const before = await inventory(root);
  await assert.rejects(scaffold(ctx, 'spec.json'), { code: 'LOCAL_EDITS_CONFLICT' });
  assert.deepEqual(await inventory(root), before);
  await rm(path.join(root, 'pages/p00050-existing.apx'));
  await atomicWrite(
    path.join(root, 'shared-components/app-processes.apx'),
    'appProcess prepare-request (\n    name: Existing\n)\n',
  );
  const next = await inventory(root);
  await assert.rejects(scaffold(ctx, 'spec.json'), { code: 'LOCAL_EDITS_CONFLICT' });
  assert.deepEqual(await inventory(root), next);
});

test('manual edits to a generated process or page retain the edit and block a later regeneration', async (t) => {
  const { ctx, root } = await prepared(t);
  await scaffold(ctx, 'spec.json');
  const file = path.join(root, 'shared-components/app-processes.apx');
  await atomicWrite(file, (await readFile(file, 'utf8')) + '\n// reviewed local change\n');
  const before = await inventory(root);
  await assert.rejects(scaffold(ctx, 'spec.json'), { code: 'LOCAL_EDITS_CONFLICT' });
  assert.deepEqual(await inventory(root), before);
});

test('26.1 never emits the 26.2-only optional metadata observation script', async (t) => {
  const { ctx } = await prepared(t);
  const result = await scaffold(ctx, 'spec.json', 'dev');
  assert.equal('readback' in result, false);
  assert.match(result.readbackUnavailable!, /26.2 only/);
});

test('explicit aliases determine new canonical filenames and incompatible owned alias changes refuse', async (t) => {
  const { ctx, root } = await prepared(t);
  const spec = {
    pages: [
      {
        id: 10,
        name: 'Inventory overview',
        alias: 'STOCK_CODE',
        regions: [{ type: 'staticContent', name: 'Stock' }],
      },
    ],
  };
  await writeJson(path.join(ctx.root, 'spec.json'), spec);
  const result = await scaffold(ctx, 'spec.json');
  assert.equal((await page(root, 'pages/p00010-stock_code.apx')).props.alias, 'STOCK_CODE');
  const raw = await readFile(path.join(ctx.root, 'spec.json'), 'utf8');
  assert.equal(result.specDigest, hash(raw));
  assert.equal(await readFile(path.join(ctx.root, result.stage, 'spec.json'), 'utf8'), raw);
  const before = await inventory(root);
  await writeJson(path.join(ctx.root, 'spec.json'), { pages: [{ ...spec.pages[0], alias: 'NEW_CODE' }] });
  await assert.rejects(scaffold(ctx, 'spec.json'), { code: 'LOCAL_EDITS_CONFLICT' });
  assert.deepEqual(await inventory(root), before);
});

test('omitted shared process input retains generated content; explicit empty restores only the preserved shell', async (t) => {
  const { ctx, root } = await prepared(t);
  const file = path.join(root, 'shared-components/app-processes.apx');
  const shell =
    '// unowned content and formatting\nappProcess foreign-process (\n    name: Foreign process\n)\n\n';
  await atomicWrite(file, shell);
  await scaffold(ctx, 'spec.json');
  const generated = await readFile(file, 'utf8');
  const { applicationProcesses: _ignored, ...withoutProcesses } = nativeScaffoldSpec;
  await writeJson(path.join(ctx.root, 'spec.json'), withoutProcesses);
  await scaffold(ctx, 'spec.json');
  assert.equal(await readFile(file, 'utf8'), generated);
  await writeJson(path.join(ctx.root, 'spec.json'), { ...withoutProcesses, applicationProcesses: [] });
  await scaffold(ctx, 'spec.json');
  assert.equal(await readFile(file, 'utf8'), shell);
  await scaffold(ctx, 'spec.json');
  assert.equal(await readFile(file, 'utf8'), shell);
});

test('human edits to an owned navigation entry block regeneration and preserve all source bytes', async (t) => {
  const { ctx, root } = await prepared(t);
  await scaffold(ctx, 'spec.json');
  const file = path.join(root, 'shared-components/lists.apx');
  const text = await readFile(file, 'utf8');
  assert.match(text, /label: "Records"/);
  await atomicWrite(file, text.replace('label: "Records"', 'label: "Operator label"'));
  const before = await inventory(root);
  await writeJson(path.join(ctx.root, 'spec.json'), {
    ...nativeScaffoldSpec,
    pages: nativeScaffoldSpec.pages.map((page) => (page.id === 10 ? { ...page, name: 'Inventory' } : page)),
  });
  await assert.rejects(scaffold(ctx, 'spec.json'), { code: 'LOCAL_EDITS_CONFLICT' });
  assert.deepEqual(await inventory(root), before);
});

test('normalized button request collisions and unowned Home guard/alias changes cannot silently alter behavior', async (t) => {
  const { ctx, root } = await prepared(t);
  const before = await inventory(root);
  const specs = [
    {
      pages: [
        {
          id: 10,
          name: 'Actions',
          regions: [{ id: 'actions', type: 'staticContent', name: 'Actions' }],
          buttons: [
            { id: 'save-record', label: 'Save', region: 'actions' },
            { id: 'save_record', label: 'Save again', region: 'actions' },
          ],
        },
      ],
    },
    {
      pages: [
        {
          id: 1,
          name: 'Overview',
          condition: { type: 'never' },
          regions: [{ type: 'staticContent', name: 'Overview' }],
        },
      ],
    },
    {
      pages: [
        {
          id: 1,
          name: 'Overview',
          alias: 'NEW_HOME',
          regions: [{ type: 'staticContent', name: 'Overview' }],
        },
      ],
    },
  ];
  for (const spec of specs) {
    await writeJson(path.join(ctx.root, 'spec.json'), spec);
    await assert.rejects(scaffold(ctx, 'spec.json'));
    assert.deepEqual(await inventory(root), before);
  }
});

test('generated aliases remain distinct for non-Latin or repeated names and preserve existing aliases', async (t) => {
  const { ctx, root } = await prepared(t);
  const spec = {
    pages: [
      { id: 10, name: 'Огляд', regions: [{ type: 'staticContent', name: 'Огляд' }] },
      { id: 20, name: 'Звіти', regions: [{ type: 'staticContent', name: 'Звіти' }] },
      { id: 30, name: 'Records', regions: [{ type: 'staticContent', name: 'Records' }] },
      { id: 40, name: 'Records', regions: [{ type: 'staticContent', name: 'Records' }] },
    ],
  };
  await writeJson(path.join(ctx.root, 'spec.json'), spec);
  await scaffold(ctx, 'spec.json');
  assert.equal((await page(root, 'pages/p00010-page-10.apx')).props.alias, 'PAGE-10');
  assert.equal((await page(root, 'pages/p00020-page-20.apx')).props.alias, 'PAGE-20');
  assert.equal((await page(root, 'pages/p00030-records.apx')).props.alias, 'RECORDS');
  assert.equal((await page(root, 'pages/p00040-records-40.apx')).props.alias, 'RECORDS-40');
  const before = await inventory(root);
  await scaffold(ctx, 'spec.json');
  assert.deepEqual(await inventory(root), before);
  await writeJson(path.join(ctx.root, 'spec.json'), {
    pages: [
      {
        id: 50,
        name: 'Login alias collision',
        alias: 'LOGIN',
        regions: [{ type: 'staticContent', name: 'Login' }],
      },
    ],
  });
  await assert.rejects(scaffold(ctx, 'spec.json'), { code: 'LOCAL_EDITS_CONFLICT' });
  assert.deepEqual(await inventory(root), before);
});

test('auto-alias fallback checks every candidate against existing and newly allocated aliases', async (t) => {
  const { ctx, root } = await prepared(t);
  await writeJson(path.join(ctx.root, 'spec.json'), {
    pages: [
      { id: 30, name: 'Details-20', regions: [{ type: 'staticContent', name: 'Details' }] },
      { id: 10, name: 'Details', regions: [{ type: 'staticContent', name: 'Details' }] },
      { id: 20, name: 'Details', regions: [{ type: 'staticContent', name: 'Details' }] },
    ],
  });
  await scaffold(ctx, 'spec.json');
  assert.equal((await page(root, 'pages/p00030-details-20.apx')).props.alias, 'DETAILS-20');
  assert.equal((await page(root, 'pages/p00010-details.apx')).props.alias, 'DETAILS');
  assert.equal((await page(root, 'pages/p00020-details-20-1.apx')).props.alias, 'DETAILS-20-1');
  const before = await inventory(root);
  await scaffold(ctx, 'spec.json');
  assert.deepEqual(await inventory(root), before);
});

test('navigation false removes only the unchanged owned entry and can be repeated or re-enabled', async (t) => {
  const { ctx, root } = await prepared(t);
  const visible = {
    pages: [{ id: 10, name: 'Records', regions: [{ type: 'staticContent', name: 'Records' }] }],
  };
  const hidden = { pages: [{ ...visible.pages[0], navigation: false }] };
  const nav = path.join(root, 'shared-components/lists.apx');
  const menu = async () =>
    parseApexLang(await readFile(nav, 'utf8')).find((node) => node.id === 'navigation-menu')!;
  await writeJson(path.join(ctx.root, 'spec.json'), visible);
  await scaffold(ctx, 'spec.json');
  assert.ok((await menu()).children.some((node) => node.id === 'scaffold-p10'));
  const originalBar = (await readFile(nav, 'utf8')).split('list navigation-menu')[0];
  await writeJson(path.join(ctx.root, 'spec.json'), hidden);
  await scaffold(ctx, 'spec.json');
  assert.equal(
    (await menu()).children.some((node) => node.id === 'scaffold-p10'),
    false,
  );
  assert.equal((await readFile(nav, 'utf8')).split('list navigation-menu')[0], originalBar);
  const after = await inventory(root);
  await scaffold(ctx, 'spec.json');
  assert.deepEqual(await inventory(root), after);
  await writeJson(path.join(ctx.root, 'spec.json'), visible);
  await scaffold(ctx, 'spec.json');
  assert.ok((await menu()).children.some((node) => node.id === 'scaffold-p10'));
  await atomicWrite(nav, (await readFile(nav, 'utf8')).replace('label: "Records"', 'label: "Human edit"'));
  const edited = await inventory(root);
  await writeJson(path.join(ctx.root, 'spec.json'), hidden);
  await assert.rejects(scaffold(ctx, 'spec.json'), { code: 'LOCAL_EDITS_CONFLICT' });
  assert.deepEqual(await inventory(root), edited);
});

test('26.1 IR timestamp remains native TIMESTAMP rather than being coerced to DATE', async (t) => {
  const { ctx, root } = await prepared(t);
  await writeJson(path.join(ctx.root, 'spec.json'), {
    pages: [
      {
        id: 50,
        name: 'Timestamp',
        regions: [
          {
            type: 'interactiveReport',
            name: 'Timestamp values',
            sql: "select timestamp '2027-03-01 10:20:30.123456' EVENT_AT from dual",
            columns: [{ name: 'EVENT_AT', heading: 'Timestamp', dataType: 'timestamp' }],
          },
        ],
      },
    ],
  });
  await scaffold(ctx, 'spec.json');
  const source = await page(root, 'pages/p00050-timestamp.apx');
  const region = child(source, 'region', 'r1');
  assert.equal(get(child(region, 'column', 'EVENT_AT').props, 'source.dataType'), 'TIMESTAMP');
});
