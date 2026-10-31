import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  loadProject,
  managedHome
} from "./chunk-EMYWWRNE.mjs";
import "./chunk-HRX24FAR.mjs";
import {
  Fault
} from "./chunk-SSL73I4K.mjs";

// packages/core/src/preview/service.ts
import fs6 from "node:fs";
import path6 from "node:path";

// packages/core/src/preview/assets.ts
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";

// packages/core/src/preview/theme-sql.ts
var FUNCTIONS = {
  "wwv_flow_string.join": (args) => Array.isArray(args[0]) ? args[0].map((item) => item ?? "").join("\n") : args[0],
  wwv_flow_t_varchar2: (args) => args,
  "wwv_flow_imp.id": (args) => args[0] === void 0 || args[0] === null ? void 0 : String(args[0]),
  nvl: (args) => args[0] ?? args[1]
};
var Parser = class {
  #text;
  #index = 0;
  constructor(text2) {
    this.#text = text2;
  }
  get done() {
    return this.#index >= this.#text.length;
  }
  skipSpace() {
    while (!this.done) {
      const char = this.#text[this.#index];
      if (/\s/u.test(char)) this.#index += 1;
      else if (this.#text.startsWith("--", this.#index)) {
        const end = this.#text.indexOf("\n", this.#index);
        this.#index = end === -1 ? this.#text.length : end + 1;
      } else break;
    }
  }
  peek(token) {
    this.skipSpace();
    return this.#text.startsWith(token, this.#index);
  }
  take(token) {
    if (!this.peek(token)) return false;
    this.#index += token.length;
    return true;
  }
  expect(token) {
    if (!this.take(token)) throw new Error(`Expected "${token}" at offset ${this.#index}`);
  }
  identifier() {
    this.skipSpace();
    const match = /^[A-Za-z_][\w$#.]*/u.exec(this.#text.slice(this.#index, this.#index + 200));
    if (!match) throw new Error(`Expected identifier at offset ${this.#index}`);
    this.#index += match[0].length;
    return match[0];
  }
  string() {
    this.expect("'");
    let value = "";
    for (; ; ) {
      const end = this.#text.indexOf("'", this.#index);
      if (end === -1) throw new Error("Unterminated SQL string");
      value += this.#text.slice(this.#index, end);
      this.#index = end + 1;
      if (this.#text[this.#index] === "'") {
        value += "'";
        this.#index += 1;
      } else return value;
    }
  }
  primary() {
    this.skipSpace();
    if (this.peek("'")) return this.string();
    const numberMatch = /^-?\d+(?:\.\d+)?/u.exec(this.#text.slice(this.#index, this.#index + 64));
    if (numberMatch) {
      this.#index += numberMatch[0].length;
      const value = Number(numberMatch[0]);
      return Number.isSafeInteger(value) || numberMatch[0].includes(".") ? value : numberMatch[0];
    }
    if (this.take("(")) {
      const value = this.expression();
      this.expect(")");
      return value;
    }
    const name = this.identifier();
    const lower = name.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
    if (lower === "null") return null;
    if (!this.take("(")) return void 0;
    const args = [];
    if (!this.take(")")) {
      do {
        if (/^\s*[A-Za-z_]\w*\s*=>/u.test(this.#text.slice(this.#index, this.#index + 80))) {
          this.identifier();
          this.expect("=>");
        }
        args.push(this.expression());
      } while (this.take(","));
      this.expect(")");
    }
    return FUNCTIONS[lower]?.(args);
  }
  expression() {
    let value = this.primary();
    while (this.take("||")) {
      const right = this.primary();
      value = `${value ?? ""}${right ?? ""}`;
    }
    return value;
  }
  /** `p_a=>expr, p_b=>expr )` */
  namedArguments() {
    const params = {};
    if (this.take(")")) return params;
    do {
      const name = this.identifier().toLowerCase().replace(/^p_/u, "");
      this.expect("=>");
      params[name] = this.expression();
    } while (this.take(","));
    this.expect(")");
    return params;
  }
  seek(pattern) {
    pattern.lastIndex = this.#index;
    const match = pattern.exec(this.#text);
    if (match) this.#index = match.index + match[0].length;
    else this.#index = this.#text.length;
    return match;
  }
};
function parseThemeSql(sql) {
  const parser = new Parser(sql);
  const calls = [];
  const start = /wwv_flow_imp_shared\.(create_\w+)\s*\(/gu;
  for (; ; ) {
    const match = parser.seek(start);
    if (!match) break;
    try {
      calls.push({ kind: match[1].replace(/^create_/u, ""), params: parser.namedArguments() });
    } catch {
    }
  }
  return calls;
}

// packages/core/src/preview/assets.ts
var APEX_VERSION = "26.2";
var APEX_FULL_VERSION = "26.2.0";
var APEX_DOWNLOAD_URL = `https://download.oracle.com/otn_software/apex/apex_${APEX_VERSION}_en.zip`;
var APEX_ASSETS_ENV = "APEXREST_PREVIEW_ASSETS";
var IMAGE_PREFIXES = [
  "libraries/apex/",
  "libraries/jquery/",
  "libraries/jquery-ui/",
  "libraries/jquery-migrate/",
  "libraries/font-apex/",
  "libraries/oracle-fonts/",
  "libraries/apex-utility-css/",
  "libraries/purify/",
  "libraries/hammer/",
  `themes/theme_42/${APEX_VERSION}/`,
  "app_ui/",
  "css/"
];
var THEME_SQL = `apex/core/themes/f8842.${APEX_VERSION.replace(".", "")}.sql`;
function defaultAssetsDir(environment = process.env) {
  const configured = environment[APEX_ASSETS_ENV];
  return configured ? path.resolve(configured) : path.join(managedHome(), "preview", APEX_VERSION);
}
var ZipReader = class {
  #fd;
  entries = [];
  constructor(file) {
    this.#fd = fs.openSync(file, "r");
    const size = fs.fstatSync(this.#fd).size;
    const tailSize = Math.min(size, 65557);
    const tail = this.#read(size - tailSize, tailSize);
    const eocd = tail.lastIndexOf(Buffer.from([80, 75, 5, 6]));
    if (eocd === -1) throw new Error(`${file} is not a zip archive`);
    const count = tail.readUInt16LE(eocd + 10);
    const directorySize = tail.readUInt32LE(eocd + 12);
    const directoryOffset = tail.readUInt32LE(eocd + 16);
    if (directoryOffset === 4294967295 || count === 65535)
      throw new Error("ZIP64 archives are not supported");
    const directory = this.#read(directoryOffset, directorySize);
    let offset = 0;
    for (let index = 0; index < count; index += 1) {
      if (directory.readUInt32LE(offset) !== 33639248) throw new Error("Corrupt zip central directory");
      const nameLength = directory.readUInt16LE(offset + 28);
      const extraLength = directory.readUInt16LE(offset + 30);
      const commentLength = directory.readUInt16LE(offset + 32);
      this.entries.push({
        method: directory.readUInt16LE(offset + 10),
        compressedSize: directory.readUInt32LE(offset + 20),
        size: directory.readUInt32LE(offset + 24),
        localHeaderOffset: directory.readUInt32LE(offset + 42),
        name: directory.toString("utf8", offset + 46, offset + 46 + nameLength)
      });
      offset += 46 + nameLength + extraLength + commentLength;
    }
  }
  #read(position, length) {
    const buffer = Buffer.alloc(length);
    let done = 0;
    while (done < length) {
      const read = fs.readSync(this.#fd, buffer, done, length - done, position + done);
      if (read === 0) throw new Error("Unexpected end of zip archive");
      done += read;
    }
    return buffer;
  }
  read(entry) {
    const header = this.#read(entry.localHeaderOffset, 30);
    if (header.readUInt32LE(0) !== 67324752) throw new Error(`Corrupt local header for ${entry.name}`);
    const start = entry.localHeaderOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
    const data = this.#read(start, entry.compressedSize);
    if (entry.method === 0) return data;
    if (entry.method === 8) return zlib.inflateRawSync(data);
    throw new Error(`Unsupported zip compression method ${entry.method} for ${entry.name}`);
  }
  close() {
    fs.closeSync(this.#fd);
  }
};
async function sha256(file) {
  const hash = crypto.createHash("sha256");
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
}
async function download(url, target, onProgress) {
  const response = await fetch(url);
  if (!response.ok || !response.body)
    throw new Error(`Download failed: ${response.status} ${response.statusText} (${url})`);
  const total = Number(response.headers.get("content-length")) || 0;
  let received = 0;
  let reported = 0;
  const body2 = Readable.fromWeb(response.body);
  body2.on("data", (chunk) => {
    received += chunk.length;
    if (onProgress && received - reported > 25 * 1048576) {
      reported = received;
      onProgress(
        `downloaded ${(received / 1048576).toFixed(0)}${total ? ` / ${(total / 1048576).toFixed(0)}` : ""} MB`
      );
    }
  });
  await pipeline(body2, fs.createWriteStream(target, { mode: 384 }));
}
async function setupAssets(options = {}) {
  const dir = path.resolve(options.assetsDir ?? defaultAssetsDir());
  const progress = options.onProgress ?? (() => void 0);
  fs.mkdirSync(dir, { recursive: true });
  let zipPath = options.zipPath ? path.resolve(options.zipPath) : void 0;
  let downloaded = false;
  if (!zipPath) {
    const url = options.url ?? APEX_DOWNLOAD_URL;
    zipPath = path.join(dir, `apex_${APEX_VERSION}.zip`);
    if (!fs.existsSync(zipPath)) {
      progress(`downloading ${url}`);
      const partial = `${zipPath}.part`;
      await download(url, partial, progress);
      fs.renameSync(partial, zipPath);
    }
    downloaded = true;
  }
  const digest = await sha256(zipPath);
  if (options.expectedSha256 && digest !== options.expectedSha256.toLowerCase()) {
    throw new Error(`SHA-256 mismatch for ${zipPath}: ${digest}`);
  }
  const imagesDir = path.join(dir, "images");
  const staging = `${imagesDir}.staging`;
  fs.rmSync(staging, { recursive: true, force: true });
  const zip = new ZipReader(zipPath);
  let files = 0;
  let themeSql;
  try {
    for (const entry of zip.entries) {
      if (entry.name.endsWith("/")) continue;
      if (entry.name === THEME_SQL) {
        themeSql = zip.read(entry).toString("utf8");
        continue;
      }
      if (!entry.name.startsWith("apex/images/") || entry.name.endsWith(".map")) continue;
      const relative = entry.name.slice("apex/images/".length);
      if (!IMAGE_PREFIXES.some((prefix) => relative.startsWith(prefix))) continue;
      const target = path.resolve(staging, relative);
      if (!target.startsWith(`${staging}${path.sep}`)) throw new Error(`Unsafe zip entry ${entry.name}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, zip.read(entry));
      files += 1;
      if (files % 2e3 === 0) progress(`extracted ${files} files`);
    }
  } finally {
    zip.close();
  }
  if (!themeSql)
    throw new Error(`${zipPath} does not contain ${THEME_SQL}; is it an APEX ${APEX_VERSION} distribution?`);
  if (files === 0) throw new Error(`${zipPath} contains no apex/images runtime files`);
  const theme = parseThemeSql(themeSql);
  fs.writeFileSync(path.join(dir, "theme.json"), JSON.stringify(theme));
  fs.rmSync(imagesDir, { recursive: true, force: true });
  fs.renameSync(staging, imagesDir);
  const manifest = {
    apexVersion: APEX_FULL_VERSION,
    source: options.zipPath ? zipPath : options.url ?? APEX_DOWNLOAD_URL,
    sha256: digest,
    extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
    files
  };
  fs.writeFileSync(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}
`);
  if (downloaded && !options.keepZip) fs.rmSync(zipPath, { force: true });
  progress(`ready: ${files} files in ${imagesDir}`);
  return { dir, imagesDir, manifest, theme };
}
function loadAssets(assetsDir = defaultAssetsDir()) {
  const dir = path.resolve(assetsDir);
  const manifestFile = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestFile)) {
    throw new Error(
      `APEX ${APEX_VERSION} assets are not installed in ${dir}. Run: apexrest preview setup (or apexrest_preview action:setup).`
    );
  }
  return {
    dir,
    imagesDir: path.join(dir, "images"),
    manifest: JSON.parse(fs.readFileSync(manifestFile, "utf8")),
    theme: JSON.parse(fs.readFileSync(path.join(dir, "theme.json"), "utf8"))
  };
}

// packages/core/src/preview/server.ts
import { randomUUID } from "node:crypto";
import fs5 from "node:fs";
import http from "node:http";
import path5 from "node:path";

// packages/core/src/preview/apexlang.ts
import fs2 from "node:fs";
import path2 from "node:path";
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
  const text2 = raw.trim();
  if (text2 === "true") return true;
  if (text2 === "false") return false;
  if (text2.startsWith('"') && text2.endsWith('"') && text2.length >= 2) return unquote(text2);
  if (text2.length >= 2 && text2.startsWith("\\") && text2.endsWith("\\")) return text2.slice(1, -1);
  if (/^@\S+$/u.test(text2) && !text2.endsWith("@")) {
    return text2.startsWith("@/") ? { ref: text2.slice(2), global: true } : { ref: text2.slice(1), global: false };
  }
  return text2;
}
function inlineArray(text2) {
  const body2 = text2.slice(1, -1).trim();
  if (!body2) return [];
  const values = [];
  for (const match of body2.matchAll(/"(?:[^"\\]|\\.)*"|\S+/gu)) values.push(scalar(match[0]));
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
    const body2 = [];
    index += 1;
    while (index < lines.length && (lines[index] ?? "").trim() !== "```") {
      const line = lines[index] ?? "";
      const leading = line.length - line.trimStart().length;
      body2.push(line.slice(Math.min(indent, leading)));
      index += 1;
    }
    if (index >= lines.length) fail("unterminated ``` block");
    index += 1;
    return body2.join("\n");
  };
  const readValue = (raw) => {
    const text2 = (raw ?? "").trim();
    if (text2 === "") {
      const next = (lines[index] ?? "").trim();
      if (next.startsWith("```")) return readFence();
      return "";
    }
    if (text2 === "{") return readBlock("}");
    if (text2 === "[") return readArray();
    if (text2.startsWith("[") && text2.endsWith("]")) return inlineArray(text2);
    if (text2.startsWith("```") && text2.endsWith("```") && text2.length >= 6) return text2.slice(3, -3);
    return scalar(text2);
  };
  const readArray = () => {
    const values = [];
    while (index < lines.length) {
      const text2 = (lines[index] ?? "").trim();
      index += 1;
      if (!text2) continue;
      if (text2 === "]") return values;
      if (text2 === "{") values.push(readBlock("}"));
      else if (text2.startsWith("```")) {
        index -= 1;
        values.push(readFence());
      } else values.push(scalar(text2));
    }
    return fail("unterminated array");
  };
  function readBlock(close, children) {
    const props = {};
    while (index < lines.length) {
      const text2 = (lines[index] ?? "").trim();
      const lineNumber = index + 1;
      index += 1;
      if (!text2) continue;
      if (text2 === close) return props;
      const property = PROPERTY.exec(text2);
      if (property) {
        props[unquote(property[1])] = readValue(property[2]);
        continue;
      }
      const group = GROUP.exec(text2);
      if (group) {
        const nested = readBlock("}", children);
        const existing = props[group[1]];
        props[group[1]] = isObject(existing) ? { ...existing, ...nested } : nested;
        continue;
      }
      const component = COMPONENT.exec(text2);
      if (component && children) {
        children.push(readComponent(component[1], component[2] ?? "", lineNumber));
        continue;
      }
      index -= 1;
      fail(`unexpected line: ${text2.slice(0, 120)}`);
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
    const text2 = (lines[index] ?? "").trim();
    const lineNumber = index + 1;
    index += 1;
    if (!text2) continue;
    const component = COMPONENT.exec(text2);
    if (!component) {
      index -= 1;
      fail(`expected a component declaration, found: ${text2.slice(0, 120)}`);
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
  if (!fs2.existsSync(directory)) return [];
  return fs2.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path2.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "static-files" ? [] : walk(full);
    return entry.name.endsWith(".apx") ? [full] : [];
  });
}
function deploymentSubstitutions(root, deployment) {
  const file = path2.join(root, "deployments", `${deployment}.json`);
  if (!fs2.existsSync(file)) return {};
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
    collect(JSON.parse(fs2.readFileSync(file, "utf8")));
  } catch {
    return {};
  }
  return values;
}
function loadApplication(root, deployment = "default") {
  const appFile = path2.join(root, "application.apx");
  if (!fs2.existsSync(appFile)) throw new Error(`${root} does not contain application.apx`);
  const substitutions = deploymentSubstitutions(root, deployment);
  const files = walk(root).sort();
  const pages = /* @__PURE__ */ new Map();
  const shared = [];
  let app;
  for (const file of files) {
    const relative = path2.relative(root, file);
    const text2 = fs2.readFileSync(file, "utf8").replace(
      /@([A-Z][A-Z0-9_]*)@/gu,
      (whole, name) => substitutions[name] ?? (name === "APP_ALIAS" ? path2.basename(root).toLowerCase() : name === "APP_NAME" ? path2.basename(root) : whole)
    );
    for (const component of parseApexLang(text2, relative)) {
      if (component.type === "app") app = component;
      else if (component.type === "page") pages.set(component.id, component);
      else shared.push(component);
    }
  }
  if (!app) throw new Error(`${appFile} does not declare an app component`);
  return { root, app, pages, shared, substitutions, files };
}

// packages/core/src/preview/client.ts
var RUNTIME_CSS = `
.apex-local-toolbar{position:fixed;left:8px;bottom:8px;z-index:2000;max-width:min(640px,calc(100vw - 16px));font:12px/1.4 system-ui,sans-serif;background:rgba(32,32,36,.92);color:#fff;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.25)}
.apex-local-toolbar summary{cursor:pointer;padding:6px 10px;list-style:none}
.apex-local-toolbar ul{margin:0;padding:0 10px 8px 26px;max-height:40vh;overflow:auto}
.apex-local-toolbar li.is-error{color:#ff9b9b}.apex-local-toolbar li.is-warning{color:#ffd479}.apex-local-toolbar li.is-info{color:#cfd8e3}
.apex-local-unsupported{padding:16px;border:1px dashed rgba(0,0,0,.25);border-radius:4px;color:rgba(0,0,0,.65);background:repeating-linear-gradient(45deg,rgba(0,0,0,.02),rgba(0,0,0,.02) 8px,transparent 8px,transparent 16px)}
.apex-local-chart{display:grid;gap:16px;padding:8px 0}
.apex-local-series-name{font-weight:600;margin-bottom:6px}
.apex-local-bar{display:grid;grid-template-columns:minmax(80px,30%) 1fr auto;gap:8px;align-items:center;margin:4px 0}
.apex-local-bar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.apex-local-bar-track{height:14px;background:rgba(0,0,0,.06);border-radius:3px;overflow:hidden}
.apex-local-bar-fill{display:block;height:100%;border-radius:3px}
.apex-local-bar-value{font-variant-numeric:tabular-nums}
`;
function messagesScript(messages) {
  return `apex.lang.addMessages(${JSON.stringify(messages)});
`;
}
var RUNTIME_JS = String.raw`
window.apexLocal = (function ($) {
  "use strict";
  var base = location.pathname.replace(/\/[^/]*$/, "");
  var config = { regions: [], dynamicActions: [] };

  function compile(body) {
    return Function("event", body);
  }
  function expression(code, context) {
    return Function("return (" + code + ")").call(context || {});
  }
  function elements(selector, trigger) {
    if (!selector || selector === "document") return $(document);
    if (selector === "triggeringElement") return $(trigger);
    if (selector.indexOf("js:") === 0) return $(expression(selector.slice(3), { triggeringElement: trigger }));
    return $(selector);
  }
  function isItem(element) {
    var item = element && element.id ? apex.item(element.id) : null;
    return !!(item && item.node);
  }
  function each(selector, trigger, item, other) {
    elements(selector, trigger).each(function () {
      if (isItem(this)) item(apex.item(this.id), this); else other($(this));
    });
  }
  function serverCode(settings) {
    var items = {};
    String(settings.itemsToSubmit || "").split(",").forEach(function (name) {
      name = name.trim();
      if (name) items[name] = apex.item(name).getValue();
    });
    var returnItems = String(settings.itemsToReturn || "").split(",").map(function (name) { return name.trim(); }).filter(Boolean);
    return fetch(base + "/__apex/server-code?page=" + encodeURIComponent(apex.env.APP_PAGE_ID), {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ code: settings.plsqlCode || settings.code || "", items: items, returnItems: returnItems })
    }).then(function (response) { return response.json(); }).then(function (values) {
      Object.keys(values || {}).forEach(function (name) { apex.item(name).setValue(values[name]); });
    });
  }

  function run(action, event, trigger) {
    var settings = action.settings || {};
    switch (action.action) {
      case "executeJsCode":
      case "executeJavaScriptCode":
        return compile(settings.jsCode || settings.code || "").call({
          triggeringElement: trigger, affectedElements: elements(action.selector, trigger), browserEvent: event, data: event && event.data, action: action
        }, event);
      case "refresh":
        return elements(action.selector, trigger).each(function () {
          if (apex.region.isRegion && apex.region.isRegion(this.id)) apex.region(this.id).refresh();
          else if (isItem(this) && apex.item(this.id).refresh) apex.item(this.id).refresh();
        });
      case "submitPage":
        return apex.page.submit({ request: settings.request || "", showWait: settings.showProcessing !== false });
      case "cancelDialog":
        return apex.navigation.dialog.cancel(true);
      case "closeDialog":
        return apex.navigation.dialog.close(true);
      case "show":
        return each(action.selector, trigger, function (item) { item.show(); }, function (el) { el.show(); });
      case "hide":
        return each(action.selector, trigger, function (item) { item.hide(); }, function (el) { el.hide(); });
      case "enable":
        return each(action.selector, trigger, function (item) { item.enable(); }, function (el) { el.prop("disabled", false).removeClass("apex_disabled"); });
      case "disable":
        return each(action.selector, trigger, function (item) { item.disable(); }, function (el) { el.prop("disabled", true).addClass("apex_disabled"); });
      case "clear":
        return each(action.selector, trigger, function (item) { item.setValue(""); }, function (el) { el.empty(); });
      case "setFocus":
        return each(action.selector, trigger, function (item) { item.setFocus(); }, function (el) { el.trigger("focus"); });
      case "addClass":
        return elements(action.selector, trigger).addClass(settings.cssClasses || settings.cssClass || "");
      case "removeClass":
        return elements(action.selector, trigger).removeClass(settings.cssClasses || settings.cssClass || "");
      case "alert":
        return apex.message.alert(settings.text || settings.message || "");
      case "confirm":
        return new Promise(function (resolve, reject) {
          apex.message.confirm(settings.text || settings.message || "", function (ok) { if (ok) resolve(); else reject(); });
        });
      case "setValue": {
        var type = settings.setType || settings.type || "staticAssignment";
        if (/^(sqlStatement|plsql)/.test(type)) {
          console.warn("[apex-local] setValue from " + type + " is not simulated");
          return;
        }
        var value = type === "javascriptExpression"
          ? expression(settings.jsExpression || settings.javascriptExpression || "''", { triggeringElement: trigger })
          : type === "dialogReturnItem" ? (event && event.data ? event.data[settings.dialogReturnItem] : "")
          : settings.value !== undefined ? settings.value : settings.staticValue;
        return each(action.selector, trigger, function (item) { item.setValue(value); }, function (el) { el.text(value); });
      }
      case "executeServerSideCode":
        return serverCode(settings);
      default:
        console.warn("[apex-local] dynamic action \"" + action.action + "\" is not simulated");
    }
  }

  function conditionHolds(condition, trigger) {
    if (!condition || !condition.type) return true;
    var value = condition.item ? apex.item(condition.item).getValue() : $(trigger).val();
    value = Array.isArray(value) ? value.join(":") : value;
    var empty = value === "" || value === null || value === undefined;
    switch (condition.type) {
      case "itemIsNull": case "isNull": return empty;
      case "itemIsNotNull": case "isNotNull": return !empty;
      case "item=value": case "equals": case "itemEqualsValue": return String(value) === condition.value;
      case "item!=value": case "notEquals": case "itemNotEqualsValue": return String(value) !== condition.value;
      case "itemInList": case "inList": return condition.value.split(",").indexOf(String(value)) >= 0;
      case "javascriptExpression": return !!expression(condition.expression, { triggeringElement: trigger });
      default: return true;
    }
  }

  function fire(da, event, trigger, init) {
    var holds = conditionHolds(da.condition, trigger);
    var queue = da.actions.filter(function (action) { return action.whenFalse === !holds && (!init || action.fireOnInit); });
    return queue.reduce(function (promise, action) {
      return promise.then(function () { return run(action, event, trigger); });
    }, Promise.resolve()).catch(function (error) { if (error) apex.debug.error(error); });
  }

  var EVENTS = { "page load": "ready", pageload: "ready", "lose focus": "focusout", losefocus: "focusout", "get focus": "focusin", getfocus: "focusin" };

  function bindDynamicAction(da) {
    var event = EVENTS[String(da.event).toLowerCase()] || da.event;
    if (event === "ready") return fire(da, null, document, false);
    var handler = function (browserEvent, data) {
      if (data !== undefined) browserEvent.data = data;
      fire(da, browserEvent, this, false);
    };
    if (!da.selector || da.selector === "document") $(document).on(event, handler);
    else if (da.selector.indexOf("js:") === 0) elements(da.selector, document).on(event, handler);
    else $(document).on(event, da.selector, handler);
    elements(da.selector, document).each(function () { fire(da, null, this, true); });
  }

  function replaceRegion(id, extra) {
    var region$ = $("#" + apex.util.escapeCSS(id));
    region$.trigger("apexbeforerefresh");
    var url = base + "/__apex/region?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) + "&region=" + encodeURIComponent(id) + (extra || "");
    return fetch(url, { credentials: "same-origin" }).then(function (response) { return response.text(); }).then(function (html) {
      var next$ = $(html);
      region$.replaceWith(next$);
      registerRegion({ id: id });
      next$.trigger("apexafterrefresh");
    });
  }

  function registerRegion(region) {
    if (apex.region.isRegion && apex.region.isRegion(region.id)) apex.region.destroy(region.id);
    if (!document.getElementById(region.id)) return;
    apex.region.create(region.id, { type: "ApexLocal", refresh: function () { return replaceRegion(region.id); } });
  }

  $(document).on("click", "[data-apex-local-page]", function (event) {
    event.preventDefault();
    replaceRegion(this.getAttribute("data-region"), "&pg=" + this.getAttribute("data-apex-local-page"));
  });
  $(document).on("input", "[data-apex-local-search]", function () {
    var needle = this.value.toLowerCase();
    $("#" + apex.util.escapeCSS(this.getAttribute("data-apex-local-search")) + "_table tr").each(function (index) {
      if (index === 0) return;
      this.style.display = !needle || this.textContent.toLowerCase().indexOf(needle) >= 0 ? "" : "none";
    });
  });

  return {
    init: function (pageConfig) {
      config = pageConfig;
      config.regions.forEach(registerRegion);
      config.dynamicActions.forEach(bindDynamicAction);
    },
    refreshRegion: replaceRegion,
    config: function () { return config; }
  };
})(apex.jQuery);
`;

// packages/core/src/preview/database.ts
import crypto2 from "node:crypto";
import fs3 from "node:fs";
import path3 from "node:path";
import { DatabaseSync } from "node:sqlite";
function oracleDate(value) {
  if (value === null || value === void 0 || value === "") return void 0;
  const date = new Date(typeof value === "number" ? value : String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? void 0 : date;
}
var pad = (value, size = 2) => String(value).padStart(size, "0");
var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function formatOracle(value, mask) {
  if (value === null || value === void 0) return null;
  if (!mask) return String(value);
  const upper = mask.toUpperCase();
  if (/^(FM)?[L$]?[9990GD,.]+$/u.test(upper.replace(/^FML/u, "L").replace(/^FM/u, "")) || upper.includes("999")) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    const decimals = (upper.split(/[D.]/u)[1] ?? "").replace(/[^09]/gu, "").length;
    const grouped = /[G,]/u.test(upper);
    const text2 = number.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: grouped
    });
    return /[L$]/u.test(upper) ? `$${text2}` : text2;
  }
  const date = oracleDate(value);
  if (!date) return String(value);
  if (upper === "DS" || upper === "DL") return date.toLocaleDateString("en-US");
  return upper.replace(/YYYY/gu, String(date.getFullYear())).replace(/RR|YY/gu, pad(date.getFullYear() % 100)).replace(/MONTH/gu, date.toLocaleString("en-US", { month: "long" })).replace(/MON/gu, MONTHS[date.getMonth()]).replace(/MM/gu, pad(date.getMonth() + 1)).replace(/DD/gu, pad(date.getDate())).replace(/HH24/gu, pad(date.getHours())).replace(/HH12|HH/gu, pad(date.getHours() % 12 || 12)).replace(/MI/gu, pad(date.getMinutes())).replace(/SS/gu, pad(date.getSeconds())).replace(/AM|PM/gu, date.getHours() < 12 ? "AM" : "PM");
}
function translateOracleSql(sql) {
  let text2 = sql.trim().replace(/;\s*\/?\s*$/u, "").replace(/\n\/\s*$/u, "");
  const literals = [];
  text2 = text2.replace(/'(?:[^']|'')*'/gu, (literal) => {
    literals.push(literal);
    return `\0${literals.length - 1}\0`;
  });
  text2 = text2.replace(/\bfrom\s+dual\b/giu, "").replace(
    /\bsys(?:date|timestamp)\b|\bcurrent_(?:date|timestamp)\b|\blocaltimestamp\b/giu,
    "datetime('now','localtime')"
  ).replace(
    /\boffset\s+(\d+|:\w+)\s+rows?\s+fetch\s+(?:first|next)\s+(\d+|:\w+)\s+rows?\s+only\b/giu,
    "limit $2 offset $1"
  ).replace(/\bfetch\s+(?:first|next)\s+(\d+|:\w+)\s+rows?\s+only\b/giu, "limit $1").replace(
    /\blistagg\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*within\s+group\s*\([^)]*\)/giu,
    "group_concat($1)"
  ).replace(/\bgenerated\s+(?:always|by\s+default(?:\s+on\s+null)?)\s+as\s+identity(?:\s*\([^)]*\))?/giu, "").replace(/\bvarchar2\s*\((\d+)\s*(?:char|byte)\)/giu, "varchar2($1)").replace(/\busing\s+index\b(?:\s+\w+)?/giu, "").replace(/\benable\b|\bnovalidate\b/giu, "");
  return text2.replace(/\u0000(\d+)\u0000/gu, (_match, index) => literals[Number(index)]);
}
function bindNames(sql) {
  const names = /* @__PURE__ */ new Set();
  const stripped = sql.replace(/'(?:[^']|'')*'|"[^"]*"|--[^\n]*|\/\*[\s\S]*?\*\//gu, " ");
  for (const match of stripped.matchAll(/(?<![:\w]):([A-Za-z][\w$#]*)/gu)) names.add(match[1]);
  return [...names];
}
function splitScript(script) {
  const statements = [];
  let current = "";
  let plsql = false;
  for (const line of script.replace(/\r\n?/gu, "\n").split("\n")) {
    const trimmed = line.trim();
    if (!current.trim() && /^(?:prompt|set|spool|whenever|exec|@|rem\b)/iu.test(trimmed)) continue;
    if (!current.trim() && /^(?:begin|declare|create\s+(?:or\s+replace\s+)?(?:editionable\s+)?(?:package|procedure|function|trigger|type)\b)/iu.test(
      trimmed
    )) {
      plsql = true;
    }
    if (trimmed === "/") {
      if (!plsql && current.trim()) statements.push(current);
      current = "";
      plsql = false;
      continue;
    }
    current += `${line}
`;
    if (!plsql && /;\s*(?:--.*)?$/u.test(trimmed)) {
      statements.push(current);
      current = "";
    }
  }
  if (current.trim() && !plsql) statements.push(current);
  return statements.map((statement) => statement.trim().replace(/;\s*$/u, "")).filter(Boolean);
}
var LocalDatabase = class {
  db;
  file;
  #binds = {};
  constructor(file) {
    this.file = file;
    if (file !== ":memory:") fs3.mkdirSync(path3.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.#registerOracleFunctions();
  }
  #registerOracleFunctions() {
    const fn = (name, implementation, varargs = true) => this.db.function(name, { varargs, deterministic: false }, implementation);
    fn("nvl", (value, fallback) => value ?? fallback ?? null);
    fn(
      "nvl2",
      (value, whenSet, whenNull) => value !== null && value !== void 0 ? whenSet ?? null : whenNull ?? null
    );
    fn("decode", (...args) => {
      const [expression, ...pairs] = args;
      for (let index = 0; index + 1 < pairs.length; index += 2) {
        if (pairs[index] === expression || pairs[index] === null && expression === null)
          return pairs[index + 1] ?? null;
      }
      return pairs.length % 2 === 1 ? pairs.at(-1) ?? null : null;
    });
    fn("to_char", (value, mask) => formatOracle(value, typeof mask === "string" ? mask : void 0));
    fn("to_number", (value) => value === null || value === "" ? null : Number(value));
    fn("to_date", (value) => {
      const date = oracleDate(value);
      return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` : null;
    });
    fn("trunc", (value, unit) => {
      if (typeof value === "number")
        return Math.trunc(value * 10 ** Number(unit ?? 0)) / 10 ** Number(unit ?? 0);
      const date = oracleDate(value);
      return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : value ?? null;
    });
    fn(
      "initcap",
      (value) => value === null ? null : String(value).toLowerCase().replace(/\b\w/gu, (char) => char.toUpperCase())
    );
    fn(
      "lpad",
      (value, size, fill2) => value === null ? null : String(value).padStart(Number(size), String(fill2 ?? " ")).slice(0, Number(size))
    );
    fn(
      "rpad",
      (value, size, fill2) => value === null ? null : String(value).padEnd(Number(size), String(fill2 ?? " ")).slice(0, Number(size))
    );
    fn("add_months", (value, months) => {
      const date = oracleDate(value);
      if (!date) return null;
      date.setMonth(date.getMonth() + Number(months));
      return date.toISOString().slice(0, 19).replace("T", " ");
    });
    fn("months_between", (left, right) => {
      const a = oracleDate(left);
      const b = oracleDate(right);
      return a && b ? (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth()) + (a.getDate() - b.getDate()) / 31 : null;
    });
    fn(
      "greatest",
      (...args) => args.some((arg) => arg === null) ? null : args.reduce((a, b) => (a ?? 0) > (b ?? 0) ? a : b)
    );
    fn(
      "least",
      (...args) => args.some((arg) => arg === null) ? null : args.reduce((a, b) => (a ?? 0) < (b ?? 0) ? a : b)
    );
    fn(
      "regexp_like",
      (value, pattern, flags) => value !== null && new RegExp(String(pattern), String(flags ?? "").includes("i") ? "iu" : "u").test(String(value)) ? 1 : 0
    );
    fn(
      "regexp_replace",
      (value, pattern, replacement) => value === null ? null : String(value).replace(new RegExp(String(pattern), "gu"), String(replacement ?? ""))
    );
    fn("v", (name) => this.#binds[String(name).toUpperCase()] ?? null);
    fn("sys_guid", () => crypto2.randomUUID().replaceAll("-", "").toUpperCase());
  }
  #prepare(sql, binds) {
    this.#binds = Object.fromEntries(Object.entries(binds).map(([key, value]) => [key.toUpperCase(), value]));
    const translated = translateOracleSql(sql);
    const values = {};
    for (const name of bindNames(translated)) values[name] = this.#binds[name.toUpperCase()] ?? null;
    const statement = this.db.prepare(translated);
    statement.setAllowUnknownNamedParameters(true);
    return { statement, values };
  }
  query(sql, binds = {}, maxRows = 1e4) {
    const { statement, values } = this.#prepare(sql, binds);
    const columns = statement.columns().map((column) => column.name.toUpperCase());
    const rows = [];
    for (const raw of statement.iterate(values)) {
      const row = {};
      for (const [key, value] of Object.entries(raw)) {
        row[key.toUpperCase()] = typeof value === "bigint" ? Number(value) : value instanceof Uint8Array ? `[blob ${value.length} bytes]` : value;
      }
      rows.push(row);
      if (rows.length >= maxRows) break;
    }
    return { columns, rows };
  }
  execute(sql, binds = {}) {
    const { statement, values } = this.#prepare(sql, binds);
    const result = statement.run(values);
    return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
  }
  scalar(sql, binds = {}) {
    const result = this.query(sql, binds, 1);
    const row = result.rows[0];
    return row ? row[result.columns[0]] ?? null : null;
  }
  tableExists(table) {
    return this.db.prepare("select 1 from sqlite_master where type in ('table','view') and upper(name) = upper(?)").get(table) !== void 0;
  }
  tableColumns(table) {
    return this.db.prepare(`pragma table_info("${table.replaceAll('"', "")}")`).all().map((column) => ({
      name: column.name.toUpperCase(),
      pk: column.pk > 0,
      type: column.type.toUpperCase()
    }));
  }
  /** Runs a script statement by statement; failures are reported, not fatal. */
  runScript(script, source) {
    const problems = [];
    for (const statement of splitScript(script)) {
      try {
        this.execute(statement);
      } catch (error) {
        problems.push(
          `${source}: ${error.message} \u2014 ${statement.replace(/\s+/gu, " ").slice(0, 140)}`
        );
      }
    }
    return problems;
  }
  close() {
    if (this.db.isOpen) this.db.close();
  }
};

// packages/core/src/preview/render.ts
import fs4 from "node:fs";
import path4 from "node:path";

// packages/core/src/preview/theme.ts
var KIND_TO_MAP = {
  template: "pages",
  plug_template: "regions",
  field_template: "fields",
  button_templates: "buttons",
  list_template: "lists",
  row_template: "reports",
  menu_template: "breadcrumbs",
  theme_style: "styles"
};
function indexTheme(calls) {
  const index = {
    theme: {},
    pages: /* @__PURE__ */ new Map(),
    regions: /* @__PURE__ */ new Map(),
    fields: /* @__PURE__ */ new Map(),
    buttons: /* @__PURE__ */ new Map(),
    lists: /* @__PURE__ */ new Map(),
    reports: /* @__PURE__ */ new Map(),
    breadcrumbs: /* @__PURE__ */ new Map(),
    styles: /* @__PURE__ */ new Map(),
    slots: /* @__PURE__ */ new Map(),
    byId: /* @__PURE__ */ new Map()
  };
  for (const call of calls) {
    const params = call.params;
    if (call.kind === "theme") index.theme = params;
    const target = KIND_TO_MAP[call.kind];
    if (target && typeof params.static_id === "string")
      index[target].set(params.static_id.toLowerCase(), params);
    if (typeof params.id === "string" && target) index.byId.set(params.id, params);
    if (call.kind === "page_tmpl_display_point" || call.kind === "plug_tmpl_display_point") {
      const owner = String(params.page_template_id ?? params.plug_template_id ?? "");
      const slots = index.slots.get(owner) ?? /* @__PURE__ */ new Map();
      if (typeof params.apexlang_name === "string" && typeof params.placeholder === "string") {
        slots.set(params.apexlang_name, params.placeholder);
      }
      index.slots.set(owner, slots);
    }
  }
  return index;
}
function text(params, key) {
  const value = params?.[key];
  return typeof value === "string" ? value : value === void 0 || value === null ? "" : String(value);
}
function defaultStaticId(index, key, fallback) {
  const id = index.theme[key];
  const params = typeof id === "string" ? index.byId.get(id) : void 0;
  return typeof params?.static_id === "string" ? params.static_id : fallback;
}
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
}
function escapeJs(value) {
  return JSON.stringify(String(value ?? "")).slice(1, -1).replaceAll("<", "\\u003c").replaceAll("'", "\\u0027");
}
function applyEscape(value, filter) {
  switch ((filter ?? "").toUpperCase()) {
    case "RAW":
      return value;
    case "JS":
      return escapeJs(value);
    case "STRIPHTML":
      return value.replace(/<[^>]*>/gu, "");
    case "URL":
      return encodeURIComponent(value);
    default:
      return escapeHtml(value);
  }
}
function applyDirectives(template, values) {
  const truthy = (name) => {
    const value = values[name.toUpperCase()] ?? "";
    return value !== "" && value !== "N" && value !== "false";
  };
  let output = template;
  for (let guard = 0; guard < 50 && output.includes("{if "); guard += 1) {
    const replaced = output.replace(
      /\{if \??([A-Za-z0-9_$]+)\/\}((?:(?!\{if )[\s\S])*?)\{endif\/\}/gu,
      (_whole, first, body2) => {
        const branches = [];
        const parts = body2.split(/\{(elsif \??[A-Za-z0-9_$]+|else)\/\}/u);
        branches.push({ name: first, body: parts[0] ?? "" });
        for (let index = 1; index < parts.length; index += 2) {
          const marker = parts[index];
          branches.push(
            marker === "else" ? { body: parts[index + 1] ?? "" } : { name: marker.replace(/^elsif \??/u, ""), body: parts[index + 1] ?? "" }
          );
        }
        return branches.find((branch) => !branch.name || truthy(branch.name))?.body ?? "";
      }
    );
    if (replaced === output) break;
    output = replaced;
  }
  return output;
}
function fill(template, values, removeUnknown = true) {
  const upper = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.toUpperCase(), value]));
  return applyDirectives(template, upper).replace(
    /#([A-Z][A-Z0-9_$]*)(?:!([A-Z]+))?#/gu,
    (whole, name, filter) => {
      if (name in upper) return filter ? applyEscape(upper[name], filter) : upper[name];
      return removeUnknown ? "" : whole;
    }
  );
}
function templateOptions(options, defaults) {
  const classes = [];
  for (const option of options.length ? options : ["#DEFAULT#"]) {
    if (option === "#DEFAULT#") classes.push(...defaults.split(/[:\s]+/u).filter(Boolean));
    else classes.push(...option.split(/\s+/u).filter(Boolean));
  }
  return [...new Set(classes)].join(" ");
}

