import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { parseApexLang, get, isRef } from '../../packages/core/src/preview/apexlang.ts';
import { parseThemeSql } from '../../packages/core/src/preview/theme-sql.ts';
import {
  bindNames,
  LocalDatabase,
  splitScript,
  translateOracleSql,
} from '../../packages/core/src/preview/database.ts';
import { applyDirectives, fill, templateOptions } from '../../packages/core/src/preview/theme.ts';
import { setupAssets } from '../../packages/core/src/preview/assets.ts';
import { checkApplication, PreviewServer } from '../../packages/core/src/preview/server.ts';

const join = (...lines: string[]) =>
  `wwv_flow_string.join(wwv_flow_t_varchar2(${lines.map((line) => `'${line.replaceAll("'", "''")}'`).join(',\n')}))`;

/** A tiny stand-in for core/themes/f8842.262.sql: same call shapes, a fraction of the templates. */
const THEME_SQL = `
prompt --application/shared_components/user_interface/themes
begin
wwv_flow_imp_shared.create_theme(
 p_id=>wwv_flow_imp.id(4075791579648660165)
,p_theme_id=>42
,p_static_id=>'universal-theme'
,p_default_page_template=>wwv_flow_imp.id(4075783602716660119)
,p_file_prefix=>nvl(wwv_flow_application_install.get_static_theme_file_prefix(42),'#APEX_FILES#themes/theme_42/26.2/')
,p_css_file_urls=>'#THEME_FILES#css/Core#MIN#.css?v=#APEX_VERSION#'
);
wwv_flow_imp_shared.create_theme_style(
 p_id=>wwv_flow_imp.id(1)
,p_theme_id=>42
,p_name=>'Vita'
,p_static_id=>'Vita'
,p_theme_roller_output_file_url=>'#THEME_FILES#css/Vita#MIN#.css?v=#APEX_VERSION#'
);
wwv_flow_imp_shared.create_template(
 p_id=>wwv_flow_imp.id(4075783602716660119)
,p_name=>'Standard'
,p_static_id=>'standard'
,p_header_template=>${join('<!DOCTYPE html>', '<html><head><title>#TITLE#</title>#APEX_CSS##THEME_CSS##THEME_STYLE_CSS#</head>', '<body class="t-PageBody #PAGE_CSS_CLASSES#">#FORM_OPEN#')}
,p_box=>${join('<main>#SUCCESS_MESSAGE##NOTIFICATION_MESSAGE#<div class="t-Body-title">#REGION_POSITION_01#</div>#BODY#</main>')}
,p_footer_template=>${join('#FORM_CLOSE##APEX_JAVASCRIPT##THEME_JAVASCRIPT##GENERATED_JAVASCRIPT#</body></html>')}
,p_success_message=>'<div class="t-Alert--success">#SUCCESS_MESSAGE#</div>'
,p_notification_message=>'<div class="t-Alert--warning">#MESSAGE#</div>'
,p_default_template_options=>'t-PageBody--contain'
,p_grid_max_columns=>12
,p_grid_template=>'<div class="container">#ROWS#</div>'
,p_grid_row_template=>'<div class="row">#COLUMNS#</div>'
,p_grid_column_template=>'<div class="col col-#COLUMN_SPAN_NUMBER#">#CONTENT#</div>'
);
wwv_flow_imp_shared.create_page_tmpl_display_point(
 p_id=>wwv_flow_imp.id(2)
,p_page_template_id=>wwv_flow_imp.id(4075783602716660119)
,p_placeholder=>'REGION_POSITION_01'
,p_apexlang_name=>'breadcrumbBar'
);
wwv_flow_imp_shared.create_plug_template(
 p_id=>wwv_flow_imp.id(4075786578761660165)
,p_page_plug_template_name=>'Standard'
,p_static_id=>'standard'
,p_template=>'<div class="t-Region #REGION_CSS_CLASSES#" id="#DOM_ID#"><h2>#TITLE#</h2>#BODY##SUB_REGIONS#<div class="t-Region-buttons">#CREATE#</div></div>'
,p_default_template_options=>'t-Region--scrollBody'
);
wwv_flow_imp_shared.create_plug_tmpl_display_point(
 p_id=>wwv_flow_imp.id(3)
,p_plug_template_id=>wwv_flow_imp.id(4075786578761660165)
,p_placeholder=>'CREATE'
,p_apexlang_name=>'create'
);
wwv_flow_imp_shared.create_field_template(
 p_id=>wwv_flow_imp.id(4)
,p_static_id=>'optional-floating'
,p_template_body1=>'<#LABEL_OPEN# id="#LABEL_ID#">'
,p_template_body2=>'<#LABEL_CLOSE#>'
,p_before_item=>'<div class="t-Form-fieldContainer" id="#CURRENT_ITEM_CONTAINER_ID#">'
,p_after_item=>'</div>'
,p_after_element=>'#ERROR_TEMPLATE#'
,p_error_template=>'<span class="t-Form-error">#ERROR_MESSAGE#</span>'
);
wwv_flow_imp_shared.create_button_templates(
 p_id=>wwv_flow_imp.id(5)
,p_static_id=>'text'
,p_template=>'<button class="t-Button #BUTTON_CSS_CLASSES#" type="button" #ONCLICK# id="#DOM_ID#"{if IS_DISABLED/} disabled{endif/}>#LABEL#</button>'
,p_hot_template=>'<button class="t-Button t-Button--hot #BUTTON_CSS_CLASSES#" type="button" #ONCLICK# id="#DOM_ID#">#LABEL#</button>'
);
wwv_flow_imp_shared.create_row_template(
 p_id=>wwv_flow_imp.id(2542081983073888486)
,p_row_template_name=>'Standard'
,p_static_id=>'standard'
,p_row_template1=>'<td class="t-Report-cell" #ALIGNMENT#>#COLUMN_VALUE#</td>'
,p_row_template_before_rows=>'<table class="t-Report-report" id="report_#DOM_ID#">'
,p_row_template_after_rows=>'</tbody></table>#PAGINATION#'
,p_row_template_before_first=>'<tr>'
,p_row_template_after_last=>'</tr>'
,p_row_template_type=>'GENERIC_COLUMNS'
,p_before_column_heading=>'<thead>'
,p_column_heading_template=>'<th id="#COLUMN_HEADER_NAME#">#COLUMN_HEADER#</th>'
,p_after_column_heading=>'</thead><tbody>'
);
end;
/
`;

