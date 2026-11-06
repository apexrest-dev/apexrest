import test from 'node:test';
import assert from 'node:assert/strict';
import {
  componentExample,
  contractComponent,
  contractComponentType,
  pageExamples,
} from '../../packages/core/src/component-examples.ts';

test('working blocks come from Oracle 26.2 sample pages for regions, items and template components', async () => {
  for (const [type, opener] of [
    ['classicReport', /^\s*region \S+ \($/mu],
    ['interactiveReport', /^\s*region \S+ \($/mu],
    ['chart', /^\s*region \S+ \($/mu],
    ['switch', /^\s*pageItem \S+ \($/mu],
    ['selectList', /^\s*pageItem \S+ \($/mu],
    ['metricCard', /^\s*region \S+ \($/mu],
  ] as const) {
    const example = await componentExample(type);
    assert.ok(example, type);
    assert.match(example.id, /^oracle:26\.2:public-template\/[^/]+\/p\d+/u, type);
    assert.match(example.text.split('\n')[0]!, opener, type);
    assert.match(example.text, new RegExp(`type: (?:[A-Za-z]+/)?${type}\\s*$`, 'mu'), type);
    assert.match(example.text.trimEnd(), /\)$/u, type);
    assert.ok(example.text.length >= 250 && example.text.length <= 4000, type);
  }
  assert.equal(await componentExample('noSuchComponentType'), undefined);
});

test('inventory contract titles name their component type', () => {
  assert.equal(
    contractComponentType('plugin-variants/classicReport — 26.2 property inventory'),
    'classicReport',
  );
  assert.equal(
    contractComponentType('template-component/metricCard — 26.2 property inventory'),
    'metricCard',
  );
  assert.equal(contractComponentType('region — 26.2 property inventory'), 'region');
  assert.equal(contractComponentType('weird title with spaces — x'), undefined);
});

test('examples follow the contract kind and prefer the variant the request describes', async () => {
  assert.deepEqual(
    contractComponent('oracle:26.2:inventory/app/page/page-item/plugin-variants/switch/switch'),
    {
      kind: 'pageItem',
      type: 'switch',
    },
  );
  assert.deepEqual(
    contractComponent('oracle:26.2:inventory/app/page/region/template-component/metric-card/metric-card'),
    { kind: 'region', type: 'metricCard' },
  );
  assert.deepEqual(contractComponent('oracle:26.2:inventory/app/page/button/button'), { kind: 'button' });
  assert.equal(contractComponent('oracle:26.2:inventory/app/list/entry/entry'), undefined);
  const item = await componentExample('selectList', { kind: 'pageItem' });
  assert.match(item!.text.split('\n')[0]!, /^\s*pageItem \S+ \($/u);
  const line = await componentExample('chart', { kind: 'region', request: 'line chart of hourly prices' });
  assert.match(line!.text, /^\s*type: line\s*$/mu);
  const button = await componentExample(undefined, { kind: 'button' });
  assert.match(button!.text.split('\n')[0]!, /^\s*button \S+ \($/u);
});

test('a modal form request gets one whole Oracle sample page with its buttons and processes', async () => {
  const [page, ...rest] = await pageExamples('modal dialog form to create, edit and delete alerts');
  assert.equal(rest.length, 0);
  assert.match(page!.id, /^oracle:26\.2:public-template\/[^/]+\/p\d+/u);
  assert.match(page!.text, /^page \d+ \(/u);
  for (const part of [
    /pageMode: modalDialog/u,
    /type: formAutoRowProcessing/u,
    /type: closeDialog/u,
    /button delete \(/u,
  ])
    assert.match(page!.text, part);
  assert.ok(page!.text.length <= 9000);
  assert.deepEqual(await pageExamples('interactive report of prices'), []);
});
