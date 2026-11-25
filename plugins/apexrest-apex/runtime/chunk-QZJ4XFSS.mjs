import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  recordRevision,
  revisionOf
} from "./chunk-PCV5YPHF.mjs";
import {
  deploymentBinding,
  verifyDeploymentPredicates
} from "./chunk-HLUA2IXO.mjs";
import {
  correlationId,
  openSpan,
  spanned,
  traceReport
} from "./chunk-MPDF637Z.mjs";
import {
  APEXLANG_EQUIVALENCE_POLICY,
  LocalDeploymentControl,
  OracleAdapter,
  SCRIPT_RESTRICT_LEVEL,
  SyncStore,
  changedFiles,
  checkSnapshot,
  checkSyncBackup,
  checkpoint,
  compareApplicationExports,
  coordination,
  databaseMeetsApex262Minimum,
  importOptions,
  importSelectionSchema,
  overlaySelection,
  persistSnapshot,
  pickFiles,
  privateCopy,
  rebaseAfterImport,
  resolveConnection,
  scopedExportFile,
  selectImport,
  sourceRelease,
  sqlclToken,
  stageSelection,
  supportedFile,
  syncPath
} from "./chunk-2DFWP5Y4.mjs";
import {
  VERSION
} from "./chunk-4GRGGAQV.mjs";
import {
  environment,
  isProductionTarget,
  parse,
  policy,
  refName,
  refuseProductionDeployment,
  targetDigest
} from "./chunk-FMCSJH7I.mjs";
import {
  withConnectedReads
} from "./chunk-CJQOFEXF.mjs";
import {
  sqlclTimings,
  withSqlclTimings
} from "./chunk-4S6ZNCT6.mjs";
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
} from "./chunk-RW7D7AJD.mjs";
import {
  Fault,
  external_exports
} from "./chunk-OWILYJ3V.mjs";

