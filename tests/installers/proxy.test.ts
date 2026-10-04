import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { hash } from '../../packages/core/src/fs.ts';
import { download, proxyStatus } from '../../packages/installer/src/download.ts';

// Runs in its own process: applying the environment proxy is process-wide.
test('vendor downloads use HTTPS_PROXY through the built-in fetch (local proxy fixture)', async (t) => {
  const connects: string[] = [];
  const proxy = http.createServer((_request, response) => response.end());
  proxy.on('connect', (request, socket) => {
    connects.push(request.url ?? '');
    socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
  });
  await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  t.after(() => proxy.close());
  const address = proxy.address() as { port: number };
  const saved = Object.fromEntries(
    ['HTTPS_PROXY', 'https_proxy', 'NO_PROXY', 'no_proxy', 'NODE_USE_ENV_PROXY'].map((name) => [
      name,
      process.env[name],
    ]),
  );
  t.after(() => {
    for (const [name, value] of Object.entries(saved))
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  });
  for (const name of Object.keys(saved)) delete process.env[name];
  process.env.HTTPS_PROXY = `http://127.0.0.1:${address.port}`;
  if (proxyStatus().support === 'unsupported') {
    t.skip('This Node.js has no runtime environment-proxy API.');
    return;
  }
  const cache = await mkdtemp(path.join(tmpdir(), 'apexrest-proxy-'));
  t.after(() => rm(cache, { recursive: true, force: true }));
  await assert.rejects(
    download(
      {
        id: 'node',
        version: '1.0.0',
        url: 'https://vendor.invalid/v1.0.0/runtime.zip',
        sha256: hash('fixture'),
        os: 'darwin',
        arch: 'arm64',
        type: 'zip',
        executable: 'node',
        allowedHosts: ['vendor.invalid'],
        license: 'test fixture',
        consentRequired: false,
      },
      cache,
      false,
      fetch,
      { attempts: 1, headersTimeoutMs: 5000 },
    ),
    { code: 'DOWNLOAD_FAILED' },
  );
  assert.deepEqual(connects, ['vendor.invalid:443']);
  assert.equal(proxyStatus().support, 'enabled-by-installer');
  assert.deepEqual(await readdir(cache), []);
});
