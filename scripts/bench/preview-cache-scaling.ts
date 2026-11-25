// Manually invoked: node --experimental-strip-types scripts/bench/preview-cache-scaling.ts [--out FILE]
//
// Measures the preview's parsed-file cache on synthetic applications of increasing size. Cleanup is
// timed on its own — the previous per-entry rescan against the current set lookup — and separately
// from a cached reload (which still stats every file) and a clean full parse. Results describe this
// dataset and host only; they are not a general speedup claim.
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir, cpus, platform, release } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { loadApplication, type ApxParseCache } from '../../packages/core/src/preview/apexlang.ts';

const SIZES = [100, 500, 2000];
const RUNS = 5;
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : undefined;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

async function application(pages: number) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-cache-bench-'));
  await mkdir(path.join(root, 'pages'), { recursive: true });
  await writeFile(path.join(root, 'application.apx'), 'app BENCH (\n    name: bench\n)\n');
  for (let i = 1; i <= pages; i++)
    await writeFile(
      path.join(root, 'pages', `p${String(i).padStart(5, '0')}-page.apx`),
      `page ${i} (\n    name: Page ${i}\n    region main (\n        name: Main\n        type: staticContent\n    )\n)\n`,
    );
  return root;
}

const results = [];
for (const pages of SIZES) {
  const root = await application(pages);
  try {
    const cache: ApxParseCache = new Map();
    const clean: number[] = [];
    const cached: number[] = [];
    for (let run = 0; run < RUNS; run++) {
      let start = performance.now();
      loadApplication(root);
      clean.push(performance.now() - start);
      start = performance.now();
      loadApplication(root, 'default', cache);
      cached.push(performance.now() - start);
    }
    const files = loadApplication(root).files;
    const keys = [...cache.keys()];
    const previous: number[] = [];
    const current: number[] = [];
    for (let run = 0; run < RUNS; run++) {
      let start = performance.now();
      for (const relative of keys)
        files.some((file) => path.relative(root, file).split(path.sep).join('/') === relative);
      previous.push(performance.now() - start);
      start = performance.now();
      const present = new Set(files.map((file) => path.relative(root, file).split(path.sep).join('/')));
      for (const relative of keys) present.has(relative);
      current.push(performance.now() - start);
    }
    results.push({
      files: files.length,
      runs: RUNS,
      cleanupMs: { previousRescan: median(previous), setLookup: median(current) },
      cachedReloadMs: median(cached),
      cleanFullParseMs: median(clean),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const report = {
  kind: 'manually invoked synthetic preview cache measurement',
  date: new Date().toISOString(),
  host: { platform: platform(), release: release(), cpu: cpus()[0]?.model, node: process.version },
  dataset: 'one application.apx plus N one-region page files; medians of the runs per size',
  results,
};
const text = JSON.stringify(report, null, 2) + '\n';
if (out) await writeFile(out, text);
process.stdout.write(text);
