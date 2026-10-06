import { composePlan, composeMaterialize } from './composer/service.ts';
import { VERSION } from './version.ts';
import path from 'node:path';
import { doctor } from './doctor.ts';
import { referenceSearch, referenceRead, referenceSync } from './references.ts';
import { failure, Fault, success, type Result } from './result.ts';
import { schemas } from './operations.ts';
import type { Operation } from './operations.ts';
import { environment, loadProject, managedHome, parse, requireTrust } from './config.ts';
import { connections, configureConnection, editConnection, resolveConnection } from './connections.ts';
import { canonical, contained, exists, hash, readJson, writeJson } from './fs.ts';
import * as oracleModule from './oracle.ts';
import { OracleAdapter, installSources } from './oracle.ts';
import { projectInit, projectInspect } from './project.ts';
import { metadataRead } from './metadata.ts';
import { SyncStore, checkpoint } from './sync.ts';
import { DeploymentService } from './deploy.ts';
import { TestService } from './testing.ts';
import { ArtifactService } from './artifacts.ts';
import { JobService, type JobPhase } from './jobs.ts';
import { sandboxAction } from './sandbox.ts';
import { configureSqlcl, sqlclConfig, type SqlclConfig } from './sqlcl-config.ts';
import { PanelService } from './panel.ts';
import {
  fallbackCompilerDiagnostics,
  shipApply,
  shipPlan,
  validateApplication,
  type DiagnosticParser,
} from './ship.ts';

// The engine exports parseCompilerDiagnostics once structured compiler output
// lands; until then the fallback keeps diagnostics structured but coarse.
const engine = oracleModule as unknown as {
  parseCompilerDiagnostics?: DiagnosticParser;
  closeSqlclSessions?: () => Promise<void>;
};
export const parseDiagnostics: DiagnosticParser = (output) =>
  (engine.parseCompilerDiagnostics ?? fallbackCompilerDiagnostics)(output);

// Resolve settings and connection credentials for each operation. The SQLcl pool
// and capability cache live independently of this adapter.
export async function sharedOracle() {
  return new OracleAdapter();
}
/** Close pooled SQLcl sessions on process exit; safe when the engine has no pool. */
export async function shutdownOracle() {
  const close =
    engine.closeSqlclSessions ??
    (
      await import('./sqlcl-session.ts').then(
        (m) => m as { closeSqlclSessions?: () => Promise<void> },
        () => ({}) as { closeSqlclSessions?: () => Promise<void> },
      )
    ).closeSqlclSessions;
  await close?.().catch(() => undefined);
}

