import path from 'node:path';
import { constants, open, realpath } from 'node:fs/promises';
import { runProcess } from './process.ts';
import { Fault } from './result.ts';

/** Parse dotenv as literal data. Never execute shell substitutions or expand variables. */
export function parseLocalEnv(contents: string): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line.trim());
    if (!match || Object.hasOwn(result, match[1]!))
      throw new Fault('ENV_FILE_INVALID', 'The local ENV file has an invalid or duplicate entry.', 2);
    let value = match[2]!;
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0]!,
        end = value.lastIndexOf(quote);
      if (end === 0 || !/^\s*(?:#.*)?$/.test(value.slice(end + 1)))
        throw new Fault('ENV_FILE_INVALID', 'The local ENV file has an invalid quoted entry.', 2);
      value = value.slice(1, end);
    } else value = value.replace(/\s+#.*$/, '').trimEnd();
    result[match[1]!] = value;
  }
  return result;
}

/** Only an ignored, untracked regular local file may supply credentials. */
export async function readLocalEnv(file: string) {
  const requested = path.resolve(file),
    physical = await realpath(requested);
  if (requested !== physical)
    throw new Fault('ENV_FILE_UNSAFE', 'Credential ENV paths cannot use symlink aliases.', 2);
  const cwd = path.dirname(physical);
  const root = await runProcess({
    executable: 'git',
    args: ['rev-parse', '--show-toplevel'],
    cwd,
    timeoutMs: 5000,
  });
  if (root.code !== 0)
    throw new Fault('ENV_FILE_UNSAFE', 'Credential ENV files must belong to a Git working tree.', 2);
  const relative = path.relative(root.stdout.trim(), physical);
  const tracked = await runProcess({
    executable: 'git',
    args: ['ls-files', '--error-unmatch', '--', relative],
    cwd: root.stdout.trim(),
    timeoutMs: 5000,
  });
  const ignored = await runProcess({
    executable: 'git',
    args: ['check-ignore', '-q', '--', relative],
    cwd: root.stdout.trim(),
    timeoutMs: 5000,
  });
  if (tracked.code === 0 || ignored.code !== 0)
    throw new Fault(
      'ENV_FILE_UNSAFE',
      'Credential ENV files must be ignored by Git and absent from tracked files.',
      2,
    );
  const handle = await open(physical, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (
      !info.isFile() ||
      info.size > 65536 ||
      (typeof process.getuid === 'function' && info.uid !== process.getuid())
    )
      throw new Fault(
        'ENV_FILE_UNSAFE',
        'Credential ENV files must be bounded regular files owned by the current user.',
        2,
      );
    return parseLocalEnv(await handle.readFile('utf8'));
  } finally {
    await handle.close();
  }
}
