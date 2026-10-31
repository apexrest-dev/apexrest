import type { DatabaseSync } from 'node:sqlite';
import { bool, get, isObject, ref, str, type ApxComponent, type ApxValue } from '../../apexlang.ts';
import type { ApexRenderer } from '../../render.ts';
import { text } from '../../theme.ts';
import {
  all,
  bySequence,
  hashId,
  now,
  raw,
  refName,
  replaceTable,
  replaceView,
  sharedOf,
  staticIdOf,
  stateTable,
  WORKSPACE,
  WORKSPACE_ID,
  yesNo,
  type Row,
} from './store.ts';

/**
 * APEX dictionary views generated from the loaded APEXlang tree (pages, items, regions, lists,
 * LOVs, themes, build options, authorization, ACL roles, automations, ...) plus the persistent
 * state tables of the platform services and the APEX_* views over them. Rebuilt whenever the
 * preview loads a new renderer, i.e. on start and on every hot reload.
 */

const strings = (value: ApxValue | undefined) =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((entry) => refName(entry));

const lastUpdated = { last_updated_by: 'APEX_LOCAL', last_updated_on: '' };

const COMMON = 'workspace, workspace_display_name, application_id n, application_name';

function walk(components: ApxComponent[], type: string): ApxComponent[] {
  return components.flatMap((component) => [
    ...(component.type === type ? [component] : []),
    ...walk(component.children, type),
  ]);
}

/** Every persistent table of the platform services; created once, kept across restarts. */
export function ensureStateTables(db: DatabaseSync): void {
  stateTable(
    db,
    'apex_local_activity',
    'id n, time_stamp d, application_id n, page_id n, page_name, session_id, user_name, elapsed n, num_rows n, page_mode, request, component_type, component_name, information, sqlerrm, sqlerrm_component_type, sqlerrm_component_name, ir_search, user_agent, ip_address, content_length n',
  );
  stateTable(
    db,
    'apex_local_feedback',
    'feedback_id n, application_id n, page_id n, page_name, session_id, user_name, user_email, feedback, feedback_type n, feedback_rating n, feedback_status n, public_response, developer_comment, tags, attribute_01, attribute_02, attribute_03, attribute_04, attribute_05, attribute_06, attribute_07, attribute_08, label_01, label_02, label_03, label_04, label_05, label_06, label_07, label_08, screen_width n, screen_height n, http_user_agent, created_on d, updated_on d, updated_by',
  );
  stateTable(
    db,
    'apex_local_acl_users',
    'id n, application_id n, user_name, last_updated_by, last_updated_on d',
  );
  stateTable(db, 'apex_local_acl_user_roles', 'user_id n, role_id n');
  stateTable(db, 'apex_local_build_options', 'application_id n, build_option_name, status, updated_by, updated_on d');
  stateTable(db, 'apex_local_app_state', 'application_id n, name, value');
  stateTable(db, 'apex_local_app_settings', 'application_id n, name, value, updated_on d');
  stateTable(db, 'apex_local_preferences', 'session_id, user_name, preference_name, preference_value');
  stateTable(
    db,
    'apex_local_collections',
    'session_id, collection_name, collection_changed, created_on d',
  );
  const members = [
    'session_id',
    'collection_name',
    'seq_id n',
    ...Array.from({ length: 50 }, (_, index) => `c${String(index + 1).padStart(3, '0')}`),
    ...Array.from({ length: 5 }, (_, index) => `n${String(index + 1).padStart(3, '0')} n`),
    ...Array.from({ length: 5 }, (_, index) => `d${String(index + 1).padStart(3, '0')} d`),
    'clob001',
    'blob001',
    'xmltype001',
    'md5_original',
  ].join(', ');
  stateTable(db, 'apex_local_collection_members', members);
  stateTable(
    db,
    'apex_local_mail',
    'id n, application_id n, session_id, user_name, mail_to, mail_from, mail_replyto, mail_cc, mail_bcc, mail_subj, mail_body, mail_body_html, template_static_id, placeholders, status, created_on d, sent_on d, source',
  );
  stateTable(db, 'apex_local_mail_attachments', 'id n, mail_id n, filename, mime_type, size_bytes n, created_on d');
  stateTable(
    db,
    'apex_local_rest_log',
    'id n, application_id n, session_id, source, method, url, fixture, status_code n, request_body, response_body, note, created_on d',
  );
  stateTable(
    db,
    'apex_local_workflows',
    'workflow_id n, application_id n, workflow_def_static_id, workflow_def_name, title, detail_pk, initiator, state_code, parameters, session_id, created_on d, last_updated_on d',
  );
  stateTable(
    db,
    'apex_local_tasks',
    'task_id n, application_id n, task_def_static_id, task_def_name, subject, detail_pk, initiator, actual_owner, potential_owners, priority n, state_code, outcome_code, parameters, workflow_id n, due_on d, created_on d, last_updated_by, last_updated_on d',
  );
  stateTable(db, 'apex_local_task_comments', 'id n, task_id n, text, created_by, created_on d');
  stateTable(
    db,
    'apex_local_automation_log',
    'id n, application_id n, automation_static_id, automation_name, is_job, status, start_timestamp d, end_timestamp d, successful_row_count n, error_row_count n',
  );
  stateTable(db, 'apex_local_automation_msg_log', 'id n, automation_log_id n, message_timestamp d, message_type, message, pk_value');
}

// ------------------------------------------------------------------ metadata rows

interface Context {
  renderer: ApexRenderer;
  base: Row;
  appId: string;
}

