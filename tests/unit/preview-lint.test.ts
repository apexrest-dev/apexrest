import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApplication } from '../../packages/core/src/preview/apexlang.ts';
import { localGaps } from '../../packages/core/src/preview/gaps.ts';
import { lintApplication } from '../../packages/core/src/preview/lint.ts';
import { checkApplication, PreviewServer } from '../../packages/core/src/preview/server.ts';
import { previewCheck } from '../../packages/core/src/preview/service.ts';
import { workspace } from '../fixtures/preview.ts';

const report = (id: string, type: string, extra = '') => `
    region ${id} (
        name: ${id}
        type: ${type}
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select task_id, title from tasks
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
        }
${extra}
    )`;

const button = (id: string, region: string, slot: string) => `
    button ${id} (
        buttonName: ${id.toUpperCase()}
        label: ${id}
        layout {
            sequence: 10
            region: @${region}
            slot: ${slot}
        }
    )`;

const codes = (findings: { code: string; component: string }[]) =>
  findings.map((finding) => `${finding.code} ${finding.component}`).sort();

/** The fixture theme: region template `standard` offers the `create` slot only. */
const lint = async (t: import('node:test').TestContext, files: Record<string, string>) => {
  const { app, assets } = await workspace(t, files);
  const preview = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  t.after(() => preview.db.close());
  const renderer = preview.renderer;
  return {
    app,
    assets,
    findings: lintApplication(renderer.app, { regionSlots: (region) => renderer.regionSlots(region) }),
  };
};

test('SLOT-001: a slot the region template and type do not provide is reported with the valid slots', async (t) => {
  const page = `page 7 (
    name: Alerts
    title: Alerts
${report('alerts', 'interactiveReport')}
${report('plain', 'classicReport')}
${button('good', 'alerts', 'rightOfInteractiveReportSearchBar')}
${button('typo', 'alerts', 'rightOfIRSearchBar')}
${button('wrongtype', 'plain', 'rightOfInteractiveReportSearchBar')}
${button('template', 'plain', 'create')}
${button('legacy', 'plain', 'belowBox')}
${button('uppercase', 'plain', 'CREATE')}
    button nodefault (
        buttonName: NODEFAULT
        label: No slot
        layout {
            sequence: 10
            region: @plain
        }
    )
    pageItem P7_FILTER (
        type: textField
        label {
            label: Filter
        }
        layout {
            sequence: 10
            region: @plain
            slot: sortOrder
        }
    )
    region child (
        name: Child
        type: staticContent
        layout {
            sequence: 10
            parentRegion: @plain
            slot: subRegions
        }
    )
    region orphan (
        name: Orphan
        type: staticContent
        layout {
            sequence: 20
            parentRegion: @plain
            slot: tabs
        }
    )
    region custom (
        name: Custom template
        type: staticContent
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @my-own-template
        }
    )
${button('unknowntemplate', 'custom', 'anything')}
)
`;
  const { app, assets, findings } = await lint(t, { 'pages/p00007-alerts.apx': page });
  const slots = findings.filter((finding) => finding.code === 'SLOT-001');
  assert.deepEqual(codes(slots), [
    'SLOT-001 P7_FILTER',
    'SLOT-001 orphan',
    'SLOT-001 typo',
    'SLOT-001 wrongtype',
  ]);
  const typo = slots.find((finding) => finding.component === 'typo')!;
  assert.equal(typo.level, 'warning');
  assert.match(
    typo.message,
    /Button typo uses slot "rightOfIRSearchBar", which region alerts \(type interactiveReport, template standard\) does not provide/,
  );
  assert.match(typo.message, /Valid slots: .*create.*rightOfInteractiveReportSearchBar/);
  assert.match(
    slots.find((finding) => finding.component === 'wrongtype')!.message,
    /only interactiveReport regions have it/,
  );
  assert.match(slots.find((finding) => finding.component === 'orphan')!.message, /^Sub-region orphan/);

  // `preview check` carries the finding with its code and source position.
  const checked = await previewCheck(app, { sourceDir: app, assetsDir: assets, pages: ['7'] });
  const reported = checked.diagnostics.find(
    (entry) => entry.code === 'SLOT-001' && entry.component === 'typo',
  );
  assert.ok(reported, 'SLOT-001 reaches preview check');
  assert.equal(reported.level, 'warning');
  assert.match(reported.message, /^\[SLOT-001\] .*\(pages\/p00007-alerts\.apx:\d+\)$/);
});

