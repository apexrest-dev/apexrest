import { z } from 'zod';
import { parse } from '../../core/src/config.ts';
import type { JobService } from '../../core/src/jobs.ts';
import { failure, success, Fault, type Result } from '../../core/src/result.ts';

export const jobWaitSeconds = z
  .number()
  .int()
  .min(0)
  .max(30)
  .default(25)
  .describe('Wait for the result or return the existing jobId; default 25 seconds, 0 queues immediately.');
/** apexrest_ship waits longer: validate, plan, backup, import and verify usually finish within a minute. */
export const shipWaitSeconds = z
  .number()
  .int()
  .min(0)
  .max(120)
  .default(25)
  .describe('Wait for the result or return the existing jobId; default 25 seconds, 0 queues immediately.');

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

// Waiting belongs to the MCP request; execution belongs to the durable worker.
// Never replay or cancel that worker because observation ended or failed.
export async function runJobTool(
  jobs: Pick<JobService, 'start' | 'status'>,
  operation: string,
  input: Record<string, unknown>,
  runtime: string,
  signal?: AbortSignal,
  options: {
    waitSchema?: z.ZodType<number>;
    /** Replaces the detached worker: runs the job in this process. */
    inline?: (
      operation: string,
      input: Record<string, unknown>,
    ) => Promise<{ jobId: string; status: string; nextAction: string; [key: string]: unknown }>;
  } = {},
): Promise<Record<string, unknown>> {
  const { waitSeconds: requestedWait, ...domainInput } = input;
  const waitSeconds = parse(options.waitSchema ?? jobWaitSeconds, requestedWait);
  if (signal?.aborted)
    throw new Fault('CANCELLED', 'Request cancelled before starting a job.', 6, 'cancelled');
  const started = options.inline
    ? await options.inline(operation, domainInput)
    : await jobs.start(operation, domainInput, runtime);
  if (waitSeconds === 0) return started;
  try {
    const state = await jobs.status(started.jobId, waitSeconds, signal);
    const { nextAction, ...receipt } = started;
    return {
      ...receipt,
      ...state,
      jobId: started.jobId,
      ...(['queued', 'running'].includes(state.status) ? { nextAction } : {}),
    };
  } catch {
    // A lost observation is not a failed operation. Preserve its identity so
    // the caller can reconcile it without starting the operation again.
    return {
      ...started,
      status: 'outcome_unknown',
      nextAction:
        'Read apexrest_job action:status with this jobId; do not repeat the operation. No cancellation or rollback is confirmed.',
    };
  }
}
