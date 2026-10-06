import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  ArtifactService,
  DeploymentService,
  OWNED_TEXT_LIMIT,
  SyncStore,
  TestService,
  blueprintSchema,
  browserPreferences,
  catalogRead,
  catalogSearch,
  checkpoint,
  deployPlanSchema,
  digest,
  documentText,
  freeze,
  journal,
  loadCatalog,
  materialize,
  planDigest,
  planLimits,
  planSchema,
  readDocument,
  readPlan,
  recoveryPlan,
  resolvePackages,
  safePath,
  semanticDigest,
  stagePlan,
  stateSchema,
  validate
} from "./chunk-6HMVZFAH.mjs";
import {
  VERSION
} from "./chunk-Z55FEV2C.mjs";
import {
  OracleAdapter,
  configureConnection,
  configureSqlcl,
  connections,
  databaseTransport,
  editConnection,
  environment,
  identifier,
  installSources,
  isProductionTarget,
  loadProject,
  managedHome,
  oracle_exports,
  ordsUrl,
  ordsUsername,
  parse,
  policy,
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
  sqlclRestriction,
  updatePolicy
} from "./chunk-K3F2WA3X.mjs";
import {
  external_exports
} from "./chunk-JYN3YHP3.mjs";
import {
  Fault,
  artifactPage,
  canonical,
  contained,
  exists,
  failure,
  hash,
  inventory,
  readJson,
  redact,
  sanitized,
  success,
  writeJson
} from "./chunk-WPS3CSQJ.mjs";

