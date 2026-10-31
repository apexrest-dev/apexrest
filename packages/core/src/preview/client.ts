/** Browser-side helpers served next to the genuine APEX JavaScript. */

export const RUNTIME_CSS = `
.apex-local-toolbar{position:fixed;left:8px;bottom:8px;z-index:2000;max-width:min(640px,calc(100vw - 16px));font:12px/1.4 system-ui,sans-serif;background:rgba(32,32,36,.92);color:#fff;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.25)}
.apex-local-toolbar summary{cursor:pointer;padding:6px 10px;list-style:none}
.apex-local-toolbar ul{margin:0;padding:0 10px 8px 26px;max-height:40vh;overflow:auto}
.apex-local-toolbar li.is-error{color:#ff9b9b}.apex-local-toolbar li.is-warning{color:#ffd479}.apex-local-toolbar li.is-info{color:#cfd8e3}
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
      Object.keys(values || {}).forEach(function (name) { apex.item(name).setValue(values[name]); });
    });
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
        return elements(action.selector, trigger).each(function () {
          if (apex.region.isRegion && apex.region.isRegion(this.id)) apex.region(this.id).refresh();
          else if (isItem(this) && apex.item(this.id).refresh) apex.item(this.id).refresh();
        });
      case "submitPage":
        return apex.page.submit({ request: settings.request || "", showWait: settings.showProcessing !== false });
      case "cancelDialog":
        return apex.navigation.dialog.cancel(true);
      case "closeDialog":
        return apex.navigation.dialog.close(true);
      case "show":
        return each(action.selector, trigger, function (item) { item.show(); }, function (el) { el.show(); });
      case "hide":
        return each(action.selector, trigger, function (item) { item.hide(); }, function (el) { el.hide(); });
      case "enable":
        return each(action.selector, trigger, function (item) { item.enable(); }, function (el) { el.prop("disabled", false).removeClass("apex_disabled"); });
      case "disable":
        return each(action.selector, trigger, function (item) { item.disable(); }, function (el) { el.prop("disabled", true).addClass("apex_disabled"); });
      case "clear":
        return each(action.selector, trigger, function (item) { item.setValue(""); }, function (el) { el.empty(); });
      case "setFocus":
        return each(action.selector, trigger, function (item) { item.setFocus(); }, function (el) { el.trigger("focus"); });
      case "addClass":
        return elements(action.selector, trigger).addClass(settings.cssClasses || settings.cssClass || "");
      case "removeClass":
        return elements(action.selector, trigger).removeClass(settings.cssClasses || settings.cssClass || "");
      case "alert":
        return apex.message.alert(settings.text || settings.message || "");
      case "confirm":
        return new Promise(function (resolve, reject) {
          apex.message.confirm(settings.text || settings.message || "", function (ok) { if (ok) resolve(); else reject(); });
        });
      case "setValue": {
        var type = settings.setType || settings.type || "staticAssignment";
        if (/^(sqlStatement|plsql)/.test(type)) {
          console.warn("[apex-local] setValue from " + type + " is not simulated");
          return;
        }
        var value = type === "javascriptExpression"
          ? expression(settings.jsExpression || settings.javascriptExpression || "''", { triggeringElement: trigger })
          : type === "dialogReturnItem" ? (event && event.data ? event.data[settings.dialogReturnItem] : "")
          : settings.value !== undefined ? settings.value : settings.staticValue;
        return each(action.selector, trigger, function (item) { item.setValue(value); }, function (el) { el.text(value); });
      }
      case "executeServerSideCode":
        return serverCode(settings);
      default:
        console.warn("[apex-local] dynamic action \"" + action.action + "\" is not simulated");
    }
  }

  function conditionHolds(condition, trigger) {
    if (!condition || !condition.type) return true;
    var value = condition.item ? apex.item(condition.item).getValue() : $(trigger).val();
    value = Array.isArray(value) ? value.join(":") : value;
    var empty = value === "" || value === null || value === undefined;
    switch (condition.type) {
      case "itemIsNull": case "isNull": return empty;
      case "itemIsNotNull": case "isNotNull": return !empty;
      case "item=value": case "equals": case "itemEqualsValue": return String(value) === condition.value;
      case "item!=value": case "notEquals": case "itemNotEqualsValue": return String(value) !== condition.value;
      case "itemInList": case "inList": return condition.value.split(",").indexOf(String(value)) >= 0;
      case "javascriptExpression": return !!expression(condition.expression, { triggeringElement: trigger });
      default: return true;
    }
  }

  function fire(da, event, trigger, init) {
    var holds = conditionHolds(da.condition, trigger);
    var queue = da.actions.filter(function (action) { return action.whenFalse === !holds && (!init || action.fireOnInit); });
    return queue.reduce(function (promise, action) {
      return promise.then(function () { return run(action, event, trigger); });
    }, Promise.resolve()).catch(function (error) { if (error) apex.debug.error(error); });
  }

  var EVENTS = { "page load": "ready", pageload: "ready", "lose focus": "focusout", losefocus: "focusout", "get focus": "focusin", getfocus: "focusin" };

  function bindDynamicAction(da) {
    var event = EVENTS[String(da.event).toLowerCase()] || da.event;
    if (event === "ready") return fire(da, null, document, false);
    var handler = function (browserEvent, data) {
      if (data !== undefined) browserEvent.data = data;
      fire(da, browserEvent, this, false);
    };
    if (!da.selector || da.selector === "document") $(document).on(event, handler);
    else if (da.selector.indexOf("js:") === 0) elements(da.selector, document).on(event, handler);
    else $(document).on(event, da.selector, handler);
    elements(da.selector, document).each(function () { fire(da, null, this, true); });
  }

  function replaceRegion(id, extra) {
    var region$ = $("#" + apex.util.escapeCSS(id));
    region$.trigger("apexbeforerefresh");
    var url = base + "/__apex/region?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) + "&region=" + encodeURIComponent(id) + (extra || "");
    return fetch(url, { credentials: "same-origin" }).then(function (response) { return response.text(); }).then(function (html) {
      var next$ = $(html);
      region$.replaceWith(next$);
      registerRegion({ id: id });
      next$.trigger("apexafterrefresh");
    });
  }

  function registerRegion(region) {
    if (apex.region.isRegion && apex.region.isRegion(region.id)) apex.region.destroy(region.id);
    if (!document.getElementById(region.id)) return;
    apex.region.create(region.id, { type: "ApexLocal", refresh: function () { return replaceRegion(region.id); } });
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
    config: function () { return config; }
  };
})(apex.jQuery);
`;
