import test from 'node:test';
import assert from 'node:assert/strict';
import { checkApplication, PreviewServer } from '../../packages/core/src/preview/server.ts';
import { decimalsOf, formatTick } from '../../packages/core/src/preview/extensions/charts/format.ts';
import { calendarViews } from '../../packages/core/src/preview/extensions/charts/calendar.ts';
import { identifiers } from '../../packages/core/src/preview/extensions/reports/ir-views.ts';
import { filesize, formatValue, since } from '../../packages/core/src/preview/extensions/reports/masks.ts';
import type { ApxComponent, ApxObject } from '../../packages/core/src/preview/apexlang.ts';
import { workspace } from '../fixtures/preview.ts';

/**
 * Reports, cards, list view, calendar, template components, chart ticks and format masks:
 * 26.2 APEXlang names and APEX substitution semantics found by the showcase application.
 */

const component = (type: string, id: string, props: ApxObject): ApxComponent => ({
  type,
  id,
  props,
  children: [],
  file: 'test.apx',
  line: 1,
});

test('chart ticks print integer steps without decimals and keep fractional steps exact', () => {
  assert.equal(decimalsOf(1), 0);
  assert.equal(decimalsOf(0.5), 1);
  assert.equal(decimalsOf(2.5), 1);
  assert.equal(decimalsOf(0.25), 2);
  assert.equal(decimalsOf(0.2), 1);
  assert.deepEqual(
    [0, 1, 2].map((value) => formatTick(value, {}, 1)),
    ['0', '1', '2'],
  );
  assert.equal(formatTick(1000, { format: 'currency', decimalPlaces: 0 }, 1000), '$1K');
  assert.equal(formatTick(2000, { decimalPlaces: 0 }, 1000), '2K');
  // The fractional-tick fix stays: 0.5 steps never collapse to repeated integers.
  assert.deepEqual(
    [0, 0.5, 1, 1.5].map((value) => formatTick(value, { decimalPlaces: 0 }, 0.5)),
    ['0.0', '0.5', '1.0', '1.5'],
  );
  assert.equal(formatTick(2500, {}, 500), '2.5K');
  // Explicit decimal places are honoured on integer steps.
  assert.equal(formatTick(2, { decimalPlaces: 2 }, 1), '2.00');
  assert.equal(formatTick(0.25, { format: 'percent' }, 0.05), '25%');
});

test('APEX special format masks FILESIZE, SINCE and SINCE_SHORT', () => {
  assert.equal(filesize(512), '512B');
  assert.equal(filesize(1024), '1KB');
  assert.equal(filesize(6349), '6.2KB');
  assert.equal(filesize(1_363_149), '1.3MB');
  assert.equal(filesize(3 * 1024 ** 3), '3GB');
  assert.equal(formatValue(6349, 'FILESIZE'), '6.2KB');
  assert.equal(formatValue('6349', 'filesize'), '6.2KB');
  const now = new Date('2026-11-01T12:00:00').getTime();
  assert.equal(since('2026-10-29 12:00:00', now), '3 days ago');
  assert.equal(since('2026-11-01 09:00:00', now, true), '3h');
  assert.equal(since('2026-11-15 12:00:00', now, true), 'in 2w');
  assert.equal(formatValue(null, 'FILESIZE'), '');
});

test('calendar views follow calendarViewsAndNavigation and additionalCalendarViews', () => {
  const calendar = (settings: ApxObject) => component('region', 'cal', { type: 'calendar', settings });
  assert.deepEqual(calendarViews(calendar({ showTime: true })), {
    views: ['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listMonth'],
    navigation: true,
  });
  assert.deepEqual(
    calendarViews(calendar({ showTime: true, calendarViewsAndNavigation: ['week', 'list'] })),
    {
      views: ['timeGridWeek', 'listMonth'],
      navigation: false,
    },
  );
  assert.deepEqual(calendarViews(calendar({ showTime: true, calendarViewsAndNavigation: 'week' })), {
    views: ['timeGridWeek'],
    navigation: false,
  });
  assert.deepEqual(calendarViews(calendar({})), { views: ['dayGridMonth', 'listMonth'], navigation: true });
  assert.deepEqual(calendarViews(calendar({ additionalCalendarViews: ['navigation'] })), {
    views: ['dayGridMonth'],
    navigation: true,
  });
  assert.deepEqual(
    calendarViews(calendar({ showTime: false, calendarViewsAndNavigation: ['month', 'day', 'navigation'] })),
    { views: ['dayGridMonth', 'timeGridDay'], navigation: true },
  );
});

