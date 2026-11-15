import { parentPort, workerData, type MessagePort } from 'node:worker_threads';

/**
 * Owns the web application's Oracle connection (node-oracledb, thin mode) in a worker thread.
 * The render thread blocks on `flag` while an operation runs here and reads the JSON reply from
 * `port` (the same protocol as the preview's SQLcl worker, see preview/oracle/bridge.ts).
 *
 * One connection, one transaction per HTTP request: the render thread ends each request with
 * `end` (commit or rollback), after which package state is reset so no request sees another's.
 */
export interface DriverSettings {
  user: string;
  password: string;
  connectString: string;
  /** Statement timeout in milliseconds. */
  callTimeoutMs?: number;
}

export type DriverRequest =
  | { op: 'query'; sql: string; binds: Record<string, string | number | null>; maxRows: number }
  | { op: 'execute'; sql: string; binds: Record<string, string | number | null> }
  | {
      op: 'plsql';
      /** Blocks run before the unit (APEX session, HTP setup); a failure is a setup error. */
      setup: string[];
      block: string;
      /** `name := expression;` assignments evaluated after the unit. */
      after: Record<string, string>;
      binds: Record<string, string | number | null>;
      htp: boolean;
      /** Blocks run after everything else, errors ignored (APEX session cleanup). */
      cleanup: string[];
    }
  | { op: 'end'; commit: boolean }
  | { op: 'ping' }
  /** Database account sign-in: can this user connect with this password? */
  | { op: 'account'; user: string; password: string }
  | { op: 'close' };

export interface DriverError {
  code: number;
  message: string;
}

export type DriverReply =
  | { columns: string[]; rows: (string | number | null)[][] }
  | { changes: number; rowid: string | null }
  | {
      values: Record<string, string | null>;
      output: string;
      htp: string;
      error?: DriverError;
      setupError?: DriverError;
    }
  | { ok: boolean };

interface Data {
  settings: DriverSettings;
  flag: SharedArrayBuffer;
  port: MessagePort;
}
interface Envelope {
  id: number;
  input: string;
  timeoutMs: number;
  close?: boolean;
}

const { settings, flag, port } = workerData as Data;
const signal = new Int32Array(flag);

// node-oracledb is a dependency of the built application, not of the plug-in runtime.
type Oracle = typeof import('oracledb');
type Connection = import('oracledb').Connection;
let oracledb: Oracle | undefined;
let connection: Connection | undefined;

const pad = (value: number, size = 2) => String(value).padStart(size, '0');
const dateText = (value: Date) =>
  `${pad(value.getFullYear(), 4)}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const timeText = (value: Date) =>
  `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;

function oracleError(error: unknown): DriverError {
  const candidate = error as { errorNum?: number; message?: string };
  // Oracle appends a documentation link to every message; users do not need it.
  const message = (candidate?.message ?? String(error)).replace(
    /\n?Help: https:\/\/docs\.oracle\.com\S*/gu,
    '',
  );
  const code = candidate?.errorNum ?? Number(/ORA-(\d+)/u.exec(message)?.[1] ?? 20995);
  return { code: -Math.abs(code), message };
}

async function open(): Promise<Connection> {
  if (connection) return connection;
  oracledb ??=
    ((await import('oracledb')) as { default?: Oracle } & Oracle).default ?? (await import('oracledb'));
  const db = oracledb;
  const next = await db.getConnection({
    user: settings.user,
    password: settings.password,
    connectString: settings.connectString,
  });
  next.callTimeout = settings.callTimeoutMs ?? 60_000;
  // The renderer works with canonical text for dates and plain numbers, as the SQLcl path does.
  for (const statement of [
    "alter session set nls_date_format = 'YYYY-MM-DD HH24:MI:SS'",
    "alter session set nls_timestamp_format = 'YYYY-MM-DD HH24:MI:SS.FF'",
    "alter session set nls_numeric_characters = '.,'",
  ])
    await next.execute(statement);
  await next.execute('begin dbms_output.enable(null); end;');
  return (connection = next);
}

async function drop(): Promise<void> {
  const current = connection;
  connection = undefined;
  try {
    await current?.close();
  } catch {
    // A broken connection is already gone.
  }
}

