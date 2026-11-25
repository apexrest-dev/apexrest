import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  ApexLangDocument,
  afterColumns,
  checkNames,
  columnText,
  columnVisible,
  columnsOf,
  contextOf,
  pageFile,
  queryNames,
  readProperty,
  removeComponent,
  reportRegion,
  runPageTransaction,
  savedReportEdits,
  setFencedText,
  setProperty,
  visibilityEdits
} from "./chunk-33ZG6DXL.mjs";
import {
  Fault
} from "./chunk-HRRL6FHO.mjs";

// packages/core/src/edit/patch.ts
import path from "node:path";
import { readFile } from "node:fs/promises";
var PATCH_PROPERTIES = [
  "title",
  "label",
  "heading",
  "format",
  "sequence",
  "query",
  "visible"
];
var PATHS = {
  page: { title: "title" },
  region: { title: "name", sequence: "layout.sequence", query: "source.sqlQuery" },
  pageItem: { label: "label.label", sequence: "layout.sequence" },
  button: { label: "label", sequence: "layout.sequence" },
  column: {
    heading: "heading.heading",
    format: "appearance.formatMask",
    sequence: "layout.sequence",
    visible: "visible"
  }
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
  if (operation.property === "visible" && !["true", "false"].includes(operation.value))
    throw new Fault("INVALID_INPUT", 'visible is "true" or "false".', 2);
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
  const visibility = /* @__PURE__ */ new Map();
  for (const entry of resolved) {
    if (entry.operation.property === "query")
      edits.push(...queryEdits(doc, entry.node, entry.operation, snapshot.release));
    else if (entry.operation.property === "visible") {
      const region = entry.node.parent;
      visibility.set(region, [
        ...visibility.get(region) ?? [],
        { column: entry.node, visible: entry.operation.value === "true" }
      ]);
    } else edits.push(setProperty(doc, entry.node, entry.path, entry.operation.value));
  }
  for (const [region, changes] of visibility) edits.push(...visibilityEdits(doc, region, changes));
  const verify = (parsedPage) => {
    for (const entry of resolved) {
      const component = entry.find(parsedPage);
      const value = component && readProperty(component, entry.path);
      if (entry.operation.property === "visible") {
        const region = parsedPage.children.find(
          (c) => c.type === "region" && c.id.toUpperCase() === entry.node.parent.key.toUpperCase()
        );
        if (!region || columnVisible(region, entry.node.key) !== (entry.operation.value === "true"))
          throw new Fault("TRANSFORM_INVALID", `${entry.operation.target} visibility did not read back.`, 5);
        continue;
      }
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
  PATCH_PROPERTIES,
  planSets,
  queryEdits,
  pageContext,
  patchPage
};
