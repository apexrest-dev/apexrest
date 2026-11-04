import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { managedHome } from '../config.ts';

/**
 * A small file registry of running preview servers under `APEXREST_HOME/preview/servers/`, so a
 * preview started by one process (a foreground `apexrest preview start`, an MCP host) can be listed
 * and, for CLI-owned servers, stopped from another. One JSON file per server, written after the
 * server listens and removed when it stops or its process exits; entries whose process is gone or
 * whose port no longer accepts connections are pruned when read.
 */
export type PreviewOwner = 'cli' | 'host';
export interface PreviewEntry {
  pid: number;
  port: number;
  host: string;
  url: string;
  sourceDir: string;
  owner: PreviewOwner;
  startedAt: string;
  environment?: string;
}

let owner: PreviewOwner = 'host';
const registered = new Set<string>();
let shutdown: (() => Promise<void>) | undefined;
let exitHooked = false;
let signalsHooked = false;

/**
 * The foreground CLI marks its previews as CLI-owned: such a process exists only to serve them, so
 * another process may stop it with SIGTERM. Previews in MCP hosts stay `host` and are never signalled.
 */
export function setPreviewOwner(value: PreviewOwner): void {
  owner = value;
}

export const registryDir = () => path.join(managedHome(), 'preview', 'servers');
const entryFile = (pid: number, port: number) => path.join(registryDir(), `${pid}-${port}.json`);

/** Called with a function that stops every in-process preview; a CLI owner runs it on SIGINT/SIGTERM. */
export function onPreviewShutdown(stopAll: () => Promise<void>): void {
  shutdown = stopAll;
}

function hookExit(): void {
  if (!exitHooked) {
    exitHooked = true;
    process.on('exit', () => {
      for (const file of registered) fs.rmSync(file, { force: true });
    });
  }
  if (owner !== 'cli' || signalsHooked) return;
  signalsHooked = true;
  let stopping = false;
  const stop = (code: number) => {
    // A second Ctrl+C exits at once.
    if (stopping) process.exit(code);
    stopping = true;
    const timer = setTimeout(() => process.exit(code), 5000);
    timer.unref();
    void (shutdown?.() ?? Promise.resolve()).catch(() => undefined).finally(() => process.exit(code));
  };
  process.on('SIGINT', () => stop(130));
  process.on('SIGTERM', () => stop(143));
}

export function registerPreview(entry: Omit<PreviewEntry, 'pid' | 'owner' | 'startedAt'>): PreviewEntry {
  const full: PreviewEntry = { pid: process.pid, owner, startedAt: new Date().toISOString(), ...entry };
  const file = entryFile(full.pid, full.port);
  try {
    fs.mkdirSync(registryDir(), { recursive: true, mode: 0o700 });
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(full, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(temporary, file);
    registered.add(file);
  } catch {
    // Discovery is a convenience; an unwritable home never blocks the preview itself.
  }
  hookExit();
  return full;
}

export function unregisterPreview(port: number, pid = process.pid): void {
  const file = entryFile(pid, port);
  fs.rmSync(file, { force: true });
  registered.delete(file);
}

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function portOpen(host: string, port: number, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

function parseEntry(text: string): PreviewEntry | undefined {
  try {
    const value = JSON.parse(text) as Partial<PreviewEntry>;
    if (
      Number.isInteger(value.pid) &&
      Number.isInteger(value.port) &&
      typeof value.host === 'string' &&
      typeof value.url === 'string' &&
      typeof value.sourceDir === 'string' &&
      (value.owner === 'cli' || value.owner === 'host')
    )
      return value as PreviewEntry;
  } catch {
    // Unreadable entries are pruned below.
  }
  return undefined;
}

/** Live entries of other processes; stale or malformed files are removed. */
export async function otherPreviews(): Promise<PreviewEntry[]> {
  let names: string[];
  try {
    names = fs.readdirSync(registryDir()).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  const entries: PreviewEntry[] = [];
  for (const name of names) {
    const file = path.join(registryDir(), name);
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const entry = parseEntry(text);
    if (entry?.pid === process.pid) continue;
    // A dead process, or a live one whose port is closed (a reused PID), is stale.
    if (!entry || !processAlive(entry.pid) || !(await portOpen(entry.host, entry.port))) {
      fs.rmSync(file, { force: true });
      continue;
    }
    entries.push(entry);
  }
  return entries.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** Signals a CLI-owned preview process and waits until its port closes. */
export async function stopOtherPreview(entry: PreviewEntry, timeoutMs = 10000): Promise<boolean> {
  try {
    process.kill(entry.pid, 'SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return false;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processAlive(entry.pid) || !(await portOpen(entry.host, entry.port, 200))) {
      unregisterPreview(entry.port, entry.pid);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}
