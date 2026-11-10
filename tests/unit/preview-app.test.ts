import test from 'node:test';
import assert from 'node:assert/strict';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const PAGE = `page 3 (
    name: Toggles
    alias: TOGGLES

    region panel (
        name: Panel
        type: staticContent
        source {
            htmlCode: <p id="panel-body">Panel</p>
        }
        layout {
            sequence: 10
        }
        serverSideCondition {
            type: currentPageInList
            pages: [3 4]
        }
    )

    region hidden-elsewhere (
        name: Never Here
        type: staticContent
        layout {
            sequence: 20
        }
        serverSideCondition {
            type: currentPage!=page
            page: 3
        }
    )

    pageItem P3_STATUS (
        type: textField
        layout {
            sequence: 10
            region: @panel
        }
    )

    dynamicAction status-changed (
        name: Status changed
        when {
            event: custom
            customEvent: statusupdate
            selectionType: items
            items: P3_STATUS
        }
        execution {
            sequence: 10
            eventScope: dynamic
            type: debounce
            time: 250
        }
        clientSideCondition {
            type: itemIsInList
            item: P3_STATUS
            list: [OPEN CLOSED]
        }

        action highlight (
            action: setStyle
            affectedElements {
                selectionType: jsExpression
                javaScriptExpression: document.getElementById('panel-body')
            }
            settings {
                styleName: color
                value: red
            }
            execution {
                sequence: 10
            }
        )
    )
)
`;

test('preview resolves legacy f?p links, theme styles, extra conditions and dynamic action options', async (t) => {
  const { app, assets } = await workspace(
    t,
    { 'pages/p00003-toggles.apx': PAGE },
    `
begin
wwv_flow_imp_shared.create_theme_style(
 p_id=>wwv_flow_imp.id(77)
,p_theme_id=>42
,p_name=>'Vita - Dark'
,p_static_id=>'vita-dark'
,p_theme_roller_output_file_url=>'#THEME_FILES#css/Vita-Dark#MIN#.css?v=#APEX_VERSION#'
);
end;
/
`,
  );
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());

  const legacy = await fetch(`${server.url}/r/demo/f?p=100:TOGGLES:0:GO::RP:P3_STATUS:OPEN`, {
    redirect: 'manual',
  });
  assert.equal(legacy.status, 302);
  assert.equal(legacy.headers.get('location'), '/r/demo/toggles?p3_status=OPEN&clear=RP&request=GO');

  const first = await fetch(`${server.url}/r/demo/toggles?apex_theme_style=vita-dark`);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  const html = await first.text();
  assert.match(html, /css\/Vita-Dark\.min\.css/);
  const toolbar = server.renderer.toolbar(
    server.renderer.prepare(
      { id: '1', user: 'DEVELOPER', items: {}, pagination: {}, themeStyle: 'vita-dark' },
      '3',
    ),
  );
  assert.match(toolbar, /<option value="vita-dark" selected>Vita - Dark<\/option>/);
  assert.match(html, /id="panel-body"/);
  assert.doesNotMatch(html, /Never Here/);

  const config = JSON.parse(/apexLocal\.init\((.*?)\);\n/u.exec(html)![1]!) as {
    dynamicActions: {
      event: string;
      scope: string;
      timing: string;
      time: number;
      condition: { list: string[] };
      actions: { action: string; selector: string }[];
    }[];
  };
  const da = config.dynamicActions[0]!;
  assert.equal(da.event, 'statusupdate');
  assert.equal(da.scope, 'dynamic');
  assert.equal(da.timing, 'debounce');
  assert.equal(da.time, 250);
  assert.deepEqual(da.condition.list, ['OPEN', 'CLOSED']);
  assert.equal(da.actions[0]!.action, 'setStyle');
  assert.match(da.actions[0]!.selector, /^js:document\.getElementById/);

  const reset = await (
    await fetch(`${server.url}/r/demo/toggles?apex_theme_style=`, { headers: { cookie } })
  ).text();
  assert.match(reset, /css\/Vita\.min\.css/);

  const runtime = await (await fetch(`${server.url}/__apex/runtime.js`)).text();
  for (const action of ['showErrorMessage', 'openRegion', 'cancelEvent', 'setStyle', 'getCurrentPosition'])
    assert.match(runtime, new RegExp(`case "${action}"`));
});

