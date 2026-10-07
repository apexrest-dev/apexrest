import { readFile, writeFile, mkdir, mkdtemp, cp, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sourceDigest, sha256 } from './lib/release.mjs';
const root = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-full-install-'))),
  home = path.join(root, 'managed'),
  codexHome = path.join(root, 'codex');
await mkdir(home);
await mkdir(codexHome);
await writeFile(path.join(codexHome, 'config.toml'), 'hide_agent_reasoning = true\n');
const version = JSON.parse(await readFile('package.json', 'utf8')).version,
  name = `apexrest-apex-${version}-codex-compat.zip`;
for (const f of ['install.sh', 'install.ps1', 'bootstrap-runtime.mjs', name])
  await cp('dist/releases/' + f, path.join(root, f));
const checksum = sha256(await readFile(path.join(root, name)));
const evidence = {
  schemaVersion: 1,
  sourceDigest: await sourceDigest(),
  timestamp: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  status: 'running',
  mock: false,
  archiveSha256: checksum,
  checks: [],
};
try {
  const vendorCache = process.env.APEXREST_SMOKE_VENDOR_CACHE_DIR;
  if (vendorCache) {
    const lock = JSON.parse(await readFile('toolchains/toolchain.lock.json', 'utf8'));
    await mkdir(path.join(home, 'cache'), { recursive: true });
    for (const id of ['node', 'java']) {
      const artifact = lock.artifacts.find(
        (a) => a.id === id && a.os === process.platform && a.arch === process.arch,
      );
      const input = path.join(vendorCache, id + '.tar.gz');
      if (sha256(await readFile(input)) !== artifact.sha256)
        throw new Error('Seed vendor cache failed integrity');
      await cp(input, path.join(home, 'cache', artifact.sha256));
      if (id === 'node')
        await cp(
          input,
          path.join(home, 'cache', `node-v${artifact.version}-${artifact.os}-${artifact.arch}.tar.gz`),
        );
    }
    evidence.vendorCache =
      'real verified Node and Java archives; bootstrap/runtime installation starts with no managed binaries';
  }
  const extra = process.env.APEXREST_SMOKE_OFFLINE_CACHE;
  const args = [
    '--bundle',
    path.join(root, name),
    '--sha256',
    checksum,
    '--home',
    home,
    '--codex-home',
    codexHome,
    '--yes',
    '--json',
    ...(extra ? ['--offline'] : []),
  ];
  if (process.platform === 'win32')
    throw new Error(
      'Run the PowerShell platform harness on the Windows CI runner; Bash smoke is macOS/Linux only.',
    );
  for (const label of ['full-client-setup', 'repeat-offline-setup']) {
    const r = spawnSync(
      'bash',
      [
        path.join(root, 'install.sh'),
        ...args,
        ...(label.startsWith('repeat') && !extra ? ['--offline'] : []),
      ],
      { encoding: 'utf8', timeout: 420000, maxBuffer: 4 * 1024 * 1024 },
    );
    const result = JSON.parse(r.stdout || '{}');
    if (r.status !== 0) throw new Error(result.summary ?? r.stderr);
    const states = result.data.components;
    for (const component of ['node', 'java', 'sqlcl', 'mcp'])
      if (states[component] !== 'verified') throw new Error(component + ' is not verified');
    evidence.checks.push({ name: label, components: states, status: result.data.status });
  }
  const launcher = path.join(home, 'bin', 'apexrest');
  const doctor = spawnSync(launcher, ['doctor', '--json'], { encoding: 'utf8', timeout: 60000 });
  if (doctor.status !== 0) throw new Error('Managed CLI launcher failed');
  evidence.checks.push({ name: 'managed-cli-launcher', result: JSON.parse(doctor.stdout).data });
  if (!(await readFile(path.join(codexHome, 'config.toml'), 'utf8')).includes('hide_agent_reasoning = true'))
    throw new Error('Unrelated settings changed');
  evidence.status = 'passed';
} catch (error) {
  evidence.status = 'blocked';
  evidence.blocker = String(error);
  process.exitCode = 3;
}
await writeFile('docs/evidence/setup-local.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(
  JSON.stringify({
    status: evidence.status,
    blocker: evidence.blocker,
    evidence: 'docs/evidence/setup-local.json',
    location: root,
  }),
);
