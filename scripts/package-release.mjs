import { readFile, writeFile, mkdir, cp, rm, chmod, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { sign } from 'node:crypto';
import { zipSync } from 'fflate';
import { sha256, zipTree, sourceDigest } from './lib/release.mjs';
import { readiness } from './check-release-readiness.mjs';
const pkg = JSON.parse(await readFile('package.json', 'utf8')),
  version = pkg.version,
  root = 'dist/releases';
// Release bytes must come from the exact source tree they claim. Uncommitted
// changes are accepted only for an explicit local --dry-run.
const dryRun = process.argv.includes('--dry-run');
const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' });
const dirty = status.status !== 0 || status.stdout.trim().length > 0;
if (dirty && !dryRun) {
  console.error(
    'Refusing to package a dirty or unreadable working tree. Commit or stash changes, or pass --dry-run for unsigned local artifacts.',
  );
  process.exit(2);
}
const sourceBefore = await sourceDigest();
// Never zip a stale dist/ or site-dist/: rebuild both from this source tree first.
await rm('site-dist', { recursive: true, force: true });
for (const script of ['scripts/build-plugin.mjs', 'scripts/build-site.mjs']) {
  const built = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (built.status !== 0) {
    console.error(`Release build failed: ${script}`);
    process.exit(built.status ?? 1);
  }
}
if ((await sourceDigest()) !== sourceBefore) {
  console.error('Sources changed while building the release; nothing was packaged.');
  process.exit(2);
}
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
const artifacts = [];
const add = async (name, bytes, kind, extra = {}) => {
  await writeFile(root + '/' + name, bytes);
  artifacts.push({ name, kind, bytes: bytes.length, sha256: sha256(bytes), ...extra });
};
for (const profile of ['codex-compat'])
  await add(
    `apexrest-apex-${version}-${profile}.zip`,
    await zipTree('dist/' + profile, zipSync),
    'native-plugin',
    { profile, compatibility: 'codex-plugin' },
  );
// The runtime is platform-neutral JavaScript plus resources (no vendor binaries),
// so one archive serves every supported platform.
{
  const staging = 'dist/runtime-package';
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  for (const item of ['runtime', 'resources'])
    await cp('dist/' + item, staging + '/' + item, { recursive: true });
  for (const item of ['LICENSE', 'NOTICE']) await cp(item, staging + '/' + item);
  await add(`apexrest-runtime-${version}.zip`, await zipTree(staging, zipSync), 'runtime', {
    platforms: ['darwin-arm64', 'linux-x64', 'win32-x64'],
    containsVendorBinaries: false,
  });
}
for (const file of ['install.sh', 'install.ps1']) {
  await cp('scripts/bootstrap/' + file, root + '/' + file);
  await chmod(root + '/' + file, 0o755);
  const bytes = await readFile(root + '/' + file);
  artifacts.push({ name: file, kind: 'installer', bytes: bytes.length, sha256: sha256(bytes) });
}
await add('bootstrap-runtime.mjs', await readFile('scripts/bootstrap-runtime.mjs'), 'installer');
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const candidates = Object.entries(lock.packages)
  .filter(([key, v]) => key.includes('node_modules/') && v.version)
  .map(([key, v]) => {
    const name = key.split('node_modules/').at(-1);
    return {
      type: 'library',
      name,
      version: v.version,
      'bom-ref': `pkg:npm/${name}@${v.version}`,
      purl: `pkg:npm/${name}@${v.version}`,
      ...(v.license ? { licenses: [{ license: { name: v.license } }] } : {}),
      properties: [
        { name: 'apexrest:scope', value: v.dev ? 'build' : 'runtime' },
        { name: 'apexrest:integrity', value: v.integrity ?? 'workspace' },
      ],
    };
  });
const componentMap = new Map();
for (const candidate of candidates) {
  const previous = componentMap.get(candidate['bom-ref']);
  if (!previous || candidate.properties.some((p) => p.name === 'apexrest:scope' && p.value === 'runtime'))
    componentMap.set(candidate['bom-ref'], candidate);
}
const components = [...componentMap.values()].sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref']));
await add(
  'sbom.cdx.json',
  Buffer.from(
    JSON.stringify(
      {
        bomFormat: 'CycloneDX',
        specVersion: '1.6',
        version: 1,
        metadata: { component: { type: 'application', name: pkg.name, version } },
        components,
      },
      null,
      2,
    ) + '\n',
  ),
  'sbom',
);
const native = artifacts.find((a) => a.profile === 'codex-compat');
await writeFile(
  root + '/install-local.txt',
  `# Run from this release directory. SHA-256 is generated from these exact local bytes.\n# Review --dry-run first; --yes does not accept Oracle license terms.\nbash ./install.sh --bundle ./${native.name} --sha256 ${native.sha256} --yes\n\n# PowerShell:\n./install.ps1 -Bundle ./${native.name} -Sha256 ${native.sha256} -Yes\n\n# Add --accept-oracle-license / -AcceptOracleLicense only after reviewing Oracle terms.\n# For an isolated native-only smoke: add --native-only --home DIR --codex-home DIR.\n`,
);
const report = await readiness();
await writeFile(root + '/release-readiness.json', JSON.stringify(report, null, 2) + '\n');
const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
await add(
  'provenance.json',
  Buffer.from(
    JSON.stringify(
      {
        schemaVersion: 1,
        version,
        sourceDigest: sourceBefore,
        commit: git.status === 0 ? git.stdout.trim() : null,
        dirty,
        builder: 'scripts/package-release.mjs',
        node: process.version,
        reproducibleZipEpoch: '1980-01-01T00:00:00Z',
        publication: 'not-published',
        vendorBinariesIncluded: false,
      },
      null,
      2,
    ) + '\n',
  ),
  'provenance',
);
// Site's public subset omits the site archive itself to avoid a checksum cycle.
const siteManifest = {
  schemaVersion: 1,
  version,
  published: false,
  artifacts: artifacts.filter((a) => ['native-plugin', 'runtime', 'installer'].includes(a.kind)),
};
await mkdir('site-dist/releases', { recursive: true });
await writeFile('site-dist/releases/manifest.json', JSON.stringify(siteManifest, null, 2) + '\n');
for (const file of ['install.sh', 'install.ps1', 'bootstrap-runtime.mjs'])
  await cp(root + '/' + file, 'site-dist/' + file);
await add('site-dist.zip', await zipTree('site-dist', zipSync), 'static-site');
let manifest = {
  schemaVersion: 1,
  version,
  channel: report.channel,
  published: false,
  sourceDigest: report.sourceDigest,
  signatureStatus: process.env.APEXREST_RELEASE_SIGNING_KEY_FILE ? 'signed' : 'unsigned-local-dry-run',
  artifacts,
};
if (process.env.APEXREST_RELEASE_SIGNING_KEY_FILE) {
  const key = await readFile(process.env.APEXREST_RELEASE_SIGNING_KEY_FILE);
  manifest = {
    ...manifest,
    signature: sign(null, Buffer.from(JSON.stringify(manifest)), key).toString('base64'),
  };
}
await writeFile(root + '/release-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
await writeFile(root + '/checksums.txt', artifacts.map((a) => `${a.sha256}  ${a.name}`).join('\n') + '\n');
console.log(
  JSON.stringify({
    status: 'built',
    directory: root,
    version,
    artifacts: artifacts.length,
    stableReady: report.stableReady,
    publication: 'not-published',
  }),
);
