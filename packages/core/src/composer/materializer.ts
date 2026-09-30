import { z } from 'zod';
import { relativePath } from '../config.ts';
import path from 'node:path';
import { readFile, mkdir, cp, rm, open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hash, inventory, exists, atomicWrite, withLock } from '../fs.ts';
import { requireTrust, type ProjectContext } from '../config.ts';
import { Fault } from '../result.ts';
import {
  planSchema,
  stateSchema,
  lockSchema,
  type CompositionPlan,
  type CompositionState,
} from './schemas.ts';
import {
  documentText,
  readDocument,
  safePath,
  semanticDigest,
  planDigest,
  parseDocumentData,
  validate,
} from './formats.ts';
import { loadCatalog } from './catalog.ts';
import { blueprintSchema } from './schemas.ts';

const activeJournal = '.apexrest/composer/journal.json';
const journalSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  phase: z.enum(['prepared', 'writing', 'completed']),
  plan: planSchema,
  previousReceipt: z.string().nullable(),
  records: z
    .array(
      z.strictObject({
        path: relativePath,
        before: z.string().nullable(),
        after: z.string().nullable(),
        preimage: z.string().nullable(),
        content: z.string().nullable(),
      }),
    )
    .max(2050),
  completed: z.array(relativePath),
});
export type Journal = z.infer<typeof journalSchema>;
function receiptFor(plan: CompositionPlan) {
  if (!plan.state || !plan.lock) throw new Fault('PLAN_BLOCKED', 'Plan lacks durable state.', 5);
  return {
    schemaVersion: 1,
    generationDigest: plan.state.generationDigest,
    planDigest: plan.digest,
    stateDigest: semanticDigest(plan.state),
    blueprintPath: plan.blueprintPath,
    blueprintDigest: plan.blueprintDigest,
    lockDigest: semanticDigest(plan.lock),
    qualification: plan.validation === 'compiler' ? 'offline-compiler' : 'source-only',
    deployment: 'not-run',
  };
}
async function bytes(ctx: ProjectContext, relative: string) {
  const file = await safePath(ctx.root, relative);
  return (await exists(file)) ? await readFile(file) : null;
}
async function durable(ctx: ProjectContext, relative: string, content: string | null) {
  const file = await safePath(ctx.root, relative);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  if (content === null) await rm(file, { force: true });
  else await atomicWrite(file, content);
  try {
    const handle = await open(path.dirname(file), 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (process.platform !== 'win32') throw error;
  }
}
export async function journal(ctx: ProjectContext): Promise<Journal | null> {
  const file = await safePath(ctx.root, activeJournal);
  if (!(await exists(file))) return null;
  const value = validate(journalSchema, JSON.parse(await readFile(file, 'utf8')));
  if (
    value.schemaVersion !== 1 ||
    !['prepared', 'writing', 'completed'].includes(value.phase) ||
    !Array.isArray(value.records) ||
    !Array.isArray(value.completed)
  )
    throw new Fault('JOURNAL_CORRUPT', 'Composition journal requires explicit inspection.', 5);
  value.plan = validate(planSchema, value.plan);
  if (planDigest(value.plan) !== value.plan.digest)
    throw new Fault('JOURNAL_CORRUPT', 'Journal plan integrity failed.', 5);
  const paths = new Set(value.records.map((record) => record.path));
  if (
    paths.size !== value.records.length ||
    value.plan.operations.some((operation) => !paths.has(operation.path)) ||
    (value.plan.state &&
      value.plan.stateDigest !== semanticDigest(value.plan.state) &&
      !paths.has('.apexrest-composer/state.json'))
  )
    throw new Fault('JOURNAL_CORRUPT', 'Journal write set is incomplete or duplicated.', 5);
  if (
    new Set(value.completed).size !== value.completed.length ||
    value.completed.some((completed) => !paths.has(completed))
  )
    throw new Fault('JOURNAL_CORRUPT', 'Journal checkpoints do not match its write set.', 5);
  for (const record of value.records) {
    await safePath(ctx.root, record.path);
    const operation = value.plan.operations.find((op) => op.path === record.path);
    const metadata =
      record.path === '.apexrest-composer/state.json'
        ? value.plan.state
        : record.path === '.apexrest-composer/lock.json'
          ? value.plan.lock
          : null;
    if (
      operation
        ? operation.content !== record.content ||
          operation.after !== record.after ||
          operation.before !== record.before
        : !metadata || record.content !== documentText(metadata)
    )
      throw new Fault('JOURNAL_CORRUPT', 'Journal write differs from its immutable plan.', 5);
    if (
      (record.preimage === null ? null : hash(record.preimage)) !== record.before ||
      (record.content === null ? null : hash(record.content)) !== record.after
    )
      throw new Fault('JOURNAL_CORRUPT', 'Journal image integrity failed.', 5);
  }
  if (!value.plan.state || !value.plan.lock)
    throw new Fault('JOURNAL_CORRUPT', 'Journal plan lacks generation metadata.', 5);
  const lockDigest = semanticDigest(value.plan.lock);
  if (value.plan.state.lockDigest !== lockDigest)
    throw new Fault('JOURNAL_CORRUPT', 'Journal state does not bind its planned lock.', 5);
  const stateRecord = value.records.find((record) => record.path === '.apexrest-composer/state.json'),
    lockRecord = value.records.find((record) => record.path === '.apexrest-composer/lock.json'),
    previousStateText = stateRecord
      ? stateRecord.preimage
      : ((await bytes(ctx, '.apexrest-composer/state.json'))?.toString('utf8') ?? null);
  let previousState: CompositionState | null;
  try {
    previousState =
      previousStateText === null ? null : validate(stateSchema, parseDocumentData(previousStateText));
  } catch {
    throw new Fault('JOURNAL_CORRUPT', 'Journal state preimage is invalid.', 5);
  }
  if ((previousState ? semanticDigest(previousState) : null) !== value.plan.stateDigest)
    throw new Fault('JOURNAL_CORRUPT', 'Journal state preimage differs from the reviewed plan.', 5);
  if (lockRecord && previousState) {
    let previousLockDigest: string | null;
    try {
      previousLockDigest =
        lockRecord.preimage === null
          ? null
          : semanticDigest(validate(lockSchema, parseDocumentData(lockRecord.preimage)));
    } catch {
      throw new Fault('JOURNAL_CORRUPT', 'Journal lock preimage is invalid.', 5);
    }
    if (previousLockDigest !== previousState.lockDigest)
      throw new Fault('JOURNAL_CORRUPT', 'Journal lock preimage differs from the reviewed state.', 5);
  }
  if (!lockRecord) {
    // Older journals omit unchanged metadata. Its current exact image must already be
    // the desired one, and a reviewed prior state must not require a different lock.
    if (
      (previousState && previousState.lockDigest !== lockDigest) ||
      (await bytes(ctx, '.apexrest-composer/lock.json'))?.toString('utf8') !== documentText(value.plan.lock)
    )
      throw new Fault('JOURNAL_CORRUPT', 'Journal omits a required lock write.', 5);
  }
  return value;
}
async function checkPreconditions(ctx: ProjectContext, plan: CompositionPlan) {
  const sources = await inventory(await safePath(ctx.root, ctx.config.application.sourceDir));
  const stateFile = await safePath(ctx.root, '.apexrest-composer/state.json');
  const state = (await exists(stateFile))
    ? await readDocument(ctx.root, '.apexrest-composer/state.json', stateSchema)
    : null;
  if (
    plan.projectId !== ctx.config.projectId ||
    plan.configurationDigest !== semanticDigest(ctx.config) ||
    plan.toolchainDigest !== hash(await readFile(await safePath(ctx.root, ctx.config.toolchain.lockFile))) ||
    semanticDigest(sources) !== semanticDigest(plan.sourceInventory) ||
    (state ? semanticDigest(state) : null) !== plan.stateDigest ||
    plan.blueprintDigest !==
      semanticDigest(await readDocument(ctx.root, plan.blueprintPath, blueprintSchema)) ||
    plan.catalogDigest !== (await loadCatalog(ctx.root)).digest
  )
    throw new Fault(
      'COMPOSITION_DRIFT',
      'Blueprint, catalog, state, source or configuration changed after review.',
      5,
    );
  if (
    state &&
    plan.kind === 'composition' &&
    state.lockDigest !==
      semanticDigest(await readDocument(ctx.root, '.apexrest-composer/lock.json', lockSchema))
  )
    throw new Fault('COMPOSITION_DRIFT', 'Tracked lock differs from state.', 5);
  for (const op of plan.operations) {
    if (
      !op.path.startsWith(ctx.config.application.sourceDir + '/') &&
      !/^\.apexrest-composer\/bases\/[a-f0-9]{64}\.apx$/.test(op.path)
    )
      throw new Fault('COMPOSITION_SCOPE_DENIED', 'Plan writes outside Composer ownership.', 5);
    if (op.path.includes('/.apex/'))
      throw new Fault('COMPOSITION_SCOPE_DENIED', 'Oracle metadata cannot be overwritten.', 5);
    const current = await bytes(ctx, op.path);
    if (
      (current ? hash(current) : null) !== op.before ||
      (op.content === null ? null : hash(op.content)) !== op.after
    )
      throw new Fault('COMPOSITION_DRIFT', 'Planned preimage or postimage changed.', 5);
  }
}
export async function stagePlan(ctx: ProjectContext, plan: CompositionPlan) {
  const relative = `.apexrest/composer/staging/${plan.digest}`,
    base = await safePath(ctx.root, relative);
  await mkdir(base, { recursive: true, mode: 0o700 });
  const application = path.join(base, 'application');
  await rm(application, { recursive: true, force: true });
  await cp(await safePath(ctx.root, ctx.config.application.sourceDir), application, { recursive: true });
  for (const op of plan.operations.filter((op) =>
    op.path.startsWith(ctx.config.application.sourceDir + '/'),
  )) {
    const file = await safePath(application, op.path.slice(ctx.config.application.sourceDir.length + 1));
    if (op.content === null) await rm(file, { force: true });
    else await atomicWrite(file, op.content);
  }
  return { directory: application, sourceDigest: semanticDigest(await inventory(application)) };
}
export async function freeze(ctx: ProjectContext, plan: CompositionPlan, out: string) {
  const text = documentText(validate(planSchema, plan));
  const frozen = await safePath(ctx.root, `.apexrest/composer/plans/${plan.digest}.json`);
  if (await exists(frozen)) {
    if ((await readFile(frozen, 'utf8')) !== text)
      throw new Fault('PLAN_TAMPERED', 'Immutable plan record changed.', 5);
  } else await atomicWrite(frozen, text);
  const destination = await safePath(ctx.root, out);
  if (
    !out.endsWith('.json') ||
    out === ctx.config.toolchain.lockFile ||
    out === 'apexrest.json' ||
    [
      '.git',
      '.agents',
      '.codex',
      '.apexrest-composer',
      ctx.config.application.sourceDir,
      ...Object.values(ctx.config.database),
    ].some((p) => out === p || out.startsWith(p + '/')) ||
    (out.startsWith('.apexrest/composer/') &&
      !out.startsWith('.apexrest/composer/plans/') &&
      out !== '.apexrest/composer/panel-plan.json') ||
    (out.startsWith('.apexrest/composer/plans/') && destination !== frozen)
  )
    throw new Fault(
      'COMPOSITION_SCOPE_DENIED',
      'Plan output cannot overwrite application source or tracked state.',
      5,
    );
  if ((await exists(destination)) && destination !== frozen) {
    try {
      await readDocument(ctx.root, out, planSchema);
    } catch {
      throw new Fault('COMPOSITION_SCOPE_DENIED', 'Existing output is not a Composer plan.', 5);
    }
  }
  await atomicWrite(destination, text);
}
export async function readPlan(ctx: ProjectContext, file: string, expectedDigest: string) {
  const plan = await readDocument(ctx.root, file, planSchema);
  if (plan.digest !== expectedDigest || planDigest(plan) !== plan.digest)
    throw new Fault('PLAN_TAMPERED', 'Reviewed plan digest differs.', 5);
  const frozen = await readDocument(ctx.root, `.apexrest/composer/plans/${plan.digest}.json`, planSchema);
  if (semanticDigest(frozen) !== semanticDigest(plan))
    throw new Fault('PLAN_TAMPERED', 'Plan differs from its original immutable record.', 5);
  return plan;
}
export async function materialize(
  ctx: ProjectContext,
  plan: CompositionPlan,
  options: { signal?: AbortSignal; boundary?: (phase: string, file: string) => Promise<void> } = {},
) {
  await requireTrust(ctx.root);
  if (plan.status !== 'materializable' || planDigest(plan) !== plan.digest)
    throw new Fault('PLAN_BLOCKED', 'Only an intact materializable plan can be applied.', 5);
  await readPlan(ctx, `.apexrest/composer/plans/${plan.digest}.json`, plan.digest);
  return withLock(await safePath(ctx.root, '.apexrest/composer/ownership.lock'), async () => {
    const previous = await journal(ctx);
    if (plan.kind !== 'composition') return applyRecovery(ctx, plan, previous, options);
    if (previous && previous.phase !== 'completed')
      throw new Fault(
        'RECOVERY_REQUIRED',
        'Inspect the interrupted composition and create an explicit recovery plan.',
        5,
      );
    await checkPreconditions(ctx, plan);
    if (!plan.state || !plan.lock)
      throw new Fault('PLAN_BLOCKED', 'Materializable plan lacks durable state.', 5);
    const stateText = documentText(plan.state),
      lockText = documentText(plan.lock);
    const requested = [
      ...plan.operations.map((op) => ({
        path: op.path,
        before: op.before,
        after: op.after,
        content: op.content,
      })),
    ];
    for (const [file, content] of [
      ['.apexrest-composer/lock.json', lockText],
      ['.apexrest-composer/state.json', stateText],
    ] as const) {
      const current = await bytes(ctx, file);
      if (current?.toString('utf8') !== content)
        requested.push({ path: file, before: current ? hash(current) : null, after: hash(content), content });
    }
    if (!requested.length) {
      const receiptFile = '.apexrest/composer/receipt.json',
        existing = await bytes(ctx, receiptFile);
      const receipt = receiptFor(plan);
      // A fresh checkout has tracked generation state but no private receipt. Re-establish
      // it only after the reviewed plan has passed all current source/context checks.
      if (!existing || JSON.parse(existing.toString('utf8')).qualification !== receipt.qualification)
        await durable(ctx, receiptFile, documentText(receipt));
      return {
        status: 'no-op',
        generationDigest: plan.state.generationDigest,
        stateDigest: semanticDigest(plan.state),
        changedFiles: [],
        qualification: plan.validation === 'compiler' ? 'offline-compiler' : 'source-only',
      };
    }
    if (previous)
      await durable(
        ctx,
        `.apexrest/composer/journals/${previous.id}.json`,
        JSON.stringify(previous, null, 2) + '\n',
      );
    const record: Journal = {
      schemaVersion: 1,
      id: randomUUID(),
      phase: 'prepared',
      plan,
      records: [],
      completed: [],
      previousReceipt: (await bytes(ctx, '.apexrest/composer/receipt.json'))?.toString('utf8') ?? null,
    };
    for (const entry of requested) {
      const preimage = await bytes(ctx, entry.path);
      record.records.push({ ...entry, preimage: preimage?.toString('utf8') ?? null });
    }
    await durable(ctx, activeJournal, JSON.stringify(record, null, 2) + '\n');
    try {
      await options.boundary?.('prepared', activeJournal);
      record.phase = 'writing';
      await durable(ctx, activeJournal, JSON.stringify(record, null, 2) + '\n');
      await options.boundary?.('writing', activeJournal);
      for (const entry of record.records) {
        if (options.signal?.aborted)
          throw new Fault(
            'RECOVERY_REQUIRED',
            'Composition interrupted; inspect journal before retry.',
            6,
            'cancelled',
          );
        const current = await bytes(ctx, entry.path);
        if ((current ? hash(current) : null) !== entry.before)
          throw new Fault('RECOVERY_REQUIRED', 'Concurrent edits interrupted composition.', 5);
        await options.boundary?.('before-write', entry.path);
        const recheck = await bytes(ctx, entry.path);
        if ((recheck ? hash(recheck) : null) !== entry.before)
          throw new Fault('RECOVERY_REQUIRED', 'Concurrent edit before the write.', 5);
        await durable(ctx, entry.path, entry.content);
        await options.boundary?.('after-write', entry.path);
        const after = await bytes(ctx, entry.path);
        if ((after ? hash(after) : null) !== entry.after)
          throw new Fault('RECOVERY_REQUIRED', 'Postimage differs after local write.', 5);
        record.completed.push(entry.path);
        await durable(ctx, activeJournal, JSON.stringify(record, null, 2) + '\n');
        await options.boundary?.('checkpoint', entry.path);
      }
      const expectedSources = { ...plan.sourceInventory };
      for (const op of plan.operations)
        if (op.path.startsWith(ctx.config.application.sourceDir + '/')) {
          const file = op.path.slice(ctx.config.application.sourceDir.length + 1);
          if (op.after === null) delete expectedSources[file];
          else expectedSources[file] = op.after;
        }
      const checkPostimages = async () => {
        for (const entry of record.records) {
          const after = await bytes(ctx, entry.path);
          if ((after ? hash(after) : null) !== entry.after)
            throw new Fault('RECOVERY_REQUIRED', 'Concurrent changes detected before completion.', 5);
        }
        if (
          semanticDigest(await inventory(await safePath(ctx.root, ctx.config.application.sourceDir))) !==
          semanticDigest(expectedSources)
        )
          throw new Fault('RECOVERY_REQUIRED', 'Application changed during materialization.', 5);
      };
      await checkPostimages();
      const receipt = receiptFor(plan),
        receiptText = JSON.stringify(receipt, null, 2) + '\n';
      await options.boundary?.('before-receipt', '.apexrest/composer/receipt.json');
      await durable(ctx, '.apexrest/composer/receipt.json', receiptText);
      await options.boundary?.('after-receipt', '.apexrest/composer/receipt.json');
      await options.boundary?.('before-complete', activeJournal);
      await checkPostimages();
      if ((await bytes(ctx, '.apexrest/composer/receipt.json'))?.toString('utf8') !== receiptText)
        throw new Fault('RECOVERY_REQUIRED', 'Composition receipt changed before completion.', 5);
      record.phase = 'completed';
      await durable(ctx, activeJournal, JSON.stringify(record, null, 2) + '\n');
      return { status: 'materialized', ...receipt, changedFiles: record.records.map((e) => e.path) };
    } catch (error) {
      if (error instanceof Fault && error.code === 'RECOVERY_REQUIRED') throw error;
      throw new Fault(
        'RECOVERY_REQUIRED',
        'Local writes may be partial. Preserve the journal and request explicit recovery.',
        5,
      );
    }
  });
}
export async function recoveryPlan(
  ctx: ProjectContext,
  action: 'resume' | 'restore',
): Promise<CompositionPlan> {
  const record = await journal(ctx);
  if (!record || record.phase === 'completed')
    throw new Fault('RECOVERY_NOT_REQUIRED', 'No interrupted composition requires recovery.', 5);
  for (const entry of record.records) {
    const current = await bytes(ctx, entry.path),
      digest = current ? hash(current) : null;
    if (digest !== entry.before && digest !== entry.after)
      throw new Fault('RECOVERY_CONFLICT', 'Recovery cannot overwrite an unrecognized concurrent edit.', 5);
  }
  const stateFile = await safePath(ctx.root, '.apexrest-composer/state.json');
  const state = (await exists(stateFile))
    ? await readDocument(ctx.root, '.apexrest-composer/state.json', stateSchema)
    : null;
  const plan = {
    ...record.plan,
    kind: action === 'resume' ? ('recovery-resume' as const) : ('recovery-restore' as const),
    sourceInventory: await inventory(await safePath(ctx.root, ctx.config.application.sourceDir)),
    stateDigest: state ? semanticDigest(state) : null,
    blueprintDigest: semanticDigest(await readDocument(ctx.root, record.plan.blueprintPath, blueprintSchema)),
    recovery: {
      journalId: record.id,
      sourcePlanDigest: record.plan.digest,
      recordsDigest: semanticDigest(record.records),
    },
    operations: await Promise.all(
      record.records.map(async (e) => {
        const current = await bytes(ctx, e.path),
          content = action === 'restore' ? e.preimage : e.content;
        return {
          path: e.path,
          before: current ? hash(current) : null,
          after: content === null ? null : hash(content),
          content,
          reason: 'recovery-' + action,
        };
      }),
    ),
    diagnostics: [
      {
        code: 'EXPLICIT_LOCAL_RECOVERY',
        severity: 'info' as const,
        message: `Reviewed ${action} of a partial filesystem composition. No database recovery is performed.`,
      },
    ],
  };
  plan.digest = planDigest(plan);
  return validate(planSchema, plan);
}
async function applyRecovery(
  ctx: ProjectContext,
  plan: CompositionPlan,
  record: Journal | null,
  options: { signal?: AbortSignal; boundary?: (phase: string, file: string) => Promise<void> },
) {
  if (!record || record.phase === 'completed')
    throw new Fault('RECOVERY_NOT_REQUIRED', 'No interrupted journal.', 5);
  if (
    plan.recovery?.journalId !== record.id ||
    plan.recovery.sourcePlanDigest !== record.plan.digest ||
    plan.recovery.recordsDigest !== semanticDigest(record.records)
  )
    throw new Fault('RECOVERY_CONFLICT', 'Recovery plan binds another journal.', 5);
  await checkPreconditions(ctx, { ...plan, operations: [] });
  const restore = plan.kind === 'recovery-restore';
  for (const entry of [...record.records].sort((a, b) =>
    restore
      ? record.records.indexOf(b) - record.records.indexOf(a)
      : record.records.indexOf(a) - record.records.indexOf(b),
  )) {
    if (options.signal?.aborted)
      throw new Fault('RECOVERY_REQUIRED', 'Recovery interrupted; preserve journal.', 6, 'cancelled');
    const current = await bytes(ctx, entry.path),
      actual = current ? hash(current) : null;
    if (actual !== entry.before && actual !== entry.after)
      throw new Fault('RECOVERY_CONFLICT', 'Unknown local edit blocks recovery.', 5);
    const content = restore ? entry.preimage : entry.content,
      expected = restore ? entry.before : entry.after;
    await options.boundary?.('before-recovery-write', entry.path);
    const recheck = await bytes(ctx, entry.path);
    if ((recheck ? hash(recheck) : null) !== actual)
      throw new Fault('RECOVERY_CONFLICT', 'Concurrent edit before recovery write.', 5);
    await durable(ctx, entry.path, content);
    await options.boundary?.('after-recovery-write', entry.path);
    const after = await bytes(ctx, entry.path);
    if ((after ? hash(after) : null) !== expected)
      throw new Fault('RECOVERY_CONFLICT', 'Recovery postimage differs.', 5);
  }
  for (const entry of record.records) {
    const current = await bytes(ctx, entry.path);
    if ((current ? hash(current) : null) !== (restore ? entry.before : entry.after))
      throw new Fault('RECOVERY_CONFLICT', 'Concurrent edit before recovery completion.', 5);
  }
  if (restore) await durable(ctx, '.apexrest/composer/receipt.json', record.previousReceipt);
  if (!restore && plan.state && plan.lock)
    await durable(ctx, '.apexrest/composer/receipt.json', documentText(receiptFor(record.plan)));
  record.phase = 'completed';
  await durable(ctx, activeJournal, JSON.stringify(record, null, 2) + '\n');
  return {
    status: restore ? 'restored' : 'materialized',
    databaseEffects: [],
    changedFiles: record.records.map((e) => e.path),
  };
}
export async function deploymentBinding(ctx: ProjectContext) {
  const pending = await journal(ctx);
  if (pending && pending.phase !== 'completed')
    throw new Fault('RECOVERY_REQUIRED', 'Interrupted composition must be recovered before deployment.', 5);
  const file = await safePath(ctx.root, '.apexrest/composer/receipt.json');
  const stateFile = await safePath(ctx.root, '.apexrest-composer/state.json');
  if (!(await exists(file))) {
    if (await exists(stateFile))
      throw new Fault(
        'COMPOSITION_RECEIPT_MISSING',
        'Tracked Composer state requires its local materialization receipt.',
        5,
      );
    return null;
  }
  const receipt = JSON.parse(await readFile(file, 'utf8')) as {
    generationDigest: string;
    blueprintPath: string;
    blueprintDigest: string;
    stateDigest: string;
    lockDigest: string;
    qualification: string;
  };
  const state = await readDocument(ctx.root, '.apexrest-composer/state.json', stateSchema);
  const blueprintDigest = semanticDigest(
    await readDocument(ctx.root, receipt.blueprintPath, blueprintSchema),
  );
  const lock = await readDocument(ctx.root, '.apexrest-composer/lock.json', lockSchema),
    lockDigest = semanticDigest(lock);
  if (lock.catalogDigest !== (await loadCatalog(ctx.root)).digest || state.lockDigest !== lockDigest)
    throw new Fault('COMPOSITION_DRIFT', 'Catalog or tracked lock changed.', 5);
  if (
    receipt.stateDigest !== semanticDigest(state) ||
    receipt.generationDigest !== state.generationDigest ||
    receipt.blueprintDigest !== blueprintDigest ||
    receipt.lockDigest !== lockDigest
  )
    throw new Fault('COMPOSITION_DRIFT', 'Composition receipt, blueprint, state or lock changed.', 5);
  for (const owner of Object.values(state.owners))
    if (owner.mode !== 'detached')
      for (const [file, digest] of Object.entries(owner.files)) {
        const source = await bytes(ctx, ctx.config.application.sourceDir + '/' + file);
        if (!source || hash(source) !== digest)
          throw new Fault(
            'COMPOSITION_DRIFT',
            'Managed source changed after materialization; replan before deployment.',
            5,
          );
      }
  return {
    generationDigest: receipt.generationDigest,
    blueprintDigest,
    stateDigest: receipt.stateDigest,
    lockDigest,
    catalogDigest: (await loadCatalog(ctx.root)).digest,
    blueprintPath: receipt.blueprintPath,
  };
}

export async function assessPlan(ctx: ProjectContext, file: string, digest: string) {
  try {
    const plan = await readPlan(ctx, file, digest);
    if (plan.status !== 'materializable') return false;
    await checkPreconditions(ctx, plan);
    const pending = await journal(ctx);
    return !pending || pending.phase === 'completed';
  } catch {
    return false;
  }
}
