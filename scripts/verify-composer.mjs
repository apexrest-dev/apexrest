import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
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
const root=path.resolve('.apexrest/composer-development/verify/fixture-'+Date.now());
process.env.APEXREST_HOME=path.join(root,'managed');
await projectInit(root,'blank-app','composer-fixture');
const ctx=await loadProject(root);
await writeJson(path.join(process.env.APEXREST_HOME,'policy.json'),{schemaVersion:1,trustedProjects:[root],grants:[]});
await cp(path.join(resourceRoot(),'blueprints/crm.yaml'),path.join(root,'app.blueprint.yaml'));
const planned=await composePlan(ctx,composePlanInput.parse({out:'plans/compose.json'}));
if(planned.status!=='materializable') throw new Error(JSON.stringify(planned.diagnostics));
const applied=await composeMaterialize(ctx,{plan:'plans/compose.json',expectedDigest:planned.planDigest});
const repeated=await composePlan(ctx,composePlanInput.parse({out:'plans/repeat.json'}));
if(repeated.operations.length!==0) throw new Error('Repeated composition has a diff');
const noOp=await composeMaterialize(ctx,{plan:'plans/repeat.json',expectedDigest:repeated.planDigest});
if(noOp.status!=='no-op') throw new Error('Not idempotent');
await cp(path.join(resourceRoot(),'blueprints/service-desk.yaml'),path.join(root,'service-desk.yaml'));
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
process.exitCode = result.status ?? 1;
