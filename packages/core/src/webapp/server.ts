import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ConnectedOracle } from '../preview/oracle/app-data.ts';
import { PreviewServer, type ApplicationMode } from '../preview/server.ts';
import { DriverAppData, driverLink } from './driver.ts';

/**
 * A built web application (apexrest build webapp): the APEXlang application rendered by the
 * preview's renderer in application mode, with its data and PL/SQL in the application's own
 * Oracle database through node-oracledb. Each HTTP request is one transaction, committed when it
 * succeeds. Sign-in is real, pages need it unless they are public, and authorization schemes are
 * enforced.
 */
export interface WebappAuth {
  /**
   * `users`: accounts in a JSON file with scrypt password hashes. `plsql`: a database function
   * `f(p_username, p_password) return boolean`. `database`: Oracle database accounts.
   * `open`: any name signs in without a password; for a closed test network only.
   */
  type: 'users' | 'plsql' | 'database' | 'open';
  /** `plsql`: the function, e.g. `app_auth.authenticate`. */
  function?: string;
  /** `users`: path of the accounts file, relative to the application folder. */
  usersFile?: string;
  /** Query returning the role static IDs of `:APP_USER` in its first column (any type but `users`). */
  rolesQuery?: string;
}

export interface WebappConfig {
  host?: string;
  port?: number;
  /** `host[:port]` names the application is published under, e.g. `apps.example.com`. */
  publicHosts?: string[];
  secureCookies?: boolean;
  sessionTimeoutMinutes?: number;
  /** Schema that owns the application's tables; defaults to the connecting user. */
  schema?: string;
  /** Extracted APEX browser files (`apexrest preview setup`), relative to the application folder. */
  assetsDir?: string;
  /** APEX application id, when the application is also installed in APEX in this database. */
  applicationId?: number;
  auth: WebappAuth;
}

export interface WebappOptions {
  /** Folder of the built application (holds `app/`, `config/`). */
  directory: string;
  config: WebappConfig;
  database: { user: string; password: string; connectString: string };
  log?: (message: string) => void;
}

