import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Duplex } from 'node:stream';
import { loadApplication, statSignature, str, type ApxComponent, type ApxParseCache } from './apexlang.ts';
import { loadAssets, type ApexAssets } from './assets.ts';
import { rejectUpgrade } from './websocket.ts';
import { messagesScript, RUNTIME_CSS, RUNTIME_JS } from './client.ts';
import {
  apxSignatures,
  affectedPages,
  changedFiles,
  replaceableRegions,
  type Signatures,
} from './source-index.ts';
import { LiveHub } from './live.ts';
import { lintApplication } from './lint.ts';
import { applicationMmdVersion, checkComponentProperties, checkSharedComponentFiles } from './properties.ts';
import { LocalDatabase } from './database.ts';
import type { ConnectedOracle } from './oracle/app-data.ts';
import {
  extensionClient,
  extensionCss,
  pageResponse,
  routeHandler,
  runSubmitExtensions,
  type RouteResponse,
} from './extensions.ts';
import { parseBody } from './extensions/files/multipart.ts';
import { transaction } from './extensions/server/transaction.ts';
import { setUpRenderer } from './extensions.ts';
import './oracle-dictionary.ts';
import {
  ApexRenderer,
  LOCAL_PREFIX,
  MESSAGES,
  RESERVED_BUILTINS,
  type ApexError,
  type Diagnostic,
  type Session,
} from './render.ts';

/** Preview Ajax routes that change data; they commit or roll back like a page submit. */
const TRANSACTIONAL_ROUTES = new Set(['ig-save', 'set-value']);

/** A route response that reports a failure (HTTP error, `ok: false` or an `error`). */
function failedResponse(result: RouteResponse): boolean {
  if ((result.status ?? 200) >= 400) return true;
  if (result.type !== 'json') return false;
  try {
    const parsed = JSON.parse(result.body) as { ok?: unknown; error?: unknown };
    return parsed.ok === false || parsed.error !== undefined;
  } catch {
    return false;
  }
}

export interface PreviewOptions {
  /** Folder that contains application.apx. */
  sourceDir: string;
  assetsDir?: string;
  /** SQLite file; defaults to <sourceDir>/.apex-local/preview.sqlite (service.ts passes a project path). */
  database?: string;
  /** Delete the database and seed it again from .apex-local/*.sql. */
  reset?: boolean;
  host?: string;
  port?: number;
  user?: string;
  toolbar?: boolean;
  sampleRows?: number;
  /** Seed script folders in load order (see ApexRenderer.seed). */
  seedDirs?: string[];
  /**
   * Connected mode: application data and PL/SQL come from this Oracle session; each request is
   * rolled back, or committed when it succeeds and the session is in commit mode.
   */
  oracle?: ConnectedOracle;
  /** Review comments file (`<project>/.apexrest/review/comments.json`); turns review mode on. */
  reviewFile?: string;
  /**
   * Called after each successful source load (the first and every refresh) with its start time,
   * so a project preview can record the source revision it rendered (revision.ts).
   */
  /** Called after each successful load with the source snapshot that load rendered. */
  onLoad?: (startedAt: string, snapshot: Signatures) => void;
}

export interface PreviewPage {
  id: string;
  name: string;
  url: string;
  mode: string;
}

const TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
};

async function bytes(request: http.IncomingMessage, limit = 8 * 1_048_576): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error('Request body is too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function body(request: http.IncomingMessage, limit = 8 * 1_048_576): Promise<string> {
  return (await bytes(request, limit)).toString('utf8');
}

/** Form fields and uploaded files of a POST (url-encoded or multipart/form-data, up to 64 MB). */
async function formBody(request: http.IncomingMessage) {
  return parseBody(await bytes(request, 64 * 1_048_576), request.headers['content-type']);
}

const LOOPBACK_NAMES = ['127.0.0.1', 'localhost', '[::1]'];
const WILDCARD_HOSTS = new Set(['0.0.0.0', '::', '[::]', '']);

/**
 * Decides whether a request may reach the preview. The preview executes SQL and
 * PL/SQL from request bodies (and, in connected mode, against a real Oracle
 * database), so a web page in the user's browser must not be able to drive it:
 * - Host must name this server (blocks DNS rebinding);
 * - any foreign or opaque Origin is refused;
 * - Sec-Fetch-Site cross-site/same-site requests are refused, including GET and HEAD
 *   navigations. Rendering a page can run processes and modify data.
 * Direct browser navigation and non-browser clients are allowed with a valid Host.
 * Returns the refusal reason, or undefined when the request is allowed.
 */
