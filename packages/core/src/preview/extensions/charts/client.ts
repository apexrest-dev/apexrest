import { NEW_END, NEW_START } from './calendar.ts';

/** Browser side of the chart, calendar and map previews (appended to /__apex/runtime.js). */

export const CHARTS_CSS = String.raw`
.apex-local-jet{position:relative;width:100%;overflow:hidden;font-family:var(--a-base-font-family,"Oracle Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif)}
.apex-local-jet svg{display:block;overflow:visible}
.ajc-svg text{font-family:inherit;font-size:12px;fill:var(--ut-body-text-color,#161513)}
.ajc-svg .ajc-tick,.ajc-svg .ajc-legend-text{fill:rgba(22,21,19,.7)}
.ajc-svg .ajc-axis-title{fill:rgba(22,21,19,.7);font-size:12px}
.ajc-svg .ajc-title{font-size:14px;font-weight:600}
.ajc-svg .ajc-legend-title{font-weight:600;fill:rgba(22,21,19,.85)}
.ajc-svg .ajc-message{fill:rgba(22,21,19,.6);font-size:13px}
.ajc-svg .ajc-value{fill:rgba(22,21,19,.85)}
.ajc-svg .ajc-center-value{font-weight:600;fill:var(--ut-body-text-color,#161513)}
.ajc-svg .ajc-center-label,.ajc-svg .ajc-gauge-text{fill:rgba(22,21,19,.7)}
.ajc-svg .ajc-gauge-text{font-weight:600;fill:var(--ut-body-text-color,#161513)}
.ajc-grid{stroke:rgba(22,21,19,.1);stroke-width:1;shape-rendering:crispEdges}
.ajc-axis{stroke:rgba(22,21,19,.35);stroke-width:1;shape-rendering:crispEdges}
.ajc-reference{stroke:rgba(22,21,19,.6);stroke-width:1.5;stroke-dasharray:5 3}
.ajc-leader{stroke:rgba(22,21,19,.4);stroke-width:1}
.ajc-gauge-track{fill:rgba(22,21,19,.08)}
.ajc-slice{stroke:var(--ut-component-background-color,#fff);stroke-width:1}
.ajc-bar,.ajc-slice,.ajc-bubble,.ajc-gauge-value{transition:opacity .12s}
.ajc-bar:hover,.ajc-slice:hover,.ajc-bubble:hover,.ajc-gauge-value:hover{opacity:.8}
.ajc-point .ajc-hover{opacity:0;transition:opacity .12s}.ajc-point:hover .ajc-hover{opacity:1}
.ajc-link{cursor:pointer}
.apex-local-jet-tip{position:fixed;z-index:3000;pointer-events:none;background:var(--ut-component-background-color,#fff);color:var(--ut-body-text-color,#161513);border:1px solid rgba(22,21,19,.12);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.16);padding:6px 10px;font:12px/1.45 var(--a-base-font-family,"Oracle Sans",system-ui,sans-serif);max-width:320px}
.apex-local-jet-tip table{border-collapse:collapse}.apex-local-jet-tip td{padding:0 0 0 0;vertical-align:top}
.apex-local-jet-tip td:first-child{color:rgba(22,21,19,.65);padding-right:10px}.apex-local-jet-tip td:last-child{font-weight:600}
.apex-local-calendar{min-height:300px}
.apex-local-calendar .fc-event{cursor:pointer}
.apex-local-calendar-fallback{list-style:none;margin:0;padding:0}
.apex-local-calendar-fallback li{padding:6px 0;border-bottom:1px solid rgba(0,0,0,.08)}
.fc .apex-cal-red,.fc .apex-cal-red .fc-daygrid-event-dot{--fc-event-bg-color:#d63b25;--fc-event-border-color:#d63b25}
.fc .apex-cal-orange{--fc-event-bg-color:#ed813e;--fc-event-border-color:#ed813e}
.fc .apex-cal-yellow{--fc-event-bg-color:#fbce4a;--fc-event-border-color:#fbce4a;--fc-event-text-color:#161513}
.fc .apex-cal-green{--fc-event-bg-color:#3caf85;--fc-event-border-color:#3caf85}
.fc .apex-cal-lime{--fc-event-bg-color:#81bb5f;--fc-event-border-color:#81bb5f}
.fc .apex-cal-cyan,.fc .apex-cal-bluesky{--fc-event-bg-color:#13b6cf;--fc-event-border-color:#13b6cf}
.fc .apex-cal-blue{--fc-event-bg-color:#309fdb;--fc-event-border-color:#309fdb}
.fc .apex-cal-darkblue{--fc-event-bg-color:#5a68ad;--fc-event-border-color:#5a68ad}
.fc .apex-cal-purple{--fc-event-bg-color:#854e9b;--fc-event-border-color:#854e9b}
.fc .apex-cal-gray,.fc .apex-cal-silver{--fc-event-bg-color:#6e8598;--fc-event-border-color:#6e8598}
.fc .apex-cal-black{--fc-event-bg-color:#161513;--fc-event-border-color:#161513}
.apex-local-map{display:grid;gap:8px}
.apex-local-map-note{font-size:12px;color:rgba(22,21,19,.65)}
.apex-local-map-canvas{display:block;border-radius:6px;border:1px solid rgba(22,21,19,.12)}
.apex-local-map-point:hover,.apex-local-map-shape:hover{opacity:.8}
.apex-local-map-layers,.apex-local-map-features{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12px}
.apex-local-map-features{max-height:160px;overflow:auto}
.apex-local-map-swatch{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:-1px}
.apex-local-map-count{color:rgba(22,21,19,.6)}
`;

