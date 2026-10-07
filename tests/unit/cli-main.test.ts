import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

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
  return (...args: string[]) => {
    const result = spawnSync(process.execPath, [file, ...args], {
      encoding: 'utf8',
      cwd: out,
      env: { ...process.env, APEXREST_HOME: path.join(out, 'home') },
    });
    return { code: result.status, stdout: result.stdout };
  };
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
    assert.match(result.stdout, /^APEXREST for Codex/);
  }
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
