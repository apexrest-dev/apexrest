import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { environment, isProductionTarget, loadProject } from '../../config.ts';
import { resolveConnection, type Connection } from '../../connections.ts';
import { OracleAdapter, targetIdentitySql } from '../../oracle.ts';
import { Fault } from '../../result.ts';
import { OracleAppData, type ConnectedOracle } from './app-data.ts';
import { WorkerBridge, type OracleLink } from './bridge.ts';
import type { WorkerSettings } from './worker.ts';

/** SQLcl server settings for the preview worker, resolved the way OracleAdapter runs SQLcl MCP. */
async function workerSettings(connectionName: string): Promise<WorkerSettings> {
  const adapter = new OracleAdapter();
  const settings = await adapter.settings();
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries({
    ...process.env,
    SQLPATH: '',
    ORACLE_PATH: '',
    JAVA_HOME: settings.javaHome,
  }))
    if (
      value !== undefined &&
      !['NODE_OPTIONS', 'JAVA_TOOL_OPTIONS', '_JAVA_OPTIONS', 'JDK_JAVA_OPTIONS'].includes(key)
    )
      env[key] = value;
  return {
    executable: settings.executable,
    args: settings.mode === 'mcp' && settings.mcpRestrictLevel === '4' ? ['-mcp'] : ['-R', '1', '-mcp'],
    cwd: await adapter.sessionHome(),
    env,
    connectionName,
  };
}

/**
 * Pays the one-time costs of a fresh Oracle session before the preview URL is
 * returned: dictionary metadata for the schema's tables (one query instead of
 * one per table on the first page) and the first APEX session creation, which
 * loads APEX package state. Both are best effort and rolled back; a failure
 * (including a timeout, after which the next call opens a fresh session)
 * leaves the per-request paths, and their diagnostics, unchanged.
 */
export function warmUp(
  data: OracleAppData,
  apex?: ConnectedOracle['apex'],
): { ms: number; tables: number | 'partial' | 'skipped'; apexSession?: 'ready' | 'skipped' } {
  const started = performance.now();
  const steps: { tables: number | 'partial' | 'skipped'; apexSession?: 'ready' | 'skipped' } = {
    tables: 'skipped',
  };
  try {
    const prefetched = data.prefetchSchema();
    steps.tables = prefetched.complete ? prefetched.tables : 'partial';
  } catch {
    steps.tables = 'skipped';
  }
  if (apex)
    try {
      data.plsql({
        block: 'begin\n  null;\nend;',
        binds: {},
        apex: {
          ...apex,
          pageId: apex.pages.find((id) => id > 0) ?? apex.pages[0] ?? 1,
          user: 'APEXREST_PREVIEW',
          items: new Set(),
        },
      });
      steps.apexSession = 'ready';
    } catch {
      steps.apexSession = 'skipped';
    }
  return { ms: Math.round(performance.now() - started), ...steps };
}

/** The ojdbc.properties path of a SQLcl saved connection, when its connection store is found. */
export function savedConnectionProperties(name: string, home = os.homedir()): string | undefined {
  const store = path.join(home, '.dbtools', 'connections');
  let entries: string[];
  try {
    entries = fs.readdirSync(store);
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    try {
      const text = fs.readFileSync(path.join(store, entry, 'dbtools.properties'), 'utf8');
      if (text.split(/\r?\n/u).some((line) => line.trim() === `name=${name}`))
        return path.join(store, entry, 'ojdbc.properties');
    } catch {
      // Not a saved connection directory.
    }
  }
  return undefined;
}

export interface ConnectOptions {
  /**
   * Commit mode: successful requests are committed and application code may commit. Only an
   * actually local DEV/QA/TEST database qualifies (docs/deployment-safety.md); remote targets are refused.
   */
  commit?: boolean;
  /** Locality of the saved connection; defaults to the deployment check (`OracleAdapter.connectionLocality`). */
  locality?: (connection: Connection) => Promise<{ local: boolean; evidence: string }>;
}

/**
 * Opens the connected preview for one DEV/QA/TEST environment of apexrest.json:
 * refuses production, requires a SQLcl saved connection, and confirms the
 * database, service, parsing schema and workspace exactly as deployment does.
 */
