import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  hash
} from "./chunk-VS4GLWTQ.mjs";
import {
  Fault
} from "./chunk-HRRL6FHO.mjs";

// packages/core/src/composer/reader.ts
function declarations(source) {
  if (Buffer.byteLength(source) > 8 * 1024 * 1024)
    throw new Fault("TRANSFORM_UNSUPPORTED", "Source exceeds the bounded reader limit.", 5);
  const lines = [...source.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)].filter((m) => m[0].length);
  const stack = [], out = [];
  let fence2 = false;
  for (const line of lines) {
    const text = line[0].replace(/[\r\n]+$/, "");
    if (/^\s*```/.test(text)) {
      fence2 = !fence2;
      continue;
    }
    if (fence2) continue;
    const open = text.match(/^( *)([A-Za-z][\w]*)(?:\s+(.*?))?\s*\(\s*$/);
    if (open) stack.push({ kind: open[2], key: open[3] ?? "", start: line.index, depth: open[1].length });
    else if (/^ *\)\s*$/.test(text)) {
      const node2 = stack.pop();
      if (!node2 || node2.depth !== text.indexOf(")"))
        throw new Fault("TRANSFORM_UNSUPPORTED", "Unbalanced declaration boundary.", 5);
      const end = line.index + line[0].length;
      out.push({ ...node2, end, digest: hash(source.slice(node2.start, end)) });
    }
  }
  if (fence2 || stack.length) throw new Fault("TRANSFORM_UNSUPPORTED", "Unclosed literal or declaration.", 5);
  return out.sort((a, b) => a.start - b.start);
}
function inventorySymbols(sources) {
  const pages = /* @__PURE__ */ new Set(), symbols = /* @__PURE__ */ new Set();
  for (const source of Object.values(sources))
    for (const node2 of declarations(source)) {
      if (node2.kind === "page" && /^\d+$/.test(node2.key)) pages.add(Number(node2.key));
      if (node2.key) symbols.add(node2.key.toUpperCase());
    }
  return { pages, symbols };
}
function editSpans(source, edits) {
  let result = source, previous = source.length + 1;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    if (edit.start < 0 || edit.end > previous || edit.start > edit.end || hash(source.slice(edit.start, edit.end)) !== edit.expectedDigest)
      throw new Fault("TRANSFORM_CONFLICT", "Overlapping or stale structural edit.", 5);
    result = result.slice(0, edit.start) + edit.content + result.slice(edit.end);
    previous = edit.start;
  }
  return result;
}
function threeWay(base, local, next) {
  if (local === base) return next;
  if (next === base || local === next) return local;
  const variants = [base, local, next], roots = variants.map(declarations);
  const rootDepth = roots[0]?.[0]?.depth;
  if (rootDepth !== void 0 && roots.every((nodes) => nodes[0]?.depth === rootDepth)) {
    const children = roots.map((nodes) => nodes.filter((node2) => node2.depth === rootDepth + 4));
    const maps = children.map(
      (nodes, i) => new Map(
        nodes.map((node2) => [
          node2.kind + ":" + node2.key,
          { node: node2, content: variants[i].slice(node2.start, node2.end) }
        ])
      )
    );
    if (maps.some((map, i) => map.size !== children[i].length))
      throw new Fault("COMPOSITION_CONFLICT", "Repeated sibling anchors are unsupported.", 5);
    const scaffold = (value, nodes) => editSpans(
      value,
      nodes.map((node2) => ({ ...node2, expectedDigest: node2.digest, content: "" }))
    );
    const wrappers = variants.map((v, i) => scaffold(v, children[i]));
    const wrapper = mergeLines(wrappers[0], wrappers[1], wrappers[2]);
    const edits = [];
    const additions = [];
    for (const key of /* @__PURE__ */ new Set([...maps[1].keys(), ...maps[2].keys()])) {
      const b = maps[0].get(key), l = maps[1].get(key), n = maps[2].get(key);
      let content;
      if (!b) {
        if (l && n && l.content !== n.content)
          throw new Fault("COMPOSITION_CONFLICT", "New declaration collides with local source.", 5);
        content = l?.content ?? n?.content;
      } else if (!n) {
        if (l && l.content !== b.content)
          throw new Fault("COMPOSITION_CONFLICT", "Removing an edited declaration requires detach.", 5);
        content = "";
      } else if (!l) {
        if (n.content !== b.content)
          throw new Fault(
            "COMPOSITION_CONFLICT",
            "A locally removed declaration changed in the generator.",
            5
          );
      } else content = threeWay(b.content, l.content, n.content);
      if (l && content !== void 0 && content !== l.content)
        edits.push({ ...l.node, expectedDigest: l.node.digest, content });
      else if (!l && !b && content) additions.push(content);
    }
    const translate = (offset) => {
      let skipped = 0;
      for (const child of children[1]) {
        if (child.start - skipped > offset) break;
        skipped += child.end - child.start;
      }
      return offset + skipped;
    };
    let cursor = 0;
    const originalLines = wrappers[1].split("\n"), mergedLines = wrapper.split("\n");
    originalLines.forEach((line, i) => {
      if (line !== mergedLines[i]) {
        const start = translate(cursor), end = start + line.length;
        edits.push({ start, end, expectedDigest: hash(local.slice(start, end)), content: mergedLines[i] });
      }
      cursor += line.length + 1;
    });
    if (additions.length) {
      const root = roots[1][0], close = local.lastIndexOf(")", root.end - 1), start = local.lastIndexOf("\n", close) + 1;
      edits.push({ start, end: start, expectedDigest: hash(""), content: additions.join("") });
    }
    return editSpans(local, edits);
  }
  return mergeLines(base, local, next);
}
function mergeLines(base, local, next) {
  if (local === base) return next;
  if (next === base || local === next) return local;
  const literals = [base, local, next].map(
    (source) => [...source.matchAll(/```[^\r\n]*[\r\n]+[\s\S]*?^[ \t]*```/gm)].map((match) => match[0])
  );
  if (literals[0].length !== literals[1].length || literals[0].length !== literals[2].length || literals[0].some(
    (value, i) => value !== literals[1][i] && value !== literals[2][i] && literals[1][i] !== literals[2][i]
  ))
    throw new Fault(
      "COMPOSITION_CONFLICT",
      "Concurrent changes to an opaque code literal require explicit review.",
      5
    );
  const b = base.split("\n"), l = local.split("\n"), n = next.split("\n");
  if (b.length !== l.length || b.length !== n.length)
    throw new Fault(
      "COMPOSITION_CONFLICT",
      "Structural changes require explicit adoption or conflict resolution.",
      5
    );
  return b.map((line, i) => {
    if (l[i] === line) return n[i];
    if (n[i] === line || l[i] === n[i]) return l[i];
    throw new Fault("COMPOSITION_CONFLICT", `Both local and generated source changed line ${i + 1}.`, 5);
  }).join("\n");
}

// packages/core/src/preview/apexlang.ts
import fs from "node:fs";
import path from "node:path";
var ApexLangError = class extends Error {
  file;
  line;
  constructor(message, file, line) {
    super(`${file}:${line}: ${message}`);
    this.file = file;
    this.line = line;
  }
};
var PROPERTY = /^("(?:[^"\\]|\\.)*"|[A-Za-z0-9_$.#-]+)\s*:(?:\s+(.*))?$/u;
var GROUP = /^([A-Za-z][\w-]*)\s*\{$/u;
var COMPONENT = /^([A-Za-z][\w]*)(?:\s+(.+?))?\s*\($/u;
function isRef(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && typeof value.ref === "string" && Object.keys(value).length === 2 && "global" in value;
}
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !isRef(value);
}
function unquote(raw) {
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(1, -1);
    }
  }
  return raw;
}
function scalar(raw) {
  const text = raw.trim();
  if (text === "true") return true;
  if (text === "false") return false;
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) return unquote(text);
  if (text.length >= 2 && text.startsWith("\\") && text.endsWith("\\")) return text.slice(1, -1);
  if (/^@\S+$/u.test(text) && !text.endsWith("@")) {
    return text.startsWith("@/") ? { ref: text.slice(2), global: true } : { ref: text.slice(1), global: false };
  }
  return text;
}
function inlineArray(text) {
  const body = text.slice(1, -1).trim();
  if (!body) return [];
  const values = [];
  for (const match of body.matchAll(/"(?:[^"\\]|\\.)*"|\S+/gu)) values.push(scalar(match[0]));
  return values;
}
function stripComments(lines) {
  let block = false;
  let fence2 = false;
  return lines.map((line) => {
    const trimmed = line.trim();
    if (fence2) {
      if (trimmed === "```") fence2 = false;
      return line;
    }
    if (trimmed.startsWith("```")) {
      fence2 = !(trimmed.length >= 6 && trimmed.endsWith("```"));
      return line;
    }
    if (block) {
      const end = line.indexOf("*/");
      if (end === -1) return "";
      block = false;
      return line.slice(end + 2);
    }
    if (trimmed.startsWith("//")) return "";
    if (trimmed.startsWith("/*")) {
      const end = line.indexOf("*/", line.indexOf("/*") + 2);
      if (end === -1) {
        block = true;
        return "";
      }
      return line.slice(0, line.indexOf("/*")) + line.slice(end + 2);
    }
    return line;
  });
}
function parseApexLang(source, file = "<memory>") {
  const lines = stripComments(source.replace(/\r\n?/gu, "\n").split("\n"));
  let index = 0;
  const fail = (message) => {
    throw new ApexLangError(message, file, index + 1);
  };
  const readFence = () => {
    const opening = lines[index] ?? "";
    const indent2 = opening.length - opening.trimStart().length;
    const body = [];
    index += 1;
    while (index < lines.length && (lines[index] ?? "").trim() !== "```") {
      const line = lines[index] ?? "";
      const leading = line.length - line.trimStart().length;
      body.push(line.slice(Math.min(indent2, leading)));
      index += 1;
    }
    if (index >= lines.length) fail("unterminated ``` block");
    index += 1;
    return body.join("\n");
  };
  const readValue = (raw) => {
    const text = (raw ?? "").trim();
    if (text === "") {
      const next = (lines[index] ?? "").trim();
      if (next.startsWith("```")) return readFence();
      return "";
    }
    if (text === "{") return readBlock("}");
    if (text === "[") return readArray();
    if (text.startsWith("[") && text.endsWith("]")) return inlineArray(text);
    if (text.startsWith("```") && text.endsWith("```") && text.length >= 6) return text.slice(3, -3);
    return scalar(text);
  };
  const readArray = () => {
    const values = [];
    while (index < lines.length) {
      const text = (lines[index] ?? "").trim();
      index += 1;
      if (!text) continue;
      if (text === "]") return values;
      if (text === "{") values.push(readBlock("}"));
      else if (text.startsWith("```")) {
        index -= 1;
        values.push(readFence());
      } else values.push(scalar(text));
    }
    return fail("unterminated array");
  };
  function readBlock(close, children) {
    const props = {};
    while (index < lines.length) {
      const text = (lines[index] ?? "").trim();
      const lineNumber = index + 1;
      index += 1;
      if (!text) continue;
      if (text === close) return props;
      const property = PROPERTY.exec(text);
      if (property) {
        props[unquote(property[1])] = readValue(property[2]);
        continue;
      }
      const group2 = GROUP.exec(text);
      if (group2) {
        const nested = readBlock("}", children);
        const existing = props[group2[1]];
        props[group2[1]] = isObject(existing) ? { ...existing, ...nested } : nested;
        continue;
      }
      const component = COMPONENT.exec(text);
      if (component && children) {
        children.push(readComponent(component[1], component[2] ?? "", lineNumber));
        continue;
      }
      index -= 1;
      fail(`unexpected line: ${text.slice(0, 120)}`);
    }
    if (close === "") return props;
    return fail(`missing closing "${close}"`);
  }
  function readComponent(type, rawId, line) {
    const children = [];
    const props = readBlock(")", children);
    return { type, id: unquote(rawId.trim()), props, children, file, line };
  }
  const components = [];
  while (index < lines.length) {
    const text = (lines[index] ?? "").trim();
    const lineNumber = index + 1;
    index += 1;
    if (!text) continue;
    const component = COMPONENT.exec(text);
    if (!component) {
      index -= 1;
      fail(`expected a component declaration, found: ${text.slice(0, 120)}`);
    }
    components.push(readComponent(component[1], component[2] ?? "", lineNumber));
  }
  return components;
}
function get(props, dotted) {
  let value = props;
  for (const part of dotted.split(".")) {
    if (!isObject(value)) return void 0;
    value = value[part];
  }
  return value;
}
function str(props, dotted, fallback = "") {
  const value = get(props, dotted);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return String(value);
  if (isRef(value)) return value.ref;
  return fallback;
}
function num(props, dotted, fallback) {
  const value = Number(str(props, dotted, ""));
  return str(props, dotted, "") !== "" && Number.isFinite(value) ? value : fallback;
}
function bool(props, dotted, fallback) {
  const value = get(props, dotted);
  return typeof value === "boolean" ? value : fallback;
}
function ref(props, dotted) {
  const value = get(props, dotted);
  if (isRef(value)) return value.ref;
  return typeof value === "string" && value ? value : void 0;
}
function list(props, dotted) {
  const value = get(props, dotted);
  if (Array.isArray(value)) return value;
  return value === void 0 || value === "" ? [] : [value];
}
function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "static-files" ? [] : walk(full);
    return entry.name.endsWith(".apx") ? [full] : [];
  });
}
function deploymentSubstitutions(root, deployment) {
  const file = path.join(root, "deployments", `${deployment}.json`);
  if (!fs.existsSync(file)) return {};
  const values = {};
  const collect = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      if (typeof nested === "string" || typeof nested === "number")
        values[key.toUpperCase()] = String(nested);
      else collect(nested);
    }
  };
  try {
    collect(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return {};
  }
  return values;
}
function loadApplication(root, deployment = "default", cache) {
  const appFile = path.join(root, "application.apx");
  if (!fs.existsSync(appFile)) throw new Error(`${root} does not contain application.apx`);
  const substitutions = deploymentSubstitutions(root, deployment);
  const files = walk(root).sort();
  const pages = /* @__PURE__ */ new Map();
  const shared = [];
  let app;
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const info = cache ? fs.statSync(file) : void 0;
    const key = info ? `${info.size}:${info.mtimeMs}:${JSON.stringify(substitutions)}` : "";
    const cached = cache?.get(relative);
    const parsed = cached && cached.key === key ? cached.components : parseFile(file, relative, root, substitutions);
    if (cache && cached?.components !== parsed) cache.set(relative, { key, components: parsed });
    for (const component of parsed) {
      if (component.type === "app") app = component;
      else if (component.type === "page") pages.set(component.id, component);
      else shared.push(component);
    }
  }
  if (cache) {
    for (const relative of [...cache.keys()])
      if (!files.some((file) => path.relative(root, file).split(path.sep).join("/") === relative))
        cache.delete(relative);
  }
  if (!app) throw new Error(`${appFile} does not declare an app component`);
  for (const child of app.children)
    if (child.type === "page" && !pages.has(child.id)) pages.set(child.id, child);
  return { root, app, pages, shared, substitutions, files };
}
function parseFile(file, relative, root, substitutions) {
  {
    const text = fs.readFileSync(file, "utf8").replace(
      /@([A-Z][A-Z0-9_]*)@/gu,
      (whole, name) => substitutions[name] ?? (name === "APP_ALIAS" ? path.basename(root).toLowerCase() : name === "APP_NAME" ? path.basename(root) : whole)
    );
    return parseApexLang(text, relative);
  }
}

// packages/core/src/apexlang-writer.ts
var indent = (value, depth = 4) => value.split("\n").map((line) => line ? " ".repeat(depth) + line : line).join("\n");
var group = (name, value) => `${name} {
${indent(value)}
}`;
var node = (kind, id, value) => `${kind} ${id} (
${indent(Array.isArray(value) ? value.filter(Boolean).join("\n") : value)}
)
`;
var fence = (language, value) => `
${indent("```" + language + "\n" + value + "\n```")}`;
var appearance = (template) => group("appearance", `template: @/${template}
templateOptions: #DEFAULT#`);
var refreshAction = (key, region, sequence) => node("action", key, [
  "action: refresh",
  group("affectedElements", `selectionType: region
region: @${region}`),
  group("execution", `sequence: ${sequence}
fireOnInit: false`)
]);

export {
  declarations,
  inventorySymbols,
  editSpans,
  threeWay,
  isRef,
  isObject,
  parseApexLang,
  get,
  str,
  num,
  bool,
  ref,
  list,
  loadApplication,
  indent,
  group,
  node,
  fence,
  appearance,
  refreshAction
};
