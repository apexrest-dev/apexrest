import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, rm } from 'node:fs/promises';
import { fixture } from '../fixtures/project.ts';
import { hash, writeJson, atomicWrite } from '../../packages/core/src/fs.ts';
import {
  blueprintSchema,
  stateSchema,
  planSchema,
  type Blueprint,
  type CompositionPlan,
} from '../../packages/core/src/composer/schemas.ts';
import { snapshot, planComposition, type Snapshot } from '../../packages/core/src/composer/planner.ts';
import {
  freeze,
  materialize,
  recoveryPlan,
  deploymentBinding,
} from '../../packages/core/src/composer/materializer.ts';
import { semanticDigest, planDigest, documentText } from '../../packages/core/src/composer/formats.ts';
import { planEnumLovs, verifySharedLovs } from '../../packages/core/src/composer/shared-lovs.ts';
import { COMPOSER_262_PROFILE } from '../../packages/core/src/composer/profiles.ts';
import { parseApexLang, get } from '../../packages/core/src/preview/apexlang.ts';

const profile261 = 'profile:apex261-ut261-mmd3102';
const foreign =
  '// Unmanaged bytes must survive exactly.\nlov foreign (\n    name: FOREIGN\n    source {\n        location: staticValues\n    }\n    entry one (\n        sequence: 10\n        display: One\n        return: 1\n    )\n)\n\n';
