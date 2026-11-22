import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  parse
} from "./chunk-LIG5PZ4K.mjs";
import {
  contained,
  exists,
  readJson,
  writeJson
} from "./chunk-26MTCOZK.mjs";
import {
  Fault,
  external_exports,
  failure,
  success
} from "./chunk-CI5IU2PI.mjs";

// packages/core/src/jobs.ts
import path from "node:path";
import { spawn } from "node:child_process";
import { open } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
var JOB_WAIT_MAX_SECONDS = 120;
var jobOperations = [
  "compose.plan",
  "compose.materialize",
  "apex.sync",
  "apex.generate",
  "apex.export",
  "apex.validate",
  "deploy.plan",
  "deploy.apply",
  "ship.apply",
  "ship",
  "peer"
];
var JobService = class {
  constructor(ctx) {
    this.ctx = ctx;
  }
  ctx;
  async enqueue(operation, input) {
    if (!jobOperations.includes(operation))
      throw new Fault("INVALID_JOB_OPERATION", "Operation cannot run as a background job.", 2);
    const id = randomUUID(), root = await contained(this.ctx.root, ".apexrest/jobs/" + id);
    await writeJson(path.join(root, "request.json"), {
      id,
      operation,
      input: { ...input, project: this.ctx.root }
    });
    await writeJson(path.join(root, "state.json"), {
      id,
      status: "queued",
      operation,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return id;
  }
  /**
   * Run a job inside this process: same request/state files and heartbeat as a
   * detached worker, so apexrest_job observes it identically, but the warm
   * SQLcl session pool and capability caches are reused. Use only for work
   * whose interruption leaves no database write unresolved.
   */
  async startInline(operation, input, execute) {
    const id = await this.enqueue(operation, input);
    const run = executeJob(this.ctx, id, execute, "in-process").catch(async (error) => {
      await failQueuedJob(this.ctx.root, id, error).catch(() => void 0);
    });
    inlineJobs.set(id, run);
    void run.finally(() => inlineJobs.delete(id));
    return {
      jobId: id,
      status: "queued",
      runner: "in-process",
      nextAction: "Wait for this job with apexrest_job action:status and the same jobId; never rerun the operation to fetch results."
    };
  }
  async start(operation, input, runtime) {
    const id = await this.enqueue(operation, input);
    const { submitToBroker } = await import("./chunk-DDB7LGMR.mjs");
    if (await submitToBroker(this.ctx.root, id).catch(() => false))
      return {
        jobId: id,
        status: "queued",
        runner: "broker",
        nextAction: "Wait for this job with apexrest_job action:status and the same jobId; never rerun the operation to fetch results. Cancellation does not imply database rollback."
      };
    try {
      const worker = spawn(process.execPath, [runtime, "--job-worker", this.ctx.root, id], {
        cwd: this.ctx.root,
        env: process.env,
        detached: true,
        stdio: "ignore",
        windowsHide: true
      });
      await new Promise((resolve, reject) => {
        worker.once("spawn", resolve);
        worker.once("error", reject);
      });
      worker.once("exit", (code, signal) => {
        void failQueuedJob(
          this.ctx.root,
          id,
          new Fault(
            "WORKER_EXITED",
            `The detached worker exited before starting the operation (code ${code ?? "null"}${signal ? ", signal " + signal : ""}).`,
            3
          )
        ).catch(() => void 0);
      });
      worker.unref();
    } catch (error) {
      await failQueuedJob(this.ctx.root, id, error).catch(() => void 0);
      throw error;
    }
    return {
      jobId: id,
      status: "queued",
      runner: "detached-worker",
      nextAction: "Wait for this job with apexrest_job action:status and the same jobId; never rerun the operation to fetch results. Cancellation does not imply database rollback."
    };
  }
  async status(id, waitSeconds = 0, signal) {
    parse(external_exports.uuid(), id);
    parse(external_exports.number().int().min(0).max(JOB_WAIT_MAX_SECONDS), waitSeconds);
    const root = await contained(this.ctx.root, ".apexrest/jobs/" + id);
    if (!await exists(path.join(root, "state.json")))
      throw new Fault("JOB_NOT_FOUND", `No job ${id} exists in this project.`, 2, "not_found");
    const deadline = Date.now() + waitSeconds * 1e3;
    for (; ; ) {
      const state = await readJson(path.join(root, "state.json"));
      if (!["queued", "running"].includes(state.status)) return state;
      if (Date.parse(state.updatedAt) + 6e4 < Date.now())
        return {
          ...state,
          status: "outcome_unknown",
          nextAction: "Worker heartbeat expired. Reconcile target before retrying."
        };
      const remaining = deadline - Date.now();
      if (remaining <= 0 || signal?.aborted) return state;
      await delay(Math.min(250, remaining), void 0, { signal }).catch((error) => {
        if (!signal?.aborted) throw error;
      });
    }
  }
  async cancel(id) {
    parse(external_exports.uuid(), id);
    const state = await this.status(id);
    const file = await contained(this.ctx.root, ".apexrest/jobs/" + id + "/state.json");
    const recorded = await readJson(file);
    if (!["queued", "running"].includes(recorded.status ?? "")) return state;
    await writeJson(await contained(this.ctx.root, ".apexrest/jobs/" + id + "/cancel.json"), {
      requestedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (state.status !== "queued" && state.status !== "running")
      return { ...state, jobId: id, cancellationRequested: true, rollbackConfirmed: false };
    return { jobId: id, status: "cancellation_requested", rollbackConfirmed: false };
  }
};
var inlineJobs = /* @__PURE__ */ new Map();
async function settleInlineJobs() {
  await Promise.allSettled([...inlineJobs.values()]);
}
async function failQueuedJob(projectRoot, id, error) {
  parse(external_exports.uuid(), id);
  const file = await contained(projectRoot, ".apexrest/jobs/" + id + "/state.json");
  if (!await exists(file)) return false;
  const state = await readJson(file);
  if (state.status !== "queued") return false;
  if (await exists(path.join(path.dirname(file), "claim.json"))) return false;
  const operation = typeof state.operation === "string" ? state.operation : "job";
  await writeJson(file, {
    id,
    operation,
    status: "failed",
    result: failure(operation, error),
    nextAction: "The worker did not start this operation. Resolve the diagnostic, then start a new job.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return true;
}
function jobOutcome(result) {
  const value = result;
  if (!value || typeof value !== "object" || value.ok !== false) return "completed";
  return typeof value.status === "string" && !["queued", "running", "completed", "succeeded"].includes(value.status) ? value.status : "failed";
}
var HEARTBEAT_FAILURE_LIMIT = 10;
async function claimJob(root, runner) {
  let handle;
  try {
    handle = await open(path.join(root, "claim.json"), "wx", 384);
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
  try {
    await handle.writeFile(JSON.stringify({ runner, pid: process.pid, at: (/* @__PURE__ */ new Date()).toISOString() }) + "\n");
    await handle.sync();
  } finally {
    await handle.close();
  }
  return true;
}
async function executeJob(ctx, id, execute, runner = "detached-worker") {
  parse(external_exports.uuid(), id);
  const root = await contained(ctx.root, ".apexrest/jobs/" + id);
  if (!await claimJob(root, runner))
    throw new Fault("JOB_ALREADY_CLAIMED", "Another runner already took this job.", 5, "conflict");
  const request = await readJson(path.join(root, "request.json"));
  const controller = new AbortController();
  let done = false;
  let phase;
  const pulse = async () => {
    if (done) return;
    if (await exists(path.join(root, "cancel.json"))) controller.abort();
    if (!done)
      await writeJson(path.join(root, "state.json"), {
        id,
        operation: request.operation,
        status: "running",
        ...phase ? { phase } : {},
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
  };
  await pulse();
  let pending = Promise.resolve();
  let heartbeatFailures = 0;
  const schedule = () => {
    pending = pending.then(pulse).then(() => {
      heartbeatFailures = 0;
    }).catch(() => {
      if (++heartbeatFailures >= HEARTBEAT_FAILURE_LIMIT) controller.abort();
    });
  };
  const timer = setInterval(schedule, 2e3), timeout = setTimeout(() => controller.abort(), 9e5);
  const progress = (next) => {
    phase = next;
    schedule();
  };
  try {
    let result;
    try {
      result = await execute(request.operation, request.input, controller.signal, progress);
    } catch (error) {
      result = failure(request.operation, error);
    }
    done = true;
    clearInterval(timer);
    clearTimeout(timeout);
    await pending;
    await writeJson(path.join(root, "state.json"), {
      id,
      operation: request.operation,
      status: jobOutcome(result),
      ...phase ? { phase } : {},
      result,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } finally {
    done = true;
    clearInterval(timer);
    clearTimeout(timeout);
  }
}
var completedResultSchema = external_exports.object({
  schemaVersion: external_exports.literal(1),
  ok: external_exports.boolean(),
  operation: external_exports.string(),
  status: external_exports.string(),
  runId: external_exports.string(),
  summary: external_exports.string(),
  diagnostics: external_exports.array(
    external_exports.object({
      severity: external_exports.enum(["error", "warning", "info"]),
      code: external_exports.string(),
      message: external_exports.string(),
      file: external_exports.string().optional(),
      line: external_exports.number().int().optional(),
      column: external_exports.number().int().optional(),
      type: external_exports.string().optional(),
      hint: external_exports.string().optional(),
      validValues: external_exports.array(external_exports.string()).optional()
    }).transform(({ severity, code, message, file, line, column, type, hint, validValues }) => ({
      severity,
      code,
      message,
      ...file !== void 0 ? { file } : {},
      ...line !== void 0 ? { line } : {},
      ...column !== void 0 ? { column } : {},
      ...type !== void 0 ? { type } : {},
      ...hint !== void 0 ? { hint } : {},
      ...validValues !== void 0 ? { validValues } : {}
    }))
  ),
  artifacts: external_exports.array(external_exports.string()),
  nextActions: external_exports.array(external_exports.string()),
  data: external_exports.unknown().optional(),
  exitCode: external_exports.union([
    external_exports.literal(0),
    external_exports.literal(1),
    external_exports.literal(2),
    external_exports.literal(3),
    external_exports.literal(4),
    external_exports.literal(5),
    external_exports.literal(6)
  ])
});
function jobToolResult(operation, job) {
  const active = job.status === "queued" || job.status === "running" ? job.status : void 0;
  if (!active && job.result !== void 0) {
    const nested = completedResultSchema.safeParse(job.result);
    if (nested.success && nested.data.operation === operation) return { ...nested.data, data: job };
  }
  const nextActions = typeof job.nextAction === "string" ? [job.nextAction] : ["Read apexrest_job action:status with this jobId; inspect the existing operation before any retry."];
  if (job.status === "completed") {
    const result2 = failure(
      operation,
      new Fault(
        "JOB_RESULT_UNREADABLE",
        "The job completed but its recorded result cannot be read for this operation. Inspect its existing record; do not repeat the operation.",
        1,
        "completed_unreadable"
      )
    );
    return { ...result2, nextActions, data: job };
  }
  if (active)
    return {
      ...success(operation, job, `Job ${job.status}; use the existing jobId to retrieve its result.`),
      status: active,
      nextActions
    };
  if (job.status === "superseded")
    return {
      ...success(
        operation,
        job,
        `Job superseded by ${String(job.supersededBy)}; it never started. Read that job for the deployment result.`
      ),
      status: "superseded",
      nextActions
    };
  const status = job.status === "failed" || job.status === "cancelled" ? job.status : "outcome_unknown";
  const result = failure(
    operation,
    new Fault(
      status === "failed" ? "JOB_FAILED" : status === "cancelled" ? "CANCELLED" : "JOB_OUTCOME_UNKNOWN",
      status === "outcome_unknown" ? "The job outcome is unknown. Inspect its existing record; do not repeat the operation." : `Job ${status}. Inspect the existing operation record.`,
      status === "failed" ? 1 : 6,
      status
    )
  );
  return { ...result, nextActions, data: job };
}

export {
  JOB_WAIT_MAX_SECONDS,
  JobService,
  settleInlineJobs,
  failQueuedJob,
  claimJob,
  executeJob,
  jobToolResult
};
