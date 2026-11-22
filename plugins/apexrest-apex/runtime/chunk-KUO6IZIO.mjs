import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  isProductionTarget,
  loadProject,
  managedHome,
  parse,
  refName,
  relativePath,
  targetDigest
} from "./chunk-LIG5PZ4K.mjs";
import {
  closeSqlclReadScope,
  runPooledSqlcl
} from "./chunk-4LEHTNYH.mjs";
import {
  atomicWrite,
  canonical,
  contained,
  exists,
  hash,
  inventory,
  readJson,
  withLock,
  writeJson
} from "./chunk-26MTCOZK.mjs";
import {
  SQLCL_READ_TIMEOUT_MS,
  SQLCL_WRITE_TIMEOUT_MS,
  SqlclMcpClient,
  emitSqlclTiming,
  executionTiming,
  mcpCallOptions,
  mcpFailure,
  mcpResult,
  recordSqlclTiming,
  recordStatementTimings,
  runProcess,
  runSqlclMcp
} from "./chunk-MPKKOQVI.mjs";
import {
  Fault,
  __export,
  external_exports
} from "./chunk-CI5IU2PI.mjs";

// plugins/metadata.json
var metadata_default = {
  name: "apexrest-apex",
  version: "2.8.0",
  description: "Develop, deploy and test Oracle APEX applications from Codex or Claude Code.",
  author: {
    name: "APEXREST",
    url: "https://apexrest-dev.github.io/apexrest/"
  },
  license: "Apache-2.0",
  interface: {
    displayName: "APEXREST for Codex and Claude Code",
    shortDescription: "Oracle APEX development workflows",
    longDescription: "Oracle APEX development, controlled deployment and testing directly in your current Codex or Claude Code session.",
    developerName: "APEXREST",
    websiteURL: "https://apexrest-dev.github.io/apexrest/",
    composerIcon: "./assets/apexrest-icon.svg",
    logo: "./assets/apexrest-logo.svg",
    logoDark: "./assets/apexrest-logo.svg",
    category: "Productivity",
    capabilities: ["Read", "Write"],
    defaultPrompt: [
      "Use $apexrest-work to build or change my Oracle APEX application in this session.",
      "Use $apexrest-setup to check my tools and connection references.",
      "Use $apexrest-safety to explain what blocked my APEX deployment or test."
    ]
  }
};

// packages/core/src/version.ts
var VERSION = metadata_default.version;

// packages/core/src/partial-import.ts
import path4 from "node:path";
import { cp as cp2, mkdir as mkdir3, rename as rename2, rm as rm2 } from "node:fs/promises";

// packages/core/src/sync.ts
import path2 from "node:path";
import { lstat, mkdir as mkdir2, readdir as readdir2, realpath, open, cp, chmod } from "node:fs/promises";

