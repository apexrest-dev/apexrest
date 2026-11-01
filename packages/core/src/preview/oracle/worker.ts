import { parentPort, workerData, type MessagePort } from 'node:worker_threads';
import { SqlclMcpClient, mcpCallOptions } from '../../sqlcl-mcp.ts';
import { INIT_SESSION } from './protocol.ts';

/**
 * Owns the preview's one long-lived SQLcl MCP server and named connection. The
 * main thread blocks on `flag` while a batch runs here; each reply goes to
 * `port` before the flag is raised (see bridge.ts). A failed transport closes
 * the server, which ends the database session and so rolls back its work.
 */
export interface WorkerSettings {
  executable: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  connectionName: string;
}
interface Data {
  settings: WorkerSettings;
  flag: SharedArrayBuffer;
  port: MessagePort;
}
interface Request {
  id: number;
  input: string;
  timeoutMs: number;
  close?: boolean;
}

const { settings, flag, port } = workerData as Data;
const signal = new Int32Array(flag);
let client: SqlclMcpClient | undefined;

async function open(deadline: number) {
  if (client?.alive) return client;
  await client?.close();
  const next = new SqlclMcpClient({ ...settings, maxBytes: 16 * 1024 * 1024 });
  const options = mcpCallOptions({}, deadline);
  try {
    await next.open(options());
    await next.connect(settings.connectionName, options);
    await next.execute(INIT_SESSION, options, () => false);
  } catch (error) {
    await next.close();
    throw error;
  }
  return (client = next);
}

async function handle(request: Request) {
  if (request.close) {
    await client?.close();
    client = undefined;
    return '';
  }
  const deadline = Date.now() + request.timeoutMs;
  const session = await open(deadline);
  const options = mcpCallOptions({}, deadline);
  try {
    const result = await session.execute(request.input, options, () => false);
    return session.text(result);
  } catch (error) {
    await session.close();
    client = undefined;
    throw error;
  }
}

parentPort!.on('message', (request: Request) => {
  void handle(request)
    .then(
      (output) => port.postMessage({ id: request.id, ok: true, output }),
      (error: unknown) =>
        port.postMessage({ id: request.id, ok: false, error: (error as Error)?.message ?? String(error) }),
    )
    .finally(() => {
      Atomics.store(signal, 0, 1);
      Atomics.notify(signal, 0);
    });
});
