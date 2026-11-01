import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  isProductionTarget,
  managedHome,
  parse,
  refName,
  relativePath,
  targetDigest
} from "./chunk-RNEE4V2Z.mjs";
import {
  runPooledSqlcl
} from "./chunk-U46X3ZLW.mjs";
import {
  recordSqlclTiming,
  recordStatementTimings,
  runProcess,
  runSqlclMcp
} from "./chunk-XYDSY3MB.mjs";
import {
  external_exports
} from "./chunk-W7MSMS56.mjs";
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
} from "./chunk-7UXC37DJ.mjs";
import {
  Fault,
  __export
} from "./chunk-CCPOHUCO.mjs";

// plugins/metadata.json
var metadata_default = {
  name: "apexrest-apex",
  version: "2.5.0",
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

// packages/core/src/project.ts
import path12 from "node:path";
import { cp as cp4, mkdir as mkdir5, lstat as lstat3, readdir as readdir3, writeFile, mkdtemp as mkdtemp2, rm as rm6, rename as rename3 } from "node:fs/promises";
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
  oracleDiagnostics: () => oracleDiagnostics,
  parseCompilerDiagnostics: () => parseCompilerDiagnostics,
  parseStatementMs: () => parseStatementMs,
  resetCapabilityCache: () => resetCapabilityCache,
  sqlLiteral: () => sqlLiteral,
  sqlclToken: () => sqlclToken,
  targetIdentitySql: () => targetIdentitySql
});
import { performance } from "node:perf_hooks";
import path11 from "node:path";
import { randomUUID } from "node:crypto";
import { cp as cp3, mkdir as mkdir4, mkdtemp, readFile as readFile5, readdir as readdir2, realpath as realpath4, rename as rename2, rm as rm5, stat as stat3 } from "node:fs/promises";

// packages/core/src/connections.ts
import path2 from "node:path";
import { chmod, constants as constants2, lstat, mkdir, open as open2, rm, stat } from "node:fs/promises";

// packages/core/src/local-env.ts
import path from "node:path";
import { constants, open, realpath } from "node:fs/promises";
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
  const requested = path.resolve(file), physical = await realpath(requested);
  if (requested !== physical)
    throw new Fault("ENV_FILE_UNSAFE", "Credential ENV paths cannot use symlink aliases.", 2);
  const cwd = path.dirname(physical);
  const root = await runProcess({
    executable: "git",
    args: ["rev-parse", "--show-toplevel"],
    cwd,
    timeoutMs: 5e3
  });
  if (root.code !== 0)
    throw new Fault("ENV_FILE_UNSAFE", "Credential ENV files must belong to a Git working tree.", 2);
  const relative = path.relative(root.stdout.trim(), physical);
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
  const handle = await open(physical, constants.O_RDONLY | constants.O_NOFOLLOW);
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
  return contained(managedHome(), path2.join("credentials", name + ".json"));
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
  if (process.platform !== "win32" && ((await stat(file)).mode & 63) !== 0)
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
  const file = path2.join(managedHome(), "connections.json");
  return await exists(file) ? parse(storeSchema, await readJson(file)) : {};
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
  return withLock(path2.join(managedHome(), "connections.lock"), async () => {
    const current = await connections();
    let credentialsDeleted = false;
    if (value) current[name] = parse(connectionSchema, { ...current[name], ...value });
    else {
      delete current[name];
      const file = await credentialPath(name);
      credentialsDeleted = await exists(file);
      await rm(file, { force: true });
    }
    await writeJson(path2.join(managedHome(), "connections.json"), current);
    return { name, status: value ? "configured" : "removed", credentialsDeleted };
  });
}
async function readPasswordFile(file) {
  let handle;
  let before;
  try {
    before = await lstat(file);
    if (before.isSymbolicLink() || !before.isFile())
      throw new Fault("PASSWORD_FILE_UNSAFE", "The password file must be a regular non-symlink file.", 2);
    handle = await open2(file, constants2.O_RDONLY | (constants2.O_NOFOLLOW ?? 0));
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
    const current = await lstat(file);
    if (!info.isFile() || !current.isFile() || current.isSymbolicLink() || before.dev !== info.dev || before.ino !== info.ino || current.dev !== info.dev || current.ino !== info.ino)
      throw new Fault("PASSWORD_FILE_UNSAFE", "The password file changed or is not a regular file.", 2);
    if (process.platform !== "win32" && (info.mode & 63) !== 0)
      throw new Fault(
        "PASSWORD_FILE_UNSAFE",
        "The password file must only be accessible by its owner (chmod 600).",
        2
      );
    return await handle.readFile("utf8");
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
  return withLock(path2.join(managedHome(), "connections.lock"), async () => {
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
      const file = path2.resolve(input.passwordFile);
      const roots = [managedHome(), ...input.project ? [path2.resolve(input.project)] : [], process.cwd()];
      const inside = (root) => {
        const relative = path2.relative(root, file);
        return relative !== "" && !relative.startsWith("..") && !path2.isAbsolute(relative);
      };
      if (!roots.some(inside))
        throw new Fault(
          "PASSWORD_FILE_UNSAFE",
          "The password file must be inside the managed home, the project directory or the current working directory.",
          2
        );
      password = (await readPasswordFile(file)).replace(/\r?\n$/, "");
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
        await mkdir(folder, { recursive: true, mode: 448 });
        if (process.platform !== "win32") await chmod(folder, 448);
        await writeJson(await credentialPath(name), { ...ords, password: checkPassword(password) });
      } else {
        references.set(value, name);
        await ordsCredentials(value);
      }
    }
    current[name] = value;
    await writeJson(path2.join(managedHome(), "connections.json"), current);
    return { name, status: "configured" };
  });
}

