import { get, isObject, ref, str, type ApxComponent } from '../../apexlang.ts';
import type { ProcessResult } from '../../extensions.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import type { Runtime, Stub, StubArgs } from '../server/apex-api.ts';
import { PlsqlException } from '../server/plsql.ts';
import { ensureDictionary } from './dictionary.ts';
import { all, findShared, insertRow, now, one, raw, refName } from './store.ts';

/**
 * E-mail without a mail server: `apex_mail.send`, the Send E-Mail process and e-mail templates
 * write to the local outbox table (`apex_local_mail`, exposed as APEX_MAIL_QUEUE/APEX_MAIL_LOG).
 * Nothing leaves the machine; the outbox page lists every message.
 */

const textOf = (value: unknown) =>
  value === null || value === undefined || value === '' ? null : String(value);

export interface Mail {
  to?: string | null;
  from?: string | null;
  cc?: string | null;
  bcc?: string | null;
  replyTo?: string | null;
  subject?: string | null;
  body?: string | null;
  bodyHtml?: string | null;
  template?: string | null;
  placeholders?: Record<string, string>;
  source: string;
  immediate?: boolean;
}

/** Replaces `#NAME#` placeholders; `#NAME!RAW#` skips escaping in HTML bodies. */
export function fillPlaceholders(template: string, values: Record<string, string>, html: boolean): string {
  const upper = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.toUpperCase(), value]));
  return template.replace(
    /#([A-Za-z0-9_$]+)(!RAW|!HTML|!STRIPHTML)?#/gu,
    (whole, name: string, filter?: string) => {
      const value = upper[name.toUpperCase()];
      if (value === undefined) return whole;
      if (!html || filter === '!RAW') return value;
      if (filter === '!STRIPHTML') return value.replace(/<[^>]*>/gu, '');
      return escapeHtml(value);
    },
  );
}

function parsePlaceholders(value: unknown): Record<string, string> {
  if (value === null || value === undefined || value === '') return {};
  if (typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v ?? '')]));
  try {
    const parsed = JSON.parse(String(value)) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, entry]) => [key, entry === null ? '' : String(entry)]),
    );
  } catch {
    return {};
  }
}

/** Renders an e-mail template component into subject, HTML and text bodies. */
export function renderTemplate(
  renderer: ApexRenderer,
  staticId: string,
  placeholders: Record<string, string>,
): { subject: string; html: string; text: string } | undefined {
  const template = findShared(renderer, 'emailTemplate', staticId);
  if (!template) return undefined;
  const values = {
    APP_NAME: str(renderer.app.app.props, 'name', renderer.app.app.id),
    APP_ID: renderer.appId,
    ...placeholders,
  };
  const header = fillPlaceholders(str(template.props, 'htmlFormat.header'), values, true);
  const body = fillPlaceholders(str(template.props, 'htmlFormat.body'), values, true);
  const footer = fillPlaceholders(str(template.props, 'htmlFormat.footer'), values, true);
  const shell = str(template.props, 'advanced.htmlTemplate');
  const html = shell
    ? shell.replaceAll('#HEADER#', header).replaceAll('#BODY#', body).replaceAll('#FOOTER#', footer)
    : `${header}${body}${footer}`;
  return {
    subject: fillPlaceholders(str(template.props, 'emailSubject'), values, false),
    html,
    text: fillPlaceholders(str(template.props, 'plainTextFormat.content'), values, false),
  };
}

export function queueMail(renderer: ApexRenderer, ctx: RenderContext, mail: Mail): number {
  ensureDictionary(renderer);
  const db = raw(renderer);
  let { subject, body, bodyHtml } = mail;
  if (mail.template) {
    const rendered = renderTemplate(renderer, mail.template, mail.placeholders ?? {});
    if (!rendered)
      throw new PlsqlException('ora-20022', -20022, `E-mail template ${mail.template} not found`, 'app');
    subject = rendered.subject;
    body = rendered.text || null;
    bodyHtml = rendered.html || null;
  }
  if (!textOf(mail.to) && !textOf(mail.cc) && !textOf(mail.bcc))
    throw new PlsqlException('ora-20001', -20001, 'E-mail needs at least one recipient (p_to)', 'app');
  const id = Number(one(db, 'select coalesce(max(id), 0) + 1 as id from apex_local_mail')?.id ?? 1);
  insertRow(db, 'apex_local_mail', {
    id,
    application_id: Number(renderer.appId) || 0,
    session_id: ctx.session.id,
    user_name: ctx.session.user,
    mail_to: textOf(mail.to),
    mail_from: textOf(mail.from),
    mail_replyto: textOf(mail.replyTo),
    mail_cc: textOf(mail.cc),
    mail_bcc: textOf(mail.bcc),
    mail_subj: textOf(subject),
    mail_body: textOf(body),
    mail_body_html: textOf(bodyHtml),
    template_static_id: textOf(mail.template),
    placeholders:
      mail.placeholders && Object.keys(mail.placeholders).length ? JSON.stringify(mail.placeholders) : null,
    status: mail.immediate ? 'SENT' : 'QUEUED',
    created_on: now(),
    sent_on: mail.immediate ? now() : null,
    source: mail.source,
  });
  renderer.diagnose(
    'info',
    `E-mail ${id} “${textOf(subject) ?? ''}” to ${textOf(mail.to) ?? ''} was written to the local outbox (${renderer.baseUrl}/__apex/x/outbox); nothing is sent`,
    ctx.pageId,
  );
  return id;
}

