import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { environment, relativePath, refName, type Environment, type ProjectContext } from '../config.ts';
import { resolveConnection, type Connection } from '../connections.ts';
import { OracleAdapter } from '../oracle.ts';
import { metadataRead } from '../metadata.ts';
import { ArtifactService } from '../artifacts.ts';
import { atomicWrite, writeJson, exists, inventory, withLock } from '../fs.ts';
import { Fault } from '../result.ts';
import { blueprintSchema, digest, instanceSchema } from './schemas.ts';
import { snapshot, planComposition } from './planner.ts';
import { stagePlan, freeze, readPlan, materialize, recoveryPlan, journal } from './materializer.ts';
import { readDocument, safePath, semanticDigest, validate, canonical } from './formats.ts';
import { bundledBlueprintProfiles, loadCatalog } from './catalog.ts';
import { expression, predicateColumnNames, type MetadataSnapshot } from './binding.ts';
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

function checkMetadataCancellation(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new Fault('CANCELLED', 'Composer metadata verification cancelled.', 6, 'cancelled');
}

type MetadataKind = 'columns' | 'constraints' | 'constraint-columns' | 'signatures';
/** Rows per request page and the most rows one object may contribute to a composition. */
const METADATA_PAGE = 100;
const METADATA_OBJECT_LIMIT = 10000;
/** The metadata API answers at most this many scoped requests per target-verified batch. */
const METADATA_BATCH = 8;

const metadataKey = (kind: MetadataKind, name: string) => `${kind}:${name.toUpperCase()}`;

/**
 * Reads scoped dictionary metadata for several objects through the batched metadata API: duplicate
 * requests are read once, up to eight pages share one target-verified round trip, and only
 * requests with more rows ask for their next page. Rows keep the per-request order of
 * the single-object reads (keys upper-cased).
 */
export async function readMetadataBatch(
  oracle: OracleAdapter,
  env: Environment,
  connection: Connection,
  wanted: { kind: MetadataKind; name: string }[],
  signal?: AbortSignal,
): Promise<Map<string, Record<string, unknown>[]>> {
  const pending = new Map<string, { kind: MetadataKind; name: string; offset: number }>();
  const rows = new Map<string, Record<string, unknown>[]>();
  for (const request of wanted) {
    const key = metadataKey(request.kind, request.name);
    if (pending.has(key)) continue;
    pending.set(key, { kind: request.kind, name: request.name.toUpperCase(), offset: 0 });
    rows.set(key, []);
  }
  while (pending.size) {
    checkMetadataCancellation(signal);
    const chunk = [...pending.entries()].slice(0, METADATA_BATCH);
    const response = (await metadataRead(
      oracle,
      env,
      connection,
      {
        requests: chunk.map(([, request]) => ({
          kind: request.kind,
          name: request.name,
          schema: env.parsingSchema,
          offset: request.offset,
          limit: METADATA_PAGE,
        })),
      },
      false,
      signal,
    )) as { results?: { index: number; rows: Record<string, unknown>[]; nextOffset: number | null }[] };
    checkMetadataCancellation(signal);
    if (!Array.isArray(response.results) || response.results.length !== chunk.length)
      throw new Fault('METADATA_INVALID', 'Expected one scoped metadata result per request.', 5);
    for (const result of response.results) {
      const [key, request] = chunk[result.index] ?? [];
      if (!key || !request)
        throw new Fault('METADATA_INVALID', 'Metadata result does not match a request.', 5);
      const collected = rows.get(key)!;
      for (const row of result.rows)
        collected.push(
          Object.fromEntries(Object.entries(row).map(([name, value]) => [name.toUpperCase(), value])),
        );
      if (result.nextOffset === null) pending.delete(key);
      else if (collected.length >= METADATA_OBJECT_LIMIT)
        throw new Fault('METADATA_LIMIT', 'Object metadata exceeds the composition limit.', 5);
      else request.offset = result.nextOffset;
    }
  }
  return rows;
}