// packages/core/src/preview/render.ts
var LOCAL_PREFIX = "/__apex";
var IMAGE_PREFIX = "/i/";
var MESSAGES = {
  APEX_PAGE_NOSCRIPT: "You must run this web page with JavaScript enabled.",
  UI_PAGE_SKIP_TO_CONTENT: "Skip to Main Content",
  "APEX.TEMPLATE.MAIN_NAV_LABEL": "Main Navigation",
  "APEX.TEMPLATE.APPLICATION": "Application",
  "APEX.SUCCESS": "Success",
  WARNING: "Warning",
  "APEX.UI.BACK_TO_TOP": "Start of page",
  DELETE_MSG: "Would you like to perform this delete action?",
  "APEX.DIALOG.CLOSE": "Close",
  "APEX.DIALOG.OK": "OK",
  "APEX.DIALOG.CANCEL": "Cancel",
  "APEX.ERROR.PAGE_ERRORS": "Errors",
  "FLOW.VALIDATION_ERROR": "%0 errors have occurred",
  "FLOW.SINGLE_VALIDATION_ERROR": "1 error has occurred",
  "APEX.ERROR.PAGE_ERROR": "Error",
  "APEX.PAGE.CONTEXT.SINGLE_ERROR": "1 error has occurred",
  "APEX.PAGE.CONTEXT.MULTIPLE_ERRORS": "%0 errors have occurred",
  "APEX.WARN_ON_UNSAVED_CHANGES": "This page has unsaved changes.",
  "APEX.PROCESSING": "Processing",
  "APEX.IG.SEARCH": "Search",
  "APEX.REGION.SEARCH": "Search",
  "APEX.DATEPICKER_VALUE_INVALID": "#LABEL# does not match format %0.",
  "APEX.VALUE_REQUIRED": "#LABEL# must have some value.",
  "APEX.NUMBER_FIELD.VALUE_INVALID": "#LABEL# must be Numeric.",
  "APEX.ITEM.HELP": "Help"
};
var PAGE_DEFAULT_SLOTS = /* @__PURE__ */ new Set(["body", "contentBody", "regionBody", ""]);
function slug(value) {
  return value.replace(/[^A-Za-z0-9_-]+/gu, "_");
}
function sequence(component) {
  return num(
    component.props,
    "layout.sequence",
    num(component.props, "execution.sequence", num(component.props, "sequence", 0))
  );
}
function bySequence(components) {
  return [...components].sort((a, b) => sequence(a) - sequence(b));
}
function heading(name) {
  return name.toLowerCase().replace(/_/gu, " ").replace(/\b\w/gu, (char) => char.toUpperCase());
}
function iconClasses(value) {
  return /(^|\s)fa-/u.test(value) && !/(^|\s)fa(\s|$)/u.test(value) ? `fa ${value}` : value;
}
function strings(values) {
  return values.map(
    (value) => typeof value === "string" ? value : isRef(value) ? value.ref : String(value)
  );
}
var ApexRenderer = class {
  app;
  assets;
  theme;
  db;
  alias;
  appId;
  diagnostics = [];
  options;
  #autoTables = /* @__PURE__ */ new Set();
  #diagnosticKeys = /* @__PURE__ */ new Set();
  constructor(app, assets, db, options = {}) {
    this.app = app;
    this.assets = assets;
    this.db = db;
    this.theme = indexTheme(assets.theme);
    this.alias = slug(app.app.id || "app").toLowerCase();
    this.appId = app.substitutions.APP_ID ?? "100";
    this.options = { toolbar: options.toolbar ?? true, sampleRows: options.sampleRows ?? 8 };
  }
  get baseUrl() {
    return `/r/${this.alias}`;
  }
  diagnose(level, message, page, component) {
    const key = `${level}|${page}|${component}|${message}`;
    if (this.#diagnosticKeys.has(key)) return;
    this.#diagnosticKeys.add(key);
    this.diagnostics.push({ level, message, ...page ? { page } : {}, ...component ? { component } : {} });
  }
  // ---------------------------------------------------------------- lookups
  shared(type, id) {
    if (!id) return void 0;
    const lower = id.toLowerCase();
    return this.app.shared.find(
      (component) => component.type === type && component.id.toLowerCase() === lower
    );
  }
  findPage(key) {
    const byId = this.app.pages.get(key);
    if (byId) return byId;
    const lower = key.toLowerCase();
    for (const page of this.app.pages.values()) {
      if (str(page.props, "alias").toLowerCase() === lower) return page;
    }
    return void 0;
  }
  homePage() {
    const home = get(this.app.app.props, "navigation.homeUrl");
    if (isObject(home) && home.page !== void 0) return this.findPage(String(home.page))?.id ?? "1";
    return this.app.pages.has("1") ? "1" : [...this.app.pages.keys()].find((id) => id !== "0") ?? "1";
  }
  pagePath(page) {
    const alias = str(page.props, "alias");
    return `${this.baseUrl}/${alias ? alias.toLowerCase() : page.id}`;
  }
  #pageComponents(ctx, type) {
    const own = ctx.page.children.filter((child) => child.type === type);
    const global = ctx.page.id !== "0" ? this.app.pages.get("0")?.children.filter((child) => child.type === type) ?? [] : [];
    return [...own, ...global];
  }
  #theme() {
    const current = ref(this.app.app.props, "userInterface.currentTheme");
    return this.shared("theme", current) ?? this.app.shared.find((component) => component.type === "theme");
  }
  // ---------------------------------------------------------------- substitutions
  #filePrefix() {
    return `${IMAGE_PREFIX}themes/theme_42/${this.assets.manifest.apexVersion.split(".").slice(0, 2).join(".")}/`;
  }
  /** `#APEX_FILES#`-style prefixes used in file URLs and HTML. */
  urls(value) {
    return value.replaceAll("#APEX_FILES#", IMAGE_PREFIX).replaceAll("#IMAGE_PREFIX#", IMAGE_PREFIX).replaceAll("#THEME_FILES#", this.#filePrefix()).replaceAll("#THEME_IMAGES#", this.#filePrefix()).replaceAll("#APP_FILES#", `${this.baseUrl}/files/static/v1/`).replaceAll("#APP_IMAGES#", `${this.baseUrl}/files/static/v1/`).replaceAll("#WORKSPACE_FILES#", `${this.baseUrl}/files/workspace/`).replaceAll("#WORKSPACE_IMAGES#", `${this.baseUrl}/files/workspace/`).replaceAll("#MIN_DIRECTORY#", "minified/").replaceAll("#MIN#", ".min").replaceAll("#APEX_VERSION#", APEX_FULL_VERSION).replaceAll("#APEX_BASE_VERSION#", APEX_FULL_VERSION.split(".").slice(0, 2).join(".")).replaceAll("#APP_VERSION#", "");
  }
  #builtin(session, page) {
    const app = this.app.app.props;
    return {
      APP_ID: this.appId,
      APP_ALIAS: this.alias.toUpperCase(),
      APP_NAME: str(app, "name", this.app.app.id),
      APP_TITLE: str(app, "name", this.app.app.id),
      APP_USER: session.user,
      APP_SESSION: session.id,
      SESSION: session.id,
      APP_PAGE_ID: page?.id ?? "",
      APP_PAGE_ALIAS: str(page?.props ?? {}, "alias").toUpperCase(),
      APP_VERSION: "",
      APP_TENANT_ID: "",
      BROWSER_LANGUAGE: "en",
      LOGOUT_URL: `${this.baseUrl}/__logout`,
      APP_IMAGES: `${this.baseUrl}/files/static/v1/`,
      APP_FILES: `${this.baseUrl}/files/static/v1/`,
      IMAGE_PREFIX,
      DEBUG: "NO",
      REQUEST: "",
      ...Object.fromEntries(
        this.app.shared.filter((component) => component.type === "substitution").map((component) => [
          component.id.toUpperCase(),
          str(component.props, "value.staticValue", str(component.props, "value"))
        ])
      ),
      ...Object.fromEntries(
        this.app.app.children.filter((component) => component.type === "substitution").map((component) => [
          component.id.toUpperCase(),
          str(component.props, "value.staticValue", str(component.props, "value"))
        ])
      )
    };
  }
  /** Session state, built-ins, and `&APP_TEXT$...` messages for `&NAME.` substitutions. */
  substitute(session, value, page, defaultEscape = "HTML") {
    const builtins = this.#builtin(session, page);
    const replaced = value.replace(
      /&(?:"([^"]+)"|([A-Za-z][\w$#.]*?))(?:!([A-Z]+))?\./gu,
      (whole, quoted, plain, filter) => {
        const name = (quoted ?? plain ?? "").toUpperCase();
        let resolved;
        if (name.startsWith("APP_TEXT$")) resolved = MESSAGES[name.slice(9)] ?? name.slice(9);
        else if (name in session.items) resolved = session.items[name];
        else if (name in builtins) resolved = builtins[name];
        else if (this.#isKnownItem(name)) resolved = "";
        if (resolved === void 0) return whole;
        return applyEscape(resolved, filter ?? defaultEscape);
      }
    );
    return this.urls(replaced);
  }
  #isKnownItem(name) {
    for (const page of this.app.pages.values()) {
      if (page.children.some((child) => child.type === "pageItem" && child.id.toUpperCase() === name))
        return true;
    }
    return this.app.shared.some(
      (component) => component.type === "appItem" && component.id.toUpperCase() === name
    );
  }
  binds(session, page) {
    const builtins = this.#builtin(session, page);
    return { ...builtins, ...session.items };
  }
  // ---------------------------------------------------------------- conditions
  #condition(ctx, props, key = "serverSideCondition") {
    const condition = get(props, key);
    if (!isObject(condition)) return true;
    const type = str(condition, "type");
    const item = str(condition, "item").toUpperCase();
    const value = str(condition, "value");
    const itemValue = ctx.session.items[item] ?? "";
    const request = ctx.request;
    const runQuery = () => {
      const sql = str(condition, "sqlQuery");
      try {
        return this.db.query(sql, this.binds(ctx.session, ctx.page), 1).rows.length > 0;
      } catch (error) {
        this.diagnose(
          "warning",
          `Condition query failed (${error.message}); treated as true`,
          ctx.pageId
        );
        return true;
      }
    };
    switch (type) {
      case "itemIsNull":
        return itemValue === "";
      case "itemIsNotNull":
        return itemValue !== "";
      case "item=value":
      case "itemEqualsValue":
        return itemValue === value;
      case "item!=value":
      case "itemNotEqualsValue":
        return itemValue !== value;
      case "itemIsZero":
        return itemValue === "0";
      case "itemIsNotZero":
        return itemValue !== "0";
      case "itemInValue":
      case "valueOfItemInExpression1IsContainedInExpression2":
        return value.split(",").includes(itemValue);
      case "requestEqualsValue":
      case "request=value":
        return request === value;
      case "requestNotEqualsValue":
      case "request!=value":
        return request !== value;
      case "requestIsContainedInValue":
        return value.split(",").map((part) => part.trim()).includes(request);
      case "requestIsNotContainedInValue":
        return !value.split(",").map((part) => part.trim()).includes(request);
      case "userIsAuthenticated":
        return true;
      case "userIsThePublicUser":
      case "never":
        return false;
      case "always":
      case "":
        return true;
      case "rowsReturned":
        return runQuery();
      case "noRowsReturned":
        return !runQuery();
      case "currentPageEquals":
      case "currentPage=page":
        return ctx.pageId === value;
      case "currentPageIsInValue":
        return value.split(",").includes(ctx.pageId);
      default:
        this.diagnose(
          "info",
          `Server-side condition type "${type}" is not evaluated locally; treated as true`,
          ctx.pageId
        );
        return true;
    }
  }
  #whenButton(ctx, props) {
    const pressed = ref(props, "serverSideCondition.whenButtonPressed");
    if (!pressed) return true;
    const button = this.#pageComponents(ctx, "button").find((candidate) => candidate.id === pressed);
    return (button ? str(button.props, "buttonName", button.id.toUpperCase()) : pressed.toUpperCase()) === ctx.request;
  }
  #visible(ctx, component) {
    return this.#condition(ctx, component.props);
  }
  // ---------------------------------------------------------------- links
  #targetUrl(ctx, target, row) {
    if (typeof target === "string") return { href: this.substitute(ctx.session, target, ctx.page, "RAW") };
    if (!isObject(target)) return { href: "#" };
    const rowValue = (value) => value.replace(
      /#([A-Z0-9_$]+)#/gu,
      (whole, name) => row && name in row ? String(row[name] ?? "") : whole
    );
    if (str(target, "type") === "url" || target.url !== void 0) {
      const url = rowValue(str(target, "url"));
      return { href: url === "separator" ? "separator" : this.substitute(ctx.session, url, ctx.page, "RAW") };
    }
    const pageKey = this.substitute(ctx.session, rowValue(str(target, "page", ctx.pageId)), ctx.page, "RAW");
    const page = this.findPage(pageKey);
    const parameters = new URLSearchParams();
    const items = get(target, "items");
    if (isObject(items)) {
      for (const [name, value] of Object.entries(items)) {
        const raw = typeof value === "string" ? value : isRef(value) ? `&${value.ref}.` : String(value);
        parameters.set(name.toLowerCase(), this.substitute(ctx.session, rowValue(raw), ctx.page, "RAW"));
      }
    }
    const clear = str(target, "clearCache");
    if (clear) parameters.set("clear", clear);
    const request = str(target, "request");
    if (request) parameters.set("request", request);
    const query = parameters.toString();
    const base = page ? this.pagePath(page) : `${this.baseUrl}/${pageKey}`;
    return { href: `${base}${query ? `?${query}` : ""}`, ...page ? { page } : {} };
  }
  #isDialog(page) {
    const mode = str(page?.props ?? {}, "appearance.pageMode");
    return mode === "modalDialog" || mode === "nonModalDialog" || mode === "drawer";
  }
  #pageTemplateId(page) {
    const theme = this.#theme();
    if (this.#isDialog(page)) {
      return (ref(page.props, "appearance.dialogTemplate") ?? ref(theme?.props ?? {}, "dialogDefaults.dialogPage") ?? defaultStaticId(this.theme, "default_dialog_template", "modal-dialog")).toLowerCase();
    }
    const explicit = ref(page.props, "appearance.pageTemplate");
    if (explicit) return explicit.toLowerCase();
    const login = get(this.app.app.props, "navigation.loginUrl");
    const loginPage = isObject(login) ? this.findPage(str(login, "page")) : void 0;
    if (loginPage === page || /login/iu.test(str(page.props, "alias"))) {
      return (ref(theme?.props ?? {}, "componentDefaults.loginPage") ?? "login").toLowerCase();
    }
    return (ref(theme?.props ?? {}, "componentDefaults.page") ?? defaultStaticId(this.theme, "default_page_template", "standard")).toLowerCase();
  }
  /** Link to a page: modal targets open through the theme's dialog JavaScript. */
  link(ctx, target, row, triggeringElement = "this") {
    const { href, page } = this.#targetUrl(ctx, target, row);
    if (!page || !this.#isDialog(page)) return href;
    return `javascript:${this.#dialogJs(page, href, triggeringElement)}`;
  }
  #dialogJs(page, url, triggeringElement) {
    const template = this.theme.pages.get(this.#pageTemplateId(page)) ?? this.theme.pages.get("modal-dialog");
    const options = strings(list(page.props, "appearance.templateOptions"));
    const dialogClasses = options.filter((option) => option.startsWith("js-dialog-class-")).map((option) => option.slice(16));
    const pageClasses = options.filter(
      (option) => option !== "#DEFAULT#" && !option.startsWith("js-dialog-class-")
    );
    const attributes = [];
    if (get(page.props, "dialog.resizable") !== void 0)
      attributes.push(`resizable:${bool(page.props, "dialog.resizable", true)}`);
    if (get(page.props, "dialog.chained") !== void 0)
      attributes.push(`chained:${bool(page.props, "dialog.chained", true)}`);
    const literal = (value) => `'${escapeJs(value)}'`;
    const code = text(template, "dialog_js_init_code") || "apex.navigation.dialog(#PAGE_URL#,{title:#TITLE#,height:#DIALOG_HEIGHT#,width:#DIALOG_WIDTH#,maxWidth:#DIALOG_MAX_WIDTH#,modal:#IS_MODAL#,dialog:#DIALOG#,#DIALOG_ATTRIBUTES#},#PAGE_CSS_CLASSES#,#TRIGGERING_ELEMENT#)";
    return fill(code, {
      PAGE_URL: literal(url),
      TITLE: literal(str(page.props, "title", str(page.props, "name"))),
      DIALOG_HEIGHT: literal(str(page.props, "dialog.height", text(template, "dialog_height") || "auto")),
      DIALOG_WIDTH: literal(str(page.props, "dialog.width", text(template, "dialog_width") || "720")),
      DIALOG_MAX_WIDTH: literal(
        str(page.props, "dialog.maxWidth", text(template, "dialog_max_width") || "960")
      ),
      IS_MODAL: String(str(page.props, "appearance.pageMode") !== "nonModalDialog"),
      DIALOG: "null",
      DIALOG_CSS_CLASSES: literal(dialogClasses.join(" ")),
      DIALOG_ATTRIBUTES: attributes.join(","),
      PAGE_CSS_CLASSES: literal(pageClasses.join(" ")),
      TRIGGERING_ELEMENT: triggeringElement
    }).replace(/,\}/gu, "}");
  }
  // ---------------------------------------------------------------- LOVs
  lov(ctx, spec, owner) {
    if (!isObject(spec)) return [];
    const type = str(spec, "type");
    if (type === "sharedComponent" || ref(spec, "lov")) {
      const shared = this.shared("lov", ref(spec, "lov"));
      if (!shared) {
        this.diagnose("warning", `LOV @${ref(spec, "lov")} not found`, ctx.pageId, owner);
        return [];
      }
      return this.#sharedLov(ctx, shared);
    }
    if (type === "staticValues" || spec.staticValues !== void 0)
      return this.#staticLov(str(spec, "staticValues"));
    if (type === "sqlQuery" || spec.sqlQuery !== void 0)
      return this.#queryLov(ctx, str(spec, "sqlQuery"), void 0, void 0, owner);
    return [];
  }
  #staticLov(value) {
    const body2 = value.replace(/^STATIC2?:/u, "");
    if (!body2) return [];
    return body2.split(",").map((entry) => {
      const [display, returned] = entry.split(";");
      return { d: display ?? "", r: returned ?? display ?? "" };
    });
  }
  #queryLov(ctx, sql, display, returned, owner) {
    try {
      const result = this.db.query(sql, this.binds(ctx.session, ctx.page), 5e3);
      const displayColumn = display?.toUpperCase() ?? result.columns[0];
      const returnColumn = returned?.toUpperCase() ?? result.columns[1] ?? displayColumn;
      return result.rows.map((row) => ({
        d: String(row[displayColumn] ?? ""),
        r: String(row[returnColumn] ?? "")
      }));
    } catch (error) {
      this.diagnose("warning", `LOV query failed: ${error.message}`, ctx.pageId, owner);
      return [];
    }
  }
  #sharedLov(ctx, lov) {
    const entries = bySequence(lov.children.filter((child) => child.type === "entry"));
    if (entries.length || str(lov.props, "source.location") === "staticValues") {
      return entries.map((entry) => ({
        d: str(entry.props, "display"),
        r: str(entry.props, "return", str(entry.props, "display"))
      }));
    }
    const display = str(lov.props, "columnMapping.display") || void 0;
    const returned = str(lov.props, "columnMapping.return") || void 0;
    const table = str(lov.props, "source.tableName");
    const sql = str(lov.props, "source.sqlQuery") || (table ? `select * from ${table}` : "");
    if (!sql) return [];
    if (table)
      this.#ensureTable(
        ctx,
        table,
        [display, returned].filter((value) => Boolean(value)).map((name) => ({ name, type: "varchar2" }))
      );
    return this.#queryLov(ctx, sql, display, returned, `lov ${lov.id}`);
  }
  // ---------------------------------------------------------------- data
  /** Creates an empty-but-plausible table so a design can be previewed before real DDL exists. */
  #ensureTable(ctx, table, columns) {
    const name = table.replaceAll('"', "");
    if (this.db.tableExists(name)) return false;
    const unique = /* @__PURE__ */ new Map();
    for (const column of [...this.#tableHints(name), ...columns])
      if (column.name && !unique.has(column.name.toUpperCase()))
        unique.set(column.name.toUpperCase(), column);
    if (!unique.size) unique.set("ID", { name: "ID", type: "number", pk: true });
    const definitions = [...unique.values()].map((column) => {
      const type = /number|integer/iu.test(column.type) || /(^ID|_ID)$/iu.test(column.name) ? "NUMBER" : /date|timestamp/iu.test(column.type) ? "DATE" : "VARCHAR2(4000)";
      return `"${column.name.toUpperCase()}" ${column.pk && type === "NUMBER" ? "INTEGER PRIMARY KEY" : type}`;
    });
    this.db.execute(`create table "${name.toUpperCase()}" (${definitions.join(", ")})`);
    const rows = this.options.sampleRows;
    for (let index = 1; index <= rows; index += 1) {
      const values = {};
      for (const column of unique.values()) {
        const key = column.name.toUpperCase();
        const identifier = /(^ID|_ID)$/u.test(key);
        if (identifier || /number|integer/iu.test(column.type))
          values[key] = String(column.pk || identifier ? index : index * 10);
        else if (/date|timestamp/iu.test(column.type))
          values[key] = new Date(Date.now() - index * 864e5).toISOString().slice(0, 10);
        else {
          const sample = `${(column.label ?? "").replace(/<[^>]*>/gu, "").trim() || heading(key)} ${index}`;
          values[key] = column.max && sample.length > column.max ? sample.slice(-column.max) : sample;
        }
      }
      const keys = Object.keys(values);
      this.db.execute(
        `insert into "${name.toUpperCase()}" (${keys.map((key) => `"${key}"`).join(", ")}) values (${keys.map((key) => `:${key.replace(/\W/gu, "_")}`).join(", ")})`,
        Object.fromEntries(keys.map((key) => [key.replace(/\W/gu, "_"), values[key]]))
      );
    }
    this.#autoTables.add(name.toUpperCase());
    this.diagnose(
      "info",
      `Table ${name.toUpperCase()} did not exist; created it with ${rows} sample rows. Put real DDL/data in .apex-local/*.sql`,
      ctx.pageId
    );
    return true;
  }
  #tableHints(table) {
    const hints = [];
    for (const page of this.app.pages.values()) {
      const regions = page.children.filter(
        (child) => child.type === "region" && str(child.props, "source.tableName").toUpperCase() === table.toUpperCase()
      );
      for (const region of regions)
        for (const item of page.children.filter(
          (child) => child.type === "pageItem" && ref(child.props, "source.formRegion") === region.id
        )) {
          const column = str(item.props, "source.column");
          if (!column) continue;
          const itemType = str(item.props, "type");
          hints.push({
            name: column,
            type: itemType === "numberField" ? "number" : itemType === "datePicker" ? "date" : str(item.props, "source.dataType", "varchar2"),
            pk: bool(item.props, "source.primaryKey", false),
            label: str(item.props, "label.label") || void 0,
            max: num(item.props, "validation.maxLength", 0) || void 0
          });
        }
    }
    return hints;
  }
  #regionColumns(ctx, region) {
    const columns = region.children.filter((child) => child.type === "column").map((column) => ({
      name: column.id,
      type: str(column.props, "source.dataType", "varchar2"),
      label: str(column.props, "heading.heading") || void 0,
      pk: bool(column.props, "source.primaryKey", false)
    }));
    const items = this.#pageComponents(ctx, "pageItem").filter(
      (item) => ref(item.props, "source.formRegion") === region.id && str(item.props, "source.column")
    ).map((item) => ({
      name: str(item.props, "source.column"),
      type: str(item.props, "source.dataType", "varchar2"),
      pk: bool(item.props, "source.primaryKey", false),
      label: str(item.props, "label.label") || void 0,
      max: num(item.props, "validation.maxLength", 0) || void 0
    }));
    return [...items, ...columns];
  }
  #regionSql(ctx, region) {
    const source = region.props.source;
    if (!isObject(source)) return void 0;
    const table = str(source, "tableName");
    const where = str(source, "whereClause") || str(source, "where");
    const orderBy = str(source, "orderByClause") || str(source, "orderBy");
    let sql = str(source, "sqlQuery");
    if (!sql && table) {
      this.#ensureTable(ctx, table, this.#regionColumns(ctx, region));
      sql = `select * from ${table}`;
    }
    if (!sql) return void 0;
    if (where) sql = `select * from (${sql}) where ${where}`;
    if (orderBy) sql = `${sql} order by ${orderBy}`;
    return sql;
  }
  #query(ctx, region, sql, maxRows = 1e4) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return this.db.query(sql, this.binds(ctx.session, ctx.page), maxRows);
      } catch (error) {
        const message = error.message;
        if (attempt < 25 && this.#repairSchema(ctx, region, sql, message)) continue;
        const dictionary = /no such table: (?:main\.)?"?(APEX_[\w$#]+)/iu.exec(message)?.[1];
        if (dictionary) {
          const view = dictionary.toUpperCase();
          this.diagnose(
            "warning",
            `Region ${region.id} reads APEX dictionary view ${view}, which is not available locally`,
            ctx.pageId,
            region.id
          );
          return {
            columns: [],
            rows: [],
            error: `APEX dictionary view ${view} is not available in the local preview.`
          };
        }
        this.diagnose("error", `SQL failed in region ${region.id}: ${message}`, ctx.pageId, region.id);
        return { columns: [], rows: [], error: message };
      }
    }
  }
  /**
   * Grows auto-created sample tables so queries written for the real schema still run:
   * missing tables are created and missing columns are added with sample values.
   */
  #repairSchema(ctx, region, sql, message) {
    const missingTable = /no such table: (?:main\.)?"?([\w$#]+)"?/iu.exec(message)?.[1];
    if (missingTable) {
      if (/^APEX_/iu.test(missingTable)) {
        this.diagnose(
          "info",
          `APEX dictionary view ${missingTable.toUpperCase()} is not available locally`,
          ctx.pageId,
          region.id
        );
        return false;
      }
      return this.#ensureTable(ctx, missingTable, this.#regionColumns(ctx, region));
    }
    const missingColumn = /no such column: (?:"?[\w$#]+"?\.)?"?([\w$#]+)"?/iu.exec(message)?.[1];
    if (!missingColumn) return false;
    const column = missingColumn.toUpperCase();
    const referenced = [...this.#autoTables].filter(
      (table) => new RegExp(`\\b"?${table}"?\\b`, "iu").test(sql)
    );
    for (const table of referenced) {
      if (this.db.tableColumns(table).some((existing) => existing.name === column)) continue;
      const numeric = /(_ID|ID|_NO|COUNT|TOTAL|AMOUNT|PRICE|QTY|QUANTITY|SALARY|SAL|VALUE|NUMBER)$/u.test(
        column
      );
      const date = /(DATE|_ON|_AT|TIMESTAMP)$/u.test(column);
      this.db.execute(
        `alter table "${table}" add column "${column}" ${numeric ? "NUMBER" : date ? "DATE" : "VARCHAR2(4000)"}`
      );
      this.db.execute(
        `update "${table}" set "${column}" = ${numeric ? "rowid" : date ? "date('now', '-' || rowid || ' days')" : `'${heading(column).replaceAll("'", "''")} ' || rowid`}`
      );
      this.diagnose(
        "info",
        `Added sample column ${column} to auto-created table ${table}`,
        ctx.pageId,
        region.id
      );
      return true;
    }
    return false;
  }
  // ---------------------------------------------------------------- page processing
  /** Before-header computations and form initialization. */
  prepare(session, pageKey, request = "") {
    const page = this.findPage(pageKey);
    if (!page) throw new Error(`Page ${pageKey} does not exist`);
    const ctx = {
      session,
      page,
      pageId: page.id,
      request,
      onload: [],
      jsFiles: /* @__PURE__ */ new Set(),
      cssFiles: /* @__PURE__ */ new Set(),
      clientConfig: { regions: [], dynamicActions: [] },
      itemErrors: /* @__PURE__ */ new Map(),
      messageTemplates: {}
    };
    for (const item of this.#pageComponents(ctx, "pageItem")) {
      const name = item.id.toUpperCase();
      if ((session.items[name] ?? "") !== "") continue;
      const type = str(item.props, "default.type");
      const value = str(item.props, "default.staticValue") || str(item.props, "default.value");
      if (value && (type === "" || type === "static" || type === "staticValue"))
        session.items[name] = this.substitute(session, value, page, "RAW");
      else if (type === "sqlQuery" || type === "expression") {
        const sql = str(item.props, "default.sqlQuery") || str(item.props, "default.sqlExpression");
        if (sql) {
          try {
            session.items[name] = String(
              this.db.scalar(sql.startsWith("select") ? sql : `select ${sql}`, this.binds(session, page)) ?? ""
            );
          } catch {
            this.diagnose("info", `Default for ${name} not evaluated`, page.id, name);
          }
        }
      }
    }
    for (const computation of bySequence(this.#pageComponents(ctx, "computation"))) {
      const point = str(computation.props, "execution.point", "beforeHeader");
      if (point === "beforeHeader" && this.#condition(ctx, computation.props))
        this.#compute(ctx, computation);
    }
    for (const process2 of bySequence(this.#pageComponents(ctx, "process"))) {
      if (str(process2.props, "execution.point") !== "beforeHeader" || !this.#condition(ctx, process2.props))
        continue;
      const type = str(process2.props, "type");
      if (type === "formInitialization") this.#initializeForm(ctx, ref(process2.props, "formRegion"));
      else if (type === "clearSessionState") this.#clearPage(ctx);
      else if (type === "executeCode") this.#runCode(ctx, process2);
    }
    return ctx;
  }
  #compute(ctx, computation) {
    const item = (str(computation.props, "item") || computation.id).toUpperCase();
    const type = str(computation.props, "computation.type", str(computation.props, "type"));
    const value = str(computation.props, "computation.staticValue") || str(computation.props, "computation.value");
    const sql = str(computation.props, "computation.sqlQuery");
    if (type.startsWith("static") || !sql && value)
      ctx.session.items[item] = this.substitute(ctx.session, value, ctx.page, "RAW");
    else if (sql) {
      try {
        ctx.session.items[item] = String(this.db.scalar(sql, this.binds(ctx.session, ctx.page)) ?? "");
      } catch (error) {
        this.diagnose(
          "warning",
          `Computation ${computation.id} failed: ${error.message}`,
          ctx.pageId
        );
      }
    } else
      this.diagnose("info", `Computation ${computation.id} (${type}) is not evaluated locally`, ctx.pageId);
  }
  #formItems(ctx, regionId) {
    return this.#pageComponents(ctx, "pageItem").filter(
      (item) => ref(item.props, "source.formRegion") === regionId && str(item.props, "source.column")
    );
  }
  #initializeForm(ctx, regionId) {
    const region = this.#pageComponents(ctx, "region").find((candidate) => candidate.id === regionId);
    if (!region) return;
    const table = str(region.props, "source.tableName");
    const items = this.#formItems(ctx, regionId);
    const keys = items.filter((item) => bool(item.props, "source.primaryKey", false));
    if (!table || !keys.length) return;
    this.#ensureTable(ctx, table, this.#regionColumns(ctx, region));
    if (keys.some((key) => !ctx.session.items[key.id.toUpperCase()])) {
      for (const item of items) if (!keys.includes(item)) delete ctx.session.items[item.id.toUpperCase()];
      return;
    }
    const where = keys.map((key) => `"${str(key.props, "source.column").toUpperCase()}" = :${key.id.toUpperCase()}`).join(" and ");
    const result = this.#query(ctx, region, `select * from ${table} where ${where}`, 1);
    const row = result.rows[0];
    if (!row) return;
    for (const item of items) {
      const value = row[str(item.props, "source.column").toUpperCase()];
      ctx.session.items[item.id.toUpperCase()] = value === null || value === void 0 ? "" : String(value);
    }
  }
  #clearPage(ctx) {
    for (const item of ctx.page.children.filter((child) => child.type === "pageItem"))
      delete ctx.session.items[item.id.toUpperCase()];
  }
  /** PL/SQL cannot run here; bodies made only of SQL DML are executed, anything else is reported. */
  #runCode(ctx, process2, codeKey = "source.plsqlCode") {
    const code = str(process2.props, codeKey) || str(process2.props, "settings.plsqlCode") || str(process2.props, "source.code");
    const body2 = code.trim().replace(/^begin\b/iu, "").replace(/\bend\s*;\s*$/iu, "").trim();
    const statements = body2 ? splitScript(body2.endsWith(";") ? body2 : `${body2};`) : [];
    if (!statements.length || statements.some(
      (statement) => !/^(insert|update|delete|merge)\b/iu.test(statement.trim()) || /\breturning\b/iu.test(statement)
    )) {
      this.diagnose(
        "info",
        `PL/SQL in ${process2.type} ${process2.id} was skipped (only plain DML runs locally)`,
        ctx.pageId,
        process2.id
      );
      return false;
    }
    try {
      for (const statement of statements) this.db.execute(statement, this.binds(ctx.session, ctx.page));
      return true;
    } catch (error) {
      this.diagnose(
        "warning",
        `DML in ${process2.id} failed: ${error.message}`,
        ctx.pageId,
        process2.id
      );
      return false;
    }
  }
  // ---------------------------------------------------------------- submit
  isLoginPage(pageKey) {
    const page = this.findPage(pageKey);
    return Boolean(page) && this.#pageTemplateId(page) === "login";
  }
  /** Any credentials sign in locally; the username becomes APP_USER. */
  login(session, values) {
    const username = Object.entries(values).find(
      ([name]) => /USERNAME$|USER_NAME$/u.test(name.toUpperCase())
    )?.[1];
    session.user = (username || "DEVELOPER").toUpperCase();
    const home = this.findPage(this.homePage());
    return { redirectURL: home ? this.pagePath(home) : this.baseUrl };
  }
  /** Implements `wwv_flow.accept` for apex.page.submit (reload on submit = "S"). */
  accept(session, pageKey, request, values) {
    const ctx = this.prepareSubmit(session, pageKey, request);
    for (const [name, value] of Object.entries(values)) session.items[name.toUpperCase()] = value;
    const pressed = this.#pageComponents(ctx, "button").find(
      (button) => str(button.props, "buttonName", button.id.toUpperCase()) === request
    );
    const validate = pressed ? bool(pressed.props, "behavior.executeValidations", true) : true;
    const errors = validate ? this.#validate(ctx) : [];
    if (errors.length) return { errors };
    let closeDialog = false;
    let success = "";
    for (const process2 of bySequence(this.#pageComponents(ctx, "process"))) {
      const point = str(process2.props, "execution.point", "processing");
      if (point !== "processing" && point !== "afterSubmit" && point !== "onSubmitBeforeComputations")
        continue;
      if (!this.#whenButton(ctx, process2.props) || !this.#condition(ctx, process2.props)) continue;
      const type = str(process2.props, "type");
      let ran = true;
      if (type === "formAutoRowProcessing")
        ran = this.#processForm(ctx, ref(process2.props, "formRegion"), pressed);
      else if (type === "closeDialog") closeDialog = true;
      else if (type === "clearSessionState") this.#clearPage(ctx);
      else if (type === "executeCode") ran = this.#runCode(ctx, process2);
      else if (type === "formInitialization") this.#initializeForm(ctx, ref(process2.props, "formRegion"));
      else {
        ran = false;
        this.diagnose(
          "info",
          `Process type ${type} (${process2.id}) is not simulated`,
          ctx.pageId,
          process2.id
        );
      }
      const message = str(process2.props, "successMessage.successMessage") || str(process2.props, "successMessage") || str(process2.props, "messages.successMessage");
      if (ran && message) success = this.substitute(session, message, ctx.page, "RAW");
    }
    if (pressed && str(pressed.props, "behavior.successMessage"))
      success = str(pressed.props, "behavior.successMessage");
    if (success) session.success = success;
    if (closeDialog)
      return {
        redirectURL: `${this.baseUrl}${LOCAL_PREFIX}/close-dialog?page=${encodeURIComponent(ctx.pageId)}`
      };
    for (const branch of bySequence(this.#pageComponents(ctx, "branch"))) {
      if (!this.#whenButton(ctx, branch.props) || !this.#condition(ctx, branch.props)) continue;
      const target = get(branch.props, "behavior.target");
      if (target !== void 0) return { redirectURL: this.#targetUrl(ctx, target).href };
    }
    if (pressed && str(pressed.props, "behavior.action") === "redirectThisApp") {
      return { redirectURL: this.#targetUrl(ctx, get(pressed.props, "behavior.target")).href };
    }
    return { redirectURL: this.pagePath(ctx.page) };
  }
  prepareSubmit(session, pageKey, request) {
    const page = this.findPage(pageKey);
    if (!page) throw new Error(`Page ${pageKey} does not exist`);
    return {
      session,
      page,
      pageId: page.id,
      request,
      onload: [],
      jsFiles: /* @__PURE__ */ new Set(),
      cssFiles: /* @__PURE__ */ new Set(),
      clientConfig: { regions: [], dynamicActions: [] },
      itemErrors: /* @__PURE__ */ new Map(),
      messageTemplates: {}
    };
  }
  #label(item) {
    return str(item.props, "label.label", heading(item.id.replace(/^P\d+_/u, "")));
  }
  #validate(ctx) {
    const errors = [];
    const add = (message, item) => errors.push({
      type: "error",
      location: item ? ["inline", "page"] : ["page"],
      ...item ? { pageItem: item } : {},
      message,
      unsafe: false
    });
    for (const item of this.#pageComponents(ctx, "pageItem")) {
      if (!this.#visible(ctx, item) || !this.#regionVisible(ctx, ref(item.props, "layout.region"))) continue;
      const name = item.id.toUpperCase();
      const value = ctx.session.items[name] ?? "";
      const label = this.#label(item);
      if (bool(item.props, "validation.valueRequired", false) && value === "")
        add(`${label} must have some value.`, name);
      const max = num(item.props, "validation.maxLength", 0);
      if (max && value.length > max) add(`${label} exceeds the maximum length of ${max}.`, name);
      if (str(item.props, "type") === "numberField" && value !== "" && !Number.isFinite(Number(value.replaceAll(",", ""))))
        add(`${label} must be Numeric.`, name);
    }
    for (const validation of bySequence(this.#pageComponents(ctx, "validation"))) {
      if (!this.#whenButton(ctx, validation.props) || !this.#condition(ctx, validation.props)) continue;
      const type = str(validation.props, "validation.type");
      const item = str(validation.props, "validation.item").toUpperCase();
      const message = str(validation.props, "error.errorMessage", `${validation.id} failed`);
      const value = ctx.session.items[item] ?? "";
      const associated = str(validation.props, "error.associatedItem").toUpperCase() || item || void 0;
      let failed;
      if (type === "itemIsNotNull" || type === "itemNotNull") failed = value === "";
      else if (type === "itemIsNumeric") failed = value !== "" && !Number.isFinite(Number(value));
      else if (type === "itemIsADate") failed = value !== "" && Number.isNaN(new Date(value).getTime());
      else if (type === "rowsReturned" || type === "noRowsReturned" || type === "exists" || type === "notExists") {
        try {
          const found = this.db.query(str(validation.props, "validation.sqlQuery"), this.binds(ctx.session, ctx.page), 1).rows.length > 0;
          failed = type === "rowsReturned" || type === "exists" ? !found : found;
        } catch {
          failed = void 0;
        }
      }
      if (failed === void 0)
        this.diagnose(
          "info",
          `Validation ${validation.id} (${type}) is not evaluated locally`,
          ctx.pageId,
          validation.id
        );
      else if (failed) add(this.substitute(ctx.session, message, ctx.page, "RAW"), associated);
    }
    return errors;
  }
  #regionVisible(ctx, regionId) {
    if (!regionId) return true;
    const region = this.#pageComponents(ctx, "region").find((candidate) => candidate.id === regionId);
    if (!region) return true;
    return this.#visible(ctx, region) && this.#regionVisible(ctx, ref(region.props, "layout.parentRegion"));
  }
  #processForm(ctx, regionId, pressed) {
    const region = this.#pageComponents(ctx, "region").find((candidate) => candidate.id === regionId);
    if (!region) return false;
    const table = str(region.props, "source.tableName");
    if (!table) {
      this.diagnose("info", `Form ${regionId} has no table; DML skipped`, ctx.pageId, regionId);
      return false;
    }
    this.#ensureTable(ctx, table, this.#regionColumns(ctx, region));
    const items = this.#formItems(ctx, regionId).filter(
      (item) => !bool(item.props, "source.queryOnly", false) || bool(item.props, "source.primaryKey", false)
    );
    const keys = items.filter((item) => bool(item.props, "source.primaryKey", false));
    const columns = new Set(this.db.tableColumns(table).map((column2) => column2.name));
    const action = pressed ? str(pressed.props, "behavior.databaseAction") : "";
    const request = ctx.request;
    const operation = action === "insert" || /^(CREATE|INSERT|ADD)$/u.test(request) ? "insert" : action === "update" || /^(SAVE|APPLY CHANGES|UPDATE)$/u.test(request) ? "update" : action === "delete" || /^(DELETE|REMOVE)$/u.test(request) ? "delete" : "";
    if (!operation) return false;
    const binds = this.binds(ctx.session, ctx.page);
    const column = (item) => str(item.props, "source.column").toUpperCase();
    const where = keys.map((key) => `"${column(key)}" = :${key.id.toUpperCase()}`).join(" and ");
    try {
      if (operation === "insert") {
        const values = items.filter(
          (item) => columns.has(column(item)) && !(keys.includes(item) && !ctx.session.items[item.id.toUpperCase()])
        );
        for (const key of keys) {
          const name = key.id.toUpperCase();
          if (!ctx.session.items[name]) {
            const next = this.db.scalar(`select coalesce(max("${column(key)}"), 0) + 1 from ${table}`);
            ctx.session.items[name] = String(next);
            binds[name] = String(next);
            values.push(key);
          }
        }
        this.db.execute(
          `insert into ${table} (${values.map((item) => `"${column(item)}"`).join(", ")}) values (${values.map((item) => `:${item.id.toUpperCase()}`).join(", ")})`,
          binds
        );
        ctx.session.success = "Action Processed.";
      } else if (operation === "update" && where) {
        const values = items.filter((item) => !keys.includes(item) && columns.has(column(item)));
        if (values.length)
          this.db.execute(
            `update ${table} set ${values.map((item) => `"${column(item)}" = :${item.id.toUpperCase()}`).join(", ")} where ${where}`,
            binds
          );
        ctx.session.success = "Action Processed.";
      } else if (operation === "delete" && where) {
        this.db.execute(`delete from ${table} where ${where}`, binds);
        ctx.session.success = "Action Processed.";
      }
      return true;
    } catch (error) {
      this.diagnose(
        "error",
        `Automatic row processing on ${table} failed: ${error.message}`,
        ctx.pageId,
        regionId
      );
      return false;
    }
  }
  /** Server half of the local "Execute Server-side Code" dynamic action. */
  executeServerCode(session, pageKey, code, submitted, returnItems) {
    const ctx = this.prepareSubmit(session, pageKey, "");
    for (const [name, value] of Object.entries(submitted)) session.items[name.toUpperCase()] = value;
    const pseudo = {
      type: "dynamicAction",
      id: "server-side-code",
      props: { source: { plsqlCode: code } },
      children: [],
      file: "",
      line: 0
    };
    this.#runCode(ctx, pseudo);
    return Object.fromEntries(
      returnItems.map((name) => [name.toUpperCase(), session.items[name.toUpperCase()] ?? ""])
    );
  }
  // ---------------------------------------------------------------- rendering
  renderPage(ctx) {
    const page = ctx.page;
    const templateId = this.#pageTemplateId(page);
    const template = this.theme.pages.get(templateId) ?? this.theme.pages.get("standard");
    if (!this.theme.pages.has(templateId))
      this.diagnose("warning", `Page template @/${templateId} not found; used Standard`, ctx.pageId);
    const slots = this.theme.slots.get(text(template, "id")) ?? /* @__PURE__ */ new Map();
    const placeholder = (slot) => {
      if (slots.has(slot)) return slots.get(slot);
      if (PAGE_DEFAULT_SLOTS.has(slot)) return "BODY";
      const lower = slot.toLowerCase();
      for (const [name, value] of slots) if (name.toLowerCase() === lower) return value;
      this.diagnose(
        "warning",
        `Slot "${slot}" does not exist in page template ${templateId}; rendered in Body`,
        ctx.pageId
      );
      return "BODY";
    };
    const positions = /* @__PURE__ */ new Map();
    const regions = this.#pageComponents(ctx, "region");
    for (const region of regions) {
      if (ref(region.props, "layout.parentRegion")) continue;
      const key = placeholder(str(region.props, "layout.slot", "body"));
      positions.set(key, [...positions.get(key) ?? [], region]);
    }
    const pageButtons = this.#pageComponents(ctx, "button").filter(
      (button) => !ref(button.props, "layout.region")
    );
    const pageItems = this.#pageComponents(ctx, "pageItem").filter(
      (item) => !ref(item.props, "layout.region")
    );
    const values = {};
    for (const [key, list2] of positions)
      values[key] = this.#grid(
        template,
        bySequence(list2).filter((region) => this.#visible(ctx, region)).map((region) => ({ component: region, html: this.renderRegion(ctx, region) }))
      );
    for (const button of bySequence(pageButtons)) {
      if (!this.#visible(ctx, button)) continue;
      const key = placeholder(str(button.props, "layout.slot", "body"));
      values[key] = (values[key] ?? "") + this.renderButton(ctx, button);
    }
    if (pageItems.length) values.BODY = (values.BODY ?? "") + this.#itemsGrid(ctx, template, pageItems);
    const pageOptions = templateOptions(
      strings(list(page.props, "appearance.templateOptions")),
      text(template, "default_template_options")
    );
    const themeComponent = this.#theme();
    const styleId = (ref(themeComponent?.props ?? {}, "style.currentThemeStyle") ?? defaultStaticId(this.theme, "current_theme_style_id", "vita")).toLowerCase();
    const style = this.theme.styles.get(styleId) ?? this.theme.styles.get("vita");
    if (!this.theme.styles.has(styleId))
      this.diagnose("info", `Theme style ${styleId} not found; used Vita`, ctx.pageId);
    const css = [
      `${IMAGE_PREFIX}app_ui/css/Core.min.css?v=${APEX_FULL_VERSION}`,
      `${IMAGE_PREFIX}libraries/font-apex/2.5.1/css/font-apex.min.css?v=${APEX_FULL_VERSION}`
    ];
    const themeCss = strings(list(themeComponent?.props ?? {}, "css.fileUrls"));
    const themeFiles = themeCss.length ? themeCss : text(this.theme.theme, "css_file_urls").split("\n").filter(Boolean);
    const styleCss = [
      ...text(style, "css_file_urls").split("\n"),
      text(style, "theme_roller_output_file_url")
    ].filter(Boolean);
    const appCss = strings(list(this.app.app.props, "css.fileUrls"));
    const pageCss = strings(list(page.props, "css.fileUrls"));
    const inlineCss = [str(this.app.app.props, "css.inline"), str(page.props, "css.inline")].filter(Boolean);
    const themeJs = strings(list(themeComponent?.props ?? {}, "javaScript.fileUrls"));
    const themeJsFiles = themeJs.length ? themeJs : text(this.theme.theme, "javascript_file_urls").split("\n").filter(Boolean);
    const appJs = strings(list(this.app.app.props, "javaScript.fileUrls"));
    const pageJs = strings(list(page.props, "javaScript.fileUrls"));
    this.#navigation(ctx, values, template);
    const link = (url) => `<link rel="stylesheet" href="${escapeHtml(this.urls(url))}" type="text/css" />`;
    const script = (url) => `<script src="${escapeHtml(this.urls(url))}"></script>`;
    const env = {
      APP_USER: ctx.session.user,
      APP_ID: this.appId,
      APP_PAGE_ID: page.id,
      APP_SESSION: ctx.session.id,
      APP_FILES: `${this.baseUrl}/files/static/v1/`,
      WORKSPACE_FILES: `${this.baseUrl}/files/workspace/`,
      APEX_VERSION: APEX_FULL_VERSION,
      APEX_BASE_VERSION: APEX_FULL_VERSION.split(".").slice(0, 2).join(".")
    };
    for (const action of this.#pageComponents(ctx, "dynamicAction")) {
      if (this.#visible(ctx, action)) ctx.clientConfig.dynamicActions.push(this.#dynamicAction(ctx, action));
    }
    const pageTemplate = text(template, "id");
    ctx.messageTemplates[`${pageTemplate}_S`] = text(template, "success_message");
    ctx.messageTemplates[`${pageTemplate}_E`] = text(template, "notification_message");
    const onload = [
      `apex.message.registerTemplates(${JSON.stringify(Object.fromEntries(Object.entries(ctx.messageTemplates).map(([id, markup]) => [id, this.substitute(ctx.session, markup, page, "HTML")]))).replaceAll("<", "\\u003c")});`,
      text(template, "javascript_code_onload"),
      ...ctx.onload,
      `apexLocal.init(${JSON.stringify(ctx.clientConfig).replaceAll("<", "\\u003c")});`,
      this.substitute(ctx.session, str(this.app.app.props, "javaScript.executeWhenPageLoads"), page, "RAW"),
      this.substitute(ctx.session, str(page.props, "javaScript.executeWhenPageLoads"), page, "RAW"),
      // The server-generated init must end with apexreadyend; Universal Theme initializes on it.
      "apex.event.trigger(apex.gPageContext$, 'apexreadyend');"
    ].filter(Boolean);
    const functions = [
      str(this.app.app.props, "javaScript.functionAndGlobalVariableDeclaration"),
      str(page.props, "javaScript.functionAndGlobalVariableDeclaration")
    ].filter(Boolean);
    const hidden = (name, id, value) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}" id="${id}" />`;
    const success = ctx.session.success;
    const errors = ctx.session.errors;
    ctx.session.success = void 0;
    ctx.session.errors = void 0;
    const builtins = {
      TITLE: escapeHtml(
        this.substitute(ctx.session, str(page.props, "title", str(page.props, "name")), page, "RAW")
      ),
      APEX_CSS: css.map(link).join("\n"),
      THEME_CSS: themeFiles.map(link).join("\n"),
      TEMPLATE_CSS: [...ctx.cssFiles].map(link).join("\n"),
      THEME_STYLE_CSS: styleCss.map(link).join("\n"),
      APPLICATION_CSS: appCss.map(link).join("\n"),
      PAGE_CSS: [
        ...pageCss.map(link),
        ...inlineCss.map((code) => `<style>
${code}
</style>`),
        `<link rel="stylesheet" href="${LOCAL_PREFIX}/runtime.css" />`
      ].join("\n"),
      FAVICONS: this.#favicons(),
      HEAD: "",
      PAGE_CSS_CLASSES: [pageOptions, str(page.props, "appearance.cssClasses")].filter(Boolean).join(" "),
      DIALOG_CSS_CLASSES: "",
      ONLOAD: "",
      TEXT_DIRECTION: "",
      RTL_CLASS: "",
      FORM_OPEN: [
        `<form action="wwv_flow.accept" method="post" name="wwv_flow" id="wwvFlowForm" data-oj-binding-provider="none" novalidate autocomplete="off">`,
        hidden("p_flow_id", "pFlowId", this.appId),
        hidden("p_flow_step_id", "pFlowStepId", page.id),
        hidden("p_instance", "pInstance", ctx.session.id),
        hidden("p_debug", "pdebug", ""),
        hidden("p_request", "pRequest", ""),
        hidden("p_reload_on_submit", "pReloadOnSubmit", "S"),
        hidden("p_page_submission_id", "pPageSubmissionId", String(Date.now()))
      ].join("\n"),
      FORM_CLOSE: [
        `<input type="hidden" id="pSalt" value="local" />`,
        `<input type="hidden" id="pPageItemsRowVersion" value="" />`,
        `<input type="hidden" id="pPageItemsProtected" value="" />`,
        `<input type="hidden" id="pPageFormRegionChecksums" value="[]" />`,
        "</form>"
      ].join("\n"),
      DEVELOPER_TOOLBAR: this.options.toolbar && !this.#isDialog(page) ? this.#toolbar(ctx) : "",
      APEX_JAVASCRIPT: [
        `<script>var apex_img_dir = "${IMAGE_PREFIX}", htmldb_Img_Dir = apex_img_dir; window.apex = { env: ${JSON.stringify(env)} };</script>`,
        script(`#APEX_FILES#libraries/apex/#MIN_DIRECTORY#desktop_all#MIN#.js?v=#APEX_VERSION#`),
        `<script src="${LOCAL_PREFIX}/messages.js"></script>`,
        `<script src="${LOCAL_PREFIX}/runtime.js"></script>`
      ].join("\n"),
      GENERATED_CSS: "",
      THEME_JAVASCRIPT: themeJsFiles.map(script).join("\n"),
      TEMPLATE_JAVASCRIPT: [...ctx.jsFiles].map(script).join("\n"),
      APPLICATION_JAVASCRIPT: [
        ...appJs.map(script),
        ...functions.map((code) => `<script>
${code}
</script>`)
      ].join("\n"),
      PAGE_JAVASCRIPT: pageJs.map(script).join("\n"),
      GENERATED_JAVASCRIPT: `<script>
apex.jQuery( function() {
 apex.page.init( this, function() {
  try {
${onload.join("\n")}
  } catch( e ) { apex.debug.error( e ); }
 });
});
</script>`,
      // apex.message finds these placeholders and the registered sub-templates by ID.
      SUCCESS_MESSAGE: `<span id="APEX_SUCCESS_MESSAGE" data-template-id="${pageTemplate}_S" class="apex-page-success${success ? "" : " u-hidden"}">${success ? fill(text(template, "success_message"), {
        SUCCESS_MESSAGE: escapeHtml(success),
        SUCCESS_MESSAGE_HEADING: "Success",
        CLOSE_NOTIFICATION: "Close"
      }) : ""}</span>`,
      NOTIFICATION_MESSAGE: `<span id="APEX_ERROR_MESSAGE" data-template-id="${pageTemplate}_E" class="apex-page-error${errors?.length ? "" : " u-hidden"}">${errors?.length ? fill(text(template, "notification_message"), {
        MESSAGE: errors.map((error) => escapeHtml(error.message)).join("<br>"),
        ERROR_MESSAGE_HEADING: "Error",
        CLOSE_NOTIFICATION: "Close"
      }) : ""}</span>`,
      GLOBAL_NOTIFICATION: "",
      LOGO: this.#logo(ctx),
      HOME_LINK: this.pagePath(this.findPage(this.homePage()) ?? page),
      APP_VERSION: "",
      CUSTOMIZE: "",
      BUILT_WITH_LOVE_USING_APEX: "",
      BACKGROUND_IMAGE: "",
      ...values
    };
    const html = fill(
      `${text(template, "header_template")}${text(template, "box")}${text(template, "footer_template")}`,
      builtins
    );
    return this.substitute(ctx.session, html, page, "HTML");
  }
  #favicons() {
    const icon = this.app.files.length ? `${this.baseUrl}/files/static/v1/icons/app-icon-32.png` : "";
    const exists = fs4.existsSync(
      path4.join(this.app.root, "shared-components", "static-files", "icons", "app-icon-32.png")
    );
    return icon && exists ? `<link rel="icon" sizes="32x32" href="${icon}">` : "";
  }
  #logo(ctx) {
    const type = str(this.app.app.props, "logo.type", "text");
    const value = str(this.app.app.props, "logo.text", str(this.app.app.props, "name"));
    const image = str(this.app.app.props, "logo.imageUrl") || str(this.app.app.props, "logo.image");
    const label = `<span class="apex-logo-text">${escapeHtml(this.substitute(ctx.session, value, ctx.page, "RAW"))}</span>`;
    if (type === "image" && image)
      return `<img src="${escapeHtml(this.urls(image))}" alt="" class="apex-logo-img">`;
    if (type === "imageAndText" && image)
      return `<img src="${escapeHtml(this.urls(image))}" alt="" class="apex-logo-img">${label}`;
    return label;
  }
  #toolbar(ctx) {
    const own = this.diagnostics.filter((diagnostic) => !diagnostic.page || diagnostic.page === ctx.pageId);
    const counts = (level) => own.filter((diagnostic) => diagnostic.level === level).length;
    const items = own.slice(0, 40).map((diagnostic) => `<li class="is-${diagnostic.level}">${escapeHtml(diagnostic.message)}</li>`).join("");
    return `<details class="apex-local-toolbar" id="apexLocalToolbar"><summary>APEX local \xB7 page ${escapeHtml(ctx.pageId)} \xB7 ${counts("error")} errors \xB7 ${counts("warning")} warnings \xB7 ${counts("info")} notes</summary><ul>${items || "<li>No diagnostics</li>"}</ul></details>`;
  }
  #navigation(ctx, values, template) {
    const app = this.app.app.props;
    const box = `${text(template, "header_template")}${text(template, "box")}`;
    const menu = this.shared("list", ref(app, "navigationMenu.list"));
    if (menu && (box.includes("#SIDE_GLOBAL_NAVIGATION_LIST#") || box.includes("#TOP_GLOBAL_NAVIGATION_LIST#"))) {
      const theme = this.#theme();
      const position = str(
        app,
        "navigationMenu.position",
        str(theme?.props ?? {}, "componentDefaults.navigationMenuListPosition", "side")
      );
      const fallback = position === "top" ? "top-navigation-menu" : "side-navigation-menu";
      const templateId = (ref(app, "navigationMenu.listTemplate") ?? fallback).toLowerCase();
      const options = strings(list(app, "navigationMenu.templateOptions"));
      const html = this.renderList(ctx, menu, templateId, options, "t_TreeNav");
      if (templateId.includes("side") && box.includes("#SIDE_GLOBAL_NAVIGATION_LIST#"))
        values.SIDE_GLOBAL_NAVIGATION_LIST = html;
      else values.TOP_GLOBAL_NAVIGATION_LIST = html;
    }
    const bar = this.shared("list", ref(app, "navigationBar.list"));
    if (bar && box.includes("#NAVIGATION_BAR#")) {
      const templateId = (ref(app, "navigationBar.listTemplate") ?? "navigation-bar").toLowerCase();
      values.NAVIGATION_BAR = this.renderList(
        ctx,
        bar,
        templateId,
        strings(list(app, "navigationBar.templateOptions")),
        "navigation_bar"
      );
    }
  }
  /** Fixed 12-column grid using the page template's container/row/column templates. */
  #grid(template, cells) {
    if (!cells.length) return "";
    const rows = [];
    for (const cell of cells) {
      const startNewRow = bool(cell.component.props, "layout.startNewRow", true) && bool(cell.component.props, "layout.newRow", true);
      if (!rows.length || startNewRow) rows.push([cell]);
      else rows.at(-1).push(cell);
    }
    const max = Number(text(template, "grid_max_columns")) || 12;
    const containerTemplate = text(template, "grid_template") || '<div class="container">#ROWS#</div>';
    const rowTemplate = text(template, "grid_row_template") || '<div class="row #CSS_CLASSES#">#COLUMNS#</div>';
    const columnTemplate = text(template, "grid_column_template") || '<div class="col col-#COLUMN_SPAN_NUMBER# #CSS_CLASSES#" #ATTRIBUTES#>#CONTENT#</div>';
    const html = rows.map((row) => {
      const explicit = row.reduce(
        (sum, cell) => sum + num(cell.component.props, "layout.columnSpan", 0),
        0
      );
      const automatic = row.filter((cell) => !num(cell.component.props, "layout.columnSpan", 0)).length;
      const share = automatic ? Math.max(1, Math.floor((max - explicit) / automatic)) : 0;
      const columns = row.map((cell, index) => {
        const span = num(cell.component.props, "layout.columnSpan", share) || max;
        const firstLast = [
          index === 0 ? text(template, "grid_first_column_attributes") : "",
          index === row.length - 1 ? text(template, "grid_last_column_attributes") : ""
        ].filter(Boolean).join(" ");
        return fill(columnTemplate, {
          COLUMN_SPAN_NUMBER: String(Math.min(max, span)),
          CSS_CLASSES: num(cell.component.props, "layout.columnSpan", 0) ? "" : "apex-col-auto",
          FIRST_LAST_COLUMN_ATTRIBUTES: firstLast,
          ATTRIBUTES: "",
          CONTENT: cell.html
        });
      }).join("\n");
      return fill(rowTemplate, { CSS_CLASSES: "", COLUMNS: columns });
    }).join("\n");
    return fill(containerTemplate, { ROWS: html });
  }
  #itemsGrid(ctx, template, items) {
    const visible = bySequence(items).filter((item) => this.#visible(ctx, item));
    const hidden = visible.filter((item) => str(item.props, "type") === "hidden");
    const shown = visible.filter((item) => str(item.props, "type") !== "hidden");
    return this.#grid(
      template,
      shown.map((item) => ({ component: item, html: this.renderItem(ctx, item) }))
    ) + hidden.map((item) => this.renderItem(ctx, item)).join("");
  }
  #pageTemplate(ctx) {
    return this.theme.pages.get(this.#pageTemplateId(ctx.page)) ?? this.theme.pages.get("standard");
  }
  // ---------------------------------------------------------------- regions
  #regionTemplateId(region) {
    const explicit = ref(region.props, "appearance.template");
    if (explicit) return explicit.toLowerCase();
    const type = str(region.props, "type");
    const theme = this.#theme();
    const defaults = theme?.props ?? {};
    if (type === "breadcrumb")
      return (ref(defaults, "regionDefaults.breadcrumbs") ?? "title-bar").toLowerCase();
    if (type === "interactiveReport" || type === "interactiveGrid")
      return (ref(defaults, "regionDefaults.interactiveReports") ?? "interactive-report").toLowerCase();
    return (ref(defaults, "componentDefaults.region") ?? defaultStaticId(this.theme, "default_region_template", "standard")).toLowerCase();
  }
  regionDomId(region) {
    return str(region.props, "advanced.staticId") || slug(region.id);
  }
  renderRegion(ctx, region) {
    const templateId = this.#regionTemplateId(region);
    const template = this.theme.regions.get(templateId) ?? this.theme.regions.get("standard");
    if (!this.theme.regions.has(templateId))
      this.diagnose(
        "warning",
        `Region template @/${templateId} not found; used Standard`,
        ctx.pageId,
        region.id
      );
    const slots = this.theme.slots.get(text(template, "id")) ?? /* @__PURE__ */ new Map();
    const domId = this.regionDomId(region);
    const values = {};
    const append = (slot, html) => {
      const key = slots.get(slot) ?? (PAGE_DEFAULT_SLOTS.has(slot) ? "BODY" : slot.toUpperCase());
      values[key] = (values[key] ?? "") + html;
    };
    for (const button of bySequence(
      this.#pageComponents(ctx, "button").filter(
        (candidate) => ref(candidate.props, "layout.region") === region.id
      )
    )) {
      if (this.#visible(ctx, button))
        append(str(button.props, "layout.slot", "regionBody"), this.renderButton(ctx, button));
    }
    const body2 = this.#regionBody(ctx, region, values);
    const items = this.#pageComponents(ctx, "pageItem").filter(
      (item) => ref(item.props, "layout.region") === region.id
    );
    const itemsHtml = items.length ? this.#itemsGrid(ctx, this.#pageTemplate(ctx), items) : "";
    values.BODY = `${body2}${values.BODY ?? ""}${itemsHtml}`;
    const children = this.#pageComponents(ctx, "region").filter(
      (child) => ref(child.props, "layout.parentRegion") === region.id && this.#visible(ctx, child)
    );
    if (children.length) {
      const grouped = /* @__PURE__ */ new Map();
      for (const child of bySequence(children)) {
        const slot = str(child.props, "layout.slot", "subRegions");
        grouped.set(slot, [...grouped.get(slot) ?? [], child]);
      }
      for (const [slot, group] of grouped) {
        const key = slots.get(slot) ?? (slot === "regionBody" ? "SUB_REGIONS" : slot.toUpperCase());
        values[key] = (values[key] ?? "") + this.#grid(
          this.#pageTemplate(ctx),
          group.map((child) => ({ component: child, html: this.renderRegion(ctx, child) }))
        );
      }
    }
    const options = templateOptions(
      strings(list(region.props, "appearance.templateOptions")),
      text(template, "default_template_options")
    );
    const icon = iconClasses(
      str(region.props, "appearance.icon") || str(region.props, "icon.iconCssClasses")
    );
    const image = str(region.props, "image.fileUrl");
    const title = this.substitute(
      ctx.session,
      str(region.props, "title", str(region.props, "name")),
      ctx.page,
      "HTML"
    );
    return fill(text(template, "template"), {
      ...values,
      TITLE: title,
      REGION_TITLE: title,
      DOM_ID: domId,
      REGION_STATIC_ID: domId,
      REGION_ID: domId,
      REGION_CSS_CLASSES: [options, str(region.props, "appearance.cssClasses")].filter(Boolean).join(" "),
      REGION_ATTRIBUTES: this.substitute(
        ctx.session,
        str(region.props, "advanced.customAttributes"),
        ctx.page,
        "RAW"
      ),
      REGION_LANDMARK_ATTRIBUTES: `role="region" aria-labelledby="${domId}_heading"`,
      ICON_CSS_CLASSES: icon,
      REGION_IMAGE: image ? fill(text(template, "image_template"), {
        REGION_IMAGE_URL: escapeHtml(this.substitute(ctx.session, image, ctx.page, "RAW"))
      }) : "",
      REGION_IMAGE_URL: escapeHtml(this.substitute(ctx.session, image, ctx.page, "RAW"))
    });
  }
  #regionBody(ctx, region, slots) {
    const type = str(region.props, "type", "staticContent");
    switch (type) {
      case "staticContent":
      case "helpText":
        return this.substitute(
          ctx.session,
          str(region.props, "source.htmlCode") || str(region.props, "source.text"),
          ctx.page,
          "RAW"
        );
      case "form":
        return "";
      case "classicReport":
        return this.#report(ctx, region, "classic");
      case "interactiveReport":
      case "interactiveGrid":
        if (type === "interactiveGrid")
          this.diagnose(
            "info",
            `Interactive Grid ${region.id} is rendered as a read-only report`,
            ctx.pageId,
            region.id
          );
        return this.#report(ctx, region, "interactive", slots);
      case "cards":
        return this.#cards(ctx, region);
      case "list":
        return this.#listRegion(ctx, region);
      case "breadcrumb":
        return this.#breadcrumb(ctx, region);
      case "chart":
        return this.#chart(ctx, region);
      default:
        if (type.startsWith("themeTemplateComponent/")) return this.#report(ctx, region, "classic");
        this.diagnose(
          "warning",
          `Region type ${type} (${region.id}) is not simulated; a placeholder is shown`,
          ctx.pageId,
          region.id
        );
        return `<div class="apex-local-unsupported"><span class="fa fa-info-circle" aria-hidden="true"></span> <strong>${escapeHtml(heading(type.replace(/([a-z])([A-Z])/gu, "$1_$2")))}</strong> region \u201C${escapeHtml(str(region.props, "name", region.id))}\u201D is not simulated locally.</div>`;
    }
  }
  #columns(region, resultColumns) {
    const declared = region.children.filter((child) => child.type === "column");
    const saved = region.children.find(
      (child) => child.type === "savedReport" && str(child.props, "visibility", "primaryDefault").startsWith("primary")
    ) ?? region.children.find((child) => child.type === "savedReport");
    const display = saved ? bySequence(saved.children.filter((child) => child.type === "displayColumn")).map(
      (child) => child.id.toUpperCase()
    ) : [];
    const base = declared.length ? bySequence(declared) : resultColumns.map(
      (name) => ({ type: "column", id: name, props: {}, children: [], file: "", line: 0 })
    );
    const visible = base.filter(
      (column) => str(column.props, "type") !== "hidden" && !/^(APEX\$|ROWID$)/u.test(column.id.toUpperCase())
    );
    if (display.length) {
      const order = new Map(display.map((name, index) => [name, index]));
      return visible.filter((column) => order.has(column.id.toUpperCase())).sort((a, b) => order.get(a.id.toUpperCase()) - order.get(b.id.toUpperCase()));
    }
    return visible;
  }
  #cell(ctx, region, column, row) {
    const name = column.id.toUpperCase();
    const raw = row[name];
    const type = str(column.props, "type", "plainText");
    const mask = str(column.props, "appearance.formatMask");
    let value = raw === null || raw === void 0 ? "" : mask ? formatOracle(raw, mask) ?? "" : String(raw);
    const escape = bool(
      column.props,
      "security.escapeSpecialChars",
      bool(region.props, "security.escapeSpecialChars", true)
    );
    if (type === "plainTextBasedOnLov" || type === "selectList") {
      const lov = this.lov(ctx, get(column.props, "lov"), `${region.id}.${name}`);
      value = lov.find((entry) => entry.r === value)?.d ?? value;
    }
    let html = escape ? escapeHtml(value) : value;
    if (str(column.props, "columnFormatting.htmlExpression")) {
      html = str(column.props, "columnFormatting.htmlExpression").replace(
        /#([A-Z0-9_$]+)#/gu,
        (whole, key) => key in row ? escapeHtml(row[key] ?? "") : whole
      );
    }
    if (type === "link" || get(column.props, "link.target") !== void 0) {
      const linkText = str(column.props, "link.linkText", "#" + name + "#").replace(
        /#([A-Z0-9_$]+)#/gu,
        (whole, key) => key in row ? escapeHtml(row[key] ?? "") : whole
      );
      html = `<a href="${escapeHtml(this.link(ctx, get(column.props, "link.target"), row, `apex.jQuery('#${this.regionDomId(region)}')`))}">${linkText}</a>`;
    }
    return html;
  }
  #alignment(column, sample) {
    const alignment = str(column.props, "layout.columnAlignment") || str(column.props, "appearance.alignment");
    if (/end|right/u.test(alignment) || !alignment && typeof sample === "number") return "u-tR";
    if (/center/u.test(alignment)) return "u-tC";
    return "u-tL";
  }
  #report(ctx, region, mode, slots = {}) {
    const sql = this.#regionSql(ctx, region);
    if (!sql)
      return `<div class="apex-local-unsupported">Report \u201C${escapeHtml(str(region.props, "name", region.id))}\u201D has no local source.</div>`;
    const result = this.#query(ctx, region, sql);
    if (result.error)
      return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(result.error)}</div></div>`;
    const domId = this.regionDomId(region);
    ctx.clientConfig.regions.push({ id: domId, kind: mode });
    const saved = region.children.find((child) => child.type === "savedReport");
    const perPage = num(
      saved?.props ?? {},
      "view.rowsPerPage",
      num(
        region.props,
        "pagination.rowsPerPage",
        num(region.props, "layout.numberOfRowsToDisplay", mode === "interactive" ? 50 : 15)
      )
    );
    const pageNumber = Math.max(1, ctx.session.pagination[`${ctx.pageId}:${region.id}`] ?? 1);
    const rows = result.rows.slice((pageNumber - 1) * perPage, pageNumber * perPage);
    const columns = this.#columns(region, result.columns);
    const noData = this.substitute(
      ctx.session,
      str(region.props, "messages.whenNoDataFound", "No data found."),
      ctx.page,
      "HTML"
    );
    const linkColumn = mode === "interactive" && str(region.props, "link.linkColumn") === "customTarget";
    const linkIcon = str(
      region.props,
      "link.linkIcon",
      '<span class="fa fa-edit" aria-hidden="true"></span>'
    );
    const first = (pageNumber - 1) * perPage + 1;
    const last = first + rows.length - 1;
    const paginate = (target, label, cls) => `<button type="button" class="t-Button t-Button--small t-Button--noUI t-Report-paginationLink ${cls}" data-apex-local-page="${target}" data-region="${escapeHtml(domId)}">${label}</button>`;
    const pagination = result.rows.length > perPage || pageNumber > 1 ? `<tr><td>${pageNumber > 1 ? paginate(pageNumber - 1, '<span class="a-Icon icon-left-arrow"></span>Previous', "t-Report-paginationLink--prev") : ""}<span class="t-Report-paginationText">${first} - ${last}</span>${last < result.rows.length ? paginate(pageNumber + 1, 'Next<span class="a-Icon icon-right-arrow"></span>', "t-Report-paginationLink--next") : ""}</td></tr>` : rows.length ? `<tr><td><span class="t-Report-paginationText">${first} - ${last}</span></td></tr>` : "";
    if (mode === "interactive") {
      const searchBar = slots.RIGHT_OF_INTERACTIVE_REPORT_SEARCH_BAR ?? slots.RIGHTOFINTERACTIVEREPORTSEARCHBAR ?? "";
      delete slots.RIGHT_OF_INTERACTIVE_REPORT_SEARCH_BAR;
      delete slots.RIGHTOFINTERACTIVEREPORTSEARCHBAR;
      const header = `${linkColumn ? '<th class="a-IRR-header a-IRR-header--linkColumn" id="' + domId + '_link"><span class="u-VisuallyHidden">Link</span></th>' : ""}${columns.map(
        (column) => `<th class="a-IRR-header ${this.#alignment(column, rows[0]?.[column.id.toUpperCase()])}" id="${escapeHtml(domId)}_${escapeHtml(column.id)}"><a class="a-IRR-headerLink" href="#" data-column="${escapeHtml(column.id)}">${this.substitute(ctx.session, str(column.props, "heading.heading", heading(column.id)), ctx.page, "HTML")}</a></th>`
      ).join("")}`;
      const body3 = rows.map(
        (row) => `<tr>${linkColumn ? `<td class="a-IRR-linkCol u-tC"><a href="${escapeHtml(this.link(ctx, get(region.props, "link.target"), row, `apex.jQuery('#${domId}')`))}">${linkIcon}</a></td>` : ""}${columns.map(
          (column) => `<td class="${this.#alignment(column, row[column.id.toUpperCase()])}" headers="${escapeHtml(domId)}_${escapeHtml(column.id)}">${this.#cell(ctx, region, column, row)}</td>`
        ).join("")}</tr>`
      ).join("\n");
      return `<div class="a-IRR-container" id="${escapeHtml(domId)}_ir"><div class="a-IRR t-fht-cell"><div class="a-IRR-toolbar"><div class="a-IRR-controls">
