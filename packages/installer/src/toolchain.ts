import path from 'node:path';
import { mkdir, mkdtemp, readdir, readlink, rename, rm, chmod, statfs, realpath } from 'node:fs/promises';
import { z } from 'zod';
import { exists, hash, hashFile, readJson, withLock, writeJson } from '../../core/src/fs.ts';
import { managedHome, parse } from '../../core/src/config.ts';
import { resourceRoot } from '../../core/src/project.ts';
import { runProcess } from '../../core/src/process.ts';
import { Fault } from '../../core/src/result.ts';
import { download, proxyStatus } from './download.ts';
import type { Artifact } from './download.ts';
import { extractVerifiedArchive } from './archive.ts';
import { runCommand, searchPath } from './command.ts';
const artifactSchema = z.strictObject({
  id: z.enum(['node', 'java', 'sqlcl']),
  version: z.string().min(1),
  url: z.url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  os: z.string(),
  arch: z.string(),
  type: z.enum(['zip', 'tar.gz']),
  executable: z.string(),
  allowedHosts: z.array(z.string()).min(1),
  license: z.string(),
  consentRequired: z.boolean(),
});
export const lockSchema = z.strictObject({
  schemaVersion: z.literal(1),
  artifacts: z.array(artifactSchema),
  provenance: z.record(z.string(), z.unknown()),
});
export interface SetupRequest {
  home?: string;
  cacheDir?: string;
  offline?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  nonInteractive?: boolean;
  acceptOracleLicense?: boolean;
}
export interface InstalledTree {
  destination: string;
  executableSha256: string;
  treeSha256: string;
}
export interface ToolchainState {
  schemaVersion: 1;
  node?: string;
  java?: string;
  sqlcl?: string;
  components: Record<string, string>;
  /** Digests recorded at install time for managed (not reused) toolchains. */
  integrity?: Record<string, InstalledTree>;
}
/**
 * Canonical managed home: the physical path of the nearest existing ancestor
 * plus the not-yet-created remainder. Every installer component uses this one
 * form so recorded paths, APEXREST_HOME and ownership checks agree (for
 * example /var vs /private/var on macOS).
 */
export async function canonicalHome(home: string) {
  let existing = path.resolve(home);
  const rest: string[] = [];
  while (!(await exists(existing))) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    rest.unshift(path.basename(existing));
    existing = parent;
  }
  return path.join(await realpath(existing), ...rest);
}
export async function runtimeState(home = managedHome()): Promise<ToolchainState> {
  const file = path.join(home, 'runtime.json');
  return (await exists(file))
    ? ((await readJson(file)) as ToolchainState)
    : { schemaVersion: 1, components: {} };
}
export function platformProfile(os = process.platform, arch = process.arch) {
  if (
    ![
      ['darwin', 'arm64'],
      ['linux', 'x64'],
      ['win32', 'x64'],
    ].some(([o, a]) => os === o && arch === a)
  )
    throw new Fault(
      'UNSUPPORTED_PLATFORM',
      `No locked client profile for ${os}/${arch}. Use a supported runner or remote development host.`,
      3,
      'blocked',
    );
  return { os, arch, status: os === 'darwin' ? 'locally-tested' : 'requires-platform-CI' };
}
async function findExecutable(name: string) {
  const found = await searchPath(name);
  return found ? realpath(found) : undefined;
}
/**
 * Digest of an extracted vendor tree: regular file contents and symbolic link
 * targets by relative path. Permissions are excluded because install applies chmod.
 */
