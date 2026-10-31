/** Browser side of the structure module (appended to /__apex/runtime.js and runtime.css). */

export const STRUCTURE_MESSAGES: Record<string, string> = {
  'APEX.SEARCH.1_RESULT_FOUND': '1 result found',
  'APEX.SEARCH.N_RESULTS_FOUND': '%0 results found',
  'APEX.SEARCH.RESULTS_X_TO_Y': 'Results %0 - %1',
  'APEX.SEARCH.PAGINATION': 'Pagination',
  'APEX.GV.PREV_PAGE': 'Previous',
  'APEX.GV.NEXT_PAGE': 'Next',
  'APEX.GV.PAGE_RANGE': 'Current Page',
  'APEX.TREEVIEW.ARIA_LABEL': 'Tree',
};

export const STRUCTURE_CSS = String.raw`
.apex-local-search .a-ResultsItem-header{align-items:center}
.apex-local-search .a-ResultsItem-title{margin:0}
.apex-local-tree ul{list-style:none;margin:0;padding-left:16px}
.apex-local-tree > ul{padding-left:0}
.apex-local-tree:not(.ui-widget) .a-TreeView-content{display:flex;gap:6px;align-items:center;padding:2px 0}
.apex-local-rwd--stripes .t-Report-report tbody tr:nth-child(even) td{background-color:rgba(0,0,0,.025)}
.apex-local-rwd--stroke .t-Report-report td{border-bottom:1px solid rgba(0,0,0,.08)}
@media (max-width:640px){
  .apex-local-reflow .t-Report-report thead{display:none}
  .apex-local-reflow .t-Report-wrap,.apex-local-reflow .t-Report-tableWrap,.apex-local-reflow .t-Report{width:100%}
  .apex-local-reflow .t-Report-report td{text-align:start!important}
  .apex-local-reflow .t-Report-report,.apex-local-reflow .t-Report-report tbody,.apex-local-reflow .t-Report-report tr,.apex-local-reflow .t-Report-report td{display:block;width:100%}
  .apex-local-reflow .t-Report-report tr{padding:6px 0;border-bottom:1px solid rgba(0,0,0,.1)}
  .apex-local-reflow .t-Report-report td[data-label]::before{content:attr(data-label);display:inline-block;min-width:40%;font-weight:600;padding-right:8px}
}
.apex-local-coltoggle-bar{position:relative;display:flex;justify-content:flex-end;padding:4px 0}
.apex-local-coltoggle-menu{position:absolute;right:0;top:100%;z-index:100;background:var(--ut-component-background-color,#fff);border:1px solid rgba(0,0,0,.15);border-radius:4px;padding:6px 10px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.apex-local-coltoggle-choice{display:block;white-space:nowrap;padding:2px 0}
.apex-local-coltoggle [data-priority]{display:none}
@media (min-width:20em){.apex-local-coltoggle [data-priority="1"]{display:table-cell}}
@media (min-width:30em){.apex-local-coltoggle [data-priority="2"]{display:table-cell}}
@media (min-width:40em){.apex-local-coltoggle [data-priority="3"]{display:table-cell}}
@media (min-width:50em){.apex-local-coltoggle [data-priority="4"]{display:table-cell}}
@media (min-width:60em){.apex-local-coltoggle [data-priority="5"]{display:table-cell}}
@media (min-width:70em){.apex-local-coltoggle [data-priority="6"]{display:table-cell}}
.apex-local-coltoggle .apex-local-col-shown{display:table-cell!important}
.apex-local-coltoggle .apex-local-col-hidden{display:none!important}
.apex-local-tabform .t-Report-cell input[type=text],.apex-local-tabform .t-Report-cell select,.apex-local-tabform .t-Report-cell textarea{width:100%;min-width:6em;box-sizing:border-box;padding:4px 6px;border:1px solid rgba(0,0,0,.2);border-radius:3px;font:inherit;background:var(--ut-field-background-color,#fff)}
`;

