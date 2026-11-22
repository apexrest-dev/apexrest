import { performance } from 'node:perf_hooks';
import { executionTiming, emitSqlclTiming } from './sqlcl-timings.ts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { CallToolResult, JSONRPCMessage, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import {
  spawnTree,
  SQLCL_READ_TIMEOUT_MS,
  stopTree,
  type ProcessRequest,
  type ProcessResult,
} from './process.ts';
import { Fault, redact } from './result.ts';

export interface SqlclMcpRequest extends ProcessRequest {
  connectionName?: string;
  mutation: boolean;
}
export interface CallOptions {
  timeout: number;
  signal?: AbortSignal;
}

// Stdio JSON-RPC over a child the adapter owns: pooled servers are unref'd
// while idle so a one-shot CLI exits naturally, and the pid is known for
// exit-time cleanup. Startup logs on stderr are drained, never retained.
export class SqlclStdioTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  private child: ChildProcess | undefined;
  private buffer = new ReadBuffer();
  private exited = false;
  private overflowed = false;
  constructor(private request: Pick<ProcessRequest, 'executable' | 'args' | 'cwd' | 'env'>) {}
  get pid() {
    return this.exited ? undefined : this.child?.pid;
  }
  get alive() {
    return !!this.child && !this.exited && !this.overflowed;
  }
  get outputLimitExceeded() {
    return this.overflowed;
  }
  async start() {
    if (this.child) throw new Error('SQLcl transport already started.');
    const child = spawnTree(this.request.executable, this.request.args, {
      cwd: this.request.cwd,
      env: this.request.env ?? process.env,
      shell: false,
      stdio: 'pipe',
      windowsHide: true,
    });
    this.child = child;
    child.stdin!.on('error', () => {});
    child.stderr!.on('data', () => {});
    child.stdout!.on('data', (chunk: Buffer) => {
      if (this.exited || this.overflowed) return;
      try {
        this.buffer.append(chunk);
      } catch {
        // The SDK bounds incomplete frames. Stop this session so pending RPCs
        // settle through the usual close path and no later frame is trusted.
        this.overflowed = true;
        this.kill();
        return;
      }
      for (;;) {
        let message: JSONRPCMessage | null;
        try {
          message = this.buffer.readMessage();
        } catch (error) {
          this.onerror?.(error as Error);
          continue;
        }
        if (!message) break;
        this.onmessage?.(message);
      }
    });
    child.on('error', (error) => {
      this.exited = true;
      this.onerror?.(error);
      this.onclose?.();
    });
    child.on('close', () => {
      this.exited = true;
      this.onclose?.();
    });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
  }
  async send(message: JSONRPCMessage) {
    if (!this.alive) throw new Error('SQLcl transport is closed.');
    await new Promise<void>((resolve, reject) =>
      this.child!.stdin!.write(serializeMessage(message), (error) => (error ? reject(error) : resolve())),
    );
  }
  async close() {
    this.kill();
  }
  kill() {
    const child = this.child;
    if (!child || this.exited) return;
    child.stdin?.end();
    // The launcher's JVM child must stop with it; see spawnTree.
    stopTree(child);
  }
  setActive(active: boolean) {
    const child = this.child;
    if (!child || this.exited) return;
    // Pipes are net.Socket instances; unref'd they do not keep the loop alive.
    const handles = [child, child.stdin, child.stdout, child.stderr] as ({
      ref(): unknown;
      unref(): unknown;
    } | null)[];
    for (const handle of handles)
      if (handle && typeof handle.ref === 'function' && typeof handle.unref === 'function') {
        if (active) handle.ref();
        else handle.unref();
      }
  }
}

function outputLimit(uncertain: boolean) {
  return new Fault(
    'OUTPUT_LIMIT',
    'SQLcl MCP output exceeded the session limit.',
    6,
    uncertain ? 'outcome_unknown' : 'failed',
  );
}

