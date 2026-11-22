import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';

async function runFixture(t, mutate) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-local-verification-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of [
    'bin',
    'packages',
    'scripts/lib',
    'plugins',
    'resources',
    'schemas',
    'templates',
    'toolchains',
    'site',
    'docs/evidence',
  ])
    await mkdir(path.join(root, directory), { recursive: true });
  for (const file of ['scripts/verify-local.mjs', 'scripts/lib/release.mjs'])
    await cp(file, path.join(root, file));
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module', version: '2.8.0' }));
  for (const file of [
    'package-lock.json',
    'publisher.config.json',
    'docs/deployment-safety.md',
    'tsconfig.base.json',
    'LICENSE',
    'NOTICE',
    'packages/source.txt',
  ])
    await writeFile(path.join(root, file), 'Frozen fixture source\n');
  const handler = path.join(root, 'bin', 'npm-handler.mjs');
  await writeFile(
    handler,
    `import { appendFile, writeFile } from 'node:fs/promises';
const args = process.argv.slice(2);
await appendFile('calls.jsonl', JSON.stringify(args) + '\\n');
if (process.env.APEXREST_TEST_SOURCE_MUTATION === 'true' && args[1] === 'test:unit')
  await writeFile('packages/source.txt', 'Changed after the candidate was frozen\\n');
`,
  );
  const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
  const executable = path.join(root, 'bin', process.platform === 'win32' ? 'npm.cmd' : 'npm');
  await writeFile(
    executable,
    process.platform === 'win32'
      ? `@"${process.execPath}" "${handler}" %*\r\n`
      : `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(handler)} "$@"\n`,
    { mode: 0o700 },
  );
  const initial = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import {sourceDigest} from './scripts/lib/release.mjs'; console.log(await sourceDigest());",
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(initial.status, 0, initial.stderr);
  const result = spawnSync(process.execPath, ['scripts/verify-local.mjs'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
    env: {
      ...process.env,
      PATH: path.join(root, 'bin') + path.delimiter + process.env.PATH,
      APEXREST_TEST_SOURCE_MUTATION: String(mutate),
    },
  });
  assert.equal(result.error, undefined);
  const report = JSON.parse(await readFile(path.join(root, 'docs/evidence/local-checks.json'), 'utf8'));
  const calls = (await readFile(path.join(root, 'calls.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  return { result, report, calls, initialDigest: initial.stdout.trim() };
}

test('local qualification retains the frozen source digest and includes current CI checks', async (t) => {
  const { result, report, calls, initialDigest } = await runFixture(t, false);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(report.status, 'passed');
  assert.equal(report.sourceDigest, initialDigest);
  assert.equal(report.finalSourceDigest, undefined);
  assert.ok(calls.some((args) => args[1] === 'docs:check'));
  assert.ok(calls.some((args) => args[1] === 'composer:check'));
});

test('successful command exits cannot credit changed untested source as passing qualification', async (t) => {
  const { result, report, initialDigest } = await runFixture(t, true);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(report.status, 'failed');
  assert.equal(report.sourceDigest, initialDigest);
  assert.notEqual(report.finalSourceDigest, initialDigest);
  assert.ok(report.checks.every(({ exitCode }) => exitCode === 0));
  assert.match(report.blocker, /sources changed during verification/);
});
