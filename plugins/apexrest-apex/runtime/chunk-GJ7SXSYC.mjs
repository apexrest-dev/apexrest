import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  onPreviewShutdown,
  otherPreviews,
  registerPreview,
  stopOtherPreview,
  unregisterPreview
} from "./chunk-RD7P4VAE.mjs";
import {
  OracleAppData,
  PreviewServer,
  WorkerBridge,
  checkApplication,
  localGaps
} from "./chunk-46S3HU25.mjs";
import {
  APEX_DOWNLOAD_URL,
  APEX_FULL_VERSION,
  defaultAssetsDir,
  loadAssets,
  setupAssets
} from "./chunk-P2HQPB2E.mjs";
import {
  loadApplication
} from "./chunk-VJRFADO6.mjs";
import "./chunk-N3KQBIVW.mjs";
import {
  OracleAdapter,
  resolveConnection,
  targetIdentitySql
} from "./chunk-YI25QNSI.mjs";
import "./chunk-33BV6A47.mjs";
import {
  environment,
  isProductionTarget,
  loadProject
} from "./chunk-DFK3P5MT.mjs";
import "./chunk-MKCPTOWL.mjs";
import "./chunk-J2ZZKOUD.mjs";
import "./chunk-WBDBC3GS.mjs";
import "./chunk-72F3ZMZP.mjs";
import {
  Fault
} from "./chunk-JVBX3L43.mjs";

// packages/core/src/preview/service.ts
import fs2 from "node:fs";
import path2 from "node:path";

