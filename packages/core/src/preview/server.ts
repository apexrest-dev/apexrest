import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Duplex } from 'node:stream';
import { loadApplication, str, type ApxComponent } from './apexlang.ts';
import { loadAssets, type ApexAssets } from './assets.ts';
import { rejectUpgrade } from './websocket.ts';
import { messagesScript, RUNTIME_CSS, RUNTIME_JS } from './client.ts';
import { LiveHub } from './live.ts';
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

/** Developer tool routes; a deployed application (application mode) does not serve them. */
const DEVELOPER_ROUTES = new Set(['debug-log', 'session-state', 'view-as', 'reset-data', 'outbox']);

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
  /**
   * Application mode (webapp/server.ts): the server is a deployed application, not a developer
   * preview. Sign-in is real, pages that are not public need it, authorization schemes are
   * enforced, and the developer surface (diagnostics, hot reload, live socket) is off.
   */
  application?: ApplicationMode;
}

export interface ApplicationMode {
  /** Checks credentials; returns the user's roles on success, undefined on failure. */
  authenticate(username: string, password: string): { roles?: string[] } | undefined;
  /** `host[:port]` values the application is reached by, besides loopback. */
  publicHosts?: string[];
  /** Mark the session cookie Secure (served over HTTPS). */
  secureCookies?: boolean;
  /** Idle time after which a session ends; defaults to 8 hours. */
  sessionTimeoutMs?: number;
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

function newestApx(root: string): number {
  let newest = 0;
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'static-files') continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith('.apx')) newest = Math.max(newest, fs.statSync(full).mtimeMs);
    }
  };
  visit(root);
  return newest;
}

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
 * - a cross-origin Origin on an unsafe method is refused (blocks CSRF POSTs);
 * - Sec-Fetch-Site cross-site/same-site requests are refused unless they are
 *   top-level GET/HEAD navigations (blocks no-cors subresource GETs, which carry
 *   no Origin). A plain link into the preview keeps working.
 * Non-browser clients send no Origin or Sec-Fetch-* headers and pass on Host alone.
 * Returns the refusal reason, or undefined when the request is allowed.
 */
export function previewRequestRefusal(
  headers: http.IncomingHttpHeaders,
  method: string | undefined,
  port: number,
  bindHost?: string,
  /** Application mode: `host[:port]` names the server is published under (behind a proxy, HTTPS). */
  publicHosts: string[] = [],
): string | undefined {
  const names = [...LOOPBACK_NAMES];
  if (bindHost && !WILDCARD_HOSTS.has(bindHost) && !names.includes(bindHost))
    names.push(bindHost.includes(':') && !bindHost.startsWith('[') ? `[${bindHost}]` : bindHost);
  const allowed = new Set(names.map((name) => `${name}:${port}`.toLowerCase()));
  for (const name of publicHosts) allowed.add(name.trim().toLowerCase());
  const host = headers.host?.trim().toLowerCase();
  if (!host || !allowed.has(host)) return 'Host is not this preview server';
  const safe = method === 'GET' || method === 'HEAD';
  const origin = headers.origin?.trim().toLowerCase();
  // A published host may be served over HTTPS by a proxy in front of the application.
  const sameOrigin = origin === `http://${host}` || (publicHosts.length > 0 && origin === `https://${host}`);
  if (origin !== undefined && !safe && !sameOrigin) return 'Cross-origin requests are not accepted';
  const site = String(headers['sec-fetch-site'] ?? '').toLowerCase();
  if (site === 'cross-site' || site === 'same-site') {
    const navigation = headers['sec-fetch-mode'] === 'navigate' && safe;
    if (!navigation) return 'Cross-site requests are not accepted';
  }
  return undefined;
}

