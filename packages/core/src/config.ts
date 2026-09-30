import { z } from 'zod';
import path from 'node:path';
import { homedir } from 'node:os';
import { realpath } from 'node:fs/promises';
import { contained, exists, readJson } from './fs.ts';
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
export const suiteName = z.enum(['unit', 'sql', 'api', 'e2e']);
export const environmentSchema = z.strictObject({
  kind: z.enum(['development', 'test', 'production']),
  readConnectionRef: refName,
  deployConnectionRef: refName,
  workspace: identifier,
  parsingSchema: identifier,
  applicationId: z.number().int().positive(),
  baseUrl: z.url(),
  databaseIdentity: z.strictObject({ dbUniqueName: z.string().min(1), serviceName: z.string().min(1) }),
  allowedOrigins: z.array(z.url()).default([]),
  expectedMarker: z.string().min(1).optional(),
  deploymentControl: z.enum(['local', 'database']).optional(),
});
export const projectSchema = z.strictObject({
  schemaVersion: z.literal(1),
  projectId: refName,
  application: z.strictObject({ sourceDir: relativePath, alias: refName }),
  database: z.strictObject({
    migrationsDir: relativePath,
    packagesDir: relativePath,
    testsDir: relativePath,
  }),
  toolchain: z.strictObject({ lockFile: relativePath }),
  environments: z.record(refName, environmentSchema),
  tests: z.strictObject({
    unitDir: relativePath,
    apiDir: relativePath,
    e2eDir: relativePath,
    requiredSuites: z.array(suiteName),
    defaultBrowser: z.literal('chromium'),
    mutationAllowedEnvironments: z.array(refName),
  }),
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
  const config = parse(projectSchema, await readJson(file));
  for (const p of [
    config.application.sourceDir,
    ...Object.values(config.database),
    config.toolchain.lockFile,
    config.artifacts.directory,
    config.tests.unitDir,
    config.tests.apiDir,
    config.tests.e2eDir,
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
export const policySchema = z.strictObject({
  schemaVersion: z.literal(1),
  trustedProjects: z.array(z.string()),
  grants: z.array(
    z.strictObject({
      projectRoot: z.string(),
      targetDigest: z.string().regex(/^[a-f0-9]{64}$/),
      expiresAt: z.iso.datetime(),
      operations: z.array(z.enum(['deploy', 'test'])),
      planDigest: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
    }),
  ),
});
export async function policy() {
  const file = path.join(managedHome(), 'policy.json');
  return (await exists(file))
    ? parse(policySchema, await readJson(file))
    : { schemaVersion: 1 as const, trustedProjects: [], grants: [] };
}
export async function requireTrust(root: string) {
  if (!(await policy()).trustedProjects.includes(await realpath(root)))
    throw new Fault(
      'PROJECT_TRUST_REQUIRED',
      'Review this project and add its canonical path to the user-owned policy trustedProjects. Host trust is also required.',
      4,
      'blocked',
    );
}
