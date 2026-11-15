import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { canonical, hash, inventory } from '../../packages/core/src/fs.ts';

async function fixture(t: import('node:test').TestContext, borrowed = false) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-validation-integrity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'application');
  const metadataFile = borrowed ? path.join(root, 'metadata.json') : path.join(source, '.apex/apexlang.json');
  await mkdir(path.join(source, '.apex'), { recursive: true });
  await writeFile(path.join(source, 'application.apx'), 'application fixture ()');
  await writeFile(metadataFile, '{"mmdVersion":"fixture"}');
  const oracle = new OracleAdapter();
  oracle.requireCapability = async () => ({ version: 'fixture', helpHash: 'fixture' });
  oracle.stage = () => mkdtemp(path.join(root, 'stage-'));
  const calls: string[] = [];
  oracle.session = async (sql) => {
    calls.push(sql);
    return {
      output: 'Validation successful',
      code: 0,
      stdout: '',
      stderr: '',
      work: root,
      timedOut: false,
      cancelled: false,
      truncated: false,
    };
  };
  return { root, source, metadataFile, oracle, calls };
}

test('validation binds its exact staged tree and returns the metadata it compiled', async (t) => {
  const f = await fixture(t);
  const before = await inventory(f.source);
  const result = await f.oracle.validate(f.source);
  assert.equal(result.status, 'passed');
  assert.equal(result.sourceDigest, hash(canonical(before)));
  assert.deepEqual(result.mmd, { mmdVersion: 'fixture' });
  assert.equal(f.calls.length, 1);
});

test('source changes between inventory and copying stop before the compiler runs', async (t) => {
  const f = await fixture(t);
  const stage = f.oracle.stage.bind(f.oracle);
  f.oracle.stage = async () => {
    await writeFile(path.join(f.source, 'application.apx'), 'unreviewed content');
    return stage();
  };
  await assert.rejects(f.oracle.validate(f.source), { code: 'SOURCE_DRIFT' });
  assert.deepEqual(f.calls, []);
});

test('borrowed metadata changes during compilation cannot be reported as validated', async (t) => {
  const f = await fixture(t, true);
  const session = f.oracle.session.bind(f.oracle);
  f.oracle.session = async (...args) => {
    await writeFile(f.metadataFile, '{"mmdVersion":"changed"}');
    return session(...args);
  };
  await assert.rejects(f.oracle.validate(f.source, undefined, { metadataFile: f.metadataFile }), {
    code: 'SOURCE_DRIFT',
  });
  assert.equal(await readFile(path.join(f.source, 'application.apx'), 'utf8'), 'application fixture ()');
});
