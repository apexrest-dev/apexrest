import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseApexLang } from '../../packages/core/src/preview/apexlang.ts';
import {
  buildCatalog,
  checkComponentProperties,
  checkSharedComponentFiles,
} from '../../packages/core/src/preview/properties.ts';
import { checkApplication } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const catalog = buildCatalog(
  JSON.parse(fs.readFileSync(path.resolve('resources/components/source/parameters.json'), 'utf8')),
);

const PAGE = `page 1 (
    name: Guessed
    alias: GUESSED

    region report (
        name: Report
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select 1 x from dual
        }
        layout {
            sequence: 10
            slot: body
        }
        reportTemplate: @/standard
    )

    region selector (
        name: Selector
        type: regionDisplaySelector
        layout {
            sequence: 5
            slot: body
        }
        settings {
            mode: standard
        }
    )

    pageItem P1_CATEGORY (
        type: selectList
        label {
            label: Category
        }
        layout {
            sequence: 10
            region: @report
            slot: regionBody
        }
        listOfValues {
            type: staticValues
        }
        behavior {
            pageActionOnSelection: submitPage
        }
        source {
            type: sqlQuery
            sqlQuery: select 1 from dual
        }
    )

    pageItem P1_FILE (
        type: fileUpload
        label {
            label: File
        }
        layout {
            sequence: 20
            region: @report
            slot: regionBody
        }
        storage {
            type: &P1_STORAGE.
            purgeFileAt: endOfRequest
        }
    )

    pageItem P1_PLUGIN (
        type: plugin/slider
        label {
            label: Slider
        }
        layout {
            sequence: 30
            region: @report
            slot: regionBody
        }
        settings {
            anything: goes
        }
    )

    button go (
        buttonName: GO
        label: Go
        layout {
            sequence: 10
            region: @report
            slot: create
        }
        behavior {
            action: submitPage
        }
        advanced {
            htmlDomId: go_button
        }
    )
)
`;

test('unknown APEXlang property groups, properties and values are reported', () => {
  const findings = checkComponentProperties(parseApexLang(PAGE), '1', catalog).map((entry) => entry.message);
  assert.deepEqual(findings.sort(), [
    // The rejected source type also disables the query that depends on it.
    'pageItem P1_CATEGORY: property "source.sqlQuery" does not apply here (its display condition is not met)',
    'pageItem P1_CATEGORY: unknown property group "behavior"',
    'pageItem P1_CATEGORY: unknown property group "listOfValues"',
    'pageItem P1_CATEGORY: unknown value "sqlQuery" for source.type (expected databaseColumn, expression, functionBody, item, null, preference, sqlQueryMultipleValues, sqlQuerySingleValue, staticValue)',
    'region report: unknown property group "reportTemplate"',
    'region selector: unknown value "standard" for settings.mode (expected scrollWindow, viewSingleRegion)',
  ]);
});

test('the Oracle sample applications pass the property check', () => {
  const root = path.resolve('resources/public-templates/26.2/documents');
  let pages = 0;
  const findings: string[] = [];
  for (const app of fs.readdirSync(root)) {
    const directory = path.join(root, app);
    if (!fs.statSync(directory).isDirectory()) continue;
    for (const file of fs.readdirSync(directory)) {
      const text = fs.readFileSync(path.join(directory, file), 'utf8');
      for (const match of text.matchAll(/````apexlang\n([^]*?)\n````/gu)) {
        pages += 1;
        for (const finding of checkComponentProperties(parseApexLang(match[1]!, file), undefined, catalog))
          findings.push(`${app}/${file}: ${finding.message}`);
      }
    }
  }
  assert.ok(pages > 1000, `sample pages parsed: ${pages}`);
  assert.deepEqual(findings, []);
});

test('preview check reports unknown properties as warnings', async (t) => {
  const { app, assets } = await workspace(t, {
    'pages/p00009-guessed.apx': PAGE.replace('page 1 (', 'page 9 ('),
  });
  const result = checkApplication({ sourceDir: app, assetsDir: assets, pages: ['9'] });
  const warnings = result.diagnostics.filter((entry) => entry.level === 'warning' && entry.page === '9');
  assert.ok(
    warnings.some((entry) => entry.message === 'region report: unknown property group "reportTemplate"'),
    JSON.stringify(warnings),
  );
});

/** Property findings for one page source (`mmdVersion` as declared in `.apex/apexlang.json`). */
const findings = (source: string, mmdVersion?: string) =>
  checkComponentProperties(parseApexLang(source), '1', catalog, mmdVersion ? { mmdVersion } : {}).map(
    (entry) => entry.message,
  );