export function previewRequestRefusal(
  headers: http.IncomingHttpHeaders,
  port: number,
  bindHost?: string,
): string | undefined {
  const names = [...LOOPBACK_NAMES];
  if (bindHost && !WILDCARD_HOSTS.has(bindHost) && !names.includes(bindHost))
    names.push(bindHost.includes(':') && !bindHost.startsWith('[') ? `[${bindHost}]` : bindHost);
  const allowed = new Set(names.map((name) => `${name}:${port}`.toLowerCase()));
  const host = headers.host?.trim().toLowerCase();
  if (!host || !allowed.has(host)) return 'Host is not this preview server';
  const origin = headers.origin?.trim().toLowerCase();
  if (origin !== undefined && origin !== `http://${host}`) return 'Cross-origin requests are not accepted';
  const site = String(headers['sec-fetch-site'] ?? '').toLowerCase();
  if (site === 'cross-site' || site === 'same-site')
    return 'Cross-site requests are not accepted. Open the preview URL directly in a browser tab';
  return undefined;
}

/** Local, database-free runtime for APEXlang sources: Universal Theme 26.2 assets plus SQLite. */
/** A source file changed while a load read it; the load is discarded and retried. */
class IncoherentLoad extends Error {
  constructor(readonly file: string) {
    super(`${file} changed while the preview loaded it.`);
  }
}

export class PreviewServer {
  readonly options: PreviewOptions;
  readonly assets: ApexAssets;
  readonly db: LocalDatabase;
  readonly seedProblems: string[];
  /** WebSocket pages: data changes, source reloads and presence (live.ts). */
  readonly live: LiveHub;
  renderer: ApexRenderer;
  #server?: http.Server | undefined;
  #sessions = new Map<string, Session>();
  /** Per-file signatures and parsed files of the last successful load (source-index.ts). */
  #signatures: Signatures = new Map();
  #cache: ApxParseCache = new Map();
  /** Successful source loads; live messages carry it so pages ignore older notifications. */
  #revision = 0;
  /** Set by the watcher before its debounce; a request then re-reads the sources. */
  #dirty = false;
  #lastScan = 0;
  #loadError?: string | undefined;

