import path from 'node:path';
import { readFile, mkdir, cp, open, rename, rm } from 'node:fs/promises';
import { createPublicKey, randomUUID, verify } from 'node:crypto';
import { z } from 'zod';
import { canonical, contained, exists, hash, inventory, readJson, writeJson, withLock } from './fs.ts';
import {
  environment,
  isProductionTarget,
  managedHome,
  parse,
  policy,
  protectedProductionTrust,
  requireTrust,
  refName,
} from './config.ts';
import type { ProjectContext, Environment, ProductionTrust } from './config.ts';
import { resolveConnection } from './connections.ts';
import type { Connection } from './connections.ts';
import { Fault } from './result.ts';
import { OracleAdapter, SCRIPT_RESTRICT_LEVEL, sqlclToken } from './oracle.ts';
import { LocalDeploymentControl, coordination } from './deployment-control.ts';
import {
  SyncStore,
  checkpoint,
  privateCopy,
  syncPath,
  checkSnapshot,
  checkSyncBackup,
  targetDigest,
} from './sync.ts';
import type { SyncState } from './sync.ts';
import { deploymentBinding } from './composer/materializer.ts';
import { VERSION } from './version.ts';
import { APEXLANG_EQUIVALENCE_POLICY, compareApplicationExports } from './apexlang-equivalence.ts';
import { databaseMeetsApex262Minimum } from './compatibility.ts';
import {
  importOptions,
  importSelectionSchema,
  sourceRelease,
  selectImport,
  persistSnapshot,
  stageSelection,
  rebaseAfterImport,
  type ImportOptions,
} from './partial-import.ts';
export type { ImportOptions } from './partial-import.ts';
export type DeploymentPlanOptions = ImportOptions;
export { targetDigest } from './sync.ts';
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const filesSchema = z.record(z.string(), digestSchema);
const legacyPlanSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  projectId: refName,
  projectRoot: z.string(),
  environment: refName,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  sourceDigest: digestSchema,
  sources: filesSchema,
  configurationDigest: digestSchema,
  toolchainDigest: digestSchema,
  compiler: z.string(),
  targetDigest: digestSchema,
  target: z.record(z.string(), z.unknown()),
  fingerprint: digestSchema,
  migrationHistory: z.array(z.record(z.string(), z.unknown())),
  // Always the local durable store; the shape is kept so existing plan digests stay stable.
  coordination: z.strictObject({
    backend: z.literal('local'),
    scope: z.literal('managed-home-schema'),
    storeDigest: digestSchema,
  }),
  scope: z.literal('full-application-import'),
  operations: z.array(
    z.strictObject({
      kind: z.enum(['migration', 'package', 'import', 'verify']),
      file: z.string().optional(),
      sha256: digestSchema.optional(),
    }),
  ),
  risks: z.array(z.string()),
  approval: z.literal('external-policy-required'),
  backupRequired: z.boolean(),
  digest: digestSchema,
  restore: z
    .strictObject({ backupId: z.uuid(), checksum: digestSchema, alias: refName.optional() })
    .optional(),
});
/** Reviewed plans are valid for at most this long after creation. */
export const PLAN_LIFETIME_MS = 30 * 60000;
const syncBindingSchema = z.strictObject({
  syncId: z.uuid(),
  revision: z.number().int().nonnegative(),
  baselineDigest: digestSchema,
  checkpointDigest: digestSchema,
  backupId: z.uuid(),
  backupChecksum: digestSchema,
});
const planV2Object = legacyPlanSchema.extend({
  schemaVersion: z.literal(2),
  mode: z.enum(['full-export', 'working-copy']),
  backupStrategy: z.enum(['fresh-export', 'initial-backup']),
  workingCopy: syncBindingSchema.nullable(),
});
const planV2Schema = planV2Object.superRefine((plan, ctx) => {
  if (
    (plan.mode === 'working-copy') !== (plan.backupStrategy === 'initial-backup') ||
    (plan.mode === 'working-copy') !== (plan.workingCopy !== null)
  )
    ctx.addIssue({ code: 'custom', message: 'Plan mode, backup strategy and sync binding must agree.' });
});
export const composerBindingSchema = z.strictObject({
  generationDigest: digestSchema,
  blueprintDigest: digestSchema,
  stateDigest: digestSchema,
  lockDigest: digestSchema,
  catalogDigest: digestSchema,
  blueprintPath: z.string().min(1),
});
const planV3Schema = planV2Object
  .extend({ schemaVersion: z.literal(3), composer: composerBindingSchema })
  .superRefine((plan, ctx) => {
    if (
      (plan.mode === 'working-copy') !== (plan.backupStrategy === 'initial-backup') ||
      (plan.mode === 'working-copy') !== (plan.workingCopy !== null)
    )
      ctx.addIssue({ code: 'custom', message: 'Plan mode, backup strategy and sync binding must agree.' });
  });
const planV4Schema = planV2Object
  .extend({
    schemaVersion: z.literal(4),
    scope: z.enum(['full-application-import', 'selected-file-import']),
    composer: composerBindingSchema.nullable(),
    importSelection: importSelectionSchema,
  })
  .superRefine((plan, ctx) => {
    const partial = plan.importSelection.resolvedMode === 'files';
    if (
      (partial && !!plan.restore) ||
      (plan.importSelection.requestedMode === 'files' && !partial) ||
      (plan.importSelection.requestedMode === 'full' && partial) ||
      (!partial && (plan.mode === 'working-copy') !== (plan.backupStrategy === 'initial-backup')) ||
      (plan.mode === 'working-copy') !== (plan.workingCopy !== null) ||
      (partial &&
        (!plan.importSelection.files.length ||
          !plan.importSelection.before ||
          !plan.importSelection.effective ||
          plan.backupStrategy !== 'fresh-export' ||
          !plan.workingCopy)) ||
      partial !== (plan.scope === 'selected-file-import') ||
      (!partial &&
        (plan.importSelection.files.length || plan.importSelection.before || plan.importSelection.effective))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Import selection, scope, snapshots and backup strategy must agree.',
      });
  });
export const deployPlanSchema = z.union([legacyPlanSchema, planV2Schema, planV3Schema, planV4Schema]);
export type DeployPlan = z.infer<typeof deployPlanSchema>;
export type DeployState =
  | 'planned'
  | 'approved'
  | 'backing_up'
  | 'migrating'
  | 'importing'
  | 'verifying'
  | 'succeeded'
  | 'failed'
  | 'outcome_unknown';
const next: Record<DeployState, DeployState[]> = {
  planned: ['approved'],
  approved: ['backing_up'],
  backing_up: ['migrating'],
  migrating: ['importing'],
  importing: ['verifying'],
  verifying: ['succeeded'],
  succeeded: [],
  failed: [],
  outcome_unknown: [],
};
export function assertTransition(from: DeployState, to: DeployState) {
  if (!next[from].includes(to) && !['failed', 'outcome_unknown'].includes(to))
    throw new Fault('INVALID_DEPLOY_STATE', `Invalid transition ${from} to ${to}.`, 5);
}
export function planDigest(value: Omit<DeployPlan, 'digest'> | DeployPlan) {
  const { digest: _digest, ...unsigned } = value as DeployPlan;
  return hash(canonical(unsigned));
}
// SQL*Plus/SQLcl client commands with their minimum abbreviation. A reviewed
// migration may contain SQL and PL/SQL only; client commands can run local
// programs, read or write files, switch connections or execute JavaScript.
const clientCommands: [string, number][] = [
  ['host', 2],
  ['start', 3],
  ['spool', 3],
  ['save', 3],
  ['store', 3],
  ['get', 3],
  ['edit', 2],
  ['connect', 4],
  ['disconnect', 4],
  ['password', 5],
  ['exit', 4],
  ['quit', 4],
  ['script', 6],
  ['javascript', 10],
  ['cd', 2],
  ['copy', 4],
  ['alias', 5],
  ['repeat', 6],
  ['load', 4],
  ['unload', 6],
  ['liquibase', 9],
  ['lb', 2],
  ['sshtunnel', 9],
  ['connmgr', 7],
  ['apex', 4],
  ['oci', 3],
  ['datapump', 8],
  ['dp', 2],
  ['cloudstorage', 12],
  ['cs', 2],
  ['soda', 4],
  ['mcp', 3],
];
const plsqlBlockStart =
  /^(?:begin|declare)\b|^create\s+(?:or\s+replace\s+)?(?:(?:editionable|noneditionable)\s+)?(?:and\s+(?:resolve|compile)\s+)?(?:noforce\s+)?(?:java|function|procedure|package|trigger|type|library)\b/i;
/**
 * Return 1-based line numbers that SQLcl could interpret as client commands.
 * Each line is tokenized after leading whitespace and leading block comments.
 * Lines inside multi-line comments and strings are still checked: a lexer that
 * disagrees with SQLcl must over-report, never hide a command.
 */
