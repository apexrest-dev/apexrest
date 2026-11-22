import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { inventory, PREVIEW_STATE_DIR } from '../../packages/core/src/fs.ts';
import { DeploymentService, sourceInventory } from '../../packages/core/src/deploy.ts';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { privateCopy } from '../../packages/core/src/sync.ts';
import type { ProcessResult } from '../../packages/core/src/process.ts';
import { takeSearchBarSlot } from '../../packages/core/src/preview/extensions/reports/shared.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { fixture } from '../fixtures/project.ts';
import { workspace } from '../fixtures/preview.ts';

const completed = (stdout: string): ProcessResult => ({
  code: 0,
  stdout,
  stderr: '',
  timedOut: false,
  cancelled: false,
  truncated: false,
});

async function application() {
  const app = path.join(await mkdtemp(path.join(tmpdir(), 'apexrest-preview-state-')), 'app');
  await mkdir(path.join(app, '.apex'), { recursive: true });
  await mkdir(path.join(app, PREVIEW_STATE_DIR), { recursive: true });
  await writeFile(path.join(app, '.apex/apexlang.json'), '{"mmdVersion":"fixture"}');
  await writeFile(path.join(app, 'application.apx'), 'application 1 (\n    name: Fixture\n)\n');
  await writeFile(path.join(app, PREVIEW_STATE_DIR, '01-seed.sql'), 'create table t (id number);');
  await writeFile(path.join(app, PREVIEW_STATE_DIR, 'preview.sqlite'), 'state 1');
  return app;
}

test('source inventories skip only the root-level preview state directory', async () => {
  const app = await application();
  await mkdir(path.join(app, 'pages', PREVIEW_STATE_DIR), { recursive: true });
  await writeFile(path.join(app, 'pages', PREVIEW_STATE_DIR, 'kept.apx'), 'nested is source');
  assert.deepEqual(Object.keys(await inventory(app)), [
    '.apex/apexlang.json',
    'application.apx',
    'pages/.apex-local/kept.apx',
  ]);
});

test('a symlinked preview state directory is still rejected', async () => {
  const app = await application();
  const other = await mkdtemp(path.join(tmpdir(), 'apexrest-preview-link-'));
  await rm(path.join(app, PREVIEW_STATE_DIR), { recursive: true });
  await symlink(other, path.join(app, PREVIEW_STATE_DIR));
  await assert.rejects(inventory(app), (error: { code?: string }) => error.code === 'SYMLINK_NOT_ALLOWED');
});

test('private copies leave preview state behind', async () => {
  const app = await application();
  const copy = path.join(await mkdtemp(path.join(tmpdir(), 'apexrest-preview-copy-')), 'application');
  await privateCopy(app, copy);
  assert.deepEqual((await readdir(copy)).sort(), ['.apex', 'application.apx']);
});

test('validate ignores a preview database written during compilation and never stages it', async () => {
  const app = await application();
  const root = path.dirname(app);
  const staged: string[][] = [];
  const oracle = new OracleAdapter(async (request) => {
    if (request.args[0] === '-version') return completed('SQLcl: fixture');
    if (request.input?.includes('help apex')) return completed('apex generate export validate import');
    const input = /-input ["']?([^"'\s]+)/u.exec(request.input ?? '')?.[1];
    if (input) staged.push((await readdir(input)).sort());
    // A running preview server persists a click while the compiler runs.
    await writeFile(path.join(app, PREVIEW_STATE_DIR, 'preview.sqlite'), 'state 2');
    return completed('Validation completed successfully');
  });
  await mkdir(path.join(root, 'sqlcl/bin'), { recursive: true });
  await mkdir(path.join(root, 'sqlcl/lib'), { recursive: true });
  await writeFile(path.join(root, 'sqlcl/bin/sql'), 'fixture launcher, never executable');
  oracle.stage = () => mkdtemp(path.join(root, 'stage-'));
  oracle.settings = async () => ({
    schemaVersion: 1,
    mode: 'cli',
    mcpRestrictLevel: '4',
    executable: path.join(root, 'sqlcl/bin/sql'),
    javaHome: undefined,
  });
  const result = await oracle.validate(app);
  assert.equal(result.status, 'passed');
  assert.deepEqual(staged, [['.apex', 'application.apx']]);
});

test('preview state does not enter plan source digests or trip plan drift checks', async () => {
  const { ctx, plan } = await fixture();
  const before = await sourceInventory(ctx);
  const state = path.join(ctx.root, ctx.config.application.sourceDir, PREVIEW_STATE_DIR);
  await mkdir(state, { recursive: true });
  await writeFile(path.join(state, 'preview.sqlite'), 'state 1');
  await writeFile(path.join(state, '01-seed.sql'), 'select 1 from dual;');
  assert.deepEqual(await sourceInventory(ctx), before);
  await new DeploymentService().checkLocal(ctx, plan);
  await writeFile(path.join(state, 'preview.sqlite'), 'state 2');
  assert.deepEqual(await sourceInventory(ctx), before);
  await new DeploymentService().checkLocal(ctx, plan);
});

test('legacy RIGHT_OF_IR_SEARCH_BAR buttons render with the canonical slot', () => {
  const slots: Record<string, string> = {
    RIGHT_OF_INTERACTIVE_REPORT_SEARCH_BAR: '<a>canonical</a>',
    RIGHT_OF_IR_SEARCH_BAR: '<a>legacy</a>',
    BODY: 'kept',
  };
  assert.equal(takeSearchBarSlot(slots), '<a>canonical</a><a>legacy</a>');
  assert.deepEqual(slots, { BODY: 'kept' });
});

test('preview renders a Create button placed in the legacy IR search bar slot', async (t) => {
  const { app, assets } = await workspace(t, {
    'pages/p00003-customers.apx': `page 3 (
    name: Customers
    alias: CUSTOMERS

    region customers (
        name: Customers
        type: interactiveReport
        source {
            location: localDatabase
            tableName: CUSTOMERS
        }
        layout {
            sequence: 10
        }
    )

    button create-customer (
        buttonName: CREATE_CUSTOMER
        label: Create Customer
        layout {
            sequence: 10
            region: @customers
            slot: RIGHT_OF_IR_SEARCH_BAR
        }
    )
)
`,
    '.apex-local/01-customers.sql': 'create table customers (id number primary key, name varchar2(50));',
  });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const html = await (await fetch(`${server.url}/r/demo/customers`)).text();
  assert.match(html, /a-IRR-buttons[^]*Create Customer/u);
});