function routeProject(parsed: Record<string, unknown>) {
  const action = parsed.action as string;
  const pick = (...keys: string[]) =>
    Object.fromEntries(keys.filter((k) => parsed[k] !== undefined).map((k) => [k, parsed[k]]));
  switch (action) {
    case 'init':
      return { operation: 'project.init', input: pick('project', 'directory', 'template', 'alias') };
    case 'adopt':
      return { operation: 'project.adopt', input: pick('project', 'env', 'appId', 'workingCopy') };
    case 'inspect':
      return { operation: 'project.inspect', input: pick('project', 'detail') };
    case 'connection_add':
      return {
        operation: 'connection.add',
        input: pick('project', 'name', 'sqlclName', 'ordsUrl', 'ordsUsername', 'passwordFile'),
      };
    case 'connection_list':
      return { operation: 'connection.list', input: pick('project', 'saved') };
    default:
      return { operation: 'connection.test', input: pick('project', 'name', 'saved') };
  }
}
function routeReference(parsed: Record<string, unknown>) {
  const { mode, query, id, limit, offset, ...rest } = parsed;
  if (mode === 'read') {
    if (typeof id !== 'string') throw new Fault('INVALID_INPUT', 'id: required for mode read', 2);
    return {
      operation: 'docs.read',
      input: { project: rest.project, id, offset, ...(limit ? { limit } : {}) },
    };
  }
  if (typeof query !== 'string') throw new Fault('INVALID_INPUT', 'query: required for mode search', 2);
  if (typeof limit === 'number' && limit > 8)
    throw new Fault('INVALID_INPUT', 'limit: search returns at most 8 hits per page', 2);
  if (typeof offset === 'number' && offset > 10000)
    throw new Fault('INVALID_INPUT', 'offset: search offsets are at most 10000', 2);
  return { operation: 'docs.search', input: { ...rest, query, offset, ...(limit ? { limit } : {}) } };
}
export async function dispatch(
  operation: string,
  input: Record<string, unknown> = {},
  signal?: AbortSignal,
  progress?: (phase: JobPhase) => void,
): Promise<Result> {
  try {
    if (signal?.aborted)
      throw new Fault('CANCELLED', 'Operation cancelled before execution.', 6, 'cancelled');
    if (!(operation in schemas)) throw new Fault('INVALID_INPUT', `Unknown operation: ${operation}`, 2);
    const parsed = parse(
      schemas[operation as Operation] as import('zod').z.ZodType<Record<string, unknown>>,
      input,
    );
    const text = (key: string) => parsed[key] as string;
    const root = text('project') ?? process.cwd();
    // Composite MCP operations reuse the granular implementations and keep
    // their own name on the envelope so callers see the tool they invoked.
    if (operation === 'project' || operation === 'reference') {
      const route = operation === 'project' ? routeProject(parsed) : routeReference(parsed);
      return { ...(await dispatch(route.operation, route.input, signal, progress)), operation };
    }
    if (operation === 'job') {
      const result = await dispatch(
        parsed.action === 'cancel' ? 'jobs.cancel' : 'jobs.status',
        {
          project: parsed.project,
          id: parsed.jobId,
          ...(parsed.action === 'cancel' ? {} : { waitSeconds: parsed.waitSeconds }),
        },
        signal,
      );
      return { ...result, operation };
    }
    if (operation === 'status') {
      const result = await dispatch(
        parsed.detail === 'doctor' ? 'doctor' : 'panel.status',
        { project: parsed.project },
        signal,
      );
      return { ...result, operation };
    }
    const oracle = await sharedOracle(),
      tests = new TestService(oracle),
      testReports: unknown[] = [],
      deployment = new DeploymentService(oracle, async (ctx, env) => {
        const report = await tests.all(ctx, env);
        testReports.push(report.data);
        return report;
      });
    let data: unknown;
    switch (operation) {
      case 'panel.status':
        data = await new PanelService(root).snapshot();
        break;
      case 'version':
        data = { version: VERSION, node: process.version };
        break;
      case 'doctor':
        data = await doctor();
        break;
      case 'sqlcl.status':
        data = await sqlclConfig();
        break;
      case 'sqlcl.configure':
        data = await configureSqlcl(
          text('mode') as SqlclConfig['mode'],
          parsed.mcpRestrictLevel as SqlclConfig['mcpRestrictLevel'] | undefined,
          parsed.databaseTransport as SqlclConfig['databaseTransport'],
        );
        break;
      case 'dependencies.install': {
        const { ToolchainService } = await import('../../installer/src/toolchain.ts');
        data = await new ToolchainService().apply(parsed);
        break;
      }
      case 'dependencies.uninstall': {
        const { uninstallTools } = await import('../../installer/src/uninstall-tools.ts');
        data = await uninstallTools(parsed);
        break;
      }
      case 'setup':
      case 'plugin.install':
      case 'plugin.update': {
        const { setup } = await import('../../installer/src/setup.ts');
        data = await setup(parsed);
        break;
      }
      case 'plugin.validate': {
        const { validateNative } = await import('../../installer/src/setup.ts');
        data = await validateNative(text('from'));
        break;
      }
      case 'plugin.uninstall': {
        const { uninstallNative } = await import('../../installer/src/setup.ts');
        data = await uninstallNative(text('home') ?? managedHome(), Boolean(parsed.keepRuntime), {
          ...(text('codex') ? { codex: text('codex') } : {}),
        });
        break;
      }
      case 'project.init':
        data = await projectInit(
          text('directory'),
          text('template') as 'blank-app' | 'customer-crm' | 'existing-app',
          text('alias') ??
            path
              .basename(path.resolve(text('directory')))
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, '-'),
        );
        break;
      case 'connection.add':
        data = await configureConnection(text('name'), {
          sqlclName: text('sqlclName'),
          ordsUrl: text('ordsUrl'),
          ordsUsername: text('ordsUsername'),
          passwordFile: text('passwordFile'),
        });
        break;
      case 'connection.remove':
        data = await editConnection(text('name'));
        break;
      case 'connection.list':
        data = parsed.saved ? await oracle.savedConnections(signal) : await connections();
        break;
      case 'connection.test':
        if (parsed.saved && (await oracle.settings()).databaseTransport === 'ords')
          throw new Fault(
            'ORDS_SAVED_CONNECTION_UNSUPPORTED',
            'ORDS uses plugin connection references. Test the configured reference without --saved.',
            3,
            'blocked',
          );
        data = await oracle.identity(
          parsed.saved ? { kind: 'sqlcl-store', name: text('name') } : await resolveConnection(text('name')),
          signal,
        );
        if (parsed.saved) data = { name: text('name'), ...(data as Record<string, unknown>) };
        break;
      case 'docs.search':
        data = await referenceSearch(text('query'), text('version'), schemas['docs.search'].parse(parsed));
        break;
      case 'docs.read':
        data = await referenceRead(text('id'), Number(parsed.offset), Number(parsed.limit), text('project'));
        break;
      case 'docs.sync':
        data = await referenceSync(text('version'), Boolean(parsed.dryRun));
        break;
      case 'sandbox.up':
      case 'sandbox.status':
      case 'sandbox.down':
        data = await sandboxAction(operation.split('.')[1]!);
        break;
      default: {
        const ctx = await loadProject(root);
        switch (operation) {
          case 'compose.plan':
            data = await composePlan(ctx, schemas['compose.plan'].parse(parsed), oracle, signal);
            break;
          case 'compose.materialize':
            data = await composeMaterialize(ctx, schemas['compose.materialize'].parse(parsed), signal);
            break;
          case 'project.inspect':
            data = await projectInspect(ctx, parsed.detail as 'full' | 'summary');
            break;
          case 'metadata.read': {
            await requireTrust(ctx.root);
            const env = environment(ctx, text('env'));
            const { project: _p, env: _e, ...request } = parsed;
            data = await metadataRead(oracle, env, await resolveConnection(env.readConnectionRef), request);
            break;
          }
          case 'apex.generate': {
            await requireTrust(ctx.root);
            const generated = await oracle.generate(
              text('name'),
              text('alias') ?? ctx.config.application.alias,
            );
            data = {
              ...(await installSources(generated.directory, ctx.root, text('output'))),
              compiler: generated.compiler,
            };
            break;
          }
          case 'apex.sync':
            data = await deployment.sync(
              ctx,
              text('env'),
              parsed.action as 'init' | 'status' | 'refresh' | 'invalidate',
              signal,
            );
            break;
          case 'project.adopt':
          case 'apex.export': {
            await requireTrust(ctx.root);
            const env = environment(ctx, text('env'));
            if (operation === 'project.adopt' && env.applicationId !== parsed.appId)
              throw new Fault(
                'APPLICATION_TARGET_MISMATCH',
                'Requested app ID differs from the environment mapping.',
                5,
              );
            if (operation === 'project.adopt' && parsed.workingCopy) {
              data = await deployment.sync(ctx, text('env'), 'init', signal);
              break;
            }
            const connection = await resolveConnection(env.readConnectionRef);
            await oracle.verifyTarget(env, connection);
            const exported = await oracle.exportApplication(env, connection);
            data = await installSources(
              exported.directory,
              ctx.root,
              operation === 'project.adopt' ? ctx.config.application.sourceDir : text('output'),
            );
            break;
          }
          case 'apex.validate':
            await requireTrust(ctx.root);
            data = await validateApplication(
              oracle,
              await contained(ctx.root, ctx.config.application.sourceDir),
              parseDiagnostics,
              signal,
            );
            break;
          case 'ship': {
            const planned = await shipPlan(ctx, text('env'), deployment, parseDiagnostics, progress);
            if (parsed.mode !== 'apply') {
              data = {
                mode: 'plan',
                status: 'planned',
                ...planned.preview,
                planPath: planned.planPath,
                phases: planned.phases,
              };
              break;
            }
            const applied = await shipApply(
              ctx,
              planned.plan,
              text('userRequest'),
              deployment,
              () => testReports.at(-1),
              signal,
              progress,
            );
            data = {
              mode: 'apply',
              ...applied,
              planPath: planned.planPath,
              phases: [...planned.phases, ...applied.phases],
            };
            break;
          }
          case 'ship.apply':
            data = await shipApply(
              ctx,
              await readJson(await contained(ctx.root, text('plan'))),
              text('userRequest'),
              deployment,
              () => testReports.at(-1),
              signal,
              progress,
            );
            break;
          case 'apex.diff': {
            await requireTrust(ctx.root);
            const env = environment(ctx, text('env'));
            const store = new SyncStore(ctx, env, text('env'));
            const state = parsed.comparison === 'live' ? null : await store.read();
            let exported: { files: Record<string, string> }, provenance: string;
            if (state && state.status !== 'invalidated' && parsed.comparison !== 'live') {
              await store.validate(state);
              exported = checkpoint(state);
              provenance = state.lastSuccessfulImport ? 'last-successful-import' : 'initial-baseline';
            } else {
              const connection = await resolveConnection(env.readConnectionRef);
              await oracle.verifyTarget(env, connection);
              exported = await oracle.exportApplication(env, connection);
              provenance = 'live-export';
            }
            const local = (await projectInspect(ctx)).sources.apex as Record<string, string>;
            data = {
              scope: 'full-application-import',
              completeness: 'textual-file-hashes-only',
              provenance,
              changes: [...new Set([...Object.keys(exported.files), ...Object.keys(local ?? {})])]
                .filter((f) => exported.files[f] !== local?.[f])
                .map((file) => ({
                  file,
                  before: exported.files[file] ?? null,
                  after: local?.[file] ?? null,
                })),
            };
            break;
          }
          case 'db.plan':
            data = await deployment.plan(ctx, text('env'));
            break;
          case 'deploy.plan': {
            const plan = await deployment.plan(ctx, text('env'));
            await writeJson(await contained(ctx.root, text('out')), plan);
            data = plan;
            break;
          }
          case 'deploy.apply':
            data = await deployment.apply(
              ctx,
              await readJson(await contained(ctx.root, text('plan'))),
              signal,
            );
            break;
          case 'deploy.status':
            // Reconciliation resolves the read connection and exports the target.
            await requireTrust(ctx.root);
            data = await deployment.reconcile(ctx, text('run'));
            break;
          case 'deploy.restore-plan': {
            await requireTrust(ctx.root);
            const plan = await deployment.restorePlan(ctx, text('backup'));
            await writeJson(await contained(ctx.root, text('out')), plan);
            data = plan;
            break;
          }
          case 'test.run': {
            const suite = text('suite');
            if (suite === 'all') {
              if (!parsed.env) throw new Fault('ENVIRONMENT_REQUIRED', 'test all requires --env.', 2);
              const result = await tests.all(ctx, text('env'), signal);
              data = result.data;
              if (!result.ok)
                return {
                  ...failure(operation, new Fault('QUALITY_GATE_FAILED', 'Required suites did not pass.', 1)),
                  data,
                };
            } else {
              const result = await tests.run(
                ctx,
                suite as 'unit' | 'sql' | 'api' | 'e2e',
                text('env'),
                signal,
                Boolean(parsed.headed),
              );
              data = result;
              if (result.status !== 'passed')
                return {
                  ...failure(
                    operation,
                    new Fault(
                      'TEST_' + result.status.toUpperCase(),
                      result.diagnostic ?? `Suite is ${result.status}.`,
                      result.status === 'failed' ? 1 : 3,
                      result.status,
                    ),
                  ),
                  data,
                };
            }
            break;
          }
          case 'test.report':
            data = await readJson(await contained(ctx.root, '.apexrest/test-runs/' + text('run') + '.json'));
            break;
          case 'test.auth':
            data = await tests.auth(ctx, text('env'));
            break;
          case 'browser.open': {
            const { openVerificationBrowser } = await import('./browser.ts');
            data = await openVerificationBrowser(
              ctx,
              text('env'),
              undefined,
              parsed.browserMode as 'codex' | 'external' | undefined,
            );
            break;
          }
          case 'jobs.status':
            data = await new JobService(ctx).status(text('id'), Number(parsed.waitSeconds), signal);
            break;
          case 'jobs.cancel':
            data = await new JobService(ctx).cancel(text('id'));
            break;
          case 'artifacts.read':
            data = await new ArtifactService(ctx).read(
              text('id'),
              Number(parsed.offset),
              Number(parsed.limit),
            );
            break;
          default:
            throw new Fault('INVALID_INPUT', 'Unknown operation.', 2);
        }
      }
    }
    return success(operation, data);
  } catch (error) {
    return failure(operation, error);
  }
}