// packages/core/src/deploy.ts
import path2 from "node:path";
import { readFile as readFile2, mkdir, cp, open, readdir, rename, rm, rmdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// packages/core/src/sql-review.ts
function sqlTokens(sql) {
  const tokens = [];
  for (let i = 0; i < sql.length; ) {
    if (/\s/.test(sql[i])) {
      i++;
      continue;
    }
    if (sql.startsWith("--", i)) {
      i = sql.indexOf("\n", i);
      if (i < 0) break;
      continue;
    }
    if (sql.startsWith("/*", i)) {
      const end = sql.indexOf("*/", i + 2);
      i = end < 0 ? sql.length : end + 2;
      continue;
    }
    if (!sql.slice(sql.lastIndexOf("\n", i - 1) + 1, i).trim() && /^REM(?:ARK)?(?:[ \t]|$)(?![ \t]*:=)/i.test(sql.slice(i))) {
      const end = sql.indexOf("\n", i);
      if (end < 0) break;
      i = end + 1;
      continue;
    }
    const start = i;
    const q = /^[qQ]'([\[({<]|[^\w\s])/.exec(sql.slice(i));
    if (q) {
      const closing = { "[": "]", "(": ")", "{": "}", "<": ">" }[q[1]] ?? q[1];
      const end = sql.indexOf(closing + "'", i + 3);
      tokens.push({
        value: sql.slice(i + 3, end < 0 ? sql.length : end),
        literal: true,
        start,
        end: end < 0 ? sql.length : end + 2
      });
      i = end < 0 ? sql.length : end + 2;
      continue;
    }
    if (sql[i] === "'") {
      let value = "";
      i++;
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            value += "'";
            i += 2;
          } else {
            i++;
            break;
          }
        } else value += sql[i++];
      }
      tokens.push({ value, literal: true, start, end: i });
      continue;
    }
    if (sql[i] === '"') {
      let value = '"';
      i++;
      while (i < sql.length) {
        value += sql[i];
        if (sql[i++] === '"') {
          if (sql[i] === '"') value += sql[i++];
          else break;
        }
      }
      tokens.push({ value, start, end: i });
      continue;
    }
    const word = /^[A-Za-z][\w$#]*/.exec(sql.slice(i));
    if (word) {
      i += word[0].length;
      tokens.push({ value: word[0].toUpperCase(), start, end: i });
    } else {
      const value = sql[i++];
      tokens.push({ value, start, end: i });
    }
  }
  return tokens;
}
function executableSql(sql) {
  const code = sql.split("").map((char) => /\s/.test(char) ? char : " ");
  for (const token of sqlTokens(sql))
    if (!token.literal) for (let i = token.start; i < token.end; i++) code[i] = sql[i];
  return code.join("");
}
var plainCreateKinds = /* @__PURE__ */ new Set(["TABLE", "VIEW", "INDEX", "SEQUENCE", "SYNONYM", "MATERIALIZED-VIEW"]);
var programKinds = /* @__PURE__ */ new Set(["PACKAGE", "PROCEDURE", "FUNCTION", "TRIGGER", "TYPE", "JAVA", "LIBRARY"]);
var kindModifiers = /* @__PURE__ */ new Set([
  "OR",
  "REPLACE",
  "FORCE",
  "NOFORCE",
  "EDITIONABLE",
  "NONEDITIONABLE",
  "UNIQUE",
  "BITMAP",
  "MULTIVALUE",
  "PUBLIC",
  "PRIVATE",
  "GLOBAL",
  "TEMPORARY",
  "SHARDED",
  "DUPLICATED",
  "IMMUTABLE",
  "BLOCKCHAIN",
  "BIGFILE",
  "SMALLFILE",
  "AND",
  "RESOLVE",
  "COMPILE"
]);
var compoundKinds = {
  MATERIALIZED: ["VIEW", "ZONEMAP"],
  DATABASE: ["LINK"],
  PACKAGE: ["BODY"],
  TYPE: ["BODY"],
  ROLLBACK: ["SEGMENT"],
  RESTORE: ["POINT"],
  FLASHBACK: ["ARCHIVE"],
  ANALYTIC: ["VIEW"],
  ATTRIBUTE: ["DIMENSION"],
  LOCKDOWN: ["PROFILE"]
};
var queryBuiltins = new Set(
  "ABS ACOS ADD_MONTHS ALL AND ANY ASCII ASCIISTR ASIN ATAN ATAN2 AVG BETWEEN BIN_TO_NUM BINARY_DOUBLE BINARY_FLOAT BITAND BY CARDINALITY CASE CAST CEIL CHAR CHARTOROWID CHR COALESCE COLLECT COMPOSE CONCAT CONNECT CONVERT CORR COS COSH COUNT COVAR_POP COVAR_SAMP CUBE CUME_DIST CURRENT_DATE CURRENT_TIMESTAMP CV DATE DBTIMEZONE DECODE DECOMPOSE DENSE_RANK DEREF DISTINCT DUMP ELSE EMPTY_BLOB EMPTY_CLOB EXISTS EXP EXTRACT FILTER FIRST FIRST_VALUE FLOAT FLOOR FOR FROM FROM_TZ GREATEST GROUP GROUPING GROUPING_ID HAVING HEXTORAW IN INITCAP INSTR INSTRB INSTRC INTERVAL IS JOIN JSON_ARRAY JSON_ARRAYAGG JSON_EXISTS JSON_MERGEPATCH JSON_OBJECT JSON_OBJECTAGG JSON_QUERY JSON_SCALAR JSON_SERIALIZE JSON_TABLE JSON_TRANSFORM JSON_VALUE KEEP LAG LAST LAST_DAY LAST_VALUE LATERAL LEAD LEAST LENGTH LENGTHB LENGTHC LIKE LISTAGG LN LNNVL LOCALTIMESTAMP LOG LOWER LPAD LTRIM MAX MEDIAN MIN MOD MONTHS_BETWEEN NANVL NCHAR NCHR NEW_TIME NEXT_DAY NLS_INITCAP NLS_LOWER NLS_UPPER NLSSORT NOT NTH_VALUE NTILE NULLIF NUMBER NUMTODSINTERVAL NUMTOYMINTERVAL NVARCHAR2 NVL NVL2 ON ONLY OR ORA_HASH ORDER OVER PARTITION PERCENT_RANK PERCENTILE_CONT PERCENTILE_DISC PIVOT POWER RANGE RANK RATIO_TO_REPORT RAW RAWTOHEX REGEXP_COUNT REGEXP_INSTR REGEXP_LIKE REGEXP_REPLACE REGEXP_SUBSTR REMAINDER REPLACE REVERSE ROLLUP ROUND ROW_NUMBER ROWIDTOCHAR ROWS RPAD RTRIM SELECT SESSIONTIMEZONE SETS SIGN SIN SINH SOME SOUNDEX SQRT STANDARD_HASH STATS_MODE STDDEV STDDEV_POP STDDEV_SAMP SUBSTR SUBSTRB SUBSTRC SUM SYS_CONNECT_BY_PATH SYS_CONTEXT SYS_EXTRACT_UTC SYS_GUID SYSDATE SYSTIMESTAMP TAN TANH THEN TIMESTAMP TO_BINARY_DOUBLE TO_BINARY_FLOAT TO_BLOB TO_CHAR TO_CLOB TO_DATE TO_DSINTERVAL TO_LOB TO_MULTI_BYTE TO_NCHAR TO_NCLOB TO_NUMBER TO_SINGLE_BYTE TO_TIMESTAMP TO_TIMESTAMP_TZ TO_YMINTERVAL TRANSLATE TREAT TRIM TRUNC TZ_OFFSET UNION UNISTR UNPIVOT UPPER USING VALIDATE_CONVERSION VALUE VALUES VAR_POP VAR_SAMP VARCHAR VARCHAR2 VARIANCE VSIZE WHEN WHERE WIDTH_BUCKET WITH WITHIN XMLAGG XMLELEMENT XMLFOREST XMLTABLE XMLTYPE".split(" ")
);
var querySyntax = new Set(
  "AS ASC CROSS DESC FETCH FULL INNER LEFT NEXT NULL NULLS OFFSET OUTER RIGHT ROW UPDATE".split(" ")
);
var sqlIdentifier = /^(?:[A-Z][\w$#]*|"(?:[^"]|"")+")$/;
function inspectSql(sql, depth = 0) {
  const tokens = sqlTokens(sql), operations = [];
  const at = (i) => tokens[i]?.literal ? "" : tokens[i]?.value ?? "";
  const objectAt = (i) => at(i + 1) === "." ? at(i) + "." + at(i + 2) : at(i) || null;
  const add = (action, object, dangerous, consequence, extra = {}) => operations.push({ action, object, dangerous, consequence, ...extra });
  const units = sql.split(/^\s*\/\s*$/m);
  if (units.length > 1) return units.flatMap((unit) => inspectSql(unit, depth));
  const kindAt = (i) => {
    let cursor = i;
    while (kindModifiers.has(at(cursor))) cursor++;
    let kind = at(cursor);
    if (!/^[A-Z]/.test(kind)) return null;
    cursor++;
    const second = compoundKinds[kind];
    if (second?.includes(at(cursor))) kind += "-" + at(cursor++);
    return { kind, cursor };
  };
  const header = tokens.filter((token) => !token.literal).slice(0, 6).map((token) => token.value);
  if (header[0] === "CREATE") {
    const found = kindAt(1);
    if (found && programKinds.has(found.kind.split("-")[0]))
      return [
        {
          action: "create-program",
          object: objectAt(found.cursor),
          dangerous: true,
          consequence: "Creates or replaces executable database code; callers and triggers can change behavior."
        }
      ];
  }
  const statementStart = (i) => i === 0 || at(i - 1) === ";" || at(i - 1) === "/";
  const inspectQuery = (start, includeBareNames = true) => {
    for (let i = start + 1; i < tokens.length && at(i) !== ";"; i++) {
      const name = at(i), previous = at(i - 1), next2 = at(i + 1);
      if (!sqlIdentifier.test(name)) continue;
      if (previous === "FROM" || previous === "JOIN") {
        let end = i;
        while (at(end + 1) === "." && sqlIdentifier.test(at(end + 2))) end += 2;
        if (at(end + 1) !== "(") {
          i = end;
          continue;
        }
      } else if (previous === "AS" || tokens[i - 1]?.literal && ["FROM", ","].includes(next2)) continue;
      const qualified = previous === ".";
      if (!qualified && next2 !== "." && (queryBuiltins.has(name) || querySyntax.has(name))) continue;
      const call = next2 === "(" || qualified || next2 === ".";
      if (!call && !includeBareNames) continue;
      add(
        call ? "query-routine-call" : "query-unresolved-reference",
        qualified ? at(i - 2) + "." + name : next2 === "." ? name + "." + at(i + 2) : name,
        true,
        call ? "Queries a possible user-defined routine or sequence; evaluation can change data or schema state." : "A bare query name could be a parameterless routine; resolve it before approving remote execution."
      );
      return;
    }
  };
  let anonymousBlock = false;
  let inspectedQuery = false;
  for (let i = 0; i < tokens.length; i++) {
    const word = at(i);
    if (word === ";") inspectedQuery = false;
    if (word === "EXECUTE" && at(i + 1) === "IMMEDIATE") {
      const literal = tokens[i + 2];
      if (literal?.literal && at(i + 3) !== "|" && depth < 4)
        operations.push(...inspectSql(literal.value, depth + 1));
      else
        add(
          "dynamic-sql",
          null,
          true,
          "Dynamic SQL cannot be resolved statically; review the complete script."
        );
    } else if ((word === "EXEC" || word === "EXECUTE") && statementStart(i)) {
      add(
        "plsql-block",
        null,
        true,
        "Executes a database block or routine; review its data and schema effects."
      );
    } else if ((word === "DECLARE" || word === "BEGIN") && statementStart(i)) {
      anonymousBlock = true;
    } else if (word === "DROP") {
      const found = kindAt(i + 1);
      add(
        "drop-" + (found?.kind.toLowerCase() ?? "object"),
        found ? objectAt(found.cursor) : null,
        true,
        "Removes the database object; dependent code can become invalid. Dropping a table removes its data and constraints."
      );
    } else if (word === "TRUNCATE" && ["TABLE", "CLUSTER"].includes(at(i + 1))) {
      add(
        "truncate-" + at(i + 1).toLowerCase(),
        objectAt(i + 2),
        true,
        "Removes all table rows with DDL commit semantics; application metadata backup does not restore data."
      );
    } else if (word === "ALTER" && at(i + 1) === "TABLE") {
      const object = objectAt(i + 2), cursor = at(i + 3) === "." ? i + 5 : i + 3;
      if (at(cursor) === "RENAME" && at(cursor + 1) === "COLUMN")
        add(
          "rename-column",
          object,
          true,
          "Renames the column; dependent SQL, views, constraints and application queries must be updated.",
          { column: at(cursor + 2), renamedTo: at(cursor + 4) }
        );
      else
        add(
          "alter-table",
          object,
          true,
          "Changes the table definition; inspect constraints, stored data and dependent application queries."
        );
    } else if (word === "RENAME") {
      if (at(i - 1) !== "TABLE" && at(i + 1) !== "COLUMN")
        add(
          "rename-object",
          objectAt(i + 1),
          true,
          "Renames an object; dependent references require review."
        );
    } else if (["INSERT", "UPDATE", "DELETE", "MERGE"].includes(word) && // Not DML: a foreign key's ON DELETE CASCADE/SET NULL clause and a SELECT ... FOR UPDATE lock.
    !(at(i - 1) === "ON" && word === "DELETE") && !(at(i - 1) === "FOR" && word === "UPDATE")) {
      const cursor = ["INTO", "FROM"].includes(at(i + 1)) ? i + 2 : i + 1;
      add(
        word.toLowerCase(),
        objectAt(cursor),
        true,
        "Mutates business data; an APEX application backup does not restore affected rows."
      );
    } else if (["GRANT", "REVOKE", "AUDIT", "NOAUDIT", "ADMINISTER"].includes(word) || word === "ALTER" && ["USER", "SYSTEM", "DATABASE", "SESSION", "PROFILE", "ROLE"].includes(at(i + 1))) {
      add(
        "privileged-sql",
        null,
        true,
        "Changes database privileges, session context or administration settings."
      );
    } else if (word === "ALTER" && statementStart(i)) {
      const found = kindAt(i + 1);
      add(
        "alter-" + (found?.kind.toLowerCase() ?? "object"),
        found ? objectAt(found.cursor) : null,
        true,
        "Changes an existing database object; dependent code, triggers or constraints can change behavior."
      );
    } else if (["PURGE", "FLASHBACK"].includes(word) && statementStart(i)) {
      add(
        word.toLowerCase(),
        null,
        true,
        "Permanently removes or rewinds database objects; review the affected data."
      );
    } else if (word === "CREATE" && statementStart(i)) {
      const found = kindAt(i + 1);
      const replaces = at(i + 1) === "OR" && at(i + 2) === "REPLACE";
      if (!found) continue;
      const kind = found.kind.toLowerCase();
      if (programKinds.has(found.kind.split("-")[0]))
        add(
          "create-program",
          objectAt(found.cursor),
          true,
          "Creates or replaces executable database code; callers and triggers can change behavior."
        );
      else if (plainCreateKinds.has(found.kind)) {
        add(
          "create-" + kind,
          objectAt(found.cursor),
          replaces,
          replaces ? "Replaces an existing database object; dependent queries and code can change behavior." : "Creates a database object in the reviewed application schema."
        );
        if (found.kind === "INDEX") {
          let cursor = found.cursor;
          while (at(cursor) && ![";", "ON"].includes(at(cursor))) cursor++;
          if (at(cursor) === "ON") {
            cursor += at(cursor + 2) === "." ? 4 : 2;
            if (at(cursor) === "(") inspectQuery(cursor, false);
          }
        }
      } else
        add(
          "create-" + kind,
          objectAt(found.cursor),
          true,
          "Creates a privileged or executable database object (users, roles, links, jobs, directories, contexts); review its scope."
        );
    } else if (word === "SELECT" && !inspectedQuery) {
      inspectQuery(i);
      inspectedQuery = true;
    }
  }
  const controlWords = /* @__PURE__ */ new Set([
    "NULL",
    "EXIT",
    "RETURN",
    "END",
    "LOOP",
    "IF",
    "WHILE",
    "FOR",
    "RAISE",
    "CONTINUE"
  ]);
  const routineCall = tokens.some(
    (token, i) => !token.literal && (token.value === "CALL" || !controlWords.has(token.value) && /^[A-Z][\w$#]*$/.test(token.value) && ["BEGIN", ";", "THEN", "ELSE", "LOOP"].includes(at(i - 1)) && [".", "(", ";"].includes(at(i + 1)))
  );
  const harmlessBlockWords = /* @__PURE__ */ new Set([
    ...controlWords,
    "DECLARE",
    "BEGIN",
    "EXCEPTION",
    "WHEN",
    "OTHERS",
    "THEN",
    "ELSE",
    "ELSIF",
    "IS",
    "NOT",
    "AND",
    "OR",
    "TRUE",
    "FALSE"
  ]);
  const executableBlock = anonymousBlock && tokens.some(
    (token) => !token.literal && /^[A-Z][\w$#]*$/.test(token.value) && !harmlessBlockWords.has(token.value)
  );
  if (routineCall || executableBlock)
    add(
      "plsql-block",
      null,
      true,
      "Executes a database block or routine; review its data and schema effects."
    );
  return operations.filter(
    (operation, i) => operations.findIndex((other) => JSON.stringify(other) === JSON.stringify(operation)) === i
  );
}

// packages/core/src/sync-normalization.ts
import path from "node:path";
import { readFile } from "node:fs/promises";
function sourceDifferences(local, expected) {
  return [.../* @__PURE__ */ new Set([...Object.keys(local), ...Object.keys(expected)])].filter((file) => local[file] !== expected[file]).sort().map((file) => ({
    file,
    change: !expected[file] ? "added" : !local[file] ? "removed" : "changed"
  }));
}
function lastImportRewrites(local, server) {
  return sourceDifferences(local, server).map(({ file, change }) => ({
    file,
    rule: "last-import-rewrite",
    action: change === "added" ? "removed" : change === "removed" ? "added" : "replaced"
  }));
}
var DEPLOYMENT_FILE = "deployments/default.json";
var SUPPORTING_OBJECTS = "supporting-objects/supporting-objects.apx";
var DEINSTALL_BLOCK = /^([ \t]*)deinstall \{\r?\n[ \t]*scriptFile: ([^\s]+)\r?\n\1\}\r?\n/mu;
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function withoutAppId(value) {
  const copy = structuredClone(value);
  if (isObject(copy.app)) {
    delete copy.app.id;
    if (!Object.keys(copy.app).length) delete copy.app;
  }
  return copy;
}
async function generatedSourceNormalizations(localRoot, serverRoot, local, server, applicationId) {
  const differing = [.../* @__PURE__ */ new Set([...Object.keys(local), ...Object.keys(server)])].filter((file) => local[file] !== server[file]).sort();
  const read = async (root, file) => readFile(await contained(root, file), "utf8");
  const result = [];
  const explained = /* @__PURE__ */ new Set();
  if (differing.includes(DEPLOYMENT_FILE) && local[DEPLOYMENT_FILE] && server[DEPLOYMENT_FILE]) {
    let localJson, serverJson;
    try {
      localJson = JSON.parse(await read(localRoot, DEPLOYMENT_FILE));
      serverJson = JSON.parse(await read(serverRoot, DEPLOYMENT_FILE));
    } catch {
      return void 0;
    }
    if (!isObject(localJson) || !isObject(serverJson)) return void 0;
    const serverId = isObject(serverJson.app) ? serverJson.app.id : void 0;
    const localId = isObject(localJson.app) ? localJson.app.id : void 0;
    if (serverId !== applicationId || localId !== void 0 && localId !== applicationId) return void 0;
    if (canonical(withoutAppId(localJson)) !== canonical(withoutAppId(serverJson))) return void 0;
    result.push({ file: DEPLOYMENT_FILE, rule: "deployment-app-id-target", action: "replaced" });
    explained.add(DEPLOYMENT_FILE);
  }
  if (differing.includes(SUPPORTING_OBJECTS) && local[SUPPORTING_OBJECTS] && server[SUPPORTING_OBJECTS]) {
    const localText = await read(localRoot, SUPPORTING_OBJECTS);
    const match = DEINSTALL_BLOCK.exec(localText);
    if (!match) return void 0;
    const script = path.posix.normalize(path.posix.join(path.posix.dirname(SUPPORTING_OBJECTS), match[2]));
    if (script.startsWith("..") || !local[script] || server[script]) return void 0;
    if ((await read(localRoot, script)).trim() !== "") return void 0;
    const stripped = localText.slice(0, match.index) + localText.slice(match.index + match[0].length);
    if (stripped !== await read(serverRoot, SUPPORTING_OBJECTS)) return void 0;
    result.push(
      { file: SUPPORTING_OBJECTS, rule: "empty-deinstall-script", action: "replaced" },
      { file: script, rule: "empty-deinstall-script", action: "removed" }
    );
    explained.add(SUPPORTING_OBJECTS).add(script);
  }
  return differing.every((file) => explained.has(file)) && result.length ? result : void 0;
}

// packages/core/src/deploy.ts
var planObservationDirectory = (planId) => ".apexrest/plans/" + planId + "/live-before";
var CONNECTION_LOST = /ORA-(?:03113|03114|03135|00028|01012|125\d\d|17002|17008)|not connected|closed connection|IO Error|broken pipe/i;
var digestSchema = external_exports.string().regex(/^[a-f0-9]{64}$/);
var filesSchema = external_exports.record(external_exports.string(), digestSchema);
var legacyPlanSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  id: external_exports.uuid(),
  projectId: refName,
  projectRoot: external_exports.string(),
  environment: refName,
  createdAt: external_exports.iso.datetime(),
  expiresAt: external_exports.iso.datetime(),
  sourceDigest: digestSchema,
  sources: filesSchema,
  configurationDigest: digestSchema,
  toolchainDigest: digestSchema,
  compiler: external_exports.string(),
  targetDigest: digestSchema,
  target: external_exports.record(external_exports.string(), external_exports.unknown()),
  fingerprint: digestSchema,
  migrationHistory: external_exports.array(external_exports.record(external_exports.string(), external_exports.unknown())),
  // Package scripts already applied with these checksums are not re-run (absent in older plans).
  packageHistory: external_exports.record(external_exports.string(), digestSchema).optional(),
  // Always the local durable store; the shape is kept so existing plan digests stay stable.
  coordination: external_exports.strictObject({
    backend: external_exports.literal("local"),
    scope: external_exports.literal("managed-home-schema"),
    storeDigest: digestSchema
  }),
  // database-only plans run migrations and changed package scripts without an application import.
  scope: external_exports.enum(["full-application-import", "database-only"]),
  operations: external_exports.array(
    external_exports.strictObject({
      kind: external_exports.enum(["migration", "package", "import", "verify"]),
      file: external_exports.string().optional(),
      sha256: digestSchema.optional()
    })
  ),
  risks: external_exports.array(external_exports.string()),
  databaseReview: external_exports.strictObject({
    local: external_exports.boolean(),
    localityEvidence: external_exports.string(),
    operations: external_exports.array(
      external_exports.strictObject({
        file: external_exports.string(),
        action: external_exports.string(),
        object: external_exports.string().nullable(),
        column: external_exports.string().optional(),
        renamedTo: external_exports.string().optional(),
        dangerous: external_exports.boolean(),
        consequence: external_exports.string(),
        dependencies: external_exports.array(external_exports.record(external_exports.string(), external_exports.unknown())),
        dependenciesStatus: external_exports.enum(["read", "unavailable", "not-applicable"])
      })
    )
  }).optional(),
  approval: external_exports.enum(["external-policy-required", "task-authorized"]),
  backupRequired: external_exports.boolean(),
  digest: digestSchema,
  restore: external_exports.strictObject({
    backupId: external_exports.uuid(),
    checksum: digestSchema,
    alias: refName.optional(),
    format: external_exports.literal("APEXLANG").optional()
  }).optional()
});
var PLAN_LIFETIME_MS = 30 * 6e4;
var syncBindingSchema = external_exports.strictObject({
  syncId: external_exports.uuid(),
  revision: external_exports.number().int().nonnegative(),
  baselineDigest: digestSchema,
  checkpointDigest: digestSchema,
  backupId: external_exports.uuid(),
  backupChecksum: digestSchema
});
var planV2Object = legacyPlanSchema.extend({
  schemaVersion: external_exports.literal(2),
  mode: external_exports.enum(["full-export", "working-copy"]),
  backupStrategy: external_exports.enum(["fresh-export", "initial-backup"]),
  workingCopy: syncBindingSchema.nullable()
});
var bindsWorkingCopy = (plan) => plan.mode === "working-copy" === (plan.workingCopy !== null);
function checkPlanMode(plan, ctx) {
  const backupAgrees = plan.scope === "database-only" ? plan.backupStrategy === "fresh-export" : plan.mode === "working-copy" === (plan.backupStrategy === "initial-backup");
  if (!backupAgrees || !bindsWorkingCopy(plan))
    ctx.addIssue({ code: "custom", message: "Plan mode, backup strategy and sync binding must agree." });
}
var planV2Schema = planV2Object.superRefine(checkPlanMode);
var composerBindingSchema = external_exports.strictObject({
  generationDigest: digestSchema,
  blueprintDigest: digestSchema,
  stateDigest: digestSchema,
  lockDigest: digestSchema,
  catalogDigest: digestSchema,
  blueprintPath: external_exports.string().min(1)
});
var planV3Schema = planV2Object.extend({ schemaVersion: external_exports.literal(3), composer: composerBindingSchema }).superRefine(checkPlanMode);
var planV4Schema = planV2Object.extend({
  schemaVersion: external_exports.literal(4),
  scope: external_exports.enum(["full-application-import", "selected-file-import"]),
  composer: composerBindingSchema.nullable(),
  importSelection: importSelectionSchema
}).superRefine((plan, ctx) => {
  const partial = plan.importSelection.resolvedMode === "files";
  if (partial && !!plan.restore && plan.restore.format !== "APEXLANG" || plan.importSelection.requestedMode === "files" && !partial || plan.importSelection.requestedMode === "full" && partial || !partial && plan.mode === "full-export" && plan.backupStrategy !== "fresh-export" || !bindsWorkingCopy(plan) || partial && (!plan.importSelection.files.length || !plan.importSelection.before || !plan.importSelection.effective || plan.backupStrategy !== "fresh-export" || !plan.workingCopy) || partial !== (plan.scope === "selected-file-import") || !partial && (plan.importSelection.files.length || plan.importSelection.before || plan.importSelection.effective))
    ctx.addIssue({
      code: "custom",
      message: "Import selection, scope, snapshots and backup strategy must agree."
    });
});
var deployPlanSchema = external_exports.union([legacyPlanSchema, planV2Schema, planV3Schema, planV4Schema]);
var next = {
  planned: ["approved"],
  approved: ["backing_up"],
  backing_up: ["migrating"],
  migrating: ["importing", "succeeded"],
  importing: ["verifying"],
  verifying: ["succeeded"],
  succeeded: [],
  failed: [],
  outcome_unknown: []
};
function assertTransition(from, to) {
  if (!next[from].includes(to) && !["failed", "outcome_unknown"].includes(to))
    throw new Fault("INVALID_DEPLOY_STATE", `Invalid transition ${from} to ${to}.`, 5);
}
function planDigest(value) {
  const { digest: _digest, ...unsigned } = value;
  return hash(canonical(unsigned));
}
var clientCommands = [
  ["host", 2],
  ["start", 3],
  ["spool", 3],
  ["save", 3],
  ["store", 3],
  ["get", 3],
  ["edit", 2],
  ["connect", 4],
  ["disconnect", 4],
  ["password", 5],
  ["exit", 4],
  ["quit", 4],
  ["script", 6],
  ["javascript", 10],
  ["cd", 2],
  ["copy", 4],
  ["alias", 5],
  ["repeat", 6],
  ["load", 4],
  ["unload", 6],
  ["liquibase", 9],
  ["lb", 2],
  ["sshtunnel", 9],
  ["connmgr", 7],
  ["apex", 4],
  ["oci", 3],
  ["datapump", 8],
  ["dp", 2],
  ["cloudstorage", 12],
  ["cs", 2],
  ["soda", 4],
  ["mcp", 3]
];
var plsqlBlockStart = /^(?:begin|declare)\b|^create\s+(?:or\s+replace\s+)?(?:(?:editionable|noneditionable)\s+)?(?:and\s+(?:resolve|compile)\s+)?(?:noforce\s+)?(?:java|function|procedure|package|trigger|type|library)\b/i;
function scriptCompletionMarker() {
  return `APEXREST_SCRIPT_COMPLETE_${randomUUID().replaceAll("-", "")}`;
}
function scriptCompleted(output, marker) {
  return (output ?? "").split(/\r?\n/).some((line) => line.trim() === marker);
}
function sqlclControlLines(sql) {
  sql = executableSql(sql);
  const found = [];
  let block = false;
  sql.split(/\r\n|\r|\n/).forEach((raw, index) => {
    let line = raw;
    for (; ; ) {
      line = line.replace(/^\s+/, "");
      if (!line.startsWith("/*")) break;
      const end = line.indexOf("*/", 2);
      line = end < 0 ? "" : line.slice(end + 2);
    }
    if (!line || line.startsWith("--")) return;
    if (/^[/.]\s*$/.test(line)) {
      block = false;
      return;
    }
    if (/^[!$@]/.test(line)) {
      found.push(index + 1);
      return;
    }
    const word = /^[A-Za-z][A-Za-z0-9_$#]*/.exec(line)?.[0].toLowerCase();
    if (!word) return;
    const rest = line.slice(word.length).trimStart();
    if (word.length >= 3 && "remark".startsWith(word)) return;
    if (plsqlBlockStart.test(line)) block = true;
    if ("start".startsWith(word) && word.length >= 3 && /^with\b/i.test(rest)) return;
    if ("connect".startsWith(word) && word.length >= 4 && /^by\b/i.test(rest)) return;
    if (block && word === "exit") return;
    if (word === "whenever" && /\bcontinue\b/i.test(rest) || word === "set" && /^(?:logsource|editfile)\b/i.test(rest) || clientCommands.some(([name, min]) => word.length >= min && name.startsWith(word)))
      found.push(index + 1);
  });
  return found;
}
function migrationRisk(sql) {
  const risks = [];
  if (inspectSql(sql).some((operation) => operation.dangerous)) risks.push("database-mutation");
  if (sqlclControlLines(executableSql(sql)).length) risks.push("sqlcl-script-control");
  return risks;
}
var legacyRestoreRisk = "legacy-sql-restore";
var legacyRestoreOperation = (backupId, file) => ({
  file: `.apexrest/backups/${backupId}/application/${file}`,
  action: legacyRestoreRisk,
  object: null,
  dangerous: true,
  consequence: "Executes PL/SQL from the backup in Oracle. Review application, schema and data effects in the complete script.",
  dependencies: [],
  dependenciesStatus: "unavailable"
});
async function readLegacyRestore(directory, checksum) {
  const files = await inventory(directory);
  if (hash(canonical(files)) !== checksum)
    throw new Fault("BACKUP_INVALID", "Legacy restore source changed after review.", 5);
  const entries = Object.keys(files);
  const file = entries[0];
  if (entries.length !== 1 || !file || !/^f\d+\.sql$/i.test(file))
    throw new Fault("RESTORE_LAYOUT_UNSUPPORTED", "Legacy restore requires one non-split export file.", 3);
  const bytes = await readFile2(await contained(directory, file));
  if (hash(bytes) !== files[file]) throw new Fault("BACKUP_INVALID", "Legacy restore file changed.", 5);
  const sql = bytes.toString("utf8");
  if (!Buffer.from(sql).equals(bytes) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(sql))
    throw new Fault(
      "BACKUP_INVALID",
      "Legacy restore requires UTF-8 text without client control characters.",
      5
    );
  const lines = sql.split(/\r\n|\r|\n/u);
  let start;
  let blocks = 0;
  let footer = false;
  const unsupported = (line) => new Fault(
    "UNSUPPORTED_SQL_CLIENT_COMMAND",
    `Legacy restore contains an unsupported command or export layout at line ${line + 1}.`,
    4,
    "blocked"
  );
  for (const [index, line] of lines.entries()) {
    const text = line.trim().replace(/[\t ]+/gu, " ").toLowerCase();
    if (start === void 0) {
      if (!text || /^(?:--|(?:rem(?:ark)?|prompt)(?: |$))/u.test(text)) continue;
      if (!blocks && !footer && ["set define off verify off feedback off", "whenever sqlerror exit sql.sqlcode rollback"].includes(
        text
      ))
        continue;
      if (blocks && !footer && text === "set verify on feedback on define on") {
        footer = true;
        continue;
      }
      if (footer || !/^(?:begin|declare)(?:\s|$)/u.test(text)) throw unsupported(index);
      start = index;
    }
    if (/^\s*[!$@#]|^\s*\.\s*$/u.test(line)) throw unsupported(index);
    if (/^\s*\/(?!\*)/u.test(line) && text !== "/") throw unsupported(index);
    if (text !== "/") continue;
    const block = lines.slice(start, index).join("\n");
    const commands = sqlclControlLines(block);
    if (commands.length) throw unsupported(start + commands[0] - 1);
    const executable = executableSql(block).trim();
    if (!/\bend\s*;$/iu.test(executable) || /^\s*(?:set|whenever|prompt)\b/imu.test(executable))
      throw unsupported(index);
    blocks++;
    start = void 0;
  }
  if (!blocks || start !== void 0) throw unsupported(start ?? 0);
  return { file, bytes };
}
var securityHeader = /^(?:(?:authentication|authorization)(?:[-_ ]?scheme)?\s*[:=]|(?:authentication|authorization)\s*(?:\{|[\w.-]+\s*\())/i;
function securityAttributes(text) {
  const out = [];
  let depth = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (depth > 0) {
      out.push(line);
      depth += (line.match(/[{(]/g)?.length ?? 0) - (line.match(/[})]/g)?.length ?? 0);
      continue;
    }
    if (!securityHeader.test(line)) continue;
    out.push(line);
    depth = Math.max(0, (line.match(/[{(]/g)?.length ?? 0) - (line.match(/[})]/g)?.length ?? 0));
  }
  return out;
}
async function securityChanged(local, server) {
  const read = async (root, files, file) => files[file] === void 0 ? [] : securityAttributes(await readFile2(await contained(root, file), "utf8"));
  for (const file of /* @__PURE__ */ new Set([...Object.keys(server.files), ...Object.keys(local.files)])) {
    if (local.files[file] === server.files[file]) continue;
    if (/authenticat|authoriz/i.test(file)) return true;
    if (canonical(await read(local.root, local.files, file)) !== canonical(await read(server.root, server.files, file)))
      return true;
  }
  return false;
}
async function authorizePlan(ctx, plan, env, local = false) {
  if (await isProductionTarget(env, plan.targetDigest))
    throw new Fault(
      "PRODUCTION_DEPLOY_DENIED",
      "The plugin never deploys or restores production-marked targets.",
      4,
      "blocked"
    );
  if (plan.risks.some((r) => r.startsWith("sqlcl-script-control")))
    throw new Fault(
      "UNSUPPORTED_SQL_CLIENT_COMMAND",
      "Database scripts must contain reviewed SQL/PLSQL only; external script and host commands are unsupported.",
      4,
      "blocked"
    );
  const grants = (await policy()).grants;
  const grant = grants.find(
    (g) => g.projectRoot === ctx.root && g.targetDigest === plan.targetDigest && g.operations.includes("deploy") && g.planDigest === plan.digest && Date.parse(g.expiresAt) > Date.now() && Date.parse(g.expiresAt) <= Date.parse(plan.expiresAt)
  );
  if (!grant)
    throw new Fault(
      "DEPLOY_APPROVAL_REQUIRED",
      "The application task must authorize this exact project, target and plan.",
      4,
      "blocked"
    );
  if (!local && plan.risks.some((r) => r !== "application-restore") && (!plan.risks.filter((r) => r !== "application-restore").every((r) => grant.confirmedRisks?.includes(r)) || plan.risks.includes(legacyRestoreRisk) && !grant.confirmationRequest?.trim()))
    throw new Fault(
      "DATABASE_CONFIRMATION_REQUIRED",
      "Remote database or security changes require human confirmation of this exact plan.",
      4,
      "blocked"
    );
}
var migrationName = /^(\d{4,})__[A-Za-z0-9_-]+\.sql$/;
var migrationVersion = (file) => BigInt(migrationName.exec(path2.basename(file))?.[1] ?? "-1");
function operationOrder(a, b) {
  const kind = (a.kind === "migration" ? 0 : 1) - (b.kind === "migration" ? 0 : 1);
  if (kind) return kind;
  if (a.kind === "migration" && b.kind === "migration") {
    const left = migrationVersion(a.file ?? ""), right = migrationVersion(b.file ?? "");
    if (left !== right) return left < right ? -1 : 1;
  }
  return (a.file ?? "").localeCompare(b.file ?? "");
}
function checkMigrations(ctx, sources, history) {
  const prefix = ctx.config.database.migrationsDir + "/";
  const versions = /* @__PURE__ */ new Map();
  const applied = new Set(history.map((row) => String(row.version)));
  let highest = -1n;
  for (const row of history) {
    const match = migrationName.exec(String(row.version));
    if (match && BigInt(match[1]) > highest) highest = BigInt(match[1]);
  }
  for (const file of Object.keys(sources)) {
    if (!file.startsWith(prefix)) continue;
    const name = file.slice(prefix.length);
    if (name.includes("/"))
      throw new Fault(
        "INVALID_MIGRATION_LAYOUT",
        `Migration ${file} is in a subdirectory. Keep migrations directly in ${ctx.config.database.migrationsDir}.`,
        2
      );
    const match = migrationName.exec(name);
    if (!match)
      throw new Fault(
        "INVALID_MIGRATION_NAME",
        "Use ordered immutable migration names such as 0001__customers.sql.",
        2
      );
    const version = BigInt(match[1]);
    const duplicate = versions.get(version);
    if (duplicate)
      throw new Fault(
        "DUPLICATE_MIGRATION_VERSION",
        `Migrations ${duplicate} and ${name} share version ${match[1]}. Use one file per version.`,
        2
      );
    versions.set(version, name);
    if (!applied.has(name) && version < highest)
      throw new Fault(
        "MIGRATION_OUT_OF_ORDER",
        `New migration ${name} is older than the highest applied version. Give it a higher version.`,
        5
      );
  }
}
async function canonicalOnlyChanges(ctx, baseline, exported, files) {
  const candidates = files.filter(
    (file) => file.endsWith(".apx") && baseline.files[file] && exported.files[file]
  );
  if (!candidates.length) return /* @__PURE__ */ new Set();
  const comparison = await compareApplicationExports(
    await syncPath(ctx, baseline.directory),
    exported.directory,
    pickFiles(baseline.files, candidates),
    pickFiles(exported.files, candidates),
    candidates
  );
  return new Set(candidates.filter((file) => !comparison.mismatchedFiles.includes(file)));
}
function applicationFiles(ctx, sources) {
  const prefix = ctx.config.application.sourceDir + "/";
  return Object.fromEntries(
    Object.entries(sources).filter(([file]) => file.startsWith(prefix)).map(([file, sha]) => [file.slice(prefix.length), sha])
  );
}
async function sourceInventory(ctx) {
  const files = {};
  for (const relative of [
    ctx.config.application.sourceDir,
    ctx.config.database.migrationsDir,
    ctx.config.database.packagesDir
  ]) {
    const dir = await contained(ctx.root, relative);
    if (await exists(dir))
      for (const [file, sha] of Object.entries(await inventory(dir))) files[relative + "/" + file] = sha;
  }
  for (const relative of ["package.json", "package-lock.json"])
    if (await exists(path2.join(ctx.root, relative)))
      files[relative] = hash(await readFile2(await contained(ctx.root, relative)));
  return Object.fromEntries(Object.entries(files).sort());
}
async function appendJournal(runDir, event) {
  const journal = await open(path2.join(runDir, "journal.jsonl"), "a", 384);
  try {
    await journal.writeFile(JSON.stringify(event) + "\n");
    await journal.sync();
  } finally {
    await journal.close();
  }
  await writeJson(path2.join(runDir, "state.json"), event);
}
var postImportSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  runId: external_exports.uuid(),
  planDigest: digestSchema,
  projectId: refName,
  projectRoot: external_exports.string(),
  environment: refName,
  targetDigest: digestSchema,
  sourceDir: external_exports.string(),
  applicationDigest: digestSchema,
  target: external_exports.record(external_exports.string(), external_exports.unknown()),
  metadata: external_exports.strictObject({ lastUpdatedOn: external_exports.string().nullable(), lastUpdatedBy: external_exports.string().nullable() }),
  observedAt: external_exports.iso.datetime()
});
var POST_IMPORT_FILE = "post-import.json";
async function lastImportProof(ctx, name, env, local, current) {
  const runs = path2.join(ctx.root, ".apexrest/deployments");
  let refused = "no-recorded-import";
  let proof = null;
  const entries = await exists(runs) ? await readdir(runs, { withFileTypes: true }) : [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runDir = path2.join(runs, entry.name);
    try {
      if (!await exists(path2.join(runDir, POST_IMPORT_FILE))) continue;
      const record = postImportSchema.parse(await readJson(path2.join(runDir, POST_IMPORT_FILE)));
      const plan = deployPlanSchema.parse(await readJson(path2.join(runDir, "plan.json")));
      const state = await readJson(path2.join(runDir, "state.json"));
      const files = applicationFiles(ctx, plan.sources);
      if (record.runId !== entry.name || state.runId !== record.runId || state.state !== "succeeded" || plan.digest !== planDigest(plan) || record.planDigest !== plan.digest || plan.restore || plan.scope !== "full-application-import" || plan.schemaVersion === 4 && plan.importSelection.resolvedMode === "files" || plan.projectId !== ctx.config.projectId || record.projectId !== ctx.config.projectId || plan.projectRoot !== ctx.root || record.projectRoot !== ctx.root || plan.environment !== name || record.environment !== name || plan.targetDigest !== targetDigest(env) || record.targetDigest !== targetDigest(env) || record.sourceDir !== ctx.config.application.sourceDir || record.applicationDigest !== hash(canonical(files)))
        continue;
      if (canonical(files) !== canonical(local)) {
        if (refused === "no-recorded-import") refused = "local-changed-since-import";
        continue;
      }
      if (canonical(record.target) !== canonical(current.target) || canonical(record.metadata) !== canonical(current.metadata)) {
        refused = "server-changed-since-import";
        continue;
      }
      if (!proof || record.observedAt > proof.observedAt)
        proof = { runId: record.runId, observedAt: record.observedAt };
    } catch {
    }
  }
  return proof ?? { refused };
}
function sourceConflict(differences, reason) {
  const names = (change) => differences.filter((entry) => entry.change === change).map((entry) => entry.file);
  const added = names("added"), removed = names("removed"), changed = names("changed");
  const shown = differences.slice(0, 10).map((entry) => `${entry.file} (${entry.change})`).join(", ");
  const explanation = reason === "local-changed-since-import" ? " The local sources are not the ones last imported to this target." : reason === "server-changed-since-import" ? " The server changed after the last recorded import of these sources." : reason === "no-recorded-import" ? " No recorded import of these sources to this target explains the difference." : "";
  return new Fault(
    "SYNC_SOURCE_CONFLICT",
    `Local sources differ from the expected inventory in ${differences.length} file${differences.length === 1 ? "" : "s"}: ${shown}${differences.length > 10 ? ", ..." : ""}.${explanation} Staged artifacts were retained; local files were preserved.`,
    5,
    "failed",
    {
      diagnostics: differences.map((entry) => ({
        code: "SYNC_SOURCE_CONFLICT",
        file: entry.file,
        message: entry.change === "added" ? "Local file is absent from the expected inventory." : entry.change === "removed" ? "Expected file is missing locally." : "Local file differs from the expected inventory."
      })),
      differingFileCount: differences.length,
      addedFiles: added.slice(0, 50),
      removedFiles: removed.slice(0, 50),
      changedFiles: changed.slice(0, 50),
      fileListsTruncated: [added, removed, changed].some((list) => list.length > 50),
      ...reason ? { importProof: reason } : {}
    }
  );
}
var DeploymentService = class {
  constructor(oracle = new OracleAdapter()) {
    this.oracle = oracle;
  }
  oracle;
  async localTarget(ctx, plan) {
    const env = environment(ctx, plan.environment);
    if (typeof this.oracle.connectionLocality !== "function")
      return { local: false, evidence: "unconfirmed-connection-endpoint" };
    const connection = await resolveConnection(env.deployConnectionRef);
    await this.oracle.verifyTarget(env, connection);
    return this.oracle.connectionLocality(connection);
  }
  async databaseReview(ctx, plan) {
    const env = environment(ctx, plan.environment);
    const databaseOperations = [];
    for (const operation of plan.operations) {
      if (!operation.file || !["migration", "package"].includes(operation.kind)) continue;
      const sql = await readFile2(await contained(ctx.root, operation.file), "utf8");
      for (const described of inspectSql(sql)) {
        let dependencies = [], dependenciesStatus = "not-applicable";
        if (described.object && ["drop-table", "rename-column", "alter-table", "rename-object"].includes(described.action)) {
          dependenciesStatus = "unavailable";
          if (typeof this.oracle.databaseDependencies === "function") {
            try {
              dependencies = await this.oracle.databaseDependencies(
                env.parsingSchema,
                described.object,
                await resolveConnection(env.readConnectionRef)
              );
              dependenciesStatus = "read";
            } catch {
            }
          }
        }
        databaseOperations.push({ ...described, file: operation.file, dependencies, dependenciesStatus });
      }
    }
    const locality = databaseOperations.length || plan.risks.length ? await this.localTarget(ctx, plan) : { local: false, evidence: "not-needed-for-application-import" };
    return { local: locality.local, localityEvidence: locality.evidence, operations: databaseOperations };
  }
  async history(env, _connection) {
    return new LocalDeploymentControl(env).history();
  }
  /**
   * Keep the export a plan observed. Apply reuses it as the pre-import backup instead of
   * exporting the same content again (planObservation). Keeping it is an optimization:
   * when it fails, apply exports as before.
   */
  async keepPlanObservation(ctx, planId, exported) {
    const directory = planObservationDirectory(planId);
    try {
      await rm(await syncPath(ctx, directory), { recursive: true, force: true });
      await persistSnapshot(ctx, exported, directory);
    } catch {
      await rm(await syncPath(ctx, directory), { recursive: true, force: true }).catch(() => {
      });
    }
  }
  /**
   * The plan's kept export, proven to be the one the plan fingerprinted: target identity and
   * migration history are read again and, together with the kept files' digest, must reproduce
   * `plan.fingerprint`. The kept copy cannot be altered without breaking that fingerprint.
   * Server content that changed after the plan is not seen here; the fresh export immediately
   * before the first write (checkBeforeImport) must still equal the plan, which also proves the
   * kept copy equals the server state the write replaces. Returns null when there is nothing
   * usable; the caller then exports.
   */
  async planObservation(ctx, plan, env, connection, selected) {
    try {
      const directory = await syncPath(ctx, planObservationDirectory(plan.id));
      if (!await exists(directory)) return null;
      const files = await inventory(directory);
      const digest = hash(canonical(files));
      const inspection = selected && this.oracle.versionedTarget ? await this.oracle.versionedTarget(env, connection) : null;
      const target = inspection?.target ?? await this.oracle.verifyTarget(env, connection);
      if (!target.application) return null;
      const history = await this.history(env, connection);
      const fingerprint = hash(canonical({ target, history, exportDigest: digest }));
      if (fingerprint !== plan.fingerprint) return null;
      return {
        target,
        history,
        exported: { directory, files, digest },
        versions: inspection?.versions ?? null,
        fingerprint,
        kept: true
      };
    } catch {
      return null;
    }
  }
  async fingerprint(env, connection, selection, observed) {
    const inspection = observed ?? (selection && this.oracle.versionedTarget ? await this.oracle.versionedTarget(env, connection) : null);
    const target = inspection?.target ?? await this.oracle.verifyTarget(env, connection);
    const history = await this.history(env, connection);
    const exported = target.application ? selection ? await this.oracle.exportSelection(
      env,
      connection,
      selection.files,
      selection.source,
      selection.knownFiles,
      selection.exportScope
    ) : await this.oracle.exportApplication(env, connection, "APEXLANG") : null;
    return {
      target,
      history,
      exported,
      versions: inspection?.versions ?? null,
      fingerprint: hash(canonical({ target, history, exportDigest: exported?.digest ?? null }))
    };
  }
  async workingFingerprint(ctx, name, state, observedConnection) {
    const env = environment(ctx, name), connection = observedConnection ?? await resolveConnection(env.readConnectionRef);
    const { target, metadata } = await this.oracle.targetWithMetadata(env, connection);
    if (!target.application || canonical(target) !== canonical(state.target) || canonical(metadata) !== canonical(state.observedMetadata))
      throw new Fault(
        "SYNC_SERVER_CHANGED",
        "Target or update metadata changed. Explicit refresh is required after external edits.",
        5
      );
    const history = await this.history(env, connection);
    return {
      target,
      history,
      metadata,
      exported: checkpoint(state),
      versions: null,
      fingerprint: hash(canonical({ target, history, metadata }))
    };
  }
  /**
   * What changed on the server since the working copy's checkpoint (for example Page Designer
   * edits), next to what changed locally. Read-only: one export, nothing is written to the
   * project sources, the sync state or Oracle. Server rewrites that are canonical forms of the
   * same source are not reported. Without a checkpoint the server is compared with local files.
   */
  async serverChanges(ctx, name) {
    return withConnectedReads(async () => {
      const env = environment(ctx, name), store = new SyncStore(ctx, env, name), connection = await resolveConnection(env.readConnectionRef);
      const stored = await store.read();
      const state = stored && stored.status !== "invalidated" ? stored : null;
      if (state) await store.validate(state);
      const target = await this.oracle.verifyTarget(env, connection);
      if (!target.application)
        throw new Fault(
          "APPLICATION_NOT_FOUND",
          `Application ${env.applicationId} does not exist in workspace ${env.workspace}; there is nothing to compare.`,
          3,
          "blocked"
        );
      const exported = await this.oracle.exportApplication(env, connection, "APEXLANG");
      try {
        const local = applicationFiles(ctx, await sourceInventory(ctx));
        const kind = (before, after, file) => !after[file] ? "deleted" : !before[file] ? "added" : "modified";
        if (!state) {
          const differs = changedFiles(exported.files, local);
          return {
            baseline: "none",
            completeness: "textual-file-hashes-only",
            differsFromLocal: differs.map((file) => ({ file, local: kind(exported.files, local, file) })),
            nextAction: differs.length ? "No sync checkpoint exists, so server and local edits cannot be told apart. apexrest_apex_sync action:init on unchanged sources records one." : "Server and local sources are identical."
          };
        }
        const baseline = checkpoint(state);
        const changed = changedFiles(baseline.files, exported.files);
        const canonicalOnly = await canonicalOnlyChanges(ctx, baseline, exported, changed);
        const server = changed.filter((file) => !canonicalOnly.has(file));
        const localChanged = changedFiles(baseline.files, local);
        const conflicts = server.filter(
          (file) => localChanged.includes(file) && exported.files[file] !== local[file]
        );
        return {
          baseline: state.lastSuccessfulImport ? "last-successful-import" : "initial-baseline",
          completeness: "textual-file-hashes-only",
          serverChanged: server.map((file) => ({ file, change: kind(baseline.files, exported.files, file) })),
          localChanged: localChanged.map((file) => ({ file, change: kind(baseline.files, local, file) })),
          conflicts,
          nextAction: conflicts.length ? "The same files changed on the server and locally. Reconcile them before shipping; ship refuses to overwrite them." : server.length ? localChanged.length ? "Server and local changes touch different files: a selected-file ship keeps the server changes. apexrest_apex_sync action:refresh needs clean local sources." : "apexrest_apex_sync action:refresh brings the server changes into the working copy." : "The server matches the checkpoint."
        };
      } finally {
        await this.oracle.discardStage?.(exported.stage);
      }
    });
  }
  async sync(ctx, name, action, signal) {
    const env = environment(ctx, name), store = new SyncStore(ctx, env, name);
    if (action === "status") return store.status();
    return store.lock(async () => {
      const previous = await store.read(action === "refresh" || action === "invalidate");
      if (previous && ["importing", "outcome_unknown"].includes(previous.status))
        throw new Fault(
          "SYNC_BLOCKED",
          "An interrupted import needs reconciliation; sync cannot clear its ownership.",
          5
        );
      if (action === "invalidate") {
        if (previous)
          await store.write({ ...previous, status: "invalidated", revision: previous.revision + 1 });
        return store.status();
      }
      if (action === "init" && previous && previous.status !== "invalidated") {
        await store.validate(previous);
        return store.status();
      }
      if (await isProductionTarget(env))
        throw new Fault(
          "SYNC_SCOPE_UNSUPPORTED",
          "Working copies support existing development/test applications only.",
          5
        );
      if (ctx.config.application.sourceDir.startsWith(".apexrest") || ctx.config.application.sourceDir === ".")
        throw new Fault(
          "SYNC_PATH_UNSAFE",
          "Working sources must be separate from private control storage.",
          5
        );
      if (action === "refresh" && previous) {
        await checkSnapshot(ctx, checkpoint(previous));
        const source = await syncPath(ctx, previous.sourceDir);
        if (!await exists(source) || canonical(await inventory(source)) !== canonical(checkpoint(previous).files))
          throw new Fault(
            "SYNC_DIRTY",
            "Save and reconcile local edits before refresh. No export was performed.",
            5
          );
      }
      const readConnection = await resolveConnection(env.readConnectionRef), deployConnection = await resolveConnection(env.deployConnectionRef), runId = randomUUID();
      await new LocalDeploymentControl(env).acquire(runId, false);
      try {
        if (signal?.aborted) throw new Fault("CANCELLED", "Sync cancelled before export.", 6, "cancelled");
        const target = await this.oracle.verifyTarget(env, readConnection);
        if (!target.application)
          throw new Fault("SYNC_SCOPE_UNSUPPORTED", "Sync requires an existing application.", 5);
        const metadata = await this.oracle.applicationMetadata(env, readConnection);
        const exported = await this.oracle.exportApplication(env, readConnection, "APEXLANG");
        const syncId = randomUUID(), backupId = randomUUID();
        const baselineDir = ".apexrest/sync/" + targetDigest(env) + "/baselines/" + syncId + "/application";
        const baselineRoot = await syncPath(ctx, baselineDir), backupRoot = await syncPath(ctx, ".apexrest/backups/" + backupId);
        await mkdir(path2.dirname(baselineRoot), { recursive: true, mode: 448 });
        await privateCopy(exported.directory, baselineRoot);
        const baseline = { directory: baselineDir, files: exported.files, digest: exported.digest };
        await checkSnapshot(ctx, baseline);
        await mkdir(backupRoot, { recursive: true, mode: 448 });
        await privateCopy(exported.directory, path2.join(backupRoot, "application"));
        await writeJson(path2.join(backupRoot, "backup.json"), {
          schemaVersion: 1,
          backupId,
          targetDigest: targetDigest(env),
          environment: name,
          digest: exported.digest,
          files: exported.files,
          format: "APEXLANG",
          scope: "full",
          restoreProcedure: "Reviewed APEXlang import; application metadata only. Schema/data recovery is separate."
        });
        await checkSyncBackup(ctx, { backupId, checksum: exported.digest }, targetDigest(env), name);
        const observedTarget = await this.oracle.verifyTarget(env, readConnection);
        const observedMetadata = await this.oracle.applicationMetadata(env, readConnection);
        if (canonical(target) !== canonical(observedTarget) || canonical(metadata) !== canonical(observedMetadata))
          throw new Fault(
            "SYNC_SERVER_CHANGED",
            "Application changed during sync. Staged artifacts were retained.",
            5
          );
        await this.lease(env, runId, false);
        if (signal?.aborted)
          throw new Fault("CANCELLED", "Sync cancelled before installing sources.", 6, "cancelled");
        const state = {
          schemaVersion: 1,
          syncId,
          revision: (previous?.revision ?? -1) + 1,
          projectRoot: ctx.root,
          projectId: ctx.config.projectId,
          environment: name,
          targetDigest: targetDigest(env),
          target,
          sourceDir: ctx.config.application.sourceDir,
          toolchainDigest: hash(await readFile2(await contained(ctx.root, ctx.config.toolchain.lockFile))),
          runtimeVersion: VERSION,
          compilerVersion: exported.compiler.version,
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          baseline,
          backup: { backupId, checksum: exported.digest },
          observedMetadata: metadata,
          lastSuccessfulImport: null,
          status: "ready",
          importingRunId: null
        };
        const source = await syncPath(ctx, ctx.config.application.sourceDir);
        const refreshKnown = action === "refresh" && previous?.sourceDir === ctx.config.application.sourceDir;
        let normalized = [];
        let adoptedFromRun;
        if (await exists(source)) {
          const expected = refreshKnown ? checkpoint(previous).files : exported.files;
          const local = await inventory(source);
          const differences = sourceDifferences(local, expected);
          if (differences.length) {
            let adopt = action === "init" ? await generatedSourceNormalizations(
              source,
              baselineRoot,
              local,
              expected,
              env.applicationId
            ) : void 0;
            let proof;
            if (!adopt && action === "init") {
              proof = await lastImportProof(ctx, name, env, local, { target, metadata });
              if (!("refused" in proof)) {
                adopt = lastImportRewrites(local, expected);
                adoptedFromRun = proof.runId;
              }
            }
            if (!adopt)
              throw sourceConflict(differences, proof && "refused" in proof ? proof.refused : void 0);
            for (const change of adopt) {
              const target2 = await contained(source, change.file);
              if (change.action === "removed") await rm(target2);
              else {
                await mkdir(path2.dirname(target2), { recursive: true });
                await cp(await contained(baselineRoot, change.file), target2, { force: true });
              }
            }
            const installed = await inventory(source);
            if (canonical(installed) !== canonical(expected))
              throw sourceConflict(sourceDifferences(installed, expected));
            normalized = adopt;
          }
          if (refreshKnown) {
            const retained = await syncPath(
              ctx,
              ".apexrest/sync/" + targetDigest(env) + "/baselines/" + syncId + "/previous-working-copy"
            );
            const replacement = await syncPath(
              ctx,
              ".apexrest/sync/" + targetDigest(env) + "/baselines/" + syncId + "/new-working-copy"
            );
            await privateCopy(baselineRoot, replacement);
            await store.write({ ...state, status: "importing", importingRunId: runId });
            await rename(source, retained);
            try {
              await rename(replacement, source);
            } catch (error) {
              await rename(retained, source);
              throw error;
            }
          }
        } else {
          await mkdir(path2.dirname(source), { recursive: true });
          const replacement = await syncPath(
            ctx,
            ".apexrest/sync/" + targetDigest(env) + "/baselines/" + syncId + "/new-working-copy"
          );
          await privateCopy(baselineRoot, replacement);
          await store.write({ ...state, status: "importing", importingRunId: runId });
          await rename(replacement, source);
        }
        if (previous && previous.targetDigest !== state.targetDigest)
          await store.write({ ...previous, status: "invalidated", revision: previous.revision + 1 });
        await store.write(state);
        await this.oracle.discardStage?.(exported.stage);
        return normalized.length ? {
          ...await store.status(),
          normalized,
          ...adoptedFromRun ? { normalizedFromDeploymentRunId: adoptedFromRun } : {}
        } : store.status();
      } finally {
        await this.releaseLease(env, runId);
      }
    });
  }
  async releaseLease(env, runId) {
    await new LocalDeploymentControl(env).release(runId);
  }
  /** Planning only reads the target: its reads share one connected SQLcl server. */
  async plan(ctx, name, options = {}) {
    const plan = await withConnectedReads(() => this.planObserved(ctx, name, options));
    await new LocalDeploymentControl(environment(ctx, name)).registerExisting();
    return plan;
  }
  async planObserved(ctx, name, options = {}) {
    const configured = name && Object.hasOwn(ctx.config.environments, name) ? ctx.config.environments[name] : void 0;
    if (configured) await refuseProductionDeployment(configured, name);
    if (typeof options === "boolean") return this.legacyPlan(ctx, name, options);
    const requested = importOptions(options);
    if (requested.importMode === "none") return this.databasePlan(ctx, name);
    const source = await contained(ctx.root, ctx.config.application.sourceDir);
    const release = await sourceRelease(source);
    if (release !== "26.2") {
      if (requested.importMode === "files")
        throw new Fault(
          "PARTIAL_IMPORT_UNSUPPORTED",
          "File import requires an Oracle-exported 26.2 source tree.",
          3
        );
      return this.legacyPlan(ctx, name);
    }
    const stored = await new SyncStore(ctx, environment(ctx, name), name).read();
    if (requested.importMode !== "full" && stored && stored.status !== "invalidated") {
      await new SyncStore(ctx, environment(ctx, name), name).validate(stored);
      const sources = await sourceInventory(ctx);
      const local = applicationFiles(ctx, sources);
      const candidates = requested.importMode === "files" ? requested.files : changedFiles(checkpoint(stored).files, local);
      if (!candidates.length || candidates.every((file) => local[file] === checkpoint(stored).files[file])) {
        if (requested.importMode === "auto") {
          const control = new LocalDeploymentControl(environment(ctx, name));
          const [history, packages] = await Promise.all([
            control.history(),
            control.packages(ctx.config.projectId)
          ]);
          checkMigrations(ctx, sources, history);
          if (history.some((row) => row.status !== "succeeded"))
            throw new Fault(
              "MIGRATION_HISTORY_CONFLICT",
              "Resolve earlier migration outcomes before deployment.",
              5
            );
          const applied = new Map(history.map((row) => [row.version, row.checksum]));
          let pending = false;
          for (const [file, sha] of Object.entries(sources)) {
            if (file.startsWith(ctx.config.database.migrationsDir + "/")) {
              const previous = applied.get(path2.basename(file));
              if (previous && previous !== sha)
                throw new Fault("MIGRATION_HISTORY_CONFLICT", "Applied migration changed.", 5);
              if (!previous) pending = true;
            }
            if (file.startsWith(ctx.config.database.packagesDir + "/") && packages[file] !== sha)
              pending = true;
          }
          if (pending) return this.databasePlan(ctx, name);
        }
        throw new Fault(
          "NO_LOCAL_CHANGES",
          "No local changes in the requested scope; server freshness was not checked.",
          2
        );
      }
    }
    const env = environment(ctx, name), connection = await resolveConnection(env.readConnectionRef);
    const observed = this.oracle.versionedTarget ? await this.oracle.versionedTarget(env, connection) : void 0;
    const versions = observed?.versions ?? await this.oracle.targetVersions(connection);
    if (!/^26\.2(?:\.|$)/.test(versions.apexVersion) || !databaseMeetsApex262Minimum(versions.databaseVersion))
      throw new Fault(
        "APEX_VERSION_MISMATCH",
        "APEX 26.2 sources require a qualified 26.2 target and supported database release.",
        3,
        "blocked"
      );
    const partial = requested.importMode === "full" ? { reasons: ["full-import-requested"] } : await this.planFiles(ctx, name, requested, versions, void 0, observed);
    if ("plan" in partial && partial.plan) return partial.plan;
    if (requested.importMode === "files")
      throw new Fault("PARTIAL_IMPORT_UNSUPPORTED", partial.reasons.join("; "), 3, "blocked", {
        reasons: partial.reasons
      });
    const reuseIdentity = requested.importMode === "full" || !stored || stored.status === "invalidated";
    const full = await this.legacyPlan(ctx, name, false, true, reuseIdentity ? observed : void 0);
    const plan = {
      ...full,
      schemaVersion: 4,
      scope: "full-application-import",
      mode: full.schemaVersion === 1 ? "full-export" : full.mode,
      backupStrategy: full.schemaVersion === 1 ? "fresh-export" : full.backupStrategy,
      workingCopy: full.schemaVersion === 1 ? null : full.workingCopy,
      composer: full.schemaVersion === 3 ? full.composer : null,
      importSelection: {
        requestedMode: requested.importMode,
        resolvedMode: "full",
        files: [],
        reasons: partial.reasons,
        dependencies: [],
        before: null,
        effective: null,
        capabilities: { ...versions }
      }
    };
    plan.digest = planDigest(plan);
    return plan;
  }
  async planFiles(ctx, name, options, versions, desiredSource, observed) {
    const env = environment(ctx, name);
    if (await isProductionTarget(env)) return { reasons: ["production-requires-full-import"] };
    const store = new SyncStore(ctx, env, name), working = await store.read();
    if (!working || working.status === "invalidated") return { reasons: ["trusted-sync-baseline-required"] };
    await store.validate(working);
    const source = await syncPath(ctx, ctx.config.application.sourceDir);
    const sources = await sourceInventory(ctx), local = desiredSource ? await inventory(desiredSource) : applicationFiles(ctx, sources);
    const candidates = options.importMode === "files" ? options.files : changedFiles(checkpoint(working).files, local);
    if (candidates.some((file) => !local[file] || !supportedFile(file)))
      return { reasons: ["unsupported-component-files"] };
    const exportScope = candidates.every(scopedExportFile) ? "selected" : "full";
    const connection = await resolveConnection(env.readConnectionRef);
    const capabilities = await this.oracle.partialImportCapabilities(source, versions);
    if (capabilities.compilerVersion !== working.compilerVersion)
      throw new Fault(
        "SYNC_COMPILER_CHANGED",
        "Refresh the working copy explicitly after a compiler upgrade.",
        5
      );
    const current = await this.fingerprint(
      env,
      connection,
      {
        files: candidates,
        source: desiredSource ?? source,
        knownFiles: checkpoint(working).files,
        exportScope
      },
      observed
    );
    try {
      if (!current.exported) return { reasons: ["existing-application-required"] };
      if (canonical(current.target) !== canonical(working.target))
        throw new Fault("SYNC_SERVER_CHANGED", "Application identity changed since the sync baseline.", 5);
      const remote = { ...checkpoint(working).files };
      const canonicalOnly = await canonicalOnlyChanges(
        ctx,
        checkpoint(working),
        current.exported,
        candidates.filter((file) => current.exported.files[file] !== checkpoint(working).files[file])
      );
      for (const file of candidates) {
        if (canonicalOnly.has(file)) continue;
        if (current.exported.files[file]) remote[file] = current.exported.files[file];
        else delete remote[file];
      }
      const selected = selectImport(checkpoint(working).files, local, remote, options);
      const fallback = (reasons) => {
        if (selected.remoteChanges.length)
          throw new Fault(
            "SYNC_SERVER_CHANGED",
            "The server has changed and this selection needs a full import. Reconcile the observed remote changes before making a full plan.",
            5
          );
        return { reasons };
      };
      if (!capabilities.supported) return fallback(capabilities.reasons);
      if (selected.reasons.length) return fallback(selected.reasons);
      for (const file of selected.files) sqlclToken(file);
      if (current.history.some((row) => row.status !== "succeeded"))
        throw new Fault(
          "MIGRATION_HISTORY_CONFLICT",
          "Resolve earlier migration outcomes before deployment.",
          5
        );
      checkMigrations(ctx, sources, current.history);
      const history = new Map(current.history.map((row) => [String(row.version), row]));
      const packageHistory = await new LocalDeploymentControl(env).packages(ctx.config.projectId);
      for (const [file, sha] of Object.entries(sources)) {
        if (file.startsWith(ctx.config.database.packagesDir + "/")) {
          if (packageHistory[file] !== sha) return fallback(["database-operations-require-full-import"]);
          continue;
        }
        if (file.startsWith(ctx.config.database.migrationsDir + "/")) {
          const old = history.get(path2.basename(file));
          if (!old) return fallback(["database-operations-require-full-import"]);
          if (old.checksum !== sha)
            throw new Fault("MIGRATION_HISTORY_CONFLICT", "Applied migration changed.", 5);
        }
      }
      const id = randomUUID(), root = ".apexrest/plans/" + id;
      await overlaySelection(
        await syncPath(ctx, checkpoint(working).directory),
        current.exported.directory,
        candidates.filter((file) => !canonicalOnly.has(file)),
        await syncPath(ctx, root + "/before")
      );
      const beforeFiles = await inventory(await syncPath(ctx, root + "/before"));
      const before = {
        directory: root + "/before",
        files: beforeFiles,
        digest: hash(canonical(beforeFiles))
      };
      const effective = await stageSelection(
        ctx,
        before,
        desiredSource ?? source,
        selected.files,
        selected.effective,
        root + "/effective"
      );
      const validation = await this.oracle.validate(await syncPath(ctx, effective.directory));
      if (validation.compiler.version !== working.compilerVersion)
        throw new Fault("SYNC_COMPILER_CHANGED", "Compiler changed while validating the import.", 5);
      if (canonical(await sourceInventory(ctx)) !== canonical(sources))
        throw new Fault("SOURCE_DRIFT", "Sources changed during selected-file planning.", 5);
      const risks = await securityChanged(
        { root: await syncPath(ctx, effective.directory), files: effective.files },
        { root: await syncPath(ctx, before.directory), files: before.files }
      ) ? ["authentication-or-authorization-change"] : [];
      await this.keepPlanObservation(ctx, id, current.exported.directory);
      const createdAt = Date.now();
      const plan = {
        schemaVersion: 4,
        mode: "working-copy",
        backupStrategy: "fresh-export",
        workingCopy: this.syncBinding(working),
        composer: await deploymentBinding(ctx),
        id,
        projectId: ctx.config.projectId,
        projectRoot: ctx.root,
        environment: name,
        createdAt: new Date(createdAt).toISOString(),
        expiresAt: new Date(createdAt + PLAN_LIFETIME_MS).toISOString(),
        sourceDigest: hash(canonical(sources)),
        sources,
        configurationDigest: hash(canonical(ctx.config)),
        toolchainDigest: hash(await readFile2(await contained(ctx.root, ctx.config.toolchain.lockFile))),
        compiler: validation.compiler.version,
        targetDigest: targetDigest(env),
        target: current.target,
        fingerprint: current.fingerprint,
        migrationHistory: current.history,
        packageHistory,
        coordination: coordination(env),
        scope: "selected-file-import",
        operations: [{ kind: "import" }, { kind: "verify" }],
        risks,
        approval: "task-authorized",
        backupRequired: true,
        digest: "0".repeat(64),
        importSelection: {
          // importMode none never reaches file selection (plan() returns a database plan first).
          requestedMode: options.importMode,
          resolvedMode: "files",
          files: selected.files,
          reasons: exportScope === "full" ? ["shared-components-require-full-apexlang-observation"] : [],
          dependencies: selected.files.filter((file) => file.startsWith("shared-components/")),
          before,
          effective,
          capabilities,
          readbackPolicy: APEXLANG_EQUIVALENCE_POLICY,
          exportScope
        }
      };
      plan.digest = planDigest(plan);
      return { plan, reasons: [] };
    } finally {
      await this.oracle.discardStage?.(current.exported?.stage);
    }
  }
  /**
   * Migrations and changed package scripts only. The target is observed with a fresh export like a
   * full plan, so identity, drift and history checks are unchanged; nothing is backed up or imported.
   * A working copy stays bound (mode `working-copy`) so apply still checks its revision.
   */
  async databasePlan(ctx, name) {
    const full = await this.legacyPlan(ctx, name, false, true, void 0, void 0, false);
    const operations = full.operations.filter((o) => o.kind === "migration" || o.kind === "package");
    if (!operations.length)
      throw new Fault(
        "NO_DATABASE_CHANGES",
        "No pending migrations or changed package scripts; nothing to deploy to the database.",
        2
      );
    const plan = { ...full, scope: "database-only", operations, backupRequired: false };
    plan.digest = planDigest(plan);
    return plan;
  }
  async legacyPlan(ctx, name, restore = false, fresh = false, observed, backupAlias, applicationImport = true) {
    const env = environment(ctx, name);
    await refuseProductionDeployment(env, name);
    const connection = await resolveConnection(env.readConnectionRef);
    const syncStore = new SyncStore(ctx, env, name), stored = await syncStore.read();
    const working = !restore && stored?.status !== "invalidated" ? stored : null;
    const alias = restore ? backupAlias : ctx.config.application.alias;
    if (working) await syncStore.validate(working);
    if (restore && stored && ["importing", "outcome_unknown"].includes(stored.status))
      throw new Fault("SYNC_BLOCKED", "Reconcile interrupted writes before restore planning.", 5);
    const [targetCheck, sourceCheck, aliasCheck] = await Promise.allSettled([
      working && !fresh ? this.workingFingerprint(ctx, name, working) : this.fingerprint(env, connection, void 0, observed),
      (async () => {
        const sources2 = await sourceInventory(ctx);
        const startedAt = (/* @__PURE__ */ new Date()).toISOString();
        const validation2 = await this.oracle.validate(
          await contained(ctx.root, ctx.config.application.sourceDir)
        );
        await recordRevision(ctx.root, "validated", {
          revision: revisionOf(sources2),
          startedAt,
          finishedAt: (/* @__PURE__ */ new Date()).toISOString()
        }).catch(() => false);
        const lock2 = await contained(ctx.root, ctx.config.toolchain.lockFile);
        if (!await exists(lock2))
          throw new Fault("TOOLCHAIN_LOCK_REQUIRED", "The project needs its pinned toolchain lock.", 3);
        return { sources: sources2, validation: validation2, lock: lock2 };
      })(),
      // APEX imports an application whose alias another workspace application already uses
      // under a changed alias, which then fails post-import verification. Refuse it here.
      // Only without a sync baseline (a new or first-imported application); the post-import identity
      // check stays the guard, so a failed lookup never blocks planning.
      applicationImport && !working && alias && typeof this.oracle.aliasHolders === "function" ? this.oracle.aliasHolders(env, connection, alias).catch(() => []) : Promise.resolve([])
    ]);
    if (targetCheck.status === "rejected") throw targetCheck.reason;
    if (sourceCheck.status === "rejected") throw sourceCheck.reason;
    if (aliasCheck.status === "rejected") throw aliasCheck.reason;
    if (aliasCheck.value.length)
      throw new Fault(
        "APPLICATION_ALIAS_IN_USE",
        `Alias ${alias} is already used by application ${aliasCheck.value.join(", ")} in workspace ${env.workspace}. APEX would import application ${env.applicationId} under a changed alias and the deployment would fail verification. Choose an unused alias, set it in apexrest.json (application.alias) and in application.apx (alias), then plan again.`,
        5,
        "conflict",
        { alias, usedBy: aliasCheck.value }
      );
    const current = targetCheck.value, { sources, validation, lock } = sourceCheck.value, risks = [];
    if (fresh && working && current.exported) {
      const changed = changedFiles(checkpoint(working).files, current.exported.files);
      const canonicalOnly = await canonicalOnlyChanges(ctx, checkpoint(working), current.exported, changed);
      const remoteChanges = changed.filter((file) => !canonicalOnly.has(file));
      if (remoteChanges.some((file) => applicationFiles(ctx, sources)[file] !== current.exported.files[file]))
        throw new Fault(
          "SYNC_SERVER_CHANGED",
          "A full import would overwrite remote changes. Reconcile the full export first.",
          5
        );
    }
    if (working && validation.compiler.version !== working.compilerVersion)
      throw new Fault(
        "SYNC_COMPILER_CHANGED",
        "SQLcl compiler version changed. Explicit working-copy refresh is required.",
        5
      );
    const operations = [];
    const history = new Map(current.history.map((row) => [String(row.version), row]));
    if (current.history.some((row) => row.status !== "succeeded"))
      throw new Fault(
        "MIGRATION_HISTORY_CONFLICT",
        "An earlier migration has an unresolved outcome. Reconcile it before any new deployment.",
        5
      );
    checkMigrations(ctx, sources, current.history);
    const packageHistory = await new LocalDeploymentControl(env).packages(ctx.config.projectId);
    for (const [file, sha256] of Object.entries(sources)) {
      const migration = file.startsWith(ctx.config.database.migrationsDir + "/");
      const pkg = file.startsWith(ctx.config.database.packagesDir + "/");
      if (!migration && !pkg) continue;
      if (!file.endsWith(".sql"))
        throw new Fault("UNSUPPORTED_DB_SOURCE", "Database execution directories accept .sql files only.", 3);
      const sql = await readFile2(await contained(ctx.root, file), "utf8");
      const runs = migration ? !history.has(path2.basename(file)) : packageHistory[file] !== sha256;
      if (runs) risks.push(...migrationRisk(sql).map((r) => `${r}:${file}`));
      if (migration) {
        const version = path2.basename(file);
        if (!/^\d{4,}__[A-Za-z0-9_-]+\.sql$/.test(version))
          throw new Fault(
            "INVALID_MIGRATION_NAME",
            "Use ordered immutable migration names such as 0001__customers.sql.",
            2
          );
        const previous = history.get(version);
        if (previous && (previous.checksum !== sha256 || previous.status !== "succeeded"))
          throw new Fault(
            "MIGRATION_HISTORY_CONFLICT",
            "An existing migration changed checksum or has an unresolved outcome.",
            5
          );
        if (!previous) operations.push({ kind: "migration", file, sha256 });
      } else if (runs) operations.push({ kind: "package", file, sha256 });
    }
    const id = randomUUID();
    if (current.exported) {
      try {
        if (await securityChanged(
          {
            root: await contained(ctx.root, ctx.config.application.sourceDir),
            files: applicationFiles(ctx, sources)
          },
          { root: path2.resolve(ctx.root, current.exported.directory), files: current.exported.files }
        ))
          risks.push("authentication-or-authorization-change");
        if (!working || fresh)
          await this.keepPlanObservation(ctx, id, path2.resolve(ctx.root, current.exported.directory));
      } finally {
        if (!working || fresh)
          await this.oracle.discardStage?.(current.exported.stage);
      }
    }
    operations.sort(operationOrder);
    operations.push({ kind: "import" }, { kind: "verify" });
    const createdAt = Date.now();
    const plan = {
      schemaVersion: 2,
      mode: working ? "working-copy" : "full-export",
      backupStrategy: working && !fresh ? "initial-backup" : "fresh-export",
      workingCopy: working ? this.syncBinding(working) : null,
      id,
      projectId: ctx.config.projectId,
      projectRoot: ctx.root,
      environment: name,
      createdAt: new Date(createdAt).toISOString(),
      expiresAt: new Date(createdAt + PLAN_LIFETIME_MS).toISOString(),
      sourceDigest: hash(canonical(sources)),
      sources,
      configurationDigest: hash(canonical(ctx.config)),
      toolchainDigest: hash(await readFile2(lock)),
      compiler: validation.compiler.version,
      targetDigest: targetDigest(env),
      target: current.target,
      fingerprint: current.fingerprint,
      migrationHistory: current.history,
      packageHistory,
      coordination: coordination(env),
      scope: "full-application-import",
      operations,
      risks: [...new Set(risks)],
      approval: "task-authorized",
      backupRequired: !!current.target.application,
      digest: "0".repeat(64)
    };
    const composer = await deploymentBinding(ctx);
    plan.databaseReview = await this.databaseReview(ctx, plan);
    const bound = composer ? { ...plan, schemaVersion: 3, composer } : plan;
    bound.digest = planDigest(bound);
    return bound;
  }
  syncBinding(state) {
    return {
      syncId: state.syncId,
      revision: state.revision,
      baselineDigest: state.baseline.digest,
      checkpointDigest: checkpoint(state).digest,
      backupId: state.backup.backupId,
      backupChecksum: state.backup.checksum
    };
  }
  async checkWorkingPlan(ctx, plan, permitImporting = false) {
    const store = new SyncStore(ctx, environment(ctx, plan.environment), plan.environment), state = await store.read();
    if (plan.restore && state && ["importing", "outcome_unknown"].includes(state.status) && !permitImporting)
      throw new Fault("SYNC_BLOCKED", "Reconcile interrupted imports before restoring.", 5);
    if (state && state.status !== "invalidated" && (!plan.restore || plan.schemaVersion === 4 && plan.importSelection.resolvedMode === "files")) {
      if (plan.schemaVersion === 1 || plan.mode !== "working-copy" || canonical(plan.workingCopy) !== canonical(this.syncBinding(state)) || plan.compiler !== state.compilerVersion)
        throw new Fault(
          "SYNC_REPLAN_REQUIRED",
          "Plan does not bind the current working-copy revision. Re-plan.",
          5
        );
      const reviewed = checkpoint(state);
      if (!plan.risks.includes("authentication-or-authorization-change") && !(plan.schemaVersion === 4 && plan.importSelection.resolvedMode === "files") && await securityChanged(
        {
          root: await contained(ctx.root, ctx.config.application.sourceDir),
          files: applicationFiles(ctx, plan.sources)
        },
        { root: await syncPath(ctx, reviewed.directory), files: reviewed.files }
      ))
        throw new Fault("PLAN_TAMPERED", "Plan omits an authentication or authorization change.", 5);
      await store.validate(state, !(permitImporting && state.status === "importing"));
      return state;
    }
    if (plan.schemaVersion !== 1 && plan.mode === "working-copy")
      throw new Fault("SYNC_REPLAN_REQUIRED", "The reviewed working copy is no longer active.", 5);
    return null;
  }
  async checkLocal(ctx, value, permitImporting = false) {
    const plan = parse(deployPlanSchema, value), env = environment(ctx, plan.environment);
    const composer = await deploymentBinding(ctx);
    if (canonical(composer) !== canonical(plan.schemaVersion === 3 || plan.schemaVersion === 4 ? plan.composer : null))
      throw new Fault(
        "COMPOSITION_REPLAN_REQUIRED",
        "Deployment plan must bind the current materialized Composer generation.",
        5
      );
    if (plan.sourceDigest !== hash(canonical(plan.sources)) || plan.digest !== planDigest(plan))
      throw new Fault("PLAN_TAMPERED", "Plan digest verification failed.", 5);
    if (plan.projectId !== ctx.config.projectId || plan.projectRoot !== ctx.root || plan.targetDigest !== targetDigest(env))
      throw new Fault("PLAN_TARGET_MISMATCH", "Plan project or target differs from the current request.", 5);
    if (Date.parse(plan.expiresAt) <= Date.now())
      throw new Fault("PLAN_EXPIRED", "Create and review a new plan.", 5);
    const lifetime = Date.parse(plan.expiresAt) - Date.parse(plan.createdAt);
    if (!(lifetime > 0 && lifetime <= PLAN_LIFETIME_MS) || Date.parse(plan.createdAt) > Date.now() + 6e4)
      throw new Fault("PLAN_TAMPERED", "Plan lifetime exceeds the reviewed plan limit.", 5);
    if (plan.sourceDigest !== hash(canonical(await sourceInventory(ctx))) || plan.configurationDigest !== hash(canonical(ctx.config)) || plan.toolchainDigest !== hash(await readFile2(await contained(ctx.root, ctx.config.toolchain.lockFile))))
      throw new Fault("SOURCE_DRIFT", "Sources, configuration or toolchain lock changed after review.", 5);
    const databaseOnly = plan.scope === "database-only";
    if (plan.backupRequired !== (!databaseOnly && Boolean(plan.target.application)))
      throw new Fault("PLAN_TAMPERED", "Backup requirement does not match reviewed target.", 5);
    if (databaseOnly && plan.restore)
      throw new Fault("PLAN_TAMPERED", "A restore always imports the application.", 5);
    if (canonical(plan.coordination) !== canonical(coordination(env)))
      throw new Fault(
        "CONTROL_STORE_CHANGED",
        "Deployment control mode or local history store changed. Re-plan using the original durable state.",
        5
      );
    const expected = [];
    if (!plan.restore) {
      checkMigrations(ctx, plan.sources, plan.migrationHistory);
      const history = new Map(plan.migrationHistory.map((row) => [String(row.version), row]));
      for (const [file, sha256] of Object.entries(plan.sources)) {
        const kind = file.startsWith(ctx.config.database.migrationsDir + "/") ? "migration" : file.startsWith(ctx.config.database.packagesDir + "/") ? "package" : void 0;
        if (!kind) continue;
        if (!file.endsWith(".sql"))
          throw new Fault("UNSUPPORTED_DB_SOURCE", "Database sources must be SQL files.", 5);
        const previous = history.get(path2.basename(file));
        if (kind === "migration" && previous && (previous.checksum !== sha256 || previous.status !== "succeeded"))
          throw new Fault("MIGRATION_HISTORY_CONFLICT", "Migration requires reconciliation.", 5);
        const runs = kind === "migration" ? !previous : plan.packageHistory?.[file] !== sha256;
        if (!runs) continue;
        expected.push({ kind, file, sha256 });
        const risks = migrationRisk(await readFile2(await contained(ctx.root, file), "utf8")).map(
          (r) => `${r}:${file}`
        );
        if (risks.some((r) => !plan.risks.includes(r)))
          throw new Fault("PLAN_TAMPERED", "Plan omits a SQL risk.", 5);
      }
      expected.sort(operationOrder);
    } else if (plan.restore.format !== "APEXLANG") {
      if (!plan.risks.includes(legacyRestoreRisk))
        throw new Fault("PLAN_TAMPERED", "Legacy restore plan omits executable SQL. Create a new plan.", 5);
      const backup = await contained(ctx.root, ".apexrest/backups/" + plan.restore.backupId);
      const metadata = await readJson(await contained(backup, "backup.json"));
      if (metadata.environment !== plan.environment || metadata.targetDigest !== plan.targetDigest)
        throw new Fault("BACKUP_TARGET_MISMATCH", "Backup belongs to another target.", 5);
      if (metadata.format === "APEXLANG" || metadata.digest !== plan.restore.checksum)
        throw new Fault("BACKUP_INVALID", "Legacy backup metadata changed after review.", 5);
      const { file } = await readLegacyRestore(await contained(backup, "application"), plan.restore.checksum);
      if (canonical(plan.databaseReview?.operations ?? []) !== canonical([legacyRestoreOperation(plan.restore.backupId, file)]))
        throw new Fault(
          "PLAN_TAMPERED",
          "Legacy restore plan omits or changes the SQL review. Create a new plan.",
          5
        );
    }
    if (!databaseOnly) expected.push({ kind: "import" }, { kind: "verify" });
    if (databaseOnly && !expected.length)
      throw new Fault("PLAN_TAMPERED", "A database-only plan must run at least one script.", 5);
    if (canonical(expected) !== canonical(plan.operations))
      throw new Fault(
        "PLAN_TAMPERED",
        "Plan operations do not match reviewed sources and migration history.",
        5
      );
    await this.checkWorkingPlan(ctx, plan, permitImporting);
    if (plan.schemaVersion === 4 && plan.importSelection.resolvedMode === "files") {
      const selection = plan.importSelection;
      if (selection.before.directory !== ".apexrest/plans/" + plan.id + "/before" || selection.effective.directory !== ".apexrest/plans/" + plan.id + "/effective")
        throw new Fault("PLAN_TAMPERED", "Selected-import artifacts must belong to this plan.", 5);
      await checkSnapshot(ctx, selection.before);
      await checkSnapshot(ctx, selection.effective);
      const working = await this.checkWorkingPlan(ctx, plan, permitImporting);
      const selected = selectImport(
        checkpoint(working).files,
        plan.restore?.format === "APEXLANG" ? selection.effective.files : applicationFiles(ctx, plan.sources),
        selection.before.files,
        {
          importMode: selection.requestedMode,
          ...selection.requestedMode === "files" ? { files: selection.files } : {}
        }
      );
      if (selected.reasons.length || canonical(selected.files) !== canonical(selection.files) || canonical(selected.effective) !== canonical(selection.effective.files))
        throw new Fault("PLAN_TAMPERED", "Selected files do not match the reviewed three-way comparison.", 5);
      if (!plan.risks.includes("authentication-or-authorization-change") && await securityChanged(
        { root: await syncPath(ctx, selection.effective.directory), files: selection.effective.files },
        { root: await syncPath(ctx, selection.before.directory), files: selection.before.files }
      ))
        throw new Fault(
          "PLAN_TAMPERED",
          "Selected import omits its authentication or authorization risk.",
          4,
          "blocked"
        );
    }
    return { plan, env };
  }
  /** Acquire or re-confirm local schema ownership. No Oracle objects are touched. */
  async lease(env, runId, acquire) {
    const control = new LocalDeploymentControl(env);
    if (acquire) await control.acquire(runId);
    else await control.assertOwner(runId);
  }
  async apply(ctx, value, signal, progress) {
    return withSqlclTimings(() => withConnectedReads(() => this.applyObserved(ctx, value, signal, progress)));
  }
  async applyObserved(ctx, value, signal, progress) {
    const applyTimingStart = sqlclTimings().length;
    const { env, plan } = await spanned(
      "setup",
      async () => {
        const checked = await this.checkLocal(ctx, value);
        await refuseProductionDeployment(checked.env, checked.plan.environment, checked.plan.targetDigest);
        const locality = checked.plan.risks.length ? await this.localTarget(ctx, checked.plan) : { local: false };
        await authorizePlan(ctx, checked.plan, checked.env, locality.local);
        await this.oracle.requireMutationSupport();
        return checked;
      },
      { stage: "apply" }
    );
    const runId = randomUUID();
    const waiting = openSpan("ownershipWait");
    return withLock(await contained(ctx.root, ".apexrest/composer/ownership.lock"), async () => {
      waiting.end();
      await this.lease(env, runId, true);
      try {
        return await this.applyLocked(ctx, value, runId, signal, progress, applyTimingStart);
      } finally {
        const control = new LocalDeploymentControl(env);
        const owner = await control.owner();
        if (owner?.runId === runId && owner.phase !== "writing") await control.release(runId);
      }
    });
  }
  async applyLocked(ctx, value, runId, signal, progress, applyTimingStart = 0) {
    if (signal?.aborted)
      throw new Fault("CANCELLED", "Deployment cancelled before execution.", 6, "cancelled");
    const { plan, env } = await this.checkLocal(ctx, value);
    const selection = plan.schemaVersion === 4 && plan.importSelection.resolvedMode === "files" ? plan.importSelection : null;
    const scoped = selection?.exportScope !== void 0 ? {
      files: selection.files,
      source: await syncPath(ctx, selection.effective.directory),
      knownFiles: selection.before.files,
      exportScope: selection.exportScope
    } : void 0;
    const fresh = plan.schemaVersion !== 1 && plan.backupStrategy === "fresh-export";
    const readConnection = await resolveConnection(env.readConnectionRef), deployConnection = await resolveConnection(env.deployConnectionRef);
    let working = await this.checkWorkingPlan(ctx, plan);
    const syncStore = new SyncStore(ctx, env, plan.environment);
    const prepare = !plan.restore && plan.scope !== "database-only" && !!this.oracle.prepareImport;
    const runDir = path2.join(ctx.root, ".apexrest/deployments", runId);
    const importDirectory = prepare && selection ? path2.join(runDir, "snapshot", ctx.config.application.sourceDir) : void 0;
    if (importDirectory) await mkdir(importDirectory, { recursive: true, mode: 448 });
    const preparing = prepare ? openSpan("compilerPreparation", void 0, { background: true }) : void 0;
    const warmImport = prepare ? await this.oracle.prepareImport(
      await contained(ctx.root, ctx.config.application.sourceDir),
      deployConnection,
      importDirectory
    ).catch(() => void 0) : void 0;
    const ready = warmImport?.ready;
    if (!warmImport) preparing?.end({ prepared: false });
    else if (ready)
      void ready.then(
        (usable) => preparing?.end({ prepared: usable !== false }),
        (error) => preparing?.fail(error)
      );
    else preparing?.end({ prepared: true });
    try {
      return await this.applyPrepared(
        ctx,
        plan,
        env,
        runId,
        selection,
        scoped,
        fresh,
        working,
        signal,
        progress,
        applyTimingStart
      );
    } finally {
      await warmImport?.close().catch(() => {
      });
      for (let directory = importDirectory; directory && directory.startsWith(runDir); directory = path2.dirname(directory)) {
        try {
          await rmdir(directory);
        } catch {
          break;
        }
      }
    }
  }
  async applyPrepared(ctx, plan, env, runId, selection, scoped, fresh, working, signal, progress, applyTimingStart) {
    const readConnection = await resolveConnection(env.readConnectionRef), deployConnection = await resolveConnection(env.deployConnectionRef);
    const syncStore = new SyncStore(ctx, env, plan.environment);
    const freshTarget = (async () => {
      if (working && !selection && !fresh) return this.workingFingerprint(ctx, plan.environment, working);
      const kept = fresh ? await this.planObservation(ctx, plan, env, readConnection, !!selection) : null;
      return kept ?? this.fingerprint(env, readConnection, scoped);
    })();
    const observing = openSpan("targetObservation");
    const [deployTargetCheck, fingerprintCheck, capabilityCheck] = await Promise.allSettled([
      canonical(readConnection) === canonical(deployConnection) ? freshTarget.then((observation) => observation.target) : this.oracle.verifyTarget(env, deployConnection),
      freshTarget,
      this.oracle.requireCapability("import")
    ]);
    observing.end({
      observation: fingerprintCheck.status === "fulfilled" && "kept" in fingerprintCheck.value ? "retained-plan-observation" : working && !selection && !fresh ? "working-copy" : "fresh-export"
    });
    const liveStage = (!working || selection || fresh) && fingerprintCheck.status === "fulfilled" ? fingerprintCheck.value.exported?.stage : void 0;
    let backupSource = null;
    let backupOrigin;
    try {
      if (deployTargetCheck.status === "rejected") throw deployTargetCheck.reason;
      if (fingerprintCheck.status === "rejected") throw fingerprintCheck.reason;
      const live = fingerprintCheck.value;
      if (live.fingerprint !== plan.fingerprint)
        throw new Fault("TARGET_DRIFT", "Target or migration history changed after review.", 5);
      if (fresh && live.exported) {
        backupOrigin = "kept" in live ? "retained-plan-observation" : "start-observation-export";
        if ("kept" in live)
          backupSource = {
            directory: planObservationDirectory(plan.id),
            files: live.exported.files,
            digest: live.exported.digest
          };
        else {
          await rm(await syncPath(ctx, planObservationDirectory(plan.id)), { recursive: true, force: true });
          backupSource = await persistSnapshot(
            ctx,
            live.exported.directory,
            planObservationDirectory(plan.id)
          );
        }
      }
      if (canonical(live.target) !== canonical(plan.target) || canonical(live.history) !== canonical(plan.migrationHistory))
        throw new Fault("PLAN_TAMPERED", "Plan target or migration history differs from the live target.", 5);
      if (!working && !plan.restore && live.exported && !plan.risks.includes("authentication-or-authorization-change") && await securityChanged(
        {
          root: await contained(ctx.root, ctx.config.application.sourceDir),
          files: applicationFiles(ctx, plan.sources)
        },
        { root: live.exported.directory, files: live.exported.files }
      ))
        throw new Fault("PLAN_TAMPERED", "Plan omits an authentication or authorization change.", 5);
    } finally {
      await this.oracle.discardStage?.(liveStage);
    }
    const liveApplication = fingerprintCheck.value.target.application ?? deployTargetCheck.value.application;
    if (capabilityCheck.status === "rejected") throw capabilityCheck.reason;
    const capability = capabilityCheck.value;
    if (capability.version !== plan.compiler)
      throw new Fault("COMPILER_DRIFT", "SQLcl version changed after plan.", 5);
    if (plan.schemaVersion === 4 && !selection && plan.importSelection.capabilities.apexVersion) {
      const versions = await this.oracle.targetVersions(readConnection);
      if (canonical(versions) !== canonical(plan.importSelection.capabilities))
        throw new Fault("TARGET_DRIFT", "Target release changed after the full-import plan.", 5);
    }
    if (selection) {
      const observed = await this.oracle.partialImportCapabilities(
        await syncPath(ctx, selection.effective.directory),
        fingerprintCheck.value.versions ?? await this.oracle.targetVersions(readConnection)
      );
      if (!observed.supported || canonical(observed) !== canonical(selection.capabilities))
        throw new Fault("COMPILER_DRIFT", "Selected-import capabilities changed after planning.", 5);
    }
    if (signal?.aborted)
      throw new Fault("CANCELLED", "Deployment cancelled before lease acquisition.", 6, "cancelled");
    const runs = path2.join(ctx.root, ".apexrest/deployments"), runDir = path2.join(runs, runId);
    await mkdir(runDir, { recursive: true, mode: 448 });
    let state = "planned", writeStarted = false, importConfirmed = false, importRejected = false, syncMarked = false, syncSucceeded = false;
    let freshBackupId = null;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    let timingCursor = applyTimingStart;
    const revisionStartedAt = (/* @__PURE__ */ new Date()).toISOString();
    const recordRunRevision = async (nextState, details) => {
      const revision = plan.sourceDigest;
      const kind = nextState === "migrating" ? "importing" : nextState === "succeeded" ? "deployed" : nextState === "failed" ? "failed" : void 0;
      if (!revision || !kind) return;
      try {
        const code = details?.code;
        await recordRevision(ctx.root, kind, {
          revision,
          startedAt: revisionStartedAt,
          finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
          environment: plan.environment,
          runId,
          ...kind === "failed" && typeof code === "string" ? { detail: { code } } : {}
        });
      } catch {
      }
    };
    let readback;
    const record = async (nextState, details = {}) => {
      assertTransition(state, nextState);
      const timingPhase = state;
      state = nextState;
      if (nextState === "verifying") readback = openSpan("readback");
      else if (timingPhase === "verifying" && nextState === "succeeded") readback?.end();
      else if (timingPhase === "verifying")
        readback?.fail(new Fault(nextState === "failed" ? "FAILED" : "OUTCOME_UNKNOWN", "", 1, nextState));
      const terminal = ["succeeded", "failed", "outcome_unknown"].includes(nextState);
      const trace = correlationId();
      try {
        progress?.(nextState);
      } catch {
      }
      const event = {
        runId,
        planId: plan.id,
        planDigest: plan.digest,
        targetDigest: plan.targetDigest,
        state,
        at: (/* @__PURE__ */ new Date()).toISOString(),
        ...trace ? { correlationId: trace } : {},
        details: {
          ...details,
          sqlclTimings: sqlclTimings().slice(timingCursor),
          timingPhase,
          // The operation spans so far, on the run's last event (unfinished ones without an end).
          ...terminal && trace ? { operations: traceReport() } : {}
        }
      };
      timingCursor = sqlclTimings().length;
      await appendJournal(runDir, event);
      await recordRunRevision(nextState, details);
    };
    await writeJson(path2.join(runDir, "plan.json"), plan);
    await record("approved");
    await this.lease(env, runId, false);
    try {
      await record("backing_up");
      const backingUp = openSpan("backup");
      working = await this.checkWorkingPlan(ctx, plan);
      if (working) await checkSyncBackup(ctx, working.backup, plan.targetDigest, plan.environment);
      const databaseOnly = plan.scope === "database-only";
      backingUp.set({
        path: databaseOnly || !(plan.backupRequired || liveApplication) ? "none" : working && !selection && !fresh ? "working-copy-baseline" : backupSource ? backupOrigin ?? "retained-plan-observation" : "fresh-export"
      });
      if (!databaseOnly && (plan.backupRequired || liveApplication) && (!working || selection || fresh)) {
        const backup = backupSource ?? await spanned(
          "backupExport",
          () => this.oracle.exportApplication(env, readConnection, "APEXLANG"),
          void 0,
          backingUp.id
        );
        const copying = openSpan("backupCopyHash", void 0, { parent: backingUp.id });
        try {
          const backupId = randomUUID(), directory = path2.join(ctx.root, ".apexrest/backups", backupId);
          await mkdir(directory, { recursive: true, mode: 448 });
          const backupPath = backup.directory.startsWith(".apexrest/") ? await syncPath(ctx, backup.directory) : backup.directory;
          await privateCopy(backupPath, path2.join(directory, "application"));
          const files = await inventory(path2.join(directory, "application"));
          if (!scoped && !Object.keys(files).length || hash(canonical(files)) !== backup.digest)
            throw new Fault("BACKUP_INVALID", "Backup copy failed checksum verification.", 1);
          await writeJson(path2.join(directory, "backup.json"), {
            schemaVersion: 1,
            backupId,
            runId,
            planDigest: plan.digest,
            targetDigest: plan.targetDigest,
            environment: plan.environment,
            digest: backup.digest,
            files,
            format: "APEXLANG",
            scope: scoped ? "selected" : "full",
            ...scoped ? { selectedFiles: scoped.files, absentFiles: scoped.files.filter((file) => !files[file]) } : {},
            ...typeof liveApplication?.alias === "string" ? { alias: liveApplication.alias } : {},
            restoreProcedure: "Reviewed APEXlang import in the recorded scope; newly created components have no previous source to restore. Schema/data recovery is separate."
          });
          freshBackupId = backupId;
          await writeJson(path2.join(runDir, "backup.json"), {
            backupId,
            checksum: backup.digest,
            targetDigest: plan.targetDigest
          });
          copying.end({ files: Object.keys(files).length });
        } catch (error) {
          copying.fail(error);
          throw error;
        } finally {
          await this.oracle.discardStage?.(backup.stage);
        }
      }
      backingUp.end();
      await this.checkLocal(ctx, plan);
      if ((!working || selection) && !fresh) {
        const after = await spanned("backupDriftCheck", () => this.fingerprint(env, readConnection, scoped));
        try {
          if (after.fingerprint !== plan.fingerprint)
            throw new Fault("TARGET_DRIFT", "Target changed during backup.", 5);
        } finally {
          await this.oracle.discardStage?.(after.exported?.stage);
        }
      }
      const snapshot = path2.join(runDir, "snapshot");
      const freezing = openSpan("sourceFreeze", { files: Object.keys(plan.sources).length });
      await mkdir(snapshot, { recursive: true, mode: 448 });
      for (const [file, sha] of Object.entries(plan.sources)) {
        const source = await contained(ctx.root, file), destination = await contained(snapshot, file);
        await mkdir(path2.dirname(destination), { recursive: true });
        await cp(source, destination);
        if (hash(await readFile2(destination)) !== sha)
          throw new Fault("SOURCE_DRIFT", "Source changed while freezing deployment.", 5);
      }
      if (selection) {
        await checkSnapshot(ctx, selection.effective);
        const application = path2.join(snapshot, ctx.config.application.sourceDir);
        for (const entry of await readdir(application))
          await rm(path2.join(application, entry), { recursive: true });
        await privateCopy(await syncPath(ctx, selection.effective.directory), application);
        if (canonical(await inventory(application)) !== canonical(selection.effective.files))
          throw new Fault("SOURCE_DRIFT", "Selected source changed while freezing deployment.", 5);
      }
      freezing.end();
      if (controller.signal.aborted)
        throw new Fault("CANCELLED", "Deployment cancelled before writes.", 6, "cancelled");
      if (working && !databaseOnly) {
        await syncStore.lock(async () => {
          await this.checkWorkingPlan(ctx, plan);
          await syncStore.write({ ...working, status: "importing", importingRunId: runId });
          syncMarked = true;
        });
      }
      const completedMigrations = [];
      const checkBeforeImport = () => spanned("prewriteObservation", checkBeforeImportNow);
      const checkBeforeImportNow = async () => {
        const sameConnection = canonical(readConnection) === canonical(deployConnection);
        const observation = working && !selection && !fresh ? await this.workingFingerprint(
          ctx,
          plan.environment,
          working,
          sameConnection ? deployConnection : readConnection
        ) : await this.fingerprint(env, readConnection, scoped);
        try {
          const expectedHistory = [...plan.migrationHistory, ...completedMigrations].sort(
            (a, b) => String(a.version).localeCompare(String(b.version))
          );
          if (canonical(observation.history) !== canonical(expectedHistory))
            throw new Fault("TARGET_DRIFT", "Migration history changed before import.", 5);
          const fingerprint = completedMigrations.length ? hash(
            canonical({
              target: observation.target,
              history: plan.migrationHistory,
              ..."metadata" in observation ? { metadata: observation.metadata } : { exportDigest: observation.exported?.digest ?? null }
            })
          ) : observation.fingerprint;
          if (fingerprint !== plan.fingerprint)
            throw new Fault("TARGET_DRIFT", "Target changed before import.", 5);
          if (!sameConnection) await this.oracle.verifyTarget(env, deployConnection);
        } finally {
          if (!working || selection || fresh)
            await this.oracle.discardStage?.(observation.exported?.stage);
        }
      };
      if (plan.operations.some((o) => ["migration", "package"].includes(o.kind))) await checkBeforeImport();
      await record("migrating");
      await new LocalDeploymentControl(env).markWriting(runId);
      const scripts = plan.operations.filter((o) => ["migration", "package"].includes(o.kind));
      const scripting = scripts.length ? openSpan("scripts", { count: scripts.length }) : void 0;
      const scriptSession = scripts.length > 1 ? await this.oracle.prepareScripts?.(deployConnection).catch(() => void 0) : void 0;
      try {
        for (const operation of scripts) {
          if (controller.signal.aborted)
            throw new Fault(
              "LEASE_OR_CANCELLATION",
              "Execution was interrupted.",
              6,
              writeStarted ? "outcome_unknown" : "cancelled"
            );
          await this.lease(env, runId, false);
          const file = await contained(snapshot, operation.file);
          if (operation.kind === "migration")
            await new LocalDeploymentControl(env).migration(
              runId,
              path2.basename(file),
              operation.sha256,
              "started"
            );
          writeStarted = true;
          const marker = scriptCompletionMarker();
          const executed = await this.oracle.session(
            `@${sqlclToken(file)}
prompt ${marker}`,
            deployConnection,
            true,
            controller.signal,
            void 0,
            "text",
            SCRIPT_RESTRICT_LEVEL,
            false,
            "session",
            scriptSession?.usable ? scriptSession : void 0
          );
          if (!scriptCompleted(executed?.output, marker))
            throw new Fault(
              "SCRIPT_INCOMPLETE",
              `SQLcl did not confirm that ${path2.basename(file)} ran to completion.`,
              6,
              "outcome_unknown"
            );
          if (operation.kind === "package")
            await new LocalDeploymentControl(env).packageApplied(
              runId,
              ctx.config.projectId,
              operation.file,
              operation.sha256
            );
          if (operation.kind === "migration") {
            await new LocalDeploymentControl(env).migration(
              runId,
              path2.basename(file),
              operation.sha256,
              "succeeded"
            );
            completedMigrations.push({
              version: path2.basename(file),
              checksum: operation.sha256,
              status: "succeeded",
              run_id: runId
            });
          }
        }
        scripting?.end();
      } catch (error) {
        scripting?.fail(error);
        throw error;
      } finally {
        await scriptSession?.close();
      }
      if (databaseOnly) {
        await this.oracle.verifyTarget(env, readConnection);
        await record("succeeded");
        return { runId, state, directory: runDir };
      }
      await record("importing");
      await this.lease(env, runId, false);
      const previousAlias = plan.target.application?.alias;
      const expectedAlias = plan.restore ? plan.restore.alias ?? (typeof previousAlias === "string" ? previousAlias : ctx.config.application.alias) : ctx.config.application.alias;
      if (plan.restore && plan.restore.format !== "APEXLANG") {
        const backupRoot = await contained(
          ctx.root,
          ".apexrest/backups/" + plan.restore.backupId + "/application"
        );
        const { file, bytes } = await readLegacyRestore(backupRoot, plan.restore.checksum);
        await atomicWrite(path2.join(runDir, "restore", file), bytes);
        const restoredSync = await syncStore.read();
        if (restoredSync && restoredSync.status !== "invalidated")
          await syncStore.lock(
            () => syncStore.write({ ...restoredSync, status: "invalidated", revision: restoredSync.revision + 1 })
          );
        await checkBeforeImport();
        if (controller.signal.aborted)
          throw new Fault("CANCELLED", "Deployment cancelled before import.", 6, "cancelled");
        writeStarted = true;
        await spanned(
          "importSubmission",
          () => this.oracle.restoreApplication(env, deployConnection, bytes, controller.signal),
          { kind: "restore" }
        );
      } else {
        if (plan.restore && hash(
          canonical(
            await inventory(
              await syncPath(ctx, ".apexrest/backups/" + plan.restore.backupId + "/application")
            )
          )
        ) !== plan.restore.checksum)
          throw new Fault("BACKUP_INVALID", "Restore source changed after approval.", 5);
        if (selection && canonical(await inventory(path2.join(snapshot, ctx.config.application.sourceDir))) !== canonical(selection.effective.files))
          throw new Fault("SOURCE_DRIFT", "Frozen selected source changed before import.", 5);
        if (controller.signal.aborted)
          throw new Fault("CANCELLED", "Deployment cancelled before import.", 6, "cancelled");
        let importSource = path2.join(snapshot, ctx.config.application.sourceDir);
        if (plan.restore && !selection) {
          const frozen = path2.join(runDir, "restore");
          await privateCopy(
            await syncPath(ctx, ".apexrest/backups/" + plan.restore.backupId + "/application"),
            frozen
          );
          if (hash(canonical(await inventory(frozen))) !== plan.restore.checksum)
            throw new Fault("BACKUP_INVALID", "Restore copy changed.", 5);
          importSource = frozen;
          const restoredSync = await syncStore.read();
          if (restoredSync && restoredSync.status !== "invalidated")
            await syncStore.lock(
              () => syncStore.write({
                ...restoredSync,
                status: "invalidated",
                revision: restoredSync.revision + 1
              })
            );
        }
        await checkBeforeImport();
        if (selection && canonical(await inventory(importSource)) !== canonical(selection.effective.files))
          throw new Fault("SOURCE_DRIFT", "Frozen selected source changed before import.", 5);
        const composer = (plan.schemaVersion === 3 || plan.schemaVersion === 4) && plan.composer;
        if (!plan.restore && composer) {
          try {
            await verifyDeploymentPredicates(
              ctx,
              composer,
              env,
              readConnection,
              this.oracle,
              controller.signal
            );
          } catch (error) {
            importRejected = true;
            throw error;
          }
        }
        if (controller.signal.aborted)
          throw new Fault("CANCELLED", "Deployment cancelled before import.", 6, "cancelled");
        writeStarted = true;
        const importTimings = sqlclTimings().length;
        const importing = openSpan("importSubmission", { kind: selection ? "selected-files" : "full" });
        try {
          await this.oracle.importApplication(
            plan.restore && !selection ? {
              ...ctx,
              config: { ...ctx.config, application: { ...ctx.config.application, alias: expectedAlias } }
            } : ctx,
            env,
            deployConnection,
            importSource,
            controller.signal,
            selection?.files
          );
          const timing = sqlclTimings().slice(importTimings).find((entry) => entry.label === "import");
          importing.end(
            timing ? {
              transport: timing.transport,
              reusedServer: timing.reused,
              ...timing.connectMs !== null ? { connectMs: Math.round(timing.connectMs) } : {},
              ...timing.spawnMs !== null ? { spawnMs: Math.round(timing.spawnMs) } : {},
              executeMs: Math.round(timing.executeMs)
            } : void 0
          );
        } catch (error) {
          importing.fail(error);
          if (!(error instanceof Fault) || error.code !== "ORACLE_COMMAND_FAILED" || CONNECTION_LOST.test(error.message) || controller.signal.aborted)
            throw error;
          try {
            await checkBeforeImport();
          } catch {
            throw error;
          }
          importRejected = true;
          throw new Fault(
            "IMPORT_REJECTED",
            `Oracle rejected the import and the target is unchanged (confirmed by a fresh read). Fix the reported source and ship again.
${error.message}`,
            1,
            "failed",
            { ...error.details, targetUnchanged: true }
          );
        }
      }
      importConfirmed = true;
      const recordsImport = !plan.restore && !selection;
      let serverSnapshot = null;
      let target;
      let postImportMetadata;
      try {
        await record("verifying");
        if (working) {
          const observed = await this.oracle.targetWithMetadata(env, readConnection);
          target = observed.target;
          postImportMetadata = observed.metadata;
        } else if (recordsImport && typeof this.oracle.targetWithMetadata === "function") {
          try {
            const observed = await this.oracle.targetWithMetadata(env, readConnection);
            target = observed.target;
            postImportMetadata = observed.metadata;
          } catch {
            target = await this.oracle.verifyTarget(env, readConnection);
          }
        } else target = await this.oracle.verifyTarget(env, readConnection);
        if (!target.application || String(target.application.alias).toLowerCase() !== String(expectedAlias).toLowerCase())
          throw new Fault(
            "POST_DEPLOY_IDENTITY_FAILED",
            target.application ? `Application ${env.applicationId} was imported with alias ${String(target.application.alias)}, not ${String(expectedAlias)}: another application in workspace ${env.workspace} probably uses that alias. Change application.alias in apexrest.json and application.apx to an unused alias, then ship again.` : `Application ${env.applicationId} was not found in workspace ${env.workspace} after the import.`,
            1,
            "failed",
            {
              deploymentRunId: runId,
              expectedAlias: String(expectedAlias),
              ...target.application ? { observedAlias: String(target.application.alias) } : {}
            }
          );
        if (selection) {
          const observed = scoped ? await this.oracle.exportSelection(
            env,
            readConnection,
            scoped.files,
            scoped.source,
            selection.effective.files,
            scoped.exportScope
          ) : await this.oracle.exportApplication(env, readConnection, "APEXLANG");
          try {
            serverSnapshot = await persistSnapshot(
              ctx,
              observed.directory,
              ".apexrest/deployments/" + runId + "/server/" + ctx.config.application.sourceDir
            );
            const comparison = selection.readbackPolicy === APEXLANG_EQUIVALENCE_POLICY ? await compareApplicationExports(
              await syncPath(ctx, selection.effective.directory),
              await syncPath(ctx, serverSnapshot.directory),
              scoped ? pickFiles(selection.effective.files, selection.files) : selection.effective.files,
              serverSnapshot.files,
              selection.files
            ) : {
              equivalent: canonical(serverSnapshot.files) === canonical(selection.effective.files),
              policy: "exact-bytes",
              normalizations: []
            };
            await writeJson(path2.join(runDir, "readback-verification.json"), {
              ...comparison,
              scope: scoped ? "selected" : "full",
              sourceObservationScope: selection.exportScope ?? "full",
              verifiedFiles: selection.files,
              unselectedServerContentChecked: !scoped
            });
            if (!comparison.equivalent)
              throw new Fault(
                "POST_DEPLOY_CONTENT_FAILED",
                "Import confirmed but readback differs from the reviewed result; reconcile the retained server snapshot.",
                5
              );
            if (scoped) {
              const mergedDirectory = ".apexrest/deployments/" + runId + "/snapshot/" + ctx.config.application.sourceDir;
              await overlaySelection(
                await syncPath(ctx, selection.before.directory),
                observed.directory,
                selection.files,
                await syncPath(ctx, mergedDirectory)
              );
              const mergedFiles = await inventory(await syncPath(ctx, mergedDirectory));
              serverSnapshot = {
                directory: mergedDirectory,
                files: mergedFiles,
                digest: hash(canonical(mergedFiles))
              };
            }
          } finally {
            await this.oracle.discardStage?.(observed.stage);
          }
        }
      } catch (error) {
        if (error instanceof Fault) throw error;
        throw new Fault(
          "POST_DEPLOY_VERIFICATION_FAILED",
          `Import was confirmed but verification failed: ${error instanceof Error ? error.message : "unexpected error"}`,
          1
        );
      }
      if (working) {
        await this.completeWorkingCopy(
          ctx,
          plan,
          env,
          runId,
          working,
          target,
          serverSnapshot,
          postImportMetadata
        );
        syncSucceeded = true;
      }
      if (recordsImport && postImportMetadata) {
        try {
          const files = applicationFiles(ctx, plan.sources);
          await writeJson(
            path2.join(runDir, POST_IMPORT_FILE),
            postImportSchema.parse({
              schemaVersion: 1,
              runId,
              planDigest: plan.digest,
              projectId: plan.projectId,
              projectRoot: plan.projectRoot,
              environment: plan.environment,
              targetDigest: plan.targetDigest,
              sourceDir: ctx.config.application.sourceDir,
              applicationDigest: hash(canonical(files)),
              target,
              metadata: postImportMetadata,
              observedAt: (/* @__PURE__ */ new Date()).toISOString()
            })
          );
        } catch {
        }
      }
      await record("succeeded");
      return { runId, state, directory: runDir, ...freshBackupId ? { backupId: freshBackupId } : {} };
    } catch (error) {
      const unknown = writeStarted && !importRejected && (!importConfirmed || !(error instanceof Fault) || error.exitCode === 6);
      const applicationWritten = writeStarted && !importRejected;
      if (working && syncMarked) {
        try {
          await syncStore.lock(async () => {
            const owned = await syncStore.read();
            if (!owned || owned.importingRunId !== runId && owned.lastSuccessfulImport?.runId !== runId)
              throw new Error("Sync ownership changed during failure recording.");
            const status = unknown ? "outcome_unknown" : applicationWritten ? "verification_failed" : "ready";
            await syncStore.write(
              syncSucceeded || owned.lastSuccessfulImport?.runId === runId ? { ...owned, status, importingRunId: status === "ready" ? null : runId } : { ...working, importingRunId: applicationWritten ? runId : null, status }
            );
          });
        } catch {
          state = "outcome_unknown";
          throw new Fault(
            "OUTCOME_UNKNOWN",
            `Deployment ${runId} needs reconciliation; durable sync state could not be saved.`,
            6,
            "outcome_unknown"
          );
        }
      }
      await record(unknown ? "outcome_unknown" : "failed", {
        code: error instanceof Fault ? error.code : "UNEXPECTED_FAILURE"
      });
      if (unknown)
        throw new Fault(
          "OUTCOME_UNKNOWN",
          `Deployment ${runId} requires reconciliation before retry.`,
          6,
          "outcome_unknown",
          { deploymentRunId: runId, cause: error instanceof Fault ? error.code : "UNEXPECTED_FAILURE" }
        );
      if (error instanceof Fault) error.details = { ...error.details, deploymentRunId: runId };
      throw error;
    } finally {
      signal?.removeEventListener("abort", abort);
      if (state !== "outcome_unknown")
        await new LocalDeploymentControl(env).release(runId).catch(() => {
        });
    }
  }
  /** Record a confirmed, verified import as the working copy's new successful checkpoint. */
  async completeWorkingCopy(ctx, plan, env, runId, working, target, serverSnapshot, metadata) {
    const selection = plan.schemaVersion === 4 && plan.importSelection.resolvedMode === "files" ? plan.importSelection : null;
    const syncStore = new SyncStore(ctx, env, plan.environment);
    const directory = ".apexrest/deployments/" + runId + "/snapshot/" + ctx.config.application.sourceDir;
    const files = await inventory(await syncPath(ctx, directory));
    const snapshot = serverSnapshot ?? { directory, files, digest: hash(canonical(files)) };
    if (selection && serverSnapshot) {
      try {
        await rebaseAfterImport(
          ctx,
          runId,
          applicationFiles(ctx, plan.sources),
          checkpoint(working).files,
          serverSnapshot,
          selection.files
        );
      } catch (error) {
        if (error instanceof Fault) throw error;
        throw new Fault(
          "LOCAL_RECONCILIATION_REQUIRED",
          "Import confirmed; local rebase failed. Inspect the retained source and server snapshots.",
          5
        );
      }
    }
    await syncStore.lock(async () => {
      const state = await syncStore.read();
      if (!state || state.importingRunId !== runId || state.revision !== working.revision)
        throw new Error("Sync ownership changed after import.");
      await syncStore.write({
        ...state,
        status: "ready",
        revision: state.revision + 1,
        importingRunId: null,
        observedMetadata: metadata,
        target,
        lastSuccessfulImport: {
          at: (/* @__PURE__ */ new Date()).toISOString(),
          runId,
          snapshot,
          ...selection?.exportScope !== void 0 ? { verifiedFiles: selection.files } : {}
        },
        recoveryCheckpoint: null
      });
    });
  }
  async recoveryRead(ctx, runId, requestedEnvironment) {
    parse(external_exports.uuid(), runId);
    const directory = await contained(ctx.root, ".apexrest/deployments/" + runId);
    if (!await exists(path2.join(directory, "plan.json")))
      throw new Fault(
        "DEPLOYMENT_RUN_NOT_FOUND",
        `No deployment run ${runId} exists in this project. Pass the deploymentRunId from the failed apexrest_ship result (data.deploymentRunId), not the result's runId or a jobId.`,
        2
      );
    const plan = parse(deployPlanSchema, await readJson(path2.join(directory, "plan.json")));
    if (requestedEnvironment !== void 0 && requestedEnvironment !== plan.environment)
      throw new Fault(
        "PLAN_ENVIRONMENT_MISMATCH",
        "The interrupted deployment belongs to a different environment. Use the environment recorded with the run.",
        5
      );
    const env = environment(ctx, plan.environment);
    if (plan.digest !== planDigest(plan) || plan.projectRoot !== ctx.root || plan.projectId !== ctx.config.projectId || plan.targetDigest !== targetDigest(env))
      throw new Fault("PLAN_TARGET_MISMATCH", "Reconciliation must use the original project and target.", 5);
    if (canonical(plan.coordination) !== canonical(coordination(env)))
      throw new Fault(
        "COORDINATION_STORE_CHANGED",
        "Reconciliation requires the original managed coordination home.",
        5
      );
    const control = new LocalDeploymentControl(env), owner = await control.owner();
    if (owner && owner.runId !== runId) throw new Fault("TARGET_LOCKED", "Another run owns this schema.", 5);
    const selection = plan.schemaVersion === 4 && plan.importSelection.resolvedMode === "files" ? plan.importSelection : null;
    const scoped = selection?.exportScope !== void 0 ? {
      files: selection.files,
      source: await syncPath(ctx, selection.effective.directory),
      knownFiles: selection.before.files,
      exportScope: selection.exportScope
    } : void 0;
    const current = await this.fingerprint(env, await resolveConnection(env.readConnectionRef), scoped);
    if (canonical(current.target.identity) !== canonical(plan.target.identity) || canonical(current.target.workspace) !== canonical(plan.target.workspace) || plan.target.application && canonical(current.target.application) !== canonical(plan.target.application))
      throw new Fault(
        "IDENTITY_MISMATCH",
        "The actual server/application identity changed before reconciliation.",
        5
      );
    const state = await readJson(path2.join(directory, "state.json"));
    const expectedDirectory = selection?.effective?.directory ?? ".apexrest/deployments/" + runId + "/snapshot/" + ctx.config.application.sourceDir;
    const expectedInventory = selection?.effective?.files ?? applicationFiles(ctx, plan.sources);
    const expectedFiles = scoped ? pickFiles(expectedInventory, selection.files) : expectedInventory;
    const expectedRoot = await syncPath(ctx, expectedDirectory);
    const workingState = plan.schemaVersion !== 1 && plan.workingCopy ? await new SyncStore(ctx, env, plan.environment).read() : null;
    const before = selection?.before ?? (workingState ? checkpoint(workingState) : null);
    const allowed = selection?.files ?? Object.keys(expectedFiles).filter((file) => file.endsWith(".apx"));
    let comparison = null;
    let conflictFiles = [];
    if (current.exported && !plan.restore && await exists(expectedRoot)) {
      if (canonical(await inventory(expectedRoot)) !== canonical(expectedInventory))
        throw new Fault("SOURCE_DRIFT", "The frozen reviewed sources changed before reconciliation.", 5);
      comparison = await compareApplicationExports(
        expectedRoot,
        current.exported.directory,
        expectedFiles,
        current.exported.files,
        allowed
      );
      if (!comparison.equivalent) {
        if (!before) conflictFiles = comparison.mismatchedFiles;
        else
          for (const file of comparison.mismatchedFiles) {
            const prior = await compareApplicationExports(
              await syncPath(ctx, before.directory),
              current.exported.directory,
              before.files[file] ? { [file]: before.files[file] } : {},
              current.exported.files[file] ? { [file]: current.exported.files[file] } : {},
              allowed
            );
            if (!prior.equivalent) conflictFiles.push(file);
          }
      }
    } else conflictFiles = ["reviewed-source-or-server-export-unavailable"];
    if (current.fingerprint === plan.fingerprint) conflictFiles = [];
    const databaseOperations = plan.operations.some(
      (operation) => ["migration", "package"].includes(operation.kind)
    );
    const result = {
      runId,
      state,
      currentTarget: current.target,
      currentFingerprint: current.fingerprint,
      comparisonProvenance: "explicit-live-export",
      targetUnchanged: current.fingerprint === plan.fingerprint,
      importedSourcesMatch: comparison?.equivalent ?? false,
      history: current.history,
      retryAllowed: !databaseOperations && !plan.restore && !conflictFiles.length && !comparison?.equivalent,
      recoveryStatus: databaseOperations || plan.restore ? "database-review-required" : conflictFiles.length ? "conflict" : comparison?.equivalent ? "already-applied" : "safe-to-replan",
      conflictFiles,
      readbackComparison: comparison,
      ...selection ? { importMode: "files", selectedFiles: selection.files } : { importMode: "full" }
    };
    return { result, plan, env, current, directory, selection, owner };
  }
  async reconcile(ctx, runId) {
    const observed = await this.recoveryRead(ctx, runId);
    try {
      return observed.result;
    } finally {
      await this.oracle.discardStage?.(observed.current.exported?.stage);
    }
  }
  /** Observe first. Recover APEX metadata only; never replay database scripts. */
  async recover(ctx, runId, requestedEnvironment) {
    const observed = await this.recoveryRead(ctx, runId, requestedEnvironment);
    const { result, plan, env, current, selection, directory } = observed;
    try {
      if (await isProductionTarget(env, plan.targetDigest))
        throw new Fault(
          "PRODUCTION_DEPLOY_DENIED",
          "Production recovery may be inspected, but deployment is unsupported.",
          4,
          "blocked"
        );
      if (result.recoveryStatus === "database-review-required")
        throw new Fault(
          "DATABASE_RECOVERY_REQUIRED",
          "Inspect the actual database operations and durable migration history; SQL scripts cannot be automatically replayed.",
          4,
          "blocked"
        );
      if (result.conflictFiles.length)
        throw new Fault(
          "TARGET_DRIFT",
          "Server content differs from both reviewed desired and baseline sources. Preserve the server snapshot and resolve these files: " + result.conflictFiles.join(", "),
          5
        );
      if (plan.configurationDigest !== hash(canonical(ctx.config)) || plan.toolchainDigest !== hash(await readFile2(await contained(ctx.root, ctx.config.toolchain.lockFile))) || plan.sourceDigest !== hash(canonical(await sourceInventory(ctx))))
        throw new Fault(
          "SOURCE_DRIFT",
          "Local sources/configuration/toolchain changed; recovery cannot repeat a different task.",
          5
        );
      const connection = await resolveConnection(env.readConnectionRef);
      const scoped = selection?.exportScope !== void 0 ? {
        files: selection.files,
        source: await syncPath(ctx, selection.effective.directory),
        knownFiles: selection.before.files,
        exportScope: selection.exportScope
      } : void 0;
      const second = await this.fingerprint(env, connection, scoped);
      try {
        if (second.fingerprint !== current.fingerprint)
          throw new Fault("TARGET_DRIFT", "Server changed during reconciliation.", 5);
      } finally {
        await this.oracle.discardStage?.(second.exported?.stage);
      }
      const control = new LocalDeploymentControl(env);
      await control.claimReconciled(runId);
      const store = new SyncStore(ctx, env, plan.environment), working = await store.read();
      if (working) {
        if (working.importingRunId && working.importingRunId !== runId)
          throw new Fault("TARGET_LOCKED", "Another import owns the working copy.", 5);
        let server = await persistSnapshot(
          ctx,
          current.exported.directory,
          ".apexrest/deployments/" + runId + "/recovery/" + Date.now() + "/application"
        );
        if (scoped) {
          const raw = await syncPath(ctx, server.directory);
          const merged = server.directory + "-context";
          await overlaySelection(
            await syncPath(ctx, selection.before.directory),
            raw,
            scoped.files,
            await syncPath(ctx, merged)
          );
          await rm(raw, { recursive: true });
          await rename(await syncPath(ctx, merged), raw);
          const mergedFiles = await inventory(raw);
          server = { directory: server.directory, files: mergedFiles, digest: hash(canonical(mergedFiles)) };
        }
        if (result.importedSourcesMatch) {
          if (!working.importingRunId)
            await store.lock(() => store.write({ ...working, importingRunId: runId }));
          const recoveredObservation = await this.oracle.targetWithMetadata(env, connection);
          await this.completeWorkingCopy(
            ctx,
            plan,
            env,
            runId,
            { ...working, importingRunId: runId },
            recoveredObservation.target,
            server,
            recoveredObservation.metadata
          );
        } else {
          const metadata = await this.oracle.applicationMetadata(env, connection);
          await store.lock(async () => {
            const latest = await store.read();
            if (!latest || latest.revision !== working.revision)
              throw new Fault("TARGET_DRIFT", "Working copy changed during recovery.", 5);
            await store.write({
              ...latest,
              status: "ready",
              importingRunId: null,
              revision: latest.revision + 1,
              target: current.target,
              observedMetadata: metadata,
              recoveryCheckpoint: { at: (/* @__PURE__ */ new Date()).toISOString(), runId, snapshot: server }
            });
          });
        }
      }
      await appendJournal(directory, {
        runId,
        planId: plan.id,
        planDigest: plan.digest,
        targetDigest: plan.targetDigest,
        state: result.importedSourcesMatch ? "succeeded" : "failed",
        at: (/* @__PURE__ */ new Date()).toISOString(),
        details: { reconciled: true, recoveryStatus: result.recoveryStatus }
      });
      if (result.importedSourcesMatch) {
        await control.release(runId);
        return {
          status: "succeeded",
          runId,
          state: "succeeded",
          directory,
          recovered: true,
          reconciliation: result
        };
      }
      const options = selection ? { importMode: "files", files: selection.files } : { importMode: "full" };
      const retryPlan = await this.plan(ctx, plan.environment, options);
      const planPath = ".apexrest/plans/recovery-" + retryPlan.id + ".json";
      await writeJson(await contained(ctx.root, planPath), retryPlan);
      await control.release(runId);
      return { status: "replan_required", runId, planPath, retryPlan, reconciliation: result };
    } finally {
      await this.oracle.discardStage?.(current.exported?.stage);
    }
  }
  async restorePlan(ctx, backupId) {
    parse(external_exports.uuid(), backupId);
    const directory = await contained(ctx.root, ".apexrest/backups/" + backupId);
    const backup = await readJson(await contained(directory, "backup.json"));
    const env = environment(ctx, backup.environment);
    await refuseProductionDeployment(env, backup.environment);
    if (targetDigest(env) !== backup.targetDigest)
      throw new Fault("BACKUP_TARGET_MISMATCH", "Backup belongs to another target.", 5);
    const application = await contained(directory, "application");
    const legacy = backup.format === "APEXLANG" ? null : await readLegacyRestore(application, backup.digest);
    const files = legacy ? {} : await inventory(application);
    if (!legacy && hash(canonical(files)) !== backup.digest)
      throw new Fault("BACKUP_INVALID", "Backup digest does not match.", 5);
    let plan;
    const backupAlias = refName.safeParse(backup.alias).data;
    if (backup.format === "APEXLANG" && backup.scope === "selected") {
      if (!backup.selectedFiles?.length || backup.absentFiles?.length || !Object.keys(files).length)
        throw new Fault(
          "RESTORE_LAYOUT_UNSUPPORTED",
          "A creation snapshot records absence; removing the new component requires a separately reviewed deletion.",
          3
        );
      if (canonical(Object.keys(files).sort()) !== canonical([...backup.selectedFiles].sort()))
        throw new Fault("BACKUP_INVALID", "Selected backup files differ from its recorded scope.", 5);
      const context = await syncPath(ctx, ".apexrest/restore-context/" + randomUUID());
      await overlaySelection(
        await syncPath(ctx, ctx.config.application.sourceDir),
        path2.join(directory, "application"),
        backup.selectedFiles,
        context
      );
      try {
        const planned = await this.planFiles(
          ctx,
          backup.environment,
          importOptions({ importMode: "files", files: backup.selectedFiles }),
          await this.oracle.targetVersions(await resolveConnection(env.readConnectionRef)),
          context
        );
        if (!planned.plan) throw new Fault("RESTORE_LAYOUT_UNSUPPORTED", planned.reasons.join("; "), 3);
        plan = planned.plan;
      } finally {
        await rm(context, { recursive: true, force: true });
      }
    } else {
      if (backup.format === "APEXLANG") await this.oracle.validate(path2.join(directory, "application"));
      plan = await withConnectedReads(
        () => this.legacyPlan(ctx, backup.environment, true, false, void 0, backupAlias)
      );
    }
    if (plan.targetDigest !== backup.targetDigest)
      throw new Fault("BACKUP_TARGET_MISMATCH", "Backup belongs to another target.", 5);
    const alias = backupAlias ?? plan.target.application?.alias;
    plan.restore = {
      backupId,
      checksum: backup.digest,
      ...backup.format === "APEXLANG" ? { format: "APEXLANG" } : {},
      ...typeof alias === "string" && refName.safeParse(alias).success ? { alias } : {}
    };
    plan.risks = ["application-restore"];
    plan.operations = [{ kind: "import" }, { kind: "verify" }];
    if (legacy) {
      plan.risks.push(legacyRestoreRisk);
      const locality = await this.localTarget(ctx, plan);
      plan.databaseReview = {
        local: locality.local,
        localityEvidence: locality.evidence,
        operations: [legacyRestoreOperation(backupId, legacy.file)]
      };
    }
    plan.digest = planDigest(plan);
    return plan;
  }
};

export {
  deployPlanSchema,
  planDigest,
  sourceInventory,
  DeploymentService
};
