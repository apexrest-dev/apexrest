import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { sha256, files } from './lib/release.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export async function buildComposerCatalog(check = false) {
  await mkdir('.apexrest/composer-development/catalog', { recursive: true });
  await build({
    stdin: {
      contents: `
import path from 'node:path';import {readdir,readFile} from 'node:fs/promises';
import {inventory} from './packages/core/src/fs.ts';import {resourceRoot} from './packages/core/src/project.ts';
import {readDocument,semanticDigest} from './packages/core/src/composer/formats.ts';import{blockSchema,blueprintSchema}from'./packages/core/src/composer/schemas.ts';
const root=path.join(resourceRoot(),'blocks/packages'), entries=[];
const recipes=JSON.parse(await readFile(path.join(resourceRoot(),'components/index.json'),'utf8'));
async function scan(base,relative='') {for(const entry of await readdir(base,{withFileTypes:true})) if(entry.isDirectory()) {const folder=path.join(base,entry.name),p=relative?relative+'/'+entry.name:entry.name;try{const manifest=await readDocument(folder,'block.yaml',blockSchema);for(const ref of manifest.recipeRefs) if(!recipes.some(r=>r.id===ref)) throw new Error('Unresolved recipe '+ref);entries.push({path:'packages/'+p,digest:semanticDigest(await inventory(folder))});}catch(error){if(error.code==='ENOENT') await scan(folder,p);else throw error;}}}
await scan(root);entries.sort((a,b)=>a.path<b.path?-1:1);
const blueprints=JSON.parse(await readFile(path.join(resourceRoot(),'blueprints/index.json'),'utf8'));
for(const b of blueprints) await readDocument(path.join(resourceRoot(),'blueprints'),b.path,blueprintSchema);
console.log(JSON.stringify({schemaVersion:1,packages:entries}));
`,
      resolveDir: process.cwd(),
    },
    outfile: '.apexrest/composer-development/catalog/build.mjs',
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
  });
  const result = spawnSync(process.execPath, ['.apexrest/composer-development/catalog/build.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, APEXREST_RESOURCES: path.resolve('resources') },
  });
  if (result.status !== 0) throw new Error(result.stderr);
  const input = {};
  for (const file of await files('packages/core/src/composer'))
    input[file] = sha256(await readFile('packages/core/src/composer/' + file));
  const generator =
    JSON.stringify(
      { schemaVersion: 1, generatorVersion: '1', runtimeSourceDigest: sha256(JSON.stringify(input)) },
      null,
      2,
    ) + '\n';
  if (check) {
    if ((await readFile('resources/blocks/generator.json', 'utf8')) !== generator)
      throw new Error('Stale Composer generator identity; run npm run composer:catalog.');
  } else await writeFile('resources/blocks/generator.json', generator);
  const text = JSON.stringify(JSON.parse(result.stdout), null, 2) + '\n';
  if (check) {
    if ((await readFile('resources/blocks/manifest.json', 'utf8')) !== text)
      throw new Error('Stale Composer registry; run npm run composer:catalog.');
  } else await writeFile('resources/blocks/manifest.json', text);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await buildComposerCatalog(process.argv.includes('--check'));
