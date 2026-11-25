import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../fixtures/project.ts';
import {
  expandRecipe,
  recipeRequestSchema,
  runRecipe,
  type RecipeRequest,
} from '../../packages/core/src/recipes.ts';
import { entityContractSchema } from '../../packages/core/src/entities.ts';

const CONTRACT = {
  schemaVersion: 1,
  id: 'customer',
  label: 'Customer',
  pluralLabel: 'Customers',
  read: { table: 'APEXREST_CUSTOMERS' },
  key: ['ID'],
  fields: {
    ID: { type: 'number', label: 'ID', required: true, readOnly: true },
    NAME: { type: 'varchar2', label: 'Name', required: true, maxLength: 200 },
    EMAIL: { type: 'varchar2', label: 'Email' },
    STATUS: {
      type: 'varchar2',
      label: 'Status',
      lov: {
        values: [
          { label: 'Active', value: 'ACTIVE' },
          { label: 'Inactive', value: 'INACTIVE' },
        ],
      },
    },
  },
  authorization: { read: { scheme: 'crm-reader' }, write: { scheme: 'crm-editor' } },
  write: { table: 'APEXREST_CUSTOMERS', operations: ['insert', 'update', 'delete'], lostUpdate: 'rowValues' },
};
const contract = entityContractSchema.parse(CONTRACT);
const reportForm = recipeRequestSchema.parse({
  recipe: 'report-form',
  entity: 'customer',
  pages: { report: 30, form: 31 },
});

test('report-form expands deterministically into a report and an editable modal form with explicit security', () => {
  const first = expandRecipe(reportForm, contract);
  assert.deepEqual(expandRecipe(reportForm, contract), first);
  const [report, form] = first.spec.pages as unknown as Record<string, any>[];
  assert.equal(report!.authorizationScheme, 'crm-reader');
  assert.equal(form!.authorizationScheme, 'crm-editor');
  assert.equal(form!.mode, 'modalDialog');
  const ir = report!.regions[0];
  assert.equal(ir.id, 'customer-report');
  assert.equal(ir.sql, 'select ID, NAME, EMAIL, STATUS from APEXREST_CUSTOMERS');
  assert.deepEqual(ir.columns[0].link, { page: 31, items: { P31_ID: '#ID#' }, clearCache: [31] });
  assert.equal(ir.refreshOnDialogClose, true);
  assert.equal(report!.buttons[0].id, 'create-customer');
  assert.deepEqual(form!.regions[0].edit, { operations: ['add', 'update', 'delete'] });
  assert.deepEqual(
    form!.items.map((item: { name: string; type: string }) => [item.name, item.type]),
    [
      ['P31_ID', 'hidden'],
      ['P31_NAME', 'textField'],
      ['P31_EMAIL', 'textField'],
      ['P31_STATUS', 'selectList'],
    ],
  );
  // Overrides choose columns and titles; the key column stays for the row link.
  const narrow = expandRecipe(
    recipeRequestSchema.parse({ ...reportForm, overrides: { columns: ['NAME'], reportTitle: 'Clients' } }),
    contract,
  );
  const [page] = narrow.spec.pages as unknown as Record<string, any>[];
  assert.equal(page!.name, 'Clients');
  assert.deepEqual(
    page!.regions[0].columns.map((c: { name: string }) => c.name),
    ['ID', 'NAME'],
  );
});

test('a read-only entity gets a read-only form, shared LOVs a follow-up warning, and the dashboard a working filter', () => {
  const readOnly = entityContractSchema.parse({
    ...CONTRACT,
    write: undefined,
    authorization: { read: { public: true } },
  });
  const { spec } = expandRecipe(reportForm, readOnly);
  const [report, form] = spec.pages as unknown as Record<string, any>[];
  assert.equal(report!.authorizationScheme, undefined);
  assert.equal(report!.buttons, undefined);
  assert.match(form!.regions[0].sql, /where ID = :P31_ID$/u);
  assert.ok(form!.items.every((item: { type: string }) => ['hidden', 'displayOnly'].includes(item.type)));
  const shared = entityContractSchema.parse({
    ...CONTRACT,
    fields: { ...CONTRACT.fields, STATUS: { type: 'varchar2', label: 'Status', lov: { shared: 'STATUS' } } },
  });
  assert.match(expandRecipe(reportForm, shared).warnings[0]!, /bindLov/u);
  const dashboard = expandRecipe(
    recipeRequestSchema.parse({ recipe: 'filtered-dashboard', entity: 'customer', pages: { dashboard: 40 } }),
    contract,
  ).spec.pages[0] as unknown as Record<string, any>;
  const [, cards, chart] = dashboard.regions;
  assert.deepEqual(cards.itemsToSubmit, ['P40_STATUS']);
  assert.match(cards.sql, /\(:P40_STATUS is null or STATUS = :P40_STATUS\)/u);
  assert.deepEqual(chart.series[0].itemsToSubmit, ['P40_STATUS']);
  assert.deepEqual(dashboard.refreshes, [
    { items: ['P40_STATUS'], regions: ['customer-cards', 'customer-chart'] },
  ]);
  assert.throws(
    () =>
      expandRecipe(
        recipeRequestSchema.parse({
          recipe: 'filtered-dashboard',
          entity: 'customer',
          pages: { dashboard: 40 },
        }),
        shared,
      ),
    { code: 'RECIPE_UNSUPPORTED' },
  );
});

test('unknown overrides, contract diagnostics and a changed contract are refused before any change', async (t) => {
  assert.equal(recipeRequestSchema.safeParse({ ...reportForm, overrides: { theme: 'dark' } }).success, false);
  assert.throws(
    () => expandRecipe({ ...reportForm, overrides: { columns: ['NOPE'] } } as RecipeRequest, contract),
    {
      code: 'RECIPE_FIELD_UNKNOWN',
    },
  );
  assert.throws(
    () => expandRecipe({ ...reportForm, pages: { report: 30, form: 30 } } as RecipeRequest, contract),
    {
      code: 'INVALID_INPUT',
    },
  );
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  await mkdir(path.join(ctx.root, 'entities'), { recursive: true });
  await writeFile(
    path.join(ctx.root, 'entities/customer.json'),
    JSON.stringify({ ...CONTRACT, key: ['EMAIL'] }),
  );
  await assert.rejects(runRecipe(ctx, { request: reportForm, dryRun: true }), { code: 'ENTITY_INVALID' });
  await writeFile(path.join(ctx.root, 'entities/customer.json'), JSON.stringify(CONTRACT));
  const dry = await runRecipe(ctx, { request: reportForm, dryRun: true });
  assert.equal(dry.written, false);
  assert.deepEqual(dry.spec, expandRecipe(reportForm, contract).spec);
  await assert.rejects(
    runRecipe(ctx, { request: { ...reportForm, entityDigest: 'a'.repeat(64) }, dryRun: true }),
    {
      code: 'TRANSFORM_CONFLICT',
    },
  );
});
