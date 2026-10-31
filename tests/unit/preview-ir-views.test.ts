import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { checkApplication, PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const SEED = `create table emp (
  emp_id integer primary key,
  ename varchar2(40) not null,
  dept varchar2(20),
  sal number,
  rating number,
  active varchar2(1),
  color varchar2(10)
);
${Array.from(
  { length: 9 },
  (_unused, index) =>
    `insert into emp (ename, dept, sal, rating, active, color) values ('Emp ${index + 1}', '${['ACCOUNTING', 'SALES', 'RESEARCH'][index % 3]}', ${(index + 1) * 100}, ${(index % 5) + 1}, '${index % 2 ? 'N' : 'Y'}', '#ff000${index}');`,
).join('\n')}
`;

const COLUMNS = `
        column EMP_ID (
            type: hidden
        )
        column ENAME (
            heading {
                heading: Name
            }
        )
        column DEPT (
        )
        column SAL (
            appearance {
                formatMask: 999G990
            }
        )
`;

const PAGE = `page 5 (
    name: Views
    alias: VIEWS

    region people (
        name: People
        type: interactiveReport
        source {
            location: localDatabase
            sqlQuery:
                \`\`\`sql
                select emp_id, ename, dept, sal from emp
                \`\`\`
        }
        layout {
            sequence: 10
        }
        download {
            formats: [
                csv
                excel
                pdf
            ]
        }
${COLUMNS}
        savedReport 1 (
            visibility: primaryDefault

            displayColumn ENAME (
                sequence: 1
            )
            displayColumn SAL (
                sequence: 2
            )
            displayColumn APXWS_CC_001 (
                sequence: 3
            )

            controlBreak (
                column: DEPT
            )
            aggregate (
                column: SAL
                function: sum
            )
            highlight (
                name: Rich
                highlight {
                    type: row
                }
                colors {
                    background: #99FF99
                }
                condition {
                    column: SAL
                    operator: >=
                    value: 700
                }
            )
            computation (
                columnName: APXWS_CC_001
                label {
                    column: Double
                }
                source {
                    dataType: number
                    expression: D * 2
                }
            )
        )

        savedReport 2 (
            name: By Department
            visibility: alternativeDefault
            view {
                default: groupBy
            }

            groupByColumn (
                column: DEPT
            )
            groupByAggregate (
                heading: Total Salary
                aggregate {
                    column: SAL
                    function: sum
                    displaySum: true
                }
            )
        )

        savedReport 3 (
            name: Salary Chart
            visibility: public
            view {
                chart: true
                default: chart
            }
            chart {
                type: bar
                label: ENAME
                value: SAL
                valueAggregation: sum
            }
        )
    )

    region staff (
        name: Staff
        type: interactiveGrid
        source {
            location: localDatabase
            tableName: EMP
        }
        layout {
            sequence: 20
        }
        edit {
            enabled: true
            allowedOperations: [
                add
                update
                delete
            ]
        }
        editAuthorization {
            delete: @no-deletes
        }
        download {
            formats: [
                csv
                excel
            ]
        }

        column EMP_ID (
            type: hidden
            source {
                databaseColumn: EMP_ID
                primaryKey: true
            }
        )
        column ENAME (
            type: textField
        )
        column DEPT (
            type: popupLov
            lov {
                type: staticValues
                staticValues: STATIC:Accounting;ACCOUNTING,Sales;SALES,Research;RESEARCH
            }
        )
        column SAL (
            type: numberField
        )
        column RATING (
            type: starRating
        )
        column ACTIVE (
            type: switch
        )
        column COLOR (
            type: colorPicker
        )

        savedReport 10 (
            visibility: primary

            controlBreak (
                column: @DEPT
            )
            highlight (
                name: Low
                highlight {
                    type: cell
                    column: @SAL
                }
                colors {
                    background: #FF9999
                }
                condition {
                    type: column
                    column: @SAL
                    operator: lessThan
                    value: 300
                }
            )
            aggregate (
                column: @SAL
                function: sum
                showGrandTotal: true
            )
        )
    )
)
`;

const AUTH = `authorization no-deletes (
    name: No Deletes
    type: plsqlFunctionBody
    settings {
        plsqlFunctionBody:
            \`\`\`plsql
            return false;
            \`\`\`
    }
)
`;

async function start(t: import('node:test').TestContext) {
  const { app, assets } = await workspace(t, {
    'pages/p00005-views.apx': PAGE,
    'shared-components/authorizations.apx': AUTH,
    '.apex-local/02-views.sql': SEED,
  });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const first = await fetch(`${server.url}/r/demo/views`);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  const html = await first.text();
  const get = (path: string) => fetch(`${server.url}${path}`, { headers: { cookie } });
  const region = async (id: string, extra = '') =>
    (await get(`/r/demo/__apex/region?page=5&region=${id}${extra}`)).text();
  const route = async (body: unknown) =>
    (await (
      await fetch(`${server.url}/r/demo/__apex/x/report`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ page: '5', region: 'people', ...(body as object) }),
      })
    ).json()) as Record<string, unknown>;
  const download = async (regionId: string, format: string) =>
    (await (
      await get(`/r/demo/__apex/x/report-download?page=5&region=${regionId}&format=${format}`)
    ).json()) as { filename: string; content: string; encoding?: string; mime?: string };
  return { server, html, get, region, route, download, cookie, app, assets };
}

