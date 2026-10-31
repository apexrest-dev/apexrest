import test from 'node:test';
import assert from 'node:assert/strict';
import { checkApplication, PreviewServer } from '../../packages/core/src/preview/server.ts';
import { translateHierarchy } from '../../packages/core/src/preview/extensions/structure/hierarchy.ts';
import { LocalDatabase } from '../../packages/core/src/preview/database.ts';
import { workspace } from '../fixtures/preview.ts';

const DATA = `create table emp (
  empno number primary key,
  ename varchar2(20),
  mgr number,
  job varchar2(20)
);
insert into emp values (1, 'KING', null, 'PRESIDENT');
insert into emp values (2, 'JONES', 1, 'MANAGER');
insert into emp values (3, 'BLAKE', 1, 'MANAGER');
insert into emp values (4, 'SCOTT', 2, 'ANALYST');
insert into emp values (5, 'ADAMS', 4, 'CLERK');
insert into emp values (6, 'ALLEN', 3, 'SALESMAN');
`;

const TREE_PAGE = `page 10 (
    name: Org Tree
    alias: ORG

    region org (
        name: Organization
        type: tree
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select case when connect_by_isleaf = 1 then 0 when level = 1 then 1 else -1 end as status,
                       level, ename as title, 'fa-user' as icon, empno as value, job as tooltip,
                       'f?p=&APP_ID.:10:&SESSION.::NO::P10_SELECTED:' || empno as link
                  from emp
                 start with mgr is null
               connect by prior empno = mgr
                 order siblings by ename
                \`\`\`
        }
        layout {
            sequence: 10
        }
        settings {
            nodeLabelColumn: TITLE
            nodeValueColumn: VALUE
            hierarchy: notComputed
            nodeStatusColumn: STATUS
            hierarchyLevelColumn: LEVEL
            iconCssClassColumn: ICON
            iconTypeCssClass: fa
            linkColumn: LINK
            tooltip: databaseCol
            tooltipColumn: TOOLTIP
            selectedNodePageItem: P10_SELECTED
        }
    )

    region computed (
        name: Computed
        type: tree
        source {
            location: localDatabase
            tableName: EMP
        }
        layout {
            sequence: 20
        }
        settings {
            nodeLabelColumn: ENAME
            nodeValueColumn: EMPNO
            nodeIdColumn: EMPNO
            parentKeyColumn: MGR
            hierarchy: computedWithSql
            startTreeWith: valueIsNull
            orderSiblingsBy: ENAME
            tooltip: htmlExpression
            tooltipValue: <b>#ENAME#</b> (#JOB#)
        }
    )

    pageItem P10_SELECTED (
        type: hidden
        layout {
            sequence: 10
            region: @org
        }
    )

    button expand (
        buttonName: EXPAND
        label: Expand
        layout {
            sequence: 10
            region: @org
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    dynamicAction expand-all (
        name: Expand all
        when {
            event: click
            selectionType: button
            button: @expand
        }
        action expand-tree (
            action: expandTree
            affectedElements {
                selectionType: region
                region: @org
            }
        )
    )
)
`;

const SEARCH_CONFIGS = `searchConfig people (
    name: People
    type: simple
    source {
        location: localDatabase
        tableName: EMP
        searchableColumns: [
            ENAME
            JOB
        ]
    }
    columnMapping {
        primaryKey1Column: EMPNO
        titleColumn: ENAME
        descriptionColumn: JOB
        badgeColumn: EMPNO
    }
    iconAndBadge {
        iconSource: iconClass
        iconCssClasses: fa-user
    }
    link {
        type: redirectThisApp
        target: {
            page: 10
            items: {
                P10_SELECTED: \\#EMPNO#\\
            }
        }
    }
)

searchConfig notes (
    name: Notes
    type: simple
    source {
        location: localDatabase
        type: sqlQuery
        sqlQuery:
            \`\`\`sql
            select 1 id, 'Manager handbook' title, 'Guide for every manager.' description from dual
            \`\`\`
        searchableColumns: [
            TITLE
            DESCRIPTION
        ]
    }
    columnMapping {
        primaryKey1Column: ID
        titleColumn: TITLE
        descriptionColumn: DESCRIPTION
    }
    messages {
        whenNoDataFound: No notes match.
    }
)

searchConfig oracle-text (
    name: Text index
    type: text
    source {
        oracleTextIndexColumn: ENAME
    }
)
`;

