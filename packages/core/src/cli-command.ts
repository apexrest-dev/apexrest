import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { batchCommand, locateCommand, type CommandHost } from '../../installer/src/command.ts';
import { Fault } from './result.ts';

/** How to start an external CLI: the process, its arguments and cmd.exe verbatim quoting. */
export interface CliCommand {
  executable: string;
  args: string[];
  windowsVerbatimArguments?: boolean;
}

export interface CliHost extends CommandHost {
  /** Node executable for npm script shims; defaults to the running Node. */
  execPath?: string;
}

/** What an npm cmd-shim launches: a Node script (with fixed Node flags) or a native program. */
export interface NpmShim {
  target: string;
  node: boolean;
  nodeArgs: string[];
}

const SHIM_LIMIT = 64 * 1024;
const NODE_FLAG = /^--?[A-Za-z0-9][\w-]*(?:=[\w./:-]*)?$/u;

/**
 * Parses the command line npm's cmd-shim writes (`"%dp0%\<target>" %*` at the end of its last
 * line). A Node script shim runs `"%_prog%" [flags] "%dp0%\<script>" %*` with `_prog` set to
 * node or `%dp0%\node.exe`; a native shim runs `"%dp0%\<program>" %*`. Anything else is not
 * recognised and returns undefined.
 */
export function npmShimTarget(text: string): NpmShim | undefined {
  const line = text
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.includes('%*'))
    .at(-1);
  if (!line) return undefined;
  const target = /"%dp0%\\([^"%]+)"\s+%\*$/iu.exec(line)?.[1];
  // Relative to the shim; `..\` is how project-local node_modules\.bin shims reach their package.
  if (!target) return undefined;
  const prog = line.lastIndexOf('"%_prog%"');
  if (prog >= 0) {
    if (!/SET "_prog=(?:%dp0%\\)?node(?:\.exe)?"/iu.test(text)) return undefined;
    const flags = line
      .slice(prog + '"%_prog%"'.length, line.lastIndexOf('"%dp0%\\'))
      .trim()
      .split(/\s+/u)
      .filter(Boolean);
    if (!flags.every((flag) => NODE_FLAG.test(flag))) return undefined;
    return { target, node: true, nodeArgs: flags };
  }
  if (!line.startsWith('"%dp0%\\') || !/\.(?:exe|com)$/iu.test(target)) return undefined;
  return { target, node: false, nodeArgs: [] };
}

async function isFile(file: string) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolves an external CLI so it starts without a shell on every platform. On Windows the name
 * is looked up on absolute PATH entries with PATHEXT (never in the current directory, which may
 * be an untrusted checkout). An npm .cmd shim is read and its Node script or native program is
 * started directly, so arguments such as inline JSON never pass through cmd.exe. Other batch
 * files fall back to cmd.exe with strict quoting, which refuses metacharacters.
 */
export async function resolveCliCommand(
  command: string,
  args: string[],
  host: CliHost = {},
): Promise<CliCommand> {
  const platform = host.platform ?? process.platform,
    env = host.env ?? process.env;
  if (platform !== 'win32') return { executable: command, args };
  const located = await locateCommand(command, { platform, env });
  if (!located)
    throw new Fault(
      'DEPENDENCY_MISSING',
      `${command} was not found on an absolute PATH entry.`,
      3,
      'dependency_missing',
    );
  const extension = path.extname(located).toLowerCase();
  if (extension === '.cmd' || extension === '.bat') {
    const content = await readFile(located);
    const shim = content.length <= SHIM_LIMIT ? npmShimTarget(content.toString('utf8')) : undefined;
    if (shim) {
      const target = path.join(path.dirname(located), ...shim.target.split(/[\\/]/u));
      if (await isFile(target))
        return shim.node
          ? { executable: host.execPath ?? process.execPath, args: [...shim.nodeArgs, target, ...args] }
          : { executable: target, args };
    }
  }
  const batch = batchCommand(located, args, env);
  return {
    executable: batch.executable,
    args: batch.args,
    ...(batch.verbatim ? { windowsVerbatimArguments: true } : {}),
  };
}
