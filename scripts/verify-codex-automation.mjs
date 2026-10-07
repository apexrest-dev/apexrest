// Reproducible local transport/worker evidence. No Oracle or model execution.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { sourceDigest } from './lib/release.mjs';

const output = process.argv[2] ?? 'docs/evidence/current-session-100-runtime.json';
const temporary = await mkdtemp(path.join(tmpdir(), 'apexrest-automation-'));
const project = path.join(await realpath(temporary), 'project');
const managed = path.join(temporary, 'managed');
const runtime = path.resolve('dist/runtime');
const forbidden = path.join(temporary, 'forbidden-execution');
const guard = path.join(temporary, 'deny-external.mjs');
const env = {
  ...process.env,
  APEXREST_HOME: managed,
  APEXREST_RESOURCES: path.resolve('dist/resources'),
  APEXREST_CODEX: guard,
  APEXREST_SQLCL: guard,
};
delete env.APEXREST_BROWSER_MODE;
const evidence = {
  schemaVersion: 1,
  timestamp: new Date().toISOString(),
  sourceDigest: await sourceDigest(),
  scope:
    'Built stdio MCP and CLI with a disposable trusted existing-app project. No model turn, Codex App Server, Oracle, application import, or browser verification. Byte sizes describe tool response text, not billed tokens.',
  node: process.version,
  platform: process.platform,
  status: 'running',
  calls: { cli: 0, listTools: 0, tools: 0, byTool: {} },
  checks: [],
};
const client = new Client({ name: 'codex-automation-verification', version: '1' });
let connected = false;
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const call = async (name, args = {}, expectedOk = true) => {
  assert.ok(evidence.calls.tools < 2, 'Runtime verification has a fixed two-call tool budget.');
  evidence.calls.tools++;
  evidence.calls.byTool[name] = (evidence.calls.byTool[name] ?? 0) + 1;
  const started = performance.now();
  const response = await client.callTool({ name, arguments: { project, ...args } }, undefined, {
    timeout: 35000,
  });
  assert.equal(response.isError, !expectedOk);
  assert.equal(response.structuredContent, undefined);
  const text = response.content.find((item) => item.type === 'text')?.text;
  assert.equal(typeof text, 'string');
  const envelope = JSON.parse(text);
  assert.equal(envelope.ok, expectedOk, envelope.summary);
  return {
    envelope,
    bytes: Buffer.byteLength(text, 'utf8'),
    elapsedMs: Math.round((performance.now() - started) * 100) / 100,
  };
};