test('interactive report identifiers use declared endUserAlias before default letters', () => {
  const column = (id: string, alias?: string) =>
    component('column', id, alias ? { advanced: { endUserAlias: alias } } : {});
  assert.deepEqual(
    identifiers(
      [column('NAME', 'C'), column('CITY'), column('SALES', 'A'), column('NOTES')],
      [column('ROWID', 'B')],
    ),
    [
      { id: 'C', name: 'NAME' },
      { id: 'D', name: 'CITY' },
      { id: 'A', name: 'SALES' },
      { id: 'E', name: 'NOTES' },
    ],
  );
  assert.deepEqual(
    identifiers([column('X'), column('Y')]).map((entry) => entry.id),
    ['A', 'B'],
  );
});

const SEED = `create table docs (
  doc_id integer primary key,
  name varchar2(40),
  bytes number,
  status varchar2(10),
  icon varchar2(30),
  created date,
  region varchar2(20)
);
insert into docs values (1, 'Plan', 6349, 'OPEN', 'fa-file', '2026-10-01', 'North');
insert into docs values (2, 'Budget <Q4>', 1363149, 'DONE', 'fa-table', '2026-10-02', 'North');
insert into docs values (3, 'Notes', 512, 'HOLD', 'fa-sticky-note', '2026-10-03', 'South');
insert into docs values (4, 'Specs', 2048, 'OPEN', 'fa-book', '2026-10-04', 'South');
`;

const PAGE = `page 5 (
    name: Fixes
    alias: FIXES

    region all-rows (
        name: All Rows
        type: classicReport
        source {
            location: localDatabase
            sqlQuery:
                \`\`\`sql
                select doc_id, name, bytes, status from docs order by doc_id
                \`\`\`
        }
        layout {
            sequence: 10
        }
        reportLayout {
            numberOfRows: 2
        }
        pagination {
            type: showAll
        }

        column DOC_ID (
            type: hidden
        )
        column NAME (
            heading {
                heading: Name
            }
        )
        column BYTES (
            appearance {
                formatMask: FILESIZE
            }
        )
        column STATUS (
            columnFormatting {
                htmlExpression: {case STATUS/}{when OPEN/}<b class="st-open">#STATUS#</b>{when DONE/}<i class="st-done">#STATUS#</i>{otherwise/}<u class="st-other">#STATUS#</u>{endcase/}
            }
        )
    )

    region external (
        name: External
        type: classicReport
        source {
            location: localDatabase
            sqlQuery:
                \`\`\`sql
                select name from docs order by doc_id
                \`\`\`
        }
        layout {
            sequence: 20
        }
        reportLayout {
            numberOfRows: 2
        }
        pagination {
            type: externalPaginationButtons
        }
    )

    region doc-cards (
        name: Doc Cards
        type: cards
        source {
            location: localDatabase
            sqlQuery:
                \`\`\`sql
                select doc_id, name, status, icon, bytes from docs order by doc_id
                \`\`\`
        }
        layout {
            sequence: 30
        }
        card {
            primaryKeyColumn1: DOC_ID
        }
        title {
            column: NAME
        }
        body {
            advancedFormatting: true
            htmlExpression: <span class="cb-&STATUS.">&NAME.</span>{if ?BYTES/} #BYTES#{endif/}
        }
        iconAndBadge {
            iconSource: iconClassColumn
            iconColumn: ICON
            badgeColumn: STATUS
            badgeCssClasses: badge-&STATUS.
        }
        media {
            source: imageUrl
            url: https://img.example/&DOC_ID..png
            imageDescription: Picture of &NAME.
        }

        action open-title (
            type: title
            layout {
                sequence: 10
            }
            behavior {
                type: redirectUrl
                targetUrl: #doc-&DOC_ID.
            }
        )

        action edit (
            label: Edit &NAME.
            layout {
                sequence: 20
            }
            behavior {
                type: redirectUrl
                targetUrl: #edit-&DOC_ID.
            }
            appearance {
                displayType: textWithIcon
                icon: fa-pencil
                hot: true
            }
        )

        action share (
            label: Share
            layout {
                sequence: 30
                position: secondary
            }
            behavior {
                target: {
                    page: 5
                    items: {
                        P5_DOC: &DOC_ID.
                    }
                }
            }
            appearance {
                displayType: icon
                icon: fa-share
            }
        )

        action whole (
            type: fullCard
            layout {
                sequence: 40
            }
            behavior {
                type: redirectUrl
                targetUrl: #card-&DOC_ID.
            }
        )
    )

    region doc-list (
        name: Doc List
        type: listView
        source {
            location: localDatabase
            sqlQuery:
                \`\`\`sql
                select doc_id, name, region, bytes from docs order by region, doc_id
                \`\`\`
        }
        layout {
            sequence: 40
        }
        settings {
            features: [
                showListDivider
                enableSearch
                insetList
            ]
            textColumn: NAME
            counterColumn: BYTES
            supplementalInfoColumn: REGION
            listDividerColumn: REGION
            searchBoxPlaceholder: Find a document
            linkTarget: {
                type: url
                url: #doc-&DOC_ID.
            }
        }
    )

    region plain-list (
        name: Plain List
        type: listView
        source {
            location: localDatabase
            sqlQuery:
                \`\`\`sql
                select name, region from docs order by doc_id
                \`\`\`
        }
        layout {
            sequence: 50
        }
        settings {
            features: advancedFormatting
            textFormatting: <em>#NAME#</em> {if REGION/}(&REGION.){endif/}
            listDividerColumn: REGION
        }
    )

    region timeline (
        name: Timeline
        type: themeTemplateComponent/timeline
        source {
            location: localDatabase
            sqlQuery:
                \`\`\`sql
                select doc_id, name, status, created, 'in' as direction, 'fa-clock-o' as mode_icon from docs order by doc_id
                \`\`\`
        }
        layout {
            sequence: 60
        }
        componentAppearance {
            display: report
        }
        settings {
            title: NAME
            date: CREATED
            description: STATUS
            displayAvatar: true
            alignment: &DIRECTION.
        }
        plugin-avatar {
            icon: &MODE_ICON.
        }

        column DOC_ID (
            source {
                primaryKey: true
            }
        )
        column CREATED (
            appearance {
                formatMask: DD-MON-YYYY
            }
        )

        action open (
            position: primaryActions
            template: button
            label: Open
            layout {
                sequence: 10
            }
            behavior {
                type: redirectUrl
                targetUrl: #open-&DOC_ID.
            }
            appearance {
                displayType: textWithIcon
                icon: fa-external-link
            }
        )
    )
)
`;