function fetchTypeHandler(db: Oracle) {
  return (metaData: { dbType?: unknown }) => {
    const type = metaData.dbType;
    if (type === db.DB_TYPE_DATE)
      return { converter: (value: Date | null) => (value ? `${dateText(value)} ${timeText(value)}` : null) };
    if (
      type === db.DB_TYPE_TIMESTAMP ||
      type === db.DB_TYPE_TIMESTAMP_TZ ||
      type === db.DB_TYPE_TIMESTAMP_LTZ
    )
      return {
        converter: (value: Date | null) =>
          !value
            ? null
            : timeText(value) === '00:00:00'
              ? dateText(value)
              : `${dateText(value)} ${timeText(value)}`,
      };
    if (type === db.DB_TYPE_CLOB || type === db.DB_TYPE_NCLOB) return { type: db.STRING };
    if (type === db.DB_TYPE_RAW)
      return { converter: (value: Buffer | null) => (value ? value.toString('hex').toUpperCase() : null) };
    // BLOB values do not travel through text session state; the application serves them itself.
    if (type === db.DB_TYPE_BLOB)
      return {
        type: db.BUFFER,
        converter: (value: Buffer | null) => (value ? `[blob ${value.length} bytes]` : null),
      };
    return undefined;
  };
}

function plain(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return `${dateText(value)} ${timeText(value)}`;
  if (Buffer.isBuffer(value)) return value.toString('hex').toUpperCase();
  return JSON.stringify(value);
}

const body = (sql: string) => sql.trim().replace(/;\s*$/u, '');

async function inOut(db: Oracle, binds: Record<string, string | number | null>) {
  return Object.fromEntries(
    Object.entries(binds).map(([name, value]) => [
      name,
      { dir: db.BIND_INOUT, type: db.STRING, maxSize: 32_767, val: value === null ? null : String(value) },
    ]),
  );
}

const HTP_INIT = `declare
  l_names owa.vc_arr;
  l_values owa.vc_arr;
begin
  l_names(1) := 'REQUEST_PROTOCOL';
  l_values(1) := 'HTTP';
  owa.init_cgi_env(1, l_names, l_values);
  htp.init;
end;`;
const HTP_READ = `declare
  l_page htp.htbuf_arr;
  l_rows integer := 9999999;
  l_text clob;
begin
  owa.get_page(l_page, l_rows);
  dbms_lob.createtemporary(l_text, true);
  for i in 1 .. l_rows loop
    if l_page(i) is not null then dbms_lob.writeappend(l_text, length(l_page(i)), l_page(i)); end if;
  end loop;
  :APEXREST_HTP := l_text;
end;`;
const OUTPUT_READ = `declare
  l_lines dbmsoutput_linesarray;
  l_count integer := 10000;
  l_text varchar2(32767);
begin
  dbms_output.get_lines(l_lines, l_count);
  for i in 1 .. l_count loop
    exit when nvl(lengthb(l_text), 0) + nvl(lengthb(l_lines(i)), 0) > 32000;
    l_text := l_text || l_lines(i) || chr(10);
  end loop;
  :APEXREST_DBMS := l_text;
end;`;