export const STRUCTURE_JS = String.raw`
(function ($) {
  "use strict";
  var base = location.pathname.replace(/\/[^/]*$/, "");

  function itemValues(pageItems) {
    var values = {};
    var names = typeof pageItems === "string" ? pageItems.split(",")
      : Array.isArray(pageItems) ? pageItems
      : pageItems && pageItems.jquery ? pageItems.toArray().map(function (el) { return el.id; }) : [];
    names.forEach(function (name) {
      name = String(name).trim().replace(/^#/, "");
      if (name && document.getElementById(name)) values[name] = apex.item(name).getValue();
    });
    return values;
  }

  // Tree refresh and search requests use apex.server.plugin; "apexlocal:" identifiers are answered locally.
  var plugin = apex.server.plugin;
  apex.server.plugin = function (identifier, data, options) {
    var match = /^apexlocal:(tree|search):(.+)$/.exec(typeof identifier === "string" ? identifier : "");
    if (!match) return plugin.apply(this, arguments);
    data = data || {}; options = options || {};
    return $.ajax({
      url: base + "/__apex/x/" + match[1] + "?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) + "&region=" + encodeURIComponent(match[2]),
      type: "POST", contentType: "application/json", dataType: "json",
      data: JSON.stringify({ items: itemValues(data.pageItems), x02: data.x02 }),
      success: options.success, error: options.error
    });
  };

  function initTree(el) {
    var config = JSON.parse(el.getAttribute("data-apex-local-tree") || "{}");
    if (!$.apex || !$.apex.treeView || !apex.widget || !apex.widget.tree) return;
    var expanded = config.expanded || [];
    $(el).empty();
    if (apex.region.isRegion && apex.region.isRegion(config.region)) apex.region.destroy(config.region);
    apex.widget.tree.init(el.id, config.data, true, {
      regionStaticId: config.region,
      ajaxIdentifier: "apexlocal:tree:" + config.region,
      lazyLoading: false,
      showRoot: config.showRoot,
      expandRoot: true,
      iconType: config.iconType,
      defaultIcon: config.defaultIcon,
      initialSelectedNodeId: config.selected,
      nodeHasTooltip: config.tooltip,
      doubleClick: config.doubleClick ? "activate" : false,
      makeNodeAdapter: function (data, types, hasIdentity) {
        return $.apex.treeView.makeDefaultNodeAdapter(data, types, hasIdentity, expanded);
      }
    });
  }

  function treeAction(method) {
    return function (action, event, trigger, helpers) {
      var targets = action.selector ? helpers.elements(action.selector, trigger) : $(document.body);
      targets.find(".a-TreeView").addBack(".a-TreeView").each(function () {
        if ($(this).is(":data('apex-treeView')")) $(this).treeView(method);
        else $(this).find("li ul").toggle(method === "expandAll");
      });
    };
  }
  apexLocal.registerAction("expandTree", treeAction("expandAll"));
  apexLocal.registerAction("collapseTree", treeAction("collapseAll"));

  function initSearch(el) {
    var c = JSON.parse(el.getAttribute("data-apex-local-search") || "{}");
    if (!$.apex || !$.apex.search || !c.item || !document.getElementById(c.item)) return;
    $(el).search({
      regionDomId: c.region,
      regionId: c.region,
      ajaxIdentifier: "apexlocal:search:" + c.region,
      externalPageItem: c.item,
      itemsToSubmit: "#" + c.item,
      lazyLoading: true,
      ajaxFetchWhenNoQuery: !!c.initial,
      searchAsYouType: c.searchAsYouType !== false,
      minCharacters: c.minChars || 0,
      resultsPerPage: c.resultsPerPage,
      showResultCount: !!c.showResultCount,
      resultCountSelector: c.resultCountSelector,
      noQueryEnteredMessage: c.noQueryEnteredMessage,
      overrideNoDataFoundMessage: c.noResultsFoundMessage
    });
  }

  // Tabular forms: rows are serialized into the region's hidden page item before the page is submitted.
  $(document).on("apexbeforepagesubmit", function () {
    $(".apex-local-tabform").each(function () {
      var rows = [];
      $(this).find("tr[data-tabform-row]").each(function () {
        var tr = $(this), values = {}, changed = false;
        tr.find("[data-tabform-col]").each(function () {
          var value = this.type === "checkbox" ? (this.checked ? this.value : (this.getAttribute("data-unchecked") || "")) : $(this).val();
          values[this.getAttribute("data-tabform-col")] = value;
          if (String(value) !== String(this.getAttribute("data-orig") || "")) changed = true;
        });
        rows.push({ key: tr.attr("data-tabform-key") || "", selected: tr.find("[data-tabform-select]").prop("checked") === true, changed: changed, values: values });
      });
      $("#" + apex.util.escapeCSS(this.getAttribute("data-item"))).val(JSON.stringify(rows));
    });
  });
  $(document).on("change", "[data-tabform-select-all]", function () {
    $(this).closest("table").find("[data-tabform-select]").prop("checked", this.checked);
  });

  // Column toggle reports: the column chooser shows or hides cells by column name.
  $(document).on("click", ".apex-local-coltoggle-button", function () {
    var menu = $(this).next(".apex-local-coltoggle-menu");
    var open = menu.prop("hidden");
    menu.prop("hidden", !open);
    $(this).attr("aria-expanded", open ? "true" : "false");
  });
  $(document).on("change", "[data-apex-local-coltoggle]", function () {
    var cells = $(this).closest(".apex-local-coltoggle").find("[data-col='" + this.value.replace(/'/g, "") + "']");
    cells.toggleClass("apex-local-col-hidden", !this.checked).toggleClass("apex-local-col-shown", this.checked);
  });

  function scan(root) {
    $(root).find(".apex-local-tree[data-apex-local-tree]").addBack(".apex-local-tree[data-apex-local-tree]").each(function () {
      if (this.__apexLocalTree) return;
      this.__apexLocalTree = true;
      initTree(this);
    });
    $(root).find(".apex-local-search[data-apex-local-search]").addBack(".apex-local-search[data-apex-local-search]").each(function () {
      if (this.__apexLocalSearch) return;
      this.__apexLocalSearch = true;
      initSearch(this);
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
