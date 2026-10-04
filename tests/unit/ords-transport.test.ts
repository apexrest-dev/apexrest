import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  configureConnection,
  connections,
  editConnection,
  ordsCredentials,
  resolveConnection,
} from '../../packages/core/src/connections.ts';
import { configureSqlcl, sqlclConfig } from '../../packages/core/src/sqlcl-config.ts';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { schemas } from '../../packages/core/src/operations.ts';
import { z } from 'zod';
import type { ProcessRequest, ProcessResult } from '../../packages/core/src/process.ts';

// Protocol fixtures verify local storage, routing and failure behavior only.
// These tests do not claim live Oracle/ORDS compatibility evidence.
const completed = (stdout = ''): ProcessResult => ({
  code: 0,
  stdout,
  stderr: '',
  timedOut: false,
  cancelled: false,
  truncated: false,
});
const endpoint = 'https://ords.example.invalid/ords/app/';
async function home(t: { after: (action: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-ords-'));
  const before = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = root;
  t.after(async () => {
    if (before === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = before;
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

test('ORDS transport is plugin-level, defaults direct and is pinned per adapter', async (t) => {
  const root = await home(t);
  await writeFile(path.join(root, 'runtime.json'), '{"sqlcl":"/fixture/sql"}');
  assert.equal((await sqlclConfig()).databaseTransport ?? 'direct', 'direct');
  const direct = new OracleAdapter();
  await direct.settings();
  await configureSqlcl('cli', undefined, 'ords');
  assert.equal((await direct.settings()).databaseTransport ?? 'direct', 'direct');
  assert.equal((await new OracleAdapter().settings()).databaseTransport, 'ords');
  await assert.rejects(configureSqlcl('mcp'), { code: 'ORDS_CLI_REQUIRED' });
  assert.equal((await sqlclConfig()).mode, 'cli');
  await configureSqlcl('mcp', '1', 'direct');
  assert.equal((await sqlclConfig()).databaseTransport, 'direct');
  assert.equal(await readFile(path.join(root, 'runtime.json'), 'utf8'), '{"sqlcl":"/fixture/sql"}');
});

test('ORDS credentials remain private, preserve direct references and never reuse credentials for another identity', async (t) => {
  const root = await home(t);
  await configureConnection('read', { sqlclName: 'Exact direct / name' });
  await configureConnection('read', {
    ordsUrl: endpoint,
    ordsUsername: 'reader',
    password: 'private-reading-pass',
  });
  const publicRecord = (await connections()).read!;
  assert.deepEqual(publicRecord, {
    kind: 'sqlcl-store',
    name: 'Exact direct / name',
    ords: { url: endpoint, username: 'reader' },
  });
  assert.equal(JSON.stringify(publicRecord).includes('private-reading-pass'), false);
  assert.equal((await ordsCredentials(await resolveConnection('read'))).password, 'private-reading-pass');
  const file = path.join(root, 'credentials/read.json');
  if (process.platform !== 'win32') {
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.equal((await stat(path.dirname(file))).mode & 0o777, 0o700);
  }
  await configureConnection('read', { ordsUrl: endpoint, ordsUsername: 'reader' });
  await assert.rejects(configureConnection('read', { ordsUrl: endpoint, ordsUsername: 'writer' }), {
    code: 'ORDS_CREDENTIALS_REQUIRED',
  });
  await assert.rejects(
    configureConnection('read', {
      ordsUrl: 'https://another.example.invalid/ords/app/',
      ordsUsername: 'reader',
    }),
    { code: 'ORDS_CREDENTIALS_REQUIRED' },
  );
  assert.deepEqual((await connections()).read, publicRecord);
  const passwordFile = path.join(root, 'supplied-password.txt');
  await writeFile(passwordFile, 'private-write-pass\n', { mode: 0o600 });
  await configureConnection('deploy', { ordsUrl: endpoint, ordsUsername: 'writer', passwordFile });
  assert.equal((await ordsCredentials(await resolveConnection('deploy'))).password, 'private-write-pass');
  assert.equal((await connections()).deploy!.name, undefined);
  assert.equal((await editConnection('deploy')).credentialsDeleted, true);
  await assert.rejects(readFile(path.join(root, 'credentials/deploy.json')), { code: 'ENOENT' });
  await configureConnection('direct', { sqlclName: 'Keep in SQLcl store' });
  assert.equal((await editConnection('direct')).credentialsDeleted, false);
});

test('CLI HTTP bootstrap uses stdin, preserves independent read/deploy identities and pins credentials', async (t) => {
  await home(t);
  await configureSqlcl('cli', '4', 'ords');
  await configureConnection('read', {
    sqlclName: 'direct-reader',
    ordsUrl: endpoint,
    ordsUsername: 'reader',
    password: 'secret-r& space',
  });
  await configureConnection('deploy', {
    sqlclName: 'direct-writer',
    ordsUrl: endpoint,
    ordsUsername: 'writer',
    password: 'secret-w',
  });
  const calls: ProcessRequest[] = [];
  const oracle = new OracleAdapter(async (request) => {
    calls.push(request);
    assert.deepEqual(request.args, ['-S', '-L', '/nolog']);
    assert.equal(JSON.stringify(request.args).includes('secret'), false);
    assert.equal(JSON.stringify(request.env).includes('secret-r& space'), false);
    return completed('secret-r& space secret-w\n');
  });
  const first = await oracle.session(
    'select 1 from dual;',
    await resolveConnection('read'),
    false,
    undefined,
    tmpdir(),
  );
  assert.doesNotMatch(first.stdout, /secret-r& space/);
  assert.match(
    calls[0]!.input!,
    /set define off[\s\S]*connect -orest -user "reader" -password "secret-r& space" -url "https:\/\/ords\.example\.invalid\/ords\/app\/"/,
  );
  assert.doesNotMatch(calls[0]!.input!, /direct-reader|connect -save|-name/);
  assert.match(calls[0]!.input!, /set history filter default connect\nconnect -orest/);
  await oracle.session('begin null; end;\n/', await resolveConnection('deploy'), true, undefined, tmpdir());
  assert.match(calls[1]!.input!, /connect -orest -user "writer" -password "secret-w"/);
  await configureConnection('read', { ordsUrl: endpoint, ordsUsername: 'reader', password: 'replacement' });
  await oracle.session('select 2 from dual;', await resolveConnection('read'), false, undefined, tmpdir());
  assert.match(calls[2]!.input!, /"secret-r& space"/);
  assert.doesNotMatch(calls[2]!.input!, /replacement/);
  await configureSqlcl('cli', undefined, 'direct');
  await oracle.session('select 3 from dual;', await resolveConnection('read'), false, undefined, tmpdir());
  assert.deepEqual(calls[3]!.args, ['-S', '-L', '/nolog']);
  const fresh = new OracleAdapter(async (request) => {
    assert.deepEqual(request.args, ['-S', '-L', '-name', 'direct-reader']);
    assert.doesNotMatch(request.input!, /connect -orest|secret|replacement/);
    return completed();
  });
  await fresh.session('select 4 from dual;', await resolveConnection('read'), false, undefined, tmpdir());
});

test('missing credentials, incompatible transports and unsafe input block before network calls', async (t) => {
  const root = await home(t);
  let calls = 0;
  const adapter = () =>
    new OracleAdapter(async () => {
      calls++;
      return completed();
    });
  await configureConnection('direct', { sqlclName: 'direct' });
  await configureSqlcl('cli', undefined, 'ords');
  await assert.rejects(
    adapter().session('select 1 from dual;', await resolveConnection('direct'), false, undefined, tmpdir()),
    { code: 'ORDS_CONNECTION_REQUIRED' },
  );
  await assert.rejects(configureConnection('missing', { ordsUrl: endpoint, ordsUsername: 'app' }), {
    code: 'ORDS_CREDENTIALS_REQUIRED',
  });
  await assert.rejects(
    configureConnection('invalid', { ordsUrl: endpoint, ordsUsername: 'app', password: 'a\nexit' }),
    { code: 'INVALID_ORDS_PASSWORD' },
  );
  await assert.rejects(
    configureConnection('invalid', { ordsUrl: endpoint, ordsUsername: 'app', password: 'a"quote' }),
    { code: 'INVALID_ORDS_PASSWORD' },
  );
  await configureConnection('http', { ordsUrl: endpoint, ordsUsername: 'app', password: 'local-secret' });
  await writeFile(
    path.join(root, 'sqlcl.json'),
    JSON.stringify({ schemaVersion: 1, mode: 'mcp', mcpRestrictLevel: '1', databaseTransport: 'ords' }),
  );
  await assert.rejects(
    adapter().session('select 1 from dual;', await resolveConnection('http'), false, undefined, tmpdir()),
    { code: 'ORDS_CLI_REQUIRED' },
  );
  await configureSqlcl('cli', undefined, 'direct');
  await assert.rejects(
    adapter().session('select 1 from dual;', await resolveConnection('http'), false, undefined, tmpdir()),
    { code: 'DIRECT_CONNECTION_REQUIRED' },
  );
  if (process.platform !== 'win32') {
    await chmod(path.join(root, 'credentials/http.json'), 0o644);
    await assert.rejects(ordsCredentials(await resolveConnection('http')), {
      code: 'ORDS_CREDENTIAL_PERMISSIONS',
    });
    await chmod(path.join(root, 'credentials/http.json'), 0o600);
  }
  await writeFile(path.join(root, 'credentials/http.json'), '{not-json local-secret}');
  await assert.rejects(ordsCredentials(await resolveConnection('http')), (error: Error) => {
    assert.doesNotMatch(error.message, /local-secret/);
    return true;
  });
  assert.equal(calls, 0);
  assert.equal(
    schemas['connection.add'].safeParse({
      name: 'ref',
      ordsUrl: endpoint,
      ordsUsername: 'app',
      password: 'never-in-tool-parameters',
    }).success,
    false,
  );
  for (const url of [
    'https://user:pass@example.invalid/ords/app/',
    'https://example.invalid/ords/app/?password=x',
    'file:///etc/',
    'https://example.invalid/ords/app/_/sql/',
  ])
    assert.equal(
      schemas['connection.add'].safeParse({ name: 'ref', ordsUrl: url, ordsUsername: 'app' }).success,
      false,
    );
  // Tool parameters never carry an ORDS password: the public schema omits it.
  assert.doesNotMatch(JSON.stringify(z.toJSONSchema(schemas['connection.add'])), /"password"/);
});

test('ORDS connection failures are redacted and never trigger a direct fallback', async (t) => {
  await home(t);
  await configureSqlcl('cli', undefined, 'ords');
  await configureConnection('read', {
    sqlclName: 'direct-fallback-forbidden',
    ordsUrl: endpoint,
    ordsUsername: 'app',
    password: 'exact-secret',
  });
  let calls = 0;
  const oracle = new OracleAdapter(async () => {
    calls++;
    return completed('Error: rejected exact-secret');
  });
  await assert.rejects(
    oracle.session('select 1 from dual;', await resolveConnection('read'), false, undefined, tmpdir()),
    (error: Error) => {
      assert.doesNotMatch(error.message, /exact-secret/);
      assert.match(error.message, /REDACTED/);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('ORDS secret redaction preserves matching query data and hides diagnostic credentials', async (t) => {
  await home(t);
  await configureSqlcl('cli', undefined, 'ords');
  await configureConnection('read', {
    ordsUrl: endpoint,
    ordsUsername: 'app',
    password: 'APP',
  });
  const row = { parsing_schema: 'APP', application_id: 101 };
  let fail = false;
  const oracle = new OracleAdapter(async () =>
    completed(fail ? 'Error: rejected credential APP' : JSON.stringify({ results: [{ items: [row] }] })),
  );
  const connection = await resolveConnection('read');
  assert.deepEqual(await oracle.jsonQuery('select schema, id from applications', connection), [row]);
  fail = true;
  await assert.rejects(
    oracle.jsonQuery('select schema, id from applications', connection),
    (error: Error) => {
      assert.doesNotMatch(error.message, /\bAPP\b/);
      assert.match(error.message, /REDACTED/);
      return true;
    },
  );

  // A numeric secret also occurs in valid JSON numbers; redacting the response
  // before parsing would corrupt the envelope instead of returning query data.
  await configureConnection('numeric', { ordsUrl: endpoint, ordsUsername: 'app', password: '1' });
  const numeric = new OracleAdapter(async () => completed(JSON.stringify({ results: [{ items: [row] }] })));
  assert.deepEqual(
    await numeric.jsonQuery('select schema, id from applications', await resolveConnection('numeric')),
    [row],
  );
});

test('ORDS metadata binds initialize client-side without separate EXEC requests', async (t) => {
  await home(t);
  await configureSqlcl('cli', undefined, 'ords');
  await configureConnection('read', {
    ordsUrl: endpoint,
    ordsUsername: 'reader',
    password: 'fixture-password',
  });
  const calls: ProcessRequest[] = [];
  const row = { application_id: 175, workspace: "O'Brien" };
  const oracle = new OracleAdapter(async (request) => {
    calls.push(request);
    return completed(JSON.stringify({ results: [{ items: [row] }] }));
  });
  const result = await oracle.jsonQuery(
    'select :p_app_id application_id, :p_workspace workspace from dual',
    await resolveConnection('read'),
    {
      p_app_id: 175,
      p_workspace: "O'Brien",
      p_empty: '',
      p_zero: 0,
      p_negative: -7,
      p_decimal: 1.25,
      p_literal: "'quoted' & value",
    },
  );
  assert.deepEqual(result, [row]);
  assert.equal(calls.length, 1);
  const input = calls[0]!.input!;
  assert.ok(input.includes("variable p_workspace varchar2(1024) = 'O'Brien'\n"));
  assert.ok(input.includes("variable p_empty varchar2(1024) = ''\n"));
  assert.ok(input.includes("variable p_literal varchar2(1024) = ''quoted' & value'\n"));
  for (const [key, value] of Object.entries({ p_app_id: 175, p_zero: 0, p_negative: -7, p_decimal: 1.25 }))
    assert.ok(input.includes(`variable ${key} number = ${value}\n`));
  assert.doesNotMatch(input, /^\s*exec\s+:/im);
  assert.doesNotMatch(input, /O''Brien/);
  assert.ok(input.indexOf('set define off') < input.indexOf('variable p_literal'));
});

test('ORDS metadata rejects unsafe bind declarations before invoking SQLcl', async (t) => {
  await home(t);
  await configureSqlcl('cli', undefined, 'ords');
  await configureConnection('read', {
    ordsUrl: endpoint,
    ordsUsername: 'reader',
    password: 'fixture-password',
  });
  let calls = 0;
  const oracle = new OracleAdapter(async () => {
    calls++;
    return completed();
  });
  const connection = await resolveConnection('read');
  for (const value of ['line\nexec anything', 'line\rnext', 'null\x00byte', 'tab\tvalue'])
    await assert.rejects(oracle.jsonQuery('select :p_value from dual', connection, { p_value: value }), {
      code: 'INVALID_SQL_LITERAL',
    });
  for (const value of ['delete\x7fcontrol', 'next\x85line', 'last\x9fcontrol'])
    await assert.rejects(oracle.jsonQuery('select :p_value from dual', connection, { p_value: value }), {
      code: 'INVALID_BIND',
    });
  await assert.rejects(
    oracle.jsonQuery('select :p_value from dual', connection, { p_value: 'x'.repeat(1025) }),
    {
      code: 'INVALID_SQL_LITERAL',
    },
  );
  await assert.rejects(
    oracle.jsonQuery('select 1 from dual', connection, { 'p_value\nexec invalid': 'value' }),
    {
      code: 'INVALID_BIND',
    },
  );
  assert.equal(calls, 0);
});

test('direct metadata keeps server-side bind assignment and SQL apostrophe escaping', async (t) => {
  await home(t);
  await configureSqlcl('cli', undefined, 'direct');
  await configureConnection('read', { sqlclName: 'direct-reader' });
  const calls: ProcessRequest[] = [];
  const oracle = new OracleAdapter(async (request) => {
    calls.push(request);
    return completed(JSON.stringify({ results: [{ items: [] }] }));
  });
  assert.deepEqual(
    await oracle.jsonQuery('select :p_value from dual', await resolveConnection('read'), {
      p_value: "O'Brien",
      p_empty: '',
      p_number: 175,
    }),
    [],
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.args, ['-S', '-L', '-name', 'direct-reader']);
  const input = calls[0]!.input!;
  assert.ok(input.includes("variable p_value varchar2(1024)\nexec :p_value := 'O''Brien';\n"));
  assert.ok(input.includes("variable p_empty varchar2(1024)\nexec :p_empty := '';\n"));
  assert.ok(input.includes('variable p_number number\nexec :p_number := 175;\n'));
  assert.doesNotMatch(input, /^variable .* = /m);
});