test('date arithmetic on sysdate uses real fractions of a day', async () => {
  const { LocalDatabase } = await import('../../packages/core/src/preview/database.ts');
  const db = new LocalDatabase(':memory:');
  try {
    const hours = Number(db.scalar('select (julianday(sysdate) - julianday(sysdate - 6/24)) * 24 from dual'));
    assert.ok(Math.abs(hours - 6) < 0.001, `hours ${hours}`);
    const days = Number(
      db.scalar('select julianday(sysdate + :D) - julianday(sysdate) from dual', { D: '2' }),
    );
    assert.ok(Math.abs(days - 2) < 0.001, `days ${days}`);
  } finally {
    db.close();
  }
});

test('preview applies the theme own styles and serves Theme Roller output from the theme files', async (t) => {
  const { app, assets } = await workspace(t, {
    'shared-components/themes/universal-theme/theme.apx': `theme universal-theme (
    name: Universal Theme
    themeNumber: 42
    style {
        currentThemeStyle: @brand
    }

    style vita (
        name: Vita
        subscription {
            master: @/Vita
        }
    )

    style brand (
        name: Brand
        css {
            fileUrls: #APEX_FILES#libraries/oracle-fonts/oraclesans-apex#MIN#.css?v=#APEX_VERSION#
        }
        themeRollerAttributes {
            readOnly: false
            outputCssFileUrl: #THEME_DB_IMAGES#brand.css
        }
        advanced {
            endUserCanPick: true
        }
    )
)
`,
    'shared-components/themes/universal-theme/static-files/brand.css': '.t-Body{color:#123}',
  });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());

  const html = await (await fetch(`${server.url}/r/demo/home`)).text();
  assert.match(html, /href="\/r\/demo\/files\/theme\/v1\/brand\.css"/);
  assert.match(html, /oraclesans-apex\.min\.css/);
  assert.doesNotMatch(html, /css\/Vita\.min\.css/);
  assert.doesNotMatch(html, /#THEME_DB_IMAGES#/);

  const css = await fetch(`${server.url}/r/demo/files/theme/v1/brand.css`);
  assert.equal(css.status, 200);
  assert.equal(await css.text(), '.t-Body{color:#123}');
  assert.equal((await fetch(`${server.url}/r/demo/files/theme/v1/..%2Ftheme.apx`)).status, 404);

  const vita = await (await fetch(`${server.url}/r/demo/home?apex_theme_style=vita`)).text();
  assert.match(vita, /css\/Vita\.min\.css/);
  assert.doesNotMatch(vita, /brand\.css/);

  const toolbar = server.renderer.toolbar(
    server.renderer.prepare(
      { id: '1', user: 'DEVELOPER', items: {}, pagination: {}, themeStyle: 'brand' },
      '1',
    ),
  );
  assert.match(toolbar, /<option value="brand" selected>Brand<\/option>/);
  assert.match(toolbar, /<option value="vita">Vita<\/option>/);
});

const MENU_THEME = `
begin
wwv_flow_imp_shared.create_list_template(
 p_id=>wwv_flow_imp.id(78)
,p_list_template_current=>'<li class="is-current" data-level="#LEVEL#"><a href="#LINK#"><span class="#ICON_CSS_CLASSES#"></span>#TEXT#</a><i>#A01#</i></li>'
,p_list_template_noncurrent=>'<li data-level="#LEVEL#"><a href="#LINK#"><span class="#ICON_CSS_CLASSES#"></span>#TEXT#</a><i>#A01#</i></li>'
,p_sub_list_item_current=>'<li class="is-current" data-level="#LEVEL#"><a href="#LINK#">#TEXT#</a></li>'
,p_sub_list_item_noncurrent=>'<li data-level="#LEVEL#"><a href="#LINK#">#TEXT#</a></li>'
,p_before_sub_list=>'<ul class="sub">'
,p_after_sub_list=>'</ul>'
,p_list_template_name=>'Menu'
,p_static_id=>'menu'
,p_list_template_before_rows=>'<ul class="menu" id="#LIST_ID#">'
,p_list_template_after_rows=>'</ul>'
);
end;
/
`;