const join = (...lines: string[]) =>
  `wwv_flow_string.join(wwv_flow_t_varchar2(${lines.map((line) => `'${line.replaceAll("'", "''")}'`).join(',\n')}))`;

/** A trimmed THEME_42$TIMELINE: own `description`, a nested avatar group with its own `description`. */
const TIMELINE_SQL = `
begin
wwv_flow_imp_shared.create_plugin(
 p_id=>wwv_flow_imp.id(701)
,p_plugin_type=>'TEMPLATE COMPONENT'
,p_theme_id=>42
,p_name=>'THEME_42$TIMELINE'
,p_display_name=>'Timeline'
,p_apexlang_name=>'timeline'
,p_default_escape_mode=>'HTML'
,p_supported_component_types=>'PARTIAL:REPORT'
,p_partial_template=>${join(
  '<div class="tl">{if DISPLAY_AVATAR/}<span class="av{if ?AVATAR_ICON/} #AVATAR_ICON#{endif/}" aria-label="#AVATAR_DESCRIPTION#"></span>{endif/}',
  '<span class="tl-date">#DATE#</span><h3>#TITLE#</h3><p class="tl-desc">#DESCRIPTION#</p>',
  '{if ?PRIMARY_ACTIONS/}<div class="tl-actions">#PRIMARY_ACTIONS#</div>{endif/}</div>',
)}
,p_report_body_template=>'<ul class="t-Timeline">#APEX$ROWS#</ul>'
,p_report_row_template=>'<li class="t-Timeline-item{if ?ALIGNMENT/} is-#ALIGNMENT#{endif/}" #APEX$ROW_IDENTIFICATION#>#APEX$PARTIAL#</li>'
);
wwv_flow_imp_shared.create_plugin_attr_group(p_id=>wwv_flow_imp.id(711), p_plugin_id=>wwv_flow_imp.id(701), p_title=>'Avatar', p_apexlang_name=>'avatar', p_static_id=>'avatar');
wwv_flow_imp_shared.create_plugin_attribute(p_id=>wwv_flow_imp.id(721), p_plugin_id=>wwv_flow_imp.id(701), p_static_id=>'TITLE', p_apexlang_name=>'title', p_attribute_scope=>'COMPONENT', p_attribute_type=>'SESSION STATE VALUE', p_escape_mode=>'HTML');
wwv_flow_imp_shared.create_plugin_attribute(p_id=>wwv_flow_imp.id(722), p_plugin_id=>wwv_flow_imp.id(701), p_static_id=>'DATE', p_apexlang_name=>'date', p_attribute_scope=>'COMPONENT', p_attribute_type=>'SESSION STATE VALUE', p_escape_mode=>'HTML');
wwv_flow_imp_shared.create_plugin_attribute(p_id=>wwv_flow_imp.id(723), p_plugin_id=>wwv_flow_imp.id(701), p_static_id=>'DESCRIPTION', p_apexlang_name=>'description', p_attribute_scope=>'COMPONENT', p_attribute_type=>'SESSION STATE VALUE', p_escape_mode=>'HTML');
wwv_flow_imp_shared.create_plugin_attribute(p_id=>wwv_flow_imp.id(724), p_plugin_id=>wwv_flow_imp.id(701), p_static_id=>'DISPLAY_AVATAR', p_apexlang_name=>'displayAvatar', p_attribute_scope=>'COMPONENT', p_attribute_type=>'CHECKBOX', p_escape_mode=>'ATTR', p_default_value=>'N');
wwv_flow_imp_shared.create_plugin_attribute(p_id=>wwv_flow_imp.id(725), p_plugin_id=>wwv_flow_imp.id(701), p_static_id=>'AVATAR_DESCRIPTION', p_apexlang_name=>'description', p_attribute_scope=>'COMPONENT', p_attribute_type=>'TEXT', p_escape_mode=>'ATTR', p_attribute_group_id=>wwv_flow_imp.id(711));
wwv_flow_imp_shared.create_plugin_attribute(p_id=>wwv_flow_imp.id(726), p_plugin_id=>wwv_flow_imp.id(701), p_static_id=>'AVATAR_ICON', p_apexlang_name=>'icon', p_attribute_scope=>'COMPONENT', p_attribute_type=>'ICON', p_escape_mode=>'ATTR', p_attribute_group_id=>wwv_flow_imp.id(711));
wwv_flow_imp_shared.create_plugin_attribute(p_id=>wwv_flow_imp.id(727), p_plugin_id=>wwv_flow_imp.id(701), p_static_id=>'ALIGNMENT', p_apexlang_name=>'alignment', p_attribute_scope=>'REPORT', p_attribute_type=>'TEXT', p_escape_mode=>'ATTR');
wwv_flow_imp_shared.create_plugin_act_template(
 p_id=>wwv_flow_imp.id(731)
,p_plugin_id=>wwv_flow_imp.id(701)
,p_name=>'Button'
,p_apexlang_name=>'button'
,p_static_id=>'Button'
,p_type=>'BUTTON'
,p_template=>'<a class="t-Button" href="#LINK_URL#">{if ?ICON_CLASSES/}<span class="t-Icon #ICON_CLASSES#"></span>{endif/}#LABEL#</a>'
);
wwv_flow_imp_shared.create_plugin_act_position(p_id=>wwv_flow_imp.id(732), p_plugin_id=>wwv_flow_imp.id(701), p_name=>'Primary Actions', p_static_id=>'PRIMARY_ACTIONS', p_apexlang_name=>'primaryActions', p_display_sequence=>10, p_type=>'TEMPLATE');
end;
/
`;

