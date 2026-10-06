import { build } from 'esbuild';
import { readdir, readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { sourceDigest, sha256 } from './lib/release.mjs';
const root = path.resolve('.apexrest/measure');
await mkdir(root, { recursive: true });
await build({
  stdin: {
    contents:
      "export { listTools } from './packages/mcp/src/server.ts'; export { OracleAdapter } from './packages/core/src/oracle.ts'; export { closeSqlclSessions } from './packages/core/src/sqlcl-session.ts';",
    resolveDir: process.cwd(),
  },
  outfile: path.join(root, 'catalog.mjs'),
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const { listTools, OracleAdapter, closeSqlclSessions } = await import(path.join(root, 'catalog.mjs'));
const tools = listTools();
const skills = {};
for (const name of (await readdir('plugins/apexrest-apex/skills')).sort())
  skills[name] = (await readFile(`plugins/apexrest-apex/skills/${name}/SKILL.md`)).length;
const evidence = {
  schemaVersion: 1,
  sourceDigest: await sourceDigest(),
  asOf: '2026-10-05',
  release: '1.3.0-beta.2',
  scope:
    'Local source measurements and optional offline compiler only; no connected Oracle or native-host calls.',
  command: 'node scripts/measure-redesign-local.mjs',
  node: process.version,
  measurements: {
    toolCount: tools.length,
    toolCatalogUtf8Bytes: Buffer.byteLength(JSON.stringify(tools)),
    skillFiles: skills,
    skillUtf8Bytes: Object.values(skills).reduce((a, b) => a + b, 0),
  },
  unverifiedHistoricalEstimates: {
    coldValidateMs: 3200,
    warmValidateMs: 43,
    coldProbeMs: 1500,
    warmProbeMs: 0,
    oldCatalogBytesApprox: 24000,
    oldSkillBytesApprox: 41000,
    precisionAt1: '16 to 48; no reproducible matched benchmark available',
  },
  limitations: [
    'Timing and ranking estimates have no reproducible source-bound record and are UNVERIFIED; not reproduced in this review.',
    'Historical size baseline is UNVERIFIED; current exact UTF-8 source byte counts only.',
    'Connected Oracle: NOT RUN.',
    'Native host Codex/Claude Code: NOT RUN.',
    'Generated release readiness and site manifests are regenerated artifacts, not committed qualification.',
  ],
};
if (process.argv.includes('--offline-compiler')) {
  if (!process.env.APEXREST_SQLCL || !process.env.APEXREST_JAVA_HOME)
    throw new Error('Set APEXREST_SQLCL and APEXREST_JAVA_HOME to the reviewed local installation.');
  const home = await mkdtemp(path.join(root, 'home-'));
  const previous = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = home;
  const oracle = new OracleAdapter();
  let generated;
  try {
    const measure = async (call) => {
      const started = performance.now();
      await call();
      return Number((performance.now() - started).toFixed(2));
    };
    const probeColdMs = await measure(() => oracle.requireCapability('validate'));
    const probeWarmMs = await measure(() => oracle.requireCapability('validate'));
    generated = await oracle.generate('Offline measurement', 'offline_measurement');
    await closeSqlclSessions();
    const validateMs = [];
    for (let i = 0; i < 4; i++) validateMs.push(await measure(() => oracle.validate(generated.directory)));
    evidence.offlineCompiler = {
      command:
        'APEXREST_SQLCL="' +
        process.env.APEXREST_SQLCL +
        '" APEXREST_JAVA_HOME="' +
        process.env.APEXREST_JAVA_HOME +
        '" node scripts/measure-redesign-local.mjs --offline-compiler',
      version: (await oracle.requireCapability('validate')).version,
      inputDigest: sha256(JSON.stringify(generated.files)),
      probeColdMs,
      probeWarmMs,
      validateMs,
      method:
        'Fresh isolated home; cold capability check then cached check. Generate scaffold, close pooled servers, validate once on a fresh server and three times on the reused server. Four sequential samples, not a statistical benchmark or connected performance claim.',
    };
  } finally {
    await closeSqlclSessions();
    if (generated) await rm(generated.directory, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    if (previous === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = previous;
  }
}
await writeFile('docs/evidence/redesign-phase1-local.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence.measurements));
