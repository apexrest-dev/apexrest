import test from 'node:test';
import assert from 'node:assert/strict';
import {
  componentNote,
  contractSkeleton,
  exampleValues,
  propertyFix,
} from '../../packages/core/src/contract-hints.ts';

test('invalid properties get a repair hint from the 26.2 inventory contract', async () => {
  const fix = (message: string, hint: string) => propertyFix('INVALID_PROPERTY', message, hint);
  assert.equal(
    await fix(
      'Invalid property: onValue',
      'inside settings of pageItem P4_IS_ACTIVE (type: switch) of page 4',
    ),
    'onValue applies to pageItem (type: switch) only when settings.useDefaults = N',
  );
  assert.equal(
    await fix('Invalid property: parentEntry', 'inside entry alerts of breadcrumb breadcrumb'),
    'parentEntry belongs in group appearance of entry',
  );
  assert.match(
    (await fix(
      'Invalid property: minimumValue',
      'inside settings of pageItem P4_THRESHOLD (type: numberField) of page 4',
    ))!,
    /^pageItem \(type: numberField\) has no minimumValue; settings: .*\bminValue\b/u,
  );
  assert.match(
    (await fix('Invalid property: format', 'inside value of region prices (type: chart) of page 1'))!,
    /^format applies to region \(type: chart\) only when .*chart\.type = pie/u,
  );
  assert.match(
    (await fix(
      'Invalid property: type',
      'inside action refresh (type: refresh) of dynamicAction refresh-alerts of page 3',
    ))!,
    /^type is not valid in the component itself of action \(type: refresh\); valid there: .*\baction\b/u,
  );
  assert.match(
    (await propertyFix(
      'DUPLICATED_COMPONENT',
      'Duplicated component within parent scope. For properties: advanced.executionMappingIdentifier: null',
      undefined,
    ))!,
    /executionMappingIdentifier: <unique 20-digit number>/u,
  );
  assert.equal(await propertyFix('LOV_NOT_FOUND', 'Invalid property: x', 'inside page 1'), undefined);
  assert.equal(await fix('Invalid property: x', 'inside nothing'), undefined);
});