function pageRows(context: Context) {
  const { renderer, base } = context;
  const pages: Row[] = [];
  const items: Row[] = [];
  const regions: Row[] = [];
  const buttons: Row[] = [];
  for (const page of [...renderer.app.pages.values()].sort((a, b) => Number(a.id) - Number(b.id))) {
    const props = page.props;
    const pageBase = { ...base, page_id: Number(page.id), page_name: str(props, 'name', page.id) };
    pages.push({
      ...pageBase,
      page_title: str(props, 'title') || str(props, 'name'),
      page_alias: str(props, 'alias').toUpperCase(),
      page_mode: { modalDialog: 'Modal Dialog', nonModalDialog: 'Non-Modal Dialog', drawer: 'Drawer' }[
        str(props, 'appearance.pageMode') as 'modalDialog'
      ] ?? 'Normal',
      page_group: ref(props, 'pageGroup') ?? '',
      page_template: ref(props, 'appearance.pageTemplate') ?? 'Theme Default',
      help_text: str(props, 'help.helpText'),
      authorization_scheme: refName(get(props, 'security.authorizationScheme')),
      page_requires_authentication: str(props, 'security.authentication') === 'publicPage' ? 'No' : 'Yes',
      build_option: refName(get(props, 'config.buildOption')),
      page_comment: str(props, 'comments.comments'),
      page_css_classes: strings(get(props, 'appearance.cssClasses')).join(' '),
      ...lastUpdated,
      last_updated_on: now(),
    });
    for (const region of walk(page.children, 'region')) {
      const source = isObject(region.props.source) ? region.props.source : {};
      const parent = ref(region.props, 'layout.parentRegion');
      regions.push({
        ...pageBase,
        region_id: hashId(context.appId, page.id, 'region', region.id),
        region_name: str(region.props, 'name', region.id),
        static_id: str(region.props, 'advanced.staticId') || region.id,
        source_type: str(region.props, 'type'),
        source_type_code: str(region.props, 'type').toUpperCase(),
        display_sequence: Number(get(region.props, 'layout.sequence') ?? 0),
        display_position: str(region.props, 'layout.slot'),
        template: refName(get(region.props, 'appearance.template')),
        parent_region_id: parent ? hashId(context.appId, page.id, 'region', parent) : null,
        location: str(source, 'location'),
        query_type: str(source, 'type'),
        table_name: str(source, 'tableName'),
        region_source: str(source, 'sqlQuery') || str(source, 'plsqlCode') || str(source, 'htmlCode'),
        authorization_scheme: refName(get(region.props, 'security.authorizationScheme')),
        build_option: refName(get(region.props, 'config.buildOption')),
        component_comment: str(region.props, 'comments.comments'),
        ...lastUpdated,
      });
    }
    for (const item of walk(page.children, 'pageItem')) {
      const region = ref(item.props, 'layout.region');
      items.push({
        ...pageBase,
        item_id: hashId(context.appId, page.id, 'item', item.id),
        item_name: item.id.toUpperCase(),
        display_sequence: Number(get(item.props, 'layout.sequence') ?? 0),
        region: region ?? '',
        region_id: region ? hashId(context.appId, page.id, 'region', region) : null,
        label: str(item.props, 'label.label'),
        display_as: str(item.props, 'type'),
        display_as_code: `NATIVE_${str(item.props, 'type').replace(/([a-z])([A-Z])/gu, '$1_$2').toUpperCase()}`,
        item_default: str(item.props, 'default.staticValue'),
        item_source_type: str(item.props, 'source.type'),
        item_source: str(item.props, 'source.column') || str(item.props, 'source.item'),
        lov_named_lov: refName(get(item.props, 'lov.lov')),
        format_mask: str(item.props, 'appearance.formatMask'),
        item_help_text: str(item.props, 'help.helpText'),
        is_required: yesNo(bool(item.props, 'validation.valueRequired', false)),
        build_option: refName(get(item.props, 'config.buildOption')),
        component_comment: str(item.props, 'comments.comments'),
        ...lastUpdated,
      });
    }
    for (const button of walk(page.children, 'button')) {
      buttons.push({
        ...pageBase,
        button_id: hashId(context.appId, page.id, 'button', button.id),
        button_name: str(button.props, 'buttonName', button.id.toUpperCase()),
        label: str(button.props, 'label'),
        button_sequence: Number(get(button.props, 'layout.sequence') ?? 0),
        region: ref(button.props, 'layout.region') ?? '',
        button_action: str(button.props, 'behavior.action'),
        ...lastUpdated,
      });
    }
  }
  return { pages, items, regions, buttons };
}

function listRows(context: Context) {
  const { renderer, base, appId } = context;
  const lists: Row[] = [];
  const entries: Row[] = [];
  for (const component of sharedOf(renderer, 'list')) {
    const listId = hashId(appId, 'list', component.id);
    let count = 0;
    const visit = (children: ApxComponent[], parent: number | null, level: number) => {
      for (const entry of bySequence(children.filter((child) => child.type === 'entry'))) {
        count += 1;
        const id = hashId(appId, 'list', component.id, entry.id);
        const target = get(entry.props, 'link.target');
        const attributes = isObject(entry.props.userDefinedAttributes) ? entry.props.userDefinedAttributes : {};
        entries.push({
          ...base,
          list_id: listId,
          list_name: str(component.props, 'name', component.id),
          list_entry_id: id,
          list_entry_parent_id: parent,
          display_sequence: Number(get(entry.props, 'layout.sequence') ?? 0),
          entry_text: str(entry.props, 'label'),
          entry_target: isObject(target)
            ? str(target, 'url') || (str(target, 'page') ? `f?p=&APP_ID.:${str(target, 'page')}:&SESSION.` : '')
            : typeof target === 'string'
              ? target
              : '',
          entry_image: str(entry.props, 'icon.imageIconCssClasses'),
          level,
          ...Object.fromEntries(
            Array.from({ length: 10 }, (_, index) => [
              `entry_attribute_${String(index + 1).padStart(2, '0')}`,
              str(attributes, String(index + 1)),
            ]),
          ),
          authorization_scheme: refName(get(entry.props, 'security.authorizationScheme')),
          build_option: refName(get(entry.props, 'config.buildOption')),
          condition_type: str(entry.props, 'serverSideCondition.type'),
          ...lastUpdated,
        });
        visit(entry.children, id, level + 1);
      }
    };
    visit(component.children, null, 1);
    lists.push({
      ...base,
      list_id: listId,
      list_name: str(component.props, 'name', component.id),
      static_id: component.id,
      list_type: str(component.props, 'source.type', 'static'),
      list_entries: count,
      build_option: refName(get(component.props, 'config.buildOption')),
      component_comment: str(component.props, 'comments.comments'),
      ...lastUpdated,
    });
  }
  return { lists, entries };
}

