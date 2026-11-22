// Connected preview profile (APE-379): round trips, APEX sessions and main-thread blocking per
// page request. Explicitly invoked only, against an authorized DEV/QA/TEST environment; every
// preview request is rolled back. Usage:
//   node scripts/benchmark-preview-oracle.mjs --project PATH --env ENV [--pages 1,10] [--reps 5] [--out FILE]
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const outdir = path.resolve('.apexrest/bench');
await mkdir(outdir, { recursive: true });
const common = {
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node24',
  logLevel: 'error',
};
await build({
  ...common,
  entryPoints: ['scripts/bench/preview-oracle.ts'],
  outfile: path.join(outdir, 'preview-oracle.mjs'),
});
// The bridge loads its worker from beside the bundle, as in the plugin runtime.
await build({
  ...common,
  entryPoints: ['packages/core/src/preview/oracle/worker.ts'],
  outfile: path.join(outdir, 'preview-oracle-worker.mjs'),
});
const result = spawnSync(
  process.execPath,
  [path.join(outdir, 'preview-oracle.mjs'), ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      APEXREST_RESOURCES: process.env.APEXREST_RESOURCES ?? path.resolve('dist/resources'),
    },
  },
);
process.exitCode = result.status ?? 1;
