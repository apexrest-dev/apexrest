// Renders every page of Oracle's public APEX 26.2 applications in the local preview and reports
// what it could not run, by kind. A development check of the preview, never Oracle evidence.
//
//   npm run preview:corpus -- --archive /path/to/oracle-apex-<commit>.zip
//
// The archive is the pinned oracle/apex revision the public template catalog uses (checked by
// SHA-256). The report goes to docs/evidence/preview-corpus/ (ignored by Git).
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { unzipSync } from 'fflate';
import { sha256 } from './lib/release.mjs';

/** The oracle/apex revision of the public template catalog (scripts/build-public-template-catalog.mjs). */
const pin = {
  repository: 'https://github.com/oracle/apex',
  commit: 'fbe095e4c6e783b3fa930ffae927e4826e549190',
  archiveSha256: 'f7ec2c4f5f04755b0744e7c3b6b87e326e0f4a575c666db720cef43297472bcc',
};

const argument = (name) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const archive = argument('--archive');
if (!archive) {
  console.error(
    `Pass --archive with ${pin.repository}/archive/${pin.commit}.zip (SHA-256 ${pin.archiveSha256}).`,
  );
  process.exit(2);
}
const bytes = await readFile(archive);
if (sha256(bytes) !== pin.archiveSha256) {
  console.error('The archive is not the reviewed Oracle revision.');
  process.exit(2);
}
const work = await mkdtemp(path.join(tmpdir(), 'apexrest-preview-corpus-'));
try {
  // Application sources only: APEXlang files, install scripts and plug-in static files.
  const files = unzipSync(bytes, {
    filter: (entry) => /\/apexlang\//u.test(entry.name) && !entry.name.endsWith('/'),
  });
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(work, 'apps', name);
    if (!target.startsWith(path.join(work, 'apps') + path.sep)) continue;
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  // Inside the repository, so the bundle resolves its external packages from node_modules.
  const entry = path.resolve('.apexrest/test-build/corpus/preview-corpus.mjs');
  await mkdir(path.dirname(entry), { recursive: true });
  await build({
    entryPoints: ['tests/corpus/preview-corpus.ts'],
    outfile: entry,
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'error',
  });
  const reportDir = path.resolve('docs/evidence/preview-corpus');
  await mkdir(reportDir, { recursive: true });
  const report = path.join(reportDir, `scorecard-${new Date().toISOString().slice(0, 10)}.json`);
  const result = spawnSync(process.execPath, [entry, path.join(work, 'apps'), report], {
    stdio: 'inherit',
    env: { ...process.env, APEXREST_RESOURCES: path.resolve('dist/resources') },
  });
  if (result.status === 0) console.log(`Report: ${path.relative(process.cwd(), report)}`);
  process.exitCode = result.status ?? 1;
} finally {
  await rm(work, { recursive: true, force: true });
}