const APP: Record<string, string> = {
  'application.apx': `app demo (
    name: Demo
    navigation {
        homeUrl: {
            page: 1
        }
    }
)
`,
  'pages/p00001-home.apx': `page 1 (
    name: Home
    alias: HOME
    title: Home

    region tasks (
        name: Tasks
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select task_id, title, nvl(status, 'OPEN') status
                  from tasks
                 order by task_id
                 fetch first 50 rows only
                \`\`\`
        }
        layout {
            sequence: 10
            slot: body
        }
    )

    pageItem P1_TITLE (
        type: textField
        label {
            label: Title
        }
        layout {
            sequence: 10
            region: @tasks
        }
        validation {
            valueRequired: true
        }
    )

    button add (
        buttonName: ADD
        label: Add Task
        layout {
            sequence: 10
            region: @tasks
            slot: create
        }
        appearance {
            hot: true
        }
    )

    process add-task (
        name: Add Task
        type: executeCode
        source {
            plsqlCode:
                \`\`\`plsql
                insert into tasks (title) values (:P1_TITLE);
                \`\`\`
        }
        execution {
            sequence: 10
        }
        serverSideCondition {
            whenButtonPressed: @add
        }
        successMessage {
            successMessage: Task added.
        }
    )
)
`,
  'pages/p00002-unsupported.apx': `page 2 (
    name: Calendar
    region calendar (
        name: Calendar
        type: calendar
        layout {
            sequence: 10
        }
    )
)
`,
  '.apex-local/01-schema.sql': `create table tasks (
  task_id integer primary key,
  title varchar2(200) not null,
  status varchar2(20)
);
insert into tasks (title, status) values ('Design review', 'DONE');
insert into tasks (title) values ('Ship it');
`,
};

