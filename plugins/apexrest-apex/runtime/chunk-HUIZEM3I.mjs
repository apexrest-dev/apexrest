import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  shipApply,
  shipPlan
} from "./chunk-RH3YH4Q4.mjs";
import {
  sourceInventory
} from "./chunk-NR54WUYW.mjs";
import {
  sourceRevision
} from "./chunk-PCV5YPHF.mjs";
import "./chunk-KNRJIVWR.mjs";
import "./chunk-MPDF637Z.mjs";
import "./chunk-OA3W7BIM.mjs";
import {
  LocalDeploymentControl,
  importOptions,
  sourceRelease
} from "./chunk-OKEQDTRJ.mjs";
import "./chunk-4GRGGAQV.mjs";
import "./chunk-73QQA3SD.mjs";
import {
  environment,
  refuseProductionDeployment,
  targetDigest
} from "./chunk-FMCSJH7I.mjs";
import "./chunk-CJQOFEXF.mjs";
import "./chunk-5OZJQ7M6.mjs";
import "./chunk-4S6ZNCT6.mjs";
import {
  atomicWrite,
  canonical,
  contained,
  exists,
  hash,
  readJson
} from "./chunk-RW7D7AJD.mjs";
import {
  Fault
} from "./chunk-OWILYJ3V.mjs";
import "./chunk-NNKK245H.mjs";

