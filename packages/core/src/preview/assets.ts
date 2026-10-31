import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import { managedHome } from '../config.ts';
import { parseThemeSql, type ThemeCall } from './theme-sql.ts';

export const APEX_VERSION = '26.2';
export const APEX_FULL_VERSION = '26.2.0';
export const APEX_DOWNLOAD_URL = `https://download.oracle.com/otn_software/apex/apex_${APEX_VERSION}_en.zip`;
export const APEX_ASSETS_ENV = 'APEXREST_PREVIEW_ASSETS';

/** Only the browser runtime a Universal Theme page needs; the full image tree is ~500 MB. */
const IMAGE_PREFIXES = [
  'libraries/apex/',
  'libraries/jquery/',
  'libraries/jquery-ui/',
  'libraries/jquery-migrate/',
  'libraries/font-apex/',
  'libraries/oracle-fonts/',
  'libraries/apex-utility-css/',
  'libraries/purify/',
  'libraries/hammer/',
  'libraries/fullcalendar/',
  'libraries/markedjs/',
  'libraries/cropperjs/',
  'libraries/jointplus/',
  'plugins/com.oracle.apex.carousel/',
  `themes/theme_42/${APEX_VERSION}/`,
  'app_ui/',
  'css/',
];
const THEME_SQL = `apex/core/themes/f8842.${APEX_VERSION.replace('.', '')}.sql`;

export interface AssetsManifest {
  apexVersion: string;
  source: string;
  sha256: string;
  extractedAt: string;
  files: number;
}

export interface ApexAssets {
  dir: string;
  imagesDir: string;
  manifest: AssetsManifest;
  theme: ThemeCall[];
}

export function defaultAssetsDir(environment: NodeJS.ProcessEnv = process.env): string {
  const configured = environment[APEX_ASSETS_ENV];
  return configured ? path.resolve(configured) : path.join(managedHome(), 'preview', APEX_VERSION);
}

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  localHeaderOffset: number;
}

/** Minimal central-directory reader: stored and deflated entries, no ZIP64 (the APEX zip needs neither). */
export class ZipReader {
  #fd: number;
  #buffer: Buffer | undefined;
  readonly entries: ZipEntry[] = [];

  /** A zip file on disk, or an in-memory archive (an uploaded XLSX workbook). */
  constructor(file: string | Uint8Array) {
    const label = typeof file === 'string' ? file : 'archive';
    if (typeof file === 'string') this.#fd = fs.openSync(file, 'r');
    else {
      this.#fd = -1;
      this.#buffer = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
    }
    const size = this.#buffer ? this.#buffer.length : fs.fstatSync(this.#fd).size;
    const tailSize = Math.min(size, 65_557);
    const tail = this.#read(size - tailSize, tailSize);
    const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd === -1) throw new Error(`${label} is not a zip archive`);
    const count = tail.readUInt16LE(eocd + 10);
    const directorySize = tail.readUInt32LE(eocd + 12);
    const directoryOffset = tail.readUInt32LE(eocd + 16);
    if (directoryOffset === 0xffffffff || count === 0xffff)
      throw new Error('ZIP64 archives are not supported');
    const directory = this.#read(directoryOffset, directorySize);
    let offset = 0;
    for (let index = 0; index < count; index += 1) {
      if (directory.readUInt32LE(offset) !== 0x02014b50) throw new Error('Corrupt zip central directory');
      const nameLength = directory.readUInt16LE(offset + 28);
      const extraLength = directory.readUInt16LE(offset + 30);
      const commentLength = directory.readUInt16LE(offset + 32);
      this.entries.push({
        method: directory.readUInt16LE(offset + 10),
        compressedSize: directory.readUInt32LE(offset + 20),
        size: directory.readUInt32LE(offset + 24),
        localHeaderOffset: directory.readUInt32LE(offset + 42),
        name: directory.toString('utf8', offset + 46, offset + 46 + nameLength),
      });
      offset += 46 + nameLength + extraLength + commentLength;
    }
  }

  #read(position: number, length: number): Buffer {
    if (this.#buffer) {
      if (position < 0 || position + length > this.#buffer.length)
        throw new Error('Unexpected end of zip archive');
      return this.#buffer.subarray(position, position + length);
    }
    const buffer = Buffer.alloc(length);
    let done = 0;
    while (done < length) {
      const read = fs.readSync(this.#fd, buffer, done, length - done, position + done);
      if (read === 0) throw new Error('Unexpected end of zip archive');
      done += read;
    }
    return buffer;
  }

  read(entry: ZipEntry): Buffer {
    const header = this.#read(entry.localHeaderOffset, 30);
    if (header.readUInt32LE(0) !== 0x04034b50) throw new Error(`Corrupt local header for ${entry.name}`);
    const start = entry.localHeaderOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
    const data = this.#read(start, entry.compressedSize);
    if (entry.method === 0) return data;
    if (entry.method === 8) return zlib.inflateRawSync(data);
    throw new Error(`Unsupported zip compression method ${entry.method} for ${entry.name}`);
  }

  close(): void {
    if (this.#fd >= 0) fs.closeSync(this.#fd);
  }
}

async function sha256(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest('hex');
}

async function download(url: string, target: string, onProgress?: (message: string) => void): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body)
    throw new Error(`Download failed: ${response.status} ${response.statusText} (${url})`);
  const total = Number(response.headers.get('content-length')) || 0;
  let received = 0;
  let reported = 0;
  const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
  body.on('data', (chunk: Buffer) => {
    received += chunk.length;
    if (onProgress && received - reported > 25 * 1_048_576) {
      reported = received;
      onProgress(
        `downloaded ${(received / 1_048_576).toFixed(0)}${total ? ` / ${(total / 1_048_576).toFixed(0)}` : ''} MB`,
      );
    }
  });
  await pipeline(body, fs.createWriteStream(target, { mode: 0o600 }));
}

