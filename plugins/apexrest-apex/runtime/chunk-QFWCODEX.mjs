import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  ApexLangDocument,
  contextOf,
  pageFile,
  readProperty,
  removeComponent,
  runPageTransaction,
  scalarText,
  setFencedText,
  setProperty
} from "./chunk-7SOP6TER.mjs";
import {
  Fault
} from "./chunk-HRRL6FHO.mjs";

// packages/core/src/edit/patch.ts
import path from "node:path";
import { readFile } from "node:fs/promises";

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
var sequenceOf = (node, path2) => Number(node.properties.get(path2)?.value) || 0;
var bySequence = (nodes, path2) => [...nodes].sort((a, b) => sequenceOf(a, path2) - sequenceOf(b, path2) || a.open - b.open);
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
function afterColumns(doc, region, text) {
  const last = columnsOf(region).at(-1);
  if (!last) {
    const line2 = doc.lines[savedReports(region)[0]?.open ?? region.close];
    return { start: line2.offset, end: line2.offset, content: text };
  }
  const line = doc.lines[last.close];
  const at = line.offset + line.text.length + line.eol.length;
  return { start: at, end: at, content: text };
}
function placeInOrder(doc, order, path2, step) {
  const current = order.map((node) => node ? sequenceOf(node, path2) : void 0);
  const index = current.indexOf(void 0);
  const existing = current.filter((value) => value !== void 0);
  const increasing = existing.every((value, i) => i === 0 || value > existing[i - 1]);
  if (increasing && existing.every((value) => value > 0)) {
    if (index === -1) return { edits: [], sequence: 0 };
    const previous = index > 0 ? current[index - 1] : 0;
    const next = index < current.length - 1 ? current[index + 1] : void 0;
    if (next === void 0) return { edits: [], sequence: previous + step };
    if (next - previous >= 2) return { edits: [], sequence: Math.floor((previous + next) / 2) };
  }
  const edits = [];
  let sequence = 0;
  order.forEach((node, i) => {
    const value = (i + 1) * step;
    if (!node) sequence = value;
    else if (sequenceOf(node, path2) !== value) edits.push(setProperty(doc, node, path2, String(value)));
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
  const text = news.map(
    (name, i) => [`displayColumn ${name} (`, `    sequence: ${sequences[i]}`, ")"].map((line) => indent + line).join(doc.eol) + doc.eol
  ).join("");
  const last = primary.children.filter((child) => child.kind === "displayColumn").at(-1);
  const anchor = last ? doc.lines[last.close] : doc.lines[primary.close];
  const at = last ? anchor.offset + anchor.text.length + anchor.eol.length : anchor.offset;
  edits.push({ start: at, end: at, content: text });
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
      const primary = type === "interactiveReport" ? primaryReport(region) : void 0;
      if (primary) {
        const displayed = primary.children.filter((child) => child.kind === "displayColumn");
        const shown = order2.map((name2) => displayed.find((child) => child.key.toUpperCase() === name2)).filter((node) => Boolean(node));
        edits.push(...placeInOrder(doc, shown, "sequence", 1).edits);
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

// packages/core/src/edit/patch.ts
var PATCH_PROPERTIES = ["title", "label", "heading", "format", "sequence", "query"];
var PATHS = {
  page: { title: "title" },
  region: { title: "name", sequence: "layout.sequence", query: "source.sqlQuery" },
  pageItem: { label: "label.label", sequence: "layout.sequence" },
  button: { label: "label", sequence: "layout.sequence" },
  column: { heading: "heading.heading", format: "appearance.formatMask", sequence: "layout.sequence" }
};
var KINDS = {
  region: "region",
  item: "pageItem",
  button: "button",
  column: "column"
};
function resolve(page, operation) {
  const where = `Page ${page.key}`;
  const [kindToken, rest = ""] = operation.target.includes(":") ? [
    operation.target.slice(0, operation.target.indexOf(":")),
    operation.target.slice(operation.target.indexOf(":") + 1)
  ] : [operation.target, ""];
  let node;
  let find;
  if (kindToken === "page" && !rest) {
    node = page;
    find = (parsed) => parsed;
  } else if (kindToken === "column") {
    const [region, column] = rest.split(".");
    if (!region || !column) throw new Fault("INVALID_INPUT", "Column targets are column:REGION.COLUMN.", 2);
    const owner = ApexLangDocument.one(page.children, "region", region, where);
    node = ApexLangDocument.one(owner.children, "column", column, `Region ${owner.key}`);
    find = (parsed) => parsed.children.find((c) => c.type === "region" && c.id.toUpperCase() === owner.key.toUpperCase())?.children.find((c) => c.type === "column" && c.id.toUpperCase() === node.key.toUpperCase());
  } else if (KINDS[kindToken] && rest) {
    node = ApexLangDocument.one(page.children, KINDS[kindToken], rest, where);
    find = (parsed) => parsed.children.find((c) => c.type === node.kind && c.id.toUpperCase() === node.key.toUpperCase());
  } else
    throw new Fault(
      "INVALID_INPUT",
      `Unknown target ${operation.target}; use page, region:ID, item:NAME, button:ID or column:REGION.COLUMN.`,
      2
    );
  const pathFor = PATHS[node.kind]?.[operation.property];
  if (!pathFor)
    throw new Fault(
      "OPERATION_UNSUPPORTED",
      `${operation.property} is not supported on ${node.kind}; supported: ${Object.keys(PATHS[node.kind] ?? {}).join(", ")}.`,
      2
    );
  if (operation.property === "sequence" && !/^[1-9]\d{0,8}$/u.test(operation.value))
    throw new Fault("INVALID_INPUT", "sequence must be a positive integer.", 2);
  return { node, path: pathFor, find };
}
function planSets(snapshot, operations) {
  const { doc, node: page } = snapshot;
  const resolved = operations.map((operation) => ({ operation, ...resolve(page, operation) }));
  const seen = /* @__PURE__ */ new Set();
  for (const entry of resolved) {
    const key = `${entry.node.open}:${entry.path}`;
    if (seen.has(key))
      throw new Fault("TRANSFORM_CONFLICT", `Two operations set ${entry.path} of the same component.`, 5);
    seen.add(key);
  }
  const edits = [];
  for (const entry of resolved) {
    if (entry.operation.property === "query")
      edits.push(...queryEdits(doc, entry.node, entry.operation, snapshot.release));
    else edits.push(setProperty(doc, entry.node, entry.path, entry.operation.value));
  }
  const verify = (parsedPage) => {
    for (const entry of resolved) {
      const component = entry.find(parsedPage);
      const value = component && readProperty(component, entry.path);
      if (entry.operation.property === "query") {
        const names = component?.children.filter((child) => child.type === "column").map((child) => child.id.toUpperCase());
        const expected = (entry.operation.columns ?? []).map((column) => column.name.toUpperCase());
        if (String(value ?? "").trim() !== entry.operation.value.trim() || JSON.stringify(names) !== JSON.stringify(expected))
          throw new Fault(
            "TRANSFORM_INVALID",
            `${entry.operation.target} query or columns did not read back.`,
            5
          );
        continue;
      }
      if (value !== entry.operation.value)
        throw new Fault(
          "TRANSFORM_INVALID",
          `${entry.operation.target} ${entry.operation.property} did not read back.`,
          5
        );
    }
  };
  return { edits, verify, targets: resolved.map((entry) => entry.operation.target) };
}
function queryEdits(doc, region, operation, release = "26.2") {
  const type = reportRegion(region, "query");
  const columns = operation.columns ?? [];
  if (!columns.length) throw new Fault("INVALID_INPUT", "query needs the complete columns contract.", 2);
  const names = columns.map((column) => column.name.toUpperCase());
  checkNames(names);
  queryNames(operation.value, names);
  const edits = [setFencedText(doc, region, "source.sqlQuery", operation.value)];
  const existing = columnsOf(region);
  const dropped = existing.map((column) => column.key.toUpperCase()).filter((name) => !names.includes(name));
  for (const column of existing)
    if (dropped.includes(column.key.toUpperCase())) edits.push(removeComponent(doc, column));
  let sequence = Math.max(
    0,
    ...existing.map((column) => Number(column.properties.get("layout.sequence")?.value) || 0)
  );
  let added = "";
  const news = [];
  for (const column of columns) {
    const kept = existing.find((entry) => entry.key.toUpperCase() === column.name.toUpperCase());
    if (kept) {
      if (column.heading !== void 0) edits.push(setProperty(doc, kept, "heading.heading", column.heading));
      continue;
    }
    sequence += 10;
    added += columnText(doc, region, column, sequence, release);
    news.push(column.name.toUpperCase());
  }
  if (added) edits.push(afterColumns(doc, region, added));
  if (type === "interactiveReport")
    edits.push(
      ...savedReportEdits(
        doc,
        region,
        dropped,
        news.map((name) => ({ name }))
      )
    );
  return edits;
}
async function pageContext(ctx, page) {
  if (!/^\d{1,5}$/u.test(page)) throw new Fault("INVALID_INPUT", "page is a page number.", 2);
  const file = await pageFile(ctx, String(Number(page)));
  return contextOf(await readFile(file, "utf8"), path.relative(ctx.root, file).split(path.sep).join("/"));
}
async function patchPage(ctx, input) {
  const {
    result: _text,
    targets: _targets,
    ...outcome
  } = await runPageTransaction(ctx, input, (operations) => [(snapshot) => planSets(snapshot, operations)]);
  return outcome;
}

export {
  reportRegion,
  planColumns,
  PATCH_PROPERTIES,
  planSets,
  queryEdits,
  pageContext,
  patchPage
};
