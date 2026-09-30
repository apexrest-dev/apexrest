import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, rm } from 'node:fs/promises';
import { fixture } from '../fixtures/project.ts';
import { atomicWrite, hash, inventory, writeJson } from '../../packages/core/src/fs.ts';
import { blueprintSchema } from '../../packages/core/src/composer/schemas.ts';
import { documentText, parseDocumentData, validate } from '../../packages/core/src/composer/formats.ts';
import { snapshot, planComposition } from '../../packages/core/src/composer/planner.ts';
import {
  freeze,
  journal,
  materialize,
  recoveryPlan,
  deploymentBinding,
} from '../../packages/core/src/composer/materializer.ts';

async function setup() {
  const { ctx } = await fixture();
  process.env.APEXREST_HOME = path.join(ctx.root, 'managed');
  await writeJson(path.join(process.env.APEXREST_HOME, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [ctx.root],
    grants: [],
  });
  const blueprint = validate(
    blueprintSchema,
    parseDocumentData(await readFile('tests/fixtures/composer/crm.blueprint.yaml', 'utf8')),
  );
  await writeJson(path.join(ctx.root, 'app.blueprint.yaml'), blueprint);
  const plan = planComposition(await snapshot(ctx, 'app.blueprint.yaml', { validation: 'source-only' }));
  assert.equal(plan.status, 'materializable', JSON.stringify(plan.diagnostics));
  await freeze(ctx, plan, 'plans/compose.json');
  return { ctx, plan };
}

test('recovery rejects omitted plan writes and state records without changing source', async (t) => {
  for (const kind of ['base', 'source', 'state', 'lock'] as const) {
    const { ctx, plan } = await setup();
    t.after(() => rm(ctx.root, { recursive: true, force: true }));
    const before = await inventory(path.join(ctx.root, ctx.config.application.sourceDir));
    await assert.rejects(() =>
      materialize(ctx, plan, {
        boundary: async (phase) => {
          if (phase === 'prepared') throw new Error('interrupted');
        },
      }),
    );
    const record = (await journal(ctx))!;
    const omitted = record.records.find((entry) =>
      kind === 'base'
        ? entry.path.startsWith('.apexrest-composer/bases/')
        : kind === 'source'
          ? entry.path.startsWith(ctx.config.application.sourceDir + '/')
          : entry.path === `.apexrest-composer/${kind}.json`,
    )!;
    record.records = record.records.filter((entry) => entry.path !== omitted.path);
    await writeJson(path.join(ctx.root, '.apexrest/composer/journal.json'), record);
    for (const action of ['resume', 'restore'] as const)
      await assert.rejects(() => recoveryPlan(ctx, action), { code: 'JOURNAL_CORRUPT' });
    await assert.rejects(() => deploymentBinding(ctx), { code: 'JOURNAL_CORRUPT' });
    assert.deepEqual(await inventory(path.join(ctx.root, ctx.config.application.sourceDir)), before);
  }
});

test('recovery rejects a missing changed lock even when its postimage is present', async (t) => {
  const { ctx, plan } = await setup();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  await materialize(ctx, plan);
  const blueprint = validate(
    blueprintSchema,
    parseDocumentData(await readFile(path.join(ctx.root, 'app.blueprint.yaml'), 'utf8')),
  );
  blueprint.blocks.CustomerList!.parameters.title = 'Renamed customers';
  await writeJson(path.join(ctx.root, 'app.blueprint.yaml'), blueprint);
  const changed = planComposition(await snapshot(ctx, 'app.blueprint.yaml', { validation: 'source-only' }));
  await freeze(ctx, changed, 'plans/changed.json');
  await assert.rejects(() =>
    materialize(ctx, changed, {
      boundary: async (phase, file) => {
        if (phase === 'after-write' && file === '.apexrest-composer/lock.json') throw new Error('stop');
      },
    }),
  );
  const record = (await journal(ctx))!;
  record.records = record.records.filter((entry) => entry.path !== '.apexrest-composer/lock.json');
  await writeJson(path.join(ctx.root, '.apexrest/composer/journal.json'), record);
  for (const action of ['resume', 'restore'] as const)
    await assert.rejects(() => recoveryPlan(ctx, action), { code: 'JOURNAL_CORRUPT' });
});

test('state preimage must match its reviewed digest even when its image hash is consistent', async (t) => {
  const { ctx, plan } = await setup();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  await assert.rejects(() =>
    materialize(ctx, plan, {
      boundary: async (phase) => {
        if (phase === 'prepared') throw new Error('stop');
      },
    }),
  );
  const record = (await journal(ctx))!;
  const state = record.records.find((entry) => entry.path === '.apexrest-composer/state.json')!;
  state.preimage = documentText(plan.state);
  state.before = hash(state.preimage);
  await writeJson(path.join(ctx.root, '.apexrest/composer/journal.json'), record);
  await assert.rejects(() => recoveryPlan(ctx, 'restore'), { code: 'JOURNAL_CORRUPT' });
});

