import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTemplate,
  type NamedTemplate,
} from '../../packages/core/src/preview/extensions/components/directives.ts';
import { componentIndex } from '../../packages/core/src/preview/extensions/components/plugins.ts';
import { checkApplication, PreviewServer } from '../../packages/core/src/preview/server.ts';
import { parseThemeSql } from '../../packages/core/src/preview/theme-sql.ts';
import { applyDirectives, fill } from '../../packages/core/src/preview/theme.ts';
import { workspace } from '../fixtures/preview.ts';

const join = (...lines: string[]) =>
  `wwv_flow_string.join(wwv_flow_t_varchar2(${lines.map((line) => `'${line.replaceAll("'", "''")}'`).join(',\n')}))`;

const plugin = (id: number, name: string, apexlang: string, fields: Record<string, string>) =>
  `wwv_flow_imp_shared.create_plugin(
 p_id=>wwv_flow_imp.id(${id})
,p_plugin_type=>'TEMPLATE COMPONENT'
,p_theme_id=>42
,p_name=>'${name}'
,p_display_name=>'${apexlang}'
,p_apexlang_name=>'${apexlang}'
,p_default_escape_mode=>'HTML'
${Object.entries(fields)
  .map(
    ([key, value]) =>
      `,p_${key}=>${value.startsWith('wwv_flow_string') ? value : `'${value.replaceAll("'", "''")}'`}`,
  )
  .join('\n')}
);
`;

let attributeId = 1000;
const attribute = (pluginId: number, fields: Record<string, string | number>) =>
  `wwv_flow_imp_shared.create_plugin_attribute(
 p_id=>wwv_flow_imp.id(${(attributeId += 1)})
,p_plugin_id=>wwv_flow_imp.id(${pluginId})
${Object.entries(fields)
  .map(([key, value]) =>
    key === 'attribute_group_id' || key === 'depending_on_attribute_id'
      ? `,p_${key}=>wwv_flow_imp.id(${value})`
      : `,p_${key}=>${typeof value === 'number' ? value : `'${value}'`}`,
  )
  .join('\n')}
);
`;