const SEARCH_PAGE = `page 11 (
    name: Search
    alias: SEARCH

    region results (
        name: Results
        type: search
        layout {
            sequence: 10
        }
        settings {
            searchPageItem: P11_SEARCH
            searchAsYouType: true
        }
        searchSource people (
            name: People
            searchConfig: @people
            layout {
                sequence: 10
            }
        )
        searchSource notes (
            name: Notes
            searchConfig: @notes
            layout {
                sequence: 20
            }
        )
        searchSource text (
            name: Text
            searchConfig: @oracle-text
            layout {
                sequence: 30
            }
        )
    )

    pageItem P11_SEARCH (
        type: textField
        label {
            label: Search
        }
        layout {
            sequence: 10
            region: @results
        }
    )
)
`;

const FORM_PAGE = `page 12 (
    name: Employee Form
    alias: EMP-FORM

    region form (
        name: Employee
        type: staticContent
        layout {
            sequence: 10
        }
    )

    region employees (
        name: Employees
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select empno, ename from emp order by empno
        }
        reportLayout {
            numberOfRows: 2
        }
        pagination {
            type: externalPaginationButtons
        }
        layout {
            sequence: 20
        }
    )

    pageItem P12_EMPNO (
        type: hidden
        layout {
            sequence: 10
            region: @form
        }
        source {
            type: databaseColumn
            databaseColumn: EMPNO
        }
    )
    pageItem P12_ENAME (
        type: textField
        label {
            label: Name
        }
        layout {
            sequence: 20
            region: @form
        }
        source {
            type: databaseColumn
            databaseColumn: ENAME
        }
    )
    pageItem P12_BREAK (
        type: stopAndStartGridLayout
        layout {
            sequence: 30
            region: @form
        }
    )
    pageItem P12_JOB (
        type: textField
        label {
            label: Job
        }
        layout {
            sequence: 40
            region: @form
        }
        source {
            type: databaseColumn
            databaseColumn: JOB
        }
    )
    pageItem P12_HIRED (
        type: datePickerJquery
        label {
            label: Hired
        }
        settings {
            minDate: -10y
        }
        layout {
            sequence: 50
            region: @form
        }
    )
    pageItem P12_NEXT (
        type: hidden
        layout {
            sequence: 60
            region: @form
        }
    )
    pageItem P12_PREV (
        type: hidden
        layout {
            sequence: 70
            region: @form
        }
    )
    pageItem P12_COUNT (
        type: hidden
        layout {
            sequence: 80
            region: @form
        }
    )

    button save (
        buttonName: SAVE
        label: Apply Changes
        layout {
            sequence: 10
            region: @form
        }
    )
    button next-rows (
        buttonName: NEXT_ROWS
        label: Next
        layout {
            sequence: 20
            region: @form
        }
        behavior {
            action: nextPage
        }
    )
    button reset (
        buttonName: RESET
        label: Reset
        layout {
            sequence: 30
            region: @form
        }
        behavior {
            action: resetPage
        }
    )
    button other-app (
        buttonName: OTHER
        label: Other
        layout {
            sequence: 40
            region: @form
        }
        behavior {
            action: redirectOtherApp
            target: {
                application: 4550
                page: 1
            }
        }
    )
    button trigger (
        buttonName: TRIGGER
        label: Trigger
        layout {
            sequence: 50
            region: @form
        }
        behavior {
            action: triggerAction
        }
        triggerAction show-alert (
            action: alert
            settings {
                text: Hello from the trigger
            }
            execution {
                sequence: 10
            }
        )
    )

    process fetch (
        name: Fetch row
        type: autoRowFetch
        source {
            tableName: EMP
            pkColumn: EMPNO
            pkItem: P12_EMPNO
        }
        execution {
            sequence: 10
            point: afterHeader
        }
    )
    process paginate (
        name: Paginate
        type: formPagination
        target {
            tableName: EMP
            pkColumn: EMPNO
            pkItem: P12_EMPNO
            nextPkItem: P12_NEXT
            prevPkItem: P12_PREV
            currentRowCountItem: P12_COUNT
            navigationOrderColumn: EMPNO
        }
        execution {
            sequence: 20
            point: afterHeader
        }
    )
    process dml (
        name: Row processing
        type: autoRowProcessing
        target {
            tableName: EMP
            pkColumn: EMPNO
            pkItem: P12_EMPNO
            supportedOperations: I:U:D
        }
        execution {
            sequence: 10
        }
    )
    process reset-pagination (
        name: Reset pagination
        type: resetPagination
        resetPagination {
            target: thisPage
        }
        execution {
            sequence: 20
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )
)
`;

