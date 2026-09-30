import { build } from 'esbuild';
import { mkdir, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const output = path.resolve('.apexrest/working-copy-benchmark.mjs');
await mkdir(path.dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export {workingCopyFixture} from './tests/fixtures/working-copy.ts';
    export {atomicWrite,hash,writeJson} from './packages/core/src/fs.ts';
    export {success} from './packages/core/src/result.ts';
    export {toolOutput} from './packages/mcp/src/output.ts';`,
    resolveDir: process.cwd(),
  },
  outfile: output,
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const { workingCopyFixture, atomicWrite, hash, success, toolOutput } = await import(
  pathToFileURL(output).href
);
async function measure(action, fixture) {
  fixture.calls.length = 0;
  const start = performance.now();
  const response = await action();
  return {
    wallTimeMs: performance.now() - start,
    oracleBoundaryCalls: fixture.calls.filter((c) => c !== 'tests').length,
    databaseOperationBoundaryCalls: fixture.calls.filter((c) =>
      /^(target|metadata|export:|import|restore)/.test(c),
    ).length,
    callsByMethod: Object.fromEntries(
      [...new Set(fixture.calls)].map((method) => [method, fixture.calls.filter((c) => c === method).length]),
    ),
    exports: {
      apexlang: fixture.calls.filter((c) => c === 'export:APEXLANG').length,
      sql: fixture.calls.filter((c) => c === 'export:SQL').length,
    },
    toolResponseBytes: Buffer.byteLength(JSON.stringify(response), 'utf8'),
  };
}
async function scenario(optimized) {
  const f = await workingCopyFixture();
  try {
    const initialSync = optimized
      ? await measure(
          async () =>
            toolOutput(success('apex.sync', await f.service.sync(f.ctx, 'dev', 'init')), f.ctx.root),
          f,
        )
      : null;
    const cycles = [];
    for (let edit = 0; edit < 3; edit++) {
      await atomicWrite(
        path.join(f.ctx.root, f.ctx.config.application.sourceDir, 'application.apx'),
        'matched fixture change ' + edit,
      );
      const sample = await measure(async () => {
        const plan = await f.service.plan(f.ctx, 'dev');
        const planned = await toolOutput(success('deploy.plan', plan), f.ctx.root);
        const applied = await toolOutput(
          success('deploy.apply', await f.service.apply(f.ctx, plan)),
          f.ctx.root,
        );
        return [planned, applied];
      }, f);
      cycles.push(sample);
    }
    assert.equal(
      cycles.reduce((n, c) => n + (c.callsByMethod.import ?? 0), 0),
      3,
    );
    assert.deepEqual(
      cycles.map((c) => c.exports),
      optimized ? Array(3).fill({ apexlang: 0, sql: 0 }) : Array(3).fill({ apexlang: 3, sql: 1 }),
    );
    return { initialSync, cycles };
  } finally {
    await rm(f.ctx.root, { recursive: true, force: true });
  }
}
const fullExport = await scenario(false);
const workingCopy = await scenario(true);
assert.deepEqual(workingCopy.initialSync.exports, { apexlang: 1, sql: 1 });
const sourceFiles = [
  'packages/core/src/sync.ts',
  'packages/core/src/deploy.ts',
  'packages/core/src/oracle.ts',
  'tests/fixtures/working-copy.ts',
  'tests/unit/working-copy.test.ts',
  'tests/unit/sync-metadata.test.ts',
  'scripts/measure-working-copy.mjs',
];
const evidence = {
  schemaVersion: 1,
  measuredAt: new Date().toISOString(),
  classification: 'local-fake-oracle-boundary',
  methods:
    'Real sync/plan/apply and bounded MCP response formatting; Oracle/compiler/test methods are fixtures. Wall time includes local filesystem work only.',
  matchedChanges: 3,
  fullExport,
  workingCopy,
  sourceHashes: Object.fromEntries(
    await Promise.all(sourceFiles.map(async (file) => [file, hash(await readFile(file))])),
  ),
  tokens: 'NOT MEASURED',
  billing: 'NOT MEASURED',
  connectedAcceptance: 'NOT RUN: no authorized DEV target',
  browserVerification: 'NOT RUN',
  initialRestore: 'NOT RUN against Oracle',
};
await atomicWrite(
  path.resolve('docs/evidence/working-copy-local.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);
console.log(
  'Matched local cycles: legacy 9 APEXlang + 3 SQL exports; working copy 0 + 0 after initial 1 + 1. Three imports each. No Oracle latency or token/billing claims.',
);
