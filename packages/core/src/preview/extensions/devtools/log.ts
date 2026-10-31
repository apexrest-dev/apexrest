import type { RouteResponse } from '../../extensions.ts';
import type { ApexRenderer, RenderContext, Session, TraceEvent } from '../../render.ts';

/**
 * Per-session debug log for the developer toolbar, fed by `renderer.trace`: one entry per page
 * render, submit, region refresh or Ajax call, with its computations, processes, validations,
 * branches, authorization checks and diagnostics. Rendering is synchronous, so events raised
 * without a page context belong to the request that is being handled.
 */

export interface LogEvent extends TraceEvent {
  /** Milliseconds since the request began. */
  t: number;
}

export interface LogEntry {
  id: number;
  title: string;
  detail: string;
  page: string;
  started: string;
  ms: number;
  events: LogEvent[];
}

const MAX_ENTRIES = 30;
const MAX_EVENTS = 400;

const logs = new WeakMap<Session, LogEntry[]>();
let current: { session: Session; entry: LogEntry; startedAt: number } | undefined;
let sequence = 0;

export function sessionLog(session: Session): LogEntry[] {
  const entries = logs.get(session) ?? [];
  logs.set(session, entries);
  return entries;
}

export function traceEvent(_renderer: ApexRenderer, ctx: RenderContext | undefined, event: TraceEvent): void {
  if (event.type === 'begin' && ctx) {
    const entries = sessionLog(ctx.session);
    const entry: LogEntry = {
      id: (sequence += 1),
      title: event.name,
      detail: event.detail ?? '',
      page: ctx.pageId,
      started: new Date().toISOString(),
      ms: 0,
      events: [],
    };
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    current = { session: ctx.session, entry, startedAt: performance.now() };
    return;
  }
  if (!current || (ctx && ctx.session !== current.session)) return;
  const t = performance.now() - current.startedAt;
  const { entry } = current;
  const repeated =
    event.type === 'diagnostic' &&
    entry.events.some((known) => known.type === 'diagnostic' && known.detail === event.detail);
  if (!repeated && entry.events.length < MAX_EVENTS) entry.events.push({ ...event, t });
  entry.ms = Math.max(entry.ms, t + (event.ms ?? 0));
}

/** Appends an event raised in the browser (AI placeholders, geocoding, downloads) to the latest entry. */
export function appendClientEvent(session: Session, event: TraceEvent): void {
  const entry = sessionLog(session).at(-1);
  if (!entry) return;
  const t = Date.now() - Date.parse(entry.started);
  if (entry.events.length < MAX_EVENTS) entry.events.push({ ...event, t });
}

const json = (body: unknown, status = 200): RouteResponse => ({
  status,
  type: 'json',
  body: JSON.stringify(body),
});

/** `GET debug-log` lists the session's entries (newest first); `POST` clears or appends `{ event }`. */
export function debugLogRoute(
  _renderer: ApexRenderer,
  session: Session,
  request: { method: string; body: string },
): RouteResponse {
  if (request.method === 'POST') {
    let input: { clear?: boolean; event?: Partial<TraceEvent> } = {};
    try {
      input = JSON.parse(request.body || '{}') as typeof input;
    } catch {
      return json({ error: 'invalid JSON' }, 400);
    }
    if (input.clear) sessionLog(session).splice(0);
    if (input.event?.name)
      appendClientEvent(session, {
        type: 'info',
        name: String(input.event.name).slice(0, 200),
        detail: String(input.event.detail ?? '').slice(0, 2000),
        level: input.event.level === 'warning' ? 'warning' : 'info',
      });
    return json({ ok: true });
  }
  return json({ entries: [...sessionLog(session)].reverse() });
}