/** A Badge and a Content Row like THEME_42$BADGE / THEME_42$CONTENT_ROW, plus Tabs Container and Menu Popup. */
const COMPONENTS_SQL = `
begin
${plugin(501, 'THEME_42$BADGE', 'badge', {
  supported_component_types: 'PARTIAL:REPORT',
  partial_template: join(
    '<span class="t-Badge{if ?STATE/} t-Badge--#STATE#{endif/}{if ?SHAPE/} #SHAPE#{endif/}" title="#LABEL!STRIPHTML#">',
    '{if LABEL_DISPLAY/}<span class="t-Badge-label">#LABEL#</span>{endif/}<span class="t-Badge-value">#VALUE#</span></span>',
  ),
  report_body_template: '<ul class="t-Badges #APEX$COMPONENT_CSS_CLASSES#">#APEX$ROWS#</ul>',
  report_row_template: '<li class="t-Badges-item" #APEX$ROW_IDENTIFICATION#>#APEX$PARTIAL#</li>',
})}
${attribute(501, { static_id: 'LABEL', apexlang_name: 'label', attribute_scope: 'COMPONENT', attribute_type: 'TEXT', escape_mode: 'RAW' })}
${attribute(501, { static_id: 'VALUE', apexlang_name: 'value', attribute_scope: 'COMPONENT', attribute_type: 'SESSION STATE VALUE', escape_mode: 'STRIPHTML' })}
${attribute(501, { static_id: 'STATE', apexlang_name: 'state', attribute_scope: 'COMPONENT', attribute_type: 'SESSION STATE VALUE', escape_mode: 'ATTR' })}
${attribute(501, { static_id: 'LABEL_DISPLAY', apexlang_name: 'displayLabel', attribute_scope: 'COMPONENT', attribute_type: 'CHECKBOX', escape_mode: 'ATTR', default_value: 'N' })}
${attribute(501, { static_id: 'SHAPE', apexlang_name: 'shape', attribute_scope: 'COMPONENT', attribute_type: 'SELECT LIST', escape_mode: 'ATTR' })}
wwv_flow_imp_shared.create_plugin_attr_value(
 p_id=>wwv_flow_imp.id(1900)
,p_plugin_attribute_id=>wwv_flow_imp.id(${attributeId})
,p_display_value=>'Rounded'
,p_return_value=>'t-Badge--rounded'
,p_apexlang_name=>'rounded'
);
${plugin(502, 'THEME_42$CONTENT_ROW', 'contentRow', {
  supported_component_types: 'PARTIAL:REPORT',
  partial_template: join(
    '{if ?FULL_ROW_LINK/}<a class="t-ContentRow-fullLink" href="#FULL_ROW_LINK#"></a>{endif/}',
    '<div class="t-ContentRow-wrap">',
    '{if DISPLAY_BADGE/}<div class="t-ContentRow-badge">',
    '  {with/}',
    '    LABEL:=#BADGE_LABEL#',
    '    VALUE:=#BADGE_VALUE#',
    '    STATE:=#BADGE_STATE#',
    '  {apply THEME$BADGE/}',
    '</div>{endif/}',
    '<h3 class="t-ContentRow-title">#TITLE#</h3>',
    '{if ?DESCRIPTION/}<div class="t-ContentRow-description">#DESCRIPTION#</div>{endif/}',
    '{if ?PRIMARY_ACTIONS/}<div class="t-ContentRow-actions">#PRIMARY_ACTIONS#</div>{endif/}',
    '</div>',
  ),
  report_body_template:
    '<ul class="t-ContentRow{if HIDE_BORDERS/} t-ContentRow--hideBorders{endif/} #APEX$COMPONENT_CSS_CLASSES#">#APEX$ROWS#</ul>',
  report_row_template: '<li class="t-ContentRow-item" #APEX$ROW_IDENTIFICATION#>#APEX$PARTIAL#</li>',
  report_group_template:
    '<li class="t-ContentRow-groupItem" #APEX$GROUP_IDENTIFICATION#><h2 class="t-ContentRow-groupTitle">#GROUP_TITLE#</h2><ul>#APEX$ROWS#</ul></li>',
})}
wwv_flow_imp_shared.create_plugin_attr_group(p_id=>wwv_flow_imp.id(1950), p_plugin_id=>wwv_flow_imp.id(502), p_title=>'Badge', p_apexlang_name=>'badge', p_static_id=>'badge');
wwv_flow_imp_shared.create_plugin_attr_group(p_id=>wwv_flow_imp.id(1951), p_plugin_id=>wwv_flow_imp.id(502), p_title=>'Grouping', p_apexlang_name=>'grouping', p_static_id=>'grouping');
${attribute(502, { static_id: 'TITLE', apexlang_name: 'title', attribute_scope: 'COMPONENT', attribute_type: 'HTML', escape_mode: 'RAW' })}
${attribute(502, { static_id: 'DESCRIPTION', apexlang_name: 'description', attribute_scope: 'COMPONENT', attribute_type: 'HTML', escape_mode: 'RAW' })}
${attribute(502, { static_id: 'DISPLAY_BADGE', apexlang_name: 'displayBadge', attribute_scope: 'COMPONENT', attribute_type: 'CHECKBOX', escape_mode: 'ATTR', default_value: 'N' })}
${attribute(502, { static_id: 'BADGE_LABEL', apexlang_name: 'label', attribute_scope: 'COMPONENT', attribute_type: 'TEXT', escape_mode: 'RAW', attribute_group_id: 1950, depending_on_attribute_id: attributeId, depending_on_condition_type: 'EQUALS', depending_on_expression: 'Y' })}
${attribute(502, { static_id: 'BADGE_VALUE', apexlang_name: 'value', attribute_scope: 'COMPONENT', attribute_type: 'SESSION STATE VALUE', escape_mode: 'STRIPHTML', attribute_group_id: 1950 })}
${attribute(502, { static_id: 'BADGE_STATE', apexlang_name: 'state', attribute_scope: 'COMPONENT', attribute_type: 'SESSION STATE VALUE', escape_mode: 'ATTR', attribute_group_id: 1950 })}
${attribute(502, { static_id: 'HIDE_BORDERS', apexlang_name: 'hideBorders', attribute_scope: 'REPORT', attribute_type: 'CHECKBOX', escape_mode: 'ATTR', default_value: 'N' })}
${attribute(502, { static_id: 'GROUP_TITLE', apexlang_name: 'title', attribute_scope: 'REPORT_GROUP', attribute_type: 'HTML', escape_mode: 'RAW', attribute_group_id: 1951 })}
wwv_flow_imp_shared.create_plugin_act_template(
 p_id=>wwv_flow_imp.id(1960)
,p_plugin_id=>wwv_flow_imp.id(502)
,p_name=>'Button'
,p_apexlang_name=>'button'
,p_static_id=>'Button'
,p_type=>'BUTTON'
,p_template=>'<a class="t-Button{if IS_HOT/} t-Button--hot{endif/}" href="#LINK_URL#">#LABEL#</a>'
);
wwv_flow_imp_shared.create_plugin_act_position(p_id=>wwv_flow_imp.id(1961), p_plugin_id=>wwv_flow_imp.id(502), p_name=>'Primary Actions', p_static_id=>'PRIMARY_ACTIONS', p_apexlang_name=>'primaryActions', p_display_sequence=>10, p_type=>'TEMPLATE');
wwv_flow_imp_shared.create_plugin_act_position(p_id=>wwv_flow_imp.id(1962), p_plugin_id=>wwv_flow_imp.id(502), p_name=>'Full Row Link', p_static_id=>'FULL_ROW_LINK', p_apexlang_name=>'fullRowLink', p_display_sequence=>20, p_type=>'LINK');
wwv_flow_imp_shared.create_plug_template(
 p_id=>wwv_flow_imp.id(1970)
,p_page_plug_template_name=>'Tabs Container'
,p_static_id=>'tabs-container'
,p_template=>'<div class="t-TabsRegion #REGION_CSS_CLASSES#" id="#DOM_ID#">#BODY#<div class="t-TabsRegion-items">#SUB_REGIONS#</div></div>'
,p_sub_plug_template=>'<div data-label="#SUB_REGION_TITLE!ATTR#" id="SR_#SUB_REGION_ID#">#SUB_REGION#</div>'
,p_javascript_file_urls=>'#APEX_FILES#libraries/apex/#MIN_DIRECTORY#widget.apexTabs#MIN#.js?v=#APEX_VERSION#'
);
wwv_flow_imp_shared.create_plug_tmpl_display_point(p_id=>wwv_flow_imp.id(1971), p_plug_template_id=>wwv_flow_imp.id(1970), p_placeholder=>'SUB_REGIONS', p_apexlang_name=>'tabs');
wwv_flow_imp_shared.create_list_template(
 p_id=>wwv_flow_imp.id(1980)
,p_static_id=>'menu-popup'
,p_list_template_before_rows=>'<div id="#PARENT_STATIC_ID#_menu" class="u-DisplayNone"><ul>'
,p_list_template_noncurrent=>'<li><a href="#LINK#">#TEXT_ESC_SC#</a></li>'
,p_list_template_after_rows=>'</ul></div>'
,p_javascript_code_onload=>'apex.jQuery("##PARENT_STATIC_ID#_menu").menu();'
);
end;
/
`;

