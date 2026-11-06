import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { npmShimTarget, resolveCliCommand } from '../../packages/core/src/cli-command.ts';

// Shim text as npm's cmd-shim (9.x) writes it, from its fixed templates.
const HEAD =
  '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n';
const nodeShim = (target: string, flags = '') =>
  HEAD +
  '\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n)\r\n\r\n' +
  'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & ' +
  `set PATHEXT=%PATHEXT:;.JS;=;% & "%_prog%" ${flags} "%dp0%\\${target}" %*\r\n`;
const nativeShim = (target: string) => `${HEAD}"%dp0%\\${target}"   %*\r\n`;

test('npm cmd-shim lines are read as their Node script or native program', () => {
  assert.deepEqual(npmShimTarget(nodeShim('node_modules\\@openai\\codex\\bin\\codex.js')), {
    target: 'node_modules\\@openai\\codex\\bin\\codex.js',
    node: true,
    nodeArgs: [],
  });
  assert.deepEqual(npmShimTarget(nodeShim('..\\@anthropic-ai\\claude-code\\cli.js', '--no-warnings')), {
    target: '..\\@anthropic-ai\\claude-code\\cli.js',
    node: true,
    nodeArgs: ['--no-warnings'],
  });
  assert.deepEqual(npmShimTarget(nativeShim('node_modules\\tool\\bin\\tool.exe')), {
    target: 'node_modules\\tool\\bin\\tool.exe',
    node: false,
    nodeArgs: [],
  });
  // Not an npm shim, or one that runs something other than node: not recognised.
  assert.equal(npmShimTarget('@echo off\r\nC:\\tools\\codex.exe %*\r\n'), undefined);
  assert.equal(
    npmShimTarget(
      nodeShim('x.js').replaceAll('node.exe', 'sh.exe').replace('SET "_prog=node"', 'SET "_prog=sh"'),
    ),
    undefined,
  );
  assert.equal(npmShimTarget(nodeShim('x.js', '--eval=evil & calc')), undefined);
  assert.equal(npmShimTarget(nativeShim('node_modules\\tool\\run.bat')), undefined);
});

async function windowsHost(t: import('node:test').TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-cli-command-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const npm = path.join(root, 'npm');
  const project = path.join(root, 'project');
  await mkdir(path.join(npm, 'node_modules', '@openai', 'codex', 'bin'), { recursive: true });
  await mkdir(project, { recursive: true });
  const host = (PATH: string) => ({
    platform: 'win32' as const,
    env: { PATH, PATHEXT: '.COM;.EXE;.BAT;.CMD', ComSpec: 'C:\\Windows\\system32\\cmd.exe' },
    execPath: 'C:\\node\\node.exe',
  });
  return { root, npm, project, host };
}

test('on Windows an npm .cmd shim starts its Node script directly, without cmd.exe', async (t) => {
  const { npm, host } = await windowsHost(t);
  const script = path.join(npm, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  await writeFile(script, 'console.log(1)\n');
  await writeFile(path.join(npm, 'codex.cmd'), nodeShim('node_modules\\@openai\\codex\\bin\\codex.js'));
  // A planted codex.exe in a folder reachable only through a relative PATH entry, which would
  // resolve against the current directory (an untrusted checkout), is never searched. The folder
  // sits under the working directory: across Windows drives path.relative returns an absolute path.
  await mkdir(path.join(process.cwd(), '.apexrest'), { recursive: true });
  const planted = await mkdtemp(path.join(process.cwd(), '.apexrest', 'planted-cli-'));
  t.after(() => rm(planted, { recursive: true, force: true }));
  await writeFile(path.join(planted, 'codex.exe'), 'planted');
  const relative = path.relative(process.cwd(), planted);
  assert.equal(path.isAbsolute(relative), false);
  const schema = JSON.stringify({ type: 'object', properties: { verdict: { enum: ['approve'] } } });
  const resolved = await resolveCliCommand(
    'codex',
    ['-p', '--json-schema', schema],
    host(`${relative};${npm}`),
  );
  assert.deepEqual(resolved, {
    executable: 'C:\\node\\node.exe',
    args: [script, '-p', '--json-schema', schema],
  });
});

test('on Windows an .exe runs directly, other batch files use strict cmd.exe quoting, a missing CLI is reported', async (t) => {
  const { root, npm, host } = await windowsHost(t);
  const exeDir = path.join(root, 'native');
  await mkdir(exeDir, { recursive: true });
  await writeFile(path.join(exeDir, 'claude.exe'), 'MZ');
  assert.deepEqual(await resolveCliCommand('claude', ['--version'], host(exeDir)), {
    executable: path.join(exeDir, 'claude.exe'),
    args: ['--version'],
  });
  await writeFile(path.join(npm, 'codex.bat'), '@echo off\r\nC:\\tools\\codex.exe %*\r\n');
  const batch = await resolveCliCommand('codex', ['--version'], host(npm));
  assert.equal(batch.executable, 'C:\\Windows\\system32\\cmd.exe');
  assert.equal(batch.windowsVerbatimArguments, true);
  assert.match(batch.args.at(-1)!, /codex\.bat" "--version"/u);
  // Inline JSON cannot pass through cmd.exe safely: refused, nothing is run.
  await assert.rejects(resolveCliCommand('codex', ['--json-schema', '{"a":1}'], host(npm)), {
    code: 'UNSAFE_COMMAND_ARGUMENT',
  });
  // A shim whose target is missing falls back to cmd.exe rather than guessing.
  await writeFile(path.join(npm, 'gone.cmd'), nodeShim('node_modules\\gone\\cli.js'));
  assert.equal((await resolveCliCommand('gone', [], host(npm))).windowsVerbatimArguments, true);
  await assert.rejects(resolveCliCommand('absent', [], host(npm)), { code: 'DEPENDENCY_MISSING' });
  // Other platforms are unchanged.
  assert.deepEqual(await resolveCliCommand('codex', ['x'], { platform: 'linux' }), {
    executable: 'codex',
    args: ['x'],
  });
});
