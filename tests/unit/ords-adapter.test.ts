import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { resolveOrdsJava, runOrdsBridge } from '../../packages/core/src/ords.ts';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import type { Environment, ProjectContext } from '../../packages/core/src/config.ts';
import type { ProcessRequest, ProcessResult } from '../../packages/core/src/process.ts';

const javaExecutableName = process.platform === 'win32' ? 'java.exe' : 'java';
const completed = (stdout = 'APEXREST_ORDS_COMPLETE'): ProcessResult => ({
  code: 0,
  stdout,
  stderr: '',
  timedOut: false,
  cancelled: false,
  truncated: false,
});
const withJdk =
  (runner: (request: ProcessRequest) => Promise<ProcessResult>) => async (request: ProcessRequest) =>
    request.args[0] === '--list-modules'
      ? completed('java.base@21.0.1\njdk.compiler@21.0.1\n')
      : runner(request);

test('ORDS bridge runner keeps credentials off argv/artifacts and requires a complete result', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-ords-runner-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sqlcl = path.join(root, 'sqlcl');
  await mkdir(path.join(sqlcl, 'bin'), { recursive: true });
  await mkdir(path.join(sqlcl, 'lib'), { recursive: true });
  await writeFile(path.join(sqlcl, 'bin/sql'), 'fixture');
  await writeFile(path.join(sqlcl, 'lib/jdbcrest.jar'), 'fixture');
  const settings = { executable: path.join(sqlcl, 'bin/sql'), javaHome: '/fixture/java' };
  const credentials = {
    url: 'https://example.invalid/ords/schema/',
    username: 'TEST',
    password: 'fixture-private-value',
  };
  const job = {
    operation: 'import' as const,
    input: '/fixture/source',
    deployment: '/fixture/deployment.json',
  };
  const successful = await runOrdsBridge(
    settings,
    job,
    credentials,
    root,
    undefined,
    withJdk(async (request) => {
      assert.equal(request.executable, path.join(settings.javaHome, 'bin', javaExecutableName));
      assert.equal(request.args.includes(credentials.password), false);
      assert.equal(JSON.stringify(request.env).includes(credentials.password), false);
      assert.deepEqual(JSON.parse(request.input!), credentials);
      const document = JSON.parse(await readFile(request.args.at(-1)!, 'utf8'));
      assert.equal(JSON.stringify(document).includes(credentials.password), false);
      await writeFile(
        document.output,
        JSON.stringify({ operation: 'import', status: 'succeeded', writeStarted: true }),
      );
      return completed();
    }),
  );
  assert.equal(successful.status, 'succeeded');
  await rm(path.join(root, 'ords-result.json'));
  await assert.rejects(
    runOrdsBridge(
      settings,
      job,
      credentials,
      root,
      undefined,
      withJdk(async () => completed()),
    ),
    { code: 'ORDS_OUTCOME_UNKNOWN', status: 'outcome_unknown' },
  );
  await assert.rejects(
    runOrdsBridge(
      settings,
      job,
      credentials,
      root,
      undefined,
      withJdk(async () => {
        await writeFile(path.join(root, 'ords-result.json'), '{"status":');
        return completed();
      }),
    ),
    { code: 'ORDS_OUTCOME_UNKNOWN', status: 'outcome_unknown' },
  );
  await assert.rejects(
    runOrdsBridge(
      settings,
      job,
      credentials,
      root,
      undefined,
      withJdk(async () => {
        await writeFile(
          path.join(root, 'ords-result.json'),
          JSON.stringify({ operation: 'import', status: 'succeeded', writeStarted: true }),
        );
        return completed('');
      }),
    ),
    { code: 'ORDS_OUTCOME_UNKNOWN', status: 'outcome_unknown' },
  );
  await assert.rejects(
    runOrdsBridge(
      settings,
      job,
      credentials,
      root,
      undefined,
      withJdk(async () => ({
        ...completed(),
        timedOut: true,
      })),
    ),
    { code: 'TIMEOUT', status: 'outcome_unknown' },
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runOrdsBridge(settings, job, credentials, root, controller.signal), {
    code: 'CANCELLED',
    status: 'cancelled',
  });
});

