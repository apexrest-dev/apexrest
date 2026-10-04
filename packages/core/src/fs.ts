import { mkdir, open, readFile, readdir, realpath, rename, lstat, rm, link } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { hostname } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { Fault } from './result.ts';
export const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
export async function hashFile(file: string) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export async function atomicWrite(file: string, value: string | Buffer | AsyncIterable<Uint8Array>) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = file + '.' + randomUUID() + '.tmp';
  const handle = await open(temporary, 'wx', 0o600);
  try {
    try {
      if (typeof value === 'string' || Buffer.isBuffer(value)) await handle.writeFile(value);
      else for await (const chunk of value) await handle.writeFile(chunk);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  await syncDirectory(path.dirname(file));
}
/** Persist a renamed or linked directory entry. Windows cannot fsync directories; that is best effort. */
export async function syncDirectory(directory: string) {
  let handle;
  try {
    handle = await open(directory, 'r');
    await handle.sync();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (
      process.platform === 'win32' ||
      ['EPERM', 'EISDIR', 'EINVAL', 'ENOTSUP', 'EBADF'].includes(code ?? '')
    )
      return;
    throw error;
  } finally {
    await handle?.close();
  }
}
export const writeJson = (file: string, value: unknown) =>
  atomicWrite(file, JSON.stringify(value, null, 2) + '\n');
export async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}
export async function exists(file: string) {
  try {
    await lstat(file);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw e;
  }
}
export async function contained(root: string, candidate: string): Promise<string> {
  return containedPath(root, candidate, false);
}
/** Like contained(), but the candidate must be a strict descendant: the root itself is rejected. */
export async function containedChild(root: string, candidate: string): Promise<string> {
  return containedPath(root, candidate, true);
}
async function containedPath(root: string, candidate: string, child: boolean): Promise<string> {
  const base = await realpath(root),
    target = path.resolve(base, candidate);
  const rel = path.relative(base, target);
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel))
    throw new Fault('PATH_ESCAPE', 'Path escapes the permitted root.', 2);
  if (child && rel === '')
    throw new Fault('PATH_ESCAPE', 'Path must be inside, not equal to, the permitted root.', 2);
  let probe = target;
  while (!(await exists(probe))) probe = path.dirname(probe);
  const physical = await realpath(probe),
    physicalRel = path.relative(base, physical);
  if (physicalRel === '..' || physicalRel.startsWith('..' + path.sep) || path.isAbsolute(physicalRel))
    throw new Fault('SYMLINK_ESCAPE', 'Symlink escapes the permitted root.', 2);
  if (child && probe === target && physicalRel === '')
    throw new Fault('PATH_ESCAPE', 'Path must be inside, not equal to, the permitted root.', 2);
  return target;
}
export async function inventory(root: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink())
        throw new Fault('SYMLINK_NOT_ALLOWED', 'Source and bundle inventories reject symlinks.', 2);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile())
        out[path.relative(root, file).split(path.sep).join('/')] = hash(await readFile(file));
      else throw new Fault('SPECIAL_FILE_NOT_ALLOWED', 'Source inventories accept regular files only.', 2);
    }
  }
  await walk(root);
  return Object.fromEntries(Object.entries(out).sort());
}
/** Locks without complete owner records are never silently reclaimed. */
export const LOCK_CORRUPT_AFTER_MS = 30000;
async function createLock(file: string, owner: string) {
  // Publish a fully written owner record with link(): other runners see either
  // no lock or a complete one, never an empty file from an interrupted write.
  const temporary = file + '.' + randomUUID() + '.owner';
  const handle = await open(temporary, 'wx', 0o600);
  try {
    try {
      await handle.writeFile(owner);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await link(temporary, file);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EEXIST') throw error;
      if (!['EPERM', 'ENOTSUP', 'ENOSYS', 'EXDEV', 'EOPNOTSUPP'].includes(code ?? '')) throw error;
    }
    // File systems without hard links keep exclusive creation.
    const fallback = await open(file, 'wx', 0o600);
    try {
      await fallback.writeFile(owner);
      await fallback.sync();
    } finally {
      await fallback.close();
    }
  } finally {
    await rm(temporary, { force: true });
  }
}
export async function withLock<T>(file: string, action: () => Promise<T>): Promise<T> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const recovery = file + '.recovery';
  if (await exists(recovery))
    throw new Fault(
      'LOCKED',
      'Lock recovery is in progress; inspect a stale recovery gate before retry.',
      5,
      'conflict',
    );
  if (await exists(file)) {
    let owner: { pid: number; hostname?: string } | undefined;
    try {
      owner = (await readJson(file)) as typeof owner;
    } catch {
      /* Incomplete ownership stays blocked. */
    }
    if (!owner || typeof owner !== 'object' || !Number.isInteger(owner.pid)) {
      let age = 0;
      try {
        age = Date.now() - (await lstat(file)).mtimeMs;
      } catch {
        /* Released concurrently; exclusive creation below decides. */
      }
      if (age > LOCK_CORRUPT_AFTER_MS)
        throw new Fault(
          'LOCK_CORRUPT',
          `Lock file ${file} has no readable owner (an interrupted earlier process left it). Confirm no apexrest operation is running on any host, then delete that file and retry.`,
          5,
          'conflict',
        );
    }
    if (owner && owner.hostname === hostname() && Number.isInteger(owner.pid) && owner.pid > 0) {
      let dead = false;
      try {
        process.kill(owner.pid, 0);
      } catch (error) {
        dead = (error as NodeJS.ErrnoException).code === 'ESRCH';
      }
      if (dead) {
        try {
          await mkdir(recovery, { mode: 0o700 });
        } catch {
          throw new Fault('LOCKED', 'Another runner owns lock recovery.', 5, 'conflict');
        }
        try {
          const current = (await readJson(file)) as { pid: number; hostname: string };
          if (current.pid === owner.pid && current.hostname === owner.hostname) await rm(file);
        } finally {
          await rm(recovery, { recursive: true, force: true });
        }
      }
    }
  }
  try {
    await createLock(
      file,
      JSON.stringify({ pid: process.pid, hostname: hostname(), createdAt: new Date().toISOString() }),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Fault(
        'LOCKED',
        'Another operation holds the lock. Inspect its owner before recovery.',
        5,
        'conflict',
      );
    throw e;
  }
  try {
    return await action();
  } finally {
    await rm(file, { force: true });
  }
}