  constructor(options: PreviewOptions) {
    this.options = { ...options, sourceDir: path.resolve(options.sourceDir) };
    let db: LocalDatabase | undefined;
    try {
      this.assets = loadAssets(options.assetsDir);
      // Connected mode keeps only preview-internal state in SQLite, so it starts empty and unseeded.
      const file =
        options.database ??
        (options.oracle ? ':memory:' : path.join(this.options.sourceDir, '.apex-local', 'preview.sqlite'));
      if (options.reset && file !== ':memory:')
        for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
      const fresh = file === ':memory:' || !fs.existsSync(file);
      this.db = db = new LocalDatabase(file);
      this.seedProblems =
        fresh && !options.oracle ? ApexRenderer.seed(this.db, this.options.sourceDir, options.seedDirs) : [];
      const startedAt = new Date().toISOString();
      // The first load has no earlier renderer to keep: a source that changed meanwhile is read again.
      for (let attempt = 1; ; attempt++)
        try {
          this.renderer = this.#load(apxSignatures(this.options.sourceDir));
          break;
        } catch (error) {
          if (!(error instanceof IncoherentLoad) || attempt === 3) throw error;
        }
      options.onLoad?.(startedAt, this.#signatures);
      // Connected mode rolls every request back, so only source reloads are pushed there.
      this.live = new LiveHub({
        sourceDir: this.options.sourceDir,
        data: !options.oracle && this.db.trackWrites(),
        revision: () => this.#revision,
        onDirty: () => {
          this.#dirty = true;
        },
        onSource: (file) => this.#sourceMessage(file),
      });
    } catch (error) {
      try {
        db?.close();
      } finally {
        this.#closeOracle();
      }
      throw error;
    }
  }

  /**
   * Loads the application from one source snapshot: the same signatures decide what changed, which
   * files the cache reuses and which revision is recorded, so one refresh walks the tree once.
   */
  #load(snapshot: Signatures): ApexRenderer {
    this.#lastScan = Date.now();
    this.#dirty = false;
    const app = loadApplication(this.options.sourceDir, 'default', this.#cache, snapshot);
    // Integrity recheck, for correctness only: a file parsed now must still have the signature the
    // snapshot recorded; otherwise it changed while this load read it and the load is not coherent.
    for (const relative of app.parsedFiles ?? []) {
      let current: string | undefined;
      try {
        current = statSignature(path.join(this.options.sourceDir, relative));
      } catch {
        current = undefined;
      }
      if (current !== snapshot.get(relative)) {
        this.#cache.delete(relative);
        throw new IncoherentLoad(relative);
      }
    }
    this.#signatures = snapshot;
    const renderer = new ApexRenderer(app, this.assets, this.db, {
      ...(this.options.toolbar === undefined ? {} : { toolbar: this.options.toolbar }),
      ...(this.options.sampleRows === undefined ? {} : { sampleRows: this.options.sampleRows }),
      ...(this.options.seedDirs ? { seedDirs: this.options.seedDirs } : {}),
      ...(this.options.oracle ? { oracle: this.options.oracle } : {}),
      ...(this.options.reviewFile ? { reviewFile: this.options.reviewFile } : {}),
    });
    for (const problem of this.seedProblems) renderer.diagnose('warning', `Seed script: ${problem}`);
    setUpRenderer(renderer);
    for (const warning of this.options.oracle?.warnings ?? [])
      renderer.diagnose('warning', `Connected preview: ${warning}`);
    // Unknown APEXlang properties and values would otherwise be ignored silently, and so would
    // shared component files the compiler never reads.
    for (const finding of checkSharedComponentFiles(renderer.app.root, renderer.app.files))
      renderer.diagnose('warning', finding);
    const mmdVersion = applicationMmdVersion(this.options.sourceDir);
    for (const [id, page] of renderer.app.pages)
      for (const finding of checkComponentProperties([page], id, undefined, mmdVersion ? { mmdVersion } : {}))
        renderer.diagnose('warning', finding.message, finding.page, finding.component);
    // Faults the compiler accepts and the rendering hides: slots, item references, duplicate ids,
    // and the APEX Advisor accessibility rules.
    for (const finding of lintApplication(renderer.app, {
      regionSlots: (region) => renderer.regionSlots(region),
    }))
      renderer.diagnose(
        finding.level,
        `[${finding.code}] ${finding.message} (${finding.file}:${finding.line})`,
        finding.page,
        finding.component,
        finding.code,
      );
    return renderer;
  }

  /**
   * Re-reads the APEXlang tree when any .apx file changed: unchanged files keep their parsed
   * components. A failed load keeps the last good renderer, marked stale with the error, so pages
   * still render; the next valid change replaces it. Returns the changed files and affected pages.
   */
  #refresh(): { files: string[]; pages: string[] | 'all'; regions?: string[] } | undefined {
    this.#lastScan = Date.now();
    const signatures = apxSignatures(this.options.sourceDir);
    const files = changedFiles(this.#signatures, signatures);
    if (!files.length && !this.#loadError) {
      this.#dirty = false;
      return undefined;
    }
    if (!files.length) return undefined;
    const previous = this.renderer.app;
    try {
      const startedAt = new Date().toISOString();
      this.renderer = this.#load(signatures);
      this.#loadError = undefined;
      this.#revision += 1;
      this.options.onLoad?.(startedAt, signatures);
      const pages = affectedPages(files, [previous, this.renderer.app]);
      const regions =
        Array.isArray(pages) && pages.length === 1
          ? replaceableRegions(
              previous.pages.get(pages[0]!),
              this.renderer.app.pages.get(pages[0]!),
              (region) => this.renderer.regionDomId(region),
            )
          : undefined;
      return { files, pages, ...(regions ? { regions } : {}) };
    } catch (error) {
      // A source that changed while it was read: keep the last good renderer and its revision and
      // scan again on the next request instead of rendering or recording a mixed state.
      if (error instanceof IncoherentLoad) {
        this.#dirty = true;
        return undefined;
      }
      // Keep the failed signatures so the same broken state is not parsed again on every request.
      this.#signatures = signatures;
      this.#dirty = false;
      this.#loadError = (error as Error).message;
      this.renderer.sourceError = this.#loadError;
      return { files, pages: 'all' };
    }
  }

  /** The live message for a watched change: reload affected pages, swap a stylesheet, or an error. */
  #sourceMessage(file: string): Record<string, unknown> | undefined {
    const result = this.#refresh();
    if (this.#loadError)
      return { type: 'source-error', message: this.#loadError, revision: this.#revision, stale: true };
    if (result) return { type: 'reload', revision: this.#revision, ...result };
    const parts = file.split(path.sep);
    const index = parts.indexOf('static-files');
    if (index >= 0 && file.endsWith('.css'))
      return { type: 'stylesheet', file: parts.slice(index + 1).join('/'), revision: this.#revision };
    if (index >= 0) return { type: 'reload', revision: this.#revision, files: [file], pages: 'all' };
    return undefined;
  }

  /** Source revision of the current renderer (successful loads since start). */
  get revision(): number {
    return this.#revision;
  }

  get url(): string {
    const address = this.#server?.address() as AddressInfo | null;
    if (!address) throw new Error('Preview server is not running');
    const host = address.address.includes(':') ? `[${address.address}]` : address.address;
    return `http://${host}:${address.port}`;
  }

  diagnostics(): Diagnostic[] {
    return [...this.renderer.diagnostics];
  }

  pages(): PreviewPage[] {
    return [...this.renderer.app.pages.values()]
      .filter((page) => page.id !== '0')
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((page) => ({
        id: page.id,
        name: str(page.props, 'name', page.id),
        url: this.url + this.renderer.pagePath(page),
        mode: str(page.props, 'appearance.pageMode', 'normal'),
      }));
  }

  async start(): Promise<string> {
    this.#server = http.createServer((request, response) => {
      this.#handle(request, response)
        .catch((error: unknown) => {
          if (!response.headersSent) response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
          response.end(`APEX preview error: ${(error as Error).message}`);
        })
        .finally(() => {
          this.#endRequest(response);
          this.#publishWrites(request);
        });
    });
    this.#server.on('upgrade', (request: http.IncomingMessage, socket: Duplex, head: Buffer) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (pathname !== `${this.renderer.baseUrl}${LOCAL_PREFIX}/live`)
        return rejectUpgrade(socket, 404, 'Not Found');
      // The same Host and cross-site checks as HTTP requests; the hub also requires a same-origin page.
      const port = (this.#server?.address() as AddressInfo | null)?.port ?? 0;
      if (previewRequestRefusal(request.headers, port, this.options.host))
        return rejectUpgrade(socket, 403, 'Forbidden');
      this.live.upgrade(request, socket, head, this.#existingSession(request));
    });
    try {
      await new Promise<void>((resolve, reject) => {
        this.#server!.once('error', reject);
        this.#server!.listen(this.options.port ?? 0, this.options.host ?? '127.0.0.1', () => resolve());
      });
    } catch (error) {
      await this.stop().catch(() => undefined);
      throw error;
    }
    return this.url;
  }

  async stop(): Promise<void> {
    const server = this.#server;
    this.#server = undefined;
    this.live.close();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    server?.closeAllConnections();
    try {
      this.db.close();
    } finally {
      this.#closeOracle();
    }
  }

  #closeOracle(): void {
    try {
      this.options.oracle?.data.close();
    } catch {
      // Closing the SQLcl server ends the session, which rolls back.
    }
  }

  /** Responses whose page processing failed; commit mode rolls their Oracle work back. */
  #failed = new WeakSet<http.ServerResponse>();

  /** Wraps a transaction failure test so a failed submit or Ajax call is also rolled back in Oracle. */
  #failure<T>(response: http.ServerResponse, failed: (result: T) => boolean): (result: T) => boolean {
    return (result) => {
      const failure = failed(result);
      if (failure) this.#failed.add(response);
      return failure;
    };
  }

  /**
   * Connected mode: nothing a request did in Oracle survives it, except in commit mode, where a
   * request that ended without an error status or failed processing is committed.
   */
  #endRequest(response: http.ServerResponse): void {
    const succeeded = response.statusCode < 400 && !this.#failed.has(response);
    try {
      this.options.oracle?.data.endRequest(succeeded);
    } catch (error) {
      // An end that cannot be confirmed resets the session; Oracle rolls back a closed session.
      this.renderer.diagnose(
        'error',
        `Connected preview: ${this.options.oracle?.commit && succeeded ? 'commit' : 'rollback'} failed (${(error as Error).message}); the Oracle session was reset`,
      );
      this.options.oracle?.data.link.close();
    }
  }

