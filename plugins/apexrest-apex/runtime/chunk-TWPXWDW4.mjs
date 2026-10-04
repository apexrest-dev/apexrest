import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  sanitized
} from "./chunk-OX4ZKXO7.mjs";

// packages/cli/src/tui-view.ts
import { stripVTControlCharacters } from "node:util";
var tones = {
  plain: "",
  accent: "1;36",
  muted: "90",
  selected: "1;30;46",
  success: "1;32",
  warning: "1;33",
  error: "1;31"
};
function terminalText(text) {
  return stripVTControlCharacters(text).replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, "");
}
function characterWidth(char) {
  if (new RegExp("\\p{Mark}", "u").test(char)) return 0;
  const code = char.codePointAt(0);
  return code >= 4352 && (code <= 4447 || code === 9001 || code === 9002 || code >= 11904 && code <= 42191 || code >= 44032 && code <= 55203 || code >= 63744 && code <= 64255 || code >= 65040 && code <= 65135 || code >= 65280 && code <= 65376 || code >= 65504 && code <= 65510 || code >= 127744 && code <= 129791 || code >= 131072) ? 2 : 1;
}
function clip(text, width) {
  let used = 0, result = "";
  for (const char of terminalText(text)) {
    used += characterWidth(char);
    if (used > width) break;
    result += char;
  }
  return result;
}
function padCell(text, width) {
  const value = clip(text, width);
  const used = Array.from(value).reduce((sum, char) => sum + characterWidth(char), 0);
  return value + " ".repeat(Math.max(0, width - used));
}
function wrap(text, width) {
  const lines = [];
  for (const line of text.split("\n")) {
    let part = "", used = 0;
    for (const char of terminalText(line)) {
      const size = characterWidth(char);
      if (used + size > width) {
        lines.push(part);
        part = "";
        used = 0;
      }
      part += char;
      used += size;
    }
    lines.push(part);
  }
  return lines;
}
function paint(text, tone, color) {
  return color && tones[tone] ? `\x1B[${tones[tone]}m${text}\x1B[0m` : text;
}
var logo = [
  "            ",
  "  YY    RRR ",
  " YYYY  .RRR ",
  " YYYYYCC.RR ",
  " YYYYCCCC.  ",
  "  YYCCCCC   ",
  "   CCCCCY   ",
  "  CCCCCYYY  ",
  "  CCCCYYYYY ",
  " . CC YYYYY ",
  " ...   YYY  ",
  "        Y   "
];
var palette = {
  C: "49;190;249",
  Y: "255;213;65",
  R: "255;65;65",
  ".": "148;163;184"
};
function brand(color, compact) {
  if (compact)
    return [paint(" \u2572\u2571  APEXREST", "accent", color), paint(" \u2571\u2572  Tools \xB7 Plugins \xB7 SQLcl", "muted", color)];
  const wordmark = [
    "",
    " \u2584\u2580\u2588 \u2588\u2580\u2588 \u2588\u2580\u2580 \u2580\u2584\u2580 \u2588\u2580\u2588 \u2588\u2580\u2580 \u2588\u2580\u2580 \u2580\u2588\u2580",
    " \u2588\u2580\u2588 \u2588\u2580\u2580 \u2588\u2588\u2584 \u2588 \u2588 \u2588\u2580\u2584 \u2588\u2588\u2584 \u2584\u2588\u2588  \u2588 ",
    "",
    " APEXREST  \xB7  Tools. Plugins. Connections.",
    ""
  ];
  return wordmark.map((word, row) => {
    let symbol = " ";
    for (let col = 0; col < 12; col++) {
      const top = logo[row * 2][col], bottom = logo[row * 2 + 1][col];
      const glyph = top === " " ? bottom === " " ? " " : "\u2584" : bottom === " " ? "\u2580" : "\u2588";
      if (!color || glyph === " ") symbol += glyph;
      else if (top !== " " && bottom !== " " && top !== bottom)
        symbol += `\x1B[38;2;${palette[top]};48;2;${palette[bottom]}m\u2580\x1B[0m`;
      else symbol += `\x1B[38;2;${palette[top === " " ? bottom : top]}m${glyph}\x1B[0m`;
    }
    return symbol + "   " + paint(word, row < 3 ? "accent" : "muted", color);
  });
}
function labelFor(key) {
  const text = key.replace(/([a-z\d])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function valueText(value) {
  return value === true ? "Yes" : value === false ? "No" : value === null ? "None" : String(value);
}
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function reportedStatus(result) {
  if (!result.ok) return result.status;
  const data = record(result.data), inner = record(data.result);
  if (data.ok === false) return "failed";
  if (inner.ok === false) return typeof inner.status === "string" ? inner.status : "failed";
  const state = record(data.state);
  return typeof data.status === "string" ? data.status : typeof data.state === "string" ? data.state : typeof state.state === "string" ? state.state : result.status;
}
var statuses = {
  outcome_unknown: ["Outcome unknown", "warning"],
  cancellation_requested: ["Cancellation requested", "warning"],
  cancelled: ["Cancelled", "warning"],
  "needs-user-action": ["Needs your attention", "warning"],
  blocked: ["Blocked", "warning"],
  dependency_missing: ["Missing tools", "warning"],
  not_configured: ["Setup required", "warning"],
  empty: ["No tests ran", "warning"],
  failed: ["Could not complete", "error"],
  running: ["Still running", "accent"],
  queued: ["Job queued", "accent"],
  planned: ["Preview ready", "accent"],
  approved: ["Approved; waiting to run", "accent"],
  backing_up: ["Backing up", "accent"],
  migrating: ["Running migrations", "accent"],
  importing: ["Importing", "accent"],
  verifying: ["Verifying", "accent"],
  testing: ["Running tests", "accent"],
  "toolchain-verified": ["Tools verified", "success"]
};
function resultTitle(result) {
  if (result.ok && result.operation === "connection.test") return "Connection successful";
  return statuses[reportedStatus(result)]?.[0] ?? (result.ok ? "Completed" : "Could not complete");
}
function resultTone(result) {
  return statuses[reportedStatus(result)]?.[1] ?? (result.ok ? "success" : "error");
}
function setupPreview(payload, toolsOnly = false) {
  const native = record(payload.native), registration = record(native.registration), version = record(payload.package).version, toolchain = record(payload.toolchain);
  const pluginActions = {
    install: "Install APEXREST",
    update: "Update managed installation",
    adopt: "Update existing APEXREST installation"
  };
  const lines = toolsOnly ? [] : [
    {
      text: `Plugin: ${pluginActions[String(registration.action)] ?? "Install APEXREST"}`,
      tone: "accent"
    }
  ];
  if (!toolsOnly && version)
    lines.push({
      text: `Version: ${registration.previousVersion ? `${registration.previousVersion} \u2192 ` : ""}${version}`
    });
  if (!toolsOnly && registration.action === "adopt" && registration.previousRoot)
    lines.push({ text: `Current location: ${registration.previousRoot}` });
  if (!toolsOnly && native.codexHome) lines.push({ text: `Codex profile: ${native.codexHome}` });
  if (!toolsOnly) lines.push({ text: "" });
  const terms = /* @__PURE__ */ new Set();
  let needsConsent = false;
  if (toolchain.status === "not-requested") {
    lines.push({ text: "Tools: Not requested (plugin only)", tone: "muted" });
  } else {
    const toolNames = { node: "Node.js", java: "Java", sqlcl: "SQLcl" };
    const actions = {
      "download-install": "Install",
      verify: "Verify installed",
      skip: "Skip"
    };
    for (const value of Array.isArray(toolchain.steps) ? toolchain.steps : []) {
      const step = record(value), artifact = record(step.artifact), action = step.reuse ? "Reuse" : actions[String(step.action)] ?? "Check";
      const consent = !step.reuse && step.action !== "verify" && (step.consent === "required" || step.consent === void 0 && artifact.consentRequired === true);
      needsConsent ||= consent;
      if (consent && typeof artifact.license === "string") terms.add(artifact.license);
      lines.push({
        text: `${toolNames[String(artifact.id)] ?? labelFor(String(artifact.id))}: ${action}${artifact.version ? ` ${artifact.version}` : ""}${consent ? " \xB7 license consent needed" : ""}`,
        tone: consent ? "warning" : "plain"
      });
    }
    const browser = record(toolchain.browser);
    if (browser.action)
      lines.push({
        text: `Chromium: ${browser.action === "skip" ? "Skip" : "Install and verify"}${browser.action !== "skip" && browser.installOsDeps === true ? " (including system packages)" : ""}`
      });
    if (toolchain.home) lines.push({ text: `Tools directory: ${toolchain.home}`, tone: "muted" });
  }
  if (needsConsent) {
    lines.push({ text: "" });
    for (const license of terms) lines.push({ text: `Oracle terms: ${license}` });
    lines.push({
      text: "Review the Oracle terms, then enable Accept Oracle license terms to continue.",
      tone: "warning"
    });
  }
  lines.push(
    { text: "" },
    { text: "Press Enter to return to the form, then review and run the action.", tone: "muted" },
    {
      text: toolchain.status === "not-requested" ? "D shows full package details." : "D shows full package and download details.",
      tone: "muted"
    }
  );
  return lines;
}
function resultLines(result) {
  const data = sanitized(result.data), payload = record(data);
  const lines = result.summary === "Operation completed." ? [] : [{ text: result.summary }, { text: "" }];
  if (result.ok && ["sqlcl.configure", "sqlcl.status"].includes(result.operation))
    return [
      { text: `SQLcl mode: ${String(payload.mode).toUpperCase()}`, tone: "accent" },
      {
        text: payload.mode === "mcp" ? `Official SQLcl MCP server \xB7 restrict level ${payload.mcpRestrictLevel}` : "SQLcl command-line process"
      },
      {
        text: payload.databaseTransport === "ords" ? "Database network: ORDS HTTP(S) \xB7 plugin connection settings" : "Database network: Direct Oracle listener"
      },
      { text: "New Oracle operations use this mode. Active operations keep their selected mode." }
    ];
  for (const diagnostic of result.diagnostics) {
    if (diagnostic.message !== result.summary)
      lines.push({ text: diagnostic.message, tone: diagnostic.severity === "error" ? "error" : "plain" });
  }
  const actionLabels = {
    CODEX_RELOAD_REQUIRED: "Reload Codex to load the updated plugin.",
    DATABASE_CONNECTION_REQUIRED: "Save a connection in SQLcl, then open List saved SQLcl connections.",
    ORACLE_LICENSE_CONSENT_REQUIRED: "Review the Oracle terms, then enable Accept Oracle license terms to continue.",
    PLAYWRIGHT_SETUP_REQUIRED: "Open Install tools to install browser tools."
  };
  const actions = [
    ...result.nextActions,
    ...Array.isArray(payload.nextActions) ? payload.nextActions.filter((value) => typeof value === "string") : [],
    ...typeof payload.nextAction === "string" ? [payload.nextAction] : [],
    ...Array.isArray(payload.actions) ? payload.actions.map((value) => {
      const action = record(value);
      return typeof action.message === "string" ? action.message : actionLabels[String(action.code)] ?? labelFor(String(action.code ?? value));
    }) : []
  ];
  if (actions.length) {
    lines.push({ text: "Next steps", tone: "accent" });
    for (const action of new Set(actions)) lines.push({ text: `  \u2022 ${action}` });
    lines.push({ text: "" });
  }
  const detail = (value, indent = 0) => {
    const prefix = "  ".repeat(indent);
    if (indent > 5) {
      lines.push({ text: `${prefix}More information in details (D).`, tone: "muted" });
      return;
    }
    if (Array.isArray(value)) {
      if (!value.length) lines.push({ text: `${prefix}No items.`, tone: "muted" });
      value.forEach((item, index) => {
        if (item && typeof item === "object") {
          lines.push({ text: `${prefix}${index + 1}.`, tone: "accent" });
          detail(item, indent + 1);
        } else lines.push({ text: `${prefix}\u2022 ${valueText(item)}` });
      });
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (indent === 0 && ["schemaVersion", "nextAction", "nextActions", "actions"].includes(key)) continue;
        if (Array.isArray(item) && item.length === 0) continue;
        if (item && typeof item === "object") {
          lines.push({
            text: `${prefix}${labelFor(key)}${Array.isArray(item) ? ` (${item.length})` : ""}`,
            tone: "accent"
          });
          detail(item, indent + 1);
        } else lines.push({ text: `${prefix}${labelFor(key)}: ${valueText(item)}` });
      }
    } else if (value !== void 0) lines.push({ text: prefix + valueText(value) });
  };
  if (result.ok && ["setup", "plugin.install", "plugin.update"].includes(result.operation) && payload.status === "planned" && record(payload.native).state === "planned") {
    lines.push(...setupPreview(payload));
  } else if (result.ok && result.operation === "dependencies.install" && payload.status === "planned") {
    lines.push(...setupPreview({ toolchain: payload.plan }, true));
  } else if (result.ok && result.operation === "dependencies.uninstall") {
    const plan = payload.status === "planned" ? record(payload.plan) : payload;
    const steps = Array.isArray(plan.steps) ? plan.steps.map(record) : [];
    if (!steps.length) lines.push({ text: "No managed tools to remove." });
    for (const step of steps) {
      lines.push({
        text: `${labelFor(String(step.component))}: ${step.action === "keep" ? "Keep" : payload.status === "planned" ? "Remove" : "Removed"}`,
        tone: step.action === "keep" ? "muted" : "plain"
      });
      if (step.reason) lines.push({ text: `  ${step.reason}`, tone: "muted" });
      else if (step.directory) lines.push({ text: `  ${step.directory}`, tone: "muted" });
    }
    lines.push(
      { text: "" },
      { text: "Projects, saved connections and download cache are preserved.", tone: "muted" }
    );
    if (payload.status === "planned")
      lines.push({
        text: "Press Enter to return to the form, then review and run the action.",
        tone: "muted"
      });
  } else detail(data);
  if (result.artifacts.length) {
    lines.push({ text: "" }, { text: "Artifacts", tone: "accent" });
    result.artifacts.forEach((id) => lines.push({ text: `  ${id}` }));
  }
  lines.push({ text: "" }, { text: `Run: ${result.runId}`, tone: "muted" });
  return lines;
}

export {
  terminalText,
  clip,
  padCell,
  wrap,
  paint,
  brand,
  labelFor,
  valueText,
  resultTitle,
  resultTone,
  resultLines
};
