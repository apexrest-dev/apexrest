import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, rm } from 'node:fs/promises';
import { observedWorkingCopy } from '../fixtures/observed-working-copy.ts';
import { atomicWrite, writeJson } from '../../packages/core/src/fs.ts';
import { blueprintSchema, planSchema } from '../../packages/core/src/composer/schemas.ts';
import { snapshot, planComposition } from '../../packages/core/src/composer/planner.ts';
import { semanticDigest } from '../../packages/core/src/composer/formats.ts';
import { freeze, materialize } from '../../packages/core/src/composer/materializer.ts';
import {
  composePlan,
  composePlanInput,
  verifyDeploymentPredicates,
} from '../../packages/core/src/composer/service.ts';
import { LocalDeploymentControl } from '../../packages/core/src/deployment-control.ts';
import type { DeployPlan } from '../../packages/core/src/deploy.ts';

const blueprintPath = 'app.blueprint.yaml';
const blueprint = async () =>
  blueprintSchema.parse(JSON.parse(await readFile('tests/fixtures/composer/crm.blueprint.yaml', 'utf8')));

async function workingCopy(t: { after: (cleanup: () => Promise<void>) => void }) {
  const previousHome = process.env.APEXREST_HOME;
  const f = await observedWorkingCopy();
  t.after(async () => {
    if (previousHome === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = previousHome;
    await rm(f.ctx.root, { recursive: true, force: true });
  });
  return f;
}

test('connected Composer uses verified nonprojected columns when rendering reports and hosted summaries', async (t) => {
  const { ctx, oracle } = await workingCopy(t);
  ctx.config.composer = { allowSourceOnly: true };
  const input = await blueprint();
  const read = input.contracts['project:customer-access'];
  const save = input.contracts['project:save-customer'];
  assert.ok(read?.kind === 'authorization' && save?.kind === 'command');
  delete read.predicateColumns;
  await writeJson(path.join(ctx.root, blueprintPath), input);
  const dictionary = [
    [
      'all_tab_columns',
      [
        ...Object.values(input.entities.Customer!.read.fields).map((field) => ({
          column_name: field.column,
          data_type: field.type === 'integer' ? 'NUMBER' : 'VARCHAR2',
          nullable: field.nullable ? 'Y' : 'N',
          char_length: field.maxLength ?? 0,
        })),
        { column_name: 'OWNER_NAME' },
      ],
    ],
    ['all_cons_columns', [{ constraint_name: 'PK', column_name: 'CUSTOMER_ID', position: 1 }]],
    [
      'all_constraints',
      [{ constraint_name: 'PK', constraint_type: 'P', status: 'ENABLED', validated: 'VALIDATED' }],
    ],
    [
      'all_arguments',
      Object.entries(save.parameters).map(([argument_name, spec], i) => ({
        object_name: 'SAVE_CUSTOMER',
        argument_name,
        data_type: spec.type,
        in_out: spec.mode.replace('in-out', 'IN/OUT').toUpperCase(),
        overload: null,
        subprogram_id: 1,
        position: i + 1,
        data_level: 0,
        defaulted: 'N',
      })),
    ],
  ] as const;
  const query = oracle.jsonQueryBatch.bind(oracle);
  const batches: number[] = [];
  oracle.jsonQueryBatch = async (queries, ...args) => {
    batches.push(queries.length - 1);
    const [identity] = await query(queries.slice(0, 1), ...args);
    return [
      identity!,
      ...queries.slice(1).map((entry) => {
        // all_cons_columns appears in the constraint-columns query only, so test it before all_constraints.
        const fixture = dictionary.find(([view]) => entry.sql.includes(` ${view} `));
        assert.ok(fixture, 'Composer reads only scoped Oracle dictionary views');
        return [...fixture[1]];
      }),
    ];
  };
  const result = await composePlan(
    ctx,
    composePlanInput.parse({
      blueprint: blueprintPath,
      out: 'plans/composer.json',
      mode: 'connected',
      env: 'dev',
      validation: 'source-only',
    }),
    oracle,
  );
  assert.equal(result.status, 'materializable', JSON.stringify(result.diagnostics));
  // One object (columns, constraints, constraint columns) and one package share one round trip.
  assert.deepEqual(batches, [4]);
  const plan = planSchema.parse(JSON.parse(await readFile(path.join(ctx.root, result.plan), 'utf8')));
  assert.equal(plan.allocations.CustomerList!.page, plan.allocations.CustomerSummary!.page);
  const home = plan.operations.find((operation) =>
    /pages\/p\d+-cmp_customerlist_\w+\.apx$/.test(operation.path),
  );
  assert.ok(typeof home?.content === 'string');
  assert.ok(home.content.includes('where (OWNER_NAME = :APP_USER)'));
  assert.match(home.content, /where \(OWNER_NAME = :APP_USER\) group by STATUS/);
  assert.ok(
    plan.operations.some((operation) => operation.content?.includes('CMP_CUSTOMER_API.SAVE_CUSTOMER(')),
  );
});

test('Composer applies migration history before checking actual columns, then refuses import on a missing column', async (t) => {
  const f = await workingCopy(t);
  const input = await blueprint();
  await writeJson(path.join(f.ctx.root, blueprintPath), input);
  const analyzed = planComposition(await snapshot(f.ctx, blueprintPath));
  assert.equal(analyzed.status, 'materializable', JSON.stringify(analyzed.diagnostics));
  await freeze(f.ctx, analyzed, 'plans/composer.json');
  await materialize(f.ctx, analyzed);
  const migration = '0001__test.sql';
  await atomicWrite(
    path.join(f.ctx.root, f.ctx.config.database.migrationsDir, migration),
    'create table FIXTURE_SETUP (ID number);\n',
  );

  const events: string[] = [];
  const session = f.oracle.session.bind(f.oracle);
  f.oracle.session = async (...args) => {
    const marker = args[0].match(/\bprompt (APEXREST_SCRIPT_COMPLETE_\w+)\s*$/)?.[1];
    if (!marker) return session(...args);
    events.push('migration');
    return {
      code: 0,
      stdout: marker,
      stderr: '',
      timedOut: false,
      cancelled: false,
      truncated: false,
      output: marker,
      work: f.ctx.root,
    };
  };
  let columnExists = false;
  let cancelOnRead: AbortController | undefined;
  const query = f.oracle.jsonQueryBatch.bind(f.oracle);
  f.oracle.jsonQueryBatch = async (queries, ...args) => {
    if (!queries.some((entry) => entry.sql.includes('all_tab_columns'))) return query(queries, ...args);
    events.push('columns');
    assert.equal(queries[1]!.bindings!.p_name, 'CMP_CUSTOMERS');
    assert.equal(queries[1]!.bindings!.p_owner, f.env.parsingSchema);
    assert.ok(args[1] instanceof AbortSignal);
    const [identity] = await query(queries.slice(0, 1), ...args);
    cancelOnRead?.abort();
    return [identity!, [{ column_name: columnExists ? 'OWNER_NAME' : 'CUSTOMER_ID' }]];
  };
  const plan = await f.service.plan(f.ctx, 'dev');
  assert.ok(plan.schemaVersion === 3 && plan.composer);
  assert.deepEqual(
    events,
    [],
    'offline generation and the initial deploy plan do not require existing columns',
  );
  const approve = (reviewed: DeployPlan) =>
    writeJson(path.join(process.env.APEXREST_HOME!, 'policy.json'), {
      schemaVersion: 1,
      grants: [
        {
          projectRoot: f.ctx.root,
          targetDigest: reviewed.targetDigest,
          planDigest: reviewed.digest,
          expiresAt: reviewed.expiresAt,
          operations: ['deploy'],
        },
      ],
    });
  await approve(plan);
  await assert.rejects(f.service.apply(f.ctx, plan), { code: 'CONTRACT_SQL_UNSAFE' });
  assert.deepEqual(events, ['migration', 'columns']);
  assert.ok(!f.calls.includes('import'));
  const control = new LocalDeploymentControl(f.env);
  assert.deepEqual(
    (await control.history()).map(({ version, status }) => [version, status]),
    [[migration, 'succeeded']],
  );
  assert.equal((await f.store.read())!.status, 'ready');
  assert.equal(await control.owner(), undefined);

  columnExists = true;
  const retry = await f.service.plan(f.ctx, 'dev');
  assert.ok(!retry.operations.some((operation) => operation.kind === 'migration'));
  await approve(retry);
  cancelOnRead = new AbortController();
  await assert.rejects(f.service.apply(f.ctx, retry, cancelOnRead.signal), { code: 'CANCELLED' });
  assert.ok(!f.calls.includes('import'));
  assert.equal((await f.store.read())!.status, 'ready');
  cancelOnRead = undefined;
  assert.equal((await f.service.apply(f.ctx, retry)).state, 'succeeded');
  assert.ok(f.calls.includes('import'));
  assert.deepEqual(events, ['migration', 'columns', 'columns', 'columns']);
  await assert.rejects(
    verifyDeploymentPredicates(
      f.ctx,
      { blueprintPath, blueprintDigest: semanticDigest({}) },
      f.env,
      f.connection,
      f.oracle,
    ),
    { code: 'COMPOSITION_DRIFT' },
  );
});