const PAGE = `page 3 (
    name: Components
    alias: COMPONENTS
    title: Components

    region rows (
        name: Rows
        type: themeTemplateComponent/contentRow
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select 1 ID, 'Alpha <b>' TITLE, 'First' DESCRIPTION, 'Open' STATUS, 'success' STATE, 'A' GRP from dual
                union all select 2, 'Beta', null, 'Closed', 'danger', 'A' from dual
                union all select 3, 'Gamma', 'Third', 'Open', 'success', 'B' from dual
                \`\`\`
        }
        orderBy {
            type: staticValue
            orderByClause: ID
        }
        layout {
            sequence: 10
        }
        componentAppearance {
            display: report
            templateOptions: [
                t-ContentRow--styleCompact
            ]
        }
        settings {
            title: &TITLE.
            description: &DESCRIPTION.
            displayBadge: true
            hideBorders: true
        }
        plugin-badge {
            label: Status
            value: STATUS
            state: STATE
        }
        plugin-grouping {
            title: Group &GRP.
        }
        column ID (
            source {
                primaryKey: true
            }
        )
        column GRP (
            appearance {
                group: true
            }
        )
        action open (
            position: primaryActions
            template: button
            label: Open &ID.
            appearance {
                hot: true
            }
            behavior {
                type: redirectUrl
                targetUrl: #ID#
            }
        )
        action row-link (
            position: fullRowLink
            behavior {
                type: redirectThisApp
                target: {
                    page: 1
                    items: {
                        P1_TITLE: \\#TITLE#\\
                    }
                }
            }
        )
    )

    region single (
        name: Single
        type: themeTemplateComponent/badge
        layout {
            sequence: 20
        }
        componentAppearance {
            display: partial
        }
        settings {
            label: Total
            value: 42
            displayLabel: true
            shape: rounded
        }
    )

    region tabs (
        name: Tabs
        type: staticContent
        layout {
            sequence: 30
        }
        appearance {
            template: @/tabs-container
        }
    )

    region first-tab (
        name: First <tab>
        type: staticContent
        source {
            htmlCode: <p>One</p>
        }
        layout {
            sequence: 10
            parentRegion: @tabs
            slot: tabs
        }
    )

    region escaped (
        name: Escaped
        type: staticContent
        source {
            htmlCode: <b>&APP_USER.</b>
        }
        settings {
            outputAs: text
        }
        layout {
            sequence: 40
        }
    )

    region popup (
        name: Popup
        type: list
        source {
            list: @menu
        }
        advanced {
            htmlDomId: actions_popup
        }
        componentAppearance {
            listTemplate: @/menu-popup
        }
        layout {
            sequence: 50
        }
    )

    region selector (
        name: Selector
        type: regionDisplaySelector
        layout {
            sequence: 60
        }
    )

    region shown (
        name: Shown
        type: staticContent
        source {
            htmlCode: <p>Shown</p>
        }
        advanced {
            regionDisplaySelector: true
        }
        layout {
            sequence: 70
        }
    )

    region report (
        name: Report
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select 'Ready' STATUS, 'info' STATE from dual
        }
        layout {
            sequence: 80
        }
        column STATUS (
            type: themeTemplateComponent/badge
            settings {
                label: State
                value: STATUS
                state: STATE
            }
        )
    )
)
`;