  /**
   * Pushes the tables a request wrote to the live pages. Region refreshes and Ajax reads are left
   * out: a region that writes while it renders would otherwise make two pages refresh each other.
   */
  #publishWrites(request: http.IncomingMessage): void {
    const tables = this.db.takeWrites();
    if (!tables.length || !this.live.size) return;
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname.endsWith(`${LOCAL_PREFIX}/region`)) return;
    if (request.method === 'GET' && url.pathname.includes(`${LOCAL_PREFIX}/x/`)) return;
    const session = this.#existingSession(request);
    this.live.changed({
      tables,
      user: session?.user ?? this.options.user ?? 'DEVELOPER',
      session: session?.id,
      tab:
        typeof request.headers['x-apex-local-tab'] === 'string'
          ? request.headers['x-apex-local-tab']
          : undefined,
    });
  }

  #existingSession(request: http.IncomingMessage): Session | undefined {
    const cookie = /(?:^|;\s*)APEX_LOCAL_SESSION=([\w-]+)/u.exec(request.headers.cookie ?? '')?.[1];
    return cookie ? this.#sessions.get(cookie) : undefined;
  }

  session(request: http.IncomingMessage, response: http.ServerResponse): Session {
    // The host header passed the request guard (local host names and the preview port only).
    const host = typeof request.headers.host === 'string' ? request.headers.host.trim() : '';
    const origin = /^[\w.:[\]-]+$/u.test(host) ? `http://${host}` : undefined;
    const existing = this.#existingSession(request);
    if (existing) {
      if (origin) existing.origin = origin;
      return existing;
    }
    // APEX session ids are numbers.
    const id = BigInt(`0x${randomBytes(8).toString('hex')}`)
      .toString()
      .padStart(20, '1');
    const session: Session = {
      id,
      user: this.options.user ?? 'DEVELOPER',
      items: {},
      pagination: {},
      ...(origin ? { origin } : {}),
    };
    this.#sessions.set(id, session);
    response.setHeader('set-cookie', `APEX_LOCAL_SESSION=${id}; Path=/; HttpOnly; SameSite=Lax`);
    return session;
  }

  /**
   * Sets the session state of a region's Page Items to Submit before it is rendered or queried
   * again (region refresh, calendar feed). Only the items the region declares are taken.
   */
  #submitRegionItems(session: Session, pageKey: string, regionId: string, items: unknown): void {
    if (!items || !regionId) return;
    let values: unknown = items;
    if (typeof items === 'string') {
      try {
        values = JSON.parse(items);
      } catch {
        return;
      }
    }
    if (!values || typeof values !== 'object') return;
    const page = this.renderer.findPage(pageKey);
    if (!page) return;
    const region = [page, this.renderer.app.pages.get('0')]
      .flatMap((candidate) => candidate?.children ?? [])
      .find(
        (child) =>
          child.type === 'region' && (child.id === regionId || this.renderer.regionDomId(child) === regionId),
      );
    if (!region) return;
    const allowed = new Set(this.renderer.regionItemsToSubmit(region));
    for (const [name, value] of Object.entries(values as Record<string, unknown>)) {
      const upper = name.toUpperCase();
      if (!allowed.has(upper)) continue;
      session.items[upper] = Array.isArray(value)
        ? value.join(':')
        : value === null || value === undefined
          ? ''
          : String(value);
    }
  }

  #static(response: http.ServerResponse, root: string, relative: string, cache: boolean): void {
    const target = path.resolve(root, decodeURIComponent(relative));
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    response.writeHead(200, {
      'content-type': TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': cache ? 'public, max-age=86400' : 'no-cache',
    });
    fs.createReadStream(target).pipe(response);
  }

  #send(response: http.ServerResponse, status: number, type: string, content: string): void {
    response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }).end(content);
  }

  #respond(response: http.ServerResponse, result: RouteResponse): void {
    const types = {
      json: TYPES['.json']!,
      html: TYPES['.html']!,
      text: 'text/plain; charset=utf-8',
      js: TYPES['.js']!,
      binary: 'application/octet-stream',
    };
    response
      .writeHead(result.status ?? 200, {
        'content-type': result.contentType ?? types[result.type],
        'cache-control': 'no-store',
        ...result.headers,
      })
      .end(result.type === 'binary' && result.data ? result.data : result.body);
  }

  async #handle(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const port = (this.#server?.address() as AddressInfo | null)?.port ?? 0;
    const refusal = previewRequestRefusal(request.headers, port, this.options.host);
    if (refusal) {
      request.resume();
      return this.#send(response, 403, 'text/plain; charset=utf-8', `APEX preview: ${refusal}.`);
    }
    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = url.pathname;
    if (pathname.startsWith('/i/'))
      return this.#static(response, path.resolve(this.assets.imagesDir), pathname.slice(3), true);
    const marker = pathname.indexOf(`${LOCAL_PREFIX}/`);
    if (marker >= 0) {
      const name = pathname.slice(marker + LOCAL_PREFIX.length + 1);
      if (name === 'runtime.js')
        return this.#send(response, 200, TYPES['.js']!, RUNTIME_JS + extensionClient());
      if (name === 'runtime.css')
        return this.#send(response, 200, TYPES['.css']!, RUNTIME_CSS + extensionCss());
      if (name === 'messages.js') return this.#send(response, 200, TYPES['.js']!, messagesScript(MESSAGES));
      if (name === 'diagnostics')
        return this.#send(response, 200, TYPES['.json']!, JSON.stringify(this.diagnostics(), null, 2));
    }
    // With a healthy watcher and no event since the last load, the source tree is not rescanned on
    // every request; it still is at least every two seconds, in case an event was missed.
    if (this.#dirty || !this.live.watching || Date.now() - this.#lastScan > 2000) this.#refresh();
    const renderer = this.renderer;
    // Page URLs that Oracle APEX generated (`/ords/r/ws/app/page?…&session=…`, for example in
    // connected-mode report values) redirect to the preview page.
    if (/^(?:\/[^/]+)*?\/r\/[^/]+\/[^/]+\/[^/]+$/u.test(pathname)) {
      const location = renderer.localUrl(`${pathname}${url.search}`);
      if (location !== `${pathname}${url.search}`) {
        response.writeHead(302, { location }).end();
        return;
      }
    }
    // Legacy f?p=APP:PAGE:SESSION:REQUEST:DEBUG:CLEAR:ITEMS:VALUES links redirect to friendly URLs.
    if ((pathname === '/f' || pathname.endsWith(`${renderer.baseUrl}/f`)) && url.searchParams.has('p')) {
      const [, pageKey = '', , requestValue = '', , clear = '', names = '', values = ''] = (
        url.searchParams.get('p') ?? ''
      ).split(':');
      const target = renderer.findPage(pageKey || renderer.homePage());
      const query = new URLSearchParams();
      const itemValues = values.split(',');
      names
        .split(',')
        .filter(Boolean)
        .forEach((name, index) => query.set(name.toLowerCase(), decodeURIComponent(itemValues[index] ?? '')));
      if (clear) query.set('clear', clear);
      if (requestValue) query.set('request', requestValue);
      const location = `${target ? renderer.pagePath(target) : renderer.baseUrl}${query.size ? `?${query}` : ''}`;
      response.writeHead(302, { location }).end();
      return;
    }
    if (pathname === '/' || pathname === renderer.baseUrl || pathname === `${renderer.baseUrl}/`) {
      const home = renderer.findPage(renderer.homePage());
      response.writeHead(302, { location: home ? renderer.pagePath(home) : `${renderer.baseUrl}/1` }).end();
      return;
    }
    if (!pathname.startsWith(`${renderer.baseUrl}/`))
      return this.#send(response, 404, 'text/plain', 'Not found');
    const rest = pathname.slice(renderer.baseUrl.length + 1);
    if (rest.startsWith('files/static/v1/'))
      return this.#static(
        response,
        path.join(this.options.sourceDir, 'shared-components', 'static-files'),
        rest.slice(16),
        false,
      );
    if (rest.startsWith('files/theme/v1/')) {
      const themeDir = renderer.themeFilesDir();
      if (!themeDir) return this.#send(response, 404, 'text/plain', 'Not found');
      return this.#static(response, themeDir, rest.slice(15), false);
    }
    // A plug-in's own files (#PLUGIN_FILES#): shared-components/plugins/<kind>/<name>/static-files.
    const pluginFiles = /^files\/plugin\/([\w-]+)\/([\w-]+)\/(.+)$/u.exec(rest);
    if (pluginFiles)
      return this.#static(
        response,
        path.join(
          this.options.sourceDir,
          'shared-components',
          'plugins',
          pluginFiles[1]!,
          pluginFiles[2]!,
          'static-files',
        ),
        pluginFiles[3]!,
        false,
      );
    if (rest.startsWith('files/workspace/'))
      return this.#static(
        response,
        path.join(this.options.sourceDir, 'workspace-components', 'static-files'),
        rest.slice(16),
        false,
      );

    const session = this.session(request, response);
    if (rest === 'wwv_flow.accept' && request.method === 'POST') {
      // apex.page.submit sends multipart/form-data (p_json first, then p_files) when file items have files.
      const { form, files } = await formBody(request);
      const json = JSON.parse(form.getAll('p_json').join('') || '{}') as {
        pageItems?: {
          itemsToSubmit?: { n: string; v: string | string[]; fileIndex?: number; fileCount?: number }[];
        };
      };
      const items = json.pageItems?.itemsToSubmit ?? [];
      const values = Object.fromEntries(
        items.map((item) => [item.n, Array.isArray(item.v) ? item.v.join(':') : String(item.v ?? '')]),
      );
      const page = form.get('p_flow_step_id') ?? '';
      const requestValue = form.get('p_request') ?? '';
      const finish = runSubmitExtensions(renderer, session, {
        pageId: page,
        request: requestValue,
        form,
        files,
        items,
        values,
      });
      // One transaction per submit: committed on success, rolled back when processing fails.
      const result = transaction(
        renderer.db.db,
        () => {
          let accepted = renderer.isLoginPage(page)
            ? renderer.login(session, values)
            : renderer.accept(session, page, requestValue, values);
          for (const step of finish) accepted = step(accepted);
          const failed = (accepted as { errors?: ApexError[] }).errors;
          return failed?.length ? { ...accepted, errors: renderer.userErrors(failed) } : accepted;
        },
        this.#failure(response, (accepted) => Boolean((accepted as { errors?: unknown[] }).errors?.length)),
      );
      return this.#send(
        response,
        200,
        TYPES['.json']!,
        JSON.stringify({ ...result, pageSubmissionId: String(Date.now()) }),
      );
    }
    if (rest === 'wwv_flow.ajax' || rest === 'wwv_flow.show') {
      renderer.diagnose('info', 'An APEX Ajax/plug-in request was ignored by the local preview');
      return this.#send(response, 200, TYPES['.json']!, '{}');
    }
    if (rest.startsWith(`${LOCAL_PREFIX.slice(1)}/x/`)) {
      const routeName = rest.slice(LOCAL_PREFIX.length + 2);
      const handler = routeHandler(routeName);
      if (!handler) return this.#send(response, 404, 'text/plain', 'Unknown preview route');
      const posted =
        request.method === 'POST'
          ? /^multipart\/form-data/iu.test(request.headers['content-type'] ?? '')
            ? await formBody(request)
            : { form: undefined, files: [], text: await body(request) }
          : { form: undefined, files: [], text: '' };
      this.#submitRegionItems(
        session,
        url.searchParams.get('page') ?? '',
        url.searchParams.get('region') ?? '',
        url.searchParams.get('items'),
      );
      const call = () =>
        handler(renderer, session, {
          method: request.method ?? 'GET',
          params: url.searchParams,
          body: 'text' in posted ? posted.text : (posted.form?.toString() ?? ''),
          files: posted.files,
        });
      // Ajax requests that change data run in a transaction like a page submit.
      // A transaction cannot span an await, so data-changing routes must answer synchronously.
      const result = TRANSACTIONAL_ROUTES.has(routeName)
        ? transaction(
            renderer.db.db,
            () => {
              const answer = call();
              if (answer instanceof Promise) throw new Error(`Route ${routeName} must answer synchronously`);
              return answer;
            },
            this.#failure(response, failedResponse),
          )
        : call();
      return this.#respond(response, await result);
    }
    if (rest === '__logout') {
      session.items = {};
      session.user = this.options.user ?? 'DEVELOPER';
      response.writeHead(302, { location: renderer.baseUrl }).end();
      return;
    }
    if (rest === `${LOCAL_PREFIX.slice(1)}/region`) {
      const page = url.searchParams.get('page') ?? '';
      const region = url.searchParams.get('region') ?? '';
      // Page Items to Submit of the region: POST { items } or ?items=<json>.
      const posted = request.method === 'POST' ? await body(request) : '';
      let items: unknown = url.searchParams.get('items');
      try {
        if (posted) items = (JSON.parse(posted) as { items?: unknown }).items ?? null;
      } catch {
        return this.#send(response, 400, 'text/plain', 'Region refresh expects JSON { items }');
      }
      this.#submitRegionItems(session, page, region, items);
      const target = Number(url.searchParams.get('pg'));
      if (target > 0) {
        const component = renderer
          .findPage(page)
          ?.children.find((child) => renderer.regionDomId(child) === region);
        if (component) session.pagination[`${page}:${component.id}`] = target;
      }
      return this.#send(response, 200, TYPES['.html']!, renderer.renderRegionFragment(session, page, region));
    }
    if (rest === `${LOCAL_PREFIX.slice(1)}/server-code` && request.method === 'POST') {
      const input = JSON.parse(await body(request)) as {
        ref?: string;
        items?: Record<string, string>;
        returnItems?: string[];
      };
      // Only code this session's pages rendered runs; a request never supplies code.
      const action = renderer.serverAction(session, input.ref, 'code');
      if (!action)
        return this.#send(
          response,
          400,
          TYPES['.json']!,
          JSON.stringify({
            errors: [
              {
                type: 'error',
                location: ['page'],
                message: 'Unknown server-side code reference; reload the page',
                unsafe: false,
              },
            ],
          }),
        );
      const submit = new Set(action.submit);
      const items = Object.fromEntries(
        Object.entries(input.items ?? {}).filter(([name]) => submit.has(name.toUpperCase())),
      );
      const returns = (input.returnItems ?? []).filter((name) =>
        action.returns.includes(String(name).toUpperCase()),
      );
      const errors: ApexError[] = [];
      const values = transaction(
        renderer.db.db,
        () => renderer.executeServerCode(session, action.pageId, action.code, items, returns, errors),
        this.#failure(response, () => errors.length > 0),
      );
      // An unhandled error is shown like apex.server errors and stops the following actions.
      return this.#send(
        response,
        200,
        TYPES['.json']!,
        JSON.stringify(errors.length ? { ...values, errors: renderer.userErrors(errors) } : values),
      );
    }
    if (rest === `${LOCAL_PREFIX.slice(1)}/close-dialog`) {
      const success = session.success;
      session.success = undefined;
      const data = JSON.stringify({
        dialogPageId: url.searchParams.get('page'),
        ...(success ? { successMessage: { text: success } } : {}),
      });
      return this.#send(
        response,
        200,
        TYPES['.html']!,
        `<!DOCTYPE html><html><head><meta charset="utf-8"><script>window.apex={env:${JSON.stringify({ APP_SESSION: session.id })}};</script><script src="/i/libraries/apex/minified/desktop_all.min.js"></script></head><body><script>apex.navigation.dialog.close(true, ${data.replaceAll('<', '\\u003c')});</script></body></html>`,
      );
    }

    const page = renderer.findPage(decodeURIComponent(rest));
    if (!page) {
      const links = this.pages()
        .map((entry) => `<li><a href="${entry.url}">${entry.id} · ${entry.name}</a></li>`)
        .join('');
      return this.#send(
        response,
        404,
        TYPES['.html']!,
        `<!DOCTYPE html><meta charset="utf-8"><title>Page not found</title><h1>Page ${rest} not found</h1><ul>${links}</ul>`,
      );
    }
    for (const clear of (url.searchParams.get('clear') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)) {
      if (clear.toUpperCase() === 'RP') {
        for (const key of Object.keys(session.pagination))
          if (key.startsWith(`${page.id}:`)) delete session.pagination[key];
        continue;
      }
      const cleared = renderer.findPage(clear);
      for (const child of cleared?.children ?? [])
        if (child.type === 'pageItem') delete session.items[child.id.toUpperCase()];
      // Faceted search facets and smart filters are page items too (also inside facet groups).
      const facets = (children: ApxComponent[]): ApxComponent[] =>
        children.flatMap((child) =>
          ['facet', 'filter', 'checkbox'].includes(child.type) ? [child] : facets(child.children),
        );
      for (const facet of facets(cleared?.children ?? [])) delete session.items[facet.id.toUpperCase()];
    }
    if (url.searchParams.has('apex_theme_style'))
      session.themeStyle = url.searchParams.get('apex_theme_style') || undefined;
    for (const [key, value] of url.searchParams) {
      if (['clear', 'request', 'session', 'cs', 'apex_theme_style'].includes(key)) continue;
      const name = key.toUpperCase();
      if (RESERVED_BUILTINS.has(name)) {
        renderer.diagnose(
          'warning',
          `URL parameter ${name} ignored: it is an APEX built-in, not an item`,
          page.id,
        );
        continue;
      }
      session.items[name] = value;
    }
    const ctx = renderer.prepare(session, page.id, url.searchParams.get('request') ?? '');
    const replaced = pageResponse(renderer, ctx);
    if (replaced) return this.#respond(response, replaced);
    return this.#send(response, 200, TYPES['.html']!, renderer.renderPage(ctx));
  }
}