// packages/core/src/preview/oracle/connect.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
async function workerSettings(connectionName) {
  const adapter = new OracleAdapter();
  const settings = await adapter.settings();
  const env = {};
  for (const [key, value] of Object.entries({
    ...process.env,
    SQLPATH: "",
    ORACLE_PATH: "",
    JAVA_HOME: settings.javaHome
  }))
    if (value !== void 0 && !["NODE_OPTIONS", "JAVA_TOOL_OPTIONS", "_JAVA_OPTIONS", "JDK_JAVA_OPTIONS"].includes(key))
      env[key] = value;
  return {
    executable: settings.executable,
    args: settings.mode === "mcp" && settings.mcpRestrictLevel === "4" ? ["-mcp"] : ["-R", "1", "-mcp"],
    cwd: await adapter.sessionHome(),
    env,
    connectionName,
    commandConnect: settings.mode === "cli"
  };
}
function warmUp(data, apex) {
  const started = performance.now();
  const steps = {
    tables: "skipped"
  };
  try {
    const prefetched = data.prefetchSchema();
    steps.tables = prefetched.complete ? prefetched.tables : "partial";
  } catch {
    steps.tables = "skipped";
  }
  if (apex)
    try {
      data.plsql({
        block: "begin\n  null;\nend;",
        binds: {},
        apex: {
          ...apex,
          pageId: apex.pages.find((id) => id > 0) ?? apex.pages[0] ?? 1,
          user: "APEXREST_PREVIEW",
          items: /* @__PURE__ */ new Set()
        }
      });
      steps.apexSession = "ready";
    } catch {
      steps.apexSession = "skipped";
    }
  return { ms: Math.round(performance.now() - started), ...steps };
}
function savedConnectionProperties(name, home = os.homedir()) {
  const store = path.join(home, ".dbtools", "connections");
  let entries;
  try {
    entries = fs.readdirSync(store);
  } catch {
    return void 0;
  }
  for (const entry of entries) {
    try {
      const text = fs.readFileSync(path.join(store, entry, "dbtools.properties"), "utf8");
      if (text.split(/\r?\n/u).some((line) => line.trim() === `name=${name}`))
        return path.join(store, entry, "ojdbc.properties");
    } catch {
    }
  }
  return void 0;
}
async function connectOracle(root, name, link, options = {}) {
  const commit = options.commit === true;
  const ctx = await loadProject(root);
  const env = environment(ctx, name);
  if (await isProductionTarget(env))
    throw new Fault(
      "PREVIEW_PRODUCTION_REFUSED",
      `Environment ${name} is production; the connected preview runs only against DEV, QA or TEST targets.`,
      4,
      "blocked"
    );
  const connection = await resolveConnection(env.readConnectionRef);
  if (!connection.name)
    throw new Fault(
      "PREVIEW_SQLCL_CONNECTION_REQUIRED",
      `Connection ${env.readConnectionRef} has no SQLcl saved connection. The connected preview needs one session that holds a transaction; ORDS-only connections are not supported.`,
      3,
      "blocked"
    );
  if (commit) {
    let locality;
    try {
      locality = await (options.locality ?? ((target) => new OracleAdapter().connectionLocality(target)))(
        connection
      );
    } catch (error) {
      locality = { local: false, evidence: `unconfirmed (${error.message})` };
    }
    if (!locality.local)
      throw new Fault(
        "PREVIEW_COMMIT_REMOTE_REFUSED",
        `Commit mode writes application data permanently and runs only against a database on this computer; connection ${connection.name} of ${name} is not confirmed local (${locality.evidence}). Start the connected preview without commit; every request is then rolled back.`,
        4,
        "blocked"
      );
  }
  const settings = { ...await workerSettings(connection.name), ...commit ? { commit } : {} };
  const data = new OracleAppData(link ? link(settings) : new WorkerBridge({ settings }), env.parsingSchema, {
    commit
  });
  try {
    const rows = data.query(targetIdentitySql, {
      P_WORKSPACE: env.workspace,
      P_APP_ID: env.applicationId
    }).rows;
    const identity = rows.filter((row) => row.TARGET_RECORD === "identity");
    if (identity.length !== 1 || identity[0].DB_UNIQUE_NAME !== env.databaseIdentity.dbUniqueName || identity[0].SERVICE_NAME !== env.databaseIdentity.serviceName || identity[0].PARSING_SCHEMA !== env.parsingSchema)
      throw new Fault(
        "TARGET_MISMATCH",
        `Connection ${env.readConnectionRef} does not match the database, service and parsing schema configured for ${name}.`,
        5,
        "conflict"
      );
    if (!data.transactional()) {
      const properties = savedConnectionProperties(connection.name);
      throw new Fault(
        "PREVIEW_AUTOCOMMIT_ON",
        `SQLcl saved connection ${connection.name} commits every statement (JDBC auto-commit), so the connected preview could not roll its requests back and did not start. ` + (properties ? `Add the line autoCommit=false to ${properties} (create the file if needed), then start the preview again.` : `Add autoCommit=false to the ojdbc.properties file of that saved connection, then start the preview again.`) + " The offline preview (without env) is unaffected.",
        3,
        "blocked"
      );
    }
    if (rows.filter((row) => row.TARGET_RECORD === "workspace").length !== 1)
      throw new Fault(
        "WORKSPACE_UNCONFIRMED",
        `Workspace ${env.workspace} is absent or inaccessible.`,
        4,
        "blocked"
      );
    const application = rows.find(
      (row) => row.TARGET_RECORD === "application" && row.WORKSPACE === env.workspace
    );
    const warnings = [];
    let apex;
    if (application) {
      const items = data.query(
        `select item_name from apex_application_page_items where application_id = :P_APP_ID
         union
         select item_name from apex_application_items where application_id = :P_APP_ID`,
        { P_APP_ID: env.applicationId },
        2e4
      );
      const pages = data.query(
        "select page_id from apex_application_pages where application_id = :P_APP_ID order by page_id",
        { P_APP_ID: env.applicationId },
        2e4
      );
      apex = {
        applicationId: env.applicationId,
        items: new Set(items.rows.map((row) => String(row.ITEM_NAME).toUpperCase())),
        pages: pages.rows.map((row) => Number(row.PAGE_ID))
      };
    } else
      warnings.push(
        `Application ${env.applicationId} is not installed in workspace ${env.workspace}; database code runs without an APEX session, so v() returns NULL`
      );
    const autonomous = data.query(
      `select distinct type || ' ' || name unit from all_source
        where owner = :APEXREST_OWNER and upper(text) like '%AUTONOMOUS\\_TRANSACTION%' escape '\\'`,
      { APEXREST_OWNER: env.parsingSchema },
      200
    );
    if (commit)
      warnings.push(
        `Commit mode: every successful request is committed to ${env.databaseIdentity.dbUniqueName}/${env.databaseIdentity.serviceName}; a failed request is rolled back`
      );
    else {
      if (autonomous.rows.length)
        warnings.push(
          `Autonomous transactions commit even in the connected preview: ${autonomous.rows.map((row) => row.UNIT).join(", ")}`
        );
      warnings.push(
        "Sequences advance and calls outside the database (mail, HTTP, jobs) are not undone by the rollback"
      );
    }
    warmUp(data, apex);
    data.endRequest();
    return {
      data,
      environment: name,
      target: `${env.databaseIdentity.dbUniqueName}/${env.databaseIdentity.serviceName}`,
      ...apex ? { apex } : {},
      ...commit ? { commit } : {},
      warnings
    };
  } catch (error) {
    try {
      data.close();
    } catch {
    }
    throw error;
  }
}