async function start(t: import('node:test').TestContext) {
  const { app, assets } = await workspace(
    t,
    { 'pages/p00005-fixes.apx': PAGE, '.apex-local/02-docs.sql': SEED },
    TIMELINE_SQL,
  );
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const first = await fetch(`${server.url}/r/demo/fixes`);
  const html = await first.text();
  return { app, assets, html };
}

const between = (html: string, from: string, to?: string) =>
  html.slice(html.indexOf(from), to ? html.indexOf(to, html.indexOf(from)) : undefined);

const textOf = (html: string) =>
  html
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

test('classic report showAll prints every row without pagination; directives and FILESIZE apply', async (t) => {
  const { html } = await start(t);
  const all = between(html, 'id="all-rows"', 'id="external"');
  assert.match(textOf(all), /Plan .*Budget .*Notes .*Specs/u);
  assert.doesNotMatch(textOf(all), /\d+ - \d+/u);
  assert.doesNotMatch(all, /paginate/u);
  assert.match(all, /6\.2KB/u);
  assert.match(all, /1\.3MB/u);
  assert.match(all, />512B</u);
  assert.doesNotMatch(all, /FILESIZE/u);
  assert.match(all, /<b class="st-open">OPEN<\/b>/u);
  assert.match(all, /<i class="st-done">DONE<\/i>/u);
  assert.match(all, /<u class="st-other">HOLD<\/u>/u);
  assert.doesNotMatch(all, /\{case|\{when|\{endcase/u);

  const external = between(html, 'id="external"', 'id="doc-cards"');
  assert.match(textOf(external), /Plan .*Budget/u);
  assert.doesNotMatch(textOf(external), /Notes/u);
  assert.doesNotMatch(textOf(external), /\d+ - \d+/u);
});

test('cards take 26.2 action types/positions and substitute &COLUMN. per row', async (t) => {
  const { html } = await start(t);
  const cards = between(html, 'id="doc-cards', 'id="doc-list');
  const second = cards.slice(cards.indexOf('data-id="2"'), cards.indexOf('data-id="3"'));
  assert.match(second, /<a class="a-CardView-titleLink" href="#doc-2">Budget &lt;Q4&gt;<\/a>/u);
  assert.match(second, /<span class="cb-DONE">Budget &lt;Q4&gt;<\/span> 1363149/u);
  assert.match(second, /class="a-CardView-badge badge-DONE"/u);
  assert.match(second, /src="https:\/\/img\.example\/2\.png" alt="Picture of Budget &lt;Q4&gt;"/u);
  assert.match(
    second,
    /<div class="a-CardView-actionsPrimary"><a class="a-CardView-button a-CardView-button--hot" href="#edit-2">/u,
  );
  assert.match(second, /fa fa-pencil/u);
  assert.match(second, /Edit Budget &lt;Q4&gt;/u);
  assert.match(
    second,
    /<div class="a-CardView-actionsSecondary"><a class="a-CardView-button" href="[^"]*p5_doc=2"/u,
  );
  assert.match(second, /<a class="a-CardView-fullLink" href="#card-2"/u);
  assert.match(second, /has-actions--full/u);
});

test('list view honours enableSearch, insetList, showListDivider and row substitutions', async (t) => {
  const { html } = await start(t);
  const list = between(html, 'id="doc-list', 'id="plain-list');
  assert.match(list, /placeholder="Find a document"/u);
  assert.match(list, /class="a-ListView a-ListView--inset"/u);
  assert.equal((list.match(/a-ListView-divider/gu) ?? []).length, 2);
  assert.match(list, /<a class="ui-btn" href="#doc-3">/u);
  assert.match(list, /<p class="ui-li-aside">South<\/p>/u);

  const plain = between(html, 'id="plain-list', 'id="timeline');
  assert.doesNotMatch(plain, /a-ListView-divider/u);
  assert.doesNotMatch(plain, /a-ListView--inset|a-ListView-searchbar/u);
  assert.match(plain, /<em>Budget &lt;Q4&gt;<\/em> \(North\)/u);
});

test('template components format columns, keep nested avatar settings apart and prefix action icons', async (t) => {
  const { html } = await start(t);
  const timeline = between(html, 'class="t-Timeline"', '</ul>');
  assert.match(timeline, /<span class="tl-date">01-OCT-2026<\/span>/u);
  assert.doesNotMatch(timeline, /2026-10-01/u);
  assert.match(timeline, /<p class="tl-desc">OPEN<\/p>/u);
  // The avatar's own description is unset; Timeline's `description: STATUS` is not its value.
  assert.doesNotMatch(timeline, /aria-label="STATUS"/u);
  assert.match(timeline, /class="av fa fa-clock-o"/u);
  assert.match(timeline, /class="t-Timeline-item is-in"/u);
  assert.match(timeline, /<span class="t-Icon fa fa-external-link"><\/span>Open/u);
  assert.match(timeline, /href="#open-1"/u);
});

test('preview check reports no pagination, card action or calendar view gaps', async (t) => {
  const { app, assets } = await workspace(
    t,
    {
      'pages/p00005-fixes.apx': PAGE.replace(
        /\n\)\n$/u,
        `
    region cal (
        name: Cal
        type: calendar
        source {
            location: localDatabase
            sqlQuery:
                \`\`\`sql
                select doc_id, name, created from docs
                \`\`\`
        }
        layout {
            sequence: 70
        }
        settings {
            displayColumn: NAME
            startDateColumn: CREATED
            showTime: true
            calendarViewsAndNavigation: [
                month
                week
                navigation
            ]
        }
    )
)
`,
      ),
      '.apex-local/02-docs.sql': SEED,
    },
    TIMELINE_SQL,
  );
  const result = await checkApplication({ sourceDir: app, assetsDir: assets });
  const messages = result.diagnostics.map((entry) => entry.message).join('\n');
  assert.doesNotMatch(messages, /pagination type/u);
  assert.doesNotMatch(messages, /action position/u);
  assert.doesNotMatch(messages, /calendarViewsAndNavigation/u);
  assert.doesNotMatch(messages, /Format mask FILESIZE/u);
});
