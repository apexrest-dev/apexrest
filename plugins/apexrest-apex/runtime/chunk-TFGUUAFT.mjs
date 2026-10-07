import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  external_exports
} from "./chunk-U7MVLA3R.mjs";
import {
  Fault,
  canonical,
  contained,
  exists,
  hash,
  readJson,
  withLock,
  writeJson
} from "./chunk-I5KYBPSK.mjs";

// packages/core/src/config.ts
import path from "node:path";
import { homedir } from "node:os";
import { mkdir, realpath } from "node:fs/promises";
var identifier = external_exports.string().regex(/^[A-Za-z][A-Za-z0-9_$#]{0,127}$/);
var refName = external_exports.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/);
var relativePath = external_exports.string().min(1).max(1024).refine(
  (s) => !path.isAbsolute(s) && !s.split(/[\\/]/).includes("..") && !/[\x00-\x1f]/.test(s),
  "Expected a contained relative path"
);
var environmentSchema = external_exports.strictObject({
  kind: external_exports.enum(["development", "dev", "qa", "test", "production"]),
  readConnectionRef: refName,
  deployConnectionRef: refName,
  workspace: identifier,
  parsingSchema: identifier,
  applicationId: external_exports.number().int().positive(),
  baseUrl: external_exports.url(),
  databaseIdentity: external_exports.strictObject({ dbUniqueName: external_exports.string().min(1), serviceName: external_exports.string().min(1) }),
  allowedOrigins: external_exports.array(external_exports.url()).default([]),
  expectedMarker: external_exports.string().min(1).optional()
});
var projectSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  projectId: refName,
  application: external_exports.strictObject({ sourceDir: relativePath, alias: refName }),
  database: external_exports.strictObject({
    migrationsDir: relativePath,
    packagesDir: relativePath
  }),
  toolchain: external_exports.strictObject({ lockFile: relativePath, profile: external_exports.enum(["26.1", "26.2"]).optional() }),
  environments: external_exports.record(refName, environmentSchema),
  // Legacy local coordination is now the default; retained for old project files.
  deploymentControl: external_exports.literal("local").optional(),
  composer: external_exports.strictObject({ allowSourceOnly: external_exports.boolean().default(false) }).optional(),
  artifacts: external_exports.strictObject({ directory: relativePath, retentionDays: external_exports.number().int().min(1).max(365) })
});
var managedHome = () => path.resolve(process.env.APEXREST_HOME ?? path.join(homedir(), ".apexrest"));
function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new Fault(
      "INVALID_INPUT",
      result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      2
    );
  return result.data;
}
async function loadProject(root) {
  const physical = await realpath(root);
  const file = await contained(physical, "apexrest.json");
  if (!await exists(file))
    throw new Fault(
      "PROJECT_NOT_CONFIGURED",
      "No apexrest.json at the requested project root.",
      3,
      "not_configured"
    );
  const value = await readJson(file);
  const { tests: _tests, ...current } = value;
  if (current.database && typeof current.database === "object" && !Array.isArray(current.database)) {
    const { testsDir: _testsDir, ...database } = current.database;
    current.database = database;
  }
  const config = parse(projectSchema, current);
  for (const p of [
    config.application.sourceDir,
    ...Object.values(config.database),
    config.toolchain.lockFile,
    config.artifacts.directory
  ])
    await contained(physical, p);
  return { root: physical, config };
}
function environment(ctx, name) {
  if (!name) throw new Fault("ENVIRONMENT_REQUIRED", "Select an explicit environment with --env.", 2);
  const env = ctx.config.environments[name];
  if (!env) throw new Fault("UNKNOWN_ENVIRONMENT", `Environment ${name} is not configured.`, 2);
  return env;
}
function targetDigest(env) {
  return hash(
    canonical({
      ...env.databaseIdentity,
      workspace: env.workspace,
      schema: env.parsingSchema,
      applicationId: env.applicationId
    })
  );
}
var policySchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  // Legacy compatibility only; host filesystem permissions govern project access.
  trustedProjects: external_exports.array(external_exports.string()).optional(),
  grants: external_exports.array(
    external_exports.strictObject({
      projectRoot: external_exports.string(),
      targetDigest: external_exports.string().regex(/^[a-f0-9]{64}$/),
      expiresAt: external_exports.iso.datetime(),
      operations: external_exports.array(external_exports.literal("deploy")),
      planDigest: external_exports.string().regex(/^[a-f0-9]{64}$/).optional(),
      // A grant recorded by apexrest_ship keeps the user's literal instruction
      // and its origin so the authorization record stays auditable.
      note: external_exports.string().max(2e3).optional(),
      grantedBy: external_exports.enum(["user", "ship"]).optional(),
      grantedAt: external_exports.iso.datetime().optional(),
      workerPid: external_exports.number().int().positive().optional(),
      confirmedRisks: external_exports.array(external_exports.string()).optional(),
      confirmationRequest: external_exports.string().min(1).max(2e3).optional()
    })
  )
});
var policyFile = () => path.join(managedHome(), "policy.json");
async function policy() {
  const file = policyFile();
  return await exists(file) ? parse(
    policySchema,
    await readJson(file).then((value) => {
      const current = value;
      if (Array.isArray(current.grants))
        current.grants = current.grants.map((grant) => ({
          ...grant,
          ...Array.isArray(grant.operations) ? { operations: grant.operations.filter((operation) => operation !== "test") } : {}
        }));
      return current;
    })
  ) : { schemaVersion: 1, grants: [] };
}
async function updatePolicy(mutate) {
  await mkdir(managedHome(), { recursive: true, mode: 448 });
  return withLock(path.join(managedHome(), "policy.lock"), async () => {
    const next = parse(policySchema, mutate(await policy()));
    await writeJson(policyFile(), next);
    return next;
  });
}
var sha256 = external_exports.string().regex(/^[a-f0-9]{64}$/);
var productionTrustSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  approvalKeys: external_exports.array(external_exports.strictObject({ sha256, reviewer: external_exports.string().min(1).optional() })).optional(),
  productionTargets: external_exports.array(sha256)
});
var productionTrustFile = () => path.join(managedHome(), "production-trust.json");
async function readProductionTrust(file) {
  try {
    return parse(productionTrustSchema, await readJson(file));
  } catch (error) {
    throw new Fault(
      "PRODUCTION_TRUST_INVALID",
      `Production trust file ${file} is unreadable or invalid: ${error instanceof Error ? error.message : "unknown error"}`,
      4,
      "blocked"
    );
  }
}
async function isProductionTarget(env, digest = targetDigest(env)) {
  if (env.kind === "production") return true;
  const file = productionTrustFile();
  if (!await exists(file)) return false;
  return (await readProductionTrust(file)).productionTargets.includes(digest);
}

export {
  identifier,
  refName,
  relativePath,
  managedHome,
  parse,
  loadProject,
  environment,
  targetDigest,
  policy,
  updatePolicy,
  isProductionTarget
};
