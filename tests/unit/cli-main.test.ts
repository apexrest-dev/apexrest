import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { workspace } from '../fixtures/preview.ts';

// Unit tests run from the repository root (scripts/test.mjs).
const repository = process.cwd();

async function cli(t: import('node:test').TestContext) {
  const out = await mkdtemp(path.join(tmpdir(), 'apexrest-cli-'));
  t.after(() => rm(out, { recursive: true, force: true }));
  const file = path.join(out, 'apexrest.mjs');
  await build({
    entryPoints: [path.join(repository, 'packages/cli/src/main.ts')],
    outfile: file,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
    loader: { '.svg': 'text' },
  });
  const home = path.join(out, 'home');
  const run = (...args: string[]) => {
    const result = spawnSync(process.execPath, [file, ...args], {
      encoding: 'utf8',
      cwd: out,
      env: { ...process.env, APEXREST_HOME: home },
    });
    return { code: result.status, stdout: result.stdout };
  };
  return Object.assign(run, { file, home, dir: out });
}

test('help for an unknown command fails with an input error instead of printing general help', async (t) => {
  const run = await cli(t);
  for (const args of [
    ['bogus', '--help'],
    ['deploy', 'bogus', '-h'],
    ['test', 'unit', '--help'],
    ['test', 'auth', '--help'],
    ['deploy', 'verify', '--help'],
  ]) {
    const result = run(...args);
    assert.equal(result.code, 2, args.join(' '));
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.diagnostics[0].code, 'INVALID_INPUT');
    assert.match(parsed.summary, /Unknown command/);
  }
  for (const args of [['--help'], ['deploy', 'plan', '--help'], ['deploy', '--help']]) {
    const result = run(...args);
    assert.equal(result.code, 0, args.join(' '));
    assert.match(result.stdout, /^APEXREST for Codex and Claude Code/);
  }
});

test('per-command help prints only that command, without unsupported commands', async (t) => {
  const run = await cli(t);
  const general = run('--help');
  assert.equal(general.code, 0);
  assert.match(general.stdout, /^ {2}panel status$/m, 'panel status is a real, documented command');
  assert.doesNotMatch(general.stdout, /sandbox/);
  assert.match(run('sandbox', 'status', '--json').stdout, /Unknown command/);
  for (const [args, own] of [
    [['ship', '--help'], /--user-request VALUE/],
    [['preview', 'status', '--help'], /--port N/],
    [['preview', 'stop', '--help'], /--all\b/],
    [['apex', 'validate', '--help'], /--source-dir PATH/],
    [['status', '--help'], /--detail doctor\|project/],
    [['connection', 'add', '--help'], /Usage: apexrest connection add <name>/],
  ] as const) {
    const result = run(...args);
    assert.equal(result.code, 0, args.join(' '));
    assert.match(result.stdout, /^APEXREST for Codex and Claude Code/);
    assert.match(result.stdout, own, args.join(' '));
    assert.match(result.stdout, new RegExp(`Usage: apexrest ${args.slice(0, -1).join(' ')}`));
    // The global command list is not repeated.
    assert.doesNotMatch(result.stdout, /^ {2}docs search$/m, args.join(' '));
  }
  const group = run('deploy', '--help').stdout;
  assert.match(group, /^ {2}deploy plan$/m);
  assert.doesNotMatch(group, /^ {2}docs search$/m);
  // Boolean schema fields are bare flags.
  assert.match(run('apex', 'validate', '--help').stdout, /^ {2}--debug-timings$/m);
});

test('apex validate --source-dir works without a project and reports unknowable metadata', async (t) => {
  const run = await cli(t);
  const missing = JSON.parse(run('apex', 'validate', '--source-dir', 'nowhere', '--json').stdout);
  assert.equal(missing.diagnostics[0].code, 'VALIDATION_SOURCE_MISSING');
  await mkdir(path.join(run.dir, 'loose'), { recursive: true });
  await writeFile(path.join(run.dir, 'loose', 'application.apx'), 'application demo\n');
  const unknown = JSON.parse(run('apex', 'validate', '--source-dir', 'loose', '--json').stdout);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.diagnostics[0].code, 'MMD_METADATA_REQUIRED');
  assert.match(unknown.summary, /metadata version is unknown/);
});

