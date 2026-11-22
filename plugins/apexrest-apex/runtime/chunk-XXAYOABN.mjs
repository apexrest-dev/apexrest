import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  claimJob,
  executeJob,
  failQueuedJob
} from "./chunk-NFYN6CEE.mjs";
import {
  VERSION
} from "./chunk-IIUPXDVT.mjs";
import {
  contained,
  exists,
  readJson,
  withLock,
  writeJson
} from "./chunk-26MTCOZK.mjs";
import {
  Fault
} from "./chunk-CI5IU2PI.mjs";

// packages/core/src/broker.ts
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
var IDLE_MS = () => Math.max(6e4, Number(process.env.APEXREST_BROKER_IDLE_MINUTES ?? 30) * 6e4);
var recordFile = (root) => path.join(root, ".apexrest", "broker", "broker.json");
function brokerEndpoint(root) {
  const id = createHash("sha256").update(root).digest("hex").slice(0, 20);
  return process.platform === "win32" ? `\\\\.\\pipe\\apexrest-${id}` : path.join(tmpdir(), `apexrest-${id}.sock`);
}
function request(record, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(record.endpoint);
    let buffer = "";
    const done = (error, value) => {
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => done(new Error("Broker did not answer in time.")), timeoutMs);
    socket.on("connect", () => socket.write(JSON.stringify({ ...body, token: record.token }) + "\n"));
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const end = buffer.indexOf("\n");
      if (end < 0) return;
      try {
        done(void 0, JSON.parse(buffer.slice(0, end)));
      } catch (error) {
        done(error);
      }
    });
    socket.on("error", (error) => done(error));
    socket.on("close", () => done(new Error("Broker closed the connection.")));
  });
}
async function readRecord(root) {
  try {
    const record = await readJson(recordFile(root));
    return record && typeof record.token === "string" && typeof record.endpoint === "string" ? record : void 0;
  } catch {
    return void 0;
  }
}
async function liveBroker(root, timeoutMs = 500) {
  const record = await readRecord(root);
  if (!record || record.version !== VERSION || record.root !== root) return void 0;
  try {
    const answer = await request(record, { op: "ping" }, timeoutMs);
    return answer.ok ? { record, status: answer } : void 0;
  } catch {
    return void 0;
  }
}
async function submitToBroker(root, jobId) {
  const live = await liveBroker(root);
  if (!live) return false;
  try {
    const answer = await request(live.record, { op: "run", jobId }, 2e3);
    return answer.accepted === true;
  } catch {
    return false;
  }
}
async function startBroker(ctx, runtime) {
  return withLock(path.join(ctx.root, ".apexrest", "broker", "start.lock"), async () => {
    const running = await liveBroker(ctx.root);
    if (running) return { status: "running", reused: true, ...summary(running.record, running.status) };
    const child = spawn(process.execPath, [runtime, "--broker", ctx.root], {
      cwd: ctx.root,
      env: process.env,
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    child.unref();
    const deadline = Date.now() + 15e3;
    while (Date.now() < deadline) {
      const live = await liveBroker(ctx.root);
      if (live && live.record.pid === child.pid)
        return { status: "running", reused: false, ...summary(live.record, live.status) };
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    try {
      process.kill(child.pid, "SIGTERM");
    } catch {
    }
    throw new Fault("BROKER_START_FAILED", "The development broker did not start within 15 seconds.", 3);
  });
}
function summary(record, status) {
  return {
    pid: record.pid,
    version: record.version,
    startedAt: record.startedAt,
    running: status.running ?? [],
    waiting: status.waiting ?? [],
    idleMinutes: status.idleMinutes
  };
}
async function brokerStatus(ctx) {
  const live = await liveBroker(ctx.root);
  return live ? { status: "running", ...summary(live.record, live.status) } : { status: "stopped" };
}
async function stopBroker(ctx, waitSeconds = 30) {
  const live = await liveBroker(ctx.root);
  if (!live) return { status: "stopped", wasRunning: false };
  const answer = await request(live.record, { op: "stop" }, 2e3);
  const deadline = Date.now() + waitSeconds * 1e3;
  while (Date.now() < deadline) {
    if (!await liveBroker(ctx.root, 300)) return { status: "stopped", wasRunning: true };
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return {
    status: "stopping",
    running: answer.running ?? [],
    nextAction: "Running jobs keep their heartbeats; check them with apexrest_job action:status."
  };
}
async function runBroker(ctx, execute) {
  const token = randomBytes(32).toString("hex");
  const endpoint = brokerEndpoint(ctx.root);
  const running = /* @__PURE__ */ new Set();
  const waiting = /* @__PURE__ */ new Map();
  const busy = /* @__PURE__ */ new Set();
  let stopping = false;
  let idle;
  const expected = Buffer.from(token);
  if (process.platform !== "win32") await rm(endpoint, { force: true });
  const finish = async () => {
    clearTimeout(idle);
    server.close();
    const record = await readRecord(ctx.root);
    if (record?.pid === process.pid) await rm(recordFile(ctx.root), { force: true });
    if (process.platform !== "win32") await rm(endpoint, { force: true });
    process.exit(0);
  };
  const touch = () => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      if (!running.size && ![...waiting.values()].some((queue) => queue.length)) void finish();
      else touch();
    }, IDLE_MS());
  };
  const settle = () => {
    if (stopping && !running.size && ![...waiting.values()].some((queue) => queue.length)) void finish();
  };
  const run = async (id) => {
    running.add(id);
    try {
      await executeJob(ctx, id, execute, "broker");
    } catch (error) {
      if (!(error instanceof Fault && error.code === "JOB_ALREADY_CLAIMED"))
        await failQueuedJob(ctx.root, id, error).catch(() => void 0);
    } finally {
      running.delete(id);
      touch();
      settle();
    }
  };
  const drain = async (env) => {
    if (busy.has(env)) return;
    busy.add(env);
    try {
      for (; ; ) {
        const queue = waiting.get(env) ?? [];
        if (!queue.length) break;
        const newest = queue.at(-1);
        const newestAt = await planCreated(ctx, newest);
        const covered = queue.slice(0, -1);
        const coverable = newestAt !== void 0 && (await Promise.all(covered.map((id) => planCreated(ctx, id)))).every(
          (at) => at !== void 0 && at <= newestAt
        );
        if (coverable) {
          queue.splice(0);
          for (const older of covered) await supersede(ctx, older, newest);
          await run(newest);
        } else await run(queue.shift());
      }
    } finally {
      busy.delete(env);
    }
  };
  const accept = async (jobId) => {
    const root = await contained(ctx.root, ".apexrest/jobs/" + jobId);
    const state = await readJson(path.join(root, "state.json"));
    if (state.status !== "queued" || await exists(path.join(root, "claim.json"))) return false;
    const requested = await readJson(path.join(root, "request.json"));
    if (requested.operation === "ship.apply") {
      const env = String(requested.input.env ?? "");
      waiting.set(env, [...waiting.get(env) ?? [], jobId]);
      setTimeout(() => void drain(env), 50);
    } else void run(jobId);
    return true;
  };
  const server = net.createServer((socket) => {
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (buffer.length > 16384) return socket.destroy();
      const end = buffer.indexOf("\n");
      if (end < 0) return;
      void (async () => {
        let reply;
        try {
          const message = JSON.parse(buffer.slice(0, end));
          const given = Buffer.from(String(message.token ?? ""));
          if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
            reply = { ok: false, error: "unauthorized" };
          } else if (message.op === "ping") {
            reply = {
              ok: true,
              pid: process.pid,
              running: [...running],
              waiting: [...waiting.values()].flat(),
              idleMinutes: IDLE_MS() / 6e4
            };
          } else if (message.op === "run" && typeof message.jobId === "string" && /^[0-9a-f-]{36}$/u.test(message.jobId)) {
            touch();
            reply = stopping ? { ok: false, error: "stopping" } : { ok: true, accepted: await accept(message.jobId) };
          } else if (message.op === "stop") {
            stopping = true;
            reply = { ok: true, running: [...running] };
            setImmediate(settle);
          } else reply = { ok: false, error: "unknown request" };
        } catch (error) {
          reply = { ok: false, error: error.message };
        }
        socket.end(JSON.stringify(reply) + "\n");
      })();
    });
    socket.on("error", () => void 0);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(endpoint, () => resolve());
  });
  await writeJson(recordFile(ctx.root), {
    pid: process.pid,
    endpoint,
    token,
    version: VERSION,
    root: ctx.root,
    startedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  touch();
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      stopping = true;
      settle();
    });
}
async function planCreated(ctx, id) {
  try {
    const request2 = await readJson(
      path.join(await contained(ctx.root, ".apexrest/jobs/" + id), "request.json")
    );
    const plan = await readJson(await contained(ctx.root, String(request2.input?.plan ?? "")));
    const at = Date.parse(String(plan.createdAt ?? ""));
    return Number.isFinite(at) ? at : void 0;
  } catch {
    return void 0;
  }
}
async function supersede(ctx, id, by) {
  const root = await contained(ctx.root, ".apexrest/jobs/" + id);
  if (!await claimJob(root, "broker-superseded")) return;
  const state = await readJson(path.join(root, "state.json"));
  await writeJson(path.join(root, "state.json"), {
    id,
    operation: state.operation ?? "ship.apply",
    status: "superseded",
    supersededBy: by,
    nextAction: `This apply never started. Job ${by}, planned from newer sources of the same environment, applies the changes.`,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function brokerRecord(root) {
  return readRecord(root);
}

export {
  brokerEndpoint,
  liveBroker,
  submitToBroker,
  startBroker,
  brokerStatus,
  stopBroker,
  runBroker,
  brokerRecord
};
