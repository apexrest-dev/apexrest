import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import net from 'node:net';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { previewStatus, previewStop } from '../../packages/core/src/preview/service.ts';
import { processAlive, registryDir } from '../../packages/core/src/preview/registry.ts';

async function home(t: import('node:test').TestContext) {
  const dir = await mkdtemp(path.join(tmpdir(), 'apexrest-registry-'));
  const before = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = dir;
  t.after(async () => {
    if (before === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = before;
    await rm(dir, { recursive: true, force: true });
  });
  await mkdir(registryDir(), { recursive: true });
  return dir;
}

async function entry(pid: number, port: number, owner: 'cli' | 'host', sourceDir: string) {
  const file = path.join(registryDir(), `${pid}-${port}.json`);
  await writeFile(
    file,
    JSON.stringify({
      pid,
      port,
      host: '127.0.0.1',
      url: `http://127.0.0.1:${port}`,
      sourceDir,
      owner,
      startedAt: new Date().toISOString(),
    }),
  );
  return file;
}

test('stale registry entries are pruned and never reported as running', async (t) => {
  const dir = await home(t);
  const dead = spawn(process.execPath, ['-e', '']);
  await new Promise((resolve) => dead.once('exit', resolve));
  const stale = await entry(dead.pid!, 1, 'cli', path.join(dir, 'app'));
  const status = await previewStatus(dir);
  assert.deepEqual(status.running, []);
  assert.equal(existsSync(stale), false);
});

test('previews hosted by another MCP process are listed but never signalled', async (t) => {
  const dir = await home(t);
  const server = net.createServer((socket) => socket.end());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const port = (server.address() as net.AddressInfo).port;
  const host = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
  t.after(() => host.kill('SIGKILL'));
  await entry(host.pid!, port, 'host', path.join(dir, 'app'));
  const status = await previewStatus(dir, { port });
  assert.deepEqual(
    status.running.map((item) => [item.port, item.owner]),
    [[port, 'host']],
  );
  await assert.rejects(previewStop(dir, { port }), { code: 'PREVIEW_STOP_FAILED', status: 'blocked' });
  assert.equal(processAlive(host.pid!), true);
  await assert.rejects(previewStop(dir, { port: port === 65535 ? 1 : port + 1 }), {
    code: 'PREVIEW_NOT_RUNNING',
    status: 'not_found',
  });
});
