import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { zipSync } from 'fflate';
import { exists, hash, readJson, writeJson } from '../../packages/core/src/fs.ts';
import { assertPrivateCache, download, proxyStatus } from '../../packages/installer/src/download.ts';
import type { Artifact } from '../../packages/installer/src/download.ts';
import { archivePath, extractArchive, extractVerifiedArchive } from '../../packages/installer/src/archive.ts';
import { resolveCommand, searchPath } from '../../packages/installer/src/command.ts';
import {
  ToolchainService,
  browserEnvironment,
  canonicalHome,
  runtimeState,
} from '../../packages/installer/src/toolchain.ts';
import { launcherScripts } from '../../packages/installer/src/native.ts';
import { uninstallTools } from '../../packages/installer/src/uninstall-tools.ts';

const posixOnly = process.platform === 'win32' ? 'Fixture executables use a POSIX shell.' : false;
const temporary = async () => realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-hardening-')));
const bytes = Buffer.from('verified download fixture');
const artifact: Artifact = {
  id: 'node',
  version: '1.0.0',
  url: 'https://vendor.test/v1.0.0/runtime.zip',
  sha256: hash(bytes),
  os: 'darwin',
  arch: 'arm64',
  type: 'zip',
  executable: 'node',
  allowedHosts: ['vendor.test'],
  license: 'test fixture',
  consentRequired: false,
};
const fast = { retryDelayMs: 0, headersTimeoutMs: 200, idleTimeoutMs: 200 };

test('stalled body hits the idle timeout and the download restarts (local fetch fixture)', async (t) => {
  const cache = await temporary();
  t.after(() => rm(cache, { recursive: true, force: true }));
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    if (calls === 1)
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.subarray(0, 5)); // then never another chunk
          },
        }),
      );
    return new Response(bytes);
  }) as typeof fetch;
  const file = await download(artifact, cache, false, fetcher, fast);
  assert.equal(calls, 2);
  assert.deepEqual(await readFile(file), bytes);
  assert.deepEqual(await readdir(cache), [artifact.sha256]);
});

test('slow but steady bodies are not cut off by a whole-download deadline', async (t) => {
  const cache = await temporary();
  t.after(() => rm(cache, { recursive: true, force: true }));
  const pieces = [...bytes].map((value) => Uint8Array.of(value));
  const fetcher = (async () =>
    new Response(
      new ReadableStream({
        async pull(controller) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          const next = pieces.shift();
          if (next) controller.enqueue(next);
          else controller.close();
        },
      }),
    )) as typeof fetch;
  // ~25 chunks x 20 ms exceeds the 200 ms idle limit in total, but never between chunks.
  const file = await download(artifact, cache, false, fetcher, { ...fast, attempts: 1 });
  assert.deepEqual(await readFile(file), bytes);
});

test('missing headers and 5xx responses are retried; exhaustion is reported (local fetch fixture)', async (t) => {
  const cache = await temporary();
  t.after(() => rm(cache, { recursive: true, force: true }));
  let calls = 0;
  const flaky = (async () => {
    calls++;
    if (calls === 1) return new Promise<Response>(() => {}); // headers never arrive
    if (calls === 2) return new Response('busy', { status: 503 });
    return new Response(bytes);
  }) as typeof fetch;
  assert.deepEqual(await readFile(await download(artifact, cache, false, flaky, fast)), bytes);
  assert.equal(calls, 3);
  await rm(path.join(cache, artifact.sha256));
  let failing = 0;
  await assert.rejects(
    download(
      artifact,
      cache,
      false,
      (async () => {
        failing++;
        return new Response('down', { status: 502 });
      }) as typeof fetch,
      fast,
    ),
    { code: 'DOWNLOAD_FAILED', message: /HTTP 502/ },
  );
  assert.equal(failing, 3);
  assert.deepEqual(await readdir(cache), []);
});

test('integrity failures are not retried', async (t) => {
  const cache = await temporary();
  t.after(() => rm(cache, { recursive: true, force: true }));
  let calls = 0;
  await assert.rejects(
    download(
      artifact,
      cache,
      false,
      (async () => {
        calls++;
        return new Response('corrupt');
      }) as typeof fetch,
      fast,
    ),
    { code: 'INTEGRITY_FAILURE' },
  );
  assert.equal(calls, 1);
});

