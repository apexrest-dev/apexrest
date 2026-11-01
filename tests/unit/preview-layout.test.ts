import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutGridRow } from '../../packages/core/src/preview/grid.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const sqlText = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** A page template with the Universal Theme grid attributes and a left-aligned label template. */
const THEME = `
begin
wwv_flow_imp_shared.create_template(
 p_id=>wwv_flow_imp.id(7001)
,p_name=>'Grid'
,p_static_id=>'grid'
,p_header_template=>${sqlText('<!DOCTYPE html><html><head><title>#TITLE#</title>#APEX_CSS##THEME_CSS#</head><body>#FORM_OPEN#')}
,p_box=>${sqlText('<main>#BODY#</main>')}
,p_footer_template=>${sqlText('#FORM_CLOSE##APEX_JAVASCRIPT##GENERATED_JAVASCRIPT#</body></html>')}
,p_grid_max_columns=>12
,p_grid_emit_empty_leading_cols=>true
,p_grid_default_label_col_span=>2
,p_grid_template=>${sqlText('<div class="container">#ROWS#</div>')}
,p_grid_row_template=>${sqlText('<div class="row #CSS_CLASSES#">#COLUMNS#</div>')}
,p_grid_column_template=>${sqlText('<div class="col col-#COLUMN_SPAN_NUMBER# #CSS_CLASSES# #FIRST_LAST_COLUMN_ATTRIBUTES#" #ATTRIBUTES#>#CONTENT#</div>')}
,p_grid_first_column_attributes=>'col-start'
,p_grid_last_column_attributes=>'col-end'
);
wwv_flow_imp_shared.create_field_template(
 p_id=>wwv_flow_imp.id(7002)
,p_static_id=>'optional'
,p_template_body1=>${sqlText('<div class="t-Form-labelContainer col col-#LABEL_COLUMN_SPAN_NUMBER#"><#LABEL_OPEN# id="#LABEL_ID#">')}
,p_template_body2=>${sqlText('<#LABEL_CLOSE#></div>')}
,p_before_item=>${sqlText('<div class="t-Form-fieldContainer rel-col #ITEM_CSS_CLASSES#" id="#CURRENT_ITEM_CONTAINER_ID#">')}
,p_after_item=>'</div>'
,p_before_element=>${sqlText('<div class="t-Form-inputContainer col col-#ITEM_COLUMN_SPAN_NUMBER#">')}
,p_after_element=>${sqlText('#ERROR_TEMPLATE#</div>')}
,p_error_template=>${sqlText('<span class="t-Form-error">#ERROR_MESSAGE#</span>')}
);
end;
/
`;

const FILES: Record<string, string> = {
  'pages/p00011-layout.apx': `page 11 (
    name: Layout
    alias: LAYOUT
    appearance {
        pageTemplate: @/grid
    }

    region wizard (
        name: Wizard
        type: staticContent
        layout {
            sequence: 10
            slot: body
            column: 3
            columnSpan: 8
        }
    )

    region left (
        name: Left
        type: staticContent
        layout {
            sequence: 20
            slot: body
            columnCssClasses: my-col
        }
    )

    region right (
        name: Right
        type: staticContent
        layout {
            sequence: 30
            slot: body
            startNewRow: false
            column: 9
        }
    )

    pageItem P11_NAME (
        type: textField
        label {
            label: Name
        }
        layout {
            sequence: 10
            region: @wizard
        }
        appearance {
            template: @/optional
        }
    )

    pageItem P11_CODE (
        type: textField
        label {
            label: Code
        }
        layout {
            sequence: 20
            region: @wizard
            columnSpan: 6
            labelColumnSpan: 3
        }
        appearance {
            template: @/optional
        }
    )

    pageItem P11_STATUS (
        type: selectList
        label {
            label: Status
        }
        layout {
            sequence: 30
            region: @wizard
        }
        lov {
            type: staticValues
            staticValues: [
                {
                    display: Open
                    return: O
                }
            ]
        }
    )

    pageItem P11_DUE (
        type: datePicker
        label {
            label: Due
        }
        layout {
            sequence: 40
            region: @wizard
        }
        settings {
            displayAs: nativeHtml
        }
    )

    pageItem P11_OWNER (
        type: popupLov
        label {
            label: Owner
        }
        layout {
            sequence: 50
            region: @wizard
        }
        settings {
            displayAs: modalDialog
        }
        lov {
            type: sqlQuery
            sqlQuery: select title d, task_id r from tasks
        }
    )

    pageItem P11_HELPER (
        type: popupLov
        label {
            label: Helper
        }
        layout {
            sequence: 60
            region: @wizard
        }
        settings {
            displayAs: inlinePopup
        }
        lov {
            type: sqlQuery
            sqlQuery: select title d, task_id r from tasks
        }
    )

    button open-popup (
        buttonName: OPEN
        label: Open
        layout {
            sequence: 10
            region: @wizard
            slot: create
        }
        behavior {
            action: definedByDynamicAction
        }
        advanced {
            htmlDomId: popup_button
        }
    )
)
`,
  'pages/p00012-selectors.apx': `page 12 (
    name: Selectors
    alias: SELECTORS

    region jump (
        name: Jump
        type: regionDisplaySelector
        layout {
            sequence: 5
            slot: body
        }
        settings {
            mode: scrollWindow
            rememberSelection: false
        }
    )

    region first (
        name: First
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region second (
        name: Second
        type: staticContent
        layout {
            sequence: 20
            slot: body
        }
        advanced {
            regionDisplaySelector: true
        }
    )
)
`,
  'pages/p00013-tabs.apx': `page 13 (
    name: Tabs
    alias: TABS

    region tabs (
        name: Tabs
        type: regionDisplaySelector
        layout {
            sequence: 5
            slot: body
        }
    )

    region first (
        name: First
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        advanced {
            regionDisplaySelector: true
        }
    )
)
`,
};

