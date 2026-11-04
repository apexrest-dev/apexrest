import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { validateApplication, validationSource } from '../../packages/core/src/ship.ts';
import type { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { mcpSchemas } from '../../packages/mcp/src/server.ts';

async function tree(t: import('node:test').TestContext) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-validate-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const write = async (file: string, content: string) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  };
  return { root, write };
}

const project = JSON.stringify({
  schemaVersion: 1,
  projectId: 'validate-source',
  application: { sourceDir: 'app', alias: 'demo' },
  database: { migrationsDir: 'db/migrations', packagesDir: 'db/packages' },
  toolchain: { lockFile: 'toolchain.json' },
  environments: {},
  artifacts: { directory: '.apexrest/artifacts', retentionDays: 7 },
});

test('validation source: own metadata first, then the nearest project application', async (t) => {
  const { root, write } = await tree(t);
  await write('apexrest.json', project);
  await write('toolchain.json', '{"version":"fixture"}');
  await write('app/application.apx', 'application demo\n');
  await write('app/.apex/apexlang.json', '{"mmdVersion":"26.1.0+1"}');
  await write('variants/b/application.apx', 'application demo\n');
  await write('own/application.apx', 'application demo\n');
  await write('own/.apex/apexlang.json', '{"mmdVersion":"26.1.0+2"}');

  // Without sourceDir the project application is used, as before.
  assert.equal((await validationSource(root, {})).source, path.join(root, 'app'));
  assert.deepEqual(await validationSource(root, { sourceDir: 'own' }), {
    source: path.join(root, 'own'),
    metadata: { origin: 'source', file: path.join(root, 'own', '.apex', 'apexlang.json') },
  });
  // A tree without its own metadata borrows the enclosing project's (walking up from the folder).
  const borrowed = await validationSource(path.join(root, 'variants'), { sourceDir: 'b' });
  assert.deepEqual(borrowed.metadata, {
    origin: 'project',
    file: path.join(root, 'app', '.apex', 'apexlang.json'),
  });

  // The borrowed file is handed to the compiler for the staged copy only.
  const calls: unknown[] = [];
  const oracle = {
    async validate(source: string, _signal?: AbortSignal, options?: unknown) {
      calls.push([source, options]);
      return { status: 'passed', compiler: {}, mmd: {}, sourceDigest: 'x', output: 'ok' };
    },
  } as unknown as OracleAdapter;
  const result = (await validateApplication(oracle, borrowed, () => [])) as { metadata?: unknown };
  assert.deepEqual(calls, [
    [path.join(root, 'variants', 'b'), { metadataFile: path.join(root, 'app', '.apex', 'apexlang.json') }],
  ]);
  assert.deepEqual(result.metadata, borrowed.metadata);
});

test('validation source: unknown metadata and missing application.apx fail clearly', async (t) => {
  const { root, write } = await tree(t);
  await write('loose/application.apx', 'application demo\n');
  await assert.rejects(validationSource(root, { sourceDir: 'loose' }), {
    code: 'MMD_METADATA_REQUIRED',
    message: /no Oracle-generated \.apex\/apexlang\.json and no enclosing APEXREST project/,
  });
  await assert.rejects(validationSource(root, { sourceDir: 'absent' }), {
    code: 'VALIDATION_SOURCE_MISSING',
  });
});

test('the MCP validate tool accepts an absolute sourceDir instead of a project', () => {
  const schema = mcpSchemas.get('apex.validate')!;
  const absolute = path.resolve(tmpdir(), 'app');
  assert.equal(schema.safeParse({ sourceDir: absolute }).success, true);
  assert.equal(schema.safeParse({ project: absolute, sourceDir: absolute }).success, true);
  assert.equal(schema.safeParse({}).success, false, 'project or sourceDir is required');
  assert.equal(schema.safeParse({ sourceDir: 'relative/app' }).success, false);
});