test('ORDS helper detects compiler support and falls back from a managed JRE without changing it', async (t) => {
  const before = process.env.JAVA_HOME;
  delete process.env.JAVA_HOME;
  t.after(() => {
    if (before === undefined) delete process.env.JAVA_HOME;
    else process.env.JAVA_HOME = before;
  });
  const calls: ProcessRequest[] = [];
  const selected = await resolveOrdsJava(
    '/fixture/jre',
    tmpdir(),
    { JAVA_HOME: '/fixture/jre' },
    undefined,
    async (request) => {
      calls.push(request);
      assert.deepEqual(request.args, ['--list-modules']);
      assert.equal(request.input, undefined);
      return completed(
        request.executable === path.join('/fixture/jre', 'bin', javaExecutableName)
          ? 'java.base@21.0.1\njava.compiler@21.0.1\n'
          : 'java.base@25.0.2\njava.compiler@25.0.2\njdk.compiler@25.0.2\n',
      );
    },
  );
  assert.equal(selected.executable, javaExecutableName);
  assert.equal(selected.javaHome, undefined);
  assert.equal(calls[1]!.env!.JAVA_HOME, undefined, 'PATH lookup must not inherit the JRE selection');
  await assert.rejects(
    resolveOrdsJava('/fixture/jre', tmpdir(), {}, undefined, async () =>
      completed('java.base@21.0.1\njava.compiler@21.0.1\n'),
    ),
    { code: 'ORDS_JDK_REQUIRED', status: 'blocked' },
  );
  await assert.rejects(
    resolveOrdsJava('/fixture/jdk17', tmpdir(), {}, undefined, async () =>
      completed('java.base@17.0.1\njdk.compiler@17.0.1\n'),
    ),
    { code: 'ORDS_JDK_REQUIRED', status: 'blocked' },
  );
  const configured = await resolveOrdsJava('/fixture/jdk', tmpdir(), {}, undefined, async () =>
    completed('java.base@21.0.1\njdk.compiler@21.0.1\n'),
  );
  assert.equal(configured.javaHome, '/fixture/jdk');
});

test('ORDS APEX exports, imports and restores use the bridge and keep native source metadata', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-ords-apex-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const adapter = new OracleAdapter(async () => {
    throw new Error('No direct listener or native APEX command expected');
  });
  adapter.settings = async () => ({
    schemaVersion: 1,
    mode: 'cli',
    mcpRestrictLevel: '4',
    databaseTransport: 'ords',
    executable: 'sql',
    javaHome: undefined,
  });
  adapter.stage = () => mkdtemp(path.join(root, 'stage-'));
  adapter.requireCapability = async () => ({ version: 'fixture', helpHash: 'fixture' });
  const calls: string[] = [];
  adapter.ordsBridge = async (job) => {
    calls.push(job.operation);
    if (job.operation === 'export') {
      const output = job.outputDirectory!;
      if (job.exportType === 'APEXLANG') {
        await mkdir(path.join(output, '.apex'), { recursive: true });
        await writeFile(path.join(output, 'application.apx'), 'fixture');
        await writeFile(path.join(output, '.apex/apexlang.json'), '{"mmdVersion":"fixture"}');
      } else {
        assert.equal(job.split, false);
        await mkdir(output, { recursive: true });
        await writeFile(path.join(output, 'f100.sql'), 'begin null; end;\n/\n');
      }
    } else if (job.operation === 'import') {
      assert.equal(job.applicationId, 100);
      const deployment = JSON.parse(await readFile(job.deployment!, 'utf8'));
      assert.equal(deployment.app.id, 100);
      assert.equal(deployment.workspace.name, 'TEST');
    } else if (job.operation === 'script') {
      const sql = await readFile(job.input!, 'utf8');
      assert.match(sql, /set_workspace\('TEST'\)/);
      assert.match(sql, /set_application_id\(100\)/);
      assert.match(sql, /begin null; end;/);
    }
    return { operation: job.operation, status: 'succeeded', message: 'Operation successful' };
  };
  const env = { applicationId: 100, workspace: 'TEST', parsingSchema: 'TEST' } as Environment;
  const connection = {
    kind: 'sqlcl-store' as const,
    ords: { url: 'https://example.invalid/ords/test/', username: 'TEST' },
  };
  const exported = await adapter.exportApplication(env, connection);
  assert.ok(exported.files['application.apx']);
  assert.ok(exported.files['.apex/apexlang.json']);
  assert.ok(!Object.keys(exported.files).some((file) => file.startsWith('ords-')));
  const backup = await adapter.exportApplication(env, connection, 'SQL');
  assert.deepEqual(Object.keys(backup.files), ['f100.sql']);
  const ctx = { config: { application: { alias: 'test' } } } as ProjectContext;
  await adapter.importApplication(ctx, env, connection, exported.directory);
  await adapter.restoreApplication(env, connection, await readFile(path.join(backup.directory, 'f100.sql')));
  assert.deepEqual(calls, ['export', 'export', 'import', 'script']);
});
