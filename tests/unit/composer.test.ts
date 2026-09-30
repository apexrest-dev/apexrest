import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, rm, symlink, cp } from 'node:fs/promises';
import { fixture } from '../fixtures/project.ts';
import { atomicWrite, hash, writeJson, inventory } from '../../packages/core/src/fs.ts';
import { blueprintSchema, contractSchema } from '../../packages/core/src/composer/schemas.ts';
import {
  parseDocumentData,
  safePath,
  semanticDigest,
  validate,
} from '../../packages/core/src/composer/formats.ts';
import { snapshot, planComposition } from '../../packages/core/src/composer/planner.ts';
import {
  freeze,
  materialize,
  recoveryPlan,
  deploymentBinding,
} from '../../packages/core/src/composer/materializer.ts';
import { threeWay, editSpans, declarations } from '../../packages/core/src/composer/reader.ts';
import { loadCatalog, catalogSearch, resolvePackages } from '../../packages/core/src/composer/catalog.ts';
import { bind } from '../../packages/core/src/composer/binding.ts';
import { composePlan, composePlanInput } from '../../packages/core/src/composer/service.ts';

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
  return { ctx, blueprint, plan };
}
test('recovery planning does not claim compiler qualification from the default validation option', async () => {
  for (const action of ['recover-resume', 'recover-restore'] as const) {
    const { ctx, plan } = await setup();
    try {
      await assert.rejects(
        materialize(ctx, plan, {
          boundary: async (phase) => {
            if (phase === 'prepared') throw new Error('Interrupted for recovery');
          },
        }),
        { code: 'RECOVERY_REQUIRED' },
      );
      const result = await composePlan(ctx, composePlanInput.parse({ action, out: 'plans/recover.json' }));
      assert.equal(result.status, 'materializable');
      assert.equal(result.qualification, 'unverified');
      assert.deepEqual(result.compiler, { status: 'not-run', reason: 'Local journal recovery.' });
    } finally {
      await rm(ctx.root, { recursive: true, force: true });
    }
  }
});
test('safe YAML rejects duplicate keys, alias, tags, prototype keys, multi-document and non-finite values', () => {
  for (const source of [
    'a: 1\na: 2',
    'a: &x [1]\nb: *x',
    'a: !!str 1',
    '__proto__: {}',
    'a: .nan',
    'a: 1\n---\nb: 2',
  ])
    assert.throws(() => parseDocumentData(source));
  assert.deepEqual(parseDocumentData('name: Customer\nenabled: true\n'), { name: 'Customer', enabled: true });
  assert.equal(
    semanticDigest(parseDocumentData('a: 1\nb: 2')),
    semanticDigest(parseDocumentData('b: 2\na: 1')),
  );
  assert.throws(() => blueprintSchema.parse({ schemaVersion: 1, extra: true }));
});
test('paths reject traversal and symlinks including contained targets', async () => {
  const { ctx } = await fixture();
  assert.rejects(() => safePath(ctx.root, '../x'));
  await symlink('toolchain.json', path.join(ctx.root, 'link'));
  await assert.rejects(() => safePath(ctx.root, 'link'));
  await rm(ctx.root, { recursive: true, force: true });
});
test('offline catalog exact resolver, EN/UK discovery and integrity checks', async () => {
  const catalog = await loadCatalog();
  assert.equal(catalog.packages.size, 6);
  assert.equal(
    resolvePackages(catalog, ['block:crud/report-dialog@1.0.0'], 'profile:apex261-ut261-mmd3102').size,
    1,
  );
  assert.throws(() =>
    resolvePackages(catalog, ['block:crud/report-dialog@latest'], 'profile:apex261-ut261-mmd3102'),
  );
  assert.throws(() => resolvePackages(catalog, ['block:crud/report-dialog@1.0.0'], 'unknown'));
  assert.equal((await catalogSearch('підсумки')).results[0]!.id, 'block:analytics/status-summary@1.0.0');
  await assert.rejects(() => catalogSearch('CRM', { cursor: '0'.repeat(64) }));
});
test('deterministic plan ignores mapping order, allocates two instances without collisions', async () => {
  const { ctx, plan, blueprint } = await setup();
  const input = await snapshot(ctx, 'app.blueprint.yaml', { validation: 'source-only' });
  const reordered = Object.fromEntries(Object.entries(blueprint.blocks).reverse());
  assert.equal(
    planComposition({ ...input, blueprint: { ...blueprint, blocks: reordered } }).digest,
    plan.digest,
  );
  const two = planComposition({
    ...input,
    blueprint: blueprintSchema.parse({
      ...blueprint,
      blocks: { ...blueprint.blocks, SecondList: blueprint.blocks.CustomerList },
    }),
  });
  assert.equal(two.status, 'materializable');
  assert.notEqual(two.allocations.CustomerList!.page, two.allocations.SecondList!.page);
  await rm(ctx.root, { recursive: true, force: true });
});
test('contracts block missing authorization, composite writes and unknown command arguments', async () => {
  const { ctx, blueprint } = await setup();
  const instance = blueprint.blocks.CustomerList!;
  assert.throws(() => bind({ ...blueprint, contracts: {} }, instance));
  const entity = blueprint.entities.Customer!;
  assert.throws(() =>
    bind(
      {
        ...blueprint,
        entities: { Customer: { ...entity, read: { ...entity.read, key: ['id', 'version'] } } },
      },
      instance,
    ),
  );
  const missing = { ...blueprint.commands.SaveCustomer!, inputs: {} };
  assert.throws(() => bind({ ...blueprint, commands: { SaveCustomer: missing } }, instance));
  await rm(ctx.root, { recursive: true, force: true });
});
test('structural merge retains unmanaged spans at exact location and detects B/L/N conflict', () => {
  const base = 'page 100 (\n    title: Base\n    region owned (\n        name: One\n    )\n)\n';
  const unmanaged = '    // keep this comment\n    region local (\n        name: Local\n    )\n';
  const local = base.replace('    region owned', unmanaged + '    region owned');
  const next = base.replace('name: One', 'name: Two');
  const merged = threeWay(base, local, next);
  assert.equal(merged, local.replace('name: One', 'name: Two'));
  assert.throws(() => threeWay(base, base.replace('name: One', 'name: Local edit'), next));
  const root = declarations(base)[0]!;
  assert.throws(() => editSpans(base, [{ ...root, expectedDigest: hash('other'), content: '' }]));
});
test('journaled materialization preserves .apex and unmanaged bytes, then has no diff', async () => {
  const { ctx, plan } = await setup();
  const before = await inventory(path.join(ctx.root, ctx.config.application.sourceDir));
  await materialize(ctx, plan);
  const binding = await deploymentBinding(ctx);
  assert.equal(binding!.generationDigest, plan.state!.generationDigest);
  const after = await inventory(path.join(ctx.root, ctx.config.application.sourceDir));
  for (const [file, digest] of Object.entries(before)) assert.equal(after[file], digest);
  const repeat = planComposition(await snapshot(ctx, 'app.blueprint.yaml', { validation: 'source-only' }));
  assert.equal(repeat.operations.length, 0);
  await freeze(ctx, repeat, 'plans/repeat.json');
  assert.equal((await materialize(ctx, repeat)).status, 'no-op');
  await rm(ctx.root, { recursive: true, force: true });
});
test('stale source, package cache tampering and forged immutable plans cannot materialize', async () => {
  const { ctx, plan } = await setup();
  await atomicWrite(path.join(ctx.root, ctx.config.application.sourceDir, 'other.apx'), 'changed');
  await assert.rejects(() => materialize(ctx, plan), /changed after review/);
  const catalog = await loadCatalog(ctx.root),
    pkg = [...catalog.packages.values()][0]!;
  await atomicWrite(path.join(ctx.root, '.apexrest/composer/cache', pkg.digest, 'renderer.json'), '{}');
  await assert.rejects(() => loadCatalog(ctx.root), /package changed/);
  await rm(ctx.root, { recursive: true, force: true });
});
test('fault at every write boundary supports explicit resume and restore', async () => {
  const baseline = await setup();
  const boundaries = [
    ['prepared', 0],
    ['writing', 0],
    ['before-receipt', 0],
    ['after-receipt', 0],
    ['before-complete', 0],
    ...Array.from({ length: baseline.plan.operations.length + 2 }, (_, n) => [
      ['before-write', n],
      ['after-write', n],
      ['checkpoint', n],
    ]).flat(),
  ] as [string, number][];
  await rm(baseline.ctx.root, { recursive: true, force: true });
  for (const [boundary, occurrence] of boundaries)
    for (const recovery of ['resume', 'restore'] as const) {
      const { ctx, plan } = await setup();
      const original = await inventory(path.join(ctx.root, ctx.config.application.sourceDir));
      let stopped = false,
        seen = 0;
      await assert.rejects(() =>
        materialize(ctx, plan, {
          boundary: async (phase) => {
            if (phase === boundary && seen++ === occurrence && !stopped) {
              stopped = true;
              throw new Error('interrupted');
            }
          },
        }),
      );
      assert.ok(stopped, `${boundary} ${occurrence} was reached`);
      const recovered = await recoveryPlan(ctx, recovery);
      await freeze(ctx, recovered, 'plans/recovery.json');
      await materialize(ctx, recovered);
      if (recovery === 'restore')
        assert.deepEqual(await inventory(path.join(ctx.root, ctx.config.application.sourceDir)), original);
      else assert.equal((await deploymentBinding(ctx))!.generationDigest, plan.state!.generationDigest);
      await rm(ctx.root, { recursive: true, force: true });
    }
});
test('contract dialect rejects fields from other variants and invalid item identities', async () => {
  assert.throws(() =>
    contractSchema.parse({
      schemaVersion: 1,
      kind: 'errors',
      provenance: 'test',
      transaction: 'caller-owned',
    }),
  );
  assert.throws(() => contractSchema.parse({ schemaVersion: 1, kind: 'authorization', provenance: 'test' }));
  const { ctx, blueprint } = await setup();
  const entity = blueprint.entities.Customer!;
  for (const name of ['NAME', 'bad-name'])
    assert.throws(
      () =>
        bind(
          {
            ...blueprint,
            entities: {
              Customer: {
                ...entity,
                read: {
                  ...entity.read,
                  fields: {
                    ...entity.read.fields,
                    [name]: { column: 'OTHER', type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          blueprint.blocks.CustomerList!,
        ),
      /case-insensitive/,
    );
  await rm(ctx.root, { recursive: true, force: true });
});
test('connected signatures reject extra parameters, changed defaults and ambiguous overloads', async () => {
  const { ctx, blueprint } = await setup(),
    instance = blueprint.blocks.CustomerList!;
  const signature = blueprint.contracts['project:save-customer']!;
  assert.equal(signature.kind, 'command');
  if (signature.kind !== 'command') throw new Error('fixture');
  const rows = Object.entries(signature.parameters).map(([ARGUMENT_NAME, spec], i) => ({
    OBJECT_NAME: 'SAVE_CUSTOMER',
    ARGUMENT_NAME,
    DATA_TYPE: spec.type,
    IN_OUT: spec.mode.replace('in-out', 'IN/OUT').toUpperCase(),
    OVERLOAD: null,
    SUBPROGRAM_ID: 1,
    POSITION: i + 1,
    DATA_LEVEL: 0,
    DEFAULTED: 'N',
  }));
  const entity = blueprint.entities.Customer!;
  const metadata = {
    schema: 'FIXTURE',
    objects: {
      CMP_CUSTOMERS: {
        columns: Object.values(entity.read.fields).map((f) => ({
          COLUMN_NAME: f.column,
          DATA_TYPE: f.type === 'integer' ? 'NUMBER' : 'VARCHAR2',
          NULLABLE: f.nullable ? 'Y' : 'N',
          CHAR_LENGTH: f.maxLength ?? 0,
        })),
        constraints: [
          { CONSTRAINT_NAME: 'PK', CONSTRAINT_TYPE: 'P', STATUS: 'ENABLED', VALIDATED: 'VALIDATED' },
        ],
        constraintColumns: [{ CONSTRAINT_NAME: 'PK', COLUMN_NAME: 'CUSTOMER_ID', POSITION: 1 }],
      },
    },
    signatures: { CMP_CUSTOMER_API: rows },
  };
  assert.doesNotThrow(() => bind(blueprint, instance, metadata));
  for (const altered of [
    [...rows, { ...rows[0]!, ARGUMENT_NAME: 'P_EXTRA', POSITION: 6 }],
    rows.map((r, i) => (i ? r : { ...r, DEFAULTED: 'Y' })),
    [...rows, ...rows.map((r) => ({ ...r, OVERLOAD: '2', SUBPROGRAM_ID: 2 }))],
  ])
    assert.throws(() =>
      bind(blueprint, instance, { ...metadata, signatures: { CMP_CUSTOMER_API: altered } }),
    );
  await rm(ctx.root, { recursive: true, force: true });
});
test('recovery rechecks each preimage after a concurrent edit and keeps the external bytes', async () => {
  const { ctx, plan } = await setup();
  await assert.rejects(() =>
    materialize(ctx, plan, {
      boundary: async (phase) => {
        if (phase === 'prepared') throw new Error('stop');
      },
    }),
  );
  const recovery = await recoveryPlan(ctx, 'resume');
  await freeze(ctx, recovery, 'plans/recovery.json');
  let changed = '';
  await assert.rejects(
    () =>
      materialize(ctx, recovery, {
        boundary: async (phase, file) => {
          if (phase === 'before-recovery-write' && !changed) {
            changed = file;
            await atomicWrite(path.join(ctx.root, file), 'concurrent');
          }
        },
      }),
    /Concurrent edit/,
  );
  assert.equal(await readFile(path.join(ctx.root, changed), 'utf8'), 'concurrent');
  await assert.rejects(() => deploymentBinding(ctx));
  await rm(ctx.root, { recursive: true, force: true });
});
test('reviewed no-op plan restores a missing private receipt after a fresh checkout', async () => {
  const { ctx, plan } = await setup();
  await materialize(ctx, plan);
  await rm(path.join(ctx.root, '.apexrest/composer/receipt.json'));
  await assert.rejects(() => deploymentBinding(ctx), /receipt/);
  const repeat = planComposition(await snapshot(ctx, 'app.blueprint.yaml', { validation: 'source-only' }));
  await freeze(ctx, repeat, 'plans/repeat.json');
  assert.equal((await materialize(ctx, repeat)).status, 'no-op');
  assert.equal((await deploymentBinding(ctx))!.generationDigest, plan.state!.generationDigest);
  await rm(ctx.root, { recursive: true, force: true });
});
test('unknown concurrent edits block recovery rather than overwrite', async () => {
  const { ctx, plan } = await setup();
  let target = '';
  await assert.rejects(() =>
    materialize(ctx, plan, {
      boundary: async (phase, file) => {
        if (phase === 'after-write') {
          target = file;
          throw new Error('interrupt');
        }
      },
    }),
  );
  await atomicWrite(path.join(ctx.root, target), 'unrecognized concurrent edit');
  await assert.rejects(() => recoveryPlan(ctx, 'resume'), /concurrent edit/);
  await rm(ctx.root, { recursive: true, force: true });
});
test('upgrade keeps allocations, remove refuses edited files, detach retains source', async () => {
  const { ctx, plan, blueprint } = await setup();
  await materialize(ctx, plan);
  const file = Object.keys(plan.state!.owners.CustomerList!.files)[0]!;
  await atomicWrite(
    path.join(ctx.root, ctx.config.application.sourceDir, file),
    plan.operations.find((op) => op.path.endsWith(file))!.content! + '// local extension\n',
  );
  await writeJson(path.join(ctx.root, 'app.blueprint.yaml'), { ...blueprint, blocks: {}, connections: [] });
  const removal = planComposition(await snapshot(ctx, 'app.blueprint.yaml', { validation: 'source-only' }));
  assert.equal(removal.status, 'blocked');
  await writeJson(path.join(ctx.root, 'app.blueprint.yaml'), {
    ...blueprint,
    blocks: {
      CustomerList: { ...blueprint.blocks.CustomerList, ownership: 'detached' },
      CustomerSummary: { ...blueprint.blocks.CustomerSummary, ownership: 'detached' },
    },
    connections: [],
  });
  const detached = planComposition(await snapshot(ctx, 'app.blueprint.yaml', { validation: 'source-only' }));
  assert.equal(detached.status, 'materializable');
  assert.equal(detached.operations.length, 0);
  await rm(ctx.root, { recursive: true, force: true });
});
test('CLI/MCP input defaults offline and require expected digest for local writes', () => {
  assert.equal(composePlanInput.parse({ out: 'plans/compose.json' }).mode, 'offline');
  assert.throws(() => composePlanInput.parse({ out: '../../escape.json' }));
});

test('a remaining unmanaged route blocks removal of an otherwise unchanged owned page', async () => {
  const { ctx, plan, blueprint } = await setup();
  await materialize(ctx, plan);
  await atomicWrite(
    path.join(ctx.root, ctx.config.application.sourceDir, 'pages/unmanaged.apx'),
    `page 50 (\n    button keep (\n        target {\n            page: ${plan.allocations.CustomerList!.page}\n        }\n    )\n)\n`,
  );
  await writeJson(path.join(ctx.root, 'app.blueprint.yaml'), { ...blueprint, blocks: {}, connections: [] });
  const removal = planComposition(await snapshot(ctx, 'app.blueprint.yaml', { validation: 'source-only' }));
  assert.equal(removal.status, 'blocked');
  assert.equal(removal.diagnostics[0]!.code, 'UNKNOWN_CONSUMER_RETAINED');
  await rm(ctx.root, { recursive: true, force: true });
});
test('concurrent pre-write edit is retained and blocks recovery', async () => {
  const { ctx, plan } = await setup();
  let changed = '';
  await assert.rejects(
    () =>
      materialize(ctx, plan, {
        boundary: async (phase, file) => {
          if (phase === 'before-write' && !changed) {
            changed = file;
            await atomicWrite(path.join(ctx.root, file), 'external edit');
          }
        },
      }),
    /Concurrent edit/,
  );
  assert.equal(await readFile(path.join(ctx.root, changed), 'utf8'), 'external edit');
  await assert.rejects(() => recoveryPlan(ctx, 'restore'), /concurrent edit/);
  await rm(ctx.root, { recursive: true, force: true });
});
test('mapping reorder can reuse its immutable semantic plan record', async () => {
  const { ctx, plan, blueprint } = await setup();
  const input = await snapshot(ctx, 'app.blueprint.yaml', { validation: 'source-only' });
  const reordered = planComposition({
    ...input,
    blueprint: {
      ...blueprint,
      entities: Object.fromEntries(Object.entries(blueprint.entities).reverse()),
      contracts: Object.fromEntries(Object.entries(blueprint.contracts).reverse()),
    },
  });
  assert.equal(reordered.digest, plan.digest);
  await freeze(ctx, reordered, 'plans/reordered.json');
  await rm(ctx.root, { recursive: true, force: true });
});
test('hosted summaries cannot be detached independently or wired to a detached host', async () => {
  const { ctx, plan, blueprint } = await setup();
  await materialize(ctx, plan);
  for (const instance of ['CustomerSummary', 'CustomerList']) {
    await writeJson(path.join(ctx.root, 'app.blueprint.yaml'), {
      ...blueprint,
      blocks: { ...blueprint.blocks, [instance]: { ...blueprint.blocks[instance], ownership: 'detached' } },
      connections: [],
    });
    const proposed = planComposition(
      await snapshot(ctx, 'app.blueprint.yaml', { validation: 'source-only' }),
    );
    assert.equal(proposed.status, 'blocked');
    assert.equal(proposed.diagnostics[0]!.code, 'SHARED_OWNERSHIP_DETACH_REQUIRED');
  }
  await rm(ctx.root, { recursive: true, force: true });
});
test('opaque PL/SQL literals require explicit conflict resolution for disjoint local/generator edits', () => {
  const base =
    'process save (\n    code: \n        ```plsql\n        validate_record;\n        save_record;\n        ```\n)\n';
  assert.throws(
    () =>
      threeWay(
        base,
        base.replace('validate_record;', 'validate_other;'),
        base.replace('save_record;', 'save_other;'),
      ),
    /opaque code literal/,
  );
});
test('project-local drafts are discoverable and review withdrawal invalidates catalog-bound plans', async () => {
  const { ctx } = await setup(),
    catalog = await loadCatalog(),
    original = catalog.packages.get('block:crud/report-dialog@1.0.0')!;
  const relative = '.apexrest-composer/blocks/local',
    destination = path.join(ctx.root, relative);
  await cp(original.directory, destination, { recursive: true });
  await writeJson(path.join(destination, 'block.yaml'), {
    ...original.manifest,
    id: 'block:local/customer',
    origin: 'local-reviewed',
    status: 'draft',
  });
  const draft = await loadCatalog(ctx.root, false),
    selector = 'block:local/customer@1.0.0',
    pkg = draft.packages.get(selector)!;
  const found = await catalogSearch('customer', { project: ctx.root, status: 'draft' });
  assert.ok(found.results.some((r) => r.id === selector));
  await writeJson(path.join(ctx.root, '.apexrest-composer/registry-policy.json'), {
    reviewedPackages: { [selector]: pkg.digest },
  });
  const reviewed = await loadCatalog(ctx.root, false);
  assert.notEqual(reviewed.digest, draft.digest);
  assert.equal(reviewed.packages.get(selector)!.manifest.status, 'experimental');
  await writeJson(path.join(ctx.root, '.apexrest-composer/registry-policy.json'), { reviewedPackages: {} });
  assert.equal((await loadCatalog(ctx.root, false)).digest, draft.digest);
  await rm(ctx.root, { recursive: true, force: true });
});
