import test from 'node:test';
import assert from 'node:assert/strict';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

// The application's own database code, as an install script would create it.
const PLSQL = `create table settings (name varchar2(30) not null, value varchar2(100));
insert into settings values ('GREETING', 'Hello');
insert into settings values ('COLOR', 'blue');

create or replace package app_util as
  g_calls number := 0;
  function setting(p_name in varchar2) return varchar2;
  function setting(p_name in varchar2, p_default in varchar2) return varchar2;
  procedure bump;
end app_util;
/

create or replace package body app_util as
  g_prefix varchar2(10);

  function setting(p_name in varchar2) return varchar2 is
    l_value settings.value%type;
  begin
    g_calls := g_calls + 1;
    select value into l_value from settings where name = p_name;
    return g_prefix || l_value;
  exception
    when no_data_found then return null;
  end setting;

  function setting(p_name in varchar2, p_default in varchar2) return varchar2 is
  begin
    return nvl(setting(p_name), p_default);
  end setting;

  procedure bump is
  begin
    g_calls := g_calls + 10;
  end bump;
begin
  g_prefix := '>';
end app_util;
/

create or replace function shout(p in varchar2) return varchar2 is
begin
  return upper(p) || '!';
end;
/

begin
  insert into settings values ('INSTALLED', 'yes');
end;
/
`;

const PLUGIN = `plugin greeting (
    name: Greeting
    staticId: COM.EXAMPLE.GREETING
    type: region
    source {
        plsqlCode:
            \`\`\`plsql
            function render (
                p_region              in apex_plugin.t_region,
                p_plugin              in apex_plugin.t_plugin,
                p_is_printer_friendly in boolean )
                return apex_plugin.t_region_render_result
            is
                l_data apex_plugin_util.t_column_value_list2;
                l_name pls_integer;
            begin
                l_data := apex_plugin_util.get_data2 (
                    p_sql_statement  => p_region.source,
                    p_min_columns    => 2,
                    p_max_columns    => null,
                    p_component_name => p_region.name );
                l_name := apex_plugin_util.get_column_no (
                    p_attribute_label   => 'Name',
                    p_column_alias      => 'NAME',
                    p_column_value_list => l_data,
                    p_is_required       => true,
                    p_data_type         => apex_plugin_util.c_data_type_varchar2 );
                sys.htp.p('<div id="plug" data-tone="' || apex_escape.html_attribute(p_region.attribute_02) || '">'
                    || apex_escape.html(p_region.attribute_01) || ' x' || l_data(l_name).value_list.count);
                for i in 1 .. l_data(l_name).value_list.count loop
                    sys.htp.p('<i>' || l_data(l_name).value_list(i).varchar2_value || '</i>');
                end loop;
                sys.htp.p('</div>');
                apex_javascript.add_onload_code(
                    p_code => 'window.greeting(' || apex_javascript.add_value(p_region.static_id) || '{'
                        || apex_javascript.add_attribute('ajaxIdentifier', apex_plugin.get_ajax_identifier, false, false) || '});');
                return null;
            end render;

            function ajax (
                p_region in apex_plugin.t_region,
                p_plugin in apex_plugin.t_plugin )
                return apex_plugin.t_region_ajax_result
            is
            begin
                apex_json.open_object;
                apex_json.write('greeting', app_util.setting('GREETING'));
                apex_json.write('x01', apex_application.g_x01);
                apex_json.close_object;
                return null;
            end ajax;
            \`\`\`
    }
    callbacks {
        apiInterface: function
        renderProcedureName: render
        ajaxProcedureName: ajax
    }
)
`;

const ATTRIBUTES = `customAttribute attribute_01 (
    apexlangName: message
    attribute: 1
    name: Message
)

customAttribute attribute_02 (
    apexlangName: tone
    attribute: 2
    name: Tone
    default {
        value: warm
    }
)
`;

const ITEM_PLUGIN = `plugin badge (
    name: Badge
    staticId: COM.EXAMPLE.BADGE
    type: item
    source {
        plsqlCode:
            \`\`\`plsql
            procedure render (
                p_item   in            apex_plugin.t_item,
                p_plugin in            apex_plugin.t_plugin,
                p_param  in            apex_plugin.t_item_render_param,
                p_result in out nocopy apex_plugin.t_item_render_result )
            is
            begin
                sys.htp.p('<span id="' || p_item.name || '" class="badge">' || apex_escape.html(p_param.value) || '</span>');
            end render;
            \`\`\`
    }
    callbacks {
        apiInterface: procedure
        renderProcedureName: render
    }
)
`;

