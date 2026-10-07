import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { zipSync } from 'fflate';
import { download } from '../../packages/installer/src/download.ts';
import type { Artifact } from '../../packages/installer/src/download.ts';
import { hash, exists } from '../../packages/core/src/fs.ts';
import { extractArchive, archivePath } from '../../packages/installer/src/archive.ts';
import { platformProfile, ToolchainService, runtimeState } from '../../packages/installer/src/toolchain.ts';
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
const temporary = () => mkdtemp(path.join(tmpdir(), 'apexrest-install-'));

test('verified download caches; repeat and offline install do not fetch', async () => {
  const cache = await temporary();
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    return new Response(bytes);
  }) as typeof fetch;
  const file = await download(artifact, cache, false, fetcher);
  assert.deepEqual(await readFile(file), bytes);
  await download(artifact, cache, true, fetcher);
  assert.equal(calls, 1);
});
test('corrupt network payload never enters execution cache', async () => {
  const cache = await temporary();
  await assert.rejects(
    download(artifact, cache, false, (async () => new Response('corrupt')) as typeof fetch),
    /SHA-256/,
  );
  assert.equal(await exists(path.join(cache, artifact.sha256)), false);
  assert.deepEqual(await readdir(cache), []);
});
test('streamed download stays unpublished until checksum verification and supports concurrent writers', async (t) => {
  const cache = await temporary();
  t.after(() => rm(cache, { recursive: true, force: true }));
  const chunk = Buffer.alloc(64 * 1024, 97);
  const content = Buffer.concat([chunk, chunk, bytes]);
  const target = { ...artifact, sha256: hash(content) };
  const fetcher = (async () =>
    new Response(
      new ReadableStream({
        async start(controller) {
          for (const value of [chunk, chunk, bytes]) {
            assert.equal(await exists(path.join(cache, target.sha256)), false);
            controller.enqueue(value);
          }
          controller.close();
        },
      }),
    )) as typeof fetch;
  const file = await download(target, cache, false, fetcher);
  assert.deepEqual(await readFile(file), content);
  await rm(file);
  const concurrent = (async () => new Response(content)) as typeof fetch;
  assert.deepEqual(
    await Promise.all([
      download(target, cache, false, concurrent),
      download(target, cache, false, concurrent),
    ]),
    [file, file],
  );
  assert.deepEqual(await readFile(file), content);
  assert.deepEqual(await readdir(cache), [target.sha256]);
});
test('interrupted body removes private partial files and can be retried', async (t) => {
  const cache = await temporary();
  t.after(() => rm(cache, { recursive: true, force: true }));
  let pulls = 0;
  const fetcher = (async () =>
    new Response(
      new ReadableStream({
        pull(controller) {
          if (pulls++ === 0) controller.enqueue(bytes);
          else controller.error(new Error('fixture connection interrupted'));
        },
      }),
    )) as typeof fetch;
  await assert.rejects(download(artifact, cache, false, fetcher), /connection interrupted/);
  assert.deepEqual(await readdir(cache), []);
  const file = await download(artifact, cache, false, (async () => new Response(bytes)) as typeof fetch);
  assert.deepEqual(await readFile(file), bytes);
});
test('download size limit cancels the stream and leaves no cache or partial file', async (t) => {
  const cache = await temporary();
  t.after(() => rm(cache, { recursive: true, force: true }));
  const chunk = new Uint8Array(8 * 1024 * 1024);
  let cancelled = false;
  const fetcher = (async () =>
    new Response(
      new ReadableStream({
        pull(controller) {
          controller.enqueue(chunk);
        },
        cancel() {
          cancelled = true;
        },
      }),
    )) as typeof fetch;
  await assert.rejects(download(artifact, cache, false, fetcher), /exceeds 512 MiB/);
  assert.equal(cancelled, true);
  assert.deepEqual(await readdir(cache), []);
});
test('corrupted cached artifact is freshly hashed before offline reuse', async () => {
  const cache = await temporary();
  await writeFile(path.join(cache, artifact.sha256), 'corrupt cached bytes');
  await assert.rejects(download(artifact, cache, true), /Cached artifact SHA-256/);
});
test('offline miss never contacts network', async () => {
  let calls = 0;
  await assert.rejects(
    download(artifact, await temporary(), true, (async () => {
      calls++;
      return new Response(bytes);
    }) as typeof fetch),
    /offline cache/,
  );
  assert.equal(calls, 0);
});
test('redirect origin and TLS policy are enforced', async () => {
  let calls = 0;
  await assert.rejects(
    download(artifact, await temporary(), false, (async () => {
      calls++;
      return new Response(null, { status: 302, headers: { location: 'https://evil.test/steal' } });
    }) as typeof fetch),
    /allowlist/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    download({ ...artifact, url: 'http://vendor.test/v1.0.0/a' }, await temporary()),
    /allowlist/,
  );
});
test('moving URL and fake checksums fail before fetch', async () => {
  await assert.rejects(
    download({ ...artifact, url: 'https://vendor.test/latest/a' }, await temporary()),
    /immutable/,
  );
  await assert.rejects(download({ ...artifact, sha256: 'TODO' }, await temporary()), /SHA-256/);
});
test('safe extraction works in paths with spaces and Unicode', async () => {
  const root = await temporary();
  const file = path.join(root, 'test.zip');
  await writeFile(file, zipSync({ 'nested/café.txt': Buffer.from('data') }));
  await extractArchive(file, path.join(root, 'space path'), 'zip');
  assert.equal(await readFile(path.join(root, 'space path/nested/café.txt'), 'utf8'), 'data');
});
test('zip traversal is rejected without writing outside destination', async () => {
  const root = await temporary();
  const file = path.join(root, 'bad.zip');
  await writeFile(file, zipSync({ '../escape': Buffer.from('bad') }));
  await assert.rejects(extractArchive(file, path.join(root, 'output'), 'zip'));
  assert.equal(await exists(path.join(root, 'escape')), false);
});
test('archive path rejects Windows and control-character escapes', () => {
  for (const name of ['../x', '/tmp/x', 'C:/x', 'a\\..\\x', 'x\nname'])
    assert.throws(() => archivePath(name));
});
test('unsupported platforms do not silently enable emulation', () => {
  assert.throws(() => platformProfile('linux', 'arm64'), /No locked/);
  assert.throws(() => platformProfile('darwin', 'x64'), /No locked/);
  assert.equal(platformProfile('win32', 'x64').status, 'requires-platform-CI');
});
test('tar extraction accepts normal files and rejects escaping vendor links', async () => {
  const tar = await import('tar');
  const root = await temporary();
  const source = path.join(root, 'source');
  await mkdir(source);
  await writeFile(path.join(source, 'safe.txt'), 'real tar fixture');
  await tar.c({ cwd: source, file: path.join(root, 'safe.tar.gz'), gzip: true }, ['safe.txt']);
  await extractArchive(path.join(root, 'safe.tar.gz'), path.join(root, 'safe-out'), 'tar.gz');
  assert.equal(await readFile(path.join(root, 'safe-out/safe.txt'), 'utf8'), 'real tar fixture');
  // Build the malicious archive directly so the test does not need host
  // symlink privileges (in particular on Windows).
  const header = Buffer.alloc(512);
  new tar.Header({ path: 'bad-link', type: 'SymbolicLink', linkpath: '../../escape', size: 0 }).encode(
    header,
  );
  await writeFile(path.join(root, 'bad.tar.gz'), gzipSync(Buffer.concat([header, Buffer.alloc(1024)])));
  await assert.rejects(
    extractArchive(path.join(root, 'bad.tar.gz'), path.join(root, 'bad-out'), 'tar.gz', true),
    { code: 'UNSAFE_ARCHIVE' },
  );
  assert.equal(await exists(path.join(root, 'escape')), false);
});
