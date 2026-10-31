import type { DatabaseSync } from 'node:sqlite';
import { registerExtension } from '../extensions.ts';
import type { RenderContext, Session } from '../render.ts';
import { escapeHtml } from '../theme.ts';
import { ADMIN_STUBS, appState, logActivity, markStart } from './platform/admin.ts';
import { COLLECTION_STUBS } from './platform/collections.ts';
import { ensureDictionary, seedUser } from './platform/dictionary.ts';
import { MAIL_STUBS, outboxHtml, sendEmailProcess } from './platform/mail.ts';
import { invokeApiProcess, REST_STUBS, restLog, restRegionSql } from './platform/rest.ts';
import {
  executionChain,
  humanTaskCreateProcess,
  humanTaskManageProcess,
  preferenceCondition,
  SERVICE_STUBS,
  userPreferencesProcess,
  workflowProcess,
} from './platform/services.ts';
import { raw } from './platform/store.ts';
import { registerStubs } from './server/apex-api.ts';

/**
 * Platform services of the local preview: APEX collections, dictionary views generated from the
 * APEXlang source (and the admin pages built on them), activity log, team feedback, ACL, e-mail
 * to a local outbox, REST from JSON fixtures, execution chains, user preferences, application
 * settings, and a minimal record of workflows and human tasks.
 */

registerStubs({ ...COLLECTION_STUBS, ...ADMIN_STUBS, ...MAIL_STUBS, ...REST_STUBS, ...SERVICE_STUBS });

/** SQL helpers the admin pages use: `median()` aggregate and `from_tz()`. */
const sqlReady = new WeakSet<DatabaseSync>();
function ensureSql(db: DatabaseSync): void {
  if (sqlReady.has(db)) return;
  sqlReady.add(db);
  // node:sqlite accumulators must be SQL values, so the collected numbers travel as JSON text.
  db.aggregate('median', {
    start: '[]',
    step: (values, value) => {
      if (value === null || value === undefined || Number.isNaN(Number(value))) return values;
      return JSON.stringify([...(JSON.parse(String(values)) as number[]), Number(value)]);
    },
    result: (values) => {
      const sorted = (JSON.parse(String(values)) as number[]).sort((a, b) => a - b);
      if (!sorted.length) return null;
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
    },
  });
  db.function('from_tz', { varargs: true, deterministic: true }, (value) => (value ?? null) as string | null);
}

/** Theme style chosen by apex_util.set_current_theme_style, applied for the page render only. */
const borrowedStyle = new WeakMap<RenderContext, Session>();

registerExtension({
  name: 'platform',
  processes: {
    sendEMail: (renderer, ctx, process) => sendEmailProcess(renderer, ctx, process),
    invokeApi: (renderer, ctx, process) => invokeApiProcess(renderer, ctx, process),
    executionChain: (renderer, ctx, process, point, pressed) => executionChain(renderer, ctx, process, point, pressed),
    userPreferences: (renderer, ctx, process) => userPreferencesProcess(renderer, ctx, process),
    humanTaskCreate: (renderer, ctx, process) => humanTaskCreateProcess(renderer, ctx, process),
    humanTaskManage: (renderer, ctx, process) => humanTaskManageProcess(renderer, ctx, process),
    workflow: (renderer, ctx, process) => workflowProcess(renderer, ctx, process),
  },
  conditions: {
    'userPreference=value': (renderer, ctx, condition) => preferenceCondition(true)(renderer, ctx, condition),
    'userPreference!=value': (renderer, ctx, condition) => preferenceCondition(false)(renderer, ctx, condition),
  },
  regionSource: (renderer, ctx, region) => restRegionSql(renderer, ctx, region),
  routes: {
    /** The local outbox: e-mail and REST calls of this preview. */
    outbox: (renderer) => ({ type: 'html', body: outboxHtml(renderer, restLog(renderer)) }),
  },
  point: (renderer, ctx, point) => {
    ensureSql(raw(renderer));
    ensureDictionary(renderer);
    if (point === 'beforeHeader') {
      markStart(ctx);
      seedUser(renderer, ctx.session.user);
      const style = appState(renderer, 'CURRENT_THEME_STYLE');
      if (style && ctx.session.themeStyle === undefined) {
        ctx.session.themeStyle = style;
        borrowedStyle.set(ctx, ctx.session);
      }
    }
    if (point === 'afterSubmit') {
      markStart(ctx);
      logActivity(renderer, ctx, 'P');
    }
    return undefined;
  },
  page: (renderer, ctx) => {
    logActivity(renderer, ctx, 'D');
    const session = borrowedStyle.get(ctx);
    if (session) session.themeStyle = undefined;
  },
  toolbar: (renderer) => {
    const count = raw(renderer).prepare('select count(*) as n from apex_local_mail').get() as { n: number } | undefined;
    return `<a class="apex-local-outbox" href="${escapeHtml(renderer.baseUrl)}/__apex/x/outbox" target="_blank" rel="noopener">Outbox${count?.n ? ` (${count.n})` : ''}</a>`;
  },
  css: '.apex-local-outbox{margin:0 8px;font-size:12px;color:inherit}',
});
