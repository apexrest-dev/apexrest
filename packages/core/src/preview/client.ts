/** Browser-side helpers served next to the genuine APEX JavaScript. */

export const RUNTIME_CSS = `
.apex-local-toolbar{position:fixed;left:8px;bottom:8px;z-index:2000;max-width:min(640px,calc(100vw - 16px));font:12px/1.4 system-ui,sans-serif;background:rgba(32,32,36,.92);color:#fff;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.25)}
.apex-local-toolbar summary{cursor:pointer;padding:6px 10px;list-style:none}
.apex-local-style{display:block;padding:0 10px 8px}.apex-local-style select{margin-left:6px;font:inherit}
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
      Object.keys(values || {}).forEach(function (name) { apex.item(name).setValue(values[name]); });
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

  function fire(da, event, trigger, init) {
    var holds = conditionHolds(da.condition, trigger);
    var queue = da.actions.filter(function (action) { return action.whenFalse === !holds && (!init || action.fireOnInit); });
    return queue.reduce(function (promise, action) {
      return promise.then(function () {
        try {
          var result = run(action, event, trigger);
          return action.wait === false ? undefined : result;
        } catch (error) {
          if (action.stopOnError === false) { apex.debug.error(error); return undefined; }
          throw error;
        }
      });
    }, Promise.resolve()).catch(function (error) { if (error) apex.debug.error(error); });
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
    if (event === "ready") return fire(da, null, document, false);
    var handler = timed(da, function (browserEvent, data) {
      if (data !== undefined) browserEvent.data = data;
      fire(da, browserEvent, this, false);
    });
    var on = da.scope === "once" ? "one" : "on";
    if (!da.selector || da.selector === "document") $(document)[on](event, handler);
    else if (da.selector.indexOf("js:") === 0) elements(da.selector, document)[on](event, handler);
    else if (da.scope === "dynamic" || da.scope === "static") $(da.container || document)[on](event, da.selector, handler);
    else $(da.selector)[on](event, handler);
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
    registerAction: function (name, handler) { actionHandlers[name] = handler; },
    config: function () { return config; }
  };
})(apex.jQuery);
`;
