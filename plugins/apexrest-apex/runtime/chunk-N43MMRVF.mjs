import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  managedHome
} from "./chunk-PWI5SWBA.mjs";

// packages/core/src/preview/registry.ts
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
var owner = "host";
var registered = /* @__PURE__ */ new Set();
var shutdown;
var exitHooked = false;
var signalsHooked = false;
function setPreviewOwner(value) {
  owner = value;
}
var registryDir = () => path.join(managedHome(), "preview", "servers");
var entryFile = (pid, port) => path.join(registryDir(), `${pid}-${port}.json`);
function onPreviewShutdown(stopAll) {
  shutdown = stopAll;
}
function hookExit() {
  if (!exitHooked) {
    exitHooked = true;
    process.on("exit", () => {
      for (const file of registered) fs.rmSync(file, { force: true });
    });
  }
  if (owner !== "cli" || signalsHooked) return;
  signalsHooked = true;
  let stopping = false;
  const stop = (code) => {
    if (stopping) process.exit(code);
    stopping = true;
    const timer = setTimeout(() => process.exit(code), 5e3);
    timer.unref();
    void (shutdown?.() ?? Promise.resolve()).catch(() => void 0).finally(() => process.exit(code));
  };
  process.on("SIGINT", () => stop(130));
  process.on("SIGTERM", () => stop(143));
}
function registerPreview(entry) {
  const full = { pid: process.pid, owner, startedAt: (/* @__PURE__ */ new Date()).toISOString(), ...entry };
  const file = entryFile(full.pid, full.port);
  try {
    fs.mkdirSync(registryDir(), { recursive: true, mode: 448 });
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(full, null, 2) + "\n", { mode: 384 });
    fs.renameSync(temporary, file);
    registered.add(file);
  } catch {
  }
  hookExit();
  return full;
}
function unregisterPreview(port, pid = process.pid) {
  const file = entryFile(pid, port);
  fs.rmSync(file, { force: true });
  registered.delete(file);
}
function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}
function portOpen(host, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}
function parseEntry(text) {
  try {
    const value = JSON.parse(text);
    if (Number.isInteger(value.pid) && Number.isInteger(value.port) && typeof value.host === "string" && typeof value.url === "string" && typeof value.sourceDir === "string" && (value.owner === "cli" || value.owner === "host"))
      return value;
  } catch {
  }
  return void 0;
}
async function otherPreviews() {
  let names;
  try {
    names = fs.readdirSync(registryDir()).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }
  const entries = [];
  for (const name of names) {
    const file = path.join(registryDir(), name);
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const entry = parseEntry(text);
    if (entry?.pid === process.pid) continue;
    if (!entry || !processAlive(entry.pid) || !await portOpen(entry.host, entry.port)) {
      fs.rmSync(file, { force: true });
      continue;
    }
    entries.push(entry);
  }
  return entries.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
async function stopOtherPreview(entry, timeoutMs = 1e4) {
  try {
    process.kill(entry.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") return false;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processAlive(entry.pid) || !await portOpen(entry.host, entry.port, 200)) {
      unregisterPreview(entry.port, entry.pid);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

export {
  setPreviewOwner,
  onPreviewShutdown,
  registerPreview,
  unregisterPreview,
  otherPreviews,
  stopOtherPreview
};
