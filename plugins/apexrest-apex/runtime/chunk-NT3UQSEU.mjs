import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  ApexLangDocument,
  afterColumns,
  appendChild,
  checkNames,
  columnText,
  columnVisible,
  columnsOf,
  contextOf,
  pageFile,
  planColumns,
  queryNames,
  readProperty,
  referenceText,
  removeComponent,
  removeProperty,
  reportRegion,
  runPageTransaction,
  savedReportEdits,
  scalarText,
  setFencedText,
  setProperty,
  setPropertyText,
  visibilityEdits
} from "./chunk-ED46SLPH.mjs";
import {
  renderPageBody,
  renderRegion,
  scaffoldSchema
} from "./chunk-BBZ43UIE.mjs";
import {
  group,
  indent,
  node,
  refreshAction
} from "./chunk-C66KGFY2.mjs";
import {
  managedHome
} from "./chunk-O3XZW7YC.mjs";
import {
  Fault
} from "./chunk-HRRL6FHO.mjs";

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

// packages/core/src/edit/patch.ts
import path2 from "node:path";
import { readFile } from "node:fs/promises";

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
  constructor(template, options, scope) {
    this.#tokens = tokenize(template);
    this.#options = options;
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
    const resolve2 = this.#options.placeholders !== false || this.#isLoopVariable(name);
    if (!resolve2) return void 0;
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
  #text(text2) {
    if (!this.#scope.loop.length) return text2;
    return text2.replace(LOOP_VARIABLE_RE, (whole, name, filter) => {
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
      const text2 = this.#lastDirective ? token.text.replace(/^\s+/u, " ") : token.text;
      this.#output += this.#text(text2);
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
    let position = index;
    for (; position < this.#tokens.length; position += 1) {
      const token = this.#tokens[position];
      if (token.type !== "directive") continue;
      if (Object.hasOwn(match, token.name) && level === 0) break;
      if (token.name === open) level += 1;
      else if (token.name === close) level -= 1;
      if (level < 0) break;
    }
    return position;
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
      let position = index;
      const blank = this.#tokens[position];
      if (blank?.type === "text" && blank.text.trim() === "") position += 1;
      const when = this.#tokens[position];
      if (when?.type !== "directive" || when.name !== "when") {
        this.#warn("'case' must be followed by 'when'");
        return position;
      }
      this.#caseStack.push({
        value: this.#value(arg.replace(/^"([^"]+)"$/u, "$1"), false).trim(),
        matched: false
      });
      return position;
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
    const parsed = LOOP_ARG_RE.exec(arg);
    const separator = parsed ? parsed[1] : ":";
    const name = (parsed ? parsed[2] : arg).trim();
    const value = this.#lookup(name) ?? "";
    const items = value === "" ? [] : value.split(separator.length > 1 ? new RegExp(separator, "u") : separator);
    this.#loopDepth += 1;
    items.forEach((item, position) => {
      this.#scope.loop.push({ APEX$ITEM: item, APEX$I: String(position + 1) });
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
    const matches = [...source.matchAll(ARGUMENT_RE)];
    let depth = 0;
    let current;
    for (let position = 0; position < matches.length; position += 1) {
      const match = matches[position];
      if (depth === 0) current = { name: match[1], start: match.index + match[0].length };
      const stop = matches[position + 1]?.index ?? source.length;
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
    for (const [argument, text2] of argumentText) {
      const escaped = Object.hasOwn(argEscapes, argument);
      args[argument] = /[#&{]|\/\}/u.test(text2) ? new _Engine(
        text2,
        {
          ...this.#options,
          placeholders: true,
          ...escaped ? { defaultEscape: false } : {}
        },
        { ...this.#scope, argEscapes: void 0, loop: [...this.#scope.loop] }
      ).run() : text2;
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
function applyTemplate(template, values, options = {}) {
  if (!/[#{&]/u.test(template)) return template;
  return new Engine(template, options, { values, loop: [] }).run();
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
    byId: /* @__PURE__ */ new Map(),
    options: [],
    groups: []
  };
  for (const call of calls) {
    const params = call.params;
    if (call.kind === "theme") index.theme = params;
    if (call.kind === "template_option") index.options.push(params);
    if (call.kind === "template_opt_group") index.groups.push(params);
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
function templateOptions(options, defaults) {
  const classes = [];
  for (const option of options.length ? options : ["#DEFAULT#"]) {
    if (option === "#DEFAULT#") classes.push(...defaults.split(/[:\s]+/u).filter(Boolean));
    else classes.push(...option.split(/\s+/u).filter(Boolean));
  }
  return [...new Set(classes)].join(" ");
}

// packages/core/src/edit/layout.ts
var LAYOUT_PROPERTIES = [
  "template",
  "templateOptions",
  "column",
  "columnSpan",
  "startNewRow"
];
var isLayoutProperty = (value) => LAYOUT_PROPERTIES.includes(value);
var REFERENCE_TEMPLATES = {
  page: [
    "standard",
    "left-side-column",
    "right-side-column",
    "left-and-right-side-columns",
    "marquee",
    "login",
    "minimal-no-navigation"
  ],
  region: [
    "alert",
    "blank-with-attributes",
    "blank-with-attributes-no-grid",
    "buttons-container",
    "cards-container",
    "carousel-container",
    "collapsible",
    "content-block",
    "hero",
    "image",
    "inline-dialog",
    "inline-drawer",
    "inline-popup",
    "interactive-report",
    "login",
    "search-results-container",
    "standard",
    "tabs-container",
    "title-bar",
    "wizard-container"
  ]
};
var REGION_TYPES = {
  "interactive-report": ["interactiveReport", "interactiveGrid"],
  "cards-container": ["cards"]
};
var installed;
function installedTheme() {
  if (installed === void 0)
    try {
      installed = indexTheme(loadAssets(defaultAssetsDir()).theme);
    } catch {
      installed = null;
    }
  return installed ?? void 0;
}
function themeCatalog() {
  const theme = installedTheme();
  if (!theme)
    return {
      source: "reference",
      pages: new Set(REFERENCE_TEMPLATES.page),
      regions: new Set(REFERENCE_TEMPLATES.region)
    };
  return {
    source: "installed",
    pages: new Set(theme.pages.keys()),
    regions: new Set(theme.regions.keys()),
    options: (kind, template) => {
      const owner = (kind === "page" ? theme.pages : theme.regions).get(template.toLowerCase());
      if (!owner) return void 0;
      const key = kind === "page" ? "page_template_id" : "region_template_id";
      const type = kind === "page" ? "PAGE" : "REGION";
      const options = /* @__PURE__ */ new Map();
      for (const params of theme.options)
        if (params.template_types === type && (params[key] === owner.id || params[key] === void 0 || params[key] === null))
          for (const css of String(params.css_classes ?? "").split(/\s+/u).filter(Boolean))
            options.set(css, params.group_id ? String(params.group_id) : void 0);
      return options;
    }
  };
}
var refOf = (raw) => raw?.replace(/^@\/?/u, "");
var TEMPLATE = /^[a-z][a-z0-9-]{0,127}$/u;
function propertySpan(doc, node2, path3) {
  const property = node2.properties.get(path3);
  if (!property) return void 0;
  let end = property.line;
  if (property.value === "[") while (doc.lines[end].text.trim() !== "]") end++;
  else if (property.opaque)
    throw new Fault("TRANSFORM_UNSUPPORTED", `${path3} holds a multi-line value; edit it in source.`, 5);
  const first = doc.lines[property.line];
  const last = doc.lines[end];
  return {
    start: first.offset,
    end: last.offset + last.text.length + last.eol.length,
    values: doc.lines.slice(property.line + 1, end).map((line) => line.text.trim())
  };
}
function layoutEdit(doc, node2, property, value, context) {
  if (context.release !== "26.2")
    throw new Fault(
      "OPERATION_UNSUPPORTED",
      `${property} edits are qualified for 26.2 sources; edit 26.1 pages in source.`,
      2
    );
  const kind = node2.kind === "page" ? "page" : node2.kind === "region" ? "region" : node2.kind === "pageItem" ? "item" : "";
  const path3 = {
    template: kind === "page" ? "appearance.pageTemplate" : "appearance.template",
    templateOptions: "appearance.templateOptions",
    column: "layout.column",
    columnSpan: "layout.columnSpan",
    startNewRow: "layout.startNewRow"
  }[property];
  const reset = () => {
    const span2 = propertySpan(doc, node2, path3);
    return { edit: span2 ? { start: span2.start, end: span2.end, content: "" } : void 0 };
  };
  if (property === "template") {
    if (kind !== "page" && kind !== "region")
      throw new Fault("OPERATION_UNSUPPORTED", "template applies to pages and regions.", 2);
    if (value === "") return reset();
    if (!TEMPLATE.test(value)) throw new Fault("INVALID_INPUT", `${value} is not a template id.`, 2);
    if (kind === "page" && String(node2.properties.get("appearance.pageMode")?.value ?? "") === "modalDialog")
      throw new Fault(
        "OPERATION_UNSUPPORTED",
        "Modal dialog templates are not supported; edit them in source.",
        2
      );
    const known = kind === "page" ? context.catalog.pages : context.catalog.regions;
    if (!known.has(value))
      throw new Fault(
        "TEMPLATE_UNKNOWN",
        `${value} is not a ${kind} template of the ${context.catalog.source} Universal Theme 26.2.`,
        2
      );
    const type = String(node2.properties.get("type")?.value ?? "");
    if (kind === "region" && REGION_TYPES[value] && !REGION_TYPES[value].includes(type))
      throw new Fault(
        "TEMPLATE_INCOMPATIBLE",
        `${value} is for ${REGION_TYPES[value].join(" or ")} regions, not ${type || "this region"}.`,
        2
      );
    return { path: path3, text: `@/${value}` };
  }
  if (property === "templateOptions") {
    if (kind !== "page" && kind !== "region")
      throw new Fault("OPERATION_UNSUPPORTED", "templateOptions apply to pages and regions.", 2);
    if (value === "") return reset();
    const tokens = [...new Set(value.split(/[\s,]+/u).filter(Boolean))];
    const template = context.template ?? refOf(
      node2.properties.get(kind === "page" ? "appearance.pageTemplate" : "appearance.template")?.value
    ) ?? "standard";
    const valid = context.catalog.options?.(kind, template);
    if (!valid)
      throw new Fault(
        "THEME_UNAVAILABLE",
        "Template options are checked against the installed Universal Theme; run apexrest_preview action:setup first.",
        2
      );
    const groups = /* @__PURE__ */ new Map();
    for (const token of tokens) {
      if (token === "#DEFAULT#") continue;
      if (!valid.has(token))
        throw new Fault("TEMPLATE_OPTION_UNKNOWN", `${token} is not an option of template ${template}.`, 2);
      const group2 = valid.get(token);
      if (group2 && groups.has(group2))
        throw new Fault(
          "TEMPLATE_OPTION_CONFLICT",
          `${token} and ${groups.get(group2)} belong to the same option group.`,
          2
        );
      if (group2) groups.set(group2, token);
    }
    const indent2 = " ".repeat(node2.indent + 8);
    const text2 = tokens.length === 1 ? `templateOptions: ${tokens[0]}` : ["templateOptions: [", ...tokens.map((token) => `    ${token}`), "]"].join(doc.eol + indent2);
    const span2 = propertySpan(doc, node2, path3);
    if (span2) return { edit: { start: span2.start, end: span2.end, content: indent2 + text2 + doc.eol } };
    return { path: path3, text: text2.slice("templateOptions: ".length) };
  }
  if (kind !== "region" && kind !== "item")
    throw new Fault("OPERATION_UNSUPPORTED", `${property} applies to regions and items.`, 2);
  if (value === "") return reset();
  if (property === "startNewRow") {
    if (value !== "true" && value !== "false")
      throw new Fault("INVALID_INPUT", 'startNewRow is "true" or "false".', 2);
    return { path: path3, text: value };
  }
  if (!/^(?:[1-9]|1[0-2])$/u.test(value))
    throw new Fault("INVALID_INPUT", `${property} is a grid column from 1 to 12.`, 2);
  const column = Number(
    property === "column" ? value : context.grid?.column ?? node2.properties.get("layout.column")?.value ?? 0
  );
  const span = Number(
    property === "columnSpan" ? value : context.grid?.columnSpan ?? node2.properties.get("layout.columnSpan")?.value ?? 0
  );
  if (column && span && column - 1 + span > 12)
    throw new Fault(
      "INVALID_INPUT",
      `Column ${column} with span ${span} does not fit the 12-column grid.`,
      2
    );
  return { path: path3, text: value };
}

// packages/core/src/edit/patch.ts
var PATCH_PROPERTIES = [
  "title",
  "label",
  "heading",
  "format",
  "sequence",
  "query",
  "visible",
  ...LAYOUT_PROPERTIES
];
var PATHS = {
  page: {
    title: "title",
    template: "appearance.pageTemplate",
    templateOptions: "appearance.templateOptions"
  },
  region: {
    title: "name",
    sequence: "layout.sequence",
    query: "source.sqlQuery",
    template: "appearance.template",
    templateOptions: "appearance.templateOptions",
    column: "layout.column",
    columnSpan: "layout.columnSpan",
    startNewRow: "layout.startNewRow"
  },
  pageItem: {
    label: "label.label",
    sequence: "layout.sequence",
    column: "layout.column",
    columnSpan: "layout.columnSpan",
    startNewRow: "layout.startNewRow"
  },
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
  let node2;
  let find;
  if (kindToken === "page" && !rest) {
    node2 = page;
    find = (parsed) => parsed;
  } else if (kindToken === "column") {
    const [region, column] = rest.split(".");
    if (!region || !column) throw new Fault("INVALID_INPUT", "Column targets are column:REGION.COLUMN.", 2);
    const owner = ApexLangDocument.one(page.children, "region", region, where);
    node2 = ApexLangDocument.one(owner.children, "column", column, `Region ${owner.key}`);
    find = (parsed) => parsed.children.find((c) => c.type === "region" && c.id.toUpperCase() === owner.key.toUpperCase())?.children.find((c) => c.type === "column" && c.id.toUpperCase() === node2.key.toUpperCase());
  } else if (KINDS[kindToken] && rest) {
    node2 = ApexLangDocument.one(page.children, KINDS[kindToken], rest, where);
    find = (parsed) => parsed.children.find((c) => c.type === node2.kind && c.id.toUpperCase() === node2.key.toUpperCase());
  } else
    throw new Fault(
      "INVALID_INPUT",
      `Unknown target ${operation.target}; use page, region:ID, item:NAME, button:ID or column:REGION.COLUMN.`,
      2
    );
  const pathFor = PATHS[node2.kind]?.[operation.property];
  if (!pathFor)
    throw new Fault(
      "OPERATION_UNSUPPORTED",
      `${operation.property} is not supported on ${node2.kind}; supported: ${Object.keys(PATHS[node2.kind] ?? {}).join(", ")}.`,
      2
    );
  if (operation.property === "sequence" && !/^[1-9]\d{0,8}$/u.test(operation.value))
    throw new Fault("INVALID_INPUT", "sequence must be a positive integer.", 2);
  if (operation.property === "visible" && !["true", "false"].includes(operation.value))
    throw new Fault("INVALID_INPUT", 'visible is "true" or "false".', 2);
  return { node: node2, path: pathFor, find };
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
  const grouped = /* @__PURE__ */ new Map();
  const set = (node2, path3, text2) => {
    const [group2, key] = path3.split(".");
    if (key && !node2.groups.has(group2) && !node2.properties.has(path3)) {
      const id = `${node2.open}:${group2}`;
      const entry = grouped.get(id) ?? { node: node2, group: group2, lines: [] };
      entry.lines.push(`${key}: ${text2}`);
      grouped.set(id, entry);
    } else edits.push(setPropertyText(doc, node2, path3, text2));
  };
  const catalog = resolved.some((entry) => isLayoutProperty(entry.operation.property)) ? themeCatalog() : void 0;
  for (const entry of resolved) {
    const property = entry.operation.property;
    if (property === "query") edits.push(...queryEdits(doc, entry.node, entry.operation, snapshot.release));
    else if (property === "visible") {
      const region = entry.node.parent;
      visibility.set(region, [
        ...visibility.get(region) ?? [],
        { column: entry.node, visible: entry.operation.value === "true" }
      ]);
    } else if (isLayoutProperty(property)) {
      const template = resolved.find(
        (other) => other.node === entry.node && other.operation.property === "template" && other.operation.value
      )?.operation.value;
      const change = layoutEdit(doc, entry.node, property, entry.operation.value, {
        release: snapshot.release,
        catalog,
        template,
        grid: {
          column: resolved.find((other) => other.node === entry.node && other.operation.property === "column")?.operation.value,
          columnSpan: resolved.find(
            (other) => other.node === entry.node && other.operation.property === "columnSpan"
          )?.operation.value
        }
      });
      if ("edit" in change) {
        if (change.edit) edits.push(change.edit);
      } else set(entry.node, change.path, change.text);
    } else set(entry.node, entry.path, scalarText(entry.operation.value));
  }
  for (const { node: node2, group: group2, lines } of grouped.values()) {
    const indent2 = " ".repeat(node2.indent + 4);
    const anchor = doc.lines[node2.children[0]?.open ?? node2.close];
    const body = lines.flatMap((line) => line.split(doc.eol)).map((line, index) => index === 0 || !line.startsWith(" ") ? `${indent2}    ${line}` : line);
    edits.push({
      start: anchor.offset,
      end: anchor.offset,
      content: [`${indent2}${group2} {`, ...body, `${indent2}}`].join(doc.eol) + doc.eol
    });
  }
  for (const [region, changes] of visibility) edits.push(...visibilityEdits(doc, region, changes));
  const verify = (parsedPage) => {
    for (const entry of resolved) {
      const component = entry.find(parsedPage);
      const value = component && readProperty(component, entry.path);
      if (isLayoutProperty(entry.operation.property)) {
        const read = (raw) => raw === void 0 ? "" : Array.isArray(raw) ? raw.map(String).join(" ") : raw && typeof raw === "object" && "ref" in raw ? String(raw.ref).replace(/^\//u, "") : String(raw);
        const expected = entry.operation.property === "templateOptions" ? [...new Set(entry.operation.value.split(/[\s,]+/u).filter(Boolean))].join(" ") : entry.operation.value;
        if (read(value) !== expected)
          throw new Fault(
            "TRANSFORM_INVALID",
            `${entry.operation.target} ${entry.operation.property} did not read back.`,
            5
          );
        continue;
      }
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
  return contextOf(await readFile(file, "utf8"), path2.relative(ctx.root, file).split(path2.sep).join("/"));
}
async function patchPage(ctx, input) {
  const {
    result: _text,
    targets: _targets,
    ...outcome
  } = await runPageTransaction(ctx, input, (operations) => [(snapshot) => planSets(snapshot, operations)]);
  return outcome;
}

// packages/core/src/edit/insert.ts
function merged(list) {
  return {
    regions: list.flatMap((c) => c.regions ?? []),
    items: list.flatMap((c) => c.items ?? []),
    refreshes: list.flatMap((c) => c.refreshes ?? [])
  };
}
function planInsert(snapshot, list) {
  const { doc, node: node2, parsed, pageId, release } = snapshot;
  const components = merged(list);
  const spec = scaffoldSchema.safeParse({
    applicationName: "insert",
    pages: [
      {
        id: Number(pageId),
        name: "insert",
        regions: components.regions ?? [],
        ...components.items?.length ? { items: components.items } : {},
        ...components.refreshes?.length ? { refreshes: components.refreshes } : {}
      }
    ]
  });
  if (!spec.success)
    throw new Fault(
      "INVALID_INPUT",
      `Invalid components: ${spec.error.issues[0]?.path.join(".")} ${spec.error.issues[0]?.message}`,
      2
    );
  const page = spec.data.pages[0];
  if (!page.regions.length && !page.items?.length && !page.refreshes?.length)
    throw new Fault("INVALID_INPUT", "Give regions, items or refreshes to insert.", 2);
  const existing = (type) => new Set(parsed.children.filter((c) => c.type === type).map((c) => c.id.toUpperCase()));
  const regions = existing("region");
  for (const region of page.regions) {
    if (!region.id) throw new Fault("INVALID_INPUT", "Inserted regions need an explicit id.", 2);
    if (regions.has(region.id.toUpperCase()))
      throw new Fault("TARGET_EXISTS", `Region ${region.id} already exists.`, 5);
    regions.add(region.id.toUpperCase());
  }
  const items = existing("pageItem");
  for (const item of page.items ?? []) {
    if (!new RegExp(`^P${pageId}_`, "u").test(item.name.toUpperCase()))
      throw new Fault("INVALID_INPUT", `Item ${item.name} must start with P${pageId}_.`, 2);
    if (items.has(item.name.toUpperCase()))
      throw new Fault("TARGET_EXISTS", `Item ${item.name} already exists.`, 5);
    if (!regions.has(item.region.toUpperCase()))
      throw new Fault("TARGET_NOT_FOUND", `No region ${item.region} for ${item.name}.`, 2);
    items.add(item.name.toUpperCase());
  }
  for (const refresh of page.refreshes ?? []) {
    for (const item of refresh.items)
      if (!items.has(item.toUpperCase()))
        throw new Fault("TARGET_NOT_FOUND", `Refresh item ${item} does not exist.`, 2);
    for (const region of refresh.regions)
      if (!regions.has(region.toUpperCase()))
        throw new Fault("TARGET_NOT_FOUND", `Refresh region ${region} does not exist.`, 2);
  }
  const offset = parsed.children.filter((c) => c.type === "region").length;
  let text2 = page.regions.map((region, index) => renderRegion(region, offset + index, release)).join("\n");
  let rest = renderPageBody(page, release, { regions: false });
  const actions = existing("dynamicAction");
  const refreshNames = [];
  (page.refreshes ?? []).forEach((_refresh, index) => {
    let n = index + 1;
    while (actions.has(`REFRESH-${n}`)) n++;
    actions.add(`REFRESH-${n}`);
    refreshNames.push(`refresh-${n}`);
    rest = rest.replace(`dynamicAction refresh-${index + 1} (`, `dynamicAction refresh-${n} (\0`).replace(`name: Refresh dependent regions ${index + 1}`, `name: Refresh dependent regions ${n}`);
  });
  rest = rest.replaceAll("\0", "");
  text2 = [text2, rest].filter(Boolean).join("\n");
  const lines = text2.split("\n").join(doc.eol) + doc.eol;
  const verify = (after) => {
    for (const region of page.regions)
      if (!after.children.some((c) => c.type === "region" && c.id === region.id))
        throw new Fault("TRANSFORM_INVALID", `Region ${region.id} did not read back.`, 5);
    for (const item of page.items ?? [])
      if (!after.children.some((c) => c.type === "pageItem" && c.id.toUpperCase() === item.name.toUpperCase()))
        throw new Fault("TRANSFORM_INVALID", `Item ${item.name} did not read back.`, 5);
  };
  return {
    edits: [appendChild(doc, node2, lines)],
    verify,
    targets: [
      ...page.regions.map((region) => `region:${region.id}`),
      ...(page.items ?? []).map((item) => `item:${item.name.toUpperCase()}`),
      ...refreshNames.map((name) => `dynamicAction:${name}`)
    ]
  };
}
async function insertComponents(ctx, input) {
  const outcome = await runPageTransaction(
    ctx,
    {
      page: input.page,
      operations: [input.components],
      expectedDigest: input.expectedDigest,
      dryRun: input.dryRun
    },
    (list) => [(snapshot) => planInsert(snapshot, list)]
  );
  return {
    file: outcome.file,
    beforeDigest: outcome.beforeDigest,
    afterDigest: outcome.afterDigest,
    written: outcome.written,
    ...outcome.change ? { change: outcome.change } : {},
    ...outcome.context ? { context: outcome.context } : {},
    ...outcome.written ? { next: outcome.next } : {}
  };
}

// packages/core/src/edit/filter.ts
var FAMILIES = /* @__PURE__ */ new Set(["interactiveReport", "classicReport", "cards", "chart"]);
var REPORTS = /* @__PURE__ */ new Set(["interactiveReport", "classicReport"]);
function filterFragment(operation) {
  if (!operation.targets?.length) throw new Fault("INVALID_INPUT", "addFilter needs at least one target.", 2);
  return {
    regions: operation.region ? [operation.region] : [],
    items: [operation.item],
    refreshes: [{ items: [operation.item.name], regions: operation.targets.map((target) => target.region) }]
  };
}
var bind = (item) => new RegExp(`:${item.replace(/[$#]/gu, "\\$&")}(?![A-Z0-9_$#])`, "iu");
var submitted = (value) => (Array.isArray(value) ? value.map(String) : String(value ?? "").split(",")).map((name) => name.trim()).filter(Boolean);
function submitEdit(doc, owner, item) {
  const property = owner.properties.get("source.pageItemsToSubmit");
  if (!property) return setProperty(doc, owner, "source.pageItemsToSubmit", item);
  if (property.value !== "[") {
    const items = submitted(property.value);
    if (items.some((name) => name.toUpperCase() === item)) return void 0;
    return setProperty(doc, owner, "source.pageItemsToSubmit", [...items, item].join(","));
  }
  const elements = [];
  for (let index = property.line + 1; index < doc.lines.length; index++) {
    const line = doc.lines[index];
    const trimmed = line.text.trim();
    if (trimmed === "]") {
      if (elements.some((name) => name.toUpperCase() === item)) return void 0;
      const first = doc.lines[property.line + 1];
      const indent2 = index > property.line + 1 ? first.text.slice(0, first.text.length - first.text.trimStart().length) : line.text.slice(0, line.text.length - line.text.trimStart().length) + "    ";
      return { start: line.offset, end: line.offset, content: `${indent2}${item}${doc.eol}` };
    }
    if (!/^[A-Za-z0-9_$#]+,?$/u.test(trimmed))
      throw new Fault(
        "TRANSFORM_UNSUPPORTED",
        `pageItemsToSubmit of ${owner.kind} ${owner.key} has an unsupported value; edit it in source.`,
        5
      );
    elements.push(trimmed.replace(/,$/u, ""));
  }
  throw new Fault("TRANSFORM_UNSUPPORTED", `Unclosed pageItemsToSubmit of ${owner.kind} ${owner.key}.`, 5);
}
function planFilters(snapshot, operations) {
  const { doc, node: page } = snapshot;
  const edits = [];
  const checks = [];
  const seen = /* @__PURE__ */ new Set();
  for (const operation of operations) {
    const item = operation.item.name.toUpperCase();
    for (const target of operation.targets) {
      const key = `${target.region.toUpperCase()}:${item}`;
      if (seen.has(key)) throw new Fault("INVALID_INPUT", `Region ${target.region} is listed twice.`, 2);
      seen.add(key);
      const region = ApexLangDocument.one(page.children, "region", target.region, `Page ${page.key}`);
      const type = String(region.properties.get("type")?.value ?? "");
      if (!FAMILIES.has(type))
        throw new Fault(
          "OPERATION_UNSUPPORTED",
          `addFilter supports interactive and classic reports, cards and charts, not ${type || "this region"} (${target.region}). Add the item with insert and edit the region in source.`,
          2
        );
      const sources = [];
      if (type === "chart") {
        if (target.sql || target.columns)
          throw new Fault("INVALID_INPUT", `Chart ${target.region}: give replacement SQL per series.`, 2);
        const series = region.children.filter((child) => child.kind === "series");
        if (!series.length)
          throw new Fault("OPERATION_UNSUPPORTED", `Chart ${target.region} has no series to filter.`, 2);
        for (const given of target.series ?? [])
          if (!series.some((entry) => entry.key.toUpperCase() === given.id.toUpperCase()))
            throw new Fault("TARGET_NOT_FOUND", `Chart ${target.region} has no series ${given.id}.`, 2);
        for (const entry of series) {
          const replacement = target.series?.find(
            (given) => given.id.toUpperCase() === entry.key.toUpperCase()
          );
          if (replacement) edits.push(setFencedText(doc, entry, "source.sqlQuery", replacement.sql));
          sources.push({
            owner: entry,
            label: `${target.region} series ${entry.key}`,
            sql: replacement?.sql ?? fenced(doc, entry),
            find: (parsed) => parsed.children.find((c) => c.type === "region" && c.id.toUpperCase() === region.key.toUpperCase())?.children.find((c) => c.type === "series" && c.id.toUpperCase() === entry.key.toUpperCase())
          });
        }
      } else {
        if (target.series) throw new Fault("INVALID_INPUT", `${target.region} is not a chart.`, 2);
        if (target.sql !== void 0) {
          if (REPORTS.has(type))
            edits.push(
              ...queryEdits(
                doc,
                region,
                {
                  target: `region:${region.key}`,
                  property: "query",
                  value: target.sql,
                  columns: target.columns
                },
                snapshot.release
              )
            );
          else {
            if (target.columns) throw new Fault("INVALID_INPUT", "columns apply to reports only.", 2);
            edits.push(setFencedText(doc, region, "source.sqlQuery", target.sql));
          }
        }
        sources.push({
          owner: region,
          label: target.region,
          sql: target.sql ?? fenced(doc, region),
          find: (parsed) => parsed.children.find(
            (c) => c.type === "region" && c.id.toUpperCase() === region.key.toUpperCase()
          )
        });
      }
      for (const source of sources) {
        if (!bind(item).test(source.sql))
          throw new Fault(
            "FILTER_NOT_BOUND",
            `The ${source.label} query does not reference :${item}. Pass complete replacement SQL that filters on it; predicates are not rewritten.`,
            2
          );
        const edit = submitEdit(doc, source.owner, item);
        if (edit) edits.push(edit);
        checks.push({ source, item });
      }
    }
  }
  const verify = (after) => {
    for (const { source, item } of checks) {
      const component = source.find(after);
      const items = submitted(component && readProperty(component, "source.pageItemsToSubmit"));
      const sql = String((component && readProperty(component, "source.sqlQuery")) ?? "");
      if (!items.some((name) => name.toUpperCase() === item) || !bind(item).test(sql))
        throw new Fault("TRANSFORM_INVALID", `${source.label} does not submit and bind ${item}.`, 5);
    }
  };
  return {
    edits,
    verify,
    targets: operations.flatMap((operation) => operation.targets.map((target) => `region:${target.region}`))
  };
}
function fenced(doc, node2) {
  const property = node2.properties.get("source.sqlQuery");
  if (!property?.fence || property.fence.close < 0)
    throw new Fault(
      "OPERATION_UNSUPPORTED",
      `${node2.kind} ${node2.key} has no SQL query literal; pass complete replacement SQL.`,
      2
    );
  return doc.lines.slice(property.fence.open + 1, property.fence.close).map((line) => line.text).join("\n");
}

// packages/core/src/edit/dialog.ts
var ID = /^[a-z][a-z0-9_-]{0,254}$/iu;
var ITEM = /^P\d{1,5}_[A-Z0-9_$#]{1,120}$/iu;
var DML = /formAutomaticRowProcessing|nativeFormDml|formDml|interactiveGridAutomaticRowProcessing|plsqlCode|executeCode/u;
var refOf2 = (value) => value && typeof value === "object" && "ref" in value ? String(value.ref) : String(value ?? "").replace(/^@/u, "");
var dialogDependencies = (operations) => operations.map((operation) => `page:${operation.target.page}`);
function targetText(target) {
  const items = Object.entries(target.items ?? {});
  return group(
    "target:",
    [
      `page: ${target.page}`,
      items.length ? group(
        "items:",
        items.map(([key, value]) => `${key.toUpperCase()}: ${JSON.stringify(value)}`).join("\n")
      ) : "",
      target.clearCache?.length ? `clearCache: ${target.clearCache.join(",")}` : ""
    ].filter(Boolean).join("\n")
  );
}
function replaceGroup(doc, owner, name, text2) {
  const existing = owner.groups.get(name);
  const body = indent(text2, owner.indent + 4).split("\n").join(doc.eol) + doc.eol;
  if (existing) {
    const open = doc.lines[existing.open];
    const close = doc.lines[existing.close];
    return { start: open.offset, end: close.offset + close.text.length + close.eol.length, content: body };
  }
  const before = doc.lines[owner.children[0]?.open ?? owner.close];
  return { start: before.offset, end: before.offset, content: body };
}
function planDialogs(snapshot, operations) {
  const { doc, node: page, parsed, release, related } = snapshot;
  const edits = [];
  const warnings = [];
  const checks = [];
  const targets = [];
  const buttons = new Set(page.children.filter((c) => c.kind === "button").map((c) => c.key.toUpperCase()));
  const actions = new Set(
    page.children.filter((c) => c.kind === "dynamicAction").map((c) => c.key.toUpperCase())
  );
  let appended = "";
  for (const operation of operations) {
    if (Boolean(operation.button) === Boolean(operation.link))
      throw new Fault("INVALID_INPUT", "addDialogAction needs either button or link.", 2);
    const modal = related.get(`page:${operation.target.page}`);
    if (!modal)
      throw new Fault("TARGET_NOT_FOUND", `No page file declares page ${operation.target.page}.`, 2);
    if (operation.expectedTargetDigest && operation.expectedTargetDigest !== modal.digest)
      throw new Fault(
        "TRANSFORM_CONFLICT",
        `${modal.file} changed since it was read; read it again and retry.`,
        5,
        "conflict",
        {
          file: modal.file,
          currentDigest: modal.digest
        }
      );
    if (readProperty(modal.parsed, "appearance.pageMode") !== "modalDialog")
      throw new Fault("TARGET_NOT_MODAL", `Page ${operation.target.page} is not a modal dialog page.`, 2);
    const modalItems = new Set(
      modal.parsed.children.filter((c) => c.type === "pageItem").map((c) => c.id.toUpperCase())
    );
    for (const name of Object.keys(operation.target.items ?? {})) {
      if (!ITEM.test(name)) throw new Fault("INVALID_INPUT", `${name} is not a page item name.`, 2);
      if (!modalItems.has(name.toUpperCase()))
        throw new Fault("TARGET_NOT_FOUND", `Page ${operation.target.page} has no item ${name}.`, 2);
    }
    if (!readProperty(modal.parsed, "security.authorizationScheme") && modal.parsed.children.some(
      (c) => c.type === "process" && DML.test(String(readProperty(c, "type") ?? ""))
    ))
      warnings.push(
        `Page ${operation.target.page} runs processes without a page authorization scheme; review its authorization (none was added).`
      );
    const target = targetText(operation.target);
    let refreshRegion = operation.refresh;
    let when;
    if (operation.button) {
      const button = operation.button;
      if (!ID.test(button.id)) throw new Fault("INVALID_INPUT", `${button.id} is not a valid button id.`, 2);
      if (buttons.has(button.id.toUpperCase()))
        throw new Fault("TARGET_EXISTS", `Button ${button.id} already exists.`, 5);
      buttons.add(button.id.toUpperCase());
      ApexLangDocument.one(page.children, "region", button.region, `Page ${page.key}`);
      if (!refreshRegion)
        throw new Fault("INVALID_INPUT", "A dialog button needs refresh: the region to update.", 2);
      const sequence = Math.max(
        0,
        ...parsed.children.filter((c) => c.type === "button" && refOf2(readProperty(c, "layout.region")) === button.region).map((c) => Number(readProperty(c, "layout.sequence")) || 0)
      ) + 10;
      appended += node("button", button.id, [
        `buttonName: ${button.id.replaceAll("-", "_").toUpperCase()}`,
        `label: ${scalarText(button.label)}`,
        group(
          "layout",
          `sequence: ${sequence}
region: @${button.region}
slot: ${release === "26.1" ? "next" : "NEXT"}`
        ),
        group("appearance", "buttonTemplate: @/text\ntemplateOptions: #DEFAULT#"),
        group("behavior", `action: redirectThisApp
${target}`)
      ]);
      when = `event: apexafterclosedialog
selectionType: button
button: @${button.id}`;
      targets.push(`button:${button.id}`);
      checks.push((after) => {
        if (!after.children.some((c) => c.type === "button" && c.id === button.id))
          throw new Fault("TRANSFORM_INVALID", `Button ${button.id} did not read back.`, 5);
      });
    } else {
      const link = operation.link;
      const region = ApexLangDocument.one(page.children, "region", link.region, `Page ${page.key}`);
      const type = reportRegion(region, "A row link");
      const rowColumns = new Set(
        region.children.filter((c) => c.kind === "column").map((c) => c.key.toUpperCase())
      );
      for (const value of Object.values(operation.target.items ?? {}))
        for (const [, column] of value.matchAll(/#([A-Z0-9_$]+)#/giu))
          if (!rowColumns.has(column.toUpperCase()))
            throw new Fault("TARGET_NOT_FOUND", `${region.key} has no column ${column} for #${column}#.`, 2);
      if (type === "interactiveReport") {
        if (link.column)
          throw new Fault("INVALID_INPUT", "Interactive reports link the whole row; omit column.", 2);
        edits.push(replaceGroup(doc, region, "link", group("link", `linkColumn: customTarget
${target}`)));
      } else {
        if (!link.column)
          throw new Fault("INVALID_INPUT", "Classic report links need the column to link.", 2);
        const column = ApexLangDocument.one(region.children, "column", link.column, `Region ${region.key}`);
        edits.push(setProperty(doc, column, "type", "link"));
        edits.push(
          replaceGroup(
            doc,
            column,
            "link",
            group(
              "link",
              `linkText: ${scalarText(link.linkText ?? `#${column.key.toUpperCase()}#`)}
${target}`
            )
          )
        );
      }
      refreshRegion ??= region.key;
      when = `event: apexafterclosedialog
selectionType: region
region: @${region.key}`;
      targets.push(`region:${region.key}`);
      checks.push((after) => {
        const parsedRegion = after.children.find((c) => c.type === "region" && c.id === region.key);
        const owner = type === "interactiveReport" ? parsedRegion : parsedRegion?.children.find(
          (c) => c.type === "column" && c.id.toUpperCase() === link.column.toUpperCase()
        );
        const page2 = owner && readProperty(owner, "link.target")?.page;
        if (String(page2) !== String(operation.target.page))
          throw new Fault("TRANSFORM_INVALID", `${link.region} link did not read back.`, 5);
      });
    }
    ApexLangDocument.one(page.children, "region", refreshRegion, `Page ${page.key}`);
    const reused = parsed.children.some(
      (c) => c.type === "dynamicAction" && readProperty(c, "when.event") === "apexafterclosedialog" && (operation.button ? refOf2(readProperty(c, "when.button")) === operation.button.id : refOf2(readProperty(c, "when.region")) === operation.link.region) && c.children.some(
        (action) => readProperty(action, "action") === "refresh" && readProperty(action, "affectedElements.region")?.ref === refreshRegion
      )
    );
    if (!reused) {
      let name = `dialog-closed-${refreshRegion}`;
      for (let n = 2; actions.has(name.toUpperCase()); n++) name = `dialog-closed-${refreshRegion}-${n}`;
      actions.add(name.toUpperCase());
      appended += node("dynamicAction", name, [
        `name: ${JSON.stringify(`Refresh ${refreshRegion} after dialog`)}`,
        group("execution", "sequence: 10"),
        group("when", when),
        refreshAction("refresh", refreshRegion, 10)
      ]);
      targets.push(`dynamicAction:${name}`);
    }
  }
  if (appended)
    edits.push(appendChild(doc, page, indent(appended.trimEnd()).split("\n").join(doc.eol) + doc.eol));
  return {
    edits,
    verify: (after) => checks.forEach((check) => check(after)),
    targets,
    warnings: [...new Set(warnings)]
  };
}

// packages/core/src/edit/bind-lov.ts
var LIST_ITEMS = /* @__PURE__ */ new Set([
  "selectList",
  "radioGroup",
  "popupLov",
  "checkboxGroup",
  "shuttle",
  "selectOne",
  "selectMany",
  "combobox",
  "listManager"
]);
var SOURCE = /* @__PURE__ */ new Set([
  "type",
  "lov",
  "staticValues",
  "sqlQuery",
  "plsqlFunctionBody",
  "javaScriptFunctionBody",
  "language",
  "location",
  "tableName",
  "tableOwner",
  "whereClause",
  "orderByClause",
  "displayColumn",
  "returnColumn",
  "remoteServer",
  "restSource"
]);
var SETTINGS = /* @__PURE__ */ new Set(["displayNullValue", "nullDisplayValue", "nullReturnValue", "displayExtraValues"]);
var bindLovDependencies = (operations) => operations.map((operation) => `lov:${operation.lov}`);
var refOf3 = (value) => value && typeof value === "object" && "ref" in value ? String(value.ref) : String(value ?? "").replace(/^@/u, "");
function groupLines(doc, owner, name) {
  const range = owner.groups.get(name);
  if (!range) return [];
  const lines = [];
  for (const [path3, property] of owner.properties) {
    if (!path3.startsWith(name + ".")) continue;
    const key = path3.slice(name.length + 1);
    if (key.includes("."))
      throw new Fault(
        "TRANSFORM_UNSUPPORTED",
        `${owner.key} ${name}.${key} is nested; edit it in source.`,
        5
      );
    if (property.opaque && !SOURCE.has(key))
      throw new Fault(
        "TRANSFORM_UNSUPPORTED",
        `${owner.key} ${path3} holds a multi-line value; edit it in source.`,
        5
      );
    lines.push({ key, text: doc.lines[property.line].text.trim() });
  }
  return lines;
}
function replaceGroup2(doc, owner, name, text2) {
  const existing = owner.groups.get(name);
  const body = text2 ? indent(text2, owner.indent + 4).split("\n").join(doc.eol) + doc.eol : "";
  if (existing) {
    const open = doc.lines[existing.open];
    const close = doc.lines[existing.close];
    return { start: open.offset, end: close.offset + close.text.length + close.eol.length, content: body };
  }
  if (!body) return void 0;
  const before = doc.lines[owner.children[0]?.open ?? owner.close];
  return { start: before.offset, end: before.offset, content: body };
}
function planBindLov(snapshot, operations) {
  const { doc, node: page, parsed, release, related } = snapshot;
  if (release !== "26.2")
    throw new Fault(
      "OPERATION_UNSUPPORTED",
      "bindLov is qualified for 26.2 sources; edit 26.1 items in source.",
      2
    );
  const edits = [];
  const checks = [];
  const items = new Set(parsed.children.filter((c) => c.type === "pageItem").map((c) => c.id.toUpperCase()));
  const seen = /* @__PURE__ */ new Set();
  for (const operation of operations) {
    const item = ApexLangDocument.one(page.children, "pageItem", operation.item, `Page ${page.key}`);
    if (seen.has(item.key.toUpperCase()))
      throw new Fault("TRANSFORM_CONFLICT", `${item.key} is bound twice.`, 5);
    seen.add(item.key.toUpperCase());
    const type = String(item.properties.get("type")?.value ?? "");
    if (!LIST_ITEMS.has(type))
      throw new Fault(
        "OPERATION_UNSUPPORTED",
        `${item.key} is a ${type || "item without a type"}, not a list item.`,
        2
      );
    const lov = related.get(`lov:${operation.lov}`);
    if (!lov) throw new Fault("TARGET_NOT_FOUND", `No shared LOV ${operation.lov}.`, 2);
    if (operation.expectedLovDigest && operation.expectedLovDigest !== lov.digest)
      throw new Fault(
        "TRANSFORM_CONFLICT",
        `${lov.file} changed since it was read; read it again and retry.`,
        5,
        "conflict",
        {
          file: lov.file,
          currentDigest: lov.digest
        }
      );
    const id = lov.parsed.id;
    const kept = groupLines(doc, item, "lov").filter((line) => !SOURCE.has(line.key));
    const settings = new Map(kept.map((line) => [line.key, line.text]));
    if (operation.nullValue === false) {
      for (const key of ["displayNullValue", "nullDisplayValue", "nullReturnValue"]) settings.delete(key);
      settings.set("displayNullValue", "displayNullValue: false");
    } else if (operation.nullValue) {
      settings.set("displayNullValue", "displayNullValue: true");
      settings.set("nullDisplayValue", `nullDisplayValue: ${scalarText(operation.nullValue.display)}`);
      if (operation.nullValue.return !== void 0)
        settings.set("nullReturnValue", `nullReturnValue: ${scalarText(operation.nullValue.return)}`);
      else settings.delete("nullReturnValue");
    }
    if (operation.displayExtraValues !== void 0)
      settings.set("displayExtraValues", `displayExtraValues: ${operation.displayExtraValues}`);
    const ordered = [
      ...[...SETTINGS].filter((key) => settings.has(key)).map((key) => settings.get(key)),
      ...[...settings].filter(([key]) => !SETTINGS.has(key)).map(([, text2]) => text2)
    ];
    edits.push(
      replaceGroup2(
        doc,
        item,
        "lov",
        group("lov", ["type: sharedComponent", `lov: @${id}`, ...ordered].join("\n"))
      )
    );
    if (operation.cascade !== void 0) {
      if (operation.cascade === null) {
        const removal = replaceGroup2(doc, item, "cascadingLov", "");
        if (removal) edits.push(removal);
      } else {
        const parents = operation.cascade.parentItems.map((name) => name.toUpperCase());
        const submitted2 = (operation.cascade.itemsToSubmit ?? []).map((name) => name.toUpperCase());
        if (!parents.length) throw new Fault("INVALID_INPUT", "cascade needs parentItems.", 2);
        for (const name of [...parents, ...submitted2]) {
          if (name === item.key.toUpperCase())
            throw new Fault("INVALID_INPUT", `${item.key} cannot cascade from itself.`, 2);
          if (!items.has(name))
            throw new Fault("TARGET_NOT_FOUND", `Page ${page.key} has no item ${name}.`, 2);
        }
        edits.push(
          replaceGroup2(
            doc,
            item,
            "cascadingLov",
            group(
              "cascadingLov",
              [
                `parentItems: ${parents.join(",")}`,
                submitted2.length ? `itemsToSubmit: ${submitted2.join(",")}` : "",
                operation.cascade.parentRequired !== void 0 ? `parentRequired: ${operation.cascade.parentRequired}` : ""
              ].filter(Boolean).join("\n")
            )
          )
        );
      }
    }
    checks.push((after) => {
      const component = after.children.find(
        (c) => c.type === "pageItem" && c.id.toUpperCase() === item.key.toUpperCase()
      );
      if (!component || readProperty(component, "lov.type") !== "sharedComponent" || refOf3(readProperty(component, "lov.lov")) !== id)
        throw new Fault("TRANSFORM_INVALID", `${item.key} LOV binding did not read back.`, 5);
    });
  }
  return {
    edits,
    verify: (after) => checks.forEach((check) => check(after)),
    targets: operations.map((operation) => `item:${operation.item.toUpperCase()}`)
  };
}

// packages/core/src/edit/move.ts
var ITEM_SLOTS = ["regionBody", "body", "contentBody"];
var BUTTON_SLOTS = [
  "next",
  "previous",
  "edit",
  "create",
  "close",
  "change",
  "delete",
  "copy",
  "up",
  "regionBody",
  "belowBox",
  "top",
  "bottom"
];
var SUB_REGION_SLOTS = ["subRegions", "regionBody", "body"];
var PAGE_SLOTS = {
  normal: ["body", "breadcrumbBar", "leftColumn", "rightSideColumn"],
  modal: ["contentBody", "dialogFooter"]
};
var KINDS2 = { item: "pageItem", button: "button", region: "region" };
var refOf4 = (value) => value && typeof value === "object" && "ref" in value ? String(value.ref) : value === void 0 ? void 0 : String(value).replace(/^@/u, "");
function planMoves(snapshot, operations) {
  const { doc, node: page, parsed } = snapshot;
  const modal = readProperty(parsed, "appearance.pageMode") === "modalDialog";
  const edits = [];
  const checks = [];
  const seen = /* @__PURE__ */ new Set();
  const regions = page.children.filter((child) => child.kind === "region");
  for (const operation of operations) {
    const at = operation.component.indexOf(":");
    const kind = KINDS2[operation.component.slice(0, at)];
    const id = operation.component.slice(at + 1);
    if (at < 1 || !kind || !id)
      throw new Fault("INVALID_INPUT", "component is item:NAME, button:ID or region:ID.", 2);
    const node2 = ApexLangDocument.one(page.children, kind, id, `Page ${page.key}`);
    if (seen.has(`${kind}:${node2.key.toUpperCase()}`))
      throw new Fault("TRANSFORM_CONFLICT", `${operation.component} is moved twice.`, 5);
    seen.add(`${kind}:${node2.key.toUpperCase()}`);
    const { region: destination, slot, sequence } = operation.to;
    const parentPath = kind === "region" ? "layout.parentRegion" : "layout.region";
    let target;
    if (destination !== void 0) {
      target = ApexLangDocument.one(regions, "region", destination, `Page ${page.key}`);
      if (kind === "region") {
        for (let current = target; current; ) {
          if (current === node2)
            throw new Fault("INVALID_INPUT", `${node2.key} cannot move into itself or a sub-region.`, 2);
          const parent = refOf4(current.properties.get("layout.parentRegion")?.value);
          current = parent ? regions.find((region) => region.key.toUpperCase() === parent.toUpperCase()) : void 0;
        }
      }
    } else if (kind !== "region")
      throw new Fault("INVALID_INPUT", `${operation.component} needs a destination region.`, 2);
    const targetType = target ? String(target.properties.get("type")?.value ?? "") : "";
    const allowed = kind === "pageItem" ? ITEM_SLOTS : kind === "button" ? [
      ...BUTTON_SLOTS,
      ...targetType === "interactiveReport" ? ["rightOfInteractiveReportSearchBar"] : []
    ] : target ? SUB_REGION_SLOTS : PAGE_SLOTS[modal ? "modal" : "normal"];
    if (!allowed.includes(slot))
      throw new Fault(
        "OPERATION_UNSUPPORTED",
        `Slot ${slot} is not supported for this move; use one of ${allowed.join(", ")} or edit the source.`,
        2
      );
    if (sequence !== void 0 && !(Number.isInteger(sequence) && sequence > 0 && sequence < 1e9))
      throw new Fault("INVALID_INPUT", "sequence must be a positive integer.", 2);
    const currentParent = refOf4(node2.properties.get(parentPath)?.value);
    if (!node2.groups.has("layout")) {
      const lines = [
        target ? `${parentPath.slice("layout.".length)}: ${referenceText(target.key)}` : "",
        `slot: ${slot}`,
        sequence !== void 0 ? `sequence: ${sequence}` : ""
      ].filter(Boolean);
      const indent2 = " ".repeat(node2.indent + 4);
      const before = doc.lines[node2.children[0]?.open ?? node2.close];
      edits.push({
        start: before.offset,
        end: before.offset,
        content: [`${indent2}layout {`, ...lines.map((line) => `${indent2}    ${line}`), `${indent2}}`].join(doc.eol) + doc.eol
      });
    } else {
      if (target) {
        if (currentParent?.toUpperCase() !== target.key.toUpperCase())
          edits.push(setPropertyText(doc, node2, parentPath, referenceText(target.key)));
      } else if (currentParent !== void 0) {
        const removal = removeProperty(doc, node2, parentPath);
        if (removal) edits.push(removal);
      }
      if (String(node2.properties.get("layout.slot")?.value ?? "") !== slot)
        edits.push(setPropertyText(doc, node2, "layout.slot", slot));
      if (sequence !== void 0 && Number(node2.properties.get("layout.sequence")?.value) !== sequence)
        edits.push(setPropertyText(doc, node2, "layout.sequence", String(sequence)));
    }
    checks.push((after) => {
      const type = kind;
      const moved = after.children.find(
        (c) => c.type === type && c.id.toUpperCase() === node2.key.toUpperCase()
      );
      const parent = moved && refOf4(readProperty(moved, parentPath));
      if (!moved || readProperty(moved, "layout.slot") !== slot || (target ? parent?.toUpperCase() !== target.key.toUpperCase() : parent !== void 0) || after.children.filter((c) => c.type === type && c.id.toUpperCase() === node2.key.toUpperCase()).length !== 1)
        throw new Fault(
          "TRANSFORM_INVALID",
          `${operation.component} did not read back at its destination.`,
          5
        );
    });
  }
  return {
    edits,
    verify: (after) => checks.forEach((check) => check(after)),
    targets: operations.map((operation) => operation.component)
  };
}

// packages/core/src/edit/page-edit.ts
function editGroups(operations) {
  const sets = [];
  const inserts = [];
  const filters = [];
  const columns = [];
  const dialogs = [];
  const bindings = [];
  const moves = [];
  for (const operation of operations) {
    if (operation.op === "moveComponent") {
      moves.push(operation);
      continue;
    }
    if (operation.op === "bindLov") {
      bindings.push(operation);
      continue;
    }
    if (operation.op === "addDialogAction") {
      dialogs.push(operation);
      continue;
    }
    if (operation.op === "addColumn" || operation.op === "orderColumns") {
      columns.push(operation);
      continue;
    }
    if (operation.op === "addFilter") {
      inserts.push(filterFragment(operation));
      filters.push(operation);
      continue;
    }
    if (operation.op === "set") {
      const { op: _op, ...set } = operation;
      sets.push(set);
    } else if (operation.op === "insert") inserts.push(operation.components);
    else throw new Fault("INVALID_INPUT", `Unknown edit op ${operation.op}.`, 2);
  }
  const groups = [];
  if (sets.length) groups.push((snapshot) => planSets(snapshot, sets));
  if (inserts.length) groups.push((snapshot) => planInsert(snapshot, inserts));
  if (filters.length) groups.push((snapshot) => planFilters(snapshot, filters));
  if (columns.length) groups.push((snapshot) => planColumns(snapshot, columns));
  if (dialogs.length) groups.push((snapshot) => planDialogs(snapshot, dialogs));
  if (bindings.length) groups.push((snapshot) => planBindLov(snapshot, bindings));
  if (moves.length) groups.push((snapshot) => planMoves(snapshot, moves));
  return groups;
}
async function editPage(ctx, input) {
  const { result: _text, ...outcome } = await runPageTransaction(
    ctx,
    input,
    editGroups,
    (operations) => [
      ...dialogDependencies(
        operations.filter(
          (operation) => operation.op === "addDialogAction"
        )
      ),
      ...bindLovDependencies(
        operations.filter((operation) => operation.op === "bindLov")
      )
    ]
  );
  return outcome;
}

export {
  APEX_FULL_VERSION,
  APEX_DOWNLOAD_URL,
  defaultAssetsDir,
  ZipReader,
  setupAssets,
  loadAssets,
  registerNamedTemplates,
  escapeValue,
  applyTemplate,
  indexTheme,
  text,
  defaultStaticId,
  escapeHtml,
  escapeJs,
  applyEscape,
  fill,
  templateOptions,
  PATCH_PROPERTIES,
  pageContext,
  patchPage,
  insertComponents,
  ITEM_SLOTS,
  BUTTON_SLOTS,
  SUB_REGION_SLOTS,
  PAGE_SLOTS,
  editPage
};