export interface StoredUser {
  username: string;
  /** `scrypt$<salt hex>$<hash hex>`. */
  password: string;
  roles?: string[];
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 32).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, Buffer.from(salt, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const NAME = /^[A-Za-z][\w$#]*(?:\.[A-Za-z][\w$#]*){0,2}$/u;

/** Failed sign-ins per user name: five failures lock the name for a minute. */
class Attempts {
  #failures = new Map<string, { count: number; until: number }>();
  locked(name: string): boolean {
    const entry = this.#failures.get(name);
    return Boolean(entry && entry.count >= 5 && entry.until > Date.now());
  }
  record(name: string, ok: boolean): void {
    if (ok) return void this.#failures.delete(name);
    const entry = this.#failures.get(name);
    const count = entry && entry.until > Date.now() - 60_000 ? entry.count + 1 : 1;
    this.#failures.set(name, { count, until: Date.now() + 60_000 });
    if (this.#failures.size > 10_000) this.#failures.clear();
  }
}

function authenticator(options: WebappOptions, data: DriverAppData): ApplicationMode['authenticate'] {
  const { auth } = options.config;
  const attempts = new Attempts();
  const roles = (username: string): string[] => {
    if (!auth.rolesQuery) return [];
    const result = data.query(auth.rolesQuery, { APP_USER: username.toUpperCase() }, 1000);
    return result.rows.map((row) => String(row[result.columns[0]!] ?? '')).filter(Boolean);
  };
  const check = (username: string, password: string): { roles?: string[] } | undefined => {
    switch (auth.type) {
      case 'open':
        return { roles: roles(username) };
      case 'users': {
        const file = path.resolve(options.directory, auth.usersFile ?? 'config/users.json');
        const users = JSON.parse(fs.readFileSync(file, 'utf8')) as StoredUser[];
        const user = users.find((entry) => entry.username.toUpperCase() === username.toUpperCase());
        // Hash even for an unknown name, so the answer takes the same time.
        const ok = verifyPassword(password, user?.password ?? hashPassword(randomBytes(8).toString('hex')));
        return ok && user ? { roles: user.roles ?? [] } : undefined;
      }
      case 'plsql': {
        if (!auth.function || !NAME.test(auth.function))
          throw new Error('auth.function must be a PL/SQL function name such as app_auth.authenticate');
        const reply = data.plsql({
          block: `begin\n  :APEXREST_RESULT := case when ${auth.function}(:APEXREST_USERNAME, :APEXREST_PASSWORD) then 'Y' else 'N' end;\nend;`,
          binds: { APEXREST_RESULT: null, APEXREST_USERNAME: username, APEXREST_PASSWORD: password },
        });
        if (reply.error) throw reply.error;
        return reply.values.APEXREST_RESULT === 'Y' ? { roles: roles(username) } : undefined;
      }
      case 'database':
        return data.accountValid(username, password) ? { roles: roles(username) } : undefined;
    }
  };
  return (username, password) => {
    const name = username.trim().toUpperCase();
    if (!name || name.length > 255 || password.length > 1024 || attempts.locked(name)) return undefined;
    if (auth.type !== 'open' && !password) return undefined;
    let granted: { roles?: string[] } | undefined;
    try {
      granted = check(username.trim(), password);
    } catch (error) {
      options.log?.(`Sign-in check failed: ${(error as Error).message}`);
      granted = undefined;
    } finally {
      // The check ran in the request's transaction; sign-in itself changes nothing.
      data.endRequest(false);
    }
    attempts.record(name, Boolean(granted));
    return granted;
  };
}

/** APEX session context, when the application is installed in APEX in this database. */
function apexContext(data: DriverAppData, applicationId: number | undefined): ConnectedOracle['apex'] {
  if (!applicationId) return undefined;
  try {
    const items = data.query(
      `select item_name from apex_application_page_items where application_id = :P_APP_ID
       union
       select item_name from apex_application_items where application_id = :P_APP_ID`,
      { P_APP_ID: applicationId },
      20_000,
    );
    const pages = data.query(
      'select page_id from apex_application_pages where application_id = :P_APP_ID order by page_id',
      { P_APP_ID: applicationId },
      20_000,
    );
    if (!pages.rows.length) return undefined;
    return {
      applicationId,
      items: new Set(items.rows.map((row) => String(row.ITEM_NAME).toUpperCase())),
      pages: pages.rows.map((row) => Number(row.PAGE_ID)),
    };
  } catch {
    // No APEX in this database, or its views are not visible: database code runs with binds only.
    return undefined;
  } finally {
    data.endRequest(false);
  }
}

export async function startWebapp(options: WebappOptions): Promise<{
  url: string;
  stop(): Promise<void>;
  /** What the renderer could not run or reported; for the operator's log, never for users. */
  diagnostics(): { level: string; message: string; page?: string; component?: string }[];
}> {
  const { config, directory } = options;
  const log = options.log ?? (() => undefined);
  const sourceDir = path.join(directory, 'app');
  if (!fs.existsSync(path.join(sourceDir, 'application.apx')))
    throw new Error(`${sourceDir} has no application.apx; build the application again`);
  const assetsDir = path.resolve(directory, config.assetsDir ?? 'apex-assets');
  if (!fs.existsSync(path.join(assetsDir, 'manifest.json')))
    throw new Error(
      `The APEX browser files are not in ${assetsDir}. Extract them from your own APEX 26.2 download with ` +
        '"apexrest preview setup" and set assetsDir (or APEX_ASSETS_DIR) to that folder.',
    );
  const data = new DriverAppData(driverLink(options.database), config.schema ?? options.database.user);
  try {
    data.ping();
  } catch (error) {
    data.close();
    throw new Error(`Oracle connection failed: ${(error as Error).message}`);
  }
  const apex = apexContext(data, config.applicationId);
  if (config.auth.type === 'open')
    log('WARNING: auth.type is "open": anyone who reaches this server signs in without a password.');
  const oracle: ConnectedOracle = {
    data,
    environment: 'webapp',
    target: options.database.connectString,
    ...(apex ? { apex } : {}),
    commit: true,
    warnings: [],
  };
  const server = new PreviewServer({
    sourceDir,
    assetsDir,
    database: ':memory:',
    host: config.host ?? '127.0.0.1',
    port: config.port ?? 8080,
    toolbar: false,
    oracle,
    application: {
      authenticate: authenticator(options, data),
      ...(config.publicHosts ? { publicHosts: config.publicHosts } : {}),
      ...(config.secureCookies ? { secureCookies: true } : {}),
      sessionTimeoutMs: (config.sessionTimeoutMinutes ?? 480) * 60_000,
    },
  });
  server.onError = (error) => log(`Request failed: ${(error as Error)?.stack ?? String(error)}`);
  const url = await server.start();
  log(
    `Application ${server.renderer.alias} listening on ${url}${server.renderer.baseUrl} ` +
      `(Oracle ${options.database.connectString}, ${apex ? `APEX session for application ${apex.applicationId}` : 'no APEX session'})`,
  );
  return { url, stop: () => server.stop(), diagnostics: () => server.diagnostics() };
}

/** Reads `config/default.json` and the environment of a built application and starts it. */
export async function runWebapp(directory: string): Promise<void> {
  const envFile = path.join(directory, '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  if (process.argv[2] === 'hash-password') {
    const password = process.argv[3];
    if (!password) throw new Error('Usage: node server.mjs hash-password <password>');
    console.log(hashPassword(password));
    return;
  }
  const config = JSON.parse(
    fs.readFileSync(path.join(directory, 'config', 'default.json'), 'utf8'),
  ) as WebappConfig;
  const env = process.env;
  const need = (name: string) => {
    const value = env[name];
    if (!value) throw new Error(`Set ${name} (see .env.example)`);
    return value;
  };
  const running = await startWebapp({
    directory,
    config: {
      ...config,
      ...(env.PORT ? { port: Number(env.PORT) } : {}),
      ...(env.HOST ? { host: env.HOST } : {}),
      ...(env.APEX_ASSETS_DIR ? { assetsDir: env.APEX_ASSETS_DIR } : {}),
      ...(env.PUBLIC_HOSTS ? { publicHosts: env.PUBLIC_HOSTS.split(',').map((host) => host.trim()) } : {}),
    },
    database: {
      user: need('ORACLE_USER'),
      password: need('ORACLE_PASSWORD'),
      connectString: need('ORACLE_CONNECT_STRING'),
    },
    log: (message) => console.log(`${new Date().toISOString()} ${message}`),
  });
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      if (stopping) process.exit(1);
      stopping = true;
      void running.stop().finally(() => process.exit(0));
    });
}
