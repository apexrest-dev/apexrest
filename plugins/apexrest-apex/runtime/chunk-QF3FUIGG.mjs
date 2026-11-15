import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  managedHome
} from "./chunk-GGZKKEXV.mjs";

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
  constructor(text) {
    this.#text = text;
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
  "libraries/jointplus/",
  "plugins/com.oracle.apex.carousel/",
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
  #buffer;
  entries = [];
  /** A zip file on disk, or an in-memory archive (an uploaded XLSX workbook). */
  constructor(file) {
    const label = typeof file === "string" ? file : "archive";
    if (typeof file === "string") this.#fd = fs.openSync(file, "r");
    else {
      this.#fd = -1;
      this.#buffer = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
    }
    const size = this.#buffer ? this.#buffer.length : fs.fstatSync(this.#fd).size;
    const tailSize = Math.min(size, 65557);
    const tail = this.#read(size - tailSize, tailSize);
    const eocd = tail.lastIndexOf(Buffer.from([80, 75, 5, 6]));
    if (eocd === -1) throw new Error(`${label} is not a zip archive`);
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
    if (this.#buffer) {
      if (position < 0 || position + length > this.#buffer.length)
        throw new Error("Unexpected end of zip archive");
      return this.#buffer.subarray(position, position + length);
    }
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
    if (this.#fd >= 0) fs.closeSync(this.#fd);
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
  const body = Readable.fromWeb(response.body);
  body.on("data", (chunk) => {
    received += chunk.length;
    if (onProgress && received - reported > 25 * 1048576) {
      reported = received;
      onProgress(
        `downloaded ${(received / 1048576).toFixed(0)}${total ? ` / ${(total / 1048576).toFixed(0)}` : ""} MB`
      );
    }
  });
  await pipeline(body, fs.createWriteStream(target, { mode: 384 }));
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
    const text = fs2.readFileSync(file, "utf8").replace(
      /@([A-Z][A-Z0-9_]*)@/gu,
      (whole, name) => substitutions[name] ?? (name === "APP_ALIAS" ? path2.basename(root).toLowerCase() : name === "APP_NAME" ? path2.basename(root) : whole)
    );
    for (const component of parseApexLang(text, relative)) {
      if (component.type === "app") app = component;
      else if (component.type === "page") pages.set(component.id, component);
      else shared.push(component);
    }
  }
  if (!app) throw new Error(`${appFile} does not declare an app component`);
  return { root, app, pages, shared, substitutions, files };
}

export {
  APEX_FULL_VERSION,
  APEX_DOWNLOAD_URL,
  defaultAssetsDir,
  ZipReader,
  setupAssets,
  loadAssets,
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
