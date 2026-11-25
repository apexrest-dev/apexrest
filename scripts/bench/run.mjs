// Runs a TypeScript benchmark on any supported Node release:
//
//   node scripts/bench/run.mjs scripts/bench/<name>.ts [arguments]
//
// Node 26 only strips types, which cannot run the parameter properties the sources use, so the
// script is bundled with esbuild into .apexrest/bench (ignored) and executed with its arguments.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const [script, ...rest] = process.argv.slice(2);
if (!script || !script.endsWith('.ts'))
  throw new Error('Usage: node scripts/bench/run.mjs scripts/bench/<name>.ts [arguments]');
const outfile = path.resolve('.apexrest/bench', path.basename(script).replace(/\.ts$/u, '.mjs'));
await build({
  entryPoints: [script],
  outfile,
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const result = spawnSync(process.execPath, [outfile, ...rest], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
