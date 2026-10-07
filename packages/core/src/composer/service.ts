import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { environment, relativePath, refName, type ProjectContext } from '../config.ts';
import { resolveConnection } from '../connections.ts';
import { OracleAdapter } from '../oracle.ts';
import { metadataRead } from '../metadata.ts';
import { ArtifactService } from '../artifacts.ts';
import { atomicWrite, writeJson, exists, inventory, withLock } from '../fs.ts';
import { Fault } from '../result.ts';
import { blueprintSchema, digest, instanceSchema } from './schemas.ts';
import { snapshot, planComposition } from './planner.ts';
import { stagePlan, freeze, readPlan, materialize, recoveryPlan, journal } from './materializer.ts';
import { readDocument, safePath, semanticDigest, validate, canonical } from './formats.ts';
import { loadCatalog } from './catalog.ts';
import type { MetadataSnapshot } from './binding.ts';
import { requireComposerCompiler } from './profiles.ts';

export const composePlanInput = z.strictObject({
  project: z.string().min(1).max(4096).optional(),
  blueprint: relativePath.default('app.blueprint.yaml'),
  out: relativePath,
  mode: z.enum(['offline', 'connected']).default('offline'),
  env: refName.optional(),
  validation: z.enum(['compiler', 'source-only']).default('compiler'),
  action: z.enum(['compose', 'recover-resume', 'recover-restore']).default('compose'),
});
export const composeMaterializeInput = z.strictObject({
  project: z.string().min(1).max(4096).optional(),
  plan: relativePath.optional(),
  artifactId: z.uuid().optional(),
  expectedDigest: digest,
});
export type PlanInput = z.infer<typeof composePlanInput>;
async function context(
  ctx: ProjectContext,
  blueprintFile: string,
  envName: string,
  oracle: OracleAdapter,
): Promise<MetadataSnapshot> {
  const env = environment(ctx, envName),
    connection = await resolveConnection(env.readConnectionRef);
  const blueprint = await readDocument(ctx.root, blueprintFile, blueprintSchema);
  const result: MetadataSnapshot = { schema: env.parsingSchema, objects: {}, signatures: {} };
  async function read(kind: 'columns' | 'constraints' | 'constraint-columns' | 'signatures', name: string) {
    const rows: Record<string, unknown>[] = [];
    let offset = 0;
    while (rows.length < 10000) {
      const response = await metadataRead(oracle, env, connection, {
        kind,
        name,
        schema: env.parsingSchema,
        offset,
        limit: 100,
      });
      if (!('rows' in response))
        throw new Fault('METADATA_INVALID', 'Expected one scoped metadata result.', 5);
      rows.push(...response.rows);
      if (response.nextOffset === null) return rows;
      offset = response.nextOffset;
    }
    throw new Fault('METADATA_LIMIT', 'Object metadata exceeds the composition limit.', 5);
  }
  for (const entity of Object.values(blueprint.entities))
    if (!result.objects[entity.read.object])
      result.objects[entity.read.object] = {
        columns: await read('columns', entity.read.object),
        constraints: await read('constraints', entity.read.object),
        constraintColumns: await read('constraint-columns', entity.read.object),
      };
  for (const command of Object.values(blueprint.commands))
    if (!result.signatures[command.package])
      result.signatures[command.package] = await read('signatures', command.package);
  return result;
}
export async function composePlan(
  ctx: ProjectContext,
  request: PlanInput,
  oracle = new OracleAdapter(),
  signal?: AbortSignal,
) {
  if (request.validation === 'source-only' && !ctx.config.composer?.allowSourceOnly)
    throw new Fault(
      'SOURCE_ONLY_POLICY_REQUIRED',
      'Source-only composition requires explicit project composer.allowSourceOnly policy.',
      4,
    );
  if (request.mode === 'connected' && !request.env)
    throw new Fault('ENVIRONMENT_REQUIRED', 'Connected planning requires --env.', 2);
  if (request.action !== 'compose' && request.mode !== 'offline')
    throw new Fault('INVALID_INPUT', 'Local recovery has no connected mode.', 2);
  const pending = await journal(ctx);
  if (request.action === 'compose' && pending && pending.phase !== 'completed')
    throw new Fault(
      'RECOVERY_REQUIRED',
      'Create an explicit recovery plan for the interrupted composition.',
      5,
    );
  const metadata =
    request.mode === 'connected' ? await context(ctx, request.blueprint, request.env!, oracle) : undefined;
  const input =
    request.action === 'compose'
      ? await snapshot(ctx, request.blueprint, {
          mode: request.mode,
          validation: request.validation,
          ...(request.env ? { environment: request.env } : {}),
          ...(metadata ? { metadata } : {}),
        })
      : null;
  const plan = input
    ? planComposition(input)
    : await recoveryPlan(ctx, request.action === 'recover-resume' ? 'resume' : 'restore');
  let compiler: unknown = {
    status: 'not-run',
    reason: request.action === 'compose' ? 'Source-only or blocked draft.' : 'Local journal recovery.',
  };
  let compilerValidated = false;
  if (plan.status === 'materializable' && request.action === 'compose' && request.validation === 'compiler') {
    const staged = await stagePlan(ctx, plan);
    compiler = await oracle.validate(staged.directory, signal);
    const actual = compiler as { mmd: { mmdVersion: string }; compiler: { version: string } };
    requireComposerCompiler(input!.blueprint.application.compatibilityProfile, actual);
    compilerValidated = true;
  }
  if (metadata)
    await writeJson(
      await safePath(ctx.root, `.apexrest/composer/contexts/${plan.contextDigest}.json`),
      metadata,
    );
  await freeze(ctx, plan, request.out);
  const artifactId = await new ArtifactService(ctx).saveJson(plan, 'composition-plan');
  await writeJson(await safePath(ctx.root, `.apexrest/composer/plan-artifacts/${artifactId}.json`), {
    digest: plan.digest,
    file: `.apexrest/composer/plans/${plan.digest}.json`,
  });
  return {
    status: plan.status,
    kind: plan.kind,
    plan: request.out,
    planDigest: plan.digest,
    artifactId,
    diagnostics: plan.diagnostics,
    operations: plan.operations.map(({ path, reason, before, after }) => ({ path, reason, before, after })),
    allocationCount: Object.keys(plan.allocations).length,
    compiler,
    databaseEffects: [],
    qualification: compilerValidated ? 'offline-compiler' : 'unverified',
    nextActions:
      plan.status === 'materializable'
        ? ['Review the plan, then materialize using its exact digest.']
        : ['Resolve the reported binding or ownership diagnostics.'],
  };
}
export async function composeMaterialize(
  ctx: ProjectContext,
  request: z.infer<typeof composeMaterializeInput>,
  signal?: AbortSignal,
) {
  if (Boolean(request.plan) === Boolean(request.artifactId))
    throw new Fault('INVALID_INPUT', 'Supply exactly one plan path or registered artifact ID.', 2);
  let file = request.plan;
  if (request.artifactId) {
    const ref = JSON.parse(
      await readFile(
        await safePath(ctx.root, `.apexrest/composer/plan-artifacts/${request.artifactId}.json`),
        'utf8',
      ),
    ) as { digest: string; file: string };
    if (ref.digest !== request.expectedDigest)
      throw new Fault('PLAN_TAMPERED', 'Artifact and expected plan digest differ.', 5);
    file = ref.file;
  }
  return materialize(ctx, await readPlan(ctx, file!, request.expectedDigest), signal ? { signal } : {});
}
export async function blueprintAdd(
  ctx: ProjectContext,
  file: string,
  instanceId: string,
  instance: unknown,
  expectedDigest: string,
  apply = false,
) {
  const blueprint = await readDocument(ctx.root, file, blueprintSchema);
  if (semanticDigest(blueprint) !== expectedDigest)
    throw new Fault('BLUEPRINT_CONFLICT', 'Blueprint changed while editing catalog parameters.', 5);
  if (blueprint.blocks[instanceId]) throw new Fault('INSTANCE_EXISTS', 'Choose a new instance identity.', 5);
  const block = validate(instanceSchema, instance),
    catalog = await loadCatalog(ctx.root);
  if (!catalog.packages.has(block.use))
    throw new Fault('PACKAGE_NOT_AVAILABLE_OFFLINE', 'Unknown block version.', 3);
  const next = validate(blueprintSchema, {
    ...blueprint,
    blocks: { ...blueprint.blocks, [instanceId]: block },
  });
  const content = JSON.stringify(next, null, 2) + '\n';
  if (apply) {
    // A second read detects concurrent UI/filesystem edits immediately before the write.
    if (semanticDigest(await readDocument(ctx.root, file, blueprintSchema)) !== expectedDigest)
      throw new Fault('BLUEPRINT_CONFLICT', 'Concurrent blueprint edit.', 5);
    await withLock(await safePath(ctx.root, '.apexrest/composer/ownership.lock'), async () => {
      if (semanticDigest(await readDocument(ctx.root, file, blueprintSchema)) !== expectedDigest)
        throw new Fault('BLUEPRINT_CONFLICT', 'Concurrent blueprint edit.', 5);
      await atomicWrite(await safePath(ctx.root, file), content);
    });
  }
  return {
    applied: apply,
    expectedDigest,
    nextDigest: semanticDigest(next),
    before: canonical(blueprint),
    after: content,
    databaseEffects: [],
  };
}
