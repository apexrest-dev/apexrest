import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { rm, readFile } from 'node:fs/promises';
import { fixture } from '../fixtures/project.ts';
import { atomicWrite, canonical, inventory, writeJson } from '../../packages/core/src/fs.ts';
import { scaffold, scaffoldSchema } from '../../packages/core/src/scaffold.ts';
import { scaffoldObservationsSql } from '../../packages/core/src/scaffold-observations.ts';
import { parseApexLang, get } from '../../packages/core/src/preview/apexlang.ts';
import { schemas } from '../../packages/core/src/operations.ts';

const spec = {
  applicationName: 'Catalog Monitor',
  pages: [
    {
      id: 1,
      name: 'Home',
      regions: [
        {
          type: 'cards',
          name: 'Totals',
          sql: "select 'Products' label, to_char(count(*)) value from products",
          titleColumn: 'LABEL',
          bodyColumn: 'VALUE',
        },
        {
          type: 'barChart',
          name: 'States',
          sql: 'select state label, count(*) value from products group by state',
          labelColumn: 'LABEL',
          valueColumn: 'VALUE',
          xTitle: 'State',
          yTitle: 'Products',
        },
      ],
    },
    {
      id: 10,
      name: 'Products',
      regions: [
        {
          type: 'interactiveReport',
          name: 'Products',
          sql: 'select name, weight from products',
          columns: [
            { name: 'NAME', heading: 'Name', dataType: 'varchar2' },
            { name: 'WEIGHT', heading: 'Weight (kg)', dataType: 'number', formatMask: 'FM990D000' },
          ],
        },
      ],
    },
  ],
};
async function prepared(t: import('node:test').TestContext) {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const root = path.join(ctx.root, ctx.config.application.sourceDir);
  await writeJson(path.join(root, '.apex/apexlang.json'), { mmdVersion: '26.2.0+3479' });
  await atomicWrite(
    path.join(root, 'application.apx'),
    'app FIXTURE (\n    name: Fixture\n    security {\n        secretField: preserve\n    }\n)\n',
  );
  await atomicWrite(
    path.join(root, 'pages/p00001-home.apx'),
    'page 1 (\n    name: Home\n    alias: HOME\n    security {\n        pageAccessProtection: argumentsMustHaveChecksum\n    }\n    region app-name (\n        name: Home\n        type: staticContent\n    )\n)\n',
  );
  await atomicWrite(
    path.join(root, 'shared-components/lists/navigation-menu.apx'),
    'list navigation-menu (\n    name: Navigation Menu\n    entry home (\n        label: Home\n        link {\n            target: {\n                page: 1\n            }\n        }\n    )\n)\n',
  );
  await atomicWrite(path.join(root, 'shared-components/authentications.apx'), 'private auth fixture');
  await writeJson(path.join(ctx.root, 'spec.json'), spec);
  return { ctx, root };
}

test('one spec creates native reports/cards/bar chart, preserves security/IDs, and repeats without duplicate navigation', async (t) => {
  const { ctx, root } = await prepared(t);
  const before = await inventory(root);
  const result = await scaffold(ctx, 'spec.json');
  assert.deepEqual(
    result.pages.map((p) => p.id),
    [1, 10],
  );
  assert.equal(result.compilerValidation, 'required-by-ship');
  assert.equal('readback' in result, false, 'ordinary scaffolding has no observation step');
  const home = await readFile(path.join(root, 'pages/p00001-home.apx'), 'utf8');
  const [page] = parseApexLang(home);
  assert.equal(get(page!.props, 'security.pageAccessProtection'), 'argumentsMustHaveChecksum');
  assert.equal(page!.props.alias, 'HOME');
  assert.deepEqual(
    page!.children.map((c) => c.props.type),
    ['staticContent', 'cards', 'chart'],
  );
  assert.equal(page!.children[2]!.children.filter((c) => c.type === 'axis').length, 2);
  const after = await inventory(root);
  for (const name of ['.apex/apexlang.json', 'shared-components/authentications.apx'])
    assert.equal(after[name], before[name]);
  assert.match(await readFile(path.join(root, 'application.apx'), 'utf8'), /secretField: preserve/);
  await scaffold(ctx, 'spec.json');
  assert.equal(canonical(await inventory(root)), canonical(after));
  const [nav] = parseApexLang(
    await readFile(path.join(root, 'shared-components/lists/navigation-menu.apx'), 'utf8'),
  );
  assert.equal(nav!.children.length, 2);
});

test('a manual edit to a generated page blocks all writes and retains the edit', async (t) => {
  const { ctx, root } = await prepared(t);
  await scaffold(ctx, 'spec.json');
  const file = path.join(root, 'pages/p00010-products.apx');
  await atomicWrite(file, (await readFile(file, 'utf8')) + '// human edit\n');
  const before = await inventory(root);
  await writeJson(path.join(ctx.root, 'spec.json'), { ...spec, applicationName: 'Changed' });
  await assert.rejects(scaffold(ctx, 'spec.json'), { code: 'LOCAL_EDITS_CONFLICT' });
  assert.deepEqual(await inventory(root), before);
});

