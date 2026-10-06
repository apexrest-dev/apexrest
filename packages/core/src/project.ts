import path from 'node:path';
import { cp, mkdir, lstat, readdir, writeFile, mkdtemp, rm, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { contained, exists, inventory, atomicWrite, withLock } from './fs.ts';
import { loadProject, parse, refName } from './config.ts';
import type { ProjectContext, ProjectConfig } from './config.ts';
import { Fault } from './result.ts';
import { OracleAdapter, installSources } from './oracle.ts';
export function resourceRoot() {
  return (
    process.env.APEXREST_RESOURCES ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../resources')
  );
}
export async function projectInit(
  directory: string,
  template: 'blank-app' | 'customer-crm' | 'existing-app',
  alias: string,
) {
  parse(refName, alias);
  const destination = path.resolve(directory);
  await mkdir(path.dirname(destination), { recursive: true });
  return withLock(destination + '.init.lock', async () => {
    if (await exists(destination)) {
      if (!(await lstat(destination)).isDirectory() || (await readdir(destination)).length)
        throw new Fault('LOCAL_EDITS_CONFLICT', 'Project init requires an empty directory.', 5, 'conflict');
    }
    const root = await mkdtemp(destination + '.init-');
    try {
      const conflict = () =>
        new Fault(
          'LOCAL_EDITS_CONFLICT',
          'Project init requires an empty folder or a new directory. Existing files were left unchanged.',
          5,
          'conflict',
        );
      if (!(await exists(root))) await mkdir(root, { recursive: true, mode: 0o700 });
      if (!(await lstat(root)).isDirectory() || (await readdir(root)).length !== 0) throw conflict();
      const createFile = async (file: string, content: string) => {
        try {
          await writeFile(file, content, { flag: 'wx', mode: 0o600 });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw conflict();
          throw error;
        }
      };
      const config: ProjectConfig = {
        schemaVersion: 1,
        projectId: alias,
        application: { sourceDir: 'src/apex/' + alias, alias },
        database: {
          migrationsDir: 'src/database/migrations',
          packagesDir: 'src/database/packages',
          testsDir: 'tests/sql',
        },
        toolchain: { lockFile: 'apexrest.toolchain.lock.json' },
        environments: {},
        tests: {
          unitDir: 'tests/unit',
          apiDir: 'tests/api',
          e2eDir: 'tests/e2e',
          requiredSuites: template === 'customer-crm' ? ['sql', 'e2e'] : [],
          defaultBrowser: 'chromium',
          mutationAllowedEnvironments: [],
        },
        artifacts: { directory: '.apexrest/artifacts', retentionDays: 7 },
      };
      await createFile(path.join(root, 'apexrest.json'), JSON.stringify(config, null, 2) + '\n');
      await createFile(
        path.join(root, '.gitignore'),
        '.apexrest/\nnode_modules/\n.env\nplaywright/.auth/\ntest-results/\n',
      );
      for (const dir of [
        ...Object.values(config.database),
        config.tests.unitDir,
        config.tests.apiDir,
        config.tests.e2eDir,
      ])
        await mkdir(path.join(root, dir), { recursive: true });
      await cp(
        path.join(resourceRoot(), 'toolchains/toolchain.lock.json'),
        path.join(root, config.toolchain.lockFile),
        { force: false, errorOnExist: true },
      );
      if (template !== 'existing-app') {
        const generated = await new OracleAdapter().generate(alias, alias);
        await installSources(generated.directory, root, config.application.sourceDir);
        if (template === 'customer-crm') {
          await cp(path.join(resourceRoot(), 'templates/customer-crm/project'), root, { recursive: true });
          await cp(
            path.join(resourceRoot(), 'templates/customer-crm/apex-overlay'),
            path.join(root, config.application.sourceDir),
            { recursive: true },
          );
          const { readFile } = await import('node:fs/promises');
          const file = path.join(root, config.application.sourceDir, 'shared-components/lists.apx');
          const lists = await readFile(file, 'utf8'),
            index = lists.lastIndexOf(')');
          if (index < 0 || !lists.includes('list navigation-menu ('))
            throw new Fault(
              'UNSUPPORTED_TEMPLATE',
              'Starter navigation does not match the reviewed fixture.',
              3,
            );
          const entries = ['customers', 'dashboard']
            .map(
              (label, i) =>
                `    entry ${label} (\n        label: ${label[0]!.toUpperCase() + label.slice(1)}\n        layout {\n            sequence: ${(i + 2) * 10}\n        }\n        link {\n            target: {\n                page: ${(i + 1) * 10}\n            }\n        }\n    )\n`,
            )
            .join('');
          await atomicWrite(file, lists.slice(0, index) + entries + lists.slice(index));
        }
      }
      // Publish only after generation and all template checks succeeded.
      if (await exists(destination)) {
        if ((await readdir(destination)).length) throw conflict();
        const moved: string[] = [];
        try {
          for (const entry of await readdir(root)) {
            await rename(path.join(root, entry), path.join(destination, entry));
            moved.push(entry);
          }
        } catch (error) {
          for (const entry of moved.reverse())
            await rename(path.join(destination, entry), path.join(root, entry));
          throw error;
        }
      } else await rename(root, destination);
      return {
        root: destination,
        template,
        configuration: config,
        nextActions: [
          'Configure explicit target identity and connection references.',
          'Review project code and grant project trust before running it.',
        ],
      };
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }).catch((error: unknown) => {
    if (error instanceof Fault && error.code === 'LOCKED')
      throw new Fault(
        'LOCAL_EDITS_CONFLICT',
        'Another project initialization owns this directory.',
        5,
        'conflict',
      );
    throw error;
  });
}
export function projectSummary(ctx: ProjectContext) {
  const environments = Object.entries(ctx.config.environments);
  return {
    projectId: ctx.config.projectId,
    root: ctx.root,
    sourceDirectories: {
      apex: ctx.config.application.sourceDir,
      ...ctx.config.database,
    },
    toolchainLock: ctx.config.toolchain.lockFile,
    requiredSuites: ctx.config.tests.requiredSuites,
    environments: environments.slice(0, 8).map(([name, env]) => ({
      name,
      kind: env.kind,
      applicationId: env.applicationId,
      workspace: env.workspace,
      parsingSchema: env.parsingSchema,
    })),
    environmentsOmitted: Math.max(0, environments.length - 8),
    targetVerified: false,
  };
}
export function projectInspect(ctx: ProjectContext, detail?: 'full'): ReturnType<typeof projectInventory>;
export function projectInspect(
  ctx: ProjectContext,
  detail: 'summary',
): Promise<ReturnType<typeof projectSummary>>;
export function projectInspect(
  ctx: ProjectContext,
  detail: 'full' | 'summary',
): Promise<Awaited<ReturnType<typeof projectInventory>> | ReturnType<typeof projectSummary>>;
export async function projectInspect(ctx: ProjectContext, detail: 'full' | 'summary' = 'full') {
  return detail === 'summary' ? projectSummary(ctx) : projectInventory(ctx);
}
async function projectInventory(ctx: ProjectContext) {
  const sources: Record<string, unknown> = {};
  for (const [kind, relative] of Object.entries({
    apex: ctx.config.application.sourceDir,
    ...ctx.config.database,
  })) {
    const dir = await contained(ctx.root, relative);
    sources[kind] = (await exists(dir)) ? await inventory(dir) : null;
  }
  return {
    projectId: ctx.config.projectId,
    root: ctx.root,
    environments: Object.entries(ctx.config.environments).map(([name, env]) => ({
      name,
      kind: env.kind,
      applicationId: env.applicationId,
      workspace: env.workspace,
    })),
    sources,
  };
}
export { loadProject };