const textOf = (html: string) =>
  html
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .trim();

const irConfig = (html: string) =>
  JSON.parse(
    (/data-apex-local-ir="([^"]*)"/u.exec(html)![1] ?? '')
      .replaceAll('&quot;', '"')
      .replaceAll('&#x27;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&'),
  ) as Record<string, unknown>;

test('saved report breaks, aggregates, highlights and computations render in the report view', async (t) => {
  const { html } = await start(t);
  const ir = html.slice(html.indexOf('id="people_ir"'), html.indexOf('id="staff_ig"'));
  // control break on DEPT: header rows, the column is not repeated in the table
  assert.match(ir, /a-IRR-header--group[^>]*><span class="a-IRR-headerLabel">Dept : ACCOUNTING<\/span>/);
  assert.equal([...ir.matchAll(/a-IRR-header--group/gu)].length, 3);
  assert.doesNotMatch(ir, /data-column="DEPT"/);
  // computed column D * 2 with its label, after Name and Sal
  assert.deepEqual(
    [...ir.matchAll(/data-column="([A-Z_0-9]+)"/gu)].slice(0, 3).map((match) => match[1]),
    ['ENAME', 'SAL', 'APXWS_CC_001'],
  );
  assert.match(ir, />Double</);
  assert.match(textOf(ir), /Emp 7 700 1400/);
  // per-break and overall sums with the column format mask
  assert.match(textOf(ir), /Sum: 1,200/);
  assert.match(textOf(ir), /Overall Sum: 4,500/);
  // row highlight for SAL >= 700
  assert.match(ir, /<td class="[^"]*" headers="people_ENAME" style="background-color:#99FF99">Emp 7/);
  assert.doesNotMatch(ir, /style="background-color:#99FF99">Emp 1</);
  // single row view link column, chips and the saved report select list
  assert.match(ir, /data-apex-local-ir-single="0"/);
  assert.match(ir, /a-IRR-controls-item--controlBreak/);
  assert.match(ir, /a-IRR-controls-item--highlight/);
  assert.match(
    ir,
    /<optgroup label="Default"><option value="s:1" selected>Primary Report<\/option><option value="s:2">By Department<\/option><\/optgroup><optgroup label="Public"><option value="s:3">Salary Chart<\/option>/,
  );
  const config = irConfig(ir);
  assert.deepEqual(config.formats, ['csv', 'excel', 'pdf']);
  assert.deepEqual(
    (config.identifiers as { id: string; name: string }[])
      .slice(0, 3)
      .map((entry) => `${entry.id}=${entry.name}`),
    ['B=ENAME', 'C=DEPT', 'D=SAL'],
  );
});

