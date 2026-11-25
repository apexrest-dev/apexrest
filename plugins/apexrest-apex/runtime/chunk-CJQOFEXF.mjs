import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  closeSqlclReadScope
} from "./chunk-5OZJQ7M6.mjs";

// packages/core/src/sqlcl-read-scope.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
var storage = new AsyncLocalStorage();
function connectedReadsDisabled() {
  return /^(?:0|false|off)$/i.test(process.env.APEXREST_CONNECTED_READS ?? "");
}
async function withConnectedReads(action) {
  if (storage.getStore() || connectedReadsDisabled()) return action();
  const scope = { id: randomUUID() };
  try {
    return await storage.run(scope, action);
  } finally {
    await closeSqlclReadScope(scope.id);
  }
}
function currentReadScope() {
  return storage.getStore()?.id;
}

export {
  connectedReadsDisabled,
  withConnectedReads,
  currentReadScope
};
