/** Browser half of the developer tools: toolbar panels, viewport frame and stand-in dynamic actions. */

export const DEVTOOLS_CSS = `
.apex-local-tb-group{display:flex;flex:0 0 auto}
.apex-local-tb-group>.apex-local-tb-button{padding-inline:8px}
.apex-local-panel h3{margin:10px 12px 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;opacity:.75}
.apex-local-muted{opacity:.65;font-weight:400}
.apex-local-table{width:calc(100% - 24px);margin:0 12px;border-collapse:collapse}
.apex-local-table th,.apex-local-table td{padding:3px 6px;border-bottom:1px solid rgba(255,255,255,.07);text-align:start;vertical-align:middle;font-weight:400}
.apex-local-table th{width:38%;color:#cfe3ff;word-break:break-all}
.apex-local-input{box-sizing:border-box;width:100%;padding:3px 6px;border:1px solid rgba(255,255,255,.22);border-radius:3px;background:rgba(0,0,0,.35);color:#fff;font:inherit}
.apex-local-input:focus{outline:2px solid #4c9aff;outline-offset:-1px}
.apex-local-input.is-changed{border-color:#ffb347}
.apex-local-panel>header .apex-local-input{width:180px}
.apex-local-row{display:flex;gap:8px;margin:8px 12px 0}
.apex-local-action{padding:4px 10px;border:1px solid rgba(255,255,255,.25);border-radius:4px;background:rgba(255,255,255,.08);color:#fff;font:inherit;cursor:pointer}
.apex-local-action:hover{background:rgba(255,255,255,.16)}
.apex-local-action.is-primary{background:#0572ce;border-color:#0572ce}
.apex-local-check{display:block;padding:3px 0}
.apex-local-viewas{padding:8px 12px}
.apex-local-viewas fieldset{margin:8px 0;padding:6px 10px;border:1px solid rgba(255,255,255,.15);border-radius:4px}
.apex-local-viewas .apex-local-row{margin:8px 0 0}
.apex-local-pages{margin:0;padding:4px 0;list-style:none;columns:2 260px}
.apex-local-pages li{display:flex;gap:6px;align-items:center;padding:2px 12px;break-inside:avoid}
.apex-local-pages li.is-current{background:rgba(5,114,206,.35)}
.apex-local-pages a{color:#fff;text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.apex-local-pages a:hover{text-decoration:underline}
.apex-local-page-id{display:inline-block;min-width:44px;color:#9fd0ff;font-variant-numeric:tabular-nums}
.apex-local-tag{padding:0 5px;border-radius:3px;background:rgba(255,255,255,.12);font-size:10px}
.apex-local-debug{padding:4px 12px}
.apex-local-debug details{border-bottom:1px solid rgba(255,255,255,.08)}
.apex-local-debug summary{display:flex;gap:8px;padding:5px 0;cursor:pointer}
.apex-local-debug summary strong{flex:1}
.apex-local-debug table{width:100%;border-collapse:collapse;margin:0 0 6px}
.apex-local-debug td{padding:2px 6px;vertical-align:top;border-top:1px solid rgba(255,255,255,.05)}
.apex-local-debug td:first-child,.apex-local-debug td:last-child{white-space:nowrap;opacity:.7;font-variant-numeric:tabular-nums;text-align:end}
.apex-local-debug td.t{width:56px}
.apex-local-debug .is-warning{color:#ffd479}.apex-local-debug .is-error{color:#ff9b9b}
.apex-local-debug .k{display:inline-block;min-width:84px;font-size:10px;text-transform:uppercase;opacity:.75}
.apex-local-viewport{position:fixed;inset:0;z-index:1990;display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 0 56px;background:#3a3d42;box-sizing:border-box}
.apex-local-viewport-device{flex:1 1 auto;max-height:100%;border-radius:18px;padding:10px;background:#111;box-shadow:0 12px 40px rgba(0,0,0,.45)}
.apex-local-viewport iframe{display:block;width:100%;height:100%;border:0;border-radius:10px;background:#fff}
.apex-local-viewport-label{color:#e8e8e8;font:12px/16px system-ui,sans-serif}
html.apex-local-viewport-on,html.apex-local-viewport-on body{overflow:hidden}
.apex-local-ai{display:flex;flex-direction:column;gap:8px;font-size:14px}
.apex-local-ai-note{padding:6px 10px;border-radius:4px;background:#fff4ce;color:#5c4400;font-size:12px}
.apex-local-ai-log{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none;max-height:320px;overflow:auto}
.apex-local-ai-log li{max-width:85%;padding:6px 10px;border-radius:10px;background:rgba(0,0,0,.06);white-space:pre-wrap}
.apex-local-ai-log li.is-user{align-self:flex-end;background:#0572ce;color:#fff}
.apex-local-ai-quick{display:flex;flex-wrap:wrap;gap:6px}
.apex-local-ai form{display:flex;gap:6px}
.apex-local-ai textarea{flex:1;min-height:38px;font:inherit;padding:6px}
.apex-local-ai-inline{padding:12px;border:1px dashed rgba(0,0,0,.25);border-radius:6px}
.apex-local-ai-overlay{position:fixed;inset:0;z-index:1500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35)}
.apex-local-ai-overlay>.apex-local-ai{width:min(520px,calc(100vw - 32px));padding:16px;border-radius:8px;background:#fff;color:#222;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.apex-local-wf{overflow:auto;padding:4px 0}
.apex-local-wf-caption{display:flex;gap:8px;align-items:center;margin-bottom:8px;font-weight:600}
.apex-local-wf-note{margin-inline-start:auto;font-weight:400;font-size:11px;opacity:.65}
.apex-local-wf-svg{display:block;max-width:none;font:12px/1 var(--a-base-font-family,system-ui,sans-serif)}
.apex-local-wf-node{fill:var(--ut-component-background-color,#fff);stroke:var(--ut-component-border-color,#c8c8c8);stroke-width:1.5}
.apex-local-wf-node.is-workflowStart{fill:#e6f4ea;stroke:#2e7d32}.apex-local-wf-node.is-workflowEnd{fill:#fdecea;stroke:#c62828}
.apex-local-wf-node.is-switch{fill:#fff8e1;stroke:#b26a00}.apex-local-wf-node.is-humanTaskCreate{stroke:#0572ce}
.apex-local-wf-kind{text-anchor:middle;font-size:10px;fill:currentColor;opacity:.6;text-transform:uppercase;letter-spacing:.04em}
.apex-local-wf-name{text-anchor:middle;font-size:12px;fill:currentColor}
.apex-local-wf-edge{fill:none;stroke:#7a7a7a;stroke-width:1.5}
.apex-local-wf-edge.is-error{stroke:#c62828;stroke-dasharray:5 3}.apex-local-wf-edge.is-timeout{stroke:#b26a00;stroke-dasharray:5 3}
.apex-local-wf-label{font-size:11px;fill:currentColor;opacity:.75}
#apexLocalWfArrow path{fill:#7a7a7a}
`;

