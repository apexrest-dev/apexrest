import path from 'node:path';
import { mkdir, mkdtemp, lstat, rm, symlink, link } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar';
import yauzl from 'yauzl';
import type { Entry } from 'yauzl';
import { contained } from '../../core/src/fs.ts';
import { Fault } from '../../core/src/result.ts';
const maxExpanded = 2 * 1024 * 1024 * 1024,
  maxEntries = 50000;
export function archivePath(name: string) {
  if (
    !name ||
    name.includes('\\') ||
    /^[A-Za-z]:/.test(name) ||
    name.startsWith('/') ||
    name.split('/').includes('..') ||
    /[\x00-\x1f]/.test(name)
  )
    throw new Fault('UNSAFE_ARCHIVE', 'Archive entry escapes its extraction root.', 2);
  const clean = name.replace(/^\.\//, '');
  // A single trailing slash marks a directory. Any other empty or "." segment
  // creates aliases ("a//b", "a/./b") that defeat the duplicate-path check.
  const segments = clean.replace(/\/$/, '').split('/');
  if (clean && segments.some((segment) => segment === '' || segment === '.'))
    throw new Fault('UNSAFE_ARCHIVE', 'Archive entry has an empty or "." path segment.', 2);
  return clean;
}
/** Canonical identity of an entry for duplicate detection: no "./" prefix or trailing slash. */
function entryKey(clean: string) {
  return path.posix.normalize(clean).replace(/\/$/, '');
}
export async function extractArchive(
  file: string,
  target: string,
  type: 'zip' | 'tar.gz',
  allowLinks = false,
) {
  await mkdir(target, { recursive: true, mode: 0o700 });
  let total = 0,
    count = 0;
  const seen = new Set<string>();
  const check = (name: string, size: number) => {
    const clean = archivePath(name);
    total += size;
    count++;
    if (total > maxExpanded || count > maxEntries || size > 512 * 1024 * 1024)
      throw new Fault('ARCHIVE_LIMIT', 'Archive exceeds the expanded size or entry limit.', 2);
    if (!clean) return clean; // The "./" root directory entry itself.
    const key = entryKey(clean);
    if (seen.has(key)) throw new Fault('DUPLICATE_ARCHIVE_ENTRY', 'Archive contains duplicate paths.', 2);
    seen.add(key);
    return clean;
  };
  if (type === 'tar.gz') {
    const links: { name: string; target: string; hard: boolean }[] = [];
    const files: string[] = [];
    let invalid: unknown;
    await tar.t({
      file,
      strict: true,
      onReadEntry: (entry) => {
        if (invalid) return;
        try {
          const name = check(entry.path, entry.size);
          if (entry.type === 'SymbolicLink' || entry.type === 'Link') {
            if (!allowLinks)
              throw new Fault('UNSAFE_ARCHIVE', 'Links are not allowed in native packages.', 2);
            if (!entry.linkpath) throw new Fault('UNSAFE_ARCHIVE', 'Link has no target.', 2);
            const linkTarget =
              entry.type === 'Link'
                ? entry.linkpath
                : path.posix.join(path.posix.dirname(name), entry.linkpath);
            if (path.isAbsolute(entry.linkpath))
              throw new Fault('UNSAFE_ARCHIVE', 'Absolute link target.', 2);
            links.push({
              name: entryKey(name),
              target: entryKey(archivePath(path.posix.normalize(linkTarget))),
              hard: entry.type === 'Link',
            });
          } else if (
            !['File', 'Directory', 'OldFile', 'ExtendedHeader', 'GlobalExtendedHeader'].includes(entry.type)
          )
            throw new Fault('UNSAFE_ARCHIVE', 'Unsupported archive entry type.', 2);
          else if (entry.type === 'File' || entry.type === 'OldFile') files.push(entryKey(name));
        } catch (error) {
          invalid = error;
        }
      },
    });
    if (invalid) throw invalid;
    // A link must never stand where the archive also writes files beneath it.
    for (const entry of links)
      if (files.some((name) => name.startsWith(entry.name + '/')))
        throw new Fault('UNSAFE_ARCHIVE', 'An archive link shadows a directory that contains files.', 2);
    await tar.x({
      file,
      cwd: target,
      strict: true,
      preservePaths: false,
      noChmod: false,
      filter: (_name, entry) => 'type' in entry && ['File', 'Directory', 'OldFile'].includes(entry.type),
    });
    // Links may target other links; create them in dependency order and stop
    // when a pass makes no progress (a missing target or a cycle).
    let pending = links;
    while (pending.length) {
      const remaining: typeof links = [];
      for (const entry of pending) {
        const destination = await contained(target, entry.name),
          source = await contained(target, entry.target);
        try {
          await lstat(source);
        } catch {
          remaining.push(entry);
          continue;
        }
        await mkdir(path.dirname(destination), { recursive: true });
        if (entry.hard) await link(source, destination);
        else await symlink(path.relative(path.dirname(destination), source), destination);
      }
      if (remaining.length === pending.length)
        throw new Fault('UNSAFE_ARCHIVE', 'Archive link target is missing or cyclic.', 2);
      pending = remaining;
    }
    return;
  }
  await new Promise<void>((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) {
        reject(error);
        return;
      }
      const fail = (e: unknown) => {
        zip.close();
        reject(e);
      };
      zip.on('error', fail);
      zip.on('end', resolve);
      zip.on('entry', (entry: Entry) => {
        void (async () => {
          const name = check(entry.fileName, entry.uncompressedSize);
          const mode = entry.externalFileAttributes >>> 16;
          if ((mode & 0o170000) === 0o120000 || entry.generalPurposeBitFlag & 1)
            throw new Fault('UNSAFE_ARCHIVE', 'Encrypted entries and symlinks are not accepted.', 2);
          const destination = await contained(target, name || '.');
          if (!name || name.endsWith('/')) await mkdir(destination, { recursive: true, mode: 0o700 });
          else {
            await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
            const stream = await new Promise<NodeJS.ReadableStream>((res, rej) =>
              zip.openReadStream(entry, (e, s) => (e || !s ? rej(e) : res(s))),
            );
            await pipeline(
              stream,
              createWriteStream(destination, { flags: 'wx', mode: mode & 0o111 ? 0o700 : 0o600 }),
            );
          }
          zip.readEntry();
        })().catch(fail);
      });
      zip.readEntry();
    });
  });
}

/**
 * Copy a cached archive into a private directory while hashing it, then
 * validate and extract only that private copy. A writer that can replace the
 * cache file between the checksum, the listing pass and the extraction pass
 * cannot change what is extracted.
 */
export async function extractVerifiedArchive(
  file: string,
  sha256: string,
  target: string,
  type: 'zip' | 'tar.gz',
  allowLinks = false,
  privateRoot = path.dirname(target),
) {
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(path.join(privateRoot, '.archive-'));
  try {
    const copy = path.join(directory, 'archive');
    const digest = createHash('sha256');
    await pipeline(
      createReadStream(file),
      async function* (source: AsyncIterable<Buffer>) {
        for await (const chunk of source) {
          digest.update(chunk);
          yield chunk;
        }
      },
      createWriteStream(copy, { flags: 'wx', mode: 0o600 }),
    );
    if (digest.digest('hex') !== sha256)
      throw new Fault(
        'INTEGRITY_FAILURE',
        'Archive SHA-256 changed after verification. Nothing was extracted.',
        3,
        'blocked',
      );
    await extractArchive(copy, target, type, allowLinks);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