export async function treeDigest(root: string) {
  const entries: [string, string][] = [];
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name),
        name = path.relative(root, file).split(path.sep).join('/');
      if (entry.isSymbolicLink()) entries.push([name, 'link:' + (await readlink(file))]);
      else if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) entries.push([name, 'file:' + (await hashFile(file))]);
      else throw new Fault('SPECIAL_FILE_NOT_ALLOWED', 'Toolchain trees accept files and links only.', 3);
    }
  }
  await walk(root);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return hash(JSON.stringify(entries));
}
/** Windows can briefly hold directories open (indexers, antivirus); retry a rename there. */
export async function renameWithRetry(from: string, to: string, platform = process.platform, attempts = 6) {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (platform !== 'win32' || !['EPERM', 'EBUSY', 'EACCES'].includes(code ?? '') || attempt >= attempts)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
}
/** Move an incomplete or modified installation out of the way, then delete it. */
async function moveAside(destination: string) {
  const broken = `${destination}.broken-${Date.now()}`;
  await renameWithRetry(destination, broken);
  await rm(broken, { recursive: true, force: true }).catch(() => {
    /* The aside copy no longer blocks installation; leave it for manual cleanup. */
  });
}
async function intactInstallation(
  destination: string,
  executable: string,
  recorded: InstalledTree | undefined,
) {
  if (!(await exists(executable))) return false;
  // Installations from earlier releases have no record; their probe decides and a record is added.
  if (recorded && recorded.destination !== destination) return false;
  if (!recorded) return true;
  try {
    return (
      (await hashFile(executable)) === recorded.executableSha256 &&
      (await treeDigest(destination)) === recorded.treeSha256
    );
  } catch {
    return false;
  }
}
async function installArtifact(artifact: Artifact, destination: string, cache: string, offline?: boolean) {
  const file = await download(artifact, cache, offline);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const staging = await mkdtemp(destination + '.staging-');
  try {
    await extractVerifiedArchive(file, artifact.sha256, staging, artifact.type, artifact.id !== 'sqlcl');
    if (!(await exists(path.join(staging, artifact.executable))))
      throw new Fault(
        'ARTIFACT_LAYOUT_MISMATCH',
        'Vendor executable is missing from the locked archive layout.',
        3,
      );
    await renameWithRetry(staging, destination);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
export class ToolchainService {
  async inspect() {
    return { platform: platformProfile(), state: await runtimeState() };
  }
  async plan(r: SetupRequest) {
    const platform = platformProfile();
    const lock = parse(
      lockSchema,
      await readJson(path.join(resourceRoot(), 'toolchains/toolchain.lock.json')),
    );
    const home = await canonicalHome(r.home ?? managedHome()),
      cache = path.resolve(r.cacheDir ?? path.join(home, 'cache'));
    const artifacts = lock.artifacts.filter((a) => a.os === platform.os && a.arch === platform.arch);
    const steps = await Promise.all(
      artifacts.map(async (artifact) => {
        const candidate =
          artifact.id === 'node'
            ? process.execPath
            : artifact.id === 'sqlcl'
              ? (process.env.APEXREST_SQLCL ?? (await findExecutable('sql')))
              : process.env.APEXREST_JAVA_HOME
                ? path.join(
                    process.env.APEXREST_JAVA_HOME,
                    'bin',
                    process.platform === 'win32' ? 'java.exe' : 'java',
                  )
                : undefined;
        let reuse: string | undefined;
        // A preview never executes discovered programs; apply probes them.
        if (candidate && !r.dryRun) {
          try {
            // runCommand also probes a Windows .cmd/.bat SQLcl launcher safely.
            const result = await runCommand({
              executable: candidate,
              args: artifact.id === 'node' ? ['--version'] : ['-version'],
              cwd: process.cwd(),
              timeoutMs: 15000,
            });
            if (
              result.code === 0 &&
              (result.stdout + result.stderr).includes(
                artifact.id === 'java' ? artifact.version.split('+')[0]! : artifact.version,
              )
            )
              reuse = candidate;
          } catch {
            /* Use the pinned managed artifact instead. */
          }
        }
        const destination = path.join(home, 'toolchains', artifact.id, artifact.version);
        return {
          artifact,
          destination,
          reuse,
          ...(candidate && r.dryRun ? { candidate, candidateStatus: 'found, not probed' } : {}),
          action: reuse
            ? 'reuse'
            : (await exists(path.join(destination, artifact.executable)))
              ? 'verify'
              : 'download-install',
          consent: artifact.consentRequired && !r.acceptOracleLicense && !reuse ? 'required' : 'not-required',
        };
      }),
    );
    return {
      schemaVersion: 1,
      home,
      cache,
      platform,
      steps,
      offline: r.offline ?? false,
      proxy: proxyStatus(),
      extraCA: Boolean(process.env.NODE_EXTRA_CA_CERTS),
    };
  }
  async apply(r: SetupRequest) {
    const plan = await this.plan(r);
    if (r.dryRun) return { status: 'planned', plan };
    if (!r.yes)
      throw new Fault(
        'SETUP_APPROVAL_REQUIRED',
        'Review dependencies install --dry-run, then pass --yes for technical steps. License and elevation consent are separate.',
        4,
        'needs-user-action',
      );
    await mkdir(plan.home, { recursive: true, mode: 0o700 });
    const disk = await statfs(plan.home);
    if (disk.bavail * disk.bsize < 1024 * 1024 * 1024)
      throw new Fault('INSUFFICIENT_DISK', 'At least 1 GiB of free local space is required.', 3);
    return withLock(path.join(plan.home, 'toolchain.lock'), async () => {
      const state = await runtimeState(plan.home);
      const actions: { code: string; component?: string; details?: string }[] = [];
      for (const step of plan.steps) {
        const artifact = step.artifact;
        const executable = step.reuse ?? path.join(step.destination, artifact.executable);
        const intact =
          Boolean(step.reuse) ||
          (await intactInstallation(step.destination, executable, state.integrity?.[artifact.id]));
        if (!intact && step.consent === 'required') {
          state.components[artifact.id] = 'needs-consent';
          actions.push({
            code: 'ORACLE_LICENSE_CONSENT_REQUIRED',
            component: artifact.id,
            details: artifact.license,
          });
          continue;
        }
        if (!intact) {
          // Under the toolchain lock: an incomplete or modified tree is replaced, never trusted.
          if (await exists(step.destination)) await moveAside(step.destination);
          await installArtifact(artifact, step.destination, plan.cache, r.offline);
        }
        if (process.platform !== 'win32' && !step.reuse) await chmod(executable, 0o700);
        const javaHome = state.java ? path.dirname(path.dirname(state.java)) : undefined;
        const result = await runProcess({
          executable,
          args: artifact.id === 'node' ? ['--version'] : ['-version'],
          cwd: plan.home,
          env: { ...process.env, ...(javaHome ? { JAVA_HOME: javaHome } : {}) },
          timeoutMs: 20000,
        });
        if (
          result.code !== 0 ||
          !(result.stdout + result.stderr).includes(
            artifact.id === 'java' ? artifact.version.split('+')[0]! : artifact.version,
          )
        )
          throw new Fault('TOOLCHAIN_PROBE_FAILED', `${artifact.id} did not report its locked version.`, 3);
        state[artifact.id] = executable;
        state.components[artifact.id] = 'verified';
        if (step.reuse) delete state.integrity?.[artifact.id];
        else
          state.integrity = {
            ...state.integrity,
            [artifact.id]: {
              destination: step.destination,
              executableSha256: await hashFile(executable),
              treeSha256: await treeDigest(step.destination),
            },
          };
        await writeJson(path.join(plan.home, 'runtime.json'), state);
      }
      await writeJson(path.join(plan.home, 'runtime.json'), state);
      return {
        schemaVersion: 1,
        status: actions.length ? 'needs-user-action' : 'toolchain-verified',
        components: state.components,
        actions,
        state,
      };
    });
  }
}