test('shared or foreign-writable caches are refused before use', { skip: posixOnly }, async (t) => {
  const root = await temporary();
  t.after(() => rm(root, { recursive: true, force: true }));
  const cache = path.join(root, 'cache');
  await mkdir(cache);
  await chmod(cache, 0o777);
  await assert.rejects(assertPrivateCache(cache), { code: 'UNSAFE_CACHE_DIRECTORY' });
  await assert.rejects(download(artifact, cache, true), { code: 'UNSAFE_CACHE_DIRECTORY' });
  await chmod(cache, 0o755);
  await assertPrivateCache(cache);
});

test('proxy reporting reflects how Node will route downloads', () => {
  assert.equal(proxyStatus({}, []).support, 'not-configured');
  const configured = proxyStatus({ HTTPS_PROXY: 'http://proxy.test:3128', NO_PROXY: 'localhost' }, []);
  assert.equal(configured.configured, true);
  assert.equal(configured.noProxy, true);
  assert.deepEqual(configured.variables, ['HTTPS_PROXY']);
  assert.ok(['available', 'enabled-by-installer', 'unsupported'].includes(configured.support));
  assert.equal(
    proxyStatus({ HTTP_PROXY: 'http://proxy.test:3128', NODE_USE_ENV_PROXY: '1' }, []).support,
    'node-env-proxy',
  );
  assert.equal(proxyStatus({ https_proxy: 'http://p.test' }, ['--use-env-proxy']).support, 'node-env-proxy');
});

test('archive names are normalized before the duplicate check', async (t) => {
  const root = await temporary();
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ['a/./b', 'a//b', '.', 'a/.', './/a'])
    assert.throws(() => archivePath(name), { code: 'UNSAFE_ARCHIVE' }, name);
  assert.equal(archivePath('./dir/'), 'dir/');
  const tar = await import('tar');
  const entry = (
    name: string,
    body = '',
    type: 'File' | 'Directory' | 'SymbolicLink' = 'File',
    linkpath?: string,
  ) => {
    const header = Buffer.alloc(512);
    new tar.Header({
      path: name,
      type,
      size: body.length,
      mode: 0o644,
      ...(linkpath ? { linkpath } : {}),
    }).encode(header);
    const data = Buffer.alloc(Math.ceil(body.length / 512) * 512);
    data.write(body);
    return Buffer.concat([header, data]);
  };
  const archive = async (name: string, ...entries: Buffer[]) => {
    const file = path.join(root, name);
    await writeFile(file, gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)])));
    return file;
  };
  const duplicate = await archive('dup.tar.gz', entry('a', 'one'), entry('./a', 'two'));
  await assert.rejects(extractArchive(duplicate, path.join(root, 'dup'), 'tar.gz'), {
    code: 'DUPLICATE_ARCHIVE_ENTRY',
  });
  const dirFile = await archive('dir-file.tar.gz', entry('x/', '', 'Directory'), entry('x', 'file'));
  await assert.rejects(extractArchive(dirFile, path.join(root, 'dir-file'), 'tar.gz'), {
    code: 'DUPLICATE_ARCHIVE_ENTRY',
  });
  const zipDuplicate = path.join(root, 'dup.zip');
  await writeFile(zipDuplicate, zipSync({ 'z/': new Uint8Array(), './z': Buffer.from('x') }));
  await assert.rejects(extractArchive(zipDuplicate, path.join(root, 'zip-dup'), 'zip'), {
    code: 'DUPLICATE_ARCHIVE_ENTRY',
  });

  // Links are created in dependency order, whatever their archive order.
  const chained = await archive(
    'chain.tar.gz',
    entry('bin/first', '', 'SymbolicLink', 'second'),
    entry('bin/second', '', 'SymbolicLink', 'real'),
    entry('bin/real', 'payload'),
  );
  await extractArchive(chained, path.join(root, 'chain'), 'tar.gz', true);
  assert.equal(await readFile(path.join(root, 'chain/bin/first'), 'utf8'), 'payload');
  const cyclic = await archive(
    'cycle.tar.gz',
    entry('one', '', 'SymbolicLink', 'two'),
    entry('two', '', 'SymbolicLink', 'one'),
  );
  await assert.rejects(extractArchive(cyclic, path.join(root, 'cycle'), 'tar.gz', true), {
    code: 'UNSAFE_ARCHIVE',
  });
  const shadow = await archive(
    'shadow.tar.gz',
    entry('lib', '', 'SymbolicLink', 'elsewhere'),
    entry('lib/inner.txt', 'data'),
    entry('elsewhere/', '', 'Directory'),
  );
  await assert.rejects(extractArchive(shadow, path.join(root, 'shadow'), 'tar.gz', true), {
    code: 'UNSAFE_ARCHIVE',
    message: /shadows/,
  });
});

