import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  managedHome
} from "./chunk-DFK3P5MT.mjs";

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

export {
  APEX_FULL_VERSION,
  APEX_DOWNLOAD_URL,
  defaultAssetsDir,
  ZipReader,
  setupAssets,
  loadAssets
};