/** Local, database-free runtime for APEXlang sources: Universal Theme 26.2 assets plus SQLite. */
export class PreviewServer {
  readonly options: PreviewOptions;
  readonly assets: ApexAssets;
  readonly db: LocalDatabase;
  readonly seedProblems: string[];
  /** WebSocket pages: data changes, source reloads and presence (live.ts). */
  readonly live: LiveHub;
  renderer: ApexRenderer;
  /** Application mode: receives errors that are not shown to the user. */
  onError?: (error: unknown) => void;
  #server?: http.Server | undefined;
  #sessions = new Map<string, Session>();
  #loadedAt = 0;
  #loadError?: string | undefined;

  constructor(options: PreviewOptions) {
    this.options = { ...options, sourceDir: path.resolve(options.sourceDir) };
    this.assets = loadAssets(options.assetsDir);
    // Connected mode keeps only preview-internal state in SQLite, so it starts empty and unseeded.
    const file =
      options.database ??
      (options.oracle ? ':memory:' : path.join(this.options.sourceDir, '.apex-local', 'preview.sqlite'));
    if (options.reset && file !== ':memory:')
      for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
    const fresh = file === ':memory:' || !fs.existsSync(file);
    this.db = new LocalDatabase(file);
    this.seedProblems =
      fresh && !options.oracle ? ApexRenderer.seed(this.db, this.options.sourceDir, options.seedDirs) : [];
    this.renderer = this.#load();
    // Connected mode rolls every request back, so only source reloads are pushed there.
    this.live = new LiveHub({
      sourceDir: this.options.sourceDir,
      data: !options.oracle && this.db.trackWrites(),
      onSource: () => {
        this.#refresh();
        return this.#loadError;
      },
    });
  }

  #load(): ApexRenderer {
    this.#loadedAt = newestApx(this.options.sourceDir);
    const renderer = new ApexRenderer(loadApplication(this.options.sourceDir), this.assets, this.db, {
      ...(this.options.toolbar === undefined ? {} : { toolbar: this.options.toolbar }),
      ...(this.options.sampleRows === undefined ? {} : { sampleRows: this.options.sampleRows }),
      ...(this.options.seedDirs ? { seedDirs: this.options.seedDirs } : {}),
      ...(this.options.oracle ? { oracle: this.options.oracle } : {}),
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
    return renderer;
  }

  /** Re-parses the APEXlang tree when any .apx file changed, so edits show on the next reload. */
  #refresh(): void {
    if (newestApx(this.options.sourceDir) <= this.#loadedAt) return;
    try {
      this.renderer = this.#load();
      this.#loadError = undefined;
    } catch (error) {
      this.#loadError = (error as Error).message;
    }
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
          // A deployed application does not show internal messages to its users.
          if (this.options.application) {
            this.onError?.(error);
            response.end('The request could not be processed.');
          } else response.end(`APEX preview error: ${(error as Error).message}`);
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
      // The live socket is a developer feature; a deployed application has none.
      if (this.options.application) return rejectUpgrade(socket, 404, 'Not Found');
      if (previewRequestRefusal(request.headers, request.method, port, this.options.host))
        return rejectUpgrade(socket, 403, 'Forbidden');
      this.live.upgrade(request, socket, head, this.#existingSession(request));
    });
    await new Promise<void>((resolve, reject) => {
      this.#server!.once('error', reject);
      this.#server!.listen(this.options.port ?? 0, this.options.host ?? '127.0.0.1', () => resolve());
    });
    return this.url;
  }

  async stop(): Promise<void> {
    const server = this.#server;
    this.#server = undefined;
    this.live.close();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    server?.closeAllConnections();
    this.db.close();
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
    const application = this.options.application;
    let existing = this.#existingSession(request);
    if (existing && application) {
      // An idle session ends; the browser gets a new, signed-out one.
      const idle = Date.now() - (existing.lastSeen ?? Date.now());
      if (idle > (application.sessionTimeoutMs ?? 8 * 3_600_000)) {
        this.#sessions.delete(existing.id);
        existing = undefined;
      }
    }
    if (existing) {
      if (origin) existing.origin = origin;
      existing.lastSeen = Date.now();
      return existing;
    }
    return this.#newSession(response, origin);
  }

