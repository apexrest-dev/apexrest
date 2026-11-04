import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { workingCopyFixture } from '../fixtures/working-copy.ts';
import { writeJson } from '../../packages/core/src/fs.ts';
import { fallbackCompilerDiagnostics, shipPlan } from '../../packages/core/src/ship.ts';
import { planDigest } from '../../packages/core/src/deploy.ts';

test('production-marked targets are refused before any connection or SQLcl call', async (t) => {
  const f = await workingCopyFixture();
  f.ctx.config.environments.dev!.baseUrl = 'https://localhost/ords/';
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  // A dev plan made before the target was marked; its apply must refuse without probing locality.
  const planned = await shipPlan(f.ctx, 'dev', f.service, fallbackCompilerDiagnostics);
  f.calls.length = 0;
  // No connection reference exists: a refusal from configuration never reaches resolveConnection.
  await rm(path.join(process.env.APEXREST_HOME!, 'connections.json'));
  const production = {
    ...f.ctx,
    config: {
      ...f.ctx.config,
      environments: { dev: { ...f.ctx.config.environments.dev!, kind: 'production' as const } },
    },
  };
  for (const attempt of [
    () => shipPlan(production, 'dev', f.service, fallbackCompilerDiagnostics),
    () => f.service.plan(production, 'dev', { importMode: 'full' }),
    () => f.service.plan(production, 'dev', { importMode: 'none' }),
    () => f.service.plan(production, 'dev', false),
  ])
    await assert.rejects(attempt(), { code: 'PRODUCTION_DEPLOY_DENIED', status: 'blocked' });
  // The trust file marks the configured database although apexrest.json says dev.
  const trust = path.join(process.env.APEXREST_HOME!, 'production-trust.json');
  await writeJson(trust, {
    schemaVersion: 1,
    productionTargets: [],
    productionDatabases: [f.ctx.config.environments.dev!.databaseIdentity.dbUniqueName],
  });
  t.after(() => rm(trust, { force: true }));
  await assert.rejects(shipPlan(f.ctx, 'dev', f.service, fallbackCompilerDiagnostics), {
    code: 'PRODUCTION_DEPLOY_DENIED',
  });
  // A risky plan would probe connection locality first; production is refused before that.
  const risky = { ...planned.plan, risks: ['destructive-or-privileged-sql:db/x.sql'] };
  risky.digest = planDigest(risky);
  (f.oracle as unknown as Record<string, unknown>).connectionLocality = async () => {
    f.calls.push('locality');
    return { local: true };
  };
  await assert.rejects(f.service.apply(f.ctx, risky), { code: 'PRODUCTION_DEPLOY_DENIED' });
  assert.deepEqual(f.calls, [], 'no SQLcl, compiler or target call ran');
});