function pushQueue(renderer: ApexRenderer): void {
  ensureDictionary(renderer);
  raw(renderer)
    .prepare("update apex_local_mail set status = 'SENT', sent_on = ? where status = 'QUEUED'")
    .run(now());
}

const sendParams = [
  'p_to',
  'p_from',
  'p_body',
  'p_body_html',
  'p_subj',
  'p_cc',
  'p_bcc',
  'p_replyto',
  'p_template_static_id',
  'p_placeholders',
  'p_application_id',
];

function send(args: StubArgs, rt: Runtime | undefined): number | null {
  if (!rt) return null;
  return queueMail(rt.renderer, rt.ctx, {
    to: textOf(args.p_to),
    from: textOf(args.p_from),
    cc: textOf(args.p_cc),
    bcc: textOf(args.p_bcc),
    replyTo: textOf(args.p_replyto),
    subject: textOf(args.p_subj),
    body: textOf(args.p_body),
    bodyHtml: textOf(args.p_body_html),
    template: textOf(args.p_template_static_id),
    placeholders: parsePlaceholders(args.p_placeholders),
    source: 'apex_mail.send',
  });
}

export const MAIL_STUBS: Record<string, Stub> = {
  'apex_mail.send': { params: sendParams, fn: send },
  'apex_mail.push_queue': {
    params: ['p_smtp_hostname', 'p_smtp_portno'],
    fn: (_args, rt) => {
      if (rt) pushQueue(rt.renderer);
      return null;
    },
  },
  'apex_mail.add_attachment': {
    params: ['p_mail_id', 'p_attachment', 'p_filename', 'p_mime_type', 'p_content_id'],
    fn: (args, rt) => {
      if (!rt) return null;
      ensureDictionary(rt.renderer);
      const db = raw(rt.renderer);
      insertRow(db, 'apex_local_mail_attachments', {
        id: Number(
          one(db, 'select coalesce(max(id), 0) + 1 as id from apex_local_mail_attachments')?.id ?? 1,
        ),
        mail_id: Number(args.p_mail_id),
        filename: textOf(args.p_filename),
        mime_type: textOf(args.p_mime_type),
        size_bytes:
          args.p_attachment === null || args.p_attachment === undefined
            ? 0
            : String(args.p_attachment).length,
        created_on: now(),
      });
      return null;
    },
  },
  'apex_mail.get_instance_url': {
    params: [],
    fn: (_args, rt) => (rt ? 'http://127.0.0.1/' : null),
    sql: true,
  },
  'apex_mail.get_images_url': { params: [], fn: () => '/i/', sql: true },
};

// ------------------------------------------------------------------ Send E-Mail process

/** Placeholder values of a process: `placeholderValues` JSON plus `parameter` children. */
function processPlaceholders(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): Record<string, string> {
  const values = parsePlaceholders(
    renderer.substitute(ctx.session, str(process.props, 'emailTemplate.placeholderValues'), ctx.page, 'RAW'),
  );
  for (const parameter of process.children.filter((child) => child.type === 'parameter')) {
    const name = refName(get(parameter.props, 'name')) || parameter.id;
    const value = isObject(parameter.props.value) ? parameter.props.value : {};
    const item = str(value, 'item');
    values[name.toUpperCase()] = item
      ? (ctx.session.items[item.toUpperCase()] ?? '')
      : renderer.substitute(ctx.session, str(value, 'staticValue'), ctx.page, 'RAW');
  }
  return values;
}

