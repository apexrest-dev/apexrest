import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  browserPreferences
} from "./chunk-WPD35JL5.mjs";
import {
  environment
} from "./chunk-TFGUUAFT.mjs";
import "./chunk-U7MVLA3R.mjs";
import {
  Fault
} from "./chunk-I5KYBPSK.mjs";

// packages/core/src/browser.ts
function allowedOrigin(url, origins) {
  const u = new URL(url);
  if (!["https:", "http:"].includes(u.protocol) || u.username || u.password || u.hostname.endsWith(".invalid") || u.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) || !origins.includes(u.origin))
    throw new Fault("ORIGIN_DENIED", "The target origin is outside the configured allowlist.", 4);
  return u;
}
function browserInstructions(mode) {
  return `Interactive APEX verification browser: ${mode}. Use apexrest_browser_open for the explicit environment, then open its URL with the host-provided in-app browser controls (when available). Opening a URL is not verification. Inspect rendering, navigation, validation and changed interactions. If browser controls or authentication are unavailable, report the check as not_run with the exact limitation. Use the browser requested by the user, otherwise the host in-app browser. Authorized login may read an ignored, untracked local ENV file as literal data; never echo passwords or copy cookies/profiles. Opening remains separate from verified behavior.`;
}
async function openVerificationBrowser(ctx, name, browserMode) {
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
  return { ...common, status: "host_action_required" };
}
export {
  allowedOrigin,
  browserInstructions,
  openVerificationBrowser
};