async function workspace(t: import('node:test').TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-preview-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const app = path.join(root, 'app');
  for (const [file, content] of Object.entries(APP)) {
    await mkdir(path.dirname(path.join(app, file)), { recursive: true });
    await writeFile(path.join(app, file), content);
  }
  const zip = path.join(root, 'apex_26.2_en.zip');
  await writeFile(
    zip,
    zipSync({
      'apex/core/themes/f8842.262.sql': strToU8(THEME_SQL),
      'apex/images/libraries/apex/minified/desktop_all.min.js': strToU8('window.apex=window.apex||{};'),
      'apex/images/themes/theme_42/26.2/css/Core.min.css': strToU8('.t-Region{}'),
      'apex/images/libraries/monaco-editor/skip.js': strToU8('not extracted'),
    }),
  );
  const assets = path.join(root, 'assets');
  await setupAssets({ assetsDir: assets, zipPath: zip });
  return { root, app, assets };
}

test('APEXlang parser reads groups, references, fenced code, arrays and inline objects', () => {
  const [page] = parseApexLang(
    `page 21 (
    name: Department
    appearance {
        dialogTemplate: @/drawer
        templateOptions: [
            #DEFAULT#
            js-dialog-class-t-Drawer--pullOutEnd
        ]
    }
    // a comment
    region department (
        source {
            sqlQuery:
                \`\`\`sql
                select 1
                  from dual
                \`\`\`
        }
        link {
            target: {
                page: 21
                items: {
                    P21_ID: \\#ID#\\
                }
            }
        }
    )
    entry "quoted id" (
        "CUSTOMER_ID_L$1": "CUSTOMER_ID_L$1" asc
        flags: [a b]
    )
)`,
    'p00021.apx',
  );
  assert.equal(page!.type, 'page');
  assert.equal(page!.id, '21');
  const template = get(page!.props, 'appearance.dialogTemplate');
  assert.ok(isRef(template) && template.global && template.ref === 'drawer');
  assert.deepEqual(get(page!.props, 'appearance.templateOptions'), [
    '#DEFAULT#',
    'js-dialog-class-t-Drawer--pullOutEnd',
  ]);
  const region = page!.children[0]!;
  assert.equal(get(region.props, 'source.sqlQuery'), 'select 1\n  from dual');
  assert.equal(get(region.props, 'link.target.items.P21_ID'), '#ID#');
  const entry = page!.children[1]!;
  assert.equal(entry.id, 'quoted id');
  assert.equal(entry.props['CUSTOMER_ID_L$1'], '"CUSTOMER_ID_L$1" asc');
  assert.deepEqual(entry.props.flags, ['a', 'b']);
  assert.throws(() => parseApexLang('page 1 (\n  name: x\n'), /missing closing/);
});

test('theme SQL evaluator keeps literal parameters and exact component IDs', () => {
  const calls = parseThemeSql(THEME_SQL);
  const theme = calls.find((call) => call.kind === 'theme')!;
  assert.equal(theme.params.id, '4075791579648660165');
  assert.equal(theme.params.file_prefix, '#APEX_FILES#themes/theme_42/26.2/');
  const page = calls.find((call) => call.kind === 'template')!;
  assert.match(String(page.params.header_template), /^<!DOCTYPE html>\n<html>/);
  assert.equal(calls.filter((call) => call.kind === 'plug_tmpl_display_point').length, 1);
});

test('template engine fills placeholders, directives and template options', () => {
  assert.equal(
    fill('<b {if HOT/}class="hot"{else/}class="cold"{endif/}>#LABEL!HTML#</b>#GONE#', {
      HOT: 'Y',
      LABEL: '<x>',
    }),
    '<b class="hot">&lt;x&gt;</b>',
  );
  assert.equal(applyDirectives('{if A/}a{elsif B/}b{endif/}', { B: '1' }), 'b');
  assert.equal(
    templateOptions(['#DEFAULT#', 't-Region--noUI'], 't-Region--scrollBody'),
    't-Region--scrollBody t-Region--noUI',
  );
});

