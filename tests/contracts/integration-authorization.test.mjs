import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, symlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  integrationOptions,
  readReviewedIntegrationPlan,
  integrationChecks,
  integrationStatus,
  privateIntegrationDirectory,
  integrationToolProbes,
  integrationExportInventory,
  integrationApplyConfirmed,
} from '../../scripts/lib/integration.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) =>
  Array.isArray(value)
    ? '[' + value.map(canonical).join(',') + ']'
    : value !== null && typeof value === 'object'
      ? '{' +
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, child]) => JSON.stringify(key) + ':' + canonical(child))
          .join(',') +
        '}'
      : JSON.stringify(value);
const json = (file, value) => writeFile(file, JSON.stringify(value) + '\n');
const base = { APEXREST_INTEGRATION_PROJECT: '/project', APEXREST_INTEGRATION_ENV: 'test' };

test('prepare is non-writing by default and no flag creates a literal human instruction', () => {
  assert.equal(integrationOptions(base).mode, 'prepare');
  assert.equal(integrationOptions(base).userRequest, undefined);
  assert.throws(
    () =>
      integrationOptions({
        ...base,
        APEXREST_INTEGRATION_MODE: 'apply',
        APEXREST_INTEGRATION_ALLOW_WRITES: 'true',
      }),
    /Literal/,
  );
  assert.throws(() => integrationOptions({ ...base, APEXREST_INTEGRATION_MODE: 'apply' }), /ALLOW_WRITES/);
  assert.throws(
    () => integrationOptions({ ...base, APEXREST_INTEGRATION_MODE: 'automatic' }),
    /prepare or apply/,
  );
});

async function fixture(t) {
  const project = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-integration-')));
  t.after(() => rm(project, { recursive: true, force: true }));
  await mkdir(path.join(project, 'src'));
  await writeFile(path.join(project, 'src/application.apx'), 'app test ()\n');
  const target = {
    kind: 'test',
    applicationId: 97231,
    workspace: 'APEX-APP',
    parsingSchema: 'WKSP_APEXAPP',
    databaseIdentity: { dbUniqueName: 'fcek9ua6', serviceName: 'exact-service' },
  };
  const config = { projectId: 'qualification', environments: { test: target } };
  const options = {
    mode: 'apply',
    project,
    environment: 'test',
    plan: 'plan.json',
    planDigest: 'a'.repeat(64),
    review: path.join(project, 'review.json'),
    userRequest: 'Actual scoped human request',
    configurationDigest: sha(canonical(config)),
  };
  const plan = {
    projectRoot: project,
    projectId: config.projectId,
    environment: 'test',
    digest: options.planDigest,
    configurationDigest: sha(canonical(config)),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    target: {
      identity: { db_unique_name: 'fcek9ua6', service_name: 'exact-service', parsing_schema: 'WKSP_APEXAPP' },
      workspace: { workspace: 'APEX-APP', workspace_id: '10934068819404041' },
      application: null,
    },
    sources: { 'src/application.apx': sha(await readFile(path.join(project, 'src/application.apx'))) },
    risks: [],
    operations: [{ kind: 'import' }, { kind: 'verify' }],
  };
  async function save() {
    await json(path.join(project, 'plan.json'), plan);
    await json(options.review, {
      schemaVersion: 1,
      status: 'reviewed',
      applyAllowed: true,
      projectRoot: project,
      environment: 'test',
      planDigest: options.planDigest,
      planSha256: sha(await readFile(path.join(project, 'plan.json'))),
      userRequestSha256: sha(options.userRequest),
    });
  }
  await save();
  return { config, options, plan, save, project };
}

test('a separately reviewed fresh saved plan retains its exact target and source bytes', async (t) => {
  const { config, options, plan } = await fixture(t);
  const actual = await readReviewedIntegrationPlan(options, config);
  assert.equal(actual.plan.digest, plan.digest);
  assert.equal(actual.plan.target.workspace.workspace_id, '10934068819404041');
  assert.equal(actual.confirmation, undefined);
});

test('changing plan bytes or the literal request invalidates the review before connection', async (t) => {
  const { config, options, plan, project } = await fixture(t);
  await assert.rejects(
    readReviewedIntegrationPlan({ ...options, userRequest: 'Different request' }, config),
    /review must bind/,
  );
  plan.environment = 'qa';
  await json(path.join(project, 'plan.json'), plan);
  await assert.rejects(readReviewedIntegrationPlan(options, config), /review must bind/);
});

test('a local-only review cannot authorize actual apply mode', async (t) => {
  const { config, options } = await fixture(t);
  const review = JSON.parse(await readFile(options.review, 'utf8'));
  delete review.applyAllowed;
  await json(options.review, review);
  await assert.rejects(readReviewedIntegrationPlan(options, config), /local compatibility review/);
  assert.equal(
    (await readReviewedIntegrationPlan({ ...options, mode: 'local-compatibility-check' }, config)).plan
      .digest,
    options.planDigest,
  );
  review.applyAllowed = false;
  await json(options.review, review);
  await assert.rejects(readReviewedIntegrationPlan(options, config), /local compatibility review/);
});

