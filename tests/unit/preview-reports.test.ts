import test from 'node:test';
import assert from 'node:assert/strict';
import { checkApplication, PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const SEED = `create table emp (
  emp_id integer primary key,
  ename varchar2(40) not null,
  dept varchar2(20),
  sal number,
  hired date
);
${Array.from(
  { length: 12 },
  (_unused, index) =>
    `insert into emp (ename, dept, sal, hired) values ('Emp ${String(index + 1).padStart(2, '0')}', '${['ACCOUNTING', 'SALES', 'RESEARCH'][index % 3]}', ${(index + 1) * 100}, '2026-01-${String(index + 1).padStart(2, '0')}');`,
).join('\n')}
create table dept_lov (code varchar2(20), label varchar2(40));
insert into dept_lov values ('ACCOUNTING', 'Accounting');
insert into dept_lov values ('SALES', 'Sales');
insert into dept_lov values ('RESEARCH', 'Research');
`;

const PAGE = `page 3 (
    name: Reports
    alias: REPORTS

    region classic (
        name: Classic
        type: classicReport
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
        reportLayout {
            numberOfRows: 5
        }
        pagination {
            type: rowRangesXToYOfZWithPagination
        }
        download {
            csvExportEnabled: true
        }
        printing {
            enabled: true
        }

        column EMP_ID (
            type: hidden
        )
        column ENAME (
            heading {
                heading: Name
            }
            sorting {
                defaultSequence: 1
                direction: desc
            }
        )
        column DEPT (
            sorting {
                sortable: false
            }
        )
        column SAL (
            appearance {
                formatMask: 999G990D00
            }
        )
    )

    region empty (
        name: Empty
        type: classicReport
        source {
            location: localDatabase
            sqlQuery:
                \`\`\`sql
                select ename from emp where 1 = 0
                \`\`\`
        }
        layout {
            sequence: 20
        }
        messages {
            whenNoDataFound: Nothing here
        }
    )

    region people (
        name: People
        type: interactiveReport
        source {
            location: localDatabase
            tableName: EMP
        }
        layout {
            sequence: 30
        }
        link {
            linkColumn: customTarget
            target: {
                page: 1
                items: {
                    P1_TITLE: \\#EMP_ID#\\
                }
            }
        }
        actionsMenu {
            chart: false
        }

        column EMP_ID (
            type: hidden
        )
        column ENAME (
            type: plainText
            heading {
                heading: Employee
            }
        )
        column DEPT (
            type: plainTextBasedOnLov
            lov {
                type: sqlQuery
                sqlQuery:
                    \`\`\`sql
                    select label d, code r from dept_lov
                    \`\`\`
            }
        )
        column SAL (
            type: plainText
        )
        column HIRED (
            type: plainText
        )

        savedReport 1 (
            visibility: primaryDefault
            view {
                rowsPerPage: 5
            }

            displayColumn SAL (
                sequence: 1
            )
            displayColumn ENAME (
                sequence: 2
            )
            displayColumn DEPT (
                sequence: 3
            )

            sort (
                column: SAL
                sort {
                    sequence: 1
                    direction: desc
                }
            )

            highlight (
                name: Big
            )
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
            sequence: 40
        }
        edit {
            enabled: true
            allowedOperations: [
                add
                update
                delete
            ]
        }
        pagination {
            type: page
        }

        column APEX$ROW_SELECTOR (
            type: rowSelector
        )
        column EMP_ID (
            type: hidden
            source {
                databaseColumn: EMP_ID
                dataType: number
                primaryKey: true
            }
        )
        column ENAME (
            type: textField
            heading {
                heading: Name
            }
            validation {
                valueRequired: true
                maxLength: 40
            }
        )
        column DEPT (
            type: selectList
            lov {
                type: staticValues
                staticValues: STATIC:Accounting;ACCOUNTING,Sales;SALES,Research;RESEARCH
            }
        )
        column SAL (
            type: numberField
        )
        column HIRED (
            type: datePicker
            cascadingLov {
                parentColumns: DEPT
            }
        )
    )

    button save (
        buttonName: SAVE
        label: Save
        layout {
            sequence: 10
        }
    )

    process save-staff (
        name: Save Staff
        type: interactiveGridAutoRowProcessing
        editableRegion: @staff
        execution {
            sequence: 10
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )
)
`;

async function start(t: import('node:test').TestContext) {
  const { app, assets } = await workspace(t, {
    'pages/p00003-reports.apx': PAGE,
    '.apex-local/02-reports.sql': SEED,
  });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const first = await fetch(`${server.url}/r/demo/reports`);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  const html = await first.text();
  const get = (path: string) => fetch(`${server.url}${path}`, { headers: { cookie } });
  const region = async (id: string, extra = '') =>
    (await get(`/r/demo/__apex/region?page=3&region=${id}${extra}`)).text();
  const route = async (name: string, body: unknown) =>
    (await (
      await fetch(`${server.url}/r/demo/__apex/x/${name}`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ page: '3', ...(body as object) }),
      })
    ).json()) as Record<string, unknown>;
  return { server, html, get, region, route, cookie, app, assets };
}

