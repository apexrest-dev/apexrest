import fs from 'node:fs';
import type http from 'node:http';
import path from 'node:path';
import type { Duplex } from 'node:stream';
import { acceptWebSocket, rejectUpgrade, type WebSocketConnection } from './websocket.ts';
import type { Session } from './render.ts';

/**
 * Live preview over WebSocket (`<baseUrl>/__apex/live`). Every open page keeps one socket; the
 * server pushes:
 * - `changed`: tables a request wrote, so pages refresh the regions that read them (reports,
 *   grids, cards, charts, calendars, facets) without a reload, in every tab and session;
 * - `reload` / `source-error`: an `.apx` or static file changed, so pages reload themselves;
 * - `presence`: how many sockets view the same page, and as which users.
 * Browsers only listen; the page is named once in the URL (`?page=`).
 */

export interface LiveChange {
  tables: string[];
  /** APP_USER of the request that wrote them. */
  user: string;
  /** Session of that request; its own sockets get `self: true`. */
  session?: string | undefined;
  /** Browser tab of that request (`x-apex-local-tab`); its socket gets `here: true`. */
  tab?: string | undefined;
}

interface Client {
  connection: WebSocketConnection;
  session: Session;
  page: string;
  tab: string;
}

/** Tables of the preview itself and SQLite's catalog never reach browsers. */
const internal = (table: string) => /^(?:SQLITE_|APEX_LOCAL_)/u.test(table);

export class LiveHub {
  readonly #clients = new Set<Client>();
  readonly #sourceDir: string;
  /** Data changes are pushed only when the data persists (not in connected Oracle mode). */
  readonly data: boolean;
  #watcher?: fs.FSWatcher | undefined;
  #timer?: NodeJS.Timeout | undefined;
  #onSource: () => string | undefined;

  /** `onSource` re-reads the application after a source change and returns a parse error, if any. */
  constructor(options: { sourceDir: string; data: boolean; onSource: () => string | undefined }) {
    this.#sourceDir = options.sourceDir;
    this.data = options.data;
    this.#onSource = options.onSource;
  }

  get size(): number {
    return this.#clients.size;
  }

  /** Accepts an upgrade on the live route for an existing preview session. */
  upgrade(request: http.IncomingMessage, socket: Duplex, head: Buffer, session: Session | undefined): void {
    // Browsers send Origin; a page from another site must not read this preview's changes.
    const origin = request.headers.origin;
    if (origin && URL.parse(origin)?.host !== request.headers.host)
      return rejectUpgrade(socket, 403, 'Forbidden');
    // A page of a restarted preview has a session the server no longer knows: tell it once, so it
    // offers a reload instead of reconnecting forever.
    if (!session) {
      acceptWebSocket(request, socket, head, {})?.send({ type: 'expired' });
      socket.end();
      return;
    }
    const params = new URL(request.url ?? '/', 'http://localhost').searchParams;
    const page = params.get('page') ?? '';
    const tab = params.get('tab') ?? '';
    let client: Client | undefined;
    const connection = acceptWebSocket(request, socket, head, {
      close: () => {
        if (client) this.#clients.delete(client);
        this.#presence();
        if (!this.#clients.size) this.#unwatch();
      },
    });
    if (!connection) return;
    client = { connection, session, page, tab };
    this.#clients.add(client);
    this.#watch();
    connection.send({ type: 'hello', data: this.data });
    this.#presence();
  }

  /** Tells every page which tables changed; returns the tables that were sent. */
  changed(change: LiveChange): string[] {
    const tables = [...new Set(change.tables.map((table) => table.toUpperCase()))].filter(
      (table) => !internal(table),
    );
    if (!this.data || !tables.length) return [];
    for (const client of this.#clients)
      client.connection.send({
        type: 'changed',
        tables,
        user: change.user,
        self: change.session !== undefined && client.session.id === change.session,
        here: Boolean(change.tab) && client.tab === change.tab,
      });
    return tables;
  }

  /** Sends a message to every page. */
  broadcast(message: Record<string, unknown>): void {
    for (const client of this.#clients) client.connection.send(message);
  }

  #presence(): void {
    const pages = new Map<string, Client[]>();
    for (const client of this.#clients) pages.set(client.page, [...(pages.get(client.page) ?? []), client]);
    for (const [, clients] of pages) {
      const users = [...new Set(clients.map((client) => client.session.user))].sort();
      const sessions = new Set(clients.map((client) => client.session.id)).size;
      for (const client of clients)
        client.connection.send({ type: 'presence', viewers: clients.length, sessions, users });
    }
  }

  /** Watches the source tree while pages are connected; edits reload them. */
  #watch(): void {
    if (this.#watcher) return;
    try {
      this.#watcher = fs.watch(this.#sourceDir, { recursive: true }, (_event, file) => {
        const name = String(file ?? '');
        const parts = name.split(path.sep);
        // Some platforms report no file name; reload to be safe.
        const relevant = !name || name.endsWith('.apx') || parts.includes('static-files');
        if (!relevant || parts.some((part) => part.startsWith('.'))) return;
        clearTimeout(this.#timer);
        // Editors write in several steps; wait for the burst to end.
        this.#timer = setTimeout(() => this.#sourceChanged(name), 150);
      });
      this.#watcher.on('error', () => this.#unwatch());
    } catch {
      // No file watching on this file system: pages still pick up edits on their next request.
      this.#watcher = undefined;
    }
  }

  #sourceChanged(file: string): void {
    const error = this.#onSource();
    if (error) this.broadcast({ type: 'source-error', message: error });
    else this.broadcast({ type: 'reload', file: file.split(path.sep).join('/') });
  }

  #unwatch(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#watcher?.close();
    this.#watcher = undefined;
  }

  close(): void {
    this.#unwatch();
    for (const client of this.#clients) client.connection.close(1001);
    this.#clients.clear();
  }
}
