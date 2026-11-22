import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rename, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

test('preview reloads a renamed page file whose modification time is older than the last load', async (t) => {
  const { app, assets } = await workspace(t);
  const server = new PreviewServer({
    sourceDir: app,
    assetsDir: assets,
    database: ':memory:',
    toolbar: false,
  });
  await server.start();
  t.after(() => server.stop());
  const page = async () => (await fetch(`${server.url}/r/demo/home`)).text();
  assert.match(await page(), /<title>Home<\/title>/u);
  const file = path.join(app, 'pages/p00001-home.apx');
  await writeFile(file, (await readFile(file, 'utf8')).replace('title: Home', 'title: Renamed home'));
  const old = new Date(Date.now() - 86_400_000);
  await utimes(file, old, old);
  await rename(file, path.join(app, 'pages/p00001-start.apx'));
  assert.match(await page(), /<title>Renamed home<\/title>/u);
});

test('preview reports each successful source load, not a failed one', async (t) => {
  const { app, assets } = await workspace(t);
  const loads: string[] = [];
  const server = new PreviewServer({
    sourceDir: app,
    assetsDir: assets,
    database: ':memory:',
    toolbar: false,
    onLoad: (startedAt) => loads.push(startedAt),
  });
  await server.start();
  t.after(() => server.stop());
  assert.equal(loads.length, 1);
  const page = async () => (await fetch(`${server.url}/r/demo/home`)).text();
  const file = path.join(app, 'pages/p00001-home.apx');
  const source = await readFile(file, 'utf8');
  await writeFile(file, source.replace('title: Home', 'title: Edited home'));
  assert.match(await page(), /<title>Edited home<\/title>/u);
  assert.equal(loads.length, 2);
  assert.ok(Date.parse(loads[1]!) >= Date.parse(loads[0]!));
  // An unparsable edit keeps the last good renderer and records nothing.
  await writeFile(file, source.replace(/\)\s*$/u, ''));
  await page();
  assert.equal(loads.length, 2);
});