test('preview renders dynamic lists from their SQL query and maps Oracle page URLs', async (t) => {
  const { app, assets } = await workspace(
    t,
    {
      '.apex-local/02-sections.sql': `create table sections (
  seq integer primary key,
  lvl integer,
  name varchar2(100),
  url varchar2(400),
  current_flag varchar2(3),
  icon varchar2(50),
  note varchar2(50)
);
insert into sections values (10, 1, 'Home & more', '/ords/r/ws/demo/home?session=123&cs=XYZ&p1_x=5', null, 'fa-home', 'first');
insert into sections values (20, 1, 'Sales', 'f?p=100:2:123::NO::P2_SECTION:Sales', 'NO', 'fa-cart', null);
insert into sections values (30, 2, 'Orders', '/r/ws/demo/menu?session=9', 'NO', null, null);
insert into sections values (40, 1, 'Docs', 'https://example.com/docs', 'YES', null, null);
`,
      'shared-components/lists/sections.apx': `list sections (
    name: Sections
    source {
        type: sqlQuery
        sqlQuery:
            \`\`\`sql
            select lvl, name label, url target, current_flag, icon, null image_attribute, null image_alt, note
              from sections
             order by seq
            \`\`\`
    }
)
`,
      'pages/p00003-menu.apx': `page 3 (
    name: Menu
    alias: MENU

    region nav (
        name: Nav
        type: list
        source {
            list: @sections
        }
        componentAppearance {
            listTemplate: @/menu
        }
        layout {
            sequence: 10
        }
    )
)
`,
    },
    MENU_THEME,
  );
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());

  const html = await (await fetch(`${server.url}/r/demo/menu`)).text();
  const menu = /<ul class="menu"[\s\S]*?<\/ul><\/li>[\s\S]*?<\/ul>/u.exec(html)?.[0] ?? html;
  assert.match(
    menu,
    /<li data-level="1"><a href="\/r\/demo\/home\?p1_x=5"><span class="fa fa-home"><\/span>Home &amp; more<\/a><i>first<\/i><\/li>/u,
  );
  assert.match(menu, /<a href="\/r\/demo\/f\?p=100:2:123::NO::P2_SECTION:Sales">/u);
  assert.match(menu, /<ul class="sub"><li data-level="2"><a href="\/r\/demo\/menu">Orders<\/a><\/li><\/ul>/u);
  assert.match(menu, /<li class="is-current" data-level="1"><a href="https:\/\/example\.com\/docs">/u);
  assert.equal((menu.match(/is-current/gu) ?? []).length, 1);

  const renderer = server.renderer;
  assert.equal(renderer.localUrl('/ords/r/trade/demo/menu?session=1&cs=2'), '/r/demo/menu');
  assert.equal(
    renderer.localUrl('/ords/r/trade/demo/no-such-page?session=1'),
    '/ords/r/trade/demo/no-such-page?session=1',
  );
  assert.equal(renderer.localUrl(''), '#');
});

test('preview reports a dynamic list whose query fails and renders it empty', async (t) => {
  const { app, assets } = await workspace(
    t,
    {
      'shared-components/lists/broken.apx': `list broken (
    name: Broken
    source {
        type: sqlQuery
        sqlQuery: select 1, 'x', '#', 'NO' from no_such_table
    }
)
`,
      'pages/p00003-menu.apx': `page 3 (
    name: Menu
    alias: MENU

    region nav (
        name: Nav
        type: list
        source {
            list: @broken
        }
        componentAppearance {
            listTemplate: @/menu
        }
        layout {
            sequence: 10
        }
    )
)
`,
    },
    MENU_THEME,
  );
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());

  const html = await (await fetch(`${server.url}/r/demo/menu`)).text();
  assert.match(html, /<ul class="menu" id="[^"]*"><\/ul>/u);
  const diagnostics = (await (await fetch(`${server.url}/__apex/diagnostics`)).json()) as {
    message: string;
  }[];
  assert.ok(diagnostics.some((d) => /Dynamic list broken query failed/u.test(d.message)));
});

test('preview maps page URLs that Oracle APEX generated in HTML and requests', async (t) => {
  const { app, assets } = await workspace(t);
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const renderer = server.renderer;

  assert.equal(
    renderer.localizeOracleHtml(
      '<a href="http://:/r/ws/demo/home?p1_x=1&amp;session=12&amp;cs=AB-c_d">Home</a>' +
        "<a href='/ords/r/ws/demo/home?session=12'>Again</a>" +
        '<a href="https://example.com/r/a/b/c">Other</a><a href="/r/ws/demo/missing">Missing</a>',
    ),
    '<a href="/r/demo/home?p1_x=1">Home</a>' +
      "<a href='/r/demo/home'>Again</a>" +
      '<a href="https://example.com/r/a/b/c">Other</a><a href="/r/ws/demo/missing">Missing</a>',
  );
  assert.equal(renderer.localizeOracleHtml('<p>no links</p>'), '<p>no links</p>');

  const redirect = await fetch(`${server.url}/ords/r/ws/demo/home?p1_x=2&session=5&cs=Z`, {
    redirect: 'manual',
  });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), '/r/demo/home?p1_x=2');
  const unknown = await fetch(`${server.url}/r/ws/demo/missing`, { redirect: 'manual' });
  assert.notEqual(unknown.status, 302);
});