test('Oracle SQL shims run against SQLite', () => {
  assert.equal(translateOracleSql('select sysdate from dual'), "select datetime('now','localtime') ");
  assert.match(translateOracleSql('select * from t fetch first 5 rows only'), /limit 5$/);
  assert.deepEqual(bindNames('select :P1_ID, \':NOT_A_BIND\', "x:y" from t where a = :APP_USER'), [
    'P1_ID',
    'APP_USER',
  ]);
  assert.deepEqual(
    splitScript('create table a (x number);\nbegin\n  null;\nend;\n/\ninsert into a values (1);'),
    ['create table a (x number)', 'insert into a values (1)'],
  );
  const db = new LocalDatabase(':memory:');
  try {
    db.execute('create table emp (id number generated by default on null as identity, sal number)');
    db.execute('insert into emp (sal) values (:SAL)', { sal: '1200.5' });
    assert.equal(db.scalar("select decode(1, 1, 'one', 'other') || nvl(null, '!')"), 'one!');
    assert.equal(db.scalar("select to_char(sal, 'FML999G999D00') from emp"), '$1,200.50');
    assert.equal(db.scalar('select v(:NAME)', { NAME: 'P1_X', P1_X: 'value' }), 'value');
  } finally {
    db.close();
  }
});

test('preview setup extracts only the runtime subset and check reports unsupported regions', async (t) => {
  const { app, assets } = await workspace(t);
  const result = checkApplication({ sourceDir: app, assetsDir: assets });
  assert.deepEqual(
    result.pages.map((page) => [page.id, page.error]),
    [
      ['1', undefined],
      ['2', undefined],
    ],
  );
  assert.ok(result.diagnostics.some((entry) => /Region type calendar/.test(entry.message)));
  assert.equal(result.diagnostics.filter((entry) => entry.level === 'error').length, 0);
});

test('preview server renders Universal Theme markup and runs the APEX submit protocol', async (t) => {
  const { app, assets } = await workspace(t);
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const home = `${server.url}/r/demo/home`;

  const first = await fetch(home);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  const html = await first.text();
  assert.match(html, /<title>Home<\/title>/);
  assert.match(html, /\/i\/themes\/theme_42\/26\.2\/css\/Core\.min\.css/);
  assert.match(html, /class="t-Region t-Region--scrollBody" id="tasks"/);
  assert.match(html, /<td class="t-Report-cell" [^>]*>Design review<\/td>/);
  assert.match(html, /<td class="t-Report-cell" [^>]*>OPEN<\/td>/);
  assert.match(
    html,
    /<button class="t-Button t-Button--hot " type="button" onclick="apex\.submit\(\{request:&#x27;ADD&#x27;/,
  );
  assert.match(html, /id="P1_TITLE_error_placeholder"/);

  const asset = await fetch(`${server.url}/i/libraries/apex/minified/desktop_all.min.js`);
  assert.equal(asset.status, 200);
  assert.equal((await fetch(`${server.url}/i/libraries/monaco-editor/skip.js`)).status, 404);
  assert.equal((await fetch(`${server.url}/i/..%2F..%2Fmanifest.json`)).status, 404);

  const submit = (title: string) =>
    fetch(`${server.url}/r/demo/wwv_flow.accept`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        p_flow_step_id: '1',
        p_request: 'ADD',
        p_json: JSON.stringify({ pageItems: { itemsToSubmit: [{ n: 'P1_TITLE', v: title }] } }),
      }),
    }).then(
      (response) => response.json() as Promise<{ errors?: { pageItem: string }[]; redirectURL?: string }>,
    );

  const invalid = await submit('');
  assert.equal(invalid.errors?.[0]?.pageItem, 'P1_TITLE');
  const valid = await submit('Write docs');
  assert.equal(valid.redirectURL, '/r/demo/home');
  assert.equal(server.db.scalar("select count(*) from tasks where title = 'Write docs'"), 1);
  const after = await (await fetch(home, { headers: { cookie } })).text();
  assert.match(after, /Task added\./);
  assert.match(after, />Write docs</);

  const fragment = await (
    await fetch(`${server.url}/r/demo/__apex/region?page=1&region=tasks`, { headers: { cookie } })
  ).text();
  assert.match(fragment, /^<div class="t-Region/);
});
