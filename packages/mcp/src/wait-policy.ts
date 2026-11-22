import { z } from 'zod';

export type McpHost = 'codex' | 'claude';

export function hostFromClient(name: string | undefined): McpHost | undefined {
  if (!name) return undefined;
  if (/claude/i.test(name)) return 'claude';
  if (/codex/i.test(name)) return 'codex';
  return undefined;
}

/** Protocol identity wins. A managed launcher identifies clients with unfamiliar names. */
export function mcpHost(clientName?: string, registeredHost?: string): McpHost | undefined {
  const observed = hostFromClient(clientName);
  if (observed) return observed;
  return registeredHost === 'codex' || registeredHost === 'claude' ? registeredHost : undefined;
}

// Codex's default tool timeout is 60 seconds. Keep headroom for request handling.
// This bounds accepted polling waits, not in-process compilation/planning time.
export const CODEX_WAIT_MAX_SECONDS = 30;
export const codexShipWaitSeconds = z
  .number()
  .int()
  .min(0)
  .max(CODEX_WAIT_MAX_SECONDS)
  .default(25)
  .describe('Codex job wait, up to 30 seconds. Work can continue after this wait.');
export const codexStatusWaitSeconds = z
  .number()
  .int()
  .min(0)
  .max(CODEX_WAIT_MAX_SECONDS)
  .default(0)
  .describe('Codex status wait, up to 30 seconds. Poll the same jobId if needed.');