<div class="a-IRR-controlGroup a-IRR-controlGroup--search"><div class="a-IRR-search"><div class="a-IRR-colSelector"><button type="button" class="a-Button a-IRR-button a-IRR-button--colSearch" aria-label="Select columns to search"><span class="a-Icon icon-search"></span><span class="a-Icon icon-menu-drop-down"></span></button></div><input class="a-IRR-search-field" type="search" placeholder="Search" aria-label="Search" data-apex-local-search="${escapeHtml(domId)}"><button class="a-Button a-IRR-button a-IRR-button--search" type="button">Go</button></div></div>
<div class="a-IRR-controlGroup a-IRR-controlGroup--options"><div class="a-IRR-actions"><button class="a-Button a-IRR-button a-IRR-button--actions" type="button">Actions<span class="a-Icon icon-down-chevron" aria-hidden="true"></span></button></div></div>
${searchBar ? `<div class="a-IRR-buttons">${searchBar}</div>` : ""}</div></div>
<div class="a-IRR-content"><div class="a-IRR-reportView"><div class="a-IRR-tableContainer">${rows.length ? `<table class="a-IRR-table" id="${escapeHtml(domId)}_table" aria-label="${escapeHtml(str(region.props, "name"))}"><tr>${header}</tr>${body3}</table>` : `<div class="a-IRR-noDataMsg"><span class="a-IRR-noDataMsg-icon a-Icon icon-irr-no-results" aria-hidden="true"></span><span class="a-IRR-noDataMsg-text">${noData}</span></div>`}</div>
${pagination ? `<div class="a-IRR-paginationWrap a-IRR-paginationWrap--bottom"><table class="t-Report-pagination t-Report-pagination--bottom" role="presentation">${pagination}</table></div>` : ""}</div></div></div></div>`;
    }
    const templateId = (ref(region.props, "componentAppearance.template") ?? ref(region.props, "appearance.reportTemplate") ?? defaultStaticId(this.theme, "default_report_template", "standard")).toLowerCase();
    const template = this.theme.reports.get(templateId) ?? this.theme.reports.get("standard");
    const cssClasses = templateOptions(
      strings(list(region.props, "componentAppearance.templateOptions")),
      text(template, "preset_template_options").replaceAll(":", " ")
    );
    const shared = {
      DOM_ID: domId,
      REGION_TITLE: escapeHtml(str(region.props, "name")),
      COMPONENT_CSS_CLASSES: cssClasses,
      REPORT_ATTRIBUTES: "",
      TOP_PAGINATION: "",
      PAGINATION: pagination
    };
    if (!rows.length) return `<div class="t-Report-wrap"><span class="nodatafound">${noData}</span></div>`;
    if (text(template, "row_template_type") === "NAMED_COLUMNS") {
      const rowHtml = rows.map(
        (row, index) => fill(text(template, "row_template1"), {
          ...Object.fromEntries(Object.keys(row).map((key) => [key, escapeHtml(row[key] ?? "")])),
          ...Object.fromEntries(
            columns.map((column) => [column.id.toUpperCase(), this.#cell(ctx, region, column, row)])
          ),
          ROWNUM: String(index + 1)
        })
      ).join("\n");
      return fill(text(template, "row_template_before_rows"), shared) + rowHtml + fill(text(template, "row_template_after_rows"), shared);
    }
    const headings = columns.map(
      (column) => fill(text(template, "column_heading_template"), {
        COLUMN_HEADER: this.substitute(
          ctx.session,
          str(column.props, "heading.heading", heading(column.id)),
          ctx.page,
          "HTML"
        ),
        COLUMN_HEADER_NAME: escapeHtml(column.id.toUpperCase()),
        ALIGNMENT: `align="${this.#alignment(column, rows[0]?.[column.id.toUpperCase()]) === "u-tR" ? "right" : "left"}"`,
        ARIA_SORT: "",
        COLUMN_WIDTH: ""
      })
    ).join("");
    const body2 = rows.map(
      (row) => text(template, "row_template_before_first") + columns.map(
        (column) => fill(text(template, "row_template1"), {
          COLUMN_VALUE: this.#cell(ctx, region, column, row),
          ALIGNMENT: `align="${this.#alignment(column, row[column.id.toUpperCase()]) === "u-tR" ? "right" : "left"}"`,
          ACCESSIBLE_HEADERS: `headers="${escapeHtml(column.id.toUpperCase())}"`
        })
      ).join("") + text(template, "row_template_after_last")
    ).join("\n");
    return fill(text(template, "row_template_before_rows"), shared) + text(template, "before_column_heading") + headings + text(template, "after_column_heading") + body2 + fill(text(template, "row_template_after_rows"), shared);
  }
  #cards(ctx, region) {
    const sql = this.#regionSql(ctx, region);
    if (!sql) return "";
    const result = this.#query(ctx, region, sql, 200);
    const value = (row, key) => {
      const column = str(region.props, key).toUpperCase();
      return column && column in row ? escapeHtml(row[column] ?? "") : "";
    };
    ctx.clientConfig.regions.push({ id: this.regionDomId(region), kind: "cards" });
    const cards = result.rows.map((row) => {
      const title = value(row, "title.column");
      const subtitle = value(row, "subtitle.column");
      const body2 = value(row, "body.column");
      const badge = value(row, "iconAndBadge.badgeColumn");
      const iconColumn = value(row, "iconAndBadge.iconColumn");
      const initials = iconColumn.split(/\s+/u).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase();
      const icon = str(region.props, "iconAndBadge.iconSource") ? `<div class="a-CardView-icon u-color" aria-hidden="true"><span class="a-CardView-initials">${initials}</span></div>` : "";
      return `<li class="a-CardView-item"><div class="a-CardView"><div class="a-CardView-header">${icon}<div class="a-CardView-headerBody"><h3 class="a-CardView-title">${title}</h3>${subtitle ? `<h4 class="a-CardView-subTitle">${subtitle}</h4>` : ""}</div>${badge ? `<div class="a-CardView-badge"><span class="a-CardView-badgeValue">${badge}</span></div>` : ""}</div>${body2 ? `<div class="a-CardView-body"><div class="a-CardView-mainContent">${body2}</div></div>` : ""}</div></li>`;
    }).join("\n");
    return `<div class="a-CardView-region"><ul class="a-CardView-items a-CardView-items--grid">${cards}</ul></div>`;
  }
  #chart(ctx, region) {
    const series = bySequence(region.children.filter((child) => child.type === "series"));
    const type = str(region.props, "chart.type", "bar");
    const parts = series.map((entry) => {
      const sql = str(entry.props, "source.sqlQuery") || (str(entry.props, "source.tableName") ? `select * from ${str(entry.props, "source.tableName")}` : "");
      if (!sql) return "";
      const result = this.#query(ctx, entry, sql, num(entry.props, "performance.maxRowsToProcess", 50));
      const label = str(entry.props, "columnMapping.label", result.columns[0] ?? "").toUpperCase();
      const valueColumn = str(entry.props, "columnMapping.value", result.columns[1] ?? "").toUpperCase();
      const values = result.rows.map((row) => ({
        label: String(row[label] ?? ""),
        value: Number(row[valueColumn] ?? 0)
      }));
      const max = Math.max(1, ...values.map((item) => item.value));
      const bars = values.map(
        (item, index) => `<div class="apex-local-bar"><span class="apex-local-bar-label">${escapeHtml(item.label)}</span><span class="apex-local-bar-track"><span class="apex-local-bar-fill u-color-${index % 15 + 1}-bg" style="width:${(item.value / max * 100).toFixed(1)}%"></span></span><span class="apex-local-bar-value">${item.value.toLocaleString("en-US")}</span></div>`
      ).join("");
      return `<div class="apex-local-series"><div class="apex-local-series-name">${escapeHtml(str(entry.props, "name"))}</div>${bars}</div>`;
    }).join("");
    this.diagnose(
      "info",
      `Chart ${region.id} (${type}) is drawn as a simple bar preview, not Oracle JET`,
      ctx.pageId,
      region.id
    );
    return `<div class="apex-local-chart" data-chart-type="${escapeHtml(type)}">${parts}</div>`;
  }
  #breadcrumb(ctx, region) {
    const breadcrumb = this.shared("breadcrumb", ref(region.props, "source.breadcrumb"));
    if (!breadcrumb) return "";
    const templateId = (ref(region.props, "componentAppearance.breadcrumbTemplate") ?? ref(region.props, "componentAppearance.template") ?? "breadcrumb").toLowerCase();
    const template = this.theme.breadcrumbs.get(templateId) ?? this.theme.breadcrumbs.get("breadcrumb");
    const entries = breadcrumb.children.filter((child) => child.type === "entry");
    const current = entries.find((entry) => str(entry.props, "pageNumber") === ctx.pageId);
    if (!current) return "";
    const chain = [];
    for (let entry = current; entry && !chain.includes(entry); entry = entries.find((candidate) => candidate.id === ref(entry.props, "layout.parentEntry")))
      chain.unshift(entry);
    const options = templateOptions(strings(list(region.props, "componentAppearance.templateOptions")), "");
    return fill(text(template, "before_first"), { COMPONENT_CSS_CLASSES: options }) + chain.map(
      (entry) => fill(
        entry === current ? text(template, "current_page_option") : text(template, "non_current_page_option"),
        {
          NAME: escapeHtml(
            this.substitute(ctx.session, str(entry.props, "name", entry.id), ctx.page, "RAW")
          ),
          LINK: escapeHtml(this.link(ctx, get(entry.props, "link.target")))
        }
      )
    ).join("") + text(template, "after_last");
  }
  #listRegion(ctx, region) {
    const listComponent = this.shared("list", ref(region.props, "source.list"));
    if (!listComponent) {
      this.diagnose("warning", `List @${ref(region.props, "source.list")} not found`, ctx.pageId, region.id);
      return "";
    }
    const theme = this.#theme();
    const templateId = (ref(region.props, "componentAppearance.listTemplate") ?? ref(theme?.props ?? {}, "componentDefaults.list") ?? "links-list").toLowerCase();
    return this.renderList(
      ctx,
      listComponent,
      templateId,
      strings(list(region.props, "componentAppearance.templateOptions")),
      `${this.regionDomId(region)}_list`
    );
  }
  renderList(ctx, listComponent, templateId, options, listId) {
    const template = this.theme.lists.get(templateId);
    if (!template) {
      this.diagnose("warning", `List template @/${templateId} not found`, ctx.pageId, listComponent.id);
      return "";
    }
    for (const file of text(template, "javascript_file_urls").split("\n").filter(Boolean))
      ctx.jsFiles.add(file);
    for (const file of text(template, "css_file_urls").split("\n").filter(Boolean)) ctx.cssFiles.add(file);
    if (text(template, "javascript_code_onload")) ctx.onload.push(text(template, "javascript_code_onload"));
    const entries = listComponent.children.filter(
      (child) => child.type === "entry" && this.#visible(ctx, child)
    );
    const childrenOf = (parent) => bySequence(entries.filter((entry) => ref(entry.props, "layout.parentEntry") === parent));
    const isCurrent = (entry) => {
      const target = get(entry.props, "link.target");
      const pages = str(entry.props, "currentForPages") || str(entry.props, "link.currentForPages");
      if (pages)
        return pages.split(",").map((page) => page.trim()).includes(ctx.pageId);
      return isObject(target) && target.page !== void 0 && this.findPage(String(target.page))?.id === ctx.pageId;
    };
    const render = (entry, level) => {
      const kids = childrenOf(entry.id);
      const current = isCurrent(entry) || kids.some(isCurrent);
      const attributes = get(entry.props, "userDefinedAttributes");
      const values = {
        LINK: escapeHtml(this.link(ctx, get(entry.props, "link.target"))),
        TEXT: this.substitute(ctx.session, str(entry.props, "label", entry.id), ctx.page, "HTML"),
        TEXT_ESC_SC: this.substitute(ctx.session, str(entry.props, "label", entry.id), ctx.page, "HTML"),
        ICON_CSS_CLASSES: iconClasses(
          str(entry.props, "icon.imageIconCssClasses") || str(entry.props, "icon.iconCssClasses")
        ),
        IMAGE: iconClasses(str(entry.props, "icon.imageIconCssClasses")),
        IMAGE_ATTR: "",
        LINK_ATTR: "",
        LIST_ITEM_ID: `${listId}_${slug(entry.id)}`,
        PARENT_LIST_ITEM_ID: `${listId}_${slug(entry.id)}`,
        LEVEL: String(level)
      };
      for (let index = 1; index <= 20; index += 1) {
        const key = `A${String(index).padStart(2, "0")}`;
        const value = isObject(attributes) ? attributes[String(index)] : void 0;
        values[key] = typeof value === "string" ? this.substitute(ctx.session, value, ctx.page, "HTML") : "";
      }
      const sub = level > 1;
      const field = kids.length ? sub ? current ? "sub_templ_curr_w_child" : "sub_templ_noncurr_w_child" : current ? "item_templ_curr_w_child" : "item_templ_noncurr_w_child" : sub ? current ? "sub_list_item_current" : "sub_list_item_noncurrent" : current ? "list_template_current" : "list_template_noncurrent";
      let html = fill(
        text(template, field) || text(template, current ? "list_template_current" : "list_template_noncurrent"),
        values
      );
      if (kids.length) {
        html += fill(text(template, "before_sub_list"), values) + kids.map((kid) => render(kid, level + 1)).join("") + fill(text(template, "after_sub_list"), values);
      }
      return html;
    };
    const shared = {
      LIST_ID: listId,
      PARENT_STATIC_ID: listId,
      COMPONENT_CSS_CLASSES: templateOptions(options, text(template, "default_template_options")),
      APEX_CSP_NONCE_ATTRIBUTE: ""
    };
    return fill(text(template, "list_template_before_rows"), shared) + childrenOf(void 0).map((entry) => render(entry, 1)).join("") + fill(text(template, "list_template_after_rows"), shared);
  }
  // ---------------------------------------------------------------- buttons & items
  renderButton(ctx, button) {
    const theme = this.#theme();
    const templateId = (ref(button.props, "appearance.buttonTemplate") ?? ref(theme?.props ?? {}, "componentDefaults.button") ?? "text").toLowerCase();
    const template = this.theme.buttons.get(templateId) ?? this.theme.buttons.get("text");
    const hot = bool(button.props, "appearance.hot", false);
    const domId = str(button.props, "advanced.staticId") || `B_${slug(button.id)}`;
    const name = str(button.props, "buttonName", button.id.toUpperCase());
    const action = str(button.props, "behavior.action", "submit");
    let onclick = "";
    if (action === "submit" || action === "submitPage" || action === "") {
      const request = escapeJs(name);
      const confirm = bool(button.props, "behavior.requiresConfirmation", false);
      const message = escapeJs(
        this.substitute(
          ctx.session,
          str(button.props, "confirmation.message", "&APP_TEXT$DELETE_MSG."),
          ctx.page,
          "RAW"
        )
      );
      onclick = confirm ? `apex.confirm('${message}',{request:'${request}',showWait:true${str(button.props, "confirmation.style") === "danger" ? ",style:'danger'" : ""}});` : `apex.submit({request:'${request}',showWait:true});`;
    } else if (action === "redirectThisApp" || action === "redirectPage" || action === "redirectUrl") {
      const target = get(button.props, "behavior.target") ?? str(button.props, "behavior.targetUrl");
      const href = this.link(ctx, target, void 0, `apex.jQuery('#${domId}')`);
      onclick = href.startsWith("javascript:") ? href.slice(11) : `apex.navigation.redirect('${escapeJs(href)}');`;
    }
    const options = templateOptions(
      strings(list(button.props, "appearance.templateOptions")),
      text(template, "default_template_options")
    );
    const icon = iconClasses(
      str(button.props, "appearance.icon") || str(button.props, "icon.iconCssClasses")
    );
    return fill(text(template, hot && text(template, "hot_template") ? "hot_template" : "template"), {
      DOM_ID: domId,
      BUTTON_ID: domId,
      BUTTON_NAME: name,
      LABEL: escapeHtml(
        this.substitute(ctx.session, str(button.props, "label", heading(button.id)), ctx.page, "RAW")
      ),
      BUTTON_CSS_CLASSES: [
        options,
        str(button.props, "appearance.cssClasses"),
        hot && !text(template, "hot_template") ? "t-Button--hot" : ""
      ].filter(Boolean).join(" "),
      ICON_CSS_CLASSES: icon,
      BUTTON_ATTRIBUTES: this.substitute(
        ctx.session,
        str(button.props, "advanced.customAttributes"),
        ctx.page,
        "RAW"
      ),
      ONCLICK: onclick ? `onclick="${escapeHtml(onclick)}"` : "",
      JAVASCRIPT: onclick ? `onclick="${escapeHtml(onclick)}"` : "",
      IS_DISABLED: "",
      MENU_ID: ""
    });
  }
  renderItem(ctx, item) {
    const name = item.id.toUpperCase();
    const type = str(item.props, "type", "textField");
    const value = ctx.session.items[name] ?? "";
    if (type === "hidden")
      return `<input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}">`;
    const required = bool(item.props, "validation.valueRequired", false);
    const theme = this.#theme();
    const templateId = (ref(item.props, "appearance.template") ?? ref(
      theme?.props ?? {},
      required ? "componentDefaults.requiredLabel" : "componentDefaults.optionalLabel"
    ) ?? (required ? "required-floating" : "optional-floating")).toLowerCase();
    const template = this.theme.fields.get(templateId) ?? this.theme.fields.get("optional-floating");
    const element = this.#element(ctx, item, type, name, value);
    const label = escapeHtml(this.substitute(ctx.session, this.#label(item), ctx.page, "RAW"));
    const error = ctx.itemErrors.get(name);
    const singleCheckbox = type === "checkbox";
    const values = {
      CURRENT_ITEM_NAME: name,
      CURRENT_ITEM_ID: name,
      CURRENT_ITEM_CONTAINER_ID: `${name}_CONTAINER`,
      LABEL_ID: `${name}_LABEL`,
      LABEL_OPEN: `label for="${name}"`,
      LABEL_CLOSE: "/label",
      ITEM_CSS_CLASSES: [
        `apex-item-wrapper apex-item-wrapper--${slug(type).replace(/[A-Z]/gu, (char) => `-${char.toLowerCase()}`)}`,
        str(item.props, "appearance.cssClasses"),
        error ? "is-error" : ""
      ].filter(Boolean).join(" "),
      CURRENT_ITEM_PRE_TEXT: str(item.props, "appearance.preTextHtml"),
      CURRENT_ITEM_POST_TEXT: str(item.props, "appearance.postTextHtml"),
      CURRENT_ITEM_HELP_LABEL: "Help",
      CURRENT_ITEM_INLINE_HELP_TEXT: escapeHtml(str(item.props, "help.inlineHelpText")),
      ERROR_MESSAGE: error ? escapeHtml(error) : "",
      IS_REQUIRED: required ? "Y" : ""
    };
    values.ITEM_PRE_TEXT = values.CURRENT_ITEM_PRE_TEXT ? fill(text(template, "item_pre_text"), values) : "";
    values.ITEM_POST_TEXT = values.CURRENT_ITEM_POST_TEXT ? fill(text(template, "item_post_text"), values) : "";
    values.HELP_TEMPLATE = str(item.props, "help.helpText") ? fill(text(template, "help_link"), values) : "";
    values.INLINE_HELP_TEMPLATE = values.CURRENT_ITEM_INLINE_HELP_TEXT ? fill(text(template, "inline_help_text"), values) : "";
    const errorTemplate = `${text(template, "id")}_ET`;
    ctx.messageTemplates[errorTemplate] = text(template, "error_template");
    values.ERROR_TEMPLATE = `<span id="${name}_error_placeholder" class="a-Form-error${error ? "" : " u-hidden"}" data-template-id="${errorTemplate}">${error ? fill(text(template, "error_template"), values) : ""}</span>`;
    const labelHtml = singleCheckbox ? "" : `${fill(text(template, "template_body1"), values)}${label}${fill(text(template, "template_body2"), values)}`;
    return `${fill(text(template, "before_item"), values)}${labelHtml}${fill(text(template, "before_element"), values)}${element}${fill(text(template, "after_element"), values)}${fill(text(template, "after_item"), values)}`;
  }
  #element(ctx, item, type, name, value) {
    const v = escapeHtml(value);
    const width = num(item.props, "appearance.width", 30);
    const max = num(item.props, "validation.maxLength", 0);
    const placeholder = str(item.props, "appearance.placeholder") ? ` placeholder="${escapeHtml(str(item.props, "appearance.placeholder"))}"` : "";
    const required = bool(item.props, "validation.valueRequired", false) ? " required" : "";
    const readonly = str(item.props, "readOnly.type") === "always" ? " readonly" : "";
    const lov = () => this.lov(ctx, get(item.props, "lov"), name);
    const nullDisplay = (fallback) => escapeHtml(str(item.props, "lov.nullDisplayValue", fallback));
    const options = (selected) => lov().map(
      (entry) => `<option value="${escapeHtml(entry.r)}"${selected.includes(entry.r) ? " selected" : ""}>${escapeHtml(entry.d)}</option>`
    ).join("");
    switch (type) {
      case "textField":
      case "popupLov":
      case "autoComplete":
      case "colorPicker":
        return `<input type="text" id="${name}" name="${name}" class="text_field apex-item-text" value="${v}" size="${width}"${max ? ` maxlength="${max}"` : ""}${placeholder}${required}${readonly} data-trim-spaces="BOTH">`;
      case "password":
        return `<input type="password" id="${name}" name="${name}" class="password apex-item-text" value="" size="${width}"${placeholder}${required}>`;
      case "numberField":
        return `<input type="text" inputmode="decimal" id="${name}" name="${name}" class="number_field apex-item-text apex-item-number" value="${v}" size="${width}"${placeholder}${required}${readonly} style="text-align:end">`;
      case "datePicker":
      case "datePickerApex":
        return `<input type="date" id="${name}" name="${name}" class="text_field apex-item-text apex-item-datepicker" value="${v.slice(0, 10)}"${required}${readonly}>`;
      case "textarea":
      case "richTextEditor":
      case "markdownEditor":
        return `<div class="apex-item-group apex-item-group--textarea"><textarea name="${name}" id="${name}" rows="${num(item.props, "appearance.height", 5)}" cols="${width}" class="textarea apex-item-textarea"${placeholder}${required}${readonly}>${v}</textarea></div>`;
      case "selectList":
      case "shuttle":
      case "selectMany":
      case "combobox": {
        const showNull = bool(item.props, "lov.displayNullValue", type === "selectList");
        return `<select id="${name}" name="${name}" class="selectlist apex-item-select" data-native-menu="false" size="1"${required}>${showNull ? `<option value="">${nullDisplay("- Select -")}</option>` : ""}${options(value.split(":"))}</select>`;
      }
      case "radioGroup":
      case "checkboxGroup": {
        const input = type === "radioGroup" ? "radio" : "checkbox";
        const selected = value.split(":");
        const choices = lov().map(
          (entry, index) => `<div class="apex-item-option"><input type="${input}" id="${name}_${index}" name="${name}" value="${escapeHtml(entry.r)}"${selected.includes(entry.r) ? " checked" : ""}><label for="${name}_${index}">${escapeHtml(entry.d)}</label></div>`
        ).join("");
        return `<div tabindex="-1" id="${name}" class="${input === "radio" ? "radio_group apex-item-radio" : "checkbox_group apex-item-checkbox"}" role="${input === "radio" ? "radiogroup" : "group"}" aria-labelledby="${name}_LABEL">${choices}</div>`;
      }
      case "checkbox": {
        const checked = value === str(item.props, "settings.checkedValue", "Y");
        return `<div class="apex-item-single-checkbox"><input type="hidden" name="${name}" id="${name}_HIDDENVALUE" value="${v}"><input type="checkbox" id="${name}" value="${escapeHtml(str(item.props, "settings.checkedValue", "Y"))}"${checked ? " checked" : ""}><label for="${name}" id="${name}_LABEL" class="u-checkbox">${escapeHtml(this.#label(item))}</label></div>`;
      }
      case "switch": {
        const on = str(item.props, "settings.onValue", "Y");
        return `<span class="a-Switch"><input type="checkbox" id="${name}" name="${name}" value="${escapeHtml(on)}" data-off-value="${escapeHtml(str(item.props, "settings.offValue", "N"))}"${value === on ? " checked" : ""} class="a-Switch-input"><span class="a-Switch-toggle"></span></span>`;
      }
      case "displayOnly": {
        const display = get(item.props, "lov") ? lov().find((entry) => entry.r === value)?.d ?? value : value;
        return `<span id="${name}_DISPLAY" class="display_only apex-item-display-only">${escapeHtml(display)}</span><input type="hidden" id="${name}" name="${name}" value="${v}">`;
      }
      case "fileBrowse":
      case "imageUpload":
        return `<input type="file" id="${name}" name="${name}" class="file apex-item-file">`;
      case "starRating":
        return `<input type="text" id="${name}" name="${name}" class="text_field apex-item-text" value="${v}" size="3">`;
      default:
        this.diagnose("info", `Item type ${type} (${name}) is rendered as a text field`, ctx.pageId, name);
        return `<input type="text" id="${name}" name="${name}" class="text_field apex-item-text" value="${v}" size="${width}">`;
    }
  }
  // ---------------------------------------------------------------- dynamic actions
  #selector(ctx, props) {
    if (!isObject(props)) return "";
    const type = str(props, "selectionType");
    switch (type) {
      case "button": {
        const id = ref(props, "button");
        const button = this.#pageComponents(ctx, "button").find((candidate) => candidate.id === id);
        return button ? `#${str(button.props, "advanced.staticId") || `B_${slug(button.id)}`}` : "";
      }
      case "region": {
        const id = ref(props, "region");
        const region = this.#pageComponents(ctx, "region").find((candidate) => candidate.id === id);
        return region ? `#${this.regionDomId(region)}` : "";
      }
      case "items":
      case "item":
        return strings(list(props, "items").length ? list(props, "items") : list(props, "item")).flatMap((value) => value.split(",")).map((value) => `#${value.trim().toUpperCase()}`).join(",");
      case "jQuerySelector":
      case "jquerySelector":
        return str(props, "jQuerySelector") || str(props, "jquerySelector");
      case "javascriptExpression":
        return `js:${str(props, "javascriptExpression")}`;
      case "triggeringElement":
        return "triggeringElement";
      default:
        return "document";
    }
  }
  #dynamicAction(ctx, action) {
    const when = action.props.when;
    const actions = bySequence(action.children.filter((child) => child.type === "action")).map((child) => {
      const settings = isObject(child.props.settings) ? child.props.settings : {};
      return {
        action: str(child.props, "action"),
        selector: this.#selector(ctx, child.props.affectedElements),
        fireOnInit: bool(child.props, "execution.fireOnInit", false),
        whenFalse: str(child.props, "execution.event") === "false" || str(child.props, "execution.fireWhenEventResultIs") === "false",
        settings: Object.fromEntries(
          Object.entries(settings).map(([key, value]) => [
            key,
            typeof value === "string" ? this.substitute(ctx.session, value, ctx.page, "RAW") : isRef(value) ? value.ref : value
          ])
        )
      };
    });
    const condition = action.props.clientSideCondition;
    return {
      id: action.id,
      event: str(when ?? {}, "event", "ready"),
      selector: this.#selector(ctx, when),
      condition: isObject(condition) ? {
        type: str(condition, "type"),
        item: str(condition, "item").toUpperCase(),
        value: str(condition, "value"),
        expression: str(condition, "javascriptExpression")
      } : null,
      actions
    };
  }
  /** HTML of a single region body for client-side refresh. */
  renderRegionFragment(session, pageKey, regionId) {
    const ctx = this.prepare(session, pageKey);
    const region = this.#pageComponents(ctx, "region").find(
      (candidate) => this.regionDomId(candidate) === regionId || candidate.id === regionId
    );
    if (!region) throw new Error(`Region ${regionId} not found`);
    return this.renderRegion(ctx, region);
  }
  /** Loads `.apex-local/*.sql` (or supporting-object scripts) into a fresh database. */
  static seed(db, appRoot) {
    const local = path4.join(appRoot, ".apex-local");
    const scripts = fs4.existsSync(local) ? fs4.readdirSync(local).filter((name) => name.endsWith(".sql")).sort().map((name) => path4.join(local, name)) : [];
    if (!scripts.length) {
      const supporting = path4.join(appRoot, "supporting-objects");
      if (fs4.existsSync(supporting)) {
        scripts.push(
          ...fs4.readdirSync(supporting, { recursive: true, encoding: "utf8" }).filter((name) => name.endsWith(".sql") && !/deinstall|upgrade/iu.test(name)).sort().map((name) => path4.join(supporting, name))
        );
      }
    }
    return scripts.flatMap(
      (script) => db.runScript(fs4.readFileSync(script, "utf8"), path4.relative(appRoot, script))
    );
  }
};

