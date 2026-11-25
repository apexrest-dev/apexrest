import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  ApexLangDocument,
  applyEdits,
  digestOf,
  guardedEdit,
  readProperty,
  removeComponent,
  scalarText,
  setFencedText,
  setProperty
} from "./chunk-UNMHXRBU.mjs";
import {
  parseApexLang
} from "./chunk-OA3W7BIM.mjs";
import {
  sourceRelease
} from "./chunk-2DFWP5Y4.mjs";
import {
  contained,
  exists
} from "./chunk-RW7D7AJD.mjs";
import {
  Fault
} from "./chunk-OWILYJ3V.mjs";

// packages/core/src/edit/lov.ts
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
var slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 60) || "entry";
async function lovFiles(app, release) {
  if (release === "26.1") {
    const file = "shared-components/lovs.apx";
    return await exists(path.join(app, file)) ? [file] : [];
  }
  if (release !== "26.2")
    throw new Fault(
      "LAYOUT_UNSUPPORTED",
      "Shared LOV editing needs an Oracle-generated 26.1 or 26.2 application.",
      2
    );
  const dir = path.join(app, "shared-components/lovs");
  if (!await exists(dir)) return [];
  return (await readdir(dir)).filter((name) => name.endsWith(".apx")).sort().map((name) => `shared-components/lovs/${name}`);
}
async function locate(ctx, key) {
  const app = await contained(ctx.root, ctx.config.application.sourceDir);
  const release = await sourceRelease(app);
  const matches = [];
  for (const name of await lovFiles(app, release)) {
    const file = path.join(app, name);
    const source = await readFile(file, "utf8");
    if (!/^\s*lov\s/mu.test(source)) continue;
    const doc = new ApexLangDocument(source);
    const lovs = doc.roots.filter((root) => root.kind === "lov");
    if (release === "26.2" && lovs.length > 1)
      throw new Fault(
        "LAYOUT_UNSUPPORTED",
        `${name} declares ${lovs.length} LOVs; 26.2 keeps one per file.`,
        2
      );
    for (const node of lovs) {
      const named = String(node.properties.get("name")?.value ?? "").replace(/^"|"$/gu, "");
      if (node.key.toUpperCase() === key.toUpperCase() || named.toUpperCase() === key.toUpperCase())
        matches.push({
          app,
          file,
          relative: path.relative(ctx.root, file).split(path.sep).join("/"),
          source,
          doc,
          node
        });
    }
  }
  if (matches.length !== 1)
    throw new Fault(
      matches.length ? "TARGET_AMBIGUOUS" : "TARGET_NOT_FOUND",
      matches.length ? `Several shared LOVs match ${key}.` : `No shared LOV ${key}.`,
      matches.length ? 5 : 2
    );
  return matches[0];
}
async function consumers(app, id) {
  const dir = path.join(app, "pages");
  if (!await exists(dir)) return [];
  const pattern = new RegExp(`^\\s*lov:\\s*@${id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*$`, "mu");
  const pages = [];
  for (const name of (await readdir(dir)).filter((file) => file.endsWith(".apx")).sort()) {
    const page = /^p(\d{1,5})/u.exec(name);
    if (page && pattern.test(await readFile(path.join(dir, name), "utf8")))
      pages.push(String(Number(page[1])));
  }
  return pages;
}
function describe(located) {
  const parsed = parseApexLang(located.source, located.relative).find(
    (c) => c.type === "lov" && c.id === located.node.key
  );
  const text = (dotted) => {
    const value = readProperty(parsed, dotted);
    return typeof value === "string" && value ? value : void 0;
  };
  const entries = parsed.children.filter((c) => c.type === "entry").map((entry) => ({
    id: entry.id,
    sequence: Number(readProperty(entry, "sequence")) || 0,
    display: String(readProperty(entry, "display") ?? ""),
    return: String(readProperty(entry, "return") ?? "")
  })).sort((a, b) => a.sequence - b.sequence);
  return {
    id: parsed.id,
    name: text("name"),
    location: text("source.location"),
    type: text("source.type"),
    ...entries.length ? { entries } : {},
    ...text("source.sqlQuery") ? { query: text("source.sqlQuery") } : {},
    ...text("columnMapping.display") ? { display: text("columnMapping.display") } : {},
    ...text("columnMapping.return") ? { return: text("columnMapping.return") } : {}
  };
}
async function lovFile(ctx, key) {
  return (await locate(ctx, key)).file;
}
async function lovContext(ctx, key) {
  const located = await locate(ctx, key);
  return {
    file: located.relative,
    digest: digestOf(located.source),
    lov: describe(located),
    consumers: await consumers(located.app, located.node.key),
    scope: "sharedComponent",
    next: "Edit with project action:lov_edit and this digest."
  };
}
function plan(located, input) {
  const { doc, node } = located;
  if (Boolean(input.entries) === Boolean(input.query))
    throw new Fault("INVALID_INPUT", "Give entries (static LOV) or query (SQL LOV).", 2);
  const location = String(node.properties.get("source.location")?.value ?? "");
  const edits = [];
  if (input.entries) {
    if (location !== "staticValues")
      throw new Fault("OPERATION_UNSUPPORTED", `${node.key} is not a static LOV (${location}).`, 2);
    if (!input.entries.length || input.entries.length > 500)
      throw new Fault("INVALID_INPUT", "Give 1-500 entries.", 2);
    const returns = input.entries.map((entry) => entry.return);
    if (new Set(returns).size !== returns.length)
      throw new Fault("INVALID_INPUT", "Entry return values must be unique.", 2);
    const existing = node.children.filter((child) => child.kind === "entry");
    if (node.children.some((child) => child.kind !== "entry"))
      throw new Fault(
        "OPERATION_UNSUPPORTED",
        `${node.key} has components other than entries; edit it in source.`,
        2
      );
    const returnOf = (entry) => String(entry.properties.get("return")?.value ?? "");
    const ids = new Set(existing.map((entry) => entry.key.toLowerCase()));
    let added = "";
    input.entries.forEach((entry, index) => {
      const sequence = String(index + 1);
      const kept = existing.find((current) => unquote(returnOf(current)) === entry.return);
      if (kept) {
        if (unquote(String(kept.properties.get("display")?.value ?? "")) !== entry.display)
          edits.push(setProperty(doc, kept, "display", entry.display));
        if (String(kept.properties.get("sequence")?.value ?? "") !== sequence)
          edits.push(setProperty(doc, kept, "sequence", sequence));
        return;
      }
      let id = slug(entry.return);
      for (let n = 2; ids.has(id); n++) id = `${slug(entry.return)}-${n}`;
      ids.add(id);
      const indent = " ".repeat(node.indent + 4);
      added += [
        `entry ${id} (`,
        `    sequence: ${sequence}`,
        `    display: ${scalarText(entry.display)}`,
        `    return: ${scalarText(entry.return)}`,
        ")"
      ].map((line) => indent + line).join(doc.eol) + doc.eol;
    });
    for (const entry of existing)
      if (!returns.includes(unquote(returnOf(entry)))) edits.push(removeComponent(doc, entry));
    if (added) {
      const last = existing.at(-1);
      const line = doc.lines[last ? last.close : node.close];
      const at = last ? line.offset + line.text.length + line.eol.length : line.offset;
      edits.push({ start: at, end: at, content: added });
    }
  } else {
    const query = input.query;
    if (location !== "localDatabase" || String(node.properties.get("source.type")?.value) !== "sqlQuery")
      throw new Fault("OPERATION_UNSUPPORTED", `${node.key} is not a local SQL query LOV.`, 2);
    if (!/^\s*(select|with)\b/iu.test(query.sql))
      throw new Fault("INVALID_INPUT", "Supply a SELECT query.", 2);
    const property = node.properties.get("source.sqlQuery");
    edits.push(
      property?.fence ? setFencedText(doc, node, "source.sqlQuery", query.sql) : setProperty(doc, node, "source.sqlQuery", query.sql)
    );
    if (query.display)
      edits.push(setProperty(doc, node, "columnMapping.display", query.display.toUpperCase()));
    if (query.return) edits.push(setProperty(doc, node, "columnMapping.return", query.return.toUpperCase()));
  }
  const result = applyEdits(located.source, edits);
  let after;
  try {
    after = describe({ source: result, relative: located.relative, node });
  } catch (error) {
    throw new Fault("TRANSFORM_INVALID", `The edited LOV does not parse: ${error.message}`, 5);
  }
  new ApexLangDocument(result);
  if (input.entries) {
    const read = (after.entries ?? []).map((entry) => [entry.display, entry.return]);
    if (JSON.stringify(read) !== JSON.stringify(input.entries.map((entry) => [entry.display, entry.return])))
      throw new Fault("TRANSFORM_INVALID", `${node.key} entries did not read back.`, 5);
  } else if (String(after.query ?? "").trim() !== input.query.sql.trim())
    throw new Fault("TRANSFORM_INVALID", `${node.key} query did not read back.`, 5);
  return result;
}
var unquote = (value) => {
  if (!value.startsWith('"')) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
async function lovEdit(ctx, input) {
  const first = await locate(ctx, input.lov);
  const outcome = await guardedEdit(ctx, {
    file: first.file,
    relative: first.relative,
    expectedDigest: input.expectedDigest,
    dryRun: input.dryRun,
    plan: async () => {
      const located = await locate(ctx, input.lov);
      if (located.file !== first.file)
        throw new Fault("TRANSFORM_CONFLICT", `${input.lov} moved to ${located.relative}; read it again.`, 5);
      return {
        source: located.source,
        digest: digestOf(located.source),
        result: plan(located, input),
        node: located.node
      };
    }
  });
  const { planned } = outcome;
  const pages = await consumers(first.app, first.node.key);
  return {
    file: first.relative,
    beforeDigest: planned.digest,
    afterDigest: digestOf(planned.result),
    written: outcome.written,
    ...outcome.change ? { change: outcome.change } : {},
    lov: describe({ source: planned.result, relative: first.relative, node: planned.node }),
    digest: digestOf(planned.result),
    // Shared-component scope: these pages use the LOV, but other references (PL/SQL, columns of
    // other components) are not resolved, so the change is never reported as page-only.
    scope: "sharedComponent",
    consumers: pages,
    next: outcome.written ? "Source edited only. Ship with importMode auto or full; a shared LOV is not a page-only change." : `Apply with expectedDigest ${planned.digest}.`
  };
}

export {
  lovFile,
  lovContext,
  lovEdit
};