function lovRows(context: Context) {
  const { renderer, base, appId } = context;
  const lovs: Row[] = [];
  const entries: Row[] = [];
  for (const component of sharedOf(renderer, 'lov')) {
    const lovId = hashId(appId, 'lov', component.id);
    const name = str(component.props, 'name', component.id);
    const children = bySequence(component.children.filter((child) => child.type === 'entry'));
    const sql = str(component.props, 'source.sqlQuery');
    lovs.push({
      ...base,
      lov_id: lovId,
      list_of_values_name: name,
      static_id: component.id,
      lov_type: children.length ? 'Static' : 'Dynamic',
      source_type: str(component.props, 'source.location', sql ? 'localDatabase' : 'staticValues'),
      list_of_values_query: sql,
      return_column_name: str(component.props, 'columnMapping.return'),
      display_column_name: str(component.props, 'columnMapping.display'),
      lov_entries: children.length,
      component_comment: str(component.props, 'comments.comments'),
      ...lastUpdated,
    });
    for (const entry of children) {
      entries.push({
        ...base,
        lov_id: lovId,
        list_of_values_name: name,
        lov_entry_id: hashId(appId, 'lov', component.id, entry.id),
        display_sequence: Number(get(entry.props, 'sequence') ?? 0),
        display_value: str(entry.props, 'display'),
        return_value: str(entry.props, 'return'),
        template: str(entry.props, 'template'),
        condition_type: str(entry.props, 'serverSideCondition.type'),
        build_option: refName(get(entry.props, 'config.buildOption')),
        ...lastUpdated,
      });
    }
  }
  return { lovs, entries };
}

/** The application's theme styles: from APEXlang `style` children, else from the theme export. */
export function themeStyles(renderer: ApexRenderer): { id: string; key: string; name: string; isPublic: boolean }[] {
  const theme = renderer.themeComponent();
  const own = theme?.children.filter((child) => child.type === 'style') ?? [];
  if (own.length)
    return own.map((style) => ({
      id: style.id,
      key: (ref(style.props, 'subscription.master') ?? style.id).toLowerCase(),
      name: str(style.props, 'name', style.id),
      isPublic: bool(style.props, 'advanced.endUserCanPick', false),
    }));
  return [...renderer.theme.styles.entries()].map(([key, style]) => ({
    id: key,
    key,
    name: text(style, 'name') || key,
    isPublic: true,
  }));
}

export const themeNumber = (renderer: ApexRenderer) =>
  Number(str(renderer.themeComponent()?.props ?? {}, 'themeNumber', '42')) || 42;

function themeRows(context: Context) {
  const { renderer, base, appId } = context;
  const theme = renderer.themeComponent();
  const number = themeNumber(renderer);
  const themes = [
    {
      ...base,
      theme_number: number,
      theme_name: str(theme?.props ?? {}, 'name', 'Universal Theme'),
      ui_type_name: 'DESKTOP',
      is_current: 'Yes',
      navigation_type: 'List',
      file_prefix: str(theme?.props ?? {}, 'advanced.filePrefix', '#APEX_FILES#themes/theme_42/26.2/'),
      theme_identifier: str(theme?.props ?? {}, 'advanced.identifier', 'UNIVERSAL_THEME'),
      icon_library: str(theme?.props ?? {}, 'icons.library', 'fontApex'),
      ...lastUpdated,
    },
  ];
  const styles = themeStyles(renderer).map((style) => ({
    ...base,
    theme_number: number,
    theme_style_id: hashId(appId, 'style', style.key),
    name: style.name,
    static_id: style.key,
    is_public: yesNo(style.isPublic),
    is_accessible: 'Yes',
    theme_roller_read_only: 'Yes',
    ...lastUpdated,
  }));
  const interfaces = [
    {
      ...base,
      user_interface_id: hashId(appId, 'ui'),
      ui_type_name: 'DESKTOP',
      display_name: 'Desktop',
      theme_number: number,
      home_url: '',
      login_url: '',
      navigation_list: refName(get(renderer.app.app.props, 'navigationMenu.list')),
      nav_bar_list: refName(get(renderer.app.app.props, 'navigationBar.list')),
    },
  ];
  return { themes, styles, interfaces };
}

