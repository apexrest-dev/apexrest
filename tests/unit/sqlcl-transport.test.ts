import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { configureSqlcl, sqlclConfig } from '../../packages/core/src/sqlcl-config.ts';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { runSqlclMcp } from '../../packages/core/src/sqlcl-mcp.ts';
import { closeSqlclSessions, sqlclSessionStats } from '../../packages/core/src/sqlcl-session.ts';
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
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
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

// Pooled path: one SQLcl server per key stays alive between batches; an
// interrupted command kills its server and the next call starts a fresh one.
async function pooledFixture(t: { after: (action: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-sqlcl-pool-'));
  const oldHome = process.env.APEXREST_HOME;
  process.env.APEXREST_HOME = root;
  t.after(async () => {
    await closeSqlclSessions();
    if (oldHome === undefined) delete process.env.APEXREST_HOME;
    else process.env.APEXREST_HOME = oldHome;
    await rm(root, { recursive: true, force: true });
  });
  const server = path.join(root, 'server.mjs');
  const starts = path.join(root, 'starts');
  await writeFile(
    server,
    `
import {createInterface} from 'node:readline';
import {appendFileSync} from 'node:fs';
appendFileSync(${JSON.stringify(starts)}, process.argv.slice(2).join(' ') + '\\n');
let connected = '';
for await (const line of createInterface({input:process.stdin})) {
 const r=JSON.parse(line); if(r.id===undefined) continue;
 let result;
 if(r.method==='initialize') result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}};
 else if(r.method==='tools/list') result={tools:[
  {name:'sqlcl_run',inputSchema:{type:'object',properties:{sqlcl:{type:'string'},execution_type:{type:'string'}}}},
  {name:'connect',inputSchema:{type:'object',properties:{connection_name:{type:'string'}}}}
 ]};
 else if(r.method==='tools/call') {
  const name=r.params.name;
  if(name==='connect') { connected=r.params.arguments.connection_name; result={content:[{type:'text',text:'connected'}]}; }
  else {
   const sqlcl=r.params.arguments.sqlcl;
   if(sqlcl.includes('HANG')) continue;
   if(sqlcl.includes('CRASH')) process.exit(1);
   if(sqlcl.includes('ORA_FAILURE')) { process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,result:{isError:true,content:[{type:'text',text:'ORA-03113: lost connection'}]}})+'\\n'); continue; }
   if(sqlcl.includes('INCOMPLETE')) { process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,result:{content:[{type:'text',text:'no confirmation'}]}})+'\\n'); continue; }
   const lines=sqlcl.split('\\n').flatMap(l=>l.startsWith('prompt ')?[l.slice(7)]:l.startsWith('select ')?['{"results":[{"items":[{"n":1,"c":"'+connected+'"}]}]}']:[]);
   result={content:[{type:'text',text:lines.join('\\n')+'\\n'}]};
  }
 }
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,result})+'\\n');
}
`,
  );
  const launcher = path.join(root, 'sql');
  await writeFile(launcher, `#!/bin/sh\nexec "${process.execPath}" "${server}" "$@"\n`, { mode: 0o755 });
  const oracle = new OracleAdapter();
  oracle.settings = async () => ({
    schemaVersion: 1,
    mode: 'cli',
    mcpRestrictLevel: '4',
    executable: launcher,
    javaHome: undefined,
  });
  return {
    oracle,
    launcher,
    starts: async () => (await readFile(starts, 'utf8').catch(() => '')).split('\n').filter(Boolean),
  };
}

test(
  'offline CLI sessions reuse one pooled SQLcl server and recover from interrupted commands',
  { skip: process.platform === 'win32' },
  async (t) => {
    const { oracle, starts } = await pooledFixture(t);
    const first = await oracle.session('prompt hello');
    assert.equal(first.output, 'hello');
    const second = await oracle.session('prompt again');
    assert.equal(second.output, 'again');
    assert.deepEqual(await starts(), ['-mcp']);
    assert.equal(
      sqlclSessionStats().reduce((n, s) => n + s.sessions, 0),
      1,
    );
    // Concurrent offline work may open a second server; never more than the limit.
    await Promise.all([oracle.session('prompt a'), oracle.session('prompt b'), oracle.session('prompt c')]);
    assert.ok((await starts()).length <= 2);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    await assert.rejects(oracle.session('prompt HANG', undefined, false, controller.signal), {
      code: 'CANCELLED',
      status: 'cancelled',
    });
    await assert.rejects(oracle.session('prompt CRASH', undefined, true), { status: 'outcome_unknown' });
    const before = (await starts()).length;
    assert.equal((await oracle.session('prompt fresh')).output, 'fresh');
    assert.ok((await starts()).length > before - 2, 'a killed server is replaced');
    // Restricted offline sessions get their own server with the restrict flag.
    await oracle.session('prompt restricted', undefined, false, undefined, undefined, 'text', '2');
    assert.ok((await starts()).includes('-R 2 -mcp'));
    await closeSqlclSessions();
    assert.deepEqual(sqlclSessionStats(), []);
  },
);

test(
  'MCP mode isolates connected batches and answers a query batch in one session',
  { skip: process.platform === 'win32' },
  async (t) => {
    const { oracle, starts } = await pooledFixture(t);
    const settings = await oracle.settings();
    oracle.settings = async () => ({ ...settings, mode: 'mcp' });
    const connection = { kind: 'sqlcl-store', name: 'fixture-dev' } as const;
    assert.deepEqual(await oracle.jsonQuery('select 1 n from dual', connection), [
      { n: 1, c: 'fixture-dev' },
    ]);
    assert.deepEqual(
      await oracle.jsonQueryBatch(
        [{ sql: 'select 1 n from dual' }, { sql: 'select 2 n from dual' }],
        connection,
      ),
      [[{ n: 1, c: 'fixture-dev' }], [{ n: 1, c: 'fixture-dev' }]],
    );
    await oracle.jsonQuery('select 1 n from dual', { kind: 'sqlcl-store', name: 'fixture-other' });
    const started = await starts();
    assert.equal(started.filter((args) => args === '-mcp').length, 3, 'fresh server per connected batch');
  },
);

test(
  'failed or incomplete batches discard their servers before the next call',
  { skip: process.platform === 'win32' },
  async (t) => {
    const { oracle, starts } = await pooledFixture(t);
    for (const [input, code] of [
      ['prompt ORA_FAILURE', 'ORACLE_COMMAND_FAILED'],
      ['prompt INCOMPLETE', 'SQLCL_MCP_INCOMPLETE'],
    ] as const) {
      await assert.rejects(oracle.session(input), { code });
      const before = (await starts()).length;
      assert.equal((await oracle.session('prompt recovered')).output, 'recovered');
      assert.equal((await starts()).length, before + 1);
      await closeSqlclSessions();
    }
  },
);

test(
  'connected mutation batches start fresh, reset state and close after completion',
  { skip: process.platform === 'win32' },
  async (t) => {
    const { oracle, starts } = await pooledFixture(t);
    const settings = await oracle.settings();
    oracle.settings = async () => ({ ...settings, mode: 'mcp', mcpRestrictLevel: '1' });
    const connection = { kind: 'sqlcl-store', name: 'fixture-dev' } as const;
    await oracle.session('prompt changed', connection, true);
    assert.deepEqual(sqlclSessionStats(), []);
    await oracle.session('prompt another', connection, true);
    assert.equal((await starts()).length, 2);
    await assert.rejects(
      oracle.session('prompt script', connection, true, undefined, undefined, 'text', '2'),
      { code: 'SQLCL_MCP_SCRIPT_RESTRICT_UNAVAILABLE' },
    );
    assert.equal((await starts()).length, 2, 'refused before opening a server');
  },
);

test(
  'closing a pool wakes queued callers instead of hanging',
  { skip: process.platform === 'win32' },
  async (t) => {
    const { oracle } = await pooledFixture(t);
    const first = oracle.session('prompt HANG').catch((error: unknown) => error);
    const second = oracle.session('prompt HANG').catch((error: unknown) => error);
    for (let i = 0; i < 100 && !sqlclSessionStats().some((s) => s.busy === 2); i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    assert.ok(sqlclSessionStats().some((s) => s.busy === 2));
    const waiting = oracle.session('prompt waiting').catch((error: unknown) => error);
    for (let i = 0; i < 100 && !sqlclSessionStats().some((s) => s.waiting); i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    assert.ok(sqlclSessionStats().some((s) => s.waiting));
    await closeSqlclSessions();
    const results = await Promise.all([first, second, waiting]);
    assert.equal((results[2] as { code: string }).code, 'CANCELLED');
  },
);

const localSqlcl = '/Users/oleksii/sqlcl/bin/sql';
const localJava = (() => {
  try {
    const base = '/Users/oleksii/.apexrest/toolchains/java';
    for (const version of readdirSync(base))
      for (const dist of readdirSync(path.join(base, version)))
        if (existsSync(path.join(base, version, dist, 'Contents/Home/bin/java')))
          return path.join(base, version, dist, 'Contents/Home');
  } catch {
    // No managed runtime on this machine.
  }
  return undefined;
})();
test(
  'real local SQLcl: pooled offline validate reuses one JVM',
  { skip: !existsSync(localSqlcl) || !localJava },
  async (t) => {
    const root = await mkdtemp(path.join(tmpdir(), 'apexrest-sqlcl-real-'));
    const oldHome = process.env.APEXREST_HOME;
    process.env.APEXREST_HOME = root;
    t.after(async () => {
      await closeSqlclSessions();
      if (oldHome === undefined) delete process.env.APEXREST_HOME;
      else process.env.APEXREST_HOME = oldHome;
      await rm(root, { recursive: true, force: true });
    });
    const oracle = new OracleAdapter();
    oracle.settings = async () => ({
      schemaVersion: 1,
      mode: 'cli',
      mcpRestrictLevel: '4',
      executable: localSqlcl,
      javaHome: localJava,
    });
    const generated = await oracle.generate('Pool Fixture', 'pool_fixture');
    const timings: number[] = [];
    for (let i = 0; i < 3; i++) {
      const started = Date.now();
      assert.equal((await oracle.validate(generated.directory)).status, 'passed');
      timings.push(Date.now() - started);
    }
    assert.equal(
      sqlclSessionStats().reduce((n, s) => n + s.sessions, 0),
      1,
    );
    assert.ok(timings[2]! < 1500, `warm validate took ${timings[2]} ms`);
    await rm(generated.directory, { recursive: true, force: true });
  },
);
