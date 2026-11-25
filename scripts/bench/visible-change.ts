// Manually invoked: node scripts/bench/run.mjs scripts/bench/visible-change.ts --app <APEXlang folder>
//   [--page p00010-customers.apx] [--reps 5] [--out FILE]
//   [--browser-cdp http://127.0.0.1:9222]   explicitly selected, already running browser (Chrome DevTools protocol)
//   [--host-events FILE]                    JSONL stage events (prompt/model/tool) recorded by the host
//
// Prompt-to-visible-change trace (V11). Each edit gets an operation id and a unique marker. The
// harness records the source mutation, preview readiness (the server's source revision), the live
// notification a page client receives, and, only with --browser-cdp, the browser showing the marker
// after region refreshes and two rendered frames. Host/model/tool timings are merged from
// --host-events when the host recorded them for the same operation id; otherwise they are unknown.
// Nothing is installed: without --browser-cdp the browser stages stay unknown and no visible total
// is claimed. The edits run on a temporary copy. Results describe this dataset and host only.
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { cpus, platform, release, tmpdir } from 'node:os';
import path from 'node:path';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { defaultAssetsDir } from '../../packages/core/src/preview/assets.ts';
import { BROWSER_WAIT, operationReport, type StageEvent } from './lib/visible-trace.ts';