// packages/core/src/jobs.ts
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
var JOB_WAIT_MAX_SECONDS = 120;
var jobOperations = [
  "compose.plan",
  "compose.materialize",
  "apex.sync",
  "apex.generate",
  "apex.export",
  "apex.validate",
  "deploy.plan",
  "deploy.apply",
  "ship.apply",
  "test.run"
];
var JobService = class {
  constructor(ctx) {
    this.ctx = ctx;
  }
  ctx;
  async enqueue(operation, input) {
    await requireTrust(this.ctx.root);
    if (!jobOperations.includes(operation))
      throw new Fault("INVALID_JOB_OPERATION", "Operation cannot run as a background job.", 2);
    const id = randomUUID(), root = await contained(this.ctx.root, ".apexrest/jobs/" + id);
    await writeJson(path.join(root, "request.json"), {
      id,
      operation,
      input: { ...input, project: this.ctx.root }
    });
    await writeJson(path.join(root, "state.json"), {
      id,
      status: "queued",
      operation,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return id;
  }
  /**
   * Run a job inside this process: same request/state files and heartbeat as a
   * detached worker, so apexrest_job observes it identically, but the warm
   * SQLcl session pool and capability caches are reused. Use only for work
   * whose interruption leaves no database write unresolved.
   */
  async startInline(operation, input, execute) {
    const id = await this.enqueue(operation, input);
    const run = executeJob(this.ctx, id, execute).catch(async (error) => {
      await failQueuedJob(this.ctx.root, id, error).catch(() => void 0);
    });
    inlineJobs.set(id, run);
    void run.finally(() => inlineJobs.delete(id));
    return {
      jobId: id,
      status: "queued",
      runner: "in-process",
      nextAction: "Wait for this job with apexrest_job action:status and the same jobId; never rerun the operation to fetch results."
    };
  }
  async start(operation, input, runtime) {
    const id = await this.enqueue(operation, input);
    try {
      const worker = spawn(process.execPath, [runtime, "--job-worker", this.ctx.root, id], {
        cwd: this.ctx.root,
        env: process.env,
        detached: true,
        stdio: "ignore",
        windowsHide: true
      });
      await new Promise((resolve, reject) => {
        worker.once("spawn", resolve);
        worker.once("error", reject);
      });
      worker.unref();
    } catch (error) {
      await failQueuedJob(this.ctx.root, id, error).catch(() => void 0);
      throw error;
    }
    return {
      jobId: id,
      status: "queued",
      runner: "detached-worker",
      nextAction: "Wait for this job with apexrest_job action:status and the same jobId; never rerun the operation to fetch results. Cancellation does not imply database rollback."
    };
  }
  async status(id, waitSeconds = 0, signal) {
    parse(external_exports.uuid(), id);
    parse(external_exports.number().int().min(0).max(JOB_WAIT_MAX_SECONDS), waitSeconds);
    const root = await contained(this.ctx.root, ".apexrest/jobs/" + id);
    const deadline = Date.now() + waitSeconds * 1e3;
    for (; ; ) {
      const state = await readJson(path.join(root, "state.json"));
      if (!["queued", "running"].includes(state.status)) return state;
      if (Date.parse(state.updatedAt) + 6e4 < Date.now())
        return {
          ...state,
          status: "outcome_unknown",
          nextAction: "Worker heartbeat expired. Reconcile target before retrying."
        };
      const remaining = deadline - Date.now();
      if (remaining <= 0 || signal?.aborted) return state;
      await delay(Math.min(250, remaining), void 0, { signal }).catch((error) => {
        if (!signal?.aborted) throw error;
      });
    }
  }
  async cancel(id) {
    await requireTrust(this.ctx.root);
    parse(external_exports.uuid(), id);
    const state = await this.status(id);
    if (!["queued", "running"].includes(state.status)) return state;
    await writeJson(await contained(this.ctx.root, ".apexrest/jobs/" + id + "/cancel.json"), {
      requestedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { jobId: id, status: "cancellation_requested", rollbackConfirmed: false };
  }
};
var inlineJobs = /* @__PURE__ */ new Map();
async function settleInlineJobs() {
  await Promise.allSettled([...inlineJobs.values()]);
}
async function failQueuedJob(projectRoot, id, error) {
  parse(external_exports.uuid(), id);
  const file = await contained(projectRoot, ".apexrest/jobs/" + id + "/state.json");
  if (!await exists(file)) return false;
  const state = await readJson(file);
  if (state.status !== "queued") return false;
  const operation = typeof state.operation === "string" ? state.operation : "job";
  await writeJson(file, {
    id,
    operation,
    status: "failed",
    result: failure(operation, error),
    nextAction: "The worker did not start this operation. Resolve the diagnostic, then start a new job.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return true;
}
function jobOutcome(result) {
  const value = result;
  if (!value || typeof value !== "object" || value.ok !== false) return "completed";
  return typeof value.status === "string" && !["queued", "running", "completed", "succeeded"].includes(value.status) ? value.status : "failed";
}
async function executeJob(ctx, id, execute) {
  await requireTrust(ctx.root);
  parse(external_exports.uuid(), id);
  const root = await contained(ctx.root, ".apexrest/jobs/" + id);
  const request = await readJson(path.join(root, "request.json"));
  const controller = new AbortController();
  let done = false;
  let phase;
  const pulse = async () => {
    if (done) return;
    if (await exists(path.join(root, "cancel.json"))) controller.abort();
    if (!done)
      await writeJson(path.join(root, "state.json"), {
        id,
        operation: request.operation,
        status: "running",
        ...phase ? { phase } : {},
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
  };
  await pulse();
  let pending = Promise.resolve();
  const schedule = () => {
    pending = pending.then(pulse).catch(() => {
      controller.abort();
    });
  };
  const timer = setInterval(schedule, 2e3), timeout = setTimeout(() => controller.abort(), 9e5);
  const progress = (next) => {
    phase = next;
    schedule();
  };
  try {
    let result;
    try {
      result = await execute(request.operation, request.input, controller.signal, progress);
    } catch (error) {
      result = failure(request.operation, error);
    }
    done = true;
    clearInterval(timer);
    clearTimeout(timeout);
    await pending;
    await writeJson(path.join(root, "state.json"), {
      id,
      operation: request.operation,
      status: jobOutcome(result),
      ...phase ? { phase } : {},
      result,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } finally {
    done = true;
    clearInterval(timer);
    clearTimeout(timeout);
  }
}

// packages/core/src/composer/service.ts
import { readFile as readFile2 } from "node:fs/promises";

// packages/core/src/metadata.ts
var metadataOffset = external_exports.number().int().min(0).max(1e5);
var metadataLimit = external_exports.number().int().min(1).max(100);
var metadataRequest = external_exports.strictObject({
  kind: external_exports.enum([
    "objects",
    "columns",
    "constraints",
    "constraint-columns",
    "signatures",
    "applications",
    "pages"
  ]),
  schema: identifier,
  name: identifier.optional(),
  offset: metadataOffset.default(0),
  limit: metadataLimit.default(30)
});
var metadataRequests = external_exports.array(metadataRequest).min(1).max(8);
var metadataBatchRequest = external_exports.strictObject({ requests: metadataRequests });
var metadataInputSchema = external_exports.strictObject({
  kind: metadataRequest.shape.kind.optional(),
  schema: metadataRequest.shape.schema.optional(),
  name: metadataRequest.shape.name,
  offset: metadataOffset.optional(),
  limit: metadataLimit.optional(),
  requests: metadataRequests.optional()
});
var queries = {
  objects: "select object_name, object_type from all_objects where owner=:p_owner and object_type in ('TABLE','VIEW','PACKAGE') and (:p_name is null or object_name=:p_name) order by object_name, object_type",
  columns: "select table_name,column_name,data_type,data_length,char_length,char_used,data_precision,data_scale,nullable,column_id from all_tab_columns where owner=:p_owner and table_name=:p_name order by column_id",
  constraints: "select table_name,constraint_name,constraint_type,r_owner,r_constraint_name,status,validated from all_constraints where owner=:p_owner and table_name=:p_name order by constraint_name",
  "constraint-columns": "select c.table_name,c.constraint_name,c.constraint_type,c.status,c.validated,cc.column_name,cc.position,c.r_owner,c.r_constraint_name,rc.table_name referenced_table,rcc.column_name referenced_column from all_constraints c join all_cons_columns cc on cc.owner=c.owner and cc.constraint_name=c.constraint_name and cc.table_name=c.table_name left join all_constraints rc on rc.owner=c.r_owner and rc.constraint_name=c.r_constraint_name and rc.owner=:p_owner left join all_cons_columns rcc on rcc.owner=rc.owner and rcc.constraint_name=rc.constraint_name and rcc.position=cc.position where c.owner=:p_owner and c.table_name=:p_name order by c.constraint_name,cc.position",
  signatures: "select package_name,object_name,argument_name,position,sequence,data_level,in_out,data_type,type_owner,type_name,type_subname,defaulted,overload,subprogram_id from all_arguments where owner=:p_owner and package_name=:p_name order by object_name,overload,sequence",
  applications: "select application_id,application_name,alias from apex_applications where owner=:p_owner and application_id=:p_app_id order by application_id",
  pages: "select application_id,page_id,page_name,page_alias from apex_application_pages where application_id=:p_app_id and workspace=:p_workspace order by page_id"
};
async function metadataRead(adapter, env2, connection, value) {
  const input = parse(external_exports.union([metadataRequest, metadataBatchRequest]), value);
  const batch = "requests" in input;
  const requests = batch ? input.requests : [input];
  for (const r of requests) {
    if (r.schema !== env2.parsingSchema)
      throw new Fault("SCHEMA_DENIED", "Metadata is restricted to the configured parsing schema.", 4);
    if (["columns", "constraints", "constraint-columns", "signatures"].includes(r.kind) && !r.name)
      throw new Fault("OBJECT_REQUIRED", "Select a specific object first.", 2);
  }
  await adapter.verifyTarget(env2, connection);
  const query = (r) => ({
    sql: queries[r.kind] + " offset :p_offset rows fetch next :p_limit rows only",
    bindings: {
      p_owner: r.schema,
      p_name: r.name ?? "",
      p_app_id: env2.applicationId,
      p_workspace: env2.workspace,
      p_offset: r.offset,
      p_limit: r.limit
    }
  });
  const page2 = (r, rows2) => ({
    dataClassification: "untrusted_database_content",
    rows: rows2,
    offset: r.offset,
    nextOffset: rows2.length === r.limit ? r.offset + r.limit : null
  });
  if (!batch) {
    const q = query(input);
    return page2(input, await adapter.jsonQuery(q.sql, connection, q.bindings));
  }
  const rows = await adapter.jsonQueryBatch(requests.map(query), connection);
  const results = requests.map((r, index) => ({
    index,
    kind: r.kind,
    ...r.name ? { name: r.name } : {},
    ...page2(r, rows[index] ?? [])
  }));
  if (rows.length !== requests.length)
    throw new Fault("EMPTY_QUERY_RESULT", "SQLcl did not answer every metadata request.", 1);
  return { results, targetVerifiedOnce: true };
}

// packages/core/src/composer/planner.ts
import { readFile, readdir } from "node:fs/promises";

// packages/core/src/composer/reader.ts
function declarations(source2) {
  if (Buffer.byteLength(source2) > 8 * 1024 * 1024)
    throw new Fault("TRANSFORM_UNSUPPORTED", "Source exceeds the bounded reader limit.", 5);
  const lines = [...source2.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)].filter((m) => m[0].length);
  const stack = [], out = [];
  let fence = false;
  for (const line of lines) {
    const text = line[0].replace(/[\r\n]+$/, "");
    if (/^\s*```/.test(text)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const open = text.match(/^( *)([A-Za-z][\w]*)(?:\s+(.*?))?\s*\(\s*$/);
    if (open) stack.push({ kind: open[2], key: open[3] ?? "", start: line.index, depth: open[1].length });
    else if (/^ *\)\s*$/.test(text)) {
      const node2 = stack.pop();
      if (!node2 || node2.depth !== text.indexOf(")"))
        throw new Fault("TRANSFORM_UNSUPPORTED", "Unbalanced declaration boundary.", 5);
      const end = line.index + line[0].length;
      out.push({ ...node2, end, digest: hash(source2.slice(node2.start, end)) });
    }
  }
  if (fence || stack.length) throw new Fault("TRANSFORM_UNSUPPORTED", "Unclosed literal or declaration.", 5);
  return out.sort((a, b) => a.start - b.start);
}
function inventorySymbols(sources) {
  const pages = /* @__PURE__ */ new Set(), symbols = /* @__PURE__ */ new Set();
  for (const source2 of Object.values(sources))
    for (const node2 of declarations(source2)) {
      if (node2.kind === "page" && /^\d+$/.test(node2.key)) pages.add(Number(node2.key));
      if (node2.key) symbols.add(node2.key.toUpperCase());
    }
  return { pages, symbols };
}
function editSpans(source2, edits) {
  let result = source2, previous = source2.length + 1;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    if (edit.start < 0 || edit.end > previous || edit.start > edit.end || hash(source2.slice(edit.start, edit.end)) !== edit.expectedDigest)
      throw new Fault("TRANSFORM_CONFLICT", "Overlapping or stale structural edit.", 5);
    result = result.slice(0, edit.start) + edit.content + result.slice(edit.end);
    previous = edit.start;
  }
  return result;
}
function threeWay(base2, local, next) {
  if (local === base2) return next;
  if (next === base2 || local === next) return local;
  const variants = [base2, local, next], roots = variants.map(declarations);
  const rootDepth = roots[0]?.[0]?.depth;
  if (rootDepth !== void 0 && roots.every((nodes) => nodes[0]?.depth === rootDepth)) {
    const children = roots.map((nodes) => nodes.filter((node2) => node2.depth === rootDepth + 4));
    const maps = children.map(
      (nodes, i) => new Map(
        nodes.map((node2) => [
          node2.kind + ":" + node2.key,
          { node: node2, content: variants[i].slice(node2.start, node2.end) }
        ])
      )
    );
    if (maps.some((map, i) => map.size !== children[i].length))
      throw new Fault("COMPOSITION_CONFLICT", "Repeated sibling anchors are unsupported.", 5);
    const scaffold = (value, nodes) => editSpans(
      value,
      nodes.map((node2) => ({ ...node2, expectedDigest: node2.digest, content: "" }))
    );
    const wrappers = variants.map((v, i) => scaffold(v, children[i]));
    const wrapper = mergeLines(wrappers[0], wrappers[1], wrappers[2]);
    const edits = [];
    const additions = [];
    for (const key of /* @__PURE__ */ new Set([...maps[1].keys(), ...maps[2].keys()])) {
      const b = maps[0].get(key), l = maps[1].get(key), n = maps[2].get(key);
      let content;
      if (!b) {
        if (l && n && l.content !== n.content)
          throw new Fault("COMPOSITION_CONFLICT", "New declaration collides with local source.", 5);
        content = l?.content ?? n?.content;
      } else if (!n) {
        if (l && l.content !== b.content)
          throw new Fault("COMPOSITION_CONFLICT", "Removing an edited declaration requires detach.", 5);
        content = "";
      } else if (!l) {
        if (n.content !== b.content)
          throw new Fault(
            "COMPOSITION_CONFLICT",
            "A locally removed declaration changed in the generator.",
            5
          );
      } else content = threeWay(b.content, l.content, n.content);
      if (l && content !== void 0 && content !== l.content)
        edits.push({ ...l.node, expectedDigest: l.node.digest, content });
      else if (!l && !b && content) additions.push(content);
    }
    const translate = (offset) => {
      let skipped = 0;
      for (const child of children[1]) {
        if (child.start - skipped > offset) break;
        skipped += child.end - child.start;
      }
      return offset + skipped;
    };
    let cursor = 0;
    const originalLines = wrappers[1].split("\n"), mergedLines = wrapper.split("\n");
    originalLines.forEach((line, i) => {
      if (line !== mergedLines[i]) {
        const start = translate(cursor), end = start + line.length;
        edits.push({ start, end, expectedDigest: hash(local.slice(start, end)), content: mergedLines[i] });
      }
      cursor += line.length + 1;
    });
    if (additions.length) {
      const root = roots[1][0], close = local.lastIndexOf(")", root.end - 1), start = local.lastIndexOf("\n", close) + 1;
      edits.push({ start, end: start, expectedDigest: hash(""), content: additions.join("") });
    }
    return editSpans(local, edits);
  }
  return mergeLines(base2, local, next);
}
function mergeLines(base2, local, next) {
  if (local === base2) return next;
  if (next === base2 || local === next) return local;
  const literals = [base2, local, next].map(
    (source2) => [...source2.matchAll(/```[^\r\n]*[\r\n]+[\s\S]*?^[ \t]*```/gm)].map((match2) => match2[0])
  );
  if (literals[0].length !== literals[1].length || literals[0].length !== literals[2].length || literals[0].some(
    (value, i) => value !== literals[1][i] && value !== literals[2][i] && literals[1][i] !== literals[2][i]
  ))
    throw new Fault(
      "COMPOSITION_CONFLICT",
      "Concurrent changes to an opaque code literal require explicit review.",
      5
    );
  const b = base2.split("\n"), l = local.split("\n"), n = next.split("\n");
  if (b.length !== l.length || b.length !== n.length)
    throw new Fault(
      "COMPOSITION_CONFLICT",
      "Structural changes require explicit adoption or conflict resolution.",
      5
    );
  return b.map((line, i) => {
    if (l[i] === line) return n[i];
    if (n[i] === line || l[i] === n[i]) return l[i];
    throw new Fault("COMPOSITION_CONFLICT", `Both local and generated source changed line ${i + 1}.`, 5);
  }).join("\n");
}

// packages/core/src/composer/binding.ts
function keyFields(entity) {
  return entity.read.key.map((key) => {
    const entries = Object.entries(entity.read.fields).filter(
      ([name, field]) => name === key || field.column === key
    );
    if (entries.length > 1)
      throw new Fault("KEY_MAPPING_AMBIGUOUS", "A key part must identify exactly one projected field.", 5);
    const entry2 = entries[0];
    if (!entry2) throw new Fault("KEY_MAPPING_MISSING", "Every key part must map to a projected field.", 5);
    return entry2[0];
  });
}
var unsafeSql = () => new Fault("CONTRACT_SQL_UNSAFE", "Row predicates accept reviewed expressions only.", 5);
var untrustedContext = () => new Fault("AUTH_CONTEXT_UNTRUSTED", "Row access may only use server-owned APEX session bindings.", 5);
var serverBinds = /* @__PURE__ */ new Set(["APP_USER", "APP_ID", "APP_SESSION"]);
var safeFunctions = /* @__PURE__ */ new Set([
  "UPPER",
  "LOWER",
  "TRIM",
  "TRUNC",
  "NVL",
  "COALESCE",
  "LENGTH",
  "SUBSTR",
  "INSTR",
  "TO_CHAR",
  "TO_NUMBER",
  "TO_DATE",
  "APEX_AUTHORIZATION.IS_AUTHORIZED"
]);
var groupingWords = /* @__PURE__ */ new Set(["AND", "OR", "NOT", "IN"]);
var deniedWords = /^(?:SELECT|WITH|COMMIT|ROLLBACK|SAVEPOINT|GRANT|REVOKE|INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXECUTE|IMMEDIATE|HOST|CONNECT|BEGIN|DECLARE|CALL|LOCK)$/;
var deniedOwners = /^(?:DBMS_|UTL_|WWV_|OWA_|APEX_(?!AUTHORIZATION$)|(?:OWA|HTP|HTF|SYS)$)/;
var tokens = {
  space: /[ \t]+/y,
  string: /'(?:[^']|'')*'/y,
  number: /\d+(?:\.\d+)?/y,
  bind: /:([A-Za-z][A-Za-z0-9_]*)/y,
  name: /[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*){0,2}/y,
  operator: /<>|!=|\^=|<=|>=|=|<|>|\(|\)|,|\+|-|\*|\//y
};
function match(pattern, value, at) {
  pattern.lastIndex = at;
  return pattern.exec(value);
}
function expression(value) {
  if (!value.trim() || value.length > 4e3) throw unsafeSql();
  if (/:\s*"/.test(value)) throw untrustedContext();
  if (/[\x00-\x08\x0a-\x1f\x7f;`&#$"@{}\[\]|]|--|\/\*|\*\//.test(value)) throw unsafeSql();
  let at = 0, depth = 0;
  while (at < value.length) {
    let found;
    if (found = match(tokens.space, value, at)) at += found[0].length;
    else if (found = match(tokens.string, value, at)) at += found[0].length;
    else if (found = match(tokens.bind, value, at)) {
      if (!serverBinds.has(found[1].toUpperCase())) throw untrustedContext();
      at += found[0].length;
    } else if (found = match(tokens.name, value, at)) {
      const name = found[0].toUpperCase(), parts = name.split(".");
      at += found[0].length;
      if (parts.some((part) => deniedWords.test(part)) || deniedOwners.test(parts[0])) {
        if (!safeFunctions.has(name)) throw unsafeSql();
      }
      if (value[at] === "'") throw unsafeSql();
      const next = value.slice(at).match(/^[ \t]*(.)/)?.[1];
      if (next === "(" && !safeFunctions.has(name) && !groupingWords.has(name)) throw unsafeSql();
      if (next !== "(" && safeFunctions.has(name) && name.includes(".")) throw unsafeSql();
    } else if (found = match(tokens.number, value, at)) at += found[0].length;
    else if (found = match(tokens.operator, value, at)) {
      if (found[0] === "(") depth++;
      if (found[0] === ")" && --depth < 0) throw unsafeSql();
      at += found[0].length;
    } else if (value[at] === ":") throw untrustedContext();
    else throw unsafeSql();
  }
  if (depth !== 0) throw unsafeSql();
  return value;
}
function oracleName(value) {
  const text = String(value ?? "");
  return /^".*"$/.test(text) ? text.slice(1, -1) : text.toUpperCase();
}
var sameName = (a, b) => oracleName(a) === oracleName(b);
function oracleType(value) {
  return String(value ?? "").toUpperCase().replace(/\(\s*\d+(?:\s*,\s*\d+)?\s*\)/g, "").replace(/\s+/g, " ").trim();
}
var entry = (record, name) => Object.entries(record).find(([key]) => sameName(key, name))?.[1];
function bind(blueprint, instance, metadata) {
  const ref = instance.bindings.records;
  if (!ref.startsWith("entity:"))
    throw new Fault("BINDING_MISSING", "Expected an explicit entity binding.", 5);
  const entity = blueprint.entities[ref.slice(7)];
  if (!entity) throw new Fault("BINDING_MISSING", "Entity binding is absent.", 5);
  if (!Object.keys(entity.read.fields).length || Object.keys(entity.read.fields).length > 32)
    throw new Fault("CONTRACT_FIELD_LIMIT", "Entities support 1\u201332 scalar fields.", 5);
  const fieldNames = Object.keys(entity.read.fields);
  if (fieldNames.some((field) => !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(field)) || new Set(fieldNames.map((field) => field.toUpperCase())).size !== fieldNames.length)
    throw new Fault(
      "FIELD_SYMBOL_COLLISION",
      "Field names must form unique case-insensitive APEX item suffixes.",
      5
    );
  const keys = keyFields(entity), auth = blueprint.contracts[entity.authorization.readContract];
  if (new Set(keys).size !== keys.length)
    throw new Fault("KEY_MAPPING_DUPLICATE", "Each ordered key part must occur once.", 5);
  if (!auth || auth.kind !== "authorization" || !auth.rowPredicate)
    throw new Fault("AUTH_CONTRACT_MISSING", "A reviewed server row-read contract is required.", 5);
  const predicate = expression(auth.rowPredicate);
  if (entity.read.kind === "oracle-view") {
    const key = blueprint.contracts[entity.read.keyContract ?? ""];
    if (!key || key.kind !== "key" || JSON.stringify(key.fields) !== JSON.stringify(keys))
      throw new Fault("KEY_CONTRACT_MISSING", "Views require an explicit ordered key contract.", 5);
  }
  if (new Set(Object.values(entity.read.fields).map((f) => f.column.toUpperCase())).size !== Object.keys(entity.read.fields).length)
    throw new Fault("COLUMN_COLLISION", "Projected field mappings must be unique.", 5);
  for (const name of [
    ...instance.parameters.editableFields,
    instance.parameters.groupField,
    instance.parameters.filterField,
    instance.parameters.detailField,
    instance.parameters.timeField,
    instance.parameters.parentField
  ].filter(Boolean))
    if (!entity.read.fields[name])
      throw new Fault("FIELD_MAPPING_MISSING", "A selected field is not in the entity contract.", 5);
  const writable = instance.parameters.createEnabled || instance.parameters.editEnabled;
  let command;
  let writeExpression;
  if (writable) {
    if (keys.length !== 1)
      throw new Fault("COMPOSITE_WRITE_UNSUPPORTED", "Write CRUD requires one scalar key.", 5);
    const version = entity.capabilities.optimisticLock?.field;
    if (!version || entity.read.fields[version]?.type !== "integer" || !entity.read.fields[version] || entity.read.fields[version].nullable || entity.read.fields[keys[0]].nullable)
      throw new Fault("OPTIMISTIC_LOCK_MISSING", "Persisted key/version fields must be non-null.", 5);
    if (instance.parameters.editableFields.some((field) => keys.includes(field) || field === version))
      throw new Fault("MASS_ASSIGNMENT_DENIED", "Key and row version are server managed.", 5);
    if (!["string", "integer", "decimal"].includes(entity.read.fields[keys[0]].type) || instance.parameters.editableFields.some((f) => entity.read.fields[f].type === "boolean"))
      throw new Fault(
        "WRITE_TYPE_UNSUPPORTED",
        "This write adapter supports text/numeric keys and scalar text/number/date/timestamp fields.",
        5
      );
    const ref2 = instance.bindings.saveRecord;
    command = ref2?.startsWith("command:") ? blueprint.commands[ref2.slice(8)] : void 0;
    if (!command)
      throw new Fault("COMMAND_BINDING_MISSING", "Write mode requires an explicit API command.", 5);
    const signature = blueprint.contracts[command.signatureRef], writeAuth = blueprint.contracts[command.authorizationContract], errors = blueprint.contracts[command.errorContract];
    if (!signature || signature.kind !== "command" || signature.transaction !== "caller-owned" || !signature.parameters || !writeAuth || writeAuth.kind !== "authorization" || !errors || errors.kind !== "errors" || command.authorizationContract !== entity.authorization.writeContract)
      throw new Fault(
        "COMMAND_CONTRACT_MISSING",
        "Write mode requires exact reviewed signature, authorization and error contracts.",
        5
      );
    if (!writeAuth.expression)
      throw new Fault(
        "AUTH_CONTRACT_MISSING",
        "Write authorization requires a reviewed server expression.",
        5
      );
    writeExpression = expression(writeAuth.expression);
    if (command.outputs.recordKey.from === command.outputs.recordVersion.from)
      throw new Fault(
        "COMMAND_ARGUMENT_MISMATCH",
        "Record key and version require distinct API output arguments.",
        5
      );
    const supplied = /* @__PURE__ */ new Set([
      ...Object.keys(command.inputs),
      ...Object.values(command.outputs).map((o) => o.from)
    ]);
    if (Object.keys(signature.parameters).some((p) => !supplied.has(p)) || [...supplied].some((p) => !signature.parameters[p]))
      throw new Fault("COMMAND_ARGUMENT_MISMATCH", "Every exact signature argument must be mapped.", 5);
    const types = (field) => {
      const type = entity.read.fields[field]?.type;
      return type === "integer" || type === "decimal" ? ["NUMBER", "PLS_INTEGER", "BINARY_INTEGER"] : type === "date" ? ["DATE"] : type === "timestamp" ? ["TIMESTAMP"] : ["VARCHAR2", "CHAR", "NVARCHAR2", "NCHAR"];
    };
    for (const [argument, mapping] of Object.entries(command.inputs)) {
      const field = mapping.from.replace(/^record\./, "");
      if (mapping.mode === "in-out" && field !== keys[0])
        throw new Fault(
          "COMMAND_ARGUMENT_MISMATCH",
          "Only the record key supports IN OUT in this adapter.",
          5
        );
      if (!types(field).includes(signature.parameters[argument]?.type ?? ""))
        throw new Fault(
          "COMMAND_ARGUMENT_MISMATCH",
          "API argument scalar datatype differs from the field contract.",
          5
        );
      if (!mapping.from.startsWith("record.") || !entity.read.fields[field] || signature.parameters[argument]?.mode !== mapping.mode)
        throw new Fault(
          "COMMAND_ARGUMENT_MISMATCH",
          "API argument mode or field mapping does not match its contract.",
          5
        );
      if (!keys.includes(field) && field !== version && !instance.parameters.editableFields.includes(field))
        throw new Fault(
          "COMMAND_INPUT_UNAVAILABLE",
          "API inputs must map to an editable field or the managed record key/version.",
          5
        );
    }
    if (!types(keys[0]).includes(signature.parameters[command.outputs.recordKey.from]?.type ?? "") || !types(version).includes(signature.parameters[command.outputs.recordVersion.from]?.type ?? ""))
      throw new Fault("COMMAND_ARGUMENT_MISMATCH", "Key/version output datatypes differ from the entity.", 5);
    if (!Object.values(command.inputs).some((m) => m.from === "record." + version && m.mode === "in"))
      throw new Fault("OPTIMISTIC_LOCK_MISSING", "Expected version must be passed explicitly to the API.", 5);
    for (const output of Object.values(command.outputs))
      if (!["out", "in-out"].includes(signature.parameters[output.from]?.mode ?? ""))
        throw new Fault("COMMAND_ARGUMENT_MISMATCH", "API key/version outputs must be OUT or IN OUT.", 5);
    if (metadata) {
      const rows = entry(metadata.signatures, command.package)?.filter(
        (row) => sameName(row.OBJECT_NAME, command.procedure)
      ) ?? [];
      const overloads = new Set(rows.map((row) => String(row.OVERLOAD ?? row.SUBPROGRAM_ID ?? "")));
      if (overloads.size !== 1 && !signature.overload)
        throw new Fault("COMMAND_OVERLOAD_AMBIGUOUS", "An exact reviewed API overload is required.", 5);
      const selected = rows.filter(
        (row) => !signature.overload || String(row.OVERLOAD ?? "") === signature.overload
      );
      if (new Set(selected.map((row) => String(row.SUBPROGRAM_ID))).size !== 1 || selected.length !== Object.keys(signature.parameters).length || selected.some((row) => Number(row.DATA_LEVEL ?? 0) !== 0 || Number(row.POSITION) === 0))
        throw new Fault(
          "COMMAND_ARGUMENT_MISMATCH",
          "The complete live scalar procedure signature must match the reviewed contract.",
          5
        );
      for (const [argument, spec] of Object.entries(signature.parameters)) {
        const row = selected.find(
          (r) => sameName(r.ARGUMENT_NAME, argument) && (!signature.overload || String(r.OVERLOAD ?? "") === signature.overload)
        );
        if (!row || String(row.IN_OUT).toLowerCase().replace(/\s*\/\s*|\s+/g, "-") !== spec.mode || oracleType(row.DATA_TYPE) !== spec.type || row.DEFAULTED === "Y" !== spec.defaulted)
          throw new Fault(
            "COMMAND_ARGUMENT_MISMATCH",
            "Live API signature differs from its reviewed contract.",
            5
          );
      }
    }
  }
  if (metadata) {
    const object = entry(metadata.objects, entity.read.object);
    if (!object) throw new Fault("OBJECT_BINDING_MISSING", "The selected Oracle object was not verified.", 5);
    for (const field of Object.values(entity.read.fields)) {
      const column = object.columns.find((row) => sameName(row.COLUMN_NAME, field.column));
      if (!column || column.NULLABLE === "Y" && !field.nullable)
        throw new Fault("COLUMN_CONTRACT_MISMATCH", "Live field nullability or column mapping differs.", 5);
      const expected = ["integer", "decimal"].includes(field.type) ? ["NUMBER", "FLOAT"] : field.type === "date" ? ["DATE"] : field.type === "timestamp" ? ["TIMESTAMP", "TIMESTAMP WITH TIME ZONE", "TIMESTAMP WITH LOCAL TIME ZONE"] : ["VARCHAR2", "CHAR", "NVARCHAR2", "NCHAR"];
      if (!expected.includes(oracleType(column.DATA_TYPE)))
        throw new Fault("COLUMN_TYPE_UNSUPPORTED", "Live datatype needs an explicit supported adapter.", 5);
      if (field.maxLength && Number(column.CHAR_LENGTH ?? column.DATA_LENGTH) > field.maxLength)
        throw new Fault("COLUMN_CONTRACT_MISMATCH", "Producer length exceeds consumer capacity.", 5);
      if (field.precision !== void 0 && (column.DATA_PRECISION == null || Number(column.DATA_PRECISION) > field.precision) || field.scale !== void 0 && Number(column.DATA_SCALE) !== field.scale)
        throw new Fault(
          "COLUMN_CONTRACT_MISMATCH",
          "Live numeric precision or scale differs from the field contract.",
          5
        );
    }
    if (entity.read.kind === "oracle-table") {
      const primary = object.constraints.find(
        (row) => row.CONSTRAINT_TYPE === "P" && row.STATUS === "ENABLED" && row.VALIDATED === "VALIDATED"
      );
      const columns = object.constraintColumns.filter((row) => row.CONSTRAINT_NAME === primary?.CONSTRAINT_NAME).sort((a, b) => Number(a.POSITION) - Number(b.POSITION)).map((row) => oracleName(row.COLUMN_NAME));
      if (!primary || JSON.stringify(columns) !== JSON.stringify(keys.map((k) => oracleName(entity.read.fields[k].column))))
        throw new Fault(
          "PRIMARY_KEY_MISMATCH",
          "Live enabled/validated primary key differs from the contract.",
          5
        );
    }
  }
  return { entity, keys, predicate, command, writable, entityRef: ref, writeExpression };
}

// packages/core/src/composer/emitter.ts
var indent = (value, depth = 4) => value.split("\n").map((line) => line ? " ".repeat(depth) + line : "").join("\n");
var group = (key, value) => `${key} {
${indent(value)}
}`;
var node = (kind, key, value) => `${kind} ${key} (
${indent(value)}
)
`;
var scalar = (value) => {
  if (/[\r\n\x00-\x1f\x7f{}()`]/.test(value))
    throw new Fault("PARAMETER_UNSUPPORTED", "Labels must be single-line literal values.", 2);
  if (/[<>]|&[A-Za-z0-9_$#]+\.|#[A-Za-z0-9_$]+#|^\s*@/.test(value))
    throw new Fault(
      "LABEL_UNSAFE",
      "Titles and labels cannot contain HTML, &ITEM. or #NAME# substitutions, or a leading @ reference.",
      2
    );
  return value;
};
var sqlLiteral = (value) => {
  if (/[\x00-\x1f\x7f`]/.test(value))
    throw new Fault("LITERAL_UNSAFE", "Literal values must be single-line text without backticks.", 2);
  return "'" + value.replaceAll("'", "''") + "'";
};
var code = (language, source2) => `
    \`\`\`${language}
${indent(source2, 4)}
    \`\`\``;
var layout = (sequence, slot = "body") => group("layout", `sequence: ${sequence}
slot: ${slot}`);
var appearance = (template) => group("appearance", `template: @/${template}
templateOptions: #DEFAULT#`);
var page = (allocation, title, body, dialog = false) => node(
  "page",
  String(dialog ? allocation.dialog : allocation.page),
  [
    `name: ${scalar(title)}`,
    `alias: ${allocation.prefix.toUpperCase()}${dialog ? "_EDIT" : ""}`,
    `title: ${scalar(title)}`,
    group(
      "appearance",
      dialog ? "pageMode: modalDialog\ndialogTemplate: @/modal-dialog\ntemplateOptions: #DEFAULT#" : "pageTemplate: @/standard\ntemplateOptions: #DEFAULT#"
    ),
    group("security", "pageAccessProtection: argumentsMustHaveChecksum"),
    body
  ].join("\n")
);
var source = (sql, submit) => group(
  "source",
  `location: localDatabase
type: sqlQuery
${submit ? `pageItemsToSubmit: ${submit}
` : ""}sqlQuery:${code("sql", sql)}`
);
var button = (key, label, region, behavior) => node(
  "button",
  key,
  [
    `buttonName: ${key.replaceAll("-", "_").toUpperCase()}`,
    `label: ${scalar(label)}`,
    group("layout", `sequence: 10
region: @${region}
slot: NEXT`),
    group("appearance", "buttonTemplate: @/text\ntemplateOptions: #DEFAULT#"),
    group("behavior", behavior)
  ].join("\n")
);
function dynamic(key, event, selection, actions) {
  return node(
    "dynamicAction",
    key,
    `name: ${key}
${group("execution", "sequence: 10")}
${group("when", `event: ${event}
${selection}`)}
${actions}`
  );
}
function refresh(key, region, sequence) {
  return node(
    "action",
    key,
    `action: refresh
${group("affectedElements", `selectionType: region
region: @${region}`)}
${group("execution", `sequence: ${sequence}
fireOnInit: false`)}`
  );
}
function jsAction(key, javascript) {
  return node(
    "action",
    key,
    `action: executeJsCode
${group("settings", `jsCode:${code("javascript", javascript)}`)}
${group("execution", "sequence: 10\nfireOnInit: false")}`
  );
}
function process2(key, point, sql) {
  return node(
    "process",
    key,
    `name: ${key}
type: executeCode
${group("source", `plsqlCode:${code("plsql", sql)}`)}
${group("execution", `sequence: 10
point: ${point}`)}`
  );
}
function item(name, field, sequence, hidden, required) {
  return node(
    "pageItem",
    name,
    [
      `type: ${hidden ? "hidden" : "textField"}`,
      hidden ? "" : group("label", `label: ${scalar(field)}
alignment: left`),
      group("layout", `sequence: ${sequence}
region: @form
slot: regionBody`),
      hidden ? group("security", "sessionStateProtection: checksumRequiredSessionLevel") : group("appearance", "template: @/optional-floating\ntemplateOptions: #DEFAULT#\nwidth: 32"),
      hidden ? "" : group("validation", `valueRequired: ${required}`)
    ].filter(Boolean).join("\n")
  );
}
function summaryRegion(blueprint, instance, allocation) {
  const { entity, predicate } = bind(blueprint, instance), field = entity.read.fields[instance.parameters.groupField ?? ""];
  if (!field) throw new Fault("GROUP_FIELD_REQUIRED", "Summary blocks require a mapped grouping field.", 5);
  return node(
    "region",
    allocation.prefix + "-summary",
    [
      `name: ${scalar(instance.parameters.title)}`,
      "type: cards",
      source(
        `select ${field.column} ID, ${field.column} TITLE, to_char(count(*)) STATUS from ${entity.read.object} where (${predicate}) group by ${field.column}`
      ),
      layout(30),
      appearance("cards-container"),
      group("advanced", `htmlDomId: ${allocation.prefix}_summary`),
      group("card", "primaryKeyColumn1: ID"),
      group("title", "column: TITLE"),
      group("body", "column: STATUS")
    ].join("\n")
  );
}
function render(blueprint, id, instance, block, allocation, summaries = []) {
  const binding = bind(blueprint, instance), { entity, keys, predicate, command, writable } = binding;
  const fields = Object.entries(entity.read.fields).sort(([a], [b]) => a < b ? -1 : 1);
  const file = (number) => `pages/p${String(number).padStart(5, "0")}-${allocation.prefix}${number === allocation.dialog ? "_edit" : ""}.apx`;
  if (block.renderer === "status-summary")
    return {
      [file(allocation.page)]: page(
        allocation,
        instance.parameters.title,
        summaryRegion(blueprint, instance, allocation)
      )
    };
  if (block.renderer === "read-only-detail") {
    if (keys.length !== 1)
      throw new Fault(
        "COMPOSITE_DETAIL_UNSUPPORTED",
        "This detail adapter requires one scalar route key.",
        5
      );
    const keyItem = `P${allocation.page}_${keys[0].toUpperCase()}`;
    let body2 = node(
      "region",
      "form",
      `name: ${scalar(instance.parameters.title)}
type: staticContent
${layout(10)}
${appearance("standard")}`
    );
    body2 += item(keyItem, keys[0], 0, true, false);
    for (const [field] of fields.filter(([f]) => !keys.includes(f)))
      body2 += node(
        "pageItem",
        `P${allocation.page}_${field.toUpperCase()}`,
        `type: displayOnly
${group("label", `label: ${field}`)}
${group("layout", `sequence: ${(fields.findIndex(([f]) => f === field) + 1) * 10}
region: @form
slot: regionBody`)}
${appearance("optional")}`
      );
    body2 += process2(
      allocation.prefix + "-detail",
      "beforeHeader",
      `begin
 if :${keyItem} is not null then
 select ${fields.map(([, f]) => f.column).join(", ")} into ${fields.map(([f]) => ":P" + allocation.page + "_" + f.toUpperCase()).join(", ")} from ${entity.read.object} where (${predicate}) and ${entity.read.fields[keys[0]].column}=:${keyItem};
 end if;
end;`
    );
    return { [file(allocation.page)]: page(allocation, instance.parameters.title, body2) };
  }
  if (block.renderer === "history-timeline") {
    const time = entity.read.fields[instance.parameters.timeField ?? ""], title = entity.read.fields[instance.parameters.detailField ?? ""], status = entity.read.fields[instance.parameters.groupField ?? ""];
    if (!time || !["date", "timestamp"].includes(time.type) || !title || !status)
      throw new Fault(
        "TIMELINE_BINDING_REQUIRED",
        "Timeline needs a temporal field, title and status mappings.",
        5
      );
    const sql = `select 'EV' USER_AVATAR, apex_escape.html(${title.column}) USER_NAME, ${time.column} EVENT_DATE, apex_escape.html(${title.column}) EVENT_TITLE, apex_escape.html(${status.column}) EVENT_DESC, 'fa-history' EVENT_ICON, apex_escape.html(${status.column}) EVENT_STATUS, cast(null as varchar2(100)) EVENT_LINK, 'History' EVENT_TYPE from ${entity.read.object} where (${predicate}) order by ${time.column}, ${keys.map((k) => entity.read.fields[k].column).join(", ")}`;
    const names = [
      "USER_AVATAR",
      "USER_NAME",
      "EVENT_DATE",
      "EVENT_TITLE",
      "EVENT_DESC",
      "EVENT_ICON",
      "EVENT_STATUS",
      "EVENT_LINK",
      "EVENT_TYPE"
    ];
    const cols = names.map(
      (name, i) => node(
        "column",
        name,
        `reportColumnQueryId: ${i + 1}
derivedColumn: N
${group("heading", `heading: ${name}`)}
${group("layout", `sequence: ${(i + 1) * 10}`)}`
      )
    ).join("");
    const timeline = node(
      "region",
      allocation.prefix + "-history",
      `name: ${scalar(instance.parameters.title)}
type: classicReport
${source(sql)}
${layout(10)}
${appearance("standard")}
${group("componentAppearance", "template: @/timeline\ntemplateOptions: #DEFAULT#")}
${cols}`
    );
    return { [file(allocation.page)]: page(allocation, instance.parameters.title, timeline) };
  }
  if (block.renderer === "master-detail") {
    if (keys.length !== 1 || !instance.parameters.parentField)
      throw new Fault(
        "MASTER_DETAIL_BINDING_REQUIRED",
        "A self-referencing parent field and scalar key are required.",
        5
      );
    const key = entity.read.fields[keys[0]], parent = entity.read.fields[instance.parameters.parentField];
    if (parent.type !== key.type)
      throw new Fault("MASTER_DETAIL_KEY_MISMATCH", "Parent and key types differ.", 5);
    const selected = `P${allocation.page}_PARENT`, master = allocation.prefix + "-master", detail = allocation.prefix + "-detail";
    const cols = () => fields.map(
      ([name, field], i) => node(
        "column",
        field.column,
        `type: plainText
${group("heading", `heading: ${name}`)}
${group("layout", `sequence: ${(i + 1) * 10}`)}
${group("source", `dataType: ${["integer", "decimal"].includes(field.type) ? "NUMBER" : ["date", "timestamp"].includes(field.type) ? "DATE" : "STRING"}`)}`
      )
    ).join("");
    const list = (region2, predicateSQL, sequence, link = false) => node(
      "region",
      region2,
      `name: ${link ? "Master records" : "Related records"}
type: interactiveReport
${source(`select ${fields.map(([, f]) => f.column).join(", ")} from ${entity.read.object} where (${predicate}) and ${predicateSQL}`)}
${layout(sequence)}
${appearance("interactive-report")}
${link ? group("link", `linkColumn: customTarget
target: {
    page: ${allocation.page}
    items: {
        ${selected}: #${key.column}#
    }
}
linkIcon: View`) : ""}
${cols()}`
    );
    const hidden = node(
      "pageItem",
      selected,
      `type: hidden
${group("layout", `sequence: 1
region: @${master}
slot: regionBody`)}
${group("security", "sessionStateProtection: checksumRequiredSessionLevel")}`
    );
    return {
      [file(allocation.page)]: page(
        allocation,
        instance.parameters.title,
        list(master, `${parent.column} is null`, 10, true) + hidden + list(detail, `${parent.column}=:${selected}`, 20)
      )
    };
  }
  const region = allocation.prefix + "-records", filterItem = `P${allocation.page}_FILTER`;
  const where = instance.parameters.filterField ? `(${predicate}) and (${entity.read.fields[instance.parameters.filterField].column} = :${filterItem} or :${filterItem} is null)` : `(${predicate})`;
  const columns = fields.map(
    ([name, field], i) => node(
      "column",
      field.column,
      `type: ${keys.includes(name) && writable ? "hidden" : "plainText"}
${group("heading", `heading: ${scalar(name)}`)}
${group("layout", `sequence: ${(i + 1) * 10}`)}
${group("source", `dataType: ${["integer", "decimal"].includes(field.type) ? "NUMBER" : ["date", "timestamp"].includes(field.type) ? "DATE" : "STRING"}`)}`
    )
  ).join("\n");
  const report = node(
    "region",
    region,
    [
      `name: ${scalar(instance.parameters.title)}`,
      "type: interactiveReport",
      source(
        `select ${fields.map(([, f]) => f.column).join(", ")} from ${entity.read.object} where ${where}`,
        instance.parameters.filterField ? filterItem : void 0
      ),
      layout(10),
      appearance("interactive-report"),
      group("advanced", `htmlDomId: ${allocation.prefix}_records`),
      writable && instance.parameters.editEnabled ? group(
        "link",
        `linkColumn: customTarget
target: {
    page: ${allocation.dialog}
    items: {
        P${allocation.dialog}_${keys[0].toUpperCase()}: #${entity.read.fields[keys[0]].column}#
    }
    clearCache: ${allocation.dialog}
}
linkIcon: <span class="fa fa-edit" aria-label="Edit"></span>`
      ) : "",
      columns
    ].filter(Boolean).join("\n")
  );
  let body = report;
  if (instance.parameters.filterField) {
    const filter = instance.parameters.filterField;
    body += node(
      "pageItem",
      filterItem,
      `type: textField
${group("label", `label: ${filter}`)}
${group("layout", `sequence: 5
region: @${region}
slot: regionBody`)}
${group("appearance", "template: @/optional-floating\ntemplateOptions: #DEFAULT#")}`
    );
    body += dynamic(
      allocation.prefix + "-filter",
      "change",
      `selectionType: items
items: ${filterItem}`,
      refresh("refresh", region, 10)
    );
  }
  if (writable && instance.parameters.createEnabled)
    body += button(
      allocation.prefix + "-create",
      "Create",
      region,
      `action: redirectThisApp
target: {
    page: ${allocation.dialog}
    clearCache: ${allocation.dialog}
}`
    );
  for (const summary of summaries) body += summaryRegion(blueprint, summary.instance, summary.allocation);
  if (writable) {
    const targets = [
      allocation.prefix + "_records",
      ...summaries.map((s) => s.allocation.prefix + "_summary")
    ];
    const refreshes = jsAction(
      "refresh-bound-regions",
      `var e=this.data; if(!e||e.originInstance!==${JSON.stringify(id)}||e.entityRef!==${JSON.stringify(binding.entityRef)}||!e.recordKey||!e.recordVersion||!e.correlationId||!['create','edit'].includes(e.operation)) return; var host=document.getElementById(${JSON.stringify(allocation.prefix + "_records")}); if(host.dataset.composerCorrelation===e.correlationId) return; host.dataset.composerCorrelation=e.correlationId; ${JSON.stringify(targets)}.forEach(function(id){var region=apex.region(id); if(region) region.refresh();});`
    );
    body += dynamic(
      allocation.prefix + "-saved",
      "apexafterclosedialog",
      `selectionType: region
region: @${region}`,
      refreshes
    );
  }
  const result = {
    [file(allocation.page)]: page(allocation, instance.parameters.title, body)
  };
  if (!writable || !command || !allocation.dialog) return result;
  const dialog = allocation.dialog, version = entity.capabilities.optimisticLock.field;
  const itemName = (field) => `P${dialog}_${field.toUpperCase()}`;
  const numberFormat = "99999999999999999999999999999999999999D99999999999999999999999999999999999999";
  const inputExpression = (field) => {
    const spec = entity.read.fields[field], value = ":" + itemName(field);
    return ["integer", "decimal"].includes(spec.type) ? `to_number(${value},'${numberFormat}','NLS_NUMERIC_CHARACTERS=''.,''')` : spec.type === "date" ? `to_date(${value},'FXYYYY-MM-DD')` : spec.type === "timestamp" ? `to_timestamp(${value},'FXYYYY-MM-DD"T"HH24:MI:SS.FF6')` : value;
  };
  const readExpression = (field) => {
    const spec = entity.read.fields[field];
    return ["integer", "decimal"].includes(spec.type) ? `to_char(${spec.column},'TM9','NLS_NUMERIC_CHARACTERS=''.,''')` : spec.type === "date" ? `to_char(${spec.column},'YYYY-MM-DD')` : spec.type === "timestamp" ? `to_char(${spec.column},'YYYY-MM-DD"T"HH24:MI:SS.FF6')` : spec.column;
  };
  const validation = instance.parameters.editableFields.map((field) => {
    const spec = entity.read.fields[field], value = ":" + itemName(field), checks = [];
    if (!spec.nullable) checks.push(`${value} is null`);
    if (spec.maxLength) checks.push(`length(${value})>${spec.maxLength}`);
    if (spec.enum?.length) checks.push(`${value} not in (${spec.enum.map(sqlLiteral).join(", ")})`);
    if (["integer", "decimal"].includes(spec.type))
      checks.push(
        `${value} is not null and not regexp_like(${value},'${spec.type === "integer" ? "^[+-]?[0-9]+$" : "^[+-]?[0-9]+([.][0-9]+)?$"}')`
      );
    return checks.length ? `if ${checks.map((c) => "(" + c + ")").join(" or ")} then raise_application_error(-20002,'Invalid ${field}'); end if;` : "";
  }).join("\n  ");
  let form = node(
    "region",
    "form",
    `name: ${scalar(instance.parameters.title)}
type: staticContent
${layout(10, "contentBody")}
${appearance("standard")}`
  );
  form += node(
    "region",
    "buttons",
    `name: Actions
type: staticContent
${layout(20, "dialogFooter")}
${appearance("buttons-container")}`
  );
  for (const [field, spec] of fields)
    if (instance.parameters.editableFields.includes(field) || keys.includes(field) || field === version)
      form += item(
        itemName(field),
        field,
        fields.findIndex(([n]) => n === field) * 10 + 10,
        !instance.parameters.editableFields.includes(field),
        !spec.nullable
      );
  form += button("save", "Save", "buttons", "action: definedByDynamicAction");
  form += button("cancel", "Cancel", "buttons", "action: definedByDynamicAction");
  form += dynamic(
    "cancel-dialog",
    "click",
    "selectionType: button\nbutton: @cancel",
    node(
      "action",
      "cancel",
      "action: cancelDialog\n" + group("execution", "sequence: 10\nfireOnInit: false")
    )
  );
  const mappedFields = fields.filter(
    ([field]) => instance.parameters.editableFields.includes(field) || keys.includes(field) || field === version
  );
  form += process2(
    allocation.prefix + "-read",
    "beforeHeader",
    `begin
  if :${itemName(keys[0])} is not null then
    select ${mappedFields.map(([f]) => readExpression(f)).join(", ")} into ${mappedFields.map(([f]) => ":" + itemName(f)).join(", ")} from ${entity.read.object} where ${entity.read.fields[keys[0]].column} = :${itemName(keys[0])} and (${predicate});
  end if;
end;`
  );
  const variables = /* @__PURE__ */ new Map();
  for (const [argument, mapping] of Object.entries(command.inputs).sort(([a], [b]) => a < b ? -1 : 1))
    variables.set(argument, mapping.mode === "in-out" ? "l_key" : inputExpression(mapping.from.slice(7)));
  variables.set(command.outputs.recordKey.from, "l_key");
  variables.set(command.outputs.recordVersion.from, "l_version");
  const saveName = allocation.prefix + "_SAVE";
  const server = `declare
  l_key ${entity.read.object}.${entity.read.fields[keys[0]].column}%type;
  l_authorized boolean;
  l_visible pls_integer;
  l_version ${entity.read.object}.${entity.read.fields[version].column}%type;
begin
  savepoint composer_save;
  l_authorized := (${binding.writeExpression});
  if l_authorized is null or not l_authorized or not apex_authentication.is_authenticated then raise_application_error(-20001, 'Authorization denied'); end if;
  l_key := ${inputExpression(keys[0])};
  if apex_application.g_x01 = 'create' then
    if ${instance.parameters.createEnabled ? "false" : "true"} or l_key is not null or :${itemName(version)} is not null then raise_application_error(-20002, 'Invalid create draft'); end if;
  elsif apex_application.g_x01 = 'edit' then
    if ${instance.parameters.editEnabled ? "false" : "true"} or l_key is null or :${itemName(version)} is null then raise_application_error(-20002, 'Invalid edit draft'); end if;
    select count(*) into l_visible from ${entity.read.object} where ${entity.read.fields[keys[0]].column} = l_key and (${predicate}) and rownum = 1;
    if l_visible = 0 then raise_application_error(-20001, 'Authorization denied'); end if;
  else raise_application_error(-20002, 'Invalid operation'); end if;
  ${validation}
  ${instance.extensions.beforeSaveValidation ?? ""}
  ${command.package}.${command.procedure}(${[...variables].map(([argument, value]) => `${argument} => ${value}`).join(", ")});
  if l_key is null or l_version is null then raise_application_error(-20004, 'API output contract violated'); end if;
  ${instance.extensions.afterSaveNotification ?? ""}
  apex_json.open_object; apex_json.write('ok',true); apex_json.write('recordKey',${["integer", "decimal"].includes(entity.read.fields[keys[0]].type) ? "to_char(l_key,'TM9','NLS_NUMERIC_CHARACTERS=''.,''')" : "l_key"}); apex_json.write('recordVersion',to_char(l_version,'TM9','NLS_NUMERIC_CHARACTERS=''.,''')); apex_json.close_object;
exception when others then
  rollback to composer_save;
  apex_json.open_object; apex_json.write('ok',false); apex_json.write('code',case sqlcode when -20001 then 'authorization' when -20002 then 'validation' when -20003 then 'conflict' else 'server-error' end); apex_json.write('message','Save failed. Review fields and reload after a conflict.'); apex_json.close_object;
end;`;
  form += process2(saveName, "ajaxCallback", server);
  const pageItems = mappedFields.map(([f]) => "#" + itemName(f)).join(",");
  const correlation = "(window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2))";
  const js = `var button = this.triggeringElement; if (button.disabled) return; button.disabled = true; var saved = false;
var keyItem = apex.item(${JSON.stringify(itemName(keys[0]))}), operation = keyItem.getValue() ? 'edit' : 'create';
apex.server.process(${JSON.stringify(saveName)}, {x01: operation, pageItems: ${JSON.stringify(pageItems)}}, {dataType: 'json', success: function(data) { if (data.ok) { saved = true; try { keyItem.setValue(data.recordKey); apex.item(${JSON.stringify(itemName(version))}).setValue(data.recordVersion); } catch (e) {} try { apex.navigation.dialog.close(true, {entityRef: ${JSON.stringify(binding.entityRef)}, recordKey: data.recordKey, recordVersion: data.recordVersion, operation: operation, originInstance: ${JSON.stringify(id)}, correlationId: ${correlation}}); } catch (e) { apex.message.showErrors([{type:'error',location:'page',message:'Saved. Close this dialog and refresh the report.',unsafe:false}]); } } else { apex.message.showErrors([{type:'error',location:'page',message:data.message,unsafe:false}]); } }, error: function() {apex.message.showErrors([{type:'error',location:'page',message:'Save request failed.',unsafe:false}]);}, complete: function() { if (!saved) button.disabled = false; } });`;
  form += dynamic("save-dialog", "click", "selectionType: button\nbutton: @save", jsAction("save-api", js));
  result[file(dialog)] = page(allocation, instance.parameters.title, form, true);
  return result;
}

// packages/core/src/composer/planner.ts
var extensionUnsafe = () => new Fault(
  "EXTENSION_UNSAFE",
  "Extension code must preserve caller-owned transactions and literal boundaries.",
  5
);
function extensionCode(source2) {
  if (/```|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]|\b[nN]?[qQ]'/.test(source2)) throw extensionUnsafe();
  let code2 = "", at = 0;
  while (at < source2.length) {
    if (source2.startsWith("--", at)) {
      const end = source2.indexOf("\n", at);
      at = end < 0 ? source2.length : end;
      code2 += " ";
    } else if (source2.startsWith("/*", at)) {
      const end = source2.indexOf("*/", at + 2);
      if (end < 0) throw extensionUnsafe();
      at = end + 2;
      code2 += " ";
    } else if (source2[at] === "'") {
      const end = source2.slice(at + 1).search(/'(?!')/);
      if (end < 0) throw extensionUnsafe();
      at += end + 2;
      code2 += "''";
    } else if (source2[at] === '"') {
      const end = source2.indexOf('"', at + 1);
      if (end < 0) throw extensionUnsafe();
      code2 += " " + source2.slice(at + 1, end) + " ";
      at = end + 1;
    } else code2 += source2[at++];
  }
  const normalized = code2.replace(/\s+/g, " ");
  if (/\b(?:commit|rollback|savepoint|grant|revoke|host|connect|autonomous_transaction)\b|\bexecute\s+immediate\b|\b(?:dbms_sql|dbms_sys_sql|dbms_job|dbms_scheduler|dbms_pipe|dbms_java|dbms_aq\w*|utl_\w+)\b|\bsys\s*\./i.test(
    normalized
  ))
    throw extensionUnsafe();
  return source2;
}
function derivedNames(prefix) {
  return [
    prefix,
    prefix + "_EDIT",
    prefix + "_SAVE",
    prefix + "_records",
    prefix + "_summary",
    ...["records", "summary", "history", "master", "detail", "filter", "create", "saved", "read"].map(
      (suffix) => prefix + "-" + suffix
    )
  ].map((name) => name.toUpperCase());
}
function sourceIdentities(sources) {
  const names = new Set(inventorySymbols(sources).symbols);
  for (const source2 of Object.values(sources))
    for (const match2 of source2.matchAll(
      /^[ \t]*(?:alias|htmlDomId|staticId|buttonName|name):[ \t]*([^\s]+)[ \t]*$/gm
    ))
      names.add(match2[1].toUpperCase());
  return names;
}
var escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function pageReference(source2, page2, alias) {
  const target = alias ? `(?:${page2}|${escapeRegExp(alias)})` : page2, end = "(?![A-Za-z0-9_$#-])";
  if (new RegExp("\\bpage:\\s*" + target + end, "i").test(source2) || source2.includes(":" + page2 + ":") || new RegExp(`f\\?p=[^:\\s'"]*:${target}${end}`, "i").test(source2) || new RegExp(`\\bp_page\\s*=>\\s*'?${target}${end}`, "i").test(source2) || alias && new RegExp(`(?<![A-Za-z0-9_$#-])${escapeRegExp(alias)}${end}`, "i").test(source2))
    return "literal";
  if (/\bp_page\s*=>(?!\s*(?:'[A-Za-z0-9_$#]*'|\d+\b))/i.test(source2) || /\bapex_page\.get_url\s*\((?!\s*(?:p_|\)))/i.test(source2) || /f\?p=[^:\s'"]*:(?:&(?!APP_PAGE_ID\.)|#|'\s*\|\|)/i.test(source2))
    return "dynamic";
  return null;
}
async function snapshot(ctx, blueprintPath, options = {}) {
  const root = await safePath(ctx.root, ctx.config.application.sourceDir), sourceInventory = await inventory(root);
  const sources = {};
  for (const file of Object.keys(sourceInventory).filter((file2) => file2.endsWith(".apx"))) {
    const bytes = await readFile(await safePath(root, file)), text = bytes.toString("utf8");
    if (!Buffer.from(text).equals(bytes))
      throw new Fault("TRANSFORM_UNSUPPORTED", "Source must be valid UTF-8.", 5);
    sources[file] = text;
  }
  const stateFile = await safePath(ctx.root, ".apexrest-composer/state.json");
  const state = await exists(stateFile) ? await readDocument(ctx.root, ".apexrest-composer/state.json", stateSchema) : null;
  const bases = {};
  const baseRoot = await safePath(ctx.root, ".apexrest-composer/bases");
  if (await exists(baseRoot))
    for (const entry2 of await readdir(baseRoot)) {
      if (!/^[a-f0-9]{64}\.apx$/.test(entry2))
        throw new Fault("GENERATION_BASE_CORRUPT", "Unexpected generated base entry.", 5);
      const bytes = await readFile(await safePath(baseRoot, entry2)), digest3 = entry2.slice(0, -4);
      if (hash(bytes) !== digest3)
        throw new Fault("GENERATION_BASE_CORRUPT", "Generated base integrity failed.", 5);
      bases[digest3] = bytes.toString("utf8");
    }
  if (state) {
    for (const owner of Object.values(state.owners))
      for (const digest3 of Object.values(owner.bases))
        if (!(digest3 in bases))
          throw new Fault("GENERATION_BASE_MISSING", "Previous generated base is unavailable.", 5);
  }
  const blueprint = await readDocument(ctx.root, blueprintPath, blueprintSchema);
  const mode = options.mode ?? "offline";
  if (mode === "connected" && (!options.environment || !options.metadata))
    throw new Fault(
      "ENVIRONMENT_REQUIRED",
      "Connected planning requires explicit environment and metadata.",
      2
    );
  if (options.environment && blueprint.application.environment && options.environment !== blueprint.application.environment)
    throw new Fault("ENVIRONMENT_MISMATCH", "Blueprint and requested environment differ.", 5);
  return {
    blueprint,
    blueprintPath,
    catalog: await loadCatalog(ctx.root),
    state,
    sources,
    sourceInventory,
    bases,
    configurationDigest: semanticDigest(ctx.config),
    toolchainDigest: hash(await readFile(await safePath(ctx.root, ctx.config.toolchain.lockFile))),
    sourceDir: ctx.config.application.sourceDir,
    projectId: ctx.config.projectId,
    mode,
    environment: options.environment ?? null,
    metadata: options.metadata ?? null,
    validation: options.validation ?? "compiler"
  };
}
function planComposition(input) {
  const { blueprint, state, catalog: catalog3 } = input;
  const diagnostics = [], operations = [];
  const blueprintDigest = semanticDigest(blueprint);
  const plan = {
    schemaVersion: 1,
    generatorVersion: "1",
    kind: "composition",
    status: "blocked",
    projectId: input.projectId,
    blueprintPath: input.blueprintPath,
    blueprintDigest,
    catalogDigest: catalog3.digest,
    configurationDigest: input.configurationDigest,
    toolchainDigest: input.toolchainDigest,
    sourceInventory: input.sourceInventory,
    stateDigest: state ? semanticDigest(state) : null,
    validation: input.validation,
    mode: input.mode,
    contextDigest: semanticDigest(
      input.metadata ?? { assumptions: blueprint.application.compatibilityProfile }
    ),
    environment: input.environment,
    review: {
      entities: blueprint.entities,
      commands: blueprint.commands,
      contracts: blueprint.contracts,
      packages: {}
    },
    allocations: {},
    operations,
    state: null,
    lock: null,
    diagnostics,
    digest: "0".repeat(64)
  };
  try {
    let visit = function(id) {
      if (visiting.has(id)) throw new Fault("INTERACTION_CYCLE", "Runtime event cycles are unsupported.", 5);
      if (visited.has(id)) return;
      visiting.add(id);
      for (const target of graph.get(id) ?? []) visit(target);
      visiting.delete(id);
      visited.add(id);
    };
    if (Object.keys(blueprint.blocks).length > 256)
      throw new Fault("INSTANCE_LIMIT", "At most 256 instances are supported.", 2);
    const packages = resolvePackages(
      catalog3,
      Object.values(blueprint.blocks).map((b) => b.use),
      blueprint.application.compatibilityProfile
    );
    plan.review.packages = Object.fromEntries(
      [...packages].map(([id, p]) => [
        id,
        {
          digest: p.digest,
          origin: p.manifest.origin,
          license: p.manifest.license,
          effects: p.manifest.effects,
          dependencies: p.manifest.requires.blocks
        }
      ])
    );
    for (const pkg of packages.values())
      if (pkg.manifest.status === "deprecated")
        diagnostics.push({
          code: "BLOCK_DEPRECATED",
          severity: "warning",
          message: "Selected exact block is deprecated; review replacement separately."
        });
    const symbols = inventorySymbols(input.sources), used = new Set(symbols.pages), prefixes = /* @__PURE__ */ new Set(), ownedFiles = new Set(Object.values(state?.owners ?? {}).flatMap((owner) => Object.keys(owner.files))), existing = sourceIdentities(
      Object.fromEntries(Object.entries(input.sources).filter(([file]) => !ownedFiles.has(file)))
    );
    const allocated = {};
    const nextPage = () => {
      for (let page2 = 100; page2 < 9999; page2++)
        if (!used.has(page2)) {
          used.add(page2);
          return page2;
        }
      throw new Fault("ALLOCATION_EXHAUSTED", "No available page identity.", 5);
    };
    for (const [id, instance] of Object.entries(blueprint.blocks).sort(([a], [b]) => a < b ? -1 : 1)) {
      const binding = bind(blueprint, instance, input.metadata ?? void 0);
      if (Object.keys(instance.extensions).length && instance.ownership !== "extended")
        throw new Fault("EXTENSION_MODE_REQUIRED", "Extension hooks require explicit extended ownership.", 5);
      for (const source2 of Object.values(instance.extensions)) extensionCode(source2);
      const previous = state?.owners[id], prefix = previous?.allocation.prefix ?? "cmp_" + id.toLowerCase().replaceAll("-", "_").slice(0, 24) + "_" + hash(id).slice(0, 8);
      const names = derivedNames(prefix);
      if (names.some(
        (name) => prefixes.has(name) || existing.has(name) || !previous && symbols.symbols.has(name)
      ))
        throw new Fault("SYMBOL_COLLISION", "A block namespace collides with existing source.", 5);
      for (const name of names) prefixes.add(name);
      if (previous)
        for (const file of Object.keys(previous.files)) {
          if (!input.sources[file])
            throw new Fault(
              "OWNED_SOURCE_MISSING",
              "Owned source is missing; explicit adoption is required.",
              5
            );
          const page2 = declarations(input.sources[file]).find((n) => n.kind === "page" && n.depth === 0);
          if (!page2 || ![previous.allocation.page, previous.allocation.dialog].includes(Number(page2.key)))
            throw new Fault("OWNED_IDENTITY_CHANGED", "Owned page identity changed.", 5);
        }
      allocated[id] = {
        page: previous?.allocation.page ?? nextPage(),
        dialog: binding.writable ? previous?.allocation.dialog ?? nextPage() : null,
        prefix
      };
      const pkg = packages.get(instance.use);
      if (binding.writable && pkg.manifest.renderer !== "report-dialog")
        throw new Fault(
          "BLOCK_WRITE_UNSUPPORTED",
          "Only the report-dialog adapter implements create/edit commands.",
          5
        );
      const providers = /* @__PURE__ */ new Set([
        "key",
        "readAuthorization",
        ...binding.writable ? ["optimisticLock", "writeAuthorization"] : []
      ]);
      for (const capability of pkg.manifest.requires.capabilities)
        if (!providers.has(capability) && !(pkg.manifest.renderer === "report-dialog" && !binding.writable && ["optimisticLock", "writeAuthorization"].includes(capability)))
          throw new Fault("CAPABILITY_MISSING", "A required block capability has no reviewed provider.", 5);
    }
    const hosts = /* @__PURE__ */ new Map(), graph = /* @__PURE__ */ new Map();
    for (const connection of blueprint.connections) {
      const from = connection.from.match(/^([\w-]+)\.events\.saved$/), to = connection.to.match(/^([\w-]+)\.actions\.refresh$/);
      if (!from || !to || !blueprint.blocks[from[1]] || !blueprint.blocks[to[1]])
        throw new Fault("CONNECTION_INVALID", "Unknown or unsupported event/action port.", 5);
      const publisher = blueprint.blocks[from[1]], consumer = blueprint.blocks[to[1]];
      if (!bind(blueprint, publisher).writable || packages.get(publisher.use).manifest.renderer !== "report-dialog" || packages.get(consumer.use).manifest.renderer !== "status-summary" || publisher.bindings.records !== consumer.bindings.records)
        throw new Fault(
          "CONNECTION_CONTRACT_MISMATCH",
          "Saved/refresh connections require a writable report and summary of the same row scope.",
          5
        );
      if (hosts.has(to[1]))
        throw new Fault("CONNECTION_DUPLICATE", "A summary can have one explicit host.", 5);
      hosts.set(to[1], from[1]);
      graph.set(from[1], [...graph.get(from[1]) ?? [], to[1]]);
    }
    const visiting = /* @__PURE__ */ new Set(), visited = /* @__PURE__ */ new Set();
    for (const id of graph.keys()) visit(id);
    for (const [id, previous] of Object.entries(state?.owners ?? {})) {
      for (const host of previous.consumers) {
        const childDetached = blueprint.blocks[id]?.ownership === "detached" || previous.mode === "detached";
        const hostDetached = blueprint.blocks[host]?.ownership === "detached" || state?.owners[host]?.mode === "detached";
        if (childDetached !== hostDetached)
          throw new Fault(
            "SHARED_OWNERSHIP_DETACH_REQUIRED",
            "Detach the hosted summary and its page owner together to preserve shared source.",
            5
          );
      }
    }
    for (const [child, host] of hosts)
      if (blueprint.blocks[child].ownership === "detached" || blueprint.blocks[host].ownership === "detached")
        throw new Fault(
          "DETACHED_CONNECTION",
          "Remove managed connections when detaching both connected instances.",
          5
        );
    for (const [id, previous] of Object.entries(state?.owners ?? {}).sort(([a], [b]) => a < b ? -1 : 1))
      if (previous.consumers.length && blueprint.blocks[id] && blueprint.blocks[id].ownership !== "detached" && !hosts.has(id))
        allocated[id].page = nextPage();
    for (const [child, host] of hosts) allocated[child].page = allocated[host].page;
    plan.allocations = allocated;
    const desired = {}, owners = {};
    for (const [id, instance] of Object.entries(blueprint.blocks).sort(([a], [b]) => a < b ? -1 : 1)) {
      const pkg = packages.get(instance.use), previous = state?.owners[id];
      if (instance.ownership === "detached") {
        if (!previous)
          throw new Fault("DETACH_UNOWNED", "Only an existing owned instance can be detached.", 5);
        owners[id] = { ...previous, mode: "detached" };
        continue;
      }
      if (previous?.mode === "detached")
        throw new Fault(
          "REATTACH_REQUIRES_ADOPTION",
          "Detached instances need explicit reviewed adoption.",
          5
        );
      const summaries = [...hosts].filter(([, host]) => host === id).map(([child]) => ({ instance: blueprint.blocks[child], allocation: allocated[child] }));
      const files = hosts.has(id) ? {} : render(blueprint, id, instance, pkg.manifest, allocated[id], summaries);
      for (const [file, source2] of Object.entries(files)) {
        if (desired[file])
          throw new Fault("OWNERSHIP_COLLISION", "Two instances own the same source file.", 5);
        desired[file] = source2;
      }
      owners[id] = {
        instanceId: id,
        blockId: pkg.manifest.id,
        version: pkg.manifest.version,
        mode: instance.ownership,
        allocation: allocated[id],
        files: {},
        bases: {},
        consumers: hosts.has(id) ? [hosts.get(id)] : [],
        provenance: semanticDigest({
          package: pkg.digest,
          instance,
          bindings: blueprint.entities,
          commands: blueprint.commands,
          contracts: blueprint.contracts
        })
      };
      for (const [file, source2] of Object.entries(files)) {
        owners[id].files[file] = hash(source2);
        owners[id].bases[file] = hash(source2);
      }
    }
    const oldFiles = /* @__PURE__ */ new Map();
    if (state)
      for (const owner of Object.values(state.owners))
        for (const file of Object.keys(owner.files)) {
          if (oldFiles.has(file))
            throw new Fault("OWNERSHIP_COLLISION", "Ambiguous previous file ownership.", 5);
          oldFiles.set(file, owner);
        }
    const effectiveSources = { ...input.sources };
    for (const [file, next] of Object.entries(desired)) {
      const local = input.sources[file], old = oldFiles.get(file);
      let content = next;
      if (local !== void 0 && !old)
        throw new Fault("UNMANAGED_COLLISION", "A generated path already contains unmanaged source.", 5);
      if (local !== void 0 && old) {
        const base2 = input.bases[old.bases[file]];
        if (base2 === void 0)
          throw new Fault("GENERATION_BASE_MISSING", "Generated base is unavailable.", 5);
        content = threeWay(base2, local, next);
      }
      effectiveSources[file] = content;
      const owner = Object.values(owners).find((o) => file in o.files);
      owner.files[file] = hash(content);
      if (local !== content)
        operations.push({
          path: input.sourceDir + "/" + file,
          before: input.sourceInventory[file] ?? null,
          after: hash(content),
          content,
          reason: old ? "update-owned-source" : "create-owned-source"
        });
      const basePath = `.apexrest-composer/bases/${hash(next)}.apx`;
      if (!(hash(next) in input.bases))
        operations.push({
          path: basePath,
          before: null,
          after: hash(next),
          content: next,
          reason: "retain-generated-base"
        });
    }
    const removedFiles = new Set(
      [...oldFiles].filter(
        ([file, owner]) => !(file in desired) && owners[owner.instanceId]?.mode !== "detached" && owner.mode !== "detached"
      ).map(([file]) => file)
    );
    for (const [file, owner] of oldFiles)
      if (!(file in desired)) {
        const existing2 = owners[owner.instanceId];
        if (existing2?.mode === "detached" || owner.mode === "detached") {
          if (!existing2) owners[owner.instanceId] = owner;
          continue;
        }
        if (Object.values(state.owners).some(
          (o) => o.mode === "detached" && o.allocation.page === owner.allocation.page
        ))
          throw new Fault("SHARED_CONSUMER_RETAINED", "A detached consumer still uses the owned page.", 5);
        if (input.sources[file] !== input.bases[owner.bases[file]])
          throw new Fault(
            "REMOVAL_CONFLICT",
            "Owned source has manual changes; detach instead of deleting.",
            5
          );
        const targetPage = declarations(input.sources[file]).find(
          (n) => n.kind === "page" && n.depth === 0
        )?.key;
        if (!targetPage || !/^\d+$/.test(targetPage))
          throw new Fault("UNKNOWN_CONSUMER_RETAINED", "Removed page identity cannot be verified.", 5);
        const alias = input.sources[file].match(/^ {4}alias:[ \t]*([A-Za-z0-9_$#]+)[ \t]*$/m)?.[1];
        for (const [consumer, source2] of Object.entries(effectiveSources)) {
          if (consumer === file || removedFiles.has(consumer)) continue;
          const reference = pageReference(source2, targetPage, alias);
          if (reference)
            throw new Fault(
              "UNKNOWN_CONSUMER_RETAINED",
              reference === "literal" ? "A remaining or unmanaged source still references the removed page." : "A remaining source builds a dynamic page link; review it before removing an owned page.",
              5
            );
        }
        operations.push({
          path: input.sourceDir + "/" + file,
          before: input.sourceInventory[file],
          after: null,
          content: null,
          reason: "remove-owned-source"
        });
      }
    const lock = {
      schemaVersion: 1,
      generatorVersion: "1",
      resolverPolicyVersion: "1",
      blueprintSemanticDigest: blueprintDigest,
      catalogDigest: catalog3.digest,
      compatibilityProfile: blueprint.application.compatibilityProfile,
      packages: Object.fromEntries([...packages].map(([key, p]) => [key, p.digest])),
      contractDigest: semanticDigest({
        entities: blueprint.entities,
        commands: blueprint.commands,
        contracts: blueprint.contracts
      })
    };
    const lockDigest = semanticDigest(lock), generationDigest = semanticDigest({ blueprintDigest, lockDigest, owners });
    plan.state = {
      schemaVersion: 1,
      generatorVersion: "1",
      generationDigest,
      blueprintDigest,
      lockDigest,
      owners
    };
    plan.lock = lock;
    plan.status = "materializable";
    if (input.validation === "source-only")
      diagnostics.push({
        code: "SOURCE_ONLY_DRAFT",
        severity: "warning",
        message: "Structural draft only; compiler and runtime qualification are unavailable."
      });
    diagnostics.push({
      code: "RUNTIME_NOT_RUN",
      severity: "info",
      message: "Composition does not establish live Oracle, import, authorization or browser evidence."
    });
  } catch (error) {
    if (!(error instanceof Fault)) throw error;
    operations.splice(0);
    plan.state = null;
    plan.lock = null;
    diagnostics.push({ code: error.code, severity: "error", message: error.message });
  }
  plan.operations = [...new Map(operations.map((op) => [op.path, op])).values()].sort(
    (a, b) => a.path < b.path ? -1 : 1
  );
  plan.digest = planDigest(plan);
  const checked = planSchema.safeParse(plan);
  if (checked.success && Buffer.byteLength(documentText(plan)) <= planLimits.document) return checked.data;
  plan.status = "blocked";
  plan.operations = [];
  plan.state = null;
  plan.lock = null;
  plan.diagnostics = [
    ...diagnostics.filter((diagnostic) => diagnostic.severity !== "info"),
    {
      code: "PLAN_LIMIT",
      severity: "error",
      message: `Generated plan exceeds reviewed limits (owned source up to ${OWNED_TEXT_LIMIT} characters, at most 2048 writes).`
    }
  ];
  plan.digest = planDigest(plan);
  return validate(planSchema, plan);
}

// packages/core/src/composer/service.ts
var composePlanInput = external_exports.strictObject({
  project: external_exports.string().min(1).max(4096).optional(),
  blueprint: relativePath.default("app.blueprint.yaml"),
  out: relativePath,
  mode: external_exports.enum(["offline", "connected"]).default("offline"),
  env: refName.optional(),
  validation: external_exports.enum(["compiler", "source-only"]).default("compiler"),
  action: external_exports.enum(["compose", "recover-resume", "recover-restore"]).default("compose")
});
var composeMaterializeInput = external_exports.strictObject({
  project: external_exports.string().min(1).max(4096).optional(),
  plan: relativePath.optional(),
  artifactId: external_exports.uuid().optional(),
  expectedDigest: digest
});
async function context(ctx, blueprintFile, envName, oracle) {
  const env2 = environment(ctx, envName), connection = await resolveConnection(env2.readConnectionRef);
  const blueprint = await readDocument(ctx.root, blueprintFile, blueprintSchema);
  const result = { schema: env2.parsingSchema, objects: {}, signatures: {} };
  async function read(kind, name) {
    const rows = [];
    let offset = 0;
    while (rows.length < 1e4) {
      const response = await metadataRead(oracle, env2, connection, {
        kind,
        name,
        schema: env2.parsingSchema,
        offset,
        limit: 100
      });
      if (!("rows" in response))
        throw new Fault("METADATA_INVALID", "Expected one scoped metadata result.", 5);
      rows.push(...response.rows);
      if (response.nextOffset === null) return rows;
      offset = response.nextOffset;
    }
    throw new Fault("METADATA_LIMIT", "Object metadata exceeds the composition limit.", 5);
  }
  for (const entity of Object.values(blueprint.entities))
    if (!result.objects[entity.read.object])
      result.objects[entity.read.object] = {
        columns: await read("columns", entity.read.object),
        constraints: await read("constraints", entity.read.object),
        constraintColumns: await read("constraint-columns", entity.read.object)
      };
  for (const command of Object.values(blueprint.commands))
    if (!result.signatures[command.package])
      result.signatures[command.package] = await read("signatures", command.package);
  return result;
}
async function composePlan(ctx, request, oracle = new OracleAdapter(), signal) {
  await requireTrust(ctx.root);
  if (request.validation === "source-only" && !ctx.config.composer?.allowSourceOnly)
    throw new Fault(
      "SOURCE_ONLY_POLICY_REQUIRED",
      "Source-only composition requires explicit project composer.allowSourceOnly policy.",
      4
    );
  if (request.mode === "connected" && !request.env)
    throw new Fault("ENVIRONMENT_REQUIRED", "Connected planning requires --env.", 2);
  if (request.action !== "compose" && request.mode !== "offline")
    throw new Fault("INVALID_INPUT", "Local recovery has no connected mode.", 2);
  const pending = await journal(ctx);
  if (request.action === "compose" && pending && pending.phase !== "completed")
    throw new Fault(
      "RECOVERY_REQUIRED",
      "Create an explicit recovery plan for the interrupted composition.",
      5
    );
  const metadata = request.mode === "connected" ? await context(ctx, request.blueprint, request.env, oracle) : void 0;
  const input = request.action === "compose" ? await snapshot(ctx, request.blueprint, {
    mode: request.mode,
    validation: request.validation,
    ...request.env ? { environment: request.env } : {},
    ...metadata ? { metadata } : {}
  }) : null;
  const plan = input ? planComposition(input) : await recoveryPlan(ctx, request.action === "recover-resume" ? "resume" : "restore");
  let compiler = {
    status: "not-run",
    reason: request.action === "compose" ? "Source-only or blocked draft." : "Local journal recovery."
  };
  let compilerValidated = false;
  if (plan.status === "materializable" && request.action === "compose" && request.validation === "compiler") {
    const staged = await stagePlan(ctx, plan);
    compiler = await oracle.validate(staged.directory, signal);
    const actual = compiler;
    if (actual.mmd.mmdVersion !== "26.1.0+3102" || !/Release 26[.]1[.]/.test(actual.compiler.version))
      throw new Fault(
        "PROFILE_COMPILER_MISMATCH",
        "Real compiler/MMD differs from the pinned Composer profile.",
        5
      );
    compilerValidated = true;
  }
  if (metadata)
    await writeJson(
      await safePath(ctx.root, `.apexrest/composer/contexts/${plan.contextDigest}.json`),
      metadata
    );
  await freeze(ctx, plan, request.out);
  const artifactId = await new ArtifactService(ctx).saveJson(plan, "composition-plan");
  await writeJson(await safePath(ctx.root, `.apexrest/composer/plan-artifacts/${artifactId}.json`), {
    digest: plan.digest,
    file: `.apexrest/composer/plans/${plan.digest}.json`
  });
  return {
    status: plan.status,
    kind: plan.kind,
    plan: request.out,
    planDigest: plan.digest,
    artifactId,
    diagnostics: plan.diagnostics,
    operations: plan.operations.map(({ path: path7, reason, before, after }) => ({ path: path7, reason, before, after })),
    allocationCount: Object.keys(plan.allocations).length,
    compiler,
    databaseEffects: [],
    qualification: compilerValidated ? "offline-compiler" : "unverified",
    nextActions: plan.status === "materializable" ? ["Review the plan, then materialize using its exact digest."] : ["Resolve the reported binding or ownership diagnostics."]
  };
}
async function composeMaterialize(ctx, request, signal) {
  if (Boolean(request.plan) === Boolean(request.artifactId))
    throw new Fault("INVALID_INPUT", "Supply exactly one plan path or registered artifact ID.", 2);
  let file = request.plan;
  if (request.artifactId) {
    const ref = JSON.parse(
      await readFile2(
        await safePath(ctx.root, `.apexrest/composer/plan-artifacts/${request.artifactId}.json`),
        "utf8"
      )
    );
    if (ref.digest !== request.expectedDigest)
      throw new Fault("PLAN_TAMPERED", "Artifact and expected plan digest differ.", 5);
    file = ref.file;
  }
  return materialize(ctx, await readPlan(ctx, file, request.expectedDigest), signal ? { signal } : {});
}

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
    include: external_exports.enum(["code", "metadata"]).optional().describe("search: code on all hits or none"),
    includeUnresolved: external_exports.boolean().default(false),
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
    waitSeconds: external_exports.number().int().min(0).max(JOB_WAIT_MAX_SECONDS).default(0)
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
  "sandbox.down": external_exports.strictObject(base),
  // Composite MCP operations. Each routes to the operations above so the CLI
  // keeps its granular commands while the agent sees one tool per concern.
  project: external_exports.strictObject({
    ...base,
    action: external_exports.enum(["init", "adopt", "inspect", "connection_add", "connection_list", "connection_test"]),
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
    saved: external_exports.boolean().default(false)
  }),
  reference: external_exports.strictObject({
    ...base,
    mode: external_exports.enum(["search", "read"]),
    query: external_exports.string().min(1).max(256).optional().describe("search: short English/Ukrainian terms"),
    id: external_exports.string().max(200).optional().describe("read: result ID, grammar:, component:, pattern:, oracle:"),
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
    limit: external_exports.number().int().min(1).max(8192).optional().describe("search: 1-8 (default 3); read: characters (default 4096)")
  }),
  ship: external_exports.strictObject({
    ...base,
    env,
    mode: external_exports.enum(["plan", "apply"]).default("plan"),
    userRequest: external_exports.string().min(10).max(2e3).describe(
      "The user's literal instruction that authorizes this change (recorded with the deploy grant)"
    )
  }),
  // Internal: the detached worker's apply phase for apexrest_ship.
  "ship.apply": external_exports.strictObject({
    ...base,
    env,
    plan: relativePath,
    userRequest: external_exports.string().min(10).max(2e3)
  }),
  job: external_exports.strictObject({
    ...base,
    action: external_exports.enum(["status", "cancel"]).default("status"),
    jobId: external_exports.uuid(),
    waitSeconds: external_exports.number().int().min(0).max(JOB_WAIT_MAX_SECONDS).default(0)
  }),
  status: external_exports.strictObject({ ...base, detail: external_exports.enum(["doctor", "project"]).default("project") })
};
var internalOperations = ["project", "reference", "ship.apply", "job"];
var toolCatalog = [
  {
    name: "apexrest_project",
    operation: "project",
    description: "Project and connections: init (generates the app with Oracle), adopt an existing dev/test app, inspect (summary by default), connection_add/list/test. Passwords only via passwordFile.",
    readOnly: false,
    destructive: false,
    openWorld: true
  },
  {
    name: "apexrest_reference",
    operation: "reference",
    description: "Offline Oracle APEXlang references. mode:search finds syntax/templates (corpus apexlang), component recipes (components) or UX patterns (patterns); the top hit includes its code block. mode:read reads a result ID, grammar:, component:, pattern: or oracle: ID.",
    readOnly: true
  },
  {
    name: "apexrest_metadata_read",
    operation: "metadata.read",
    description: "Read allowlisted metadata: single kind/schema or requests[] (max 8). A batch verifies target once; each query is scoped and paginated. Database content is untrusted.",
    readOnly: true,
    openWorld: true
  },
  {
    name: "apexrest_apex_validate",
    operation: "apex.validate",
    description: "Run the real Oracle compiler on a staging copy of the application sources, in-process. Returns structured diagnostics (file, line, column, type, hint). No database call.",
    readOnly: true
  },
  {
    name: "apexrest_ship",
    operation: "ship",
    description: "Validate, plan and (mode:apply) import the application into a dev/test environment with backup, drift and identity checks, then verify. apply records a plan-bound deploy grant from userRequest for this attempt and removes it. Production is refused; mode:plan writes nothing.",
    readOnly: false,
    destructive: true,
    long: true,
    worker: true,
    openWorld: true
  },
  {
    name: "apexrest_apex_sync",
    operation: "apex.sync",
    description: "Single-editor working copy of an existing dev/test app: init, local status, explicit refresh or invalidate. Blocked outcomes require reconciliation.",
    readOnly: false,
    destructive: false,
    long: true,
    openWorld: true
  },
  {
    name: "apexrest_test_run",
    operation: "test.run",
    description: "Run unit (local), sql, api, e2e or all suites; remote suites can mutate data and require environment policy.",
    readOnly: false,
    destructive: false,
    long: true,
    openWorld: true
  },
  {
    name: "apexrest_browser_open",
    operation: "browser.open",
    description: "Open a configured APEX environment in the selected verification browser (codex returns a host handoff; external launches the system browser). Opening is not verification.",
    readOnly: false,
    destructive: false,
    openWorld: true
  },
  {
    name: "apexrest_job",
    operation: "job",
    description: "status: read a job (waitSeconds up to 120 waits for completion; phase shows progress). cancel: request cancellation; the database outcome may remain unknown. Reuse the jobId; never rerun work to fetch results.",
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
    description: "detail:doctor inspects local tools (SQLcl, Java, Codex) without downloads; detail:project returns the read-only project snapshot (settings, connections, sync, jobs, deployments, grants). No database call.",
    readOnly: true
  }
];

// packages/core/src/service.ts
import path6 from "node:path";

// packages/core/src/doctor.ts
import path2 from "node:path";
async function doctor() {
  const state = await runtimeState();
  const java = process.env.APEXREST_JAVA_HOME ? path2.join(process.env.APEXREST_JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java") : state.java ?? "java";
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
            JAVA_HOME: path2.isAbsolute(java) ? path2.dirname(path2.dirname(java)) : process.env.JAVA_HOME
          }
        });
        return {
          command: exe,
          informational: exe === "codex",
          state: r.code === 0 ? "detected" : "unavailable",
          version: (r.stdout + r.stderr).trim().slice(0, 500)
        };
      } catch {
        return { command: exe, state: "missing", informational: exe === "codex" };
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
import path4 from "node:path";
import { stat as stat2, readFile as readFile4 } from "node:fs/promises";

// packages/core/src/reference-index.ts
var referenceWords = (text) => text.replace(/([a-z\d])([A-Z])/g, "$1 $2").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
function buildReferencePostings(entries) {
  const postings = /* @__PURE__ */ Object.create(null);
  entries.forEach((entry2, position) => {
    for (const word of new Set(referenceWords(entry2.id + " " + (entry2.title ?? "") + " " + entry2.text)))
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
function referenceQueryTerms(query) {
  const seen = /* @__PURE__ */ new Set();
  const terms = [];
  for (const stem of referenceStems(query)) {
    if (seen.has(stem)) continue;
    seen.add(stem);
    terms.push({ stem, alternatives: [[stem], ...aliases[stem] ?? []] });
    if (terms.length === 16) break;
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
function primaryCodeBlock(text, limit = 2500) {
  const lines = text.split("\n");
  const blocks = [];
  let open;
  for (const line of lines) {
    if (open) {
      const close = line.match(/^(\s*)(`{3,}|~{3,})\s*$/);
      if (close && close[1] === open.indent && close[2][0] === open.fence[0] && close[2].length >= open.fence.length) {
        blocks.push({ language: open.language, lines: open.lines });
        open = void 0;
      } else open.lines.push(line.startsWith(open.indent) ? line.slice(open.indent.length) : line);
      continue;
    }
    const start = line.match(/^(\s*)(`{3,}|~{3,})\s*([\w.+-]*)\s*$/);
    if (start) open = { indent: start[1], fence: start[2], language: start[3].toLowerCase(), lines: [] };
  }
  const chosen = blocks.find((block) => block.language === "apexlang") ?? blocks.find((block) => !block.language) ?? blocks.sort((a, b) => b.lines.join("\n").length - a.lines.join("\n").length)[0];
  if (!chosen) return null;
  const full = chosen.lines.join("\n");
  if (!full.trim()) return null;
  return boundCode({ language: chosen.language, text: full, truncated: false, length: full.length }, limit);
}
function boundCode(code2, limit) {
  if (code2.text.length <= limit) return code2;
  const cut = code2.text.lastIndexOf("\n", limit);
  return { ...code2, text: code2.text.slice(0, cut > limit / 2 ? cut : limit), truncated: true };
}
function codeWanted(include, offset, position) {
  return include === "code" || include !== "metadata" && offset === 0 && position === 0;
}
var CODE_LIMIT = 2500;
var SEARCH_LINKS = 3;
function fitResults(results, budget, size) {
  const halve = (hit, floor) => {
    const next = Math.floor(hit.text.length / 2);
    if (hit.text.length <= floor) return false;
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

// packages/core/src/reference-catalog.ts
import path3 from "node:path";
import { readFile as readFile3, realpath, stat } from "node:fs/promises";
var digest2 = external_exports.string().regex(/^[a-f0-9]{64}$/);
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
  sha256: digest2,
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
  indexSha256: digest2,
  files: external_exports.record(external_exports.string(), digest2),
  counts: external_exports.record(external_exports.string(), external_exports.unknown())
});
function createReferenceCatalog(definition) {
  function invalid(message) {
    throw new Fault(`${definition.faultPrefix}_CATALOG_INVALID`, message, 3);
  }
  function relativeFile(file) {
    if (!/^[A-Za-z0-9_./-]+$/.test(file) || path3.isAbsolute(file) || file.split("/").some((part) => !part || part === "." || part === ".."))
      invalid(`${definition.label} catalog contains an unsafe file path.`);
    return file;
  }
  async function containedFile(root, file) {
    const resolved = await realpath(path3.join(root, relativeFile(file)));
    const relative = path3.relative(root, resolved);
    if (!relative || relative.startsWith(".." + path3.sep) || relative === ".." || path3.isAbsolute(relative))
      invalid(`${definition.label} catalog file resolves outside its resource directory.`);
    return resolved;
  }
  async function stamp(file) {
    const info = await stat(file, { bigint: true });
    return `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
  }
  async function loadIndex(root, manifestFile, indexFile) {
    try {
      const manifest = manifestSchema.parse(JSON.parse(await readFile3(manifestFile, "utf8")));
      for (const file of Object.keys(manifest.files)) relativeFile(file);
      if (manifest.files["index.json"] !== manifest.indexSha256)
        invalid(`${definition.label} catalog manifest index hashes disagree.`);
      const raw = await readFile3(indexFile, "utf8");
      if (hash(raw) !== manifest.indexSha256)
        invalid(`${definition.label} catalog index checksum does not match its manifest.`);
      const entries = external_exports.array(entrySchema).parse(JSON.parse(raw));
      const byId = /* @__PURE__ */ new Map();
      const searchable = entries.map((entry2) => {
        if (!entry2.id.startsWith(definition.prefix))
          invalid(`${definition.label} catalog contains a reference ID with an invalid prefix.`);
        relativeFile(entry2.document);
        if (!entry2.document.startsWith(definition.documentDirectory + "/") || !entry2.document.endsWith(".md"))
          invalid(
            `${definition.label} documents must be Markdown files inside ${definition.documentDirectory}/.`
          );
        if (manifest.files[entry2.document] !== entry2.sha256)
          invalid(`${definition.label} document checksum is missing or disagrees with its manifest.`);
        if (byId.has(entry2.id)) invalid(`${definition.label} catalog contains duplicate reference IDs.`);
        byId.set(entry2.id, entry2);
        const titleStems = referenceStems(entry2.title);
        return {
          entry: entry2,
          stems: new Set(referenceStems(`${entry2.id} ${entry2.title} ${entry2.searchText}`)),
          titleText: " " + titleStems.join(" ") + " ",
          titleStems: new Set(titleStems),
          bodyText: void 0,
          code: void 0
        };
      });
      for (const entry2 of entries)
        for (const id of [...entry2.requires, ...entry2.related])
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
      root = await realpath(path3.join(resourceRoot(), definition.directory));
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
  const bytes = (value) => Buffer.byteLength(JSON.stringify(sanitized(value)), "utf8");
  function metadata(entry2) {
    return {
      id: entry2.id,
      title: entry2.title,
      kind: entry2.kind,
      family: entry2.family,
      version: entry2.version,
      source: entry2.source,
      readiness: entry2.readiness,
      compatibility: entry2.compatibility,
      classification: definition.classification
    };
  }
  function links(entry2, count, byId, resolved) {
    const link = (id) => {
      const target = byId.get(id);
      return { id, title: target?.title ?? null, kind: target?.kind ?? null };
    };
    return {
      requires: entry2.requires.slice(0, count),
      requiresReferences: entry2.requires.slice(0, resolved).map(link),
      requiresCount: entry2.requires.length,
      requiresOmittedCount: Math.max(0, entry2.requires.length - count),
      related: entry2.related.slice(0, count),
      relatedReferences: entry2.related.slice(0, resolved).map(link),
      relatedCount: entry2.related.length,
      relatedOmittedCount: Math.max(0, entry2.related.length - count)
    };
  }
  async function verifiedDocument(root, entry2) {
    const raw = await readFile3(await containedFile(root, entry2.document), "utf8");
    if (hash(raw) !== entry2.sha256)
      invalid(`${definition.label} document checksum does not match the catalog.`);
    if (entry2.length !== void 0 && entry2.length !== raw.length)
      invalid(`${definition.label} document length does not match the catalog.`);
    return raw;
  }
  function window(text, start, length) {
    let end = Math.min(text.length, start + length);
    if (end > start && /[\uD800-\uDBFF]/.test(text[end - 1]) && /[\uDC00-\uDFFF]/.test(text[end] ?? ""))
      end += end - start === 1 ? 1 : -1;
    return text.slice(start, end);
  }
  async function search(query, version, options = {}) {
    const terms = referenceQueryTerms(query);
    if (!terms.length) return [];
    const index = await catalogIndex();
    const phrase = queryPhrase(terms);
    const navigational = navigationalQuery(query);
    const exactId = query.trim();
    const identifier2 = identifierQuery(query);
    const ranked = index.searchable.filter(
      ({ entry: entry2 }) => entry2.id === exactId || (!version || entry2.version === version || !version.includes("@") && entry2.version.split("@")[0] === version) && (!options.kind || entry2.kind === options.kind) && (!options.family || entry2.family === options.family || entry2.family.startsWith(options.family + "/")) && // Unresolved records have no usable recipe; they stay discoverable on request.
      (options.includeUnresolved || entry2.readiness !== "unresolved")
    ).map((candidate) => ({
      entry: candidate.entry,
      score: scoreReference({
        terms,
        phrase,
        navigational,
        exact: candidate.entry.id === exactId,
        matched: terms.filter(
          (term) => term.alternatives.some((alternative) => alternative.every((stem) => candidate.stems.has(stem)))
        ).length,
        titleText: candidate.titleText,
        titleStems: candidate.titleStems,
        titleWeight: 2e3,
        bodyText: () => candidate.bodyText ??= stemmedReference(candidate.entry.searchText),
        // Ready recipes first; parameter contracts for property-name lookups.
        prior: (candidate.entry.readiness === "ready" ? 10 : 0) + (candidate.entry.kind === "template" ? 10 : 0) + (candidate.entry.kind === "contract" ? 5 + (identifier2 ? 100 : 0) : 0),
        routing: false,
        canonical: canonicalReference(candidate.entry.id),
        length: candidate.entry.searchText.length
      })
    })).filter((hit) => hit.score !== null).sort((a, b) => b.score - a.score || (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0));
    const offset = Math.max(0, options.offset ?? 0), limit = Math.max(1, Math.min(8, options.limit ?? 3));
    const words = referenceTerms(query);
    const candidates = [];
    for (const [i, { entry: entry2 }] of ranked.slice(offset, offset + limit).entries()) {
      const first = words.map((term) => entry2.searchText.toLowerCase().indexOf(term)).filter((n) => n >= 0);
      const matchOffset = first.length ? Math.min(...first) : null;
      let snippetOffset = Math.max(0, (matchOffset ?? 0) - 80);
      if (snippetOffset && /[\uDC00-\uDFFF]/.test(entry2.searchText[snippetOffset] ?? "") && /[\uD800-\uDBFF]/.test(entry2.searchText[snippetOffset - 1] ?? ""))
        snippetOffset--;
      const text = window(entry2.searchText, snippetOffset, 600);
      const code2 = codeWanted(options.include, offset, i) ? await documentCode(index, entry2) : void 0;
      candidates.push({
        ...metadata(entry2),
        ...links(entry2, 2, index.byId, SEARCH_LINKS),
        text,
        ...code2 ? { code: code2 } : {},
        // Index summaries are intentionally independent of documents; read a result at offset 0.
        snippetSource: "index",
        readOffset: 0,
        offset: snippetOffset,
        matchOffset,
        length: entry2.searchText.length,
        nextOffset: null,
        totalMatches: ranked.length,
        nextResultOffset: null
      });
    }
    fitResults(candidates, 7e3, bytes);
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
  async function documentCode(index, entry2) {
    const candidate = index.searchable.find((item2) => item2.entry === entry2);
    if (candidate.code === void 0) {
      try {
        candidate.code = primaryCodeBlock(redact(await verifiedDocument(index.root, entry2)), CODE_LIMIT);
      } catch {
        candidate.code = null;
      }
    }
    return candidate.code ? boundCode(candidate.code, CODE_LIMIT) : void 0;
  }
  async function read(id, offset, limit) {
    const index = await catalogIndex();
    const entry2 = index.byId.get(id);
    if (!entry2)
      throw new Fault(
        "REFERENCE_NOT_FOUND",
        `No registered ${definition.label.toLowerCase()} reference with this ID.`,
        2
      );
    let raw;
    try {
      raw = await verifiedDocument(index.root, entry2);
    } catch (error) {
      if (error instanceof Fault) throw error;
      invalid(`${definition.label} document cannot be read.`);
    }
    const navigation = "\n\n## Catalog navigation\n\n" + entry2.requires.map((target) => `- requires: ${target}
`).join("") + entry2.related.map((target) => `- related: ${target}
`).join("");
    const safeRaw = redact(raw);
    const document = safeRaw + redact(navigation);
    const start = Math.max(0, offset);
    let count = Math.max(1, Math.min(8192, limit));
    const create = () => artifactPage(document, "text", id, start, count, {
      ...metadata(entry2),
      ...links(entry2, 16, index.byId, 16),
      length: document.length,
      documentLength: safeRaw.length,
      sourceDocumentLength: raw.length,
      contentSanitized: true,
      navigationOffset: safeRaw.length,
      sha256: entry2.sha256
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
    text: "Use an explicit environment. Plans bind source hashes and target identity. Recheck drift, acquire local coordination and create an export backup before writes. Clean APEX deployment needs no service tables. Local runners must share one managed home; independent machines need external serialization. DDL cannot be generally rolled back. Interrupted writes require reconciliation. Production requires an external approval boundary."
  }
];
function versionMatches(actual, requested) {
  if (!requested) return true;
  return actual === requested || !requested.includes("@") && actual.split("@")[0] === requested;
}
function indexReferences(upstream, file, digest3) {
  const entries = [...references, ...upstream];
  const byId = /* @__PURE__ */ new Map();
  const bySymbol = /* @__PURE__ */ new Map();
  const positionById = /* @__PURE__ */ new Map();
  const searchable = entries.map((reference, position) => {
    if (!byId.has(reference.id)) {
      byId.set(reference.id, reference);
      positionById.set(reference.id, position);
    }
    const symbol = reference.text.match(/^<([^>\n]+)>\s*::=/)?.[1];
    if (symbol) bySymbol.set(symbol, reference.id);
    const title = reference.title ?? symbol ?? reference.id;
    return {
      reference,
      title,
      // Title stems, routing/canonical flags and normalized bodies are derived on first use.
      titleText: void 0,
      titleStems: void 0,
      routing: void 0,
      canonical: void 0,
      lower: void 0,
      bodyText: void 0,
      code: void 0
    };
  });
  let pendingPostings;
  const postings = () => pendingPostings ??= (async () => {
    if (file) {
      try {
        const prebuilt = await readJson(path4.join(path4.dirname(file), "search.json"));
        if (prebuilt && prebuilt.schemaVersion === 1 && prebuilt.indexSha256 === digest3 && prebuilt.postings && Object.values(prebuilt.postings).every(
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
  let stemWords;
  const stemSets = /* @__PURE__ */ new Map();
  const positionsForStem = async (stem) => {
    let set = stemSets.get(stem);
    if (set) return set;
    const lists = await postings();
    if (!stemWords) {
      stemWords = /* @__PURE__ */ new Map();
      for (const word of Object.keys(lists)) {
        const key = referenceStem(word);
        const group2 = stemWords.get(key);
        if (group2) group2.push(word);
        else stemWords.set(key, [word]);
      }
    }
    set = /* @__PURE__ */ new Set();
    for (const word of stemWords.get(stem) ?? []) for (const position of lists[word] ?? []) set.add(position);
    stemSets.set(stem, set);
    return set;
  };
  const link = (id) => {
    const position = positionById.get(id);
    const entry2 = position === void 0 ? void 0 : searchable[position];
    return { id, title: entry2?.title ?? null, kind: entry2?.reference.kind ?? null };
  };
  return {
    upstream,
    byId,
    bySymbol,
    positionById,
    searchable,
    postings,
    positionsForStem,
    link,
    queries: /* @__PURE__ */ new Map()
  };
}
var cached;
async function referenceIndex() {
  const file = path4.join(resourceRoot(), "references/index.json");
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
  const pending = readFile4(file, "utf8").then(
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
function snippet(text, lower, query, terms) {
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
  const terms = referenceQueryTerms(query);
  if (!terms.length) return [];
  const index = await referenceIndex();
  const key = JSON.stringify([query.trim(), version, options.kind, options.family]);
  let ranked = index.queries.get(key);
  if (!ranked) {
    const total = index.searchable.length;
    const counts = new Uint8Array(total);
    for (const term of terms) {
      const positions = /* @__PURE__ */ new Set();
      for (const alternative of term.alternatives) {
        const sets = [];
        for (const stem of alternative) sets.push(await index.positionsForStem(stem));
        sets.sort((a, b) => a.size - b.size);
        for (const position of sets[0]) if (sets.every((set) => set.has(position))) positions.add(position);
      }
      for (const position of positions) counts[position]++;
    }
    const phrase = queryPhrase(terms);
    const navigational = navigationalQuery(query);
    const identifier2 = identifierQuery(query);
    const symbolic = identifier2 || options.kind === "grammar" || query.trim().startsWith("grammar:");
    const exactId = index.byId.get(query.trim()) ?? (symbolic ? index.byId.get(index.bySymbol.get(query.trim().replace(/^grammar:/, "")) ?? "") : void 0);
    const quotedQuery = '"' + query.trim() + '"';
    const quotable = identifier2 || options.kind === "grammar";
    const scoreAt = (position, final2) => {
      const entry2 = index.searchable[position];
      const { reference } = entry2;
      const kind = reference.kind;
      if (!entry2.titleStems) {
        const titleStems = referenceStems(entry2.title);
        entry2.titleText = " " + titleStems.join(" ") + " ";
        entry2.titleStems = new Set(titleStems);
        entry2.routing = routingReference(reference.id, entry2.title);
        entry2.canonical = canonicalReference(reference.id);
      }
      return scoreReference({
        terms,
        phrase,
        navigational,
        exact: reference === exactId,
        matched: counts[position],
        titleText: entry2.titleText,
        titleStems: entry2.titleStems,
        // A production name wins outright; in prose queries the template of that family does.
        titleWeight: kind === "grammar" && !identifier2 && options.kind !== "grammar" ? 150 : 2e3,
        // Prefer concrete templates, then the owning contract; grammar wrappers and incidental
        // productions rank below unless a production or property name is being looked up.
        prior: kind === "template" ? 100 : kind === "contract" ? 5 + (identifier2 ? 100 : 0) : kind === "grammar" ? (identifier2 || options.kind === "grammar" ? 0 : -40) + (entry2.title.endsWith("-line") ? -20 : 0) : 0,
        routing: entry2.routing,
        canonical: entry2.canonical,
        length: reference.text.length,
        // A quoted token marks the production that defines a property or keyword.
        quoted: quotable && reference.text.includes(quotedQuery),
        bodyText: final2 ? () => entry2.bodyText ??= stemmedReference(reference.text) : void 0
      });
    };
    const first = [];
    const half = terms.length / 2;
    for (let position = 0; position < total; position++) {
      const r = index.searchable[position].reference;
      if (counts[position] < half && r !== exactId) continue;
      if (!versionMatches(r.version, version) || options.kind && r.kind !== options.kind || options.family && r.family !== options.family && !r.family?.startsWith(options.family + "/"))
        continue;
      const score = scoreAt(position, false);
      if (score !== null) first.push({ position, score });
    }
    first.sort((a, b) => b.score - a.score || a.position - b.position);
    let pool = 0;
    if (terms.length > 1) {
      let budget = 8e5;
      for (const { position } of first) {
        const full = counts[position] === terms.length;
        budget -= index.searchable[position].reference.text.length;
        if (pool >= 400 || budget < 0 && pool >= 60 || !full && pool >= 120) break;
        pool++;
      }
    }
    const final = first.slice(0, pool).map(({ position }) => ({ position, score: scoreAt(position, true) })).sort((a, b) => b.score - a.score || a.position - b.position);
    ranked = [...final, ...first.slice(pool)].map(({ position }) => position);
    if (index.queries.size >= 64) index.queries.delete(index.queries.keys().next().value);
    index.queries.set(key, ranked);
  }
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 3;
  const link = index.link;
  const words = referenceTerms(query);
  const results = ranked.slice(offset, offset + limit).map((position, i) => {
    const entry2 = index.searchable[position];
    const { reference: r, title } = entry2;
    const requires = r.requires ?? [];
    const related = r.related ?? [];
    const code2 = codeWanted(options.include, offset, i) ? entry2.code ??= r.kind === "grammar" ? null : primaryCodeBlock(r.text, CODE_LIMIT) : void 0;
    return {
      id: r.id,
      title,
      version: r.version,
      source: r.source,
      kind: r.kind ?? "guide",
      family: r.family ?? "workflow",
      ...snippet(r.text, entry2.lower ??= r.text.toLowerCase(), query, words),
      ...code2 ? { code: boundCode(code2, CODE_LIMIT) } : {},
      requires,
      requiresReferences: requires.slice(0, SEARCH_LINKS).map(link),
      requiresCount: requires.length,
      relatedReferences: related.slice(0, SEARCH_LINKS).map(link),
      relatedCount: related.length,
      totalMatches: ranked.length,
      nextResultOffset: offset + limit < ranked.length ? offset + limit : null
    };
  });
  return fitResults(results, Math.min(16e3, 2500 * limit), (page2) => JSON.stringify(page2).length);
}
async function referenceRead(id, offset, limit, project2) {
  if (id.startsWith("block:") || id.startsWith("blueprint:")) return catalogRead(id, offset, limit, project2);
  if (id.startsWith("component:")) return componentRead(id, offset, limit);
  if (id.startsWith("pattern:")) return patternRead(id, offset, limit);
  const index = await referenceIndex();
  const item2 = index.byId.get(id) ?? index.byId.get(index.bySymbol.get(id.replace(/^grammar:/, "")) ?? "");
  if (!item2)
    throw new Fault("REFERENCE_NOT_FOUND", "No registered reference with this ID or grammar symbol.", 2);
  const content = item2.text.slice(offset, offset + limit);
  const symbols = [...content.matchAll(/<([^>\n]+)>/g)].map((match2) => index.bySymbol.get(match2[1]));
  const related = [
    ...new Set(
      [...item2.related ?? [], ...symbols].filter(
        (target) => Boolean(target) && target !== item2.id
      )
    )
  ];
  const link = index.link;
  const requires = item2.requires ?? [];
  return {
    id: item2.id,
    title: index.link(item2.id).title ?? item2.id,
    version: item2.version,
    source: item2.source,
    kind: item2.kind ?? "guide",
    content,
    offset,
    length: item2.text.length,
    nextOffset: offset + limit < item2.text.length ? offset + limit : null,
    requires,
    requiresReferences: requires.slice(0, 16).map(link),
    related: related.slice(0, 16),
    // Grammar productions resolve to their names so a relation can be followed without a read.
    relatedReferences: related.slice(0, 16).map(link),
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
  const destination = path4.join(managedHome(), "references", version + ".json");
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

// packages/core/src/panel.ts
import path5 from "node:path";
import { readdir as readdir2, realpath as realpath2, stat as stat3 } from "node:fs/promises";
var safe = (value) => sanitized(value);
var historyLimit = 2e3;
var PanelService = class {
  constructor(root) {
    this.root = root;
  }
  root;
  async preferences() {
    return browserPreferences(this.root);
  }
  async records(folder) {
    const base2 = await contained(this.root, ".apexrest/" + folder);
    if (!await exists(base2)) return { rows: [], omitted: 0 };
    let entries = (await readdir2(base2, { withFileTypes: true })).filter(
      (e) => e.isDirectory() && external_exports.uuid().safeParse(e.name).success
    );
    let omitted = 0;
    if (entries.length > historyLimit) {
      const dated = await Promise.all(
        entries.map(async (entry2) => ({
          entry: entry2,
          at: (await stat3(path5.join(base2, entry2.name)).catch(() => null))?.mtimeMs ?? 0
        }))
      );
      omitted = entries.length - historyLimit;
      entries = dated.sort((a, b) => b.at - a.at).slice(0, historyLimit).map((d) => d.entry);
    }
    const files = await Promise.all(
      entries.map(async (entry2) => {
        const file = await contained(base2, entry2.name + "/state.json");
        const info = await stat3(file).catch(() => null);
        return { id: entry2.name, file, at: info?.mtimeMs ?? 0, size: info?.size ?? 0 };
      })
    );
    const rows = await Promise.all(
      files.filter((f) => f.size > 0).sort((a, b) => b.at - a.at).slice(0, 12).map(async (f) => {
        if (f.size > 2 * 1024 * 1024)
          return {
            id: f.id,
            status: "unavailable",
            diagnostics: ["Record exceeds the status limit."]
          };
        try {
          return { ...await readJson(f.file), id: f.id };
        } catch {
          return {
            id: f.id,
            status: "unavailable",
            diagnostics: ["Cannot read this operation record."]
          };
        }
      })
    );
    return { rows, omitted };
  }
  async snapshot() {
    this.root = await realpath2(this.root);
    const ctx = await loadProject(this.root).catch((error) => {
      if (error instanceof Fault && error.code === "PROJECT_NOT_CONFIGURED") return null;
      throw error;
    });
    const [prefs, sqlcl, refs, security, jobRecords, deploymentRecords] = await Promise.all([
      this.preferences(),
      sqlclConfig(),
      connections(),
      policy(),
      this.records("jobs"),
      this.records("deployments")
    ]);
    const jobs = await Promise.all(
      jobRecords.rows.map(async (row) => {
        let state = row;
        if (ctx)
          try {
            state = await new JobService(ctx).status(String(row.id));
          } catch {
            state = {
              ...row,
              status: "unavailable",
              diagnostics: ["Cannot read this job status."]
            };
          }
        const result = state.result ?? {};
        const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : Array.isArray(state.diagnostics) ? state.diagnostics : [];
        return {
          id: String(row.id),
          operation: String(row.operation ?? result.operation ?? "operation"),
          status: String(result.status ?? state.status),
          updatedAt: String(state.updatedAt ?? ""),
          summary: String(result.summary ?? "").slice(0, 1e3),
          diagnostics: diagnostics.slice(0, 5),
          artifacts: Array.isArray(result.artifacts) ? result.artifacts.slice(0, 10) : []
        };
      })
    );
    const deployments = deploymentRecords.rows.map((row) => ({
      id: String(row.id),
      status: String(row.state ?? "unknown"),
      at: String(row.at ?? ""),
      details: JSON.stringify(safe(row.details ?? {})).slice(0, 1200)
    }));
    let changes = { status: "unavailable", files: [] };
    try {
      const git = await runProcess({
        executable: "git",
        args: [
          "-c",
          "core.fsmonitor=false",
          "-c",
          "core.untrackedCache=false",
          "status",
          "--porcelain=v1",
          "--untracked-files=normal"
        ],
        cwd: this.root,
        timeoutMs: 3e3
      });
      if (git.code === 0)
        changes = { status: "available", files: git.stdout.split("\n").filter(Boolean).slice(0, 80) };
    } catch {
    }
    let toolchain = null;
    if (ctx) {
      const file = await contained(this.root, ctx.config.toolchain.lockFile);
      if (await exists(file)) {
        if ((await stat3(file)).size <= 128e3) toolchain = { digest: hash(canonical(await readJson(file))) };
      }
    }
    const sync = ctx ? await Promise.all(
      Object.entries(ctx.config.environments).map(async ([name, env2]) => {
        try {
          return { environment: name, ...await new SyncStore(ctx, env2, name).status() };
        } catch (error) {
          return {
            environment: name,
            status: "blocked",
            blocked: true,
            blockedReason: error instanceof Fault ? error.code : "SYNC_STATE_INVALID",
            serverFreshness: "not-checked"
          };
        }
      })
    ) : [];
    return safe({
      sync,
      version: VERSION,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      project: this.root,
      configured: !!ctx,
      trusted: security.trustedProjects.includes(this.root),
      configuration: ctx?.config ?? null,
      sqlcl,
      preferences: prefs,
      connections: refs,
      toolchain,
      jobs,
      deployments,
      history: { jobsOmitted: jobRecords.omitted, deploymentsOmitted: deploymentRecords.omitted },
      changes,
      permissions: {
        activeGrants: security.grants.filter((g) => g.projectRoot === this.root && Date.parse(g.expiresAt) > Date.now()).map((g) => ({ operations: g.operations, expiresAt: g.expiresAt, exactPlan: !!g.planDigest }))
      }
    });
  }
};

// packages/core/src/ship.ts
var compilerFaults = /* @__PURE__ */ new Set(["ORACLE_COMMAND_FAILED", "VALIDATION_UNCONFIRMED", "VALIDATION_FAILED"]);
function fallbackCompilerDiagnostics(output) {
  const entries = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.replace(/\x1b\[[0-9;]*m/g, "").trim();
    if (!line || !/\b(?:error|warning|ORA-\d+|PLS-\d+)\b/i.test(line)) continue;
    if (/^\d+\s+(?:errors?|warnings?)\b|validation (?:failed|completed)/i.test(line)) continue;
    const entry2 = {
      severity: /\bwarning\b/i.test(line) && !/\berror\b/i.test(line) ? "warning" : "error",
      message: line.slice(0, 2e3)
    };
    const file = /([\w./-]+\.apx)\b/.exec(line)?.[1];
    if (file) entry2.file = file;
    const position = /(?:line\s+(\d+)(?:[,\s]+col(?:umn)?\s+(\d+))?)|\.apx:(\d+)(?::(\d+))?/i.exec(line);
    if (position) {
      const l = position[1] ?? position[3], c = position[2] ?? position[4];
      if (l) entry2.line = Number(l);
      if (c) entry2.column = Number(c);
    }
    entries.push(entry2);
  }
  return entries;
}
function compilerFault(error, parseDiagnostics2) {
  if (!(error instanceof Fault) || !compilerFaults.has(error.code)) return error;
  const recorded = Array.isArray(error.details?.diagnostics) ? error.details.diagnostics : [];
  const diagnostics = recorded.length ? recorded : parseDiagnostics2(error.message);
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
async function validateApplication(oracle, source2, parseDiagnostics2, signal) {
  const started = Date.now();
  let validated;
  try {
    validated = await oracle.validate(source2, signal);
  } catch (error) {
    throw compilerFault(error, parseDiagnostics2);
  }
  const { output, mmd: _mmd, ...rest } = validated;
  const warnings = parseDiagnostics2(output).filter((d) => d.severity === "warning");
  return {
    ...rest,
    diagnostics: warnings.slice(0, 50),
    warningCount: warnings.length,
    ms: Date.now() - started,
    output: output.length > 4e3 ? output.slice(0, 4e3) : output,
    outputTruncated: output.length > 4e3
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
function planPreview(ctx, plan) {
  return {
    planId: plan.id,
    planDigest: plan.digest,
    environment: plan.environment,
    targetDigest: plan.targetDigest,
    planMode: plan.schemaVersion === 1 ? "full-export" : plan.mode,
    backupRequired: plan.backupRequired,
    compiler: plan.compiler,
    createdAt: plan.createdAt,
    expiresAt: plan.expiresAt,
    risks: plan.risks,
    approval: plan.approval,
    sources: sourceCounts(ctx, plan),
    target: JSON.stringify(plan.target).length <= 1200 ? plan.target : { omitted: true }
  };
}
function applicationLink(ctx, name) {
  const env2 = environment(ctx, name);
  return {
    id: env2.applicationId,
    alias: ctx.config.application.alias,
    workspace: env2.workspace,
    url: new URL(`f?p=${env2.applicationId}`, env2.baseUrl).toString()
  };
}
async function shipPlan(ctx, name, deployment, parseDiagnostics2, progress) {
  await reconcileShipGrants();
  const started = Date.now();
  progress?.("validating");
  let plan;
  try {
    plan = await deployment.plan(ctx, name);
  } catch (error) {
    throw compilerFault(error, parseDiagnostics2);
  }
  const planPath = ".apexrest/plans/ship-" + plan.id + ".json";
  await writeJson(await contained(ctx.root, planPath), plan);
  const phases = [{ phase: "planning", ms: Date.now() - started }];
  return { plan, planPath, phases, preview: planPreview(ctx, plan) };
}
var phaseFor = {
  backing_up: "backing_up",
  migrating: "migrating",
  importing: "importing",
  verifying: "verifying",
  testing: "testing"
};
function shipGrant(ctx, plan, userRequest) {
  return {
    projectRoot: ctx.root,
    targetDigest: plan.targetDigest,
    planDigest: plan.digest,
    expiresAt: new Date(Math.min(Date.parse(plan.expiresAt), Date.now() + 10 * 60 * 1e3)).toISOString(),
    workerPid: process.pid,
    operations: ["deploy"],
    note: userRequest.slice(0, 2e3),
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
async function checkShipTarget(ctx, plan) {
  const env2 = environment(ctx, plan.environment);
  if (await isProductionTarget(env2, plan.targetDigest))
    throw new Fault(
      "PRODUCTION_CI_REQUIRED",
      "Production requires a protected CI runner and externally signed approval bound to this plan.",
      4,
      "blocked"
    );
  if (plan.risks.some((r) => r !== "application-restore"))
    throw new Fault(
      "RECOVERY_REVIEW_REQUIRED",
      "Destructive, authentication or unsupported changes need an explicit recovery implementation and reviewed external workflow.",
      4,
      "blocked",
      { nextActions: plan.risks.map((r) => "Review risk: " + r) }
    );
  if (ctx.config.tests.requiredSuites.some((suite) => suite !== "unit")) {
    try {
      await new TestService().authorize(ctx, plan.environment);
    } catch (error) {
      throw new Fault(
        "TEST_APPROVAL_REQUIRED",
        "Required remote suites need existing test authorization and a mutation-allowed environment before shipping.",
        4,
        "blocked",
        { reason: error instanceof Fault ? error.code : "TEST_AUTHORIZATION_FAILED" }
      );
    }
  }
  return env2;
}
async function shipApply(ctx, planValue, userRequest, deployment, lastTests, signal, progress) {
  const plan = parse(deployPlanSchema, planValue);
  await checkShipTarget(ctx, plan);
  await reconcileShipGrants();
  const phases = [];
  let current;
  const mark = (phase) => {
    if (current) phases.push({ phase: current.phase, ms: Date.now() - current.at });
    current = { phase, at: Date.now() };
    progress?.(phase);
  };
  const grant = shipGrant(ctx, plan, userRequest);
  await updatePolicy((p) => ({ ...p, grants: [...p.grants.filter((g) => !ownGrant(ctx, plan)(g)), grant] }));
  let grantRemoved = false;
  let applied;
  try {
    mark("backing_up");
    applied = await deployment.apply(ctx, plan, signal, (state) => {
      const phase = phaseFor[state];
      if (phase && phase !== current?.phase) mark(phase);
    });
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
  const tests = lastTests();
  return {
    status: "succeeded",
    runId: applied.runId,
    planId: plan.id,
    planDigest: plan.digest,
    environment: plan.environment,
    application: applicationLink(ctx, plan.environment),
    sources: sourceCounts(ctx, plan),
    phases,
    verification: { identity: "confirmed", state: applied.state, directory: applied.directory },
    tests: tests ?? (ctx.config.tests.requiredSuites.length ? null : "no-required-suites"),
    grant: { recorded: true, removed: grantRemoved, expiresAt: grant.expiresAt, planDigest: plan.digest },
    nextActions: grantRemoved ? ["Verify the affected pages in the selected browser with apexrest_browser_open."] : ["Remove the stale ship grant from APEXREST_HOME/policy.json before the next deployment."]
  };
}

// packages/core/src/service.ts
var engine = oracle_exports;
var parseDiagnostics = (output) => (engine.parseCompilerDiagnostics ?? fallbackCompilerDiagnostics)(output);
async function sharedOracle() {
  return new OracleAdapter();
}
async function shutdownOracle() {
  const close = engine.closeSqlclSessions ?? (await import("./chunk-BVPAS3TD.mjs").then(
    (m) => m,
    () => ({})
  )).closeSqlclSessions;
  await close?.().catch(() => void 0);
}
function routeProject(parsed) {
  const action = parsed.action;
  const pick = (...keys) => Object.fromEntries(keys.filter((k) => parsed[k] !== void 0).map((k) => [k, parsed[k]]));
  switch (action) {
    case "init":
      return { operation: "project.init", input: pick("project", "directory", "template", "alias") };
    case "adopt":
      return { operation: "project.adopt", input: pick("project", "env", "appId", "workingCopy") };
    case "inspect":
      return { operation: "project.inspect", input: pick("project", "detail") };
    case "connection_add":
      return {
        operation: "connection.add",
        input: pick("project", "name", "sqlclName", "ordsUrl", "ordsUsername", "passwordFile")
      };
    case "connection_list":
      return { operation: "connection.list", input: pick("project", "saved") };
    default:
      return { operation: "connection.test", input: pick("project", "name", "saved") };
  }
}
function routeReference(parsed) {
  const { mode, query, id, limit, offset, ...rest } = parsed;
  if (mode === "read") {
    if (typeof id !== "string") throw new Fault("INVALID_INPUT", "id: required for mode read", 2);
    return {
      operation: "docs.read",
      input: { project: rest.project, id, offset, ...limit ? { limit } : {} }
    };
  }
  if (typeof query !== "string") throw new Fault("INVALID_INPUT", "query: required for mode search", 2);
  if (typeof limit === "number" && limit > 8)
    throw new Fault("INVALID_INPUT", "limit: search returns at most 8 hits per page", 2);
  if (typeof offset === "number" && offset > 1e4)
    throw new Fault("INVALID_INPUT", "offset: search offsets are at most 10000", 2);
  return { operation: "docs.search", input: { ...rest, query, offset, ...limit ? { limit } : {} } };
}
async function dispatch(operation, input = {}, signal, progress) {
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
    if (operation === "project" || operation === "reference") {
      const route = operation === "project" ? routeProject(parsed) : routeReference(parsed);
      return { ...await dispatch(route.operation, route.input, signal, progress), operation };
    }
    if (operation === "job") {
      const result = await dispatch(
        parsed.action === "cancel" ? "jobs.cancel" : "jobs.status",
        {
          project: parsed.project,
          id: parsed.jobId,
          ...parsed.action === "cancel" ? {} : { waitSeconds: parsed.waitSeconds }
        },
        signal
      );
      return { ...result, operation };
    }
    if (operation === "status") {
      const result = await dispatch(
        parsed.detail === "doctor" ? "doctor" : "panel.status",
        { project: parsed.project },
        signal
      );
      return { ...result, operation };
    }
    const oracle = await sharedOracle(), tests = new TestService(oracle), testReports = [], deployment = new DeploymentService(oracle, async (ctx, env2) => {
      const report = await tests.all(ctx, env2);
      testReports.push(report.data);
      return report;
    });
    let data;
    switch (operation) {
      case "panel.status":
        data = await new PanelService(root).snapshot();
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
        const { ToolchainService } = await import("./chunk-GC3MAZ24.mjs");
        data = await new ToolchainService().apply(parsed);
        break;
      }
      case "dependencies.uninstall": {
        const { uninstallTools } = await import("./chunk-HZLFNU52.mjs");
        data = await uninstallTools(parsed);
        break;
      }
      case "setup":
      case "plugin.install":
      case "plugin.update": {
        const { setup: setup2 } = await import("./chunk-BJ4LLJ3O.mjs");
        data = await setup2(parsed);
        break;
      }
      case "plugin.validate": {
        const { validateNative } = await import("./chunk-BJ4LLJ3O.mjs");
        data = await validateNative(text("from"));
        break;
      }
      case "plugin.uninstall": {
        const { uninstallNative } = await import("./chunk-BJ4LLJ3O.mjs");
        data = await uninstallNative(text("home") ?? managedHome(), Boolean(parsed.keepRuntime), {
          ...text("codex") ? { codex: text("codex") } : {}
        });
        break;
      }
      case "project.init":
        data = await projectInit(
          text("directory"),
          text("template"),
          text("alias") ?? path6.basename(path6.resolve(text("directory"))).toLowerCase().replace(/[^a-z0-9-]/g, "-")
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
            await requireTrust(ctx.root);
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
            data = await validateApplication(
              oracle,
              await contained(ctx.root, ctx.config.application.sourceDir),
              parseDiagnostics,
              signal
            );
            break;
          case "ship": {
            const planned = await shipPlan(ctx, text("env"), deployment, parseDiagnostics, progress);
            if (parsed.mode !== "apply") {
              data = {
                mode: "plan",
                status: "planned",
                ...planned.preview,
                planPath: planned.planPath,
                phases: planned.phases
              };
              break;
            }
            const applied = await shipApply(
              ctx,
              planned.plan,
              text("userRequest"),
              deployment,
              () => testReports.at(-1),
              signal,
              progress
            );
            data = {
              mode: "apply",
              ...applied,
              planPath: planned.planPath,
              phases: [...planned.phases, ...applied.phases]
            };
            break;
          }
          case "ship.apply":
            data = await shipApply(
              ctx,
              await readJson(await contained(ctx.root, text("plan"))),
              text("userRequest"),
              deployment,
              () => testReports.at(-1),
              signal,
              progress
            );
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
            await requireTrust(ctx.root);
            data = await deployment.reconcile(ctx, text("run"));
            break;
          case "deploy.restore-plan": {
            await requireTrust(ctx.root);
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
            const { openVerificationBrowser } = await import("./chunk-GU4CMR2T.mjs");
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
  JobService,
  settleInlineJobs,
  failQueuedJob,
  executeJob,
  schemas,
  internalOperations,
  toolCatalog,
  shutdownOracle,
  dispatch
};