test('environment/production/expiry and unsafe rounded identity are refused', async (t) => {
  const { config, options, plan, save } = await fixture(t);
  await assert.rejects(
    readReviewedIntegrationPlan({ ...options, environment: 'constructor' }, config),
    /Environment is absent/,
  );
  config.environments.test.kind = 'production';
  await assert.rejects(readReviewedIntegrationPlan(options, config), /Production/);
  config.environments.test.kind = 'test';
  plan.target.workspace.workspace_id = 10934068819404040;
  await save();
  await assert.rejects(readReviewedIntegrationPlan(options, config), /workspace ID text/);
  plan.target.workspace.workspace_id = '10934068819404041';
  plan.expiresAt = '2000-01-01T00:00:00.000Z';
  await save();
  await assert.rejects(readReviewedIntegrationPlan(options, config), /expiry/);
});

test('a vacant-app plan still binds the configured new application ID and source alias', async (t) => {
  const { config, options } = await fixture(t);
  config.environments.test.applicationId = 102;
  options.configurationDigest = sha(canonical(config));
  await assert.rejects(
    readReviewedIntegrationPlan(options, config),
    /identity, environment, digest or expiry/,
  );
});

test('source mutation and escaping plan paths are refused before database commands', async (t) => {
  const { config, options, project } = await fixture(t);
  await writeFile(path.join(project, 'src/application.apx'), 'app changed ()\n');
  await assert.rejects(readReviewedIntegrationPlan(options, config), /source drift/);
  await assert.rejects(
    readReviewedIntegrationPlan({ ...options, plan: '../plan.json' }, config),
    /contained/,
  );
  for (const plan of ['C:plan.json', 'plan.json:stream', 'plan\u0000.json'])
    await assert.rejects(readReviewedIntegrationPlan({ ...options, plan }, config), /contained/);
});

test('remote risks need their own exact-plan confirmation; no-op cannot execute scripts', async (t) => {
  const { config, options, plan, save, project } = await fixture(t);
  plan.risks = ['remote-data-mutation'];
  plan.operations.unshift({ kind: 'migration' });
  await save();
  await assert.rejects(
    readReviewedIntegrationPlan(options, config),
    /separate exact-plan human confirmation/,
  );
  const confirmation = path.join(project, 'confirmation.json');
  await json(confirmation, { planDigest: 'b'.repeat(64), userRequest: 'Actual exact-plan confirmation' });
  await assert.rejects(
    readReviewedIntegrationPlan({ ...options, confirmation }, config),
    /exact plan digest/,
  );
  await json(confirmation, { planDigest: options.planDigest, userRequest: 'Actual exact-plan confirmation' });
  assert.equal(
    (await readReviewedIntegrationPlan({ ...options, confirmation }, config)).confirmation.planDigest,
    plan.digest,
  );
  await assert.rejects(
    readReviewedIntegrationPlan({ ...options, confirmation, expectNoop: true }, config),
    /No-op/,
  );
});

test('happy-path compiler/import alone cannot establish the complete external gate', () => {
  const checks = integrationChecks();
  assert.ok(checks.some(({ id }) => id === 'interrupted-import-server-first-recovery'));
  checks.find(({ id }) => id === 'real-compiler').status = 'passed';
  checks.find(({ id }) => id === 'confirmed-error-free-import/readback').status = 'passed';
  assert.equal(integrationStatus(checks), 'partial');
  assert.equal(integrationStatus([]), 'partial');
  for (const check of checks) check.status = 'passed';
  assert.equal(integrationStatus(checks), 'passed');
  checks[0].status = 'blocked';
  assert.equal(integrationStatus(checks), 'blocked');
});

test('actual public ship result shape confirms flattened success and exact grant revocation', () => {
  const digest = 'a'.repeat(64);
  const observedShape = {
    ok: true,
    status: 'succeeded',
    data: {
      status: 'succeeded',
      runId: '00000000-0000-4000-8000-000000000001',
      planDigest: digest,
      verification: { identity: 'confirmed', state: 'succeeded' },
      grant: { removed: true, planDigest: digest },
    },
  };
  assert.equal(integrationApplyConfirmed(observedShape, digest), true);
  assert.equal(observedShape.data.state, undefined, 'No state.status wrapper exists in public ship data.');
  for (const change of [
    { status: 'outcome_unknown' },
    { runId: undefined },
    { verification: { identity: 'confirmed', state: 'failed' } },
    { verification: { identity: 'unknown', state: 'succeeded' } },
    { grant: { removed: false, planDigest: digest } },
    { planDigest: 'b'.repeat(64) },
    { grant: { removed: true, planDigest: 'b'.repeat(64) } },
  ])
    assert.equal(
      integrationApplyConfirmed({ ...observedShape, data: { ...observedShape.data, ...change } }, digest),
      false,
    );
  assert.equal(integrationApplyConfirmed({ ...observedShape, ok: false }, digest), false);
  assert.equal(integrationApplyConfirmed({ ...observedShape, status: 'outcome_unknown' }, digest), false);
  assert.equal(
    integrationApplyConfirmed(
      { ok: true, data: { state: { status: 'succeeded' }, grant: { removed: true } } },
      digest,
    ),
    false,
  );
});

