import test from 'node:test';
import { referenceRead } from '../../packages/core/src/references.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { workingCopyFixture } from '../fixtures/working-copy.ts';
import { fixture } from '../fixtures/project.ts';
import { inspectSql, executableSql } from '../../packages/core/src/sql-review.ts';
import { localConnectionEndpoint } from '../../packages/core/src/locality.ts';
import { policy, policySchema, environmentSchema } from '../../packages/core/src/config.ts';
import { authorizePlan, migrationRisk } from '../../packages/core/src/deploy.ts';
import {
  shipApply,
  shipGrant,
  shipPlan,
  checkShipTarget,
  fallbackCompilerDiagnostics,
} from '../../packages/core/src/ship.ts';
import { openVerificationBrowser } from '../../packages/core/src/browser.ts';
import { JobService, type JobExecutor } from '../../packages/core/src/jobs.ts';
import { parseLocalEnv, readLocalEnv } from '../../packages/core/src/local-env.ts';
import { runProcess } from '../../packages/core/src/process.ts';
import { atomicWrite, exists, writeJson } from '../../packages/core/src/fs.ts';
import { hostname } from 'node:os';
import { LocalDeploymentControl } from '../../packages/core/src/deployment-control.ts';
import { configureConnection } from '../../packages/core/src/connections.ts';
import type { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { success } from '../../packages/core/src/result.ts';

async function unlisted(t: import('node:test').TestContext) {
  const f = await workingCopyFixture();
  t.after(() => rm(f.ctx.root, { recursive: true, force: true }));
  await writeJson(path.join(process.env.APEXREST_HOME!, 'policy.json'), { schemaVersion: 1, grants: [] });
  return f;
}

test('fresh unlisted QA project plans, runs a local job, prepares browser URL and applies task-authorized import', async (t) => {
  const f = await unlisted(t);
  f.ctx.config.environments.dev!.kind = 'qa';
  f.ctx.config.environments.dev!.baseUrl = 'http://127.0.0.1:8080/ords/';
  const before = await policy();
  const planned = await shipPlan(f.ctx, 'dev', f.service, fallbackCompilerDiagnostics);
  assert.deepEqual(await policy(), before, 'plan does not touch policy');
  assert.equal((await openVerificationBrowser(f.ctx, 'dev')).verified, false);
  const jobs = new JobService(f.ctx);
  const execute: JobExecutor = async () => success('apex.validate', { compiler: 'fixture' });
  const job = await jobs.startInline('apex.validate', {}, execute);
  assert.equal((await jobs.status(job.jobId, 1)).status, 'completed');
  await assert.rejects(f.service.apply(f.ctx, planned.plan), { code: 'DEPLOY_APPROVAL_REQUIRED' });
  const result = await shipApply(f.ctx, planned.plan, 'Import the identified QA application', f.service);
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(result.nextActions, []);
  assert.equal('browserVerification' in result, false);
  assert.ok(f.calls.includes('validate') && f.calls.includes('import'));
  assert.deepEqual(await policy(), before);
});

test('legacy folder list is ignored and unknown environment kinds are rejected', async () => {
  assert.equal(policySchema.safeParse({ schemaVersion: 1, grants: [] }).success, true);
  assert.equal(
    policySchema.safeParse({ schemaVersion: 1, trustedProjects: ['/somewhere-else'], grants: [] }).success,
    true,
  );
  const { ctx } = await fixture();
  try {
    for (const kind of ['development', 'dev', 'qa', 'test'])
      assert.equal(environmentSchema.safeParse({ ...ctx.config.environments.dev!, kind }).success, true);
    assert.equal(
      environmentSchema.safeParse({ ...ctx.config.environments.dev!, kind: 'unknown' }).success,
      false,
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('SQL inspection recognizes actual rename/drop/DML and skips comments/string data', () => {
  assert.deepEqual(
    migrationRisk(
      "-- drop table customers\ncreate table t(id number, note varchar2(100) default 'delete from customers')",
    ),
    [],
  );
  assert.deepEqual(migrationRisk("create table t(note varchar2(100) default q'[drop table customers]')"), []);
  const rename = inspectSql('alter table app.customers rename column old_name to new_name;')[0]!;
  assert.equal(rename.action, 'rename-column');
  assert.equal(rename.object, 'APP.CUSTOMERS');
  assert.equal(rename.column, 'OLD_NAME');
  assert.equal(rename.renamedTo, 'NEW_NAME');
  assert.equal(inspectSql('drop table customers cascade constraints;')[0]!.action, 'drop-table');
  assert.ok(migrationRisk('update customers set status = 0;').length);
  assert.equal(inspectSql("begin execute immediate 'drop table customers'; end;")[0]!.action, 'drop-table');
  assert.equal(inspectSql('begin app_api.change_rows; end;')[0]!.action, 'plsql-block');
  const mixed = inspectSql('create table audit_log(id number); begin app_api.change_rows; end;');
  assert.deepEqual(
    mixed.map((operation) => operation.action),
    ['create-table', 'plsql-block'],
  );
  assert.ok(migrationRisk('create table audit_log(id number); begin app_api.change_rows; end;').length);
  assert.match(executableSql("-- host unsafe\nselect 'drop' from dual;\nspool out.txt"), /\nspool/);
  assert.doesNotMatch(executableSql("-- host unsafe\nselect 'drop' from dual"), /host|drop/);
});

test('locality uses effective endpoints and rejects mixed/remote/ambiguous endpoints', () => {
  assert.equal(localConnectionEndpoint('USER@jdbc:oracle:thin:@//127.0.0.1:1521/FREEPDB1').local, true);
  assert.equal(
    localConnectionEndpoint('USER@jdbc:oracle:thin:@(description=(address=(host=localhost)(port=1521)))')
      .local,
    true,
  );
  assert.equal(
    localConnectionEndpoint(
      'USER@jdbc:oracle:thin:@(description=(address=(host=localhost))(address=(host=remote.example)))',
    ).local,
    false,
  );
  assert.equal(localConnectionEndpoint('USER@jdbc:oracle:thin:@REMOTE_ALIAS').local, false);
  assert.equal(localConnectionEndpoint('http://localhost/application').local, false);
});

test('remote risky SQL needs exact-plan confirmation; short human reply works; production always wins', async (t) => {
  const f = await unlisted(t);
  const planned = await shipPlan(f.ctx, 'dev', f.service, fallbackCompilerDiagnostics);
  const risky = { ...planned.plan, risks: ['database-mutation:db/update.sql'] };
  await assert.rejects(checkShipTarget(f.ctx, risky), { code: 'DATABASE_CONFIRMATION_REQUIRED' });
  const confirmation = { planDigest: risky.digest, userRequest: 'Так' };
  await checkShipTarget(f.ctx, risky, false, confirmation);
  await assert.rejects(
    checkShipTarget(f.ctx, risky, false, { ...confirmation, planDigest: '0'.repeat(64) }),
    { code: 'CONFIRMATION_PLAN_MISMATCH' },
  );
  await writeJson(path.join(process.env.APEXREST_HOME!, 'policy.json'), {
    schemaVersion: 1,
    grants: [shipGrant(f.ctx, risky, 'Change the identified database object', confirmation)],
  });
  await authorizePlan(f.ctx, risky, f.env);
  const localGrant = shipGrant(f.ctx, risky, 'Change the identified local database object');
  await writeJson(path.join(process.env.APEXREST_HOME!, 'policy.json'), {
    schemaVersion: 1,
    grants: [localGrant],
  });
  await authorizePlan(f.ctx, risky, f.env, true);
  await assert.rejects(authorizePlan(f.ctx, risky, { ...f.env, kind: 'production' }, true), {
    code: 'PRODUCTION_DEPLOY_DENIED',
  });
  await writeJson(path.join(process.env.APEXREST_HOME!, 'production-trust.json'), {
    schemaVersion: 1,
    productionTargets: [risky.targetDigest],
  });
  await assert.rejects(checkShipTarget(f.ctx, risky, true, confirmation), {
    code: 'PRODUCTION_DEPLOY_DENIED',
  });
});

test('lost response with already-applied server content recovers success without another import', async (t) => {
  const f = await unlisted(t);
  await f.service.sync(f.ctx, 'dev', 'init');
  await atomicWrite(
    path.join(f.ctx.root, f.ctx.config.application.sourceDir, 'application.apx'),
    'application changed (\n)\n',
  );
  const planned = await shipPlan(f.ctx, 'dev', f.service, fallbackCompilerDiagnostics);
  const original = f.oracle.importApplication;
  f.oracle.importApplication = async (...args) => {
    await original(...args);
    throw new Error('Lost acknowledgment after committed import');
  };
  const result = await shipApply(f.ctx, planned.plan, 'Update the identified DEV application', f.service);
  assert.equal(result.status, 'succeeded');
  assert.equal(result.recovery, 'server-readback-confirmed');
  assert.equal(f.calls.filter((call) => call === 'import').length, 1);
  assert.equal(await new LocalDeploymentControl(f.env).owner(), undefined);
  assert.equal((await f.service.sync(f.ctx, 'dev', 'status')).status, 'ready');
  const next = await shipPlan(f.ctx, 'dev', f.service, fallbackCompilerDiagnostics);
  assert.ok(
    next.plan.digest,
    'recovered checkpoint passes its owner and checksum validation on the next plan',
  );
});

test('interrupted unchanged server safely replans once; unrelated server changes block retry', async (t) => {
  const f = await unlisted(t);
  await f.service.sync(f.ctx, 'dev', 'init');
  const source = path.join(f.ctx.root, f.ctx.config.application.sourceDir, 'application.apx');
  await atomicWrite(source, 'application desired (\n)\n');
  const planned = await shipPlan(f.ctx, 'dev', f.service, fallbackCompilerDiagnostics);
  const original = f.oracle.importApplication;
  let attempt = 0;
  f.oracle.importApplication = async (...args) => {
    if (attempt++ === 0) {
      f.calls.push('import-lost');
      throw new Error('Lost response before application changed');
    }
    return original(...args);
  };
  const result = await shipApply(f.ctx, planned.plan, 'Update the identified DEV application', f.service);
  assert.equal(result.status, 'succeeded');
  assert.equal(attempt, 2);
  assert.equal(await new LocalDeploymentControl(f.env).owner(), undefined);
});

test('local ENV is literal data, requires ignored/untracked files and never returns connection password', async (t) => {
  const { ctx } = await fixture();
  t.after(() => rm(ctx.root, { recursive: true, force: true }));
  const init = await runProcess({ executable: 'git', args: ['init', '-q'], cwd: ctx.root });
  assert.equal(init.code, 0);
  await atomicWrite(path.join(ctx.root, '.gitignore'), '.env\n');
  const file = path.join(ctx.root, '.env');
  await atomicWrite(file, "USER=test\nPASSWORD='$(touch /unsafe) # literal'\n");
  const values = await readLocalEnv(file);
  assert.equal(values.PASSWORD, '$(touch /unsafe) # literal');
  assert.equal(await exists('/unsafe'), false);
  assert.equal(parseLocalEnv('X=one # comment').X, 'one');
  await writeJson(path.join(process.env.APEXREST_HOME!, 'connections.json'), {});
  const configured = await configureConnection('local-env-test', {
    envFile: file,
    passwordKey: 'PASSWORD',
    ordsUrl: 'http://127.0.0.1:8080/ords/test/',
    ordsUsername: 'TEST',
  });
  assert.deepEqual(configured, { name: 'local-env-test', status: 'configured' });
  assert.equal(JSON.stringify(configured).includes(values.PASSWORD!), false);
  await atomicWrite(path.join(ctx.root, '.gitignore'), '');
  await assert.rejects(readLocalEnv(file), { code: 'ENV_FILE_UNSAFE' });
  assert.throws(() => parseLocalEnv('X=one\nX=two'), { code: 'ENV_FILE_INVALID' });
});

test('task-scoped dangerous SQL applies on verified local non-production working copy without risk confirmation', async (t) => {
  const f = await unlisted(t);
  const adapter = f.oracle as unknown as OracleAdapter;
  adapter.connectionLocality = async () => {
    f.calls.push('actual-locality');
    return { local: true, evidence: 'fixture-effective-endpoint-and-server' };
  };
  adapter.databaseDependencies = async () => [{ owner: 'FIXTURE', name: 'DEPENDENT_VIEW', type: 'VIEW' }];
  adapter.session = async () => {
    f.calls.push('script');
    return { output: 'APEXREST_SCRIPT_COMPLETE' } as never;
  };
  await f.service.sync(f.ctx, 'dev', 'init');
  await atomicWrite(
    path.join(f.ctx.root, f.ctx.config.database.migrationsDir, '0001__remove_test_table.sql'),
    'drop table task_table;',
  );
  const planned = await shipPlan(f.ctx, 'dev', f.service, fallbackCompilerDiagnostics);
  assert.ok(planned.plan.risks.some((risk) => risk.startsWith('database-mutation:')));
  assert.equal(planned.plan.databaseReview?.local, true);
  assert.equal(planned.plan.databaseReview?.operations[0]?.action, 'drop-table');
  assert.equal(planned.plan.databaseReview?.operations[0]?.dependenciesStatus, 'read');
  const result = await shipApply(
    f.ctx,
    planned.plan,
    'Remove the task table from this identified local TEST project',
    f.service,
  );
  assert.equal(result.status, 'succeeded');
  assert.equal(f.calls.filter((call) => call === 'script').length, 1);
  assert.ok(f.calls.filter((call) => call === 'actual-locality').length >= 2);
});

test('unknown database script outcome forbids automatic recovery/replay', async (t) => {
  const f = await unlisted(t);
  const adapter = f.oracle as unknown as OracleAdapter;
  adapter.connectionLocality = async () => ({
    local: true,
    evidence: 'fixture-effective-endpoint-and-server',
  });
  adapter.session = async () => {
    f.calls.push('script');
    throw new Error('Database script response lost');
  };
  await atomicWrite(
    path.join(f.ctx.root, f.ctx.config.database.migrationsDir, '0001__update_task_rows.sql'),
    'update task_rows set value = 1;',
  );
  const planned = await shipPlan(f.ctx, 'dev', f.service, fallbackCompilerDiagnostics);
  await assert.rejects(
    shipApply(f.ctx, planned.plan, 'Update rows in this identified local TEST project', f.service),
    { code: 'DATABASE_RECOVERY_REQUIRED' },
  );
  assert.equal(f.calls.filter((call) => call === 'script').length, 1);
  assert.equal(f.calls.includes('import'), false);
  assert.equal((await new LocalDeploymentControl(f.env).history())[0]?.status, 'started');
  assert.equal((await new LocalDeploymentControl(f.env).owner())?.phase, 'writing');
});

test('SQLcl REM comments and program bodies are not executed migration operations', () => {
  assert.deepEqual(inspectSql('rem drop table customers;\nremark update customers set x=1;'), []);
  assert.equal(
    inspectSql('create or replace editionable procedure p as begin delete from t; end;\n/')[0]?.action,
    'create-program',
  );
  assert.equal(inspectSql('create or replace view v as select 1 x from dual;')[0]?.dangerous, true);
  assert.deepEqual(migrationRisk("select '😀 DROP TABLE t' x from dual;"), []);
  assert.equal(inspectSql('create table t(id number);\ndrop table customers;')[1]?.action, 'drop-table');
});

test('recovery preserves live and foreign workers even after a compatible server readback', async (t) => {
  const f = await unlisted(t);
  await f.service.sync(f.ctx, 'dev', 'init');
  await atomicWrite(
    path.join(f.ctx.root, f.ctx.config.application.sourceDir, 'application.apx'),
    'application desired (\n)\n',
  );
  const planned = await shipPlan(f.ctx, 'dev', f.service, fallbackCompilerDiagnostics);
  await writeJson(path.join(process.env.APEXREST_HOME!, 'policy.json'), {
    schemaVersion: 1,
    grants: [shipGrant(f.ctx, planned.plan, 'Update this identified DEV application')],
  });
  f.controls.failImport = true;
  await assert.rejects(f.service.apply(f.ctx, planned.plan), { code: 'OUTCOME_UNKNOWN' });
  const control = new LocalDeploymentControl(f.env),
    original = (await control.owner())!;
  await writeJson(control.file('active.json'), { ...original, pid: process.ppid, hostname: hostname() });
  await assert.rejects(f.service.recover(f.ctx, original.runId), { code: 'TARGET_LOCKED' });
  assert.equal((await control.owner())!.pid, process.ppid);
  await writeJson(control.file('active.json'), { ...original, hostname: 'foreign-machine' });
  await assert.rejects(f.service.recover(f.ctx, original.runId), { code: 'TARGET_LOCKED' });
  assert.equal((await control.owner())!.hostname, 'foreign-machine');
  assert.equal(f.calls.filter((call) => call === 'import').length, 1);
});

test('public safety reference states current production and task authorization rules', async () => {
  const page = await referenceRead('deployment-safety', 0, 8192);
  assert.equal(page.source, 'docs/deployment-safety.md');
  assert.match(page.content, /Production deployment and restore are forbidden/);
  assert.match(page.content, /exact-plan human confirmation/);
  assert.doesNotMatch(page.content, /external approval boundary/);
});