test('an existing nonblank page is never overwritten, even after earlier spec pages were prepared', async (t) => {
  const { ctx, root } = await prepared(t);
  await atomicWrite(path.join(root, 'pages/p00010-owned.apx'), 'page 10 (\n    name: Human\n)\n');
  const before = await inventory(root);
  await assert.rejects(scaffold(ctx, 'spec.json'), { code: 'LOCAL_EDITS_CONFLICT' });
  assert.deepEqual(await inventory(root), before);
});

test('a 26.1 source refuses scaffolding without changing any source', async (t) => {
  const { ctx, root } = await prepared(t);
  await writeJson(path.join(root, '.apex/apexlang.json'), { mmdVersion: '26.1.0+3479' });
  const before = await inventory(root);
  await assert.rejects(scaffold(ctx, 'spec.json'), { code: 'SCAFFOLD_RELEASE_UNSUPPORTED' });
  assert.deepEqual(await inventory(root), before);
});

test('scaffold specs reject duplicate IDs, code-fence injection and invalid types before writing', async (t) => {
  const { ctx, root } = await prepared(t);
  const before = await inventory(root);
  for (const invalid of [
    { ...spec, pages: [spec.pages[0], spec.pages[0]] },
    {
      ...spec,
      pages: [
        {
          id: 10,
          name: 'Injected',
          regions: [
            {
              type: 'cards',
              name: 'Bad',
              sql: 'select 1 from dual\n```\n)\nprocess evil (',
              titleColumn: 'X',
              bodyColumn: 'Y',
            },
          ],
        },
      ],
    },
    { ...spec, pages: [{ id: 10, name: 'Invalid', regions: [{ type: 'form', sql: 'select 1 from dual' }] }] },
  ]) {
    await writeJson(path.join(ctx.root, 'spec.json'), invalid);
    await assert.rejects(scaffold(ctx, 'spec.json'), { code: 'INVALID_INPUT' });
    assert.deepEqual(await inventory(root), before);
  }
  assert.equal(scaffoldSchema.safeParse({ ...spec, unknown: true }).success, false);
});

test('short and long literal ship requests are accepted while whitespace and excessive input are refused', () => {
  for (const userRequest of ['test it', 'x'.repeat(3000)])
    assert.equal(schemas.ship.safeParse({ env: 'dev', userRequest }).success, true);
  for (const userRequest of ['  ', 'x'.repeat(16001)])
    assert.equal(schemas.ship.safeParse({ env: 'dev', userRequest }).success, false);
});

test('optional target-bound observations are generated privately without database access', async (t) => {
  const { ctx, root } = await prepared(t);
  const result = await scaffold(ctx, 'spec.json', 'dev');
  assert.equal(result.readback!.environment, 'dev');
  assert.match(result.readback!.sqlFile, /^\.apexrest[\\/]scaffolds[\\/]/);
  const sql = await readFile(path.join(ctx.root, result.readback!.sqlFile), 'utf8');
  assert.match(sql, /application_id=123/);
  assert.match(sql, /page_id in \(1,10\)/);
  assert.match(sql, /set transaction read only;/);
  assert.match(sql, /Observation target identity mismatch/);
  assert.doesNotMatch(sql, /__[A-Z_]+__/);
  assert.equal(
    Object.keys(await inventory(root)).some((f) => f.endsWith('observations.sql')),
    false,
  );
});

test('an unknown observation environment blocks before any sources change', async (t) => {
  const { ctx, root } = await prepared(t);
  const before = await inventory(root);
  await assert.rejects(scaffold(ctx, 'spec.json', 'DEV'), { code: 'UNKNOWN_ENVIRONMENT' });
  assert.deepEqual(await inventory(root), before);
});

test('observation bindings quote target literals and reject command-line breaks and implicit page scope', async (t) => {
  const { ctx } = await prepared(t);
  const env = ctx.config.environments.dev!;
  const sql = await scaffoldObservationsSql(
    { ...env, databaseIdentity: { ...env.databaseIdentity, serviceName: "service'xyz" } },
    [1],
  );
  assert.match(sql, /SERVICE_NAME'\) <> 'service''xyz'/);
  await assert.rejects(
    scaffoldObservationsSql(
      { ...env, databaseIdentity: { ...env.databaseIdentity, serviceName: 'service\nhost forbidden' } },
      [1],
    ),
    { code: 'INVALID_INPUT' },
  );
  await assert.rejects(scaffoldObservationsSql(env, []), { code: 'INVALID_INPUT' });
});