test('evidence output stays private and contained with existing or new directory ancestors', async (t) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-integration-output-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const destination = path.join(root, 'nested', 'attempt');
  assert.equal(await privateIntegrationDirectory(root, destination), destination);
  assert.equal(await privateIntegrationDirectory(root, destination), destination);
  if (process.platform !== 'win32') assert.equal((await stat(destination)).mode & 0o777, 0o700);
  await assert.rejects(
    privateIntegrationDirectory(root, path.join(root, '..', 'outside')),
    /physical evidence root/,
  );
  await writeFile(path.join(root, 'file'), 'regular file');
  await assert.rejects(
    privateIntegrationDirectory(root, path.join(root, 'file', 'attempt')),
    /regular directories/,
  );
  await t.test('an actual symlink or directory junction cannot redirect evidence', async (t) => {
    const outside = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-outside-output-')));
    t.after(() => rm(outside, { recursive: true, force: true }));
    try {
      await symlink(outside, path.join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOSYS', 'ENOTSUP'].includes(error.code)) {
        t.skip(`Actual symlink/junction capability unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    await assert.rejects(privateIntegrationDirectory(root, path.join(root, 'alias', 'attempt')), /symlinks/);
  });
});

test('tool provenance uses verified command and version identities instead of probe order', () => {
  const sqlcl = {
    command: path.join(path.sep, 'tools', process.platform === 'win32' ? 'sql.exe' : 'sql'),
    state: 'detected',
    version: 'SQLcl: Release 26.1.2.0 Production Build: 26.1.2.132.1334',
  };
  const java = {
    command: path.join(path.sep, 'tools', process.platform === 'win32' ? 'java.exe' : 'java'),
    state: 'detected',
    version: 'openjdk version "21.0.12"',
  };
  assert.deepEqual(
    integrationToolProbes([java, { command: 'codex', state: 'detected', version: 'codex-cli' }, sqlcl]).map(
      ({ name, probe }) => [name, probe.version],
    ),
    [
      ['sqlcl', sqlcl.version],
      ['java', java.version],
    ],
  );
  assert.throws(() => integrationToolProbes([{ ...sqlcl, command: 'codex' }, java]), /actual sqlcl/);
  assert.throws(() => integrationToolProbes([sqlcl, { ...java, state: 'unavailable' }]), /actual java/);
});

test('full Oracle export comparison includes hidden metadata and changed/deleted log-named assets', async (t) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-complete-export-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const side of ['before', 'after']) {
    await mkdir(path.join(root, side, 'shared-components/static-files'), { recursive: true });
    await mkdir(path.join(root, side, '.apex'));
    await writeFile(path.join(root, side, 'application.apx'), 'app fixture ()');
    await writeFile(path.join(root, side, '.apex/apexlang.json'), '{"mmdVersion":"fixture"}');
    await writeFile(
      path.join(root, side, 'shared-components/static-files/diagnostic.log'),
      'synthetic static asset A',
    );
  }
  const before = await integrationExportInventory(path.join(root, 'before'));
  assert.deepEqual(await integrationExportInventory(path.join(root, 'after')), before);
  assert.ok(before['.apex/apexlang.json']);
  assert.ok(before['shared-components/static-files/diagnostic.log']);
  await writeFile(
    path.join(root, 'after/shared-components/static-files/diagnostic.log'),
    'synthetic static asset B',
  );
  assert.notDeepEqual(await integrationExportInventory(path.join(root, 'after')), before);
  await rm(path.join(root, 'after/shared-components/static-files/diagnostic.log'));
  assert.notDeepEqual(await integrationExportInventory(path.join(root, 'after')), before);
  await t.test('actual export symlink/junction is refused', async (t) => {
    try {
      await symlink(
        path.join(root, 'before'),
        path.join(root, 'after/alias'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOSYS', 'ENOTSUP'].includes(error.code)) {
        t.skip(`Actual alias capability unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    await assert.rejects(integrationExportInventory(path.join(root, 'after')), /Symlink/);
    await assert.rejects(
      integrationExportInventory(path.join(root, 'after/alias/shared-components')),
      /ancestors/,
    );
  });
});
