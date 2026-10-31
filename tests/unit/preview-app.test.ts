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
