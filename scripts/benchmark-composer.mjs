import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
await mkdir('.apexrest/composer-development/benchmark', { recursive: true });
await build({
  stdin: {
    contents: `
import path from 'node:path';import{readFile,rm}from'node:fs/promises';
import{fixture}from'./tests/fixtures/project.ts';import{writeJson}from'./packages/core/src/fs.ts';
import{snapshot,planComposition}from'./packages/core/src/composer/planner.ts';import{catalogSearch,catalogRead}from'./packages/core/src/composer/catalog.ts';
const{ctx}=await fixture();const blueprint=JSON.parse(await readFile('tests/fixtures/composer/crm.blueprint.yaml','utf8'));
await writeJson(path.join(ctx.root,'app.blueprint.yaml'),blueprint);
const samples=[],digests=[];for(let i=0;i<10;i++){const start=performance.now();const plan=planComposition(await snapshot(ctx,'app.blueprint.yaml',{validation:'source-only'}));if(plan.status!=='materializable')throw new Error(JSON.stringify(plan.diagnostics));samples.push(performance.now()-start);digests.push(plan.digest);}
if(new Set(digests).size!==1) throw new Error('Cold/warm semantic drift');
const judged=[['CRUD','block:crud/report-dialog@1.0.0'],['форма','block:crud/report-dialog@1.0.0'],['підсумки','block:analytics/status-summary@1.0.0'],['timeline','block:read/history@1.0.0'],['відбір','block:read/filtered-list@1.0.0'],['master detail','block:read/master-detail@1.0.0']];
const queryResults=[];for(const[query,expected]of judged){const start=performance.now(),found=await catalogSearch(query);queryResults.push({query,expected,actual:found.results[0]?.id,correct:found.results[0]?.id===expected,latencyMs:performance.now()-start,bytes:Buffer.byteLength(JSON.stringify(found))});}
const manifest=await catalogRead('block:crud/report-dialog@1.0.0',0,8192),ordered=[...samples].sort((a,b)=>a-b);
const report={schemaVersion:1,scope:'local API workflow harness; no native agent reasoning or billing measurement',node:process.version,platform:process.platform,iterations:samples.length,coldMs:samples[0],warmMedianMs:ordered[5],p95Ms:ordered[9],deterministic:true,queries:queryResults,precisionAt1:queryResults.filter(q=>q.correct).length/queryResults.length,detailBytes:Buffer.byteLength(JSON.stringify(manifest)),databaseCalls:0,billingTokens:'not-measured'};
await writeJson(path.resolve('.apexrest/composer-development/benchmark/result.json'),report);console.log(JSON.stringify(report));await rm(ctx.root,{recursive:true,force:true});
`,
    resolveDir: process.cwd(),
  },
  outfile: '.apexrest/composer-development/benchmark/run.mjs',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
});
const result = spawnSync(process.execPath, ['.apexrest/composer-development/benchmark/run.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, APEXREST_RESOURCES: path.resolve('resources') },
});
process.exitCode = result.status ?? 1;