  /** A new session with an unguessable numeric id (APEX session ids are numbers). */
  #newSession(response: http.ServerResponse, origin?: string): Session {
    const application = this.options.application;
    const id = BigInt(`0x${randomBytes(8).toString('hex')}`)
      .toString()
      .padStart(20, '1');
    const session: Session = {
      id,
      // Application mode starts signed out, with authorization enforced for a user without roles.
      user: application ? 'nobody' : (this.options.user ?? 'DEVELOPER'),
      items: {},
      pagination: {},
      lastSeen: Date.now(),
      ...(application ? { viewAs: { roles: [], deny: [] } } : {}),
      ...(origin ? { origin } : {}),
    };
    // Idle and never-used sessions (clients without cookies) must not accumulate.
    if (application && this.#sessions.size >= 5000) {
      const limit = Date.now() - (application.sessionTimeoutMs ?? 8 * 3_600_000);
      for (const [key, entry] of this.#sessions)
        if (
          (entry.lastSeen ?? 0) < limit ||
          (!entry.authenticated && (entry.lastSeen ?? 0) < Date.now() - 600_000)
        )
          this.#sessions.delete(key);
    }
    this.#sessions.set(id, session);
    response.setHeader(
      'set-cookie',
      `APEX_LOCAL_SESSION=${id}; Path=/; HttpOnly; SameSite=Lax${application?.secureCookies ? '; Secure' : ''}`,
    );
    return session;
  }

