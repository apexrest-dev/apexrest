import { z } from 'zod';
import { parse } from '../../core/src/config.ts';
import type { JobService } from '../../core/src/jobs.ts';
import { failure, success, Fault, type Result } from '../../core/src/result.ts';
import { jobToolResult } from '../../core/src/jobs.ts';
export { jobToolResult } from '../../core/src/jobs.ts';

/** A reviewed saved plan is checked by ship.apply before its grant or any write. */
export async function prepareShipApplyPlan(
  input: Record<string, unknown>,
  plan: (input: Record<string, unknown>) => Promise<Result>,
): Promise<Result> {
  if (typeof input.plan === 'string')
    return success('ship', {
      planPath: input.plan,
      source: 'reviewed-saved-plan',
      validation: 'apply-worker-before-grant-and-write',
    });
  const { waitSeconds: _wait, ...domainInput } = input;
  return plan({ ...domainInput, mode: 'plan' });
}

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
