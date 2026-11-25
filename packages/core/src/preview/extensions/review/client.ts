/**
 * Browser half of review mode: pick a component, write a comment or edit a property, numbered
 * pins, comment list. Property edits go to the shared digest-bound patch service (op: patch).
 */

export const REVIEW_CSS = `
.apex-local-badge.is-review{background:#7c4dff;color:#fff}
.apex-local-badge.is-review[hidden]{display:none}
.apex-local-review-hint{margin:8px 12px 0;font-size:12px;opacity:.75}
.apex-local-review-hint code{font-size:11px}
.apex-local-review-list{margin:6px 0 0;padding:0 12px;list-style:none;counter-reset:none}
.apex-local-review-list>li{display:grid;grid-template-columns:28px 1fr auto;gap:4px 8px;align-items:start;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.apex-local-review-list>li.is-resolved{opacity:.55}
.apex-local-review-list>li.is-resolved .apex-local-review-text{text-decoration:line-through}
.apex-local-review-num{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#7c4dff;color:#fff;font-size:11px;font-weight:700}
.apex-local-review-where{font-size:11px;opacity:.75}
.apex-local-review-where code{font-size:11px}
.apex-local-review-text{white-space:pre-wrap;word-break:break-word}
.apex-local-review-tools{display:flex;gap:4px}
.apex-local-review-tools button{padding:2px 6px;font-size:11px}
.apex-local-review-chip{display:inline-block;margin-inline-end:6px;padding:0 6px;border-radius:9px;background:rgba(124,77,255,.35);font-size:10px;text-transform:uppercase;letter-spacing:.04em}
html.apex-local-review-picking,html.apex-local-review-picking *{cursor:crosshair!important}
.apex-local-review-box{position:fixed;z-index:2147483000;pointer-events:none;border:2px solid #7c4dff;background:rgba(124,77,255,.10);border-radius:3px;box-sizing:border-box;transition:all .04s linear}
.apex-local-review-box>span{position:absolute;left:-2px;bottom:100%;max-width:60vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 6px;border-radius:3px 3px 0 0;background:#7c4dff;color:#fff;font:600 11px/16px system-ui,sans-serif}
.apex-local-review-box.is-below>span{bottom:auto;top:100%;border-radius:0 0 3px 3px}
.apex-local-review-pin{position:absolute;z-index:2147482990;display:flex;align-items:center;justify-content:center;width:22px;height:22px;margin:0;padding:0;border:2px solid #fff;border-radius:50% 50% 50% 0;background:#7c4dff;color:#fff;font:700 11px/1 system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer}
.apex-local-review-pin:hover,.apex-local-review-pin.is-focus{background:#5b2fd6;transform:scale(1.12)}
.apex-local-review-composer{position:fixed;z-index:2147483001;width:min(380px,calc(100vw - 24px));padding:12px;border-radius:8px;background:#1f1f24;color:#f2f2f2;box-shadow:0 12px 36px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.1);font:13px/1.4 system-ui,sans-serif}
.apex-local-review-composer h4{margin:0 0 8px;font-size:12px;font-weight:600;opacity:.85}
.apex-local-review-composer select,.apex-local-review-composer textarea{box-sizing:border-box;width:100%;margin:0 0 8px;padding:5px 7px;border:1px solid rgba(255,255,255,.22);border-radius:4px;background:rgba(0,0,0,.35);color:#fff;font:inherit}
.apex-local-review-composer textarea{min-height:86px;resize:vertical}
.apex-local-review-composer .apex-local-review-row{display:flex;gap:8px;justify-content:flex-end;align-items:center}
.apex-local-review-composer .apex-local-review-row span{flex:1;font-size:11px;opacity:.6}
.apex-local-review-composer .apex-local-review-error{margin:0 0 8px;color:#ff9b9b;font-size:12px}
.apex-local-review-modes{display:flex;gap:4px;margin:0 0 8px}
.apex-local-review-modes button{flex:1;padding:3px 6px;border:1px solid rgba(255,255,255,.22);border-radius:4px;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}
.apex-local-review-modes button.is-on{background:#7c4dff;border-color:#7c4dff}
.apex-local-review-composer input[name="value"]{box-sizing:border-box;width:100%;margin:0 0 8px;padding:5px 7px;border:1px solid rgba(255,255,255,.22);border-radius:4px;background:rgba(0,0,0,.35);color:#fff;font:inherit}
.apex-local-review-composer [data-mode-pane][hidden]{display:none}
.apex-local-review-composer .apex-local-review-ok{margin:0 0 8px;color:#9be7a8;font-size:12px}
.apex-local-review-batch{margin:4px 0 8px;padding-left:18px;font-size:12px}
.apex-local-review-batch li.is-error{color:#ffb4a8}
.apex-local-review-batch button{margin-left:6px;font-size:11px}
.apex-local-review-options{display:grid;gap:4px;max-height:180px;overflow:auto;margin:4px 0;font-size:12px}
.apex-local-review-options label{display:flex;gap:6px;align-items:center}
.apex-local-review-columns{width:100%;border-collapse:collapse;font-size:12px;margin:4px 0}
.apex-local-review-columns td{padding:2px 4px;border-bottom:1px solid rgba(255,255,255,.08)}
.apex-local-review-columns tr.is-error td{color:#ffb4a8}
.apex-local-review-columns input[type=text]{width:100%}
.apex-local-review-move{display:grid;grid-template-columns:auto 1fr;gap:4px 6px;align-items:center;font-size:12px;margin:4px 0}
.apex-local-review-drag{cursor:grab;user-select:none}
.apex-local-review-drop{outline:2px dashed #7c4dff !important;outline-offset:2px}
.apex-local-review-banner{position:fixed;z-index:2147483000;top:8px;left:50%;transform:translateX(-50%);padding:6px 12px;border-radius:16px;background:#7c4dff;color:#fff;font:600 12px/16px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3);pointer-events:none}
`;

