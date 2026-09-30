import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  JobService,
  PanelService,
  composeMaterialize,
  composeMaterializeInput,
  composePlan,
  composePlanInput,
  metadataInputSchema,
  metadataRead,
  panelActionSchema,
  panelReadSchema,
  publicPanelActionSchema
} from "./chunk-2BBNJVKW.mjs";
import {
  ArtifactService,
  DeploymentService,
  SyncStore,
  TestService,
  catalogRead,
  catalogSearch,
  checkpoint
} from "./chunk-YPLIIQ4Y.mjs";
import {
  VERSION
} from "./chunk-G3KR57BY.mjs";
import {
  OracleAdapter,
  configureConnection,
  configureSqlcl,
  connections,
  databaseTransport,
  editConnection,
  environment,
  external_exports,
  installSources,
  loadProject,
  managedHome,
  ordsUrl,
  ordsUsername,
  parse,
  projectInit,
  projectInspect,
  refName,
  relativePath,
  requireTrust,
  resolveConnection,
  resourceRoot,
  runProcess,
  runtimeState,
  savedConnectionName,
  sqlclConfig,
  sqlclMode,
  sqlclRestriction
} from "./chunk-EBBEN4AV.mjs";
import {
  Fault,
  artifactPage,
  canonical,
  contained,
  exists,
  failure,
  hash,
  readJson,
  redact,
  sanitized,
  success,
  writeJson
} from "./chunk-2Z3BZF66.mjs";