// packages/core/src/preview/server.ts
var TYPES = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".map": "application/json"
};
function newestApx(root) {
  let newest = 0;
  const visit = (directory) => {
    for (const entry of fs5.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "static-files") continue;
      const full = path5.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith(".apx")) newest = Math.max(newest, fs5.statSync(full).mtimeMs);
    }
  };
  visit(root);
  return newest;
}
async function body(request, limit = 8 * 1048576) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
var PreviewServer = class {
  options;
  assets;
  db;
  seedProblems;
  renderer;
  #server;
  #sessions = /* @__PURE__ */ new Map();
  #loadedAt = 0;
  #loadError;
  constructor(options) {
    this.options = { ...options, sourceDir: path5.resolve(options.sourceDir) };
    this.assets = loadAssets(options.assetsDir);
    const file = options.database ?? path5.join(this.options.sourceDir, ".apex-local", "preview.sqlite");
    if (options.reset && file !== ":memory:")
      for (const suffix of ["", "-wal", "-shm"]) fs5.rmSync(file + suffix, { force: true });
    const fresh = file === ":memory:" || !fs5.existsSync(file);
    this.db = new LocalDatabase(file);
    this.seedProblems = fresh ? ApexRenderer.seed(this.db, this.options.sourceDir) : [];
    this.renderer = this.#load();
  }
  #load() {
    this.#loadedAt = newestApx(this.options.sourceDir);
    const renderer = new ApexRenderer(loadApplication(this.options.sourceDir), this.assets, this.db, {
      ...this.options.toolbar === void 0 ? {} : { toolbar: this.options.toolbar },
      ...this.options.sampleRows === void 0 ? {} : { sampleRows: this.options.sampleRows }
    });
    for (const problem of this.seedProblems) renderer.diagnose("warning", `Seed script: ${problem}`);
    return renderer;
  }
  /** Re-parses the APEXlang tree when any .apx file changed, so edits show on the next reload. */
  #refresh() {
    if (newestApx(this.options.sourceDir) <= this.#loadedAt) return;
    try {
      this.renderer = this.#load();
      this.#loadError = void 0;
    } catch (error) {
      this.#loadError = error.message;
    }
  }
  get url() {
    const address = this.#server?.address();
    if (!address) throw new Error("Preview server is not running");
    const host = address.address.includes(":") ? `[${address.address}]` : address.address;
    return `http://${host}:${address.port}`;
  }
  diagnostics() {
    return [...this.renderer.diagnostics];
  }
  pages() {
    return [...this.renderer.app.pages.values()].filter((page) => page.id !== "0").sort((a, b) => Number(a.id) - Number(b.id)).map((page) => ({
      id: page.id,
      name: str(page.props, "name", page.id),
      url: this.url + this.renderer.pagePath(page),
      mode: str(page.props, "appearance.pageMode", "normal")
    }));
  }
  async start() {
    this.#server = http.createServer((request, response) => {
      this.#handle(request, response).catch((error) => {
        if (!response.headersSent) response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        response.end(`APEX preview error: ${error.message}`);
      });
    });
    await new Promise((resolve, reject) => {
      this.#server.once("error", reject);
      this.#server.listen(this.options.port ?? 0, this.options.host ?? "127.0.0.1", () => resolve());
    });
    return this.url;
  }
  async stop() {
    const server = this.#server;
    this.#server = void 0;
    if (server) await new Promise((resolve) => server.close(() => resolve()));
    server?.closeAllConnections();
    this.db.close();
  }
  session(request, response) {
    const cookie = /(?:^|;\s*)APEX_LOCAL_SESSION=([\w-]+)/u.exec(request.headers.cookie ?? "")?.[1];
    const existing = cookie ? this.#sessions.get(cookie) : void 0;
    if (existing) return existing;
    const id = String(Math.floor(Math.random() * 9e15) + 1e15);
    const session = { id, user: this.options.user ?? "DEVELOPER", items: {}, pagination: {} };
    this.#sessions.set(id, session);
    response.setHeader("set-cookie", `APEX_LOCAL_SESSION=${id}; Path=/; HttpOnly; SameSite=Lax`);
    return session;
  }
  #static(response, root, relative, cache) {
    const target = path5.resolve(root, decodeURIComponent(relative));
    if (!target.startsWith(root + path5.sep) || !fs5.existsSync(target) || !fs5.statSync(target).isFile()) {
      response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": TYPES[path5.extname(target).toLowerCase()] ?? "application/octet-stream",
      "cache-control": cache ? "public, max-age=86400" : "no-cache"
    });
    fs5.createReadStream(target).pipe(response);
  }
  #send(response, status, type, content) {
    response.writeHead(status, { "content-type": type, "cache-control": "no-store" }).end(content);
  }
  async #handle(request, response) {
    const url = new URL(request.url ?? "/", "http://localhost");
    const pathname = url.pathname;
    if (pathname.startsWith("/i/"))
      return this.#static(response, path5.resolve(this.assets.imagesDir), pathname.slice(3), true);
    const marker = pathname.indexOf(`${LOCAL_PREFIX}/`);
    if (marker >= 0) {
      const name = pathname.slice(marker + LOCAL_PREFIX.length + 1);
      if (name === "runtime.js") return this.#send(response, 200, TYPES[".js"], RUNTIME_JS);
      if (name === "runtime.css") return this.#send(response, 200, TYPES[".css"], RUNTIME_CSS);
      if (name === "messages.js") return this.#send(response, 200, TYPES[".js"], messagesScript(MESSAGES));
      if (name === "diagnostics")
        return this.#send(response, 200, TYPES[".json"], JSON.stringify(this.diagnostics(), null, 2));
    }
    this.#refresh();
    if (this.#loadError)
      return this.#send(
        response,
        500,
        "text/plain; charset=utf-8",
        `APEXlang parse error: ${this.#loadError}`
      );
    const renderer = this.renderer;
    if (pathname === "/" || pathname === renderer.baseUrl || pathname === `${renderer.baseUrl}/`) {
      const home = renderer.findPage(renderer.homePage());
      response.writeHead(302, { location: home ? renderer.pagePath(home) : `${renderer.baseUrl}/1` }).end();
      return;
    }
    if (!pathname.startsWith(`${renderer.baseUrl}/`))
      return this.#send(response, 404, "text/plain", "Not found");
    const rest = pathname.slice(renderer.baseUrl.length + 1);
    if (rest.startsWith("files/static/v1/"))
      return this.#static(
        response,
        path5.join(this.options.sourceDir, "shared-components", "static-files"),
        rest.slice(16),
        false
      );
    if (rest.startsWith("files/workspace/"))
      return this.#static(
        response,
        path5.join(this.options.sourceDir, "workspace-components", "static-files"),
        rest.slice(16),
        false
      );
    const session = this.session(request, response);
    if (rest === "wwv_flow.accept" && request.method === "POST") {
      const form = new URLSearchParams(await body(request));
      const json = JSON.parse(form.getAll("p_json").join("") || "{}");
      const values = Object.fromEntries(
        (json.pageItems?.itemsToSubmit ?? []).map((item) => [
          item.n,
          Array.isArray(item.v) ? item.v.join(":") : String(item.v ?? "")
        ])
      );
      const page2 = form.get("p_flow_step_id") ?? "";
      const result = renderer.isLoginPage(page2) ? renderer.login(session, values) : renderer.accept(session, page2, form.get("p_request") ?? "", values);
      return this.#send(
        response,
        200,
        TYPES[".json"],
        JSON.stringify({ ...result, pageSubmissionId: String(Date.now()) })
      );
    }
    if (rest === "wwv_flow.ajax" || rest === "wwv_flow.show") {
      renderer.diagnose("info", "An APEX Ajax/plug-in request was ignored by the local preview");
      return this.#send(response, 200, TYPES[".json"], "{}");
    }
    if (rest === "__logout") {
      session.items = {};
      session.user = this.options.user ?? "DEVELOPER";
      response.writeHead(302, { location: renderer.baseUrl }).end();
      return;
    }
    if (rest === `${LOCAL_PREFIX.slice(1)}/region`) {
      const page2 = url.searchParams.get("page") ?? "";
      const region = url.searchParams.get("region") ?? "";
      const target = Number(url.searchParams.get("pg"));
      if (target > 0) {
        const component = renderer.findPage(page2)?.children.find((child) => renderer.regionDomId(child) === region);
        if (component) session.pagination[`${page2}:${component.id}`] = target;
      }
      return this.#send(response, 200, TYPES[".html"], renderer.renderRegionFragment(session, page2, region));
    }
    if (rest === `${LOCAL_PREFIX.slice(1)}/server-code` && request.method === "POST") {
      const input = JSON.parse(await body(request));
      const values = renderer.executeServerCode(
        session,
        url.searchParams.get("page") ?? "",
        input.code ?? "",
        input.items ?? {},
        input.returnItems ?? []
      );
      return this.#send(response, 200, TYPES[".json"], JSON.stringify(values));
    }
    if (rest === `${LOCAL_PREFIX.slice(1)}/close-dialog`) {
      const success = session.success;
      session.success = void 0;
      const data = JSON.stringify({
        dialogPageId: url.searchParams.get("page"),
        ...success ? { successMessage: { text: success } } : {}
      });
      return this.#send(
        response,
        200,
        TYPES[".html"],
        `<!DOCTYPE html><html><head><meta charset="utf-8"><script>window.apex={env:${JSON.stringify({ APP_SESSION: session.id })}};</script><script src="/i/libraries/apex/minified/desktop_all.min.js"></script></head><body><script>apex.navigation.dialog.close(true, ${data.replaceAll("<", "\\u003c")});</script></body></html>`
      );
    }
    const page = renderer.findPage(decodeURIComponent(rest));
    if (!page) {
      const links = this.pages().map((entry) => `<li><a href="${entry.url}">${entry.id} \xB7 ${entry.name}</a></li>`).join("");
      return this.#send(
        response,
        404,
        TYPES[".html"],
        `<!DOCTYPE html><meta charset="utf-8"><title>Page not found</title><h1>Page ${rest} not found</h1><ul>${links}</ul>`
      );
    }
    for (const clear of (url.searchParams.get("clear") ?? "").split(",").map((value) => value.trim()).filter(Boolean)) {
      if (clear.toUpperCase() === "RP") {
        for (const key of Object.keys(session.pagination))
          if (key.startsWith(`${page.id}:`)) delete session.pagination[key];
        continue;
      }
      const cleared = renderer.findPage(clear);
      for (const child of cleared?.children ?? [])
        if (child.type === "pageItem") delete session.items[child.id.toUpperCase()];
    }
    for (const [key, value] of url.searchParams) {
      if (!["clear", "request", "session", "cs"].includes(key)) session.items[key.toUpperCase()] = value;
    }
    const ctx = renderer.prepare(session, page.id, url.searchParams.get("request") ?? "");
    return this.#send(response, 200, TYPES[".html"], renderer.renderPage(ctx));
  }
};
function checkApplication(options) {
  const preview = new PreviewServer({ ...options, database: options.database ?? ":memory:" });
  try {
    const renderer = preview.renderer;
    const ids = options.pages?.length ? options.pages : [...renderer.app.pages.keys()].filter((id) => id !== "0");
    const pages = ids.map((id) => {
      const page = renderer.findPage(id);
      const name = str(page?.props ?? {}, "name", id);
      try {
        const session = {
          id: randomUUID(),
          user: options.user ?? "DEVELOPER",
          items: {},
          pagination: {}
        };
        const html = renderer.renderPage(renderer.prepare(session, id));
        return { id: page?.id ?? id, name, bytes: Buffer.byteLength(html) };
      } catch (error) {
        renderer.diagnose("error", error.message, id);
        return { id, name, bytes: 0, error: error.message };
      }
    });
    return { pages, diagnostics: preview.diagnostics() };
  } finally {
    preview.db.close();
  }
}