test('grid rows place explicit start columns after empty leading columns', () => {
  assert.deepEqual(layoutGridRow([{ column: 3, span: 8 }], 12), [{ gap: 2, span: 8 }]);
  assert.deepEqual(
    layoutGridRow(
      [
        { column: 0, span: 0 },
        { column: 9, span: 0 },
      ],
      12,
    ),
    [
      { gap: 0, span: 8 },
      { gap: 0, span: 4 },
    ],
  );
  assert.deepEqual(
    layoutGridRow(
      [
        { column: 0, span: 4 },
        { column: 7, span: 6 },
      ],
      12,
    ),
    [
      { gap: 0, span: 4 },
      { gap: 2, span: 6 },
    ],
  );
  assert.deepEqual(
    layoutGridRow(
      [
        { column: 0, span: 0 },
        { column: 0, span: 0 },
        { column: 0, span: 0 },
      ],
      12,
    ),
    [
      { gap: 0, span: 4 },
      { gap: 0, span: 4 },
      { gap: 0, span: 4 },
    ],
  );
});

test('layout, label spans, item display modes, static ids and the theme style follow APEX', async (t) => {
  const { app, assets } = await workspace(t, FILES, THEME);
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const html = await (await fetch(`${server.url}/r/demo/layout`)).text();

  // Universal Theme loads the standard app_ui style (switch, star rating ... tokens) after Core.
  assert.match(
    html,
    /app_ui\/css\/Core\.min\.css\?v=26\.2\.0" type="text\/css" \/>\s*<link rel="stylesheet" href="\/i\/app_ui\/css\/Theme-Standard\.min\.css/u,
  );
  // Column 3 / span 8: an empty leading column, then the region.
  assert.match(
    html,
    /<div class="col col-2  col-start" ><span class="apex-grid-nbsp">&nbsp;<\/span><\/div>\s*<div class="col col-8  col-end" ><div class="t-Region/u,
  );
  // Automatic span up to the next explicit start column, with the column CSS classes.
  assert.match(html, /<div class="col col-8 apex-col-auto my-col col-start" >/u);
  assert.match(html, /<div class="col col-4 apex-col-auto col-end" >/u);
  // Left-aligned labels split the item span: default label span 2, or Label Column Span.
  assert.match(
    html,
    /<div class="t-Form-labelContainer col col-2"><label for="P11_NAME"[^]*?<div class="t-Form-inputContainer col col-10">/u,
  );
  assert.match(
    html,
    /<div class="col col-6  col-start col-end" ><div class="t-Form-fieldContainer rel-col[^"]*" id="P11_CODE_CONTAINER"><div class="t-Form-labelContainer col col-3">[^]*?<div class="t-Form-inputContainer col col-3">/u,
  );
  // Every select list registers the widget so its selected text drives the floating label.
  assert.match(html, /apex\.widget\.selectList\("#P11_STATUS",\{"nullValue":""\}\);/u);
  // settings.displayAs values map to the widget values.
  assert.match(html, /<a-date-picker id="P11_DUE" class="apex-item-datepicker--native" display-as="native"/u);
  assert.match(html, /"itemId":"P11_OWNER"[^]*?"isPopup":false/u);
  assert.match(html, /"itemId":"P11_HELPER"[^]*?"isPopup":true/u);
  // Button HTML DOM ID.
  assert.match(html, /<button class="t-Button[^"]*" type="button"[^>]*id="popup_button"/u);
  assert.doesNotMatch(html, /id="B_OPEN-POPUP"/u);

  // Scroll Window selector: every region stays visible, no Show All, no remembered tab.
  const jump = await (await fetch(`${server.url}/r/demo/selectors`)).text();
  assert.doesNotMatch(jump, /apex-rds-region/u);
  assert.doesNotMatch(jump, /SHOW_ALL_tab/u);
  assert.match(jump, /class="[^"]*apex-tabs-region[^"]*" id="jump"/u);
  assert.match(
    jump,
    /apex\.widget\.regionDisplaySelector\("jump",\{"mode":"jump","useSlider":true,"useSessionStorage":false\}\);/u,
  );
  // View Single Region selector: the regions start hidden until the widget selects one.
  const tabs = await (await fetch(`${server.url}/r/demo/tabs`)).text();
  assert.match(tabs, /class="t-Region [^"]*apex-rds-region" id="first"/u);
  assert.match(tabs, /SHOW_ALL_tab/u);
  assert.match(tabs, /"mode":"standard","useSlider":true,"useSessionStorage":true/u);
});

