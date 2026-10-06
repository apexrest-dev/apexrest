import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { zipSync, strToU8 } from 'fflate';

const sql = spawnSync('which', ['sql'], { encoding: 'utf8' }).stdout?.trim();
const sqlclHome = process.env.APEXREST_TEST_SQLCL_HOME || (sql ? path.dirname(path.dirname(sql)) : '');
const available =
  existsSync(path.join(sqlclHome, 'lib/jdbcrest.jar')) && spawnSync('javac', ['-version']).status === 0;

// This is a local HTTP protocol fixture using the real Oracle client JARs.
// The responses are simulated; this is explicitly not live Oracle/ORDS database evidence.
test(
  'real OREST driver encodes imports and decodes exports against a loopback HTTP fixture',
  { skip: !available },
  async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'apexrest-ords-protocol-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const classpath = [path.join(sqlclHome, 'lib/*'), path.join(sqlclHome, 'lib/ext/*')].join(path.delimiter);
    const compiled = spawnSync(
      'javac',
      ['-cp', classpath, '-d', directory, 'resources/ords/OrdsBridge.java'],
      { encoding: 'utf8' },
    );
    assert.equal(compiled.status, 0, compiled.stderr);
    const credential = 'fixture-only-password';
    const authorization = 'Bearer fixture-access-token';
    let authentications = 0;
    const binary = new Uint8Array([0, 1, 255, 128, 0, 10]);
    const zip = zipSync({
      'application/.apex/apexlang.json': strToU8('{"mmdVersion":"26.1.0+3102"}'),
      'application/application.apx': strToU8('app TEST ( name: Україна )'),
      'application/shared-components/static-files/image.bin': binary,
    });
    const sqlBackup = 'prompt SQL backup\nbegin null; end;\n/\n';
    const sqlZip = zipSync({ 'f912345.sql': strToU8(sqlBackup) });
    const requests: { url: string; body: Record<string, any> }[] = [];
    let fixtureError: Error | undefined;
    let failScript = false;
    const server = createServer(async (request, response) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const text = Buffer.concat(chunks).toString('utf8');
        if (request.url === '/ords/fixture/oauth2/token') {
          const form = new URLSearchParams(text);
          assert.equal(form.get('grant_type'), 'password');
          assert.equal(form.get('username'), 'fixture');
          assert.equal(form.get('password'), credential);
          assert.match(request.headers.authorization ?? '', /^Basic /);
          authentications += 1;
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({
              access_token: 'fixture-access-token',
              token_type: 'bearer',
              refresh_token: 'fixture-refresh-token',
            }),
          );
          return;
        }
        if (request.headers.authorization !== authorization) {
          response.writeHead(401, { 'www-authenticate': 'Basic realm="ORDS fixture"' });
          response.end();
          return;
        }
        const body = JSON.parse(text);
        requests.push({ url: request.url ?? '', body });
        const exported = String(body.statementText).includes('apex_export.get_application');
        const archive = body.binds?.find((bind: any) => bind.index === 2)?.value === 'SQL' ? sqlZip : zip;
        const error = failScript
          ? { errorCode: 20001, errorDetails: 'ORA-20001: fixture failure', result: -1 }
          : { result: 0 };
        const items = [
          {
            statementId: 1,
            statementType: 'plsql',
            response: failScript
              ? ['ORA-20001: fixture failure']
              : ['PL/SQL procedure successfully completed.'],
            ...error,
            ...(exported
              ? {
                  binds: [
                    {
                      index: 4,
                      data_type: 'CLOB',
                      mode: 'out',
                      result: Buffer.from(archive).toString('base64'),
                    },
                  ],
                }
              : {}),
          },
        ];
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ env: { defaultTimeZone: 'UTC' }, items }));
      } catch (error) {
        fixtureError = error as Error;
        response.writeHead(500);
        response.end('fixture error');
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
    const port = (server.address() as AddressInfo).port;
    let sequence = 0;
    const run = async (job: Record<string, unknown>) => {
      const output = path.join(directory, `report-${++sequence}.json`);
      const file = path.join(directory, `job-${sequence}.json`);
      await writeFile(file, JSON.stringify({ ...job, output }));
      const child = spawn('java', ['-cp', `${directory}${path.delimiter}${classpath}`, 'OrdsBridge', file], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => {
        stdout += data;
      });
      child.stderr.on('data', (data) => {
        stderr += data;
      });
      child.stdin.end(
        JSON.stringify({
          url: `http://127.0.0.1:${port}/ords/fixture/`,
          username: 'fixture',
          password: credential,
        }),
      );
      const timeout = setTimeout(() => child.kill('SIGKILL'), 60000);
      const code = await new Promise<number | null>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      }).finally(() => clearTimeout(timeout));
      assert.equal(fixtureError, undefined);
      assert.ok(!stdout.includes(credential) && !stderr.includes(credential));
      const text = await readFile(output, 'utf8');
      assert.ok(!text.includes(credential));
      return { code, report: JSON.parse(text), stdout, stderr };
    };
    const deployment = path.join(directory, 'deployment.json');
    await writeFile(
      deployment,
      JSON.stringify({
        app: { id: 912345, databaseSession: { parsingSchema: 'FIXTURE' } },
        workspace: { name: 'FIXTURE' },
      }),
    );
    const imported = await run({
      operation: 'import',
      input: path.resolve('templates/blank-app/application'),
      deployment,
    });
    assert.equal(imported.code, 0, imported.report.message);
    assert.equal(imported.report.status, 'succeeded');
    assert.equal(imported.report.writeStarted, true);
    assert.equal(requests.length, 1, 'The import must use one authenticated execution request');
    assert.equal(requests[0]!.url, '/ords/fixture/_/sql');
    const importBody = requests[0]!.body;
    assert.match(importBody.statementText, /json_table/);
    assert.equal(importBody.binds.length, 1);
    assert.equal(importBody.binds[0].data_type, 'CLOB');
    const blocks = JSON.parse(importBody.binds[0].value) as string[];
    assert.match(blocks[0]!, /set_workspace\('FIXTURE'\)/);
    assert.match(blocks[1]!, /import_begin/);
    assert.match(blocks.at(-1)!, /import_end/);
    assert.equal(blocks.length, imported.report.blockCount);

    const exportDirectory = path.join(directory, 'export');
    const exported = await run({
      operation: 'export',
      outputDirectory: exportDirectory,
      applicationId: 912345,
      exportType: 'APEXLANG',
      split: true,
    });
    assert.equal(exported.code, 0, exported.report.message);
    assert.equal(requests.length, 2);
    const exportBinds = requests[1]!.body.binds;
    assert.equal(exportBinds.find((bind: any) => bind.index === 2).value, 'APEXLANG');
    assert.equal(exportBinds.find((bind: any) => bind.index === 4).data_type, 'CLOB');
    assert.equal(exportBinds.find((bind: any) => bind.index === 4).mode, 'out');
    assert.deepEqual(
      await readFile(path.join(exportDirectory, 'application/shared-components/static-files/image.bin')),
      Buffer.from(binary),
    );
    assert.match(
      await readFile(path.join(exportDirectory, 'application/application.apx'), 'utf8'),
      /Україна/,
    );
    assert.match(
      await readFile(path.join(exportDirectory, 'application/.apex/apexlang.json'), 'utf8'),
      /26\.1/,
    );

    const backupDirectory = path.join(directory, 'backup');
    const backup = await run({
      operation: 'export',
      outputDirectory: backupDirectory,
      applicationId: 912345,
      exportType: 'APPLICATION_SOURCE',
      split: false,
    });
    assert.equal(backup.code, 0, backup.report.message);
    assert.equal(requests.length, 3);
    assert.equal(requests[2]!.body.binds.find((bind: any) => bind.index === 2).value, 'SQL');
    assert.equal(await readFile(path.join(backupDirectory, 'f912345.sql'), 'utf8'), sqlBackup);

    const scriptFile = path.join(directory, 'restore.sql');
    const script = 'set define off\nbegin null; end;\n/\ncommit;\n';
    await writeFile(scriptFile, script);
    const restored = await run({ operation: 'script', input: scriptFile });
    assert.equal(restored.code, 0, restored.report.message);
    assert.equal(requests.length, 4);
    assert.equal(requests[3]!.body.statementText, script);
    assert.equal(requests[3]!.body.emulate, undefined);

    failScript = true;
    const failed = await run({ operation: 'script', input: scriptFile });
    assert.notEqual(failed.code, 0);
    assert.equal(failed.report.status, 'failed');
    assert.equal(failed.report.writeStarted, true);
    assert.match(failed.report.message, /fixture failure/);
    assert.equal(requests.length, 5, 'Failed writes must not be replayed automatically');

    const failedImport = await run({
      operation: 'import',
      input: path.resolve('templates/blank-app/application'),
      deployment,
    });
    assert.notEqual(failedImport.code, 0);
    assert.equal(failedImport.report.status, 'failed');
    assert.equal(failedImport.report.writeStarted, true);
    assert.equal(requests.length, 6, 'Failed imports must not be replayed automatically');
    assert.equal(authentications, 6, 'Each isolated bridge process authenticates once');
  },
);

test(
  'native SQLcl ORDS flags preserve lowercase usernames and complex passwords',
  { skip: !available },
  async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'apexrest-ords-cli-protocol-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const credential = 'fixture p@ss/&word\\tail';
    const requests: { url: string; username: string | null; passwordMatches: boolean }[] = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      requests.push({
        url: request.url ?? '',
        username: body.get('username'),
        passwordMatches: body.get('password') === credential,
      });
      // Authentication is intentionally denied; no server-side SQL execution is simulated here.
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ error: 'invalid_grant', error_description: 'Local fixture denies authentication' }),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
    const port = (server.address() as AddressInfo).port;
    const child = spawn(path.join(sqlclHome, 'bin/sql'), ['-S', '/nolog'], {
      cwd: directory,
      env: { ...process.env, SQLPATH: directory, ORA_SQLPATH: directory },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let transcript = '';
    child.stdout.on('data', (data) => {
      transcript += data;
    });
    child.stderr.on('data', (data) => {
      transcript += data;
    });
    child.stdin.end(
      `set history filter default connect\nset define off\nconnect -orest -user "fixture" -password "${credential}" -url "http://127.0.0.1:${port}/ords/fixture/"\nexit\n`,
    );
    const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
    await new Promise<void>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', () => resolve());
    }).finally(() => clearTimeout(timer));
    assert.ok(!transcript.includes(credential));
    assert.deepEqual(requests, [
      { url: '/ords/fixture/oauth2/token', username: 'fixture', passwordMatches: true },
    ]);
  },
);

test(
  'native SQLcl initializes metadata binds offline without altering apostrophes',
  { skip: !available },
  async () => {
    const output = spawnSync(path.join(sqlclHome, 'bin/sql'), ['-S', '/nolog'], {
      cwd: tmpdir(),
      input: [
        'set define off',
        "variable p_text varchar2(1024) = 'O'Brien'",
        "variable p_literal varchar2(1024) = ''quoted' & value'",
        "variable p_empty varchar2(1024) = ''",
        'variable p_number number = 175',
        'variable p_zero number = 0',
        'variable p_negative number = -7',
        'variable p_decimal number = 1.25',
        'print p_text p_literal p_empty p_number p_zero p_negative p_decimal',
        'exit',
        '',
      ].join('\n'),
      encoding: 'utf8',
      timeout: 15000,
    });
    assert.equal(output.status, 0, output.stderr);
    assert.doesNotMatch(
      output.stdout + output.stderr,
      /ORA-|SP2-|Error|not connected|Substitution cancelled/i,
    );
    assert.match(output.stdout, /P_TEXT\s+-+\s+O'Brien/);
    assert.match(output.stdout, /P_LITERAL\s+-+\s+'quoted' & value/);
    assert.match(output.stdout, /P_EMPTY\s+-+\s+P_NUMBER/);
    assert.match(output.stdout, /P_NUMBER\s+-+\s+175/);
    assert.match(output.stdout, /P_ZERO\s+-+\s+0/);
    assert.match(output.stdout, /P_NEGATIVE\s+-+\s+-7/);
    assert.match(output.stdout, /P_DECIMAL\s+-+\s+1\.25/);
  },
);
