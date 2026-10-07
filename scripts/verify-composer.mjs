import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { sourceDigest, sha256 } from './lib/release.mjs';
const report = {
  schemaVersion: 1,
  timestamp: new Date().toISOString(),
  sourceDigest: await sourceDigest(),
  status: 'running',
  mock: false,
  qualification: 'offline-compiler',
  databaseEffects: [],
  nativeHost: false,
  command: 'npm run composer:verify',
};
await mkdir('docs/evidence', { recursive: true });
await writeFile('docs/evidence/composer-local.json', JSON.stringify(report, null, 2) + '\n');
await mkdir('.apexrest/composer-development/verify', { recursive: true });
await build({
  stdin: {
    contents: `
import path from 'node:path';
import {cp,readFile,mkdir} from 'node:fs/promises';
import {projectInit,resourceRoot} from './packages/core/src/project.ts';
import {loadProject} from './packages/core/src/config.ts';
import {writeJson,inventory} from './packages/core/src/fs.ts';
import {composePlan,composeMaterialize,composePlanInput} from './packages/core/src/composer/service.ts';
const fixture=path.resolve('.apexrest/composer-development/verify/fixture-'+Date.now());
const root=path.join(fixture,'project');
process.env.APEXREST_HOME=path.join(fixture,'managed');
await projectInit(root,'blank-app','composer-fixture');
const ctx=await loadProject(root);
await writeJson(path.join(process.env.APEXREST_HOME,'policy.json'),{schemaVersion:1,trustedProjects:[root],grants:[]});
await cp(path.join(resourceRoot(),'blueprints/crm-26.2.yaml'),path.join(root,'app.blueprint.yaml'));
const planned=await composePlan(ctx,composePlanInput.parse({out:'plans/compose.json'}));
if(planned.status!=='materializable') throw new Error(JSON.stringify(planned.diagnostics));
const applied=await composeMaterialize(ctx,{plan:'plans/compose.json',expectedDigest:planned.planDigest});
const repeated=await composePlan(ctx,composePlanInput.parse({out:'plans/repeat.json'}));
if(repeated.operations.length!==0) throw new Error('Repeated composition has a diff');
const noOp=await composeMaterialize(ctx,{plan:'plans/repeat.json',expectedDigest:repeated.planDigest});
if(noOp.status!=='no-op') throw new Error('Not idempotent');
await cp(path.join(resourceRoot(),'blueprints/service-desk-26.2.yaml'),path.join(root,'service-desk.yaml'));
const library=await composePlan(ctx,composePlanInput.parse({blueprint:'service-desk.yaml',out:'plans/library.json'}));
if(library.status!=='materializable') throw new Error(JSON.stringify(library.diagnostics));
await writeJson(path.resolve('.apexrest/composer-development/verify/result.json'),{schemaVersion:1,fixture:root,crm:planned,library,applied,noOp,qualification:'real local offline SQLcl compiler; no Oracle connection, SQL execution, import or authenticated application browser'});
console.log(JSON.stringify({status:'passed',fixture:root,planDigest:planned.planDigest,compiler:planned.compiler,libraryCompiler:library.compiler,noOp:noOp.status}));
`,
    resolveDir: process.cwd(),
  },
  outfile: '.apexrest/composer-development/verify/runner.mjs',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
});
const result = spawnSync(process.execPath, ['.apexrest/composer-development/verify/runner.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, APEXREST_RESOURCES: path.resolve('dist/resources') },
});
if (result.status === 0 && (await sourceDigest()) === report.sourceDigest) {
  const bytes = await readFile('.apexrest/composer-development/verify/result.json'),
    proof = JSON.parse(bytes);
  if (
    proof.crm.compiler.status !== 'passed' ||
    proof.library.compiler.status !== 'passed' ||
    proof.noOp.status !== 'no-op'
  )
    throw new Error('Composer proof is incomplete.');
  report.status = 'passed';
  report.resultSha256 = sha256(bytes);
  report.proof = proof;
} else {
  report.status = 'blocked';
  report.blocker =
    result.status === 0
      ? 'Sources changed during verification.'
      : 'Real Composer verification failed; inspect compiler diagnostics.';
}
await writeFile('docs/evidence/composer-local.json', JSON.stringify(report, null, 2) + '\n');
process.exitCode = report.status === 'passed' ? 0 : result.status || 1;
