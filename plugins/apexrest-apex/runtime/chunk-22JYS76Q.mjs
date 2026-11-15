import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  parse
} from "./chunk-GGZKKEXV.mjs";
import {
  external_exports
} from "./chunk-WBDBC3GS.mjs";
import {
  contained,
  exists,
  readJson
} from "./chunk-C7ONAFBZ.mjs";

// packages/core/src/browser-preferences.ts
var browserModeSchema = external_exports.string().trim().min(1).max(80).regex(/^[\p{L}\p{N} ._-]+$/u);
var browserPreferencesSchema = external_exports.strictObject({
  browserMode: browserModeSchema.default("codex")
});
async function browserPreferences(root) {
  const file = await contained(root, ".apexrest/panel/preferences.json");
  return parse(external_exports.object(browserPreferencesSchema.shape), await exists(file) ? await readJson(file) : {});
}

export {
  browserModeSchema,
  browserPreferences
};