const textOf = (html: string) =>
  html
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .replaceAll('&#x27;', "'")
    .replaceAll('&gt;', '>')
    .trim();

test('classic report sorts, paginates with the requested type and downloads CSV', async (t) => {
  const { html, region, route, get } = await start(t);
  const classic = html.slice(html.indexOf('id="classic"'), html.indexOf('id="empty"'));
  // default sort ENAME desc, 5 rows per page, hidden EMP_ID not shown, format mask applied
  assert.match(classic, /class="u-Report-sort" href="#" data-apex-local-sort="ENAME"/);
  assert.match(classic, /icon-rpt-sort-desc/);
  assert.doesNotMatch(classic, /data-apex-local-sort="DEPT"/);
  assert.doesNotMatch(classic, /data-apex-local-sort="EMP_ID"/);
  assert.match(textOf(classic), /Emp 12 .* Emp 08/);
  assert.match(textOf(classic), /1 - 5 of 12/);
  assert.match(classic, /1,200\.00/);
  assert.match(
    classic,
    /apexLocalReports\.paginate\(&#x27;classic&#x27;,2\)|apexLocalReports\.paginate\('classic',2\)/,
  );

  const second = await region('classic', '&pg=3');
  assert.match(textOf(second), /11 - 12 of 12/);
  assert.match(textOf(second), /Emp 02 .* Emp 01/);

  assert.deepEqual(await route('report', { region: 'classic', action: 'classicSort', column: 'ENAME' }), {
    ok: true,
  });
  const ascending = await region('classic');
  assert.match(textOf(ascending), /Emp 01 .* Emp 05/);
  assert.match(ascending, /icon-rpt-sort-asc/);

  const csv = (await (
    await get('/r/demo/__apex/x/report-download?page=3&region=classic&format=csv')
  ).json()) as {
    filename: string;
    content: string;
  };
  assert.equal(csv.filename, 'Classic.csv');
  assert.match(csv.content, /^Name,Dept,Sal\r\nEmp 01,ACCOUNTING,100\.00\r\n/);

  const empty = html.slice(html.indexOf('id="empty"'), html.indexOf('id="people"'));
  assert.match(empty, /<span class="nodatafound">Nothing here<\/span>/);
});

test('interactive report applies saved-report defaults and session state from the routes', async (t) => {
  const { html, region, route, get } = await start(t);
  const ir = html.slice(html.indexOf('id="people_ir"'), html.indexOf('id="staff_ig"'));
  assert.match(ir, /^id="people_ir" data-apex-local-ir="\{&quot;region&quot;:&quot;people&quot;/);
  assert.match(ir, /class="a-IRR-search-field" type="search" id="people_search_field"/);
  assert.match(ir, /class="a-Button a-IRR-button a-IRR-button--actions"/);
  // saved report: SAL, ENAME, DEPT order, SAL desc, 5 rows per page, LOV display values
  const headers = [...ir.matchAll(/<a class="a-IRR-headerLink"[^>]*data-column="([A-Z_]+)"/gu)].map(
    (m) => m[1],
  );
  assert.deepEqual(headers, ['SAL', 'ENAME', 'DEPT']);
  assert.match(ir, /icon-irr-sort-desc/);
  assert.match(textOf(ir), /1200 Emp 12 Research/);
  assert.match(textOf(ir), /1 - 5 of 12/);
  assert.match(ir, /class="a-IRR-linkCol u-tC"><a href="\/r\/demo\/home\?p1_title=12"/);

  // search across displayed columns (display values of LOV columns included)
  assert.deepEqual(await route('report', { region: 'people', action: 'search', text: 'sales' }), {
    ok: true,
  });
  let html2 = await region('people');
  assert.match(html2, /a-IRR-controls-item--search/);
  assert.match(textOf(html2), /Row text contains 'sales'/);
  assert.match(textOf(html2), /1 - 4 of 4/);

  // column filter and toggling it off
  await route('report', { region: 'people', action: 'filter', column: 'SAL', operator: '>=', value: '800' });
  html2 = await region('people');
  assert.match(textOf(html2), /Sal >= '800'/);
  assert.match(textOf(html2), /1 - 2 of 2/);
  await route('report', { region: 'people', action: 'toggleFilter', index: 1, enabled: false });
  assert.match(textOf(await region('people')), /1 - 4 of 4/);
  await route('report', { region: 'people', action: 'removeFilter', index: 0 });

  // sort, hide column, rows per page
  await route('report', { region: 'people', action: 'sort', sort: [{ column: 'ENAME', direction: 'asc' }] });
  await route('report', { region: 'people', action: 'hide', column: 'DEPT' });
  await route('report', { region: 'people', action: 'rowsPerPage', value: 10 });
  html2 = await region('people');
  assert.deepEqual(
    [...html2.matchAll(/data-column="([A-Z_]+)"/gu)].map((m) => m[1]),
    ['SAL', 'ENAME'],
  );
  assert.match(textOf(html2), /100 Emp 01/);
  assert.match(textOf(html2), /1 - 10 of 12/);

  // column heading values, download, then reset to the saved report
  const values = (await (
    await get('/r/demo/__apex/x/report-values?page=3&region=people&column=DEPT')
  ).json()) as string[];
  assert.deepEqual(values, ['Accounting', 'Research', 'Sales']);
  const download = (await (
    await get('/r/demo/__apex/x/report-download?page=3&region=people&format=html')
  ).json()) as {
    content: string;
  };
  assert.match(download.content, /<th>Sal<\/th><th>Employee<\/th>/);
  await route('report', { region: 'people', action: 'columns', columns: ['ENAME', 'HIRED'] });
  assert.match(textOf(await region('people')), /Employee Hired/);
  await route('report', { region: 'people', action: 'reset' });
  assert.match(textOf(await region('people')), /1200 Emp 12 Research/);

  const bad = await route('report', {
    region: 'people',
    action: 'filter',
    column: 'SAL',
    operator: 'soundsLike',
  });
  assert.match(String(bad.error), /Unsupported filter/);
});

test('interactive grid renders a local model and saves through row processing', async (t) => {
  const { html, route, server, cookie } = await start(t);
  const config = JSON.parse(
    /<script type="application\/json" id="staff_ig_config">([\s\S]*?)<\/script>/u.exec(html)![1]!,
  ) as {
    identity: string[];
    data: unknown[][];
    fields: Record<string, { index: number }>;
    columns: Record<string, { elementId?: string; hidden?: boolean }>;
    editable: boolean;
    rowSelector: boolean;
  };
  assert.deepEqual(config.identity, ['EMP_ID']);
  assert.equal(config.data.length, 12);
  assert.equal(config.editable, true);
  assert.equal(config.rowSelector, true);
  assert.equal(config.columns.EMP_ID!.hidden, true);
  assert.equal(config.columns.ENAME!.elementId, 'staff_ig_c_ENAME');
  const dept = config.data[0]![config.fields.DEPT!.index] as { v: string; d: string };
  assert.deepEqual(dept, { v: 'ACCOUNTING', d: 'Accounting' });
  assert.match(html, /<select id="staff_ig_c_DEPT" class="selectlist apex-item-select"/);
  assert.match(html, /<div class="a-IG" id="staff_ig"/);

  const values = (name: string, dept = 'SALES', sal = '10') => ({
    EMP_ID: 't1000',
    ENAME: name,
    DEPT: dept,
    SAL: sal,
    HIRED: '',
  });
  const invalid = await route('ig-save', {
    region: 'staff',
    changes: [{ op: 'insert', id: 't1000', values: values('') }],
  });
  assert.equal(invalid.ok, false);
  assert.deepEqual((invalid.errors as { column: string; message: string }[])[0], {
    id: 't1000',
    column: 'ENAME',
    message: 'Name must have some value.',
  });

  const saved = await route('ig-save', {
    region: 'staff',
    changes: [
      { op: 'insert', id: 't1000', values: values('New hire', 'RESEARCH', '1,500') },
      { op: 'update', id: '1', values: { ...values('Renamed'), EMP_ID: '1' } },
      { op: 'delete', id: '2', values: { EMP_ID: '2' } },
    ],
  });
  assert.deepEqual(saved, { ok: true, saved: 3, errors: [] });
  assert.equal(server.db.scalar("select sal from emp where ename = 'New hire'"), 1500);
  assert.equal(server.db.scalar('select ename from emp where emp_id = 1'), 'Renamed');
  assert.equal(server.db.scalar('select count(*) from emp where emp_id = 2'), 0);
  assert.equal(server.db.scalar('select hired from emp where emp_id = 1'), null);

  // page submit: the browser stages the changes, the row processing process applies them
  assert.deepEqual(
    await route('ig-stage', {
      region: 'staff',
      changes: [{ op: 'update', id: '3', values: { EMP_ID: '3', ENAME: 'Staged' } }],
    }),
    { ok: true, staged: 1 },
  );
  const submit = (await (
    await fetch(`${server.url}/r/demo/wwv_flow.accept`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ p_flow_step_id: '3', p_request: 'SAVE', p_json: '{}' }),
    })
  ).json()) as { redirectURL?: string };
  assert.equal(submit.redirectURL, '/r/demo/reports');
  assert.equal(server.db.scalar('select ename from emp where emp_id = 3'), 'Staged');

  // grid filters/sort live in the session too
  await route('report', { region: 'staff', action: 'search', text: 'Staged' });
  const filtered = await (
    await fetch(`${server.url}/r/demo/__apex/region?page=3&region=staff`, { headers: { cookie } })
  ).text();
  const filteredConfig = JSON.parse(/id="staff_ig_config">([\s\S]*?)<\/script>/u.exec(filtered)![1]!) as {
    data: unknown[];
    filters: { label: string }[];
  };
  assert.equal(filteredConfig.data.length, 1);
  assert.equal(filteredConfig.filters[0]!.label, "Row text contains 'Staged'");
});

