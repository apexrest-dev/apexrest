import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { contained, exists, readJson, writeJson } from './fs.ts';
import { parse } from './config.ts';
import type { ProjectContext } from './config.ts';
import { Fault, failure, success, type Result } from './result.ts';
/** Status waits are bounded; apexrest_ship may wait longer than ordinary jobs. */
export const JOB_WAIT_MAX_SECONDS = 120;
/** Work the worker reports while a job runs; informative only, never an outcome. */
export type JobPhase =
  'validating' | 'planning' | 'backing_up' | 'migrating' | 'importing' | 'verifying' | 'syncing';
export type JobExecutor = (
  op: string,
  input: Record<string, unknown>,
  signal: AbortSignal,
  progress: (phase: JobPhase) => void,
) => Promise<unknown>;
export const jobOperations = [
  'compose.plan',
  'compose.materialize',
  'apex.sync',
  'apex.generate',
  'apex.export',
  'apex.validate',
  'deploy.plan',
  'deploy.apply',
  'ship.apply',
  'ship',
  'peer',
];
export class JobService {
  constructor(private ctx: ProjectContext) {}
  private async enqueue(operation: string, input: Record<string, unknown>) {
    if (!jobOperations.includes(operation))
      throw new Fault('INVALID_JOB_OPERATION', 'Operation cannot run as a background job.', 2);
    const id = randomUUID(),
      root = await contained(this.ctx.root, '.apexrest/jobs/' + id);
    await writeJson(path.join(root, 'request.json'), {
      id,
      operation,
      input: { ...input, project: this.ctx.root },
    });
    await writeJson(path.join(root, 'state.json'), {
      id,
      status: 'queued',
      operation,
      updatedAt: new Date().toISOString(),
    });
    return id;
  }
  /**
   * Run a job inside this process: same request/state files and heartbeat as a
   * detached worker, so apexrest_job observes it identically, but the warm
   * SQLcl session pool and capability caches are reused. Use only for work
   * whose interruption leaves no database write unresolved.
   */
  async startInline(operation: string, input: Record<string, unknown>, execute: JobExecutor) {
    const id = await this.enqueue(operation, input);
    const run = executeJob(this.ctx, id, execute).catch(async (error: unknown) => {
      await failQueuedJob(this.ctx.root, id, error).catch(() => undefined);
    });
    inlineJobs.set(id, run);
    void run.finally(() => inlineJobs.delete(id));
    return {
      jobId: id,
      status: 'queued',
      runner: 'in-process' as const,
      nextAction:
        'Wait for this job with apexrest_job action:status and the same jobId; never rerun the operation to fetch results.',
    };
  }
  async start(operation: string, input: Record<string, unknown>, runtime: string) {
    const id = await this.enqueue(operation, input);
    try {
      const worker = spawn(process.execPath, [runtime, '--job-worker', this.ctx.root, id], {
        cwd: this.ctx.root,
        env: process.env,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      await new Promise<void>((resolve, reject) => {
        worker.once('spawn', resolve);
        worker.once('error', reject);
      });
      // A worker that dies before its first heartbeat (bad runtime path, module
      // load error, unsupported Node) never ran the operation: record a known
      // failure instead of letting the heartbeat expiry report an unknown outcome.
      worker.once('exit', (code, signal) => {
        void failQueuedJob(
          this.ctx.root,
          id,
          new Fault(
            'WORKER_EXITED',
            `The detached worker exited before starting the operation (code ${code ?? 'null'}${signal ? ', signal ' + signal : ''}).`,
            3,
          ),
        ).catch(() => undefined);
      });
      worker.unref();
    } catch (error) {
      // No worker exists, so the operation never ran: record a known failure
      // instead of leaving a queued job that later looks like an unknown outcome.
      await failQueuedJob(this.ctx.root, id, error).catch(() => undefined);
      throw error;
    }
    return {
      jobId: id,
      status: 'queued',
      runner: 'detached-worker' as const,
      nextAction:
        'Wait for this job with apexrest_job action:status and the same jobId; never rerun the operation to fetch results. Cancellation does not imply database rollback.',
    };
  }
  async status(id: string, waitSeconds = 0, signal?: AbortSignal) {
    parse(z.uuid(), id);
    parse(z.number().int().min(0).max(JOB_WAIT_MAX_SECONDS), waitSeconds);
    const root = await contained(this.ctx.root, '.apexrest/jobs/' + id);
    if (!(await exists(path.join(root, 'state.json'))))
      throw new Fault('JOB_NOT_FOUND', `No job ${id} exists in this project.`, 2, 'not_found');
    const deadline = Date.now() + waitSeconds * 1000;
    for (;;) {
      const state = (await readJson(path.join(root, 'state.json'))) as {
        status: string;
        updatedAt: string;
        phase?: JobPhase;
      };
      if (!['queued', 'running'].includes(state.status)) return state;
      if (Date.parse(state.updatedAt) + 60000 < Date.now())
        return {
          ...state,
          status: 'outcome_unknown',
          nextAction: 'Worker heartbeat expired. Reconcile target before retrying.',
        };
      const remaining = deadline - Date.now();
      if (remaining <= 0 || signal?.aborted) return state;
      await delay(Math.min(250, remaining), undefined, { signal }).catch((error: unknown) => {
        if (!signal?.aborted) throw error;
      });
    }
  }
  async cancel(id: string) {
    parse(z.uuid(), id);
    const state = await this.status(id);
    // A stalled heartbeat reports outcome_unknown, but the worker may still be
    // alive; leave the cancel request for it whenever the durable record is not terminal.
    const file = await contained(this.ctx.root, '.apexrest/jobs/' + id + '/state.json');
    const recorded = (await readJson(file)) as { status?: string };
    if (!['queued', 'running'].includes(recorded.status ?? '')) return state;
    await writeJson(await contained(this.ctx.root, '.apexrest/jobs/' + id + '/cancel.json'), {
      requestedAt: new Date().toISOString(),
    });
    if (state.status !== 'queued' && state.status !== 'running')
      return { ...state, jobId: id, cancellationRequested: true, rollbackConfirmed: false };
    return { jobId: id, status: 'cancellation_requested', rollbackConfirmed: false };
  }
}
// In-process jobs still running in this process; awaited on shutdown so a
// local-only job is not abandoned mid-write when the MCP transport closes.
const inlineJobs = new Map<string, Promise<void>>();
export function inlineJobCount() {
  return inlineJobs.size;
}
export async function settleInlineJobs() {
  await Promise.allSettled([...inlineJobs.values()]);
}
// Mark a job that never started execution as failed. Only a still-queued job
// changes: once a worker reports running, its operation may have touched the
// target and the heartbeat must decide the outcome instead.
export async function failQueuedJob(projectRoot: string, id: string, error: unknown) {
  parse(z.uuid(), id);
  const file = await contained(projectRoot, '.apexrest/jobs/' + id + '/state.json');
  if (!(await exists(file))) return false;
  const state = (await readJson(file)) as { status?: string; operation?: string };
  if (state.status !== 'queued') return false;
  const operation = typeof state.operation === 'string' ? state.operation : 'job';
  await writeJson(file, {
    id,
    operation,
    status: 'failed',
    result: failure(operation, error),
    nextAction: 'The worker did not start this operation. Resolve the diagnostic, then start a new job.',
    updatedAt: new Date().toISOString(),
  });
  return true;
}
// A completed worker records the operation outcome, not merely process exit.
export function jobOutcome(result: unknown) {
  const value = result as { ok?: unknown; status?: unknown } | null;
  if (!value || typeof value !== 'object' || value.ok !== false) return 'completed';
  return typeof value.status === 'string' &&
    !['queued', 'running', 'completed', 'succeeded'].includes(value.status)
    ? value.status
    : 'failed';
}
/** Consecutive heartbeat failures tolerated before the job aborts (2 s apart, well inside the 60 s expiry). */
export const HEARTBEAT_FAILURE_LIMIT = 10;
export async function executeJob(ctx: ProjectContext, id: string, execute: JobExecutor) {
  parse(z.uuid(), id);
  const root = await contained(ctx.root, '.apexrest/jobs/' + id);
  const request = (await readJson(path.join(root, 'request.json'))) as {
    operation: string;
    input: Record<string, unknown>;
  };
  const controller = new AbortController();
  let done = false;
  let phase: JobPhase | undefined;
  const pulse = async () => {
    if (done) return;
    if (await exists(path.join(root, 'cancel.json'))) controller.abort();
    if (!done)
      await writeJson(path.join(root, 'state.json'), {
        id,
        operation: request.operation,
        status: 'running',
        ...(phase ? { phase } : {}),
        updatedAt: new Date().toISOString(),
      });
  };
  await pulse();
  let pending = Promise.resolve();
  // A single transient heartbeat write failure (EPERM on a Windows rename race,
  // a brief ENOSPC) must not cancel a live database write. Only a sustained
  // failure, which would let the heartbeat expire anyway, aborts the operation.
  let heartbeatFailures = 0;
  const schedule = () => {
    pending = pending
      .then(pulse)
      .then(() => {
        heartbeatFailures = 0;
      })
      .catch(() => {
        if (++heartbeatFailures >= HEARTBEAT_FAILURE_LIMIT) controller.abort();
      });
  };
  const timer = setInterval(schedule, 2000),
    timeout = setTimeout(() => controller.abort(), 900000);
  // A phase change is written immediately so status reads stay informative
  // between heartbeats; the phase never replaces the recorded outcome.
  const progress = (next: JobPhase) => {
    phase = next;
    schedule();
  };
  try {
    let result: unknown;
    try {
      result = await execute(request.operation, request.input, controller.signal, progress);
    } catch (error) {
      // dispatch never throws; an executor exception is an infrastructure
      // failure and is recorded as the job outcome instead of a lost heartbeat.
      result = failure(request.operation, error);
    }
    done = true;
    clearInterval(timer);
    clearTimeout(timeout);
    await pending;
    await writeJson(path.join(root, 'state.json'), {
      id,
      operation: request.operation,
      status: jobOutcome(result),
      ...(phase ? { phase } : {}),
      result,
      updatedAt: new Date().toISOString(),
    });
  } finally {
    done = true;
    clearInterval(timer);
    clearTimeout(timeout);
  }
}
const completedResultSchema: z.ZodType<Result> = z.object({
  schemaVersion: z.literal(1),
  ok: z.boolean(),
  operation: z.string(),
  status: z.string(),
  runId: z.string(),
  summary: z.string(),
  diagnostics: z.array(
    z
      .object({
        severity: z.enum(['error', 'warning', 'info']),
        code: z.string(),
        message: z.string(),
        file: z.string().optional(),
        line: z.number().int().optional(),
        column: z.number().int().optional(),
        type: z.string().optional(),
        hint: z.string().optional(),
        validValues: z.array(z.string()).optional(),
      })
      .transform(({ severity, code, message, file, line, column, type, hint, validValues }) => ({
        severity,
        code,
        message,
        ...(file !== undefined ? { file } : {}),
        ...(line !== undefined ? { line } : {}),
        ...(column !== undefined ? { column } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(hint !== undefined ? { hint } : {}),
        ...(validValues !== undefined ? { validValues } : {}),
      })),
  ),
  artifacts: z.array(z.string()),
  nextActions: z.array(z.string()),
  data: z.unknown().optional(),
  exitCode: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
});

/**
 * Map a durable job record to a result envelope: active jobs read as success with
 * their state, terminal jobs carry the recorded operation outcome so a failed
 * import is never wrapped in ok:true.
 */
export function jobToolResult(operation: string, job: Record<string, unknown>): Result {
  const active = job.status === 'queued' || job.status === 'running' ? job.status : undefined;
  // Workers record the operation outcome on terminal jobs (completed, failed,
  // outcome_unknown, ...). Prefer that exact nested result whenever it is valid.
  if (!active && job.result !== undefined) {
    const nested = completedResultSchema.safeParse(job.result);
    if (nested.success && nested.data.operation === operation) return { ...nested.data, data: job };
  }
  const nextActions =
    typeof job.nextAction === 'string'
      ? [job.nextAction]
      : ['Read apexrest_job action:status with this jobId; inspect the existing operation before any retry.'];
  if (job.status === 'completed') {
    // The worker finished, so the outcome is not a lost heartbeat; its recorded
    // result is missing, malformed or belongs to another operation.
    const result = failure(
      operation,
      new Fault(
        'JOB_RESULT_UNREADABLE',
        'The job completed but its recorded result cannot be read for this operation. Inspect its existing record; do not repeat the operation.',
        1,
        'completed_unreadable',
      ),
    );
    return { ...result, nextActions, data: job };
  }
  if (active)
    return {
      ...success(operation, job, `Job ${job.status}; use the existing jobId to retrieve its result.`),
      status: active,
      nextActions,
    };
  const status = job.status === 'failed' || job.status === 'cancelled' ? job.status : 'outcome_unknown';
  const result = failure(
    operation,
    new Fault(
      status === 'failed' ? 'JOB_FAILED' : status === 'cancelled' ? 'CANCELLED' : 'JOB_OUTCOME_UNKNOWN',
      status === 'outcome_unknown'
        ? 'The job outcome is unknown. Inspect its existing record; do not repeat the operation.'
        : `Job ${status}. Inspect the existing operation record.`,
      status === 'failed' ? 1 : 6,
      status,
    ),
  );
  return { ...result, nextActions, data: job };
}