  /** Whether a page can be opened without signing in (application mode). */
  #publicPage(pageKey: string): boolean {
    const page = this.renderer.findPage(pageKey);
    if (!page) return false;
    return (
      this.renderer.isLoginPage(page.id) ||
      /^(?:publicPage|pageIsPublic)$/u.test(str(page.props, 'security.authentication'))
    );
  }

  /** URL of the application's login page, or the built-in sign-in form. */
  #loginUrl(): string {
    const renderer = this.renderer;
    const configured = str(renderer.app.app.props, 'navigation.loginUrl.page');
    const page =
      (configured && renderer.findPage(configured)) ||
      [...renderer.app.pages.values()].find((candidate) => renderer.isLoginPage(candidate.id));
    return page ? renderer.pagePath(page) : `${renderer.baseUrl}/__login`;
  }

  /** Signs the session in; the session id changes so a pre-login id cannot be reused. */
  #signIn(
    response: http.ServerResponse,
    session: Session,
    username: string,
    password: string,
  ): Session | undefined {
    const granted = this.options.application?.authenticate(username, password);
    if (!granted) return undefined;
    this.#sessions.delete(session.id);
    const next = this.#newSession(response, session.origin);
    next.user = username.toUpperCase();
    next.authenticated = true;
    next.viewAs = { roles: granted.roles ?? [], deny: [] };
    return next;
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
    const application = this.options.application;
    // Liveness for load balancers and containers: no session, no database call.
    if (application && request.url === '/healthz') return this.#send(response, 200, 'text/plain', 'ok');
    const refusal = previewRequestRefusal(
      request.headers,
      request.method,
      port,
      this.options.host,
      application?.publicHosts,
    );
    if (refusal) {
      request.resume();
      return this.#send(
        response,
        403,
        'text/plain; charset=utf-8',
        application ? 'Forbidden' : `APEX preview: ${refusal}.`,
      );
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
      if (name === 'diagnostics' && !application)
        return this.#send(response, 200, TYPES['.json']!, JSON.stringify(this.diagnostics(), null, 2));
    }
    // A deployed application serves the sources it was built from; only the preview hot-reloads.
    if (!application) this.#refresh();
    if (this.#loadError)
      return this.#send(
        response,
        500,
        'text/plain; charset=utf-8',
        `APEXlang parse error: ${this.#loadError}`,
      );
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

    let session = this.session(request, response);
    if (application) {
      // Built-in sign-in form for applications without a login page.
      if (rest === '__login') {
        if (request.method === 'POST') {
          const form = new URLSearchParams(await body(request, 65_536));
          const signed = this.#signIn(
            response,
            session,
            form.get('username') ?? '',
            form.get('password') ?? '',
          );
          if (signed) {
            response.writeHead(302, { location: renderer.baseUrl }).end();
            return;
          }
        }
        return this.#send(
          response,
          request.method === 'POST' ? 401 : 200,
          TYPES['.html']!,
          `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign in</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f5f5f5}form{background:#fff;padding:2rem;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.15);display:grid;gap:.75rem;min-width:18rem}input,button{font:inherit;padding:.5rem}.error{color:#b00020}</style></head><body><form method="post" action="${renderer.baseUrl}/__login"><h1>Sign in</h1>${request.method === 'POST' ? '<p class="error" role="alert">Invalid username or password.</p>' : ''}<label>Username <input name="username" autocomplete="username" required autofocus></label><label>Password <input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Sign in</button></form></body></html>`,
        );
      }
      // Everything else needs a signed-in session unless it belongs to a public page.
      if (!session.authenticated && rest !== '__logout') {
        const posted = rest === 'wwv_flow.accept' || rest.startsWith(`${LOCAL_PREFIX.slice(1)}/`);
        const pageKey = posted ? (url.searchParams.get('page') ?? '') : decodeURIComponent(rest);
        // A submit names its page in the body; it is checked where the body is read below.
        if (rest !== 'wwv_flow.accept' && !(pageKey && this.#publicPage(pageKey))) {
          if (posted)
            return this.#send(response, 401, TYPES['.json']!, JSON.stringify({ error: 'Sign in required' }));
          response.writeHead(302, { location: this.#loginUrl() }).end();
          return;
        }
      }
    }
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
      if (application && !session.authenticated) {
        if (!this.#publicPage(page))
          return this.#send(response, 401, TYPES['.json']!, JSON.stringify({ error: 'Sign in required' }));
        if (renderer.isLoginPage(page)) {
          const find = (pattern: RegExp) =>
            Object.entries(values).find(([name]) => pattern.test(name.toUpperCase()))?.[1] ?? '';
          const signed = this.#signIn(response, session, find(/USERNAME$|USER_NAME$/u), find(/PASSWORD$/u));
          if (!signed)
            return this.#send(
              response,
              200,
              TYPES['.json']!,
              JSON.stringify({
                errors: [
                  { type: 'error', location: ['page'], message: 'Invalid Login Credentials', unsafe: false },
                ],
                pageSubmissionId: String(Date.now()),
              }),
            );
          session = signed;
          const home = renderer.findPage(renderer.homePage());
          return this.#send(
            response,
            200,
            TYPES['.json']!,
            JSON.stringify({
              redirectURL: home ? renderer.pagePath(home) : renderer.baseUrl,
              pageSubmissionId: String(Date.now()),
            }),
          );
        }
      }
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
      // Developer tools (session state editor, view as, data reset, debug log, outbox) are preview-only.
      const handler = application && DEVELOPER_ROUTES.has(routeName) ? undefined : routeHandler(routeName);
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
      const name = rest.slice(LOCAL_PREFIX.length + 2);
      // Ajax requests that change data run in a transaction like a page submit.
      const result = TRANSACTIONAL_ROUTES.has(name)
        ? transaction(renderer.db.db, call, this.#failure(response, failedResponse))
        : call();
      return this.#respond(response, result);
    }
    if (rest === '__logout') {
      if (application) {
        // The signed-in session ends; the next request starts a new, signed-out one.
        this.#sessions.delete(session.id);
        response.writeHead(302, { location: this.#loginUrl() }).end();
        return;
      }
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
    if (!page && application) return this.#send(response, 404, 'text/plain', 'Not found');
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
