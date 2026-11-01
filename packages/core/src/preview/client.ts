/** Browser-side helpers served next to the genuine APEX JavaScript. */

export const RUNTIME_CSS = `
/* Developer toolbar: after APEX's runtime developer toolbar (a-DevToolbar, Theme-Standard tokens). */
.apex-local-toolbar{--apex-local-tb-bg:rgba(0,0,0,.75);--apex-local-tb-active:rgba(0,0,0,.5);--apex-local-tb-sep:rgba(255,255,255,.12);position:fixed;left:0;right:0;bottom:0;margin-inline:auto;width:fit-content;z-index:2000;max-width:calc(100vw - 16px);font:12px/16px var(--a-base-font-family,system-ui,sans-serif);color:#fff;text-align:start}
.apex-local-tb-bar{display:flex;align-items:stretch;background:var(--apex-local-tb-bg);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);box-shadow:0 0 12px rgba(0,0,0,.3);border-start-start-radius:8px;border-start-end-radius:8px;flex-wrap:wrap;justify-content:center}
.apex-local-tb-bar>*+*{border-inline-start:1px solid var(--apex-local-tb-sep)}
.apex-local-tb-brand,.apex-local-tb-button,.apex-local-style{display:flex;align-items:center;gap:4px;flex:0 0 auto;padding:8px 12px;margin:0;border:0;border-radius:0;background:transparent;color:inherit;font:inherit;white-space:nowrap;cursor:pointer}
.apex-local-tb-brand{cursor:default;font-weight:600;opacity:.85}
.apex-local-tb-button:hover,.apex-local-tb-button:focus-visible,.apex-local-tb-button.is-active,.apex-local-style:hover{background:var(--apex-local-tb-active);outline:none}
.apex-local-tb-button.is-on{box-shadow:inset 0 -2px 0 #ffb347}
.apex-local-tb-button.has-errors{background:rgba(234,24,24,.55)}
.apex-local-tb-bar .fa{font-size:14px;width:16px;text-align:center}
.apex-local-style select{margin-inline-start:2px;max-width:150px;padding:1px 2px;border:1px solid rgba(255,255,255,.3);border-radius:3px;background:rgba(0,0,0,.35);color:#fff;font:inherit}
.apex-local-style select option{color:#000}
.apex-local-badge{display:inline-block;min-width:16px;padding:0 4px;border-radius:8px;font-size:10px;line-height:16px;text-align:center;font-weight:600}
.apex-local-badge.is-error{background:#ea1818}.apex-local-badge.is-warning{background:#b26a00}.apex-local-badge.is-info{background:rgba(255,255,255,.22)}
.apex-local-panel{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);width:min(760px,calc(100vw - 16px));max-height:min(60vh,560px);overflow:auto;margin-bottom:6px;padding:0 0 8px;background:rgba(24,24,28,.94);backdrop-filter:blur(4px);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.08)}
.apex-local-panel[hidden]{display:none}
.apex-local-panel>header{position:sticky;top:0;display:flex;gap:12px;align-items:center;padding:8px 12px;background:rgba(24,24,28,.98);border-bottom:1px solid var(--apex-local-tb-sep);z-index:1}
.apex-local-panel>header strong{flex:1}
.apex-local-panel a{color:#9fd0ff}
.apex-local-diagnostics{margin:0;padding:4px 12px;list-style:none}
.apex-local-diagnostics li{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.06)}
.apex-local-diagnostics code{color:#cfe3ff;font-size:11px}
.apex-local-level{display:inline-block;width:52px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;opacity:.8}
.apex-local-diagnostics li.is-error{color:#ff9b9b}.apex-local-diagnostics li.is-warning{color:#ffd479}.apex-local-diagnostics li.is-info{color:#cfd8e3}
.apex-local-toolbar.is-collapsed .apex-local-tb-bar>:not(.apex-local-tb-collapse){display:none}
.apex-local-toolbar.is-collapsed .apex-local-tb-collapse .fa{transform:rotate(180deg)}
@media (max-width:768px){.apex-local-tb-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}}
@media print{.apex-local-toolbar{display:none}}
.apex-local-unsupported{padding:16px;border:1px dashed rgba(0,0,0,.25);border-radius:4px;color:rgba(0,0,0,.65);background:repeating-linear-gradient(45deg,rgba(0,0,0,.02),rgba(0,0,0,.02) 8px,transparent 8px,transparent 16px)}
.apex-local-chart{display:grid;gap:16px;padding:8px 0}
.apex-local-series-name{font-weight:600;margin-bottom:6px}
.apex-local-bar{display:grid;grid-template-columns:minmax(80px,30%) 1fr auto;gap:8px;align-items:center;margin:4px 0}
.apex-local-bar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.apex-local-bar-track{height:14px;background:rgba(0,0,0,.06);border-radius:3px;overflow:hidden}
.apex-local-bar-fill{display:block;height:100%;border-radius:3px}
.apex-local-bar-value{font-variant-numeric:tabular-nums}
`;

