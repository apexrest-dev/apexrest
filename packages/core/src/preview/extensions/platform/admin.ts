import { str } from '../../apexlang.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import type { Runtime, Stub, StubArgs } from '../server/apex-api.ts';
import { aclCheck } from '../devtools/view-as.ts';
import { PlsqlException } from '../server/plsql.ts';
import { ensureDictionary, themeStyles } from './dictionary.ts';
import { all, findShared, hashId, insertRow, now, one, raw, sharedOf, staticIdOf } from './store.ts';

/**
 * Administration services behind the generated admin pages: activity log, team feedback,
 * access control (ACL), build options, theme styles, application settings and user preferences.
 */

const appIdOf = (renderer: ApexRenderer) => Number(renderer.appId) || 0;
const textOf = (value: unknown) =>
  value === null || value === undefined || value === '' ? null : String(value);

function runtime(rt: Runtime | undefined): Runtime | undefined {
  if (rt) ensureDictionary(rt.renderer);
  return rt;
}

// ------------------------------------------------------------------ activity log

const started = new WeakMap<RenderContext, number>();
export const markStart = (ctx: RenderContext) => started.set(ctx, Date.now());

/** One APEX_ACTIVITY_LOG row per page view ('D') or submit ('P'). */
export function logActivity(renderer: ApexRenderer, ctx: RenderContext, mode: 'D' | 'P'): void {
  ensureDictionary(renderer);
  const begun = started.get(ctx) ?? Date.now();
  const errors = ctx.session.errors?.map((error) => error.message).join('; ');
  insertRow(raw(renderer), 'apex_local_activity', {
    id: Number(one(raw(renderer), 'select coalesce(max(id), 0) + 1 as id from apex_local_activity')?.id ?? 1),
    time_stamp: now(),
    application_id: appIdOf(renderer),
    page_id: Number(ctx.pageId),
    page_name: str(ctx.page.props, 'name', ctx.pageId),
    session_id: ctx.session.id,
    user_name: ctx.session.user,
    elapsed: Math.max(0, (Date.now() - begun) / 1000),
    page_mode: mode,
    request: ctx.request || null,
    component_type: mode === 'P' ? 'PAGE_SUBMIT' : null,
    sqlerrm: errors || null,
    sqlerrm_component_type: errors ? 'PAGE' : null,
    sqlerrm_component_name: errors ? str(ctx.page.props, 'name', ctx.pageId) : null,
    user_agent: 'APEXlang local preview',
    ip_address: '127.0.0.1',
  });
}

// ------------------------------------------------------------------ ACL

function roleIds(rt: Runtime, args: StubArgs): number[] {
  const db = raw(rt.renderer);
  const ids: number[] = [];
  const add = (value: unknown) => {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value)) return value.forEach(add);
    ids.push(Number(value));
  };
  add(args.p_role_id);
  add(args.p_role_ids);
  const statics: unknown[] = [];
  const addStatic = (value: unknown) => {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value)) return value.forEach(addStatic);
    statics.push(value);
  };
  addStatic(args.p_role_static_id);
  addStatic(args.p_role_static_ids);
  for (const id of statics) {
    const row = one(
      db,
      'select role_id from APEX_APPL_ACL_ROLES where upper(role_static_id) = upper(?)',
      String(id),
    );
    if (!row) throw new PlsqlException('ora-20987', -20987, `Role ${String(id)} does not exist`, 'app');
    ids.push(Number(row.role_id));
  }
  return ids.filter((id) => !Number.isNaN(id));
}

function userId(rt: Runtime, user: unknown, create: boolean): number | undefined {
  const db = raw(rt.renderer);
  const name = String(user ?? rt.ctx.session.user).toUpperCase();
  const row = one(
    db,
    'select id from apex_local_acl_users where application_id = ? and upper(user_name) = ?',
    appIdOf(rt.renderer),
    name,
  );
  if (row) return Number(row.id);
  if (!create) return undefined;
  const id = Number(one(db, 'select coalesce(max(id), 0) + 1 as id from apex_local_acl_users')?.id ?? 1);
  insertRow(db, 'apex_local_acl_users', {
    id,
    application_id: appIdOf(rt.renderer),
    user_name: name,
    last_updated_by: rt.ctx.session.user,
    last_updated_on: now(),
  });
  return id;
}

