import { withSqlclTimings, sqlclTimings } from './sqlcl-timings.ts';
import { withConnectedReads } from './sqlcl-read-scope.ts';
import path from 'node:path';
import { readFile, mkdir, cp, open, readdir, rename, rm, rmdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  atomicWrite,
  canonical,
  contained,
  exists,
  hash,
  inventory,
  readJson,
  writeJson,
  withLock,
} from './fs.ts';
import {
  environment,
  isProductionTarget,
  managedHome,
  parse,
  policy,
  refName,
  refuseProductionDeployment,
} from './config.ts';
import type { ProjectContext, Environment } from './config.ts';
import { resolveConnection } from './connections.ts';
import type { Connection } from './connections.ts';
import { recordRevision, revisionOf } from './revision.ts';
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
import { verifyDeploymentPredicates } from './composer/service.ts';
import { VERSION } from './version.ts';
import { inspectSql, executableSql, type DatabaseOperation } from './sql-review.ts';
import { APEXLANG_EQUIVALENCE_POLICY, compareApplicationExports } from './apexlang-equivalence.ts';
import { databaseMeetsApex262Minimum } from './compatibility.ts';
import { generatedSourceNormalizations, type SourceNormalization } from './sync-normalization.ts';
import {
  importOptions,
  importSelectionSchema,
  sourceRelease,
  selectImport,
  persistSnapshot,
  stageSelection,
  rebaseAfterImport,
  changedFiles,
  scopedExportFile,
  supportedFile,
  pickFiles,
  overlaySelection,
  type ImportOptions,
} from './partial-import.ts';
export type { ImportOptions } from './partial-import.ts';
export type DeploymentPlanOptions = ImportOptions;
export { targetDigest } from './sync.ts';
/** The export a plan observed, kept in private project storage for its apply. */
const planObservationDirectory = (planId: string) => '.apexrest/plans/' + planId + '/live-before';
/**
 * Oracle errors after which the database session's fate is not known to the client (lost or
 * killed connection). An import that failed this way is never classified as rejected.
 */
const CONNECTION_LOST =
  /ORA-(?:03113|03114|03135|00028|01012|125\d\d|17002|17008)|not connected|closed connection|IO Error|broken pipe/i;
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
  // Package scripts already applied with these checksums are not re-run (absent in older plans).
  packageHistory: z.record(z.string(), digestSchema).optional(),
  // Always the local durable store; the shape is kept so existing plan digests stay stable.
  coordination: z.strictObject({
    backend: z.literal('local'),
    scope: z.literal('managed-home-schema'),
    storeDigest: digestSchema,
  }),
  // database-only plans run migrations and changed package scripts without an application import.
  scope: z.enum(['full-application-import', 'database-only']),
  operations: z.array(
    z.strictObject({
      kind: z.enum(['migration', 'package', 'import', 'verify']),
      file: z.string().optional(),
      sha256: digestSchema.optional(),
    }),
  ),
  risks: z.array(z.string()),
  databaseReview: z
    .strictObject({
      local: z.boolean(),
      localityEvidence: z.string(),
      operations: z.array(
        z.strictObject({
          file: z.string(),
          action: z.string(),
          object: z.string().nullable(),
          column: z.string().optional(),
          renamedTo: z.string().optional(),
          dangerous: z.boolean(),
          consequence: z.string(),
          dependencies: z.array(z.record(z.string(), z.unknown())),
          dependenciesStatus: z.enum(['read', 'unavailable', 'not-applicable']),
        }),
      ),
    })
    .optional(),
  approval: z.enum(['external-policy-required', 'task-authorized']),
  backupRequired: z.boolean(),
  digest: digestSchema,
  restore: z
    .strictObject({
      backupId: z.uuid(),
      checksum: digestSchema,
      alias: refName.optional(),
      format: z.literal('APEXLANG').optional(),
    })
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
type PlanMode = Pick<z.infer<typeof planV2Object>, 'mode' | 'backupStrategy' | 'workingCopy' | 'scope'>;
/** Working-copy mode and the sync binding always agree, whatever the plan imports. */
const bindsWorkingCopy = (plan: Pick<PlanMode, 'mode' | 'workingCopy'>) =>
  (plan.mode === 'working-copy') === (plan.workingCopy !== null);
/**
 * An import plan backs up a working copy from its initial baseline and anything else from a fresh
 * export. A database-only plan imports and backs up nothing: its strategy names how the target is
 * observed, which is always a fresh export, including when it binds a working copy.
 */
function checkPlanMode(plan: PlanMode, ctx: z.RefinementCtx) {
  const backupAgrees =
    plan.scope === 'database-only'
      ? plan.backupStrategy === 'fresh-export'
      : (plan.mode === 'working-copy') === (plan.backupStrategy === 'initial-backup');
  if (!backupAgrees || !bindsWorkingCopy(plan))
    ctx.addIssue({ code: 'custom', message: 'Plan mode, backup strategy and sync binding must agree.' });
}
const planV2Schema = planV2Object.superRefine(checkPlanMode);
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
  .superRefine(checkPlanMode);
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
      (partial && !!plan.restore && plan.restore.format !== 'APEXLANG') ||
      (plan.importSelection.requestedMode === 'files' && !partial) ||
      (plan.importSelection.requestedMode === 'full' && partial) ||
      (!partial && plan.mode === 'full-export' && plan.backupStrategy !== 'fresh-export') ||
      !bindsWorkingCopy(plan) ||
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
  migrating: ['importing', 'succeeded'],
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
/** Unguessable end-of-script marker, so a user script cannot print it itself. */
export function scriptCompletionMarker() {
  return `APEXREST_SCRIPT_COMPLETE_${randomUUID().replaceAll('-', '')}`;
}
/** True only when the marker appears as a whole output line. */
export function scriptCompleted(output: string | undefined, marker: string) {
  return (output ?? '').split(/\r?\n/).some((line) => line.trim() === marker);
}
/**
 * Return 1-based line numbers that SQLcl could interpret as client commands.
 * Each line is tokenized after leading whitespace and leading block comments.
 * Literal/comment contents are masked while retaining line boundaries; they
 * do not become executable client commands. SQLcl still runs restricted.
 */
export function sqlclControlLines(sql: string): number[] {
  sql = executableSql(sql);
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
  if (inspectSql(sql).some((operation) => operation.dangerous)) risks.push('database-mutation');
  if (sqlclControlLines(executableSql(sql)).length) risks.push('sqlcl-script-control');
  return risks;
}
const legacyRestoreRisk = 'legacy-sql-restore';
const legacyRestoreOperation = (backupId: string, file: string) => ({
  file: `.apexrest/backups/${backupId}/application/${file}`,
  action: legacyRestoreRisk,
  object: null,
  dangerous: true,
  consequence:
    'Executes PL/SQL from the backup in Oracle. Review application, schema and data effects in the complete script.',
  dependencies: [],
  dependenciesStatus: 'unavailable' as const,
});

