import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { managedHome, parse, refName } from './config.ts';
import type { Environment, ProjectContext } from './config.ts';
import type { Connection } from './connections.ts';
import {
  savedConnectionName,
  connectionReference,
  ordsCredentials,
  type OrdsCredentials,
} from './connections.ts';
import { canonical, contained, exists, hash, inventory, readJson, writeJson } from './fs.ts';
import { Fault } from './result.ts';
import { runProcess } from './process.ts';
import type { ProcessRequest, ProcessResult } from './process.ts';
import { sqlclConfig, type SqlclConfig } from './sqlcl-config.ts';
import { runSqlclMcp, type SqlclMcpRequest } from './sqlcl-mcp.ts';
import { runOrdsBridge, type OrdsBridgeJob } from './ords.ts';
export type Runner = (request: ProcessRequest) => Promise<ProcessResult>;
export function sqlclToken(value: string) {
  if (!value || /[\r\n\x00"&]/.test(value))
    throw new Fault(
      'INVALID_SQLCL_TOKEN',
      'SQLcl argument contains a forbidden quote, newline or substitution character.',
      2,
    );
  return '"' + value.replaceAll('\\', '/') + '"';
}
export function sqlLiteral(value: string) {
  if (/[\x00-\x1f]/.test(value) || value.length > 1024)
    throw new Fault('INVALID_SQL_LITERAL', 'Invalid SQL literal.', 2);
  return "'" + value.replaceAll("'", "''") + "'";
}
export function oracleDiagnostics(r: ProcessResult, mutation = false, format: 'text' | 'json' = 'text') {
  const stdout = r.stdout.replace(/\x1b\[[0-9;]*m/g, ''),
    stderr = r.stderr.replace(/\x1b\[[0-9;]*m/g, ''),
    output = stdout + '\n' + stderr;
  if (r.cancelled || r.timedOut || r.truncated)
    throw new Fault(
      r.truncated ? 'OUTPUT_LIMIT' : r.cancelled ? 'CANCELLED' : 'TIMEOUT',
      'SQLcl did not complete with a confirmed outcome.',
      6,
      mutation ? 'outcome_unknown' : 'cancelled',
    );
  let diagnostics = output;
  if (format === 'json') {
    // Error messages returned as data (for example an APEX activity log row)
    // are not SQLcl failures. Strip only rows of a decoded result envelope;
    // keep stderr, surrounding output and envelope error metadata observable.
    const start = stdout.indexOf('{'),
      end = stdout.lastIndexOf('}');
    try {
      const envelope = JSON.parse(stdout.slice(start, end + 1)) as {
        results?: { items?: unknown[] }[];
      };
      if (
        Array.isArray(envelope.results) &&
        envelope.results.length > 0 &&
        envelope.results.every((result) => Array.isArray(result.items))
      )
        diagnostics =
          stdout.slice(0, start) +
          JSON.stringify({
            ...envelope,
            results: envelope.results.map(({ items: _items, ...metadata }) => metadata),
          }) +
          stdout.slice(end + 1) +
          '\n' +
          stderr;
    } catch {
      // Malformed or command-error JSON receives the normal text diagnostics.
    }
  }
  if (/ORA-01017|ORA-28000|ORA-28001/i.test(diagnostics))
    throw new Fault('AUTHENTICATION_FAILED', 'Oracle authentication failed.', 4, 'blocked');
  if (/ORA-01031/i.test(diagnostics))
    throw new Fault('DB_PRIVILEGE', 'Oracle privileges are insufficient.', 4, 'blocked');
  if (
    r.code !== 0 ||
    /(?:ORA-|PLS-|SP2-|SQLCL-)[0-9]+|(?:^|\n)\s*(?:Error(?:\s|:)|Unknown command|Invalid command|Invalid option|Compilation failed|Validation failed)|not connected|Unable to|No APEXlang files/i.test(
      diagnostics,
    )
  )
    throw new Fault(
      'ORACLE_COMMAND_FAILED',
      output.trim().slice(0, 6000) || 'SQLcl exited without success.',
      1,
    );
  return output;
}
/**
 * SQLcl CLI restrict level for sessions that execute reviewed SQL files
 * (migrations, packages, restores, SQL tests) and application imports. Level 2
 * disables HOST/!/$/EDIT plus SPOOL/SAVE/STORE, so a script cannot run local
 * programs or write client files. apexrest's own wrappers need only SET,
 * WHENEVER, PROMPT, CONNECT and @/@@ (an Oracle SQL export and split scripts
 * use @@), which level 3 would disable. SQLcl apex commands work at level 2.
 */
export const SCRIPT_RESTRICT_LEVEL = '2';
export class OracleAdapter {
  private selectedTransport: Promise<SqlclConfig> | undefined;
  private selectedConnections = new Map<string, Promise<{ name?: string; ords?: OrdsCredentials }>>();
  private capabilityHelp: { key: string; help: string } | undefined;
  private pendingHelp: { key: string; signal: AbortSignal | undefined; result: Promise<string> }[] = [];
  constructor(
    private runner: Runner = runProcess,
    private executable = process.env.APEXREST_SQLCL ?? 'sql',
    private mcpRunner: (request: SqlclMcpRequest) => Promise<ProcessResult> = runSqlclMcp,
  ) {}
  async settings() {
    const file = path.join(managedHome(), 'runtime.json');
    const state = (await exists(file)) ? ((await readJson(file)) as { sqlcl?: string; java?: string }) : {};
    // Pin the transport for this operation, including plan/apply preflight and writes.
    const transport = await (this.selectedTransport ??= sqlclConfig());
    return {
      ...transport,
      executable: process.env.APEXREST_SQLCL ?? state.sqlcl ?? this.executable,
      javaHome:
        process.env.APEXREST_JAVA_HOME ??
        (state.java ? path.dirname(path.dirname(state.java)) : process.env.JAVA_HOME),
    };
  }
  async selectedConnection(connection: Connection) {
    const settings = await this.settings();
    const key = connectionReference(connection) ?? JSON.stringify(connection);
    let selected = this.selectedConnections.get(key);
    if (!selected) {
      selected = (async () => {
        if (settings.databaseTransport === 'ords') {
          if (settings.mode !== 'cli')
            throw new Fault('ORDS_CLI_REQUIRED', 'ORDS HTTP requires SQLcl CLI mode.', 3, 'blocked');
          return { ords: await ordsCredentials(connection) };
        }
        if (!connection.name)
          throw new Fault(
            'DIRECT_CONNECTION_REQUIRED',
            'Configure a direct SQLcl saved connection for this reference or select ORDS HTTP in plugin settings.',
            3,
            'blocked',
          );
        return { name: parse(savedConnectionName, connection.name) };
      })();
      this.selectedConnections.set(key, selected);
    }
    return selected;
  }
  async session(
    input: string,
    connection?: Connection,
    mutation = false,
    signal?: AbortSignal,
    cwd?: string,
    format: 'text' | 'json' = 'text',
    restrictLevel?: typeof SCRIPT_RESTRICT_LEVEL,
  ) {
    const work = cwd ?? (await this.stage());
    try {
      return await this.sessionIn(work, input, connection, mutation, signal, format, restrictLevel);
    } finally {
      if (!cwd) await this.discardStage(work);
    }
  }
  private async sessionIn(
    work: string,
    input: string,
    connection: Connection | undefined,
    mutation: boolean,
    signal: AbortSignal | undefined,
    format: 'text' | 'json',
    restrictLevel: typeof SCRIPT_RESTRICT_LEVEL | undefined,
  ) {
    const settings = await this.settings();
    if (mutation) await this.requireMutationSupport();
    const selected = connection ? await this.selectedConnection(connection) : undefined;
    const args = [
      '-S',
      '-L',
      ...(restrictLevel ? ['-R', restrictLevel] : []),
      ...(selected?.name ? ['-name', selected.name] : ['/nolog']),
    ];
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      SQLPATH: '',
      ORACLE_PATH: '',
      TNS_ADMIN: process.env.TNS_ADMIN,
      JAVA_HOME: settings.javaHome,
    };
    delete env.NODE_OPTIONS;
    delete env.JAVA_TOOL_OPTIONS;
    delete env._JAVA_OPTIONS;
    delete env.JDK_JAVA_OPTIONS;
    const preamble =
      'set define off\nset echo off\nset feedback off\n' +
      (settings.mode === 'mcp' && settings.mcpRestrictLevel === '4'
        ? ''
        : 'whenever oserror exit failure rollback\nwhenever sqlerror exit failure rollback\n');
    // Credentials are read from the plugin's private store and passed only on
    // stdin. Validation forbids command delimiters; quotes retain literal
    // spaces and substitution is disabled before CONNECT executes.
    const connect = selected?.ords
      ? `set history filter default connect\nconnect -orest -user "${selected.ords.username}" -password "${selected.ords.password}" -url "${selected.ords.url}"\n`
      : '';
    const marker = `APEXREST_COMPLETE_${randomUUID().replaceAll('-', '')}`;
    const request: ProcessRequest = {
      executable: settings.executable,
      args,
      cwd: work,
      env,
      input: preamble + connect + input + '\nexit\n',
      timeoutMs: 180000,
      ...(signal ? { signal } : {}),
    };
    const raw =
      settings.mode === 'mcp'
        ? await this.mcpRunner({
            ...request,
            // Let SQLcl apply its MCP default. In 26.1, explicit -R 4
            // also suppresses connmgr output, unlike the default MCP profile.
            args: settings.mcpRestrictLevel === '4' ? ['-mcp'] : ['-R', '1', '-mcp'],
            // CLI's final EXIT commits on success. Preserve that transaction
            // boundary before acknowledging a write over a persistent MCP session.
            input: preamble + input + (mutation ? '\ncommit;\n' : '\n') + `prompt ${marker}\n`,
            mutation,
            ...(selected?.name ? { connectionName: selected.name } : {}),
          })
        : await this.runner(request);
    const secret = selected?.ords?.password;
    // Internal JSON rows can legitimately equal a short password (for example
    // the schema name). Do not rewrite result data before parsing/identity
    // checks. Any thrown diagnostic is still redacted before it leaves here.
    const result =
      secret && format !== 'json'
        ? {
            ...raw,
            stdout: raw.stdout.replaceAll(secret, '[REDACTED]'),
            stderr: raw.stderr.replaceAll(secret, '[REDACTED]'),
          }
        : raw;
    let output: string;
    try {
      output = oracleDiagnostics(result, mutation, format);
    } catch (error) {
      if (secret && error instanceof Error) error.message = error.message.replaceAll(secret, '[REDACTED]');
      throw error;
    }
    if (settings.mode === 'mcp' && !output.split(/\r?\n/).some((line) => line.trim() === marker))
      throw new Fault(
        'SQLCL_MCP_INCOMPLETE',
        'SQLcl MCP did not confirm the complete command batch.',
        6,
        mutation ? 'outcome_unknown' : 'failed',
      );
    return { ...result, output: settings.mode === 'mcp' ? output.replace(marker, '').trim() : output, work };
  }
  async requireMutationSupport() {
    const settings = await this.settings();
    if (settings.databaseTransport === 'ords' && settings.mode !== 'cli')
      throw new Fault('ORDS_CLI_REQUIRED', 'ORDS HTTP requires SQLcl CLI mode.', 3, 'blocked');
    if (settings.mode === 'mcp' && settings.mcpRestrictLevel !== '1')
      throw new Fault(
        'SQLCL_MCP_RESTRICTED',
        'SQLcl MCP restrict level 4 cannot provide fail-stop scripts for writes. Explicitly select MCP restrict level 1 in SQLcl settings for authorized deployment/scripts.',
        3,
        'blocked',
      );
  }
  async stage() {
    const root = path.join(managedHome(), 'staging');
    await mkdir(root, { recursive: true, mode: 0o700 });
    return mkdtemp(path.join(root, 'oracle-'));
  }
  /** Remove a private staging directory created by stage(). Other paths are never removed. */
  async discardStage(stage: string | undefined) {
    if (!stage) return;
    const relative = path.relative(path.join(managedHome(), 'staging'), path.resolve(stage));
    if (!/^oracle-[^/\\]+$/.test(relative)) return;
    await rm(stage, { recursive: true, force: true });
  }
  async ordsBridge(job: OrdsBridgeJob, connection?: Connection, signal?: AbortSignal, stage?: string) {
    const settings = await this.settings();
    const selected = connection ? await this.selectedConnection(connection) : undefined;
    if (connection && !selected?.ords)
      throw new Fault(
        'ORDS_CONNECTION_REQUIRED',
        'Select the ORDS transport for this operation.',
        3,
        'blocked',
      );
    const work = stage ?? (await this.stage());
    try {
      return await runOrdsBridge(settings, job, selected?.ords, work, signal, this.runner);
    } finally {
      if (!stage) await this.discardStage(work);
    }
  }
  private async capabilityKey(settings: Awaited<ReturnType<OracleAdapter['settings']>>, version: string) {
    // Only cache bundled help for an identifiable SQLcl installation. Bare PATH
    // commands and custom layouts retain fresh help probes on every call.
    if (!path.isAbsolute(settings.executable)) return;
    try {
      const executable = await realpath(settings.executable);
      const bin = path.dirname(executable);
      if (path.basename(bin) !== 'bin') return;
      const files: Record<string, string[]> = {};
      const walk = async (directory: string): Promise<void> => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name);
          if (entry.isSymbolicLink()) throw new Error('Untracked SQLcl dependency');
          if (entry.isDirectory()) await walk(file);
          else if (entry.isFile()) {
            const info = await stat(file, { bigint: true });
            files[file] = [info.dev, info.ino, info.mode, info.size, info.mtimeNs, info.ctimeNs].map(String);
          } else throw new Error('Untracked SQLcl dependency');
        }
      };
      await walk(bin);
      await walk(path.join(path.dirname(bin), 'lib'));
      return hash(canonical({ ...settings, executable, version, files }));
    } catch {
      // A cache miss must never replace the actual capability check.
      return;
    }
  }
  async capabilities(signal?: AbortSignal) {
    const settings = await this.settings();
    const versionStage = await this.stage();
    let version: ProcessResult;
    try {
      version = await this.runner({
        executable: settings.executable,
        args: ['-version'],
        cwd: versionStage,
        env: { ...process.env, JAVA_HOME: settings.javaHome },
        timeoutMs: 15000,
        ...(signal ? { signal } : {}),
      });
    } finally {
      await this.discardStage(versionStage);
    }
    oracleDiagnostics(version);
    const currentVersion = version.stdout.trim();
    const key = await this.capabilityKey(settings, currentVersion);
    let help: string;
    if (key && this.capabilityHelp?.key === key) help = this.capabilityHelp.help;
    else {
      const probe = async () => {
        const help = (await this.session('help apex', undefined, false, signal)).output;
        this.capabilityHelp =
          key && key === (await this.capabilityKey(settings, currentVersion)) ? { key, help } : undefined;
        return help;
      };
      if (!key) help = await probe();
      else {
        // Share only calls with the same cancellation lifetime. One cancelled
        // caller must never cancel an unrelated caller's capability probe.
        let pending = this.pendingHelp.find((entry) => entry.key === key && entry.signal === signal);
        if (!pending) {
          pending = { key, signal, result: probe() };
          this.pendingHelp.push(pending);
        }
        try {
          help = await pending.result;
        } finally {
          this.pendingHelp = this.pendingHelp.filter((entry) => entry !== pending);
        }
      }
    }
    if (signal?.aborted) throw new Fault('CANCELLED', 'Capability check cancelled.', 6, 'cancelled');
    const commands = Object.fromEntries(
      ['generate', 'export', 'validate', 'import'].map((command) => [
        command,
        new RegExp('\\b' + command + '\\b', 'i').test(help),
      ]),
    );
    return { version: currentVersion, commands, helpHash: hash(help), help };
  }
  async requireCapability(name: 'generate' | 'export' | 'validate' | 'import', signal?: AbortSignal) {
    const capabilities = await this.capabilities(signal);
    if (!capabilities.commands[name])
      throw new Fault('UNSUPPORTED_CAPABILITY', `This SQLcl does not advertise apex ${name}.`, 3, 'blocked');
    return { version: capabilities.version, helpHash: capabilities.helpHash };
  }
  async generate(name: string, alias: string) {
    const compiler = await this.requireCapability('generate');
    const stage = await this.stage();
    const result = await this.session(
      `apex generate -name ${sqlclToken(name)} -alias ${sqlclToken(parse(refName, alias))} -dir ${sqlclToken(stage)}`,
      undefined,
      false,
      undefined,
      stage,
    );
    const directory = await this.findApplication(stage);
    return { directory, compiler, output: result.output, files: await inventory(directory) };
  }
  async findApplication(root: string): Promise<string> {
    if (await exists(path.join(root, 'application.apx'))) return root;
    const found: string[] = [];
    for (const entry of await readdir(root, { withFileTypes: true }))
      if (entry.isDirectory()) {
        const dir = path.join(root, entry.name);
        if (await exists(path.join(dir, 'application.apx'))) found.push(dir);
        else
          for (const sub of await readdir(dir, { withFileTypes: true }))
            if (sub.isDirectory() && (await exists(path.join(dir, sub.name, 'application.apx'))))
              found.push(path.join(dir, sub.name));
      }
    if (found.length !== 1)
      throw new Fault(
        'ORACLE_OUTPUT_MISSING',
        'Expected exactly one generated/exported APEXlang application.',
        1,
      );
    return found[0]!;
  }
  async validate(source: string, signal?: AbortSignal) {
    const compiler = await this.requireCapability('validate', signal);
    const before = await inventory(source);
    if (!before['.apex/apexlang.json'])
      throw new Fault(
        'MMD_METADATA_REQUIRED',
        'Preserve Oracle-generated .apex/apexlang.json before validation.',
        3,
      );
    const stage = await this.stage(),
      copy = path.join(stage, 'application');
    let result;
    try {
      await cp(source, copy, { recursive: true });
      result = await this.session(
        `apex validate -input ${sqlclToken(copy)}`,
        undefined,
        false,
        signal,
        stage,
      );
    } finally {
      await this.discardStage(stage);
    }
    if (!compilerSucceeded(result.output))
      throw new Fault(
        'VALIDATION_UNCONFIRMED',
        result.output.slice(0, 4000) || 'Compiler returned no success marker.',
        1,
      );
    if (canonical(before) !== canonical(await inventory(source)))
      throw new Fault('SOURCE_DRIFT', 'Source changed during validation.', 5);
    return {
      status: 'passed',
      compiler,
      mmd: JSON.parse(await readFile(path.join(source, '.apex/apexlang.json'), 'utf8')) as unknown,
      sourceDigest: hash(canonical(before)),
      output: result.output,
    };
  }
  async exportApplication(env: Environment, connection: Connection, format: 'APEXLANG' | 'SQL' = 'APEXLANG') {
    const compiler = await this.requireCapability('export');
    const stage = await this.stage();
    const ords = (await this.settings()).databaseTransport === 'ords';
    const exportRoot = ords ? path.join(stage, 'export') : stage;
    const result = ords
      ? {
          output: String(
            (
              await this.ordsBridge(
                {
                  operation: 'export',
                  applicationId: env.applicationId,
                  exportType: format,
                  split: format === 'APEXLANG',
                  outputDirectory: exportRoot,
                },
                connection,
                undefined,
                stage,
              )
            ).message ?? 'Export successful',
          ),
        }
      : await this.session(
          `apex export -applicationid ${env.applicationId} -exptype ${format} -skipExportDate -expOriginalIds -dir ${sqlclToken(stage)}`,
          connection,
          false,
          undefined,
          stage,
        );
    const directory = format === 'APEXLANG' ? await this.findApplication(exportRoot) : exportRoot;
    const files = await inventory(directory);
    if (
      !Object.keys(files).length ||
      (format === 'SQL' && !Object.keys(files).some((f) => f.endsWith('.sql')))
    )
      throw new Fault('EMPTY_BACKUP', 'Oracle export produced no usable files.', 1);
    // Callers own `stage` and remove it with discardStage() once copied or compared.
    return {
      directory,
      files,
      digest: hash(canonical(files)),
      format,
      compiler,
      output: result.output,
      stage,
    };
  }
  async savedConnections(signal?: AbortSignal) {
    const marker = `APEXREST_CONNECTIONS_${randomUUID().replaceAll('-', '')}`;
    const result = await this.session(
      `prompt ${marker}_BEGIN\nconnmgr list -flat\nprompt ${marker}_END`,
      undefined,
      false,
      signal,
    );
    const lines = result.output.split(/\r?\n/).map((line) => line.trim());
    const start = lines.indexOf(`${marker}_BEGIN`),
      end = lines.indexOf(`${marker}_END`);
    if (start < 0 || end <= start)
      throw new Fault(
        'CONNECTION_LIST_UNCONFIRMED',
        'SQLcl did not return a complete saved connection list.',
        3,
      );
    const names = [...new Set(lines.slice(start + 1, end).filter(Boolean))];
    return {
      source: 'sqlcl-store',
      connections: names.map((name) => ({ name: parse(savedConnectionName, name) })),
    };
  }
  async jsonQuery(
    sql: string,
    connection: Connection,
    bindings: Record<string, string | number> = {},
    signal?: AbortSignal,
  ) {
    const ords = (await this.settings()).databaseTransport === 'ords';
    const preamble = Object.entries(bindings)
      .map(([key, value]) => {
        if (!/^p_[a-z_]+$/.test(key)) throw new Fault('INVALID_BIND', 'Invalid internal bind name.', 2);
        const declaration = `variable ${key} ${typeof value === 'number' ? 'number' : 'varchar2(1024)'}`;
        const literal = typeof value === 'number' ? value : sqlLiteral(value);
        // Initialize OREST bind values in SQLcl itself. A separate EXEC for an
        // OUT bind fails with ORA-17283 in the REST driver before the SELECT.
        if (ords) {
          if (typeof value === 'string' && /[\x00-\x1f\x7f-\x9f]/.test(value))
            throw new Fault(
              'INVALID_BIND',
              'ORDS metadata bind values cannot contain control characters.',
              2,
            );
          // VARIABLE removes its outer quotes without SQL string unescaping.
          return `${declaration} = ${typeof value === 'number' ? value : `'${value}'`}`;
        }
        return `${declaration}\nexec :${key} := ${literal};`;
      })
      .join('\n');
    const result = await this.session(
      `${preamble}\nset sqlformat json\n${sql};`,
      connection,
      false,
      signal,
      undefined,
      'json',
    );
    const start = result.output.indexOf('{'),
      end = result.output.lastIndexOf('}');
    if (start < 0) throw new Fault('EMPTY_QUERY_RESULT', 'SQLcl did not return its JSON result envelope.', 1);
    let json: unknown;
    try {
      json = JSON.parse(result.output.slice(start, end + 1));
    } catch {
      throw new Fault('INVALID_ORACLE_JSON', 'Cannot decode Oracle metadata result.', 1);
    }
    const resultSets = (json as { results?: { items?: Record<string, unknown>[] }[] }).results;
    if (!Array.isArray(resultSets) || !Array.isArray(resultSets[0]?.items))
      throw new Fault('INVALID_ORACLE_JSON', 'SQLcl result has no items collection.', 1);
    return resultSets[0]!.items!;
  }
  async identity(connection: Connection, signal?: AbortSignal) {
    const rows = await this.jsonQuery(
      "select sys_context('USERENV','DB_UNIQUE_NAME') db_unique_name, sys_context('USERENV','SERVICE_NAME') service_name, sys_context('USERENV','CURRENT_SCHEMA') parsing_schema from dual",
      connection,
      {},
      signal,
    );
    if (rows.length !== 1) throw new Fault('IDENTITY_UNCONFIRMED', 'Database identity was not confirmed.', 3);
    return rows[0]!;
  }
  async verifyTarget(env: Environment, connection: Connection) {
    // One read-only statement observes all target identifiers in the same live
    // SQLcl session. Never reuse this result between plan/apply/write checks.
    const rows = await this.jsonQuery(
      `select 'identity' target_record,
        sys_context('USERENV','DB_UNIQUE_NAME') db_unique_name,
        sys_context('USERENV','SERVICE_NAME') service_name,
        sys_context('USERENV','CURRENT_SCHEMA') parsing_schema,
        null workspace_id, null workspace, null application_id, null alias, null owner
       from dual
       union all
       select 'workspace', null, null, null, workspace_id, workspace, null, null, null
       from apex_workspaces where workspace = :p_workspace
       union all
       select 'application', null, null, null, null, workspace, application_id, alias, owner
       from apex_applications where application_id = :p_app_id`,
      connection,
      { p_workspace: env.workspace, p_app_id: env.applicationId },
    );
    const identities = rows.filter((row) => row.target_record === 'identity');
    if (identities.length !== 1)
      throw new Fault('IDENTITY_UNCONFIRMED', 'Database identity was not confirmed.', 3);
    const identity = {
      db_unique_name: identities[0]!.db_unique_name,
      service_name: identities[0]!.service_name,
      parsing_schema: identities[0]!.parsing_schema,
    };
    if (
      identity.db_unique_name !== env.databaseIdentity.dbUniqueName ||
      identity.service_name !== env.databaseIdentity.serviceName ||
      identity.parsing_schema !== env.parsingSchema
    )
      throw new Fault(
        'TARGET_MISMATCH',
        'Connection does not match the configured database/service/schema.',
        5,
        'conflict',
      );
    const workspaces = rows
      .filter((row) => row.target_record === 'workspace')
      .map((row) => ({ workspace_id: row.workspace_id, workspace: row.workspace }));
    if (workspaces.length !== 1)
      throw new Fault(
        'WORKSPACE_UNCONFIRMED',
        'Configured workspace is absent or inaccessible.',
        4,
        'blocked',
      );
    const applications = rows
      .filter((row) => row.target_record === 'application')
      .map((row) => ({
        application_id: row.application_id,
        alias: row.alias,
        owner: row.owner,
        workspace: row.workspace,
      }));
    if (
      applications.length > 1 ||
      applications.some((a) => a.workspace !== env.workspace || a.owner !== env.parsingSchema)
    )
      throw new Fault(
        'APPLICATION_TARGET_MISMATCH',
        'Application belongs to a different workspace or parsing schema.',
        5,
      );
    return { identity, workspace: workspaces[0]!, application: applications[0] ?? null };
  }
  async applicationMetadata(env: Environment, connection: Connection) {
    const rows = await this.jsonQuery(
      `select to_char(last_updated_on, 'YYYY-MM-DD"T"HH24:MI:SS', 'NLS_DATE_LANGUAGE=American') last_updated_on,
        last_updated_by from apex_applications
        where application_id = :p_app_id and workspace = :p_workspace and owner = :p_owner`,
      connection,
      { p_app_id: env.applicationId, p_workspace: env.workspace, p_owner: env.parsingSchema },
    );
    if (
      rows.length !== 1 ||
      !Object.hasOwn(rows[0]!, 'last_updated_on') ||
      !Object.hasOwn(rows[0]!, 'last_updated_by')
    )
      throw new Fault(
        'SYNC_METADATA_UNCONFIRMED',
        'Application update metadata is absent or inaccessible.',
        5,
      );
    const row = rows[0]!;
    if ([row.last_updated_on, row.last_updated_by].some((v) => v !== null && typeof v !== 'string'))
      throw new Fault('SYNC_METADATA_UNCONFIRMED', 'Unexpected application update metadata.', 5);
    return {
      lastUpdatedOn: row.last_updated_on as string | null,
      lastUpdatedBy: row.last_updated_by as string | null,
    };
  }
  async nativeDeployment(ctx: ProjectContext, env: Environment, source: string) {
    const output = path.join(await this.stage(), 'deployment.json');
    const defaults = path.join(source, 'deployments/default.json');
    const native = (await exists(defaults))
      ? (JSON.parse(await readFile(defaults, 'utf8')) as Record<string, unknown>)
      : {};
    const oldApp = (native.app ?? {}) as Record<string, unknown>;
    await writeJson(output, {
      ...native,
      app: {
        ...oldApp,
        id: env.applicationId,
        alias: ctx.config.application.alias,
        databaseSession: { ...((oldApp.databaseSession as object) ?? {}), parsingSchema: env.parsingSchema },
      },
      workspace: { name: env.workspace },
    });
    return output;
  }
  async importApplication(
    ctx: ProjectContext,
    env: Environment,
    connection: Connection,
    source: string,
    signal?: AbortSignal,
  ) {
    await this.requireCapability('import', signal);
    const config = await this.nativeDeployment(ctx, env, source);
    try {
      return await this.importWith(env, connection, source, config, signal);
    } finally {
      await this.discardStage(path.dirname(config));
    }
  }
  private async importWith(
    env: Environment,
    connection: Connection,
    source: string,
    config: string,
    signal?: AbortSignal,
  ) {
    if ((await this.settings()).databaseTransport === 'ords') {
      await this.requireMutationSupport();
      const result = await this.ordsBridge(
        {
          operation: 'import',
          input: source,
          deployment: config,
          applicationId: env.applicationId,
          workspace: env.workspace,
          parsingSchema: env.parsingSchema,
        },
        connection,
        signal,
      );
      return String(result.message ?? 'Import successful');
    }
    const result = await this.session(
      `apex import -input ${sqlclToken(source)} -deployment ${sqlclToken(config)} -workspace ${sqlclToken(env.workspace)} -schema ${sqlclToken(env.parsingSchema)} -id ${env.applicationId}`,
      connection,
      true,
      signal,
      undefined,
      'text',
      SCRIPT_RESTRICT_LEVEL,
    );
    if (!/import.*(?:success|complete)|successfully.*import/is.test(result.output))
      throw new Fault(
        'IMPORT_UNCONFIRMED',
        'Import returned without a tested success marker; reconcile the target.',
        6,
        'outcome_unknown',
      );
    return result.output;
  }
  async restoreApplication(env: Environment, connection: Connection, file: string, signal?: AbortSignal) {
    const setup = `begin\n apex_application_install.set_workspace(${sqlLiteral(env.workspace)});\n apex_application_install.set_schema(${sqlLiteral(env.parsingSchema)});\n apex_application_install.set_application_id(${env.applicationId});\nend;\n/\n`;
    if ((await this.settings()).databaseTransport === 'ords') {
      await this.requireMutationSupport();
      // Keep installation context and the complete non-split backup in one
      // server-side script request. Do not execute the setup as a separate call.
      const stage = await this.stage();
      try {
        const input = path.join(stage, 'restore.sql');
        await (await import('./fs.ts')).atomicWrite(input, setup + (await readFile(file, 'utf8')));
        return await this.ordsBridge({ operation: 'script', input }, connection, signal, stage);
      } finally {
        await this.discardStage(stage);
      }
    }
    return this.session(
      setup + `@${sqlclToken(file)}`,
      connection,
      true,
      signal,
      undefined,
      'text',
      SCRIPT_RESTRICT_LEVEL,
    );
  }
}
/**
 * SQLcl reports compiler errors as text while still exiting 0. Success needs a
 * success marker and no error indication, including counted summaries such as
 * "Validation completed with 3 errors".
 */
