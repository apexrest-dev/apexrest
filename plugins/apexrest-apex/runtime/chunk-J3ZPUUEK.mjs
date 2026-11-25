import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  browserModeSchema
} from "./chunk-O7MNIZXK.mjs";
import {
  JOB_WAIT_MAX_SECONDS
} from "./chunk-NOTPADGV.mjs";
import {
  composeMaterializeInput,
  composePlanInput,
  metadataInputSchema
} from "./chunk-Y2XCPATG.mjs";
import {
  databaseTransport,
  ordsUrl,
  ordsUsername,
  savedConnectionName,
  sqlclMode,
  sqlclRestriction
} from "./chunk-WEBUXBUI.mjs";
import {
  refName,
  relativePath
} from "./chunk-OZXHZF36.mjs";
import {
  external_exports
} from "./chunk-HRRL6FHO.mjs";

// packages/core/src/operations.ts
var project = external_exports.string().min(1).max(4096).optional();
var env = refName;
var base = { project };
var selectedImportPath = relativePath.refine(
  (file) => !/[\\*?\[\]]/.test(file) && !/^[A-Za-z]:/.test(file) && !file.startsWith("-") && file.split("/").every((part) => part !== "" && part !== "."),
  "Use normalized application-relative paths without globs or command flags"
);
var importOptions = {
  importMode: external_exports.enum(["auto", "full", "files", "none"]).default("auto"),
  files: external_exports.array(selectedImportPath).min(1).max(1e3).optional().describe("files mode: explicit file paths relative to the application source directory")
};
function checkImportOptions(value, ctx) {
  if (value.importMode === "files" !== (value.files !== void 0))
    ctx.addIssue({
      code: "custom",
      path: ["files"],
      message: "Supply files only with importMode files; files mode requires a nonempty list."
    });
  if (value.files && new Set(value.files.map((file) => file.replaceAll("\\", "/").replace(/^\.\//, ""))).size !== value.files.length)
    ctx.addIssue({ code: "custom", path: ["files"], message: "Selected file paths must be unique." });
}
var dependencies = {
  home: external_exports.string().optional(),
  yes: external_exports.boolean().default(false),
  nonInteractive: external_exports.boolean().default(false),
  offline: external_exports.boolean().default(false),
  cacheDir: external_exports.string().optional(),
  dryRun: external_exports.boolean().default(false),
  acceptOracleLicense: external_exports.boolean().default(false)
};
var previewSource = {
  ...base,
  sourceDir: external_exports.string().min(1).max(4096).optional().describe("APEXlang folder with application.apx; defaults to apexrest.json application.sourceDir")
};
var previewSelect = {
  ...previewSource,
  port: external_exports.number().int().min(1).max(65535).optional().describe("Port of a running preview")
};
var previewRun = {
  assetsDir: external_exports.string().min(1).max(4096).optional(),
  env: env.optional().describe(
    "DEV/QA/TEST environment of apexrest.json: application data and PL/SQL run in its Oracle database through the SQLcl saved connection; every request is rolled back"
  ),
  sampleRows: external_exports.number().int().min(0).max(200).optional().describe("Sample rows for auto-created missing tables")
};
var setup = {
  ...base,
  ...dependencies,
  from: external_exports.string().optional(),
  codexHome: external_exports.string().optional(),
  codex: external_exports.string().min(1).optional(),
  scope: external_exports.enum(["user", "project"]).default("user"),
  version: external_exports.string().optional(),
  nativeOnly: external_exports.boolean().default(false)
};
var schemas = {
  version: external_exports.strictObject({}),
  doctor: external_exports.strictObject(base),
  "sqlcl.status": external_exports.strictObject({}),
  "sqlcl.configure": external_exports.strictObject({
    mode: sqlclMode,
    mcpRestrictLevel: sqlclRestriction.optional(),
    databaseTransport: databaseTransport.optional()
  }),
  "panel.status": external_exports.strictObject(base),
  "settings.status": external_exports.strictObject({}),
  "settings.configure": external_exports.strictObject({
    decisionApi: external_exports.enum(["on", "off"]).optional().describe("Default OpenAI Decisions selection for projects without decisionApi"),
    apiKeyEnv: external_exports.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional().describe("Environment variable with the OpenAI key (default OPENAI_API_KEY)"),
    decisionTimeoutMs: external_exports.number().int().min(250).max(1e4).optional(),
    catalog: external_exports.enum(["on", "off"]).optional().describe("Reference catalog tools (search, read, select)"),
    usageLog: external_exports.enum(["on", "off"]).optional().describe("Opt-in local token counters and operation duration log")
  }),
  "usage.status": external_exports.strictObject({ limit: external_exports.number().int().min(1).max(1e3).default(20) }),
  "usage.import": external_exports.strictObject({
    host: external_exports.enum(["codex", "claude"]),
    file: external_exports.string().min(1).max(4096).describe("Native CLI JSON/JSON-lines output from one run"),
    counterMode: external_exports.enum(["cumulative-session"]).optional().describe("Explicitly identify complete Codex cumulative session captures, including resumed turns"),
    elapsedMs: external_exports.number().finite().min(0).max(7 * 864e5).optional().describe("Caller-measured elapsed time for that run")
  }),
  setup: external_exports.strictObject(setup),
  "dependencies.install": external_exports.strictObject({ ...base, ...dependencies }),
  "dependencies.uninstall": external_exports.strictObject({
    home: external_exports.string().optional(),
    dryRun: external_exports.boolean().default(false),
    yes: external_exports.boolean().default(false)
  }),
  "plugin.validate": external_exports.strictObject({ ...base, from: external_exports.string().optional() }),
  "plugin.install": external_exports.strictObject(setup),
  "plugin.update": external_exports.strictObject({ ...setup, version: external_exports.string().min(1) }),
  "plugin.uninstall": external_exports.strictObject({
    ...base,
    home: external_exports.string().optional(),
    codex: external_exports.string().min(1).optional(),
    keepRuntime: external_exports.boolean().default(false)
  }),
  "project.init": external_exports.strictObject({
    ...base,
    directory: external_exports.string().min(1),
    template: external_exports.enum(["blank-app", "customer-crm", "existing-app"]).default("blank-app"),
    alias: refName.optional()
  }),
  "project.adopt": external_exports.strictObject({
    ...base,
    env,
    appId: external_exports.number().int().positive(),
    workingCopy: external_exports.boolean().default(false)
  }),
  "project.inspect": external_exports.strictObject({ ...base, detail: external_exports.enum(["full", "summary"]).default("full") }),
  "dev.start": external_exports.strictObject({ ...base }),
  "dev.status": external_exports.strictObject({ ...base }),
  "dev.stop": external_exports.strictObject({
    ...base,
    waitSeconds: external_exports.number().int().min(0).max(JOB_WAIT_MAX_SECONDS).default(30)
  }),
  "project.context": external_exports.strictObject({
    ...base,
    page: external_exports.string().regex(/^\d{1,5}$/u).describe("Page number")
  }),
  "project.insert": external_exports.strictObject({
    ...base,
    page: external_exports.string().regex(/^\d{1,5}$/u).describe("Page number"),
    components: external_exports.record(external_exports.string(), external_exports.unknown()).describe("JSON scaffold fragment: {regions, items?, refreshes?}; see the scaffold guide"),
    expectedDigest: external_exports.string().regex(/^[a-f0-9]{64}$/u).optional(),
    dryRun: external_exports.boolean().default(false),
    context: external_exports.enum(["delta", "full", "none"]).default("delta").describe("Edited page context in the result: changed/inserted/removed targets (default), whole, none")
  }),
  "project.patch": external_exports.strictObject({
    ...base,
    page: external_exports.string().regex(/^\d{1,5}$/u).describe("Page number"),
    operations: external_exports.array(
      external_exports.strictObject({
        target: external_exports.string().min(1).max(300),
        property: external_exports.enum(["title", "label", "heading", "format", "sequence", "query"]),
        value: external_exports.string().max(1e5),
        columns: external_exports.array(
          external_exports.strictObject({
            name: external_exports.string().min(1).max(128),
            heading: external_exports.string().max(4e3).optional(),
            dataType: external_exports.enum(["varchar2", "number", "date", "timestamp"]).optional()
          })
        ).max(200).optional()
      })
    ).min(1).max(50).describe("JSON: [{target: page|region:ID|item:NAME|button:ID|column:REGION.COL, property, value}]"),
    expectedDigest: external_exports.string().regex(/^[a-f0-9]{64}$/u).optional().describe("Page file digest you read; required to write"),
    dryRun: external_exports.boolean().default(false),
    context: external_exports.enum(["delta", "full", "none"]).default("delta").describe("Edited page context in the result: changed/inserted/removed targets (default), whole, none")
  }),
  "project.edit": external_exports.strictObject({
    ...base,
    page: external_exports.string().regex(/^\d{1,5}$/u).describe("Page number"),
    operations: external_exports.array(
      external_exports.discriminatedUnion("op", [
        external_exports.strictObject({
          op: external_exports.literal("set"),
          target: external_exports.string().min(1).max(300),
          property: external_exports.enum(["title", "label", "heading", "format", "sequence", "query"]),
          value: external_exports.string().max(1e5),
          columns: external_exports.array(
            external_exports.strictObject({
              name: external_exports.string().min(1).max(128),
              heading: external_exports.string().max(4e3).optional(),
              dataType: external_exports.enum(["varchar2", "number", "date", "timestamp"]).optional()
            })
          ).max(200).optional()
        }),
        external_exports.strictObject({
          op: external_exports.literal("addFilter"),
          item: external_exports.object({ name: external_exports.string().min(1).max(128), region: external_exports.string().min(1).max(255) }).passthrough().describe("Scaffold item: name P<page>_..., region, type, label, lov ..."),
          region: external_exports.record(external_exports.string(), external_exports.unknown()).optional().describe("Optional new scaffold region"),
          targets: external_exports.array(
            external_exports.strictObject({
              region: external_exports.string().min(1).max(255),
              sql: external_exports.string().max(1e5).optional(),
              columns: external_exports.array(
                external_exports.strictObject({
                  name: external_exports.string().min(1).max(128),
                  heading: external_exports.string().max(4e3).optional(),
                  dataType: external_exports.enum(["varchar2", "number", "date", "timestamp"]).optional()
                })
              ).max(200).optional(),
              series: external_exports.array(external_exports.strictObject({ id: external_exports.string().min(1).max(255), sql: external_exports.string().max(1e5) })).max(20).optional()
            })
          ).min(1).max(20)
        }),
        external_exports.strictObject({
          op: external_exports.literal("insert"),
          components: external_exports.record(external_exports.string(), external_exports.unknown()).describe("Scaffold fragment: {regions, items?, refreshes?}")
        })
      ])
    ).min(1).max(50).describe("JSON: [{op:set, target, property, value} | {op:insert, components}] on one page snapshot"),
    expectedDigest: external_exports.string().regex(/^[a-f0-9]{64}$/u).optional().describe("Page file digest you read; required to write"),
    dryRun: external_exports.boolean().default(false),
    context: external_exports.enum(["delta", "full", "none"]).default("delta").describe("Edited page context in the result: changed/inserted/removed targets (default), whole, none")
  }),
  "project.scaffold": external_exports.strictObject({ ...base, specFile: relativePath, env: env.optional() }),
  "connection.add": external_exports.strictObject({
    ...base,
    name: refName,
    sqlclName: savedConnectionName.optional(),
    ordsUrl: ordsUrl.optional(),
    ordsUsername: ordsUsername.optional(),
    passwordFile: external_exports.string().min(1).max(4096).optional(),
    envFile: external_exports.string().min(1).max(4096).optional(),
    usernameKey: external_exports.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(),
    passwordKey: external_exports.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(),
    urlKey: external_exports.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional()
  }).refine(
    (value) => !!value.sqlclName || !!value.envFile || !!(value.ordsUrl && value.ordsUsername),
    "Supply a direct SQLcl name or ORDS URL and username."
  ),
  "connection.list": external_exports.strictObject({ ...base, saved: external_exports.boolean().default(false) }),
  "connection.test": external_exports.strictObject({
    ...base,
    name: savedConnectionName,
    saved: external_exports.boolean().default(false)
  }),
  "connection.remove": external_exports.strictObject({ ...base, name: refName }),
  "compose.plan": composePlanInput,
  "compose.materialize": composeMaterializeInput,
  "docs.search": external_exports.strictObject({
    ...base,
    query: external_exports.string().min(1).max(256),
    corpus: external_exports.enum(["apexlang", "components", "patterns", "blocks", "blueprints"]).default("apexlang"),
    version: external_exports.string().optional(),
    kind: external_exports.enum(["grammar", "template", "contract", "guide"]).optional(),
    family: external_exports.string().min(1).max(200).optional(),
    profile: external_exports.string().max(200).optional(),
    status: external_exports.enum(["draft", "experimental", "verified", "deprecated", "revoked"]).optional(),
    locale: external_exports.enum(["en", "uk"]).optional(),
    include: external_exports.enum(["code", "metadata"]).optional().describe("search: code on all hits or none"),
    includeUnresolved: external_exports.boolean().default(false),
    cursor: external_exports.string().regex(/^[a-f0-9]{64}$/).optional(),
    offset: external_exports.number().int().min(0).max(1e4).default(0),
    limit: external_exports.number().int().min(1).max(8).default(3)
  }),
  "docs.select": external_exports.strictObject({
    ...base,
    request: external_exports.string().trim().min(1).max(4e3),
    version: external_exports.string().regex(/^26\.[12](?:@[A-Za-z0-9_.-]+)?$/).optional(),
    limit: external_exports.number().int().min(1).max(16).default(16)
  }),
  "docs.read": external_exports.strictObject({
    ...base,
    id: external_exports.string().max(200),
    version: external_exports.string().optional(),
    offset: external_exports.number().int().min(0).default(0),
    limit: external_exports.number().int().min(1).max(8192).default(4096)
  }),
  "docs.sync": external_exports.strictObject({ version: external_exports.string().min(1), dryRun: external_exports.boolean().default(false) }),
  "metadata.read": metadataInputSchema.extend({ ...base, env }).strict(),
  "apex.generate": external_exports.strictObject({
    ...base,
    name: external_exports.string().min(1).max(120),
    output: relativePath,
    alias: refName.optional()
  }),
  "apex.sync": external_exports.strictObject({
    ...base,
    debugTimings: external_exports.boolean().optional(),
    env,
    action: external_exports.enum(["init", "status", "changes", "refresh", "invalidate"])
  }),
  "apex.export": external_exports.strictObject({ ...base, env, output: relativePath }),
  "apex.validate": external_exports.strictObject({
    ...base,
    sourceDir: external_exports.string().min(1).max(4096).optional().describe(
      "APEXlang folder with application.apx to validate instead of apexrest.json application.sourceDir; works without a project"
    ),
    debugTimings: external_exports.boolean().optional(),
    env: env.optional()
  }),
  "apex.diff": external_exports.strictObject({ ...base, env, comparison: external_exports.enum(["auto", "live"]).default("auto") }),
  "db.plan": external_exports.strictObject({ ...base, env }),
  "deploy.plan": external_exports.strictObject({ ...base, env, out: relativePath, ...importOptions }).superRefine(checkImportOptions),
  "deploy.apply": external_exports.strictObject({ ...base, plan: relativePath }),
  "deploy.status": external_exports.strictObject({ ...base, run: external_exports.uuid() }),
  "deploy.reconcile": external_exports.strictObject({
    ...base,
    env,
    run: external_exports.uuid(),
    statements: external_exports.array(external_exports.strictObject({ file: relativePath, outcome: external_exports.enum(["applied", "not_applied"]) })).max(1e3).describe("JSON: [{file, outcome: applied|not_applied}] for every script of the run"),
    confirm: external_exports.string().max(200).optional().describe("<run id>:<plan digest prefix>, typed by the person"),
    userRequest: external_exports.string().min(1).max(4e3).describe("Literal instruction of the person who inspected the database")
  }),
  "deploy.restore-plan": external_exports.strictObject({ ...base, backup: external_exports.uuid(), out: relativePath }),
  "browser.open": external_exports.strictObject({
    ...base,
    env,
    browserMode: browserModeSchema.optional()
  }),
  "jobs.status": external_exports.strictObject({
    ...base,
    id: external_exports.uuid(),
    waitSeconds: external_exports.number().int().min(0).max(JOB_WAIT_MAX_SECONDS).default(0)
  }),
  "jobs.cancel": external_exports.strictObject({ ...base, id: external_exports.uuid() }),
  "artifacts.read": external_exports.strictObject({
    ...base,
    id: external_exports.uuid(),
    offset: external_exports.number().int().min(0).default(0),
    limit: external_exports.number().int().min(1).max(16384).default(4096)
  }),
  "preview.setup": external_exports.strictObject({
    zip: external_exports.string().min(1).max(4096).optional().describe("Local apex_26.2 zip; otherwise it is downloaded once"),
    assetsDir: external_exports.string().min(1).max(4096).optional(),
    sha256: external_exports.string().regex(/^[a-fA-F0-9]{64}$/).optional()
  }),
  "preview.start": external_exports.strictObject({
    ...previewSource,
    ...previewRun,
    commit: external_exports.boolean().default(false).describe(
      "With env, on a database on this computer only: commit each successful request instead of rolling it back (working mode)"
    ),
    port: external_exports.number().int().min(0).max(65535).optional(),
    reset: external_exports.boolean().default(false),
    user: external_exports.string().min(1).max(128).optional(),
    toolbar: external_exports.boolean().optional()
  }),
  "preview.check": external_exports.strictObject({
    ...previewSource,
    ...previewRun,
    pages: external_exports.array(external_exports.string().min(1).max(255)).min(1).max(500).optional()
  }),
  "preview.stop": external_exports.strictObject({ ...previewSelect, all: external_exports.boolean().default(false) }),
  "preview.comments": external_exports.strictObject({
    ...base,
    status: external_exports.enum(["open", "resolved", "all"]).default("open"),
    page: external_exports.string().min(1).max(64).optional().describe("Only comments of this page id")
  }),
  "preview.resolve": external_exports.strictObject({
    ...base,
    ids: external_exports.array(external_exports.string().min(1).max(64)).min(1).max(500).describe("Review comment ids (rc-...)"),
    note: external_exports.string().min(1).max(2e3).optional().describe("What was changed, shown next to the resolved comment"),
    reopen: external_exports.boolean().default(false)
  }),
  "preview.status": external_exports.strictObject(previewSelect),
  // Composite MCP operations. Each routes to the operations above so the CLI
  // keeps its granular commands while the agent sees one tool per concern.
  project: external_exports.strictObject({
    debugTimings: external_exports.boolean().optional(),
    ...base,
    action: external_exports.enum([
      "init",
      "adopt",
      "inspect",
      "scaffold",
      "patch",
      "context",
      "insert",
      "edit",
      "connection_add",
      "connection_list",
      "connection_test"
    ]),
    specFile: relativePath.optional().describe("scaffold: JSON spec; see work skill scaffold guide"),
    page: external_exports.string().optional(),
    operations: external_exports.array(external_exports.record(external_exports.string(), external_exports.unknown())).optional().describe("patch/insert/edit: see patch guide"),
    components: external_exports.record(external_exports.string(), external_exports.unknown()).optional(),
    expectedDigest: external_exports.string().optional(),
    context: external_exports.enum(["delta", "full", "none"]).optional(),
    directory: external_exports.string().min(1).optional().describe("init: new or empty directory for the project"),
    template: external_exports.enum(["blank-app", "customer-crm", "existing-app"]).optional(),
    alias: refName.optional(),
    env: env.optional(),
    appId: external_exports.number().int().positive().optional(),
    workingCopy: external_exports.boolean().optional(),
    detail: external_exports.enum(["full", "summary"]).default("summary"),
    name: refName.optional().describe("connection reference name"),
    sqlclName: savedConnectionName.optional(),
    ordsUrl: ordsUrl.optional(),
    ordsUsername: ordsUsername.optional(),
    passwordFile: external_exports.string().min(1).max(4096).optional(),
    envFile: external_exports.string().min(1).max(4096).optional(),
    usernameKey: external_exports.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(),
    passwordKey: external_exports.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(),
    urlKey: external_exports.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(),
    saved: external_exports.boolean().default(false)
  }),
  reference: external_exports.strictObject({
    ...base,
    mode: external_exports.enum(["search", "read", "select"]),
    request: external_exports.string().trim().min(1).max(4e3).optional().describe("select: public UI needs"),
    query: external_exports.string().min(1).max(256).optional(),
    id: external_exports.string().max(200).optional().describe("read: reference ID"),
    corpus: external_exports.enum(["apexlang", "components", "patterns", "blocks", "blueprints"]).default("apexlang"),
    version: external_exports.string().optional(),
    kind: external_exports.enum(["grammar", "template", "contract", "guide"]).optional(),
    family: external_exports.string().min(1).max(200).optional(),
    profile: external_exports.string().max(200).optional(),
    status: external_exports.enum(["draft", "experimental", "verified", "deprecated", "revoked"]).optional(),
    locale: external_exports.enum(["en", "uk"]).optional(),
    include: external_exports.enum(["code", "metadata"]).optional().describe("search: code on all hits or none"),
    includeUnresolved: external_exports.boolean().default(false),
    cursor: external_exports.string().regex(/^[a-f0-9]{64}$/).optional(),
    offset: external_exports.number().int().min(0).max(1e7).default(0),
    limit: external_exports.number().int().min(1).max(32768).optional().describe("search/select: 1-8; read: capped to 8192 chars, follow nextOffset")
  }),
  ship: external_exports.strictObject({
    ...base,
    debugTimings: external_exports.boolean().optional(),
    env,
    mode: external_exports.enum(["plan", "apply", "recover"]).default("plan"),
    plan: relativePath.optional(),
    run: external_exports.uuid().optional(),
    confirmation: external_exports.strictObject({
      planDigest: external_exports.string().regex(/^[a-f0-9]{64}$/),
      userRequest: external_exports.string().min(1).max(2e3)
    }).optional(),
    ...importOptions,
    userRequest: external_exports.string().trim().min(1).max(16e3).describe("Literal human instruction authorizing this change")
  }).superRefine(checkImportOptions).superRefine((value, ctx) => {
    if (value.mode === "recover" && !value.run)
      ctx.addIssue({
        code: "custom",
        path: ["run"],
        message: "mode recover requires the interrupted run UUID."
      });
    if (value.mode !== "recover" && value.run)
      ctx.addIssue({ code: "custom", path: ["run"], message: "run applies to mode recover only." });
    if (value.mode !== "apply" && (value.plan || value.confirmation))
      ctx.addIssue({
        code: "custom",
        path: [value.plan ? "plan" : "confirmation"],
        message: "plan and confirmation apply to mode apply only."
      });
  }),
  // Internal: the detached worker's apply phase for apexrest_ship.
  "ship.apply": external_exports.strictObject({
    ...base,
    env,
    plan: relativePath,
    confirmation: external_exports.strictObject({
      planDigest: external_exports.string().regex(/^[a-f0-9]{64}$/),
      userRequest: external_exports.string().min(1).max(2e3)
    }).optional(),
    userRequest: external_exports.string().trim().min(1).max(16e3)
  }),
  "peer.status": external_exports.strictObject(base),
  "peer.review": external_exports.strictObject({
    ...base,
    plan: relativePath.optional().describe("Saved plan path from apexrest_ship mode:plan"),
    vendor: external_exports.enum(["codex", "claude"]).optional(),
    focus: external_exports.string().min(1).max(2e3).optional()
  }),
  peer: external_exports.strictObject({
    ...base,
    action: external_exports.enum(["status", "review"]).default("review"),
    plan: relativePath.optional().describe("review: saved plan path; omit for local sources"),
    vendor: external_exports.enum(["codex", "claude"]).optional().describe("codex from Claude Code, claude from Codex"),
    focus: external_exports.string().min(1).max(2e3).optional()
  }),
  job: external_exports.strictObject({
    ...base,
    action: external_exports.enum(["status", "cancel"]).default("status"),
    jobId: external_exports.uuid(),
    waitSeconds: external_exports.number().int().min(0).max(JOB_WAIT_MAX_SECONDS).default(0)
  }),
  status: external_exports.strictObject({ ...base, detail: external_exports.enum(["doctor", "project"]).default("project") }),
  preview: external_exports.strictObject({
    project,
    action: external_exports.enum(["setup", "start", "check", "stop", "status", "comments", "resolve"]),
    sourceDir: external_exports.string().min(1).max(4096).optional(),
    env: env.optional(),
    commit: external_exports.boolean().optional(),
    zip: external_exports.string().min(1).max(4096).optional(),
    port: external_exports.number().int().min(0).max(65535).optional(),
    reset: external_exports.boolean().optional(),
    pages: external_exports.array(external_exports.string().min(1).max(255)).min(1).max(500).optional(),
    ids: external_exports.array(external_exports.string()).optional(),
    note: external_exports.string().max(2e3).optional()
  })
};
var internalOperations = [
  "project",
  "reference",
  "ship.apply",
  "job",
  "preview",
  "peer"
];
var toolCatalog = [
  {
    name: "apexrest_project",
    operation: "project",
    description: "App init/adopt/inspect/scaffold: native 26.1/26.2 pages from JSON. Connections add/list/test; private passwordFile/envFile.",
    readOnly: false,
    destructive: false,
    openWorld: true
  },
  {
    name: "apexrest_reference",
    operation: "reference",
    description: "Offline references; select uses optional OpenAI Decisions and requires project.",
    readOnly: true,
    openWorld: true
  },
  {
    name: "apexrest_metadata_read",
    operation: "metadata.read",
    description: "Scoped paginated metadata: kind/schema or requests[] (max 8). Target verified; content untrusted.",
    readOnly: true,
    openWorld: true
  },
  {
    name: "apexrest_apex_validate",
    operation: "apex.validate",
    description: "Compile staged sources with Oracle; return located diagnostics and separate CodeScan/upgrade advice. No database call.",
    readOnly: true
  },
  {
    name: "apexrest_ship",
    operation: "ship",
    description: "Plan, apply or recover on DEV/QA/TEST with backup/drift/identity checks. importMode:auto selects eligible files or explains full import; full forces whole app; files uses explicit paths. Apply binds and revokes the userRequest grant. No production; plan never writes Oracle.",
    readOnly: false,
    destructive: true,
    long: true,
    worker: true,
    openWorld: true
  },
  {
    name: "apexrest_apex_sync",
    operation: "apex.sync",
    description: "Single-editor dev/test working copy: init, local status, changes (read-only server diff), explicit refresh/invalidate. Reconcile blocked outcomes.",
    readOnly: false,
    destructive: false,
    long: true,
    openWorld: true
  },
  {
    name: "apexrest_browser_open",
    operation: "browser.open",
    description: "Return the configured APEX URL for the host in-app browser (codex/host). Inspect affected pages with host browser controls; opening is not verification.",
    readOnly: false,
    destructive: false,
    openWorld: true
  },
  {
    name: "apexrest_preview",
    operation: "preview",
    description: "APEXlang preview (UT 26.2): SQLite, or env (DEV/QA/TEST) for rolled-back Oracle data/PL/SQL. setup; start: URLs; check: gaps; comments/resolve: review notes. Not evidence.",
    readOnly: false,
    destructive: false,
    openWorld: true
  },
  {
    name: "apexrest_peer_review",
    operation: "peer",
    description: "Other-vendor CLI (codex or claude) reviews a saved ship plan or, without plan, local sources, read-only; plan verdict gates required apply. status: CLI/sign-in. Never deploys.",
    readOnly: false,
    destructive: false,
    long: true,
    openWorld: true
  },
  {
    name: "apexrest_job",
    operation: "job",
    description: "Read status and phase by jobId. See the tool schema for waits. Action cancel requests cancellation. The database outcome can remain unknown.",
    readOnly: false,
    destructive: true
  },
  {
    name: "apexrest_artifact_read",
    operation: "artifacts.read",
    description: "Read registered sanitized text by opaque ID and bounded range.",
    readOnly: true
  },
  {
    name: "apexrest_status",
    operation: "status",
    description: "doctor inspects tools without downloads; project reads settings, connections, sync, jobs, deployments and grants. No database call.",
    readOnly: true
  }
];

export {
  schemas,
  internalOperations,
  toolCatalog
};
