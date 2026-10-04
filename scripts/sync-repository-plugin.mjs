import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { files, sha256, sourceDigest, repositoryPlugin, generatedPluginEntries } from './lib/release.mjs';

const built = 'dist/codex-compat/plugins/apexrest-apex';
const check = process.argv.includes('--check');
const manifestPath = path.join(repositoryPlugin, 'bundle-manifest.json');
const packageVersion = JSON.parse(await readFile('package.json', 'utf8')).version;
const inputDigest = await sourceDigest();

async function inventory(root) {
  const hashes = {};
  for (const file of await files(root)) {
    if (file === 'bundle-manifest.json') continue;
    hashes[file] = sha256(await readFile(path.join(root, file)));
  }
  return hashes;
}

if (check) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const marketplace = await readFile('.agents/plugins/marketplace.json', 'utf8');
  if (marketplace !== (await readFile('dist/codex-compat/.agents/plugins/marketplace.json', 'utf8')))
    throw new Error('Repository marketplace differs from the generated native marketplace.');
  if (manifest.version !== packageVersion || manifest.sourceDigest !== inputDigest)
    throw new Error('Repository plugin is stale. Run npm run plugin:sync after source changes.');
  const actual = await inventory(repositoryPlugin);
  if (JSON.stringify(actual) !== JSON.stringify(manifest.files))
    throw new Error('Repository plugin file inventory/hash mismatch. Run npm run plugin:sync.');
  // Third-party notices come from non-dev, platform-independent lock entries,
  // so the whole checked-in plugin must match a fresh build on every platform.
  const fresh = await inventory(built);
  for (const file of new Set([...Object.keys(fresh), ...Object.keys(actual)])) {
    if (actual[file] !== fresh[file]) throw new Error(`Repository plugin differs from fresh build: ${file}`);
  }
  console.log(`Repository plugin ${packageVersion}: source, integrity and fresh build verified.`);
} else {
  await cp('dist/codex-compat/.agents/plugins/marketplace.json', '.agents/plugins/marketplace.json');
  for (const entry of generatedPluginEntries.filter((name) => name !== 'bundle-manifest.json')) {
    const destination = path.join(repositoryPlugin, entry);
    await rm(destination, { force: true, recursive: true });
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(built, entry), destination, { recursive: true });
  }
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        version: packageVersion,
        sourceDigest: inputDigest,
        files: await inventory(repositoryPlugin),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Updated checked-in native plugin ${packageVersion}.`);
}