test('a foreground preview start is listed and stopped from another CLI process', async (t) => {
  const run = await cli(t);
  const { root, app, assets } = await workspace(t);
  const child = spawn(
    process.execPath,
    [run.file, 'preview', 'start', '--source-dir', app, '--assets-dir', assets, '--port', '0', '--json'],
    { cwd: root, env: { ...process.env, APEXREST_HOME: run.home }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  t.after(() => child.kill('SIGKILL'));
  const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
  let stdout = '';
  const started = await new Promise<{ data: { url: string; sourceDir: string } }>((resolve, reject) => {
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      const line = stdout.split('\n').find((entry) => entry.startsWith('{') && entry.endsWith('}'));
      if (line) resolve(JSON.parse(line));
    });
    child.once('exit', () => reject(new Error('preview start exited: ' + stdout)));
  });
  const port = Number(new URL(started.data.url).port);
  const status = JSON.parse(run('preview', 'status', '--json').stdout);
  assert.equal(status.ok, true);
  assert.deepEqual(
    status.data.running.map((entry: { port: number; owner: string; sourceDir: string }) => [
      entry.port,
      entry.owner,
      entry.sourceDir,
    ]),
    [[port, 'cli', started.data.sourceDir]],
  );
  // --project is accepted by status (as by stop) and selects previews inside the project.
  const inside = JSON.parse(run('preview', 'status', '--project', root, '--json').stdout);
  assert.equal(inside.data.running.length, 1);
  const elsewhere = JSON.parse(run('preview', 'status', '--project', run.dir, '--json').stdout);
  assert.equal(elsewhere.data.running.length, 0);
  const other = String(port === 65535 ? 1 : port + 1);
  const wrongPort = JSON.parse(run('preview', 'stop', '--port', other, '--json').stdout);
  assert.equal(wrongPort.ok, false);
  assert.equal(wrongPort.status, 'not_found');
  const stop = run('preview', 'stop', '--source-dir', app, '--json');
  assert.equal(stop.code, 0, stop.stdout);
  const stopped = JSON.parse(stop.stdout);
  assert.deepEqual(stopped.data.stopped, [started.data.sourceDir]);
  assert.deepEqual(stopped.data.running, []);
  await exited;
  await assert.rejects(fetch(started.data.url));
  assert.deepEqual(JSON.parse(run('preview', 'status', '--json').stdout).data.running, []);
  const again = run('preview', 'stop', '--source-dir', app, '--json');
  assert.equal(again.code, 2);
  const nothing = JSON.parse(again.stdout);
  assert.equal(nothing.ok, false);
  assert.equal(nothing.status, 'not_found');
  assert.equal(nothing.diagnostics[0].code, 'PREVIEW_NOT_RUNNING');
});

test('retired application test commands cannot execute project code', async (t) => {
  const run = await cli(t);
  for (const suite of ['unit', 'sql', 'api', 'e2e', 'all', 'auth', 'report']) {
    const result = run('test', suite, '--json');
    assert.equal(result.code, 2, suite);
    assert.equal(JSON.parse(result.stdout).diagnostics[0].code, 'INVALID_INPUT');
  }
});

test('free-text search queries collect the remaining positional words', async (t) => {
  const run = await cli(t);
  // Validation fails after argument parsing, proving both words were accepted.
  const invalid = JSON.parse(run('docs', 'search', 'interactive', 'grid', '--limit', '99', '--json').stdout);
  assert.equal(invalid.ok, false);
  assert.doesNotMatch(invalid.summary, /Unexpected argument/);
  const duplicate = JSON.parse(run('docs', 'search', '--query', 'grid', 'extra', '--json').stdout);
  assert.match(duplicate.summary, /Unexpected argument: extra/);
  const extra = JSON.parse(run('jobs', 'status', '12345678-1234-4123-8123-123456789abc', 'extra').stdout);
  assert.match(extra.summary, /Unexpected argument: extra/);
});