export const DEVTOOLS_JS = String.raw`
(function ($) {
  "use strict";
  var base = location.pathname.replace(/\/[^/]*$/, "");
  var route = function (name) { return base + "/__apex/x/" + name; };
  var VIEWPORTS = { tablet: { width: 768, height: 1024, label: "Tablet · 768 × 1024" }, phone: { width: 375, height: 812, label: "Phone · 375 × 812" } };
  var framed = (function () { try { return !!(window.frameElement && window.frameElement.id === "apexLocalViewportFrame"); } catch (e) { return false; } })();
  function store(kind, key, value) {
    try {
      var area = kind === "session" ? window.sessionStorage : window.localStorage;
      if (value === undefined) return area.getItem(key);
      if (value === null) area.removeItem(key); else area.setItem(key, value);
    } catch (e) { return null; }
    return null;
  }
  function post(name, body) {
    return fetch(route(name) + "?page=" + encodeURIComponent((apex.env && apex.env.APP_PAGE_ID) || ""), {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {})
    }).then(function (response) { return response.json().catch(function () { return {}; }); });
  }
  function logEvent(name, detail, level) {
    return post("debug-log", { event: { name: name, detail: detail || "", level: level || "info" } }).catch(function () {});
  }
  function escapeHtml(value) { return apex.util.escapeHTML(String(value === undefined || value === null ? "" : value)); }

  // ---------------------------------------------------------------- toolbar
  var toolbar = document.getElementById("apexLocalToolbar");
  if (toolbar && framed) toolbar.parentNode.removeChild(toolbar);
  else if (toolbar) initToolbar();

  function initToolbar() {
    if (store("local", "apexLocalToolbarCollapsed") === "1") toolbar.classList.add("is-collapsed");
    function panelOf(name) { return toolbar.querySelector('.apex-local-panel[data-panel="' + name + '"]'); }
    function closeAll(except) {
      toolbar.querySelectorAll(".apex-local-panel").forEach(function (panel) { if (panel !== except) panel.hidden = true; });
      toolbar.querySelectorAll("[data-apex-local-panel]").forEach(function (button) {
        var open = except && button.getAttribute("data-apex-local-panel") === except.getAttribute("data-panel");
        button.classList.toggle("is-active", !!open);
        button.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    toolbar.addEventListener("click", function (event) {
      var toggle = event.target.closest("[data-apex-local-panel]");
      if (toggle) {
        var panel = panelOf(toggle.getAttribute("data-apex-local-panel"));
        if (!panel) return;
        var open = panel.hidden;
        closeAll(open ? panel : null);
        panel.hidden = !open;
        if (open) $(panel).trigger("apexlocalpanelopen");
        if (open && panel.getAttribute("data-panel") === "debug") loadDebug();
        if (open) { var first = panel.querySelector("input[type=search]"); if (first) first.focus(); }
        return;
      }
      if (event.target.closest("[data-apex-local-collapse]")) {
        closeAll(null);
        var collapsed = toolbar.classList.toggle("is-collapsed");
        store("local", "apexLocalToolbarCollapsed", collapsed ? "1" : null);
        return;
      }
      var viewport = event.target.closest("[data-apex-local-viewport]");
      if (viewport) return setViewport(viewport.getAttribute("data-apex-local-viewport"));
      if (event.target.closest("[data-apex-local-reset]")) return resetData();
      if (event.target.closest("[data-apex-local-debug-refresh]")) return loadDebug();
      if (event.target.closest("[data-apex-local-debug-clear]")) return post("debug-log", { clear: true }).then(loadDebug);
      var clear = event.target.closest("[data-apex-local-clear-page]");
      if (clear) return post("session-state", { clearPage: clear.getAttribute("data-apex-local-clear-page") }).then(function () { location.reload(); });
    });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeAll(null); });
    document.addEventListener("mousedown", function (event) { if (!toolbar.contains(event.target)) closeAll(null); });

    toolbar.addEventListener("input", function (event) {
      var input = event.target;
      if (input.hasAttribute("data-apex-local-item"))
        input.classList.toggle("is-changed", input.value !== input.getAttribute("data-original"));
      if (input.hasAttribute("data-apex-local-page-filter")) {
        var needle = input.value.toLowerCase();
        toolbar.querySelectorAll(".apex-local-pages li").forEach(function (li) {
          li.style.display = !needle || li.textContent.toLowerCase().indexOf(needle) >= 0 ? "" : "none";
        });
      }
    });
    toolbar.addEventListener("submit", function (event) {
      var form = event.target;
      event.preventDefault();
      if (form.hasAttribute("data-apex-local-session")) {
        var items = {};
        form.querySelectorAll("[data-apex-local-item]").forEach(function (input) {
          if (input.value !== input.getAttribute("data-original")) items[input.getAttribute("data-apex-local-item")] = input.value;
        });
        var name = form.querySelector("[data-apex-local-new-name]").value.trim();
        if (name) items[name] = form.querySelector("[data-apex-local-new-value]").value;
        post("session-state", { items: items }).then(function () { location.reload(); });
      } else if (form.hasAttribute("data-apex-local-viewas")) {
        var on = form.querySelector("input[name=mode]:checked");
        var pick = function (field) { return Array.prototype.map.call(form.querySelectorAll("input[name=" + field + "]:checked"), function (input) { return input.value; }); };
        post("view-as", on && on.value === "on" ? { roles: pick("role"), deny: pick("deny") } : { off: true }).then(function () { location.reload(); });
      }
    });
    var mode = store("session", "apexLocalViewport");
    if (mode && VIEWPORTS[mode]) setViewport(mode);
  }

  function resetData() {
    apex.message.confirm("Reset data? This drops every table of the local SQLite database and seeds it again from .apex-local/*.sql (or supporting objects). Changes made in the preview are lost.", function (ok) {
      if (!ok) return;
      post("reset-data", {}).then(function (result) {
        if (result && result.error) apex.message.alert("Reset failed: " + result.error);
        else location.reload();
      });
    }, { title: "Reset local data", style: "danger", confirmLabel: "Reset data" });
  }

  // ---------------------------------------------------------------- debug log
  function loadDebug() {
    var target = toolbar.querySelector("[data-apex-local-debug]");
    if (!target) return undefined;
    return fetch(route("debug-log"), { credentials: "same-origin" }).then(function (response) { return response.json(); }).then(function (data) {
      var entries = (data && data.entries) || [];
      if (!entries.length) { target.innerHTML = '<p class="apex-local-muted">No requests logged yet.</p>'; return; }
      target.innerHTML = entries.map(function (entry, index) {
        var warnings = entry.events.filter(function (event) { return event.level === "warning" || event.level === "error"; }).length;
        var rows = entry.events.map(function (event) {
          return '<tr class="is-' + escapeHtml(event.level || "info") + '"><td class="t">' + event.t.toFixed(1) + '</td><td><span class="k">' + escapeHtml(event.type) + "</span>" +
            (event.name ? "<code>" + escapeHtml(event.name) + "</code> " : "") + escapeHtml(event.detail || "") + "</td><td>" + (event.ms !== undefined ? event.ms.toFixed(1) + " ms" : "") + "</td></tr>";
        }).join("");
        return "<details" + (index === 0 ? " open" : "") + "><summary><strong>" + escapeHtml(entry.title) + "</strong><span>" + escapeHtml(entry.detail) + "</span>" +
          (warnings ? '<span class="is-warning">' + warnings + " warnings</span>" : "") + "<span>" + entry.ms.toFixed(1) + " ms</span><span class=\"apex-local-muted\">" +
          escapeHtml(entry.started.slice(11, 19)) + "</span></summary><table>" + (rows || '<tr><td colspan="3">No events</td></tr>') + "</table></details>";
      }).join("");
    });
  }

  // ---------------------------------------------------------------- viewport
  function setViewport(mode) {
    var existing = document.getElementById("apexLocalViewport");
    if (existing) {
      var frame = existing.querySelector("iframe");
      var href = null;
      try { href = frame.contentWindow.location.href; } catch (e) { href = null; }
      existing.parentNode.removeChild(existing);
      document.documentElement.classList.remove("apex-local-viewport-on");
      if (mode === "desktop" || !VIEWPORTS[mode]) {
        store("session", "apexLocalViewport", null);
        markViewport("desktop");
        if (href && href !== location.href && href.indexOf("/__apex/") < 0) location.href = href;
        return;
      }
    }
    if (!VIEWPORTS[mode]) { store("session", "apexLocalViewport", null); markViewport("desktop"); return; }
    var size = VIEWPORTS[mode];
    store("session", "apexLocalViewport", mode);
    var overlay = document.createElement("div");
    overlay.id = "apexLocalViewport";
    overlay.className = "apex-local-viewport";
    overlay.setAttribute("data-mode", mode);
    overlay.innerHTML = '<div class="apex-local-viewport-device" style="width:' + size.width + 'px;height:' + size.height + 'px"><iframe id="apexLocalViewportFrame" title="' + size.label + '"></iframe></div><div class="apex-local-viewport-label">' + size.label + " · navigation stays in the frame</div>";
    document.body.appendChild(overlay);
    overlay.querySelector("iframe").src = location.href;
    document.documentElement.classList.add("apex-local-viewport-on");
    markViewport(mode);
  }
  function markViewport(mode) {
    if (!toolbar) return;
    toolbar.querySelectorAll("[data-apex-local-viewport]").forEach(function (button) {
      var on = button.getAttribute("data-apex-local-viewport") === mode;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  // ---------------------------------------------------------------- stand-in dynamic actions
  var PLACEHOLDER = "[Local preview placeholder] Generative AI is not called in the local preview.";
  function evaluate(code, trigger) {
    try { return Function("return (" + code + ")").call({ triggeringElement: trigger }); } catch (e) { apex.debug.error(e); return ""; }
  }
  function placeholder(prompt, agent) {
    var shown = String(prompt || "").replace(/\s+/g, " ").trim();
    if (shown.length > 160) shown = shown.slice(0, 157) + "…";
    return PLACEHOLDER + (agent ? " AI agent: " + agent + "." : "") + (shown ? " Prompt: “" + shown + "”" : "");
  }
  function inputOf(groups, trigger) {
    var input = groups.inputValue || {};
    var type = input.type || (input.item ? "item" : "");
    if (type === "item" && input.item) return apex.item(input.item).getValue();
    if ((type === "jsCode" || type === "jsExpression") && input.jsExpression) return evaluate(input.jsExpression, trigger);
    return "";
  }
  function generateText(action, event, trigger, helpers) {
    var groups = action.groups || {};
    var gen = groups.genAI || {};
    var prompt = [gen.systemPrompt, inputOf(groups, trigger)].filter(Boolean).join(" ");
    var text = placeholder(prompt, gen.agent);
    helpers.each(action.selector, trigger, function (item) { item.setValue(text); }, function (el) { el.text(text); });
    logEvent("AI placeholder (generateTextWithAi)", text);
  }
  function assistant(action, event, trigger) {
    var groups = action.groups || {};
    var gen = groups.genAI || {}, appearance = groups.appearance || {}, quick = groups.quickActions || {}, initial = groups.initialPrompt || {}, use = groups.useResponse || {};
    var box = $('<div class="apex-local-ai"><div class="apex-local-ai-note">Local preview: replies are placeholders. No AI service is called.</div><ol class="apex-local-ai-log" aria-live="polite"></ol><div class="apex-local-ai-quick"></div><form><textarea aria-label="Message"></textarea><button type="submit" class="t-Button t-Button--hot">Send</button></form></div>');
    var log = box.find(".apex-local-ai-log");
    function say(text, user) {
      var li = $("<li></li>").text(text).toggleClass("is-user", !!user).appendTo(log);
      if (!user && use.type && (use.item || use.jsCode)) {
        $('<button type="button" class="t-Button t-Button--small">' + escapeHtml(use.buttonLabel || "Use response") + "</button>").appendTo(li).on("click", function () {
          if (use.type === "item" && use.item) apex.item(use.item).setValue(text, null, !!use.suppressChangeEvent);
          else if (use.jsCode) Function("response", use.jsCode).call({ triggeringElement: trigger }, { content: text });
        });
      }
      log.scrollTop(log[0].scrollHeight);
    }
    function send(message) {
      if (!message) return;
      say(message, true);
      var reply = placeholder(message, gen.agent);
      say(reply, false);
      logEvent("AI assistant placeholder (showAiAssistant)", message);
    }
    say(gen.welcomeMessage || "Hello! (The local preview does not call an AI service.)", false);
    [quick.message1, quick.message2].filter(Boolean).forEach(function (message) {
      $('<button type="button" class="t-Button t-Button--small"></button>').text(message).appendTo(box.find(".apex-local-ai-quick")).on("click", function () { send(message); });
    });
    box.find("form").on("submit", function (e) { e.preventDefault(); var area = box.find("textarea"); send(area.val().trim()); area.val(""); });
    if (appearance.displayAs === "inline" && appearance.containerSelector && $(appearance.containerSelector).length) {
      $(appearance.containerSelector).empty().append(box.addClass("apex-local-ai-inline"));
    } else {
      var overlay = $('<div class="apex-local-ai-overlay" role="dialog" aria-modal="true"></div>').append(box).appendTo(document.body);
      box.prepend($('<div style="display:flex;justify-content:space-between;align-items:center"><strong></strong><button type="button" class="t-Button t-Button--noUI t-Button--icon" aria-label="Close"><span class="fa fa-times" aria-hidden="true"></span></button></div>'));
      box.find("strong").first().text(appearance.title || "AI Assistant");
      box.find("[aria-label=Close]").on("click", function () { overlay.remove(); });
      overlay.on("keydown", function (e) { if (e.key === "Escape") overlay.remove(); });
      box.find("textarea").trigger("focus");
    }
    var first = initial.type === "item" && initial.item ? apex.item(initial.item).getValue() : initial.type === "jsExpression" && initial.jsExpression ? evaluate(initial.jsExpression, trigger) : "";
    if (first) send(String(first));
  }
  function notSimulated(name, why) {
    return function () {
      console.info("[apex-local] " + name + ": " + why);
      logEvent(name + " not simulated", why, "warning");
    };
  }
  function tree(command) {
    return function (action, event, trigger, helpers) {
      helpers.elements(action.selector, trigger).each(function () {
        var tree$ = $(this).find(".a-TreeView").addBack(".a-TreeView").first();
        try { if (tree$.length && tree$.treeView) tree$.treeView(command); } catch (e) { apex.debug.warn(e); }
      });
    };
  }
  var FALLBACKS = {
    generateTextWithAi: generateText,
    showAiAssistant: assistant,
    triggerGeocoding: notSimulated("triggerGeocoding", "no geocoding service offline; item values are left unchanged"),
    download: notSimulated("download", "no file is produced locally"),
    printReport: notSimulated("printReport", "no report server locally"),
    invokeInteractiveReportDialog: notSimulated("invokeInteractiveReportDialog", "use the report's Actions menu"),
    expandTree: tree("expandAll"),
    collapseTree: tree("collapseAll")
  };
  // Registered on DOM ready so feature modules that implement these actions take precedence.
  $(function () {
    Object.keys(FALLBACKS).forEach(function (name) {
      if (!apexLocal.hasAction || !apexLocal.hasAction(name)) apexLocal.registerAction(name, FALLBACKS[name]);
    });
  });
})(apex.jQuery);
`;
