import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  deployPlanSchema
} from "./chunk-55N4ZQFI.mjs";
import {
  correlationId,
  openSpan,
  spanned,
  traceReport,
  withTrace
} from "./chunk-MPDF637Z.mjs";
import {
  auditUpgradeSource
} from "./chunk-CVR5OUUL.mjs";
import {
  environment,
  isProductionTarget,
  loadProject,
  parse,
  updatePolicy
} from "./chunk-FMCSJH7I.mjs";
import {
  sqlclTimings
} from "./chunk-4S6ZNCT6.mjs";
import {
  contained,
  exists,
  writeJson
} from "./chunk-RW7D7AJD.mjs";
import {
  Fault
} from "./chunk-OWILYJ3V.mjs";

// packages/core/src/ship.ts
import path from "node:path";
var compilerFaults = /* @__PURE__ */ new Set(["ORACLE_COMMAND_FAILED", "VALIDATION_UNCONFIRMED", "VALIDATION_FAILED"]);
function fallbackCompilerDiagnostics(output) {
  const entries = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.replace(/\x1b\[[0-9;]*m/g, "").trim();
    if (!line || !/\b(?:error|warn(?:ing)?|ORA-\d+|PLS-\d+)\b/i.test(line)) continue;
    if (/^\d+\s+(?:errors?|warnings?)\b|validation (?:failed|completed)/i.test(line)) continue;
    const entry = {
      severity: /\bwarn(?:ing)?\b/i.test(line) && !/\berror\b/i.test(line) ? "warning" : "error",
      message: line.slice(0, 2e3)
    };
    const file = /([\w./-]+\.apx)\b/.exec(line)?.[1];
    if (file) entry.file = file;
    const position = /(?:line\s+(\d+)(?:[,\s]+col(?:umn)?\s+(\d+))?)|\.apx:(\d+)(?::(\d+))?/i.exec(line);
    if (position) {
      const l = position[1] ?? position[3], c = position[2] ?? position[4];
      if (l) entry.line = Number(l);
      if (c) entry.column = Number(c);
    }
    entries.push(entry);
  }
  return entries;
}
function compilerFault(error, parseDiagnostics) {
  if (!(error instanceof Fault) || !compilerFaults.has(error.code)) return error;
  const recorded = Array.isArray(error.details?.diagnostics) ? error.details.diagnostics : [];
  const diagnostics = recorded.length ? recorded : parseDiagnostics(error.message);
  const errors = diagnostics.filter((d) => (d.severity ?? "error") === "error").length;
  return new Fault(
    "VALIDATION_FAILED",
    diagnostics.length ? `Oracle compiler reported ${errors} error(s) and ${diagnostics.length - errors} warning(s).` : error.message.slice(0, 2e3),
    1,
    "failed",
    {
      ...error.details,
      diagnostics: diagnostics.length ? diagnostics : [{ message: error.message.slice(0, 4e3) }]
    }
  );
}
async function validationSource(root, input) {
  if (input.sourceDir === void 0) {
    const ctx = await loadProject(root);
    return { source: await contained(ctx.root, ctx.config.application.sourceDir) };
  }
  const source = path.resolve(root, input.sourceDir);
  if (!await exists(path.join(source, "application.apx")))
    throw new Fault(
      "VALIDATION_SOURCE_MISSING",
      `${source} has no application.apx. Pass --source-dir with the APEXlang application folder.`,
      2
    );
  const own = path.join(source, ".apex", "apexlang.json");
  if (await exists(own)) return { source, metadata: { origin: "source", file: own } };
  const candidates = [];
  if (input.project !== void 0) candidates.push(path.resolve(input.project));
  for (let dir = path.dirname(source); ; dir = path.dirname(dir)) {
    if (await exists(path.join(dir, "apexrest.json"))) {
      candidates.push(dir);
      break;
    }
    if (path.dirname(dir) === dir) break;
  }
  for (const candidate of candidates) {
    let ctx;
    try {
      ctx = await loadProject(candidate);
    } catch {
      continue;
    }
    const file = path.join(ctx.root, ctx.config.application.sourceDir, ".apex", "apexlang.json");
    if (await exists(file)) return { source, metadata: { origin: "project", file } };
  }
  throw new Fault(
    "MMD_METADATA_REQUIRED",
    `${source} has no Oracle-generated .apex/apexlang.json and no enclosing APEXREST project provides one, so the APEXlang metadata version is unknown. Export or generate the application with SQLcl (apexrest apex export or apex generate), or validate it from a project whose application has .apex/apexlang.json.`,
    3
  );
}
async function validateApplication(oracle, target, parseDiagnostics, signal) {
  const { source, metadata } = typeof target === "string" ? { source: target, metadata: void 0 } : target;
  const started = Date.now();
  let validated;
  try {
    validated = metadata?.origin === "project" ? await oracle.validate(source, signal, { metadataFile: metadata.file }) : await oracle.validate(source, signal);
  } catch (error) {
    throw compilerFault(error, parseDiagnostics);
  }
  const { output, mmd: _mmd, ...rest } = validated;
  const warnings = parseDiagnostics(output).filter((d) => d.severity === "warning");
  const advisory = async (action) => {
    try {
      return await action();
    } catch (error) {
      if (signal?.aborted || error instanceof Fault && error.code === "CANCELLED") throw error;
      return {
        status: "unavailable",
        findings: [],
        reason: error instanceof Error ? error.message : "Advisory analysis did not complete."
      };
    }
  };
  const [staticAnalysis, upgradeAudit] = await Promise.all([
    advisory(
      async () => typeof oracle.codeScan === "function" ? oracle.codeScan(source, signal) : {
        status: "unavailable",
        findings: [],
        reason: "The selected adapter does not provide CodeScan."
      }
    ),
    advisory(() => auditUpgradeSource(source))
  ]);
  return {
    ...rest,
    ...metadata ? { sourceDir: source, metadata } : {},
    diagnostics: warnings,
    warningCount: warnings.length,
    staticAnalysis,
    upgradeAudit,
    ms: Date.now() - started,
    output,
    outputTruncated: false
  };
}
function sourceCounts(ctx, plan) {
  const under = (dir) => Object.keys(plan.sources).filter((f) => f.startsWith(dir + "/"));
  const application = under(ctx.config.application.sourceDir);
  const pages = application.filter((f) => /\/pages\/[^/]+\.apx$/.test(f));
  return {
    application: application.length,
    pages: pages.length,
    pageFiles: pages.slice(0, 50).map((f) => f.slice(ctx.config.application.sourceDir.length + 1)),
    migrations: plan.operations.filter((o) => o.kind === "migration").length,
    packages: plan.operations.filter((o) => o.kind === "package").length
  };
}
function planPreview(ctx, plan, options) {
  const selection = plan.schemaVersion === 4 ? plan.importSelection : {
    requestedMode: options?.importMode ?? "full",
    resolvedMode: "full",
    files: [],
    dependencies: [],
    reasons: [
      (ctx.config.toolchain.profile ?? "26.1") === "26.1" ? "apex-26.1-full-import" : "legacy-full-application-plan"
    ]
  };
  return {
    planId: plan.id,
    planDigest: plan.digest,
    environment: plan.environment,
    targetDigest: plan.targetDigest,
    planMode: plan.schemaVersion === 1 ? "full-export" : plan.mode,
    importSelection: {
      requestedMode: selection.requestedMode,
      resolvedMode: selection.resolvedMode,
      fileCount: selection.files.length,
      files: selection.files.slice(0, 50),
      filesTruncated: selection.files.length > 50,
      dependencies: selection.dependencies.slice(0, 50),
      dependencyCount: selection.dependencies.length,
      reasons: selection.reasons,
      ...plan.schemaVersion === 4 && plan.importSelection.readbackPolicy ? { readbackPolicy: plan.importSelection.readbackPolicy } : {}
    },
    backupRequired: plan.backupRequired,
    compiler: plan.compiler,
    createdAt: plan.createdAt,
    expiresAt: plan.expiresAt,
    risks: plan.risks,
    databaseReview: plan.databaseReview,
    approval: plan.approval,
    sources: sourceCounts(ctx, plan),
    target: JSON.stringify(plan.target).length <= 1200 ? plan.target : { omitted: true }
  };
}
function applicationLink(ctx, name) {
  const env = environment(ctx, name);
  return {
    id: env.applicationId,
    alias: ctx.config.application.alias,
    workspace: env.workspace,
    url: new URL(`f?p=${env.applicationId}`, env.baseUrl).toString()
  };
}
async function shipPlan(ctx, name, deployment, parseDiagnostics, progress, options = { importMode: "auto" }) {
  const started = Date.now();
  progress?.("validating");
  let plan;
  try {
    plan = await spanned("planning", async (span) => {
      const before = sqlclTimings().length;
      const value = await deployment.plan(ctx, name, options);
      const compile = sqlclTimings().slice(before).find((entry) => entry.label === "validate");
      if (compile) span.set({ compilerReused: compile.reused, compilerTransport: compile.transport });
      return value;
    });
  } catch (error) {
    throw compilerFault(error, parseDiagnostics);
  }
  const planPath = ".apexrest/plans/ship-" + plan.id + ".json";
  await writeJson(await contained(ctx.root, planPath), plan);
  const phases = [{ phase: "planning", ms: Date.now() - started }];
  return { plan, planPath, phases, preview: planPreview(ctx, plan, options) };
}
var phaseFor = {
  backing_up: "backing_up",
  migrating: "migrating",
  importing: "importing",
  verifying: "verifying"
};
function shipGrant(ctx, plan, userRequest, confirmation) {
  return {
    projectRoot: ctx.root,
    targetDigest: plan.targetDigest,
    planDigest: plan.digest,
    expiresAt: new Date(Math.min(Date.parse(plan.expiresAt), Date.now() + 10 * 60 * 1e3)).toISOString(),
    workerPid: process.pid,
    ...confirmation ? { confirmedRisks: plan.risks, confirmationRequest: confirmation.userRequest } : {},
    operations: ["deploy"],
    note: userRequest.slice(0, 16e3),
    grantedBy: "ship",
    grantedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function reconcileShipGrants() {
  await updatePolicy((p) => ({
    ...p,
    grants: p.grants.filter((g) => {
      if (g.grantedBy !== "ship") return true;
      if (Date.parse(g.expiresAt) <= Date.now() || !g.workerPid) return false;
      try {
        process.kill(g.workerPid, 0);
        return true;
      } catch (error) {
        return error.code === "EPERM";
      }
    })
  }));
}
var ownGrant = (ctx, plan) => (g) => g.grantedBy === "ship" && g.projectRoot === ctx.root && g.planDigest === plan.digest;
async function checkShipTarget(ctx, plan, local = false, confirmation) {
  const env = environment(ctx, plan.environment);
  if (await isProductionTarget(env, plan.targetDigest))
    throw new Fault(
      "PRODUCTION_DEPLOY_DENIED",
      "The plugin never deploys or restores production-marked targets.",
      4,
      "blocked"
    );
  if (confirmation && (confirmation.planDigest !== plan.digest || confirmation.userRequest.trim().length < 1))
    throw new Fault(
      "CONFIRMATION_PLAN_MISMATCH",
      "Human confirmation must name this exact reviewed plan digest.",
      4,
      "blocked"
    );
  if (!local && plan.risks.some((r) => r !== "application-restore") && !confirmation)
    throw new Fault(
      "DATABASE_CONFIRMATION_REQUIRED",
      "Describe the actual remote database operations and consequences, then obtain human confirmation for this exact saved plan.",
      4,
      "blocked",
      {
        nextActions: plan.risks.map((r) => "Review operation: " + r)
      }
    );
  return env;
}
var CLIENT_STOPPED_CAUSES = /* @__PURE__ */ new Set([
  "TIMEOUT",
  "CANCELLED",
  "OUTPUT_LIMIT",
  "LEASE_OR_CANCELLATION",
  "SQLCL_MCP_INCOMPLETE",
  "SCRIPT_INCOMPLETE"
]);
async function shipApply(ctx, planValue, userRequest, deployment, signal, progress, confirmation, recoveryAttempt = 0) {
  return withTrace(async () => {
    try {
      return await shipApplyTraced(
        ctx,
        planValue,
        userRequest,
        deployment,
        signal,
        progress,
        confirmation,
        recoveryAttempt
      );
    } catch (error) {
      if (error instanceof Fault && correlationId())
        error.details = { ...error.details, correlationId: correlationId() };
      throw error;
    }
  });
}
async function shipApplyTraced(ctx, planValue, userRequest, deployment, signal, progress, confirmation, recoveryAttempt = 0) {
  const setup = openSpan("setup", { stage: "ship" });
  const plan = parse(deployPlanSchema, planValue);
  if (await isProductionTarget(environment(ctx, plan.environment), plan.targetDigest))
    throw new Fault(
      "PRODUCTION_DEPLOY_DENIED",
      "The plugin never deploys or restores production-marked targets.",
      4,
      "blocked"
    );
  await deployment.checkLocal(ctx, plan);
  const locality = plan.risks.length ? await deployment.localTarget(ctx, plan) : { local: false };
  await checkShipTarget(ctx, plan, locality.local, confirmation);
  await reconcileShipGrants();
  const phases = [];
  let current;
  const mark = (phase) => {
    if (current) phases.push({ phase: current.phase, ms: Date.now() - current.at });
    current = { phase, at: Date.now() };
    progress?.(phase);
  };
  const grant = shipGrant(ctx, plan, userRequest, confirmation);
  await updatePolicy((p) => ({ ...p, grants: [...p.grants.filter((g) => !ownGrant(ctx, plan)(g)), grant] }));
  let grantRemoved = false;
  let applied;
  setup.end();
  try {
    mark("backing_up");
    applied = await deployment.apply(ctx, plan, signal, (state) => {
      const phase = phaseFor[state];
      if (phase && phase !== current?.phase) mark(phase);
    });
  } catch (error) {
    const runId = error instanceof Fault ? error.details?.deploymentRunId : void 0;
    if (error instanceof Fault && error.code === "OUTCOME_UNKNOWN" && typeof runId === "string" && CLIENT_STOPPED_CAUSES.has(String(error.details?.cause))) {
      error.message = `${error.message} SQLcl stopped before Oracle confirmed the outcome (${String(error.details?.cause)}); the database may still be executing it, so no automatic recovery was attempted. Once no APEXREST session remains on the target, run apexrest_ship mode:recover for run ${runId}.`;
      error.details = { ...error.details, automaticRecovery: "skipped" };
      throw error;
    }
    if (recoveryAttempt === 0 && typeof runId === "string" && ["OUTCOME_UNKNOWN", "POST_DEPLOY_CONTENT_FAILED", "POST_DEPLOY_VERIFICATION_FAILED"].includes(
      error.code
    )) {
      let recovered;
      try {
        recovered = await deployment.recover(ctx, runId);
      } catch (recoveryError) {
        if (recoveryError instanceof Fault) {
          recoveryError.details = {
            ...recoveryError.details,
            deploymentRunId: runId,
            originalCode: error.code
          };
          recoveryError.message = `${recoveryError.message} Interrupted deployment run: ${runId}.`;
        }
        throw recoveryError;
      }
      if (recovered.status === "succeeded") applied = recovered;
      else
        return await shipApplyTraced(
          ctx,
          recovered.retryPlan,
          userRequest,
          deployment,
          signal,
          progress,
          void 0,
          recoveryAttempt + 1
        );
    } else throw error;
  } finally {
    grantRemoved = await updatePolicy((p) => ({
      ...p,
      grants: p.grants.filter((g) => !ownGrant(ctx, plan)(g))
    })).then(
      () => true,
      () => false
    );
  }
  if (current) phases.push({ phase: current.phase, ms: Date.now() - current.at });
  return {
    status: "succeeded",
    runId: applied.runId,
    planId: plan.id,
    planDigest: plan.digest,
    environment: plan.environment,
    application: applicationLink(ctx, plan.environment),
    sources: sourceCounts(ctx, plan),
    phases,
    ...correlationId() ? { correlationId: correlationId(), operations: traceReport() } : {},
    ...applied.recovered ? { recovery: "server-readback-confirmed" } : {},
    verification: { identity: "confirmed", state: applied.state, directory: applied.directory },
    grant: { recorded: true, removed: grantRemoved, expiresAt: grant.expiresAt, planDigest: plan.digest },
    nextActions: grantRemoved ? [] : [
      "The grant cleanup failed; retain this diagnostic and let runtime grant reconciliation handle it before the next attempt."
    ]
  };
}

export {
  fallbackCompilerDiagnostics,
  validationSource,
  validateApplication,
  planPreview,
  shipPlan,
  shipApply
};
