import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  parse
} from "./chunk-JM4SAWAH.mjs";
import {
  external_exports
} from "./chunk-RCJG4YXR.mjs";
import {
  contained,
  exists,
  readJson
} from "./chunk-WPS3CSQJ.mjs";

// packages/core/src/browser-preferences.ts
var BROWSER_MODES = ["codex", "host"];
var browserPreferencesSchema = external_exports.strictObject({
  browserMode: external_exports.enum(BROWSER_MODES).default("codex")
});
async function browserPreferences(root) {
  const file = await contained(root, ".apexrest/panel/preferences.json");
  return parse(external_exports.object(browserPreferencesSchema.shape), await exists(file) ? await readJson(file) : {});
}

export {
  browserPreferences
};
