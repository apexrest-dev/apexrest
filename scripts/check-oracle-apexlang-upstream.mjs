// Read-only remote inspection; writes only the requested local evidence directory.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
const option = (name) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const out = path.resolve(option('--out') ?? 'docs/evidence/oracle-upstream');
const snapshot = JSON.parse(await readFile('resources/references/26.2/oracle-snapshot.json', 'utf8'));
const compatibility = JSON.parse(await readFile('toolchains/compatibility.json', 'utf8'));
let commit = option('--commit'),
  archive = option('--archive'),
  head,
  relevant;
if (archive && !/^[a-f0-9]{40}$/.test(commit ?? ''))
  throw new Error('An offline archive requires --commit with its exact revision.');
async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'APEXREST-official-inventory-sync' },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Oracle upstream request failed (${response.status}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 20 * 1024 * 1024) throw new Error('Upstream response exceeds 20 MiB.');
  return bytes;
}
await mkdir(out, { recursive: true });
if (!archive) {
  const api = 'https://api.github.com/repos/oracle/skills';
  const [h, r] = await Promise.all([
    fetchBytes(`${api}/commits/main`),
    fetchBytes(`${api}/commits?path=apex/apexlang/26.2&per_page=1`),
  ]);
  const hc = JSON.parse(h),
    rc = JSON.parse(r)[0];
  head = { commit: hc.sha, date: hc.commit.committer.date, url: hc.html_url };
  relevant = { commit: rc.sha, date: rc.commit.committer.date, url: rc.html_url };
  // Inspect HEAD, including release directories outside the pinned 26.2 path.
  commit = head.commit;
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Oracle returned an invalid revision.');
  archive = path.join(out, `${commit}.zip`);
  await writeFile(archive, await fetchBytes(`https://codeload.github.com/oracle/skills/zip/${commit}`));
}
const bytes = await readFile(archive),
  archiveSha256 = sha256(bytes);
if (bytes.length > 20 * 1024 * 1024) throw new Error('Archive exceeds 20 MiB.');
const root = `skills-${commit}/`,
  releaseRoot = root + 'apex/apexlang/26.2/';
const inventoryRoot = releaseRoot + 'apexlang-inventory/assets/';
const available = new Set();
const files = unzipSync(bytes, {
  filter: ({ name, originalSize }) => {
    const release = name.slice(root.length).match(/^apex\/apexlang\/(\d+\.\d+)\//)?.[1];
    if (release) available.add(release);
    const selected =
      (name.startsWith(inventoryRoot) && name.endsWith('.md')) ||
      Object.hasOwn(snapshot.sourceFiles, name.slice(releaseRoot.length)) ||
      name === root + 'LICENSE.txt';
    if (selected && originalSize > 4 * 1024 * 1024) throw new Error('Oversized official document.');
    return selected;
  },
});
if (!Object.keys(files).some((name) => name.startsWith(inventoryRoot)))
  throw new Error('The archive contains no official 26.2 inventory.');
const hashes = Object.fromEntries(
  Object.entries(files)
    .filter(([name]) => name.startsWith(inventoryRoot))
    .map(([name, raw]) => [name.slice(inventoryRoot.length), sha256(raw)]),
);
const before = Object.fromEntries(
  Object.entries(snapshot.sourceFiles)
    .filter(([name]) => name.startsWith('apexlang-inventory/assets/'))
    .map(([name, hash]) => [name.slice('apexlang-inventory/assets/'.length), hash]),
);
const added = Object.keys(hashes)
  .filter((name) => !Object.hasOwn(before, name))
  .sort();
const removed = Object.keys(before)
  .filter((name) => !Object.hasOwn(hashes, name))
  .sort();
const updated = Object.keys(hashes)
  .filter((name) => before[name] && before[name] !== hashes[name])
  .sort();
const otherChanges = Object.entries(snapshot.sourceFiles)
  .filter(
    ([name, digest]) =>
      !name.startsWith('apexlang-inventory/assets/') &&
      (!files[releaseRoot + name] || sha256(files[releaseRoot + name]) !== digest),
  )
  .map(([name]) => name)
  .sort();
const licenseChanged =
  !files[root + 'LICENSE.txt'] || sha256(files[root + 'LICENSE.txt']) !== snapshot.licenseSha256;
const compareVersions = (a, b) => {
  const x = a.split('.').map(Number),
    y = b.split('.').map(Number);
  return x[0] - y[0] || x[1] - y[1];
};
const versions = [...available].sort(compareVersions);
const supported = [...new Set(compatibility.profiles.map((profile) => profile.apex))].sort(compareVersions);
const unbundledVersions = versions.filter((version) => !supported.includes(version));
const newerVersions = versions.filter((version) => compareVersions(version, snapshot.release) > 0);
const inventoryChanged = Boolean(added.length || removed.length || updated.length);
const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  repository: 'https://github.com/oracle/skills',
  release: '26.2',
  head,
  latestRelevant: relevant,
  bundledCommit: snapshot.commit,
  candidateCommit: commit,
  archive: path.resolve(archive),
  archiveSha256,
  inventoryDocuments: Object.keys(hashes).length,
  added,
  removed,
  updated,
  inventoryStatus: inventoryChanged ? 'inventory-update-available' : 'inventory-content-current',
  bundledSourceChanges: otherChanges,
  licenseChanged,
  releaseDiscovery: {
    inspectedCommit: commit,
    availableVersions: versions,
    supportedVersions: supported,
    unbundledVersions,
    newerVersions,
    status: unbundledVersions.length ? 'new-release-review-required' : 'no-unbundled-release',
  },
  status: unbundledVersions.length
    ? 'new-release-review-required'
    : inventoryChanged || otherChanges.length || licenseChanged
      ? 'bundled-source-review-required'
      : 'bundled-26.2-source-current',
  scope:
    'Complete pinned inventory, imported example/catalog and license comparison plus official release-directory discovery. Other upstream skills/examples, compiler, platform, deployed application and browser coverage are separate.',
};
await writeFile(path.join(out, 'upstream.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
