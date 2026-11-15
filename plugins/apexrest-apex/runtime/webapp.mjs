import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  OracleAppData,
  PreviewServer,
  WorkerBridge,
  apexContextBlock,
  bindNames
} from "./chunk-6VX56PE4.mjs";
import "./chunk-QF3FUIGG.mjs";
import {
  HTP_BIND,
  OUTPUT_BIND,
  OracleError,
  referencedBinds
} from "./chunk-N3KQBIVW.mjs";
import "./chunk-GGZKKEXV.mjs";
import "./chunk-WBDBC3GS.mjs";
import "./chunk-C7ONAFBZ.mjs";
import "./chunk-JVBX3L43.mjs";

// packages/core/src/webapp/server.ts
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs2 from "node:fs";
import path from "node:path";

// packages/core/src/webapp/driver.ts
import fs from "node:fs";
import { fileURLToPath } from "node:url";
var DDL = /^\s*(create|alter|drop|truncate|rename|comment|grant|revoke|flashback|purge|analyze)\b/iu;
function driverWorker() {
  const source = new URL("./driver-worker.ts", import.meta.url);
  if (fs.existsSync(fileURLToPath(source))) return source;
  return new URL("./webapp-driver-worker.mjs", import.meta.url);
}
function driverLink(settings, worker) {
  return new WorkerBridge({
    settings,
    worker: worker ?? driverWorker(),
    timeoutMs: (settings.callTimeoutMs ?? 6e4) + 5e3,
    graceMs: 3e4
  });
}
var raise = (error) => new OracleError(error.code, error.message);
var DriverAppData = class extends OracleAppData {
  #dirty = false;
  constructor(link, schema) {
    super(link, schema, { commit: true });
  }
  #call(request) {
    const reply = JSON.parse(this.link.run(JSON.stringify(request)));
    if ("failure" in reply) throw raise(reply.failure);
    return reply;
  }
  query(sql, binds = {}, maxRows = 1e4) {
    this.#dirty = true;
    const reply = this.#call({
      op: "query",
      sql,
      binds: referencedBinds(bindNames(sql), binds),
      maxRows
    });
    const rows = reply.rows.map((values) => {
      const row = {};
      reply.columns.forEach((column, index) => {
        if (!(column in row)) row[column] = values[index] ?? null;
      });
      return row;
    });
    return { columns: [...new Set(reply.columns)], rows };
  }
  execute(sql, binds = {}) {
    if (DDL.test(sql))
      throw new OracleError(-20996, "DDL is not run by page components because Oracle commits it");
    if (/^\s*release\s+savepoint\b/iu.test(sql)) return { changes: 0, lastInsertRowid: 0 };
    this.#dirty = true;
    const control = /^\s*(savepoint\s+[\w$#]+|rollback\s+to\s+(?:savepoint\s+)?[\w$#]+)\s*;?\s*$/iu.exec(sql);
    const reply = this.#call({
      op: "execute",
      sql: control ? `begin ${control[1]}; end;;` : sql,
      binds: control ? {} : referencedBinds(bindNames(sql), binds)
    });
    return { changes: reply.changes, lastInsertRowid: reply.rowid ?? 0 };
  }
  plsql(call) {
    this.#dirty = true;
    const after = call.after ?? {};
    const reply = this.#call({
      op: "plsql",
      setup: call.apex ? [apexContextBlock(call.apex, call.binds)] : [],
      block: call.block,
      after,
      binds: {
        ...Object.fromEntries(Object.keys(after).map((name) => [name.toUpperCase(), null])),
        ...Object.fromEntries(Object.entries(call.binds).map(([name, value]) => [name.toUpperCase(), value]))
      },
      htp: call.htp === true,
      // A committed APEX session would outlive the request.
      cleanup: call.apex ? ["begin apex_session.delete_session; end;"] : []
    });
    if (reply.setupError) throw raise(reply.setupError);
    return {
      ...reply.error ? { error: raise(reply.error) } : {},
      values: { ...reply.values, [OUTPUT_BIND]: reply.output, [HTP_BIND]: reply.htp },
      output: reply.output,
      // owa.get_page starts with the CGI header block; dynamic content needs only the body.
      htp: reply.htp.replace(/^(?:[\w-]+:[^\n]*\n)+\n/u, "")
    };
  }
  transactional() {
    return true;
  }
  /** Whether the database answers; a failure carries Oracle's message. */
  ping() {
    this.#call({ op: "ping" });
  }
  /** Database account sign-in: whether this user can connect with this password. */
  accountValid(user, password) {
    return this.#call({ op: "account", user, password }).ok;
  }
  endRequest(succeeded = false) {
    if (!this.#dirty) return;
    this.#dirty = false;
    this.#call({ op: "end", commit: succeeded });
  }
  close() {
    try {
      this.endRequest();
    } finally {
      this.link.close();
    }
  }
};