/** Legacy Oracle exports are one file of slash-terminated blocks with a known client-side wrapper. */
async function readLegacyRestore(directory: string, checksum: string) {
  const files = await inventory(directory);
  if (hash(canonical(files)) !== checksum)
    throw new Fault('BACKUP_INVALID', 'Legacy restore source changed after review.', 5);
  const entries = Object.keys(files);
  const file = entries[0];
  if (entries.length !== 1 || !file || !/^f\d+\.sql$/i.test(file))
    throw new Fault('RESTORE_LAYOUT_UNSUPPORTED', 'Legacy restore requires one non-split export file.', 3);
  const bytes = await readFile(await contained(directory, file));
  if (hash(bytes) !== files[file]) throw new Fault('BACKUP_INVALID', 'Legacy restore file changed.', 5);
  const sql = bytes.toString('utf8');
  if (!Buffer.from(sql).equals(bytes) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(sql))
    throw new Fault(
      'BACKUP_INVALID',
      'Legacy restore requires UTF-8 text without client control characters.',
      5,
    );

  const lines = sql.split(/\r\n|\r|\n/u);
  let start: number | undefined;
  let blocks = 0;
  let footer = false;
  const unsupported = (line: number) =>
    new Fault(
      'UNSUPPORTED_SQL_CLIENT_COMMAND',
      `Legacy restore contains an unsupported command or export layout at line ${line + 1}.`,
      4,
      'blocked',
    );
  for (const [index, line] of lines.entries()) {
    const text = line
      .trim()
      .replace(/[\t ]+/gu, ' ')
      .toLowerCase();
    if (start === undefined) {
      if (!text || /^(?:--|(?:rem(?:ark)?|prompt)(?: |$))/u.test(text)) continue;
      if (
        !blocks &&
        !footer &&
        ['set define off verify off feedback off', 'whenever sqlerror exit sql.sqlcode rollback'].includes(
          text,
        )
      )
        continue;
      if (blocks && !footer && text === 'set verify on feedback on define on') {
        footer = true;
        continue;
      }
      if (footer || !/^(?:begin|declare)(?:\s|$)/u.test(text)) throw unsupported(index);
      start = index;
    }
    // These characters can direct the SQL client before Oracle parses the block.
    if (/^\s*[!$@#]|^\s*\.\s*$/u.test(line)) throw unsupported(index);
    if (/^\s*\/(?!\*)/u.test(line) && text !== '/') throw unsupported(index);
    if (text !== '/') continue;
    const block = lines.slice(start, index).join('\n');
    const commands = sqlclControlLines(block);
    if (commands.length) throw unsupported(start + commands[0]! - 1);
    const executable = executableSql(block).trim();
    if (!/\bend\s*;$/iu.test(executable) || /^\s*(?:set|whenever|prompt)\b/imu.test(executable))
      throw unsupported(index);
    blocks++;
    start = undefined;
  }
  if (!blocks || start !== undefined) throw unsupported(start ?? 0);
  return { file, bytes };
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
export async function authorizePlan(ctx: ProjectContext, plan: DeployPlan, env: Environment, local = false) {
  if (await isProductionTarget(env, plan.targetDigest))
    throw new Fault(
      'PRODUCTION_DEPLOY_DENIED',
      'The plugin never deploys or restores production-marked targets.',
      4,
      'blocked',
    );
  if (plan.risks.some((r) => r.startsWith('sqlcl-script-control')))
    throw new Fault(
      'UNSUPPORTED_SQL_CLIENT_COMMAND',
      'Database scripts must contain reviewed SQL/PLSQL only; external script and host commands are unsupported.',
      4,
      'blocked',
    );
  const grants = (await policy()).grants;
  const grant = grants.find(
    (g) =>
      g.projectRoot === ctx.root &&
      g.targetDigest === plan.targetDigest &&
      g.operations.includes('deploy') &&
      g.planDigest === plan.digest &&
      Date.parse(g.expiresAt) > Date.now() &&
      Date.parse(g.expiresAt) <= Date.parse(plan.expiresAt),
  );
  if (!grant)
    throw new Fault(
      'DEPLOY_APPROVAL_REQUIRED',
      'The application task must authorize this exact project, target and plan.',
      4,
      'blocked',
    );
  if (
    !local &&
    plan.risks.some((r) => r !== 'application-restore') &&
    (!plan.risks.filter((r) => r !== 'application-restore').every((r) => grant.confirmedRisks?.includes(r)) ||
      (plan.risks.includes(legacyRestoreRisk) && !grant.confirmationRequest?.trim()))
  )
    throw new Fault(
      'DATABASE_CONFIRMATION_REQUIRED',
      'Remote database or security changes require human confirmation of this exact plan.',
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
/**
 * Files whose server bytes differ from the trusted checkpoint only by Oracle's
 * canonical export form (proven by the selected-source equivalence policy). They
 * are not remote changes: the server holds what the checkpoint recorded.
 */
async function canonicalOnlyChanges(
  ctx: ProjectContext,
  baseline: { directory: string; files: Record<string, string> },
  exported: { directory: string; files: Record<string, string> },
  files: string[],
) {
  const candidates = files.filter(
    (file) => file.endsWith('.apx') && baseline.files[file] && exported.files[file],
  );
  if (!candidates.length) return new Set<string>();
  const comparison = await compareApplicationExports(
    await syncPath(ctx, baseline.directory),
    exported.directory,
    pickFiles(baseline.files, candidates),
    pickFiles(exported.files, candidates),
    candidates,
  );
  return new Set(candidates.filter((file) => !comparison.mismatchedFiles.includes(file)));
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
  async localTarget(ctx: ProjectContext, plan: Pick<DeployPlan, 'environment'>) {
    const env = environment(ctx, plan.environment);
    if (typeof this.oracle.connectionLocality !== 'function')
      return { local: false, evidence: 'unconfirmed-connection-endpoint' };
    const connection = await resolveConnection(env.deployConnectionRef);
    await this.oracle.verifyTarget(env, connection);
    return this.oracle.connectionLocality(connection);
  }
  async databaseReview(ctx: ProjectContext, plan: DeployPlan) {
    const env = environment(ctx, plan.environment);
    const databaseOperations: Array<
      DatabaseOperation & {
        file: string;
        dependencies: Record<string, unknown>[];
        dependenciesStatus: 'read' | 'unavailable' | 'not-applicable';
      }
    > = [];
    for (const operation of plan.operations) {
      if (!operation.file || !['migration', 'package'].includes(operation.kind)) continue;
      const sql = await readFile(await contained(ctx.root, operation.file), 'utf8');
      for (const described of inspectSql(sql)) {
        let dependencies: Record<string, unknown>[] = [],
          dependenciesStatus: 'read' | 'unavailable' | 'not-applicable' = 'not-applicable';
        if (
          described.object &&
          ['drop-table', 'rename-column', 'alter-table', 'rename-object'].includes(described.action)
        ) {
          dependenciesStatus = 'unavailable';
          if (typeof this.oracle.databaseDependencies === 'function') {
            try {
              dependencies = await this.oracle.databaseDependencies(
                env.parsingSchema,
                described.object,
                await resolveConnection(env.readConnectionRef),
              );
              dependenciesStatus = 'read';
            } catch {
              /* Explicitly unavailable, never claim an empty dependency result. */
            }
          }
        }
        databaseOperations.push({ ...described, file: operation.file, dependencies, dependenciesStatus });
      }
    }
    const locality =
      databaseOperations.length || plan.risks.length
        ? await this.localTarget(ctx, plan)
        : { local: false, evidence: 'not-needed-for-application-import' };
    return { local: locality.local, localityEvidence: locality.evidence, operations: databaseOperations };
  }
  async history(env: Environment, _connection: Connection) {
    // Migration history is local and durable; no Oracle control table is read.
    return new LocalDeploymentControl(env).history();
  }
  /**
   * Keep the export a plan observed. Apply reuses it as the pre-import backup instead of
   * exporting the same content again (planObservation). Keeping it is an optimization:
   * when it fails, apply exports as before.
   */
  private async keepPlanObservation(ctx: ProjectContext, planId: string, exported: string) {
    const directory = planObservationDirectory(planId);
    try {
      await rm(await syncPath(ctx, directory), { recursive: true, force: true });
      await persistSnapshot(ctx, exported, directory);
    } catch {
      await rm(await syncPath(ctx, directory), { recursive: true, force: true }).catch(() => {});
    }
  }
  /**
   * The plan's kept export, proven to be the one the plan fingerprinted: target identity and
   * migration history are read again and, together with the kept files' digest, must reproduce
   * `plan.fingerprint`. The kept copy cannot be altered without breaking that fingerprint.
   * Server content that changed after the plan is not seen here; the fresh export immediately
   * before the first write (checkBeforeImport) must still equal the plan, which also proves the
   * kept copy equals the server state the write replaces. Returns null when there is nothing
   * usable; the caller then exports.
   */
  private async planObservation(
    ctx: ProjectContext,
    plan: DeployPlan,
    env: Environment,
    connection: Connection,
    selected: boolean,
  ) {
    try {
      const directory = await syncPath(ctx, planObservationDirectory(plan.id));
      if (!(await exists(directory))) return null;
      const files = await inventory(directory);
      const digest = hash(canonical(files));
      const inspection =
        selected && this.oracle.versionedTarget ? await this.oracle.versionedTarget(env, connection) : null;
      const target = inspection?.target ?? (await this.oracle.verifyTarget(env, connection));
      if (!target.application) return null;
      const history = await this.history(env, connection);
      const fingerprint = hash(canonical({ target, history, exportDigest: digest }));
      if (fingerprint !== plan.fingerprint) return null;
      return {
        target,
        history,
        exported: { directory, files, digest },
        versions: inspection?.versions ?? null,
        fingerprint,
        kept: true as const,
      };
    } catch {
      return null;
    }
  }
  async fingerprint(
    env: Environment,
    connection: Connection,
    selection?: {
      files: string[];
      source: string;
      knownFiles: Record<string, string>;
      exportScope?: 'selected' | 'full';
    },
    observed?: {
      target: Awaited<ReturnType<OracleAdapter['verifyTarget']>>;
      versions: Awaited<ReturnType<OracleAdapter['targetVersions']>>;
    },
  ) {
    const inspection =
      observed ??
      (selection && this.oracle.versionedTarget ? await this.oracle.versionedTarget(env, connection) : null);
    const target = inspection?.target ?? (await this.oracle.verifyTarget(env, connection));
    const history = await this.history(env, connection);
    const exported = target.application
      ? selection
        ? await this.oracle.exportSelection(
            env,
            connection,
            selection.files,
            selection.source,
            selection.knownFiles,
            selection.exportScope,
          )
        : await this.oracle.exportApplication(env, connection, 'APEXLANG')
      : null;
    return {
      target,
      history,
      exported,
      versions: inspection?.versions ?? null,
      fingerprint: hash(canonical({ target, history, exportDigest: exported?.digest ?? null })),
    };
  }
  async workingFingerprint(
    ctx: ProjectContext,
    name: string,
    state: SyncState,
    observedConnection?: Connection,
  ) {
    const env = environment(ctx, name),
      connection = observedConnection ?? (await resolveConnection(env.readConnectionRef));
    const { target, metadata } = await this.oracle.targetWithMetadata(env, connection);
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
      metadata,
      exported: checkpoint(state),
      versions: null,
      fingerprint: hash(canonical({ target, history, metadata })),
    };
  }
  /**
   * What changed on the server since the working copy's checkpoint (for example Page Designer
   * edits), next to what changed locally. Read-only: one export, nothing is written to the
   * project sources, the sync state or Oracle. Server rewrites that are canonical forms of the
   * same source are not reported. Without a checkpoint the server is compared with local files.
   */
  async serverChanges(ctx: ProjectContext, name: string) {
    return withConnectedReads(async () => {
      const env = environment(ctx, name),
        store = new SyncStore(ctx, env, name),
        connection = await resolveConnection(env.readConnectionRef);
      const stored = await store.read();
      const state = stored && stored.status !== 'invalidated' ? stored : null;
      if (state) await store.validate(state);
      const target = await this.oracle.verifyTarget(env, connection);
      if (!target.application)
        throw new Fault(
          'APPLICATION_NOT_FOUND',
          `Application ${env.applicationId} does not exist in workspace ${env.workspace}; there is nothing to compare.`,
          3,
          'blocked',
        );
      const exported = await this.oracle.exportApplication(env, connection, 'APEXLANG');
      try {
        const local = applicationFiles(ctx, await sourceInventory(ctx));
        const kind = (before: Record<string, string>, after: Record<string, string>, file: string) =>
          !after[file] ? 'deleted' : !before[file] ? 'added' : 'modified';
        if (!state) {
          const differs = changedFiles(exported.files, local);
          return {
            baseline: 'none',
            completeness: 'textual-file-hashes-only',
            differsFromLocal: differs.map((file) => ({ file, local: kind(exported.files, local, file) })),
            nextAction: differs.length
              ? 'No sync checkpoint exists, so server and local edits cannot be told apart. apexrest_apex_sync action:init on unchanged sources records one.'
              : 'Server and local sources are identical.',
          };
        }
        const baseline = checkpoint(state);
        const changed = changedFiles(baseline.files, exported.files);
        const canonicalOnly = await canonicalOnlyChanges(ctx, baseline, exported, changed);
        const server = changed.filter((file) => !canonicalOnly.has(file));
        const localChanged = changedFiles(baseline.files, local);
        const conflicts = server.filter(
          (file) => localChanged.includes(file) && exported.files[file] !== local[file],
        );
        return {
          baseline: state.lastSuccessfulImport ? 'last-successful-import' : 'initial-baseline',
          completeness: 'textual-file-hashes-only',
          serverChanged: server.map((file) => ({ file, change: kind(baseline.files, exported.files, file) })),
          localChanged: localChanged.map((file) => ({ file, change: kind(baseline.files, local, file) })),
          conflicts,
          nextAction: conflicts.length
            ? 'The same files changed on the server and locally. Reconcile them before shipping; ship refuses to overwrite them.'
            : server.length
              ? localChanged.length
                ? 'Server and local changes touch different files: a selected-file ship keeps the server changes. apexrest_apex_sync action:refresh needs clean local sources.'
                : 'apexrest_apex_sync action:refresh brings the server changes into the working copy.'
              : 'The server matches the checkpoint.',
        };
      } finally {
        await this.oracle.discardStage?.((exported as { stage?: string }).stage);
      }
    });
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
      await new LocalDeploymentControl(env).acquire(runId, false);
      try {
        if (signal?.aborted) throw new Fault('CANCELLED', 'Sync cancelled before export.', 6, 'cancelled');
        const target = await this.oracle.verifyTarget(env, readConnection);
        if (!target.application)
          throw new Fault('SYNC_SCOPE_UNSUPPORTED', 'Sync requires an existing application.', 5);
        const metadata = await this.oracle.applicationMetadata(env, readConnection);
        const exported = await this.oracle.exportApplication(env, readConnection, 'APEXLANG');
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
        await privateCopy(exported.directory, path.join(backupRoot, 'application'));
        await writeJson(path.join(backupRoot, 'backup.json'), {
          schemaVersion: 1,
          backupId,
          targetDigest: targetDigest(env),
          environment: name,
          digest: exported.digest,
          files: exported.files,
          format: 'APEXLANG',
          scope: 'full',
          restoreProcedure:
            'Reviewed APEXlang import; application metadata only. Schema/data recovery is separate.',
        });
        await checkSyncBackup(ctx, { backupId, checksum: exported.digest }, targetDigest(env), name);
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
          backup: { backupId, checksum: exported.digest },
          observedMetadata: metadata,
          lastSuccessfulImport: null,
          status: 'ready',
          importingRunId: null,
        };
        const source = await syncPath(ctx, ctx.config.application.sourceDir);
        const refreshKnown = action === 'refresh' && previous?.sourceDir === ctx.config.application.sourceDir;
        let normalized: SourceNormalization[] = [];
        if (await exists(source)) {
          const expected = refreshKnown ? checkpoint(previous!).files : exported.files;
          const conflict = () =>
            new Fault(
              'SYNC_SOURCE_CONFLICT',
              'Local sources differ from the expected inventory. Staged artifacts were retained; local files were preserved.',
              5,
            );
          const local = await inventory(source);
          if (canonical(local) !== canonical(expected)) {
            // A freshly generated app differs from its own server export only where Oracle
            // rewrites it on import. Those files alone are adopted from the server; any other
            // difference is a real local edit and stays a conflict.
            const adopt =
              action === 'init'
                ? await generatedSourceNormalizations(
                    source,
                    baselineRoot,
                    local,
                    expected,
                    env.applicationId,
                  )
                : undefined;
            if (!adopt) throw conflict();
            for (const change of adopt) {
              const target = await contained(source, change.file);
              if (change.action === 'removed') await rm(target);
              else await cp(await contained(baselineRoot, change.file), target, { force: true });
            }
            if (canonical(await inventory(source)) !== canonical(expected)) throw conflict();
            normalized = adopt;
          }
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
        return normalized.length ? { ...(await store.status()), normalized } : store.status();
      } finally {
        await this.releaseLease(env, runId);
      }
    });
  }
  async releaseLease(env: Environment, runId: string) {
    await new LocalDeploymentControl(env).release(runId);
  }
  /** Planning only reads the target: its reads share one connected SQLcl server. */
  async plan(ctx: ProjectContext, name: string, options: ImportOptions | boolean = {}): Promise<DeployPlan> {
    const plan = await withConnectedReads(() => this.planObserved(ctx, name, options));
    await new LocalDeploymentControl(environment(ctx, name)).registerExisting();
    return plan;
  }
  private async planObserved(
    ctx: ProjectContext,
    name: string,
    options: ImportOptions | boolean = {},
  ): Promise<DeployPlan> {
    // Production is refused from configuration before any connection or SQLcl call. An unknown
    // environment is reported where it was before, after the source-level checks.
    const configured =
      name && Object.hasOwn(ctx.config.environments, name) ? ctx.config.environments[name] : undefined;
    if (configured) await refuseProductionDeployment(configured, name);
    if (typeof options === 'boolean') return this.legacyPlan(ctx, name, options);
    const requested = importOptions(options);
    if (requested.importMode === 'none') return this.databasePlan(ctx, name);
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
    // A local no-op must not open a database connection or re-probe SQLcl.
    const stored = await new SyncStore(ctx, environment(ctx, name), name).read();
    if (requested.importMode !== 'full' && stored && stored.status !== 'invalidated') {
      await new SyncStore(ctx, environment(ctx, name), name).validate(stored);
      const sources = await sourceInventory(ctx);
      const local = applicationFiles(ctx, sources);
      const candidates =
        requested.importMode === 'files' ? requested.files : changedFiles(checkpoint(stored).files, local);
      if (!candidates.length || candidates.every((file) => local[file] === checkpoint(stored).files[file])) {
        if (requested.importMode === 'auto') {
          const control = new LocalDeploymentControl(environment(ctx, name));
          const [history, packages] = await Promise.all([
            control.history(),
            control.packages(ctx.config.projectId),
          ]);
          checkMigrations(ctx, sources, history);
          if (history.some((row) => row.status !== 'succeeded'))
            throw new Fault(
              'MIGRATION_HISTORY_CONFLICT',
              'Resolve earlier migration outcomes before deployment.',
              5,
            );
          const applied = new Map(history.map((row) => [row.version, row.checksum]));
          let pending = false;
          for (const [file, sha] of Object.entries(sources)) {
            if (file.startsWith(ctx.config.database.migrationsDir + '/')) {
              const previous = applied.get(path.basename(file));
              if (previous && previous !== sha)
                throw new Fault('MIGRATION_HISTORY_CONFLICT', 'Applied migration changed.', 5);
              if (!previous) pending = true;
            }
            if (file.startsWith(ctx.config.database.packagesDir + '/') && packages[file] !== sha)
              pending = true;
          }
          // Only the no-op decision uses local history. The database plan still performs
          // its normal fresh identity/export/history checks and exact authorization review.
          if (pending) return this.databasePlan(ctx, name);
        }
        throw new Fault(
          'NO_LOCAL_CHANGES',
          'No local changes in the requested scope; server freshness was not checked.',
          2,
        );
      }
    }
    const env = environment(ctx, name),
      connection = await resolveConnection(env.readConnectionRef);
    const observed = this.oracle.versionedTarget
      ? await this.oracle.versionedTarget(env, connection)
      : undefined;
    const versions = observed?.versions ?? (await this.oracle.targetVersions(connection));
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
        : await this.planFiles(ctx, name, requested, versions, undefined, observed);
    if ('plan' in partial && partial.plan) return partial.plan;
    if (requested.importMode === 'files')
      throw new Fault('PARTIAL_IMPORT_UNSUPPORTED', partial.reasons.join('; '), 3, 'blocked', {
        reasons: partial.reasons,
      });
    // Full/new-app planning can use the identity already read with the version check.
    // A partial attempt may have observed/exported intervening state, so its fallback
    // deliberately takes a new identity. Apply always performs its own fresh checks.
    const reuseIdentity = requested.importMode === 'full' || !stored || stored.status === 'invalidated';
    const full = await this.legacyPlan(ctx, name, false, true, reuseIdentity ? observed : undefined);
    const plan: DeployPlan = {
      ...full,
      schemaVersion: 4,
      scope: 'full-application-import',
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
    versions: Awaited<ReturnType<OracleAdapter['targetVersions']>>,
    desiredSource?: string,
    observed?: {
      target: Awaited<ReturnType<OracleAdapter['verifyTarget']>>;
      versions: Awaited<ReturnType<OracleAdapter['targetVersions']>>;
    },
  ): Promise<{ plan?: DeployPlan; reasons: string[] }> {
    const env = environment(ctx, name);
    if (await isProductionTarget(env)) return { reasons: ['production-requires-full-import'] };
    const store = new SyncStore(ctx, env, name),
      working = await store.read();
    if (!working || working.status === 'invalidated') return { reasons: ['trusted-sync-baseline-required'] };
    await store.validate(working);
    const source = await syncPath(ctx, ctx.config.application.sourceDir);
    const sources = await sourceInventory(ctx),
      local = desiredSource ? await inventory(desiredSource) : applicationFiles(ctx, sources);
    const candidates =
      options.importMode === 'files' ? options.files : changedFiles(checkpoint(working).files, local);
    if (candidates.some((file) => !local[file] || !supportedFile(file)))
      return { reasons: ['unsupported-component-files'] };
    const exportScope = candidates.every(scopedExportFile) ? 'selected' : 'full';
    const connection = await resolveConnection(env.readConnectionRef);
    const capabilities = await this.oracle.partialImportCapabilities(source, versions);
    if (capabilities.compilerVersion !== working.compilerVersion)
      throw new Fault(
        'SYNC_COMPILER_CHANGED',
        'Refresh the working copy explicitly after a compiler upgrade.',
        5,
      );
    const current = await this.fingerprint(
      env,
      connection,
      {
        files: candidates,
        source: desiredSource ?? source,
        knownFiles: checkpoint(working).files,
        exportScope,
      },
      observed,
    );
    try {
      if (!current.exported) return { reasons: ['existing-application-required'] };
      if (canonical(current.target) !== canonical(working.target))
        throw new Fault('SYNC_SERVER_CHANGED', 'Application identity changed since the sync baseline.', 5);
      const remote = { ...checkpoint(working).files };
      const canonicalOnly = await canonicalOnlyChanges(
        ctx,
        checkpoint(working),
        current.exported,
        candidates.filter((file) => current.exported!.files[file] !== checkpoint(working).files[file]),
      );
      for (const file of candidates) {
        if (canonicalOnly.has(file)) continue;
        if (current.exported.files[file]) remote[file] = current.exported.files[file]!;
        else delete remote[file];
      }
      const selected = selectImport(checkpoint(working).files, local, remote, options);
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
      // Package scripts unchanged since their last successful run do not execute, as in a full plan.
      const packageHistory = await new LocalDeploymentControl(env).packages(ctx.config.projectId);
      for (const [file, sha] of Object.entries(sources)) {
        if (file.startsWith(ctx.config.database.packagesDir + '/')) {
          if (packageHistory[file] !== sha) return fallback(['database-operations-require-full-import']);
          continue;
        }
        if (file.startsWith(ctx.config.database.migrationsDir + '/')) {
          const old = history.get(path.basename(file));
          if (!old) return fallback(['database-operations-require-full-import']);
          if (old.checksum !== sha)
            throw new Fault('MIGRATION_HISTORY_CONFLICT', 'Applied migration changed.', 5);
        }
      }
      const id = randomUUID(),
        root = '.apexrest/plans/' + id;
      // Canonical-only server forms keep the checkpoint bytes, so the reviewed
      // three-way comparison sees the same unchanged remote side.
      await overlaySelection(
        await syncPath(ctx, checkpoint(working).directory),
        current.exported.directory,
        candidates.filter((file) => !canonicalOnly.has(file)),
        await syncPath(ctx, root + '/before'),
      );
      const beforeFiles = await inventory(await syncPath(ctx, root + '/before'));
      const before = {
        directory: root + '/before',
        files: beforeFiles,
        digest: hash(canonical(beforeFiles)),
      };
      const effective = await stageSelection(
        ctx,
        before,
        desiredSource ?? source,
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
      await this.keepPlanObservation(ctx, id, current.exported.directory);
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
        packageHistory,
        coordination: coordination(env),
        scope: 'selected-file-import',
        operations: [{ kind: 'import' }, { kind: 'verify' }],
        risks,
        approval: 'task-authorized',
        backupRequired: true,
        digest: '0'.repeat(64),
        importSelection: {
          // importMode none never reaches file selection (plan() returns a database plan first).
          requestedMode: options.importMode as 'auto' | 'full' | 'files',
          resolvedMode: 'files',
          files: selected.files,
          reasons: exportScope === 'full' ? ['shared-components-require-full-apexlang-observation'] : [],
          dependencies: selected.files.filter((file) => file.startsWith('shared-components/')),
          before,
          effective,
          capabilities,
          readbackPolicy: APEXLANG_EQUIVALENCE_POLICY,
          exportScope,
        },
      };
      plan.digest = planDigest(plan);
      return { plan, reasons: [] };
    } finally {
      await this.oracle.discardStage?.(current.exported?.stage);
    }
  }
  /**
   * Migrations and changed package scripts only. The target is observed with a fresh export like a
   * full plan, so identity, drift and history checks are unchanged; nothing is backed up or imported.
   * A working copy stays bound (mode `working-copy`) so apply still checks its revision.
   */
  private async databasePlan(ctx: ProjectContext, name: string): Promise<DeployPlan> {
    // No application import: the alias of the workspace's other applications does not matter.
    const full = await this.legacyPlan(ctx, name, false, true, undefined, undefined, false);
    const operations = full.operations.filter((o) => o.kind === 'migration' || o.kind === 'package');
    if (!operations.length)
      throw new Fault(
        'NO_DATABASE_CHANGES',
        'No pending migrations or changed package scripts; nothing to deploy to the database.',
        2,
      );
    const plan = { ...full, scope: 'database-only', operations, backupRequired: false } as DeployPlan;
    plan.digest = planDigest(plan);
    return plan;
  }
  private async legacyPlan(
    ctx: ProjectContext,
    name: string,
    restore = false,
    fresh = false,
    observed?: Parameters<DeploymentService['fingerprint']>[3],
    backupAlias?: string,
    applicationImport = true,
  ): Promise<DeployPlan> {
    const env = environment(ctx, name);
    await refuseProductionDeployment(env, name);
    const connection = await resolveConnection(env.readConnectionRef);
    const syncStore = new SyncStore(ctx, env, name),
      stored = await syncStore.read();
    const working = !restore && stored?.status !== 'invalidated' ? stored : null;
    const alias = restore ? backupAlias : ctx.config.application.alias;
    if (working) await syncStore.validate(working);
    if (restore && stored && ['importing', 'outcome_unknown'].includes(stored.status))
      throw new Fault('SYNC_BLOCKED', 'Reconcile interrupted writes before restore planning.', 5);
    // Target reads and compilation use independent inputs. Settle both before
    // returning an error so a failed preflight leaves no Oracle work running.
    const [targetCheck, sourceCheck, aliasCheck] = await Promise.allSettled([
      working && !fresh
        ? this.workingFingerprint(ctx, name, working)
        : this.fingerprint(env, connection, undefined, observed),
      (async () => {
        const sources = await sourceInventory(ctx);
        const startedAt = new Date().toISOString();
        const validation = await this.oracle.validate(
          await contained(ctx.root, ctx.config.application.sourceDir),
        );
        // The compiler staged exactly these application bytes (it refuses drift while staging).
        await recordRevision(ctx.root, 'validated', {
          revision: revisionOf(sources),
          startedAt,
          finishedAt: new Date().toISOString(),
        }).catch(() => false);
        const lock = await contained(ctx.root, ctx.config.toolchain.lockFile);
        if (!(await exists(lock)))
          throw new Fault('TOOLCHAIN_LOCK_REQUIRED', 'The project needs its pinned toolchain lock.', 3);
        return { sources, validation, lock };
      })(),
      // APEX imports an application whose alias another workspace application already uses
      // under a changed alias, which then fails post-import verification. Refuse it here.
      // Only without a sync baseline (a new or first-imported application); the post-import identity
      // check stays the guard, so a failed lookup never blocks planning.
      applicationImport && !working && alias && typeof this.oracle.aliasHolders === 'function'
        ? this.oracle.aliasHolders(env, connection, alias).catch(() => [] as number[])
        : Promise.resolve([] as number[]),
    ]);
    if (targetCheck.status === 'rejected') throw targetCheck.reason;
    if (sourceCheck.status === 'rejected') throw sourceCheck.reason;
    if (aliasCheck.status === 'rejected') throw aliasCheck.reason;
    if (aliasCheck.value.length)
      throw new Fault(
        'APPLICATION_ALIAS_IN_USE',
        `Alias ${alias} is already used by application ${aliasCheck.value.join(', ')} in workspace ${env.workspace}. ` +
          `APEX would import application ${env.applicationId} under a changed alias and the deployment would fail verification. ` +
          'Choose an unused alias, set it in apexrest.json (application.alias) and in application.apx (alias), then plan again.',
        5,
        'conflict',
        { alias, usedBy: aliasCheck.value },
      );
    const current = targetCheck.value,
      { sources, validation, lock } = sourceCheck.value,
      risks: string[] = [];
    if (fresh && working && current.exported) {
      const changed = changedFiles(checkpoint(working).files, current.exported.files);
      const canonicalOnly = await canonicalOnlyChanges(ctx, checkpoint(working), current.exported, changed);
      const remoteChanges = changed.filter((file) => !canonicalOnly.has(file));
      if (
        remoteChanges.some((file) => applicationFiles(ctx, sources)[file] !== current.exported!.files[file])
      )
        throw new Fault(
          'SYNC_SERVER_CHANGED',
          'A full import would overwrite remote changes. Reconcile the full export first.',
          5,
        );
    }
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
    const packageHistory = await new LocalDeploymentControl(env).packages(ctx.config.projectId);
    for (const [file, sha256] of Object.entries(sources)) {
      const migration = file.startsWith(ctx.config.database.migrationsDir + '/');
      const pkg = file.startsWith(ctx.config.database.packagesDir + '/');
      if (!migration && !pkg) continue;
      if (!file.endsWith('.sql'))
        throw new Fault('UNSUPPORTED_DB_SOURCE', 'Database execution directories accept .sql files only.', 3);
      const sql = await readFile(await contained(ctx.root, file), 'utf8');
      // Only scripts this plan runs carry risks: applied migrations and unchanged packages do not.
      const runs = migration ? !history.has(path.basename(file)) : packageHistory[file] !== sha256;
      if (runs) risks.push(...migrationRisk(sql).map((r) => `${r}:${file}`));
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
      } else if (runs) operations.push({ kind: 'package', file, sha256 });
    }
    const id = randomUUID();
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
        if (!working || fresh)
          await this.keepPlanObservation(ctx, id, path.resolve(ctx.root, current.exported.directory));
      } finally {
        if (!working || fresh)
          await this.oracle.discardStage?.((current.exported as { stage?: string }).stage);
      }
    }
    operations.sort(operationOrder);
    operations.push({ kind: 'import' }, { kind: 'verify' });
    const createdAt = Date.now();
    const plan: DeployPlan = {
      schemaVersion: 2,
      mode: working ? 'working-copy' : 'full-export',
      backupStrategy: working && !fresh ? 'initial-backup' : 'fresh-export',
      workingCopy: working ? this.syncBinding(working) : null,
      id,
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
      packageHistory,
      coordination: coordination(env),
      scope: 'full-application-import',
      operations,
      risks: [...new Set(risks)],
      approval: 'task-authorized',
      backupRequired: !!current.target.application,
      digest: '0'.repeat(64),
    };
    const composer = await deploymentBinding(ctx);
    plan.databaseReview = await this.databaseReview(ctx, plan);
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
    if (plan.restore && state && ['importing', 'outcome_unknown'].includes(state.status) && !permitImporting)
      throw new Fault('SYNC_BLOCKED', 'Reconcile interrupted imports before restoring.', 5);
    if (
      state &&
      state.status !== 'invalidated' &&
      (!plan.restore || (plan.schemaVersion === 4 && plan.importSelection.resolvedMode === 'files'))
    ) {
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
    const databaseOnly = plan.scope === 'database-only';
    if (plan.backupRequired !== (!databaseOnly && Boolean(plan.target.application)))
      throw new Fault('PLAN_TAMPERED', 'Backup requirement does not match reviewed target.', 5);
    if (databaseOnly && plan.restore)
      throw new Fault('PLAN_TAMPERED', 'A restore always imports the application.', 5);
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
        const runs = kind === 'migration' ? !previous : plan.packageHistory?.[file] !== sha256;
        if (!runs) continue;
        expected.push({ kind, file, sha256 });
        const risks = migrationRisk(await readFile(await contained(ctx.root, file), 'utf8')).map(
          (r) => `${r}:${file}`,
        );
        if (risks.some((r) => !plan.risks.includes(r)))
          throw new Fault('PLAN_TAMPERED', 'Plan omits a SQL risk.', 5);
      }
      expected.sort(operationOrder);
    } else if (plan.restore.format !== 'APEXLANG') {
      if (!plan.risks.includes(legacyRestoreRisk))
        throw new Fault('PLAN_TAMPERED', 'Legacy restore plan omits executable SQL. Create a new plan.', 5);
      const backup = await contained(ctx.root, '.apexrest/backups/' + plan.restore.backupId);
      const metadata = (await readJson(await contained(backup, 'backup.json'))) as {
        environment?: string;
        targetDigest?: string;
        digest?: string;
        format?: string;
      };
      if (metadata.environment !== plan.environment || metadata.targetDigest !== plan.targetDigest)
        throw new Fault('BACKUP_TARGET_MISMATCH', 'Backup belongs to another target.', 5);
      if (metadata.format === 'APEXLANG' || metadata.digest !== plan.restore.checksum)
        throw new Fault('BACKUP_INVALID', 'Legacy backup metadata changed after review.', 5);
      const { file } = await readLegacyRestore(await contained(backup, 'application'), plan.restore.checksum);
      if (
        canonical(plan.databaseReview?.operations ?? []) !==
        canonical([legacyRestoreOperation(plan.restore.backupId, file)])
      )
        throw new Fault(
          'PLAN_TAMPERED',
          'Legacy restore plan omits or changes the SQL review. Create a new plan.',
          5,
        );
    }
    if (!databaseOnly) expected.push({ kind: 'import' }, { kind: 'verify' });
    if (databaseOnly && !expected.length)
      throw new Fault('PLAN_TAMPERED', 'A database-only plan must run at least one script.', 5);
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
        plan.restore?.format === 'APEXLANG'
          ? selection.effective!.files
          : applicationFiles(ctx, plan.sources),
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
        !plan.risks.includes('authentication-or-authorization-change') &&
        (await securityChanged(
          { root: await syncPath(ctx, selection.effective!.directory), files: selection.effective!.files },
          { root: await syncPath(ctx, selection.before!.directory), files: selection.before!.files },
        ))
      )
        throw new Fault(
          'PLAN_TAMPERED',
          'Selected import omits its authentication or authorization risk.',
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
    return withSqlclTimings(() => withConnectedReads(() => this.applyObserved(ctx, value, signal, progress)));
  }
  private async applyObserved(
    ctx: ProjectContext,
    value: unknown,
    signal?: AbortSignal,
    progress?: (state: DeployState) => void,
  ) {
    const applyTimingStart = sqlclTimings().length;
    const { env, plan } = await this.checkLocal(ctx, value);
    // Locality probing connects; refuse production-marked targets first.
    await refuseProductionDeployment(env, plan.environment, plan.targetDigest);
    const locality = plan.risks.length ? await this.localTarget(ctx, plan) : { local: false };
    await authorizePlan(ctx, plan, env, locality.local);
    await this.oracle.requireMutationSupport();
    const runId = randomUUID();
    return withLock(await contained(ctx.root, '.apexrest/composer/ownership.lock'), async () => {
      // Ownership starts before the live comparison, closing the local check/write race.
      await this.lease(env, runId, true);
      try {
        return await this.applyLocked(ctx, value, runId, signal, progress, applyTimingStart);
      } finally {
        const control = new LocalDeploymentControl(env);
        const owner = await control.owner();
        // A writing lease is retained by applyLocked only for an unknown outcome.
        if (owner?.runId === runId && owner.phase !== 'writing') await control.release(runId);
      }
    });
  }
  private async applyLocked(
    ctx: ProjectContext,
    value: unknown,
    runId: string,
    signal?: AbortSignal,
    progress?: (state: DeployState) => void,
    applyTimingStart = 0,
  ) {
    if (signal?.aborted)
      throw new Fault('CANCELLED', 'Deployment cancelled before execution.', 6, 'cancelled');
    const { plan, env } = await this.checkLocal(ctx, value);
    const selection =
      plan.schemaVersion === 4 && plan.importSelection.resolvedMode === 'files' ? plan.importSelection : null;
    const scoped =
      selection?.exportScope !== undefined
        ? {
            files: selection.files,
            source: await syncPath(ctx, selection.effective!.directory),
            knownFiles: selection.before!.files,
            exportScope: selection.exportScope,
          }
        : undefined;
    const fresh = plan.schemaVersion !== 1 && plan.backupStrategy === 'fresh-export';
    const readConnection = await resolveConnection(env.readConnectionRef),
      deployConnection = await resolveConnection(env.deployConnectionRef);
    let working = await this.checkWorkingPlan(ctx, plan);
    const syncStore = new SyncStore(ctx, env, plan.environment);
    // An APEXlang import follows: load the compiler while the target is observed.
    // The server holds no connection until the import and is closed with this run.
    // A selected-file import names files relative to SQLcl's working directory, so its
    // server starts in the directory the frozen selected source is later copied into.
    const prepare = !plan.restore && plan.scope !== 'database-only' && !!this.oracle.prepareImport;
    const runDir = path.join(ctx.root, '.apexrest/deployments', runId);
    const importDirectory =
      prepare && selection ? path.join(runDir, 'snapshot', ctx.config.application.sourceDir) : undefined;
    if (importDirectory) await mkdir(importDirectory, { recursive: true, mode: 0o700 });
    const warmImport = prepare
      ? await this.oracle.prepareImport!(
          await contained(ctx.root, ctx.config.application.sourceDir),
          deployConnection,
          importDirectory,
        ).catch(() => undefined)
      : undefined;
    try {
      return await this.applyPrepared(
        ctx,
        plan,
        env,
        runId,
        selection,
        scoped,
        fresh,
        working,
        signal,
        progress,
        applyTimingStart,
      );
    } finally {
      await warmImport?.close().catch(() => {});
      // A run that stopped before freezing its sources leaves no empty run directory behind.
      for (
        let directory = importDirectory;
        directory && directory.startsWith(runDir);
        directory = path.dirname(directory)
      ) {
        try {
          await rmdir(directory);
        } catch {
          break;
        }
      }
    }
  }
  private async applyPrepared(
    ctx: ProjectContext,
    plan: DeployPlan,
    env: Environment,
    runId: string,
    selection: (DeployPlan & { schemaVersion: 4 })['importSelection'] | null,
    scoped:
      | {
          files: string[];
          source: string;
          knownFiles: Record<string, string>;
          exportScope: 'selected' | 'full';
        }
      | undefined,
    fresh: boolean,
    working: Awaited<ReturnType<DeploymentService['checkWorkingPlan']>>,
    signal: AbortSignal | undefined,
    progress: ((state: DeployState) => void) | undefined,
    applyTimingStart: number,
  ) {
    const readConnection = await resolveConnection(env.readConnectionRef),
      deployConnection = await resolveConnection(env.deployConnectionRef);
    const syncStore = new SyncStore(ctx, env, plan.environment);
    // A fresh-export plan kept its observed export: prove it is the planned one and read only
    // identity and history here. Content drift is caught by the export before the first write.
    type Observation =
      | Awaited<ReturnType<DeploymentService['fingerprint']>>
      | Awaited<ReturnType<DeploymentService['workingFingerprint']>>
      | NonNullable<Awaited<ReturnType<DeploymentService['planObservation']>>>;
    const freshTarget = (async (): Promise<Observation> => {
      if (working && !selection && !fresh) return this.workingFingerprint(ctx, plan.environment, working);
      const kept = fresh ? await this.planObservation(ctx, plan, env, readConnection, !!selection) : null;
      return kept ?? this.fingerprint(env, readConnection, scoped);
    })();
    const [deployTargetCheck, fingerprintCheck, capabilityCheck] = await Promise.allSettled([
      canonical(readConnection) === canonical(deployConnection)
        ? freshTarget.then((observation) => observation.target)
        : this.oracle.verifyTarget(env, deployConnection),
      freshTarget,
      this.oracle.requireCapability('import'),
    ]);
    const liveStage =
      (!working || selection || fresh) && fingerprintCheck.status === 'fulfilled'
        ? (fingerprintCheck.value.exported as { stage?: string } | null)?.stage
        : undefined;
    let backupSource: Awaited<ReturnType<typeof persistSnapshot>> | null = null;
    try {
      if (deployTargetCheck.status === 'rejected') throw deployTargetCheck.reason;
      if (fingerprintCheck.status === 'rejected') throw fingerprintCheck.reason;
      const live = fingerprintCheck.value;
      if (live.fingerprint !== plan.fingerprint)
        throw new Fault('TARGET_DRIFT', 'Target or migration history changed after review.', 5);
      if (fresh && live.exported) {
        if ('kept' in live)
          backupSource = {
            directory: planObservationDirectory(plan.id),
            files: live.exported.files,
            digest: live.exported.digest,
          };
        else {
          // An unusable kept copy must not mix into the backup of the export just taken.
          await rm(await syncPath(ctx, planObservationDirectory(plan.id)), { recursive: true, force: true });
          backupSource = await persistSnapshot(
            ctx,
            live.exported.directory,
            planObservationDirectory(plan.id),
          );
        }
      }
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
        fingerprintCheck.value.versions ?? (await this.oracle.targetVersions(readConnection)),
      );
      if (!observed.supported || canonical(observed) !== canonical(selection.capabilities))
        throw new Fault('COMPILER_DRIFT', 'Selected-import capabilities changed after planning.', 5);
    }
    if (signal?.aborted)
      throw new Fault('CANCELLED', 'Deployment cancelled before lease acquisition.', 6, 'cancelled');
    const runs = path.join(ctx.root, '.apexrest/deployments'),
      runDir = path.join(runs, runId);
    await mkdir(runDir, { recursive: true, mode: 0o700 });
    let state: DeployState = 'planned',
      writeStarted = false,
      importConfirmed = false,
      importRejected = false,
      syncMarked = false,
      syncSucceeded = false;
    let freshBackupId: string | null = null;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    let timingCursor = applyTimingStart;
    // Revision states (revision.ts) follow the journal: the first write marks the plan's source
    // revision as importing, success as deployed, failure as failed. An unknown outcome leaves both
    // the import and the last confirmed deployment as they are. Recording never alters the run.
    const revisionStartedAt = new Date().toISOString();
    const recordRunRevision = async (nextState: DeployState, details: unknown) => {
      const revision = (plan as { sourceDigest?: string }).sourceDigest;
      const kind =
        nextState === 'migrating'
          ? 'importing'
          : nextState === 'succeeded'
            ? 'deployed'
            : nextState === 'failed'
              ? 'failed'
              : undefined;
      if (!revision || !kind) return;
      try {
        const code = (details as { code?: unknown })?.code;
        await recordRevision(ctx.root, kind, {
          revision,
          startedAt: revisionStartedAt,
          finishedAt: new Date().toISOString(),
          environment: plan.environment,
          runId,
          ...(kind === 'failed' && typeof code === 'string' ? { detail: { code } } : {}),
        });
      } catch {
        /* The journal is the deployment record; the revision report is derived from it. */
      }
    };
    const record = async (nextState: DeployState, details: unknown = {}) => {
      assertTransition(state, nextState);
      const timingPhase = state;
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
        details: { ...(details as object), sqlclTimings: sqlclTimings().slice(timingCursor), timingPhase },
      };
      timingCursor = sqlclTimings().length;
      await appendJournal(runDir, event);
      await recordRunRevision(nextState, details);
    };
    await writeJson(path.join(runDir, 'plan.json'), plan);
    await record('approved');
    await this.lease(env, runId, false);
    try {
      await record('backing_up');
      working = await this.checkWorkingPlan(ctx, plan);
      if (working) await checkSyncBackup(ctx, working.backup, plan.targetDigest, plan.environment);
      const databaseOnly = plan.scope === 'database-only';
      if (!databaseOnly && (plan.backupRequired || liveApplication) && (!working || selection || fresh)) {
        const backup = backupSource ?? (await this.oracle.exportApplication(env, readConnection, 'APEXLANG'));
        try {
          const backupId = randomUUID(),
            directory = path.join(ctx.root, '.apexrest/backups', backupId);
          await mkdir(directory, { recursive: true, mode: 0o700 });
          const backupPath = backup.directory.startsWith('.apexrest/')
            ? await syncPath(ctx, backup.directory)
            : backup.directory;
          await privateCopy(backupPath, path.join(directory, 'application'));
          const files = await inventory(path.join(directory, 'application'));
          if ((!scoped && !Object.keys(files).length) || hash(canonical(files)) !== backup.digest)
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
            format: 'APEXLANG',
            scope: scoped ? 'selected' : 'full',
            ...(scoped
              ? { selectedFiles: scoped.files, absentFiles: scoped.files.filter((file) => !files[file]) }
              : {}),
            ...(typeof liveApplication?.alias === 'string' ? { alias: liveApplication.alias } : {}),
            restoreProcedure:
              'Reviewed APEXlang import in the recorded scope; newly created components have no previous source to restore. Schema/data recovery is separate.',
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
      // Keep this barrier only when backup performed an additional export.
      // Fresh-export plans reuse the start observation as backup and retain
      // the stronger post-freeze observation immediately before import.
      if ((!working || selection) && !fresh) {
        const after = await this.fingerprint(env, readConnection, scoped);
        try {
          if (after.fingerprint !== plan.fingerprint)
            throw new Fault('TARGET_DRIFT', 'Target changed during backup.', 5);
        } finally {
          await this.oracle.discardStage?.((after.exported as { stage?: string } | null)?.stage);
        }
      }
      // Execute a frozen copy. A later working-tree edit cannot alter reviewed bytes.
      const snapshot = path.join(runDir, 'snapshot');
      // A selected-file run already created it for the prepared import server.
      await mkdir(snapshot, { recursive: true, mode: 0o700 });
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
        // Empty the directory instead of replacing it: the prepared import server runs in it.
        for (const entry of await readdir(application))
          await rm(path.join(application, entry), { recursive: true });
        await privateCopy(await syncPath(ctx, selection.effective!.directory), application);
        if (canonical(await inventory(application)) !== canonical(selection.effective!.files))
          throw new Fault('SOURCE_DRIFT', 'Selected source changed while freezing deployment.', 5);
      }
      if (controller.signal.aborted)
        throw new Fault('CANCELLED', 'Deployment cancelled before writes.', 6, 'cancelled');
      if (working && !databaseOnly) {
        await syncStore.lock(async () => {
          await this.checkWorkingPlan(ctx, plan);
          await syncStore.write({ ...working!, status: 'importing', importingRunId: runId });
          syncMarked = true;
        });
      }
      const completedMigrations: DeployPlan['migrationHistory'] = [];
      const checkBeforeImport = async () => {
        const sameConnection = canonical(readConnection) === canonical(deployConnection);
        const observation =
          working && !selection && !fresh
            ? await this.workingFingerprint(
                ctx,
                plan.environment,
                working,
                sameConnection ? deployConnection : readConnection,
              )
            : await this.fingerprint(env, readConnection, scoped);
        try {
          const expectedHistory = [...plan.migrationHistory, ...completedMigrations].sort((a, b) =>
            String(a.version).localeCompare(String(b.version)),
          );
          if (canonical(observation.history) !== canonical(expectedHistory))
            throw new Fault('TARGET_DRIFT', 'Migration history changed before import.', 5);
          // Only this run's confirmed migrations may differ from the planned
          // history. Server identity/content must still match the plan.
          const fingerprint = completedMigrations.length
            ? hash(
                canonical({
                  target: observation.target,
                  history: plan.migrationHistory,
                  ...('metadata' in observation
                    ? { metadata: observation.metadata }
                    : { exportDigest: observation.exported?.digest ?? null }),
                }),
              )
            : observation.fingerprint;
          if (fingerprint !== plan.fingerprint)
            throw new Fault('TARGET_DRIFT', 'Target changed before import.', 5);
          if (!sameConnection) await this.oracle.verifyTarget(env, deployConnection);
        } finally {
          if (!working || selection || fresh)
            await this.oracle.discardStage?.((observation.exported as { stage?: string } | null)?.stage);
        }
      };
      // Database scripts, when present, also retain a fresh post-freeze
      // check before their first write. Import has its own later barrier.
      if (plan.operations.some((o) => ['migration', 'package'].includes(o.kind))) await checkBeforeImport();
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
        // A per-run marker printed after the script proves SQLcl reached its end:
        // a script that exits early or consumes the remaining stdin (ACCEPT,
        // PAUSE) must not be recorded as applied.
        const marker = scriptCompletionMarker();
        const executed = await this.oracle.session(
          `@${sqlclToken(file)}\nprompt ${marker}`,
          deployConnection,
          true,
          controller.signal,
          undefined,
          'text',
          SCRIPT_RESTRICT_LEVEL,
        );
        if (!scriptCompleted(executed?.output, marker))
          throw new Fault(
            'SCRIPT_INCOMPLETE',
            `SQLcl did not confirm that ${path.basename(file)} ran to completion.`,
            6,
            'outcome_unknown',
          );
        if (operation.kind === 'package')
          await new LocalDeploymentControl(env).packageApplied(
            runId,
            ctx.config.projectId,
            operation.file!,
            operation.sha256!,
          );
        if (operation.kind === 'migration') {
          await new LocalDeploymentControl(env).migration(
            runId,
            path.basename(file),
            operation.sha256!,
            'succeeded',
          );
          completedMigrations.push({
            version: path.basename(file),
            checksum: operation.sha256!,
            status: 'succeeded',
            run_id: runId,
          });
        }
      }
      if (databaseOnly) {
        // The application was not imported, so its working copy and sync state stay as they were.
        await this.oracle.verifyTarget(env, readConnection);
        await record('succeeded');
        return { runId, state, directory: runDir };
      }
      await record('importing');
      await this.lease(env, runId, false);
      // Restoring an absent application still uses the alias captured with its backup.
      const previousAlias = (plan.target.application as { alias?: unknown } | null)?.alias;
      const expectedAlias = plan.restore
        ? (plan.restore.alias ??
          (typeof previousAlias === 'string' ? previousAlias : ctx.config.application.alias))
        : ctx.config.application.alias;
      if (plan.restore && plan.restore.format !== 'APEXLANG') {
        const backupRoot = await contained(
          ctx.root,
          '.apexrest/backups/' + plan.restore.backupId + '/application',
        );
        const { file, bytes } = await readLegacyRestore(backupRoot, plan.restore.checksum);
        await atomicWrite(path.join(runDir, 'restore', file), bytes);
        const restoredSync = await syncStore.read();
        if (restoredSync && restoredSync.status !== 'invalidated')
          await syncStore.lock(() =>
            syncStore.write({ ...restoredSync, status: 'invalidated', revision: restoredSync.revision + 1 }),
          );
        await checkBeforeImport();
        if (controller.signal.aborted)
          throw new Fault('CANCELLED', 'Deployment cancelled before import.', 6, 'cancelled');
        writeStarted = true;
        await this.oracle.restoreApplication(env, deployConnection, bytes, controller.signal);
      } else {
        if (
          plan.restore &&
          hash(
            canonical(
              await inventory(
                await syncPath(ctx, '.apexrest/backups/' + plan.restore.backupId + '/application'),
              ),
            ),
          ) !== plan.restore.checksum
        )
          throw new Fault('BACKUP_INVALID', 'Restore source changed after approval.', 5);
        if (
          selection &&
          canonical(await inventory(path.join(snapshot, ctx.config.application.sourceDir))) !==
            canonical(selection.effective!.files)
        )
          throw new Fault('SOURCE_DRIFT', 'Frozen selected source changed before import.', 5);
        if (controller.signal.aborted)
          throw new Fault('CANCELLED', 'Deployment cancelled before import.', 6, 'cancelled');
        let importSource = path.join(snapshot, ctx.config.application.sourceDir);
        if (plan.restore && !selection) {
          const frozen = path.join(runDir, 'restore');
          await privateCopy(
            await syncPath(ctx, '.apexrest/backups/' + plan.restore.backupId + '/application'),
            frozen,
          );
          if (hash(canonical(await inventory(frozen))) !== plan.restore.checksum)
            throw new Fault('BACKUP_INVALID', 'Restore copy changed.', 5);
          importSource = frozen;
          const restoredSync = await syncStore.read();
          if (restoredSync && restoredSync.status !== 'invalidated')
            await syncStore.lock(() =>
              syncStore.write({
                ...restoredSync,
                status: 'invalidated',
                revision: restoredSync.revision + 1,
              }),
            );
        }
        await checkBeforeImport();
        if (selection && canonical(await inventory(importSource)) !== canonical(selection.effective!.files))
          throw new Fault('SOURCE_DRIFT', 'Frozen selected source changed before import.', 5);
        const composer = (plan.schemaVersion === 3 || plan.schemaVersion === 4) && plan.composer;
        if (!plan.restore && composer) {
          try {
            await verifyDeploymentPredicates(
              ctx,
              composer,
              env,
              readConnection,
              this.oracle,
              controller.signal,
            );
          } catch (error) {
            // All database scripts finished and were journaled before this read. No APEX import began.
            importRejected = true;
            throw error;
          }
        }
        if (controller.signal.aborted)
          throw new Fault('CANCELLED', 'Deployment cancelled before import.', 6, 'cancelled');
        writeStarted = true;
        try {
          await this.oracle.importApplication(
            plan.restore && !selection
              ? {
                  ...ctx,
                  config: { ...ctx.config, application: { ...ctx.config.application, alias: expectedAlias } },
                }
              : ctx,
            env,
            deployConnection,
            importSource,
            controller.signal,
            selection?.files,
          );
        } catch (error) {
          // SQLcl ran the import to its end and reported an Oracle or compiler error: the batch
          // stopped and rolled back. That alone is not trusted. Only when a fresh read then shows
          // the target exactly as planned (plus this run's own migrations) is the import reported
          // as rejected with Oracle's message; anything else stays an unknown outcome.
          if (
            !(error instanceof Fault) ||
            error.code !== 'ORACLE_COMMAND_FAILED' ||
            CONNECTION_LOST.test(error.message) ||
            controller.signal.aborted
          )
            throw error;
          try {
            await checkBeforeImport();
          } catch {
            throw error;
          }
          importRejected = true;
          throw new Fault(
            'IMPORT_REJECTED',
            `Oracle rejected the import and the target is unchanged (confirmed by a fresh read). Fix the reported source and ship again.\n${error.message}`,
            1,
            'failed',
            { ...error.details, targetUnchanged: true },
          );
        }
      }
      importConfirmed = true;
      let serverSnapshot: Awaited<ReturnType<typeof persistSnapshot>> | null = null;
      let target: Awaited<ReturnType<OracleAdapter['verifyTarget']>>;
      let postImportMetadata: Awaited<ReturnType<OracleAdapter['applicationMetadata']>> | undefined;
      try {
        await record('verifying');
        if (working) {
          const observed = await this.oracle.targetWithMetadata(env, readConnection);
          target = observed.target;
          postImportMetadata = observed.metadata;
        } else target = await this.oracle.verifyTarget(env, readConnection);
        if (
          !target.application ||
          String(target.application.alias).toLowerCase() !== String(expectedAlias).toLowerCase()
        )
          throw new Fault(
            'POST_DEPLOY_IDENTITY_FAILED',
            target.application
              ? `Application ${env.applicationId} was imported with alias ${String(target.application.alias)}, not ${String(expectedAlias)}: another application in workspace ${env.workspace} probably uses that alias. Change application.alias in apexrest.json and application.apx to an unused alias, then ship again.`
              : `Application ${env.applicationId} was not found in workspace ${env.workspace} after the import.`,
            1,
            'failed',
            {
              deploymentRunId: runId,
              expectedAlias: String(expectedAlias),
              ...(target.application ? { observedAlias: String(target.application.alias) } : {}),
            },
          );
        if (selection) {
          const observed = scoped
            ? await this.oracle.exportSelection(
                env,
                readConnection,
                scoped.files,
                scoped.source,
                selection.effective!.files,
                scoped.exportScope,
              )
            : await this.oracle.exportApplication(env, readConnection, 'APEXLANG');
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
                    scoped
                      ? pickFiles(selection.effective!.files, selection.files)
                      : selection.effective!.files,
                    serverSnapshot.files,
                    selection.files,
                  )
                : {
                    equivalent: canonical(serverSnapshot.files) === canonical(selection.effective!.files),
                    policy: 'exact-bytes',
                    normalizations: [],
                  };
            await writeJson(path.join(runDir, 'readback-verification.json'), {
              ...comparison,
              scope: scoped ? 'selected' : 'full',
              sourceObservationScope: selection.exportScope ?? 'full',
              verifiedFiles: selection.files,
              unselectedServerContentChecked: !scoped,
            });
            if (!comparison.equivalent)
              throw new Fault(
                'POST_DEPLOY_CONTENT_FAILED',
                'Import confirmed but readback differs from the reviewed result; reconcile the retained server snapshot.',
                5,
              );
            if (scoped) {
              const mergedDirectory =
                '.apexrest/deployments/' + runId + '/snapshot/' + ctx.config.application.sourceDir;
              // The durable checkpoint retains dependency context, not a claim of a fresh full export.
              await overlaySelection(
                await syncPath(ctx, selection.before!.directory),
                observed.directory,
                selection.files,
                await syncPath(ctx, mergedDirectory),
              );
              const mergedFiles = await inventory(await syncPath(ctx, mergedDirectory));
              serverSnapshot = {
                directory: mergedDirectory,
                files: mergedFiles,
                digest: hash(canonical(mergedFiles)),
              };
            }
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
          runId,
          working,
          target,
          serverSnapshot,
          postImportMetadata!,
        );
        syncSucceeded = true;
      }
      await record('succeeded');
      return { runId, state, directory: runDir, ...(freshBackupId ? { backupId: freshBackupId } : {}) };
    } catch (error) {
      const unknown =
        writeStarted &&
        !importRejected &&
        (!importConfirmed || !(error instanceof Fault) || error.exitCode === 6);
      // A refused or rejected APEX import leaves the application working copy unchanged.
      const applicationWritten = writeStarted && !importRejected;
      if (working && syncMarked) {
        try {
          await syncStore.lock(async () => {
            const owned = await syncStore.read();
            if (!owned || (owned.importingRunId !== runId && owned.lastSuccessfulImport?.runId !== runId))
              throw new Error('Sync ownership changed during failure recording.');
            const status = unknown ? 'outcome_unknown' : applicationWritten ? 'verification_failed' : 'ready';
            // Once this run's success checkpoint is durable, never roll it back
            // to the pre-import state; only the status may change.
            await syncStore.write(
              syncSucceeded || owned.lastSuccessfulImport?.runId === runId
                ? { ...owned, status, importingRunId: status === 'ready' ? null : runId }
                : { ...working!, importingRunId: applicationWritten ? runId : null, status },
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
          { deploymentRunId: runId, cause: error instanceof Fault ? error.code : 'UNEXPECTED_FAILURE' },
        );
      if (error instanceof Fault) error.details = { ...error.details, deploymentRunId: runId };
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
    runId: string,
    working: SyncState,
    target: Awaited<ReturnType<OracleAdapter['verifyTarget']>>,
    serverSnapshot: Awaited<ReturnType<typeof persistSnapshot>> | null,
    metadata: Awaited<ReturnType<OracleAdapter['applicationMetadata']>>,
  ) {
    const selection =
      plan.schemaVersion === 4 && plan.importSelection.resolvedMode === 'files' ? plan.importSelection : null;
    const syncStore = new SyncStore(ctx, env, plan.environment);
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
        lastSuccessfulImport: {
          at: new Date().toISOString(),
          runId,
          snapshot,
          ...(selection?.exportScope !== undefined ? { verifiedFiles: selection.files } : {}),
        },
        recoveryCheckpoint: null,
      });
    });
  }
  private async recoveryRead(ctx: ProjectContext, runId: string, requestedEnvironment?: string) {
    parse(z.uuid(), runId);
    const directory = await contained(ctx.root, '.apexrest/deployments/' + runId);
    if (!(await exists(path.join(directory, 'plan.json'))))
      throw new Fault(
        'DEPLOYMENT_RUN_NOT_FOUND',
        `No deployment run ${runId} exists in this project. Pass the deploymentRunId from the failed apexrest_ship result (data.deploymentRunId), not the result's runId or a jobId.`,
        2,
      );
    const plan = parse(deployPlanSchema, await readJson(path.join(directory, 'plan.json')));
    if (requestedEnvironment !== undefined && requestedEnvironment !== plan.environment)
      throw new Fault(
        'PLAN_ENVIRONMENT_MISMATCH',
        'The interrupted deployment belongs to a different environment. Use the environment recorded with the run.',
        5,
      );
    const env = environment(ctx, plan.environment);
    if (
      plan.digest !== planDigest(plan) ||
      plan.projectRoot !== ctx.root ||
      plan.projectId !== ctx.config.projectId ||
      plan.targetDigest !== targetDigest(env)
    )
      throw new Fault('PLAN_TARGET_MISMATCH', 'Reconciliation must use the original project and target.', 5);
    if (canonical(plan.coordination) !== canonical(coordination(env)))
      throw new Fault(
        'COORDINATION_STORE_CHANGED',
        'Reconciliation requires the original managed coordination home.',
        5,
      );
    const control = new LocalDeploymentControl(env),
      owner = await control.owner();
    if (owner && owner.runId !== runId) throw new Fault('TARGET_LOCKED', 'Another run owns this schema.', 5);
    const selection =
      plan.schemaVersion === 4 && plan.importSelection.resolvedMode === 'files' ? plan.importSelection : null;
    const scoped =
      selection?.exportScope !== undefined
        ? {
            files: selection.files,
            source: await syncPath(ctx, selection.effective!.directory),
            knownFiles: selection.before!.files,
            exportScope: selection.exportScope,
          }
        : undefined;
    const current = await this.fingerprint(env, await resolveConnection(env.readConnectionRef), scoped);
    if (
      canonical(current.target.identity) !== canonical(plan.target.identity) ||
      canonical(current.target.workspace) !== canonical(plan.target.workspace) ||
      (plan.target.application &&
        canonical(current.target.application) !== canonical(plan.target.application))
    )
      throw new Fault(
        'IDENTITY_MISMATCH',
        'The actual server/application identity changed before reconciliation.',
        5,
      );
    const state = await readJson(path.join(directory, 'state.json'));
    const expectedDirectory =
      selection?.effective?.directory ??
      '.apexrest/deployments/' + runId + '/snapshot/' + ctx.config.application.sourceDir;
    const expectedInventory = selection?.effective?.files ?? applicationFiles(ctx, plan.sources);
    const expectedFiles = scoped ? pickFiles(expectedInventory, selection!.files) : expectedInventory;
    const expectedRoot = await syncPath(ctx, expectedDirectory);
    const workingState =
      plan.schemaVersion !== 1 && plan.workingCopy
        ? await new SyncStore(ctx, env, plan.environment).read()
        : null;
    const before = selection?.before ?? (workingState ? checkpoint(workingState) : null);
    const allowed = selection?.files ?? Object.keys(expectedFiles).filter((file) => file.endsWith('.apx'));
    let comparison: Awaited<ReturnType<typeof compareApplicationExports>> | null = null;
    let conflictFiles: string[] = [];
    if (current.exported && !plan.restore && (await exists(expectedRoot))) {
      if (canonical(await inventory(expectedRoot)) !== canonical(expectedInventory))
        throw new Fault('SOURCE_DRIFT', 'The frozen reviewed sources changed before reconciliation.', 5);
      comparison = await compareApplicationExports(
        expectedRoot,
        current.exported.directory,
        expectedFiles,
        current.exported.files,
        allowed,
      );
      if (!comparison.equivalent) {
        if (!before) conflictFiles = comparison.mismatchedFiles;
        else
          for (const file of comparison.mismatchedFiles) {
            const prior = await compareApplicationExports(
              await syncPath(ctx, before.directory),
              current.exported.directory,
              before.files[file] ? { [file]: before.files[file]! } : {},
              current.exported.files[file] ? { [file]: current.exported.files[file]! } : {},
              allowed,
            );
            if (!prior.equivalent) conflictFiles.push(file);
          }
      }
    } else conflictFiles = ['reviewed-source-or-server-export-unavailable'];
    if (current.fingerprint === plan.fingerprint) conflictFiles = [];
    const databaseOperations = plan.operations.some((operation) =>
      ['migration', 'package'].includes(operation.kind),
    );
    const result = {
      runId,
      state,
      currentTarget: current.target,
      currentFingerprint: current.fingerprint,
      comparisonProvenance: 'explicit-live-export',
      targetUnchanged: current.fingerprint === plan.fingerprint,
      importedSourcesMatch: comparison?.equivalent ?? false,
      history: current.history,
      retryAllowed: !databaseOperations && !plan.restore && !conflictFiles.length && !comparison?.equivalent,
      recoveryStatus:
        databaseOperations || plan.restore
          ? 'database-review-required'
          : conflictFiles.length
            ? 'conflict'
            : comparison?.equivalent
              ? 'already-applied'
              : 'safe-to-replan',
      conflictFiles,
      readbackComparison: comparison,
      ...(selection ? { importMode: 'files', selectedFiles: selection.files } : { importMode: 'full' }),
    };
    return { result, plan, env, current, directory, selection, owner };
  }
  async reconcile(ctx: ProjectContext, runId: string) {
    const observed = await this.recoveryRead(ctx, runId);
    try {
      return observed.result;
    } finally {
      await this.oracle.discardStage?.((observed.current.exported as { stage?: string } | null)?.stage);
    }
  }
  /** Observe first. Recover APEX metadata only; never replay database scripts. */
  async recover(ctx: ProjectContext, runId: string, requestedEnvironment?: string) {
    const observed = await this.recoveryRead(ctx, runId, requestedEnvironment);
    const { result, plan, env, current, selection, directory } = observed;
    try {
      if (await isProductionTarget(env, plan.targetDigest))
        throw new Fault(
          'PRODUCTION_DEPLOY_DENIED',
          'Production recovery may be inspected, but deployment is unsupported.',
          4,
          'blocked',
        );
      if (result.recoveryStatus === 'database-review-required')
        throw new Fault(
          'DATABASE_RECOVERY_REQUIRED',
          'Inspect the actual database operations and durable migration history; SQL scripts cannot be automatically replayed.',
          4,
          'blocked',
        );
      if (result.conflictFiles.length)
        throw new Fault(
          'TARGET_DRIFT',
          'Server content differs from both reviewed desired and baseline sources. Preserve the server snapshot and resolve these files: ' +
            result.conflictFiles.join(', '),
          5,
        );
      if (
        plan.configurationDigest !== hash(canonical(ctx.config)) ||
        plan.toolchainDigest !==
          hash(await readFile(await contained(ctx.root, ctx.config.toolchain.lockFile))) ||
        plan.sourceDigest !== hash(canonical(await sourceInventory(ctx)))
      )
        throw new Fault(
          'SOURCE_DRIFT',
          'Local sources/configuration/toolchain changed; recovery cannot repeat a different task.',
          5,
        );
      // A second fresh read prevents releasing ownership on a changing target.
      const connection = await resolveConnection(env.readConnectionRef);
      const scoped =
        selection?.exportScope !== undefined
          ? {
              files: selection.files,
              source: await syncPath(ctx, selection.effective!.directory),
              knownFiles: selection.before!.files,
              exportScope: selection.exportScope,
            }
          : undefined;
      const second = await this.fingerprint(env, connection, scoped);
      try {
        if (second.fingerprint !== current.fingerprint)
          throw new Fault('TARGET_DRIFT', 'Server changed during reconciliation.', 5);
      } finally {
        await this.oracle.discardStage?.((second.exported as { stage?: string } | null)?.stage);
      }
      const control = new LocalDeploymentControl(env);
      // Verify worker termination without clearing a foreign/live lease.
      await control.claimReconciled(runId);
      const store = new SyncStore(ctx, env, plan.environment),
        working = await store.read();
      if (working) {
        if (working.importingRunId && working.importingRunId !== runId)
          throw new Fault('TARGET_LOCKED', 'Another import owns the working copy.', 5);
        let server = await persistSnapshot(
          ctx,
          current.exported!.directory,
          '.apexrest/deployments/' + runId + '/recovery/' + Date.now() + '/application',
        );
        if (scoped) {
          const raw = await syncPath(ctx, server.directory);
          const merged = server.directory + '-context';
          await overlaySelection(
            await syncPath(ctx, selection!.before!.directory),
            raw,
            scoped.files,
            await syncPath(ctx, merged),
          );
          await rm(raw, { recursive: true });
          await rename(await syncPath(ctx, merged), raw);
          const mergedFiles = await inventory(raw);
          server = { directory: server.directory, files: mergedFiles, digest: hash(canonical(mergedFiles)) };
        }
        if (result.importedSourcesMatch) {
          if (!working.importingRunId)
            await store.lock(() => store.write({ ...working, importingRunId: runId }));
          const recoveredObservation = await this.oracle.targetWithMetadata(env, connection);
          await this.completeWorkingCopy(
            ctx,
            plan,
            env,
            runId,
            { ...working, importingRunId: runId },
            recoveredObservation.target,
            server,
            recoveredObservation.metadata,
          );
        } else {
          const metadata = await this.oracle.applicationMetadata(env, connection);
          await store.lock(async () => {
            const latest = await store.read();
            if (!latest || latest.revision !== working.revision)
              throw new Fault('TARGET_DRIFT', 'Working copy changed during recovery.', 5);
            await store.write({
              ...latest,
              status: 'ready',
              importingRunId: null,
              revision: latest.revision + 1,
              target: current.target,
              observedMetadata: metadata,
              recoveryCheckpoint: { at: new Date().toISOString(), runId, snapshot: server },
            });
          });
        }
      }
      await appendJournal(directory, {
        runId,
        planId: plan.id,
        planDigest: plan.digest,
        targetDigest: plan.targetDigest,
        state: result.importedSourcesMatch ? 'succeeded' : 'failed',
        at: new Date().toISOString(),
        details: { reconciled: true, recoveryStatus: result.recoveryStatus },
      });
      if (result.importedSourcesMatch) {
        await control.release(runId);
        return {
          status: 'succeeded' as const,
          runId,
          state: 'succeeded' as const,
          directory,
          recovered: true,
          reconciliation: result,
        };
      }
      const options = selection
        ? { importMode: 'files' as const, files: selection.files }
        : { importMode: 'full' as const };
      const retryPlan = await this.plan(ctx, plan.environment, options);
      const planPath = '.apexrest/plans/recovery-' + retryPlan.id + '.json';
      await writeJson(await contained(ctx.root, planPath), retryPlan);
      await control.release(runId);
      return { status: 'replan_required' as const, runId, planPath, retryPlan, reconciliation: result };
    } finally {
      await this.oracle.discardStage?.((current.exported as { stage?: string } | null)?.stage);
    }
  }
  async restorePlan(ctx: ProjectContext, backupId: string) {
    parse(z.uuid(), backupId);
    const directory = await contained(ctx.root, '.apexrest/backups/' + backupId);
    const backup = (await readJson(await contained(directory, 'backup.json'))) as {
      digest: string;
      environment: string;
      targetDigest: string;
      alias?: unknown;
      format?: string;
      scope?: string;
      selectedFiles?: string[];
      absentFiles?: string[];
    };
    const env = environment(ctx, backup.environment);
    await refuseProductionDeployment(env, backup.environment);
    if (targetDigest(env) !== backup.targetDigest)
      throw new Fault('BACKUP_TARGET_MISMATCH', 'Backup belongs to another target.', 5);
    const application = await contained(directory, 'application');
    const legacy = backup.format === 'APEXLANG' ? null : await readLegacyRestore(application, backup.digest);
    const files = legacy ? {} : await inventory(application);
    if (!legacy && hash(canonical(files)) !== backup.digest)
      throw new Fault('BACKUP_INVALID', 'Backup digest does not match.', 5);
    let plan: DeployPlan;
    const backupAlias = refName.safeParse(backup.alias).data;
    if (backup.format === 'APEXLANG' && backup.scope === 'selected') {
      if (!backup.selectedFiles?.length || backup.absentFiles?.length || !Object.keys(files).length)
        throw new Fault(
          'RESTORE_LAYOUT_UNSUPPORTED',
          'A creation snapshot records absence; removing the new component requires a separately reviewed deletion.',
          3,
        );
      if (canonical(Object.keys(files).sort()) !== canonical([...backup.selectedFiles].sort()))
        throw new Fault('BACKUP_INVALID', 'Selected backup files differ from its recorded scope.', 5);
      const context = await syncPath(ctx, '.apexrest/restore-context/' + randomUUID());
      await overlaySelection(
        await syncPath(ctx, ctx.config.application.sourceDir),
        path.join(directory, 'application'),
        backup.selectedFiles,
        context,
      );
      try {
        const planned = await this.planFiles(
          ctx,
          backup.environment,
          importOptions({ importMode: 'files', files: backup.selectedFiles }),
          await this.oracle.targetVersions(await resolveConnection(env.readConnectionRef)),
          context,
        );
        if (!planned.plan) throw new Fault('RESTORE_LAYOUT_UNSUPPORTED', planned.reasons.join('; '), 3);
        plan = planned.plan;
      } finally {
        await rm(context, { recursive: true, force: true });
      }
    } else {
      if (backup.format === 'APEXLANG') await this.oracle.validate(path.join(directory, 'application'));
      plan = await withConnectedReads(() =>
        this.legacyPlan(ctx, backup.environment, true, false, undefined, backupAlias),
      );
    }
    if (plan.targetDigest !== backup.targetDigest)
      throw new Fault('BACKUP_TARGET_MISMATCH', 'Backup belongs to another target.', 5);
    // Record the backed-up alias: the application may be absent when restoring.
    const alias = backupAlias ?? (plan.target.application as { alias?: unknown } | null)?.alias;
    plan.restore = {
      backupId,
      checksum: backup.digest,
      ...(backup.format === 'APEXLANG' ? { format: 'APEXLANG' as const } : {}),
      ...(typeof alias === 'string' && refName.safeParse(alias).success ? { alias } : {}),
    };
    plan.risks = ['application-restore'];
    plan.operations = [{ kind: 'import' }, { kind: 'verify' }];
    if (legacy) {
      plan.risks.push(legacyRestoreRisk);
      const locality = await this.localTarget(ctx, plan);
      plan.databaseReview = {
        local: locality.local,
        localityEvidence: locality.evidence,
        operations: [legacyRestoreOperation(backupId, legacy.file)],
      };
    }
    plan.digest = planDigest(plan);
    return plan;
  }
}