test('verified extraction reads a private hashed copy, not the cache file', async (t) => {
  const root = await temporary();
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'cached.zip');
  const contents = zipSync({ 'tool/bin': Buffer.from('ok') });
  await writeFile(file, contents);
  const staging = path.join(root, 'install', 'staging');
  await assert.rejects(extractVerifiedArchive(file, 'f'.repeat(64), staging, 'zip'), {
    code: 'INTEGRITY_FAILURE',
  });
  assert.equal(await exists(path.join(staging, 'tool/bin')), false);
  assert.deepEqual(
    (await readdir(path.join(root, 'install'))).filter((name) => name.startsWith('.archive-')),
    [],
  );
  await extractVerifiedArchive(file, hash(Buffer.from(contents)), staging, 'zip');
  assert.equal(await readFile(path.join(staging, 'tool/bin'), 'utf8'), 'ok');
  assert.deepEqual(await readdir(path.join(root, 'install')), ['staging']);
});

test('Windows command resolution uses PATHEXT and wraps batch shims for cmd.exe', async (t) => {
  const root = await temporary();
  t.after(() => rm(root, { recursive: true, force: true }));
  const shims = path.join(root, 'npm global');
  const binaries = path.join(root, 'bin');
  await mkdir(shims);
  await mkdir(binaries);
  await writeFile(path.join(shims, 'codex'), 'extensionless shell shim');
  await writeFile(path.join(shims, 'codex.cmd'), '@echo off');
  await writeFile(path.join(binaries, 'sql.exe'), 'binary');
  await writeFile(path.join(binaries, 'sql'), 'extensionless');
  const env = {
    PATH: ['', 'relative', shims, binaries].join(';'),
    PATHEXT: '.COM;.EXE;.BAT;.CMD',
    ComSpec: 'C:\\Windows\\System32\\cmd.exe',
  };
  const host = { platform: 'win32' as const, env };
  assert.equal(await searchPath('sql', host), path.join(binaries, 'sql.exe'));
  assert.equal(await searchPath('missing', host), undefined);
  const resolved = await resolveCommand('codex', ['plugin', 'add', 'C:\\Users\\A B\\home\\'], host);
  assert.equal(resolved.verbatim, true);
  assert.equal(resolved.executable, env.ComSpec);
  assert.deepEqual(resolved.args.slice(0, 3), ['/d', '/s', '/c']);
  assert.equal(
    resolved.args[3],
    `""${path.join(shims, 'codex.cmd')}" "plugin" "add" "C:\\Users\\A B\\home\\\\""`,
  );
  for (const unsafe of ['a&b', 'a|b', 'x>y', '%PATH%', 'say "hi"', 'a^b', 'bang!'])
    await assert.rejects(resolveCommand('codex', [unsafe], host), { code: 'UNSAFE_COMMAND_ARGUMENT' });
  const exe = await resolveCommand(path.join(binaries, 'sql'), ['-version'], host);
  assert.deepEqual(exe, { executable: path.join(binaries, 'sql.exe'), args: ['-version'], verbatim: false });
  assert.deepEqual(await resolveCommand('codex', ['x'], { platform: 'darwin', env }), {
    executable: 'codex',
    args: ['x'],
    verbatim: false,
  });
});

test('POSIX PATH search skips empty and relative entries', { skip: posixOnly }, async (t) => {
  const root = await temporary();
  t.after(() => rm(root, { recursive: true, force: true }));
  const previous = process.cwd();
  await writeFile(path.join(root, 'sql'), '#!/bin/sh\n');
  await chmod(path.join(root, 'sql'), 0o755);
  process.chdir(root);
  t.after(() => process.chdir(previous));
  assert.equal(await searchPath('sql', { platform: 'linux', env: { PATH: ':.:bin' } }), undefined);
  assert.equal(
    await searchPath('sql', { platform: 'linux', env: { PATH: ':' + root } }),
    path.join(root, 'sql'),
  );
});