// packages/core/src/webapp/server.ts
function hashPassword(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 32).toString("hex")}`;
}
function verifyPassword(password, stored) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, Buffer.from(salt, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
var NAME = /^[A-Za-z][\w$#]*(?:\.[A-Za-z][\w$#]*){0,2}$/u;
var Attempts = class {
  #failures = /* @__PURE__ */ new Map();
  locked(name) {
    const entry = this.#failures.get(name);
    return Boolean(entry && entry.count >= 5 && entry.until > Date.now());
  }
  record(name, ok) {
    if (ok) return void this.#failures.delete(name);
    const entry = this.#failures.get(name);
    const count = entry && entry.until > Date.now() - 6e4 ? entry.count + 1 : 1;
    this.#failures.set(name, { count, until: Date.now() + 6e4 });
    if (this.#failures.size > 1e4) this.#failures.clear();
  }
};
function authenticator(options, data) {
  const { auth } = options.config;
  const attempts = new Attempts();
  const roles = (username) => {
    if (!auth.rolesQuery) return [];
    const result = data.query(auth.rolesQuery, { APP_USER: username.toUpperCase() }, 1e3);
    return result.rows.map((row) => String(row[result.columns[0]] ?? "")).filter(Boolean);
  };
  const check = (username, password) => {
    switch (auth.type) {
      case "open":
        return { roles: roles(username) };
      case "users": {
        const file = path.resolve(options.directory, auth.usersFile ?? "config/users.json");
        const users = JSON.parse(fs2.readFileSync(file, "utf8"));
        const user = users.find((entry) => entry.username.toUpperCase() === username.toUpperCase());
        const ok = verifyPassword(password, user?.password ?? hashPassword(randomBytes(8).toString("hex")));
        return ok && user ? { roles: user.roles ?? [] } : void 0;
      }
      case "plsql": {
        if (!auth.function || !NAME.test(auth.function))
          throw new Error("auth.function must be a PL/SQL function name such as app_auth.authenticate");
        const reply = data.plsql({
          block: `begin
  :APEXREST_RESULT := case when ${auth.function}(:APEXREST_USERNAME, :APEXREST_PASSWORD) then 'Y' else 'N' end;