function userRoles(rt: Runtime, user: unknown): { id: number; staticId: string }[] {
  const id = userId(rt, user, false);
  if (id === undefined) return [];
  return all(
    raw(rt.renderer),
    'select r.role_id, r.role_static_id from apex_local_acl_user_roles ur join APEX_APPL_ACL_ROLES r on r.role_id = ur.role_id where ur.user_id = ?',
    id,
  ).map((row) => ({ id: Number(row.role_id), staticId: String(row.role_static_id) }));
}

/**
 * Role checks for the signed-in user stay with the developer toolbar's "view as" (permissive by
 * default, devtools/view-as.ts); checks for other users answer from the local ACL tables.
 */
const isCurrentUser = (rt: Runtime, user: unknown) =>
  user === null || user === undefined || String(user).toUpperCase() === rt.ctx.session.user.toUpperCase();

const aclParams = ['p_application_id', 'p_user_name', 'p_role_id', 'p_role_static_id'];

function setRoles(rt: Runtime, args: StubArgs, mode: 'add' | 'remove' | 'replace'): null {
  const db = raw(rt.renderer);
  const ids = roleIds(rt, args);
  const user = userId(rt, args.p_user_name, mode !== 'remove');
  if (user === undefined) return null;
  if (mode === 'replace') db.prepare('delete from apex_local_acl_user_roles where user_id = ?').run(user);
  for (const id of ids) {
    db.prepare('delete from apex_local_acl_user_roles where user_id = ? and role_id = ?').run(user, id);
    if (mode !== 'remove')
      db.prepare('insert into apex_local_acl_user_roles (user_id, role_id) values (?, ?)').run(user, id);
  }
  db.prepare('update apex_local_acl_users set last_updated_on = ?, last_updated_by = ? where id = ?').run(
    now(),
    rt.ctx.session.user,
    user,
  );
  return null;
}

// ------------------------------------------------------------------ app state

export function appState(renderer: ApexRenderer, name: string): string | undefined {
  ensureDictionary(renderer);
  const row = one(
    raw(renderer),
    'select value from apex_local_app_state where application_id = ? and name = ?',
    appIdOf(renderer),
    name,
  );
  return row ? String(row.value ?? '') : undefined;
}

function setAppState(renderer: ApexRenderer, name: string, value: string | null): void {
  const db = raw(renderer);
  db.prepare('delete from apex_local_app_state where application_id = ? and name = ?').run(
    appIdOf(renderer),
    name,
  );
  if (value !== null)
    insertRow(db, 'apex_local_app_state', { application_id: appIdOf(renderer), name, value });
}

/** Static ID (lower case) of a theme style given its numeric ID, static ID or name. */
function styleKey(renderer: ApexRenderer, value: unknown): string | undefined {
  const key = String(value ?? '').toLowerCase();
  return themeStyles(renderer).find(
    (style) =>
      String(hashId(renderer.appId, 'style', style.key)) === key ||
      style.key === key ||
      style.id.toLowerCase() === key ||
      style.name.toLowerCase() === key,
  )?.key;
}

// ------------------------------------------------------------------ settings and preferences

function settingValue(rt: Runtime, name: string): string | null {
  const db = raw(rt.renderer);
  const override = one(
    db,
    'select value from apex_local_app_settings where application_id = ? and name = ?',
    appIdOf(rt.renderer),
    name,
  );
  if (override) return textOf(override.value);
  const setting = sharedOf(rt.renderer, 'appSetting').find(
    (component) => (str(component.props, 'staticId') || component.id).toUpperCase() === name,
  );
  if (!setting) return null;
  return textOf(str(setting.props, 'value.staticValue') || str(setting.props, 'staticValue'));
}

const prefUser = (rt: Runtime, args: StubArgs) => String(args.p_user ?? rt.ctx.session.user).toUpperCase();

export function getPreference(renderer: ApexRenderer, ctx: RenderContext, name: string): string | null {
  ensureDictionary(renderer);
  const row = one(
    raw(renderer),
    'select preference_value as v from apex_local_preferences where session_id = ? and user_name = ? and preference_name = ?',
    ctx.session.id,
    ctx.session.user.toUpperCase(),
    name.toUpperCase(),
  );
  return row ? textOf(row.v) : null;
}

