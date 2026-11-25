import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  sourceInventory
} from "./chunk-HSLUPXT4.mjs";
import {
  parseApexLang
} from "./chunk-C66KGFY2.mjs";
import {
  sourceRelease
} from "./chunk-ZJMQHNNS.mjs";
import {
  sourceChange
} from "./chunk-V3NFRVGE.mjs";
import {
  atomicWrite,
  contained,
  exists,
  withLock
} from "./chunk-YLKYRT24.mjs";
import {
  Fault
} from "./chunk-HRRL6FHO.mjs";

// packages/core/src/edit/apexlang-edit.ts
import { createHash } from "node:crypto";
var MAX_BYTES = 8 * 1024 * 1024;
var COMPONENT = /^( *)([A-Za-z]\w*)(?:\s+(.+?))?\s*\(\s*$/u;
var GROUP = /^( *)([A-Za-z][\w-]*)\s*\{\s*$/u;
var PROPERTY = /^( *)("(?:[^"\\]|\\.)*"|[A-Za-z0-9_$.#-]+)\s*:(?:([ \t]+)(.*?))?\s*$/u;
var unsupported = (message) => new Fault("TRANSFORM_UNSUPPORTED", message, 5);
var unquote = (raw) => {
  if (!raw.startsWith('"')) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw unsupported(`Invalid quoted identifier ${raw}`);
  }
};
var digestOf = (text2) => createHash("sha256").update(text2, "utf8").digest("hex");
var ApexLangDocument = class {
  constructor(source) {
    this.source = source;
    if (Buffer.byteLength(source) > MAX_BYTES) throw unsupported("Source exceeds the bounded editor limit.");
    this.lines = [...source.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/gu)].filter((match) => match[0].length).map((match) => ({ text: match[1], eol: match[2], offset: match.index }));
    this.eol = this.lines.find((line) => line.eol)?.eol ?? "\n";
    this.scan();
  }
  source;
  lines;
  roots = [];
  eol;
  scan() {
    const stack = [];
    const component = () => {
      for (let i = stack.length - 1; i >= 0; i--) {
        const frame = stack[i];
        if (frame.type === "component") return frame.node;
      }
      return void 0;
    };
    const groupPath = () => {
      const parts = [];
      for (let i = stack.length - 1; i >= 0; i--) {
        const frame = stack[i];
        if (frame.type === "component") break;
        if (frame.type === "group") parts.unshift(frame.path);
      }
      return parts.join(".");
    };
    let fence = false;
    let block = false;
    let pendingFence;
    let fenceOwner;
    for (let index = 0; index < this.lines.length; index++) {
      const line = this.lines[index];
      const text2 = line.text;
      const trimmed = text2.trim();
      if (fence) {
        if (trimmed === "```") {
          fence = false;
          if (fenceOwner?.fence) fenceOwner.fence.close = index;
          fenceOwner = void 0;
        }
        continue;
      }
      if (block) {
        const end = text2.indexOf("*/");
        if (end === -1) continue;
        if (text2.slice(end + 2).trim()) throw unsupported("Content after a block comment is not supported.");
        block = false;
        continue;
      }
      if (!trimmed || trimmed.startsWith("//")) continue;
      if (trimmed.startsWith("/*")) {
        const end = text2.indexOf("*/", text2.indexOf("/*") + 2);
        if (end === -1) block = true;
        else if (text2.slice(end + 2).trim())
          throw unsupported("Content after a block comment is not supported.");
        continue;
      }
      if (trimmed.startsWith("```")) {
        if (!pendingFence) throw unsupported(`Unexpected literal at line ${index + 1}.`);
        fence = !(trimmed.length >= 6 && trimmed.endsWith("```"));
        if (fence) {
          pendingFence.fence = { open: index, close: -1 };
          fenceOwner = pendingFence;
        }
        pendingFence = void 0;
        continue;
      }
      pendingFence = void 0;
      const top = stack.at(-1);
      if (top?.type === "value") {
        if (trimmed === top.close) stack.pop();
        else if (trimmed === "{" || /:\s*\{$/u.test(trimmed)) stack.push({ type: "value", close: "}" });
        else if (trimmed === "[" || /:\s*\[$/u.test(trimmed)) stack.push({ type: "value", close: "]" });
        continue;
      }
      if (trimmed === ")") {
        const frame = stack.pop();
        if (frame?.type !== "component") throw unsupported(`Unbalanced component at line ${index + 1}.`);
        frame.node.close = index;
        continue;
      }
      if (trimmed === "}") {
        const frame = stack.pop();
        if (frame?.type !== "group") throw unsupported(`Unbalanced group at line ${index + 1}.`);
        const owner = component();
        if (!owner) throw unsupported(`Group outside a component at line ${index + 1}.`);
        const parent = groupPath();
        owner.groups.set(parent ? `${parent}.${frame.path}` : frame.path, {
          open: frame.start,
          close: index,
          indent: frame.indent
        });
        continue;
      }
      const open = COMPONENT.exec(text2);
      if (open) {
        const parent = component();
        if (stack.at(-1)?.type === "group")
          throw unsupported(`Component inside a group at line ${index + 1}.`);
        const node = {
          kind: open[2],
          key: unquote((open[3] ?? "").trim()),
          indent: open[1].length,
          open: index,
          close: -1,
          parent,
          children: [],
          properties: /* @__PURE__ */ new Map(),
          groups: /* @__PURE__ */ new Map()
        };
        (parent ? parent.children : this.roots).push(node);
        stack.push({ type: "component", node });
        continue;
      }
      const group = GROUP.exec(text2);
      if (group) {
        if (!component()) throw unsupported(`Group outside a component at line ${index + 1}.`);
        stack.push({ type: "group", path: group[2], start: index, indent: group[1].length });
        continue;
      }
      const property = PROPERTY.exec(text2);
      if (property) {
        const owner = component();
        if (!owner) throw unsupported(`Property outside a component at line ${index + 1}.`);
        const key = unquote(property[2]);
        const prefix = groupPath();
        const path4 = prefix ? `${prefix}.${key}` : key;
        const value = property[4] ?? "";
        const colon = text2.indexOf(":", property[1].length + property[2].length);
        const valueStart = property[3] ? line.offset + colon + 1 + property[3].length : line.offset + colon + 1;
        const entry = {
          line: index,
          valueStart,
          valueEnd: valueStart + value.length,
          value,
          opaque: value === "" || value === "{" || value === "[" || value.startsWith("```")
        };
        if (owner.properties.has(path4)) throw unsupported(`Duplicate property ${path4} at line ${index + 1}.`);
        owner.properties.set(path4, entry);
        if (value === "") pendingFence = entry;
        else if (value === "{") stack.push({ type: "value", close: "}" });
        else if (value === "[") stack.push({ type: "value", close: "]" });
        continue;
      }
      throw unsupported(`Unsupported line ${index + 1}: ${trimmed.slice(0, 80)}`);
    }
    if (fence || block || stack.length) throw unsupported("Unclosed literal, comment, group or component.");
  }
  /** Finds exactly one component by kind and key among the given nodes (case-insensitive key). */
  static one(nodes, kind, key, where) {
    const found = nodes.filter((node) => node.kind === kind && node.key.toUpperCase() === key.toUpperCase());
    if (found.length === 1) return found[0];
    throw new Fault(
      found.length ? "TARGET_AMBIGUOUS" : "TARGET_NOT_FOUND",
      found.length ? `${where} has ${found.length} ${kind} components named ${key}.` : `${where} has no ${kind} ${key}.`,
      found.length ? 5 : 2
    );
  }
};
function scalarText(value) {
  if (/[\r\n]/u.test(value)) throw new Fault("INVALID_INPUT", "Values must be single-line text.", 2);
  if (value.length > 4e3) throw new Fault("INVALID_INPUT", "Values are limited to 4000 characters.", 2);
  const plain = value !== "" && value === value.trim() && !["true", "false", "{", "["].includes(value) && !/^["@\\[{]|^```|^\/\/|^\/\*/u.test(value);
  return plain ? value : JSON.stringify(value);
}
function setProperty(doc, node, path4, value) {
  return setPropertyText(doc, node, path4, scalarText(value));
}
function referenceText(id) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.$#-]{0,254}$/u.test(id))
    throw new Fault("INVALID_INPUT", `${id} is not a component id.`, 2);
  return "@" + id;
}
function setPropertyText(doc, node, path4, text2) {
  const existing = node.properties.get(path4);
  if (existing) {
    if (existing.opaque) throw unsupported(`${path4} holds a multi-line value; edit it in source.`);
    return { start: existing.valueStart, end: existing.valueEnd, content: text2 };
  }
  const parts = path4.split(".");
  if (parts.length > 2) throw unsupported(`Nested property ${path4} is not supported.`);
  const indent = " ".repeat(node.indent + 4);
  const eol = doc.eol;
  if (parts.length === 2) {
    const group = node.groups.get(parts[0]);
    if (group) {
      const close = doc.lines[group.close];
      return {
        start: close.offset,
        end: close.offset,
        content: `${" ".repeat(group.indent + 4)}${parts[1]}: ${text2}${eol}`
      };
    }
    const before = node.children[0]?.open ?? node.close;
    const anchor = doc.lines[before];
    return {
      start: anchor.offset,
      end: anchor.offset,
      content: `${indent}${parts[0]} {${eol}${indent}    ${parts[1]}: ${text2}${eol}${indent}}${eol}`
    };
  }
  const after = node.properties.get("name")?.line ?? node.open;
  const line = doc.lines[after];
  const at = line.offset + line.text.length + line.eol.length;
  return { start: at, end: at, content: `${indent}${path4}: ${text2}${eol}` };
}
function removeProperty(doc, node, path4) {
  const property = node.properties.get(path4);
  if (!property) return void 0;
  if (property.opaque) throw unsupported(`${path4} holds a multi-line value; edit it in source.`);
  const line = doc.lines[property.line];
  return { start: line.offset, end: line.offset + line.text.length + line.eol.length, content: "" };
}
function applyEdits(source, edits) {
  let result = source;
  let previous = source.length + 1;
  for (const edit of [...edits].sort((a, b) => b.start - a.start || b.end - a.end)) {
    if (edit.end > previous || edit.start > edit.end)
      throw new Fault("TRANSFORM_CONFLICT", "Two operations change the same property.", 5);
    result = result.slice(0, edit.start) + edit.content + result.slice(edit.end);
    previous = edit.start;
  }
  return result;
}
function setFencedText(doc, node, path4, text2) {
  const property = node.properties.get(path4);
  if (!property?.fence || property.fence.close < 0)
    throw unsupported(`${path4} is not a fenced literal of ${node.kind} ${node.key}.`);
  if (/^\s*```/mu.test(text2))
    throw new Fault("INVALID_INPUT", "The text cannot contain a ``` fence line.", 2);
  const open = doc.lines[property.fence.open];
  const close = doc.lines[property.fence.close];
  const indent = open.text.slice(0, open.text.length - open.text.trimStart().length);
  const body = text2.replace(/\r\n?/gu, "\n").replace(/\n+$/u, "").split("\n").map((line) => line ? indent + line : "").join(doc.eol);
  const start = open.offset + open.text.length + open.eol.length;
  return { start, end: close.offset, content: body + doc.eol };
}
function removeComponent(doc, node) {
  const open = doc.lines[node.open];
  const close = doc.lines[node.close];
  return { start: open.offset, end: close.offset + close.text.length + close.eol.length, content: "" };
}
function appendChild(doc, parent, text2) {
  const close = doc.lines[parent.close];
  return { start: close.offset, end: close.offset, content: text2 };
}
function readProperty(component, path4) {
  let value = component.props;
  for (const part of path4.split(".")) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
    value = value[part];
  }
  return value;
}

// packages/core/src/edit/transaction.ts
import path3 from "node:path";
import { readFile as readFile3 } from "node:fs/promises";

// packages/core/src/edit/page-file.ts
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
async function pageFile(ctx, page) {
  const app = await contained(ctx.root, ctx.config.application.sourceDir);
  const dir = path.join(app, "pages");
  const matches = [];
  for (const name of (await readdir(dir)).filter((file) => file.endsWith(".apx")).sort()) {
    const head = (await readFile(path.join(dir, name), "utf8")).slice(0, 4096);
    if (new RegExp(`^page\\s+${page}\\s*\\(`, "mu").test(head)) matches.push(path.join(dir, name));
  }
  if (matches.length !== 1)
    throw new Fault(
      matches.length ? "TARGET_AMBIGUOUS" : "TARGET_NOT_FOUND",
      matches.length ? `Several files declare page ${page}.` : `No page file declares page ${page}.`,
      matches.length ? 5 : 2
    );
  return matches[0];
}

// packages/core/src/edit/history.ts
import path2 from "node:path";
import { readFile as readFile2 } from "node:fs/promises";
import { randomUUID } from "node:crypto";
var HISTORY_LIMIT = 50;
var HISTORY_DAYS = 14;
var FILE = ".apexrest/edit-history.json";
async function load(ctx) {
  const file = await contained(ctx.root, FILE);
  let history = { version: 1, undo: [], redo: [] };
  if (await exists(file))
    try {
      const value = JSON.parse(await readFile2(file, "utf8"));
      if (value.version === 1 && Array.isArray(value.undo) && Array.isArray(value.redo)) history = value;
    } catch {
    }
  const oldest = Date.now() - HISTORY_DAYS * 24 * 3600 * 1e3;
  const fresh = (entry) => Date.parse(entry.at) >= oldest;
  return {
    version: 1,
    undo: history.undo.filter(fresh).slice(-HISTORY_LIMIT),
    redo: history.redo.filter(fresh).slice(-HISTORY_LIMIT)
  };
}
var save = async (ctx, history) => atomicWrite(await contained(ctx.root, FILE), JSON.stringify(history) + "\n");
function difference(before, after) {
  let prefix = 0;
  const limit = Math.min(before.length, after.length);
  while (prefix < limit && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < limit - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix])
    suffix++;
  return {
    prefix,
    suffix,
    beforeMiddle: before.slice(prefix, before.length - suffix),
    afterMiddle: after.slice(prefix, after.length - suffix)
  };
}
async function recordEdit(ctx, edit) {
  const history = await load(ctx);
  history.undo.push({
    id: randomUUID(),
    at: (/* @__PURE__ */ new Date()).toISOString(),
    file: edit.file,
    page: edit.page,
    summary: edit.summary.slice(0, 200),
    before: digestOf(edit.before),
    after: digestOf(edit.after),
    ...difference(edit.before, edit.after)
  });
  history.undo = history.undo.slice(-HISTORY_LIMIT);
  history.redo = [];
  await save(ctx, history);
}
async function editHistory(ctx) {
  const history = await load(ctx);
  const describe = (entry) => ({
    id: entry.id,
    at: entry.at,
    file: entry.file,
    page: entry.page,
    summary: entry.summary
  });
  return {
    undo: history.undo.slice(-10).reverse().map(describe),
    redo: history.redo.slice(-10).reverse().map(describe),
    limit: HISTORY_LIMIT,
    retentionDays: HISTORY_DAYS,
    scope: "Local page source only; undo never reverts a deployed application."
  };
}
async function step(ctx, direction) {
  return withLock(path2.join(ctx.root, ".apexrest", "source-edit.lock"), async () => {
    const history = await load(ctx);
    const entry = (direction === "undo" ? history.undo : history.redo).at(-1);
    if (!entry) throw new Fault("HISTORY_EMPTY", `Nothing to ${direction}.`, 2);
    const file = await contained(ctx.root, entry.file);
    const current = await exists(file) ? await readFile2(file, "utf8") : "";
    const expected = direction === "undo" ? entry.after : entry.before;
    if (digestOf(current) !== expected)
      throw new Fault(
        "TRANSFORM_CONFLICT",
        `${entry.file} changed since that edit; ${direction} would overwrite newer work, so nothing was written.`,
        5,
        "conflict",
        { file: entry.file, currentDigest: digestOf(current) }
      );
    const middle = direction === "undo" ? entry.beforeMiddle : entry.afterMiddle;
    const result = current.slice(0, entry.prefix) + middle + current.slice(current.length - entry.suffix);
    if (digestOf(result) !== (direction === "undo" ? entry.before : entry.after))
      throw new Fault(
        "HISTORY_INVALID",
        `The recorded ${direction} of ${entry.file} does not reproduce its digest.`,
        5
      );
    const before = await sourceInventory(ctx);
    await atomicWrite(file, result);
    const after = await sourceInventory(ctx);
    if (direction === "undo") {
      history.undo.pop();
      history.redo.push(entry);
    } else {
      history.redo.pop();
      history.undo.push(entry);
    }
    await save(ctx, history);
    return {
      [direction === "undo" ? "undone" : "redone"]: { id: entry.id, summary: entry.summary },
      file: entry.file,
      page: entry.page,
      beforeDigest: digestOf(current),
      afterDigest: digestOf(result),
      written: true,
      change: sourceChange(before, after, ctx.config.application.sourceDir),
      remaining: { undo: history.undo.length, redo: history.redo.length },
      next: "Local source only; a deployed application is not reverted. Validate or ship to deploy this state."
    };
  });
}
var undoEdit = (ctx) => step(ctx, "undo");
var redoEdit = (ctx) => step(ctx, "redo");