export function messagesScript(messages: Record<string, string>): string {
  return `apex.lang.addMessages(${JSON.stringify(messages)});\n`;
}

export const RUNTIME_JS = String.raw`
window.apexLocal = (function ($) {
  "use strict";
  var base = location.pathname.replace(/\/[^/]*$/, "");
  var config = { regions: [], dynamicActions: [] };
  // Extension modules add dynamic action types: apexLocal.registerAction(name, function (action, event, trigger, helpers) {...}).
  var actionHandlers = {};

  function compile(body) {
    return Function("event", body);
  }
  function expression(code, context) {
    return Function("return (" + code + ")").call(context || {});
  }
  function elements(selector, trigger) {
    if (!selector || selector === "document") return $(document);
    if (selector === "triggeringElement") return $(trigger);
    if (selector.indexOf("js:") === 0) return $(expression(selector.slice(3), { triggeringElement: trigger }));
    return $(selector);
  }
  function isItem(element) {
    var item = element && element.id ? apex.item(element.id) : null;
    return !!(item && item.node);
  }
  function each(selector, trigger, item, other) {
    elements(selector, trigger).each(function () {
      if (isItem(this)) item(apex.item(this.id), this); else other($(this));
    });
  }
  function serverCode(settings) {
    var items = {};
    String(settings.itemsToSubmit || "").split(",").forEach(function (name) {
      name = name.trim();
      if (name) items[name] = apex.item(name).getValue();
    });
    var returnItems = String(settings.itemsToReturn || "").split(",").map(function (name) { return name.trim(); }).filter(Boolean);
    return fetch(base + "/__apex/server-code?page=" + encodeURIComponent(apex.env.APP_PAGE_ID), {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ code: settings.plsqlCode || settings.code || "", items: items, returnItems: returnItems })
    }).then(function (response) { return response.json(); }).then(function (values) {
      var errors = values && Array.isArray(values.errors) ? values.errors : null;
      Object.keys(values || {}).forEach(function (name) { if (name !== "errors") apex.item(name).setValue(values[name]); });
      if (errors && errors.length) {
        // As in APEX: the error is shown and the following actions do not run.
        apex.message.clearErrors();
        apex.message.showErrors(errors);
        return Promise.reject(null);
      }
    });
  }

  function serverValue(settings) {
    var items = {};
    String(settings.itemsToSubmit || "").split(",").forEach(function (name) {
      name = name.trim();
      if (name) items[name] = apex.item(name).getValue();
    });
    return fetch(base + "/__apex/x/set-value?page=" + encodeURIComponent(apex.env.APP_PAGE_ID), {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ type: settings.type, sqlQuery: settings.sqlQuery, plsqlExpression: settings.plsqlExpression,
        plsqlFunctionBody: settings.plsqlFunctionBody, items: items })
    }).then(function (response) { return response.ok ? response.json() : { error: "HTTP " + response.status }; })
      .then(function (result) {
        if (result && result.error !== undefined) { console.warn("[apex-local] set value:", result.error); return undefined; }
        return result ? result.value : undefined;
      });
  }

  function setValues(selector, trigger, value, suppress) {
    each(selector, trigger, function (item) { item.setValue(value, null, !!suppress); }, function (el) { el.text(value); });
  }

  function regionsOf(selector, trigger) {
    return elements(selector, trigger).toArray().map(function (el) { return el.id; }).filter(Boolean);
  }

  function run(action, event, trigger) {
    var settings = action.settings || {};
    switch (action.action) {
      case "executeJsCode":
      case "executeJavaScriptCode":
        return compile(settings.jsCode || settings.code || "").call({
          triggeringElement: trigger, affectedElements: elements(action.selector, trigger), browserEvent: event, data: event && event.data, action: action
        }, event);
      case "refresh":
        return Promise.all(elements(action.selector, trigger).toArray().map(function (el) {
          if (apex.region.isRegion && apex.region.isRegion(el.id)) return apex.region(el.id).refresh();
          // Regions without a client widget (calendar, ...) are rendered again by the server.
          if (el.id && (submitted(el.id) || (el.querySelector && el.querySelector(".apex-local-calendar")))) return replaceRegion(el.id);
          if (isItem(el) && apex.item(el.id).refresh) return apex.item(el.id).refresh();
          return undefined;
        }));
      case "submitPage":
        return apex.page.submit({ request: settings.requestButtonName || settings.request || "", showWait: settings.showProcessing !== false });
      case "cancelDialog":
        return apex.navigation.dialog.cancel(true);
      case "closeDialog":
        return apex.navigation.dialog.close(true);
      case "show":
        return each(action.selector, trigger, function (item) { item.show(settings.showAllOnSameLine === true); }, function (el) { el.show(); });
      case "hide":
        return each(action.selector, trigger, function (item) { item.hide(settings.hidePageItemsOnSameLine === true); }, function (el) { el.hide(); });
      case "enable":
        return each(action.selector, trigger, function (item) { item.enable(); }, function (el) { el.prop("disabled", false).removeClass("apex_disabled"); });
      case "disable":
        return each(action.selector, trigger, function (item) { item.disable(); }, function (el) { el.prop("disabled", true).addClass("apex_disabled"); });
      case "clear":
        return each(action.selector, trigger, function (item) { item.setValue(""); }, function (el) { el.empty(); });
      case "setFocus":
        return each(action.selector, trigger, function (item) { item.setFocus(); }, function (el) { el.trigger("focus"); });
      case "addClass":
        return elements(action.selector, trigger).addClass(settings.cssClasses || settings.class || settings.cssClass || "");
      case "removeClass":
        return elements(action.selector, trigger).removeClass(settings.cssClasses || settings.class || settings.cssClass || "");
      case "setStyle":
        return elements(action.selector, trigger).css(settings.styleName || "", settings.value || "");
      case "openRegion":
        return regionsOf(action.selector, trigger).forEach(function (id) {
          if (apex.theme && apex.theme.openRegion) apex.theme.openRegion(id); else $("#" + apex.util.escapeCSS(id)).show();
        });
      case "closeRegion":
        return regionsOf(action.selector, trigger).forEach(function (id) {
          if (apex.theme && apex.theme.closeRegion) apex.theme.closeRegion(id); else $("#" + apex.util.escapeCSS(id)).hide();
        });
      case "cancelEvent":
        if (event && event.preventDefault) event.preventDefault();
        apex.event.gCancelFlag = true;
        return Promise.reject(null);
      case "alert":
        return new Promise(function (resolve) {
          apex.message.alert(settings.text || settings.message || "", function () { resolve(); }, { title: settings.title, style: settings.style });
        });
      case "confirm":
        return new Promise(function (resolve, reject) {
          apex.message.confirm(settings.text || settings.message || "", function (ok) { if (ok) resolve(); else reject(null); },
            { title: settings.title, style: settings.style, confirmLabel: settings.confirmLabel || settings.okLabel, cancelLabel: settings.cancelLabel });
        });
      case "showSuccessMessage":
        return apex.message.showPageSuccess(settings.message || settings.text || "");
      case "showErrorMessage":
        if (settings.clearErrors !== false) apex.message.clearErrors();
        return apex.message.showErrors([{ type: "error", location: settings.item ? ["inline", "page"] : "page",
          pageItem: settings.item || undefined, message: settings.message || settings.text || "", unsafe: false }]);
      case "clearErrors":
        return apex.message.clearErrors();
      case "setValue": {
        var type = settings.type || settings.setType || "static";
        if (type === "sqlQuery" || type === "plsqlExpression" || type === "plsqlFunctionBody") {
          return serverValue(settings).then(function (value) { if (value !== undefined) setValues(action.selector, trigger, value, settings.suppressChangeEvent); });
        }
        var value = type === "jsExpression" || type === "javascriptExpression"
          ? expression(settings.jsExpression || settings.javascriptExpression || "''", { triggeringElement: trigger, data: event && event.data })
          : type === "dialogReturnItem" ? (event && event.data ? event.data[settings.returnItem || settings.dialogReturnItem] : "")
          : settings.value !== undefined ? settings.value : settings.staticValue;
        return setValues(action.selector, trigger, value === undefined || value === null ? "" : value, settings.suppressChangeEvent);
      }
      case "executeServerSideCode":
        return serverCode(settings);
      case "getCurrentPosition":
        if (!navigator.geolocation) return undefined;
        return new Promise(function (resolve) {
          navigator.geolocation.getCurrentPosition(function (position) {
            if (settings.latitudeItem) apex.item(settings.latitudeItem).setValue(position.coords.latitude);
            if (settings.longitudeItem) apex.item(settings.longitudeItem).setValue(position.coords.longitude);
            resolve();
          }, function () { resolve(); }, { enableHighAccuracy: settings.enableHighAccuracy === true });
        });
      case "share":
        if (navigator.share) return navigator.share({ title: settings.title, text: settings.text, url: settings.url || location.href }).catch(function () {});
        return undefined;
      default:
        if (actionHandlers[action.action]) return actionHandlers[action.action](action, event, trigger, { elements: elements, each: each });
        console.warn("[apex-local] dynamic action \"" + action.action + "\" is not simulated");
    }
  }

  function compare(left, right) {
    var a = Number(left), b = Number(right);
    return isFinite(a) && isFinite(b) && left !== "" && right !== "" ? a - b : String(left).localeCompare(String(right));
  }

  function conditionHolds(condition, trigger) {
    if (!condition || !condition.type) return true;
    var value = condition.item ? apex.item(condition.item).getValue() : $(trigger).val();
    value = Array.isArray(value) ? value.join(":") : value;
    if (value === null || value === undefined) value = "";
    var empty = value === "";
    var list = condition.list && condition.list.length ? condition.list : String(condition.value || "").split(",");
    switch (condition.type) {
      case "itemIsNull": case "isNull": return empty;
      case "itemIsNotNull": case "isNotNull": return !empty;
      case "item=value": case "equals": case "itemEqualsValue": return String(value) === condition.value;
      case "item!=value": case "notEquals": case "itemNotEqualsValue": return String(value) !== condition.value;
      case "item>value": return compare(value, condition.value) > 0;
      case "item>=value": return compare(value, condition.value) >= 0;
      case "item<value": return compare(value, condition.value) < 0;
      case "item<=value": return compare(value, condition.value) <= 0;
      case "itemIsInList": case "itemInList": case "inList": return list.indexOf(String(value)) >= 0;
      case "itemIsNotInList": return list.indexOf(String(value)) < 0;
      case "jsExpression": case "javascriptExpression":
        return !!expression(condition.expression, { triggeringElement: trigger });
      default: return true;
    }
  }

  // Actions run synchronously until one returns a promise it must wait for, so Cancel Event and
  // the first actions take effect inside the browser event handler (also for element.click()).
  function fire(da, event, trigger, init) {
    var holds = conditionHolds(da.condition, trigger);
    var queue = da.actions.filter(function (action) { return action.whenFalse === !holds && (!init || action.fireOnInit); });
    var index = 0;
    function step() {
      while (index < queue.length) {
        var action = queue[index++];
        var result;
        try {
          result = run(action, event, trigger);
        } catch (error) {
          if (action.stopOnError === false) { apex.debug.error(error); continue; }
          return Promise.reject(error);
        }
        if (action.wait !== false && result && typeof result.then === "function") return Promise.resolve(result).then(step);
      }
      return Promise.resolve();
    }
    return step().catch(function (error) { if (error) apex.debug.error(error); });
  }

  var EVENTS = { "page load": "ready", pageload: "ready", "lose focus": "focusout", losefocus: "focusout", "get focus": "focusin", getfocus: "focusin",
    afterrefresh: "apexafterrefresh", beforerefresh: "apexbeforerefresh", beforepagesubmit: "apexbeforepagesubmit", dialogclosed: "apexafterclosedialog" };

  function timed(da, handler) {
    if (da.timing === "debounce" && da.time > 0) {
      var timer = null;
      return function () {
        var self = this, args = arguments;
        if (da.immediate && !timer) handler.apply(self, args);
        clearTimeout(timer);
        timer = setTimeout(function () { timer = null; if (!da.immediate) handler.apply(self, args); }, da.time);
      };
    }
    if (da.timing === "throttle" && da.time > 0) {
      var last = 0;
      return function () {
        var now = Date.now();
        if (now - last >= da.time) { last = now; handler.apply(this, arguments); }
      };
    }
    return handler;
  }

  function bindDynamicAction(da) {
    var event = EVENTS[String(da.event).toLowerCase()] || da.event;
    // Page load and Fire on Initialization actions start after the rest of the page init code.
    if (event === "ready") return Promise.resolve().then(function () { return fire(da, null, document, false); });
    var handler = timed(da, function (browserEvent, data) {
      if (data !== undefined) browserEvent.data = data;
      fire(da, browserEvent, this, false);
    });
    var on = da.scope === "once" ? "one" : "on";
    if (!da.selector || da.selector === "document") $(document)[on](event, handler);
    else if (da.selector.indexOf("js:") === 0) elements(da.selector, document)[on](event, handler);
    else if (da.scope === "dynamic" || da.scope === "static") $(da.container || document)[on](event, da.selector, handler);
    else $(da.selector)[on](event, handler);
    var targets = elements(da.selector, document).toArray();
    Promise.resolve().then(function () { targets.forEach(function (target) { fire(da, null, target, true); }); });
  }

  // Page Items to Submit of a region: { NAME: value } of the items it declares, or null.
  function submitted(id) {
    var names = (config.regionItems || {})[id];
    if (!names || !names.length) return null;
    var values = {};
    names.forEach(function (name) {
      var item = apex.item(name);
      if (!item || !item.node) return;
      var value = item.getValue();
      values[name] = Array.isArray(value) ? value.join(":") : value;
    });
    return values;
  }
  function itemsQuery(id) {
    var values = submitted(id);
    return values ? "&items=" + encodeURIComponent(JSON.stringify(values)) : "";
  }

  function replaceRegion(id, extra) {
    var region$ = $("#" + apex.util.escapeCSS(id));
    region$.trigger("apexbeforerefresh");
    var url = base + "/__apex/region?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) + "&region=" + encodeURIComponent(id) + (extra || "");
    var items = submitted(id);
    var init = items
      ? { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: items }) }
      : { credentials: "same-origin" };
    return fetch(url, init).then(function (response) { return response.text(); }).then(function (html) {
      var next$ = $(html);
      region$.replaceWith(next$);
      registerRegion({ id: id });
      next$.trigger("apexafterrefresh");
    });
  }

  function registerRegion(region) {
    if (apex.region.isRegion && apex.region.isRegion(region.id)) apex.region.destroy(region.id);
    if (!document.getElementById(region.id)) return;
    apex.region.create(region.id, { type: "ApexLocal", refresh: function () { return replaceRegion(region.id); },
      // Target of the links of region errors in the page notification (interactive grid rows).
      gotoError: function () { var el = document.getElementById(region.id); if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" }); } });
  }

  $(document).on("click", "[data-apex-local-page]", function (event) {
    event.preventDefault();
    replaceRegion(this.getAttribute("data-region"), "&pg=" + this.getAttribute("data-apex-local-page"));
  });
  $(document).on("input", "[data-apex-local-search]", function () {
    var needle = this.value.toLowerCase();
    $("#" + apex.util.escapeCSS(this.getAttribute("data-apex-local-search")) + "_table tr").each(function (index) {
      if (index === 0) return;
      this.style.display = !needle || this.textContent.toLowerCase().indexOf(needle) >= 0 ? "" : "none";
    });
  });

  return {
    init: function (pageConfig) {
      config = pageConfig;
      config.regions.forEach(registerRegion);
      config.dynamicActions.forEach(bindDynamicAction);
    },
    refreshRegion: replaceRegion,
    submittedItems: submitted,
    itemsQuery: itemsQuery,
    registerAction: function (name, handler) { actionHandlers[name] = handler; },
    hasAction: function (name) { return Object.prototype.hasOwnProperty.call(actionHandlers, name); },
    config: function () { return config; }
  };
})(apex.jQuery);
`;