export function compilerSucceeded(output: string) {
  const success =
    /validat(?:ion|ed).*?(?:success|complete)|successfully.*validat|compil(?:ation|ed).*?(?:success|complete)|successfully.*compil/is.test(
      output,
    );
  const counted = [...output.matchAll(/\b(\d+)\s+(?:errors?|failures?)\b/gi)].some(
    (match) => Number(match[1]) > 0,
  );
  const failed =
    /(?:^|\n)\s*(?:error\b|errors?:)|\bwith\s+errors?\b|compile\s+errors?|\bfail(?:ed|ure)\b|\bunsuccessful\b|\bnot\s+successful\b/i.test(
      output,
    );
  return success && !counted && !failed;
}
export async function installSources(source: string, root: string, destination: string) {
  const target = await contained(root, destination);
  if (await exists(target))
    throw new Fault(
      'LOCAL_EDITS_CONFLICT',
      'Destination already exists; export remains in staging. Review and merge explicitly.',
      5,
      'conflict',
    );
  await mkdir(path.dirname(target), { recursive: true });
  const staging = await mkdtemp(path.join(path.dirname(target), '.apexrest-copy-'));
  await inventory(source);
  await cp(source, staging, { recursive: true });
  await rename(staging, target);
  return { directory: target, files: await inventory(target) };
}
