import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
await mkdir('.apexrest/composer-development/author', { recursive: true });
await build({
  stdin: {
    contents: `
import path from 'node:path';import{mkdir,readFile,cp}from'node:fs/promises';
import{parseArgs}from'node:util';import{blockSchema}from'./packages/core/src/composer/schemas.ts';
import{readDocument,safePath,semanticDigest}from'./packages/core/src/composer/formats.ts';
import{validateAuthoredBlock}from'./packages/core/src/composer/catalog.ts';import{declarations}from'./packages/core/src/composer/reader.ts';
import{atomicWrite,writeJson,exists,inventory}from'./packages/core/src/fs.ts';
const{values:v}=parseArgs({options:{id:{type:'string'},version:{type:'string'},source:{type:'string'},out:{type:'string'},license:{type:'string'},page:{type:'string'},review:{type:'boolean',default:false}},strict:true});
if(!v.source||!v.out||!v.license)throw new Error('Use --source PACKAGE --out LOCAL_PACKAGE --license SPDX [--page APX] [--review]. Rights review is the maintainer responsibility.');
const source=await safePath(process.cwd(),v.source),out=await safePath(process.cwd(),v.out);
const authored=await validateAuthoredBlock(source);
if(await exists(out))throw new Error('Output must be new; versions are immutable.');
await mkdir(out,{recursive:true,mode:0o700});await cp(source,out,{recursive:true});
const manifest=blockSchema.parse({...authored.manifest,...(v.id?{id:v.id}:{}),...(v.version?{version:v.version}:{}),status:'draft',license:v.license,origin:'local-reviewed-author',limitations:[...authored.manifest.limitations,'Capture is draft; application-specific source is evidence only until reviewed adaptation.']});
await writeJson(path.join(out,'block.yaml'),manifest);
if(v.page){const page=await safePath(process.cwd(),v.page),raw=await readFile(page,'utf8');
 if(/password|token=|https?:\\/\\/|\\/Users\\/|authentication|authorization|applicationId|workspaceId/i.test(raw))throw new Error('Private/source security data found; do not redistribute.');
 const nodes=declarations(raw);await writeJson(path.join(out,'capture.json'),{schemaVersion:1,sourceDigest:semanticDigest(await inventory(source)),declarations:nodes.map(({kind,key,depth,digest})=>({kind,key,depth,digest})),normalization:'Application page IDs and security settings are excluded. Bind datasets, API and authorization explicitly in blueprint.'});
}
const checked=await validateAuthoredBlock(out);
if(v.review){const root=process.cwd(),policyPath=await safePath(root,'.apexrest-composer/registry-policy.json');const policy=await exists(policyPath)?JSON.parse(await readFile(policyPath,'utf8')):{schemaVersion:1,reviewedPackages:{}};policy.reviewedPackages[manifest.id+'@'+manifest.version]=checked.digest;await writeJson(policyPath,policy);}
console.log(JSON.stringify({status:'draft',id:manifest.id+'@'+manifest.version,digest:checked.digest,qualification:'not-run',databaseEffects:[],requires:'Run schema, compiler and separately authorized runtime qualification; review license/provenance.'}));
`,
    resolveDir: process.cwd(),
  },
  outfile: '.apexrest/composer-development/author/run.mjs',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
});
const result = spawnSync(
  process.execPath,
  ['.apexrest/composer-development/author/run.mjs', ...process.argv.slice(2)],
  { stdio: 'inherit', env: { ...process.env, APEXREST_RESOURCES: path.resolve('resources') } },
);
process.exitCode = result.status ?? 1;
