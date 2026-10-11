import { readFile, mkdir, writeFile, cp, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { build } from 'esbuild';
import { sha256 } from './release.mjs';

export const defaultCatalog = 'tests/plugin-server/apex-26.1.cases.json';
export async function loadHarness(values) {
  const profile = values.profile ?? '26.1';
  if (!['26.1', '26.2'].includes(profile)) throw new Error('Unknown APEX profile.');
  const catalogFile = path.resolve(values.catalog ?? defaultCatalog);
  const bytes = await readFile(catalogFile);
  const catalog = JSON.parse(bytes);
  if (catalog.apexRelease && !catalog.apexRelease.startsWith(profile))
    throw new Error('Catalog/profile mismatch.');
  const quality = JSON.parse(await readFile('tests/plugin-server/quality-performance.json', 'utf8'));
  return { profile, catalogFile, catalog, quality, catalogDigest: sha256(bytes) };
}
export function budgetKey(name, args, result) {
  if (result?.ok === false) return 'error';
  if (name === 'apexrest_project' && args.action === 'inspect' && args.detail === 'summary')
    return 'projectSummary';
  if (name === 'apexrest_metadata_read') return 'metadataPageDefaultLimit';
  if (name === 'apexrest_reference')
    return args.mode === 'search' && args.limit === 3
      ? 'referenceSearchLimit3'
      : args.mode === 'read'
        ? 'referenceRead'
        : null;
  if (name === 'apexrest_ship' && args.mode === 'plan') return 'plan';
  if (name === 'apexrest_job' && result?.data?.result) return 'jobCompletion';
  return null;
}
export function inspectResponse(quality, name, args, result) {
  const serialized = JSON.stringify(result),
    key = budgetKey(name, args, result);
  const bytes = Buffer.byteLength(serialized),
    budget = key ? quality.responseByteBudgets[key] : null;
  return {
    tool: name,
    action: ['inspect', 'connection_test', 'status', 'init', 'plan', 'apply', 'search', 'read'].includes(
      args.action ?? args.mode,
    )
      ? (args.action ?? args.mode)
      : null,
    bytes,
    budgetKey: key,
    budget,
    overrun: budget == null ? null : bytes > budget,
    stackTrace: /(?:\n|\\n)\s*at\s+[^\n]+(?:\:\d+\:\d+\)?)/.test(serialized),
  };
}
export function regressionGate(quality, baseline, current, previousEnvironment, environment, equalQuality) {
  if (!equalQuality)
    return {
      regression: 'not_comparable',
      reason: 'Quality outcomes differ or baseline quality is unconfirmed.',
    };
  for (const key of ['machine', 'sqlcl', 'target'])
    if (
      !previousEnvironment?.[key] ||
      JSON.stringify(previousEnvironment[key]) !== JSON.stringify(environment[key])
    )
      return { regression: 'not_comparable', reason: `Missing or different ${key} fingerprint.` };
  const medianPercent = (current.medianMs / baseline.medianMs - 1) * 100,
    p95Percent = baseline.p95Ms == null ? null : (current.p95Ms / baseline.p95Ms - 1) * 100;
  return {
    regression:
      medianPercent > quality.regressionGate.medianRegressionPercent ||
      (p95Percent != null && p95Percent > quality.regressionGate.p95RegressionPercent),
    medianPercent,
    p95Percent,
  };
}
export function prerequisite(definition, capabilities = {}) {
  if (!definition.prerequisite) return null;
  return (definition.id === 'A261-067' ? capabilities.prewarm : capabilities.readPool)
    ? null
    : definition.prerequisite;
}
export function runProcess(command, args, { input = '', cwd, timeoutMs = 600000, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '',
      stderr = '',
      timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);
    child.stdout.on('data', (b) => {
      stdout += b;
    });
    child.stderr.on('data', (b) => {
      stderr += b;
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, timedOut, stdout, stderr, pid: child.pid });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
export async function connectHarness() {
  const client = new Client({ name: 'apexrest-quality-performance', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('dist/runtime/mcp.mjs')],
    stderr: 'pipe',
  });
  await client.connect(transport);
  return {
    client,
    transport,
    call: async (name, args) =>
      JSON.parse(
        (await client.callTool({ name, arguments: args }, undefined, { timeout: 600000 })).content.find(
          (c) => c.type === 'text',
        ).text,
      ),
  };
}
export async function privateCopy(project, destination) {
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const config = JSON.parse(await readFile(path.join(project, 'apexrest.json'), 'utf8'));
  await writeFile(path.join(destination, 'apexrest.json'), JSON.stringify(config, null, 2), { mode: 0o600 });
  await cp(
    path.join(project, config.application.sourceDir),
    path.join(destination, config.application.sourceDir),
    { recursive: true },
  );
  await cp(
    path.join(project, 'apexrest.toolchain.lock.json'),
    path.join(destination, 'apexrest.toolchain.lock.json'),
  ).catch(() => {});
  return destination;
}
export async function fileInventory(directory, prefix = '') {
  const result = {};
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Symlink in private input.');
    const file = path.join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(result, await fileInventory(directory, file));
    else result[file] = sha256(await readFile(path.join(directory, file)));
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}
export async function coreHelpers(directory) {
  const outfile = path.resolve(directory, 'core-helpers.mjs');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await build({
    stdin: {
      contents:
        "export {resolveConnection} from './packages/core/src/connections.ts'; export {readLocalEnv} from './packages/core/src/local-env.ts';",
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
  });
  return import(outfile);
}
export function machineFingerprint() {
  return { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, node: process.version };
}
