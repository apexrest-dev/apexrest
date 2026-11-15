import { findStub, registerStubs, type Runtime, type Stub } from './apex-api.ts';

/**
 * APEX and DBMS APIs that application packages call while a page renders: URLs of the preview
 * itself, the session time zone, NLS separators, random values and permission checks that the
 * preview grants like the rest of its authorization. Anything with an external effect (jobs,
 * REST module definitions) stays reported as not simulated.
 */

const p = (...names: string[]) => names;
const text = (value: unknown) =>
  value === null || value === undefined || value === '' ? null : String(value);
const noop = () => null;

function origin(rt: Runtime | undefined): string {
  return rt?.ctx.session.origin ?? 'http://localhost';
}

function hostUrl(rt: Runtime | undefined, option: unknown): string {
  const base = origin(rt);
  switch (String(option ?? '').toUpperCase()) {
    case 'SCRIPT':
      return `${base}/`;
    case 'IMGPRE':
      return `${base}/i/`;
    case 'APEX_PATH':
      return `${base}${rt?.renderer.baseUrl ?? ''}/`;
    default:
      return base;
  }
}

/** A seeded generator gives repeatable data when an install script calls dbms_random.seed. */
let state = 0x2545f491;
function random(): number {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return ((state >>> 0) % 1_000_000_007) / 1_000_000_007;
}

function randomString(option: unknown, length: unknown): string {
  const sets: Record<string, string> = {
    U: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    L: 'abcdefghijklmnopqrstuvwxyz',
    A: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    X: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    P: ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~',
  };
  const chars = sets[String(option ?? 'U').toUpperCase()] ?? sets.U!;
  const size = Math.max(0, Math.min(4000, Number(length ?? 1) || 0));
  return Array.from({ length: size }, () => chars[Math.floor(random() * chars.length)]).join('');
}

/** Minimal Markdown for apex_markdown.to_html: headings, emphasis, code, links, lists, paragraphs. */
export function markdownToHtml(markdown: string): string {
  const escape = (value: string) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const inline = (value: string) =>
    escape(value)
      .replace(/`([^`]+)`/gu, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/gu, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/gu, (_m, label: string, href: string) =>
        /^(?:https?:|mailto:|\/|#)/iu.test(href) ? `<a href="${href}">${label}</a>` : label,
      );
  const out: string[] = [];
  let list: 'ul' | 'ol' | undefined;
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) out.push(`<p>${paragraph.map(inline).join(' ')}</p>`);
    paragraph = [];
  };
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = undefined;
  };
  for (const line of markdown.replace(/\r\n?/gu, '\n').split('\n')) {
    const heading = /^(#{1,6})\s+(.*)$/u.exec(line);
    const bullet = /^\s*[-*+]\s+(.*)$/u.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/u.exec(line);
    if (heading) {
      flush();
      close();
      out.push(`<h${heading[1]!.length}>${inline(heading[2]!)}</h${heading[1]!.length}>`);
    } else if (bullet || numbered) {
      flush();
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        close();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((bullet ?? numbered)![1]!)}</li>`);
    } else if (!line.trim()) {
      flush();
      close();
    } else {
      close();
      paragraph.push(line.trim());
    }
  }
  flush();
  close();
  return out.join('\n');
}

/** An item, or a built-in such as APP_ID and APP_PAGE_ID, from the session of the running unit. */
function sessionValue(rt: Runtime | undefined, name: unknown): string | null {
  if (!rt || text(name) === null) return null;
  const key = String(name).toUpperCase();
  const item = rt.ctx.session.items[key];
  if (item !== undefined && item !== '') return item;
  const builtin = rt.renderer.builtin(rt.ctx.session, rt.ctx.page)[key];
  return builtin === undefined || builtin === '' ? null : builtin;
}

const allowed: Stub = { params: p('p_task_id', 'p_operation', 'p_user'), fn: () => true };

