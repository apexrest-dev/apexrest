import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { ProjectContext } from './config.ts';
import { contained, exists, readJson, withLock, writeJson } from './fs.ts';
import { claimJob, executeJob, failQueuedJob, type JobExecutor } from './jobs.ts';
import { Fault } from './result.ts';
import { VERSION } from './version.ts';

/**
 * Development broker: one long-lived local process per project that runs the project's durable
 * jobs (the same `.apexrest/jobs/<id>` records a detached worker runs), so repeated jobs reuse a
 * warm process and its pooled read sessions instead of starting a new runtime each time.
 *
 * - It changes the execution lifetime only. Plans, grants, backups, drift checks, the deployment
 *   lease and unknown-outcome handling are the job's own, unchanged; database write sessions keep
 *   their per-operation isolation.
 * - It listens on a private OS-local endpoint (a Unix socket or named pipe) and accepts only
 *   requests carrying the random token in its 0600 record under `.apexrest/broker/`.
 * - A job is claimed exclusively before it runs, so a starter that cannot confirm the broker's
 *   acceptance may also start a detached worker without the job running twice.
 * - `ship.apply` jobs of one environment run one at a time. When several are waiting, only the
 *   newest runs: the older ones never started and are recorded `superseded`, since the newest plan
 *   was made from the same local sources and server checkpoint, plus later edits.
 * - It exits after an idle period; a stop waits for running jobs to finish.
 */

const IDLE_MS = () => Math.max(60_000, Number(process.env.APEXREST_BROKER_IDLE_MINUTES ?? 30) * 60_000);

interface BrokerRecord {
  pid: number;
  endpoint: string;
  token: string;
  version: string;
  root: string;
  startedAt: string;
}

const recordFile = (root: string) => path.join(root, '.apexrest', 'broker', 'broker.json');

