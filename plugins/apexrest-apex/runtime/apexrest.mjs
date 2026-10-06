#!/usr/bin/env node
import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  dispatch,
  executeJob,
  failQueuedJob,
  internalOperations,
  schemas
} from "./chunk-2EKCYC5T.mjs";
import "./chunk-6HMVZFAH.mjs";
import "./chunk-Z55FEV2C.mjs";
import {
  loadProject
} from "./chunk-K3F2WA3X.mjs";
import "./chunk-JYN3YHP3.mjs";
import {
  Fault,
  failure
} from "./chunk-WPS3CSQJ.mjs";

// packages/cli/src/main.ts
var argv = process.argv.slice(2);
var positional = {
  "project.init": ["directory"],
  "connection.add": ["name"],
  "connection.test": ["name"],
  "connection.remove": ["name"],
  "docs.search": ["query"],
  "docs.read": ["id"],
  "jobs.status": ["id"],
  "jobs.cancel": ["id"],
  "artifacts.read": ["id"]
};
var groupAliases = { job: "jobs", reference: "docs" };
var variadic = { "docs.search": "query" };
function operationFrom(args) {
  const first = groupAliases[args[0] ?? ""] ?? args[0];
  if (["doctor", "version", "setup", "ship", "status"].includes(first ?? "")) return { op: first, start: 1 };
  if (first === "test" && ["unit", "sql", "api", "e2e", "all"].includes(args[1] ?? ""))
    return { op: "test.run", start: 2, suite: args[1] };
  return { op: [first, args[1]].join("."), start: 2 };
}
var listed = (op) => !internalOperations.includes(op);
var selected = operationFrom(argv);
function knownHelpTarget() {
  const first = argv[0] ?? "";
  return first.startsWith("-") || ["mcp", "test"].includes(first) || selected.op in schemas || // A command group alone (apexrest deploy --help) lists the general help.
  (argv[1] ?? "-").startsWith("-") && Object.keys(schemas).some((op) => op.startsWith((groupAliases[first] ?? first) + "."));
}
function help() {
  const key = selected.op;
  const lines = [
    "APEXREST for Codex \u2014 independent Oracle APEX developer tools",
    "Usage: apexrest [command] [options]",
    "",
    ...Object.keys(schemas).filter((x) => x !== "test.run" && listed(x)).map((x) => "  " + x.replace(".", " ")),
    "  test unit|sql|api|e2e|all [--env NAME]",
    "  job status|cancel <id>   (alias of jobs ...)",
    "  mcp",
    "",
    "--json emits one structured JSON result; diagnostics use stderr.",
    "Use --project PATH for project operations. Environment never defaults.",
    "ship --env NAME --mode plan|apply --user-request TEXT validates, plans and (apply) imports with a plan-bound grant.",
    "Exit codes: 0 success, 1 failed, 2 input, 3 dependency, 4 approval, 5 conflict, 6 unknown/cancelled."
  ];
  if (schemas[key])
    lines.push(
      "",
      `Options for ${selected.op.replace(".", " ")}:`,
      ...Object.keys(schemas[key].shape).map(
        (k) => "  --" + k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())
      ),
      ...(positional[key] ?? []).map((p) => "  <" + p + ">")
    );
  if (key === "apex.sync")
    lines.push(
      "",
      "--env NAME --action init|status|refresh|invalidate",
      "status is local only. init reuses a valid baseline; refresh refuses dirty sources.",
      "The initial SQL backup restores the baseline only. Interrupted imports require reconciliation."
    );
  if (key === "apex.diff")
    lines.push("", "--comparison auto|live: auto uses an active local checkpoint; live explicitly exports.");
  if (key === "docs.search")
    lines.push(
      "",
      "--corpus apexlang|components|patterns|blocks|blueprints selects the offline catalog (default: apexlang).",
      "Filter with --kind, --family and --version; follow nextResultOffset using --offset for more hits."
    );
  if (key === "docs.read")
    lines.push(
      "",
      "Read a result ID, grammar:production-name, component: ID or pattern: ID.",
      "Follow nextOffset using --offset; catalog navigationOffset recovers all dependency links."
    );
  if (key === "panel.status")
    lines.push(
      "",
      "Read-only local snapshot: settings, connections, Git changes, sync state, jobs and deployment journal.",
      "No server, worker, job or database call is started. Same as: apexrest status --detail project --project PATH --json"
    );
  if (key === "jobs.status")
    lines.push(
      "Use --wait-seconds N (up to 120) to wait for an existing job without repeated status calls (default: immediate)."
    );
  if (key === "ship")
    lines.push(
      "",
      "mode plan: validate with the Oracle compiler, read the target and write .apexrest/plans/ship-<id>.json for review.",
      "mode apply: non-production only. Records a deploy grant bound to this project, target and plan digest with the",
      "user's literal --user-request, imports with backup/drift/identity checks, verifies, runs required suites, then",
      "removes the grant. Production targets require the protected CI approval path (deploy apply)."
    );
  if (key === "status")
    lines.push(
      "",
      "--detail doctor probes local tools; --detail project (default) prints the read-only project snapshot."
    );
  if (key === "apex.validate")
    lines.push("", "Runs in-process and returns structured diagnostics (file, line, column, type, hint).");
  if (key === "dependencies.install")
    lines.push(
      "",
      "Install managed Node.js, Java, SQLcl, Playwright and Chromium without registering the plugin.",
      "Preview: apexrest dependencies install --dry-run",
      "Install: apexrest dependencies install --yes",
      "--accept-oracle-license records separate consent to the Oracle terms shown in the preview.",
      "--skip-browser omits Playwright/Chromium; --install-os-deps explicitly enables browser OS packages.",
      "--offline uses cached downloads; --home and --cache-dir select managed storage."
    );
  if (key === "dependencies.uninstall")
    lines.push(
      "",
      "Preview: apexrest dependencies uninstall --dry-run",
      "Remove managed tools: apexrest dependencies uninstall --yes",
      "Preserves external runtimes, projects, saved connections and cache.",
      "Node.js required by the APEXREST launcher or plugin is retained."
    );
  if (key === "connection.list" || key === "connection.test")
    lines.push("", "--saved uses the SQLcl connection store directly, without an APEXREST reference.");
  if (key === "connection.add")
    lines.push(
      "",
      "--sqlcl-name is a saved direct Oracle connection. ORDS uses --ords-url and --ords-username.",
      "ORDS SQLcl connections cannot be saved in the SQLcl connection store.",
      "APEXREST saves ORDS settings and credentials locally at plugin level, across projects.",
      "Use --password-file PATH to read the password from a local file; omit it to keep an existing password.",
      "Example: apexrest connection add --name REF --ords-url https://msboard.apex.rest/ords/megasport/ --ords-username megasport --password-file PATH --json",
      "Configure each project read/deploy reference. Updating ORDS preserves its direct SQLcl alias."
    );
  if (key === "sqlcl.configure" || key === "sqlcl.status")
    lines.push(
      "",
      "Select the Oracle backend for CLI and APEXREST MCP operations; existing sessions keep their mode.",
      "apexrest sqlcl configure --mode cli|mcp --database-transport direct|ords --json",
      "cli: SQLcl subprocess (default). mcp: official SQLcl stdio server (sql -mcp).",
      "direct: Oracle listener connection (default). ords: SQLcl OREST over HTTP(S), without port 1521.",
      "ORDS uses SQLcl CLI; select --mode cli with --database-transport ords.",
      "Configure the ORDS URL, username and password for each reference using connection add.",
      "--mcp-restrict-level 4|1: 4 is the default; 1 explicitly permits scripts but blocks host commands.",
      "Saved in APEXREST_HOME/sqlcl.json. No connection, download or Codex registration is changed.",
      "SQLcl MCP can write its own database audit log on connected operations. No silent CLI fallback."
    );
  console.log(lines.join("\n"));
}
try {
  if (argv.includes("--help") || argv.includes("-h")) {
    if (!knownHelpTarget())
      throw new Fault(
        "INVALID_INPUT",
        `Unknown command: ${argv.filter((a) => !a.startsWith("-")).join(" ")}. Use apexrest --help.`,
        2
      );
    help();
  } else if (!argv.length) help();
  else if (argv[0] === "--job-worker") {
    if (argv.length !== 3) throw new Fault("INVALID_INPUT", "Invalid internal job request.", 2);
    try {
      await executeJob(await loadProject(argv[1]), argv[2], dispatch);
    } catch (error) {
      await failQueuedJob(argv[1], argv[2], error).catch(() => void 0);
      throw error;
    }
  } else if (argv[0] === "mcp") {
    if (argv.length !== 1) throw new Fault("INVALID_INPUT", "mcp accepts no arguments.", 2);
    const { startMcp } = await import("./chunk-GGGZS7SX.mjs");
    await startMcp();
  } else {
    const selectedOp = argv[0] === "--version" ? { op: "version", start: 1 } : selected;
    if (!(selectedOp.op in schemas)) throw new Fault("INVALID_INPUT", "Unknown command. Use --help.", 2);
    const schema = schemas[selectedOp.op];
    const input = selected.suite ? { suite: selected.suite } : {};
    const booleans = /* @__PURE__ */ new Set([
      "json",
      "yes",
      "nonInteractive",
      "offline",
      "dryRun",
      "acceptOracleLicense",
      "skipBrowser",
      "installOsDeps",
      "nativeOnly",
      "keepRuntime",
      "headed",
      "saved",
      "workingCopy",
      "includeUnresolved"
    ]);
    const numbers = /* @__PURE__ */ new Set(["appId", "offset", "limit", "waitSeconds"]);
    let index = 0, rest;
    for (let i = selectedOp.start; i < argv.length; i++) {
      const token = argv[i];
      if (token.startsWith("--")) {
        const name = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        if (name === "json") continue;
        if (!(name in schema.shape) || name in input)
          throw new Fault("INVALID_INPUT", `Unknown or duplicate option: ${token}`, 2);
        if (booleans.has(name)) input[name] = true;
        else {
          const value = argv[++i];
          if (!value || value.startsWith("--"))
            throw new Fault("INVALID_INPUT", `Missing value for ${token}`, 2);
          input[name] = numbers.has(name) ? Number(value) : value;
        }
      } else {
        const field = positional[selectedOp.op]?.[index];
        if (field && !(field in input)) {
          index++;
          input[field] = token;
          if (variadic[selectedOp.op] === field) rest = field;
        } else if (!field && rest) input[rest] = input[rest] + " " + token;
        else throw new Fault("INVALID_INPUT", `Unexpected argument: ${token}`, 2);
      }
    }
    const result = await dispatch(selectedOp.op, input);
    console.log(JSON.stringify(result, null, argv.includes("--json") ? 0 : 2));
    process.exitCode = result.exitCode;
  }
} catch (e) {
  const result = failure(selected.op, e);
  console.log(JSON.stringify(result));
  process.exitCode = result.exitCode;
}