async function prepared(
  t: import('node:test').TestContext,
  profile = profile261,
  validation: 'compiler' | 'source-only' = 'source-only',
) {
  const { ctx } = await fixture();
  const previousHome = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = path.join(ctx.root, 'managed');
  t.after(async () => {
    if (previousHome === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = previousHome;
    await rm(ctx.root, { recursive: true, force: true });
  });
  const blueprint = blueprintSchema.parse(
    JSON.parse(
      await readFile(
        profile === COMPOSER_262_PROFILE
          ? 'resources/blueprints/crm-26.2.yaml'
          : 'tests/fixtures/composer/crm.blueprint.yaml',
        'utf8',
      ),
    ),
  );
  blueprint.application.compatibilityProfile = profile;
  blueprint.entities.Customer!.read.fields.status!.enum = ['ACTIVE', 'INACTIVE'];
  await writeJson(path.join(ctx.root, 'app.blueprint.yaml'), blueprint);
  await atomicWrite(
    path.join(ctx.root, ctx.config.application.sourceDir, 'shared-components/lovs.apx'),
    foreign,
  );
  const input = await snapshot(ctx, 'app.blueprint.yaml', { validation });
  return { ctx, blueprint: input.blueprint, input };
}
function after(input: Snapshot, plan: CompositionPlan, blueprint: Blueprint = input.blueprint): Snapshot {
  const sources = { ...input.sources },
    sourceInventory = { ...input.sourceInventory },
    bases = { ...input.bases };
  for (const operation of plan.operations) {
    if (operation.path.startsWith(input.sourceDir + '/')) {
      const file = operation.path.slice(input.sourceDir.length + 1);
      if (operation.content === null) {
        delete sources[file];
        delete sourceInventory[file];
      } else {
        sources[file] = operation.content;
        sourceInventory[file] = operation.after!;
      }
    } else if (operation.reason === 'retain-generated-base') bases[operation.after!] = operation.content!;
  }
  return { ...input, blueprint, sources, sourceInventory, bases, state: plan.state };
}
const assertMaterializable = (plan: CompositionPlan) =>
  assert.equal(plan.status, 'materializable', JSON.stringify(plan.diagnostics));

for (const profile of [profile261, COMPOSER_262_PROFILE])
  test(`${profile}: two forms share one enum LOV with stable identities and native item refs`, async (t) => {
    const { input, blueprint } = await prepared(t, profile);
    blueprint.blocks.SecondList = structuredClone(blueprint.blocks.CustomerList!);
    const first = planComposition(input);
    assertMaterializable(first);
    const resources = Object.values(first.state!.sharedResources!);
    assert.equal(resources.length, 1);
    const resource = resources[0]!;
    assert.deepEqual(resource.consumers, ['CustomerList', 'SecondList']);
    assert.equal(resource.retained, false);
    assert.equal(
      resource.file,
      profile === profile261
        ? 'shared-components/lovs.apx'
        : `shared-components/lovs/${resource.identity}.apx`,
    );
    for (const id of ['CustomerList', 'SecondList']) {
      const dialog = first.allocations[id]!.dialog!;
      const output = first.operations.find((op) => op.content?.startsWith(`page ${dialog} (`))!.content!;
      const item = parseApexLang(output)[0]!.children.find(
        (node) => node.type === 'pageItem' && node.id === `P${dialog}_STATUS`,
      )!;
      assert.equal(item.props.type, 'selectList');
      assert.equal(get(item.props, 'appearance.width'), undefined);
      assert.deepEqual(get(item.props, 'lov.lov'), { ref: resource.identity, global: false });
      assert.equal(String(get(item.props, 'lov.displayExtraValues')), 'false');
      assert.equal(String(get(item.props, 'lov.displayNullValue')), 'true');
      assert.match(output, new RegExp(`:P${dialog}_STATUS not in \\('ACTIVE', 'INACTIVE'\\)`));
    }
    const next = after(input, first),
      repeated = planComposition(next);
    assertMaterializable(repeated);
    assert.equal(repeated.operations.length, 0);
    assert.equal(repeated.state!.generationDigest, first.state!.generationDigest);
    assert.deepEqual(repeated.state!.sharedResources, first.state!.sharedResources);
    if (profile === profile261) assert.ok(next.sources[resource.file]!.startsWith(foreign));
  });

test('native enum entries preserve punctuation, quoting, Unicode, order and exact returns', () => {
  const values = ['A, B; C', "O'Reilly", 'key: value', 'a "quoted" value', 'Україна', ' padded '];
  const planned = planEnumLovs({
    profile: profile261,
    requests: [{ instanceId: 'List', field: 'status', type: 'string', values }],
    sources: {},
    bases: {},
    detachedConsumers: new Set(),
  });
  const entries = parseApexLang(Object.values(planned.files)[0]!)[0]!.children;
  assert.deepEqual(
    entries.map((entry) => entry.props.display),
    values,
  );
  assert.deepEqual(
    entries.map((entry) => entry.props.return),
    values,
  );
  assert.deepEqual(
    entries.map((entry) => Number(entry.props.sequence)),
    [10, 20, 30, 40, 50, 60],
  );
});

test('enum changes allocate a new immutable definition and retain the old resource without cleanup', async (t) => {
  const { input, blueprint } = await prepared(t);
  const initial = planComposition(input);
  assertMaterializable(initial);
  const old = Object.values(initial.state!.sharedResources!)[0]!;
  const nextBlueprint = structuredClone(blueprint);
  nextBlueprint.entities.Customer!.read.fields.status!.enum = ['INACTIVE', 'ACTIVE'];
  const second = planComposition(after(input, initial, nextBlueprint));
  assertMaterializable(second);
  assert.equal(Object.keys(second.state!.sharedResources!).length, 2);
  const retained = Object.values(second.state!.sharedResources!).find(
    (resource) => resource.identity === old.identity,
  )!;
  assert.equal(retained.retained, true);
  assert.equal(retained.digest, old.digest);
  assert.ok(second.diagnostics.some((d) => d.code === 'SHARED_RESOURCE_RETAINED'));
  assert.ok(second.operations.every((op) => op.after !== null));
  const result = after(after(input, initial), second, nextBlueprint);
  verifySharedLovs(second.state!.sharedResources!, result.sources, result.bases);
  assert.equal(planComposition(result).operations.length, 0);
});

test('detached and unrecognized consumers keep the immutable LOV unchanged', async (t) => {
  const { input, blueprint } = await prepared(t);
  const first = planComposition(input);
  assertMaterializable(first);
  const resource = Object.values(first.state!.sharedResources!)[0]!;
  const detached = structuredClone(blueprint);
  detached.blocks.CustomerList!.ownership = 'detached';
  detached.blocks.CustomerSummary!.ownership = 'detached';
  detached.connections = [];
  const next = after(input, first, detached);
  const unknown = `page 900 (\n    name: Unmanaged consumer\n    pageItem P900_STATUS (\n        type: selectList\n        lov {\n            type: sharedComponent\n            lov: @${resource.identity}\n        }\n    )\n)\n`;
  next.sources['pages/p00900-unmanaged.apx'] = unknown;
  next.sourceInventory['pages/p00900-unmanaged.apx'] = hash(unknown);
  const plan = planComposition(next);
  assertMaterializable(plan);
  const retained = Object.values(plan.state!.sharedResources!)[0]!;
  assert.deepEqual(retained.consumers, ['CustomerList']);
  assert.equal(retained.retained, true);
  assert.equal(plan.operations.length, 0);
  assert.equal(next.sources[resource.file], after(input, first).sources[resource.file]);
});

test('manual LOV edits block instead of changing or adopting shared definitions', async (t) => {
  const { input } = await prepared(t);
  const first = planComposition(input);
  assertMaterializable(first);
  const next = after(input, first),
    resource = Object.values(first.state!.sharedResources!)[0]!;
  next.sources[resource.file] = next.sources[resource.file]!.replace(
    'display: "ACTIVE"',
    'display: "MANUAL"',
  );
  next.sourceInventory[resource.file] = hash(next.sources[resource.file]!);
  const plan = planComposition(next);
  assert.equal(plan.status, 'blocked');
  assert.ok(plan.diagnostics.some((d) => d.code === 'SHARED_RESOURCE_EDITED'));
  assert.equal(plan.operations.length, 0);
  assert.match(next.sources[resource.file]!, /MANUAL/);
});

test('unmanaged LOV aliases and native names collide across arbitrary source filenames', async (t) => {
  const { input } = await prepared(t);
  const first = planComposition(input);
  assertMaterializable(first);
  const resource = Object.values(first.state!.sharedResources!)[0]!;
  for (const definition of [
    `lov ${resource.identity} (\n    name: "${resource.name}"\n)\n`,
    `lov "${resource.identity}" (\n    name: OTHER_NAME\n)\n`,
    `lov other-alias (\n  name: ${resource.name}\n)\n`,
    `lov other-alias (\n    name: "${resource.name}"\n)\n`,
  ]) {
    const copy = {
      ...input,
      sources: {
        ...input.sources,
        'anywhere/foreign.apx': definition,
      },
    };
    const blocked = planComposition(copy);
    assert.equal(blocked.status, 'blocked');
    assert.ok(blocked.diagnostics.some((d) => d.code === 'SHARED_RESOURCE_COLLISION'));
  }
});

test('foreign aliases/native names added after ownership block replan and verification', async (t) => {
  const { input } = await prepared(t);
  const first = planComposition(input);
  assertMaterializable(first);
  const resource = Object.values(first.state!.sharedResources!)[0]!;
  for (const definition of [
    `lov "${resource.identity}" (\n  name: FOREIGN_NAME\n)\n`,
    `lov foreign-name (\n  name: "${resource.name}"\n)\n`,
  ]) {
    const next = after(input, first);
    next.sources['anywhere/foreign.apx'] = definition;
    next.sourceInventory['anywhere/foreign.apx'] = hash(definition);
    assert.throws(() => verifySharedLovs(first.state!.sharedResources!, next.sources, next.bases), {
      code: 'SHARED_RESOURCE_EDITED',
    });
    const repeated = planComposition(next);
    assert.equal(repeated.status, 'blocked');
    assert.ok(repeated.diagnostics.some((d) => d.code === 'SHARED_RESOURCE_EDITED'));
  }
});

test('unsupported enum types, markup and substitutions refuse rather than emit text-field fallbacks', () => {
  for (const request of [
    { type: 'integer' as const, values: ['1', '2'] },
    { type: 'string' as const, values: ['<script>'] },
    { type: 'string' as const, values: ['&APP_USER.'] },
    { type: 'string' as const, values: ['&APP_USER!HTML.'] },
    { type: 'string' as const, values: ['&APP_USER!RAW.'] },
    { type: 'string' as const, values: ['&APP_USER!ATTR.'] },
    { type: 'string' as const, values: ['#STATUS#'] },
    { type: 'string' as const, values: ['#STATUS!HTML#'] },
    { type: 'string' as const, values: ['@foreign'] },
  ])
    assert.throws(
      () =>
        planEnumLovs({
          profile: profile261,
          requests: [{ instanceId: 'List', field: 'status', ...request }],
          sources: {},
          bases: {},
          detachedConsumers: new Set(),
        }),
      /Shared enum LOVs/,
    );
});

test('legacy state and plan canonical digests remain unchanged with no optional resource record', async (t) => {
  const { input, blueprint } = await prepared(t);
  delete blueprint.entities.Customer!.read.fields.status!.enum;
  const plan = planComposition(input);
  assertMaterializable(plan);
  assert.equal(Object.hasOwn(plan.state!, 'sharedResources'), false);
  const stateText = documentText(plan.state),
    raw = documentText(plan);
  assert.equal(documentText(stateSchema.parse(JSON.parse(stateText))), stateText);
  assert.equal(documentText(planSchema.parse(JSON.parse(raw))), raw);
  assert.equal(planDigest(planSchema.parse(JSON.parse(raw))), plan.digest);
  assert.equal(semanticDigest(stateSchema.parse(JSON.parse(stateText))), semanticDigest(plan.state));
});

test('an unused shared-LOV feature does not inspect or adopt unmanaged draft LOV source', async (t) => {
  const { input, blueprint } = await prepared(t);
  delete blueprint.entities.Customer!.read.fields.status!.enum;
  input.sources['unmanaged-draft.apx'] = 'lov draft-without-name (\n)\n';
  input.sourceInventory['unmanaged-draft.apx'] = hash(input.sources['unmanaged-draft.apx']);
  const plan = planComposition(input);
  assertMaterializable(plan);
  assert.equal(Object.hasOwn(plan.state!, 'sharedResources'), false);
  assert.ok(plan.operations.every((op) => !op.path.endsWith('unmanaged-draft.apx')));
});

for (const [type, apiType, values] of [
  ['integer', 'NUMBER', ['1', '2']],
  ['decimal', 'NUMBER', ['1.5', '2.5']],
  ['date', 'DATE', ['2026-01-01', '2026-02-01']],
  ['timestamp', 'TIMESTAMP', ['2026-01-01T00:00:00.000000', '2026-02-01T00:00:00.000000']],
] as const)
  test(`legacy ${type} enums retain native text-field and server validation behavior`, async (t) => {
    const { input, blueprint } = await prepared(t);
    delete blueprint.entities.Customer!.read.fields.status!.enum;
    const field = blueprint.entities.Customer!.read.fields.name!;
    field.type = type;
    field.enum = [...values];
    const signature = blueprint.contracts['project:save-customer']!;
    assert.equal(signature.kind, 'command');
    if (signature.kind !== 'command') throw Error('fixture');
    signature.parameters.P_CUSTOMER_NAME!.type = apiType;
    const plan = planComposition(input);
    assertMaterializable(plan);
    assert.equal(Object.hasOwn(plan.state!, 'sharedResources'), false);
    const dialog = plan.allocations.CustomerList!.dialog!;
    const source = plan.operations.find((op) => op.content?.startsWith(`page ${dialog} (`))!.content!;
    const item = parseApexLang(source)[0]!.children.find((node) => node.id === `P${dialog}_NAME`)!;
    assert.equal(item.props.type, 'textField');
    assert.equal(get(item.props, 'lov.lov'), undefined);
    assert.ok(source.includes(`:P${dialog}_NAME not in ('${values[0]}', '${values[1]}')`));
  });

for (const values of [
  ['<10', '>=10'],
  ['@handle', 'plain'],
  ['#SKU#', 'plain'],
  ['&APP_USER!RAW.', 'plain'],
])
  test(`legacy string enum ${values[0]} retains text-field validation outside the shared adapter`, async (t) => {
    const { input, blueprint } = await prepared(t);
    delete blueprint.entities.Customer!.read.fields.status!.enum;
    blueprint.entities.Customer!.read.fields.name!.enum = values;
    const plan = planComposition(input);
    assertMaterializable(plan);
    assert.equal(Object.hasOwn(plan.state!, 'sharedResources'), false);
    assert.ok(
      plan.diagnostics.some((d) => d.code === 'ENUM_SHARED_ADAPTER_UNAVAILABLE' && d.severity === 'info'),
    );
    const dialog = plan.allocations.CustomerList!.dialog!;
    const source = plan.operations.find((op) => op.content?.startsWith(`page ${dialog} (`))!.content!;
    const item = parseApexLang(source)[0]!.children.find((node) => node.id === `P${dialog}_NAME`)!;
    assert.equal(item.props.type, 'textField');
    assert.equal(get(item.props, 'lov.lov'), undefined);
    assert.ok(source.includes(`:P${dialog}_NAME not in ('${values[0]}', '${values[1]}')`));
  });

for (const action of ['resume', 'restore'] as const)
  test(`interrupted shared LOV materialization has exact journal ${action} recovery`, async (t) => {
    const { ctx, input } = await prepared(t);
    const plan = planComposition(input);
    assertMaterializable(plan);
    await freeze(ctx, plan, 'plans/initial.json');
    const resource = Object.values(plan.state!.sharedResources!)[0]!;
    await assert.rejects(
      materialize(ctx, plan, {
        boundary: async (phase, file) => {
          if (phase === 'after-write' && file === input.sourceDir + '/' + resource.file)
            throw new Error('Simulated interruption');
        },
      }),
      { code: 'RECOVERY_REQUIRED' },
    );
    const recovery = await recoveryPlan(ctx, action);
    await freeze(ctx, recovery, 'plans/recovery.json');
    await materialize(ctx, recovery);
    const current = await readFile(path.join(ctx.root, input.sourceDir, resource.file), 'utf8');
    if (action === 'restore') assert.equal(current, foreign);
    else {
      const state = stateSchema.parse(
        JSON.parse(await readFile(path.join(ctx.root, '.apexrest-composer/state.json'), 'utf8')),
      );
      assert.equal(Object.keys(state.sharedResources!).length, 1);
      const repeated = planComposition(
        await snapshot(ctx, 'app.blueprint.yaml', { validation: 'source-only' }),
      );
      assertMaterializable(repeated);
      assert.equal(repeated.operations.length, 0);
    }
  });

test('deployment binding checks shared declarations after a materialized compiler-qualified fixture', async (t) => {
  const { ctx, input } = await prepared(t, profile261, 'compiler');
  // Repository fixture qualification flag only. This test executes no vendor compiler or Oracle.
  const plan = planComposition(input);
  assertMaterializable(plan);
  await freeze(ctx, plan, 'plans/initial.json');
  await materialize(ctx, plan);
  await deploymentBinding(ctx);
  const resource = Object.values(plan.state!.sharedResources!)[0]!,
    file = path.join(ctx.root, input.sourceDir, resource.file);
  const before = await readFile(file, 'utf8');
  const foreignFile = path.join(ctx.root, input.sourceDir, 'foreign-lov.apx');
  await atomicWrite(foreignFile, `lov foreign (\n  name: "${resource.name}"\n)\n`);
  await assert.rejects(deploymentBinding(ctx), { code: 'SHARED_RESOURCE_EDITED' });
  await rm(foreignFile);
  await atomicWrite(file, before.replace('display: "ACTIVE"', 'display: "EDITED"'));
  await assert.rejects(deploymentBinding(ctx), { code: 'SHARED_RESOURCE_EDITED' });
});
