import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resourceRoot } from '../../packages/core/src/project.ts';
import {
  ToolchainService,
  lockedArtifacts,
  platformProfile,
  runtimeState,
  treeDigest,
} from '../../packages/installer/src/toolchain.ts';

const BASELINE_SQLCL = '26.1.2.132.1334';
const PROFILE_SQLCL = '26.3.0.260.1620';
const posixOnly = process.platform === 'win32' ? 'Fixture executables use a POSIX shell.' : false;
const platform = (() => {
  try {
    return platformProfile();
  } catch {
    return undefined;
  }
})();
const supported = platform ? false : 'No locked client profile for this platform.';

interface LockFile {
  artifacts: { id: string; version: string; os: string; arch: string; executable: string; sha256: string }[];
}
const readLock = async (name: string) =>
  JSON.parse(await readFile(path.join(resourceRoot(), 'toolchains', name), 'utf8')) as LockFile;

async function temporary(t: test.TestContext) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-setup-lock-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
/** A configured project with the 26.2 profile and the reviewed 26.2 lock, as project init writes it. */
async function project26(root: string, lock?: LockFile) {
  const dir = path.join(root, 'project');
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'apexrest.json'),
    JSON.stringify({
      schemaVersion: 1,
      projectId: 'lock-fixture',
      application: { sourceDir: 'src/apex/lock-fixture', alias: 'lock-fixture' },
      database: { migrationsDir: 'src/database/migrations', packagesDir: 'src/database/packages' },
      toolchain: { lockFile: 'apexrest.toolchain.lock.json', profile: '26.2' },
      environments: {},
      artifacts: { directory: '.apexrest/artifacts', retentionDays: 7 },
    }),
  );
  await writeFile(
    path.join(dir, 'apexrest.toolchain.lock.json'),
    JSON.stringify(lock ?? (await readLock('toolchain-26.2.lock.json'))),
  );
  return dir;
}
function isolateProbes(t: test.TestContext, root: string) {
  // Discovered programs must not decide the result: no SQLcl or Java outside the fixture home.
  const saved = { sqlcl: process.env.APEXREST_SQLCL, java: process.env.APEXREST_JAVA_HOME };
  process.env.APEXREST_SQLCL = path.join(root, 'no-sqlcl', 'sql');
  delete process.env.APEXREST_JAVA_HOME;
  t.after(() => {
    if (saved.sqlcl === undefined) delete process.env.APEXREST_SQLCL;
    else process.env.APEXREST_SQLCL = saved.sqlcl;
    if (saved.java !== undefined) process.env.APEXREST_JAVA_HOME = saved.java;
  });
}
const sqlclStep = (plan: Awaited<ReturnType<ToolchainService['plan']>>) =>
  plan.steps.find((step) => step.artifact.id === 'sqlcl')!;

test('setup for a 26.2 project plans the SQLcl its toolchain lock pins', { skip: supported }, async (t) => {
  const root = await temporary(t);
  isolateProbes(t, root);
  const project = await project26(root);
  const home = path.join(root, 'home');
  const explicit = await new ToolchainService().plan({ home, dryRun: true, project });
  assert.equal(sqlclStep(explicit).artifact.version, PROFILE_SQLCL);
  assert.equal(sqlclStep(explicit).destination, path.join(home, 'toolchains', 'sqlcl', PROFILE_SQLCL));
  assert.deepEqual(explicit.toolchain, {
    source: 'project',
    project,
    lockFile: 'apexrest.toolchain.lock.json',
    profile: '26.2',
  });
  // The project of the current folder is used the same way when --project is absent.
  const fromFolder = await new ToolchainService().plan({ home, dryRun: true, cwd: project });
  assert.equal(sqlclStep(fromFolder).artifact.version, PROFILE_SQLCL);
  assert.equal(fromFolder.toolchain.source, 'project');
});

test('setup without a project keeps the built-in baseline', { skip: supported }, async (t) => {
  const root = await temporary(t);
  isolateProbes(t, root);
  const plan = await new ToolchainService().plan({ home: path.join(root, 'home'), dryRun: true, cwd: root });
  assert.equal(sqlclStep(plan).artifact.version, BASELINE_SQLCL);
  assert.deepEqual(plan.toolchain, { source: 'baseline', lockFile: 'toolchains/toolchain.lock.json' });
  assert.deepEqual(
    plan.steps.map((step) => step.artifact.id),
    ['node', 'java', 'sqlcl'],
  );
});

