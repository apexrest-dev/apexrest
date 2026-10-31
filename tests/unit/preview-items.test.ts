import test from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, qrSvg } from '../../packages/core/src/preview/extensions/items/qrcode.ts';
import { checkApplication, PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const sqlText = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Universal Theme style floating label templates (the fixture theme has a bare one). */
const FIELD_TEMPLATES = ['optional-floating', 'required-floating']
  .map(
    (staticId, index) => `
begin
wwv_flow_imp_shared.create_field_template(
 p_id=>wwv_flow_imp.id(${900 + index})
,p_static_id=>${sqlText(staticId)}
,p_template_body1=>${sqlText('<div class="t-Form-labelContainer"><#LABEL_OPEN# id="#LABEL_ID#" class="t-Form-label">')}
,p_template_body2=>${sqlText('<#LABEL_CLOSE#></div>')}
,p_before_item=>${sqlText('<div class="t-Form-fieldContainer t-Form-fieldContainer--floatingLabel #ITEM_CSS_CLASSES#" id="#CURRENT_ITEM_CONTAINER_ID#">')}
,p_after_item=>${sqlText('</div>')}
,p_item_pre_text=>${sqlText('<span class="t-Form-itemText t-Form-itemText--pre">#CURRENT_ITEM_PRE_TEXT#</span>')}
,p_item_post_text=>${sqlText('<span class="t-Form-itemText t-Form-itemText--post">#CURRENT_ITEM_POST_TEXT#</span>')}
,p_before_element=>${sqlText('<div class="t-Form-inputContainer"><div class="t-Form-itemWrapper">#ITEM_PRE_TEXT#')}
,p_after_element=>${sqlText('#ITEM_POST_TEXT##HELP_TEMPLATE#</div>#INLINE_HELP_TEMPLATE##ERROR_TEMPLATE#</div>')}
,p_help_link=>${sqlText('<button class="t-Form-helpButton js-itemHelp" data-itemhelp="#CURRENT_ITEM_ID#" type="button"></button>')}
,p_inline_help_text=>${sqlText('<span class="t-Form-inlineHelp">#CURRENT_ITEM_INLINE_HELP_TEXT#</span>')}
,p_error_template=>${sqlText('<span class="t-Form-error">#ERROR_MESSAGE#</span>')}
);
end;
/
`,
  )
  .join('');

const item = (name: string, type: string, sequence: number, body = '') => `
    pageItem ${name} (
        type: ${type}
        label {
            label: ${name.replace(/^P\d+_/u, '')}
        }
        layout {
            sequence: ${sequence}
            region: @items
        }${body}
    )
`;

const page = (id: number, alias: string, items: string, region = '') => `page ${id} (
    name: ${alias}
    alias: ${alias}

    region items (
        name: Items
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }${region}
    )
${items}
    button save (
        buttonName: SAVE
        label: Save
        layout {
            sequence: 10
            region: @items
            slot: create
        }
    )
)
`;

const DEPT_LOV = `
        lov {
            type: sharedComponent
            lov: @dept-lov
        }`;
const EMP_LOV = `
        lov {
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select ename d, empno r from emp where deptno = :P3_DEPT order by 1
                \`\`\`
        }
        cascadingLov {
            parentItems: [
                P3_DEPT
            ]
        }`;

const FILES: Record<string, string> = {
  'shared-components/lovs/dept-lov.apx': `lov dept-lov (
    name: DEPT_LOV
    source {
        location: localDatabase
        type: sqlQuery
        sqlQuery:
            \`\`\`sql
            select deptno, dname, loc from dept
            \`\`\`
    }
    columnMapping {
        return: DEPTNO
        display: DNAME
    }

    column DNAME (
        columnName: DNAME
        heading {
            heading: Department
        }
        layout {
            sequence: 10
        }
    )

    column LOC (
        columnName: LOC
        heading {
            heading: Location
        }
        layout {
            sequence: 20
        }
    )
)
`,
  '.apex-local/02-items.sql': `create table dept (deptno number primary key, dname varchar2(30), loc varchar2(30));
insert into dept values (10, 'ACCOUNTING', 'NEW YORK');
insert into dept values (20, 'RESEARCH', 'DALLAS');
insert into dept values (30, 'SALES', 'CHICAGO');
create table emp (empno number primary key, ename varchar2(30), deptno number);
insert into emp values (7782, 'CLARK', 10);
insert into emp values (7839, 'KING', 10);
insert into emp values (7499, 'ALLEN', 30);
insert into emp values (7698, 'BLAKE', 30);
`,
  'pages/p00003-items.apx': page(
    3,
    'items',
    [
      item(
        'P3_NAME',
        'textField',
        10,
        `
        settings {
            subtype: email
            textCase: upper
            trimSpaces: leading
        }
        appearance {
            icon: fa-user
            valuePlaceholder: you@example.com
            cssClasses: [
                wide-item
            ]
        }
        advanced {
            preText: <b>@</b>
            postText: .com
            cssClasses: [
                my-input
            ]
            customAttributes: data-test="name"
        }
        validation {
            valueRequired: true
            maxLength: 40
        }
        help {
            helpText: The <b>full</b> name.
            inlineHelpText: Shown in <em>upper</em> case.
        }`,
      ),
      item(
        'P3_SALARY',
        'numberField',
        20,
        `
        settings {
            minValue: 0
            maxValue: 100000
            numberAlignment: start
        }
        appearance {
            formatMask: FML999G990D00
        }
        default {
            type: static
            staticValue: 1234.5
        }`,
      ),
      item(
        'P3_NOTES',
        'textarea',
        30,
        `
        settings {
            autoHeight: true
            charCounter: true
        }
        validation {
            maxLength: 200
        }`,
      ),
      item(
        'P3_ID',
        'hidden',
        40,
        `
        settings {
            valueProtected: true
        }
        default {
            type: static
            staticValue: 42
        }`,
      ),
      item(
        'P3_START',
        'datePicker',
        50,
        `
        appearance {
            formatMask: DD-MON-YYYY
        }
        settings {
            minDate: static
            minStatic: 01-JAN-2024
            maxDate: static
            maxStatic: 31-DEC-2026
            useDefaults: false
            appearanceBehavior: showTodayButton
        }
        default {
            type: static
            staticValue: 2025-03-15
        }`,
      ),
      item(
        'P3_INLINE',
        'datePicker',
        55,
        `
        settings {
            displayAs: inline
        }`,
      ),
      item(
        'P3_DEPT',
        'selectList',
        60,
        `${DEPT_LOV.replace('        }', '            displayNullValue: true\n            nullDisplayValue: - Choose -\n        }')}
        default {
            type: static
            staticValue: 99
        }`,
      ),
      item('P3_EMP', 'selectList', 70, EMP_LOV),
      item('P3_EMPS', 'checkboxGroup', 75, EMP_LOV),
      item(
        'P3_SIZE',
        'radioGroup',
        80,
        `
        settings {
            noOfCols: 2
        }
        appearance {
            templateOptions: [
                #DEFAULT#
                t-Form-fieldContainer--radioButtonGroup
            ]
        }
        lov {
            type: staticValues
            staticValues: STATIC2:Small;S,Medium;M,Large;L
        }
        default {
            type: static
            staticValue: M
        }`,
      ),
      item(
        'P3_TAGS',
        'checkboxGroup',
        90,
        `
        lov {
            type: staticValues
            staticValues: STATIC2:Red;R,Green;G,Blue;B
        }`,
      ),
      item(
        'P3_AGREE',
        'checkbox',
        100,
        `
        settings {
            checkedValue: Y
            uncheckedValue: N
        }`,
      ),
      item(
        'P3_ACTIVE',
        'switch',
        110,
        `
        settings {
            useDefaults: false
            onValue: A
            onLabel: Enabled
            offValue: I
            offLabel: Disabled
        }`,
      ),
      item('P3_TEAM', 'shuttle', 120, DEPT_LOV),
      item(
        'P3_DEPTS',
        'popupLov',
        130,
        `${DEPT_LOV}\n        multipleValues {\n            type: delimitedList\n        }`,
      ),
      item('P3_EMP_LOV', 'popupLov', 135, EMP_LOV),
      item('P3_ONE', 'selectOne', 140, DEPT_LOV),
      item('P3_MANY', 'selectMany', 150, DEPT_LOV),
      item(
        'P3_COMBO',
        'combobox',
        155,
        `
        lov {
            type: staticValues
            staticValues: STATIC2:Clerk;CLERK,Manager;MANAGER
        }`,
      ),
      item(
        'P3_RATING',
        'starRating',
        160,
        `
        default {
            type: static
            staticValue: 3
        }`,
      ),
      item('P3_COLOR', 'colorPicker', 170),
      item('P3_RTE', 'richTextEditor', 180),
      item('P3_MD', 'markdownEditor', 190),
      item('P3_FILE', 'fileUpload', 200),
      item(
        'P3_QR',
        'qrCode',
        210,
        `
        default {
            type: static
            staticValue: https://example.com
        }`,
      ),
      item(
        'P3_PCT',
        'percentGraph',
        220,
        `
        default {
            type: static
            staticValue: 64
        }`,
      ),
      item(
        'P3_STATUS',
        'displayOnly',
        230,
        `
        lov {
            type: staticValues
            staticValues: STATIC2:Open;O,Closed;C
        }
        default {
            type: static
            staticValue: C
        }`,
      ),
      item(
        'P3_HTML',
        'displayOnly',
        240,
        `
        default {
            type: static
            staticValue: <b>bold</b>
        }`,
      ),
      item(
        'P3_LOCKED',
        'textField',
        250,
        `
        readOnly {
            type: always
        }
        default {
            type: static
            staticValue: fixed
        }`,
      ),
    ].join(''),
  ),
  'pages/p00004-readonly.apx': page(
    4,
    'readonly',
    item(
      'P4_DEPT',
      'selectList',
      10,
      `${DEPT_LOV}\n        default {\n            type: static\n            staticValue: 20\n        }`,
    ) +
      item(
        'P4_ON',
        'switch',
        20,
        `\n        default {\n            type: static\n            staticValue: Y\n        }`,
      ),
    `
        readOnly {
            type: always
        }`,
  ),
};

async function start(t: import('node:test').TestContext) {
  const { app, assets } = await workspace(t, FILES, FIELD_TEMPLATES);
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const first = await fetch(`${server.url}/r/demo/items`);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  const html = await first.text();
  const ajax = (form: Record<string, string>, json: unknown = {}) =>
    fetch(`${server.url}/r/demo/__apex/x/items.ajax`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ p_flow_step_id: '3', ...form, p_json: JSON.stringify(json) }),
    }).then((response) => response.json() as Promise<Record<string, unknown>>);
  return { server, cookie, html, ajax };
}