export interface SetupOptions {
  assetsDir?: string;
  /** Use an already downloaded `apex_26.2*.zip` instead of fetching one. */
  zipPath?: string;
  url?: string;
  /** Refuse an archive whose SHA-256 differs. */
  expectedSha256?: string;
  keepZip?: boolean;
  onProgress?: (message: string) => void;
}

/** Downloads the APEX distribution once and extracts the CSS/JS runtime plus Universal Theme templates. */
export async function setupAssets(options: SetupOptions = {}): Promise<ApexAssets> {
  const dir = path.resolve(options.assetsDir ?? defaultAssetsDir());
  const progress = options.onProgress ?? (() => undefined);
  fs.mkdirSync(dir, { recursive: true });
  let zipPath = options.zipPath ? path.resolve(options.zipPath) : undefined;
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

  const imagesDir = path.join(dir, 'images');
  const staging = `${imagesDir}.staging`;
  fs.rmSync(staging, { recursive: true, force: true });
  const zip = new ZipReader(zipPath);
  let files = 0;
  let themeSql: string | undefined;
  try {
    for (const entry of zip.entries) {
      if (entry.name.endsWith('/')) continue;
      if (entry.name === THEME_SQL) {
        themeSql = zip.read(entry).toString('utf8');
        continue;
      }
      if (!entry.name.startsWith('apex/images/') || entry.name.endsWith('.map')) continue;
      const relative = entry.name.slice('apex/images/'.length);
      if (!IMAGE_PREFIXES.some((prefix) => relative.startsWith(prefix))) continue;
      const target = path.resolve(staging, relative);
      if (!target.startsWith(`${staging}${path.sep}`)) throw new Error(`Unsafe zip entry ${entry.name}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, zip.read(entry));
      files += 1;
      if (files % 2_000 === 0) progress(`extracted ${files} files`);
    }
  } finally {
    zip.close();
  }
  if (!themeSql)
    throw new Error(`${zipPath} does not contain ${THEME_SQL}; is it an APEX ${APEX_VERSION} distribution?`);
  if (files === 0) throw new Error(`${zipPath} contains no apex/images runtime files`);
  const theme = parseThemeSql(themeSql);
  fs.writeFileSync(path.join(dir, 'theme.json'), JSON.stringify(theme));
  fs.rmSync(imagesDir, { recursive: true, force: true });
  fs.renameSync(staging, imagesDir);
  const manifest: AssetsManifest = {
    apexVersion: APEX_FULL_VERSION,
    source: options.zipPath ? zipPath : (options.url ?? APEX_DOWNLOAD_URL),
    sha256: digest,
    extractedAt: new Date().toISOString(),
    files,
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  if (downloaded && !options.keepZip) fs.rmSync(zipPath, { force: true });
  progress(`ready: ${files} files in ${imagesDir}`);
  return { dir, imagesDir, manifest, theme };
}

export function loadAssets(assetsDir = defaultAssetsDir()): ApexAssets {
  const dir = path.resolve(assetsDir);
  const manifestFile = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestFile)) {
    throw new Error(
      `APEX ${APEX_VERSION} assets are not installed in ${dir}. Run: apexrest preview setup (or apexrest_preview action:setup).`,
    );
  }
  return {
    dir,
    imagesDir: path.join(dir, 'images'),
    manifest: JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as AssetsManifest,
    theme: JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8')) as ThemeCall[],
  };
}
