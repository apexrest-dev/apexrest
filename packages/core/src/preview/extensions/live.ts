import { isObject, isRef, ref, str, type ApxComponent, type ApxValue } from '../apexlang.ts';
import { registerExtension } from '../extensions.ts';
import type { ApexRenderer, RenderContext } from '../render.ts';
import { FILTER_REGION_TYPES } from './facets/model.ts';

/**
 * Live pages over the preview's WebSocket (see live.ts): every data region is mapped to the local
 * tables its SQL reads, views resolved to their base tables. When another tab, session or user
 * writes one of them, the page refreshes those regions in place through `apex.region().refresh()`:
 * reports, interactive reports and grids, cards, template components, charts, calendars, maps,
 * trees and faceted search counts. Form regions are not refreshed; they show a notice instead.
 * `.apx` edits reload the page, and the toolbar's Live button shows who else views it.
 */

interface LiveRegion {
  tables: string[];
  form?: boolean;
}

/** Identifiers of SQL or PL/SQL text, without literals and comments, upper case. */
function identifiers(text: string): Set<string> {
  const code = text
    .replace(/'(?:[^']|'')*'/gu, ' ')
    .replace(/--[^\n]*/gu, ' ')
    .replace(/\/\*[\s\S]*?\*\//gu, ' ');
  const names = new Set<string>();
  for (const match of code.matchAll(/"([^"]+)"|([A-Za-z][\w$#]*)/gu))
    names.add((match[1] ?? match[2]!).toUpperCase());
  return names;
}

/** Static HTML or text of a region is content, not a query; table names in it are prose. */
const CONTENT_KEYS = new Set(['htmlCode', 'text']);

/** Every text value of a `source` group (SQL, table name, PL/SQL), nested groups included. */
function sourceTexts(value: ApxValue | undefined, into: string[] = []): string[] {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value)) for (const entry of value) sourceTexts(entry, into);
  else if (isObject(value) && !isRef(value))
    for (const [key, entry] of Object.entries(value)) if (!CONTENT_KEYS.has(key)) sourceTexts(entry, into);
  return into;
}

/** Sources of a region and of its own parts (chart series, map layers, columns); not sub-regions. */
function regionTexts(region: ApxComponent): string[] {
  const texts = sourceTexts(region.props.source);
  const visit = (children: ApxComponent[]) => {
    for (const child of children) {
      if (child.type === 'region') continue;
      sourceTexts(child.props.source, texts);
      visit(child.children);
    }
  };
  visit(region.children);
  return texts;
}

/** Local tables and views by upper-case name; views resolve to the base tables they read. */
function catalog(renderer: ApexRenderer): (names: Set<string>) => string[] {
  const objects = new Map<string, string | null>();
  for (const row of renderer.db.db
    .prepare(
      "select name, type, sql from sqlite_master where type in ('table','view') and name not like 'sqlite_%'",
    )
    .all() as { name: string; type: string; sql: string | null }[])
    objects.set(row.name.toUpperCase(), row.type === 'view' ? (row.sql ?? '') : null);
  const resolve = (names: Set<string>, seen = new Set<string>()): string[] => {
    const tables = new Set<string>();
    for (const name of names) {
      if (!objects.has(name) || seen.has(name)) continue;
      seen.add(name);
      const view = objects.get(name);
      if (view === null) tables.add(name);
      else for (const table of resolve(identifiers(view ?? ''), seen)) tables.add(table);
    }
    return [...tables].sort();
  };
  return resolve;
}

export function liveRegions(renderer: ApexRenderer, ctx: RenderContext): Record<string, LiveRegion> {
  const regions = renderer.pageComponents(ctx, 'region');
  const resolve = catalog(renderer);
  const tablesOf = (region: ApxComponent) => resolve(identifiers(regionTexts(region).join('\n')));
  const result: Record<string, LiveRegion> = {};
  for (const region of regions) {
    const type = str(region.props, 'type');
    let tables = tablesOf(region);
    // Faceted search and smart filters count the rows of the region they filter.
    if (FILTER_REGION_TYPES.has(type)) {
      const filtered = regions.find(
        (candidate) => candidate.id === ref(region.props, 'source.filteredRegion'),
      );
      tables = filtered ? tablesOf(filtered) : [];
    }
    if (!tables.length) continue;
    result[renderer.regionDomId(region)] = { tables, ...(type === 'form' ? { form: true } : {}) };
  }
  return result;
}

