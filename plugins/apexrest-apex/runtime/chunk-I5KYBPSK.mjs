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

// packages/core/src/fs.ts
import { mkdir, open, readFile, readdir, realpath, rename, lstat, rm, link } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { hostname } from "node:os";
import { createHash, randomUUID as randomUUID2 } from "node:crypto";

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
  return value.replace(
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

// packages/core/src/fs.ts
var hash = (data) => createHash("sha256").update(data).digest("hex");
async function hashFile(file) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest("hex");
}
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ":" + canonical(v)).join(",") + "}";
  return JSON.stringify(value);
}
async function atomicWrite(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 448 });
  const temporary = file + "." + randomUUID2() + ".tmp";
  const handle = await open(temporary, "wx", 384);
  try {
    try {
      if (typeof value === "string" || Buffer.isBuffer(value)) await handle.writeFile(value);
      else for await (const chunk of value) await handle.writeFile(chunk);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  await syncDirectory(path.dirname(file));
}
async function syncDirectory(directory) {
  let handle;
  try {
    handle = await open(directory, "r");
    await handle.sync();
  } catch (error) {
    const code = error.code;
    if (process.platform === "win32" || ["EPERM", "EISDIR", "EINVAL", "ENOTSUP", "EBADF"].includes(code ?? ""))
      return;
    throw error;
  } finally {
    await handle?.close();
  }
}
var writeJson = (file, value) => atomicWrite(file, JSON.stringify(value, null, 2) + "\n");
async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}
async function exists(file) {
  try {
    await lstat(file);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
}
async function contained(root, candidate) {
  return containedPath(root, candidate, false);
}
async function containedChild(root, candidate) {
  return containedPath(root, candidate, true);
}
async function containedPath(root, candidate, child) {
  const base = await realpath(root), target = path.resolve(base, candidate);
  const rel = path.relative(base, target);
  if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel))
    throw new Fault("PATH_ESCAPE", "Path escapes the permitted root.", 2);
  if (child && rel === "")
    throw new Fault("PATH_ESCAPE", "Path must be inside, not equal to, the permitted root.", 2);
  let probe = target;
  while (!await exists(probe)) probe = path.dirname(probe);
  const physical = await realpath(probe), physicalRel = path.relative(base, physical);
  if (physicalRel === ".." || physicalRel.startsWith(".." + path.sep) || path.isAbsolute(physicalRel))
    throw new Fault("SYMLINK_ESCAPE", "Symlink escapes the permitted root.", 2);
  if (child && probe === target && physicalRel === "")
    throw new Fault("PATH_ESCAPE", "Path must be inside, not equal to, the permitted root.", 2);
  return target;
}
async function inventory(root) {
  const out = {};
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink())
        throw new Fault("SYMLINK_NOT_ALLOWED", "Source and bundle inventories reject symlinks.", 2);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile())
        out[path.relative(root, file).split(path.sep).join("/")] = hash(await readFile(file));
      else throw new Fault("SPECIAL_FILE_NOT_ALLOWED", "Source inventories accept regular files only.", 2);
    }
  }
  await walk(root);
  return Object.fromEntries(Object.entries(out).sort());
}
var LOCK_CORRUPT_AFTER_MS = 3e4;
async function createLock(file, owner) {
  const temporary = file + "." + randomUUID2() + ".owner";
  const handle = await open(temporary, "wx", 384);
  try {
    try {
      await handle.writeFile(owner);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await link(temporary, file);
      return;
    } catch (error) {
      const code = error.code;
      if (code === "EEXIST") throw error;
      if (!["EPERM", "ENOTSUP", "ENOSYS", "EXDEV", "EOPNOTSUPP"].includes(code ?? "")) throw error;
    }
    const fallback = await open(file, "wx", 384);
    try {
      await fallback.writeFile(owner);
      await fallback.sync();
    } finally {
      await fallback.close();
    }
  } finally {
    await rm(temporary, { force: true });
  }
}
async function withLock(file, action) {
  await mkdir(path.dirname(file), { recursive: true, mode: 448 });
  const recovery = file + ".recovery";
  if (await exists(recovery))
    throw new Fault(
      "LOCKED",
      "Lock recovery is in progress; inspect a stale recovery gate before retry.",
      5,
      "conflict"
    );
  if (await exists(file)) {
    let owner;
    try {
      owner = await readJson(file);
    } catch {
    }
    if (!owner || typeof owner !== "object" || !Number.isInteger(owner.pid)) {
      let age = 0;
      try {
        age = Date.now() - (await lstat(file)).mtimeMs;
      } catch {
      }
      if (age > LOCK_CORRUPT_AFTER_MS)
        throw new Fault(
          "LOCK_CORRUPT",
          `Lock file ${file} has no readable owner (an interrupted earlier process left it). Confirm no apexrest operation is running on any host, then delete that file and retry.`,
          5,
          "conflict"
        );
    }
    if (owner && owner.hostname === hostname() && Number.isInteger(owner.pid) && owner.pid > 0) {
      let dead = false;
      try {
        process.kill(owner.pid, 0);
      } catch (error) {
        dead = error.code === "ESRCH";
      }
      if (dead) {
        try {
          await mkdir(recovery, { mode: 448 });
        } catch {
          throw new Fault("LOCKED", "Another runner owns lock recovery.", 5, "conflict");
        }
        try {
          const current = await readJson(file);
          if (current.pid === owner.pid && current.hostname === owner.hostname) await rm(file);
        } finally {
          await rm(recovery, { recursive: true, force: true });
        }
      }
    }
  }
  try {
    await createLock(
      file,
      JSON.stringify({ pid: process.pid, hostname: hostname(), createdAt: (/* @__PURE__ */ new Date()).toISOString() })
    );
  } catch (e) {
    if (e.code === "EEXIST")
      throw new Fault(
        "LOCKED",
        "Another operation holds the lock. Inspect its owner before recovery.",
        5,
        "conflict"
      );
    throw e;
  }
  try {
    return await action();
  } finally {
    await rm(file, { force: true });
  }
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
  failure,
  hash,
  hashFile,
  canonical,
  atomicWrite,
  syncDirectory,
  writeJson,
  readJson,
  exists,
  contained,
  containedChild,
  inventory,
  LOCK_CORRUPT_AFTER_MS,
  withLock
};
