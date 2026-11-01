import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// packages/core/src/result.ts
import { randomUUID } from "node:crypto";
var DIAGNOSTIC_LIMIT = 50;
var Fault = class extends Error {
  constructor(code, message, exitCode = 1, status = "failed", details) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
    this.status = status;
    this.details = details;
  }
  code;
  exitCode;
  status;
  details;
};
var faultNextActions = {
  VALIDATION_FAILED: "Fix the listed diagnostics in the named .apx files, then rerun apexrest_apex_validate until it reports no errors.",
  VALIDATION_UNCONFIRMED: "The compiler returned no success marker. Read the diagnostics, fix the source and rerun apexrest_apex_validate.",
  SOURCE_DRIFT: "Sources changed after review. Rerun apexrest_ship with mode:plan, review it, then apply.",
  TARGET_DRIFT: "The target changed after review. Rerun apexrest_ship with mode:plan and review the new plan.",
  PLAN_EXPIRED: "Rerun apexrest_ship with mode:plan; plans expire 30 minutes after creation.",
  DEPLOY_APPROVAL_REQUIRED: "Run apexrest_ship with mode:apply and userRequest set to the user's literal instruction; it records a plan-bound deploy grant for this attempt.",
  PRODUCTION_DEPLOY_DENIED: "Deployment to production-marked targets is unsupported. Select an explicitly configured DEV, QA or TEST target; do not relabel production.",
  DATABASE_CONFIRMATION_REQUIRED: "Describe the exact database operations and consequences in this plan. After human confirmation, apply the same saved plan with confirmation bound to its digest.",
  PEER_REVIEW_REQUIRED: "Run apexrest_peer_review action:review with this saved plan path, report the verdict, then apply the same plan.",
  PEER_REVIEW_CHANGES_REQUESTED: "Report the peer findings to the user, fix them, rerun apexrest_ship mode:plan and review the new plan.",
  PEER_UNAVAILABLE: "Install the other vendor CLI (codex or claude), sign in with its own login command, then rerun apexrest_peer_review action:status.",
  PEER_VENDOR_REQUIRED: "Pass vendor: codex when the host is Claude Code, claude when the host is Codex.",
  RECOVERY_REVIEW_REQUIRED: "The plan changes authentication or authorization outside the application task. Obtain explicit scope for this exact change.",
  PROJECT_NOT_CONFIGURED: "Pass the absolute directory containing apexrest.json, or create one with apexrest_project action:init.",
  CONNECTION_REQUIRED: "Configure the named connection reference with apexrest_project action:connection_add (never send passwords in chat).",
  ENVIRONMENT_REQUIRED: "Pass env with a configured environment name; apexrest_project action:inspect lists them.",
  UNKNOWN_ENVIRONMENT: "Use an environment listed by apexrest_project action:inspect.",
  OUTCOME_UNKNOWN: "Do not retry. Read apexrest_job status for the same jobId and reconcile the target before any new deployment.",
  SYNC_BLOCKED: "Reconcile the interrupted import before syncing or deploying again; do not clear ownership.",
  SYNC_DIRTY: "Local sources differ from the checkpoint. Review or commit them before refreshing the working copy.",
  UNSUPPORTED_CAPABILITY: "The installed SQLcl lacks this apex command. Run apexrest_status detail:doctor and install the pinned toolchain.",
  JOB_OUTCOME_UNKNOWN: "Read apexrest_job status with this jobId; do not repeat the operation."
};
function normalizeDiagnostic(entry, code) {
  const d = {
    severity: entry.severity ?? "error",
    code: entry.code ?? code,
    message: redact(String(entry.message))
  };
  if (typeof entry.file === "string") d.file = redact(entry.file);
  if (Number.isInteger(entry.line)) d.line = entry.line;
  if (Number.isInteger(entry.column)) d.column = entry.column;
  if (typeof entry.type === "string") d.type = entry.type;
  if (typeof entry.hint === "string") d.hint = redact(entry.hint);
  if (Array.isArray(entry.validValues)) d.validValues = entry.validValues.map(String);
  return d;
}
var safeArtifactPages = /* @__PURE__ */ new WeakSet();
var verifiedVendorPages = /* @__PURE__ */ new WeakSet();
function verifiedVendorReferencePage(page) {
  Object.freeze(page);
  verifiedVendorPages.add(page);
  return page;
}
function artifactPage(content, format, id, offset, limit, metadata = {}) {
  const safe = format === "json" ? JSON.stringify(sanitized(JSON.parse(content))) : redact(content);
  const safeMetadata = sanitized(metadata);
  let count = Math.min(limit, Math.max(0, safe.length - offset));
  const create = () => {
    let end = offset + count;
    if (count > 0 && /[\uD800-\uDBFF]/.test(safe[end - 1]) && /[\uDC00-\uDFFF]/.test(safe[end] ?? ""))
      end += count === 1 ? 1 : -1;
    return {
      ...safeMetadata,
      id: redact(id),
      offset,
      content: safe.slice(offset, end),
      nextOffset: end < safe.length ? end : null,
      dataClassification: "untrusted_operation_output"
    };
  };
  let page = create();
  while (JSON.stringify(page).length > 24e3 && count > 1) {
    count = Math.floor(count / 2);
    page = create();
  }
  Object.freeze(page);
  safeArtifactPages.add(page);
  return page;
}
function redact(value) {
  return value.replace(/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}\b/g, "[REDACTED]").replace(
    /("(?:password|passwd|pwd|token|secret|authorization|cookie|set-cookie|wallet_location)"\s*:\s*)"(?:[^"\\]|\\.)*"/gi,
    '$1"[REDACTED]"'
  ).replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[REDACTED]@").replace(
    /((?:password|passwd|pwd|token|secret|authorization|cookie|set-cookie|wallet_location)\s*[:=]\s*)([^\r\n,}]+)/gi,
    "$1[REDACTED]"
  ).replace(/\bBearer\s+[\w.\-+/=]+/gi, "Bearer [REDACTED]");
}
function sanitized(value) {
  if (value && typeof value === "object" && (safeArtifactPages.has(value) || verifiedVendorPages.has(value)))
    return value;
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map(sanitized);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /^(?:password|passwd|pwd|token|secret|authorization|cookie|set-cookie|wallet_location)$/i.test(key) ? "[REDACTED]" : sanitized(item)
      ])
    );
  return value;
}
function success(operation, data, summary = "Operation completed.") {
  return {
    schemaVersion: 1,
    ok: true,
    operation,
    status: "succeeded",
    runId: randomUUID(),
    summary,
    diagnostics: [],
    artifacts: [],
    nextActions: [],
    data: sanitized(data),
    exitCode: 0
  };
}
function failure(operation, error) {
  const e = error instanceof Fault ? error : new Fault("INTERNAL_ERROR", error instanceof Error ? error.message : "Unknown failure");
  const structured = Array.isArray(e.details?.diagnostics) ? e.details.diagnostics : [];
  const diagnostics = structured.length ? structured.slice(0, DIAGNOSTIC_LIMIT).map((entry) => normalizeDiagnostic(entry, e.code)) : [{ severity: "error", code: e.code, message: redact(e.message) }];
  const nextActions = [
    ...Array.isArray(e.details?.nextActions) ? e.details.nextActions.map(redact) : [],
    ...faultNextActions[e.code] ? [faultNextActions[e.code]] : []
  ];
  return {
    schemaVersion: 1,
    ok: false,
    operation,
    status: e.status,
    runId: randomUUID(),
    summary: redact(e.message),
    diagnostics,
    artifacts: [],
    nextActions,
    ...structured.length > DIAGNOSTIC_LIMIT ? { data: { diagnosticsOmitted: structured.length - DIAGNOSTIC_LIMIT } } : {},
    exitCode: e.exitCode
  };
}

export {
  __require,
  __commonJS,
  __export,
  __toESM,
  Fault,
  verifiedVendorReferencePage,
  artifactPage,
  redact,
  sanitized,
  success,
  failure
};