// packages/core/src/ship-intent.ts
import path from "node:path";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
async function toolchainIdentity() {
  const { sqlclConfig } = await import("./chunk-V47Z5Q6S.mjs");
  const { VERSION } = await import("./chunk-22EQ4FMU.mjs");
  return hash(
    canonical({
      sqlcl: await sqlclConfig(),
      executable: process.env.APEXREST_SQLCL ?? null,
      runtime: VERSION
    })
  );
}
var intentPath = (ctx, id) => contained(ctx.root, `.apexrest/intents/${id}.json`);
var statePath = (ctx, id) => contained(ctx.root, `.apexrest/intents/${id}.state.json`);
async function checkShipRequest(ctx, name, options) {
  const configured = Object.hasOwn(ctx.config.environments, name) ? ctx.config.environments[name] : void 0;
  if (configured) await refuseProductionDeployment(configured, name);
  const requested = importOptions(options);
  if (requested.importMode === "files") {
    const release = await sourceRelease(await contained(ctx.root, ctx.config.application.sourceDir));
    if (release !== "26.2")
      throw new Fault(
        "PARTIAL_IMPORT_UNSUPPORTED",
        "File import requires an Oracle-exported 26.2 source tree.",
        3
      );
  }
  return { env: environment(ctx, name), requested };
}
async function captureShipIntent(ctx, input) {
  const { env, requested } = await checkShipRequest(ctx, input.env, {
    importMode: input.importMode ?? "auto",
    ...input.files ? { files: input.files } : {}
  });
  const inventory = await sourceInventory(ctx);
  const { revision, configuration } = sourceRevision(inventory, ctx.config);
  const previous = await latestIntent(ctx, input.env);
  const changedFiles = previous ? [.../* @__PURE__ */ new Set([...Object.keys(previous.inventory), ...Object.keys(inventory)])].filter((file) => previous.inventory[file] !== inventory[file]).sort() : void 0;
  const body = {
    schemaVersion: 1,
    id: randomUUID(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    env: input.env,
    targetDigest: targetDigest(env),
    revision,
    configuration,
    inventory,
    importMode: requested.importMode,
    ...input.files ? { files: [...input.files] } : {},
    ...changedFiles ? { changedFiles } : {},
    toolchain: await toolchainIdentity(),
    ...input.client ? { client: input.client } : {},
    userRequest: input.userRequest
  };
  const intent = { ...body, digest: hash(canonical(body)) };
  await atomicWrite(await intentPath(ctx, intent.id), JSON.stringify(intent) + "\n");
  await setIntentStatus(ctx, intent.id, "queued");
  return intent;
}
async function latestIntent(ctx, env) {
  const dir = await contained(ctx.root, ".apexrest/intents");
  if (!await exists(dir)) return void 0;
  let latest;
  for (const name of await readdir(dir)) {
    if (!name.endsWith(".json") || name.endsWith(".state.json")) continue;
    const intent = await readShipIntent(ctx, name.slice(0, -5)).catch(() => void 0);
    if (intent?.env === env && (!latest || intent.createdAt > latest.createdAt)) latest = intent;
  }
  return latest;
}
async function readShipIntent(ctx, id) {
  const file = await intentPath(ctx, id);
  if (!await exists(file)) throw new Fault("SHIP_INTENT_NOT_FOUND", `Ship intent ${id} does not exist.`, 2);
  const intent = JSON.parse(await readFile(file, "utf8"));
  const { digest, ...body } = intent;
  if (intent.schemaVersion !== 1 || intent.id !== id || hash(canonical(body)) !== digest)
    throw new Fault("SHIP_INTENT_INVALID", `Ship intent ${id} was changed after it was captured.`, 5);
  return intent;
}
async function setIntentStatus(ctx, id, status, detail) {
  await atomicWrite(
    await statePath(ctx, id),
    JSON.stringify({ id, status, ...detail ? { detail } : {}, at: (/* @__PURE__ */ new Date()).toISOString() }) + "\n"
  );
}
async function shipIntentStatus(ctx, id) {
  const file = await statePath(ctx, id);
  return await exists(file) ? await readJson(file) : void 0;
}
var superseded = (intent, detail) => new Fault(
  "SHIP_INTENT_SUPERSEDED",
  `Ship intent ${intent.id} was not applied: ${detail} Ship again to deploy the current sources.`,
  5,
  "superseded",
  { intentId: intent.id, revision: intent.revision }
);
async function runShipIntent(ctx, id, deployment, parseDiagnostics, signal, progress) {
  if (sharedShipReads()) {
    const { withConnectedReads, currentReadScope } = await import("./chunk-IBJH7V3K.mjs");
    return withConnectedReads(async () => {
      const result = await prepareAndApply(ctx, id, deployment, parseDiagnostics, signal, progress);
      return {
        ...result,
        intent: { ...result.intent, readScope: currentReadScope() ? "shared" : "per-phase" }
      };
    });
  }
  return prepareAndApply(ctx, id, deployment, parseDiagnostics, signal, progress);
}
var sharedShipReads = () => /^(?:1|true|on)$/i.test(process.env.APEXREST_SHIP_SHARED_READS ?? "");
async function prepareAndApply(ctx, id, deployment, parseDiagnostics, signal, progress) {
  const intent = await readShipIntent(ctx, id);
  const env = environment(ctx, intent.env);
  try {
    if (targetDigest(env) !== intent.targetDigest)
      throw superseded(intent, "the configured target changed after it was queued.");
    if (intent.toolchain && intent.toolchain !== await toolchainIdentity())
      throw superseded(intent, "the SQLcl toolchain or runtime changed after it was queued.");
    const current = await sourceInventory(ctx);
    const { revision, configuration } = sourceRevision(current, ctx.config);
    if (revision !== intent.revision || configuration !== intent.configuration)
      throw superseded(intent, "the project sources changed after it was queued (a newer revision).");
    const predecessor = await awaitConfirmedPredecessor(ctx, intent, signal);
    await setIntentStatus(ctx, id, "preparing");
    const planned = await shipPlan(ctx, intent.env, deployment, parseDiagnostics, progress, {
      importMode: intent.importMode,
      ...intent.files ? { files: intent.files } : {}
    });
    for (const [file, sha] of Object.entries(planned.plan.sources))
      if (intent.inventory[file] !== sha)
        throw superseded(intent, `${file} changed while it was being prepared.`);
    await setIntentStatus(ctx, id, "planned");
    progress?.("planned");
    if (signal?.aborted) throw new Fault("CANCELLED", "Ship intent cancelled before apply.", 6, "cancelled");
    await setIntentStatus(ctx, id, "applying");
    const applied = await shipApply(ctx, planned.plan, intent.userRequest, deployment, signal, progress);
    await setIntentStatus(ctx, id, "succeeded");
    return {
      mode: "apply",
      ...applied,
      planPath: planned.planPath,
      phases: [...planned.phases, ...applied.phases],
      intent: { id, revision: intent.revision, status: "succeeded", predecessor },
      plan: { planPath: planned.planPath, ...planned.preview }
    };
  } catch (error) {
    const status = error instanceof Fault && error.code === "SHIP_INTENT_SUPERSEDED" ? "superseded" : error instanceof Fault && error.status === "outcome_unknown" ? "outcome_unknown" : "failed";
    await setIntentStatus(ctx, id, status, error instanceof Fault ? error.code : void 0).catch(
      () => void 0
    );
    throw error;
  }
}
var IN_FLIGHT_MS = 9e5;
async function awaitConfirmedPredecessor(ctx, intent, signal) {
  const started = Date.now();
  const control = new LocalDeploymentControl(environment(ctx, intent.env));
  for (; ; ) {
    if (signal?.aborted) throw new Fault("CANCELLED", "Ship intent cancelled while waiting.", 6, "cancelled");
    const owner = await control.owner();
    let alive = false;
    if (owner && owner.hostname === hostname())
      try {
        process.kill(owner.pid, 0);
        alive = true;
      } catch (error) {
        alive = error.code !== "ESRCH";
      }
    else if (owner) alive = true;
    if (owner?.phase === "writing" && !alive)
      throw new Fault(
        "PREDECESSOR_OUTCOME_UNKNOWN",
        `Deployment run ${owner.runId} stopped while writing; its outcome must be reconciled before another ship of ${intent.env} is prepared. Run apexrest_ship mode:recover for that run.`,
        5,
        "blocked",
        { deploymentRunId: owner.runId, intentId: intent.id }
      );
    let waitingFor = owner && alive ? `deployment run ${owner.runId}` : void 0;
    if (!waitingFor)
      for (const earlier of await earlierIntents(ctx, intent)) {
        const state = await shipIntentStatus(ctx, earlier.id);
        if (state?.status === "outcome_unknown")
          throw new Fault(
            "PREDECESSOR_OUTCOME_UNKNOWN",
            `Ship intent ${earlier.id} ended with an unknown outcome; reconcile it (apexrest_ship mode:recover) before another ship of ${intent.env} is prepared.`,
            5,
            "blocked",
            { intentId: intent.id, predecessorIntentId: earlier.id }
          );
        if (state && ["preparing", "planned", "applying"].includes(state.status) && Date.now() - Date.parse(state.at) < IN_FLIGHT_MS) {
          waitingFor = `ship intent ${earlier.id}`;
          break;
        }
      }
    if (!waitingFor) return { waitedMs: Date.now() - started };
    if (Date.now() - started > IN_FLIGHT_MS)
      throw new Fault("PREDECESSOR_TIMEOUT", `Still waiting for ${waitingFor} to finish.`, 6, "blocked");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
async function earlierIntents(ctx, intent) {
  const dir = await contained(ctx.root, ".apexrest/intents");
  const found = [];
  for (const name of await readdir(dir)) {
    if (!name.endsWith(".json") || name.endsWith(".state.json")) continue;
    const other = await readShipIntent(ctx, name.slice(0, -5)).catch(() => void 0);
    if (other && other.id !== intent.id && other.env === intent.env && other.createdAt <= intent.createdAt)
      found.push(other);
  }
  return found;
}
async function markIntentSuperseded(ctx, id, by) {
  await readShipIntent(ctx, id);
  await setIntentStatus(ctx, id, "superseded", `job ${by}`);
}
async function intentCreated(ctx, id) {
  try {
    const at = Date.parse((await readShipIntent(ctx, id)).createdAt);
    return Number.isFinite(at) ? at : void 0;
  } catch {
    return void 0;
  }
}
var intentFile = (id) => path.posix.join(".apexrest/intents", `${id}.json`);
async function shipThroughBroker(raw, execute) {
  const { schemas } = await import("./chunk-K6R3QPQF.mjs");
  const { parse } = await import("./chunk-Y3KEXPBW.mjs");
  const input = parse(schemas.ship, raw);
  if (input.mode !== "apply" || typeof input.plan === "string" || input.confirmation !== void 0)
    return void 0;
  const { loadProject } = await import("./chunk-Y3KEXPBW.mjs");
  const ctx = await loadProject(typeof input.project === "string" ? input.project : process.cwd());
  const { liveBroker } = await import("./chunk-O4Q2TYTH.mjs");
  if (!await liveBroker(ctx.root)) return void 0;
  const intent = await captureShipIntent(ctx, {
    env: String(input.env),
    userRequest: String(input.userRequest),
    ...input.importMode ? { importMode: input.importMode } : {},
    ...Array.isArray(input.files) ? { files: input.files } : {},
    client: "cli"
  });
  const { JobService } = await import("./chunk-LS6XEKHS.mjs");
  const jobs = new JobService(ctx);
  const { jobId, runner } = await jobs.submit(
    "ship.intent",
    { project: ctx.root, env: input.env, intent: intent.id },
    execute
  );
  let state = await jobs.status(jobId, 30);
  while (state.status === "queued" || state.status === "running") state = await jobs.status(jobId, 30);
  const provenance = runner === "broker" ? "resident-cli" : "cold-cli";
  const nested = state.result;
  const { jobToolResult } = await import("./chunk-LS6XEKHS.mjs");
  const result = nested && typeof nested === "object" && "ok" in nested ? nested : jobToolResult("ship.intent", state);
  return {
    ...result,
    operation: "ship",
    data: {
      ...result.data ?? {},
      mode: "apply",
      provenance,
      jobId,
      intent: { id: intent.id, revision: intent.revision, capturedAt: intent.createdAt },
      ...state.status === "superseded" ? { superseded: state } : {}
    }
  };
}
export {
  captureShipIntent,
  checkShipRequest,
  intentCreated,
  intentFile,
  markIntentSuperseded,
  readShipIntent,
  runShipIntent,
  sharedShipReads,
  shipIntentStatus,
  shipThroughBroker,
  toolchainIdentity
};