// packages/core/src/preview/service.ts
var running = /* @__PURE__ */ new Map();
onPreviewShutdown(async () => {
  for (const [source, server] of [...running]) await stopServer(source, server);
});
var DIAGNOSTICS_LIMIT = 60;
async function resolveSource(root, explicit) {
  let source = explicit ? path2.resolve(root, explicit) : void 0;
  if (!source) {
    try {
      const ctx = await loadProject(root);
      source = path2.resolve(ctx.root, ctx.config.application.sourceDir);
    } catch {
      source = path2.resolve(root);
    }
  }
  if (!fs2.existsSync(path2.join(source, "application.apx")))
    throw new Fault(
      "PREVIEW_SOURCE_MISSING",
      `${source} has no application.apx. Pass sourceDir with the APEXlang application folder.`,
      2
    );
  return fs2.realpathSync(source);
}
async function projectData(root, sourceDir) {
  if (fs2.existsSync(path2.join(sourceDir, ".apex-local"))) return {};
  let ctx;
  try {
    ctx = await loadProject(root);
  } catch {
    return {};
  }
  const appDir = path2.resolve(ctx.root, ctx.config.application.sourceDir);
  if (!fs2.existsSync(appDir) || fs2.realpathSync(appDir) !== sourceDir) return {};
  return {
    database: path2.join(ctx.root, ".apexrest", "preview", "preview.sqlite"),
    seedDirs: [path2.resolve(ctx.root, ctx.config.database.migrationsDir), path2.join(ctx.root, ".apex-local")]
  };
}
function summarize(diagnostics) {
  const count = (level) => diagnostics.filter((entry) => entry.level === level).length;
  const rank = (entry) => ["error", "warning", "info"].indexOf(entry.level) * 2 + (entry.code?.startsWith("A11Y-") ? 1 : 0);
  const ranked = [...diagnostics].sort((a, b) => rank(a) - rank(b));
  return {
    counts: { error: count("error"), warning: count("warning"), info: count("info") },
    diagnostics: ranked.slice(0, DIAGNOSTICS_LIMIT),
    truncated: diagnostics.length > DIAGNOSTICS_LIMIT
  };
}
function gapsFor(sourceDir) {
  let gaps;
  try {
    gaps = localGaps(loadApplication(sourceDir));
  } catch {
    return {};
  }
  return gaps.length ? { notAppliedLocally: gaps.slice(0, DIAGNOSTICS_LIMIT) } : {};
}
async function assetsReady(assetsDir) {
  try {
    loadAssets(assetsDir);
    return;
  } catch {
  }
  try {
    await previewSetup({ assetsDir });
    loadAssets(assetsDir);
  } catch (error) {
    throw new Fault("PREVIEW_ASSETS_MISSING", error.message, 3, "blocked", {
      nextActions: [
        "The automatic preview setup failed. Run apexrest preview setup with --zip and a local apex_26.2 zip, or check network access to download.oracle.com."
      ]
    });
  }
}
async function previewSetup(input) {
  const assets = await setupAssets({
    ...input.assetsDir ? { assetsDir: input.assetsDir } : {},
    ...input.zip ? { zipPath: input.zip } : {},
    ...input.sha256 ? { expectedSha256: input.sha256 } : {},
    onProgress: (message) => process.stderr.write(`[preview] ${message}
`)
  });
  return {
    assetsDir: assets.dir,
    apexVersion: assets.manifest.apexVersion,
    files: assets.manifest.files,
    sha256: assets.manifest.sha256,
    source: assets.manifest.source,
    templates: assets.theme.length
  };
}
async function previewStart(root, input) {
  const commit = input.commit === true;
  if (commit && !input.env)
    throw new Fault(
      "INVALID_INPUT",
      "commit needs env: it commits requests to that environment's local Oracle database. The SQLite preview keeps its data anyway.",
      2
    );
  const sourceDir = await resolveSource(root, input.sourceDir);
  await assetsReady(input.assetsDir);
  const previous = running.get(sourceDir);
  if (previous && !input.reset && input.port === void 0 && (previous.options.oracle?.environment ?? void 0) === input.env && previous.options.oracle?.commit === true === commit)
    return describe(previous, true);
  if (previous) await stopServer(sourceDir, previous);
  const oracle = input.env ? await connectOracle(root, input.env, void 0, { commit }) : void 0;
  const data = await projectData(root, sourceDir);
  const server = new PreviewServer({
    ...oracle ? { oracle } : {},
    ...data.seedDirs ? { seedDirs: data.seedDirs } : {},
    ...data.database && !oracle ? { database: data.database } : {},
    sourceDir,
    ...input.assetsDir ? { assetsDir: input.assetsDir } : {},
    ...input.port === void 0 ? {} : { port: input.port },
    ...input.reset ? { reset: true } : {},
    ...input.sampleRows === void 0 ? {} : { sampleRows: input.sampleRows },
    ...input.user ? { user: input.user } : {},
    ...input.toolbar === void 0 ? {} : { toolbar: input.toolbar }
  });
  await server.start();
  running.set(sourceDir, server);
  const address = new URL(server.url);
  registerPreview({
    port: Number(address.port),
    host: address.hostname.replace(/^\[|\]$/g, ""),
    url: server.url,
    sourceDir,
    ...server.options.oracle ? { environment: server.options.oracle.environment } : {}
  });
  return describe(server, false);
}
async function stopServer(sourceDir, server) {
  let port;
  try {
    port = Number(new URL(server.url).port);
  } catch {
  }
  await server.stop();
  running.delete(sourceDir);
  if (port !== void 0) unregisterPreview(port);
}
function describe(server, reused) {
  return {
    url: server.url,
    reused,
    sourceDir: server.options.sourceDir,
    database: server.db.file,
    apexVersion: APEX_FULL_VERSION,
    pages: server.pages(),
    note: server.options.oracle ? `Connected preview: application data and PL/SQL run in Oracle environment ${server.options.oracle.environment} (${server.options.oracle.target}); ${server.options.oracle.commit ? "commit mode: successful requests are committed, failed ones rolled back" : "every request is rolled back"}. Rendering is still simulated; not import or browser evidence.` : "Local simulation with Universal Theme 26.2 assets and SQLite. Not Oracle evidence; PL/SQL beyond the local interpreter is skipped.",
    data: server.options.oracle ? {
      mode: "oracle",
      environment: server.options.oracle.environment,
      target: server.options.oracle.target,
      commit: server.options.oracle.commit === true
    } : { mode: "sqlite" },
    ...summarize(server.diagnostics()),
    ...gapsFor(server.options.sourceDir)
  };
}
async function listPreviews() {
  const local = [...running].map(([sourceDir, server]) => ({
    url: server.url,
    port: Number(new URL(server.url).port),
    sourceDir,
    pid: process.pid,
    owner: "this-process",
    ...server.options.oracle ? { environment: server.options.oracle.environment } : {},
    server
  }));
  const others = (await otherPreviews()).map((entry) => ({
    url: entry.url,
    port: entry.port,
    sourceDir: entry.sourceDir,
    pid: entry.pid,
    owner: entry.owner,
    ...entry.environment ? { environment: entry.environment } : {},
    entry
  }));
  return [...local, ...others];
}
async function selector(root, input, fallback) {
  const tests = [];
  const described = [];
  const none = input.sourceDir === void 0 && input.project === void 0 && input.port === void 0;
  if (input.sourceDir !== void 0 || fallback === "project-source" && none) {
    const source = await resolveSource(root, input.sourceDir);
    tests.push((entry) => entry.sourceDir === source);
    described.push(source);
  } else if (input.project !== void 0) {
    let projectRoot;
    try {
      projectRoot = fs2.realpathSync(path2.resolve(input.project));
    } catch {
      throw new Fault("INVALID_INPUT", `Project directory ${input.project} does not exist.`, 2);
    }
    tests.push(
      (entry) => entry.sourceDir === projectRoot || entry.sourceDir.startsWith(projectRoot + path2.sep)
    );
    described.push(`project ${projectRoot}`);
  }
  if (input.port !== void 0) {
    const port = input.port;
    tests.push((entry) => entry.port === port);
    described.push(`port ${port}`);
  }
  return {
    match: (entry) => tests.every((check) => check(entry)),
    described: described.join(", ")
  };
}
var summaryOf = (entry) => ({
  url: entry.url,
  port: entry.port,
  sourceDir: entry.sourceDir,
  pid: entry.pid,
  owner: entry.owner,
  ...entry.environment ? { environment: entry.environment } : {},
  ...entry.server ? summarize(entry.server.diagnostics()).counts : {},
  ...entry.server ? gapsFor(entry.sourceDir) : {}
});
async function previewStop(root, input) {
  const listed = await listPreviews();
  const filter = input.all ? void 0 : await selector(root, input, "project-source");
  const targets = filter ? listed.filter(filter.match) : listed;
  const stopped = [];
  const notStopped = [];
  let hosted = false;
  for (const target of targets) {
    if (target.server) {
      await stopServer(target.sourceDir, target.server);
      stopped.push(target.sourceDir);
    } else if (target.entry?.owner === "cli") {
      if (await stopOtherPreview(target.entry)) stopped.push(target.sourceDir);
      else
        notStopped.push({
          url: target.url,
          sourceDir: target.sourceDir,
          pid: target.pid,
          reason: `Process ${target.pid} did not close port ${target.port} within 10 seconds.`
        });
    } else {
      hosted = true;
      notStopped.push({
        url: target.url,
        sourceDir: target.sourceDir,
        pid: target.pid,
        reason: `Hosted by another APEXREST MCP process (pid ${target.pid}); stop it from that session with apexrest_preview action:stop.`
      });
    }
  }
  if (!stopped.length && notStopped.length)
    throw new Fault(
      "PREVIEW_STOP_FAILED",
      notStopped.map((entry) => `${entry.url}: ${entry.reason}`).join(" "),
      hosted ? 5 : 1,
      hosted ? "blocked" : "failed"
    );
  if (!stopped.length) {
    const others = listed.map((entry) => `${entry.url} (${entry.sourceDir})`).join("; ");
    throw new Fault(
      "PREVIEW_NOT_RUNNING",
      `No running preview matches ${filter?.described || "the selection"}; nothing was stopped.` + (others ? ` Running: ${others}.` : " No preview is running."),
      2,
      "not_found",
      {
        nextActions: [
          "Run apexrest preview status to list running previews with their source folders and ports."
        ]
      }
    );
  }
  const remaining = (await listPreviews()).map((entry) => entry.sourceDir);
  return { stopped, ...notStopped.length ? { notStopped } : {}, running: remaining };
}
async function previewStatus(root = process.cwd(), input = {}) {
  const filter = await selector(root, input, "all");
  return {
    assetsDir: defaultAssetsDir(),
    assetsInstalled: fs2.existsSync(path2.join(defaultAssetsDir(), "manifest.json")),
    download: APEX_DOWNLOAD_URL,
    running: (await listPreviews()).filter(filter.match).map(summaryOf)
  };
}
async function previewCheck(root, input) {
  const sourceDir = await resolveSource(root, input.sourceDir);
  await assetsReady(input.assetsDir);
  const oracle = input.env ? await connectOracle(root, input.env) : void 0;
  const { seedDirs } = await projectData(root, sourceDir);
  const result = checkApplication({
    sourceDir,
    ...oracle ? { oracle } : {},
    ...seedDirs ? { seedDirs } : {},
    ...input.assetsDir ? { assetsDir: input.assetsDir } : {},
    ...input.pages ? { pages: input.pages } : {},
    ...input.sampleRows === void 0 ? {} : { sampleRows: input.sampleRows },
    toolbar: false
  });
  return { sourceDir, pages: result.pages, ...summarize(result.diagnostics), ...gapsFor(sourceDir) };
}
async function previewDispatch(operation, parsed, root) {
  const { action, ...input } = parsed;
  const selected = operation === "preview" ? String(action) : operation.slice("preview.".length);
  if (input.commit && selected !== "start")
    throw new Fault("INVALID_INPUT", "commit applies only to preview start with env", 2);
  switch (selected) {
    case "setup":
      return previewSetup(input);
    case "start":
      return previewStart(root, input);
    case "check":
      return previewCheck(root, input);
    case "stop":
      return previewStop(root, input);
    case "status":
      return operation === "preview" ? previewStatus(root, { sourceDir: input.sourceDir, port: input.port }) : previewStatus(root, input);
    default:
      throw new Fault("INVALID_INPUT", `Unknown preview action: ${selected}`, 2);
  }
}
async function buildWebappOperation(root, input) {
  const { buildWebapp } = await import("./chunk-4AW7ZWSA.mjs");
  const sourceDir = await resolveSource(root, input.sourceDir);
  return buildWebapp({
    sourceDir,
    out: path2.resolve(root, String(input.out)),
    ...input.auth ? { auth: input.auth } : {},
    ...input.authFunction ? { authFunction: String(input.authFunction) } : {},
    ...input.includeAssets ? { includeAssets: true } : {},
    ...input.assetsDir ? { assetsDir: String(input.assetsDir) } : {}
  });
}
export {
  buildWebappOperation,
  previewCheck,
  previewDispatch,
  previewSetup,
  previewStart,
  previewStatus,
  previewStop
};
