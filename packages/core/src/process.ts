import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { executionTiming, emitSqlclTiming, type SqlclExecutionTiming } from './sqlcl-timings.ts';
import { StringDecoder } from 'node:string_decoder';
import { Fault, redact } from './result.ts';
export interface ProcessRequest {
  onSqlclTiming?: (timing: SqlclExecutionTiming) => void;
  sqlclConnected?: boolean;
  mutation?: boolean;
  executable: string;
  args: string[];
  cwd: string;
  input?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxBytes?: number;
  signal?: AbortSignal;
  /** Pass the command line through unquoted (resolved Windows batch shims only). */
  windowsVerbatimArguments?: boolean;
}
export interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
  truncated: boolean;
}
/** After the main process exits, wait at most this long for orphaned pipe holders before resolving. */
const DRAIN_AFTER_EXIT_MS = 3000;
const groupKills = process.platform !== 'win32';
/**
 * Spawn a child as the leader of its own process group so that stopping it also
 * stops every descendant. Oracle's `sql` launcher starts the JVM as an ordinary
 * child without `exec`, so a plain kill would leave the JVM running (and holding
 * the stdio pipes open) after a timeout or cancellation.
 */
export function spawnTree(executable: string, args: string[], options: SpawnOptions) {
  return spawn(executable, args, { ...options, ...(groupKills ? { detached: true } : {}) });
}
/** Terminate a spawned tree: the process group on POSIX, `taskkill /T` on Windows. */
export function killTree(child: ChildProcess, signal: 'SIGTERM' | 'SIGKILL') {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  if (!groupKills) {
    try {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
        .on('error', () => child.kill())
        .unref();
    } catch {
      child.kill();
    }
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      /* Already gone. */
    }
  }
}
/** Send SIGTERM to the tree, then SIGKILL if it is still alive shortly after. */
export function stopTree(child: ChildProcess) {
  killTree(child, 'SIGTERM');
  const hard = setTimeout(() => killTree(child, 'SIGKILL'), 1500);
  hard.unref();
}
export async function runProcess(r: ProcessRequest): Promise<ProcessResult> {
  if (r.signal?.aborted)
    return { code: null, stdout: '', stderr: '', timedOut: false, cancelled: true, truncated: false };
  const started = performance.now();
  const timing = executionTiming('cli', r.mutation, r.sqlclConnected);
  return new Promise((resolve, reject) => {
    const child = spawnTree(r.executable, r.args, {
      cwd: r.cwd,
      env: r.env ?? process.env,
      shell: false,
      stdio: 'pipe',
      windowsHide: true,
      ...(r.windowsVerbatimArguments ? { windowsVerbatimArguments: true } : {}),
    });
    child.once('spawn', () => {
      timing.spawnMs = performance.now() - started;
    });
    let stdout = '',
      stderr = '',
      bytes = 0,
      timedOut = false,
      cancelled = false,
      truncated = false,
      settled = false;
    const decoders = [new StringDecoder('utf8'), new StringDecoder('utf8')];
    const max = r.maxBytes ?? 1024 * 1024;
    const stop = () => stopTree(child);
    const collect = (isError: boolean) => (data: Buffer) => {
      const room = Math.max(0, max - bytes);
      bytes += data.length;
      const s = decoders[isError ? 1 : 0]!.write(data.subarray(0, room));
      if (isError) stderr += s;
      else stdout += s;
      if (bytes > max) {
        truncated = true;
        stop();
      }
    };
    child.stdout!.on('data', collect(false));
    child.stderr!.on('data', collect(true));
    child.stdin!.on('error', () => {});
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, r.timeoutMs ?? 30000);
    const abort = () => {
      cancelled = true;
      stop();
    };
    r.signal?.addEventListener('abort', abort, { once: true });
    if (r.signal?.aborted) abort();
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      r.signal?.removeEventListener('abort', abort);
      // stdout is returned verbatim: callers parse JSON rows from it and a textual
      // redaction would corrupt them. Secret scrubbing is the adapter's job
      // (oracle.ts) and the result envelope redacts messages again.
      timing.executeMs = performance.now() - started - (timing.spawnMs ?? 0);
      emitSqlclTiming(r.onSqlclTiming, timing, started);
      resolve({
        code,
        stdout: stdout + (truncated ? '' : decoders[0]!.end()),
        stderr: redact(stderr + (truncated ? '' : decoders[1]!.end())),
        timedOut,
        cancelled,
        truncated,
      });
    };
    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      r.signal?.removeEventListener('abort', abort);
      emitSqlclTiming(r.onSqlclTiming, timing, started);
      reject(new Fault('DEPENDENCY_MISSING', e.message, 3, 'dependency_missing'));
    });
    child.on('close', (code) => finish(code));
    // A descendant that survived the tree kill may still hold the pipes; do not wait for it forever.
    child.on('exit', (code) => {
      const drain = setTimeout(() => {
        child.stdout?.destroy();
        child.stderr?.destroy();
        finish(code);
      }, DRAIN_AFTER_EXIT_MS);
      drain.unref();
    });
    child.stdin!.end(r.input ?? '');
  });
}