export function setPreference(
  renderer: ApexRenderer,
  ctx: RenderContext,
  name: string,
  value: string | null,
  user?: string,
): void {
  ensureDictionary(renderer);
  const db = raw(renderer);
  const owner = (user ?? ctx.session.user).toUpperCase();
  db.prepare(
    'delete from apex_local_preferences where session_id = ? and user_name = ? and preference_name = ?',
  ).run(ctx.session.id, owner, name.toUpperCase());
  if (value !== null)
    insertRow(db, 'apex_local_preferences', {
      session_id: ctx.session.id,
      user_name: owner,
      preference_name: name.toUpperCase(),
      preference_value: value,
    });
}

export function resetPreferences(renderer: ApexRenderer, ctx: RenderContext): void {
  ensureDictionary(renderer);
  raw(renderer)
    .prepare('delete from apex_local_preferences where session_id = ? and user_name = ?')
    .run(ctx.session.id, ctx.session.user.toUpperCase());
}

// ------------------------------------------------------------------ stubs

const feedbackParams = [
  'p_comment',
  'p_type',
  'p_application_id',
  'p_page_id',
  'p_email',
  'p_screen_width',
  'p_screen_height',
  'p_attribute_01',
  'p_attribute_02',
  'p_attribute_03',
  'p_attribute_04',
  'p_attribute_05',
  'p_attribute_06',
  'p_attribute_07',
  'p_attribute_08',
  'p_label_01',
  'p_label_02',
  'p_label_03',
  'p_label_04',
  'p_label_05',
  'p_label_06',
  'p_label_07',
  'p_label_08',
  'p_rating',
];

function submitFeedback(args: StubArgs, rt: Runtime | undefined): number | null {
  if (!runtime(rt)) return null;
  const renderer = rt!.renderer;
  const db = raw(renderer);
  const pageId = String(args.p_page_id ?? rt!.ctx.pageId);
  const page = renderer.findPage(pageId);
  const id = Number(
    one(db, 'select coalesce(max(feedback_id), 0) + 1 as id from apex_local_feedback')?.id ?? 1,
  );
  const row: Record<string, unknown> = {
    feedback_id: id,
    application_id: Number(args.p_application_id ?? renderer.appId) || appIdOf(renderer),
    page_id: Number(pageId) || null,
    page_name: page ? str(page.props, 'name', page.id) : null,
    session_id: rt!.ctx.session.id,
    user_name: rt!.ctx.session.user,
    user_email: textOf(args.p_email),
    feedback: textOf(args.p_comment),
    feedback_type: Number(args.p_type ?? 1) || 1,
    feedback_rating: args.p_rating === null || args.p_rating === undefined ? null : Number(args.p_rating),
    feedback_status: 0,
    screen_width: args.p_screen_width ?? null,
    screen_height: args.p_screen_height ?? null,
    http_user_agent: 'APEXlang local preview',
    created_on: now(),
  };
  for (let index = 1; index <= 8; index += 1) {
    const key = String(index).padStart(2, '0');
    row[`attribute_${key}`] = textOf(args[`p_attribute_${key}`]);
    row[`label_${key}`] = textOf(args[`p_label_${key}`]);
  }
  insertRow(db, 'apex_local_feedback', row);
  rt!.note('info', `Feedback ${id} stored locally (APEX_TEAM_FEEDBACK)`);
  return id;
}