export function sendEmailProcess(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): ProcessResult {
  const sub = (key: string) => renderer.substitute(ctx.session, str(process.props, key), ctx.page, 'RAW');
  const html = renderer.substitute(
    ctx.session,
    str(process.props, 'emailContent.bodyHtml'),
    ctx.page,
    'HTML',
  );
  try {
    const template = ref(process.props, 'emailTemplate.emailTemplate');
    queueMail(renderer, ctx, {
      to: sub('emailHeader.to'),
      from: sub('emailHeader.from'),
      cc: sub('emailHeader.cc'),
      bcc: sub('emailHeader.bcc'),
      replyTo: sub('emailContent.replyTo'),
      subject: sub('emailContent.subject'),
      body: sub('emailContent.bodyPlainText'),
      bodyHtml: html,
      template: template ?? null,
      placeholders: template ? processPlaceholders(renderer, ctx, process) : {},
      source: `process ${process.id}`,
      immediate: str(process.props, 'emailDispatchMode.sendImmediately') === 'true',
    });
    if (str(process.props, 'emailAttachments.attachmentSql'))
      renderer.diagnose(
        'info',
        `process ${process.id}: e-mail attachments from SQL are not stored in the local outbox`,
        ctx.pageId,
        process.id,
      );
    return { ran: true };
  } catch (error) {
    const message = (error as Error).message;
    renderer.diagnose('warning', `process ${process.id}: ${message}`, ctx.pageId, process.id);
    return {
      ran: false,
      errors: [
        {
          type: 'error',
          location: ['page'],
          message: str(process.props, 'error.errorMessage') || message,
          unsafe: false,
        },
      ],
    };
  }
}

// ------------------------------------------------------------------ outbox page

export function outboxHtml(renderer: ApexRenderer, restRows: Record<string, unknown>[]): string {
  ensureDictionary(renderer);
  const rows = all(raw(renderer), 'select * from apex_local_mail order by id desc limit 200');
  const cell = (value: unknown) => escapeHtml(value === null || value === undefined ? '' : String(value));
  const mails = rows
    .map(
      (
        row,
      ) => `<details class="mail"><summary><span class="status is-${cell(String(row.status).toLowerCase())}">${cell(row.status)}</span> <b>${cell(row.mail_subj) || '(no subject)'}</b> → ${cell(row.mail_to)} <small>${cell(row.created_on)} · ${cell(row.source)}</small></summary>
<dl><dt>From</dt><dd>${cell(row.mail_from)}</dd><dt>Cc / Bcc</dt><dd>${cell(row.mail_cc)} / ${cell(row.mail_bcc)}</dd><dt>Template</dt><dd>${cell(row.template_static_id)}</dd></dl>
${row.mail_body_html ? `<iframe sandbox="" srcdoc="${cell(row.mail_body_html)}"></iframe>` : ''}
${row.mail_body ? `<pre>${cell(row.mail_body)}</pre>` : ''}</details>`,
    )
    .join('');
  const rest = restRows
    .map(
      (row) =>
        `<tr><td>${cell(row.created_on)}</td><td>${cell(row.method)}</td><td>${cell(row.source)}</td><td>${cell(row.url)}</td><td>${cell(row.fixture)}</td><td>${cell(row.status_code)}</td><td>${cell(row.note)}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Local outbox · ${escapeHtml(str(renderer.app.app.props, 'name', renderer.alias))}</title>
<style>body{font:14px/1.45 system-ui,sans-serif;margin:24px;color:#1f2328;background:#fff}h1{font-size:20px}h2{font-size:16px;margin-top:28px}.mail{border:1px solid #d0d7de;border-radius:6px;margin:8px 0;padding:8px 12px}.mail summary{cursor:pointer}.status{display:inline-block;font-size:11px;padding:1px 6px;border-radius:10px;background:#ddf4ff}.status.is-queued{background:#fff8c5}iframe{width:100%;min-height:240px;border:1px solid #eee;background:#fff}pre{white-space:pre-wrap;background:#f6f8fa;padding:8px}dl{display:grid;grid-template-columns:90px 1fr;gap:2px 8px}dt{color:#59636e}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #eee;padding:4px 6px;text-align:left;font-size:13px}small{color:#59636e}p.note{color:#59636e}</style></head>
<body><h1>Local outbox</h1><p class="note">E-mails from apex_mail, Send E-Mail processes and e-mail templates, and REST calls answered from <code>.apex-local/rest/*.json</code> fixtures. Nothing is sent over the network by the local preview.</p>
<h2>E-mail (${rows.length})</h2>${mails || '<p>No e-mail yet.</p>'}
<h2>REST calls (${restRows.length})</h2>${rest ? `<table><thead><tr><th>Time</th><th>Method</th><th>Source</th><th>URL / operation</th><th>Fixture</th><th>Status</th><th>Note</th></tr></thead><tbody>${rest}</tbody></table>` : '<p>No REST calls yet.</p>'}
</body></html>`;
}
