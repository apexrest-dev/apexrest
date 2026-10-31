import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { setupAssets } from '../../packages/core/src/preview/assets.ts';

const join = (...lines: string[]) =>
  `wwv_flow_string.join(wwv_flow_t_varchar2(${lines.map((line) => `'${line.replaceAll("'", "''")}'`).join(',\n')}))`;

/** A tiny stand-in for core/themes/f8842.262.sql: same call shapes, a fraction of the templates. */
export const THEME_SQL = `
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

export const APP: Record<string, string> = {
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

/**
 * A temporary APEXlang app plus preview assets built from a generated zip.
 * `files` adds or replaces application files (paths relative to the app root).
 */
export async function workspace(
  t: import('node:test').TestContext,
  files: Record<string, string> = {},
  /** Extra `wwv_flow_imp_shared.create_*` calls appended to the synthetic theme export. */
  extraThemeSql = '',
) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-preview-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const app = path.join(root, 'app');
  for (const [file, content] of Object.entries({ ...APP, ...files })) {
    await mkdir(path.dirname(path.join(app, file)), { recursive: true });
    await writeFile(path.join(app, file), content);
  }
  const zip = path.join(root, 'apex_26.2_en.zip');
  await writeFile(
    zip,
    zipSync({
      'apex/core/themes/f8842.262.sql': strToU8(THEME_SQL + extraThemeSql),
      'apex/images/libraries/apex/minified/desktop_all.min.js': strToU8('window.apex=window.apex||{};'),
      'apex/images/themes/theme_42/26.2/css/Core.min.css': strToU8('.t-Region{}'),
      'apex/images/libraries/monaco-editor/skip.js': strToU8('not extracted'),
    }),
  );
  const assets = path.join(root, 'assets');
  await setupAssets({ assetsDir: assets, zipPath: zip });
  return { root, app, assets, zip };
}