// packages/core/src/operations.ts
var project = external_exports.string().min(1).max(4096).optional();
var env = refName;
var base = { project };
var dependencies = {
  home: external_exports.string().optional(),
  yes: external_exports.boolean().default(false),
  nonInteractive: external_exports.boolean().default(false),
  offline: external_exports.boolean().default(false),
  cacheDir: external_exports.string().optional(),
  dryRun: external_exports.boolean().default(false),
  acceptOracleLicense: external_exports.boolean().default(false),
  skipBrowser: external_exports.boolean().default(false),
  installOsDeps: external_exports.boolean().default(false)
};
var setup = {
  ...base,
  ...dependencies,
  from: external_exports.string().optional(),
  codexHome: external_exports.string().optional(),
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
  "panel.open": panelReadSchema,
  "panel.status": panelReadSchema,
  "panel.action": publicPanelActionSchema,
  setup: external_exports.strictObject(setup),
  "dependencies.install": external_exports.strictObject(dependencies),
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
  "connection.add": external_exports.strictObject({
    ...base,
    name: refName,
    sqlclName: savedConnectionName.optional(),
    ordsUrl: ordsUrl.optional(),
    ordsUsername: ordsUsername.optional(),
    passwordFile: external_exports.string().min(1).max(4096).optional()
  }).refine(
    (value) => !!value.sqlclName || !!(value.ordsUrl && value.ordsUsername),
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
    cursor: external_exports.string().regex(/^[a-f0-9]{64}$/).optional(),
    offset: external_exports.number().int().min(0).max(1e4).default(0),
    limit: external_exports.number().int().min(1).max(8).default(3)
  }),
  "docs.read": external_exports.strictObject({
    ...base,
    id: external_exports.string().max(200),
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
  "apex.sync": external_exports.strictObject({ ...base, env, action: external_exports.enum(["init", "status", "refresh", "invalidate"]) }),
  "apex.export": external_exports.strictObject({ ...base, env, output: relativePath }),
  "apex.validate": external_exports.strictObject({ ...base, env: env.optional() }),
  "apex.diff": external_exports.strictObject({ ...base, env, comparison: external_exports.enum(["auto", "live"]).default("auto") }),
  "db.plan": external_exports.strictObject({ ...base, env }),
  "deploy.plan": external_exports.strictObject({ ...base, env, out: relativePath }),
  "deploy.apply": external_exports.strictObject({ ...base, plan: relativePath }),
  "deploy.status": external_exports.strictObject({ ...base, run: external_exports.uuid() }),
  "deploy.restore-plan": external_exports.strictObject({ ...base, backup: external_exports.uuid(), out: relativePath }),
  "test.run": external_exports.strictObject({
    ...base,
    suite: external_exports.enum(["unit", "sql", "api", "e2e", "all"]),
    env: env.optional(),
    headed: external_exports.boolean().default(false)
  }),
  "test.report": external_exports.strictObject({ ...base, run: external_exports.uuid() }),
  "test.auth": external_exports.strictObject({ ...base, env }),
  "browser.open": external_exports.strictObject({ ...base, env, browserMode: external_exports.enum(["codex", "external"]).optional() }),
  "jobs.status": external_exports.strictObject({
    ...base,
    id: external_exports.uuid(),
    waitSeconds: external_exports.number().int().min(0).max(30).default(0)
  }),
  "jobs.cancel": external_exports.strictObject({ ...base, id: external_exports.uuid() }),
  "artifacts.read": external_exports.strictObject({
    ...base,
    id: external_exports.uuid(),
    offset: external_exports.number().int().min(0).default(0),
    limit: external_exports.number().int().min(1).max(16384).default(4096)
  }),
  "sandbox.up": external_exports.strictObject(base),
  "sandbox.status": external_exports.strictObject(base),
  "sandbox.down": external_exports.strictObject(base)
};
var toolCatalog = [
  {
    name: "apexrest_compose_plan",
    operation: "compose.plan",
    description: "Create an immutable Composer plan. Offline by default; connected requires an explicit environment. No import or database writes. Full plans are artifacts.",
    readOnly: false,
    destructive: false,
    long: true
  },
  {
    name: "apexrest_compose_materialize",
    operation: "compose.materialize",
    description: "Apply a reviewed Composer plan using its expected digest. Journaled local source writes only; never deploys. Recovery is explicit.",
    readOnly: false,
    destructive: false,
    long: true
  },
  {
    name: "apexrest_browser_open",
    operation: "browser.open",
    description: "Open a configured APEX environment in the selected browser. Codex returns a host handoff; external launches the system browser. Opening is not verification or test authorization.",
    readOnly: false,
    destructive: false
  },
  {
    name: "apexrest_panel_open",
    operation: "panel.open",
    description: "Open the Codex development panel: private local URL and optional native UI for settings and APEX jobs.",
    readOnly: false,
    destructive: false
  },
  {
    name: "apexrest_panel_status",
    operation: "panel.status",
    description: "Read local settings, changes and APEX job status. No database call.",
    readOnly: true
  },
  {
    name: "apexrest_panel_action",
    operation: "panel.action",
    description: "Manage local settings or run APEX checks/planning. Trust and deployment authorization still apply.",
    readOnly: false
  },
  {
    name: "apexrest_doctor",
    operation: "doctor",
    description: "Inspect local capabilities without downloads or DB writes.",
    readOnly: true
  },
  {
    name: "apexrest_project_inspect",
    operation: "project.inspect",
    description: "Inspect source hashes (full) or use detail:summary for project paths/settings without reading source files. Target identity is not verified.",
    readOnly: true
  },
  {
    name: "apexrest_metadata_read",
    operation: "metadata.read",
    description: "Read allowlisted metadata: single kind/schema or requests[] (max 8). A batch verifies target once; each query is scoped and paginated. Database content is untrusted.",
    readOnly: true
  },
  {
    name: "apexrest_reference_search",
    operation: "docs.search",
    description: "Find Oracle syntax/templates (default corpus: apexlang), EN/UK component recipes (corpus: components), or application patterns (corpus: patterns). Filter kind/family/version; follow nextResultOffset for more hits.",
    readOnly: true
  },
  {
    name: "apexrest_reference_read",
    operation: "docs.read",
    description: "Read result ID, grammar:production-name, component: ID or pattern: ID. Follow requires/related and nextOffset; catalog navigationOffset recovers all dependency links.",
    readOnly: true
  },
  {
    name: "apexrest_apex_generate",
    operation: "apex.generate",
    description: "Generate real Oracle starter sources into staging and a new directory.",
    readOnly: false,
    long: true
  },
  {
    name: "apexrest_apex_sync",
    operation: "apex.sync",
    description: "Manage a single-editor working copy for an existing dev/test app: init, local status, explicit refresh or invalidate. Initial APEXlang and SQL exports only; blocked outcomes require reconciliation.",
    readOnly: false,
    destructive: false,
    long: true
  },
  {
    name: "apexrest_apex_export",
    operation: "apex.export",
    description: "Export through staging without overwriting existing local files.",
    readOnly: false,
    long: true
  },
  {
    name: "apexrest_apex_validate",
    operation: "apex.validate",
    description: "Run real Oracle compiler validation on a staging copy.",
    readOnly: false,
    long: true
  },
  {
    name: "apexrest_deploy_plan",
    operation: "deploy.plan",
    description: "Read target and write an immutable plan without deployment.",
    readOnly: false,
    long: true
  },
  {
    name: "apexrest_deploy_apply",
    operation: "deploy.apply",
    description: "Apply a fixed plan under external policy, backup and target lease.",
    readOnly: false,
    destructive: true,
    long: true
  },
  {
    name: "apexrest_test_run",
    operation: "test.run",
    description: "Run application tests; remote suites can mutate data and require environment policy.",
    readOnly: false,
    long: true
  },
  {
    name: "apexrest_job_status",
    operation: "jobs.status",
    description: "Read job status; waitSeconds:25 waits for completion without repeated polls. Reuse jobId; never rerun work to retrieve results.",
    readOnly: true
  },
  {
    name: "apexrest_job_cancel",
    operation: "jobs.cancel",
    description: "Request cancellation; database outcome may remain unknown.",
    readOnly: false
  },
  {
    name: "apexrest_artifact_read",
    operation: "artifacts.read",
    description: "Read registered sanitized text by opaque ID and bounded range.",
    readOnly: true
  }
];

// packages/core/src/service.ts
import path4 from "node:path";

// packages/core/src/doctor.ts
import path from "node:path";
async function doctor() {
  const state = await runtimeState();
  const java = process.env.APEXREST_JAVA_HOME ? path.join(process.env.APEXREST_JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java") : state.java ?? "java";
  const probes = await Promise.all(
    [
      ["codex", ["--version"]],
      [process.env.APEXREST_SQLCL ?? state.sqlcl ?? "sql", ["-version"]],
      [java, ["-version"]]
    ].map(async ([exe, args]) => {
      try {
        const r = await runProcess({
          executable: exe,
          args,
          cwd: process.env.TMPDIR ?? process.cwd(),
          timeoutMs: 1e4,
          env: {
            ...process.env,
            JAVA_HOME: path.isAbsolute(java) ? path.dirname(path.dirname(java)) : process.env.JAVA_HOME
          }
        });
        return {
          command: exe,
          state: r.code === 0 ? "detected" : "unavailable",
          version: (r.stdout + r.stderr).trim().slice(0, 500)
        };
      } catch {
        return { command: exe, state: "missing" };
      }
    })
  );
  return {
    platform: process.platform,
    architecture: process.arch,
    runtime: {
      executable: process.execPath,
      version: process.version,
      baseline: process.versions.node.split(".")[0] === "24"
    },
    managedComponents: state.components,
    sqlcl: await sqlclConfig(),
    probes,
    database: "not-configured",
    nativeHost: "requires-host-verification",
    telemetry: false
  };
}

// packages/core/src/references.ts
import path3 from "node:path";
import { stat as stat2, readFile as readFile2 } from "node:fs/promises";

// packages/core/src/reference-index.ts
var referenceWords = (text) => text.replace(/([a-z\d])([A-Z])/g, "$1 $2").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
var normalizeReference = (text) => referenceWords(text).join(" ");
function buildReferencePostings(entries) {
  const postings = /* @__PURE__ */ Object.create(null);
  entries.forEach((entry, position) => {
    for (const word of new Set(referenceWords(entry.id + " " + (entry.title ?? "") + " " + entry.text)))
      (postings[word] ??= []).push(position);
  });
  return postings;
}

// packages/core/src/reference-catalog.ts
import path2 from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";
var digest = external_exports.string().regex(/^[a-f0-9]{64}$/);
var ascii = (max) => external_exports.string().min(1).max(max).regex(/^[\x20-\x7e]+$/);
var referenceId = ascii(200);
var compatibilitySchema = external_exports.object({
  apexVersion: ascii(64),
  themeVersion: ascii(64),
  mmdVersion: ascii(64)
});
var entrySchema = external_exports.object({
  id: referenceId,
  title: external_exports.string().min(1).max(240),
  kind: external_exports.enum(["contract", "template", "guide"]),
  family: ascii(200),
  version: ascii(120),
  source: ascii(2048),
  document: ascii(240),
  sha256: digest,
  searchText: external_exports.string().max(2e5),
  requires: external_exports.array(referenceId),
  related: external_exports.array(referenceId),
  readiness: external_exports.enum(["ready", "reference", "unresolved"]),
  compatibility: compatibilitySchema,
  length: external_exports.number().int().nonnegative().optional()
});
var manifestSchema = external_exports.object({
  schemaVersion: external_exports.literal(1),
  catalogVersion: ascii(120),
  source: external_exports.object({ apexVersion: ascii(64), themeVersion: ascii(64), mmdVersion: ascii(64) }).passthrough(),
  indexSha256: digest,
  files: external_exports.record(external_exports.string(), digest),
  counts: external_exports.record(external_exports.string(), external_exports.unknown())
});
function createReferenceCatalog(definition) {
  function invalid(message) {
    throw new Fault(`${definition.faultPrefix}_CATALOG_INVALID`, message, 3);
  }
  function relativeFile(file) {
    if (!/^[A-Za-z0-9_./-]+$/.test(file) || path2.isAbsolute(file) || file.split("/").some((part) => !part || part === "." || part === ".."))
      invalid(`${definition.label} catalog contains an unsafe file path.`);
    return file;
  }
  async function containedFile(root, file) {
    const resolved = await realpath(path2.join(root, relativeFile(file)));
    const relative = path2.relative(root, resolved);
    if (!relative || relative.startsWith(".." + path2.sep) || relative === ".." || path2.isAbsolute(relative))
      invalid(`${definition.label} catalog file resolves outside its resource directory.`);
    return resolved;
  }
  async function stamp(file) {
    const info = await stat(file, { bigint: true });
    return `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
  }
  async function loadIndex(root, manifestFile, indexFile) {
    try {
      const manifest = manifestSchema.parse(JSON.parse(await readFile(manifestFile, "utf8")));
      for (const file of Object.keys(manifest.files)) relativeFile(file);
      if (manifest.files["index.json"] !== manifest.indexSha256)
        invalid(`${definition.label} catalog manifest index hashes disagree.`);
      const raw = await readFile(indexFile, "utf8");
      if (hash(raw) !== manifest.indexSha256)
        invalid(`${definition.label} catalog index checksum does not match its manifest.`);
      const entries = external_exports.array(entrySchema).parse(JSON.parse(raw));
      const byId = /* @__PURE__ */ new Map();
      const searchable = entries.map((entry) => {
        if (!entry.id.startsWith(definition.prefix))
          invalid(`${definition.label} catalog contains a reference ID with an invalid prefix.`);
        relativeFile(entry.document);
        if (!entry.document.startsWith(definition.documentDirectory + "/") || !entry.document.endsWith(".md"))
          invalid(
            `${definition.label} documents must be Markdown files inside ${definition.documentDirectory}/.`
          );
        if (manifest.files[entry.document] !== entry.sha256)
          invalid(`${definition.label} document checksum is missing or disagrees with its manifest.`);
        if (byId.has(entry.id)) invalid(`${definition.label} catalog contains duplicate reference IDs.`);
        byId.set(entry.id, entry);
        return {
          entry,
          words: new Set(referenceWords(`${entry.id} ${entry.title} ${entry.searchText}`)),
          title: normalizeReference(entry.title),
          body: normalizeReference(entry.searchText)
        };
      });
      for (const entry of entries)
        for (const id of [...entry.requires, ...entry.related])
          if (id.startsWith(definition.prefix) && !byId.has(id))
            invalid(
              `${definition.label} catalog contains an unresolved ${definition.label.toLowerCase()} reference.`
            );
      return { root, manifest, byId, searchable };
    } catch (error) {
      if (error instanceof Fault) throw error;
      invalid(`${definition.label} catalog manifest or index cannot be read or has an invalid format.`);
    }
  }
  let cached2;
  async function catalogIndex() {
    let root, manifestFile, indexFile, revision;
    try {
      root = await realpath(path2.join(resourceRoot(), definition.directory));
      manifestFile = await containedFile(root, "manifest.json");
      indexFile = await containedFile(root, "index.json");
      revision = await stamp(manifestFile) + ":" + await stamp(indexFile);
    } catch (error) {
      cached2 = void 0;
      if (error instanceof Fault) throw error;
      throw new Fault(
        `${definition.faultPrefix}_CATALOG_UNAVAILABLE`,
        `Install a reviewed release containing the ${definition.label.toLowerCase()} catalog.`,
        3
      );
    }
    if (cached2?.root === root && cached2.stamp === revision) return cached2.pending;
    const pending = loadIndex(root, manifestFile, indexFile);
    cached2 = { root, stamp: revision, pending };
    try {
      return await pending;
    } catch (error) {
      if (cached2?.pending === pending) cached2 = void 0;
      throw error;
    }
  }
  const stopwords2 = /* @__PURE__ */ new Set(["a", "an", "the", "for", "with", "and", "of", "to", "in"]);
  const bytes = (value) => Buffer.byteLength(JSON.stringify(sanitized(value)), "utf8");
  function metadata(entry) {
    return {
      id: entry.id,
      title: entry.title,
      kind: entry.kind,
      family: entry.family,
      version: entry.version,
      source: entry.source,
      readiness: entry.readiness,
      compatibility: entry.compatibility,
      classification: definition.classification
    };
  }
  function links(entry, count) {
    return {
      requires: entry.requires.slice(0, count),
      requiresCount: entry.requires.length,
      requiresOmittedCount: Math.max(0, entry.requires.length - count),
      related: entry.related.slice(0, count),
      relatedCount: entry.related.length,
      relatedOmittedCount: Math.max(0, entry.related.length - count)
    };
  }
  function window(text, start, length) {
    let end = Math.min(text.length, start + length);
    if (end > start && /[\uD800-\uDBFF]/.test(text[end - 1]) && /[\uDC00-\uDFFF]/.test(text[end] ?? ""))
      end += end - start === 1 ? 1 : -1;
    return text.slice(start, end);
  }
  async function search(query, version, options = {}) {
    const terms = [...new Set(referenceWords(query).filter((term) => !stopwords2.has(term)))];
    if (!terms.length) return [];
    const index = await catalogIndex();
    const normalized = normalizeReference(query);
    const ranked = index.searchable.filter(
      ({ entry, words }) => (entry.id === query.trim() || terms.every((term) => words.has(term))) && (!version || entry.version === version || !version.includes("@") && entry.version.split("@")[0] === version) && (!options.kind || entry.kind === options.kind) && (!options.family || entry.family === options.family || entry.family.startsWith(options.family + "/"))
    ).map(({ entry, title, body }) => ({
      entry,
      score: (entry.id === query.trim() ? 1e4 : 0) + (title === normalized ? 2e3 : 0) + (title.includes(normalized) ? 400 : 0) + terms.filter((term) => [...referenceWords(title)].includes(term)).length * 50 + (body.includes(normalized) ? 80 : 0) + (entry.readiness === "ready" ? 10 : 0) + (entry.kind === "contract" ? 5 : 0)
    })).sort((a, b) => b.score - a.score || (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0));
    const offset = Math.max(0, options.offset ?? 0), limit = Math.max(1, Math.min(8, options.limit ?? 3));
    const candidates = ranked.slice(offset, offset + limit).map(({ entry }) => {
      const first = terms.map((term) => entry.searchText.toLowerCase().indexOf(term)).filter((n) => n >= 0);
      const matchOffset = first.length ? Math.min(...first) : null;
      let snippetOffset = Math.max(0, (matchOffset ?? 0) - 80);
      if (snippetOffset && /[\uDC00-\uDFFF]/.test(entry.searchText[snippetOffset] ?? "") && /[\uD800-\uDBFF]/.test(entry.searchText[snippetOffset - 1] ?? ""))
        snippetOffset--;
      const text = window(entry.searchText, snippetOffset, 600);
      return {
        ...metadata(entry),
        ...links(entry, 2),
        text,
        // Index summaries are intentionally independent of documents; read a result at offset 0.
        snippetSource: "index",
        readOffset: 0,
        offset: snippetOffset,
        matchOffset,
        length: entry.searchText.length,
        nextOffset: null,
        totalMatches: ranked.length,
        nextResultOffset: null
      };
    });
    const results = [];
    for (const hit of candidates) {
      while (bytes([...results, hit]) > 7e3 && hit.text.length) {
        const remaining = Math.floor(hit.text.length / 2);
        hit.text = remaining < 2 ? "" : window(hit.text, 0, remaining);
      }
      if (bytes([...results, hit]) > 7e3) break;
      results.push(hit);
    }
    if (!results.length && candidates.length)
      invalid(`${definition.label} result metadata exceeds the response budget.`);
    const next = offset + results.length < ranked.length ? offset + results.length : null;
    for (const result of results) result.nextResultOffset = next;
    return results;
  }
  async function read(id, offset, limit) {
    const index = await catalogIndex();
    const entry = index.byId.get(id);
    if (!entry)
      throw new Fault(
        "REFERENCE_NOT_FOUND",
        `No registered ${definition.label.toLowerCase()} reference with this ID.`,
        2
      );
    let raw;
    try {
      raw = await readFile(await containedFile(index.root, entry.document), "utf8");
    } catch (error) {
      if (error instanceof Fault) throw error;
      invalid(`${definition.label} document cannot be read.`);
    }
    if (hash(raw) !== entry.sha256)
      invalid(`${definition.label} document checksum does not match the catalog.`);
    if (entry.length !== void 0 && entry.length !== raw.length)
      invalid(`${definition.label} document length does not match the catalog.`);
    const navigation = "\n\n## Catalog navigation\n\n" + entry.requires.map((target) => `- requires: ${target}
`).join("") + entry.related.map((target) => `- related: ${target}
`).join("");
    const safeRaw = redact(raw);
    const document = safeRaw + redact(navigation);
    const start = Math.max(0, offset);
    let count = Math.max(1, Math.min(8192, limit));
    const create = () => artifactPage(document, "text", id, start, count, {
      ...metadata(entry),
      ...links(entry, 16),
      length: document.length,
      documentLength: safeRaw.length,
      sourceDocumentLength: raw.length,
      contentSanitized: true,
      navigationOffset: safeRaw.length,
      sha256: entry.sha256
    });
    let result = create();
    while (bytes(result) > 3e4 && count > 1) {
      count = Math.max(1, Math.floor(count / 2));
      result = create();
    }
    if (bytes(result) > 3e4) invalid(`${definition.label} document metadata exceeds the response budget.`);
    return result;
  }
  return { search, read };
}

// packages/core/src/components.ts
var catalog = createReferenceCatalog({
  directory: "components",
  prefix: "component:",
  documentDirectory: "documents",
  label: "Component",
  faultPrefix: "COMPONENT",
  classification: "component-reference-data"
});
var componentSearch = catalog.search;
var componentRead = catalog.read;

// packages/core/src/patterns.ts
var catalog2 = createReferenceCatalog({
  directory: "patterns",
  prefix: "pattern:",
  documentDirectory: "docs",
  label: "Pattern",
  faultPrefix: "PATTERN",
  classification: "pattern-reference-data"
});
var patternSearch = catalog2.search;
var patternRead = catalog2.read;

// packages/core/src/references.ts
var references = [
  {
    id: "apexlang-lifecycle",
    version: "26.1",
    source: "https://docs.oracle.com/en/database/oracle/sql-developer-command-line/26.1/sqcug/apexlang.html",
    text: 'Generate starter files using apex generate -name "Name" -dir ./fresh. Validate with apex validate -input ./application. Export requires a connection and always uses fresh staging. Import deploys the full application and requires a reviewed plan. Preserve .apex/apexlang.json and its compiler metadata.'
  },
  {
    id: "deployment-safety",
    version: "1.0.0",
    source: "docs/adr/007-clean-apex-deployment.md",
    text: "Use an explicit environment. Plans bind source hashes and target identity. Recheck drift, acquire local coordination by default and create an export backup before writes. Clean APEX deployment needs no service tables. Local runners must share one managed home; independent machines need external serialization or explicitly selected database coordination. DDL cannot be generally rolled back. Interrupted writes require reconciliation. Production requires an external approval boundary."
  }
];
var stopwords = /* @__PURE__ */ new Set(["a", "an", "the", "for", "with", "and", "of", "to", "in"]);
var termsFor = (text) => [...new Set(referenceWords(text).filter((word) => !stopwords.has(word)))];
function versionMatches(actual, requested) {
  if (!requested) return true;
  return actual === requested || !requested.includes("@") && actual.split("@")[0] === requested;
}
function indexReferences(upstream, file, digest2) {
  const entries = [...references, ...upstream];
  const byId = /* @__PURE__ */ new Map();
  const bySymbol = /* @__PURE__ */ new Map();
  const searchable = entries.map((reference) => {
    if (!byId.has(reference.id)) byId.set(reference.id, reference);
    const symbol = reference.text.match(/^<([^>\n]+)>\s*::=/)?.[1];
    if (symbol) bySymbol.set(symbol, reference.id);
    const title = reference.title ?? symbol ?? reference.id;
    return {
      reference,
      title,
      titleText: normalizeReference(title),
      ranking: void 0
    };
  });
  let pendingPostings;
  const postings = () => pendingPostings ??= (async () => {
    if (file) {
      try {
        const prebuilt = await readJson(path3.join(path3.dirname(file), "search.json"));
        if (prebuilt && prebuilt.schemaVersion === 1 && prebuilt.indexSha256 === digest2 && prebuilt.postings && Object.values(prebuilt.postings).every(
          (list) => Array.isArray(list) && list.every(
            (n) => Number.isInteger(n) && Number(n) >= 0 && Number(n) < upstream.length
          )
        )) {
          const result = buildReferencePostings(references);
          for (const [term, list] of Object.entries(prebuilt.postings))
            result[term] = [
              ...result[term] ?? [],
              ...list.map((position) => position + references.length)
            ];
          return result;
        }
      } catch {
      }
    }
    return buildReferencePostings(entries);
  })();
  return { upstream, byId, bySymbol, searchable, postings, queries: /* @__PURE__ */ new Map() };
}
var cached;
async function referenceIndex() {
  const file = path3.join(resourceRoot(), "references/index.json");
  let info;
  try {
    info = await stat2(file, { bigint: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    cached = void 0;
    return indexReferences([]);
  }
  const stamp = `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
  if (cached?.file === file && cached.stamp === stamp) return cached.pending;
  const pending = readFile2(file, "utf8").then(
    (raw) => indexReferences(JSON.parse(raw), file, hash(raw))
  );
  cached = { file, stamp, pending };
  try {
    return await pending;
  } catch (error) {
    if (cached?.pending === pending) cached = void 0;
    throw error;
  }
}
function snippet(text, query, terms) {
  const lower = text.toLowerCase();
  let matchOffset = lower.indexOf(query.trim().toLowerCase());
  if (matchOffset < 0) {
    const pattern = referenceWords(query).join("[\\s._:-]*");
    if (pattern) matchOffset = lower.search(new RegExp(pattern, "u"));
  }
  if (matchOffset < 0) {
    const locations = terms.map((term) => lower.indexOf(term)).filter((offset2) => offset2 >= 0);
    matchOffset = locations.length ? Math.min(...locations) : -1;
  }
  const offset = Math.max(0, Math.min(matchOffset - 160, text.length - 1200));
  return {
    text: text.slice(offset, offset + 1200),
    offset,
    matchOffset: matchOffset < 0 ? null : matchOffset,
    length: text.length,
    nextOffset: offset + 1200 < text.length ? offset + 1200 : null
  };
}
async function referenceSearch(query, version, options = {}) {
  if (options.corpus === "blocks" || options.corpus === "blueprints") {
    const found = await catalogSearch(query, { ...options, ...version ? { version } : {} });
    return found.results.map((hit) => ({
      ...hit,
      source: "bundled-composer-catalog",
      version: "version" in hit ? hit.version : "1",
      kind: "template",
      family: "composer",
      text: hit.title,
      offset: 0,
      matchOffset: 0,
      length: hit.title.length,
      nextOffset: null,
      requires: [],
      totalMatches: found.totalMatches,
      nextResultOffset: found.nextResultOffset
    }));
  }
  if (options.corpus === "components") return componentSearch(query, version, options);
  if (options.corpus === "patterns") return patternSearch(query, version, options);
  const terms = termsFor(query);
  if (!terms.length) return [];
  const index = await referenceIndex();
  const normalized = normalizeReference(query);
  const key = JSON.stringify([query.trim(), version, options.kind, options.family]);
  let ranked = index.queries.get(key);
  if (!ranked) {
    const postings = await index.postings();
    const lists = terms.map((term) => postings[term] ?? []).sort((a, b) => a.length - b.length);
    const membership = lists.slice(1).map((list) => new Set(list));
    const candidates = (lists[0] ?? []).filter((position) => membership.every((list) => list.has(position)));
    const exactId = index.byId.get(query) ?? index.byId.get(index.bySymbol.get(query.replace(/^grammar:/, "")) ?? "");
    if (exactId) {
      const position = index.searchable.findIndex(({ reference }) => reference === exactId);
      if (!candidates.includes(position)) candidates.push(position);
    }
    ranked = candidates.filter((position) => {
      const r = index.searchable[position].reference;
      return versionMatches(r.version, version) && (!options.kind || r.kind === options.kind) && (!options.family || r.family === options.family || r.family?.startsWith(options.family + "/"));
    }).map((position) => {
      const entry = index.searchable[position];
      const { reference, titleText } = entry;
      const exact = reference === exactId;
      const { titleTerms, bodyText } = entry.ranking ??= {
        titleTerms: termsFor(titleText),
        bodyText: normalizeReference(reference.text)
      };
      const adjacentHits = terms.slice(1).filter((term, i) => bodyText.includes(terms[i] + " " + term)).length;
      const titleHits = terms.filter((term) => titleTerms.includes(term)).length;
      const score = (exact ? 1e4 : 0) + (titleText === normalized ? 2e3 : 0) + (titleText.includes(normalized) ? 400 : 0) + titleHits * 50 + (titleHits === terms.length ? 200 : 0) + (bodyText.includes(normalized) ? 40 : 0) + adjacentHits * 60 + (reference.text.includes('"' + query.trim() + '"') ? 80 : 0) + (reference.kind === "contract" ? 5 : 0) + 1 / (1 + reference.text.length / 1e3);
      return { position, score };
    }).sort((a, b) => b.score - a.score || a.position - b.position).map(({ position }) => position);
    if (index.queries.size >= 64) index.queries.delete(index.queries.keys().next().value);
    index.queries.set(key, ranked);
  }
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 3;
  return ranked.slice(offset, offset + limit).map((position) => {
    const { reference: r, title } = index.searchable[position];
    return {
      id: r.id,
      title,
      version: r.version,
      source: r.source,
      kind: r.kind ?? "guide",
      family: r.family ?? "workflow",
      ...snippet(r.text, query, terms),
      requires: r.requires ?? [],
      totalMatches: ranked.length,
      nextResultOffset: offset + limit < ranked.length ? offset + limit : null
    };
  });
}
async function referenceRead(id, offset, limit, project2) {
  if (id.startsWith("block:") || id.startsWith("blueprint:")) return catalogRead(id, offset, limit, project2);
  if (id.startsWith("component:")) return componentRead(id, offset, limit);
  if (id.startsWith("pattern:")) return patternRead(id, offset, limit);
  const index = await referenceIndex();
  const item = index.byId.get(id) ?? index.byId.get(index.bySymbol.get(id.replace(/^grammar:/, "")) ?? "");
  if (!item)
    throw new Fault("REFERENCE_NOT_FOUND", "No registered reference with this ID or grammar symbol.", 2);
  const content = item.text.slice(offset, offset + limit);
  const symbols = [...content.matchAll(/<([^>\n]+)>/g)].map((match) => index.bySymbol.get(match[1]));
  const related = [
    ...new Set(
      [...item.related ?? [], ...symbols].filter(
        (target) => Boolean(target) && target !== item.id
      )
    )
  ];
  return {
    id: item.id,
    title: item.title ?? item.id,
    version: item.version,
    source: item.source,
    content,
    offset,
    length: item.text.length,
    nextOffset: offset + limit < item.text.length ? offset + limit : null,
    requires: item.requires ?? [],
    related: related.slice(0, 16),
    relatedCount: related.length,
    relatedOmittedCount: Math.max(0, related.length - 16),
    classification: "vendor-reference-data"
  };
}
async function referenceSync(version, dryRun) {
  const entries = (await referenceIndex()).upstream.filter((r) => versionMatches(r.version, version));
  if (!entries.length)
    throw new Fault(
      "REFERENCE_VERSION_UNAVAILABLE",
      "Requested version is not in this reviewed release snapshot. Install a reviewed release containing it.",
      3
    );
  const destination = path3.join(managedHome(), "references", version + ".json");
  const before = await exists(destination) ? hash(canonical(await readJson(destination))) : null, after = hash(canonical(entries));
  if (!dryRun && before !== after) await writeJson(destination, entries);
  return {
    status: dryRun ? "planned" : before === after ? "unchanged" : "synced",
    version,
    before,
    after,
    count: entries.length
  };
}

// packages/core/src/sandbox.ts
async function sandboxAction(action) {
  const engines = await Promise.all(
    ["docker", "podman"].map(async (executable) => {
      try {
        const r = await runProcess({
          executable,
          args: ["info", "--format", "{{json .}}"],
          cwd: process.cwd(),
          timeoutMs: 1e4
        });
        return { engine: executable, available: r.code === 0 };
      } catch {
        return { engine: executable, available: false };
      }
    })
  );
  const state = {
    profile: "optional",
    platform: `${process.platform}/${process.arch}`,
    engines,
    supported: false,
    reason: "No provisioned Oracle DB Free + APEX 26.1 + ORDS artifact tuple has been verified on this host.",
    volumesRemoved: false
  };
  if (action === "status") return state;
  if (action === "down") return { ...state, status: "not-configured", changed: false };
  throw new Fault(
    "SANDBOX_PROFILE_UNVERIFIED",
    state.reason + " Remote APEX targets remain independent.",
    3,
    "blocked"
  );
}

// packages/core/src/service.ts
import { realpath as realpath2 } from "node:fs/promises";
async function dispatch(operation, input = {}, signal) {
  try {
    if (signal?.aborted)
      throw new Fault("CANCELLED", "Operation cancelled before execution.", 6, "cancelled");
    if (!(operation in schemas)) throw new Fault("INVALID_INPUT", `Unknown operation: ${operation}`, 2);
    const parsed = parse(
      schemas[operation],
      input
    );
    const text = (key) => parsed[key];
    const root = text("project") ?? process.cwd();
    const oracle = new OracleAdapter(), tests = new TestService(oracle), deployment = new DeploymentService(oracle, (ctx, env2) => tests.all(ctx, env2));
    let data;
    switch (operation) {
      case "panel.open": {
        const { openPanel } = await import("./chunk-WXP75UUP.mjs");
        data = await openPanel(await realpath2(root));
        break;
      }
      case "panel.status":
        data = await new PanelService(root).snapshot();
        break;
      case "panel.action":
        {
          const action = panelActionSchema.parse(parsed).action;
          if (action.kind === "connection" && action.password !== void 0)
            throw new Fault(
              "LOCAL_CREDENTIAL_ENTRY_REQUIRED",
              "Enter the ORDS password only in the local browser settings form, or supply a local password file to connection.add.",
              3,
              "blocked"
            );
          data = await new PanelService(root).act(action);
        }
        break;
      case "version":
        data = { version: VERSION, node: process.version };
        break;
      case "doctor":
        data = await doctor();
        break;
      case "sqlcl.status":
        data = await sqlclConfig();
        break;
      case "sqlcl.configure":
        data = await configureSqlcl(
          text("mode"),
          parsed.mcpRestrictLevel,
          parsed.databaseTransport
        );
        break;
      case "dependencies.install": {
        const { ToolchainService } = await import("./chunk-YQHHPRJH.mjs");
        data = await new ToolchainService().apply(parsed);
        break;
      }
      case "dependencies.uninstall": {
        const { uninstallTools } = await import("./chunk-33GE2NWZ.mjs");
        data = await uninstallTools(parsed);
        break;
      }
      case "setup":
      case "plugin.install":
      case "plugin.update": {
        const { setup: setup2 } = await import("./chunk-KQ5IDT7Z.mjs");
        data = await setup2(parsed);
        break;
      }
      case "plugin.validate": {
        const { validateNative } = await import("./chunk-KQ5IDT7Z.mjs");
        data = await validateNative(text("from"));
        break;
      }
      case "plugin.uninstall": {
        const { uninstallNative } = await import("./chunk-KQ5IDT7Z.mjs");
        data = await uninstallNative(text("home") ?? managedHome(), Boolean(parsed.keepRuntime));
        break;
      }
      case "project.init":
        data = await projectInit(
          text("directory"),
          text("template"),
          text("alias") ?? path4.basename(path4.resolve(text("directory"))).toLowerCase().replace(/[^a-z0-9-]/g, "-")
        );
        break;
      case "connection.add":
        data = await configureConnection(text("name"), {
          sqlclName: text("sqlclName"),
          ordsUrl: text("ordsUrl"),
          ordsUsername: text("ordsUsername"),
          passwordFile: text("passwordFile")
        });
        break;
      case "connection.remove":
        data = await editConnection(text("name"));
        break;
      case "connection.list":
        data = parsed.saved ? await oracle.savedConnections(signal) : await connections();
        break;
      case "connection.test":
        if (parsed.saved && (await oracle.settings()).databaseTransport === "ords")
          throw new Fault(
            "ORDS_SAVED_CONNECTION_UNSUPPORTED",
            "ORDS uses plugin connection references. Test the configured reference without --saved.",
            3,
            "blocked"
          );
        data = await oracle.identity(
          parsed.saved ? { kind: "sqlcl-store", name: text("name") } : await resolveConnection(text("name")),
          signal
        );
        if (parsed.saved) data = { name: text("name"), ...data };
        break;
      case "docs.search":
        data = await referenceSearch(text("query"), text("version"), schemas["docs.search"].parse(parsed));
        break;
      case "docs.read":
        data = await referenceRead(text("id"), Number(parsed.offset), Number(parsed.limit), text("project"));
        break;
      case "docs.sync":
        data = await referenceSync(text("version"), Boolean(parsed.dryRun));
        break;
      case "sandbox.up":
      case "sandbox.status":
      case "sandbox.down":
        data = await sandboxAction(operation.split(".")[1]);
        break;
      default: {
        const ctx = await loadProject(root);
        switch (operation) {
          case "compose.plan":
            data = await composePlan(ctx, schemas["compose.plan"].parse(parsed), oracle, signal);
            break;
          case "compose.materialize":
            data = await composeMaterialize(ctx, schemas["compose.materialize"].parse(parsed), signal);
            break;
          case "project.inspect":
            data = await projectInspect(ctx, parsed.detail);
            break;
          case "metadata.read": {
            const env2 = environment(ctx, text("env"));
            const { project: _p, env: _e, ...request } = parsed;
            data = await metadataRead(oracle, env2, await resolveConnection(env2.readConnectionRef), request);
            break;
          }
          case "apex.generate": {
            await requireTrust(ctx.root);
            const generated = await oracle.generate(
              text("name"),
              text("alias") ?? ctx.config.application.alias
            );
            data = {
              ...await installSources(generated.directory, ctx.root, text("output")),
              compiler: generated.compiler
            };
            break;
          }
          case "apex.sync":
            data = await deployment.sync(
              ctx,
              text("env"),
              parsed.action,
              signal
            );
            break;
          case "project.adopt":
          case "apex.export": {
            await requireTrust(ctx.root);
            const env2 = environment(ctx, text("env"));
            if (operation === "project.adopt" && env2.applicationId !== parsed.appId)
              throw new Fault(
                "APPLICATION_TARGET_MISMATCH",
                "Requested app ID differs from the environment mapping.",
                5
              );
            if (operation === "project.adopt" && parsed.workingCopy) {
              data = await deployment.sync(ctx, text("env"), "init", signal);
              break;
            }
            const connection = await resolveConnection(env2.readConnectionRef);
            await oracle.verifyTarget(env2, connection);
            const exported = await oracle.exportApplication(env2, connection);
            data = await installSources(
              exported.directory,
              ctx.root,
              operation === "project.adopt" ? ctx.config.application.sourceDir : text("output")
            );
            break;
          }
          case "apex.validate":
            await requireTrust(ctx.root);
            data = await oracle.validate(await contained(ctx.root, ctx.config.application.sourceDir), signal);
            break;
          case "apex.diff": {
            await requireTrust(ctx.root);
            const env2 = environment(ctx, text("env"));
            const store = new SyncStore(ctx, env2, text("env"));
            const state = parsed.comparison === "live" ? null : await store.read();
            let exported, provenance;
            if (state && state.status !== "invalidated" && parsed.comparison !== "live") {
              await store.validate(state);
              exported = checkpoint(state);
              provenance = state.lastSuccessfulImport ? "last-successful-import" : "initial-baseline";
            } else {
              const connection = await resolveConnection(env2.readConnectionRef);
              await oracle.verifyTarget(env2, connection);
              exported = await oracle.exportApplication(env2, connection);
              provenance = "live-export";
            }
            const local = (await projectInspect(ctx)).sources.apex;
            data = {
              scope: "full-application-import",
              completeness: "textual-file-hashes-only",
              provenance,
              changes: [.../* @__PURE__ */ new Set([...Object.keys(exported.files), ...Object.keys(local ?? {})])].filter((f) => exported.files[f] !== local?.[f]).map((file) => ({
                file,
                before: exported.files[file] ?? null,
                after: local?.[file] ?? null
              }))
            };
            break;
          }
          case "db.plan":
            data = await deployment.plan(ctx, text("env"));
            break;
          case "deploy.plan": {
            const plan = await deployment.plan(ctx, text("env"));
            await writeJson(await contained(ctx.root, text("out")), plan);
            data = plan;
            break;
          }
          case "deploy.apply":
            data = await deployment.apply(
              ctx,
              await readJson(await contained(ctx.root, text("plan"))),
              signal
            );
            break;
          case "deploy.status":
            data = await deployment.reconcile(ctx, text("run"));
            break;
          case "deploy.restore-plan": {
            const plan = await deployment.restorePlan(ctx, text("backup"));
            await writeJson(await contained(ctx.root, text("out")), plan);
            data = plan;
            break;
          }
          case "test.run": {
            const suite = text("suite");
            if (suite === "all") {
              if (!parsed.env) throw new Fault("ENVIRONMENT_REQUIRED", "test all requires --env.", 2);
              const result = await tests.all(ctx, text("env"), signal);
              data = result.data;
              if (!result.ok)
                return {
                  ...failure(operation, new Fault("QUALITY_GATE_FAILED", "Required suites did not pass.", 1)),
                  data
                };
            } else {
              const result = await tests.run(
                ctx,
                suite,
                text("env"),
                signal,
                Boolean(parsed.headed)
              );
              data = result;
              if (result.status !== "passed")
                return {
                  ...failure(
                    operation,
                    new Fault(
                      "TEST_" + result.status.toUpperCase(),
                      result.diagnostic ?? `Suite is ${result.status}.`,
                      result.status === "failed" ? 1 : 3,
                      result.status
                    )
                  ),
                  data
                };
            }
            break;
          }
          case "test.report":
            data = await readJson(await contained(ctx.root, ".apexrest/test-runs/" + text("run") + ".json"));
            break;
          case "test.auth":
            data = await tests.auth(ctx, text("env"));
            break;
          case "browser.open": {
            const { openVerificationBrowser } = await import("./chunk-ESDVN7DS.mjs");
            data = await openVerificationBrowser(
              ctx,
              text("env"),
              void 0,
              parsed.browserMode
            );
            break;
          }
          case "jobs.status":
            data = await new JobService(ctx).status(text("id"), Number(parsed.waitSeconds), signal);
            break;
          case "jobs.cancel":
            data = await new JobService(ctx).cancel(text("id"));
            break;
          case "artifacts.read":
            data = await new ArtifactService(ctx).read(
              text("id"),
              Number(parsed.offset),
              Number(parsed.limit)
            );
            break;
          default:
            throw new Fault("INVALID_INPUT", "Unknown operation.", 2);
        }
      }
    }
    return success(operation, data);
  } catch (error) {
    return failure(operation, error);
  }
}

export {
  schemas,
  toolCatalog,
  dispatch
};