function page(renderer: ApexRenderer, ctx: RenderContext): void {
  // The socket belongs to the page with the developer toolbar, not to its dialogs.
  if (!renderer.options.toolbar || renderer.isDialog(ctx.page)) return;
  // Connected mode rolls back every request: there are no data changes to follow, only source edits.
  const config = { page: ctx.pageId, regions: renderer.oracle ? {} : liveRegions(renderer, ctx) };
  ctx.onload.push(`apexLocal.live.start(${JSON.stringify(config).replaceAll('<', '\\u003c')});`);
}

const toolbar = () =>
  '<button type="button" class="apex-local-tb-button apex-local-live" data-apex-local-live title="Live updates over WebSocket: connecting"><span class="apex-local-live-dot is-wait" aria-hidden="true"></span><span class="apex-local-tb-label">Live</span><span class="apex-local-badge is-info apex-local-live-count" hidden></span></button>';

const CLIENT = String.raw`
apexLocal.live = (function ($) {
  "use strict";
  var KEY = "apexLocal.live", SCROLL = "apexLocal.live.scroll", GAP = 800;
  var state = { on: true, socket: null, connected: false, wasConnected: false, retry: 0, timer: 0,
    data: true, expired: false, page: "", regions: {}, viewers: 0, sessions: 0, users: [] };
  var queue = {};
  // Requests of this tab carry its id, so its own changes are told apart from other tabs'.
  var TAB = Math.random().toString(36).slice(2, 10);
  var sameOrigin = function (url) { try { return new URL(url, location.href).origin === location.origin; } catch (e) { return false; } };
  var nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === "string" || input instanceof URL ? String(input) : input && input.url;
    if (url && sameOrigin(url)) {
      var headers = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
      headers.set("x-apex-local-tab", TAB);
      init = Object.assign({}, init, { headers: headers });
    }
    return nativeFetch.call(this, input, init);
  };
  $.ajaxPrefilter(function (options, original, xhr) {
    if (!options.crossDomain) xhr.setRequestHeader("x-apex-local-tab", TAB);
  });

  function read(key) { try { return window.sessionStorage.getItem(key); } catch (e) { return null; } }
  function enabled() { try { return window.localStorage.getItem(KEY) !== "off"; } catch (e) { return true; } }
  function remember(on) { try { window.localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { /* private mode */ } }

  function paint() {
    var button = document.querySelector("[data-apex-local-live]");
    if (!button) return;
    var mode = !state.on ? "off" : state.connected ? "live" : "wait";
    button.querySelector(".apex-local-live-dot").className = "apex-local-live-dot is-" + mode;
    button.classList.toggle("is-on", mode === "live");
    var count = button.querySelector(".apex-local-live-count");
    count.textContent = mode === "live" && state.viewers > 1 ? String(state.viewers) : "";
    count.hidden = !count.textContent;
    var watched = Object.keys(state.regions).length;
    button.title = mode === "off" ? "Live updates are off; click to turn them on"
      : mode === "wait" ? "Live updates: connecting to the preview server"
      : "Live over WebSocket · " + (state.data ? watched + (watched === 1 ? " region follows its tables" : " regions follow their tables") : "source reload only (connected mode)") +
        " · " + state.viewers + (state.viewers === 1 ? " tab" : " tabs") + " on this page" + (state.users.length ? " (" + state.users.join(", ") + ")" : "") + " · click to turn off";
  }

  function toasts() {
    var box = document.querySelector(".apex-local-live-toasts");
    if (!box) {
      box = document.createElement("div");
      box.className = "apex-local-live-toasts";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      document.body.appendChild(box);
    }
    // Just above the developer toolbar, which wraps to two rows on narrow screens.
    var toolbar = document.getElementById("apexLocalToolbar");
    box.style.bottom = (toolbar ? toolbar.offsetHeight + 8 : 16) + "px";
    return box;
  }
  // A short notice above the toolbar; "sticky" notices stay until closed or acted on.
  function toast(text, level, action) {
    var box = toasts(), note = document.createElement("div");
    note.className = "apex-local-live-toast is-" + (level || "info");
    var label = document.createElement("span");
    label.textContent = text;
    note.appendChild(label);
    if (action) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.onclick = function () { note.remove(); action.run(); };
      note.appendChild(button);
    }
    var close = document.createElement("button");
    close.type = "button";
    close.className = "apex-local-live-close";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";
    close.onclick = function () { note.remove(); };
    note.appendChild(close);
    box.appendChild(note);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    if (!action && level !== "error") setTimeout(function () { note.remove(); }, 4500);
  }

  function flash(id) {
    var element = document.getElementById(id);
    if (!element) return;
    element.classList.remove("apex-local-live-flash");
    void element.offsetWidth;
    element.classList.add("apex-local-live-flash");
    setTimeout(function () { element.classList.remove("apex-local-live-flash"); }, 1500);
  }

  // Never throw away grid edits the user has not saved yet (the preview grid model is "<region>_ig_grid").
  function unsaved(id) {
    var name = id + "_ig_grid", model = apex.model && apex.model.get ? apex.model.get(name) : null;
    if (!model) return false;
    try { return model.isChanged(); } finally { apex.model.release(name); }
  }

  function refresh(id) {
    if (!document.getElementById(id)) return Promise.resolve(false);
    if (unsaved(id)) {
      toast("Data of " + id + " changed elsewhere; save or cancel your edits to see it", "warning");
      return Promise.resolve(false);
    }
    if (apex.region.isRegion && apex.region.isRegion(id))
      return Promise.resolve(apex.region(id).refresh()).then(function () { return true; });
    return apexLocal.refreshRegion(id).then(function () { return true; });
  }

  // One refresh per region at a time, at most one every GAP ms; changes that arrive meanwhile coalesce.
  function schedule(id) {
    var entry = queue[id] || (queue[id] = { running: false, pending: false, last: 0 });
    if (entry.running) { entry.pending = true; return; }
    entry.running = true;
    setTimeout(function () {
      var done = function (refreshed) {
        entry.running = false;
        entry.last = Date.now();
        if (refreshed === true) flash(id);
        if (entry.pending) { entry.pending = false; schedule(id); }
      };
      refresh(id).then(done, done);
    }, Math.max(0, entry.last + GAP - Date.now()));
  }

  function changed(message) {
    if (!state.data) return;
    var tables = message.tables || [], regions = [], forms = [], held = [];
    Object.keys(state.regions).forEach(function (id) {
      var region = state.regions[id];
      if (!document.getElementById(id)) return;
      if (!region.tables.some(function (table) { return tables.indexOf(table) >= 0; })) return;
      // A grid with unsaved edits is left alone: the one this tab is saving refreshes itself once
      // its save returns, and another one keeps its user's edits (with a notice).
      if (unsaved(id)) {
        if (!message.here) held.push(id);
        return;
      }
      (region.form ? forms : regions).push(id);
    });
    regions.forEach(schedule);
    // This tab's own changes refresh its other regions quietly (a chart next to the grid it saved).
    if (message.here) return;
    var who = message.self ? "Another tab" : message.user;
    if (regions.length)
      toast(who + " changed " + tables.join(", ") + " · " + regions.length + " region" + (regions.length > 1 ? "s" : "") + " updated", "info");
    held.forEach(function (id) {
      toast("Data of " + id + " changed elsewhere; save or cancel your edits to see it", "warning");
    });
    if (forms.length)
      toast(who + " changed " + tables.join(", ") + "; this form may show old values", "warning",
        { label: "Reload", run: reload });
  }

  function reload() {
    try { window.sessionStorage.setItem(SCROLL, JSON.stringify({ url: location.href, y: window.scrollY })); } catch (e) { /* private mode */ }
    location.reload();
  }

  function sourceChanged(message) {
    var dirty = apex.page && apex.page.isChanged && apex.page.isChanged();
    if (dirty) toast("Application source changed (" + (message.file || "APEXlang") + ")", "warning", { label: "Reload", run: reload });
    else reload();
  }

  function receive(event) {
    var message;
    try { message = JSON.parse(event.data); } catch (e) { return; }
    if (message.type === "hello") {
      state.data = !!message.data;
      // Changes made while the socket was down were missed: bring every followed region up to date.
      // Only after hello, which a server that no longer knows this session never sends.
      if (state.wasConnected && state.data) Object.keys(state.regions).forEach(function (id) {
        if (!state.regions[id].form) schedule(id);
      });
      state.wasConnected = true;
    }
    else if (message.type === "presence") {
      state.viewers = message.viewers || 0;
      state.sessions = message.sessions || 0;
      state.users = message.users || [];
    } else if (message.type === "changed") changed(message);
    else if (message.type === "reload") sourceChanged(message);
    else if (message.type === "source-error") toast("APEXlang parse error: " + message.message, "error");
    else if (message.type === "expired") {
      state.expired = true;
      toast("The preview server restarted; this page's session is gone", "warning", { label: "Reload", run: reload });
    }
    paint();
  }

  function connect() {
    if (!state.on || state.socket || !window.WebSocket) return;
    var base = location.pathname.replace(/\/[^/]*$/, "");
    var socket = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + base +
      "/__apex/live?page=" + encodeURIComponent(state.page) + "&tab=" + TAB);
    state.socket = socket;
    socket.onopen = function () {
      state.connected = true;
      state.retry = 0;
      paint();
    };
    socket.onmessage = receive;
    socket.onclose = function () {
      if (state.socket !== socket) return;
      state.socket = null;
      state.connected = false;
      paint();
      if (!state.on || state.expired) return;
      state.retry += 1;
      state.timer = setTimeout(connect, Math.min(10000, 500 * Math.pow(2, state.retry)));
    };
  }

  function disconnect() {
    clearTimeout(state.timer);
    var socket = state.socket;
    state.socket = null;
    state.connected = false;
    if (socket) socket.close();
    paint();
  }

  $(document).on("click", "[data-apex-local-live]", function () {
    state.on = !state.on;
    remember(state.on);
    if (state.on) { state.retry = 0; connect(); } else disconnect();
    paint();
  });
  window.addEventListener("pagehide", function () { if (state.socket) state.socket.close(); });
  window.addEventListener("pageshow", function (event) { if (event.persisted) connect(); });

  return {
    start: function (config) {
      state.page = config.page;
      state.regions = config.regions || {};
      state.on = enabled();
      var scroll = read(SCROLL);
      if (scroll) {
        try {
          var position = JSON.parse(scroll);
          window.sessionStorage.removeItem(SCROLL);
          if (position.url === location.href) window.scrollTo(0, position.y);
        } catch (e) { /* ignore */ }
      }
      paint();
      connect();
    },
    state: function () { return { on: state.on, connected: state.connected, data: state.data, viewers: state.viewers, users: state.users.slice(), regions: state.regions }; }
  };
})(apex.jQuery);
`;