function sharedRows(context: Context) {
  const { renderer, base, appId } = context;
  const app = renderer.app.app.props;
  const buildOptions = sharedOf(renderer, 'buildOption').map((option) => ({
    ...base,
    build_option_id: hashId(appId, 'buildOption', option.id),
    build_option_name: str(option.props, 'name', option.id),
    static_id: option.id,
    default_status: str(option.props, 'status.status', 'exclude') === 'include' ? 'Include' : 'Exclude',
    default_on_export: str(option.props, 'status.defaultOnExport'),
    on_upgrade_keep_status: yesNo(bool(option.props, 'status.onUpgradeKeepStatus', false)),
    feature_identifier: str(option.props, 'advanced.featureIdentifier'),
    component_comment: str(option.props, 'comments.comments'),
  }));
  const authorizations = sharedOf(renderer, 'authorization').map((scheme) => ({
    ...base,
    authorization_scheme_id: hashId(appId, 'authorization', scheme.id),
    authorization_scheme_name: str(scheme.props, 'name', scheme.id),
    static_id: scheme.id,
    scheme_type: str(scheme.props, 'type'),
    scheme_type_code: str(scheme.props, 'type').replace(/([a-z])([A-Z])/gu, '$1_$2').toUpperCase(),
    attribute_01:
      str(scheme.props, 'settings.plsqlFunctionBody') ||
      str(scheme.props, 'settings.sqlQuery') ||
      strings(get(scheme.props, 'settings.names')).join(','),
    error_message: str(scheme.props, 'error.errorMessage'),
    caching: str(scheme.props, 'evaluationPoint.evaluationType') || str(scheme.props, 'evaluationType'),
    component_comment: str(scheme.props, 'comments.comments'),
    ...lastUpdated,
  }));
  const current = ref(app, 'authentication.scheme');
  const authentications = sharedOf(renderer, 'authentication').map((scheme) => ({
    ...base,
    authentication_scheme_id: hashId(appId, 'authentication', scheme.id),
    authentication_scheme_name: str(scheme.props, 'name', scheme.id),
    scheme_type: str(scheme.props, 'type'),
    scheme_type_code: `NATIVE_${str(scheme.props, 'type')
      .replace(/^oracleApexAccounts$/u, 'apexAccounts')
      .replace(/([a-z])([A-Z])/gu, '$1_$2')
      .toUpperCase()}`,
    is_current_authentication: scheme.id === current ? 'Y' : 'N',
    ...lastUpdated,
  }));
  const appItems = sharedOf(renderer, 'appItem').map((item) => ({
    ...base,
    application_item_id: hashId(appId, 'appItem', item.id),
    item_name: item.id.toUpperCase(),
    data_type: str(item.props, 'dataType', 'varchar2').toUpperCase(),
    scope: str(item.props, 'scope', 'application'),
    session_state_protection: str(item.props, 'security.sessionStateProtection'),
    build_option: refName(get(item.props, 'config.buildOption')),
    item_comment: str(item.props, 'comments.comments'),
    ...lastUpdated,
  }));
  const roles = sharedOf(renderer, 'role').map((role) => ({
    ...base,
    role_id: hashId(appId, 'role', role.id.toUpperCase()),
    role_static_id: role.id.toUpperCase(),
    role_name: str(role.props, 'name', role.id),
    role_desc: str(role.props, 'description.description'),
    ...lastUpdated,
  }));
  const settings = sharedOf(renderer, 'appSetting').map((setting) => ({
    ...base,
    application_setting_id: hashId(appId, 'appSetting', setting.id),
    name: (str(setting.props, 'staticId') || setting.id).toUpperCase(),
    default_value: str(setting.props, 'value.staticValue'),
    is_required: yesNo(bool(setting.props, 'validation.required', false)),
    valid_values: str(setting.props, 'validation.validValues'),
    on_upgrade_keep_value: yesNo(bool(setting.props, 'value.onUpgradeKeepValue', false)),
    build_option: refName(get(setting.props, 'config.buildOption')),
    comments: str(setting.props, 'comments.comments'),
  }));
  const automations = sharedOf(renderer, 'automation').map((automation) => ({
    ...base,
    automation_id: hashId(appId, 'automation', automation.id),
    name: str(automation.props, 'name', automation.id),
    static_id: staticIdOf(automation),
    trigger_type: str(automation.props, 'type') || str(automation.props, 'trigger.type', 'scheduled'),
    trigger_type_code: (str(automation.props, 'type') || str(automation.props, 'trigger.type', 'polling')).toUpperCase(),
    polling_interval: str(automation.props, 'trigger.schedule') || str(automation.props, 'schedule.schedule'),
    polling_status: 'Disabled (local preview)',
    polling_status_code: 'DISABLED',
    result_type: str(automation.props, 'source.location'),
    query_type: str(automation.props, 'source.type'),
    build_option: refName(get(automation.props, 'config.buildOption')),
    ...lastUpdated,
  }));
  const automationActions = sharedOf(renderer, 'automation').flatMap((automation) =>
    bySequence(automation.children.filter((child) => child.type === 'action')).map((action) => ({
      ...base,
      automation_id: hashId(appId, 'automation', automation.id),
      automation_name: str(automation.props, 'name', automation.id),
      action_id: hashId(appId, 'automation', automation.id, action.id),
      action_name: str(action.props, 'name', action.id),
      action_type: str(action.props, 'type'),
      execution_sequence: Number(get(action.props, 'execution.sequence') ?? 0),
    })),
  );
  const emailTemplates = sharedOf(renderer, 'emailTemplate').map((template) => ({
    ...base,
    email_template_id: hashId(appId, 'emailTemplate', template.id),
    name: str(template.props, 'name', template.id),
    static_id: staticIdOf(template),
    subject: str(template.props, 'emailSubject'),
    html_header: str(template.props, 'htmlFormat.header'),
    html_body: str(template.props, 'htmlFormat.body'),
    html_footer: str(template.props, 'htmlFormat.footer'),
    html_template: str(template.props, 'advanced.htmlTemplate'),
    text_template: str(template.props, 'plainTextFormat.content'),
    ...lastUpdated,
  }));
  const workflows = sharedOf(renderer, 'workflow').map((workflow) => ({
    ...base,
    workflow_id: hashId(appId, 'workflow', workflow.id),
    name: str(workflow.props, 'name', workflow.id),
    static_id: staticIdOf(workflow),
    title: str(workflow.props, 'title'),
    ...lastUpdated,
  }));
  const taskDefs = sharedOf(renderer, 'taskDefinition').map((definition) => ({
    ...base,
    task_def_id: hashId(appId, 'taskDefinition', definition.id),
    name: str(definition.props, 'name', definition.id),
    static_id: staticIdOf(definition),
    subject: str(definition.props, 'subject') || str(definition.props, 'settings.subject'),
    task_type: str(definition.props, 'type', 'approvalTask'),
    priority: Number(str(definition.props, 'settings.priority', '3')) || 3,
    ...lastUpdated,
  }));
  const restSources = sharedOf(renderer, 'restDataSource').map((source) => ({
    ...base,
    module_id: hashId(appId, 'restDataSource', source.id),
    module_name: str(source.props, 'name', source.id),
    static_id: staticIdOf(source),
    web_source_type: str(source.props, 'source.type'),
    url_path_prefix: str(source.props, 'source.urlPathPrefix'),
    remote_server: refName(get(source.props, 'source.remoteServer')),
    data_profile_format: str(source.props, 'dataProfile.format', 'json'),
    row_selector: str(source.props, 'dataProfile.rowSelector'),
    ...lastUpdated,
  }));
  return {
    buildOptions,
    authorizations,
    authentications,
    appItems,
    roles,
    settings,
    automations,
    automationActions,
    emailTemplates,
    workflows,
    taskDefs,
    restSources,
  };
}

// ------------------------------------------------------------------ build

const built = new WeakSet<ApexRenderer>();

