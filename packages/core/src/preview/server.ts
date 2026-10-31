import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { loadApplication, str } from './apexlang.ts';
import { loadAssets, type ApexAssets } from './assets.ts';
import { messagesScript, RUNTIME_CSS, RUNTIME_JS } from './client.ts';
import { LocalDatabase } from './database.ts';
import { extensionClient, extensionCss, routeHandler } from './extensions.ts';
import { ApexRenderer, LOCAL_PREFIX, MESSAGES, type Diagnostic, type Session } from './render.ts';

export interface PreviewOptions {
  /** Folder that contains application.apx. */
  sourceDir: string;
  assetsDir?: string;
  /** SQLite file; defaults to <sourceDir>/.apex-local/preview.sqlite. */
  database?: string;
  /** Delete the database and seed it again from .apex-local/*.sql. */
  reset?: boolean;
  host?: string;
  port?: number;
  user?: string;
  toolbar?: boolean;
  sampleRows?: number;
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

async function body(request: http.IncomingMessage, limit = 8 * 1_048_576): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error('Request body is too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Local, database-free runtime for APEXlang sources: Universal Theme 26.2 assets plus SQLite. */
export class PreviewServer {
  readonly options: PreviewOptions;
  readonly assets: ApexAssets;
  readonly db: LocalDatabase;
  readonly seedProblems: string[];
  renderer: ApexRenderer;
  #server?: http.Server | undefined;
  #sessions = new Map<string, Session>();
  #loadedAt = 0;
  #loadError?: string | undefined;

  constructor(options: PreviewOptions) {
    this.options = { ...options, sourceDir: path.resolve(options.sourceDir) };
    this.assets = loadAssets(options.assetsDir);
    const file = options.database ?? path.join(this.options.sourceDir, '.apex-local', 'preview.sqlite');
    if (options.reset && file !== ':memory:')
      for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
    const fresh = file === ':memory:' || !fs.existsSync(file);
    this.db = new LocalDatabase(file);
    this.seedProblems = fresh ? ApexRenderer.seed(this.db, this.options.sourceDir) : [];
    this.renderer = this.#load();
  }

  #load(): ApexRenderer {
    this.#loadedAt = newestApx(this.options.sourceDir);
    const renderer = new ApexRenderer(loadApplication(this.options.sourceDir), this.assets, this.db, {
      ...(this.options.toolbar === undefined ? {} : { toolbar: this.options.toolbar }),
      ...(this.options.sampleRows === undefined ? {} : { sampleRows: this.options.sampleRows }),
    });
    for (const problem of this.seedProblems) renderer.diagnose('warning', `Seed script: ${problem}`);
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
      this.#handle(request, response).catch((error: unknown) => {
        if (!response.headersSent) response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        response.end(`APEX preview error: ${(error as Error).message}`);
      });
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
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    server?.closeAllConnections();
    this.db.close();
  }

  session(request: http.IncomingMessage, response: http.ServerResponse): Session {
    const cookie = /(?:^|;\s*)APEX_LOCAL_SESSION=([\w-]+)/u.exec(request.headers.cookie ?? '')?.[1];
    const existing = cookie ? this.#sessions.get(cookie) : undefined;
    if (existing) return existing;
    const id = String(Math.floor(Math.random() * 9e15) + 1e15);
    const session: Session = { id, user: this.options.user ?? 'DEVELOPER', items: {}, pagination: {} };
    this.#sessions.set(id, session);
    response.setHeader('set-cookie', `APEX_LOCAL_SESSION=${id}; Path=/; HttpOnly; SameSite=Lax`);
    return session;
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

  async #handle(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
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
    this.#refresh();
    if (this.#loadError)
      return this.#send(
        response,
        500,
        'text/plain; charset=utf-8',
        `APEXlang parse error: ${this.#loadError}`,
      );
    const renderer = this.renderer;
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
    if (rest.startsWith('files/workspace/'))
      return this.#static(
        response,
        path.join(this.options.sourceDir, 'workspace-components', 'static-files'),
        rest.slice(16),
        false,
      );

    const session = this.session(request, response);
    if (rest === 'wwv_flow.accept' && request.method === 'POST') {
      const form = new URLSearchParams(await body(request));
      const json = JSON.parse(form.getAll('p_json').join('') || '{}') as {
        pageItems?: { itemsToSubmit?: { n: string; v: string | string[] }[] };
      };
      const values = Object.fromEntries(
        (json.pageItems?.itemsToSubmit ?? []).map((item) => [
          item.n,
          Array.isArray(item.v) ? item.v.join(':') : String(item.v ?? ''),
        ]),
      );
      const page = form.get('p_flow_step_id') ?? '';
      const result = renderer.isLoginPage(page)
        ? renderer.login(session, values)
        : renderer.accept(session, page, form.get('p_request') ?? '', values);
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
      const handler = routeHandler(rest.slice(LOCAL_PREFIX.length + 2));
      if (!handler) return this.#send(response, 404, 'text/plain', 'Unknown preview route');
      const result = handler(renderer, session, {
        method: request.method ?? 'GET',
        params: url.searchParams,
        body: request.method === 'POST' ? await body(request) : '',
      });
      const types = {
        json: TYPES['.json']!,
        html: TYPES['.html']!,
        text: 'text/plain; charset=utf-8',
        js: TYPES['.js']!,
      };
      return this.#send(response, result.status ?? 200, types[result.type], result.body);
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
        code?: string;
        items?: Record<string, string>;
        returnItems?: string[];
      };
      const values = renderer.executeServerCode(
        session,
        url.searchParams.get('page') ?? '',
        input.code ?? '',
        input.items ?? {},
        input.returnItems ?? [],
      );
      return this.#send(response, 200, TYPES['.json']!, JSON.stringify(values));
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
    }
    if (url.searchParams.has('apex_theme_style'))
      session.themeStyle = url.searchParams.get('apex_theme_style') || undefined;
    for (const [key, value] of url.searchParams) {
      if (!['clear', 'request', 'session', 'cs', 'apex_theme_style'].includes(key))
        session.items[key.toUpperCase()] = value;
    }
    const ctx = renderer.prepare(session, page.id, url.searchParams.get('request') ?? '');
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
      }
    });
    return { pages, diagnostics: preview.diagnostics() };
  } finally {
    preview.db.close();
  }
}