export async function connectOracle(
  root: string,
  name: string,
  link?: (settings: WorkerSettings) => OracleLink,
  options: ConnectOptions = {},
): Promise<ConnectedOracle> {
  const commit = options.commit === true;
  const ctx = await loadProject(root);
  const env = environment(ctx, name);
  if (await isProductionTarget(env))
    throw new Fault(
      'PREVIEW_PRODUCTION_REFUSED',
      `Environment ${name} is production; the connected preview runs only against DEV, QA or TEST targets.`,
      4,
      'blocked',
    );
  const connection = await resolveConnection(env.readConnectionRef);
  if (!connection.name)
    throw new Fault(
      'PREVIEW_SQLCL_CONNECTION_REQUIRED',
      `Connection ${env.readConnectionRef} has no SQLcl saved connection. The connected preview needs one session that holds a transaction; ORDS-only connections are not supported.`,
      3,
      'blocked',
    );
  if (commit) {
    // Locality comes from the effective connection endpoint and server identity, never from names.
    let locality: { local: boolean; evidence: string };
    try {
      locality = await (options.locality ?? ((target) => new OracleAdapter().connectionLocality(target)))(
        connection,
      );
    } catch (error) {
      locality = { local: false, evidence: `unconfirmed (${(error as Error).message})` };
    }
    if (!locality.local)
      throw new Fault(
        'PREVIEW_COMMIT_REMOTE_REFUSED',
        `Commit mode writes application data permanently and runs only against a database on this computer; ` +
          `connection ${connection.name} of ${name} is not confirmed local (${locality.evidence}). ` +
          'Start the connected preview without commit; every request is then rolled back.',
        4,
        'blocked',
      );
  }
  const settings = { ...(await workerSettings(connection.name)), ...(commit ? { commit } : {}) };
  const data = new OracleAppData(link ? link(settings) : new WorkerBridge({ settings }), env.parsingSchema, {
    commit,
  });
  try {
    const rows = data.query(targetIdentitySql, {
      P_WORKSPACE: env.workspace,
      P_APP_ID: env.applicationId,
    }).rows;
    const identity = rows.filter((row) => row.TARGET_RECORD === 'identity');
    if (
      identity.length !== 1 ||
      identity[0]!.DB_UNIQUE_NAME !== env.databaseIdentity.dbUniqueName ||
      identity[0]!.SERVICE_NAME !== env.databaseIdentity.serviceName ||
      identity[0]!.PARSING_SCHEMA !== env.parsingSchema
    )
      throw new Fault(
        'TARGET_MISMATCH',
        `Connection ${env.readConnectionRef} does not match the database, service and parsing schema configured for ${name}.`,
        5,
        'conflict',
      );
    // Every request ends with a rollback (commit mode: a failed one), so the session must hold a
    // transaction. SQLcl's MCP server opens saved connections with JDBC auto-commit unless the
    // connection disables it.
    if (!data.transactional()) {
      const properties = savedConnectionProperties(connection.name);
      throw new Fault(
        'PREVIEW_AUTOCOMMIT_ON',
        `SQLcl saved connection ${connection.name} commits every statement (JDBC auto-commit), so the connected preview could not roll its requests back and did not start. ` +
          (properties
            ? `Add the line autoCommit=false to ${properties} (create the file if needed), then start the preview again.`
            : `Add autoCommit=false to the ojdbc.properties file of that saved connection, then start the preview again.`) +
          ' The offline preview (without env) is unaffected.',
        3,
        'blocked',
      );
    }
    if (rows.filter((row) => row.TARGET_RECORD === 'workspace').length !== 1)
      throw new Fault(
        'WORKSPACE_UNCONFIRMED',
        `Workspace ${env.workspace} is absent or inaccessible.`,
        4,
        'blocked',
      );
    const application = rows.find(
      (row) => row.TARGET_RECORD === 'application' && row.WORKSPACE === env.workspace,
    );
    const warnings: string[] = [];
    let apex: ConnectedOracle['apex'];
    if (application) {
      const items = data.query(
        `select item_name from apex_application_page_items where application_id = :P_APP_ID
         union
         select item_name from apex_application_items where application_id = :P_APP_ID`,
        { P_APP_ID: env.applicationId },
        20_000,
      );
      const pages = data.query(
        'select page_id from apex_application_pages where application_id = :P_APP_ID order by page_id',
        { P_APP_ID: env.applicationId },
        20_000,
      );
      apex = {
        applicationId: env.applicationId,
        items: new Set(items.rows.map((row) => String(row.ITEM_NAME).toUpperCase())),
        pages: pages.rows.map((row) => Number(row.PAGE_ID)),
      };
    } else
      warnings.push(
        `Application ${env.applicationId} is not installed in workspace ${env.workspace}; database code runs without an APEX session, so v() returns NULL`,
      );
    const autonomous = data.query(
      `select distinct type || ' ' || name unit from all_source
        where owner = :APEXREST_OWNER and upper(text) like '%AUTONOMOUS\\_TRANSACTION%' escape '\\'`,
      { APEXREST_OWNER: env.parsingSchema },
      200,
    );
    if (commit)
      warnings.push(
        `Commit mode: every successful request is committed to ${env.databaseIdentity.dbUniqueName}/${env.databaseIdentity.serviceName}; a failed request is rolled back`,
      );
    else {
      if (autonomous.rows.length)
        warnings.push(
          `Autonomous transactions commit even in the connected preview: ${autonomous.rows.map((row) => row.UNIT).join(', ')}`,
        );
      warnings.push(
        'Sequences advance and calls outside the database (mail, HTTP, jobs) are not undone by the rollback',
      );
    }
    warmUp(data, apex);
    data.endRequest();
    return {
      data,
      environment: name,
      target: `${env.databaseIdentity.dbUniqueName}/${env.databaseIdentity.serviceName}`,
      ...(apex ? { apex } : {}),
      ...(commit ? { commit } : {}),
      warnings,
    };
  } catch (error) {
    try {
      data.close();
    } catch {
      // The worker ends with the failed session.
    }
    throw error;
  }
}