test('dependency preview reports discovered tools without executing them', { skip: posixOnly }, async (t) => {
  const root = await temporary();
  t.after(() => rm(root, { recursive: true, force: true }));
  const marker = path.join(root, 'probed');
  const sql = path.join(root, 'sql');
  await writeFile(sql, `#!/bin/sh\ntouch '${marker}'\necho 26.1.2.132.1334\n`);
  await chmod(sql, 0o755);
  const previous = process.env.APEXREST_SQLCL;
  process.env.APEXREST_SQLCL = sql;
  t.after(() => {
    if (previous === undefined) delete process.env.APEXREST_SQLCL;
    else process.env.APEXREST_SQLCL = previous;
  });
  const plan = await new ToolchainService().plan({ home: path.join(root, 'home'), dryRun: true });
  const step = plan.steps.find((candidate) => candidate.artifact.id === 'sqlcl')!;
  assert.equal(step.reuse, undefined);
  assert.equal(step.candidate, sql);
  assert.equal(step.candidateStatus, 'found, not probed');
  assert.equal(await exists(marker), false);
  assert.match(plan.browser.integrity, /not hash-pinned by apexrest/);
  assert.equal(typeof plan.proxy.support, 'string');
});

test('ambient Playwright mirrors are stripped unless explicitly selected', () => {
  const base = {
    PLAYWRIGHT_DOWNLOAD_HOST: 'https://mirror.invalid',
    PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST: 'https://mirror.invalid',
    KEEP: 'yes',
  };
  const env = browserEnvironment(base, { PLAYWRIGHT_BROWSERS_PATH: '/b' });
  assert.equal(env.PLAYWRIGHT_DOWNLOAD_HOST, undefined);
  assert.equal(env.PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST, undefined);
  assert.equal(env.KEEP, 'yes');
  assert.equal(env.PLAYWRIGHT_BROWSERS_PATH, '/b');
  assert.equal(
    browserEnvironment(base, {}, 'https://approved.test').PLAYWRIGHT_DOWNLOAD_HOST,
    'https://approved.test',
  );
});

async function toolchainFixture(t: test.TestContext) {
  const root = await temporary();
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = path.join(root, 'home'),
    cache = path.join(root, 'cache');
  const tar = await import('tar');
  const source = path.join(root, 'source');
  await mkdir(path.join(source, 'tool/bin'), { recursive: true });
  await mkdir(path.join(source, 'tool/lib'), { recursive: true });
  await writeFile(path.join(source, 'tool/bin/node'), `#!/bin/sh\necho v${process.versions.node}\n`, {
    mode: 0o755,
  });
  await writeFile(path.join(source, 'tool/lib/data.txt'), 'library');
  const archive = path.join(root, 'tool.tar.gz');
  await tar.c({ cwd: source, file: archive, gzip: true, portable: true }, ['tool']);
  const contents = await readFile(archive);
  const locked: Artifact = {
    ...artifact,
    version: process.versions.node,
    url: 'https://vendor.test/v1/tool.tar.gz',
    sha256: hash(contents),
    type: 'tar.gz',
    executable: 'tool/bin/node',
  };
  await mkdir(cache, { recursive: true, mode: 0o700 });
  await writeFile(path.join(cache, locked.sha256), contents);
  const destination = path.join(home, 'toolchains/node', locked.version);
  const service = new ToolchainService();
  t.mock.method(service, 'plan', async () => ({
    home,
    cache,
    playwright: '0',
    steps: [{ artifact: locked, destination, reuse: undefined, consent: 'not-required' }],
  }));
  const apply = () => service.apply({ home, yes: true, offline: true, skipBrowser: true });
  return { home, cache, destination, locked, apply, root };
}

test(
  'managed toolchains record a tree digest and replace modified or incomplete installs',
  { skip: posixOnly },
  async (t) => {
    const f = await toolchainFixture(t);
    await f.apply();
    const state = await runtimeState(f.home);
    const record = state.integrity?.node;
    assert.ok(record);
    assert.equal(record.destination, f.destination);
    assert.match(record.treeSha256, /^[a-f0-9]{64}$/);
    assert.equal(state.node, path.join(f.destination, 'tool/bin/node'));

    // A modified library is detected even though the executable still runs.
    await writeFile(path.join(f.destination, 'tool/lib/data.txt'), 'tampered');
    await f.apply();
    assert.equal(await readFile(path.join(f.destination, 'tool/lib/data.txt'), 'utf8'), 'library');

    // An interrupted install (directory without its executable) is moved aside and rebuilt.
    await rm(path.join(f.destination, 'tool/bin/node'));
    await f.apply();
    assert.equal(await exists(path.join(f.destination, 'tool/bin/node')), true);
    assert.deepEqual(await readdir(path.dirname(f.destination)), [path.basename(f.destination)]);
    assert.equal((await runtimeState(f.home)).integrity?.node?.treeSha256, record.treeSha256);
  },
);