export function sqlclControlLines(sql: string): number[] {
  const found: number[] = [];
  let block = false;
  sql.split(/\r\n|\r|\n/).forEach((raw, index) => {
    let line = raw;
    for (;;) {
      line = line.replace(/^\s+/, '');
      if (!line.startsWith('/*')) break;
      const end = line.indexOf('*/', 2);
      line = end < 0 ? '' : line.slice(end + 2);
    }
    if (!line || line.startsWith('--')) return;
    if (/^[/.]\s*$/.test(line)) {
      block = false;
      return;
    }
    if (/^[!$@]/.test(line)) {
      found.push(index + 1);
      return;
    }
    const word = /^[A-Za-z][A-Za-z0-9_$#]*/.exec(line)?.[0].toLowerCase();
    if (!word) return;
    const rest = line.slice(word.length).trimStart();
    if (word.length >= 3 && 'remark'.startsWith(word)) return;
    if (plsqlBlockStart.test(line)) block = true;
    // SQL clauses that share a command word on continuation lines.
    if ('start'.startsWith(word) && word.length >= 3 && /^with\b/i.test(rest)) return;
    if ('connect'.startsWith(word) && word.length >= 4 && /^by\b/i.test(rest)) return;
    // PL/SQL EXIT [label] [WHEN ...] inside a block buffer.
    if (block && word === 'exit') return;
    if (
      (word === 'whenever' && /\bcontinue\b/i.test(rest)) ||
      (word === 'set' && /^(?:logsource|editfile)\b/i.test(rest)) ||
      clientCommands.some(([name, min]) => word.length >= min && name.startsWith(word))
    )
      found.push(index + 1);
  });
  return found;
}
export function migrationRisk(sql: string): string[] {
  const risks: string[] = [];
  if (/\b(?:drop|truncate|delete|revoke|grant)\b|\balter\s+(?:table|user|system|database)\b/i.test(sql))
    risks.push('destructive-or-privileged-sql');
  if (sqlclControlLines(sql).length) risks.push('sqlcl-script-control');
  return risks;
}
const securityHeader =
  /^(?:(?:authentication|authorization)(?:[-_ ]?scheme)?\s*[:=]|(?:authentication|authorization)\s*(?:\{|[\w.-]+\s*\())/i;
/**
 * APEXlang security attributes of one source file: `authentication: public`,
 * `authorizationScheme: @admin`, and the bodies of `authentication { ... }`,
 * `authentication name ( ... )` and `authorization name ( ... )` blocks.
 */
export function securityAttributes(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (depth > 0) {
      out.push(line);
      depth += (line.match(/[{(]/g)?.length ?? 0) - (line.match(/[})]/g)?.length ?? 0);
      continue;
    }
    if (!securityHeader.test(line)) continue;
    out.push(line);
    depth = Math.max(0, (line.match(/[{(]/g)?.length ?? 0) - (line.match(/[})]/g)?.length ?? 0));
  }
  return out;
}
/** Detect added, removed or edited security components and security attributes. */
export async function securityChanged(
  local: { root: string; files: Record<string, string> },
  server: { root: string; files: Record<string, string> },
) {
  const read = async (root: string, files: Record<string, string>, file: string) =>
    files[file] === undefined ? [] : securityAttributes(await readFile(await contained(root, file), 'utf8'));
  for (const file of new Set([...Object.keys(server.files), ...Object.keys(local.files)])) {
    if (local.files[file] === server.files[file]) continue;
    if (/authenticat|authoriz/i.test(file)) return true;
    if (
      canonical(await read(local.root, local.files, file)) !==
      canonical(await read(server.root, server.files, file))
    )
      return true;
  }
  return false;
}
const attestationSchema = z.strictObject({
  planDigest: digestSchema,
  planId: z.uuid(),
  projectId: refName,
  targetDigest: digestSchema,
  expiresAt: z.iso.datetime(),
  reviewer: z.string().min(1),
  signature: z.string().min(1),
});
/** SHA-256 of a public key in SPKI DER form; PEM formatting does not change it. */
export function publicKeyFingerprint(publicKey: string | Buffer) {
  return hash(createPublicKey(publicKey).export({ type: 'spki', format: 'der' }));
}
/**
 * Verify an external production approval against administrator trust. The
 * signature covers the canonical attestation without `signature`.
 */
export function verifyProductionApproval(
  trust: ProductionTrust,
  publicKey: string | Buffer,
  value: unknown,
  plan: Pick<DeployPlan, 'digest' | 'id' | 'projectId' | 'targetDigest'>,
  projectId: string,
) {
  const fingerprint = publicKeyFingerprint(publicKey);
  const key = trust.approvalKeys.find((k) => k.sha256 === fingerprint);
  if (!key)
    throw new Fault(
      'APPROVAL_KEY_UNTRUSTED',
      'The approval public key is not listed in the protected production trust file.',
      4,
      'blocked',
    );
  const attestation = parse(attestationSchema, value);
  const { signature, ...payload } = attestation;
  if (
    payload.planDigest !== plan.digest ||
    payload.planId !== plan.id ||
    payload.projectId !== plan.projectId ||
    payload.projectId !== projectId ||
    payload.targetDigest !== plan.targetDigest ||
    (key.reviewer !== undefined && key.reviewer !== payload.reviewer) ||
    Date.parse(payload.expiresAt) <= Date.now() ||
    !verify(
      null,
      Buffer.from(canonical(payload)),
      createPublicKey(publicKey),
      Buffer.from(signature, 'base64'),
    )
  )
    throw new Fault(
      'APPROVAL_INVALID',
      'External approval is invalid, expired or for another project/plan/target.',
      4,
    );
  return payload;
}
export async function authorizePlan(ctx: ProjectContext, plan: DeployPlan, env: Environment) {
  await requireTrust(ctx.root);
  if (plan.risks.some((r) => r !== 'application-restore'))
    throw new Fault(
      'RECOVERY_REVIEW_REQUIRED',
      'Destructive, authentication or unsupported changes need an explicit recovery implementation and reviewed external workflow.',
      4,
      'blocked',
    );
  // Administrator trust can mark a target as production regardless of apexrest.json.
  if (await isProductionTarget(env, plan.targetDigest)) {
    if (
      process.env.CI !== 'true' ||
      !process.env.APEXREST_APPROVAL_PUBLIC_KEY_FILE ||
      !process.env.APEXREST_APPROVAL_FILE
    )
      throw new Fault(
        'PRODUCTION_CI_REQUIRED',
        'Production requires a protected CI runner and externally signed approval bound to this plan.',
        4,
        'blocked',
      );
    // The environment only selects a key; trust comes from a file this process cannot modify.
    const trust = await protectedProductionTrust();
    verifyProductionApproval(
      trust,
      await readFile(process.env.APEXREST_APPROVAL_PUBLIC_KEY_FILE),
      await readJson(process.env.APEXREST_APPROVAL_FILE),
      plan,
      ctx.config.projectId,
    );
    return;
  }
  const grants = (await policy()).grants;
  if (
    !grants.some(
      (g) =>
        g.projectRoot === ctx.root &&
        g.targetDigest === plan.targetDigest &&
        g.operations.includes('deploy') &&
        g.planDigest === plan.digest &&
        Date.parse(g.expiresAt) > Date.now() &&
        Date.parse(g.expiresAt) <= Date.parse(plan.expiresAt),
    )
  )
    throw new Fault(
      'DEPLOY_APPROVAL_REQUIRED',
      'A user-owned deploy grant for this project and target is required. It must carry planDigest equal to this plan digest and expire no later than the plan.',
      4,
      'blocked',
    );
}
const migrationName = /^(\d{4,})__[A-Za-z0-9_-]+\.sql$/;
const migrationVersion = (file: string) => BigInt(migrationName.exec(path.basename(file))?.[1] ?? '-1');
/** Migrations run in numeric version order, then package files by path. */
function operationOrder(a: DeployPlan['operations'][number], b: DeployPlan['operations'][number]) {
  const kind = (a.kind === 'migration' ? 0 : 1) - (b.kind === 'migration' ? 0 : 1);
  if (kind) return kind;
  if (a.kind === 'migration' && b.kind === 'migration') {
    const left = migrationVersion(a.file ?? ''),
      right = migrationVersion(b.file ?? '');
    if (left !== right) return left < right ? -1 : 1;
  }
  return (a.file ?? '').localeCompare(b.file ?? '');
}
/** Flat, uniquely versioned migration files; new versions must follow applied history. */
function checkMigrations(
  ctx: ProjectContext,
  sources: Record<string, string>,
  history: Record<string, unknown>[],
) {
  const prefix = ctx.config.database.migrationsDir + '/';
  const versions = new Map<bigint, string>();
  const applied = new Set(history.map((row) => String(row.version)));
  let highest = -1n;
  for (const row of history) {
    const match = migrationName.exec(String(row.version));
    if (match && BigInt(match[1]!) > highest) highest = BigInt(match[1]!);
  }
  for (const file of Object.keys(sources)) {
    if (!file.startsWith(prefix)) continue;
    const name = file.slice(prefix.length);
    if (name.includes('/'))
      throw new Fault(
        'INVALID_MIGRATION_LAYOUT',
        `Migration ${file} is in a subdirectory. Keep migrations directly in ${ctx.config.database.migrationsDir}.`,
        2,
      );
    const match = migrationName.exec(name);
    if (!match)
      throw new Fault(
        'INVALID_MIGRATION_NAME',
        'Use ordered immutable migration names such as 0001__customers.sql.',
        2,
      );
    const version = BigInt(match[1]!);
    const duplicate = versions.get(version);
    if (duplicate)
      throw new Fault(
        'DUPLICATE_MIGRATION_VERSION',
        `Migrations ${duplicate} and ${name} share version ${match[1]}. Use one file per version.`,
        2,
      );
    versions.set(version, name);
    if (!applied.has(name) && version < highest)
      throw new Fault(
        'MIGRATION_OUT_OF_ORDER',
        `New migration ${name} is older than the highest applied version. Give it a higher version.`,
        5,
      );
  }
}
/** Application source files keyed relative to the application source directory. */
function applicationFiles(ctx: ProjectContext, sources: Record<string, string>) {
  const prefix = ctx.config.application.sourceDir + '/';
  return Object.fromEntries(
    Object.entries(sources)
      .filter(([file]) => file.startsWith(prefix))
      .map(([file, sha]) => [file.slice(prefix.length), sha]),
  );
}
export async function sourceInventory(ctx: ProjectContext) {
  const files: Record<string, string> = {};
  for (const relative of [
    ctx.config.application.sourceDir,
    ctx.config.database.migrationsDir,
    ctx.config.database.packagesDir,
  ]) {
    const dir = await contained(ctx.root, relative);
    if (await exists(dir))
      for (const [file, sha] of Object.entries(await inventory(dir))) files[relative + '/' + file] = sha;
  }
  for (const relative of ['package.json', 'package-lock.json'])
    if (await exists(path.join(ctx.root, relative)))
      files[relative] = hash(await readFile(await contained(ctx.root, relative)));
  return Object.fromEntries(Object.entries(files).sort());
}
async function appendJournal(runDir: string, event: Record<string, unknown>) {
  const journal = await open(path.join(runDir, 'journal.jsonl'), 'a', 0o600);
  try {
    await journal.writeFile(JSON.stringify(event) + '\n');
    await journal.sync();
  } finally {
    await journal.close();
  }
  await writeJson(path.join(runDir, 'state.json'), event);
}
export class DeploymentService {
  constructor(private oracle = new OracleAdapter()) {}
  async history(env: Environment, _connection: Connection) {
    // Migration history is local and durable; no Oracle control table is read.
    return new LocalDeploymentControl(env).history();
  }
  async fingerprint(env: Environment, connection: Connection) {
    const target = await this.oracle.verifyTarget(env, connection);
    const history = await this.history(env, connection);
    const exported = target.application
      ? await this.oracle.exportApplication(env, connection, 'APEXLANG')
      : null;
    return {
      target,
      history,
      exported,
      fingerprint: hash(canonical({ target, history, exportDigest: exported?.digest ?? null })),
    };
  }
  async workingFingerprint(ctx: ProjectContext, name: string, state: SyncState) {
    const env = environment(ctx, name),
      connection = await resolveConnection(env.readConnectionRef);
    const target = await this.oracle.verifyTarget(env, connection);
    const metadata = await this.oracle.applicationMetadata(env, connection);
    if (
      !target.application ||
      canonical(target) !== canonical(state.target) ||
      canonical(metadata) !== canonical(state.observedMetadata)
    )
      throw new Fault(
        'SYNC_SERVER_CHANGED',
        'Target or update metadata changed. Explicit refresh is required after external edits.',
        5,
      );
    const history = await this.history(env, connection);
    return {
      target,
      history,
      exported: checkpoint(state),
      fingerprint: hash(canonical({ target, history, metadata })),
    };
  }
  async sync(
    ctx: ProjectContext,
    name: string,
    action: 'init' | 'status' | 'refresh' | 'invalidate',
    signal?: AbortSignal,
  ) {
    const env = environment(ctx, name),
      store = new SyncStore(ctx, env, name);
    if (action === 'status') return store.status();
    await requireTrust(ctx.root);
    return store.lock(async () => {
      const previous = await store.read(action === 'refresh' || action === 'invalidate');
      if (previous && ['importing', 'outcome_unknown'].includes(previous.status))
        throw new Fault(
          'SYNC_BLOCKED',
          'An interrupted import needs reconciliation; sync cannot clear its ownership.',
          5,
        );
      if (action === 'invalidate') {
        if (previous)
          await store.write({ ...previous, status: 'invalidated', revision: previous.revision + 1 });
        return store.status();
      }
      if (action === 'init' && previous && previous.status !== 'invalidated') {
        await store.validate(previous);
        return store.status();
      }
      if (await isProductionTarget(env))
        throw new Fault(
          'SYNC_SCOPE_UNSUPPORTED',
          'Working copies support existing development/test applications only.',
          5,
        );
      if (
        ctx.config.application.sourceDir.startsWith('.apexrest') ||
        ctx.config.application.sourceDir === '.'
      )
        throw new Fault(
          'SYNC_PATH_UNSAFE',
          'Working sources must be separate from private control storage.',
          5,
        );
      if (action === 'refresh' && previous) {
        await checkSnapshot(ctx, checkpoint(previous));
        const source = await syncPath(ctx, previous.sourceDir);
        if (
          !(await exists(source)) ||
          canonical(await inventory(source)) !== canonical(checkpoint(previous).files)
        )
          throw new Fault(
            'SYNC_DIRTY',
            'Save and reconcile local edits before refresh. No export was performed.',
            5,
          );
      }
      const readConnection = await resolveConnection(env.readConnectionRef),
        deployConnection = await resolveConnection(env.deployConnectionRef),
        runId = randomUUID();
      await this.lease(env, runId, true);
      try {
        if (signal?.aborted) throw new Fault('CANCELLED', 'Sync cancelled before export.', 6, 'cancelled');
        const target = await this.oracle.verifyTarget(env, readConnection);
        if (!target.application)
          throw new Fault('SYNC_SCOPE_UNSUPPORTED', 'Sync requires an existing application.', 5);
        const metadata = await this.oracle.applicationMetadata(env, readConnection);
        const exported = await this.oracle.exportApplication(env, readConnection, 'APEXLANG');
        const sql = await this.oracle.exportApplication(env, readConnection, 'SQL');
        if (sql.compiler.version !== exported.compiler.version)
          throw new Fault(
            'SYNC_COMPILER_CHANGED',
            'Compiler changed during initial sync. Explicitly refresh with one toolchain.',
            5,
          );
        const syncId = randomUUID(),
          backupId = randomUUID();
        const baselineDir = '.apexrest/sync/' + targetDigest(env) + '/baselines/' + syncId + '/application';
        const baselineRoot = await syncPath(ctx, baselineDir),
          backupRoot = await syncPath(ctx, '.apexrest/backups/' + backupId);
        await mkdir(path.dirname(baselineRoot), { recursive: true, mode: 0o700 });
        await privateCopy(exported.directory, baselineRoot);
        const baseline = { directory: baselineDir, files: exported.files, digest: exported.digest };
        await checkSnapshot(ctx, baseline);
        await mkdir(backupRoot, { recursive: true, mode: 0o700 });
        await privateCopy(sql.directory, path.join(backupRoot, 'application'));
        await writeJson(path.join(backupRoot, 'backup.json'), {
          schemaVersion: 1,
          backupId,
          targetDigest: targetDigest(env),
          environment: name,
          digest: sql.digest,
          files: sql.files,
          restoreProcedure:
            'Reviewed initial SQL export import; application metadata only. Schema/data recovery is separate.',
        });
        await checkSyncBackup(ctx, { backupId, checksum: sql.digest }, targetDigest(env), name);
        const observedTarget = await this.oracle.verifyTarget(env, readConnection);
        const observedMetadata = await this.oracle.applicationMetadata(env, readConnection);
        if (
          canonical(target) !== canonical(observedTarget) ||
          canonical(metadata) !== canonical(observedMetadata)
        )
          throw new Fault(
            'SYNC_SERVER_CHANGED',
            'Application changed during sync. Staged artifacts were retained.',
            5,
          );
        await this.lease(env, runId, false);
        if (signal?.aborted)
          throw new Fault('CANCELLED', 'Sync cancelled before installing sources.', 6, 'cancelled');
        const state: SyncState = {
          schemaVersion: 1,
          syncId,
          revision: (previous?.revision ?? -1) + 1,
          projectRoot: ctx.root,
          projectId: ctx.config.projectId,
          environment: name,
          targetDigest: targetDigest(env),
          target,
          sourceDir: ctx.config.application.sourceDir,
          toolchainDigest: hash(await readFile(await contained(ctx.root, ctx.config.toolchain.lockFile))),
          runtimeVersion: VERSION,
          compilerVersion: exported.compiler.version,
          exportedAt: new Date().toISOString(),
          baseline,
          backup: { backupId, checksum: sql.digest },
          observedMetadata: metadata,
          lastSuccessfulImport: null,
          status: 'ready',
          importingRunId: null,
        };
        const source = await syncPath(ctx, ctx.config.application.sourceDir);
        const refreshKnown = action === 'refresh' && previous?.sourceDir === ctx.config.application.sourceDir;
        if (await exists(source)) {
          const expected = refreshKnown ? checkpoint(previous!).files : exported.files;
          if (canonical(await inventory(source)) !== canonical(expected))
            throw new Fault(
              'SYNC_SOURCE_CONFLICT',
              'Local sources differ from the expected inventory. Staged artifacts were retained; local files were preserved.',
              5,
            );
          if (refreshKnown) {
            // Preserve the clean previous copy and atomically install the new server baseline.
            const retained = await syncPath(
              ctx,
              '.apexrest/sync/' + targetDigest(env) + '/baselines/' + syncId + '/previous-working-copy',
            );
            const replacement = await syncPath(
              ctx,
              '.apexrest/sync/' + targetDigest(env) + '/baselines/' + syncId + '/new-working-copy',
            );
            await privateCopy(baselineRoot, replacement);
            await store.write({ ...state, status: 'importing', importingRunId: runId });
            await rename(source, retained);
            try {
              await rename(replacement, source);
            } catch (error) {
              await rename(retained, source);
              throw error;
            }
          }
        } else {
          await mkdir(path.dirname(source), { recursive: true });
          const replacement = await syncPath(
            ctx,
            '.apexrest/sync/' + targetDigest(env) + '/baselines/' + syncId + '/new-working-copy',
          );
          await privateCopy(baselineRoot, replacement);
          await store.write({ ...state, status: 'importing', importingRunId: runId });
          await rename(replacement, source);
        }
        if (previous && previous.targetDigest !== state.targetDigest)
          await store.write({ ...previous, status: 'invalidated', revision: previous.revision + 1 });
        await store.write(state);
        // Private baseline and backup copies are installed; release the Oracle staging exports.
        await this.oracle.discardStage?.(exported.stage);
        await this.oracle.discardStage?.(sql.stage);
        return store.status();
      } finally {
        await this.releaseLease(env, runId);
      }
    });
  }
  async releaseLease(env: Environment, runId: string) {
    await new LocalDeploymentControl(env).release(runId);
  }
  async plan(ctx: ProjectContext, name: string, options: ImportOptions | boolean = {}): Promise<DeployPlan> {
    if (typeof options === 'boolean') return this.legacyPlan(ctx, name, options);
    const requested = importOptions(options);
    await requireTrust(ctx.root);
    const source = await contained(ctx.root, ctx.config.application.sourceDir);
    const release = await sourceRelease(source);
    if (release !== '26.2') {
      if (requested.importMode === 'files')
        throw new Fault(
          'PARTIAL_IMPORT_UNSUPPORTED',
          'File import requires an Oracle-exported 26.2 source tree.',
          3,
        );
      return this.legacyPlan(ctx, name);
    }
    const versions = await this.oracle.targetVersions(
      await resolveConnection(environment(ctx, name).readConnectionRef),
    );
    if (
      !/^26\.2(?:\.|$)/.test(versions.apexVersion) ||
      !databaseMeetsApex262Minimum(versions.databaseVersion)
    )
      throw new Fault(
        'APEX_VERSION_MISMATCH',
        'APEX 26.2 sources require a qualified 26.2 target and supported database release.',
        3,
        'blocked',
      );
    const partial =
      requested.importMode === 'full'
        ? { reasons: ['full-import-requested'] }
        : await this.planFiles(ctx, name, requested);
    if ('plan' in partial && partial.plan) return partial.plan;
    if (requested.importMode === 'files')
      throw new Fault('PARTIAL_IMPORT_UNSUPPORTED', partial.reasons.join('; '), 3, 'blocked', {
        reasons: partial.reasons,
      });
    const full = await this.legacyPlan(ctx, name);
    const plan: DeployPlan = {
      ...full,
      schemaVersion: 4,
      mode: full.schemaVersion === 1 ? 'full-export' : full.mode,
      backupStrategy: full.schemaVersion === 1 ? 'fresh-export' : full.backupStrategy,
      workingCopy: full.schemaVersion === 1 ? null : full.workingCopy,
      composer: full.schemaVersion === 3 ? full.composer : null,
      importSelection: {
        requestedMode: requested.importMode,
        resolvedMode: 'full',
        files: [],
        reasons: partial.reasons,
        dependencies: [],
        before: null,
        effective: null,
        capabilities: { ...versions },
      },
    };
    plan.digest = planDigest(plan);
    return plan;
  }
  private async planFiles(
    ctx: ProjectContext,
    name: string,
    options: Required<ImportOptions>,
  ): Promise<{ plan?: DeployPlan; reasons: string[] }> {
    const env = environment(ctx, name);
    if (await isProductionTarget(env)) return { reasons: ['production-requires-full-import'] };
    const store = new SyncStore(ctx, env, name),
      working = await store.read();
    if (!working || working.status === 'invalidated') return { reasons: ['trusted-sync-baseline-required'] };
    await store.validate(working);
    const source = await syncPath(ctx, ctx.config.application.sourceDir);
    const sources = await sourceInventory(ctx),
      local = applicationFiles(ctx, sources);
    const connection = await resolveConnection(env.readConnectionRef);
    const versions = await this.oracle.targetVersions(connection);
    const capabilities = await this.oracle.partialImportCapabilities(source, versions);
    if (capabilities.compilerVersion !== working.compilerVersion)
      throw new Fault(
        'SYNC_COMPILER_CHANGED',
        'Refresh the working copy explicitly after a compiler upgrade.',
        5,
      );
    const current = await this.fingerprint(env, connection);
    try {
      if (!current.exported) return { reasons: ['existing-application-required'] };
      if (canonical(current.target) !== canonical(working.target))
        throw new Fault('SYNC_SERVER_CHANGED', 'Application identity changed since the sync baseline.', 5);
      const selected = selectImport(checkpoint(working).files, local, current.exported.files, options);
      const fallback = (reasons: string[]) => {
        if (selected.remoteChanges.length)
          throw new Fault(
            'SYNC_SERVER_CHANGED',
            'The server has changed and this selection needs a full import. Reconcile the observed remote changes before making a full plan.',
            5,
          );
        return { reasons };
      };
      // Conflicts are checked before falling back; full import must not conceal a conflict.
      if (!capabilities.supported) return fallback(capabilities.reasons);
      if (selected.reasons.length) return fallback(selected.reasons);
      for (const file of selected.files) sqlclToken(file);
      if (current.history.some((row) => row.status !== 'succeeded'))
        throw new Fault(
          'MIGRATION_HISTORY_CONFLICT',
          'Resolve earlier migration outcomes before deployment.',
          5,
        );
      checkMigrations(ctx, sources, current.history);
      const history = new Map(current.history.map((row) => [String(row.version), row]));
      for (const [file, sha] of Object.entries(sources)) {
        if (file.startsWith(ctx.config.database.packagesDir + '/'))
          return fallback(['database-operations-require-full-import']);
        if (file.startsWith(ctx.config.database.migrationsDir + '/')) {
          const old = history.get(path.basename(file));
          if (!old) return fallback(['database-operations-require-full-import']);
          if (old.checksum !== sha)
            throw new Fault('MIGRATION_HISTORY_CONFLICT', 'Applied migration changed.', 5);
        }
      }
      const id = randomUUID(),
        root = '.apexrest/plans/' + id;
      const before = await persistSnapshot(ctx, current.exported.directory, root + '/before');
      const effective = await stageSelection(
        ctx,
        before,
        source,
        selected.files,
        selected.effective,
        root + '/effective',
      );
      const validation = await this.oracle.validate(await syncPath(ctx, effective.directory));
      if (validation.compiler.version !== working.compilerVersion)
        throw new Fault('SYNC_COMPILER_CHANGED', 'Compiler changed while validating the import.', 5);
      if (canonical(await sourceInventory(ctx)) !== canonical(sources))
        throw new Fault('SOURCE_DRIFT', 'Sources changed during selected-file planning.', 5);
      const risks = (await securityChanged(
        { root: await syncPath(ctx, effective.directory), files: effective.files },
        { root: await syncPath(ctx, before.directory), files: before.files },
      ))
        ? ['authentication-or-authorization-change']
        : [];
      const createdAt = Date.now();
      const plan: DeployPlan = {
        schemaVersion: 4,
        mode: 'working-copy',
        backupStrategy: 'fresh-export',
        workingCopy: this.syncBinding(working),
        composer: await deploymentBinding(ctx),
        id,
        projectId: ctx.config.projectId,
        projectRoot: ctx.root,
        environment: name,
        createdAt: new Date(createdAt).toISOString(),
        expiresAt: new Date(createdAt + PLAN_LIFETIME_MS).toISOString(),
        sourceDigest: hash(canonical(sources)),
        sources,
        configurationDigest: hash(canonical(ctx.config)),
        toolchainDigest: hash(await readFile(await contained(ctx.root, ctx.config.toolchain.lockFile))),
        compiler: validation.compiler.version,
        targetDigest: targetDigest(env),
        target: current.target,
        fingerprint: current.fingerprint,
        migrationHistory: current.history,
        coordination: coordination(env),
        scope: 'selected-file-import',
        operations: [{ kind: 'import' }, { kind: 'verify' }],
        risks,
        approval: 'external-policy-required',
        backupRequired: true,
        digest: '0'.repeat(64),
        importSelection: {
          requestedMode: options.importMode,
          resolvedMode: 'files',
          files: selected.files,
          reasons: [],
          dependencies: selected.files.filter((file) => file.startsWith('shared-components/')),
          before,
          effective,
          capabilities,
          readbackPolicy: APEXLANG_EQUIVALENCE_POLICY,
        },
      };
      plan.digest = planDigest(plan);
      return { plan, reasons: [] };
    } finally {
      await this.oracle.discardStage?.(current.exported?.stage);
    }
  }
  private async legacyPlan(ctx: ProjectContext, name: string, restore = false): Promise<DeployPlan> {
    await requireTrust(ctx.root);
    const env = environment(ctx, name),
      connection = await resolveConnection(env.readConnectionRef);
    const syncStore = new SyncStore(ctx, env, name),
      stored = await syncStore.read();
    const working = !restore && stored?.status !== 'invalidated' ? stored : null;
    if (working) await syncStore.validate(working);
    if (restore && stored && ['importing', 'outcome_unknown'].includes(stored.status))
      throw new Fault('SYNC_BLOCKED', 'Reconcile interrupted writes before restore planning.', 5);
    // Target reads and compilation use independent inputs. Settle both before
    // returning an error so a failed preflight leaves no Oracle work running.
    const [targetCheck, sourceCheck] = await Promise.allSettled([
      working ? this.workingFingerprint(ctx, name, working) : this.fingerprint(env, connection),
      (async () => {
        const sources = await sourceInventory(ctx);
        const validation = await this.oracle.validate(
          await contained(ctx.root, ctx.config.application.sourceDir),
        );
        const lock = await contained(ctx.root, ctx.config.toolchain.lockFile);
        if (!(await exists(lock)))
          throw new Fault('TOOLCHAIN_LOCK_REQUIRED', 'The project needs its pinned toolchain lock.', 3);
        return { sources, validation, lock };
      })(),
    ]);
    if (targetCheck.status === 'rejected') throw targetCheck.reason;
    if (sourceCheck.status === 'rejected') throw sourceCheck.reason;
    const current = targetCheck.value,
      { sources, validation, lock } = sourceCheck.value,
      risks: string[] = [];
    if (working && validation.compiler.version !== working.compilerVersion)
      throw new Fault(
        'SYNC_COMPILER_CHANGED',
        'SQLcl compiler version changed. Explicit working-copy refresh is required.',
        5,
      );
    const operations: DeployPlan['operations'] = [];
    const history = new Map(current.history.map((row) => [String(row.version), row]));
    if (current.history.some((row) => row.status !== 'succeeded'))
      throw new Fault(
        'MIGRATION_HISTORY_CONFLICT',
        'An earlier migration has an unresolved outcome. Reconcile it before any new deployment.',
        5,
      );
    checkMigrations(ctx, sources, current.history);
    for (const [file, sha256] of Object.entries(sources)) {
      const migration = file.startsWith(ctx.config.database.migrationsDir + '/');
      const pkg = file.startsWith(ctx.config.database.packagesDir + '/');
      if (!migration && !pkg) continue;
      if (!file.endsWith('.sql'))
        throw new Fault('UNSUPPORTED_DB_SOURCE', 'Database execution directories accept .sql files only.', 3);
      const sql = await readFile(await contained(ctx.root, file), 'utf8');
      risks.push(...migrationRisk(sql).map((r) => `${r}:${file}`));
      if (migration) {
        const version = path.basename(file);
        if (!/^\d{4,}__[A-Za-z0-9_-]+\.sql$/.test(version))
          throw new Fault(
            'INVALID_MIGRATION_NAME',
            'Use ordered immutable migration names such as 0001__customers.sql.',
            2,
          );
        const previous = history.get(version);
        if (previous && (previous.checksum !== sha256 || previous.status !== 'succeeded'))
          throw new Fault(
            'MIGRATION_HISTORY_CONFLICT',
            'An existing migration changed checksum or has an unresolved outcome.',
            5,
          );
        if (!previous) operations.push({ kind: 'migration', file, sha256 });
      } else operations.push({ kind: 'package', file, sha256 });
    }
    if (working && operations.some((o) => ['migration', 'package'].includes(o.kind)))
      throw new Fault(
        'SYNC_DB_OPERATIONS_INCOMPATIBLE',
        'Invalidate working-copy mode explicitly before database operations.',
        5,
      );
    if (current.exported) {
      try {
        if (
          await securityChanged(
            {
              root: await contained(ctx.root, ctx.config.application.sourceDir),
              files: applicationFiles(ctx, sources),
            },
            { root: path.resolve(ctx.root, current.exported.directory), files: current.exported.files },
          )
        )
          risks.push('authentication-or-authorization-change');
      } finally {
        if (!working) await this.oracle.discardStage?.((current.exported as { stage?: string }).stage);
      }
    }
    operations.sort(operationOrder);
    operations.push({ kind: 'import' }, { kind: 'verify' });
    const createdAt = Date.now();
    const plan: DeployPlan = {
      schemaVersion: 2,
      mode: working ? 'working-copy' : 'full-export',
      backupStrategy: working ? 'initial-backup' : 'fresh-export',
      workingCopy: working ? this.syncBinding(working) : null,
      id: randomUUID(),
      projectId: ctx.config.projectId,
      projectRoot: ctx.root,
      environment: name,
      createdAt: new Date(createdAt).toISOString(),
      expiresAt: new Date(createdAt + PLAN_LIFETIME_MS).toISOString(),
      sourceDigest: hash(canonical(sources)),
      sources,
      configurationDigest: hash(canonical(ctx.config)),
      toolchainDigest: hash(await readFile(lock)),
      compiler: validation.compiler.version,
      targetDigest: targetDigest(env),
      target: current.target,
      fingerprint: current.fingerprint,
      migrationHistory: current.history,
      coordination: coordination(env),
      scope: 'full-application-import',
      operations,
      risks: [...new Set(risks)],
      approval: 'external-policy-required',
      backupRequired: !!current.target.application,
      digest: '0'.repeat(64),
    };
    const composer = await deploymentBinding(ctx);
    const bound: DeployPlan = composer ? { ...plan, schemaVersion: 3, composer } : plan;
    bound.digest = planDigest(bound);
    return bound;
  }
  syncBinding(state: SyncState) {
    return {
      syncId: state.syncId,
      revision: state.revision,
      baselineDigest: state.baseline.digest,
      checkpointDigest: checkpoint(state).digest,
      backupId: state.backup.backupId,
      backupChecksum: state.backup.checksum,
    };
  }
  async checkWorkingPlan(ctx: ProjectContext, plan: DeployPlan, permitImporting = false) {
    const store = new SyncStore(ctx, environment(ctx, plan.environment), plan.environment),
      state = await store.read();
    if (plan.restore && state && ['importing', 'outcome_unknown'].includes(state.status))
      throw new Fault('SYNC_BLOCKED', 'Reconcile interrupted imports before restoring.', 5);
    if (state && state.status !== 'invalidated' && !plan.restore) {
      if (
        plan.schemaVersion === 1 ||
        plan.mode !== 'working-copy' ||
        canonical(plan.workingCopy) !== canonical(this.syncBinding(state)) ||
        plan.compiler !== state.compilerVersion
      )
        throw new Fault(
          'SYNC_REPLAN_REQUIRED',
          'Plan does not bind the current working-copy revision. Re-plan.',
          5,
        );
      const reviewed = checkpoint(state);
      if (
        !plan.risks.includes('authentication-or-authorization-change') &&
        !(plan.schemaVersion === 4 && plan.importSelection.resolvedMode === 'files') &&
        (await securityChanged(
          {
            root: await contained(ctx.root, ctx.config.application.sourceDir),
            files: applicationFiles(ctx, plan.sources),
          },
          { root: await syncPath(ctx, reviewed.directory), files: reviewed.files },
        ))
      )
        throw new Fault('PLAN_TAMPERED', 'Plan omits an authentication or authorization change.', 5);
      await store.validate(state, !(permitImporting && state.status === 'importing'));
      if (plan.operations.some((o) => ['migration', 'package'].includes(o.kind)))
        throw new Fault(
          'SYNC_DB_OPERATIONS_INCOMPATIBLE',
          'Working-copy plans cannot execute database operations.',
          5,
        );
      return state;
    }
    if (plan.schemaVersion !== 1 && plan.mode === 'working-copy')
      throw new Fault('SYNC_REPLAN_REQUIRED', 'The reviewed working copy is no longer active.', 5);
    return null;
  }
  async checkLocal(ctx: ProjectContext, value: unknown, permitImporting = false) {
    const plan = parse(deployPlanSchema, value),
      env = environment(ctx, plan.environment);
    const composer = await deploymentBinding(ctx);
    if (
      canonical(composer) !==
      canonical(plan.schemaVersion === 3 || plan.schemaVersion === 4 ? plan.composer : null)
    )
      throw new Fault(
        'COMPOSITION_REPLAN_REQUIRED',
        'Deployment plan must bind the current materialized Composer generation.',
        5,
      );
    if (plan.sourceDigest !== hash(canonical(plan.sources)) || plan.digest !== planDigest(plan))
      throw new Fault('PLAN_TAMPERED', 'Plan digest verification failed.', 5);
    if (
      plan.projectId !== ctx.config.projectId ||
      plan.projectRoot !== ctx.root ||
      plan.targetDigest !== targetDigest(env)
    )
      throw new Fault('PLAN_TARGET_MISMATCH', 'Plan project or target differs from the current request.', 5);
    if (Date.parse(plan.expiresAt) <= Date.now())
      throw new Fault('PLAN_EXPIRED', 'Create and review a new plan.', 5);
    const lifetime = Date.parse(plan.expiresAt) - Date.parse(plan.createdAt);
    if (!(lifetime > 0 && lifetime <= PLAN_LIFETIME_MS) || Date.parse(plan.createdAt) > Date.now() + 60000)
      throw new Fault('PLAN_TAMPERED', 'Plan lifetime exceeds the reviewed plan limit.', 5);
    if (
      plan.sourceDigest !== hash(canonical(await sourceInventory(ctx))) ||
      plan.configurationDigest !== hash(canonical(ctx.config)) ||
      plan.toolchainDigest !== hash(await readFile(await contained(ctx.root, ctx.config.toolchain.lockFile)))
    )
      throw new Fault('SOURCE_DRIFT', 'Sources, configuration or toolchain lock changed after review.', 5);
    if (plan.backupRequired !== Boolean(plan.target.application))
      throw new Fault('PLAN_TAMPERED', 'Backup requirement does not match reviewed target.', 5);
    if (canonical(plan.coordination) !== canonical(coordination(env)))
      throw new Fault(
        'CONTROL_STORE_CHANGED',
        'Deployment control mode or local history store changed. Re-plan using the original durable state.',
        5,
      );
    const expected: DeployPlan['operations'] = [];
    if (!plan.restore) {
      checkMigrations(ctx, plan.sources, plan.migrationHistory);
      const history = new Map(plan.migrationHistory.map((row) => [String(row.version), row]));
      for (const [file, sha256] of Object.entries(plan.sources)) {
        const kind = file.startsWith(ctx.config.database.migrationsDir + '/')
          ? 'migration'
          : file.startsWith(ctx.config.database.packagesDir + '/')
            ? 'package'
            : undefined;
        if (!kind) continue;
        if (!file.endsWith('.sql'))
          throw new Fault('UNSUPPORTED_DB_SOURCE', 'Database sources must be SQL files.', 5);
        const previous = history.get(path.basename(file));
        if (
          kind === 'migration' &&
          previous &&
          (previous.checksum !== sha256 || previous.status !== 'succeeded')
        )
          throw new Fault('MIGRATION_HISTORY_CONFLICT', 'Migration requires reconciliation.', 5);
        if (kind !== 'migration' || !previous) expected.push({ kind, file, sha256 });
        const risks = migrationRisk(await readFile(await contained(ctx.root, file), 'utf8')).map(
          (r) => `${r}:${file}`,
        );
        if (risks.some((r) => !plan.risks.includes(r)))
          throw new Fault('PLAN_TAMPERED', 'Plan omits a SQL risk.', 5);
      }
      expected.sort(operationOrder);
    }
    expected.push({ kind: 'import' }, { kind: 'verify' });
    if (canonical(expected) !== canonical(plan.operations))
      throw new Fault(
        'PLAN_TAMPERED',
        'Plan operations do not match reviewed sources and migration history.',
        5,
      );
    await this.checkWorkingPlan(ctx, plan, permitImporting);
    if (plan.schemaVersion === 4 && plan.importSelection.resolvedMode === 'files') {
      const selection = plan.importSelection;
      if (
        selection.before!.directory !== '.apexrest/plans/' + plan.id + '/before' ||
        selection.effective!.directory !== '.apexrest/plans/' + plan.id + '/effective'
      )
        throw new Fault('PLAN_TAMPERED', 'Selected-import artifacts must belong to this plan.', 5);
      await checkSnapshot(ctx, selection.before!);
      await checkSnapshot(ctx, selection.effective!);
      const working = await this.checkWorkingPlan(ctx, plan, permitImporting);
      const selected = selectImport(
        checkpoint(working!).files,
        applicationFiles(ctx, plan.sources),
        selection.before!.files,
        {
          importMode: selection.requestedMode,
          ...(selection.requestedMode === 'files' ? { files: selection.files } : {}),
        },
      );
      if (
        selected.reasons.length ||
        canonical(selected.files) !== canonical(selection.files) ||
        canonical(selected.effective) !== canonical(selection.effective!.files)
      )
        throw new Fault('PLAN_TAMPERED', 'Selected files do not match the reviewed three-way comparison.', 5);
      if (
        await securityChanged(
          { root: await syncPath(ctx, selection.effective!.directory), files: selection.effective!.files },
          { root: await syncPath(ctx, selection.before!.directory), files: selection.before!.files },
        )
      )
        throw new Fault(
          'RECOVERY_REVIEW_REQUIRED',
          'Selected import changes authentication or authorization.',
          4,
          'blocked',
        );
    }
    return { plan, env };
  }
  /** Acquire or re-confirm local schema ownership. No Oracle objects are touched. */
  async lease(env: Environment, runId: string, acquire: boolean) {
    const control = new LocalDeploymentControl(env);
    if (acquire) await control.acquire(runId);
    else await control.assertOwner(runId);
  }
  async apply(
    ctx: ProjectContext,
    value: unknown,
    signal?: AbortSignal,
    progress?: (state: DeployState) => void,
  ) {
    await this.checkLocal(ctx, value);
    return withLock(await contained(ctx.root, '.apexrest/composer/ownership.lock'), () =>
      this.applyLocked(ctx, value, signal, progress),
    );
  }
  private async applyLocked(
    ctx: ProjectContext,
    value: unknown,
    signal?: AbortSignal,
    progress?: (state: DeployState) => void,
  ) {
    if (signal?.aborted)
      throw new Fault('CANCELLED', 'Deployment cancelled before execution.', 6, 'cancelled');
    const { plan, env } = await this.checkLocal(ctx, value);
    const selection =
      plan.schemaVersion === 4 && plan.importSelection.resolvedMode === 'files' ? plan.importSelection : null;
    await authorizePlan(ctx, plan, env);
    await this.oracle.requireMutationSupport();
    const readConnection = await resolveConnection(env.readConnectionRef),
      deployConnection = await resolveConnection(env.deployConnectionRef);
    let working = await this.checkWorkingPlan(ctx, plan);
    const syncStore = new SyncStore(ctx, env, plan.environment);
    const [deployTargetCheck, fingerprintCheck, capabilityCheck] = await Promise.allSettled([
      this.oracle.verifyTarget(env, deployConnection),
      working && !selection
        ? this.workingFingerprint(ctx, plan.environment, working)
        : this.fingerprint(env, readConnection),
      this.oracle.requireCapability('import'),
    ]);
    const liveStage =
      (!working || selection) && fingerprintCheck.status === 'fulfilled'
        ? (fingerprintCheck.value.exported as { stage?: string } | null)?.stage
        : undefined;
    try {
      if (deployTargetCheck.status === 'rejected') throw deployTargetCheck.reason;
      if (fingerprintCheck.status === 'rejected') throw fingerprintCheck.reason;
      const live = fingerprintCheck.value;
      if (live.fingerprint !== plan.fingerprint)
        throw new Fault('TARGET_DRIFT', 'Target or migration history changed after review.', 5);
      // The fingerprint covers the observed target; the plan's own copies must match it too.
      if (
        canonical(live.target) !== canonical(plan.target) ||
        canonical(live.history) !== canonical(plan.migrationHistory)
      )
        throw new Fault('PLAN_TAMPERED', 'Plan target or migration history differs from the live target.', 5);
      // Recompute security risk from the live export instead of trusting plan.risks.
      if (
        !working &&
        !plan.restore &&
        live.exported &&
        !plan.risks.includes('authentication-or-authorization-change') &&
        (await securityChanged(
          {
            root: await contained(ctx.root, ctx.config.application.sourceDir),
            files: applicationFiles(ctx, plan.sources),
          },
          { root: live.exported.directory, files: live.exported.files },
        ))
      )
        throw new Fault('PLAN_TAMPERED', 'Plan omits an authentication or authorization change.', 5);
    } finally {
      await this.oracle.discardStage?.(liveStage);
    }
    // Backup necessity follows the live target, never only the plan's claim.
    const liveApplication =
      (fingerprintCheck.value.target.application as { alias?: unknown } | null) ??
      (deployTargetCheck.value.application as { alias?: unknown } | null);
    if (capabilityCheck.status === 'rejected') throw capabilityCheck.reason;
    const capability = capabilityCheck.value;
    if (capability.version !== plan.compiler)
      throw new Fault('COMPILER_DRIFT', 'SQLcl version changed after plan.', 5);
    if (plan.schemaVersion === 4 && !selection && plan.importSelection.capabilities.apexVersion) {
      const versions = await this.oracle.targetVersions(readConnection);
      if (canonical(versions) !== canonical(plan.importSelection.capabilities))
        throw new Fault('TARGET_DRIFT', 'Target release changed after the full-import plan.', 5);
    }
    if (selection) {
      const observed = await this.oracle.partialImportCapabilities(
        await syncPath(ctx, selection.effective!.directory),
        await this.oracle.targetVersions(readConnection),
      );
      if (!observed.supported || canonical(observed) !== canonical(selection.capabilities))
        throw new Fault('COMPILER_DRIFT', 'Selected-import capabilities changed after planning.', 5);
    }
    if (signal?.aborted)
      throw new Fault('CANCELLED', 'Deployment cancelled before lease acquisition.', 6, 'cancelled');
    const runId = randomUUID(),
      runs = path.join(ctx.root, '.apexrest/deployments'),
      runDir = path.join(runs, runId);
    await mkdir(runDir, { recursive: true, mode: 0o700 });
    let state: DeployState = 'planned',
      writeStarted = false,
      importConfirmed = false,
      syncMarked = false,
      syncSucceeded = false;
    let freshBackupId: string | null = null;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const record = async (nextState: DeployState, details: unknown = {}) => {
      assertTransition(state, nextState);
      state = nextState;
      // Progress is informational for job status; the journal stays the record.
      try {
        progress?.(nextState);
      } catch {
        /* Observers never alter deployment outcome. */
      }
      const event = {
        runId,
        planId: plan.id,
        planDigest: plan.digest,
        targetDigest: plan.targetDigest,
        state,
        at: new Date().toISOString(),
        details,
      };
      await appendJournal(runDir, event);
    };
    await writeJson(path.join(runDir, 'plan.json'), plan);
    await record('approved');
    await this.lease(env, runId, true);
    try {
      await record('backing_up');
      working = await this.checkWorkingPlan(ctx, plan);
      if (working) await checkSyncBackup(ctx, working.backup, plan.targetDigest, plan.environment);
      if ((plan.backupRequired || liveApplication) && (!working || selection)) {
        const backup = await this.oracle.exportApplication(env, readConnection, 'SQL');
        try {
          const backupId = randomUUID(),
            directory = path.join(ctx.root, '.apexrest/backups', backupId);
          await mkdir(directory, { recursive: true, mode: 0o700 });
          await privateCopy(backup.directory, path.join(directory, 'application'));
          const files = await inventory(path.join(directory, 'application'));
          if (!Object.keys(files).length || hash(canonical(files)) !== backup.digest)
            throw new Fault('BACKUP_INVALID', 'Backup copy failed checksum verification.', 1);
          await writeJson(path.join(directory, 'backup.json'), {
            schemaVersion: 1,
            backupId,
            runId,
            planDigest: plan.digest,
            targetDigest: plan.targetDigest,
            environment: plan.environment,
            digest: backup.digest,
            files,
            ...(typeof liveApplication?.alias === 'string' ? { alias: liveApplication.alias } : {}),
            restoreProcedure:
              'Reviewed SQL export import; application metadata only. Schema/data recovery is separate.',
          });
          freshBackupId = backupId;
          await writeJson(path.join(runDir, 'backup.json'), {
            backupId,
            checksum: backup.digest,
            targetDigest: plan.targetDigest,
          });
        } finally {
          await this.oracle.discardStage?.((backup as { stage?: string }).stage);
        }
      }
      await this.checkLocal(ctx, plan);
      const after =
        working && !selection
          ? await this.workingFingerprint(ctx, plan.environment, working)
          : await this.fingerprint(env, readConnection);
      if (!working || selection)
        await this.oracle.discardStage?.((after.exported as { stage?: string } | null)?.stage);
      if (after.fingerprint !== plan.fingerprint)
        throw new Fault('TARGET_DRIFT', 'Target changed during backup.', 5);
      // Execute a frozen copy. A later working-tree edit cannot alter reviewed bytes.
      const snapshot = path.join(runDir, 'snapshot');
      await mkdir(snapshot, { mode: 0o700 });
      for (const [file, sha] of Object.entries(plan.sources)) {
        const source = await contained(ctx.root, file),
          destination = await contained(snapshot, file);
        await mkdir(path.dirname(destination), { recursive: true });
        await cp(source, destination);
        if (hash(await readFile(destination)) !== sha)
          throw new Fault('SOURCE_DRIFT', 'Source changed while freezing deployment.', 5);
      }
      if (selection) {
        await checkSnapshot(ctx, selection.effective!);
        const application = path.join(snapshot, ctx.config.application.sourceDir);
        await rm(application, { recursive: true });
        await privateCopy(await syncPath(ctx, selection.effective!.directory), application);
        if (canonical(await inventory(application)) !== canonical(selection.effective!.files))
          throw new Fault('SOURCE_DRIFT', 'Selected source changed while freezing deployment.', 5);
      }
      if (controller.signal.aborted)
        throw new Fault('CANCELLED', 'Deployment cancelled before writes.', 6, 'cancelled');
      if (working) {
        await syncStore.lock(async () => {
          await this.checkWorkingPlan(ctx, plan);
          await syncStore.write({ ...working!, status: 'importing', importingRunId: runId });
          syncMarked = true;
        });
      }
      await record('migrating');
      // Once writes begin, ownership is never automatically reclaimed. It must be reconciled.
      await new LocalDeploymentControl(env).markWriting(runId);
      for (const operation of plan.operations.filter((o) => ['migration', 'package'].includes(o.kind))) {
        if (controller.signal.aborted)
          throw new Fault(
            'LEASE_OR_CANCELLATION',
            'Execution was interrupted.',
            6,
            writeStarted ? 'outcome_unknown' : 'cancelled',
          );
        await this.lease(env, runId, false);
        const file = await contained(snapshot, operation.file!);
        if (operation.kind === 'migration')
          await new LocalDeploymentControl(env).migration(
            runId,
            path.basename(file),
            operation.sha256!,
            'started',
          );
        writeStarted = true;
        // User scripts run restricted (no host/spool/save); level 2 still allows @file.
        await this.oracle.session(
          `@${sqlclToken(file)}\nprompt APEXREST_SCRIPT_COMPLETE`,
          deployConnection,
          true,
          controller.signal,
          undefined,
          'text',
          SCRIPT_RESTRICT_LEVEL,
        );
        if (operation.kind === 'migration')
          await new LocalDeploymentControl(env).migration(
            runId,
            path.basename(file),
            operation.sha256!,
            'succeeded',
          );
      }
      await record('importing');
      await this.lease(env, runId, false);
      await this.oracle.verifyTarget(env, deployConnection);
      if (plan.restore) {
        const backupRoot = await contained(
          ctx.root,
          '.apexrest/backups/' + plan.restore.backupId + '/application',
        );
        if (hash(canonical(await inventory(backupRoot))) !== plan.restore.checksum)
          throw new Fault('BACKUP_INVALID', 'Restore source changed after approval.', 5);
        const frozen = path.join(runDir, 'restore');
        await privateCopy(backupRoot, frozen);
        const files = await inventory(frozen);
        if (hash(canonical(files)) !== plan.restore.checksum)
          throw new Fault('BACKUP_INVALID', 'Restore copy changed.', 5);
        const main = Object.keys(files).filter((f) => /^f\d+\.sql$/i.test(f));
        if (main.length !== 1)
          throw new Fault(
            'RESTORE_LAYOUT_UNSUPPORTED',
            'Restore requires one complete non-split Oracle SQL export.',
            3,
          );
        const restoredSync = await syncStore.read();
        if (restoredSync && restoredSync.status !== 'invalidated')
          await syncStore.lock(() =>
            syncStore.write({ ...restoredSync, status: 'invalidated', revision: restoredSync.revision + 1 }),
          );
        writeStarted = true;
        await this.oracle.restoreApplication(
          env,
          deployConnection,
          path.join(frozen, main[0]!),
          controller.signal,
        );
      } else {
        if (
          selection &&
          canonical(await inventory(path.join(snapshot, ctx.config.application.sourceDir))) !==
            canonical(selection.effective!.files)
        )
          throw new Fault('SOURCE_DRIFT', 'Frozen selected source changed before import.', 5);
        if (controller.signal.aborted)
          throw new Fault('CANCELLED', 'Deployment cancelled before import.', 6, 'cancelled');
        writeStarted = true;
        await this.oracle.importApplication(
          ctx,
          env,
          deployConnection,
          path.join(snapshot, ctx.config.application.sourceDir),
          controller.signal,
          selection?.files,
        );
      }
      importConfirmed = true;
      let serverSnapshot: Awaited<ReturnType<typeof persistSnapshot>> | null = null;
      let target: Awaited<ReturnType<OracleAdapter['verifyTarget']>>;
      try {
        await record('verifying');
        target = await this.oracle.verifyTarget(env, readConnection);
        // A restored app may have been absent at plan time; use the alias recorded with the backup.
        const expectedAlias = plan.restore
          ? (plan.restore.alias ??
            (plan.target.application as { alias?: unknown } | null | undefined)?.alias ??
            ctx.config.application.alias)
          : ctx.config.application.alias;
        if (
          !target.application ||
          String(target.application.alias).toLowerCase() !== String(expectedAlias).toLowerCase()
        )
          throw new Fault('POST_DEPLOY_IDENTITY_FAILED', 'Expected imported app was not found.', 1);
        if (selection) {
          const observed = await this.oracle.exportApplication(env, readConnection, 'APEXLANG');
          try {
            serverSnapshot = await persistSnapshot(
              ctx,
              observed.directory,
              '.apexrest/deployments/' + runId + '/server/' + ctx.config.application.sourceDir,
            );
            const comparison =
              selection.readbackPolicy === APEXLANG_EQUIVALENCE_POLICY
                ? await compareApplicationExports(
                    await syncPath(ctx, selection.effective!.directory),
                    await syncPath(ctx, serverSnapshot.directory),
                    selection.effective!.files,
                    serverSnapshot.files,
                    selection.files,
                  )
                : {
                    equivalent: canonical(serverSnapshot.files) === canonical(selection.effective!.files),
                    policy: 'exact-bytes',
                    normalizations: [],
                  };
            await writeJson(path.join(runDir, 'readback-verification.json'), comparison);
            if (!comparison.equivalent)
              throw new Fault(
                'POST_DEPLOY_CONTENT_FAILED',
                'Import confirmed but readback differs from the reviewed result; reconcile the retained server snapshot.',
                5,
              );
          } finally {
            await this.oracle.discardStage?.(observed.stage);
          }
        }
      } catch (error) {
        // The import itself was confirmed. An unexpected verification error is a
        // verification failure, not an unknown import outcome.
        if (error instanceof Fault) throw error;
        throw new Fault(
          'POST_DEPLOY_VERIFICATION_FAILED',
          `Import was confirmed but verification failed: ${error instanceof Error ? error.message : 'unexpected error'}`,
          1,
        );
      }
      if (working) {
        await this.completeWorkingCopy(
          ctx,
          plan,
          env,
          readConnection,
          runId,
          working,
          target,
          serverSnapshot,
        );
        syncSucceeded = true;
      }
      await record('succeeded');
      return { runId, state, directory: runDir, ...(freshBackupId ? { backupId: freshBackupId } : {}) };
    } catch (error) {
      const unknown = writeStarted && (!importConfirmed || !(error instanceof Fault) || error.exitCode === 6);
      if (working && syncMarked) {
        try {
          await syncStore.lock(async () => {
            const owned = await syncStore.read();
            if (!owned || (owned.importingRunId !== runId && owned.lastSuccessfulImport?.runId !== runId))
              throw new Error('Sync ownership changed during failure recording.');
            const status = unknown ? 'outcome_unknown' : writeStarted ? 'verification_failed' : 'ready';
            // Once this run's success checkpoint is durable, never roll it back
            // to the pre-import state; only the status may change.
            await syncStore.write(
              syncSucceeded || owned.lastSuccessfulImport?.runId === runId
                ? { ...owned, status, importingRunId: status === 'ready' ? null : runId }
                : { ...working!, importingRunId: writeStarted ? runId : null, status },
            );
          });
        } catch {
          state = 'outcome_unknown';
          throw new Fault(
            'OUTCOME_UNKNOWN',
            `Deployment ${runId} needs reconciliation; durable sync state could not be saved.`,
            6,
            'outcome_unknown',
          );
        }
      }
      await record(unknown ? 'outcome_unknown' : 'failed', {
        code: error instanceof Fault ? error.code : 'UNEXPECTED_FAILURE',
      });
      if (unknown)
        throw new Fault(
          'OUTCOME_UNKNOWN',
          `Deployment ${runId} requires reconciliation before retry.`,
          6,
          'outcome_unknown',
        );
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
      // An unknown outcome retains writing ownership until it is reconciled.
      if ((state as DeployState) !== 'outcome_unknown')
        await new LocalDeploymentControl(env).release(runId).catch(() => {});
    }
  }
  /** Record a confirmed, verified import as the working copy's new successful checkpoint. */
  private async completeWorkingCopy(
    ctx: ProjectContext,
    plan: DeployPlan,
    env: Environment,
    readConnection: Connection,
    runId: string,
    working: SyncState,
    target: Awaited<ReturnType<OracleAdapter['verifyTarget']>>,
    serverSnapshot: Awaited<ReturnType<typeof persistSnapshot>> | null,
  ) {
    const selection =
      plan.schemaVersion === 4 && plan.importSelection.resolvedMode === 'files' ? plan.importSelection : null;
    const syncStore = new SyncStore(ctx, env, plan.environment);
    const metadata = await this.oracle.applicationMetadata(env, readConnection);
    const directory = '.apexrest/deployments/' + runId + '/snapshot/' + ctx.config.application.sourceDir;
    const files = await inventory(await syncPath(ctx, directory));
    const snapshot = serverSnapshot ?? { directory, files, digest: hash(canonical(files)) };
    if (selection && serverSnapshot) {
      try {
        await rebaseAfterImport(
          ctx,
          runId,
          applicationFiles(ctx, plan.sources),
          checkpoint(working).files,
          serverSnapshot,
          selection.files,
        );
      } catch (error) {
        if (error instanceof Fault) throw error;
        throw new Fault(
          'LOCAL_RECONCILIATION_REQUIRED',
          'Import confirmed; local rebase failed. Inspect the retained source and server snapshots.',
          5,
        );
      }
    }
    await syncStore.lock(async () => {
      const state = await syncStore.read();
      if (!state || state.importingRunId !== runId || state.revision !== working.revision)
        throw new Error('Sync ownership changed after import.');
      await syncStore.write({
        ...state,
        status: 'ready',
        revision: state.revision + 1,
        importingRunId: null,
        observedMetadata: metadata,
        target,
        lastSuccessfulImport: { at: new Date().toISOString(), runId, snapshot },
      });
    });
  }
  async reconcile(ctx: ProjectContext, runId: string) {
    parse(z.uuid(), runId);
    const directory = await contained(ctx.root, '.apexrest/deployments/' + runId);
    const plan = parse(deployPlanSchema, await readJson(path.join(directory, 'plan.json'))),
      env = environment(ctx, plan.environment);
    const current = await this.fingerprint(env, await resolveConnection(env.readConnectionRef));
    const state = await readJson(path.join(directory, 'state.json'));
    const selection =
      plan.schemaVersion === 4 && plan.importSelection.resolvedMode === 'files' ? plan.importSelection : null;
    let comparison: Awaited<ReturnType<typeof compareApplicationExports>> | null = null;
    try {
      if (selection?.readbackPolicy === APEXLANG_EQUIVALENCE_POLICY && current.exported) {
        await checkSnapshot(ctx, selection.effective!);
        comparison = await compareApplicationExports(
          await syncPath(ctx, selection.effective!.directory),
          current.exported.directory,
          selection.effective!.files,
          current.exported.files,
          selection.files,
        );
      }
    } finally {
      await this.oracle.discardStage?.((current.exported as { stage?: string } | null)?.stage);
    }
    return {
      runId,
      state,
      currentTarget: current.target,
      currentFingerprint: current.fingerprint,
      comparisonProvenance: 'explicit-live-export',
      targetUnchanged: selection
        ? current.fingerprint === plan.fingerprint
        : plan.schemaVersion !== 1 && plan.mode === 'working-copy'
          ? canonical(current.target) === canonical(plan.target) &&
            canonical(current.history) === canonical(plan.migrationHistory) &&
            current.exported?.digest === plan.workingCopy!.checkpointDigest
          : current.fingerprint === plan.fingerprint,
      importedSourcesMatch: comparison
        ? comparison.equivalent
        : current.exported
          ? canonical(current.exported.files) ===
            canonical(
              selection
                ? selection.effective!.files
                : Object.fromEntries(
                    Object.entries(plan.sources)
                      .filter(([file]) => file.startsWith(ctx.config.application.sourceDir + '/'))
                      .map(([file, sha]) => [file.slice(ctx.config.application.sourceDir.length + 1), sha]),
                  ),
            )
          : false,
      history: current.history,
      retryAllowed: false,
      ...(selection
        ? {
            importMode: 'files',
            selectedFiles: selection.files,
            beforeDigest: selection.before!.digest,
            expectedDigest: selection.effective!.digest,
            actualDigest: current.exported?.digest ?? null,
            readbackComparison: comparison,
          }
        : {}),
      nextActions: [
        'Review target export and migration history. Reconciliation does not assume process termination rolled back Oracle.',
      ],
    };
  }
  async restorePlan(ctx: ProjectContext, backupId: string) {
    parse(z.uuid(), backupId);
    const directory = await contained(ctx.root, '.apexrest/backups/' + backupId);
    const backup = (await readJson(path.join(directory, 'backup.json'))) as {
      digest: string;
      environment: string;
      targetDigest: string;
      alias?: unknown;
    };
    const files = await inventory(path.join(directory, 'application'));
    if (hash(canonical(files)) !== backup.digest)
      throw new Fault('BACKUP_INVALID', 'Backup digest does not match.', 5);
    const plan = await this.plan(ctx, backup.environment, true);
    if (plan.targetDigest !== backup.targetDigest)
      throw new Fault('BACKUP_TARGET_MISMATCH', 'Backup belongs to another target.', 5);
    // Record the backed-up alias: the application may be absent when restoring.
    const alias =
      typeof backup.alias === 'string'
        ? backup.alias
        : (plan.target.application as { alias?: unknown } | null)?.alias;
    plan.restore = {
      backupId,
      checksum: backup.digest,
      ...(typeof alias === 'string' && refName.safeParse(alias).success ? { alias } : {}),
    };
    plan.risks = ['application-restore'];
    plan.operations = [{ kind: 'import' }, { kind: 'verify' }];
    plan.digest = planDigest(plan);
    return plan;
  }
}
