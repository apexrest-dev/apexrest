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
        var type = format === "html" ? "text/html" : "text/csv";
        var link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([file.content], { type: type + ";charset=utf-8" }));
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
      return "<li class='a-IRR-iconList-item'><label><input type='radio' name='apex_local_dl' value='" + format + "'" + (index === 0 ? " checked" : "") + "> <span class='a-Icon icon-irr-dl-" + (format === "csv" ? "xls" : format) + "' aria-hidden='true'></span> " + format.toUpperCase() + "</label></li>";
    }).join("") + "</ul></div>");
    dialog("Download", body$, [{ text: "Download", hot: true, click: function () {
      download(cfg.region, body$.find("input:checked").val());
    } }], "a-IRR-dialog--download");
  }

  function confirmReset(cfg) {
    apex.message.confirm("Restore report to the default settings?", function (ok) { if (ok) cfg.act({ action: "reset" }); });
  }

  // ------------------------------------------------------------- interactive report

  function irConfig(container) {
    var cfg = JSON.parse(container.getAttribute("data-apex-local-ir"));
    cfg.act = function (body) { return act(cfg.region, body); };
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
      if (cfg.menu.columns) items.push({ type: "action", label: "Columns", icon: "icon-irr-select-cols", action: function () { columnsDialog(cfg); } });
      if (cfg.menu.filter) items.push({ type: "action", label: "Filter", icon: "icon-irr-filter", action: function () { filterDialog(cfg); } });
      if (cfg.menu.rowsPerPage) items.push({ type: "subMenu", label: "Rows Per Page", icon: "icon-irr-rows", menu: { items: [{
        type: "radioGroup", get: function () { return String(cfg.rowsPerPage); },
        set: function (value) { cfg.act({ action: "rowsPerPage", value: Number(value) }); },
        choices: cfg.rowsPerPageOptions.map(function (n) { return { label: String(n), value: String(n) }; }).concat([{ label: "All", value: "-1" }])
      }] } });
      if (cfg.menu.sort) items.push({ type: "subMenu", label: "Data", icon: "icon-irr-format", menu: { items: [
        { type: "action", label: "Sort", icon: "icon-irr-sort", action: function () { sortDialog(cfg); } }] } });
      if (cfg.menu.reset || cfg.menu.download || cfg.menu.help) items.push({ type: "separator" });
      if (cfg.menu.reset) items.push({ type: "action", label: "Reset", icon: "icon-irr-reset", action: function () { confirmReset(cfg); } });
      if (cfg.menu.help) items.push({ type: "action", label: "Help", icon: "icon-irr-help", action: function () {
        apex.message.alert("Use the search bar to find rows, click a column heading to sort or filter it, and use Actions to choose columns, filter, sort, change rows per page, reset or download the report.");
      } });
      if (cfg.menu.download) items.push({ type: "action", label: "Download", icon: "icon-irr-download", action: function () { downloadDialog(cfg); } });
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
    apex.model.create(cfg.modelName, {
      shape: "table", recordIsArray: true, fields: cfg.fields, identityField: cfg.identity.length ? cfg.identity : undefined,
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
      currentRecord = grid$.grid("getRecords", $(this).closest("tr"))[0] || null;
    });

    buildToolbar(ig);
    buildControls(ig);
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
        { type: "action", label: "Refresh", icon: "icon-ig-refresh", action: function () { refreshGrid(region); } }] } },
      { type: "subMenu", label: "Format", icon: "icon-ig-format", menu: { items: [
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
    if (!cfg.filters.length) { controls$.empty(); return; }
    controls$.html("<ul class='a-IG-controls' role='group' aria-label='Report Settings'>" + cfg.filters.map(function (filter, index) {
      var checkbox = cfg.region + "_ig_control_" + index;
      return "<li class='a-IG-controls-item a-IG-controls-item--" + (filter.row ? "search" : "filter") + "'>" +
        "<span class='a-IG-controls-cell'><input type='checkbox' class='a-IG-controlsCheckbox' id='" + html(checkbox) + "' data-index='" + index + "'" + (filter.enabled ? " checked" : "") + " aria-label='" + html(filter.label) + "'><label class='a-IG-controlsCheckboxLabel' for='" + html(checkbox) + "'></label></span>" +
        "<span class='a-IG-controls-cell'><span class='a-IG-controlsIcon a-Icon icon-ig-" + (filter.row ? "search" : "filter") + "' aria-hidden='true'></span></span>" +
        "<span class='a-IG-controls-cell a-IG-controls-cell--label'><span class='a-IG-controlsLabel'><span>" + html(filter.label) + "</span></span></span>" +
        "<span class='a-IG-controls-cell a-IG-controls-cell--remove'><button type='button' class='a-Button a-IG-button a-IG-button--remove' data-index='" + index + "' title='Remove' aria-label='Remove'><span class='a-Icon icon-remove' aria-hidden='true'></span></button></span></li>";
    }).join("") + "</ul>");
    controls$.on("click", ".a-IG-controlsCheckbox", function () { gridAct(ig, { action: "toggleFilter", index: Number(this.getAttribute("data-index")), enabled: this.checked }); });
    controls$.on("click", ".a-IG-button--remove", function () { gridAct(ig, { action: "removeFilter", index: Number(this.getAttribute("data-index")) }); });
  }

  /** Shape the grid columns like an interactive report config so the shared dialogs work. */
  function gridReportConfig(ig) {
    var cfg = ig.cfg;
    var columns = Object.keys(cfg.columns).filter(function (name) { return !/^APEX\$/.test(name); })
      .map(function (name) { var c = cfg.columns[name]; return { name: name, label: c.label || name, shown: !c.hidden, seq: c.seq, sort: c.canSort !== false, filter: true, hide: c.canHide !== false }; })
      .filter(function (c) { return c.shown || c.hide; })
      .sort(function (a, b) { return a.seq - b.seq; });
    var sort = Object.keys(cfg.columns).filter(function (name) { return cfg.columns[name].sortDirection; })
      .sort(function (a, b) { return cfg.columns[a].sortIndex - cfg.columns[b].sortIndex; })
      .map(function (name) { return { column: name, direction: cfg.columns[name].sortDirection }; });
    return { region: cfg.region, columns: columns, sort: sort, formats: cfg.formats, act: function (body) { return gridAct(ig, body); } };
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
    $("[data-apex-local-ig]").each(function () {
      try { initGrid(this); } catch (error) { apex.debug.error("[apex-local] interactive grid", error); }
    });
  }

  $(document).on("apexafterrefresh", function () { init(); });

  return { init: init, paginate: paginate, download: download, act: act, grids: grids, save: function (region) { return saveGrid(grids[region]); } };
})(apex.jQuery);
`;