const LIST = `list menu (
    name: Menu
    entry home (
        label: Home
        layout {
            sequence: 10
        }
        link {
            target: {
                page: 1
            }
        }
    )
)
`;

test('directive engine: if/elseif/else with plain, ?, = and ! tests', () => {
  const run = (template: string, values: Record<string, string>) => applyTemplate(template, values);
  assert.equal(run('{if A/}a{elseif B/}b{else/}c{endif/}', { B: 'x' }), 'b');
  assert.equal(run('{if A/}a{elsif B/}b{else/}c{endif/}', {}), 'c');
  assert.equal(run('{if A/}a{elseif B/}b{else/}c{endif/}', { A: '1', B: '1' }), 'a');
  for (const falsy of ['N', 'n', 'F', 'false', 'FALSE', '0', ''])
    assert.equal(run('{if A/}t{else/}f{endif/}', { A: falsy }), 'f', `plain ${falsy}`);
  assert.equal(run('{if ?A/}t{else/}f{endif/}', { A: 'N' }), 't');
  assert.equal(run('{if ?A/}t{else/}f{endif/}', { A: '  ' }), 'f');
  assert.equal(run('{if =A/}t{else/}f{endif/}', { A: '' }), 't');
  assert.equal(run('{if =A/}t{else/}f{endif/}', { A: 'N' }), 'f');
  assert.equal(run('{if !A/}t{else/}f{endif/}', { A: 'N' }), 't');
  assert.equal(run('{if !?A/}empty{endif/}', {}), 'empty');
  assert.equal(run('{if A/}{if B/}ab{else/}a{endif/}{else/}{if B/}b{endif/}{endif/}', { A: 'Y' }), 'a');
  assert.equal(run('{IF A/}x{ENDIF/}', { A: 'Y' }), 'x');
});

