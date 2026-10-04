import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  clip,
  paint,
  wrap
} from "./chunk-TWPXWDW4.mjs";
import {
  PanelService
} from "./chunk-S7T3NE27.mjs";
import "./chunk-JBCN5WYI.mjs";
import "./chunk-G3KR57BY.mjs";
import "./chunk-MU6I3KRM.mjs";
import {
  Fault
} from "./chunk-OX4ZKXO7.mjs";

// packages/cli/src/panel-tui.ts
import { emitKeypressEvents } from "node:readline";
function panelLines(data, tab) {
  if (tab === 2)
    return [
      `Database network: ${data.sqlcl.databaseTransport === "ords" ? "ORDS HTTP(S)" : "Direct Oracle listener"}`,
      `SQLcl execution: ${data.sqlcl.mode.toUpperCase()} \xB7 restriction ${data.sqlcl.mcpRestrictLevel}`,
      `Trusted: ${data.trusted} \xB7 configured: ${data.configured}`,
      "Verification browser: " + data.preferences.browserMode,
      ...JSON.stringify(
        {
          project: data.configuration,
          toolchain: data.toolchain,
          connections: data.connections,
          authorization: data.permissions
        },
        null,
        2
      ).split("\n")
    ];
  if (tab === 1)
    return [
      "APEX OPERATIONS",
      ...data.jobs.flatMap((job) => [`${job.operation} \xB7 ${job.status}`, job.summary]),
      ...data.jobs.length ? [] : ["No operation jobs recorded."],
      "",
      "WORKING-COPY SYNC (local only)",
      ...data.sync.flatMap((row) => [row.environment + " \xB7 " + row.status, JSON.stringify(row)]),
      "",
      "DEPLOYMENT & IMPORT JOURNAL",
      ...data.deployments.flatMap((run) => [run.status + " \xB7 " + run.at, run.details]),
      "",
      "Commands: apexrest apex validate \xB7 apexrest test unit \xB7 apexrest deploy plan --env NAME --out PATH",
      "Existing project trust and deployment authorization remain required."
    ];
  return [
    "CURRENT CODEX SESSION",
    "Describe changes and review results in your open Codex conversation.",
    "This panel runs APEX operations and manages project settings.",
    "",
    `Application: ${data.configuration?.application.alias ?? "Not configured"}`,
    `Source: ${data.configuration?.application.sourceDir ?? "Not configured"}`,
    "Environments: " + (Object.keys(data.configuration?.environments ?? {}).join(", ") || "None configured"),
    "Required suites: " + (data.configuration?.tests.requiredSuites.join(", ") || "None declared"),
    `Trusted: ${data.trusted} \xB7 configured: ${data.configured}`,
    "",
    "WORKING CHANGES",
    ...data.changes.files.length ? data.changes.files : [data.changes.status === "available" ? "No uncommitted Git changes." : "Git status unavailable."]
  ];
}
async function runPanelTui(root) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || process.env.TERM === "dumb")
    throw new Fault("TTY_REQUIRED", "Use an interactive Codex terminal, or apexrest panel status --json.", 2);
  const service = new PanelService(root), output = process.stdout, input = process.stdin;
  let data, error = "", tab = 0, offset = 0, refreshing = false, stopped = false;
  const color = !process.env.NO_COLOR;
  const draw = () => {
    if (stopped) return;
    const width = Math.max(20, output.columns || 80), height = Math.max(7, output.rows || 24);
    const body = data ? panelLines(data, tab).flatMap((line) => wrap(line, width - 2)) : [];
    offset = Math.max(0, Math.min(offset, Math.max(0, body.length - (height - 6))));
    const lines = [
      paint(" APEXREST \xB7 Development panel", "accent", color),
      clip(" " + root, width),
      ["Overview", "APEX operations", "Settings"].map((name, i) => `${i + 1} ${i === tab ? "[" + name + "]" : name}`).join("  "),
      error ? "Disconnected \xB7 " + error : data ? "Live \xB7 " + new Date(data.updatedAt).toLocaleTimeString() : "Connecting\u2026",
      ...body.slice(offset, offset + height - 6),
      "1\u20133 / \u2190\u2192 views \xB7 \u2191\u2193 scroll \xB7 r refresh \xB7 q exit | Actions: apexrest panel action --help"
    ];
    output.write("\x1B[H\x1B[2J" + lines.map((line, i) => i === 0 ? line : clip(line, width)).join("\r\n"));
  };
  const refresh = async () => {
    if (refreshing || stopped) return;
    refreshing = true;
    try {
      data = await service.snapshot();
      error = "";
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      refreshing = false;
      draw();
    }
  };
  const wasRaw = input.isRaw;
  emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  output.write("\x1B[?1049h\x1B[?25l");
  await new Promise((resolve) => {
    const close = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      input.off("keypress", key);
      output.off("resize", draw);
      process.off("SIGINT", close);
      process.off("SIGTERM", close);
      input.setRawMode(wasRaw);
      input.pause();
      output.write("\x1B[?25h\x1B[?1049l");
      resolve();
    };
    const key = (_text, k) => {
      if (k.name === "q" || k.ctrl && k.name === "c") return close();
      if (/^[1-3]$/.test(k.name ?? "")) {
        tab = Number(k.name) - 1;
        offset = 0;
      }
      if (k.name === "right" || k.name === "left") {
        tab = (tab + (k.name === "right" ? 1 : 2)) % 3;
        offset = 0;
      }
      if (k.name === "up") offset--;
      if (k.name === "down") offset++;
      if (k.name === "pageup") offset -= 10;
      if (k.name === "pagedown") offset += 10;
      if (k.name === "r") void refresh();
      else draw();
    };
    const timer = setInterval(() => {
      void refresh();
    }, 2e3);
    input.on("keypress", key);
    output.on("resize", draw);
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
    void refresh();
  });
}
export {
  panelLines,
  runPanelTui
};
