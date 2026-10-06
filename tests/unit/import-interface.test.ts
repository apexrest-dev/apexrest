import test from 'node:test';
import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { schemas } from '../../packages/core/src/operations.ts';
import { projectSchema } from '../../packages/core/src/config.ts';
import {
  planPreview,
  shipPlan,
  fallbackCompilerDiagnostics,
  validateApplication,
} from '../../packages/core/src/ship.ts';
import type { OracleAdapter } from '../../packages/core/src/oracle.ts';
import type { DeployPlan, DeploymentPlanOptions } from '../../packages/core/src/deploy.ts';
import { mcpSchemas, listTools } from '../../packages/mcp/src/server.ts';
import { toolOutput } from '../../packages/mcp/src/output.ts';
import { success } from '../../packages/core/src/result.ts';
import { fixture } from '../fixtures/project.ts';
import { workingCopyFixture } from '../fixtures/working-copy.ts';

test('ship and deploy plan default to auto and require files only for explicit selection', () => {
  for (const [schema, base] of [
    [schemas.ship, { env: 'dev', userRequest: 'Deploy the selected application changes' }],
    [schemas['deploy.plan'], { env: 'dev', out: '.apexrest/plans/review.json' }],
  ] as const) {
    assert.equal(schema.parse(base).importMode, 'auto');
    const files = ['pages/p00010.apx', 'shared_components/lovs/status.apx'];
    assert.deepEqual(schema.parse({ ...base, importMode: 'files', files }).files, files);
    assert.equal(schema.parse({ ...base, importMode: 'full' }).importMode, 'full');
    for (const invalid of [
      { importMode: 'files' },
      { importMode: 'files', files: [] },
      { importMode: 'auto', files },
      { importMode: 'full', files },
      { files },
      { importMode: 'files', files: ['../outside.apx'] },
      { importMode: 'files', files: ['/outside.apx'] },
      { importMode: 'files', files: ['C:/outside.apx'] },
      { importMode: 'files', files: ['pages/*.apx'] },
      { importMode: 'files', files: ['./pages/p00010.apx'] },
      { importMode: 'files', files: ['pages/p00010.apx', 'pages/p00010.apx'] },
      { importMode: 'files', files: ['./pages/p00010.apx', 'pages/p00010.apx'] },
    ])
      assert.equal(schema.safeParse({ ...base, ...invalid }).success, false, JSON.stringify(invalid));
  }
});

test('MCP schema retains cross-field selection checks and the eleven-tool surface', () => {
  const schema = mcpSchemas.get('ship')!;
  const base = {
    project: '/private/tmp/project',
    env: 'dev',
    userRequest: 'Deploy the selected application changes',
  };
  assert.equal(schema.safeParse({ ...base, importMode: 'files' }).success, false);
  assert.equal(schema.safeParse({ ...base, importMode: 'full', files: ['pages/p00010.apx'] }).success, false);
  assert.equal(schema.safeParse({ ...base, importMode: 'files', files: ['pages/p00010.apx'] }).success, true);
  const tools = listTools();
  assert.equal(tools.length, 11);
  const ship = tools.find((tool) => tool.name === 'apexrest_ship')!;
  const properties = ship.inputSchema.properties as Record<string, Record<string, unknown>>;
  assert.equal(properties.importMode!.default, 'auto');
  assert.deepEqual(properties.importMode!.enum, ['auto', 'full', 'files']);
});

test('project profile is optional for legacy projects and accepts only the two supported releases', async (t) => {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const legacy = projectSchema.parse(ctx.config);
  assert.equal(
    Object.hasOwn(legacy.toolchain, 'profile'),
    false,
    'parsing must preserve legacy config digests',
  );
  for (const profile of ['26.1', '26.2'])
    assert.equal(
      projectSchema.parse({ ...ctx.config, toolchain: { ...ctx.config.toolchain, profile } }).toolchain
        .profile,
      profile,
    );
  assert.equal(
    projectSchema.safeParse({ ...ctx.config, toolchain: { ...ctx.config.toolchain, profile: '27.1' } })
      .success,
    false,
  );
});

test('ship forwards the requested import strategy and previews legacy plans as full', async (t) => {
  const f = await workingCopyFixture();
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  const original = f.service.plan.bind(f.service);
  let received: DeploymentPlanOptions | boolean | undefined;
  f.service.plan = async (ctx, env, options) => {
    received = options;
    return original(ctx, env, options);
  };
  const planned = await shipPlan(f.ctx, 'dev', f.service, fallbackCompilerDiagnostics, undefined, {
    importMode: 'full',
  });
  assert.deepEqual(received, { importMode: 'full' });
  assert.equal(planned.preview.importSelection.requestedMode, 'full');
  assert.equal(planned.preview.importSelection.resolvedMode, 'full');
  assert.equal(planned.preview.importSelection.fileCount, 0);
  assert.deepEqual(planPreview(f.ctx, planned.plan).importSelection.files, []);
});