test('grid without row processing refuses to save and unsupported features are diagnosed', async (t) => {
  const { app, assets } = await workspace(t, {
    'pages/p00003-reports.apx': PAGE.replace(/ {4}process save-staff \([\s\S]*?\n {4}\)\n/u, ''),
    '.apex-local/02-reports.sql': SEED,
  });
  const result = checkApplication({ sourceDir: app, assetsDir: assets });
  assert.deepEqual(
    result.pages.filter((page) => page.error),
    [],
  );
  const messages = result.diagnostics.map((entry) => entry.message);
  for (const expected of [
    /Classic report classic: printing is not simulated/,
    /Interactive report people: Actions menu flashback, subscription are not simulated/,
    /Interactive Grid column staff.HIRED: cascading LOV is not simulated/,
  ])
    assert.ok(
      messages.some((message) => expected.test(message)),
      `missing diagnostic ${expected}`,
    );
  assert.ok(!messages.some((message) => /chart/.test(message) && /Actions menu/.test(message)));

  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const response = (await (
    await fetch(`${server.url}/r/demo/__apex/x/ig-save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page: '3', region: 'staff', changes: [{ op: 'delete', id: '1', values: {} }] }),
    })
  ).json()) as { ok: boolean; errors: { message: string }[] };
  assert.equal(response.ok, false);
  assert.match(
    response.errors[0]!.message,
    /No Interactive Grid - Automatic Row Processing \(DML\) process exists/,
  );
  assert.equal(server.db.scalar('select count(*) from emp'), 12);
});