// packages/core/src/preview/service.ts
var running = /* @__PURE__ */ new Map();
var DIAGNOSTICS_LIMIT = 60;
async function resolveSource(root, explicit) {
  let source = explicit ? path6.resolve(root, explicit) : void 0;
  if (!source) {
    try {
      const ctx = await loadProject(root);
      source = path6.resolve(ctx.root, ctx.config.application.sourceDir);
    } catch {
      source = path6.resolve(root);
    }
  }
  if (!fs6.existsSync(path6.join(source, "application.apx")))
    throw new Fault(
      "PREVIEW_SOURCE_MISSING",
      `${source} has no application.apx. Pass sourceDir with the APEXlang application folder.`,
      2
    );
  return fs6.realpathSync(source);
}
function summarize(diagnostics) {
  const count = (level) => diagnostics.filter((entry) => entry.level === level).length;
  const ranked = [...diagnostics].sort(
    (a, b) => ["error", "warning", "info"].indexOf(a.level) - ["error", "warning", "info"].indexOf(b.level)
  );
  return {
    counts: { error: count("error"), warning: count("warning"), info: count("info") },
    diagnostics: ranked.slice(0, DIAGNOSTICS_LIMIT),
    truncated: diagnostics.length > DIAGNOSTICS_LIMIT
  };
}
function assetsReady(assetsDir) {
  try {
    loadAssets(assetsDir);
  } catch (error) {
    throw new Fault("PREVIEW_ASSETS_MISSING", error.message, 3, "blocked", {
      nextActions: [
        "Run apexrest preview setup (downloads the APEX 26.2 distribution once) or pass --zip with a local apex_26.2 zip."
      ]
    });
  }
}
async function previewSetup(input) {
  const assets = await setupAssets({
    ...input.assetsDir ? { assetsDir: input.assetsDir } : {},
    ...input.zip ? { zipPath: input.zip } : {},
    ...input.sha256 ? { expectedSha256: input.sha256 } : {},
    onProgress: (message) => process.stderr.write(`[preview] ${message}
`)
  });
  return {
    assetsDir: assets.dir,
    apexVersion: assets.manifest.apexVersion,
    files: assets.manifest.files,
    sha256: assets.manifest.sha256,
    source: assets.manifest.source,
    templates: assets.theme.length
  };
}
async function previewStart(root, input) {
  const sourceDir = await resolveSource(root, input.sourceDir);
  assetsReady(input.assetsDir);
  const previous = running.get(sourceDir);
  if (previous && !input.reset && input.port === void 0) return describe(previous, true);
  if (previous) {
    await previous.stop();
    running.delete(sourceDir);
  }
  const server = new PreviewServer({
    sourceDir,
    ...input.assetsDir ? { assetsDir: input.assetsDir } : {},
    ...input.port === void 0 ? {} : { port: input.port },
    ...input.reset ? { reset: true } : {},
    ...input.sampleRows === void 0 ? {} : { sampleRows: input.sampleRows },
    ...input.user ? { user: input.user } : {},
    ...input.toolbar === void 0 ? {} : { toolbar: input.toolbar }
  });
  await server.start();
  running.set(sourceDir, server);
  return describe(server, false);
}
function describe(server, reused) {
  return {
    url: server.url,
    reused,
    sourceDir: server.options.sourceDir,
    database: server.db.file,
    apexVersion: APEX_FULL_VERSION,
    pages: server.pages(),
    note: "Local simulation with Universal Theme 26.2 assets and SQLite. Not Oracle evidence; PL/SQL beyond plain DML is skipped.",
    ...summarize(server.diagnostics())
  };
}
async function previewStop(root, input) {
  const targets = input.all ? [...running.keys()] : [await resolveSource(root, input.sourceDir)];
  const stopped = [];
  for (const target of targets) {
    const server = running.get(target);
    if (!server) continue;
    await server.stop();
    running.delete(target);
    stopped.push(target);
  }
  return { stopped, running: [...running.keys()] };
}
async function previewStatus() {
  return {
    assetsDir: defaultAssetsDir(),
    assetsInstalled: fs6.existsSync(path6.join(defaultAssetsDir(), "manifest.json")),
    download: APEX_DOWNLOAD_URL,
    running: [...running.values()].map((server) => ({
      url: server.url,
      sourceDir: server.options.sourceDir,
      ...summarize(server.diagnostics()).counts
    }))
  };
}
async function previewCheck(root, input) {
  const sourceDir = await resolveSource(root, input.sourceDir);
  assetsReady(input.assetsDir);
  const result = checkApplication({
    sourceDir,
    ...input.assetsDir ? { assetsDir: input.assetsDir } : {},
    ...input.pages ? { pages: input.pages } : {},
    ...input.sampleRows === void 0 ? {} : { sampleRows: input.sampleRows },
    toolbar: false
  });
  return { sourceDir, pages: result.pages, ...summarize(result.diagnostics) };
}
async function previewDispatch(operation, parsed, root) {
  const { action, ...input } = parsed;
  const selected = operation === "preview" ? String(action) : operation.slice("preview.".length);
  switch (selected) {
    case "setup":
      return previewSetup(input);
    case "start":
      return previewStart(root, input);
    case "check":
      return previewCheck(root, input);
    case "stop":
      return previewStop(root, input);
    case "status":
      return previewStatus();
    default:
      throw new Fault("INVALID_INPUT", `Unknown preview action: ${selected}`, 2);
  }
}
export {
  previewCheck,
  previewDispatch,
  previewSetup,
  previewStart,
  previewStatus,
  previewStop
};