test('unchanged lock journals preserve recovery without requiring a redundant lock record', async (t) => {
  for (const orphan of [false, true])
    for (const action of ['resume', 'restore'] as const) {
      const { ctx, plan } = await setup();
      t.after(() => rm(ctx.root, { recursive: true, force: true }));
      let next = plan;
      if (orphan) {
        await atomicWrite(path.join(ctx.root, '.apexrest-composer/lock.json'), documentText(plan.lock));
      } else {
        await materialize(ctx, plan);
        const source = plan.operations.find((entry) =>
          entry.path.startsWith(ctx.config.application.sourceDir + '/'),
        )!;
        await atomicWrite(path.join(ctx.root, source.path), source.content + '\n// Local extension\n');
        next = planComposition(await snapshot(ctx, 'app.blueprint.yaml', { validation: 'source-only' }));
        await freeze(ctx, next, 'plans/next.json');
      }
      const lockBefore = await readFile(path.join(ctx.root, '.apexrest-composer/lock.json'), 'utf8');
      await assert.rejects(() =>
        materialize(ctx, next, {
          boundary: async (phase) => {
            if (phase === 'prepared') throw new Error('stop');
          },
        }),
      );
      const record = (await journal(ctx))!;
      assert.ok(!record.records.some((entry) => entry.path === '.apexrest-composer/lock.json'));
      const recovery = await recoveryPlan(ctx, action);
      await freeze(ctx, recovery, 'plans/recovery.json');
      await materialize(ctx, recovery);
      assert.equal(await readFile(path.join(ctx.root, '.apexrest-composer/lock.json'), 'utf8'), lockBefore);
      assert.equal((await journal(ctx))!.phase, 'completed');
    }
});

test('recovery rejects duplicate and unknown journal checkpoints', async (t) => {
  for (const kind of ['duplicate', 'unknown'] as const) {
    const { ctx, plan } = await setup();
    t.after(() => rm(ctx.root, { recursive: true, force: true }));
    await assert.rejects(() =>
      materialize(ctx, plan, {
        boundary: async (phase) => {
          if (phase === 'prepared') throw new Error('interrupted');
        },
      }),
    );
    const record = (await journal(ctx))!;
    record.completed =
      kind === 'duplicate' ? [record.records[0]!.path, record.records[0]!.path] : ['unrelated.apx'];
    await writeJson(path.join(ctx.root, '.apexrest/composer/journal.json'), record);
    await assert.rejects(() => recoveryPlan(ctx, 'resume'), { code: 'JOURNAL_CORRUPT' });
  }
});

test('source changes at receipt and completion boundaries leave recovery pending', async (t) => {
  for (const boundary of ['before-receipt', 'after-receipt', 'before-complete']) {
    const { ctx, plan } = await setup();
    t.after(() => rm(ctx.root, { recursive: true, force: true }));
    const target = plan.operations.find((entry) =>
      entry.path.startsWith(ctx.config.application.sourceDir + '/'),
    )!;
    const concurrent = target.content + '\n// Concurrent user change\n';
    await assert.rejects(
      () =>
        materialize(ctx, plan, {
          boundary: async (phase) => {
            if (phase === boundary) await atomicWrite(path.join(ctx.root, target.path), concurrent);
          },
        }),
      { code: 'RECOVERY_REQUIRED' },
    );
    assert.equal((await journal(ctx))!.phase, 'writing');
    assert.equal(await readFile(path.join(ctx.root, target.path), 'utf8'), concurrent);
    await assert.rejects(() => recoveryPlan(ctx, 'resume'), { code: 'RECOVERY_CONFLICT' });
    await assert.rejects(() => deploymentBinding(ctx), { code: 'RECOVERY_REQUIRED' });
  }
});

test('receipt changed before journal completion keeps deployment blocked', async (t) => {
  const { ctx, plan } = await setup();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  await assert.rejects(
    () =>
      materialize(ctx, plan, {
        boundary: async (phase) => {
          if (phase === 'before-complete')
            await atomicWrite(path.join(ctx.root, '.apexrest/composer/receipt.json'), '{}\n');
        },
      }),
    { code: 'RECOVERY_REQUIRED' },
  );
  assert.equal((await journal(ctx))!.phase, 'writing');
  await assert.rejects(() => deploymentBinding(ctx), { code: 'RECOVERY_REQUIRED' });
});
