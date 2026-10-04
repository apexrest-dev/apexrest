import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import { DeploymentService, planDigest } from '../../packages/core/src/deploy.ts';
import { coordination } from '../../packages/core/src/deployment-control.ts';
import type { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { Fault } from '../../packages/core/src/result.ts';
import { hash, writeJson } from '../../packages/core/src/fs.ts';

function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>((ready) => {
    resolve = ready;
  });
  return { promise, resolve };
}

// These fixtures exercise scheduling and write barriers, not Oracle execution.
async function prepared() {
  const { ctx, plan } = await fixture();
  const home = path.join(ctx.root, 'managed');
  process.env.APEXREST_HOME = home;
  plan.coordination = coordination(ctx.config.environments.dev!);
  plan.target = {
    identity: { db_unique_name: 'fixture', service_name: 'fixture', parsing_schema: 'FIXTURE' },
    workspace: { workspace_id: 123, workspace: 'FIXTURE' },
    application: null,
  };
  plan.digest = planDigest(plan);
  await writeJson(path.join(home, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [ctx.root],
    grants: [
      {
        projectRoot: ctx.root,
        targetDigest: plan.targetDigest,
        expiresAt: plan.expiresAt,
        planDigest: plan.digest,
        operations: ['deploy'],
      },
    ],
  });
  await writeJson(path.join(home, 'connections.json'), {
    read: { kind: 'sqlcl-store', name: 'read' },
    deploy: { kind: 'sqlcl-store', name: 'deploy' },
  });
  const oracle = {
    async requireMutationSupport() {},
    async validate() {
      return { compiler: { version: plan.compiler } };
    },
    async verifyTarget() {
      return { application: null };
    },
    async requireCapability() {
      return { version: plan.compiler };
    },
  };
  const service = new DeploymentService(oracle as unknown as OracleAdapter);
  const fingerprint = {
    target: plan.target,
    history: [],
    exported: null,
    fingerprint: plan.fingerprint,
  } as unknown as Awaited<ReturnType<DeploymentService['fingerprint']>>;
  service.fingerprint = async () => fingerprint;
  return { ctx, plan, oracle, service, fingerprint };
}

test('planning overlaps independent Oracle compilation and target reads', { timeout: 5000 }, async () => {
  const { ctx, service, oracle, fingerprint, plan } = await prepared();
  const targetStarted = latch();
  const compilerStarted = latch();
  service.fingerprint = async () => {
    targetStarted.resolve();
    await compilerStarted.promise;
    return fingerprint;
  };
  oracle.validate = async () => {
    compilerStarted.resolve();
    await targetStarted.promise;
    return { compiler: { version: plan.compiler } };
  };
  const result = await service.plan(ctx, 'dev');
  assert.equal(result.compiler, plan.compiler);
  assert.equal(result.sourceDigest, plan.sourceDigest);
  assert.equal(result.fingerprint, plan.fingerprint);
});

test('a failed plan waits for its other read-only preflight to finish', { timeout: 5000 }, async () => {
  const { ctx, service, oracle, plan } = await prepared();
  const compilerStarted = latch();
  const releaseCompiler = latch();
  let compilerFinished = false;
  oracle.validate = async () => {
    compilerStarted.resolve();
    await releaseCompiler.promise;
    compilerFinished = true;
    return { compiler: { version: plan.compiler } };
  };
  service.fingerprint = async () => {
    throw new Fault('IDENTITY_MISMATCH', 'Fixture target mismatch.', 5);
  };
  let settled = false;
  const pending = service.plan(ctx, 'dev');
  void pending.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await compilerStarted.promise;
  await new Promise(setImmediate);
  assert.equal(settled, false);
  releaseCompiler.resolve();
  await assert.rejects(pending, { code: 'IDENTITY_MISMATCH' });
  assert.equal(compilerFinished, true);
});

test('restricted MCP deployment stops before target reads or coordination writes', async () => {
  const { ctx, plan, oracle, service } = await prepared();
  let reads = 0;
  let writes = 0;
  oracle.requireMutationSupport = async () => {
    throw new Fault('SQLCL_MCP_RESTRICTED', 'Fixture restricted MCP.', 3, 'blocked');
  };
  oracle.verifyTarget = async () => {
    reads++;
    return { application: null };
  };
  service.lease = async () => {
    writes++;
  };
  await assert.rejects(service.apply(ctx, plan), { code: 'SQLCL_MCP_RESTRICTED', status: 'blocked' });
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

for (const fault of ['IDENTITY_MISMATCH', 'TARGET_DRIFT', 'COMPILER_DRIFT'] as const) {
  test(
    `concurrent apply preflight joins every read and blocks writes on ${fault}`,
    { timeout: 5000 },
    async () => {
      const { ctx, plan, oracle, service, fingerprint } = await prepared();
      const allStarted = latch();
      const release = latch();
      const started = new Set<string>();
      const finished = new Set<string>();
      const read = async (name: string) => {
        started.add(name);
        if (started.size === 3) allStarted.resolve();
        await release.promise;
        finished.add(name);
      };
      oracle.verifyTarget = async () => {
        await read('deploy identity');
        if (fault === 'IDENTITY_MISMATCH') throw new Fault(fault, 'Fixture target mismatch.', 5);
        return { application: null };
      };
      service.fingerprint = async () => {
        await read('read fingerprint');
        return { ...fingerprint, fingerprint: fault === 'TARGET_DRIFT' ? hash('changed') : plan.fingerprint };
      };
      oracle.requireCapability = async () => {
        await read('compiler capability');
        return { version: fault === 'COMPILER_DRIFT' ? 'changed compiler' : plan.compiler };
      };
      let writes = 0;
      service.lease = async () => {
        writes++;
      };
      let settled = false;
      const pending = service.apply(ctx, plan);
      void pending.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      await allStarted.promise;
      await new Promise(setImmediate);
      assert.equal(settled, false);
      assert.equal(writes, 0);
      release.resolve();
      await assert.rejects(pending, { code: fault });
      assert.equal(finished.size, 3);
      assert.equal(writes, 0);
    },
  );
}
