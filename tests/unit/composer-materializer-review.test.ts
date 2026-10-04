import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, rm } from 'node:fs/promises';
import { fixture } from '../fixtures/project.ts';
import { atomicWrite, hash, inventory, writeJson } from '../../packages/core/src/fs.ts';
import { blueprintSchema } from '../../packages/core/src/composer/schemas.ts';
import {
  canonical,
  documentText,
  parseDocumentData,
  planDigest,
  validate,
} from '../../packages/core/src/composer/formats.ts';
import { snapshot, planComposition } from '../../packages/core/src/composer/planner.ts';
import {
  freeze,
  journal,
  materialize,
  recoveryPlan,
  deploymentBinding,
} from '../../packages/core/src/composer/materializer.ts';

async function setup(validation: 'compiler' | 'source-only' = 'source-only') {
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
  const plan = planComposition(await snapshot(ctx, 'app.blueprint.yaml', { validation }));
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

async function interrupt(
  ctx: Awaited<ReturnType<typeof setup>>['ctx'],
  plan: Awaited<ReturnType<typeof setup>>['plan'],
) {
  await assert.rejects(() =>
    materialize(ctx, plan, {
      boundary: async (phase) => {
        if (phase === 'prepared') throw new Error('interrupted');
      },
    }),
  );
}

test('a source-only receipt never binds into a deployment plan', async (t) => {
  const { ctx, plan } = await setup('source-only');
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  await materialize(ctx, plan);
  await assert.rejects(() => deploymentBinding(ctx), { code: 'COMPOSITION_UNQUALIFIED' });
  const compiled = planComposition(await snapshot(ctx, 'app.blueprint.yaml', { validation: 'compiler' }));
  await freeze(ctx, compiled, 'plans/compiled.json');
  assert.equal((await materialize(ctx, compiled)).status, 'no-op');
  assert.equal((await deploymentBinding(ctx))!.generationDigest, plan.state!.generationDigest);
});

test('a reviewed no-op plan rewrites a stale receipt', async (t) => {
  const { ctx, plan } = await setup('compiler');
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  await materialize(ctx, plan);
  const file = path.join(ctx.root, '.apexrest/composer/receipt.json'),
    stale = {
      ...JSON.parse(await readFile(file, 'utf8')),
      planDigest: '0'.repeat(64),
      lockDigest: 'f'.repeat(64),
    };
  await writeJson(file, stale);
  await assert.rejects(() => deploymentBinding(ctx), { code: 'COMPOSITION_DRIFT' });
  const repeat = planComposition(await snapshot(ctx, 'app.blueprint.yaml', { validation: 'compiler' }));
  await freeze(ctx, repeat, 'plans/repeat.json');
  assert.equal((await materialize(ctx, repeat)).status, 'no-op');
  const receipt = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(receipt.planDigest, repeat.digest);
  assert.notEqual(canonical(receipt), canonical(stale));
  assert.equal((await deploymentBinding(ctx))!.generationDigest, plan.state!.generationDigest);
  for (const corrupt of ['not json', '{}\n']) {
    await atomicWrite(file, corrupt);
    assert.equal((await materialize(ctx, repeat)).status, 'no-op');
    assert.equal(JSON.parse(await readFile(file, 'utf8')).planDigest, repeat.digest);
  }
});

test('recovery requires the immutable reviewed plan record for the journal', async (t) => {
  for (const kind of ['missing', 'changed'] as const) {
    const { ctx, plan } = await setup();
    t.after(() => rm(ctx.root, { recursive: true, force: true }));
    await interrupt(ctx, plan);
    const frozen = path.join(ctx.root, `.apexrest/composer/plans/${plan.digest}.json`);
    if (kind === 'missing') await rm(frozen);
    else await atomicWrite(frozen, documentText({ ...plan, diagnostics: [] }));
    for (const action of ['resume', 'restore'] as const)
      await assert.rejects(() => recoveryPlan(ctx, action), { code: 'JOURNAL_CORRUPT' }, kind);
  }
});

test('recovery applies the frozen-plan and write-scope checks to an already reviewed recovery', async (t) => {
  const { ctx, plan } = await setup();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  await interrupt(ctx, plan);
  const recovery = await recoveryPlan(ctx, 'restore');
  await freeze(ctx, recovery, 'plans/recovery.json');
  await rm(path.join(ctx.root, `.apexrest/composer/plans/${plan.digest}.json`));
  await assert.rejects(() => materialize(ctx, recovery), { code: 'JOURNAL_CORRUPT' });
});

test('a forged journal cannot steer recovery outside Composer write scope', async (t) => {
  for (const target of [
    'apexrest.json',
    'APPLICATION/.apex/metadata.json',
    '.apexrest-composer/bases/x.apx',
  ]) {
    const { ctx, plan } = await setup();
    t.after(() => rm(ctx.root, { recursive: true, force: true }));
    await interrupt(ctx, plan);
    const record = (await journal(ctx))!,
      before = await readFile(
        path.join(ctx.root, target.replace('APPLICATION', ctx.config.application.sourceDir)),
        'utf8',
      ).catch(() => null),
      destination = target.replace('APPLICATION', ctx.config.application.sourceDir),
      forged = structuredClone(record.plan),
      operation = forged.operations.find((op) => op.path.startsWith(ctx.config.application.sourceDir + '/'))!,
      entry = record.records.find((e) => e.path === operation.path)!;
    operation.path = destination;
    operation.before = null;
    entry.path = destination;
    entry.before = null;
    entry.preimage = null;
    forged.digest = planDigest(forged);
    record.plan = forged;
    // An attacker able to write the private journal can also write a matching frozen plan.
    await atomicWrite(
      path.join(ctx.root, `.apexrest/composer/plans/${forged.digest}.json`),
      documentText(forged),
    );
    await writeJson(path.join(ctx.root, '.apexrest/composer/journal.json'), record);
    for (const action of ['resume', 'restore'] as const)
      await assert.rejects(() => recoveryPlan(ctx, action), { code: 'COMPOSITION_SCOPE_DENIED' }, target);
    await assert.rejects(() => deploymentBinding(ctx), { code: 'COMPOSITION_SCOPE_DENIED' });
    assert.equal(await readFile(path.join(ctx.root, destination), 'utf8').catch(() => null), before);
  }
});
