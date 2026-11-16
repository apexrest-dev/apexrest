import { build } from 'esbuild';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const suite = process.argv[2];
if (!['unit', 'installers'].includes(suite)) throw new Error('Unknown test suite');
const root = path.resolve('.apexrest/test-build', suite);
await mkdir(root, { recursive: true });
const files = (await readdir(`tests/${suite}`)).filter((f) => f.endsWith('.test.ts'));
if (!files.length) throw new Error('No tests discovered');
await build({
  entryPoints: files.map((f) => `tests/${suite}/${f}`),
  outdir: root,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const result = spawnSync(
  process.execPath,
  ['--test', ...files.map((f) => path.join(root, f.replace(/\.ts$/, '.mjs')))],
  {
    stdio: 'inherit',
    // Tests never add local usage counts, timings or recent projects to the developer's APEXREST home.
    env: { ...process.env, APEXREST_RESOURCES: path.resolve('dist/resources'), APEXREST_USAGE: '0' },
  },
);
process.exitCode = result.status ?? 1;
