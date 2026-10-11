import path from 'node:path';
import { stat } from 'node:fs/promises';
import { runProcess } from '../../core/src/process.ts';
import type { ProcessRequest, ProcessResult } from '../../core/src/process.ts';
import { Fault } from '../../core/src/result.ts';

export interface CommandHost {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
}
export interface ResolvedCommand {
  executable: string;
  args: string[];
  /** Windows only: the command line is pre-quoted for cmd.exe and must not be re-quoted. */
  verbatim: boolean;
}

// Windows never executes extensionless PATH matches; only these PATHEXT entries are eligible.
const windowsExtensions = ['.exe', '.cmd', '.bat'];
// cmd.exe expands or splits on these even inside quotes, so batch shims accept only inert text.
const cmdUnsafe = /[&|<>^%"!\x00-\x1f]/;

async function isFile(file: string) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

function windowsSuffixes(env: NodeJS.ProcessEnv) {
  const configured = (env.PATHEXT ?? env.Pathext ?? '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map((extension) => extension.trim().toLowerCase())
    .filter((extension) => windowsExtensions.includes(extension));
  return configured.length ? [...new Set(configured)] : windowsExtensions;
}

/**
 * Search absolute PATH entries only. Empty and relative entries would resolve
 * against the current directory, which may be an untrusted project checkout.
 */
export async function searchPath(name: string, host: CommandHost = {}): Promise<string | undefined> {
  const platform = host.platform ?? process.platform,
    env = host.env ?? process.env;
  const windows = platform === 'win32';
  const pathValue = (windows ? (env.Path ?? env.PATH ?? env.path) : env.PATH) ?? '';
  const suffixes = windows
    ? windowsExtensions.includes(path.extname(name).toLowerCase())
      ? ['']
      : windowsSuffixes(env)
    : [''];
  for (const directory of pathValue.split(windows ? ';' : path.delimiter)) {
    const entry = directory.trim().replace(/^"(.*)"$/, '$1');
    if (!entry || !(path.isAbsolute(entry) || path.win32.isAbsolute(entry))) continue;
    for (const suffix of suffixes) {
      const candidate = path.join(entry, name + suffix);
      if (await isFile(candidate)) return candidate;
    }
  }
  return undefined;
}

function cmdQuote(value: string) {
  if (cmdUnsafe.test(value))
    throw new Fault(
      'UNSAFE_COMMAND_ARGUMENT',
      'A Windows batch command path or argument contains cmd.exe metacharacters. Nothing was run.',
      2,
      'blocked',
    );
  // Trailing backslashes would escape the closing quote for the program's argument parser.
  return '"' + value.replace(/(\\+)$/, '$1$1') + '"';
}

/**
 * Resolve a command the way a Windows user would expect (PATH + PATHEXT), and
 * run .cmd/.bat shims through cmd.exe with strict quoting of fixed arguments.
 */
export async function resolveCommand(
  command: string,
  args: string[],
  host: CommandHost = {},
): Promise<ResolvedCommand> {
  const platform = host.platform ?? process.platform,
    env = host.env ?? process.env;
  if (platform !== 'win32') return { executable: command, args, verbatim: false };
  let resolved: string | undefined;
  if (/[\\/]/.test(command) || path.win32.isAbsolute(command)) {
    const extension = path.extname(command).toLowerCase();
    for (const suffix of windowsExtensions.includes(extension) ? [''] : windowsSuffixes(env))
      if (await isFile(command + suffix)) {
        resolved = command + suffix;
        break;
      }
  } else resolved = await searchPath(command, { platform, env });
  if (!resolved) return { executable: command, args, verbatim: false };
  if (!['.cmd', '.bat'].includes(path.extname(resolved).toLowerCase()))
    return { executable: resolved, args, verbatim: false };
  const line = [resolved, ...args].map(cmdQuote).join(' ');
  return {
    executable: env.ComSpec ?? env.COMSPEC ?? 'cmd.exe',
    args: ['/d', '/s', '/c', '"' + line + '"'],
    verbatim: true,
  };
}

/** runProcess semantics, plus verbatim command lines for resolved Windows batch shims. */
export async function runCommand(request: ProcessRequest, host: CommandHost = {}): Promise<ProcessResult> {
  const command = await resolveCommand(request.executable, request.args, {
    ...host,
    ...(request.env ? { env: { ...(host.env ?? {}), ...request.env } } : {}),
  });
  return runProcess({
    ...request,
    ...command,
    ...(command.verbatim ? { windowsVerbatimArguments: true } : {}),
  });
}