test('ITEM-001 / ITEM-002: references to page items that no source defines', async (t) => {
  const page = `page 8 (
    name: Orders
    title: Orders
    region orders (
        name: Orders
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select task_id, title
                  from tasks
                 where title like :P8_SEARCH || '%'
                   and status = :P8_MISSING_BIND -- :P8_COMMENTED is ignored
                   and task_id = nvl(v('P8_MISSING_V'), task_id)
                   and to_char(sysdate, 'HH24:MI') > :APP_ITEM
                   and task_id > :P0_GLOBAL and title <> :P77_OTHER_APP
                \`\`\`
            pageItemsToSubmit: [
                P8_SEARCH
                P8_MISSING_SUBMIT
            ]
        }
        layout {
            sequence: 10
            slot: body
        }
        helpText: Uses :P8_HELP_ONLY and &P8_HELP_ONLY. in prose.
    )
    pageItem P8_SEARCH (
        type: textField
        label {
            label: Search
        }
        layout {
            sequence: 10
            region: @orders
        }
    )
    region info (
        name: Info
        type: staticContent
        source {
            htmlCode: Found &P8_SEARCH. and &P8_MISSING_SUBST!RAW. and :P8_NOT_CODE
        }
        layout {
            sequence: 20
            slot: body
        }
    )
    button go (
        buttonName: GO
        label: Go
        layout {
            sequence: 10
            region: @orders
            slot: create
        }
        behavior {
            action: redirectPage
            target: {
                page: 1
                items: {
                    P1_TITLE: &P8_SEARCH.
                    P1_MISSING_TARGET: x
                }
            }
        }
    )
    dynamicAction refresh (
        name: Refresh
        when {
            event: change
            selectionType: items
            items: P8_SEARCH,P8_MISSING_WHEN
        }
        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: items
                items: P8_MISSING_AFFECTED
            }
        )
    )
)
`;
  const { findings } = await lint(t, {
    'pages/p00008-orders.apx': page,
    'pages/p00000-global.apx': `page 0 (
    name: Global
    pageItem P0_GLOBAL (
        type: hidden
    )
)
`,
    'shared-components/app-items.apx': 'appItem APP_ITEM (\n)\n',
  });
  const items = findings.filter((finding) => finding.code.startsWith('ITEM-'));
  assert.deepEqual(
    items.map((finding) => `${finding.code} ${/item (P\d+_\w+),/u.exec(finding.message)![1]}`).sort(),
    [
      'ITEM-001 P1_MISSING_TARGET',
      'ITEM-001 P8_MISSING_AFFECTED',
      'ITEM-001 P8_MISSING_SUBMIT',
      'ITEM-001 P8_MISSING_WHEN',
      'ITEM-002 P8_MISSING_BIND',
      'ITEM-002 P8_MISSING_SUBST',
      'ITEM-002 P8_MISSING_V',
    ],
    'defined items, global items, items of pages outside the sources, comments and help are not reported',
  );
  assert.ok(items.every((finding) => finding.level === 'warning' && finding.page === '8'));
  assert.match(
    items.find((finding) => finding.message.includes('P8_MISSING_SUBMIT'))!.message,
    /region orders: source\.pageItemsToSubmit names item P8_MISSING_SUBMIT, which no page item or application item in these sources defines/,
  );
});

test('DUP-001 / DUP-002: duplicate item names and HTML DOM ids within a page', async (t) => {
  const region = (id: string, domId: string, extra = '') => `
    region ${id} (
        name: ${id}
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        advanced {
            htmlDomId: ${domId}
        }
${extra}
    )`;
  const item = `
    pageItem P9_NAME (
        type: textField
        label {
            label: Name
        }
        layout {
            sequence: 10
        }
    )`;
  const page = `page 9 (
    name: Duplicates
    title: Duplicates
${region('first', 'panel')}
${region('second', 'panel')}
${region('desktop', 'variant', '        serverSideCondition {\n            type: never\n        }')}
${region('mobile', 'variant', '        serverSideCondition {\n            type: never\n        }')}
${region('clash', 'P9_NAME')}
${item}
${item}
)
`;
  const { findings } = await lint(t, { 'pages/p00009-duplicates.apx': page });
  assert.deepEqual(codes(findings.filter((finding) => finding.code.startsWith('DUP-'))), [
    'DUP-001 P9_NAME',
    'DUP-002 clash',
    'DUP-002 second',
  ]);
  assert.match(
    findings.find((finding) => finding.component === 'second')!.message,
    /HTML DOM ID "panel" is already used by region first \(pages\/p00009-duplicates\.apx:\d+\)/,
  );
});