test('plan preview exposes exact bounded selected paths and explains why a full import was selected', async (t) => {
  const f = await workingCopyFixture();
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  const legacy = await f.service.plan(f.ctx, 'dev', { importMode: 'full' });
  const files = Array.from({ length: 60 }, (_, index) => `pages/p${index.toString().padStart(5, '0')}.apx`);
  const selection = {
    requestedMode: 'auto',
    resolvedMode: 'files',
    files,
    reasons: [],
    dependencies: ['shared_components/lovs/status.apx'],
  };
  const plan = { ...legacy, schemaVersion: 4, importSelection: selection } as unknown as DeployPlan;
  const preview = planPreview(f.ctx, plan);
  assert.equal(preview.importSelection.resolvedMode, 'files');
  assert.equal(preview.importSelection.fileCount, 60);
  assert.deepEqual(preview.importSelection.files, files.slice(0, 50));
  assert.equal(preview.importSelection.filesTruncated, true);
  assert.deepEqual(preview.importSelection.dependencies, selection.dependencies);
  assert.equal(preview.importSelection.dependencyCount, 1);
  const full = planPreview(f.ctx, {
    ...plan,
    importSelection: {
      ...selection,
      resolvedMode: 'full',
      files: [],
      reasons: ['unsupported-component:themes/theme.apx'],
    },
  } as unknown as DeployPlan);
  assert.deepEqual(full.importSelection.reasons, ['unsupported-component:themes/theme.apx']);
});

test('reference read accepts an explicit version through both public interfaces', () => {
  assert.equal(schemas['docs.read'].parse({ id: 'oracle:26.2:intro', version: '26.2' }).version, '26.2');
  assert.equal(
    schemas.reference.parse({ mode: 'read', id: 'oracle:26.2:intro', version: '26.2' }).version,
    '26.2',
  );
});

test('compacted MCP results retain reviewed import scope and exact selected paths', async () => {
  const files = Array.from({ length: 60 }, (_, index) => `pages/p${index.toString().padStart(5, '0')}.apx`);
  const result = await toolOutput(
    success('ship', {
      status: 'planned',
      importSelection: { requestedMode: 'auto', resolvedMode: 'files', files, reasons: [] },
      fullDetails: 'x'.repeat(20000),
    }),
  );
  const data = JSON.parse(result.content[0]!.text).data;
  assert.equal(data.output.compacted, true);
  assert.equal(data.importSelection.resolvedMode, 'files');
  assert.equal(data.importSelection.fileCount, 60);
  assert.deepEqual(data.importSelection.files, files.slice(0, 10));
  assert.equal(data.importSelection.filesTruncated, true);
});

test('advisory analysis stays separate from successful compiler verification and handles unavailable scanners', async (t) => {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const source = path.join(ctx.root, ctx.config.application.sourceDir);
  await writeFile(path.join(source, 'application.apx'), 'tool_calls');
  const oracle = {
    async validate() {
      return { status: 'passed', output: 'Validation successful', compiler: { version: 'fixture' } };
    },
  } as unknown as OracleAdapter;
  const unavailable = await validateApplication(oracle, source, fallbackCompilerDiagnostics);
  assert.equal(unavailable.status, 'passed');
  assert.equal(unavailable.staticAnalysis.status, 'unavailable');
  assert.equal(unavailable.upgradeAudit.status, 'advisory');
  assert.ok(unavailable.upgradeAudit.findings.some((finding) => finding.code === 'APEX262_AI_TOOL_CALLS'));
  assert.equal(unavailable.warningCount, 0);
  assert.deepEqual(unavailable.diagnostics, []);
  oracle.codeScan = async () => ({
    status: 'advisory',
    findings: [
      {
        code: 'scanner-warning',
        file: 'application.apx',
        line: 1,
        message: 'Review this source',
        severity: 'warning',
      },
    ],
  });
  const advisory = await validateApplication(oracle, source, fallbackCompilerDiagnostics);
  assert.equal(advisory.staticAnalysis.findings.length, 1);
  assert.equal(advisory.warningCount, 0, 'advice must not become a compiler warning');
  oracle.codeScan = async () => {
    throw new Error('Scanner unavailable');
  };
  const failedScanner = await validateApplication(oracle, source, fallbackCompilerDiagnostics);
  assert.equal(failedScanner.status, 'passed');
  assert.equal(failedScanner.staticAnalysis.status, 'unavailable');
});