test(
  'an explicit project must be configured and pin only reviewed artifacts',
  { skip: supported },
  async (t) => {
    const root = await temporary(t);
    await assert.rejects(
      lockedArtifacts({ project: root }, platform!.os, platform!.arch),
      (error: { code?: string }) => error.code === 'PROJECT_NOT_CONFIGURED',
    );
    const lock = await readLock('toolchain-26.2.lock.json');
    for (const artifact of lock.artifacts) if (artifact.id === 'sqlcl') artifact.sha256 = 'a'.repeat(64);
    const project = await project26(root, lock);
    await assert.rejects(
      lockedArtifacts({ project }, platform!.os, platform!.arch),
      (error: { code?: string }) => error.code === 'TOOLCHAIN_LOCK_UNREVIEWED',
    );
    await rm(path.join(project, 'apexrest.toolchain.lock.json'));
    await assert.rejects(
      lockedArtifacts({ project }, platform!.os, platform!.arch),
      (error: { code?: string }) => error.code === 'TOOLCHAIN_LOCK_REQUIRED',
    );
  },
);

test(
  'setup records the project SQLcl with integrity data and never downgrades it to the baseline',
  { skip: posixOnly || supported },
  async (t) => {
    const root = await temporary(t);
    isolateProbes(t, root);
    const project = await project26(root);
    const home = path.join(root, 'home');
    const locks = [await readLock('toolchain.lock.json'), await readLock('toolchain-26.2.lock.json')];
    // Both SQLcl builds (and the shared Node.js/Java) are already installed, as observed on the host.
    const installed = new Map<string, string>();
    for (const lock of locks)
      for (const artifact of lock.artifacts.filter(
        (a) => a.os === platform!.os && a.arch === platform!.arch,
      )) {
        const destination = path.join(home, 'toolchains', artifact.id, artifact.version);
        const executable = path.join(destination, artifact.executable);
        await mkdir(path.dirname(executable), { recursive: true });
        const reported = artifact.id === 'node' ? 'v' + artifact.version : artifact.version;
        await writeFile(executable, `#!/bin/sh\necho "${artifact.id} ${reported}"\n`, { mode: 0o755 });
        installed.set(`${artifact.id}@${artifact.version}`, destination);
      }
    const old = installed.get(`sqlcl@${BASELINE_SQLCL}`)!,
      current = installed.get(`sqlcl@${PROFILE_SQLCL}`)!;
    // The state an earlier setup left behind: runtime.json selects the baseline build.
    await writeFile(
      path.join(home, 'runtime.json'),
      JSON.stringify({ schemaVersion: 1, sqlcl: path.join(old, 'sqlcl/bin/sql'), components: {} }),
    );
    const apply = () =>
      new ToolchainService().apply({
        home,
        cacheDir: path.join(root, 'cache'),
        offline: true,
        yes: true,
        project,
      });

    const repaired = await apply();
    assert.equal(repaired.status, 'toolchain-verified');
    assert.equal('toolchain' in repaired && repaired.toolchain.source, 'project');
    const sqlcl = locks[1]!.artifacts.find(
      (a) => a.id === 'sqlcl' && a.os === platform!.os && a.arch === platform!.arch,
    )!;
    const state = await runtimeState(home);
    assert.equal(state.sqlcl, path.join(current, sqlcl.executable));
    assert.equal(state.integrity?.sqlcl?.destination, current);
    assert.equal(state.integrity?.sqlcl?.treeSha256, await treeDigest(current));

    // A recorded 26.3 runtime is verified in place and kept on a repeated run.
    await apply();
    const again = await runtimeState(home);
    assert.equal(again.sqlcl, state.sqlcl);
    assert.deepEqual(again.integrity?.sqlcl, state.integrity?.sqlcl);
    // The baseline build stays installed but unselected.
    assert.equal((await readFile(path.join(old, 'sqlcl/bin/sql'), 'utf8')).includes(BASELINE_SQLCL), true);
  },
);