test('maps honour map.height, row assignment, point styles, heat maps and info windows', async (t) => {
  const { app, assets } = await workspace(t, {
    'pages/p00014-map.apx': `page 14 (
    name: Offices
    alias: OFFICES
    region offices (
        name: Offices
        type: map
        layout {
            sequence: 10
            slot: body
        }
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select 1 id, 'Austin' city, -97.7 lon, 30.3 lat, 'Y' big, 10 revenue union all
                select 2, 'Boise', -116.2, 43.6, 'N', 2 union all
                select 3, 'Chicago', -87.6, 41.9, 'Y', 30
                \`\`\`
        }
        map {
            height: 333
        }
        layer big (
            name: Big
            layerType: points
            layout {
                sequence: 10
            }
            source {
                location: regionSource
            }
            columnMapping {
                geometryColumnDataType: longitudeLatitude
                longitudeColumn: LON
                latitudeColumn: LAT
            }
            rowAssignment {
                column: BIG
                valueForThisLayer: Y
            }
            pointObjects {
                shape: Circle
                shapeScale: 2
            }
            appearance {
                fillColor: #2e8540
                strokeColor: #101010
                strokeWidth: 2
            }
            tooltip {
                advancedFormatting: true
                htmlExpression: <b>&CITY.</b> (&ID.)
            }
            infoWindow {
                advancedFormatting: true
                htmlExpression: <h3>&CITY.</h3>
            }
        )
        layer small (
            name: Small
            layerType: points
            layout {
                sequence: 20
            }
            source {
                location: regionSource
            }
            columnMapping {
                geometryColumnDataType: longitudeLatitude
                longitudeColumn: LON
                latitudeColumn: LAT
            }
            rowAssignment {
                column: BIG
                valueForThisLayer: N
            }
            tooltip {
                column: CITY
            }
        )
        layer heat (
            name: Heat
            layerType: heatMap
            layout {
                sequence: 30
            }
            source {
                location: regionSource
            }
            columnMapping {
                geometryColumnDataType: longitudeLatitude
                longitudeColumn: LON
                latitudeColumn: LAT
            }
            appearance {
                valueColumn: REVENUE
            }
        )
    )
)
`,
  });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const html = await (await fetch(`${server.url}/r/demo/offices`)).text();
  assert.match(html, /viewBox="0 0 800 333"[^>]*style="height:333px"/u);
  // Rows go to the layer whose value they carry, not to every layer.
  assert.equal((html.match(/data-tip="Big\t/gu) ?? []).length, 2);
  assert.equal((html.match(/data-tip="Small\t/gu) ?? []).length, 1);
  assert.match(html, /data-tip="Small\tBoise"/u);
  // Point shape, scale and colours; the tooltip HTML expression as text; the info window markup.
  assert.match(
    html,
    /<circle class="apex-local-map-point" cx="[\d.]+" cy="[\d.]+" r="12" fill="#2e8540" fill-opacity="1" stroke="#101010" stroke-width="2" data-tip="Big\tAustin \(1\)" data-info="&lt;h3&gt;Austin&lt;\/h3&gt;"/u,
  );
  // Small points use the default pin marker.
  assert.match(html, /<path class="apex-local-map-point" d="M[^"]+Z" fill=/u);
  // Heat map blobs weighted by the value column.
  assert.match(html, /<radialGradient id="offices_heat2">/u);
  assert.equal((html.match(/class="apex-local-map-heat"/gu) ?? []).length, 3);
  const runtime = await (await fetch(`${server.url}/r/demo/__apex/runtime.js`)).text();
  assert.match(runtime, /apex-local-map-info/u);
});
