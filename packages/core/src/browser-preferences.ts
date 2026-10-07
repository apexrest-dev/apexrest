import { z } from 'zod';
import { contained, exists, readJson } from './fs.ts';
import { parse } from './config.ts';

// `host` is the in-app browser of the current host (Codex or Claude Code); `codex` is
// its original name and remains accepted with the same behavior.
export const BROWSER_MODES = ['codex', 'host'] as const;
export type BrowserMode = (typeof BROWSER_MODES)[number];

export const browserPreferencesSchema = z.strictObject({
  browserMode: z.enum(BROWSER_MODES).default('codex'),
});

export async function browserPreferences(root: string) {
  const file = await contained(root, '.apexrest/panel/preferences.json');
  // Older installations may have execution settings here. Read only the browser preference;
  // writes use the strict schema so removed settings cannot be reintroduced.
  return parse(z.object(browserPreferencesSchema.shape), (await exists(file)) ? await readJson(file) : {});
}