test('preview dynamic content opens preview pages from Oracle page URLs', async (t) => {
  const { app, assets } = await workspace(t, {
    'pages/p00003-panel.apx': `page 3 (
    name: Panel
    alias: PANEL

    region panel (
        name: Panel
        type: dynamicContent
        source {
            language: plsql
            plsqlFunctionBody: return '<a id="go" href="http://:/r/ws/demo/home?p1_x=7&amp;session=1&amp;cs=Q">Go</a>';
        }
        layout {
            sequence: 10
        }
    )
)
`,
  });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const html = await (await fetch(`${server.url}/r/demo/panel`)).text();
  assert.match(html, /<a id="go" href="\/r\/demo\/home\?p1_x=7">Go<\/a>/u);
});

test('interactive grid row processing with a PL/SQL Code target runs the code once per changed row', async (t) => {
  const { app, assets } = await workspace(t, {
    '.apex-local/02-picked.sql': `create table picked (task_id integer, qty number, row_status varchar2(1));
`,
    'pages/p00003-pick.apx': `page 3 (
    name: Pick
    alias: PICK

    region goods (
        name: Goods
        type: interactiveGrid
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select task_id, title, cast(null as number) qty from tasks
        }
        layout {
            sequence: 10
        }
        edit {
            enabled: true
            allowedOperations: [
                update
            ]
        }

        column TASK_ID (
            type: hidden
            source {
                databaseColumn: TASK_ID
                dataType: number
                primaryKey: true
            }
        )
        column TITLE (
            type: displayOnly
            source {
                databaseColumn: TITLE
            }
        )
        column QTY (
            type: numberField
            source {
                databaseColumn: QTY
                dataType: number
            }
        )
    )

    process add-lines (
        name: Add lines
        type: interactiveGridAutoRowProcessing
        editableRegion: @goods
        target {
            targetType: plsqlCode
            dmlPlsqlCode:
                \`\`\`plsql
                if :APEX$ROW_STATUS = 'U' and :QTY is not null then
                  if :QTY < 0 then
                    raise_application_error(-20001, 'Quantity must not be negative');
                  end if;
                  insert into picked (task_id, qty, row_status) values (:TASK_ID, :QTY, :APEX$ROW_STATUS);
                end if;
                \`\`\`
        }
        execution {
            sequence: 10
            point: afterSubmit
        }
    )
)
`,
  });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const first = await fetch(`${server.url}/r/demo/pick`);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  await first.text();
  const save = async (changes: unknown[]) =>
    (await (
      await fetch(`${server.url}/r/demo/__apex/x/ig-save`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ page: '3', region: 'goods', changes }),
      })
    ).json()) as { ok: boolean; saved: number; errors: { message: string }[] };

  const ok = await save([
    { op: 'update', id: '1', values: { TASK_ID: '1', TITLE: 'Design review', QTY: '2' } },
    { op: 'update', id: '2', values: { TASK_ID: '2', TITLE: 'Ship it', QTY: '' } },
  ]);
  assert.equal(ok.ok, true);
  assert.equal(ok.saved, 2);
  assert.deepEqual(server.db.query('select task_id, qty, row_status from picked', {}, 10).rows, [
    { TASK_ID: 1, QTY: 2, ROW_STATUS: 'U' },
  ]);
  assert.equal(server.db.scalar('select count(*) from tasks'), 2, 'the source table is not changed');

  const failed = await save([
    { op: 'update', id: '2', values: { TASK_ID: '2', TITLE: 'Ship it', QTY: '5' } },
    { op: 'update', id: '1', values: { TASK_ID: '1', TITLE: 'Design review', QTY: '-1' } },
  ]);
  assert.equal(failed.ok, false);
  assert.match(failed.errors[0]!.message, /Quantity must not be negative/u);
  assert.equal(server.db.scalar('select count(*) from picked'), 1, 'a failing row undoes the earlier rows');
});

test('grid regions expose an Interactive Grid region interface in the browser runtime', async (t) => {
  const { app, assets } = await workspace(t);
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const runtime = await (await fetch(`${server.url}/__apex/runtime.js`)).text();
  assert.match(runtime, /type: "InteractiveGrid"/u);
  for (const method of ['getViews', 'getCurrentView', 'getActions', 'getSelectedRecords', 'gotoCell'])
    assert.match(runtime, new RegExp(`${method}: function`, 'u'));
  assert.match(runtime, /trigger\("interactivegridsave"/u);
  // The generic region registration keeps a grid region's Interactive Grid interface.
  assert.match(runtime, /querySelector\("\[data-apex-local-ig\]"\)/u);
});