/** Renders every page once without a browser and returns the collected diagnostics. */
export function checkApplication(options: PreviewOptions & { pages?: string[] }): {
  pages: { id: string; name: string; bytes: number; error?: string }[];
  diagnostics: Diagnostic[];
} {
  const preview = new PreviewServer({ ...options, database: options.database ?? ':memory:' });
  try {
    const renderer = preview.renderer;
    const ids = options.pages?.length
      ? options.pages
      : [...renderer.app.pages.keys()].filter((id) => id !== '0');
    const pages = ids.map((id) => {
      const page = renderer.findPage(id);
      const name = str(page?.props ?? {}, 'name', id);
      try {
        const session: Session = {
          id: randomUUID(),
          user: options.user ?? 'DEVELOPER',
          items: {},
          pagination: {},
        };
        const html = renderer.renderPage(renderer.prepare(session, id));
        return { id: page?.id ?? id, name, bytes: Buffer.byteLength(html) };
      } catch (error) {
        renderer.diagnose('error', (error as Error).message, id);
        return { id, name, bytes: 0, error: (error as Error).message };
      } finally {
        options.oracle?.data.endRequest();
      }
    });
    return { pages, diagnostics: preview.diagnostics() };
  } finally {
    preview.db.close();
    options.oracle?.data.close();
  }
}