test('actions menu routes change breaks, highlights, computations and aggregates', async (t) => {
  const { region, route } = await start(t);
  assert.deepEqual(await route({ action: 'controlBreak', breaks: [] }), { ok: true });
  assert.deepEqual(
    await route({
      action: 'highlight',
      highlight: {
        name: 'Sales',
        type: 'cell',
        column: 'DEPT',
        operator: '=',
        value: 'SALES',
        background: '#FFFF99',
      },
    }),
    { ok: true },
  );
  assert.deepEqual(await route({ action: 'columns', columns: ['ENAME', 'DEPT', 'SAL'] }), { ok: true });
  const bad = await route({ action: 'compute', computation: { label: 'Broken', expression: 'D +* 2' } });
  assert.match(String(bad.error), /Invalid computation expression/);
  assert.deepEqual(
    await route({
      action: 'compute',
      computation: { label: 'Bonus', expression: 'round(SAL / 10)', formatMask: '' },
    }),
    { ok: true },
  );
  assert.deepEqual(await route({ action: 'aggregate', fn: 'average', column: 'SAL' }), { ok: true });
  assert.deepEqual(await route({ action: 'aggregate', fn: 'count', column: 'ENAME' }), { ok: true });
  let html = await region('people');
  assert.doesNotMatch(html, /a-IRR-header--group/);
  assert.match(html, /headers="people_DEPT" style="background-color:#FFFF99">SALES/);
  assert.match(html, />Bonus</);
  assert.match(textOf(html), /Emp 9 RESEARCH 900 90/);
  assert.match(textOf(html), /Average: 500/);
  assert.match(textOf(html), /Count: 9/);
  // toggling and removing chips
  await route({ action: 'toggle', kind: 'highlights', index: 1, enabled: false });
  html = await region('people');
  assert.doesNotMatch(html, /#FFFF99">SALES/);
  await route({ action: 'remove', kind: 'computations', index: 1 });
  assert.doesNotMatch(await region('people'), />Bonus</);
});

test('group by, pivot, chart and single row views', async (t) => {
  const { region, route } = await start(t);
  assert.deepEqual(
    await route({
      action: 'groupBy',
      groupBy: {
        columns: ['DEPT'],
        functions: [
          { fn: 'sum', column: 'SAL', label: 'Total', sum: true },
          { fn: 'count', column: 'ENAME', label: 'People' },
        ],
      },
    }),
    { ok: true },
  );
  let html = await region('people');
  assert.match(html, /class="a-IRR-groupByView"/);
  assert.match(html, /data-apex-local-ir-view="groupBy"/);
  assert.match(textOf(html), /Dept Total People ACCOUNTING 1,200 3 RESEARCH 1,800 3 SALES 1,500 3 Sum 4,500/);

  await route({
    action: 'pivot',
    pivot: { pivot: ['DEPT'], rows: ['ENAME'], functions: [{ fn: 'sum', column: 'SAL', label: 'Salary' }] },
  });
  html = await region('people');
  assert.match(html, /a-IRR-header--pivotColumn u-tC" colspan="1">ACCOUNTING/);
  assert.match(textOf(html), /Emp 1 100/);

  await route({ action: 'chart', chart: { type: 'pie', label: 'DEPT', value: 'SAL', fn: 'sum' } });
  html = await region('people');
  assert.match(html, /class="a-IRR-chartView"/);
  assert.match(html, /<svg/);

  await route({ action: 'view', view: 'report' });
  assert.deepEqual(await route({ action: 'singleRow', index: 2 }), { ok: true });
  html = await region('people');
  assert.match(html, /class="a-IRR-singleRowView"/);
  assert.match(textOf(html), /Row 3 of 9/);
  assert.match(html, /a-IRR-singleRow-name">Name<\/div><div class="a-IRR-singleRow-value">Emp 7/);
  await route({ action: 'singleRow', index: -1 });
  html = await region('people');
  assert.doesNotMatch(html, /a-IRR-singleRowView/);
  assert.match(html, /data-apex-local-ir-close-view="chart"/);
  await route({ action: 'remove', kind: 'chart' });
  assert.doesNotMatch(await region('people'), /data-apex-local-ir-view="chart"/);
});

test('saved reports: alternative defaults, private reports per session, reset and delete', async (t) => {
  const { region, route, get } = await start(t);
  assert.deepEqual(await route({ action: 'selectReport', id: 's:2' }), { ok: true });
  let html = await region('people');
  assert.match(html, /a-IRR-groupByView/);
  assert.match(textOf(html), /Saved Report = "By Department"/);
  assert.match(textOf(html), /Total Salary/);

  await route({ action: 'selectReport', id: 's:3' });
  html = await region('people');
  assert.match(html, /a-IRR-chartView/);
  const chart = await (await get('/r/demo/__apex/x/report-chart?page=5&region=people&width=900')).text();
  assert.match(chart, /<svg[^>]*viewBox="0 0 900 /);

  await route({ action: 'selectReport', id: 's:1' });
  await route({ action: 'filter', column: 'DEPT', operator: '=', value: 'SALES' });
  assert.deepEqual(await route({ action: 'saveReport', name: 'Sales only' }), { ok: true, report: 'p:1' });
  html = await region('people');
  assert.match(html, /<optgroup label="Private"><option value="p:1" selected>Sales only<\/option>/);
  assert.match(textOf(html), /Saved Report = "Sales only"/);
  // a reset restores the private report as saved, not the primary
  await route({ action: 'removeFilter', index: 0 });
  await route({ action: 'reset' });
  assert.match(textOf(await region('people')), /Dept = 'SALES'/);
  assert.deepEqual(await route({ action: 'deleteReport' }), { ok: true });
  html = await region('people');
  assert.doesNotMatch(html, /Sales only/);
  assert.match(html, /<option value="s:1" selected>/);
});

test('downloads produce a real xlsx workbook and a labelled print page for PDF', async (t) => {
  const { download } = await start(t);
  const excel = await download('people', 'excel');
  assert.equal(excel.filename, 'People.xlsx');
  assert.equal(excel.encoding, 'base64');
  const files = unzipSync(new Uint8Array(Buffer.from(excel.content, 'base64')));
  assert.ok(files['[Content_Types].xml']);
  const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
  assert.match(sheet, /<t xml:space="preserve">Dept<\/t>.*<t xml:space="preserve">Name<\/t>/);
  assert.match(sheet, /<c r="D2"><v>200<\/v><\/c>/);
  const pdf = await download('people', 'pdf');
  assert.equal(pdf.filename, 'People (print).html');
  assert.match(pdf.content, /PDF files are not generated without the database/);
  assert.match(pdf.content, /<th>Name<\/th>/);
  const grid = await download('staff', 'excel');
  const gridSheet = strFromU8(
    unzipSync(new Uint8Array(Buffer.from(grid.content, 'base64')))['xl/worksheets/sheet1.xml']!,
  );
  assert.match(gridSheet, /Accounting/);
});

test('interactive grid column editors, edit authorization and saved-report formatting', async (t) => {
  const { html, server, region, cookie } = await start(t);
  const config = JSON.parse(
    /<script type="application\/json" id="staff_ig_config">([\s\S]*?)<\/script>/u.exec(html)![1]!,
  ) as {
    allowed: { add: boolean; update: boolean; delete: boolean };
    customItems: { id: string; kind: string; lov?: unknown[]; on?: string; max?: number }[];
    columns: Record<string, { controlBreakIndex?: number; hidden?: boolean; escape?: boolean }>;
    fields: Record<string, { index: number }>;
    data: unknown[][];
    highlights: Record<string, { row: boolean; background?: string }>;
    aggregateLabels: Record<string, { label: string }>;
    metaField: string;
    formats: string[];
  };
  // edit authorization follows the preview policy: permissive unless "view as" enforces it
  assert.deepEqual(config.allowed, { add: true, update: true, delete: true });
  assert.deepEqual(config.customItems.map((item) => item.kind).sort(), ['popupLov', 'stars', 'switch']);
  assert.equal(config.customItems.find((item) => item.kind === 'popupLov')!.lov!.length, 3);
  assert.match(html, /<input type="color" id="staff_ig_c_COLOR"/);
  assert.match(html, /<div id="staff_ig_c_DEPT" class="apex-local-ig-popupLov/);
  assert.equal(config.columns.DEPT!.controlBreakIndex, 1);
  assert.equal(config.columns.RATING!.escape, false);
  assert.deepEqual(config.highlights.h0, { seq: 10, row: false, background: '#FF9999' } as never);
  assert.deepEqual(config.aggregateLabels.SUM, { label: 'Sum', overallLabel: 'Overall Sum' } as never);
  assert.deepEqual(config.formats, ['csv', 'excel']);
  const meta = config.fields[config.metaField]!.index;
  const records = config.data.map((record) => record[meta] as Record<string, unknown>);
  // break order: ACCOUNTING rows first; the first row (SAL 100) has the cell highlight
  assert.deepEqual(records[0], { fields: { SAL: { highlight: 'h0' } } });
  assert.equal(records.filter((entry) => entry.endControlBreak).length, 3);
  assert.equal(records.filter((entry) => entry.agg === 'SUM').length, 4);
  assert.deepEqual(records.at(-1), { agg: 'SUM', grandTotal: true });
  assert.equal(config.data.at(-1)![config.fields.SAL!.index], '4500');
  const stars = config.data[0]![config.fields.RATING!.index] as { v: string; d: string };
  assert.match(stars.d, /aria-label="1 of 5"/);

  // with "view as" enforcing schemes, the denied delete is gone from the grid and the server
  const viewAs = await fetch(`${server.url}/r/demo/__apex/x/view-as`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ roles: [], deny: [] }),
  });
  assert.equal(viewAs.ok, true);
  const enforced = JSON.parse(
    /id="staff_ig_config">([\s\S]*?)<\/script>/u.exec(await region('staff'))![1]!,
  ) as { allowed: Record<string, boolean> };
  assert.deepEqual(enforced.allowed, { add: true, update: true, delete: false });
});

test('preview check reports what the views do not simulate', async (t) => {
  const { app, assets } = await workspace(t, {
    'pages/p00005-views.apx': PAGE,
    'shared-components/authorizations.apx': AUTH,
    '.apex-local/02-views.sql': SEED,
  });
  const result = checkApplication({ sourceDir: app, assetsDir: assets });
  assert.deepEqual(
    result.pages.filter((page) => page.error),
    [],
  );
  const messages = result.diagnostics.map((entry) => entry.message);
  for (const expected of [
    /Interactive report people: Actions menu flashback, subscription are not simulated/,
    /Interactive report people: PDF download is a print-friendly HTML page locally/,
    /Authorization scheme no-deletes denies DEVELOPER locally; the preview allows access anyway/,
    /Interactive Grid column staff.DEPT: popup LOV is a local search dialog/,
  ])
    assert.ok(
      messages.some((message) => expected.test(message)),
      `missing diagnostic ${expected} in ${messages.join(' | ')}`,
    );
  assert.ok(
    !messages.some((message) => /Saved report (controlBreak|highlight|aggregate|computation)/.test(message)),
  );
  assert.ok(
    !messages.some((message) => /alternative\/public saved report/.test(message) && /people/.test(message)),
  );
});

test('classic report named-column templates substitute positional #1# placeholders', async (t) => {
  const theme = `begin
wwv_flow_imp_shared.create_row_template(
 p_id=>wwv_flow_imp.id(77)
,p_row_template_name=>'Positional'
,p_static_id=>'positional'
,p_row_template1=>'<li data-n="#1#">#2# (#DEPT#) #4#</li>'
,p_row_template_before_rows=>'<ul class="positional">'
,p_row_template_after_rows=>'</ul>'
,p_row_template_type=>'NAMED_COLUMNS'
);
end;
/
`;
  const page = `page 6 (
    name: Positional
    alias: POSITIONAL

    region names (
        name: Names
        type: classicReport
        source {
            location: localDatabase
            sqlQuery:
                \`\`\`sql
                select emp_id, '<b>' || ename || '</b>' ename, dept, sal from emp where emp_id <= 2 order by emp_id
                \`\`\`
        }
        componentAppearance {
            template: @/positional
        }
        layout {
            sequence: 10
        }
    )
)
`;
  const { app, assets } = await workspace(
    t,
    { 'pages/p00006-positional.apx': page, '.apex-local/02-views.sql': SEED },
    theme,
  );
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const html = await (await fetch(`${server.url}/r/demo/positional`)).text();
  assert.match(html, /<li data-n="1">&lt;b&gt;Emp 1&lt;\/b&gt; \(ACCOUNTING\) 100<\/li>/);
  assert.match(html, /<li data-n="2">&lt;b&gt;Emp 2&lt;\/b&gt; \(SALES\) 200<\/li>/);
  assert.doesNotMatch(html, /#[0-9]#/);
});
