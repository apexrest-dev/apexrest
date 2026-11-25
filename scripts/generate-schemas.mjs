import { build } from 'esbuild';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storeSchemas } from './lib/schema-storage.mjs';

export async function generateSchemas({ check = false } = {}) {
  await mkdir('.apexrest/schema-build', { recursive: true, mode: 0o700 });
  const directory = await mkdtemp('.apexrest/schema-build/run-');
  const runner = path.join(directory, 'generate.mjs');
  try {
    await build({
      stdin: {
        contents: `import {z} from 'zod';import {projectSchema,policySchema} from './packages/core/src/config.ts';import{deployPlanSchema}from'./packages/core/src/deploy.ts';import{syncStateSchema}from'./packages/core/src/sync.ts';import * as composer from './packages/core/src/composer/schemas.ts';import{schemas}from'./packages/core/src/operations.ts';import{lockSchema}from'./packages/installer/src/toolchain.ts';import{entityContractSchema}from'./packages/core/src/entities.ts';console.log(JSON.stringify({...Object.fromEntries(Object.entries(composer).filter(([k])=>k.endsWith('Schema')).map(([k,s])=>['composer-'+k.replace(/Schema$/,'').replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),z.toJSONSchema(s,{io:'input'})])),project: z.toJSONSchema(projectSchema,{io:'input'}), policy:z.toJSONSchema(policySchema,{io:'input'}), 'sync-state':z.toJSONSchema(syncStateSchema,{io:'input'}), 'deploy-plan':z.toJSONSchema(deployPlanSchema,{io:'input'}), 'toolchain-lock':z.toJSONSchema(lockSchema,{io:'input'}), 'entity-contract':z.toJSONSchema(entityContractSchema,{io:'input'}), operations:Object.fromEntries(Object.entries(schemas).map(([k,s])=>[k,z.toJSONSchema(s,{io:'input'})]))}));`,
        resolveDir: process.cwd(),
      },
      outfile: runner,
      bundle: true,
      platform: 'node',
      format: 'esm',
      packages: 'external',
    });
    const result = spawnSync(process.execPath, [runner], {
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.status !== 0)
      throw new Error(result.error?.message || result.stderr || 'Schema generation failed.');
    return await storeSchemas(JSON.parse(result.stdout), { check });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await generateSchemas({ check: process.argv.includes('--check') })));