const LEGACY_PAGE = `page 13 (
    name: Legacy
    alias: LEGACY

    region reflow (
        name: Reflow
        type: reflowReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select empno, ename, job from emp order by empno
        }
        layout {
            sequence: 10
        }
    )

    region toggle (
        name: Toggle
        type: columnToggleReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select empno, ename, job from emp order by empno
        }
        settings {
            colButtonText: Pick columns
        }
        layout {
            sequence: 20
        }
        column JOB (
            settings {
                priority: 3
            }
            layout {
                sequence: 30
            }
        )
    )

    region grid (
        name: Tabular
        type: tabform
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select empno, ename, job from emp order by empno
        }
        layout {
            sequence: 30
        }
        column CHECK$01 (
            type: rowSelector
            layout {
                sequence: 1
            }
        )
        column EMPNO (
            type: hiddenSavesState
            layout {
                sequence: 2
            }
        )
        column ENAME (
            type: textField
            heading {
                heading: Name
            }
            layout {
                sequence: 3
            }
        )
        column JOB (
            type: selectList
            lov {
                type: staticValues
                staticValues: STATIC:Clerk;CLERK,Manager;MANAGER,Analyst;ANALYST
            }
            layout {
                sequence: 4
            }
        )
    )

    region cal (
        name: Calendar
        type: legacyCalendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select empno, ename, '2026-01-0' || empno hired from emp
        }
        settings {
            dateColumn: HIRED
            displayColumn: ENAME
        }
        layout {
            sequence: 40
        }
    )

    process update-rows (
        name: Update rows
        type: tabformUpdate
        formRegion: @grid
        target {
            tableName: EMP
            pkColumn: EMPNO
        }
        serverSideCondition {
            type: request=Value
            value: SUBMIT
        }
        execution {
            sequence: 10
        }
    )
    process delete-rows (
        name: Delete rows
        type: tabformDelete
        formRegion: @grid
        target {
            tableName: EMP
            pkColumn: EMPNO
        }
        serverSideCondition {
            type: request=Value
            value: DELETE
        }
        execution {
            sequence: 20
        }
    )
    process add-rows (
        name: Add rows
        type: tabformAddRows
        formRegion: @grid
        target {
            noOfRows: 2
        }
        serverSideCondition {
            type: request=Value
            value: ADD
        }
        execution {
            sequence: 30
        }
    )
)
`;

const WIZARD_THEME = `
begin
wwv_flow_imp_shared.create_list_template(
 p_id=>wwv_flow_imp.id(77)
,p_list_template_current=>'<li class="t-WizardSteps-step is-active" id="#LIST_ITEM_ID#"><span class="t-WizardSteps-label">#TEXT#</span></li>'
,p_list_template_noncurrent=>'<li class="t-WizardSteps-step" id="#LIST_ITEM_ID#"><span class="t-WizardSteps-label">#TEXT#</span></li>'
,p_list_template_name=>'Wizard Progress'
,p_static_id=>'wizard-progress'
,p_javascript_code_onload=>'apex.theme.initWizardProgressBar();'
,p_list_template_before_rows=>'<ul aria-label="#CURRENT_PROGRESS#" class="t-WizardSteps #COMPONENT_CSS_CLASSES#" id="#LIST_ID#">'
,p_list_template_after_rows=>'</ul>'
);
end;
/
`;

const WIZARD_LIST = `list wizard (
    name: Wizard
    entry step-1 (
        label: Account
        link {
            target: {
                page: 14
            }
        }
        layout {
            sequence: 10
        }
    )
    entry step-2 (
        label: Confirm
        link {
            target: {
                page: 15
            }
        }
        layout {
            sequence: 20
        }
    )
)
`;

const WIZARD_PAGE = (id: number) => `page ${id} (
    name: Step ${id}
    alias: STEP-${id}

    region progress (
        name: Progress
        type: list
        source {
            list: @wizard
        }
        componentAppearance {
            listTemplate: @/wizard-progress
        }
        layout {
            sequence: 10
        }
    )
)
`;