export const CHARTS_JS = String.raw`
(function ($) {
  "use strict";
  var base = location.pathname.replace(/\/[^/]*$/, "");
  var tip = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; });
  }
  function showTip(target, event) {
    var text = target.getAttribute("data-tip");
    if (!text) return;
    if (!tip) { tip = document.createElement("div"); tip.className = "apex-local-jet-tip"; document.body.appendChild(tip); }
    var rows = text.split("\n").map(function (line) {
      var parts = line.split("\t");
      return parts.length > 1 ? "<tr><td>" + escapeHtml(parts[0]) + "</td><td>" + escapeHtml(parts.slice(1).join(" ")) + "</td></tr>" : "<tr><td colspan=2>" + escapeHtml(line) + "</td></tr>";
    });
    tip.innerHTML = "<table>" + rows.join("") + "</table>";
    tip.style.display = "block";
    moveTip(event);
  }
  function moveTip(event) {
    if (!tip) return;
    var x = event.clientX + 14, y = event.clientY + 14;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > window.innerWidth - 8) x = event.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = event.clientY - h - 14;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hideTip() { if (tip) tip.style.display = "none"; }
  $(document).on("mouseover", ".apex-local-jet [data-tip], .apex-local-map [data-tip]", function (event) { showTip(this, event); })
    .on("mousemove", ".apex-local-jet [data-tip], .apex-local-map [data-tip]", moveTip)
    .on("mouseout", ".apex-local-jet [data-tip], .apex-local-map [data-tip]", hideTip);

  // Charts are drawn on the server; redraw at the real width so text keeps its size.
  function resizeChart(el) {
    var width = Math.round(el.clientWidth);
    if (!width) return;
    var drawn = Number(el.getAttribute("data-width"));
    if (Math.abs(width - drawn) < 6 || el.__apexLocalPending === width) return;
    el.__apexLocalPending = width;
    var url = base + "/__apex/x/chart?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) + "&region=" + encodeURIComponent(el.getAttribute("data-chart-region")) + "&width=" + width;
    fetch(url, { credentials: "same-origin" }).then(function (r) { return r.ok ? r.text() : null; }).then(function (html) {
      if (html && el.__apexLocalPending === width) { el.innerHTML = html; el.setAttribute("data-width", String(width)); }
      el.__apexLocalPending = null;
    });
  }
  var observer = window.ResizeObserver ? new ResizeObserver(function (entries) {
    entries.forEach(function (entry) {
      var el = entry.target;
      clearTimeout(el.__apexLocalTimer);
      el.__apexLocalTimer = setTimeout(function () { resizeChart(el); }, 120);
    });
  }) : null;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function stamp(date, withTime) {
    var day = date.getFullYear() + "" + pad(date.getMonth() + 1) + pad(date.getDate());
    return withTime ? day + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds()) : day;
  }
  function eventsUrl(config, start, end) {
    return base + "/__apex/x/calendar?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) + "&region=" + encodeURIComponent(config.region) +
      (start ? "&start=" + start.toISOString() + "&end=" + end.toISOString() : "") + window.apexLocal.itemsQuery(config.region);
  }
  function go(url, element) {
    if (!url) return;
    if (url.indexOf("javascript:") === 0) Function(url.slice(11)).call(element);
    else apex.navigation.redirect(url);
  }
  function fallbackCalendar(el, config) {
    fetch(eventsUrl(config), { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (events) {
      el.innerHTML = '<p class="apex-local-map-note">FullCalendar is not in the preview assets; events are listed instead.</p><ul class="apex-local-calendar-fallback">' +
        events.map(function (e) { return "<li><strong>" + escapeHtml(e.start.replace("T", " ")) + "</strong> " + (e.url ? '<a href="' + escapeHtml(e.url) + '">' + escapeHtml(e.title) + "</a>" : escapeHtml(e.title)) + "</li>"; }).join("") + "</ul>";
    });
  }
  function initCalendar(el) {
    var config = JSON.parse(el.getAttribute("data-calendar") || "{}");
    if (!window.FullCalendar) return fallbackCalendar(el, config);
    var hour12 = config.timeFormat !== "24Hour" && config.timeFormat !== "24";
    var timeFormat = { hour: "numeric", minute: "2-digit", omitZeroMinute: hour12, meridiem: "short", hour12: hour12 };
    var right = config.views && config.views.length ? config.views.slice() : ["dayGridMonth", "timeGridWeek", "timeGridDay"];
    if (!config.views && config.list) right.push("listMonth");
    var calendar = new FullCalendar.Calendar(el, {
      themeSystem: "standard",
      initialView: right[0] || "dayGridMonth",
      initialDate: config.initialDate,
      headerToolbar: { left: config.navigation ? "prev,next today" : "", center: "title", right: right.length > 1 ? right.join(",") : "" },
      buttonText: { today: "today", month: "month", week: "week", day: "day", list: "list" },
      firstDay: config.firstDay || 0,
      weekends: config.weekends !== false,
      dayMaxEventRows: config.maxEvents ? Math.max(2, config.maxEvents) : true,
      fixedWeekCount: false,
      scrollTime: pad(config.firstHour || 8) + ":00:00",
      eventTimeFormat: timeFormat,
      slotLabelFormat: timeFormat,
      displayEventTime: false,
      nowIndicator: true,
      views: {
        listMonth: { displayEventTime: true, displayEventEnd: true }
      },
      events: function (info, success, failure) {
        fetch(eventsUrl(config, info.start, info.end), { credentials: "same-origin" })
          .then(function (r) { if (!r.ok) throw new Error(r.statusText); return r.json(); })
          .then(success, failure);
      },
      eventClick: function (info) {
        if (info.event.url) { info.jsEvent.preventDefault(); go(info.event.url, info.el); }
      },
      eventDidMount: function (info) {
        var description = info.event.extendedProps && info.event.extendedProps.description;
        info.el.setAttribute("title", description ? info.event.title + "\n" + description : info.event.title);
      },
      dateClick: config.createUrl ? function (info) {
        var start = stamp(info.date, !info.allDay);
        go(config.createUrl.split("${NEW_START}").join(start).split("${NEW_END}").join(start), el);
      } : undefined
    });
    calendar.render();
    el.__apexLocalCalendar = calendar;
    if (observer) { new ResizeObserver(function () { calendar.updateSize(); }).observe(el); }
  }

  function scan(root) {
    $(root).find(".apex-local-jet[data-chart-region]").addBack(".apex-local-jet[data-chart-region]").each(function () {
      if (this.__apexLocalChart) return;
      this.__apexLocalChart = true;
      if (observer) observer.observe(this); else resizeChart(this);
    });
    $(root).find(".apex-local-calendar[data-calendar]").addBack(".apex-local-calendar[data-calendar]").each(function () {
      if (this.__apexLocalCalendarInit) return;
      this.__apexLocalCalendarInit = true;
      initCalendar(this);
    });
  }
  $(function () {
    scan(document.body);
    if (window.MutationObserver) {
      new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (node) { if (node.nodeType === 1) scan(node); });
        });
      }).observe(document.body, { childList: true, subtree: true });
    }
  });
})(apex.jQuery);
`;