/** The label/field template container of one item. */
function container(html: string, name: string): string {
  const start = html.indexOf(`id="${name}_CONTAINER"`);
  assert.ok(start >= 0, `${name} container missing`);
  const open = html.lastIndexOf('<div', start);
  const next = html.indexOf('_CONTAINER"', start + name.length + 12);
  return html.slice(open, next < 0 ? undefined : html.lastIndexOf('<div', next));
}

test('page items render the genuine APEX 26.2 markup per item family', async (t) => {
  const { html } = await start(t);

  const name = container(html, 'P3_NAME');
  assert.match(name, /class="[^"]*apex-item-wrapper--text-field apex-item-wrapper--has-icon[^"]*wide-item/u);
  assert.match(name, /apex-item-wrapper--has-placeholder/u);
  assert.match(
    name,
    /<input type="email" id="P3_NAME" name="P3_NAME" class="text_field apex-item-text apex-item-has-icon my-input" value="" size="30" maxlength="40" placeholder="you@example.com" required data-trim-spaces="LEADING" data-text-case="UPPER" autocomplete="email" data-test="name">/u,
  );
  assert.match(name, /<span class="apex-item-icon fa fa-user" aria-hidden="true"><\/span>/u);
  assert.match(name, /<span class="t-Form-itemText t-Form-itemText--pre"><b>@<\/b><\/span>/u);
  assert.match(name, /<span class="t-Form-itemText t-Form-itemText--post">\.com<\/span>/u);
  assert.match(name, /<span class="t-Form-inlineHelp">Shown in <em>upper<\/em> case\.<\/span>/u);

  assert.match(
    html,
    /<input type="text" id="P3_SALARY" name="P3_SALARY" class="number_field apex-item-text apex-item-number u-textStart" value="\$1,234\.50"[^>]*data-min="0" data-max="100000" data-format="FML999G990D00" inputmode="decimal">/u,
  );
  assert.match(html, /data-counter="true" data-max-char="200" data-auto-height="true"/u);
  assert.match(
    html,
    /<div id="P3_NOTES_CHAR_COUNT" style="display:none;" class="apex-item-textarea-counter">/u,
  );
  assert.match(
    html,
    /<input type="hidden" name="P3_ID" id="P3_ID" value="42"><input type="hidden" data-for="P3_ID" value="local-checksum">/u,
  );

  assert.match(
    html,
    /<a-date-picker id="P3_START" class="apex-item-datepicker--popup" display-as="popup" format="DD-MON-YYYY" valid-example="[^"]+" value="15-MAR-2025" min="01-JAN-2024" max="31-DEC-2026" name="P3_START"[^>]* today-button="true"/u,
  );
  assert.match(container(html, 'P3_START'), /<label for="P3_START_input"/u);
  assert.match(
    container(html, 'P3_INLINE'),
    /apex-item-wrapper--date-picker-apex apex-item-wrapper--date-picker-apex-inline/u,
  );

  // Select list: null entry, extra value for a value missing from the LOV, cascading child init.
  assert.match(
    html,
    /<select id="P3_DEPT" name="P3_DEPT" class="selectlist apex-item-select" data-native-menu="false" size="1"><option value="">- Choose -<\/option><option value="10">ACCOUNTING<\/option><option value="20">RESEARCH<\/option><option value="30">SALES<\/option><option value="99" selected="selected">99<\/option><\/select>/u,
  );
  assert.match(
    html,
    /apex\.widget\.selectList\("#P3_EMP",\{"ajaxIdentifier":"LOCAL:3:P3_EMP","dependingOnSelector":"#P3_DEPT","optimizeRefresh":true,"nullValue":""\}\);/u,
  );

  const size = container(html, 'P3_SIZE');
  assert.match(size, /t-Form-fieldContainer--radioButtonGroup/u);
  assert.match(
    size,
    /<div tabindex="-1" id="P3_SIZE" aria-labelledby="P3_SIZE_LABEL" class="radio_group apex-item-group apex-item-group--rc apex-item-radio" role="radiogroup"><div class="apex-item-grid radio_group"><div class="apex-item-grid-row"><div class="apex-item-option"><input type="radio" id="P3_SIZE_0" name="P3_SIZE" data-display="Small" value="S"/u,
  );
  assert.match(size, /value="M" checked/u);
  assert.match(html, /apex\.widget\.checkboxAndRadio\("#P3_TAGS","checkbox",\{"inputName":"P3_TAGS"/u);

  assert.match(
    html,
    /<div class="apex-item-single-checkbox"><input type="hidden" name="P3_AGREE" id="P3_AGREE_HIDDENVALUE" value="N"><input type="checkbox" id="P3_AGREE" value="Y" data-unchecked-value="N"><label for="P3_AGREE" id="P3_AGREE_LABEL" class="u-checkbox">AGREE<\/label><\/div>/u,
  );
  assert.match(
    html,
    /<span class="a-Switch"><input type="checkbox" id="P3_ACTIVE" name="P3_ACTIVE" value="A" data-on-label="Enabled" data-off-value="I" data-off-label="Disabled"><span class="a-Switch-toggle"><\/span><\/span>/u,
  );
  assert.match(html, /apex\.widget\.yesNo\("P3_ACTIVE","SWITCH_CB"\);/u);

  assert.match(html, /<select title="Move from" multiple="multiple" id="P3_TEAM_LEFT"/u);
  assert.match(html, /id="P3_TEAM_RIGHT" name="P3_TEAM"/u);
  assert.match(html, /<button id="P3_TEAM_MOVE_ALL" class="a-Button/u);

  assert.match(
    html,
    /<div class="apex-item-group apex-item-group--popup-lov" role="none"><ul class="apex-item-multi" role="none"><li class="apex-item-multi-input">/u,
  );
  assert.match(html, /<button type="button" class="a-Button a-Button--popupLOV" id="P3_DEPTS_lov_btn"/u);
  assert.match(html, /apex\.widget\.popupLov\(\{"itemId":"P3_DEPTS","ajaxIdentifier":"LOCAL:3:P3_DEPTS"/u);
  assert.match(html, /"display":"grid"[^)]*"columns":\{"DNAME":\{"index":0,"heading":"Department"/u);
  assert.match(html, /"itemId":"P3_EMP_LOV"[^)]*"dependingOnSelector":"#P3_DEPT"[^)]*"display":"list"/u);

  assert.match(html, /<a-select id="P3_ONE" name="P3_ONE" value=""[^>]*return-display="true"[^>]*>/u);
  assert.match(
    html,
    /<a-option value="10">ACCOUNTING<a-option-column-value>NEW YORK<\/a-option-column-value><\/a-option>/u,
  );
  assert.match(html, /<a-select id="P3_MANY"[^>]* multi-value="true"/u);
  assert.match(container(html, 'P3_MANY'), /apex-item-wrapper--select-many/u);
  assert.match(html, /<a-combobox id="P3_COMBO"[^>]*><a-option value="CLERK">Clerk<\/a-option>/u);

  assert.match(
    html,
    /<div id="P3_RATING" class="apex-item-starrating"><input type="text" id="P3_RATING_INPUT" name="P3_RATING" value="3"/u,
  );
  assert.match(html, /apex\.widget\.starRating\("P3_RATING",\{"numStars":5/u);
  assert.match(
    html,
    /<a-color-picker id="P3_COLOR" name="P3_COLOR" value="" display-as="POPUP" display-mode="SIMPLE" return-value-as="HEX"/u,
  );
  assert.match(html, /<div class="apex-local-rte-content" id="P3_RTE_EDITOR" contenteditable="true"/u);
  assert.match(html, /apexLocal\.items\.richText\("P3_RTE"\);/u);
  assert.match(html, /apex\.widget\.markdown\("#P3_MD"/u);
  assert.match(
    html,
    /<a-file-upload id="P3_FILE" name="P3_FILE" display-style="DROPZONE_INLINE" upload-type="FILE"[^>]*><input type="file" id="P3_FILE_input" name="P3_FILE"/u,
  );
  assert.match(
    html,
    /<a-qrcode id="P3_QR" class="apex-item-qrcode" ajax-identifier="LOCAL:3:P3_QR" value="https:\/\/example\.com"[^>]*><svg /u,
  );
  assert.match(
    html,
    /<div class="apex-item-pct-graph" id="P3_PCT" data-show-value="true" data-label-id="P3_PCT_LABEL">64<\/div>/u,
  );
  assert.match(container(html, 'P3_PCT'), /apex-item-wrapper--pct-graph/u);

  assert.match(
    html,
    /<span id="P3_STATUS_DISPLAY" class="display_only apex-item-display-only" data-escape="true">Closed<\/span>/u,
  );
  assert.match(html, /<span id="P3_HTML_DISPLAY"[^>]*>&lt;b&gt;bold&lt;\/b&gt;<\/span>/u);
  const locked = container(html, 'P3_LOCKED');
  assert.match(locked, /apex-item-wrapper--display-only[^"]*is-readonly/u);
  assert.match(
    locked,
    /<span id="P3_LOCKED_DISPLAY" class="display_only apex-item-display-only" data-escape="true">fixed<\/span><input type="hidden" name="P3_LOCKED" id="P3_LOCKED" value="fixed">/u,
  );

  // Help: the template help button points at the item; inline help keeps its HTML.
  assert.match(name, /data-itemhelp="P3_NAME"/u);
});

test('read-only regions render their items as display only', async (t) => {
  const { server } = await start(t);
  const html = await (await fetch(`${server.url}/r/demo/readonly`)).text();
  assert.match(
    html,
    /<span id="P4_DEPT_DISPLAY" class="display_only apex-item-display-only" data-escape="true">RESEARCH<\/span>/u,
  );
  assert.match(html, /<span id="P4_ON_DISPLAY"[^>]*>On<\/span>/u);
  assert.doesNotMatch(html, /apex\.widget\.yesNo\("P4_ON"/u);
});

test('item routes serve cascading LOVs, popup LOV fetches, combobox searches, QR codes and help', async (t) => {
  const { server, cookie, ajax } = await start(t);
  const parent = { pageItems: { itemsToSubmit: [{ n: 'P3_DEPT', v: '30' }] } };

  const select = await ajax({ p_request: 'PLUGIN=LOCAL:3:P3_EMP' }, parent);
  assert.deepEqual(select.values, [
    { r: '7499', d: 'ALLEN' },
    { r: '7698', d: 'BLAKE' },
  ]);
  const checkboxes = await ajax({ p_request: 'PLUGIN=LOCAL:3:P3_EMPS' }, parent);
  assert.match(
    String(checkboxes.html),
    /<input type="checkbox" id="P3_EMPS_1" name="P3_EMPS" data-display="BLAKE" value="7698"/u,
  );

  const fetched = (await ajax(
    {},
    {
      ...parent,
      regions: [
        {
          id: 'P3_DEPTS',
          ajaxIdentifier: 'LOCAL:3:P3_DEPTS',
          fetchData: { firstRow: 1, maxRows: 2, search: 'a' },
        },
      ],
    },
  )) as {
    regions: { id: string; fetchedData: { values: string[][]; firstRow: number; moreData: boolean } }[];
  };
  assert.equal(fetched.regions[0]!.id, 'P3_DEPTS');
  assert.deepEqual(fetched.regions[0]!.fetchedData, {
    values: [
      ['ACCOUNTING', 'NEW YORK', '10'],
      ['RESEARCH', 'DALLAS', '20'],
    ],
    firstRow: 1,
    moreData: true,
  });
  const rows = await ajax({
    p_request: 'PLUGIN=LOCAL:3:P3_DEPTS',
    p_widget_action: 'get-row-values',
    f01: '10:30',
  });
  assert.deepEqual(Object.keys(rows), ['10', '30']);
  assert.equal((rows['30'] as { display: string }).display, 'SALES');
  const cascadedLov = (await ajax(
    {},
    {
      ...parent,
      regions: [{ id: 'P3_EMP_LOV', ajaxIdentifier: 'LOCAL:3:P3_EMP_LOV', fetchData: { firstRow: 1 } }],
    },
  )) as { regions: { fetchedData: { values: string[][] } }[] };
  assert.deepEqual(cascadedLov.regions[0]!.fetchedData.values, [
    ['ALLEN', '7499'],
    ['BLAKE', '7698'],
  ]);

  const search = await ajax({ p_request: 'PLUGIN=LOCAL:3:P3_ONE', x01: 'sal', x02: '10' });
  assert.deepEqual(search.data, [{ r: '30', d: 'SALES', cols: ['CHICAGO'] }]);
  const display = await ajax({
    p_request: 'PLUGIN=LOCAL:3:P3_MANY',
    p_widget_action: 'get-display-values',
    x03: '10:20',
  });
  assert.deepEqual(
    (display.data as { d: string }[]).map((entry) => entry.d),
    ['ACCOUNTING', 'RESEARCH'],
  );

  const qr = await ajax({ p_request: 'PLUGIN=LOCAL:3:P3_QR', x01: 'hello', x02: '#112233' });
  assert.match(String(qr.QR), /^<svg [^>]*viewBox="0 0 29 29"[^>]*>.*fill="#112233"/u);

  const unknown = await fetch(`${server.url}/r/demo/__apex/x/items.ajax`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ p_request: 'PLUGIN=LOCAL:3:P3_NOPE' }),
  });
  assert.equal(unknown.status, 404);

  const help = (await (
    await fetch(`${server.url}/r/demo/__apex/x/items.help?page=3&p_item_id=P3_NAME&p_output_format=JSON`, {
      headers: { cookie },
    })
  ).json()) as { title: string; helpText: string };
  assert.equal(help.title, 'NAME');
  assert.equal(help.helpText, '<div class="apex-help-dialog">The <b>full</b> name.</div>');

  const runtime = await (await fetch(`${server.url}/__apex/runtime.js`)).text();
  assert.match(runtime, /p_request=PLUGIN%3DLOCAL%3A/u);
  assert.match(runtime, /apex\.theme\.popupFieldHelp = function/u);
});

test('multi-value items survive the submit round trip', async (t) => {
  const { server, cookie } = await start(t);
  const submit = await fetch(`${server.url}/r/demo/wwv_flow.accept`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      p_flow_step_id: '3',
      p_request: 'SAVE',
      p_json: JSON.stringify({
        pageItems: {
          itemsToSubmit: [
            { n: 'P3_NAME', v: 'JOHN' },
            { n: 'P3_SALARY', v: '$98,765.40' },
            { n: 'P3_TAGS', v: ['R', 'B'] },
            { n: 'P3_TEAM', v: ['30', '10'] },
            { n: 'P3_DEPTS', v: ['20', '30'] },
            { n: 'P3_MANY', v: ['10', '30'] },
            { n: 'P3_AGREE', v: 'Y' },
            { n: 'P3_ACTIVE', v: 'A' },
          ],
        },
      }),
    }),
  }).then((response) => response.json() as Promise<{ errors?: unknown[]; redirectURL?: string }>);
  assert.equal(submit.errors, undefined);
  assert.equal(submit.redirectURL, '/r/demo/items');

  const html = await (await fetch(`${server.url}/r/demo/items`, { headers: { cookie } })).text();
  assert.match(html, /value="\$98,765\.40"/u);
  assert.match(html, /id="P3_TAGS_0" name="P3_TAGS" data-display="Red" value="R" checked/u);
  assert.doesNotMatch(html, /data-display="Green" value="G" checked/u);
  assert.match(html, /id="P3_TAGS_2" name="P3_TAGS" data-display="Blue" value="B" checked/u);
  // Shuttle keeps the submitted order on the right.
  assert.match(
    html,
    /id="P3_TEAM_RIGHT" name="P3_TEAM"[^>]*><option value="30">SALES<\/option><option value="10">ACCOUNTING<\/option><\/select>/u,
  );
  assert.match(
    html,
    /<li class="apex-item-multi-item" data-value="20">RESEARCH<\/li><li class="apex-item-multi-item" data-value="30">SALES<\/li>/u,
  );
  assert.match(html, /<a-select id="P3_MANY" name="P3_MANY" value="10:30"/u);
  assert.match(
    html,
    /id="P3_AGREE_HIDDENVALUE" value="Y"><input type="checkbox" id="P3_AGREE" value="Y" checked/u,
  );
  assert.match(html, /id="P3_ACTIVE" name="P3_ACTIVE" value="A"[^>]* checked>/u);
});

test('check renders every item family without errors and reports local fallbacks', async (t) => {
  const { app, assets } = await workspace(t, FILES, FIELD_TEMPLATES);
  const result = checkApplication({ sourceDir: app, assetsDir: assets });
  assert.deepEqual(
    result.pages.filter((entry) => entry.error),
    [],
  );
  assert.ok(
    result.diagnostics.some((entry) =>
      /Rich Text Editor P3_RTE uses a simple contenteditable/u.test(entry.message),
    ),
  );
  assert.ok(
    result.diagnostics.some((entry) => /File item P3_FILE renders the drop zone/u.test(entry.message)),
  );
});

test('QR encoder produces a standard symbol', () => {
  const matrix = qrMatrix('HELLO WORLD');
  assert.equal(matrix.length, 21);
  // Finder patterns: dark 7x7 border with a light ring and dark 3x3 center.
  for (const [x, y] of [
    [0, 0],
    [14, 0],
    [0, 14],
  ] as const) {
    assert.equal(matrix[y]![x], true);
    assert.equal(matrix[y + 1]![x + 1], false);
    assert.equal(matrix[y + 3]![x + 3], true);
  }
  // Timing pattern alternates between the finders.
  assert.deepEqual(matrix[6]!.slice(8, 13), [true, false, true, false, true]);
  // 100 bytes need version 6 at error correction level M.
  assert.equal(qrMatrix('x'.repeat(100)).length, 6 * 4 + 17);
  assert.match(qrSvg('hi', { size: 100 }), /width="100" height="100"/u);
});