const region = (id: string, type: string, body: string, children = '') => `page 1 (
    name: Fixture
    alias: FIXTURE

    region ${id} (
        name: Fixture
        type: ${type}
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select 1 x from dual
        }
        layout {
            sequence: 10
            slot: body
        }
${body}
${children}
    )
)
`;

const column = (name: string, body: string) => `        column ${name} (\n${body}\n        )\n`;

test('pagination types are checked per report type, and showAll needs MMD 26.2', () => {
  const pagination = (type: string) => `        pagination {\n            type: ${type}\n        }`;
  assert.deepEqual(findings(region('r', 'classicReport', pagination('rowRangesXToYOfZWithPagination'))), []);
  assert.deepEqual(findings(region('r', 'interactiveReport', pagination('rowRangesXToYOfZ'))), []);
  assert.match(
    findings(region('r', 'classicReport', pagination('rowRangesXToYOfZ')))[0]!,
    /^region r: unknown value "rowRangesXToYOfZ" for pagination.type \(expected externalPaginationButtons/u,
  );
  assert.deepEqual(findings(region('r', 'classicReport', pagination('showAll')), '26.2.0+3479'), []);
  assert.deepEqual(findings(region('r', 'classicReport', pagination('showAll'))), []);
  assert.match(
    findings(region('r', 'classicReport', pagination('showAll')), '26.1.0+3102')[0]!,
    /unknown value "showAll" for pagination.type/u,
  );
});

test('classic report columns are checked against classic report column properties', () => {
  const avatar = column(
    'INITIALS',
    `            type: themeTemplateComponent/avatar
            layout {
                sequence: 10
            }
            settings {
                initials: INITIALS
            }`,
  );
  assert.deepEqual(findings(region('r', 'classicReport', '', avatar)), [
    'column INITIALS: unknown value "themeTemplateComponent/avatar" for type (expected datePicker, datePickerClassic, displayAsTextSavesState, displayImage, downloadBlob, hidden, hiddenField, link, percentGraph, plainText, plainTextBasedOnLov, popupKeyLov, …)',
    'column INITIALS: unknown property "settings.initials" (type themeTemplateComponent/avatar is not valid here)',
  ]);
  const key = (type: string) =>
    column(
      'ID',
      `            type: ${type}
            layout {
                sequence: 10
            }
            source {
                primaryKey: true
            }`,
    );
  assert.deepEqual(findings(region('r', 'classicReport', '', key('hidden'))), [
    'column ID: unknown property group "source"',
  ]);
  assert.deepEqual(findings(region('r', 'interactiveGrid', '', key('hidden'))), []);
  // A classic report column needs a sequence.
  assert.deepEqual(findings(region('r', 'classicReport', '', column('ID', '            type: hidden'))), [
    'column ID: missing required property "layout.sequence"',
  ]);
});

test('link targets with a URL need type url', () => {
  const link = (target: string) =>
    region(
      'r',
      'classicReport',
      '',
      column(
        'EMAIL',
        `            type: link
            layout {
                sequence: 10
            }
            link {
                target: {
${target}
                }
                linkText: #EMAIL#
            }`,
      ),
    );
  assert.deepEqual(findings(link('                    url: mailto:#EMAIL#')), [
    'column EMAIL: property "link.target" has "url" without "type: url" (the compiler does not recognize it)',
  ]);
  assert.deepEqual(
    findings(link('                    type: url\n                    url: mailto:#EMAIL#')),
    [],
  );
});

test('a static ID property is rejected: the component identifier is the static ID', () => {
  assert.deepEqual(
    findings(region('r', 'classicReport', '        advanced {\n            staticId: r\n        }')),
    ['region r: unknown property "advanced.staticId" (the component identifier is its static ID)'],
  );
});

test('interactive grid columns use the settings of their item type', () => {
  const grid = (settings: string) =>
    region(
      'r',
      'interactiveGrid',
      '',
      column(
        'PRICE',
        `            type: numberField
            layout {
                sequence: 10
            }
            settings {
                ${settings}
            }`,
      ),
    );
  assert.deepEqual(findings(grid('minValue: 0')), []);
  assert.deepEqual(findings(grid('minimumValue: 0')), [
    'column PRICE: unknown property "settings.minimumValue" for type numberField',
  ]);
});

test('properties whose display condition is not met are reported', () => {
  const chart = (type: string) =>
    region(
      'c',
      'chart',
      `        chart {
            type: ${type}
        }
        value {
            format: currency
        }`,
      `        series s (
            name: S
            label {
                show: true
                displayAs: labelValue
            }
        )`,
    );
  assert.deepEqual(findings(chart('pie')), []);
  assert.deepEqual(findings(chart('funnel')), [
    'series s: property "label.displayAs" does not apply here (its display condition is not met)',
  ]);
  assert.deepEqual(findings(chart('bar')), [
    'region c: property "value.format" does not apply here (its display condition is not met)',
    'series s: property "label.displayAs" does not apply here (its display condition is not met)',
  ]);
  // Native plug-in settings: the first hour needs the time display.
  const calendar = (showTime: string) =>
    region(
      'c',
      'calendar',
      `        settings {\n            showTime: ${showTime}\n            firstHour: 8\n        }`,
    );
  assert.deepEqual(findings(calendar('true')), []);
  assert.deepEqual(findings(calendar('false')), [
    'region c: property "settings.firstHour" does not apply here (its display condition is not met)',
  ]);
});

test('dynamic action properties are checked; an invalid value also disables the properties that depend on it', () => {
  const action = (selectionType: string) => `page 1 (
    name: Fixture
    alias: FIXTURE

    dynamicAction change (
        name: Change
        execution {
            sequence: 10
        }
        when {
            event: change
            selectionType: items
            items: P1_A
        }

        action style (
            name: Style
            type: setStyle
            execution {
                sequence: 10
            }
            affectedElements {
                selectionType: ${selectionType}
                jquerySelector: #swatch
            }
            settings {
                anything: goes
            }
        )
    )
)
`;
  assert.deepEqual(findings(action('jquerySelector')), []);
  assert.deepEqual(findings(action('jQuerySelector')), [
    'action style: unknown value "jQuerySelector" for affectedElements.selectionType (expected button, columns, domObject, eventSource, items, javaScriptExpression, jquerySelector, region, triggeringElement)',
    'action style: property "affectedElements.jquerySelector" does not apply here (its display condition is not met)',
  ]);
});

test('page items need a slot, and saved report rules are checked', () => {
  const item = (layout: string) => `page 1 (
    name: Fixture
    alias: FIXTURE

    pageItem P1_A (
        type: textField
        label {
            label: A
        }
        layout {
            sequence: 10
${layout}
        }
    )
)
`;
  assert.deepEqual(findings(item('            slot: regionBody')), []);
  assert.deepEqual(findings(item('')), ['pageItem P1_A: missing required property "layout.slot"']);
  const report = (identifier: string, visibility: string) =>
    region(
      'r',
      'interactiveReport',
      '',
      `${column('SAL', '            type: plainText\n            layout {\n                sequence: 10\n            }')}
        savedReport 1 (
            visibility: ${visibility}
            name: Saved

            computation APXWS_CC_001 (
                identifier: ${identifier}
                source {
                    expression: A * 12
                    dataType: number
                }
            )
        )`,
    );
  assert.deepEqual(findings(report('C01', 'primaryDefault')), []);
  assert.deepEqual(findings(report('M', 'public')), [
    'savedReport 1: missing required property "settings.appUser"',
    'computation APXWS_CC_001: invalid value "M" for identifier (expected "C" followed by two digits, such as C01)',
  ]);
});

test('shared component files the compiler does not read are reported', () => {
  assert.deepEqual(
    checkSharedComponentFiles('/app', [
      '/app/shared-components/lists.apx',
      '/app/shared-components/lists-b.apx',
      '/app/shared-components/build-options.apx',
      '/app/shared-components/rest-data-sources-e.apx',
      '/app/shared-components/rest-data-sources/forecast.apx',
      '/app/shared-components/lists/navigation-menu.apx',
    ]),
    [
      'shared-components/lists-b.apx: the APEXlang compiler does not read this file, so references to its components do not resolve; move them to shared-components/lists.apx',
      'shared-components/rest-data-sources-e.apx: the APEXlang compiler does not read this file, so references to its components do not resolve; move them to shared-components/rest-data-sources/<component>.apx',
    ],
  );
});

test('preview check applies the application MMD version and reports unread shared component files', async (t) => {
  const page = region(
    'r',
    'classicReport',
    '        pagination {\n            type: showAll\n        }',
  ).replace('page 1 (', 'page 9 (');
  const { app, assets } = await workspace(t, {
    'pages/p00009-fixture.apx': page,
    '.apex/apexlang.json': '{ "mmdVersion": "26.1.0+3102" }',
    'shared-components/lovs-b.apx': 'lov b-extra (\n    name: Extra\n)\n',
  });
  const result = checkApplication({ sourceDir: app, assetsDir: assets, pages: ['9'] });
  const warnings = result.diagnostics
    .filter((entry) => entry.level === 'warning')
    .map((entry) => entry.message);
  assert.ok(
    warnings.some((message) => /^region r: unknown value "showAll" for pagination.type/u.test(message)),
    JSON.stringify(warnings),
  );
  assert.ok(
    warnings.some((message) =>
      message.startsWith('shared-components/lovs-b.apx: the APEXlang compiler does not read'),
    ),
    JSON.stringify(warnings),
  );
});