async function handle(request: DriverRequest): Promise<DriverReply> {
  if (request.op === 'close') {
    await drop();
    return { ok: true };
  }
  if (request.op === 'account') {
    oracledb ??=
      ((await import('oracledb')) as { default?: Oracle } & Oracle).default ?? (await import('oracledb'));
    try {
      const probe = await oracledb.getConnection({
        user: request.user,
        password: request.password,
        connectString: settings.connectString,
      });
      await probe.close();
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
  const conn = await open();
  const db = oracledb!;
  switch (request.op) {
    case 'ping':
      await conn.execute('select 1 from dual');
      return { ok: true };
    case 'query': {
      const result = await conn.execute(body(request.sql), request.binds, {
        maxRows: request.maxRows,
        outFormat: db.OUT_FORMAT_ARRAY,
        fetchTypeHandler: fetchTypeHandler(db) as never,
      });
      return {
        columns: (result.metaData ?? []).map((column) => column.name.toUpperCase()),
        rows: ((result.rows ?? []) as unknown[][]).map((row) => row.map(plain)),
      };
    }
    case 'execute': {
      const result = await conn.execute(body(request.sql), request.binds);
      return { changes: result.rowsAffected ?? 0, rowid: result.lastRowid ?? null };
    }
    case 'end': {
      if (request.commit) await conn.commit();
      else await conn.rollback();
      // Package variables must not leak into the next request (another user's).
      await conn.execute('begin dbms_session.modify_package_state(dbms_session.reinitialize); end;');
      await conn.execute('begin dbms_output.enable(null); end;');
      return { ok: true };
    }
    case 'plsql': {
      for (const block of request.setup) {
        try {
          await conn.execute(block, await inOutSubset(db, block, request.binds));
        } catch (error) {
          return { values: {}, output: '', htp: '', setupError: oracleError(error) };
        }
      }
      if (request.htp) await conn.execute(HTP_INIT);
      const values: Record<string, string | null> = Object.fromEntries(
        Object.entries(request.binds).map(([name, value]) => [name, value === null ? null : String(value)]),
      );
      let error: DriverError | undefined;
      try {
        const result = await conn.execute(request.block, await inOutSubset(db, request.block, request.binds));
        for (const [name, value] of Object.entries((result.outBinds ?? {}) as Record<string, unknown>))
          values[name.toUpperCase()] = value === null || value === undefined ? null : String(value);
      } catch (failure) {
        error = oracleError(failure);
      }
      const names = Object.keys(request.after);
      if (names.length && !error) {
        const read = await conn.execute(
          `begin\n${names.map((name) => `  :${name} := ${request.after[name]};`).join('\n')}\nend;`,
          Object.fromEntries(
            names.map((name) => [name, { dir: db.BIND_OUT, type: db.STRING, maxSize: 32_767 }]),
          ),
        );
        for (const [name, value] of Object.entries((read.outBinds ?? {}) as Record<string, unknown>))
          values[name.toUpperCase()] = value === null || value === undefined ? null : String(value);
      }
      const output = await conn.execute(OUTPUT_READ, {
        APEXREST_DBMS: { dir: db.BIND_OUT, type: db.STRING, maxSize: 32_767 },
      });
      let htp = '';
      if (request.htp) {
        const page = await conn.execute(HTP_READ, { APEXREST_HTP: { dir: db.BIND_OUT, type: db.CLOB } });
        const lob = (page.outBinds as { APEXREST_HTP?: { getData(): Promise<string> } | null }).APEXREST_HTP;
        htp = lob ? ((await lob.getData()) ?? '') : '';
      }
      for (const block of request.cleanup) {
        try {
          await conn.execute(block);
        } catch {
          // Cleanup is best effort; the request's outcome is already decided.
        }
      }
      return {
        values,
        output: String((output.outBinds as { APEXREST_DBMS?: string | null }).APEXREST_DBMS ?? ''),
        htp,
        ...(error ? { error } : {}),
      };
    }
  }
}

/** The binds a block references, as IN OUT strings. */
async function inOutSubset(db: Oracle, block: string, binds: Record<string, string | number | null>) {
  const stripped = block.replace(/'(?:[^']|'')*'|"[^"]*"|--[^\n]*|\/\*[\s\S]*?\*\//gu, ' ');
  const used = new Set(
    [...stripped.matchAll(/(?<![:\w]):([A-Za-z][\w$#]*)/gu)].map((match) => match[1]!.toUpperCase()),
  );
  return inOut(
    db,
    Object.fromEntries(Object.entries(binds).filter(([name]) => used.has(name.toUpperCase()))),
  );
}

parentPort!.on('message', (envelope: Envelope) => {
  const request = envelope.close
    ? ({ op: 'close' } as DriverRequest)
    : (JSON.parse(envelope.input) as DriverRequest);
  void handle(request)
    .then(
      (reply) => port.postMessage({ id: envelope.id, ok: true, output: JSON.stringify(reply) }),
      async (error: unknown) => {
        const failure = oracleError(error);
        // A lost connection is reopened by the next request.
        if (/NJS-(?:003|500|501|503|511)|DPI-1010|ORA-(?:03113|03114|03135|12\d{3})/u.test(failure.message))
          await drop();
        port.postMessage({ id: envelope.id, ok: true, output: JSON.stringify({ failure }) });
      },
    )
    .finally(() => {
      Atomics.store(signal, 0, 1);
      Atomics.notify(signal, 0);
    });
});
