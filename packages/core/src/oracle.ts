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
import { runPooledSqlcl } from './sqlcl-session.ts';
import { runOrdsBridge, type OrdsBridgeJob } from './ords.ts';
import {
  evaluatePartialImportCompatibility,
  sourceMmdVersion,
  type TargetVersions,
} from './compatibility.ts';
import { parseCodeScan, type AdvisoryFinding } from './upgrade-audit.ts';
import { localConnectionEndpoint, localServerHost } from './locality.ts';
import { scopedExportFile, supportedFile } from './partial-import.ts';
const targetIdentitySql = `select 'identity' target_record,
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
       from apex_applications where application_id = :p_app_id`;
const targetVersionSql =
  "select (select version_no from apex_release) apex_version, version_full database_version from product_component_version where product like 'Oracle%Database%'";
export type Runner = (request: ProcessRequest) => Promise<ProcessResult>;
export interface SqlclCapabilities {
  version: string;
  commands: Record<string, boolean>;
  helpHash: string;
  help: string;
}
// One capability probe per SQLcl installation per process. The key covers the
// launcher, the compiler libraries and the Java runtime; every adapter in the
// process shares it, so an import after a validate never re-probes.
const capabilityCache = new Map<string, Promise<SqlclCapabilities>>();
const importHelpCache = new Map<string, Promise<string>>();
export function resetCapabilityCache() {
  capabilityCache.clear();
  importHelpCache.clear();
}
function raceCancellation<T>(promise: Promise<T>, signal: AbortSignal | undefined, message: string) {
  const cancelled = () => new Fault('CANCELLED', message, 6, 'cancelled');
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(cancelled());
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(cancelled());
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
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
    // are not SQLcl failures. Strip only rows of decoded result envelopes;
    // keep stderr, surrounding output and envelope error metadata observable.
    diagnostics = stripEnvelopeRows(stdout) + '\n' + stderr;
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
/** Top-level JSON documents in SQLcl output, as [start, end) offsets. */
export function jsonDocuments(text: string) {
  const spans: [number, number][] = [];
  let depth = 0,
    start = -1,
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '\\') i++;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{') {
      if (depth++ === 0) start = i;
    } else if (c === '}' && depth > 0 && --depth === 0) spans.push([start, i + 1]);
  }
  return spans;
}
function stripEnvelopeRows(stdout: string) {
  let result = '',
    cursor = 0;
  for (const [start, end] of jsonDocuments(stdout)) {
    let replacement = stdout.slice(start, end);
    try {
      const envelope = JSON.parse(replacement) as { results?: { items?: unknown[] }[] };
      if (
        Array.isArray(envelope.results) &&
        envelope.results.length > 0 &&
        envelope.results.every((entry) => Array.isArray(entry.items))
      )
        replacement = JSON.stringify({
          ...envelope,
          results: envelope.results.map(({ items: _items, ...metadata }) => metadata),
        });
    } catch {
      // Malformed or command-error JSON receives the normal text diagnostics.
    }
    result += stdout.slice(cursor, start) + replacement;
    cursor = end;
  }
  return result + stdout.slice(cursor);
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
    isolated = false,
  ) {
    if (restrictLevel && (await this.settings()).mode === 'mcp')
      throw new Fault(
        'SQLCL_MCP_SCRIPT_RESTRICT_UNAVAILABLE',
        'Restricted script operations require SQLcl CLI mode with -R 2; MCP does not provide an equivalent restriction.',
        3,
        'blocked',
      );
    const work = cwd ?? (await this.stage());
    try {
      return await this.sessionIn(work, input, connection, mutation, signal, format, restrictLevel, isolated);
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
    isolated: boolean,
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
    // Persistent engine: SQLcl executes a piped script only after stdin EOF, so
    // reuse runs through SQLcl's server mode (sqlcl-session.ts). CLI mode pools
    // offline (/nolog) work such as generate/validate/help; connected CLI
    // sessions (saved name, ORDS) keep one process per call. MCP mode pools its
    // server per saved connection. Injected test runners keep the per-call path.
    const pooled =
      !isolated &&
      (settings.mode === 'mcp'
        ? this.mcpRunner === runSqlclMcp
        : this.runner === runProcess && !selected && settings.databaseTransport !== 'ords');
    const viaServer = settings.mode === 'mcp' || pooled;
    const raw = viaServer
      ? await (pooled ? runPooledSqlcl : this.mcpRunner)({
          ...request,
          cwd: pooled ? await this.sessionHome() : work,
          // Let SQLcl apply its MCP default. In 26.1, explicit -R 4
          // also suppresses connmgr output, unlike the default MCP profile.
          args:
            settings.mode === 'mcp'
              ? settings.mcpRestrictLevel === '4'
                ? ['-mcp']
                : ['-R', '1', '-mcp']
              : [...(restrictLevel ? ['-R', restrictLevel] : []), '-mcp'],
          // CLI's final EXIT commits on success. Preserve that transaction
          // boundary before acknowledging a write over a persistent session.
          input:
            (settings.mode === 'cli' ? preamble.replace(/exit failure rollback/g, 'continue') : preamble) +
            // Persistent servers keep SET state between batches; start neutral.
            (selected?.name
              ? "rollback;\nbegin dbms_session.reset_package; execute immediate 'alter session set current_schema = ' || dbms_assert.enquote_name(sys_context('USERENV', 'SESSION_USER'), false); end;\n/\n"
              : '') +
            'set serveroutput off\nset sqlformat default\n' +
            input +
            (mutation ? '\ncommit;\n' : '\n') +
            `prompt ${marker}\n`,
          mutation,
          completionMarker: marker,
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
    if (viaServer && !output.split(/\r?\n/).some((line) => line.trim() === marker))
      throw new Fault(
        'SQLCL_MCP_INCOMPLETE',
        'SQLcl MCP did not confirm the complete command batch.',
        6,
        mutation ? 'outcome_unknown' : 'failed',
      );
    return { ...result, output: viaServer ? output.replace(marker, '').trim() : output, work };
  }
  /** Working directory of pooled SQLcl servers: a durable private directory, never a per-call stage. */
  async sessionHome() {
    const root = path.join(managedHome(), 'staging');
    await mkdir(root, { recursive: true, mode: 0o700 });
    return root;
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
  private async capabilityKey(settings: Awaited<ReturnType<OracleAdapter['settings']>>) {
    // Only cache for an identifiable SQLcl installation. Bare PATH commands and
    // custom layouts retain fresh probes on every call. A few stats replace the
    // former bin/lib walk: the launcher, the lib directory and the APEX jars.
    if (!path.isAbsolute(settings.executable)) return;
    try {
      const executable = await realpath(settings.executable);
      const bin = path.dirname(executable);
      if (path.basename(bin) !== 'bin') return;
      const lib = path.join(path.dirname(bin), 'lib');
      const mark = async (file: string, required: boolean) => {
        try {
          const info = await stat(file, { bigint: true });
          return [info.dev, info.ino, info.mode, info.size, info.mtimeNs, info.ctimeNs].map(String);
        } catch (error) {
          if (required) throw error;
          return 'absent';
        }
      };
      const marks = {
        executable: await mark(executable, true),
        lib: await mark(lib, true),
        apex: await mark(path.join(lib, 'dbtools-apex.jar'), false),
        apexlang: await mark(path.join(lib, 'apexlang-compiler.jar'), false),
        ext: await mark(path.join(lib, 'ext'), false),
        extApex: await mark(path.join(lib, 'ext/dbtools-apex.jar'), false),
        extApexlang: await mark(path.join(lib, 'ext/apexlang-compiler.jar'), false),
      };
      const { executable: _executable, ...rest } = settings;
      return hash(canonical({ ...rest, executable, marks }));
    } catch {
      // A cache miss must never replace the actual capability check.
      return;
    }
  }
  private async probeCapabilities(
    settings: Awaited<ReturnType<OracleAdapter['settings']>>,
    key: string | undefined,
  ): Promise<SqlclCapabilities> {
    const versionStage = await this.stage();
    let version: ProcessResult;
    try {
      version = await this.runner({
        executable: settings.executable,
        args: ['-version'],
        cwd: versionStage,
        env: { ...process.env, JAVA_HOME: settings.javaHome },
        timeoutMs: 15000,
      });
    } finally {
      await this.discardStage(versionStage);
    }
    oracleDiagnostics(version);
    const help = (await this.session('help apex')).output;
    // An installation replaced during the probe must not keep this answer.
    if (key && key !== (await this.capabilityKey(settings))) capabilityCache.delete(key);
    const commands = Object.fromEntries(
      ['generate', 'export', 'validate', 'import'].map((command) => [
        command,
        new RegExp('\\b' + command + '\\b', 'i').test(help),
      ]),
    );
    return { version: version.stdout.trim(), commands, helpHash: hash(help), help };
  }
  async capabilities(signal?: AbortSignal) {
    const settings = await this.settings();
    const key = await this.capabilityKey(settings);
    let pending = key ? capabilityCache.get(key) : undefined;
    if (!pending) {
      // The shared probe runs without any caller's cancellation: one cancelled
      // caller must never cancel an unrelated caller's capability check.
      pending = this.probeCapabilities(settings, key);
      if (key) {
        capabilityCache.set(key, pending);
        pending.catch(() => {
          if (capabilityCache.get(key) === pending) capabilityCache.delete(key);
        });
      } else pending.catch(() => {});
    }
    return raceCancellation(pending, signal, 'Capability check cancelled.');
  }
  async requireCapability(name: 'generate' | 'export' | 'validate' | 'import', signal?: AbortSignal) {
    const capabilities = await this.capabilities(signal);
    if (!capabilities.commands[name])
      throw new Fault('UNSUPPORTED_CAPABILITY', `This SQLcl does not advertise apex ${name}.`, 3, 'blocked');
    return { version: capabilities.version, helpHash: capabilities.helpHash };
  }
  /** Inspect selected-file support without connecting or trusting the generic APEX help. */
  async importHelp(signal?: AbortSignal) {
    const key = await this.capabilityKey(await this.settings());
    let pending = key ? importHelpCache.get(key) : undefined;
    if (!pending) {
      pending = this.session('help apex import').then((result) =>
        result.output.replace(/\x1b\[[0-9;]*m/g, ''),
      );
      if (key) {
        importHelpCache.set(key, pending);
        pending.catch(() => importHelpCache.delete(key));
      }
    }
    return raceCancellation(pending, signal, 'Import capability check cancelled.');
  }
  async partialImportCapabilities(source: string, target: TargetVersions, signal?: AbortSignal) {
    const compiler = await this.requireCapability('import', signal);
    const settings = await this.settings();
    const help = await this.importHelp(signal);
    return evaluatePartialImportCompatibility({
      ...target,
      compilerVersion: compiler.version,
      mmdVersion: await sourceMmdVersion(source),
      importFiles: /(?:^|\s)-files(?:\s|\|)/m.test(help),
      mode: settings.mode,
      databaseTransport: settings.databaseTransport ?? 'direct',
      helpHash: hash(help),
    });
  }
  async codeScan(
    source: string,
    signal?: AbortSignal,
  ): Promise<{
    status: 'advisory' | 'unavailable';
    findings: AdvisoryFinding[];
    reason?: string;
  }> {
    const compiler = await this.capabilities(signal);
    if (!/Release 26\.3\./.test(compiler.version))
      return {
        status: 'unavailable',
        findings: [],
        reason: 'APEXlang CodeScan is qualified only for SQLcl 26.3.',
      };
    const stage = await this.stage(),
      copy = path.join(stage, 'application');
    try {
      await cp(source, copy, { recursive: true });
      const help = (await this.session('help codescan', undefined, false, signal)).output;
      if (!/\.apx\b/i.test(help) || !/-extensions\b/i.test(help))
        return {
          status: 'unavailable',
          findings: [],
          reason: 'Selected SQLcl does not advertise APEXlang CodeScan.',
        };
      const result = await this.session(
        `codescan -path ${sqlclToken(copy)} -extensions apx -format json`,
        undefined,
        false,
        signal,
      );
      return { status: 'advisory', findings: parseCodeScan(result.output, copy) };
    } catch (error) {
      if (signal?.aborted || (error instanceof Fault && error.code === 'CANCELLED')) throw error;
      return {
        status: 'unavailable',
        findings: [],
        reason: error instanceof Error ? error.message : 'CodeScan did not complete.',
      };
    } finally {
      await this.discardStage(stage);
    }
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
      'text',
      undefined,
      // SQLcl 26.3 rejects freshly generated MMD when generation and validation
      // share a JVM. The cause is in the vendor process state. Keep
      // generation disposable; do not close pools used by other callers.
      /Release 26\.3\./.test(compiler.version),
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
    } catch (error) {
      // Compile errors are text with exit code 0 that the session classifies
      // as a failed command; a parsed report becomes a validation failure.
      if (error instanceof Fault && error.code === 'ORACLE_COMMAND_FAILED' && !error.details) {
        const details = await compilerDetails(error.message, source);
        if (details) throw new Fault('VALIDATION_FAILED', error.message, 1, 'failed', details);
      }
      throw error;
    } finally {
      await this.discardStage(stage);
    }
    if (!compilerSucceeded(result.output)) throw await compilerFault(result.output, source);
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
  /** Native page export; shared files use an explicitly bound full APEXlang observation. */
  async exportSelection(
    env: Environment,
    connection: Connection,
    selected: string[],
    source: string,
    knownFiles: Record<string, string> = {},
    exportScope: 'selected' | 'full' = 'selected',
  ) {
    if (
      !selected.length ||
      new Set(selected).size !== selected.length ||
      selected.some((file) => !(exportScope === 'selected' ? scopedExportFile(file) : supportedFile(file)))
    )
      throw new Fault(
        'PARTIAL_EXPORT_UNSUPPORTED',
        'Selection has no qualified native component export mapping.',
        3,
      );
    const settings = await this.settings();
    if (settings.mode !== 'cli' || (settings.databaseTransport ?? 'direct') !== 'direct')
      throw new Fault(
        'PARTIAL_EXPORT_UNSUPPORTED',
        'Component export requires direct SQLcl CLI transport.',
        3,
      );
    const compiler = await this.requireCapability('export');
    const stage = await this.stage(),
      directory = path.join(stage, 'selection');
    await mkdir(directory, { mode: 0o700 });
    try {
      if (exportScope === 'full') {
        const exported = await this.exportApplication(env, connection, 'APEXLANG');
        try {
          for (const file of selected) {
            // Full observations may include unrelated files; only the reviewed scope is retained.
            const pageId = /^pages\/p(\d{5})/.exec(file)?.[1];
            const matches = Object.keys(exported.files).filter((candidate) =>
              pageId ? /^pages\/p(\d{5})/.exec(candidate)?.[1] === pageId : candidate === file,
            );
            if (matches.length > 1)
              throw new Fault('PARTIAL_EXPORT_AMBIGUOUS', 'Export has duplicate selected identities.', 5);
            if (!matches.length) continue;
            const target = await contained(directory, file);
            await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
            await cp(await contained(exported.directory, matches[0]!), target);
          }
          const files = await inventory(directory);
          return {
            directory,
            files,
            digest: hash(canonical(files)),
            format: 'APEXLANG' as const,
            compiler,
            output: exported.output,
            stage,
          };
        } finally {
          await this.discardStage(exported.stage);
        }
      }
      const mappings: Array<{ file: string; type: string; id: string }> = [];
      const queries: string[] = [];
      if (selected.some((file) => file.startsWith('pages/') && !knownFiles[file]))
        queries.push(
          "select 'PAGE' component_type, to_char(page_id) component_id, to_char(page_id) component_name from apex_application_pages where application_id = :p_app",
        );
      const metadata = queries.length
        ? await this.jsonQuery(queries.join(' union all '), connection, { p_app: env.applicationId })
        : [];
      for (const file of selected) {
        const page = /^pages\/p(\d{5})/.exec(file);
        if (page) {
          const id = String(Number(page[1]));
          if (
            knownFiles[file] ||
            metadata.some((row) => row.component_type === 'PAGE' && row.component_id === id)
          )
            mappings.push({ file, type: 'PAGE', id });
        }
      }
      if (new Set(mappings.map((entry) => entry.type + ':' + entry.id)).size !== mappings.length)
        throw new Fault(
          'PARTIAL_EXPORT_AMBIGUOUS',
          'Multiple selected files map to one server component.',
          5,
        );
      let output = 'Selected components are absent; no previous source export required.';
      if (mappings.length) {
        const result = await this.session(
          `apex export -applicationid ${env.applicationId} -exptype APEXLANG -skipExportDate -expOriginalIds -dir ${sqlclToken(stage)} -expComponents ${sqlclToken(mappings.map((entry) => entry.type + ':' + entry.id).join(' '))}`,
          connection,
          false,
          undefined,
          stage,
        );
        output = result.output;
        const emitted = await inventory(stage);
        const observed = new Set<string>();
        for (const [file] of Object.entries(emitted)) {
          if (!file.endsWith('.apx'))
            throw new Fault(
              'PARTIAL_EXPORT_SCOPE_FAILED',
              'Native export emitted an unexpected artifact.',
              5,
            );
          // Oracle names the file from its current page alias, not the caller's filename.
          const exportedPage = /(?:^|\/)pages\/p(\d{5})[-\w]*\.apx$/.exec(file);
          const matches = mappings.filter(
            (entry) => entry.type === 'PAGE' && exportedPage && entry.id === String(Number(exportedPage[1])),
          );
          if (matches.length !== 1 || observed.has(matches[0]!.file))
            throw new Fault(
              'PARTIAL_EXPORT_SCOPE_FAILED',
              'Native export emitted an unselected or ambiguous page identity.',
              5,
            );
          observed.add(matches[0]!.file);
          const target = await contained(directory, matches[0]!.file);
          await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
          await cp(await contained(stage, file), target);
        }
      }
      const files = await inventory(directory);
      return {
        directory,
        files,
        digest: hash(canonical(files)),
        format: 'APEXLANG' as const,
        compiler,
        output,
        stage,
      };
    } catch (error) {
      await this.discardStage(stage);
      throw error;
    }
  }
  async connectionLocality(connection: Connection) {
    const selected = await this.selectedConnection(connection);
    if (selected.ords) {
      const host = new URL(selected.ords.url).hostname;
      if (!['localhost', '127.0.0.1', '[::1]'].includes(host))
        return { local: false, evidence: 'remote-ords-endpoint' };
    }
    const endpoint = selected.ords
      ? { local: true, evidence: 'effective-loopback-ords-endpoint' }
      : localConnectionEndpoint((await this.session('show connection', connection)).output);
    if (!endpoint.local) return endpoint;
    const rows = await this.jsonQuery(
      "select sys_context('USERENV','SERVER_HOST') server_host from dual",
      connection,
    );
    const verified = typeof rows[0]?.server_host === 'string' && (await localServerHost(rows[0].server_host));
    return {
      local: verified,
      evidence: verified
        ? endpoint.evidence + '+local-server-identity'
        : 'loopback-server-identity-unconfirmed',
    };
  }
  async databaseDependencies(schema: string, object: string, connection: Connection) {
    const identifier = /^(?:"(?:[^"]|"")+"|[A-Za-z][A-Za-z0-9_$#]*)$/;
    const parts = object.match(/"(?:[^"]|"")+"|[A-Za-z][A-Za-z0-9_$#]*/g) ?? [];
    if (
      !parts.length ||
      parts.length > 2 ||
      parts.join('.') !== object ||
      !parts.every((part) => identifier.test(part))
    )
      throw new Fault(
        'DATABASE_DEPENDENCY_UNRESOLVED',
        'Cannot resolve the reviewed object name for dependency inspection.',
        4,
      );
    const value = (part: string) =>
      part.startsWith('"') ? part.slice(1, -1).replaceAll('""', '"') : part.toUpperCase();
    if (parts.length === 2) schema = value(parts[0]!);
    object = value(parts.at(-1)!);
    return this.jsonQuery(
      'select owner, name, type from all_dependencies where referenced_owner=:p_owner and referenced_name=:p_name order by owner,name,type',
      connection,
      { p_owner: schema, p_name: object },
    );
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
  private bindPreamble(bindings: Record<string, string | number>, ords: boolean) {
    return Object.entries(bindings)
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
  }
  private parseRows(output: string) {
    const start = output.indexOf('{'),
      end = output.lastIndexOf('}');
    if (start < 0) throw new Fault('EMPTY_QUERY_RESULT', 'SQLcl did not return its JSON result envelope.', 1);
    let json: unknown;
    try {
      json = JSON.parse(output.slice(start, end + 1));
    } catch {
      throw new Fault('INVALID_ORACLE_JSON', 'Cannot decode Oracle metadata result.', 1);
    }
    const resultSets = (json as { results?: { items?: Record<string, unknown>[] }[] }).results;
    if (!Array.isArray(resultSets) || !Array.isArray(resultSets[0]?.items))
      throw new Fault('INVALID_ORACLE_JSON', 'SQLcl result has no items collection.', 1);
    return resultSets[0]!.items!;
  }
  async jsonQuery(
    sql: string,
    connection: Connection,
    bindings: Record<string, string | number> = {},
    signal?: AbortSignal,
  ) {
    const ords = (await this.settings()).databaseTransport === 'ords';
    const result = await this.session(
      `${this.bindPreamble(bindings, ords)}\nset sqlformat json\n${sql};`,
      connection,
      false,
      signal,
      undefined,
      'json',
    );
    return this.parseRows(result.output);
  }
  /**
   * Several read-only queries in one SQLcl session. Each query's rows are
   * delimited by a private marker; a missing marker fails the whole batch and
   * never yields a partial result.
   */
  async jsonQueryBatch(
    queries: { sql: string; bindings?: Record<string, string | number> }[],
    connection: Connection,
    signal?: AbortSignal,
  ) {
    if (!queries.length) return [];
    const ords = (await this.settings()).databaseTransport === 'ords';
    const token = `APEXREST_ROWS_${randomUUID().replaceAll('-', '')}`;
    const input = queries
      .map(
        (query, index) =>
          `${this.bindPreamble(query.bindings ?? {}, ords)}\nset sqlformat json\n${query.sql};\nprompt ${token}_${index}`,
      )
      .join('\n');
    const result = await this.session(input, connection, false, signal, undefined, 'json');
    // SQLcl 26.3's JSON formatter can omit its final newline, so PROMPT
    // immediately follows the envelope's closing brace. Normalize only our
    // private end-of-line delimiter; never rewrite returned JSON row data.
    const lines = result.output
      .replace(new RegExp(`}(?=${token}_\\d+[ \\t]*(?:\\r?\\n|$))`, 'g'), '}\n')
      .split(/\r?\n/);
    const rows: Record<string, unknown>[][] = [];
    let from = 0;
    for (let index = 0; index < queries.length; index++) {
      const at = lines.findIndex((line, i) => i >= from && line.trim() === `${token}_${index}`);
      if (at < 0)
        throw new Fault('EMPTY_QUERY_RESULT', 'SQLcl did not return every JSON result envelope.', 1);
      rows.push(this.parseRows(lines.slice(from, at).join('\n')));
      from = at + 1;
    }
    return rows;
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
  /** Read-only release discovery, separate from identity checks for legacy callers. */
  async targetVersions(connection: Connection, signal?: AbortSignal): Promise<TargetVersions> {
    const rows = await this.jsonQuery(targetVersionSql, connection, {}, signal);
    return this.parseTargetVersions(rows);
  }
  private parseTargetVersions(rows: Record<string, unknown>[]): TargetVersions {
    const row = rows[0];
    if (
      rows.length !== 1 ||
      typeof row?.apex_version !== 'string' ||
      typeof row.database_version !== 'string' ||
      !/^\d+\.\d+(?:\.\d+)*$/.test(row.apex_version) ||
      !/^\d+\.\d+(?:\.\d+)*$/.test(row.database_version)
    )
      throw new Fault(
        'TARGET_VERSION_UNCONFIRMED',
        'APEX and database releases could not be confirmed.',
        3,
        'blocked',
      );
    return { apexVersion: row.apex_version, databaseVersion: row.database_version };
  }
  async verifyTarget(env: Environment, connection: Connection, observed?: Record<string, unknown>[]) {
    // One read-only statement observes all target identifiers in the same live
    // SQLcl session. Never reuse this result between plan/apply/write checks.
    const rows =
      observed ??
      (await this.jsonQuery(targetIdentitySql, connection, {
        p_workspace: env.workspace,
        p_app_id: env.applicationId,
      }));
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
  /** Fresh identity and versions share one read-only SQLcl session. */
  async versionedTarget(env: Environment, connection: Connection) {
    const [identity, versions] = await this.jsonQueryBatch(
      [
        { sql: targetIdentitySql, bindings: { p_workspace: env.workspace, p_app_id: env.applicationId } },
        { sql: targetVersionSql },
      ],
      connection,
    );
    return {
      target: await this.verifyTarget(env, connection, identity!),
      versions: this.parseTargetVersions(versions!),
    };
  }
  async applicationMetadata(env: Environment, connection: Connection) {
    const rows = await this.jsonQuery(
      `select to_char(last_updated_on, 'YYYY-MM-DD"T"HH24:MI:SS', 'NLS_DATE_LANGUAGE=American') last_updated_on,
        last_updated_by,
        case when last_updated_on is null then 'Y' else 'N' end last_updated_on_is_null,
        case when last_updated_by is null then 'Y' else 'N' end last_updated_by_is_null
        from apex_applications
        where application_id = :p_app_id and workspace = :p_workspace and owner = :p_owner`,
      connection,
      { p_app_id: env.applicationId, p_workspace: env.workspace, p_owner: env.parsingSchema },
    );
    const row = rows[0];
    // SQLcl 26.3 omits null-valued JSON properties. Explicit SQL flags
    // distinguish a genuine database NULL from an incomplete result envelope.
    if (row && !Object.hasOwn(row, 'last_updated_on') && row.last_updated_on_is_null === 'Y')
      row.last_updated_on = null;
    if (row && !Object.hasOwn(row, 'last_updated_by') && row.last_updated_by_is_null === 'Y')
      row.last_updated_by = null;
    if (
      rows.length !== 1 ||
      !row ||
      !Object.hasOwn(row, 'last_updated_on') ||
      !Object.hasOwn(row, 'last_updated_by')
    )
      throw new Fault(
        'SYNC_METADATA_UNCONFIRMED',
        'Application update metadata is absent or inaccessible.',
        5,
      );
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
    selectedFiles?: string[],
  ) {
    await this.requireCapability('import', signal);
    if (selectedFiles !== undefined) {
      const settings = await this.settings();
      if (settings.mode !== 'cli' || (settings.databaseTransport ?? 'direct') !== 'direct')
        throw new Fault(
          'PARTIAL_IMPORT_TRANSPORT_UNSUPPORTED',
          'Partial import requires direct SQLcl CLI transport.',
          3,
          'blocked',
        );
      if (!selectedFiles.length || new Set(selectedFiles).size !== selectedFiles.length)
        throw new Fault(
          'PARTIAL_IMPORT_FILES_INVALID',
          'Select a nonempty, unique list of APEXlang files.',
          2,
        );
      for (const file of selectedFiles) {
        if (
          !/^[A-Za-z0-9_./-]+\.apx$/.test(file) ||
          path.isAbsolute(file) ||
          file.split('/').some((part) => !part || part === '.' || part === '..')
        )
          throw new Fault(
            'PARTIAL_IMPORT_FILES_INVALID',
            'Partial-import files must be literal contained APEXlang paths without globs.',
            2,
          );
        let valid = false;
        try {
          const physical = await realpath(await contained(source, file));
          valid =
            path.relative(await realpath(source), physical).replaceAll(path.sep, '/') === file &&
            (await stat(physical)).isFile();
        } catch {
          /* Missing or inaccessible files must fail before import. */
        }
        if (!valid)
          throw new Fault(
            'PARTIAL_IMPORT_FILES_INVALID',
            'Partial-import files must be regular contained files without aliases.',
            2,
          );
      }
      const help = await this.importHelp(signal);
      if (!/(?:^|\s)-files(?:\s|\|)/m.test(help))
        throw new Fault(
          'PARTIAL_IMPORT_UNSUPPORTED',
          'The selected SQLcl does not advertise apex import -files.',
          3,
          'blocked',
        );
    }
    const config = await this.nativeDeployment(ctx, env, source);
    try {
      return await this.importWith(env, connection, source, config, signal, selectedFiles);
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
    selectedFiles?: string[],
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
    let result;
    try {
      result = await this.session(
        `apex import -input ${sqlclToken(source)} -deployment ${sqlclToken(config)} -workspace ${sqlclToken(env.workspace)} -schema ${sqlclToken(env.parsingSchema)} -id ${env.applicationId}${selectedFiles ? ' -files ' + selectedFiles.map((file) => sqlclToken(file)).join(' ') : ''}`,
        connection,
        true,
        signal,
        selectedFiles ? source : undefined,
        'text',
        SCRIPT_RESTRICT_LEVEL,
      );
    } catch (error) {
      // Compiler output arrives as text with exit code 0; keep the fault, add structure.
      if (error instanceof Fault && error.code === 'ORACLE_COMMAND_FAILED' && !error.details)
        error.details = await compilerDetails(error.message, source);
      throw error;
    }
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
export interface CompilerDiagnostic {
  code: string;
  severity: 'error';
  file: string;
  line: number;
  column: number;
  type: string;
  message: string;
  validValues?: string[];
  hint?: string;
}
/**
 * Parse the APEXlang compiler's text report (SQLcl 26.1):
 *   File: pages/p00080-customer.apx / Line: 6 / Column: 8 / Type: LOV_NOT_FOUND
 *   Error: Invalid LOV required parameter: appearance - pageMode (string)
 *   Valid parameters are: modalDialog / -nonModalDialog / -normal
 * Blocks are separated by blank lines; continuation lines extend the message.
 */
export function parseCompilerDiagnostics(output: string): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  let current: Partial<CompilerDiagnostic> | undefined, values: string[] | undefined;
  const flush = () => {
    if (current?.file && current.type && current.message !== undefined)
      diagnostics.push({
        code: current.type,
        severity: 'error',
        file: current.file,
        line: current.line ?? 0,
        column: current.column ?? 0,
        type: current.type,
        message: current.message,
        ...(values?.length ? { validValues: values } : {}),
      });
    current = undefined;
    values = undefined;
  };
  for (const raw of output.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/)) {
    const line = raw.trimEnd();
    const field = line.match(/^(File|Line|Column|Type|Error):\s?(.*)$/);
    if (field?.[1] === 'File') {
      flush();
      current = { file: field[2]!.trim() };
    } else if (!current) continue;
    else if (field?.[1] === 'Line') current.line = Number(field[2]);
    else if (field?.[1] === 'Column') current.column = Number(field[2]);
    else if (field?.[1] === 'Type') current.type = field[2]!.trim();
    else if (field?.[1] === 'Error') current.message = field[2]!.trim();
    else if (!line.trim()) flush();
    else if (current.message === undefined) continue;
    else {
      const valid = line.match(/^Valid (?:parameters|values|options) are:\s*(.*)$/i);
      if (valid) values = valid[1]!.trim() ? [valid[1]!.trim()] : [];
      else if (values && /^-\S/.test(line.trim())) values.push(line.trim().slice(1));
      else current.message += ' ' + line.trim();
    }
  }
  flush();
  return diagnostics;
}
/**
 * Cheap source context for a diagnostic: the enclosing APEXlang declarations
 * (for example "inside appearance of region bad (type: form)") read from the
 * reported file around the reported line. Never fails the diagnostic itself.
 */
export async function diagnosticHint(root: string, diagnostic: CompilerDiagnostic) {
  if (!diagnostic.line || !/^INVALID_PROPERTY|MISSING_REQUIRED|_NOT_FOUND$|INVALID_/.test(diagnostic.type))
    return;
  try {
    const file = await contained(root, diagnostic.file);
    const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
    const indent = (text: string) => text.match(/^\s*/)![0].length;
    const open = /^\s*([A-Za-z][\w-]*)(?:\s+([^\s({]+))?\s*[({]\s*$/;
    const chain: string[] = [];
    let level = indent(lines[diagnostic.line - 1] ?? '');
    for (let i = diagnostic.line - 2; i >= 0 && chain.length < 3; i--) {
      const text = lines[i]!;
      if (!text.trim() || indent(text) >= level) continue;
      const match = text.match(open);
      if (!match) continue;
      level = indent(text);
      const kind = match[1]!,
        name = match[2];
      let label = name ? `${kind} ${name}` : kind;
      if (name) {
        // A declaration's own type property, when stated directly below it.
        for (let j = i + 1; j < lines.length && j < i + 40; j++) {
          const property = lines[j]!.match(/^\s*type:\s*(\S+)/);
          if (indent(lines[j]!) <= level && lines[j]!.trim()) break;
          if (property && indent(lines[j]!) === level + (indent(lines[i + 1] ?? '') - level || 4)) {
            label += ` (type: ${property[1]})`;
            break;
          }
        }
      }
      chain.push(label);
    }
    return chain.length ? `inside ${chain.join(' of ')}` : undefined;
  } catch {
    return;
  }
}
export async function compilerDetails(output: string, root?: string) {
  const diagnostics = parseCompilerDiagnostics(output);
  if (root)
    for (const diagnostic of diagnostics) {
      const hint = await diagnosticHint(root, diagnostic);
      if (hint) diagnostic.hint = hint;
    }
  return diagnostics.length ? { diagnostics } : undefined;
}
/** Validation failure with structured diagnostics; the raw report stays the message. */
export async function compilerFault(output: string, root?: string) {
  const details = await compilerDetails(output, root);
  return new Fault(
    details ? 'VALIDATION_FAILED' : 'VALIDATION_UNCONFIRMED',
    output.slice(0, 4000) || 'Compiler returned no success marker.',
    1,
    'failed',
    details,
  );
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
