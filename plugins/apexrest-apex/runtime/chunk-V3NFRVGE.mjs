import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  canonical,
  exists,
  hash,
  readJson,
  withLock,
  writeJson
} from "./chunk-YLKYRT24.mjs";

// packages/core/src/revision.ts
import path from "node:path";
var revisionOf = (files) => hash(canonical(files));
function sourceRevision(files, config) {
  return { revision: revisionOf(files), configuration: hash(canonical(config)) };
}
function sourceChange(previous, next, applicationDir) {
  const before = previous ?? {};
  const changedFiles = [];
  const addedFiles = [];
  const removedFiles = [];
  for (const [file, sha] of Object.entries(next))
    if (!(file in before)) addedFiles.push(file);
    else if (before[file] !== sha) changedFiles.push(file);
  for (const file of Object.keys(before)) if (!(file in next)) removedFiles.push(file);
  const prefix = applicationDir.replace(/\/+$/u, "") + "/pages/";
  const pages = /* @__PURE__ */ new Set();
  let unknown = previous === null;
  for (const file of [...changedFiles, ...addedFiles, ...removedFiles]) {
    const page = file.startsWith(prefix) ? /^p(\d{1,5})(?:-[^/]*)?\.apx$/u.exec(file.slice(prefix.length)) : null;
    if (page && Number(page[1]) !== 0) pages.add(String(Number(page[1])));
    else unknown = true;
  }
  return {
    revision: revisionOf(next),
    previousRevision: previous ? revisionOf(previous) : null,
    changedFiles: changedFiles.sort(),
    addedFiles: addedFiles.sort(),
    removedFiles: removedFiles.sort(),
    affectedPages: unknown ? "unknown" : [...pages].sort((a, b) => Number(a) - Number(b))
  };
}
var fileOf = (root) => path.join(root, ".apexrest", "revisions.json");
async function read(root) {
  const file = fileOf(root);
  if (!await exists(file)) return { version: 1, importing: {}, deployed: {}, failed: {} };
  const value = await readJson(file);
  if (value?.version !== 1) return { version: 1, importing: {}, deployed: {}, failed: {} };
  return { version: 1, importing: {}, deployed: {}, failed: {}, ...value };
}
var newer = (record, existing) => !existing || Date.parse(record.startedAt) >= Date.parse(existing.startedAt);
async function recordRevision(root, kind, record) {
  const file = fileOf(root);
  return withLock(file + ".lock", async () => {
    const state = await read(root);
    let applied = false;
    if (kind === "validated" || kind === "preview") {
      if (newer(record, state[kind])) {
        state[kind] = record;
        applied = true;
      }
    } else {
      const env = record.environment ?? "default";
      const table = state[kind];
      if (newer(record, table[env])) {
        table[env] = record;
        applied = true;
      }
      if (kind !== "importing" && state.importing[env]?.runId === record.runId) delete state.importing[env];
    }
    if (applied || kind !== "importing") await writeJson(file, state);
    return applied;
  });
}
async function revisionStatus(root, latestLocal) {
  const state = await read(root);
  const mark = (record) => record ? { ...record, current: record.revision === latestLocal.revision } : null;
  return {
    latestLocal,
    validated: mark(state.validated),
    preview: mark(state.preview),
    importing: state.importing,
    deployed: Object.fromEntries(Object.entries(state.deployed).map(([env, record]) => [env, mark(record)])),
    failed: state.failed
  };
}

export {
  revisionOf,
  sourceRevision,
  sourceChange,
  recordRevision,
  revisionStatus
};
