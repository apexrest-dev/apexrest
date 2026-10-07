import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const run = (...args) =>
  spawnSync(process.execPath, ['dist/runtime/apexrest.mjs', ...args], {
    encoding: 'utf8',
    timeout: 10000,
  });

test('bare CLI remains non-interactive in pipes and help includes the full command catalog', () => {
  const bare = run();
  assert.equal(bare.status, 0, bare.stderr);
  assert.match(bare.stdout, /panel status/);
  assert.doesNotMatch(bare.stdout, /\btui\b|panel (?:open|action)/);
  assert.match(bare.stdout, /docs read/);
  assert.match(bare.stdout, /metadata read/);
  assert.match(bare.stdout, /\n  ship\n/);
  assert.match(bare.stdout, /\n  status\n/);
  assert.match(bare.stdout, /deploy apply/);
  assert.match(bare.stdout, /compose plan/);
  assert.match(bare.stdout, /job status\|cancel/);
  assert.doesNotMatch(bare.stdout, /\n  (?:project|reference|job)\n|ship apply/);
  assert.doesNotMatch(bare.stdout, /\x1b/);
  assert.equal(run('--help').stdout, bare.stdout);
});

test('removed terminal UI and panel commands fail as unknown commands with structured input failures', () => {
  for (const args of [
    ['tui'],
    ['tui', '--project', '.'],
    ['panel', 'tui'],
    ['panel', 'open', '--json'],
    ['panel', 'action', '--action', '{"kind":"validate"}', '--json'],
    ['--panel-worker', '.'],
  ]) {
    const result = run(...args);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.diagnostics[0].code, 'INVALID_INPUT');
    assert.doesNotMatch(result.stdout, /\x1b/);
  }
});

test('merged CLI commands map onto the granular operations', () => {
  const ship = run('ship', '--help');
  assert.equal(ship.status, 0);
  assert.match(ship.stdout, /--user-request/);
  assert.match(ship.stdout, /--import-mode auto\|full\|files defaults to auto/);
  assert.match(ship.stdout, /--files PATH1 PATH2/);
  assert.match(ship.stdout, /mode apply: DEV\/QA\/TEST only/);
  const status = run('status', '--help');
  assert.match(status.stdout, /--detail/);
  const job = run('job', 'status', '--help');
  assert.equal(job.status, 0, job.stdout);
  assert.match(job.stdout, /Options for jobs status/);
  const reference = run('reference', 'search', 'validate', '--json');
  assert.equal(reference.status, 0, reference.stdout);
  assert.equal(JSON.parse(reference.stdout).operation, 'docs.search');
  const missingRequest = run('ship', '--env', 'dev', '--json');
  assert.equal(missingRequest.status, 2);
  assert.match(JSON.parse(missingRequest.stdout).summary, /userRequest/);
  const doctor = run('status', '--detail', 'doctor', '--json');
  assert.equal(doctor.status, 0, doctor.stdout);
  assert.equal(JSON.parse(doctor.stdout).operation, 'status');
});

test('CLI parses explicit file lists and rejects ambiguous import scopes before project access', async (t) => {
  const project = await mkdtemp(path.join(tmpdir(), 'apexrest-import-interface-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  const base = ['ship', '--project', project, '--env', 'dev', '--user-request', 'Deploy the selected pages'];
  const valid = run(
    ...base,
    '--import-mode',
    'files',
    '--files',
    'pages/p00010.apx',
    'shared_components/lovs/status.apx',
    '--json',
  );
  assert.equal(
    JSON.parse(valid.stdout).diagnostics[0].code,
    'PROJECT_NOT_CONFIGURED',
    'Both file paths reach dispatch as one array',
  );
  for (const flags of [
    ['--import-mode', 'files'],
    ['--import-mode', 'full', '--files', 'pages/p00010.apx'],
    ['--import-mode', 'files', '--files', '../outside.apx'],
    ['--import-mode', 'files', '--files'],
  ]) {
    const result = run(...base, ...flags, '--json');
    assert.equal(result.status, 2, result.stdout);
    assert.equal(JSON.parse(result.stdout).diagnostics[0].code, 'INVALID_INPUT');
  }
});

test('explicit commands preserve JSON output and core failures', () => {
  const version = run('version', '--json');
  assert.equal(version.status, 0);
  assert.equal(JSON.parse(version.stdout).operation, 'version');
  assert.equal(version.stdout.trim().split('\n').length, 1);
  assert.doesNotMatch(version.stdout, /\x1b/);
  const invalid = run('project', 'adopt', '--app-id', '0', '--env', 'dev', '--json');
  assert.equal(invalid.status, 2);
  assert.equal(JSON.parse(invalid.stdout).ok, false);
});

test('SQLcl mode CLI persists across processes and rejects unsupported modes without changing the saved value', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'apexrest-mode-cli-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const command = (...args) =>
    spawnSync(process.execPath, ['dist/runtime/apexrest.mjs', 'sqlcl', ...args, '--json'], {
      encoding: 'utf8',
      env: { ...process.env, APEXREST_HOME: home },
      timeout: 10000,
    });
  assert.equal(JSON.parse(command('status').stdout).data.mode, 'cli');
  assert.equal(command('configure', '--mode', 'mcp', '--mcp-restrict-level', '1').status, 0);
  assert.deepEqual(JSON.parse(command('status').stdout).data, {
    schemaVersion: 1,
    mode: 'mcp',
    mcpRestrictLevel: '1',
  });
  const saved = await readFile(path.join(home, 'sqlcl.json'), 'utf8');
  assert.equal(command('configure', '--mode', 'unknown').status, 2);
  assert.equal(command('configure', '--mode', 'mcp', '--mcp-restrict-level', '0').status, 2);
  assert.equal(await readFile(path.join(home, 'sqlcl.json'), 'utf8'), saved);
});
