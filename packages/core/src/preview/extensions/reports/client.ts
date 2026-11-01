/** Browser code for the local report simulations (classic report, interactive report, interactive grid). */

/** UI labels used by the genuine grid/toolbar widgets and by the report dialogs. */
export const REPORT_MESSAGES: Record<string, string> = {
  'APEX.GV.AGG_CONTEXT': 'Aggregate.',
  'APEX.GV.BLANK_HEADING': 'Blank heading',
  'APEX.GV.BREAK_COLLAPSE': 'Collapse control break',
  'APEX.GV.BREAK_CONTEXT': 'Control break.',
  'APEX.GV.BREAK_EXPAND': 'Expand control break',
  'APEX.GV.DELETED_COUNT': '%0 rows deleted',
  'APEX.GV.DUP_REC_ID': 'Duplicate identity',
  'APEX.GV.ENTER_EDIT_MODE': 'Entering edit mode',
  'APEX.GV.LEAVE_EDIT_MODE': 'Leaving edit mode',
  'APEX.GV.FIRST_PAGE': 'First',
  'APEX.GV.LAST_PAGE': 'Last',
  'APEX.GV.NEXT_PAGE': 'Next',
  'APEX.GV.PREV_PAGE': 'Previous',
  'APEX.GV.FOOTER_LANDMARK': 'Grid Footer',
  'APEX.GV.STATUS_LANDMARK': 'Grid Status',
  'APEX.GV.GROUP_CONTEXT': 'Group header',
  'APEX.GV.HEADER_CONTEXT': 'Header.',
  'APEX.GV.INVALID_RANGE': 'Ranges must have all the same rows or all the same columns.',
  'APEX.GV.LOAD_ALL': 'Load All',
  'APEX.GV.LOAD_MORE': 'Show More',
  'APEX.GV.NEW_RANGE': 'Add selection',
  'APEX.GV.PAGE_RANGE': 'Page rows',
  'APEX.GV.PAGE_RANGE_ENTITY': 'Page %0',
  'APEX.GV.PAGE_RANGE_XY': '%0 - %1',
  'APEX.GV.PAGE_RANGE_XYZ': '%0 - %1 of %2',
  'APEX.GV.PAGE_SELECTION': 'Page Selection',
  'APEX.GV.PAGINATION_LANDMARK': 'Pagination',
  'APEX.GV.RANGE_DISPLAY': 'Range display',
  'APEX.GV.ROWS_PASTED': '%0 rows pasted',
  'APEX.GV.ROWS_SELECTION': 'Rows Selection',
  'APEX.GV.ROW_ADDED': 'Added',
  'APEX.GV.ROW_CHANGED': 'Changed',
  'APEX.GV.ROW_DELETED': 'Deleted',
  'APEX.GV.ROW_COLUMN_CONTEXT': 'Grid row sequence %0, Column %1.',
  'APEX.GV.ROW_CONTEXT': 'Grid row sequence %0.',
  'APEX.GV.ROW_HEADER': 'Row header',
  'APEX.GV.ROW_SELECTION': 'Row Selection',
  'APEX.GV.SELECTION_CELL_COUNT': '%0 cells selected',
  'APEX.GV.SELECTION_COUNT': '%0 rows selected',
  'APEX.GV.SELECT_ALL': 'Select All',
  'APEX.GV.SELECT_ALL_ROWS': 'Select All Rows',
  'APEX.GV.SELECT_PAGE_N': 'Page %0',
  'APEX.GV.SELECT_ROW': 'Select Row',
  'APEX.GV.SORTED_ASCENDING': 'Sorted Ascending %0',
  'APEX.GV.SORTED_DESCENDING': 'Sorted Descending %0',
  'APEX.GV.SORT_ASCENDING': 'Sort Ascending',
  'APEX.GV.SORT_ASCENDING_ORDER': 'Sort Ascending %0',
  'APEX.GV.SORT_DESCENDING': 'Sort Descending',
  'APEX.GV.SORT_DESCENDING_ORDER': 'Sort Descending %0',
  'APEX.GV.SORT_OFF': "Don't Sort",
  'APEX.GV.SORT_OPTIONS': 'Sort options',
  'APEX.GV.STATE_ICONS_LANDMARK': 'State Icons',
  'APEX.GV.TOTAL_PAGES': 'Total %0',
  'APEX.GV.VISUALLY_HIDDEN_LINK': '%0',
  'APEX.GV.FLOATING_ITEM.DIALOG.HIDE_DIALOG': 'Hide dialog',
  'APEX.GV.FLOATING_ITEM.DIALOG.TITLE': 'Floating overflow cell content',
  'APEX.GV.FLOATING_ITEM.SHOW_DIALOG': 'Show overflow content',
  'APEX.TMV.REPORT_FOOTER': 'Report Footer',
  'APEX.TMV.REPORT_STATUS': 'Report Status',
  'APEX.TMV.SELECTION_COUNT': '%0 items selected',
  'APEX.TB.TOOLBAR': 'Toolbar',
  'APEX.IG.NO_DATA_FOUND': 'No data found',
  'APEX.CHECKBOX.VISUALLY_HIDDEN_CHECKBOX': 'Checkbox',
  'APEX.RADIO.VISUALLY_HIDDEN_RADIO': 'Radio',
  'APEX.DIALOG.VISUALLY_HIDDEN_TITLE': 'Dialog',
};

export const REPORTS_CSS = `
.a-IRR-sortWidget.apex-local-sortWidget{box-shadow:0 4px 16px rgba(0,0,0,.18);border:1px solid var(--a-menu-border-color,rgba(0,0,0,.15))}
.apex-local-dialog .a-IRR-dialogRow{display:flex;gap:8px;align-items:center;margin:0 0 8px}
.apex-local-dialog .a-IRR-dialogRow > *{flex:1 1 auto}
.apex-local-dialog .a-IRR-dialogRow label{flex:0 0 96px;font-weight:600}
.apex-local-dialog .apex-local-columnList{list-style:none;margin:0;padding:0;max-height:50vh;overflow:auto}
.apex-local-dialog .apex-local-columnList li{display:flex;align-items:center;gap:8px;padding:4px 0}
.apex-local-dialog .apex-local-columnList li label{flex:1 1 auto}
.apex-local-moreData{padding:8px 12px;color:var(--ut-palette-warning-contrast,#4d3300);background:var(--ut-palette-warning-shade,#fff4d6)}
.a-IG .a-IG-controlsContainer:empty{display:none}
.a-IG .a-IG-controlsContainer{padding:4px 8px;border-bottom:1px solid var(--a-gv-cell-border-color,rgba(0,0,0,.1))}
.a-Report-percentChart{position:relative;height:14px;background:rgba(0,0,0,.06);border-radius:2px;min-width:60px}
.a-Report-percentChart-fill{position:absolute;inset:0 auto 0 0;background:var(--ut-palette-primary,#056ac8);border-radius:2px}
.apex-local-dialog .apex-local-inline{flex:0 0 auto;font-weight:400;white-space:nowrap}
.apex-local-dialog .a-IRR-dialogRow input[type=color]{flex:0 0 48px;height:32px;padding:0 2px}
.apex-local-dialog .a-IRR-highlightQuickPicks{display:flex;gap:4px;flex:0 0 auto}
.apex-local-dialog .a-IRR-highlightQuickPick{width:20px;height:20px;border:1px solid rgba(0,0,0,.2);border-radius:3px;cursor:pointer;padding:0}
.apex-local-dialog .a-IRR-highlightSectionTitle,.apex-local-dialog .a-IRR-groupBySectionTitle{font-weight:600;margin:12px 0 6px}
.apex-local-dialog .a-IRR-highlightPreviewField{padding:2px 6px;border:1px solid rgba(0,0,0,.15)}
.apex-local-dialog .apex-local-identifiers{display:flex;flex-wrap:wrap;gap:4px;max-height:140px}
.apex-local-dialog .apex-local-identifiers li{padding:0}
.apex-local-dialog .a-IRR-groupByFunctionRow,.apex-local-dialog .a-IRR-pivotFunctionRow{flex-wrap:wrap}
.apex-local-dialog .a-IRR-groupByFunctionRow > select,.apex-local-dialog .a-IRR-pivotFunctionRow > select,.apex-local-dialog .a-IRR-groupByFunctionRow > input[type=text],.apex-local-dialog .a-IRR-pivotFunctionRow > input[type=text]{flex:1 1 20%;min-width:90px}
.apex-local-dialog .a-IRR-chartTypePills{display:flex;gap:12px;list-style:none;margin:0 0 12px;padding:0}
.apex-local-dialog .apex-local-note{color:var(--ut-component-text-muted-color,#6f6f6f);margin:8px 0 0}
.apex-local-swatch{display:inline-block;width:12px;height:12px;border-radius:2px;border:1px solid rgba(0,0,0,.2);vertical-align:middle;margin-inline-end:6px}
.a-IRR-table tr.apex-local-aggregateRow td.a-IRR-aggregate{font-weight:600;border-top:1px solid var(--a-report-border-color,rgba(0,0,0,.15))}
.a-IRR-table .a-IRR-aggregateLabel{font-weight:400;color:var(--ut-component-text-muted-color,#6f6f6f)}
.a-IRR-chartView .apex-local-irChart{padding:8px 12px}
.a-IRR-singleRowView .a-IRR-toolbar--singleRow{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:8px}
.a-IRR-singleRowView .a-IRR-singleRowNav{display:flex;align-items:center;gap:8px}
.a-IRR-singleRow-rows{display:grid}
.a-IRR-singleRow-row{display:grid;grid-template-columns:minmax(120px,30%) 1fr}
.apex-local-stars .fa-star{color:rgba(0,0,0,.2);margin-inline-end:1px}
.apex-local-stars .fa-star.is-active,.apex-local-ig-star.is-active .fa-star{color:#f2b600}
.apex-local-ig-stars{display:flex;align-items:center;gap:2px}
.apex-local-ig-stars button{border:0;background:none;padding:2px;cursor:pointer;color:rgba(0,0,0,.25)}
.apex-local-check .fa{font-size:15px}.apex-local-check.is-checked{color:var(--ut-palette-primary,#056ac8)}
.apex-local-ig-popupLov{display:flex;align-items:stretch}.apex-local-ig-popupLov .apex-item-text{flex:1 1 auto;min-width:0}
.apex-local-popupLov ul{max-height:50vh;overflow:auto;margin-top:8px}.apex-local-popupLov .apex-local-lovPick{width:100%;text-align:start;padding:6px 8px}
.apex-local-popupLov .apex-local-lovPick:hover{background:var(--a-menu-hover-background-color,rgba(0,0,0,.05))}
.a-IG .a-IG-controlsLabel[data-apex-local-ir-chip-edit]{cursor:pointer}
.apex-local-dialog .a-IRR-dialogRow > input[type=checkbox]{flex:0 0 auto}
.apex-local-dialog .a-IRR-highlightPreview{font-size:inherit;padding:6px 0}
`;