/** Builds the dictionary once per renderer (start and every hot reload). */
export function ensureDictionary(renderer: ApexRenderer): void {
  if (built.has(renderer)) return;
  built.add(renderer);
  const db = raw(renderer);
  ensureStateTables(db);
  const appId = renderer.appId;
  const app = renderer.app.app.props;
  const base: Row = {
    workspace: WORKSPACE,
    workspace_display_name: WORKSPACE,
    application_id: Number(appId) || appId,
    application_name: str(app, 'name', renderer.app.app.id),
  };
  const context: Context = { renderer, base, appId };
  const { pages, items, regions, buttons } = pageRows(context);
  const { lists, entries } = listRows(context);
  const lovs = lovRows(context);
  const theme = themeRows(context);
  const shared = sharedRows(context);
  const stamp = now();
  const stamped = (rows: Row[]) => rows.map((row) => ({ ...row, last_updated_on: stamp }));
  const own = !db.isTransaction;
  if (own) db.exec('begin');
  try {
    replaceTable(
      db,
      'apex_local_dict_applications',
      `${COMMON}, alias, owner, pages n, theme_number n, home_link, login_url, authentication_scheme, authorization_scheme, build_status, availability_status, version, compatibility_mode, application_group, logo_type, logo_text, created_on d, last_updated_by, last_updated_on d`,
      [
        {
          ...base,
          alias: renderer.alias.toUpperCase(),
          owner: 'APEX_LOCAL',
          pages: renderer.app.pages.size,
          theme_number: themeNumber(renderer),
          home_link: str(app, 'navigation.homeUrl.page') ? `f?p=&APP_ID.:${str(app, 'navigation.homeUrl.page')}:&SESSION.` : '',
          login_url: str(app, 'navigation.loginUrl.page') ? `f?p=&APP_ID.:${str(app, 'navigation.loginUrl.page')}:&SESSION.` : '',
          authentication_scheme: ref(app, 'authentication.scheme') ?? '',
          authorization_scheme: ref(app, 'authorization.scheme') ?? '',
          build_status: 'Run and Develop',
          availability_status: 'Available',
          version: str(app, 'version'),
          compatibility_mode: str(app, 'runtime.compatibilityMode'),
          logo_type: str(app, 'logo.type'),
          logo_text: str(app, 'logo.text'),
          created_on: stamp,
          ...lastUpdated,
          last_updated_on: stamp,
        },
      ],
    );
    replaceView(
      db,
      'APEX_APPLICATIONS',
      `select a.*, coalesce((select s.value from apex_local_app_state s where s.application_id = a.application_id and s.name = 'THEME_STYLE_BY_USER_PREF'), 'No') as theme_style_by_user_pref from apex_local_dict_applications a`,
    );
    replaceTable(
      db,
      'APEX_APPLICATION_PAGES',
      `${COMMON}, page_id n, page_name, page_title, page_alias, page_mode, page_group, page_template, help_text, authorization_scheme, page_requires_authentication, build_option, page_comment, page_css_classes, last_updated_by, last_updated_on d`,
      pages,
    );
    replaceTable(
      db,
      'APEX_APPLICATION_PAGE_REGIONS',
      `${COMMON}, page_id n, page_name, region_id n, region_name, static_id, source_type, source_type_code, display_sequence n, display_position, template, parent_region_id n, location, query_type, table_name, region_source, authorization_scheme, build_option, component_comment, last_updated_by, last_updated_on d`,
      stamped(regions),
    );
    replaceTable(
      db,
      'APEX_APPLICATION_PAGE_ITEMS',
      `${COMMON}, page_id n, page_name, item_id n, item_name, display_sequence n, region, region_id n, label, display_as, display_as_code, item_default, item_source_type, item_source, lov_named_lov, format_mask, item_help_text, is_required, build_option, component_comment, last_updated_by, last_updated_on d`,
      stamped(items),
    );
    replaceTable(
      db,
      'APEX_APPLICATION_PAGE_BUTTONS',
      `${COMMON}, page_id n, page_name, button_id n, button_name, label, button_sequence n, region, button_action, last_updated_by, last_updated_on d`,
      stamped(buttons),
    );
    replaceTable(
      db,
      'APEX_APPLICATION_LISTS',
      `${COMMON}, list_id n, list_name, static_id, list_type, list_entries n, build_option, component_comment, last_updated_by, last_updated_on d`,
      stamped(lists),
    );
    replaceTable(
      db,
      'APEX_APPLICATION_LIST_ENTRIES',
      `${COMMON}, list_id n, list_name, list_entry_id n, list_entry_parent_id n, display_sequence n, entry_text, entry_target, entry_image, level n, ${Array.from({ length: 10 }, (_, index) => `entry_attribute_${String(index + 1).padStart(2, '0')}`).join(', ')}, authorization_scheme, build_option, condition_type, last_updated_by, last_updated_on d`,
      stamped(entries),
    );
    replaceTable(
      db,
      'APEX_APPLICATION_LOVS',
      `${COMMON}, lov_id n, list_of_values_name, static_id, lov_type, source_type, list_of_values_query, return_column_name, display_column_name, lov_entries n, component_comment, last_updated_by, last_updated_on d`,
      stamped(lovs.lovs),
    );
    replaceTable(
      db,
      'APEX_APPLICATION_LOV_ENTRIES',
      `${COMMON}, lov_id n, list_of_values_name, lov_entry_id n, display_sequence n, display_value, return_value, template, condition_type, build_option, last_updated_by, last_updated_on d`,
      stamped(lovs.entries),
    );
    replaceTable(
      db,
      'APEX_APPLICATION_THEMES',
      `${COMMON}, theme_number n, theme_name, ui_type_name, is_current, navigation_type, file_prefix, theme_identifier, icon_library, last_updated_by, last_updated_on d`,
      stamped(theme.themes),
    );
    replaceTable(
      db,
      'apex_local_dict_theme_styles',
      `${COMMON}, theme_number n, theme_style_id n, name, static_id, is_public, is_accessible, theme_roller_read_only, last_updated_by, last_updated_on d`,
      stamped(theme.styles),
    );
    const current = (
      ref(renderer.themeComponent()?.props ?? {}, 'style.currentThemeStyle') ??
      theme.styles[0]?.static_id ??
      'vita'
    ).toLowerCase();
    const currentKey =
      themeStyles(renderer).find((style) => style.id.toLowerCase() === current)?.key ?? current;
    replaceView(
      db,
      'APEX_APPLICATION_THEME_STYLES',
      `select s.*, case when s.static_id = coalesce((select v.value from apex_local_app_state v where v.application_id = s.application_id and v.name = 'CURRENT_THEME_STYLE'), '${currentKey.replaceAll("'", "''")}') then 'Yes' else 'No' end as is_current from apex_local_dict_theme_styles s`,
    );
    replaceTable(
      db,
      'APEX_APPL_USER_INTERFACES',
      `${COMMON}, user_interface_id n, ui_type_name, display_name, theme_number n, home_url, login_url, navigation_list, nav_bar_list`,
      theme.interfaces,
    );
    replaceTable(
      db,
      'apex_local_dict_build_options',
      `${COMMON}, build_option_id n, build_option_name, static_id, default_status, default_on_export, on_upgrade_keep_status, feature_identifier, component_comment`,
      shared.buildOptions,
    );
    replaceView(
      db,
      'APEX_APPLICATION_BUILD_OPTIONS',
      `select b.*, coalesce(o.status, b.default_status) as build_option_status, coalesce(o.updated_by, 'APEX_LOCAL') as last_updated_by, coalesce(o.updated_on, '${stamp}') as last_updated_on from apex_local_dict_build_options b left join apex_local_build_options o on o.application_id = b.application_id and o.build_option_name = b.build_option_name`,
    );
    replaceTable(
      db,
      'APEX_APPLICATION_AUTHORIZATION',
      `${COMMON}, authorization_scheme_id n, authorization_scheme_name, static_id, scheme_type, scheme_type_code, attribute_01, error_message, caching, component_comment, last_updated_by, last_updated_on d`,
      stamped(shared.authorizations),
    );
    replaceTable(
      db,
      'APEX_APPLICATION_AUTH',
      `${COMMON}, authentication_scheme_id n, authentication_scheme_name, scheme_type, scheme_type_code, is_current_authentication, last_updated_by, last_updated_on d`,
      stamped(shared.authentications),
    );
    replaceTable(
      db,
      'APEX_APPLICATION_ITEMS',
      `${COMMON}, application_item_id n, item_name, data_type, scope, session_state_protection, build_option, item_comment, last_updated_by, last_updated_on d`,
      stamped(shared.appItems),
    );
    replaceTable(
      db,
      'APEX_APPL_ACL_ROLES',
      `${COMMON}, role_id n, role_static_id, role_name, role_desc, last_updated_by, last_updated_on d`,
      stamped(shared.roles),
    );
    replaceTable(
      db,
      'apex_local_dict_settings',
      `${COMMON}, application_setting_id n, name, default_value, is_required, valid_values, on_upgrade_keep_value, build_option, comments`,
      shared.settings,
    );
    replaceView(
      db,
      'APEX_APPLICATION_SETTINGS',
      `select s.*, coalesce((select v.value from apex_local_app_settings v where v.application_id = s.application_id and v.name = s.name), s.default_value) as value from apex_local_dict_settings s`,
    );
    replaceTable(
      db,
      'APEX_APPL_AUTOMATIONS',
      `${COMMON}, automation_id n, name, static_id, trigger_type, trigger_type_code, polling_interval, polling_status, polling_status_code, result_type, query_type, build_option, last_updated_by, last_updated_on d`,
      stamped(shared.automations),
    );
    replaceTable(
      db,
      'APEX_APPL_AUTOMATION_ACTIONS',
      `${COMMON}, automation_id n, automation_name, action_id n, action_name, action_type, execution_sequence n`,
      shared.automationActions,
    );
    replaceTable(
      db,
      'APEX_APPL_EMAIL_TEMPLATES',
      `${COMMON}, email_template_id n, name, static_id, subject, html_header, html_body, html_footer, html_template, text_template, last_updated_by, last_updated_on d`,
      stamped(shared.emailTemplates),
    );
    replaceTable(
      db,
      'APEX_APPL_WORKFLOWS',
      `${COMMON}, workflow_id n, name, static_id, title, last_updated_by, last_updated_on d`,
      stamped(shared.workflows),
    );
    replaceTable(
      db,
      'APEX_APPL_TASKDEFS',
      `${COMMON}, task_def_id n, name, static_id, subject, task_type, priority n, last_updated_by, last_updated_on d`,
      stamped(shared.taskDefs),
    );
    replaceTable(
      db,
      'APEX_APPL_WEB_SRC_MODULES',
      `${COMMON}, module_id n, module_name, static_id, web_source_type, url_path_prefix, remote_server, data_profile_format, row_selector, last_updated_by, last_updated_on d`,
      stamped(shared.restSources),
    );
    stateViews(db, base, renderer);
    if (own) db.exec('commit');
  } catch (error) {
    if (own) db.exec('rollback');
    renderer.diagnose('warning', `APEX dictionary views could not be built: ${(error as Error).message}`);
  }
}

