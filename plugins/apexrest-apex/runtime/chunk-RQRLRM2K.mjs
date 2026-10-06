import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  allowedOrigin,
  browserPreferences
} from "./chunk-GKOCMBCK.mjs";
import {
  environment,
  requireTrust,
  runProcess
} from "./chunk-PEPFC7UE.mjs";
import "./chunk-JYN3YHP3.mjs";
import {
  Fault
} from "./chunk-WPS3CSQJ.mjs";

// packages/core/src/browser.ts
function browserInstructions(mode) {
  return `Interactive APEX verification browser: ${mode}. ` + (mode === "external" ? "Use apexrest_browser_open for the explicit environment to open the system browser. Use available external-browser controls and the user's interactive SSO session. Do not substitute the host in-app browser." : "Use apexrest_browser_open for the explicit environment, then open its URL with the host-provided in-app browser controls (when available). Do not substitute an external browser.") + " Opening a URL is not verification. Inspect the affected interactions with controls for the selected browser; if those controls or authentication are unavailable, report the check as not_run and the exact limitation. Never read or copy browser profiles, cookies or credentials. Login is interactive, without login capture. Automated Playwright suites remain separate and do not inherit interactive-browser cookies.";
}
function externalBrowserCommand(url, platform = process.platform) {
  if (platform === "darwin") return { executable: "/usr/bin/open", args: [url] };
  if (platform === "win32")
    return {
      executable: "powershell.exe",
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Start-Process -FilePath '" + url.replaceAll("'", "''") + "'"
      ]
    };
  return { executable: "xdg-open", args: [url] };
}
async function openVerificationBrowser(ctx, name, launch = runProcess, browserMode) {
  await requireTrust(ctx.root);
  const target = environment(ctx, name);
  const url = allowedOrigin(target.baseUrl, [
    new URL(target.baseUrl).origin,
    ...target.allowedOrigins
  ]).toString();
  const mode = browserMode ?? (await browserPreferences(ctx.root)).browserMode;
  const common = {
    browserMode: mode,
    environment: name,
    url,
    verified: false,
    nextAction: browserInstructions(mode)
  };
  if (mode !== "external") return { ...common, status: "host_action_required" };
  const result = await launch({ ...externalBrowserCommand(url), cwd: ctx.root, timeoutMs: 1e4 });
  if (result.code !== 0 || result.timedOut || result.cancelled)
    throw new Fault(
      "BROWSER_OPEN_FAILED",
      "The system browser could not be opened. Check the local desktop session; no browser verification was performed.",
      3,
      "blocked"
    );
  return { ...common, status: "opened" };
}
export {
  browserInstructions,
  externalBrowserCommand,
  openVerificationBrowser
};