test('directive engine: case, loop, comments, escapes and whitespace', () => {
  const run = (template: string, values: Record<string, string>) => applyTemplate(template, values);
  const kase = '{case S/}\n  {when A/}alpha{when B/}beta{otherwise/}other{endcase/}';
  assert.equal(run(kase, { S: 'B' }), 'beta');
  assert.equal(run(kase, { S: ' A ' }), 'alpha');
  assert.equal(run(kase, { S: 'Z' }), 'other');
  assert.equal(run('{case S/}{when A/}a{endcase/}!', { S: 'Z' }), '!');
  assert.equal(
    run('<ul>{loop "," TAGS/}<li data-i="#APEX$I#">&APEX$ITEM.</li>{endloop/}</ul>', { TAGS: 'a,<b>' }),
    '<ul><li data-i="1">a</li><li data-i="2">&lt;b&gt;</li></ul>',
  );
  assert.equal(run('{loop TAGS/}[#APEX$ITEM#]{endloop/}', { TAGS: 'x:y' }), '[x][y]');
  assert.equal(run('{loop TAGS/}[#APEX$ITEM#]{endloop/}-', { TAGS: '' }), '-');
  assert.equal(
    run('{loop "," A/}{loop ";" B/}#APEX$ITEM#{endloop/}#APEX$ITEM#|{endloop/}', { A: '1,2', B: 'x;y' }),
    'xy1|xy2|',
  );
  assert.equal(run('{!a comment/}x{{/}y', {}), 'x{y');
  assert.equal(
    run('#A# #A!RAW# #A!ATTR# #A!STRIPHTML# #A!JS# #A!URL# #MISSING#.', { A: `<i>"x"</i>` }),
    '&lt;i&gt;&quot;x&quot;&lt;/i&gt; <i>"x"</i> &lt;i&gt;&quot;x&quot;&lt;/i&gt; &quot;x&quot; \\u003ci>\\"x\\"\\u003c/i> %3Ci%3E%22x%22%3C%2Fi%3E .',
  );
  assert.equal(applyTemplate('#A#', { A: '<b>' }, { escapes: { A: 'RAW' } }), '<b>');
  assert.equal(applyTemplate('#KEEP#', {}, { removeUnknown: false }), '#KEEP#');
  // Whitespace after a directive collapses to one space, as in apex.util.applyTemplate.
  assert.equal(run('{if A/}\n      x{endif/}', { A: 'Y' }), ' x');
  assert.equal(run('{unknown thing/}', {}), '{unknown thing/}');
  const warnings: string[] = [];
  applyTemplate('{endif/}{if A/}', {}, { warn: (message) => warnings.push(message) });
  assert.equal(warnings.length, 2);
});

