import path from 'node:path';
import { realpath, rm } from 'node:fs/promises';
import { exists, readJson, writeJson } from './fs.ts';
import { Fault } from './result.ts';
import { resourceRoot } from './project.ts';
import { runProcess, type ProcessRequest, type ProcessResult } from './process.ts';

export interface OrdsBridgeJob {
  operation: 'compile' | 'import' | 'export' | 'script' | 'prepare-script';
  input?: string;
  deployment?: string;
  outputDirectory?: string;
  applicationId?: number;
  workspace?: string;
  parsingSchema?: string;
  exportType?: 'APEXLANG' | 'SQL' | 'APPLICATION_SOURCE';
  split?: boolean;
}
export interface OrdsCredentials {
  url: string;
  username: string;
  password: string;
}
export interface OrdsBridgeResult {
  status: 'succeeded' | 'failed';
  operation: string;
  writeStarted?: boolean;
  code?: string;
  message?: string;
  [key: string]: unknown;
}

async function sqlclHome(executable: string) {
  const candidates = path.isAbsolute(executable)
    ? [executable]
    : executable.includes(path.sep)
      ? [path.resolve(executable)]
      : (process.env.PATH ?? '')
          .split(path.delimiter)
          .flatMap((directory) =>
            process.platform === 'win32'
              ? ['', '.exe', '.cmd', '.bat'].map((extension) => path.join(directory, executable + extension))
              : [path.join(directory, executable)],
          );
  for (const candidate of candidates) {
    if (!(await exists(candidate))) continue;
    const home = path.dirname(path.dirname(await realpath(candidate)));
    if (await exists(path.join(home, 'lib', 'jdbcrest.jar'))) return home;
    break;
  }
  throw new Fault(
    'ORDS_SQLCL_LIBRARIES_REQUIRED',
    'ORDS APEX operations require the selected SQLcl installation with lib/jdbcrest.jar and the Oracle APEXlang compiler. Set APEXREST_SQLCL to its bin/sql executable.',
    3,
    'blocked',
  );
}

// Source-file launch needs jdk.compiler, which the managed SQLcl JRE does not
// contain. Prefer the configured runtime, then an existing JAVA_HOME/PATH JDK;
// selecting a helper runtime never changes the user's SQLcl configuration.
export async function resolveOrdsJava(
  javaHome: string | undefined,
  stage: string,
  env: NodeJS.ProcessEnv,
  signal?: AbortSignal,
  runner: (request: ProcessRequest) => Promise<ProcessResult> = runProcess,
) {
  const executableName = process.platform === 'win32' ? 'java.exe' : 'java';
  const candidates = [
    ...[javaHome, process.env.JAVA_HOME]
      .filter((home): home is string => !!home)
      .map((home) => ({ executable: path.join(home, 'bin', executableName), javaHome: home })),
    { executable: executableName, javaHome: undefined },
  ];
  const attempted = new Set<string>();
  for (const candidate of candidates) {
    if (attempted.has(candidate.executable)) continue;
    attempted.add(candidate.executable);
    if (signal?.aborted) throw new Fault('CANCELLED', 'ORDS operation cancelled.', 6, 'cancelled');
    try {
      const result = await runner({
        executable: candidate.executable,
        args: ['--list-modules'],
        cwd: stage,
        env: { ...env, JAVA_HOME: candidate.javaHome },
        timeoutMs: 10000,
        ...(signal ? { signal } : {}),
      });
      if (result.cancelled || signal?.aborted)
        throw new Fault('CANCELLED', 'ORDS operation cancelled.', 6, 'cancelled');
      const major = Number(result.stdout.match(/^java\.base@(\d+)/m)?.[1] ?? 0);
      if (
        result.code === 0 &&
        !result.timedOut &&
        !result.truncated &&
        major >= 21 &&
        /^jdk\.compiler@/m.test(result.stdout)
      )
        return candidate;
    } catch (error) {
      if (!(error instanceof Fault) || error.code !== 'DEPENDENCY_MISSING') throw error;
    }
  }
  throw new Fault(
    'ORDS_JDK_REQUIRED',
    'ORDS APEX operations need an installed JDK 21 or newer with jdk.compiler. The configured Java runtime and JAVA_HOME/PATH do not provide one. Set APEXREST_JAVA_HOME or JAVA_HOME to an existing JDK; ordinary SQLcl can continue using its managed JRE.',
    3,
    'blocked',
  );
}

