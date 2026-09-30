import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  brand,
  clip,
  labelFor,
  padCell,
  paint,
  resultLines,
  resultTitle,
  resultTone,
  terminalText,
  valueText,
  wrap
} from "./chunk-TLYYCRQA.mjs";
import {
  dispatch,
  schemas
} from "./chunk-HKJVCGQQ.mjs";
import "./chunk-2BBNJVKW.mjs";
import "./chunk-YPLIIQ4Y.mjs";
import "./chunk-G3KR57BY.mjs";
import {
  external_exports,
  resourceRoot,
  sqlclConfig
} from "./chunk-EBBEN4AV.mjs";
import {
  Fault,
  failure,
  sanitized
} from "./chunk-2Z3BZF66.mjs";

// packages/cli/src/tui.ts
import { emitKeypressEvents } from "node:readline";

// packages/cli/src/tui-catalog.ts
var descriptions = {
  "dependencies.install": [
    "Install tools",
    "Install Node.js, Java, SQLcl and browser tools.",
    "Install tools"
  ],
  "dependencies.uninstall": [
    "Uninstall tools",
    "Remove managed tools; preserve external runtimes and saved connections.",
    "Uninstall tools"
  ],
  "plugin.install": [
    "Install plugin",
    "Register the APEXREST plugin in Codex using the existing runtime.",
    "Install plugin"
  ],
  "plugin.uninstall": [
    "Uninstall plugin",
    "Remove the APEXREST plugin registration and managed plugin files.",
    "Uninstall plugin"
  ],
  "connection.list": [
    "List saved SQLcl connections",
    "Browse connections saved in your local SQLcl connection store.",
    "List connections"
  ],
  "connection.test": [
    "Test saved SQLcl connection",
    "Choose a saved connection and read its database identity.",
    "Test connection"
  ],
  "sqlcl.configure": [
    "SQLcl settings: CLI / MCP / ORDS",
    "Choose SQLcl execution and direct Oracle or ORDS HTTP(S) connectivity.",
    "Save SQLcl settings"
  ]
};
var commands = Object.keys(descriptions).map((operation) => ({
  operation,
  command: operation.replace(".", " "),
  label: descriptions[operation][0],
  description: descriptions[operation][1],
  action: descriptions[operation][2]
}));
var labels = {
  mode: "SQLcl execution mode",
  databaseTransport: "Database network transport",
  mcpRestrictLevel: "MCP restrict level",
  home: "Managed tools directory",
  offline: "Use cached downloads only",
  cacheDir: "Download cache directory",
  acceptOracleLicense: "Accept Oracle license terms",
  skipBrowser: "Skip browser installation",
  installOsDeps: "Install browser system packages",
  from: "Package source directory",
  codexHome: "Codex profile directory",
  keepRuntime: "Keep plugin files"
};
var hints = {
  mode: "CLI runs SQLcl directly. MCP uses the official sql -mcp server. Applies to new operations.",
  databaseTransport: "direct: Oracle listener. ords: HTTP(S) through ORDS, with plugin connection settings; requires CLI.",
  mcpRestrictLevel: "4: Oracle default restrictions. 1: allow scripts, block host commands. Applies only to MCP.",
  home: "Optional directory for managed APEXREST tools and installation records.",
  acceptOracleLicense: "Enable only after accepting the Oracle terms linked on the review screen.",
  installOsDeps: "Explicit permission for browser operating-system package installation.",
  offline: "Use previously cached artifacts; fail if a required download is missing.",
  cacheDir: "Optional directory containing cached toolchain downloads.",
  skipBrowser: "Skip Chromium and browser tooling.",
  from: "Optional local APEXREST package; defaults to the package running this menu.",
  codexHome: "Optional Codex profile directory; defaults to your active user profile.",
  keepRuntime: "Keep plugin files after removing registration. Shared tools are preserved."
};
var visibleFields = {
  "dependencies.install": [
    "acceptOracleLicense",
    "skipBrowser",
    "home",
    "cacheDir",
    "offline",
    "installOsDeps"
  ],
  "dependencies.uninstall": ["home"],
  "plugin.install": ["from", "home", "codexHome"],
  "plugin.uninstall": ["keepRuntime", "home"],
  "connection.list": [],
  "connection.test": [],
  "sqlcl.configure": ["mode", "databaseTransport", "mcpRestrictLevel"]
};
var advancedFields = /* @__PURE__ */ new Set([
  "mcpRestrictLevel",
  "home",
  "cacheDir",
  "codexHome",
  "offline",
  "installOsDeps",
  "keepRuntime",
  "from"
]);
function fieldsFor(operation, _project = "") {
  const schema = external_exports.toJSONSchema(schemas[operation], { io: "input" });
  return (visibleFields[operation] ?? []).map((name) => {
    const property = schema.properties?.[name];
    if (!property || typeof property === "boolean") throw new Error(`Unsupported field schema: ${name}`);
    return {
      name,
      label: labels[name] ?? name,
      type: String(property.type ?? "string"),
      required: schema.required?.includes(name) ?? false,
      initial: property.default === void 0 ? "" : String(property.default),
      choices: property.enum?.map(String) ?? [],
      hint: hints[name] ?? "",
      advanced: advancedFields.has(name)
    };
  });
}
function parseFields(operation, fields, values) {
  const input = operation === "plugin.install" ? { nativeOnly: true } : {};
  if (["dependencies.install", "dependencies.uninstall", "plugin.install"].includes(operation)) {
    input.dryRun = false;
    input.yes = true;
  }
  if (operation.startsWith("connection.")) input.saved = true;
  for (const field of fields) {
    const value = values[field.name] ?? "";
    if (value === "") continue;
    input[field.name] = field.type === "boolean" ? value === "true" ? true : value === "false" ? false : value : value;
  }
  return schemas[operation].safeParse(input);
}
function commandPreview(operation, input) {
  const quote = (value) => /^[a-zA-Z0-9_./:@=-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
  const args = ["apexrest", ...operation.split(".")];
  for (const [name, value] of Object.entries(input)) {
    if (value === false || value === void 0) continue;
    args.push("--" + name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()));
    if (value !== true) args.push(quote(String(value)));
  }
  return args.join(" ");
}