test('directive engine: {with/}{apply/} composition with formal escapes and %assigned', () => {
  const badge: NamedTemplate = {
    template:
      '<span class="b{if ?STATE/} b--#STATE#{endif/}">{if LABEL_DISPLAY/}#LABEL#{endif/}#VALUE#</span>{if ?EXTRA%assigned/}+{endif/}',
    args: [
      { name: 'LABEL', escape: 'RAW' },
      { name: 'VALUE', escape: 'STRIPHTML' },
      { name: 'STATE', escape: 'ATTR' },
      { name: 'LABEL_DISPLAY', default: 'Y' },
      { name: 'EXTRA' },
    ],
    defaultEscape: 'HTML',
  };
  const templates = (name: string) => (name === 'THEME$BADGE' ? badge : undefined);
  const caller = `<div>{with/}
    LABEL:=#L#
    VALUE:=#V#
    STATE:="&quot;
    EXTRA:=
  {apply THEME$BADGE/}</div>`;
  assert.equal(
    applyTemplate(caller, { L: '<i>L</i>', V: '<b>5</b> & 6' }, { templates, escapes: { L: 'RAW' } }),
    '<div><span class="b b--&quot;&amp;quot;"><i>L</i>5 &amp; 6</span></div>',
  );
  // An assigned (non-empty) argument text is %assigned; nested {with/} values stay in one argument.
  const nested = `{with/}
  VALUE:={with/}
    VALUE:=inner
  {apply THEME$BADGE/}
  EXTRA:=#X#
{apply THEME$BADGE/}`;
  assert.equal(applyTemplate(nested, { X: '' }, { templates }), '<span class="b">inner</span>+');
  // theme.ts keeps its contract: directives first, then already-escaped placeholders.
  assert.equal(applyDirectives('{if !A/}no{endif/}{case B/}{when 1/}one{endcase/}', { B: '1' }), 'noone');
  assert.equal(fill('<b {if ?X/}x="#X#"{endif/}>#Y#</b>', { X: 'N', Y: '&amp;' }), '<b x="N">&amp;</b>');
});

test('template component index reads plugins, groups, values and actions from the theme export', async () => {
  const calls = parseThemeSql(COMPONENTS_SQL);
  const index = componentIndex(calls);
  const row = index.byApexlang.get('contentrow')!;
  assert.equal(row.applyName, 'THEME$CONTENT_ROW');
  assert.deepEqual([...row.supports], ['PARTIAL', 'REPORT']);
  assert.equal(row.attributes.find((entry) => entry.staticId === 'BADGE_LABEL')?.group, 'badge');
  assert.deepEqual(
    row.positions.map((entry) => entry.apexlangName),
    ['primaryActions', 'fullRowLink'],
  );
  const badge = index.byApexlang.get('badge')!;
  assert.equal(
    badge.attributes.find((entry) => entry.staticId === 'SHAPE')?.values.get('rounded'),
    't-Badge--rounded',
  );
  assert.ok(
    index.named.get('THEME$BADGE')?.args.some((arg) => arg.name === 'VALUE' && arg.escape === 'STRIPHTML'),
  );
});

