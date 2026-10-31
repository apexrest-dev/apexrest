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
import fs8 from "node:fs";
import path8 from "node:path";

// packages/core/src/preview/assets.ts
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";

// packages/core/src/preview/theme-sql.ts
var FUNCTIONS = {
  "wwv_flow_string.join": (args) => Array.isArray(args[0]) ? args[0].map((item2) => item2 ?? "").join("\n") : args[0],
  wwv_flow_t_varchar2: (args) => args,
  "wwv_flow_imp.id": (args) => args[0] === void 0 || args[0] === null ? void 0 : String(args[0]),
  nvl: (args) => args[0] ?? args[1]
};
var Parser = class {
  #text;
  #index = 0;
  constructor(text5) {
    this.#text = text5;
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
  "libraries/fullcalendar/",
  "libraries/markedjs/",
  "libraries/cropperjs/",
  "plugins/com.oracle.apex.carousel/",
  `themes/theme_42/${APEX_VERSION}/`,
  "app_ui/",
  "css/"
];
var THEME_SQL = `apex/core/themes/f8842.${APEX_VERSION.replace(".", "")}.sql`;
function defaultAssetsDir(environment = process.env) {
  const configured2 = environment[APEX_ASSETS_ENV];
  return configured2 ? path.resolve(configured2) : path.join(managedHome(), "preview", APEX_VERSION);
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
  #read(position2, length) {
    const buffer = Buffer.alloc(length);
    let done = 0;
    while (done < length) {
      const read = fs.readSync(this.#fd, buffer, done, length - done, position2 + done);
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
async function download(url2, target2, onProgress) {
  const response = await fetch(url2);
  if (!response.ok || !response.body)
    throw new Error(`Download failed: ${response.status} ${response.statusText} (${url2})`);
  const total = Number(response.headers.get("content-length")) || 0;
  let received = 0;
  let reported = 0;
  const body3 = Readable.fromWeb(response.body);
  body3.on("data", (chunk) => {
    received += chunk.length;
    if (onProgress && received - reported > 25 * 1048576) {
      reported = received;
      onProgress(
        `downloaded ${(received / 1048576).toFixed(0)}${total ? ` / ${(total / 1048576).toFixed(0)}` : ""} MB`
      );
    }
  });
  await pipeline(body3, fs.createWriteStream(target2, { mode: 384 }));
}
async function setupAssets(options2 = {}) {
  const dir = path.resolve(options2.assetsDir ?? defaultAssetsDir());
  const progress = options2.onProgress ?? (() => void 0);
  fs.mkdirSync(dir, { recursive: true });
  let zipPath = options2.zipPath ? path.resolve(options2.zipPath) : void 0;
  let downloaded = false;
  if (!zipPath) {
    const url2 = options2.url ?? APEX_DOWNLOAD_URL;
    zipPath = path.join(dir, `apex_${APEX_VERSION}.zip`);
    if (!fs.existsSync(zipPath)) {
      progress(`downloading ${url2}`);
      const partial = `${zipPath}.part`;
      await download(url2, partial, progress);
      fs.renameSync(partial, zipPath);
    }
    downloaded = true;
  }
  const digest = await sha256(zipPath);
  if (options2.expectedSha256 && digest !== options2.expectedSha256.toLowerCase()) {
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
      const target2 = path.resolve(staging, relative);
      if (!target2.startsWith(`${staging}${path.sep}`)) throw new Error(`Unsafe zip entry ${entry.name}`);
      fs.mkdirSync(path.dirname(target2), { recursive: true });
      fs.writeFileSync(target2, zip.read(entry));
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
    source: options2.zipPath ? zipPath : options2.url ?? APEX_DOWNLOAD_URL,
    sha256: digest,
    extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
    files
  };
  fs.writeFileSync(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}
`);
  if (downloaded && !options2.keepZip) fs.rmSync(zipPath, { force: true });
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
import fs7 from "node:fs";
import http from "node:http";
import path7 from "node:path";

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
  const text5 = raw.trim();
  if (text5 === "true") return true;
  if (text5 === "false") return false;
  if (text5.startsWith('"') && text5.endsWith('"') && text5.length >= 2) return unquote(text5);
  if (text5.length >= 2 && text5.startsWith("\\") && text5.endsWith("\\")) return text5.slice(1, -1);
  if (/^@\S+$/u.test(text5) && !text5.endsWith("@")) {
    return text5.startsWith("@/") ? { ref: text5.slice(2), global: true } : { ref: text5.slice(1), global: false };
  }
  return text5;
}
function inlineArray(text5) {
  const body3 = text5.slice(1, -1).trim();
  if (!body3) return [];
  const values = [];
  for (const match of body3.matchAll(/"(?:[^"\\]|\\.)*"|\S+/gu)) values.push(scalar(match[0]));
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
    const body3 = [];
    index += 1;
    while (index < lines.length && (lines[index] ?? "").trim() !== "```") {
      const line = lines[index] ?? "";
      const leading = line.length - line.trimStart().length;
      body3.push(line.slice(Math.min(indent, leading)));
      index += 1;
    }
    if (index >= lines.length) fail("unterminated ``` block");
    index += 1;
    return body3.join("\n");
  };
  const readValue = (raw) => {
    const text5 = (raw ?? "").trim();
    if (text5 === "") {
      const next = (lines[index] ?? "").trim();
      if (next.startsWith("```")) return readFence();
      return "";
    }
    if (text5 === "{") return readBlock("}");
    if (text5 === "[") return readArray();
    if (text5.startsWith("[") && text5.endsWith("]")) return inlineArray(text5);
    if (text5.startsWith("```") && text5.endsWith("```") && text5.length >= 6) return text5.slice(3, -3);
    return scalar(text5);
  };
  const readArray = () => {
    const values = [];
    while (index < lines.length) {
      const text5 = (lines[index] ?? "").trim();
      index += 1;
      if (!text5) continue;
      if (text5 === "]") return values;
      if (text5 === "{") values.push(readBlock("}"));
      else if (text5.startsWith("```")) {
        index -= 1;
        values.push(readFence());
      } else values.push(scalar(text5));
    }
    return fail("unterminated array");
  };
  function readBlock(close, children) {
    const props = {};
    while (index < lines.length) {
      const text5 = (lines[index] ?? "").trim();
      const lineNumber = index + 1;
      index += 1;
      if (!text5) continue;
      if (text5 === close) return props;
      const property = PROPERTY.exec(text5);
      if (property) {
        props[unquote(property[1])] = readValue(property[2]);
        continue;
      }
      const group2 = GROUP.exec(text5);
      if (group2) {
        const nested = readBlock("}", children);
        const existing = props[group2[1]];
        props[group2[1]] = isObject(existing) ? { ...existing, ...nested } : nested;
        continue;
      }
      const component = COMPONENT.exec(text5);
      if (component && children) {
        children.push(readComponent(component[1], component[2] ?? "", lineNumber));
        continue;
      }
      index -= 1;
      fail(`unexpected line: ${text5.slice(0, 120)}`);
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
    const text5 = (lines[index] ?? "").trim();
    const lineNumber = index + 1;
    index += 1;
    if (!text5) continue;
    const component = COMPONENT.exec(text5);
    if (!component) {
      index -= 1;
      fail(`expected a component declaration, found: ${text5.slice(0, 120)}`);
    }
    components.push(readComponent(component[1], component[2] ?? "", lineNumber));
  }
  return components;
}
function get(props, dotted) {
  let value = props;
  for (const part2 of dotted.split(".")) {
    if (!isObject(value)) return void 0;
    value = value[part2];
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
  const pages2 = /* @__PURE__ */ new Map();
  const shared = [];
  let app;
  for (const file of files) {
    const relative = path2.relative(root, file);
    const text5 = fs2.readFileSync(file, "utf8").replace(
      /@([A-Z][A-Z0-9_]*)@/gu,
      (whole, name) => substitutions[name] ?? (name === "APP_ALIAS" ? path2.basename(root).toLowerCase() : name === "APP_NAME" ? path2.basename(root) : whole)
    );
    for (const component of parseApexLang(text5, relative)) {
      if (component.type === "app") app = component;
      else if (component.type === "page") pages2.set(component.id, component);
      else shared.push(component);
    }
  }
  if (!app) throw new Error(`${appFile} does not declare an app component`);
  return { root, app, pages: pages2, shared, substitutions, files };
}

// packages/core/src/preview/client.ts
var RUNTIME_CSS = `
.apex-local-toolbar{position:fixed;left:8px;bottom:8px;z-index:2000;max-width:min(640px,calc(100vw - 16px));font:12px/1.4 system-ui,sans-serif;background:rgba(32,32,36,.92);color:#fff;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.25)}
.apex-local-toolbar summary{cursor:pointer;padding:6px 10px;list-style:none}
.apex-local-style{display:block;padding:0 10px 8px}.apex-local-style select{margin-left:6px;font:inherit}
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

  function serverValue(settings) {
    var items = {};
    String(settings.itemsToSubmit || "").split(",").forEach(function (name) {
      name = name.trim();
      if (name) items[name] = apex.item(name).getValue();
    });
    return fetch(base + "/__apex/x/set-value?page=" + encodeURIComponent(apex.env.APP_PAGE_ID), {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ type: settings.type, sqlQuery: settings.sqlQuery, plsqlExpression: settings.plsqlExpression,
        plsqlFunctionBody: settings.plsqlFunctionBody, items: items })
    }).then(function (response) { return response.ok ? response.json() : { error: "HTTP " + response.status }; })
      .then(function (result) {
        if (result && result.error !== undefined) { console.warn("[apex-local] set value:", result.error); return undefined; }
        return result ? result.value : undefined;
      });
  }

  function setValues(selector, trigger, value, suppress) {
    each(selector, trigger, function (item) { item.setValue(value, null, !!suppress); }, function (el) { el.text(value); });
  }

  function regionsOf(selector, trigger) {
    return elements(selector, trigger).toArray().map(function (el) { return el.id; }).filter(Boolean);
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
        return Promise.all(elements(action.selector, trigger).toArray().map(function (el) {
          if (apex.region.isRegion && apex.region.isRegion(el.id)) return apex.region(el.id).refresh();
          if (isItem(el) && apex.item(el.id).refresh) return apex.item(el.id).refresh();
          return undefined;
        }));
      case "submitPage":
        return apex.page.submit({ request: settings.requestButtonName || settings.request || "", showWait: settings.showProcessing !== false });
      case "cancelDialog":
        return apex.navigation.dialog.cancel(true);
      case "closeDialog":
        return apex.navigation.dialog.close(true);
      case "show":
        return each(action.selector, trigger, function (item) { item.show(settings.showAllOnSameLine === true); }, function (el) { el.show(); });
      case "hide":
        return each(action.selector, trigger, function (item) { item.hide(settings.hidePageItemsOnSameLine === true); }, function (el) { el.hide(); });
      case "enable":
        return each(action.selector, trigger, function (item) { item.enable(); }, function (el) { el.prop("disabled", false).removeClass("apex_disabled"); });
      case "disable":
        return each(action.selector, trigger, function (item) { item.disable(); }, function (el) { el.prop("disabled", true).addClass("apex_disabled"); });
      case "clear":
        return each(action.selector, trigger, function (item) { item.setValue(""); }, function (el) { el.empty(); });
      case "setFocus":
        return each(action.selector, trigger, function (item) { item.setFocus(); }, function (el) { el.trigger("focus"); });
      case "addClass":
        return elements(action.selector, trigger).addClass(settings.cssClasses || settings.class || settings.cssClass || "");
      case "removeClass":
        return elements(action.selector, trigger).removeClass(settings.cssClasses || settings.class || settings.cssClass || "");
      case "setStyle":
        return elements(action.selector, trigger).css(settings.styleName || "", settings.value || "");
      case "openRegion":
        return regionsOf(action.selector, trigger).forEach(function (id) {
          if (apex.theme && apex.theme.openRegion) apex.theme.openRegion(id); else $("#" + apex.util.escapeCSS(id)).show();
        });
      case "closeRegion":
        return regionsOf(action.selector, trigger).forEach(function (id) {
          if (apex.theme && apex.theme.closeRegion) apex.theme.closeRegion(id); else $("#" + apex.util.escapeCSS(id)).hide();
        });
      case "cancelEvent":
        if (event && event.preventDefault) event.preventDefault();
        apex.event.gCancelFlag = true;
        return Promise.reject(null);
      case "alert":
        return new Promise(function (resolve) {
          apex.message.alert(settings.text || settings.message || "", function () { resolve(); }, { title: settings.title, style: settings.style });
        });
      case "confirm":
        return new Promise(function (resolve, reject) {
          apex.message.confirm(settings.text || settings.message || "", function (ok) { if (ok) resolve(); else reject(null); },
            { title: settings.title, style: settings.style, confirmLabel: settings.confirmLabel || settings.okLabel, cancelLabel: settings.cancelLabel });
        });
      case "showSuccessMessage":
        return apex.message.showPageSuccess(settings.message || settings.text || "");
      case "showErrorMessage":
        if (settings.clearErrors !== false) apex.message.clearErrors();
        return apex.message.showErrors([{ type: "error", location: settings.item ? ["inline", "page"] : "page",
          pageItem: settings.item || undefined, message: settings.message || settings.text || "", unsafe: false }]);
      case "clearErrors":
        return apex.message.clearErrors();
      case "setValue": {
        var type = settings.type || settings.setType || "static";
        if (type === "sqlQuery" || type === "plsqlExpression" || type === "plsqlFunctionBody") {
          return serverValue(settings).then(function (value) { if (value !== undefined) setValues(action.selector, trigger, value, settings.suppressChangeEvent); });
        }
        var value = type === "jsExpression" || type === "javascriptExpression"
          ? expression(settings.jsExpression || settings.javascriptExpression || "''", { triggeringElement: trigger, data: event && event.data })
          : type === "dialogReturnItem" ? (event && event.data ? event.data[settings.returnItem || settings.dialogReturnItem] : "")
          : settings.value !== undefined ? settings.value : settings.staticValue;
        return setValues(action.selector, trigger, value === undefined || value === null ? "" : value, settings.suppressChangeEvent);
      }
      case "executeServerSideCode":
        return serverCode(settings);
      case "getCurrentPosition":
        if (!navigator.geolocation) return undefined;
        return new Promise(function (resolve) {
          navigator.geolocation.getCurrentPosition(function (position) {
            if (settings.latitudeItem) apex.item(settings.latitudeItem).setValue(position.coords.latitude);
            if (settings.longitudeItem) apex.item(settings.longitudeItem).setValue(position.coords.longitude);
            resolve();
          }, function () { resolve(); }, { enableHighAccuracy: settings.enableHighAccuracy === true });
        });
      case "share":
        if (navigator.share) return navigator.share({ title: settings.title, text: settings.text, url: settings.url || location.href }).catch(function () {});
        return undefined;
      default:
        console.warn("[apex-local] dynamic action \"" + action.action + "\" is not simulated");
    }
  }

  function compare(left, right) {
    var a = Number(left), b = Number(right);
    return isFinite(a) && isFinite(b) && left !== "" && right !== "" ? a - b : String(left).localeCompare(String(right));
  }

  function conditionHolds(condition, trigger) {
    if (!condition || !condition.type) return true;
    var value = condition.item ? apex.item(condition.item).getValue() : $(trigger).val();
    value = Array.isArray(value) ? value.join(":") : value;
    if (value === null || value === undefined) value = "";
    var empty = value === "";
    var list = condition.list && condition.list.length ? condition.list : String(condition.value || "").split(",");
    switch (condition.type) {
      case "itemIsNull": case "isNull": return empty;
      case "itemIsNotNull": case "isNotNull": return !empty;
      case "item=value": case "equals": case "itemEqualsValue": return String(value) === condition.value;
      case "item!=value": case "notEquals": case "itemNotEqualsValue": return String(value) !== condition.value;
      case "item>value": return compare(value, condition.value) > 0;
      case "item>=value": return compare(value, condition.value) >= 0;
      case "item<value": return compare(value, condition.value) < 0;
      case "item<=value": return compare(value, condition.value) <= 0;
      case "itemIsInList": case "itemInList": case "inList": return list.indexOf(String(value)) >= 0;
      case "itemIsNotInList": return list.indexOf(String(value)) < 0;
      case "jsExpression": case "javascriptExpression":
        return !!expression(condition.expression, { triggeringElement: trigger });
      default: return true;
    }
  }

  function fire(da, event, trigger, init) {
    var holds = conditionHolds(da.condition, trigger);
    var queue = da.actions.filter(function (action) { return action.whenFalse === !holds && (!init || action.fireOnInit); });
    return queue.reduce(function (promise, action) {
      return promise.then(function () {
        try {
          var result = run(action, event, trigger);
          return action.wait === false ? undefined : result;
        } catch (error) {
          if (action.stopOnError === false) { apex.debug.error(error); return undefined; }
          throw error;
        }
      });
    }, Promise.resolve()).catch(function (error) { if (error) apex.debug.error(error); });
  }

  var EVENTS = { "page load": "ready", pageload: "ready", "lose focus": "focusout", losefocus: "focusout", "get focus": "focusin", getfocus: "focusin",
    afterrefresh: "apexafterrefresh", beforerefresh: "apexbeforerefresh", beforepagesubmit: "apexbeforepagesubmit", dialogclosed: "apexafterclosedialog" };

  function timed(da, handler) {
    if (da.timing === "debounce" && da.time > 0) {
      var timer = null;
      return function () {
        var self = this, args = arguments;
        if (da.immediate && !timer) handler.apply(self, args);
        clearTimeout(timer);
        timer = setTimeout(function () { timer = null; if (!da.immediate) handler.apply(self, args); }, da.time);
      };
    }
    if (da.timing === "throttle" && da.time > 0) {
      var last = 0;
      return function () {
        var now = Date.now();
        if (now - last >= da.time) { last = now; handler.apply(this, arguments); }
      };
    }
    return handler;
  }

  function bindDynamicAction(da) {
    var event = EVENTS[String(da.event).toLowerCase()] || da.event;
    if (event === "ready") return fire(da, null, document, false);
    var handler = timed(da, function (browserEvent, data) {
      if (data !== undefined) browserEvent.data = data;
      fire(da, browserEvent, this, false);
    });
    var on = da.scope === "once" ? "one" : "on";
    if (!da.selector || da.selector === "document") $(document)[on](event, handler);
    else if (da.selector.indexOf("js:") === 0) elements(da.selector, document)[on](event, handler);
    else if (da.scope === "dynamic" || da.scope === "static") $(da.container || document)[on](event, da.selector, handler);
    else $(da.selector)[on](event, handler);
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
var MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function oracleDate(value) {
  if (value === null || value === void 0 || value === "") return void 0;
  if (typeof value === "number") {
    const date2 = new Date(value);
    return Number.isNaN(date2.getTime()) ? void 0 : date2;
  }
  const raw = String(value).trim();
  const oracle = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/u.exec(raw);
  if (oracle) {
    const month = MONTH_NAMES.findIndex(
      (name) => name.slice(0, 3).toUpperCase() === oracle[2].toUpperCase()
    );
    const year = Number(oracle[3].length === 2 ? `20${oracle[3]}` : oracle[3]);
    if (month >= 0)
      return new Date(
        year,
        month,
        Number(oracle[1]),
        Number(oracle[4] ?? 0),
        Number(oracle[5] ?? 0),
        Number(oracle[6] ?? 0)
      );
  }
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/u.test(raw) ? `${raw}T00:00:00` : raw.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? void 0 : date;
}
var pad = (value, size = 2) => String(value).padStart(size, "0");
function isoDate(date, time = true) {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return time ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` : day;
}
var DATE_TOKENS = [
  "SSSSS",
  "SYYYY",
  "MONTH",
  "A.M.",
  "P.M.",
  "HH24",
  "HH12",
  "RRRR",
  "YYYY",
  "IYYY",
  "YYY",
  "DDD",
  "DAY",
  "MON",
  "TZR",
  "TZH",
  "TZM",
  "FF1",
  "FF2",
  "FF3",
  "FF4",
  "FF5",
  "FF6",
  "FF7",
  "FF8",
  "FF9",
  "FF",
  "YY",
  "RR",
  "MM",
  "DD",
  "DY",
  "HH",
  "MI",
  "SS",
  "AM",
  "PM",
  "FM",
  "WW",
  "IW",
  "Y",
  "D",
  "Q",
  "W",
  "J"
];
function isoWeek(date) {
  const target2 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (target2.getDay() + 6) % 7;
  target2.setDate(target2.getDate() - day + 3);
  const first = new Date(target2.getFullYear(), 0, 4);
  return 1 + Math.round(((target2.getTime() - first.getTime()) / 864e5 - 3 + (first.getDay() + 6) % 7) / 7);
}
var dayOfYear = (date) => Math.floor(
  (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 1)) / 864e5
) + 1;
function formatDate(date, mask) {
  let out = "";
  let fm = false;
  for (let index = 0; index < mask.length; ) {
    if (mask[index] === '"') {
      const end = mask.indexOf('"', index + 1);
      out += mask.slice(index + 1, end < 0 ? mask.length : end);
      index = end < 0 ? mask.length : end + 1;
      continue;
    }
    const token = DATE_TOKENS.find(
      (candidate) => mask.slice(index, index + candidate.length).toUpperCase() === candidate
    );
    if (!token) {
      out += mask[index];
      index += 1;
      continue;
    }
    const raw = mask.slice(index, index + token.length);
    index += token.length;
    const number = (value, width) => fm ? String(value) : pad(value, width);
    const cased = (word) => raw === raw.toUpperCase() ? word.toUpperCase() : raw[0] === raw[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase();
    const hours12 = date.getHours() % 12 || 12;
    switch (token) {
      case "FM":
        fm = !fm;
        break;
      case "YYYY":
      case "SYYYY":
      case "RRRR":
      case "IYYY":
        out += String(date.getFullYear());
        break;
      case "YYY":
        out += pad(date.getFullYear() % 1e3, 3);
        break;
      case "YY":
      case "RR":
        out += pad(date.getFullYear() % 100);
        break;
      case "Y":
        out += String(date.getFullYear() % 10);
        break;
      case "MONTH":
        out += cased(MONTH_NAMES[date.getMonth()]);
        break;
      case "MON":
        out += cased(MONTH_NAMES[date.getMonth()].slice(0, 3));
        break;
      case "MM":
        out += number(date.getMonth() + 1, 2);
        break;
      case "DDD":
        out += number(dayOfYear(date), 3);
        break;
      case "DD":
        out += number(date.getDate(), 2);
        break;
      case "DAY":
        out += cased(DAY_NAMES[date.getDay()]);
        break;
      case "DY":
        out += cased(DAY_NAMES[date.getDay()].slice(0, 3));
        break;
      case "D":
        out += String(date.getDay() + 1);
        break;
      case "HH24":
        out += number(date.getHours(), 2);
        break;
      case "HH12":
      case "HH":
        out += number(hours12, 2);
        break;
      case "MI":
        out += number(date.getMinutes(), 2);
        break;
      case "SS":
        out += number(date.getSeconds(), 2);
        break;
      case "SSSSS":
        out += String(date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds());
        break;
      case "AM":
      case "PM":
        out += cased(date.getHours() < 12 ? "AM" : "PM");
        break;
      case "A.M.":
      case "P.M.":
        out += cased(date.getHours() < 12 ? "A.M." : "P.M.");
        break;
      case "Q":
        out += String(Math.floor(date.getMonth() / 3) + 1);
        break;
      case "WW":
        out += number(Math.floor((dayOfYear(date) - 1) / 7) + 1, 2);
        break;
      case "IW":
        out += number(isoWeek(date), 2);
        break;
      case "W":
        out += String(Math.floor((date.getDate() - 1) / 7) + 1);
        break;
      case "J":
        out += String(Math.floor(date.getTime() / 864e5 + 24405875e-1));
        break;
      case "TZR":
      case "TZH":
      case "TZM":
        break;
      default:
        out += pad(date.getMilliseconds(), 3).padEnd(9, "0").slice(0, Number(token.slice(2) || 6));
    }
  }
  return out;
}
function formatNumber(value, upper) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (/X/u.test(upper))
    return Math.round(number).toString(16)[upper.includes("x") ? "toLowerCase" : "toUpperCase"]();
  const body3 = upper.replace(/^FM/u, "").replace(/^[L$S]/u, "").replace(/(MI|PR|S)$/u, "");
  const [whole = "", fraction = ""] = body3.split(/[D.]/u);
  const decimals = fraction.replace(/[^09]/gu, "").length;
  const zeros = whole.includes("0") ? whole.slice(whole.indexOf("0")).replace(/[^09]/gu, "").length : 0;
  let text5 = Math.abs(number).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    minimumIntegerDigits: Math.max(1, zeros),
    useGrouping: /[G,]/u.test(whole)
  });
  if (!zeros && !decimals && text5 === "0" && whole && !whole.includes("0")) text5 = "0";
  if (!zeros && text5.startsWith("0.") && !whole.includes("0") && whole) text5 = text5.slice(1);
  if (/^FM?[L$]|^[L$]/u.test(upper.replace(/^FM/u, "F"))) text5 = `$${text5}`;
  if (number < 0) return upper.endsWith("MI") ? `${text5}-` : upper.endsWith("PR") ? `<${text5}>` : `-${text5}`;
  return upper.endsWith("S") && upper.startsWith("S") ? `+${text5}` : text5;
}
function formatOracle(value, mask) {
  if (value === null || value === void 0) return null;
  if (!mask) return String(value);
  const upper = mask.trim().toUpperCase();
  if (upper === "TM" || upper === "TM9") return String(Number(value));
  if (/[90X]/u.test(upper) && /^(?:FM)?[L$S]?[09GD,.X]+(?:MI|PR|S)?$/u.test(upper))
    return formatNumber(value, upper);
  if (upper === "DS" || upper === "DL") {
    const date2 = oracleDate(value);
    if (!date2) return String(value);
    return upper === "DS" ? date2.toLocaleDateString("en-US") : date2.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  const date = oracleDate(value);
  return date ? formatDate(date, mask) : String(value);
}
function parseOracleDate(value, mask) {
  if (value === null || value === void 0 || value === "") return void 0;
  if (!mask) return oracleDate(value);
  const source = String(value).trim();
  const parts = {
    year: (/* @__PURE__ */ new Date()).getFullYear(),
    month: 0,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    pm: false
  };
  let position2 = 0;
  const digits = (max) => {
    const match = new RegExp(`^\\d{1,${max}}`, "u").exec(source.slice(position2));
    if (!match) throw new Error("mismatch");
    position2 += match[0].length;
    return Number(match[0]);
  };
  try {
    for (let index = 0; index < mask.length; ) {
      const token = DATE_TOKENS.find(
        (candidate) => mask.slice(index, index + candidate.length).toUpperCase() === candidate
      );
      if (!token) {
        index += 1;
        if (/[^\w]/u.test(source[position2] ?? "")) position2 += 1;
        continue;
      }
      index += token.length;
      switch (token) {
        case "YYYY":
        case "RRRR":
        case "SYYYY":
          parts.year = digits(4);
          break;
        case "YY":
        case "RR": {
          const year = digits(2);
          parts.year = year < 50 ? 2e3 + year : 1900 + year;
          break;
        }
        case "MM":
          parts.month = digits(2) - 1;
          break;
        case "MON":
        case "MONTH": {
          const word = /^[A-Za-z]+/u.exec(source.slice(position2))?.[0] ?? "";
          position2 += word.length;
          parts.month = MONTH_NAMES.findIndex(
            (name) => name.slice(0, 3).toUpperCase() === word.slice(0, 3).toUpperCase()
          );
          if (parts.month < 0) throw new Error("mismatch");
          break;
        }
        case "DD":
          parts.day = digits(2);
          break;
        case "HH24":
        case "HH":
        case "HH12":
          parts.hour = digits(2);
          break;
        case "MI":
          parts.minute = digits(2);
          break;
        case "SS":
          parts.second = digits(2);
          break;
        case "AM":
        case "PM":
          parts.pm = /^p/iu.test(source.slice(position2));
          position2 += 2;
          break;
        default:
          break;
      }
    }
  } catch {
    return oracleDate(value);
  }
  const hour = parts.pm && parts.hour < 12 ? parts.hour + 12 : parts.hour;
  const date = new Date(parts.year, parts.month, parts.day, hour, parts.minute, parts.second);
  return Number.isNaN(date.getTime()) ? void 0 : date;
}
function truncDate(date, unit = "DD") {
  const upper = unit.toUpperCase();
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (["YYYY", "YEAR", "SYYYY", "YYY", "YY", "Y", "RRRR", "RR", "IYYY"].includes(upper))
    result.setMonth(0, 1);
  else if (["MM", "MON", "MONTH", "RM"].includes(upper)) result.setDate(1);
  else if (upper === "Q") result.setMonth(Math.floor(date.getMonth() / 3) * 3, 1);
  else if (upper === "IW") result.setDate(result.getDate() - (result.getDay() + 6) % 7);
  else if (["DAY", "DY", "D"].includes(upper)) result.setDate(result.getDate() - result.getDay());
  else if (["HH", "HH24", "HH12"].includes(upper)) {
    result.setHours(date.getHours());
    return isoDate(result);
  } else if (upper === "MI") {
    result.setHours(date.getHours(), date.getMinutes());
    return isoDate(result);
  }
  return isoDate(result, false);
}
var oracleFunctions = /* @__PURE__ */ new Map();
function registerOracleFunction(name, params, impl) {
  const key = name.toLowerCase();
  oracleFunctions.set(key, { sqlName: key.replaceAll(".", "__"), params, impl });
}
var MASK = /\u0000(\d+)\u0000/gu;
function maskLiterals(sql) {
  const literals = [];
  const text5 = sql.replace(/'(?:[^']|'')*'/gu, (literal2) => {
    literals.push(literal2);
    return `\0${literals.length - 1}\0`;
  });
  return { text: text5, literals };
}
var unmask = (text5, literals) => text5.replace(MASK, (_match, index) => literals[Number(index)]);
function closingParen(text5, open) {
  let depth = 0;
  for (let index = open; index < text5.length; index += 1) {
    if (text5[index] === "(") depth += 1;
    else if (text5[index] === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}
function topLevelCommas(text5) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of text5) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  if (current.trim() || parts.length) parts.push(current);
  return parts;
}
function rewritePackageCalls(text5) {
  const pattern = /\b(?:sys\s*\.\s*)?([A-Za-z_][\w$#]*)\s*\.\s*([A-Za-z_][\w$#]*)\s*\(/gu;
  let out = "";
  let last = 0;
  for (let match = pattern.exec(text5); match; match = pattern.exec(text5)) {
    const fn = oracleFunctions.get(`${match[1].toLowerCase()}.${match[2].toLowerCase()}`);
    if (!fn) continue;
    const open = match.index + match[0].length - 1;
    const close = closingParen(text5, open);
    if (close < 0) continue;
    const args = topLevelCommas(rewritePackageCalls(text5.slice(open + 1, close)));
    const positional = [];
    for (const arg of args) {
      const named = /^\s*([A-Za-z_][\w$#]*)\s*=>\s*([\s\S]*)$/u.exec(arg);
      if (!named) positional.push(arg.trim());
      else {
        const index = fn.params.indexOf(named[1].toLowerCase());
        if (index >= 0) positional[index] = named[2].trim();
      }
    }
    out += `${text5.slice(last, match.index)}${fn.sqlName}(${Array.from(positional, (arg) => arg ?? "null").join(", ")})`;
    last = close + 1;
    pattern.lastIndex = close + 1;
  }
  return out + text5.slice(last);
}
var TABLE_FUNCTIONS = {
  "apex_util.get_timeframe_lov_data": [
    ["Last 15 Minutes", 900],
    ["Last Hour", 3600],
    ["Last 2 Hours", 7200],
    ["Last 4 Hours", 14400],
    ["Last 8 Hours", 28800],
    ["Last 16 Hours", 57600],
    ["Last Day", 86400],
    ["Last 2 Days", 172800],
    ["Last 3 Days", 259200],
    ["Last 4 Days", 345600],
    ["Last 5 Days", 432e3],
    ["Last Week", 604800],
    ["Last 2 Weeks", 1209600],
    ["Last 4 Weeks", 2419200]
  ].map(([disp, val], index) => `select '${disp}' as disp, ${val} as val, ${index + 1} as insert_order`).join(" union all ")
};
function rewriteTableCollections(text5) {
  const pattern = /\btable\s*\(/giu;
  let out = "";
  let last = 0;
  for (let match = pattern.exec(text5); match; match = pattern.exec(text5)) {
    const open = match.index + match[0].length - 1;
    const close = closingParen(text5, open);
    if (close < 0) continue;
    const inner = text5.slice(open + 1, close).trim();
    const builtin = TABLE_FUNCTIONS[inner.toLowerCase().replace(/^sys\./u, "")];
    out += builtin ? `${text5.slice(last, match.index)}(${builtin})` : `${text5.slice(last, match.index)}(select value as column_value from json_each(${inner}))`;
    last = close + 1;
    pattern.lastIndex = close + 1;
  }
  return out + text5.slice(last);
}
function rewriteRownum(text5) {
  if (!/\brownum\b/iu.test(text5)) return text5;
  const predicate2 = /\b(where|and)\s+rownum\s*(<=|<|=)\s*(\d+|:\w+)\s*(and\b)?/giu;
  for (const match of [...text5.matchAll(predicate2)].reverse()) {
    let depth = 0;
    let scopeEnd = text5.length;
    for (let index = match.index + match[0].length; index < text5.length; index += 1) {
      if (text5[index] === "(") depth += 1;
      else if (text5[index] === ")") {
        if (depth === 0) {
          scopeEnd = index;
          break;
        }
        depth -= 1;
      }
    }
    const tail = text5.slice(match.index + match[0].length, scopeEnd);
    if (/\blimit\b/iu.test(tail)) continue;
    const [, keyword, op, bound, trailingAnd] = match;
    const limit = op === "<" ? /^\d+$/u.test(bound) ? String(Number(bound) - 1) : `${bound} - 1` : op === "=" ? "1" : bound;
    const replacement = keyword.toLowerCase() === "where" ? trailingAnd ? "where " : "" : trailingAnd ? "and " : "";
    text5 = `${text5.slice(0, match.index)}${`${replacement}${tail.trimStart()}`.trimEnd()} limit ${limit}${text5.slice(scopeEnd)}`;
  }
  return text5.replace(/\brownum\b/giu, "row_number() over ()");
}
function rewriteConnectBy(text5) {
  const pattern = /(\bfrom\s+[\w$#.]+(?:\s+(?!connect\b)[\w$#]+)?\s+)?\bconnect\s+by\s+(?:level|rownum)\s*(<=|<)\s*/giu;
  for (let match = pattern.exec(text5); match; match = pattern.exec(text5)) {
    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < text5.length; end += 1) {
      const char = text5[end];
      if (char === "(") depth += 1;
      else if (char === ")") {
        if (depth === 0) break;
        depth -= 1;
      } else if (depth === 0 && /^\s(?:order|union|group|minus|intersect)\b/iu.test(text5.slice(end, end + 12)))
        break;
    }
    const bound = text5.slice(match.index + match[0].length, end).trim();
    const generator = `(with recursive apex_local_levels(level) as (select 1 union all select level + 1 from apex_local_levels where level < (${bound})${match[2] === "<" ? " - 1" : ""}) select level from apex_local_levels)`;
    const replacement = match[1] ? `${match[1].trimEnd()}, ${generator} ` : `from ${generator} `;
    text5 = text5.slice(0, match.index) + replacement + text5.slice(end);
    pattern.lastIndex = match.index + replacement.length;
  }
  return text5;
}
function translateOracleSql(sql) {
  const trimmed = sql.trim().replace(/;\s*\/?\s*$/u, "").replace(/\n\/\s*$/u, "");
  const masked = maskLiterals(trimmed);
  let text5 = masked.text.replace(/\bfrom\s+dual\b/giu, "").replace(
    /\bsys(?:date|timestamp)\s*([+-])\s*(\d+(?:\.\d+)?)\b(?!\s*[/*])/giu,
    (_whole, sign, days) => `datetime('now','localtime','${sign}${days} days')`
  ).replace(
    /\bsys(?:date|timestamp)\b|\bcurrent_(?:date|timestamp)\b|\blocaltimestamp\b/giu,
    "datetime('now','localtime')"
  ).replace(
    /\boffset\s+(\d+|:\w+)\s+rows?\s+fetch\s+(?:first|next)\s+(\d+|:\w+)\s+rows?\s+(?:only|with\s+ties)\b/giu,
    "limit $2 offset $1"
  ).replace(/\bfetch\s+(?:first|next)\s+(\d+|:\w+)\s+rows?\s+(?:only|with\s+ties)\b/giu, "limit $1").replace(
    /\blistagg\s*\(\s*(distinct\s+)?([^(),]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^(),]*)*)\s*(?:,\s*([^(),]+?))?\s*(?:on\s+overflow\s+\w+(?:\s+\S+)?(?:\s+(?:with|without)\s+count)?)?\s*\)\s*within\s+group\s*\(\s*(order\s+by\s+[^()]*(?:\([^()]*\)[^()]*)*)\)/giu,
    (_whole, distinct, value, separator2, order) => distinct ? `group_concat(distinct ${value})` : `group_concat(${value}, ${separator2 ?? "''"} ${order})`
  ).replace(/\bextract\s*\(\s*(year|month|day|hour|minute|second)\s+from\s+/giu, "apex_local_extract('$1', ").replace(
    /\bcast\s*\(([^()]*(?:\([^()]*\)[^()]*)*?)\s+as\s+(?:date|timestamp(?:\s*\(\s*\d\s*\))?(?:\s+with(?:\s+local)?\s+time\s+zone)?)\s*\)/giu,
    "($1)"
  ).replace(/\s+at\s+(?:local\b|time\s+zone\s+(?:\u0000\d+\u0000|[\w$#.:+-]+))/giu, "").replace(
    /\b(?:[A-Za-z_][\w$#]*\.)?([A-Za-z_][\w$#]*)\.(nextval|currval)\b/giu,
    (_whole, name, kind) => `apex_local_${kind.toLowerCase()}('${name.toUpperCase()}')`
  ).replace(/\bgenerated\s+(?:always|by\s+default(?:\s+on\s+null)?)\s+as\s+identity(?:\s*\([^)]*\))?/giu, "").replace(/\bvarchar2\s*\((\d+)\s*(?:char|byte)\)/giu, "varchar2($1)").replace(/\busing\s+index\b(?:\s+\w+)?/giu, "").replace(/\benable\b|\bnovalidate\b/giu, "");
  text5 = rewriteRownum(rewriteConnectBy(rewriteTableCollections(rewritePackageCalls(text5))));
  return unmask(text5, masked.literals);
}
function translateMerge(sql) {
  const masked = maskLiterals(translateOracleSql(sql));
  const text5 = masked.text;
  const head = /^\s*merge\s+into\s+([\w$#."]+)(?:\s+(?:as\s+)?(?!using\b)([\w$#]+))?\s+using\s+/iu.exec(text5);
  if (!head) return void 0;
  const table = head[1];
  const alias = head[2] ?? table;
  let position2 = head[0].length;
  let source;
  if (text5[position2] === "(") {
    const close2 = closingParen(text5, position2);
    if (close2 < 0) return void 0;
    source = text5.slice(position2 + 1, close2);
    position2 = close2 + 1;
  } else {
    const name = /^[\w$#."]+/u.exec(text5.slice(position2))[0];
    source = name.toLowerCase() === "dual" ? "select 1 as dummy" : `select * from ${name}`;
    position2 += name.length;
  }
  const sourceAlias = /^\s*(?:as\s+)?(?!on\b)([\w$#]+)/iu.exec(text5.slice(position2));
  const sAlias = sourceAlias ? sourceAlias[1] : "apex_local_src";
  if (sourceAlias) position2 += sourceAlias[0].length;
  const on = /^\s*on\s*\(/iu.exec(text5.slice(position2));
  if (!on) return void 0;
  const open = position2 + on[0].length - 1;
  const close = closingParen(text5, open);
  const condition = text5.slice(open + 1, close);
  const rest = text5.slice(close + 1);
  const from = `from (${source}) as ${sAlias}`;
  const statements = [];
  const matched = /\bwhen\s+matched\s+then\s+update\s+set\s+([\s\S]*?)(?=\bwhen\s+not\s+matched\b|$)/iu.exec(
    rest
  );
  if (matched) {
    const [assignments, where2] = matched[1].split(/\bwhere\b/iu);
    const sets = topLevelCommas(assignments.replace(/\bdelete\s+where[\s\S]*$/iu, "")).map((assignment) => {
      const [column, ...value] = assignment.split("=");
      const name = column.trim().replace(/^[\w$#]+\./u, "");
      return `${name} = (select ${value.join("=").trim()} ${from} where ${condition})`;
    });
    statements.push(
      `update ${table} as ${alias} set ${sets.join(", ")} where exists (select 1 ${from} where ${condition}${where2 ? ` and (${where2})` : ""})`
    );
  }
  const insert = /\bwhen\s+not\s+matched\s+then\s+insert\s*(\([^)]*\))?\s*values\s*\(([\s\S]*)\)\s*(?:where\s+([\s\S]*))?$/iu.exec(
    rest.replace(/\bwhen\s+matched\s+then\s+update[\s\S]*?(?=\bwhen\s+not\s+matched\b)/iu, "")
  );
  if (insert) {
    statements.push(
      `insert into ${table} ${insert[1] ?? ""} select ${insert[2]} ${from} where not exists (select 1 from ${table} as ${alias} where ${condition})${insert[3] ? ` and (${insert[3]})` : ""}`
    );
  }
  return statements.length ? statements.map((statement) => unmask(statement, masked.literals)) : void 0;
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
  #functions = /* @__PURE__ */ new Set();
  #sequences = /* @__PURE__ */ new Map();
  #dirtySequences = /* @__PURE__ */ new Set();
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
    fn("to_date", (value, mask) => {
      const date = parseOracleDate(value, typeof mask === "string" ? mask : void 0);
      return date ? isoDate(date) : null;
    });
    fn("to_timestamp", (value, mask) => {
      const date = parseOracleDate(value, typeof mask === "string" ? mask : void 0);
      return date ? isoDate(date) : null;
    });
    fn("trunc", (value, unit) => {
      if (typeof value === "number")
        return Math.trunc(value * 10 ** Number(unit ?? 0)) / 10 ** Number(unit ?? 0);
      if (typeof value === "string" && /^\s*-?\d+(\.\d+)?\s*$/u.test(value)) return Math.trunc(Number(value));
      const date = oracleDate(value);
      return date ? truncDate(date, typeof unit === "string" ? unit : "DD") : value ?? null;
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
    fn("regexp_replace", (value, pattern, replacement, position2, occurrence, flags) => {
      if (value === null) return null;
      const text5 = String(value);
      const offset = Number(position2 ?? 1) - 1;
      const nth = Number(occurrence ?? 0);
      const regex = new RegExp(String(pattern), `g${String(flags ?? "").includes("i") ? "i" : ""}u`);
      const replace = String(replacement ?? "").replace(/\\(\d)/gu, "$$$1");
      let count = 0;
      return text5.slice(0, offset) + text5.slice(offset).replace(regex, (...match) => {
        count += 1;
        if (nth && count !== nth) return match[0];
        return match[0].replace(
          new RegExp(String(pattern), `${String(flags ?? "").includes("i") ? "i" : ""}u`),
          replace
        );
      });
    });
    fn("v", (name) => this.#binds[String(name).toUpperCase()] ?? null);
    fn("nv", (name) => {
      const value = this.#binds[String(name).toUpperCase()];
      return value === null || value === void 0 || value === "" ? null : Number(value);
    });
    fn("sys_context", (namespace, parameter) => {
      const key = String(parameter ?? "").toUpperCase();
      if (String(namespace).toUpperCase() === "APEX$SESSION")
        return this.#binds[key === "APP_SESSION" ? "APP_SESSION" : key] ?? null;
      if (key === "SESSION_USER" || key === "CURRENT_USER" || key === "CURRENT_SCHEMA") return "APEX_LOCAL";
      if (key === "LANG" || key === "LANGUAGE") return "US";
      return null;
    });
    fn("instr", (value, search, start, occurrence) => {
      if (value === null || search === null) return null;
      const text5 = String(value);
      const needle = String(search);
      let from = Number(start ?? 1);
      let count = Number(occurrence ?? 1);
      if (from > 0) {
        let index2 = from - 2;
        while (count > 0) {
          index2 = text5.indexOf(needle, index2 + 1);
          if (index2 < 0) return 0;
          count -= 1;
        }
        return index2 + 1;
      }
      let index = text5.length + from + 1;
      while (count > 0) {
        index = text5.lastIndexOf(needle, index - 1);
        if (index < 0) return 0;
        count -= 1;
      }
      from = index + 1;
      return from;
    });
    fn("chr", (code) => code === null ? null : String.fromCharCode(Number(code)));
    fn("ascii", (value) => value === null || value === "" ? null : String(value).charCodeAt(0));
    fn("bitand", (left, right) => left === null || right === null ? null : Number(left) & Number(right));
    fn("translate", (value, from, to) => {
      if (value === null || from === null) return null;
      const source = String(from);
      const target2 = String(to ?? "");
      return [...String(value)].map((char) => {
        const index = source.indexOf(char);
        return index < 0 ? char : target2[index] ?? "";
      }).join("");
    });
    fn("regexp_substr", (value, pattern, position2, occurrence, flags, group2) => {
      if (value === null || pattern === null) return null;
      const regex = new RegExp(String(pattern), `g${String(flags ?? "").includes("i") ? "i" : ""}u`);
      const matches3 = [
        ...String(value).slice(Number(position2 ?? 1) - 1).matchAll(regex)
      ];
      const match = matches3[Number(occurrence ?? 1) - 1];
      return match ? match[Number(group2 ?? 0)] ?? null : null;
    });
    fn("regexp_instr", (value, pattern, position2, occurrence) => {
      if (value === null || pattern === null) return null;
      const offset = Number(position2 ?? 1) - 1;
      const matches3 = [
        ...String(value).slice(offset).matchAll(new RegExp(String(pattern), "gu"))
      ];
      const match = matches3[Number(occurrence ?? 1) - 1];
      return match ? match.index + offset + 1 : 0;
    });
    fn(
      "regexp_count",
      (value, pattern, position2, flags) => value === null || pattern === null ? null : [
        ...String(value).slice(Number(position2 ?? 1) - 1).matchAll(new RegExp(String(pattern), `g${String(flags ?? "").includes("i") ? "i" : ""}u`))
      ].length
    );
    fn("last_day", (value) => {
      const date = oracleDate(value);
      return date ? isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0), false) : null;
    });
    fn("next_day", (value, day) => {
      const date = oracleDate(value);
      if (!date) return null;
      const target2 = DAY_NAMES.findIndex(
        (name) => name.slice(0, 3).toUpperCase() === String(day).slice(0, 3).toUpperCase()
      );
      const result = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      while (target2 >= 0 && result.getDay() !== target2) result.setDate(result.getDate() + 1);
      return isoDate(result, false);
    });
    fn("to_clob", (value) => value ?? null);
    fn("from_tz", (value) => value ?? null);
    fn("to_nchar", (value) => value === null || value === void 0 ? null : String(value));
    fn("empty_clob", () => null);
    fn("apex_local_num", (value) => {
      if (typeof value !== "string") return value ?? null;
      const trimmed = value.trim();
      return trimmed !== "" && Number.isFinite(Number(trimmed)) ? Number(trimmed) : value;
    });
    fn("apex_local_extract", (unit, value) => {
      const date = oracleDate(value);
      if (!date) return null;
      switch (String(unit).toLowerCase()) {
        case "year":
          return date.getFullYear();
        case "month":
          return date.getMonth() + 1;
        case "day":
          return date.getDate();
        case "hour":
          return date.getHours();
        case "minute":
          return date.getMinutes();
        default:
          return date.getSeconds();
      }
    });
    fn("apex_local_nextval", (name) => this.#nextval(String(name)));
    fn("apex_local_currval", (name) => this.#sequences.get(String(name))?.value ?? null);
    fn("sys_guid", () => crypto2.randomUUID().replaceAll("-", "").toUpperCase());
  }
  /** Package functions registered after this database was opened. */
  #syncFunctions() {
    if (this.#functions.size === oracleFunctions.size) return;
    for (const [name, fn] of oracleFunctions) {
      if (this.#functions.has(name)) continue;
      this.#functions.add(name);
      this.db.function(
        fn.sqlName,
        { varargs: true, deterministic: false },
        (...args) => fn.impl(
          args.map(
            (arg) => typeof arg === "bigint" ? Number(arg) : arg instanceof Uint8Array ? null : arg ?? null
          )
        )
      );
    }
  }
  #loadSequences() {
    this.db.exec(
      "create table if not exists apex_local_sequences (name text primary key, value integer, increment integer, start integer)"
    );
    for (const row of this.db.prepare("select name, value, increment, start from apex_local_sequences").all())
      if (!this.#dirtySequences.has(row.name))
        this.#sequences.set(row.name, { value: row.value, increment: row.increment, start: row.start });
  }
  #nextval(name) {
    const sequence3 = this.#sequences.get(name) ?? { value: null, increment: 1, start: 1 };
    sequence3.value = sequence3.value === null ? sequence3.start : sequence3.value + sequence3.increment;
    this.#sequences.set(name, sequence3);
    this.#dirtySequences.add(name);
    return sequence3.value;
  }
  #flushSequences() {
    if (!this.#dirtySequences.size) return;
    const upsert = this.db.prepare(
      "insert into apex_local_sequences (name, value, increment, start) values (?, ?, ?, ?) on conflict(name) do update set value = excluded.value"
    );
    for (const name of this.#dirtySequences) {
      const sequence3 = this.#sequences.get(name);
      upsert.run(name, sequence3.value, sequence3.increment, sequence3.start);
    }
    this.#dirtySequences.clear();
  }
  /** `create sequence` / `drop sequence` DDL, kept in a bookkeeping table. */
  #sequenceDdl(sql) {
    const create = /^\s*create\s+(?:or\s+replace\s+)?sequence\s+(?:[\w$#"]+\.)?"?([\w$#]+)"?([\s\S]*)$/iu.exec(sql);
    const drop = /^\s*drop\s+sequence\s+(?:[\w$#"]+\.)?"?([\w$#]+)"?/iu.exec(sql);
    if (!create && !drop) return false;
    this.#loadSequences();
    const name = (create ?? drop)[1].toUpperCase();
    if (drop) {
      this.#sequences.delete(name);
      this.db.prepare("delete from apex_local_sequences where name = ?").run(name);
      return true;
    }
    const options2 = create[2] ?? "";
    const start = Number(/\bstart\s+with\s+(-?\d+)/iu.exec(options2)?.[1] ?? 1);
    const increment = Number(/\bincrement\s+by\s+(-?\d+)/iu.exec(options2)?.[1] ?? 1);
    this.#sequences.set(name, { value: null, increment, start });
    this.#dirtySequences.add(name);
    this.#flushSequences();
    return true;
  }
  #prepare(sql, binds) {
    this.#binds = Object.fromEntries(Object.entries(binds).map(([key, value]) => [key.toUpperCase(), value]));
    this.#syncFunctions();
    const translated = translateOracleSql(sql);
    if (/\bapex_local_(?:nextval|currval)\(/u.test(translated)) this.#loadSequences();
    const values = {};
    for (const name of bindNames(translated)) {
      const value = this.#binds[name.toUpperCase()] ?? null;
      values[name] = typeof value === "number" && Number.isSafeInteger(value) ? BigInt(value) : value;
    }
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
    this.#flushSequences();
    return { columns, rows };
  }
  execute(sql, binds = {}) {
    if (this.#sequenceDdl(sql)) return { changes: 0, lastInsertRowid: 0 };
    if (/^\s*merge\s+into\b/iu.test(sql)) {
      const statements = translateMerge(sql);
      if (!statements) throw new Error("MERGE statement form is not supported locally");
      let changes = 0;
      let lastInsertRowid = 0;
      for (const statement2 of statements) {
        const result2 = this.execute(statement2, binds);
        changes += result2.changes;
        lastInsertRowid = result2.lastInsertRowid || lastInsertRowid;
      }
      return { changes, lastInsertRowid };
    }
    const { statement, values } = this.#prepare(sql, binds);
    const result = statement.run(values);
    this.#flushSequences();
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

// packages/core/src/preview/extensions.ts
var extensions = [];
function registerExtension(extension) {
  const existing = extensions.findIndex((entry) => entry.name === extension.name);
  if (existing >= 0) extensions.splice(existing, 1, extension);
  else extensions.push(extension);
}
function lookup(key, type) {
  for (let index = extensions.length - 1; index >= 0; index -= 1) {
    const table = extensions[index][key];
    if (table && Object.hasOwn(table, type)) return table[type];
  }
  return void 0;
}
var regionRenderer = (type) => lookup("regions", type);
var itemRenderer = (type) => lookup("items", type);
var columnRenderer = (type) => lookup("columns", type) ?? (type.includes("/") ? lookup("columns", type.split("/")[0]) : void 0);
var processHandler = (type) => lookup("processes", type);
var conditionHandler = (type) => lookup("conditions", type);
var validationHandler = (type) => lookup("validations", type);
var routeHandler = (name) => lookup("routes", name);
function runCodeExtensions(renderer, ctx, code, owner2) {
  for (let index = extensions.length - 1; index >= 0; index -= 1) {
    const result = extensions[index].code?.(renderer, ctx, code, owner2);
    if (result !== void 0) return result;
  }
  return void 0;
}
function evaluateExpression(renderer, ctx, expression, language) {
  for (let index = extensions.length - 1; index >= 0; index -= 1) {
    const result = extensions[index].expression?.(renderer, ctx, expression, language);
    if (result !== void 0) return result;
  }
  return void 0;
}
function runPointExtensions(renderer, ctx, point) {
  const errors = [];
  for (const extension of extensions) errors.push(...extension.point?.(renderer, ctx, point) ?? []);
  return errors;
}
function filterRegionSql(renderer, ctx, region, sql) {
  let result = sql;
  for (const extension of extensions) result = extension.regionSql?.(renderer, ctx, region, result) ?? result;
  return result;
}
var extensionClient = () => extensions.filter((entry) => entry.client).map((entry) => `
/* ${entry.name} */
${entry.client}`).join("\n");
var extensionCss = () => extensions.filter((entry) => entry.css).map((entry) => `
/* ${entry.name} */
${entry.css}`).join("\n");

// packages/core/src/preview/render.ts
import fs6 from "node:fs";
import path6 from "node:path";

// packages/core/src/preview/extensions/app.ts
var strings = (values) => values.map((value) => typeof value === "string" ? value : String(value));
var item = (ctx, condition) => ctx.session.items[str(condition, "item").toUpperCase()] ?? "";
var pages = (condition) => [...strings(list(condition, "pages")), ...str(condition, "value").split(","), str(condition, "page")].map((page) => page.trim()).filter(Boolean);
var colonList = (condition) => {
  const values = strings(list(condition, "list"));
  return values.length ? values : str(condition, "value").split(":");
};
var conditions = {
  "request=Value": (_renderer, ctx, condition) => ctx.request === str(condition, "value"),
  "request!=Value": (_renderer, ctx, condition) => ctx.request !== str(condition, "value"),
  "currentPage!=page": (_renderer, ctx, condition) => !pages(condition).includes(ctx.pageId),
  currentPageInList: (_renderer, ctx, condition) => pages(condition).includes(ctx.pageId),
  currentPageNotInList: (_renderer, ctx, condition) => !pages(condition).includes(ctx.pageId),
  itemIsInColonDelimitedList: (_renderer, ctx, condition) => colonList(condition).includes(item(ctx, condition)),
  itemIsNotInColonDelimitedList: (_renderer, ctx, condition) => !colonList(condition).includes(item(ctx, condition)),
  textIsContainedInItem: (_renderer, ctx, condition) => item(ctx, condition).includes(str(condition, "text")),
  textIsContainedInValue: (_renderer, _ctx, condition) => str(condition, "value").split(",").includes(str(condition, "text")),
  textIsNotContainedInValue: (_renderer, _ctx, condition) => !str(condition, "value").split(",").includes(str(condition, "text")),
  "text=value": (_renderer, _ctx, condition) => str(condition, "text") === str(condition, "value"),
  "text!=value": (_renderer, _ctx, condition) => str(condition, "text") !== str(condition, "value"),
  "userPreference=value": () => false,
  "userPreference!=value": () => true,
  isReadOnly: () => false,
  isNotReadOnly: () => true,
  userIsNotThePublicUser: () => true,
  pageIsInPrinterFriendlyMode: () => false,
  pageIsNotInPrinterFriendlyMode: () => true
};
registerExtension({ name: "app", conditions });

// packages/core/src/preview/extensions/components/directives.ts
var FALSE_VALUES = /* @__PURE__ */ new Set(["FALSE", "F", "f", "N", "n", "0", "false"]);
var TOKEN_RE = /#([_$A-Z0-9]+)(?:!([A-Z]+))?#|\{([iIcClLeEoOwWaA{!](?:[^/\r\n]|\/(?!\}))*)\/\}/gu;
var DIRECTIVE_RE = /^(!|\w+(?:\s+|$))([\s\S]*)?$/u;
var ARGUMENT_RE = /(?:^|\n)[ \t]*([_$A-Z0-9]+)[ \t]*:=/gu;
var LOOP_VARIABLE_RE = /&(APEX\$I(?:TEM)?)(?:!([A-Z]+))?\./gu;
var LOOP_ARG_RE = /^"([^"]+)"\s+(.+)$/u;
var registry = /* @__PURE__ */ new Map();
function registerNamedTemplates(templates) {
  registry = templates;
}
var namedTemplate = (name) => registry.get(name);
function escapeValue(value, mode) {
  switch ((mode ?? "HTML").toUpperCase()) {
    case "RAW":
      return value;
    case "ATTR":
    case "HTML":
      return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
    case "STRIPHTML":
      return escapeValue(value.replace(/<[^>]*>/gu, "").replaceAll("&nbsp;", ""), "HTML");
    case "JS":
      return JSON.stringify(value).slice(1, -1).replaceAll("<", "\\u003c").replaceAll("'", "\\u0027");
    case "URL":
      return encodeURIComponent(value);
    default:
      return escapeValue(value, "HTML");
  }
}
function tokenize(template) {
  const tokens = [];
  let last = 0;
  const push = (token) => {
    const previous = tokens.at(-1);
    if (token.type === "text" && previous?.type === "text") previous.text += token.text;
    else tokens.push(token);
  };
  for (const match of template.matchAll(TOKEN_RE)) {
    if (match.index > last) push({ type: "text", text: template.slice(last, match.index) });
    last = match.index + match[0].length;
    if (match[0] === "{{/}") push({ type: "text", text: "{" });
    else if (match[1]) push({ type: "ph", text: match[0], name: match[1], filter: match[2] });
    else {
      const directive = DIRECTIVE_RE.exec(match[3]);
      if (directive)
        push({
          type: "directive",
          text: match[0],
          name: directive[1].trim().toLowerCase(),
          arg: (directive[2] ?? "").trim()
        });
      else push({ type: "text", text: match[0] });
    }
  }
  if (template.length > last) push({ type: "text", text: template.slice(last) });
  return tokens;
}
var IF_MATCH = { else: 1, elseif: 1, elsif: 1, endif: 1 };
var Engine = class _Engine {
  #tokens;
  #options;
  #scope;
  #output = "";
  #lastDirective = false;
  #ifStack = [];
  #caseStack = [];
  #loopDepth = 0;
  constructor(template, options2, scope) {
    this.#tokens = tokenize(template);
    this.#options = options2;
    this.#scope = scope;
  }
  run() {
    for (let index = 0; index < this.#tokens.length; ) index = this.#process(index);
    if (this.#ifStack.length) this.#warn("'if' without 'endif'");
    if (this.#caseStack.length) this.#warn("'case' without 'endcase'");
    return this.#output;
  }
  #warn(message) {
    this.#options.warn?.(`Template directive: ${message}`);
  }
  #lookup(name) {
    for (let index = this.#scope.loop.length - 1; index >= 0; index -= 1) {
      const local = this.#scope.loop[index];
      if (Object.hasOwn(local, name)) return local[name];
    }
    if (this.#scope.args && Object.hasOwn(this.#scope.args, name)) return this.#scope.args[name];
    return Object.hasOwn(this.#scope.values, name) ? this.#scope.values[name] : void 0;
  }
  #isLoopVariable(name) {
    return this.#scope.loop.some((local) => Object.hasOwn(local, name));
  }
  /** A placeholder's output, or undefined to keep its text. */
  #placeholder(name, filter) {
    const resolve = this.#options.placeholders !== false || this.#isLoopVariable(name);
    if (!resolve) return void 0;
    const value = this.#lookup(name);
    if (value === void 0) return this.#options.removeUnknown === false ? void 0 : "";
    if (filter) return escapeValue(value, filter);
    if (this.#scope.args && Object.hasOwn(this.#scope.args, name)) {
      const escape = this.#scope.argEscapes?.[name];
      return escape ? escapeValue(value, escape) : value;
    }
    if (this.#options.defaultEscape === false || this.#options.placeholders === false) return value;
    return escapeValue(value, this.#options.escapes?.[name] ?? this.#options.defaultEscape ?? "HTML");
  }
  #text(text5) {
    if (!this.#scope.loop.length) return text5;
    return text5.replace(LOOP_VARIABLE_RE, (whole, name, filter) => {
      const value = this.#lookup(name);
      if (value === void 0) return whole;
      if (filter) return escapeValue(value, filter);
      const raw = this.#options.defaultEscape === false || this.#options.placeholders === false;
      return raw ? value : escapeValue(value, "HTML");
    });
  }
  #process(index) {
    const token = this.#tokens[index];
    const next = index + 1;
    if (token.type === "text") {
      const text5 = this.#lastDirective ? token.text.replace(/^\s+/u, " ") : token.text;
      this.#output += this.#text(text5);
      this.#lastDirective = false;
      return next;
    }
    if (token.type === "ph") {
      const value = this.#placeholder(token.name, token.filter);
      this.#output += value ?? token.text;
      this.#lastDirective = false;
      return next;
    }
    const handler = this.#directives[token.name];
    if (!handler) {
      this.#output += this.#text(token.text);
      this.#lastDirective = false;
      return next;
    }
    this.#lastDirective = true;
    return handler(next, token.arg);
  }
  /** Index of the next directive in `match` at nesting level 0 (or the end). */
  #lookAhead(index, match, open, close) {
    let level = 0;
    let position2 = index;
    for (; position2 < this.#tokens.length; position2 += 1) {
      const token = this.#tokens[position2];
      if (token.type !== "directive") continue;
      if (Object.hasOwn(match, token.name) && level === 0) break;
      if (token.name === open) level += 1;
      else if (token.name === close) level -= 1;
      if (level < 0) break;
    }
    return position2;
  }
  #value(name, assigned) {
    if (assigned && this.#scope.assigned?.has(name))
      return this.#scope.assigned.get(name).trim().length > 0 ? "Y" : "";
    return this.#lookup(name) ?? "";
  }
  #test(condition) {
    let rest = condition.trim();
    let not = false;
    if (rest.startsWith("!")) {
      not = true;
      rest = rest.slice(1).trim();
    }
    let type = rest.slice(0, 1);
    if (type === "?" || type === "=") rest = rest.slice(1).trim();
    else type = null;
    const assigned = /%assigned\s*$/iu.test(rest);
    if (assigned) {
      type = null;
      rest = rest.replace(/%assigned\s*$/iu, "");
    }
    const name = rest.replace(/^"([^"]+)"$/u, "$1").trim();
    const value = this.#value(name, assigned).trim();
    let result = type === "?" ? value !== "" : type === "=" ? !FALSE_VALUES.has(value) : value !== "" && !FALSE_VALUES.has(value);
    if (not) result = !result;
    return result;
  }
  #directives = {
    if: (index, arg) => {
      const frame = { matched: false };
      this.#ifStack.push(frame);
      if (this.#test(arg)) {
        frame.matched = true;
        return index;
      }
      return this.#lookAhead(index, IF_MATCH, "if", "endif");
    },
    elseif: (index, arg) => this.#elseif(index, arg),
    elsif: (index, arg) => this.#elseif(index, arg),
    else: (index) => {
      const frame = this.#ifStack.at(-1);
      if (!frame) {
        this.#warn("'else' without 'if'");
        return index;
      }
      if (frame.hasElse) this.#warn("'if' must have only one 'else'");
      frame.hasElse = true;
      if (!frame.matched) {
        frame.matched = true;
        return index;
      }
      return this.#lookAhead(index, { endif: 1 }, "if", "endif");
    },
    endif: (index) => {
      if (!this.#ifStack.pop()) this.#warn("'endif' without 'if'");
      return index;
    },
    case: (index, arg) => {
      let position2 = index;
      const blank = this.#tokens[position2];
      if (blank?.type === "text" && blank.text.trim() === "") position2 += 1;
      const when = this.#tokens[position2];
      if (when?.type !== "directive" || when.name !== "when") {
        this.#warn("'case' must be followed by 'when'");
        return position2;
      }
      this.#caseStack.push({
        value: this.#value(arg.replace(/^"([^"]+)"$/u, "$1"), false).trim(),
        matched: false
      });
      return position2;
    },
    when: (index, arg) => {
      const frame = this.#caseStack.at(-1);
      if (!frame) {
        this.#warn("'when' without 'case'");
        return index;
      }
      if (frame.hasOtherwise) this.#warn("'when' must come before 'otherwise'");
      if (frame.matched) return this.#lookAhead(index, { endcase: 1 }, "case", "endcase");
      if (frame.value === arg.trim()) {
        frame.matched = true;
        return index;
      }
      return this.#lookAhead(index, { when: 1, otherwise: 1, endcase: 1 }, "case", "endcase");
    },
    otherwise: (index) => {
      const frame = this.#caseStack.at(-1);
      if (!frame) {
        this.#warn("'otherwise' without 'case'");
        return index;
      }
      if (frame.hasOtherwise) this.#warn("'case' must have only one 'otherwise'");
      frame.hasOtherwise = true;
      if (frame.matched) return this.#lookAhead(index, { endcase: 1 }, "case", "endcase");
      frame.matched = true;
      return index;
    },
    endcase: (index) => {
      if (!this.#caseStack.pop()) this.#warn("'endcase' without 'case'");
      return index;
    },
    loop: (index, arg) => this.#loop(index, arg),
    endloop: (index) => {
      if (this.#loopDepth === 0) this.#warn("'endloop' without 'loop'");
      return index;
    },
    with: (index) => this.#with(index),
    apply: (index, arg) => {
      this.#warn(`'apply ${arg}' without 'with'`);
      return index;
    },
    "!": (index) => index
  };
  #elseif(index, arg) {
    const frame = this.#ifStack.at(-1);
    if (!frame) {
      this.#warn("'elseif' without 'if'");
      return index;
    }
    if (frame.hasElse) this.#warn("'elseif' must come before 'else'");
    if (!frame.matched && this.#test(arg)) {
      frame.matched = true;
      return index;
    }
    return this.#lookAhead(index, frame.matched ? { endif: 1 } : IF_MATCH, "if", "endif");
  }
  #loop(index, arg) {
    const end = this.#lookAhead(index, { endloop: 1 }, "loop", "endloop");
    const parsed2 = LOOP_ARG_RE.exec(arg);
    const separator2 = parsed2 ? parsed2[1] : ":";
    const name = (parsed2 ? parsed2[2] : arg).trim();
    const value = this.#lookup(name) ?? "";
    const items = value === "" ? [] : value.split(separator2.length > 1 ? new RegExp(separator2, "u") : separator2);
    this.#loopDepth += 1;
    items.forEach((item2, position2) => {
      this.#scope.loop.push({ APEX$ITEM: item2, APEX$I: String(position2 + 1) });
      this.#lastDirective = true;
      for (let cursor = index; cursor < end; ) cursor = this.#process(cursor);
      this.#scope.loop.pop();
    });
    this.#loopDepth -= 1;
    this.#lastDirective = true;
    return end < this.#tokens.length ? end + 1 : end;
  }
  #with(index) {
    const end = this.#lookAhead(index, { apply: 1 }, "with", "apply");
    const apply = this.#tokens[end];
    if (apply?.type !== "directive" || apply.name !== "apply") {
      this.#warn("'with' without 'apply'");
      return end;
    }
    const source = this.#tokens.slice(index, end).map((token) => token.text).join("");
    const argumentText = /* @__PURE__ */ new Map();
    const matches3 = [...source.matchAll(ARGUMENT_RE)];
    let depth = 0;
    let current;
    for (let position2 = 0; position2 < matches3.length; position2 += 1) {
      const match = matches3[position2];
      if (depth === 0) current = { name: match[1], start: match.index + match[0].length };
      const stop = matches3[position2 + 1]?.index ?? source.length;
      const piece = source.slice(match.index + match[0].length, stop);
      depth += (piece.match(/\{with/gu)?.length ?? 0) - (piece.match(/\{apply/gu)?.length ?? 0);
      if (depth <= 0 && current) {
        argumentText.set(current.name, source.slice(current.start, stop).trim());
        depth = 0;
      }
    }
    this.#output += this.#apply(apply.arg, argumentText);
    this.#lastDirective = true;
    return end + 1;
  }
  #apply(name, argumentText) {
    const definition = (this.#options.templates ?? namedTemplate)(name);
    if (!definition) {
      this.#warn(`'apply' unknown template ${name}`);
      return "";
    }
    const args = { ...this.#scope.args };
    const argEscapes = {};
    for (const formal of definition.args) {
      if (!argumentText.has(formal.name)) argumentText.set(formal.name, formal.default ?? "");
      const escape = formal.escape ?? definition.defaultEscape;
      if (escape && escape !== "RAW") argEscapes[formal.name] = escape;
    }
    for (const [argument, text5] of argumentText) {
      const escaped2 = Object.hasOwn(argEscapes, argument);
      args[argument] = /[#&{]|\/\}/u.test(text5) ? new _Engine(
        text5,
        {
          ...this.#options,
          placeholders: true,
          ...escaped2 ? { defaultEscape: false } : {}
        },
        { ...this.#scope, argEscapes: void 0, loop: [...this.#scope.loop] }
      ).run() : text5;
    }
    return new _Engine(
      definition.template,
      {
        ...this.#options,
        placeholders: true,
        escapes: {},
        defaultEscape: definition.defaultEscape ?? "HTML"
      },
      { values: this.#scope.values, args, assigned: new Map(argumentText), argEscapes, loop: [] }
    ).run();
  }
};
function applyTemplate(template, values, options2 = {}) {
  if (!/[#{&]/u.test(template)) return template;
  return new Engine(template, options2, { values, loop: [] }).run();
}
function processDirectives(template, values) {
  if (!template.includes("{")) return template;
  return applyTemplate(template, values, { placeholders: false, defaultEscape: false });
}

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
    const target2 = KIND_TO_MAP[call.kind];
    if (target2 && typeof params.static_id === "string")
      index[target2].set(params.static_id.toLowerCase(), params);
    if (typeof params.id === "string" && target2) index.byId.set(params.id, params);
    if (call.kind === "page_tmpl_display_point" || call.kind === "plug_tmpl_display_point") {
      const owner2 = String(params.page_template_id ?? params.plug_template_id ?? "");
      const slots = index.slots.get(owner2) ?? /* @__PURE__ */ new Map();
      if (typeof params.apexlang_name === "string" && typeof params.placeholder === "string") {
        slots.set(params.apexlang_name, params.placeholder);
      }
      index.slots.set(owner2, slots);
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
  return processDirectives(template, values);
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
function templateOptions(options2, defaults) {
  const classes2 = [];
  for (const option of options2.length ? options2 : ["#DEFAULT#"]) {
    if (option === "#DEFAULT#") classes2.push(...defaults.split(/[:\s]+/u).filter(Boolean));
    else classes2.push(...option.split(/\s+/u).filter(Boolean));
  }
  return [...new Set(classes2)].join(" ");
}

// packages/core/src/preview/extensions/charts/calendar.ts
import fs4 from "node:fs";
import path4 from "node:path";

// packages/core/src/preview/extensions/charts/format.ts
var SCALES = [
  ["quadrillion", 1e15, "P"],
  ["trillion", 1e12, "T"],
  ["billion", 1e9, "B"],
  ["million", 1e6, "M"],
  ["thousand", 1e3, "K"]
];
var DATE_STYLES = {
  dateShort: { dateStyle: "short" },
  dateMedium: { dateStyle: "medium" },
  dateLong: { dateStyle: "long" },
  dateFull: { dateStyle: "full" },
  timeShort: { timeStyle: "short" },
  timeMedium: { timeStyle: "medium" },
  timeLong: { timeStyle: "medium" },
  timeFull: { timeStyle: "medium" },
  datetimeShort: { dateStyle: "short", timeStyle: "short" },
  datetimeMedium: { dateStyle: "medium", timeStyle: "short" },
  datetimeLong: { dateStyle: "long", timeStyle: "short" },
  datetimeFull: { dateStyle: "full", timeStyle: "short" }
};
var isDateFormat = (format2) => !!format2 && format2 in DATE_STYLES;
function parseDate(value) {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return void 0;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/u.exec(value.trim());
  if (!match) return void 0;
  const [, y, m, d, hh = "0", mm = "0", ss = "0"] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  return Number.isNaN(date.getTime()) ? void 0 : date;
}
function formatDate2(value, format2 = "dateShort") {
  const date = parseDate(value);
  if (!date) return String(value ?? "");
  return new Intl.DateTimeFormat("en-US", DATE_STYLES[format2] ?? DATE_STYLES.dateShort).format(date);
}
function formatValue(value, spec = {}) {
  if (value === null || value === void 0 || Number.isNaN(value)) return "";
  const { format: format2, currency } = spec;
  let scaled = value;
  let suffix = "";
  const scaling = spec.scaling ?? "none";
  if (scaling !== "none") {
    const entry = scaling === "auto" ? SCALES.find(([, factor]) => Math.abs(value) >= factor) : SCALES.find(([name]) => name === scaling);
    if (entry) {
      scaled = value / entry[1];
      suffix = entry[2];
    }
  }
  const digits = spec.decimalPlaces ?? (suffix ? Math.abs(scaled) < 10 && scaled % 1 !== 0 ? 1 : 0 : void 0);
  const options2 = digits === void 0 ? { maximumFractionDigits: Math.abs(scaled) < 1 && scaled !== 0 ? 4 : 2 } : { minimumFractionDigits: digits, maximumFractionDigits: digits };
  if (format2 === "percent") {
    return `${new Intl.NumberFormat("en-US", { ...options2, style: "percent" }).format(scaled)}${suffix}`;
  }
  if (format2 === "currency") {
    let text5;
    try {
      text5 = new Intl.NumberFormat("en-US", {
        ...options2,
        style: "currency",
        currency: /^[A-Z]{3}$/u.test(currency ?? "") ? currency : "USD"
      }).format(scaled);
    } catch {
      text5 = `$${new Intl.NumberFormat("en-US", options2).format(scaled)}`;
    }
    return `${text5}${suffix}`;
  }
  return `${new Intl.NumberFormat("en-US", options2).format(scaled)}${suffix}`;
}
function formatTick(value, spec, step) {
  const scaling = spec.scaling ?? "auto";
  const magnitude = Math.max(Math.abs(value), Math.abs(step));
  const entry = scaling === "auto" ? SCALES.find(([, factor2]) => magnitude >= factor2) : SCALES.find(([name]) => name === scaling);
  const factor = entry?.[1] ?? 1;
  const stepDigits = Math.max(0, Math.ceil(-Math.log10(Math.abs(step / factor) || 1) + 1e-4));
  const digits = spec.decimalPlaces ?? Math.min(4, stepDigits);
  return formatValue(value, {
    ...spec,
    scaling: entry ? entry[0] : "none",
    decimalPlaces: spec.format === "percent" ? Math.max(0, digits - 2) : digits
  });
}
function niceScale(low, high, options2 = {}) {
  const zero = options2.includeZero ?? true;
  let min = options2.min ?? (zero ? Math.min(0, low) : low);
  let max = options2.max ?? (zero ? Math.max(0, high) : high);
  if (!(max > min)) {
    if (options2.max === void 0) max = min + (Math.abs(min) || 1);
    else min = max - (Math.abs(max) || 1);
  }
  const target2 = options2.ticks ?? 5;
  let step = options2.step;
  if (!step || step <= 0) {
    const raw = (max - min) / target2;
    const power = 10 ** Math.floor(Math.log10(raw));
    const fraction = raw / power;
    step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * power;
  }
  if (options2.min === void 0) min = Math.floor(min / step + 1e-9) * step;
  if (options2.max === void 0) max = Math.ceil(max / step - 1e-9) * step;
  if (max === min) max = min + step;
  return { min, max, step };
}
function ticks(scale) {
  const values = [];
  const count = Math.min(200, Math.round((scale.max - scale.min) / scale.step));
  for (let index = 0; index <= count; index += 1) {
    values.push(Number((scale.min + index * scale.step).toPrecision(12)));
  }
  return values;
}
var textWidth = (value, size = 12) => value.length * size * 0.56;
function truncate(value, maxWidth, size = 12) {
  if (textWidth(value, size) <= maxWidth) return value;
  const chars = Math.max(1, Math.floor(maxWidth / (size * 0.56)) - 1);
  return `${value.slice(0, chars)}\u2026`;
}

// packages/core/src/preview/extensions/charts/model.ts
var SUPPORTED_REGION = /* @__PURE__ */ new Set([
  "chart.type",
  "chartAppearance.orientation",
  "chartAppearance.stack",
  "chartAppearance.stackLabel",
  "chartLayout.height",
  "chartLayout.maxWidth",
  "legend.show",
  "legend.position",
  "legend.title",
  "tooltip.show",
  "tooltip.showSeriesName",
  "tooltip.showGroupName",
  "tooltip.showValue",
  "value.format",
  "value.decimalPlaces",
  "value.currency",
  "value.formatScaling",
  "value.pieChartOtherThreshold",
  "value.valueType",
  "value.show",
  "value.position",
  "gauge.orientation",
  "gauge.startAngle",
  "gauge.angleExtent",
  "gauge.innerRadius",
  "gauge.showPlotArea",
  "gauge.indicatorSize",
  "settings.timeAxisType",
  "settings.initialZooming",
  "settings.zoomAndScroll",
  "settings.pieSelectionEffect",
  "settings.renderAs",
  "title.title",
  "performance.lazyLoading",
  "animation.onDisplay",
  "animation.onDataChange",
  "dataCursor.cursor",
  "dataCursor.behavior",
  "dataCursor.dimOnHover",
  "messages.noDataFound",
  "security.escapeSpecialChars"
]);
var CHART_GROUPS = [
  "chart",
  "chartAppearance",
  "chartLayout",
  "legend",
  "tooltip",
  "value",
  "gauge",
  "settings",
  "title",
  "animation",
  "dataCursor",
  "overview",
  "multiSeriesChartData",
  "componentAdvanced",
  "autoRefresh"
];
var SUPPORTED_SERIES = /* @__PURE__ */ new Set([
  "name",
  "type",
  "execution.sequence",
  "appearance.color",
  "appearance.assignedToY2Axis",
  "appearance.stackCategory",
  "label.show",
  "label.position",
  "label.displayAs",
  "line.style",
  "line.type",
  "line.width",
  "marker.show",
  "marker.shape",
  "link.type",
  "link.target",
  "link.targetUrl",
  "performance.maxRowsToProcess",
  "referenceLines.values",
  "referenceLines.colors"
]);
var SERIES_GROUPS = [
  "appearance",
  "label",
  "line",
  "marker",
  "link",
  "referenceLines",
  "thresholds",
  "timeline"
];
var SUPPORTED_AXIS = /* @__PURE__ */ new Set([
  "name",
  "title",
  "showAxis",
  "value.min",
  "value.max",
  "value.step",
  "value.format",
  "value.decimalPlaces",
  "value.currency",
  "value.formatScaling",
  "value.baselineScaling",
  "value.scale",
  "majorTicks.show",
  "minorTicks.show",
  "tickLabel.show",
  "tickLabel.rotation",
  "appearance.position",
  "advanced.staticId"
]);
function leafPaths(props, prefix = "") {
  return Object.entries(props).flatMap(
    ([key, value]) => isObject(value) && key !== "target" ? leafPaths(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  );
}
function reportUnsupported(renderer, ctx, owner2, component, groups, supported, label) {
  const ignored = leafPaths(component.props).filter(
    (path9) => (groups.includes(path9.split(".")[0]) || !path9.includes(".")) && !supported.has(path9) && !/(^|\.)(font\w*|cssStyling)$/u.test(path9)
  );
  const own = ignored.filter((path9) => path9.includes(".") || label !== "Chart");
  if (own.length)
    renderer.diagnose(
      "info",
      `${label} ${component.id} of chart ${owner2.id}: ${own.join(", ")} not simulated by the local SVG chart`,
      ctx.pageId,
      owner2.id
    );
}
var numberOf = (value) => {
  if (value === null || value === void 0 || value === "") return null;
  const parsed2 = typeof value === "number" ? value : Number(String(value).replace(/,/gu, ""));
  return Number.isFinite(parsed2) ? parsed2 : null;
};
var optionalNumber = (value) => numberOf(value) ?? void 0;
function rowSubstitute(value, row) {
  return value.replace(/&([A-Za-z][\w$#]*)\./gu, (whole, name) => {
    const key = name.toUpperCase();
    return key in row ? String(row[key] ?? "") : whole;
  });
}
function axisModel(component, fallback) {
  const props = component?.props ?? {};
  const major = str(props, "majorTicks.show", "auto");
  return {
    title: str(props, "title"),
    show: bool(props, "showAxis", true),
    min: optionalNumber(str(props, "value.min")),
    max: optionalNumber(str(props, "value.max")),
    step: optionalNumber(str(props, "value.step")),
    format: {
      format: str(props, "value.format") || fallback.format,
      decimalPlaces: optionalNumber(str(props, "value.decimalPlaces")) ?? fallback.decimalPlaces,
      currency: str(props, "value.currency") || fallback.currency,
      scaling: str(props, "value.formatScaling") || void 0
    },
    baselineZero: str(props, "value.baselineScaling", "zero") !== "min",
    grid: major !== "false",
    tickLabels: bool(props, "tickLabel.show", true),
    rotate: bool(props, "tickLabel.rotation", true),
    position: str(props, "appearance.position", "auto"),
    log: str(props, "value.scale") === "log"
  };
}
function seriesSql(renderer, ctx, region, series) {
  const location = str(series.props, "source.location");
  if (location === "regionSource" || !isObject(series.props.source) && isObject(region.props.source))
    return renderer.regionSql(ctx, region);
  return renderer.regionSql(ctx, series);
}
function chartModel(renderer, ctx, region) {
  const props = region.props;
  const type = str(props, "chart.type", "bar");
  const value = {
    format: str(props, "value.format") || void 0,
    decimalPlaces: optionalNumber(str(props, "value.decimalPlaces")),
    currency: str(props, "value.currency") || void 0,
    scaling: str(props, "value.formatScaling") || void 0,
    otherThreshold: num(props, "value.pieChartOtherThreshold", 0),
    valueType: str(props, "value.valueType", "number")
  };
  const axes = region.children.filter((child) => child.type === "axis");
  const axis = (name) => axes.find((entry) => str(entry.props, "name", entry.id) === name);
  const timeAxisType = str(props, "settings.timeAxisType", "auto");
  const model = {
    id: region.id,
    name: str(props, "name", region.id),
    type,
    orientation: str(props, "chartAppearance.orientation") === "horizontal" ? "horizontal" : "vertical",
    stack: bool(props, "chartAppearance.stack", false),
    stackLabel: bool(props, "chartAppearance.stackLabel", false),
    height: num(props, "chartLayout.height", 0) || heightOption(props) || 400,
    maxWidth: num(props, "chartLayout.maxWidth", 0) || void 0,
    title: str(props, "title.title"),
    legend: {
      show: bool(props, "legend.show", true),
      position: str(props, "legend.position", "auto"),
      title: str(props, "legend.title")
    },
    tooltip: {
      show: bool(props, "tooltip.show", true),
      series: bool(props, "tooltip.showSeriesName", true),
      group: bool(props, "tooltip.showGroupName", true),
      value: bool(props, "tooltip.showValue", true)
    },
    value,
    gauge: {
      orientation: str(props, "gauge.orientation", "circular"),
      startAngle: num(props, "gauge.startAngle", 90),
      angleExtent: num(props, "gauge.angleExtent", 360),
      innerRadius: num(props, "gauge.innerRadius", 0.7),
      plotArea: bool(props, "gauge.showPlotArea", true),
      showValue: bool(props, "value.show", true)
    },
    timeAxis: timeAxisType === "enabled" || timeAxisType === "mixedFrequency" || timeAxisType === "skipGaps",
    groups: [],
    series: [],
    axes: {
      x: axisModel(axis("x"), {}),
      y: axisModel(axis("y"), value),
      y2: axisModel(axis("y2"), value)
    },
    errors: [],
    noDataFound: str(props, "messages.noDataFound", "No data found.")
  };
  const definitions = region.children.filter((child) => child.type === "series").sort((a, b) => num(a.props, "execution.sequence", 0) - num(b.props, "execution.sequence", 0));
  reportUnsupported(renderer, ctx, region, region, CHART_GROUPS, SUPPORTED_REGION, "Chart");
  for (const entry of axes)
    reportUnsupported(renderer, ctx, region, entry, Object.keys(entry.props), SUPPORTED_AXIS, "Axis");
  const groups = /* @__PURE__ */ new Map();
  for (const definition of definitions) {
    if (!renderer.condition(ctx, definition.props)) continue;
    reportUnsupported(renderer, ctx, region, definition, SERIES_GROUPS, SUPPORTED_SERIES, "Series");
    const sql = seriesSql(renderer, ctx, region, definition);
    if (!sql) {
      model.errors.push(`Series ${str(definition.props, "name", definition.id)} has no SQL source.`);
      continue;
    }
    const result = renderer.query(
      ctx,
      region,
      sql,
      num(definition.props, "performance.maxRowsToProcess", 0) || 1e4
    );
    if (result.error) {
      model.errors.push(result.error);
      continue;
    }
    const mapping = (key, fallback = "") => (str(definition.props, `columnMapping.${key}`) || fallback).toUpperCase();
    const labelColumn = mapping("label", result.columns[0]);
    const valueColumn = mapping(
      "value",
      result.columns.find((column) => column !== labelColumn) ?? result.columns[1] ?? ""
    );
    const seriesColumn = mapping("seriesName");
    const colorSpec = str(definition.props, "appearance.color");
    const customTooltip = mapping("customTooltip");
    const link = linkResolver(renderer, ctx, definition);
    const base = {
      type: str(definition.props, "type") || (type === "combination" ? "bar" : type === "radar" || type === "polar" ? "line" : type),
      y2: bool(definition.props, "appearance.assignedToY2Axis", false),
      stackCategory: str(definition.props, "appearance.stackCategory"),
      label: {
        show: bool(definition.props, "label.show", false),
        position: str(definition.props, "label.position", "auto"),
        displayAs: str(
          definition.props,
          "label.displayAs",
          type === "pie" || type === "donut" ? "percentage" : "value"
        )
      },
      line: {
        style: str(definition.props, "line.style", "solid"),
        type: str(definition.props, "line.type", "auto"),
        width: num(definition.props, "line.width", 0) || (type === "radar" ? 2 : 3)
      },
      marker: {
        show: str(definition.props, "marker.show", "auto"),
        shape: str(definition.props, "marker.shape", "auto")
      },
      referenceLines: referenceLines(definition)
    };
    const bySeries = /* @__PURE__ */ new Map();
    const fixedName = str(definition.props, "name", definition.id);
    for (const row of result.rows) {
      const name = seriesColumn ? String(row[seriesColumn] ?? "") : fixedName;
      let series = bySeries.get(name);
      if (!series) {
        series = { ...base, id: `${definition.id}-${bySeries.size}`, name, points: [] };
        if (colorSpec && !colorSpec.includes("&")) series.color = colorSpec;
        bySeries.set(name, series);
      }
      const group2 = labelText(row[labelColumn], model);
      groups.set(group2, true);
      series.points.push({
        group: group2,
        value: numberOf(row[valueColumn]),
        x: optionalNumber(row[mapping("x")]),
        y: optionalNumber(row[mapping("y")]),
        z: optionalNumber(row[mapping("z")]),
        low: optionalNumber(row[mapping("low")]),
        high: optionalNumber(row[mapping("high")] ?? row[mapping("close")]),
        target: optionalNumber(row[mapping("targetValue")]),
        min: optionalNumber(row[mapping("minValue")]),
        max: optionalNumber(row[mapping("maxValue")]),
        color: colorSpec.includes("&") ? rowSubstitute(colorSpec, row) || void 0 : void 0,
        link: link(row),
        tooltip: customTooltip ? String(row[customTooltip] ?? "") : void 0
      });
    }
    if (type === "stock") {
      for (const series of bySeries.values()) {
        const close = mapping("close");
        series.type = "line";
        series.points.forEach((point, index) => {
          point.value = numberOf(result.rows[index]?.[close]) ?? point.value;
        });
      }
    }
    model.series.push(...bySeries.values());
  }
  model.groups = [...groups.keys()];
  if (model.timeAxis || isDateFormat(model.axes.x.format.format)) {
    const dated = model.groups.map((group2) => [group2, parseDate(group2)]);
    if (dated.every(([, date]) => date)) {
      dated.sort((a, b) => a[1].getTime() - b[1].getTime());
      model.groups = dated.map(([group2]) => group2);
      model.timeAxis = true;
    }
  }
  return model;
}
function heightOption(props) {
  const options2 = get(props, "appearance.templateOptions");
  const values = Array.isArray(options2) ? options2.map(String) : typeof options2 === "string" ? [options2] : [];
  for (const option of values) {
    const match = /\bi-h(\d{3})\b/u.exec(option);
    if (match) return Number(match[1]) - 32;
  }
  return 0;
}
function labelText(value, model) {
  if (value === null || value === void 0) return "";
  if (typeof value === "number") return String(value);
  const text5 = String(value);
  if (model.timeAxis && /^\d{4}-\d{2}-\d{2}$/u.test(text5)) return `${text5} 00:00:00`;
  return text5;
}
function referenceLines(series) {
  const values = str(series.props, "referenceLines.values").split(/[,:]/u).map((value) => value.trim()).filter(Boolean).map(Number).filter(Number.isFinite);
  const colors = str(series.props, "referenceLines.colors").split(/[,:]/u);
  return values.map((value, index) => ({ value, color: colors[index]?.trim() || void 0 }));
}
function linkResolver(renderer, ctx, series) {
  const type = str(series.props, "link.type");
  const target2 = get(series.props, "link.target");
  const targetUrl = str(series.props, "link.targetUrl");
  if (!type && target2 === void 0 && !targetUrl) return () => void 0;
  return (row) => {
    if (type === "redirectUrlReturnedByFirstCol") {
      const first = Object.values(row)[0];
      return first === null || first === void 0 ? void 0 : String(first);
    }
    if (type === "redirectUrl" || targetUrl && target2 === void 0)
      return renderer.link(ctx, { type: "url", url: rowSubstitute(targetUrl, row) }, row);
    return target2 === void 0 ? void 0 : renderer.link(ctx, substituteDeep(target2, row), row);
  };
}
function substituteDeep(value, row) {
  if (typeof value === "string") return rowSubstitute(value, row);
  if (Array.isArray(value)) return value.map((entry) => substituteDeep(entry, row));
  if (isObject(value))
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, substituteDeep(entry, row)]));
  return value;
}

// packages/core/src/preview/extensions/charts/calendar.ts
var NEW_START = "APEXLOCALNEWSTART";
var NEW_END = "APEXLOCALNEWEND";
var SUPPORTED = /* @__PURE__ */ new Set([
  "displayColumn",
  "startDateColumn",
  "endDateColumn",
  "pkColumn",
  "cssClass",
  "viewEditLink",
  "createLink",
  "supplementalInfo",
  "additionalCalendarViews",
  "timeFormat",
  "firstHour",
  "showWeekend",
  "maxEventsDay",
  "allDayEventColumn",
  "startOfWeek",
  "firstDayOfWeek",
  "showTime"
]);
function isoOf(value) {
  const date = parseDate(typeof value === "number" ? String(value) : value);
  if (!date) return void 0;
  const pad2 = (part2) => String(part2).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const midnight = !date.getHours() && !date.getMinutes() && !date.getSeconds();
  return {
    iso: midnight ? day : `${day}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`,
    date,
    midnight
  };
}
var settingColumn = (region, key) => str(region.props, `settings.${key}`).toUpperCase();
function calendarEvents(renderer, ctx, region, range = {}) {
  const sql = renderer.regionSql(ctx, region);
  if (!sql) return { events: [], error: "The calendar has no SQL source." };
  let result = renderer.query(ctx, region, sql, 2e4);
  if (result.error) return { events: [], error: result.error };
  const required2 = ["displayColumn", "startDateColumn", "endDateColumn", "pkColumn", "cssClass"].map((key) => settingColumn(region, key)).filter((column) => column && !result.columns.includes(column));
  if (required2.length) {
    const probe = renderer.query(
      ctx,
      region,
      `select * from (${sql}) where 1 = 1 or ${required2.map((column) => `"${column}" is null`).join(" or ")}`,
      2e4
    );
    if (!probe.error) result = renderer.query(ctx, region, sql, 2e4);
  }
  const display = settingColumn(region, "displayColumn") || result.columns[0] || "";
  const startColumn = settingColumn(region, "startDateColumn");
  const endColumn = settingColumn(region, "endDateColumn");
  const allDayColumn = settingColumn(region, "allDayEventColumn");
  const cssColumn = settingColumn(region, "cssClass");
  const pkColumn = settingColumn(region, "pkColumn");
  const supplemental = str(region.props, "settings.supplementalInfo");
  const viewEdit = get(region.props, "settings.viewEditLink");
  const events = [];
  for (const row of result.rows) {
    const start = isoOf(row[startColumn]);
    if (!start) continue;
    const end = endColumn ? isoOf(row[endColumn]) : void 0;
    const allDayValue = allDayColumn ? String(row[allDayColumn] ?? "").toUpperCase() : "";
    const allDay = allDayColumn ? ["Y", "YES", "1", "TRUE"].includes(allDayValue) : start.midnight && (!end || end.midnight);
    let endIso = end?.iso;
    if (end && allDay) {
      const next = new Date(end.date);
      next.setDate(next.getDate() + 1);
      endIso = isoOf(
        `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`
      ).iso;
    }
    const stop = end?.date ?? start.date;
    if (range.start && stop < range.start) continue;
    if (range.end && start.date >= range.end) continue;
    const event = {
      title: String(row[display] ?? ""),
      start: allDay ? start.iso.slice(0, 10) : start.iso,
      allDay
    };
    if (endIso) event.end = allDay ? endIso.slice(0, 10) : endIso;
    if (pkColumn && row[pkColumn] !== void 0) event.id = String(row[pkColumn]);
    if (cssColumn && row[cssColumn]) event.className = String(row[cssColumn]);
    if (viewEdit !== void 0) event.url = renderer.link(ctx, substituteDeep(viewEdit, row), row);
    if (supplemental) event.description = rowSubstitute(supplemental, row);
    events.push(event);
  }
  return { events };
}
function initialDate(events, today = /* @__PURE__ */ new Date()) {
  if (!events.length) return isoOf(today.toISOString().slice(0, 10)).iso;
  const month = (date) => date.getFullYear() * 12 + date.getMonth();
  const dates = events.map((event) => parseDate(event.start.replace("T", " "))).filter(Boolean);
  if (dates.some((date) => month(date) === month(today))) return isoOf(today.toISOString().slice(0, 10)).iso;
  const upcoming = dates.filter((date) => date >= today).sort((a, b) => a.getTime() - b.getTime())[0];
  const latest = dates.sort((a, b) => b.getTime() - a.getTime())[0];
  return isoOf(upcoming ?? latest).iso.slice(0, 10);
}
function fullCalendarScript(renderer) {
  const root = path4.join(renderer.assets.imagesDir, "libraries", "fullcalendar");
  try {
    const versions = fs4.readdirSync(root).filter((entry) => fs4.existsSync(path4.join(root, entry, "dist", "index.global.min.js"))).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    const version = versions.at(-1);
    return version ? `#APEX_FILES#libraries/fullcalendar/${version}/dist/index.global.min.js` : void 0;
  } catch {
    return void 0;
  }
}
function renderCalendar(renderer, ctx, region) {
  const domId = renderer.regionDomId(region);
  const settings2 = get(region.props, "settings");
  if (settings2 && typeof settings2 === "object" && !Array.isArray(settings2)) {
    const ignored = Object.keys(settings2).filter((key) => !SUPPORTED.has(key));
    if (ignored.length)
      renderer.diagnose(
        "info",
        `Calendar ${region.id}: settings ${ignored.join(", ")} not simulated locally`,
        ctx.pageId,
        region.id
      );
  }
  if (bool(region.props, "settings.dragAndDrop", false))
    renderer.diagnose(
      "info",
      `Calendar ${region.id}: drag and drop is shown but changes are not saved locally`,
      ctx.pageId,
      region.id
    );
  if (str(region.props, "componentAdvanced.initJavaScriptFunction"))
    renderer.diagnose(
      "info",
      `Calendar ${region.id}: the initialization JavaScript function is not applied locally`,
      ctx.pageId,
      region.id
    );
  const { events, error } = calendarEvents(renderer, ctx, region);
  if (error) renderer.diagnose("warning", `Calendar ${region.id}: ${error}`, ctx.pageId, region.id);
  const views = list(region.props, "settings.additionalCalendarViews").map(String);
  const additional = views.length ? views : ["list", "navigation"];
  const create = get(region.props, "settings.createLink");
  let createUrl;
  if (create !== void 0) {
    const marker2 = { APEX$NEW_START_DATE: NEW_START, APEX$NEW_END_DATE: NEW_END };
    const withMarkers = substituteDeep(create, marker2);
    createUrl = renderer.link(ctx, withMarkers);
  }
  const config = {
    region: region.id,
    initialDate: initialDate(events),
    navigation: additional.includes("navigation"),
    list: additional.includes("list"),
    timeFormat: str(region.props, "settings.timeFormat"),
    firstHour: num(region.props, "settings.firstHour", 8),
    weekends: bool(region.props, "settings.showWeekend", true),
    maxEvents: num(region.props, "settings.maxEventsDay", 0) || void 0,
    firstDay: num(region.props, "settings.startOfWeek", num(region.props, "settings.firstDayOfWeek", 0)),
    createUrl,
    error,
    count: events.length
  };
  return `<div class="apex-local-calendar" id="${escapeHtml(domId)}_calendar" data-calendar="${escapeHtml(JSON.stringify(config))}"></div>`;
}

// packages/core/src/preview/extensions/charts/client.ts
var CHARTS_CSS = String.raw`
.apex-local-jet{position:relative;width:100%;overflow:hidden;font-family:var(--a-base-font-family,"Oracle Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif)}
.apex-local-jet svg{display:block;overflow:visible}
.ajc-svg text{font-family:inherit;font-size:12px;fill:var(--ut-body-text-color,#161513)}
.ajc-svg .ajc-tick,.ajc-svg .ajc-legend-text{fill:rgba(22,21,19,.7)}
.ajc-svg .ajc-axis-title{fill:rgba(22,21,19,.7);font-size:12px}
.ajc-svg .ajc-title{font-size:14px;font-weight:600}
.ajc-svg .ajc-legend-title{font-weight:600;fill:rgba(22,21,19,.85)}
.ajc-svg .ajc-message{fill:rgba(22,21,19,.6);font-size:13px}
.ajc-svg .ajc-value{fill:rgba(22,21,19,.85)}
.ajc-svg .ajc-center-value{font-weight:600;fill:var(--ut-body-text-color,#161513)}
.ajc-svg .ajc-center-label,.ajc-svg .ajc-gauge-text{fill:rgba(22,21,19,.7)}
.ajc-svg .ajc-gauge-text{font-weight:600;fill:var(--ut-body-text-color,#161513)}
.ajc-grid{stroke:rgba(22,21,19,.1);stroke-width:1;shape-rendering:crispEdges}
.ajc-axis{stroke:rgba(22,21,19,.35);stroke-width:1;shape-rendering:crispEdges}
.ajc-reference{stroke:rgba(22,21,19,.6);stroke-width:1.5;stroke-dasharray:5 3}
.ajc-leader{stroke:rgba(22,21,19,.4);stroke-width:1}
.ajc-gauge-track{fill:rgba(22,21,19,.08)}
.ajc-slice{stroke:var(--ut-component-background-color,#fff);stroke-width:1}
.ajc-bar,.ajc-slice,.ajc-bubble,.ajc-gauge-value{transition:opacity .12s}
.ajc-bar:hover,.ajc-slice:hover,.ajc-bubble:hover,.ajc-gauge-value:hover{opacity:.8}
.ajc-point .ajc-hover{opacity:0;transition:opacity .12s}.ajc-point:hover .ajc-hover{opacity:1}
.ajc-link{cursor:pointer}
.apex-local-jet-tip{position:fixed;z-index:3000;pointer-events:none;background:var(--ut-component-background-color,#fff);color:var(--ut-body-text-color,#161513);border:1px solid rgba(22,21,19,.12);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.16);padding:6px 10px;font:12px/1.45 var(--a-base-font-family,"Oracle Sans",system-ui,sans-serif);max-width:320px}
.apex-local-jet-tip table{border-collapse:collapse}.apex-local-jet-tip td{padding:0 0 0 0;vertical-align:top}
.apex-local-jet-tip td:first-child{color:rgba(22,21,19,.65);padding-right:10px}.apex-local-jet-tip td:last-child{font-weight:600}
.apex-local-calendar{min-height:300px}
.apex-local-calendar .fc-event{cursor:pointer}
.apex-local-calendar-fallback{list-style:none;margin:0;padding:0}
.apex-local-calendar-fallback li{padding:6px 0;border-bottom:1px solid rgba(0,0,0,.08)}
.fc .apex-cal-red,.fc .apex-cal-red .fc-daygrid-event-dot{--fc-event-bg-color:#d63b25;--fc-event-border-color:#d63b25}
.fc .apex-cal-orange{--fc-event-bg-color:#ed813e;--fc-event-border-color:#ed813e}
.fc .apex-cal-yellow{--fc-event-bg-color:#fbce4a;--fc-event-border-color:#fbce4a;--fc-event-text-color:#161513}
.fc .apex-cal-green{--fc-event-bg-color:#3caf85;--fc-event-border-color:#3caf85}
.fc .apex-cal-lime{--fc-event-bg-color:#81bb5f;--fc-event-border-color:#81bb5f}
.fc .apex-cal-cyan,.fc .apex-cal-bluesky{--fc-event-bg-color:#13b6cf;--fc-event-border-color:#13b6cf}
.fc .apex-cal-blue{--fc-event-bg-color:#309fdb;--fc-event-border-color:#309fdb}
.fc .apex-cal-darkblue{--fc-event-bg-color:#5a68ad;--fc-event-border-color:#5a68ad}
.fc .apex-cal-purple{--fc-event-bg-color:#854e9b;--fc-event-border-color:#854e9b}
.fc .apex-cal-gray,.fc .apex-cal-silver{--fc-event-bg-color:#6e8598;--fc-event-border-color:#6e8598}
.fc .apex-cal-black{--fc-event-bg-color:#161513;--fc-event-border-color:#161513}
.apex-local-map{display:grid;gap:8px}
.apex-local-map-note{font-size:12px;color:rgba(22,21,19,.65)}
.apex-local-map-canvas{display:block;border-radius:6px;border:1px solid rgba(22,21,19,.12)}
.apex-local-map-bg{fill:#eef3f6}
.apex-local-map-point{stroke:#fff;stroke-width:1.5}
.apex-local-map-point:hover,.apex-local-map-shape:hover{opacity:.8}
.apex-local-map-layers,.apex-local-map-features{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12px}
.apex-local-map-features{max-height:160px;overflow:auto}
.apex-local-map-swatch{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:-1px}
.apex-local-map-count{color:rgba(22,21,19,.6)}
`;
var CHARTS_JS = String.raw`
(function ($) {
  "use strict";
  var base = location.pathname.replace(/\/[^/]*$/, "");
  var tip = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; });
  }
  function showTip(target, event) {
    var text = target.getAttribute("data-tip");
    if (!text) return;
    if (!tip) { tip = document.createElement("div"); tip.className = "apex-local-jet-tip"; document.body.appendChild(tip); }
    var rows = text.split("\n").map(function (line) {
      var parts = line.split("\t");
      return parts.length > 1 ? "<tr><td>" + escapeHtml(parts[0]) + "</td><td>" + escapeHtml(parts.slice(1).join(" ")) + "</td></tr>" : "<tr><td colspan=2>" + escapeHtml(line) + "</td></tr>";
    });
    tip.innerHTML = "<table>" + rows.join("") + "</table>";
    tip.style.display = "block";
    moveTip(event);
  }
  function moveTip(event) {
    if (!tip) return;
    var x = event.clientX + 14, y = event.clientY + 14;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > window.innerWidth - 8) x = event.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = event.clientY - h - 14;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hideTip() { if (tip) tip.style.display = "none"; }
  $(document).on("mouseover", ".apex-local-jet [data-tip], .apex-local-map [data-tip]", function (event) { showTip(this, event); })
    .on("mousemove", ".apex-local-jet [data-tip], .apex-local-map [data-tip]", moveTip)
    .on("mouseout", ".apex-local-jet [data-tip], .apex-local-map [data-tip]", hideTip);

  // Charts are drawn on the server; redraw at the real width so text keeps its size.
  function resizeChart(el) {
    var width = Math.round(el.clientWidth);
    if (!width) return;
    var drawn = Number(el.getAttribute("data-width"));
    if (Math.abs(width - drawn) < 6 || el.__apexLocalPending === width) return;
    el.__apexLocalPending = width;
    var url = base + "/__apex/x/chart?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) + "&region=" + encodeURIComponent(el.getAttribute("data-chart-region")) + "&width=" + width;
    fetch(url, { credentials: "same-origin" }).then(function (r) { return r.ok ? r.text() : null; }).then(function (html) {
      if (html && el.__apexLocalPending === width) { el.innerHTML = html; el.setAttribute("data-width", String(width)); }
      el.__apexLocalPending = null;
    });
  }
  var observer = window.ResizeObserver ? new ResizeObserver(function (entries) {
    entries.forEach(function (entry) {
      var el = entry.target;
      clearTimeout(el.__apexLocalTimer);
      el.__apexLocalTimer = setTimeout(function () { resizeChart(el); }, 120);
    });
  }) : null;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function stamp(date, withTime) {
    var day = date.getFullYear() + "" + pad(date.getMonth() + 1) + pad(date.getDate());
    return withTime ? day + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds()) : day;
  }
  function eventsUrl(config, start, end) {
    return base + "/__apex/x/calendar?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) + "&region=" + encodeURIComponent(config.region) +
      (start ? "&start=" + start.toISOString() + "&end=" + end.toISOString() : "");
  }
  function go(url, element) {
    if (!url) return;
    if (url.indexOf("javascript:") === 0) Function(url.slice(11)).call(element);
    else apex.navigation.redirect(url);
  }
  function fallbackCalendar(el, config) {
    fetch(eventsUrl(config), { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (events) {
      el.innerHTML = '<p class="apex-local-map-note">FullCalendar is not in the preview assets; events are listed instead.</p><ul class="apex-local-calendar-fallback">' +
        events.map(function (e) { return "<li><strong>" + escapeHtml(e.start.replace("T", " ")) + "</strong> " + (e.url ? '<a href="' + escapeHtml(e.url) + '">' + escapeHtml(e.title) + "</a>" : escapeHtml(e.title)) + "</li>"; }).join("") + "</ul>";
    });
  }
  function initCalendar(el) {
    var config = JSON.parse(el.getAttribute("data-calendar") || "{}");
    if (!window.FullCalendar) return fallbackCalendar(el, config);
    var hour12 = config.timeFormat !== "24Hour" && config.timeFormat !== "24";
    var timeFormat = { hour: "numeric", minute: "2-digit", omitZeroMinute: hour12, meridiem: "short", hour12: hour12 };
    var right = ["dayGridMonth", "timeGridWeek", "timeGridDay"];
    if (config.list) right.push("listMonth");
    var calendar = new FullCalendar.Calendar(el, {
      themeSystem: "standard",
      initialView: "dayGridMonth",
      initialDate: config.initialDate,
      headerToolbar: { left: config.navigation ? "prev,next today" : "", center: "title", right: right.join(",") },
      buttonText: { today: "today", month: "month", week: "week", day: "day", list: "list" },
      firstDay: config.firstDay || 0,
      weekends: config.weekends !== false,
      dayMaxEventRows: config.maxEvents ? Math.max(2, config.maxEvents) : true,
      fixedWeekCount: false,
      scrollTime: pad(config.firstHour || 8) + ":00:00",
      eventTimeFormat: timeFormat,
      slotLabelFormat: timeFormat,
      displayEventTime: false,
      nowIndicator: true,
      views: {
        listMonth: { displayEventTime: true, displayEventEnd: true }
      },
      events: function (info, success, failure) {
        fetch(eventsUrl(config, info.start, info.end), { credentials: "same-origin" })
          .then(function (r) { if (!r.ok) throw new Error(r.statusText); return r.json(); })
          .then(success, failure);
      },
      eventClick: function (info) {
        if (info.event.url) { info.jsEvent.preventDefault(); go(info.event.url, info.el); }
      },
      eventDidMount: function (info) {
        var description = info.event.extendedProps && info.event.extendedProps.description;
        info.el.setAttribute("title", description ? info.event.title + "\n" + description : info.event.title);
      },
      dateClick: config.createUrl ? function (info) {
        var start = stamp(info.date, !info.allDay);
        go(config.createUrl.split("${NEW_START}").join(start).split("${NEW_END}").join(start), el);
      } : undefined
    });
    calendar.render();
    el.__apexLocalCalendar = calendar;
    if (observer) { new ResizeObserver(function () { calendar.updateSize(); }).observe(el); }
  }

  function scan(root) {
    $(root).find(".apex-local-jet[data-chart-region]").addBack(".apex-local-jet[data-chart-region]").each(function () {
      if (this.__apexLocalChart) return;
      this.__apexLocalChart = true;
      if (observer) observer.observe(this); else resizeChart(this);
    });
    $(root).find(".apex-local-calendar[data-calendar]").addBack(".apex-local-calendar[data-calendar]").each(function () {
      if (this.__apexLocalCalendarInit) return;
      this.__apexLocalCalendarInit = true;
      initCalendar(this);
    });
  }
  $(function () {
    scan(document.body);
    if (window.MutationObserver) {
      new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (node) { if (node.nodeType === 1) scan(node); });
        });
      }).observe(document.body, { childList: true, subtree: true });
    }
  });
})(apex.jQuery);
`;

// packages/core/src/preview/extensions/charts/svg.ts
var PALETTE = [
  "#245d63",
  "#d7790f",
  "#31a09c",
  "#4e4137",
  "#699e61",
  "#b47282",
  "#83401e",
  "#9e7fcc",
  "#a88e00",
  "#58316e",
  "#5999b5",
  "#317a45"
];
var esc = escapeHtml;
var fixed = (value) => Number(value.toFixed(2));
var seriesColor = (model, series) => series.color ?? PALETTE[model.series.indexOf(series) % PALETTE.length];
var attr = (name, value) => value === void 0 || value === "" ? "" : ` ${name}="${esc(value)}"`;
function linked(markup, link) {
  return link ? `<a href="${esc(link)}" class="ajc-link">${markup}</a>` : markup;
}
function tooltip(model, series, point, value, extra = []) {
  if (!model.tooltip.show) return "";
  if (point.tooltip) return attr("data-tip", point.tooltip);
  const lines = [];
  if (series && model.tooltip.series && model.series.length > 0) lines.push(`Series	${series.name}`);
  if (model.tooltip.group && point.group !== "") lines.push(`Group	${groupLabel(model, point.group)}`);
  if (model.tooltip.value) lines.push(`Value	${value}`);
  lines.push(...extra);
  return attr("data-tip", lines.join("\n"));
}
function groupLabel(model, group2) {
  if (!model.timeAxis) return group2;
  const format2 = model.axes.x.format.format;
  if (format2) return formatDate2(group2, format2);
  const date = parseDate(group2);
  return formatDate2(group2, date && (date.getHours() || date.getMinutes()) ? "datetimeShort" : "dateMedium");
}
function textEl(x, y, value, options2 = {}) {
  const transform = options2.rotate ? ` transform="rotate(${options2.rotate} ${fixed(x)} ${fixed(y)})"` : "";
  return `<text x="${fixed(x)}" y="${fixed(y)}"${attr("class", options2.cls ?? "ajc-label")}${attr("text-anchor", options2.anchor)}${attr("dominant-baseline", options2.baseline ?? "middle")}${options2.size ? ` font-size="${options2.size}"` : ""}${options2.fill ? ` style="fill:${esc(options2.fill)}"` : ""}${transform}>${esc(value)}</text>`;
}
function contrast(color) {
  const hex = /^#?([0-9a-f]{6})$/iu.exec(color.trim())?.[1];
  if (!hex) return "#fff";
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#161513" : "#fff";
}
function legend(model, items, box, pieLike) {
  if (!model.legend.show || !items.length) return { svg: "", plot: box };
  let position2 = model.legend.position;
  if (position2 === "auto") position2 = pieLike && box.w >= 420 ? "end" : "bottom";
  const itemWidth = (item2) => Math.min(textWidth(item2.name), 180) + 26;
  const title = model.legend.title;
  const swatch = (item2, x, y) => item2.shape === "line" ? `<line x1="${fixed(x)}" y1="${fixed(y)}" x2="${fixed(x + 14)}" y2="${fixed(y)}" stroke="${esc(item2.color)}" stroke-width="3" stroke-linecap="round"/>` : item2.shape === "circle" ? `<circle cx="${fixed(x + 7)}" cy="${fixed(y)}" r="5" fill="${esc(item2.color)}"/>` : `<rect x="${fixed(x + 1)}" y="${fixed(y - 6)}" width="12" height="12" rx="2" fill="${esc(item2.color)}"/>`;
  const entry = (item2, x, y) => `<g class="ajc-legend-item" data-series="${esc(item2.name)}">${swatch(item2, x, y)}${textEl(x + 20, y, truncate(item2.name, 180), { cls: "ajc-legend-text" })}</g>`;
  if (position2 === "start" || position2 === "end") {
    const width = Math.min(box.w * 0.4, Math.max(...items.map(itemWidth), title ? textWidth(title) : 0) + 12);
    const lineHeight = 22;
    const visible = items.slice(0, Math.max(1, Math.floor((box.h - (title ? 22 : 0)) / lineHeight)));
    const total = visible.length * lineHeight + (title ? 22 : 0);
    const x = position2 === "end" ? box.x + box.w - width + 8 : box.x + 4;
    let y = box.y + Math.max(0, (box.h - total) / 2) + 11;
    let svg2 = "";
    if (title) {
      svg2 += textEl(x, y, title, { cls: "ajc-legend-title" });
      y += 22;
    }
    for (const item2 of visible) {
      svg2 += entry(item2, x, y);
      y += lineHeight;
    }
    const plot2 = position2 === "end" ? { ...box, w: box.w - width - 8 } : { ...box, x: box.x + width + 8, w: box.w - width - 8 };
    return { svg: `<g class="ajc-legend">${svg2}</g>`, plot: plot2 };
  }
  const rows = [[]];
  let used = title ? textWidth(title) + 16 : 0;
  for (const item2 of items) {
    const width = itemWidth(item2) + 14;
    if (used + width > box.w && rows.at(-1).length) {
      rows.push([]);
      used = 0;
    }
    rows.at(-1).push(item2);
    used += width;
  }
  const shown = rows.slice(0, 3);
  const height = shown.length * 22 + 6;
  let svg = "";
  shown.forEach((row, index) => {
    const widths = row.map((item2) => itemWidth(item2) + 14);
    const titleWidth = index === 0 && title ? textWidth(title) + 16 : 0;
    const total = widths.reduce((sum, width) => sum + width, 0) - 14 + titleWidth;
    let x = box.x + Math.max(0, (box.w - total) / 2);
    const y = position2 === "top" ? box.y + 11 + index * 22 : box.y + box.h - height + 14 + index * 22;
    if (titleWidth) {
      svg += textEl(x, y, title, { cls: "ajc-legend-title" });
      x += titleWidth;
    }
    row.forEach((item2, itemIndex) => {
      svg += entry(item2, x, y);
      x += widths[itemIndex];
    });
  });
  const plot = position2 === "top" ? { ...box, y: box.y + height, h: box.h - height } : { ...box, h: box.h - height };
  return { svg: `<g class="ajc-legend">${svg}</g>`, plot };
}
function renderChartSvg(model, width) {
  const height = model.height;
  const W = Math.max(160, Math.round(model.maxWidth ? Math.min(width, model.maxWidth) : width));
  let box = { x: 8, y: 8, w: W - 16, h: height - 16 };
  let head = "";
  if (model.title) {
    head = textEl(W / 2, 18, model.title, { anchor: "middle", cls: "ajc-title" });
    box = { ...box, y: box.y + 24, h: box.h - 24 };
  }
  let body3;
  const hasData = model.series.some((series) => series.points.length);
  if (model.errors.length && !hasData) {
    body3 = textEl(W / 2, height / 2, model.errors[0], { anchor: "middle", cls: "ajc-message" });
  } else if (!hasData) {
    body3 = textEl(W / 2, height / 2, model.noDataFound, { anchor: "middle", cls: "ajc-message" });
  } else {
    switch (model.type) {
      case "pie":
      case "donut":
        body3 = pie(model, box);
        break;
      case "funnel":
      case "pyramid":
        body3 = funnel(model, box);
        break;
      case "statusMeterGauge":
        body3 = gauges(model, box);
        break;
      case "scatter":
      case "bubble":
        body3 = scatter(model, box);
        break;
      case "radar":
      case "polar":
        body3 = radar(model, box);
        break;
      default:
        body3 = cartesian(model, box);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="ajc-svg" width="100%" height="${height}" viewBox="0 0 ${W} ${height}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="${esc(model.name)}" data-type="${esc(model.type)}">${head}${body3}</svg>`;
}
var project = (scale, value, start, length) => {
  if (scale.log) {
    const lo = Math.log10(Math.max(scale.min, 1e-9));
    const hi = Math.log10(scale.max);
    return start + (Math.log10(Math.max(value, 1e-9)) - lo) / (hi - lo || 1) * length;
  }
  return start + (value - scale.min) / (scale.max - scale.min || 1) * length;
};
function valueScale(values, axis, includeZero) {
  const finite = values.filter(Number.isFinite);
  const low = finite.length ? Math.min(...finite) : 0;
  const high = finite.length ? Math.max(...finite) : 1;
  if (axis.log && low > 0) {
    const min = axis.min ?? 10 ** Math.floor(Math.log10(low));
    const max = axis.max ?? 10 ** Math.ceil(Math.log10(high) + (high === low ? 1 : 0));
    return { min, max, step: 10, log: true };
  }
  if (!includeZero || !axis.baselineZero) {
    const pad2 = (high - low) * 0.05 || Math.abs(high) * 0.1 || 1;
    return niceScale(low - pad2, high + pad2, {
      min: axis.min ?? void 0,
      max: axis.max,
      step: axis.step,
      ticks: 5,
      includeZero: false
    });
  }
  return niceScale(low, high, { min: axis.min, max: axis.max, step: axis.step, ticks: 5 });
}
function scaleTicks(scale) {
  if (!scale.log) return ticks(scale);
  const values = [];
  for (let value = scale.min; value <= scale.max * 1.0001; value *= 10) values.push(value);
  return values;
}
var isBar = (series) => series.type === "bar" || series.type === "barRange";
var isArea = (series) => series.type === "area" || series.type === "lineWithArea" || series.type === "areaRange";
function cartesian(model, outer) {
  const groups = model.groups;
  const all = model.series;
  const horizontal = model.orientation === "horizontal" && model.type !== "line";
  const legendItems = all.map((series) => ({
    name: series.name,
    color: seriesColor(model, series),
    shape: isBar(series) || isArea(series) ? "square" : "line"
  }));
  const { svg: legendSvg, plot: area } = legend(model, legendItems, outer, false);
  const stacked = /* @__PURE__ */ new Map();
  const stackKey = (series, group2, sign) => `${series.y2 ? "y2" : "y"}|${isBar(series) ? "bar" : "area"}|${series.stackCategory}|${group2}|${sign}`;
  const extents = { y: [], y2: [] };
  const stackable = (series) => model.stack && (isBar(series) || isArea(series)) && !series.type.endsWith("Range");
  for (const series of all) {
    const bucket = extents[series.y2 ? "y2" : "y"];
    for (const point of series.points) {
      if (series.type.endsWith("Range")) {
        if (point.low !== void 0) bucket.push(point.low);
        if (point.high !== void 0) bucket.push(point.high);
        continue;
      }
      if (point.value === null) continue;
      if (stackable(series)) {
        const key = stackKey(series, point.group, point.value < 0 ? -1 : 1);
        const total = (stacked.get(key) ?? 0) + point.value;
        stacked.set(key, total);
        bucket.push(total);
      } else bucket.push(point.value);
      for (const line of series.referenceLines) bucket.push(line.value);
    }
  }
  const anyBar = all.some(isBar);
  const yScale = valueScale(extents.y, model.axes.y, anyBar || all.some(isArea) || true);
  const hasY2 = all.some((series) => series.y2);
  const y2Scale = hasY2 ? valueScale(extents.y2, model.axes.y2, true) : void 0;
  const yTicks = scaleTicks(yScale);
  const yLabels = yTicks.map((value) => formatTick(value, model.axes.y.format, yScale.step));
  const y2Ticks = y2Scale ? scaleTicks(y2Scale) : [];
  const y2Labels = y2Scale ? y2Ticks.map((value) => formatTick(value, model.axes.y2.format, y2Scale.step)) : [];
  const groupLabels = groups.map((group2) => groupLabel(model, group2));
  const xAxis = model.axes.x;
  const yAxis = model.axes.y;
  const valueLabelWidth = Math.max(...yLabels.map((label) => textWidth(label)), 10);
  const y2LabelWidth = y2Labels.length ? Math.max(...y2Labels.map((label) => textWidth(label))) : 0;
  let left;
  let right;
  let bottom;
  let rotate = false;
  let skip = 1;
  const top = 6;
  const maxGroupLabel = Math.max(...groupLabels.map((label) => textWidth(label)), 10);
  if (horizontal) {
    left = xAxis.show && xAxis.tickLabels ? Math.min(maxGroupLabel, area.w * 0.35) + 10 : 4;
    if (xAxis.title) left += 20;
    bottom = yAxis.show && yAxis.tickLabels ? 22 : 6;
    if (yAxis.title) bottom += 20;
    right = 12;
  } else {
    left = yAxis.show && yAxis.tickLabels ? valueLabelWidth + 10 : 4;
    if (yAxis.title) left += 20;
    right = y2Scale ? y2LabelWidth + 10 + (model.axes.y2.title ? 20 : 0) : 12;
    const band2 = (area.w - left - right) / Math.max(1, groups.length);
    bottom = 22;
    if (xAxis.show && xAxis.tickLabels && maxGroupLabel + 6 > band2) {
      if (xAxis.rotate && band2 >= 14) {
        rotate = true;
        bottom = Math.min(maxGroupLabel, area.h * 0.3) * 0.72 + 16;
        left = Math.max(left, Math.min(maxGroupLabel, area.h * 0.3) * 0.72 - band2 / 2 + 4);
      } else skip = Math.ceil((maxGroupLabel + 10) / Math.max(band2, 1));
    }
    if (!xAxis.show || !xAxis.tickLabels) bottom = 6;
    if (xAxis.title) bottom += 20;
  }
  const plot = {
    x: area.x + left,
    y: area.y + top,
    w: Math.max(20, area.w - left - right),
    h: Math.max(20, area.h - top - bottom)
  };
  const categoryLength = horizontal ? plot.h : plot.w;
  const band = categoryLength / Math.max(1, groups.length);
  const groupCenter = (index) => horizontal ? plot.y + band * (index + 0.5) : plot.x + band * (index + 0.5);
  const valuePos = (scale, value) => horizontal ? project(scale, value, plot.x, plot.w) : plot.y + plot.h - project(scale, value, 0, plot.h);
  const out = [];
  if (yAxis.grid || yAxis.show) {
    yTicks.forEach((value, index) => {
      const pos = valuePos(yScale, value);
      if (yAxis.grid)
        out.push(
          horizontal ? `<line class="ajc-grid" x1="${fixed(pos)}" y1="${fixed(plot.y)}" x2="${fixed(pos)}" y2="${fixed(plot.y + plot.h)}"/>` : `<line class="ajc-grid" x1="${fixed(plot.x)}" y1="${fixed(pos)}" x2="${fixed(plot.x + plot.w)}" y2="${fixed(pos)}"/>`
        );
      if (yAxis.show && yAxis.tickLabels)
        out.push(
          horizontal ? textEl(pos, plot.y + plot.h + 12, yLabels[index], { anchor: "middle", cls: "ajc-tick" }) : textEl(plot.x - 6, pos, yLabels[index], { anchor: "end", cls: "ajc-tick" })
        );
    });
  }
  if (y2Scale && model.axes.y2.show && !horizontal) {
    y2Ticks.forEach((value, index) => {
      out.push(textEl(plot.x + plot.w + 6, valuePos(y2Scale, value), y2Labels[index], { cls: "ajc-tick" }));
    });
  }
  const zero = valuePos(yScale, Math.min(Math.max(0, yScale.min), yScale.max));
  if (xAxis.show)
    out.push(
      horizontal ? `<line class="ajc-axis" x1="${fixed(zero)}" y1="${fixed(plot.y)}" x2="${fixed(zero)}" y2="${fixed(plot.y + plot.h)}"/>` : `<line class="ajc-axis" x1="${fixed(plot.x)}" y1="${fixed(zero)}" x2="${fixed(plot.x + plot.w)}" y2="${fixed(zero)}"/>`
    );
  if (xAxis.show && xAxis.tickLabels) {
    groupLabels.forEach((label, index) => {
      if (index % skip) return;
      const center = groupCenter(index);
      if (horizontal)
        out.push(textEl(plot.x - 6, center, truncate(label, left - 10), { anchor: "end", cls: "ajc-tick" }));
      else if (rotate)
        out.push(
          textEl(center, plot.y + plot.h + 8, truncate(label, (bottom - 16) / 0.72), {
            anchor: "end",
            cls: "ajc-tick",
            rotate: -45,
            baseline: "hanging"
          })
        );
      else
        out.push(
          textEl(center, plot.y + plot.h + 12, truncate(label, band * skip - 4), {
            anchor: "middle",
            cls: "ajc-tick"
          })
        );
    });
  }
  if (xAxis.title) {
    out.push(
      horizontal ? textEl(area.x + 8, plot.y + plot.h / 2, xAxis.title, {
        anchor: "middle",
        cls: "ajc-axis-title",
        rotate: -90
      }) : textEl(plot.x + plot.w / 2, area.y + area.h - 8, xAxis.title, {
        anchor: "middle",
        cls: "ajc-axis-title"
      })
    );
  }
  if (yAxis.title) {
    out.push(
      horizontal ? textEl(plot.x + plot.w / 2, area.y + area.h - 8, yAxis.title, {
        anchor: "middle",
        cls: "ajc-axis-title"
      }) : textEl(area.x + 8, plot.y + plot.h / 2, yAxis.title, {
        anchor: "middle",
        cls: "ajc-axis-title",
        rotate: -90
      })
    );
  }
  if (y2Scale && model.axes.y2.title && !horizontal) {
    out.push(
      textEl(area.x + area.w - 8, plot.y + plot.h / 2, model.axes.y2.title, {
        anchor: "middle",
        cls: "ajc-axis-title",
        rotate: 90
      })
    );
  }
  const barSeries = all.filter(isBar);
  const slots = [];
  for (const series of barSeries) {
    const slot = model.stack ? `${series.y2 ? "y2" : "y"}|${series.stackCategory}` : series.id;
    if (!slots.includes(slot)) slots.push(slot);
  }
  const groupWidth = band * (slots.length > 1 ? 0.75 : 0.6);
  const slotWidth = groupWidth / Math.max(1, slots.length);
  const barWidth = Math.max(1, slotWidth * (slots.length > 1 ? 0.92 : 1));
  const running2 = /* @__PURE__ */ new Map();
  const stackTotals = /* @__PURE__ */ new Map();
  const labels = [];
  for (const series of barSeries) {
    const color = seriesColor(model, series);
    const scale = series.y2 && y2Scale ? y2Scale : yScale;
    const slot = slots.indexOf(model.stack ? `${series.y2 ? "y2" : "y"}|${series.stackCategory}` : series.id);
    const bars = [];
    for (const point of series.points) {
      const index = groups.indexOf(point.group);
      if (index < 0) continue;
      let from;
      let to;
      if (series.type === "barRange") {
        if (point.low === void 0 || point.high === void 0) continue;
        from = point.low;
        to = point.high;
      } else {
        if (point.value === null) continue;
        from = 0;
        to = point.value;
        if (stackable(series)) {
          const key = stackKey(series, point.group, point.value < 0 ? -1 : 1);
          from = running2.get(key) ?? 0;
          to = from + point.value;
          running2.set(key, to);
        }
      }
      const clampedFrom = Math.min(Math.max(from, scale.min), scale.max);
      const clampedTo = Math.min(Math.max(to, scale.min), scale.max);
      const a = valuePos(scale, clampedFrom);
      const b = valuePos(scale, clampedTo);
      const offset = groupCenter(index) - groupWidth / 2 + slotWidth * slot + (slotWidth - barWidth) / 2;
      const rect = horizontal ? { x: Math.min(a, b), y: offset, w: Math.max(Math.abs(b - a), 0.5), h: barWidth } : { x: offset, y: Math.min(a, b), w: barWidth, h: Math.max(Math.abs(b - a), 0.5) };
      const fill2 = point.color ?? color;
      const formatted = series.type === "barRange" ? `${formatValue(from, model.value)} \u2013 ${formatValue(to, model.value)}` : formatValue(point.value, scale === y2Scale ? model.axes.y2.format : model.axes.y.format);
      bars.push(
        linked(
          `<rect class="ajc-bar" x="${fixed(rect.x)}" y="${fixed(rect.y)}" width="${fixed(rect.w)}" height="${fixed(rect.h)}" fill="${esc(fill2)}"${tooltip(model, series, point, formatted)}/>`,
          point.link
        )
      );
      if (model.stack && model.stackLabel && series.type !== "barRange") {
        const key = `${slot}|${index}|${to < 0 ? -1 : 1}`;
        stackTotals.set(key, {
          value: (stackTotals.get(key)?.value ?? 0) + (point.value ?? 0),
          pos: b,
          center: offset + barWidth / 2
        });
      }
      if (series.label.show && series.label.position !== "none") {
        const text5 = dataLabel(series, point, formatted, model);
        const inside = horizontal ? rect.w > textWidth(text5, 11) + 8 : rect.h > 16 && rect.w > textWidth(text5, 11) * 0.6;
        const outsidePosition = series.label.position === "outsideBarEdge" || !inside;
        const negative = to < from;
        if (horizontal) {
          const x = outsidePosition ? negative ? rect.x - 4 : rect.x + rect.w + 4 : series.label.position === "insideBarEdge" ? negative ? rect.x + 4 : rect.x + rect.w - 4 : rect.x + rect.w / 2;
          const anchor = outsidePosition ? negative ? "end" : "start" : series.label.position === "insideBarEdge" ? negative ? "start" : "end" : "middle";
          labels.push(
            textEl(x, rect.y + rect.h / 2, text5, {
              anchor,
              cls: "ajc-value",
              size: 11,
              fill: outsidePosition ? void 0 : contrast(fill2)
            })
          );
        } else {
          const y = outsidePosition ? negative ? rect.y + rect.h + 8 : rect.y - 8 : series.label.position === "insideBarEdge" ? negative ? rect.y + rect.h - 9 : rect.y + 9 : rect.y + rect.h / 2;
          labels.push(
            textEl(rect.x + rect.w / 2, y, text5, {
              anchor: "middle",
              cls: "ajc-value",
              size: 11,
              fill: outsidePosition ? void 0 : contrast(fill2)
            })
          );
        }
      }
    }
    out.push(`<g class="ajc-series" data-series="${esc(series.name)}">${bars.join("")}</g>`);
  }
  for (const total of stackTotals.values()) {
    const text5 = formatValue(total.value, model.axes.y.format);
    labels.push(
      horizontal ? textEl(total.pos + 4, total.center, text5, { cls: "ajc-value ajc-stack-label", size: 11 }) : textEl(total.center, total.pos - 8, text5, {
        anchor: "middle",
        cls: "ajc-value ajc-stack-label",
        size: 11
      })
    );
  }
  const lineLike = all.filter((series) => !isBar(series));
  const areaBase = /* @__PURE__ */ new Map();
  const ordered = [...lineLike.filter(isArea), ...lineLike.filter((series) => !isArea(series))];
  for (const series of ordered) {
    const color = seriesColor(model, series);
    const scale = series.y2 && y2Scale ? y2Scale : yScale;
    const coordinates = groups.map(() => null);
    for (const point of series.points) {
      const index = groups.indexOf(point.group);
      if (index < 0) continue;
      let value = point.value;
      let base = series.type === "areaRange" ? point.low ?? 0 : Math.max(scale.min, Math.min(0, scale.max));
      if (series.type === "areaRange") value = point.high ?? null;
      if (value === null) continue;
      if (stackable(series)) {
        const key = stackKey(series, point.group, value < 0 ? -1 : 1);
        base = areaBase.get(key) ?? 0;
        value = base + value;
        areaBase.set(key, value);
      }
      const center = groupCenter(index);
      const pos = valuePos(scale, Math.min(Math.max(value, scale.min), scale.max));
      const basePos = valuePos(scale, Math.min(Math.max(base, scale.min), scale.max));
      coordinates[index] = horizontal ? { x: pos, y: center, base: basePos, point, value } : { x: center, y: pos, base: basePos, point, value };
    }
    const segments = [[]];
    for (const coordinate of coordinates) {
      if (coordinate) segments.at(-1).push(coordinate);
      else if (segments.at(-1).length) segments.push([]);
    }
    const parts = [];
    for (const segment of segments) {
      const points = segment.filter((entry) => entry !== null);
      if (!points.length) continue;
      const path9 = linePath(
        points.map((entry) => [entry.x, entry.y]),
        series.line.type,
        horizontal
      );
      if (isArea(series)) {
        const baseline = points.map((entry) => horizontal ? [entry.base, entry.y] : [entry.x, entry.base]).reverse();
        const close = linePath(baseline, series.line.type, horizontal).replace(
          /^M/u,
          "L"
        );
        parts.push(
          `<path class="ajc-area" d="${path9} ${close} Z" fill="${esc(color)}" fill-opacity="${series.type === "area" ? 0.85 : 0.2}"/>`
        );
      }
      if (series.type !== "area") {
        const dash = series.line.style === "dashed" ? ' stroke-dasharray="8 5"' : series.line.style === "dotted" ? ' stroke-dasharray="2 4"' : "";
        parts.push(
          `<path class="ajc-line" d="${path9}" fill="none" stroke="${esc(color)}" stroke-width="${series.line.width}" stroke-linejoin="round" stroke-linecap="round"${dash}/>`
        );
      }
    }
    const showMarkers = series.marker.show === "true" || series.marker.show === "auto" && series.points.length <= 1;
    for (const entry of coordinates) {
      if (!entry) continue;
      const formatted = formatValue(
        entry.point.value,
        scale === y2Scale ? model.axes.y2.format : model.axes.y.format
      );
      const markerFill = entry.point.color ?? color;
      const visible = showMarkers ? marker(series.marker.shape, entry.x, entry.y, 4.5, markerFill) : "";
      parts.push(
        linked(
          `<g class="ajc-point"${tooltip(model, series, entry.point, formatted)}>${visible}<circle class="ajc-hit" cx="${fixed(entry.x)}" cy="${fixed(entry.y)}" r="9" fill="transparent"/><circle class="ajc-hover" cx="${fixed(entry.x)}" cy="${fixed(entry.y)}" r="4.5" fill="${esc(markerFill)}"/></g>`,
          entry.point.link
        )
      );
      if (series.label.show && series.label.position !== "none") {
        const text5 = dataLabel(series, entry.point, formatted, model);
        const below = series.label.position === "belowMarker";
        labels.push(
          textEl(entry.x, entry.y + (below ? 14 : -12), text5, {
            anchor: "middle",
            cls: "ajc-value",
            size: 11
          })
        );
      }
    }
    out.push(`<g class="ajc-series" data-series="${esc(series.name)}">${parts.join("")}</g>`);
  }
  for (const series of all) {
    for (const line of series.referenceLines) {
      const pos = valuePos(series.y2 && y2Scale ? y2Scale : yScale, line.value);
      out.push(
        horizontal ? `<line class="ajc-reference" x1="${fixed(pos)}" y1="${fixed(plot.y)}" x2="${fixed(pos)}" y2="${fixed(plot.y + plot.h)}"${attr("stroke", line.color)}/>` : `<line class="ajc-reference" x1="${fixed(plot.x)}" y1="${fixed(pos)}" x2="${fixed(plot.x + plot.w)}" y2="${fixed(pos)}"${attr("stroke", line.color)}/>`
      );
    }
  }
  return `<g class="ajc-plot">${out.join("")}</g><g class="ajc-labels">${labels.join("")}</g>${legendSvg}`;
}
function dataLabel(series, point, formatted, model, percent) {
  const pct = percent === void 0 ? "" : formatValue(percent, { format: "percent", decimalPlaces: 0 });
  const label = groupLabel(model, point.group);
  switch (series.label.displayAs) {
    case "label":
      return label;
    case "percentage":
      return pct || formatted;
    case "labelValue":
      return `${label}: ${formatted}`;
    case "labelPercentage":
      return `${label}: ${pct || formatted}`;
    case "labelPercentageValue":
      return `${label}: ${pct} (${formatted})`;
    case "percentageValue":
      return pct ? `${pct} (${formatted})` : formatted;
    default:
      return formatted;
  }
}
function marker(shape, x, y, r, fill2) {
  const f = esc(fill2);
  switch (shape) {
    case "square":
      return `<rect class="ajc-marker" x="${fixed(x - r)}" y="${fixed(y - r)}" width="${fixed(r * 2)}" height="${fixed(r * 2)}" fill="${f}"/>`;
    case "diamond":
      return `<path class="ajc-marker" d="M${fixed(x)} ${fixed(y - r * 1.3)}L${fixed(x + r * 1.3)} ${fixed(y)}L${fixed(x)} ${fixed(y + r * 1.3)}L${fixed(x - r * 1.3)} ${fixed(y)}Z" fill="${f}"/>`;
    case "triangleUp":
      return `<path class="ajc-marker" d="M${fixed(x)} ${fixed(y - r * 1.2)}L${fixed(x + r * 1.2)} ${fixed(y + r)}L${fixed(x - r * 1.2)} ${fixed(y + r)}Z" fill="${f}"/>`;
    case "triangleDown":
      return `<path class="ajc-marker" d="M${fixed(x)} ${fixed(y + r * 1.2)}L${fixed(x + r * 1.2)} ${fixed(y - r)}L${fixed(x - r * 1.2)} ${fixed(y - r)}Z" fill="${f}"/>`;
    case "plus":
      return `<path class="ajc-marker" d="M${fixed(x - r)} ${fixed(y)}H${fixed(x + r)}M${fixed(x)} ${fixed(y - r)}V${fixed(y + r)}" stroke="${f}" stroke-width="2.5"/>`;
    default:
      return `<circle class="ajc-marker" cx="${fixed(x)}" cy="${fixed(y)}" r="${r}" fill="${f}"/>`;
  }
}
function linePath(points, type, horizontal) {
  if (!points.length) return "";
  const [first] = points;
  let d = `M${fixed(first[0])} ${fixed(first[1])}`;
  if (points.length === 1) return `${d}h0.01`;
  for (let index = 1; index < points.length; index += 1) {
    const [x, y] = points[index];
    const [px, py] = points[index - 1];
    if (type === "stepped") d += horizontal ? `V${fixed(y)}H${fixed(x)}` : `H${fixed(x)}V${fixed(y)}`;
    else if (type === "centeredStepped") {
      if (horizontal) {
        const mid = (py + y) / 2;
        d += `V${fixed(mid)}H${fixed(x)}V${fixed(y)}`;
      } else {
        const mid = (px + x) / 2;
        d += `H${fixed(mid)}V${fixed(y)}H${fixed(x)}`;
      }
    } else if (type === "curved") {
      const before = points[index - 2] ?? points[index - 1];
      const after = points[index + 1] ?? points[index];
      const c1x = px + (x - before[0]) / 6;
      const c1y = py + (y - before[1]) / 6;
      const c2x = x - (after[0] - px) / 6;
      const c2y = y - (after[1] - py) / 6;
      d += `C${fixed(c1x)} ${fixed(c1y)} ${fixed(c2x)} ${fixed(c2y)} ${fixed(x)} ${fixed(y)}`;
    } else d += `L${fixed(x)} ${fixed(y)}`;
  }
  return d;
}
var polar = (cx, cy, r, angle) => [
  cx + r * Math.cos(angle),
  cy + r * Math.sin(angle)
];
function arcPath(cx, cy, r, inner, start, end) {
  if (end - start >= Math.PI * 2 - 1e-6) {
    const outerRing = `M${fixed(cx - r)} ${fixed(cy)}a${r} ${r} 0 1 0 ${fixed(r * 2)} 0a${r} ${r} 0 1 0 ${fixed(-r * 2)} 0`;
    return inner > 0 ? `${outerRing}M${fixed(cx - inner)} ${fixed(cy)}a${inner} ${inner} 0 1 1 ${fixed(inner * 2)} 0a${inner} ${inner} 0 1 1 ${fixed(-inner * 2)} 0Z` : `${outerRing}Z`;
  }
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = polar(cx, cy, r, start);
  const [x2, y2] = polar(cx, cy, r, end);
  if (inner <= 0)
    return `M${fixed(cx)} ${fixed(cy)}L${fixed(x1)} ${fixed(y1)}A${r} ${r} 0 ${large} 1 ${fixed(x2)} ${fixed(y2)}Z`;
  const [x3, y3] = polar(cx, cy, inner, end);
  const [x4, y4] = polar(cx, cy, inner, start);
  return `M${fixed(x1)} ${fixed(y1)}A${r} ${r} 0 ${large} 1 ${fixed(x2)} ${fixed(y2)}L${fixed(x3)} ${fixed(y3)}A${inner} ${inner} 0 ${large} 0 ${fixed(x4)} ${fixed(y4)}Z`;
}
function slices(model) {
  const list4 = [];
  for (const series of model.series) {
    for (const point of series.points) {
      if (point.value === null || point.value <= 0) continue;
      const name = model.series.length > 1 && !point.group ? series.name : point.group;
      list4.push({
        series,
        point,
        value: point.value,
        name,
        color: point.color ?? series.color ?? PALETTE[list4.length % PALETTE.length]
      });
    }
  }
  const total = list4.reduce((sum, slice) => sum + slice.value, 0);
  const threshold = model.value.otherThreshold;
  if (threshold > 0 && total > 0) {
    const small = list4.filter((slice) => slice.value / total < threshold);
    if (small.length > 1) {
      const kept = list4.filter((slice) => !small.includes(slice));
      const value = small.reduce((sum, slice) => sum + slice.value, 0);
      kept.push({
        series: small[0].series,
        point: { group: "Other", value },
        value,
        name: "Other",
        color: "#7b7570"
      });
      return kept;
    }
  }
  return list4;
}
function pie(model, outer) {
  const list4 = slices(model);
  const total = list4.reduce((sum, slice) => sum + slice.value, 0);
  const { svg: legendSvg, plot } = legend(
    model,
    list4.map((slice) => ({ name: slice.name, color: slice.color, shape: "square" })),
    outer,
    true
  );
  if (!total)
    return textEl(outer.x + outer.w / 2, outer.y + outer.h / 2, model.noDataFound, {
      anchor: "middle",
      cls: "ajc-message"
    });
  const labelled = list4.some((slice) => slice.series.label.show);
  const outside = list4.some(
    (slice) => slice.series.label.show && ["outsideSlice", "auto"].includes(slice.series.label.position)
  );
  const margin = outside ? 34 : 6;
  const cx = plot.x + plot.w / 2;
  const cy = plot.y + plot.h / 2;
  const r = Math.max(10, Math.min(plot.w / 2 - (outside ? 60 : margin), plot.h / 2 - margin));
  const inner = model.type === "donut" ? r * 0.55 : 0;
  let angle = -Math.PI / 2;
  const paths = [];
  const labels = [];
  for (const slice of list4) {
    const sweep = slice.value / total * Math.PI * 2;
    const formatted = formatValue(slice.value, model.value);
    const percent = slice.value / total;
    paths.push(
      linked(
        `<path class="ajc-slice" d="${arcPath(cx, cy, r, inner, angle, angle + sweep)}" fill="${esc(slice.color)}"${tooltip(model, slice.series, { ...slice.point, group: slice.name }, formatted, [`Percent	${formatValue(percent, { format: "percent", decimalPlaces: 1 })}`])}/>`,
        slice.point.link
      )
    );
    if (labelled && slice.series.label.show && slice.series.label.position !== "none") {
      const text5 = dataLabel(slice.series, { ...slice.point, group: slice.name }, formatted, model, percent);
      const mid = angle + sweep / 2;
      const ring = r - inner;
      const fitsInside = sweep * (inner + ring / 2) > textWidth(text5, 11) * 0.9 && ring > 18;
      const position2 = slice.series.label.position;
      if (position2 === "center" || position2 === "auto" && fitsInside || position2 === "inside" && fitsInside) {
        const [lx, ly] = polar(cx, cy, inner ? (r + inner) / 2 : r * 0.62, mid);
        labels.push(
          textEl(lx, ly, text5, {
            anchor: "middle",
            cls: "ajc-value",
            size: 11,
            fill: contrast(slice.color)
          })
        );
      } else {
        const [ax, ay] = polar(cx, cy, r, mid);
        const [bx, by] = polar(cx, cy, r + 14, mid);
        const rightSide = Math.cos(mid) >= 0;
        const ex = bx + (rightSide ? 10 : -10);
        labels.push(
          `<path class="ajc-leader" d="M${fixed(ax)} ${fixed(ay)}L${fixed(bx)} ${fixed(by)}L${fixed(ex)} ${fixed(by)}" fill="none"/>`,
          textEl(
            ex + (rightSide ? 3 : -3),
            by,
            truncate(text5, Math.max(40, (rightSide ? outer.x + outer.w - ex : ex - outer.x) - 6), 11),
            {
              anchor: rightSide ? "start" : "end",
              cls: "ajc-value",
              size: 11
            }
          )
        );
      }
    }
    angle += sweep;
  }
  let center = "";
  if (inner > 24) {
    const value = formatValue(total, model.value);
    const size = Math.max(12, Math.min(28, inner * 1.4 / Math.max(3, value.length * 0.6)));
    center = `<g class="ajc-center">${textEl(cx, cy - (inner > 40 ? 8 : 0), value, { anchor: "middle", cls: "ajc-center-value", size })}${inner > 40 ? textEl(cx, cy + size / 2 + 4, "Total", { anchor: "middle", cls: "ajc-center-label", size: 12 }) : ""}</g>`;
  }
  return `<g class="ajc-plot ajc-pie">${paths.join("")}</g>${center}<g class="ajc-labels">${labels.join("")}</g>${legendSvg}`;
}
function funnel(model, outer) {
  const list4 = slices(model);
  const { svg: legendSvg, plot } = legend(
    model,
    list4.map((slice) => ({ name: slice.name, color: slice.color, shape: "square" })),
    outer,
    true
  );
  const total = list4.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const pyramid = model.type === "pyramid";
  const gap = 2;
  const usable = plot.h - gap * (list4.length - 1);
  const minimum = Math.min(18, usable / Math.max(1, list4.length));
  const heights = list4.map((slice) => Math.max(minimum, slice.value / total * usable));
  const scale = usable / heights.reduce((sum, height) => sum + height, 0);
  const width = Math.min(plot.w, plot.h * (pyramid ? 1.15 : 1.6));
  const cx = plot.x + plot.w / 2;
  const half = (t) => pyramid ? width / 2 * t : width / 2 * (1 - t * 0.72);
  let y = plot.y;
  const parts = [];
  list4.forEach((slice, index) => {
    const height = heights[index] * scale;
    const t0 = (y - plot.y) / plot.h;
    const t1 = (y + height - plot.y) / plot.h;
    const top = half(t0);
    const bottom = half(t1);
    const formatted = formatValue(slice.value, model.value);
    const d = `M${fixed(cx - top)} ${fixed(y)}L${fixed(cx + top)} ${fixed(y)}L${fixed(cx + bottom)} ${fixed(y + height)}L${fixed(cx - bottom)} ${fixed(y + height)}Z`;
    parts.push(
      linked(
        `<path class="ajc-slice" d="${d}" fill="${esc(slice.color)}"${tooltip(model, slice.series, { ...slice.point, group: slice.name }, formatted)}/>`,
        slice.point.link
      )
    );
    const text5 = slice.series.label.show ? dataLabel(slice.series, { ...slice.point, group: slice.name }, formatted, model, slice.value / total) : formatted;
    if (height >= 14 && Math.min(top, bottom) * 2 > textWidth(text5, 11) + 8)
      parts.push(
        textEl(cx, y + height / 2, text5, {
          anchor: "middle",
          cls: "ajc-value",
          size: 11,
          fill: contrast(slice.color)
        })
      );
    y += height + gap;
  });
  return `<g class="ajc-plot ajc-funnel">${parts.join("")}</g>${legendSvg}`;
}
function gauges(model, outer) {
  const entries = model.series.flatMap((series) => series.points.map((point) => ({ series, point }))).slice(0, 24);
  const orientation = model.gauge.orientation;
  const columns = orientation === "horizontal" ? 1 : Math.max(1, Math.min(entries.length, Math.floor(outer.w / (orientation === "vertical" ? 90 : 180))));
  const rows = Math.ceil(entries.length / columns);
  const cellW = outer.w / columns;
  const cellH = orientation === "horizontal" ? Math.min(64, outer.h / rows) : outer.h / rows;
  const parts = [];
  entries.forEach(({ series, point }, index) => {
    const cell = {
      x: outer.x + index % columns * cellW,
      y: outer.y + Math.floor(index / columns) * cellH,
      w: cellW,
      h: cellH
    };
    const min = point.min ?? 0;
    const max = point.max ?? (model.value.valueType === "percent" ? 100 : Math.max(100, point.value ?? 0));
    const value = point.value ?? 0;
    const fraction = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
    const color = point.color ?? series.color ?? thresholdColor(series, value) ?? PALETTE[0];
    const shown = model.value.valueType === "percent" ? formatValue(fraction, { format: "percent", decimalPlaces: model.value.decimalPlaces ?? 0 }) : formatValue(value, model.value);
    const tip = tooltip(model, series, point, shown, [
      `Range	${formatValue(min, model.value)} \u2013 ${formatValue(max, model.value)}`
    ]);
    const label = point.group || series.name;
    if (orientation === "horizontal") {
      const barY = cell.y + 22;
      const barH = Math.min(18, cell.h - 30);
      const trackW = cell.w - 70;
      parts.push(
        textEl(cell.x + 4, cell.y + 10, truncate(label, trackW), { cls: "ajc-tick" }),
        model.gauge.plotArea ? `<rect class="ajc-gauge-track" x="${fixed(cell.x + 4)}" y="${fixed(barY)}" width="${fixed(trackW)}" height="${fixed(barH)}" rx="${fixed(barH / 2)}"/>` : "",
        linked(
          `<rect class="ajc-gauge-value" x="${fixed(cell.x + 4)}" y="${fixed(barY)}" width="${fixed(Math.max(barH, trackW * fraction))}" height="${fixed(barH)}" rx="${fixed(barH / 2)}" fill="${esc(color)}"${tip}/>`,
          point.link
        ),
        model.gauge.showValue ? textEl(cell.x + trackW + 12, barY + barH / 2, shown, { cls: "ajc-gauge-text", size: 14 }) : ""
      );
      return;
    }
    if (orientation === "vertical") {
      const barW = Math.min(28, cell.w * 0.35);
      const trackH = cell.h - 44;
      const x = cell.x + cell.w / 2 - barW / 2;
      const filled = Math.max(barW, trackH * fraction);
      parts.push(
        model.gauge.plotArea ? `<rect class="ajc-gauge-track" x="${fixed(x)}" y="${fixed(cell.y + 4)}" width="${fixed(barW)}" height="${fixed(trackH)}" rx="${fixed(barW / 2)}"/>` : "",
        linked(
          `<rect class="ajc-gauge-value" x="${fixed(x)}" y="${fixed(cell.y + 4 + trackH - filled)}" width="${fixed(barW)}" height="${fixed(filled)}" rx="${fixed(barW / 2)}" fill="${esc(color)}"${tip}/>`,
          point.link
        ),
        model.gauge.showValue ? textEl(cell.x + cell.w / 2, cell.y + trackH + 18, shown, {
          anchor: "middle",
          cls: "ajc-gauge-text",
          size: 14
        }) : "",
        textEl(cell.x + cell.w / 2, cell.y + trackH + 34, truncate(label, cell.w - 8), {
          anchor: "middle",
          cls: "ajc-tick"
        })
      );
      return;
    }
    const extent = Math.max(1, Math.min(360, model.gauge.angleExtent));
    const start = -model.gauge.startAngle * Math.PI / 180;
    const sweep = extent * Math.PI / 180;
    const partial = extent < 360;
    const available = cell.h - 22;
    const r = Math.max(
      12,
      Math.min(cell.w / 2 - 6, partial && extent <= 180 ? available * 0.9 : available / 2 - 4)
    );
    const cx = cell.x + cell.w / 2;
    const cy = partial && extent <= 180 ? cell.y + 6 + r : cell.y + 4 + r;
    const inner = r * Math.max(0, Math.min(0.95, model.gauge.innerRadius));
    if (model.gauge.plotArea)
      parts.push(`<path class="ajc-gauge-track" d="${arcPath(cx, cy, r, inner, start, start + sweep)}"/>`);
    if (fraction > 0)
      parts.push(
        linked(
          `<path class="ajc-gauge-value" d="${arcPath(cx, cy, r, inner, start, start + sweep * fraction)}" fill="${esc(color)}"${tip}/>`,
          point.link
        )
      );
    else parts.push(`<circle cx="${fixed(cx)}" cy="${fixed(cy)}" r="${fixed(r)}" fill="transparent"${tip}/>`);
    for (const line of series.referenceLines) {
      const t = Math.max(0, Math.min(1, (line.value - min) / (max - min || 1)));
      const [x1, y1] = polar(cx, cy, inner - 2, start + sweep * t);
      const [x2, y2] = polar(cx, cy, r + 3, start + sweep * t);
      parts.push(
        `<line class="ajc-reference" x1="${fixed(x1)}" y1="${fixed(y1)}" x2="${fixed(x2)}" y2="${fixed(y2)}"${attr("stroke", line.color)}/>`
      );
    }
    if (model.gauge.showValue)
      parts.push(
        textEl(cx, partial && extent <= 180 ? cy - inner * 0.3 : cy, shown, {
          anchor: "middle",
          cls: "ajc-gauge-text",
          size: Math.max(12, Math.min(28, inner * 0.45))
        })
      );
    parts.push(
      textEl(
        cx,
        Math.min(cell.y + cell.h - 8, cy + (partial && extent <= 180 ? 16 : r + 14)),
        truncate(label, cell.w - 8),
        {
          anchor: "middle",
          cls: "ajc-tick"
        }
      )
    );
  });
  return `<g class="ajc-plot ajc-gauge">${parts.join("")}</g>`;
}
function thresholdColor(series, value) {
  const sorted2 = [...series.referenceLines].filter((line) => line.color).sort((a, b) => a.value - b.value);
  return sorted2.find((line) => value <= line.value)?.color;
}
function scatter(model, outer) {
  const items = model.series.map((series) => ({
    name: series.name,
    color: seriesColor(model, series),
    shape: "circle"
  }));
  const { svg: legendSvg, plot: area } = legend(model, items, outer, false);
  const points = model.series.flatMap(
    (series) => series.points.map((point) => ({
      series,
      point,
      x: point.x ?? (Number.isFinite(Number(point.group)) ? Number(point.group) : void 0),
      y: point.y ?? point.value ?? void 0,
      z: point.z
    }))
  );
  const valid = points.filter((entry) => entry.x !== void 0 && entry.y !== void 0);
  const xScale = valueScale(
    valid.map((entry) => entry.x),
    model.axes.x,
    false
  );
  const yScale = valueScale(
    valid.map((entry) => entry.y),
    model.axes.y,
    false
  );
  const xTicks = scaleTicks(xScale);
  const yTicks = scaleTicks(yScale);
  const yLabels = yTicks.map((value) => formatTick(value, model.axes.y.format, yScale.step));
  const left = Math.max(...yLabels.map((label) => textWidth(label))) + 10 + (model.axes.y.title ? 20 : 0);
  const bottom = 22 + (model.axes.x.title ? 20 : 0);
  const plot = { x: area.x + left, y: area.y + 8, w: area.w - left - 12, h: area.h - bottom - 8 };
  const px = (value) => project(xScale, value, plot.x, plot.w);
  const py = (value) => plot.y + plot.h - project(yScale, value, 0, plot.h);
  const out = [];
  yTicks.forEach((value, index) => {
    out.push(
      `<line class="ajc-grid" x1="${fixed(plot.x)}" y1="${fixed(py(value))}" x2="${fixed(plot.x + plot.w)}" y2="${fixed(py(value))}"/>`,
      textEl(plot.x - 6, py(value), yLabels[index], { anchor: "end", cls: "ajc-tick" })
    );
  });
  xTicks.forEach((value) => {
    out.push(
      `<line class="ajc-grid" x1="${fixed(px(value))}" y1="${fixed(plot.y)}" x2="${fixed(px(value))}" y2="${fixed(plot.y + plot.h)}"/>`,
      textEl(px(value), plot.y + plot.h + 12, formatTick(value, model.axes.x.format, xScale.step), {
        anchor: "middle",
        cls: "ajc-tick"
      })
    );
  });
  out.push(
    `<line class="ajc-axis" x1="${fixed(plot.x)}" y1="${fixed(plot.y + plot.h)}" x2="${fixed(plot.x + plot.w)}" y2="${fixed(plot.y + plot.h)}"/>`
  );
  if (model.axes.x.title)
    out.push(
      textEl(plot.x + plot.w / 2, area.y + area.h - 8, model.axes.x.title, {
        anchor: "middle",
        cls: "ajc-axis-title"
      })
    );
  if (model.axes.y.title)
    out.push(
      textEl(area.x + 8, plot.y + plot.h / 2, model.axes.y.title, {
        anchor: "middle",
        cls: "ajc-axis-title",
        rotate: -90
      })
    );
  const bubble = model.type === "bubble";
  const zMax = Math.max(...valid.map((entry) => Math.abs(entry.z ?? 0)), 1);
  const rMax = Math.max(8, Math.min(plot.w, plot.h) * 0.09);
  const marks = valid.map(({ series, point, x, y, z }) => {
    const color = point.color ?? seriesColor(model, series);
    const r = bubble ? Math.max(3, Math.sqrt(Math.abs(z ?? 0) / zMax) * rMax) : 5;
    const formatted = `${formatValue(x, model.axes.x.format)}, ${formatValue(y, model.axes.y.format)}`;
    const extra = bubble && z !== void 0 ? [`Z	${formatValue(z, model.value)}`] : [];
    const label = series.label.show && series.label.position !== "none" ? textEl(px(x), py(y) - r - 7, dataLabel(series, point, formatted, model), {
      anchor: "middle",
      cls: "ajc-value",
      size: 11
    }) : "";
    return linked(
      `<circle class="ajc-bubble" cx="${fixed(px(x))}" cy="${fixed(py(y))}" r="${fixed(r)}" fill="${esc(color)}" fill-opacity="${bubble ? 0.7 : 1}"${tooltip(model, series, point, formatted, extra)}/>`,
      point.link
    ) + label;
  }).join("");
  return `<g class="ajc-plot">${out.join("")}<g class="ajc-series">${marks}</g></g>${legendSvg}`;
}
function radar(model, outer) {
  const items = model.series.map((series) => ({
    name: series.name,
    color: seriesColor(model, series),
    shape: isArea(series) || isBar(series) ? "square" : "line"
  }));
  const { svg: legendSvg, plot } = legend(model, items, outer, true);
  const groups = model.groups;
  const n = Math.max(1, groups.length);
  const labelSpace = Math.min(90, Math.max(...groups.map((group2) => textWidth(group2)), 20) + 8);
  const r = Math.max(20, Math.min(plot.w / 2 - labelSpace, plot.h / 2 - 22));
  const cx = plot.x + plot.w / 2;
  const cy = plot.y + plot.h / 2;
  const values = model.series.flatMap((series) => series.points.map((point) => point.value ?? 0));
  const scale = niceScale(Math.min(0, ...values), Math.max(...values, 1), {
    min: model.axes.y.min,
    max: model.axes.y.max,
    step: model.axes.y.step,
    ticks: 4
  });
  const angle = (index) => -Math.PI / 2 + index / n * Math.PI * 2;
  const radius = (value) => (value - scale.min) / (scale.max - scale.min || 1) * r;
  const out = [];
  const circular = model.type === "polar";
  for (const tick of ticks(scale).slice(1)) {
    const tr = radius(tick);
    out.push(
      circular || n < 3 ? `<circle class="ajc-grid" cx="${fixed(cx)}" cy="${fixed(cy)}" r="${fixed(tr)}" fill="none"/>` : `<polygon class="ajc-grid" fill="none" points="${groups.map((_, index) => polar(cx, cy, tr, angle(index)).map(fixed).join(",")).join(" ")}"/>`,
      textEl(cx + 3, cy - tr, formatTick(tick, model.axes.y.format, scale.step), {
        cls: "ajc-tick",
        size: 10
      })
    );
  }
  groups.forEach((group2, index) => {
    const [x, y] = polar(cx, cy, r, angle(index));
    const [lx, ly] = polar(cx, cy, r + 12, angle(index));
    const cos = Math.cos(angle(index));
    out.push(
      `<line class="ajc-grid" x1="${fixed(cx)}" y1="${fixed(cy)}" x2="${fixed(x)}" y2="${fixed(y)}"/>`,
      textEl(lx, ly, truncate(groupLabel(model, group2), labelSpace - 8), {
        anchor: Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end",
        cls: "ajc-tick"
      })
    );
  });
  for (const series of model.series) {
    const color = seriesColor(model, series);
    const coordinates = groups.map((group2, index) => {
      const point = series.points.find((entry) => entry.group === group2);
      const value = point?.value ?? scale.min;
      const [x, y] = polar(cx, cy, radius(Math.max(scale.min, value)), angle(index));
      return { x, y, point, value };
    });
    if (isBar(series)) {
      const width = Math.PI * 2 / n * 0.7;
      out.push(
        coordinates.map(
          (entry, index) => entry.point ? linked(
            `<path class="ajc-slice" d="${arcPath(cx, cy, Math.max(0.5, radius(entry.value)), 0, angle(index) - width / 2, angle(index) + width / 2)}" fill="${esc(entry.point.color ?? color)}" fill-opacity="0.85"${tooltip(model, series, entry.point, formatValue(entry.point.value, model.axes.y.format))}/>`,
            entry.point.link
          ) : ""
        ).join("")
      );
      continue;
    }
    const pointsAttr = coordinates.map((entry) => `${fixed(entry.x)},${fixed(entry.y)}`).join(" ");
    out.push(
      `<polygon class="ajc-line" points="${pointsAttr}" fill="${isArea(series) ? esc(color) : "none"}" fill-opacity="${series.type === "area" ? 0.5 : 0.2}" stroke="${esc(color)}" stroke-width="${series.line.width}" stroke-linejoin="round"/>`
    );
    for (const entry of coordinates) {
      if (!entry.point) continue;
      out.push(
        linked(
          `<g class="ajc-point"${tooltip(model, series, entry.point, formatValue(entry.point.value, model.axes.y.format))}><circle class="ajc-hit" cx="${fixed(entry.x)}" cy="${fixed(entry.y)}" r="9" fill="transparent"/><circle class="ajc-hover" cx="${fixed(entry.x)}" cy="${fixed(entry.y)}" r="4" fill="${esc(color)}"/></g>`,
          entry.point.link
        )
      );
    }
  }
  return `<g class="ajc-plot ajc-radar">${out.join("")}</g>${legendSvg}`;
}

// packages/core/src/preview/extensions/charts/map.ts
var esc2 = escapeHtml;
var fixed2 = (value) => Number(value.toFixed(2));
function geometry(value) {
  let json3 = value;
  if (typeof value === "string") {
    try {
      json3 = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!json3 || typeof json3 !== "object") return [];
  const object = json3;
  const coordinates = object.coordinates;
  switch (object.type) {
    case "Feature":
      return geometry(object.geometry);
    case "FeatureCollection":
      return (object.features ?? []).flatMap(geometry);
    case "GeometryCollection":
      return (object.geometries ?? []).flatMap(geometry);
    case "Point":
      return [{ kind: "point", parts: [[coordinates]] }];
    case "MultiPoint":
      return coordinates.map((point) => ({ kind: "point", parts: [[point]] }));
    case "LineString":
      return [{ kind: "line", parts: [coordinates] }];
    case "MultiLineString":
      return [{ kind: "line", parts: coordinates }];
    case "Polygon":
      return [{ kind: "polygon", parts: coordinates }];
    case "MultiPolygon":
      return coordinates.map((rings) => ({ kind: "polygon", parts: rings }));
    default:
      return [];
  }
}
var mercator = ([lon, lat]) => {
  const clamped = Math.max(-85, Math.min(85, lat));
  return [lon, Math.log(Math.tan(Math.PI / 4 + clamped * Math.PI / 360)) * 180 / Math.PI];
};
function renderMap(renderer, ctx, region) {
  const layers = [];
  const features2 = [];
  const definitions = region.children.filter((child) => child.type === "layer").sort((a, b) => num(a.props, "layout.sequence", 0) - num(b.props, "layout.sequence", 0));
  for (const definition of definitions) {
    if (!renderer.condition(ctx, definition.props)) continue;
    const index = layers.length;
    const type = str(definition.props, "layerType", "points");
    const color = str(definition.props, "appearance.fillColor") || PALETTE[index % PALETTE.length];
    const layer = {
      name: str(definition.props, "name", definition.id),
      type,
      color: color.includes("&") ? PALETTE[index % PALETTE.length] : color,
      stroke: str(definition.props, "appearance.strokeColor") || color,
      count: 0
    };
    layers.push(layer);
    if (type === "heatMap" || type === "extrudedPolygons")
      renderer.diagnose(
        "info",
        `Map layer ${definition.id} (${type}) is drawn as plain ${type === "heatMap" ? "points" : "polygons"} locally`,
        ctx.pageId,
        region.id
      );
    const location = str(definition.props, "source.location");
    const sql = location === "regionSource" || !isObject(definition.props.source) ? renderer.regionSql(ctx, region) : renderer.regionSql(ctx, definition);
    if (!sql) {
      layer.error = "no SQL source";
      continue;
    }
    const result = renderer.query(
      ctx,
      region,
      sql,
      num(definition.props, "performance.maxRowsToProcess", 0) || 5e3
    );
    if (result.error) {
      layer.error = result.error;
      continue;
    }
    const column = (key) => str(definition.props, `columnMapping.${key}`).toUpperCase();
    const dataType = str(definition.props, "columnMapping.geometryColumnDataType", "longitudeLatitude");
    const lon = column("longitudeColumn");
    const lat = column("latitudeColumn");
    const geometryColumn = column("geojsonColumn") || column("geometryColumn");
    const tooltipColumn = str(definition.props, "tooltip.column").toUpperCase();
    const titleColumn = str(definition.props, "infoWindow.titleColumn").toUpperCase();
    const labelColumn = str(definition.props, "label.label");
    const target2 = get(definition.props, "link.target");
    if (dataType === "sdoGeometry")
      renderer.diagnose(
        "warning",
        `Map layer ${definition.id} uses SDO_GEOMETRY; only GeoJSON text in that column can be drawn locally`,
        ctx.pageId,
        region.id
      );
    for (const row of result.rows) {
      const shapes = dataType === "longitudeLatitude" ? Number.isFinite(Number(row[lon])) && Number.isFinite(Number(row[lat])) && row[lon] !== null && row[lat] !== null ? [{ kind: "point", parts: [[[Number(row[lon]), Number(row[lat])]]] }] : [] : geometry(row[geometryColumn]);
      if (!shapes.length) continue;
      const label = tooltipColumn && String(row[tooltipColumn] ?? "") || titleColumn && String(row[titleColumn] ?? "") || labelColumn && rowSubstitute(labelColumn.includes("&") ? labelColumn : `&${labelColumn}.`, row) || "";
      const link = target2 === void 0 ? void 0 : renderer.link(ctx, substituteDeep(target2, row), row);
      for (const shape of shapes) features2.push({ layer: index, ...shape, label, link });
      layer.count += 1;
    }
  }
  renderer.diagnose(
    "info",
    `Map ${region.id} is drawn offline on a plain canvas; background map tiles are not loaded`,
    ctx.pageId,
    region.id
  );
  return mapHtml(
    region,
    renderer.regionDomId(region),
    layers,
    features2,
    num(region.props, "appearance.height", 0) || 420
  );
}
function mapHtml(region, domId, layers, features2, height) {
  const width = 800;
  const all = features2.flatMap((feature) => feature.parts.flat()).filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  const summary = layers.map(
    (layer) => `<li><span class="apex-local-map-swatch" style="background:${esc2(layer.color)}"></span>${esc2(layer.name)} <span class="apex-local-map-count">${layer.error ? `(${esc2(truncate(layer.error, 120))})` : `${layer.count} ${layer.type}`}</span></li>`
  ).join("");
  const note = `<div class="apex-local-map-note"><span class="fa fa-map-o" aria-hidden="true"></span> Offline map preview: background tiles are not loaded.</div>`;
  if (!all.length) {
    return `<div class="apex-local-map" id="${esc2(domId)}_map">${note}<div class="apex-local-unsupported">No mappable rows${layers.length ? "" : " (the map has no layers)"}.</div><ul class="apex-local-map-layers">${summary}</ul></div>`;
  }
  const projected = all.map(mercator);
  let minX = Math.min(...projected.map((point) => point[0]));
  let maxX = Math.max(...projected.map((point) => point[0]));
  let minY = Math.min(...projected.map((point) => point[1]));
  let maxY = Math.max(...projected.map((point) => point[1]));
  const padX = Math.max((maxX - minX) * 0.08, 0.5);
  const padY = Math.max((maxY - minY) * 0.08, 0.5);
  minX -= padX;
  maxX += padX;
  minY -= padY;
  maxY += padY;
  const scale = Math.min(width / (maxX - minX), height / (maxY - minY));
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;
  const toScreen = (position2) => {
    const [x, y] = mercator(position2);
    return [offsetX + (x - minX) * scale, height - (offsetY + (y - minY) * scale)];
  };
  const grid = [];
  const lonScale = niceScale(minX, maxX, { ticks: 6, includeZero: false });
  for (const lon of ticks(lonScale)) {
    const [x] = toScreen([lon, 0]);
    if (x < 0 || x > width) continue;
    grid.push(
      `<line class="ajc-grid" x1="${fixed2(x)}" y1="0" x2="${fixed2(x)}" y2="${height}"/><text class="ajc-tick" x="${fixed2(x + 3)}" y="${height - 6}" font-size="10">${esc2(`${Math.abs(lon)}\xB0${lon < 0 ? "W" : lon > 0 ? "E" : ""}`)}</text>`
    );
  }
  const latitudes = [minY, maxY].map((y) => Math.atan(Math.sinh(y * Math.PI / 180)) * 180 / Math.PI);
  const latScale = niceScale(latitudes[0], latitudes[1], { ticks: 5, includeZero: false });
  for (const lat of ticks(latScale)) {
    const [, y] = toScreen([0, lat]);
    if (y < 0 || y > height) continue;
    grid.push(
      `<line class="ajc-grid" x1="0" y1="${fixed2(y)}" x2="${width}" y2="${fixed2(y)}"/><text class="ajc-tick" x="4" y="${fixed2(y - 3)}" font-size="10">${esc2(`${Math.abs(lat)}\xB0${lat < 0 ? "S" : lat > 0 ? "N" : ""}`)}</text>`
    );
  }
  const shapes = features2.map((feature) => {
    const layer = layers[feature.layer];
    const tip = feature.label ? ` data-tip="${esc2(`${layer.name}	${feature.label}`)}"` : ` data-tip="${esc2(layer.name)}"`;
    let markup;
    if (feature.kind === "point") {
      const [x, y] = toScreen(feature.parts[0][0]);
      markup = `<circle class="apex-local-map-point" cx="${fixed2(x)}" cy="${fixed2(y)}" r="6" fill="${esc2(layer.color)}"${tip}/>`;
    } else {
      const d = feature.parts.map(
        (part2) => part2.map((position2, index) => {
          const [x, y] = toScreen(position2);
          return `${index ? "L" : "M"}${fixed2(x)} ${fixed2(y)}`;
        }).join("") + (feature.kind === "polygon" ? "Z" : "")
      ).join("");
      markup = feature.kind === "polygon" ? `<path class="apex-local-map-shape" d="${d}" fill="${esc2(layer.color)}" fill-opacity="0.35" stroke="${esc2(layer.stroke)}" stroke-width="1.5" fill-rule="evenodd"${tip}/>` : `<path class="apex-local-map-shape" d="${d}" fill="none" stroke="${esc2(layer.stroke)}" stroke-width="3"${tip}/>`;
    }
    return feature.link ? `<a href="${esc2(feature.link)}">${markup}</a>` : markup;
  }).join("");
  const labelled = features2.filter((feature) => feature.label).slice(0, 40);
  const items = labelled.map((feature) => {
    const layer = layers[feature.layer];
    const [lon, lat] = feature.parts[0][0];
    const text5 = esc2(feature.label);
    return `<li><span class="apex-local-map-swatch" style="background:${esc2(layer.color)}"></span>${feature.link ? `<a href="${esc2(feature.link)}">${text5}</a>` : text5} <span class="apex-local-map-count">${lat.toFixed(3)}, ${lon.toFixed(3)}</span></li>`;
  }).join("");
  const more = features2.filter((feature) => feature.label).length - labelled.length;
  return `<div class="apex-local-map" id="${esc2(domId)}_map" data-map-region="${esc2(region.id)}">${note}<svg xmlns="http://www.w3.org/2000/svg" class="apex-local-map-canvas" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc2(str(region.props, "name", region.id))}"><rect class="apex-local-map-bg" x="0" y="0" width="${width}" height="${height}"/>${grid.join("")}${shapes}</svg><ul class="apex-local-map-layers">${summary}</ul>${items ? `<ul class="apex-local-map-features">${items}${more > 0 ? `<li class="apex-local-map-count">\u2026 ${more} more</li>` : ""}</ul>` : ""}</div>`;
}

// packages/core/src/preview/extensions/charts.ts
var DEFAULT_WIDTH = 640;
var UNSUPPORTED_TYPES = /* @__PURE__ */ new Set(["gantt", "boxPlot"]);
function chartBody(renderer, ctx, region, width) {
  const model = chartModel(renderer, ctx, region);
  return renderChartSvg(model, width);
}
function renderChartRegion(renderer, ctx, region) {
  const type = str(region.props, "chart.type", "bar");
  const domId = renderer.regionDomId(region);
  if (UNSUPPORTED_TYPES.has(type)) {
    renderer.diagnose(
      "warning",
      `Chart ${region.id} (${type}) is not simulated; its data is drawn as a bar chart`,
      ctx.pageId,
      region.id
    );
  } else {
    renderer.diagnose(
      "info",
      `Chart ${region.id} (${type}) is drawn by the local SVG renderer, not Oracle JET`,
      ctx.pageId,
      region.id
    );
  }
  if (str(region.props, "componentAdvanced.initJavaScriptFunction"))
    renderer.diagnose(
      "info",
      `Chart ${region.id}: the initialization JavaScript function is not applied locally`,
      ctx.pageId,
      region.id
    );
  const model = chartModel(renderer, ctx, UNSUPPORTED_TYPES.has(type) ? asBar(region) : region);
  const maxWidth = model.maxWidth ? `max-width:${model.maxWidth}px;` : "";
  return `<div class="apex-local-jet a-JET-chart" id="${escapeHtml(domId)}_jet" data-chart-region="${escapeHtml(region.id)}" data-chart-type="${escapeHtml(type)}" data-width="${DEFAULT_WIDTH}" style="${maxWidth}min-height:${model.height}px">${renderChartSvg(model, DEFAULT_WIDTH)}</div>`;
}
function asBar(region) {
  return { ...region, props: { ...region.props, chart: { type: "bar" } } };
}
function findRegion(renderer, ctx, id) {
  return renderer.pageComponents(ctx, "region").find((candidate) => candidate.id === id || renderer.regionDomId(candidate) === id);
}
function routeContext(renderer, session, params, type) {
  const page = params.get("page") ?? "";
  if (!renderer.findPage(page)) return { status: 404, type: "text", body: `Page ${page} does not exist` };
  const ctx = renderer.prepare(session, page);
  const region = findRegion(renderer, ctx, params.get("region") ?? "");
  if (!region || str(region.props, "type") !== type)
    return {
      status: 404,
      type: "text",
      body: `No ${type} region ${params.get("region") ?? ""} on page ${page}`
    };
  return { ctx, region };
}
var parseRange = (value) => {
  if (!value) return void 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? void 0 : date;
};
registerExtension({
  name: "charts",
  regions: {
    chart: renderChartRegion,
    calendar: (renderer, ctx, region) => renderCalendar(renderer, ctx, region),
    map: (renderer, ctx, region) => renderMap(renderer, ctx, region)
  },
  routes: {
    /** Redraws a chart at the width the browser measured: `?page=&region=&width=`. */
    chart(renderer, session, request) {
      const found = routeContext(renderer, session, request.params, "chart");
      if (!("ctx" in found)) return found;
      const width = Math.max(160, Math.min(4e3, Number(request.params.get("width")) || DEFAULT_WIDTH));
      const type = str(found.region.props, "chart.type", "bar");
      const region = UNSUPPORTED_TYPES.has(type) ? asBar(found.region) : found.region;
      return { type: "html", body: chartBody(renderer, found.ctx, region, width) };
    },
    /** FullCalendar event feed: `?page=&region=&start=ISO&end=ISO`. */
    calendar(renderer, session, request) {
      const found = routeContext(renderer, session, request.params, "calendar");
      if (!("ctx" in found)) return found;
      const { events, error } = calendarEvents(renderer, found.ctx, found.region, {
        start: parseRange(request.params.get("start")),
        end: parseRange(request.params.get("end"))
      });
      if (error && !events.length) return { status: 500, type: "json", body: JSON.stringify({ error }) };
      return { type: "json", body: JSON.stringify(events) };
    }
  },
  page(renderer, ctx) {
    if (!renderer.pageComponents(ctx, "region").some((region) => str(region.props, "type") === "calendar"))
      return;
    const script = fullCalendarScript(renderer);
    if (script) ctx.jsFiles.add(script);
    else
      renderer.diagnose(
        "warning",
        "FullCalendar is missing from the preview assets; calendar events are listed instead",
        ctx.pageId
      );
  },
  client: CHARTS_JS,
  css: CHARTS_CSS
});

// packages/core/src/preview/extensions/components/plugins.ts
var text2 = (value) => typeof value === "string" ? value : value === void 0 || value === null ? "" : String(value);
var escapeMode = (value, fallback) => {
  const mode = text2(value).toUpperCase();
  return ["HTML", "ATTR", "RAW", "STRIPHTML", "JS", "URL"].find((entry) => entry === mode) ?? fallback;
};
var cache = /* @__PURE__ */ new WeakMap();
function componentIndex(calls) {
  const cached = cache.get(calls);
  if (cached) return cached;
  const index = { byApexlang: /* @__PURE__ */ new Map(), named: /* @__PURE__ */ new Map() };
  const plugins = /* @__PURE__ */ new Map();
  const groups = /* @__PURE__ */ new Map();
  const attributes = /* @__PURE__ */ new Map();
  for (const { kind, params } of calls) {
    if (kind === "plugin" && text2(params.plugin_type) === "TEMPLATE COMPONENT") {
      const name = text2(params.name);
      const component = {
        id: text2(params.id),
        name,
        applyName: name.replace(/^THEME_\d+\$/u, "THEME$"),
        apexlangName: text2(params.apexlang_name) || name.replace(/^THEME_\d+\$/u, "").toLowerCase(),
        displayName: text2(params.display_name) || name,
        supports: new Set(text2(params.supported_component_types).split(":").filter(Boolean)),
        standardAttributes: new Set(text2(params.standard_attributes).split(":").filter(Boolean)),
        partial: text2(params.partial_template),
        reportBody: text2(params.report_body_template),
        reportRow: text2(params.report_row_template),
        reportGroup: text2(params.report_group_template),
        defaultEscape: escapeMode(params.default_escape_mode, "HTML"),
        attributes: [],
        positions: [],
        actionTemplates: [],
        slots: []
      };
      plugins.set(component.id, component);
    } else if (kind === "plugin_attr_group") groups.set(text2(params.id), text2(params.apexlang_name));
  }
  for (const { kind, params } of calls) {
    const plugin = plugins.get(text2(params.plugin_id));
    if (kind === "plugin_attribute" && plugin) {
      const attribute = {
        id: text2(params.id),
        staticId: text2(params.static_id).toUpperCase(),
        apexlangName: text2(params.apexlang_name),
        scope: text2(params.attribute_scope) || "COMPONENT",
        type: text2(params.attribute_type),
        group: groups.get(text2(params.attribute_group_id)) || void 0,
        defaultValue: params.default_value === void 0 ? void 0 : text2(params.default_value),
        escape: escapeMode(params.escape_mode, plugin.defaultEscape),
        values: /* @__PURE__ */ new Map(),
        dependsOn: text2(params.depending_on_attribute_id) || void 0,
        dependsCondition: text2(params.depending_on_condition_type) || void 0,
        dependsExpression: params.depending_on_expression === void 0 ? void 0 : text2(params.depending_on_expression),
        columnTypes: text2(params.column_data_types) || void 0
      };
      plugin.attributes.push(attribute);
      attributes.set(attribute.id, attribute);
    } else if (kind === "plugin_act_position" && plugin)
      plugin.positions.push({
        staticId: text2(params.static_id).toUpperCase(),
        apexlangName: text2(params.apexlang_name),
        type: text2(params.type),
        templateId: text2(params.template_id) || void 0
      });
    else if (kind === "plugin_act_template" && plugin)
      plugin.actionTemplates.push({
        id: text2(params.id),
        apexlangName: text2(params.apexlang_name),
        type: text2(params.type),
        template: text2(params.template)
      });
    else if (kind === "plugin_slot" && plugin)
      plugin.slots.push({ placeholder: text2(params.placeholder), apexlangName: text2(params.apexlang_name) });
  }
  for (const { kind, params } of calls) {
    const attribute = kind === "plugin_attr_value" ? attributes.get(text2(params.plugin_attribute_id)) : void 0;
    if (attribute)
      attribute.values.set(
        text2(params.apexlang_name) || text2(params.return_value),
        text2(params.return_value)
      );
  }
  for (const component of plugins.values()) {
    component.attributes.sort((a, b) => a.staticId.localeCompare(b.staticId));
    index.byApexlang.set(component.apexlangName.toLowerCase(), component);
    if (component.partial)
      index.named.set(component.applyName, {
        template: component.partial,
        defaultEscape: component.defaultEscape,
        args: component.attributes.filter((attribute) => attribute.scope === "COMPONENT").map((attribute) => ({
          name: attribute.staticId,
          escape: attribute.escape,
          // Named-template calls only get defaults that do not depend on other attributes.
          default: attribute.dependsOn ? void 0 : attribute.defaultValue
        }))
      });
  }
  cache.set(calls, index);
  return index;
}

// packages/core/src/preview/extensions/components/template-component.ts
var SOURCE_TYPES = /* @__PURE__ */ new Set(["SESSION STATE VALUE", "MEDIA"]);
var strings2 = (values) => values.map((value) => typeof value === "string" ? value : isRef(value) ? value.ref : String(value));
function findComponent(renderer, name) {
  return componentIndex(renderer.assets.theme).byApexlang.get(name.toLowerCase());
}
function configured(owner2, attribute) {
  const paths = attribute.group ? [`plugin-${attribute.group}.${attribute.apexlangName}`, `settings.${attribute.apexlangName}`] : [`settings.${attribute.apexlangName}`];
  for (const path9 of paths) {
    const value = get(owner2.props, path9);
    if (value !== void 0) return value;
  }
  return void 0;
}
function stored(attribute, value) {
  if (typeof value === "boolean") return value ? "Y" : "N";
  if (Array.isArray(value)) return strings2(value).join(" ");
  if (isRef(value)) return value.ref;
  if (isObject(value)) {
    const pick = ["url", "urlColumn", "column", "blobColumn", "value"].find(
      (key) => typeof value[key] === "string"
    );
    return pick ? value[pick] : "";
  }
  if (attribute.type === "CHECKBOX")
    return /^(true|y|yes)$/iu.test(value) ? "Y" : /^(false|n|no)$/iu.test(value) ? "N" : value;
  return attribute.values.get(value) ?? value;
}
var ComponentRenderer = class {
  renderer;
  ctx;
  owner;
  component;
  domId;
  #byId = /* @__PURE__ */ new Map();
  #menuCount = 0;
  constructor(renderer, ctx, owner2, component, domId) {
    this.renderer = renderer;
    this.ctx = ctx;
    this.owner = owner2;
    this.component = component;
    this.domId = domId;
    for (const attribute of component.attributes) this.#byId.set(attribute.id, attribute);
  }
  get named() {
    return componentIndex(this.renderer.assets.theme).named;
  }
  warn = (message) => this.renderer.diagnose(
    "warning",
    `${this.component.displayName} ${this.owner.id}: ${message}`,
    this.ctx.pageId,
    this.owner.id
  );
  /** Configuration value before row substitution, honoring defaults and attribute dependencies. */
  setting(attribute, seen = /* @__PURE__ */ new Set()) {
    if (attribute.dependsOn && !seen.has(attribute.id)) {
      const parent = this.#byId.get(attribute.dependsOn);
      if (parent) {
        seen.add(attribute.id);
        const value2 = this.setting(parent, seen);
        const expected = attribute.dependsExpression ?? "";
        const holds = (() => {
          switch (attribute.dependsCondition) {
            case "NOT_NULL":
              return value2 !== "";
            case "NULL":
              return value2 === "";
            case "NOT_EQUALS":
              return value2 !== expected;
            case "IN_LIST":
              return expected.split(",").includes(value2);
            case "NOT_IN_LIST":
              return !expected.split(",").includes(value2);
            default:
              return value2 === expected;
          }
        })();
        if (!holds) return "";
      }
    }
    const value = configured(this.owner, attribute);
    if (value === void 0) return attribute.defaultValue ?? "";
    return stored(attribute, value);
  }
  /** Substitutes `&COLUMN.` (and `#COLUMN#`) row values and session state into an attribute value. */
  resolve(attribute, raw, row) {
    if (!raw) return "";
    const columnValue = (name) => {
      const key = name.toUpperCase();
      return row && key in row ? String(row[key] ?? "") : void 0;
    };
    if (SOURCE_TYPES.has(attribute.type) && /^[A-Za-z][\w$#]*$/u.test(raw)) {
      const value = columnValue(raw);
      if (value !== void 0) return value;
      if (row && attribute.type === "SESSION STATE VALUE")
        this.warn(`column ${raw.toUpperCase()} for ${attribute.apexlangName} is not in the source`);
    }
    const escape = attribute.escape === "RAW" ? "HTML" : "RAW";
    const replaced = raw.replace(
      /&(?:"([^"]+)"|([A-Za-z][\w$#]*))(?:!([A-Z]+))?\./gu,
      (whole, quoted, plain, filter) => {
        const value = columnValue(quoted ?? plain ?? "");
        return value === void 0 ? whole : escapeValue(value, filter ?? escape);
      }
    ).replace(/#([A-Z][A-Z0-9_$]*)(?:!([A-Z]+))?#/gu, (whole, name, filter) => {
      const value = columnValue(name);
      return value === void 0 ? whole : escapeValue(value, filter ?? escape);
    });
    return this.renderer.substitute(
      this.ctx.session,
      replaced,
      this.ctx.page,
      attribute.escape === "RAW" ? "HTML" : "RAW"
    );
  }
  attributes(scope, row) {
    const values = {};
    const escapes = {};
    for (const attribute of this.component.attributes) {
      if (attribute.scope !== scope) continue;
      const value = this.resolve(attribute, this.setting(attribute), row);
      values[attribute.staticId] = attribute.type === "ICON" && /(^|\s)fa-/u.test(value) && !/(^|\s)fa(\s|$)/u.test(value) ? `fa ${value}` : value;
      escapes[attribute.staticId] = attribute.escape;
    }
    return { values, escapes };
  }
  apply(template, values, escapes, defaultEscape = this.component.defaultEscape) {
    return applyTemplate(template, values, {
      escapes,
      defaultEscape,
      templates: (name) => this.named.get(name),
      warn: this.warn
    });
  }
  // ------------------------------------------------------------ actions
  actions() {
    return this.owner.children.filter((child) => child.type === "action").sort((a, b) => num(a.props, "layout.sequence", 0) - num(b.props, "layout.sequence", 0));
  }
  target(action, row) {
    const behavior = get(action.props, "behavior");
    if (!isObject(behavior)) return "";
    const type = str(behavior, "type", behavior.target !== void 0 ? "redirectThisApp" : "redirectUrl");
    if (type === "triggerAction") return "#";
    if (type === "redirectUrl" || behavior.targetUrl !== void 0) {
      const raw = str(behavior, "targetUrl");
      return this.resolve({ ...LINK_ATTRIBUTE }, raw, row);
    }
    return this.renderer.link(this.ctx, get(behavior, "target"), row, `apex.jQuery('#${this.domId}')`);
  }
  menu(action, row) {
    const id = `tc_menu_a${this.domId.replace(/\W/gu, "_")}_${this.#menuCount += 1}`;
    const entries = action.children.filter(
      (child) => child.type === "menu" && this.renderer.visible(this.ctx, child)
    );
    const render = (parent) => entries.filter((entry) => ref(entry.props, "parentMenu") === parent).sort((a, b) => num(a.props, "layout.sequence", 0) - num(b.props, "layout.sequence", 0)).map((entry) => {
      const type = str(entry.props, "type", "menuEntry");
      if (type === "separator") return '<li class="a-Menu-hSeparator" role="separator"></li>';
      const label = escapeValue(
        this.resolve({ ...TEXT_ATTRIBUTE }, str(entry.props, "label", entry.id), row),
        "HTML"
      );
      const icon3 = str(entry.props, "appearance.icon");
      const iconHtml = icon3 ? `<span class="${escapeValue(icon3, "ATTR")}"></span>` : "";
      if (type === "subMenu")
        return `<li>${iconHtml}<span>${label}</span><ul>${render(entry.id)}</ul></li>`;
      return `<li><a href="${escapeValue(this.target(entry, row), "ATTR")}" ${this.resolve({ ...TEXT_ATTRIBUTE }, str(entry.props, "behavior.linkAttributes"), row)}>${iconHtml}${label}</a></li>`;
    }).join("");
    return {
      id,
      html: `<div id="${id}" style="display:none" data-apex-local-menu><ul>${render(void 0)}</ul></div>`
    };
  }
  /** Placeholder values of the action positions for one row. */
  positions(row) {
    const values = {};
    const actions = this.actions();
    for (const position2 of this.component.positions) {
      const own = actions.filter(
        (action) => str(action.props, "position").toLowerCase() === position2.apexlangName.toLowerCase() && this.renderer.visible(this.ctx, action)
      );
      if (!own.length) continue;
      if (position2.type === "LINK") {
        const first = own[0];
        values[position2.staticId] = this.target(first, row);
        values[`${position2.staticId}_ATTR`] = this.resolve(
          { ...TEXT_ATTRIBUTE },
          str(first.props, "behavior.linkAttributes"),
          row
        );
        continue;
      }
      values[position2.staticId] = own.map((action) => {
        const name = str(action.props, "template").toLowerCase();
        const template = this.component.actionTemplates.find((entry) => entry.apexlangName.toLowerCase() === name) ?? this.component.actionTemplates.find((entry) => entry.id === position2.templateId) ?? this.component.actionTemplates.find(
          (entry) => entry.type === (action.children.length ? "MENU" : "BUTTON")
        );
        if (!template) {
          this.warn(`no action template for ${position2.apexlangName}`);
          return "";
        }
        const displayType = str(action.props, "appearance.displayType", "text");
        const isMenu = template.type === "MENU";
        const menu = isMenu ? this.menu(action, row) : void 0;
        const values2 = {
          LABEL: this.resolve({ ...TEXT_ATTRIBUTE }, str(action.props, "label", action.id), row),
          LINK_URL: isMenu ? "" : this.target(action, row),
          LINK_ATTR: this.resolve({ ...TEXT_ATTRIBUTE }, str(action.props, "behavior.linkAttributes"), row),
          ICON_CLASSES: displayType === "text" ? "" : str(action.props, "appearance.icon"),
          CSS_CLASSES: strings2(list(action.props, "appearance.cssClasses")).join(" "),
          IS_HOT: bool(action.props, "appearance.hot", false) ? "Y" : "N",
          IS_ICON_ONLY: displayType === "icon" ? "Y" : "N",
          IS_DISABLED: bool(action.props, "appearance.showAsDisabled", false) ? "Y" : "N",
          MENU_ID: menu?.id ?? "",
          MENU: menu?.html ?? ""
        };
        if (menu) this.ctx.onload.push(`apex.jQuery('#${menu.id}').menu({owningRegion:'${this.domId}'});`);
        return this.apply(
          template.template,
          values2,
          { MENU: "RAW", LINK_ATTR: "RAW", LABEL: "RAW" },
          "HTML"
        );
      }).join("");
    }
    return values;
  }
  // ------------------------------------------------------------ rendering
  builtins() {
    return {
      APEX$DOM_ID: this.domId,
      APEX$IS_LAZY_LOADING: "",
      APEX$SELECTOR: "",
      APEX$HAS_MESSAGE: "",
      APEX$COMPONENT_CSS_CLASSES: [
        templateOptions(strings2(list(this.owner.props, "componentAppearance.templateOptions")), ""),
        strings2(list(this.owner.props, "componentAppearance.cssClasses")).join(" ")
      ].filter(Boolean).join(" ")
    };
  }
  partial(row, extra = {}, domSuffix = "") {
    const report2 = this.attributes("REPORT", void 0);
    const own = this.attributes("COMPONENT", row);
    const values = { ...this.builtins(), ...report2.values, ...own.values, ...this.positions(row), ...extra };
    if (domSuffix) values.APEX$DOM_ID = `${this.domId}${domSuffix}`;
    return this.apply(this.component.partial, values, {
      ...report2.escapes,
      ...own.escapes,
      ...EXTRA_ESCAPES
    });
  }
  rows() {
    let sql = this.renderer.regionSql(this.ctx, this.owner);
    if (!sql) {
      const location = str(this.owner.props, "source.location");
      if (location && location !== "localDatabase")
        this.renderer.diagnose(
          "info",
          `Template component ${this.owner.id}: source location ${location} is not simulated`,
          this.ctx.pageId,
          this.owner.id
        );
      return void 0;
    }
    const orderBy2 = str(this.owner.props, "orderBy.orderByClause");
    if (orderBy2) sql = `select * from (${sql}) order by ${orderBy2}`;
    const result = this.renderer.query(this.ctx, this.owner, sql);
    return result.error ? { rows: [], error: result.error } : { rows: result.rows };
  }
  rowId(row) {
    const key = this.owner.children.find(
      (child) => child.type === "column" && bool(child.props, "source.primaryKey", false)
    );
    const value = key ? row[key.id.toUpperCase()] : void 0;
    return value === void 0 || value === null ? "" : String(value);
  }
  report(rows, pagination2) {
    const report2 = this.attributes("REPORT", void 0);
    const groupColumns = this.owner.children.filter((child) => child.type === "column" && bool(child.props, "appearance.group", false)).map((child) => child.id.toUpperCase());
    const rowHtml = (row, index) => {
      const id = this.rowId(row);
      return this.apply(
        this.component.reportRow || "<li #APEX$ROW_IDENTIFICATION#>#APEX$PARTIAL#</li>",
        {
          ...this.builtins(),
          ...report2.values,
          APEX$ROW_IDENTIFICATION: `data-id="${escapeValue(id || String(index + 1), "ATTR")}"`,
          APEX$PARTIAL: this.partial(row, {}, `_${index + 1}`)
        },
        { ...report2.escapes, ...EXTRA_ESCAPES }
      );
    };
    let body3 = "";
    if (groupColumns.length && this.component.reportGroup) {
      let start = 0;
      let groupIndex = 0;
      const key = (row) => groupColumns.map((column) => String(row[column] ?? "")).join("");
      while (start < rows.length) {
        let end = start + 1;
        while (end < rows.length && key(rows[end]) === key(rows[start])) end += 1;
        const group2 = this.attributes("REPORT_GROUP", rows[start]);
        groupIndex += 1;
        body3 += this.apply(
          this.component.reportGroup,
          {
            ...this.builtins(),
            ...report2.values,
            ...group2.values,
            APEX$DOM_ID: `${this.domId}_group${groupIndex}`,
            APEX$GROUP_IDENTIFICATION: `data-group-id="${escapeValue(key(rows[start]).replaceAll("", "_"), "ATTR")}"`,
            APEX$ROWS: rows.slice(start, end).map((row, offset) => rowHtml(row, start + offset)).join("\n")
          },
          { ...report2.escapes, ...group2.escapes, ...EXTRA_ESCAPES }
        );
        start = end;
      }
    } else {
      if (groupColumns.length) this.warn("grouping is not supported by this template component");
      body3 = rows.map(rowHtml).join("\n");
    }
    return this.apply(
      this.component.reportBody || "<ul>#APEX$ROWS#</ul>",
      { ...this.builtins(), ...report2.values, APEX$ROWS: body3 },
      { ...report2.escapes, ...EXTRA_ESCAPES }
    ) + pagination2;
  }
};
var TEXT_ATTRIBUTE = {
  id: "",
  staticId: "",
  apexlangName: "",
  scope: "COMPONENT",
  type: "TEXT",
  escape: "RAW",
  values: /* @__PURE__ */ new Map()
};
var LINK_ATTRIBUTE = { ...TEXT_ATTRIBUTE, type: "LINK", escape: "ATTR" };
var EXTRA_ESCAPES = {
  APEX$ROWS: "RAW",
  APEX$PARTIAL: "RAW",
  APEX$SELECTOR: "RAW",
  APEX$ROW_IDENTIFICATION: "RAW",
  APEX$GROUP_IDENTIFICATION: "RAW",
  APEX$COMPONENT_CSS_CLASSES: "ATTR",
  APEX$DOM_ID: "ATTR",
  BODY: "RAW",
  PRIMARY_ACTIONS: "RAW",
  ACTIONS: "RAW",
  FULL_ROW_LINK_ATTR: "RAW",
  TITLE_LINK_ATTR: "RAW",
  AVATAR_LINK_ATTR: "RAW",
  BADGE_LINK_ATTR: "RAW",
  USER_NAME_LINK_ATTR: "RAW",
  LINK_ATTR: "RAW"
};
function renderTemplateComponentRegion(renderer, ctx, region) {
  const type = str(region.props, "type");
  const name = type.split("/")[1] ?? "";
  const component = findComponent(renderer, name);
  if (!component) {
    renderer.diagnose(
      "warning",
      `Template component ${name} (${region.id}) is not in the theme; nothing is rendered`,
      ctx.pageId,
      region.id
    );
    return "";
  }
  const domId = renderer.regionDomId(region);
  const tc = new ComponentRenderer(renderer, ctx, region, component, domId);
  const display = displayMode(region, component);
  if (display === "regionOnly") return "";
  ctx.clientConfig.regions.push({ id: domId, kind: "templateComponent" });
  if (str(region.props, "rowSelection.type"))
    renderer.diagnose(
      "info",
      `Template component ${region.id}: row selection is not simulated`,
      ctx.pageId,
      region.id
    );
  const source = tc.rows();
  if (source?.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeValue(source.error, "HTML")}</div></div>`;
  if (display === "partial") return tc.partial(source?.rows[0]);
  const rows = source?.rows ?? [];
  if (!rows.length) {
    const message = renderer.substitute(
      ctx.session,
      str(region.props, "messages.whenNoDataFound", "No data found."),
      ctx.page,
      "HTML"
    );
    const icon3 = str(region.props, "messages.noDataFoundIcon", "fa-search");
    return `<div class="a-TMV--noData"><div class="a-TMV-noDataMessage"><span class="a-Icon ${escapeValue(icon3.startsWith("fa-") ? `fa ${icon3}` : icon3, "ATTR")}" aria-hidden="true"></span><span class="a-TMV-noDataMessage-text">${message}</span></div></div>`;
  }
  const paged = str(region.props, "pagination.type", "page") === "page";
  const perPage = paged ? num(region.props, "pagination.entitiesPerPage", 15) : num(region.props, "pagination.initialEntitiesCount", 50);
  const pageNumber = Math.max(1, ctx.session.pagination[`${ctx.pageId}:${region.id}`] ?? 1);
  const shown = rows.slice((pageNumber - 1) * perPage, pageNumber * perPage);
  const first = (pageNumber - 1) * perPage + 1;
  const last = first + shown.length - 1;
  const button = (target2, label) => `<button type="button" class="t-Button t-Button--small t-Button--noUI" data-apex-local-page="${target2}" data-region="${escapeValue(domId, "ATTR")}">${label}</button>`;
  const pagination2 = rows.length > perPage ? `<div class="a-GV-footer apex-local-tc-pagination"><div class="a-GV-pageSelector">${pageNumber > 1 ? button(pageNumber - 1, '<span class="a-Icon icon-left-arrow" aria-hidden="true"></span> Previous') : ""}<span class="a-GV-pageRange">${first} - ${last}${bool(region.props, "pagination.showTotalCount", false) ? ` of ${rows.length}` : ""}</span>${last < rows.length ? button(pageNumber + 1, 'Next <span class="a-Icon icon-right-arrow" aria-hidden="true"></span>') : ""}</div></div>` : "";
  if (!paged && rows.length > perPage)
    renderer.diagnose(
      "info",
      `Template component ${region.id}: infinite scrolling is rendered as page pagination`,
      ctx.pageId,
      region.id
    );
  return tc.report(shown, pagination2);
}
function displayMode(region, component) {
  const display = str(region.props, "componentAppearance.display");
  if (display === "partial" || display === "report" || display === "regionOnly") return display;
  if (component.supports.has("REGION_ONLY") && !component.supports.has("PARTIAL")) return "regionOnly";
  return component.supports.has("REPORT") ? "report" : "partial";
}
function wrapRegionOnly(renderer, ctx, region, values, children) {
  const name = str(region.props, "type").split("/")[1] ?? "";
  const component = findComponent(renderer, name);
  if (!component || displayMode(region, component) !== "regionOnly") return void 0;
  const domId = renderer.regionDomId(region);
  const tc = new ComponentRenderer(renderer, ctx, region, component, domId);
  const slots = {};
  for (const slot of component.slots.length ? component.slots : [{ placeholder: "BODY", apexlangName: "body" }]) {
    const key = `PLUGIN-${slot.apexlangName.toUpperCase()}`;
    const own = [
      ...children.get(key) ?? [],
      ...slot.placeholder === "BODY" ? children.get("SUB_REGIONS") ?? [] : []
    ];
    slots[slot.placeholder] = own.map((child) => child.html).join("\n");
  }
  if (values.BODY) slots.BODY = `${values.BODY}${slots.BODY ?? ""}`;
  const classes2 = [str(region.props, "appearance.cssClasses"), tc.builtins().APEX$COMPONENT_CSS_CLASSES].filter(Boolean).join(" ");
  return tc.partial(void 0, { ...slots, APEX$COMPONENT_CSS_CLASSES: classes2 });
}
function renderTemplateComponentColumn(renderer, ctx, region, column, row) {
  const name = str(column.props, "type").split("/")[1] ?? "";
  const component = findComponent(renderer, name);
  if (!component?.partial) {
    renderer.diagnose(
      "warning",
      `Column ${column.id}: template component ${name} is not in the theme`,
      ctx.pageId,
      region.id
    );
    const value = row[column.id.toUpperCase()];
    return escapeValue(value === null || value === void 0 ? "" : String(value), "HTML");
  }
  const domId = `${renderer.regionDomId(region)}_${column.id.toLowerCase()}`;
  return new ComponentRenderer(renderer, ctx, column, component, domId).partial(row);
}

// packages/core/src/preview/extensions/components.ts
var bodies = /* @__PURE__ */ new WeakMap();
function staticContent(renderer, ctx, region) {
  const source = str(region.props, "source.htmlCode") || str(region.props, "source.text");
  const outputAs = str(region.props, "settings.outputAs", "html");
  if (bool(region.props, "settings.expandShortcuts", false))
    renderer.diagnose(
      "info",
      `Region ${region.id}: shortcuts are not expanded locally`,
      ctx.pageId,
      region.id
    );
  let html;
  if (outputAs === "text") {
    html = escapeHtml(renderer.substitute(ctx.session, source, ctx.page, "RAW"));
    if (bool(region.props, "settings.showLineBreaks", true)) html = html.replace(/\r?\n/gu, "<br>");
  } else html = renderer.substitute(ctx.session, source, ctx.page, "RAW");
  bodies.set(region, html);
  return html;
}
function helpText(renderer, ctx, region) {
  const own = str(region.props, "source.htmlCode") || str(region.props, "source.text");
  const help2 = own || str(ctx.page.props, "help.helpText");
  if (!help2) return "<p>No help is available for this page.</p>";
  return renderer.substitute(ctx.session, help2, ctx.page, "RAW");
}
function url(renderer, ctx, region) {
  const target2 = str(region.props, "source.url") || str(region.props, "settings.url");
  renderer.diagnose(
    "info",
    `URL region ${region.id} is not fetched locally; a placeholder links to the address`,
    ctx.pageId,
    region.id
  );
  const href = renderer.substitute(ctx.session, target2, ctx.page, "RAW");
  return `<div class="apex-local-unsupported"><span class="fa fa-globe" aria-hidden="true"></span> URL region \u201C${escapeHtml(str(region.props, "name", region.id))}\u201D${href ? `: <a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(href)}</a>` : ""}</div>`;
}
function regionDisplaySelector(renderer, ctx, region) {
  const domId = renderer.regionDomId(region);
  const targets = renderer.pageComponents(ctx, "region").filter(
    (candidate) => candidate !== region && bool(candidate.props, "advanced.regionDisplaySelector", false) && renderer.visible(ctx, candidate)
  ).sort(
    (a, b) => Number(get(a.props, "layout.sequence") ?? 0) - Number(get(b.props, "layout.sequence") ?? 0)
  );
  const includeShowAll = bool(region.props, "settings.includeShowAll", true);
  const tab = (id, label, first) => `<li class="apex-rds-item${first ? " apex-rds-first" : ""}" role="presentation" id="${escapeHtml(id)}_tab"><a class="a-RDS-link" href="#${escapeHtml(id)}" role="tab" aria-controls="${escapeHtml(id)}" aria-selected="false" tabindex="-1"><span class="a-RDS-icon a-Icon " aria-hidden="true"></span><span class="a-RDS-label">${label}</span></a></li>`;
  const tabs = [
    ...includeShowAll ? [tab("SHOW_ALL", "Show All", true)] : [],
    ...targets.map(
      (target2, index) => tab(
        renderer.regionDomId(target2),
        renderer.substitute(
          ctx.session,
          str(target2.props, "title", str(target2.props, "name", target2.id)),
          ctx.page,
          "HTML"
        ),
        !includeShowAll && index === 0
      )
    )
  ];
  const mode = str(region.props, "settings.mode", "standard") === "scrollWindow" ? "jump" : "standard";
  ctx.jsFiles.add("#APEX_FILES#libraries/apex/#MIN_DIRECTORY#widget.apexTabs#MIN#.js?v=#APEX_VERSION#");
  ctx.onload.push(
    `apex.widget.regionDisplaySelector(${JSON.stringify(domId)},{mode:${JSON.stringify(mode)},useSlider:${bool(region.props, "settings.useSlider", true)},useLocalStorage:${bool(region.props, "settings.rememberSelection", true)}});`
  );
  if (!targets.length)
    renderer.diagnose(
      "info",
      `Region Display Selector ${region.id} has no regions to select`,
      ctx.pageId,
      region.id
    );
  return `<div class="apex-rds-container"><ul class="apex-rds a-Tabs is-disabled" id="${escapeHtml(domId)}_RDS" role="tablist">${tabs.join("")}</ul></div>`;
}
var hasSelector = (renderer, ctx) => renderer.pageComponents(ctx, "region").some((region) => str(region.props, "type") === "regionDisplaySelector");
function wrapRegion(renderer, ctx, region, parts) {
  const { template, values, children } = parts;
  registerNamedTemplates(componentIndex(renderer.assets.theme).named);
  for (const file of text(template, "javascript_file_urls").split("\n").filter(Boolean))
    ctx.jsFiles.add(file);
  for (const file of text(template, "css_file_urls").split("\n").filter(Boolean)) ctx.cssFiles.add(file);
  const type = str(region.props, "type");
  if (type.startsWith("themeTemplateComponent/")) {
    const html = wrapRegionOnly(renderer, ctx, region, values, children);
    if (html !== void 0) return html;
  }
  const substitute = (path9, escape) => renderer.substitute(ctx.session, str(region.props, path9), ctx.page, escape);
  values.REGION_IMAGE_ALT_TEXT ||= escapeHtml(substitute("image.accessibleDescription", "RAW"));
  values.REGION_IMAGE_ATTRIBUTES ||= substitute("image.customAttributes", "RAW") || substitute("advanced.imageTagAttributes", "RAW");
  const advancedImage = substitute("advanced.regionImage", "RAW");
  if (!values.REGION_IMAGE_URL && advancedImage) {
    values.REGION_IMAGE_URL = escapeHtml(advancedImage);
    values.REGION_IMAGE = fill(text(template, "image_template"), {
      REGION_IMAGE_URL: values.REGION_IMAGE_URL
    });
  }
  if (bool(region.props, "advanced.regionDisplaySelector", false) && hasSelector(renderer, ctx))
    values.REGION_CSS_CLASSES = `${values.REGION_CSS_CLASSES ?? ""} apex-rds-region`.trim();
  const body3 = bodies.get(region);
  if (body3 && str(region.props, "appearance.renderComponents") === "aboveContent" && values.BODY?.startsWith(body3))
    values.BODY = values.BODY.slice(body3.length) + body3;
  const sub = text(template, "sub_plug_template");
  const own = children.get("SUB_REGIONS");
  if (sub && children.get("BODY")?.length)
    renderer.diagnose(
      "info",
      `Sub-regions of ${region.id} are in the region body slot; only the template's sub-region slot (e.g. tabs, slides) becomes tabs or slides`,
      ctx.pageId,
      region.id
    );
  if (!sub || !own?.length) return void 0;
  values.SUB_REGIONS = own.map(
    ({ component, html }) => fill(sub, {
      SUB_REGION_TITLE: renderer.substitute(
        ctx.session,
        str(component.props, "title", str(component.props, "name", component.id)),
        ctx.page,
        "HTML"
      ),
      SUB_REGION_ID: renderer.regionDomId(component),
      SUB_REGION: html
    })
  ).join("\n");
  return fill(text(template, "template"), values);
}
var CLIENT = String.raw`
(function ($) {
  "use strict";
  // Open Region / Close Region dynamic actions (inline dialog, drawer and popup regions).
  function regionAction(action) {
    var method = action.action === "openRegion" ? "openRegion" : "closeRegion";
    action.action = "executeJsCode";
    action.settings = { jsCode: "this.affectedElements.each(function(){ apex.theme." + method + "(this.id || $(this)); });" };
  }
  var init = apexLocal.init;
  apexLocal.init = function (config) {
    (config.dynamicActions || []).forEach(function (da) {
      (da.actions || []).forEach(function (action) {
        if (action.action === "openRegion" || action.action === "closeRegion") regionAction(action);
      });
    });
    return init.apply(this, arguments);
  };
  // Template component action menus after a region refresh.
  $(document).on("apexafterrefresh", function (event) {
    $("[data-apex-local-menu]", event.target).each(function () {
      if (!$(this).hasClass("a-Menu")) $(this).menu({ owningRegion: event.target.id });
    });
  });
})(apex.jQuery);
`;
registerExtension({
  name: "components",
  regions: {
    themeTemplateComponent: (renderer, ctx, region) => renderTemplateComponentRegion(renderer, ctx, region),
    staticContent,
    helpText,
    url,
    regionDisplaySelector
  },
  columns: {
    themeTemplateComponent: (renderer, ctx, region, column, row) => renderTemplateComponentColumn(renderer, ctx, region, column, row)
  },
  wrapRegion,
  page(renderer, ctx) {
    registerNamedTemplates(componentIndex(renderer.assets.theme).named);
    ctx.onload.unshift("apex.util.applySafeHidden();");
  },
  client: CLIENT,
  css: ".apex-local-tc-pagination{display:flex;justify-content:center;padding:8px 0}"
});

// packages/core/src/preview/extensions/facets/model.ts
var FILTER_REGION_TYPES = /* @__PURE__ */ new Set(["facetedSearch", "smartFilters"]);
var FACET_KINDS = {
  checkboxGroup: "list",
  radioGroup: "list",
  range: "rangeList",
  selectList: "selectList",
  inputField: "input",
  textField: "input",
  numberField: "input",
  search: "search",
  starRating: "starRating",
  checkbox: "checkbox"
};
var OPERATORS = /* @__PURE__ */ new Set(["EQ", "NEQ", "LT", "LTE", "GT", "GTE", "STARTS", "NSTARTS", "C", "NC"]);
var COMPARISON = {
  equals: "EQ",
  notEquals: "NEQ",
  lessThan: "LT",
  lessThanOrEqualTo: "LTE",
  greaterThan: "GT",
  greaterThanOrEqualTo: "GTE",
  startsWith: "STARTS",
  doesNotStartWith: "NSTARTS",
  contains: "C",
  doesNotContain: "NC"
};
var quoteIdent = (name) => `"${name.replaceAll('"', "").toUpperCase()}"`;
var quoteText = (value) => `'${value.replaceAll("'", "''")}'`;
var numeric = (value) => value.trim() !== "" && Number.isFinite(Number(value));
var literal = (value, number) => number && numeric(value) ? String(Number(value)) : quoteText(value);
function filterRegionsFor(renderer, ctx, region) {
  return renderer.pageComponents(ctx, "region").filter(
    (candidate) => FILTER_REGION_TYPES.has(str(candidate.props, "type")) && ref(candidate.props, "source.filteredRegion") === region.id
  );
}
function filteredRegion(renderer, ctx, filters) {
  const id = ref(filters.props, "source.filteredRegion");
  return renderer.pageComponents(ctx, "region").find((candidate) => candidate.id === id);
}
function sequence(component) {
  return num(component.props, "layout.sequence", num(component.props, "sequence", 0));
}
function staticLov(renderer, value) {
  return renderer.staticLov(value).map((entry) => ({
    d: entry.d.replaceAll("#G#", ",").replaceAll("#D#", "."),
    r: entry.r
  }));
}
function facetOf(renderer, ctx, component, owner2) {
  const type = str(component.props, "type");
  const kind = FACET_KINDS[type];
  const name = component.id.toUpperCase();
  if (!kind) {
    renderer.diagnose(
      "warning",
      `Facet ${name} of type ${type || "(none)"} is not simulated; it is ignored`,
      ctx.pageId,
      owner2.id
    );
    return void 0;
  }
  const props = component.props;
  const lovType = str(props, "lov.type");
  const label = str(props, "label.label", str(props, "name", name));
  const dataType = str(props, "source.dataType").toLowerCase();
  const column = str(props, "source.databaseColumn", kind === "search" ? "" : name);
  for (const unsupported2 of ["cascadingLov.parentFacet", "dependingOn.facet", "multipleValues.type"])
    if (get(props, unsupported2) !== void 0)
      renderer.diagnose(
        "info",
        `Facet ${name}: ${unsupported2.split(".")[0]} is not simulated locally`,
        ctx.pageId,
        owner2.id
      );
  return {
    component,
    name,
    kind,
    label,
    column,
    columns: str(props, "source.dbColumns").split(",").map((value) => value.trim()).filter(Boolean),
    number: dataType === "number" || kind === "starRating" || type === "numberField",
    multiple: type === "checkboxGroup" || kind === "rangeList" && bool(props, "settings.selectMultiple", false),
    allowExclude: ["list", "rangeList"].includes(kind) && bool(props, "listEntries.allowToExclude", false),
    checkedValue: str(props, "settings.checkedValue", "Y"),
    members: [],
    combine: "or",
    operator: COMPARISON[str(props, "settings.comparisonOperator")] ?? (type === "textField" || dataType === "number" ? "EQ" : "C"),
    staticValues: lovType === "staticValues" || kind === "rangeList" && str(props, "lov.staticValues") ? staticLov(renderer, str(props, "lov.staticValues")) : void 0
  };
}
function facetsOf(renderer, ctx, filters) {
  const result = [];
  const children = [...filters.children].filter((child) => ["facet", "facetGroup", "filter", "filterGroup"].includes(child.type)).sort((a, b) => sequence(a) - sequence(b));
  for (const child of children) {
    if (!renderer.condition(ctx, child.props)) continue;
    if (child.type === "facetGroup" || child.type === "filterGroup") {
      const name = (str(child.props, "advanced.staticId") || child.id).toUpperCase();
      const group2 = {
        component: child,
        name,
        kind: "group",
        label: str(child.props, "label", child.id),
        column: "",
        columns: [],
        number: false,
        multiple: true,
        allowExclude: false,
        checkedValue: "",
        members: [],
        combine: str(child.props, "advanced.combineFilters", "or") === "and" ? "and" : "or",
        operator: "EQ"
      };
      result.push(group2);
      for (const member of [...child.children].filter((entry) => ["checkbox", "facet", "filter"].includes(entry.type)).sort((a, b) => sequence(a) - sequence(b))) {
        if (!renderer.condition(ctx, member.props)) continue;
        const facet2 = facetOf(renderer, ctx, member, filters);
        if (!facet2) continue;
        facet2.kind = "checkbox";
        facet2.group = group2;
        group2.members.push(facet2);
        result.push(facet2);
      }
      continue;
    }
    const facet = facetOf(renderer, ctx, child, filters);
    if (facet) result.push(facet);
  }
  if (str(filters.props, "type") === "smartFilters" && !result.some((facet) => facet.kind === "search")) {
    const component = {
      type: "filter",
      id: `${renderer.regionDomId(filters).toUpperCase()}_SEARCH`,
      props: { type: "search", label: { label: "Search" } },
      children: [],
      file: filters.file,
      line: filters.line
    };
    const search = facetOf(renderer, ctx, component, filters);
    if (search) result.push(search);
  }
  return result;
}
function facetValue(renderer, ctx, facet) {
  if (facet.name in ctx.session.items) return ctx.session.items[facet.name] ?? "";
  const props = facet.component.props;
  const type = str(props, "default.type");
  if (type === "item") {
    const item2 = str(props, "default.item").toUpperCase();
    return ctx.session.items[item2] ?? "";
  }
  const value = str(props, "default.staticValue");
  return value ? renderer.substitute(ctx.session, value, ctx.page, "RAW") : "";
}
function parseValue(facet, raw) {
  let value = raw;
  let exclude = false;
  if (facet.allowExclude && /^[IE]/u.test(value)) {
    exclude = value[0] === "E";
    value = value.slice(1);
  }
  if (facet.kind === "search") return { exclude, values: value.split("\n").filter((term) => term.trim()) };
  if (facet.kind === "input") return { exclude, values: value === "" ? [] : [value] };
  return { exclude, values: value === "" ? [] : value.split(":") };
}
function inList(column, values) {
  const literals = /* @__PURE__ */ new Set();
  for (const value of values) {
    literals.add(quoteText(value));
    if (numeric(value)) literals.add(String(Number(value)));
  }
  return `${column} in (${[...literals].join(", ")})`;
}
function rangePredicate(column, value, inclusiveEnd) {
  const [begin = "", end = ""] = value.split("|");
  const parts = [
    begin !== "" ? `${column} >= ${literal(begin, true)}` : "",
    end !== "" ? `${column} ${inclusiveEnd ? "<=" : "<"} ${literal(end, true)}` : ""
  ].filter(Boolean);
  return parts.length ? `(${parts.join(" and ")})` : "";
}
function inputPredicate(column, facet, raw) {
  let operator = facet.operator;
  let value = raw;
  const prefix = /^([A-Z]+):([\s\S]*)$/u.exec(raw);
  if (prefix && OPERATORS.has(prefix[1])) {
    operator = prefix[1];
    value = prefix[2];
  }
  if (value === "") return "";
  const text5 = `upper(${column})`;
  const needle = `upper(${quoteText(value)})`;
  switch (operator) {
    case "NEQ":
      return `${column} <> ${literal(value, facet.number)}`;
    case "LT":
      return `${column} < ${literal(value, facet.number)}`;
    case "LTE":
      return `${column} <= ${literal(value, facet.number)}`;
    case "GT":
      return `${column} > ${literal(value, facet.number)}`;
    case "GTE":
      return `${column} >= ${literal(value, facet.number)}`;
    case "STARTS":
      return `instr(${text5}, ${needle}) = 1`;
    case "NSTARTS":
      return `coalesce(instr(${text5}, ${needle}), 0) <> 1`;
    case "C":
      return `instr(${text5}, ${needle}) > 0`;
    case "NC":
      return `coalesce(instr(${text5}, ${needle}), 0) = 0`;
    default:
      return inList(column, [value]);
  }
}
function resolveColumn(columns, name) {
  const upper = name.replaceAll('"', "").toUpperCase();
  return columns.find((column) => column.toUpperCase() === upper);
}
function predicate(context, facet, raw) {
  const { renderer, ctx, filters, columns } = context;
  const parsed2 = parseValue(facet, raw);
  if (!parsed2.values.length || facet.kind === "group") return "";
  if (facet.kind === "search") {
    const searchable = (facet.columns.length ? facet.columns : columns).map((name) => resolveColumn(columns, name)).filter((name) => Boolean(name));
    if (!searchable.length) return "";
    const terms = parsed2.values.map(
      (term) => `(${searchable.map((name) => `instr(upper(${quoteIdent(name)}), upper(${quoteText(term.trim())})) > 0`).join(" or ")})`
    );
    return terms.join(" and ");
  }
  const resolved = resolveColumn(columns, facet.column);
  if (!resolved) {
    renderer.diagnose(
      "warning",
      `Facet ${facet.name} filters column ${facet.column.toUpperCase()}, which the filtered region does not return`,
      ctx.pageId,
      filters.id
    );
    return "";
  }
  const column = quoteIdent(resolved);
  let sql = "";
  switch (facet.kind) {
    case "list":
    case "selectList":
    case "checkbox":
      sql = inList(column, parsed2.values);
      break;
    case "starRating": {
      const stars = parsed2.values.map(Number).filter(Number.isFinite);
      sql = stars.length ? `${column} >= ${Math.min(...stars)}` : "";
      break;
    }
    case "rangeList":
    case "range": {
      const known = new Set((facet.staticValues ?? []).map((entry) => entry.r));
      const ranges = parsed2.values.map((value) => rangePredicate(column, value, facet.kind === "range" || !known.has(value))).filter(Boolean);
      sql = ranges.length ? `(${ranges.join(" or ")})` : "";
      break;
    }
    case "input":
      sql = inputPredicate(column, facet, parsed2.values[0]);
      break;
  }
  if (!sql) return "";
  return parsed2.exclude ? `not coalesce(${sql}, 0)` : sql;
}
function predicates(context, facets, except) {
  const { renderer, ctx } = context;
  const skip = except?.group && except.group.combine === "or" ? except.group : except;
  const result = [];
  for (const facet of facets) {
    if (facet === skip || facet.kind === "checkbox") continue;
    if (facet.kind === "group") {
      const members = facet.members.filter((member) => member !== skip).map((member) => predicate(context, member, facetValue(renderer, ctx, member))).filter(Boolean);
      if (members.length) result.push(`(${members.join(facet.combine === "and" ? " and " : " or ")})`);
      continue;
    }
    const sql = predicate(context, facet, facetValue(renderer, ctx, facet));
    if (sql) result.push(sql);
  }
  return result;
}
var where = (sql, parts) => parts.length ? `select * from (${sql}) where ${parts.map((part2) => `(${part2})`).join(" and ")}` : sql;
function queryColumns(renderer, ctx, region, sql) {
  return renderer.query(ctx, region, sql, 1).columns;
}
function facetLov(renderer, ctx, facet, base) {
  const props = facet.component.props;
  if (facet.kind === "starRating") {
    const stars = num(props, "settings.noOfStars", 5);
    return Array.from({ length: stars }, (_, index) => ({ d: String(index + 1), r: String(index + 1) }));
  }
  if (facet.staticValues) return facet.staticValues;
  const lovType = str(props, "lov.type");
  if (lovType === "distinctValues" || !lovType && facet.kind !== "checkbox") {
    const column = resolveColumn(base.columns, facet.column);
    if (!column) return [];
    const direction = str(props, "lov.sortDirection") === "desc" ? "desc" : "asc";
    const result = renderer.query(
      ctx,
      base.region,
      `select distinct ${quoteIdent(column)} as R from (${base.sql}) where ${quoteIdent(column)} is not null order by 1 ${direction}`,
      5e3
    );
    return result.rows.map((row) => ({ d: String(row.R ?? ""), r: String(row.R ?? "") }));
  }
  const spec = get(props, "lov");
  const entries = isObject(spec) ? renderer.lov(ctx, spec, facet.name) : [];
  if (bool(props, "lov.includeNullOption", false))
    entries.unshift({ d: str(props, "lov.nullDisplayValue", "- No Value -"), r: "" });
  return entries.map((entry) => ({
    d: entry.d.replaceAll("#G#", ",").replaceAll("#D#", "."),
    r: entry.r
  }));
}
function facetCounts(context, facets, facet, base, lov) {
  const { renderer, ctx, columns } = context;
  const filtered = where(base.sql, predicates(context, facets, facet));
  const counts = {};
  if (facet.kind === "checkbox") {
    const sql = predicate(context, facet, facet.checkedValue);
    if (!sql) return counts;
    const row2 = renderer.query(ctx, base.region, `select count(*) as C from (${filtered}) where ${sql}`, 1).rows[0];
    counts[facet.checkedValue] = Number(row2?.C ?? 0);
    return counts;
  }
  const column = resolveColumn(columns, facet.column);
  if (!column) return counts;
  if (facet.kind === "list" || facet.kind === "selectList") {
    const result = renderer.query(
      ctx,
      base.region,
      `select ${quoteIdent(column)} as V, count(*) as C from (${filtered}) group by ${quoteIdent(column)}`,
      1e4
    );
    for (const row2 of result.rows) counts[String(row2.V ?? "")] = Number(row2.C ?? 0);
    return counts;
  }
  if (!lov.length) return counts;
  const sums = lov.map((entry, index) => {
    const sql = predicate(context, { ...facet, allowExclude: false, multiple: false }, entry.r);
    return `sum(case when ${sql || "1 = 0"} then 1 else 0 end) as C${index}`;
  });
  const row = renderer.query(ctx, base.region, `select ${sums.join(", ")} from (${filtered})`, 1).rows[0];
  lov.forEach((entry, index) => {
    counts[entry.r] = Number(row?.[`C${index}`] ?? 0);
  });
  return counts;
}
function totalCount(context, facets, base) {
  const sql = where(base.sql, predicates(context, facets));
  const row = context.renderer.query(context.ctx, base.region, `select count(*) as C from (${sql})`, 1).rows[0];
  return Number(row?.C ?? 0);
}
var strings3 = (props, key) => list(props, key).map((value) => typeof value === "string" ? value : String(value));

// packages/core/src/preview/extensions/facets/cards.ts
var KNOWN_GROUPS = /* @__PURE__ */ new Set([
  "title",
  "subtitle",
  "body",
  "secondaryBody",
  "iconAndBadge",
  "media",
  "card",
  "componentAppearance",
  "pagination",
  "orderBy",
  "source",
  "layout",
  "appearance",
  "messages",
  "serverSideCondition",
  "advanced",
  "accessibility",
  "config",
  "security",
  "help",
  "comments",
  "performance",
  "name",
  "type"
]);
function rowTemplate(renderer, ctx, template, row, escape) {
  const values = {};
  for (const [key, value] of Object.entries(row)) values[key.toUpperCase()] = String(value ?? "");
  const substituted = renderer.substitute(ctx.session, template, ctx.page, "HTML");
  return applyDirectives(substituted, values).replace(
    /#([A-Z][A-Z0-9_$]*)(?:!([A-Z]+))?#/gu,
    (whole, name, filter) => {
      if (!(name in values)) return whole;
      if (filter) return applyEscape(values[name], filter);
      return escape ? escapeHtml(values[name]) : values[name];
    }
  );
}
function initials(value) {
  const words = value.trim().split(/[\s._@-]+/u).filter(Boolean);
  if (!words.length) return "";
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return letters.toUpperCase();
}
function position(value) {
  return value.replace(/[^a-z]/giu, "").toLowerCase();
}
function renderCards(renderer, ctx, region) {
  const domId = renderer.regionDomId(region);
  const props = region.props;
  for (const key of Object.keys(props))
    if (!KNOWN_GROUPS.has(key))
      renderer.diagnose("info", `Cards ${region.id}: ${key} is not simulated`, ctx.pageId, region.id);
  let sql = renderer.regionSql(ctx, region);
  if (!sql)
    return `<div class="apex-local-unsupported">Cards \u201C${escapeHtml(str(props, "name", region.id))}\u201D have no local source.</div>`;
  const order = orderBy(renderer, ctx, region);
  if (order.clause) sql = `select * from (${sql}) order by ${order.clause}`;
  const result = renderer.query(ctx, region, sql);
  ctx.onload.push(
    `apexLocalFacets.partRegion(${JSON.stringify(domId).replaceAll("<", "\\u003c")}, "_cards", "Cards");`
  );
  if (result.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(result.error)}</div></div>`;
  const paginationType = str(props, "pagination.type", "scroll");
  const perPage = Math.max(1, num(props, "pagination.cardsPerPage", paginationType === "page" ? 15 : 20));
  const pageNumber = Math.max(1, ctx.session.pagination[`${ctx.pageId}:${region.id}`] ?? 1);
  const scroll = paginationType !== "page";
  const first = scroll ? 0 : (pageNumber - 1) * perPage;
  const rows = result.rows.slice(first, pageNumber * perPage);
  const layout = str(props, "componentAppearance.layout", "grid");
  const columns = str(props, "componentAppearance.gridColumns");
  const listClass = layout === "float" ? "a-CardView-items--float" : layout === "horizontal" ? "a-CardView-items--row" : `a-CardView-items--grid${columns ? ` a-CardView-items--grid${columns}col` : ""}`;
  const actions = region.children.filter((child) => child.type === "action" && renderer.condition(ctx, child.props)).sort((a, b) => num(a.props, "layout.sequence", 0) - num(b.props, "layout.sequence", 0)).map((component) => ({
    component,
    position: position(str(component.props, "position")),
    label: str(component.props, "label")
  }));
  for (const action of actions)
    if (str(action.component.props, "serverSideCondition.executeCondition") === "forEachRow")
      renderer.diagnose(
        "info",
        `Cards ${region.id}: per-row action conditions are evaluated once locally`,
        ctx.pageId,
        region.id
      );
  const cards = rows.map((row) => renderCard(renderer, ctx, region, row, actions)).join("\n");
  const noData = renderer.substitute(
    ctx.session,
    str(props, "messages.whenNoDataFound", "No data found"),
    ctx.page,
    "HTML"
  );
  const total = result.rows.length;
  const shown = first + rows.length;
  let footer = "";
  if (!scroll && total > perPage) {
    const button = (target2, icon3, label, disabled) => `<button type="button" class="a-TMV-pageButton a-TMV-pageButton--nav a-Button" title="${label}" aria-label="${label}"${disabled ? " disabled" : ` data-apex-local-cards-page="${target2}" data-region="${escapeHtml(domId)}"`}><span class="a-Icon ${icon3}" aria-hidden="true"></span></button>`;
    footer = `<div class="a-TMV-footer"><div class="a-TMV-pagination" role="region" aria-label="Pagination">${button(pageNumber - 1, "icon-prev", "Previous", pageNumber <= 1)}<span class="a-TMV-pageRange">${first + 1} - ${shown}${bool(props, "pagination.showTotalCount", true) ? ` of ${total}` : ""}</span>${button(pageNumber + 1, "icon-next", "Next", shown >= total)}</div></div>`;
  } else if (scroll && shown < total) {
    footer = `<div class="a-TMV-loadMore"><button type="button" class="a-Button js-load a-TMV-loadMoreButton" data-apex-local-cards-page="${pageNumber + 1}" data-region="${escapeHtml(domId)}">Load More</button></div>`;
  }
  const orderAttribute = order.item ? ` data-apex-local-orderby="${escapeHtml(order.item)}"` : "";
  const body3 = rows.length ? `<ul class="a-CardView-items ${listClass}" role="list">${cards}</ul>` : `<div class="a-TMV-altMessage a-TMV-noDataMessage" role="region"><div class="a-TMV-altMessage-icon" aria-hidden="true"><span class="a-Icon icon-irr-no-results"></span></div><div role="status"><span class="a-TMV-altMessage-text">${noData}</span></div></div>`;
  return `<div class="a-TMV a-TMV--cards" id="${escapeHtml(domId)}_cards" data-region="${escapeHtml(domId)}"${orderAttribute}><div class="a-TMV-body"><div class="a-TMV-w-scroll">${body3}</div></div>${footer}</div>`;
}
function orderBy(renderer, ctx, region) {
  const props = region.props;
  const type = str(props, "orderBy.type");
  const item2 = get(props, "orderBy.item");
  if ((type === "item" || !type && isObject(item2)) && isObject(item2)) {
    const name = str(item2, "itemName").toUpperCase();
    const choices2 = get(item2, "orderBys");
    const selected = ctx.session.items[name] ?? "";
    let clause = "";
    if (isObject(choices2)) {
      const key = Object.keys(choices2).find((entry) => entry.toUpperCase() === selected.toUpperCase());
      const fallback = Object.keys(choices2)[0];
      const chosen = key ?? fallback;
      clause = chosen ? String(choices2[chosen] ?? "") : "";
    }
    return { clause, ...name ? { item: name } : {} };
  }
  return { clause: str(props, "orderBy.orderByClause") };
}
function part(renderer, ctx, region, group2, row, escape) {
  const props = region.props;
  const css = strings3(props, `${group2}.cssClasses`).join(" ");
  if (bool(props, `${group2}.advancedFormatting`, false))
    return { html: rowTemplate(renderer, ctx, str(props, `${group2}.htmlExpression`), row, escape), css };
  const column = str(props, `${group2}.column`).toUpperCase();
  return { html: column && column in row ? escapeOrNot(row[column], escape) : "", css };
}
var escapeOrNot = (value, escape) => escape ? escapeHtml(value ?? "") : String(value ?? "");
var urlOf = (renderer, ctx, template, row) => rowTemplate(renderer, ctx, template, row, false);
function actionHref(renderer, ctx, region, action, row) {
  const props = action.props;
  const type = str(props, "behavior.type", "redirectThisApp");
  if (type === "redirectUrl" || str(props, "behavior.targetUrl"))
    return urlOf(renderer, ctx, str(props, "behavior.targetUrl"), row);
  if (type === "triggerAction") {
    renderer.diagnose(
      "info",
      `Card action ${action.id} triggers an action; not simulated`,
      ctx.pageId,
      region.id
    );
    return "#";
  }
  const target2 = get(props, "behavior.target") ?? get(props, "link.target");
  return renderer.link(ctx, target2, row, `apex.jQuery('#${renderer.regionDomId(region)}')`);
}
function renderCard(renderer, ctx, region, row, actions) {
  const props = region.props;
  const escape = bool(props, "security.escapeSpecialChars", true);
  const title = part(renderer, ctx, region, "title", row, escape);
  const subtitle = part(renderer, ctx, region, "subtitle", row, escape);
  const body3 = part(renderer, ctx, region, "body", row, escape);
  const secondary = part(renderer, ctx, region, "secondaryBody", row, escape);
  const at = (where2) => actions.filter((action) => action.position === where2);
  const linkAttributes = (action) => {
    const attributes = str(action.component.props, "behavior.linkAttributes");
    return attributes ? ` ${rowTemplate(renderer, ctx, attributes, row, true)}` : "";
  };
  const wrap = (where2, html) => {
    const action = at(where2)[0];
    if (!action || !html) return html;
    return `<a href="${escapeHtml(actionHref(renderer, ctx, region, action.component, row))}"${linkAttributes(action)}>${html}</a>`;
  };
  const classes2 = ["a-CardView"];
  const iconSource = str(props, "iconAndBadge.iconSource");
  let icon3 = "";
  if (iconSource) {
    const iconColumn = str(props, "iconAndBadge.iconColumn").toUpperCase();
    const iconCss = rowTemplate(renderer, ctx, str(props, "iconAndBadge.iconCssClasses"), row, true);
    const description = rowTemplate(renderer, ctx, str(props, "iconAndBadge.iconDescription"), row, true);
    const label = description ? ` role="img" aria-label="${description}"` : ' aria-hidden="true"';
    if (iconSource === "initials")
      icon3 = `<span class="a-CardView-initials u-color${iconCss ? ` ${iconCss}` : ""}"${label}>${escapeHtml(initials(String(row[iconColumn] ?? "")))}</span>`;
    else if (iconSource === "iconClass" || iconSource === "iconClassColumn") {
      const classesValue = iconSource === "iconClass" ? iconCss : String(row[iconColumn] ?? "");
      const fa = /(^|\s)fa-/u.test(classesValue) && !/(^|\s)fa(\s|$)/u.test(classesValue) ? "fa " : "";
      icon3 = `<span class="a-CardView-icon u-color ${escapeHtml(fa + classesValue)}"${label}></span>`;
    } else if (iconSource === "imageUrl")
      icon3 = `<img class="a-CardView-iconImg" src="${escapeHtml(urlOf(renderer, ctx, str(props, "iconAndBadge.imageUrl"), row))}" alt="${description}">`;
    else {
      renderer.diagnose("info", `Cards ${region.id}: BLOB icons are not simulated`, ctx.pageId, region.id);
      icon3 = `<span class="a-CardView-icon u-color fa fa-image"${label}></span>`;
    }
    classes2.push("has-icon");
  }
  const iconPosition = str(props, "iconAndBadge.iconPosition", "start");
  const iconWrap = icon3 ? `<div class="a-CardView-iconWrap${iconPosition === "top" ? " a-CardView-iconWrap--top" : iconPosition === "end" ? " a-CardView-iconWrap--end" : ""}">${icon3}</div>` : "";
  const badgeColumn = str(props, "iconAndBadge.badgeColumn").toUpperCase();
  let badge = "";
  if (badgeColumn && row[badgeColumn] !== null && row[badgeColumn] !== void 0 && row[badgeColumn] !== "") {
    const badgeLabel = rowTemplate(renderer, ctx, str(props, "iconAndBadge.badgeLabel"), row, true);
    const badgeCss = strings3(props, "iconAndBadge.badgeCssClasses").join(" ");
    badge = `<div class="a-CardView-badge${badgeCss ? ` ${escapeHtml(badgeCss)}` : ""}">${badgeLabel ? `<span class="a-CardView-badgeLabel">${badgeLabel}</span>` : ""}<span class="a-CardView-badgeValue">${escapeOrNot(row[badgeColumn], escape)}</span></div>`;
    classes2.push("has-badge");
  }
  let media = "";
  const mediaCss = strings3(props, "media.cssClasses").join(" ");
  const mediaPosition = str(props, "media.position", "first");
  if (bool(props, "media.advancedFormatting", false)) {
    const html = rowTemplate(renderer, ctx, str(props, "media.htmlExpression"), row, escape);
    if (html)
      media = `<div class="a-CardView-media a-CardView-media--${mediaPosition} ${escapeHtml(mediaCss)}">${wrap("media", html)}</div>`;
  } else {
    const source = str(props, "media.source");
    let url2 = "";
    if (source === "imageUrl") url2 = urlOf(renderer, ctx, str(props, "media.url"), row);
    else if (source === "urlColumn") url2 = String(row[str(props, "media.urlColumn").toUpperCase()] ?? "");
    else if (source === "blobColumn")
      renderer.diagnose("info", `Cards ${region.id}: BLOB media is not simulated`, ctx.pageId, region.id);
    if (url2) {
      const alt = rowTemplate(renderer, ctx, str(props, "media.imageDescription"), row, true);
      const appearance = str(props, "media.appearance", "widescreen");
      const sizing = str(props, "media.sizing", "cover");
      media = `<div class="a-CardView-media a-CardView-media--${mediaPosition} a-CardView-media--${appearance} a-CardView-media--${sizing}${mediaCss ? ` ${escapeHtml(mediaCss)}` : ""}">${wrap("media", `<img class="a-CardView-mediaImg" src="${escapeHtml(url2)}" alt="${alt}" loading="lazy">`)}</div>`;
    }
  }
  if (media) classes2.push("has-media", `has-media--${mediaPosition}`);
  const titleAction = at("title")[0];
  const titleHtml = title.html ? `<h3 class="a-CardView-title${title.css ? ` ${escapeHtml(title.css)}` : ""}">${titleAction ? `<a class="a-CardView-titleLink" href="${escapeHtml(actionHref(renderer, ctx, region, titleAction.component, row))}"${linkAttributes(titleAction)}>${title.html}</a>` : title.html}</h3>` : "";
  if (title.html) classes2.push("has-title");
  const subtitleHtml = subtitle.html ? `<h4 class="a-CardView-subTitle${subtitle.css ? ` ${escapeHtml(subtitle.css)}` : ""}">${wrap("subtitle", subtitle.html)}</h4>` : "";
  if (subtitle.html) classes2.push("has-subtitle");
  const header = iconWrap || titleHtml || subtitleHtml || badge ? `<div class="a-CardView-header">${iconPosition === "end" ? "" : iconWrap}<div class="a-CardView-headerBody">${titleHtml}${subtitleHtml}</div>${badge}${iconPosition === "end" ? iconWrap : ""}</div>` : "";
  const bodyHtml = body3.html || secondary.html ? `<div class="a-CardView-body">${body3.html ? `<div class="a-CardView-mainContent${body3.css ? ` ${escapeHtml(body3.css)}` : ""}">${wrap("body", body3.html)}</div>` : ""}${secondary.html ? `<div class="a-CardView-subContent${secondary.css ? ` ${escapeHtml(secondary.css)}` : ""}">${wrap("secondarybody", secondary.html)}</div>` : ""}</div>` : "";
  if (body3.html) classes2.push("has-body");
  if (secondary.html) classes2.push("has-secondary");
  const button = (action, hotDefault) => {
    const actionProps = action.component.props;
    const display = str(actionProps, "appearance.displayType", "text");
    const iconValue = str(actionProps, "appearance.icon");
    const iconClass = /(^|\s)fa-/u.test(iconValue) && !/(^|\s)fa(\s|$)/u.test(iconValue) ? `fa ${iconValue}` : iconValue;
    const label = escapeHtml(rowTemplate(renderer, ctx, action.label, row, false));
    const disabled = bool(actionProps, "appearance.showAsDisabled", false);
    const css = [
      "a-CardView-button",
      bool(actionProps, "appearance.hot", hotDefault) ? "a-CardView-button--hot" : "",
      ...strings3(actionProps, "appearance.cssClasses")
    ].filter(Boolean).join(" ");
    const inner = `${display !== "text" && iconClass ? `<span class="a-CardView-buttonIcon ${escapeHtml(iconClass)}" aria-hidden="true"></span>` : ""}${display !== "icon" ? `<span class="a-CardView-buttonLabel">${label}</span>` : ""}`;
    return disabled ? `<button type="button" class="${escapeHtml(css)}" disabled${display === "icon" ? ` title="${label}" aria-label="${label}"` : ""}>${inner}</button>` : `<a class="${escapeHtml(css)}" href="${escapeHtml(actionHref(renderer, ctx, region, action.component, row))}"${display === "icon" ? ` title="${label}" aria-label="${label}"` : ""}${linkAttributes(action)}>${inner}</a>`;
  };
  const primary = at("primary").map((action) => button(action, false)).join("");
  const secondaryButtons = at("secondary").map((action) => button(action, false)).join("");
  const actionsHtml = primary || secondaryButtons ? `<div class="a-CardView-actions"><div class="a-CardView-actionsPrimary">${primary}</div><div class="a-CardView-actionsSecondary">${secondaryButtons}</div></div>` : "";
  if (actionsHtml) classes2.push("has-actions");
  const full = at("fullcard")[0] ?? at("card")[0];
  const fullLink = full ? `<a class="a-CardView-fullLink" href="${escapeHtml(actionHref(renderer, ctx, region, full.component, row))}"${linkAttributes(full)} aria-label="${escapeHtml(title.html.replace(/<[^>]*>/gu, ""))}"></a>` : "";
  if (full) classes2.push("has-actions--full");
  for (const action of actions)
    if (![
      "title",
      "subtitle",
      "body",
      "secondarybody",
      "media",
      "primary",
      "secondary",
      "fullcard",
      "card"
    ].includes(action.position))
      renderer.diagnose(
        "info",
        `Cards ${region.id}: action position ${str(action.component.props, "position")} is not simulated`,
        ctx.pageId,
        region.id
      );
  classes2.push(...strings3(props, "card.cssClasses"));
  const key = str(props, "card.primaryKeyColumn1").toUpperCase();
  const dataId = key && key in row ? ` data-id="${escapeHtml(row[key] ?? "")}"` : "";
  const before = mediaPosition === "first" || mediaPosition === "background" ? media : "";
  const inBody = mediaPosition === "body" ? media : "";
  return `<li class="a-CardView-item"${dataId}><div class="${escapeHtml(classes2.join(" "))}">${before}${header}${inBody}${bodyHtml}${actionsHtml}${fullLink}</div></li>`;
}

// packages/core/src/preview/extensions/facets/client.ts
var FACET_MESSAGES = {
  "APEX.FS.ACTIONS_MENU_BUTTON_LABEL": "Options",
  "APEX.FS.ACTIONS_MENU_FILTER": "Filter",
  "APEX.FS.ACTIONS_MENU_HIDE": "Hide Facet",
  "APEX.FS.ADD_FILTER": "Add Filter",
  "APEX.FS.APPLIED_FACET": "Applied Filter %0",
  "APEX.FS.APPLY": "Apply",
  "APEX.FS.BATCH_APPLY": "Apply",
  "APEX.FS.CANCEL": "Cancel",
  "APEX.FS.CHART_BAR": "Bar Chart",
  "APEX.FS.CHART_MENU": "%0 chart options",
  "APEX.FS.CHART_OTHERS": "Others",
  "APEX.FS.CHART_PIE": "Pie Chart",
  "APEX.FS.CHART_TITLE": "Chart",
  "APEX.FS.CHART_UPDATED": "Chart updated",
  "APEX.FS.CHART_VALUE_LABEL": "Count",
  "APEX.FS.CLEAR": "Clear",
  "APEX.FS.CLEAR_ALL": "Clear All",
  "APEX.FS.CLEAR_VALUE": "Clear %0",
  "APEX.FS.CONFIG_TITLE": "Choose filters to show",
  "APEX.FS.COUNT_RESULTS": "%0 results",
  "APEX.FS.COUNT_SELECTED": "%0 selected",
  "APEX.FS.CUR_FILTERS_LM": "Current filters",
  "APEX.FS.EXCLUDE": "Exclude",
  "APEX.FS.EXCLUDED": "Excluded",
  "APEX.FS.EXCLUDE_OFF": "Exclude mode off",
  "APEX.FS.EXCLUDE_ON": "Exclude mode on",
  "APEX.FS.EXCLUDING": "%0 (Excluding)",
  "APEX.FS.FACETS_LIST": "Filters list",
  "APEX.FS.FILTER": "Filter %0",
  "APEX.FS.FILTER_APPLIED": "%0 (Filter Applied)",
  "APEX.FS.GO": "Go",
  "APEX.FS.INPUT_CURRENT_LABEL_C": "contains %0",
  "APEX.FS.INPUT_CURRENT_LABEL_EQ": "equals %0",
  "APEX.FS.INPUT_CURRENT_LABEL_GT": "greater than %0",
  "APEX.FS.INPUT_CURRENT_LABEL_GTE": "greater than or equal to %0",
  "APEX.FS.INPUT_CURRENT_LABEL_LT": "less than %0",
  "APEX.FS.INPUT_CURRENT_LABEL_LTE": "less than or equal to %0",
  "APEX.FS.INPUT_CURRENT_LABEL_NC": "does not contain %0",
  "APEX.FS.INPUT_CURRENT_LABEL_NEQ": "not equals %0",
  "APEX.FS.INPUT_CURRENT_LABEL_NSTARTS": "does not start with %0",
  "APEX.FS.INPUT_CURRENT_LABEL_STARTS": "starts with %0",
  "APEX.FS.INPUT_FACET_SELECTOR": "Facet selection",
  "APEX.FS.INPUT_OPERATOR": "Operator",
  "APEX.FS.INPUT_OPERATOR.C": "contains",
  "APEX.FS.INPUT_OPERATOR.EQ": "equals",
  "APEX.FS.INPUT_OPERATOR.GT": "greater than",
  "APEX.FS.INPUT_OPERATOR.GTE": "greater than or equal to",
  "APEX.FS.INPUT_OPERATOR.LT": "less than",
  "APEX.FS.INPUT_OPERATOR.LTE": "less than or equal to",
  "APEX.FS.INPUT_OPERATOR.NC": "does not contain",
  "APEX.FS.INPUT_OPERATOR.NEQ": "not equals",
  "APEX.FS.INPUT_OPERATOR.NSTARTS": "does not start with",
  "APEX.FS.INPUT_OPERATOR.STARTS": "starts with",
  "APEX.FS.INPUT_VALUE": "Value",
  "APEX.FS.MAXIMIZE": "Maximize",
  "APEX.FS.OPEN_CONFIG": "More Filters",
  "APEX.FS.RANGE_BEGIN": "Range begin",
  "APEX.FS.RANGE_CURRENT_LABEL": "%0 to %1",
  "APEX.FS.RANGE_CURRENT_LABEL_OPEN_HI": "Above %0",
  "APEX.FS.RANGE_CURRENT_LABEL_OPEN_LO": "Below %0",
  "APEX.FS.RANGE_END": "Range end",
  "APEX.FS.RANGE_TEXT": "to",
  "APEX.FS.REMOVE_CHART": "Remove Chart",
  "APEX.FS.RESET": "Reset",
  "APEX.FS.RESET_CHART": "Reset",
  "APEX.FS.RESTORE": "Restore",
  "APEX.FS.SEARCH_LABEL": "Search",
  "APEX.FS.SEARCH_PLACEHOLDER": "Search...",
  "APEX.FS.SELECT_PLACEHOLDER": "- Select -",
  "APEX.FS.SHOW_CHART": "Show Chart",
  "APEX.FS.SHOW_LESS": "Show Less",
  "APEX.FS.SHOW_MORE": "Show All",
  "APEX.FS.SMART_FILTER": "Smart Filter",
  "APEX.FS.STAR_RATING_LABEL": "%0 stars and up",
  "APEX.FS.SUGGESTIONS": "Filter suggestions",
  "APEX.FS.TOGGLE_FILTERS": "Toggle Filters",
  "APEX.FS.TOTAL_ROW_COUNT_LABEL": "Total Row Count",
  "APEX.FS.VISUALLY_HIDDEN_HEADING": "Visually hidden heading"
};
var FACETS_CLIENT = String.raw`
(function ($) {
  "use strict";
  var base = location.pathname.replace(/\/[^/]*$/, "");
  apex.lang.addMessages(__MESSAGES__);

  function itemValues(names) {
    var values = {};
    (names || []).forEach(function (name) {
      name = String(name).replace(/^#/, "");
      if (name && document.getElementById(name)) values[name] = apex.item(name).getValue();
    });
    return values;
  }
  function post(region, body) {
    return $.ajax({
      url: base + "/__apex/x/facets?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) + "&region=" + encodeURIComponent(region),
      type: "POST", contentType: "application/json", dataType: "json", data: JSON.stringify(body)
    });
  }

  var plugin = apex.server.plugin;
  apex.server.plugin = function (identifier, data) {
    var match = /^apexlocal:facets:(.+)$/.exec(typeof identifier === "string" ? identifier : "");
    if (!match) return plugin.apply(this, arguments);
    data = data || {};
    return post(match[1], { items: itemValues(data.pageItems), x01: data.x01, x02: data.x02, x03: data.x03 });
  };

  function refresh(id) {
    var region = apex.region.isRegion && apex.region.isRegion(id) ? apex.region(id) : null;
    return region && region.refresh ? region.refresh() : window.apexLocal.refreshRegion(id);
  }
  // Region refresh that replaces only the rendered view (#<id><suffix>), keeping the region chrome,
  // its slot items (e.g. the cards order-by item) and its visibility (Region Display Selector).
  function refreshPart(id, suffix, pageNumber) {
    var region$ = $("#" + apex.util.escapeCSS(id));
    var url = base + "/__apex/region?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) + "&region=" + encodeURIComponent(id) + (pageNumber ? "&pg=" + pageNumber : "");
    region$.trigger("apexbeforerefresh");
    return fetch(url, { credentials: "same-origin" }).then(function (response) { return response.text(); }).then(function (html) {
      var selector = "#" + apex.util.escapeCSS(id + suffix);
      var next$ = $("<div></div>").html(html).find(selector);
      if (!next$.length || !$(selector).length) return window.apexLocal.refreshRegion(id);
      $(selector).replaceWith(next$);
      region$.trigger("apexafterrefresh");
    });
  }
  // widget.facets 26.2 calls isFiltered() for star rating lists after counts update, which that
  // control type does not implement; skip that show-more recalculation instead of failing.
  function patchWidget() {
    var proto = $.apex && $.apex.facets && $.apex.facets.prototype;
    if (!proto || proto._apexLocalPatched) return;
    var update = proto._updateDisplayedItems;
    proto._updateDisplayedItems = function () {
      try {
        return update.apply(this, arguments);
      } catch (error) {
        if (!(error instanceof TypeError) || String(error.message).indexOf("isFiltered") < 0) throw error;
      }
    };
    proto._apexLocalPatched = true;
  }

  window.apexLocalFacets = {
    patchWidget: patchWidget,
    partRegion: function (id, suffix, type) {
      if (apex.region.isRegion(id)) apex.region.destroy(id);
      apex.region.create(id, { type: type, refresh: function () { return refreshPart(id, suffix); } });
    },
    refreshPart: refreshPart
  };
  $(document).on("click", "[data-apex-local-cards-page]", function (event) {
    event.preventDefault();
    refreshPart(this.getAttribute("data-region"), "_cards", this.getAttribute("data-apex-local-cards-page"));
  });

  // The filtered region refreshes when the facets change (the genuine report regions listen the same way).
  $(document).on("facetschange", "[data-apex-local-filtered]", function () {
    var fs$ = $(this), target = fs$.attr("data-apex-local-filtered");
    var names = (fs$.attr("data-apex-local-items") || "").split(",");
    fs$.facets("lock");
    post(fs$.attr("data-apex-local-region"), { items: itemValues(names), x01: "STATE" })
      .then(function () { return refresh(target); })
      .always(function () { fs$.facets("unlock"); });
  });

  // Cards: changing the order-by item stores it and refreshes the region.
  $(document).on("change", "select, input", function () {
    var name = this.id;
    if (!name) return;
    $("[data-apex-local-orderby]").filter(function () { return this.getAttribute("data-apex-local-orderby") === name; }).each(function () {
      var region = this.getAttribute("data-region"), items = {};
      items[name] = apex.item(name).getValue();
      post(region, { items: items, x01: "ITEM" }).then(function () { return refresh(region); });
    });
  });

  // List View search bar.
  $(document).on("input", "[data-apex-local-listview]", function () {
    var needle = this.value.toLowerCase();
    $("#" + apex.util.escapeCSS(this.getAttribute("data-apex-local-listview")) + "_listview > li").each(function () {
      this.classList.toggle("u-hidden", !!needle && this.textContent.toLowerCase().indexOf(needle) < 0);
    });
  });
})(apex.jQuery);
`.replace("__MESSAGES__", JSON.stringify(FACET_MESSAGES));

// packages/core/src/preview/extensions/facets/lists.ts
function rowSubstitute2(renderer, ctx, template, row) {
  const upper = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toUpperCase(), value]));
  const replaced = template.replace(
    /&([A-Za-z][\w$#]*?)(?:!([A-Z]+))?\./gu,
    (whole, name, filter) => {
      const key = name.toUpperCase();
      return key in upper ? applyEscape(String(upper[key] ?? ""), filter ?? "HTML") : whole;
    }
  );
  return renderer.substitute(ctx.session, replaced, ctx.page, "HTML");
}
var features = (region) => strings3(region.props, "settings.features").flatMap((value) => value.split(/[\s,:]+/u));
function renderListView(renderer, ctx, region) {
  const domId = renderer.regionDomId(region);
  const sql = renderer.regionSql(ctx, region);
  if (!sql)
    return `<div class="apex-local-unsupported">List View \u201C${escapeHtml(str(region.props, "name", region.id))}\u201D has no local source.</div>`;
  const result = renderer.query(
    ctx,
    region,
    sql,
    num(region.props, "reportLayout.numberOfRows", num(region.props, "settings.numberOfRows", 1e3))
  );
  ctx.onload.push(
    `apexLocalFacets.partRegion(${JSON.stringify(domId).replaceAll("<", "\\u003c")}, "_lv", "ListView");`
  );
  if (result.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(result.error)}</div></div>`;
  const options2 = new Set(features(region));
  const column = (key) => str(region.props, `settings.${key}`).toUpperCase();
  const text5 = column("textColumn") || result.columns[0] || "";
  const format2 = str(region.props, "settings.textFormatting");
  const target2 = get(region.props, "settings.linkTarget") ?? get(region.props, "link.target");
  let divider = "";
  const items = result.rows.map((row) => {
    const label = options2.has("advancedFormatting") && format2 ? rowSubstitute2(renderer, ctx, format2, row) : escapeHtml(row[text5] ?? "");
    const info = column("supplementalInformationColumn");
    const counter = column("counterColumn");
    const icon3 = column("iconClassColumn");
    const body3 = `${icon3 && row[icon3] ? `<span class="ui-li-icon fa ${escapeHtml(row[icon3])}" aria-hidden="true"></span>` : ""}${label}${info && row[info] !== null ? `<p class="ui-li-aside">${escapeHtml(row[info])}</p>` : ""}${counter && row[counter] !== null ? `<span class="ui-li-count">${escapeHtml(row[counter])}</span>` : ""}`;
    const dividerColumn = column("listDividerColumn");
    let heading2 = "";
    if (dividerColumn && String(row[dividerColumn] ?? "") !== divider) {
      divider = String(row[dividerColumn] ?? "");
      heading2 = `<li class="a-ListView-divider" role="heading">${escapeHtml(divider)}</li>`;
    }
    const href = target2 ? renderer.link(ctx, target2, row, `apex.jQuery('#${domId}')`) : "";
    return `${heading2}<li class="a-ListView-item${icon3 ? " has-icon" : ""}${counter ? " has-count" : ""}">${href ? `<a class="ui-btn" href="${escapeHtml(href)}">${body3}</a>` : body3}</li>`;
  }).join("");
  const search = options2.has("search") ? `<div class="a-ListView-searchbar"><input type="search" class="apex-item-text" placeholder="Search..." aria-label="Search" data-apex-local-listview="${escapeHtml(domId)}"></div>` : "";
  const empty = result.rows.length ? "" : `<span class="nodatafound">${renderer.substitute(ctx.session, str(region.props, "messages.whenNoDataFound", "No data found."), ctx.page, "HTML")}</span>`;
  return `${search}<div id="${escapeHtml(domId)}_lv"><ul class="a-ListView${options2.has("inset") ? " a-ListView--inset" : ""}" id="${escapeHtml(domId)}_listview" data-role="listview">${items}</ul>${empty}</div>`;
}

// packages/core/src/preview/extensions/facets/search.ts
var unfiltered = 0;
function baseSql(renderer, ctx, region) {
  unfiltered += 1;
  try {
    return renderer.regionSql(ctx, region);
  } finally {
    unfiltered -= 1;
  }
}
function filterSql(renderer, ctx, region, sql) {
  if (unfiltered) return void 0;
  let result = sql;
  for (const filters of filterRegionsFor(renderer, ctx, region)) {
    const facets = facetsOf(renderer, ctx, filters);
    if (!facets.some((facet) => facet.kind !== "group" && facetValue(renderer, ctx, facet) !== "")) continue;
    const columns = queryColumns(renderer, ctx, region, sql);
    result = where(result, predicates({ renderer, ctx, filters, columns }, facets));
  }
  return result === sql ? void 0 : result;
}
var yes = (value, fallback) => value === "" ? fallback : value !== "false";
function control(renderer, ctx, facet, lov, smart) {
  const props = facet.component.props;
  const label = renderer.substitute(ctx.session, facet.label, ctx.page, "RAW");
  const common = {
    name: facet.name,
    label,
    collapsible: bool(props, "advanced.collapsible", !smart),
    initialCollapsed: bool(props, "advanced.initiallyCollapsed", false),
    hasFeedback: bool(props, "listEntries.computeCounts", true),
    showCounts: bool(props, "listEntries.showCounts", true),
    displayAs: str(props, "appearance.display") === "addFilterDialog" ? "FILTER_DIALOG" : "INLINE",
    escape: bool(props, "security.escapeSpecialChars", true),
    includeLabel: bool(props, "label.showLabelForCurrentFacet", true)
  };
  const icon3 = str(props, "appearance.icon");
  if (icon3) common.icon = /(^|\s)fa-/u.test(icon3) && !/(^|\s)fa(\s|$)/u.test(icon3) ? `fa ${icon3}` : icon3;
  const cssClasses = str(props, "advanced.cssClasses");
  if (cssClasses) common.cssClasses = cssClasses;
  const maxHeight = num(props, "layout.maxHeight", 0);
  if (maxHeight) common.maxHeight = maxHeight;
  if (smart) common.suggestedValues = suggestions(renderer, ctx, facet);
  const listOptions = {
    values: lov,
    hideEmpty: str(props, "listEntries.zeroCountEntries") === "hide",
    disabledLast: str(props, "listEntries.zeroCountEntries") === "showLast",
    orderByCount: bool(props, "listEntries.sortByTopCounts", facet.kind === "list"),
    checkedFirst: bool(props, "listEntries.showSelectedFirst", false),
    showAllCount: num(props, "listEntries.maxDisplayedEntries", 7),
    allowExclude: facet.allowExclude,
    filterValues: bool(props, "listEntries.displayFilterInitially", false),
    actionsFilter: bool(props, "actionsMenu.filter", false)
  };
  const numberType = facet.number ? "NUMBER" : "VARCHAR2";
  switch (facet.kind) {
    case "group":
      return { ...common, type: "group", name: facet.name, showCounts: common.showCounts };
    case "checkbox":
      return { ...common, type: "checkbox", value: facet.checkedValue, altLabel: label };
    case "list":
      return {
        ...common,
        ...listOptions,
        type: "list",
        multiple: facet.multiple,
        hideRadioButton: bool(props, "settings.hideRadioButtons", false)
      };
    case "selectList":
      return {
        ...common,
        type: "selectList",
        values: lov,
        hideEmpty: listOptions.hideEmpty,
        nullLabel: str(props, "appearance.valuePlaceholder", "- Select -")
      };
    case "rangeList":
      if (!lov.length)
        return { ...common, type: "range", dataType: numberType, allowOpen: true, ...rangeText(props) };
      return {
        ...common,
        ...listOptions,
        orderByCount: false,
        type: "rangeList",
        multiple: facet.multiple,
        noManualEntry: !bool(props, "settings.manualEntry", true),
        allowOpen: true,
        dataType: numberType,
        ...rangeText(props)
      };
    case "starRating":
      return {
        ...common,
        // The genuine star rating control has no "show all" or value filtering.
        values: lov,
        hideEmpty: listOptions.hideEmpty,
        type: "starRating",
        activeIcon: "fa fa-star",
        activeColor: str(props, "settings.activeColor") || void 0,
        inactiveColor: str(props, "settings.inactiveColor") || void 0,
        itemLabel: "APEX.FS.STAR_RATING_LABEL"
      };
    default:
      return {
        ...common,
        type: "input",
        dataType: numberType,
        inputLabel: str(props, "appearance.valuePlaceholder") || void 0,
        suffixText: str(props, "settings.suffixText") || void 0,
        flexibleOperator: bool(props, "settings.userCanChooseOperator", false)
      };
  }
}
function rangeText(props) {
  const result = { rangeText: "to" };
  for (const [key, option] of [
    ["prefixText", "prefixText"],
    ["suffixText", "suffixText"],
    ["rangeText", "rangeText"],
    ["currentLabel", "currentLabel"],
    ["currentLabelOpenHi", "currentLabelOpenHigh"],
    ["currentLabelOpenLow", "currentLabelOpenLow"]
  ]) {
    const value = str(props, `settings.${option}`);
    if (value) result[key] = value;
  }
  return result;
}
function suggestions(renderer, ctx, facet) {
  const props = facet.component.props;
  const type = str(props, "suggestions.type");
  if (type === "staticValues") {
    const values = get(props, "suggestions.staticValues");
    return Array.isArray(values) ? values.map(String) : str(props, "suggestions.staticValues").split(",");
  }
  if (type === "sqlQuery") {
    try {
      return renderer.db.query(str(props, "suggestions.sqlQuery"), renderer.binds(ctx.session, ctx.page), 50).rows.map((row) => String(Object.values(row)[0] ?? ""));
    } catch (error) {
      renderer.diagnose(
        "warning",
        `Suggestions query of filter ${facet.name} failed: ${error.message}`,
        ctx.pageId
      );
      return false;
    }
  }
  return ["list", "rangeList", "selectList", "starRating", "checkbox"].includes(facet.kind);
}
var SUPPORTED_SETTINGS = /* @__PURE__ */ new Set([
  "batchFacetChanges",
  "compactNosThreshold",
  "currentFacetsSelector",
  "displayChartForTopNValues",
  "showCharts",
  "chartsSelector",
  "showCurrentFacets",
  "showTotalRowCount",
  "totalRowCountLabel",
  "totalRowCountSelector",
  "maximumSuggestionChips",
  "maxSuggestionChips",
  "showMoreFiltersChip",
  "collapsibleSearchBar"
]);
function renderFilters(renderer, ctx, region) {
  const smart = str(region.props, "type") === "smartFilters";
  const domId = renderer.regionDomId(region);
  const target2 = filteredRegion(renderer, ctx, region);
  if (!target2) {
    renderer.diagnose(
      "warning",
      `${smart ? "Smart Filters" : "Faceted Search"} region ${region.id} has no filtered region`,
      ctx.pageId,
      region.id
    );
    return `<div class="apex-local-unsupported">\u201C${escapeHtml(str(region.props, "name", region.id))}\u201D has no filtered region.</div>`;
  }
  const settings2 = get(region.props, "settings");
  for (const key of Object.keys(
    typeof settings2 === "object" && settings2 && !Array.isArray(settings2) ? settings2 : {}
  ))
    if (!SUPPORTED_SETTINGS.has(key))
      renderer.diagnose(
        "info",
        `Setting ${key} of region ${region.id} is not simulated`,
        ctx.pageId,
        region.id
      );
  if (str(region.props, "settings.showCharts", smart ? "false" : "dialog") !== "false")
    renderer.diagnose(
      "info",
      `Facet charts of region ${region.id} need Oracle JET and are not shown locally`,
      ctx.pageId,
      region.id
    );
  const facets = facetsOf(renderer, ctx, region);
  const sql = baseSql(renderer, ctx, target2);
  const columns = sql ? queryColumns(renderer, ctx, target2, sql) : [];
  const base = { region: target2, sql: sql ?? "select 1 from dual where 1 = 0", columns };
  const search = facets.find((facet) => facet.kind === "search");
  const items = [];
  const hidden2 = (name, value) => {
    items.push(name);
    return `<input type="hidden" name="${escapeHtml(name)}" id="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
  };
  const inputs = [];
  const controls = facets.filter((facet) => facet.kind !== "search").map((facet) => {
    inputs.push(hidden2(facet.name, facet.kind === "group" ? "" : facetValue(renderer, ctx, facet)));
    const lov = ["list", "rangeList", "selectList", "starRating"].includes(facet.kind) ? facetLov(renderer, ctx, facet, base) : [];
    return control(renderer, ctx, facet, lov, smart);
  });
  const searchName = search?.name ?? "";
  if (search) inputs.push(hidden2(search.name, facetValue(renderer, ctx, search)));
  const currentFacets = str(region.props, "settings.showCurrentFacets", "true");
  const totalCountSetting = str(region.props, "settings.showTotalRowCount", smart ? "false" : "true");
  const options2 = {
    regionDomId: domId,
    ajaxIdentifier: `apexlocal:facets:${domId}`,
    uiMode: smart ? "S" : "F",
    batch: bool(region.props, "settings.batchFacetChanges", false),
    feedback: true,
    searchField: Boolean(searchName),
    searchItem: searchName || null,
    multipleSearches: smart,
    currentFacets: currentFacets === "selector" ? str(region.props, "settings.currentFacetsSelector") || true : currentFacets !== "false",
    showTotalCount: totalCountSetting === "selector" ? str(region.props, "settings.totalRowCountSelector") : yes(totalCountSetting, true),
    showCharts: false,
    controls,
    text: {
      searchLabel: search ? renderer.substitute(ctx.session, search.label, ctx.page, "RAW") : "Search",
      searchPlaceholder: search && str(search.component.props, "appearance.valuePlaceholder") || "Search",
      totalCountLabel: str(region.props, "settings.totalRowCountLabel", "Total Row Count")
    }
  };
  if (smart) {
    options2.maxChips = num(
      region.props,
      "settings.maximumSuggestionChips",
      num(region.props, "settings.maxSuggestionChips", 5)
    );
    options2.moreFiltersChip = bool(region.props, "settings.showMoreFiltersChip", true);
    const collapsible = get(region.props, "settings.collapsibleSearchBar");
    if (typeof collapsible === "boolean") options2.collapsibleSearchBar = collapsible;
  }
  const threshold = num(region.props, "settings.compactNosThreshold", 0);
  if (threshold) options2.numberFormatThreshold = threshold;
  ctx.jsFiles.add("#APEX_FILES#libraries/apex/#MIN_DIRECTORY#widget.facets#MIN#.js?v=#APEX_VERSION#");
  if (controls.some((entry) => entry.filterValues || entry.actionsFilter))
    ctx.jsFiles.add("#APEX_FILES#libraries/apex/#MIN_DIRECTORY#widget.filterable#MIN#.js?v=#APEX_VERSION#");
  const widgetId = `${domId}_FS`;
  ctx.onload.push(
    `apexLocalFacets.patchWidget();apex.jQuery('#${widgetId}').facets(${JSON.stringify(options2).replaceAll("<", "\\u003c")});`
  );
  return `<div id="${escapeHtml(widgetId)}" data-apex-local-region="${escapeHtml(domId)}" data-apex-local-filtered="${escapeHtml(renderer.regionDomId(target2))}" data-apex-local-items="${escapeHtml(items.join(","))}"></div><div class="apex-local-facet-items" hidden>${inputs.join("")}</div>`;
}
function facetsRoute(renderer, session, request) {
  const json3 = (body3, status = 200) => ({
    status,
    type: "json",
    body: JSON.stringify(body3)
  });
  let input;
  try {
    input = JSON.parse(request.body || "{}");
  } catch {
    return json3({ error: "Invalid JSON" }, 400);
  }
  const pageKey = request.params.get("page") ?? "";
  if (!renderer.findPage(pageKey)) return json3({ error: `Page ${pageKey} does not exist` }, 404);
  const ctx = renderer.prepare(session, pageKey);
  const regionId = request.params.get("region") ?? "";
  const region = renderer.pageComponents(ctx, "region").find((candidate) => renderer.regionDomId(candidate) === regionId || candidate.id === regionId);
  if (!region) return json3({ error: `Region ${regionId} not found` }, 404);
  const value = (raw) => Array.isArray(raw) ? raw.join(":") : String(raw ?? "");
  if (input.x01 === "ITEM") {
    for (const [name, raw] of Object.entries(input.items ?? {}))
      if (renderer.isKnownItem(name.toUpperCase())) session.items[name.toUpperCase()] = value(raw);
    delete session.pagination[`${ctx.pageId}:${region.id}`];
    return json3({});
  }
  if (!FILTER_REGION_TYPES.has(str(region.props, "type")))
    return json3({ error: `Region ${regionId} is not a faceted search region` }, 400);
  const facets = facetsOf(renderer, ctx, region);
  const smart = str(region.props, "type") === "smartFilters";
  const names = new Set(facets.map((facet) => facet.name));
  const target2 = filteredRegion(renderer, ctx, region);
  let changed = false;
  for (const [name, raw] of Object.entries(input.items ?? {})) {
    const key = name.toUpperCase();
    if (!names.has(key)) continue;
    if ((session.items[key] ?? "") !== value(raw)) changed = true;
    session.items[key] = value(raw);
  }
  if (changed && target2) delete session.pagination[`${ctx.pageId}:${target2.id}`];
  if (input.x01 === "STATE" || !target2) return json3({});
  const sql = baseSql(renderer, ctx, target2);
  if (!sql) return json3({ counts: {}, totalCount: 0 });
  const columns = queryColumns(renderer, ctx, target2, sql);
  const context = { renderer, ctx, filters: region, columns };
  let hiddenFacets = [];
  try {
    hiddenFacets = input.x02 ? JSON.parse(input.x02) : [];
  } catch {
    hiddenFacets = [];
  }
  const base = { region: target2, sql, columns };
  const counts = {};
  for (const facet of facets) {
    if (hiddenFacets.includes(facet.name) || ["search", "input", "group"].includes(facet.kind)) continue;
    if (!bool(facet.component.props, "listEntries.computeCounts", true)) continue;
    const lov = ["rangeList", "starRating"].includes(facet.kind) ? facetLov(renderer, ctx, facet, base) : [];
    counts[facet.name] = facetCounts(context, facets, facet, base, lov);
  }
  return json3({ counts, totalCount: totalCount(context, facets, base) });
}

// packages/core/src/preview/extensions/facets.ts
registerExtension({
  name: "facets",
  regions: {
    facetedSearch: (renderer, ctx, region) => renderFilters(renderer, ctx, region),
    smartFilters: (renderer, ctx, region) => renderFilters(renderer, ctx, region),
    cards: (renderer, ctx, region) => renderCards(renderer, ctx, region),
    listView: (renderer, ctx, region) => renderListView(renderer, ctx, region)
    // The Region Display Selector is owned by the components module.
  },
  regionSql: filterSql,
  routes: { facets: facetsRoute },
  client: FACETS_CLIENT,
  css: `.apex-local-facet-items{display:none}`
});

// packages/core/src/preview/extensions/items/client.ts
var ITEMS_CLIENT = String.raw`
(function ($) {
  "use strict";
  var base = location.pathname.replace(/\/[^/]*$/, "");

  // English UI texts the item widgets look up (APEX serves them from its message catalog).
  apex.lang.addMessages(${JSON.stringify({
  "APEX.DATEPICKER.CLEAR": "Clear",
  "APEX.DATEPICKER.DONE": "Done",
  "APEX.DATEPICKER.TODAY": "Today",
  "APEX.DATEPICKER.NEXT_MONTH": "Next Month",
  "APEX.DATEPICKER.PREVIOUS_MONTH": "Previous Month",
  "APEX.DATEPICKER.MONTH": "Month",
  "APEX.DATEPICKER.YEAR": "Year",
  "APEX.DATEPICKER.HOUR": "Hour",
  "APEX.DATEPICKER.MINUTES": "Minutes",
  "APEX.DATEPICKER.AM_PM": "AM/PM",
  "APEX.DATEPICKER.ACTIONS": "Actions",
  "APEX.DATEPICKER.ISO_WEEK": "Week",
  "APEX.DATEPICKER.ISO_WEEK_ABBR": "Wk",
  "APEX.DATEPICKER.SELECT_DATE": "Select Date",
  "APEX.DATEPICKER.SELECT_DATE_AND_TIME": "Select Date and Time",
  "APEX.DATEPICKER.SELECT_DAY": "Select Day",
  "APEX.DATEPICKER.SELECT_MONTH_AND_YEAR": "Select Month and Year",
  "APEX.DATEPICKER.SELECT_TIME": "Select Time",
  "APEX.DATEPICKER.ICON_TEXT": "Calendar for %0",
  "APEX.DATEPICKER.POPUP": "Calendar popup for %0",
  "APEX.DATEPICKER.VALUE_INVALID": "#LABEL# is not a valid date, for example %0.",
  "APEX.DATEPICKER.VALUE_MUST_BE_BETWEEN": "#LABEL# must be between %0 and %1.",
  "APEX.DATEPICKER.VALUE_MUST_BE_ON_OR_AFTER": "#LABEL# must be %0 or later.",
  "APEX.DATEPICKER.VALUE_MUST_BE_ON_OR_BEFORE": "#LABEL# must be %0 or earlier.",
  "APEX.POPUP_LOV.TITLE": "Search",
  "APEX.POPUP_LOV.NO_RESULTS": "No results.",
  "APEX.POPUP_LOV.INITIAL_FILTER_REQ": "Type to search.",
  "APEX.POPUP_LOV.FILTER_REQ": "Type at least %0 characters to search.",
  "APEX.POPUP_LOV.REMOVE_VALUE": "Remove %0",
  "APEX.POPUP_LOV.VALUE_ADDED": "Added %0",
  "APEX.POPUP_LOV.GRID_ARIA_LABEL": "Results",
  "APEX.POPUP.SEARCH": "Search",
  "APEX.CS.NO_MATCHES": "No matches",
  "APEX.CS.OTHERS_GROUP": "Other",
  "APEX.CS.LOADING_DATA": "Loading",
  "APEX.CS.MATCH_FOUND": "1 match",
  "APEX.CS.MATCHES_FOUND": "%0 matches",
  "APEX.CS.ACTIVE_VALUE_CHIP": "%0, Backspace removes it.",
  "APEX.CS.SELECTED_VALUES_COUNTER": "%0 selected",
  "APEX.COMBOBOX.LIST_OF_VALUES": "List of values",
  "APEX.COMBOBOX.SHOW_ALL_VALUES": "Show values for %0",
  "APEX.ITEM.CLEAR_BTN": "Clear",
  "APEX.ITEM.HELP_TEXT": "Help for %0",
  "APEX.ITEM.FILE.CHOOSE_FILE": "Choose File",
  "APEX.ITEM.FILE.CHOOSE_FILES": "Choose Files",
  "APEX.ITEM.FILE.DROP_FILE": "Drop a file here",
  "APEX.ITEM.FILE.DROP_OR_CHOOSE_FILE": "Choose a file or drop it here.",
  "APEX.ITEM.FILE.DROP_OR_SELECT_FILE": "Choose a file or drop it here.",
  "APEX.ITEM.FILE.FILES_WITH_COUNT": "%0 files",
  "APEX.ITEM.FILE.MAX_FILE_SIZE": "The file is larger than %0.",
  "APEX.ITEM.FILE.ACCEPTED_TYPES": "Allowed file types: %0.",
  "APEX.ITEM.FILE.MULTIPLE_FILES_NOT_SUPPORTED": "Only one file can be uploaded.",
  "APEX.ITEM.IMAGE_UPLOAD.CHOOSE_FILE": "Choose Image",
  "APEX.ITEM.IMAGE_UPLOAD.CHOOSE_FILES": "Choose Images",
  "APEX.ITEM.IMAGE_UPLOAD.DROP_FILE": "Drop an image here",
  "APEX.ITEM.IMAGE_UPLOAD.DROP_FILES": "Drop images here",
  "APEX.ITEM.IMAGE_UPLOAD.DROP_OR_CHOOSE_FILE": "Choose an image or drop it here.",
  "APEX.ITEM.IMAGE_UPLOAD.DROP_OR_SELECT_FILE": "Choose an image or drop it here.",
  "APEX.ITEM.IMAGE_UPLOAD.DROP_OR_CHOOSE_FILES": "Choose images or drop them here.",
  "APEX.ITEM.IMAGE_UPLOAD.DROP_OR_SELECT_FILES": "Choose images or drop them here.",
  "APEX.FILESIZE.BYTES": "%0 bytes",
  "APEX.FILESIZE.KB": "%0 KB",
  "APEX.FILESIZE.MB": "%0 MB",
  "APEX.FILESIZE.GB": "%0 GB",
  "APEX.ITEM_TYPE.CHECKBOX.CHECKED": "Checked",
  "APEX.ITEM_TYPE.CHECKBOX.UNCHECKED": "Unchecked",
  "APEX.PASSWORD.SHOW_PASSWORD": "Show Password",
  "APEX.PASSWORD.HIDE_PASSWORD": "Hide Password",
  "APEX.TEXTAREA.CHAR_COUNT": "%0 characters",
  "APEX.TEXTAREA.MAX_CHAR_COUNT": "%0 of %1 characters",
  "APEX.TEXTAREA.MAX_CHAR": "Limit reached: %0 of %1 characters.",
  "APEX.NUMBER_FIELD.VALUE_NOT_BETWEEN_MIN_MAX": "#LABEL# must be between %0 and %1.",
  "APEX.NUMBER_FIELD.VALUE_LESS_MIN_VALUE": "#LABEL# must be at least %0.",
  "APEX.NUMBER_FIELD.VALUE_GREATER_MAX_VALUE": "#LABEL# must be at most %0.",
  "APEX.COLOR_PICKER.INVALID_COLOR": "#LABEL# is not a valid color, for example %0.",
  "APEX.COLOR_PICKER.OPEN": "Open color picker",
  "APEX.COLOR_PICKER.TITLE": "Pick a color",
  "APEX.COLOR_PICKER.CURRENT": "Current",
  "APEX.COLOR_PICKER.INITIAL": "Initial",
  "APEX.COLOR_PICKER.CONTRAST": "Contrast",
  "APEX.COLOR_PICKER.MORE_PRESET_COLORS": "More colors",
  "APEX.COLOR_PICKER.TOGGLE_TITLE": "Switch color format",
  "APEX.MARKDOWN.BOLD": "Bold",
  "APEX.MARKDOWN.ITALIC": "Italic",
  "APEX.MARKDOWN.STRIKETHROUGH": "Strikethrough",
  "APEX.MARKDOWN.INLINE_CODE": "Code",
  "APEX.MARKDOWN.LIST": "List",
  "APEX.MARKDOWN.UNORDERED_LIST": "Bulleted List",
  "APEX.MARKDOWN.ORDERED_LIST": "Numbered List",
  "APEX.MARKDOWN.LINK": "Link",
  "APEX.MARKDOWN.INSERT_LINK": "Insert Link",
  "APEX.MARKDOWN.IMAGE": "Image",
  "APEX.MARKDOWN.INSERT_IMAGE": "Insert Image",
  "APEX.MARKDOWN.PREVIEW": "Preview",
  "APEX.TMV.SELECTOR_LABEL": "Select",
  "APEX.GV.SELECTION_COUNT": "%0 selected",
  "APEX.GV.LOAD_MORE": "Show More",
  "APEX.GV.LOAD_ALL": "Show All",
  "APEX.GV.SORT_ASCENDING": "Sort Ascending",
  "APEX.GV.SORT_DESCENDING": "Sort Descending",
  "APEX.GV.SORT_OFF": "No Sort",
  "APEX.GV.SORTED_ASCENDING": "Sorted ascending %0",
  "APEX.GV.SORTED_DESCENDING": "Sorted descending %0",
  PCT_GRAPH_ARIA_LABEL: "Percent"
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
var ITEMS_CSS = `
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

// packages/core/src/preview/extensions/items/common.ts
import fs5 from "node:fs";
import path5 from "node:path";
var apexScript = (name) => `#APEX_FILES#libraries/apex/#MIN_DIRECTORY#${name}#MIN#.js?v=#APEX_VERSION#`;
var LIBRARY_DEFAULTS = { markedjs: "18.0.11", purify: "3.4.14" };
var libraryCache = /* @__PURE__ */ new Map();
function libraryVersion(renderer, library) {
  const key = `${renderer.assets.imagesDir}|${library}`;
  if (!libraryCache.has(key)) {
    let version = LIBRARY_DEFAULTS[library] ?? "";
    try {
      const found = fs5.readdirSync(path5.join(renderer.assets.imagesDir, "libraries", library), { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^\d/u.test(entry.name)).map((entry) => entry.name).sort();
      if (found.length) version = found.at(-1);
    } catch {
    }
    libraryCache.set(key, version);
  }
  return libraryCache.get(key);
}
function libVersions(renderer) {
  const entries = [
    ["domPurify", "purify"],
    ["cropperJs", "cropperjs"],
    ["jquery", "jquery"],
    ["jqueryUi", "jquery-ui"],
    ["hammer", "hammer"],
    ["markedJs", "markedjs"]
  ];
  return Object.fromEntries(
    entries.map(([key, library]) => [key, libraryVersion(renderer, library)]).filter(([, version]) => version)
  );
}
var itemState = /* @__PURE__ */ new WeakMap();
function state(item2) {
  let entry = itemState.get(item2);
  if (!entry) {
    entry = {};
    itemState.set(item2, entry);
  }
  return entry;
}
function strings4(value) {
  if (value === void 0) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.map((entry) => typeof entry === "string" ? entry : isRef(entry) ? entry.ref : String(entry)).flatMap((entry) => entry.split(/[\s,]+/u)).filter(Boolean);
}
function attrs(values) {
  return Object.entries(values).filter(([, value]) => value !== void 0 && value !== null && value !== false).map(([key, value]) => value === true ? ` ${key}` : ` ${key}="${escapeHtml(value)}"`).join("");
}
function setting(renderer, item2, key, fallback = "") {
  const own = get(item2.props, `settings.${key}`);
  if (own !== void 0) return strings4(own).join(":") || str(item2.props, `settings.${key}`, fallback);
  if (bool(item2.props, "settings.useDefaults", true)) {
    const type = str(item2.props, "type");
    const component = renderer.app.shared.find(
      (entry) => entry.type === "componentSetting" && str(entry.props, "type") === "item" && str(entry.props, "name") === type
    );
    const shared = component ? get(component.props, `settings.${key}`) : void 0;
    if (shared !== void 0)
      return Array.isArray(shared) ? strings4(shared).join(":") : str(component.props, `settings.${key}`);
  }
  return fallback;
}
function flag(renderer, item2, key, fallback) {
  const value = setting(renderer, item2, key, "");
  if (value === "") return fallback;
  return value === "true" || value === "Y";
}
function elementExtras(renderer, ctx, item2) {
  const custom = str(item2.props, "advanced.customAttributes");
  return {
    classes: strings4(get(item2.props, "advanced.cssClasses")),
    attributes: custom ? ` ${renderer.substitute(ctx.session, custom, ctx.page, "RAW")}` : ""
  };
}
function placeholder(renderer, ctx, item2) {
  const value = str(item2.props, "appearance.valuePlaceholder", str(item2.props, "appearance.placeholder"));
  return value ? renderer.substitute(ctx.session, value, ctx.page, "RAW") : "";
}
var required = (item2) => bool(item2.props, "validation.valueRequired", false);
function isReadOnly(renderer, ctx, item2) {
  const own = (props) => isObject(get(props, "readOnly")) && str(props, "readOnly.type") !== "" ? renderer.condition(ctx, props, "readOnly") : false;
  if (own(item2.props)) return true;
  const regions = renderer.pageComponents(ctx, "region");
  let regionId = ref(item2.props, "layout.region");
  for (let guard = 0; regionId && guard < 10; guard += 1) {
    const region = regions.find((candidate) => candidate.id === regionId);
    if (!region) break;
    if (own(region.props)) return true;
    regionId = ref(region.props, "layout.parentRegion");
  }
  return false;
}
function separator(item2) {
  return str(item2.props, "multipleValues.separator", ":") || ":";
}
function splitValues(item2, value) {
  if (value === "") return [];
  if (str(item2.props, "multipleValues.type") === "jsonArray" || value.startsWith("[")) {
    try {
      const parsed2 = JSON.parse(value);
      if (Array.isArray(parsed2)) return parsed2.map(String);
    } catch {
    }
  }
  return value.split(separator(item2));
}
function ajaxIdentifier(ctx, name) {
  return `LOCAL:${ctx.pageId}:${name}`;
}
function cascading(item2) {
  const selector = (key) => strings4(get(item2.props, key)).map((name) => `#${name.toUpperCase()}`).join(",");
  return {
    parents: selector("cascadingLov.parentItems"),
    submit: selector("cascadingLov.itemsToSubmit"),
    required: bool(item2.props, "cascadingLov.parentRequired", true)
  };
}
function lovEntries(renderer, ctx, item2, options2 = {}) {
  const name = item2.id.toUpperCase();
  const parents = cascading(item2);
  const parentEmpty = parents.parents !== "" && parents.required && strings4(get(item2.props, "cascadingLov.parentItems")).some(
    (parent) => (ctx.session.items[parent.toUpperCase()] ?? "") === ""
  );
  const rows = parentEmpty ? [] : renderer.lov(ctx, get(item2.props, "lov"), name);
  const entries = [];
  if (bool(item2.props, "lov.displayNullValue", options2.nullDefault ?? false))
    entries.push({
      d: str(item2.props, "lov.nullDisplayValue", options2.nullText ?? ""),
      r: str(item2.props, "lov.nullReturnValue")
    });
  entries.push(...rows);
  if (bool(item2.props, "lov.displayExtraValues", true)) {
    for (const value of options2.values ?? [])
      if (value !== "" && !entries.some((entry) => entry.r === value)) entries.push({ d: value, r: value });
  }
  return entries;
}
function lovRows(renderer, ctx, item2) {
  const spec = get(item2.props, "lov");
  const name = item2.id.toUpperCase();
  const fallback = () => {
    const entries = lovEntries(renderer, ctx, item2).filter((entry) => entry.r !== "" || entry.d !== "");
    return {
      columns: [{ name: "D", heading: renderer.label(item2), searchable: true }],
      display: "D",
      returned: "R",
      rows: entries.map((entry) => ({ D: entry.d, R: entry.r }))
    };
  };
  if (!isObject(spec)) return fallback();
  const shared = ref(spec, "lov") ? renderer.shared("lov", ref(spec, "lov")) : void 0;
  let sql = "";
  let display;
  let returned;
  let declared = [];
  if (shared) {
    const table = str(shared.props, "source.tableName");
    sql = str(shared.props, "source.sqlQuery") || (table ? `select * from ${table}` : "");
    display = str(shared.props, "columnMapping.display") || void 0;
    returned = str(shared.props, "columnMapping.return") || void 0;
    declared = shared.children.filter((child) => child.type === "column" && bool(child.props, "show", true)).sort((a, b) => num(a.props, "layout.sequence", 0) - num(b.props, "layout.sequence", 0)).map((child) => {
      const column = str(child.props, "columnName", child.id).toUpperCase();
      return {
        name: column,
        heading: str(child.props, "heading.heading", column),
        searchable: bool(child.props, "advanced.searchable", true)
      };
    });
  } else if (str(spec, "type") === "sqlQuery" || spec.sqlQuery !== void 0) sql = str(spec, "sqlQuery");
  if (!sql) return fallback();
  const parents = cascading(item2);
  if (parents.parents && parents.required && strings4(get(item2.props, "cascadingLov.parentItems")).some(
    (parent) => (ctx.session.items[parent.toUpperCase()] ?? "") === ""
  ))
    return { ...fallback(), rows: [] };
  try {
    const result = renderer.db.query(sql, renderer.binds(ctx.session, ctx.page), 5e3);
    const displayColumn = display?.toUpperCase() ?? result.columns[0];
    const returnColumn = returned?.toUpperCase() ?? result.columns[1] ?? displayColumn;
    const columns = declared.length ? declared : [{ name: displayColumn, heading: renderer.label(item2), searchable: true }];
    if (!columns.some((column) => column.name === displayColumn))
      columns.unshift({ name: displayColumn, heading: renderer.label(item2), searchable: true });
    return {
      columns,
      display: displayColumn,
      returned: returnColumn,
      rows: result.rows.map(
        (row) => Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, value === null ? "" : String(value)])
        )
      )
    };
  } catch (error) {
    renderer.diagnose("warning", `LOV query failed: ${error.message}`, ctx.pageId, name);
    return fallback();
  }
}
function displayFor(entries, values) {
  return values.map((value) => entries.find((entry) => entry.r === value)?.d ?? value);
}

// packages/core/src/preview/extensions/items/qrcode.ts
var ECC_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
var FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
var ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];
var NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
];
var bit = (value, index) => (value >>> index & 1) !== 0;
function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}
function dataCodewords(version, ecc) {
  const index = ECC_INDEX[ecc];
  return Math.floor(rawDataModules(version) / 8) - ECC_CODEWORDS_PER_BLOCK[index][version] * NUM_ERROR_CORRECTION_BLOCKS[index][version];
}
function multiply(x, y) {
  let z = 0;
  for (let index = 7; index >= 0; index -= 1) {
    z = z << 1 ^ (z >>> 7) * 285;
    z ^= (y >>> index & 1) * x;
  }
  return z & 255;
}
function divisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = multiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = multiply(root, 2);
  }
  return result;
}
function remainder(data, generator) {
  const result = generator.map(() => 0);
  for (const value of data) {
    const factor = value ^ result.shift();
    result.push(0);
    generator.forEach((coefficient, index) => {
      result[index] ^= multiply(coefficient, factor);
    });
  }
  return result;
}
function interleave(data, version, ecc) {
  const index = ECC_INDEX[ecc];
  const blocks = NUM_ERROR_CORRECTION_BLOCKS[index][version];
  const eccLength = ECC_CODEWORDS_PER_BLOCK[index][version];
  const raw = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blocks - raw % blocks;
  const shortLength = Math.floor(raw / blocks);
  const generator = divisor(eccLength);
  const parts = [];
  for (let block = 0, offset = 0; block < blocks; block += 1) {
    const chunk = data.slice(offset, offset + shortLength - eccLength + (block < shortBlocks ? 0 : 1));
    offset += chunk.length;
    const check = remainder(chunk, generator);
    if (block < shortBlocks) chunk.push(0);
    parts.push([...chunk, ...check]);
  }
  const result = [];
  for (let position2 = 0; position2 < parts[0].length; position2 += 1)
    parts.forEach((part2, block) => {
      if (position2 !== shortLength - eccLength || block >= shortBlocks) result.push(part2[position2]);
    });
  return result;
}
var Matrix = class {
  constructor(version) {
    this.version = version;
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
  }
  version;
  size;
  modules;
  fixed;
  set(x, y, dark) {
    this.modules[y][x] = dark;
    this.fixed[y][x] = true;
  }
  alignmentPositions() {
    if (this.version === 1) return [];
    const count = Math.floor(this.version / 7) + 2;
    const step = Math.floor((this.version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
    const result = [6];
    for (let position2 = this.size - 7; result.length < count; position2 -= step) result.splice(1, 0, position2);
    return result;
  }
  functionPatterns() {
    for (let index = 0; index < this.size; index += 1) {
      this.set(6, index, index % 2 === 0);
      this.set(index, 6, index % 2 === 0);
    }
    for (const [cx, cy] of [
      [3, 3],
      [this.size - 4, 3],
      [3, this.size - 4]
    ]) {
      for (let dy = -4; dy <= 4; dy += 1)
        for (let dx = -4; dx <= 4; dx += 1) {
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < this.size && y >= 0 && y < this.size)
            this.set(x, y, distance !== 2 && distance !== 4);
        }
    }
    const positions = this.alignmentPositions();
    const count = positions.length;
    for (let i = 0; i < count; i += 1)
      for (let j = 0; j < count; j += 1) {
        if (i === 0 && j === 0 || i === 0 && j === count - 1 || i === count - 1 && j === 0) continue;
        for (let dy = -2; dy <= 2; dy += 1)
          for (let dx = -2; dx <= 2; dx += 1)
            this.set(positions[i] + dx, positions[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    this.format("M", 0);
    if (this.version >= 7) {
      let rem = this.version;
      for (let index = 0; index < 12; index += 1) rem = rem << 1 ^ (rem >>> 11) * 7973;
      const bits = this.version << 12 | rem;
      for (let index = 0; index < 18; index += 1) {
        const dark = bit(bits, index);
        const a = this.size - 11 + index % 3;
        const b = Math.floor(index / 3);
        this.set(a, b, dark);
        this.set(b, a, dark);
      }
    }
  }
  format(ecc, mask) {
    const data = FORMAT_BITS[ecc] << 3 | mask;
    let rem = data;
    for (let index = 0; index < 10; index += 1) rem = rem << 1 ^ (rem >>> 9) * 1335;
    const bits = (data << 10 | rem) ^ 21522;
    for (let index = 0; index <= 5; index += 1) this.set(8, index, bit(bits, index));
    this.set(8, 7, bit(bits, 6));
    this.set(8, 8, bit(bits, 7));
    this.set(7, 8, bit(bits, 8));
    for (let index = 9; index < 15; index += 1) this.set(14 - index, 8, bit(bits, index));
    for (let index = 0; index < 8; index += 1) this.set(this.size - 1 - index, 8, bit(bits, index));
    for (let index = 8; index < 15; index += 1) this.set(8, this.size - 15 + index, bit(bits, index));
    this.set(8, this.size - 8, true);
  }
  codewords(data) {
    let index = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < this.size; vertical += 1)
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          const upward = (right + 1 & 2) === 0;
          const y = upward ? this.size - 1 - vertical : vertical;
          if (!this.fixed[y][x] && index < data.length * 8) {
            this.modules[y][x] = bit(data[index >>> 3], 7 - (index & 7));
            index += 1;
          }
        }
    }
  }
  mask(mask) {
    for (let y = 0; y < this.size; y += 1)
      for (let x = 0; x < this.size; x += 1) {
        const invert = [
          (x + y) % 2 === 0,
          y % 2 === 0,
          x % 3 === 0,
          (x + y) % 3 === 0,
          (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
          x * y % 2 + x * y % 3 === 0,
          (x * y % 2 + x * y % 3) % 2 === 0,
          ((x + y) % 2 + x * y % 3) % 2 === 0
        ][mask];
        if (!this.fixed[y][x] && invert) this.modules[y][x] = !this.modules[y][x];
      }
  }
  /** Rules 1, 2 and 4 of the mask penalty (runs, 2x2 blocks, dark balance). */
  penalty() {
    let score = 0;
    const runs = (line) => {
      let run2 = 1;
      for (let index = 1; index <= line.length; index += 1) {
        if (index < line.length && line[index] === line[index - 1]) run2 += 1;
        else {
          if (run2 >= 5) score += run2 - 2;
          run2 = 1;
        }
      }
    };
    for (let index = 0; index < this.size; index += 1) {
      runs(this.modules[index]);
      runs(this.modules.map((row) => row[index]));
    }
    let dark = 0;
    for (let y = 0; y < this.size; y += 1)
      for (let x = 0; x < this.size; x += 1) {
        if (this.modules[y][x]) dark += 1;
        if (x < this.size - 1 && y < this.size - 1 && this.modules[y][x] === this.modules[y][x + 1] && this.modules[y][x] === this.modules[y + 1][x] && this.modules[y][x] === this.modules[y + 1][x + 1])
          score += 3;
      }
    const total = this.size * this.size;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }
};
function qrMatrix(text5, ecc = "M") {
  const bytes = [...Buffer.from(text5, "utf8")];
  let version = 1;
  for (; version <= 40; version += 1) {
    const countBits = version <= 9 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(version, ecc) * 8) break;
  }
  if (version > 40) throw new Error("QR code data is too long");
  const capacity = dataCodewords(version, ecc) * 8;
  const bits = [];
  const push = (value, length) => {
    for (let index = length - 1; index >= 0; index -= 1) bits.push(value >>> index & 1);
  };
  push(4, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const value of bytes) push(value, 8);
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - bits.length % 8) % 8);
  for (let pad2 = 236; bits.length < capacity; pad2 ^= 236 ^ 17) push(pad2, 8);
  const data = [];
  for (let index = 0; index < bits.length; index += 8)
    data.push(bits.slice(index, index + 8).reduce((value, next) => value << 1 | next, 0));
  const codewords = interleave(data, version, ecc);
  let best;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const matrix = new Matrix(version);
    matrix.functionPatterns();
    matrix.codewords(codewords);
    matrix.mask(mask);
    matrix.format(ecc, mask);
    const score = matrix.penalty();
    if (score < bestScore) {
      best = matrix;
      bestScore = score;
    }
  }
  return best.modules;
}
function qrSvg(text5, options2 = {}) {
  const modules = qrMatrix(text5);
  const border = 4;
  const dimension = modules.length + border * 2;
  const path9 = [];
  modules.forEach(
    (row, y) => row.forEach((dark, x) => {
      if (dark) path9.push(`M${x + border},${y + border}h1v1h-1z`);
    })
  );
  const size = options2.size ?? 160;
  const attr3 = (value) => value.replace(/[^#\w(),.% -]/gu, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" width="${size}" height="${size}" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${attr3(options2.background ?? "#ffffff")}"/><path fill="${attr3(options2.foreground ?? "#000000")}" d="${path9.join("")}"/></svg>`;
}

// packages/core/src/preview/extensions/items/render.ts
var json = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
var iconClasses = (value) => /(^|\s)fa-/u.test(value) && !/(^|\s)fa(\s|$)/u.test(value) ? `fa ${value}` : value;
function classes(...values) {
  return values.filter(Boolean).join(" ");
}
var DATE_DEFAULT = "DD-MON-YYYY";
var ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?/u;
function dateMask(renderer, item2) {
  return (str(item2.props, "appearance.formatMask") || str(renderer.app.app.props, "globalization.dateFormat") || DATE_DEFAULT).replace(/^FX/iu, "");
}
function dateValue(value, mask) {
  return ISO_DATE.test(value) ? formatOracle(value.replace(" ", "T"), mask) ?? value : value;
}
function numberValue(value, mask) {
  if (!mask || value === "") return value;
  const plain = Number(value);
  return Number.isFinite(plain) ? formatOracle(plain, mask) ?? value : value;
}
function readOnlyMarkup(item2, name, value, display, html = false) {
  state(item2).container = ["is-readonly"];
  state(item2).wrapper = ["display-only"];
  return `<span id="${name}_DISPLAY" class="display_only apex-item-display-only"${html ? "" : ' data-escape="true"'}>${html ? display : escapeHtml(display)}</span><input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}">`;
}
function onload(ctx, code, ...scripts) {
  for (const script of scripts) ctx.jsFiles.add(script);
  ctx.onload.push(code);
}
var TRIM = {
  none: "NONE",
  leading: "LEADING",
  trailing: "TRAILING",
  leadingAndTrailing: "BOTH"
};
var SUBTYPE = { email: "email", phone: "tel", url: "url", search: "search" };
function icon(item2) {
  const value = str(item2.props, "appearance.icon");
  if (!value) return "";
  const entry = state(item2);
  entry.wrapper = [...entry.wrapper ?? [], "has-icon"];
  return `<span class="apex-item-icon ${escapeHtml(iconClasses(value))}" aria-hidden="true"></span>`;
}
function quickPicks(renderer, ctx, item2, name) {
  const type = str(item2.props, "quickPicks.type");
  if (!type) return "";
  let picks = [];
  if (type === "static")
    for (let index = 1; index <= 10; index += 1) {
      const label = str(item2.props, `quickPicks.label${index}`);
      if (label) picks.push({ d: label, r: str(item2.props, `quickPicks.value${index}`, label) });
    }
  else if (type === "sqlQuery")
    picks = renderer.queryLov(ctx, str(item2.props, "quickPicks.sqlQuery"), void 0, void 0, name);
  else picks = lovEntries(renderer, ctx, item2);
  const max = num(item2.props, "quickPicks.maxDisplayedEntries", 10);
  if (!picks.length) return "";
  return `<span class="apex-quick-picks">${picks.slice(0, max).map(
    (pick) => `<a href="javascript:void(0)" onclick="apex.item('${name}').setValue(${escapeHtml(JSON.stringify(pick.r))});return false;">${escapeHtml(pick.d)}</a>`
  ).join(", ")}</span>`;
}
var textField = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  if (isReadOnly(renderer, ctx, item2)) return readOnlyMarkup(item2, name, value, value);
  const extras = elementExtras(renderer, ctx, item2);
  const subtype = SUBTYPE[setting(renderer, item2, "subtype")] ?? "text";
  const textCase = setting(renderer, item2, "textCase").toUpperCase();
  const iconHtml = icon(item2);
  const submit = flag(renderer, item2, "submitWhenEnterPressed", false) ? `return apex.submit({request:'${name}',submitIfEnter:event})` : void 0;
  return `<input${attrs({
    type: subtype,
    id: name,
    name,
    class: classes("text_field apex-item-text", iconHtml && "apex-item-has-icon", ...extras.classes),
    value,
    size: num(item2.props, "appearance.width", 30),
    maxlength: num(item2.props, "validation.maxLength", 0) || void 0,
    placeholder: placeholder(renderer, ctx, item2) || void 0,
    required: required(item2),
    "data-trim-spaces": TRIM[setting(renderer, item2, "trimSpaces", "leadingAndTrailing")] ?? "BOTH",
    "data-text-case": textCase === "UPPER" || textCase === "LOWER" ? textCase : void 0,
    autocomplete: subtype === "email" ? "email" : subtype === "tel" ? "tel" : void 0,
    onkeypress: submit
  })}${extras.attributes}>${iconHtml}${quickPicks(renderer, ctx, item2, name)}`;
};
var numberField = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  const mask = str(item2.props, "appearance.formatMask");
  const shown = numberValue(value, mask);
  if (isReadOnly(renderer, ctx, item2)) return readOnlyMarkup(item2, name, value, shown);
  const extras = elementExtras(renderer, ctx, item2);
  const alignment = setting(renderer, item2, "numberAlignment", "end");
  const min = setting(renderer, item2, "minValue");
  const max = setting(renderer, item2, "maxValue");
  const iconHtml = icon(item2);
  return `<input${attrs({
    type: "text",
    id: name,
    name,
    class: classes(
      "number_field apex-item-text apex-item-number",
      iconHtml && "apex-item-has-icon",
      alignment === "start" ? "u-textStart" : alignment === "center" ? "u-textCenter" : "u-textEnd",
      ...extras.classes
    ),
    value: shown,
    size: num(item2.props, "appearance.width", 30),
    maxlength: num(item2.props, "validation.maxLength", 0) || void 0,
    placeholder: placeholder(renderer, ctx, item2) || void 0,
    required: required(item2),
    "data-min": min || void 0,
    "data-max": max || void 0,
    "data-format": mask || void 0,
    inputmode: setting(renderer, item2, "virtualKeyboard", "decimal")
  })}${extras.attributes}>${iconHtml}`;
};
var password = (renderer, ctx, item2, name) => {
  itemState.set(item2, {});
  const extras = elementExtras(renderer, ctx, item2);
  const readOnly = isReadOnly(renderer, ctx, item2);
  if (readOnly) state(item2).container = ["is-readonly"];
  const iconHtml = icon(item2);
  return `<input${attrs({
    type: "password",
    name,
    id: name,
    class: classes(
      "password apex-item-text apex-item-password",
      iconHtml && "apex-item-has-icon",
      readOnly && "apex-item-password-readonly",
      ...extras.classes
    ),
    value: "",
    size: num(item2.props, "appearance.width", 30),
    maxlength: num(item2.props, "validation.maxLength", 0) || void 0,
    placeholder: placeholder(renderer, ctx, item2) || void 0,
    autocomplete: "current-password",
    required: required(item2),
    readonly: readOnly,
    onkeypress: flag(renderer, item2, "submitWhenEnterPressed", true) ? `return apex.submit({request:'${name}',submitIfEnter:event})` : void 0
  })}${extras.attributes}>${iconHtml}`;
};
var textarea = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  if (isReadOnly(renderer, ctx, item2)) {
    Object.assign(state(item2), { container: ["is-readonly"], wrapper: ["display-only"] });
    return `<span id="${name}_DISPLAY" class="display_only apex-item-display-only" style="white-space:pre-wrap">${escapeHtml(value)}</span><input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}">`;
  }
  const extras = elementExtras(renderer, ctx, item2);
  const max = num(item2.props, "validation.maxLength", 0);
  const counter = flag(renderer, item2, "charCounter", false);
  const autoHeight = flag(renderer, item2, "autoHeight", false);
  const resizable = flag(renderer, item2, "resizable", true);
  return `<div class="apex-item-group apex-item-group--textarea"><textarea${attrs({
    name,
    rows: num(item2.props, "appearance.height", 5),
    cols: num(item2.props, "appearance.width", 30),
    maxlength: max || void 0,
    id: name,
    class: classes(
      "textarea apex-item-textarea",
      autoHeight && "apex-item-textarea--autoHeight",
      ...extras.classes
    ),
    placeholder: placeholder(renderer, ctx, item2) || void 0,
    required: required(item2),
    "data-trim-spaces": TRIM[setting(renderer, item2, "trimSpaces", "none")] ?? "NONE",
    "data-resizable": resizable ? "true" : void 0,
    "data-counter": counter ? "true" : void 0,
    "data-max-char": counter && max ? max : void 0,
    "data-auto-height": autoHeight ? "true" : void 0,
    style: resizable ? "resize:both" : void 0
  })}${extras.attributes}>${escapeHtml(value)}</textarea>${counter ? `<div id="${name}_CHAR_COUNT" style="display:none;" class="apex-item-textarea-counter"><span id="${name}_CHAR_COUNTER" class="apex-item-textarea-counter--length">${value.length}</span> of <span class="apex-item-textarea-counter--size">${max || 4e3}</span></div>` : ""}</div>`;
};
var hidden = (renderer, ctx, item2, name, value) => {
  const input = `<input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}"${elementExtras(renderer, ctx, item2).attributes}>`;
  return bool(item2.props, "settings.valueProtected", true) ? `${input}<input type="hidden" data-for="${name}" value="local-checksum">` : input;
};
var displayOnly = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  const format2 = setting(renderer, item2, "format", "plainText");
  const basedOn = setting(renderer, item2, "basedOn", get(item2.props, "lov") ? "lov" : "value");
  let display = value;
  if (basedOn === "lov" || get(item2.props, "lov"))
    display = displayFor(lovEntries(renderer, ctx, item2), splitValues(item2, value)).join(", ");
  const mask = str(item2.props, "appearance.formatMask");
  if (mask) display = ISO_DATE.test(value) ? dateValue(value, mask) : numberValue(display, mask);
  const escape = bool(item2.props, "security.escapeSpecialChars", true) && format2 !== "html";
  let html = escape ? escapeHtml(display) : display;
  if (format2 === "markdown") {
    ctx.jsFiles.add(`#APEX_FILES#libraries/markedjs/${libraryVersion(renderer, "markedjs")}/marked.umd.js`);
    html = escapeHtml(display);
    ctx.onload.push(
      `(function(e){if(window.marked&&e){e.innerHTML=apex.util.sanitizeHtml?apex.util.sanitizeHtml(marked.parse(e.textContent)):marked.parse(e.textContent);}})(document.getElementById(${json(`${name}_DISPLAY`)}));`
    );
  } else if (flag(renderer, item2, "showLineBreaks", true) && escape) html = html.replaceAll("\n", "<br>");
  return `<span id="${name}_DISPLAY" class="display_only apex-item-display-only"${escape ? ' data-escape="true"' : ""}>${html}</span>${flag(renderer, item2, "sendOnPageSubmit", true) ? `<input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}">` : ""}`;
};
var datePicker = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  const mask = dateMask(renderer, item2);
  const shown = dateValue(value, mask);
  if (isReadOnly(renderer, ctx, item2)) return readOnlyMarkup(item2, name, value, shown);
  const displayAs = setting(renderer, item2, "displayAs", "popup");
  const behavior = new Set(setting(renderer, item2, "appearanceBehavior").split(":").filter(Boolean));
  const limit = (kind) => {
    const type = setting(renderer, item2, `${kind}Date`, "none");
    if (type === "static") {
      const raw = renderer.substitute(ctx.session, setting(renderer, item2, `${kind}Static`), ctx.page, "RAW");
      return dateValue(raw, mask) || void 0;
    }
    if (type === "item") {
      const source = setting(renderer, item2, `${kind}Item`).toUpperCase();
      return dateValue(ctx.session.items[source] ?? "", mask) || void 0;
    }
    return void 0;
  };
  const navigation = setting(renderer, item2, "navigationListFor");
  const showTime = flag(renderer, item2, "showTime", /HH|MI/iu.test(mask));
  const showOn = setting(renderer, item2, "showOn");
  const extras = elementExtras(renderer, ctx, item2);
  const entry = state(item2);
  entry.wrapper = [
    "date-picker-apex",
    ...displayAs === "inline" ? ["date-picker-apex-inline"] : [],
    ...displayAs === "native" ? ["date-picker-apex-native"] : []
  ];
  const example = formatOracle((/* @__PURE__ */ new Date()).toISOString(), mask) ?? "";
  return `<a-date-picker${attrs({
    id: name,
    class: classes(`apex-item-datepicker--${displayAs}`, ...extras.classes),
    "display-as": displayAs,
    format: mask,
    "valid-example": example,
    value: shown,
    min: limit("min"),
    max: limit("max"),
    name,
    placeholder: placeholder(renderer, ctx, item2) || void 0,
    required: required(item2),
    "show-time": showTime ? "true" : void 0,
    "today-button": behavior.has("showTodayButton") ? "true" : void 0,
    "change-month": behavior.has("monthPicker") || navigation === "month" || navigation === "monthAndYear" ? "true" : void 0,
    "change-year": behavior.has("yearPicker") || navigation === "year" || navigation === "monthAndYear" ? "true" : void 0,
    "display-weeks": behavior.has("showWeek") ? "number" : void 0,
    "previous-next-distance": behavior.has("paginateByMultipleMonths") ? "number-of-month" : void 0,
    "number-of-months": /^[2-5]$/u.test(setting(renderer, item2, "multipleMonths")) ? setting(renderer, item2, "multipleMonths") : void 0,
    "show-days-outside-month": setting(renderer, item2, "daysOutsideMonth") || void 0,
    "show-on": showOn === "iconClick" ? "image" : showOn === "itemFocus" ? "focus" : void 0,
    "time-increment-minute": setting(renderer, item2, "timeIncrement") || void 0,
    "year-selection-range": setting(renderer, item2, "yearRange") || void 0,
    size: displayAs === "inline" ? void 0 : num(item2.props, "appearance.width", 20),
    "aria-labelledby": `${name}_LABEL`
  })}${extras.attributes}></a-date-picker>`;
};
function options(entries, selected) {
  return entries.map(
    (entry) => `<option value="${escapeHtml(entry.r)}"${selected.includes(entry.r) ? ' selected="selected"' : ""}>${escapeHtml(entry.d)}</option>`
  ).join("");
}
function cascadeInit(ctx, item2, name) {
  const parents = cascading(item2);
  if (!parents.parents) return {};
  return {
    ajaxIdentifier: ajaxIdentifier(ctx, name),
    dependingOnSelector: parents.parents,
    optimizeRefresh: parents.required,
    ...parents.submit ? { pageItemsToSubmit: parents.submit } : {}
  };
}
var selectList = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  const multiple = flag(renderer, item2, "selectMultiple", false) || flag(renderer, item2, "multiSelection", false);
  const values = multiple ? splitValues(item2, value) : [value];
  const nullShown = bool(item2.props, "lov.displayNullValue", !multiple);
  const entries = lovEntries(renderer, ctx, item2, { values, nullDefault: !multiple });
  if (isReadOnly(renderer, ctx, item2))
    return readOnlyMarkup(item2, name, value, displayFor(entries, values.filter(Boolean)).join(", "));
  const extras = elementExtras(renderer, ctx, item2);
  const cascade = cascadeInit(ctx, item2, name);
  const action = setting(renderer, item2, "pageActionOnSelection", "none");
  if (cascade.ajaxIdentifier || action !== "none")
    ctx.onload.push(
      `apex.widget.selectList(${json(`#${name}`)},${json({
        ...cascade,
        ...nullShown ? { nullValue: str(item2.props, "lov.nullReturnValue") } : {},
        ...multiple ? { storageType: "SEPARATED", separator: separator(item2) } : {}
      })});`
    );
  return `<select${attrs({
    id: name,
    name,
    class: classes("selectlist apex-item-select", ...extras.classes),
    "data-native-menu": "false",
    size: multiple ? num(item2.props, "appearance.height", 5) : 1,
    multiple,
    required: required(item2),
    onchange: action === "submitPage" ? `apex.submit('${name}');` : action === "redirectSetValue" ? `apex.navigation.redirect(apex.util.makeApplicationUrl({itemNames:['${name}'],itemValues:[this.value]}));` : void 0
  })}${extras.attributes}>${options(entries, values)}</select>`;
};
function choices(renderer, ctx, item2, name, value, input) {
  const selected = input === "checkbox" ? splitValues(item2, value) : [value];
  const entries = lovEntries(renderer, ctx, item2, { values: selected });
  const columns = Math.max(0, num(item2.props, "settings.noOfCols", 0));
  const isRequired = required(item2);
  const option = (entry, index) => `<div class="apex-item-option"><input${attrs({
    type: input,
    id: `${name}_${index}`,
    name,
    "data-display": entry.d,
    value: entry.r,
    checked: selected.includes(entry.r),
    required: isRequired && input === "radio",
    "aria-label": entry.d
  })}><label for="${name}_${index}" aria-hidden="true">${escapeHtml(entry.d)}</label></div>`;
  const rendered = entries.map(option);
  if (!columns) return rendered.join("");
  const rows = [];
  for (let index = 0; index < rendered.length; index += columns)
    rows.push(`<div class="apex-item-grid-row">${rendered.slice(index, index + columns).join("")}</div>`);
  return `<div class="apex-item-grid ${input === "radio" ? "radio_group" : "checkbox_group"}">${rows.join("")}</div>`;
}
function group(input) {
  return (renderer, ctx, item2, name, value) => {
    itemState.set(item2, {});
    if (isReadOnly(renderer, ctx, item2)) {
      const selected = input === "checkbox" ? splitValues(item2, value) : [value];
      return readOnlyMarkup(
        item2,
        name,
        value,
        displayFor(lovEntries(renderer, ctx, item2), selected.filter(Boolean)).join(", ")
      );
    }
    const extras = elementExtras(renderer, ctx, item2);
    const cascade = cascadeInit(ctx, item2, name);
    ctx.onload.push(
      `apex.widget.checkboxAndRadio(${json(`#${name}`)},${json(input)},${json({
        ...cascade,
        inputName: name,
        ...input === "checkbox" ? { storageType: "SEPARATED", separator: separator(item2) } : {},
        ...setting(renderer, item2, "pageActionOnSelection") === "submitPage" ? { action: "SUBMIT" } : {}
      })});`
    );
    return `<div${attrs({
      tabindex: "-1",
      id: name,
      "aria-labelledby": `${name}_LABEL`,
      class: classes(
        input === "radio" ? "radio_group" : "checkbox_group",
        "apex-item-group apex-item-group--rc",
        input === "radio" ? "apex-item-radio" : "apex-item-checkbox",
        ...extras.classes
      ),
      role: input === "radio" ? "radiogroup" : "group",
      "aria-required": required(item2) ? "true" : void 0
    })}${extras.attributes}>${choices(renderer, ctx, item2, name, value, input)}</div>`;
  };
}
var checkbox = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  const on = setting(renderer, item2, "checkedValue", "Y");
  const off = setting(renderer, item2, "uncheckedValue", "N");
  const current = value === "" ? off : value;
  const readOnly = isReadOnly(renderer, ctx, item2);
  if (readOnly) state(item2).container = ["is-readonly"];
  const label = escapeHtml(renderer.substitute(ctx.session, renderer.label(item2), ctx.page, "RAW"));
  const extras = elementExtras(renderer, ctx, item2);
  return `<div class="apex-item-single-checkbox"><input type="hidden" name="${name}" id="${name}_HIDDENVALUE" value="${escapeHtml(current)}"><input${attrs(
    {
      type: "checkbox",
      id: name,
      class: extras.classes.join(" ") || void 0,
      value: on,
      checked: current === on,
      disabled: readOnly,
      required: required(item2),
      "data-unchecked-value": off,
      "aria-describedby": str(item2.props, "help.inlineHelpText") ? `${name}_inline_help` : void 0
    }
  )}${extras.attributes}><label for="${name}" id="${name}_LABEL" class="u-checkbox">${label}</label></div>`;
};
function switchSettings(renderer, item2) {
  return {
    on: setting(renderer, item2, "onValue", "Y"),
    off: setting(renderer, item2, "offValue", "N"),
    onLabel: setting(renderer, item2, "onLabel", "On"),
    offLabel: setting(renderer, item2, "offLabel", "Off")
  };
}
var switchItem = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  const { on, off, onLabel, offLabel } = switchSettings(renderer, item2);
  if (isReadOnly(renderer, ctx, item2))
    return readOnlyMarkup(item2, name, value, value === on ? onLabel : offLabel);
  const extras = elementExtras(renderer, ctx, item2);
  const component = renderer.app.shared.find(
    (entry) => entry.type === "componentSetting" && str(entry.props, "name") === "switch" && str(entry.props, "type") === "item"
  );
  const style = setting(renderer, item2, "displayStyle") || (component ? str(component.props, "settings.displayStyle") : "") || (strings4(get(item2.props, "appearance.templateOptions")).includes(
    "t-Form-fieldContainer--radioButtonGroup"
  ) ? "pillButton" : "switch");
  if (style === "pillButton") {
    onload(ctx, `apex.widget.yesNo(${json(name)},"SWITCH");`);
    state(item2).wrapper = ["yes-no"];
    const radio = (key, val, label) => `<input${attrs({ type: "radio", id: `${name}_${key}`, name, value: val, checked: (value || off) === val })}><label for="${name}_${key}" class="a-Button">${escapeHtml(label)}</label>`;
    return `<div tabindex="-1" id="${name}" class="apex-button-group apex-item-group apex-item-group--switch" role="group" aria-labelledby="${name}_LABEL">${radio("Y", on, onLabel)}${radio("N", off, offLabel)}</div>`;
  }
  if (style === "selectList")
    return `<select id="${name}" name="${name}" class="selectlist apex-item-select" size="1">${options(
      [
        { d: onLabel, r: on },
        { d: offLabel, r: off }
      ],
      [value || off]
    )}</select>`;
  onload(ctx, `apex.widget.yesNo(${json(name)},"SWITCH_CB");`);
  return `<span class="a-Switch"><input${attrs({
    type: "checkbox",
    id: name,
    name,
    class: extras.classes.join(" ") || void 0,
    value: on,
    "data-on-label": onLabel,
    "data-off-value": off,
    "data-off-label": offLabel,
    checked: value === on,
    required: required(item2)
  })}${extras.attributes}><span class="a-Switch-toggle"></span></span>`;
};
var SHUTTLE_BUTTONS = {
  move: [
    ["RESET", "Reset"],
    ["MOVE_ALL", "Move All"],
    ["MOVE", "Move"],
    ["REMOVE", "Remove"],
    ["REMOVE_ALL", "Remove All"]
  ],
  sort: [
    ["TOP", "Top"],
    ["UP", "Up"],
    ["DOWN", "Down"],
    ["BOTTOM", "Bottom"]
  ]
};
var shuttle = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  const selected = splitValues(item2, value);
  const entries = lovEntries(renderer, ctx, item2).filter((entry) => entry.r !== "" || entry.d !== "");
  if (isReadOnly(renderer, ctx, item2))
    return readOnlyMarkup(item2, name, value, displayFor(entries, selected).join(", "));
  const controls = setting(renderer, item2, "showControls", "all");
  const height = num(item2.props, "appearance.height", 5);
  const left = entries.filter((entry) => !selected.includes(entry.r));
  const right = selected.map((selectedValue) => entries.find((entry) => entry.r === selectedValue)).filter((entry) => Boolean(entry));
  const button = ([suffix, title]) => `<button id="${name}_${suffix}" class="a-Button a-Button--noLabel a-Button--withIcon a-Button--small" type="button" title="${title}" aria-label="${title}"><span class="a-Icon icon-shuttle-${suffix.toLowerCase().replaceAll("_", "-")}" aria-hidden="true"></span></button>`;
  const moving = controls === "all" || controls === "movingOnly";
  const ordering = controls === "all" || controls === "orderingOnly";
  onload(
    ctx,
    `apex.widget.shuttle(${json(`#${name}`)},${json({
      ...cascadeInit(ctx, item2, name),
      storageType: "SEPARATED",
      separator: separator(item2)
    })});`,
    apexScript("widget.shuttle")
  );
  const extras = elementExtras(renderer, ctx, item2);
  return `<div${attrs({
    class: classes("shuttle apex-item-group apex-item-group--shuttle", ...extras.classes),
    id: name,
    role: "group",
    "aria-labelledby": `${name}_LABEL`,
    tabindex: "-1"
  })}${extras.attributes}><table cellpadding="0" cellspacing="0" border="0" role="presentation" class="shuttle"><tbody><tr><td class="shuttleSelect1"><select title="Move from" multiple="multiple" id="${name}_LEFT" size="${height}" class="shuttle_left apex-item-select">${options(left, [])}</select></td>${moving ? `<td align="center" class="shuttleControl">${SHUTTLE_BUTTONS.move.map(button).join("")}</td>` : ""}<td class="shuttleSelect2"><select title="Move to" multiple="multiple" id="${name}_RIGHT" name="${name}" size="${height}" class="shuttle_right apex-item-select"${required(item2) ? " required" : ""}>${options(right, [])}</select></td>${ordering ? `<td align="center" class="shuttleSort2">${SHUTTLE_BUTTONS.sort.map(button).join("")}</td>` : ""}</tr></tbody></table></div>`;
};
var popupLov = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  const multiple = get(item2.props, "multipleValues.type") !== void 0 || flag(renderer, item2, "multipleValues", false);
  const enterable = flag(renderer, item2, "manualEntry", false);
  const values = multiple ? splitValues(item2, value) : value ? [value] : [];
  const lov = lovRows(renderer, ctx, item2);
  const display = values.map(
    (entry) => lov.rows.find((row) => row[lov.returned] === entry)?.[lov.display] ?? entry
  );
  if (isReadOnly(renderer, ctx, item2)) return readOnlyMarkup(item2, name, value, display.join(", "));
  const isPopup = setting(renderer, item2, "displayAs", "popup") !== "dialog";
  const columns = Object.fromEntries([
    ...lov.columns.map((column, index) => [
      column.name,
      {
        index,
        heading: column.heading,
        label: column.heading,
        alignment: "start",
        canSort: true,
        canSearch: column.searchable,
        isHidden: false,
        seq: index + 1
      }
    ]),
    ...lov.columns.some((column) => column.name === lov.returned) ? [] : [
      [
        lov.returned,
        {
          index: lov.columns.length,
          heading: lov.returned,
          canSearch: false,
          isHidden: true,
          hidden: true
        }
      ]
    ]
  ]);
  const initial = setting(renderer, item2, "initialFetch", "auto");
  onload(
    ctx,
    `apex.widget.popupLov(${json({
      itemId: name,
      ajaxIdentifier: ajaxIdentifier(ctx, name),
      ...cascading(item2).parents ? { dependingOnSelector: cascading(item2).parents } : {},
      ...cascading(item2).submit ? { pageItemsToSubmit: cascading(item2).submit } : {},
      itemsToSubmit: [],
      nullValue: "",
      nullDisplayValue: "",
      initialFetch: initial === "onUserRequest" ? "none" : initial === "autoCurrentValue" ? "value" : "empty",
      multiple,
      separator: separator(item2),
      storageType: "SEPARATED",
      enterable,
      display: lov.columns.length > 1 ? "grid" : "list",
      title: renderer.label(item2),
      isPopup,
      width: num(item2.props, "settings.popupWidth", 0) || void 0,
      height: num(item2.props, "settings.popupHeight", 0) || void 0,
      incrementalSearch: true,
      minSearchChars: num(item2.props, "search.minChars", 0),
      columns,
      valueColumn: lov.returned,
      displayColumn: lov.display,
      recordTemplate: null,
      extraOut: {},
      persistState: true,
      defaultGridOptions: { columnSort: true }
    })});`,
    apexScript("widget.iconList"),
    apexScript("modelViewBase"),
    apexScript("widget.grid")
  );
  const extras = elementExtras(renderer, ctx, item2);
  const input = (inputValue) => `<input${attrs({
    type: "text",
    class: classes("apex-item-text apex-item-popup-lov", ...extras.classes),
    id: name,
    name: enterable ? name : `${name}_DISPLAY`,
    size: num(item2.props, "appearance.width", 30),
    value: inputValue,
    placeholder: placeholder(renderer, ctx, item2) || void 0,
    required: required(item2),
    "aria-labelledby": `${name}_LABEL`
  })}${extras.attributes}>`;
  const hiddenValue = enterable ? "" : `<input type="hidden" name="${name}" id="${name}_HIDDENVALUE" value="${escapeHtml(value)}">`;
  const button = `<button type="button" class="a-Button a-Button--popupLOV" id="${name}_lov_btn" tabindex="-1" aria-hidden="true"><span class="a-Icon icon-popup-lov" aria-hidden="true"></span></button>`;
  if (multiple)
    return `<div class="apex-item-group apex-item-group--popup-lov" role="none"><ul class="apex-item-multi" role="none">${values.map(
      (entry, index) => `<li class="apex-item-multi-item" data-value="${escapeHtml(entry)}">${escapeHtml(display[index] ?? entry)}</li>`
    ).join("")}<li class="apex-item-multi-input">${input("")}</li></ul>${hiddenValue}${button}</div>`;
  return `<div class="apex-item-group apex-item-group--popup-lov" role="none">${input(enterable ? value : display[0] ?? "")}${hiddenValue}${button}</div>`;
};
function comboSelect(kind) {
  return (renderer, ctx, item2, name, value) => {
    itemState.set(item2, {});
    const multi = kind === "selectMany" || kind === "combobox" && flag(renderer, item2, "multiSelection", false);
    const values = multi ? splitValues(item2, value) : value ? [value] : [];
    const lov = lovRows(renderer, ctx, item2);
    const entries = lov.rows.map((row) => ({ d: row[lov.display] ?? "", r: row[lov.returned] ?? "" }));
    if (isReadOnly(renderer, ctx, item2))
      return readOnlyMarkup(item2, name, value, displayFor(entries, values).join(", "));
    const tag = kind === "combobox" ? "a-combobox" : "a-select";
    const manual = kind === "combobox" && flag(renderer, item2, "manualEntry", true);
    const parents = cascading(item2);
    const extras = elementExtras(renderer, ctx, item2);
    state(item2).wrapper = [
      kind === "combobox" ? "combobox" : kind === "selectOne" ? "select-one" : "select-many",
      ...kind === "combobox" ? [multi ? "combobox-many" : "combobox-one"] : []
    ];
    const extraColumns = lov.columns.filter((column) => column.name !== lov.display);
    const metadata = extraColumns.map(
      (column, index) => `<a-column-metadata name="${escapeHtml(column.name)}" index="${index}" searchable="${column.searchable}"></a-column-metadata>`
    ).join("");
    const optionsHtml = lov.rows.map(
      (row) => `<a-option value="${escapeHtml(row[lov.returned] ?? "")}">${escapeHtml(row[lov.display] ?? "")}${extraColumns.map(
        (column) => `<a-option-column-value>${escapeHtml(row[column.name] ?? "")}</a-option-column-value>`
      ).join("")}</a-option>`
    ).join("");
    return `<${tag}${attrs({
      id: name,
      name,
      class: extras.classes.join(" ") || void 0,
      value: multi ? values.join(separator(item2)) : value,
      "display-values-as": setting(renderer, item2, "displayValuesAs") === "commaSeparatedList" ? "separated" : "chips",
      "match-type": str(item2.props, "search.matchType") === "startsWith" ? "starts-with" : "contains",
      "case-sensitive": bool(item2.props, "search.caseSensitive", false) ? "true" : void 0,
      "min-characters-search": num(item2.props, "search.minChars", 0),
      "max-results": num(item2.props, "settings.maxValuesInList", 250),
      "multi-value": multi ? "true" : void 0,
      "multi-select": multi ? "true" : void 0,
      "multi-value-separator": separator(item2),
      "multi-value-storage": str(item2.props, "multipleValues.type") === "jsonArray" ? "json-array" : "separated",
      "return-display": kind !== "combobox" || !manual ? "true" : void 0,
      "manual-entries-item": void 0,
      "ajax-identifier": ajaxIdentifier(ctx, name),
      "parent-items": parents.parents || void 0,
      "parents-required": parents.parents && parents.required ? "true" : void 0,
      "ajax-items": parents.submit || void 0,
      placeholder: placeholder(renderer, ctx, item2) || void 0,
      required: required(item2),
      "aria-labelledby": `${name}_LABEL`
    })}${extras.attributes}>${metadata}${optionsHtml}</${tag}>`;
  };
}
var autoComplete = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  if (isReadOnly(renderer, ctx, item2)) return readOnlyMarkup(item2, name, value, value);
  const entries = lovEntries(renderer, ctx, item2).filter((entry) => entry.d !== "");
  const extras = elementExtras(renderer, ctx, item2);
  ctx.jsFiles.add(apexScript("item.Autocomplete"));
  ctx.cssFiles.add("#APEX_FILES#app_ui/css/WebComponents.min.css?v=#APEX_VERSION#");
  state(item2).wrapper = ["auto-complete"];
  return `<a-autocomplete${attrs({
    id: name,
    name,
    class: classes("apex-item-auto-complete", ...extras.classes),
    value,
    "match-type": str(item2.props, "search.matchType") === "startsWith" ? "starts-with" : "contains",
    "max-results": num(item2.props, "settings.maxValuesInList", 7),
    "min-characters-search": num(item2.props, "search.minChars", 1),
    "highlight-choices": "true",
    placeholder: placeholder(renderer, ctx, item2) || void 0,
    required: required(item2),
    "aria-labelledby": `${name}_LABEL`
  })}${extras.attributes}>${entries.map((entry) => `<a-option>${escapeHtml(entry.d)}</a-option>`).join("")}</a-autocomplete>`;
};
var starRating = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  const stars = Number(setting(renderer, item2, "noOfStars", "5")) || 5;
  const readOnly = isReadOnly(renderer, ctx, item2);
  onload(
    ctx,
    `apex.widget.starRating(${json(name)},${json({
      numStars: stars,
      iconClass: iconClasses(setting(renderer, item2, "icon", "fa-star")).replace(/^fa\s+/u, ""),
      tooltip: setting(renderer, item2, "tooltip", "#VALUE#"),
      clearTooltip: "Clear",
      showClearButton: flag(renderer, item2, "showClearButton", true),
      isRequired: required(item2),
      readOnly,
      readOnlyDisplay: setting(renderer, item2, "readOnlyDisplay", "stars").replace(/([A-Z])/gu, "_$1").toUpperCase(),
      showValue: flag(renderer, item2, "showValue", false) ? "STARS_AND_VALUE" : "STARS",
      activeColor: setting(renderer, item2, "activeColor") || void 0,
      inactiveColor: setting(renderer, item2, "inactiveColor") || void 0
    })});`,
    apexScript("widget.starRating")
  );
  return `<div id="${name}" class="apex-item-starrating"><input type="text" id="${name}_INPUT" name="${name}" value="${escapeHtml(value)}" aria-labelledby="${name}_LABEL"${readOnly ? " disabled" : ""}></div>`;
};
var THEME_COLORS = [
  "var(--u-color-1)",
  "var(--u-color-2)",
  "var(--u-color-3)",
  "var(--u-color-4)",
  "var(--u-color-5)",
  "var(--u-color-6)",
  "var(--u-color-7)",
  "var(--u-color-8)"
];
var colorPicker = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  if (isReadOnly(renderer, ctx, item2)) {
    Object.assign(state(item2), { container: ["is-readonly"], wrapper: ["display-only"] });
    return `<span id="${name}_DISPLAY" class="display_only apex-item-display-only"><span aria-hidden="true" style="display:inline-block;inline-size:1em;block-size:1em;border-radius:50%;vertical-align:middle;background:${escapeHtml(value)}"></span> ${escapeHtml(value)}</span><input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}">`;
  }
  const displayAs = setting(renderer, item2, "displayAs", "popup");
  const preset = setting(renderer, item2, "colorPreset", "none");
  const presetColors = preset === "custom" ? setting(renderer, item2, "colors").split(/[,;:\s]+/u).filter(Boolean).join(",") : preset === "themeStyle" ? THEME_COLORS.join(",") : "";
  ctx.jsFiles.add(apexScript("item.Colorpicker"));
  state(item2).wrapper = [
    "color-picker",
    ...displayAs === "inline" ? ["color-picker-inline"] : [],
    ...displayAs === "nativeColorPicker" ? ["color-picker-native"] : [],
    ...displayAs === "colorOnlyPopup" ? ["color-picker-color-only"] : []
  ];
  const extras = elementExtras(renderer, ctx, item2);
  return `<a-color-picker${attrs({
    id: name,
    name,
    class: extras.classes.join(" ") || void 0,
    value,
    "display-as": displayAs === "inline" ? "INLINE" : displayAs === "nativeColorPicker" ? "NATIVE" : displayAs === "colorOnlyPopup" ? "COLOR_ONLY" : "POPUP",
    "display-mode": setting(renderer, item2, "mode", "simple").toUpperCase(),
    "return-value-as": setting(renderer, item2, "returnValueAs", "hex").toUpperCase().replace("ANYCSSVALUE", "CSS"),
    "preset-colors": presetColors || void 0,
    "max-preset-colors": presetColors ? Math.min(presetColors.split(",").length, 8) : void 0,
    "contrast-color": setting(renderer, item2, "contrastWith") === "staticColor" ? setting(renderer, item2, "contrastColor") || void 0 : void 0,
    placeholder: placeholder(renderer, ctx, item2) || void 0,
    required: required(item2),
    "aria-labelledby": `${name}_LABEL`
  })}${extras.attributes}></a-color-picker>`;
};
var RTE_TOOLS = [
  ["bold", "Bold", "fa-bold"],
  ["italic", "Italic", "fa-italic"],
  ["underline", "Underline", "fa-underline"],
  ["strikeThrough", "Strikethrough", "fa-strikethrough"],
  ["insertUnorderedList", "Bulleted List", "fa-list-ul"],
  ["insertOrderedList", "Numbered List", "fa-list-ol"],
  ["createLink", "Link", "fa-link"],
  ["removeFormat", "Clear Formatting", "fa-eraser"]
];
var richTextEditor = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  renderer.diagnose(
    "info",
    `Rich Text Editor ${name} uses a simple contenteditable editor locally (TinyMCE is not bundled)`,
    ctx.pageId,
    name
  );
  const readOnly = isReadOnly(renderer, ctx, item2);
  const html = value;
  if (readOnly) {
    Object.assign(state(item2), { container: ["is-readonly"], wrapper: ["display-only"] });
    return `<div id="${name}_DISPLAY" class="display_only apex-item-display-only">${html}</div><input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}">`;
  }
  const toolbar = setting(renderer, item2, "toolbar", "simple");
  const tools = toolbar === "none" ? [] : toolbar === "simple" ? RTE_TOOLS.slice(0, 6) : RTE_TOOLS;
  ctx.onload.push(`apexLocal.items.richText(${json(name)});`);
  const height = num(item2.props, "settings.height", num(item2.props, "appearance.height", 5) * 24 + 48);
  return `<div class="apex-item-group apex-item-group--rich-text-editor apex-local-rte" id="${name}_CONTAINER_RTE">${tools.length ? `<div class="apex-local-rte-toolbar" role="toolbar" aria-label="Formatting">${tools.map(
    ([command, title, glyph]) => `<button type="button" class="a-Button a-Button--noLabel a-Button--withIcon a-Button--small" data-command="${command}" title="${title}" aria-label="${title}"><span class="fa ${glyph}" aria-hidden="true"></span></button>`
  ).join("")}</div>` : ""}<div class="apex-local-rte-content" id="${name}_EDITOR" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="${name}_LABEL" style="min-height:${height}px">${html}</div><textarea name="${name}" id="${name}" class="textarea apex-item-textarea u-vh" tabindex="-1" aria-hidden="true">${escapeHtml(value)}</textarea></div>`;
};
var markdownEditor = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  if (isReadOnly(renderer, ctx, item2)) return readOnlyMarkup(item2, name, value, value);
  const extras = elementExtras(renderer, ctx, item2);
  ctx.jsFiles.add(`#APEX_FILES#libraries/markedjs/${libraryVersion(renderer, "markedjs")}/marked.umd.js`);
  ctx.jsFiles.add(`#APEX_FILES#libraries/purify/${libraryVersion(renderer, "purify")}/purify.min.js`);
  onload(
    ctx,
    `apex.widget.markdown(${json(`#${name}`)},${json({
      toolbar: setting(renderer, item2, "toolbar", "simple").toUpperCase(),
      toolbarStyle: "OVERFLOW",
      previewEnabled: true,
      syntaxHighlighting: false,
      escapeInputHtml: "ESCAPE",
      previewEmptyMessage: '"Nothing to preview"'
    })});`,
    apexScript("widget.toolbar"),
    apexScript("widget.markdownEditor")
  );
  return `<div class="apex-item-group apex-item-group--textarea"><textarea${attrs({
    name,
    rows: num(item2.props, "appearance.height", 8),
    cols: num(item2.props, "appearance.width", 30),
    id: name,
    class: classes("textarea apex-item-textarea", ...extras.classes),
    maxlength: num(item2.props, "validation.maxLength", 0) || void 0,
    placeholder: placeholder(renderer, ctx, item2) || void 0,
    required: required(item2),
    "data-markdown": "true"
  })}${extras.attributes}>${escapeHtml(value)}</textarea></div>`;
};
var FILE_DISPLAY = {
  inlineFileBrowse: "INLINE",
  inlineDropzone: "DROPZONE_INLINE",
  blockDropzone: "DROPZONE_BLOCK",
  nativeFileBrowse: "NATIVE"
};
function fileUpload(kind) {
  return (renderer, ctx, item2, name, value) => {
    itemState.set(item2, {});
    renderer.diagnose(
      "info",
      `File item ${name} renders the drop zone; selected files are not uploaded or stored locally`,
      ctx.pageId,
      name
    );
    const readOnly = isReadOnly(renderer, ctx, item2);
    const displayAs = str(
      item2.props,
      "display.displayAs",
      kind === "image" ? "blockDropzone" : "inlineDropzone"
    );
    ctx.jsFiles.add(apexScript("item.FileUpload"));
    state(item2).wrapper = kind === "image" ? ["image-upload"] : ["file"];
    const extras = elementExtras(renderer, ctx, item2);
    return `<a-file-upload${attrs({
      id: name,
      name,
      class: extras.classes.join(" ") || void 0,
      "display-style": FILE_DISPLAY[displayAs] ?? "DROPZONE_BLOCK",
      "upload-type": kind === "image" ? "IMAGE" : "FILE",
      label: str(item2.props, "display.dropzoneTitle") || void 0,
      description: str(item2.props, "display.dropzoneDesc") || void 0,
      accept: str(item2.props, "storage.fileTypes") || (kind === "image" ? "image/*" : void 0),
      multiple: bool(item2.props, "storage.allowMultipleFiles", false),
      "max-file-size": num(item2.props, "storage.maxFileSize", 0) || void 0,
      "allow-crop": bool(item2.props, "cropping.allowCropping", false) ? "true" : void 0,
      "show-preview": kind === "image" ? "true" : void 0,
      filename: value || void 0,
      readonly: readOnly,
      required: required(item2),
      "aria-labelledby": `${name}_LABEL`
    })}${extras.attributes}><input type="file" id="${name}_input" name="${name}" class="apex-item-file u-vh"></a-file-upload>`;
  };
}
var QR_PREFIX = {
  email: "mailto:",
  phone: "tel:",
  sms: "sms:",
  geoLocation: "geo:"
};
var QR_SIZE = { small: 128, medium: 192, large: 256 };
function qrPayload(item2, value) {
  const prefix = QR_PREFIX[str(item2.props, "qrCode.dataType")] ?? "";
  return prefix && value && !value.toLowerCase().startsWith(prefix) ? prefix + value : value;
}
function qrMarkup(item2, value, foreground, background) {
  if (!value) return "";
  try {
    return qrSvg(qrPayload(item2, value), {
      size: QR_SIZE[str(item2.props, "qrCode.size", "medium")] ?? 192,
      ...foreground ? { foreground } : {},
      ...background ? { background } : {}
    });
  } catch {
    return "";
  }
}
var qrCode = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  ctx.jsFiles.add(apexScript("item.QRcode"));
  state(item2).wrapper = ["qrcode"];
  return `<a-qrcode${attrs({
    id: name,
    class: "apex-item-qrcode",
    "ajax-identifier": ajaxIdentifier(ctx, name),
    value,
    "aria-labelledby": `${name}_LABEL`
  })}>${qrMarkup(item2, value)}</a-qrcode>`;
};
var percentGraph = (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  ctx.jsFiles.add(apexScript("widget.pctGraph"));
  state(item2).wrapper = ["pct-graph"];
  return `<div${attrs({
    class: "apex-item-pct-graph",
    id: name,
    "data-show-value": flag(renderer, item2, "showValue", true) ? "true" : "false",
    "data-bg-color": setting(renderer, item2, "backgroundColor") || void 0,
    "data-fg-color": setting(renderer, item2, "foregroundColor") || void 0,
    "data-text-color": setting(renderer, item2, "textColor") || void 0,
    "data-width": setting(renderer, item2, "barWidth") || void 0,
    "data-label-id": `${name}_LABEL`
  })}>${escapeHtml(value === "" ? "0" : String(Number(value) || 0))}</div>`;
};
var unsupported = (label) => (renderer, ctx, item2, name, value) => {
  itemState.set(item2, {});
  renderer.diagnose(
    "info",
    `${label} item ${name} is shown read-only in the local preview`,
    ctx.pageId,
    name
  );
  return readOnlyMarkup(item2, name, value, value);
};
var ITEM_RENDERERS = {
  textField,
  numberField,
  password,
  textarea,
  hidden,
  displayOnly,
  datePicker,
  datePickerApex: datePicker,
  selectList,
  radioGroup: group("radio"),
  checkboxGroup: group("checkbox"),
  checkbox,
  switch: switchItem,
  shuttle,
  popupLov,
  combobox: comboSelect("combobox"),
  selectOne: comboSelect("selectOne"),
  selectMany: comboSelect("selectMany"),
  textFieldWithAutocomplete: autoComplete,
  autoComplete,
  starRating,
  colorPicker,
  richTextEditor,
  markdownEditor,
  fileUpload: fileUpload("file"),
  fileBrowse: fileUpload("file"),
  imageUpload: fileUpload("image"),
  qrCode,
  percentGraph,
  displayImage: unsupported("Display Image"),
  displayMap: unsupported("Display Map"),
  geocodedAddress: unsupported("Geocoded Address"),
  listManager: unsupported("List Manager")
};
var LABEL_FOR = {
  datePicker: (name) => `${name}_input`,
  starRating: (name) => `${name}_INPUT`,
  shuttle: (name) => `${name}_LEFT`
};
var itemTemplate = (renderer, ctx, item2, values) => {
  const type = str(item2.props, "type", "textField");
  const name = item2.id.toUpperCase();
  const entry = itemState.get(item2);
  const tokens = (values.ITEM_CSS_CLASSES ?? "").split(/\s+/u).filter(Boolean);
  const wrapperIndex = tokens.findIndex((token) => token.startsWith("apex-item-wrapper--"));
  if (entry?.wrapper?.length && wrapperIndex >= 0) {
    const base = entry.wrapper.filter((modifier) => modifier !== "has-icon");
    const replacement = (base.length ? base : [tokens[wrapperIndex].slice("apex-item-wrapper--".length)]).map((modifier) => `apex-item-wrapper--${modifier}`);
    if (entry.wrapper.includes("has-icon")) replacement.push("apex-item-wrapper--has-icon");
    tokens.splice(wrapperIndex, 1, ...replacement);
  }
  const field = renderer.theme.fields.get(
    (str(item2.props, "appearance.template") || "").replace(/^\//u, "").toLowerCase()
  );
  const optionsList = strings4(get(item2.props, "appearance.templateOptions"));
  const options2 = optionsList.length ? templateOptions(
    optionsList.flatMap((option) => option === "#DEFAULT#" ? [option] : option.split(/\s+/u)),
    text(field, "default_template_options")
  ) : "";
  const containerClasses = strings4(get(item2.props, "appearance.cssClasses"));
  const value = ctx.session.items[name] ?? "";
  tokens.push(
    ...options2.split(/\s+/u).filter(Boolean),
    ...containerClasses,
    ...entry?.container ?? [],
    ...placeholder(renderer, ctx, item2) ? ["apex-item-wrapper--has-placeholder"] : [],
    ...value !== "" && type !== "checkbox" ? ["apex-item-wrapper--has-initial-value"] : []
  );
  values.ITEM_CSS_CLASSES = [...new Set(tokens)].join(" ");
  const pre = str(item2.props, "advanced.preText", str(item2.props, "appearance.preTextHtml"));
  const post = str(item2.props, "advanced.postText", str(item2.props, "appearance.postTextHtml"));
  if (pre) values.CURRENT_ITEM_PRE_TEXT = renderer.substitute(ctx.session, pre, ctx.page, "HTML");
  if (post) values.CURRENT_ITEM_POST_TEXT = renderer.substitute(ctx.session, post, ctx.page, "HTML");
  const inline = str(item2.props, "help.inlineHelpText");
  if (inline)
    values.CURRENT_ITEM_INLINE_HELP_TEXT = renderer.substitute(ctx.session, inline, ctx.page, "HTML");
  const target2 = LABEL_FOR[type];
  if (target2) values.LABEL_OPEN = `label for="${target2(name)}"`;
};

// packages/core/src/preview/extensions/items.ts
var reply = (body3, status = 200) => ({
  status,
  type: "json",
  body: JSON.stringify(body3)
});
function pluginRequest(renderer, session, body3) {
  const form = new URLSearchParams(body3);
  let json3 = {};
  try {
    json3 = JSON.parse(form.getAll("p_json").join("") || "{}");
  } catch {
    return reply({ error: "p_json is not valid JSON" }, 400);
  }
  const identifier = (form.get("p_request") ?? "").replace(/^PLUGIN=/u, "") || (json3.regions?.[0]?.ajaxIdentifier ?? "");
  const [prefix, pageId, name] = identifier.split(":");
  if (prefix !== "LOCAL" || !pageId || !name)
    return reply({ error: `Unknown ajax identifier ${identifier}` }, 400);
  const submitted = Array.isArray(json3.pageItems) ? json3.pageItems : json3.pageItems?.itemsToSubmit ?? [];
  for (const entry of submitted)
    session.items[entry.n.toUpperCase()] = Array.isArray(entry.v) ? entry.v.join(":") : String(entry.v ?? "");
  if (!renderer.findPage(pageId)) return reply({ error: `Page ${pageId} not found` }, 404);
  const ctx = renderer.prepareSubmit(session, pageId, "");
  const item2 = renderer.pageComponents(ctx, "pageItem").find((candidate) => candidate.id.toUpperCase() === name);
  if (!item2) return reply({ error: `Item ${name} not found on page ${pageId}` }, 404);
  return { ctx, item: item2, name, form, json: json3 };
}
var escaped = (entries) => entries.map((entry) => ({ r: escapeHtml(entry.r), d: escapeHtml(entry.d) }));
function matches(text5, search) {
  return text5.toLowerCase().includes(search.toLowerCase());
}
function popupLovResponse(renderer, request) {
  const { ctx, item: item2, name, form, json: json3 } = request;
  const lov = lovRows(renderer, ctx, item2);
  const fields = [...lov.columns.map((column) => column.name)];
  if (!fields.includes(lov.returned)) fields.push(lov.returned);
  const action = form.get("p_widget_action");
  if (action === "get-row-values") {
    const values = form.getAll("f01").flatMap((value) => splitValues(item2, value));
    return reply(
      Object.fromEntries(
        values.map((value) => {
          const row = lov.rows.find((candidate) => candidate[lov.returned] === value);
          return [value, { display: row?.[lov.display] ?? value, columns: row ?? {} }];
        })
      )
    );
  }
  if (action === "get-default-values") return reply({});
  const region = json3.regions?.[0];
  const fetchData = region?.fetchData ?? {};
  const search = (fetchData.search ?? "").trim();
  const searchable = lov.columns.filter((column) => column.searchable).map((column) => column.name);
  const rows = search ? lov.rows.filter((row) => searchable.some((column) => matches(row[column] ?? "", search))) : lov.rows;
  const first = Math.max(1, Number(fetchData.firstRow ?? 1));
  const max = Number(fetchData.maxRows ?? 0) || rows.length;
  const page = rows.slice(first - 1, first - 1 + max);
  return reply({
    regions: [
      {
        id: region?.id ?? name,
        fetchedData: {
          values: page.map((row) => fields.map((field) => row[field] ?? "")),
          firstRow: first,
          moreData: first - 1 + max < rows.length
        }
      }
    ]
  });
}
function comboResponse(renderer, request, displayOnly2) {
  const { ctx, item: item2, form } = request;
  const lov = lovRows(renderer, ctx, item2);
  const extra = lov.columns.filter((column) => column.name !== lov.display);
  const toChoice = (row) => ({
    ...displayOnly2 ? {} : { r: row[lov.returned] ?? "" },
    d: row[lov.display] ?? "",
    ...extra.length ? { cols: extra.map((column) => row[column.name] ?? "") } : {}
  });
  const fields = extra.length ? Object.fromEntries(
    extra.map((column, index) => [column.name, { index, searchable: column.searchable }])
  ) : void 0;
  if (form.get("p_widget_action") === "get-display-values") {
    const values = splitValues(item2, form.get("x03") ?? "");
    return reply({
      ...fields ? { fields } : {},
      data: lov.rows.filter((row) => values.includes(row[lov.returned] ?? "")).map(toChoice)
    });
  }
  const search = form.get("x01") ?? "";
  const max = Number(form.get("x02") ?? 0) || 250;
  const offset = Math.max(0, Number(form.get("x04") ?? 1) - 1);
  const rows = (search ? lov.rows.filter((row) => matches(row[lov.display] ?? "", search)) : lov.rows).slice(
    offset,
    offset + max
  );
  return reply({ ...fields ? { fields } : {}, data: rows.map(toChoice) });
}
var ajax = (renderer, session, request) => {
  const parsed2 = pluginRequest(renderer, session, request.body);
  if ("type" in parsed2) return parsed2;
  const { ctx, item: item2, name, form } = parsed2;
  const type = str(item2.props, "type", "textField");
  switch (type) {
    case "selectList":
    case "shuttle":
      return reply({ values: escaped(renderer.lov(ctx, get(item2.props, "lov"), name)) });
    case "radioGroup":
    case "checkboxGroup":
      return reply({
        html: choices(renderer, ctx, item2, name, "", type === "radioGroup" ? "radio" : "checkbox")
      });
    case "popupLov":
      return popupLovResponse(renderer, parsed2);
    case "combobox":
    case "selectOne":
    case "selectMany":
      return comboResponse(renderer, parsed2, false);
    case "textFieldWithAutocomplete":
    case "autoComplete":
      return comboResponse(renderer, parsed2, true);
    case "qrCode":
      return reply({
        QR: qrMarkup(item2, form.get("x01") ?? "", form.get("x02") || void 0, form.get("x03") || void 0)
      });
    default:
      renderer.diagnose("info", `Ajax call of item ${name} (${type}) is not simulated`, ctx.pageId, name);
      return reply({});
  }
};
var help = (renderer, session, request) => {
  const pageId = request.params.get("page") ?? "";
  const name = (request.params.get("p_item_id") ?? "").toUpperCase();
  if (!renderer.findPage(pageId)) return reply({ error: `Page ${pageId} not found` }, 404);
  const ctx = renderer.prepareSubmit(session, pageId, "");
  const item2 = renderer.pageComponents(ctx, "pageItem").find((candidate) => candidate.id.toUpperCase() === name);
  const text5 = item2 ? str(item2.props, "help.helpText") : "";
  if (!item2 || !text5) return reply({ error: `No help for ${name}` }, 404);
  return reply({
    title: escapeHtml(renderer.substitute(session, renderer.label(item2), ctx.page, "RAW")),
    helpText: `<div class="apex-help-dialog">${renderer.substitute(session, text5, ctx.page, "HTML")}</div>`
  });
};
var IGNORED = [
  ["gen-ai", "genAi"],
  ["geocoding", "geocodingInput"],
  ["session state encryption", "security.encryptSessionState"],
  ["restricted characters", "security.restrictedChars"],
  ["session state protection", "security.sessionStateProtection"],
  ["client-side init JavaScript function", "advanced.initJavaScriptFunction"]
];
registerExtension({
  name: "items",
  items: ITEM_RENDERERS,
  itemTemplate: (renderer, ctx, item2, values) => {
    itemTemplate(renderer, ctx, item2, values);
    for (const [label, key] of IGNORED)
      if (get(item2.props, key) !== void 0)
        renderer.diagnose(
          "info",
          `Item ${item2.id.toUpperCase()}: ${label} is not simulated locally`,
          ctx.pageId,
          item2.id.toUpperCase()
        );
  },
  page: (renderer, ctx) => {
    ctx.onload.unshift(
      `apex.libVersions = Object.assign(${JSON.stringify(libVersions(renderer))}, apex.libVersions);`
    );
  },
  routes: { "items.ajax": ajax, "items.help": help },
  client: ITEMS_CLIENT,
  css: ITEMS_CSS
});

// packages/core/src/preview/extensions/reports/shared.ts
var STATES = /* @__PURE__ */ new WeakMap();
var stateKey = (pageId, regionId) => `${pageId}:${regionId}`;
function reportState(session, key, init) {
  let states = STATES.get(session);
  if (!states) STATES.set(session, states = /* @__PURE__ */ new Map());
  let state2 = states.get(key);
  if (!state2) states.set(key, state2 = init());
  return state2;
}
function peekState(session, key) {
  return STATES.get(session)?.get(key);
}
function resetState(session, key) {
  STATES.get(session)?.delete(key);
}
function sequenceOf(component) {
  return num(component.props, "layout.sequence", num(component.props, "sequence", 0));
}
function bySequence(components) {
  return [...components].sort((a, b) => sequenceOf(a) - sequenceOf(b));
}
function initcap(name) {
  return name.toLowerCase().replace(/_/gu, " ").replace(/\b\w/gu, (char) => char.toUpperCase());
}
function syntheticColumn(name) {
  return { type: "column", id: name, props: {}, children: [], file: "", line: 0 };
}
function regionColumns(region, resultColumns) {
  const declared = region.children.filter((child) => child.type === "column");
  if (!declared.length) return resultColumns.map(syntheticColumn);
  const names = new Set(declared.map((column) => column.id.toUpperCase()));
  return [...bySequence(declared), ...resultColumns.filter((name) => !names.has(name)).map(syntheticColumn)];
}
function isSpecialColumn(name) {
  return /^(APEX\$|ROWID$)/u.test(name.toUpperCase());
}
function primarySavedReport(region) {
  const saved = region.children.filter((child) => child.type === "savedReport");
  return saved.find((child) => /^primary/u.test(str(child.props, "visibility", "primaryDefault"))) ?? saved[0];
}
function columnRef(component) {
  return (ref(component.props, "column") ?? component.id).toUpperCase();
}
function findRegion2(renderer, ctx, id) {
  return renderer.pageComponents(ctx, "region").find((candidate) => renderer.regionDomId(candidate) === id || candidate.id === id);
}
function since(value, now = Date.now()) {
  if (value === null || value === void 0 || value === "") return "";
  const date = new Date(typeof value === "number" ? value : String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  const seconds = Math.round((now - date.getTime()) / 1e3);
  const future = seconds < 0;
  const abs = Math.abs(seconds);
  const units = [
    [31536e3, "year"],
    [2592e3, "month"],
    [604800, "week"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"]
  ];
  for (const [size, unit] of units) {
    const count = Math.floor(abs / size);
    if (count >= 1) return `${count} ${unit}${count === 1 ? "" : "s"} ${future ? "from now" : "ago"}`;
  }
  return `${abs} second${abs === 1 ? "" : "s"} ${future ? "from now" : "ago"}`;
}
function formatValue2(raw, mask) {
  if (raw === null || raw === void 0) return "";
  if (!mask) return String(raw);
  if (/^since(_short)?$/iu.test(mask)) return since(raw);
  if (/^pct_graph/iu.test(mask)) return String(raw);
  return formatOracle(raw, mask) ?? "";
}
var SUPPORTED_MASK = /^(FM)?[L$]?[0-9GD,.]+$|9|^since(_short)?$|^[A-Z]{0,4}(YYYY|RR|YY|MON|MM|DD|HH|MI|SS|[ ./:-]|AM|PM|DS|DL|MONTH|FM)+$/iu;
var Cells = class {
  #lovs = /* @__PURE__ */ new Map();
  renderer;
  ctx;
  region;
  constructor(renderer, ctx, region) {
    this.renderer = renderer;
    this.ctx = ctx;
    this.region = region;
  }
  lov(column) {
    const type = str(column.props, "type", "plainText");
    const spec = get(column.props, "lov");
    if (!isObject(spec) || !/lov|selectList|radioGroup|popupLov|BasedOnLov/iu.test(type)) return void 0;
    const name = column.id.toUpperCase();
    let map = this.#lovs.get(name);
    if (!map) {
      map = new Map(
        this.renderer.lov(this.ctx, spec, `${this.region.id}.${name}`).map((entry) => [entry.r, entry.d])
      );
      this.#lovs.set(name, map);
    }
    return map;
  }
  /** Plain display text (no markup): used for searching, filtering, sorting by display and CSV. */
  text(column, row) {
    const raw = row[column.id.toUpperCase()];
    if (raw === null || raw === void 0) return "";
    const lov = this.lov(column);
    if (lov) {
      const value = String(raw);
      return lov.get(value) ?? value;
    }
    const mask = str(column.props, "appearance.formatMask");
    if (mask && !SUPPORTED_MASK.test(mask))
      this.renderer.diagnose(
        "info",
        `Format mask ${mask} of ${this.region.id}.${column.id} is approximated`,
        this.ctx.pageId,
        this.region.id
      );
    return formatValue2(raw, mask);
  }
  escapes(column) {
    return bool(
      column.props,
      "security.escapeSpecialChars",
      bool(this.region.props, "security.escapeSpecialChars", true)
    );
  }
  /** `#COLUMN#` substitutions inside templates use the escaped (or raw) column values. */
  substituteRow(template, row, escape = true) {
    const replaced = template.replace(/#([A-Za-z0-9_$]+)#/gu, (whole, key) => {
      const name = key.toUpperCase();
      if (!(name in row)) return whole;
      const value = row[name] === null || row[name] === void 0 ? "" : String(row[name]);
      return escape ? escapeHtml(value) : value;
    });
    return this.renderer.substitute(this.ctx.session, replaced, this.ctx.page, "HTML");
  }
  /** Cell HTML. `trigger` is the JavaScript expression used as triggering element for dialog links. */
  html(column, row, trigger) {
    const type = str(column.props, "type", "plainText");
    const custom = columnRenderer(type);
    if (custom) return custom(this.renderer, this.ctx, this.region, column, row);
    const value = this.text(column, row);
    let html = this.escapes(column) ? escapeHtml(value) : value;
    const expression = str(column.props, "columnFormatting.htmlExpression") || str(column.props, "settings.htmlExpression");
    if (expression) html = this.substituteRow(expression, row);
    const target2 = get(column.props, "link.target");
    if (type === "link" || target2 !== void 0) {
      const text5 = this.substituteRow(
        str(column.props, "link.linkText", `#${column.id.toUpperCase()}#`),
        row
      );
      const attributes = this.substituteRow(str(column.props, "link.linkAttributes"), row);
      const href = this.renderer.link(
        this.ctx,
        target2,
        row,
        trigger ?? `apex.jQuery('#${this.renderer.regionDomId(this.region)}')`
      );
      html = `<a href="${escapeHtml(href)}"${attributes ? ` ${attributes}` : ""}>${text5}</a>`;
    }
    if (type === "percentGraph" || /^pct_graph/iu.test(str(column.props, "appearance.formatMask"))) {
      const percent = Math.max(0, Math.min(100, Number(row[column.id.toUpperCase()]) || 0));
      html = `<div class="a-Report-percentChart"><div class="a-Report-percentChart-fill" style="width:${percent}%"></div><span class="u-VisuallyHidden">${percent}%</span></div>`;
    }
    return html;
  }
  heading(column) {
    const explicit = get(column.props, "heading.heading");
    if (explicit !== void 0)
      return this.renderer.substitute(this.ctx.session, str(column.props, "heading.heading"), this.ctx.page);
    const type = str(this.region.props, "heading.type");
    if (type === "none") return "";
    if (type === "columnNames") return escapeHtml(column.id.toUpperCase());
    return escapeHtml(initcap(column.id));
  }
  /** Heading without markup, for menus and chips. */
  label(column) {
    const html = this.heading(column).replace(/<[^>]*>/gu, "").trim();
    return html.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&") || initcap(column.id);
  }
};
function headingAlignment(renderer, column, sample) {
  const alignment = str(column.props, "heading.alignment");
  if (/end|right/u.test(alignment)) return "u-tR";
  if (/center/u.test(alignment)) return "u-tC";
  if (/start|left/u.test(alignment)) return "u-tL";
  return renderer.alignment(column, sample);
}
function numeric2(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || value.trim() === "") return void 0;
  const parsed2 = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed2) ? parsed2 : void 0;
}
function compareValues(a, b) {
  const left = numeric2(a);
  const right = numeric2(b);
  if (left !== void 0 && right !== void 0) return left - right;
  return String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
}
var isEmpty = (value) => value === null || value === void 0 || value === "";
var OPERATOR_ALIASES = {
  equals: "=",
  notEquals: "!=",
  greaterThan: ">",
  greaterThanOrEquals: ">=",
  lessThan: "<",
  lessThanOrEquals: "<=",
  isEmpty: "isNull",
  isNotEmpty: "isNotNull",
  notContains: "doesNotContain"
};
var OPERATOR_LABELS = {
  "=": "=",
  "!=": "!=",
  ">": ">",
  ">=": ">=",
  "<": "<",
  "<=": "<=",
  contains: "contains",
  doesNotContain: "does not contain",
  startsWith: "starts with",
  isNull: "is empty",
  isNotNull: "is not empty",
  like: "like",
  notLike: "not like",
  in: "in",
  notIn: "not in",
  between: "between"
};
function normalizeOperator(operator) {
  return OPERATOR_ALIASES[operator] ?? operator;
}
var SUPPORTED_OPERATORS = new Set(Object.keys(OPERATOR_LABELS));
function likeRegex(pattern) {
  const source = pattern.split("").map((char) => char === "%" ? ".*" : char === "_" ? "." : char.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("");
  return new RegExp(`^${source}$`, "isu");
}
function matches2(filter, raw, display) {
  const operator = normalizeOperator(filter.operator);
  const value = filter.value;
  const text5 = display.toLowerCase();
  const needle = value.toLowerCase();
  const equalsEither = (candidate) => !isEmpty(raw) && compareValues(raw, candidate) === 0 && numeric2(raw) !== void 0 || String(raw ?? "") === candidate || display === candidate;
  switch (operator) {
    case "=":
      return equalsEither(value);
    case "!=":
      return !equalsEither(value);
    case ">":
      return !isEmpty(raw) && compareValues(raw, value) > 0;
    case ">=":
      return !isEmpty(raw) && compareValues(raw, value) >= 0;
    case "<":
      return !isEmpty(raw) && compareValues(raw, value) < 0;
    case "<=":
      return !isEmpty(raw) && compareValues(raw, value) <= 0;
    case "contains":
      return text5.includes(needle);
    case "doesNotContain":
      return !text5.includes(needle);
    case "startsWith":
      return text5.startsWith(needle);
    case "isNull":
      return isEmpty(raw);
    case "isNotNull":
      return !isEmpty(raw);
    case "like":
      return likeRegex(value).test(display) || likeRegex(value).test(String(raw ?? ""));
    case "notLike":
      return !likeRegex(value).test(display) && !likeRegex(value).test(String(raw ?? ""));
    case "in":
      return value.split(",").some((entry) => equalsEither(entry.trim()));
    case "notIn":
      return !value.split(",").some((entry) => equalsEither(entry.trim()));
    case "between":
      return !isEmpty(raw) && compareValues(raw, value) >= 0 && compareValues(raw, filter.value2 ?? value) <= 0;
    default:
      return true;
  }
}
function applyFiltersAndSort(rows, cells, columns, searchable, filters, sort) {
  let result = rows;
  for (const filter of filters) {
    if (!filter.enabled) continue;
    if (!filter.column) {
      const needle = filter.value.toLowerCase();
      result = result.filter(
        (row) => searchable.some((column2) => cells.text(column2, row).toLowerCase().includes(needle))
      );
      continue;
    }
    const column = columns.get(filter.column);
    if (!column) continue;
    result = result.filter((row) => matches2(filter, row[filter.column], cells.text(column, row)));
  }
  const order = sort.filter((entry) => columns.has(entry.column));
  if (order.length) {
    result = [...result].sort((a, b) => {
      for (const entry of order) {
        const column = columns.get(entry.column);
        const lov = cells.lov(column);
        const left = lov ? cells.text(column, a) : a[entry.column];
        const right = lov ? cells.text(column, b) : b[entry.column];
        const direction = entry.direction === "desc" ? -1 : 1;
        const nullsFirst = entry.nulls ? entry.nulls === "first" : entry.direction === "desc";
        if (isEmpty(left) || isEmpty(right)) {
          if (isEmpty(left) && isEmpty(right)) continue;
          return isEmpty(left) === nullsFirst ? -1 : 1;
        }
        const compared = compareValues(left, right);
        if (compared) return compared * direction;
      }
      return 0;
    });
  }
  return result;
}
function filterLabel(filter, label) {
  const operator = normalizeOperator(filter.operator);
  if (!filter.column) return `Row text contains '${filter.value}'`;
  if (operator === "isNull" || operator === "isNotNull") return `${label} ${OPERATOR_LABELS[operator]}`;
  if (operator === "between") return `${label} between '${filter.value}' and '${filter.value2 ?? ""}'`;
  if (operator === "in" || operator === "notIn")
    return `${label} ${OPERATOR_LABELS[operator]} '${filter.value.split(",").join(`', '`)}'`;
  return `${label} ${OPERATOR_LABELS[operator] ?? operator} '${filter.value}'`;
}
function savedFilters(renderer, ctx, region, saved) {
  const filters = [];
  for (const child of saved?.children.filter((entry) => entry.type === "filter") ?? []) {
    const type = str(child.props, "type", "column");
    const enabled = bool(child.props, "advanced.enabled", bool(child.props, "enabled", true));
    if (type === "rowSearch") {
      filters.push({ column: "", operator: "contains", value: str(child.props, "search"), enabled });
      continue;
    }
    const operator = normalizeOperator(str(child.props, "operator", "="));
    if (type !== "column" || !SUPPORTED_OPERATORS.has(operator)) {
      renderer.diagnose(
        "info",
        `Saved report filter ${type === "column" ? `operator ${operator}` : type} in ${region.id} is not simulated`,
        ctx.pageId,
        region.id
      );
      continue;
    }
    filters.push({
      column: (ref(child.props, "column") ?? "").toUpperCase(),
      operator,
      value: str(child.props, "value", str(child.props, "from")),
      ...str(child.props, "to") ? { value2: str(child.props, "to") } : {},
      enabled
    });
  }
  return filters;
}
function savedSorts(saved) {
  return bySequence(saved?.children.filter((entry) => entry.type === "sort") ?? []).sort((a, b) => num(a.props, "sort.sequence", 0) - num(b.props, "sort.sequence", 0)).map((entry) => {
    const nulls = str(entry.props, "sort.nulls");
    return {
      column: columnRef(entry),
      direction: str(entry.props, "sort.direction", "asc") === "desc" ? "desc" : "asc",
      ...nulls === "first" || nulls === "last" ? { nulls } : {}
    };
  });
}
function diagnoseSavedReport(renderer, ctx, region, saved) {
  if (!saved) return;
  const unsupported2 = /* @__PURE__ */ new Set(["aggregate", "computation", "controlBreak", "highlight"]);
  for (const child of saved.children)
    if (unsupported2.has(child.type))
      renderer.diagnose(
        "info",
        `Saved report ${child.type} in ${region.id} is not simulated`,
        ctx.pageId,
        region.id
      );
  const view = str(saved.props, "view.default");
  if (view && view !== "report" && view !== "grid")
    renderer.diagnose(
      "info",
      `Saved report view ${view} in ${region.id} is shown as a report`,
      ctx.pageId,
      region.id
    );
  if (get(saved.props, "flashback.minutesAgo") !== void 0)
    renderer.diagnose("info", `Flashback in ${region.id} is not simulated`, ctx.pageId, region.id);
  const others = region.children.filter(
    (child) => child.type === "savedReport" && child !== saved && !/^primary/u.test(str(child.props, "visibility"))
  );
  if (others.length)
    renderer.diagnose(
      "info",
      `${others.length} alternative/public saved report(s) of ${region.id} are not offered locally`,
      ctx.pageId,
      region.id
    );
}
function toCsv(headings, rows, separator2 = ",", enclosure = '"') {
  const quote = (value) => enclosure && (value.includes(separator2) || value.includes(enclosure) || /[\r\n]/u.test(value)) ? `${enclosure}${value.replaceAll(enclosure, enclosure + enclosure)}${enclosure}` : value;
  return [headings, ...rows].map((line) => line.map(quote).join(separator2)).join("\r\n") + "\r\n";
}
function stringList(values) {
  return values.map(
    (value) => typeof value === "string" ? value : isRef(value) ? value.ref : String(value)
  );
}
function rowLimit(region, fallback) {
  return Math.max(1, num(region.props, "performance.maxRowsToProcess", fallback));
}

// packages/core/src/preview/extensions/reports/classic-report.ts
function defaultSort(columns) {
  return columns.filter((column) => str(column.props, "sorting.defaultSequence")).sort((a, b) => num(a.props, "sorting.defaultSequence", 0) - num(b.props, "sorting.defaultSequence", 0)).map((column) => ({
    column: column.id.toUpperCase(),
    direction: str(column.props, "sorting.direction") === "desc" ? "desc" : "asc"
  }));
}
function classicState(ctx, region) {
  return reportState(ctx.session, stateKey(ctx.pageId, region.id), () => ({
    filters: [],
    sort: defaultSort(region.children.filter((child) => child.type === "column"))
  }));
}
var PAGINATION_TYPES = /* @__PURE__ */ new Set([
  "rowRangesXToY",
  "rowRangesXToYOfZ",
  "rowRangesXToYNoPagination",
  "rowRangesXToYOfZNoPagination",
  "rowRangesXToYOfZWithPagination",
  "setPaginationLinks",
  "setPaginationSelectList",
  "setPaginationSearchEngine",
  "nextAndPreviousLinks"
]);
function pagination(template, type, pager) {
  const { domId, page, perPage, total, shown, align } = pager;
  if (!shown) return "";
  const first = (page - 1) * perPage + 1;
  const last = first + shown - 1;
  const pages2 = Math.max(1, Math.ceil(total / perPage));
  const link = (target2) => `javascript:apexLocalReports.paginate('${escapeHtml(domId)}',${target2})`;
  const textTemplate = text(template, "pagination_template") || '<span class="t-Report-paginationText">#TEXT#</span>';
  const ofTotal = /OfZ/u.test(type) ? ` of ${total}` : "";
  const range = fill(textTemplate, { TEXT: `${first} - ${last}${ofTotal}` });
  if (/NoPagination$/u.test(type)) return `<tr><td colspan="99"${align}>${range}</td></tr>`;
  const previous = page > 1 ? fill(
    text(template, "previous_page_template") || '<a href="#LINK#" class="t-Report-paginationLink t-Report-paginationLink--prev">#PAGINATION_PREVIOUS#</a>',
    { LINK: link(page - 1), PAGINATION_PREVIOUS: "Previous" }
  ) : "";
  const next = last < total ? fill(
    text(template, "next_page_template") || '<a href="#LINK#" class="t-Report-paginationLink t-Report-paginationLink--next">#PAGINATION_NEXT#</a>',
    { LINK: link(page + 1), PAGINATION_NEXT: "Next" }
  ) : "";
  if (type === "nextAndPreviousLinks") return `<tr><td colspan="99"${align}>${previous}${next}</td></tr>`;
  if (type === "setPaginationSelectList") {
    const options2 = Array.from({ length: pages2 }, (_unused, index) => {
      const from = index * perPage + 1;
      const to = Math.min(total, from + perPage - 1);
      return `<option value="${index + 1}"${index + 1 === page ? " selected" : ""}>${from} - ${to} of ${total}</option>`;
    }).join("");
    return `<tr><td colspan="99"${align}>${previous}<select class="t-Report-paginationSelect apex-item-select" aria-label="Pagination" onchange="apexLocalReports.paginate('${escapeHtml(domId)}',this.value)">${options2}</select>${next}</td></tr>`;
  }
  if (type === "setPaginationLinks" || type === "setPaginationSearchEngine") {
    const links = Array.from({ length: pages2 }, (_unused, index) => {
      const from = index * perPage + 1;
      const to = Math.min(total, from + perPage - 1);
      const label = type === "setPaginationLinks" ? `${from}-${to}` : String(index + 1);
      return index + 1 === page ? `<span class="t-Report-paginationText"><b>${label}</b></span>` : `<a href="${link(index + 1)}" class="t-Report-paginationLink">${label}</a>`;
    }).join(" ");
    return `<tr><td colspan="99"${align}>${previous}${links}${next}</td></tr>`;
  }
  return `<tr><td colspan="99"${align}>${previous}${range}${next}</td></tr>`;
}
function classicReport(renderer, ctx, region) {
  const sql = renderer.regionSql(ctx, region);
  if (!sql)
    return `<div class="apex-local-unsupported">Report \u201C${escapeHtml(str(region.props, "name", region.id))}\u201D has no local source.</div>`;
  const limit = rowLimit(region, 500);
  const result = renderer.query(ctx, region, sql, limit + 1);
  if (result.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(result.error)}</div></div>`;
  const domId = renderer.regionDomId(region);
  ctx.clientConfig.regions.push({ id: domId, kind: "classicReport" });
  diagnoseClassic(renderer, ctx, region);
  const state2 = classicState(ctx, region);
  const cells = new Cells(renderer, ctx, region);
  const all = regionColumns(region, result.columns);
  const byName = new Map(all.map((column) => [column.id.toUpperCase(), column]));
  const moreData = result.rows.length > limit;
  const rows = applyFiltersAndSort(result.rows.slice(0, limit), cells, byName, [], [], state2.sort);
  const columns = all.filter(
    (column) => !/^hidden/u.test(str(column.props, "type")) && !isSpecialColumn(column.id)
  );
  const perPage = Math.max(1, num(region.props, "reportLayout.numberOfRows", 15));
  const type = str(region.props, "pagination.type", "rowRangesXToY");
  const noPaging = /NoPagination$/u.test(type);
  const key = stateKey(ctx.pageId, region.id);
  const pages2 = Math.max(1, Math.ceil(rows.length / perPage));
  const page = noPaging ? 1 : Math.min(pages2, Math.max(1, ctx.session.pagination[key] ?? 1));
  const visible = rows.slice((page - 1) * perPage, page * perPage);
  const noData = renderer.substitute(
    ctx.session,
    str(region.props, "messages.whenNoDataFound", "no data found"),
    ctx.page,
    "HTML"
  );
  const moreMessage = moreData ? `<div class="t-Report-moreData apex-local-moreData">${escapeHtml(
    str(
      region.props,
      "messages.whenMoreDataFound",
      "This query returns more than #MAX_ROW_COUNT# rows, please filter your data to ensure complete results."
    ).replaceAll("#MAX_ROW_COUNT#", String(limit))
  )}</div>` : "";
  const templateId = (ref(region.props, "componentAppearance.template") ?? ref(region.props, "appearance.reportTemplate") ?? defaultStaticId(renderer.theme, "default_report_template", "standard")).toLowerCase();
  const template = renderer.theme.reports.get(templateId) ?? renderer.theme.reports.get("standard");
  if (!renderer.theme.reports.has(templateId))
    renderer.diagnose(
      "warning",
      `Report template @/${templateId} not found; used Standard`,
      ctx.pageId,
      region.id
    );
  const cssClasses = templateOptions(
    stringList(list(region.props, "componentAppearance.templateOptions")),
    text(template, "preset_template_options").replaceAll(":", " ")
  );
  const pager = pagination(template, type, {
    domId,
    page,
    perPage,
    total: rows.length,
    shown: visible.length,
    align: /Right$/u.test(str(region.props, "pagination.displayPosition", "bottomRight")) ? ' align="right"' : ""
  });
  const position2 = str(region.props, "pagination.displayPosition", "bottomRight");
  const csv = get(region.props, "download.csvExportEnabled") === true ? `<a href="javascript:apexLocalReports.download('${escapeHtml(domId)}','csv')" class="t-Report-csvLink">${escapeHtml(str(region.props, "download.linkText", "Download"))}</a>` : "";
  const shared = {
    DOM_ID: domId,
    REGION_ID: domId,
    REGION_STATIC_ID: domId,
    REGION_TITLE: escapeHtml(str(region.props, "title", str(region.props, "name"))),
    COMPONENT_CSS_CLASSES: [cssClasses, ...stringList(list(region.props, "componentAppearance.cssClasses"))].filter(Boolean).join(" "),
    REPORT_ATTRIBUTES: renderer.substitute(
      ctx.session,
      str(region.props, "componentAppearance.customAttributes"),
      ctx.page,
      "RAW"
    ),
    TOP_PAGINATION: /^top/u.test(position2) ? pager : "",
    PAGINATION: /^top(Left|Right)$/u.test(position2) ? "" : pager,
    CSV_LINK: csv,
    EXTERNAL_LINK: ""
  };
  if (!visible.length)
    return `<div class="t-Report ${escapeHtml(shared.COMPONENT_CSS_CLASSES)}" id="report_${escapeHtml(domId)}" data-region-id="${escapeHtml(domId)}"><div class="t-Report-wrap"><span class="nodatafound">${noData}</span></div></div>`;
  const breakCount = { col1: 1, "cols1-2": 2, "cols1-3": 3 }[str(region.props, "breakFormatting.breakColumns")] ?? 0;
  const display = (column, row, index) => {
    const position3 = columns.indexOf(column);
    if (position3 >= 0 && position3 < breakCount && index > 0) {
      const previous = visible[index - 1];
      if (columns.slice(0, position3 + 1).every((entry) => previous[entry.id.toUpperCase()] === row[entry.id.toUpperCase()]))
        return "";
    }
    if (str(column.props, "type") === "rowSelector")
      return `<input type="checkbox" class="u-selector" value="${escapeHtml(String(row[column.id.toUpperCase()] ?? ""))}" aria-label="Select row">`;
    return cells.html(column, row);
  };
  if (text(template, "row_template_type") === "NAMED_COLUMNS") {
    const rowHtml = visible.map(
      (row, index) => fill(text(template, "row_template1"), {
        ...Object.fromEntries(Object.keys(row).map((name) => [name, escapeHtml(row[name] ?? "")])),
        ...Object.fromEntries(all.map((column) => [column.id.toUpperCase(), display(column, row, index)])),
        ROWNUM: String((page - 1) * perPage + index + 1),
        COLCOUNT: String(columns.length)
      })
    ).join("\n");
    return fill(text(template, "row_template_before_rows"), shared) + rowHtml + fill(text(template, "row_template_after_rows"), shared) + moreMessage;
  }
  const sorted2 = new Map(state2.sort.slice(0, 1).map((entry) => [entry.column, entry.direction]));
  const showHeadings = str(region.props, "heading.type") !== "none";
  const headings = showHeadings ? columns.map((column) => {
    const name = column.id.toUpperCase();
    const label = cells.heading(column);
    const sortable = get(column.props, "sorting.sortable") !== false && str(column.props, "type") !== "rowSelector";
    const direction = sorted2.get(name);
    const header = sortable ? `<a class="u-Report-sort" href="#" data-apex-local-sort="${escapeHtml(name)}" data-region="${escapeHtml(domId)}" title="Sort by this column"><span class="u-Report-sortHeading">${label}</span>${direction ? `<span class="u-Report-sortIcon a-Icon icon-rpt-sort-${direction}" aria-hidden="true"></span>` : ""}</a>` : label;
    const alignment = headingAlignment(renderer, column, visible[0]?.[name]);
    return fill(text(template, "column_heading_template"), {
      COLUMN_HEADER: header,
      COLUMN_HEADER_NAME: escapeHtml(name),
      ALIGNMENT: `align="${alignment === "u-tR" ? "right" : alignment === "u-tC" ? "center" : "left"}"`,
      ARIA_SORT: direction ? `aria-sort="${direction === "asc" ? "ascending" : "descending"}"` : "",
      COLUMN_WIDTH: "",
      COLUMN_NUM: String(columns.indexOf(column) + 1)
    });
  }).join("") : "";
  const body3 = visible.map(
    (row, index) => fill(text(template, "row_template_before_first"), { ROWNUM: String(index + 1) }) + columns.map((column) => {
      const alignment = renderer.alignment(column, row[column.id.toUpperCase()]);
      return fill(text(template, "row_template1"), {
        COLUMN_VALUE: display(column, row, index),
        ALIGNMENT: `align="${alignment === "u-tR" ? "right" : alignment === "u-tC" ? "center" : "left"}"`,
        ACCESSIBLE_HEADERS: `headers="${escapeHtml(column.id.toUpperCase())}"`,
        COLUMN_HEADER: cells.heading(column),
        COLUMN_NUM: String(columns.indexOf(column) + 1)
      });
    }).join("") + text(template, "row_template_after_last")
  ).join("\n");
  return fill(text(template, "row_template_before_rows"), shared) + (showHeadings ? text(template, "before_column_heading") + headings + text(template, "after_column_heading") : "<tbody>") + body3 + fill(text(template, "row_template_after_rows"), shared) + moreMessage;
}
function diagnoseClassic(renderer, ctx, region) {
  const note = (message) => renderer.diagnose("info", message, ctx.pageId, region.id);
  const type = str(region.props, "pagination.type");
  if (type && !PAGINATION_TYPES.has(type))
    note(`Classic report ${region.id}: pagination type ${type} is shown as row ranges`);
  if (str(region.props, "componentAppearance.templateType") === "predefined")
    note(
      `Classic report ${region.id}: predefined template ${str(region.props, "componentAppearance.template")} is shown with the theme report template`
    );
  if (str(region.props, "reportLayout.numberOfRowsType") === "itemValue")
    note(`Classic report ${region.id}: rows per page from an item is not simulated; 15 rows are shown`);
  if (str(region.props, "breakFormatting.style") === "repeatHeadings")
    note(`Classic report ${region.id}: repeat-heading break style is shown as default breaks`);
  if (get(region.props, "printing.enabled") === true)
    note(`Classic report ${region.id}: printing is not simulated`);
  if (get(region.props, "externalProcessing.enabled") === true)
    note(`Classic report ${region.id}: external processing link is not simulated`);
  if (str(region.props, "componentAdvanced.sortNulls"))
    note(`Classic report ${region.id}: sort nulls setting uses Oracle defaults`);
  for (const column of region.children.filter((child) => child.type === "column")) {
    const columnType = str(column.props, "type", "plainText");
    if (!columnRenderer(columnType) && !/^(plainText|plainTextBasedOnLov|link|hidden|hiddenSavesState|rowSelector|richText|percentGraph|displayAsTextSavesState|plainTextSavesState)$/u.test(
      columnType
    ))
      note(`Classic report column ${region.id}.${column.id} of type ${columnType} is shown as text`);
    if (get(column.props, "columnFormatting.cssClasses") !== void 0 || get(column.props, "columnFormatting.cssStyle") !== void 0)
      note(`Classic report column ${region.id}.${column.id}: column CSS formatting is not applied`);
  }
}

// packages/core/src/preview/extensions/reports/client.ts
var REPORT_MESSAGES = {
  "APEX.GV.AGG_CONTEXT": "Aggregate.",
  "APEX.GV.BLANK_HEADING": "Blank heading",
  "APEX.GV.BREAK_COLLAPSE": "Collapse control break",
  "APEX.GV.BREAK_CONTEXT": "Control break.",
  "APEX.GV.BREAK_EXPAND": "Expand control break",
  "APEX.GV.DELETED_COUNT": "%0 rows deleted",
  "APEX.GV.DUP_REC_ID": "Duplicate identity",
  "APEX.GV.ENTER_EDIT_MODE": "Entering edit mode",
  "APEX.GV.LEAVE_EDIT_MODE": "Leaving edit mode",
  "APEX.GV.FIRST_PAGE": "First",
  "APEX.GV.LAST_PAGE": "Last",
  "APEX.GV.NEXT_PAGE": "Next",
  "APEX.GV.PREV_PAGE": "Previous",
  "APEX.GV.FOOTER_LANDMARK": "Grid Footer",
  "APEX.GV.STATUS_LANDMARK": "Grid Status",
  "APEX.GV.GROUP_CONTEXT": "Group header",
  "APEX.GV.HEADER_CONTEXT": "Header.",
  "APEX.GV.INVALID_RANGE": "Ranges must have all the same rows or all the same columns.",
  "APEX.GV.LOAD_ALL": "Load All",
  "APEX.GV.LOAD_MORE": "Show More",
  "APEX.GV.NEW_RANGE": "Add selection",
  "APEX.GV.PAGE_RANGE": "Page rows",
  "APEX.GV.PAGE_RANGE_ENTITY": "Page %0",
  "APEX.GV.PAGE_RANGE_XY": "%0 - %1",
  "APEX.GV.PAGE_RANGE_XYZ": "%0 - %1 of %2",
  "APEX.GV.PAGE_SELECTION": "Page Selection",
  "APEX.GV.PAGINATION_LANDMARK": "Pagination",
  "APEX.GV.RANGE_DISPLAY": "Range display",
  "APEX.GV.ROWS_PASTED": "%0 rows pasted",
  "APEX.GV.ROWS_SELECTION": "Rows Selection",
  "APEX.GV.ROW_ADDED": "Added",
  "APEX.GV.ROW_CHANGED": "Changed",
  "APEX.GV.ROW_DELETED": "Deleted",
  "APEX.GV.ROW_COLUMN_CONTEXT": "Grid row sequence %0, Column %1.",
  "APEX.GV.ROW_CONTEXT": "Grid row sequence %0.",
  "APEX.GV.ROW_HEADER": "Row header",
  "APEX.GV.ROW_SELECTION": "Row Selection",
  "APEX.GV.SELECTION_CELL_COUNT": "%0 cells selected",
  "APEX.GV.SELECTION_COUNT": "%0 rows selected",
  "APEX.GV.SELECT_ALL": "Select All",
  "APEX.GV.SELECT_ALL_ROWS": "Select All Rows",
  "APEX.GV.SELECT_PAGE_N": "Page %0",
  "APEX.GV.SELECT_ROW": "Select Row",
  "APEX.GV.SORTED_ASCENDING": "Sorted Ascending %0",
  "APEX.GV.SORTED_DESCENDING": "Sorted Descending %0",
  "APEX.GV.SORT_ASCENDING": "Sort Ascending",
  "APEX.GV.SORT_ASCENDING_ORDER": "Sort Ascending %0",
  "APEX.GV.SORT_DESCENDING": "Sort Descending",
  "APEX.GV.SORT_DESCENDING_ORDER": "Sort Descending %0",
  "APEX.GV.SORT_OFF": "Don't Sort",
  "APEX.GV.SORT_OPTIONS": "Sort options",
  "APEX.GV.STATE_ICONS_LANDMARK": "State Icons",
  "APEX.GV.TOTAL_PAGES": "Total %0",
  "APEX.GV.VISUALLY_HIDDEN_LINK": "%0",
  "APEX.GV.FLOATING_ITEM.DIALOG.HIDE_DIALOG": "Hide dialog",
  "APEX.GV.FLOATING_ITEM.DIALOG.TITLE": "Floating overflow cell content",
  "APEX.GV.FLOATING_ITEM.SHOW_DIALOG": "Show overflow content",
  "APEX.TMV.REPORT_FOOTER": "Report Footer",
  "APEX.TMV.REPORT_STATUS": "Report Status",
  "APEX.TMV.SELECTION_COUNT": "%0 items selected",
  "APEX.TB.TOOLBAR": "Toolbar",
  "APEX.IG.NO_DATA_FOUND": "No data found",
  "APEX.CHECKBOX.VISUALLY_HIDDEN_CHECKBOX": "Checkbox",
  "APEX.RADIO.VISUALLY_HIDDEN_RADIO": "Radio",
  "APEX.DIALOG.VISUALLY_HIDDEN_TITLE": "Dialog"
};
var REPORTS_CSS = `
.a-IRR-sortWidget.apex-local-sortWidget{box-shadow:0 4px 16px rgba(0,0,0,.18);border:1px solid var(--a-menu-border-color,rgba(0,0,0,.15))}
.apex-local-dialog .a-IRR-dialogRow{display:flex;gap:8px;align-items:center;margin:0 0 8px}
.apex-local-dialog .a-IRR-dialogRow > *{flex:1 1 auto}
.apex-local-dialog .a-IRR-dialogRow label{flex:0 0 96px;font-weight:600}
.apex-local-dialog .apex-local-columnList{list-style:none;margin:0;padding:0;max-height:50vh;overflow:auto}
.apex-local-dialog .apex-local-columnList li{display:flex;align-items:center;gap:8px;padding:4px 0}
.apex-local-dialog .apex-local-columnList li label{flex:1 1 auto}
.apex-local-moreData{padding:8px 12px;color:var(--ut-palette-warning-contrast,#4d3300);background:var(--ut-palette-warning-shade,#fff4d6)}
.a-IG .a-IG-controlsContainer:empty{display:none}
.a-IG .a-IG-controlsContainer{padding:4px 8px;border-bottom:1px solid var(--a-gv-cell-border-color,rgba(0,0,0,.1))}
.a-Report-percentChart{position:relative;height:14px;background:rgba(0,0,0,.06);border-radius:2px;min-width:60px}
.a-Report-percentChart-fill{position:absolute;inset:0 auto 0 0;background:var(--ut-palette-primary,#056ac8);border-radius:2px}
`;
var REPORTS_CLIENT = String.raw`
window.apexLocalReports = (function ($) {
  "use strict";
  var base = location.pathname.replace(/\/[^/]*$/, "");
  var esc = function (id) { return "#" + apex.util.escapeCSS(id); };
  var html = apex.util.escapeHTML;

  function route(name, params) {
    var query = new URLSearchParams(Object.assign({ page: apex.env.APP_PAGE_ID }, params || {}));
    return base + "/__apex/x/" + name + "?" + query.toString();
  }
  function post(name, body) {
    return fetch(route(name), {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.assign({ page: apex.env.APP_PAGE_ID }, body))
    }).then(function (response) { return response.json(); });
  }
  function refresh(region, extra) {
    return apexLocal.refreshRegion(region, extra || "").then(function () { init(); });
  }
  /** Changes report state on the server, then re-renders the region. */
  function act(region, body) {
    return post("report", Object.assign({ region: region }, body)).then(function (result) {
      if (result && result.error) { apex.message.alert(result.error); return; }
      return refresh(region);
    });
  }
  function paginate(region, page) { return refresh(region, "&pg=" + encodeURIComponent(page)); }

  function download(region, format) {
    return fetch(route("report-download", { region: region, format: format || "csv" }), { credentials: "same-origin" })
      .then(function (response) { return response.json(); })
      .then(function (file) {
        if (file.error) { apex.message.alert(file.error); return; }
        var type = format === "html" ? "text/html" : "text/csv";
        var link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([file.content], { type: type + ";charset=utf-8" }));
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
      });
  }

  // ------------------------------------------------------------- dialogs

  function dialog(title, body$, buttons, cssClass) {
    var dialog$ = $("<div class='a-IRR-dialog apex-local-dialog " + (cssClass || "") + "'></div>").append(body$);
    dialog$.dialog({
      title: title, modal: true, width: 560, minHeight: 120, dialogClass: "ui-dialog--apex",
      closeText: apex.lang.getMessage("APEX.DIALOG.CLOSE"),
      close: function () { dialog$.dialog("destroy").remove(); },
      buttons: [{ text: apex.lang.getMessage("APEX.DIALOG.CANCEL"), click: function () { dialog$.dialog("close"); } }].concat(
        (buttons || []).map(function (button) {
          return { text: button.text, "class": button.hot ? "ui-button--hot" : "", click: function () {
            var result = button.click(dialog$);
            if (result !== false) dialog$.dialog("close");
          } };
        }))
    });
    return dialog$;
  }
  function columnSelect(columns, value, any) {
    return "<select class='selectlist apex-item-select'>" + (any ? "<option value=''>" + html(any) + "</option>" : "") + columns.map(function (column) {
      return "<option value='" + html(column.name) + "'" + (column.name === value ? " selected" : "") + ">" + html(column.label) + "</option>";
    }).join("") + "</select>";
  }
  var OPERATORS = [["=", "="], ["!=", "!="], [">", ">"], [">=", ">="], ["<", "<"], ["<=", "<="], ["contains", "contains"],
    ["doesNotContain", "does not contain"], ["startsWith", "starts with"], ["isNull", "is empty"], ["isNotNull", "is not empty"],
    ["in", "in"], ["notIn", "not in"], ["like", "like"], ["notLike", "not like"], ["between", "between"]];

  function columnsDialog(cfg) {
    var shown = cfg.columns.filter(function (c) { return c.shown; }).map(function (c) { return c.name; });
    var order = shown.concat(cfg.columns.filter(function (c) { return !c.shown; }).map(function (c) { return c.name; }));
    var byName = {};
    cfg.columns.forEach(function (c) { byName[c.name] = c; });
    var list$ = $("<ul class='apex-local-columnList a-IRR-columnList'></ul>");
    order.forEach(function (name) {
      var c = byName[name];
      list$.append("<li class='a-IRR-columnList-item' data-name='" + html(name) + "'><input type='checkbox' class='a-IRR-columnList-checkbox'" + (c.shown ? " checked" : "") + (c.hide === false ? " disabled" : "") + " id='apex_local_col_" + html(name) + "'><label class='a-IRR-columnList-label' for='apex_local_col_" + html(name) + "'>" + html(c.label) + "</label>" +
        "<button type='button' class='a-Button a-Button--small a-Button--noLabel' data-move='-1' title='Move Up' aria-label='Move Up'><span class='a-Icon icon-up-chevron' aria-hidden='true'></span></button>" +
        "<button type='button' class='a-Button a-Button--small a-Button--noLabel' data-move='1' title='Move Down' aria-label='Move Down'><span class='a-Icon icon-down-chevron' aria-hidden='true'></span></button></li>");
    });
    list$.on("click", "button[data-move]", function () {
      var item$ = $(this).closest("li");
      if (this.getAttribute("data-move") === "-1") item$.prev().before(item$); else item$.next().after(item$);
    });
    dialog("Columns", list$, [{ text: "Apply", hot: true, click: function () {
      var columns = list$.find("li").filter(function () { return $(this).find("input").prop("checked"); })
        .map(function () { return this.getAttribute("data-name"); }).get();
      if (!columns.length) { apex.message.alert("Select at least one column."); return false; }
      cfg.act({ action: "columns", columns: columns });
    } }], "a-IRR-dialog--selectColumns");
  }

  function filterDialog(cfg, preset) {
    preset = preset || {};
    var filterable = cfg.columns.filter(function (c) { return c.filter !== false; });
    var body$ = $("<div class='a-IRR-dialogBody'>" +
      "<div class='a-IRR-dialogRow'><label>Column</label>" + columnSelect(filterable, preset.column || (filterable[0] && filterable[0].name)) + "</div>" +
      "<div class='a-IRR-dialogRow'><label>Operator</label><select class='selectlist apex-item-select apex-local-op'>" + OPERATORS.map(function (op) {
        return "<option value='" + html(op[0]) + "'" + (op[0] === (preset.operator || "=") ? " selected" : "") + ">" + html(op[1]) + "</option>";
      }).join("") + "</select></div>" +
      "<div class='a-IRR-dialogRow'><label>Expression</label><input type='text' class='text_field apex-item-text apex-local-value' value='" + html(preset.value || "") + "'></div>" +
      "<div class='a-IRR-dialogRow apex-local-value2'><label>and</label><input type='text' class='text_field apex-item-text' value='" + html(preset.value2 || "") + "'></div></div>");
    function sync() { body$.find(".apex-local-value2").toggle(body$.find(".apex-local-op").val() === "between"); }
    body$.on("change", ".apex-local-op", sync);
    sync();
    dialog("Filter", body$, [{ text: "Apply", hot: true, click: function () {
      cfg.act({ action: "filter", column: body$.find("select").first().val(), operator: body$.find(".apex-local-op").val(),
        value: body$.find(".apex-local-value").val(), value2: body$.find(".apex-local-value2 input").val() });
    } }], "a-IRR-dialog--filter");
  }

  function sortDialog(cfg) {
    var sortable = cfg.columns.filter(function (c) { return c.sort !== false; });
    var rows = "";
    for (var i = 0; i < 6; i += 1) {
      var current = cfg.sort[i] || {};
      rows += "<div class='a-IRR-dialogRow a-IRR-sortDialogRow'><label>" + (i + 1) + "</label>" + columnSelect(sortable, current.column, "- Select Column -") +
        "<select class='selectlist apex-item-select apex-local-dir'><option value='asc'>Ascending</option><option value='desc'" + (current.direction === "desc" ? " selected" : "") + ">Descending</option></select></div>";
    }
    var body$ = $("<div class='a-IRR-dialogBody a-IRR-sortDialogRows'>" + rows + "</div>");
    dialog("Sort", body$, [{ text: "Apply", hot: true, click: function () {
      var sort = body$.find(".a-IRR-sortDialogRow").map(function () {
        var column = $(this).find("select").first().val();
        return column ? { column: column, direction: $(this).find(".apex-local-dir").val() } : null;
      }).get();
      cfg.act({ action: "sort", sort: sort });
    } }], "a-IRR-dialog--sort");
  }

  function downloadDialog(cfg) {
    var body$ = $("<div class='a-IRR-dialogBody'><ul class='a-IRR-iconList a-IRR-downloadFormatPills'>" + cfg.formats.map(function (format, index) {
      return "<li class='a-IRR-iconList-item'><label><input type='radio' name='apex_local_dl' value='" + format + "'" + (index === 0 ? " checked" : "") + "> <span class='a-Icon icon-irr-dl-" + (format === "csv" ? "xls" : format) + "' aria-hidden='true'></span> " + format.toUpperCase() + "</label></li>";
    }).join("") + "</ul></div>");
    dialog("Download", body$, [{ text: "Download", hot: true, click: function () {
      download(cfg.region, body$.find("input:checked").val());
    } }], "a-IRR-dialog--download");
  }

  function confirmReset(cfg) {
    apex.message.confirm("Restore report to the default settings?", function (ok) { if (ok) cfg.act({ action: "reset" }); });
  }

  // ------------------------------------------------------------- interactive report

  function irConfig(container) {
    var cfg = JSON.parse(container.getAttribute("data-apex-local-ir"));
    cfg.act = function (body) { return act(cfg.region, body); };
    return cfg;
  }

  function initIr(container) {
    if (container.apexLocalReady) return;
    container.apexLocalReady = true;
    var cfg = irConfig(container);
    var id = cfg.region;
    container.apexLocalSearchColumn = "";
    var menu$ = $(esc(id + "_actions_menu"));
    if (menu$.length) {
      var items = [];
      if (cfg.menu.columns) items.push({ type: "action", label: "Columns", icon: "icon-irr-select-cols", action: function () { columnsDialog(cfg); } });
      if (cfg.menu.filter) items.push({ type: "action", label: "Filter", icon: "icon-irr-filter", action: function () { filterDialog(cfg); } });
      if (cfg.menu.rowsPerPage) items.push({ type: "subMenu", label: "Rows Per Page", icon: "icon-irr-rows", menu: { items: [{
        type: "radioGroup", get: function () { return String(cfg.rowsPerPage); },
        set: function (value) { cfg.act({ action: "rowsPerPage", value: Number(value) }); },
        choices: cfg.rowsPerPageOptions.map(function (n) { return { label: String(n), value: String(n) }; }).concat([{ label: "All", value: "-1" }])
      }] } });
      if (cfg.menu.sort) items.push({ type: "subMenu", label: "Data", icon: "icon-irr-format", menu: { items: [
        { type: "action", label: "Sort", icon: "icon-irr-sort", action: function () { sortDialog(cfg); } }] } });
      if (cfg.menu.reset || cfg.menu.download || cfg.menu.help) items.push({ type: "separator" });
      if (cfg.menu.reset) items.push({ type: "action", label: "Reset", icon: "icon-irr-reset", action: function () { confirmReset(cfg); } });
      if (cfg.menu.help) items.push({ type: "action", label: "Help", icon: "icon-irr-help", action: function () {
        apex.message.alert("Use the search bar to find rows, click a column heading to sort or filter it, and use Actions to choose columns, filter, sort, change rows per page, reset or download the report.");
      } });
      if (cfg.menu.download) items.push({ type: "action", label: "Download", icon: "icon-irr-download", action: function () { downloadDialog(cfg); } });
      menu$.menu({ items: items });
      $(esc(id + "_actions_button")).attr("data-menu", id + "_actions_menu").addClass("js-menuButton");
    }
    var colMenu$ = $(esc(id + "_column_search_drop"));
    if (colMenu$.length) {
      colMenu$.menu({ items: [{ type: "radioGroup",
        get: function () { return container.apexLocalSearchColumn; },
        set: function (value) {
          container.apexLocalSearchColumn = value;
          var column = cfg.columns.filter(function (c) { return c.name === value; })[0];
          var label = column ? "Search: " + column.label : "Search: All Text Columns";
          $(esc(id + "_search_field")).attr({ placeholder: label, "aria-label": label }).trigger("focus");
        },
        choices: [{ label: "All Text Columns", value: "" }].concat(cfg.columns.filter(function (c) { return c.shown; }).map(function (c) {
          return { label: c.label, value: c.name };
        }))
      }] });
      $(esc(id + "_column_search_root")).attr("data-menu", id + "_column_search_drop").addClass("js-menuButton");
    }
  }

  function irOf(element) {
    var container = $(element).closest("[data-apex-local-ir]")[0];
    return container ? { container: container, cfg: irConfig(container) } : null;
  }

  function search(element) {
    var ir = irOf(element);
    if (!ir) return;
    var text = $(esc(ir.cfg.region + "_search_field")).val();
    if (!text) return;
    ir.cfg.act({ action: "search", text: text, column: ir.container.apexLocalSearchColumn || "" });
  }

  var sortWidget$ = null;
  function closeSortWidget() {
    if (sortWidget$) { sortWidget$.remove(); sortWidget$ = null; $(".a-IRR-header.is-active, .a-GV-header.is-active").removeClass("is-active"); }
  }

  /** Column heading popup (sort, hide, filter by values) shared by interactive reports and grids. */
  function openSortWidget(link, cfg, name, header$) {
    var column = cfg.columns.filter(function (c) { return c.name === name; })[0] || { name: name, label: name };
    closeSortWidget();
    header$.addClass("is-active");
    var action = function (key, label, icon, enabled) {
      return enabled ? "<li class='a-IRR-sortWidget-actions-item'><button type='button' class='a-Button a-IRR-button a-IRR-sortWidget-button' data-option='" + key + "' title='" + label + "' aria-label='" + label + "'><span class='a-Icon " + icon + "' aria-hidden='true'></span></button></li>" : "";
    };
    sortWidget$ = $("<div class='a-IRR-sortWidget apex-local-sortWidget' role='dialog' aria-label='" + html(column.label) + "'>" +
      "<ul class='a-IRR-sortWidget-actions' role='toolbar'>" +
      action("up", "Sort Ascending", "icon-irr-sort-asc", column.sort !== false) +
      action("down", "Sort Descending", "icon-irr-sort-desc", column.sort !== false) +
      action("hide", "Hide Column", "icon-irr-remove-col", column.hide !== false) + "</ul>" +
      (column.filter !== false ? "<div class='a-IRR-sortWidget-search'><label class='a-IRR-sortWidget-searchLabel' for='apex_local_sw_search'><span class='u-VisuallyHidden'>Filter</span></label>" +
      "<input type='text' class='a-IRR-sortWidget-searchField' id='apex_local_sw_search' placeholder='Filter...' autocomplete='off'>" +
      "<div class='a-IRR-sortWidget-rows' role='listbox' aria-multiselectable='true'></div>" +
      "<div class='a-IRR-sortWidget-footer'><span aria-live='polite' class='a-IRR-sortWidget-selectedCount'></span>" +
      "<button class='a-Button a-IRR-button a-IRR-sortWidget-clear' type='button'>Clear</button>" +
      "<button class='a-Button a-Button--hot a-IRR-button a-IRR-sortWidget-apply' type='button'>Apply</button></div></div>" : "") +
      "</div>").appendTo("body");
    var offset = header$.offset();
    sortWidget$.css({ top: offset.top + header$.outerHeight(), left: Math.max(4, Math.min(offset.left, $(window).width() - 290)) });
    var selected = [];
    function updateCount() {
      sortWidget$.find(".a-IRR-sortWidget-selectedCount").text(selected.length ? selected.length + " selected" : "");
    }
    if (column.filter !== false) {
      fetch(route("report-values", { region: cfg.region, column: name }), { credentials: "same-origin" })
        .then(function (response) { return response.json(); })
        .then(function (values) {
          if (!sortWidget$) return;
          sortWidget$.find(".a-IRR-sortWidget-rows").html((values || []).map(function (value) {
            return "<a href='#' class='a-IRR-sortWidget-row' role='checkbox' aria-checked='false' data-return-value='" + html(value) + "'><span aria-hidden='true' class='u-checkbox'></span><span class='a-IRR-sortWidget-rowLabel'>" + (value === "" ? "(null)" : html(value)) + "</span></a>";
          }).join(""));
        });
    }
    sortWidget$.on("click", ".a-IRR-sortWidget-button", function () {
      var option = this.getAttribute("data-option");
      closeSortWidget();
      if (option === "hide") cfg.act({ action: "hide", column: name });
      else cfg.act({ action: "sort", sort: [{ column: name, direction: option === "up" ? "asc" : "desc" }] });
    });
    sortWidget$.on("click", ".a-IRR-sortWidget-row", function (event) {
      event.preventDefault();
      var value = this.getAttribute("data-return-value");
      var index = selected.indexOf(value);
      if (index >= 0) selected.splice(index, 1); else selected.push(value);
      $(this).toggleClass("is-selected", index < 0).attr("aria-checked", index < 0 ? "true" : "false")
        .find(".u-checkbox").toggleClass("is-checked", index < 0);
      updateCount();
    });
    sortWidget$.on("click", ".a-IRR-sortWidget-clear", function () {
      selected = [];
      sortWidget$.find(".a-IRR-sortWidget-row").removeClass("is-selected").attr("aria-checked", "false").find(".u-checkbox").removeClass("is-checked");
      updateCount();
    });
    sortWidget$.on("click", ".a-IRR-sortWidget-apply", function () {
      var text = sortWidget$.find(".a-IRR-sortWidget-searchField").val();
      closeSortWidget();
      if (selected.length === 1) cfg.act({ action: "filter", column: name, operator: selected[0] === "" ? "isNull" : "=", value: selected[0] });
      else if (selected.length > 1) cfg.act({ action: "filter", column: name, operator: "in", value: selected.join(",") });
      else if (text) cfg.act({ action: "filter", column: name, operator: "contains", value: text });
    });
    sortWidget$.on("input", ".a-IRR-sortWidget-searchField", function () {
      var needle = this.value.toLowerCase();
      sortWidget$.find(".a-IRR-sortWidget-row").each(function () {
        this.hidden = needle !== "" && $(this).text().toLowerCase().indexOf(needle) < 0;
      });
    });
    sortWidget$.on("keydown", ".a-IRR-sortWidget-searchField", function (event) {
      if (event.key === "Enter") { event.preventDefault(); sortWidget$.find(".a-IRR-sortWidget-apply").trigger("click"); }
    });
    sortWidget$.on("keydown", function (event) { if (event.key === "Escape") { closeSortWidget(); link.focus(); } });
    (sortWidget$.find(".a-IRR-sortWidget-searchField")[0] || sortWidget$.find("button")[0] || link).focus();
  }

  $(document).on("mousedown", function (event) {
    if (sortWidget$ && !$(event.target).closest(".apex-local-sortWidget").length && !$(event.target).closest(".a-IRR-headerLink, .a-GV-header").length) closeSortWidget();
  });
  $(document).on("click", ".a-IRR-headerLink[data-column]", function (event) {
    event.preventDefault();
    if (sortWidget$ && $(this).closest(".a-IRR-header").hasClass("is-active")) { closeSortWidget(); return; }
    var ir = irOf(this);
    if (ir) openSortWidget(this, ir.cfg, this.getAttribute("data-column"), $(this).closest(".a-IRR-header"));
  });
  $(document).on("click", "[data-apex-local-ir] .a-IRR-button--search", function () { search(this); });
  $(document).on("keydown", "[data-apex-local-ir] .a-IRR-search-field", function (event) {
    if (event.key === "Enter") { event.preventDefault(); search(this); }
  });
  $(document).on("click", "[data-apex-local-ir-page]", function () {
    var ir = irOf(this);
    if (ir) paginate(ir.cfg.region, this.getAttribute("data-apex-local-ir-page"));
  });
  $(document).on("change", "[data-apex-local-ir-rows]", function () {
    var ir = irOf(this);
    if (ir) ir.cfg.act({ action: "rowsPerPage", value: Number(this.value) });
  });
  $(document).on("click", "[data-apex-local-ir-toggle]", function () {
    var ir = irOf(this);
    if (ir) ir.cfg.act({ action: "toggleFilter", index: Number(this.getAttribute("data-apex-local-ir-toggle")), enabled: this.checked });
  });
  $(document).on("click", "[data-apex-local-ir-remove]", function () {
    var ir = irOf(this);
    if (ir) ir.cfg.act({ action: "removeFilter", index: Number(this.getAttribute("data-apex-local-ir-remove")) });
  });
  $(document).on("click", "[data-apex-local-ir-edit]", function () {
    var ir = irOf(this);
    if (!ir) return;
    var index = Number(this.getAttribute("data-apex-local-ir-edit"));
    var filter = ir.cfg.filters && ir.cfg.filters[index];
    if (filter && filter.column) {
      var cfg = ir.cfg;
      cfg.act = function (body) { return act(cfg.region, Object.assign({ replace: index }, body)); };
      filterDialog(cfg, filter);
    }
  });

  // ------------------------------------------------------------- classic report

  $(document).on("click", "[data-apex-local-sort]", function (event) {
    event.preventDefault();
    act(this.getAttribute("data-region"), { action: "classicSort", column: this.getAttribute("data-apex-local-sort") });
  });

  // ------------------------------------------------------------- interactive grid

  var grids = {};

  function gridValue(model, record, field) {
    var value = model.getValue(record, field);
    if (value && typeof value === "object") value = value.v;
    return value === undefined || value === null ? "" : String(value);
  }

  function gridChanges(ig) {
    var model = apex.model.get(ig.cfg.modelName);
    if (!model) return [];
    var changes = [];
    model.getChanges().slice().forEach(function (meta) {
      var record = meta.record;
      var id = model.getRecordId(record);
      if (meta.inserted && meta.deleted) return;
      var values = {};
      Object.keys(ig.cfg.fields).forEach(function (field) { values[field] = gridValue(model, record, field); });
      var key = ig.cfg.identity.map(function (field) {
        var original = meta.original && meta.original[ig.cfg.fields[field].index];
        if (original && typeof original === "object") original = original.v;
        return original !== undefined && original !== null ? String(original) : values[field];
      }).join("|");
      changes.push({ op: meta.deleted ? "delete" : meta.inserted ? "insert" : "update", id: meta.inserted ? id : key, values: values });
    });
    apex.model.release(ig.cfg.modelName);
    return changes;
  }

  function showGridErrors(ig, errors) {
    var model = apex.model.get(ig.cfg.modelName);
    var messages = [];
    errors.forEach(function (error) {
      messages.push({ type: "error", location: "page", message: error.message, unsafe: false });
      if (model && error.id && error.column) {
        var record = model.getRecord(error.id);
        if (record) model.setValidity("error", error.id, error.column, error.message);
      }
    });
    if (model) apex.model.release(ig.cfg.modelName);
    apex.message.clearErrors();
    apex.message.showErrors(messages);
  }

  function saveGrid(ig) {
    var changes = gridChanges(ig);
    if (!changes.length) { apex.message.showPageSuccess("No changes to save"); return Promise.resolve(); }
    return post("ig-save", { region: ig.cfg.region, changes: changes }).then(function (result) {
      if (!result.ok) { showGridErrors(ig, result.errors || []); return; }
      apex.message.clearErrors();
      apex.message.showPageSuccess("Changes saved");
      return refreshGrid(ig.cfg.region, true);
    });
  }

  function refreshGrid(region, withDetails) {
    var ig = grids[region];
    return refresh(region).then(function () {
      if (withDetails && ig) return Promise.all(ig.cfg.details.map(function (detail) { return refresh(detail); }));
    });
  }

  function gridAct(ig, body, force) {
    var changes = force ? [] : gridChanges(ig);
    var go = function () {
      return post("report", Object.assign({ region: ig.cfg.region }, body)).then(function (result) {
        if (result && result.error) { apex.message.alert(result.error); return; }
        return refreshGrid(ig.cfg.region, true);
      });
    };
    if (changes.length) {
      apex.message.confirm("There are unsaved changes. Do you want to continue?", function (ok) { if (ok) go(); });
      return Promise.resolve();
    }
    return go();
  }

  function destroyGrid(region) {
    var ig = grids[region];
    if (!ig) return;
    try { ig.grid$.grid("destroy"); } catch (e) { /* already gone */ }
    try { apex.model.destroy(ig.cfg.modelName); } catch (e) { /* not created */ }
    $(esc(region + "_ig_row_actions_menu")).remove();
    $(esc(region + "_ig_actions_menu")).remove();
    delete grids[region];
  }

  function initGrid(root) {
    var region = root.getAttribute("data-apex-local-ig");
    if (root.apexLocalReady && grids[region]) return;
    destroyGrid(region);
    root.apexLocalReady = true;
    var cfg = JSON.parse(document.getElementById(region + "_ig_config").textContent);
    var ig = { cfg: cfg, root$: $(root) };
    grids[region] = ig;
    cfg.act = function (body) { return gridAct(ig, body); };
    if (!apex.libVersions) apex.libVersions = {};
    if (!apex.libVersions.domPurify) apex.libVersions.domPurify = "3.4.14";
    if (apex.model.get(cfg.modelName)) apex.model.destroy(cfg.modelName);
    apex.model.create(cfg.modelName, {
      shape: "table", recordIsArray: true, fields: cfg.fields, identityField: cfg.identity.length ? cfg.identity : undefined,
      hasTotalRecords: true, paginationType: "none", editable: cfg.editable, onlyMarkForDelete: true,
      check: function (result, operation) {
        if (operation === "canAdd") return result && cfg.allowed.add;
        if (operation === "canDelete") return result && cfg.allowed.delete;
        if (operation === "canEdit") return result && (cfg.allowed.update || false);
        return result;
      }
    }, cfg.data, cfg.data.length);

    // Row actions menu (genuine menu widget) for the APEX$ROW_ACTION column.
    var currentRecord = null;
    if (cfg.rowActions) {
      var rowItems = [];
      if (cfg.editable && cfg.allowed.add) {
        rowItems.push({ type: "action", label: "Add Row", icon: "icon-ig-add-row", action: function () { addRow(ig, currentRecord); } });
        rowItems.push({ type: "action", label: "Duplicate Row", icon: "icon-ig-duplicate", action: function () { duplicateRow(ig, currentRecord); } });
      }
      if (cfg.editable && cfg.allowed["delete"]) rowItems.push({ type: "action", label: "Delete Row", icon: "icon-ig-delete", action: function () {
        var model = apex.model.get(cfg.modelName); model.deleteRecords([currentRecord]); apex.model.release(cfg.modelName);
      } });
      if (cfg.editable) rowItems.push({ type: "action", label: "Revert Changes", icon: "icon-ig-revert", action: function () {
        var model = apex.model.get(cfg.modelName); model.revertRecords([currentRecord]); apex.model.release(cfg.modelName);
      } });
      if (!rowItems.length) rowItems.push({ type: "action", label: "Refresh Rows", icon: "icon-ig-refresh", action: function () { refreshGrid(region); } });
      $("<div id='" + html(region) + "_ig_row_actions_menu'></div>").appendTo("body").menu({ items: rowItems });
      cfg.columns.APEX$ROW_ACTION && (cfg.columns.APEX$ROW_ACTION.cellTemplate =
        "<button type='button' class='a-Button a-Button--noLabel a-Button--iconTextButton a-Button--actions js-menuButton' data-menu='" + html(region) + "_ig_row_actions_menu' aria-haspopup='menu' aria-expanded='false' aria-label='Row Actions' title='Row Actions'><span class='a-Icon icon-ig-actions' aria-hidden='true'></span></button>");
    }

    var grid$ = ig.grid$ = $(esc(region + "_ig_grid_vc"));
    var paged = cfg.pagination === "page";
    grid$.grid({
      modelName: cfg.modelName,
      columns: [cfg.columns],
      editable: cfg.editable,
      rowHeader: cfg.rowSelector || cfg.editable ? "plain" : "none",
      rowHeaderCheckbox: cfg.rowSelector,
      multiple: cfg.rowSelector,
      selectCells: false,
      hasSize: false,
      stickyFooter: false,
      stickyTop: false,
      reorderColumns: false,
      noDataMessage: cfg.noData,
      noDataIcon: "icon-irr-no-results",
      showNullAs: "",
      rowsPerPage: paged ? (cfg.rowsPerPage || 50) : cfg.data.length || 50,
      pagination: paged ? { scroll: false, showPageLinks: true, maxLinks: 5, showRange: true, showPageSelector: false, firstAndLastButtons: false }
        : { scroll: false, showRange: cfg.showTotal, showPageLinks: false },
      footer: true,
      activateColumnHeader: function (event, ui) {
        var name = ui.column && ui.column.property;
        if (!name || /^APEX\$/.test(name)) return;
        if (sortWidget$ && ui.header$.hasClass("is-active")) { closeSortWidget(); return; }
        openSortWidget(ui.header$[0], gridReportConfig(ig), name, ui.header$);
      },
      cancelColumnHeader: function () { closeSortWidget(); },
      sortChange: function (event, ui) {
        var direction = ui.direction;
        var name = ui.column && ui.column.property;
        if (!name) return;
        gridAct(ig, { action: "sort", sort: ui.action !== "clear" && direction ? [{ column: name, direction: direction }] : [] });
      },
      selectionChange: function () {
        if (!cfg.details.length) return;
        var records = grid$.grid("getSelectedRecords");
        if (!records.length || !cfg.identity.length) return;
        var model = apex.model.get(cfg.modelName);
        var id = cfg.identity.map(function (field) { return gridValue(model, records[0], field); }).join("|");
        apex.model.release(cfg.modelName);
        if (id === cfg.selected) return;
        cfg.selected = id;
        post("report", { region: region, action: "select", id: id }).then(function () {
          cfg.details.forEach(function (detail) { refresh(detail); });
        });
      }
    });
    if (cfg.details.length && cfg.data.length) {
      var model = apex.model.get(cfg.modelName);
      var target = null;
      model.forEach(function (record) {
        var id = cfg.identity.map(function (field) { return gridValue(model, record, field); }).join("|");
        if (!target && (!cfg.selected || id === cfg.selected)) target = record;
      });
      apex.model.release(cfg.modelName);
      if (target) grid$.grid("setSelectedRecords", [target], false, true);
    }
    grid$.on("click", ".a-Button--actions", function () {
      currentRecord = grid$.grid("getRecords", [$(this).closest("tr")])[0] || null;
    });

    buildToolbar(ig);
    buildControls(ig);
  }

  function addRow(ig, after) {
    var model = apex.model.get(ig.cfg.modelName);
    ig.grid$.grid("setEditMode", true);
    var id = model.insertNewRecord(null, after || null);
    apex.model.release(ig.cfg.modelName);
    var record = model.getRecord(id);
    if (record) ig.grid$.grid("setSelectedRecords", [record], true);
    ig.toolbar$ && ig.toolbar$.toolbar("refresh");
  }

  function duplicateRow(ig, record) {
    if (!record) return;
    var model = apex.model.get(ig.cfg.modelName);
    model.copyRecords([record], null, record);
    apex.model.release(ig.cfg.modelName);
  }

  function buildToolbar(ig) {
    var cfg = ig.cfg, region = cfg.region;
    var toolbar$ = $(esc(region + "_ig_toolbar"));
    if (!cfg.toolbar) { ig.root$.addClass("a-IG--noToolbar"); return; }
    var context = apex.actions.createContext("apexLocalGrid", ig.root$[0]);
    ig.actions = context;
    var searchColumn = "";
    var editMode = false;
    context.add([
      { name: "search", label: "Go", action: function () {
        var text = toolbar$.find("input[type=search]").val();
        if (text) gridAct(ig, { action: "search", text: text, column: searchColumn });
      } },
      { name: "change-search-column", label: "Columns to search", get: function () { return searchColumn; },
        set: function (value) {
          searchColumn = value;
          var column = cfg.searchColumns.filter(function (c) { return c.name === value; })[0];
          toolbar$.find("input[type=search]").attr("placeholder", column ? "Search: " + column.label : "Search: All Text Columns");
        },
        choices: [{ label: "All Text Columns", value: "" }].concat(cfg.searchColumns.map(function (c) { return { label: c.label, value: c.name }; })) },
      { name: "edit", label: "Edit", get: function () { return editMode; },
        set: function (value) { editMode = value; ig.grid$.grid("setEditMode", value); } },
      { name: "save", label: "Save", action: function () { ig.grid$.grid("finishEditing").then(function () { saveGrid(ig); }); } },
      { name: "selection-add-row", label: cfg.addLabel, action: function () { addRow(ig, null); } },
      { name: "reset-report", label: "Reset", icon: "icon-ig-reset", action: function () { confirmReset(cfg); } }
    ]);
    var has = function (name) { return cfg.controls.indexOf(name) >= 0; };
    var actionsItems = [
      { type: "action", label: "Columns", icon: "icon-ig-select-cols", action: function () { columnsDialog(gridReportConfig(ig)); } },
      { type: "action", label: "Filter", icon: "icon-ig-filter", action: function () { filterDialog(gridReportConfig(ig)); } },
      { type: "subMenu", label: "Data", icon: "icon-ig-data", menu: { items: [
        { type: "action", label: "Sort", icon: "icon-ig-sort", action: function () { sortDialog(gridReportConfig(ig)); } },
        { type: "action", label: "Refresh", icon: "icon-ig-refresh", action: function () { refreshGrid(region); } }] } },
      { type: "subMenu", label: "Format", icon: "icon-ig-format", menu: { items: [
        { type: "subMenu", label: "Rows Per Page", icon: "icon-ig-rows", menu: { items: [{ type: "radioGroup",
          get: function () { return String(cfg.rowsPerPage || 50); },
          set: function (value) { gridAct(ig, { action: "rowsPerPage", value: Number(value) }); },
          choices: [5, 10, 15, 20, 50, 100, 200, 500, 1000].map(function (n) { return { label: String(n), value: String(n) }; }) }] }, disabled: cfg.pagination !== "page" }] } },
      { type: "separator" },
      { type: "subMenu", label: "Report", icon: "icon-ig-report", menu: { items: [
        { type: "action", label: "Reset", icon: "icon-ig-reset", action: function () { confirmReset(cfg); } }] } },
      { type: "action", label: "Download", icon: "icon-ig-download", action: function () { downloadDialog(gridReportConfig(ig)); } }
    ];
    var data = [];
    var searchControls = [];
    if (has("searchCol")) searchControls.push({ type: "MENU", id: "column_search_menu", icon: "icon-search", iconOnly: true, label: "Columns to search",
      menu: { items: [{ type: "radioGroup", action: "change-search-column" }] } });
    if (has("searchField")) {
      searchControls.push({ type: "TEXT", id: "search_field", isSearch: true, placeholder: "Search: All Text Columns", label: "Search", enterAction: "search" });
      searchControls.push({ type: "BUTTON", action: "search", label: "Go" });
    }
    if (searchControls.length) data.push({ id: "search", align: "start", groupTogether: true, controls: searchControls });
    var startControls = [];
    if (has("actionsMenu")) startControls.push({ type: "MENU", id: "actions_button", label: "Actions", menu: { items: actionsItems } });
    if (startControls.length) data.push({ id: "actions1", align: "start", controls: startControls });
    var endControls = [];
    if (has("resetButton")) endControls.push({ type: "BUTTON", action: "reset-report", iconOnly: true });
    if (cfg.editable) {
      endControls.push({ type: "TOGGLE", action: "edit" });
      endControls.push({ type: "BUTTON", action: "save" });
      if (cfg.allowed.add) endControls.push({ type: "BUTTON", action: "selection-add-row", hot: true });
    }
    if (endControls.length) data.push({ id: "actions4", align: "end", controls: endControls });
    toolbar$.toolbar({ actionsContext: context, data: data, idPrefix: region + "_ig_toolbar" });
    ig.toolbar$ = toolbar$;
  }

  function buildControls(ig) {
    var cfg = ig.cfg;
    var controls$ = $(esc(cfg.region + "_ig_controls"));
    if (!cfg.filters.length) { controls$.empty(); return; }
    controls$.html("<ul class='a-IG-controls' role='group' aria-label='Report Settings'>" + cfg.filters.map(function (filter, index) {
      var checkbox = cfg.region + "_ig_control_" + index;
      return "<li class='a-IG-controls-item a-IG-controls-item--" + (filter.row ? "search" : "filter") + "'>" +
        "<span class='a-IG-controls-cell'><input type='checkbox' class='a-IG-controlsCheckbox' id='" + html(checkbox) + "' data-index='" + index + "'" + (filter.enabled ? " checked" : "") + " aria-label='" + html(filter.label) + "'><label class='a-IG-controlsCheckboxLabel' for='" + html(checkbox) + "'></label></span>" +
        "<span class='a-IG-controls-cell'><span class='a-IG-controlsIcon a-Icon icon-ig-" + (filter.row ? "search" : "filter") + "' aria-hidden='true'></span></span>" +
        "<span class='a-IG-controls-cell a-IG-controls-cell--label'><span class='a-IG-controlsLabel'><span>" + html(filter.label) + "</span></span></span>" +
        "<span class='a-IG-controls-cell a-IG-controls-cell--remove'><button type='button' class='a-Button a-IG-button a-IG-button--remove' data-index='" + index + "' title='Remove' aria-label='Remove'><span class='a-Icon icon-remove' aria-hidden='true'></span></button></span></li>";
    }).join("") + "</ul>");
    controls$.on("click", ".a-IG-controlsCheckbox", function () { gridAct(ig, { action: "toggleFilter", index: Number(this.getAttribute("data-index")), enabled: this.checked }); });
    controls$.on("click", ".a-IG-button--remove", function () { gridAct(ig, { action: "removeFilter", index: Number(this.getAttribute("data-index")) }); });
  }

  /** Shape the grid columns like an interactive report config so the shared dialogs work. */
  function gridReportConfig(ig) {
    var cfg = ig.cfg;
    var columns = Object.keys(cfg.columns).filter(function (name) { return !/^APEX\$/.test(name); })
      .map(function (name) { var c = cfg.columns[name]; return { name: name, label: c.label || name, shown: !c.hidden, seq: c.seq, sort: c.canSort !== false, filter: true, hide: c.canHide !== false }; })
      .filter(function (c) { return c.shown || c.hide; })
      .sort(function (a, b) { return a.seq - b.seq; });
    var sort = Object.keys(cfg.columns).filter(function (name) { return cfg.columns[name].sortDirection; })
      .sort(function (a, b) { return cfg.columns[a].sortIndex - cfg.columns[b].sortIndex; })
      .map(function (name) { return { column: name, direction: cfg.columns[name].sortDirection }; });
    return { region: cfg.region, columns: columns, sort: sort, formats: cfg.formats, act: function (body) { return gridAct(ig, body); } };
  }

  // Grid changes are staged before a page submit and applied by the
  // Interactive Grid - Automatic Row Processing (DML) process.
  $(document).on("apexbeforepagesubmit", function () {
    Object.keys(grids).forEach(function (region) {
      var changes = gridChanges(grids[region]);
      if (!changes.length) return;
      var request = new XMLHttpRequest();
      request.open("POST", route("ig-stage"), false);
      request.setRequestHeader("content-type", "application/json");
      request.send(JSON.stringify({ page: apex.env.APP_PAGE_ID, region: region, changes: changes }));
    });
  });

  $(document).on("apexbeforerefresh", function (event) {
    var root = $(event.target).find("[data-apex-local-ig]").addBack("[data-apex-local-ig]");
    root.each(function () { destroyGrid(this.getAttribute("data-apex-local-ig")); });
    closeSortWidget();
  });

  function init() {
    $("[data-apex-local-ir]").each(function () { initIr(this); });
    $("[data-apex-local-ig]").each(function () {
      try { initGrid(this); } catch (error) { apex.debug.error("[apex-local] interactive grid", error); }
    });
  }

  $(document).on("apexafterrefresh", function () { init(); });

  return { init: init, paginate: paginate, download: download, act: act, grids: grids, save: function (region) { return saveGrid(grids[region]); } };
})(apex.jQuery);
`;

// packages/core/src/preview/extensions/reports/interactive-grid.ts
var EDITORS = {
  textField: "text",
  textFieldWithAutocomplete: "text",
  numberField: "number",
  textarea: "textarea",
  selectList: "select",
  radioGroup: "select",
  popupLov: "select",
  datePicker: "date",
  datePickerJquery: "date",
  checkbox: "yesno",
  switch: "yesno",
  password: "text",
  colorPicker: "text",
  combobox: "select"
};
var DISPLAY_TYPES = /* @__PURE__ */ new Set([
  "displayOnly",
  "htmlExpression",
  "link",
  "hidden",
  "percentGraph",
  "starRating",
  "richTextEditor",
  "markdownEditor"
]);
var ROW_ID = "APEX$ROWID";
function igState(renderer, ctx, region) {
  return reportState(ctx.session, stateKey(ctx.pageId, region.id), () => {
    const saved = primarySavedReport(region);
    const rowsPerPage = num(saved?.props ?? {}, "view.rowsPerPage", 0);
    const hidden2 = (saved?.children ?? []).filter((child) => child.type === "displayColumn").filter((child) => get(child.props, "layout.show") === false).map(columnRef);
    const shown = bySequence(
      (saved?.children ?? []).filter(
        (child) => child.type === "displayColumn" && get(child.props, "layout.show") !== false
      )
    ).map(columnRef);
    return {
      filters: savedFilters(renderer, ctx, region, saved),
      sort: savedSorts(saved),
      ...rowsPerPage ? { rowsPerPage } : {},
      ...shown.length || hidden2.length ? { columns: shown } : {}
    };
  });
}
function dmlTable(region) {
  const table = str(region.props, "source.tableName");
  if (table) return table;
  const sql = str(region.props, "source.sqlQuery");
  const match = /\bfrom\s+("?[\w$#]+"?(?:\."?[\w$#]+"?)?)(\s+\w+)?\s*(where\b|order\b|$)/iu.exec(sql.trim());
  return match && !/\bjoin\b|,/iu.test(sql.slice(match.index, match.index + match[0].length)) ? match[1].replaceAll('"', "") : void 0;
}
function columnDefinitions(region, resultColumns) {
  return regionColumns(region, resultColumns).map((component) => {
    const name = component.id.toUpperCase();
    const type = str(component.props, "type", "textField");
    const special = /^APEX\$/u.test(name);
    const queryOnly = get(component.props, "source.queryOnly") === true;
    const sourceType = str(component.props, "source.type", "databaseColumn");
    const databaseColumn = special || queryOnly || sourceType !== "databaseColumn" ? void 0 : str(component.props, "source.databaseColumn", name).toUpperCase();
    const editor = EDITORS[type];
    return {
      name,
      component,
      type,
      ...databaseColumn ? { databaseColumn } : {},
      primaryKey: get(component.props, "source.primaryKey") === true,
      hidden: type === "hidden",
      ...editor && databaseColumn && get(component.props, "readOnly.type") !== "always" ? { editor } : {},
      ...ref(component.props, "masterDetail.masterColumn") ? { masterColumn: ref(component.props, "masterDetail.masterColumn").toUpperCase() } : {}
    };
  });
}
function identityOf(row, identity) {
  return identity.map((name) => row[name] === null || row[name] === void 0 ? "" : String(row[name])).join("|");
}
function gridModel(renderer, ctx, region, depth = 0) {
  const state2 = igState(renderer, ctx, region);
  const cells = new Cells(renderer, ctx, region);
  const domId = renderer.regionDomId(region);
  let sql = renderer.regionSql(ctx, region);
  const declared = region.children.filter((child) => child.type === "column");
  const hasKey = declared.some((column) => get(column.props, "source.primaryKey") === true);
  const table = dmlTable(region);
  if (sql && !hasKey && str(region.props, "source.tableName")) {
    const where2 = str(region.props, "source.whereClause") || str(region.props, "source.where");
    const orderBy2 = str(region.props, "source.orderByClause") || str(region.props, "source.orderBy");
    sql = `select rowid as "${ROW_ID}", t.* from ${table} t`;
    if (where2) sql = `select * from (${sql}) where ${where2}`;
    if (orderBy2) sql = `${sql} order by ${orderBy2}`;
  }
  const edit = get(region.props, "edit.enabled") === true;
  const operations = stringList(list(region.props, "edit.allowedOperations"));
  const ops = operations.length ? operations : ["add", "update", "delete"];
  const result = sql ? renderer.query(ctx, region, sql, rowLimit(region, 1e4)) : { columns: [], rows: [], error: "no local source" };
  const columns = columnDefinitions(
    region,
    result.columns.filter((name) => name !== ROW_ID)
  );
  const identity = hasKey ? columns.filter((column) => column.primaryKey).map((column) => column.name) : result.columns.includes(ROW_ID) ? [ROW_ID] : [];
  const byName = new Map(columns.map((column) => [column.name, column]));
  const visibleColumns = columns.filter((column) => !column.hidden && !/^APEX\$/u.test(column.name));
  let rows = applyFiltersAndSort(
    result.rows,
    cells,
    new Map(columns.map((column) => [column.name, column.component])),
    visibleColumns.map((column) => column.component),
    state2.filters,
    state2.sort
  );
  let master;
  const masterId = ref(region.props, "masterDetail.masterRegion");
  const masterRegion = masterId ? findRegion2(renderer, ctx, masterId) : void 0;
  if (masterRegion && depth < 5) {
    const masterModel = str(masterRegion.props, "type") === "interactiveGrid" ? gridModel(renderer, ctx, masterRegion, depth + 1) : void 0;
    const selected = masterModel ? masterModel.rows.find(
      (row) => identityOf(row, masterModel.identity) === masterModel.state.selected
    ) ?? masterModel.rows[0] : void 0;
    master = { region: masterRegion, ...selected ? { row: selected } : {} };
    const links = columns.filter((column) => column.masterColumn);
    rows = selected ? rows.filter(
      (row) => links.every(
        (column) => String(row[column.name] ?? "") === String(selected[column.masterColumn] ?? "")
      )
    ) : [];
  }
  return {
    region,
    domId,
    state: state2,
    cells,
    columns,
    byName,
    identity,
    ...table ? { table } : {},
    rows,
    ...result.error ? { error: result.error } : {},
    editable: edit && identity.length > 0,
    allowed: { add: ops.includes("add"), update: ops.includes("update"), delete: ops.includes("delete") },
    ...master ? { master } : {}
  };
}
function diagnoseGrid(renderer, ctx, model) {
  const { region } = model;
  const note = (message) => renderer.diagnose("info", message, ctx.pageId, region.id);
  if (get(region.props, "edit.enabled") === true && !model.identity.length)
    note(`Interactive Grid ${region.id} has no primary key or table ROWID; it is shown read-only`);
  for (const column of model.columns) {
    if (/^APEX\$/u.test(column.name) || column.editor || DISPLAY_TYPES.has(column.type)) continue;
    note(`Interactive Grid column ${region.id}.${column.name} of type ${column.type} is shown as text`);
  }
  for (const key of ["editAuthorization.add", "editAuthorization.update", "editAuthorization.delete"])
    if (get(region.props, key) !== void 0)
      note(`Interactive Grid ${region.id}: edit authorization is not checked`);
  if (str(region.props, "edit.lostUpdateType") === "rowVersionColumn")
    note(`Interactive Grid ${region.id}: lost update detection is not simulated`);
  if (get(region.props, "edit.allowedRowOperationsColumn") !== void 0)
    note(`Interactive Grid ${region.id}: allowed row operations column is not simulated`);
  const formats = stringList(list(region.props, "download.formats")).filter(
    (format2) => !/^(csv|html)$/u.test(format2)
  );
  if (formats.length)
    note(`Interactive Grid ${region.id}: download formats ${formats.join(", ")} are not simulated`);
  if (str(region.props, "heading.fixedTo") === "region")
    note(`Interactive Grid ${region.id}: fixed report height is not simulated`);
  for (const column of model.columns) {
    if (get(column.component.props, "cascadingLov.parentColumns") !== void 0)
      note(`Interactive Grid column ${region.id}.${column.name}: cascading LOV is not simulated`);
    if (get(column.component.props, "readOnly.type") !== void 0 && get(column.component.props, "readOnly.type") !== "always")
      note(`Interactive Grid column ${region.id}.${column.name}: conditional read-only is not simulated`);
  }
}
function modelValue(model, column, row, trigger) {
  const raw = row[column.name];
  const value = raw === null || raw === void 0 ? "" : String(raw);
  const props = column.component.props;
  const markup = column.type === "link" || column.type === "htmlExpression" || get(props, "link.target") !== void 0 || str(props, "columnFormatting.htmlExpression") !== "" || str(props, "settings.htmlExpression") !== "";
  if (markup) return { v: value, d: model.cells.html(column.component, row, trigger) };
  const display = model.cells.text(column.component, row);
  return display === value ? value : { v: value, d: display };
}
var alignmentName = (alignment) => alignment === "u-tR" ? "end" : alignment === "u-tC" ? "center" : "start";
function columnItem(renderer, model, column, id) {
  const props = column.component.props;
  const label = escapeHtml(model.cells.label(column.component));
  const max = num(props, "validation.maxLength", 0);
  const required2 = get(props, "validation.valueRequired") === true ? " required" : "";
  switch (column.editor) {
    case "select":
    case "yesno": {
      const lov = column.editor === "yesno" ? void 0 : model.cells.lov(column.component);
      const on = str(props, "settings.checkedValue", str(props, "settings.onValue", "Y"));
      const off = str(props, "settings.uncheckedValue", str(props, "settings.offValue", "N"));
      const entries = lov ? [...lov] : column.editor === "yesno" ? [
        [on, "Yes"],
        [off, "No"]
      ] : [];
      const nullOption = get(props, "lov.displayNullValue") === false ? "" : `<option value="${escapeHtml(str(props, "lov.nullReturnValue"))}">${escapeHtml(str(props, "lov.nullDisplayValue"))}</option>`;
      return `<select id="${id}" class="selectlist apex-item-select" aria-label="${label}"${required2}>${column.editor === "yesno" ? "" : nullOption}${entries.map(([value, display]) => `<option value="${escapeHtml(value)}">${escapeHtml(display)}</option>`).join("")}</select>`;
    }
    case "textarea":
      return `<textarea id="${id}" class="textarea apex-item-textarea" rows="2" aria-label="${label}"${max ? ` maxlength="${max}"` : ""}${required2}></textarea>`;
    case "number":
      return `<input type="text" id="${id}" class="number_field apex-item-text apex-item-number" inputmode="decimal" aria-label="${label}"${required2}>`;
    case "date":
      return `<input type="date" id="${id}" class="datepicker apex-item-text apex-item-datepicker" aria-label="${label}"${required2}>`;
    default:
      void renderer;
      return `<input type="text" id="${id}" class="text_field apex-item-text" aria-label="${label}"${max ? ` maxlength="${max}"` : ""}${required2}>`;
  }
}
function defaultValue(model, column) {
  const props = column.component.props;
  if (column.masterColumn && model.master?.row) {
    const value = model.master.row[column.masterColumn];
    return value === null || value === void 0 ? "" : String(value);
  }
  if (str(props, "default.type") === "staticValue" || get(props, "default.staticValue") !== void 0)
    return str(props, "default.staticValue");
  return void 0;
}
function interactiveGrid(renderer, ctx, region) {
  if (!renderer.regionSql(ctx, region))
    return `<div class="apex-local-unsupported">Interactive Grid \u201C${escapeHtml(str(region.props, "name", region.id))}\u201D has no local source.</div>`;
  const model = gridModel(renderer, ctx, region);
  if (model.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(model.error)}</div></div>`;
  diagnoseGrid(renderer, ctx, model);
  diagnoseSavedReport(renderer, ctx, region, primarySavedReport(region));
  const { domId, state: state2, cells } = model;
  const id = escapeHtml(domId);
  ctx.clientConfig.regions.push({ id: domId, kind: "interactiveGrid" });
  for (const file of [
    "model",
    "tooltipManager",
    "widget.toolbar",
    "widget.tableModelViewBase",
    "widget.grid"
  ])
    ctx.jsFiles.add(`#APEX_FILES#libraries/apex/#MIN_DIRECTORY#${file}#MIN#.js?v=#APEX_VERSION#`);
  const trigger = `apex.jQuery('#${domId}')`;
  const fields = [
    ...model.columns.map((column) => column.name),
    ...model.identity[0] === ROW_ID ? [ROW_ID] : []
  ];
  const data = model.rows.map(
    (row) => fields.map((name) => {
      const column = model.byName.get(name);
      if (!column) return row[name] === null || row[name] === void 0 ? "" : String(row[name]);
      if (/^APEX\$/u.test(name)) return "";
      return modelValue(model, column, row, trigger);
    })
  );
  const order = state2.columns;
  const sortIndex = new Map(state2.sort.map((entry, index) => [entry.column, { ...entry, index }]));
  const hasSelector2 = model.columns.some((column) => column.type === "rowSelector");
  const hasActions = model.columns.some((column) => column.type === "actionsMenu");
  const editable = model.editable && (model.allowed.update || model.allowed.add || model.allowed.delete);
  const items = [];
  const gridColumns = {};
  model.columns.forEach((column, index) => {
    if (column.type === "rowSelector") return;
    const props = column.component.props;
    const sort = sortIndex.get(column.name);
    const itemId = `${domId}_ig_c_${column.name.replace(/\W/gu, "_")}`;
    const canEdit = editable && model.allowed.update && column.editor !== void 0 && !column.primaryKey;
    const canInsert = editable && model.allowed.add && column.editor !== void 0;
    if (canEdit || canInsert)
      items.push(`<div class="a-GV-columnItem">${columnItem(renderer, model, column, itemId)}</div>`);
    const shownByReport = order ? order.includes(column.name) : true;
    const markup = column.type === "link" || column.type === "htmlExpression" || get(props, "link.target") !== void 0 || str(props, "columnFormatting.htmlExpression") !== "";
    if (column.type === "actionsMenu") {
      gridColumns[column.name] = {
        heading: "",
        label: "Actions",
        seq: -1,
        width: 40,
        noStretch: true,
        noHeaderActivate: true,
        canHide: false,
        canSort: false,
        virtual: true,
        noCopy: true,
        readonly: true,
        escape: false,
        alignment: "center",
        cellTemplate: `<button type="button" class="a-Button a-Button--noLabel a-Button--iconTextButton a-Button--small apex-local-ig-rowActions" aria-label="Row Actions" title="Row Actions"><span class="a-Icon icon-ig-row-actions" aria-hidden="true"></span></button>`
      };
      return;
    }
    const width = num(props, "appearance.width", 0);
    gridColumns[column.name] = {
      heading: cells.heading(column.component),
      label: cells.label(column.component),
      headingAlignment: alignmentName(
        str(props, "heading.alignment") ? /end|right/u.test(str(props, "heading.alignment")) ? "u-tR" : /center/u.test(str(props, "heading.alignment")) ? "u-tC" : "u-tL" : renderer.alignment(column.component, model.rows[0]?.[column.name])
      ),
      alignment: alignmentName(renderer.alignment(column.component, model.rows[0]?.[column.name])),
      seq: order && order.includes(column.name) ? order.indexOf(column.name) + 1 : 1e3 + index,
      hidden: column.hidden || !shownByReport || /^APEX\$/u.test(column.name),
      canHide: !column.hidden && get(props, "enableUsersTo.hide") !== false,
      canSort: !column.hidden && get(props, "enableUsersTo.sort") !== false,
      readonly: !(canEdit || canInsert),
      escape: !markup,
      isRequired: get(props, "validation.valueRequired") === true,
      ...width ? { width } : {},
      ...sort ? { sortDirection: sort.direction, sortIndex: sort.index + 1 } : {},
      ...canEdit || canInsert ? { elementId: itemId } : {},
      ...stringList(list(props, "appearance.cssClasses")).length ? { columnCssClasses: stringList(list(props, "appearance.cssClasses")).join(" ") } : {}
    };
  });
  const modelFields = {};
  fields.forEach((name, index) => {
    const column = model.byName.get(name);
    const fallback = column ? defaultValue(model, column) : void 0;
    modelFields[name] = {
      index,
      ...fallback !== void 0 ? { defaultValue: fallback } : {},
      ...column && /^APEX\$/u.test(name) ? { virtual: true } : {}
    };
  });
  const pagination2 = str(region.props, "pagination.type", "scroll");
  const details = renderer.pageComponents(ctx, "region").filter((candidate) => ref(candidate.props, "masterDetail.masterRegion") === region.id).map((candidate) => renderer.regionDomId(candidate));
  const controls = stringList(list(region.props, "toolbar.controls"));
  const config = {
    region: domId,
    modelName: `${domId}_ig_grid`,
    fields: modelFields,
    identity: model.identity,
    data,
    columns: gridColumns,
    editable,
    allowed: model.allowed,
    rowSelector: hasSelector2,
    rowActions: hasActions,
    rowsPerPage: state2.rowsPerPage && state2.rowsPerPage > 0 ? state2.rowsPerPage : pagination2 === "page" ? 50 : 0,
    pagination: pagination2,
    showTotal: get(region.props, "pagination.showTotalCount") !== false,
    toolbar: get(region.props, "toolbar.show") !== false,
    controls: controls.length ? controls : ["searchCol", "searchField", "actionsMenu", "resetButton", "saveButton", "editButton"],
    addLabel: str(region.props, "toolbar.addButtonLabel", "Add Row"),
    details,
    master: model.master ? renderer.regionDomId(model.master.region) : null,
    selected: state2.selected ?? null,
    noData: renderer.substitute(
      ctx.session,
      str(region.props, "messages.whenNoDataFound", "No data found"),
      ctx.page,
      "RAW"
    ),
    filters: state2.filters.map((filter) => {
      const column = filter.column ? model.byName.get(filter.column) : void 0;
      return {
        label: filterLabel(filter, column ? cells.label(column.component) : filter.column),
        enabled: filter.enabled,
        row: !filter.column
      };
    }),
    searchColumns: model.columns.filter((column) => !column.hidden && !/^APEX\$/u.test(column.name)).map((column) => ({ name: column.name, label: cells.label(column.component) })),
    formats: ["csv", "html"]
  };
  return `<div class="a-IG" id="${id}_ig" role="group" aria-label="${escapeHtml(str(region.props, "title", str(region.props, "name")))}" data-apex-local-ig="${id}">
<div class="a-IG-header" id="${id}_ig_toolbar"></div>
<div class="a-IG-controlsContainer" id="${id}_ig_controls"></div>
<div class="a-IG-body"><div class="a-IG-contentContainer"><div class="a-IG-gridView">
<div class="u-vh" aria-hidden="true">${items.join("")}</div>
<div id="${id}_ig_grid_vc"></div>
</div></div></div>
<script type="application/json" id="${id}_ig_config">${JSON.stringify(config).replaceAll("<", "\\u003c")}</script>
</div>`;
}
function saveGrid(renderer, ctx, region, changes) {
  const model = gridModel(renderer, ctx, region);
  const errors = [];
  if (!model.editable)
    return { ok: false, saved: 0, errors: [{ message: `Region ${region.id} is not editable.` }] };
  if (!model.table)
    return {
      ok: false,
      saved: 0,
      errors: [
        {
          message: `Interactive Grid ${region.id}: set source.tableName so the local preview knows which table to change.`
        }
      ]
    };
  const table = model.table.toUpperCase();
  const tableColumns = new Set(renderer.db.tableColumns(table).map((column) => column.name.toUpperCase()));
  const label = (column) => model.cells.label(column.component);
  for (const change of changes) {
    const allowed = change.op === "insert" ? model.allowed.add : change.op === "update" ? model.allowed.update : model.allowed.delete;
    if (!allowed)
      errors.push({
        ...change.id ? { id: change.id } : {},
        message: `${change.op} is not allowed in ${region.id}.`
      });
    if (change.op === "delete") continue;
    for (const column of model.columns) {
      if (!column.databaseColumn || column.primaryKey) continue;
      const value2 = change.values[column.name];
      const props = column.component.props;
      const text5 = value2 === null || value2 === void 0 ? "" : String(value2);
      const location = { ...change.id ? { id: change.id } : {}, column: column.name };
      if (get(props, "validation.valueRequired") === true && text5 === "")
        errors.push({ ...location, message: `${label(column)} must have some value.` });
      const max = num(props, "validation.maxLength", 0);
      if (max && text5.length > max)
        errors.push({ ...location, message: `${label(column)} must have at most ${max} characters.` });
      if (column.type === "numberField" && text5 !== "" && !Number.isFinite(Number(text5.replaceAll(",", ""))))
        errors.push({ ...location, message: `${label(column)} must be Numeric.` });
    }
  }
  if (errors.length) return { ok: false, saved: 0, errors };
  const keyColumns = model.identity.map(
    (name) => name === ROW_ID ? "rowid" : `"${(model.byName.get(name)?.databaseColumn ?? name).toUpperCase()}"`
  );
  const keyBinds = (change) => {
    const parts = (change.id ?? "").split("|");
    return Object.fromEntries(
      model.identity.map((name, index) => [
        `K${index}`,
        name === ROW_ID ? parts[index] ?? "" : String(change.values[name] ?? parts[index] ?? "")
      ])
    );
  };
  const where2 = keyColumns.map((column, index) => `${column} = :K${index}`).join(" and ");
  const bindName = (column) => `C_${column.name.replace(/\W/gu, "_")}`;
  const value = (column, raw) => {
    const text5 = raw === null || raw === void 0 ? "" : String(raw);
    if (text5 === "") return null;
    if (column.type === "numberField") return text5.replaceAll(",", "");
    return text5;
  };
  let saved = 0;
  renderer.db.execute("savepoint apex_local_ig");
  try {
    for (const change of changes) {
      if (change.op === "delete") {
        saved += renderer.db.execute(`delete from "${table}" where ${where2}`, keyBinds(change)).changes;
        continue;
      }
      const writable = model.columns.filter(
        (column) => column.databaseColumn && tableColumns.has(column.databaseColumn) && column.name in change.values && (change.op === "insert" || !column.primaryKey)
      );
      if (change.op === "insert") {
        const insert = writable.filter((column) => {
          const raw = change.values[column.name];
          return !(column.primaryKey && (raw === "" || raw === null || /^t\d+$/u.test(String(raw ?? ""))));
        });
        const binds = Object.fromEntries(
          insert.map((column) => [bindName(column), value(column, change.values[column.name])])
        );
        saved += renderer.db.execute(
          insert.length ? `insert into "${table}" (${insert.map((column) => `"${column.databaseColumn}"`).join(", ")}) values (${insert.map((column) => `:${bindName(column)}`).join(", ")})` : `insert into "${table}" default values`,
          binds
        ).changes;
        continue;
      }
      if (!writable.length) continue;
      saved += renderer.db.execute(
        `update "${table}" set ${writable.map((column) => `"${column.databaseColumn}" = :${bindName(column)}`).join(", ")} where ${where2}`,
        {
          ...Object.fromEntries(
            writable.map((column) => [bindName(column), value(column, change.values[column.name])])
          ),
          ...keyBinds(change)
        }
      ).changes;
    }
    renderer.db.execute("release savepoint apex_local_ig");
  } catch (error) {
    renderer.db.execute("rollback to savepoint apex_local_ig");
    renderer.db.execute("release savepoint apex_local_ig");
    renderer.diagnose(
      "error",
      `Interactive Grid save failed in ${region.id}: ${error.message}`,
      ctx.pageId,
      region.id
    );
    return { ok: false, saved: 0, errors: [{ message: error.message }] };
  }
  return { ok: true, saved, errors: [] };
}
function pageErrors(region, result) {
  return result.errors.map((error) => ({
    type: "error",
    location: ["page"],
    message: `${str(region.props, "name", region.id)}: ${error.message}`,
    unsafe: false
  }));
}
function gridExport(model) {
  const order = model.state.columns;
  const columns = model.columns.filter((column) => !column.hidden && !/^APEX\$/u.test(column.name)).filter((column) => get(column.component.props, "exportPrinting.includeInExportPrint") !== false).filter((column) => !order || order.includes(column.name)).sort((a, b) => order ? order.indexOf(a.name) - order.indexOf(b.name) : 0);
  return {
    headings: columns.map((column) => model.cells.label(column.component)),
    rows: model.rows.map((row) => columns.map((column) => model.cells.text(column.component, row)))
  };
}

// packages/core/src/preview/extensions/reports/interactive-report.ts
var ROWS_PER_PAGE = [1, 5, 10, 15, 20, 25, 50, 100, 200, 500, 1e3];
function irState(renderer, ctx, region) {
  return reportState(ctx.session, stateKey(ctx.pageId, region.id), () => {
    const saved = primarySavedReport(region);
    const rowsPerPage = num(saved?.props ?? {}, "view.rowsPerPage", 0);
    return {
      filters: savedFilters(renderer, ctx, region, saved),
      sort: savedSorts(saved),
      ...rowsPerPage ? { rowsPerPage } : {}
    };
  });
}
function irModel(renderer, ctx, region) {
  const state2 = irState(renderer, ctx, region);
  const cells = new Cells(renderer, ctx, region);
  const sql = renderer.regionSql(ctx, region);
  const limit = rowLimit(region, 1e5);
  const result = sql ? renderer.query(ctx, region, sql, limit + 1) : { columns: [], rows: [], error: "no local source" };
  const all = regionColumns(region, result.columns);
  const available = all.filter(
    (column) => str(column.props, "type") !== "hidden" && !isSpecialColumn(column.id)
  );
  const byName = new Map(available.map((column) => [column.id.toUpperCase(), column]));
  let order = state2.columns;
  if (!order) {
    const saved = primarySavedReport(region);
    const display = bySequence(saved?.children.filter((child) => child.type === "displayColumn") ?? []);
    order = display.length ? display.map(columnRef) : available.map((column) => column.id.toUpperCase());
  }
  const displayed = order.map((name) => byName.get(name)).filter((column) => column !== void 0);
  const rows = applyFiltersAndSort(
    result.rows.slice(0, limit),
    cells,
    byName,
    displayed,
    state2.filters,
    state2.sort
  );
  return {
    state: state2,
    cells,
    available,
    displayed,
    byName,
    rows,
    ...result.error ? { error: result.error } : {},
    moreData: result.rows.length > limit,
    limit
  };
}
function actionsMenu(region) {
  const flag2 = (name) => get(region.props, `actionsMenu.${name}`) !== false;
  const include = get(region.props, "searchBar.includeSearchBar") !== false && get(region.props, "actionsMenu.includeActionsMenu") !== false;
  return {
    include,
    columns: include && flag2("selectColumns"),
    filter: include && flag2("filter"),
    rowsPerPage: include && flag2("rowsPerPage"),
    sort: include && flag2("sort"),
    reset: include && flag2("reset"),
    download: include && flag2("download"),
    help: include && flag2("help")
  };
}
function diagnoseIr(renderer, ctx, region) {
  const note = (message) => renderer.diagnose("info", message, ctx.pageId, region.id);
  const menu = actionsMenu(region);
  if (menu.include) {
    const missing = [
      "controlBreak",
      "highlight",
      "compute",
      "aggregate",
      "chart",
      "groupBy",
      "pivot",
      "flashback",
      "saveReport",
      "subscription"
    ].filter((name) => get(region.props, `actionsMenu.${name}`) !== false);
    if (missing.length)
      note(`Interactive report ${region.id}: Actions menu ${missing.join(", ")} are not simulated`);
  }
  if (get(region.props, "searchBar.reportsSelectList") === true)
    note(`Interactive report ${region.id}: only the primary saved report is available`);
  if (str(region.props, "heading.fixedTo") && str(region.props, "heading.fixedTo") !== "none")
    note(`Interactive report ${region.id}: fixed headers are not simulated`);
  const link = str(region.props, "link.linkColumn", "linkToSingleRowView");
  if (link === "linkToSingleRowView")
    note(`Interactive report ${region.id}: single row view link column is not simulated`);
  const formats = stringList(list(region.props, "download.formats")).filter(
    (format2) => !/^(csv|html)$/u.test(format2)
  );
  if (formats.length)
    note(`Interactive report ${region.id}: download formats ${formats.join(", ")} are not simulated`);
  for (const column of region.children.filter((child) => child.type === "column")) {
    const type = str(column.props, "type", "plainText");
    if (!/^(plainText|plainTextBasedOnLov|link|hidden|htmlExpression|percentGraph|richText)$/u.test(type))
      note(`Interactive report column ${region.id}.${column.id} of type ${type} is shown as text`);
  }
}
var icon2 = (name) => `<span class="a-Icon ${name}" aria-hidden="true"></span>`;
function interactiveReport(renderer, ctx, region, slots) {
  if (!renderer.regionSql(ctx, region))
    return `<div class="apex-local-unsupported">Report \u201C${escapeHtml(str(region.props, "name", region.id))}\u201D has no local source.</div>`;
  const model = irModel(renderer, ctx, region);
  if (model.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(model.error)}</div></div>`;
  diagnoseIr(renderer, ctx, region);
  diagnoseSavedReport(renderer, ctx, region, primarySavedReport(region));
  const domId = renderer.regionDomId(region);
  const id = escapeHtml(domId);
  ctx.clientConfig.regions.push({ id: domId, kind: "interactiveReport" });
  const { state: state2, cells, displayed, rows } = model;
  const menu = actionsMenu(region);
  const perPage = state2.rowsPerPage && state2.rowsPerPage > 0 ? state2.rowsPerPage : 50;
  const all = state2.rowsPerPage === -1;
  const key = stateKey(ctx.pageId, region.id);
  const pages2 = all ? 1 : Math.max(1, Math.ceil(rows.length / perPage));
  const page = Math.min(pages2, Math.max(1, ctx.session.pagination[key] ?? 1));
  const size = all ? rows.length || 1 : perPage;
  const visible = rows.slice((page - 1) * size, page * size);
  const searchBar = get(region.props, "searchBar.includeSearchBar") !== false;
  const searchField = searchBar && get(region.props, "searchBar.searchField") !== false;
  const finder = searchField && get(region.props, "searchBar.finderDropDown") !== false;
  const rowsSelector = searchBar && bool(region.props, "searchBar.rowsPerPageSelector", false);
  const goLabel = str(region.props, "searchBar.searchButtonLabel", "Go");
  const right = slots.RIGHT_OF_INTERACTIVE_REPORT_SEARCH_BAR ?? slots.RIGHTOFINTERACTIVEREPORTSEARCHBAR ?? "";
  delete slots.RIGHT_OF_INTERACTIVE_REPORT_SEARCH_BAR;
  delete slots.RIGHTOFINTERACTIVEREPORTSEARCHBAR;
  const config = {
    region: domId,
    columns: model.available.map((column) => ({
      name: column.id.toUpperCase(),
      label: cells.label(column),
      shown: displayed.includes(column),
      sort: get(column.props, "enableUsersTo.sort") !== false,
      filter: get(column.props, "enableUsersTo.filter") !== false && get(column.props, "columnFilter.type") !== "none",
      hide: get(column.props, "enableUsersTo.hide") !== false
    })),
    sort: state2.sort,
    filters: state2.filters,
    menu,
    rowsPerPage: all ? -1 : perPage,
    rowsPerPageOptions: ROWS_PER_PAGE.filter(
      (value) => value <= num(region.props, "componentAdvanced.maxRowsPerPageInSelector", 1e3)
    ),
    formats: stringList(list(region.props, "download.formats")).filter(
      (format2) => /^(csv|html)$/u.test(format2)
    )
  };
  if (!config.formats.length) config.formats = ["csv", "html"];
  const toolbar = searchBar ? `<div class="a-IRR-toolbar" id="${id}_toolbar">
${searchField ? `<div class="a-IRR-controlGroup a-IRR-controlGroup--search"><div class="a-IRR-search" role="search">${finder ? `<button class="a-Button a-IRR-button a-IRR-button--colSearch" type="button" id="${id}_column_search_root" aria-haspopup="menu" aria-label="Select columns to search" title="Select columns to search">${icon2("icon-search")}${icon2("icon-menu-drop-down")}</button><div id="${id}_column_search_drop" class="a-Menu" style="display:none"></div>` : ""}<div class="a-IRR-searchFieldContainer"><input class="a-IRR-search-field" type="search" id="${id}_search_field" placeholder="Search: All Text Columns" aria-label="Search: All Text Columns" autocomplete="off"></div><div class="a-IRR-searchButtonContainer"><button class="a-Button a-IRR-button a-IRR-button--search" type="button" id="${id}_search_button">${escapeHtml(goLabel)}</button></div></div></div>` : ""}${rowsSelector ? `<div class="a-IRR-controlGroup a-IRR-controlGroup--rowSelector"><label for="${id}_row_select" class="u-VisuallyHidden">Rows</label><select class="a-IRR-selectList" id="${id}_row_select" data-apex-local-ir-rows="${id}">${[
    ...config.rowsPerPageOptions,
    -1
  ].map(
    (value) => `<option value="${value}"${value === config.rowsPerPage ? " selected" : ""}>${value === -1 ? "All" : value}</option>`
  ).join("")}</select></div>` : ""}${menu.include ? `<div class="a-IRR-controlGroup a-IRR-controlGroup--options"><div class="a-IRR-actions"><button class="a-Button a-IRR-button a-IRR-button--actions" type="button" id="${id}_actions_button" aria-haspopup="menu" aria-expanded="false"><span class="a-IRR-actionsLabel">Actions</span>${icon2("icon-down-chevron")}</button><div id="${id}_actions_menu"></div></div></div>` : ""}${right ? `<div class="a-IRR-buttons">${right}</div>` : ""}
</div>` : "";
  const chips = state2.filters.length ? `<div class="a-IRR-controlsContainer" id="${id}_control_panel"><ul class="a-IRR-controls a-Chips" role="group" aria-label="Report Settings">${state2.filters.map((filter, index) => {
    const column = filter.column ? model.byName.get(filter.column) : void 0;
    const label = filterLabel(filter, column ? cells.label(column) : filter.column);
    return `<li class="a-IRR-controls-item a-IRR-controls-item--${filter.column ? "filter" : "search"} a-Chip a-Chip--applied"><div class="a-IRR-controls-cell"><input type="checkbox" class="a-IRR-controlsCheckbox" id="${id}_control_${index}" data-apex-local-ir-toggle="${index}"${filter.enabled ? " checked" : ""} aria-label="${escapeHtml(label)}"><label class="a-IRR-controlsCheckboxLabel" for="${id}_control_${index}"></label></div><div class="a-IRR-controls-cell a-Chip-label">${icon2(filter.column ? "icon-irr-filter" : "icon-irr-search")}</div><div class="a-IRR-controls-cell a-IRR-controls-cell--label a-Chip-text"><button type="button" class="a-IRR-controlsLabel" data-apex-local-ir-edit="${index}"><span class="a-Chip-value">${escapeHtml(label)}</span></button></div><div class="a-IRR-controls-cell a-IRR-controls-cell--remove"><button type="button" class="a-Button a-IRR-button a-IRR-button--remove a-Chip-remove" data-apex-local-ir-remove="${index}" title="Remove Filter" aria-label="Remove Filter">${icon2("icon-remove")}</button></div></li>`;
  }).join("")}</ul></div>` : "";
  const link = str(region.props, "link.linkColumn") === "customTarget";
  const linkIcon = renderer.substitute(
    ctx.session,
    str(region.props, "link.linkIcon", '<span class="fa fa-edit" aria-hidden="true"></span>'),
    ctx.page,
    "RAW"
  );
  const sorted2 = new Map(state2.sort.map((entry, index) => [entry.column, { ...entry, index }]));
  const headerId = (column) => `${id}_${escapeHtml(column.id.toUpperCase())}`;
  const header = `<tr>${link ? `<th class="a-IRR-header a-IRR-header--linkCol" id="${id}_LINK"><span class="u-VisuallyHidden">Link</span></th>` : ""}${displayed.map((column) => {
    const name = column.id.toUpperCase();
    const sort = sorted2.get(name);
    const alignment = headingAlignment(renderer, column, visible[0]?.[name]);
    return `<th class="a-IRR-header ${alignment}" id="${headerId(column)}"${sort?.index === 0 ? ` aria-sort="${sort.direction === "asc" ? "ascending" : "descending"}"` : ""}><a class="a-IRR-headerLink" href="#" data-column="${escapeHtml(name)}" data-region="${id}" role="button" aria-haspopup="dialog">${cells.heading(column)}${sort ? `<span class="a-IRR-headerSort a-Icon icon-irr-sort-${sort.direction}" aria-hidden="true"></span>` : ""}</a></th>`;
  }).join("")}</tr>`;
  const trigger = `apex.jQuery('#${domId}')`;
  const body3 = visible.map(
    (row) => `<tr>${link ? `<td class="a-IRR-linkCol u-tC"><a href="${escapeHtml(renderer.link(ctx, get(region.props, "link.target"), row, trigger))}">${linkIcon}</a></td>` : ""}${displayed.map((column) => {
      const name = column.id.toUpperCase();
      const classes2 = [
        renderer.alignment(column, row[name]),
        ...stringList(list(column.props, "appearance.cssClasses"))
      ].filter(Boolean).join(" ");
      return `<td class="${escapeHtml(classes2)}" headers="${headerId(column)}">${cells.html(column, row, trigger)}</td>`;
    }).join("")}</tr>`
  ).join("\n");
  const noData = renderer.substitute(
    ctx.session,
    str(region.props, "messages.whenNoDataFound", "No data found."),
    ctx.page,
    "HTML"
  );
  const first = (page - 1) * size + 1;
  const last = first + visible.length - 1;
  const ofTotal = str(region.props, "pagination.type", "rowRangesXToYOfZ") === "rowRangesXToY" ? "" : ` of ${rows.length}`;
  const pageButton = (target2, label, iconName) => `<li class="a-IRR-pagination-item"><button class="a-Button a-IRR-button a-IRR-button--pagination" type="button" data-apex-local-ir-page="${target2}" title="${label}" aria-label="${label}">${icon2(iconName)}</button></li>`;
  const pagination2 = visible.length ? `<div class="a-IRR-paginationWrap a-IRR-paginationWrap--bottom"><ul class="a-IRR-pagination" role="group" aria-label="Pagination">${page > 1 ? pageButton(page - 1, "Previous", "icon-left-chevron") : ""}<li class="a-IRR-pagination-item"><span class="a-IRR-pagination-label">${first} - ${last}${ofTotal}</span></li>${last < rows.length ? pageButton(page + 1, "Next", "icon-right-chevron") : ""}</ul></div>` : "";
  const more = model.moreData ? `<div class="a-IRR-message apex-local-moreData">${escapeHtml(
    str(
      region.props,
      "messages.whenMoreDataFound",
      "The maximum row count for this report is #MAX_ROW_COUNT# rows. Please apply a filter to reduce the number of records in your query."
    ).replaceAll("#MAX_ROW_COUNT#", String(model.limit))
  )}</div>` : "";
  return `<div class="a-IRR-container" id="${id}_ir" data-apex-local-ir="${escapeHtml(JSON.stringify(config))}"><div class="a-IRR" id="${id}_worksheet_id" role="group" aria-label="${escapeHtml(str(region.props, "title", str(region.props, "name")))}">
${toolbar}
${chips}${more}
<div class="a-IRR-content" id="${id}_content"><div class="a-IRR-reportView"><div class="a-IRR-tableContainer">${visible.length ? `<table class="a-IRR-table" id="${id}_table" aria-label="${escapeHtml(str(region.props, "title", str(region.props, "name")))}">${header}${body3}</table>` : `<div class="a-IRR-noDataMsg"><span class="a-IRR-noDataMsg-icon a-Icon icon-irr-no-results" aria-hidden="true"></span><span class="a-IRR-noDataMsg-text">${noData}</span></div>`}</div>
${pagination2}</div></div></div></div>`;
}
function irDistinct(model, column) {
  const definition = model.byName.get(column);
  if (!definition) return [];
  const values = /* @__PURE__ */ new Set();
  for (const row of model.rows) {
    values.add(model.cells.text(definition, row));
    if (values.size >= 500) break;
  }
  return [...values].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

// packages/core/src/preview/extensions/reports.ts
var json2 = (body3, status = 200) => ({
  status,
  type: "json",
  body: JSON.stringify(body3)
});
function target(renderer, session, page, regionId) {
  if (!page || !regionId) return "page and region are required";
  let ctx;
  try {
    ctx = renderer.prepare(session, page);
  } catch (error) {
    return error.message;
  }
  const region = findRegion2(renderer, ctx, regionId);
  if (!region) return `Region ${regionId} not found`;
  const type = str(region.props, "type");
  const state2 = type === "interactiveGrid" ? igState(renderer, ctx, region) : type === "interactiveReport" ? irState(renderer, ctx, region) : classicState(ctx, region);
  return { ctx, region, type, state: state2, key: stateKey(ctx.pageId, region.id) };
}
function body(request) {
  try {
    const parsed2 = JSON.parse(request.body || "{}");
    return parsed2 && typeof parsed2 === "object" ? parsed2 : {};
  } catch {
    return {};
  }
}
var text3 = (value) => value === void 0 || value === null ? "" : String(value);
function displayedColumns(renderer, found) {
  if (found.type === "interactiveReport")
    return irModel(renderer, found.ctx, found.region).displayed.map((column) => column.id.toUpperCase());
  const model = gridModel(renderer, found.ctx, found.region);
  const visible = model.columns.filter((column) => !column.hidden && !/^APEX\$/u.test(column.name)).map((column) => column.name);
  return found.state.columns?.filter((name) => visible.includes(name) || /^APEX\$/u.test(name)) ?? visible;
}
function reportRoute(renderer, session, request) {
  const input = body(request);
  const found = target(renderer, session, text3(input.page), text3(input.region));
  if (typeof found === "string") return json2({ error: found }, 404);
  const { state: state2 } = found;
  const column = text3(input.column).toUpperCase();
  switch (text3(input.action)) {
    case "search": {
      const value = text3(input.text).trim();
      if (value) state2.filters.push({ column, operator: "contains", value, enabled: true });
      break;
    }
    case "filter": {
      const operator = normalizeOperator(text3(input.operator) || "=");
      if (!column || !SUPPORTED_OPERATORS.has(operator))
        return json2({ error: `Unsupported filter ${operator}` });
      const filter = {
        column,
        operator,
        value: text3(input.value),
        ...operator === "between" ? { value2: text3(input.value2) } : {},
        enabled: true
      };
      const replace = Number(input.replace);
      if (Number.isInteger(replace) && state2.filters[replace]) state2.filters[replace] = filter;
      else state2.filters.push(filter);
      break;
    }
    case "toggleFilter": {
      const filter = state2.filters[Number(input.index)];
      if (filter) filter.enabled = input.enabled === true;
      break;
    }
    case "removeFilter":
      state2.filters.splice(Number(input.index), 1);
      break;
    case "sort": {
      const sort = Array.isArray(input.sort) ? input.sort : [];
      state2.sort = sort.filter((entry) => entry && entry.column).map((entry) => ({
        column: text3(entry.column).toUpperCase(),
        direction: entry.direction === "desc" ? "desc" : "asc"
      }));
      break;
    }
    case "classicSort": {
      const current = state2.sort[0];
      state2.sort = [
        { column, direction: current?.column === column && current.direction === "asc" ? "desc" : "asc" }
      ];
      break;
    }
    case "hide":
      state2.columns = displayedColumns(renderer, found).filter((name) => name !== column);
      break;
    case "columns":
      state2.columns = (Array.isArray(input.columns) ? input.columns : []).map(
        (name) => text3(name).toUpperCase()
      );
      break;
    case "rowsPerPage": {
      const value = Number(input.value);
      if (value === -1 || Number.isInteger(value) && value > 0) state2.rowsPerPage = value;
      break;
    }
    case "select":
      state2.selected = text3(input.id);
      return json2({ ok: true });
    case "reset":
      resetState(session, found.key);
      break;
    default:
      return json2({ error: `Unknown report action ${text3(input.action)}` }, 400);
  }
  session.pagination[found.key] = 1;
  return json2({ ok: true });
}
function valuesRoute(renderer, session, request) {
  const found = target(
    renderer,
    session,
    request.params.get("page") ?? "",
    request.params.get("region") ?? ""
  );
  if (typeof found === "string") return json2({ error: found }, 404);
  const name = (request.params.get("column") ?? "").toUpperCase();
  if (found.type === "interactiveReport")
    return json2(irDistinct(irModel(renderer, found.ctx, found.region), name));
  if (found.type !== "interactiveGrid") return json2([]);
  const model = gridModel(renderer, found.ctx, found.region);
  const column = model.byName.get(name);
  const values = /* @__PURE__ */ new Set();
  for (const row of column ? model.rows : []) {
    values.add(model.cells.text(column.component, row));
    if (values.size >= 500) break;
  }
  return json2([...values].sort((a, b) => a.localeCompare(b, "en", { numeric: true })));
}
function downloadRoute(renderer, session, request) {
  const found = target(
    renderer,
    session,
    request.params.get("page") ?? "",
    request.params.get("region") ?? ""
  );
  if (typeof found === "string") return json2({ error: found }, 404);
  const { region, ctx } = found;
  const format2 = request.params.get("format") === "html" ? "html" : "csv";
  let headings;
  let rows;
  if (found.type === "interactiveGrid") {
    ({ headings, rows } = gridExport(gridModel(renderer, ctx, region)));
  } else {
    const model = irModel(renderer, ctx, region);
    const columns = (found.type === "interactiveReport" ? model.displayed : model.available).filter(
      (column) => str(column.props, "exportPrinting.includeInExportPrint") !== "false"
    );
    headings = columns.map((column) => model.cells.label(column));
    rows = model.rows.map((row) => columns.map((column) => model.cells.text(column, row)));
  }
  const filename = (str(region.props, "download.filename") || str(region.props, "name", region.id)).replace(
    /[^\w .-]+/gu,
    "_"
  );
  const content = format2 === "csv" ? toCsv(
    headings,
    rows,
    str(region.props, "download.csvSeparator") || ",",
    str(region.props, "download.csvEnclosedBy", '"')
  ) : `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(filename)}</title></head><body><table border="1"><tr>${headings.map((heading2) => `<th>${escapeHtml(heading2)}</th>`).join("")}</tr>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
  return json2({ filename: `${filename}.${format2}`, content });
}
function changesOf(input) {
  if (!Array.isArray(input.changes)) return [];
  return input.changes.filter((change) => change && /^(insert|update|delete)$/u.test(text3(change.op))).map((change) => ({
    op: text3(change.op),
    ...change.id !== void 0 ? { id: text3(change.id) } : {},
    values: Object.fromEntries(
      Object.entries(change.values ?? {}).map(([name, value]) => [
        name.toUpperCase(),
        value === null || value === void 0 ? null : String(value)
      ])
    )
  }));
}
function rowProcess(renderer, ctx, region) {
  return renderer.pageComponents(ctx, "process").find(
    (process2) => str(process2.props, "type") === "interactiveGridAutoRowProcessing" && ref(process2.props, "editableRegion") === region.id
  );
}
function saveRoute(renderer, session, request) {
  const input = body(request);
  const found = target(renderer, session, text3(input.page), text3(input.region));
  if (typeof found === "string") return json2({ ok: false, errors: [{ message: found }] }, 404);
  if (!rowProcess(renderer, found.ctx, found.region)) {
    renderer.diagnose(
      "warning",
      `Interactive Grid ${found.region.id} has no Interactive Grid - Automatic Row Processing (DML) process; changes are not saved`,
      found.ctx.pageId,
      found.region.id
    );
    return json2({
      ok: false,
      saved: 0,
      errors: [
        {
          message: `No Interactive Grid - Automatic Row Processing (DML) process exists for ${str(found.region.props, "name", found.region.id)}.`
        }
      ]
    });
  }
  return json2(saveGrid(renderer, found.ctx, found.region, changesOf(input)));
}
function stageRoute(renderer, session, request) {
  const input = body(request);
  const found = target(renderer, session, text3(input.page), text3(input.region));
  if (typeof found === "string") return json2({ error: found }, 404);
  found.state.pending = { changes: changesOf(input) };
  return json2({ ok: true, staged: found.state.pending.changes.length });
}
registerExtension({
  name: "reports",
  regions: {
    classicReport: (renderer, ctx, region) => classicReport(renderer, ctx, region),
    interactiveReport: (renderer, ctx, region, slots) => interactiveReport(renderer, ctx, region, slots),
    interactiveGrid: (renderer, ctx, region) => interactiveGrid(renderer, ctx, region)
  },
  processes: {
    // Applies grid changes staged by the browser before the page was submitted.
    interactiveGridAutoRowProcessing: (renderer, ctx, process2, point) => {
      if (point !== "submit") return { ran: false };
      const regionId = ref(process2.props, "editableRegion");
      const region = regionId ? findRegion2(renderer, ctx, regionId) : void 0;
      if (!region) {
        renderer.diagnose(
          "warning",
          `Process ${process2.id}: editable region not found`,
          ctx.pageId,
          process2.id
        );
        return { ran: false };
      }
      const state2 = peekState(ctx.session, stateKey(ctx.pageId, region.id));
      const pending = state2?.pending;
      if (!state2 || !pending?.changes.length) return { ran: true };
      state2.pending = void 0;
      const result = saveGrid(renderer, ctx, region, pending.changes);
      return result.ok ? { ran: true } : { ran: false, errors: pageErrors(region, result) };
    }
  },
  routes: {
    report: reportRoute,
    "report-values": valuesRoute,
    "report-download": downloadRoute,
    "ig-save": saveRoute,
    "ig-stage": stageRoute
  },
  client: `apex.lang.addMessages(${JSON.stringify(REPORT_MESSAGES)});
${REPORTS_CLIENT}
apex.jQuery(function () { apexLocalReports.init(); });`,
  css: REPORTS_CSS
});

// packages/core/src/preview/extensions/server/apex-api.ts
var active;
var lastRenderer;
function withRuntime(rt, run2) {
  const previous = active;
  active = rt;
  lastRenderer = rt.renderer;
  try {
    return run2();
  } finally {
    active = previous;
  }
}
var rememberRenderer = (renderer) => {
  lastRenderer = renderer;
};
var text4 = (value) => value === null || value === void 0 || value === "" ? null : String(value);
var sessionState = (rt) => rt?.ctx.session.items;
var MESSAGE_FALLBACKS = {
  "APEX.FEATURE.ACL.INFO.ALL_USERS": "All authenticated users can access this application; users in the access control list get their assigned roles.",
  "APEX.FEATURE.ACL.INFO.ACL_ONLY": "Only users defined in the access control list can access this application.",
  "APEX.FEATURE.ACL.INFO.ACL_VALUE_INVALID": "Invalid access control scope value: %0",
  "APEX.FEATURE.CONFIG.IS_ENABLED": "%0 is enabled",
  "APEX.FEATURE.CONFIG.IS_DISABLED": "%0 is disabled"
};
function format(template, values) {
  return template.replace(/%(\d)/gu, (whole, index) => {
    const value = values[Number(index)];
    return value === void 0 ? whole : String(value ?? "");
  });
}
function since2(value) {
  if (value === null || value === void 0) return null;
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1e3);
  const units = [
    [31536e3, "year"],
    [2592e3, "month"],
    [604800, "week"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"]
  ];
  const absolute = Math.abs(seconds);
  for (const [size, unit] of units) {
    if (absolute >= size) {
      const count = Math.floor(absolute / size);
      return `${count} ${unit}${count === 1 ? "" : "s"} ${seconds >= 0 ? "ago" : "from now"}`;
    }
  }
  return "Now";
}
function split(value, separator2) {
  const source = text4(value);
  if (source === null) return [];
  const sep = separator2 === null || separator2 === void 0 ? "\n" : String(separator2);
  return sep === "" ? [...source] : source.split(sep);
}
function pageUrl(rt, args) {
  const renderer = rt?.renderer ?? lastRenderer;
  const pageKey = text4(args.p_page) ?? rt?.ctx.pageId ?? "";
  const page = renderer?.findPage(pageKey);
  const base = renderer ? page ? renderer.pagePath(page) : `${renderer.baseUrl}/${pageKey}` : `f?p=${pageKey}`;
  const params = new URLSearchParams();
  const names = split(args.p_items, ",");
  const values = split(args.p_values, ",");
  names.forEach((name, index) => params.set(name.trim().toLowerCase(), values[index] ?? ""));
  if (text4(args.p_clear_cache)) params.set("clear", String(args.p_clear_cache));
  if (text4(args.p_request)) params.set("request", String(args.p_request));
  const query = params.toString();
  return `${base}${query ? `?${query}` : ""}`;
}
function addError(args, rt) {
  if (!rt) return null;
  const location = String(args.p_display_location ?? "INLINE_IN_NOTIFICATION").toUpperCase();
  const item2 = text4(args.p_page_item_name)?.toUpperCase();
  rt.errors.push({
    type: "error",
    location: location === "INLINE_WITH_FIELD" ? ["inline"] : location === "INLINE_WITH_FIELD_AND_NOTIFICATION" ? ["inline", "page"] : ["page"],
    ...item2 ? { pageItem: item2 } : {},
    message: String(args.p_message ?? args.p_error_code ?? "Error"),
    unsafe: false
  });
  return null;
}
var appSettings = /* @__PURE__ */ new WeakMap();
function settings(rt) {
  const renderer = rt?.renderer ?? lastRenderer;
  if (!renderer) return void 0;
  let map = appSettings.get(renderer);
  if (!map) {
    map = /* @__PURE__ */ new Map();
    for (const component of [...renderer.app.shared, ...renderer.app.app.children].filter(
      (entry) => entry.type === "appSetting"
    )) {
      const value = str(component.props, "value.staticValue") || str(component.props, "staticValue") || null;
      map.set((str(component.props, "staticId") || component.id).toUpperCase(), value);
    }
    appSettings.set(renderer, map);
  }
  return map;
}
var noop = () => null;
var p = (...params) => params;
var STUBS = {
  // session state
  "apex_util.set_session_state": {
    params: p("p_name", "p_value", "p_commit"),
    fn: (args, rt) => {
      const items = sessionState(rt);
      if (items) items[String(args.p_name ?? "").toUpperCase()] = text4(args.p_value) ?? "";
      return null;
    }
  },
  "apex_util.get_session_state": {
    params: p("p_item"),
    fn: (args, rt) => text4(sessionState(rt)?.[String(args.p_item ?? "").toUpperCase()])
  },
  "apex_util.get_numeric_session_state": {
    params: p("p_item"),
    fn: (args, rt) => {
      const value = text4(sessionState(rt)?.[String(args.p_item ?? "").toUpperCase()]);
      return value === null ? null : Number(value);
    }
  },
  "apex_util.clear_page_cache": {
    params: p("p_page_id"),
    fn: (args, rt) => {
      const page = rt?.renderer.findPage(String(args.p_page_id ?? rt.ctx.pageId));
      for (const item2 of page?.children.filter((child) => child.type === "pageItem") ?? [])
        delete rt.ctx.session.items[item2.id.toUpperCase()];
      return null;
    }
  },
  "apex_util.clear_app_cache": { params: p("p_app_id"), fn: noop },
  "apex_util.clear_user_cache": { params: [], fn: noop },
  "apex_util.prepare_url": { params: p("p_url"), fn: (args) => text4(args.p_url), sql: true },
  "apex_util.url_encode": {
    params: p("p_url"),
    fn: (args) => text4(args.p_url) === null ? null : encodeURIComponent(String(args.p_url)),
    sql: true
  },
  "apex_util.string_to_table": {
    params: p("p_string", "p_separator"),
    fn: (args) => split(args.p_string, args.p_separator ?? ":")
  },
  "apex_util.table_to_string": {
    params: p("p_table", "p_string"),
    fn: (args) => Array.isArray(args.p_table) ? args.p_table.join(String(args.p_string ?? ":")) : null
  },
  "apex_util.get_since": { params: p("p_date"), fn: (args) => since2(args.p_date), sql: true },
  "apex_util.get_since_tswltz": { params: p("p_value"), fn: (args) => since2(args.p_value), sql: true },
  "apex_util.feedback_enabled": { params: [], fn: () => 0 },
  "apex_util.redirect_url": {
    params: p("p_url"),
    fn: (args, rt) => {
      if (rt && text4(args.p_url)) rt.redirectURL = String(args.p_url);
      return null;
    }
  },
  "apex_util.get_build_option_status": {
    params: p("p_application_id", "p_build_option_name"),
    fn: () => "INCLUDE"
  },
  "apex_util.public_check_authorization": {
    params: p("p_security_scheme"),
    fn: (args, rt) => authorize(rt, text4(args.p_security_scheme))
  },
  "apex_authorization.is_authorized": {
    params: p("p_authorization_name"),
    fn: (args, rt) => authorize(rt, text4(args.p_authorization_name))
  },
  "apex_acl.has_user_role": { params: p("p_application_id", "p_user_name", "p_role_static_id"), fn: () => 1 },
  "apex_acl.has_user_any_roles": { params: p("p_application_id", "p_user_name"), fn: () => 1 },
  "owa_util.redirect_url": {
    params: p("curl"),
    fn: (args, rt) => {
      if (rt && text4(args.curl)) rt.redirectURL = String(args.curl);
      return null;
    }
  },
  v: {
    params: p("p_item"),
    fn: (args, rt) => text4(sessionState(rt)?.[String(args.p_item ?? "").toUpperCase()])
  },
  nv: {
    params: p("p_item"),
    fn: (args, rt) => {
      const value = text4(sessionState(rt)?.[String(args.p_item ?? "").toUpperCase()]);
      return value === null ? null : Number(value);
    }
  },
  // apex_application globals
  "apex_application.g_flow_id": { params: [], fn: (_args, rt) => rt?.renderer.appId ?? null },
  "apex_application.g_flow_step_id": { params: [], fn: (_args, rt) => rt?.ctx.pageId ?? null },
  "apex_application.g_user": { params: [], fn: (_args, rt) => rt?.ctx.session.user ?? null },
  "apex_application.g_request": { params: [], fn: (_args, rt) => text4(rt?.ctx.request) },
  "apex_application.g_instance": { params: [], fn: (_args, rt) => rt?.ctx.session.id ?? null },
  "apex_application.g_debug": { params: [], fn: () => 0 },
  "apex_application.g_print_success_message": {
    params: [],
    fn: (_args, rt) => text4(rt?.ctx.session.success)
  },
  "apex_application.lf": { params: [], fn: () => "\n" },
  "apex_application.crlf": { params: [], fn: () => "\r\n" },
  "apex_application.stop_apex_engine": { params: [], fn: noop },
  // errors
  "apex_error.add_error": {
    params: p("p_message", "p_additional_info", "p_display_location", "p_page_item_name"),
    fn: addError
  },
  "apex_error.c_inline_with_field": { params: [], fn: () => "INLINE_WITH_FIELD" },
  "apex_error.c_inline_with_field_and_notif": { params: [], fn: () => "INLINE_WITH_FIELD_AND_NOTIFICATION" },
  "apex_error.c_inline_in_notification": { params: [], fn: () => "INLINE_IN_NOTIFICATION" },
  "apex_error.c_on_error_page": { params: [], fn: () => "ON_ERROR_PAGE" },
  "apex_error.have_errors_occurred": { params: [], fn: (_args, rt) => rt?.errors.length ? 1 : 0 },
  // URLs
  "apex_page.get_url": {
    params: p(
      "p_application",
      "p_page",
      "p_session",
      "p_request",
      "p_debug",
      "p_clear_cache",
      "p_items",
      "p_values"
    ),
    fn: (args, rt) => pageUrl(rt, args),
    sql: true
  },
  "apex_page.is_desktop_ui": { params: [], fn: () => 1 },
  "apex_page.purge_cache": { params: [], fn: noop },
  // strings
  "apex_string.split": {
    params: p("p_str", "p_sep", "p_limit"),
    fn: (args) => split(args.p_str, args.p_sep),
    sql: true
  },
  "apex_string.split_numbers": {
    params: p("p_str", "p_sep"),
    fn: (args) => split(args.p_str, args.p_sep).map(Number),
    sql: true
  },
  "apex_string.join": {
    params: p("p_table", "p_sep"),
    fn: (args) => Array.isArray(args.p_table) ? args.p_table.join(String(args.p_sep ?? "\n")) : text4(args.p_table)
  },
  "apex_string.format": {
    params: p("p_message", "p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"),
    fn: (args) => format(
      String(args.p_message ?? ""),
      Array.from({ length: 10 }, (_, index) => args[`p${index}`])
    ),
    sql: true
  },
  "apex_string.get_initials": {
    params: p("p_str", "p_cnt"),
    fn: (args) => text4(args.p_str) === null ? null : String(args.p_str).split(/\s+/u).filter(Boolean).map((word) => word[0].toUpperCase()).slice(0, Number(args.p_cnt ?? 2)).join(""),
    sql: true
  },
  "apex_escape.html": {
    params: p("p_string"),
    fn: (args) => text4(args.p_string) === null ? null : escapeHtml(String(args.p_string)),
    sql: true
  },
  "apex_escape.html_attribute": {
    params: p("p_string"),
    fn: (args) => text4(args.p_string) === null ? null : escapeHtml(String(args.p_string)),
    sql: true
  },
  "apex_escape.js_literal": {
    params: p("p_string", "p_quote"),
    fn: (args) => {
      const quote = String(args.p_quote ?? "'");
      return `${quote}${escapeJs(String(args.p_string ?? ""))}${quote}`;
    },
    sql: true
  },
  "apex_escape.striphtml": {
    params: p("p_string"),
    fn: (args) => text4(args.p_string) === null ? null : String(args.p_string).replace(/<[^>]*>/gu, ""),
    sql: true
  },
  "htf.escape_sc": {
    params: p("ctext"),
    fn: (args) => text4(args.ctext) === null ? null : escapeHtml(String(args.ctext)),
    sql: true
  },
  "apex_lang.message": {
    params: p(
      "p_name",
      "p0",
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
      "p8",
      "p9",
      "p_lang",
      "p_application_id"
    ),
    fn: (args, rt) => {
      const name = String(args.p_name ?? "").toUpperCase();
      const shortcut = rt?.renderer.app.shared.find(
        (component) => component.type === "textMessage" && component.id.toUpperCase() === name
      );
      const template = (shortcut ? str(shortcut.props, "text") || str(shortcut.props, "message") : "") || MESSAGE_FALLBACKS[name] || name;
      return format(
        template,
        Array.from({ length: 10 }, (_, index) => args[`p${index}`])
      );
    },
    sql: true
  },
  "apex_lang.lang": {
    params: p("p_primary_text_string"),
    fn: (args) => text4(args.p_primary_text_string),
    sql: true
  },
  // output
  "htp.p": { params: p("cbuf"), fn: (args, rt) => print(rt, args.cbuf, "\n") },
  "htp.print": { params: p("cbuf"), fn: (args, rt) => print(rt, args.cbuf, "\n") },
  "htp.prn": { params: p("cbuf"), fn: (args, rt) => print(rt, args.cbuf, "") },
  "htp.prints": {
    params: p("ctext"),
    fn: (args, rt) => print(rt, args.ctext === null ? null : escapeHtml(String(args.ctext ?? "")), "\n")
  },
  "htp.ps": {
    params: p("ctext"),
    fn: (args, rt) => print(rt, args.ctext === null ? null : escapeHtml(String(args.ctext ?? "")), "")
  },
  "htp.br": { params: [], fn: (_args, rt) => print(rt, "<br>", "\n") },
  "htp.para": { params: [], fn: (_args, rt) => print(rt, "<p>", "\n") },
  "apex_app_setting.get_value": {
    params: p("p_name", "p_raise_error"),
    fn: (args, rt) => settings(rt)?.get(String(args.p_name ?? "").toUpperCase()) ?? null,
    sql: true
  },
  "apex_app_setting.set_value": {
    params: p("p_name", "p_value", "p_raise_error"),
    fn: (args, rt) => {
      settings(rt)?.set(String(args.p_name ?? "").toUpperCase(), text4(args.p_value));
      return null;
    }
  },
  "apex_authentication.get_login_username_cookie": { params: [], fn: () => null },
  "apex_authentication.persistent_auth_enabled": { params: [], fn: () => 0 },
  "owa_util.get_cgi_env": {
    params: p("param_name"),
    fn: (args) => /user-agent/iu.test(String(args.param_name ?? "")) ? "Mozilla/5.0 (APEXlang local preview)" : null,
    sql: true
  },
  "apex_item.hidden": {
    params: p("p_idx", "p_value", "p_attributes", "p_item_id", "p_item_label"),
    fn: (args) => `<input type="hidden" name="${fname(args.p_idx)}" value="${attr2(args.p_value)}"${idAttr(args.p_item_id)} ${String(args.p_attributes ?? "")}/>`,
    sql: true
  },
  "apex_item.text": {
    params: p("p_idx", "p_value", "p_size", "p_maxlength", "p_attributes", "p_item_id", "p_item_label"),
    fn: (args) => `<input type="text" name="${fname(args.p_idx)}" size="${attr2(args.p_size ?? 20)}" maxlength="${attr2(args.p_maxlength ?? 2e3)}" value="${attr2(args.p_value)}"${idAttr(args.p_item_id)} ${String(args.p_attributes ?? "")}/>`,
    sql: true
  },
  "apex_item.display_and_save": {
    params: p("p_idx", "p_value", "p_item_id", "p_item_label"),
    fn: (args) => `<input type="hidden" name="${fname(args.p_idx)}" value="${attr2(args.p_value)}"${idAttr(args.p_item_id)}/><span>${attr2(args.p_value)}</span>`,
    sql: true
  },
  "apex_item.checkbox2": {
    params: p(
      "p_idx",
      "p_value",
      "p_attributes",
      "p_checked_values",
      "p_checked_values_delimiter",
      "p_item_id",
      "p_item_label"
    ),
    fn: (args) => {
      const checked = split(args.p_checked_values, args.p_checked_values_delimiter ?? ":").includes(
        String(args.p_value ?? "")
      );
      return `<input type="checkbox" name="${fname(args.p_idx)}" value="${attr2(args.p_value)}"${checked ? ' checked="checked"' : ""}${idAttr(args.p_item_id)} ${String(args.p_attributes ?? "")}/>`;
    },
    sql: true
  },
  "apex_item.switch": {
    params: p(
      "p_idx",
      "p_value",
      "p_on_value",
      "p_on_label",
      "p_off_value",
      "p_off_label",
      "p_item_id",
      "p_item_label",
      "p_attributes"
    ),
    fn: (args) => {
      const on = String(args.p_on_value ?? "Y");
      const checked = String(args.p_value ?? "") === on;
      return `<span class="a-Switch"><input type="checkbox" name="${fname(args.p_idx)}" value="${attr2(on)}"${checked ? " checked" : ""}${idAttr(args.p_item_id)} aria-label="${attr2(args.p_item_label)}" ${String(args.p_attributes ?? "")}/><span class="a-Switch-toggle" data-on-label="${attr2(args.p_on_label ?? "On")}" data-off-label="${attr2(args.p_off_label ?? "Off")}"></span></span>`;
    },
    sql: true
  },
  "apex_authentication.persistent_cookies_enabled": { params: [], fn: () => 0 },
  "apex_authentication.send_login_username_cookie": { params: p("p_username"), fn: noop },
  "apex_authentication.is_public_user": { params: [], fn: () => 0 },
  "apex_authentication.is_authenticated": { params: [], fn: () => 1 },
  "apex_authentication.login": {
    params: p("p_username", "p_password"),
    fn: (args, rt) => {
      if (rt && text4(args.p_username)) rt.ctx.session.user = String(args.p_username).toUpperCase();
      return null;
    }
  },
  "apex_authentication.logout": { params: [], fn: noop },
  "apex_mail.send": {
    params: p("p_to", "p_from", "p_body", "p_body_html", "p_subj"),
    fn: (_args, rt) => {
      rt?.note("info", "apex_mail.send: no e-mail is sent by the local preview");
      return null;
    }
  },
  "apex_mail.push_queue": { params: [], fn: noop }
};
var NOOP_PACKAGES = /* @__PURE__ */ new Set([
  "apex_debug",
  "dbms_output",
  "apex_session",
  "dbms_session",
  "dbms_lock",
  "dbms_application_info"
]);
var attr2 = (value) => escapeHtml(value === null || value === void 0 ? "" : String(value));
var fname = (index) => `f${String(Number(index ?? 1)).padStart(2, "0")}`;
var idAttr = (id) => text4(id) === null ? "" : ` id="${attr2(id)}"`;
function print(rt, value, end) {
  rt?.output.push(`${value === null || value === void 0 ? "" : String(value)}${end}`);
  return null;
}
var authorize = (_rt, _name) => 1;
function setAuthorizer(fn) {
  authorize = fn;
}
function findStub(name) {
  if (Object.hasOwn(STUBS, name)) return STUBS[name];
  const pkg = name.split(".")[0];
  if (NOOP_PACKAGES.has(pkg)) return { params: [], fn: noop };
  return void 0;
}
function stubArgs(stub, positional, named) {
  const args = { _: positional };
  positional.forEach((value, index) => {
    const name = stub.params[index];
    if (name) args[name] = value;
  });
  for (const [name, value] of Object.entries(named)) args[name] = value;
  return args;
}
for (const [name, stub] of Object.entries(STUBS)) {
  if (!stub.sql) continue;
  registerOracleFunction(name, stub.params, (values) => {
    const result = stub.fn(stubArgs(stub, values, {}), active);
    return Array.isArray(result) ? JSON.stringify(result) : result;
  });
}

// packages/core/src/preview/extensions/server/parser.ts
var PlsqlSyntaxError = class extends Error {
  line;
  constructor(message, line) {
    super(message);
    this.line = line;
  }
};
var TWO_CHAR_OPS = /* @__PURE__ */ new Set([":=", "=>", "..", "||", "<=", ">=", "<>", "!=", "<<", ">>", "**", "~=", "^="]);
var Q_CLOSE = { "[": "]", "{": "}", "(": ")", "<": ">" };
function lex(src) {
  const tokens = [];
  let index = 0;
  let line = 1;
  let gapStart = 0;
  const push = (kind, text5, value, start, end) => {
    tokens.push({ kind, text: text5, value, pre: src.slice(gapStart, start), line });
    for (const char of src.slice(start, end)) if (char === "\n") line += 1;
    index = end;
    gapStart = end;
  };
  while (index < src.length) {
    const char = src[index];
    const next = src[index + 1] ?? "";
    if (char === "\n") {
      line += 1;
      index += 1;
      continue;
    }
    if (/\s/u.test(char)) {
      index += 1;
      continue;
    }
    if (char === "-" && next === "-") {
      const end = src.indexOf("\n", index);
      index = end < 0 ? src.length : end;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = src.indexOf("*/", index + 2);
      const stop = end < 0 ? src.length : end + 2;
      for (const c of src.slice(index, stop)) if (c === "\n") line += 1;
      index = stop;
      continue;
    }
    const start = index;
    if ((char === "q" || char === "Q") && next === "'") {
      const open = src[index + 2] ?? "";
      const close = Q_CLOSE[open] ?? open;
      const end = src.indexOf(`${close}'`, index + 3);
      if (end < 0) throw new PlsqlSyntaxError("Unterminated q-quoted string", line);
      const value = src.slice(index + 3, end);
      push("string", `'${value.replaceAll("'", "''")}'`, value, start, end + 2);
      continue;
    }
    if (char === "'") {
      let cursor = index + 1;
      let value = "";
      for (; ; ) {
        if (cursor >= src.length) throw new PlsqlSyntaxError("Unterminated string literal", line);
        if (src[cursor] === "'") {
          if (src[cursor + 1] === "'") {
            value += "'";
            cursor += 2;
            continue;
          }
          break;
        }
        value += src[cursor];
        cursor += 1;
      }
      push("string", src.slice(start, cursor + 1), value, start, cursor + 1);
      continue;
    }
    if (char === '"') {
      const end = src.indexOf('"', index + 1);
      if (end < 0) throw new PlsqlSyntaxError("Unterminated quoted identifier", line);
      push("qident", src.slice(start, end + 1), src.slice(start + 1, end), start, end + 1);
      continue;
    }
    if (/\d/u.test(char) || char === "." && /\d/u.test(next)) {
      const match = /^(?:\d+(?:\.(?!\.)\d*)?|\.\d+)(?:[eE][+-]?\d+)?[fFdD]?/u.exec(src.slice(index));
      const text5 = match[0].replace(/[fFdD]$/u, "");
      push("number", text5, text5, start, start + match[0].length);
      continue;
    }
    if (char === ":" && /[A-Za-z]/u.test(next)) {
      const match = /^:[A-Za-z][\w$#]*/u.exec(src.slice(index));
      push("bind", match[0], match[0].slice(1).toUpperCase(), start, start + match[0].length);
      continue;
    }
    if (/[A-Za-z_]/u.test(char)) {
      const match = /^[A-Za-z_][\w$#]*/u.exec(src.slice(index));
      push("word", match[0], match[0].toLowerCase(), start, start + match[0].length);
      continue;
    }
    const two = src.slice(index, index + 2);
    if (TWO_CHAR_OPS.has(two)) {
      push("op", two, two, start, start + 2);
      continue;
    }
    push("op", char, char, start, start + 1);
  }
  return tokens;
}
var tokenText = (tokens) => tokens.map((token, index) => (index === 0 ? "" : token.pre) + token.text).join("").trim();
var BLOCK_END = /* @__PURE__ */ new Set(["end", "elsif", "else", "when", "exception"]);
var isWord = (token, ...words) => token?.kind === "word" && words.includes(token.value);
var isOp = (token, ...ops) => token?.kind === "op" && ops.includes(token.value);
function splitTopLevel(tokens, separator2 = ",") {
  const parts = [[]];
  let depth = 0;
  for (const token of tokens) {
    if (isOp(token, "(")) depth += 1;
    if (isOp(token, ")")) depth -= 1;
    if (depth === 0 && isOp(token, separator2)) parts.push([]);
    else parts.at(-1).push(token);
  }
  return parts.filter((part2, index) => part2.length || index < parts.length - 1);
}
function parseArgs(tokens) {
  if (!tokens.length) return [];
  return splitTopLevel(tokens).map(
    (part2) => part2[0]?.kind === "word" && isOp(part2[1], "=>") ? { name: part2[0].value, expr: part2.slice(2) } : { expr: part2 }
  );
}
function matchParen(tokens, open) {
  let depth = 0;
  for (let index = open; index < tokens.length; index += 1) {
    if (isOp(tokens[index], "(")) depth += 1;
    else if (isOp(tokens[index], ")")) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new PlsqlSyntaxError("Unbalanced parentheses", tokens[open]?.line ?? 0);
}
var Parser2 = class {
  tokens;
  pos = 0;
  constructor(source) {
    this.tokens = lex(source.replace(/\n\s*\/\s*$/u, "\n"));
  }
  get line() {
    return this.peek()?.line ?? this.tokens.at(-1)?.line ?? 0;
  }
  peek(offset = 0) {
    return this.tokens[this.pos + offset];
  }
  next() {
    const token = this.tokens[this.pos];
    if (!token) throw new PlsqlSyntaxError("Unexpected end of code", this.line);
    this.pos += 1;
    return token;
  }
  expectWord(...words) {
    const token = this.next();
    if (!isWord(token, ...words))
      throw new PlsqlSyntaxError(`Expected ${words.join("/")} but found "${token.text}"`, token.line);
    return token;
  }
  expectOp(op) {
    const token = this.next();
    if (!isOp(token, op))
      throw new PlsqlSyntaxError(`Expected "${op}" but found "${token.text}"`, token.line);
  }
  acceptWord(...words) {
    if (!isWord(this.peek(), ...words)) return false;
    this.pos += 1;
    return true;
  }
  acceptOp(op) {
    if (!isOp(this.peek(), op)) return false;
    this.pos += 1;
    return true;
  }
  /** Reads an expression until `stop` matches at depth 0 (outside parentheses and CASE). */
  readUntil(stop) {
    const out = [];
    let depth = 0;
    let cases = 0;
    for (; ; ) {
      const token = this.peek();
      if (!token) {
        if (depth || cases) throw new PlsqlSyntaxError("Unexpected end of code in expression", this.line);
        return out;
      }
      if (depth === 0 && cases === 0 && stop(token)) return out;
      if (isOp(token, "(")) depth += 1;
      else if (isOp(token, ")")) depth -= 1;
      else if (isWord(token, "case")) cases += 1;
      else if (isWord(token, "end") && cases > 0) cases -= 1;
      out.push(token);
      this.pos += 1;
    }
  }
  untilWord(...words) {
    const expr = this.readUntil((token) => isWord(token, ...words) || isOp(token, ";"));
    if (!isWord(this.peek(), ...words)) throw new PlsqlSyntaxError(`Expected ${words.join("/")}`, this.line);
    return expr;
  }
  untilSemicolon() {
    const expr = this.readUntil((token) => isOp(token, ";"));
    this.expectOp(";");
    return expr;
  }
  /** Whole program: a statement list (APEX accepts bodies without BEGIN/END). */
  program() {
    const body3 = this.statements(/* @__PURE__ */ new Set());
    if (this.peek()) throw new PlsqlSyntaxError(`Unexpected "${this.peek().text}"`, this.line);
    return body3;
  }
  block(label) {
    const decls = this.acceptWord("declare") ? this.declarations() : [];
    this.expectWord("begin");
    const body3 = this.statements(BLOCK_END);
    const handlers = [];
    if (this.acceptWord("exception")) {
      while (this.acceptWord("when")) {
        const names = [this.next().value];
        while (this.acceptWord("or")) names.push(this.next().value);
        this.expectWord("then");
        handlers.push({ names, body: this.statements(BLOCK_END) });
      }
    }
    this.expectWord("end");
    if (this.peek()?.kind === "word" && !isOp(this.peek(), ";")) this.pos += 1;
    return { decls, body: body3, handlers, ...label ? { label } : {} };
  }
  declarations() {
    const decls = [];
    while (this.peek() && !isWord(this.peek(), "begin")) {
      const token = this.next();
      const line = token.line;
      if (isWord(token, "pragma", "subtype")) {
        this.untilSemicolon();
        continue;
      }
      if (isWord(token, "cursor")) {
        const name2 = this.next().value;
        const params = isOp(this.peek(), "(") ? this.params() : [];
        if (this.acceptWord("return")) this.untilWord("is");
        this.expectWord("is");
        decls.push({ kind: "cursor", name: name2, params, sql: this.untilSemicolon(), line });
        continue;
      }
      if (isWord(token, "type")) {
        const name2 = this.next().value;
        const body3 = this.untilSemicolon();
        decls.push({
          kind: "type",
          name: name2,
          collection: body3.some((part2) => isWord(part2, "table", "varray", "varying"))
        });
        continue;
      }
      if (isWord(token, "function", "procedure")) {
        const routine = this.routine(token.value === "function");
        if (routine) decls.push({ kind: "routine", routine });
        continue;
      }
      const name = token.value;
      if (this.acceptWord("exception")) {
        this.expectOp(";");
        decls.push({ kind: "exception", name });
        continue;
      }
      const constant = this.acceptWord("constant");
      const type = tokenText(this.readUntil((part2) => isOp(part2, ":=", ";") || isWord(part2, "default")));
      const init = this.acceptOp(":=") || this.acceptWord("default") ? this.untilSemicolon() : void 0;
      if (!init) this.expectOp(";");
      decls.push({ kind: "var", name, type, constant, ...init ? { init } : {}, line });
    }
    return decls;
  }
  params() {
    this.expectOp("(");
    const start = this.pos;
    const close = matchParen(this.tokens, start - 1);
    const inner = this.tokens.slice(start, close);
    this.pos = close + 1;
    return splitTopLevel(inner).map((part2) => {
      let index = 1;
      let mode = "in";
      if (isWord(part2[index], "in")) index += 1;
      if (isWord(part2[index], "out")) {
        mode = index === 2 ? "in out" : "out";
        index += 1;
      }
      if (isWord(part2[index], "nocopy")) index += 1;
      const rest = part2.slice(index);
      const split2 = rest.findIndex((item2) => isOp(item2, ":=") || isWord(item2, "default"));
      const type = tokenText(split2 < 0 ? rest : rest.slice(0, split2));
      return {
        name: part2[0].value,
        mode,
        type,
        ...split2 >= 0 ? { init: rest.slice(split2 + 1) } : {}
      };
    });
  }
  routine(isFunction) {
    const name = this.next().value;
    const params = isOp(this.peek(), "(") ? this.params() : [];
    if (isFunction) {
      this.expectWord("return");
      this.readUntil((token) => isWord(token, "is", "as") || isOp(token, ";"));
    }
    if (this.acceptOp(";")) return void 0;
    this.expectWord("is", "as");
    const decls = this.declarations();
    this.expectWord("begin");
    this.pos -= 1;
    const block = this.block();
    block.decls = decls;
    this.expectOp(";");
    return { name, params, isFunction, block };
  }
  statements(terminators) {
    const list4 = [];
    for (; ; ) {
      const token = this.peek();
      if (!token) return list4;
      if (token.kind === "word" && terminators.has(token.value)) return list4;
      list4.push(this.statement());
    }
  }
  label() {
    if (!isOp(this.peek(), "<<")) return void 0;
    this.pos += 1;
    const name = this.next().value;
    this.expectOp(">>");
    return name;
  }
  endLoop() {
    this.expectWord("end");
    this.expectWord("loop");
    if (this.peek()?.kind === "word") this.pos += 1;
    this.expectOp(";");
  }
  statement() {
    const label = this.label();
    const token = this.peek();
    const line = token.line;
    if (isOp(token, ";")) {
      this.pos += 1;
      return { k: "noop", line };
    }
    if (token.kind === "word") {
      switch (token.value) {
        case "declare":
        case "begin": {
          const block = this.block(label);
          this.expectOp(";");
          return { k: "block", block, line };
        }
        case "null":
          if (isOp(this.peek(1), ";")) {
            this.pos += 2;
            return { k: "null", line };
          }
          break;
        case "if": {
          this.pos += 1;
          const branches = [];
          let otherwise;
          const ends = /* @__PURE__ */ new Set(["elsif", "else", "end"]);
          let cond = this.untilWord("then");
          this.expectWord("then");
          branches.push({ cond, body: this.statements(ends) });
          while (this.acceptWord("elsif")) {
            cond = this.untilWord("then");
            this.expectWord("then");
            branches.push({ cond, body: this.statements(ends) });
          }
          if (this.acceptWord("else")) otherwise = this.statements(/* @__PURE__ */ new Set(["end"]));
          this.expectWord("end");
          this.expectWord("if");
          this.expectOp(";");
          return { k: "if", branches, ...otherwise ? { otherwise } : {}, line };
        }
        case "case": {
          this.pos += 1;
          const selector = isWord(this.peek(), "when") ? void 0 : this.untilWord("when");
          const whens = [];
          const ends = /* @__PURE__ */ new Set(["when", "else", "end"]);
          while (this.acceptWord("when")) {
            const expr = this.untilWord("then");
            this.expectWord("then");
            whens.push({ expr, body: this.statements(ends) });
          }
          const otherwise = this.acceptWord("else") ? this.statements(/* @__PURE__ */ new Set(["end"])) : void 0;
          this.expectWord("end");
          this.expectWord("case");
          if (this.peek()?.kind === "word") this.pos += 1;
          this.expectOp(";");
          return {
            k: "case",
            ...selector ? { selector } : {},
            whens,
            ...otherwise ? { otherwise } : {},
            line
          };
        }
        case "loop": {
          this.pos += 1;
          const body3 = this.statements(/* @__PURE__ */ new Set(["end"]));
          this.endLoop();
          return { k: "loop", body: body3, ...label ? { label } : {}, line };
        }
        case "while": {
          this.pos += 1;
          const cond = this.untilWord("loop");
          this.expectWord("loop");
          const body3 = this.statements(/* @__PURE__ */ new Set(["end"]));
          this.endLoop();
          return { k: "while", cond, body: body3, ...label ? { label } : {}, line };
        }
        case "for":
          return this.forLoop(label, line);
        case "exit":
        case "continue": {
          this.pos += 1;
          const name = this.peek()?.kind === "word" && !isWord(this.peek(), "when") ? this.next().value : void 0;
          const when = this.acceptWord("when") ? this.untilSemicolon() : void 0;
          if (!when) this.expectOp(";");
          return {
            k: token.value,
            ...when ? { when } : {},
            ...name ? { label: name } : {},
            line
          };
        }
        case "return": {
          this.pos += 1;
          const expr = this.untilSemicolon();
          return { k: "return", ...expr.length ? { expr } : {}, line };
        }
        case "raise": {
          this.pos += 1;
          const name = this.untilSemicolon();
          return {
            k: "raise",
            ...name.length ? { name: name.map((part2) => part2.value).join(".") } : {},
            line
          };
        }
        case "select":
        case "with":
          return this.selectInto(line);
        case "insert":
        case "update":
        case "delete":
        case "merge":
          return this.dml(line);
        case "commit":
        case "rollback":
        case "savepoint":
        case "lock":
          this.untilSemicolon();
          return { k: "noop", line };
        case "set":
          if (isWord(this.peek(1), "transaction")) {
            this.untilSemicolon();
            return { k: "noop", line };
          }
          break;
        case "execute":
        case "open":
        case "fetch":
        case "close":
        case "goto":
        case "forall":
        case "pipe": {
          this.untilSemicolon();
          return { k: "unsupported", what: `${token.value.toUpperCase()} statements`, line };
        }
        default:
          break;
      }
    }
    return this.assignmentOrCall(line);
  }
  forLoop(label, line) {
    this.expectWord("for");
    const name = this.next().value;
    this.expectWord("in");
    const reverse = this.acceptWord("reverse");
    const tag = label ? { label } : {};
    if (isOp(this.peek(), "(") && isWord(this.peek(1), "select", "with")) {
      const close = matchParen(this.tokens, this.pos);
      const sql = this.tokens.slice(this.pos + 1, close);
      this.pos = close + 1;
      this.expectWord("loop");
      const body4 = this.statements(/* @__PURE__ */ new Set(["end"]));
      this.endLoop();
      return { k: "forQuery", name, sql, body: body4, ...tag, line };
    }
    const from = this.readUntil((token) => isOp(token, "..") || isWord(token, "loop"));
    if (this.acceptOp("..")) {
      const to = this.untilWord("loop");
      this.expectWord("loop");
      const body4 = this.statements(/* @__PURE__ */ new Set(["end"]));
      this.endLoop();
      return { k: "forRange", name, reverse, from, to, body: body4, ...tag, line };
    }
    this.expectWord("loop");
    const cursor = from[0]?.value ?? "";
    const args = isOp(from[1], "(") ? parseArgs(from.slice(2, matchParen(from, 1))) : [];
    const body3 = this.statements(/* @__PURE__ */ new Set(["end"]));
    this.endLoop();
    return { k: "forQuery", name, cursor, args, body: body3, ...tag, line };
  }
  /** `select ... into a, b from ...` — the INTO clause is removed from the SQL. */
  selectInto(line) {
    const tokens = this.untilSemicolon();
    let depth = 0;
    let into = -1;
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (isOp(token, "(")) depth += 1;
      else if (isOp(token, ")")) depth -= 1;
      else if (depth === 0 && isWord(token, "into")) {
        into = index;
        break;
      }
    }
    if (into < 0) throw new PlsqlSyntaxError("SELECT without INTO in PL/SQL", line);
    const bulk = isWord(tokens[into - 1], "collect") && isWord(tokens[into - 2], "bulk");
    let end = into + 1;
    depth = 0;
    while (end < tokens.length && !(depth === 0 && isWord(tokens[end], "from"))) {
      if (isOp(tokens[end], "(")) depth += 1;
      if (isOp(tokens[end], ")")) depth -= 1;
      end += 1;
    }
    const targets = splitTopLevel(tokens.slice(into + 1, end)).map((part2) => this.target(part2));
    const head = tokens.slice(0, bulk ? into - 2 : into);
    const tail = tokens.slice(end);
    return { k: "selectInto", sql: [...head, ...tail], targets, bulk, line };
  }
  dml(line) {
    const tokens = this.untilSemicolon();
    let depth = 0;
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (isOp(token, "(")) depth += 1;
      else if (isOp(token, ")")) depth -= 1;
      else if (depth === 0 && isWord(token, "returning", "return")) {
        const rest = tokens.slice(index + 1);
        const into = rest.findIndex((part2) => isWord(part2, "into"));
        if (into < 0) break;
        const targets = splitTopLevel(rest.slice(into + 1)).map((part2) => this.target(part2));
        const returning = { ...token, text: "returning", value: "returning" };
        return {
          k: "dml",
          sql: [...tokens.slice(0, index), returning, ...rest.slice(0, into)],
          targets,
          line
        };
      }
    }
    return { k: "dml", sql: tokens, line };
  }
  target(tokens) {
    const [first, second, third] = tokens;
    if (first?.kind === "bind" && tokens.length === 1) return { kind: "bind", name: first.value };
    if (first?.kind === "word") {
      if (tokens.length === 1) return { kind: "var", name: first.value };
      if (isOp(second, ".") && third && tokens.length === 3) {
        if (first.value === "apex_application")
          return { kind: "global", name: `${first.value}.${third.value}` };
        return { kind: "var", name: first.value, field: third.value };
      }
      if (isOp(second, "(") && matchParen(tokens, 1) === tokens.length - 1)
        return { kind: "var", name: first.value, index: tokens.slice(2, -1) };
    }
    throw new PlsqlSyntaxError(`Unsupported assignment target "${tokenText(tokens)}"`, first?.line ?? 0);
  }
  assignmentOrCall(line) {
    const tokens = this.untilSemicolon();
    let depth = 0;
    for (let index2 = 0; index2 < tokens.length; index2 += 1) {
      const token = tokens[index2];
      if (isOp(token, "(")) depth += 1;
      else if (isOp(token, ")")) depth -= 1;
      else if (depth === 0 && isOp(token, ":=")) {
        return {
          k: "assign",
          target: this.target(tokens.slice(0, index2)),
          expr: tokens.slice(index2 + 1),
          line
        };
      }
    }
    const name = [];
    let index = 0;
    while (tokens[index]?.kind === "word" || tokens[index]?.kind === "qident") {
      name.push(tokens[index].value.toLowerCase());
      index += 1;
      if (!isOp(tokens[index], ".")) break;
      index += 1;
    }
    if (!name.length)
      throw new PlsqlSyntaxError(`Unsupported statement "${tokenText(tokens).slice(0, 60)}"`, line);
    let args = [];
    if (isOp(tokens[index], "(")) {
      const close = matchParen(tokens, index);
      args = parseArgs(tokens.slice(index + 1, close));
      index = close + 1;
    }
    if (index < tokens.length)
      throw new PlsqlSyntaxError(`Unsupported statement "${tokenText(tokens).slice(0, 60)}"`, line);
    return { k: "call", name, args, line };
  }
};
function parseProgram(source) {
  return new Parser2(source).program();
}
function parseExpression(source) {
  return lex(source.trim().replace(/;\s*$/u, ""));
}

// packages/core/src/preview/extensions/server/plsql.ts
var RecordValue = class {
  fields;
  constructor(fields = {}) {
    this.fields = fields;
  }
};
var Collection = class _Collection {
  items = /* @__PURE__ */ new Map();
  static of(values) {
    const collection = new _Collection();
    values.forEach((value, index) => collection.items.set(index + 1, value));
    return collection;
  }
  keys() {
    return [...this.items.keys()].sort(
      (a, b) => typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b))
    );
  }
  values() {
    return this.keys().map((key) => this.items.get(key) ?? null);
  }
};
var Scope = class {
  vars = /* @__PURE__ */ new Map();
  cursors = /* @__PURE__ */ new Map();
  exceptions = /* @__PURE__ */ new Set();
  routines = /* @__PURE__ */ new Map();
  collectionTypes = /* @__PURE__ */ new Set();
  parent;
  constructor(parent) {
    this.parent = parent;
  }
  find(pick) {
    for (let scope = this; scope; scope = scope.parent) {
      const found = pick(scope);
      if (found !== void 0) return found;
    }
    return void 0;
  }
  variable(name) {
    return this.find((scope) => scope.vars.get(name));
  }
};
var PREDEFINED = {
  no_data_found: 100,
  too_many_rows: -1422,
  zero_divide: -1476,
  value_error: -6502,
  dup_val_on_index: -1,
  invalid_number: -1722,
  case_not_found: -6592,
  program_error: -6501,
  others: -20999
};
var PREDEFINED_TEXT = {
  no_data_found: "ORA-01403: no data found",
  too_many_rows: "ORA-01422: exact fetch returns more than requested number of rows",
  zero_divide: "ORA-01476: divisor is equal to zero",
  value_error: "ORA-06502: PL/SQL: numeric or value error",
  dup_val_on_index: "ORA-00001: unique constraint violated",
  invalid_number: "ORA-01722: invalid number",
  case_not_found: "ORA-06592: CASE not found while executing CASE statement"
};
var PlsqlException = class extends Error {
  exName;
  code;
  kind;
  sqlerrm;
  constructor(exName, code, message, kind, sqlerrm) {
    super(message);
    this.exName = exName;
    this.code = code;
    this.kind = kind;
    this.sqlerrm = sqlerrm ?? message;
  }
};
var PlsqlUnsupported = class extends Error {
  line;
  constructor(message, line) {
    super(message);
    this.line = line;
  }
};
var COLLECTION_TYPES = /* @__PURE__ */ new Set([
  "apex_t_varchar2",
  "apex_t_number",
  "apex_t_clob",
  "apex_application_global.vc_arr2",
  "apex_application_global.n_arr",
  "sys.odcivarchar2list",
  "sys.odcinumberlist",
  "odcivarchar2list",
  "odcinumberlist",
  "dbms_sql.varchar2_table",
  "dbms_sql.number_table"
]);
var COMPARISON2 = /* @__PURE__ */ new Set(["=", "<", ">", "<=", ">=", "<>", "!=", "~=", "^="]);
var LOOP_LIMIT = 1e5;
var MAX_CALL_DEPTH = 50;
function typeOf(type, scope) {
  const lower = type.toLowerCase().replace(/\s+/gu, " ").trim();
  if (/%rowtype$/u.test(lower)) return "record";
  if (COLLECTION_TYPES.has(lower) || scope.find((s) => s.collectionTypes.has(lower) ? true : void 0))
    return "collection";
  if (/^(number|integer|int|pls_integer|binary_integer|simple_integer|natural|naturaln|positive|positiven|signtype|float|real|decimal|numeric|dec|smallint|binary_double|binary_float)\b/u.test(
    lower
  ))
    return "number";
  if (/^boolean\b/u.test(lower)) return "boolean";
  if (/^(n?varchar2?|n?char|n?clob|long|string|date|timestamp|interval|rowid|urowid|raw)\b/u.test(lower))
    return "string";
  return "any";
}
function toSql(value) {
  if (value === void 0 || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Collection) return JSON.stringify(value.values().map((item2) => toSql(item2)));
  if (value instanceof RecordValue) return null;
  if (value === "") return null;
  return value;
}
function truthy(value) {
  if (value === null || value === void 0) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return !["", "0", "false", "n", "no"].includes(value.trim().toLowerCase());
  return true;
}
function itemText(value) {
  if (value === null || value === void 0) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Collection) return value.values().map(itemText).join(":");
  if (value instanceof RecordValue) return "";
  return String(value);
}
function sameValue(left, right) {
  if (left === null || right === null) return false;
  const a = toSql(left);
  const b = toSql(right);
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return a === b;
}
function engineError(error) {
  if (error instanceof PlsqlException) return error;
  const message = error.message ?? String(error);
  if (/UNIQUE constraint failed/u.test(message))
    return new PlsqlException("dup_val_on_index", -1, `ORA-00001: ${message}`, "engine");
  return new PlsqlException("others", -20999, message, "engine");
}
var parseCache = /* @__PURE__ */ new Map();
function parsed(code) {
  let entry = parseCache.get(code);
  if (!entry) {
    try {
      entry = parseProgram(code);
    } catch (error) {
      if (!(error instanceof PlsqlSyntaxError)) throw error;
      entry = error;
    }
    if (parseCache.size > 500) parseCache.clear();
    parseCache.set(code, entry);
  }
  if (entry instanceof PlsqlSyntaxError) throw entry;
  return entry;
}
var Interpreter = class {
  renderer;
  ctx;
  owner;
  output = [];
  errors = [];
  redirectURL;
  line = 0;
  #bindSeq = 0;
  #iterations = 0;
  #depth = 0;
  #rowcount = null;
  #current;
  constructor(renderer, ctx, owner2) {
    this.renderer = renderer;
    this.ctx = ctx;
    this.owner = owner2;
  }
  note(level, message) {
    this.renderer.diagnose(
      level,
      `${this.owner.label}: ${message}${this.line ? ` (line ${this.line})` : ""}`,
      this.ctx.pageId,
      this.owner.component
    );
  }
  // ------------------------------------------------------------ entry points
  run(code, mode) {
    const result = { ok: true, value: null, output: "", errors: this.errors };
    try {
      withRuntime(this, () => {
        if (mode === "plsqlExpression" || mode === "sqlExpression") {
          result.value = this.evaluate(parseExpression(code), new Scope());
          return;
        }
        const signal = this.execList(parsed(code), new Scope());
        if (signal?.kind === "return") result.value = signal.value;
        else if (mode === "functionBody")
          throw new PlsqlException(
            "others",
            -6503,
            "ORA-06503: PL/SQL: Function returned without value",
            "app"
          );
      });
    } catch (error) {
      result.ok = false;
      if (error instanceof PlsqlException) {
        result.failure = { message: error.message, kind: error.kind, line: this.line };
      } else if (error instanceof PlsqlSyntaxError || error instanceof PlsqlUnsupported) {
        result.failure = { message: error.message, kind: "unsupported", line: error.line || this.line };
      } else {
        result.failure = {
          message: error.message ?? String(error),
          kind: "engine",
          line: this.line
        };
      }
    }
    result.output = this.output.join("");
    if (this.redirectURL) result.redirectURL = this.redirectURL;
    return result;
  }
  // ------------------------------------------------------------ declarations
  declare(decls, scope) {
    for (const decl of decls) {
      switch (decl.kind) {
        case "var": {
          this.line = decl.line;
          const type = typeOf(decl.type, scope);
          const initial = decl.init ? this.evaluate(decl.init, scope) : type === "record" ? new RecordValue() : type === "collection" ? new Collection() : null;
          scope.vars.set(decl.name, { value: this.coerce(initial, type), type, constant: decl.constant });
          break;
        }
        case "cursor":
          scope.cursors.set(decl.name, { params: decl.params, sql: decl.sql });
          break;
        case "exception":
          scope.exceptions.add(decl.name);
          break;
        case "type":
          if (decl.collection) scope.collectionTypes.add(decl.name);
          break;
        case "routine":
          scope.routines.set(decl.routine.name, { routine: decl.routine, scope });
          break;
      }
    }
  }
  coerce(value, type) {
    if (value === void 0) return null;
    switch (type) {
      case "number": {
        if (value === null || value === "") return null;
        if (typeof value === "boolean") return value ? 1 : 0;
        if (typeof value === "number") return value;
        const number = Number(String(value).trim().replaceAll(",", ""));
        if (typeof value === "string" && value.trim() !== "" && Number.isFinite(number)) return number;
        throw new PlsqlException("value_error", -6502, PREDEFINED_TEXT.value_error, "app");
      }
      case "string":
        if (value === null || value === "") return null;
        if (value instanceof Collection || value instanceof RecordValue) return value;
        return typeof value === "boolean" ? value ? "TRUE" : "FALSE" : String(value);
      case "boolean":
        return value === null ? null : truthy(value);
      case "collection":
        if (value instanceof Collection) return value;
        return value === null ? new Collection() : Collection.of([value]);
      default:
        return value === "" ? null : value;
    }
  }
  // ------------------------------------------------------------ statements
  execList(list4, scope) {
    for (const statement of list4) {
      const signal = this.exec(statement, scope);
      if (signal) return signal;
    }
    return void 0;
  }
  execBlock(block, scope) {
    const local = new Scope(scope);
    try {
      this.declare(block.decls, local);
      return this.execList(block.body, local);
    } catch (error) {
      if (!block.handlers.length || error instanceof PlsqlUnsupported || error instanceof PlsqlSyntaxError)
        throw error;
      const exception = engineError(error);
      const handler = block.handlers.find(
        (entry) => entry.names.some((name) => name === "others" || name === exception.exName)
      );
      if (!handler) throw exception;
      const handling = new Scope(local);
      handling.vars.set("sqlerrm", { value: exception.sqlerrm, type: "string", constant: true });
      handling.vars.set("sqlcode", { value: exception.code, type: "number", constant: true });
      const previous = this.#current;
      this.#current = exception;
      try {
        return this.execList(handler.body, handling);
      } finally {
        this.#current = previous;
      }
    }
  }
  tick() {
    this.#iterations += 1;
    if (this.#iterations > LOOP_LIMIT)
      throw new PlsqlUnsupported(`loop exceeded ${LOOP_LIMIT} iterations`, this.line);
  }
  /** Runs a loop body; returns a signal for the caller or `'next'`/`'stop'` for the loop. */
  loopBody(body3, scope, label) {
    this.tick();
    const signal = this.execList(body3, scope);
    if (!signal) return "next";
    if (signal.kind === "return") return signal;
    if (signal.label && signal.label !== label) return signal;
    return signal.kind === "exit" ? "stop" : "next";
  }
  exec(statement, scope) {
    this.line = statement.line;
    switch (statement.k) {
      case "null":
      case "noop":
        return void 0;
      case "unsupported":
        this.note("info", `${statement.what} are not simulated; skipped`);
        return void 0;
      case "assign":
        this.assign(statement.target, this.evaluate(statement.expr, scope), scope);
        return void 0;
      case "if": {
        for (const branch of statement.branches) {
          if (truthy(this.evaluate(branch.cond, scope))) return this.execList(branch.body, new Scope(scope));
        }
        return statement.otherwise ? this.execList(statement.otherwise, new Scope(scope)) : void 0;
      }
      case "case": {
        const selector = statement.selector ? this.evaluate(statement.selector, scope) : void 0;
        for (const when of statement.whens) {
          const value = this.evaluate(when.expr, scope);
          if (statement.selector ? sameValue(selector ?? null, value) : truthy(value))
            return this.execList(when.body, new Scope(scope));
        }
        if (statement.otherwise) return this.execList(statement.otherwise, new Scope(scope));
        throw new PlsqlException("case_not_found", -6592, PREDEFINED_TEXT.case_not_found, "app");
      }
      case "loop":
        for (; ; ) {
          const result = this.loopBody(statement.body, new Scope(scope), statement.label);
          if (result === "stop") return void 0;
          if (result !== "next") return result;
        }
      case "while":
        while (truthy(this.evaluate(statement.cond, scope))) {
          const result = this.loopBody(statement.body, new Scope(scope), statement.label);
          if (result === "stop") return void 0;
          if (result !== "next") return result;
        }
        return void 0;
      case "forRange": {
        const from = Number(this.evaluate(statement.from, scope));
        const to = Number(this.evaluate(statement.to, scope));
        if (!Number.isFinite(from) || !Number.isFinite(to)) return void 0;
        const step = statement.reverse ? -1 : 1;
        for (let index = statement.reverse ? to : from; statement.reverse ? index >= from : index <= to; index += step) {
          const local = new Scope(scope);
          local.vars.set(statement.name, { value: index, type: "number", constant: true });
          const result = this.loopBody(statement.body, local, statement.label);
          if (result === "stop") return void 0;
          if (result !== "next") return result;
        }
        return void 0;
      }
      case "forQuery": {
        const rows = this.cursorRows(statement, scope);
        for (const row of rows) {
          const local = new Scope(scope);
          local.vars.set(statement.name, { value: new RecordValue(row), type: "record", constant: true });
          const result = this.loopBody(statement.body, local, statement.label);
          if (result === "stop") return void 0;
          if (result !== "next") return result;
        }
        return void 0;
      }
      case "exit":
      case "continue":
        if (statement.when && !truthy(this.evaluate(statement.when, scope))) return void 0;
        return { kind: statement.k, ...statement.label ? { label: statement.label } : {} };
      case "return":
        return { kind: "return", value: statement.expr ? this.evaluate(statement.expr, scope) : null };
      case "raise":
        return this.raise(statement.name, scope);
      case "selectInto":
        this.selectInto(statement.sql, statement.targets, statement.bulk, scope);
        return void 0;
      case "dml":
        this.dml(statement.sql, statement.targets, scope);
        return void 0;
      case "call":
        this.call(statement.name, statement.args, scope, false);
        return void 0;
      case "block":
        return this.execBlock(statement.block, scope);
    }
  }
  raise(name, scope) {
    if (!name) {
      if (this.#current) throw this.#current;
      throw new PlsqlException("others", -20999, "RAISE outside an exception handler", "app");
    }
    const short = name.split(".").at(-1);
    if (Object.hasOwn(PREDEFINED, short))
      throw new PlsqlException(
        short,
        PREDEFINED[short],
        PREDEFINED_TEXT[short] ?? short.toUpperCase(),
        "app"
      );
    if (!scope.find((s) => s.exceptions.has(short) ? true : void 0))
      this.note("info", `exception ${name} is not declared locally; raised as a user-defined exception`);
    throw new PlsqlException(
      short,
      1,
      "User-Defined Exception",
      "app",
      "ORA-06510: PL/SQL: unhandled user-defined exception"
    );
  }
  assign(target2, value, scope) {
    switch (target2.kind) {
      case "bind":
        this.ctx.session.items[target2.name] = itemText(value);
        return;
      case "global":
        if (target2.name === "apex_application.g_print_success_message") {
          this.ctx.session.success = itemText(value) || void 0;
          return;
        }
        this.note("info", `assignment to ${target2.name} is ignored locally`);
        return;
      case "var": {
        const variable = scope.variable(target2.name);
        if (!variable) {
          if (target2.field) {
            this.note(
              "info",
              `assignment to package variable ${target2.name}.${target2.field} is ignored locally`
            );
            return;
          }
          throw new PlsqlUnsupported(`assignment to undeclared variable ${target2.name}`, this.line);
        }
        if (variable.constant) throw new PlsqlUnsupported(`assignment to constant ${target2.name}`, this.line);
        if (target2.field) {
          if (!(variable.value instanceof RecordValue)) variable.value = new RecordValue();
          variable.value.fields[target2.field.toUpperCase()] = value;
          return;
        }
        if (target2.index) {
          if (!(variable.value instanceof Collection)) variable.value = new Collection();
          const key = this.collectionKey(this.evaluate(target2.index, scope));
          variable.value.items.set(key, value);
          return;
        }
        if (variable.type === "record" && value instanceof RecordValue) {
          variable.value = new RecordValue({ ...value.fields });
          return;
        }
        variable.value = this.coerce(value, variable.type);
        return;
      }
    }
  }
  collectionKey(value) {
    const sql = toSql(value);
    return typeof sql === "number" ? sql : sql !== null && Number.isFinite(Number(sql)) ? Number(sql) : String(sql);
  }
  // ------------------------------------------------------------ SQL
  hostBinds() {
    const binds = this.renderer.binds(this.ctx.session, this.ctx.page);
    binds.REQUEST = this.ctx.request;
    for (const [key, value] of Object.entries(binds)) if (value === "") binds[key] = null;
    return binds;
  }
  query(sql, binds, maxRows) {
    try {
      return this.renderer.db.query(sql, { ...this.hostBinds(), ...binds }, maxRows);
    } catch (error) {
      throw engineError(error);
    }
  }
  cursorRows(statement, scope) {
    let sql = statement.sql;
    let cursorScope = scope;
    if (!sql) {
      const cursor = scope.find((s) => s.cursors.get(statement.cursor ?? ""));
      if (!cursor) throw new PlsqlUnsupported(`cursor ${statement.cursor} is not declared`, this.line);
      cursorScope = new Scope(scope);
      const args = statement.args ?? [];
      cursor.params.forEach((param, index) => {
        const arg = args.find((entry) => entry.name === param.name) ?? args.filter((entry) => !entry.name)[index];
        const value = arg ? this.evaluate(arg.expr, scope) : param.init ? this.evaluate(param.init, scope) : null;
        cursorScope.vars.set(param.name, { value, type: typeOf(param.type, scope), constant: true });
      });
      sql = cursor.sql;
    }
    const translated = this.translate(sql, cursorScope, "sql");
    return this.query(translated.sql, translated.binds, 1e4).rows;
  }
  selectInto(sql, targets, bulk, scope) {
    const translated = this.translate(sql, scope, "sql");
    const result = this.query(translated.sql, translated.binds, bulk ? 1e4 : 2);
    if (bulk) {
      targets.forEach((target2, index) => {
        const column = result.columns[index] ?? result.columns[0];
        const values = targets.length === 1 && result.columns.length > 1 ? result.rows.map((row) => new RecordValue(row)) : result.rows.map((row) => row[column] ?? null);
        this.assign(target2, Collection.of(values), scope);
      });
      this.#rowcount = result.rows.length;
      return;
    }
    if (!result.rows.length)
      throw new PlsqlException("no_data_found", 100, PREDEFINED_TEXT.no_data_found, "app");
    if (result.rows.length > 1)
      throw new PlsqlException("too_many_rows", -1422, PREDEFINED_TEXT.too_many_rows, "app");
    this.#rowcount = 1;
    this.assignRow(result.rows[0], result.columns, targets, scope);
  }
  assignRow(row, columns, targets, scope) {
    if (targets.length === 1 && targets[0].kind === "var" && !targets[0].field) {
      const variable = scope.variable(targets[0].name);
      if (variable?.type === "record" || columns.length > 1 && variable) {
        this.assign(targets[0], new RecordValue({ ...row }), scope);
        return;
      }
    }
    targets.forEach((target2, index) => {
      const column = columns[index];
      this.assign(target2, column === void 0 ? null : row[column] ?? null, scope);
    });
  }
  dml(sql, targets, scope) {
    const translated = this.translate(sql, scope, "sql");
    const binds = { ...this.hostBinds(), ...translated.binds };
    try {
      if (targets) {
        const result = this.renderer.db.query(translated.sql, binds, 1e4);
        this.#rowcount = result.rows.length;
        if (result.rows[0]) this.assignRow(result.rows[0], result.columns, targets, scope);
      } else {
        this.#rowcount = this.renderer.db.execute(translated.sql, binds).changes;
      }
    } catch (error) {
      throw engineError(error);
    }
  }
  // ------------------------------------------------------------ calls
  evalArgs(args, scope) {
    const positional = [];
    const named = {};
    for (const arg of args) {
      const value = this.evaluate(arg.expr, scope);
      if (arg.name) named[arg.name] = value;
      else positional.push(value);
    }
    return { positional, named };
  }
  call(chain, args, scope, asFunction) {
    const names = chain[0] === "sys" && chain.length > 1 ? chain.slice(1) : chain;
    const name = names.join(".");
    if (names.length === 1) {
      const local = scope.find((s) => s.routines.get(name));
      if (local) return this.invoke(local.routine, local.scope, args, scope);
      if (name === "raise_application_error") {
        const { positional: positional2, named: named2 } = this.evalArgs(args, scope);
        const code = Number(positional2[0] ?? named2.num ?? -2e4);
        const message = itemText(positional2[1] ?? named2.msg ?? null);
        throw new PlsqlException(`ora${code}`, code, message, "app", `ORA${code}: ${message}`);
      }
      if (COLLECTION_TYPES.has(name) || scope.find((s) => s.collectionTypes.has(name) ? true : void 0))
        return Collection.of(this.evalArgs(args, scope).positional);
    }
    if (COLLECTION_TYPES.has(name)) return Collection.of(this.evalArgs(args, scope).positional);
    const variable = names.length === 2 ? scope.variable(names[0]) : void 0;
    if (variable?.value instanceof Collection) return this.collectionMethod(variable, names[1], args, scope);
    const stub = findStub(name);
    if (!stub) {
      this.note("info", `${name} is not simulated locally; ${asFunction ? "returned NULL" : "skipped"}`);
      return null;
    }
    const { positional, named } = this.evalArgs(args, scope);
    const plain = (value) => value instanceof Collection ? value.values().map(plain) : value instanceof RecordValue ? null : value;
    const result = stub.fn(
      stubArgs(
        stub,
        positional.map(plain),
        Object.fromEntries(Object.entries(named).map(([key, value]) => [key, plain(value)]))
      ),
      this
    );
    if (Array.isArray(result)) return Collection.of(result);
    return result ?? null;
  }
  collectionMethod(variable, method, args, scope) {
    const collection = variable.value;
    const values = this.evalArgs(args, scope).positional;
    const numericKeys = collection.keys().filter((key) => typeof key === "number");
    switch (method) {
      case "extend": {
        const count = Number(values[0] ?? 1);
        let next = (numericKeys.at(-1) ?? 0) + 1;
        for (let index = 0; index < count; index += 1) collection.items.set(next++, null);
        return null;
      }
      case "delete":
        if (values.length) collection.items.delete(this.collectionKey(values[0]));
        else collection.items.clear();
        return null;
      case "trim": {
        const count = Number(values[0] ?? 1);
        for (const key of numericKeys.slice(-count)) collection.items.delete(key);
        return null;
      }
      case "exists":
        return collection.items.has(this.collectionKey(values[0] ?? null));
      case "count":
        return collection.items.size;
      case "first":
        return collection.keys()[0] ?? null;
      case "last":
        return collection.keys().at(-1) ?? null;
      case "next":
      case "prior": {
        const keys = collection.keys();
        const at = keys.indexOf(this.collectionKey(values[0] ?? null));
        return keys[method === "next" ? at + 1 : at - 1] ?? null;
      }
      default:
        throw new PlsqlUnsupported(`collection method ${method}`, this.line);
    }
  }
  invoke(routine, defining, args, caller) {
    if (this.#depth >= MAX_CALL_DEPTH) throw new PlsqlUnsupported("recursion depth exceeded", this.line);
    const local = new Scope(defining);
    const outs = [];
    routine.params.forEach((param, index) => {
      const arg = args.find((entry) => entry.name === param.name) ?? args.filter((entry) => !entry.name)[index];
      const type = typeOf(param.type, defining);
      const value = arg && param.mode !== "out" ? this.evaluate(arg.expr, caller) : !arg && param.init ? this.evaluate(param.init, local) : null;
      local.vars.set(param.name, { value: this.coerce(value, type), type, constant: param.mode === "in" });
      if (arg && param.mode !== "in") {
        outs.push({ target: targetOf(arg.expr), name: param.name });
      }
    });
    this.#depth += 1;
    const line = this.line;
    try {
      const signal = this.execBlock(routine.block, local);
      for (const out of outs) this.assign(out.target, local.vars.get(out.name)?.value ?? null, caller);
      if (routine.isFunction) {
        if (signal?.kind !== "return")
          throw new PlsqlException(
            "others",
            -6503,
            "ORA-06503: PL/SQL: Function returned without value",
            "app"
          );
        return signal.value;
      }
      return null;
    } finally {
      this.#depth -= 1;
      this.line = line;
    }
  }
  // ------------------------------------------------------------ expressions
  evaluate(tokens, scope) {
    if (!tokens.length) return null;
    const mode = tokens.some((token) => isWord(token, "select")) ? "sql" : "expr";
    const translated = this.translate(tokens, scope, mode);
    if (translated.direct) return translated.direct.value;
    const result = this.query(`select ${translated.sql}`, translated.binds, 1);
    const column = result.columns[0];
    const value = column === void 0 ? null : result.rows[0]?.[column] ?? null;
    return value === "" ? null : value;
  }
  /**
   * Turns PL/SQL expression tokens into SQLite text. Variables, record fields, collection
   * elements and package calls become bind values; `||` becomes null-safe `concat()`.
   */
  translate(tokens, scope, mode) {
    const binds = {};
    const pieces = [];
    const bind = (pre, value) => {
      const name = `PLV__${this.#bindSeq += 1}`;
      binds[name] = toSql(value);
      pieces.push({ pre, text: `:${name}`, direct: { value } });
    };
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const pre = index === 0 ? "" : token.pre;
      if (token.kind === "string") {
        pieces.push({ pre, text: token.value === "" ? "null" : token.text, token });
        continue;
      }
      if (token.kind === "bind") {
        const numeric3 = isOp(tokens[index + 1], ...COMPARISON2) && tokens[index + 2]?.kind === "number" || isOp(tokens[index - 1], ...COMPARISON2) && tokens[index - 2]?.kind === "number";
        const raw = this.ctx.session.items[token.value];
        pieces.push({
          pre,
          text: numeric3 ? `apex_local_num(${token.text})` : token.text,
          token,
          direct: { value: raw === void 0 || raw === "" ? this.builtinBind(token.value) ?? null : raw }
        });
        continue;
      }
      if (token.kind === "op" && token.value === "/") {
        pieces.push({ pre, text: "* 1.0 /", token });
        continue;
      }
      if (token.kind !== "word") {
        pieces.push({ pre, text: token.text, token });
        continue;
      }
      const names = [token.value];
      let end = index;
      while (isOp(tokens[end + 1], ".") && (tokens[end + 2]?.kind === "word" || tokens[end + 2]?.kind === "qident")) {
        names.push(tokens[end + 2].value.toLowerCase());
        end += 2;
      }
      let attribute;
      if (isOp(tokens[end + 1], "%") && tokens[end + 2]?.kind === "word") {
        attribute = tokens[end + 2].value;
        end += 2;
      }
      const callOpen = isOp(tokens[end + 1], "(") ? end + 1 : -1;
      const callClose = callOpen >= 0 ? matchParen(tokens, callOpen) : -1;
      const callArgs = callOpen >= 0 ? parseArgs(tokens.slice(callOpen + 1, callClose)) : [];
      const head = names[0];
      const variable = scope.variable(head);
      if (attribute) {
        if (head === "sql" || scope.find((s) => s.cursors.get(head))) {
          const count = this.#rowcount;
          bind(
            pre,
            attribute === "rowcount" ? count : attribute === "found" ? (count ?? 0) > 0 : attribute === "notfound" ? (count ?? 0) === 0 : false
          );
          index = end;
          continue;
        }
        throw new PlsqlUnsupported(`attribute ${head}%${attribute}`, token.line);
      }
      if (variable && names.length === 1) {
        if (variable.value instanceof Collection && callOpen >= 0) {
          const key = this.collectionKey(this.evaluate(tokens.slice(callOpen + 1, callClose), scope));
          if (!variable.value.items.has(key))
            throw new PlsqlException("no_data_found", 100, PREDEFINED_TEXT.no_data_found, "app");
          bind(pre, variable.value.items.get(key) ?? null);
          index = callClose;
          continue;
        }
        bind(pre, variable.value);
        index = end;
        continue;
      }
      if (variable && names.length >= 2) {
        if (variable.value instanceof RecordValue) {
          bind(pre, variable.value.fields[names[1].toUpperCase()] ?? null);
          index = end;
          continue;
        }
        if (variable.value instanceof Collection) {
          bind(pre, this.collectionMethod(variable, names[1], callArgs, scope));
          index = callOpen >= 0 ? callClose : end;
          continue;
        }
      }
      if (names.length === 1) {
        const routine = scope.find((s) => s.routines.get(head));
        const isCollectionType = COLLECTION_TYPES.has(head) || scope.find((s) => s.collectionTypes.has(head) ? true : void 0);
        if (routine || isCollectionType || head === "raise_application_error") {
          bind(pre, this.call(names, callArgs, scope, true));
          index = callOpen >= 0 ? callClose : end;
          continue;
        }
        if (mode === "expr" && head === "user") {
          bind(pre, this.ctx.session.user);
          continue;
        }
        pieces.push({ pre, text: token.text, token });
        continue;
      }
      const dropped = head === "sys" ? names.slice(1) : names;
      const full = dropped.join(".");
      const known = findStub(full) ?? (COLLECTION_TYPES.has(full) ? { sql: false } : void 0);
      if (mode === "sql" && (!known || callOpen >= 0 && known.sql)) {
        for (let part2 = index; part2 <= end; part2 += 1) {
          const piece = tokens[part2];
          pieces.push({ pre: part2 === index ? pre : piece.pre, text: piece.text, token: piece });
        }
        index = end;
        continue;
      }
      bind(pre, this.call(names, callArgs, scope, true));
      index = callOpen >= 0 ? callClose : end;
    }
    concatPieces(pieces);
    const meaningful = pieces.filter((piece) => piece.text.trim() !== "");
    const sql = pieces.map((piece, index) => (index === 0 ? "" : piece.pre) + piece.text).join("").trim();
    return {
      sql,
      binds,
      ...meaningful.length === 1 && meaningful[0].direct ? { direct: meaningful[0].direct } : {}
    };
  }
  builtinBind(name) {
    if (name === "REQUEST") return this.ctx.request || void 0;
    const value = this.renderer.builtin(this.ctx.session, this.ctx.page)[name];
    return value === "" ? void 0 : value;
  }
};
function targetOf(tokens) {
  const [first, second, third] = tokens;
  if (first?.kind === "bind") return { kind: "bind", name: first.value };
  if (first?.kind === "word" && isOp(second, ".") && third)
    return { kind: "var", name: first.value, field: third.value };
  if (first?.kind === "word") return { kind: "var", name: first.value };
  throw new PlsqlUnsupported("OUT argument must be a variable or bind", first?.line ?? 0);
}
function concatPieces(pieces) {
  const isText = (piece, text5) => piece?.token?.kind !== "string" && piece?.text.toLowerCase() === text5;
  const depthAt = () => {
    const depths = [];
    let depth = 0;
    for (const piece of pieces) {
      if (isText(piece, "(") || /\($/u.test(piece.text)) depth += 1;
      depths.push(depth);
      if (isText(piece, ")")) depth -= 1;
    }
    return depths;
  };
  const operandStart = (from) => {
    let index = from;
    if (isText(pieces[index], ")")) {
      let depth = 0;
      for (; index >= 0; index -= 1) {
        if (isText(pieces[index], ")")) depth += 1;
        else if (isText(pieces[index], "(") || /\($/u.test(pieces[index].text)) {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      if (isText(pieces[index], "(") && pieces[index - 1]?.token?.kind === "word") index -= 1;
    } else if (isText(pieces[index], "end")) {
      let depth = 0;
      for (; index >= 0; index -= 1) {
        if (isText(pieces[index], "end")) depth += 1;
        else if (isText(pieces[index], "case")) {
          depth -= 1;
          if (depth === 0) break;
        }
      }
    }
    while (isText(pieces[index - 1], ".") && pieces[index - 2]) index -= 2;
    return Math.max(0, index);
  };
  const operandEnd = (from) => {
    let index = from;
    while (isText(pieces[index + 1], ".") && pieces[index + 2]) index += 2;
    if (pieces[index]?.token?.kind === "word" && isText(pieces[index + 1], "(")) index += 1;
    if (isText(pieces[index], "(") || /\($/u.test(pieces[index]?.text ?? "")) {
      let depth = 0;
      for (; index < pieces.length; index += 1) {
        if (isText(pieces[index], "(") || /\($/u.test(pieces[index].text)) depth += 1;
        else if (isText(pieces[index], ")")) {
          depth -= 1;
          if (depth === 0) break;
        }
      }
    } else if (isText(pieces[index], "case")) {
      let depth = 0;
      for (; index < pieces.length; index += 1) {
        if (isText(pieces[index], "case")) depth += 1;
        else if (isText(pieces[index], "end")) {
          depth -= 1;
          if (depth === 0) break;
        }
      }
    }
    return Math.min(index, pieces.length - 1);
  };
  const render = (from, to) => pieces.slice(from, to + 1).map((piece, index) => (index === 0 ? "" : piece.pre) + piece.text).join("");
  for (let guard = 0; guard < 500; guard += 1) {
    const depths = depthAt();
    let target2 = -1;
    for (let index = 0; index < pieces.length; index += 1) {
      if (isText(pieces[index], "||") && (target2 < 0 || depths[index] > depths[target2])) target2 = index;
    }
    if (target2 < 0) return;
    const start = operandStart(target2 - 1);
    const operands = [render(start, target2 - 1)];
    let cursor = target2;
    let end = target2;
    while (isText(pieces[cursor], "||")) {
      end = operandEnd(cursor + 1);
      operands.push(render(cursor + 1, end));
      cursor = end + 1;
    }
    pieces.splice(start, end - start + 1, {
      pre: pieces[start].pre,
      text: `concat(${operands.join(", ")})`
    });
  }
}
function runPlsql(renderer, ctx, code, mode, owner2) {
  return new Interpreter(renderer, ctx, owner2).run(code, mode);
}

// packages/core/src/preview/extensions/server.ts
var owner = (component) => ({
  label: `${component.type} ${component.id}`,
  component: component.id
});
function sorted(components) {
  const sequence3 = (component) => Number(get(component.props, "execution.sequence") ?? get(component.props, "layout.sequence") ?? 0);
  return [...components].sort((a, b) => sequence3(a) - sequence3(b));
}
function report(renderer, ctx, who, result, consequence) {
  const failure = result.failure;
  if (!failure) return void 0;
  const where2 = failure.line ? ` (line ${failure.line})` : "";
  if (failure.kind === "app") {
    renderer.diagnose("info", `${who.label} raised: ${failure.message}${where2}`, ctx.pageId, who.component);
    return failure.message.replace(/^ORA-20\d{3}:\s*/u, "");
  }
  renderer.diagnose(
    failure.kind === "unsupported" ? "info" : "warning",
    `${who.label}: ${failure.kind === "unsupported" ? "PL/SQL not interpreted locally" : "PL/SQL failed"} \u2014 ${failure.message}${where2}; ${consequence}`,
    ctx.pageId,
    who.component
  );
  return void 0;
}
function run(renderer, ctx, code, mode, who) {
  rememberRenderer(renderer);
  return runPlsql(renderer, ctx, code, mode, who);
}
function processCode(process2) {
  return str(process2.props, "source.plsqlCode") || str(process2.props, "settings.plsqlCode") || str(process2.props, "source.code");
}
function executeCode(renderer, ctx, process2, point) {
  const who = owner(process2);
  const language = str(process2.props, "source.language");
  if (str(process2.props, "source.location") === "restEnabledSql" || /^javascript/iu.test(language)) {
    renderer.diagnose(
      "info",
      `${who.label}: ${language || "REST-enabled SQL"} code is not simulated locally; skipped`,
      ctx.pageId,
      process2.id
    );
    return { ran: false };
  }
  const code = processCode(process2);
  if (!code.trim()) return { ran: true };
  const result = run(renderer, ctx, code, "block", who);
  const errors = [...result.errors];
  if (!result.ok) {
    const message = report(renderer, ctx, who, result, "the process was skipped");
    if (message === void 0) return { ran: false };
    const custom = str(process2.props, "error.errorMessage");
    errors.push({
      type: "error",
      location: ["page"],
      message: custom ? custom.replaceAll("#SQLERRM#", result.failure.message).replaceAll("#SQLERRM_TEXT#", message) : message,
      unsafe: false
    });
  }
  if (errors.length) {
    if (point === "beforeHeader") {
      ctx.session.errors = [...ctx.session.errors ?? [], ...errors];
      return { ran: false };
    }
    return { ran: false, errors };
  }
  return { ran: true, ...result.redirectURL ? { redirectURL: result.redirectURL } : {} };
}
function conditionCode(condition) {
  const type = str(condition, "type");
  const body3 = str(condition, "plsqlFunctionBody") || str(condition, "functionBody");
  if (body3 && (type === "functionBody" || type.toLowerCase().includes("function") || !type))
    return { code: body3, mode: "functionBody" };
  const sql = str(condition, "sqlExpression");
  if (sql) return { code: sql, mode: "sqlExpression" };
  const expression = str(condition, "plsqlExpression") || str(condition, "expression1");
  if (expression) return { code: expression, mode: "plsqlExpression" };
  if (body3) return { code: body3, mode: "functionBody" };
  return void 0;
}
function evaluateCondition(renderer, ctx, condition) {
  const spec = conditionCode(condition);
  if (!spec) return void 0;
  const who = { label: `Server-side condition (${str(condition, "type")})` };
  const result = run(renderer, ctx, spec.code, spec.mode, who);
  if (!result.ok) {
    report(renderer, ctx, who, result, "treated as true");
    return true;
  }
  return truthy(result.value);
}
function validationMessage(validation) {
  return str(validation.props, "error.errorMessage", `${validation.id} failed`);
}
function validationItemValue(ctx, validation) {
  const item2 = str(validation.props, "validation.item").toUpperCase();
  return ctx.session.items[item2] ?? "";
}
function validationCode(validation, mode) {
  const props = validation.props;
  if (mode === "functionBody") return str(props, "validation.plsqlFunctionBody");
  if (mode === "sqlExpression") return str(props, "validation.sqlExpression");
  if (mode === "block")
    return str(props, "validation.plsqlCodeRaisingError") || str(props, "validation.plsqlCode");
  return str(props, "validation.plsqlExpression");
}
function runValidation(renderer, ctx, validation, mode) {
  const code = validationCode(validation, mode);
  if (!code.trim()) return void 0;
  const result = run(renderer, ctx, code, mode, owner(validation));
  return result;
}
var addedError = (result) => result.errors[0]?.message;
var booleanValidation = (mode) => (renderer, ctx, validation) => {
  const result = runValidation(renderer, ctx, validation, mode);
  if (!result) return void 0;
  if (!result.ok) {
    const message = report(renderer, ctx, owner(validation), result, "treated as passed");
    return message ?? null;
  }
  return addedError(result) ?? (truthy(result.value) ? null : validationMessage(validation));
};
function errorTextValidation(renderer, ctx, validation) {
  const result = runValidation(renderer, ctx, validation, "functionBody");
  if (!result) return void 0;
  if (!result.ok) return report(renderer, ctx, owner(validation), result, "treated as passed") ?? null;
  const text5 = itemText(result.value);
  return addedError(result) ?? (text5 ? text5 : null);
}
function plsqlErrorValidation(renderer, ctx, validation) {
  const result = runValidation(renderer, ctx, validation, "block");
  if (!result) return void 0;
  if (result.ok) return addedError(result) ?? null;
  const message = report(renderer, ctx, owner(validation), result, "treated as passed");
  if (message === void 0) return null;
  return str(validation.props, "error.errorMessage") || message;
}
function expressionValidation(renderer, ctx, validation) {
  const mode = str(validation.props, "validation.language") === "sql" || str(validation.props, "validation.sqlExpression") ? "sqlExpression" : "plsqlExpression";
  return booleanValidation(mode)(renderer, ctx, validation);
}
function queryValidation(found) {
  return (renderer, ctx, validation) => {
    const sql = str(validation.props, "validation.sqlQuery");
    if (!sql) return void 0;
    const binds = renderer.binds(ctx.session, ctx.page);
    for (const [key, value] of Object.entries(binds)) if (value === "") binds[key] = null;
    binds.REQUEST = ctx.request || null;
    try {
      const rows = renderer.db.query(sql, binds, 1).rows.length > 0;
      return rows === found ? null : validationMessage(validation);
    } catch (error) {
      renderer.diagnose(
        "warning",
        `validation ${validation.id}: query failed \u2014 ${error.message}; treated as passed`,
        ctx.pageId,
        validation.id
      );
      return null;
    }
  };
}
var itemCheck = (test) => (_renderer, ctx, validation) => test(validationItemValue(ctx, validation), validation) ? null : validationMessage(validation);
var compareValue = (validation) => str(validation.props, "validation.value");
var isDate = (value) => !Number.isNaN(new Date(value.replace(" ", "T")).getTime());
function dynamicContent(renderer, ctx, region) {
  const body3 = str(region.props, "source.plsqlFunctionBody");
  const code = body3 || str(region.props, "source.plsqlCode");
  const result = run(renderer, ctx, code, body3 ? "functionBody" : "block", owner(region));
  if (!result.ok) {
    const message = report(renderer, ctx, owner(region), result, "the region shows a placeholder");
    return `<div class="apex-local-unsupported"><span class="fa fa-info-circle" aria-hidden="true"></span> PL/SQL dynamic content \u201C${escapeHtml(str(region.props, "name", region.id))}\u201D could not run locally${message ? `: ${escapeHtml(message)}` : ""}.</div>`;
  }
  return result.output + (body3 ? itemText(result.value) : "");
}
var sharedOf = (renderer, type) => [...renderer.app.shared, ...renderer.app.app.children].filter((component) => component.type === type);
var startedSessions = /* @__PURE__ */ new WeakSet();
function appComputations(renderer, ctx, points) {
  for (const computation of sorted(sharedOf(renderer, "appComputation"))) {
    if (!points.includes(str(computation.props, "execution.point", "beforeHeader"))) continue;
    if (renderer.condition(ctx, computation.props)) renderer.compute(ctx, computation);
  }
}
function appProcesses(renderer, ctx, points, point) {
  const errors = [];
  for (const process2 of sorted(sharedOf(renderer, "appProcess"))) {
    if (!points.includes(str(process2.props, "execution.point", "beforeHeader"))) continue;
    if (!renderer.condition(ctx, process2.props)) continue;
    const type = str(process2.props, "type", "executeCode");
    if (type !== "executeCode") {
      renderer.diagnose(
        "info",
        `Application process ${process2.id} (${type}) is not simulated`,
        ctx.pageId,
        process2.id
      );
      continue;
    }
    errors.push(...executeCode(renderer, ctx, process2, point).errors ?? []);
  }
  return errors;
}
function pageComponentsAt(renderer, ctx, type, points) {
  return sorted(renderer.pageComponents(ctx, type)).filter(
    (component) => points.includes(
      str(component.props, "execution.point", type === "process" ? "processing" : "beforeHeader")
    )
  );
}
var authorizationCache = /* @__PURE__ */ new WeakMap();
function evaluateAuthorization(renderer, ctx, name) {
  const lower = name.toLowerCase();
  if (lower === "mustnotbepublicuser" || lower === "must_not_be_public_user") return 1;
  const scheme = sharedOf(renderer, "authorization").find(
    (component) => component.id.toLowerCase() === lower || str(component.props, "name").toLowerCase() === lower
  );
  if (!scheme) return void 0;
  const cache2 = authorizationCache.get(ctx.session) ?? /* @__PURE__ */ new Map();
  authorizationCache.set(ctx.session, cache2);
  const key = `${scheme.id}|${ctx.session.user}|${ctx.pageId}`;
  if (cache2.has(key)) return cache2.get(key);
  const type = str(scheme.props, "type");
  let allowed;
  const who = owner(scheme);
  if (/functionbody/iu.test(type)) {
    const result = run(renderer, ctx, str(scheme.props, "settings.plsqlFunctionBody"), "functionBody", who);
    if (result.ok) allowed = truthy(result.value) ? 1 : 0;
    else report(renderer, ctx, who, result, "access is allowed");
  } else if (/exists/iu.test(type)) {
    const result = run(
      renderer,
      ctx,
      `(select count(*) from (${str(scheme.props, "settings.sqlQuery")}))`,
      "sqlExpression",
      who
    );
    if (result.ok) allowed = Number(result.value) > 0 === !/not/iu.test(type) ? 1 : 0;
    else report(renderer, ctx, who, result, "access is allowed");
  } else if (/itemisnotnull|itemIsNull/iu.test(type)) {
    const value = ctx.session.items[str(scheme.props, "settings.item").toUpperCase()] ?? "";
    allowed = value !== "" === /notnull/iu.test(type) ? 1 : 0;
  }
  if (allowed !== void 0) cache2.set(key, allowed);
  if (allowed === 0)
    renderer.diagnose(
      "info",
      `Authorization scheme ${scheme.id} denies ${ctx.session.user} locally; the preview allows access anyway`,
      ctx.pageId,
      scheme.id
    );
  return allowed;
}
setAuthorizer((rt, name) => {
  if (rt && name) evaluateAuthorization(rt.renderer, rt.ctx, name);
  return 1;
});
function checkPageAuthorization(renderer, ctx) {
  const scheme = get(ctx.page.props, "security.authorizationScheme");
  const name = isRef(scheme) ? scheme.ref : typeof scheme === "string" ? scheme : "";
  if (name) evaluateAuthorization(renderer, ctx, name);
}
function itemSources(renderer, ctx) {
  for (const item2 of renderer.pageComponents(ctx, "pageItem")) {
    if (ref(item2.props, "source.formRegion")) continue;
    const type = str(item2.props, "source.type");
    if (![
      "expression",
      "functionBody",
      "sqlQuerySingleValue",
      "sqlQueryMultipleValues",
      "item",
      "staticValue"
    ].includes(type))
      continue;
    const name = item2.id.toUpperCase();
    const always = str(item2.props, "source.used") === "always";
    if (!always && (ctx.session.items[name] ?? "") !== "") continue;
    const who = { label: `item ${name} source`, component: name };
    let value;
    if (type === "staticValue")
      value = renderer.substitute(ctx.session, str(item2.props, "source.staticValue"), ctx.page, "RAW");
    else if (type === "item") value = ctx.session.items[str(item2.props, "source.item").toUpperCase()] ?? "";
    else {
      const body3 = str(item2.props, "source.plsqlFunctionBody");
      const sql = str(item2.props, "source.sqlQuery");
      const mode = type === "functionBody" ? "functionBody" : sql || str(item2.props, "source.sqlExpression") ? "sqlExpression" : "plsqlExpression";
      const code = type === "functionBody" ? body3 : sql ? type === "sqlQueryMultipleValues" ? `(select group_concat(v, ':') from (select (${sql}) as v))` : `(${sql})` : str(item2.props, "source.sqlExpression") || str(item2.props, "source.plsqlExpression");
      if (type === "sqlQueryMultipleValues") {
        try {
          const result = renderer.db.query(sql, renderer.binds(ctx.session, ctx.page));
          value = result.rows.map((row) => String(row[result.columns[0]] ?? "")).join(":");
        } catch (error) {
          renderer.diagnose(
            "warning",
            `${who.label}: query failed \u2014 ${error.message}`,
            ctx.pageId,
            name
          );
        }
      } else if (code) {
        const result = run(renderer, ctx, code, mode, who);
        if (result.ok) value = itemText(result.value);
        else report(renderer, ctx, who, result, "the item keeps its session value");
      }
    }
    if (value !== void 0) ctx.session.items[name] = value;
  }
}
var RENDER_POINTS = ["afterHeader", "beforeRegions", "afterRegions", "beforeFooter", "afterFooter"];
registerExtension({
  name: "server",
  code: (renderer, ctx, code, component) => {
    if (!code.trim()) return true;
    const who = owner(component);
    const result = run(renderer, ctx, code, "block", who);
    if (!result.ok) {
      const message = report(renderer, ctx, who, result, "skipped");
      if (message !== void 0) {
        ctx.session.errors = [
          ...ctx.session.errors ?? [],
          { type: "error", location: ["page"], message, unsafe: false }
        ];
      }
    }
    return result.ok;
  },
  expression: (renderer, ctx, expression, language) => {
    if (!expression.trim()) return void 0;
    const mode = language === "plsqlFunctionBody" ? "functionBody" : language;
    const who = { label: language === "plsqlFunctionBody" ? "PL/SQL function body" : `${language}` };
    const result = run(renderer, ctx, expression, mode, who);
    if (!result.ok) {
      report(renderer, ctx, who, result, "not evaluated");
      return void 0;
    }
    const value = result.value;
    return typeof value === "object" && value !== null ? itemText(value) : value;
  },
  processes: {
    executeCode: (renderer, ctx, process2, point) => executeCode(renderer, ctx, process2, point)
  },
  conditions: {
    expression: evaluateCondition,
    functionBody: evaluateCondition,
    plsqlExpression: evaluateCondition,
    sqlExpression: evaluateCondition,
    functionReturningBoolean: evaluateCondition,
    plsqlFunctionBody: evaluateCondition,
    itemIsNullOrZero: (_renderer, ctx, condition) => {
      const value = ctx.session.items[str(condition, "item").toUpperCase()] ?? "";
      return value === "" || value === "0";
    },
    itemIsNotNullAndNotZero: (_renderer, ctx, condition) => {
      const value = ctx.session.items[str(condition, "item").toUpperCase()] ?? "";
      return value !== "" && value !== "0";
    },
    "currentPage!=page": (_renderer, ctx, condition) => ctx.pageId !== str(condition, "page", str(condition, "value")),
    currentPageInList: (_renderer, ctx, condition) => (get(condition, "pages") instanceof Array ? get(condition, "pages") : str(condition, "value").split(",")).map(String).includes(ctx.pageId),
    currentPageNotInList: (_renderer, ctx, condition) => !(get(condition, "pages") instanceof Array ? get(condition, "pages") : str(condition, "value").split(",")).map(String).includes(ctx.pageId),
    textIsContainedInItem: (_renderer, ctx, condition) => (ctx.session.items[str(condition, "item").toUpperCase()] ?? "").includes(str(condition, "text"))
  },
  validations: {
    functionBodyReturningBoolean: booleanValidation("functionBody"),
    functionBody: errorTextValidation,
    functionBodyReturningErrorText: errorTextValidation,
    expression: expressionValidation,
    plsqlExpression: booleanValidation("plsqlExpression"),
    sqlExpression: booleanValidation("sqlExpression"),
    plsqlError: plsqlErrorValidation,
    rowsReturned: queryValidation(true),
    exists: queryValidation(true),
    noRowsReturned: queryValidation(false),
    notExists: queryValidation(false),
    itemMatchesRegexp: itemCheck((value, validation) => {
      if (value === "") return true;
      try {
        return new RegExp(str(validation.props, "validation.regexp"), "u").test(value);
      } catch {
        return true;
      }
    }),
    "item=Value": itemCheck((value, validation) => value === compareValue(validation)),
    "item!=Value": itemCheck((value, validation) => value !== compareValue(validation)),
    itemIsContainedInValue: itemCheck(
      (value, validation) => value !== "" && compareValue(validation).includes(value)
    ),
    itemIsNotContainedInValue: itemCheck(
      (value, validation) => value === "" || !compareValue(validation).includes(value)
    ),
    itemIsNotNullOrZero: itemCheck((value) => value !== "" && Number(value) !== 0),
    itemIsNotZero: itemCheck((value) => value === "" || Number(value) !== 0),
    itemContainsNoSpaces: itemCheck((value) => !/\s/u.test(value)),
    itemIsAlphanumeric: itemCheck((value) => /^[\p{L}\p{N}]*$/u.test(value)),
    itemIsAValidDate: itemCheck((value) => value === "" || isDate(value)),
    itemIsAValidTimestamp: itemCheck((value) => value === "" || isDate(value)),
    itemContainsOnlyCharsInValue: itemCheck(
      (value, validation) => [...value].every((char) => compareValue(validation).includes(char))
    ),
    itemContainsAtLeastOneOfCharsInValue: itemCheck(
      (value, validation) => [...compareValue(validation)].some((char) => value.includes(char))
    ),
    itemContainsNoneOfCharsInValue: itemCheck(
      (value, validation) => ![...compareValue(validation)].some((char) => value.includes(char))
    )
  },
  regions: {
    plSqlDynamicContent: dynamicContent,
    dynamicContent
  },
  routes: {
    /** Dynamic action Set Value from SQL or PL/SQL: `{ type, sqlQuery|plsqlExpression|plsqlFunctionBody, items }`. */
    "set-value": (renderer, session, request) => {
      try {
        const input = JSON.parse(request.body || "{}");
        const ctx = renderer.prepareSubmit(session, request.params.get("page") ?? "", "");
        for (const [name, value] of Object.entries(input.items ?? {}))
          session.items[name.toUpperCase()] = Array.isArray(value) ? value.join(":") : String(value ?? "");
        const type = input.type ?? "";
        const who = { label: `Set Value (${type || "server"})` };
        let result;
        if (/^sql/iu.test(type)) {
          const sql = input.sqlQuery ?? input.sqlStatement ?? "";
          result = run(renderer, ctx, `(${sql.trim().replace(/;\s*$/u, "")})`, "sqlExpression", who);
        } else if (/function/iu.test(type) || input.plsqlFunctionBody && !input.plsqlExpression) {
          result = run(renderer, ctx, input.plsqlFunctionBody ?? "", "functionBody", who);
        } else {
          result = run(renderer, ctx, input.plsqlExpression ?? "", "plsqlExpression", who);
        }
        if (!result.ok) {
          const message = report(renderer, ctx, who, result, "the value was not set");
          return {
            type: "json",
            body: JSON.stringify({ error: message ?? result.failure?.message ?? "failed" })
          };
        }
        return { type: "json", body: JSON.stringify({ value: itemText(result.value) }) };
      } catch (error) {
        return { status: 400, type: "json", body: JSON.stringify({ error: error.message }) };
      }
    }
  },
  point: (renderer, ctx, point) => {
    rememberRenderer(renderer);
    if (point === "beforeHeader") {
      const first = !startedSessions.has(ctx.session);
      startedSessions.add(ctx.session);
      const points = first ? ["newSession", "afterAuthentication", "beforeHeader"] : ["beforeHeader"];
      appComputations(renderer, ctx, points);
      const errors2 = appProcesses(renderer, ctx, points, "beforeHeader");
      checkPageAuthorization(renderer, ctx);
      return errors2;
    }
    if (point === "afterSubmit") {
      appComputations(renderer, ctx, ["afterSubmit"]);
      for (const computation of pageComponentsAt(renderer, ctx, "computation", ["afterSubmit"]))
        if (renderer.whenButton(ctx, computation.props) && renderer.condition(ctx, computation.props))
          renderer.compute(ctx, computation);
      return appProcesses(renderer, ctx, ["afterSubmit"], "afterSubmit");
    }
    if (point === "processing") return appProcesses(renderer, ctx, ["processing"], "processing");
    const errors = [];
    for (const header of RENDER_POINTS) {
      appComputations(renderer, ctx, [header]);
      errors.push(...appProcesses(renderer, ctx, [header], "beforeHeader"));
      for (const computation of pageComponentsAt(renderer, ctx, "computation", [header]))
        if (renderer.condition(ctx, computation.props)) renderer.compute(ctx, computation);
      for (const process2 of pageComponentsAt(renderer, ctx, "process", [header])) {
        if (!renderer.condition(ctx, process2.props)) continue;
        if (str(process2.props, "type") === "executeCode") executeCode(renderer, ctx, process2, "beforeHeader");
      }
      if (header === "afterHeader") itemSources(renderer, ctx);
    }
    return errors;
  },
  page: (renderer) => rememberRenderer(renderer)
});

// packages/core/src/preview/render.ts
var LOCAL_PREFIX = "/__apex";
var IMAGE_PREFIX = "/i/";
var MESSAGES = {
  APEX_PAGE_NOSCRIPT: "You must run this web page with JavaScript enabled.",
  UI_PAGE_SKIP_TO_CONTENT: "Skip to Main Content",
  "APEX.TEMPLATE.MAIN_NAV_LABEL": "Main Navigation",
  "APEX.TEMPLATE.APPLICATION": "Application",
  "APEX.SUCCESS": "Success",
  "APEX.SUCCESS_MESSAGE_HEADING": "Success Message",
  "APEX.ERROR_MESSAGE_HEADING": "Error Message",
  "APEX.ERROR": "Error",
  "APEX.INFORMATION": "Information",
  "APEX.GV.SELECTION_COUNT": "%0 rows selected",
  "APEX.GV.ROW_ADDED": "Added",
  "APEX.GV.ROW_CHANGED": "Changed",
  "APEX.GV.ROW_DELETED": "Deleted",
  "APEX.IG.SAVE": "Save",
  "APEX.IG.EDIT": "Edit",
  "APEX.IG.ADD_ROW": "Add Row",
  "APEX.IG.ACTIONS": "Actions",
  "APEX.IG.CHANGES_SAVED": "Changes saved",
  "APEX.DIALOG.SAVE": "Save",
  "APEX.DIALOG.HELP": "Help",
  "APEX.NO_DATA_FOUND": "No data found",
  "APEX.ITEM.TEXT.CHARACTER_COUNT": "%0 of %1",
  "APEX.ITEM_TYPE.YES_NO.YES_LABEL": "Yes",
  "APEX.ITEM_TYPE.YES_NO.NO_LABEL": "No",
  "APEX.ITEM_TYPE.CHECKBOX.CHECKED": "Checked",
  "APEX.ITEM_TYPE.CHECKBOX.UNCHECKED": "Unchecked",
  "APEX.REGION.COLLAPSE": "Collapse",
  "APEX.REGION.EXPAND": "Expand",
  "APEX.RDS.SHOW_ALL": "Show All",
  "APEX.TABS.NEXT": "Next",
  "APEX.TABS.PREVIOUS": "Previous",
  "APEX.MENU.OVERFLOW_LABEL": "More",
  "APEX.ACTIVE_STATE": "Active",
  "APEX.LOADING": "Loading",
  "APEX.GV.LOADING_INDICATOR": "Loading",
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
function sequence2(component) {
  return num(
    component.props,
    "layout.sequence",
    num(component.props, "execution.sequence", num(component.props, "sequence", 0))
  );
}
function bySequence2(components) {
  return [...components].sort((a, b) => sequence2(a) - sequence2(b));
}
function heading(name) {
  return name.toLowerCase().replace(/_/gu, " ").replace(/\b\w/gu, (char) => char.toUpperCase());
}
function iconClasses2(value) {
  return /(^|\s)fa-/u.test(value) && !/(^|\s)fa(\s|$)/u.test(value) ? `fa ${value}` : value;
}
var WRAPPER_CLASSES = {
  radioGroup: "radiogroup",
  checkboxGroup: "checkbox",
  checkbox: "single-checkbox",
  switch: "yes-no",
  selectList: "select-list",
  textarea: "textarea",
  displayOnly: "display-only",
  datePicker: "date-picker-apex",
  popupLov: "popup-lov",
  fileBrowse: "file",
  imageUpload: "image-upload",
  richTextEditor: "rich-text-editor",
  markdownEditor: "markdown-editor",
  shuttle: "shuttle",
  starRating: "star-rating",
  colorPicker: "color-picker",
  combobox: "combobox"
};
function strings5(values) {
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
  constructor(app, assets, db, options2 = {}) {
    this.app = app;
    this.assets = assets;
    this.db = db;
    this.theme = indexTheme(assets.theme);
    this.alias = slug(app.app.id || "app").toLowerCase();
    this.appId = app.substitutions.APP_ID ?? "100";
    this.options = { toolbar: options2.toolbar ?? true, sampleRows: options2.sampleRows ?? 8 };
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
  pageComponents(ctx, type) {
    const own = ctx.page.children.filter((child) => child.type === type);
    const global = ctx.page.id !== "0" ? this.app.pages.get("0")?.children.filter((child) => child.type === type) ?? [] : [];
    return [...own, ...global];
  }
  themeComponent() {
    const current = ref(this.app.app.props, "userInterface.currentTheme");
    return this.shared("theme", current) ?? this.app.shared.find((component) => component.type === "theme");
  }
  // ---------------------------------------------------------------- substitutions
  filePrefix() {
    return `${IMAGE_PREFIX}themes/theme_42/${this.assets.manifest.apexVersion.split(".").slice(0, 2).join(".")}/`;
  }
  /** `#APEX_FILES#`-style prefixes used in file URLs and HTML. */
  urls(value) {
    return value.replaceAll("#APEX_FILES#", IMAGE_PREFIX).replaceAll("#IMAGE_PREFIX#", IMAGE_PREFIX).replaceAll("#THEME_FILES#", this.filePrefix()).replaceAll("#THEME_IMAGES#", this.filePrefix()).replaceAll("#APP_FILES#", `${this.baseUrl}/files/static/v1/`).replaceAll("#APP_IMAGES#", `${this.baseUrl}/files/static/v1/`).replaceAll("#WORKSPACE_FILES#", `${this.baseUrl}/files/workspace/`).replaceAll("#WORKSPACE_IMAGES#", `${this.baseUrl}/files/workspace/`).replaceAll("#MIN_DIRECTORY#", "minified/").replaceAll("#MIN#", ".min").replaceAll("#APEX_VERSION#", APEX_FULL_VERSION).replaceAll("#APEX_BASE_VERSION#", APEX_FULL_VERSION.split(".").slice(0, 2).join(".")).replaceAll("#APP_VERSION#", "");
  }
  builtin(session, page) {
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
    const builtins = this.builtin(session, page);
    const replaced = value.replace(
      /&(?:"([^"]+)"|([A-Za-z][\w$#.]*?))(?:!([A-Z]+))?\./gu,
      (whole, quoted, plain, filter) => {
        const name = (quoted ?? plain ?? "").toUpperCase();
        let resolved;
        if (name.startsWith("APP_TEXT$")) resolved = MESSAGES[name.slice(9)] ?? name.slice(9);
        else if (name in session.items) resolved = session.items[name];
        else if (name in builtins) resolved = builtins[name];
        else if (this.isKnownItem(name)) resolved = "";
        if (resolved === void 0) return whole;
        return applyEscape(resolved, filter ?? defaultEscape);
      }
    );
    return this.urls(replaced);
  }
  isKnownItem(name) {
    for (const page of this.app.pages.values()) {
      if (page.children.some((child) => child.type === "pageItem" && child.id.toUpperCase() === name))
        return true;
    }
    return this.app.shared.some(
      (component) => component.type === "appItem" && component.id.toUpperCase() === name
    );
  }
  binds(session, page) {
    const builtins = this.builtin(session, page);
    return { ...builtins, ...session.items };
  }
  // ---------------------------------------------------------------- conditions
  condition(ctx, props, key = "serverSideCondition") {
    const condition = get(props, key);
    if (!isObject(condition)) return true;
    const type = str(condition, "type");
    const item2 = str(condition, "item").toUpperCase();
    const value = str(condition, "value");
    const itemValue = ctx.session.items[item2] ?? "";
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
        return value.split(",").map((part2) => part2.trim()).includes(request);
      case "requestIsNotContainedInValue":
        return !value.split(",").map((part2) => part2.trim()).includes(request);
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
        return ctx.pageId === (str(condition, "page") || value);
      case "currentPageIsInValue":
        return value.split(",").includes(ctx.pageId);
      default: {
        const extension = conditionHandler(type)?.(this, ctx, condition);
        if (extension !== void 0) return extension;
        this.diagnose(
          "info",
          `Server-side condition type "${type}" is not evaluated locally; treated as true`,
          ctx.pageId
        );
        return true;
      }
    }
  }
  whenButton(ctx, props) {
    const pressed = ref(props, "serverSideCondition.whenButtonPressed");
    if (!pressed) return true;
    const button = this.pageComponents(ctx, "button").find((candidate) => candidate.id === pressed);
    return (button ? str(button.props, "buttonName", button.id.toUpperCase()) : pressed.toUpperCase()) === ctx.request;
  }
  visible(ctx, component) {
    return this.condition(ctx, component.props);
  }
  // ---------------------------------------------------------------- links
  targetUrl(ctx, target2, row) {
    if (typeof target2 === "string") return { href: this.substitute(ctx.session, target2, ctx.page, "RAW") };
    if (!isObject(target2)) return { href: "#" };
    const rowValue = (value) => value.replace(
      /#([A-Z0-9_$]+)#/gu,
      (whole, name) => row && name in row ? String(row[name] ?? "") : whole
    );
    if (str(target2, "type") === "url" || target2.url !== void 0) {
      const url2 = rowValue(str(target2, "url"));
      return { href: url2 === "separator" ? "separator" : this.substitute(ctx.session, url2, ctx.page, "RAW") };
    }
    const pageKey = this.substitute(ctx.session, rowValue(str(target2, "page", ctx.pageId)), ctx.page, "RAW");
    const page = this.findPage(pageKey);
    const parameters = new URLSearchParams();
    const items = get(target2, "items");
    if (isObject(items)) {
      for (const [name, value] of Object.entries(items)) {
        const raw = typeof value === "string" ? value : isRef(value) ? `&${value.ref}.` : String(value);
        parameters.set(name.toLowerCase(), this.substitute(ctx.session, rowValue(raw), ctx.page, "RAW"));
      }
    }
    const clear = str(target2, "clearCache");
    if (clear) parameters.set("clear", clear);
    const request = str(target2, "request");
    if (request) parameters.set("request", request);
    const query = parameters.toString();
    const base = page ? this.pagePath(page) : `${this.baseUrl}/${pageKey}`;
    return { href: `${base}${query ? `?${query}` : ""}`, ...page ? { page } : {} };
  }
  isDialog(page) {
    const mode = str(page?.props ?? {}, "appearance.pageMode");
    return mode === "modalDialog" || mode === "nonModalDialog" || mode === "drawer";
  }
  pageTemplateId(page) {
    const theme = this.themeComponent();
    if (this.isDialog(page)) {
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
  link(ctx, target2, row, triggeringElement = "this") {
    const { href, page } = this.targetUrl(ctx, target2, row);
    if (!page || !this.isDialog(page)) return href;
    return `javascript:${this.dialogJs(page, href, triggeringElement)}`;
  }
  dialogJs(page, url2, triggeringElement) {
    const template = this.theme.pages.get(this.pageTemplateId(page)) ?? this.theme.pages.get("modal-dialog");
    const options2 = strings5(list(page.props, "appearance.templateOptions"));
    const dialogClasses = options2.filter((option) => option.startsWith("js-dialog-class-")).map((option) => option.slice(16));
    const pageClasses = options2.filter(
      (option) => option !== "#DEFAULT#" && !option.startsWith("js-dialog-class-")
    );
    const attributes = [];
    if (get(page.props, "dialog.resizable") !== void 0)
      attributes.push(`resizable:${bool(page.props, "dialog.resizable", true)}`);
    if (get(page.props, "dialog.chained") !== void 0)
      attributes.push(`chained:${bool(page.props, "dialog.chained", true)}`);
    const literal2 = (value) => `'${escapeJs(value)}'`;
    const code = text(template, "dialog_js_init_code") || "apex.navigation.dialog(#PAGE_URL#,{title:#TITLE#,height:#DIALOG_HEIGHT#,width:#DIALOG_WIDTH#,maxWidth:#DIALOG_MAX_WIDTH#,modal:#IS_MODAL#,dialog:#DIALOG#,#DIALOG_ATTRIBUTES#},#PAGE_CSS_CLASSES#,#TRIGGERING_ELEMENT#)";
    return fill(code, {
      PAGE_URL: literal2(url2),
      TITLE: literal2(str(page.props, "title", str(page.props, "name"))),
      DIALOG_HEIGHT: literal2(str(page.props, "dialog.height", text(template, "dialog_height") || "auto")),
      DIALOG_WIDTH: literal2(str(page.props, "dialog.width", text(template, "dialog_width") || "720")),
      DIALOG_MAX_WIDTH: literal2(
        str(page.props, "dialog.maxWidth", text(template, "dialog_max_width") || "960")
      ),
      IS_MODAL: String(str(page.props, "appearance.pageMode") !== "nonModalDialog"),
      DIALOG: "null",
      DIALOG_CSS_CLASSES: literal2(dialogClasses.join(" ")),
      DIALOG_ATTRIBUTES: attributes.join(","),
      PAGE_CSS_CLASSES: literal2(pageClasses.join(" ")),
      TRIGGERING_ELEMENT: triggeringElement
    }).replace(/,\}/gu, "}");
  }
  // ---------------------------------------------------------------- LOVs
  lov(ctx, spec, owner2) {
    if (!isObject(spec)) return [];
    const type = str(spec, "type");
    if (type === "sharedComponent" || ref(spec, "lov")) {
      const shared = this.shared("lov", ref(spec, "lov"));
      if (!shared) {
        this.diagnose("warning", `LOV @${ref(spec, "lov")} not found`, ctx.pageId, owner2);
        return [];
      }
      return this.sharedLov(ctx, shared);
    }
    if (type === "staticValues" || spec.staticValues !== void 0)
      return this.staticLov(str(spec, "staticValues"));
    if (type === "sqlQuery" || spec.sqlQuery !== void 0)
      return this.queryLov(ctx, str(spec, "sqlQuery"), void 0, void 0, owner2);
    return [];
  }
  staticLov(value) {
    const body3 = value.replace(/^STATIC2?:/u, "");
    if (!body3) return [];
    return body3.split(",").map((entry) => {
      const [display, returned] = entry.split(";");
      return { d: display ?? "", r: returned ?? display ?? "" };
    });
  }
  queryLov(ctx, sql, display, returned, owner2) {
    try {
      const result = this.db.query(sql, this.binds(ctx.session, ctx.page), 5e3);
      const displayColumn = display?.toUpperCase() ?? result.columns[0];
      const returnColumn = returned?.toUpperCase() ?? result.columns[1] ?? displayColumn;
      return result.rows.map((row) => ({
        d: String(row[displayColumn] ?? ""),
        r: String(row[returnColumn] ?? "")
      }));
    } catch (error) {
      this.diagnose("warning", `LOV query failed: ${error.message}`, ctx.pageId, owner2);
      return [];
    }
  }
  sharedLov(ctx, lov) {
    const entries = bySequence2(lov.children.filter((child) => child.type === "entry"));
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
      this.ensureTable(
        ctx,
        table,
        [display, returned].filter((value) => Boolean(value)).map((name) => ({ name, type: "varchar2" }))
      );
    return this.queryLov(ctx, sql, display, returned, `lov ${lov.id}`);
  }
  // ---------------------------------------------------------------- data
  /** Creates an empty-but-plausible table so a design can be previewed before real DDL exists. */
  ensureTable(ctx, table, columns) {
    const name = table.replaceAll('"', "");
    if (this.db.tableExists(name)) return false;
    const unique = /* @__PURE__ */ new Map();
    for (const column of [...this.tableHints(name), ...columns]) {
      if (!column.name) continue;
      const key = column.name.toUpperCase();
      const known = unique.get(key);
      if (!known) unique.set(key, column);
      else
        unique.set(key, {
          ...known,
          pk: known.pk || column.pk,
          label: known.label ?? column.label,
          max: known.max && column.max ? Math.min(known.max, column.max) : known.max ?? column.max,
          type: /varchar|char|^$/iu.test(known.type) && column.type ? column.type : known.type
        });
    }
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
          const label = (column.label ?? "").replace(/<[^>]*>/gu, "").trim() || heading(key);
          const room = column.max ? column.max - String(index).length - 1 : label.length;
          values[key] = room > 0 ? `${label.slice(0, room).trim()} ${index}` : String(index).slice(0, column.max);
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
  tableHints(table) {
    const hints = [];
    for (const page of this.app.pages.values()) {
      const regions = page.children.filter(
        (child) => child.type === "region" && str(child.props, "source.tableName").toUpperCase() === table.toUpperCase()
      );
      for (const region of regions)
        for (const item2 of page.children.filter(
          (child) => child.type === "pageItem" && ref(child.props, "source.formRegion") === region.id
        )) {
          const column = str(item2.props, "source.column");
          if (!column) continue;
          const itemType = str(item2.props, "type");
          hints.push({
            name: column,
            type: itemType === "numberField" ? "number" : itemType === "datePicker" ? "date" : str(item2.props, "source.dataType", "varchar2"),
            pk: bool(item2.props, "source.primaryKey", false),
            label: str(item2.props, "label.label") || void 0,
            max: num(item2.props, "validation.maxLength", 0) || void 0
          });
        }
    }
    const mentions = new RegExp(`\\b"?${table.replace(/[^\w$#]/gu, "")}"?\\b`, "iu");
    for (const page of this.app.pages.values()) {
      for (const region of page.children.filter((child) => child.type === "region")) {
        const source = str(region.props, "source.tableName") || str(region.props, "source.sqlQuery");
        if (!source || !mentions.test(source)) continue;
        for (const column of region.children.filter((child) => child.type === "column")) {
          const columnType = str(column.props, "type");
          hints.push({
            name: str(column.props, "source.column", column.id),
            type: columnType === "numberField" ? "number" : columnType === "datePicker" ? "date" : str(column.props, "source.dataType", "varchar2"),
            pk: bool(column.props, "source.primaryKey", false),
            label: str(column.props, "heading.heading") || void 0,
            max: num(column.props, "validation.maxLength", 0) || void 0
          });
        }
      }
    }
    return hints;
  }
  regionColumns(ctx, region) {
    const columns = region.children.filter((child) => child.type === "column").map((column) => ({
      name: column.id,
      type: str(column.props, "source.dataType", "varchar2"),
      label: str(column.props, "heading.heading") || void 0,
      pk: bool(column.props, "source.primaryKey", false)
    }));
    const items = this.pageComponents(ctx, "pageItem").filter(
      (item2) => ref(item2.props, "source.formRegion") === region.id && str(item2.props, "source.column")
    ).map((item2) => ({
      name: str(item2.props, "source.column"),
      type: str(item2.props, "source.dataType", "varchar2"),
      pk: bool(item2.props, "source.primaryKey", false),
      label: str(item2.props, "label.label") || void 0,
      max: num(item2.props, "validation.maxLength", 0) || void 0
    }));
    return [...items, ...columns];
  }
  regionSql(ctx, region) {
    const source = region.props.source;
    if (!isObject(source)) return void 0;
    const table = str(source, "tableName");
    const where2 = str(source, "whereClause") || str(source, "where");
    const orderBy2 = str(source, "orderByClause") || str(source, "orderBy");
    let sql = str(source, "sqlQuery");
    if (!sql && table) {
      this.ensureTable(ctx, table, this.regionColumns(ctx, region));
      sql = `select * from ${table}`;
    }
    if (!sql) return void 0;
    if (where2) sql = `select * from (${sql}) where ${where2}`;
    sql = filterRegionSql(this, ctx, region, sql);
    if (orderBy2) sql = `${sql} order by ${orderBy2}`;
    return sql;
  }
  query(ctx, region, sql, maxRows = 1e4) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return this.db.query(sql, this.binds(ctx.session, ctx.page), maxRows);
      } catch (error) {
        const message = error.message;
        if (attempt < 25 && this.repairSchema(ctx, region, sql, message)) continue;
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
  repairSchema(ctx, region, sql, message) {
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
      return this.ensureTable(ctx, missingTable, this.regionColumns(ctx, region));
    }
    const missingColumn = /no such column: (?:"?[\w$#]+"?\.)?"?([\w$#]+)"?/iu.exec(message)?.[1];
    if (!missingColumn) return false;
    const column = missingColumn.toUpperCase();
    const referenced = [...this.#autoTables].filter(
      (table) => new RegExp(`\\b"?${table}"?\\b`, "iu").test(sql)
    );
    for (const table of referenced) {
      if (this.db.tableColumns(table).some((existing) => existing.name === column)) continue;
      const numeric3 = /(_ID|ID|_NO|COUNT|TOTAL|AMOUNT|PRICE|QTY|QUANTITY|SALARY|SAL|VALUE|NUMBER)$/u.test(
        column
      );
      const date = /(DATE|_ON|_AT|TIMESTAMP)$/u.test(column);
      this.db.execute(
        `alter table "${table}" add column "${column}" ${numeric3 ? "NUMBER" : date ? "DATE" : "VARCHAR2(4000)"}`
      );
      this.db.execute(
        `update "${table}" set "${column}" = ${numeric3 ? "rowid" : date ? "date('now', '-' || rowid || ' days')" : `'${heading(column).replaceAll("'", "''")} ' || rowid`}`
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
    for (const item2 of this.pageComponents(ctx, "pageItem")) {
      const name = item2.id.toUpperCase();
      if ((session.items[name] ?? "") !== "") continue;
      const type = str(item2.props, "default.type");
      const value = str(item2.props, "default.staticValue") || str(item2.props, "default.value");
      if (value && (type === "" || type === "static" || type === "staticValue"))
        session.items[name] = this.substitute(session, value, page, "RAW");
      else if (type === "item")
        session.items[name] = session.items[str(item2.props, "default.item").toUpperCase()] ?? "";
      else if (type === "functionBody" || type === "sqlQuerySingleValue" || type === "expression" && str(item2.props, "default.plsqlExpression")) {
        const code = str(item2.props, "default.plsqlFunctionBody") || str(item2.props, "default.plsqlExpression") || str(item2.props, "default.sqlQuerySingleValue");
        const language = type === "functionBody" ? "plsqlFunctionBody" : type === "expression" ? "plsqlExpression" : "sqlExpression";
        const result = evaluateExpression(
          this,
          ctx,
          type === "sqlQuerySingleValue" ? `(${code})` : code,
          language
        );
        if (result === void 0) this.diagnose("info", `Default for ${name} not evaluated`, page.id, name);
        else session.items[name] = result === null || result === false ? "" : String(result);
      } else if (type === "sqlQuery" || type === "expression") {
        const sql = str(item2.props, "default.sqlQuery") || str(item2.props, "default.sqlExpression");
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
    const pointErrors = runPointExtensions(this, ctx, "beforeHeader");
    if (pointErrors.length) session.errors = [...session.errors ?? [], ...pointErrors];
    for (const computation of bySequence2(this.pageComponents(ctx, "computation"))) {
      const point = str(computation.props, "execution.point", "beforeHeader");
      if (point === "beforeHeader" && this.condition(ctx, computation.props)) this.compute(ctx, computation);
    }
    for (const process2 of bySequence2(this.pageComponents(ctx, "process"))) {
      if (str(process2.props, "execution.point") !== "beforeHeader" || !this.condition(ctx, process2.props))
        continue;
      const type = str(process2.props, "type");
      const extension = processHandler(type);
      if (extension) extension(this, ctx, process2, "beforeHeader", void 0);
      else if (type === "formInitialization") this.initializeForm(ctx, ref(process2.props, "formRegion"));
      else if (type === "clearSessionState") this.clearPage(ctx);
      else if (type === "executeCode") this.runCode(ctx, process2);
    }
    const headerErrors = runPointExtensions(this, ctx, "afterHeader");
    if (headerErrors.length) session.errors = [...session.errors ?? [], ...headerErrors];
    return ctx;
  }
  compute(ctx, computation) {
    const item2 = (str(computation.props, "itemName") || str(computation.props, "item") || computation.id).toUpperCase();
    const type = str(computation.props, "computation.type", str(computation.props, "type"));
    if (type === "item") {
      ctx.session.items[item2] = ctx.session.items[str(computation.props, "computation.itemName").toUpperCase()] ?? "";
      return;
    }
    if (type === "expression" || type === "functionBody" || type === "sqlQueryMultipleValues") {
      const code = str(computation.props, "computation.plsqlFunctionBody") || str(computation.props, "computation.plsqlExpression") || str(computation.props, "computation.sqlExpression");
      const language = type === "functionBody" ? "plsqlFunctionBody" : str(computation.props, "computation.sqlExpression") ? "sqlExpression" : "plsqlExpression";
      if (type === "sqlQueryMultipleValues") {
        try {
          const result2 = this.db.query(
            str(computation.props, "computation.sqlQuery"),
            this.binds(ctx.session, ctx.page)
          );
          ctx.session.items[item2] = result2.rows.map((row) => String(row[result2.columns[0]] ?? "")).join(":");
        } catch (error) {
          this.diagnose(
            "warning",
            `Computation ${computation.id} failed: ${error.message}`,
            ctx.pageId
          );
        }
        return;
      }
      const result = code ? evaluateExpression(this, ctx, code, language) : void 0;
      if (result !== void 0) {
        ctx.session.items[item2] = result === null || result === false ? "" : String(result);
        return;
      }
    }
    const value = str(computation.props, "computation.staticValue") || str(computation.props, "computation.value");
    const sql = str(computation.props, "computation.sqlQuery");
    if (type.startsWith("static") || !sql && value)
      ctx.session.items[item2] = this.substitute(ctx.session, value, ctx.page, "RAW");
    else if (sql) {
      try {
        ctx.session.items[item2] = String(this.db.scalar(sql, this.binds(ctx.session, ctx.page)) ?? "");
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
  formItems(ctx, regionId) {
    return this.pageComponents(ctx, "pageItem").filter(
      (item2) => ref(item2.props, "source.formRegion") === regionId && str(item2.props, "source.column")
    );
  }
  initializeForm(ctx, regionId) {
    const region = this.pageComponents(ctx, "region").find((candidate) => candidate.id === regionId);
    if (!region) return;
    const table = str(region.props, "source.tableName");
    const items = this.formItems(ctx, regionId);
    const keys = items.filter((item2) => bool(item2.props, "source.primaryKey", false));
    if (!table || !keys.length) return;
    this.ensureTable(ctx, table, this.regionColumns(ctx, region));
    if (keys.some((key) => !ctx.session.items[key.id.toUpperCase()])) {
      for (const item2 of items) if (!keys.includes(item2)) delete ctx.session.items[item2.id.toUpperCase()];
      return;
    }
    const where2 = keys.map((key) => `"${str(key.props, "source.column").toUpperCase()}" = :${key.id.toUpperCase()}`).join(" and ");
    const result = this.query(ctx, region, `select * from ${table} where ${where2}`, 1);
    const row = result.rows[0];
    if (!row) return;
    for (const item2 of items) {
      const value = row[str(item2.props, "source.column").toUpperCase()];
      ctx.session.items[item2.id.toUpperCase()] = value === null || value === void 0 ? "" : String(value);
    }
  }
  clearPage(ctx) {
    for (const item2 of ctx.page.children.filter((child) => child.type === "pageItem"))
      delete ctx.session.items[item2.id.toUpperCase()];
  }
  /** PL/SQL cannot run here; bodies made only of SQL DML are executed, anything else is reported. */
  runCode(ctx, process2, codeKey = "source.plsqlCode") {
    const code = str(process2.props, codeKey) || str(process2.props, "settings.plsqlCode") || str(process2.props, "source.code");
    const handled = runCodeExtensions(this, ctx, code, process2);
    if (handled !== void 0) return handled;
    const body3 = code.trim().replace(/^begin\b/iu, "").replace(/\bend\s*;\s*$/iu, "").trim();
    const statements = body3 ? splitScript(body3.endsWith(";") ? body3 : `${body3};`) : [];
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
    return Boolean(page) && this.pageTemplateId(page) === "login";
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
    const pressed = this.pageComponents(ctx, "button").find(
      (button) => str(button.props, "buttonName", button.id.toUpperCase()) === request
    );
    const submitErrors = runPointExtensions(this, ctx, "afterSubmit");
    if (submitErrors.length) return { errors: submitErrors };
    const validate = pressed ? bool(pressed.props, "behavior.executeValidations", true) : true;
    const errors = validate ? this.validate(ctx) : [];
    if (errors.length) return { errors };
    const processingErrors = runPointExtensions(this, ctx, "processing");
    if (processingErrors.length) return { errors: processingErrors };
    let closeDialog = false;
    let success = "";
    for (const process2 of bySequence2(this.pageComponents(ctx, "process"))) {
      const point = str(process2.props, "execution.point", "processing");
      if (point !== "processing" && point !== "afterSubmit" && point !== "onSubmitBeforeComputations")
        continue;
      if (!this.whenButton(ctx, process2.props) || !this.condition(ctx, process2.props)) continue;
      const type = str(process2.props, "type");
      let ran = true;
      const extension = processHandler(type);
      if (extension) {
        const result = extension(this, ctx, process2, "submit", pressed);
        if (result.errors?.length) return { errors: result.errors };
        if (result.redirectURL) return { redirectURL: result.redirectURL };
        ran = result.ran;
        if (result.closeDialog) closeDialog = true;
      } else if (type === "formAutoRowProcessing")
        ran = this.processForm(ctx, ref(process2.props, "formRegion"), pressed);
      else if (type === "closeDialog") closeDialog = true;
      else if (type === "clearSessionState") this.clearPage(ctx);
      else if (type === "executeCode") ran = this.runCode(ctx, process2);
      else if (type === "formInitialization") this.initializeForm(ctx, ref(process2.props, "formRegion"));
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
    for (const branch of bySequence2(this.pageComponents(ctx, "branch"))) {
      if (!this.whenButton(ctx, branch.props) || !this.condition(ctx, branch.props)) continue;
      const branchType = str(branch.props, "behavior.type");
      if (branchType === "plsqlProcedure") {
        runCodeExtensions(this, ctx, str(branch.props, "behavior.plsqlCode"), branch);
        continue;
      }
      if (branchType === "functionReturningPage" || branchType === "functionReturningUrl") {
        const result = evaluateExpression(
          this,
          ctx,
          str(branch.props, "behavior.plsqlFunctionBody"),
          "plsqlFunctionBody"
        );
        if (result === void 0 || result === null || result === "") continue;
        const page = branchType === "functionReturningPage" ? this.findPage(String(result)) : void 0;
        return {
          redirectURL: page ? this.pagePath(page) : this.substitute(session, String(result), ctx.page, "RAW")
        };
      }
      if (branchType === "page" || branchType === "pageIdentifiedByItem") {
        const key = branchType === "page" ? str(branch.props, "behavior.pageNumber") : session.items[str(branch.props, "behavior.item").toUpperCase()] ?? "";
        const page = this.findPage(key);
        if (page) return { redirectURL: this.pagePath(page) };
        continue;
      }
      const target2 = get(branch.props, "behavior.target");
      if (target2 !== void 0) return { redirectURL: this.targetUrl(ctx, target2).href };
    }
    if (pressed && str(pressed.props, "behavior.action") === "redirectThisApp") {
      return { redirectURL: this.targetUrl(ctx, get(pressed.props, "behavior.target")).href };
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
  label(item2) {
    return str(item2.props, "label.label", heading(item2.id.replace(/^P\d+_/u, "")));
  }
  validate(ctx) {
    const errors = [];
    const add = (message, item2) => errors.push({
      type: "error",
      location: item2 ? ["inline", "page"] : ["page"],
      ...item2 ? { pageItem: item2 } : {},
      message,
      unsafe: false
    });
    for (const item2 of this.pageComponents(ctx, "pageItem")) {
      if (!this.visible(ctx, item2) || !this.regionVisible(ctx, ref(item2.props, "layout.region"))) continue;
      const name = item2.id.toUpperCase();
      const value = ctx.session.items[name] ?? "";
      const label = this.label(item2);
      if (bool(item2.props, "validation.valueRequired", false) && value === "")
        add(`${label} must have some value.`, name);
      const max = num(item2.props, "validation.maxLength", 0);
      if (max && value.length > max) add(`${label} exceeds the maximum length of ${max}.`, name);
      if (str(item2.props, "type") === "numberField" && value !== "" && // Number items submit their formatted text (format mask), as APEX does.
      !Number.isFinite(Number(value.replace(/[,\s$€£¥%]/gu, ""))))
        add(`${label} must be Numeric.`, name);
    }
    for (const validation of bySequence2(this.pageComponents(ctx, "validation"))) {
      if (!this.whenButton(ctx, validation.props) || !this.condition(ctx, validation.props)) continue;
      const type = str(validation.props, "validation.type");
      const item2 = str(validation.props, "validation.item").toUpperCase();
      const message = str(validation.props, "error.errorMessage", `${validation.id} failed`);
      const value = ctx.session.items[item2] ?? "";
      const associated = str(validation.props, "error.associatedItem").toUpperCase() || item2 || void 0;
      let failed;
      const extension = validationHandler(type)?.(this, ctx, validation);
      if (extension !== void 0) {
        if (extension !== null) add(this.substitute(ctx.session, extension, ctx.page, "RAW"), associated);
        continue;
      }
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
  regionVisible(ctx, regionId) {
    if (!regionId) return true;
    const region = this.pageComponents(ctx, "region").find((candidate) => candidate.id === regionId);
    if (!region) return true;
    return this.visible(ctx, region) && this.regionVisible(ctx, ref(region.props, "layout.parentRegion"));
  }
  processForm(ctx, regionId, pressed) {
    const region = this.pageComponents(ctx, "region").find((candidate) => candidate.id === regionId);
    if (!region) return false;
    const table = str(region.props, "source.tableName");
    if (!table) {
      this.diagnose("info", `Form ${regionId} has no table; DML skipped`, ctx.pageId, regionId);
      return false;
    }
    this.ensureTable(ctx, table, this.regionColumns(ctx, region));
    const items = this.formItems(ctx, regionId).filter(
      (item2) => !bool(item2.props, "source.queryOnly", false) || bool(item2.props, "source.primaryKey", false)
    );
    const keys = items.filter((item2) => bool(item2.props, "source.primaryKey", false));
    const columns = new Set(this.db.tableColumns(table).map((column2) => column2.name));
    const action = pressed ? str(pressed.props, "behavior.databaseAction") : "";
    const request = ctx.request;
    const operation = action === "insert" || /^(CREATE|INSERT|ADD)$/u.test(request) ? "insert" : action === "update" || /^(SAVE|APPLY CHANGES|UPDATE)$/u.test(request) ? "update" : action === "delete" || /^(DELETE|REMOVE)$/u.test(request) ? "delete" : "";
    if (!operation) return false;
    const binds = this.binds(ctx.session, ctx.page);
    const column = (item2) => str(item2.props, "source.column").toUpperCase();
    const where2 = keys.map((key) => `"${column(key)}" = :${key.id.toUpperCase()}`).join(" and ");
    try {
      if (operation === "insert") {
        const values = items.filter(
          (item2) => columns.has(column(item2)) && !(keys.includes(item2) && !ctx.session.items[item2.id.toUpperCase()])
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
          `insert into ${table} (${values.map((item2) => `"${column(item2)}"`).join(", ")}) values (${values.map((item2) => `:${item2.id.toUpperCase()}`).join(", ")})`,
          binds
        );
        ctx.session.success = "Action Processed.";
      } else if (operation === "update" && where2) {
        const values = items.filter((item2) => !keys.includes(item2) && columns.has(column(item2)));
        if (values.length)
          this.db.execute(
            `update ${table} set ${values.map((item2) => `"${column(item2)}" = :${item2.id.toUpperCase()}`).join(", ")} where ${where2}`,
            binds
          );
        ctx.session.success = "Action Processed.";
      } else if (operation === "delete" && where2) {
        this.db.execute(`delete from ${table} where ${where2}`, binds);
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
    this.runCode(ctx, pseudo);
    return Object.fromEntries(
      returnItems.map((name) => [name.toUpperCase(), session.items[name.toUpperCase()] ?? ""])
    );
  }
  // ---------------------------------------------------------------- rendering
  renderPage(ctx) {
    const page = ctx.page;
    const templateId = this.pageTemplateId(page);
    const template = this.theme.pages.get(templateId) ?? this.theme.pages.get("standard");
    if (!this.theme.pages.has(templateId))
      this.diagnose("warning", `Page template @/${templateId} not found; used Standard`, ctx.pageId);
    const slots = this.theme.slots.get(text(template, "id")) ?? /* @__PURE__ */ new Map();
    const placeholder2 = (slot) => {
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
    const regions = this.pageComponents(ctx, "region");
    for (const region of regions) {
      if (ref(region.props, "layout.parentRegion")) continue;
      const key = placeholder2(str(region.props, "layout.slot", "body"));
      positions.set(key, [...positions.get(key) ?? [], region]);
    }
    const pageButtons = this.pageComponents(ctx, "button").filter(
      (button) => !ref(button.props, "layout.region")
    );
    const pageItems = this.pageComponents(ctx, "pageItem").filter(
      (item2) => !ref(item2.props, "layout.region")
    );
    const gridless = new Set(
      this.assets.theme.filter(
        (call) => call.kind === "page_tmpl_display_point" && String(call.params.page_template_id) === text(template, "id") && (call.params.has_grid_support === false || call.params.has_grid_support === "N")
      ).map((call) => String(call.params.placeholder))
    );
    const values = {};
    for (const [key, list4] of positions) {
      const cells = bySequence2(list4).filter((region) => this.visible(ctx, region)).map((region) => ({ component: region, html: this.renderRegion(ctx, region) }));
      values[key] = gridless.has(key) ? cells.map((cell) => cell.html).join("\n") : this.grid(template, cells);
    }
    for (const button of bySequence2(pageButtons)) {
      if (!this.visible(ctx, button)) continue;
      const key = placeholder2(str(button.props, "layout.slot", "body"));
      values[key] = (values[key] ?? "") + this.renderButton(ctx, button);
    }
    if (pageItems.length) values.BODY = (values.BODY ?? "") + this.itemsGrid(ctx, template, pageItems);
    const pageOptions = templateOptions(
      strings5(list(page.props, "appearance.templateOptions")),
      text(template, "default_template_options")
    );
    const themeComponent = this.themeComponent();
    const styleId = (ctx.session.themeStyle ?? ref(themeComponent?.props ?? {}, "style.currentThemeStyle") ?? defaultStaticId(this.theme, "current_theme_style_id", "vita")).toLowerCase();
    const style = this.theme.styles.get(styleId) ?? this.theme.styles.get("vita");
    if (!this.theme.styles.has(styleId))
      this.diagnose("info", `Theme style ${styleId} not found; used Vita`, ctx.pageId);
    const css = [
      `${IMAGE_PREFIX}app_ui/css/Core.min.css?v=${APEX_FULL_VERSION}`,
      `${IMAGE_PREFIX}libraries/font-apex/2.5.1/css/font-apex.min.css?v=${APEX_FULL_VERSION}`
    ];
    const themeCss = strings5(list(themeComponent?.props ?? {}, "css.fileUrls"));
    const themeFiles = themeCss.length ? themeCss : text(this.theme.theme, "css_file_urls").split("\n").filter(Boolean);
    const styleCss = [
      ...text(style, "css_file_urls").split("\n"),
      text(style, "theme_roller_output_file_url")
    ].filter(Boolean);
    const appCss = strings5(list(this.app.app.props, "css.fileUrls"));
    const pageCss = strings5(list(page.props, "css.fileUrls"));
    const inlineCss = [str(this.app.app.props, "css.inline"), str(page.props, "css.inline")].filter(Boolean);
    const themeJs = strings5(list(themeComponent?.props ?? {}, "javaScript.fileUrls"));
    const themeJsFiles = themeJs.length ? themeJs : text(this.theme.theme, "javascript_file_urls").split("\n").filter(Boolean);
    const appJs = strings5(list(this.app.app.props, "javaScript.fileUrls"));
    const pageJs = strings5(list(page.props, "javaScript.fileUrls"));
    this.navigation(ctx, values, template);
    const link = (url2) => `<link rel="stylesheet" href="${escapeHtml(this.urls(url2))}" type="text/css" />`;
    const script = (url2) => `<script src="${escapeHtml(this.urls(url2))}"></script>`;
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
    for (const extension of extensions) extension.page?.(this, ctx);
    for (const action of this.pageComponents(ctx, "dynamicAction")) {
      if (this.visible(ctx, action)) ctx.clientConfig.dynamicActions.push(this.dynamicAction(ctx, action));
    }
    const pageTemplate = text(template, "id");
    ctx.messageTemplates[`${pageTemplate}_S`] = text(template, "success_message");
    ctx.messageTemplates[`${pageTemplate}_E`] = text(template, "notification_message");
    const onload2 = [
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
    const hidden2 = (name, id, value) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}" id="${id}" />`;
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
      FAVICONS: this.favicons(),
      HEAD: "",
      PAGE_CSS_CLASSES: [pageOptions, str(page.props, "appearance.cssClasses")].filter(Boolean).join(" "),
      DIALOG_CSS_CLASSES: "",
      ONLOAD: "",
      TEXT_DIRECTION: "",
      RTL_CLASS: "",
      FORM_OPEN: [
        `<form action="wwv_flow.accept" method="post" name="wwv_flow" id="wwvFlowForm" data-oj-binding-provider="none" novalidate autocomplete="off">`,
        hidden2("p_flow_id", "pFlowId", this.appId),
        hidden2("p_flow_step_id", "pFlowStepId", page.id),
        hidden2("p_instance", "pInstance", ctx.session.id),
        hidden2("p_debug", "pdebug", ""),
        hidden2("p_request", "pRequest", ""),
        hidden2("p_reload_on_submit", "pReloadOnSubmit", "S"),
        hidden2("p_page_submission_id", "pPageSubmissionId", String(Date.now()))
      ].join("\n"),
      FORM_CLOSE: [
        `<input type="hidden" id="pSalt" value="local" />`,
        `<input type="hidden" id="pPageItemsRowVersion" value="" />`,
        `<input type="hidden" id="pPageItemsProtected" value="" />`,
        `<input type="hidden" id="pPageFormRegionChecksums" value="[]" />`,
        "</form>"
      ].join("\n"),
      DEVELOPER_TOOLBAR: this.options.toolbar && !this.isDialog(page) ? this.toolbar(ctx) : "",
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
${onload2.join("\n")}
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
      LOGO: this.logo(ctx),
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
  favicons() {
    const icon3 = this.app.files.length ? `${this.baseUrl}/files/static/v1/icons/app-icon-32.png` : "";
    const exists = fs6.existsSync(
      path6.join(this.app.root, "shared-components", "static-files", "icons", "app-icon-32.png")
    );
    return icon3 && exists ? `<link rel="icon" sizes="32x32" href="${icon3}">` : "";
  }
  logo(ctx) {
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
  toolbar(ctx) {
    const own = this.diagnostics.filter((diagnostic) => !diagnostic.page || diagnostic.page === ctx.pageId);
    const counts = (level) => own.filter((diagnostic) => diagnostic.level === level).length;
    const items = own.slice(0, 40).map((diagnostic) => `<li class="is-${diagnostic.level}">${escapeHtml(diagnostic.message)}</li>`).join("");
    const current = (ctx.session.themeStyle ?? "").toLowerCase();
    const styles = [...this.theme.styles.entries()].map(
      ([id, style]) => `<option value="${escapeHtml(id)}"${id === current ? " selected" : ""}>${escapeHtml(text(style, "name") || id)}</option>`
    ).join("");
    const picker = `<label class="apex-local-style">Theme style <select onchange="location.search='apex_theme_style='+encodeURIComponent(this.value)"><option value="">Application default</option>${styles}</select></label>`;
    return `<details class="apex-local-toolbar" id="apexLocalToolbar"><summary>APEX local \xB7 page ${escapeHtml(ctx.pageId)} \xB7 ${counts("error")} errors \xB7 ${counts("warning")} warnings \xB7 ${counts("info")} notes</summary>${picker}<ul>${items || "<li>No diagnostics</li>"}</ul></details>`;
  }
  navigation(ctx, values, template) {
    const app = this.app.app.props;
    const box = `${text(template, "header_template")}${text(template, "box")}`;
    const nav = bool(ctx.page.props, "navigationMenu.overrideUserInterfaceLevel", false) ? ctx.page.props : app;
    const menu = this.shared("list", ref(nav, "navigationMenu.list"));
    if (menu && (box.includes("#SIDE_GLOBAL_NAVIGATION_LIST#") || box.includes("#TOP_GLOBAL_NAVIGATION_LIST#"))) {
      const theme = this.themeComponent();
      const position2 = str(
        nav,
        "navigationMenu.listPosition",
        str(
          nav,
          "navigationMenu.position",
          str(theme?.props ?? {}, "componentDefaults.navigationMenuListPosition", "side")
        )
      );
      const fallback = position2 === "top" ? "top-navigation-menu" : "side-navigation-menu";
      const templateId = (ref(nav, "navigationMenu.listTemplate") ?? fallback).toLowerCase();
      const options2 = strings5(list(nav, "navigationMenu.templateOptions"));
      const html = this.renderList(ctx, menu, templateId, options2, "t_TreeNav");
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
        strings5(list(app, "navigationBar.templateOptions")),
        "navigation_bar"
      );
    }
  }
  /** Fixed 12-column grid using the page template's container/row/column templates. */
  grid(template, cells) {
    if (!cells.length) return "";
    const rows = [];
    for (const cell of cells) {
      const startNewRow = bool(cell.component.props, "layout.startNewRow", true) && bool(cell.component.props, "layout.newRow", true);
      if (!rows.length || startNewRow) rows.push([cell]);
      else rows.at(-1).push(cell);
    }
    const max = Number(text(template, "grid_max_columns")) || 12;
    const containerTemplate = text(template, "grid_template") || '<div class="container">#ROWS#</div>';
    const rowTemplate2 = text(template, "grid_row_template") || '<div class="row #CSS_CLASSES#">#COLUMNS#</div>';
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
      return fill(rowTemplate2, { CSS_CLASSES: "", COLUMNS: columns });
    }).join("\n");
    return fill(containerTemplate, { ROWS: html });
  }
  itemsGrid(ctx, template, items) {
    const visible = bySequence2(items).filter((item2) => this.visible(ctx, item2));
    const hidden2 = visible.filter((item2) => str(item2.props, "type") === "hidden");
    const shown = visible.filter((item2) => str(item2.props, "type") !== "hidden");
    return this.grid(
      template,
      shown.map((item2) => ({ component: item2, html: this.renderItem(ctx, item2) }))
    ) + hidden2.map((item2) => this.renderItem(ctx, item2)).join("");
  }
  pageTemplate(ctx) {
    return this.theme.pages.get(this.pageTemplateId(ctx.page)) ?? this.theme.pages.get("standard");
  }
  // ---------------------------------------------------------------- regions
  regionTemplateId(region) {
    const explicit = ref(region.props, "appearance.template");
    if (explicit) return explicit.toLowerCase();
    const type = str(region.props, "type");
    const theme = this.themeComponent();
    const defaults = theme?.props ?? {};
    if (type === "breadcrumb")
      return (ref(defaults, "regionDefaults.breadcrumbs") ?? "title-bar").toLowerCase();
    if (type === "interactiveReport" || type === "interactiveGrid")
      return (ref(defaults, "regionDefaults.interactiveReports") ?? "interactive-report").toLowerCase();
    return (ref(defaults, "componentDefaults.region") ?? defaultStaticId(this.theme, "default_region_template", "standard")).toLowerCase();
  }
  regionDomId(region) {
    return str(region.props, "advanced.htmlDomId") || str(region.props, "advanced.staticId") || slug(region.id);
  }
  renderRegion(ctx, region) {
    const templateId = this.regionTemplateId(region);
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
    for (const button of bySequence2(
      this.pageComponents(ctx, "button").filter(
        (candidate) => ref(candidate.props, "layout.region") === region.id
      )
    )) {
      if (this.visible(ctx, button))
        append(str(button.props, "layout.slot", "regionBody"), this.renderButton(ctx, button));
    }
    const body3 = this.regionBody(ctx, region, values);
    const regionItems = this.pageComponents(ctx, "pageItem").filter(
      (item2) => ref(item2.props, "layout.region") === region.id
    );
    const itemSlot = (item2) => slots.get(str(item2.props, "layout.slot")) ?? "BODY";
    const items = regionItems.filter((item2) => itemSlot(item2) === "BODY");
    for (const item2 of bySequence2(regionItems.filter((item3) => itemSlot(item3) !== "BODY")))
      values[itemSlot(item2)] = (values[itemSlot(item2)] ?? "") + this.renderItem(ctx, item2);
    const itemsHtml = items.length ? this.itemsGrid(ctx, this.pageTemplate(ctx), items) : "";
    values.BODY = `${body3}${values.BODY ?? ""}${itemsHtml}`;
    const children = this.pageComponents(ctx, "region").filter(
      (child) => ref(child.props, "layout.parentRegion") === region.id && this.visible(ctx, child)
    );
    const rendered = /* @__PURE__ */ new Map();
    if (children.length) {
      const grouped = /* @__PURE__ */ new Map();
      for (const child of bySequence2(children)) {
        const slot = str(child.props, "layout.slot", "subRegions");
        grouped.set(slot, [...grouped.get(slot) ?? [], child]);
      }
      for (const [slot, group2] of grouped) {
        const key = slots.get(slot) ?? (slot === "regionBody" ? "SUB_REGIONS" : slot.toUpperCase());
        const cells = group2.map((child) => ({ component: child, html: this.renderRegion(ctx, child) }));
        rendered.set(key, [...rendered.get(key) ?? [], ...cells]);
        values[key] = (values[key] ?? "") + this.grid(this.pageTemplate(ctx), cells);
      }
    }
    const options2 = templateOptions(
      strings5(list(region.props, "appearance.templateOptions")),
      text(template, "default_template_options")
    );
    const icon3 = iconClasses2(
      str(region.props, "appearance.icon") || str(region.props, "icon.iconCssClasses")
    );
    const image = str(region.props, "image.fileUrl");
    const title = this.substitute(
      ctx.session,
      str(region.props, "title", str(region.props, "name")),
      ctx.page,
      "HTML"
    );
    const filled = {
      ...values,
      TITLE: title,
      REGION_TITLE: title,
      DOM_ID: domId,
      REGION_STATIC_ID: domId,
      REGION_ID: domId,
      REGION_CSS_CLASSES: [options2, str(region.props, "appearance.cssClasses")].filter(Boolean).join(" "),
      REGION_ATTRIBUTES: this.substitute(
        ctx.session,
        str(region.props, "advanced.customAttributes"),
        ctx.page,
        "RAW"
      ),
      REGION_LANDMARK_ATTRIBUTES: `role="region" aria-labelledby="${domId}_heading"`,
      ICON_CSS_CLASSES: icon3,
      REGION_IMAGE: image ? fill(text(template, "image_template"), {
        REGION_IMAGE_URL: escapeHtml(this.substitute(ctx.session, image, ctx.page, "RAW"))
      }) : "",
      REGION_IMAGE_URL: escapeHtml(this.substitute(ctx.session, image, ctx.page, "RAW"))
    };
    for (let index = extensions.length - 1; index >= 0; index -= 1) {
      const html = extensions[index].wrapRegion?.(this, ctx, region, {
        template,
        values: filled,
        children: rendered
      });
      if (html !== void 0) return html;
    }
    return fill(text(template, "template"), filled);
  }
  regionBody(ctx, region, slots) {
    const type = str(region.props, "type", "staticContent");
    const extension = regionRenderer(type) ?? (type.includes("/") ? regionRenderer(type.split("/")[0]) : void 0);
    if (extension) return extension(this, ctx, region, slots);
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
        return this.report(ctx, region, "classic");
      case "interactiveReport":
      case "interactiveGrid":
        if (type === "interactiveGrid")
          this.diagnose(
            "info",
            `Interactive Grid ${region.id} is rendered as a read-only report`,
            ctx.pageId,
            region.id
          );
        return this.report(ctx, region, "interactive", slots);
      case "cards":
        return this.cards(ctx, region);
      case "list":
        return this.listRegion(ctx, region);
      case "breadcrumb":
        return this.breadcrumb(ctx, region);
      case "chart":
        return this.chart(ctx, region);
      default:
        if (type.startsWith("themeTemplateComponent/")) return this.report(ctx, region, "classic");
        this.diagnose(
          "warning",
          `Region type ${type} (${region.id}) is not simulated; a placeholder is shown`,
          ctx.pageId,
          region.id
        );
        return `<div class="apex-local-unsupported"><span class="fa fa-info-circle" aria-hidden="true"></span> <strong>${escapeHtml(heading(type.replace(/([a-z])([A-Z])/gu, "$1_$2")))}</strong> region \u201C${escapeHtml(str(region.props, "name", region.id))}\u201D is not simulated locally.</div>`;
    }
  }
  columns(region, resultColumns) {
    const declared = region.children.filter((child) => child.type === "column");
    const saved = region.children.find(
      (child) => child.type === "savedReport" && str(child.props, "visibility", "primaryDefault").startsWith("primary")
    ) ?? region.children.find((child) => child.type === "savedReport");
    const display = saved ? bySequence2(saved.children.filter((child) => child.type === "displayColumn")).map(
      (child) => child.id.toUpperCase()
    ) : [];
    const base = declared.length ? bySequence2(declared) : resultColumns.map(
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
  cell(ctx, region, column, row) {
    const name = column.id.toUpperCase();
    const raw = row[name];
    const type = str(column.props, "type", "plainText");
    const custom = columnRenderer(type);
    if (custom) return custom(this, ctx, region, column, row);
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
  alignment(column, sample) {
    const alignment = str(column.props, "layout.columnAlignment") || str(column.props, "appearance.alignment");
    if (/end|right/u.test(alignment) || !alignment && typeof sample === "number") return "u-tR";
    if (/center/u.test(alignment)) return "u-tC";
    return "u-tL";
  }
  report(ctx, region, mode, slots = {}) {
    const sql = this.regionSql(ctx, region);
    if (!sql)
      return `<div class="apex-local-unsupported">Report \u201C${escapeHtml(str(region.props, "name", region.id))}\u201D has no local source.</div>`;
    const result = this.query(ctx, region, sql);
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
    const columns = this.columns(region, result.columns);
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
    const paginate = (target2, label, cls) => `<button type="button" class="t-Button t-Button--small t-Button--noUI t-Report-paginationLink ${cls}" data-apex-local-page="${target2}" data-region="${escapeHtml(domId)}">${label}</button>`;
    const pagination2 = result.rows.length > perPage || pageNumber > 1 ? `<tr><td>${pageNumber > 1 ? paginate(pageNumber - 1, '<span class="a-Icon icon-left-arrow"></span>Previous', "t-Report-paginationLink--prev") : ""}<span class="t-Report-paginationText">${first} - ${last}</span>${last < result.rows.length ? paginate(pageNumber + 1, 'Next<span class="a-Icon icon-right-arrow"></span>', "t-Report-paginationLink--next") : ""}</td></tr>` : rows.length ? `<tr><td><span class="t-Report-paginationText">${first} - ${last}</span></td></tr>` : "";
    if (mode === "interactive") {
      const searchBar = slots.RIGHT_OF_INTERACTIVE_REPORT_SEARCH_BAR ?? slots.RIGHTOFINTERACTIVEREPORTSEARCHBAR ?? "";
      delete slots.RIGHT_OF_INTERACTIVE_REPORT_SEARCH_BAR;
      delete slots.RIGHTOFINTERACTIVEREPORTSEARCHBAR;
      const header = `${linkColumn ? '<th class="a-IRR-header a-IRR-header--linkColumn" id="' + domId + '_link"><span class="u-VisuallyHidden">Link</span></th>' : ""}${columns.map(
        (column) => `<th class="a-IRR-header ${this.alignment(column, rows[0]?.[column.id.toUpperCase()])}" id="${escapeHtml(domId)}_${escapeHtml(column.id)}"><a class="a-IRR-headerLink" href="#" data-column="${escapeHtml(column.id)}">${this.substitute(ctx.session, str(column.props, "heading.heading", heading(column.id)), ctx.page, "HTML")}</a></th>`
      ).join("")}`;
      const body4 = rows.map(
        (row) => `<tr>${linkColumn ? `<td class="a-IRR-linkCol u-tC"><a href="${escapeHtml(this.link(ctx, get(region.props, "link.target"), row, `apex.jQuery('#${domId}')`))}">${linkIcon}</a></td>` : ""}${columns.map(
          (column) => `<td class="${this.alignment(column, row[column.id.toUpperCase()])}" headers="${escapeHtml(domId)}_${escapeHtml(column.id)}">${this.cell(ctx, region, column, row)}</td>`
        ).join("")}</tr>`
      ).join("\n");
      return `<div class="a-IRR-container" id="${escapeHtml(domId)}_ir"><div class="a-IRR t-fht-cell"><div class="a-IRR-toolbar"><div class="a-IRR-controls">
<div class="a-IRR-controlGroup a-IRR-controlGroup--search"><div class="a-IRR-search"><div class="a-IRR-colSelector"><button type="button" class="a-Button a-IRR-button a-IRR-button--colSearch" aria-label="Select columns to search"><span class="a-Icon icon-search"></span><span class="a-Icon icon-menu-drop-down"></span></button></div><input class="a-IRR-search-field" type="search" placeholder="Search" aria-label="Search" data-apex-local-search="${escapeHtml(domId)}"><button class="a-Button a-IRR-button a-IRR-button--search" type="button">Go</button></div></div>
<div class="a-IRR-controlGroup a-IRR-controlGroup--options"><div class="a-IRR-actions"><button class="a-Button a-IRR-button a-IRR-button--actions" type="button">Actions<span class="a-Icon icon-down-chevron" aria-hidden="true"></span></button></div></div>
${searchBar ? `<div class="a-IRR-buttons">${searchBar}</div>` : ""}</div></div>
<div class="a-IRR-content"><div class="a-IRR-reportView"><div class="a-IRR-tableContainer">${rows.length ? `<table class="a-IRR-table" id="${escapeHtml(domId)}_table" aria-label="${escapeHtml(str(region.props, "name"))}"><tr>${header}</tr>${body4}</table>` : `<div class="a-IRR-noDataMsg"><span class="a-IRR-noDataMsg-icon a-Icon icon-irr-no-results" aria-hidden="true"></span><span class="a-IRR-noDataMsg-text">${noData}</span></div>`}</div>
${pagination2 ? `<div class="a-IRR-paginationWrap a-IRR-paginationWrap--bottom"><table class="t-Report-pagination t-Report-pagination--bottom" role="presentation">${pagination2}</table></div>` : ""}</div></div></div></div>`;
    }
    const templateId = (ref(region.props, "componentAppearance.template") ?? ref(region.props, "appearance.reportTemplate") ?? defaultStaticId(this.theme, "default_report_template", "standard")).toLowerCase();
    const template = this.theme.reports.get(templateId) ?? this.theme.reports.get("standard");
    const cssClasses = templateOptions(
      strings5(list(region.props, "componentAppearance.templateOptions")),
      text(template, "preset_template_options").replaceAll(":", " ")
    );
    const shared = {
      DOM_ID: domId,
      REGION_TITLE: escapeHtml(str(region.props, "name")),
      COMPONENT_CSS_CLASSES: cssClasses,
      REPORT_ATTRIBUTES: "",
      TOP_PAGINATION: "",
      PAGINATION: pagination2
    };
    if (!rows.length) return `<div class="t-Report-wrap"><span class="nodatafound">${noData}</span></div>`;
    if (text(template, "row_template_type") === "NAMED_COLUMNS") {
      const rowHtml = rows.map(
        (row, index) => fill(text(template, "row_template1"), {
          ...Object.fromEntries(Object.keys(row).map((key) => [key, escapeHtml(row[key] ?? "")])),
          ...Object.fromEntries(
            columns.map((column) => [column.id.toUpperCase(), this.cell(ctx, region, column, row)])
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
        ALIGNMENT: `align="${this.alignment(column, rows[0]?.[column.id.toUpperCase()]) === "u-tR" ? "right" : "left"}"`,
        ARIA_SORT: "",
        COLUMN_WIDTH: ""
      })
    ).join("");
    const body3 = rows.map(
      (row) => text(template, "row_template_before_first") + columns.map(
        (column) => fill(text(template, "row_template1"), {
          COLUMN_VALUE: this.cell(ctx, region, column, row),
          ALIGNMENT: `align="${this.alignment(column, row[column.id.toUpperCase()]) === "u-tR" ? "right" : "left"}"`,
          ACCESSIBLE_HEADERS: `headers="${escapeHtml(column.id.toUpperCase())}"`
        })
      ).join("") + text(template, "row_template_after_last")
    ).join("\n");
    return fill(text(template, "row_template_before_rows"), shared) + text(template, "before_column_heading") + headings + text(template, "after_column_heading") + body3 + fill(text(template, "row_template_after_rows"), shared);
  }
  cards(ctx, region) {
    const sql = this.regionSql(ctx, region);
    if (!sql) return "";
    const result = this.query(ctx, region, sql, 200);
    const value = (row, key) => {
      const column = str(region.props, key).toUpperCase();
      return column && column in row ? escapeHtml(row[column] ?? "") : "";
    };
    ctx.clientConfig.regions.push({ id: this.regionDomId(region), kind: "cards" });
    const cards = result.rows.map((row) => {
      const title = value(row, "title.column");
      const subtitle = value(row, "subtitle.column");
      const body3 = value(row, "body.column");
      const badge = value(row, "iconAndBadge.badgeColumn");
      const iconColumn = value(row, "iconAndBadge.iconColumn");
      const initials2 = iconColumn.split(/\s+/u).map((part2) => part2[0] ?? "").join("").slice(0, 2).toUpperCase();
      const icon3 = str(region.props, "iconAndBadge.iconSource") ? `<div class="a-CardView-icon u-color" aria-hidden="true"><span class="a-CardView-initials">${initials2}</span></div>` : "";
      return `<li class="a-CardView-item"><div class="a-CardView"><div class="a-CardView-header">${icon3}<div class="a-CardView-headerBody"><h3 class="a-CardView-title">${title}</h3>${subtitle ? `<h4 class="a-CardView-subTitle">${subtitle}</h4>` : ""}</div>${badge ? `<div class="a-CardView-badge"><span class="a-CardView-badgeValue">${badge}</span></div>` : ""}</div>${body3 ? `<div class="a-CardView-body"><div class="a-CardView-mainContent">${body3}</div></div>` : ""}</div></li>`;
    }).join("\n");
    return `<div class="a-CardView-region"><ul class="a-CardView-items a-CardView-items--grid">${cards}</ul></div>`;
  }
  chart(ctx, region) {
    const series = bySequence2(region.children.filter((child) => child.type === "series"));
    const type = str(region.props, "chart.type", "bar");
    const parts = series.map((entry) => {
      const sql = str(entry.props, "source.sqlQuery") || (str(entry.props, "source.tableName") ? `select * from ${str(entry.props, "source.tableName")}` : "");
      if (!sql) return "";
      const result = this.query(ctx, entry, sql, num(entry.props, "performance.maxRowsToProcess", 50));
      const label = str(entry.props, "columnMapping.label", result.columns[0] ?? "").toUpperCase();
      const valueColumn = str(entry.props, "columnMapping.value", result.columns[1] ?? "").toUpperCase();
      const values = result.rows.map((row) => ({
        label: String(row[label] ?? ""),
        value: Number(row[valueColumn] ?? 0)
      }));
      const max = Math.max(1, ...values.map((item2) => item2.value));
      const bars = values.map(
        (item2, index) => `<div class="apex-local-bar"><span class="apex-local-bar-label">${escapeHtml(item2.label)}</span><span class="apex-local-bar-track"><span class="apex-local-bar-fill u-color-${index % 15 + 1}-bg" style="width:${(item2.value / max * 100).toFixed(1)}%"></span></span><span class="apex-local-bar-value">${item2.value.toLocaleString("en-US")}</span></div>`
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
  breadcrumb(ctx, region) {
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
    const options2 = templateOptions(strings5(list(region.props, "componentAppearance.templateOptions")), "");
    return fill(text(template, "before_first"), { COMPONENT_CSS_CLASSES: options2 }) + chain.map(
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
  listRegion(ctx, region) {
    const listComponent = this.shared("list", ref(region.props, "source.list"));
    if (!listComponent) {
      this.diagnose("warning", `List @${ref(region.props, "source.list")} not found`, ctx.pageId, region.id);
      return "";
    }
    const theme = this.themeComponent();
    const templateId = (ref(region.props, "componentAppearance.listTemplate") ?? ref(theme?.props ?? {}, "componentDefaults.list") ?? "links-list").toLowerCase();
    return this.renderList(
      ctx,
      listComponent,
      templateId,
      strings5(list(region.props, "componentAppearance.templateOptions")),
      `${this.regionDomId(region)}_list`,
      this.regionDomId(region)
    );
  }
  renderList(ctx, listComponent, templateId, options2, listId, parentId = listId) {
    const template = this.theme.lists.get(templateId);
    if (!template) {
      this.diagnose("warning", `List template @/${templateId} not found`, ctx.pageId, listComponent.id);
      return "";
    }
    for (const file of text(template, "javascript_file_urls").split("\n").filter(Boolean))
      ctx.jsFiles.add(file);
    for (const file of text(template, "css_file_urls").split("\n").filter(Boolean)) ctx.cssFiles.add(file);
    const entries = listComponent.children.filter(
      (child) => child.type === "entry" && this.visible(ctx, child)
    );
    const childrenOf = (parent) => bySequence2(entries.filter((entry) => ref(entry.props, "layout.parentEntry") === parent));
    const isCurrent = (entry) => {
      const target2 = get(entry.props, "link.target");
      const pages2 = str(entry.props, "currentForPages") || str(entry.props, "link.currentForPages");
      if (pages2)
        return pages2.split(",").map((page) => page.trim()).includes(ctx.pageId);
      return isObject(target2) && target2.page !== void 0 && this.findPage(String(target2.page))?.id === ctx.pageId;
    };
    const render = (entry, level) => {
      const kids = childrenOf(entry.id);
      const current = isCurrent(entry) || kids.some(isCurrent);
      const attributes = get(entry.props, "userDefinedAttributes");
      const values = {
        LINK: escapeHtml(this.link(ctx, get(entry.props, "link.target"))),
        TEXT: this.substitute(ctx.session, str(entry.props, "label", entry.id), ctx.page, "HTML"),
        TEXT_ESC_SC: this.substitute(ctx.session, str(entry.props, "label", entry.id), ctx.page, "HTML"),
        ICON_CSS_CLASSES: iconClasses2(
          str(entry.props, "icon.imageIconCssClasses") || str(entry.props, "icon.iconCssClasses")
        ),
        IMAGE: iconClasses2(str(entry.props, "icon.imageIconCssClasses")),
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
      PARENT_STATIC_ID: parentId,
      COMPONENT_CSS_CLASSES: templateOptions(options2, text(template, "default_template_options")),
      APEX_CSP_NONCE_ATTRIBUTE: ""
    };
    if (text(template, "javascript_code_onload"))
      ctx.onload.push(fill(text(template, "javascript_code_onload"), shared, false));
    return fill(text(template, "list_template_before_rows"), shared) + childrenOf(void 0).map((entry) => render(entry, 1)).join("") + fill(text(template, "list_template_after_rows"), shared);
  }
  // ---------------------------------------------------------------- buttons & items
  renderButton(ctx, button) {
    const theme = this.themeComponent();
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
      const target2 = get(button.props, "behavior.target") ?? str(button.props, "behavior.targetUrl");
      const href = this.link(ctx, target2, void 0, `apex.jQuery('#${domId}')`);
      onclick = href.startsWith("javascript:") ? href.slice(11) : `apex.navigation.redirect('${escapeJs(href)}');`;
    }
    const options2 = templateOptions(
      strings5(list(button.props, "appearance.templateOptions")),
      text(template, "default_template_options")
    );
    const icon3 = iconClasses2(
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
        options2,
        str(button.props, "appearance.cssClasses"),
        hot && !text(template, "hot_template") ? "t-Button--hot" : ""
      ].filter(Boolean).join(" "),
      ICON_CSS_CLASSES: icon3,
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
  renderItem(ctx, item2) {
    const name = item2.id.toUpperCase();
    const type = str(item2.props, "type", "textField");
    const value = ctx.session.items[name] ?? "";
    if (type === "hidden") {
      const hidden2 = itemRenderer("hidden");
      return hidden2 ? hidden2(this, ctx, item2, name, value) : `<input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}">`;
    }
    const required2 = bool(item2.props, "validation.valueRequired", false);
    const theme = this.themeComponent();
    const templateId = (ref(item2.props, "appearance.template") ?? ref(
      theme?.props ?? {},
      required2 ? "componentDefaults.requiredLabel" : "componentDefaults.optionalLabel"
    ) ?? (required2 ? "required-floating" : "optional-floating")).toLowerCase();
    const template = this.theme.fields.get(templateId) ?? this.theme.fields.get("optional-floating");
    const element = this.element(ctx, item2, type, name, value);
    const label = escapeHtml(this.substitute(ctx.session, this.label(item2), ctx.page, "RAW"));
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
        `apex-item-wrapper apex-item-wrapper--${WRAPPER_CLASSES[type] ?? slug(type).replace(/[A-Z]/gu, (char) => `-${char.toLowerCase()}`)}`,
        str(item2.props, "appearance.cssClasses"),
        error ? "is-error" : ""
      ].filter(Boolean).join(" "),
      CURRENT_ITEM_PRE_TEXT: str(item2.props, "appearance.preTextHtml"),
      CURRENT_ITEM_POST_TEXT: str(item2.props, "appearance.postTextHtml"),
      CURRENT_ITEM_HELP_LABEL: "Help",
      CURRENT_ITEM_INLINE_HELP_TEXT: escapeHtml(str(item2.props, "help.inlineHelpText")),
      ERROR_MESSAGE: error ? escapeHtml(error) : "",
      IS_REQUIRED: required2 ? "Y" : ""
    };
    for (const extension of extensions) extension.itemTemplate?.(this, ctx, item2, values);
    values.ITEM_PRE_TEXT = values.CURRENT_ITEM_PRE_TEXT ? fill(text(template, "item_pre_text"), values) : "";
    values.ITEM_POST_TEXT = values.CURRENT_ITEM_POST_TEXT ? fill(text(template, "item_post_text"), values) : "";
    values.HELP_TEMPLATE = str(item2.props, "help.helpText") ? fill(text(template, "help_link"), values) : "";
    values.INLINE_HELP_TEMPLATE = values.CURRENT_ITEM_INLINE_HELP_TEXT ? fill(text(template, "inline_help_text"), values) : "";
    const errorTemplate = `${text(template, "id")}_ET`;
    ctx.messageTemplates[errorTemplate] = text(template, "error_template");
    values.ERROR_TEMPLATE = `<span id="${name}_error_placeholder" class="a-Form-error${error ? "" : " u-hidden"}" data-template-id="${errorTemplate}">${error ? fill(text(template, "error_template"), values) : ""}</span>`;
    const labelHtml = singleCheckbox ? "" : `${fill(text(template, "template_body1"), values)}${label}${fill(text(template, "template_body2"), values)}`;
    return `${fill(text(template, "before_item"), values)}${labelHtml}${fill(text(template, "before_element"), values)}${element}${fill(text(template, "after_element"), values)}${fill(text(template, "after_item"), values)}`;
  }
  element(ctx, item2, type, name, value) {
    const extension = itemRenderer(type);
    if (extension) return extension(this, ctx, item2, name, value);
    const v = escapeHtml(value);
    const width = num(item2.props, "appearance.width", 30);
    const max = num(item2.props, "validation.maxLength", 0);
    const placeholder2 = str(item2.props, "appearance.placeholder") ? ` placeholder="${escapeHtml(str(item2.props, "appearance.placeholder"))}"` : "";
    const required2 = bool(item2.props, "validation.valueRequired", false) ? " required" : "";
    const readonly = str(item2.props, "readOnly.type") === "always" ? " readonly" : "";
    const lov = () => this.lov(ctx, get(item2.props, "lov"), name);
    const nullDisplay = (fallback) => escapeHtml(str(item2.props, "lov.nullDisplayValue", fallback));
    const options2 = (selected) => lov().map(
      (entry) => `<option value="${escapeHtml(entry.r)}"${selected.includes(entry.r) ? " selected" : ""}>${escapeHtml(entry.d)}</option>`
    ).join("");
    switch (type) {
      case "textField":
      case "popupLov":
      case "autoComplete":
      case "colorPicker":
        return `<input type="text" id="${name}" name="${name}" class="text_field apex-item-text" value="${v}" size="${width}"${max ? ` maxlength="${max}"` : ""}${placeholder2}${required2}${readonly} data-trim-spaces="BOTH">`;
      case "password":
        return `<input type="password" id="${name}" name="${name}" class="password apex-item-text" value="" size="${width}"${placeholder2}${required2}>`;
      case "numberField":
        return `<input type="text" inputmode="decimal" id="${name}" name="${name}" class="number_field apex-item-text apex-item-number" value="${v}" size="${width}"${placeholder2}${required2}${readonly} style="text-align:end">`;
      case "datePicker":
      case "datePickerApex":
        return `<input type="date" id="${name}" name="${name}" class="text_field apex-item-text apex-item-datepicker" value="${v.slice(0, 10)}"${required2}${readonly}>`;
      case "textarea":
      case "richTextEditor":
      case "markdownEditor":
        return `<div class="apex-item-group apex-item-group--textarea"><textarea name="${name}" id="${name}" rows="${num(item2.props, "appearance.height", 5)}" cols="${width}" class="textarea apex-item-textarea"${placeholder2}${required2}${readonly}>${v}</textarea></div>`;
      case "selectList":
      case "shuttle":
      case "selectMany":
      case "combobox": {
        const showNull = bool(item2.props, "lov.displayNullValue", type === "selectList");
        return `<select id="${name}" name="${name}" class="selectlist apex-item-select" data-native-menu="false" size="1"${required2}>${showNull ? `<option value="">${nullDisplay("- Select -")}</option>` : ""}${options2(value.split(":"))}</select>`;
      }
      case "radioGroup":
      case "checkboxGroup": {
        const input = type === "radioGroup" ? "radio" : "checkbox";
        const selected = value.split(":");
        const choices2 = lov().map(
          (entry, index) => `<div class="apex-item-option"><input type="${input}" id="${name}_${index}" name="${name}" value="${escapeHtml(entry.r)}"${selected.includes(entry.r) ? " checked" : ""}><label for="${name}_${index}">${escapeHtml(entry.d)}</label></div>`
        ).join("");
        return `<div tabindex="-1" id="${name}" class="${input === "radio" ? "radio_group apex-item-radio" : "checkbox_group apex-item-checkbox"}" role="${input === "radio" ? "radiogroup" : "group"}" aria-labelledby="${name}_LABEL">${choices2}</div>`;
      }
      case "checkbox": {
        const checked = value === str(item2.props, "settings.checkedValue", "Y");
        return `<div class="apex-item-single-checkbox"><input type="hidden" name="${name}" id="${name}_HIDDENVALUE" value="${v}"><input type="checkbox" id="${name}" value="${escapeHtml(str(item2.props, "settings.checkedValue", "Y"))}"${checked ? " checked" : ""}><label for="${name}" id="${name}_LABEL" class="u-checkbox">${escapeHtml(this.label(item2))}</label></div>`;
      }
      case "switch": {
        const on = str(item2.props, "settings.onValue", "Y");
        return `<span class="a-Switch"><input type="checkbox" id="${name}" name="${name}" value="${escapeHtml(on)}" data-off-value="${escapeHtml(str(item2.props, "settings.offValue", "N"))}"${value === on ? " checked" : ""} class="a-Switch-input"><span class="a-Switch-toggle"></span></span>`;
      }
      case "displayOnly": {
        const display = get(item2.props, "lov") ? lov().find((entry) => entry.r === value)?.d ?? value : value;
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
  selector(ctx, props) {
    if (!isObject(props)) return "";
    const type = str(props, "selectionType");
    switch (type) {
      case "button": {
        const id = ref(props, "button");
        const button = this.pageComponents(ctx, "button").find((candidate) => candidate.id === id);
        return button ? `#${str(button.props, "advanced.staticId") || `B_${slug(button.id)}`}` : "";
      }
      case "region": {
        const id = ref(props, "region");
        const region = this.pageComponents(ctx, "region").find((candidate) => candidate.id === id);
        return region ? `#${this.regionDomId(region)}` : "";
      }
      case "items":
      case "item":
        return strings5(list(props, "items").length ? list(props, "items") : list(props, "item")).flatMap((value) => value.split(",")).map((value) => `#${value.trim().toUpperCase()}`).join(",");
      case "jQuerySelector":
      case "jquerySelector":
        return str(props, "jQuerySelector") || str(props, "jquerySelector");
      case "javascriptExpression":
      case "jsExpression":
        return `js:${str(props, "javaScriptExpression") || str(props, "javascriptExpression")}`;
      case "domObject":
        return `js:document.getElementById(${JSON.stringify(str(props, "domObject"))}) || ${JSON.stringify(str(props, "domObject"))}`;
      case "columns":
        this.diagnose("info", "Dynamic actions on interactive grid columns are not simulated", ctx.pageId);
        return "";
      case "triggeringElement":
        return "triggeringElement";
      default:
        return "document";
    }
  }
  dynamicAction(ctx, action) {
    const when = action.props.when;
    const actions = bySequence2(action.children.filter((child) => child.type === "action")).map((child) => {
      const settings2 = isObject(child.props.settings) ? child.props.settings : {};
      return {
        action: str(child.props, "action"),
        selector: this.selector(ctx, child.props.affectedElements),
        fireOnInit: bool(child.props, "execution.fireOnInit", false),
        stopOnError: bool(child.props, "execution.stopExecutionOnError", true),
        wait: bool(child.props, "execution.waitForResult", true),
        whenFalse: str(child.props, "execution.event") === "false" || str(child.props, "execution.fireWhenEventResultIs") === "false",
        settings: Object.fromEntries(
          Object.entries(settings2).map(([key, value]) => [
            key,
            typeof value === "string" ? this.substitute(ctx.session, value, ctx.page, "RAW") : isRef(value) ? value.ref : value
          ])
        )
      };
    });
    const condition = action.props.clientSideCondition;
    const whenProps = isObject(when) ? when : {};
    const event = str(whenProps, "event", "ready");
    return {
      id: action.id,
      event: event === "custom" ? str(whenProps, "customEvent", "custom") : event,
      selector: this.selector(ctx, when),
      scope: str(action.props, "execution.eventScope", "static"),
      container: str(action.props, "execution.staticContainer"),
      timing: str(action.props, "execution.type", "immediate"),
      time: num(action.props, "execution.time", 0),
      immediate: bool(action.props, "execution.immediate", false),
      condition: isObject(condition) ? {
        type: str(condition, "type"),
        item: str(condition, "item").toUpperCase(),
        value: str(condition, "value"),
        list: strings5(list(condition, "list")),
        expression: str(condition, "javaScriptExpression") || str(condition, "javascriptExpression")
      } : null,
      actions
    };
  }
  /** HTML of a single region body for client-side refresh. */
  renderRegionFragment(session, pageKey, regionId) {
    const ctx = this.prepare(session, pageKey);
    const region = this.pageComponents(ctx, "region").find(
      (candidate) => this.regionDomId(candidate) === regionId || candidate.id === regionId
    );
    if (!region) throw new Error(`Region ${regionId} not found`);
    return this.renderRegion(ctx, region);
  }
  /** Loads `.apex-local/*.sql` (or supporting-object scripts) into a fresh database. */
  static seed(db, appRoot) {
    const local = path6.join(appRoot, ".apex-local");
    const scripts = fs6.existsSync(local) ? fs6.readdirSync(local).filter((name) => name.endsWith(".sql")).sort().map((name) => path6.join(local, name)) : [];
    if (!scripts.length) {
      const supporting = path6.join(appRoot, "supporting-objects");
      if (fs6.existsSync(supporting)) {
        scripts.push(
          ...fs6.readdirSync(supporting, { recursive: true, encoding: "utf8" }).filter((name) => name.endsWith(".sql") && !/deinstall|upgrade/iu.test(name)).sort().map((name) => path6.join(supporting, name))
        );
      }
    }
    return scripts.flatMap(
      (script) => db.runScript(fs6.readFileSync(script, "utf8"), path6.relative(appRoot, script))
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
    for (const entry of fs7.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "static-files") continue;
      const full = path7.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith(".apx")) newest = Math.max(newest, fs7.statSync(full).mtimeMs);
    }
  };
  visit(root);
  return newest;
}
async function body2(request, limit = 8 * 1048576) {
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
  constructor(options2) {
    this.options = { ...options2, sourceDir: path7.resolve(options2.sourceDir) };
    this.assets = loadAssets(options2.assetsDir);
    const file = options2.database ?? path7.join(this.options.sourceDir, ".apex-local", "preview.sqlite");
    if (options2.reset && file !== ":memory:")
      for (const suffix of ["", "-wal", "-shm"]) fs7.rmSync(file + suffix, { force: true });
    const fresh = file === ":memory:" || !fs7.existsSync(file);
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
  #static(response, root, relative, cache2) {
    const target2 = path7.resolve(root, decodeURIComponent(relative));
    if (!target2.startsWith(root + path7.sep) || !fs7.existsSync(target2) || !fs7.statSync(target2).isFile()) {
      response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": TYPES[path7.extname(target2).toLowerCase()] ?? "application/octet-stream",
      "cache-control": cache2 ? "public, max-age=86400" : "no-cache"
    });
    fs7.createReadStream(target2).pipe(response);
  }
  #send(response, status, type, content) {
    response.writeHead(status, { "content-type": type, "cache-control": "no-store" }).end(content);
  }
  async #handle(request, response) {
    const url2 = new URL(request.url ?? "/", "http://localhost");
    const pathname = url2.pathname;
    if (pathname.startsWith("/i/"))
      return this.#static(response, path7.resolve(this.assets.imagesDir), pathname.slice(3), true);
    const marker2 = pathname.indexOf(`${LOCAL_PREFIX}/`);
    if (marker2 >= 0) {
      const name = pathname.slice(marker2 + LOCAL_PREFIX.length + 1);
      if (name === "runtime.js")
        return this.#send(response, 200, TYPES[".js"], RUNTIME_JS + extensionClient());
      if (name === "runtime.css")
        return this.#send(response, 200, TYPES[".css"], RUNTIME_CSS + extensionCss());
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
    if ((pathname === "/f" || pathname.endsWith(`${renderer.baseUrl}/f`)) && url2.searchParams.has("p")) {
      const [, pageKey = "", , requestValue = "", , clear = "", names = "", values = ""] = (url2.searchParams.get("p") ?? "").split(":");
      const target2 = renderer.findPage(pageKey || renderer.homePage());
      const query = new URLSearchParams();
      const itemValues = values.split(",");
      names.split(",").filter(Boolean).forEach((name, index) => query.set(name.toLowerCase(), decodeURIComponent(itemValues[index] ?? "")));
      if (clear) query.set("clear", clear);
      if (requestValue) query.set("request", requestValue);
      const location = `${target2 ? renderer.pagePath(target2) : renderer.baseUrl}${query.size ? `?${query}` : ""}`;
      response.writeHead(302, { location }).end();
      return;
    }
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
        path7.join(this.options.sourceDir, "shared-components", "static-files"),
        rest.slice(16),
        false
      );
    if (rest.startsWith("files/workspace/"))
      return this.#static(
        response,
        path7.join(this.options.sourceDir, "workspace-components", "static-files"),
        rest.slice(16),
        false
      );
    const session = this.session(request, response);
    if (rest === "wwv_flow.accept" && request.method === "POST") {
      const form = new URLSearchParams(await body2(request));
      const json3 = JSON.parse(form.getAll("p_json").join("") || "{}");
      const values = Object.fromEntries(
        (json3.pageItems?.itemsToSubmit ?? []).map((item2) => [
          item2.n,
          Array.isArray(item2.v) ? item2.v.join(":") : String(item2.v ?? "")
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
    if (rest.startsWith(`${LOCAL_PREFIX.slice(1)}/x/`)) {
      const handler = routeHandler(rest.slice(LOCAL_PREFIX.length + 2));
      if (!handler) return this.#send(response, 404, "text/plain", "Unknown preview route");
      const result = handler(renderer, session, {
        method: request.method ?? "GET",
        params: url2.searchParams,
        body: request.method === "POST" ? await body2(request) : ""
      });
      const types = {
        json: TYPES[".json"],
        html: TYPES[".html"],
        text: "text/plain; charset=utf-8",
        js: TYPES[".js"]
      };
      return this.#send(response, result.status ?? 200, types[result.type], result.body);
    }
    if (rest === "__logout") {
      session.items = {};
      session.user = this.options.user ?? "DEVELOPER";
      response.writeHead(302, { location: renderer.baseUrl }).end();
      return;
    }
    if (rest === `${LOCAL_PREFIX.slice(1)}/region`) {
      const page2 = url2.searchParams.get("page") ?? "";
      const region = url2.searchParams.get("region") ?? "";
      const target2 = Number(url2.searchParams.get("pg"));
      if (target2 > 0) {
        const component = renderer.findPage(page2)?.children.find((child) => renderer.regionDomId(child) === region);
        if (component) session.pagination[`${page2}:${component.id}`] = target2;
      }
      return this.#send(response, 200, TYPES[".html"], renderer.renderRegionFragment(session, page2, region));
    }
    if (rest === `${LOCAL_PREFIX.slice(1)}/server-code` && request.method === "POST") {
      const input = JSON.parse(await body2(request));
      const values = renderer.executeServerCode(
        session,
        url2.searchParams.get("page") ?? "",
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
        dialogPageId: url2.searchParams.get("page"),
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
    for (const clear of (url2.searchParams.get("clear") ?? "").split(",").map((value) => value.trim()).filter(Boolean)) {
      if (clear.toUpperCase() === "RP") {
        for (const key of Object.keys(session.pagination))
          if (key.startsWith(`${page.id}:`)) delete session.pagination[key];
        continue;
      }
      const cleared = renderer.findPage(clear);
      for (const child of cleared?.children ?? [])
        if (child.type === "pageItem") delete session.items[child.id.toUpperCase()];
      const facets = (children) => children.flatMap(
        (child) => ["facet", "filter", "checkbox"].includes(child.type) ? [child] : facets(child.children)
      );
      for (const facet of facets(cleared?.children ?? [])) delete session.items[facet.id.toUpperCase()];
    }
    if (url2.searchParams.has("apex_theme_style"))
      session.themeStyle = url2.searchParams.get("apex_theme_style") || void 0;
    for (const [key, value] of url2.searchParams) {
      if (!["clear", "request", "session", "cs", "apex_theme_style"].includes(key))
        session.items[key.toUpperCase()] = value;
    }
    const ctx = renderer.prepare(session, page.id, url2.searchParams.get("request") ?? "");
    return this.#send(response, 200, TYPES[".html"], renderer.renderPage(ctx));
  }
};
function checkApplication(options2) {
  const preview = new PreviewServer({ ...options2, database: options2.database ?? ":memory:" });
  try {
    const renderer = preview.renderer;
    const ids = options2.pages?.length ? options2.pages : [...renderer.app.pages.keys()].filter((id) => id !== "0");
    const pages2 = ids.map((id) => {
      const page = renderer.findPage(id);
      const name = str(page?.props ?? {}, "name", id);
      try {
        const session = {
          id: randomUUID(),
          user: options2.user ?? "DEVELOPER",
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
    return { pages: pages2, diagnostics: preview.diagnostics() };
  } finally {
    preview.db.close();
  }
}

// packages/core/src/preview/service.ts
var running = /* @__PURE__ */ new Map();
var DIAGNOSTICS_LIMIT = 60;
async function resolveSource(root, explicit) {
  let source = explicit ? path8.resolve(root, explicit) : void 0;
  if (!source) {
    try {
      const ctx = await loadProject(root);
      source = path8.resolve(ctx.root, ctx.config.application.sourceDir);
    } catch {
      source = path8.resolve(root);
    }
  }
  if (!fs8.existsSync(path8.join(source, "application.apx")))
    throw new Fault(
      "PREVIEW_SOURCE_MISSING",
      `${source} has no application.apx. Pass sourceDir with the APEXlang application folder.`,
      2
    );
  return fs8.realpathSync(source);
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
  for (const target2 of targets) {
    const server = running.get(target2);
    if (!server) continue;
    await server.stop();
    running.delete(target2);
    stopped.push(target2);
  }
  return { stopped, running: [...running.keys()] };
}
async function previewStatus() {
  return {
    assetsDir: defaultAssetsDir(),
    assetsInstalled: fs8.existsSync(path8.join(defaultAssetsDir(), "manifest.json")),
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
async function previewDispatch(operation, parsed2, root) {
  const { action, ...input } = parsed2;
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
