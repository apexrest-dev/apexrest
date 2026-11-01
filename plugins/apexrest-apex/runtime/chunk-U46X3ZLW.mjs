import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  SqlclMcpClient,
  emitSqlclTiming,
  executionTiming,
  mcpCallOptions,
  mcpFailure,
  mcpResult
} from "./chunk-XYDSY3MB.mjs";
import {
  canonical,
  hash
} from "./chunk-7UXC37DJ.mjs";
import {
  Fault
} from "./chunk-CCPOHUCO.mjs";

// packages/core/src/sqlcl-session.ts
import { performance } from "node:perf_hooks";
var IDLE_MS = 10 * 60 * 1e3;
var PROBE_AFTER_MS = 30 * 1e3;
var PooledSession = class {
  constructor(key, request) {
    this.key = key;
    this.client = new SqlclMcpClient(request);
  }
  key;
  busy = true;
  dead = false;
  lastUsed = Date.now();
  idleTimer;
  client;
  get alive() {
    return !this.dead && this.client.alive;
  }
  kill() {
    this.dead = true;
    clearTimeout(this.idleTimer);
    void this.client.close();
  }
};
var pools = /* @__PURE__ */ new Map();
var exitHook = false;
var shutdownGeneration = 0;
function sqlclSessionKey(request) {
  return hash(
    canonical({
      executable: request.executable,
      javaHome: request.env?.JAVA_HOME ?? null,
      args: request.args,
      connectionName: request.connectionName ?? null,
      cwd: request.cwd
    })
  );
}
function pool(key) {
  let p = pools.get(key);
  if (!p) pools.set(key, p = { sessions: [], waiters: [] });
  return p;
}
function release(session) {
  const p = pool(session.key);
  session.busy = false;
  if (session.alive) session.lastUsed = Date.now();
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
function discard(session) {
  session.kill();
  const p = pool(session.key);
  p.sessions = p.sessions.filter((s) => s !== session);
  if (!p.sessions.length && !p.waiters.length) pools.delete(session.key);
}
async function acquire(request, key) {
  const generation = shutdownGeneration;
  const limit = request.limit ?? (request.connectionName ? 1 : 2);
  for (; ; ) {
    if (generation !== shutdownGeneration) throw new Fault("CANCELLED", "SQLcl pool closed.", 6, "cancelled");
    if (request.signal?.aborted) throw new Fault("CANCELLED", "SQLcl session cancelled.", 6, "cancelled");
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
    await new Promise((resolve) => {
      const wake = () => {
        request.signal?.removeEventListener("abort", wake);
        p.waiters = p.waiters.filter((w) => w !== wake);
        resolve();
      };
      p.waiters.push(wake);
      request.signal?.addEventListener("abort", wake, { once: true });
    });
  }
}
function installExitHook() {
  if (exitHook) return;
  exitHook = true;
  process.on("exit", () => {
    for (const p of pools.values()) for (const session of p.sessions) session.kill();
  });
}
async function prepare(session, request, options, timing) {
  const fresh = !session.client.alive;
  if (fresh) {
    const spawnStarted = performance.now();
    await session.client.open(options()());
    timing.spawnMs = (timing.spawnMs ?? 0) + performance.now() - spawnStarted;
    if (request.connectionName) {
      const connectStarted = performance.now();
      const connected = await session.client.connect(request.connectionName, options());
      timing.connectMs = (timing.connectMs ?? 0) + performance.now() - connectStarted;
      if (connected.isError) return mcpResult(connected, session.client.text(connected));
    }
    return;
  }
  if (request.connectionName && Date.now() - session.lastUsed > PROBE_AFTER_MS) {
    const probe = await session.client.execute(
      "select 1 as apexrest_probe from dual;",
      options(),
      () => false
    );
    if (probe.isError || !/apexrest_probe/i.test(session.client.text(probe)))
      throw new Error("SQLcl session lost its database connection.");
  }
  return;
}
async function runPooledSqlcl(request) {
  if (request.signal?.aborted)
    return { code: null, stdout: "", stderr: "", timedOut: false, cancelled: true, truncated: false };
  const started = performance.now();
  const timing = executionTiming(
    "mcp-pool",
    request.mutation,
    !!request.connectionName || !!request.sqlclConnected
  );
  const key = sqlclSessionKey(request);
  let session = await acquire(request, key);
  if (request.mutation && session.client.alive) {
    session.kill();
    release(session);
    session = await acquire(request, key);
  }
  timing.queueMs = performance.now() - started;
  timing.reused = session.client.alive;
  const deadline = Date.now() + (request.timeoutMs ?? 18e4);
  const options = () => mcpCallOptions(request, deadline);
  let submitted = false;
  let executeStarted;
  try {
    let failed;
    try {
      failed = await prepare(session, request, options, timing);
    } catch (error) {
      if (!session.client.alive || request.signal?.aborted || Date.now() >= deadline) throw error;
      session.kill();
      release(session);
      session = await acquire(request, key);
      failed = await prepare(session, request, options, timing);
    }
    if (failed) {
      session.kill();
      return failed;
    }
    submitted = true;
    executeStarted = performance.now();
    const result = await session.client.execute(request.input ?? "", options(), () => request.mutation);
    timing.executeMs = performance.now() - executeStarted;
    const output = session.client.text(result, request.mutation);
    if (request.connectionName || request.mutation || result.isError || /(?:ORA-|SP2-|PLS-)\d+/i.test(output) || request.completionMarker && !output.split(/\r?\n/).some((line) => line.trim() === request.completionMarker))
      session.kill();
    return mcpResult(result, output);
  } catch (error) {
    session.kill();
    if (error instanceof Fault) throw error;
    const interrupted = request.signal?.aborted ? "cancelled" : Date.now() >= deadline ? "timedOut" : void 0;
    if (interrupted)
      return {
        code: null,
        stdout: "",
        stderr: "",
        timedOut: interrupted === "timedOut",
        cancelled: interrupted === "cancelled",
        truncated: false
      };
    throw mcpFailure(error, request, submitted);
  } finally {
    if (executeStarted !== void 0) timing.executeMs = performance.now() - executeStarted;
    release(session);
    emitSqlclTiming(request.onSqlclTiming, timing, started);
  }
}
async function closeSqlclSessions() {
  shutdownGeneration++;
  for (const p of pools.values()) for (const wake of [...p.waiters]) wake();
  const sessions = [...pools.values()].flatMap((p) => p.sessions);
  pools.clear();
  await Promise.all(sessions.map((session) => session.client.close()));
  for (const session of sessions) session.kill();
}
function sqlclSessionStats() {
  return [...pools.entries()].map(([key, p]) => ({
    key,
    sessions: p.sessions.filter((s) => s.alive).length,
    busy: p.sessions.filter((s) => s.busy).length,
    waiting: p.waiters.length
  }));
}

export {
  IDLE_MS,
  PROBE_AFTER_MS,
  sqlclSessionKey,
  runPooledSqlcl,
  closeSqlclSessions,
  sqlclSessionStats
};
