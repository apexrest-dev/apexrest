/**
 * Browser side of the faceted search simulation. The genuine `apex.facets` widget asks for counts
 * with `apex.server.plugin`; identifiers starting with `apexlocal:` are answered by the preview
 * route instead of `wwv_flow.ajax`. When facets change, the filtered region is refreshed after its
 * session state is stored.
 */

/** English UI texts the facets widget reads through apex.lang (keys as in APEX 26.2). */
export const FACET_MESSAGES: Record<string, string> = {
  'APEX.FS.ACTIONS_MENU_BUTTON_LABEL': 'Options',
  'APEX.FS.ACTIONS_MENU_FILTER': 'Filter',
  'APEX.FS.ACTIONS_MENU_HIDE': 'Hide Facet',
  'APEX.FS.ADD_FILTER': 'Add Filter',
  'APEX.FS.APPLIED_FACET': 'Applied Filter %0',
  'APEX.FS.APPLY': 'Apply',
  'APEX.FS.BATCH_APPLY': 'Apply',
  'APEX.FS.CANCEL': 'Cancel',
  'APEX.FS.CHART_BAR': 'Bar Chart',
  'APEX.FS.CHART_MENU': '%0 chart options',
  'APEX.FS.CHART_OTHERS': 'Others',
  'APEX.FS.CHART_PIE': 'Pie Chart',
  'APEX.FS.CHART_TITLE': 'Chart',
  'APEX.FS.CHART_UPDATED': 'Chart updated',
  'APEX.FS.CHART_VALUE_LABEL': 'Count',
  'APEX.FS.CLEAR': 'Clear',
  'APEX.FS.CLEAR_ALL': 'Clear All',
  'APEX.FS.CLEAR_VALUE': 'Clear %0',
  'APEX.FS.CONFIG_TITLE': 'Choose filters to show',
  'APEX.FS.COUNT_RESULTS': '%0 results',
  'APEX.FS.COUNT_SELECTED': '%0 selected',
  'APEX.FS.CUR_FILTERS_LM': 'Current filters',
  'APEX.FS.EXCLUDE': 'Exclude',
  'APEX.FS.EXCLUDED': 'Excluded',
  'APEX.FS.EXCLUDE_OFF': 'Exclude mode off',
  'APEX.FS.EXCLUDE_ON': 'Exclude mode on',
  'APEX.FS.EXCLUDING': '%0 (Excluding)',
  'APEX.FS.FACETS_LIST': 'Filters list',
  'APEX.FS.FILTER': 'Filter %0',
  'APEX.FS.FILTER_APPLIED': '%0 (Filter Applied)',
  'APEX.FS.GO': 'Go',
  'APEX.FS.INPUT_CURRENT_LABEL_C': 'contains %0',
  'APEX.FS.INPUT_CURRENT_LABEL_EQ': 'equals %0',
  'APEX.FS.INPUT_CURRENT_LABEL_GT': 'greater than %0',
  'APEX.FS.INPUT_CURRENT_LABEL_GTE': 'greater than or equal to %0',
  'APEX.FS.INPUT_CURRENT_LABEL_LT': 'less than %0',
  'APEX.FS.INPUT_CURRENT_LABEL_LTE': 'less than or equal to %0',
  'APEX.FS.INPUT_CURRENT_LABEL_NC': 'does not contain %0',
  'APEX.FS.INPUT_CURRENT_LABEL_NEQ': 'not equals %0',
  'APEX.FS.INPUT_CURRENT_LABEL_NSTARTS': 'does not start with %0',
  'APEX.FS.INPUT_CURRENT_LABEL_STARTS': 'starts with %0',
  'APEX.FS.INPUT_FACET_SELECTOR': 'Facet selection',
  'APEX.FS.INPUT_OPERATOR': 'Operator',
  'APEX.FS.INPUT_OPERATOR.C': 'contains',
  'APEX.FS.INPUT_OPERATOR.EQ': 'equals',
  'APEX.FS.INPUT_OPERATOR.GT': 'greater than',
  'APEX.FS.INPUT_OPERATOR.GTE': 'greater than or equal to',
  'APEX.FS.INPUT_OPERATOR.LT': 'less than',
  'APEX.FS.INPUT_OPERATOR.LTE': 'less than or equal to',
  'APEX.FS.INPUT_OPERATOR.NC': 'does not contain',
  'APEX.FS.INPUT_OPERATOR.NEQ': 'not equals',
  'APEX.FS.INPUT_OPERATOR.NSTARTS': 'does not start with',
  'APEX.FS.INPUT_OPERATOR.STARTS': 'starts with',
  'APEX.FS.INPUT_VALUE': 'Value',
  'APEX.FS.MAXIMIZE': 'Maximize',
  'APEX.FS.OPEN_CONFIG': 'More Filters',
  'APEX.FS.RANGE_BEGIN': 'Range begin',
  'APEX.FS.RANGE_CURRENT_LABEL': '%0 to %1',
  'APEX.FS.RANGE_CURRENT_LABEL_OPEN_HI': 'Above %0',
  'APEX.FS.RANGE_CURRENT_LABEL_OPEN_LO': 'Below %0',
  'APEX.FS.RANGE_END': 'Range end',
  'APEX.FS.RANGE_TEXT': 'to',
  'APEX.FS.REMOVE_CHART': 'Remove Chart',
  'APEX.FS.RESET': 'Reset',
  'APEX.FS.RESET_CHART': 'Reset',
  'APEX.FS.RESTORE': 'Restore',
  'APEX.FS.SEARCH_LABEL': 'Search',
  'APEX.FS.SEARCH_PLACEHOLDER': 'Search...',
  'APEX.FS.SELECT_PLACEHOLDER': '- Select -',
  'APEX.FS.SHOW_CHART': 'Show Chart',
  'APEX.FS.SHOW_LESS': 'Show Less',
  'APEX.FS.SHOW_MORE': 'Show All',
  'APEX.FS.SMART_FILTER': 'Smart Filter',
  'APEX.FS.STAR_RATING_LABEL': '%0 stars and up',
  'APEX.FS.SUGGESTIONS': 'Filter suggestions',
  'APEX.FS.TOGGLE_FILTERS': 'Toggle Filters',
  'APEX.FS.TOTAL_ROW_COUNT_LABEL': 'Total Row Count',
  'APEX.FS.VISUALLY_HIDDEN_HEADING': 'Visually hidden heading',
};

