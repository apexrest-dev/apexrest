import { canonical, hash } from './fs.ts';
import type { ProcessResult } from './process.ts';
import { Fault } from './result.ts';
import { SqlclMcpClient, mcpCallOptions, mcpFailure, mcpResult, type SqlclMcpRequest } from './sqlcl-mcp.ts';

/**
 * Persistent SQLcl sessions. SQLcl executes a piped stdin script only after
 * EOF, so the long-lived engine is SQLcl's own server mode (`sql [-R n] -mcp`):
 * one JVM per key {executable, javaHome, server args, connection, cwd} that
 * runs successive command batches through its SQLcl command tool. Commands on
 * one session are serialized; a key opens at most `limit` sessions and queues
 * the rest. A timed-out, cancelled, truncated or failed-transport command kills
 * its session so the next call starts fresh. Idle sessions are unref'd (a
 * one-shot CLI still exits naturally), reaped after IDLE_MS and killed at exit.
 */
export const IDLE_MS = 10 * 60 * 1000;
export const PROBE_AFTER_MS = 30 * 1000;
export interface SqlclSessionRequest extends SqlclMcpRequest {
  /** Sessions per key (default 1 for connected sessions, 2 for /nolog). */
  limit?: number;
}
class PooledSession {
  busy = true;
  dead = false;
  lastUsed = Date.now();
  idleTimer: NodeJS.Timeout | undefined;
  readonly client: SqlclMcpClient;
  constructor(
    readonly key: string,
    request: SqlclSessionRequest,
  ) {
    this.client = new SqlclMcpClient(request);
  }
  get alive() {
    return !this.dead && this.client.alive;
  }
  kill() {
    this.dead = true;
    clearTimeout(this.idleTimer);
    void this.client.close();
  }
}
interface Pool {
  sessions: PooledSession[];
  waiters: (() => void)[];
}
const pools = new Map<string, Pool>();
let exitHook = false;

export function sqlclSessionKey(request: SqlclSessionRequest) {
  return hash(
    canonical({
      executable: request.executable,
      javaHome: request.env?.JAVA_HOME ?? null,
      args: request.args,
      connectionName: request.connectionName ?? null,
      cwd: request.cwd,
    }),
  );
}
function pool(key: string) {
  let p = pools.get(key);
  if (!p) pools.set(key, (p = { sessions: [], waiters: [] }));
  return p;
}
function release(session: PooledSession) {
  const p = pool(session.key);
  session.busy = false;
  session.lastUsed = Date.now();
  if (session.alive) {
    session.client.transport.setActive(false);
    clearTimeout(session.idleTimer);
    session.idleTimer = setTimeout(() => {
      if (!session.busy) discard(session);
    }, IDLE_MS);
    session.idleTimer.unref();
  } else discard(session);
  const waiter = p.waiters.shift();
  waiter?.();
}
function discard(session: PooledSession) {
  session.kill();
  const p = pool(session.key);
  p.sessions = p.sessions.filter((s) => s !== session);
  if (!p.sessions.length && !p.waiters.length) pools.delete(session.key);
}
async function acquire(request: SqlclSessionRequest, key: string): Promise<PooledSession> {
  const limit = request.limit ?? (request.connectionName ? 1 : 2);
  for (;;) {
    if (request.signal?.aborted) throw new Fault('CANCELLED', 'SQLcl session cancelled.', 6, 'cancelled');
    const p = pool(key);
    const idle = p.sessions.find((s) => !s.busy && s.alive);
    if (idle) {
      idle.busy = true;
      clearTimeout(idle.idleTimer);
      idle.client.transport.setActive(true);
      return idle;
    }
    if (p.sessions.filter((s) => s.alive).length < limit) {
      const session = new PooledSession(key, request);
      p.sessions.push(session);
      installExitHook();
      return session;
    }
    await new Promise<void>((resolve) => {
      const wake = () => {
        request.signal?.removeEventListener('abort', wake);
        p.waiters = p.waiters.filter((w) => w !== wake);
        resolve();
      };
      p.waiters.push(wake);
      request.signal?.addEventListener('abort', wake, { once: true });
    });
  }
}
function installExitHook() {
  if (exitHook) return;
  exitHook = true;
  process.on('exit', () => {
    for (const p of pools.values()) for (const session of p.sessions) session.kill();
  });
}
async function prepare(
  session: PooledSession,
  request: SqlclSessionRequest,
  options: () => ReturnType<typeof mcpCallOptions>,
) {
  const fresh = !session.client.alive;
  if (fresh) {
    await session.client.open(options()());
    if (request.connectionName) {
      const connected = await session.client.connect(request.connectionName, options());
      if (connected.isError) return mcpResult(connected, session.client.text(connected));
    }
    return;
  }
  // A reused connected session re-checks its database link only after a pause.
  if (request.connectionName && Date.now() - session.lastUsed > PROBE_AFTER_MS) {
    const probe = await session.client.execute(
      'select 1 as apexrest_probe from dual;',
      options(),
      () => false,
    );
    if (probe.isError || !/apexrest_probe/i.test(session.client.text(probe)))
      throw new Error('SQLcl session lost its database connection.');
  }
  return;
}
export async function runPooledSqlcl(request: SqlclSessionRequest): Promise<ProcessResult> {
  if (request.signal?.aborted)
    return { code: null, stdout: '', stderr: '', timedOut: false, cancelled: true, truncated: false };
  const key = sqlclSessionKey(request);
  const session = await acquire(request, key);
  const deadline = Date.now() + (request.timeoutMs ?? 180000);
  const options = () => mcpCallOptions(request, deadline);
  let submitted = false;
  try {
    const failed = await prepare(session, request, options);
    if (failed) {
      session.kill();
      return failed;
    }
    submitted = true;
    const result = await session.client.execute(request.input ?? '', options(), () => request.mutation);
    return mcpResult(result, session.client.text(result, request.mutation));
  } catch (error) {
    session.kill();
    if (error instanceof Fault) throw error;
    // Interrupted commands report like an interrupted CLI process: the adapter's
    // diagnostics turn these into TIMEOUT/CANCELLED with an unknown outcome for
    // writes. Other transport failures keep the SQLcl MCP fault semantics.
    const interrupted = request.signal?.aborted
      ? 'cancelled'
      : Date.now() >= deadline
        ? 'timedOut'
        : undefined;
    if (interrupted)
      return {
        code: null,
        stdout: '',
        stderr: '',
        timedOut: interrupted === 'timedOut',
        cancelled: interrupted === 'cancelled',
        truncated: false,
      };
    throw mcpFailure(error, request, submitted);
  } finally {
    release(session);
  }
}
/** Kill every pooled SQLcl server (process exit, tests, explicit shutdown). */
export async function closeSqlclSessions() {
  const sessions = [...pools.values()].flatMap((p) => p.sessions);
  pools.clear();
  await Promise.all(sessions.map((session) => session.client.close()));
  for (const session of sessions) session.kill();
}
export function sqlclSessionStats() {
  return [...pools.entries()].map(([key, p]) => ({
    key,
    sessions: p.sessions.filter((s) => s.alive).length,
    busy: p.sessions.filter((s) => s.busy).length,
    waiting: p.waiters.length,
  }));
}
