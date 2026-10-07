import { z } from 'zod';
import { contained, exists, readJson } from './fs.ts';
import { parse } from './config.ts';

// `host` is the in-app browser of the current host (Codex or Claude Code); `codex` is
// its original name and remains accepted with the same behavior.
export const browserModeSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{N} ._-]+$/u);
export type BrowserMode = string;

export const browserPreferencesSchema = z.strictObject({
  browserMode: browserModeSchema.default('codex'),
});

export async function browserPreferences(root: string) {
  const file = await contained(root, '.apexrest/panel/preferences.json');
  // Older installations may have execution settings here. Read only the browser preference;
  // writes use the strict schema so removed settings cannot be reintroduced.
  return parse(z.object(browserPreferencesSchema.shape), (await exists(file)) ? await readJson(file) : {});
}