export const FACETS_CLIENT = String.raw`
(function ($) {
  "use strict";
  var base = location.pathname.replace(/\/[^/]*$/, "");
  apex.lang.addMessages(__MESSAGES__);

  function itemValues(names) {
    var values = {};
    (names || []).forEach(function (name) {
      name = String(name).replace(/^#/, "");
      if (name && document.getElementById(name)) values[name] = apex.item(name).getValue();
    });
    return values;
  }
  function post(region, body) {
    return $.ajax({
      url: base + "/__apex/x/facets?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) + "&region=" + encodeURIComponent(region),
      type: "POST", contentType: "application/json", dataType: "json", data: JSON.stringify(body)
    });
  }

  var plugin = apex.server.plugin;
  apex.server.plugin = function (identifier, data) {
    var match = /^apexlocal:facets:(.+)$/.exec(typeof identifier === "string" ? identifier : "");
    if (!match) return plugin.apply(this, arguments);
    data = data || {};
    return post(match[1], { items: itemValues(data.pageItems), x01: data.x01, x02: data.x02, x03: data.x03 });
  };

  function refresh(id) {
    var region = apex.region.isRegion && apex.region.isRegion(id) ? apex.region(id) : null;
    return region && region.refresh ? region.refresh() : window.apexLocal.refreshRegion(id);
  }
  // Region refresh that replaces only the rendered view (#<id><suffix>), keeping the region chrome,
  // its slot items (e.g. the cards order-by item) and its visibility (Region Display Selector).
  function refreshPart(id, suffix, pageNumber) {
    var region$ = $("#" + apex.util.escapeCSS(id));
    var url = base + "/__apex/region?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) + "&region=" + encodeURIComponent(id) + (pageNumber ? "&pg=" + pageNumber : "");
    region$.trigger("apexbeforerefresh");
    return fetch(url, { credentials: "same-origin" }).then(function (response) { return response.text(); }).then(function (html) {
      var selector = "#" + apex.util.escapeCSS(id + suffix);
      var next$ = $("<div></div>").html(html).find(selector);
      if (!next$.length || !$(selector).length) return window.apexLocal.refreshRegion(id);
      $(selector).replaceWith(next$);
      region$.trigger("apexafterrefresh");
    });
  }
  // widget.facets 26.2 calls isFiltered() for star rating lists after counts update, which that
  // control type does not implement; skip that show-more recalculation instead of failing.
  function patchWidget() {
    var proto = $.apex && $.apex.facets && $.apex.facets.prototype;
    if (!proto || proto._apexLocalPatched) return;
    var update = proto._updateDisplayedItems;
    proto._updateDisplayedItems = function () {
      try {
        return update.apply(this, arguments);
      } catch (error) {
        if (!(error instanceof TypeError) || String(error.message).indexOf("isFiltered") < 0) throw error;
      }
    };
    proto._apexLocalPatched = true;
  }

  window.apexLocalFacets = {
    patchWidget: patchWidget,
    partRegion: function (id, suffix, type) {
      if (apex.region.isRegion(id)) apex.region.destroy(id);
      apex.region.create(id, { type: type, refresh: function () { return refreshPart(id, suffix); } });
    },
    refreshPart: refreshPart
  };
  $(document).on("click", "[data-apex-local-cards-page]", function (event) {
    event.preventDefault();
    refreshPart(this.getAttribute("data-region"), "_cards", this.getAttribute("data-apex-local-cards-page"));
  });

  // The filtered region refreshes when the facets change (the genuine report regions listen the same way).
  $(document).on("facetschange", "[data-apex-local-filtered]", function () {
    var fs$ = $(this), target = fs$.attr("data-apex-local-filtered");
    var names = (fs$.attr("data-apex-local-items") || "").split(",");
    fs$.facets("lock");
    post(fs$.attr("data-apex-local-region"), { items: itemValues(names), x01: "STATE" })
      .then(function () { return refresh(target); })
      .always(function () { fs$.facets("unlock"); });
  });

  // Cards: changing the order-by item stores it and refreshes the region.
  $(document).on("change", "select, input", function () {
    var name = this.id;
    if (!name) return;
    $("[data-apex-local-orderby]").filter(function () { return this.getAttribute("data-apex-local-orderby") === name; }).each(function () {
      var region = this.getAttribute("data-region"), items = {};
      items[name] = apex.item(name).getValue();
      post(region, { items: items, x01: "ITEM" }).then(function () { return refresh(region); });
    });
  });

  // List View search bar.
  $(document).on("input", "[data-apex-local-listview]", function () {
    var needle = this.value.toLowerCase();
    $("#" + apex.util.escapeCSS(this.getAttribute("data-apex-local-listview")) + "_listview > li").each(function () {
      this.classList.toggle("u-hidden", !!needle && this.textContent.toLowerCase().indexOf(needle) < 0);
    });
  });
})(apex.jQuery);
`.replace('__MESSAGES__', JSON.stringify(FACET_MESSAGES));