try {
  await mkdir(managed);
  await writeFile(
    guard,
    `#!${process.execPath}
import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(forbidden)}, 'Unexpected external tool invocation');
process.exit(99);
`,
    { mode: 0o700 },
  );
  evidence.calls.cli++;
  const initialized = spawnSync(
    process.execPath,
    [
      path.join(runtime, 'apexrest.mjs'),
      'project',
      'init',
      project,
      '--template',
      'existing-app',
      '--alias',
      'automation-fixture',
      '--json',
    ],
    { env, encoding: 'utf8', timeout: 10000 },
  );
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
  assert.equal(JSON.parse(initialized.stdout).ok, true);
  await writeFile(
    path.join(managed, 'policy.json'),
    JSON.stringify({ schemaVersion: 1, trustedProjects: [project], grants: [] }),
  );
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.join(runtime, 'mcp.mjs')],
      env,
      stderr: 'pipe',
    }),
  );
  connected = true;
  evidence.calls.listTools++;
  const catalog = await client.listTools();
  // The 2026-10-04 redesign: ten tools; apex.validate runs in-process and
  // apexrest_ship waits longer than the job tools (packages/mcp/src/job-tools.ts).
  assert.equal(catalog.tools.length, 10);
  const longTools = {
    apexrest_apex_sync: { maximum: 30, default: 25 },
    apexrest_ship: { maximum: 120, default: 25 },
  };
  for (const [name, wait] of Object.entries(longTools)) {
    const schema = catalog.tools.find((tool) => tool.name === name)?.inputSchema;
    assert.ok(schema, name);
    assert.equal(schema.properties.waitSeconds.type, 'integer');
    assert.equal(schema.properties.waitSeconds.minimum, 0);
    assert.equal(schema.properties.waitSeconds.maximum, wait.maximum);
    assert.equal(schema.properties.waitSeconds.default, wait.default);
    assert.ok(!schema.required?.includes('waitSeconds'));
  }
  for (const name of ['apexrest_apex_validate', 'apexrest_project', 'apexrest_reference', 'apexrest_status'])
    assert.equal(
      catalog.tools.find((tool) => tool.name === name)?.inputSchema.properties.waitSeconds,
      undefined,
      `${name} is in-process`,
    );
  assert.ok(catalog.tools.every((tool) => !/^apexrest_(team|work|compose|panel)_/.test(tool.name)));
  evidence.checks.push('no-agent-start-or-orchestration-tools');
  evidence.catalog = {
    tools: catalog.tools.length,
    longToolsWithOptionalWait: Object.keys(longTools).length,
    defaultWaitSeconds: { job: 25, ship: 25 },
  };
  evidence.checks.push('real-stdio-catalog-and-optional-wait-schema');

  const source = path.join(project, 'src/apex/automation-fixture');
  await mkdir(source, { recursive: true });
  await Promise.all(
    Array.from({ length: 50 }, (_, i) =>
      writeFile(path.join(source, `page-${i}.apx`), `// synthetic local source ${i}\n`),
    ),
  );
  const summary = await call('apexrest_project', { action: 'inspect', detail: 'summary' });
  const full = await call('apexrest_project', { action: 'inspect', detail: 'full' });
  assert.equal(summary.envelope.data.sources, undefined);
  assert.equal(summary.envelope.data.output, undefined);
  assert.equal(summary.envelope.data.targetVerified, false);
  assert.equal(Object.keys(full.envelope.data.sources.apex).length, 50);
  assert.ok(Object.values(full.envelope.data.sources.apex).every((digest) => /^[a-f0-9]{64}$/.test(digest)));
  assert.ok(summary.bytes < full.bytes);
  evidence.projectInspect = {
    syntheticSourceFiles: 50,
    summaryTextBytes: summary.bytes,
    fullTextBytes: full.bytes,
    reductionPercent: Math.round((1 - summary.bytes / full.bytes) * 10000) / 100,
    summaryContainsHashMap: false,
    fullHashCount: 50,
    summaryElapsedMs: summary.elapsedMs,
    fullElapsedMs: full.elapsedMs,
  };
  evidence.checks.push('summary-without-source-hashes-versus-full-inventory');
  assert.equal(await readFile(forbidden, 'utf8').catch(() => null), null);
  evidence.checks.push('no-codex-app-server-or-sqlcl-execution');
  assert.equal(evidence.calls.tools, 2);
  evidence.status = 'passed';
} catch (error) {
  evidence.status = 'failed';
  evidence.failure = String(error).replaceAll(temporary, '<temporary-directory>');
  process.exitCode = 1;
} finally {
  if (connected) await client.close();
  // On an assertion failure, stop only this fixture's still-active local jobs.
  const jobsRoot = path.join(project, '.apexrest/jobs');
  const jobs = await readdir(jobsRoot).catch(() => []);
  for (const id of jobs) {
    const stateFile = path.join(jobsRoot, id, 'state.json');
    let state = await readJson(stateFile).catch(() => null);
    if (!['queued', 'running'].includes(state?.status)) continue;
    await writeFile(
      path.join(jobsRoot, id, 'cancel.json'),
      JSON.stringify({ requestedAt: new Date().toISOString() }),
    );
    const deadline = Date.now() + 5000;
    while (['queued', 'running'].includes(state?.status) && Date.now() < deadline) {
      await delay(250);
      state = await readJson(stateFile).catch(() => null);
    }
  }
  await rm(temporary, { recursive: true, force: true });
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
