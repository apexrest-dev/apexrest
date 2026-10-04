import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { contained, exists, readJson, writeJson } from './fs.ts';
import { parse, requireTrust } from './config.ts';
import type { ProjectContext } from './config.ts';
import { Fault, failure } from './result.ts';
export class JobService {
  constructor(private ctx: ProjectContext) {}
  async start(operation: string, input: Record<string, unknown>, runtime: string) {
    await requireTrust(this.ctx.root);
    if (
      ![
        'compose.plan',
        'compose.materialize',
        'apex.sync',
        'apex.generate',
        'apex.export',
        'apex.validate',
        'deploy.plan',
        'deploy.apply',
        'test.run',
      ].includes(operation)
    )
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
      nextAction:
        'Wait for this job with apexrest_job_status and waitSeconds:25; never rerun the operation to fetch results. Cancellation does not imply database rollback.',
    };
  }
  async status(id: string, waitSeconds = 0, signal?: AbortSignal) {
    parse(z.uuid(), id);
    parse(z.number().int().min(0).max(30), waitSeconds);
    const root = await contained(this.ctx.root, '.apexrest/jobs/' + id);
    const deadline = Date.now() + waitSeconds * 1000;
    for (;;) {
      const state = (await readJson(path.join(root, 'state.json'))) as {
        status: string;
        updatedAt: string;
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
    await requireTrust(this.ctx.root);
    parse(z.uuid(), id);
    const state = await this.status(id);
    if (!['queued', 'running'].includes(state.status)) return state;
    await writeJson(await contained(this.ctx.root, '.apexrest/jobs/' + id + '/cancel.json'), {
      requestedAt: new Date().toISOString(),
    });
    return { jobId: id, status: 'cancellation_requested', rollbackConfirmed: false };
  }
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
export async function executeJob(
  ctx: ProjectContext,
  id: string,
  execute: (op: string, input: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>,
) {
  await requireTrust(ctx.root);
  parse(z.uuid(), id);
  const root = await contained(ctx.root, '.apexrest/jobs/' + id);
  const request = (await readJson(path.join(root, 'request.json'))) as {
    operation: string;
    input: Record<string, unknown>;
  };
  const controller = new AbortController();
  let done = false;
  const pulse = async () => {
    if (done) return;
    if (await exists(path.join(root, 'cancel.json'))) controller.abort();
    if (!done)
      await writeJson(path.join(root, 'state.json'), {
        id,
        operation: request.operation,
        status: 'running',
        updatedAt: new Date().toISOString(),
      });
  };
  await pulse();
  let pending = Promise.resolve();
  const timer = setInterval(() => {
      pending = pending.then(pulse).catch(() => {
        controller.abort();
      });
    }, 2000),
    timeout = setTimeout(() => controller.abort(), 900000);
  try {
    const result = await execute(request.operation, request.input, controller.signal);
    done = true;
    clearInterval(timer);
    clearTimeout(timeout);
    await pending;
    await writeJson(path.join(root, 'state.json'), {
      id,
      operation: request.operation,
      status: jobOutcome(result),
      result,
      updatedAt: new Date().toISOString(),
    });
  } finally {
    done = true;
    clearInterval(timer);
    clearTimeout(timeout);
  }
}