// packages/cli/src/tui-apexlang.ts
import path from "node:path";
import { readFile } from "node:fs/promises";
var groups = /* @__PURE__ */ new Map([
  ["items", "Page items"],
  ["region-components", "Regions"],
  ["buttons", "Buttons"],
  ["business-logic", "Business logic"],
  ["shared-components", "Shared components"],
  ["template-components", "Template components"],
  ["page-layout-templates", "Page layouts"],
  ["page-examples", "Page examples"],
  ["workspace-components", "Workspace components"]
]);
var displayName = (name) => labelFor(name).replace(
  /\b(acl|ai|app|lovs?|rest)\b/gi,
  (word) => ({ acl: "ACL", ai: "AI", app: "Application", lov: "LOV", lovs: "LOVs", rest: "REST" })[word.toLowerCase()]
);
function apexlangCatalogue(records) {
  if (!Array.isArray(records)) throw new Error("Invalid APEXlang catalogue");
  const families = /* @__PURE__ */ new Map();
  const versions = /* @__PURE__ */ new Set();
  for (const record of records) {
    if (!record || typeof record !== "object") throw new Error("Invalid APEXlang record");
    if (!["template", "contract", "guide"].includes(record.kind)) continue;
    if (typeof record.family !== "string") continue;
    const [root, name] = record.family.split("/");
    const group = groups.get(root);
    if (!group || root !== "buttons" && (!name || name.startsWith("_"))) continue;
    if (typeof record.id !== "string" || typeof record.version !== "string")
      throw new Error("Invalid APEXlang component metadata");
    const family = root === "buttons" ? root : `${root}/${name}`;
    let entry = families.get(family);
    if (!entry) {
      entry = {
        item: { family, group, name: displayName(name ?? root), documents: 0 },
        ids: /* @__PURE__ */ new Set()
      };
      families.set(family, entry);
    }
    entry.ids.add(record.id);
    versions.add(record.version);
  }
  if (!families.size) throw new Error("Empty APEXlang catalogue");
  const order = [...groups.values()];
  return {
    version: [...versions].sort().join(", "),
    items: [...families.values()].map(({ item, ids }) => ({ ...item, documents: ids.size })).sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.name.localeCompare(b.name, "en"))
  };
}
async function loadApexlangCatalogue(file = path.join(resourceRoot(), "references/index.json")) {
  return apexlangCatalogue(JSON.parse(await readFile(file, "utf8")));
}
function filterApexlang(catalogue, query) {
  const words = query.toLowerCase().trim().split(/\s+/);
  return (catalogue?.items ?? []).filter((item) => {
    const text = `${item.name} ${item.group} ${item.family}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

// packages/cli/src/tui-home.ts
function startAt(selected, length, room) {
  return Math.min(Math.max(0, selected - Math.floor(room / 2)), Math.max(0, length - room));
}
function homeFrame(state) {
  const { width, height, color, focus } = state;
  const styled = (text, tone = "plain", size = width) => paint(clip(text, size), tone, color);
  const header = brand(color, width < 62 || height < 28);
  if (height >= 18)
    header.push(
      styled(
        ` SQLcl: ${state.sqlclMode ?? "Loading\u2026"}${state.sqlclMode ? " \xB7 " + (state.databaseTransport === "ords" ? "ORDS HTTP(S)" : "Direct Oracle") : ""}`,
        "muted"
      )
    );
  if (height >= 18) header.push("");
  header.push(
    styled(
      focus === "apexlang" ? state.catalogueQuery ? ` Find APEXlang: ${state.catalogueQuery}` : " Browse supported APEXlang components" : state.query ? ` Search: ${state.query}` : " What would you like to do?",
      "accent"
    )
  );
  if (height >= 18) header.push("");
  const room = height - header.length - 2;
  const actionRows = (size, count) => {
    const start = startAt(state.selected, state.actions.length, count);
    const rows = state.actions.slice(start, start + count).map(
      (action, index) => styled(
        `${focus === "actions" && start + index === state.selected ? "> " : "  "}${action.label}`,
        focus === "actions" && start + index === state.selected ? "selected" : "plain",
        size
      )
    );
    if (!state.actions.length) rows.push(styled(" No matching actions. Esc clears search.", "muted", size));
    while (rows.length < count) rows.push("");
    return rows;
  };
  const catalogueRows = (size, count) => {
    const active = focus === "apexlang";
    const catalogue = state.catalogue;
    const rows = [
      styled(
        ` ${active ? "\u25CF" : "\u25CB"} APEXlang${catalogue ? ` \xB7 ${catalogue.items.length} types \xB7 ${new Set(catalogue.items.map((item) => item.group)).size} groups` : ""}`,
        active ? "accent" : "muted",
        size
      )
    ];
    if (state.catalogueError || !catalogue) {
      rows.push(
        styled(
          state.catalogueError ? " Catalogue unavailable." : " Loading bundled catalogue\u2026",
          "muted",
          size
        )
      );
      if (state.catalogueError && count >= 3)
        rows.push(styled(" Ctrl+R retries the local file.", "muted", size));
    } else {
      const items = filterApexlang(catalogue, state.catalogueQuery);
      const groupWidth = size >= 55 ? 23 : 0;
      const nameWidth = size - groupWidth - 10;
      const tableRow = (name, group, docs, marker = "  ") => marker + padCell(name, nameWidth) + " \u2502 " + (groupWidth ? padCell(group, groupWidth - 3) + " \u2502 " : "") + docs.padStart(4);
      const table = count >= 5;
      if (table) rows.push(styled(tableRow("Item / component", "Group", "Docs"), "muted", size));
      const available = Math.max(1, count - (table ? 4 : 1));
      const selected = Math.max(0, Math.min(state.catalogueSelected, items.length - 1));
      const start = startAt(selected, items.length, available);
      for (const [offset, item] of items.slice(start, start + available).entries()) {
        const selectedRow = active && start + offset === selected;
        rows.push(
          styled(
            table ? tableRow(item.name, item.group, String(item.documents), selectedRow ? "> " : "  ") : ` ${selectedRow ? ">" : " "} ${item.name}`,
            selectedRow ? "selected" : "plain",
            size
          )
        );
      }
      if (!items.length) rows.push(styled(" No matching components.", "muted", size));
      if (table) {
        while (rows.length < count - 2) rows.push("");
        rows.push(
          styled(
            ` ${items.length ? `${start + 1}\u2013${Math.min(start + available, items.length)}` : "0"} / ${items.length} \xB7 ${groupWidth ? catalogue.version : items[selected]?.group ?? catalogue.version}`,
            "muted",
            size
          )
        );
        rows.push(styled(" Bundled Oracle refs \xB7 validate locally", "muted", size));
      }
    }
    while (rows.length < count) rows.push("");
    return rows.slice(0, count);
  };
  let body;
  if (width >= 108) {
    const leftWidth = 38, rightWidth = width - leftWidth - 3;
    const left = actionRows(leftWidth, room), right = catalogueRows(rightWidth, room);
    body = left.map(
      (line, index) => line + " ".repeat(leftWidth - clip(line, leftWidth).length) + styled(" \u2502 ", "muted") + right[index]
    );
  } else if (focus === "apexlang") {
    body = catalogueRows(width, room);
  } else {
    const actionCount = Math.min(Math.max(1, state.actions.length), Math.max(1, room - 2));
    const gap = room - actionCount >= 5 ? 1 : 0;
    body = [
      ...actionRows(width, actionCount),
      ...gap ? [""] : [],
      ...catalogueRows(width, room - actionCount - gap)
    ];
  }
  const footer = width < 44 ? focus === "apexlang" ? " Tab Actions  \u2191\u2193 Type  Esc" : " Tab APEXlang \u2191\u2193 Enter  Esc" : width < 64 ? focus === "apexlang" ? " Tab Actions  \u2191\u2193 Scroll  Type Search  Esc" : " Tab APEXlang  \u2191\u2193 Enter  Type Search  Esc" : focus === "apexlang" ? " Tab Actions  \u2191\u2193 PgUp/PgDn  Type Search  Esc Back" : " Tab APEXlang  \u2191\u2193 Move  Enter Open  Type Search  Esc Quit";
  return [...header, ...body, styled("\u2500".repeat(width), "muted"), styled(footer, "muted")].slice(0, height);
}

// packages/cli/src/tui.ts
async function runTui({
  project = process.cwd(),
  input = process.stdin,
  output = process.stdout,
  execute = dispatch,
  loadCatalogue = loadApexlangCatalogue,
  loadSqlcl = sqlclConfig
} = {}) {
  if (!input.isTTY || !output.isTTY || process.env.TERM === "dumb")
    throw new Fault(
      "TTY_REQUIRED",
      "The TUI requires an interactive terminal. Use apexrest --help for commands.",
      2
    );
  let screen = "menu";
  let query = "", selected = 0, fieldIndex = 0, scroll = 0, choiceIndex = 0;
  let homeFocus = "actions";
  let catalogue;
  let catalogueQuery = "", catalogueSelected = 0, catalogueError = false, catalogueLoading = false;
  let command = commands[0];
  let sqlcl, sqlclError = false, sqlclRevision = 0;
  let fields = [], values = {}, parsed = {};
  let error = "", editing = "", cursor = 0, result, editField;
  let advanced = false, details = false;
  let controller, started = 0, closeAfterRun = false, closed = false;
  let finish, reject;
  const done = new Promise((resolve, fail) => {
    finish = resolve;
    reject = fail;
  });
  const crash = (error2) => {
    closed = true;
    reject(error2);
  };
  const drafts = /* @__PURE__ */ new Map();
  let savedNames = [], connectionQuery = "";
  const visibleConnections = () => savedNames.filter((name) => name.toLowerCase().includes(connectionQuery.toLowerCase()));
  const filtered = () => commands.filter(
    (item) => `${item.label} ${item.command} ${item.description}`.toLowerCase().includes(query.toLowerCase())
  );
  async function reloadCatalogue() {
    if (catalogueLoading) return;
    catalogueLoading = true;
    catalogueError = false;
    try {
      catalogue = await loadCatalogue();
    } catch {
      catalogue = void 0;
      catalogueError = true;
    } finally {
      catalogueLoading = false;
      if (screen === "menu") renderSafe();
    }
  }
  const formRows = () => [
    ...fields.filter((field) => !field.advanced).map((field) => ({ kind: "field", field })),
    ...fields.some((field) => field.advanced) ? [{ kind: "advanced" }] : [],
    ...advanced ? fields.filter((field) => field.advanced).map((field) => ({ kind: "field", field })) : [],
    { kind: "review" }
  ];
  const choices = () => {
    const available = command.operation === "sqlcl.configure" && editField.name === "mode" && values.databaseTransport === "ords" ? editField.choices.filter((choice) => choice === "cli") : editField.choices;
    return editField.required || editField.name === "databaseTransport" ? available : ["", ...available];
  };
  const close = () => {
    closed = true;
    finish();
  };
  const cancel = (exitAfter = false) => {
    if (screen === "running") {
      closeAfterRun ||= exitAfter;
      controller?.abort();
      render();
    } else close();
  };
  const fieldValue = (field) => {
    const value = values[field.name] ?? "";
    return field.type === "boolean" ? value === "true" ? "[x] Yes" : "[ ] No" : value || (field.required ? "Enter a value" : "Default");
  };
  const stage = (step) => ["Configure", "Review", "Result"].map((name, index) => index + 1 === step ? `[${name}]` : name).join("  \u203A  ");
  function render() {
    if (closed) return;
    const width = Math.max(1, (output.columns || 80) - 2), height = Math.max(1, (output.rows || 24) - 1);
    if (width < 28 || height < 9) {
      output.write("\x1B[H\x1B[2J" + clip("Resize terminal (30x10 minimum). Ctrl+C exits.", width));
      return;
    }
    const color = !("NO_COLOR" in process.env);
    if (screen === "menu") {
      const actions = filtered();
      selected = Math.max(0, Math.min(selected, actions.length - 1));
      output.write(
        "\x1B[H\x1B[2J" + homeFrame({
          width,
          height,
          color,
          actions,
          selected,
          query,
          focus: homeFocus,
          catalogue,
          catalogueError,
          catalogueQuery,
          catalogueSelected,
          sqlclMode: sqlclError ? "Configuration unavailable" : sqlcl?.mode.toUpperCase(),
          databaseTransport: sqlcl?.databaseTransport
        }).join("\r\n")
      );
      return;
    }
    const styled = (text, tone = "plain") => paint(clip(text, width), tone, color);
    const header = [];
    let body = [], footer = "", focused = -1;
    const heading = (title, step) => {
      header.push(styled(` APEXREST  /  ${title}`, "accent"));
      if (step && height >= 16) header.push(styled(` ${stage(step)}`, "muted"));
      header.push("");
    };
    const row = (text, index, active) => ({
      text: `${index === active ? "> " : "  "}${text}`,
      tone: index === active ? "selected" : "plain"
    });
    if (screen === "connections") {
      heading("Saved SQLcl connections");
      header.push(
        styled(
          connectionQuery ? ` Search: ${connectionQuery}` : ` ${savedNames.length} saved connection${savedNames.length === 1 ? "" : "s"}`,
          "muted"
        ),
        ""
      );
      const names = visibleConnections();
      selected = Math.max(0, Math.min(selected, names.length - 1));
      body = names.map((name, index) => row(name, index, selected));
      if (!savedNames.length)
        body = [
          { text: "No saved SQLcl connections found.", tone: "muted" },
          { text: "Save a connection in SQLcl, then press Ctrl+R to refresh." }
        ];
      else if (!names.length)
        body.push({ text: "No matching connections. Esc clears the search.", tone: "muted" });
      focused = names.length ? selected : -1;
      footer = width >= 64 ? " \u2191\u2193 Move   Enter Test   Type to search   ^R Refresh   Esc Back" : " \u2191\u2193 Enter Test  Type Search  ^R Refresh  Esc";
    } else if (screen === "form" || screen === "edit") {
      heading(command.label, 1);
      if (error) header.push(styled(` ${error}`, "error"));
      else if (height >= 17) header.push(styled(` ${command.description}`, "muted"));
      if (height >= 17) header.push("");
      const rows = formRows();
      fieldIndex = Math.min(fieldIndex, rows.length - 1);
      body = rows.map((item, index) => {
        if (item.kind === "advanced")
          return row(
            `${advanced ? "[-]" : "[+]"} Advanced options (${fields.filter((field2) => field2.advanced).length})`,
            index,
            fieldIndex
          );
        if (item.kind === "review") return row("[ Review & run ]", index, fieldIndex);
        const field = item.field;
        const labelWidth = Math.min(28, Math.max(7, Math.floor((width - 7) / 2)));
        const label = field.label + (field.required ? " *" : "");
        const shortLabel = label.length > labelWidth ? clip(label, labelWidth - 1) + "\u2026" : label;
        return row(`${shortLabel.padEnd(labelWidth)} ${fieldValue(field)}`, index, fieldIndex);
      });
      focused = fieldIndex;
      const selectedRow = rows[fieldIndex];
      if (screen === "edit") {
        const chars = Array.from(editing);
        const editorLabel = width < 54 ? "" : clip(editField.label, Math.floor(width / 3)) + ": ";
        const room = Math.max(5, width - editorLabel.length - 4);
        const start = Math.max(0, cursor - Math.floor(room / 2));
        body[fieldIndex] = {
          text: `> ${editorLabel}${start ? "\u2026" : ""}${chars.slice(start, cursor).join("")}\u2502${chars.slice(cursor).join("")}`,
          tone: "selected"
        };
        header.push(styled(` ${width < 54 ? editField.label : editField.hint}`, "muted"));
        footer = width >= 64 ? " Enter Save & next   Esc Cancel   Ctrl+U Clear" : " Enter Save   Esc Cancel   Ctrl+U Clear";
      } else {
        if (height >= 17 && selectedRow?.kind === "field")
          header.push(styled(` ${selectedRow.field.hint}`, "muted"));
        footer = width >= 68 ? " Enter Edit   Ctrl+R Review   Ctrl+O Advanced   Esc Back" : " Enter Edit  ^R Review  ^O More  Esc Back";
      }
    } else if (screen === "choices") {
      heading(command.label, 1);
      header.push(styled(` ${editField.label}`, "accent"));
      if (height >= 17) header.push(styled(` ${editField.hint}`, "muted"));
      header.push("");
      body = choices().map((value, index) => row(value || "Use default", index, choiceIndex));
      focused = choiceIndex;
      footer = " \u2191\u2193 Move   Enter Save & next   Esc Cancel";
    } else if (screen === "review") {
      heading(command.label, 2);
      header.push(styled(" Ready to run", "accent"), "");
      if (details) {
        body = [
          { text: commandPreview(command.operation, parsed) },
          { text: "" },
          { text: JSON.stringify(sanitized(parsed), null, 2) }
        ];
      } else {
        body.push({ text: command.description, tone: "muted" }, { text: "" });
        for (const field of fields) {
          const value = parsed[field.name];
          if (value === void 0 || value === "" || field.name === "project") continue;
          if (field.advanced && values[field.name] === field.initial) continue;
          body.push({ text: `  ${field.label}: ${valueText(value)}` });
        }
        if (command.operation === "dependencies.install")
          body.push(
            { text: "" },
            {
              text: "Oracle terms: https://www.oracle.com/downloads/licenses/oracle-free-license.html",
              tone: "muted"
            }
          );
        if (command.operation === "sqlcl.configure")
          body.push(
            { text: "" },
            {
              text: "Saved for new Oracle operations in this APEXREST home. Current operations keep their mode."
            },
            ...parsed.databaseTransport === "ords" ? [
              {
                text: "ORDS requires CLI execution. Configure each reference with connection add --ords-url URL --ords-username USER --password-file PATH.",
                tone: "muted"
              }
            ] : [],
            ...parsed.mode === "mcp" ? [
              {
                text: "Oracle MCP may write DBTOOLS$MCP_LOG during connected operations.",
                tone: "muted"
              }
            ] : []
          );
        body.push({ text: "" }, { text: `> [ ${command.action} ]`, tone: "selected" });
      }
      footer = width >= 64 ? " Enter Run   Esc Edit   D Details   \u2191\u2193 Scroll" : " Enter Run  Esc Edit  D Details  \u2191\u2193 Scroll";
    } else if (screen === "running") {
      heading(command.label);
      const elapsed = Math.floor((Date.now() - started) / 1e3);
      const spinner = ["\u25D0", "\u25D3", "\u25D1", "\u25D2"][Math.floor(Date.now() / 250) % 4];
      header.push(
        styled(
          ` ${spinner} ${controller?.signal.aborted ? "Cancelling" : "Running"}  \xB7  ${elapsed}s`,
          "accent"
        ),
        ""
      );
      body = [
        {
          text: controller?.signal.aborted ? "Cancellation requested. Waiting for the actual outcome; some steps cannot be interrupted." : command.description
        }
      ];
      footer = " Ctrl+C Request cancellation";
    } else {
      heading(command.label, command.operation.startsWith("connection.") ? void 0 : 3);
      header.push(styled(` ${resultTitle(result)}`, resultTone(result)), "");
      body = details ? [{ text: JSON.stringify(sanitized(result), null, 2) }] : resultLines(result);
      footer = command.operation.startsWith("connection.") ? " Enter Connections   Esc Menu   D Details   \u2191\u2193 Scroll" : width >= 68 ? " Enter Edit   Esc Menu   D Details   \u2191\u2193 / PgUp PgDn Scroll" : " Enter Edit  Esc Menu  D Details  \u2191\u2193 Scroll";
    }
    if (width < 44)
      footer = screen === "form" ? " Enter  ^R Run  ^O More  Esc" : screen === "edit" ? " Enter Save  Esc Cancel" : screen === "choices" ? " \u2191\u2193 Enter Save  Esc Cancel" : screen === "running" ? " Ctrl+C Cancel" : " Enter  Esc  D Details  \u2191\u2193";
    const available = Math.max(1, height - header.length - 2);
    if (focused < 0)
      body = body.flatMap((line) => wrap(line.text, width - 1).map((text) => ({ ...line, text })));
    if (focused >= 0) scroll = Math.max(0, focused - Math.floor(available / 2));
    scroll = Math.min(scroll, Math.max(0, body.length - available));
    const visible = body.slice(scroll, scroll + available).map((line) => styled(line.text, line.tone));
    while (visible.length < available) visible.push("");
    const position = body.length > available ? ` ${scroll + 1}\u2013${Math.min(scroll + available, body.length)} / ${body.length} ` : "";
    const divider = position + "\u2500".repeat(Math.max(0, width - position.length));
    const frame = [...header, ...visible, styled(divider, "muted"), styled(footer, "muted")].slice(0, height);
    output.write("\x1B[H\x1B[2J" + frame.join("\r\n"));
  }
  function review() {
    const validated = parseFields(command.operation, fields, values);
    if (!validated.success) {
      const issue = validated.error.issues[0];
      const field = fields.find((field2) => field2.name === issue.path[0]);
      error = field && !(values[field.name] ?? "").trim() ? `Enter ${field.label.toLowerCase()}.` : `${field?.label ?? "Input"}: ${issue.message}`;
      if (field?.advanced) advanced = true;
      const first = formRows().findIndex((item) => item.kind === "field" && item.field.name === field?.name);
      if (first >= 0) fieldIndex = first;
      screen = "form";
    } else {
      parsed = validated.data;
      screen = "review";
      scroll = 0;
      error = "";
      details = false;
    }
  }
  function open(item) {
    command = item;
    fields = fieldsFor(command.operation, project).sort((a, b) => Number(b.required) - Number(a.required));
    values = drafts.get(command.operation) ?? Object.fromEntries(fields.map((field) => [field.name, field.initial]));
    drafts.set(command.operation, values);
    fieldIndex = 0;
    scroll = 0;
    error = "";
    advanced = false;
    details = false;
    screen = "form";
    if (command.operation === "sqlcl.configure") {
      void loadSqlclSettings(true).catch(crash);
      return;
    }
    if (command.operation.startsWith("connection.")) {
      void loadConnections().catch(crash);
      return;
    }
    if (!fields.some((field) => !field.advanced)) review();
  }
  async function loadSqlclSettings(edit = false) {
    const revision = ++sqlclRevision;
    if (edit) {
      screen = "running";
      started = Date.now();
      controller = new AbortController();
      render();
    }
    try {
      const loaded = await loadSqlcl();
      if (revision !== sqlclRevision) return;
      sqlcl = loaded;
      sqlclError = false;
      if (edit) {
        values = {
          mode: sqlcl.mode,
          databaseTransport: sqlcl.databaseTransport ?? "direct",
          mcpRestrictLevel: sqlcl.mcpRestrictLevel
        };
        drafts.set(command.operation, values);
        screen = "form";
      }
    } catch (error2) {
      if (revision !== sqlclRevision) return;
      sqlclError = true;
      if (edit) {
        result = failure("sqlcl.status", error2);
        screen = "result";
      }
    }
    if (edit && closeAfterRun) close();
    else renderSafe();
  }
  function nextField() {
    error = "";
    screen = "form";
    fieldIndex = Math.min(formRows().length - 1, fieldIndex + 1);
  }
  function toggleAdvanced() {
    advanced = !advanced;
    const index = formRows().findIndex((row) => row.kind === "advanced");
    if (index >= 0) fieldIndex = index;
  }
  async function loadConnections() {
    screen = "running";
    scroll = 0;
    started = Date.now();
    controller = new AbortController();
    render();
    try {
      result = await execute("connection.list", { saved: true }, controller.signal);
      if (result.ok) {
        const data = result.data;
        if (!Array.isArray(data?.connections) || !data.connections.every((item) => typeof item.name === "string"))
          throw new Fault(
            "CONNECTION_LIST_UNCONFIRMED",
            "SQLcl did not return a valid saved connection list.",
            3
          );
        savedNames = data.connections.map((item) => item.name);
        screen = "connections";
        selected = 0;
      } else screen = "result";
    } catch (error2) {
      result = failure("connection.list", error2);
      screen = "result";
    }
    details = false;
    if (closeAfterRun) close();
    else render();
  }
  async function run() {
    screen = "running";
    scroll = 0;
    started = Date.now();
    controller = new AbortController();
    render();
    try {
      result = await execute(command.operation, parsed, controller.signal);
      if (result.ok && command.operation === "sqlcl.configure") {
        sqlclRevision++;
        sqlcl = result.data;
        sqlclError = false;
      }
    } catch (e) {
      result = failure(command.operation, e);
    }
    screen = "result";
    scroll = 0;
    details = false;
    if (closeAfterRun) close();
    else render();
  }
  function onKey(text, key = {}) {
    if (closed) return;
    if (key.ctrl && key.name === "c") {
      cancel();
      return;
    }
    if (screen === "running") return;
    const up = key.name === "up", down = key.name === "down", enter = key.name === "return", escape = key.name === "escape";
    if (screen === "menu" && key.name === "tab") {
      homeFocus = homeFocus === "actions" ? "apexlang" : "actions";
      render();
      return;
    }
    if (screen === "menu" && key.ctrl && key.name === "r") {
      void reloadCatalogue().catch(crash);
      render();
      return;
    }
    if (screen === "menu" && homeFocus === "apexlang") {
      const length = filterApexlang(catalogue, catalogueQuery).length;
      if (up) catalogueSelected = Math.max(0, catalogueSelected - 1);
      else if (down) catalogueSelected = Math.min(Math.max(0, length - 1), catalogueSelected + 1);
      else if (key.name === "pageup") catalogueSelected = Math.max(0, catalogueSelected - 8);
      else if (key.name === "pagedown")
        catalogueSelected = Math.min(Math.max(0, length - 1), catalogueSelected + 8);
      else if (key.name === "home") catalogueSelected = 0;
      else if (key.name === "end") catalogueSelected = Math.max(0, length - 1);
      else if (escape) {
        if (catalogueQuery) {
          catalogueQuery = "";
          catalogueSelected = 0;
        } else homeFocus = "actions";
      } else if (key.name === "backspace") {
        catalogueQuery = Array.from(catalogueQuery).slice(0, -1).join("");
        catalogueSelected = 0;
      } else if (text && !key.ctrl && !key.meta && !enter) {
        catalogueQuery = (catalogueQuery + terminalText(text)).slice(0, 256);
        catalogueSelected = 0;
      }
      render();
      return;
    }
    if (screen === "menu" || screen === "connections") {
      const connectionsScreen = screen === "connections";
      const length = connectionsScreen ? visibleConnections().length : filtered().length;
      if (up) selected = Math.max(0, selected - 1);
      else if (down) selected = Math.min(Math.max(0, length - 1), selected + 1);
      else if (key.name === "pageup") selected = Math.max(0, selected - 8);
      else if (key.name === "pagedown") selected = Math.min(Math.max(0, length - 1), selected + 8);
      else if (key.name === "home") selected = 0;
      else if (key.name === "end") selected = Math.max(0, length - 1);
      else if (connectionsScreen && key.ctrl && key.name === "r") {
        void loadConnections().catch(crash);
        return;
      } else if (enter && length) {
        if (connectionsScreen) {
          command = commands.find((item) => item.operation === "connection.test");
          parsed = { saved: true, name: visibleConnections()[selected] };
          void run().catch(crash);
          return;
        }
        open(filtered()[selected]);
      } else if (escape) {
        if (connectionsScreen) {
          if (connectionQuery) connectionQuery = "";
          else {
            screen = "menu";
            selected = 0;
          }
        } else if (query) {
          query = "";
          selected = 0;
        } else close();
      } else if (key.name === "backspace") {
        if (connectionsScreen) connectionQuery = Array.from(connectionQuery).slice(0, -1).join("");
        else query = Array.from(query).slice(0, -1).join("");
        selected = 0;
      } else if (text && !key.ctrl && !key.meta) {
        if (connectionsScreen) connectionQuery = (connectionQuery + terminalText(text)).slice(0, 512);
        else query = (query + terminalText(text)).slice(0, 256);
        selected = 0;
      }
    } else if (screen === "form") {
      const rows = formRows(), item = rows[fieldIndex];
      if (up || key.name === "tab" && key.shift) fieldIndex = Math.max(0, fieldIndex - 1);
      else if (down || key.name === "tab") fieldIndex = Math.min(rows.length - 1, fieldIndex + 1);
      else if (escape) {
        screen = "menu";
        scroll = 0;
      } else if (key.ctrl && key.name === "r") review();
      else if (key.ctrl && key.name === "o") toggleAdvanced();
      else if (enter || key.name === "space" && item.kind === "field" && item.field.type === "boolean") {
        if (item.kind === "review") review();
        else if (item.kind === "advanced") toggleAdvanced();
        else {
          editField = item.field;
          if (editField.type === "boolean")
            values[editField.name] = values[editField.name] === "true" ? "false" : "true";
          else if (editField.choices.length) {
            choiceIndex = Math.max(0, choices().indexOf(values[editField.name] ?? ""));
            screen = "choices";
          } else {
            editing = values[editField.name] ?? "";
            cursor = Array.from(editing).length;
            screen = "edit";
          }
          error = "";
        }
      }
    } else if (screen === "choices") {
      if (up) choiceIndex = Math.max(0, choiceIndex - 1);
      else if (down) choiceIndex = Math.min(choices().length - 1, choiceIndex + 1);
      else if (enter) {
        values[editField.name] = choices()[choiceIndex];
        if (command.operation === "sqlcl.configure" && editField.name === "databaseTransport" && values.databaseTransport === "ords")
          values.mode = "cli";
        nextField();
      } else if (escape) screen = "form";
    } else if (screen === "edit") {
      const chars = Array.from(editing);
      if (escape) screen = "form";
      else if (enter) {
        values[editField.name] = editing;
        nextField();
      } else if (key.name === "left") cursor = Math.max(0, cursor - 1);
      else if (key.name === "right") cursor = Math.min(chars.length, cursor + 1);
      else if (key.name === "home" || key.ctrl && key.name === "a") cursor = 0;
      else if (key.name === "end" || key.ctrl && key.name === "e") cursor = chars.length;
      else if (key.ctrl && key.name === "u") {
        editing = "";
        cursor = 0;
      } else if (key.name === "backspace" && cursor > 0) {
        chars.splice(--cursor, 1);
        editing = chars.join("");
      } else if (key.name === "delete") {
        chars.splice(cursor, 1);
        editing = chars.join("");
      } else if (text && !key.ctrl && !key.meta && chars.length < 8192) {
        const inserted = Array.from(terminalText(text)).slice(0, 8192 - chars.length);
        chars.splice(cursor, 0, ...inserted);
        editing = chars.join("");
        cursor += inserted.length;
      }
    } else {
      if (up) scroll = Math.max(0, scroll - 1);
      else if (down) scroll++;
      else if (key.name === "pageup") scroll = Math.max(0, scroll - Math.max(1, (output.rows || 24) - 8));
      else if (key.name === "pagedown") scroll += Math.max(1, (output.rows || 24) - 8);
      else if (key.name === "home") scroll = 0;
      else if (key.name === "end") scroll = Number.MAX_SAFE_INTEGER;
      else if (key.name === "d" || text === "d") {
        details = !details;
        scroll = 0;
      } else if (escape) {
        screen = screen === "result" ? "menu" : "form";
        scroll = 0;
      } else if (enter) {
        if (screen === "review") {
          void run().catch(crash);
          return;
        }
        if (command.operation.startsWith("connection.")) {
          void loadConnections().catch(crash);
          return;
        }
        screen = "form";
        scroll = 0;
      }
    }
    render();
  }
  const raw = input.isRaw ?? false;
  const flowing = input.readableFlowing === true;
  const onSignal = () => cancel(true);
  const onKeySafe = (text, key) => {
    try {
      onKey(text, key);
    } catch (error2) {
      crash(error2);
    }
  };
  const renderSafe = () => {
    try {
      render();
    } catch (error2) {
      crash(error2);
    }
  };
  const previousData = new Set(input.listeners("data"));
  const previousNewListener = new Set(input.listeners("newListener"));
  let timer;
  try {
    emitKeypressEvents(input);
    input.on("keypress", onKeySafe);
    input.on("end", onSignal);
    input.on("error", crash);
    output.on("error", crash);
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    output.on("resize", renderSafe);
    input.setRawMode(true);
    input.resume();
    output.write("\x1B[?1049h\x1B[?25l");
    timer = setInterval(() => {
      if (screen === "running") renderSafe();
    }, 250);
    render();
    void reloadCatalogue().catch(crash);
    void loadSqlclSettings().catch(crash);
    await done;
  } finally {
    if (timer) clearInterval(timer);
    input.off("keypress", onKeySafe);
    input.off("end", onSignal);
    input.off("error", crash);
    output.off("error", crash);
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    output.off("resize", renderSafe);
    for (const listener of input.listeners("data"))
      if (!previousData.has(listener)) input.off("data", listener);
    for (const listener of input.listeners("newListener"))
      if (!previousNewListener.has(listener))
        input.off("newListener", listener);
    input.setRawMode(raw);
    if (!flowing) input.pause();
    output.write("\x1B[0m\x1B[?25h\x1B[?1049l");
  }
}
export {
  runTui,
  terminalText
};