end;`,
          binds: { APEXREST_RESULT: null, APEXREST_USERNAME: username, APEXREST_PASSWORD: password }
        });
        if (reply.error) throw reply.error;
        return reply.values.APEXREST_RESULT === "Y" ? { roles: roles(username) } : void 0;
      }
      case "database":
        return data.accountValid(username, password) ? { roles: roles(username) } : void 0;
    }
  };
  return (username, password) => {
    const name = username.trim().toUpperCase();
    if (!name || name.length > 255 || password.length > 1024 || attempts.locked(name)) return void 0;
    if (auth.type !== "open" && !password) return void 0;
    let granted;
    try {
      granted = check(username.trim(), password);
    } catch (error) {
      options.log?.(`Sign-in check failed: ${error.message}`);
      granted = void 0;
    } finally {
      data.endRequest(false);
    }
    attempts.record(name, Boolean(granted));
    return granted;
  };
}
function apexContext(data, applicationId) {
  if (!applicationId) return void 0;
  try {
    const items = data.query(
      `select item_name from apex_application_page_items where application_id = :P_APP_ID
       union
       select item_name from apex_application_items where application_id = :P_APP_ID`,
      { P_APP_ID: applicationId },
      2e4
    );
    const pages = data.query(
      "select page_id from apex_application_pages where application_id = :P_APP_ID order by page_id",
      { P_APP_ID: applicationId },
      2e4
    );
    if (!pages.rows.length) return void 0;
    return {
      applicationId,
      items: new Set(items.rows.map((row) => String(row.ITEM_NAME).toUpperCase())),
      pages: pages.rows.map((row) => Number(row.PAGE_ID))
    };
  } catch {
    return void 0;
  } finally {
    data.endRequest(false);
  }
}
async function startWebapp(options) {
  const { config, directory } = options;
  const log = options.log ?? (() => void 0);
  const sourceDir = path.join(directory, "app");
  if (!fs2.existsSync(path.join(sourceDir, "application.apx")))
    throw new Error(`${sourceDir} has no application.apx; build the application again`);
  const assetsDir = path.resolve(directory, config.assetsDir ?? "apex-assets");
  if (!fs2.existsSync(path.join(assetsDir, "manifest.json")))
    throw new Error(
      `The APEX browser files are not in ${assetsDir}. Extract them from your own APEX 26.2 download with "apexrest preview setup" and set assetsDir (or APEX_ASSETS_DIR) to that folder.`
    );
  const data = new DriverAppData(driverLink(options.database), config.schema ?? options.database.user);
  try {
    data.ping();
  } catch (error) {
    data.close();
    throw new Error(`Oracle connection failed: ${error.message}`);
  }
  const apex = apexContext(data, config.applicationId);
  if (config.auth.type === "open")
    log('WARNING: auth.type is "open": anyone who reaches this server signs in without a password.');
  const oracle = {
    data,
    environment: "webapp",
    target: options.database.connectString,
    ...apex ? { apex } : {},
    commit: true,
    warnings: []
  };
  const server = new PreviewServer({
    sourceDir,
    assetsDir,
    database: ":memory:",
    host: config.host ?? "127.0.0.1",
    port: config.port ?? 8080,
    toolbar: false,
    oracle,
    application: {
      authenticate: authenticator(options, data),
      ...config.publicHosts ? { publicHosts: config.publicHosts } : {},
      ...config.secureCookies ? { secureCookies: true } : {},
      sessionTimeoutMs: (config.sessionTimeoutMinutes ?? 480) * 6e4
    }
  });
  server.onError = (error) => log(`Request failed: ${error?.stack ?? String(error)}`);
  const url = await server.start();
  log(
    `Application ${server.renderer.alias} listening on ${url}${server.renderer.baseUrl} (Oracle ${options.database.connectString}, ${apex ? `APEX session for application ${apex.applicationId}` : "no APEX session"})`
  );
  return { url, stop: () => server.stop(), diagnostics: () => server.diagnostics() };
}
async function runWebapp(directory) {
  const envFile = path.join(directory, ".env");
  if (fs2.existsSync(envFile)) process.loadEnvFile(envFile);
  if (process.argv[2] === "hash-password") {
    const password = process.argv[3];
    if (!password) throw new Error("Usage: node server.mjs hash-password <password>");
    console.log(hashPassword(password));
    return;
  }
  const config = JSON.parse(
    fs2.readFileSync(path.join(directory, "config", "default.json"), "utf8")
  );
  const env = process.env;
  const need = (name) => {
    const value = env[name];
    if (!value) throw new Error(`Set ${name} (see .env.example)`);
    return value;
  };
  const running = await startWebapp({
    directory,
    config: {
      ...config,
      ...env.PORT ? { port: Number(env.PORT) } : {},
      ...env.HOST ? { host: env.HOST } : {},
      ...env.APEX_ASSETS_DIR ? { assetsDir: env.APEX_ASSETS_DIR } : {},
      ...env.PUBLIC_HOSTS ? { publicHosts: env.PUBLIC_HOSTS.split(",").map((host) => host.trim()) } : {}
    },
    database: {
      user: need("ORACLE_USER"),
      password: need("ORACLE_PASSWORD"),
      connectString: need("ORACLE_CONNECT_STRING")
    },
    log: (message) => console.log(`${(/* @__PURE__ */ new Date()).toISOString()} ${message}`)
  });
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      if (stopping) process.exit(1);
      stopping = true;
      void running.stop().finally(() => process.exit(0));
    });
}
export {
  hashPassword,
  runWebapp,
  startWebapp,
  verifyPassword
};