// packages/core/src/sqlcl-config.ts
import path3 from "node:path";
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
  return withLock(path3.join(home, "sqlcl-config.lock"), async () => {
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

// packages/core/src/ords.ts
import path4 from "node:path";
import { realpath as realpath2, rm as rm2 } from "node:fs/promises";
async function sqlclHome(executable) {
  const candidates = path4.isAbsolute(executable) ? [executable] : executable.includes(path4.sep) ? [path4.resolve(executable)] : (process.env.PATH ?? "").split(path4.delimiter).flatMap(
    (directory) => process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"].map((extension) => path4.join(directory, executable + extension)) : [path4.join(directory, executable)]
  );
  for (const candidate of candidates) {
    if (!await exists(candidate)) continue;
    const home = path4.dirname(path4.dirname(await realpath2(candidate)));
    if (await exists(path4.join(home, "lib", "jdbcrest.jar"))) return home;
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
    ...[javaHome, process.env.JAVA_HOME].filter((home) => !!home).map((home) => ({ executable: path4.join(home, "bin", executableName), javaHome: home })),
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
  const helper = path4.join(resourceRoot(), "ords", "OrdsBridge.java");
  if (!await exists(helper))
    throw new Fault("ORDS_HELPER_REQUIRED", "The installed plugin is missing its ORDS helper.", 3, "blocked");
  const jobFile = path4.join(stage, "ords-job.json");
  const output = path4.join(stage, "ords-result.json");
  await rm2(output, { force: true });
  await writeJson(jobFile, { ...job, output });
  const env = { ...process.env, JAVA_HOME: settings.javaHome };
  delete env.NODE_OPTIONS;
  delete env.JAVA_TOOL_OPTIONS;
  delete env._JAVA_OPTIONS;
  delete env.JDK_JAVA_OPTIONS;
  const java = await resolveOrdsJava(settings.javaHome, stage, env, signal, runner);
  env.JAVA_HOME = java.javaHome;
  const processResult = await runner({
    executable: java.executable,
    args: [
      "-cp",
      [path4.join(home, "lib", "*"), path4.join(home, "lib", "ext", "*")].join(path4.delimiter),
      helper,
      jobFile
    ],
    cwd: stage,
    env,
    input: credentials ? JSON.stringify(credentials) : "",
    timeoutMs: 18e4,
    ...signal ? { signal } : {}
  });
  const mutation = job.operation === "import" || job.operation === "script";
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
import path5 from "node:path";
import { readFile } from "node:fs/promises";
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
    const value = JSON.parse(await readFile(path5.join(source, ".apex/apexlang.json"), "utf8"));
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
import path6 from "node:path";
import { readFile as readFile2, stat as stat2, opendir } from "node:fs/promises";
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
    const file = path6.relative(source, path6.resolve(source, entry.file)).replaceAll(path6.sep, "/");
    if (!file || file.startsWith("../") || path6.isAbsolute(file))
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
    for await (const entry of await opendir(path6.join(source, relative))) {
      if (++inspected > 1e4) {
        traversalTruncated = true;
        break discovery;
      }
      const file = path6.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) skipped.push(file);
      else if (entry.isDirectory()) directories.push(file);
      else if (entry.isFile() && /\.(?:apx|sql|js)$/i.test(file)) files.push(file);
    }
  }
  files.sort();
  let bytes = 0, scannedFiles = 0;
  for (const file of files) {
    const absolute = path6.join(source, file), size = (await stat2(absolute)).size;
    if (size > 1024 * 1024 || bytes + size > 16 * 1024 * 1024 || scannedFiles >= 2e3) {
      skipped.push(file);
      continue;
    }
    bytes += size;
    scannedFiles++;
    const lines = (await readFile2(absolute, "utf8")).split(/\r?\n/);
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
import { hostname } from "node:os";
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
  if (loopback(host) || host === hostname().toLowerCase()) return true;
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
      const list = await runProcess({ executable, args: ["ps", "-q"], cwd: process.cwd(), timeoutMs: 5e3 });
      const ids = list.stdout.trim().split(/\s+/).filter((id) => /^[a-f0-9]{12,64}$/.test(id));
      if (list.code !== 0 || !ids.length) continue;
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

// packages/core/src/partial-import.ts
import path10 from "node:path";
import { cp as cp2, mkdir as mkdir3, rename, rm as rm4 } from "node:fs/promises";

// packages/core/src/sync.ts
import path8 from "node:path";
import { lstat as lstat2, mkdir as mkdir2, readdir, realpath as realpath3, open as open3, cp, chmod as chmod2 } from "node:fs/promises";

// packages/core/src/deployment-control.ts
import path7 from "node:path";
import { hostname as hostname2 } from "node:os";
import { rm as rm3 } from "node:fs/promises";
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
var packagesSchema = external_exports.record(external_exports.string(), external_exports.string().regex(/^[a-f0-9]{64}$/));
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
  constructor(env) {
    const key = hash(canonical({ ...env.databaseIdentity, schema: env.parsingSchema }));
    this.directory = path7.join(managedHome(), "deployment-control", key);
  }
  file(name) {
    return path7.join(this.directory, name);
  }
  async history() {
    const file = this.file("history.json");
    return await exists(file) ? parse(historySchema, await readJson(file)) : [];
  }
  /**
   * Checksum of each package script last applied successfully, by project-relative file. Package
   * scripts are re-runnable, so a plan only re-applies the ones that changed since then.
   */
  async packages(projectId) {
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
    const file = this.file("active.json");
    try {
      return parse(ownerSchema, await readJson(file));
    } catch (error) {
      if (error.code === "ENOENT") return void 0;
      throw error;
    }
  }
  async acquire(runId) {
    await withLock(this.file("control.lock"), async () => {
      const owner = await this.owner();
      if (owner) {
        let dead = false;
        if (owner.hostname === hostname2()) {
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
        hostname: hostname2(),
        phase: "preparing",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    });
  }
  async assertOwner(runId) {
    const owner = await this.owner();
    if (owner?.runId !== runId || owner.pid !== process.pid || owner.hostname !== hostname2())
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
      await rm3(this.file("active.json"));
    });
  }
  /** Release only the reconciled run after its worker has stopped. Keep history. */
  async claimReconciled(runId) {
    await withLock(this.file("control.lock"), async () => {
      const owner = await this.owner();
      if (!owner) {
        await writeJson(this.file("active.json"), {
          runId,
          pid: process.pid,
          hostname: hostname2(),
          phase: "preparing",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        return;
      }
      if (owner.runId !== runId || owner.hostname !== hostname2())
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
  for (const part of path8.relative(ctx.root, file).split(path8.sep).filter(Boolean)) {
    probe = path8.join(probe, part);
    if (await exists(probe)) {
      if ((await lstat2(probe)).isSymbolicLink())
        throw new Fault("SYNC_PATH_UNSAFE", "Working-copy storage rejects symlinks.", 5);
    }
  }
  return file;
}
async function privateCopy(source, destination) {
  await cp(source, destination, { recursive: true });
  async function secure(directory) {
    await chmod2(directory, 448);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Fault("SYNC_PATH_UNSAFE", "Private copies reject symlinks.", 5);
      const file = path8.join(directory, entry.name);
      if (entry.isDirectory()) await secure(file);
      else if (entry.isFile()) await chmod2(file, 384);
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
    for (const entry of await readdir(base, { withFileTypes: true })) {
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
    const { readFile: readFile6 } = await import("node:fs/promises");
    if (state.projectRoot !== await realpath3(this.ctx.root) || state.projectId !== this.ctx.config.projectId || state.environment !== this.name || state.targetDigest !== targetDigest(this.env) || state.sourceDir !== this.ctx.config.application.sourceDir || state.runtimeVersion !== VERSION || state.toolchainDigest !== hash(await readFile6(await contained(this.ctx.root, this.ctx.config.toolchain.lockFile))) || await isProductionTarget(this.env))
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
    await mkdir2(path8.dirname(file), { recursive: true, mode: 448 });
    const journalFile = await syncPath(this.ctx, ".apexrest/sync/" + valid.targetDigest + "/journal.jsonl");
    const journal = await open3(journalFile, "a", 384);
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
    const directory = process.platform !== "win32" ? await open3(path8.dirname(file), "r") : null;
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
import path9 from "node:path";
import { readFile as readFile3 } from "node:fs/promises";
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
    result.push({ ...node, children });
  }
  return result;
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
    if (expectedFiles[file] && actualFiles[file] && allowed.has(file) && path9.posix.extname(file) === ".apx") {
      const [expected, actual] = await Promise.all([
        readFile3(await contained(expectedRoot, file)),
        readFile3(await contained(actualRoot, file))
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
    if (!relativePath.safeParse(file).success || /[\\*?\[\]]/.test(file) || /^[A-Za-z]:/.test(file) || file.startsWith("-") || path10.posix.normalize(file) !== file || file === ".")
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
    const value = await readJson(path10.join(root, ".apex/apexlang.json"));
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
    if (!observed[file]) await rm4(target, { force: true });
    else {
      await mkdir3(path10.dirname(target), { recursive: true, mode: 448 });
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
  await mkdir3(path10.dirname(destination), { recursive: true, mode: 448 });
  await privateCopy(source, destination);
  const files = await inventory(destination);
  return { directory, files, digest: hash(canonical(files)) };
}
async function stageSelection(ctx, before, localRoot, files, expected, directory) {
  const root = await syncPath(ctx, directory);
  await mkdir3(path10.dirname(root), { recursive: true, mode: 448 });
  await privateCopy(await syncPath(ctx, before.directory), root);
  for (const file of files) {
    const destination = await contained(root, file);
    await mkdir3(path10.dirname(destination), { recursive: true, mode: 448 });
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
    if (!server.files[file]) await rm4(destination, { force: true });
    else {
      await mkdir3(path10.dirname(destination), { recursive: true });
      await cp2(await contained(await syncPath(ctx, server.directory), file), destination);
    }
  }
  if (canonical(await inventory(localRoot)) !== canonical(reviewedLocal))
    throw new Fault(
      "LOCAL_RECONCILIATION_REQUIRED",
      "Import confirmed; concurrent local edits prevented rebase.",
      5
    );
  await rename(localRoot, retained);
  if (canonical(await inventory(retained)) !== canonical(reviewedLocal)) {
    await rename(retained, localRoot);
    throw new Fault(
      "LOCAL_RECONCILIATION_REQUIRED",
      "Import confirmed; concurrent local edits were preserved.",
      5
    );
  }
  try {
    await rename(replacement, localRoot);
  } catch (error) {
    await rename(retained, localRoot);
    throw error;
  }
}

// packages/core/src/oracle.ts
var targetIdentitySql = `select 'identity' target_record,
        sys_context('USERENV','DB_UNIQUE_NAME') db_unique_name,
        sys_context('USERENV','SERVICE_NAME') service_name,
        sys_context('USERENV','CURRENT_SCHEMA') parsing_schema,
        null workspace_id, null workspace, null application_id, null alias, null owner
       from dual
       union all
       select 'workspace', null, null, null, workspace_id, workspace, null, null, null
       from apex_workspaces where workspace = :p_workspace
       union all
       select 'application', null, null, null, null, workspace, application_id, alias, owner
       from apex_applications where application_id = :p_app_id`;
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
function oracleDiagnostics(r, mutation = false, format = "text") {
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
      1
    );
  return output;
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
    const file = path11.join(managedHome(), "runtime.json");
    const state = await exists(file) ? await readJson(file) : {};
    const transport = await (this.selectedTransport ??= sqlclConfig());
    return {
      ...transport,
      executable: process.env.APEXREST_SQLCL ?? state.sqlcl ?? this.executable,
      javaHome: process.env.APEXREST_JAVA_HOME ?? (state.java ? path11.dirname(path11.dirname(state.java)) : process.env.JAVA_HOME)
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
  async session(input, connection, mutation = false, signal, cwd, format = "text", restrictLevel, isolated = false, label = "session") {
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
        label
      );
    } finally {
      if (!cwd) await this.discardStage(work);
    }
  }
  async sessionIn(work, input, connection, mutation, signal, format, restrictLevel, isolated, label) {
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
    const marker = `APEXREST_COMPLETE_${randomUUID().replaceAll("-", "")}`;
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
      timeoutMs: 18e4,
      ...signal ? { signal } : {}
    };
    const pooled = !isolated && (settings.mode === "mcp" ? this.mcpRunner === runSqlclMcp : this.runner === runProcess && !selected && settings.databaseTransport !== "ords");
    const viaServer = settings.mode === "mcp" || pooled;
    const executionStarted = performance.now();
    let raw;
    try {
      raw = viaServer ? await (pooled ? runPooledSqlcl : this.mcpRunner)({
        ...request,
        cwd: pooled ? await this.sessionHome() : work,
        // Let SQLcl apply its MCP default. In 26.1, explicit -R 4
        // also suppresses connmgr output, unlike the default MCP profile.
        args: settings.mode === "mcp" ? settings.mcpRestrictLevel === "4" ? ["-mcp"] : ["-R", "1", "-mcp"] : [...restrictLevel ? ["-R", restrictLevel] : [], "-mcp"],
        // CLI's final EXIT commits on success. Preserve that transaction
        // boundary before acknowledging a write over a persistent session.
        input: (settings.mode === "cli" ? preamble.replace(/exit failure rollback/g, "continue") : preamble) + // Persistent servers keep SET state between batches; start neutral.
        (selected?.name ? "rollback;\nbegin dbms_session.reset_package; execute immediate 'alter session set current_schema = ' || dbms_assert.enquote_name(sys_context('USERENV', 'SESSION_USER'), false); end;\n/\n" : "") + "set serveroutput off\nset sqlformat default\n" + input + (mutation ? "\ncommit;\n" : "\n") + `prompt ${marker}
`,
        mutation,
        completionMarker: marker,
        ...selected?.name ? { connectionName: selected.name } : {}
      }) : await this.runner(request);
    } finally {
      if (!timingRecorded) {
        const elapsed = performance.now() - executionStarted;
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
      output = oracleDiagnostics(result, mutation, format);
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
    const root = path11.join(managedHome(), "staging");
    await mkdir4(root, { recursive: true, mode: 448 });
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
    const root = path11.join(managedHome(), "staging");
    await mkdir4(root, { recursive: true, mode: 448 });
    return mkdtemp(path11.join(root, "oracle-"));
  }
  /** Remove a private staging directory created by stage(). Other paths are never removed. */
  async discardStage(stage) {
    if (!stage) return;
    const relative = path11.relative(path11.join(managedHome(), "staging"), path11.resolve(stage));
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
    if (!path11.isAbsolute(settings.executable)) return;
    try {
      const executable = await realpath4(settings.executable);
      const bin = path11.dirname(executable);
      if (path11.basename(bin) !== "bin") return;
      const lib = path11.join(path11.dirname(bin), "lib");
      const mark = async (file, required) => {
        try {
          const info = await stat3(file, { bigint: true });
          return [info.dev, info.ino, info.mode, info.size, info.mtimeNs, info.ctimeNs].map(String);
        } catch (error) {
          if (required) throw error;
          return "absent";
        }
      };
      const marks = {
        executable: await mark(executable, true),
        lib: await mark(lib, true),
        apex: await mark(path11.join(lib, "dbtools-apex.jar"), false),
        apexlang: await mark(path11.join(lib, "apexlang-compiler.jar"), false),
        ext: await mark(path11.join(lib, "ext"), false),
        extApex: await mark(path11.join(lib, "ext/dbtools-apex.jar"), false),
        extApexlang: await mark(path11.join(lib, "ext/apexlang-compiler.jar"), false)
      };
      const { executable: _executable, ...rest } = settings;
      return hash(canonical({ ...rest, executable, marks }));
    } catch {
      return;
    }
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
      pending = this.probeCapabilities(settings, key);
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
      pending = this.session("help apex import").then(
        (result) => result.output.replace(/\x1b\[[0-9;]*m/g, "")
      );
      if (key) {
        importHelpCache.set(key, pending);
        pending.catch(() => importHelpCache.delete(key));
      }
    }
    return raceCancellation(pending, signal, "Import capability check cancelled.");
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
    const stage = await this.stage(), copy = path11.join(stage, "application");
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
    if (await exists(path11.join(root, "application.apx"))) return root;
    const found = [];
    for (const entry of await readdir2(root, { withFileTypes: true }))
      if (entry.isDirectory()) {
        const dir = path11.join(root, entry.name);
        if (await exists(path11.join(dir, "application.apx"))) found.push(dir);
        else
          for (const sub of await readdir2(dir, { withFileTypes: true }))
            if (sub.isDirectory() && await exists(path11.join(dir, sub.name, "application.apx")))
              found.push(path11.join(dir, sub.name));
      }
    if (found.length !== 1)
      throw new Fault(
        "ORACLE_OUTPUT_MISSING",
        "Expected exactly one generated/exported APEXlang application.",
        1
      );
    return found[0];
  }
  async validate(source, signal) {
    const compiler = await this.requireCapability("validate", signal);
    const before = await inventory(source);
    if (!before[".apex/apexlang.json"])
      throw new Fault(
        "MMD_METADATA_REQUIRED",
        "Preserve Oracle-generated .apex/apexlang.json before validation.",
        3
      );
    const stage = await this.stage(), copy = path11.join(stage, "application");
    let result;
    try {
      await cp3(source, copy, { recursive: true });
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
      if (error instanceof Fault && error.code === "ORACLE_COMMAND_FAILED" && !error.details) {
        const details = await compilerDetails(error.message, source);
        if (details) throw new Fault("VALIDATION_FAILED", error.message, 1, "failed", details);
      }
      throw error;
    } finally {
      await this.discardStage(stage);
    }
    if (!compilerSucceeded(result.output)) throw await compilerFault(result.output, source);
    if (canonical(before) !== canonical(await inventory(source)))
      throw new Fault("SOURCE_DRIFT", "Source changed during validation.", 5);
    return {
      status: "passed",
      compiler,
      mmd: JSON.parse(await readFile5(path11.join(source, ".apex/apexlang.json"), "utf8")),
      sourceDigest: hash(canonical(before)),
      output: result.output
    };
  }
  async exportApplication(env, connection, format = "APEXLANG") {
    const compiler = await this.requireCapability("export");
    const stage = await this.stage();
    const ords = (await this.settings()).databaseTransport === "ords";
    const exportRoot = ords ? path11.join(stage, "export") : stage;
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
    const stage = await this.stage(), directory = path11.join(stage, "selection");
    await mkdir4(directory, { mode: 448 });
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
            await mkdir4(path11.dirname(target), { recursive: true, mode: 448 });
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
        const exportDirectory = path11.join(stage, "component-" + (index + 1));
        await mkdir4(exportDirectory, { mode: 448 });
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
          await mkdir4(path11.dirname(target), { recursive: true, mode: 448 });
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
    const marker = `APEXREST_CONNECTIONS_${randomUUID().replaceAll("-", "")}`;
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
    const token = `APEXREST_ROWS_${randomUUID().replaceAll("-", "")}`;
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
    const workspaces = rows.filter((row) => row.target_record === "workspace").map((row) => ({ workspace_id: row.workspace_id, workspace: row.workspace }));
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
    return { identity, workspace: workspaces[0], application: applications[0] ?? null };
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
    const output = path11.join(await this.stage(), "deployment.json");
    const defaults = path11.join(source, "deployments/default.json");
    const native = await exists(defaults) ? JSON.parse(await readFile5(defaults, "utf8")) : {};
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
        if (!/^[A-Za-z0-9_./-]+\.apx$/.test(file) || path11.isAbsolute(file) || file.split("/").some((part) => !part || part === "." || part === ".."))
          throw new Fault(
            "PARTIAL_IMPORT_FILES_INVALID",
            "Partial-import files must be literal contained APEXlang paths without globs.",
            2
          );
        let valid = false;
        try {
          const physical = await realpath4(await contained(source, file));
          valid = path11.relative(await realpath4(source), physical).replaceAll(path11.sep, "/") === file && (await stat3(physical)).isFile();
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
      await this.discardStage(path11.dirname(config));
    }
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
        "import"
      );
    } catch (error) {
      if (error instanceof Fault && error.code === "ORACLE_COMMAND_FAILED" && !error.details)
        error.details = await compilerDetails(error.message, source);
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
  async restoreApplication(env, connection, file, signal) {
    const setup = `begin
 apex_application_install.set_workspace(${sqlLiteral(env.workspace)});
 apex_application_install.set_schema(${sqlLiteral(env.parsingSchema)});
 apex_application_install.set_application_id(${env.applicationId});
end;
/
`;
    if ((await this.settings()).databaseTransport === "ords") {
      await this.requireMutationSupport();
      const stage = await this.stage();
      try {
        const input = path11.join(stage, "restore.sql");
        await (await import("./chunk-A3QJ5GLR.mjs")).atomicWrite(input, setup + await readFile5(file, "utf8"));
        return await this.ordsBridge({ operation: "script", input }, connection, signal, stage);
      } finally {
        await this.discardStage(stage);
      }
    }
    return this.session(
      setup + `@${sqlclToken(file)}`,
      connection,
      true,
      signal,
      void 0,
      "text",
      SCRIPT_RESTRICT_LEVEL
    );
  }
};
function parseCompilerDiagnostics(output) {
  const diagnostics = [];
  let current, values;
  const flush = () => {
    if (current?.file && current.type && current.message !== void 0)
      diagnostics.push({
        code: current.type,
        severity: "error",
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
    const field = line.match(/^(File|Line|Column|Type|Error):\s?(.*)$/);
    if (field?.[1] === "File") {
      flush();
      current = { file: field[2].trim() };
    } else if (!current) continue;
    else if (field?.[1] === "Line") current.line = Number(field[2]);
    else if (field?.[1] === "Column") current.column = Number(field[2]);
    else if (field?.[1] === "Type") current.type = field[2].trim();
    else if (field?.[1] === "Error") current.message = field[2].trim();
    else if (!line.trim()) flush();
    else if (current.message === void 0) continue;
    else {
      const valid = line.match(/^Valid (?:parameters|values|options) are:\s*(.*)$/i);
      if (valid) values = valid[1].trim() ? [valid[1].trim()] : [];
      else if (values && /^-\S/.test(line.trim())) values.push(line.trim().slice(1));
      else current.message += " " + line.trim();
    }
  }
  flush();
  return diagnostics;
}
async function diagnosticHint(root, diagnostic) {
  if (!diagnostic.line || !/^INVALID_PROPERTY|MISSING_REQUIRED|_NOT_FOUND$|INVALID_/.test(diagnostic.type))
    return;
  try {
    const file = await contained(root, diagnostic.file);
    const lines = (await readFile5(file, "utf8")).split(/\r?\n/);
    const indent = (text) => text.match(/^\s*/)[0].length;
    const open4 = /^\s*([A-Za-z][\w-]*)(?:\s+([^\s({]+))?\s*[({]\s*$/;
    const chain = [];
    let level = indent(lines[diagnostic.line - 1] ?? "");
    for (let i = diagnostic.line - 2; i >= 0 && chain.length < 3; i--) {
      const text = lines[i];
      if (!text.trim() || indent(text) >= level) continue;
      const match = text.match(open4);
      if (!match) continue;
      level = indent(text);
      const kind = match[1], name = match[2];
      let label = name ? `${kind} ${name}` : kind;
      if (name) {
        for (let j = i + 1; j < lines.length && j < i + 40; j++) {
          const property = lines[j].match(/^\s*type:\s*(\S+)/);
          if (indent(lines[j]) <= level && lines[j].trim()) break;
          if (property && indent(lines[j]) === level + (indent(lines[i + 1] ?? "") - level || 4)) {
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
  if (root)
    for (const diagnostic of diagnostics) {
      const hint = await diagnosticHint(root, diagnostic);
      if (hint) diagnostic.hint = hint;
    }
  return diagnostics.length ? { diagnostics } : void 0;
}
async function compilerFault(output, root) {
  const details = await compilerDetails(output, root);
  return new Fault(
    details ? "VALIDATION_FAILED" : "VALIDATION_UNCONFIRMED",
    output.slice(0, 4e3) || "Compiler returned no success marker.",
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
  return success && !counted && !failed;
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
  await mkdir4(path11.dirname(target), { recursive: true });
  const staging = await mkdtemp(path11.join(path11.dirname(target), ".apexrest-copy-"));
  await inventory(source);
  await cp3(source, staging, { recursive: true });
  await rename2(staging, target);
  return { directory: target, files: await inventory(target) };
}

// packages/core/src/project.ts
function resourceRoot() {
  return process.env.APEXREST_RESOURCES ?? path12.resolve(path12.dirname(fileURLToPath(import.meta.url)), "../resources");
}
async function projectInit(directory, template, alias) {
  parse(refName, alias);
  const destination = path12.resolve(directory);
  await mkdir5(path12.dirname(destination), { recursive: true });
  return withLock(destination + ".init.lock", async () => {
    if (await exists(destination)) {
      if (!(await lstat3(destination)).isDirectory() || (await readdir3(destination)).length)
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
      if (!await exists(root)) await mkdir5(root, { recursive: true, mode: 448 });
      if (!(await lstat3(root)).isDirectory() || (await readdir3(root)).length !== 0) throw conflict();
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
      await createFile(path12.join(root, "apexrest.json"), JSON.stringify(config, null, 2) + "\n");
      await createFile(path12.join(root, ".gitignore"), ".apexrest/\nnode_modules/\n.env\n");
      for (const dir of Object.values(config.database))
        await mkdir5(path12.join(root, dir), { recursive: true });
      await cp4(
        path12.join(resourceRoot(), "toolchains/toolchain.lock.json"),
        path12.join(root, config.toolchain.lockFile),
        { force: false, errorOnExist: true }
      );
      if (template !== "existing-app") {
        const generated = await new OracleAdapter().generate(alias, alias);
        await installSources(generated.directory, root, config.application.sourceDir);
        const release = await sourceRelease(path12.join(root, config.application.sourceDir));
        if (release === "26.2") {
          config.toolchain.profile = "26.2";
          await cp4(
            path12.join(resourceRoot(), "toolchains/toolchain-26.2.lock.json"),
            path12.join(root, config.toolchain.lockFile)
          );
          await atomicWrite(path12.join(root, "apexrest.json"), JSON.stringify(config, null, 2) + "\n");
        }
        if (template === "customer-crm") {
          await cp4(path12.join(resourceRoot(), "templates/customer-crm/project"), root, { recursive: true });
          await cp4(
            path12.join(
              resourceRoot(),
              "templates/customer-crm",
              release === "26.2" ? "apex-overlay-26.2" : "apex-overlay"
            ),
            path12.join(root, config.application.sourceDir),
            { recursive: true }
          );
          const { readFile: readFile6 } = await import("node:fs/promises");
          const file = path12.join(
            root,
            config.application.sourceDir,
            release === "26.2" ? "shared-components/lists/navigation-menu.apx" : "shared-components/lists.apx"
          );
          const lists = await readFile6(file, "utf8"), index = lists.lastIndexOf(")");
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
        if ((await readdir3(destination)).length) throw conflict();
        const moved = [];
        try {
          for (const entry of await readdir3(root)) {
            await rename3(path12.join(root, entry), path12.join(destination, entry));
            moved.push(entry);
          }
        } catch (error) {
          for (const entry of moved.reverse())
            await rename3(path12.join(destination, entry), path12.join(root, entry));
          throw error;
        }
      } else await rename3(root, destination);
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
  sqlclMode,
  sqlclRestriction,
  databaseTransport,
  sqlclConfig,
  configureSqlcl,
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
