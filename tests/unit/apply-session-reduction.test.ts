import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { observedWorkingCopy } from '../fixtures/observed-working-copy.ts';
import { inventory, writeJson } from '../../packages/core/src/fs.ts';
import {
  sqlclTimings,
  withSqlclTimings,
  recordSqlclTiming,
  executionTiming,
} from '../../packages/core/src/sqlcl-timings.ts';
import type { DeployPlan } from '../../packages/core/src/deploy.ts';
import { Fault } from '../../packages/core/src/result.ts';

async function prepared(sameConnection = true, fresh = false) {
  const f = await observedWorkingCopy();
  if (sameConnection) f.env.deployConnectionRef = f.env.readConnectionRef;
  await writeJson(path.join(f.ctx.root, 'apexrest.json'), f.ctx.config);
  if (fresh) await f.store.write({ ...f.state, status: 'invalidated', revision: f.state.revision + 1 });
  const plan = await f.service.plan(f.ctx, 'dev', fresh);
  await writeJson(path.join(process.env.APEXREST_HOME!, 'policy.json'), {
    schemaVersion: 1,
    grants: [
      {
        projectRoot: f.ctx.root,
        targetDigest: plan.targetDigest,
        planDigest: plan.digest,
        operations: ['deploy'],
        expiresAt: plan.expiresAt,
      },
    ],
  });
  f.connections.length = 0;
  f.calls.length = 0;
  return { ...f, plan: plan as DeployPlan };
}