registerStubs({
  'apex_util.host_url': { params: p('p_option'), fn: (args, rt) => hostUrl(rt, args.p_option), sql: true },
  'apex_util.get_protocol': { params: [], fn: (_args, rt) => origin(rt).split(':')[0]!, sql: true },
  'apex_util.get_session_time_zone': {
    params: [],
    fn: (_args, rt) => rt?.ctx.session.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    sql: true,
  },
  'apex_util.set_session_time_zone': {
    params: p('p_time_zone'),
    fn: (args, rt) => {
      if (rt) rt.ctx.session.timeZone = text(args.p_time_zone) ?? undefined;
      return null;
    },
  },
  // One workspace locally, named as the dictionary views name it.
  'apex_util.find_workspace': { params: ['p_security_group_id'], fn: () => 'PREVIEW', sql: true },
  'apex_util.find_security_group_id': { params: ['p_workspace'], fn: () => 1000000000000001, sql: true },
  'apex_util.varchar2_to_blob': {
    params: p('p_varchar2', 'p_charset'),
    fn: (args) => text(args.p_varchar2),
    sql: true,
  },
  'apex_application.get_nls_decimal_separator': { params: [], fn: () => '.', sql: true },
  'apex_application.get_nls_group_separator': { params: [], fn: () => ',', sql: true },
  'apex_application.do_substitutions': {
    params: p('p_string', 'p_escape'),
    fn: (args, rt) =>
      rt && text(args.p_string) !== null
        ? rt.renderer.substitute(rt.ctx.session, String(args.p_string), rt.ctx.page, 'RAW')
        : text(args.p_string),
  },
  'apex_application_admin.get_build_option_status': {
    params: p('p_application_id', 'p_id', 'p_build_option_name'),
    fn: () => 'INCLUDE',
  },
  'apex_custom_auth.get_username': { params: [], fn: (_args, rt) => rt?.ctx.session.user ?? null, sql: true },
  'apex_markdown.to_html': {
    params: p('p_markdown', 'p_embedded_html_mode', 'p_softbreak', 'p_extra_link_attributes'),
    fn: (args) => (text(args.p_markdown) === null ? null : markdownToHtml(String(args.p_markdown))),
    sql: true,
  },
  // System messages use the same lookup as application text messages locally.
  'apex_lang.system_message': {
    params: ['p_name', 'p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'],
    fn: (args, rt) => findStub('apex_lang.message')!.fn(args, rt),
    sql: true,
  },
  'apex_session_state.get_value': {
    params: ['p_item'],
    fn: (args, rt) => sessionValue(rt, args.p_item),
    sql: true,
  },
  'apex_session_state.get_varchar2': {
    params: ['p_item'],
    fn: (args, rt) => sessionValue(rt, args.p_item),
    sql: true,
  },
  'apex_session_state.get_clob': {
    params: ['p_item'],
    fn: (args, rt) => sessionValue(rt, args.p_item),
    sql: true,
  },
  'apex_session_state.get_number': {
    params: ['p_item'],
    fn: (args, rt) => {
      const value = sessionValue(rt, args.p_item);
      return value === null || !Number.isFinite(Number(value)) ? null : Number(value);
    },
    sql: true,
  },
  'apex_session_state.get_timestamp': {
    params: ['p_item'],
    fn: (args, rt) => sessionValue(rt, args.p_item),
    sql: true,
  },
  'apex_session_state.get_boolean': {
    params: ['p_item'],
    fn: (args, rt) => {
      const value = sessionValue(rt, args.p_item);
      return value === null ? null : /^(?:y|yes|true|1)$/iu.test(value);
    },
  },
  'apex_session_state.set_value': {
    params: ['p_item', 'p_value'],
    fn: (args, rt) => {
      if (rt && text(args.p_item))
        rt.ctx.session.items[String(args.p_item).toUpperCase()] = text(args.p_value) ?? '';
      return null;
    },
  },
  'apex_workflow.is_allowed': allowed,
  'apex_human_task.is_allowed': allowed,
  'apex_approval.is_allowed': allowed,
  'dbms_random.value': {
    params: p('low', 'high'),
    fn: (args) => {
      const low = args.low === null || args.low === undefined ? 0 : Number(args.low);
      const high = args.high === null || args.high === undefined ? 1 : Number(args.high);
      return low + random() * (high - low);
    },
    sql: true,
  },
  'dbms_random.normal': {
    params: [],
    fn: () => Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random()),
    sql: true,
  },
  'dbms_random.string': {
    params: p('opt', 'len'),
    fn: (args) => randomString(args.opt, args.len),
    sql: true,
  },
  'dbms_random.random': { params: [], fn: () => Math.floor((random() - 0.5) * 2 ** 32), sql: true },
  'dbms_random.seed': {
    params: p('val'),
    fn: (args) => {
      const seed = String(args.val ?? 1);
      state =
        [...seed].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) | 0, 0x2545f491) || 1;
      return null;
    },
  },
  'dbms_random.initialize': { params: p('val'), fn: noop },
  'dbms_stats.gather_table_stats': { params: [], fn: noop },
  'dbms_stats.gather_schema_stats': { params: [], fn: noop },
});