test('A11Y-001..005: the APEX Advisor accessibility rules', async (t) => {
  const item = (id: string, type: string, body = '') => `
    pageItem ${id} (
        type: ${type}
${body}
        layout {
            sequence: 10
        }
    )`;
  const label = '        label {\n            label: Field\n        }';
  const column = (id: string, extra = '') => `
        column ${id} (
            type: plainText
${extra}
        )`;
  const header = '            accessibility {\n                valueIdentifiesRow: true\n            }';
  const page = `page 10 (
    name: Untitled
${item('P10_LABELLED', 'textField', label)}
${item('P10_PLACEHOLDER', 'textField', '        appearance {\n            valuePlaceholder: Type here\n        }')}
${item('P10_HIDDEN', 'hidden')}
${item('P10_IMAGE', 'displayImage', label)}
${item('P10_IMAGE_ALT', 'displayImage', `${label}\n        settings {\n            altText: Company logo\n        }`)}
${item('P10_SUBMIT', 'selectList', `${label}\n        settings {\n            pageActionOnSelection: submitPage\n        }`)}
${item('P10_QUIET', 'selectList', `${label}\n        settings {\n            pageActionOnSelection: none\n        }`)}
${report('noheader', 'interactiveReport', column('TASK_ID') + column('TITLE'))}
${report('withheader', 'interactiveGrid', column('TASK_ID') + column('TITLE', header))}
${report('cards', 'classicReport', `        componentAppearance {\n            template: @/cards\n        }${column('TITLE')}`)}
${report('nocolumns', 'classicReport')}
)
`;
  const { app, assets, findings } = await lint(t, { 'pages/p00010-untitled.apx': page });
  const a11y = findings.filter((finding) => finding.code.startsWith('A11Y-') && finding.page === '10');
  assert.deepEqual(codes(a11y), [
    'A11Y-001 10',
    'A11Y-002 P10_PLACEHOLDER',
    'A11Y-003 noheader',
    'A11Y-004 P10_IMAGE',
    'A11Y-005 P10_SUBMIT',
  ]);
  assert.match(
    a11y.find((finding) => finding.code === 'A11Y-002')!.message,
    /has no label; a placeholder does not replace it/,
  );
  assert.equal(a11y.find((finding) => finding.code === 'A11Y-005')!.level, 'info');
  assert.equal(a11y.find((finding) => finding.code === 'A11Y-003')!.level, 'info');

  // In the summary, accessibility advice follows every other warning.
  const checked = await previewCheck(app, { sourceDir: app, assetsDir: assets, pages: ['10'] });
  const warnings = checked.diagnostics.filter((entry) => entry.level === 'warning');
  const firstA11y = warnings.findIndex((entry) => entry.code?.startsWith('A11Y-'));
  assert.ok(firstA11y >= 0);
  assert.ok(
    warnings.slice(firstA11y).every((entry) => entry.code?.startsWith('A11Y-')),
    'no other warning after the first accessibility warning',
  );
});

test('notAppliedLocally lists every initialization JavaScript property with what it affects', async (t) => {
  const js = (property: string) =>
    `            ${property}:\n                \`\`\`javascript-browser\n                function (options) { return options; }\n                \`\`\``;
  const page = `page 11 (
    name: Widgets
    title: Widgets
    region grid (
        name: Grid
        type: interactiveGrid
        layout {
            sequence: 10
            slot: body
        }
        componentAdvanced {
${js('initJavaScriptFunction')}
        }
        column TITLE (
            type: textField
            advanced {
${js('columnInitJavaScriptFunction')}
            }
        )
    )
    region map (
        name: Map
        type: map
        layout {
            sequence: 20
            slot: body
        }
        componentAdvanced {
${js('initJavaScriptFunction')}
        }
    )
    pageItem P11_DATE (
        type: datePicker
        label {
            label: Date
        }
        advanced {
${js('initJavaScriptFunction')}
        }
    )
)
`;
  const { app } = await workspace(t, { 'pages/p00011-widgets.apx': page });
  const gaps = localGaps(loadApplication(app)).filter((gap) => gap.pageId === '11');
  assert.deepEqual(
    gaps.map((gap) => [gap.component, gap.property]),
    [
      ['region grid', 'componentAdvanced.initJavaScriptFunction'],
      ['column TITLE', 'advanced.columnInitJavaScriptFunction'],
      ['region map', 'componentAdvanced.initJavaScriptFunction'],
      ['pageItem P11_DATE', 'advanced.initJavaScriptFunction'],
    ],
  );
  assert.match(gaps[0]!.message, /toolbar, features, default view and column options of the grid widget/);
  assert.match(gaps[1]!.message, /column and cell widget options of the interactive grid/);
  assert.match(gaps[2]!.message, /map options, layers and controls/);
  assert.match(gaps[3]!.message, /item widget options/);
});

