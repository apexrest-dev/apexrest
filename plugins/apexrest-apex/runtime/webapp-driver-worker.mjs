import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);

// packages/core/src/webapp/driver-worker.ts
import { parentPort, workerData } from "node:worker_threads";
var { settings, flag, port } = workerData;
var signal = new Int32Array(flag);
var oracledb;
var connection;
var pad = (value, size = 2) => String(value).padStart(size, "0");
var dateText = (value) => `${pad(value.getFullYear(), 4)}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
var timeText = (value) => `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
function oracleError(error) {
  const candidate = error;
  const message = (candidate?.message ?? String(error)).replace(
    /\n?Help: https:\/\/docs\.oracle\.com\S*/gu,
    ""
  );
  const code = candidate?.errorNum ?? Number(/ORA-(\d+)/u.exec(message)?.[1] ?? 20995);
  return { code: -Math.abs(code), message };
}
async function open() {
  if (connection) return connection;
  oracledb ??= (await import("oracledb")).default ?? await import("oracledb");
  const db = oracledb;
  const next = await db.getConnection({
    user: settings.user,
    password: settings.password,
    connectString: settings.connectString
  });
  next.callTimeout = settings.callTimeoutMs ?? 6e4;
  for (const statement of [
    "alter session set nls_date_format = 'YYYY-MM-DD HH24:MI:SS'",
    "alter session set nls_timestamp_format = 'YYYY-MM-DD HH24:MI:SS.FF'",
    "alter session set nls_numeric_characters = '.,'"
  ])
    await next.execute(statement);
  await next.execute("begin dbms_output.enable(null); end;");
  return connection = next;
}
async function drop() {
  const current = connection;
  connection = void 0;
  try {
    await current?.close();
  } catch {
  }
}
function fetchTypeHandler(db) {
  return (metaData) => {
    const type = metaData.dbType;
    if (type === db.DB_TYPE_DATE)
      return { converter: (value) => value ? `${dateText(value)} ${timeText(value)}` : null };
    if (type === db.DB_TYPE_TIMESTAMP || type === db.DB_TYPE_TIMESTAMP_TZ || type === db.DB_TYPE_TIMESTAMP_LTZ)
      return {
        converter: (value) => !value ? null : timeText(value) === "00:00:00" ? dateText(value) : `${dateText(value)} ${timeText(value)}`
      };
    if (type === db.DB_TYPE_CLOB || type === db.DB_TYPE_NCLOB) return { type: db.STRING };
    if (type === db.DB_TYPE_RAW)
      return { converter: (value) => value ? value.toString("hex").toUpperCase() : null };
    if (type === db.DB_TYPE_BLOB)
      return {
        type: db.BUFFER,
        converter: (value) => value ? `[blob ${value.length} bytes]` : null
      };
    return void 0;
  };
}
function plain(value) {
  if (value === null || value === void 0) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return `${dateText(value)} ${timeText(value)}`;
  if (Buffer.isBuffer(value)) return value.toString("hex").toUpperCase();
  return JSON.stringify(value);
}
var body = (sql) => sql.trim().replace(/;\s*$/u, "");
async function inOut(db, binds) {
  return Object.fromEntries(
    Object.entries(binds).map(([name, value]) => [
      name,
      { dir: db.BIND_INOUT, type: db.STRING, maxSize: 32767, val: value === null ? null : String(value) }
    ])
  );
}
var HTP_INIT = `declare
  l_names owa.vc_arr;
  l_values owa.vc_arr;
begin
  l_names(1) := 'REQUEST_PROTOCOL';
  l_values(1) := 'HTTP';
  owa.init_cgi_env(1, l_names, l_values);
  htp.init;
end;`;
var HTP_READ = `declare
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
var OUTPUT_READ = `declare
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
async function handle(request) {
  if (request.op === "close") {
    await drop();
    return { ok: true };
  }
  if (request.op === "account") {
    oracledb ??= (await import("oracledb")).default ?? await import("oracledb");
    try {
      const probe = await oracledb.getConnection({
        user: request.user,
        password: request.password,
        connectString: settings.connectString
      });
      await probe.close();
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
  const conn = await open();
  const db = oracledb;
  switch (request.op) {
    case "ping":
      await conn.execute("select 1 from dual");
      return { ok: true };
    case "query": {
      const result = await conn.execute(body(request.sql), request.binds, {
        maxRows: request.maxRows,
        outFormat: db.OUT_FORMAT_ARRAY,
        fetchTypeHandler: fetchTypeHandler(db)
      });
      return {
        columns: (result.metaData ?? []).map((column) => column.name.toUpperCase()),
        rows: (result.rows ?? []).map((row) => row.map(plain))
      };
    }
    case "execute": {
      const result = await conn.execute(body(request.sql), request.binds);
      return { changes: result.rowsAffected ?? 0, rowid: result.lastRowid ?? null };
    }
    case "end": {
      if (request.commit) await conn.commit();
      else await conn.rollback();
      await conn.execute("begin dbms_session.modify_package_state(dbms_session.reinitialize); end;");
      await conn.execute("begin dbms_output.enable(null); end;");
      return { ok: true };
    }
    case "plsql": {
      for (const block of request.setup) {
        try {
          await conn.execute(block, await inOutSubset(db, block, request.binds));
        } catch (error2) {
          return { values: {}, output: "", htp: "", setupError: oracleError(error2) };
        }
      }
      if (request.htp) await conn.execute(HTP_INIT);
      const values = Object.fromEntries(
        Object.entries(request.binds).map(([name, value]) => [name, value === null ? null : String(value)])
      );
      let error;
      try {
        const result = await conn.execute(request.block, await inOutSubset(db, request.block, request.binds));
        for (const [name, value] of Object.entries(result.outBinds ?? {}))
          values[name.toUpperCase()] = value === null || value === void 0 ? null : String(value);
      } catch (failure) {
        error = oracleError(failure);
      }
      const names = Object.keys(request.after);
      if (names.length && !error) {
        const read = await conn.execute(
          `begin
${names.map((name) => `  :${name} := ${request.after[name]};`).join("\n")}
end;`,
          Object.fromEntries(
            names.map((name) => [name, { dir: db.BIND_OUT, type: db.STRING, maxSize: 32767 }])
          )
        );
        for (const [name, value] of Object.entries(read.outBinds ?? {}))
          values[name.toUpperCase()] = value === null || value === void 0 ? null : String(value);
      }
      const output = await conn.execute(OUTPUT_READ, {
        APEXREST_DBMS: { dir: db.BIND_OUT, type: db.STRING, maxSize: 32767 }
      });
      let htp = "";
      if (request.htp) {
        const page = await conn.execute(HTP_READ, { APEXREST_HTP: { dir: db.BIND_OUT, type: db.CLOB } });
        const lob = page.outBinds.APEXREST_HTP;
        htp = lob ? await lob.getData() ?? "" : "";
      }
      for (const block of request.cleanup) {
        try {
          await conn.execute(block);
        } catch {
        }
      }
      return {
        values,
        output: String(output.outBinds.APEXREST_DBMS ?? ""),
        htp,
        ...error ? { error } : {}
      };
    }
  }
}
async function inOutSubset(db, block, binds) {
  const stripped = block.replace(/'(?:[^']|'')*'|"[^"]*"|--[^\n]*|\/\*[\s\S]*?\*\//gu, " ");
  const used = new Set(
    [...stripped.matchAll(/(?<![:\w]):([A-Za-z][\w$#]*)/gu)].map((match) => match[1].toUpperCase())
  );
  return inOut(
    db,
    Object.fromEntries(Object.entries(binds).filter(([name]) => used.has(name.toUpperCase())))
  );
}
parentPort.on("message", (envelope) => {
  const request = envelope.close ? { op: "close" } : JSON.parse(envelope.input);
  void handle(request).then(
    (reply) => port.postMessage({ id: envelope.id, ok: true, output: JSON.stringify(reply) }),
    async (error) => {
      const failure = oracleError(error);
      if (/NJS-(?:003|500|501|503|511)|DPI-1010|ORA-(?:03113|03114|03135|12\d{3})/u.test(failure.message))
        await drop();
      port.postMessage({ id: envelope.id, ok: true, output: JSON.stringify({ failure }) });
    }
  ).finally(() => {
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
  });
});
