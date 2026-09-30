import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, symlink, readFile, readdir } from 'node:fs/promises';
import { fixture } from '../fixtures/project.ts';
import {
  parse,
  projectSchema,
  environment,
  loadProject,
  requireTrust,
} from '../../packages/core/src/config.ts';
import {
  canonical,
  hash,
  hashFile,
  contained,
  atomicWrite,
  writeJson,
  withLock,
  inventory,
} from '../../packages/core/src/fs.ts';
import { redact, Fault, failure } from '../../packages/core/src/result.ts';
import { sqlclToken, sqlLiteral, oracleDiagnostics, installSources } from '../../packages/core/src/oracle.ts';
import {
  DeploymentService,
  planDigest,
  assertTransition,
  migrationRisk,
  authorizePlan,
} from '../../packages/core/src/deploy.ts';
import { qualityGate, parseJUnit, allowedOrigin } from '../../packages/core/src/testing.ts';
import { ArtifactService } from '../../packages/core/src/artifacts.ts';
import { schemas, toolCatalog } from '../../packages/core/src/operations.ts';
import { dispatch } from '../../packages/core/src/service.ts';
import { runProcess } from '../../packages/core/src/process.ts';
const rejectCode = (code: string) => (e: unknown) => e instanceof Fault && e.code === code;
test('strict project schema rejects unknown fields and secret fields', async () => {
  const { ctx } = await fixture();
  for (const key of ['password', 'approved', 'environment'])
    assert.throws(() => parse(projectSchema, { ...ctx.config, [key]: 'bad' }), rejectCode('INVALID_INPUT'));
  assert.equal((await loadProject(ctx.root)).config.projectId, 'fixture');
});
test('environment must be explicit and exact', async () => {
  const { ctx } = await fixture();
  assert.throws(() => environment(ctx), rejectCode('ENVIRONMENT_REQUIRED'));
  assert.throws(() => environment(ctx, 'prd'), rejectCode('UNKNOWN_ENVIRONMENT'));
  assert.equal(environment(ctx, 'dev').applicationId, 123);
});
test('hashing is independent of object key order but binds content', () => {
  assert.equal(hash(canonical({ b: 2, a: 1 })), hash(canonical({ a: 1, b: 2 })));
  assert.notEqual(hash('a'), hash('b'));
});
test('streamed atomic writes preserve the old file on failure and hash all bytes on success', async () => {
  const { ctx } = await fixture();
  const file = path.join(ctx.root, 'atomic-stream.txt');
  await atomicWrite(file, 'original');
  const before = await readdir(ctx.root);
  await assert.rejects(
    atomicWrite(
      file,
      (async function* () {
        yield Buffer.from('partial');
        throw new Error('fixture stream failed');
      })(),
    ),
    /fixture stream failed/,
  );
  assert.equal(await readFile(file, 'utf8'), 'original');
  assert.deepEqual(await readdir(ctx.root), before);
  const chunks = [Buffer.alloc(65537, 0), Buffer.from('café'), Buffer.alloc(131073, 255)];
  await atomicWrite(
    file,
    (async function* () {
      yield* chunks;
    })(),
  );
  assert.equal(await hashFile(file), hash(Buffer.concat(chunks)));
  await atomicWrite(file, '');
  assert.equal(await hashFile(file), hash(''));
});
test('contained path rejects traversal, absolute escapes and symlink escapes', async () => {
  const { ctx } = await fixture();
  await assert.rejects(contained(ctx.root, '../escape'), rejectCode('PATH_ESCAPE'));
  const outside = path.dirname(ctx.root);
  await assert.rejects(contained(ctx.root, outside), rejectCode('PATH_ESCAPE'));
  // Use an existing target on every runner. Windows junctions do not require
  // developer mode or the privilege needed to create symbolic links.
  await symlink(outside, path.join(ctx.root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(contained(ctx.root, 'escape/file'), rejectCode('SYMLINK_ESCAPE'));
  await assert.rejects(inventory(ctx.root), rejectCode('SYMLINK_NOT_ALLOWED'));
});
test('sources are copied without overwriting human edits', async () => {
  const { ctx } = await fixture();
  await assert.rejects(
    installSources(path.join(ctx.root, 'src/apex/app'), ctx.root, 'src/apex/app'),
    rejectCode('LOCAL_EDITS_CONFLICT'),
  );
  const r = await installSources(path.join(ctx.root, 'src/apex/app'), ctx.root, 'adopted');
  assert.ok(r.files['.apex/apexlang.json']);
});
test('SQLcl tokens reject newline, substitution and quote injection', () => {
  for (const input of ['foo\nconnect attacker', 'name" -force', '&secret', 'x\rhost bad'])
    assert.throws(() => sqlclToken(input), rejectCode('INVALID_SQLCL_TOKEN'));
  assert.equal(sqlclToken('a path/café'), '"a path/café"');
  assert.equal(sqlLiteral("O'Reilly"), "'O''Reilly'");
});
for (const [name, stdout, code, expected] of [
  ['ORA-01017', 'ORA-01017 invalid username', 0, 'AUTHENTICATION_FAILED'],
  ['privilege', 'ORA-01031 insufficient privileges', 0, 'DB_PRIVILEGE'],
  ['command exit zero', 'Unknown command: apex build', 0, 'ORACLE_COMMAND_FAILED'],
  ['compiler', 'APEXLang Compile Errors:\nError: Missing property', 0, 'ORACLE_COMMAND_FAILED'],
  ['PLSQL', 'PLS-00201 identifier missing', 0, 'ORACLE_COMMAND_FAILED'],
  ['process', '', 1, 'ORACLE_COMMAND_FAILED'],
] as const)
  test(`Oracle parser: ${name}`, () =>
    assert.throws(
      () =>
        oracleDiagnostics({ stdout, stderr: '', code, timedOut: false, cancelled: false, truncated: false }),
      rejectCode(expected),
    ));
test('interrupted mutation has unknown outcome', () => {
  assert.throws(
    () =>
      oracleDiagnostics(
        { stdout: '', stderr: '', code: null, timedOut: true, cancelled: false, truncated: false },
        true,
      ),
    (e: unknown) => e instanceof Fault && e.status === 'outcome_unknown' && e.exitCode === 6,
  );
});
test('redacts URI passwords, authorization, cookies and tokens', () => {
  const r = redact(
    'https://user:secret@example.test password=pass\nAuthorization: Bearer abcd\ncookie: session=sensitive\ntoken=api-key',
  );
  for (const secret of ['user:secret', 'pass\n', 'abcd', 'sensitive', 'api-key'])
    assert.ok(!r.includes(secret));
});
test('redaction precedes failure response', () =>
  assert.ok(!JSON.stringify(failure('test', new Error('password=supersecret'))).includes('supersecret')));
test('plan detects source mutation before any Oracle call', async () => {
  const { ctx, plan } = await fixture();
  await new DeploymentService().checkLocal(ctx, plan);
  await atomicWrite(path.join(ctx.root, 'src/apex/app/application.apx'), 'changed');
  await assert.rejects(new DeploymentService().checkLocal(ctx, plan), rejectCode('SOURCE_DRIFT'));
});
test('plan detects tampering, environment remap, expiry and config drift', async () => {
  const { ctx, plan } = await fixture();
  await assert.rejects(
    new DeploymentService().checkLocal(ctx, { ...plan, compiler: 'changed' }),
    rejectCode('PLAN_TAMPERED'),
  );
  const expired = { ...plan, expiresAt: '2020-01-01T00:00:00.000Z' };
  expired.digest = planDigest(expired);
  await assert.rejects(new DeploymentService().checkLocal(ctx, expired), rejectCode('PLAN_EXPIRED'));
  ctx.config.environments.dev!.applicationId = 999;
  await assert.rejects(new DeploymentService().checkLocal(ctx, plan), rejectCode('PLAN_TARGET_MISMATCH'));
});
test('approved=true is not authorization and is rejected at schema boundary', () => {
  assert.throws(
    () => parse(schemas['deploy.apply'], { plan: 'plan.json', approved: true }),
    rejectCode('INVALID_INPUT'),
  );
});
test('no source-defined trust or production approval', async () => {
  const { ctx, plan } = await fixture();
  process.env.APEXREST_HOME = path.join(ctx.root, 'home');
  await assert.rejects(requireTrust(ctx.root), rejectCode('PROJECT_TRUST_REQUIRED'));
  await writeJson(path.join(process.env.APEXREST_HOME, 'policy.json'), {
    schemaVersion: 1,
    trustedProjects: [ctx.root],
    grants: [],
  });
  const original = process.env.CI;
  delete process.env.CI;
  await assert.rejects(
    authorizePlan(ctx, plan, { ...ctx.config.environments.dev!, kind: 'production' }),
    rejectCode('PRODUCTION_CI_REQUIRED'),
  );
  if (original) process.env.CI = original;
  delete process.env.APEXREST_HOME;
});
test('deploy state machine rejects success before required steps', () => {
  assert.throws(() => assertTransition('importing', 'succeeded'));
  assertTransition('importing', 'verifying');
  assertTransition('importing', 'outcome_unknown');
});
test('migration policy flags destructive or privileged changes', () => {
  assert.deepEqual(migrationRisk('create table t(id number)'), []);
  assert.ok(migrationRisk('truncate table t').length);
  assert.ok(migrationRisk('grant dba to app').length);
});
test('empty, skipped, absent and blocked required tests never pass quality gate', () => {
  for (const status of ['empty', 'not_configured', 'blocked', 'dependency_missing'] as const)
    assert.equal(qualityGate([{ suite: 'sql', status, tests: 0, failures: 0, skipped: 0 }], ['sql']), false);
  assert.equal(qualityGate([], ['e2e']), false);
  assert.equal(
    qualityGate([{ suite: 'sql', status: 'passed', tests: 2, failures: 0, skipped: 1 }], ['sql']),
    false,
  );
  assert.equal(
    qualityGate([{ suite: 'sql', status: 'passed', tests: 2, failures: 0, skipped: 0 }], ['sql']),
    true,
  );
});
test('JUnit counts actual testcases and failure/skipped nodes', () => {
  assert.deepEqual(
    parseJUnit(
      '<testsuite><testcase name="a"/><testcase name="b"><failure/></testcase><testcase name="c"><skipped/></testcase></testsuite>',
    ),
    { tests: 3, failures: 1, skipped: 1 },
  );
  assert.throws(() => parseJUnit('<!DOCTYPE x><testcase/>'));
});
test('HTTP origin policy blocks credential URLs, invalid targets, plaintext and redirects', () => {
  for (const url of [
    'https://user:pass@example.test',
    'https://example.invalid',
    'http://remote.test',
    'https://evil.test',
  ])
    assert.throws(() => allowedOrigin(url, ['https://example.test']), rejectCode('ORIGIN_DENIED'));
  assert.equal(allowedOrigin('https://example.test/path', ['https://example.test']).hostname, 'example.test');
});
test('artifact IDs cannot read arbitrary paths and content is sanitized', async () => {
  const { ctx } = await fixture();
  const service = new ArtifactService(ctx);
  const id = await service.save('password=hidden\nhello', 'compiler');
  const r = await service.read(id, 0, 40);
  assert.ok(!r.content.includes('hidden'));
  await assert.rejects(service.read('../../etc/passwd'), rejectCode('INVALID_INPUT'));
  await assert.rejects(service.read(id, 0, 20000), rejectCode('INVALID_INPUT'));
});
test('filesystem lock excludes concurrent setup and releases on error', async () => {
  const { ctx } = await fixture();
  const lock = path.join(ctx.root, 'lock');
  await withLock(lock, async () =>
    assert.rejects(
      withLock(lock, async () => 0),
      rejectCode('LOCKED'),
    ),
  );
  await assert.rejects(
    withLock(lock, async () => {
      throw new Error('interrupted');
    }),
  );
  assert.equal(await withLock(lock, async () => 42), 42);
});
test('catalog stays bounded with strict schemas and no generic execution tool', () => {
  assert.equal(toolCatalog.length, 21);
  assert.ok(toolCatalog.every((t) => !/(shell|any_sql|any_file)/.test(t.name)));
  assert.equal(toolCatalog.find((t) => t.operation === 'test.run')!.readOnly, false);
});
test('CLI/shared service fails invalid commands with stable exit codes', async () => {
  assert.equal((await dispatch('not-a-command')).exitCode, 2);
  assert.equal((await dispatch('docs.search', { query: 'validate', password: 'bad' })).exitCode, 2);
});
test('process adapter enforces timeout without shell interpolation', async () => {
  const { ctx } = await fixture();
  const r = await runProcess({
    executable: process.execPath,
    args: ['-e', 'setTimeout(()=>{},10000)'],
    cwd: ctx.root,
    timeoutMs: 40,
  });
  assert.equal(r.timedOut, true);
  const arg = '$(echo secret)';
  const echo = await runProcess({
    executable: process.execPath,
    args: ['-e', 'console.log(process.argv[1])', arg],
    cwd: ctx.root,
  });
  assert.equal(echo.stdout.trim(), arg);
});