test('a failed toolchain extraction leaves no staging directory', { skip: posixOnly }, async (t) => {
  const f = await toolchainFixture(t);
  const service = new ToolchainService();
  t.mock.method(service, 'plan', async () => ({
    home: f.home,
    cache: f.cache,
    playwright: '0',
    steps: [
      {
        artifact: { ...f.locked, executable: 'tool/bin/missing' },
        destination: f.destination,
        reuse: undefined,
        consent: 'not-required',
      },
    ],
  }));
  await assert.rejects(service.apply({ home: f.home, yes: true, offline: true, skipBrowser: true }), {
    code: 'ARTIFACT_LAYOUT_MISMATCH',
  });
  assert.deepEqual(await readdir(path.dirname(f.destination)), []);
});

test('home aliases resolve to one canonical managed home', { skip: posixOnly }, async (t) => {
  const root = await temporary();
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = path.join(root, 'managed');
  const alias = path.join(root, 'alias');
  await mkdir(home);
  await symlink(home, alias, 'dir');
  assert.equal(await canonicalHome(alias), home);
  assert.equal(
    await canonicalHome(path.join(alias, 'not-yet', 'created')),
    path.join(home, 'not-yet/created'),
  );
  // A runtime record written through the alias is still recognized as managed.
  const java = path.join(alias, 'toolchains/java/21/bin/java');
  await mkdir(path.dirname(java), { recursive: true });
  await writeFile(java, 'managed java');
  await writeFile(
    path.join(home, 'runtime.json'),
    JSON.stringify({ schemaVersion: 1, java, components: { java: 'verified' } }),
  );
  const result = (await uninstallTools({ home, yes: true })) as {
    home: string;
    steps: { component: string; action: string }[];
  };
  assert.equal(result.home, home);
  assert.deepEqual(
    result.steps.map((step) => [step.component, step.action]),
    [['java', 'remove']],
  );
  assert.equal(await exists(path.join(home, 'toolchains/java/21')), false);
  assert.equal(((await readJson(path.join(home, 'runtime.json'))) as { java?: string }).java, undefined);
});

test('Windows launchers include a cmd shim and restore APEXREST_HOME in PowerShell', () => {
  const home = 'C:\\Users\\A B\\.apexrest',
    node = 'C:\\Program Files\\nodejs\\node.exe',
    cli = home + '\\native\\x\\runtime\\apexrest.mjs';
  const scripts = launcherScripts(home, node, cli, 'win32');
  assert.deepEqual(Object.keys(scripts).sort(), ['apexrest.cmd', 'apexrest.ps1']);
  const ps1 = scripts['apexrest.ps1']!;
  assert.match(ps1, /\$apexrestPreviousHome = \$env:APEXREST_HOME/);
  assert.match(ps1, /finally \{\n {2}\$env:APEXREST_HOME = \$apexrestPreviousHome/);
  assert.ok(ps1.indexOf('& ') > ps1.indexOf('try {'));
  const cmd = scripts['apexrest.cmd']!;
  assert.match(cmd, /^@echo off\r\nsetlocal\r\n/);
  assert.ok(cmd.includes(`set "APEXREST_HOME=${home}"`));
  assert.ok(cmd.includes(`"${node}" "${cli}" %*`));
  assert.throws(() => launcherScripts('C:\\100%\\home', node, cli, 'win32'), {
    code: 'UNSAFE_LAUNCHER_PATH',
  });
  assert.deepEqual(Object.keys(launcherScripts('/h', '/n', '/c', 'linux')), ['apexrest']);
});

test(
  'an integrity record for another destination cannot authorize a cached install',
  { skip: posixOnly },
  async (t) => {
    const f = await toolchainFixture(t);
    await f.apply();
    const state = await runtimeState(f.home);
    state.integrity!.node!.destination = path.join(f.root, 'other-destination');
    await writeJson(path.join(f.home, 'runtime.json'), state);
    await writeFile(path.join(f.destination, 'tool/lib/data.txt'), 'tampered');
    await f.apply();
    assert.equal(await readFile(path.join(f.destination, 'tool/lib/data.txt'), 'utf8'), 'library');
    assert.equal((await runtimeState(f.home)).integrity!.node!.destination, f.destination);
  },
);
