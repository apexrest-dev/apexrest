// Local file preparation only: no Oracle, model, network or database work.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/benchmark-source-inventory.mjs OUTPUT.json');
const root = await mkdtemp(path.join(tmpdir(), 'apexrest-inventory-benchmark-'));
try {
  const bundle = path.join(root, 'fs.mjs');
  await build({
    entryPoints: ['packages/core/src/fs.ts'],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'esm',
  });
  const { inventory, hash, canonical } = await import(pathToFileURL(bundle).href);
  async function baseline(source) {
    const result = {};
    async function walk(dir) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(file);
        else if (entry.isFile())
          result[path.relative(source, file).split(path.sep).join('/')] = hash(await readFile(file));
        else throw new Error('Fixture must contain only regular files');
      }
    }
    await walk(source);
    return Object.fromEntries(Object.entries(result).sort());
  }
  const cases = [];
  for (const count of [30, 500, 1500]) {
    const source = path.join(root, String(count));
    await mkdir(path.join(source, 'pages'), { recursive: true });
    await mkdir(path.join(source, 'static'), { recursive: true });
    for (let i = 0; i < count; i++)
      await writeFile(path.join(source, 'pages', `p${i}.apx`), `page ${i} (` + 'x'.repeat(8192) + ')');
    await writeFile(path.join(source, 'static', 'asset.bin'), Buffer.alloc(8 * 1024 * 1024, 97));
    const expected = canonical(await baseline(source));
    assert.equal(canonical(await inventory(source)), expected);
    const samples = { baseline: [], optimized: [] };
    for (let i = 0; i < 12; i++) {
      for (const name of i % 2 ? ['optimized', 'baseline'] : ['baseline', 'optimized']) {
        const start = performance.now();
        const result = await (name === 'baseline' ? baseline(source) : inventory(source));
        samples[name].push(performance.now() - start);
        assert.equal(canonical(result), expected);
      }
    }
    const median = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return (sorted[5] + sorted[6]) / 2;
    };
    const baselineMs = median(samples.baseline),
      optimizedMs = median(samples.optimized);
    cases.push({
      pages: count,
      assetBytes: 8 * 1024 * 1024,
      samples,
      baselineMs,
      optimizedMs,
      speedup: baselineMs / optimizedMs,
    });
  }
  const report = {
    timestamp: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    scope: 'Local synthetic file inventory; not Oracle deployment or agent latency.',
    method:
      'Twelve alternating warm-filesystem samples per arm after warmup; exact digests checked on every iteration.',
    cases,
  };
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify(
      cases.map(({ pages, baselineMs, optimizedMs, speedup }) => ({
        pages,
        baselineMs,
        optimizedMs,
        speedup,
      })),
      null,
      2,
    ),
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