test('charts: Oracle JET default tooltip content, and unreadable values, columns and time labels are findings', async (t) => {
  const chart = (
    id: string,
    query: string,
    extra = '',
    mapping = 'label: TS\n                value: PRICE',
  ) => `
    region ${id} (
        name: ${id}
        type: chart
        layout {
            sequence: 10
            slot: body
        }
        chart {
            type: line
        }
${extra}
        series s (
            name: BTC Price (USD)
            source {
                type: sqlQuery
                sqlQuery: ${query}
            }
            columnMapping {
                ${mapping}
            }
        )
        axis x (
            name: x
            value {
                format: dateShort
            }
        )
        axis y (
            name: y
            value {
                format: currency
                currency: USD
                decimalPlaces: 0
            }
        )
    )`;
  const timeAxis = '        settings {\n            timeAxisType: enabled\n        }';
  const page = `page 12 (
    name: Prices
    title: Prices
${chart('price', 'select ts, price from prices order by ts', timeAxis)}
${chart('words', 'select ts, note price from prices order by ts')}
${chart('unmapped', 'select ts, price from prices order by ts', '', 'label: TS\n                value: PRICE_USD')}
${chart('notdates', 'select note ts, price from prices', timeAxis)}
${chart('empty', 'select ts, price from prices where 1 = 0')}
)
`;
  const { app, assets } = await workspace(t, {
    'pages/p00012-prices.apx': page,
    '.apex-local/03-prices.sql': `create table prices (ts date, price number, note varchar2(20));
insert into prices values ('2026-11-06 14:00:00', 104123.57, 'n/a');
insert into prices values ('2026-11-06 15:00:00', 104200.12, 'high');
`,
  });
  const server = new PreviewServer({
    sourceDir: app,
    assetsDir: assets,
    database: ':memory:',
    seedDirs: [`${app}/.apex-local`],
  });
  await server.start();
  t.after(() => server.stop());
  const html = await (await fetch(`${server.url}/r/demo/12`)).text();
  // JET's default tooltip: series name, group label in the X-axis format, value in the Y-axis format.
  const tips = [...html.matchAll(/data-tip="([^"]*)"/gu)].map((match) => match[1]!.replaceAll('&#x27;', "'"));
  assert.ok(
    tips.includes('Series\tBTC Price (USD)\nGroup\t11/6/26\nValue\t$104,124'),
    `tooltip follows the axis formats; got ${JSON.stringify(tips.slice(0, 3))}`,
  );

  const diagnostics = server.diagnostics().filter((entry) => entry.code?.startsWith('CHART-'));
  assert.deepEqual(diagnostics.map((entry) => `${entry.code} ${entry.level} ${entry.component}`).sort(), [
    'CHART-001 warning words',
    'CHART-002 warning unmapped',
    'CHART-003 warning notdates',
    'CHART-004 info empty',
  ]);
  assert.match(
    diagnostics.find((entry) => entry.code === 'CHART-001')!.message,
    /2 of 2 values of PRICE are not numbers \(for example "n\/a"\); Oracle JET shows NaN/,
  );
  assert.match(
    diagnostics.find((entry) => entry.code === 'CHART-002')!.message,
    /columnMapping\.value names PRICE_USD, which the query does not return \(TS, PRICE\)/,
  );
  assert.match(
    diagnostics.find((entry) => entry.code === 'CHART-003')!.message,
    /the label values are not dates/,
  );
});

test('the fixture application has no slot, item or duplicate findings', async (t) => {
  const { app, assets } = await workspace(t);
  const result = checkApplication({ sourceDir: app, assetsDir: assets });
  assert.deepEqual(
    result.diagnostics
      .filter((entry) => entry.code && !entry.code.startsWith('CHART-'))
      .map((entry) => entry.code),
    ['A11Y-001'],
    'only the untitled page 2 of the fixture is reported',
  );
});
