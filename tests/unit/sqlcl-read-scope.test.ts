import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { closeSqlclSessions, sqlclSessionStats } from '../../packages/core/src/sqlcl-session.ts';
import { withConnectedReads } from '../../packages/core/src/sqlcl-read-scope.ts';
import { WarmImportServer } from '../../packages/core/src/sqlcl-warm.ts';

// A stand-in for `sql ... -mcp`: records each start, answers PROMPT and SELECT lines,
// and refuses HOST only when it was started with a restriction level.
async function fixture(t: { after: (action: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-read-scope-'));
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
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(starts)}, args.join(' ') + '\\n');
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
   const commandConnect=/connect -name "([^"]+)"/.exec(sqlcl); if(commandConnect) connected=commandConnect[1];
   const lines=sqlcl.split('\\n').flatMap(l=>
     l.startsWith('host echo ')?[args.includes('-R')?'SP2-0738: Restricted command: not available':l.slice(10)]
     :l.startsWith('prompt ')?[l.slice(7)]
     :l.startsWith('select FAIL')?['ORA-00942: table or view does not exist']
     :l.startsWith('select ')?['{"results":[{"items":[{"n":1,"c":"'+connected+'"}]}]}']
     :l.startsWith('apex import')?['Import successful as '+connected]:[]);
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
    root,
    oracle,
    launcher,
    starts: async () => (await readFile(starts, 'utf8').catch(() => '')).split('\n').filter(Boolean),
  };
}
const connection = { kind: 'sqlcl-store', name: 'dev' } as const;

test(
  'reads of one operation share a connected server that closes with the operation',
  { skip: process.platform === 'win32' },
  async (t) => {
    const { oracle, starts } = await fixture(t);
    await withConnectedReads(async () => {
      assert.deepEqual(await oracle.jsonQuery('select 1 n from dual', connection), [{ n: 1, c: 'dev' }]);
      assert.deepEqual(await oracle.jsonQuery('select 2 n from dual', connection), [{ n: 1, c: 'dev' }]);
      // Nested scopes join the outer one.
      await withConnectedReads(() => oracle.jsonQuery('select 3 n from dual', connection));
      assert.deepEqual(await starts(), ['-mcp'], 'three reads, one server');
      // A failed batch closes the server; the next read starts a new one.
      await assert.rejects(oracle.jsonQuery('select FAIL from dual', connection), {
        code: 'ORACLE_COMMAND_FAILED',
      });
      assert.deepEqual(await oracle.jsonQuery('select 4 n from dual', connection), [{ n: 1, c: 'dev' }]);
      assert.deepEqual(await starts(), ['-mcp', '-mcp']);
      assert.equal(
        sqlclSessionStats().reduce((n, s) => n + s.sessions, 0),
        1,
      );
    });
    assert.deepEqual(sqlclSessionStats(), [], 'the scope closes its server');
  },
);

test('two operations never share a connected server', { skip: process.platform === 'win32' }, async (t) => {
  const { oracle, starts } = await fixture(t);
  await Promise.all([
    withConnectedReads(() => oracle.jsonQuery('select 1 n from dual', connection)),
    withConnectedReads(() => oracle.jsonQuery('select 1 n from dual', connection)),
  ]);
  assert.deepEqual(await starts(), ['-mcp', '-mcp']);
  assert.deepEqual(sqlclSessionStats(), []);
});

test(
  'a prepared import server runs one import and only when the restriction is enforced',
  { skip: process.platform === 'win32' },
  async (t) => {
    const { root, launcher, starts } = await fixture(t);
    const request = { executable: launcher, cwd: root, warmup: 'prompt warm' };
    const batch = {
      input: 'apex import -input x\nprompt DONE',
      connectionName: 'dev',
      completionMarker: 'DONE',
    };
    const restricted = new WarmImportServer({ ...request, restrictLevel: '2' });
    const result = await restricted.run(batch);
    assert.match(result!.stdout, /Import successful as dev\nDONE/);
    assert.equal(await restricted.run(batch), undefined, 'one server, one import');
    assert.deepEqual(await starts(), ['-R 2 -mcp']);
    // A server that executes HOST is never used: the caller runs the ordinary process.
    const unrestricted = new WarmImportServer({ ...request, restrictLevel: '2' });
    (unrestricted as unknown as { client: { text(r: unknown): string } }).client.text = () =>
      'APEXREST_RESTRICT_PROBE\n';
    assert.equal(await unrestricted.run(batch), undefined);
    await unrestricted.close();
    // Closed before use: nothing is submitted.
    const closed = new WarmImportServer({ ...request, restrictLevel: '2' });
    await closed.close();
    assert.equal(await closed.run(batch), undefined);
  },
);
