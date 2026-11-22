// Fast-development clocks of the plan (preview readiness, revision, compiler, optional native ship).
// Explicitly invoked only. Usage:
//   node scripts/benchmark-fast-dev.mjs --project PATH [--reps 20] [--env ENV --connected-reps 3] [--out FILE]
// Connected cases run only with --env, through the guarded ship path on that DEV/QA/TEST target.
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const outdir = path.resolve('.apexrest/bench');
await mkdir(outdir, { recursive: true });
await build({
  entryPoints: ['scripts/bench/fast-dev.ts'],
  outfile: path.join(outdir, 'fast-dev.mjs'),
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node24',
  logLevel: 'error',
});
const result = spawnSync(process.execPath, [path.join(outdir, 'fast-dev.mjs'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    APEXREST_RESOURCES: process.env.APEXREST_RESOURCES ?? path.resolve('dist/resources'),
  },
});
process.exitCode = result.status ?? 1;
