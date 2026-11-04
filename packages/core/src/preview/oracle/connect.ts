import { environment, isProductionTarget, loadProject } from '../../config.ts';
import { resolveConnection } from '../../connections.ts';
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

/**
 * Opens the connected preview for one DEV/QA/TEST environment of apexrest.json:
 * refuses production, requires a SQLcl saved connection, and confirms the
 * database, service, parsing schema and workspace exactly as deployment does.
 */
export async function connectOracle(
  root: string,
  name: string,
  link?: (settings: WorkerSettings) => OracleLink,
): Promise<ConnectedOracle> {
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
  const settings = await workerSettings(connection.name);
  const data = new OracleAppData(link ? link(settings) : new WorkerBridge({ settings }), env.parsingSchema);
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
    if (autonomous.rows.length)
      warnings.push(
        `Autonomous transactions commit even in the connected preview: ${autonomous.rows.map((row) => row.UNIT).join(', ')}`,
      );
    warnings.push(
      'Sequences advance and calls outside the database (mail, HTTP, jobs) are not undone by the rollback',
    );
    warmUp(data, apex);
    data.endRequest();
    return {
      data,
      environment: name,
      target: `${env.databaseIdentity.dbUniqueName}/${env.databaseIdentity.serviceName}`,
      ...(apex ? { apex } : {}),
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
