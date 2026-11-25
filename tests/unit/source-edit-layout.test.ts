import test from 'node:test';
import assert from 'node:assert/strict';
import { editGroups, type EditOperation } from '../../packages/core/src/edit/page-edit.ts';
import { transformPage } from '../../packages/core/src/edit/transaction.ts';
import { parseApexLang, readProperty } from '../../packages/core/src/edit/apexlang-edit.ts';
import { resetThemeCatalog } from '../../packages/core/src/edit/layout.ts';
import { indexTheme } from '../../packages/core/src/preview/theme.ts';

const PAGE = `page 8 (
    name: Layout
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    region intro (
        id: 2718281828
        name: Intro
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
    )
    region tasks (
        name: Tasks
        type: classicReport
    )
    pageItem P8_NAME (
        type: textField
    )
)
`;
/** A minimal stand-in for the installed Universal Theme: two region templates and their options. */
const THEME = indexTheme([
  { kind: 'plug_template', params: { id: '1', static_id: 'standard' } },
  { kind: 'plug_template', params: { id: '2', static_id: 'content-block' } },
  { kind: 'plug_template', params: { id: '3', static_id: 'interactive-report' } },
  { kind: 'template', params: { id: '10', static_id: 'standard' } },
  { kind: 'template', params: { id: '11', static_id: 'left-side-column' } },
  {
    kind: 'template_option',
    params: { template_types: 'REGION', region_template_id: '1', css_classes: 't-Region--scrollBody' },
  },
  {
    kind: 'template_option',
    params: {
      template_types: 'REGION',
      region_template_id: '1',
      css_classes: 't-Region--noPadding',
      group_id: 'g1',
    },
  },
  {
    kind: 'template_option',
    params: {
      template_types: 'REGION',
      region_template_id: '1',
      css_classes: 't-Region--hiddenOverflow',
      group_id: 'g1',
    },
  },
  {
    kind: 'template_option',
    params: { template_types: 'REGION', region_template_id: '2', css_classes: 't-ContentBlock--h2' },
  },
  { kind: 'template_option', params: { template_types: 'REGION', css_classes: 'js-headingLevel-2' } },
]);
const apply = (operations: EditOperation[]) => transformPage(PAGE, '8', editGroups(operations)).result;
const set = (target: string, property: string, value: string) =>
  ({ op: 'set', target, property, value }) as EditOperation;
const region = (text: string, id: string) => parseApexLang(text)[0]!.children.find((c) => c.id === id)!;

test('template, options and grid placement round-trip with their APEXlang mapping and reset', (t) => {
  resetThemeCatalog(THEME);
  t.after(() => resetThemeCatalog(undefined));
  const changed = apply([
    set('region:intro', 'template', 'content-block'),
    set('region:intro', 'templateOptions', '#DEFAULT# t-ContentBlock--h2 js-headingLevel-2'),
    set('region:intro', 'columnSpan', '6'),
    set('region:intro', 'column', '7'),
    set('region:intro', 'startNewRow', 'false'),
    set('page', 'template', 'left-side-column'),
    set('item:P8_NAME', 'columnSpan', '4'),
  ]);
  const intro = region(changed, 'intro');
  assert.deepEqual(readProperty(intro, 'appearance.templateOptions'), [
    '#DEFAULT#',
    't-ContentBlock--h2',
    'js-headingLevel-2',
  ]);
  assert.match(
    changed,
    / {12}template: @\/content-block\n {12}templateOptions: \[\n {16}#DEFAULT#\n {16}t-ContentBlock--h2\n {16}js-headingLevel-2\n {12}\]/u,
  );
  assert.equal(readProperty(intro, 'layout.columnSpan'), '6');
  assert.equal(readProperty(intro, 'layout.startNewRow'), false);
  assert.ok(changed.includes('        id: 2718281828\n'));
  assert.match(changed, / {8}pageTemplate: @\/left-side-column/u);
  // The item had no layout group: one group holds the new property.
  assert.match(
    changed,
    / {4}pageItem P8_NAME \(\n {8}type: textField\n {8}layout \{\n {12}columnSpan: 4\n {8}\}\n {4}\)/u,
  );
  // Resets remove the properties so the theme defaults apply again.
  const reset = transformPage(
    changed,
    '8',
    editGroups([
      set('region:intro', 'templateOptions', ''),
      set('region:intro', 'column', ''),
      set('region:intro', 'startNewRow', ''),
    ]),
  ).result;
  const after = region(reset, 'intro');
  assert.equal(readProperty(after, 'appearance.templateOptions'), undefined);
  assert.equal(readProperty(after, 'layout.column'), undefined);
  assert.equal(readProperty(after, 'layout.startNewRow'), undefined);
  assert.equal(readProperty(after, 'layout.columnSpan'), '6');
  // A region without an appearance group gets one group for template and options together.
  const both = apply([
    set('region:tasks', 'template', 'standard'),
    set('region:tasks', 'templateOptions', 't-Region--scrollBody'),
  ]);
  assert.equal((both.match(/ {8}appearance \{/gu) ?? []).length, 2);
});

test('unsupported combinations, unknown templates, invalid options and grid values fail before writing', (t) => {
  resetThemeCatalog(THEME);
  t.after(() => resetThemeCatalog(undefined));
  const refuse = (operations: EditOperation[], code: string) =>
    assert.throws(() => apply(operations), { code }, code);
  refuse([set('region:intro', 'template', 'nope')], 'TEMPLATE_UNKNOWN');
  refuse([set('region:intro', 'template', 'interactive-report')], 'TEMPLATE_INCOMPATIBLE');
  refuse([set('region:intro', 'templateOptions', 't-ContentBlock--h2')], 'TEMPLATE_OPTION_UNKNOWN');
  refuse(
    [set('region:intro', 'templateOptions', 't-Region--noPadding t-Region--hiddenOverflow')],
    'TEMPLATE_OPTION_CONFLICT',
  );
  refuse([set('region:intro', 'columnSpan', '13')], 'INVALID_INPUT');
  refuse([set('region:intro', 'column', '10'), set('region:intro', 'columnSpan', '6')], 'INVALID_INPUT');
  refuse([set('region:intro', 'startNewRow', 'yes')], 'INVALID_INPUT');
  refuse([set('item:P8_NAME', 'template', 'standard')], 'OPERATION_UNSUPPORTED');
  assert.throws(
    () => transformPage(PAGE, '8', editGroups([set('region:intro', 'columnSpan', '6')]), '26.1'),
    {
      code: 'OPERATION_UNSUPPORTED',
    },
  );
});

test('without the installed theme, template ids use the reference set and options are refused', (t) => {
  resetThemeCatalog(null);
  t.after(() => resetThemeCatalog(undefined));
  assert.match(apply([set('region:intro', 'template', 'content-block')]), /template: @\/content-block/u);
  assert.throws(() => apply([set('region:intro', 'template', 'nope')]), { code: 'TEMPLATE_UNKNOWN' });
  assert.throws(() => apply([set('region:intro', 'templateOptions', '#DEFAULT#')]), {
    code: 'THEME_UNAVAILABLE',
  });
});
