import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bindNames, type Binds, type QueryResult, type Row } from '../preview/database.ts';
import {
  apexContextBlock,
  OracleAppData,
  type PlsqlCall,
  type PlsqlReply,
} from '../preview/oracle/app-data.ts';
import { WorkerBridge, type OracleLink } from '../preview/oracle/bridge.ts';
import { HTP_BIND, OracleError, OUTPUT_BIND, referencedBinds } from '../preview/oracle/protocol.ts';
import type { DriverError, DriverReply, DriverRequest, DriverSettings } from './driver-worker.ts';

/**
 * Application data and PL/SQL through node-oracledb. The renderer is synchronous, so each call
 * blocks on the driver worker (driver-worker.ts) as the preview blocks on SQLcl. Dictionary
 * lookups and key handling are inherited from the SQLcl adapter; only the transport differs.
 *
 * Every HTTP request is one transaction: `endRequest(true)` commits, anything else rolls back.
 */
const DDL = /^\s*(create|alter|drop|truncate|rename|comment|grant|revoke|flashback|purge|analyze)\b/iu;

function driverWorker(): URL {
  const source = new URL('./driver-worker.ts', import.meta.url);
  if (fs.existsSync(fileURLToPath(source))) return source;
  // The plug-in build emits the worker beside the runtime chunks (scripts/build-plugin.mjs).
  return new URL('./webapp-driver-worker.mjs', import.meta.url);
}

export function driverLink(settings: DriverSettings, worker?: URL): OracleLink {
  return new WorkerBridge({
    settings: settings as never,
    worker: worker ?? driverWorker(),
    timeoutMs: (settings.callTimeoutMs ?? 60_000) + 5_000,
    graceMs: 30_000,
  });
}

const raise = (error: DriverError) => new OracleError(error.code, error.message);

export class DriverAppData extends OracleAppData {
  #dirty = false;

  constructor(link: OracleLink, schema: string) {
    super(link, schema, { commit: true });
  }

  #call<T extends DriverReply>(request: DriverRequest): T {
    const reply = JSON.parse(this.link.run(JSON.stringify(request))) as T | { failure: DriverError };
    if ('failure' in reply) throw raise(reply.failure);
    return reply;
  }

  override query(sql: string, binds: Binds = {}, maxRows = 10_000): QueryResult {
    this.#dirty = true;
    const reply = this.#call<{ columns: string[]; rows: (string | number | null)[][] }>({
      op: 'query',
      sql,
      binds: referencedBinds(bindNames(sql), binds),
      maxRows,
    });
    const rows = reply.rows.map((values) => {
      const row: Row = {};
      // The first of duplicate column names wins, as in the SQLcl JSON envelope.
      reply.columns.forEach((column, index) => {
        if (!(column in row)) row[column] = values[index] ?? null;
      });
      return row;
    });
    return { columns: [...new Set(reply.columns)], rows };
  }

  override execute(sql: string, binds: Binds = {}): { changes: number; lastInsertRowid: number | string } {
    if (DDL.test(sql))
      throw new OracleError(-20996, 'DDL is not run by page components because Oracle commits it');
    // SQLite-only savepoint release; Oracle savepoints end with the transaction.
    if (/^\s*release\s+savepoint\b/iu.test(sql)) return { changes: 0, lastInsertRowid: 0 };
    this.#dirty = true;
    const control = /^\s*(savepoint\s+[\w$#]+|rollback\s+to\s+(?:savepoint\s+)?[\w$#]+)\s*;?\s*$/iu.exec(sql);
    const reply = this.#call<{ changes: number; rowid: string | null }>({
      op: 'execute',
      sql: control ? `begin ${control[1]}; end;;` : sql,
      binds: control ? {} : referencedBinds(bindNames(sql), binds),
    });
    return { changes: reply.changes, lastInsertRowid: reply.rowid ?? 0 };
  }

  override plsql(call: PlsqlCall): PlsqlReply {
    this.#dirty = true;
    const after = call.after ?? {};
    const reply = this.#call<{
      values: Record<string, string | null>;
      output: string;
      htp: string;
      error?: DriverError;
      setupError?: DriverError;
    }>({
      op: 'plsql',
      setup: call.apex ? [apexContextBlock(call.apex, call.binds)] : [],
      block: call.block,
      after,
      binds: {
        ...Object.fromEntries(Object.keys(after).map((name) => [name.toUpperCase(), null])),
        ...Object.fromEntries(Object.entries(call.binds).map(([name, value]) => [name.toUpperCase(), value])),
      },
      htp: call.htp === true,
      // A committed APEX session would outlive the request.
      cleanup: call.apex ? ['begin apex_session.delete_session; end;'] : [],
    });
    if (reply.setupError) throw raise(reply.setupError);
    return {
      ...(reply.error ? { error: raise(reply.error) } : {}),
      values: { ...reply.values, [OUTPUT_BIND]: reply.output, [HTP_BIND]: reply.htp },
      output: reply.output,
      // owa.get_page starts with the CGI header block; dynamic content needs only the body.
      htp: reply.htp.replace(/^(?:[\w-]+:[^\n]*\n)+\n/u, ''),
    };
  }

  override transactional(): boolean {
    return true;
  }

  /** Whether the database answers; a failure carries Oracle's message. */
  ping(): void {
    this.#call({ op: 'ping' });
  }

  /** Database account sign-in: whether this user can connect with this password. */
  accountValid(user: string, password: string): boolean {
    return this.#call<{ ok: boolean }>({ op: 'account', user, password }).ok;
  }

  override endRequest(succeeded = false): void {
    if (!this.#dirty) return;
    this.#dirty = false;
    this.#call({ op: 'end', commit: succeeded });
  }

  override close(): void {
    try {
      this.endRequest();
    } finally {
      this.link.close();
    }
  }
}