// packages/core/src/edit/columns.ts
var REPORTS = /* @__PURE__ */ new Set(["interactiveReport", "classicReport"]);
var NAME = /^[A-Z][A-Z0-9_$#]{0,127}$/u;
var DATA_TYPES_261 = {
  varchar2: "STRING",
  number: "NUMBER",
  date: "DATE",
  timestamp: "TIMESTAMP"
};
var word = (name) => new RegExp(`(^|[^A-Z0-9_$#])${name.replace(/[$#]/gu, "\\$&")}([^A-Z0-9_$#]|$)`, "iu");
var sequenceOf = (node, path4) => Number(node.properties.get(path4)?.value) || 0;
var bySequence = (nodes, path4) => [...nodes].sort((a, b) => sequenceOf(a, path4) - sequenceOf(b, path4) || a.open - b.open);
function reportRegion(region, operation) {
  const type = String(region.properties.get("type")?.value ?? "");
  if (!REPORTS.has(type))
    throw new Fault(
      "OPERATION_UNSUPPORTED",
      `${operation} is supported on interactive and classic reports, not ${type || "this region"}.`,
      2
    );
  return type;
}
var columnsOf = (region) => region.children.filter((child) => child.kind === "column");
var savedReports = (region) => region.children.filter((child) => child.kind === "savedReport");
function primaryReport(region) {
  const reports = savedReports(region);
  return reports.find(
    (report) => String(report.properties.get("visibility")?.value ?? "").startsWith("primary")
  ) ?? reports[0];
}
function queryNames(sql, names) {
  const missing = names.filter((name) => !word(name).test(sql));
  if (missing.length)
    throw new Fault("COLUMN_NOT_IN_QUERY", `The query does not name ${missing.join(", ")}.`, 2);
}
function checkNames(names) {
  if (names.some((name) => !NAME.test(name)) || new Set(names).size !== names.length)
    throw new Fault("INVALID_INPUT", "Column names must be unique Oracle identifiers.", 2);
}
function columnText(doc, region, column, sequence, release) {
  const dataType = column.dataType && (release === "26.1" ? DATA_TYPES_261[column.dataType] : column.dataType);
  const lines = [
    `column ${column.name.toUpperCase()} (`,
    "    type: plainText",
    "    heading {",
    `        heading: ${scalarText(column.heading ?? column.name)}`,
    "    }",
    "    layout {",
    `        sequence: ${sequence}`,
    "    }",
    ...column.format ? ["    appearance {", `        formatMask: ${scalarText(column.format)}`, "    }"] : [],
    ...dataType ? ["    source {", `        dataType: ${dataType}`, "    }"] : [],
    ")"
  ];
  const indent = " ".repeat(region.indent + 4);
  return lines.map((line) => indent + line).join(doc.eol) + doc.eol;
}
function afterColumns(doc, region, text2) {
  const last = columnsOf(region).at(-1);
  if (!last) {
    const line2 = doc.lines[savedReports(region)[0]?.open ?? region.close];
    return { start: line2.offset, end: line2.offset, content: text2 };
  }
  const line = doc.lines[last.close];
  const at = line.offset + line.text.length + line.eol.length;
  return { start: at, end: at, content: text2 };
}
function placeInOrder(doc, order, path4, step2) {
  const current = order.map((node) => node ? sequenceOf(node, path4) : void 0);
  const index = current.indexOf(void 0);
  const existing = current.filter((value) => value !== void 0);
  const increasing = existing.every((value, i) => i === 0 || value > existing[i - 1]);
  if (increasing && existing.every((value) => value > 0)) {
    if (index === -1) return { edits: [], sequence: 0 };
    const previous = index > 0 ? current[index - 1] : 0;
    const next = index < current.length - 1 ? current[index + 1] : void 0;
    if (next === void 0) return { edits: [], sequence: previous + step2 };
    if (next - previous >= 2) return { edits: [], sequence: Math.floor((previous + next) / 2) };
  }
  const edits = [];
  let sequence = 0;
  order.forEach((node, i) => {
    const value = (i + 1) * step2;
    if (!node) sequence = value;
    else if (sequenceOf(node, path4) !== value) edits.push(setProperty(doc, node, path4, String(value)));
  });
  return { edits, sequence };
}
function references(doc, report, name) {
  const found = [];
  for (const child of report.children) {
    if (child.kind === "displayColumn") continue;
    for (let line = child.open; line <= child.close; line++)
      if (word(name).test(doc.lines[line].text)) {
        found.push(`${child.kind} ${child.key}`.trim());
        break;
      }
  }
  return found;
}
function savedReportEdits(doc, region, dropped, added) {
  const edits = [];
  for (const report of savedReports(region))
    for (const name of dropped) {
      const used = references(doc, report, name);
      if (used.length)
        throw new Fault(
          "COLUMN_REFERENCED",
          `Saved report ${report.key} still uses ${name} in ${used.join(", ")}. Remove that use in source first.`,
          5
        );
      for (const display of report.children.filter(
        (child) => child.kind === "displayColumn" && child.key.toUpperCase() === name
      ))
        edits.push(removeComponent(doc, display));
    }
  const primary = primaryReport(region);
  if (!primary || !added.length) return edits;
  const displayed = bySequence(
    primary.children.filter(
      (child) => child.kind === "displayColumn" && !dropped.includes(child.key.toUpperCase())
    ),
    "sequence"
  );
  let order = [...displayed];
  const news = [];
  for (const column of added) {
    const at2 = column.before ? order.findIndex((node) => node?.key.toUpperCase() === column.before) : column.after ? order.findIndex((node) => node?.key.toUpperCase() === column.after) + 1 : order.length;
    order.splice(at2 < 0 ? order.length : at2, 0, void 0);
    news.push(column.name);
  }
  const holes = order.filter((node) => !node).length;
  let sequences;
  if (holes === 1) {
    const placed = placeInOrder(doc, order, "sequence", 1);
    edits.push(...placed.edits);
    sequences = [placed.sequence];
  } else {
    sequences = [];
    order.forEach((node, i) => {
      if (!node) sequences.push(i + 1);
      else if (sequenceOf(node, "sequence") !== i + 1)
        edits.push(setProperty(doc, node, "sequence", String(i + 1)));
    });
  }
  const indent = " ".repeat(primary.indent + 4);
  const text2 = news.map(
    (name, i) => [`displayColumn ${name} (`, `    sequence: ${sequences[i]}`, ")"].map((line) => indent + line).join(doc.eol) + doc.eol
  ).join("");
  const last = primary.children.filter((child) => child.kind === "displayColumn").at(-1);
  const anchor = last ? doc.lines[last.close] : doc.lines[primary.close];
  const at = last ? anchor.offset + anchor.text.length + anchor.eol.length : anchor.offset;
  edits.push({ start: at, end: at, content: text2 });
  return edits;
}
function planColumns(snapshot, operations) {
  const { doc, node: page, release } = snapshot;
  const edits = [];
  const checks = [];
  const seen = /* @__PURE__ */ new Set();
  for (const operation of operations) {
    const region = ApexLangDocument.one(page.children, "region", operation.region, `Page ${page.key}`);
    if (seen.has(region.key.toUpperCase()))
      throw new Fault("TRANSFORM_CONFLICT", `Two column operations change region ${operation.region}.`, 5);
    seen.add(region.key.toUpperCase());
    const type = reportRegion(region, operation.op);
    const columns = bySequence(columnsOf(region), "layout.sequence");
    const key = (name2) => name2.toUpperCase();
    const find = (name2) => name2 === void 0 ? void 0 : columns.findIndex((column) => column.key.toUpperCase() === key(name2));
    if (operation.op === "orderColumns") {
      const order2 = operation.order.map(key);
      checkNames(order2);
      const declared = columns.map((column) => column.key.toUpperCase());
      if (order2.length !== declared.length || order2.some((name2) => !declared.includes(name2)))
        throw new Fault(
          "INVALID_INPUT",
          `order must list every column of ${region.key} once: ${declared.join(", ")}.`,
          2
        );
      const nodes = order2.map((name2) => columns[find(name2)]);
      edits.push(...placeInOrder(doc, nodes, "layout.sequence", 10).edits);
      const visible = Object.fromEntries(
        Object.entries(operation.visible ?? {}).map(([name2, value]) => [key(name2), value])
      );
      for (const name2 of Object.keys(visible))
        if (!declared.includes(name2))
          throw new Fault("TARGET_NOT_FOUND", `No column ${name2} in ${region.key}.`, 2);
      const primary = type === "interactiveReport" ? primaryReport(region) : void 0;
      if (type === "classicReport" && Object.keys(visible).length)
        edits.push(
          ...visibilityEdits(
            doc,
            region,
            Object.entries(visible).map(([name2, value]) => ({
              column: nodes[order2.indexOf(name2)],
              visible: value
            }))
          )
        );
      if (type === "interactiveReport" && Object.keys(visible).length && !primary)
        throw new Fault(
          "OPERATION_UNSUPPORTED",
          `${region.key} has no default saved report; its displayed columns are not declared in source.`,
          2
        );
      if (primary) {
        for (const [name2, value] of Object.entries(visible))
          if (value && String(nodes[order2.indexOf(name2)].properties.get("type")?.value ?? "") === "hidden")
            throw new Fault(
              "OPERATION_UNSUPPORTED",
              `${region.key}.${name2} is declared type hidden, so users cannot show it; change its type in source.`,
              2
            );
        const displayed = primary.children.filter((child) => child.kind === "displayColumn");
        for (const node of displayed)
          if (visible[node.key.toUpperCase()] === false) edits.push(removeComponent(doc, node));
        const shown = order2.filter(
          (name2) => visible[name2] === void 0 ? displayed.some((node) => node.key.toUpperCase() === name2) : visible[name2]
        );
        const existing = (name2) => displayed.find((child) => child.key.toUpperCase() === name2);
        const added = shown.filter((name2) => !existing(name2));
        if (!added.length) {
          edits.push(
            ...placeInOrder(
              doc,
              shown.map((name2) => existing(name2)),
              "sequence",
              1
            ).edits
          );
        } else {
          shown.forEach((name2, index2) => {
            const node = existing(name2);
            if (node && sequenceOf(node, "sequence") !== index2 + 1)
              edits.push(setProperty(doc, node, "sequence", String(index2 + 1)));
          });
          const indent = " ".repeat(primary.indent + 4);
          const last = displayed.at(-1);
          const anchor2 = doc.lines[last ? last.close : primary.close];
          const at2 = last ? anchor2.offset + anchor2.text.length + anchor2.eol.length : anchor2.offset;
          edits.push({
            start: at2,
            end: at2,
            content: added.map(
              (name2) => [`displayColumn ${name2} (`, `    sequence: ${shown.indexOf(name2) + 1}`, ")"].map((line) => indent + line).join(doc.eol) + doc.eol
            ).join("")
          });
        }
      }
      checks.push((after) => {
        const parsed = after.children.find(
          (c) => c.type === "region" && c.id.toUpperCase() === region.key.toUpperCase()
        );
        const now = (parsed?.children ?? []).filter((c) => c.type === "column").sort(
          (a, b) => Number(readProperty(a, "layout.sequence")) - Number(readProperty(b, "layout.sequence"))
        ).map((c) => c.id.toUpperCase());
        if (JSON.stringify(now) !== JSON.stringify(order2))
          throw new Fault(
            "TRANSFORM_INVALID",
            `${region.key} columns did not read back in the requested order.`,
            5
          );
      });
      continue;
    }
    const name = key(operation.column.name);
    checkNames([name]);
    if (find(name) !== -1)
      throw new Fault("TARGET_EXISTS", `Column ${name} already exists in ${region.key}.`, 5);
    if (operation.after && operation.before)
      throw new Fault("INVALID_INPUT", "Give after or before, not both.", 2);
    const anchor = operation.after ?? operation.before;
    const at = find(anchor);
    if (anchor !== void 0 && at === -1)
      throw new Fault("TARGET_NOT_FOUND", `No column ${anchor} in ${region.key}.`, 2);
    queryNames(operation.sql, [...columns.map((column) => column.key.toUpperCase()), name]);
    const index = at === void 0 ? columns.length : operation.after ? at + 1 : at;
    const order = [...columns];
    order.splice(index, 0, void 0);
    const placed = placeInOrder(doc, order, "layout.sequence", 10);
    edits.push(setFencedText(doc, region, "source.sqlQuery", operation.sql), ...placed.edits);
    edits.push(
      afterColumns(doc, region, columnText(doc, region, operation.column, placed.sequence, release))
    );
    if (type === "interactiveReport") {
      const primary = primaryReport(region);
      const displayed = new Set(
        (primary?.children ?? []).filter((c) => c.kind === "displayColumn").map((c) => c.key.toUpperCase())
      );
      const before = columns.slice(0, index).reverse().find((column) => displayed.has(column.key.toUpperCase()));
      const next = columns.slice(index).find((column) => displayed.has(column.key.toUpperCase()));
      edits.push(
        ...savedReportEdits(
          doc,
          region,
          [],
          [before ? { name, after: before.key.toUpperCase() } : { name, before: next?.key.toUpperCase() }]
        )
      );
    }
    const expected = order.map((node) => node ? node.key.toUpperCase() : name);
    checks.push((after) => {
      const parsed = after.children.find(
        (c) => c.type === "region" && c.id.toUpperCase() === region.key.toUpperCase()
      );
      const now = (parsed?.children ?? []).filter((c) => c.type === "column").sort(
        (a, b) => Number(readProperty(a, "layout.sequence")) - Number(readProperty(b, "layout.sequence"))
      ).map((c) => c.id.toUpperCase());
      if (JSON.stringify(now) !== JSON.stringify(expected) || String(readProperty(parsed, "source.sqlQuery") ?? "").trim() !== operation.sql.trim())
        throw new Fault("TRANSFORM_INVALID", `${region.key} query or column order did not read back.`, 5);
    });
  }
  return {
    edits,
    verify: (after) => checks.forEach((check) => check(after)),
    targets: operations.map((operation) => `region:${operation.region}`)
  };
}
function columnVisible(region, column) {
  const declared = region.children.find(
    (c) => c.type === "column" && c.id.toUpperCase() === column.toUpperCase()
  );
  if (!declared || declared.props.type === "hidden") return false;
  if (region.props.type !== "interactiveReport") return true;
  const reports = region.children.filter((c) => c.type === "savedReport");
  const primary = reports.find((report) => String(report.props.visibility ?? "").startsWith("primary")) ?? reports[0];
  if (!primary) return true;
  return primary.children.some(
    (c) => c.type === "displayColumn" && c.id.toUpperCase() === column.toUpperCase()
  );
}
function visibilityEdits(doc, region, changes) {
  const type = reportRegion(region, "visible");
  const edits = [];
  if (type === "classicReport") {
    for (const { column, visible } of changes) {
      const columnType = String(column.properties.get("type")?.value ?? "");
      if (visible) {
        if (columnType === "hidden") edits.push(setProperty(doc, column, "type", "plainText"));
        continue;
      }
      if (columnType === "hidden") continue;
      if (columnType && columnType !== "plainText")
        throw new Fault(
          "OPERATION_UNSUPPORTED",
          `${region.key}.${column.key} is a ${columnType} column; hiding it would drop that type. Edit it in source.`,
          2
        );
      edits.push(setProperty(doc, column, "type", "hidden"));
    }
    return edits;
  }
  for (const { column } of changes)
    if (String(column.properties.get("type")?.value ?? "") === "hidden")
      throw new Fault(
        "OPERATION_UNSUPPORTED",
        `${region.key}.${column.key} is declared type hidden, so users cannot show it; change its type in source.`,
        2
      );
  const primary = primaryReport(region);
  if (!primary)
    throw new Fault(
      "OPERATION_UNSUPPORTED",
      `${region.key} has no default saved report; its displayed columns are not declared in source.`,
      2
    );
  const hide = new Set(changes.filter((c) => !c.visible).map((c) => c.column.key.toUpperCase()));
  const displayed = bySequence(
    primary.children.filter((c) => c.kind === "displayColumn"),
    "sequence"
  );
  for (const node of displayed) if (hide.has(node.key.toUpperCase())) edits.push(removeComponent(doc, node));
  const order = displayed.filter((node) => !hide.has(node.key.toUpperCase()));
  const has = (name) => order.some((entry) => (typeof entry === "string" ? entry : entry.key.toUpperCase()) === name);
  const columns = bySequence(columnsOf(region), "layout.sequence").map((c) => c.key.toUpperCase());
  for (const { column, visible } of changes) {
    const name = column.key.toUpperCase();
    if (!visible || has(name)) continue;
    const index = columns.indexOf(name);
    const before = columns.slice(0, index).reverse().find(has);
    const at2 = before ? order.findIndex((entry) => (typeof entry === "string" ? entry : entry.key.toUpperCase()) === before) + 1 : 0;
    order.splice(at2, 0, name);
  }
  const news = order.filter((entry) => typeof entry === "string");
  if (!news.length) return edits;
  const sequences = /* @__PURE__ */ new Map();
  const kept = order.map((entry) => typeof entry === "string" ? void 0 : entry);
  if (news.length === 1) {
    const placed = placeInOrder(doc, kept, "sequence", 1);
    edits.push(...placed.edits);
    sequences.set(news[0], placed.sequence);
  } else
    order.forEach((entry, i) => {
      if (typeof entry === "string") sequences.set(entry, i + 1);
      else if (sequenceOf(entry, "sequence") !== i + 1)
        edits.push(setProperty(doc, entry, "sequence", String(i + 1)));
    });
  const indent = " ".repeat(primary.indent + 4);
  const text2 = news.map(
    (name) => [`displayColumn ${name} (`, `    sequence: ${sequences.get(name)}`, ")"].map((line) => indent + line).join(doc.eol) + doc.eol
  ).join("");
  const last = primary.children.filter((child) => child.kind === "displayColumn").at(-1);
  const anchor = doc.lines[last ? last.close : primary.close];
  const at = last ? anchor.offset + anchor.text.length + anchor.eol.length : anchor.offset;
  edits.push({ start: at, end: at, content: text2 });
  return edits;
}

// packages/core/src/edit/context.ts
var REPORTS2 = /* @__PURE__ */ new Set(["interactiveReport", "classicReport"]);
var DELTA_QUERY_CHARS = 2e3;
var DELTA_ENTRIES = 40;
var text = (component, dotted) => {
  const value = readProperty(component, dotted);
  return typeof value === "string" && value ? value : void 0;
};
var compact = (value) => Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0 && entry !== ""));
function columnEntries(region) {
  return region.children.filter((c) => c.type === "column").map((column) => ({
    ...compact({
      target: `column:${region.id}.${column.id}`,
      heading: text(column, "heading.heading"),
      format: text(column, "appearance.formatMask"),
      sequence: text(column, "layout.sequence")
    }),
    visible: columnVisible(region, column.id)
  }));
}
function contextOf(source, file) {
  const parsed = parseApexLang(source, file).find((c) => c.type === "page");
  if (!parsed) throw new Fault("TARGET_NOT_FOUND", `No page in ${file}.`, 2);
  return {
    file,
    digest: digestOf(source),
    page: compact({ id: parsed.id, name: text(parsed, "name"), title: text(parsed, "title") }),
    regions: parsed.children.filter((c) => c.type === "region").map(
      (region) => compact({
        target: `region:${region.id}`,
        type: text(region, "type"),
        title: text(region, "name"),
        sequence: text(region, "layout.sequence"),
        line: region.line,
        query: REPORTS2.has(String(text(region, "type"))) ? text(region, "source.sqlQuery") : void 0,
        columns: columnEntries(region)
      })
    ),
    items: parsed.children.filter((c) => c.type === "pageItem").map(
      (item) => compact({
        target: `item:${item.id}`,
        type: text(item, "type"),
        label: text(item, "label.label"),
        line: item.line
      })
    ),
    buttons: parsed.children.filter((c) => c.type === "button").map(
      (button) => compact({ target: `button:${button.id}`, label: text(button, "label"), line: button.line })
    ),
    next: "Change titles, labels, headings, formats, sequences or a report query with project patch or edit and this digest."
  };
}
function flatten(context) {
  const entries = /* @__PURE__ */ new Map();
  entries.set("page", { target: "page", ...context.page });
  for (const { columns, ...region } of context.regions) {
    entries.set(region.target, { ...region, columns: columns.map((c) => c.target) });
    for (const column of columns) entries.set(column.target, column);
  }
  for (const item of context.items) entries.set(item.target, item);
  for (const button of context.buttons) entries.set(button.target, button);
  return entries;
}
var comparable = ({ line: _line, ...entry }) => JSON.stringify(entry);
function contextDelta(before, after, file) {
  const old = flatten(contextOf(before, file));
  const now = flatten(contextOf(after, file));
  const changed = [];
  const inserted = [];
  for (const [target, entry] of now) {
    const previous = old.get(target);
    if (!previous) inserted.push(entry);
    else if (comparable(previous) !== comparable(entry)) changed.push(entry);
  }
  const removed = [...old.keys()].filter((target) => !now.has(target));
  const bound = (entry) => typeof entry.query === "string" && entry.query.length > DELTA_QUERY_CHARS ? { ...entry, query: entry.query.slice(0, DELTA_QUERY_CHARS), queryTruncated: true } : entry;
  const listed = [...changed, ...inserted].slice(0, DELTA_ENTRIES);
  const omitted = changed.length + inserted.length - listed.length;
  return {
    digest: digestOf(after),
    changed: changed.filter((entry) => listed.includes(entry)).map(bound),
    inserted: inserted.filter((entry) => listed.includes(entry)).map(bound),
    removed,
    ...omitted ? { omitted } : {},
    next: omitted ? "Delta is bounded; use project action:context for the whole page." : "Edit again with this digest and these targets."
  };
}

