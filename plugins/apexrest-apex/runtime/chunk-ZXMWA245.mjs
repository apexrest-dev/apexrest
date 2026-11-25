import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  shipApply,
  shipPlan
} from "./chunk-SNXCRPR5.mjs";
import {
  sourceInventory,
  sourceRevision
} from "./chunk-K3MFNBA3.mjs";
import "./chunk-DOWWSLS6.mjs";
import "./chunk-C66KGFY2.mjs";
import {
  importOptions,
  sourceRelease
} from "./chunk-JI42DR2Q.mjs";
import "./chunk-QLJHOYUI.mjs";
import "./chunk-7SGTFDEC.mjs";
import "./chunk-KUKVCAPO.mjs";
import "./chunk-IIUPXDVT.mjs";
import {
  environment,
  refuseProductionDeployment,
  targetDigest
} from "./chunk-O3XZW7YC.mjs";
import {
  atomicWrite,
  canonical,
  contained,
  exists,
  hash,
  readJson
} from "./chunk-YLKYRT24.mjs";
import {
  Fault
} from "./chunk-HRRL6FHO.mjs";

// packages/core/src/ship-intent.ts
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
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
    userRequest: input.userRequest
  };
  const intent = { ...body, digest: hash(canonical(body)) };
  await atomicWrite(await intentPath(ctx, intent.id), JSON.stringify(intent) + "\n");
  await setIntentStatus(ctx, intent.id, "queued");
  return intent;
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
  const intent = await readShipIntent(ctx, id);
  const env = environment(ctx, intent.env);
  try {
    if (targetDigest(env) !== intent.targetDigest)
      throw superseded(intent, "the configured target changed after it was queued.");
    const current = await sourceInventory(ctx);
    const { revision, configuration } = sourceRevision(current, ctx.config);
    if (revision !== intent.revision || configuration !== intent.configuration)
      throw superseded(intent, "the project sources changed after it was queued (a newer revision).");
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
      intent: { id, revision: intent.revision, status: "succeeded" },
      plan: { planPath: planned.planPath, ...planned.preview }
    };
  } catch (error) {
    const status = error instanceof Fault && error.code === "SHIP_INTENT_SUPERSEDED" ? "superseded" : "failed";
    await setIntentStatus(ctx, id, status, error instanceof Fault ? error.code : void 0).catch(
      () => void 0
    );
    throw error;
  }
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
export {
  captureShipIntent,
  checkShipRequest,
  intentCreated,
  intentFile,
  markIntentSuperseded,
  readShipIntent,
  runShipIntent,
  shipIntentStatus
};
