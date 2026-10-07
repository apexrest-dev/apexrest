import { readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const repositoryPlugin = 'plugins/apexrest-apex';
export const generatedPluginEntries = [
  'runtime',
  'resources',
  '.codex-plugin',
  '.claude-plugin',
  '.mcp.json',
  'LICENSE',
  'NOTICE',
  'bundle-manifest.json',
];
export function isGeneratedPluginFile(file) {
  return generatedPluginEntries.some(
    (entry) => file === `${repositoryPlugin}/${entry}` || file.startsWith(`${repositoryPlugin}/${entry}/`),
  );
}
export async function files(root, prefix = '') {
  const found = [];
  for (const entry of (await readdir(path.join(root, prefix), { withFileTypes: true })).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    if (
      entry.name === 'node_modules' ||
      ['.DS_Store', '.git', '.cache', '.apexrest', '.idea', '.vscode', 'coverage', 'test-results'].includes(
        entry.name,
      ) ||
      /\.(?:log|tgz|wallet)$/.test(entry.name) ||
      entry.name === '.env' ||
      (entry.name.startsWith('.env.') && entry.name !== '.env.example')
    )
      continue;
    const file = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in release source: ${file}`);
    if (entry.isDirectory()) found.push(...(await files(root, file)));
    else if (entry.isFile()) found.push(file);
    else throw new Error(`Special file: ${file}`);
  }
  return found;
}
// Runtime/source freshness excludes evidence and generated status to avoid self-referential hashes.
export async function sourceDigest() {
  const inventory = {};
  for (const root of [
    'packages',
    'scripts',
    'plugins',
    'resources',
    'schemas',
    'templates',
    'toolchains',
    'site',
  ]) {
    for (const file of await files(root)) {
      const name = root + '/' + file;
      if (!isGeneratedPluginFile(name)) inventory[name] = sha256(await readFile(path.join(root, file)));
    }
  }
  for (const file of [
    'package.json',
    'package-lock.json',
    'publisher.config.json',
    'tsconfig.base.json',
    'LICENSE',
    'NOTICE',
  ])
    inventory[file] = sha256(await readFile(file));
  return sha256(JSON.stringify(Object.fromEntries(Object.entries(inventory).sort())));
}
export async function zipTree(root, zipSync) {
  const entries = {};
  for (const file of await files(root)) {
    const mode = (await lstat(path.join(root, file))).mode;
    entries[file] = [
      new Uint8Array(await readFile(path.join(root, file))),
      {
        mtime: new Date('1980-01-01T00:00:00Z'),
        os: 3,
        attrs: ((0o100000 | (mode & 0o111 ? 0o755 : 0o644)) << 16) >>> 0,
      },
    ];
  }
  return zipSync(entries, { level: 9 });
}
