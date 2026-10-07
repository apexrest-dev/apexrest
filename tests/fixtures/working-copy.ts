import path from 'node:path';
import { cp, rm, mkdir } from 'node:fs/promises';
import { fixture } from './project.ts';
import { canonical, hash, inventory, writeJson, atomicWrite } from '../../packages/core/src/fs.ts';
import { DeploymentService, targetDigest } from '../../packages/core/src/deploy.ts';
import type { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { Fault } from '../../packages/core/src/result.ts';

/** Fake Oracle boundary only; real planning, freezing, backup and apply code runs unchanged. */
export async function workingCopyFixture() {
  const { ctx } = await fixture();
  process.env.APEXREST_HOME = path.join(ctx.root, 'managed');
  const env = ctx.config.environments.dev!;
  await writeJson(path.join(process.env.APEXREST_HOME, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [ctx.root],
    grants: [
      {
        projectRoot: ctx.root,
        targetDigest: targetDigest(env),
        operations: ['deploy'],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    ],
  });
  await writeJson(path.join(process.env.APEXREST_HOME, 'connections.json'), {
    read: { kind: 'sqlcl-store', name: 'read' },
    deploy: { kind: 'sqlcl-store', name: 'deploy' },
  });
  const server = path.join(ctx.root, 'fake-server');
  await cp(path.join(ctx.root, ctx.config.application.sourceDir), server, { recursive: true });
  const calls: string[] = [];
  const controls = {
    metadata: { lastUpdatedOn: '2026-09-29T10:00:00', lastUpdatedBy: 'FIXTURE' },
    compilerVersion: 'mock SQLcl',
    failPostImportAfter: Infinity,
    failImport: false,
    failMetadata: false,
    alias: 'fixture',
    exists: true,
  };
  const target = () => ({
    identity: { db_unique_name: 'fixture', service_name: 'fixture', parsing_schema: 'FIXTURE' },
    workspace: { workspace: 'FIXTURE', workspace_id: 123 },
    application: controls.exists
      ? { application_id: env.applicationId, workspace: 'FIXTURE', owner: 'FIXTURE', alias: controls.alias }
      : null,
  });
  const oracle = {
    async requireMutationSupport() {
      calls.push('capability:mutation');
    },
    async requireCapability() {
      calls.push('capability:import');
      return { version: controls.compilerVersion };
    },
    async validate() {
      calls.push('validate');
      return { compiler: { version: controls.compilerVersion } };
    },
    async verifyTarget() {
      calls.push('target');
      return target();
    },
    async applicationMetadata() {
      calls.push('metadata');
      if (
        controls.failMetadata ||
        calls.filter((call) => call === 'import').length >= controls.failPostImportAfter
      )
        throw new Fault('QUERY_FAILED', 'Fixture metadata failure.', 3);
      return { ...controls.metadata };
    },
    async exportApplication(_env: unknown, _connection: unknown, format = 'APEXLANG') {
      calls.push('export:' + format);
      const directory = path.join(ctx.root, 'export-' + calls.length);
      if (format === 'SQL')
        await atomicWrite(path.join(directory, 'f123.sql'), '-- fixture baseline SQL, not live evidence');
      else await cp(server, directory, { recursive: true });
      const files = await inventory(directory);
      return {
        directory,
        files,
        digest: hash(canonical(files)),
        compiler: { version: controls.compilerVersion },
      };
    },
    async exportSelection(_env: unknown, _connection: unknown, selected: string[]) {
      calls.push('export:selection:' + selected.join(','));
      const directory = path.join(ctx.root, 'selected-export-' + calls.length);
      await mkdir(directory, { recursive: true });
      const present = await inventory(server);
      for (const file of selected)
        if (present[file]) {
          await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
          await cp(path.join(server, file), path.join(directory, file));
        }
      const files = await inventory(directory);
      return {
        directory,
        files,
        digest: hash(canonical(files)),
        compiler: { version: controls.compilerVersion },
      };
    },
    async importApplication(_ctx: unknown, _env: unknown, _conn: unknown, source: string) {
      calls.push('import');
      if (controls.failImport)
        throw new Fault('PROCESS_TIMEOUT', 'Fixture import response lost.', 6, 'outcome_unknown');
      await rm(server, { recursive: true });
      await cp(source, server, { recursive: true });
      controls.metadata.lastUpdatedOn += '1';
    },
    async restoreApplication() {
      calls.push('restore');
      controls.metadata.lastUpdatedOn += '2';
    },
  };
  const service = new DeploymentService(oracle as unknown as OracleAdapter);
  return { ctx, env, calls, controls, oracle, service, server };
}
