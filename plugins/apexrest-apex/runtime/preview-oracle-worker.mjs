import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  INIT_SESSION
} from "./chunk-N33AM7OK.mjs";
import {
  SqlclMcpClient,
  mcpCallOptions
} from "./chunk-XYDSY3MB.mjs";
import "./chunk-W7MSMS56.mjs";
import "./chunk-CCPOHUCO.mjs";

// packages/core/src/preview/oracle/worker.ts
import { parentPort, workerData } from "node:worker_threads";
var { settings, flag, port } = workerData;
var signal = new Int32Array(flag);
var client;
async function open(deadline) {
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
  return client = next;
}
async function handle(request) {
  if (request.close) {
    await client?.close();
    client = void 0;
    return "";
  }
  const deadline = Date.now() + request.timeoutMs;
  const session = await open(deadline);
  const options = mcpCallOptions({}, deadline);
  try {
    const result = await session.execute(request.input, options, () => false);
    return session.text(result);
  } catch (error) {
    await session.close();
    client = void 0;
    throw error;
  }
}
parentPort.on("message", (request) => {
  void handle(request).then(
    (output) => port.postMessage({ id: request.id, ok: true, output }),
    (error) => port.postMessage({ id: request.id, ok: false, error: error?.message ?? String(error) })
  ).finally(() => {
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
  });
});