export const ADMIN_STUBS: Record<string, Stub> = {
  // feedback
  'apex_util.submit_feedback': { params: feedbackParams, fn: (args, rt) => (submitFeedback(args, rt), null) },
  'apex_util.submit_feedback_followup': {
    params: ['p_feedback_id', 'p_follow_up', 'p_email'],
    fn: (args, rt) => {
      if (!runtime(rt)) return null;
      raw(rt!.renderer)
        .prepare(
          "update apex_local_feedback set developer_comment = trim(coalesce(developer_comment, '') || char(10) || ?), updated_on = ?, updated_by = ? where feedback_id = ?",
        )
        .run(String(args.p_follow_up ?? ''), now(), rt!.ctx.session.user, Number(args.p_feedback_id));
      return null;
    },
  },
  'apex_util.reply_to_feedback': {
    params: ['p_feedback_id', 'p_status', 'p_public_response', 'p_developer_comment', 'p_tags'],
    fn: (args, rt) => {
      if (!runtime(rt)) return null;
      const sets: string[] = [];
      const values: (string | number | null)[] = [];
      const set = (column: string, value: unknown) => {
        if (value === undefined) return;
        sets.push(`${column} = ?`);
        values.push(
          value === null || value === '' ? null : typeof value === 'number' ? value : String(value),
        );
      };
      set('feedback_status', args.p_status === undefined ? undefined : Number(args.p_status));
      set('public_response', args.p_public_response);
      set('developer_comment', args.p_developer_comment);
      set('tags', args.p_tags);
      sets.push('updated_on = ?', 'updated_by = ?');
      values.push(now(), rt!.ctx.session.user);
      raw(rt!.renderer)
        .prepare(`update apex_local_feedback set ${sets.join(', ')} where feedback_id = ?`)
        .run(...values, Number(args.p_feedback_id));
      return null;
    },
  },
  'apex_util.delete_feedback': {
    params: ['p_feedback_id'],
    fn: (args, rt) => {
      if (!runtime(rt)) return null;
      raw(rt!.renderer)
        .prepare('delete from apex_local_feedback where feedback_id = ?')
        .run(Number(args.p_feedback_id));
      return null;
    },
  },
  'apex_util.feedback_enabled': {
    params: [],
    fn: (_args, rt) => (rt && str(rt.renderer.app.app.props, 'runtime.allowFeedback') === 'true' ? 1 : 0),
  },

  // ACL
  'apex_acl.add_user_role': {
    params: aclParams,
    fn: (args, rt) => (runtime(rt) ? setRoles(rt!, args, 'add') : null),
  },
  'apex_acl.remove_user_role': {
    params: aclParams,
    fn: (args, rt) => (runtime(rt) ? setRoles(rt!, args, 'remove') : null),
  },
  'apex_acl.replace_user_roles': {
    params: ['p_application_id', 'p_user_name', 'p_role_ids', 'p_role_static_ids'],
    fn: (args, rt) => (runtime(rt) ? setRoles(rt!, args, 'replace') : null),
  },
  'apex_acl.remove_all_user_roles': {
    params: ['p_application_id', 'p_user_name'],
    fn: (args, rt) => {
      if (!runtime(rt)) return null;
      const user = userId(rt!, args.p_user_name, false);
      if (user !== undefined)
        raw(rt!.renderer).prepare('delete from apex_local_acl_user_roles where user_id = ?').run(user);
      return null;
    },
  },
  'apex_acl.has_user_role': {
    params: ['p_application_id', 'p_user_name', 'p_role_static_id'],
    fn: (args, rt) => {
      if (!runtime(rt) || isCurrentUser(rt!, args.p_user_name))
        return aclCheck(rt?.renderer, rt?.ctx.session, String(args.p_role_static_id ?? '')) === 1;
      const wanted = String(args.p_role_static_id ?? '').toUpperCase();
      return userRoles(rt!, args.p_user_name).some((role) => role.staticId.toUpperCase() === wanted);
    },
  },
  'apex_acl.has_user_any_roles': {
    params: ['p_application_id', 'p_user_name'],
    fn: (args, rt) =>
      !runtime(rt) || isCurrentUser(rt!, args.p_user_name)
        ? aclCheck(rt?.renderer, rt?.ctx.session) === 1
        : userRoles(rt!, args.p_user_name).length > 0,
  },
  'apex_acl.is_role_removed_from_user': {
    params: [
      'p_application_id',
      'p_user_name',
      'p_role_id',
      'p_role_static_id',
      'p_role_ids',
      'p_role_static_ids',
    ],
    fn: (args, rt) => {
      if (!runtime(rt)) return false;
      const wanted = String(args.p_role_static_id ?? '').toUpperCase();
      const current = userRoles(rt!, args.p_user_name).find((role) => role.staticId.toUpperCase() === wanted);
      if (!current) return false;
      const next = Array.isArray(args.p_role_ids)
        ? args.p_role_ids.map(Number)
        : String(args.p_role_ids ?? '')
            .split(':')
            .filter(Boolean)
            .map(Number);
      return !next.includes(current.id);
    },
  },

  // build options
  'apex_util.get_build_option_status': {
    params: ['p_application_id', 'p_build_option_name', 'p_build_option_id'],
    fn: (args, rt) => {
      if (!runtime(rt)) return 'INCLUDE';
      const row = one(
        raw(rt!.renderer),
        'select build_option_status as s from APEX_APPLICATION_BUILD_OPTIONS where upper(build_option_name) = upper(?) or build_option_id = ?',
        String(args.p_build_option_name ?? ''),
        Number(args.p_build_option_id ?? -1),
      );
      return row ? String(row.s).toUpperCase() : 'INCLUDE';
    },
    sql: true,
  },
  'apex_util.set_build_option_status': {
    params: ['p_application_id', 'p_id', 'p_build_status', 'p_build_option_name'],
    fn: (args, rt) => {
      if (!runtime(rt)) return null;
      const db = raw(rt!.renderer);
      const row = one(
        db,
        'select build_option_name as n from apex_local_dict_build_options where build_option_id = ? or upper(build_option_name) = upper(?)',
        Number(args.p_id ?? -1),
        String(args.p_build_option_name ?? ''),
      );
      if (!row) throw new PlsqlException('ora-20987', -20987, 'Build option not found', 'app');
      const status = /^inc/iu.test(String(args.p_build_status ?? '')) ? 'Include' : 'Exclude';
      db.prepare(
        'delete from apex_local_build_options where application_id = ? and build_option_name = ?',
      ).run(appIdOf(rt!.renderer), String(row.n));
      insertRow(db, 'apex_local_build_options', {
        application_id: appIdOf(rt!.renderer),
        build_option_name: row.n,
        status,
        updated_by: rt!.ctx.session.user,
        updated_on: now(),
      });
      rt!.note(
        'info',
        `Build option ${String(row.n)} set to ${status} locally; the preview still renders every component`,
      );
      return null;
    },
  },

  // themes
  'apex_util.set_current_theme_style': {
    params: ['p_theme_number', 'p_theme_style_id'],
    fn: (args, rt) => {
      if (!runtime(rt)) return null;
      const key = styleKey(rt!.renderer, args.p_theme_style_id);
      if (!key) {
        rt!.note('warning', `Theme style ${String(args.p_theme_style_id)} is not known locally`);
        return null;
      }
      setAppState(rt!.renderer, 'CURRENT_THEME_STYLE', key);
      rt!.ctx.session.themeStyle = undefined;
      return null;
    },
  },
  'apex_theme.set_current_style': {
    params: ['p_theme_number', 'p_id', 'p_application_id'],
    fn: (args, rt) =>
      ADMIN_STUBS['apex_util.set_current_theme_style']!.fn({ ...args, p_theme_style_id: args.p_id }, rt),
  },
  'apex_theme.enable_user_style': {
    params: ['p_application_id', 'p_theme_number'],
    fn: (_args, rt) =>
      runtime(rt) ? (setAppState(rt!.renderer, 'THEME_STYLE_BY_USER_PREF', 'Yes'), null) : null,
  },
  'apex_theme.disable_user_style': {
    params: ['p_application_id', 'p_theme_number'],
    fn: (_args, rt) =>
      runtime(rt) ? (setAppState(rt!.renderer, 'THEME_STYLE_BY_USER_PREF', 'No'), null) : null,
  },
  'apex_theme.clear_all_users_style': { params: ['p_application_id'], fn: () => null },
  'apex_theme.clear_user_style': { params: ['p_application_id', 'p_user', 'p_theme_number'], fn: () => null },
  'apex_theme.set_user_style': {
    params: ['p_application_id', 'p_user', 'p_theme_number', 'p_id'],
    fn: (args, rt) => {
      if (!runtime(rt)) return null;
      const key = styleKey(rt!.renderer, args.p_id);
      if (key) rt!.ctx.session.themeStyle = key;
      return null;
    },
  },
  'apex_theme.set_session_style': {
    params: ['p_theme_number', 'p_name'],
    fn: (args, rt) => {
      if (!runtime(rt)) return null;
      const key = styleKey(rt!.renderer, args.p_name);
      if (key) rt!.ctx.session.themeStyle = key;
      return null;
    },
  },
  'apex_theme.get_user_style': {
    params: ['p_application_id', 'p_user', 'p_theme_number'],
    fn: (_args, rt) => {
      if (!runtime(rt) || !rt!.ctx.session.themeStyle) return null;
      return hashId(rt!.renderer.appId, 'style', rt!.ctx.session.themeStyle.toLowerCase());
    },
  },

  // application settings
  'apex_app_setting.get_value': {
    params: ['p_name', 'p_raise_error'],
    fn: (args, rt) => (runtime(rt) ? settingValue(rt!, String(args.p_name ?? '').toUpperCase()) : null),
    sql: true,
  },
  'apex_app_setting.set_value': {
    params: ['p_name', 'p_value', 'p_raise_error'],
    fn: (args, rt) => {
      if (!runtime(rt)) return null;
      const db = raw(rt!.renderer);
      const name = String(args.p_name ?? '').toUpperCase();
      db.prepare('delete from apex_local_app_settings where application_id = ? and name = ?').run(
        appIdOf(rt!.renderer),
        name,
      );
      insertRow(db, 'apex_local_app_settings', {
        application_id: appIdOf(rt!.renderer),
        name,
        value: textOf(args.p_value),
        updated_on: now(),
      });
      return null;
    },
  },

  // user preferences (kept per preview session)
  'apex_util.set_preference': {
    params: ['p_preference', 'p_value', 'p_user'],
    fn: (args, rt) => {
      if (!runtime(rt)) return null;
      setPreference(
        rt!.renderer,
        rt!.ctx,
        String(args.p_preference ?? ''),
        textOf(args.p_value),
        prefUser(rt!, args),
      );
      return null;
    },
  },
  'apex_util.get_preference': {
    params: ['p_preference', 'p_user'],
    fn: (args, rt) => {
      if (!runtime(rt)) return null;
      const row = one(
        raw(rt!.renderer),
        'select preference_value as v from apex_local_preferences where session_id = ? and user_name = ? and preference_name = ?',
        rt!.ctx.session.id,
        prefUser(rt!, args),
        String(args.p_preference ?? '').toUpperCase(),
      );
      return row ? textOf(row.v) : null;
    },
    sql: true,
  },
  'apex_util.remove_preference': {
    params: ['p_preference', 'p_user'],
    fn: (args, rt) => {
      if (!runtime(rt)) return null;
      setPreference(rt!.renderer, rt!.ctx, String(args.p_preference ?? ''), null, prefUser(rt!, args));
      return null;
    },
  },

  // automations: recorded, never run in the background
  'apex_automation.execute': {
    params: ['p_application_id', 'p_static_id', 'p_run_in_background', 'p_filters'],
    fn: (args, rt) => {
      if (!runtime(rt)) return null;
      const renderer = rt!.renderer;
      const automation = findShared(renderer, 'automation', String(args.p_static_id ?? ''));
      const db = raw(renderer);
      const id = Number(
        one(db, 'select coalesce(max(id), 0) + 1 as id from apex_local_automation_log')?.id ?? 1,
      );
      const stamp = now();
      insertRow(db, 'apex_local_automation_log', {
        id,
        application_id: appIdOf(renderer),
        automation_static_id: automation ? staticIdOf(automation) : String(args.p_static_id ?? ''),
        automation_name: automation
          ? str(automation.props, 'name', automation.id)
          : String(args.p_static_id ?? ''),
        is_job: 'N',
        status: 'SKIPPED',
        start_timestamp: stamp,
        end_timestamp: stamp,
        successful_row_count: 0,
        error_row_count: 0,
      });
      insertRow(db, 'apex_local_automation_msg_log', {
        id: Number(
          one(db, 'select coalesce(max(id), 0) + 1 as id from apex_local_automation_msg_log')?.id ?? 1,
        ),
        automation_log_id: id,
        message_timestamp: stamp,
        message_type: 'INFO',
        message: 'Automations are not executed by the local preview; this run was only recorded.',
      });
      rt!.note('info', `apex_automation.execute(${String(args.p_static_id)}) was recorded, not executed`);
      return null;
    },
  },
};

export { setAppState };