test('preview renders theme template components, sub-region tabs, menus and selectors', async (t) => {
  const { app, assets } = await workspace(
    t,
    { 'pages/p00003-components.apx': PAGE, 'shared-components/lists/menu.apx': LIST },
    COMPONENTS_SQL,
  );
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const html = await (await fetch(`${server.url}/r/demo/components`)).text();
  const squash = (value: string) => value.replace(/\s+/gu, ' ');
  const page = squash(html);

  // Report with report attributes, component CSS classes, groups, row ids, nested THEME$BADGE and actions.
  assert.match(page, /<ul class="t-ContentRow t-ContentRow--hideBorders t-ContentRow--styleCompact">/);
  assert.match(
    page,
    /<li class="t-ContentRow-groupItem" data-group-id="A"> ?<h2 class="t-ContentRow-groupTitle">Group A<\/h2>/,
  );
  assert.match(page, /<h2 class="t-ContentRow-groupTitle">Group B<\/h2>/);
  assert.match(page, /<li class="t-ContentRow-item" data-id="2">/);
  assert.match(page, /<h3 class="t-ContentRow-title">Alpha &lt;b&gt;<\/h3>/);
  assert.match(
    page,
    /<span class="t-Badge t-Badge--success" title="Status"> ?<span class="t-Badge-value">Open<\/span><\/span>/,
  );
  assert.match(page, /<span class="t-Badge t-Badge--danger" title="Status">/);
  assert.match(page, /<a class="t-Button t-Button--hot" href="2">Open 2<\/a>/);
  assert.match(
    page,
    /<a class="t-ContentRow-fullLink" href="\/r\/demo\/home\?p1_title=Alpha\+%3Cb%3E"><\/a>/,
  );
  assert.doesNotMatch(page, /t-ContentRow-description">\s*<\/div>/);

  // Partial display with SELECT LIST value mapping and a checkbox.
  assert.match(
    page,
    /<span class="t-Badge t-Badge--rounded" title="Total"> ?<span class="t-Badge-label">Total<\/span><span class="t-Badge-value">42<\/span><\/span>/,
  );

  // Tabs Container: each sub-region is wrapped by the sub-region template (no grid).
  assert.match(
    page,
    /<div class="t-TabsRegion-items"><div data-label="First &lt;tab&gt;" id="SR_first-tab"><div class="t-Region/,
  );

  // Static content as escaped text; Menu Popup addressed by the region's DOM id.
  assert.match(page, /&lt;b&gt;DEVELOPER&lt;\/b&gt;/);
  assert.match(page, /<div id="actions_popup_menu" class="u-DisplayNone">/);
  assert.match(page, /apex\.jQuery\("#actions_popup_menu"\)\.menu\(\);/);

  // Region Display Selector tabs for the marked regions, the native widget call and region class.
  assert.match(page, /<ul class="apex-rds a-Tabs is-disabled" id="selector_RDS" role="tablist">/);
  assert.match(page, /<a class="a-RDS-link" href="#shown"/);
  assert.match(page, /apex\.widget\.regionDisplaySelector\("selector",/);
  assert.match(page, /class="t-Region [^"]*apex-rds-region" id="shown"/);
  assert.match(page, /apex\.util\.applySafeHidden\(\);/);

  // A classic report column rendered by a template component.
  assert.match(
    page,
    /<td class="t-Report-cell" [^>]*><span class="t-Badge t-Badge--info" title="State"> ?<span class="t-Badge-value">Ready<\/span><\/span><\/td>/,
  );

  // Region refresh returns the component region again.
  const fragment = await (await fetch(`${server.url}/r/demo/__apex/region?page=3&region=rows`)).text();
  assert.match(squash(fragment), /t-ContentRow-groupTitle">Group A/);

  const runtime = await (await fetch(`${server.url}/__apex/runtime.js`)).text();
  assert.match(runtime, /openRegion/);
});

test('template components report unknown components and unsupported options as diagnostics', async (t) => {
  const { app, assets } = await workspace(
    t,
    {
      'pages/p00004-unknown.apx': `page 4 (
    name: Unknown
    region timeline (
        name: Timeline
        type: themeTemplateComponent/timeline
        layout {
            sequence: 10
        }
    )
    region rows (
        name: Rows
        type: themeTemplateComponent/contentRow
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select 'x' TITLE from dual where 1 = 0
        }
        messages {
            whenNoDataFound: Nothing here
        }
        rowSelection {
            type: singleSelection
        }
        layout {
            sequence: 20
        }
    )
)
`,
    },
    COMPONENTS_SQL,
  );
  const result = checkApplication({ sourceDir: app, assetsDir: assets, pages: ['4'] });
  assert.equal(result.pages.find((page) => page.id === '4')?.error, undefined);
  const messages = result.diagnostics.map((entry) => entry.message);
  assert.ok(
    messages.some((message) => /Template component timeline \(timeline\) is not in the theme/.test(message)),
  );
  assert.ok(messages.some((message) => /row selection is not simulated/.test(message)));
});
