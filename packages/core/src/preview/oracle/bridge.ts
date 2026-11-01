import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MessageChannel, Worker, receiveMessageOnPort, type MessagePort } from 'node:worker_threads';
import { OracleError } from './protocol.ts';
import type { WorkerSettings } from './worker.ts';

/** Synchronous access to the Oracle session for the synchronous renderer. */
export interface OracleLink {
  run(input: string): string;
  close(): void;
}

export interface BridgeOptions {
  settings: WorkerSettings;
  timeoutMs?: number;
  /** Extra wait for SQLcl server startup and the reply beyond timeoutMs. */
  graceMs?: number;
  /** Worker entry; defaults to worker.ts beside this file or the bundled runtime entry. */
  worker?: URL | { source: string };
}

function defaultWorker(): URL {
  const source = new URL('./worker.ts', import.meta.url);
  if (fs.existsSync(fileURLToPath(source))) return source;
  // esbuild emits the worker as its own entry beside the runtime chunks (scripts/build-plugin.mjs).
  return new URL('./preview-oracle-worker.mjs', import.meta.url);
}

/**
 * Runs SQLcl batches in a worker thread and blocks the caller with Atomics.wait
 * until the reply is posted, so render code stays synchronous. A timed-out call
 * terminates the worker (its SQLcl server and session end, rolling back) and the
 * next call starts a fresh one.
 */
export class WorkerBridge implements OracleLink {
  readonly #options: BridgeOptions;
  #worker: Worker | undefined;
  #port: MessagePort | undefined;
  #flag = new Int32Array(new SharedArrayBuffer(4));
  #id = 0;

  constructor(options: BridgeOptions) {
    this.#options = options;
  }

  #start(): { worker: Worker; port: MessagePort } {
    if (this.#worker && this.#port) return { worker: this.#worker, port: this.#port };
    const channel = new MessageChannel();
    const entry = this.#options.worker ?? defaultWorker();
    const data = { settings: this.#options.settings, flag: this.#flag.buffer, port: channel.port2 };
    const worker =
      entry instanceof URL
        ? new Worker(entry, { workerData: data, transferList: [channel.port2] })
        : new Worker(entry.source, { eval: true, workerData: data, transferList: [channel.port2] });
    worker.unref();
    worker.on('error', () => this.#reset());
    this.#worker = worker;
    this.#port = channel.port1;
    return { worker, port: channel.port1 };
  }

  #reset(): void {
    void this.#worker?.terminate();
    this.#port?.close();
    this.#worker = undefined;
    this.#port = undefined;
  }

  #call(request: { input: string; close?: boolean }): string {
    const timeoutMs = this.#options.timeoutMs ?? 30_000;
    const { worker, port } = this.#start();
    const id = ++this.#id;
    Atomics.store(this.#flag, 0, 0);
    worker.postMessage({ id, input: request.input, timeoutMs, ...(request.close ? { close: true } : {}) });
    // The worker applies the same deadline to SQLcl; the margin covers server startup and reply.
    const deadline = Date.now() + timeoutMs + (this.#options.graceMs ?? 15_000);
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0 || Atomics.wait(this.#flag, 0, 0, remaining) === 'timed-out') {
        this.#reset();
        throw new OracleError(
          -20994,
          `Oracle did not answer within ${Math.round(timeoutMs / 1000)} s; the session was reset and its work rolled back`,
        );
      }
      let reply = receiveMessageOnPort(port)?.message as
        { id: number; ok: boolean; output?: string; error?: string } | undefined;
      while (reply && reply.id !== id) reply = receiveMessageOnPort(port)?.message as typeof reply;
      if (!reply) {
        // A stale reply from an earlier call raised the flag; wait for ours.
        Atomics.store(this.#flag, 0, 0);
        continue;
      }
      if (!reply.ok)
        throw new OracleError(-20995, `Oracle session failed: ${reply.error ?? 'unknown error'}`);
      return reply.output ?? '';
    }
  }

  run(input: string): string {
    return this.#call({ input });
  }

  close(): void {
    if (!this.#worker) return;
    try {
      this.#call({ input: '', close: true });
    } catch {
      // Terminating the worker below ends the session either way.
    }
    this.#reset();
  }
}