const quote = (value: unknown) => `'${String(value ?? '').replaceAll("'", "''")}'`;

/** APEX_* views over the persistent state tables. */
function stateViews(db: DatabaseSync, base: Row, renderer: ApexRenderer): void {
  const appName = quote(base.application_name);
  const ws = quote(WORKSPACE);
  replaceView(
    db,
    'APEX_ACTIVITY_LOG',
    `select a.time_stamp, a.component_type, a.component_name, a.information as component_attribute, a.information, a.elapsed as elap, a.num_rows, a.user_name as userid, lower(a.user_name) as userid_lc, a.ip_address, a.user_agent, a.application_id as flow_id, a.page_id as step_id, a.session_id, a.sqlerrm, a.sqlerrm_component_type, a.sqlerrm_component_name, a.page_mode, a.request as application_info, a.ir_search, null as ir_report_id, null as ws_application_id, null as ws_page_id, null as ws_datagrid_id, a.content_length, null as regions_from_cache, ${WORKSPACE_ID} as security_group_id, null as debug_page_view_id, a.id as id from apex_local_activity a`,
  );
  replaceView(
    db,
    'APEX_WORKSPACE_ACTIVITY_LOG',
    `select ${ws} as workspace, ${WORKSPACE_ID} as workspace_id, a.user_name as apex_user, a.application_id, ${appName} as application_name, 'APEX_LOCAL' as application_schema_owner, a.page_id, a.page_name, a.time_stamp as view_date, a.time_stamp as view_timestamp, null as think_time, cast(strftime('%s','now','localtime') - strftime('%s', a.time_stamp) as integer) as seconds_ago, a.information as log_context, a.elapsed as elapsed_time, a.num_rows as rows_queried, a.ip_address, a.user_agent as agent, a.session_id as apex_session_id, a.sqlerrm as error_message, a.sqlerrm_component_type as error_on_component_type, a.sqlerrm_component_name as error_on_component_name, a.page_mode as page_view_mode, a.request as application_info, null as interactive_report_id, null as ir_saved_report_id, a.ir_search, a.content_length, case a.page_mode when 'P' then 'Partial Page' else 'Rendering' end as page_view_type, a.request as request_value, a.id as id from apex_local_activity a`,
  );
  replaceView(
    db,
    'APEX_TEAM_FEEDBACK',
    `select ${WORKSPACE_ID} as workspace_id, ${ws} as workspace_name, f.feedback_id, f.feedback_id as feedback_number, 'Local preview' as deployment_system, f.feedback, f.public_response, f.developer_comment, coalesce(f.feedback_status, 0) as feedback_status, f.application_id, ${appName} as application_name, null as application_version, f.page_id, f.page_name, f.session_id, f.user_name as apex_user, f.user_email, f.feedback_type, f.feedback_rating, f.tags, f.label_01, f.label_02, f.label_03, f.label_04, f.label_05, f.label_06, f.label_07, f.label_08, f.attribute_01, f.attribute_02, f.attribute_03, f.attribute_04, f.attribute_05, f.attribute_06, f.attribute_07, f.attribute_08, f.screen_width, f.screen_height, f.http_user_agent, '127.0.0.1' as remote_addr, f.user_name as remote_user, 'localhost' as http_host, f.user_name as logged_by_workspace_name, f.created_on, f.user_name as created_by, coalesce(f.updated_on, f.created_on) as updated_on, coalesce(f.updated_by, f.user_name) as updated_by from apex_local_feedback f`,
  );
  replaceView(
    db,
    'APEX_APPL_ACL_USERS',
    `select ${ws} as workspace, ${ws} as workspace_display_name, u.application_id, ${appName} as application_name, u.id, u.user_name, lower(u.user_name) as user_name_lc, (select group_concat(ur.role_id, ':') from apex_local_acl_user_roles ur where ur.user_id = u.id) as role_ids, (select group_concat(r.role_static_id, ':') from apex_local_acl_user_roles ur join APEX_APPL_ACL_ROLES r on r.role_id = ur.role_id where ur.user_id = u.id) as role_static_ids, (select group_concat(r.role_name, ', ') from apex_local_acl_user_roles ur join APEX_APPL_ACL_ROLES r on r.role_id = ur.role_id where ur.user_id = u.id) as role_names, u.last_updated_by, u.last_updated_on from apex_local_acl_users u`,
  );
  // Forms on APEX_APPL_ACL_USERS (the generated "Manage User Access" page) write through these triggers.
  db.exec(`
    create trigger APEX_APPL_ACL_USERS_INS instead of insert on APEX_APPL_ACL_USERS begin
      insert into apex_local_acl_users (id, application_id, user_name, last_updated_by, last_updated_on)
        values (coalesce(new.id, (select coalesce(max(id), 0) + 1 from apex_local_acl_users)), coalesce(new.application_id, ${Number(renderer.appId) || 0}), upper(new.user_name), 'APEX_LOCAL', datetime('now','localtime'));
      insert into apex_local_acl_user_roles (user_id, role_id)
        select (select max(id) from apex_local_acl_users where upper(user_name) = upper(new.user_name)), j.value
        from json_each('[' || replace(coalesce(new.role_ids, ''), ':', ',') || ']') j;
    end;
    create trigger APEX_APPL_ACL_USERS_UPD instead of update on APEX_APPL_ACL_USERS begin
      update apex_local_acl_users set user_name = upper(new.user_name), last_updated_on = datetime('now','localtime') where id = old.id;
      delete from apex_local_acl_user_roles where user_id = old.id;
      insert into apex_local_acl_user_roles (user_id, role_id)
        select old.id, j.value from json_each('[' || replace(coalesce(new.role_ids, ''), ':', ',') || ']') j;
    end;
    create trigger APEX_APPL_ACL_USERS_DEL instead of delete on APEX_APPL_ACL_USERS begin
      delete from apex_local_acl_user_roles where user_id = old.id;
      delete from apex_local_acl_users where id = old.id;
    end;
  `);
  replaceView(
    db,
    'APEX_APPL_ACL_USER_ROLES',
    `select ${ws} as workspace, ${ws} as workspace_display_name, u.application_id, ${appName} as application_name, u.id as user_id, u.user_name, lower(u.user_name) as user_name_lc, r.role_id, r.role_static_id, r.role_name, u.last_updated_by, u.last_updated_on from apex_local_acl_users u join apex_local_acl_user_roles ur on ur.user_id = u.id join APEX_APPL_ACL_ROLES r on r.role_id = ur.role_id`,
  );
  const cols = [
    ...Array.from({ length: 50 }, (_, index) => `c${String(index + 1).padStart(3, '0')}`),
    'clob001',
    'blob001',
    'xmltype001',
    ...Array.from({ length: 5 }, (_, index) => `n${String(index + 1).padStart(3, '0')}`),
    ...Array.from({ length: 5 }, (_, index) => `d${String(index + 1).padStart(3, '0')}`),
  ].join(', ');
  replaceView(
    db,
    'APEX_COLLECTIONS',
    `select collection_name, seq_id, ${cols}, md5_original from apex_local_collection_members where session_id = v('APP_SESSION')`,
  );
  replaceView(
    db,
    'APEX_MAIL_QUEUE',
    `select id, 0 as mail_send_count, null as mail_send_error, coalesce(sent_on, created_on) as last_updated_on, user_name as last_updated_by, mail_to, mail_from, mail_replyto, mail_subj, mail_cc, mail_bcc, mail_body, mail_body_html, template_static_id as mail_template, created_on as mail_message_created, application_id as app_id from apex_local_mail where status = 'QUEUED'`,
  );
  replaceView(
    db,
    'APEX_MAIL_LOG',
    `select id as mail_id, mail_to, mail_from, mail_replyto, mail_subj, mail_cc, mail_bcc, created_on as mail_message_created, sent_on as mail_message_send_begin, sent_on as mail_message_send_end, user_name as last_updated_by, sent_on as last_updated_on, application_id as app_id, template_static_id as mail_template from apex_local_mail where status = 'SENT'`,
  );
  replaceView(
    db,
    'APEX_MAIL_ATTACHMENTS',
    `select id, mail_id, filename, mime_type, size_bytes as attachment_size, created_on as last_updated_on from apex_local_mail_attachments`,
  );
  replaceView(
    db,
    'APEX_WORKSPACE_PREFERENCES',
    `select ${ws} as workspace, ${WORKSPACE_ID} as workspace_id, user_name, rowid as preference_id, preference_name, preference_value from apex_local_preferences where session_id = v('APP_SESSION')`,
  );
  const state = (column: string) =>
    `case ${column} when 'ASSIGNED' then 'Assigned' when 'UNASSIGNED' then 'Unassigned' when 'COMPLETED' then 'Completed' when 'CANCELLED' then 'Canceled' when 'ERRORED' then 'Errored' when 'EXPIRED' then 'Expired' when 'INFO_REQUESTED' then 'Information Requested' else ${column} end`;
  replaceView(
    db,
    'APEX_TASKS',
    `select t.task_id, (select d.task_def_id from APEX_APPL_TASKDEFS d where d.static_id = t.task_def_static_id) as task_def_id, t.task_def_name, t.task_def_static_id, t.task_type, t.subject, t.application_id as details_app_id, null as details_link_target, t.due_on, null as due_in, null as due_in_hours, t.priority, case t.priority when 1 then 'Urgent' when 2 then 'High' when 3 then 'Medium' when 4 then 'Low' else 'Lowest' end as priority_level, t.initiator, lower(t.initiator) as initiator_lower, t.actual_owner, lower(t.actual_owner) as actual_owner_lower, t.potential_owners, t.state_code, ${state('t.state_code')} as state, case when t.state_code in ('COMPLETED','CANCELLED','ERRORED','EXPIRED') then 'Y' else 'N' end as is_completed, t.outcome_code, initcap(t.outcome_code) as outcome, t.detail_pk, t.parameters, t.workflow_id, t.initiator as created_by, t.created_on, t.last_updated_by, t.last_updated_on, t.application_id, ${appName} as application_name, ${ws} as workspace from (select x.*, 'APPROVAL' as task_type from apex_local_tasks x) t`,
  );
  replaceView(
    db,
    'APEX_TASK_COMMENTS',
    `select id as comment_id, task_id, text, created_by, created_on from apex_local_task_comments`,
  );
  replaceView(
    db,
    'APEX_WORKFLOWS',
    `select w.workflow_id, (select d.workflow_id from APEX_APPL_WORKFLOWS d where d.static_id = w.workflow_def_static_id) as workflow_def_id, w.workflow_def_name, w.workflow_def_static_id, w.title, w.detail_pk, w.initiator, lower(w.initiator) as initiator_lower, w.state_code, initcap(w.state_code) as state, w.parameters, w.created_on as start_time, w.created_on, w.initiator as created_by, w.last_updated_on, w.application_id, ${appName} as application_name, ${ws} as workspace from apex_local_workflows w`,
  );
  replaceView(
    db,
    'APEX_AUTOMATION_LOG',
    `select l.id, ${ws} as workspace, l.application_id, ${appName} as application_name, a.automation_id, l.automation_name, l.automation_static_id, l.is_job, l.status, l.start_timestamp, l.end_timestamp, l.successful_row_count, l.error_row_count from apex_local_automation_log l left join APEX_APPL_AUTOMATIONS a on a.static_id = l.automation_static_id`,
  );
  replaceView(
    db,
    'APEX_AUTOMATION_MSG_LOG',
    `select id, automation_log_id, message_timestamp, message_type, message, pk_value from apex_local_automation_msg_log`,
  );
  replaceView(
    db,
    'APEX_WORKSPACE_APEX_USERS',
    `select ${ws} as workspace_name, ${WORKSPACE_ID} as workspace_id, u.user_name, lower(u.user_name) as first_name, null as last_name, lower(u.user_name) || '@localhost' as email, 'Yes' as is_admin, 'Yes' as is_application_developer, 'No' as account_locked, u.last_updated_on as date_created, u.last_updated_on as last_login from apex_local_acl_users u`,
  );
}

/** The first user of a preview session becomes an ACL member with ADMINISTRATOR (or every role). */
export function seedUser(renderer: ApexRenderer, user: string): void {
  const db = raw(renderer);
  const appId = Number(renderer.appId) || 0;
  const seeded = db.prepare('select count(*) as n from apex_local_acl_users where application_id = ?').get(appId) as {
    n: number;
  };
  if (seeded.n > 0) return;
  const roles = all(db, 'select role_id, role_static_id from APEX_APPL_ACL_ROLES');
  if (!roles.length) return;
  const id = Number(
    (db.prepare('select coalesce(max(id), 0) + 1 as id from apex_local_acl_users').get() as { id: number }).id,
  );
  db.prepare(
    "insert into apex_local_acl_users (id, application_id, user_name, last_updated_by, last_updated_on) values (?, ?, ?, 'APEX_LOCAL', datetime('now','localtime'))",
  ).run(id, appId, user.toUpperCase());
  const admin = roles.filter((role) => role.role_static_id === 'ADMINISTRATOR');
  for (const role of admin.length ? admin : roles)
    db.prepare('insert into apex_local_acl_user_roles (user_id, role_id) values (?, ?)').run(id, role.role_id as number);
}