const CSS = `
.apex-local-live-dot{display:inline-block;width:8px;height:8px;margin:4px;border-radius:50%;background:#8a8a8a}
.apex-local-live-dot.is-live{background:#3fd27a;animation:apexLocalLivePulse 2s infinite}
.apex-local-live-dot.is-wait{background:#ffb347}
@keyframes apexLocalLivePulse{0%{box-shadow:0 0 0 0 rgba(63,210,122,.6)}70%{box-shadow:0 0 0 6px rgba(63,210,122,0)}100%{box-shadow:0 0 0 0 rgba(63,210,122,0)}}
.apex-local-live-flash{animation:apexLocalLiveFlash 1.4s ease-out}
@keyframes apexLocalLiveFlash{0%{box-shadow:0 0 0 3px rgba(255,179,71,.95)}100%{box-shadow:0 0 0 3px rgba(255,179,71,0)}}
.apex-local-live-toasts{position:fixed;left:16px;bottom:52px;z-index:2001;display:flex;flex-direction:column;gap:6px;max-width:min(440px,calc(100vw - 32px));font:12px/16px var(--a-base-font-family,system-ui,sans-serif)}
.apex-local-live-toast{display:flex;gap:10px;align-items:center;padding:8px 8px 8px 12px;border-radius:8px;border-inline-start:3px solid #3fd27a;background:rgba(24,24,28,.94);color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.3);animation:apexLocalLiveIn .18s ease-out}
.apex-local-live-toast>span{flex:1}
.apex-local-live-toast.is-warning{border-inline-start-color:#ffb347}
.apex-local-live-toast.is-error{border-inline-start-color:#ea1818}
.apex-local-live-toast button{padding:2px 8px;border:1px solid rgba(255,255,255,.3);border-radius:4px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.apex-local-live-toast button.apex-local-live-close{border:0;font-size:16px;line-height:16px;opacity:.7}
@keyframes apexLocalLiveIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.apex-local-live-dot.is-live,.apex-local-live-flash,.apex-local-live-toast{animation:none}}
@media print{.apex-local-live-toasts{display:none}}
`;

registerExtension({ name: 'live', page, toolbar, client: CLIENT, css: CSS });