const FILES = {
  '.apex-local/02-emp.sql': DATA,
  'pages/p00010-org.apx': TREE_PAGE,
  'pages/p00011-search.apx': SEARCH_PAGE,
  'pages/p00012-form.apx': FORM_PAGE,
  'pages/p00013-legacy.apx': LEGACY_PAGE,
  'pages/p00014-step.apx': WIZARD_PAGE(14),
  'pages/p00015-step.apx': WIZARD_PAGE(15),
  'shared-components/search-configs.apx': SEARCH_CONFIGS,
  'shared-components/lists/wizard.apx': WIZARD_LIST,
};

async function start(t: import('node:test').TestContext) {
  const { app, assets } = await workspace(t, FILES, WIZARD_THEME);
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const first = await fetch(`${server.url}/r/demo/home`);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  const get = (path: string) =>
    fetch(`${server.url}/r/demo/${path}`, { headers: { cookie } }).then((r) => r.text());
  const post = (route: string, page: string, region: string, body: unknown) =>
    fetch(`${server.url}/r/demo/__apex/x/${route}?page=${page}&region=${region}`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, json: (await r.json()) as Record<string, unknown> }));
  const submit = (page: string, request: string, items: Record<string, string>) =>
    fetch(`${server.url}/r/demo/wwv_flow.accept`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        p_flow_step_id: page,
        p_request: request,
        p_json: JSON.stringify({
          pageItems: { itemsToSubmit: Object.entries(items).map(([n, v]) => ({ n, v })) },
        }),
      }),
    }).then((r) => r.json() as Promise<{ errors?: { message: string }[]; redirectURL?: string }>);
  return { server, get, post, submit };
}

const treeConfig = (html: string, id: string) => {
  const match = new RegExp(`id="${id}_tree"[^>]*data-apex-local-tree="([^"]+)"`, 'u').exec(html);
  assert.ok(match, `tree ${id} rendered`);
  return JSON.parse(
    match[1]!.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&#x27;', "'"),
  ) as {
    data: { id: string; label: string; icon?: string; link?: string; tooltip?: string; children?: unknown[] };
    showRoot: boolean;
    expanded: string[];
    selected: string | null;
  };
};

test('connect by queries become recursive CTEs with level, leaf, path and root', () => {
  const db = new LocalDatabase(':memory:');
  db.runScript(DATA, 'emp');
  const sql = translateHierarchy(
    `select level lvl, connect_by_isleaf leaf, ename, sys_connect_by_path(ename, '/') path, connect_by_root ename root
       from emp e where e.job <> 'ANALYST' start with e.mgr is null connect by prior e.empno = e.mgr order siblings by e.ename`,
  );
  assert.equal(sql.unsupported, undefined);
  const rows = db.query(sql.sql).rows;
  assert.deepEqual(
    rows.map((row) => `${row.LVL}:${row.ENAME}:${row.LEAF}:${row.PATH}:${row.ROOT}`),
    [
      '1:KING:0:/KING:KING',
      '2:BLAKE:0:/KING/BLAKE:KING',
      '3:ALLEN:1:/KING/BLAKE/ALLEN:KING',
      '2:JONES:0:/KING/JONES:KING',
      '4:ADAMS:1:/KING/JONES/SCOTT/ADAMS:KING',
    ],
  );
  // Nested, reversed prior and nocycle; row generators are left to the database shims.
  const nested = translateHierarchy(
    `select * from (select level, ename from emp start with empno = 2 connect by nocycle mgr = prior empno) where level > 1`,
  );
  assert.deepEqual(
    db.query(nested.sql).rows.map((row) => row.ENAME),
    ['SCOTT', 'ADAMS'],
  );
  assert.equal(
    translateHierarchy('select level from dual connect by level <= 3').sql,
    'select level from dual connect by level <= 3',
  );
  assert.match(
    translateHierarchy('select a.x from a, b start with a.p is null connect by prior a.id = a.p')
      .unsupported ?? '',
    /joins/u,
  );
  db.close();
});

