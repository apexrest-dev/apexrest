import path from 'node:path';
import { runProcess } from './process.ts';
import { runtimeState } from '../../installer/src/toolchain.ts';
import { sqlclConfig } from './sqlcl-config.ts';
export async function doctor() {
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
    database: 'not-configured',
    nativeHost: 'requires-host-verification',
    telemetry: false,
  };
}