export function brokerEndpoint(root: string): string {
  const id = createHash('sha256').update(root).digest('hex').slice(0, 20);
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\apexrest-${id}`
    : path.join(tmpdir(), `apexrest-${id}.sock`);
}

/** Sends one request and reads one JSON line; rejects on timeout or a closed connection. */
function request(
  record: BrokerRecord,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(record.endpoint);
    let buffer = '';
    const done = (error?: Error, value?: Record<string, unknown>) => {
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve(value!);
    };
    const timer = setTimeout(() => done(new Error('Broker did not answer in time.')), timeoutMs);
    socket.on('connect', () => socket.write(JSON.stringify({ ...body, token: record.token }) + '\n'));
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const end = buffer.indexOf('\n');
      if (end < 0) return;
      try {
        done(undefined, JSON.parse(buffer.slice(0, end)) as Record<string, unknown>);
      } catch (error) {
        done(error as Error);
      }
    });
    socket.on('error', (error) => done(error));
    socket.on('close', () => done(new Error('Broker closed the connection.')));
  });
}

async function readRecord(root: string): Promise<BrokerRecord | undefined> {
  try {
    const record = (await readJson(recordFile(root))) as BrokerRecord;
    return record && typeof record.token === 'string' && typeof record.endpoint === 'string'
      ? record
      : undefined;
  } catch {
    return undefined;
  }
}

/** The running broker of this project and runtime version, or undefined. */
export async function liveBroker(root: string, timeoutMs = 500) {
  const record = await readRecord(root);
  if (!record || record.version !== VERSION || record.root !== root) return undefined;
  try {
    const answer = await request(record, { op: 'ping' }, timeoutMs);
    return answer.ok ? { record, status: answer } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Hands a queued job to the running broker. True only when the broker confirmed it took the job;
 * false when there is no broker or the answer was not confirmed (the caller then starts a
 * detached worker; the exclusive claim keeps the job from running twice).
 */
export async function submitToBroker(root: string, jobId: string): Promise<boolean> {
  const live = await liveBroker(root);
  if (!live) return false;
  try {
    const answer = await request(live.record, { op: 'run', jobId }, 2000);
    return answer.accepted === true;
  } catch {
    return false;
  }
}

export async function startBroker(ctx: ProjectContext, runtime: string) {
  return withLock(path.join(ctx.root, '.apexrest', 'broker', 'start.lock'), async () => {
    const running = await liveBroker(ctx.root);
    if (running) return { status: 'running', reused: true, ...summary(running.record, running.status) };
    const child = spawn(process.execPath, [runtime, '--broker', ctx.root], {
      cwd: ctx.root,
      env: process.env,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    child.unref();
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const live = await liveBroker(ctx.root);
      if (live && live.record.pid === child.pid)
        return { status: 'running', reused: false, ...summary(live.record, live.status) };
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    try {
      process.kill(child.pid!, 'SIGTERM');
    } catch {
      /* already gone */
    }
    throw new Fault('BROKER_START_FAILED', 'The development broker did not start within 15 seconds.', 3);
  });
}

function summary(record: BrokerRecord, status: Record<string, unknown>) {
  return {
    pid: record.pid,
    version: record.version,
    startedAt: record.startedAt,
    running: status.running ?? [],
    waiting: status.waiting ?? [],
    idleMinutes: status.idleMinutes,
  };
}

export async function brokerStatus(ctx: ProjectContext) {
  const live = await liveBroker(ctx.root);
  return live ? { status: 'running', ...summary(live.record, live.status) } : { status: 'stopped' };
}

/** Asks the broker to stop accepting jobs and exit once its running jobs have finished. */
export async function stopBroker(ctx: ProjectContext, waitSeconds = 30) {
  const live = await liveBroker(ctx.root);
  if (!live) return { status: 'stopped', wasRunning: false };
  const answer = await request(live.record, { op: 'stop' }, 2000);
  const deadline = Date.now() + waitSeconds * 1000;
  while (Date.now() < deadline) {
    if (!(await liveBroker(ctx.root, 300))) return { status: 'stopped', wasRunning: true };
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return {
    status: 'stopping',
    running: answer.running ?? [],
    nextAction: 'Running jobs keep their heartbeats; check them with apexrest_job action:status.',
  };
}

/** The broker process (`apexrest --broker <root>`). */
export async function runBroker(ctx: ProjectContext, execute: JobExecutor): Promise<void> {
  const token = randomBytes(32).toString('hex');
  const endpoint = brokerEndpoint(ctx.root);
  const running = new Set<string>();
  /** ship.apply jobs waiting per environment, in arrival order. */
  const waiting = new Map<string, string[]>();
  const busy = new Set<string>();
  let stopping = false;
  let idle: NodeJS.Timeout | undefined;
  const expected = Buffer.from(token);

  if (process.platform !== 'win32') await rm(endpoint, { force: true });
  const finish = async () => {
    clearTimeout(idle);
    server.close();
    const record = await readRecord(ctx.root);
    if (record?.pid === process.pid) await rm(recordFile(ctx.root), { force: true });
    if (process.platform !== 'win32') await rm(endpoint, { force: true });
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

  const run = async (id: string) => {
    running.add(id);
    try {
      await executeJob(ctx, id, execute, 'broker');
    } catch (error) {
      // Lost the claim to a detached worker: that runner owns the job.
      if (!(error instanceof Fault && error.code === 'JOB_ALREADY_CLAIMED'))
        await failQueuedJob(ctx.root, id, error).catch(() => undefined);
    } finally {
      running.delete(id);
      touch();
      settle();
    }
  };
  const drain = async (env: string) => {
    if (busy.has(env)) return;
    busy.add(env);
    try {
      for (;;) {
        const queue = waiting.get(env) ?? [];
        if (!queue.length) break;
        // Coalesce: the newest waiting apply runs; an older one that never started is superseded
        // only when the newest plan was made no earlier than its own, so it covers its sources.
        // Otherwise the oldest runs first and the rest wait.
        const newest = queue.at(-1)!;
        const newestAt = await planCreated(ctx, newest);
        const covered = queue.slice(0, -1);
        const coverable =
          newestAt !== undefined &&
          (await Promise.all(covered.map((id) => planCreated(ctx, id)))).every(
            (at) => at !== undefined && at <= newestAt,
          );
        if (coverable) {
          queue.splice(0);
          for (const older of covered) await supersede(ctx, older, newest);
          await run(newest);
        } else await run(queue.shift()!);
      }
    } finally {
      busy.delete(env);
    }
  };

  const accept = async (jobId: string) => {
    const root = await contained(ctx.root, '.apexrest/jobs/' + jobId);
    const state = (await readJson(path.join(root, 'state.json'))) as { status?: string };
    if (state.status !== 'queued' || (await exists(path.join(root, 'claim.json')))) return false;
    const requested = (await readJson(path.join(root, 'request.json'))) as {
      operation: string;
      input: Record<string, unknown>;
    };
    if (requested.operation === 'ship.apply') {
      const env = String(requested.input.env ?? '');
      waiting.set(env, [...(waiting.get(env) ?? []), jobId]);
      // Let an immediately following apply arrive, so a burst coalesces.
      setTimeout(() => void drain(env), 50);
    } else void run(jobId);
    return true;
  };

  const server = net.createServer((socket) => {
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      if (buffer.length > 16_384) return socket.destroy();
      const end = buffer.indexOf('\n');
      if (end < 0) return;
      void (async () => {
        let reply: Record<string, unknown>;
        try {
          const message = JSON.parse(buffer.slice(0, end)) as {
            token?: unknown;
            op?: unknown;
            jobId?: unknown;
          };
          const given = Buffer.from(String(message.token ?? ''));
          if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
            reply = { ok: false, error: 'unauthorized' };
          } else if (message.op === 'ping') {
            reply = {
              ok: true,
              pid: process.pid,
              running: [...running],
              waiting: [...waiting.values()].flat(),
              idleMinutes: IDLE_MS() / 60_000,
            };
          } else if (
            message.op === 'run' &&
            typeof message.jobId === 'string' &&
            /^[0-9a-f-]{36}$/u.test(message.jobId)
          ) {
            touch();
            reply = stopping
              ? { ok: false, error: 'stopping' }
              : { ok: true, accepted: await accept(message.jobId) };
          } else if (message.op === 'stop') {
            stopping = true;
            reply = { ok: true, running: [...running] };
            setImmediate(settle);
          } else reply = { ok: false, error: 'unknown request' };
        } catch (error) {
          reply = { ok: false, error: (error as Error).message };
        }
        socket.end(JSON.stringify(reply) + '\n');
      })();
    });
    socket.on('error', () => undefined);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(endpoint, () => resolve());
  });
  await writeJson(recordFile(ctx.root), {
    pid: process.pid,
    endpoint,
    token,
    version: VERSION,
    root: ctx.root,
    startedAt: new Date().toISOString(),
  } satisfies BrokerRecord);
  touch();
  for (const signal of ['SIGTERM', 'SIGINT'] as const)
    process.on(signal, () => {
      stopping = true;
      settle();
    });
}

/** Creation time of the plan a queued ship.apply job applies (milliseconds), if readable. */
async function planCreated(ctx: ProjectContext, id: string): Promise<number | undefined> {
  try {
    const request = (await readJson(
      path.join(await contained(ctx.root, '.apexrest/jobs/' + id), 'request.json'),
    )) as { input?: { plan?: unknown } };
    const plan = (await readJson(await contained(ctx.root, String(request.input?.plan ?? '')))) as {
      createdAt?: string;
    };
    const at = Date.parse(String(plan.createdAt ?? ''));
    return Number.isFinite(at) ? at : undefined;
  } catch {
    return undefined;
  }
}

/** Records an apply that never started because a newer apply of the same environment replaced it. */
async function supersede(ctx: ProjectContext, id: string, by: string) {
  const root = await contained(ctx.root, '.apexrest/jobs/' + id);
  // The claim keeps a detached worker from starting it after it was superseded.
  if (!(await claimJob(root, 'broker-superseded'))) return;
  const state = (await readJson(path.join(root, 'state.json'))) as { operation?: string };
  await writeJson(path.join(root, 'state.json'), {
    id,
    operation: state.operation ?? 'ship.apply',
    status: 'superseded',
    supersededBy: by,
    nextAction: `This apply never started. Job ${by}, planned from newer sources of the same environment, applies the changes.`,
    updatedAt: new Date().toISOString(),
  });
}

/** For tests: the endpoint record of a project. */
export async function brokerRecord(root: string) {
  return readRecord(root);
}