async function context(
  ctx: ProjectContext,
  blueprintFile: string,
  envName: string,
  oracle: OracleAdapter,
  signal?: AbortSignal,
): Promise<MetadataSnapshot> {
  const env = environment(ctx, envName),
    connection = await resolveConnection(env.readConnectionRef);
  const blueprint = await readDocument(ctx.root, blueprintFile, blueprintSchema);
  const result: MetadataSnapshot = { schema: env.parsingSchema, objects: {}, signatures: {} };
  const objects = [...new Set(Object.values(blueprint.entities).map((entity) => entity.read.object))];
  const packages = [...new Set(Object.values(blueprint.commands).map((command) => command.package))];
  const read = await readMetadataBatch(
    oracle,
    env,
    connection,
    [
      ...objects.flatMap((name) =>
        (['columns', 'constraints', 'constraint-columns'] as const).map((kind) => ({ kind, name })),
      ),
      ...packages.map((name) => ({ kind: 'signatures' as const, name })),
    ],
    signal,
  );
  for (const object of objects)
    result.objects[object] = {
      columns: read.get(metadataKey('columns', object))!,
      constraints: read.get(metadataKey('constraints', object))!,
      constraintColumns: read.get(metadataKey('constraint-columns', object))!,
    };
  for (const name of packages) result.signatures[name] = read.get(metadataKey('signatures', name))!;
  return result;
}

/** Rebind reviewed Composer predicates to the current target after any planned database scripts. */
export async function verifyDeploymentPredicates(
  ctx: ProjectContext,
  binding: { blueprintPath: string; blueprintDigest: string },
  env: Environment,
  connection: Connection,
  oracle: OracleAdapter,
  signal?: AbortSignal,
) {
  const blueprint = await readDocument(ctx.root, binding.blueprintPath, blueprintSchema);
  checkMetadataCancellation(signal);
  if (semanticDigest(blueprint) !== binding.blueprintDigest)
    throw new Fault('COMPOSITION_DRIFT', 'The reviewed Composer blueprint changed before import.', 5);

  const predicates = new Map<string, Set<string>>();
  for (const instance of Object.values(blueprint.blocks)) {
    if (instance.ownership === 'detached') continue;
    const ref = instance.bindings.records;
    const entity = ref.startsWith('entity:') ? blueprint.entities[ref.slice(7)] : undefined;
    const contract = entity && blueprint.contracts[entity.authorization.readContract];
    if (!entity || !contract || contract.kind !== 'authorization' || !contract.rowPredicate)
      throw new Fault('AUTH_CONTRACT_MISSING', 'A reviewed server row-read contract is required.', 5);
    const object = entity.read.object.toUpperCase();
    const checks = predicates.get(object) ?? new Set<string>();
    checks.add(contract.rowPredicate);
    predicates.set(object, checks);
  }
  const actual = predicates.size
    ? await readMetadataBatch(
        oracle,
        env,
        connection,
        [...predicates.keys()].map((name) => ({ kind: 'columns' as const, name })),
        signal,
      )
    : new Map<string, Record<string, unknown>[]>();
  for (const [object, checks] of predicates) {
    const rows = actual.get(metadataKey('columns', object))!;
    if (!rows.length)
      throw new Fault('OBJECT_BINDING_MISSING', `Oracle did not verify Composer object ${object}.`, 5);
    const columns = predicateColumnNames(rows);
    for (const predicate of checks) expression(predicate, { qualifiers: [object], columns });
  }
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
    request.mode === 'connected'
      ? await context(ctx, request.blueprint, request.env!, oracle, signal)
      : undefined;
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
    const profile = input!.blueprint.application.compatibilityProfile;
    try {
      requireComposerCompiler(profile, actual);
    } catch (error) {
      if (!(error instanceof Fault) || error.code !== 'PROFILE_COMPILER_MISMATCH') throw error;
      // Re-raise with the bundled blueprints that match the installed compiler.
      const blueprints = await bundledBlueprintProfiles().catch(() => ({}) as Record<string, string[]>);
      requireComposerCompiler(profile, actual, (id) => blueprints[id] ?? []);
    }
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
