import { performance } from 'node:perf_hooks';
import { executionTiming, emitSqlclTiming } from './sqlcl-timings.ts';
import { SQLCL_WRITE_TIMEOUT_MS, type ProcessRequest, type ProcessResult } from './process.ts';
import { SqlclMcpClient, mcpCallOptions, mcpFailure, mcpResult } from './sqlcl-mcp.ts';

/**
 * A restricted SQLcl server prepared for one application import.
 *
 * `apex import` in a new SQLcl process spends most of its time loading the
 * APEXlang compiler (about 8-11 s measured for a 15-page application on SQLcl
 * 26.3; the import itself takes about 1 s once the compiler is loaded). This
 * server is started when a deployment begins and loads the compiler with an
 * offline `apex validate` while the target is observed and backed up. The
 * import then runs on it as one batch and the server is closed.
 *
 * It is used for nothing else: one server, one import. It runs with the same
 * SQLcl restriction level as the import process it replaces, and `ready` proves
 * on every start that this SQLcl build enforces the restriction in server mode
 * (a HOST command must be refused). Any failure before the import batch is
 * submitted makes the caller use the ordinary import process instead.
 */
export interface WarmImportRequest extends Pick<ProcessRequest, 'executable' | 'cwd' | 'env'> {
  restrictLevel: string;
  /** Offline command that loads the compiler; its result is not used. */
  warmup: string;
}
const READY_TIMEOUT_MS = 60_000;
const PROBE = 'APEXREST_RESTRICT_PROBE';

export function warmImportDisabled() {
  return /^(?:0|false|off)$/i.test(process.env.APEXREST_WARM_IMPORT ?? '');
}

export class WarmImportServer {
  private readonly client: SqlclMcpClient;
  private readonly started = performance.now();
  private readonly ready: Promise<boolean>;
  private taken = false;
  private closed = false;
  warmMs: number | undefined;
  constructor(private readonly request: WarmImportRequest) {
    this.client = new SqlclMcpClient({
      executable: request.executable,
      args: ['-R', request.restrictLevel, '-mcp'],
      cwd: request.cwd,
      ...(request.env ? { env: request.env } : {}),
    });
    this.ready = this.prepare().catch(() => false);
  }
  private async prepare() {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    const options = mcpCallOptions({ timeoutMs: READY_TIMEOUT_MS }, deadline);
    await this.client.open(options());
    const probe = this.client.text(await this.client.execute(`host echo ${PROBE}`, options, () => false));
    // The restriction must be observed, not assumed: HOST refused and never executed.
    if (!/SP2-0738/.test(probe) || probe.split(/\r?\n/).some((line) => line.trim() === PROBE)) return false;
    await this.client.execute(this.request.warmup, options, () => false);
    this.warmMs = performance.now() - this.started;
    return this.client.alive && !this.closed;
  }
  /**
   * Run the import batch. Resolves `undefined` when the server cannot be used and
   * nothing was submitted (the caller then runs the ordinary process). After the
   * batch is submitted every failure is reported like an interrupted import process.
   */
  async run(
    request: Pick<ProcessRequest, 'input' | 'timeoutMs' | 'signal' | 'onSqlclTiming'> & {
      connectionName: string;
      completionMarker: string;
    },
  ): Promise<ProcessResult | undefined> {
    if (this.taken || this.closed) return undefined;
    this.taken = true;
    const started = performance.now();
    const timing = executionTiming('mcp', true, true);
    timing.reused = true;
    let submitted = false;
    let executeStarted: number | undefined;
    const deadline = Date.now() + (request.timeoutMs ?? SQLCL_WRITE_TIMEOUT_MS);
    const options = mcpCallOptions(request, deadline);
    try {
      if (!(await this.ready) || request.signal?.aborted) return undefined;
      timing.queueMs = performance.now() - started;
      const connectStarted = performance.now();
      let connected;
      try {
        connected = await this.client.connect(request.connectionName, options, true);
      } catch {
        return undefined;
      }
      timing.connectMs = performance.now() - connectStarted;
      if (connected.isError) return undefined;
      submitted = true;
      executeStarted = performance.now();
      const result = await this.client.execute(request.input ?? '', options, () => true);
      return mcpResult(result, this.client.text(result, true));
    } catch (error) {
      if (!submitted) return undefined;
      const interrupted = request.signal?.aborted
        ? 'cancelled'
        : Date.now() >= deadline
          ? 'timedOut'
          : undefined;
      if (interrupted)
        return {
          code: null,
          stdout: '',
          stderr: '',
          timedOut: interrupted === 'timedOut',
          cancelled: interrupted === 'cancelled',
          truncated: false,
        };
      throw mcpFailure(error, { ...this.request, args: [], mutation: true }, true);
    } finally {
      if (executeStarted !== undefined) timing.executeMs = performance.now() - executeStarted;
      await this.close();
      if (submitted) emitSqlclTiming(request.onSqlclTiming, timing, started);
    }
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.client.close();
  }
}