// packages/core/src/edit/transaction.ts
function combine(plans) {
  const edits = [];
  for (const plan of plans)
    for (const edit of plan.edits) {
      const same = edit.start === edit.end && edits.find((other) => other.start === edit.start && other.end === edit.start);
      if (same) same.content += edit.content;
      else edits.push({ ...edit });
    }
  return edits;
}
function snapshotOf(source, pageId, release = "26.2", related = /* @__PURE__ */ new Map()) {
  const doc = new ApexLangDocument(source);
  const node = ApexLangDocument.one(doc.roots, "page", pageId, "The file");
  const parsed = parseApexLang(source, "page").find((c) => c.type === "page" && c.id === node.key);
  if (!parsed) throw new Fault("TARGET_NOT_FOUND", `No page ${pageId} in its file.`, 2);
  return { source, pageId, release, doc, node, parsed, related };
}
function transformPage(source, pageId, groups, release = "26.2", related = /* @__PURE__ */ new Map()) {
  const snapshot = snapshotOf(source, pageId, release, related);
  const plans = groups.map((plan) => plan(snapshot));
  const edits = combine(plans);
  const result = applyEdits(source, edits);
  let after;
  try {
    after = parseApexLang(result, "edit").find((c) => c.type === "page" && c.id === snapshot.node.key);
  } catch (error) {
    throw new Fault("TRANSFORM_INVALID", `The edited page does not parse: ${error.message}`, 5);
  }
  new ApexLangDocument(result);
  if (!after) throw new Fault("TRANSFORM_INVALID", `Page ${pageId} did not read back.`, 5);
  for (const plan of plans) plan.verify(after);
  return {
    result,
    edits: edits.length,
    targets: [...new Set(plans.flatMap((plan) => plan.targets ?? []))],
    warnings: [...new Set(plans.flatMap((plan) => plan.warnings ?? []))]
  };
}
async function runPageTransaction(ctx, input, groups, dependencies = () => []) {
  if (!/^\d{1,5}$/u.test(input.page)) throw new Fault("INVALID_INPUT", "page is a page number.", 2);
  if (!input.operations.length || input.operations.length > 50)
    throw new Fault("INVALID_INPUT", "Give 1-50 operations.", 2);
  const pageId = String(Number(input.page));
  const file = await pageFile(ctx, pageId);
  const relative = path3.relative(ctx.root, file).split(path3.sep).join("/");
  const found = await sourceRelease(await contained(ctx.root, ctx.config.application.sourceDir));
  const release = found === "26.1" ? "26.1" : "26.2";
  const plan = async () => {
    const source = await readFile3(file, "utf8");
    const related = /* @__PURE__ */ new Map();
    for (const key of new Set(dependencies(input.operations))) {
      const found2 = await loadRelated(ctx, key);
      if (found2) related.set(key, found2);
    }
    return {
      source,
      digest: digestOf(source),
      ...transformPage(source, pageId, groups(input.operations), release, related)
    };
  };
  const described = (source, result) => {
    const mode = input.context ?? "delta";
    if (mode === "none") return {};
    return {
      context: mode === "full" ? contextOf(result, relative) : contextDelta(source, result, relative)
    };
  };
  const outcome = await guardedEdit(ctx, {
    file,
    relative,
    ...input,
    plan,
    onWritten: (planned2) => recordEdit(ctx, {
      file: relative,
      page: pageId,
      summary: planned2.targets.length ? planned2.targets.join(", ") : `${input.operations.length} operations`,
      before: planned2.source,
      after: planned2.result
    })
  });
  const { planned } = outcome;
  return {
    file: relative,
    page: input.page,
    beforeDigest: planned.digest,
    afterDigest: digestOf(planned.result),
    written: outcome.written,
    operations: input.operations.length,
    ...outcome.change ? { change: outcome.change } : {},
    ...described(planned.source, planned.result),
    result: planned.result,
    targets: planned.targets,
    ...planned.warnings.length ? { warnings: planned.warnings } : {},
    next: outcome.written ? "Source edited only. Validate or ship to check it with the compiler and import it." : `Apply with expectedDigest ${planned.digest}.`
  };
}
async function loadRelated(ctx, key) {
  const [kind, id = ""] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  let file;
  if (kind === "page") file = await pageFile(ctx, String(Number(id))).catch(() => void 0);
  else if (kind === "lov") file = await (await import("./chunk-SX34A4YD.mjs")).lovFile(ctx, id).catch(() => void 0);
  if (!file) return void 0;
  const text2 = await readFile3(file, "utf8");
  const parsed = parseApexLang(text2, "related").find(
    (c) => c.type === kind && (kind === "page" || c.id.toUpperCase() === id.toUpperCase() || String(c.props.name ?? "").toUpperCase() === id.toUpperCase())
  );
  if (!parsed) return void 0;
  return { file: path3.relative(ctx.root, file).split(path3.sep).join("/"), digest: digestOf(text2), parsed };
}
async function guardedEdit(ctx, input) {
  const { file, relative } = input;
  if (input.dryRun || !input.expectedDigest) {
    const planned = await input.plan();
    if (!input.dryRun)
      throw new Fault(
        "EXPECTED_DIGEST_REQUIRED",
        `Pass expectedDigest ${planned.digest} (the ${relative} you read) to apply the edit.`,
        2,
        "blocked",
        { file: relative, currentDigest: planned.digest }
      );
    return { planned, written: false };
  }
  return withLock(path3.join(ctx.root, ".apexrest", "source-edit.lock"), async () => {
    const before = await sourceInventory(ctx);
    const planned = await input.plan();
    if (planned.digest !== input.expectedDigest)
      throw new Fault(
        "TRANSFORM_CONFLICT",
        `${relative} changed since it was read; read it again and retry.`,
        5,
        "conflict",
        { file: relative, currentDigest: planned.digest }
      );
    await atomicWrite(file, planned.result);
    await input.onWritten?.(planned);
    const after = await sourceInventory(ctx);
    return { planned, written: true, change: sourceChange(before, after, ctx.config.application.sourceDir) };
  });
}

export {
  pageFile,
  digestOf,
  ApexLangDocument,
  scalarText,
  setProperty,
  referenceText,
  setPropertyText,
  removeProperty,
  applyEdits,
  setFencedText,
  removeComponent,
  appendChild,
  readProperty,
  reportRegion,
  columnsOf,
  queryNames,
  checkNames,
  columnText,
  afterColumns,
  savedReportEdits,
  planColumns,
  columnVisible,
  visibilityEdits,
  contextOf,
  editHistory,
  undoEdit,
  redoEdit,
  runPageTransaction,
  guardedEdit
};