// The job contains paths and operation metadata only. Credentials travel through
// the helper's private stdin, never argv, process environment or staging files.
export async function runOrdsBridge(
  settings: { executable: string; javaHome: string | undefined },
  job: OrdsBridgeJob,
  credentials: OrdsCredentials | undefined,
  stage: string,
  signal?: AbortSignal,
  runner: (request: ProcessRequest) => Promise<ProcessResult> = runProcess,
): Promise<OrdsBridgeResult> {
  if (signal?.aborted) throw new Fault('CANCELLED', 'ORDS operation cancelled.', 6, 'cancelled');
  const home = await sqlclHome(settings.executable);
  const helper = path.join(resourceRoot(), 'ords', 'OrdsBridge.java');
  if (!(await exists(helper)))
    throw new Fault('ORDS_HELPER_REQUIRED', 'The installed plugin is missing its ORDS helper.', 3, 'blocked');
  const jobFile = path.join(stage, 'ords-job.json');
  const output = path.join(stage, 'ords-result.json');
  await rm(output, { force: true });
  await writeJson(jobFile, { ...job, output });
  const env: NodeJS.ProcessEnv = { ...process.env, JAVA_HOME: settings.javaHome };
  delete env.NODE_OPTIONS;
  delete env.JAVA_TOOL_OPTIONS;
  delete env._JAVA_OPTIONS;
  delete env.JDK_JAVA_OPTIONS;
  const java = await resolveOrdsJava(settings.javaHome, stage, env, signal, runner);
  env.JAVA_HOME = java.javaHome;
  const processResult = await runner({
    executable: java.executable,
    args: [
      '-cp',
      [path.join(home, 'lib', '*'), path.join(home, 'lib', 'ext', '*')].join(path.delimiter),
      helper,
      jobFile,
    ],
    cwd: stage,
    env,
    input: credentials ? JSON.stringify(credentials) : '',
    timeoutMs: 180000,
    ...(signal ? { signal } : {}),
  });
  const mutation = job.operation === 'import' || job.operation === 'script';
  if (processResult.timedOut || processResult.cancelled || processResult.truncated)
    throw new Fault(
      processResult.truncated ? 'OUTPUT_LIMIT' : processResult.cancelled ? 'CANCELLED' : 'TIMEOUT',
      'The ORDS helper did not confirm completion. Reconcile any import before retrying.',
      6,
      mutation ? 'outcome_unknown' : 'cancelled',
    );
  let result: OrdsBridgeResult | undefined;
  if (await exists(output)) {
    try {
      const value = (await readJson(output)) as OrdsBridgeResult;
      if (value && value.operation === job.operation && ['succeeded', 'failed'].includes(value.status))
        result = value;
    } catch {
      // A process can stop while writing its report; never downgrade an
      // unconfirmed mutation to an ordinary JSON parsing error.
    }
  }
  if (
    processResult.code !== 0 ||
    result?.status !== 'succeeded' ||
    !processResult.stdout.split(/\r?\n/).some((line) => line.trim() === 'APEXREST_ORDS_COMPLETE')
  ) {
    const unknown = mutation && (!result || result.writeStarted === true);
    // Do not expose third-party exception text that can contain connection data.
    throw new Fault(
      unknown ? 'ORDS_OUTCOME_UNKNOWN' : (result?.code ?? 'ORDS_BRIDGE_FAILED'),
      unknown
        ? 'ORDS import did not confirm a complete outcome; reconcile the target before retrying.'
        : 'The Oracle ORDS helper failed. Check the SQLcl/Java prerequisites, ORDS authentication and schema privileges.',
      unknown ? 6 : 1,
      unknown ? 'outcome_unknown' : 'failed',
    );
  }
  return result;
}
