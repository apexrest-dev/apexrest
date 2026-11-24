import path from 'node:path';
import { runProcess } from './process.ts';
import { runtimeState } from '../../installer/src/toolchain.ts';
import { sqlclConfig } from './sqlcl-config.ts';
import { loadProject } from './config.ts';
import { contained, readJson } from './fs.ts';
import type { Diagnostic } from './result.ts';

interface LockArtifact {
  id: string;
  version: string;
  os?: string;
  arch?: string;
}
export type SqlclLockCheck =
  | { status: 'no-project' | 'unpinned' }
  | { status: 'match' | 'mismatch' | 'unknown'; lockFile: string; expected: string; found: string | null };

/** Compares the SQLcl build doctor probed with the one the project's toolchain lock pins for this platform. */
export function checkLockedSqlcl(
  lock: { artifacts?: LockArtifact[] },
  lockFile: string,
  probeOutput: string | undefined,
  os: string = process.platform,
  arch: string = process.arch,
): SqlclLockCheck {
  const pinned = lock.artifacts?.find(
    (a) => a.id === 'sqlcl' && (a.os ?? os) === os && (a.arch ?? arch) === arch,
  );
  if (!pinned) return { status: 'unpinned' };
  const found = /\bBuild:? (\d+(?:\.\d+)+)\b/.exec(probeOutput ?? '')?.[1] ?? null;
  return {
    status: found === null ? 'unknown' : found === pinned.version ? 'match' : 'mismatch',
    lockFile,
    expected: pinned.version,
    found,
  };
}
export function lockDiagnostics(check: SqlclLockCheck): Diagnostic[] {
  if (check.status === 'mismatch')
    return [
      {
        severity: 'warning',
        code: 'TOOLCHAIN_SQLCL_MISMATCH',
        message: `The selected SQLcl is build ${check.found}, but ${check.lockFile} pins ${check.expected}. APEXLang validation and deploys may fail with INVALID_VERSION.`,
        hint: `Install SQLcl ${check.expected} with apexrest dependencies install --project PATH, or point APEXREST_SQLCL at its bin/sql.`,
      },
    ];
  if (check.status === 'unknown')
    return [
      {
        severity: 'warning',
        code: 'TOOLCHAIN_SQLCL_UNVERIFIED',
        message: `Could not read the selected SQLcl build to compare with ${check.lockFile}, which pins ${check.expected}.`,
      },
    ];
  return [];
}
async function projectSqlclCheck(root: string, probeOutput: string | undefined): Promise<SqlclLockCheck> {
  let lockFile: string, lock: { artifacts?: LockArtifact[] };
  try {
    const ctx = await loadProject(root);
    lockFile = ctx.config.toolchain.lockFile;
    lock = (await readJson(await contained(ctx.root, lockFile))) as typeof lock;
  } catch {
    return { status: 'no-project' };
  }
  return checkLockedSqlcl(lock, lockFile, probeOutput);
}
export async function doctor(root: string = process.cwd()) {
  const state = await runtimeState();
  const java = process.env.APEXREST_JAVA_HOME
    ? path.join(process.env.APEXREST_JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    : (state.java ?? 'java');
  const probes = await Promise.all(
    [
      ['codex', ['--version']],
      [process.env.APEXREST_SQLCL ?? state.sqlcl ?? 'sql', ['-version']],
      [java, ['-version']],
    ].map(async ([exe, args]) => {
      try {
        const r = await runProcess({
          executable: exe as string,
          args: args as string[],
          cwd: process.env.TMPDIR ?? process.cwd(),
          timeoutMs: 10000,
          env: {
            ...process.env,
            JAVA_HOME: path.isAbsolute(java) ? path.dirname(path.dirname(java)) : process.env.JAVA_HOME,
          },
        });
        return {
          command: exe,
          informational: exe === 'codex',
          state: r.code === 0 ? 'detected' : 'unavailable',
          version: (r.stdout + r.stderr).trim().slice(0, 500),
        };
      } catch {
        return { command: exe, state: 'missing', informational: exe === 'codex' };
      }
    }),
  );
  const toolchainLock = await projectSqlclCheck(root, probes[1]?.version);
  return {
    platform: process.platform,
    architecture: process.arch,
    runtime: {
      executable: process.execPath,
      version: process.version,
      baseline: process.versions.node.split('.')[0] === '24',
    },
    managedComponents: Object.fromEntries(
      Object.entries(state.components).filter(([name]) => ['node', 'java', 'sqlcl', 'mcp'].includes(name)),
    ),
    sqlcl: await sqlclConfig(),
    probes,
    toolchainLock,
    database: 'not-configured',
    nativeHost: 'requires-host-verification',
    telemetry: false,
  };
}