test('shared-component contracts without sample code get an outline with properties in their groups', async () => {
  const breadcrumb = (await contractSkeleton('oracle:26.2:inventory/app/breadcrumb/entry/entry'))!;
  assert.match(
    breadcrumb,
    /^entry <name> \(\n {4}name: <STRING>\n {4}pageNumber: <INTEGER>\n {4}appearance \{\n {8}parentEntry: <@entry> {2}\(optional\)/u,
  );
  assert.doesNotMatch(breadcrumb, /serverSideCondition|authorizationScheme/u);
  const list = (await contractSkeleton('oracle:26.2:inventory/app/list/entry/entry'))!;
  assert.match(list, /^ {4}isCurrent \{\n {8}type: targetPage \| pages/mu);
  assert.equal(await contractSkeleton('oracle:26.2:inventory/app/no-such/thing/thing'), undefined);
});

test('a missing required property gets the group, property and values to add', async () => {
  const fix = (message: string, hint?: string) => propertyFix('MISSING_REQUIRED_PROPERTY', message, hint);
  // The breadcrumb region of the 2026-11-06 runs: the template name comes from an Oracle sample.
  assert.equal(
    await fix(
      'Missing required parameter (387): componentAppearance - breadcrumbTemplate (string)',
      'inside region breadcrumb (type: breadcrumb) of page 3',
    ),
    'add to region breadcrumb: componentAppearance { breadcrumbTemplate: @/breadcrumb }',
  );
  // The compiler names direct properties `identification`; an enum lists its values.
  assert.match(
    (await fix(
      'Missing required parameter (82): identification - action (string)',
      'inside action hide of dynamicAction cancel-dialog of page 4',
    ))!,
    /^add to action hide: action: addClass \| alert \| cancelDialog \| .* more$/u,
  );
  assert.equal(
    await fix(
      'Missing required parameter (146): default - staticValue (string)',
      'inside pageItem P4_ACTIVE (type: switch) of page 4',
    ),
    'add to pageItem P4_ACTIVE: default { staticValue: <STRING> } (required when default.type = static)',
  );
  assert.equal(
    await fix(
      'Missing required parameter (290): link - linkText (string)',
      'inside column ID (type: link) of region alerts (type: classicReport) of page 3',
    ),
    'add to column ID: link { linkText: <STRING> }',
  );
  // Without a component the group and property still say where to add it.
  assert.equal(
    await fix('Missing required parameter (961): source - tableName (string)', 'inside page 2'),
    'add to the component that starts at the reported line: source { tableName: <string> }',
  );
  assert.equal(
    await fix('Missing required parameter (961): source - tableName (string)'),
    'add to the component that starts at the reported line: source { tableName: <string> }',
  );
  assert.equal(await fix('Something else is missing', 'inside page 2'), undefined);
});

test('a heading on a hidden classic report column gets a removal hint; other columns use their contract', async () => {
  const fix = (message: string, hint: string) => propertyFix('INVALID_PROPERTY', message, hint);
  assert.match(
    (await fix(
      'Invalid property: heading',
      'inside heading of column EVENT_ID (type: hidden) of region alert-events (type: classicReport)',
    ))!,
    /^remove the whole heading \{ … \} group from column EVENT_ID: a hidden classicReport column takes no heading/u,
  );
  // An interactive report keeps the heading of a hidden column: no removal hint there.
  assert.equal(
    await fix(
      'Invalid property: heading',
      'inside heading of column ID (type: hidden) of region alerts (type: interactiveReport)',
    ),
    undefined,
  );
  // A column type is a value of the column contract, chosen by the region type it applies to.
  assert.match(
    (await fix(
      'Invalid property: sortable',
      'inside sorting of column ALERT_ID (type: link) of region alerts (type: interactiveReport)',
    ))!,
    /^column has no sortable and no group sorting; groups: .*\bcolumnFilter\b/u,
  );
});

test('example values list what a sample shows once: allowed values, chosen by the component the samples describe', async () => {
  const report = (await exampleValues(
    `    region events (
        name: Events
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
        }
        pagination {
            type: nextAndPreviousLinks
        }

        column EVENT_ID (
            type: hidden
            layout {
                sequence: 1
            }
        )
    )`,
    'oracle:26.2:inventory/app/page/region/plugin-variants/classic-report/classic-report',
  ))!;
  // The region contract carries four pagination lists; the classic report one is the list the
  // compiler printed in the 2026-11-06 runs (no rowRangesXToY, page or scroll).
  assert.equal(
    report['pagination.type'],
    'showAll | rowRangesXToYNoPagination | rowRangesXToYOfZNoPagination | rowRangesXToYOfZWithPagination | setPaginationLinks | setPaginationSelectList | setPaginationSearchEngine | externalPaginationButtons | nextAndPreviousLinks',
  );
  assert.match(report['source.location']!, /^localDatabase \| /u);
  // A block's own type selects the component and is not listed.
  assert.equal('type' in report || 'column.type' in report, false);
  // Commonly set properties are listed although the block does not show them.
  const text = (await exampleValues(
    `    pageItem P4_NAME (
        type: textField
        label {
            label: Name
        }
    )`,
    'oracle:26.2:inventory/app/page/page-item/plugin-variants/text-field/text-field',
  ))!;
  assert.equal(text['settings.trimSpaces'], 'leadingAndTrailing | leading | trailing | none');
  const button = (await exampleValues(
    `    button create (
        buttonName: CREATE
        label: Create
    )`,
    'oracle:26.2:inventory/app/page/button/button',
  ))!;
  assert.match(button['behavior.action']!, /^submitPage \| triggerAction \| redirectThisApp \| /u);
  // Without a contract ID the block's keyword decides; nested components carry their keyword, and
  // the event list the inventory only names comes from the samples, marked as partial.
  const page = (await exampleValues(
    `page 3 (
    name: Alerts

    dynamicAction refresh (
        name: Refresh
        when {
            event: click
            selectionType: button
        }
    )
)`,
  ))!;
  assert.match(
    page['dynamicAction.when.event']!,
    /^click \| apexafterclosedialog \| .* \| … \(most used in Oracle samples; the compiler error lists all\)$/u,
  );
  assert.match(page['dynamicAction.when.selectionType']!, /\bbutton\b/u);
  assert.equal(Object.keys(page)[0], 'dynamicAction.when.event');
  assert.equal(await exampleValues('no block here'), undefined);
  assert.match(componentNote('process')!, /executionMappingIdentifier/u);
  assert.equal(componentNote('region'), undefined);
});