const argument = (name: string) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const source = argument('--app');
if (!source) throw new Error('Pass --app <APEXlang application folder>.');
const reps = Number(argument('--reps') ?? 5);
const out = argument('--out');
const cdp = argument('--browser-cdp');
const hostEvents: StageEvent[] = argument('--host-events')
  ? (await readFile(argument('--host-events')!, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StageEvent)
  : [];

const root = await mkdtemp(path.join(tmpdir(), 'apexrest-visible-'));
const app = path.join(root, 'app');
await cp(source, app, { recursive: true });
const pageName =
  argument('--page') ??
  (await readdir(path.join(app, 'pages'))).filter(
    (file) => file.endsWith('.apx') && !file.startsWith('p00000'),
  )[0]!;
const file = path.join(app, 'pages', pageName);
const pageId = String(Number(/p(\d+)/u.exec(pageName)![1]));
const server = new PreviewServer({ sourceDir: app, assetsDir: defaultAssetsDir(), database: ':memory:' });
await server.start();
const events: StageEvent[] = [...hostEvents];
const operations: string[] = [];
let browser: { evaluate: (expression: string) => Promise<unknown>; close: () => Promise<void> } | undefined;
try {
  const pageUrl = new URL((await server.pages()).find((page) => page.id === pageId)!.url, server.url).href;
  const first = await fetch(pageUrl);
  const cookie = first.headers.get('set-cookie')?.split(';')[0] ?? '';
  await first.text();
  // A page's live client, as a browser tab holds it: every message with its arrival time.
  const live = new WebSocket(
    `${pageUrl.replace(/^http/u, 'ws').replace(/\/[^/]*$/u, '')}/__apex/live?page=${pageId}`,
    {
      headers: { cookie, origin: server.url },
    } as unknown as string[],
  );
  const messages: { at: number; message: Record<string, unknown> }[] = [];
  live.onmessage = (event) => messages.push({ at: Date.now(), message: JSON.parse(String(event.data)) });
  await new Promise((resolve) => (live.onopen = resolve));
  if (cdp) browser = await openBrowser(cdp, pageUrl);
  const original = await readFile(file, 'utf8');
  const titleLine = /^\s{4}title:/mu.test(original) ? /^(\s{4}title:\s*)(.+)$/mu : /^(\s{4}name:\s*)(.+)$/mu;
  for (let i = 0; i < reps; i++) {
    const operationId = randomUUID();
    operations.push(operationId);
    const marker = `Visible${operationId.slice(0, 8)}`;
    const before = server.revision;
    const edited = original.replace(titleLine, `$1${marker}`);
    const mutationStart = Date.now();
    await writeFile(file, edited);
    const contentRevision = createHash('sha256').update(edited).digest('hex').slice(0, 16);
    events.push({
      operationId,
      stage: 'source-mutation',
      startedAt: mutationStart,
      endedAt: Date.now(),
      marker,
      revision: contentRevision,
    });
    // Preview readiness: the server rendered a new source revision containing this marker.
    for (const started = Date.now(); Date.now() - started < 10000;) {
      const html = await (await fetch(pageUrl, { headers: { cookie } })).text();
      if (server.revision > before && html.includes(marker)) {
        events.push({
          operationId,
          stage: 'preview-ready',
          startedAt: mutationStart,
          endedAt: Date.now(),
          marker,
          detail: { previewRevision: server.revision },
        });
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    // Live notification: the first reload after the mutation for a newer revision.
    for (const started = Date.now(); Date.now() - started < 5000;) {
      const note = messages.find(
        (entry) =>
          entry.at >= mutationStart &&
          entry.message.type === 'reload' &&
          Number(entry.message.revision) > before,
      );
      if (note) {
        events.push({
          operationId,
          stage: 'live-notification',
          startedAt: mutationStart,
          endedAt: note.at,
          detail: {
            previewRevision: Number(note.message.revision),
            sequence: Number(note.message.sequence ?? -1),
          },
        });
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    // The live client reloads the page, which ends any script running in it: the page check is
    // started again until a loaded page shows the marker (or the time is up).
    if (browser)
      for (const started = Date.now(); Date.now() - started < 15000;) {
        try {
          const shown = (await browser.evaluate(`(${BROWSER_WAIT})(${JSON.stringify(marker)}, 2000)`)) as
            { domAt: number; frameAt: number } | undefined;
          if (shown) {
            events.push({
              operationId,
              stage: 'dom-update',
              startedAt: mutationStart,
              endedAt: shown.domAt,
              marker,
            });
            events.push({
              operationId,
              stage: 'visible-frame',
              startedAt: shown.domAt,
              endedAt: shown.frameAt,
              marker,
            });
            break;
          }
        } catch {
          /* Navigation in progress or not visible yet: try again. */
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  await writeFile(file, original);
  live.close();
} finally {
  await browser?.close();
  await server.stop();
  await rm(root, { recursive: true, force: true });
}
const report = {
  kind: 'manually invoked prompt-to-visible-change trace',
  date: new Date().toISOString(),
  host: { platform: platform(), release: release(), cpu: cpus()[0]?.model, node: process.version },
  dataset: `${path.basename(source)}, page ${pageName}, ${reps} title edits`,
  browser: cdp ? 'explicit DevTools endpoint' : 'none (browser stages unknown)',
  hostEvents: hostEvents.length ? 'merged by operation id' : 'none (prompt, model and tool stages unknown)',
  outcomes: {
    localPreview: 'measured',
    oracleValidation: 'not part of this trace',
    nativeImport: 'not part of this trace',
    browserVerification: cdp ? 'measured' : 'not run',
  },
  operations: operations.map((id) => operationReport(id, events)),
};
const text = JSON.stringify(report, null, 2) + '\n';
if (out) await writeFile(out, text);
process.stdout.write(text);

/** A new tab in an explicitly given, already running browser, driven over its DevTools socket. */
async function openBrowser(endpoint: string, url: string) {
  const target = (await (
    await fetch(`${endpoint}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  ).json()) as {
    id: string;
    webSocketDebuggerUrl: string;
  };
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let next = 0;
  const pending = new Map<number, (value: unknown) => void>();
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: unknown };
    // A destroyed execution context (the page reloaded) answers with an error: report it as one.
    if (message.id !== undefined)
      pending.get(message.id)?.(message.error ? { exceptionDetails: message.error } : message.result);
  };
  const call = (method: string, params: Record<string, unknown>) =>
    new Promise<unknown>((resolve) => {
      const id = ++next;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return {
    evaluate: async (expression: string) => {
      const result = (await call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })) as {
        result?: { value?: unknown };
        exceptionDetails?: unknown;
      };
      if (result.exceptionDetails) throw new Error('page check failed');
      return result.result?.value;
    },
    close: async () => {
      socket.close();
      await fetch(`${endpoint}/json/close/${target.id}`).catch(() => undefined);
    },
  };
}
