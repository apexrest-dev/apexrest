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
  function closeComposer() { if (composer) composer.remove(); composer = null; saving = false; if (!picking) highlight(null); }

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
      '<div data-mode-pane="edit" hidden><select name="property" aria-label="Property"></select><input name="value" aria-label="New value" maxlength="4000"><p class="apex-local-review-where" data-edit-where></p>' +
      '<button type="button" class="apex-local-action" data-batch-add title="Collect this change and pick another component or property">Add to changes</button><ol class="apex-local-review-batch" data-batch aria-label="Proposed changes"></ol></div>' +
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
    var valueInput = composer.querySelector('input[name="value"]');
    function current() { return editableOf(options[targetSelect ? Number(targetSelect.value) : selected]); }
    function fillProperties() {
      var editable = current(), properties = editProperties(editable);
      propertySelect.innerHTML = properties.map(function (name) { return '<option value="' + esc(name) + '">' + esc(name) + "</option>"; }).join("");
      var editButton = composer.querySelector('[data-mode="edit"]');
      if (editButton) editButton.disabled = !properties.length;
      if (!properties.length && mode === "edit") setMode("comment");
      fillValue();
    }
    function fillValue() {
      var editable = current();
      valueInput.value = editable && propertySelect.value ? editable.values[propertySelect.value] || "" : "";
      var whereNode = composer.querySelector("[data-edit-where]");
      whereNode.textContent = editable ? editable.patch + " · " + editable.file : "";
    }
    function setMode(next) {
      mode = next;
      composer.querySelectorAll("[data-mode]").forEach(function (button) { button.classList.toggle("is-on", button.getAttribute("data-mode") === mode); });
      composer.querySelectorAll("[data-mode-pane]").forEach(function (pane) { pane.hidden = pane.getAttribute("data-mode-pane") !== mode; });
      (mode === "edit" ? valueInput : area).focus();
    }
    // Proposed changes of one page file, saved together as one atomic source replacement.
    var batch = [], batchList = composer.querySelector("[data-batch]");
    function proposal() {
      var editable = current();
      if (!editable || !propertySelect.value) return null;
      return { editable: editable, target: editable.patch, property: propertySelect.value, value: valueInput.value };
    }
    function renderBatch(failed) {
      batchList.innerHTML = batch.map(function (entry, index) {
        return '<li' + (index === failed ? ' class="is-error"' : "") + ">" + esc(entry.target + " · " + entry.property + " → " + entry.value) +
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
      batch = batch.filter(function (entry) { return !(entry.target === next.target && entry.property === next.property); });
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
    if (!existing) {
      composer.querySelectorAll("[data-mode]").forEach(function (button) { button.addEventListener("click", function () { setMode(button.getAttribute("data-mode")); }); });
      if (targetSelect) targetSelect.addEventListener("change", fillProperties);
      propertySelect.addEventListener("change", fillValue);
      valueInput.addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); composer.requestSubmit(); } });
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
          return { target: entry.target, property: entry.property, value: entry.value };
        }) }).then(function (data) {
          // Stays "saving" until the composer closes, so the preview's reload with the change goes through.
          config.digests[file] = data.result.afterDigest;
          batch.forEach(function (entry) { entry.editable.values[entry.property] = entry.value; });
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
