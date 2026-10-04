import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { configureSqlcl, sqlclConfig } from '../../packages/core/src/sqlcl-config.ts';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { runSqlclMcp } from '../../packages/core/src/sqlcl-mcp.ts';
import type { ProcessResult } from '../../packages/core/src/process.ts';

const completed = (stdout: string): ProcessResult => ({
  code: 0,
  stdout,
  stderr: '',
  timedOut: false,
  cancelled: false,
  truncated: false,
});

test('mode persists without touching runtime, invalid configuration fails closed, active adapters keep their mode', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-sqlcl-config-'));
  const oldHome = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = root;
  t.after(async () => {
    if (oldHome === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = oldHome;
    await rm(root, { recursive: true, force: true });
  });
  await writeFile(path.join(root, 'runtime.json'), '{"sqlcl":"/fixture/sql"}\n');
  const initialRuntime = await readFile(path.join(root, 'runtime.json'), 'utf8');
  assert.equal((await sqlclConfig()).mode, 'cli');
  const active = new OracleAdapter();
  assert.equal((await active.settings()).mode, 'cli');
  await configureSqlcl('mcp', '1');
  assert.equal((await active.settings()).mode, 'cli');
  assert.equal((await new OracleAdapter().settings()).mode, 'mcp');
  await configureSqlcl('cli');
  assert.deepEqual(await sqlclConfig(), { schemaVersion: 1, mode: 'cli', mcpRestrictLevel: '1' });
  assert.equal(await readFile(path.join(root, 'runtime.json'), 'utf8'), initialRuntime);
  if (process.platform !== 'win32')
    assert.equal((await stat(path.join(root, 'sqlcl.json'))).mode & 0o777, 0o600);
  await writeFile(path.join(root, 'sqlcl.json'), '{"mode":"unsupported"}');
  await assert.rejects(sqlclConfig(), { code: 'INVALID_INPUT' });
});

test('adapter uses the selected MCP runner with exact names, safe environment and an end marker; never falls back', async () => {
  let cliCalls = 0;
  const oracle = new OracleAdapter(
    async () => {
      cliCalls++;
      return completed('unexpected');
    },
    'sql',
    async (request) => {
      assert.deepEqual(request.args, ['-mcp']);
      assert.equal(request.connectionName, 'Dev / Київ');
      assert.equal(request.mutation, false);
      assert.equal(request.env!.NODE_OPTIONS, undefined);
      assert.doesNotMatch(request.input!, /whenever/);
      assert.doesNotMatch(request.input!, /\nexit\n/);
      const marker = request.input!.match(/prompt (APEXREST_COMPLETE_\w+)/)![1];
      return completed(`{"results":[{"items":[{"n":1}]}]}\n${marker}\n`);
    },
  );
  oracle.settings = async () => ({
    schemaVersion: 1,
    mode: 'mcp',
    mcpRestrictLevel: '4',
    executable: 'sql',
    javaHome: undefined,
  });
  oracle.stage = async () => tmpdir();
  assert.deepEqual(
    await oracle.jsonQuery('select 1 n from dual', { kind: 'sqlcl-store', name: 'Dev / Київ' }),
    [{ n: 1 }],
  );
  assert.equal(cliCalls, 0);
  const incomplete = new OracleAdapter(
    async () => {
      cliCalls++;
      return completed('');
    },
    'sql',
    async (request) => {
      assert.deepEqual(request.args, ['-R', '1', '-mcp']);
      assert.match(request.input!, /whenever sqlerror exit failure rollback/);
      assert.match(request.input!, /\ncommit;\nprompt APEXREST_COMPLETE_/);
      return completed('partial');
    },
  );
  incomplete.settings = async () => ({ ...(await oracle.settings()), mcpRestrictLevel: '1' });
  await assert.rejects(incomplete.session('commit;', undefined, true, undefined, '/tmp'), {
    code: 'SQLCL_MCP_INCOMPLETE',
    status: 'outcome_unknown',
  });
  await assert.rejects(oracle.session('commit;', undefined, true, undefined, '/tmp'), {
    code: 'SQLCL_MCP_RESTRICTED',
    status: 'blocked',
  });
  assert.equal(cliCalls, 0);
});