// packages/core/src/deployment-control.ts
import path from "node:path";
import { hostname } from "node:os";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
function coordination(env) {
  return {
    backend: "local",
    scope: "managed-home-schema",
    // Bind plans to the history store. Moving a plan to a fresh home is not migration recovery.
    storeDigest: hash(canonical({ home: managedHome(), ...env.databaseIdentity, schema: env.parsingSchema }))
  };
}
var ownerSchema = external_exports.strictObject({
  runId: external_exports.string(),
  pid: external_exports.number().int().positive(),
  hostname: external_exports.string(),
  phase: external_exports.enum(["preparing", "writing"]),
  createdAt: external_exports.string()
});
var digestSchema = external_exports.string().regex(/^[a-f0-9]{64}$/);
var serviceBindingSchema = external_exports.strictObject({ serviceName: external_exports.string().min(1), directory: digestSchema });
var packagesSchema = external_exports.record(external_exports.string(), external_exports.string().regex(/^[a-f0-9]{64}$/));
var schemaInstanceSchema = external_exports.strictObject({ created: external_exports.string().min(1) });
var historySchema = external_exports.array(
  external_exports.strictObject({
    version: external_exports.string(),
    checksum: external_exports.string().regex(/^[a-f0-9]{64}$/),
    status: external_exports.enum(["started", "succeeded"]),
    run_id: external_exports.string()
  })
);
var LocalDeploymentControl = class {
  directory;
  serviceBinding;
  serviceName;
  root;
  constructor(env) {
    const { dbUniqueName, serviceName } = env.databaseIdentity;
    const schema = env.parsingSchema;
    this.root = path.join(managedHome(), "deployment-control");
    this.directory = path.join(this.root, hash(canonical({ dbUniqueName, serviceName, schema })));
    this.serviceName = serviceName;
    this.serviceBinding = path.join(
      this.root,
      "schema-services",
      hash(canonical({ dbUniqueName, schema })) + ".json"
    );
  }
  file(name) {
    return path.join(this.directory, name);
  }
  async hasScriptHistory(directory) {
    const history = path.join(directory, "history.json");
    const packages = path.join(directory, "packages.json");
    return await exists(history) && parse(historySchema, await readJson(history)).length > 0 || await exists(packages) && Object.keys(parse(packagesSchema, await readJson(packages))).length > 0;
  }
  /** Register a known original store after a read-only plan has verified its target. */
  async registerExisting() {
    if (await this.hasScriptHistory(this.directory)) await this.checkService(true);
  }
  async checkService(bind = false) {
    const check = async () => {
      let binding;
      try {
        binding = parse(serviceBindingSchema, await readJson(this.serviceBinding));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const directory = path.basename(this.directory);
      if (binding && (binding.serviceName !== this.serviceName || binding.directory !== directory))
        throw new Fault(
          "CONTROL_SERVICE_CHANGED",
          "This database name and schema already use a different Oracle service in the managed deployment store. Use the existing service to preserve migration history and reconcile interrupted runs.",
          5,
          "conflict"
        );
      if (!bind || binding) return;
      const bindings = path.dirname(this.serviceBinding);
      const recognized = /* @__PURE__ */ new Set([directory]);
      for (const file of (await readdir(bindings)).filter((name) => /^[a-f0-9]{64}\.json$/.test(name))) {
        recognized.add(parse(serviceBindingSchema, await readJson(path.join(bindings, file))).directory);
      }
      const knownHistory = await this.hasScriptHistory(this.directory);
      let unregisteredHistory = false;
      for (const entry of await readdir(this.root, { withFileTypes: true })) {
        if (!entry.isDirectory() || !digestSchema.safeParse(entry.name).success || recognized.has(entry.name))
          continue;
        const legacy = path.join(this.root, entry.name);
        if (await exists(path.join(legacy, "active.json")))
          throw new Fault(
            "LEGACY_CONTROL_OWNER_UNRESOLVED",
            "An older deployment store still has active ownership. Resolve that run using its original service before binding a different store.",
            5,
            "conflict"
          );
        if (!knownHistory && !unregisteredHistory) unregisteredHistory = await this.hasScriptHistory(legacy);
      }
      if (unregisteredHistory)
        throw new Fault(
          "LEGACY_CONTROL_HISTORY_UNREGISTERED",
          "An older deployment store has unregistered migration or package history. Run a full read-only deployment plan for each original environment using its original Oracle service before binding a new store.",
          5,
          "conflict"
        );
      await writeJson(this.serviceBinding, { serviceName: this.serviceName, directory });
    };
    if (bind) await withLock(path.join(path.dirname(this.serviceBinding), "bindings.lock"), check);
    else await check();
  }
  /**
   * Binds the local history to one instance of the parsing schema, identified by its creation time
   * (UTC, from the target identity query). A schema that was dropped and created again, or a
   * database rebuilt with the same name, service and schema, starts with no migrations: the
   * history recorded for the earlier instance is provably not on it and is moved aside instead of
   * silently skipping migrations. A store without a recorded instance is adopted unless the
   * schema was created after its history was last written. Nothing is replayed or deleted.
   */
  async reconcileSchemaInstance(created) {
    if (!await exists(this.directory)) return {};
    return withLock(this.file("control.lock"), async () => {
      const record = this.file("schema-instance.json");
      const recorded = await exists(record) ? parse(schemaInstanceSchema, await readJson(record)).created : void 0;
      if (recorded === created) return {};
      const scripts = ["history.json", "packages.json"].map((name) => this.file(name));
      let stale = recorded !== void 0;
      if (!stale && await this.hasScriptHistory(this.directory)) {
        let written = 0;
        for (const file of scripts)
          if (await exists(file)) written = Math.max(written, (await stat(file)).mtimeMs);
        const createdAt = Date.parse(created);
        stale = Number.isFinite(createdAt) && createdAt > written;
      }
      if (!stale || !await this.hasScriptHistory(this.directory)) {
        await writeJson(record, { created });
        return {};
      }
      const owner = await this.owner();
      if (owner && !(Date.parse(owner.createdAt) >= Date.parse(created)))
        throw new Fault(
          "CONTROL_SCHEMA_RECREATED",
          "The parsing schema was created again after a deployment run took ownership of its local history. Reconcile that run before deploying to the new schema.",
          5,
          "conflict"
        );
      const archive = this.file(
        `archived-schema-${(recorded ?? "unrecorded").replace(/[^0-9A-Za-z]/gu, "")}-${Date.now()}`
      );
      await mkdir(archive, { recursive: true, mode: 448 });
      const historyFile = this.file("history.json");
      const rows = await exists(historyFile) ? parse(historySchema, await readJson(historyFile)) : [];
      for (const file of scripts)
        if (await exists(file)) await rename(file, path.join(archive, path.basename(file)));
      const current = owner ? rows.filter((row) => row.run_id === owner.runId) : [];
      if (current.length) await writeJson(historyFile, current);
      await writeJson(record, { created });
      return { archived: archive };
    });
  }
  async history() {
    await this.checkService();
    const file = this.file("history.json");
    return await exists(file) ? parse(historySchema, await readJson(file)) : [];
  }
  /**
   * Checksum of each package script last applied successfully, by project-relative file. Package
   * scripts are re-runnable, so a plan only re-applies the ones that changed since then.
   */
  async packages(projectId) {
    await this.checkService();
    const file = this.file("packages.json");
    const all = await exists(file) ? parse(packagesSchema, await readJson(file)) : {};
    const prefix = projectId + ":";
    return Object.fromEntries(
      Object.entries(all).filter(([key]) => key.startsWith(prefix)).map(([key, sha]) => [key.slice(prefix.length), sha])
    );
  }
  async packageApplied(runId, projectId, file, checksum) {
    await withLock(this.file("control.lock"), async () => {
      await this.assertOwner(runId);
      const target = this.file("packages.json");
      const all = await exists(target) ? parse(packagesSchema, await readJson(target)) : {};
      all[projectId + ":" + file] = checksum;
      await writeJson(target, Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b))));
    });
  }
  async owner() {
    await this.checkService();
    const file = this.file("active.json");
    try {
      return parse(ownerSchema, await readJson(file));
    } catch (error) {
      if (error.code === "ENOENT") return void 0;
      throw error;
    }
  }
  async acquire(runId, bindService = true) {
    await this.checkService(bindService);
    await withLock(this.file("control.lock"), async () => {
      const owner = await this.owner();
      if (owner) {
        let dead = false;
        if (owner.hostname === hostname()) {
          try {
            process.kill(owner.pid, 0);
          } catch (e) {
            dead = e.code === "ESRCH";
          }
        }
        if (!dead || owner.phase === "writing")
          throw new Fault(
            "TARGET_LOCKED",
            "A runner owns this schema or an interrupted write needs reconciliation. Preserve its control state.",
            5,
            "conflict"
          );
      }
      await writeJson(this.file("active.json"), {
        runId,
        pid: process.pid,
        hostname: hostname(),
        phase: "preparing",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    });
  }
  async assertOwner(runId) {
    const owner = await this.owner();
    if (owner?.runId !== runId || owner.pid !== process.pid || owner.hostname !== hostname())
      throw new Fault(
        "LEASE_LOST",
        "Local deployment ownership is no longer confirmed.",
        6,
        "outcome_unknown"
      );
    return owner;
  }
  async markWriting(runId) {
    await withLock(this.file("control.lock"), async () => {
      await writeJson(this.file("active.json"), { ...await this.assertOwner(runId), phase: "writing" });
    });
  }
  async migration(runId, version, checksum, status) {
    await withLock(this.file("control.lock"), async () => {
      await this.assertOwner(runId);
      const history = await this.history(), previous = history.find((row) => row.version === version);
      if (status === "started" ? Boolean(previous) : !previous || previous.run_id !== runId || previous.checksum !== checksum || previous.status !== "started")
        throw new Fault(
          "MIGRATION_HISTORY_CONFLICT",
          "Migration history requires reconciliation; it cannot be replayed or overwritten.",
          5
        );
      const next = history.filter((row) => row.version !== version);
      next.push({ version, checksum, status, run_id: runId });
      await writeJson(
        this.file("history.json"),
        next.sort((a, b) => a.version.localeCompare(b.version))
      );
    });
  }
  async release(runId) {
    await withLock(this.file("control.lock"), async () => {
      await this.assertOwner(runId);
      await rm(this.file("active.json"));
    });
  }
  /** Release only the reconciled run after its worker has stopped. Keep history. */
  async claimReconciled(runId) {
    await this.checkService(true);
    await withLock(this.file("control.lock"), async () => {
      const owner = await this.owner();
      if (!owner) {
        await writeJson(this.file("active.json"), {
          runId,
          pid: process.pid,
          hostname: hostname(),
          phase: "preparing",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        return;
      }
      if (owner.runId !== runId || owner.hostname !== hostname())
        throw new Fault(
          "TARGET_LOCKED",
          "Another runner owns this target; reconciliation cannot clear its ownership.",
          5
        );
      if (owner.pid !== process.pid) {
        let dead = false;
        try {
          process.kill(owner.pid, 0);
        } catch (error) {
          dead = error.code === "ESRCH";
        }
        if (!dead)
          throw new Fault(
            "TARGET_LOCKED",
            "The import worker is still alive; wait for its terminal result.",
            5
          );
      }
      await writeJson(this.file("active.json"), { ...owner, pid: process.pid, phase: "preparing" });
    });
  }
};

// packages/core/src/sync.ts
var digest = external_exports.string().regex(/^[a-f0-9]{64}$/);
var snapshotSchema = external_exports.strictObject({
  directory: relativePath,
  files: external_exports.record(relativePath, digest),
  digest
});
var serverMetadataSchema = external_exports.strictObject({
  lastUpdatedOn: external_exports.string().nullable(),
  lastUpdatedBy: external_exports.string().nullable()
});
var syncStateSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  syncId: external_exports.uuid(),
  revision: external_exports.number().int().nonnegative(),
  projectRoot: external_exports.string(),
  projectId: external_exports.string(),
  environment: external_exports.string(),
  targetDigest: digest,
  target: external_exports.record(external_exports.string(), external_exports.unknown()),
  sourceDir: relativePath,
  toolchainDigest: digest,
  runtimeVersion: external_exports.string(),
  compilerVersion: external_exports.string().min(1),
  exportedAt: external_exports.iso.datetime(),
  baseline: snapshotSchema,
  backup: external_exports.strictObject({ backupId: external_exports.uuid(), checksum: digest }),
  observedMetadata: serverMetadataSchema,
  lastSuccessfulImport: external_exports.strictObject({
    at: external_exports.iso.datetime(),
    runId: external_exports.uuid(),
    snapshot: snapshotSchema,
    verifiedFiles: external_exports.array(relativePath).optional()
  }).nullable(),
  recoveryCheckpoint: external_exports.strictObject({ at: external_exports.iso.datetime(), runId: external_exports.uuid(), snapshot: snapshotSchema }).nullable().optional(),
  status: external_exports.enum(["ready", "importing", "verification_failed", "outcome_unknown", "invalidated"]),
  importingRunId: external_exports.uuid().nullable()
});
async function syncPath(ctx, relative) {
  const file = await contained(ctx.root, relative);
  let probe = ctx.root;
  for (const part of path2.relative(ctx.root, file).split(path2.sep).filter(Boolean)) {
    probe = path2.join(probe, part);
    if (await exists(probe)) {
      if ((await lstat(probe)).isSymbolicLink())
        throw new Fault("SYNC_PATH_UNSAFE", "Working-copy storage rejects symlinks.", 5);
    }
  }
  return file;
}
async function privateCopy(source, destination) {
  await cp(source, destination, { recursive: true });
  async function secure(directory) {
    await chmod(directory, 448);
    for (const entry of await readdir2(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Fault("SYNC_PATH_UNSAFE", "Private copies reject symlinks.", 5);
      const file = path2.join(directory, entry.name);
      if (entry.isDirectory()) await secure(file);
      else if (entry.isFile()) await chmod(file, 384);
      else throw new Fault("SYNC_PATH_UNSAFE", "Private copies accept regular files only.", 5);
    }
  }
  await secure(destination);
}
async function checkSnapshot(ctx, snapshot) {
  if (!snapshot.directory.startsWith(".apexrest/"))
    throw new Fault("SYNC_ARTIFACT_INVALID", "Snapshot must be private project storage.", 5);
  const actual = await inventory(await syncPath(ctx, snapshot.directory));
  if (!Object.keys(actual).length || canonical(actual) !== canonical(snapshot.files) || hash(canonical(actual)) !== snapshot.digest)
    throw new Fault("SYNC_ARTIFACT_INVALID", "Working-copy snapshot checksum verification failed.", 5);
  return actual;
}
async function checkSyncBackup(ctx, backup, envDigest, environmentName) {
  const directory = await syncPath(ctx, ".apexrest/backups/" + backup.backupId);
  const metadata = await readJson(
    await syncPath(ctx, ".apexrest/backups/" + backup.backupId + "/backup.json")
  );
  const files = await inventory(await syncPath(ctx, ".apexrest/backups/" + backup.backupId + "/application"));
  if (metadata.schemaVersion !== 1 || metadata.environment !== environmentName || metadata.backupId !== backup.backupId || metadata.targetDigest !== envDigest || metadata.digest !== backup.checksum || hash(canonical(files)) !== backup.checksum || canonical(metadata.files) !== canonical(files) || !Object.keys(files).length)
    throw new Fault("BACKUP_INVALID", "Initial source backup checksum or target verification failed.", 5);
}
function checkpoint(state) {
  return state.recoveryCheckpoint?.snapshot ?? state.lastSuccessfulImport?.snapshot ?? state.baseline;
}
var SyncStore = class {
  constructor(ctx, env, name) {
    this.ctx = ctx;
    this.env = env;
    this.name = name;
  }
  ctx;
  env;
  name;
  async file(key = targetDigest(this.env)) {
    return syncPath(this.ctx, ".apexrest/sync/" + key + "/state.json");
  }
  async lock(action) {
    return withLock(await syncPath(this.ctx, ".apexrest/sync/state.lock"), action);
  }
  /** Scan environment records so a changed target cannot silently become a legacy project. */
  async read(allowMappingChange = false) {
    const base = await syncPath(this.ctx, ".apexrest/sync");
    if (!await exists(base)) return null;
    const matches = [];
    for (const entry of await readdir2(base, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Fault("SYNC_PATH_UNSAFE", "Sync storage contains a symlink.", 5);
      if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
      const file = await this.file(entry.name);
      if (!await exists(file)) {
        if (await exists(await syncPath(this.ctx, ".apexrest/sync/" + entry.name + "/journal.jsonl")))
          throw new Fault(
            "SYNC_STATE_INVALID",
            "A durable sync journal exists but its state is missing. Recover it explicitly; no export fallback.",
            5
          );
        continue;
      }
      let state2;
      try {
        state2 = syncStateSchema.parse(await readJson(file));
      } catch {
        throw new Fault(
          "SYNC_STATE_INVALID",
          "Corrupt working-copy state requires explicit recovery; no export fallback.",
          5
        );
      }
      if (state2.targetDigest !== entry.name)
        throw new Fault("SYNC_STATE_INVALID", "Sync record storage key differs from its target.", 5);
      if (state2.targetDigest === targetDigest(this.env) && state2.environment !== this.name && state2.status !== "invalidated")
        throw new Fault(
          "SYNC_MAPPING_CHANGED",
          "This target is bound to another environment. Explicitly invalidate the previous mapping first.",
          5
        );
      if (state2.environment === this.name && (state2.status !== "invalidated" || state2.targetDigest === targetDigest(this.env)))
        matches.push(state2);
    }
    const active = matches.filter((s) => s.status !== "invalidated");
    if (active.length > 1)
      throw new Fault("SYNC_STATE_INVALID", "Multiple active records require reconciliation.", 5);
    const state = active[0] ?? matches[0] ?? null;
    if (state && state.status !== "invalidated" && !allowMappingChange) await this.checkMapping(state);
    return state;
  }
  async checkMapping(state) {
    const { readFile: readFile8 } = await import("node:fs/promises");
    if (state.projectRoot !== await realpath(this.ctx.root) || state.projectId !== this.ctx.config.projectId || state.environment !== this.name || state.targetDigest !== targetDigest(this.env) || state.sourceDir !== this.ctx.config.application.sourceDir || state.runtimeVersion !== VERSION || state.toolchainDigest !== hash(await readFile8(await contained(this.ctx.root, this.ctx.config.toolchain.lockFile))) || await isProductionTarget(this.env))
      throw new Fault(
        "SYNC_MAPPING_CHANGED",
        "Project, target, source directory or toolchain changed. Explicit refresh or invalidate is required.",
        5
      );
  }
  async validate(state, ready = true) {
    await this.checkMapping(state);
    if (ready && state.status !== "ready")
      throw new Fault(
        "SYNC_BLOCKED",
        `Working copy is ${state.status}. Inspect the existing run and reconcile before writes.`,
        5
      );
    const validRunSnapshot = (reference) => {
      const base = ".apexrest/deployments/" + reference.runId + "/";
      if (["snapshot", "server"].some(
        (kind) => reference.snapshot.directory === base + kind + "/" + state.sourceDir
      ))
        return true;
      const relative = reference.snapshot.directory.startsWith(base) ? reference.snapshot.directory.slice(base.length) : "";
      return /^recovery\/\d{10,17}\/application$/.test(relative);
    };
    if (state.baseline.directory !== ".apexrest/sync/" + state.targetDigest + "/baselines/" + state.syncId + "/application" || state.lastSuccessfulImport && !validRunSnapshot(state.lastSuccessfulImport) || state.recoveryCheckpoint && !validRunSnapshot(state.recoveryCheckpoint))
      throw new Fault(
        "SYNC_ARTIFACT_INVALID",
        "Snapshot reference does not match its sync or deployment owner.",
        5
      );
    if (state.status === "ready" && (await new LocalDeploymentControl(this.env).owner())?.phase === "writing")
      throw new Fault("SYNC_BLOCKED", "A writing owner must complete or be reconciled before reuse.", 5);
    await checkSnapshot(this.ctx, state.baseline);
    if (state.lastSuccessfulImport) await checkSnapshot(this.ctx, state.lastSuccessfulImport.snapshot);
    if (state.recoveryCheckpoint) await checkSnapshot(this.ctx, state.recoveryCheckpoint.snapshot);
    await checkSyncBackup(this.ctx, state.backup, state.targetDigest, this.name);
  }
  async write(state) {
    const valid = syncStateSchema.parse(state);
    const file = await this.file(valid.targetDigest);
    await mkdir2(path2.dirname(file), { recursive: true, mode: 448 });
    const journalFile = await syncPath(this.ctx, ".apexrest/sync/" + valid.targetDigest + "/journal.jsonl");
    const journal = await open(journalFile, "a", 384);
    try {
      await journal.writeFile(
        JSON.stringify({
          at: (/* @__PURE__ */ new Date()).toISOString(),
          syncId: valid.syncId,
          revision: valid.revision,
          status: valid.status,
          importingRunId: valid.importingRunId,
          baseline: valid.baseline.directory,
          backupId: valid.backup.backupId,
          latestApplied: valid.lastSuccessfulImport?.snapshot.directory ?? null
        }) + "\n"
      );
      await journal.sync();
    } finally {
      await journal.close();
    }
    await writeJson(file, valid);
    const directory = process.platform !== "win32" ? await open(path2.dirname(file), "r") : null;
    try {
      await directory?.sync();
    } finally {
      await directory?.close();
    }
  }
  async status() {
    const state = await this.read(true);
    if (!state) return { mode: "full-export", status: "absent", serverFreshness: "not-checked" };
    let blockedReason = null;
    try {
      await this.validate(state, false);
    } catch (error) {
      blockedReason = error instanceof Fault ? error.code : "SYNC_ARTIFACT_INVALID";
    }
    if ((await new LocalDeploymentControl(this.env).owner())?.phase === "writing")
      blockedReason = "SYNC_BLOCKED";
    const source = await syncPath(this.ctx, state.sourceDir);
    const files = await exists(source) ? await inventory(source) : {};
    return {
      mode: state.status === "invalidated" ? "full-export" : "working-copy",
      syncId: state.syncId,
      revision: state.revision,
      status: state.status,
      exportedAt: state.exportedAt,
      lastSuccessfulImport: state.lastSuccessfulImport ? {
        at: state.lastSuccessfulImport.at,
        runId: state.lastSuccessfulImport.runId,
        digest: state.lastSuccessfulImport.snapshot.digest,
        verifiedFiles: state.lastSuccessfulImport.verifiedFiles ?? null
      } : null,
      backupId: state.backup.backupId,
      importingRunId: state.importingRunId,
      dirty: canonical(files) !== canonical(checkpoint(state).files),
      blocked: !!blockedReason || !["ready", "invalidated"].includes(state.status),
      blockedReason,
      serverFreshness: "not-checked",
      assumption: "selected-content-conflicts; independent managed homes require external serialization"
    };
  }
};

// packages/core/src/apexlang-equivalence.ts
import path3 from "node:path";
import { readFile } from "node:fs/promises";
var APEXLANG_EQUIVALENCE_POLICY = "apex262-selected-source-v1";
var formattingRule = "structural-whitespace-and-comments";
var defaultRule = "pageItem.selectList.layout.startNewRow:true-default";
var pageDefaultRule = "page.security.pageAccessProtection:argumentsMustHaveChecksum-default";
var regionDefaultRule = "region.layout.startNewRow:true-default";
var chartDefaultRule = "region.chart.type:bar-default";
var cursorDefaultRule = "page.navigation.cursorFocus:doNotFocusCursor-default";
var autocompleteDefaultRule = "page.security.formAutoComplete:false-default";
var paginationDefaultRule = "region.classicReport.pagination.type:nextAndPreviousLinks-default";
var orderRule = "explicit-unique-region-and-chart-component-order";
var columnOrderRule = "explicit-unique-report-column-order";
var memberOrderRule = "unique-property-and-group-order";
var quotedLiteralRule = "single-line-literal-quoting";
var invokeDefaultRule = "invokeApi.parameter.direction:in,dataType:varchar2,ignoreOutput:false-default";
var invokeCaseRule = "invokeApi.invoke.identifier-case";
var eventDefaultRule = "dynamicAction.when.items.event:change-default";
var componentOrderRule = "key-ordered-page-components";
var lovNullDefaultRule = "pageItem.selectList.lov.displayNullValue:true-default";
var buttonActionDefaultRule = "button.behavior.action:submitPage-default";
var assignedIdentifierRule = "process.advanced.executionMappingIdentifier:server-assigned";
var limit = 8 * 1024 * 1024;
function readStructure(source) {
  if (Buffer.byteLength(source) > limit) throw new Error("Source exceeds the comparison limit.");
  const lines = source.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g)?.filter(Boolean) ?? [];
  const roots = [];
  const stack = [];
  const append = (node) => (stack.at(-1)?.children ?? roots).push(node);
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    const line = raw.replace(/[\r\n]+$/, "");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    if (trimmed.startsWith("/*")) {
      let comment = trimmed;
      while (!comment.includes("*/") && ++index < lines.length) comment += lines[index];
      const end = comment.indexOf("*/");
      if (end < 0 || comment.slice(end + 2).trim()) throw new Error("Unsupported comment boundary.");
      continue;
    }
    if (trimmed.startsWith("```")) {
      if (!/^```[A-Za-z0-9_-]*[ \t]*$/.test(trimmed)) throw new Error("Unsupported fenced literal.");
      let literal = line.replace(/^[ \t]*/, "") + raw.slice(line.length);
      let closed = false;
      while (++index < lines.length) {
        const next = lines[index];
        if (/^[ \t]*```[ \t]*(?:\r\n|\r|\n)?$/.test(next)) {
          literal += next.replace(/^[ \t]*/, "");
          closed = true;
          break;
        }
        literal += next;
      }
      if (!closed) throw new Error("Unclosed fenced literal.");
      const siblings = stack.at(-1)?.children ?? roots;
      const owner = siblings.at(-1);
      if (owner?.kind === "property" && owner.value === "" && owner.literal === void 0) {
        owner.literal = literal;
        owner.indent = /^[ \t]*/.exec(line)[0];
      } else append({ kind: "literal", value: literal });
      continue;
    }
    const property = /^[ \t]*([A-Za-z][\w]*):[ \t]*(.*)$/.exec(line);
    if (property) {
      const value = property[2];
      if (value.includes("```") || value.startsWith('"""') || value.startsWith("'''"))
        throw new Error("Unsupported inline or multiline literal.");
      if (value === "{") {
        const node = { kind: "map", name: property[1], key: "", children: [] };
        append(node);
        stack.push(node);
      } else if (value === "[") {
        const items = [];
        let closed = false;
        while (++index < lines.length) {
          const entry = lines[index].trim();
          if (entry === "]") {
            closed = true;
            break;
          }
          if (!entry || /[[\]{}()]$|^```/.test(entry)) throw new Error("Unsupported list entry.");
          items.push(entry);
        }
        if (!closed) throw new Error("Unclosed list.");
        append({ kind: "property", name: property[1], value: "[" + items.join("\n") + "]" });
      } else append({ kind: "property", name: property[1], value });
      continue;
    }
    const component = /^([A-Za-z][\w]*)(?:[ \t]+(.*?))?[ \t]*\([ \t]*$/.exec(trimmed);
    if (component) {
      const node = { kind: "component", name: component[1], key: component[2] ?? "", children: [] };
      append(node);
      stack.push(node);
      continue;
    }
    const group = /^([A-Za-z][\w]*)[ \t]*\{[ \t]*$/.exec(trimmed);
    if (group) {
      const node = { kind: "group", name: group[1], key: "", children: [] };
      append(node);
      stack.push(node);
      continue;
    }
    if (trimmed === ")" || trimmed === "}") {
      const node = stack.pop();
      if (!node || trimmed === ")" !== (node.kind === "component"))
        throw new Error("Unbalanced structural boundary.");
      continue;
    }
    throw new Error("Unsupported source form.");
  }
  if (stack.length) throw new Error("Unclosed structural boundary.");
  return roots;
}
function removeQualifiedDefault(nodes, parent) {
  return nodes.map((node) => {
    if (!("children" in node)) return node;
    let children = node.children;
    if (node.kind === "component" && node.name === "pageItem" && parent?.kind === "component" && parent.name === "page") {
      const types = children.filter((child) => child.kind === "property" && child.name === "type");
      const layouts = children.filter((child) => child.kind === "group" && child.name === "layout");
      if (types.length === 1 && types[0].kind === "property" && types[0].value === "selectList" && layouts.length === 1) {
        children = children.map((child) => {
          if (child.kind !== "group" || child.name !== "layout") return child;
          const rows = child.children.filter(
            (entry) => entry.kind === "property" && entry.name === "startNewRow"
          );
          const layouts2 = child.children.filter(
            (entry) => entry.kind === "property" && entry.name === "startNewLayout"
          );
          if (rows.length !== 1 || rows[0].kind !== "property" || rows[0].value !== "true" || layouts2.length > 1 || layouts2.length === 1 && (layouts2[0].kind !== "property" || layouts2[0].value !== "false"))
            return child;
          return { ...child, children: child.children.filter((entry) => entry !== rows[0]) };
        });
      }
    }
    return { ...node, children: removeQualifiedDefault(children, node) };
  });
}
function normalizeExport(nodes, rules, parent) {
  const result = nodes.map((node) => {
    if (!("children" in node)) return node;
    let children = normalizeExport(node.children, rules, node);
    const property = (name) => children.filter((entry) => entry.kind === "property" && entry.name === name);
    const omit = (name, value, rule) => {
      const matches = property(name);
      if (matches.length === 1 && matches[0].kind === "property" && matches[0].value === value) {
        children = children.filter((entry) => entry !== matches[0]);
        rules.add(rule);
      }
    };
    if (node.kind === "group" && node.name === "security" && parent?.name === "page") {
      omit("pageAccessProtection", "argumentsMustHaveChecksum", pageDefaultRule);
      omit("formAutoComplete", "false", autocompleteDefaultRule);
    }
    if (node.kind === "group" && node.name === "navigation" && parent?.name === "page")
      omit("cursorFocus", "doNotFocusCursor", cursorDefaultRule);
    if (node.kind === "group" && node.name === "pagination" && parent?.kind === "component" && parent.name === "region" && parent.children.some(
      (entry) => entry.kind === "property" && entry.name === "type" && entry.value === "classicReport"
    ))
      omit("type", "nextAndPreviousLinks", paginationDefaultRule);
    if (node.kind === "group" && node.name === "layout" && parent?.kind === "component" && parent.name === "region") {
      const starts = property("startNewLayout");
      if (!starts.length || starts.length === 1 && starts[0].kind === "property" && starts[0].value === "false")
        omit("startNewRow", "true", regionDefaultRule);
    }
    if (node.kind === "group" && node.name === "chart" && parent?.kind === "component" && parent.name === "region" && parent.children.some(
      (entry) => entry.kind === "property" && entry.name === "type" && entry.value === "chart"
    ))
      omit("type", "bar", chartDefaultRule);
    const identities = node.children.filter((entry) => entry.kind !== "literal").map(
      (entry) => entry.kind + ":" + ("name" in entry ? entry.name : "") + ":" + ("key" in entry ? entry.key : "")
    );
    if (new Set(identities).size !== identities.length) throw new Error("Duplicate structural identity.");
    const sortable = children.filter(
      (entry) => entry.kind === "component" && (node.name === "page" && entry.name === "region" || node.name === "region" && node.children.some(
        (child) => child.kind === "property" && child.name === "type" && child.value === "chart"
      ) && ["axis", "series"].includes(entry.name) || node.name === "region" && node.children.some(
        (child) => child.kind === "property" && child.name === "type" && child.value === "classicReport"
      ) && entry.name === "column")
    );
    if (sortable.length > 1) {
      const sequence = (entry) => {
        if (!("children" in entry)) return void 0;
        if (entry.name === "axis") return entry.key === "x" || entry.key === "y" ? entry.key : void 0;
        const group = entry.children.find(
          (child) => child.kind === "group" && child.name === (entry.name === "series" ? "execution" : "layout")
        );
        const value = group && "children" in group ? group.children.find((child) => child.kind === "property" && child.name === "sequence") : void 0;
        return value?.kind === "property" && /^\d+$/.test(value.value) ? entry.name + ":" + value.value : void 0;
      };
      const sequences = sortable.map(sequence);
      if (sequences.every(Boolean) && new Set(sequences).size === sequences.length) {
        const sorted = [...sortable].sort(
          (left, right) => ("name" in left ? left.name : "").localeCompare("name" in right ? right.name : "") || ("key" in left ? left.key : "").localeCompare("key" in right ? right.key : "")
        );
        let index = 0;
        children = children.map((entry) => sortable.includes(entry) ? sorted[index++] : entry);
        rules.add(
          sortable.some((entry) => "name" in entry && entry.name === "column") ? columnOrderRule : orderRule
        );
      }
    }
    return { ...node, children };
  });
  return result.filter(
    (node) => !("children" in node && !node.children.length && node.kind === "group" && (parent?.name === "page" && ["security", "navigation"].includes(node.name) || parent?.name === "region" && ["chart", "layout", "pagination"].includes(node.name)))
  );
}
var identifier = /^[A-Za-z][A-Za-z0-9_$#]*$/;
function normalizeForms(nodes, rules, parent) {
  const result = [];
  for (const node of nodes) {
    if (node.kind === "property") {
      if (node.literal !== void 0) {
        const lines = node.literal.split(/\r\n|\r|\n/);
        const content = lines.length === 4 && lines[3] === "" ? lines[1] : void 0;
        if (content !== void 0 && content.startsWith(node.indent ?? "") && lines[2] === "```") {
          result.push({
            kind: "property",
            name: node.name,
            value: JSON.stringify(content.slice((node.indent ?? "").length))
          });
          rules.add(quotedLiteralRule);
          continue;
        }
        result.push(node);
        continue;
      }
      if (/^".*"$/.test(node.value)) {
        try {
          const decoded = JSON.parse(node.value);
          if (typeof decoded === "string" && JSON.stringify(decoded) !== node.value) {
            result.push({ ...node, value: JSON.stringify(decoded) });
            continue;
          }
        } catch {
        }
      }
      if (parent?.kind === "group" && parent.name === "invoke" && ["package", "procedureOrFunction"].includes(node.name) && identifier.test(node.value)) {
        if (node.value !== node.value.toUpperCase()) rules.add(invokeCaseRule);
        result.push({ ...node, value: node.value.toUpperCase() });
        continue;
      }
      result.push(node);
      continue;
    }
    if (!("children" in node)) {
      result.push(node);
      continue;
    }
    let children = normalizeForms(node.children, rules, node);
    const scalar = (name) => {
      const matches = children.filter((entry) => entry.kind === "property" && entry.name === name);
      return matches.length === 1 && matches[0].kind === "property" ? matches[0] : void 0;
    };
    if (node.kind === "group" && node.name === "parameter" && parent?.kind === "component" && parent.name === "parameter") {
      for (const [name, value] of [
        ["direction", "in"],
        ["dataType", "varchar2"],
        ["ignoreOutput", "false"]
      ]) {
        const entry = scalar(name);
        if (entry?.kind === "property" && entry.value === value) {
          children = children.filter((child) => child !== entry);
          rules.add(invokeDefaultRule);
        }
      }
      if (!children.length) {
        rules.add(invokeDefaultRule);
        continue;
      }
    }
    if (node.kind === "group" && node.name === "when" && parent?.kind === "component" && parent.name === "dynamicAction") {
      const event = scalar("event"), selection = scalar("selectionType");
      if (event?.kind === "property" && event.value === "change" && selection?.kind === "property" && selection.value === "items") {
        children = children.filter((child) => child !== event);
        rules.add(eventDefaultRule);
      }
    }
    if (node.kind === "group" && node.name === "lov" && parent?.kind === "component" && parent.name === "pageItem" && parent.children.some(
      (entry) => entry.kind === "property" && entry.name === "type" && entry.value === "selectList"
    )) {
      const entry = scalar("displayNullValue");
      if (entry?.kind === "property" && entry.value === "true") {
        children = children.filter((child) => child !== entry);
        rules.add(lovNullDefaultRule);
      }
    }
    if (node.kind === "group" && node.name === "behavior" && parent?.kind === "component" && parent.name === "button") {
      const entry = scalar("action");
      if (entry?.kind === "property" && entry.value === "submitPage") {
        children = children.filter((child) => child !== entry);
        rules.add(buttonActionDefaultRule);
        if (!children.length) continue;
      }
    }
    result.push({ ...node, children });
  }
  return result;
}
function dropAssignedIdentifiers(expected, actual, rules) {
  const group = (node, name) => node && "children" in node ? node.children.filter((child) => child.kind === "group" && child.name === name) : [];
  const identifier2 = (process2) => group(process2, "advanced").flatMap(
    (advanced) => "children" in advanced ? advanced.children.filter(
      (child) => child.kind === "property" && child.name === "executionMappingIdentifier"
    ) : []
  );
  return actual.map((page) => {
    if (!("children" in page) || page.kind !== "component" || page.name !== "page") return page;
    const reviewedPages = expected.filter(
      (node) => "children" in node && node.kind === "component" && node.name === "page" && node.key === page.key
    );
    if (reviewedPages.length !== 1) return page;
    const reviewedPage = reviewedPages[0];
    return {
      ...page,
      children: page.children.map((process2) => {
        if (!("children" in process2) || process2.kind !== "component" || process2.name !== "process")
          return process2;
        const reviewed = reviewedPage.children.filter(
          (node) => "children" in node && node.kind === "component" && node.name === "process" && node.key === process2.key
        );
        const assigned = identifier2(process2);
        if (reviewed.length !== 1 || identifier2(reviewed[0]).length || assigned.length !== 1 || assigned[0].kind !== "property" || !/^\d+$/.test(assigned[0].value))
          return process2;
        rules.add(assignedIdentifierRule);
        return {
          ...process2,
          children: process2.children.map(
            (child) => "children" in child && child.kind === "group" && child.name === "advanced" ? { ...child, children: child.children.filter((entry) => entry !== assigned[0]) } : child
          ).filter(
            (child) => !("children" in child && child.kind === "group" && child.name === "advanced" && !child.children.length)
          )
        };
      })
    };
  });
}
var sequencedComponents = {
  page: {
    region: ["layout", "sequence"],
    pageItem: ["layout", "sequence"],
    button: ["layout", "sequence"],
    dynamicAction: ["execution", "sequence"],
    validation: ["execution", "sequence"],
    process: ["execution", "sequence"],
    computation: ["execution", "sequence"],
    branch: ["execution", "sequence"]
  },
  process: { parameter: ["advanced", "displaySequence"] },
  dynamicAction: { action: ["execution", "sequence"] }
};
var componentKey = (node) => ("name" in node ? node.name : "") + ":" + ("key" in node ? node.key : "");
function orderComponents(nodes, rules) {
  return nodes.map((node) => {
    if (!("children" in node)) return node;
    let children = orderComponents(node.children, rules);
    const allowed = node.kind === "component" ? sequencedComponents[node.name] : void 0;
    const components = children.filter((child) => child.kind === "component");
    if (allowed && components.length > 1) {
      const qualified = components.every((child) => {
        if (child.kind !== "component" || !allowed[child.name]) return false;
        const [groupName, propertyName] = allowed[child.name];
        const group = child.children.find((entry) => entry.kind === "group" && entry.name === groupName);
        return !!group && "children" in group && group.children.some(
          (entry) => entry.kind === "property" && entry.name === propertyName && /^\d+$/.test(entry.value)
        );
      });
      const keys = components.map(componentKey);
      if (qualified && new Set(keys).size === keys.length) {
        const sorted = [...components].sort(
          (left, right) => componentKey(left).localeCompare(componentKey(right))
        );
        if (sorted.some((child, index2) => child !== components[index2])) rules.add(componentOrderRule);
        let index = 0;
        children = children.map((child) => child.kind === "component" ? sorted[index++] : child);
      }
    }
    return { ...node, children };
  });
}
function orderMembers(nodes, rules) {
  return nodes.map((node) => {
    if (!("children" in node)) return node;
    let children = orderMembers(node.children, rules);
    if (!children.some((child) => child.kind === "literal")) {
      const members = children.filter((child) => child.kind !== "component");
      const names = members.map((child) => child.kind + ":" + ("name" in child ? child.name : ""));
      if (new Set(names).size === names.length) {
        const sorted = [...members].sort(
          (left, right) => (left.kind + ":" + ("name" in left ? left.name : "")).localeCompare(
            right.kind + ":" + ("name" in right ? right.name : "")
          )
        );
        if (sorted.some((child, index) => child !== members[index])) rules.add(memberOrderRule);
        children = [...sorted, ...children.filter((child) => child.kind === "component")];
      }
    }
    return { ...node, children };
  });
}
function compareApexlangSource(expected, actual) {
  if (expected === actual) return { equivalent: true, rules: [] };
  try {
    const left = readStructure(expected), right = readStructure(actual);
    if (canonical(left) === canonical(right)) return { equivalent: true, rules: [formattingRule] };
    if (canonical(removeQualifiedDefault(left)) === canonical(removeQualifiedDefault(right)))
      return { equivalent: true, rules: [formattingRule, defaultRule] };
    const rules = /* @__PURE__ */ new Set();
    if (canonical(left) !== canonical(removeQualifiedDefault(left)) || canonical(right) !== canonical(removeQualifiedDefault(right)))
      rules.add(defaultRule);
    if (canonical(normalizeExport(removeQualifiedDefault(left), rules)) === canonical(normalizeExport(removeQualifiedDefault(right), rules)))
      return { equivalent: true, rules: [formattingRule, ...rules] };
    const formRules = new Set(rules);
    const normalized = (nodes) => orderComponents(
      orderMembers(
        normalizeExport(normalizeForms(removeQualifiedDefault(nodes), formRules), formRules),
        formRules
      ),
      formRules
    );
    if (canonical(normalized(left)) === canonical(normalized(right)))
      return { equivalent: true, rules: [formattingRule, ...formRules] };
    const assignedRules = new Set(formRules);
    if (canonical(normalized(left)) === canonical(normalized(dropAssignedIdentifiers(left, right, assignedRules))))
      return { equivalent: true, rules: [formattingRule, ...assignedRules] };
    return {
      equivalent: false,
      rules: [],
      reason: "Source differs beyond the qualified formatting/default rules."
    };
  } catch (error) {
    return {
      equivalent: false,
      rules: [],
      reason: error instanceof Error ? error.message : "Source form is unsupported."
    };
  }
}
async function compareApplicationExports(expectedRoot, actualRoot, expectedFiles, actualFiles, allowedFiles) {
  const allowed = new Set(allowedFiles);
  const result = {
    equivalent: true,
    policy: APEXLANG_EQUIVALENCE_POLICY,
    normalizations: [],
    mismatchedFiles: [],
    mismatches: []
  };
  for (const file of [.../* @__PURE__ */ new Set([...Object.keys(expectedFiles), ...Object.keys(actualFiles)])].sort()) {
    if (expectedFiles[file] === actualFiles[file]) continue;
    let reason = "File bytes differ outside the selected APEXlang normalization scope.";
    if (expectedFiles[file] && actualFiles[file] && allowed.has(file) && path3.posix.extname(file) === ".apx") {
      const [expected, actual] = await Promise.all([
        readFile(await contained(expectedRoot, file)),
        readFile(await contained(actualRoot, file))
      ]);
      if (hash(expected) !== expectedFiles[file] || hash(actual) !== actualFiles[file])
        reason = "Source changed during readback comparison.";
      else {
        const decoder = new TextDecoder("utf-8", { fatal: true });
        let comparison;
        try {
          comparison = compareApexlangSource(decoder.decode(expected), decoder.decode(actual));
        } catch {
          comparison = { equivalent: false, rules: [], reason: "Source is not valid UTF-8." };
        }
        if (comparison.equivalent) {
          result.normalizations.push({
            file,
            expectedSha256: expectedFiles[file],
            actualSha256: actualFiles[file],
            rules: comparison.rules
          });
          continue;
        }
        reason = comparison.reason ?? reason;
      }
    }
    result.equivalent = false;
    result.mismatchedFiles.push(file);
    result.mismatches.push({ file, reason });
  }
  return result;
}

// packages/core/src/partial-import.ts
var importSelectionSchema = external_exports.strictObject({
  requestedMode: external_exports.enum(["auto", "full", "files"]),
  resolvedMode: external_exports.enum(["full", "files"]),
  files: external_exports.array(relativePath),
  reasons: external_exports.array(external_exports.string()),
  dependencies: external_exports.array(relativePath),
  before: snapshotSchema.nullable(),
  effective: snapshotSchema.nullable(),
  capabilities: external_exports.record(external_exports.string(), external_exports.unknown()),
  readbackPolicy: external_exports.literal(APEXLANG_EQUIVALENCE_POLICY).optional(),
  exportScope: external_exports.enum(["selected", "full"]).optional()
});
function importOptions(value = {}) {
  const mode = value.importMode ?? "auto";
  if ((value.files?.length ?? 0) > 1e3)
    throw new Fault("INVALID_INPUT", "Select at most 1000 files in one import.", 2);
  if (!["auto", "full", "files", "none"].includes(mode))
    throw new Fault("INVALID_INPUT", "Unknown import mode.", 2);
  if (mode === "files" !== !!value.files?.length)
    throw new Fault(
      "INVALID_INPUT",
      "files mode requires a nonempty file list; other modes do not accept files.",
      2
    );
  const files = (value.files ?? []).map((file) => {
    if (!relativePath.safeParse(file).success || /[\\*?\[\]]/.test(file) || /^[A-Za-z]:/.test(file) || file.startsWith("-") || path4.posix.normalize(file) !== file || file === ".")
      throw new Fault(
        "IMPORT_FILE_UNSAFE",
        "Use normalized application-relative file paths without globs.",
        2
      );
    return file;
  });
  if (new Set(files).size !== files.length)
    throw new Fault("IMPORT_FILE_UNSAFE", "Duplicate import files are not allowed.", 2);
  return { importMode: mode, files: files.sort() };
}
async function sourceRelease(root) {
  try {
    const value = await readJson(path4.join(root, ".apex/apexlang.json"));
    return typeof value.mmdVersion === "string" ? value.mmdVersion.match(/^\d+\.\d+/)?.[0] ?? null : null;
  } catch {
    return null;
  }
}
function supportedFile(file) {
  return /^pages\/p\d{5}[-\w]*\.apx$/.test(file) || /^shared-components\/.+\.apx$/.test(file) && !/(?:^|\/)(?:themes?|templates?|plugins?|plug-ins?|static-files|files|authentications?|authorizations?)(?:[/.]|$)/i.test(
    file
  );
}
function scopedExportFile(file) {
  return /^pages\/p\d{5}[-\w]*\.apx$/.test(file);
}
function pickFiles(files, selected) {
  return Object.fromEntries(selected.filter((file) => files[file]).map((file) => [file, files[file]]));
}
async function overlaySelection(source, exported, files, destination) {
  await privateCopy(source, destination);
  const observed = await inventory(exported);
  for (const file of files) {
    const target = await contained(destination, file);
    if (!observed[file]) await rm2(target, { force: true });
    else {
      await mkdir3(path4.dirname(target), { recursive: true, mode: 448 });
      await cp2(await contained(exported, file), target);
    }
  }
  return destination;
}
function changedFiles(before, after) {
  return [.../* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)])].filter((file) => before[file] !== after[file]).sort();
}
function selectImport(base, local, remote, options) {
  const requested = importOptions(options);
  const localChanges = changedFiles(base, local);
  const remoteChanges = changedFiles(base, remote);
  const selected = requested.importMode === "files" ? requested.files : localChanges;
  for (const file of selected)
    if (!Object.hasOwn(local, file) && requested.importMode === "files")
      throw new Fault("IMPORT_FILE_MISSING", `Selected file is missing: ${file}`, 2);
  const conflicts = localChanges.filter(
    (file) => remoteChanges.includes(file) && local[file] !== remote[file]
  );
  if (conflicts.length)
    throw new Fault(
      "IMPORT_CONFLICT",
      `Local and server changes overlap; reconcile before planning: ${conflicts.join(", ")}`,
      5,
      "blocked",
      { conflicts }
    );
  const reasons = [];
  if (selected.some((file) => !Object.hasOwn(local, file))) reasons.push("deleted-files-require-full-import");
  if (selected.some((file) => !supportedFile(file))) reasons.push("unsupported-component-files");
  const files = selected.filter((file) => local[file] !== remote[file]);
  if (!files.length) reasons.push("no-changed-files");
  const effective = { ...remote };
  for (const file of files) {
    if (local[file]) effective[file] = local[file];
    else delete effective[file];
  }
  return { files, reasons, remoteChanges, effective: Object.fromEntries(Object.entries(effective).sort()) };
}
async function persistSnapshot(ctx, source, directory) {
  const destination = await syncPath(ctx, directory);
  await mkdir3(path4.dirname(destination), { recursive: true, mode: 448 });
  await privateCopy(source, destination);
  const files = await inventory(destination);
  return { directory, files, digest: hash(canonical(files)) };
}
async function stageSelection(ctx, before, localRoot, files, expected, directory) {
  const root = await syncPath(ctx, directory);
  await mkdir3(path4.dirname(root), { recursive: true, mode: 448 });
  await privateCopy(await syncPath(ctx, before.directory), root);
  for (const file of files) {
    const destination = await contained(root, file);
    await mkdir3(path4.dirname(destination), { recursive: true, mode: 448 });
    await cp2(await contained(localRoot, file), destination);
  }
  const actual = await inventory(root);
  if (canonical(actual) !== canonical(expected))
    throw new Fault("SOURCE_DRIFT", "Source changed while preparing the selected import.", 5);
  return { directory, files: actual, digest: hash(canonical(actual)) };
}
async function rebaseAfterImport(ctx, runId, reviewedLocal, before, server, selected) {
  await checkSnapshot(ctx, server);
  const localRoot = await syncPath(ctx, ctx.config.application.sourceDir);
  if (canonical(await inventory(localRoot)) !== canonical(reviewedLocal))
    throw new Fault(
      "LOCAL_RECONCILIATION_REQUIRED",
      "Import confirmed; local files changed during execution. Reconcile them before another import.",
      5
    );
  const base = ".apexrest/deployments/" + runId;
  const replacement = await syncPath(ctx, base + "/rebased-source");
  const retained = await syncPath(ctx, base + "/local-before-rebase");
  await privateCopy(localRoot, replacement);
  const remoteOnly = changedFiles(before, server.files).filter(
    (file) => selected.includes(file) || reviewedLocal[file] === before[file]
  );
  for (const file of /* @__PURE__ */ new Set([...remoteOnly, ...selected])) {
    const destination = await contained(replacement, file);
    if (!server.files[file]) await rm2(destination, { force: true });
    else {
      await mkdir3(path4.dirname(destination), { recursive: true });
      await cp2(await contained(await syncPath(ctx, server.directory), file), destination);
    }
  }
  if (canonical(await inventory(localRoot)) !== canonical(reviewedLocal))
    throw new Fault(
      "LOCAL_RECONCILIATION_REQUIRED",
      "Import confirmed; concurrent local edits prevented rebase.",
      5
    );
  await rename2(localRoot, retained);
  if (canonical(await inventory(retained)) !== canonical(reviewedLocal)) {
    await rename2(retained, localRoot);
    throw new Fault(
      "LOCAL_RECONCILIATION_REQUIRED",
      "Import confirmed; concurrent local edits were preserved.",
      5
    );
  }
  try {
    await rename2(replacement, localRoot);
  } catch (error) {
    await rename2(retained, localRoot);
    throw error;
  }
}

// packages/core/src/project.ts
import path14 from "node:path";
import { cp as cp4, mkdir as mkdir6, lstat as lstat3, readdir as readdir6, writeFile, mkdtemp as mkdtemp2, rm as rm6, rename as rename4 } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// packages/core/src/oracle.ts
var oracle_exports = {};
__export(oracle_exports, {
  OracleAdapter: () => OracleAdapter,
  SCRIPT_RESTRICT_LEVEL: () => SCRIPT_RESTRICT_LEVEL,
  compilerDetails: () => compilerDetails,
  compilerFault: () => compilerFault,
  compilerSucceeded: () => compilerSucceeded,
  diagnosticHint: () => diagnosticHint,
  installSources: () => installSources,
  jsonDocuments: () => jsonDocuments,
  missingSavedConnection: () => missingSavedConnection,
  oracleDiagnostics: () => oracleDiagnostics,
  parseCompilerDiagnostics: () => parseCompilerDiagnostics,
  parseStatementMs: () => parseStatementMs,
  resetCapabilityCache: () => resetCapabilityCache,
  sqlLiteral: () => sqlLiteral,
  sqlclToken: () => sqlclToken,
  targetIdentitySql: () => targetIdentitySql
});

// packages/core/src/contract-hints.ts
import path6 from "node:path";
import { readdir as readdir4, readFile as readFile4 } from "node:fs/promises";

// packages/core/src/component-examples.ts
import path5 from "node:path";
import { readdir as readdir3, readFile as readFile3 } from "node:fs/promises";

// packages/core/src/reference-index.ts
var referenceWords = (text) => text.replace(/([a-z\d])([A-Z])/g, "$1 $2").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
function buildReferencePostings(entries) {
  const postings = /* @__PURE__ */ Object.create(null);
  entries.forEach((entry, position) => {
    for (const word of new Set(referenceWords(entry.id + " " + (entry.title ?? "") + " " + entry.text)))
      (postings[word] ??= []).push(position);
  });
  return postings;
}
var stopwords = /* @__PURE__ */ new Set(["a", "an", "the", "for", "with", "and", "of", "to", "in", "on", "by"]);
var cyrillic = /^[Ѐ-ӿ]+$/u;
var ukrainianSuffixes = [
  "\u0430\u043C\u0438",
  "\u044F\u043C\u0438",
  "\u043E\u0432\u0456",
  "\u0435\u0432\u0456",
  "\u043E\u0433\u043E",
  "\u043E\u043C\u0443",
  "\u0438\u043C\u0438",
  "\u0456\u043C\u0438",
  "\u0456\u0441\u0442\u044C",
  "\u044F\u0445",
  "\u0430\u0445",
  "\u0456\u0432",
  "\u0457\u0432",
  "\u0430\u043C",
  "\u044F\u043C",
  "\u043E\u044E",
  "\u0435\u044E",
  "\u0454\u044E",
  "\u043E\u043C",
  "\u0435\u043C",
  "\u0438\u0439",
  "\u0456\u0439",
  "\u043E\u0457",
  "\u0438\u0445",
  "\u0456\u0445",
  "\u0430",
  "\u044F",
  "\u0443",
  "\u044E",
  "\u0456",
  "\u0438",
  "\u0435",
  "\u0454",
  "\u043E",
  "\u044C",
  "\u0439"
];
function referenceStem(word) {
  if (cyrillic.test(word)) {
    if (word.length < 4) return word;
    for (const suffix of ukrainianSuffixes)
      if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length);
    return word;
  }
  if (word.length < 4 || /\d$/.test(word)) return word;
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (/(?:x|ch|sh|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !/(?:ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}
var referenceTerms = (text) => referenceWords(text).filter((word) => !stopwords.has(word));
var referenceStems = (text) => referenceTerms(text).map(referenceStem);
var stemmedReference = (text) => " " + referenceStems(text).join(" ") + " ";
var aliases = {
  textarea: [["text", "area"]],
  textfield: [["text", "field"]],
  textbox: [["text", "field"]],
  datepicker: [["date", "picker"]],
  dropdown: [["select", "list"]],
  combo: [["combobox"]],
  toggle: [["switch"]],
  graph: [["chart"]],
  lov: [["list", "value"]],
  ir: [["interactive", "report"]],
  ig: [["interactive", "grid"]],
  da: [["dynamic", "action"]],
  nav: [["navigation"]],
  auth: [["authentication"], ["authorization"]],
  javascript: [["java", "script"]],
  plsql: [["pl", "sql"]],
  \u043A\u043D\u043E\u043F\u043A: [["button"]],
  \u0441\u0442\u043E\u0440\u0456\u043D\u043A: [["page"]],
  \u0444\u043E\u0440\u043C: [["form"]],
  \u0434\u0456\u0430\u0433\u0440\u0430\u043C: [["chart"]],
  \u0433\u0440\u0430\u0444\u0456\u043A: [["chart"]],
  \u0437\u0432\u0456\u0442: [["report"]],
  \u0456\u043D\u0442\u0435\u0440\u0430\u043A\u0442\u0438\u0432\u043D: [["interactive"]],
  \u043A\u0430\u0440\u0442\u043A: [["card"]],
  \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440: [["calendar"]],
  \u043F\u0435\u0440\u0435\u043C\u0438\u043A\u0430\u0447: [["switch"]],
  \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A: [["validation"]],
  \u0432\u0430\u043B\u0456\u0434\u0430\u0446\u0456: [["validation"]],
  \u043F\u0440\u043E\u0446\u0435\u0441: [["process"]],
  \u043E\u0431\u0447\u0438\u0441\u043B\u0435\u043D\u043D: [["computation"]],
  \u0434\u0438\u043D\u0430\u043C\u0456\u0447\u043D: [["dynamic"]],
  \u0434\u0456\u044F: [["action"]],
  \u0434\u0456\u0457: [["action"]],
  \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0456: [["authorization"]],
  \u0430\u0432\u0442\u0435\u043D\u0442\u0438\u0444\u0456\u043A\u0430\u0446\u0456: [["authentication"]],
  \u043D\u0430\u0432\u0456\u0433\u0430\u0446\u0456: [["navigation"]],
  \u043C\u0435\u043D\u044E: [["menu"]],
  \u0440\u0435\u0433\u0456\u043E\u043D: [["region"]],
  \u0444\u0430\u0441\u0435\u0442\u043D: [["faceted"]],
  \u043F\u043E\u0448\u0443\u043A: [["search"]],
  \u043C\u043E\u0434\u0430\u043B\u044C\u043D: [["modal"]],
  \u0432\u0456\u043A\u043D: [["dialog"]],
  \u0434\u0456\u0430\u043B\u043E\u0433: [["dialog"]],
  \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043D: [["upload"]],
  \u0444\u0430\u0439\u043B: [["file"]],
  \u0434\u0430\u0442: [["date"]],
  \u0442\u0435\u043A\u0441\u0442: [["text"]],
  \u043F\u043E\u043B: [["field"]],
  \u043F\u0440\u0438\u0445\u043E\u0432\u0430\u043D: [["hidden"]],
  \u0435\u043B\u0435\u043C\u0435\u043D\u0442: [["item"]],
  \u0441\u043F\u0438\u0441\u043E\u043A: [["list"]],
  \u0441\u043F\u0438\u0441\u043A: [["list"]],
  \u0437\u043D\u0430\u0447\u0435\u043D\u043D: [["value"]],
  \u0441\u0442\u0430\u0442\u0438\u0447\u043D: [["static"]],
  \u0432\u043C\u0456\u0441\u0442: [["content"]],
  \u0441\u0456\u0442\u043A: [["grid"]],
  \u0433\u0440\u0456\u0434: [["grid"]],
  \u0440\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u043D\u043D: [["edit"]],
  \u0440\u0435\u0434\u0430\u0433\u043E\u0432\u0430\u043D: [["editable"]],
  \u0432\u0438\u0431\u0456\u0440: [["select"]],
  \u043F\u0435\u0440\u0435\u0445\u0456\u0434: [["redirect"], ["branch"]],
  \u0433\u0456\u043B\u043A: [["branch"]],
  \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D: [["refresh"]],
  \u043F\u043E\u043A\u0430\u0437\u043D\u0438\u043A: [["metric"]],
  \u043F\u0430\u043D\u0435\u043B: [["dashboard"], ["panel"]],
  \u0433\u043E\u043B\u043E\u0432\u043D: [["home"]],
  \u0432\u0445\u0456\u0434: [["login"]],
  \u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D: [["global"]],
  \u043F\u0456\u043A\u0442\u043E\u0433\u0440\u0430\u043C: [["icon"]],
  \u0456\u043A\u043E\u043D\u043A: [["icon"]],
  \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A: [["title"]],
  \u043A\u043E\u043B\u043E\u043D\u043A: [["column"]],
  \u0441\u0442\u043E\u0432\u043F\u0447\u0438\u043A: [["bar"]],
  \u043B\u0456\u043D\u0456\u0439\u043D: [["line"]],
  \u043A\u0440\u0443\u0433\u043E\u0432: [["pie"]],
  \u043C\u0430\u043F: [["map"]],
  \u043A\u0430\u0440\u0442: [["map"]],
  \u0441\u0435\u043A\u0446\u0456: [["section"]],
  \u0432\u0432\u0435\u0434\u0435\u043D\u043D: [["entry"], ["data", "entry"]]
};
function referenceQueryTerms(query, limit2 = 16) {
  const seen = /* @__PURE__ */ new Set();
  const terms = [];
  for (const stem of referenceStems(query)) {
    if (seen.has(stem)) continue;
    seen.add(stem);
    terms.push({ stem, alternatives: [[stem], ...aliases[stem] ?? []] });
    if (terms.length === limit2) break;
  }
  return terms;
}
var queryPhrase = (terms) => " " + terms.map((term) => term.stem).join(" ") + " ";
var routingPattern = /(?:^|[._/])_(?:index|common|shared|template_options|configuration-modules|common_variables)\b|(?:^|\/)README$/;
var routingReference = (id, title) => routingPattern.test(id) || routingPattern.test(title);
var navigationalWords = /* @__PURE__ */ new Set([
  "index",
  "common",
  "readme",
  "routing",
  "contract",
  "contracts",
  "load",
  "order"
]);
var navigationalQuery = (query) => /[:/]/.test(query.trim()) || referenceWords(query).some((word) => navigationalWords.has(word));
function primaryCodeBlock(text, limit2 = 2500) {
  const lines = text.split("\n");
  const blocks2 = [];
  let open4;
  for (const line of lines) {
    if (open4) {
      const close = line.match(/^(\s*)(`{3,}|~{3,})\s*$/);
      if (close && close[1] === open4.indent && close[2][0] === open4.fence[0] && close[2].length >= open4.fence.length) {
        blocks2.push({ language: open4.language, lines: open4.lines });
        open4 = void 0;
      } else open4.lines.push(line.startsWith(open4.indent) ? line.slice(open4.indent.length) : line);
      continue;
    }
    const start = line.match(/^(\s*)(`{3,}|~{3,})\s*([\w.+-]*)\s*$/);
    if (start) open4 = { indent: start[1], fence: start[2], language: start[3].toLowerCase(), lines: [] };
  }
  const chosen = blocks2.find((block) => block.language === "apexlang") ?? blocks2.find((block) => !block.language) ?? blocks2.sort((a, b) => b.lines.join("\n").length - a.lines.join("\n").length)[0];
  if (!chosen) return null;
  const full = chosen.lines.join("\n");
  if (!full.trim()) return null;
  return boundCode({ language: chosen.language, text: full, truncated: false, length: full.length }, limit2);
}
function boundCode(code, limit2) {
  if (code.text.length <= limit2) return code;
  const cut = code.text.lastIndexOf("\n", limit2);
  return { ...code, text: code.text.slice(0, cut > limit2 / 2 ? cut : limit2), truncated: true };
}
function codeWanted(include, offset, position) {
  return include === "code" || include !== "metadata" && offset === 0 && position === 0;
}
var CODE_LIMIT = 2500;
var SEARCH_LINKS = 3;
function fitResults(results, budget, size) {
  const halve = (hit, floor) => {
    if (typeof hit.text !== "string" || hit.text.length <= floor) return false;
    const next = Math.floor(hit.text.length / 2);
    hit.text = hit.text.slice(0, Math.max(floor, next));
    return true;
  };
  const shrinkCode = (hit, floor) => {
    if (!hit.code || hit.code.text.length <= floor) return false;
    hit.code = boundCode(hit.code, Math.max(floor, Math.floor(hit.code.text.length / 2)));
    return true;
  };
  while (size(results) > budget) {
    if (results.slice(1).some((hit) => halve(hit, 300))) continue;
    if (results.some((hit) => shrinkCode(hit, 600))) continue;
    if (results.slice(1).some((hit) => "relatedReferences" in hit && delete hit.relatedReferences)) continue;
    if (results.slice(1).some((hit) => "requiresReferences" in hit && delete hit.requiresReferences))
      continue;
    if (results.some((hit) => halve(hit, 100))) continue;
    if (results.some((hit) => hit.code && delete hit.code)) continue;
    break;
  }
  return results;
}
var identifierQuery = (query) => /^[A-Za-z][\w.:/-]*$/.test(query.trim()) && /[a-z][A-Z]|[-_.:/]/.test(query.trim());
var canonicalPattern = /[._/](?:standard|basic|minimal|example|default)(?:-[a-z-]+)?$|\/recipes\/basic$/;
var canonicalReference = (id) => canonicalPattern.test(id);
var lengthPenalty = (length) => Math.min(150, Math.max(0, Math.log2(length / 2e3)) * 25);
function scoreReference(input) {
  const { terms, matched } = input;
  if (matched * 2 < terms.length && !input.exact) return null;
  let titleHits = 0;
  let titleOrder = 0;
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    let hit = false;
    for (const alternative of term.alternatives) {
      hit = true;
      for (const stem of alternative) if (!input.titleStems.has(stem)) hit = false;
      if (hit) break;
    }
    if (hit) {
      titleHits++;
      titleOrder += 50 + 10 * (terms.length - i);
    }
  }
  const coverage = matched / terms.length;
  let score = (input.exact ? 1e4 : 0) + (input.titleText === input.phrase || input.titleText.startsWith(input.phrase) ? input.titleWeight : 0) + (input.titleText.includes(input.phrase) ? 400 : 0) + titleOrder + (titleHits === terms.length ? 200 : 0) + 300 * coverage * coverage + (input.quoted ? 150 : 0) + input.prior + // Routing documents sink below concrete templates unless the query asks for them.
  (input.routing ? input.navigational ? 150 : -250 : 0) + (input.canonical && !input.navigational ? 60 : 0) - lengthPenalty(input.length) + 1 / (1 + input.length / 1e3);
  if (input.bodyText && terms.length) {
    const body = input.bodyText();
    if (body.includes(input.phrase)) score += 40;
    for (let i = 1; i < terms.length; i++)
      if (body.includes(" " + terms[i - 1].stem + " " + terms[i].stem + " ")) score += 60;
  }
  return score;
}

// packages/core/src/component-examples.ts
var MIN_BLOCK = 250;
var MAX_BLOCK = 4e3;
var KEEP = 8;
var TYPE_LINE = /^\s*type: (?:[A-Za-z]+\/)?([A-Za-z][A-Za-z0-9]*)\s*$/u;
var SOURCE_TYPES = /* @__PURE__ */ new Set([
  "sql",
  "query",
  "plsql",
  "function",
  "body",
  "expression",
  "static",
  "table",
  "local",
  "item",
  "page",
  "region",
  "none",
  "default",
  "code"
]);
var OPENER = /^(\s*)([a-z][A-Za-z]*)\b.*\($/u;
var USAGE_KINDS = /* @__PURE__ */ new Set([
  "region",
  "pageItem",
  "button",
  "process",
  "dynamicAction",
  "validation",
  "branch"
]);
var MAX_VALUES = 32;
var examples;
var indent = (line) => line.length - line.trimStart().length;
function sourceOf(document) {
  const begin = document.indexOf("````apexlang\n");
  if (begin < 0) return void 0;
  const end = document.indexOf("\n````", begin + 13);
  return end < 0 ? void 0 : document.slice(begin + 13, end);
}
function* blocks(lines) {
  for (const [start, line] of lines.entries()) {
    const opener = OPENER.exec(line.trimEnd());
    if (!opener) continue;
    const depth = opener[1].length;
    let end = start + 1;
    while (end < lines.length && !(lines[end].trim() === ")" && indent(lines[end]) === depth)) end += 1;
    if (end >= lines.length) continue;
    let type;
    for (let at = start + 1; at < end && !type; at += 1)
      if (indent(lines[at]) === depth + 4) type = TYPE_LINE.exec(lines[at])?.[1];
    yield { keyword: opener[2], type, text: lines.slice(start, end + 1).join("\n") };
  }
}
function ownProperties(text) {
  const lines = text.split("\n");
  const depth = indent(lines[0]);
  const found = /* @__PURE__ */ new Map();
  let group = "";
  let skip = -1;
  for (const line of lines.slice(1, -1)) {
    const at = indent(line);
    if (!line.trim() || skip >= 0 && at > skip) continue;
    skip = -1;
    if (at === depth + 4) {
      group = /^\s*([A-Za-z]\w*) \{$/u.exec(line)?.[1] ?? "";
      if (OPENER.test(line.trimEnd())) skip = at;
    }
    const property = /^\s*([A-Za-z]\w*): (\S.*)$/u.exec(line);
    if (property && (at === depth + 4 || group && at === depth + 8))
      found.set(at === depth + 4 ? property[1] : `${group}.${property[1]}`, property[2].trimEnd());
  }
  return found;
}
function keep(index, key, example) {
  const list2 = index.get(key) ?? [];
  list2.push(example);
  list2.sort((a, b) => a.text.length - b.text.length);
  index.set(key, list2.slice(0, KEEP));
}
async function load() {
  const root = path5.join(resourceRoot(), "public-templates", "26.2", "documents");
  const index = /* @__PURE__ */ new Map();
  const usage = /* @__PURE__ */ new Map();
  let applications;
  try {
    applications = (await readdir3(root, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return { index, usage };
  }
  for (const application of applications.sort()) {
    const pages2 = (await readdir3(path5.join(root, application))).filter((f) => /^p\d+.*\.md$/u.test(f)).sort();
    for (const page of pages2) {
      const source = sourceOf(await readFile3(path5.join(root, application, page), "utf8"));
      if (!source) continue;
      const id = `oracle:26.2:public-template/${application}/${page.replace(/\.md$/u, "")}`;
      for (const block of blocks(source.split("\n"))) {
        const key = block.type ? `${block.keyword}:${block.type}` : block.keyword;
        if (USAGE_KINDS.has(block.keyword)) {
          const counted = usage.get(key) ?? { blocks: 0, properties: /* @__PURE__ */ new Map() };
          counted.blocks += 1;
          for (const [property, value] of ownProperties(block.text)) {
            const seen = counted.properties.get(property) ?? { count: 0, values: /* @__PURE__ */ new Map() };
            seen.count += 1;
            if (/^[A-Za-z][\w/-]*$/u.test(value) && (seen.values.has(value) || seen.values.size < MAX_VALUES))
              seen.values.set(value, (seen.values.get(value) ?? 0) + 1);
            counted.properties.set(property, seen);
          }
          usage.set(key, counted);
        }
        if (block.text.length < MIN_BLOCK || block.text.length > MAX_BLOCK) continue;
        const types = new Set(
          [...block.text.matchAll(/^\s*type: (?:[A-Za-z]+\/)?([A-Za-z]\w*)\s*$/gmu)].flatMap((m) => referenceStems(m[1])).filter((stem) => !SOURCE_TYPES.has(stem))
        );
        const chartType = block.keyword === "region" && block.type === "chart" ? /\n\s*chart \{\s*\n\s*type: (\w+)/u.exec(block.text)?.[1]?.toLowerCase() ?? "bar" : void 0;
        if (chartType) types.add(chartType);
        const example = {
          id,
          text: block.text,
          stems: new Set(referenceStems(block.text)),
          types,
          chartType
        };
        keep(index, key, example);
        if (block.keyword === "region" && block.type === "chart")
          for (const variant of types) keep(index, `${key}:${variant}`, example);
        if (block.type) keep(index, `*:${block.type}`, example);
      }
    }
  }
  return { index, usage };
}
async function componentUsage(kind, type) {
  examples ??= load();
  const counted = (await examples).usage.get(type ? `${kind}:${type}` : kind);
  if (!counted) return [];
  return [...counted.properties].map(([property, seen]) => {
    const values = [...seen.values].sort((a, b) => b[1] - a[1]);
    const total = values.reduce((sum, [, count]) => sum + count, 0);
    return {
      property,
      share: seen.count / counted.blocks,
      values: values.map(([value]) => value),
      dominance: total ? values[0][1] / total : 1
    };
  }).sort((a, b) => b.share - a.share);
}
async function componentExample(type, options = {}) {
  examples ??= load();
  const { index } = await examples;
  const key = type ? `${options.kind ?? "*"}:${type}` : options.kind;
  const list2 = key ? index.get(key) ?? (type ? index.get(`*:${type}`) : void 0) : void 0;
  if (!list2?.length) return void 0;
  const wanted = new Set(referenceStems(options.request ?? ""));
  const overlap = (example) => (example.chartType && wanted.has(example.chartType) ? 1e3 : 0) + [...wanted].reduce(
    (score, stem) => score + (example.types.has(stem) ? 100 : 0) + (example.stems.has(stem) ? 1 : 0),
    0
  );
  const variants = type === "chart" ? [...wanted].flatMap((stem) => index.get(`region:chart:${stem}`) ?? []) : [];
  const best = [...list2, ...variants].reduce((a, b) => overlap(b) > overlap(a) ? b : a);
  return { id: best.id, text: best.text };
}
function contractComponentType(title) {
  const name = title.split(" \u2014 ")[0].split("/").at(-1).trim();
  return /^[A-Za-z][A-Za-z0-9]*$/u.test(name) ? name : void 0;
}
function contractComponent(id) {
  const at = id.indexOf("inventory/app/page/");
  if (at < 0) return void 0;
  const segments = id.slice(at + "inventory/app/page/".length).split("/");
  const camel2 = (s) => s.replace(/-([a-z])/gu, (_m, c) => c.toUpperCase());
  const variant = segments.findIndex((s) => s === "plugin-variants" || s === "template-component");
  if (variant === 1) return { kind: camel2(segments[0]), type: camel2(segments[2]) };
  if (segments.length === 2 && segments[0] === segments[1]) return { kind: camel2(segments[0]) };
  return void 0;
}
var PAGE_PATTERNS = [
  {
    pattern: "modal form page (create, save, delete, cancel, close dialog, row processing)",
    request: [/\b(?:modal|dialog)\b/iu, /\bform\b/iu],
    contains: [
      /^\s*pageMode: modalDialog\s*$/mu,
      /^\s{4}region \S+ \(\n\s+name: .*\n\s+type: form\s*$/mu,
      /^\s*type: formAutoRowProcessing\s*$/mu,
      /^\s*type: closeDialog\s*$/mu,
      /^\s*type: formInitialization\s*$/mu,
      /^\s{4}button create \(/mu,
      /^\s{4}button delete \(/mu,
      /^\s{4}button save \(/mu,
      /^\s{4}dynamicAction /mu
    ]
  }
];
var MAX_PAGE = 9e3;
var pages;
async function loadPages() {
  const root = path5.join(resourceRoot(), "public-templates", "26.2", "documents");
  const best = /* @__PURE__ */ new Map();
  let applications;
  try {
    applications = (await readdir3(root, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return best;
  }
  for (const application of applications.sort())
    for (const page of (await readdir3(path5.join(root, application))).filter((f) => /^p\d+.*\.md$/u.test(f)).sort()) {
      const text = sourceOf(await readFile3(path5.join(root, application, page), "utf8"));
      if (!text || text.length > MAX_PAGE) continue;
      for (const { pattern, contains } of PAGE_PATTERNS) {
        if (!contains.every((re) => re.test(text))) continue;
        const current = best.get(pattern);
        if (!current || text.length < current.text.length)
          best.set(pattern, {
            id: `oracle:26.2:public-template/${application}/${page.replace(/\.md$/u, "")}`,
            text
          });
      }
    }
  return best;
}
async function pageExamples(request) {
  const wanted = PAGE_PATTERNS.filter(({ request: words }) => words.every((re) => re.test(request)));
  if (!wanted.length) return [];
  pages ??= loadPages();
  const found = await pages;
  return wanted.flatMap(({ pattern }) => {
    const page = found.get(pattern);
    return page ? [{ pattern, ...page }] : [];
  });
}

// packages/core/src/contract-hints.ts
var contracts;
var camel = (s) => s.replace(/-([a-z])/gu, (_m, c) => c.toUpperCase());
function parseContract(text, segments) {
  const kind = /^- componentType: `([^`]+)`/mu.exec(text)?.[1];
  if (!kind) return void 0;
  const at = segments.findIndex((s) => s === "plugin-variants" || s === "template-component");
  const properties = [];
  let group = "";
  for (const line of text.split("\n")) {
    const heading = /^### (\S+)/u.exec(line);
    if (heading) {
      group = line.includes("(direct group)") ? "" : heading[1];
      continue;
    }
    const property = /^- `([A-Za-z][\w]*)` — .*; (—|`.*`);\s*$/u.exec(line);
    if (!property) continue;
    const condition = property[2] === "\u2014" ? void 0 : property[2].replace(/`/gu, "").replace(/\b[A-Za-z]+\[([^\]]+)\]/gu, "$1").split(" or ").map((clause) => [...new Set(clause.split(" and "))].join(" and ")).filter((clause, i, all) => all.indexOf(clause) === i).join(" or ").slice(0, 240);
    const type = / — `(<[^`]+>)`/u.exec(line)?.[1];
    const required = /`; [^;]*; (Yes|No); /u.exec(line)?.[1];
    const enumeration = /`<enum:\[(.*?)\]>`/u.exec(line)?.[1];
    const labelled = enumeration ? [...enumeration.matchAll(/(?:^|, )([\w-]+):"/gu)].map((m) => m[1]) : void 0;
    const plain = enumeration && !labelled.length ? enumeration.split(", ") : [];
    const values = labelled?.length ? [...new Set(labelled)] : plain.every((name) => /^[A-Za-z][\w-]*$/u.test(name)) ? [...new Set(plain)] : void 0;
    properties.push({
      group,
      name: property[1],
      ...condition ? { condition } : {},
      ...type ? { type } : {},
      ...required ? { required: required === "Yes" } : {},
      ...values?.length ? { values } : {},
      .../; lovType=EVENTS; /u.test(line) ? { namedList: true } : {}
    });
  }
  const parentType = /^- appliesWhen: `[a-zA-Z]+\[identification\.type\] = ([A-Za-z]\w*)`\s*$/mu.exec(
    text
  )?.[1];
  return {
    kind,
    ...at >= 0 ? { variant: camel(segments[at + 1]) } : {},
    segments,
    ...parentType ? { parentType } : {},
    properties
  };
}
async function load2() {
  const root = path6.join(resourceRoot(), "references", "26.2", "documents", "app");
  const found = [];
  const walk = async (dir, segments) => {
    let entries;
    try {
      entries = await readdir4(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) await walk(path6.join(dir, entry.name), [...segments, entry.name]);
      else if (entry.name.endsWith(".md") && entry.name === `${segments.at(-1)}.md`) {
        const contract = parseContract(await readFile4(path6.join(dir, entry.name), "utf8"), segments);
        if (contract) found.push(contract);
      }
    }
  };
  await walk(root, []);
  return found;
}
function labels(hint) {
  return hint.replace(/^inside /u, "").split(" of ").map((part) => {
    const match = /^(\S+)(?: ([^\s(]+))?(?: \(type: ([^)]+)\))?$/u.exec(part.trim());
    if (!match) return { kind: "" };
    const type = match[3]?.split("/").at(-1);
    return { kind: match[1], ...match[2] ? { name: match[2] } : {}, ...type ? { type } : {} };
  });
}
function contractFor(all, component, parent) {
  const kebab = parent?.kind.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`);
  const pick = (matching) => parent?.type && matching.find((c) => c.parentType === parent.type) || kebab && matching.find((c) => c.segments.includes(kebab)) || matching[0];
  const variant = pick(
    all.filter(
      (c) => c.kind === component.kind && (component.type ? c.variant === component.type : !c.variant)
    )
  );
  if (variant || !component.type) return variant;
  const plain = pick(all.filter((c) => c.kind === component.kind && !c.variant));
  return plain?.properties.some((p) => !p.group && p.name === "type" && p.values?.includes(component.type)) ? plain : void 0;
}
var list = (names) => [...new Set(names)].slice(0, 30).join(", ");
async function propertyFix(type, message, hint) {
  if (type === "DUPLICATED_COMPONENT" && /executionMappingIdentifier: null/u.test(message))
    return "give every process of the page its own advanced { executionMappingIdentifier: <distinct numeric identifier> }";
  if (type.startsWith("MISSING_REQUIRED")) return missingFix(message, hint);
  if (type !== "INVALID_PROPERTY" || !hint) return void 0;
  const property = /Invalid property: ([A-Za-z]\w*)/u.exec(message)?.[1];
  if (!property) return void 0;
  try {
    contracts ??= load2();
    const all = await contracts;
    const chain = labels(hint);
    const named = chain.findIndex((label) => label.name);
    if (named < 0) return void 0;
    const group = chain.slice(0, named).map((label) => label.kind).reverse().join(".");
    if (group === "heading" && chain[named].kind === "column" && chain[named].type === "hidden" && chain[named + 1]?.type === "classicReport")
      return `remove the whole heading { \u2026 } group from column ${chain[named].name}: a hidden classicReport column takes no heading (keep layout { sequence })`;
    const contract = contractFor(all, chain[named], chain[named + 1]);
    if (!contract) return void 0;
    const where = contract.properties.filter((p) => p.name === property);
    const component = `${contract.kind}${contract.variant ? ` (type: ${contract.variant})` : ""}`;
    if (where.length) {
      const here = where.filter((p) => p.group === group);
      if (here.length && here.every((p) => p.condition))
        return `${property} applies to ${component} only when ${[...new Set(here.map((p) => p.condition))].join(" or ")}`;
      if (!here.length && new Set(where.map((p) => p.group)).size === 1)
        return `${property} belongs in ${where.map((p) => p.group ? `group ${p.group}` : "the component itself (no group)").filter((v, i, a) => a.indexOf(v) === i).join(" or ")} of ${component}${where[0].condition ? ` when ${where[0].condition}` : ""}`;
      if (here.length) return void 0;
    }
    const valid = contract.properties.filter((p) => p.group === group).map((p) => p.name);
    if (where.length)
      return `${property} is not valid in ${group || "the component itself"} of ${component}; valid there: ${list(valid)}`;
    return valid.length ? `${component} has no ${property}; ${group || "its direct properties"}: ${list(valid)}` : `${component} has no ${property} and no group ${group}; groups: ${list(contract.properties.map((p) => p.group).filter(Boolean))}`;
  } catch {
    return void 0;
  }
}
var choices = (values, limit2) => values.slice(0, limit2).join(" | ") + (values.length > limit2 ? ` | \u2026 ${values.length - limit2} more` : "");
async function missingFix(message, hint) {
  const missing = /Missing required parameter(?: \(\d+\))?: (\w+) - (\w+)(?: \((\w+)\))?/u.exec(message);
  if (!missing) return void 0;
  const group = missing[1] === "identification" ? "" : missing[1];
  const name = missing[2];
  let value = `<${missing[3] ?? "value"}>`;
  let target = "the component that starts at the reported line";
  let note = "";
  try {
    const chain = hint ? labels(hint) : [];
    const component = chain[0]?.name ? chain[0] : void 0;
    contracts ??= load2();
    const contract = component && contractFor(await contracts, component, chain[1]);
    const found = contract?.properties.filter((p) => p.group === group && p.name === name) ?? [];
    if (component && found.length) {
      target = `${component.kind} ${component.name}`;
      const used = (await componentUsage(component.kind, component.type)).find(
        (entry) => entry.property === (group ? `${group}.${name}` : name)
      );
      const values = valueList(contract, group, name, void 0, used?.values ?? []);
      const sample = (await componentExample(component.type, { kind: component.kind }))?.text.match(
        new RegExp(`^\\s*${name}: (\\S{1,80})$`, "mu")
      )?.[1];
      if (values) value = values;
      else if (sample?.startsWith("@/")) value = sample;
      else if (found[0].type) value = found[0].type;
      const condition = found.every((p) => p.condition) ? found[0].condition : "";
      if (condition && !condition.includes("= sample")) note = ` (required when ${condition.slice(0, 160)})`;
    }
  } catch {
  }
  return `add to ${target}: ${group ? `${group} { ${name}: ${value} }` : `${name}: ${value}`}${note}`;
}
function componentNote(kind) {
  return kind === "process" ? "Keep advanced { executionMappingIdentifier } on every process, a different integer for each process of the page (for example page * 100 + n): 26.2 reports DUPLICATED_COMPONENT without it." : void 0;
}
var COMMON_SHARE = 0.25;
var PARTIAL = "(most used in Oracle samples; the compiler error lists all)";
function valueList(contract, group, name, shown, sampled) {
  const defined = contract.properties.filter((p) => p.group === group && p.name === name);
  const lists = [
    ...new Map(defined.flatMap((p) => p.values ? [[p.values.join(), p.values]] : [])).values()
  ];
  if (!lists.length) {
    const used = sampled.filter((value) => !value.includes("/")).slice(0, 12);
    return defined.some((p) => p.namedList) && used.length ? `${used.join(" | ")} | \u2026 ${PARTIAL}` : void 0;
  }
  const score = (list2) => (shown && list2.includes(shown) ? 1e3 : 0) + sampled.filter((value) => list2.includes(value)).length;
  const ranked = lists.map((list2) => ({ list: list2, score: score(list2) })).sort((a, b) => b.score - a.score);
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) return void 0;
  return ranked[0].list.length > 1 ? choices(ranked[0].list, 12) : void 0;
}
async function exampleValues(text, id) {
  try {
    contracts ??= load2();
    const all = await contracts;
    const at = id?.indexOf("inventory/app/") ?? -1;
    const path15 = at < 0 ? void 0 : id.slice(at + "inventory/app/".length).split("/").slice(0, -1).join("/");
    const root = path15 === void 0 ? void 0 : all.find((c) => c.segments.join("/") === path15);
    const lines = text.split("\n");
    const indent2 = (line) => line.length - line.trimStart().length;
    const found = /* @__PURE__ */ new Map();
    const usage = /* @__PURE__ */ new Map();
    const sampled = async (label, property) => {
      const key = `${label.kind}:${label.type ?? ""}`;
      if (!usage.has(key)) usage.set(key, await componentUsage(label.kind, label.type));
      return usage.get(key).find((entry) => entry.property === property);
    };
    const stack = [];
    let first;
    for (const [i, line] of lines.entries()) {
      if (!line.trim()) continue;
      const depth = indent2(line);
      while (stack.length && stack.at(-1).depth >= depth) stack.pop();
      const parent = stack.at(-1);
      const opener = /^\s*([a-z][A-Za-z]*)(?: (\S+))? \($/u.exec(line);
      if (opener) {
        let type;
        for (let j = i + 1; j < lines.length && !type; j += 1) {
          if (lines[j].trim() && indent2(lines[j]) <= depth) break;
          if (indent2(lines[j]) === depth + 4)
            type = /^\s*type: (?:[A-Za-z]+\/)?([A-Za-z]\w*)\s*$/u.exec(lines[j])?.[1];
        }
        const label = { kind: opener[1], ...type ? { type } : {} };
        const contract = !stack.length && root ? root : contractFor(all, label, parent?.label);
        stack.push({ depth, label, contract, path: stack.length ? `${parent.path}${opener[1]}.` : "" });
        first ??= stack[0];
        continue;
      }
      if (!parent) continue;
      const group = /^\s*([A-Za-z]\w*) \{$/u.exec(line)?.[1];
      if (group) {
        stack.push({ ...parent, depth, group: parent.group ? `${parent.group}.${group}` : group });
        continue;
      }
      const property = /^\s*([A-Za-z]\w*): (\S.*)$/u.exec(line);
      if (!property || !parent.contract || property[1] === "type" && !parent.group) continue;
      const name = `${parent.group ? `${parent.group}.` : ""}${property[1]}`;
      if (found.has(parent.path + name)) continue;
      const used = await sampled(parent.label, name);
      const values = valueList(
        parent.contract,
        parent.group ?? "",
        property[1],
        property[2].trimEnd(),
        used?.values ?? []
      );
      if (values)
        found.set(parent.path + name, {
          values,
          nested: Boolean(parent.path),
          open: used ? used.share * (1 - used.dominance) : 0
        });
    }
    if (first?.contract)
      for (const entry of await componentUsage(first.label.kind, first.label.type)) {
        if (entry.share < COMMON_SHARE) break;
        const [group, name] = entry.property.split(".");
        if (!name || found.has(entry.property)) continue;
        const values = valueList(first.contract, group, name, void 0, entry.values);
        if (values)
          found.set(entry.property, { values, nested: false, open: entry.share * (1 - entry.dominance) });
      }
    const rank = (entry) => (entry.open <= 0 ? 4 : entry.nested ? 2 : 0) - (entry.values.endsWith(PARTIAL) ? 1 : entry.open);
    const ordered = [...found].sort((a, b) => rank(a[1]) - rank(b[1]));
    return ordered.length ? Object.fromEntries(ordered.map(([key, entry]) => [key, entry.values])) : void 0;
  } catch {
    return void 0;
  }
}
var SKELETON_SKIP = /* @__PURE__ */ new Set([
  "security",
  "config",
  "comments",
  "serverSideCondition",
  "help",
  "userDefinedAttributes",
  "clickCounting",
  "advanced"
]);
async function contractSkeleton(id) {
  const at = id.indexOf("inventory/app/");
  if (at < 0) return void 0;
  const segments = id.slice(at + "inventory/app/".length).split("/").slice(0, -1);
  try {
    contracts ??= load2();
    const contract = (await contracts).find((c) => c.segments.join("/") === segments.join("/"));
    if (!contract) return void 0;
    const value = (p) => p.values ? p.values.slice(0, 6).join(" | ") + (p.values.length > 6 ? " | \u2026" : "") : p.type ?? "<value>";
    const shown = contract.properties.filter((p) => !p.condition && !SKELETON_SKIP.has(p.group));
    const groups = [...new Set(shown.map((p) => p.group))];
    const lines = [`${contract.kind} <name> (`];
    for (const group of groups) {
      const members = shown.filter((p) => p.group === group);
      const rows = members.map((p) => `${p.name}: ${value(p)}${p.required ? "" : "  (optional)"}`);
      if (!group) lines.push(...rows.map((row) => `    ${row}`));
      else lines.push(`    ${group} {`, ...rows.map((row) => `        ${row}`), "    }");
    }
    lines.push(")");
    return lines.join("\n");
  } catch {
    return void 0;
  }
}

// packages/core/src/oracle.ts
import { performance as performance2 } from "node:perf_hooks";
import path13 from "node:path";
import { randomUUID as randomUUID2 } from "node:crypto";
import { cp as cp3, mkdir as mkdir5, mkdtemp, readFile as readFile7, readdir as readdir5, realpath as realpath5, rename as rename3, rm as rm5, stat as stat4 } from "node:fs/promises";

// packages/core/src/connections.ts
import path8 from "node:path";
import { chmod as chmod2, constants as constants2, lstat as lstat2, mkdir as mkdir4, open as open3, realpath as realpath3, rm as rm3, stat as stat2 } from "node:fs/promises";

// packages/core/src/local-env.ts
import path7 from "node:path";
import { constants, open as open2, realpath as realpath2 } from "node:fs/promises";
function parseLocalEnv(contents) {
  const result = /* @__PURE__ */ Object.create(null);
  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line.trim());
    if (!match || Object.hasOwn(result, match[1]))
      throw new Fault("ENV_FILE_INVALID", "The local ENV file has an invalid or duplicate entry.", 2);
    let value = match[2];
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0], end = value.lastIndexOf(quote);
      if (end === 0 || !/^\s*(?:#.*)?$/.test(value.slice(end + 1)))
        throw new Fault("ENV_FILE_INVALID", "The local ENV file has an invalid quoted entry.", 2);
      value = value.slice(1, end);
    } else value = value.replace(/\s+#.*$/, "").trimEnd();
    result[match[1]] = value;
  }
  return result;
}
async function readLocalEnv(file) {
  const requested = path7.resolve(file), physical = await realpath2(requested);
  if (requested !== physical)
    throw new Fault("ENV_FILE_UNSAFE", "Credential ENV paths cannot use symlink aliases.", 2);
  const cwd = path7.dirname(physical);
  const root = await runProcess({
    executable: "git",
    args: ["rev-parse", "--show-toplevel"],
    cwd,
    timeoutMs: 5e3
  });
  if (root.code !== 0)
    throw new Fault("ENV_FILE_UNSAFE", "Credential ENV files must belong to a Git working tree.", 2);
  const relative = path7.relative(root.stdout.trim(), physical);
  const tracked = await runProcess({
    executable: "git",
    args: ["ls-files", "--error-unmatch", "--", relative],
    cwd: root.stdout.trim(),
    timeoutMs: 5e3
  });
  const ignored = await runProcess({
    executable: "git",
    args: ["check-ignore", "-q", "--", relative],
    cwd: root.stdout.trim(),
    timeoutMs: 5e3
  });
  if (tracked.code === 0 || ignored.code !== 0)
    throw new Fault(
      "ENV_FILE_UNSAFE",
      "Credential ENV files must be ignored by Git and absent from tracked files.",
      2
    );
  const handle = await open2(physical, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 65536 || typeof process.getuid === "function" && info.uid !== process.getuid())
      throw new Fault(
        "ENV_FILE_UNSAFE",
        "Credential ENV files must be bounded regular files owned by the current user.",
        2
      );
    return parseLocalEnv(await handle.readFile("utf8"));
  } finally {
    await handle.close();
  }
}

// packages/core/src/connections.ts
var savedConnectionName = external_exports.string().min(1).max(512).regex(/^[^\x00-\x1f\x7f-\x9f]+$/);
var ordsUrl = external_exports.string().url().max(2048).refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && // Plaintext HTTP would expose the ORDS password; allow it for loopback only.
  (url.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) && !url.username && !url.password && !url.search && !url.hash && url.pathname.endsWith("/") && !url.pathname.replace(/\/+$/, "").endsWith("/_/sql") && !/[\s"\x00-\x1f]/.test(value);
}, "Use the ORDS schema HTTPS URL ending in / (HTTP only for localhost), without credentials, query or fragment.");
var ordsUsername = external_exports.string().min(1).max(128).regex(/^[^"\x00-\x1f\x7f-\x9f]+$/);
var ordsSchema = external_exports.strictObject({ url: ordsUrl, username: ordsUsername });
var connectionSchema = external_exports.strictObject({
  kind: external_exports.literal("sqlcl-store"),
  name: savedConnectionName.optional(),
  ords: ordsSchema.optional()
}).refine((value) => !!(value.name || value.ords), "Configure a direct connection or ORDS endpoint.");
var storeSchema = external_exports.record(refName, connectionSchema);
var references = /* @__PURE__ */ new WeakMap();
var connectionReference = (connection) => references.get(connection);
var credentialSchema = ordsSchema.extend({ password: external_exports.string().min(1).max(4096) }).strict();
function checkPassword(password) {
  if (!password || password.length > 4096 || /["\x00-\x1f\x7f-\x9f]/.test(password))
    throw new Fault(
      "INVALID_ORDS_PASSWORD",
      "ORDS passwords must be nonempty and cannot contain control characters or double quotes.",
      2
    );
  return password;
}
async function credentialPath(name) {
  parse(refName, name);
  return contained(managedHome(), path8.join("credentials", name + ".json"));
}
async function ordsCredentials(connection) {
  const name = references.get(connection);
  if (!name || !connection.ords)
    throw new Fault(
      "ORDS_CONNECTION_REQUIRED",
      "Configure this connection reference with a plugin-level ORDS endpoint and credentials.",
      3,
      "blocked"
    );
  const file = await credentialPath(name);
  if (!await exists(file))
    throw new Fault(
      "ORDS_CREDENTIALS_REQUIRED",
      "Save the ORDS password locally in plugin connection settings.",
      3,
      "blocked"
    );
  if (process.platform !== "win32" && ((await stat2(file)).mode & 63) !== 0)
    throw new Fault(
      "ORDS_CREDENTIAL_PERMISSIONS",
      "ORDS credential files must only be readable by their owner (0600).",
      3,
      "blocked"
    );
  let value;
  try {
    value = parse(credentialSchema, await readJson(file));
  } catch {
    throw new Fault(
      "ORDS_CREDENTIALS_INVALID",
      "The local ORDS credential file is invalid. Save it again in plugin settings.",
      3,
      "blocked"
    );
  }
  if (value.url !== connection.ords.url || value.username !== connection.ords.username)
    throw new Fault(
      "ORDS_CREDENTIALS_REQUIRED",
      "Save credentials for the configured ORDS endpoint and username.",
      3,
      "blocked"
    );
  checkPassword(value.password);
  return value;
}
async function connections() {
  const file = path8.join(managedHome(), "connections.json");
  return Object.assign(
    /* @__PURE__ */ Object.create(null),
    await exists(file) ? parse(storeSchema, await readJson(file)) : {}
  );
}
async function resolveConnection(name) {
  const connection = (await connections())[name];
  if (!connection)
    throw new Fault(
      "CONNECTION_REQUIRED",
      "Configure the requested SQLcl connection reference locally; do not send credentials in chat.",
      3,
      "blocked"
    );
  references.set(connection, name);
  return connection;
}
async function editConnection(name, value) {
  parse(refName, name);
  return withLock(path8.join(managedHome(), "connections.lock"), async () => {
    const current = await connections();
    let credentialsDeleted = false;
    if (value) current[name] = parse(connectionSchema, { ...current[name], ...value });
    else {
      delete current[name];
      const file = await credentialPath(name);
      credentialsDeleted = await exists(file);
      await rm3(file, { force: true });
    }
    await writeJson(path8.join(managedHome(), "connections.json"), current);
    return { name, status: value ? "configured" : "removed", credentialsDeleted };
  });
}
function isChild(root, file) {
  const relative = path8.relative(root, file);
  return relative !== "" && relative !== ".." && !relative.startsWith(".." + path8.sep) && !path8.isAbsolute(relative);
}
async function readPasswordFile(file, roots) {
  const candidates = roots.filter((root) => isChild(root, file));
  if (!candidates.length)
    throw new Fault(
      "PASSWORD_FILE_UNSAFE",
      "The password file must be inside the managed home, the project directory or the current working directory.",
      2
    );
  let handle;
  let before;
  let physical;
  try {
    before = await lstat2(file);
    if (before.isSymbolicLink() || !before.isFile())
      throw new Fault("PASSWORD_FILE_UNSAFE", "The password file must be a regular non-symlink file.", 2);
    physical = await realpath3(file);
    const resolved = await Promise.all(candidates.map((root) => realpath3(root).catch(() => null)));
    if (!resolved.some((root) => root !== null && isChild(root, physical)))
      throw new Fault(
        "PASSWORD_FILE_UNSAFE",
        "The password file must resolve inside the managed home, the project directory or the current working directory.",
        2
      );
    handle = await open3(
      physical,
      constants2.O_RDONLY | (constants2.O_NOFOLLOW ?? 0) | (constants2.O_NONBLOCK ?? 0)
    );
  } catch (error) {
    if (error instanceof Fault) throw error;
    const code = error.code;
    throw new Fault(
      "PASSWORD_FILE_UNSAFE",
      code === "ELOOP" || code === "EMLINK" ? "The password file must not be a symbolic link." : "The password file cannot be opened.",
      2
    );
  }
  try {
    const info = await handle.stat();
    const current = await lstat2(file);
    if (!info.isFile() || !current.isFile() || current.isSymbolicLink() || await realpath3(file) !== physical || before.dev !== info.dev || before.ino !== info.ino || current.dev !== info.dev || current.ino !== info.ino)
      throw new Fault("PASSWORD_FILE_UNSAFE", "The password file changed or is not a regular file.", 2);
    if (process.platform !== "win32" && ((info.mode & 63) !== 0 || typeof process.getuid === "function" && info.uid !== process.getuid()))
      throw new Fault(
        "PASSWORD_FILE_UNSAFE",
        "The password file must belong to the current user and only be accessible by that user (chmod 600).",
        2
      );
    const buffer = Buffer.alloc(4 * 4096 + 3);
    if (info.size >= buffer.length)
      throw new Fault("PASSWORD_FILE_UNSAFE", "The password file exceeds the maximum credential size.", 2);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead !== info.size)
      throw new Fault("PASSWORD_FILE_UNSAFE", "The password file changed while being read.", 2);
    return buffer.toString("utf8", 0, bytesRead);
  } catch (error) {
    if (error instanceof Fault) throw error;
    throw new Fault("PASSWORD_FILE_UNSAFE", "The password file could not be verified and read.", 2);
  } finally {
    await handle.close();
  }
}
async function configureConnection(name, input) {
  parse(refName, name);
  if (input.envFile) {
    if (input.password !== void 0 || input.passwordFile)
      throw new Fault("INVALID_INPUT", "Select one local credential source.", 2);
    const values = await readLocalEnv(input.envFile);
    const password = values[input.passwordKey ?? "ORDS_PASSWORD"];
    const username = values[input.usernameKey ?? "ORDS_USERNAME"];
    const url = values[input.urlKey ?? "ORDS_URL"];
    if (!password || !(input.ordsUsername ?? username) || !(input.ordsUrl ?? url))
      throw new Fault("ENV_CREDENTIALS_MISSING", "The selected local ENV credential keys are missing.", 2);
    input = {
      ...input,
      password,
      ordsUsername: input.ordsUsername ?? username,
      ordsUrl: input.ordsUrl ?? url
    };
  }
  return withLock(path8.join(managedHome(), "connections.lock"), async () => {
    const current = await connections();
    const previous = current[name];
    const ords = input.ordsUrl || input.ordsUsername ? parse(ordsSchema, { url: input.ordsUrl, username: input.ordsUsername }) : previous?.ords;
    const value = parse(connectionSchema, {
      ...previous,
      kind: "sqlcl-store",
      ...input.sqlclName ? { name: input.sqlclName } : {},
      ...ords ? { ords } : {}
    });
    let password = input.password;
    if (input.passwordFile) {
      if (password !== void 0) throw new Fault("INVALID_INPUT", "Supply one local password source.", 2);
      const file = path8.resolve(input.passwordFile);
      const roots = [managedHome(), process.cwd()];
      if (input.project && !roots.some((root) => isChild(root, file))) {
        const requested = path8.resolve(input.project);
        if (requested !== path8.parse(requested).root && isChild(requested, file)) {
          try {
            await loadProject(requested);
          } catch {
            throw new Fault(
              "PASSWORD_FILE_UNSAFE",
              "Use a configured project to bound its password file.",
              2
            );
          }
          roots.push(requested);
        }
      }
      password = (await readPasswordFile(file, roots)).replace(/\r?\n$/, "");
    }
    if (password !== void 0 && !ords)
      throw new Fault(
        "INVALID_INPUT",
        "Configure the ORDS endpoint and username before saving its password.",
        2
      );
    if (ords && (input.ordsUrl || input.ordsUsername || password !== void 0)) {
      if (password !== void 0) {
        const folder = await contained(managedHome(), "credentials");
        await mkdir4(folder, { recursive: true, mode: 448 });
        if (process.platform !== "win32") await chmod2(folder, 448);
        await writeJson(await credentialPath(name), { ...ords, password: checkPassword(password) });
      } else {
        references.set(value, name);
        await ordsCredentials(value);
      }
    }
    current[name] = value;
    await writeJson(path8.join(managedHome(), "connections.json"), current);
    return { name, status: "configured" };
  });
}

// packages/core/src/sqlcl-config.ts
import path9 from "node:path";
var sqlclMode = external_exports.enum(["cli", "mcp"]);
var sqlclRestriction = external_exports.enum(["4", "1"]);
var databaseTransport = external_exports.enum(["direct", "ords"]);
var sqlclConfigSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  mode: sqlclMode,
  mcpRestrictLevel: sqlclRestriction,
  databaseTransport: databaseTransport.optional()
});
async function sqlclConfig() {
  const home = managedHome();
  if (!await exists(home)) return { schemaVersion: 1, mode: "cli", mcpRestrictLevel: "4" };
  const file = await contained(home, "sqlcl.json");
  return await exists(file) ? parse(sqlclConfigSchema, await readJson(file)) : { schemaVersion: 1, mode: "cli", mcpRestrictLevel: "4" };
}
async function configureSqlcl(mode, level, transport) {
  const home = managedHome();
  return withLock(path9.join(home, "sqlcl-config.lock"), async () => {
    const previous = await sqlclConfig();
    const configuration = parse(sqlclConfigSchema, {
      ...previous,
      mode,
      mcpRestrictLevel: level ?? previous.mcpRestrictLevel,
      ...transport ? { databaseTransport: transport } : {}
    });
    if (configuration.mode === "mcp" && configuration.databaseTransport === "ords")
      throw new Fault(
        "ORDS_CLI_REQUIRED",
        "ORDS HTTP requires SQLcl CLI mode. Select CLI execution for this transport.",
        3,
        "blocked"
      );
    await writeJson(await contained(home, "sqlcl.json"), configuration);
    return configuration;
  });
}

// packages/core/src/sqlcl-read-scope.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
var storage = new AsyncLocalStorage();
function connectedReadsDisabled() {
  return /^(?:0|false|off)$/i.test(process.env.APEXREST_CONNECTED_READS ?? "");
}
async function withConnectedReads(action) {
  if (storage.getStore() || connectedReadsDisabled()) return action();
  const scope = { id: randomUUID() };
  try {
    return await storage.run(scope, action);
  } finally {
    await closeSqlclReadScope(scope.id);
  }
}
function currentReadScope() {
  return storage.getStore()?.id;
}

// packages/core/src/sqlcl-warm.ts
import { performance } from "node:perf_hooks";
var READY_TIMEOUT_MS = 6e4;
var PROBE = "APEXREST_RESTRICT_PROBE";
function warmImportDisabled() {
  return /^(?:0|false|off)$/i.test(process.env.APEXREST_WARM_IMPORT ?? "");
}
var WarmImportServer = class {
  constructor(request) {
    this.request = request;
    this.client = new SqlclMcpClient({
      executable: request.executable,
      args: ["-R", request.restrictLevel, "-mcp"],
      cwd: request.cwd,
      ...request.env ? { env: request.env } : {}
    });
    this.ready = this.prepare().catch(() => false);
  }
  request;
  client;
  started = performance.now();
  ready;
  taken = false;
  closed = false;
  warmMs;
  async prepare() {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    const options = mcpCallOptions({ timeoutMs: READY_TIMEOUT_MS }, deadline);
    await this.client.open(options());
    const probe = this.client.text(await this.client.execute(`host echo ${PROBE}`, options, () => false));
    if (!/SP2-0738/.test(probe) || probe.split(/\r?\n/).some((line) => line.trim() === PROBE)) return false;
    await this.client.execute(this.request.warmup, options, () => false);
    this.warmMs = performance.now() - this.started;
    return this.client.alive && !this.closed;
  }
  /**
   * Run the import batch. Resolves `undefined` when the server cannot be used and
   * nothing was submitted (the caller then runs the ordinary process). After the
   * batch is submitted every failure is reported like an interrupted import process.
   */
  async run(request) {
    if (this.taken || this.closed) return void 0;
    this.taken = true;
    const started = performance.now();
    const timing = executionTiming("mcp", true, true);
    timing.reused = true;
    let submitted = false;
    let executeStarted;
    const deadline = Date.now() + (request.timeoutMs ?? SQLCL_WRITE_TIMEOUT_MS);
    const options = mcpCallOptions(request, deadline);
    try {
      if (!await this.ready || request.signal?.aborted) return void 0;
      timing.queueMs = performance.now() - started;
      const connectStarted = performance.now();
      let connected;
      try {
        connected = await this.client.connect(request.connectionName, options, true);
      } catch {
        return void 0;
      }
      timing.connectMs = performance.now() - connectStarted;
      if (connected.isError) return void 0;
      submitted = true;
      executeStarted = performance.now();
      const result = await this.client.execute(request.input ?? "", options, () => true);
      return mcpResult(result, this.client.text(result, true));
    } catch (error) {
      if (!submitted) return void 0;
      const interrupted = request.signal?.aborted ? "cancelled" : Date.now() >= deadline ? "timedOut" : void 0;
      if (interrupted)
        return {
          code: null,
          stdout: "",
          stderr: "",
          timedOut: interrupted === "timedOut",
          cancelled: interrupted === "cancelled",
          truncated: false
        };
      throw mcpFailure(error, { ...this.request, args: [], mutation: true }, true);
    } finally {
      if (executeStarted !== void 0) timing.executeMs = performance.now() - executeStarted;
      await this.close();
      if (submitted) emitSqlclTiming(request.onSqlclTiming, timing, started);
    }
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.client.close();
  }
};

// packages/core/src/ords.ts
import path10 from "node:path";
import { realpath as realpath4, rm as rm4 } from "node:fs/promises";
async function sqlclHome(executable) {
  const candidates = path10.isAbsolute(executable) ? [executable] : executable.includes(path10.sep) ? [path10.resolve(executable)] : (process.env.PATH ?? "").split(path10.delimiter).flatMap(
    (directory) => process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"].map((extension) => path10.join(directory, executable + extension)) : [path10.join(directory, executable)]
  );
  for (const candidate of candidates) {
    if (!await exists(candidate)) continue;
    const home = path10.dirname(path10.dirname(await realpath4(candidate)));
    if (await exists(path10.join(home, "lib", "jdbcrest.jar"))) return home;
    break;
  }
  throw new Fault(
    "ORDS_SQLCL_LIBRARIES_REQUIRED",
    "ORDS APEX operations require the selected SQLcl installation with lib/jdbcrest.jar and the Oracle APEXlang compiler. Set APEXREST_SQLCL to its bin/sql executable.",
    3,
    "blocked"
  );
}
async function resolveOrdsJava(javaHome, stage, env, signal, runner = runProcess) {
  const executableName = process.platform === "win32" ? "java.exe" : "java";
  const candidates = [
    ...[javaHome, process.env.JAVA_HOME].filter((home) => !!home).map((home) => ({ executable: path10.join(home, "bin", executableName), javaHome: home })),
    { executable: executableName, javaHome: void 0 }
  ];
  const attempted = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    if (attempted.has(candidate.executable)) continue;
    attempted.add(candidate.executable);
    if (signal?.aborted) throw new Fault("CANCELLED", "ORDS operation cancelled.", 6, "cancelled");
    try {
      const result = await runner({
        executable: candidate.executable,
        args: ["--list-modules"],
        cwd: stage,
        env: { ...env, JAVA_HOME: candidate.javaHome },
        timeoutMs: 1e4,
        ...signal ? { signal } : {}
      });
      if (result.cancelled || signal?.aborted)
        throw new Fault("CANCELLED", "ORDS operation cancelled.", 6, "cancelled");
      const major = Number(result.stdout.match(/^java\.base@(\d+)/m)?.[1] ?? 0);
      if (result.code === 0 && !result.timedOut && !result.truncated && major >= 21 && /^jdk\.compiler@/m.test(result.stdout))
        return candidate;
    } catch (error) {
      if (!(error instanceof Fault) || error.code !== "DEPENDENCY_MISSING") throw error;
    }
  }
  throw new Fault(
    "ORDS_JDK_REQUIRED",
    "ORDS APEX operations need an installed JDK 21 or newer with jdk.compiler. The configured Java runtime and JAVA_HOME/PATH do not provide one. Set APEXREST_JAVA_HOME or JAVA_HOME to an existing JDK; ordinary SQLcl can continue using its managed JRE.",
    3,
    "blocked"
  );
}
async function runOrdsBridge(settings, job, credentials, stage, signal, runner = runProcess) {
  if (signal?.aborted) throw new Fault("CANCELLED", "ORDS operation cancelled.", 6, "cancelled");
  const home = await sqlclHome(settings.executable);
  const helper = path10.join(resourceRoot(), "ords", "OrdsBridge.java");
  if (!await exists(helper))
    throw new Fault("ORDS_HELPER_REQUIRED", "The installed plugin is missing its ORDS helper.", 3, "blocked");
  const jobFile = path10.join(stage, "ords-job.json");
  const output = path10.join(stage, "ords-result.json");
  await rm4(output, { force: true });
  await writeJson(jobFile, { ...job, output });
  const env = { ...process.env, JAVA_HOME: settings.javaHome };
  delete env.NODE_OPTIONS;
  delete env.JAVA_TOOL_OPTIONS;
  delete env._JAVA_OPTIONS;
  delete env.JDK_JAVA_OPTIONS;
  const java = await resolveOrdsJava(settings.javaHome, stage, env, signal, runner);
  env.JAVA_HOME = java.javaHome;
  const mutation = job.operation === "import" || job.operation === "script";
  const processResult = await runner({
    executable: java.executable,
    args: [
      "-cp",
      [path10.join(home, "lib", "*"), path10.join(home, "lib", "ext", "*")].join(path10.delimiter),
      helper,
      jobFile
    ],
    cwd: stage,
    env,
    input: credentials ? JSON.stringify(credentials) : "",
    timeoutMs: mutation ? SQLCL_WRITE_TIMEOUT_MS : SQLCL_READ_TIMEOUT_MS,
    ...signal ? { signal } : {}
  });
  if (processResult.timedOut || processResult.cancelled || processResult.truncated)
    throw new Fault(
      processResult.truncated ? "OUTPUT_LIMIT" : processResult.cancelled ? "CANCELLED" : "TIMEOUT",
      "The ORDS helper did not confirm completion. Reconcile any import before retrying.",
      6,
      mutation ? "outcome_unknown" : "cancelled"
    );
  let result;
  if (await exists(output)) {
    try {
      const value = await readJson(output);
      if (value && value.operation === job.operation && ["succeeded", "failed"].includes(value.status))
        result = value;
    } catch {
    }
  }
  if (processResult.code !== 0 || result?.status !== "succeeded" || !processResult.stdout.split(/\r?\n/).some((line) => line.trim() === "APEXREST_ORDS_COMPLETE")) {
    const unknown = mutation && (!result || result.writeStarted === true);
    throw new Fault(
      unknown ? "ORDS_OUTCOME_UNKNOWN" : result?.code ?? "ORDS_BRIDGE_FAILED",
      unknown ? "ORDS import did not confirm a complete outcome; reconcile the target before retrying." : "The Oracle ORDS helper failed. Check the SQLcl/Java prerequisites, ORDS authentication and schema privileges.",
      unknown ? 6 : 1,
      unknown ? "outcome_unknown" : "failed"
    );
  }
  return result;
}

// packages/core/src/compatibility.ts
import path11 from "node:path";
import { readFile as readFile5 } from "node:fs/promises";
var APEX_262_PROFILE = {
  id: "apex262-sqlcl263-mmd3479",
  apex: "26.2",
  sqlcl: "26.3.0.260.1620",
  mmd: "26.2.0+3479",
  qualification: "partial-local"
};
function databaseMeetsApex262Minimum(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\.|$)/.exec(version);
  if (!match) return false;
  const major = Number(match[1]), minor = Number(match[2]);
  if (major === 23) return minor >= 26;
  return major > 19 || major === 19 && minor >= 18;
}
async function sourceMmdVersion(source) {
  try {
    const value = JSON.parse(await readFile5(path11.join(source, ".apex/apexlang.json"), "utf8"));
    const version = value?.mmdVersion;
    return typeof version === "string" && /^\d+\.\d+\.\d+\+\d+$/.test(version) ? version : null;
  } catch {
    return null;
  }
}
function evaluatePartialImportCompatibility(input) {
  const reasons = [];
  if (input.mode !== "cli" || input.databaseTransport !== "direct")
    reasons.push("Partial import requires direct SQLcl CLI transport.");
  if (!input.importFiles) reasons.push("The selected SQLcl import help does not advertise -files.");
  if (!input.compilerVersion.includes(APEX_262_PROFILE.sqlcl))
    reasons.push("The SQLcl build is outside the reviewed partial-import profile.");
  if (input.mmdVersion !== APEX_262_PROFILE.mmd)
    reasons.push("Source MMD is outside the reviewed APEX 26.2 profile.");
  if (!/^26\.2(?:\.|$)/.test(input.apexVersion))
    reasons.push("The target APEX release is outside the reviewed 26.2 profile.");
  if (!databaseMeetsApex262Minimum(input.databaseVersion))
    reasons.push("Target database release is unconfirmed or below the APEX 26.2 minimum.");
  return { ...input, supported: reasons.length === 0, reasons };
}

// packages/core/src/upgrade-audit.ts
import path12 from "node:path";
import { readFile as readFile6, stat as stat3, opendir } from "node:fs/promises";
function parseCodeScan(output, source) {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, "");
  const from = clean.indexOf("["), to = clean.lastIndexOf("]");
  if (from < 0 || to < from) throw new Error("CodeScan did not return its JSON report.");
  const report = JSON.parse(clean.slice(from, to + 1));
  if (!Array.isArray(report)) throw new Error("CodeScan report is not a list.");
  const findings = [];
  for (const entry of report) {
    if (!entry || typeof entry.file !== "string" || !Array.isArray(entry.issues))
      throw new Error("CodeScan report entry is incomplete.");
    const file = path12.relative(source, path12.resolve(source, entry.file)).replaceAll(path12.sep, "/");
    if (!file || file.startsWith("../") || path12.isAbsolute(file))
      throw new Error("CodeScan returned a file outside the inspected source.");
    for (const issue of entry.issues) {
      if (typeof issue?.ruleNo !== "string" || typeof issue.msg !== "string" || !Number.isInteger(issue.line) || issue.line < 0 || !Number.isInteger(issue.col) || issue.col < 0)
        throw new Error("CodeScan issue is incomplete.");
      findings.push({
        code: issue.ruleNo,
        file,
        line: issue.line,
        column: issue.col,
        message: issue.msg,
        severity: "warning"
      });
    }
  }
  return findings;
}
var upgradeRules = [
  {
    code: "APEX262_AI_TOOL_CALLS",
    pattern: /\btool_calls\b/i,
    message: "Review legacy AI tool_calls handling against the APEX 26.2 response contract."
  },
  {
    code: "APEX262_AI_MESSAGE",
    pattern: /\bt_chat_response\b/i,
    message: "Review APEX_AI t_chat_response and response.message usage against the 26.2 response contract."
  },
  {
    code: "APEX262_ASSSO",
    pattern: /\bASSSO\b/i,
    message: "Review legacy ASSSO authentication against the APEX 26.2 desupport guidance."
  },
  {
    code: "APEX262_REST_RESOURCE",
    pattern: /\bAPEX_REST_RESOURCE\b/i,
    message: "Review legacy APEX_REST_RESOURCE references against APEX 26.2 migration guidance."
  },
  {
    code: "APEX262_ADVISOR",
    pattern: /\b(?:apex_advisor|advisor)\b/i,
    message: "Review Advisor references against the APEX 26.2 Advisor changes; this text match may be unrelated."
  }
];
async function auditUpgradeSource(source) {
  const files = [], directories = [""];
  const findings = [], skipped = [];
  let inspected = 0, traversalTruncated = false;
  discovery: while (directories.length) {
    const relative = directories.pop();
    for await (const entry of await opendir(path12.join(source, relative))) {
      if (++inspected > 1e4) {
        traversalTruncated = true;
        break discovery;
      }
      const file = path12.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) skipped.push(file);
      else if (entry.isDirectory()) directories.push(file);
      else if (entry.isFile() && /\.(?:apx|sql|js)$/i.test(file)) files.push(file);
    }
  }
  files.sort();
  let bytes = 0, scannedFiles = 0;
  for (const file of files) {
    const absolute = path12.join(source, file), size = (await stat3(absolute)).size;
    if (size > 1024 * 1024 || bytes + size > 16 * 1024 * 1024 || scannedFiles >= 2e3) {
      skipped.push(file);
      continue;
    }
    bytes += size;
    scannedFiles++;
    const lines = (await readFile6(absolute, "utf8")).split(/\r?\n/);
    for (const rule of upgradeRules) {
      const at = lines.findIndex((line) => rule.pattern.test(line));
      if (at >= 0)
        findings.push({ code: rule.code, file, line: at + 1, message: rule.message, severity: "warning" });
    }
  }
  return {
    status: "advisory",
    targetRelease: "26.2",
    scannedFiles,
    findings,
    skipped,
    traversalTruncated,
    limitation: "Source text review hints only; not a complete dependency, SQL, security or runtime audit."
  };
}

// packages/core/src/locality.ts
import { hostname as hostname2 } from "node:os";
var loopback = (host) => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host.toLowerCase());
function localConnectionEndpoint(description) {
  const jdbc = /jdbc:oracle:(thin|oci):(?:[^@\r\n]*@)?([^\r\n]*)/i.exec(description);
  if (!jdbc) return { local: false, evidence: "unconfirmed-connection-endpoint" };
  if (jdbc[1].toLowerCase() === "oci" && !jdbc[2].trim())
    return { local: true, evidence: "native-local-transport" };
  const address = jdbc[2].trim();
  const descriptorHosts = [...address.matchAll(/\(host\s*=\s*([^\s)]+)\)/gi)].map((m) => m[1]);
  const easy = /^(?:\/\/)?(\[[^\]]+\]|[^/:,?\s]+)(?::\d+)?(?:\/|:)/.exec(address);
  const hosts = descriptorHosts.length ? descriptorHosts : easy ? [easy[1]] : [];
  return {
    local: hosts.length > 0 && hosts.every(loopback),
    evidence: hosts.length && hosts.every(loopback) ? "effective-loopback-endpoint" : "remote-or-unresolved-endpoint"
  };
}
async function localServerHost(serverHost) {
  const host = serverHost.toLowerCase();
  if (loopback(host) || host === hostname2().toLowerCase()) return true;
  const engines = [
    "docker",
    "podman",
    ...process.platform === "darwin" ? ["/opt/podman/bin/podman", "/Applications/Docker.app/Contents/Resources/bin/docker"] : []
  ];
  for (const executable of engines) {
    const podman = executable.endsWith("podman");
    try {
      if (podman) {
        if (process.env.CONTAINER_HOST && !process.env.CONTAINER_HOST.startsWith("unix://")) continue;
        if (process.platform !== "linux") {
          const connections2 = await runProcess({
            executable,
            args: ["system", "connection", "list", "--format", "json"],
            cwd: process.cwd(),
            timeoutMs: 5e3
          });
          const entries = JSON.parse(connections2.stdout);
          const active = process.env.CONTAINER_CONNECTION ? entries.find((entry) => entry.Name === process.env.CONTAINER_CONNECTION) : entries.find((entry) => entry.Default);
          if (!active?.URI) continue;
          const endpoint = new URL(active.URI);
          if (!loopback(endpoint.hostname)) continue;
          const machines = await runProcess({
            executable,
            args: ["machine", "list", "--format", "json"],
            cwd: process.cwd(),
            timeoutMs: 5e3
          });
          if (machines.code !== 0 || !JSON.parse(machines.stdout).some(
            (machine) => machine.Running && machine.Port === Number(endpoint.port)
          ))
            continue;
        }
      } else {
        const context = process.env.DOCKER_HOST ?? (await runProcess({
          executable,
          args: ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
          cwd: process.cwd(),
          timeoutMs: 5e3
        })).stdout.trim();
        if (!/^(unix|npipe):\/\//.test(context)) continue;
      }
      const list2 = await runProcess({ executable, args: ["ps", "-q"], cwd: process.cwd(), timeoutMs: 5e3 });
      const ids = list2.stdout.trim().split(/\s+/).filter((id) => /^[a-f0-9]{12,64}$/.test(id));
      if (list2.code !== 0 || !ids.length) continue;
      const names = await runProcess({
        executable,
        args: ["inspect", "--format", "{{.Config.Hostname}}", ...ids],
        cwd: process.cwd(),
        timeoutMs: 5e3
      });
      if (names.code === 0 && names.stdout.trim().split(/\s+/).some((name) => name.toLowerCase() === host))
        return true;
    } catch {
    }
  }
  return false;
}

// packages/core/src/oracle.ts
var targetIdentitySql = `select 'identity' target_record,
        sys_context('USERENV','DB_UNIQUE_NAME') db_unique_name,
        sys_context('USERENV','SERVICE_NAME') service_name,
        sys_context('USERENV','CURRENT_SCHEMA') parsing_schema,
        cast(null as varchar2(64)) workspace_id, null workspace, null application_id, null alias, null owner
       from dual
       union all
       select 'workspace', null, null, null, to_char(workspace_id, 'TM9', 'NLS_NUMERIC_CHARACTERS=''.,'''), workspace, null, null, null
       from apex_workspaces where workspace = :p_workspace
       union all
       select 'application', null, null, null, null, workspace, application_id, alias, owner
       from apex_applications where application_id = :p_app_id
       union all
       select 'schema', null, null, username, null, null, null,
              to_char(created - (sysdate - cast(sys_extract_utc(systimestamp) as date)), 'YYYY-MM-DD"T"HH24:MI:SS') || 'Z', null
       from all_users where username = sys_context('USERENV','CURRENT_SCHEMA')`;
function workspaceIdentifier(value) {
  if (typeof value === "string" && /^(?:0|[1-9][0-9]{0,63})$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  throw new Fault(
    "WORKSPACE_ID_UNCONFIRMED",
    "Workspace identity requires exact decimal text. An unsafe legacy numeric ID cannot be reconstructed. Preserve held recovery evidence and obtain a fresh exact observation.",
    3,
    "blocked",
    {
      nextActions: [
        "Obtain a fresh exact-string target observation and create a new apexrest_ship mode:plan. Preserve saved numeric plans, fingerprints and history.",
        "For a completed ready working copy, use apexrest_apex_sync action:refresh with clean sources before replanning. A 26.2 full plan can obtain a fresh target without changing the stored baseline.",
        "For importing or outcome_unknown runs, keep ownership and the original recovery evidence. Reconcile the original run before retry, refresh or invalidate."
      ]
    }
  );
}
var applicationMetadataSql = `select to_char(last_updated_on, 'YYYY-MM-DD"T"HH24:MI:SS', 'NLS_DATE_LANGUAGE=American') last_updated_on,
        last_updated_by,
        case when last_updated_on is null then 'Y' else 'N' end last_updated_on_is_null,
        case when last_updated_by is null then 'Y' else 'N' end last_updated_by_is_null
        from apex_applications
        where application_id = :p_app_id and workspace = :p_workspace and owner = :p_owner`;
function parseApplicationMetadata(rows) {
  const row = rows[0];
  if (row && !Object.hasOwn(row, "last_updated_on") && row.last_updated_on_is_null === "Y")
    row.last_updated_on = null;
  if (row && !Object.hasOwn(row, "last_updated_by") && row.last_updated_by_is_null === "Y")
    row.last_updated_by = null;
  if (rows.length !== 1 || !row || !Object.hasOwn(row, "last_updated_on") || !Object.hasOwn(row, "last_updated_by"))
    throw new Fault("SYNC_METADATA_UNCONFIRMED", "Application update metadata is absent or inaccessible.", 5);
  if ([row.last_updated_on, row.last_updated_by].some((v) => v !== null && typeof v !== "string"))
    throw new Fault("SYNC_METADATA_UNCONFIRMED", "Unexpected application update metadata.", 5);
  return {
    lastUpdatedOn: row.last_updated_on,
    lastUpdatedBy: row.last_updated_by
  };
}
var targetVersionSql = "select (select version_no from apex_release) apex_version, version_full database_version from product_component_version where product like 'Oracle%Database%'";
function parseStatementMs(output) {
  const tail = output.slice(output.lastIndexOf("}") + 1);
  const matches = [...tail.matchAll(/^Elapsed: (\d+):(\d{2}):(\d{2}(?:\.\d+)?)\s*$/gm)];
  if (matches.length !== 1)
    throw new Fault("SQLCL_TIMING_UNCONFIRMED", "SQLcl did not return one statement elapsed interval.", 1);
  const m = matches[0];
  const value = (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1e3;
  if (!Number.isFinite(value) || Number(m[2]) >= 60 || Number(m[3]) >= 60)
    throw new Fault("SQLCL_TIMING_UNCONFIRMED", "Invalid SQLcl statement elapsed interval.", 1);
  return value;
}
var capabilityCache = /* @__PURE__ */ new Map();
var CAPABILITY_CACHE_MS = 24 * 60 * 60 * 1e3;
var importHelpCache = /* @__PURE__ */ new Map();
function resetCapabilityCache() {
  capabilityCache.clear();
  importHelpCache.clear();
}
function raceCancellation(promise, signal, message) {
  const cancelled = () => new Fault("CANCELLED", message, 6, "cancelled");
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(cancelled());
  return new Promise((resolve, reject) => {
    const abort = () => reject(cancelled());
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
function sqlclToken(value) {
  if (!value || /[\r\n\x00"&]/.test(value))
    throw new Fault(
      "INVALID_SQLCL_TOKEN",
      "SQLcl argument contains a forbidden quote, newline or substitution character.",
      2
    );
  return '"' + value.replaceAll("\\", "/") + '"';
}
function sqlLiteral(value) {
  if (/[\x00-\x1f]/.test(value) || value.length > 1024)
    throw new Fault("INVALID_SQL_LITERAL", "Invalid SQL literal.", 2);
  return "'" + value.replaceAll("'", "''") + "'";
}
function oracleDiagnostics(r, mutation = false, format = "text", captureCompilerOutput = false) {
  const stdout = r.stdout.replace(/\x1b\[[0-9;]*m/g, ""), stderr = r.stderr.replace(/\x1b\[[0-9;]*m/g, ""), output = stdout + "\n" + stderr;
  if (r.cancelled || r.timedOut || r.truncated)
    throw new Fault(
      r.truncated ? "OUTPUT_LIMIT" : r.cancelled ? "CANCELLED" : "TIMEOUT",
      "SQLcl did not complete with a confirmed outcome.",
      6,
      mutation ? "outcome_unknown" : "cancelled"
    );
  let diagnostics = output;
  if (format === "json") {
    diagnostics = stripEnvelopeRows(stdout) + "\n" + stderr;
  }
  const missingConnection = r.code !== 0 ? missingSavedConnection(diagnostics) : void 0;
  if (missingConnection !== void 0)
    throw new Fault(
      "SQLCL_CONNECTION_NOT_FOUND",
      `SQLcl has no saved connection named ${missingConnection}. Create it in SQLcl (conn -save ${missingConnection} ...) or point the APEXREST reference at an existing saved name; the application sources were not checked.`,
      3,
      "blocked",
      { savedConnection: missingConnection }
    );
  if (/ORA-01017|ORA-28000|ORA-28001/i.test(diagnostics))
    throw new Fault("AUTHENTICATION_FAILED", "Oracle authentication failed.", 4, "blocked");
  if (/ORA-01031/i.test(diagnostics))
    throw new Fault("DB_PRIVILEGE", "Oracle privileges are insufficient.", 4, "blocked");
  if (r.code !== 0 || /(?:ORA-|PLS-|SP2-|SQLCL-)[0-9]+|(?:^|\n)\s*(?:Error(?:\s|:)|Unknown command|Invalid command|Invalid option|Compilation failed|Validation failed)|not connected|Unable to|No APEXlang files/i.test(
    diagnostics
  ))
    throw new Fault(
      "ORACLE_COMMAND_FAILED",
      output.trim().slice(0, 6e3) || "SQLcl exited without success.",
      1,
      "failed",
      captureCompilerOutput ? { output } : void 0
    );
  return output;
}
function missingSavedConnection(output) {
  const match = /(?:^|\n)[ \t]*(?:Unknown connection|Connection not found|No (?:saved )?connection (?:named|found(?: with name)?))[: \t]+["']?([^\r\n"']*[^\s"'])["']?[ \t.]*(?:\r?\n|$)/i.exec(
    output
  ) ?? /(?:^|\n)[ \t]*(?:The )?(?:saved )?connection[ \t]+["']?([^\s"']+?)["']?[ \t]+(?:was not found|not found|does not exist|doesn't exist)\b/i.exec(
    output
  );
  return match ? match[1] : void 0;
}
function jsonDocuments(text) {
  const spans = [];
  let depth = 0, start = -1, quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === "\\") i++;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{") {
      if (depth++ === 0) start = i;
    } else if (c === "}" && depth > 0 && --depth === 0) spans.push([start, i + 1]);
  }
  return spans;
}
function stripEnvelopeRows(stdout) {
  let result = "", cursor = 0;
  for (const [start, end] of jsonDocuments(stdout)) {
    let replacement = stdout.slice(start, end);
    try {
      const envelope = JSON.parse(replacement);
      if (Array.isArray(envelope.results) && envelope.results.length > 0 && envelope.results.every((entry) => Array.isArray(entry.items)))
        replacement = JSON.stringify({
          ...envelope,
          results: envelope.results.map(({ items: _items, ...metadata }) => metadata)
        });
    } catch {
    }
    result += stdout.slice(cursor, start) + replacement;
    cursor = end;
  }
  return result + stdout.slice(cursor);
}
var SCRIPT_RESTRICT_LEVEL = "2";
var OracleAdapter = class {
  constructor(runner = runProcess, executable = process.env.APEXREST_SQLCL ?? "sql", mcpRunner = runSqlclMcp) {
    this.runner = runner;
    this.executable = executable;
    this.mcpRunner = mcpRunner;
  }
  runner;
  executable;
  mcpRunner;
  selectedTransport;
  selectedConnections = /* @__PURE__ */ new Map();
  async settings() {
    const file = path13.join(managedHome(), "runtime.json");
    const state = await exists(file) ? await readJson(file) : {};
    const transport = await (this.selectedTransport ??= sqlclConfig());
    return {
      ...transport,
      executable: process.env.APEXREST_SQLCL ?? state.sqlcl ?? this.executable,
      javaHome: process.env.APEXREST_JAVA_HOME ?? (state.java ? path13.dirname(path13.dirname(state.java)) : process.env.JAVA_HOME)
    };
  }
  async selectedConnection(connection) {
    const settings = await this.settings();
    const key = connectionReference(connection) ?? JSON.stringify(connection);
    let selected = this.selectedConnections.get(key);
    if (!selected) {
      selected = (async () => {
        if (settings.databaseTransport === "ords") {
          if (settings.mode !== "cli")
            throw new Fault("ORDS_CLI_REQUIRED", "ORDS HTTP requires SQLcl CLI mode.", 3, "blocked");
          return { ords: await ordsCredentials(connection) };
        }
        if (!connection.name)
          throw new Fault(
            "DIRECT_CONNECTION_REQUIRED",
            "Configure a direct SQLcl saved connection for this reference or select ORDS HTTP in plugin settings.",
            3,
            "blocked"
          );
        return { name: parse(savedConnectionName, connection.name) };
      })();
      this.selectedConnections.set(key, selected);
    }
    return selected;
  }
  async session(input, connection, mutation = false, signal, cwd, format = "text", restrictLevel, isolated = false, label = "session", warm) {
    if (restrictLevel && (await this.settings()).mode === "mcp")
      throw new Fault(
        "SQLCL_MCP_SCRIPT_RESTRICT_UNAVAILABLE",
        "Restricted script operations require SQLcl CLI mode with -R 2; MCP does not provide an equivalent restriction.",
        3,
        "blocked"
      );
    const work = cwd ?? await this.stage();
    try {
      return await this.sessionIn(
        work,
        input,
        connection,
        mutation,
        signal,
        format,
        restrictLevel,
        isolated,
        label,
        warm
      );
    } finally {
      if (!cwd) await this.discardStage(work);
    }
  }
  async sessionIn(work, input, connection, mutation, signal, format, restrictLevel, isolated, label, warm) {
    const settings = await this.settings();
    if (mutation) await this.requireMutationSupport();
    const selected = connection ? await this.selectedConnection(connection) : void 0;
    const args = [
      "-S",
      "-L",
      ...restrictLevel ? ["-R", restrictLevel] : [],
      ...selected?.name ? ["-name", selected.name] : ["/nolog"]
    ];
    const env = {
      ...process.env,
      SQLPATH: "",
      ORACLE_PATH: "",
      TNS_ADMIN: process.env.TNS_ADMIN,
      JAVA_HOME: settings.javaHome
    };
    delete env.NODE_OPTIONS;
    delete env.JAVA_TOOL_OPTIONS;
    delete env._JAVA_OPTIONS;
    delete env.JDK_JAVA_OPTIONS;
    const preamble = "set define off\nset echo off\nset feedback off\n" + (settings.mode === "mcp" && settings.mcpRestrictLevel === "4" ? "" : "whenever oserror exit failure rollback\nwhenever sqlerror exit failure rollback\n");
    const connect = selected?.ords ? `set history filter default connect
connect -orest -user "${selected.ords.username}" -password "${selected.ords.password}" -url "${selected.ords.url}"
` : "";
    const marker = `APEXREST_COMPLETE_${randomUUID2().replaceAll("-", "")}`;
    let timingRecorded = false;
    const request = {
      mutation,
      sqlclConnected: !!selected,
      onSqlclTiming: (timing) => {
        timingRecorded = true;
        recordSqlclTiming(label, timing);
      },
      executable: settings.executable,
      args,
      cwd: work,
      env,
      input: preamble + connect + input + "\nexit\n",
      timeoutMs: mutation ? SQLCL_WRITE_TIMEOUT_MS : SQLCL_READ_TIMEOUT_MS,
      ...signal ? { signal } : {}
    };
    const readScope = !mutation && !restrictLevel && !isolated && selected?.name && !selected.ords ? currentReadScope() : void 0;
    const pooled = !isolated && (settings.mode === "mcp" ? this.mcpRunner === runSqlclMcp : this.runner === runProcess && (!selected || !!readScope) && settings.databaseTransport !== "ords");
    let viaServer = settings.mode === "mcp" || pooled;
    const executionStarted = performance2.now();
    let raw;
    try {
      if (warm && mutation && !viaServer && selected?.name && !selected.ords) {
        raw = await warm.run({
          input: preamble + "set serveroutput off\nset sqlformat default\n" + input + `
commit;
prompt
prompt ${marker}
`,
          timeoutMs: SQLCL_WRITE_TIMEOUT_MS,
          ...signal ? { signal } : {},
          onSqlclTiming: request.onSqlclTiming,
          connectionName: selected.name,
          completionMarker: marker
        });
        if (raw) viaServer = true;
      }
      raw ??= viaServer ? await (pooled ? runPooledSqlcl : this.mcpRunner)({
        ...request,
        cwd: pooled ? await this.sessionHome() : work,
        // Let SQLcl apply its MCP default. In 26.1, explicit -R 4
        // also suppresses connmgr output, unlike the default MCP profile.
        args: settings.mode === "mcp" ? settings.mcpRestrictLevel === "4" ? ["-mcp"] : ["-R", "1", "-mcp"] : [...restrictLevel ? ["-R", restrictLevel] : [], "-mcp"],
        // CLI's final EXIT commits on success. Preserve that transaction
        // boundary before acknowledging a write over a persistent session.
        input: (settings.mode === "cli" ? preamble.replace(/exit failure rollback/g, "continue") : preamble) + // Persistent servers keep SET state between batches; start neutral.
        (selected?.name ? "rollback;\nbegin dbms_session.reset_package; execute immediate 'alter session set current_schema = ' || dbms_assert.enquote_name(sys_context('USERENV', 'SESSION_USER'), false); end;\n/\n" : "") + "set serveroutput off\nset sqlformat default\n" + input + (mutation ? "\ncommit;\n" : "\n") + // SQLcl 26.3's JSON formatter can omit its final newline; an empty
        // PROMPT keeps the completion marker on a line of its own.
        `prompt
prompt ${marker}
`,
        mutation,
        completionMarker: marker,
        ...selected?.name ? { connectionName: selected.name } : {},
        ...pooled && settings.mode === "cli" ? { commandConnect: true } : {},
        ...readScope && pooled ? { readScope } : {}
      }) : await this.runner(request);
    } finally {
      if (!timingRecorded) {
        const elapsed = performance2.now() - executionStarted;
        recordSqlclTiming(label, {
          queueMs: 0,
          spawnMs: null,
          connectMs: null,
          executeMs: elapsed,
          totalMs: elapsed,
          reused: false,
          mutation,
          connected: !!selected,
          transport: viaServer ? pooled ? "mcp-pool" : "mcp" : "cli"
        });
      }
    }
    const secret = selected?.ords?.password;
    const result = secret && format !== "json" ? {
      ...raw,
      stdout: raw.stdout.replaceAll(secret, "[REDACTED]"),
      stderr: raw.stderr.replaceAll(secret, "[REDACTED]")
    } : raw;
    let output;
    try {
      output = oracleDiagnostics(result, mutation, format, label === "validate" || label === "import");
    } catch (error) {
      if (secret && error instanceof Error) error.message = error.message.replaceAll(secret, "[REDACTED]");
      throw error;
    }
    if (viaServer && !output.split(/\r?\n/).some((line) => line.trim() === marker))
      throw new Fault(
        "SQLCL_MCP_INCOMPLETE",
        "SQLcl MCP did not confirm the complete command batch.",
        6,
        mutation ? "outcome_unknown" : "failed"
      );
    return { ...result, output: viaServer ? output.replace(marker, "").trim() : output, work };
  }
  /** Working directory of pooled SQLcl servers: a durable private directory, never a per-call stage. */
  async sessionHome() {
    const root = path13.join(managedHome(), "staging");
    await mkdir5(root, { recursive: true, mode: 448 });
    return root;
  }
  async requireMutationSupport() {
    const settings = await this.settings();
    if (settings.databaseTransport === "ords" && settings.mode !== "cli")
      throw new Fault("ORDS_CLI_REQUIRED", "ORDS HTTP requires SQLcl CLI mode.", 3, "blocked");
    if (settings.mode === "mcp" && settings.mcpRestrictLevel !== "1")
      throw new Fault(
        "SQLCL_MCP_RESTRICTED",
        "SQLcl MCP restrict level 4 cannot provide fail-stop scripts for writes. Explicitly select MCP restrict level 1 in SQLcl settings for authorized deployment/scripts.",
        3,
        "blocked"
      );
  }
  async stage() {
    const root = path13.join(managedHome(), "staging");
    await mkdir5(root, { recursive: true, mode: 448 });
    return mkdtemp(path13.join(root, "oracle-"));
  }
  /** Remove a private staging directory created by stage(). Other paths are never removed. */
  async discardStage(stage) {
    if (!stage) return;
    const relative = path13.relative(path13.join(managedHome(), "staging"), path13.resolve(stage));
    if (!/^oracle-[^/\\]+$/.test(relative)) return;
    await rm5(stage, { recursive: true, force: true });
  }
  async ordsBridge(job, connection, signal, stage) {
    const settings = await this.settings();
    const selected = connection ? await this.selectedConnection(connection) : void 0;
    if (connection && !selected?.ords)
      throw new Fault(
        "ORDS_CONNECTION_REQUIRED",
        "Select the ORDS transport for this operation.",
        3,
        "blocked"
      );
    const work = stage ?? await this.stage();
    try {
      return await runOrdsBridge(settings, job, selected?.ords, work, signal, this.runner);
    } finally {
      if (!stage) await this.discardStage(work);
    }
  }
  async capabilityKey(settings) {
    if (!path13.isAbsolute(settings.executable)) return;
    try {
      const executable = await realpath5(settings.executable);
      const bin = path13.dirname(executable);
      if (path13.basename(bin) !== "bin") return;
      const lib = path13.join(path13.dirname(bin), "lib");
      const mark = async (file, required) => {
        try {
          const info = await stat4(file, { bigint: true });
          return [info.dev, info.ino, info.mode, info.size, info.mtimeNs, info.ctimeNs].map(String);
        } catch (error) {
          if (required) throw error;
          return "absent";
        }
      };
      const marks = {
        executable: await mark(executable, true),
        lib: await mark(lib, true),
        apex: await mark(path13.join(lib, "dbtools-apex.jar"), false),
        apexlang: await mark(path13.join(lib, "apexlang-compiler.jar"), false),
        ext: await mark(path13.join(lib, "ext"), false),
        extApex: await mark(path13.join(lib, "ext/dbtools-apex.jar"), false),
        extApexlang: await mark(path13.join(lib, "ext/apexlang-compiler.jar"), false)
      };
      const { executable: _executable, ...rest } = settings;
      return hash(canonical({ ...rest, executable, marks }));
    } catch {
      return;
    }
  }
  /**
   * Capabilities of an unchanged SQLcl installation, kept across processes. Each
   * deployment worker is a new process and would otherwise start two SQLcl JVMs
   * (`-version`, `help apex`) before its first read. The key covers the launcher,
   * the compiler libraries and the settings, so a changed installation probes
   * again; entries expire after a day. Injected test runners never use it.
   */
  async capabilityFile(key) {
    if (!key || this.runner !== runProcess || /^(?:0|false|off)$/i.test(process.env.APEXREST_CAPABILITY_CACHE ?? ""))
      return void 0;
    return path13.join(managedHome(), "cache", "sqlcl-capabilities", key + ".json");
  }
  async storedCapabilities(key) {
    const file = await this.capabilityFile(key);
    if (!file) return void 0;
    try {
      const stored = await readJson(file);
      const value = stored.capabilities;
      if (typeof stored.savedAt !== "number" || Date.now() - stored.savedAt > CAPABILITY_CACHE_MS || stored.savedAt > Date.now() || !value || typeof value.version !== "string" || typeof value.help !== "string" || value.helpHash !== hash(value.help) || typeof value.commands !== "object")
        return void 0;
      return value;
    } catch {
      return void 0;
    }
  }
  async storeCapabilities(key, capabilities) {
    const file = await this.capabilityFile(key);
    if (file && capabilities.version && key === await this.capabilityKey(await this.settings()))
      try {
        await mkdir5(path13.dirname(file), { recursive: true, mode: 448 });
        await writeJson(file, { savedAt: Date.now(), capabilities });
      } catch {
      }
    return capabilities;
  }
  async probeCapabilities(settings, key) {
    const versionStage = await this.stage();
    let version;
    try {
      version = await this.runner({
        executable: settings.executable,
        args: ["-version"],
        cwd: versionStage,
        env: { ...process.env, JAVA_HOME: settings.javaHome },
        timeoutMs: 15e3
      });
    } finally {
      await this.discardStage(versionStage);
    }
    oracleDiagnostics(version);
    const help = (await this.session(
      "help apex",
      void 0,
      false,
      void 0,
      void 0,
      "text",
      void 0,
      false,
      "capability"
    )).output;
    if (key && key !== await this.capabilityKey(settings)) capabilityCache.delete(key);
    const commands = Object.fromEntries(
      ["generate", "export", "validate", "import"].map((command) => [
        command,
        new RegExp("\\b" + command + "\\b", "i").test(help)
      ])
    );
    return { version: version.stdout.trim(), commands, helpHash: hash(help), help };
  }
  async capabilities(signal) {
    const settings = await this.settings();
    const key = await this.capabilityKey(settings);
    let pending = key ? capabilityCache.get(key) : void 0;
    if (!pending) {
      pending = this.storedCapabilities(key).then(
        (stored) => stored ?? this.probeCapabilities(settings, key).then((probed) => this.storeCapabilities(key, probed))
      );
      if (key) {
        capabilityCache.set(key, pending);
        pending.catch(() => {
          if (capabilityCache.get(key) === pending) capabilityCache.delete(key);
        });
      } else pending.catch(() => {
      });
    }
    return raceCancellation(pending, signal, "Capability check cancelled.");
  }
  async requireCapability(name, signal) {
    const capabilities = await this.capabilities(signal);
    if (!capabilities.commands[name])
      throw new Fault("UNSUPPORTED_CAPABILITY", `This SQLcl does not advertise apex ${name}.`, 3, "blocked");
    return { version: capabilities.version, helpHash: capabilities.helpHash };
  }
  /** Inspect selected-file support without connecting or trusting the generic APEX help. */
  async importHelp(signal) {
    const key = await this.capabilityKey(await this.settings());
    let pending = key ? importHelpCache.get(key) : void 0;
    if (!pending) {
      pending = this.storedImportHelp(key).then(
        (stored) => stored ?? this.session("help apex import").then((result) => result.output.replace(/\x1b\[[0-9;]*m/g, "")).then((help) => this.storeImportHelp(key, help))
      );
      if (key) {
        importHelpCache.set(key, pending);
        pending.catch(() => importHelpCache.delete(key));
      }
    }
    return raceCancellation(pending, signal, "Import capability check cancelled.");
  }
  /**
   * `help apex import` of an unchanged SQLcl installation, kept across processes like the
   * capabilities above: a deployment worker otherwise starts one more SQLcl JVM to read it.
   */
  async importHelpFile(key) {
    const file = await this.capabilityFile(key);
    return file?.replace(/\.json$/, ".import-help.json");
  }
  async storedImportHelp(key) {
    const file = await this.importHelpFile(key);
    if (!file) return void 0;
    try {
      const stored = await readJson(file);
      if (typeof stored.savedAt !== "number" || Date.now() - stored.savedAt > CAPABILITY_CACHE_MS || stored.savedAt > Date.now() || typeof stored.help !== "string" || !stored.help || stored.helpHash !== hash(stored.help))
        return void 0;
      return stored.help;
    } catch {
      return void 0;
    }
  }
  async storeImportHelp(key, help) {
    const file = await this.importHelpFile(key);
    if (file && help && key === await this.capabilityKey(await this.settings()))
      try {
        await mkdir5(path13.dirname(file), { recursive: true, mode: 448 });
        await writeJson(file, { savedAt: Date.now(), help, helpHash: hash(help) });
      } catch {
      }
    return help;
  }
  async partialImportCapabilities(source, target, signal) {
    const compiler = await this.requireCapability("import", signal);
    const settings = await this.settings();
    const help = await this.importHelp(signal);
    return evaluatePartialImportCompatibility({
      ...target,
      compilerVersion: compiler.version,
      mmdVersion: await sourceMmdVersion(source),
      importFiles: /(?:^|\s)-files(?:\s|\|)/m.test(help),
      mode: settings.mode,
      databaseTransport: settings.databaseTransport ?? "direct",
      helpHash: hash(help)
    });
  }
  async codeScan(source, signal) {
    const compiler = await this.capabilities(signal);
    if (!/Release 26\.3\./.test(compiler.version))
      return {
        status: "unavailable",
        findings: [],
        reason: "APEXlang CodeScan is qualified only for SQLcl 26.3."
      };
    const stage = await this.stage(), copy = path13.join(stage, "application");
    try {
      await cp3(source, copy, { recursive: true });
      const help = (await this.session("help codescan", void 0, false, signal)).output;
      if (!/\.apx\b/i.test(help) || !/-extensions\b/i.test(help))
        return {
          status: "unavailable",
          findings: [],
          reason: "Selected SQLcl does not advertise APEXlang CodeScan."
        };
      const result = await this.session(
        `codescan -path ${sqlclToken(copy)} -extensions apx -format json`,
        void 0,
        false,
        signal
      );
      return { status: "advisory", findings: parseCodeScan(result.output, copy) };
    } catch (error) {
      if (signal?.aborted || error instanceof Fault && error.code === "CANCELLED") throw error;
      return {
        status: "unavailable",
        findings: [],
        reason: error instanceof Error ? error.message : "CodeScan did not complete."
      };
    } finally {
      await this.discardStage(stage);
    }
  }
  async generate(name, alias) {
    const compiler = await this.requireCapability("generate");
    const stage = await this.stage();
    const result = await this.session(
      `apex generate -name ${sqlclToken(name)} -alias ${sqlclToken(parse(refName, alias))} -dir ${sqlclToken(stage)}`,
      void 0,
      false,
      void 0,
      stage,
      "text",
      void 0,
      // SQLcl 26.3 rejects freshly generated MMD when generation and validation
      // share a JVM. The cause is in the vendor process state. Keep
      // generation disposable; do not close pools used by other callers.
      /Release 26\.3\./.test(compiler.version)
    );
    const directory = await this.findApplication(stage);
    return { directory, compiler, output: result.output, files: await inventory(directory) };
  }
  async findApplication(root) {
    if (await exists(path13.join(root, "application.apx"))) return root;
    const found = [];
    for (const entry of await readdir5(root, { withFileTypes: true }))
      if (entry.isDirectory()) {
        const dir = path13.join(root, entry.name);
        if (await exists(path13.join(dir, "application.apx"))) found.push(dir);
        else
          for (const sub of await readdir5(dir, { withFileTypes: true }))
            if (sub.isDirectory() && await exists(path13.join(dir, sub.name, "application.apx")))
              found.push(path13.join(dir, sub.name));
      }
    if (found.length !== 1)
      throw new Fault(
        "ORACLE_OUTPUT_MISSING",
        "Expected exactly one generated/exported APEXlang application.",
        1
      );
    return found[0];
  }
  /**
   * `metadataFile` supplies Oracle-generated `.apex/apexlang.json` from elsewhere (the nearest
   * project) for a source tree without its own; it is copied into the staged copy only.
   */
  async validate(source, signal, options = {}) {
    const compiler = await this.requireCapability("validate", signal);
    const before = await inventory(source);
    const metadataFile = before[".apex/apexlang.json"] ? path13.join(source, ".apex/apexlang.json") : options.metadataFile;
    if (!metadataFile)
      throw new Fault(
        "MMD_METADATA_REQUIRED",
        "Preserve Oracle-generated .apex/apexlang.json before validation.",
        3
      );
    const metadata = await readFile7(metadataFile);
    const expected = { ...before, ".apex/apexlang.json": hash(metadata) };
    if (before[".apex/apexlang.json"] && before[".apex/apexlang.json"] !== expected[".apex/apexlang.json"])
      throw new Fault("SOURCE_DRIFT", "Metadata changed before validation.", 5);
    const stage = await this.stage(), copy = path13.join(stage, "application");
    let result;
    try {
      await cp3(source, copy, { recursive: true });
      if (!before[".apex/apexlang.json"]) {
        await mkdir5(path13.join(copy, ".apex"), { recursive: true });
        await cp3(metadataFile, path13.join(copy, ".apex/apexlang.json"));
      }
      if (canonical(await inventory(copy)) !== canonical(expected))
        throw new Fault("SOURCE_DRIFT", "Source changed while staging validation.", 5);
      result = await this.session(
        `apex validate -input ${sqlclToken(copy)}`,
        void 0,
        false,
        signal,
        stage,
        "text",
        void 0,
        false,
        "validate"
      );
    } catch (error) {
      if (error instanceof Fault && error.code === "ORACLE_COMMAND_FAILED" && !error.details?.diagnostics) {
        const output = typeof error.details?.output === "string" ? error.details.output : error.message;
        const details = await compilerDetails(output, source);
        if (details) throw new Fault("VALIDATION_FAILED", error.message, 1, "failed", details);
      }
      throw error;
    } finally {
      await this.discardStage(stage);
    }
    if (!compilerSucceeded(result.output)) throw await compilerFault(result.output, source);
    if (canonical(before) !== canonical(await inventory(source)))
      throw new Fault("SOURCE_DRIFT", "Source changed during validation.", 5);
    if (hash(await readFile7(metadataFile)) !== expected[".apex/apexlang.json"])
      throw new Fault("SOURCE_DRIFT", "Metadata changed during validation.", 5);
    return {
      status: "passed",
      compiler,
      mmd: JSON.parse(metadata.toString("utf8")),
      sourceDigest: hash(canonical(before)),
      output: result.output
    };
  }
  async exportApplication(env, connection, format = "APEXLANG") {
    const compiler = await this.requireCapability("export");
    const stage = await this.stage();
    const ords = (await this.settings()).databaseTransport === "ords";
    const exportRoot = ords ? path13.join(stage, "export") : stage;
    const result = ords ? {
      output: String(
        (await this.ordsBridge(
          {
            operation: "export",
            applicationId: env.applicationId,
            exportType: format,
            split: format === "APEXLANG",
            outputDirectory: exportRoot
          },
          connection,
          void 0,
          stage
        )).message ?? "Export successful"
      )
    } : await this.session(
      `apex export -applicationid ${env.applicationId} -exptype ${format} -skipExportDate -expOriginalIds -dir ${sqlclToken(stage)}`,
      connection,
      false,
      void 0,
      stage,
      "text",
      void 0,
      false,
      "export"
    );
    const directory = format === "APEXLANG" ? await this.findApplication(exportRoot) : exportRoot;
    const files = await inventory(directory);
    if (!Object.keys(files).length || format === "SQL" && !Object.keys(files).some((f) => f.endsWith(".sql")))
      throw new Fault("EMPTY_BACKUP", "Oracle export produced no usable files.", 1);
    return {
      directory,
      files,
      digest: hash(canonical(files)),
      format,
      compiler,
      output: result.output,
      stage
    };
  }
  /** Native page export; shared files use an explicitly bound full APEXlang observation. */
  async exportSelection(env, connection, selected, source, knownFiles = {}, exportScope = "selected") {
    if (!selected.length || new Set(selected).size !== selected.length || selected.some((file) => !(exportScope === "selected" ? scopedExportFile(file) : supportedFile(file))))
      throw new Fault(
        "PARTIAL_EXPORT_UNSUPPORTED",
        "Selection has no qualified native component export mapping.",
        3
      );
    const settings = await this.settings();
    if (settings.mode !== "cli" || (settings.databaseTransport ?? "direct") !== "direct")
      throw new Fault(
        "PARTIAL_EXPORT_UNSUPPORTED",
        "Component export requires direct SQLcl CLI transport.",
        3
      );
    const compiler = await this.requireCapability("export");
    const stage = await this.stage(), directory = path13.join(stage, "selection");
    await mkdir5(directory, { mode: 448 });
    try {
      if (exportScope === "full") {
        const exported = await this.exportApplication(env, connection, "APEXLANG");
        try {
          for (const file of selected) {
            const pageId = /^pages\/p(\d{5})/.exec(file)?.[1];
            const matches = Object.keys(exported.files).filter(
              (candidate) => pageId ? /^pages\/p(\d{5})/.exec(candidate)?.[1] === pageId : candidate === file
            );
            if (matches.length > 1)
              throw new Fault("PARTIAL_EXPORT_AMBIGUOUS", "Export has duplicate selected identities.", 5);
            if (!matches.length) continue;
            const target = await contained(directory, file);
            await mkdir5(path13.dirname(target), { recursive: true, mode: 448 });
            await cp3(await contained(exported.directory, matches[0]), target);
          }
          const files2 = await inventory(directory);
          return {
            directory,
            files: files2,
            digest: hash(canonical(files2)),
            format: "APEXLANG",
            compiler,
            output: exported.output,
            stage
          };
        } finally {
          await this.discardStage(exported.stage);
        }
      }
      const mappings = [];
      const queries = [];
      if (selected.some((file) => file.startsWith("pages/") && !knownFiles[file]))
        queries.push(
          "select 'PAGE' component_type, to_char(page_id) component_id, to_char(page_id) component_name from apex_application_pages where application_id = :p_app"
        );
      const metadata = queries.length ? await this.jsonQuery(queries.join(" union all "), connection, { p_app: env.applicationId }) : [];
      for (const file of selected) {
        const page = /^pages\/p(\d{5})/.exec(file);
        if (page) {
          const id = String(Number(page[1]));
          if (knownFiles[file] || metadata.some((row) => row.component_type === "PAGE" && row.component_id === id))
            mappings.push({ file, type: "PAGE", id });
        }
      }
      if (new Set(mappings.map((entry) => entry.type + ":" + entry.id)).size !== mappings.length)
        throw new Fault(
          "PARTIAL_EXPORT_AMBIGUOUS",
          "Multiple selected files map to one server component.",
          5
        );
      let output = "Selected components are absent; no previous source export required.";
      const outputs = [];
      const observed = /* @__PURE__ */ new Set();
      for (const [index, mapping] of mappings.entries()) {
        const exportDirectory = path13.join(stage, "component-" + (index + 1));
        await mkdir5(exportDirectory, { mode: 448 });
        const result = await this.session(
          `apex export -applicationid ${env.applicationId} -exptype APEXLANG -skipExportDate -expOriginalIds -dir ${sqlclToken(exportDirectory)} -expComponents ${sqlclToken(mapping.type + ":" + mapping.id)}`,
          connection,
          false,
          void 0,
          exportDirectory
        );
        outputs.push(result.output);
        const emitted = await inventory(exportDirectory);
        for (const [file] of Object.entries(emitted)) {
          if (!file.endsWith(".apx"))
            throw new Fault(
              "PARTIAL_EXPORT_SCOPE_FAILED",
              "Native export emitted an unexpected artifact.",
              5
            );
          const exportedPage = /(?:^|\/)pages\/p(\d{5})[-\w]*\.apx$/.exec(file);
          if (mapping.type !== "PAGE" || !exportedPage || mapping.id !== String(Number(exportedPage[1])) || observed.has(mapping.file))
            throw new Fault(
              "PARTIAL_EXPORT_SCOPE_FAILED",
              "Native export emitted an unselected or ambiguous page identity.",
              5
            );
          observed.add(mapping.file);
          const target = await contained(directory, mapping.file);
          await mkdir5(path13.dirname(target), { recursive: true, mode: 448 });
          await cp3(await contained(exportDirectory, file), target);
        }
      }
      if (outputs.length) output = outputs.join("\n");
      const files = await inventory(directory);
      return {
        directory,
        files,
        digest: hash(canonical(files)),
        format: "APEXLANG",
        compiler,
        output,
        stage
      };
    } catch (error) {
      await this.discardStage(stage);
      throw error;
    }
  }
  async connectionLocality(connection) {
    const selected = await this.selectedConnection(connection);
    if (selected.ords) {
      const host = new URL(selected.ords.url).hostname;
      if (!["localhost", "127.0.0.1", "[::1]"].includes(host))
        return { local: false, evidence: "remote-ords-endpoint" };
    }
    const endpoint = selected.ords ? { local: true, evidence: "effective-loopback-ords-endpoint" } : localConnectionEndpoint((await this.session("show connection", connection)).output);
    if (!endpoint.local) return endpoint;
    const rows = await this.jsonQuery(
      "select sys_context('USERENV','SERVER_HOST') server_host from dual",
      connection
    );
    const verified = typeof rows[0]?.server_host === "string" && await localServerHost(rows[0].server_host);
    return {
      local: verified,
      evidence: verified ? endpoint.evidence + "+local-server-identity" : "loopback-server-identity-unconfirmed"
    };
  }
  async databaseDependencies(schema, object, connection) {
    const identifier2 = /^(?:"(?:[^"]|"")+"|[A-Za-z][A-Za-z0-9_$#]*)$/;
    const parts = object.match(/"(?:[^"]|"")+"|[A-Za-z][A-Za-z0-9_$#]*/g) ?? [];
    if (!parts.length || parts.length > 2 || parts.join(".") !== object || !parts.every((part) => identifier2.test(part)))
      throw new Fault(
        "DATABASE_DEPENDENCY_UNRESOLVED",
        "Cannot resolve the reviewed object name for dependency inspection.",
        4
      );
    const value = (part) => part.startsWith('"') ? part.slice(1, -1).replaceAll('""', '"') : part.toUpperCase();
    if (parts.length === 2) schema = value(parts[0]);
    object = value(parts.at(-1));
    return this.jsonQuery(
      "select owner, name, type from all_dependencies where referenced_owner=:p_owner and referenced_name=:p_name order by owner,name,type",
      connection,
      { p_owner: schema, p_name: object }
    );
  }
  async savedConnections(signal) {
    const marker = `APEXREST_CONNECTIONS_${randomUUID2().replaceAll("-", "")}`;
    const result = await this.session(
      `prompt ${marker}_BEGIN
connmgr list -flat
prompt ${marker}_END`,
      void 0,
      false,
      signal
    );
    const lines = result.output.split(/\r?\n/).map((line) => line.trim());
    const start = lines.indexOf(`${marker}_BEGIN`), end = lines.indexOf(`${marker}_END`);
    if (start < 0 || end <= start)
      throw new Fault(
        "CONNECTION_LIST_UNCONFIRMED",
        "SQLcl did not return a complete saved connection list.",
        3
      );
    const names = [...new Set(lines.slice(start + 1, end).filter(Boolean))];
    return {
      source: "sqlcl-store",
      connections: names.map((name) => ({ name: parse(savedConnectionName, name) }))
    };
  }
  bindPreamble(bindings, ords) {
    return Object.entries(bindings).map(([key, value]) => {
      if (!/^p_[a-z_]+$/.test(key)) throw new Fault("INVALID_BIND", "Invalid internal bind name.", 2);
      const declaration = `variable ${key} ${typeof value === "number" ? "number" : "varchar2(1024)"}`;
      const literal = typeof value === "number" ? value : sqlLiteral(value);
      if (ords) {
        if (typeof value === "string" && /[\x00-\x1f\x7f-\x9f]/.test(value))
          throw new Fault(
            "INVALID_BIND",
            "ORDS metadata bind values cannot contain control characters.",
            2
          );
        return `${declaration} = ${typeof value === "number" ? value : `'${value}'`}`;
      }
      return `${declaration}
exec :${key} := ${literal};`;
    }).join("\n");
  }
  parseRows(output) {
    const start = output.indexOf("{"), end = output.lastIndexOf("}");
    if (start < 0) throw new Fault("EMPTY_QUERY_RESULT", "SQLcl did not return its JSON result envelope.", 1);
    let json;
    try {
      json = JSON.parse(output.slice(start, end + 1));
    } catch {
      throw new Fault("INVALID_ORACLE_JSON", "Cannot decode Oracle metadata result.", 1);
    }
    const resultSets = json.results;
    if (!Array.isArray(resultSets) || !Array.isArray(resultSets[0]?.items))
      throw new Fault("INVALID_ORACLE_JSON", "SQLcl result has no items collection.", 1);
    return resultSets[0].items;
  }
  async jsonQuery(sql, connection, bindings = {}, signal, label = "metadata-batch") {
    const ords = (await this.settings()).databaseTransport === "ords";
    const result = await this.session(
      `${this.bindPreamble(bindings, ords)}
set sqlformat json
${sql};`,
      connection,
      false,
      signal,
      void 0,
      "json",
      void 0,
      false,
      label
    );
    return this.parseRows(result.output);
  }
  /**
   * Several read-only queries in one SQLcl session. Each query's rows are
   * delimited by a private marker; a missing marker fails the whole batch and
   * never yields a partial result.
   */
  async jsonQueryBatch(queries, connection, signal, label = "metadata-batch", debugTimings = false) {
    if (!queries.length) return [];
    const ords = (await this.settings()).databaseTransport === "ords";
    const token = `APEXREST_ROWS_${randomUUID2().replaceAll("-", "")}`;
    const input = queries.map(
      (query, index) => `${this.bindPreamble(query.bindings ?? {}, ords)}
set sqlformat json
${debugTimings ? "set timing on\n" : ""}${query.sql};
${debugTimings ? "set timing off\n" : ""}prompt ${token}_${index}`
    ).join("\n");
    const result = await this.session(
      input,
      connection,
      false,
      signal,
      void 0,
      "json",
      void 0,
      false,
      label
    );
    const lines = result.output.replace(new RegExp(`}(?=${token}_\\d+[ \\t]*(?:\\r?\\n|$))`, "g"), "}\n").split(/\r?\n/);
    const rows = [];
    const statementMs = [];
    let from = 0;
    for (let index = 0; index < queries.length; index++) {
      const at = lines.findIndex((line, i) => i >= from && line.trim() === `${token}_${index}`);
      if (at < 0)
        throw new Fault("EMPTY_QUERY_RESULT", "SQLcl did not return every JSON result envelope.", 1);
      const block = lines.slice(from, at).join("\n");
      rows.push(this.parseRows(block));
      if (debugTimings) statementMs.push(parseStatementMs(block));
      from = at + 1;
    }
    if (debugTimings) recordStatementTimings(label, statementMs);
    return rows;
  }
  async identity(connection, signal) {
    const rows = await this.jsonQuery(
      "select sys_context('USERENV','DB_UNIQUE_NAME') db_unique_name, sys_context('USERENV','SERVICE_NAME') service_name, sys_context('USERENV','CURRENT_SCHEMA') parsing_schema from dual",
      connection,
      {},
      signal
    );
    if (rows.length !== 1) throw new Fault("IDENTITY_UNCONFIRMED", "Database identity was not confirmed.", 3);
    return rows[0];
  }
  /** Read-only release discovery, separate from identity checks for legacy callers. */
  async targetVersions(connection, signal) {
    const rows = await this.jsonQuery(targetVersionSql, connection, {}, signal);
    return this.parseTargetVersions(rows);
  }
  parseTargetVersions(rows) {
    const row = rows[0];
    if (rows.length !== 1 || typeof row?.apex_version !== "string" || typeof row.database_version !== "string" || !/^\d+\.\d+(?:\.\d+)*$/.test(row.apex_version) || !/^\d+\.\d+(?:\.\d+)*$/.test(row.database_version))
      throw new Fault(
        "TARGET_VERSION_UNCONFIRMED",
        "APEX and database releases could not be confirmed.",
        3,
        "blocked"
      );
    return { apexVersion: row.apex_version, databaseVersion: row.database_version };
  }
  async verifyTarget(env, connection, observed) {
    const rows = observed ?? await this.jsonQuery(
      targetIdentitySql,
      connection,
      {
        p_workspace: env.workspace,
        p_app_id: env.applicationId
      },
      void 0,
      "verifyTarget"
    );
    const identities = rows.filter((row) => row.target_record === "identity");
    if (identities.length !== 1)
      throw new Fault("IDENTITY_UNCONFIRMED", "Database identity was not confirmed.", 3);
    const identity = {
      db_unique_name: identities[0].db_unique_name,
      service_name: identities[0].service_name,
      parsing_schema: identities[0].parsing_schema
    };
    if (identity.db_unique_name !== env.databaseIdentity.dbUniqueName || identity.service_name !== env.databaseIdentity.serviceName || identity.parsing_schema !== env.parsingSchema)
      throw new Fault(
        "TARGET_MISMATCH",
        "Connection does not match the configured database/service/schema.",
        5,
        "conflict"
      );
    const workspaces = rows.filter((row) => row.target_record === "workspace").map((row) => ({ workspace_id: workspaceIdentifier(row.workspace_id), workspace: row.workspace }));
    if (workspaces.length !== 1)
      throw new Fault(
        "WORKSPACE_UNCONFIRMED",
        "Configured workspace is absent or inaccessible.",
        4,
        "blocked"
      );
    const applications = rows.filter((row) => row.target_record === "application").map((row) => ({
      application_id: row.application_id,
      alias: row.alias,
      owner: row.owner,
      workspace: row.workspace
    }));
    if (applications.length > 1 || applications.some((a) => a.workspace !== env.workspace || a.owner !== env.parsingSchema))
      throw new Fault(
        "APPLICATION_TARGET_MISMATCH",
        "Application belongs to a different workspace or parsing schema.",
        5
      );
    const instance = rows.find(
      (row) => row.target_record === "schema" && row.parsing_schema === env.parsingSchema
    )?.alias;
    if (typeof instance === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/u.test(instance)) {
      const { archived } = await new LocalDeploymentControl(env).reconcileSchemaInstance(instance);
      if (archived)
        process.stderr.write(
          `APEXREST: ${env.parsingSchema} was created at ${instance}, after the local migration history was written; that history belonged to an earlier schema and was moved to ${archived}.
`
        );
    }
    return { identity, workspace: workspaces[0], application: applications[0] ?? null };
  }
  /** Other applications of the workspace that already use this alias (APEX aliases are case-insensitive). */
  async aliasHolders(env, connection, alias) {
    const rows = await this.jsonQuery(
      `select application_id from apex_applications
        where workspace = :p_workspace and upper(alias) = upper(:p_alias) and application_id <> :p_app_id`,
      connection,
      { p_workspace: env.workspace, p_alias: alias, p_app_id: env.applicationId },
      void 0,
      "metadata-batch"
    );
    return rows.map((row) => Number(row.application_id)).filter((id) => Number.isFinite(id));
  }
  /** Fresh identity and versions share one read-only SQLcl session. */
  async versionedTarget(env, connection) {
    const [identity, versions] = await this.jsonQueryBatch(
      [
        { sql: targetIdentitySql, bindings: { p_workspace: env.workspace, p_app_id: env.applicationId } },
        { sql: targetVersionSql }
      ],
      connection
    );
    return {
      target: await this.verifyTarget(env, connection, identity),
      versions: this.parseTargetVersions(versions)
    };
  }
  async applicationMetadata(env, connection) {
    const rows = await this.jsonQuery(
      applicationMetadataSql,
      connection,
      { p_app_id: env.applicationId, p_workspace: env.workspace, p_owner: env.parsingSchema },
      void 0,
      "applicationMetadata"
    );
    return parseApplicationMetadata(rows);
  }
  async targetWithMetadata(env, connection) {
    const rows = await this.jsonQueryBatch(
      [
        { sql: targetIdentitySql, bindings: { p_workspace: env.workspace, p_app_id: env.applicationId } },
        {
          sql: applicationMetadataSql,
          bindings: { p_app_id: env.applicationId, p_workspace: env.workspace, p_owner: env.parsingSchema }
        }
      ],
      connection,
      void 0,
      "targetWithMetadata"
    );
    if (rows.length !== 2)
      throw new Fault("EMPTY_QUERY_RESULT", "SQLcl did not answer the complete target observation.", 1);
    const target = await this.verifyTarget(env, connection, rows[0]);
    return { target, metadata: parseApplicationMetadata(rows[1]) };
  }
  async nativeDeployment(ctx, env, source) {
    const output = path13.join(await this.stage(), "deployment.json");
    const defaults = path13.join(source, "deployments/default.json");
    const native = await exists(defaults) ? JSON.parse(await readFile7(defaults, "utf8")) : {};
    const oldApp = native.app ?? {};
    await writeJson(output, {
      ...native,
      app: {
        ...oldApp,
        id: env.applicationId,
        alias: ctx.config.application.alias,
        databaseSession: { ...oldApp.databaseSession ?? {}, parsingSchema: env.parsingSchema }
      },
      workspace: { name: env.workspace }
    });
    return output;
  }
  async importApplication(ctx, env, connection, source, signal, selectedFiles) {
    await this.requireCapability("import", signal);
    if (selectedFiles !== void 0) {
      const settings = await this.settings();
      if (settings.mode !== "cli" || (settings.databaseTransport ?? "direct") !== "direct")
        throw new Fault(
          "PARTIAL_IMPORT_TRANSPORT_UNSUPPORTED",
          "Partial import requires direct SQLcl CLI transport.",
          3,
          "blocked"
        );
      if (!selectedFiles.length || new Set(selectedFiles).size !== selectedFiles.length)
        throw new Fault(
          "PARTIAL_IMPORT_FILES_INVALID",
          "Select a nonempty, unique list of APEXlang files.",
          2
        );
      for (const file of selectedFiles) {
        if (!/^[A-Za-z0-9_./-]+\.apx$/.test(file) || path13.isAbsolute(file) || file.split("/").some((part) => !part || part === "." || part === ".."))
          throw new Fault(
            "PARTIAL_IMPORT_FILES_INVALID",
            "Partial-import files must be literal contained APEXlang paths without globs.",
            2
          );
        let valid = false;
        try {
          const physical = await realpath5(await contained(source, file));
          valid = path13.relative(await realpath5(source), physical).replaceAll(path13.sep, "/") === file && (await stat4(physical)).isFile();
        } catch {
        }
        if (!valid)
          throw new Fault(
            "PARTIAL_IMPORT_FILES_INVALID",
            "Partial-import files must be regular contained files without aliases.",
            2
          );
      }
      const help = await this.importHelp(signal);
      if (!/(?:^|\s)-files(?:\s|\|)/m.test(help))
        throw new Fault(
          "PARTIAL_IMPORT_UNSUPPORTED",
          "The selected SQLcl does not advertise apex import -files.",
          3,
          "blocked"
        );
    }
    const config = await this.nativeDeployment(ctx, env, source);
    try {
      return await this.importWith(env, connection, source, config, signal, selectedFiles);
    } finally {
      await this.discardStage(path13.dirname(config));
    }
  }
  warmImport;
  /**
   * Start loading the APEXlang compiler for an import of `source` that this
   * deployment is about to run (sqlcl-warm.ts). Returns nothing when the transport
   * is not a saved SQLcl connection in CLI mode; the import then runs as before.
   * The caller closes the returned handle when the deployment ends.
   *
   * A selected-file import names its files relative to SQLcl's working directory.
   * `importDirectory` is the existing directory that import will read; the server
   * starts in it and serves only a selected-file import of exactly that directory.
   * Without it the server serves a full import.
   */
  async prepareImport(source, connection, importDirectory) {
    if (warmImportDisabled() || this.runner !== runProcess || this.warmImport) return void 0;
    const settings = await this.settings();
    if (settings.mode !== "cli" || (settings.databaseTransport ?? "direct") !== "direct") return void 0;
    const selected = await this.selectedConnection(connection);
    if (!selected?.name || selected.ords) return void 0;
    const env = {
      ...process.env,
      SQLPATH: "",
      ORACLE_PATH: "",
      TNS_ADMIN: process.env.TNS_ADMIN,
      JAVA_HOME: settings.javaHome
    };
    delete env.NODE_OPTIONS;
    delete env.JAVA_TOOL_OPTIONS;
    delete env._JAVA_OPTIONS;
    delete env.JDK_JAVA_OPTIONS;
    env.JAVA_TOOL_OPTIONS = "-XX:ActiveProcessorCount=2";
    const server = new WarmImportServer({
      executable: settings.executable,
      cwd: importDirectory ?? await this.sessionHome(),
      env,
      restrictLevel: SCRIPT_RESTRICT_LEVEL,
      warmup: `apex validate -input ${sqlclToken(source)}`
    });
    const entry = {
      source: path13.resolve(source),
      server,
      ...importDirectory ? { importDirectory: path13.resolve(importDirectory) } : {}
    };
    this.warmImport = entry;
    return {
      close: async () => {
        if (this.warmImport === entry) this.warmImport = void 0;
        await server.close();
      }
    };
  }
  /**
   * The prepared server serves one import: a full import of any frozen copy of the application
   * it was started for, or a selected-file import of the directory it was started in. A server
   * prepared for the other kind is left for its owner to close.
   */
  takeWarmImport(source, selected) {
    const entry = this.warmImport;
    if (!entry || selected !== !!entry.importDirectory) return void 0;
    if (selected && entry.importDirectory !== path13.resolve(source)) return void 0;
    this.warmImport = void 0;
    return entry.server;
  }
  async importWith(env, connection, source, config, signal, selectedFiles) {
    if ((await this.settings()).databaseTransport === "ords") {
      await this.requireMutationSupport();
      const result2 = await this.ordsBridge(
        {
          operation: "import",
          input: source,
          deployment: config,
          applicationId: env.applicationId,
          workspace: env.workspace,
          parsingSchema: env.parsingSchema
        },
        connection,
        signal
      );
      return String(result2.message ?? "Import successful");
    }
    let result;
    try {
      result = await this.session(
        `apex import -input ${sqlclToken(source)} -deployment ${sqlclToken(config)} -workspace ${sqlclToken(env.workspace)} -schema ${sqlclToken(env.parsingSchema)} -id ${env.applicationId}${selectedFiles ? " -files " + selectedFiles.map((file) => sqlclToken(file)).join(" ") : ""}`,
        connection,
        true,
        signal,
        selectedFiles ? source : void 0,
        "text",
        SCRIPT_RESTRICT_LEVEL,
        false,
        "import",
        this.takeWarmImport(source, selectedFiles !== void 0)
      );
    } catch (error) {
      if (error instanceof Fault && error.code === "ORACLE_COMMAND_FAILED" && !error.details?.diagnostics) {
        const output = typeof error.details?.output === "string" ? error.details.output : error.message;
        error.details = { ...error.details, ...await compilerDetails(output, source) };
      }
      throw error;
    }
    if (!/import.*(?:success|complete)|successfully.*import/is.test(result.output))
      throw new Fault(
        "IMPORT_UNCONFIRMED",
        "Import returned without a tested success marker; reconcile the target.",
        6,
        "outcome_unknown"
      );
    return result.output;
  }
  async restoreApplication(env, connection, sql, signal) {
    const setup = `begin
 apex_application_install.set_workspace(${sqlLiteral(env.workspace)});
 apex_application_install.set_schema(${sqlLiteral(env.parsingSchema)});
 apex_application_install.set_application_id(${env.applicationId});
end;
/
`;
    const ords = (await this.settings()).databaseTransport === "ords";
    const stage = await this.stage();
    try {
      const input = path13.join(stage, "restore.sql");
      if (ords) {
        await this.requireMutationSupport();
        await atomicWrite(input, Buffer.concat([Buffer.from(setup), sql]));
        return await this.ordsBridge({ operation: "script", input }, connection, signal, stage);
      }
      await atomicWrite(input, sql);
      return await this.session(
        setup + `@${sqlclToken(input)}`,
        connection,
        true,
        signal,
        stage,
        "text",
        SCRIPT_RESTRICT_LEVEL
      );
    } finally {
      await this.discardStage(stage);
    }
  }
};
function parseCompilerDiagnostics(output) {
  const diagnostics = [];
  let current, values;
  const flush = () => {
    if (current?.file && current.type && current.message !== void 0)
      diagnostics.push({
        code: current.type,
        severity: current.severity ?? "error",
        file: current.file,
        line: current.line ?? 0,
        column: current.column ?? 0,
        type: current.type,
        message: current.message,
        ...values?.length ? { validValues: values } : {}
      });
    current = void 0;
    values = void 0;
  };
  for (const raw of output.replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n/)) {
    const line = raw.trimEnd();
    const field = line.match(/^\s*(File|Line|Column|Type|Error|Warning|Warn):\s?(.*)$/i);
    const name = field?.[1]?.toLowerCase();
    if (/^\s*(?:APEXlang Compile (?:Errors|Warnings):|Validation (?:successful|complete))/i.test(line)) {
      flush();
    } else if (name === "file") {
      flush();
      current = { file: field[2].trim() };
    } else if (!current) {
      const unlocated = /^\s*(?:\[(warn(?:ing)?|error)\]|(warn(?:ing)?|error):)\s*(.+)$/i.exec(line);
      if (unlocated) {
        const severity = /^warn/i.test(unlocated[1] ?? unlocated[2]) ? "warning" : "error";
        diagnostics.push({
          code: severity === "warning" ? "COMPILER_WARNING" : "COMPILER_ERROR",
          severity,
          file: "",
          line: 0,
          column: 0,
          type: severity === "warning" ? "COMPILER_WARNING" : "COMPILER_ERROR",
          message: unlocated[3]
        });
      }
    } else if (name === "line") current.line = Number(field[2]);
    else if (name === "column") current.column = Number(field[2]);
    else if (name === "type") current.type = field[2].trim();
    else if (name === "error" || name === "warning" || name === "warn") {
      current.message = field[2].trim();
      current.severity = name === "error" ? "error" : "warning";
    } else if (!line.trim()) flush();
    else if (current.message === void 0) continue;
    else {
      const valid = line.match(/^Valid (?:parameters|values|options) are\s*:\s*(.*)$/i);
      if (valid) values = valid[1].trim() ? [valid[1].trim()] : [];
      else if (values) values.push(line.trim().replace(/^-/, ""));
      else current.message += " " + line.trim();
    }
  }
  flush();
  return diagnostics;
}
async function diagnosticHint(root, diagnostic) {
  return diagnosticHintFromSource(root, diagnostic);
}
async function diagnosticHintFromSource(root, diagnostic, sourceLines) {
  if (!diagnostic.line || !/^INVALID_PROPERTY|MISSING_REQUIRED|_NOT_FOUND$|INVALID_/.test(diagnostic.type))
    return;
  try {
    const file = await contained(root, diagnostic.file);
    let pending = sourceLines?.get(file);
    if (!pending) {
      pending = readFile7(file, "utf8").then((text) => text.split(/\r?\n/));
      sourceLines?.set(file, pending);
    }
    const lines = await pending;
    const indent2 = (text) => text.match(/^\s*/)[0].length;
    const open4 = /^\s*([A-Za-z][\w-]*)(?:\s+([^\s({]+))?\s*[({]\s*$/;
    const chain = [];
    const reported = lines[diagnostic.line - 1] ?? "";
    const own = /^MISSING_REQUIRED/.test(diagnostic.type) && /\(\s*$/.test(reported) && open4.test(reported);
    let level = indent2(reported) + (own ? 1 : 0);
    for (let i = diagnostic.line - (own ? 1 : 2); i >= 0 && chain.length < 3; i--) {
      const text = lines[i];
      if (!text.trim() || indent2(text) >= level) continue;
      const match = text.match(open4);
      if (!match) continue;
      level = indent2(text);
      const kind = match[1], name = match[2];
      let label = name ? `${kind} ${name}` : kind;
      if (name) {
        for (let j = i + 1; j < lines.length && j < i + 40; j++) {
          const property = lines[j].match(/^\s*type:\s*(\S+)/);
          if (indent2(lines[j]) <= level && lines[j].trim()) break;
          if (property && indent2(lines[j]) === level + (indent2(lines[i + 1] ?? "") - level || 4)) {
            label += ` (type: ${property[1]})`;
            break;
          }
        }
      }
      chain.push(label);
    }
    return chain.length ? `inside ${chain.join(" of ")}` : void 0;
  } catch {
    return;
  }
}
async function compilerDetails(output, root) {
  const diagnostics = parseCompilerDiagnostics(output);
  if (root) {
    const sourceLines = /* @__PURE__ */ new Map();
    for (const diagnostic of diagnostics) {
      const hint = await diagnosticHintFromSource(root, diagnostic, sourceLines);
      if (hint) diagnostic.hint = hint;
      const fix = await propertyFix(diagnostic.type, diagnostic.message, hint);
      if (fix) diagnostic.hint = hint ? `${hint}. Fix: ${fix}` : `Fix: ${fix}`;
    }
  }
  return diagnostics.length ? { diagnostics, output } : void 0;
}
async function compilerFault(output, root) {
  const details = await compilerDetails(output, root);
  const count = details?.diagnostics.length ?? 0;
  const message = output.length > 4e3 ? `${output.slice(0, 4e3)}
\u2026 report truncated${count ? `; all ${count} diagnostics are in details.diagnostics` : ""}.` : output;
  return new Fault(
    details ? "VALIDATION_FAILED" : "VALIDATION_UNCONFIRMED",
    message || "Compiler returned no success marker.",
    1,
    "failed",
    details
  );
}
function compilerSucceeded(output) {
  const success = /validat(?:ion|ed).*?(?:success|complete)|successfully.*validat|compil(?:ation|ed).*?(?:success|complete)|successfully.*compil/is.test(
    output
  );
  const counted = [...output.matchAll(/\b(\d+)\s+(?:errors?|failures?)\b/gi)].some(
    (match) => Number(match[1]) > 0
  );
  const failed = /(?:^|\n)\s*(?:error\b|errors?:)|\bwith\s+errors?\b|compile\s+errors?|\bfail(?:ed|ure)\b|\bunsuccessful\b|\bnot\s+successful\b/i.test(
    output
  );
  return success && !counted && !failed && !parseCompilerDiagnostics(output).some((entry) => entry.severity === "error");
}
async function installSources(source, root, destination) {
  const target = await contained(root, destination);
  if (await exists(target))
    throw new Fault(
      "LOCAL_EDITS_CONFLICT",
      "Destination already exists; export remains in staging. Review and merge explicitly.",
      5,
      "conflict"
    );
  await mkdir5(path13.dirname(target), { recursive: true });
  const staging = await mkdtemp(path13.join(path13.dirname(target), ".apexrest-copy-"));
  await inventory(source);
  await cp3(source, staging, { recursive: true });
  await rename3(staging, target);
  return { directory: target, files: await inventory(target) };
}

// packages/core/src/project.ts
function resourceRoot() {
  return process.env.APEXREST_RESOURCES ?? path14.resolve(path14.dirname(fileURLToPath(import.meta.url)), "../resources");
}
async function projectInit(directory, template, alias) {
  parse(refName, alias);
  const destination = path14.resolve(directory);
  await mkdir6(path14.dirname(destination), { recursive: true });
  return withLock(destination + ".init.lock", async () => {
    if (await exists(destination)) {
      if (!(await lstat3(destination)).isDirectory() || (await readdir6(destination)).length)
        throw new Fault("LOCAL_EDITS_CONFLICT", "Project init requires an empty directory.", 5, "conflict");
    }
    const root = await mkdtemp2(destination + ".init-");
    try {
      const conflict = () => new Fault(
        "LOCAL_EDITS_CONFLICT",
        "Project init requires an empty folder or a new directory. Existing files were left unchanged.",
        5,
        "conflict"
      );
      if (!await exists(root)) await mkdir6(root, { recursive: true, mode: 448 });
      if (!(await lstat3(root)).isDirectory() || (await readdir6(root)).length !== 0) throw conflict();
      const createFile = async (file, content) => {
        try {
          await writeFile(file, content, { flag: "wx", mode: 384 });
        } catch (error) {
          if (error.code === "EEXIST") throw conflict();
          throw error;
        }
      };
      const config = {
        schemaVersion: 1,
        projectId: alias,
        application: { sourceDir: "src/apex/" + alias, alias },
        database: {
          migrationsDir: "src/database/migrations",
          packagesDir: "src/database/packages"
        },
        toolchain: { lockFile: "apexrest.toolchain.lock.json" },
        environments: {},
        artifacts: { directory: ".apexrest/artifacts", retentionDays: 7 }
      };
      await createFile(path14.join(root, "apexrest.json"), JSON.stringify(config, null, 2) + "\n");
      await createFile(path14.join(root, ".gitignore"), ".apexrest/\nnode_modules/\n.env\n");
      for (const dir of Object.values(config.database))
        await mkdir6(path14.join(root, dir), { recursive: true });
      await cp4(
        path14.join(resourceRoot(), "toolchains/toolchain.lock.json"),
        path14.join(root, config.toolchain.lockFile),
        { force: false, errorOnExist: true }
      );
      if (template !== "existing-app") {
        const generated = await new OracleAdapter().generate(alias, alias);
        await installSources(generated.directory, root, config.application.sourceDir);
        const release = await sourceRelease(path14.join(root, config.application.sourceDir));
        if (release === "26.2") {
          config.toolchain.profile = "26.2";
          await cp4(
            path14.join(resourceRoot(), "toolchains/toolchain-26.2.lock.json"),
            path14.join(root, config.toolchain.lockFile)
          );
          await atomicWrite(path14.join(root, "apexrest.json"), JSON.stringify(config, null, 2) + "\n");
        }
        if (template === "customer-crm") {
          await cp4(path14.join(resourceRoot(), "templates/customer-crm/project"), root, { recursive: true });
          await cp4(
            path14.join(
              resourceRoot(),
              "templates/customer-crm",
              release === "26.2" ? "apex-overlay-26.2" : "apex-overlay"
            ),
            path14.join(root, config.application.sourceDir),
            { recursive: true }
          );
          const { readFile: readFile8 } = await import("node:fs/promises");
          const file = path14.join(
            root,
            config.application.sourceDir,
            release === "26.2" ? "shared-components/lists/navigation-menu.apx" : "shared-components/lists.apx"
          );
          const lists = await readFile8(file, "utf8"), index = lists.lastIndexOf(")");
          if (index < 0 || !lists.includes("list navigation-menu ("))
            throw new Fault(
              "UNSUPPORTED_TEMPLATE",
              "Starter navigation does not match the reviewed fixture.",
              3
            );
          const entries = ["customers", "dashboard"].map(
            (label, i) => `    entry ${label} (
        label: ${label[0].toUpperCase() + label.slice(1)}
        layout {
            sequence: ${(i + 2) * 10}
        }
        link {
            target: {
                page: ${(i + 1) * 10}
            }
        }
    )
`
          ).join("");
          await atomicWrite(file, lists.slice(0, index) + entries + lists.slice(index));
        }
      }
      if (await exists(destination)) {
        if ((await readdir6(destination)).length) throw conflict();
        const moved = [];
        try {
          for (const entry of await readdir6(root)) {
            await rename4(path14.join(root, entry), path14.join(destination, entry));
            moved.push(entry);
          }
        } catch (error) {
          for (const entry of moved.reverse())
            await rename4(path14.join(destination, entry), path14.join(root, entry));
          throw error;
        }
      } else await rename4(root, destination);
      return {
        root: destination,
        template,
        configuration: config,
        nextActions: [
          "Configure explicit target identity and connection references.",
          "Review the target and sources; the application task authorizes its dev/QA/test import."
        ]
      };
    } finally {
      await rm6(root, { recursive: true, force: true });
    }
  }).catch((error) => {
    if (error instanceof Fault && error.code === "LOCKED")
      throw new Fault(
        "LOCAL_EDITS_CONFLICT",
        "Another project initialization owns this directory.",
        5,
        "conflict"
      );
    throw error;
  });
}
function projectSummary(ctx) {
  const environments = Object.entries(ctx.config.environments);
  return {
    projectId: ctx.config.projectId,
    root: ctx.root,
    sourceDirectories: {
      apex: ctx.config.application.sourceDir,
      ...ctx.config.database
    },
    toolchainLock: ctx.config.toolchain.lockFile,
    verification: "host-browser",
    authoring: "Pin toolchain.profile to 26.1/26.2; project action:scaffold with specFile supports IR/classic reports, form controls, cards, charts, calendars, navigation and server processes; custom components: reference mode:select",
    environments: environments.slice(0, 8).map(([name, env]) => ({
      name,
      kind: env.kind,
      applicationId: env.applicationId,
      workspace: env.workspace,
      parsingSchema: env.parsingSchema
    })),
    environmentsOmitted: Math.max(0, environments.length - 8),
    targetVerified: false
  };
}
async function projectInspect(ctx, detail = "full") {
  return detail === "summary" ? projectSummary(ctx) : projectInventory(ctx);
}
async function projectInventory(ctx) {
  const sources = {};
  for (const [kind, relative] of Object.entries({
    apex: ctx.config.application.sourceDir,
    ...ctx.config.database
  })) {
    const dir = await contained(ctx.root, relative);
    sources[kind] = await exists(dir) ? await inventory(dir) : null;
  }
  return {
    projectId: ctx.config.projectId,
    root: ctx.root,
    configurationDigest: hash(canonical(ctx.config)),
    environments: Object.entries(ctx.config.environments).map(([name, env]) => ({
      name,
      kind: env.kind,
      applicationId: env.applicationId,
      workspace: env.workspace
    })),
    sources
  };
}

export {
  readLocalEnv,
  savedConnectionName,
  ordsUrl,
  ordsUsername,
  connections,
  resolveConnection,
  editConnection,
  configureConnection,
  coordination,
  LocalDeploymentControl,
  VERSION,
  syncPath,
  privateCopy,
  checkSnapshot,
  checkSyncBackup,
  checkpoint,
  SyncStore,
  APEXLANG_EQUIVALENCE_POLICY,
  compareApplicationExports,
  importSelectionSchema,
  importOptions,
  sourceRelease,
  supportedFile,
  scopedExportFile,
  pickFiles,
  overlaySelection,
  changedFiles,
  selectImport,
  persistSnapshot,
  stageSelection,
  rebaseAfterImport,
  resourceRoot,
  projectInit,
  projectInspect,
  referenceWords,
  buildReferencePostings,
  referenceStem,
  referenceTerms,
  referenceStems,
  stemmedReference,
  referenceQueryTerms,
  queryPhrase,
  routingReference,
  navigationalQuery,
  primaryCodeBlock,
  boundCode,
  codeWanted,
  CODE_LIMIT,
  SEARCH_LINKS,
  fitResults,
  identifierQuery,
  canonicalReference,
  scoreReference,
  componentExample,
  contractComponentType,
  contractComponent,
  pageExamples,
  componentNote,
  exampleValues,
  contractSkeleton,
  sqlclMode,
  sqlclRestriction,
  databaseTransport,
  sqlclConfig,
  configureSqlcl,
  withConnectedReads,
  APEX_262_PROFILE,
  databaseMeetsApex262Minimum,
  auditUpgradeSource,
  targetIdentitySql,
  sqlclToken,
  SCRIPT_RESTRICT_LEVEL,
  OracleAdapter,
  installSources,
  oracle_exports
};
