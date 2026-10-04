import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  ArtifactService,
  OWNED_TEXT_LIMIT,
  SyncStore,
  assessPlan,
  blueprintSchema,
  browserPreferences,
  browserPreferencesSchema,
  canonical,
  catalogRead,
  catalogSearch,
  digest,
  documentText,
  freeze,
  instanceSchema,
  journal,
  loadCatalog,
  materialize,
  openVerificationBrowser,
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
} from "./chunk-JBCN5WYI.mjs";
import {
  VERSION
} from "./chunk-G3KR57BY.mjs";
import {
  OracleAdapter,
  configureConnection,
  configureSqlcl,
  connections,
  environment,
  external_exports,
  identifier,
  loadProject,
  ordsUrl,
  ordsUsername,
  parse,
  policy,
  refName,
  relativePath,
  requireTrust,
  resolveConnection,
  runProcess,
  savedConnectionName,
  sqlclConfig,
  sqlclConfigSchema
} from "./chunk-MU6I3KRM.mjs";
import {
  Fault,
  atomicWrite,
  contained,
  exists,
  failure,
  hash,
  inventory,
  readJson,
  sanitized,
  withLock,
  writeJson
} from "./chunk-OX4ZKXO7.mjs";

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
async function metadataRead(adapter, env, connection, value) {
  const input = parse(external_exports.union([metadataRequest, metadataBatchRequest]), value);
  const batch = "requests" in input;
  const requests = batch ? input.requests : [input];
  for (const r of requests) {
    if (r.schema !== env.parsingSchema)
      throw new Fault("SCHEMA_DENIED", "Metadata is restricted to the configured parsing schema.", 4);
    if (["columns", "constraints", "constraint-columns", "signatures"].includes(r.kind) && !r.name)
      throw new Fault("OBJECT_REQUIRED", "Select a specific object first.", 2);
  }
  await adapter.verifyTarget(env, connection);
  const read = async (r) => {
    const rows = await adapter.jsonQuery(
      queries[r.kind] + " offset :p_offset rows fetch next :p_limit rows only",
      connection,
      {
        p_owner: r.schema,
        p_name: r.name ?? "",
        p_app_id: env.applicationId,
        p_workspace: env.workspace,
        p_offset: r.offset,
        p_limit: r.limit
      }
    );
    return {
      dataClassification: "untrusted_database_content",
      rows,
      offset: r.offset,
      nextOffset: rows.length === r.limit ? r.offset + r.limit : null
    };
  };
  if (!batch) return read(input);
  const results = [];
  for (const [index, r] of requests.entries())
    results.push({ index, kind: r.kind, ...r.name ? { name: r.name } : {}, ...await read(r) });
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
function threeWay(base, local, next) {
  if (local === base) return next;
  if (next === base || local === next) return local;
  const variants = [base, local, next], roots = variants.map(declarations);
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
  return mergeLines(base, local, next);
}
function mergeLines(base, local, next) {
  if (local === base) return next;
  if (next === base || local === next) return local;
  const literals = [base, local, next].map(
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
  const b = base.split("\n"), l = local.split("\n"), n = next.split("\n");
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
      const bytes = await readFile(await safePath(baseRoot, entry2)), digest2 = entry2.slice(0, -4);
      if (hash(bytes) !== digest2)
        throw new Fault("GENERATION_BASE_CORRUPT", "Generated base integrity failed.", 5);
      bases[digest2] = bytes.toString("utf8");
    }
  if (state) {
    for (const owner of Object.values(state.owners))
      for (const digest2 of Object.values(owner.bases))
        if (!(digest2 in bases))
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
  const { blueprint, state, catalog } = input;
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
    catalogDigest: catalog.digest,
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
      catalog,
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
        const base = input.bases[old.bases[file]];
        if (base === void 0)
          throw new Fault("GENERATION_BASE_MISSING", "Generated base is unavailable.", 5);
        content = threeWay(base, local, next);
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
      catalogDigest: catalog.digest,
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
  const env = environment(ctx, envName), connection = await resolveConnection(env.readConnectionRef);
  const blueprint = await readDocument(ctx.root, blueprintFile, blueprintSchema);
  const result = { schema: env.parsingSchema, objects: {}, signatures: {} };
  async function read(kind, name) {
    const rows = [];
    let offset = 0;
    while (rows.length < 1e4) {
      const response = await metadataRead(oracle, env, connection, {
        kind,
        name,
        schema: env.parsingSchema,
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
    operations: plan.operations.map(({ path: path3, reason, before, after }) => ({ path: path3, reason, before, after })),
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
async function blueprintAdd(ctx, file, instanceId, instance, expectedDigest, apply = false) {
  await requireTrust(ctx.root);
  const blueprint = await readDocument(ctx.root, file, blueprintSchema);
  if (semanticDigest(blueprint) !== expectedDigest)
    throw new Fault("BLUEPRINT_CONFLICT", "Blueprint changed while editing catalog parameters.", 5);
  if (blueprint.blocks[instanceId]) throw new Fault("INSTANCE_EXISTS", "Choose a new instance identity.", 5);
  const block = validate(instanceSchema, instance), catalog = await loadCatalog(ctx.root);
  if (!catalog.packages.has(block.use))
    throw new Fault("PACKAGE_NOT_AVAILABLE_OFFLINE", "Unknown block version.", 3);
  const next = validate(blueprintSchema, {
    ...blueprint,
    blocks: { ...blueprint.blocks, [instanceId]: block }
  });
  const content = JSON.stringify(next, null, 2) + "\n";
  if (apply) {
    if (semanticDigest(await readDocument(ctx.root, file, blueprintSchema)) !== expectedDigest)
      throw new Fault("BLUEPRINT_CONFLICT", "Concurrent blueprint edit.", 5);
    await withLock(await safePath(ctx.root, ".apexrest/composer/ownership.lock"), async () => {
      if (semanticDigest(await readDocument(ctx.root, file, blueprintSchema)) !== expectedDigest)
        throw new Fault("BLUEPRINT_CONFLICT", "Concurrent blueprint edit.", 5);
      await atomicWrite(await safePath(ctx.root, file), content);
    });
  }
  return {
    applied: apply,
    expectedDigest,
    nextDigest: semanticDigest(next),
    before: canonical(blueprint),
    after: content,
    databaseEffects: []
  };
}

// packages/core/src/panel-schema.ts
var panelPreferencesSchema = external_exports.strictObject({
  browserMode: browserPreferencesSchema.shape.browserMode.removeDefault().optional()
});
var panelReadSchema = external_exports.strictObject({
  project: external_exports.string().min(1).max(4096).optional()
});
var connectionActionSchema = external_exports.strictObject({
  kind: external_exports.literal("connection"),
  name: refName,
  sqlclName: savedConnectionName.optional(),
  ordsUrl: ordsUrl.optional(),
  ordsUsername: ordsUsername.optional(),
  password: external_exports.string().min(1).max(4096).optional()
});
var panelActionSchema = external_exports.strictObject({
  project: external_exports.string().min(1).max(4096).optional(),
  action: external_exports.discriminatedUnion("kind", [
    external_exports.strictObject({ kind: external_exports.literal("preferences"), settings: panelPreferencesSchema }),
    external_exports.strictObject({ kind: external_exports.literal("sqlcl"), settings: sqlclConfigSchema }),
    external_exports.strictObject({ kind: external_exports.literal("saved-connections") }),
    connectionActionSchema,
    external_exports.strictObject({
      kind: external_exports.literal("catalog-search"),
      query: external_exports.string().min(1).max(256),
      profile: external_exports.string().max(200).optional()
    }),
    external_exports.strictObject({
      kind: external_exports.literal("catalog-read"),
      id: external_exports.string().min(1).max(200),
      offset: external_exports.number().int().min(0).default(0)
    }),
    external_exports.strictObject({ kind: external_exports.literal("blueprint-read"), blueprint: relativePath }),
    external_exports.strictObject({
      kind: external_exports.literal("blueprint-add"),
      blueprint: relativePath,
      instanceId: external_exports.string().min(1).max(64),
      instance: instanceSchema,
      expectedDigest: digest,
      apply: external_exports.boolean().default(false)
    }),
    composePlanInput.omit({ project: true }).extend({ kind: external_exports.literal("compose-plan") }),
    composeMaterializeInput.omit({ project: true }).extend({ kind: external_exports.literal("compose-materialize") }),
    external_exports.strictObject({ kind: external_exports.literal("compose-status"), id: external_exports.uuid() }),
    external_exports.strictObject({ kind: external_exports.literal("cancel-job"), id: external_exports.uuid() }),
    external_exports.strictObject({ kind: external_exports.literal("validate") }),
    external_exports.strictObject({ kind: external_exports.literal("browser"), env: external_exports.string().min(1).max(100) }),
    external_exports.strictObject({
      kind: external_exports.literal("test"),
      suite: external_exports.enum(["unit", "sql", "api", "e2e", "all"]),
      env: external_exports.string().min(1).max(100).optional()
    }),
    external_exports.strictObject({ kind: external_exports.literal("plan"), env: external_exports.string().min(1).max(100) })
  ])
});
var [preferencesAction, ...otherActions] = panelActionSchema.shape.action.options;
var publicPanelActionSchema = panelActionSchema.extend({
  action: external_exports.discriminatedUnion("kind", [
    preferencesAction,
    ...otherActions.filter((option) => option.shape.kind.value !== "sqlcl").map(
      (option) => option.shape.kind.value === "connection" ? connectionActionSchema.omit({ password: true }) : option
    )
  ])
});

// packages/core/src/jobs.ts
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
var JobService = class {
  constructor(ctx) {
    this.ctx = ctx;
  }
  ctx;
  async start(operation, input, runtime) {
    await requireTrust(this.ctx.root);
    if (![
      "compose.plan",
      "compose.materialize",
      "apex.sync",
      "apex.generate",
      "apex.export",
      "apex.validate",
      "deploy.plan",
      "deploy.apply",
      "test.run"
    ].includes(operation))
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
      nextAction: "Wait for this job with apexrest_job_status and waitSeconds:25; never rerun the operation to fetch results. Cancellation does not imply database rollback."
    };
  }
  async status(id, waitSeconds = 0, signal) {
    parse(external_exports.uuid(), id);
    parse(external_exports.number().int().min(0).max(30), waitSeconds);
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
  const pulse = async () => {
    if (done) return;
    if (await exists(path.join(root, "cancel.json"))) controller.abort();
    if (!done)
      await writeJson(path.join(root, "state.json"), {
        id,
        operation: request.operation,
        status: "running",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
  };
  await pulse();
  let pending = Promise.resolve();
  const timer = setInterval(() => {
    pending = pending.then(pulse).catch(() => {
      controller.abort();
    });
  }, 2e3), timeout = setTimeout(() => controller.abort(), 9e5);
  try {
    const result = await execute(request.operation, request.input, controller.signal);
    done = true;
    clearInterval(timer);
    clearTimeout(timeout);
    await pending;
    await writeJson(path.join(root, "state.json"), {
      id,
      operation: request.operation,
      status: jobOutcome(result),
      result,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } finally {
    done = true;
    clearInterval(timer);
    clearTimeout(timeout);
  }
}

// packages/core/src/panel.ts
import path2 from "node:path";
import { fileURLToPath } from "node:url";
import { readdir as readdir2, realpath, stat } from "node:fs/promises";
import { randomUUID as randomUUID2 } from "node:crypto";
var safe = (value) => sanitized(value);
var historyLimit = 2e3;
var PanelService = class {
  constructor(root, oracle = new OracleAdapter()) {
    this.root = root;
    this.oracle = oracle;
  }
  root;
  oracle;
  async preferences() {
    return browserPreferences(this.root);
  }
  async records(folder) {
    const base = await contained(this.root, ".apexrest/" + folder);
    if (!await exists(base)) return { rows: [], omitted: 0 };
    let entries = (await readdir2(base, { withFileTypes: true })).filter(
      (e) => e.isDirectory() && external_exports.uuid().safeParse(e.name).success
    );
    let omitted = 0;
    if (entries.length > historyLimit) {
      const dated = await Promise.all(
        entries.map(async (entry2) => ({
          entry: entry2,
          at: (await stat(path2.join(base, entry2.name)).catch(() => null))?.mtimeMs ?? 0
        }))
      );
      omitted = entries.length - historyLimit;
      entries = dated.sort((a, b) => b.at - a.at).slice(0, historyLimit).map((d) => d.entry);
    }
    const files = await Promise.all(
      entries.map(async (entry2) => {
        const file = await contained(base, entry2.name + "/state.json");
        const info = await stat(file).catch(() => null);
        return { id: entry2.name, file, at: info?.mtimeMs ?? 0, size: info?.size ?? 0 };
      })
    );
    const rows = await Promise.all(
      files.filter((f) => f.size > 0).sort((a, b) => b.at - a.at).slice(0, 12).map(async (f) => {
        if (f.size > 2 * 1024 * 1024)
          return {
            id: f.id,
            status: "unavailable",
            diagnostics: ["Record exceeds the panel limit."]
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
    this.root = await realpath(this.root);
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
        args: ["status", "--porcelain=v1", "--untracked-files=normal"],
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
        if ((await stat(file)).size <= 128e3) toolchain = await readJson(file);
      }
    }
    const sync = ctx ? await Promise.all(
      Object.entries(ctx.config.environments).map(async ([name, env]) => {
        try {
          return { environment: name, ...await new SyncStore(ctx, env, name).status() };
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
  async act(action) {
    action = parse(panelActionSchema, { action }).action;
    this.root = await realpath(this.root);
    await requireTrust(this.root);
    if (action.kind === "saved-connections") return this.oracle.savedConnections();
    if (action.kind === "preferences") {
      const settings = { ...await this.preferences(), ...action.settings };
      await writeJson(await contained(this.root, ".apexrest/panel/preferences.json"), settings);
      return { saved: true, appliesTo: "browser-verification" };
    }
    if (action.kind === "sqlcl") {
      return configureSqlcl(
        action.settings.mode,
        action.settings.mcpRestrictLevel,
        action.settings.databaseTransport
      );
    }
    if (action.kind === "connection") return configureConnection(action.name, action);
    if (action.kind === "catalog-search")
      return catalogSearch(action.query, {
        project: this.root,
        limit: 8,
        ...action.profile ? { profile: action.profile } : {}
      });
    if (action.kind === "catalog-read") return catalogRead(action.id, action.offset, 8192, this.root);
    const ctx = await loadProject(this.root);
    if (action.kind === "blueprint-read") {
      const blueprint = await readDocument(this.root, action.blueprint, blueprintSchema);
      return { blueprint, digest: semanticDigest(blueprint) };
    }
    if (action.kind === "blueprint-add")
      return blueprintAdd(
        ctx,
        action.blueprint,
        action.instanceId,
        action.instance,
        action.expectedDigest,
        action.apply
      );
    if (action.kind === "compose-status") {
      const job = await new JobService(ctx).status(action.id);
      const result = "result" in job ? job.result : null;
      let materializable = false;
      if (result?.data?.plan && result.data.planDigest)
        materializable = await assessPlan(ctx, result.data.plan, result.data.planDigest);
      return { job, materializable };
    }
    if (action.kind === "compose-plan" || action.kind === "compose-materialize") {
      const { kind, ...input2 } = action;
      return new JobService(ctx).start(
        kind === "compose-plan" ? "compose.plan" : "compose.materialize",
        input2,
        path2.join(path2.dirname(fileURLToPath(import.meta.url)), "apexrest.mjs")
      );
    }
    if (action.kind === "browser") return openVerificationBrowser(ctx, action.env);
    if (action.kind === "cancel-job") return new JobService(ctx).cancel(action.id);
    const operation = action.kind === "validate" ? "apex.validate" : action.kind === "plan" ? "deploy.plan" : "test.run";
    const input = action.kind === "plan" ? { env: action.env, out: ".apexrest/plans/" + randomUUID2() + ".json" } : action.kind === "test" ? { suite: action.suite, ...action.env ? { env: action.env } : {} } : {};
    return new JobService(ctx).start(
      operation,
      input,
      path2.join(path2.dirname(fileURLToPath(import.meta.url)), "apexrest.mjs")
    );
  }
};

export {
  metadataInputSchema,
  metadataRead,
  composePlanInput,
  composeMaterializeInput,
  composePlan,
  composeMaterialize,
  panelReadSchema,
  panelActionSchema,
  publicPanelActionSchema,
  JobService,
  failQueuedJob,
  executeJob,
  PanelService
};
