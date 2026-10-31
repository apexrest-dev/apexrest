/** Browser side of the items module, appended to /__apex/runtime.js after the base runtime. */
export const ITEMS_CLIENT = String.raw`
(function ($) {
  "use strict";
  var base = location.pathname.replace(/\/[^/]*$/, "");

  // English UI texts the item widgets look up (APEX serves them from its message catalog).
  apex.lang.addMessages(${JSON.stringify({
    'APEX.DATEPICKER.CLEAR': 'Clear',
    'APEX.DATEPICKER.DONE': 'Done',
    'APEX.DATEPICKER.TODAY': 'Today',
    'APEX.DATEPICKER.NEXT_MONTH': 'Next Month',
    'APEX.DATEPICKER.PREVIOUS_MONTH': 'Previous Month',
    'APEX.DATEPICKER.MONTH': 'Month',
    'APEX.DATEPICKER.YEAR': 'Year',
    'APEX.DATEPICKER.HOUR': 'Hour',
    'APEX.DATEPICKER.MINUTES': 'Minutes',
    'APEX.DATEPICKER.AM_PM': 'AM/PM',
    'APEX.DATEPICKER.ACTIONS': 'Actions',
    'APEX.DATEPICKER.ISO_WEEK': 'Week',
    'APEX.DATEPICKER.ISO_WEEK_ABBR': 'Wk',
    'APEX.DATEPICKER.SELECT_DATE': 'Select Date',
    'APEX.DATEPICKER.SELECT_DATE_AND_TIME': 'Select Date and Time',
    'APEX.DATEPICKER.SELECT_DAY': 'Select Day',
    'APEX.DATEPICKER.SELECT_MONTH_AND_YEAR': 'Select Month and Year',
    'APEX.DATEPICKER.SELECT_TIME': 'Select Time',
    'APEX.DATEPICKER.ICON_TEXT': 'Calendar for %0',
    'APEX.DATEPICKER.POPUP': 'Calendar popup for %0',
    'APEX.DATEPICKER.VALUE_INVALID': '#LABEL# is not a valid date, for example %0.',
    'APEX.DATEPICKER.VALUE_MUST_BE_BETWEEN': '#LABEL# must be between %0 and %1.',
    'APEX.DATEPICKER.VALUE_MUST_BE_ON_OR_AFTER': '#LABEL# must be %0 or later.',
    'APEX.DATEPICKER.VALUE_MUST_BE_ON_OR_BEFORE': '#LABEL# must be %0 or earlier.',
    'APEX.POPUP_LOV.TITLE': 'Search',
    'APEX.POPUP_LOV.NO_RESULTS': 'No results.',
    'APEX.POPUP_LOV.INITIAL_FILTER_REQ': 'Type to search.',
    'APEX.POPUP_LOV.FILTER_REQ': 'Type at least %0 characters to search.',
    'APEX.POPUP_LOV.REMOVE_VALUE': 'Remove %0',
    'APEX.POPUP_LOV.VALUE_ADDED': 'Added %0',
    'APEX.POPUP_LOV.GRID_ARIA_LABEL': 'Results',
    'APEX.POPUP.SEARCH': 'Search',
    'APEX.CS.NO_MATCHES': 'No matches',
    'APEX.CS.OTHERS_GROUP': 'Other',
    'APEX.CS.LOADING_DATA': 'Loading',
    'APEX.CS.MATCH_FOUND': '1 match',
    'APEX.CS.MATCHES_FOUND': '%0 matches',
    'APEX.CS.ACTIVE_VALUE_CHIP': '%0, Backspace removes it.',
    'APEX.CS.SELECTED_VALUES_COUNTER': '%0 selected',
    'APEX.COMBOBOX.LIST_OF_VALUES': 'List of values',
    'APEX.COMBOBOX.SHOW_ALL_VALUES': 'Show values for %0',
    'APEX.ITEM.CLEAR_BTN': 'Clear',
    'APEX.ITEM.HELP_TEXT': 'Help for %0',
    'APEX.ITEM.FILE.CHOOSE_FILE': 'Choose File',
    'APEX.ITEM.FILE.CHOOSE_FILES': 'Choose Files',
    'APEX.ITEM.FILE.DROP_FILE': 'Drop a file here',
    'APEX.ITEM.FILE.DROP_OR_CHOOSE_FILE': 'Choose a file or drop it here.',
    'APEX.ITEM.FILE.DROP_OR_SELECT_FILE': 'Choose a file or drop it here.',
    'APEX.ITEM.FILE.FILES_WITH_COUNT': '%0 files',
    'APEX.ITEM.FILE.MAX_FILE_SIZE': 'The file is larger than %0.',
    'APEX.ITEM.FILE.ACCEPTED_TYPES': 'Allowed file types: %0.',
    'APEX.ITEM.FILE.MULTIPLE_FILES_NOT_SUPPORTED': 'Only one file can be uploaded.',
    'APEX.ITEM.IMAGE_UPLOAD.CHOOSE_FILE': 'Choose Image',
    'APEX.ITEM.IMAGE_UPLOAD.CHOOSE_FILES': 'Choose Images',
    'APEX.ITEM.IMAGE_UPLOAD.DROP_FILE': 'Drop an image here',
    'APEX.ITEM.IMAGE_UPLOAD.DROP_FILES': 'Drop images here',
    'APEX.ITEM.IMAGE_UPLOAD.DROP_OR_CHOOSE_FILE': 'Choose an image or drop it here.',
    'APEX.ITEM.IMAGE_UPLOAD.DROP_OR_SELECT_FILE': 'Choose an image or drop it here.',
    'APEX.ITEM.IMAGE_UPLOAD.DROP_OR_CHOOSE_FILES': 'Choose images or drop them here.',
    'APEX.ITEM.IMAGE_UPLOAD.DROP_OR_SELECT_FILES': 'Choose images or drop them here.',
    'APEX.FILESIZE.BYTES': '%0 bytes',
    'APEX.FILESIZE.KB': '%0 KB',
    'APEX.FILESIZE.MB': '%0 MB',
    'APEX.FILESIZE.GB': '%0 GB',
    'APEX.ITEM_TYPE.CHECKBOX.CHECKED': 'Checked',
    'APEX.ITEM_TYPE.CHECKBOX.UNCHECKED': 'Unchecked',
    'APEX.PASSWORD.SHOW_PASSWORD': 'Show Password',
    'APEX.PASSWORD.HIDE_PASSWORD': 'Hide Password',
    'APEX.TEXTAREA.CHAR_COUNT': '%0 characters',
    'APEX.TEXTAREA.MAX_CHAR_COUNT': '%0 of %1 characters',
    'APEX.TEXTAREA.MAX_CHAR': 'Limit reached: %0 of %1 characters.',
    'APEX.NUMBER_FIELD.VALUE_NOT_BETWEEN_MIN_MAX': '#LABEL# must be between %0 and %1.',
    'APEX.NUMBER_FIELD.VALUE_LESS_MIN_VALUE': '#LABEL# must be at least %0.',
    'APEX.NUMBER_FIELD.VALUE_GREATER_MAX_VALUE': '#LABEL# must be at most %0.',
    'APEX.COLOR_PICKER.INVALID_COLOR': '#LABEL# is not a valid color, for example %0.',
    'APEX.COLOR_PICKER.OPEN': 'Open color picker',
    'APEX.COLOR_PICKER.TITLE': 'Pick a color',
    'APEX.COLOR_PICKER.CURRENT': 'Current',
    'APEX.COLOR_PICKER.INITIAL': 'Initial',
    'APEX.COLOR_PICKER.CONTRAST': 'Contrast',
    'APEX.COLOR_PICKER.MORE_PRESET_COLORS': 'More colors',
    'APEX.COLOR_PICKER.TOGGLE_TITLE': 'Switch color format',
    'APEX.MARKDOWN.BOLD': 'Bold',
    'APEX.MARKDOWN.ITALIC': 'Italic',
    'APEX.MARKDOWN.STRIKETHROUGH': 'Strikethrough',
    'APEX.MARKDOWN.INLINE_CODE': 'Code',
    'APEX.MARKDOWN.LIST': 'List',
    'APEX.MARKDOWN.UNORDERED_LIST': 'Bulleted List',
    'APEX.MARKDOWN.ORDERED_LIST': 'Numbered List',
    'APEX.MARKDOWN.LINK': 'Link',
    'APEX.MARKDOWN.INSERT_LINK': 'Insert Link',
    'APEX.MARKDOWN.IMAGE': 'Image',
    'APEX.MARKDOWN.INSERT_IMAGE': 'Insert Image',
    'APEX.MARKDOWN.PREVIEW': 'Preview',
    'APEX.TMV.SELECTOR_LABEL': 'Select',
    'APEX.GV.SELECTION_COUNT': '%0 selected',
    'APEX.GV.LOAD_MORE': 'Show More',
    'APEX.GV.LOAD_ALL': 'Show All',
    'APEX.GV.SORT_ASCENDING': 'Sort Ascending',
    'APEX.GV.SORT_DESCENDING': 'Sort Descending',
    'APEX.GV.SORT_OFF': 'No Sort',
    'APEX.GV.SORTED_ASCENDING': 'Sorted ascending %0',
    'APEX.GV.SORTED_DESCENDING': 'Sorted descending %0',
    PCT_GRAPH_ARIA_LABEL: 'Percent',
  })});

  // Item widgets talk to the server with apex.server.plugin (directly or through apex.model
  // region requests). Their ajax identifiers start with "LOCAL:", so those requests go to the
  // preview route instead of wwv_flow.ajax.
  $.ajaxPrefilter(function (options) {
    if (typeof options.url === "string" && /(^|\/)wwv_flow\.ajax/.test(options.url) &&
        typeof options.data === "string" &&
        /(^|&)p_request=PLUGIN%3DLOCAL%3A|%22ajaxIdentifier%22%3A%22LOCAL%3A/.test(options.data)) {
      options.url = base + "/__apex/x/items.ajax";
    }
  });

  // Item help comes from the APEXlang source through a preview route.
  if (apex.theme && apex.theme.popupFieldHelp) {
    var popupFieldHelp = apex.theme.popupFieldHelp;
    apex.theme.popupFieldHelp = function (itemId, sessionId, url) {
      if (typeof itemId === "string" && !url) {
        url = base + "/__apex/x/items.help?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) +
          "&p_item_id=" + encodeURIComponent(itemId);
      }
      return popupFieldHelp.call(this, itemId, sessionId, url);
    };
  }

  function autoHeight(area) {
    area.style.height = "auto";
    area.style.height = Math.max(area.scrollHeight + 2, 0) + "px";
  }
  $(document).on("input change", "textarea[data-auto-height]", function () { autoHeight(this); });
  $(function () { $("textarea[data-auto-height]").each(function () { autoHeight(this); }); });

  apexLocal.items = {
    richText: function (name) {
      var area = document.getElementById(name),
        editor = document.getElementById(name + "_EDITOR"),
        container$ = $(editor).closest(".apex-local-rte");
      if (!area || !editor) return;
      function sync(trigger) {
        area.value = editor.innerHTML === "<br>" ? "" : editor.innerHTML;
        if (trigger) $(area).trigger("change");
      }
      container$.on("mousedown", "[data-command]", function (event) { event.preventDefault(); });
      container$.on("click", "[data-command]", function () {
        var command = this.getAttribute("data-command"), argument = null;
        if (editor.getAttribute("contenteditable") !== "true") return;
        editor.focus();
        if (command === "createLink") {
          argument = window.prompt("URL", "https://");
          if (!argument) return;
        }
        document.execCommand(command, false, argument);
        sync(true);
      });
      $(editor).on("input", function () { sync(false); }).on("blur", function () { sync(true); })
        .on("focus", function () { container$.addClass("is-focused"); })
        .on("blur", function () { container$.removeClass("is-focused"); });
      apex.item.create(name, {
        item_type: "RICH_TEXT_EDITOR",
        getValue: function () { return area.value; },
        setValue: function (value) { area.value = value || ""; editor.innerHTML = value || ""; },
        isChanged: function () { return area.value !== area.defaultValue; },
        enable: function () { editor.setAttribute("contenteditable", "true"); container$.removeClass("is-disabled"); },
        disable: function () { editor.setAttribute("contenteditable", "false"); container$.addClass("is-disabled"); },
        isDisabled: function () { return editor.getAttribute("contenteditable") !== "true"; },
        setFocusTo: function () { return $(editor); },
        hasDisplayValue: function () { return true; }
      });
    }
  };
})(apex.jQuery);
`;

export const ITEMS_CSS = `
.apex-local-rte{display:flex;flex-direction:column;border:1px solid var(--a-field-input-border-color,rgba(0,0,0,.15));border-radius:var(--a-field-input-border-radius,2px);background:var(--a-field-input-background-color,#fff);width:100%}
.apex-local-rte.is-focused{border-color:var(--a-field-input-focus-border-color,#056ac8);box-shadow:var(--a-field-input-focus-box-shadow,none)}
.apex-local-rte.is-disabled{opacity:.6}
.apex-local-rte-toolbar{display:flex;flex-wrap:wrap;gap:2px;padding:4px;border-bottom:1px solid var(--a-field-input-border-color,rgba(0,0,0,.1));background:var(--a-toolbar-background-color,rgba(0,0,0,.025))}
.apex-local-rte-toolbar .a-Button{min-width:28px}
.apex-local-rte-content{padding:8px;overflow:auto;outline:none;font:inherit;line-height:1.5}
.apex-local-rte-content p{margin:0 0 .5em}
.t-Form-fieldContainer--floatingLabel .apex-local-rte{margin-top:20px}
textarea.apex-item-textarea--autoHeight{overflow:hidden;resize:none}
`;
