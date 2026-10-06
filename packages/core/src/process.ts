import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { Fault, redact } from './result.ts';
export interface ProcessRequest {
  executable: string;
  args: string[];
  cwd: string;
  input?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxBytes?: number;
  signal?: AbortSignal;
}
export interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
  truncated: boolean;
}
export async function runProcess(r: ProcessRequest): Promise<ProcessResult> {
  if (r.signal?.aborted)
    return { code: null, stdout: '', stderr: '', timedOut: false, cancelled: true, truncated: false };
  return new Promise((resolve, reject) => {
    const child = spawn(r.executable, r.args, {
      cwd: r.cwd,
      env: r.env ?? process.env,
      shell: false,
      stdio: 'pipe',
      windowsHide: true,
    });
    let stdout = '',
      stderr = '',
      bytes = 0,
      timedOut = false,
      cancelled = false,
      truncated = false;
    const decoders = [new StringDecoder('utf8'), new StringDecoder('utf8')];
    const max = r.maxBytes ?? 1024 * 1024;
    const stop = () => {
      child.kill('SIGTERM');
      const hard = setTimeout(() => child.kill('SIGKILL'), 1500);
      hard.unref();
    };
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
    child.stdout.on('data', collect(false));
    child.stderr.on('data', collect(true));
    child.stdin.on('error', () => {});
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
    child.on('error', (e) => {
      clearTimeout(timer);
      r.signal?.removeEventListener('abort', abort);
      reject(new Fault('DEPENDENCY_MISSING', e.message, 3, 'dependency_missing'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      r.signal?.removeEventListener('abort', abort);
      resolve({
        code,
        stdout: stdout + (truncated ? '' : decoders[0]!.end()),
        stderr: redact(stderr + (truncated ? '' : decoders[1]!.end())),
        timedOut,
        cancelled,
        truncated,
      });
    });
    child.stdin.end(r.input ?? '');
  });
}