// This is an explicit protocol fixture, not Oracle evidence. The real SQLcl
// handshake and offline compilation are recorded separately in local evidence.
test('MCP protocol supports legacy names, asynchronous results and confirmed errors; interruptions stay unknown', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-sqlcl-mcp-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const server = path.join(root, 'server.mjs');
  await writeFile(
    server,
    `
import {createInterface} from 'node:readline';
let polls=0;
const scenario=process.env.SCENARIO;
for await (const line of createInterface({input:process.stdin})) {
 const r=JSON.parse(line); if(r.id===undefined) continue;
 let result;
 if(r.method==='initialize') result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}};
 else if(r.method==='tools/list') result={tools:[
  {name:'run-sqlcl',inputSchema:{type:'object',properties:{sqlcl:{type:'string'},execution_type:{type:'string'}}}},
  {name:'connect',inputSchema:{type:'object',properties:{connection_name:{type:'string'}}}},
  {name:'request_status',inputSchema:{type:'object',properties:{tool_request_id:{type:'string'}}}}
 ]};
 else if(r.method==='tools/call') {
  const name=r.params.name;
  if(name==='connect') result=scenario==='auth-error'?{isError:true,content:[{type:'text',text:'ORA-01017: invalid credentials'}]}:{content:[{type:'text',text:'connected'}]};
  else if(name==='request_status') result=scenario==='async-text'?
   {content:[{type:'text',text:++polls===1?'RUNNING':'completed once'}]}:
   {content:[],structuredContent:++polls===1?{status:'RUNNING'}:{status:'FINISHED',result:{content:[{type:'text',text:'completed once'}]}}};
  else {
   if(scenario==='disconnect') process.exit(0);
   if(scenario==='hang') continue;
   result=scenario?.startsWith('async')?{content:[],structuredContent:{tool_request_id:'fixture-id'}}:
    {content:[{type:'text',text:scenario==='error'?'ORA-00942: missing table':r.params.arguments.sqlcl}],isError:scenario==='error'};
  }
 }
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,result})+'\\n');
}
`,
  );
  const request = {
    executable: process.execPath,
    args: [server],
    cwd: root,
    input: 'prompt marker',
    mutation: false,
    timeoutMs: 4000,
  };
  assert.equal((await runSqlclMcp(request)).stdout, 'prompt marker');
  assert.equal(
    (await runSqlclMcp({ ...request, env: { ...process.env, SCENARIO: 'async' } })).stdout,
    'completed once',
  );
  assert.equal((await runSqlclMcp({ ...request, env: { ...process.env, SCENARIO: 'error' } })).code, 1);
  assert.equal(
    (await runSqlclMcp({ ...request, env: { ...process.env, SCENARIO: 'async-text' } })).stdout,
    'completed once',
  );
  const auth = await runSqlclMcp({
    ...request,
    connectionName: 'exact name',
    env: { ...process.env, SCENARIO: 'auth-error' },
  });
  assert.equal(auth.code, 1);
  assert.match(auth.stdout, /ORA-01017/);
  await assert.rejects(
    runSqlclMcp({ ...request, mutation: true, env: { ...process.env, SCENARIO: 'disconnect' } }),
    { code: 'SQLCL_MCP_OUTCOME_UNKNOWN', status: 'outcome_unknown' },
  );
  const controller = new AbortController();
  const pending = runSqlclMcp({
    ...request,
    signal: controller.signal,
    env: { ...process.env, SCENARIO: 'hang' },
  });
  setTimeout(() => controller.abort(), 150);
  await assert.rejects(pending, { code: 'CANCELLED', status: 'cancelled' });
});

test('CLI script sessions run restricted at level 2 and private staging is removed after use', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-sqlcl-restrict-'));
  const oldHome = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = root;
  t.after(async () => {
    if (oldHome === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = oldHome;
    await rm(root, { recursive: true, force: true });
  });
  const seen: { args: string[]; cwd: string }[] = [];
  const oracle = new OracleAdapter(async (request) => {
    seen.push({ args: request.args, cwd: request.cwd! });
    return completed('done');
  });
  oracle.settings = async () => ({
    schemaVersion: 1,
    mode: 'cli',
    mcpRestrictLevel: '1',
    executable: 'sql',
    javaHome: undefined,
  });
  await oracle.session('select 1 from dual;');
  await oracle.restoreApplication(
    {
      kind: 'development',
      readConnectionRef: 'read',
      deployConnectionRef: 'deploy',
      workspace: 'FIXTURE',
      parsingSchema: 'FIXTURE',
      applicationId: 123,
      baseUrl: 'https://fixture.example.com/ords/',
      databaseIdentity: { dbUniqueName: 'fixture', serviceName: 'fixture' },
      allowedOrigins: [],
    },
    undefined as never,
    path.join(root, 'f123.sql'),
  );
  assert.equal(seen[0]!.args.includes('-R'), false);
  const restricted = seen.find((call) => call.args.includes('-R'));
  assert.ok(restricted, 'restore runs restricted');
  assert.equal(restricted.args[restricted.args.indexOf('-R') + 1], '2');
  await oracle.session('@"script.sql"', undefined, false, undefined, undefined, 'text', '2');
  const last = seen.at(-1)!;
  assert.deepEqual(last.args.slice(0, 4), ['-S', '-L', '-R', '2']);
  // Self-created staging is removed; caller-owned or foreign directories never are.
  for (const call of seen) await assert.rejects(stat(call.cwd), { code: 'ENOENT' });
  await oracle.discardStage(tmpdir());
  await stat(tmpdir());
  const owned = await oracle.stage();
  await oracle.discardStage(owned);
  await assert.rejects(stat(owned), { code: 'ENOENT' });
});
