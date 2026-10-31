import { ApexRenderer as Renderer } from '../render.ts';
import { registerExtension, type RouteRequest, type RouteResponse } from '../extensions.ts';
import type { ApexRenderer, Session } from '../render.ts';
import { DEVTOOLS_CSS, DEVTOOLS_JS } from './devtools/client.ts';
import { debugLogRoute, traceEvent } from './devtools/log.ts';
import {
  generateTextProcess,
  geocodingProcess,
  pushNotificationProcess,
  reportDynamicActions,
  workflowDiagram,
} from './devtools/stubs.ts';
import { toolbarTools } from './devtools/toolbar.ts';
import { authorizationSchemes, roles } from './devtools/view-as.ts';

/**
 * Developer tools for the local preview, modelled on APEX's runtime developer toolbar: session
 * state viewer and editor, per-request debug log (fed by `renderer.trace`), "view as" for
 * authorization schemes and ACL roles, viewport switcher, quick links to every page and a data
 * reset. Also hosts the honest stand-ins for features that need Oracle services (workflow
 * diagram, generative AI, geocoding, push notifications).
 */

const json = (body: unknown, status = 200): RouteResponse => ({
  status,
  type: 'json',
  body: JSON.stringify(body),
});

function parse<T>(request: RouteRequest): T | undefined {
  try {
    return JSON.parse(request.body || '{}') as T;
  } catch {
    return undefined;
  }
}

/** `GET` returns the session state; `POST { items }` sets values, `{ clearPage }` clears a page's items. */
function sessionStateRoute(renderer: ApexRenderer, session: Session, request: RouteRequest): RouteResponse {
  if (request.method === 'POST') {
    const input = parse<{ items?: Record<string, unknown>; clearPage?: string }>(request);
    if (!input) return json({ error: 'invalid JSON' }, 400);
    for (const [name, value] of Object.entries(input.items ?? {})) {
      const key = name.trim().toUpperCase();
      if (/^[A-Z][A-Z0-9_$#]*$/u.test(key)) session.items[key] = String(value ?? '');
    }
    if (input.clearPage) {
      const page = renderer.findPage(String(input.clearPage));
      for (const child of page?.children ?? [])
        if (child.type === 'pageItem') delete session.items[child.id.toUpperCase()];
    }
    return json({ ok: true, items: session.items });
  }
  return json({
    user: session.user,
    session: session.id,
    themeStyle: session.themeStyle ?? null,
    viewAs: session.viewAs ?? null,
    items: session.items,
  });
}

/** `GET` returns the setting and the choices; `POST { roles, deny }` enforces, `{ off: true }` resets. */
function viewAsRoute(renderer: ApexRenderer, session: Session, request: RouteRequest): RouteResponse {
  if (request.method === 'POST') {
    const input = parse<{ off?: boolean; roles?: unknown[]; deny?: unknown[] }>(request);
    if (!input) return json({ error: 'invalid JSON' }, 400);
    session.viewAs = input.off
      ? undefined
      : { roles: (input.roles ?? []).map(String), deny: (input.deny ?? []).map(String) };
    return json({ ok: true, viewAs: session.viewAs ?? null });
  }
  return json({
    viewAs: session.viewAs ?? null,
    roles: roles(renderer).map((role) => role.id),
    schemes: authorizationSchemes(renderer).map((scheme) => scheme.id),
  });
}

/** Drops every table, view and trigger of the local database and seeds it again. */
export function resetData(renderer: ApexRenderer): string[] {
  const objects = renderer.db.db
    .prepare(
      "select type, name from sqlite_master where type in ('table', 'view', 'trigger') and name not like 'sqlite_%'",
    )
    .all() as { type: string; name: string }[];
  renderer.db.db.exec('PRAGMA foreign_keys = OFF');
  for (const kind of ['trigger', 'view', 'table'])
    for (const object of objects.filter((entry) => entry.type === kind))
      renderer.db.db.exec(`drop ${kind} if exists "${object.name.replaceAll('"', '""')}"`);
  const problems = Renderer.seed(renderer.db, renderer.app.root);
  for (const problem of problems) renderer.diagnose('warning', `Seed script: ${problem}`);
  renderer.diagnose(
    'info',
    `Local data was reset (${objects.filter((entry) => entry.type === 'table').length} tables dropped and seeded again)`,
  );
  return problems;
}

function resetRoute(renderer: ApexRenderer, _session: Session, request: RouteRequest): RouteResponse {
  if (request.method !== 'POST') return json({ error: 'use POST' }, 405);
  try {
    const problems = resetData(renderer);
    return json({ ok: true, problems });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
}

registerExtension({
  name: 'devtools',
  trace: traceEvent,
  toolbar: toolbarTools,
  page: reportDynamicActions,
  routes: {
    'debug-log': debugLogRoute,
    'session-state': sessionStateRoute,
    'view-as': viewAsRoute,
    'reset-data': resetRoute,
  },
  regions: { workflowDiagram },
  processes: {
    generateTextWithAi: (renderer, ctx, process) => generateTextProcess(renderer, ctx, process),
    sendPushNotification: (renderer, ctx, process) => pushNotificationProcess(renderer, ctx, process),
    serverSideGeocoding: (renderer, ctx, process) => geocodingProcess(renderer, ctx, process),
  },
  client: DEVTOOLS_JS,
  css: DEVTOOLS_CSS,
});
