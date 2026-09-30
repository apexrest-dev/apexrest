#!/usr/bin/env node
import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  dispatch,
  schemas
} from "./chunk-HKJVCGQQ.mjs";
import {
  executeJob
} from "./chunk-2BBNJVKW.mjs";
import "./chunk-YPLIIQ4Y.mjs";
import "./chunk-G3KR57BY.mjs";
import {
  loadProject
} from "./chunk-EBBEN4AV.mjs";
import {
  Fault,
  failure
} from "./chunk-2Z3BZF66.mjs";

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
function operationFrom(args) {
  const first = args[0];
  if (["doctor", "version", "setup"].includes(first ?? "")) return { op: first, start: 1 };
  if (first === "test" && ["unit", "sql", "api", "e2e", "all"].includes(args[1] ?? ""))
    return { op: "test.run", start: 2, suite: args[1] };
  return { op: args.slice(0, 2).join("."), start: 2 };
}
var selected = operationFrom(argv);
function help() {
  const key = selected.op;
  const lines = [
    "APEXREST for Codex \u2014 independent Oracle APEX developer tools",
    "Usage: apexrest [command] [options]",
    "Run apexrest in a terminal to manage tools, plugins and saved SQLcl connections.",
    "  tui [--project PATH]   Open the terminal UI explicitly",
    "  panel tui [--project PATH]   Live development panel inside Codex CLI",
    "",
    ...Object.keys(schemas).filter((x) => x !== "test.run").map((x) => "  " + x.replace(".", " ")),
    "  test unit|sql|api|e2e|all [--env NAME]",
    "  mcp",
    "",
    "--json emits one structured JSON result; diagnostics use stderr.",
    "Use --project PATH for project operations. Environment never defaults.",
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
  if (key === "panel.action")
    lines.push(
      "",
      "Pass --action as one JSON object. Supported kinds: preferences, sqlcl, connection, cancel-job, validate, test, browser, plan.",
      `Example: apexrest panel action --action '{"kind":"validate"}' --project PATH --json`
    );
  if (key === "jobs.status")
    lines.push(
      "Use --wait-seconds 25 to wait for an existing job without repeated status calls (default: immediate)."
    );
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
      "Configure the ORDS URL, username and password for each reference using connection add or panel Settings.",
      "--mcp-restrict-level 4|1: 4 is the default; 1 explicitly permits scripts but blocks host commands.",
      "Saved in APEXREST_HOME/sqlcl.json. No connection, download or Codex registration is changed.",
      "SQLcl MCP can write its own database audit log on connected operations. No silent CLI fallback."
    );
  console.log(lines.join("\n"));
}
try {
  if (argv.includes("--help") || argv.includes("-h")) help();
  else if (argv[0] === "tui" || !argv.length && process.stdin.isTTY && process.stdout.isTTY && process.env.TERM !== "dumb") {
    if (argv.length > 1 && (argv.length !== 3 || argv[1] !== "--project" || !argv[2] || argv[2].startsWith("--")))
      throw new Fault("INVALID_INPUT", "Usage: apexrest tui [--project PATH]", 2);
    const { runTui } = await import("./chunk-RWGJITHZ.mjs");
    await runTui(argv[2] ? { project: argv[2] } : {});
  } else if (!argv.length) help();
  else if (argv[0] === "panel" && argv[1] === "tui") {
    if (argv.length !== 2 && (argv.length !== 4 || argv[2] !== "--project" || !argv[3]))
      throw new Fault("INVALID_INPUT", "Usage: apexrest panel tui [--project PATH]", 2);
    const { runPanelTui } = await import("./chunk-CYPFCUNE.mjs");
    await runPanelTui(argv[3] ?? process.cwd());
  } else if (argv[0] === "--panel-worker") {
    if (argv.length !== 2 || !argv[1]) throw new Fault("INVALID_INPUT", "Invalid panel worker request.", 2);
    const { servePanel } = await import("./chunk-WXP75UUP.mjs");
    await servePanel(argv[1]);
  } else if (argv[0] === "--job-worker") {
    if (argv.length !== 3) throw new Fault("INVALID_INPUT", "Invalid internal job request.", 2);
    await executeJob(await loadProject(argv[1]), argv[2], dispatch);
  } else if (argv[0] === "mcp") {
    if (argv.length !== 1) throw new Fault("INVALID_INPUT", "mcp accepts no arguments.", 2);
    const { startMcp } = await import("./chunk-5JI3XEAK.mjs");
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
      "workingCopy"
    ]);
    const numbers = /* @__PURE__ */ new Set(["appId", "offset", "limit", "waitSeconds"]);
    let index = 0;
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
          input[name] = name === "action" && selectedOp.op === "panel.action" ? JSON.parse(value) : numbers.has(name) ? Number(value) : value;
        }
      } else {
        const field = positional[selectedOp.op]?.[index++];
        if (!field || field in input) throw new Fault("INVALID_INPUT", `Unexpected argument: ${token}`, 2);
        input[field] = token;
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
