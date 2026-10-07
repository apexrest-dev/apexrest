import { environment, requireTrust, type ProjectContext } from './config.ts';
import { browserPreferences, type BrowserMode } from './browser-preferences.ts';
import { Fault } from './result.ts';

export type { BrowserMode };

export function allowedOrigin(url: string, origins: string[]) {
  const u = new URL(url);
  if (
    !['https:', 'http:'].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.hostname.endsWith('.invalid') ||
    (u.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) ||
    !origins.includes(u.origin)
  )
    throw new Fault('ORIGIN_DENIED', 'The target origin is outside the configured allowlist.', 4);
  return u;
}

export function browserInstructions(mode: BrowserMode) {
  return `Interactive APEX verification browser: ${mode}. Use apexrest_browser_open for the explicit environment, then open its URL with the host-provided in-app browser controls (when available). Opening a URL is not verification. Inspect rendering, navigation, validation and changed interactions. If browser controls or authentication are unavailable, report the check as not_run with the exact limitation. Never read or copy browser profiles, cookies or credentials. Login is interactive, without login capture.`;
}

export async function openVerificationBrowser(ctx: ProjectContext, name: string, browserMode?: BrowserMode) {
  await requireTrust(ctx.root);
  const target = environment(ctx, name);
  const url = allowedOrigin(target.baseUrl, [
    new URL(target.baseUrl).origin,
    ...target.allowedOrigins,
  ]).toString();
  const mode: BrowserMode = browserMode ?? (await browserPreferences(ctx.root)).browserMode;
  const common = {
    browserMode: mode,
    environment: name,
    url,
    verified: false,
    nextAction: browserInstructions(mode),
  };
  return { ...common, status: 'host_action_required' };
}
