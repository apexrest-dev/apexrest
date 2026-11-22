import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);

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
  let fence = false;
  return lines.map((line) => {
    const trimmed = line.trim();
    if (fence) {
      if (trimmed === "```") fence = false;
      return line;
    }
    if (trimmed.startsWith("```")) {
      fence = !(trimmed.length >= 6 && trimmed.endsWith("```"));
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
    const indent = opening.length - opening.trimStart().length;
    const body = [];
    index += 1;
    while (index < lines.length && (lines[index] ?? "").trim() !== "```") {
      const line = lines[index] ?? "";
      const leading = line.length - line.trimStart().length;
      body.push(line.slice(Math.min(indent, leading)));
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
      const group = GROUP.exec(text);
      if (group) {
        const nested = readBlock("}", children);
        const existing = props[group[1]];
        props[group[1]] = isObject(existing) ? { ...existing, ...nested } : nested;
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

export {
  isRef,
  isObject,
  parseApexLang,
  get,
  str,
  num,
  bool,
  ref,
  list,
  loadApplication
};