test('tree regions feed the treeView widget with hierarchy, icons, links, tooltips and selection', async (t) => {
  const { get, post, server } = await start(t);
  const html = await get('org?p10_selected=4');
  const org = treeConfig(html, 'org');
  assert.equal(org.showRoot, true);
  assert.equal(org.data.label, 'KING');
  assert.equal(org.data.icon, 'fa-user');
  assert.equal(org.data.tooltip, 'PRESIDENT');
  assert.match(org.data.link ?? '', /f\?p=100:10:/u);
  assert.deepEqual(org.expanded, ['1']);
  assert.equal(org.selected, '4');
  assert.deepEqual(
    (org.data.children as { label: string }[]).map((child) => child.label),
    ['BLAKE', 'JONES'],
  );
  // Server-rendered fallback markup until the widget initializes.
  assert.match(
    html,
    /<li class="a-TreeView-node a-TreeView-node--topLevel is-expandable" data-id="1" title="PRESIDENT">/u,
  );
  const computed = treeConfig(html, 'computed');
  assert.equal(computed.data.label, 'KING');
  assert.equal(computed.data.tooltip, 'KING (PRESIDENT)');
  const jones = (computed.data.children as { label: string; children?: { label: string }[] }[])[1]!;
  assert.equal(jones.label, 'JONES');
  assert.equal(jones.children?.[0]?.label, 'SCOTT');
  // The expandTree dynamic action and the Ajax refresh route.
  assert.match(html, /"action":"expandTree"/u);
  const refreshed = await post('tree', '10', 'org', { items: {} });
  assert.equal((refreshed.json.data as { label: string }).label, 'KING');
  const runtime = await (await fetch(`${server.url}/__apex/runtime.js`)).text();
  assert.match(runtime, /registerAction\("expandTree"/u);
  assert.match(runtime, /apexlocal:\(tree\|search\)/u);
  const diagnostics = (await (await fetch(`${server.url}/__apex/diagnostics`)).json()) as {
    message: string;
  }[];
  assert.ok(
    diagnostics.some((entry) => /CONNECT BY query runs as a SQLite recursive CTE/u.test(entry.message)),
  );
});

test('search regions query local search configurations through the search widget', async (t) => {
  const { get, post, server } = await start(t);
  const empty = await get('search');
  assert.match(empty, /class="a-SearchResults apex-local-search"/u);
  const html = await get('search?p11_search=manager');
  assert.match(html, /<mark class="a-SearchResults-highlight">MANAGER<\/mark>/u);
  assert.match(html, /a-ResultsItem-title"><a href="\/r\/demo\/org\?p10_selected=2">JONES<\/a>/u);
  assert.match(html, /<span class="a-Icon fa fa-user"/u);
  const result = await post('search', '11', 'results', {
    items: { P11_SEARCH: 'hand' },
    x02: JSON.stringify({ action: 'SEARCH', query: 'hand', firstRow: 1, maxRows: 15 }),
  });
  const configs = result.json.configs as {
    results: { row: string }[];
    resultsCount: number;
    noDataFound?: string;
  }[];
  assert.equal(configs.length, 3);
  assert.equal(configs[0]!.resultsCount, 0);
  assert.equal(configs[1]!.resultsCount, 1);
  assert.match(
    configs[1]!.results[0]!.row,
    /Manager <mark class="a-SearchResults-highlight">hand<\/mark>book/u,
  );
  const both = await post('search', '11', 'results', { x02: JSON.stringify({ query: 'manager jones' }) });
  assert.equal((both.json.configs as { resultsCount: number }[])[0]!.resultsCount, 1);
  const none = await post('search', '11', 'results', { x02: JSON.stringify({ query: 'zzz' }) });
  assert.equal((none.json.configs as { noDataFound?: string }[])[1]!.noDataFound, 'No notes match.');
  const diagnostics = (await (await fetch(`${server.url}/__apex/diagnostics`)).json()) as {
    message: string;
  }[];
  assert.ok(
    diagnostics.some((entry) => /search configuration type text is not simulated/u.test(entry.message)),
  );
});

test('legacy form processes fetch, paginate and save rows; wizard buttons behave', async (t) => {
  const { get, submit } = await start(t);
  const html = await get('emp-form?p12_empno=2');
  assert.match(html, /id="P12_ENAME"[^>]*value="JONES"/u);
  assert.match(html, /id="P12_NEXT" value="3"/u);
  assert.match(html, /id="P12_PREV" value="1"/u);
  assert.match(html, /id="P12_COUNT" value="2 of 6"/u);
  // Stop and start grid layout splits the item grid into two containers.
  const form = html.slice(html.indexOf('P12_ENAME'), html.indexOf('P12_JOB'));
  assert.match(form, /<\/div>\s*<div class="container">/u);
  assert.match(html, /a-date-picker|apex-item-datepicker/u);
  // Buttons
  assert.match(html, /apex\.submit\(\{request:&#x27;NEXT_ROWS&#x27;/u);
  assert.match(html, /wwvFlowForm&#x27;\)\.reset\(\)/u);
  assert.match(html, /Application 4550 is not available/u);
  assert.match(html, /"id":"trigger-trigger","event":"click","selector":"#B_trigger"/u);
  assert.match(html, /"action":"alert".*?"settings":\{"text":"Hello from the trigger"\}/u);
  // Automatic Row Processing updates the row.
  const saved = await submit('12', 'SAVE', { P12_EMPNO: '2', P12_ENAME: 'JONES II', P12_JOB: 'LEAD' });
  assert.equal(saved.errors, undefined);
  assert.match(await get('emp-form?p12_empno=2'), /id="P12_ENAME"[^>]*value="JONES II"/u);
  // Next Page buttons move reports with external pagination buttons.
  const first = await get('emp-form');
  assert.match(first, />KING</u);
  await submit('12', 'NEXT_ROWS', {});
  const second = await get('emp-form');
  assert.doesNotMatch(second, />KING</u);
  assert.match(second, />BLAKE</u);
  // Reset Pagination (on SAVE) returns to the first page.
  await submit('12', 'SAVE', { P12_EMPNO: '', P12_ENAME: '' });
  assert.match(await get('emp-form'), />KING</u);
});

test('legacy regions: reflow, column toggle, tabular form round trip, calendar and wizard progress', async (t) => {
  const { get, submit, server } = await start(t);
  const html = await get('legacy');
  assert.match(html, /apex-local-reflow[^"]*"[^]*data-label="Ename"/u);
  assert.match(html, /Pick columns/u);
  assert.match(html, /<td [^>]*data-col="JOB" data-priority="3"/u);
  assert.match(html, /class="apex-local-calendar"/u);
  assert.match(html, /id="APEXLOCAL_TABFORM_GRID"/u);
  assert.match(html, /<tr data-tabform-row data-tabform-key="2">/u);
  assert.match(html, /<option value="MANAGER" selected>Manager<\/option>/u);
  const rows = [
    { key: '2', selected: false, changed: true, values: { EMPNO: '2', ENAME: 'JONES', JOB: 'CLERK' } },
    { key: '3', selected: false, changed: false, values: { EMPNO: '3', ENAME: 'BLAKE', JOB: 'MANAGER' } },
    { key: '', selected: false, changed: true, values: { EMPNO: '', ENAME: 'NEWBIE', JOB: 'CLERK' } },
  ];
  const updated = await submit('13', 'SUBMIT', { APEXLOCAL_TABFORM_GRID: JSON.stringify(rows) });
  assert.equal(updated.errors, undefined);
  const after = await get('legacy');
  assert.match(after, /1 row\(s\) updated, 1 row\(s\) inserted\./u);
  assert.match(after, /data-tabform-key="2">[^]*?<option value="CLERK" selected>/u);
  assert.match(after, /data-tabform-key="7"/u);
  await submit('13', 'DELETE', {
    APEXLOCAL_TABFORM_GRID: JSON.stringify([{ key: '7', selected: true, changed: false, values: {} }]),
  });
  assert.doesNotMatch(await get('legacy'), /data-tabform-key="7"/u);
  await submit('13', 'ADD', {});
  const added = await get('legacy');
  assert.equal(added.match(/data-tabform-key=""/gu)?.length, 2);
  const events = (await (
    await fetch(`${server.url}/r/demo/__apex/x/calendar?page=13&region=cal`)
  ).json()) as { title: string }[];
  assert.ok(events.some((event) => event.title === 'KING'));
  const step = await get('step-15');
  assert.match(
    step,
    /<li class="t-WizardSteps-step" id="[^"]*step-1"><span class="t-WizardSteps-label">Account/u,
  );
  assert.match(step, /<li class="t-WizardSteps-step is-active" id="[^"]*step-2"/u);
  assert.match(step, /apex\.theme\.initWizardProgressBar\(\)/u);
});

test('every structure page renders without errors', async (t) => {
  const { app, assets } = await workspace(t, FILES, WIZARD_THEME);
  const result = checkApplication({ sourceDir: app, assetsDir: assets });
  assert.deepEqual(
    result.pages.filter((page) => page.error),
    [],
  );
  const errors = result.diagnostics.filter((entry) => entry.level === 'error');
  assert.deepEqual(errors, []);
  assert.ok(
    result.diagnostics.some((entry) =>
      /Reflow report reflow is rendered as a responsive classic report/u.test(entry.message),
    ),
  );
  assert.ok(result.diagnostics.some((entry) => /jQuery date picker/u.test(entry.message)));
});
