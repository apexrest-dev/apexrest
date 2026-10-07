import { mkdtemp, mkdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeJson, atomicWrite, hash, canonical } from '../../packages/core/src/fs.ts';
import { projectSchema, parse } from '../../packages/core/src/config.ts';
import { sourceInventory, planDigest, targetDigest } from '../../packages/core/src/deploy.ts';
import type { DeployPlan } from '../../packages/core/src/deploy.ts';
import { coordination } from '../../packages/core/src/deployment-control.ts';
export async function fixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-test-')));
  const config = parse(projectSchema, {
    schemaVersion: 1,
    projectId: 'fixture',
    application: { sourceDir: 'src/apex/app', alias: 'fixture' },
    database: { migrationsDir: 'src/db/migrations', packagesDir: 'src/db/packages' },
    toolchain: { lockFile: 'toolchain.json' },
    environments: {
      dev: {
        kind: 'development',
        readConnectionRef: 'read',
        deployConnectionRef: 'deploy',
        workspace: 'FIXTURE',
        parsingSchema: 'FIXTURE',
        applicationId: 123,
        baseUrl: 'https://test.example.invalid/ords/',
        databaseIdentity: { dbUniqueName: 'fixture', serviceName: 'fixture' },
      },
    },
    artifacts: { directory: '.apexrest/artifacts', retentionDays: 7 },
  });
  await writeJson(path.join(root, 'apexrest.json'), config);
  await writeJson(path.join(root, 'toolchain.json'), { version: 'fixture' });
  await atomicWrite(path.join(root, 'src/apex/app/application.apx'), 'mock-only-fixture');
  await writeJson(path.join(root, 'src/apex/app/.apex/apexlang.json'), { mmdVersion: 'fixture' });
  const ctx = { root, config };
  const sources = await sourceInventory(ctx);
  const plan: DeployPlan = {
    schemaVersion: 1,
    id: randomUUID(),
    projectId: 'fixture',
    projectRoot: root,
    environment: 'dev',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    sourceDigest: hash(canonical(sources)),
    sources,
    configurationDigest: hash(canonical(config)),
    toolchainDigest: hash(JSON.stringify({ version: 'fixture' }, null, 2) + '\n'),
    compiler: 'mock SQLcl',
    targetDigest: targetDigest(config.environments.dev!),
    target: {},
    fingerprint: hash('target'),
    migrationHistory: [],
    coordination: coordination(config.environments.dev!),
    scope: 'full-application-import',
    operations: [{ kind: 'import' }, { kind: 'verify' }],
    risks: [],
    approval: 'external-policy-required',
    backupRequired: false,
    digest: '0'.repeat(64),
  };
  plan.digest = planDigest(plan);
  return { ctx, plan };
}
