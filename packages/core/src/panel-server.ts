import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { contained, exists, readJson, writeJson, withLock } from './fs.ts';
import { PanelService } from './panel.ts';
import { panelActionSchema } from './panel-schema.ts';
import { loadProject, parse, requireTrust } from './config.ts';
import { Fault, failure } from './result.ts';
import { resourceRoot } from './project.ts';

interface PanelSession {
  port: number;
  token: string;
  project: string;
  pid: number;
}
function validSession(value: unknown): value is PanelSession {
  const s = value as PanelSession | null;
  return (
    !!s &&
    Number.isInteger(s.port) &&
    s.port > 0 &&
    s.port < 65536 &&
    typeof s.token === 'string' &&
    /^[a-f0-9]{64}$/.test(s.token) &&
    typeof s.project === 'string'
  );
}
export async function panelDocument() {
  const root = path.join(resourceRoot(), 'panel');
  const [html, css, js] = await Promise.all(
    ['index.html', 'panel.css', 'panel.js'].map((file) => readFile(path.join(root, file), 'utf8')),
  );
  return (
    html!
      .replace('<link rel="stylesheet" href="/panel.css">', () => '<style>' + css + '</style>')
      .replace('<script src="/panel.js" defer></script>', '')
      // Inline scripts do not honor defer; initialize only after all controls exist.
      .replace('</body>', () => '<script>' + js!.replaceAll('</script', '<\\/script') + '</script>\n</body>')
  );
}
export async function startPanelServer(root: string, idleMs = 3600000, graceMs = 2000) {
  const token = randomBytes(32).toString('hex');
  const service = new PanelService(root);
  let lastRequest = Date.now(),
    origin = '';
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'self'",
    );
    const json = (status: number, data: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    try {
      if (req.headers.host !== origin.slice(7) || (req.headers.origin && req.headers.origin !== origin)) {
        json(403, { error: 'Origin rejected.' });
        return;
      }
      const url = new URL(req.url ?? '/', origin);
      const assets: Record<string, [string, string]> = {
        '/': ['index.html', 'text/html; charset=utf-8'],
        '/panel.css': ['panel.css', 'text/css; charset=utf-8'],
        '/panel.js': ['panel.js', 'text/javascript; charset=utf-8'],
      };
      if (req.method === 'GET' && assets[url.pathname]) {
        const [file, type] = assets[url.pathname]!;
        res.writeHead(200, { 'Content-Type': type });
        res.end(await readFile(path.join(resourceRoot(), 'panel', file)));
        return;
      }
      const supplied = Buffer.from(String(req.headers.authorization ?? '').replace(/^Bearer /, ''));
      if (supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) {
        json(401, { error: 'Open this panel from Codex to authorize the local session.' });
        return;
      }
      lastRequest = Date.now();
      if (req.method === 'GET' && url.pathname === '/health') {
        json(200, { project: root });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/status') {
        json(200, await service.snapshot());
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/action') {
        if (req.headers['content-type'] !== 'application/json') {
          json(415, { error: 'Expected JSON.' });
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 32768) {
            json(413, { error: 'Request too large.' });
            return;
          }
          chunks.push(chunk);
        }
        const { action } = parse(panelActionSchema, {
          action: JSON.parse(Buffer.concat(chunks).toString('utf8')),
        });
        json(200, await service.act(action));
        return;
      }
      json(404, { error: 'Not found.' });
    } catch (error) {
      json(400, failure('panel', error));
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Panel could not bind localhost.');
  origin = `http://127.0.0.1:${address.port}`;
  const timer = setInterval(
    () => {
      if (Date.now() - lastRequest > idleMs) void close();
    },
    Math.min(idleMs, 60000),
  );
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      clearInterval(timer);
      // Keep-alive or stalled clients must not hold an idle worker open forever.
      const force = setTimeout(() => server.closeAllConnections(), graceMs);
      force.unref();
      const closed = new Promise<void>((resolve) => server.close(() => resolve()));
      server.closeIdleConnections();
      await closed;
      clearTimeout(force);
      await releaseSession(root, token);
    })());
  return {
    session: { port: address.port, token, project: root, pid: process.pid } satisfies PanelSession,
    close,
  };
}
// Remove the discovery record only while it still describes this server; a
// newer panel instance may already have replaced it.
async function releaseSession(root: string, token: string) {
  try {
    const file = await contained(root, '.apexrest/panel/session.json');
    const session = await readJson(file).catch(() => null);
    if (validSession(session) && session.token === token && session.pid === process.pid)
      await rm(file, { force: true });
  } catch {
    /* A missing or replaced session record needs no cleanup. */
  }
}
// Panels serve only reviewed APEXREST projects; never create state elsewhere.
async function requirePanelProject(root: string) {
  await loadProject(root);
  await requireTrust(root);
}
export async function servePanel(root: string) {
  await requirePanelProject(root);
  const handle = await startPanelServer(root);
  await writeJson(await contained(root, '.apexrest/panel/session.json'), handle.session);
  process.once('SIGTERM', () => {
    void handle.close();
  });
  process.once('SIGINT', () => {
    void handle.close();
  });
}
export async function openPanel(root: string) {
  await requirePanelProject(root);
  const file = await contained(root, '.apexrest/panel/session.json');
  const read = async () => {
    if (!(await exists(file))) return null;
    const session = await readJson(file).catch(() => null);
    if (!validSession(session) || session.project !== root) return null;
    try {
      const response = await fetch(`http://127.0.0.1:${session.port}/health`, {
        headers: { Authorization: 'Bearer ' + session.token },
        redirect: 'error',
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok && ((await response.json()) as { project?: string }).project === root) return session;
    } catch {
      /* A stale session record never authorizes a different host. */
    }
    return null;
  };
  return withLock(await contained(root, '.apexrest/panel/start.lock'), async () => {
    let session = await read();
    if (!session) {
      const worker = spawn(
        process.execPath,
        [path.join(path.dirname(fileURLToPath(import.meta.url)), 'apexrest.mjs'), '--panel-worker', root],
        {
          cwd: root,
          env: process.env,
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        },
      );
      await new Promise<void>((resolve, reject) => {
        worker.once('spawn', resolve);
        worker.once('error', reject);
      });
      worker.unref();
      for (let i = 0; i < 50 && !session; i++) {
        await delay(100);
        session = await read();
      }
      if (!session)
        throw new Fault('PANEL_START_FAILED', 'The local panel did not become ready.', 3, 'blocked');
    }
    return {
      project: root,
      url: `http://127.0.0.1:${session.port}/#session=${session.token}`,
      nextAction:
        'Open this URL in the Codex in-app browser using open_in_codex when available. Codex CLI: apexrest panel tui --project PATH.',
    };
  });
}