export const REPORTS_CLIENT = String.raw`
window.apexLocalReports = (function ($) {
  "use strict";
  var base = location.pathname.replace(/\/[^/]*$/, "");
  var esc = function (id) { return "#" + apex.util.escapeCSS(id); };
  var html = apex.util.escapeHTML;

  function route(name, params) {
    var query = new URLSearchParams(Object.assign({ page: apex.env.APP_PAGE_ID }, params || {}));
    return base + "/__apex/x/" + name + "?" + query.toString();
  }
  function post(name, body) {
    return fetch(route(name), {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.assign({ page: apex.env.APP_PAGE_ID }, body))
    }).then(function (response) { return response.json(); });
  }
  function refresh(region, extra) {
    return apexLocal.refreshRegion(region, extra || "").then(function () { init(); });
  }
  /** Changes report state on the server, then re-renders the region. */
  function act(region, body) {
    return post("report", Object.assign({ region: region }, body)).then(function (result) {
      if (result && result.error) { apex.message.alert(result.error); return; }
      return refresh(region);
    });
  }
  function paginate(region, page) { return refresh(region, "&pg=" + encodeURIComponent(page)); }

  function download(region, format) {
    return fetch(route("report-download", { region: region, format: format || "csv" }), { credentials: "same-origin" })
      .then(function (response) { return response.json(); })
      .then(function (file) {
        if (file.error) { apex.message.alert(file.error); return; }
        var type = file.mime || (format === "html" ? "text/html" : "text/csv");
        var body = file.content;
        if (file.encoding === "base64") {
          var binary = atob(file.content), bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          body = bytes;
        }
        if (file.note) apex.message.showPageSuccess(file.note);
        var link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([body], { type: file.encoding === "base64" ? type : type + ";charset=utf-8" }));
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
      });
  }

  // ------------------------------------------------------------- dialogs

  function dialog(title, body$, buttons, cssClass) {
    var dialog$ = $("<div class='a-IRR-dialog apex-local-dialog " + (cssClass || "") + "'></div>").append(body$);
    dialog$.dialog({
      title: title, modal: true, width: 560, minHeight: 120, dialogClass: "ui-dialog--apex",
      closeText: apex.lang.getMessage("APEX.DIALOG.CLOSE"),
      close: function () { dialog$.dialog("destroy").remove(); },
      buttons: [{ text: apex.lang.getMessage("APEX.DIALOG.CANCEL"), click: function () { dialog$.dialog("close"); } }].concat(
        (buttons || []).map(function (button) {
          return { text: button.text, "class": button.hot ? "ui-button--hot" : "", click: function () {
            var result = button.click(dialog$);
            if (result !== false) dialog$.dialog("close");
          } };
        }))
    });
    return dialog$;
  }
  function columnSelect(columns, value, any) {
    return "<select class='selectlist apex-item-select'>" + (any ? "<option value=''>" + html(any) + "</option>" : "") + columns.map(function (column) {
      return "<option value='" + html(column.name) + "'" + (column.name === value ? " selected" : "") + ">" + html(column.label) + "</option>";
    }).join("") + "</select>";
  }
  var OPERATORS = [["=", "="], ["!=", "!="], [">", ">"], [">=", ">="], ["<", "<"], ["<=", "<="], ["contains", "contains"],
    ["doesNotContain", "does not contain"], ["startsWith", "starts with"], ["isNull", "is empty"], ["isNotNull", "is not empty"],
    ["in", "in"], ["notIn", "not in"], ["like", "like"], ["notLike", "not like"], ["between", "between"]];

  function columnsDialog(cfg) {
    var shown = cfg.columns.filter(function (c) { return c.shown; }).map(function (c) { return c.name; });
    var order = shown.concat(cfg.columns.filter(function (c) { return !c.shown; }).map(function (c) { return c.name; }));
    var byName = {};
    cfg.columns.forEach(function (c) { byName[c.name] = c; });
    var list$ = $("<ul class='apex-local-columnList a-IRR-columnList'></ul>");
    order.forEach(function (name) {
      var c = byName[name];
      list$.append("<li class='a-IRR-columnList-item' data-name='" + html(name) + "'><input type='checkbox' class='a-IRR-columnList-checkbox'" + (c.shown ? " checked" : "") + (c.hide === false ? " disabled" : "") + " id='apex_local_col_" + html(name) + "'><label class='a-IRR-columnList-label' for='apex_local_col_" + html(name) + "'>" + html(c.label) + "</label>" +
        "<button type='button' class='a-Button a-Button--small a-Button--noLabel' data-move='-1' title='Move Up' aria-label='Move Up'><span class='a-Icon icon-up-chevron' aria-hidden='true'></span></button>" +
        "<button type='button' class='a-Button a-Button--small a-Button--noLabel' data-move='1' title='Move Down' aria-label='Move Down'><span class='a-Icon icon-down-chevron' aria-hidden='true'></span></button></li>");
    });
    list$.on("click", "button[data-move]", function () {
      var item$ = $(this).closest("li");
      if (this.getAttribute("data-move") === "-1") item$.prev().before(item$); else item$.next().after(item$);
    });
    dialog("Columns", list$, [{ text: "Apply", hot: true, click: function () {
      var columns = list$.find("li").filter(function () { return $(this).find("input").prop("checked"); })
        .map(function () { return this.getAttribute("data-name"); }).get();
      if (!columns.length) { apex.message.alert("Select at least one column."); return false; }
      cfg.act({ action: "columns", columns: columns });
    } }], "a-IRR-dialog--selectColumns");
  }

  function filterDialog(cfg, preset) {
    preset = preset || {};
    var filterable = cfg.columns.filter(function (c) { return c.filter !== false; });
    var body$ = $("<div class='a-IRR-dialogBody'>" +
      "<div class='a-IRR-dialogRow'><label>Column</label>" + columnSelect(filterable, preset.column || (filterable[0] && filterable[0].name)) + "</div>" +
      "<div class='a-IRR-dialogRow'><label>Operator</label><select class='selectlist apex-item-select apex-local-op'>" + OPERATORS.map(function (op) {
        return "<option value='" + html(op[0]) + "'" + (op[0] === (preset.operator || "=") ? " selected" : "") + ">" + html(op[1]) + "</option>";
      }).join("") + "</select></div>" +
      "<div class='a-IRR-dialogRow'><label>Expression</label><input type='text' class='text_field apex-item-text apex-local-value' value='" + html(preset.value || "") + "'></div>" +
      "<div class='a-IRR-dialogRow apex-local-value2'><label>and</label><input type='text' class='text_field apex-item-text' value='" + html(preset.value2 || "") + "'></div></div>");
    function sync() { body$.find(".apex-local-value2").toggle(body$.find(".apex-local-op").val() === "between"); }
    body$.on("change", ".apex-local-op", sync);
    sync();
    dialog("Filter", body$, [{ text: "Apply", hot: true, click: function () {
      cfg.act({ action: "filter", column: body$.find("select").first().val(), operator: body$.find(".apex-local-op").val(),
        value: body$.find(".apex-local-value").val(), value2: body$.find(".apex-local-value2 input").val() });
    } }], "a-IRR-dialog--filter");
  }

  function sortDialog(cfg) {
    var sortable = cfg.columns.filter(function (c) { return c.sort !== false; });
    var rows = "";
    for (var i = 0; i < 6; i += 1) {
      var current = cfg.sort[i] || {};
      rows += "<div class='a-IRR-dialogRow a-IRR-sortDialogRow'><label>" + (i + 1) + "</label>" + columnSelect(sortable, current.column, "- Select Column -") +
        "<select class='selectlist apex-item-select apex-local-dir'><option value='asc'>Ascending</option><option value='desc'" + (current.direction === "desc" ? " selected" : "") + ">Descending</option></select></div>";
    }
    var body$ = $("<div class='a-IRR-dialogBody a-IRR-sortDialogRows'>" + rows + "</div>");
    dialog("Sort", body$, [{ text: "Apply", hot: true, click: function () {
      var sort = body$.find(".a-IRR-sortDialogRow").map(function () {
        var column = $(this).find("select").first().val();
        return column ? { column: column, direction: $(this).find(".apex-local-dir").val() } : null;
      }).get();
      cfg.act({ action: "sort", sort: sort });
    } }], "a-IRR-dialog--sort");
  }

  function downloadDialog(cfg) {
    var body$ = $("<div class='a-IRR-dialogBody'><ul class='a-IRR-iconList a-IRR-downloadFormatPills'>" + cfg.formats.map(function (format, index) {
      var labels = { csv: "CSV", html: "HTML", excel: "Excel", pdf: "PDF (print page)" };
      var icons = { csv: "xls", html: "html", excel: "xls", pdf: "pdf" };
      return "<li class='a-IRR-iconList-item'><label><input type='radio' name='apex_local_dl' value='" + format + "'" + (index === 0 ? " checked" : "") + "> <span class='a-Icon icon-irr-dl-" + (icons[format] || "html") + "' aria-hidden='true'></span> " + (labels[format] || format.toUpperCase()) + "</label></li>";
    }).join("") + "</ul></div>");
    dialog("Download", body$, [{ text: "Download", hot: true, click: function () {
      download(cfg.region, body$.find("input:checked").val());
    } }], "a-IRR-dialog--download");
  }


  // ------------------------------------------------------------- views and formatting dialogs

  function row(label, control, cls) { return "<div class='a-IRR-dialogRow " + (cls || "") + "'><label>" + html(label) + "</label>" + control + "</div>"; }
  function select(cls, options, value) {
    return "<select class='selectlist apex-item-select " + cls + "'>" + options.map(function (o) {
      return "<option value='" + html(String(o[0])) + "'" + (String(o[0]) === String(value === undefined ? "" : value) ? " selected" : "") + ">" + html(String(o[1])) + "</option>";
    }).join("") + "</select>";
  }
  function text(cls, value, placeholder) { return "<input type='text' class='text_field apex-item-text " + cls + "' value='" + html(value === undefined || value === null ? "" : String(value)) + "'" + (placeholder ? " placeholder='" + html(placeholder) + "'" : "") + ">"; }
  function columnOptions(cfg, filter, empty) {
    return (empty ? [["", empty]] : []).concat(cfg.columns.filter(filter || function () { return true; }).map(function (c) { return [c.name, c.label]; }));
  }
  var AGGS = [["sum", "Sum"], ["average", "Average"], ["count", "Count"], ["countDistinct", "Count Distinct"], ["min", "Minimum"], ["max", "Maximum"], ["median", "Median"]];
  var UNITS = [["min", "Minutes"], ["hours", "Hours"], ["days", "Days"], ["weeks", "Weeks"], ["months", "Months"], ["years", "Years"]];
  var COLORS = [["#99CCFF", "#000000"], ["#99FF99", "#000000"], ["#FFFF99", "#000000"], ["#FFCC99", "#000000"], ["#FF9999", "#000000"], ["#CC99FF", "#000000"]];
  function views(cfg) { return cfg.views || { breaks: [], highlights: [], computations: [], aggregates: [] }; }

  function controlBreakDialog(cfg) {
    var current = views(cfg).breaks || [];
    var rows = "";
    for (var i = 0; i < 6; i += 1) {
      var entry = current[i] || {};
      rows += "<div class='a-IRR-dialogRow a-IRR-controlBreakRow'><label>Column " + (i + 1) + "</label>" +
        select("apex-local-break", columnOptions(cfg, function (c) { return c.breakable !== false; }, "- Select Column -"), entry.column) +
        "<label class='apex-local-inline'><input type='checkbox' class='apex-local-enabled'" + (entry.column && entry.enabled === false ? "" : " checked") + "> Enabled</label></div>";
    }
    var body$ = $("<div class='a-IRR-dialogBody a-IRR-controlBreakRows'>" + rows + "</div>");
    dialog("Control Break", body$, [{ text: "Apply", hot: true, click: function () {
      cfg.act({ action: "controlBreak", breaks: body$.find(".a-IRR-controlBreakRow").map(function () {
        var column = $(this).find(".apex-local-break").val();
        return column ? { column: column, enabled: $(this).find(".apex-local-enabled").prop("checked") } : null;
      }).get() });
    } }], "a-IRR-dialog--controlBreak");
  }

  function highlightDialog(cfg, preset, index) {
    preset = preset || { type: "row", operator: "=", enabled: true, background: COLORS[0][0], text: "" };
    var quick = COLORS.map(function (c, i) { return "<button type='button' class='a-IRR-highlightQuickPick a-IRR-highlightQuickPick--" + (i + 1) + "' data-bg='" + c[0] + "' style='background:" + c[0] + "' aria-label='" + c[0] + "' title='" + c[0] + "'></button>"; }).join("");
    var body$ = $("<div class='a-IRR-dialogBody a-IRR-highlightDialog'>" +
      row("Name", text("apex-local-name", preset.name || "")) +
      row("Sequence", text("apex-local-seq", preset.sequence || ((views(cfg).highlights || []).length + 1) * 10)) +
      row("Enabled", "<input type='checkbox' class='apex-local-enabled'" + (preset.enabled === false ? "" : " checked") + ">") +
      row("Highlight Type", select("apex-local-type", [["row", "Row"], ["cell", "Cell"]], preset.type)) +
      row("Background Color", "<input type='color' class='apex-local-bg' value='" + html(preset.background || "#ffffff") + "'><label class='apex-local-inline'><input type='checkbox' class='apex-local-nobg'" + (preset.background ? "" : " checked") + "> None</label><span class='a-IRR-highlightQuickPicks'>" + quick + "</span>") +
      row("Text Color", "<input type='color' class='apex-local-fg' value='" + html(preset.text || "#000000") + "'><label class='apex-local-inline'><input type='checkbox' class='apex-local-nofg'" + (preset.text ? "" : " checked") + "> None</label>") +
      "<div class='a-IRR-highlightSectionTitle'>Highlight Condition</div>" +
      row("Column", select("apex-local-col", columnOptions(cfg), preset.column)) +
      row("Operator", select("apex-local-op", OPERATORS.concat([["regexp", "matches regular expression"], ["isInTheLast", "is in the last"], ["isNotInTheLast", "is not in the last"], ["isInTheNext", "is in the next"], ["isNotInTheNext", "is not in the next"]]), preset.operator)) +
      row("Expression", text("apex-local-value", preset.value)) +
      row("and", text("apex-local-value2", preset.value2), "apex-local-row2") +
      row("Unit", select("apex-local-unit", UNITS, preset.unit || "days"), "apex-local-rowUnit") +
      "<div class='a-IRR-highlightPreview'>Preview: <span class='a-IRR-highlightPreviewField'>Highlighted value</span></div></div>");
    function sync() {
      var op = body$.find(".apex-local-op").val();
      body$.find(".apex-local-row2").toggle(op === "between");
      body$.find(".apex-local-rowUnit").toggle(/^is(Not)?In/.test(op));
      body$.find(".a-IRR-highlightPreviewField").css({
        background: body$.find(".apex-local-nobg").prop("checked") ? "" : body$.find(".apex-local-bg").val(),
        color: body$.find(".apex-local-nofg").prop("checked") ? "" : body$.find(".apex-local-fg").val()
      });
    }
    body$.on("change input", "select, input", sync);
    body$.on("click", ".a-IRR-highlightQuickPick", function () { body$.find(".apex-local-bg").val(this.getAttribute("data-bg")); body$.find(".apex-local-nobg").prop("checked", false); sync(); });
    sync();
    dialog("Highlight", body$, [{ text: "Apply", hot: true, click: function () {
      var body = { action: "highlight", highlight: {
        name: body$.find(".apex-local-name").val() || "Highlight",
        sequence: Number(body$.find(".apex-local-seq").val()),
        enabled: body$.find(".apex-local-enabled").prop("checked"),
        type: body$.find(".apex-local-type").val(),
        background: body$.find(".apex-local-nobg").prop("checked") ? "" : body$.find(".apex-local-bg").val(),
        text: body$.find(".apex-local-nofg").prop("checked") ? "" : body$.find(".apex-local-fg").val(),
        column: body$.find(".apex-local-col").val(), operator: body$.find(".apex-local-op").val(),
        value: body$.find(".apex-local-value").val(), value2: body$.find(".apex-local-value2").val(), unit: body$.find(".apex-local-unit").val()
      } };
      if (index !== undefined) body.replace = index;
      cfg.act(body);
    } }], "a-IRR-dialog--highlight");
  }

  function computeDialog(cfg, preset, index) {
    preset = preset || {};
    var list = (cfg.identifiers || []).map(function (c) {
      return "<li><button type='button' class='a-Button a-Button--small apex-local-insert' data-computation-value='" + html(c.id) + "'><strong>" + html(c.id) + "</strong> " + html(c.label) + "</button></li>";
    }).join("");
    var fns = ["+", "-", "*", "/", "||", "round(", "nvl(", "upper(", "lower(", "substr(", "length(", "to_char(", "trunc(", "case when  then  else  end"].map(function (f) {
      return "<button type='button' class='a-Button a-Button--small apex-local-insert' data-computation-value='" + html(f) + "'>" + html(f) + "</button>";
    }).join(" ");
    var body$ = $("<div class='a-IRR-dialogBody'>" +
      (cfg.computations && cfg.computations.length ? row("Computation", select("apex-local-pick", [["", "- New Computation -"]].concat(cfg.computations.map(function (c, i) { return [i, c.label]; })), index === undefined ? "" : index)) : "") +
      row("Column Label", text("apex-local-label", preset.label)) +
      row("Format Mask", text("apex-local-mask", preset.formatMask, "e.g. 999G999G990D00")) +
      row("Expression", "<textarea class='textarea apex-item-textarea apex-local-expr' rows='3'>" + html(preset.expression || "") + "</textarea>") +
      "<div class='a-IRR-dialogRow apex-local-computeHelp'><label>Columns</label><ul class='apex-local-columnList apex-local-identifiers'>" + list + "</ul></div>" +
      "<div class='a-IRR-dialogRow'><label>Functions</label><div>" + fns + "</div></div></div>");
    body$.on("click", ".apex-local-insert", function () {
      var area = body$.find(".apex-local-expr")[0], value = this.getAttribute("data-computation-value");
      var start = area.selectionStart || area.value.length;
      area.value = area.value.slice(0, start) + value + area.value.slice(area.selectionEnd || start);
      area.focus();
    });
    body$.on("change", ".apex-local-pick", function () {
      var picked = this.value === "" ? undefined : Number(this.value);
      body$.closest(".ui-dialog-content").dialog("close");
      computeDialog(cfg, picked === undefined ? {} : cfg.computations[picked], picked);
    });
    var buttons = [{ text: "Apply", hot: true, click: function () {
      var body = { action: "compute", computation: { label: body$.find(".apex-local-label").val(), formatMask: body$.find(".apex-local-mask").val(), expression: body$.find(".apex-local-expr").val() } };
      if (index !== undefined) body.replace = index;
      cfg.act(body);
    } }];
    if (index !== undefined) buttons.unshift({ text: "Delete", click: function () { cfg.act({ action: "remove", kind: "computations", index: index }); } });
    dialog("Compute", body$, buttons, "a-IRR-dialog--computation");
  }

  function aggregateDialog(cfg) {
    var current = views(cfg).aggregates || [];
    var labelOf = function (name) { var c = cfg.columns.filter(function (x) { return x.name === name; })[0]; return c ? c.label : name; };
    var existing = current.length ? "<ul class='apex-local-columnList'>" + current.map(function (a, i) {
      var fn = AGGS.filter(function (x) { return x[0] === a.fn; })[0];
      return "<li><span>" + html((fn ? fn[1] : a.fn) + " of " + labelOf(a.column)) + "</span><button type='button' class='a-Button a-Button--small a-IRR-button--deleteAggregate' data-index='" + i + "'>Delete</button></li>";
    }).join("") + "</ul>" : "";
    var body$ = $("<div class='a-IRR-dialogBody'>" + existing +
      row("Function", select("apex-local-fn", AGGS, "sum")) +
      row("Column", select("apex-local-col", columnOptions(cfg, function (c) { return c.aggregate !== false && c.shown !== false; }))) + "</div>");
    body$.on("click", ".a-IRR-button--deleteAggregate", function () {
      body$.closest(".ui-dialog-content").dialog("close");
      cfg.act({ action: "remove", kind: "aggregates", index: Number(this.getAttribute("data-index")) });
    });
    dialog("Aggregate", body$, [{ text: "Apply", hot: true, click: function () {
      cfg.act({ action: "aggregate", fn: body$.find(".apex-local-fn").val(), column: body$.find(".apex-local-col").val() });
    } }], "a-IRR-dialog--aggregate");
  }

  function functionRows(cfg, functions, withSum, cls) {
    var rows = "";
    for (var i = 0; i < 4; i += 1) {
      var f = functions[i] || {};
      rows += "<div class='a-IRR-dialogRow " + cls + "'><label>Function " + (i + 1) + "</label>" +
        select("apex-local-fn", [["", "- Select Function -"]].concat(AGGS).concat(withSum), f.fn) +
        select("apex-local-col", columnOptions(cfg, null, "- Select Column -"), f.column) +
        text("apex-local-label", f.label, "Label") + text("apex-local-mask", f.formatMask, "Format Mask") +
        "<label class='apex-local-inline'><input type='checkbox' class='apex-local-sum'" + (f.sum ? " checked" : "") + "> Sum</label></div>";
    }
    return rows;
  }
  function readFunctions(body$, cls) {
    return body$.find("." + cls).map(function () {
      var fn = $(this).find(".apex-local-fn").val();
      return fn ? { fn: fn, column: $(this).find(".apex-local-col").val(), label: $(this).find(".apex-local-label").val(), formatMask: $(this).find(".apex-local-mask").val(), sum: $(this).find(".apex-local-sum").prop("checked") } : null;
    }).get();
  }
  function columnRows(cfg, label, cls, values, count) {
    var rows = "";
    for (var i = 0; i < count; i += 1) rows += row(label + " " + (i + 1), select(cls, columnOptions(cfg, null, "- Select Column -"), values[i]));
    return rows;
  }
  function picked(body$, cls) { return body$.find("." + cls).map(function () { return this.value || null; }).get(); }

  function groupByDialog(cfg) {
    var spec = views(cfg).groupBy || { columns: [], functions: [] };
    var body$ = $("<div class='a-IRR-dialogBody'><div class='a-IRR-groupBySectionTitle'>Group By Columns</div>" + columnRows(cfg, "Column", "apex-local-gb", spec.columns, 3) +
      "<div class='a-IRR-groupBySectionTitle'>Functions</div>" + functionRows(cfg, spec.functions, [["percentOfTotalSum", "Percent of Total Sum"], ["percentOfTotalCount", "Percent of Total Count"]], "a-IRR-groupByFunctionRow") + "</div>");
    dialog("Group By", body$, [{ text: "Apply", hot: true, click: function () {
      cfg.act({ action: "groupBy", groupBy: { columns: picked(body$, "apex-local-gb"), functions: readFunctions(body$, "a-IRR-groupByFunctionRow") } });
    } }], "a-IRR-dialog--groupBy");
  }

  function pivotDialog(cfg) {
    var spec = views(cfg).pivot || { pivot: [], rows: [], functions: [] };
    var body$ = $("<div class='a-IRR-dialogBody'><div class='a-IRR-groupBySectionTitle'>Pivot Columns</div>" + columnRows(cfg, "Pivot Column", "apex-local-pv", spec.pivot, 3) +
      "<div class='a-IRR-groupBySectionTitle'>Row Columns</div>" + columnRows(cfg, "Row Column", "apex-local-rc", spec.rows, 3) +
      "<div class='a-IRR-groupBySectionTitle'>Functions</div>" + functionRows(cfg, spec.functions, [["ratioToReportSum", "Ratio to Report Sum"], ["ratioToReportCount", "Ratio to Report Count"]], "a-IRR-pivotFunctionRow") + "</div>");
    dialog("Pivot", body$, [{ text: "Apply", hot: true, click: function () {
      cfg.act({ action: "pivot", pivot: { pivot: picked(body$, "apex-local-pv"), rows: picked(body$, "apex-local-rc"), functions: readFunctions(body$, "a-IRR-pivotFunctionRow") } });
    } }], "a-IRR-dialog--pivot");
  }

  function chartDialog(cfg) {
    var spec = views(cfg).chart || { type: "bar", fn: "sum", orientation: "vertical", sort: "default" };
    var types = [["bar", "Bar"], ["line", "Line"], ["lineWithArea", "Line with Area"], ["pie", "Pie"]];
    var body$ = $("<div class='a-IRR-dialogBody a-IRR-chartForm'><ul class='a-IRR-radioIconList a-IRR-radioIconList--horItems a-IRR-chartTypePills'>" + types.map(function (t) {
      return "<li class='a-IRR-radioIconList-item'><label><input type='radio' name='apex_local_chart_type' value='" + t[0] + "'" + (t[0] === spec.type ? " checked" : "") + "> " + t[1] + "</label></li>";
    }).join("") + "</ul>" +
      row("Label", select("apex-local-label", columnOptions(cfg, null, "- Select Column -"), spec.label)) +
      row("Axis Title for Label", text("apex-local-labelTitle", spec.labelTitle)) +
      row("Value", select("apex-local-value", columnOptions(cfg, null, "- Select Column -"), spec.value)) +
      row("Axis Title for Value", text("apex-local-valueTitle", spec.valueTitle)) +
      row("Function", select("apex-local-fn", AGGS.filter(function (a) { return a[0] !== "countDistinct" && a[0] !== "median"; }), spec.fn)) +
      row("Orientation", select("apex-local-orientation", [["vertical", "Vertical"], ["horizontal", "Horizontal"]], spec.orientation)) +
      row("Sort", select("apex-local-sort", [["default", "Default"], ["labelAsc", "Label - Ascending"], ["labelDesc", "Label - Descending"], ["valueAsc", "Value - Ascending"], ["valueDesc", "Value - Descending"]], spec.sort)) + "</div>");
    dialog("Chart", body$, [{ text: "Apply", hot: true, click: function () {
      cfg.act({ action: "chart", chart: { type: body$.find("input[name=apex_local_chart_type]:checked").val(), label: body$.find(".apex-local-label").val(), labelTitle: body$.find(".apex-local-labelTitle").val(),
        value: body$.find(".apex-local-value").val(), valueTitle: body$.find(".apex-local-valueTitle").val(), fn: body$.find(".apex-local-fn").val(),
        orientation: body$.find(".apex-local-orientation").val(), sort: body$.find(".apex-local-sort").val() } });
    } }], "a-IRR-dialog--chart");
  }

  function saveReportDialog(cfg) {
    var current = cfg.report && cfg.report.group === "private" ? cfg.report.name : "";
    var body$ = $("<div class='a-IRR-dialogBody'>" + row("Name", text("apex-local-name", current)) +
      row("Description", "<textarea class='textarea apex-item-textarea apex-local-desc' rows='2'></textarea>") +
      "<p class='apex-local-note'>Saved reports are private to this preview session.</p></div>");
    dialog("Save Report", body$, [{ text: "Apply", hot: true, click: function () {
      var name = body$.find(".apex-local-name").val();
      if (!name) { apex.message.alert("Enter a name for the report."); return false; }
      cfg.act({ action: "saveReport", name: name, description: body$.find(".apex-local-desc").val() });
    } }], "a-IRR-dialog--saveReport");
  }

  function notSimulated(name) {
    apex.message.alert(name + " is not simulated in the local preview; the report always shows current data.");
  }

  /** Opens an Actions-menu dialog by its APEX name (also used by invokeInteractiveReportDialog). */
  function openDialog(cfg, name) {
    switch (name) {
      case "columns": return columnsDialog(cfg);
      case "filters": case "filter": return filterDialog(cfg);
      case "sort": return sortDialog(cfg);
      case "controlBreak": return controlBreakDialog(cfg);
      case "highlight": return highlightDialog(cfg);
      case "compute": return computeDialog(cfg);
      case "aggregate": return aggregateDialog(cfg);
      case "groupBy": return groupByDialog(cfg);
      case "pivot": return pivotDialog(cfg);
      case "chart": return chartDialog(cfg);
      case "saveReport": return saveReportDialog(cfg);
      case "download": return downloadDialog(cfg);
      case "flashback": return notSimulated("Flashback");
      case "subscription": return notSimulated("Subscription");
      default: apex.debug.warn("[apex-local] interactive report dialog " + name + " is not simulated");
    }
  }

  function confirmReset(cfg) {
    apex.message.confirm("Restore report to the default settings?", function (ok) { if (ok) cfg.act({ action: "reset" }); });
  }

  // ------------------------------------------------------------- interactive report

  function irConfig(container) {
    var cfg = JSON.parse(container.getAttribute("data-apex-local-ir"));
    cfg.act = function (body) { return act(cfg.region, body); };
    cfg.computations = (cfg.views && cfg.views.computations) || [];
    return cfg;
  }

  function initIr(container) {
    if (container.apexLocalReady) return;
    container.apexLocalReady = true;
    var cfg = irConfig(container);
    var id = cfg.region;
    container.apexLocalSearchColumn = "";
    var menu$ = $(esc(id + "_actions_menu"));
    if (menu$.length) {
      var items = [];
      var m = cfg.menu;
      var a = function (label, iconName, fn) { return { type: "action", label: label, icon: iconName, action: fn }; };
      if (m.columns) items.push(a("Columns", "icon-irr-select-cols", function () { columnsDialog(cfg); }));
      if (m.filter) items.push(a("Filter", "icon-irr-filter", function () { filterDialog(cfg); }));
      var data = [];
      if (m.sort) data.push(a("Sort", "icon-irr-sort", function () { sortDialog(cfg); }));
      if (m.aggregate) data.push(a("Aggregate", "icon-irr-aggregate", function () { aggregateDialog(cfg); }));
      if (m.compute) data.push(a("Compute", "icon-irr-compute", function () { computeDialog(cfg); }));
      if (m.flashback) data.push(a("Flashback", "icon-irr-flashback", function () { notSimulated("Flashback"); }));
      if (data.length) items.push({ type: "subMenu", label: "Data", icon: "icon-irr-calculator", menu: { items: data } });
      var format = [];
      if (m.controlBreak) format.push(a("Control Break", "icon-irr-control-break", function () { controlBreakDialog(cfg); }));
      if (m.highlight) format.push(a("Highlight", "icon-irr-highlight", function () { highlightDialog(cfg); }));
      if (m.rowsPerPage) format.push({ type: "subMenu", label: "Rows Per Page", icon: "icon-irr-rows", menu: { items: [{
        type: "radioGroup", get: function () { return String(cfg.rowsPerPage); },
        set: function (value) { cfg.act({ action: "rowsPerPage", value: Number(value) }); },
        choices: cfg.rowsPerPageOptions.map(function (n) { return { label: String(n), value: String(n) }; }).concat([{ label: "All", value: "-1" }])
      }] } });
      if (format.length) items.push({ type: "subMenu", label: "Format", icon: "icon-irr-format", menu: { items: format } });
      if (m.chart) items.push(a("Chart", "icon-irr-chart", function () { chartDialog(cfg); }));
      if (m.groupBy) items.push(a("Group By", "icon-irr-group-by", function () { groupByDialog(cfg); }));
      if (m.pivot) items.push(a("Pivot", "icon-irr-pivot", function () { pivotDialog(cfg); }));
      items.push({ type: "separator" });
      var report = [];
      if (m.saveReport) report.push(a("Save Report", "icon-irr-saved-report", function () { saveReportDialog(cfg); }));
      if (m.saveReport && cfg.report && cfg.report.group === "private") report.push(a("Delete Report", "icon-irr-ws-dg-delete", function () {
        apex.message.confirm("Delete the saved report \"" + cfg.report.name + "\"?", function (ok) { if (ok) cfg.act({ action: "deleteReport" }); });
      }));
      if (m.reset) report.push(a("Reset", "icon-irr-reset", function () { confirmReset(cfg); }));
      if (report.length) items.push({ type: "subMenu", label: "Report", icon: "icon-irr-report", menu: { items: report } });
      if (m.download) items.push(a("Download", "icon-irr-download", function () { downloadDialog(cfg); }));
      if (m.subscription) items.push(a("Subscription", "icon-irr-subscription", function () { notSimulated("Subscription"); }));
      if (m.help) items.push(a("Help", "icon-irr-help", function () {
        apex.message.alert("Use the search bar to find rows, click a column heading to sort or filter it, and use Actions to choose columns, filter, format, aggregate, compute, chart, group by, pivot, save or download the report.");
      }));
      menu$.menu({ items: items });
      $(esc(id + "_actions_button")).attr("data-menu", id + "_actions_menu").addClass("js-menuButton");
    }
    var colMenu$ = $(esc(id + "_column_search_drop"));
    if (colMenu$.length) {
      colMenu$.menu({ items: [{ type: "radioGroup",
        get: function () { return container.apexLocalSearchColumn; },
        set: function (value) {
          container.apexLocalSearchColumn = value;
          var column = cfg.columns.filter(function (c) { return c.name === value; })[0];
          var label = column ? "Search: " + column.label : "Search: All Text Columns";
          $(esc(id + "_search_field")).attr({ placeholder: label, "aria-label": label }).trigger("focus");
        },
        choices: [{ label: "All Text Columns", value: "" }].concat(cfg.columns.filter(function (c) { return c.shown; }).map(function (c) {
          return { label: c.label, value: c.name };
        }))
      }] });
      $(esc(id + "_column_search_root")).attr("data-menu", id + "_column_search_drop").addClass("js-menuButton");
    }
  }

  function irOf(element) {
    var container = $(element).closest("[data-apex-local-ir]")[0];
    return container ? { container: container, cfg: irConfig(container) } : null;
  }

  function search(element) {
    var ir = irOf(element);
    if (!ir) return;
    var text = $(esc(ir.cfg.region + "_search_field")).val();
    if (!text) return;
    ir.cfg.act({ action: "search", text: text, column: ir.container.apexLocalSearchColumn || "" });
  }

  var sortWidget$ = null;
  function closeSortWidget() {
    if (sortWidget$) { sortWidget$.remove(); sortWidget$ = null; $(".a-IRR-header.is-active, .a-GV-header.is-active").removeClass("is-active"); }
  }

  /** Column heading popup (sort, hide, filter by values) shared by interactive reports and grids. */
  function openSortWidget(link, cfg, name, header$) {
    var column = cfg.columns.filter(function (c) { return c.name === name; })[0] || { name: name, label: name };
    closeSortWidget();
    header$.addClass("is-active");
    var action = function (key, label, icon, enabled) {
      return enabled ? "<li class='a-IRR-sortWidget-actions-item'><button type='button' class='a-Button a-IRR-button a-IRR-sortWidget-button' data-option='" + key + "' title='" + label + "' aria-label='" + label + "'><span class='a-Icon " + icon + "' aria-hidden='true'></span></button></li>" : "";
    };
    sortWidget$ = $("<div class='a-IRR-sortWidget apex-local-sortWidget' role='dialog' aria-label='" + html(column.label) + "'>" +
      "<ul class='a-IRR-sortWidget-actions' role='toolbar'>" +
      action("up", "Sort Ascending", "icon-irr-sort-asc", column.sort !== false) +
      action("down", "Sort Descending", "icon-irr-sort-desc", column.sort !== false) +
      action("hide", "Hide Column", "icon-irr-remove-col", column.hide !== false) + "</ul>" +
      (column.filter !== false ? "<div class='a-IRR-sortWidget-search'><label class='a-IRR-sortWidget-searchLabel' for='apex_local_sw_search'><span class='u-VisuallyHidden'>Filter</span></label>" +
      "<input type='text' class='a-IRR-sortWidget-searchField' id='apex_local_sw_search' placeholder='Filter...' autocomplete='off'>" +
      "<div class='a-IRR-sortWidget-rows' role='listbox' aria-multiselectable='true'></div>" +
      "<div class='a-IRR-sortWidget-footer'><span aria-live='polite' class='a-IRR-sortWidget-selectedCount'></span>" +
      "<button class='a-Button a-IRR-button a-IRR-sortWidget-clear' type='button'>Clear</button>" +
      "<button class='a-Button a-Button--hot a-IRR-button a-IRR-sortWidget-apply' type='button'>Apply</button></div></div>" : "") +
      "</div>").appendTo("body");
    var offset = header$.offset();
    sortWidget$.css({ top: offset.top + header$.outerHeight(), left: Math.max(4, Math.min(offset.left, $(window).width() - 290)) });
    var selected = [];
    function updateCount() {
      sortWidget$.find(".a-IRR-sortWidget-selectedCount").text(selected.length ? selected.length + " selected" : "");
    }
    if (column.filter !== false) {
      fetch(route("report-values", { region: cfg.region, column: name }), { credentials: "same-origin" })
        .then(function (response) { return response.json(); })
        .then(function (values) {
          if (!sortWidget$) return;
          sortWidget$.find(".a-IRR-sortWidget-rows").html((values || []).map(function (value) {
            return "<a href='#' class='a-IRR-sortWidget-row' role='checkbox' aria-checked='false' data-return-value='" + html(value) + "'><span aria-hidden='true' class='u-checkbox'></span><span class='a-IRR-sortWidget-rowLabel'>" + (value === "" ? "(null)" : html(value)) + "</span></a>";
          }).join(""));
        });
    }
    sortWidget$.on("click", ".a-IRR-sortWidget-button", function () {
      var option = this.getAttribute("data-option");
      closeSortWidget();
      if (option === "hide") cfg.act({ action: "hide", column: name });
      else cfg.act({ action: "sort", sort: [{ column: name, direction: option === "up" ? "asc" : "desc" }] });
    });
    sortWidget$.on("click", ".a-IRR-sortWidget-row", function (event) {
      event.preventDefault();
      var value = this.getAttribute("data-return-value");
      var index = selected.indexOf(value);
      if (index >= 0) selected.splice(index, 1); else selected.push(value);
      $(this).toggleClass("is-selected", index < 0).attr("aria-checked", index < 0 ? "true" : "false")
        .find(".u-checkbox").toggleClass("is-checked", index < 0);
      updateCount();
    });
    sortWidget$.on("click", ".a-IRR-sortWidget-clear", function () {
      selected = [];
      sortWidget$.find(".a-IRR-sortWidget-row").removeClass("is-selected").attr("aria-checked", "false").find(".u-checkbox").removeClass("is-checked");
      updateCount();
    });
    sortWidget$.on("click", ".a-IRR-sortWidget-apply", function () {
      var text = sortWidget$.find(".a-IRR-sortWidget-searchField").val();
      closeSortWidget();
      if (selected.length === 1) cfg.act({ action: "filter", column: name, operator: selected[0] === "" ? "isNull" : "=", value: selected[0] });
      else if (selected.length > 1) cfg.act({ action: "filter", column: name, operator: "in", value: selected.join(",") });
      else if (text) cfg.act({ action: "filter", column: name, operator: "contains", value: text });
    });
    sortWidget$.on("input", ".a-IRR-sortWidget-searchField", function () {
      var needle = this.value.toLowerCase();
      sortWidget$.find(".a-IRR-sortWidget-row").each(function () {
        this.hidden = needle !== "" && $(this).text().toLowerCase().indexOf(needle) < 0;
      });
    });
    sortWidget$.on("keydown", ".a-IRR-sortWidget-searchField", function (event) {
      if (event.key === "Enter") { event.preventDefault(); sortWidget$.find(".a-IRR-sortWidget-apply").trigger("click"); }
    });
    sortWidget$.on("keydown", function (event) { if (event.key === "Escape") { closeSortWidget(); link.focus(); } });
    (sortWidget$.find(".a-IRR-sortWidget-searchField")[0] || sortWidget$.find("button")[0] || link).focus();
  }

  $(document).on("mousedown", function (event) {
    if (sortWidget$ && !$(event.target).closest(".apex-local-sortWidget").length && !$(event.target).closest(".a-IRR-headerLink, .a-GV-header").length) closeSortWidget();
  });
  $(document).on("click", ".a-IRR-headerLink[data-column]", function (event) {
    event.preventDefault();
    if (sortWidget$ && $(this).closest(".a-IRR-header").hasClass("is-active")) { closeSortWidget(); return; }
    var ir = irOf(this);
    if (ir) openSortWidget(this, ir.cfg, this.getAttribute("data-column"), $(this).closest(".a-IRR-header"));
  });
  $(document).on("click", "[data-apex-local-ir] .a-IRR-button--search", function () { search(this); });
  $(document).on("keydown", "[data-apex-local-ir] .a-IRR-search-field", function (event) {
    if (event.key === "Enter") { event.preventDefault(); search(this); }
  });
  $(document).on("click", "[data-apex-local-ir-page]", function () {
    var ir = irOf(this);
    if (ir) paginate(ir.cfg.region, this.getAttribute("data-apex-local-ir-page"));
  });
  $(document).on("change", "[data-apex-local-ir-rows]", function () {
    var ir = irOf(this);
    if (ir) ir.cfg.act({ action: "rowsPerPage", value: Number(this.value) });
  });
  $(document).on("click", "[data-apex-local-ir-toggle]", function () {
    var ir = irOf(this);
    if (ir) ir.cfg.act({ action: "toggleFilter", index: Number(this.getAttribute("data-apex-local-ir-toggle")), enabled: this.checked });
  });
  $(document).on("click", "[data-apex-local-ir-remove]", function () {
    var ir = irOf(this);
    if (ir) ir.cfg.act({ action: "removeFilter", index: Number(this.getAttribute("data-apex-local-ir-remove")) });
  });
  $(document).on("click", "[data-apex-local-ir-edit]", function () {
    var ir = irOf(this);
    if (!ir) return;
    var index = Number(this.getAttribute("data-apex-local-ir-edit"));
    var filter = ir.cfg.filters && ir.cfg.filters[index];
    if (filter && filter.column) {
      var cfg = ir.cfg;
      cfg.act = function (body) { return act(cfg.region, Object.assign({ replace: index }, body)); };
      filterDialog(cfg, filter);
    }
  });


  // Chips for control breaks and highlights, view tabs, single row view and saved reports.
  function chipTarget(element, attr) {
    var parts = element.getAttribute(attr).split(":");
    return { kind: parts[0], index: Number(parts[1]) };
  }
  function cfgOf(element) {
    var ir = irOf(element);
    if (ir) return ir.cfg;
    var root = $(element).closest("[data-apex-local-ig]")[0];
    var ig = root && grids[root.getAttribute("data-apex-local-ig")];
    return ig ? gridReportConfig(ig) : null;
  }
  $(document).on("click", "[data-apex-local-ir-chip-toggle]", function () {
    var cfg = cfgOf(this), t = chipTarget(this, "data-apex-local-ir-chip-toggle");
    if (cfg) cfg.act({ action: "toggle", kind: t.kind, index: t.index, enabled: this.checked });
  });
  $(document).on("click", "[data-apex-local-ir-chip-remove]", function () {
    var cfg = cfgOf(this), t = chipTarget(this, "data-apex-local-ir-chip-remove");
    if (cfg) cfg.act({ action: "remove", kind: t.kind, index: t.index });
  });
  $(document).on("click", "[data-apex-local-ir-chip-edit]", function () {
    var cfg = cfgOf(this), t = chipTarget(this, "data-apex-local-ir-chip-edit");
    if (!cfg) return;
    if (t.kind === "breaks") controlBreakDialog(cfg);
    else if (t.kind === "highlights") highlightDialog(cfg, views(cfg).highlights[t.index], t.index);
  });
  $(document).on("click", "[data-apex-local-ir-close-view]", function (event) {
    event.preventDefault(); event.stopPropagation();
    var ir = irOf(this);
    if (ir) ir.cfg.act({ action: "remove", kind: this.getAttribute("data-apex-local-ir-close-view") });
  });
  $(document).on("click", "[data-apex-local-ir-view]", function (event) {
    if ($(event.target).closest("[data-apex-local-ir-close-view]").length) return;
    var ir = irOf(this);
    if (ir) ir.cfg.act({ action: "view", view: this.getAttribute("data-apex-local-ir-view") });
  });
  $(document).on("dblclick", ".a-IRR-viewTabs-tabButton[data-view]", function () {
    var ir = irOf(this), view = this.getAttribute("data-view");
    if (!ir) return;
    if (view === "chart") chartDialog(ir.cfg); else if (view === "groupBy") groupByDialog(ir.cfg); else if (view === "pivot") pivotDialog(ir.cfg);
  });
  $(document).on("click", "[data-apex-local-ir-single]", function (event) {
    event.preventDefault();
    var ir = irOf(this);
    if (!ir) return;
    post("report", { region: ir.cfg.region, action: "singleRow", index: Number(this.getAttribute("data-apex-local-ir-single")) }).then(function () { return refresh(ir.cfg.region); });
  });
  $(document).on("change", "[data-apex-local-ir-single-option]", function () {
    var view$ = $(this).closest(".a-IRR-singleRowView");
    var nulls = view$.find("[data-apex-local-ir-single-option=nulls]").prop("checked");
    var displayed = view$.find("[data-apex-local-ir-single-option=displayed]").prop("checked");
    view$.find(".a-IRR-singleRow-row").each(function () {
      var row$ = $(this);
      row$.toggle(!(nulls && row$.hasClass("is-null")) && !(displayed && !row$.hasClass("is-displayed")));
    });
  });
  $(document).on("change", "[data-apex-local-ir-report]", function () {
    var ir = irOf(this);
    if (ir) ir.cfg.act({ action: "selectReport", id: this.value });
  });

  // Chart view: drawn on the server, redrawn at the report's real width.
  function sizeIrChart(el) {
    var width = Math.round(el.clientWidth);
    if (!width || Math.abs(width - Number(el.getAttribute("data-width"))) < 6) return;
    var ir = irOf(el);
    if (!ir) return;
    el.setAttribute("data-width", String(width));
    fetch(route("report-chart", { region: ir.cfg.region, width: width }), { credentials: "same-origin" })
      .then(function (response) { return response.ok ? response.text() : null; })
      .then(function (markup) { if (markup) el.innerHTML = markup; });
  }

  if (window.apexLocal && apexLocal.registerAction) {
    apexLocal.registerAction("invokeInteractiveReportDialog", function (action, event, trigger, helpers) {
      var name = (action.settings && action.settings.action) || "columns";
      helpers.elements(action.selector, trigger).each(function () {
        var container = $(this).find("[data-apex-local-ir]").addBack("[data-apex-local-ir]")[0];
        if (container) openDialog(irConfig(container), name);
        else apex.debug.warn("[apex-local] invokeInteractiveReportDialog: no interactive report in", this);
      });
    });
  }

  // ------------------------------------------------------------- classic report

  $(document).on("click", "[data-apex-local-sort]", function (event) {
    event.preventDefault();
    act(this.getAttribute("data-region"), { action: "classicSort", column: this.getAttribute("data-apex-local-sort") });
  });

  // ------------------------------------------------------------- interactive grid

  var grids = {};

  function gridValue(model, record, field) {
    var value = model.getValue(record, field);
    if (value && typeof value === "object") value = value.v;
    return value === undefined || value === null ? "" : String(value);
  }

  function gridChanges(ig) {
    var model = apex.model.get(ig.cfg.modelName);
    if (!model) return [];
    var changes = [];
    model.getChanges().slice().forEach(function (meta) {
      var record = meta.record;
      var id = model.getRecordId(record);
      if (meta.inserted && meta.deleted) return;
      var values = {};
      Object.keys(ig.cfg.fields).forEach(function (field) { values[field] = gridValue(model, record, field); });
      var key = ig.cfg.identity.map(function (field) {
        var original = meta.original && meta.original[ig.cfg.fields[field].index];
        if (original && typeof original === "object") original = original.v;
        return original !== undefined && original !== null ? String(original) : values[field];
      }).join("|");
      changes.push({ op: meta.deleted ? "delete" : meta.inserted ? "insert" : "update", id: meta.inserted ? id : key, values: values });
    });
    apex.model.release(ig.cfg.modelName);
    return changes;
  }

  function showGridErrors(ig, errors) {
    var model = apex.model.get(ig.cfg.modelName);
    var messages = [];
    errors.forEach(function (error) {
      messages.push({ type: "error", location: "page", message: error.message, unsafe: false });
      if (model && error.id && error.column) {
        var record = model.getRecord(error.id);
        if (record) model.setValidity("error", error.id, error.column, error.message);
      }
    });
    if (model) apex.model.release(ig.cfg.modelName);
    apex.message.clearErrors();
    apex.message.showErrors(messages);
  }

  // Errors of a page submit that belong to grid rows (regionDomId, recordId, columnName) mark the
  // cells too, as the Interactive Grid does with the errors of its region.
  var baseShowErrors = apex.message.showErrors;
  apex.message.showErrors = function (errors) {
    (Array.isArray(errors) ? errors : errors ? [errors] : []).forEach(function (error) {
      var ig = error && error.regionDomId && grids[error.regionDomId];
      if (!ig || !error.recordId || !error.columnName) return;
      var model = apex.model.get(ig.cfg.modelName);
      if (!model) return;
      if (model.getRecord(error.recordId)) model.setValidity("error", error.recordId, error.columnName, error.message);
      apex.model.release(ig.cfg.modelName);
    });
    return baseShowErrors.apply(this, arguments);
  };

  function saveGrid(ig) {
    var changes = gridChanges(ig);
    if (!changes.length) { apex.message.showPageSuccess("No changes to save"); return Promise.resolve(); }
    return post("ig-save", { region: ig.cfg.region, changes: changes }).then(function (result) {
      if (!result.ok) { showGridErrors(ig, result.errors || []); return; }
      apex.message.clearErrors();
      apex.message.showPageSuccess("Changes saved");
      return refreshGrid(ig.cfg.region, true);
    });
  }

  function refreshGrid(region, withDetails) {
    var ig = grids[region];
    return refresh(region).then(function () {
      if (withDetails && ig) return Promise.all(ig.cfg.details.map(function (detail) { return refresh(detail); }));
    });
  }

  function gridAct(ig, body, force) {
    var changes = force ? [] : gridChanges(ig);
    var go = function () {
      return post("report", Object.assign({ region: ig.cfg.region }, body)).then(function (result) {
        if (result && result.error) { apex.message.alert(result.error); return; }
        return refreshGrid(ig.cfg.region, true);
      });
    };
    if (changes.length) {
      apex.message.confirm("There are unsaved changes. Do you want to continue?", function (ok) { if (ok) go(); });
      return Promise.resolve();
    }
    return go();
  }

  function destroyGrid(region) {
    var ig = grids[region];
    if (!ig) return;
    try { ig.grid$.grid("destroy"); } catch (e) { /* already gone */ }
    try { apex.model.destroy(ig.cfg.modelName); } catch (e) { /* not created */ }
    $(esc(region + "_ig_row_actions_menu")).remove();
    $(esc(region + "_ig_actions_menu")).remove();
    delete grids[region];
  }

  function initGrid(root) {
    var region = root.getAttribute("data-apex-local-ig");
    if (root.apexLocalReady && grids[region]) return;
    destroyGrid(region);
    root.apexLocalReady = true;
    var cfg = JSON.parse(document.getElementById(region + "_ig_config").textContent);
    var ig = { cfg: cfg, root$: $(root) };
    grids[region] = ig;
    cfg.act = function (body) { return gridAct(ig, body); };
    if (!apex.libVersions) apex.libVersions = {};
    if (!apex.libVersions.domPurify) apex.libVersions.domPurify = "3.4.14";
    if (apex.model.get(cfg.modelName)) apex.model.destroy(cfg.modelName);
    createColumnItems(cfg);
    apex.model.create(cfg.modelName, {
      shape: "table", recordIsArray: true, fields: cfg.fields, identityField: cfg.identity.length ? cfg.identity : undefined,
      metaField: cfg.metaField,
      hasTotalRecords: true, paginationType: "none", editable: cfg.editable, onlyMarkForDelete: true,
      check: function (result, operation) {
        if (operation === "canAdd") return result && cfg.allowed.add;
        if (operation === "canDelete") return result && cfg.allowed.delete;
        if (operation === "canEdit") return result && (cfg.allowed.update || false);
        return result;
      }
    }, cfg.data, cfg.data.length);

    // Row actions menu (genuine menu widget) for the APEX$ROW_ACTION column.
    var currentRecord = null;
    if (cfg.rowActions) {
      var rowItems = [];
      if (cfg.editable && cfg.allowed.add) {
        rowItems.push({ type: "action", label: "Add Row", icon: "icon-ig-add-row", action: function () { addRow(ig, currentRecord); } });
        rowItems.push({ type: "action", label: "Duplicate Row", icon: "icon-ig-duplicate", action: function () { duplicateRow(ig, currentRecord); } });
      }
      if (cfg.editable && cfg.allowed["delete"]) rowItems.push({ type: "action", label: "Delete Row", icon: "icon-ig-delete", action: function () {
        var model = apex.model.get(cfg.modelName); model.deleteRecords([currentRecord]); apex.model.release(cfg.modelName);
      } });
      if (cfg.editable) rowItems.push({ type: "action", label: "Revert Changes", icon: "icon-ig-revert", action: function () {
        var model = apex.model.get(cfg.modelName); model.revertRecords([currentRecord]); apex.model.release(cfg.modelName);
      } });
      if (!rowItems.length) rowItems.push({ type: "action", label: "Refresh Rows", icon: "icon-ig-refresh", action: function () { refreshGrid(region); } });
      $("<div id='" + html(region) + "_ig_row_actions_menu'></div>").appendTo("body").menu({ items: rowItems });
      cfg.columns.APEX$ROW_ACTION && (cfg.columns.APEX$ROW_ACTION.cellTemplate =
        "<button type='button' class='a-Button a-Button--noLabel a-Button--iconTextButton a-Button--actions js-menuButton' data-menu='" + html(region) + "_ig_row_actions_menu' aria-haspopup='menu' aria-expanded='false' aria-label='Row Actions' title='Row Actions'><span class='a-Icon icon-ig-actions' aria-hidden='true'></span></button>");
    }

    var grid$ = ig.grid$ = $(esc(region + "_ig_grid_vc"));
    var paged = cfg.pagination === "page";
    grid$.grid({
      modelName: cfg.modelName,
      columns: [cfg.columns],
      editable: cfg.editable,
      rowHeader: cfg.rowSelector || cfg.editable ? "plain" : "none",
      rowHeaderCheckbox: cfg.rowSelector,
      multiple: cfg.rowSelector,
      selectCells: false,
      hasSize: false,
      stickyFooter: false,
      stickyTop: false,
      reorderColumns: false,
      noDataMessage: cfg.noData,
      noDataIcon: "icon-irr-no-results",
      showNullAs: "",
      rowsPerPage: paged ? (cfg.rowsPerPage || 50) : cfg.data.length || 50,
      pagination: paged ? { scroll: false, showPageLinks: true, maxLinks: 5, showRange: true, showPageSelector: false, firstAndLastButtons: false }
        : { scroll: false, showRange: cfg.showTotal, showPageLinks: false },
      footer: true,
      highlights: cfg.highlights || {},
      aggregateLabels: cfg.aggregateLabels || {},
      activateColumnHeader: function (event, ui) {
        var name = ui.column && ui.column.property;
        if (!name || /^APEX\$/.test(name)) return;
        if (sortWidget$ && ui.header$.hasClass("is-active")) { closeSortWidget(); return; }
        openSortWidget(ui.header$[0], gridReportConfig(ig), name, ui.header$);
      },
      cancelColumnHeader: function () { closeSortWidget(); },
      sortChange: function (event, ui) {
        var direction = ui.direction;
        var name = ui.column && ui.column.property;
        if (!name) return;
        gridAct(ig, { action: "sort", sort: ui.action !== "clear" && direction ? [{ column: name, direction: direction }] : [] });
      },
      selectionChange: function () {
        if (!cfg.details.length) return;
        var records = grid$.grid("getSelectedRecords");
        if (!records.length || !cfg.identity.length) return;
        var model = apex.model.get(cfg.modelName);
        var id = cfg.identity.map(function (field) { return gridValue(model, records[0], field); }).join("|");
        apex.model.release(cfg.modelName);
        if (id === cfg.selected) return;
        cfg.selected = id;
        post("report", { region: region, action: "select", id: id }).then(function () {
          cfg.details.forEach(function (detail) { refresh(detail); });
        });
      }
    });
    if (cfg.details.length && cfg.data.length) {
      var model = apex.model.get(cfg.modelName);
      var target = null;
      model.forEach(function (record) {
        var id = cfg.identity.map(function (field) { return gridValue(model, record, field); }).join("|");
        if (!target && (!cfg.selected || id === cfg.selected)) target = record;
      });
      apex.model.release(cfg.modelName);
      if (target) grid$.grid("setSelectedRecords", [target], false, true);
    }
    grid$.on("click", ".a-Button--actions", function () {
      currentRecord = grid$.grid("getRecords", [$(this).closest("tr")])[0] || null;
    });

    buildToolbar(ig);
    buildControls(ig);
  }


  // apex.item implementations for grid column editors the native item code does not cover.
  function createColumnItems(cfg) {
    (cfg.customItems || []).forEach(function (spec) {
      var el = document.getElementById(spec.id);
      if (!el || el.apexLocalItem) return;
      el.apexLocalItem = true;
      var el$ = $(el);
      var changed = function () { el$.trigger("change"); };
      if (spec.kind === "popupLov") {
        var map = {};
        spec.lov.forEach(function (entry) { map[entry.r] = entry.d; });
        var value$ = $(esc(spec.id + "_value")), display$ = $(esc(spec.id + "_display"));
        var choose = function () {
          var body$ = $("<div class='a-PopupLOV-dialog apex-local-popupLov'><input type='search' class='a-PopupLOV-search apex-item-text' placeholder='Search' aria-label='Search'><ul class='a-PopupLOV-results apex-local-columnList' role='listbox'></ul></div>");
          var render = function () {
            var needle = body$.find("input").val().toLowerCase();
            body$.find("ul").html(spec.lov.filter(function (e) { return !needle || e.d.toLowerCase().indexOf(needle) >= 0; }).slice(0, 200).map(function (e) {
              return "<li><button type='button' class='a-Button a-Button--noUI apex-local-lovPick' data-r='" + html(e.r) + "'>" + html(e.d) + "</button></li>";
            }).join("") || "<li>No results</li>");
          };
          body$.on("input", "input", render);
          body$.on("click", ".apex-local-lovPick", function () {
            var r = this.getAttribute("data-r");
            apex.item(spec.id).setValue(r, map[r]);
            changed();
            body$.dialog("close");
          });
          render();
          body$.dialog({ title: spec.title, modal: true, width: 420, dialogClass: "ui-dialog--apex ui-dialog--popuplov", close: function () { body$.dialog("destroy").remove(); display$.trigger("focus"); } });
          body$.find("input").trigger("focus");
        };
        el$.on("click", "button", choose);
        display$.on("keydown", function (event) { if (event.key === "Enter" || event.key === "ArrowDown") { event.preventDefault(); choose(); } });
        apex.item.create(spec.id, {
          getValue: function () { return value$.val(); },
          setValue: function (value, display) { value$.val(value === null || value === undefined ? "" : value); display$.val(display !== undefined && display !== null ? display : (map[value] !== undefined ? map[value] : (value || ""))); },
          displayValueFor: function (value) { return map[value] !== undefined ? map[value] : (value === null || value === undefined ? "" : value); },
          setFocusTo: display$
        });
      } else if (spec.kind === "checkbox" || spec.kind === "switch") {
        var input$ = $(esc(spec.id + "_input"));
        input$.on("change", function (event) { event.stopPropagation(); changed(); });
        apex.item.create(spec.id, {
          getValue: function () { return input$.prop("checked") ? spec.on : spec.off; },
          setValue: function (value) { input$.prop("checked", value === spec.on); },
          displayValueFor: function (value) {
            var on = value === spec.on;
            return "<span class='apex-local-check" + (on ? " is-checked" : "") + "' role='img' aria-label='" + html(on ? spec.onLabel : spec.offLabel) + "'><span class='fa " + (on ? "fa-check-square-o" : "fa-square-o") + "' aria-hidden='true'></span></span>";
          },
          setFocusTo: input$
        });
      } else if (spec.kind === "stars") {
        var current = "";
        var paint = function () { el$.find(".apex-local-ig-star").each(function () { $(this).toggleClass("is-active", Number(this.getAttribute("data-value")) <= Number(current || 0)); }); };
        el$.on("click", "button", function () { current = this.getAttribute("data-value"); paint(); changed(); });
        apex.item.create(spec.id, {
          getValue: function () { return current; },
          setValue: function (value) { current = value === null || value === undefined ? "" : String(value); paint(); },
          displayValueFor: function (value) {
            var count = Math.max(0, Math.min(spec.max, Math.round(Number(value) || 0))), out = "";
            for (var i = 1; i <= spec.max; i += 1) out += "<span class='fa fa-star" + (i <= count ? " is-active" : "") + "' aria-hidden='true'></span>";
            return "<span class='apex-local-stars' role='img' aria-label='" + count + " of " + spec.max + "'>" + out + "</span>";
          },
          setFocusTo: function () { return el$.find("button").first(); }
        });
      } else if (spec.kind === "date") {
        var original = "";
        var toInput = function (value) { value = value ? String(value).replace(" ", "T") : ""; return spec.time ? value.slice(0, 16) : value.slice(0, 10); };
        apex.item.create(spec.id, {
          getValue: function () {
            var value = el$.val();
            if (value === toInput(original)) return original;
            return spec.time && value ? value.replace("T", " ") + ":00" : value;
          },
          setValue: function (value) { original = value === null || value === undefined ? "" : String(value); el$.val(toInput(original)); }
        });
      }
    });
  }

  function addRow(ig, after) {
    var model = apex.model.get(ig.cfg.modelName);
    ig.grid$.grid("setEditMode", true);
    var id = model.insertNewRecord(null, after || null);
    apex.model.release(ig.cfg.modelName);
    var record = model.getRecord(id);
    if (record) ig.grid$.grid("setSelectedRecords", [record], true);
    ig.toolbar$ && ig.toolbar$.toolbar("refresh");
  }

  function duplicateRow(ig, record) {
    if (!record) return;
    var model = apex.model.get(ig.cfg.modelName);
    model.copyRecords([record], null, record);
    apex.model.release(ig.cfg.modelName);
  }

  function buildToolbar(ig) {
    var cfg = ig.cfg, region = cfg.region;
    var toolbar$ = $(esc(region + "_ig_toolbar"));
    if (!cfg.toolbar) { ig.root$.addClass("a-IG--noToolbar"); return; }
    var context = apex.actions.createContext("apexLocalGrid", ig.root$[0]);
    ig.actions = context;
    var searchColumn = "";
    var editMode = false;
    context.add([
      { name: "search", label: "Go", action: function () {
        var text = toolbar$.find("input[type=search]").val();
        if (text) gridAct(ig, { action: "search", text: text, column: searchColumn });
      } },
      { name: "change-search-column", label: "Columns to search", get: function () { return searchColumn; },
        set: function (value) {
          searchColumn = value;
          var column = cfg.searchColumns.filter(function (c) { return c.name === value; })[0];
          toolbar$.find("input[type=search]").attr("placeholder", column ? "Search: " + column.label : "Search: All Text Columns");
        },
        choices: [{ label: "All Text Columns", value: "" }].concat(cfg.searchColumns.map(function (c) { return { label: c.label, value: c.name }; })) },
      { name: "edit", label: "Edit", get: function () { return editMode; },
        set: function (value) { editMode = value; ig.grid$.grid("setEditMode", value); } },
      { name: "save", label: "Save", action: function () { ig.grid$.grid("finishEditing").then(function () { saveGrid(ig); }); } },
      { name: "selection-add-row", label: cfg.addLabel, action: function () { addRow(ig, null); } },
      { name: "reset-report", label: "Reset", icon: "icon-ig-reset", action: function () { confirmReset(cfg); } }
    ]);
    var has = function (name) { return cfg.controls.indexOf(name) >= 0; };
    var actionsItems = [
      { type: "action", label: "Columns", icon: "icon-ig-select-cols", action: function () { columnsDialog(gridReportConfig(ig)); } },
      { type: "action", label: "Filter", icon: "icon-ig-filter", action: function () { filterDialog(gridReportConfig(ig)); } },
      { type: "subMenu", label: "Data", icon: "icon-ig-data", menu: { items: [
        { type: "action", label: "Sort", icon: "icon-ig-sort", action: function () { sortDialog(gridReportConfig(ig)); } },
        { type: "action", label: "Aggregate", icon: "icon-ig-aggregate", action: function () { aggregateDialog(gridReportConfig(ig)); } },
        { type: "action", label: "Refresh", icon: "icon-ig-refresh", action: function () { refreshGrid(region); } }] } },
      { type: "subMenu", label: "Format", icon: "icon-ig-format", menu: { items: [
        { type: "action", label: "Control Break", icon: "icon-ig-control-break", action: function () { controlBreakDialog(gridReportConfig(ig)); } },
        { type: "action", label: "Highlight", icon: "icon-ig-highlight", action: function () { highlightDialog(gridReportConfig(ig)); } },
        { type: "subMenu", label: "Rows Per Page", icon: "icon-ig-rows", menu: { items: [{ type: "radioGroup",
          get: function () { return String(cfg.rowsPerPage || 50); },
          set: function (value) { gridAct(ig, { action: "rowsPerPage", value: Number(value) }); },
          choices: [5, 10, 15, 20, 50, 100, 200, 500, 1000].map(function (n) { return { label: String(n), value: String(n) }; }) }] }, disabled: cfg.pagination !== "page" }] } },
      { type: "separator" },
      { type: "subMenu", label: "Report", icon: "icon-ig-report", menu: { items: [
        { type: "action", label: "Reset", icon: "icon-ig-reset", action: function () { confirmReset(cfg); } }] } },
      { type: "action", label: "Download", icon: "icon-ig-download", action: function () { downloadDialog(gridReportConfig(ig)); } }
    ];
    var data = [];
    var searchControls = [];
    if (has("searchCol")) searchControls.push({ type: "MENU", id: "column_search_menu", icon: "icon-search", iconOnly: true, label: "Columns to search",
      menu: { items: [{ type: "radioGroup", action: "change-search-column" }] } });
    if (has("searchField")) {
      searchControls.push({ type: "TEXT", id: "search_field", isSearch: true, placeholder: "Search: All Text Columns", label: "Search", enterAction: "search" });
      searchControls.push({ type: "BUTTON", action: "search", label: "Go" });
    }
    if (searchControls.length) data.push({ id: "search", align: "start", groupTogether: true, controls: searchControls });
    var startControls = [];
    if (has("actionsMenu")) startControls.push({ type: "MENU", id: "actions_button", label: "Actions", menu: { items: actionsItems } });
    if (startControls.length) data.push({ id: "actions1", align: "start", controls: startControls });
    var endControls = [];
    if (has("resetButton")) endControls.push({ type: "BUTTON", action: "reset-report", iconOnly: true });
    if (cfg.editable) {
      endControls.push({ type: "TOGGLE", action: "edit" });
      endControls.push({ type: "BUTTON", action: "save" });
      if (cfg.allowed.add) endControls.push({ type: "BUTTON", action: "selection-add-row", hot: true });
    }
    if (endControls.length) data.push({ id: "actions4", align: "end", controls: endControls });
    toolbar$.toolbar({ actionsContext: context, data: data, idPrefix: region + "_ig_toolbar" });
    ig.toolbar$ = toolbar$;
  }

  function buildControls(ig) {
    var cfg = ig.cfg;
    var controls$ = $(esc(cfg.region + "_ig_controls"));
    var extra = [];
    (cfg.views && cfg.views.breaks || []).forEach(function (b, i) {
      var c = cfg.columns[b.column];
      extra.push({ kind: "breaks", index: i, label: "Control Break: " + (c ? c.label : b.column), icon: "icon-ig-control-break", enabled: b.enabled !== false });
    });
    (cfg.views && cfg.views.highlights || []).forEach(function (h, i) {
      extra.push({ kind: "highlights", index: i, label: h.name, icon: "icon-ig-highlight", enabled: h.enabled !== false, swatch: h.background });
    });
    if (!cfg.filters.length && !extra.length) { controls$.empty(); return; }
    controls$.html("<ul class='a-IG-controls' role='group' aria-label='Report Settings'>" + cfg.filters.map(function (filter, index) {
      var checkbox = cfg.region + "_ig_control_" + index;
      return "<li class='a-IG-controls-item a-IG-controls-item--" + (filter.row ? "search" : "filter") + "'>" +
        "<span class='a-IG-controls-cell'><input type='checkbox' class='a-IG-controlsCheckbox' id='" + html(checkbox) + "' data-index='" + index + "'" + (filter.enabled ? " checked" : "") + " aria-label='" + html(filter.label) + "'><label class='a-IG-controlsCheckboxLabel' for='" + html(checkbox) + "'></label></span>" +
        "<span class='a-IG-controls-cell'><span class='a-IG-controlsIcon a-Icon icon-ig-" + (filter.row ? "search" : "filter") + "' aria-hidden='true'></span></span>" +
        "<span class='a-IG-controls-cell a-IG-controls-cell--label'><span class='a-IG-controlsLabel'><span>" + html(filter.label) + "</span></span></span>" +
        "<span class='a-IG-controls-cell a-IG-controls-cell--remove'><button type='button' class='a-Button a-IG-button a-IG-button--remove' data-index='" + index + "' title='Remove' aria-label='Remove'><span class='a-Icon icon-remove' aria-hidden='true'></span></button></span></li>";
    }).join("") + extra.map(function (chip) {
      var target = chip.kind + ":" + chip.index, checkbox = cfg.region + "_ig_" + chip.kind + "_" + chip.index;
      return "<li class='a-IG-controls-item a-IG-controls-item--" + (chip.kind === "breaks" ? "controlBreak" : "highlight") + "'>" +
        "<span class='a-IG-controls-cell'><input type='checkbox' class='a-IG-controlsCheckbox apex-local-chip' id='" + html(checkbox) + "' data-apex-local-ir-chip-toggle='" + target + "'" + (chip.enabled ? " checked" : "") + " aria-label='" + html(chip.label) + "'><label class='a-IG-controlsCheckboxLabel' for='" + html(checkbox) + "'></label></span>" +
        "<span class='a-IG-controls-cell'><span class='a-IG-controlsIcon a-Icon " + chip.icon + "' aria-hidden='true'></span></span>" +
        "<span class='a-IG-controls-cell a-IG-controls-cell--label'><span class='a-IG-controlsLabel' role='button' tabindex='0' data-apex-local-ir-chip-edit='" + target + "'>" + (chip.swatch ? "<span class='apex-local-swatch' style='background:" + html(chip.swatch) + "'></span>" : "") + "<span>" + html(chip.label) + "</span></span></span>" +
        "<span class='a-IG-controls-cell a-IG-controls-cell--remove'><button type='button' class='a-Button a-IG-button a-IG-button--remove apex-local-chip' data-apex-local-ir-chip-remove='" + target + "' title='Remove' aria-label='Remove'><span class='a-Icon icon-remove' aria-hidden='true'></span></button></span></li>";
    }).join("") + "</ul>");
    controls$.on("click", ".a-IG-controlsCheckbox:not(.apex-local-chip)", function () { gridAct(ig, { action: "toggleFilter", index: Number(this.getAttribute("data-index")), enabled: this.checked }); });
    controls$.on("click", ".a-IG-button--remove:not(.apex-local-chip)", function () { gridAct(ig, { action: "removeFilter", index: Number(this.getAttribute("data-index")) }); });
  }

  /** Shape the grid columns like an interactive report config so the shared dialogs work. */
  function gridReportConfig(ig) {
    var cfg = ig.cfg;
    var columns = Object.keys(cfg.columns).filter(function (name) { return !/^APEX\$/.test(name); })
      .map(function (name) { var c = cfg.columns[name]; return { name: name, label: c.label || name, shown: !c.hidden || !!c.controlBreakIndex, seq: c.seq, sort: c.canSort !== false, filter: true, hide: c.canHide !== false }; })
      .filter(function (c) { return c.shown || c.hide; })
      .sort(function (a, b) { return a.seq - b.seq; });
    var sort = Object.keys(cfg.columns).filter(function (name) { return cfg.columns[name].sortDirection; })
      .sort(function (a, b) { return cfg.columns[a].sortIndex - cfg.columns[b].sortIndex; })
      .map(function (name) { return { column: name, direction: cfg.columns[name].sortDirection }; });
    return { region: cfg.region, columns: columns, sort: sort, formats: cfg.formats, views: cfg.views, menu: {}, act: function (body) { return gridAct(ig, body); } };
  }

  // Grid changes are staged before a page submit and applied by the
  // Interactive Grid - Automatic Row Processing (DML) process.
  $(document).on("apexbeforepagesubmit", function () {
    Object.keys(grids).forEach(function (region) {
      var changes = gridChanges(grids[region]);
      if (!changes.length) return;
      var request = new XMLHttpRequest();
      request.open("POST", route("ig-stage"), false);
      request.setRequestHeader("content-type", "application/json");
      request.send(JSON.stringify({ page: apex.env.APP_PAGE_ID, region: region, changes: changes }));
    });
  });

  $(document).on("apexbeforerefresh", function (event) {
    var root = $(event.target).find("[data-apex-local-ig]").addBack("[data-apex-local-ig]");
    root.each(function () { destroyGrid(this.getAttribute("data-apex-local-ig")); });
    closeSortWidget();
  });

  function init() {
    $("[data-apex-local-ir]").each(function () { initIr(this); });
    $("[data-apex-local-ir-chart]").each(function () { sizeIrChart(this); });
    $("[data-apex-local-ig]").each(function () {
      try { initGrid(this); } catch (error) { apex.debug.error("[apex-local] interactive grid", error); }
    });
  }

  $(document).on("apexafterrefresh", function () { init(); });

  return { init: init, paginate: paginate, download: download, act: act, grids: grids,
    openDialog: function (region, name) {
      var container = document.querySelector("[data-apex-local-ir]#" + apex.util.escapeCSS(region + "_ir"));
      if (container) openDialog(irConfig(container), name);
      else if (grids[region]) openDialog(gridReportConfig(grids[region]), name);
    }, save: function (region) { return saveGrid(grids[region]); } };
})(apex.jQuery);
`;
