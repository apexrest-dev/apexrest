import { readFile, readdir } from 'node:fs/promises';
import { hash, inventory, exists } from '../fs.ts';
import type { ProjectContext } from '../config.ts';
import { Fault } from '../result.ts';
import {
  blueprintSchema,
  stateSchema,
  type Blueprint,
  type CompositionState,
  type CompositionPlan,
  type Owner,
  type Allocation,
} from './schemas.ts';
import { readDocument, semanticDigest, safePath, planDigest, validate } from './formats.ts';
import { loadCatalog, resolvePackages, type Catalog } from './catalog.ts';
import { inventorySymbols, declarations, threeWay } from './reader.ts';
import { bind, type MetadataSnapshot } from './binding.ts';
import { render } from './emitter.ts';

export interface Snapshot {
  blueprint: Blueprint;
  blueprintPath: string;
  catalog: Catalog;
  state: CompositionState | null;
  sources: Record<string, string>;
  sourceInventory: Record<string, string>;
  bases: Record<string, string>;
  configurationDigest: string;
  toolchainDigest: string;
  sourceDir: string;
  projectId: string;
  mode: 'offline' | 'connected';
  environment: string | null;
  metadata: MetadataSnapshot | null;
  validation: 'compiler' | 'source-only';
}
export async function snapshot(
  ctx: ProjectContext,
  blueprintPath: string,
  options: {
    mode?: 'offline' | 'connected';
    environment?: string;
    metadata?: MetadataSnapshot;
    validation?: 'compiler' | 'source-only';
  } = {},
): Promise<Snapshot> {
  const root = await safePath(ctx.root, ctx.config.application.sourceDir),
    sourceInventory = await inventory(root);
  const sources: Record<string, string> = {};
  for (const file of Object.keys(sourceInventory).filter((file) => file.endsWith('.apx'))) {
    const bytes = await readFile(await safePath(root, file)),
      text = bytes.toString('utf8');
    if (!Buffer.from(text).equals(bytes))
      throw new Fault('TRANSFORM_UNSUPPORTED', 'Source must be valid UTF-8.', 5);
    sources[file] = text;
  }
  const stateFile = await safePath(ctx.root, '.apexrest-composer/state.json');
  const state = (await exists(stateFile))
    ? await readDocument(ctx.root, '.apexrest-composer/state.json', stateSchema)
    : null;
  const bases: Record<string, string> = {};
  const baseRoot = await safePath(ctx.root, '.apexrest-composer/bases');
  if (await exists(baseRoot))
    for (const entry of await readdir(baseRoot)) {
      if (!/^[a-f0-9]{64}\.apx$/.test(entry))
        throw new Fault('GENERATION_BASE_CORRUPT', 'Unexpected generated base entry.', 5);
      const bytes = await readFile(await safePath(baseRoot, entry)),
        digest = entry.slice(0, -4);
      if (hash(bytes) !== digest)
        throw new Fault('GENERATION_BASE_CORRUPT', 'Generated base integrity failed.', 5);
      bases[digest] = bytes.toString('utf8');
    }
  if (state)
    for (const owner of Object.values(state.owners))
      for (const digest of Object.values(owner.bases))
        if (!(digest in bases))
          throw new Fault('GENERATION_BASE_MISSING', 'Previous generated base is unavailable.', 5);
  const blueprint = await readDocument(ctx.root, blueprintPath, blueprintSchema);
  const mode = options.mode ?? 'offline';
  if (mode === 'connected' && (!options.environment || !options.metadata))
    throw new Fault(
      'ENVIRONMENT_REQUIRED',
      'Connected planning requires explicit environment and metadata.',
      2,
    );
  if (
    options.environment &&
    blueprint.application.environment &&
    options.environment !== blueprint.application.environment
  )
    throw new Fault('ENVIRONMENT_MISMATCH', 'Blueprint and requested environment differ.', 5);
  return {
    blueprint,
    blueprintPath,
    catalog: await loadCatalog(ctx.root),
    state,
    sources,
    sourceInventory,
    bases,
    configurationDigest: semanticDigest(ctx.config),
    toolchainDigest: hash(await readFile(await safePath(ctx.root, ctx.config.toolchain.lockFile))),
    sourceDir: ctx.config.application.sourceDir,
    projectId: ctx.config.projectId,
    mode,
    environment: options.environment ?? null,
    metadata: options.metadata ?? null,
    validation: options.validation ?? 'compiler',
  };
}
export function planComposition(input: Snapshot): CompositionPlan {
  const { blueprint, state, catalog } = input;
  const diagnostics: CompositionPlan['diagnostics'] = [],
    operations: CompositionPlan['operations'] = [];
  const blueprintDigest = semanticDigest(blueprint);
  const plan: CompositionPlan = {
    schemaVersion: 1,
    generatorVersion: '1',
    kind: 'composition',
    status: 'blocked',
    projectId: input.projectId,
    blueprintPath: input.blueprintPath,
    blueprintDigest,
    catalogDigest: catalog.digest,
    configurationDigest: input.configurationDigest,
    toolchainDigest: input.toolchainDigest,
    sourceInventory: input.sourceInventory,
    stateDigest: state ? semanticDigest(state) : null,
    validation: input.validation,
    mode: input.mode,
    contextDigest: semanticDigest(
      input.metadata ?? { assumptions: blueprint.application.compatibilityProfile },
    ),
    environment: input.environment,
    review: {
      entities: blueprint.entities,
      commands: blueprint.commands,
      contracts: blueprint.contracts,
      packages: {},
    },
    allocations: {},
    operations,
    state: null,
    lock: null,
    diagnostics,
    digest: '0'.repeat(64),
  };
  try {
    if (Object.keys(blueprint.blocks).length > 256)
      throw new Fault('INSTANCE_LIMIT', 'At most 256 instances are supported.', 2);
    const packages = resolvePackages(
      catalog,
      Object.values(blueprint.blocks).map((b) => b.use),
      blueprint.application.compatibilityProfile,
    );
    plan.review.packages = Object.fromEntries(
      [...packages].map(([id, p]) => [
        id,
        {
          digest: p.digest,
          origin: p.manifest.origin,
          license: p.manifest.license,
          effects: p.manifest.effects,
          dependencies: p.manifest.requires.blocks,
        },
      ]),
    );
    for (const pkg of packages.values())
      if (pkg.manifest.status === 'deprecated')
        diagnostics.push({
          code: 'BLOCK_DEPRECATED',
          severity: 'warning',
          message: 'Selected exact block is deprecated; review replacement separately.',
        });
    const symbols = inventorySymbols(input.sources),
      used = new Set(symbols.pages),
      prefixes = new Set<string>();
    const allocated: Record<string, Allocation> = {};
    const nextPage = () => {
      for (let page = 100; page < 9999; page++)
        if (!used.has(page)) {
          used.add(page);
          return page;
        }
      throw new Fault('ALLOCATION_EXHAUSTED', 'No available page identity.', 5);
    };
    for (const [id, instance] of Object.entries(blueprint.blocks).sort(([a], [b]) => (a < b ? -1 : 1))) {
      const binding = bind(blueprint, instance, input.metadata ?? undefined);
      if (Object.keys(instance.extensions).length && instance.ownership !== 'extended')
        throw new Fault('EXTENSION_MODE_REQUIRED', 'Extension hooks require explicit extended ownership.', 5);
      for (const source of Object.values(instance.extensions))
        if (/```|\b(?:commit|rollback|grant|revoke|host|connect|execute\s+immediate)\b/i.test(source!))
          throw new Fault(
            'EXTENSION_UNSAFE',
            'Extension code must preserve caller-owned transactions and literal boundaries.',
            5,
          );
      const previous = state?.owners[id],
        prefix =
          previous?.allocation.prefix ??
          'cmp_' + id.toLowerCase().replaceAll('-', '_').slice(0, 24) + '_' + hash(id).slice(0, 8);
      if (prefixes.has(prefix.toUpperCase()) || (!previous && symbols.symbols.has(prefix.toUpperCase())))
        throw new Fault('SYMBOL_COLLISION', 'A block namespace collides with existing source.', 5);
      prefixes.add(prefix.toUpperCase());
      if (previous)
        for (const file of Object.keys(previous.files)) {
          if (!input.sources[file])
            throw new Fault(
              'OWNED_SOURCE_MISSING',
              'Owned source is missing; explicit adoption is required.',
              5,
            );
          const page = declarations(input.sources[file]!).find((n) => n.kind === 'page' && n.depth === 0);
          if (!page || ![previous.allocation.page, previous.allocation.dialog].includes(Number(page.key)))
            throw new Fault('OWNED_IDENTITY_CHANGED', 'Owned page identity changed.', 5);
        }
      allocated[id] = {
        page: previous?.allocation.page ?? nextPage(),
        dialog: binding.writable ? (previous?.allocation.dialog ?? nextPage()) : null,
        prefix,
      };
      const pkg = packages.get(instance.use)!;
      if (binding.writable && pkg.manifest.renderer !== 'report-dialog')
        throw new Fault(
          'BLOCK_WRITE_UNSUPPORTED',
          'Only the report-dialog adapter implements create/edit commands.',
          5,
        );
      const providers = new Set([
        'key',
        'readAuthorization',
        ...(binding.writable ? ['optimisticLock', 'writeAuthorization'] : []),
      ]);
      for (const capability of pkg.manifest.requires.capabilities)
        if (
          !providers.has(capability) &&
          !(
            pkg.manifest.renderer === 'report-dialog' &&
            !binding.writable &&
            ['optimisticLock', 'writeAuthorization'].includes(capability)
          )
        )
          throw new Fault('CAPABILITY_MISSING', 'A required block capability has no reviewed provider.', 5);
    }
    const hosts = new Map<string, string>(),
      graph = new Map<string, string[]>();
    for (const connection of blueprint.connections) {
      const from = connection.from.match(/^([\w-]+)\.events\.saved$/),
        to = connection.to.match(/^([\w-]+)\.actions\.refresh$/);
      if (!from || !to || !blueprint.blocks[from[1]!] || !blueprint.blocks[to[1]!])
        throw new Fault('CONNECTION_INVALID', 'Unknown or unsupported event/action port.', 5);
      const publisher = blueprint.blocks[from[1]!]!,
        consumer = blueprint.blocks[to[1]!]!;
      if (
        !bind(blueprint, publisher).writable ||
        packages.get(publisher.use)!.manifest.renderer !== 'report-dialog' ||
        packages.get(consumer.use)!.manifest.renderer !== 'status-summary' ||
        publisher.bindings.records !== consumer.bindings.records
      )
        throw new Fault(
          'CONNECTION_CONTRACT_MISMATCH',
          'Saved/refresh connections require a writable report and summary of the same row scope.',
          5,
        );
      if (hosts.has(to[1]!))
        throw new Fault('CONNECTION_DUPLICATE', 'A summary can have one explicit host.', 5);
      hosts.set(to[1]!, from[1]!);
      graph.set(from[1]!, [...(graph.get(from[1]!) ?? []), to[1]!]);
    }
    const visiting = new Set<string>(),
      visited = new Set<string>();
    function visit(id: string) {
      if (visiting.has(id)) throw new Fault('INTERACTION_CYCLE', 'Runtime event cycles are unsupported.', 5);
      if (visited.has(id)) return;
      visiting.add(id);
      for (const target of graph.get(id) ?? []) visit(target);
      visiting.delete(id);
      visited.add(id);
    }
    for (const id of graph.keys()) visit(id);
    // A hosted summary currently shares its parent's page ownership. Never delete
    // its source by detaching just the child or by regenerating a detached parent.
    for (const [id, previous] of Object.entries(state?.owners ?? {})) {
      for (const host of previous.consumers) {
        const childDetached = blueprint.blocks[id]?.ownership === 'detached' || previous.mode === 'detached';
        const hostDetached =
          blueprint.blocks[host]?.ownership === 'detached' || state?.owners[host]?.mode === 'detached';
        if (childDetached !== hostDetached)
          throw new Fault(
            'SHARED_OWNERSHIP_DETACH_REQUIRED',
            'Detach the hosted summary and its page owner together to preserve shared source.',
            5,
          );
      }
    }
    for (const [child, host] of hosts)
      if (
        blueprint.blocks[child]!.ownership === 'detached' ||
        blueprint.blocks[host]!.ownership === 'detached'
      )
        throw new Fault(
          'DETACHED_CONNECTION',
          'Remove managed connections when detaching both connected instances.',
          5,
        );
    // A newly standalone summary must stop sharing its former host's page identity.
    for (const [id, previous] of Object.entries(state?.owners ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)))
      if (
        previous.consumers.length &&
        blueprint.blocks[id] &&
        blueprint.blocks[id]!.ownership !== 'detached' &&
        !hosts.has(id)
      )
        allocated[id]!.page = nextPage();
    for (const [child, host] of hosts) allocated[child]!.page = allocated[host]!.page;
    plan.allocations = allocated;
    const desired: Record<string, string> = {},
      owners: Record<string, Owner> = {};
    for (const [id, instance] of Object.entries(blueprint.blocks).sort(([a], [b]) => (a < b ? -1 : 1))) {
      const pkg = packages.get(instance.use)!,
        previous = state?.owners[id];
      if (instance.ownership === 'detached') {
        if (!previous)
          throw new Fault('DETACH_UNOWNED', 'Only an existing owned instance can be detached.', 5);
        owners[id] = { ...previous, mode: 'detached' };
        continue;
      }
      if (previous?.mode === 'detached')
        throw new Fault(
          'REATTACH_REQUIRES_ADOPTION',
          'Detached instances need explicit reviewed adoption.',
          5,
        );
      const summaries = [...hosts]
        .filter(([, host]) => host === id)
        .map(([child]) => ({ instance: blueprint.blocks[child]!, allocation: allocated[child]! }));
      const files = hosts.has(id)
        ? {}
        : render(blueprint, id, instance, pkg.manifest, allocated[id]!, summaries);
      for (const [file, source] of Object.entries(files)) {
        if (desired[file])
          throw new Fault('OWNERSHIP_COLLISION', 'Two instances own the same source file.', 5);
        desired[file] = source;
      }
      owners[id] = {
        instanceId: id,
        blockId: pkg.manifest.id,
        version: pkg.manifest.version,
        mode: instance.ownership,
        allocation: allocated[id]!,
        files: {},
        bases: {},
        consumers: hosts.has(id) ? [hosts.get(id)!] : [],
        provenance: semanticDigest({
          package: pkg.digest,
          instance,
          bindings: blueprint.entities,
          commands: blueprint.commands,
          contracts: blueprint.contracts,
        }),
      };
      for (const [file, source] of Object.entries(files)) {
        owners[id]!.files[file] = hash(source);
        owners[id]!.bases[file] = hash(source);
      }
    }
    const oldFiles = new Map<string, Owner>();
    if (state)
      for (const owner of Object.values(state.owners))
        for (const file of Object.keys(owner.files)) {
          if (oldFiles.has(file))
            throw new Fault('OWNERSHIP_COLLISION', 'Ambiguous previous file ownership.', 5);
          oldFiles.set(file, owner);
        }
    const effectiveSources = { ...input.sources };
    for (const [file, next] of Object.entries(desired)) {
      const local = input.sources[file],
        old = oldFiles.get(file);
      let content = next;
      if (local !== undefined && !old)
        throw new Fault('UNMANAGED_COLLISION', 'A generated path already contains unmanaged source.', 5);
      if (local !== undefined && old) {
        const base = input.bases[old.bases[file]!];
        if (base === undefined)
          throw new Fault('GENERATION_BASE_MISSING', 'Generated base is unavailable.', 5);
        content = threeWay(base, local, next);
      }
      effectiveSources[file] = content;
      const owner = Object.values(owners).find((o) => file in o.files)!;
      owner.files[file] = hash(content);
      if (local !== content)
        operations.push({
          path: input.sourceDir + '/' + file,
          before: input.sourceInventory[file] ?? null,
          after: hash(content),
          content,
          reason: old ? 'update-owned-source' : 'create-owned-source',
        });
      const basePath = `.apexrest-composer/bases/${hash(next)}.apx`;
      if (!(hash(next) in input.bases))
        operations.push({
          path: basePath,
          before: null,
          after: hash(next),
          content: next,
          reason: 'retain-generated-base',
        });
    }
    const removedFiles = new Set(
      [...oldFiles]
        .filter(
          ([file, owner]) =>
            !(file in desired) && owners[owner.instanceId]?.mode !== 'detached' && owner.mode !== 'detached',
        )
        .map(([file]) => file),
    );
    for (const [file, owner] of oldFiles)
      if (!(file in desired)) {
        const existing = owners[owner.instanceId];
        if (existing?.mode === 'detached' || owner.mode === 'detached') {
          if (!existing) owners[owner.instanceId] = owner;
          continue;
        }
        if (
          Object.values(state!.owners).some(
            (o) => o.mode === 'detached' && o.allocation.page === owner.allocation.page,
          )
        )
          throw new Fault('SHARED_CONSUMER_RETAINED', 'A detached consumer still uses the owned page.', 5);
        if (input.sources[file] !== input.bases[owner.bases[file]!])
          throw new Fault(
            'REMOVAL_CONFLICT',
            'Owned source has manual changes; detach instead of deleting.',
            5,
          );
        const targetPage = declarations(input.sources[file]!).find(
          (n) => n.kind === 'page' && n.depth === 0,
        )?.key;
        for (const [consumer, source] of Object.entries(effectiveSources))
          if (
            consumer !== file &&
            !removedFiles.has(consumer) &&
            targetPage &&
            (new RegExp('\\bpage:\\s*' + targetPage + '(?:\\s|$)').test(source) ||
              source.includes(':' + targetPage + ':'))
          )
            throw new Fault(
              'UNKNOWN_CONSUMER_RETAINED',
              'A remaining or unmanaged source still references the removed page.',
              5,
            );
        operations.push({
          path: input.sourceDir + '/' + file,
          before: input.sourceInventory[file]!,
          after: null,
          content: null,
          reason: 'remove-owned-source',
        });
      }
    const lock = {
      schemaVersion: 1 as const,
      generatorVersion: '1' as const,
      resolverPolicyVersion: '1' as const,
      blueprintSemanticDigest: blueprintDigest,
      catalogDigest: catalog.digest,
      compatibilityProfile: blueprint.application.compatibilityProfile,
      packages: Object.fromEntries([...packages].map(([key, p]) => [key, p.digest])),
      contractDigest: semanticDigest({
        entities: blueprint.entities,
        commands: blueprint.commands,
        contracts: blueprint.contracts,
      }),
    };
    const lockDigest = semanticDigest(lock),
      generationDigest = semanticDigest({ blueprintDigest, lockDigest, owners });
    plan.state = {
      schemaVersion: 1,
      generatorVersion: '1',
      generationDigest,
      blueprintDigest,
      lockDigest,
      owners,
    };
    plan.lock = lock;
    plan.status = 'materializable';
    if (input.validation === 'source-only')
      diagnostics.push({
        code: 'SOURCE_ONLY_DRAFT',
        severity: 'warning',
        message: 'Structural draft only; compiler and runtime qualification are unavailable.',
      });
    diagnostics.push({
      code: 'RUNTIME_NOT_RUN',
      severity: 'info',
      message: 'Composition does not establish live Oracle, import, authorization or browser evidence.',
    });
  } catch (error) {
    if (!(error instanceof Fault)) throw error;
    operations.splice(0);
    plan.state = null;
    plan.lock = null;
    diagnostics.push({ code: error.code, severity: 'error', message: error.message });
  }
  plan.operations = [...new Map(operations.map((op) => [op.path, op])).values()].sort((a, b) =>
    a.path < b.path ? -1 : 1,
  );
  plan.digest = planDigest(plan);
  return validate(planSchema, plan);
}
import { planSchema } from './schemas.ts';
