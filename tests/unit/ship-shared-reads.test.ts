import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, rm } from 'node:fs/promises';
import { workingCopyFixture } from '../fixtures/working-copy.ts';
import { fallbackCompilerDiagnostics } from '../../packages/core/src/ship.ts';
import { captureShipIntent, runShipIntent } from '../../packages/core/src/ship-intent.ts';
import { currentReadScope } from '../../packages/core/src/sqlcl-read-scope.ts';
import { Fault } from '../../packages/core/src/result.ts';

/** Records the read scope of every target read and of the import call. */
async function observed(t: test.TestContext, shared: boolean) {
  const previous = process.env.APEXREST_SHIP_SHARED_READS;
  if (shared) process.env.APEXREST_SHIP_SHARED_READS = '1';
  else delete process.env.APEXREST_SHIP_SHARED_READS;
  const f = await workingCopyFixture();
  f.ctx.config.environments.dev!.baseUrl = 'https://localhost/ords/';
  t.after(async () => {
    if (previous === undefined) delete process.env.APEXREST_SHIP_SHARED_READS;
    else process.env.APEXREST_SHIP_SHARED_READS = previous;
    await rm(f.ctx.root, { recursive: true, force: true });
  });
  const reads: { phase: string; scope: string | undefined }[] = [];
  let phase = 'plan';
  const verify = f.oracle.verifyTarget.bind(f.oracle);
  f.oracle.verifyTarget = async (...args: Parameters<typeof verify>) => {
    reads.push({ phase, scope: currentReadScope() });
    return verify(...args);
  };
  const plan = f.service.plan.bind(f.service);
  f.service.plan = async (...args: Parameters<typeof plan>) => {
    phase = 'plan';
    return plan(...args);
  };
  const apply = f.service.apply.bind(f.service);
  f.service.apply = async (...args: Parameters<typeof apply>) => {
    phase = 'apply';
    return apply(...args);
  };
  const run = async () => {
    const intent = await captureShipIntent(f.ctx, {
      env: 'dev',
      userRequest: 'Deploy the customers page to dev',
    });
    return runShipIntent(f.ctx, intent.id, f.service, fallbackCompilerDiagnostics);
  };
  return { f, reads, run };
}

test('the experimental shared scope serves plan and apply reads from one connected read server', async (t) => {
  const { reads, run } = await observed(t, true);
  const result = await run();
  assert.equal(result.status, 'succeeded');
  assert.equal((result.intent as { readScope?: string }).readScope, 'shared');
  const scopes = new Set(reads.map((read) => read.scope));
  assert.ok(reads.some((read) => read.phase === 'plan') && reads.some((read) => read.phase === 'apply'));
  assert.equal(scopes.size, 1, 'one read scope across both phases');
  assert.notEqual([...scopes][0], undefined);
  // Outside the run nothing keeps the scope.
  assert.equal(currentReadScope(), undefined);
});

test('by default plan and apply keep their own read scopes', async (t) => {
  const { reads, run } = await observed(t, false);
  const result = await run();
  assert.equal(result.status, 'succeeded');
  const plan = new Set(reads.filter((read) => read.phase === 'plan').map((read) => read.scope));
  const apply = new Set(reads.filter((read) => read.phase === 'apply').map((read) => read.scope));
  assert.ok(plan.size && apply.size);
  assert.equal(
    [...plan].some((scope) => apply.has(scope)),
    false,
    'no scope shared between phases',
  );
});

test('a failed run closes its shared scope; the next run never inherits it', async (t) => {
  const { f, reads, run } = await observed(t, true);
  const importApplication = f.oracle.importApplication.bind(f.oracle);
  f.oracle.importApplication = async () => {
    throw new Fault('ORACLE_COMMAND_FAILED', 'ORA-20987: compiler error', 1);
  };
  await assert.rejects(run(), { code: 'IMPORT_REJECTED' });
  const failed = new Set(reads.map((read) => read.scope));
  assert.equal(failed.size, 1);
  assert.equal(currentReadScope(), undefined);
  reads.length = 0;
  f.oracle.importApplication = importApplication;
  const file = `${f.ctx.root}/${f.ctx.config.application.sourceDir}/application.apx`;
  await appendFile(file, '\n');
  assert.equal((await run()).status, 'succeeded');
  const next = new Set(reads.map((read) => read.scope));
  assert.equal(next.size, 1);
  assert.equal(
    [...next].some((scope) => failed.has(scope)),
    false,
    'a fresh scope',
  );
});