// One official SQLcl MCP server. Commands and polling honour the caller's
// deadline/cancellation; output is bounded by the request's maxBytes.
export class SqlclMcpClient {
  readonly transport: SqlclStdioTransport;
  private client = new Client({ name: 'apexrest-sqlcl', version: '1.0.0' });
  private tools: { run: Tool; executionType: boolean; status: boolean; connect: boolean } | undefined;
  constructor(private request: Pick<ProcessRequest, 'executable' | 'args' | 'cwd' | 'env' | 'maxBytes'>) {
    this.transport = new SqlclStdioTransport({
      executable: request.executable,
      args: request.args,
      cwd: request.cwd,
      env: Object.fromEntries(
        Object.entries(request.env ?? process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
    });
  }
  get alive() {
    return this.transport.alive;
  }
  async open(options: CallOptions) {
    await this.client.connect(this.transport, options);
    const tools = (await this.client.listTools({}, options)).tools;
    const run = tools.find((tool) => ['sqlcl_run', 'run-sqlcl', 'run_sqlcl'].includes(tool.name));
    if (!run || !run.inputSchema.properties?.sqlcl)
      throw new Fault(
        'UNSUPPORTED_CAPABILITY',
        'SQLcl MCP does not advertise a supported SQLcl command tool.',
        3,
        'blocked',
      );
    this.tools = {
      run,
      executionType: !!run.inputSchema.properties?.execution_type,
      status: tools.some((tool) => tool.name === 'request_status'),
      connect: tools.some((tool) => tool.name === 'connect' && tool.inputSchema.properties?.connection_name),
    };
  }
  text(result: CallToolResult, uncertain = false) {
    const output = result.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    if (Buffer.byteLength(output) > (this.request.maxBytes ?? 1024 * 1024)) throw outputLimit(uncertain);
    return output;
  }
  private async call(
    name: string,
    args: Record<string, unknown>,
    options: () => CallOptions,
    uncertain = false,
  ) {
    const result = (await this.client.callTool(
      { name, arguments: args },
      undefined,
      options(),
    )) as CallToolResult;
    this.text(result, uncertain);
    return result;
  }
  async connect(connectionName: string, options: () => CallOptions, command = false) {
    if (command) {
      // SQLcl 26.3's MCP connect tool forces JDBC auto-commit on when a saved
      // connection omits that property. Its own CONNECT command retains normal
      // SQLcl transaction semantics. Use this only for CLI-owned servers; native
      // MCP restriction policy still uses the advertised connect tool below.
      if (!connectionName || /[\x00-\x1f\x7f"&\\]/.test(connectionName))
        throw new Fault('INVALID_SQLCL_TOKEN', 'Saved connection name is unsafe for SQLcl CONNECT.', 2);
      const result = await this.execute(
        `set define off\nconnect -name "${connectionName}"`,
        options,
        () => false,
      );
      // SQLcl command errors can arrive in successful MCP envelopes. A failed
      // CONNECT must not submit a subsequent batch on an unconfirmed session.
      const output = this.text(result);
      return /(?:ORA-|SP2-|PLS-)\d+|(?:Unknown connection|Connection not found)\b/i.test(output)
        ? { ...result, isError: true }
        : result;
    }
    if (!this.tools?.connect)
      throw new Fault(
        'UNSUPPORTED_CAPABILITY',
        'SQLcl MCP does not advertise named connections.',
        3,
        'blocked',
      );
    return this.call('connect', { connection_name: connectionName }, options);
  }
  async execute(input: string, options: () => CallOptions, uncertain: () => boolean) {
    if (!this.tools) throw new Error('SQLcl MCP client is not open.');
    const args: Record<string, unknown> = { sqlcl: input };
    if (this.tools.executionType) args.execution_type = 'SYNCHRONOUS';
    options();
    let result = await this.call(this.tools.run.name, args, options, uncertain());
    const id = result.structuredContent?.tool_request_id;
    if (typeof id !== 'string' || result.isError) return result;
    if (!this.tools.status)
      throw new Error('SQLcl returned a background request without request_status support.');
    for (;;) {
      const current = options();
      await delay(250, undefined, current.signal ? { signal: current.signal } : {});
      const status = await this.call('request_status', { tool_request_id: id }, options, uncertain());
      if (status.isError) throw new Error('SQLcl could not confirm background execution status.');
      const data = status.structuredContent;
      // SQLcl 26.1 returns a plain status while running, then plain command
      // output. The adapter still requires its unique completion marker.
      if (!data) {
        if (this.text(status).trim() === 'RUNNING') continue;
        return status;
      }
      if (data?.status === 'RUNNING') continue;
      if (data?.status === 'FINISHED' || data?.status === 'FAILED') {
        const payload = data.result as CallToolResult | undefined;
        if (!payload || !Array.isArray(payload.content))
          throw new Error('SQLcl returned an unrecognized background result.');
        result = { ...payload, isError: data.status === 'FAILED' || payload.isError === true };
        this.text(result, uncertain());
        return result;
      }
      throw new Error('SQLcl returned an unrecognized background status.');
    }
  }
  async close() {
    await this.client.close().catch(() => {});
    this.transport.kill();
  }
}
export function mcpCallOptions(request: Pick<ProcessRequest, 'timeoutMs' | 'signal'>, deadline: number) {
  return (): CallOptions => {
    if (request.signal?.aborted) throw new Error('SQLcl MCP cancelled.');
    const timeout = deadline - Date.now();
    if (timeout <= 0) throw new Error('SQLcl MCP timed out.');
    return { timeout, ...(request.signal ? { signal: request.signal } : {}) };
  };
}
export function mcpFailure(error: unknown, request: SqlclMcpRequest, submitted: boolean, overflowed = false) {
  const uncertain = submitted && request.mutation;
  if (overflowed) return outputLimit(uncertain);
  if (error instanceof Fault) return error;
  return new Fault(
    uncertain ? 'SQLCL_MCP_OUTCOME_UNKNOWN' : request.signal?.aborted ? 'CANCELLED' : 'SQLCL_MCP_FAILED',
    uncertain
      ? 'SQLcl MCP did not confirm the submitted write. Reconcile the target before retrying.'
      : `SQLcl MCP failed: ${redact(error instanceof Error ? error.message : String(error))}`,
    uncertain || request.signal?.aborted ? 6 : 3,
    uncertain ? 'outcome_unknown' : request.signal?.aborted ? 'cancelled' : 'blocked',
  );
}
export function mcpResult(result: CallToolResult, text: string): ProcessResult {
  return {
    code: result.isError ? 1 : 0,
    stdout: text,
    stderr: '',
    timedOut: false,
    cancelled: false,
    truncated: false,
  };
}

// One server per call. Never share connections across projects, retry a
// submitted command, or silently switch to the CLI. Persistent reuse lives in
// sqlcl-session.ts.
export async function runSqlclMcp(request: SqlclMcpRequest): Promise<ProcessResult> {
  const started = performance.now();
  const timing = executionTiming(
    'mcp',
    request.mutation,
    !!request.connectionName || !!request.sqlclConnected,
  );
  const session = new SqlclMcpClient(request);
  const options = mcpCallOptions(request, Date.now() + (request.timeoutMs ?? SQLCL_READ_TIMEOUT_MS));
  let submitted = false;
  let executeStarted: number | undefined;
  try {
    await session.open(options());
    timing.spawnMs = performance.now() - started;
    if (request.connectionName) {
      const connectStarted = performance.now();
      const connected = await session.connect(request.connectionName, options);
      timing.connectMs = performance.now() - connectStarted;
      if (connected.isError) return mcpResult(connected, session.text(connected));
    }
    submitted = true;
    executeStarted = performance.now();
    const result = await session.execute(request.input ?? '', options, () => request.mutation);
    timing.executeMs = performance.now() - executeStarted;
    return mcpResult(result, session.text(result, request.mutation));
  } catch (error) {
    throw mcpFailure(error, request, submitted, session.transport.outputLimitExceeded);
  } finally {
    if (executeStarted !== undefined) timing.executeMs = performance.now() - executeStarted;
    await session.close();
    emitSqlclTiming(request.onSqlclTiming, timing, started);
  }
}