export const REVIEW_JS = String.raw`
(function () {
  "use strict";
  var configNode = document.getElementById("apexLocalReviewConfig");
  var toolbar = document.getElementById("apexLocalToolbar");
  if (!configNode || !toolbar) return;
  var config;
  try { config = JSON.parse(configNode.textContent || "{}"); } catch (e) { return; }
  var base = location.pathname.replace(/\/[^/]*$/, "");
  var route = base + "/__apex/x/review";
  var KIND = { region: "Region", item: "Item", button: "Button", column: "Column", page: "Page", element: "Element" };
  var byKey = {}, columnsByRegion = {};
  (config.map || []).forEach(function (entry) {
    if (entry.kind === "column") {
      (columnsByRegion[entry.regionDom] = columnsByRegion[entry.regionDom] || []).push(entry);
    } else {
      entry.keys.forEach(function (key) { if (!byKey[key]) byKey[key] = entry; });
    }
  });
  var saving = false;
  var comments = [], picking = false, box = null, banner = null, composer = null, pins = [], hovered = null;
  var panel = toolbar.querySelector('.apex-local-panel[data-panel="review"]');
  var list = panel && panel.querySelector("[data-apex-local-review-list]");
  var badge = toolbar.querySelector("[data-apex-local-review-count]");

  function ours(node) {
    return !!(node && node.closest && node.closest("#apexLocalToolbar,.apex-local-review-composer,.apex-local-review-pin,.apex-local-review-box,.apex-local-viewport"));
  }
  function text(node) { return ((node && (node.innerText || node.textContent)) || "").replace(/\s+/g, " ").trim().slice(0, 200); }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function cssEscape(value) { return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/[^\w-]/g, "\\$&"); }

  /** A short, stable CSS selector: the nearest id, then tag:nth-of-type steps. */
  function selectorOf(node) {
    var steps = [];
    while (node && node.nodeType === 1 && node !== document.body && steps.length < 8) {
      if (node.id && !/^\d/.test(node.id)) { steps.unshift("#" + cssEscape(node.id)); return steps.join(" > "); }
      var tag = node.tagName.toLowerCase(), index = 1, sibling = node;
      while ((sibling = sibling.previousElementSibling)) if (sibling.tagName === node.tagName) index++;
      steps.unshift(tag + ":nth-of-type(" + index + ")");
      node = node.parentElement;
    }
    return steps.join(" > ");
  }

  function regionOf(node) {
    for (var current = node; current && current.nodeType === 1; current = current.parentElement) {
      var entry = current.id && byKey[current.id];
      if (entry && entry.kind === "region") return { entry: entry, node: current };
    }
    return null;
  }

  function columnOf(node, region) {
    var columns = region && columnsByRegion[region.entry.keys[0]];
    if (!columns) return null;
    for (var current = node; current && current !== region.node; current = current.parentElement) {
      var keys = [current.id].concat((current.getAttribute("headers") || "").split(/\s+/), [current.getAttribute("data-column") || ""]);
      for (var i = 0; i < columns.length; i++)
        for (var k = 0; k < keys.length; k++)
          if (keys[k] && columns[i].keys.indexOf(keys[k]) >= 0) {
            var header = document.getElementById(region.entry.keys[0] + "_" + columns[i].id) || document.getElementById(columns[i].id.toUpperCase());
            return { entry: columns[i], node: current, header: header };
          }
    }
    return null;
  }

  /** Candidate targets from the most specific (the element) to the page. */
  function candidates(node) {
    var result = [], region = regionOf(node);
    var column = columnOf(node, region);
    if (column) result.push({ kind: "column", entry: column.entry, node: column.node });
    for (var current = node; current && current.nodeType === 1; current = current.parentElement) {
      var entry = current.id && byKey[current.id];
      if (entry && entry.kind !== "region" && !result.some(function (c) { return c.entry === entry; })) result.push({ kind: entry.kind, entry: entry, node: current });
    }
    if (region) result.push({ kind: "region", entry: region.entry, node: region.node });
    // An enclosing region of a sub-region.
    var outer = region && regionOf(region.node.parentElement);
    while (outer) { result.push({ kind: "region", entry: outer.entry, node: outer.node }); outer = regionOf(outer.node.parentElement); }
    var mapped = result.length;
    // Columns of the selected region stay selectable when they are not rendered (no rows, hidden).
    if (region) (columnsByRegion[region.entry.keys[0]] || []).forEach(function (entry) {
      if (!result.some(function (c) { return c.entry === entry; })) result.push({ kind: "column", entry: entry, node: region.node });
    });
    result.splice(0, 0, { kind: "element", node: node });
    result.push({ kind: "page", node: document.body });
    return { list: result, preferred: mapped ? 1 : 0 };
  }

  function describe(candidate) {
    if (candidate.kind === "page") return "Page " + config.page + (config.pageName ? " · " + config.pageName : "");
    if (candidate.kind === "element") {
      var label = text(candidate.node);
      return "Element <" + candidate.node.tagName.toLowerCase() + ">" + (label ? " “" + label.slice(0, 60) + "”" : "");
    }
    var entry = candidate.entry;
    return KIND[candidate.kind] + " " + (entry.label && entry.label !== entry.id ? "“" + entry.label + "” (" + entry.id + ")" : entry.id);
  }

  function targetOf(candidate) {
    var region = regionOf(candidate.node);
    if (candidate.kind === "page") return { kind: "page", file: config.pageFile, line: config.pageLine, label: config.pageName };
    if (candidate.kind === "element") {
      var target = { kind: "element", selector: selectorOf(candidate.node), text: text(candidate.node) };
      if (region) { target.region = region.entry.id; target.file = region.entry.file; target.line = region.entry.line; }
      return target;
    }
    var entry = candidate.entry, result = { kind: candidate.kind, id: entry.id, label: entry.label, file: entry.file, line: entry.line, selector: selectorOf(candidate.node) };
    if (entry.region) result.region = entry.region;
    return result;
  }

  /** The mapped source component behind a candidate, with its patch target and current values. */
  function editableOf(candidate) {
    if (!candidate) return null;
    if (candidate.kind === "page") return { kind: "page", patch: "page", page: config.page, file: config.pageFile, values: config.pageValues || {} };
    var entry = candidate.entry;
    return entry && entry.patch ? { kind: entry.kind, patch: entry.patch, page: entry.page, file: entry.file, values: entry.values || {} } : null;
  }
  function editProperties(editable) { return editable ? (config.editable || {})[editable.kind] || [] : []; }

  // ------------------------------------------------------------- highlight
  function ensureBox() {
    if (!box) { box = document.createElement("div"); box.className = "apex-local-review-box"; box.appendChild(document.createElement("span")); document.body.appendChild(box); }
    return box;
  }
  function highlight(node, label) {
    if (!node) { if (box) box.hidden = true; return; }
    var rect = node.getBoundingClientRect(), el = ensureBox();
    el.hidden = false;
    el.style.left = rect.left - 2 + "px"; el.style.top = rect.top - 2 + "px";
    el.style.width = rect.width + 4 + "px"; el.style.height = rect.height + 4 + "px";
    el.classList.toggle("is-below", rect.top < 22);
    el.firstChild.textContent = label || "";
  }

  // ------------------------------------------------------------- picking
  function setPicking(on) {
    picking = on;
    document.documentElement.classList.toggle("apex-local-review-picking", on);
    if (on) {
      if (!banner) { banner = document.createElement("div"); banner.className = "apex-local-review-banner"; document.body.appendChild(banner); }
      banner.textContent = "Review: click a component to comment · Esc to stop";
      banner.hidden = false;
      panel && (panel.hidden = true);
    } else {
      if (banner) banner.hidden = true;
      highlight(null);
    }
    var button = toolbar.querySelector("[data-apex-local-review-pick]");
    if (button) button.textContent = on ? "Stop selecting" : "Select on page";
  }

  document.addEventListener("mousemove", function (event) {
    if (!picking || composer) return;
    var node = event.target;
    if (ours(node)) { highlight(null); return; }
    var found = candidates(node);
    hovered = found;
    var chosen = found.list[found.preferred];
    highlight(chosen.node, describe(chosen));
  }, true);

  ["mousedown", "mouseup", "click", "dblclick", "submit", "pointerdown"].forEach(function (type) {
    document.addEventListener(type, function (event) {
      if (!picking || composer || ours(event.target)) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      if (type === "click") openComposer(candidates(event.target));
    }, true);
  });

  document.addEventListener("keydown", function (event) {
    if (event.altKey && event.shiftKey && (event.key === "C" || event.key === "c" || event.code === "KeyC")) { event.preventDefault(); setPicking(!picking); return; }
    if (event.key === "Escape") { if (composer) closeComposer(); else if (picking) setPicking(false); }
  }, true);

  // ------------------------------------------------------------- composer
  function closeComposer() { if (composer) { composer.dispatchEvent(new Event("apex-local-close")); composer.remove(); } composer = null; saving = false; if (!picking) highlight(null); }

  function openComposer(found, existing) {
    closeComposer();
    var options = found ? found.list : [];
    var selected = found ? found.preferred : 0;
    composer = document.createElement("form");
    composer.className = "apex-local-review-composer";
    var intents = ['<option value="">Kind of change (optional)</option>'].concat((config.intents || []).map(function (intent) {
      return '<option value="' + esc(intent) + '"' + (existing && existing.intent === intent ? " selected" : "") + ">" + esc(intent) + "</option>";
    })).join("");
    composer.innerHTML = '<h4>' + (existing ? "Edit comment" : "Review") + "</h4>" +
      (existing ? '<p class="apex-local-review-where">' + esc(where(existing)) + "</p>" :
        '<select name="target" aria-label="Comment target">' + options.map(function (candidate, index) {
          return '<option value="' + index + '"' + (index === selected ? " selected" : "") + ">" + esc(describe(candidate)) + "</option>";
        }).join("") + "</select>") +
      (existing ? "" : '<div class="apex-local-review-modes"><button type="button" class="is-on" data-mode="comment">Comment</button><button type="button" data-mode="edit" title="Change a property in the source file">Edit</button></div>') +
      '<div data-mode-pane="comment"><select name="intent" aria-label="Kind of change">' + intents + "</select>" +
      '<textarea name="text" maxlength="4000" placeholder="What should change? e.g. Rename this column to “Amount, EUR” and move it after Status">' + esc(existing ? existing.text : "") + "</textarea></div>" +
      '<div data-mode-pane="edit" hidden><select name="property" aria-label="Property"></select><span data-value-control><input name="value" aria-label="New value" maxlength="4000"></span><p class="apex-local-review-where" data-edit-where></p>' +
      (config.layoutUnavailable ? '<p class="apex-local-review-where">' + esc(config.layoutUnavailable) + "</p>" : "") +
      '<button type="button" class="apex-local-action" data-batch-add title="Collect this change and pick another component or property">Add to changes</button>' +
      '<button type="button" class="apex-local-action" data-columns hidden title="Show, hide, rename, format and order this report\'s columns">Columns…</button>' +
      '<button type="button" class="apex-local-action" data-move-open hidden title="Move this component to another region or position">Move…</button>' +
      '<div data-move-form hidden><div class="apex-local-review-move"><span>To</span><select name="move-region" aria-label="Destination"></select><span>Slot</span><select name="move-slot" aria-label="Slot"></select>' +
      '<span>Sequence</span><input name="move-sequence" inputmode="numeric" aria-label="Sequence (optional)" placeholder="unchanged"></div>' +
      '<span class="apex-local-review-drag" draggable="true" data-move-drag title="Or drag onto a region on the page">⠿ Drag onto a region</span> <button type="button" class="apex-local-action" data-move-add>Add move</button></div>' +
      '<ol class="apex-local-review-batch" data-batch aria-label="Proposed changes"></ol><div data-column-editor hidden></div></div>' +
      '<p class="apex-local-review-error" hidden></p><p class="apex-local-review-ok" hidden></p>' +
      '<div class="apex-local-review-row"><span>Ctrl+Enter to save</span><button type="button" class="apex-local-action" data-cancel>Cancel</button><button type="submit" class="apex-local-action is-primary">Save</button></div>';
    document.body.appendChild(composer);
    var anchor = existing ? nodeFor(existing) : options[selected] && options[selected].node;
    place(anchor);
    var targetSelect = composer.querySelector('select[name="target"]');
    if (targetSelect) targetSelect.addEventListener("change", function () {
      var candidate = options[Number(targetSelect.value)];
      highlight(candidate.node, describe(candidate));
    });
    if (anchor && options[selected]) highlight(anchor, describe(options[selected]));
    var area = composer.querySelector("textarea");
    var mode = "comment";
    var propertySelect = composer.querySelector('select[name="property"]');
    var control = composer.querySelector("[data-value-control]");
    var valueInput = control.querySelector("input");
    // Template and grid properties get pickers from the rendered theme; everything else is text.
    var choicesRequest;
    function themeChoices() {
      return choicesRequest || (choicesRequest = fetch(route + "?choices=1", { credentials: "same-origin" }).then(function (response) { return response.json(); }));
    }
    var PICKERS = { template: 1, templateOptions: 1, column: 1, columnSpan: 1, startNewRow: 1 };
    function selectHtml(name, entries, value) {
      return '<select data-value name="' + esc(name) + '" aria-label="' + esc(name) + '">' + entries.map(function (entry) {
        return '<option value="' + esc(entry[0]) + '"' + (entry[0] === value ? " selected" : "") + ">" + esc(entry[1]) + "</option>";
      }).join("") + "</select>";
    }
    function pendingTemplate(editable) {
      var entry = batch.filter(function (item) { return item.target === editable.patch && item.property === "template"; })[0];
      return entry ? entry.value : editable.values.template || "standard";
    }
    function renderControl(editable, property, value) {
      if (!PICKERS[property]) {
        control.innerHTML = '<input name="value" aria-label="New value" maxlength="4000">';
        valueInput = control.querySelector("input");
        valueInput.value = value;
        valueInput.addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); composer.requestSubmit(); } });
        return;
      }
      valueInput = null;
      if (property === "column" || property === "columnSpan") {
        var columns = [["", "Automatic"]];
        for (var n = 1; n <= 12; n++) columns.push([String(n), String(n)]);
        control.innerHTML = selectHtml(property, columns, value);
        return;
      }
      if (property === "startNewRow") {
        control.innerHTML = selectHtml(property, [["", "Default (yes)"], ["true", "Yes"], ["false", "No"]], value);
        return;
      }
      control.innerHTML = '<span class="apex-local-muted">Loading the theme…</span>';
      themeChoices().then(function (data) {
        if (current() !== editable || propertySelect.value !== property) return;
        var kind = editable.kind === "page" ? "page" : "region";
        if (property === "template") {
          control.innerHTML = selectHtml(property, [["", "Theme default"]].concat((data.templates[kind] || []).map(function (entry) { return [entry.id, entry.name + " (" + entry.id + ")"]; })), value);
          return;
        }
        var template = pendingTemplate(editable), options = (data.options[kind] || {})[template] || [];
        var chosen = (value || "").split(/\s+/).filter(Boolean), groups = {}, loose = [];
        options.forEach(function (option) { if (option.group) (groups[option.group] = groups[option.group] || []).push(option); else loose.push(option); });
        var html = '<div class="apex-local-review-options" data-options><label><input type="checkbox" data-option value="#DEFAULT#"' + (chosen.indexOf("#DEFAULT#") >= 0 ? " checked" : "") + "> Template defaults</label>";
        Object.keys(groups).forEach(function (id) {
          var group = data.groups[id] || { label: id, none: "Default" };
          var picked = groups[id].filter(function (option) { return chosen.indexOf(option.css) >= 0; })[0];
          html += "<label>" + esc(group.label) + " " + selectHtml("group-" + id, [["", group.none]].concat(groups[id].map(function (option) { return [option.css, option.label]; })), picked ? picked.css : "") + "</label>";
        });
        loose.forEach(function (option) {
          html += '<label><input type="checkbox" data-option value="' + esc(option.css) + '"' + (chosen.indexOf(option.css) >= 0 ? " checked" : "") + "> " + esc(option.label) + "</label>";
        });
        control.innerHTML = options.length ? html + "</div>" : '<span class="apex-local-muted">Template ' + esc(template) + " has no options in this theme.</span>";
      }, function () { control.innerHTML = '<span class="apex-local-muted">The theme is unavailable; template and layout pickers need the preview theme.</span>'; });
    }
    function controlValue() {
      if (valueInput) return valueInput.value;
      var options = control.querySelector("[data-options]");
      if (options) {
        var values = [];
        options.querySelectorAll("input[data-option]:checked").forEach(function (box) { values.push(box.value); });
        options.querySelectorAll("select[data-value]").forEach(function (select) { if (select.value) values.push(select.value); });
        return values.join(" ");
      }
      var select = control.querySelector("select[data-value]");
      return select ? select.value : null;
    }
    function current() { return editableOf(options[targetSelect ? Number(targetSelect.value) : selected]); }
    function fillProperties() {
      var editable = current(), properties = editProperties(editable);
      if (typeof updateColumnsButton === "function" && columnsButton) updateColumnsButton();
      if (typeof updateMoveButton === "function" && moveOpen) updateMoveButton();
      propertySelect.innerHTML = properties.map(function (name) { return '<option value="' + esc(name) + '">' + esc(name) + "</option>"; }).join("");
      var editButton = composer.querySelector('[data-mode="edit"]');
      if (editButton) editButton.disabled = !properties.length;
      if (!properties.length && mode === "edit") setMode("comment");
      fillValue();
    }
    function fillValue() {
      var editable = current();
      renderControl(editable, propertySelect.value, editable && propertySelect.value ? editable.values[propertySelect.value] || "" : "");
      var whereNode = composer.querySelector("[data-edit-where]");
      whereNode.textContent = editable ? editable.patch + " · " + editable.file : "";
    }
    function setMode(next) {
      mode = next;
      composer.querySelectorAll("[data-mode]").forEach(function (button) { button.classList.toggle("is-on", button.getAttribute("data-mode") === mode); });
      composer.querySelectorAll("[data-mode-pane]").forEach(function (pane) { pane.hidden = pane.getAttribute("data-mode-pane") !== mode; });
      (mode === "edit" ? valueInput || control.querySelector("select, input") || propertySelect : area).focus();
    }
    // Proposed changes of one page file, saved together as one atomic source replacement.
    var batch = [], batchList = composer.querySelector("[data-batch]");
    function proposal() {
      var editable = current();
      if (!editable || !propertySelect.value) return null;
      var value = controlValue();
      if (value === null) return null;
      return { editable: editable, target: editable.patch, property: propertySelect.value, value: value };
    }
    function renderBatch(failed) {
      batchList.innerHTML = batch.map(function (entry, index) {
        var label = entry.move
          ? entry.target + " · move → " + (entry.move.to.region ? "region " + entry.move.to.region : "page") + " / " + entry.move.to.slot + (entry.move.to.sequence ? " #" + entry.move.to.sequence : "")
          : entry.target + " · " + entry.property + " → " + entry.value;
        return '<li' + (index === failed ? ' class="is-error"' : "") + ">" + esc(label) +
          '<button type="button" class="apex-local-action" data-batch-remove="' + index + '" aria-label="Remove this change">×</button></li>';
      }).join("");
    }
    function addToBatch() {
      var next = proposal(), message = composer.querySelector(".apex-local-review-error");
      if (!next) return false;
      if (batch.length && batch[0].editable.file !== next.editable.file) {
        message.hidden = false; message.textContent = "Changes are saved per page file; save these first.";
        return false;
      }
      batch = batch.filter(function (entry) { return !(entry.target === next.target && entry.property === next.property && !!entry.move === !!next.move); });
      batch.push(next);
      renderBatch();
      return true;
    }
    batchList.addEventListener("click", function (event) {
      var remove = event.target.closest("[data-batch-remove]");
      if (!remove) return;
      batch.splice(Number(remove.getAttribute("data-batch-remove")), 1);
      renderBatch();
    });
    composer.querySelector("[data-batch-add]").addEventListener("click", function () { addToBatch(); });
    // Column editor: every column of a report from its source (also columns without rows), saved
    // as one batch of column order with visibility plus heading and format changes.
    var columnsButton = composer.querySelector("[data-columns]"), columnEditor = composer.querySelector("[data-column-editor]"), columnState = null;
    function reportOf(editable) {
      if (!editable) return null;
      if (editable.kind === "column") return { region: editable.patch.slice(7).split(".")[0], page: editable.page };
      if (editable.kind === "region") return { region: editable.patch.slice(7), page: editable.page };
      return null;
    }
    function updateColumnsButton() {
      var report = reportOf(current()), entry = report && (config.map || []).filter(function (candidate) { return candidate.kind === "column" && candidate.patch.indexOf("column:" + report.region + ".") === 0; })[0];
      columnsButton.hidden = !entry;
    }
    function renderColumns(failed) {
      var state = columnState;
      columnEditor.innerHTML = '<table class="apex-local-review-columns"><thead><tr><td></td><td>Column</td><td>Shown</td><td>Heading</td><td>Format</td></tr></thead><tbody>' +
        state.order.map(function (name, index) {
          var column = state.byName[name];
          return '<tr data-column="' + esc(name) + '"' + (failed === name ? ' class="is-error"' : "") + ">" +
            '<td><button type="button" class="apex-local-action" data-move="-1" aria-label="Move up"' + (index ? "" : " disabled") + '>↑</button><button type="button" class="apex-local-action" data-move="1" aria-label="Move down"' + (index < state.order.length - 1 ? "" : " disabled") + ">↓</button></td>" +
            "<td>" + esc(name) + "</td>" +
            '<td><input type="checkbox" data-field="visible"' + (column.visible ? " checked" : "") + ' aria-label="Shown"></td>' +
            '<td><input type="text" data-field="heading" value="' + esc(column.heading) + '" aria-label="Heading" maxlength="4000"></td>' +
            '<td><input type="text" data-field="format" value="' + esc(column.format) + '" aria-label="Format" maxlength="4000"></td></tr>';
        }).join("") + '</tbody></table><button type="button" class="apex-local-action is-primary" data-columns-save>Save columns</button>';
    }
    function openColumns() {
      var report = reportOf(current()), message = composer.querySelector(".apex-local-review-error");
      if (!report) return;
      message.hidden = true;
      fetch(route + "?columns=" + encodeURIComponent(report.region) + "&page=" + encodeURIComponent(report.page), { credentials: "same-origin" })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.error) throw new Error(data.error);
          var byName = {};
          data.columns.forEach(function (column) { byName[column.name] = { heading: column.heading, format: column.format, visible: column.visible, original: column }; });
          columnState = { page: report.page, region: data.region, file: data.file, digest: data.digest, order: data.order.slice(), original: data.order.slice(), byName: byName };
          columnEditor.hidden = false;
          renderColumns();
        })
        .catch(function (error) { message.hidden = false; message.textContent = error.message; });
    }
    columnsButton.addEventListener("click", openColumns);
    // Move: the same typed request from the form (keyboard) or a drop on a region (pointer).
    var moveOpen = composer.querySelector("[data-move-open]"), moveForm = composer.querySelector("[data-move-form]");
    var moveRegion = composer.querySelector('select[name="move-region"]'), moveSlot = composer.querySelector('select[name="move-slot"]'), moveSequence = composer.querySelector('input[name="move-sequence"]');
    var MOVABLE = { item: 1, button: 1, region: 1 };
    function regionsOf(editable) {
      return (config.map || []).filter(function (entry) { return entry.kind === "region" && entry.file === editable.file && entry.patch !== editable.patch; });
    }
    function slotsFor(editable, regionId) {
      var moves = config.moves || {}, target = (config.map || []).filter(function (entry) { return entry.kind === "region" && entry.patch === "region:" + regionId; })[0];
      if (editable.kind === "item") return moves.item || [];
      if (editable.kind === "button") return (target && target.regionType === "interactiveReport" ? moves.buttonInInteractiveReport : moves.button) || [];
      return regionId ? moves.subRegion || [] : moves.page || [];
    }
    function fillSlots() {
      var editable = current();
      moveSlot.innerHTML = slotsFor(editable, moveRegion.value).map(function (slot) { return '<option value="' + esc(slot) + '">' + esc(slot) + "</option>"; }).join("");
    }
    function fillMove(regionId) {
      var editable = current();
      var options = (editable.kind === "region" ? [["", "Page (no parent region)"]] : []).concat(regionsOf(editable).map(function (entry) { return [entry.patch.slice(7), entry.label + " (" + entry.patch.slice(7) + ")"]; }));
      moveRegion.innerHTML = options.map(function (option) { return '<option value="' + esc(option[0]) + '"' + (option[0] === regionId ? " selected" : "") + ">" + esc(option[1]) + "</option>"; }).join("");
      fillSlots();
    }
    function updateMoveButton() {
      var editable = current();
      moveOpen.hidden = !(editable && MOVABLE[editable.kind]);
      if (moveOpen.hidden) moveForm.hidden = true;
    }
    moveOpen.addEventListener("click", function () { moveForm.hidden = false; fillMove(); moveRegion.focus(); });
    moveRegion.addEventListener("change", fillSlots);
    composer.querySelector("[data-move-add]").addEventListener("click", function () {
      var editable = current(), message = composer.querySelector(".apex-local-review-error"), sequence = moveSequence.value.trim();
      message.hidden = true;
      if (!editable || !moveSlot.value) { message.hidden = false; message.textContent = "Pick a destination slot."; return; }
      if (sequence && !/^[1-9]\d{0,8}$/.test(sequence)) { message.hidden = false; message.textContent = "Sequence is a positive whole number."; return; }
      if (batch.length && batch[0].editable.file !== editable.file) { message.hidden = false; message.textContent = "Changes are saved per page file; save these first."; return; }
      var to = { slot: moveSlot.value };
      if (moveRegion.value) to.region = moveRegion.value;
      if (sequence) to.sequence = Number(sequence);
      batch = batch.filter(function (entry) { return !(entry.move && entry.target === editable.patch); });
      batch.push({ editable: editable, target: editable.patch, property: "move", value: "", move: { op: "moveComponent", component: editable.patch, to: to } });
      renderBatch();
    });
    // Dropping onto a region only fills the form; nothing on the page moves until the source is saved.
    var dragged = false, dropTarget = null;
    composer.querySelector("[data-move-drag]").addEventListener("dragstart", function (event) {
      dragged = true;
      event.dataTransfer.setData("text/plain", current().patch);
      event.dataTransfer.effectAllowed = "move";
    });
    function regionAt(node) {
      var editable = current();
      for (var element = node; element && element !== document.body; element = element.parentElement) {
        if (!element.id) continue;
        var entry = regionsOf(editable).filter(function (candidate) { return candidate.keys.indexOf(element.id) >= 0; })[0];
        if (entry) return { entry: entry, element: element };
      }
      return null;
    }
    function onDragOver(event) {
      if (!dragged) return;
      var found = regionAt(event.target);
      if (dropTarget && (!found || found.element !== dropTarget)) { dropTarget.classList.remove("apex-local-review-drop"); dropTarget = null; }
      if (!found) return;
      event.preventDefault();
      dropTarget = found.element;
      dropTarget.classList.add("apex-local-review-drop");
    }
    function onDrop(event) {
      if (!dragged) return;
      var found = regionAt(event.target);
      if (dropTarget) dropTarget.classList.remove("apex-local-review-drop");
      dropTarget = null; dragged = false;
      if (!found) return;
      event.preventDefault();
      moveForm.hidden = false;
      fillMove(found.entry.patch.slice(7));
      moveSlot.focus();
    }
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    composer.addEventListener("apex-local-close", function () {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    });
    columnEditor.addEventListener("click", function (event) {
      var move = event.target.closest("[data-move]");
      if (move) {
        var name = move.closest("tr").getAttribute("data-column"), from = columnState.order.indexOf(name), to = from + Number(move.getAttribute("data-move"));
        columnState.order.splice(from, 1);
        columnState.order.splice(to, 0, name);
        renderColumns();
        return;
      }
      if (!event.target.closest("[data-columns-save]")) return;
      var state = columnState, message = composer.querySelector(".apex-local-review-error"), operations = [], setFor = [], visible = {};
      state.order.forEach(function (name) {
        var column = state.byName[name], original = column.original;
        if (column.visible !== original.visible) visible[name] = column.visible;
        if (column.heading !== original.heading) { operations.push({ target: "column:" + state.region + "." + name, property: "heading", value: column.heading }); setFor.push(name); }
        if (column.format !== original.format) { operations.push({ target: "column:" + state.region + "." + name, property: "format", value: column.format }); setFor.push(name); }
      });
      var reordered = state.order.join(",") !== state.original.join(",");
      if (reordered || Object.keys(visible).length) operations.push({ op: "orderColumns", region: state.region, order: state.order, visible: visible });
      if (!operations.length) { message.hidden = false; message.textContent = "Nothing changed yet."; return; }
      saving = true;
      send({ op: "patch", page: state.page, digest: state.digest, operations: operations }).then(function (data) {
        config.digests[state.file] = data.result.afterDigest;
        var ok = composer.querySelector(".apex-local-review-ok");
        ok.hidden = false;
        ok.textContent = "Saved the columns to " + data.result.file + " in one edit. The preview reloads with them; validate or ship to deploy them.";
      }, function (error) {
        // The editor keeps every proposed value; a failing column is marked.
        saving = false;
        renderColumns(typeof error.operation === "number" ? setFor[error.operation] : undefined);
        message.hidden = false;
        message.textContent = error.status === 409
          ? "The source file changed since the columns were read. Your changes are kept: reload the page and save them on the newer version."
          : error.message;
      });
    });
    columnEditor.addEventListener("input", function (event) {
      var field = event.target.getAttribute("data-field"), row = event.target.closest("tr");
      if (!field || !row) return;
      var column = columnState.byName[row.getAttribute("data-column")];
      column[field] = field === "visible" ? event.target.checked : event.target.value;
    });
    columnEditor.addEventListener("change", function (event) {
      if (event.target.getAttribute("data-field") !== "visible") return;
      columnState.byName[event.target.closest("tr").getAttribute("data-column")].visible = event.target.checked;
    });
    if (!existing) {
      composer.querySelectorAll("[data-mode]").forEach(function (button) { button.addEventListener("click", function () { setMode(button.getAttribute("data-mode")); }); });
      if (targetSelect) targetSelect.addEventListener("change", fillProperties);
      propertySelect.addEventListener("change", fillValue);
      fillProperties();
    }
    area.focus();
    area.addEventListener("keydown", function (event) { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); composer.requestSubmit(); } });
    composer.querySelector("[data-cancel]").addEventListener("click", closeComposer);
    composer.addEventListener("submit", function (event) {
      event.preventDefault();
      var message = composer.querySelector(".apex-local-review-error"), ok = composer.querySelector(".apex-local-review-ok");
      message.hidden = true; ok.hidden = true;
      if (mode === "edit") {
        // The field being edited joins the proposed changes when it differs from the source value.
        var pending = proposal();
        if (pending && (pending.editable.values[pending.property] || "") !== pending.value) addToBatch();
        if (!batch.length) { message.hidden = false; message.textContent = "Nothing changed yet."; return; }
        var file = batch[0].editable.file, digest = (config.digests || {})[file];
        if (!digest) { message.hidden = false; message.textContent = "This component has no editable source file."; return; }
        saving = true;
        return send({ op: "patch", page: batch[0].editable.page, digest: digest, operations: batch.map(function (entry) {
          return entry.move || { target: entry.target, property: entry.property, value: entry.value };
        }) }).then(function (data) {
          // Stays "saving" until the composer closes, so the preview's reload with the change goes through.
          config.digests[file] = data.result.afterDigest;
          batch.forEach(function (entry) { if (!entry.move) entry.editable.values[entry.property] = entry.value; });
          ok.hidden = false;
          ok.textContent = "Saved " + batch.length + (batch.length === 1 ? " change" : " changes") + " to " + data.result.file +
            " in one edit. The preview reloads with the change; validate or ship to deploy it.";
          batch = [];
          renderBatch();
        }, function (error) {
          // The proposed changes stay for reconciliation; a failing one is marked.
          saving = false;
          renderBatch(typeof error.operation === "number" ? error.operation : undefined);
          message.hidden = false;
          message.textContent = error.status === 409
            ? "The source file changed since this page loaded. Your changes are kept: reload the page and save them on the newer version."
            : error.message;
        });
      }
      if (!area.value.trim()) { message.hidden = false; message.textContent = "Write what should change."; return; }
      var body = existing
        ? { op: "edit", id: existing.id, text: area.value, intent: composer.querySelector('select[name="intent"]').value }
        : { op: "add", page: config.page, target: targetOf(options[Number(targetSelect.value)]), intent: composer.querySelector('select[name="intent"]').value || undefined, text: area.value };
      send(body).then(function () { closeComposer(); load(); }, function (error) {
        var message = composer && composer.querySelector(".apex-local-review-error");
        if (message) { message.hidden = false; message.textContent = error.message; }
      });
    });
  }

  function place(anchor) {
    var rect = anchor ? anchor.getBoundingClientRect() : { left: innerWidth / 2 - 190, bottom: 80, top: 80 };
    var width = composer.offsetWidth, height = composer.offsetHeight;
    var left = Math.max(12, Math.min(innerWidth - width - 12, rect.left));
    var top = rect.bottom + 8 + height < innerHeight - 60 ? rect.bottom + 8 : Math.max(12, rect.top - height - 8);
    composer.style.left = left + "px"; composer.style.top = Math.min(top, innerHeight - height - 60) + "px";
  }

  // ------------------------------------------------------------- data
  function send(body) {
    return fetch(route, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) })
      .then(function (response) { return response.json().then(function (data) { if (!response.ok || data.error) { var error = new Error(data.error || response.statusText); error.status = response.status; error.operation = data.operation; throw error; } return data; }); });
  }

  function load() {
    var all = panel && panel.querySelector("[data-apex-local-review-all]");
    var query = "?status=all" + (all && all.checked ? "" : "&page=" + encodeURIComponent(config.page));
    return fetch(route + query, { credentials: "same-origin" })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        comments = data.comments || [];
        render();
      })
      .catch(function (error) { if (list) list.innerHTML = '<li class="apex-local-muted">' + esc(error.message) + "</li>"; });
  }

  function where(comment) {
    var target = comment.target || {};
    var name = target.kind === "page" ? "Page " + comment.page.id : (KIND[target.kind] || target.kind) + " " + (target.id || target.selector || "");
    if (target.kind === "column" && target.region) name += " · region " + target.region;
    if (target.kind === "element" && target.region) name += " · region " + target.region;
    var source = target.file ? " · " + target.file + (target.line ? ":" + target.line : "") : "";
    return (comment.page.id !== config.page ? "Page " + comment.page.id + " · " : "") + name + (target.label ? " “" + target.label + "”" : "") + source;
  }

  function nodeFor(comment) {
    if (comment.page.id !== config.page) return null;
    var target = comment.target || {};
    if (target.kind === "page") return null;
    var node = null;
    // Mapped components are found by their DOM ids (rows and layout change); elements by selector.
    if (target.id) {
      var entry = (config.map || []).filter(function (candidate) { return candidate.kind === target.kind && candidate.id === target.id && (!target.region || candidate.region === target.region); })[0];
      if (entry) for (var i = 0; i < entry.keys.length && !node; i++) node = document.getElementById(entry.keys[i]);
    }
    if (!node) try { node = target.selector ? document.querySelector(target.selector) : null; } catch (e) { node = null; }
    return node && node.getClientRects().length ? node : null;
  }

  function render() {
    var showResolved = panel && panel.querySelector("[data-apex-local-review-resolved]").checked;
    var visible = comments.filter(function (comment) { return showResolved || comment.status === "open"; });
    var openHere = comments.filter(function (comment) { return comment.status === "open" && comment.page.id === config.page; });
    if (badge) { badge.textContent = String(openHere.length); badge.hidden = !openHere.length; }
    if (list) list.innerHTML = visible.length ? visible.map(function (comment) {
      var number = openHere.indexOf(comment) + 1;
      return '<li data-id="' + esc(comment.id) + '" class="' + (comment.status === "resolved" ? "is-resolved" : "") + '">' +
        '<span class="apex-local-review-num">' + (number || "✓") + "</span>" +
        '<div><div class="apex-local-review-where">' + esc(where(comment)) + "</div>" +
        '<div class="apex-local-review-text">' + (comment.intent ? '<span class="apex-local-review-chip">' + esc(comment.intent) + "</span>" : "") + esc(comment.text) + "</div>" +
        (comment.resolution && comment.resolution.note ? '<div class="apex-local-review-where">Resolved: ' + esc(comment.resolution.note) + "</div>" : "") + "</div>" +
        '<div class="apex-local-review-tools">' + (comment.status === "open"
          ? '<button type="button" class="apex-local-action" data-edit>Edit</button><button type="button" class="apex-local-action" data-resolve>Resolve</button>'
          : '<button type="button" class="apex-local-action" data-reopen>Reopen</button>') +
        '<button type="button" class="apex-local-action" data-delete title="Delete">✕</button></div></li>';
    }).join("") : '<li class="apex-local-muted">No comments yet. Press “Select on page” (Alt+Shift+C) and click a region, item, button or column.</li>';
    renderPins(openHere);
  }

  function renderPins(open) {
    pins.forEach(function (pin) { pin.el.remove(); });
    pins = [];
    open.forEach(function (comment, index) {
      var node = nodeFor(comment);
      if (!node) return;
      var el = document.createElement("button");
      el.type = "button";
      el.className = "apex-local-review-pin";
      el.textContent = String(index + 1);
      el.title = comment.text;
      el.addEventListener("click", function (event) { event.preventDefault(); event.stopPropagation(); openComposer(null, comment); });
      el.addEventListener("mouseenter", function () { highlight(node, where(comment)); });
      el.addEventListener("mouseleave", function () { if (!picking && !composer) highlight(null); });
      document.body.appendChild(el);
      pins.push({ el: el, node: node });
    });
    positionPins();
  }

  function positionPins() {
    pins.forEach(function (pin) {
      var rect = pin.node.getBoundingClientRect();
      pin.el.hidden = !rect.width && !rect.height;
      pin.el.style.left = Math.max(0, rect.right + scrollX - 14) + "px";
      pin.el.style.top = Math.max(0, rect.top + scrollY - 12) + "px";
    });
  }
  var scheduled = false;
  function schedule() { if (scheduled) return; scheduled = true; requestAnimationFrame(function () { scheduled = false; positionPins(); }); }
  addEventListener("scroll", schedule, true);
  addEventListener("resize", schedule);
  setInterval(positionPins, 1500);

  if (panel) {
    panel.addEventListener("click", function (event) {
      var item = event.target.closest("li[data-id]");
      var comment = item && comments.filter(function (entry) { return entry.id === item.getAttribute("data-id"); })[0];
      if (event.target.closest("[data-apex-local-review-pick]")) return setPicking(!picking);
      var historyButton = event.target.closest("[data-apex-local-review-undo], [data-apex-local-review-redo]");
      if (historyButton) {
        var direction = historyButton.hasAttribute("data-apex-local-review-undo") ? "undo" : "redo", note = panel.querySelector("[data-apex-local-review-history]");
        saving = true;
        return send({ op: direction }).then(function (data) {
          var done = data.result.undone || data.result.redone;
          config.digests[data.result.file] = data.result.afterDigest;
          note.hidden = false;
          note.textContent = (direction === "undo" ? "Undid " : "Redid ") + done.summary + " in " + data.result.file +
            ". Local source only: a deployed application is not reverted. The preview reloads.";
        }, function (error) {
          saving = false;
          note.hidden = false;
          note.textContent = error.status === 409 ? "The file changed since that edit, so nothing was " + (direction === "undo" ? "undone" : "redone") + "." : error.message;
        });
      }
      if (event.target.closest("[data-apex-local-review-copy]")) {
        return fetch(route + "?status=open&format=text", { credentials: "same-origin" }).then(function (r) { return r.text(); }).then(function (value) {
          var done = function () { var b = event.target.closest("button"); b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1500); };
          if (navigator.clipboard) navigator.clipboard.writeText(value).then(done, function () { prompt("Copy the comments", value); });
          else prompt("Copy the comments", value);
        });
      }
      if (!comment) return;
      if (event.target.closest("[data-edit]")) return openComposer(null, comment);
      if (event.target.closest("[data-resolve]")) return send({ op: "resolve", ids: [comment.id] }).then(load);
      if (event.target.closest("[data-reopen]")) return send({ op: "reopen", ids: [comment.id] }).then(load);
      if (event.target.closest("[data-delete]") && confirm("Delete this review comment?")) return send({ op: "delete", ids: [comment.id] }).then(load);
    });
    panel.addEventListener("change", function (event) {
      if (event.target.matches("[data-apex-local-review-all]")) load();
      else if (event.target.matches("[data-apex-local-review-resolved]")) render();
    });
    panel.addEventListener("mouseover", function (event) {
      var item = event.target.closest("li[data-id]");
      var comment = item && comments.filter(function (entry) { return entry.id === item.getAttribute("data-id"); })[0];
      var node = comment && nodeFor(comment);
      if (!picking && !composer) highlight(node, node ? where(comment) : "");
    });
    panel.addEventListener("mouseleave", function () { if (!picking && !composer) highlight(null); });
  }
  // Comments an agent resolved elsewhere show up without a page reload.
  var signature = "";
  function refresh() {
    if (document.hidden || composer) return;
    var all = panel && panel.querySelector("[data-apex-local-review-all]");
    fetch(route + "?status=all" + (all && all.checked ? "" : "&page=" + encodeURIComponent(config.page)), { credentials: "same-origin" })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        var next = JSON.stringify((data.comments || []).map(function (c) { return [c.id, c.status, c.updatedAt]; }));
        if (!data.error && next !== signature) { signature = next; comments = data.comments || []; render(); }
      }, function () {});
  }
  if (panel && window.MutationObserver)
    new MutationObserver(function () { if (!panel.hidden) refresh(); }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  addEventListener("focus", refresh);
  setInterval(refresh, 10000);
  // The live client keeps the page while a draft is open; a property save lets its own reload through.
  window.apexLocalReview = { pick: setPicking, reload: load, candidates: candidates, busy: function () { return !!composer && !saving; } };
  load();
})();
`;