test('working-copy full apply uses 4 connected sessions in order', async () => {
  const f = await prepared();
  await withSqlclTimings(async () => {
    const result = await f.service.apply(f.ctx, f.plan);
    assert.equal(result.state, 'succeeded');
    const events = (await readFile(path.join(result.directory, 'journal.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      events.map((event) => event.state),
      ['approved', 'backing_up', 'migrating', 'importing', 'verifying', 'succeeded'],
    );
    assert.deepEqual(
      events.flatMap((event) => event.details.sqlclTimings).map((record) => record.label),
      ['targetWithMetadata', 'targetWithMetadata', 'import', 'targetWithMetadata'],
    );
    const records = sqlclTimings();
    assert.deepEqual(
      records.map((r) => r.label),
      ['targetWithMetadata', 'targetWithMetadata', 'import', 'targetWithMetadata'],
    );
    assert.ok(records.every((r) => r.connected));
    assert.deepEqual(
      records.map((r) => r.mutation),
      [false, false, true, false],
    );
  });
  assert.equal(f.connections.length, 4);
  assert.deepEqual(
    (await f.store.read())!.observedMetadata,
    f.controls.metadata,
    'Checkpoint takes post-import metadata.',
  );
});

test('drift between start and the post-freeze pre-import observation blocks import', async () => {
  const f = await prepared();
  let observations = 0;
  f.observationControls.beforeObservation = () => {
    if (++observations === 2) f.controls.metadata.lastUpdatedOn = 'external edit';
  };
  await assert.rejects(f.service.apply(f.ctx, f.plan), { code: 'SYNC_SERVER_CHANGED' });
  assert.ok(!f.calls.includes('import'));
  assert.equal((await f.store.read())!.status, 'ready');
});

test('apply journal excludes observations preceding apply in a shared recorder', async () => {
  const f = await prepared();
  await withSqlclTimings(async () => {
    recordSqlclTiming('codescan', executionTiming('cli'));
    const result = await f.service.apply(f.ctx, f.plan);
    const events = (await readFile(path.join(result.directory, 'journal.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.ok(!events.flatMap((event) => event.details.sqlclTimings).some((r) => r.label === 'codescan'));
    assert.equal(sqlclTimings()[0]!.label, 'codescan', 'Outer operation still retains its own observation.');
  });
});

test('different read and deploy connections refresh deploy identity immediately before import', async () => {
  const f = await prepared(false);
  await withSqlclTimings(async () => {
    await f.service.apply(f.ctx, f.plan);
    const labels = sqlclTimings().map((r) => r.label);
    assert.deepEqual(labels.slice(0, 2).sort(), ['targetWithMetadata', 'verifyTarget']);
    assert.deepEqual(labels.slice(2), ['targetWithMetadata', 'verifyTarget', 'import', 'targetWithMetadata']);
  });
  assert.match(f.connections[3]!, /-name deploy/);
  assert.match(f.connections[4]!, /-name deploy/);
  assert.equal(f.connections.length, 6);
  assert.match(f.connections[2]!, /-name read/);
  assert.match(f.connections[5]!, /-name read/);
});

test('deploy identity failure at the final barrier prevents import', async () => {
  const f = await prepared(false);
  const verify = f.oracle.verifyTarget.bind(f.oracle);
  let deployChecks = 0;
  f.oracle.verifyTarget = async (...args) => {
    if (args[1].kind === 'sqlcl-store' && args[1].name === 'deploy' && ++deployChecks === 2)
      throw new Fault('TARGET_MISMATCH', 'Fixture deploy target changed.', 4, 'blocked');
    return verify(...args);
  };
  await assert.rejects(f.service.apply(f.ctx, f.plan), { code: 'TARGET_MISMATCH' });
  assert.equal(deployChecks, 2);
  assert.ok(!f.calls.includes('import'));
});

test('fresh backup retains the stronger post-freeze pre-import drift barrier', async () => {
  const f = await prepared(true, true);
  // Apply starts from the plan's kept export and reads identity only; the change lands after it.
  const verifyTarget = f.oracle.verifyTarget.bind(f.oracle);
  let reads = 0;
  f.oracle.verifyTarget = async (...args) => {
    const result = await verifyTarget(...args);
    if (++reads === 1) f.controls.alias = 'externally-changed';
    return result;
  };
  await assert.rejects(f.service.apply(f.ctx, f.plan), {
    code: 'TARGET_DRIFT',
    message: 'Target changed before import.',
  });
  assert.ok(!f.calls.includes('import'));
});

async function countExports(f: Awaited<ReturnType<typeof prepared>>) {
  const exportApplication = f.oracle.exportApplication.bind(f.oracle);
  const count = { exports: 0 };
  f.oracle.exportApplication = async (...args) => {
    count.exports++;
    return exportApplication(...args);
  };
  return count;
}
const keptExport = (f: Awaited<ReturnType<typeof prepared>>) =>
  path.join(f.ctx.root, '.apexrest/plans', f.plan.id, 'live-before');

test('fresh-export apply reuses the export the plan kept as its backup: one export before import', async () => {
  const f = await prepared(true, true);
  const planned = await inventory(keptExport(f));
  assert.ok(Object.keys(planned).length, 'The plan kept its observed export.');
  const count = await countExports(f);
  const result = await f.service.apply(f.ctx, f.plan);
  assert.equal(result.state, 'succeeded');
  assert.equal(count.exports, 1, 'Only the pre-import barrier exports.');
  const backup = await inventory(path.join(f.ctx.root, '.apexrest/backups', result.backupId!, 'application'));
  assert.deepEqual(backup, planned, 'The backup is the planned server content.');
});

test('content drift after the plan is caught by the pre-import export when the kept export is reused', async () => {
  const f = await prepared(true, true);
  const exportApplication = f.oracle.exportApplication.bind(f.oracle);
  f.oracle.exportApplication = async (...args) => {
    const result = await exportApplication(...args);
    return { ...result, digest: 'f'.repeat(64) };
  };
  await assert.rejects(f.service.apply(f.ctx, f.plan), {
    code: 'TARGET_DRIFT',
    message: 'Target changed before import.',
  });
  assert.ok(!f.calls.includes('import'));
});

test('a missing kept export makes apply export for its backup as before', async () => {
  const f = await prepared(true, true);
  await rm(keptExport(f), { recursive: true });
  const count = await countExports(f);
  const result = await f.service.apply(f.ctx, f.plan);
  assert.equal(result.state, 'succeeded');
  assert.equal(count.exports, 2);
});

test('an altered kept export is not trusted: apply exports and backs up the server content', async () => {
  const f = await prepared(true, true);
  const planned = await inventory(keptExport(f));
  await writeFile(path.join(keptExport(f), 'injected.apx'), 'page 99 (\n)\n');
  const count = await countExports(f);
  const result = await f.service.apply(f.ctx, f.plan);
  assert.equal(result.state, 'succeeded');
  assert.equal(count.exports, 2);
  const backup = await inventory(path.join(f.ctx.root, '.apexrest/backups', result.backupId!, 'application'));
  assert.deepEqual(backup, planned, 'The injected file never reaches the backup.');
});

test('cancellation during the final observation leaves a ready copy and no import', async () => {
  const f = await prepared();
  const controller = new AbortController();
  let observations = 0;
  f.observationControls.beforeObservation = () => {
    if (++observations === 2) controller.abort();
  };
  await assert.rejects(f.service.apply(f.ctx, f.plan, controller.signal), {
    code: 'CANCELLED',
    status: 'cancelled',
  });
  assert.ok(!f.calls.includes('import'));
  assert.equal((await f.store.read())!.status, 'ready');
});

async function journalStates(f: Awaited<ReturnType<typeof prepared>>, error: unknown) {
  const runId = (error as Fault).details!.deploymentRunId as string;
  return (await readFile(path.join(f.ctx.root, '.apexrest/deployments', runId, 'journal.jsonl'), 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line).state);
}

test('an import Oracle rejects is a failure with its message once a fresh read shows the target unchanged', async () => {
  const f = await prepared();
  f.oracle.importApplication = async () => {
    throw new Fault(
      'ORACLE_COMMAND_FAILED',
      'ORA-20001: duplicate executionMappingIdentifier on page 3',
      1,
      'failed',
      {
        diagnostics: [{ file: 'pages/p00003.apx', line: 12, message: 'duplicate' }],
      },
    );
  };
  const error = await f.service.apply(f.ctx, f.plan).then(
    () => undefined,
    (e) => e,
  );
  assert.ok(error instanceof Fault);
  assert.equal(error.code, 'IMPORT_REJECTED');
  assert.equal(error.status, 'failed');
  assert.match(error.message, /ORA-20001: duplicate executionMappingIdentifier/);
  assert.equal(error.details!.targetUnchanged, true);
  assert.deepEqual(error.details!.diagnostics, [
    { file: 'pages/p00003.apx', line: 12, message: 'duplicate' },
  ]);
  assert.equal((await journalStates(f, error)).at(-1), 'failed');
  const sync = (await f.store.read())!;
  assert.equal(sync.status, 'ready', 'The working copy is as it was before the run.');
  assert.equal(sync.importingRunId, null);
});

test('a rejected import stays an unknown outcome when the target no longer matches the plan', async () => {
  const f = await prepared();
  f.oracle.importApplication = async () => {
    f.controls.metadata.lastUpdatedOn = 'partly imported';
    throw new Fault('ORACLE_COMMAND_FAILED', 'ORA-20001: failed half way', 1);
  };
  await assert.rejects(f.service.apply(f.ctx, f.plan), {
    code: 'OUTCOME_UNKNOWN',
    status: 'outcome_unknown',
  });
  assert.equal((await f.store.read())!.status, 'outcome_unknown');
});

test('an import that lost its connection is never classified as rejected', async () => {
  const f = await prepared();
  f.oracle.importApplication = async () => {
    throw new Fault('ORACLE_COMMAND_FAILED', 'ORA-03113: end-of-file on communication channel', 1);
  };
  await assert.rejects(f.service.apply(f.ctx, f.plan), {
    code: 'OUTCOME_UNKNOWN',
    status: 'outcome_unknown',
  });
});

test('an import stopped by the client is never classified as rejected', async () => {
  const f = await prepared();
  f.oracle.importApplication = async () => {
    throw new Fault('TIMEOUT', 'SQLcl did not complete with a confirmed outcome.', 6, 'outcome_unknown');
  };
  await assert.rejects(f.service.apply(f.ctx, f.plan), {
    code: 'OUTCOME_UNKNOWN',
    status: 'outcome_unknown',
  });
});
