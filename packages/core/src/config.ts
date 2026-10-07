import { z } from 'zod';
import path from 'node:path';
import { homedir } from 'node:os';
import { mkdir, realpath } from 'node:fs/promises';
import { canonical, contained, exists, hash, readJson, withLock, writeJson } from './fs.ts';
import { Fault } from './result.ts';
export const identifier = z.string().regex(/^[A-Za-z][A-Za-z0-9_$#]{0,127}$/);
export const refName = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/);
export const relativePath = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (s) => !path.isAbsolute(s) && !s.split(/[\\/]/).includes('..') && !/[\x00-\x1f]/.test(s),
    'Expected a contained relative path',
  );
export const environmentSchema = z.strictObject({
  kind: z.enum(['development', 'dev', 'qa', 'test', 'production']),
  readConnectionRef: refName,
  deployConnectionRef: refName,
  workspace: identifier,
  parsingSchema: identifier,
  applicationId: z.number().int().positive(),
  baseUrl: z.url(),
  databaseIdentity: z.strictObject({ dbUniqueName: z.string().min(1), serviceName: z.string().min(1) }),
  allowedOrigins: z.array(z.url()).default([]),
  expectedMarker: z.string().min(1).optional(),
});
export const projectSchema = z.strictObject({
  schemaVersion: z.literal(1),
  projectId: refName,
  application: z.strictObject({ sourceDir: relativePath, alias: refName }),
  database: z.strictObject({
    migrationsDir: relativePath,
    packagesDir: relativePath,
  }),
  toolchain: z.strictObject({ lockFile: relativePath, profile: z.enum(['26.1', '26.2']).optional() }),
  environments: z.record(refName, environmentSchema),
  // Legacy local coordination is now the default; retained for old project files.
  deploymentControl: z.literal('local').optional(),
  composer: z.strictObject({ allowSourceOnly: z.boolean().default(false) }).optional(),
  artifacts: z.strictObject({ directory: relativePath, retentionDays: z.number().int().min(1).max(365) }),
});
export type ProjectConfig = z.infer<typeof projectSchema>;
export type Environment = z.infer<typeof environmentSchema>;
export interface ProjectContext {
  root: string;
  config: ProjectConfig;
}
export const managedHome = () => path.resolve(process.env.APEXREST_HOME ?? path.join(homedir(), '.apexrest'));
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new Fault(
      'INVALID_INPUT',
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      2,
    );
  return result.data;
}
export async function loadProject(root: string): Promise<ProjectContext> {
  const physical = await realpath(root);
  const file = await contained(physical, 'apexrest.json');
  if (!(await exists(file)))
    throw new Fault(
      'PROJECT_NOT_CONFIGURED',
      'No apexrest.json at the requested project root.',
      3,
      'not_configured',
    );
  const value = (await readJson(file)) as Record<string, unknown>;
  // Retired test settings are ignored when reading existing projects. New
  // project files and published schemas contain no automated-suite settings.
  const { tests: _tests, ...current } = value;
  if (current.database && typeof current.database === 'object' && !Array.isArray(current.database)) {
    const { testsDir: _testsDir, ...database } = current.database as Record<string, unknown>;
    current.database = database;
  }
  const config = parse(projectSchema, current);
  for (const p of [
    config.application.sourceDir,
    ...Object.values(config.database),
    config.toolchain.lockFile,
    config.artifacts.directory,
  ])
    await contained(physical, p);
  return { root: physical, config };
}
export function environment(ctx: ProjectContext, name?: string): Environment {
  if (!name) throw new Fault('ENVIRONMENT_REQUIRED', 'Select an explicit environment with --env.', 2);
  const env = ctx.config.environments[name];
  if (!env) throw new Fault('UNKNOWN_ENVIRONMENT', `Environment ${name} is not configured.`, 2);
  return env;
}
/** Stable identity of a deployment target: database, workspace, schema and application. */
export function targetDigest(env: Environment) {
  return hash(
    canonical({
      ...env.databaseIdentity,
      workspace: env.workspace,
      schema: env.parsingSchema,
      applicationId: env.applicationId,
    }),
  );
}
export const policySchema = z.strictObject({
  schemaVersion: z.literal(1),
  // Legacy compatibility only; host filesystem permissions govern project access.
  trustedProjects: z.array(z.string()).optional(),
  grants: z.array(
    z.strictObject({
      projectRoot: z.string(),
      targetDigest: z.string().regex(/^[a-f0-9]{64}$/),
      expiresAt: z.iso.datetime(),
      operations: z.array(z.literal('deploy')),
      planDigest: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
      // A grant recorded by apexrest_ship keeps the user's literal instruction
      // and its origin so the authorization record stays auditable.
      note: z.string().max(2000).optional(),
      grantedBy: z.enum(['user', 'ship']).optional(),
      grantedAt: z.iso.datetime().optional(),
      workerPid: z.number().int().positive().optional(),
      confirmedRisks: z.array(z.string()).optional(),
      confirmationRequest: z.string().min(1).max(2000).optional(),
    }),
  ),
});
export type Policy = z.infer<typeof policySchema>;
export type PolicyGrant = Policy['grants'][number];
export const policyFile = () => path.join(managedHome(), 'policy.json');
export async function policy(): Promise<Policy> {
  const file = policyFile();
  return (await exists(file))
    ? parse(
        policySchema,
        await readJson(file).then((value) => {
          const current = value as { grants?: { operations?: unknown[] }[] };
          if (Array.isArray(current.grants))
            current.grants = current.grants.map((grant) => ({
              ...grant,
              ...(Array.isArray(grant.operations)
                ? { operations: grant.operations.filter((operation) => operation !== 'test') }
                : {}),
            }));
          return current;
        }),
      )
    : { schemaVersion: 1 as const, grants: [] };
}
/** Atomically rewrite the user policy under its lock; unrelated entries are preserved. */
export async function updatePolicy(mutate: (current: Policy) => Policy) {
  await mkdir(managedHome(), { recursive: true, mode: 0o700 });
  return withLock(path.join(managedHome(), 'policy.lock'), async () => {
    const next = parse(policySchema, mutate(await policy()));
    await writeJson(policyFile(), next);
    return next;
  });
}
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
/**
 * Administrator-owned production trust. apexrest never writes this file.
 * Legacy approval keys are accepted as ignored data; no signature authorizes deployment.
 */
export const productionTrustSchema = z.strictObject({
  schemaVersion: z.literal(1),
  approvalKeys: z.array(z.strictObject({ sha256, reviewer: z.string().min(1).optional() })).optional(),
  productionTargets: z.array(sha256),
});
export type ProductionTrust = z.infer<typeof productionTrustSchema>;
export const productionTrustFile = () => path.join(managedHome(), 'production-trust.json');
async function readProductionTrust(file: string) {
  try {
    return parse(productionTrustSchema, await readJson(file));
  } catch (error) {
    throw new Fault(
      'PRODUCTION_TRUST_INVALID',
      `Production trust file ${file} is unreadable or invalid: ${error instanceof Error ? error.message : 'unknown error'}`,
      4,
      'blocked',
    );
  }
}
/**
 * Production classification never depends only on project configuration. Any
 * target listed in the trust file is production, even if apexrest.json says
 * development. Listing only adds restrictions, so the file need not be protected here.
 */
export async function isProductionTarget(env: Environment, digest = targetDigest(env)) {
  if (env.kind === 'production') return true;
  const file = productionTrustFile();
  if (!(await exists(file))) return false;
  return (await readProductionTrust(file)).productionTargets.includes(digest);
}