const PAGE = `page 3 (
    name: Database Code
    alias: CODE

    region dynamic (
        name: Dynamic
        type: dynamicContent
        source {
            plsqlFunctionBody:
                \`\`\`plsql
                declare
                    l_html clob;
                begin
                    l_html := '<p id="dyn">' || app_util.setting('GREETING') || '|' || app_util.setting('MISSING', 'none') || '|' || app_util.g_calls || '</p>';
                    app_util.bump;
                    return l_html || '<p id="calls">' || app_util.g_calls || '</p>';
                end;
                \`\`\`
        }
        layout {
            sequence: 10
            slot: body
        }
    )

    region values (
        name: Values
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select shout(name) as shouted, app_util.setting(name) as setting_value
                  from settings
                 where name in ('GREETING', 'INSTALLED')
                 order by name
                \`\`\`
        }
        layout {
            sequence: 20
            slot: body
        }
    )

    region greeting-region (
        name: Greeting
        type: plugin/greeting
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select name, value from settings order by name
                \`\`\`
        }
        layout {
            sequence: 30
            slot: body
        }
        settings {
            message: Hi &APP_USER.
        }
    )

    pageItem P3_STATUS (
        type: plugin/badge
        layout {
            sequence: 10
            region: @values
            slot: body
        }
        default {
            type: static
            staticValue: Ready
        }
    )
)
`;

test('the application packages, functions and install blocks of its scripts run locally', async (t) => {
  const { app, assets } = await workspace(t, {
    '.apex-local/02-plsql.sql': PLSQL,
    'pages/p00003-code.apx': PAGE,
    'shared-components/plugins/region/greeting/plugin.apx': PLUGIN,
    'shared-components/plugins/region/greeting/custom-attributes.apx': ATTRIBUTES,
    'shared-components/plugins/item/badge/plugin.apx': ITEM_PLUGIN,
  });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const response = await fetch(`${server.url}/r/demo/code`);
  const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
  const html = await response.text();

  // package state starts in the initialization section and lives for the request
  // dynamic content is the PL/SQL's own HTML; report cells are escaped
  assert.match(html, /<p id="dyn">>Hello\|none\|2<\/p>/u);
  assert.match(html, /<p id="calls">12<\/p>/u);
  // package and standalone functions in region SQL; the install block ran once
  assert.match(html, /GREETING!/u);
  assert.match(html, /<td[^>]*>&gt;Hello<\/td>/u);
  assert.match(html, /INSTALLED!/u);

  // the plug-in region: attributes (with default and substitution), region data, page code
  assert.match(html, /<div id="plug" data-tone="warm">Hi DEVELOPER x3/u);
  assert.match(html, /<i>COLOR<\/i>\s*<i>GREETING<\/i>\s*<i>INSTALLED<\/i>/u);
  assert.match(
    html,
    /window\.greeting\("greeting-region",\{"ajaxIdentifier":"APEXPLUGIN:3:region:greeting-region"\}\);/u,
  );
  // the item plug-in with the new procedure interface
  assert.match(html, /<span id="P3_STATUS" class="badge">Ready<\/span>/u);
  assert.doesNotMatch(html, /is not simulated locally/u);

  // the plug-in's ajax callback answers apex.server.plugin with apex_json output
  const ajax = await fetch(`${server.url}/r/demo/__apex/x/plugins.ajax`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams({
      p_request: 'PLUGIN=APEXPLUGIN:3:region:greeting-region',
      p_json: '{}',
      x01: 'from client',
    }).toString(),
  });
  assert.equal(ajax.status, 200);
  assert.deepEqual(await ajax.json(), { greeting: '>Hello', x01: 'from client' });

  const problems = server
    .diagnostics()
    .filter((entry) => entry.level !== 'info' && /plug-in|PL\/SQL|Seed script/iu.test(entry.message));
  assert.deepEqual(problems, []);
});
