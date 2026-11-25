import { fileURLToPath } from 'node:url';
import { withSqlclTimings, sqlclTimings } from './sqlcl-timings.ts';
import { composePlan, composeMaterialize } from './composer/service.ts';
import { VERSION } from './version.ts';
import path from 'node:path';
import { doctor, lockDiagnostics } from './doctor.ts';
import { referenceSearch, referenceRead, referenceSync } from './references.ts';
import { referenceSelect } from './reference-selection.ts';
import { failure, Fault, success, type Result } from './result.ts';
import { schemas } from './operations.ts';
import type { Operation } from './operations.ts';
import { environment, loadProject, managedHome, parse } from './config.ts';
import { connections, configureConnection, editConnection, resolveConnection } from './connections.ts';
import { canonical, contained, exists, hash, readJson, writeJson } from './fs.ts';
import * as oracleModule from './oracle.ts';
import { OracleAdapter, installSources } from './oracle.ts';
import { projectInit, projectInspect } from './project.ts';
import { metadataRead } from './metadata.ts';
import { SyncStore, checkpoint } from './sync.ts';
import { DeploymentService, deployPlanSchema, sourceInventory } from './deploy.ts';
import { traceReport, withTrace, type TraceReport } from './spans.ts';
import { recordRevision, revisionOf } from './revision.ts';
import { pageContext, patchPage } from './edit/patch.ts';
import { insertComponents } from './edit/insert.ts';
import { editPage } from './edit/page-edit.ts';
import { lovContext, lovEdit, lovFile } from './edit/lov.ts';
import { listEntities } from './entities.ts';
import { checkEntityBinding } from './entity-check.ts';
import { runRecipe } from './recipes.ts';
import { editHistory, redoEdit, undoEdit } from './edit/history.ts';
import { brokerStatus, startBroker, stopBroker } from './broker.ts';
import { reconcileRun } from './deploy-reconcile.ts';
import { ArtifactService } from './artifacts.ts';
import { jobToolResult, JobService, type JobPhase } from './jobs.ts';
import { configureSqlcl, sqlclConfig, type SqlclConfig } from './sqlcl-config.ts';
import { PanelService } from './panel.ts';
import { configureGlobalSettings, recordProject, requireCatalog, settingsStatus } from './global-settings.ts';
import { importUsage, observeUsage, usageStatus } from './usage.ts';
import { peerReview, peerReviewGate, peerStatus, type PeerVendor } from './peer-review.ts';
import {
  fallbackCompilerDiagnostics,
  shipApply,
  shipPlan,
  validateApplication,
  validationSource,
  planPreview,
  type PlanConfirmation,
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

async function readRequestedPlan(root: string, file: string, env: string) {
  const plan = parse(deployPlanSchema, await readJson(await contained(root, file)));
  if (env !== plan.environment)
    throw new Fault('PLAN_ENVIRONMENT_MISMATCH', 'The saved plan belongs to another environment.', 5);
  return plan;
}

// Resolve settings and connection credentials for each operation. The SQLcl pool
// and capability cache live independently of this adapter.
export async function sharedOracle() {
  return new OracleAdapter();
}
const compilerPrewarms = new Map<string, Promise<void>>();
/**
 * Load the APEXlang compiler for a project in the background (MCP server only). The first
 * validation of a session otherwise waits for a cold compiler (7.7-14.1 s measured against
 * about 1 s warm). It validates the project's sources offline on the pooled SQLcl server that
 * later validations reuse; the result is discarded and failures are ignored. Once per project
 * per process. `APEXREST_PREWARM=0` disables it.
 */
export function prewarmCompiler(project: string) {
  if (/^(?:0|false|off)$/i.test(process.env.APEXREST_PREWARM ?? '') || compilerPrewarms.has(project)) return;
  compilerPrewarms.set(
    project,
    (async () => {
      try {
        const ctx = await loadProject(project);
        const source = await contained(ctx.root, ctx.config.application.sourceDir);
        if (!(await exists(path.join(source, '.apex/apexlang.json')))) {
          // Nothing to compile yet (before project init): let a later call try again.
          compilerPrewarms.delete(project);
          return;
        }
        await (await sharedOracle()).validate(source);
      } catch {
        /* Preloading never reports: the real validation gives the diagnostics. */
      }
    })(),
  );
}
/**
 * Whether a call waits for a running compiler preload. Compiling operations reuse the preload's
 * SQLcl server instead of starting a second one, and a connected preview (env) starts its own SQLcl
 * session, so it waits rather than cold-starting a second JVM beside the preload. The local preview
 * (SQLite) and its status, stop, comments and resolve never touch the compiler and proceed at once.
 */
export function waitsForCompilerPrewarm(operation: string, input: Record<string, unknown>): boolean {
  if (operation === 'apex.validate' || operation === 'ship') return true;
  if (operation !== 'preview') return false;
  return (
    (input.action === 'start' || input.action === 'check') &&
    typeof input.env === 'string' &&
    input.env !== ''
  );
}
/** The project source revision a validation binds to; undefined outside a configured project. */
async function validationRevision(root: string): Promise<{ root: string; revision: string } | undefined> {
  let ctx;
  try {
    ctx = await loadProject(root);
  } catch {
    return undefined;
  }
  return { root: ctx.root, revision: revisionOf(await sourceInventory(ctx)) };
}
/** Wait for a running preload so a validation reuses its server instead of starting a second one. */
export async function compilerPrewarmed(project: string) {
  await compilerPrewarms.get(project);
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
    case 'insert':
      return {
        operation: 'project.insert',
        input: pick('project', 'page', 'components', 'expectedDigest', 'context'),
      };
    case 'context':
      return { operation: 'project.context', input: pick('project', 'page') };
    case 'entities':
      return { operation: 'entity.list', input: pick('project') };
    case 'undo':
      return { operation: 'project.undo', input: pick('project') };
    case 'redo':
      return { operation: 'project.redo', input: pick('project') };
    case 'recipe':
      return { operation: 'project.recipe', input: pick('project', 'request', 'env') };
    case 'entity_check':
      return { operation: 'entity.check', input: pick('project', 'entity', 'env', 'expectedDigest') };
    case 'lov_context':
      return { operation: 'lov.context', input: pick('project', 'lov') };
    case 'lov_edit':
      return { operation: 'lov.edit', input: pick('project', 'lov', 'entries', 'query', 'expectedDigest') };
    case 'edit':
      return {
        operation: 'project.edit',
        input: pick('project', 'page', 'operations', 'expectedDigest', 'context'),
      };
    case 'patch':
      return {
        operation: 'project.patch',
        input: pick('project', 'page', 'operations', 'expectedDigest', 'context'),
      };
    case 'scaffold':
      return { operation: 'project.scaffold', input: pick('project', 'specFile', 'env') };
    case 'connection_add':
      return {
        operation: 'connection.add',
        input: pick(
          'project',
          'name',
          'sqlclName',
          'ordsUrl',
          'ordsUsername',
          'passwordFile',
          'envFile',
          'usernameKey',
          'passwordKey',
          'urlKey',
        ),
      };
    case 'connection_list':
      return { operation: 'connection.list', input: pick('project', 'saved') };
    default:
      return { operation: 'connection.test', input: pick('project', 'name', 'saved') };
  }
}
function routeReference(parsed: Record<string, unknown>) {
  const { mode, query, id, request, limit, offset, ...rest } = parsed;
  if (mode === 'select') {
    if (!rest.project) throw new Fault('INVALID_INPUT', 'project: required for mode select', 2);
    return {
      operation: 'docs.select',
      input: {
        project: rest.project,
        request,
        version: rest.version,
        ...(limit !== undefined ? { limit } : {}),
      },
    };
  }
  if (request !== undefined) throw new Fault('INVALID_INPUT', 'request: supported only for mode select', 2);
  if (mode === 'read') {
    if (typeof id !== 'string') throw new Fault('INVALID_INPUT', 'id: required for mode read', 2);
    return {
      operation: 'docs.read',
      input: {
        project: rest.project,
        version: rest.version,
        id,
        offset,
        ...(typeof limit === 'number' ? { limit: Math.min(limit, 8192) } : {}),
      },
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
  return withSqlclTimings(() =>
    observeUsage(
      operation,
      async () => {
        // A ship runs in one operation trace (spans.ts): planning, a job's queue and worker, apply.
        const shipping = operation === 'ship' || operation === 'ship.apply' || operation === 'ship.intent';
        let operations: TraceReport | undefined;
        const result = shipping
          ? await withTrace(async () => {
              const value = await dispatchObserved(operation, input, signal, progress);
              // A successful ship reports its spans. A failure keeps its shape: it carries the
              // correlation id as a fact, and a started run keeps the spans in its journal.
              const report = traceReport();
              if (value.ok && report?.spans.length) operations = report;
              return value;
            })
          : await dispatchObserved(operation, input, signal, progress);
        const timings = sqlclTimings().map(({ statementMs, ...r }) => ({
          ...r,
          ...(input.debugTimings === true && statementMs ? { statementMs } : {}),
        }));
        if (operation === 'metadata.read' && result.ok) {
          return {
            ...result,
            data: {
              ...(result.data as object),
              sessions: timings.length,
              sqlclMs: timings.reduce((sum, r) => sum + r.totalMs, 0),
              ...(input.debugTimings === true ? { sqlclTimings: timings } : {}),
            },
          };
        }
        if (shipping && (result.ok || timings.length)) {
          const data = (result.data ?? {}) as Record<string, unknown>;
          return {
            ...result,
            data: {
              ...data,
              ...(operations ? { correlationId: operations.correlationId, operations } : {}),
              details: {
                ...((data.details as object) ?? {}),
                sqlclTimings: timings,
              },
            },
          };
        }
        if (input.debugTimings === true && result.ok)
          return { ...result, data: { ...(result.data as object), sqlclTimings: timings } };
        return result;
      },
      () => sqlclTimings().reduce((sum, entry) => sum + entry.totalMs, 0),
    ),
  );
}
async function dispatchObserved(
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
      // A terminal job reports its recorded outcome on the envelope, exactly as
      // the long-running tools do, so a failed import is never read as ok:true.
      const job = result.data as Record<string, unknown> | undefined;
      if (parsed.action !== 'cancel' && result.ok && job && typeof job.operation === 'string')
        return { ...jobToolResult(job.operation, job), operation };
      return { ...result, operation };
    }
    if (operation === 'peer') {
      const result = await dispatch(
        parsed.action === 'status' ? 'peer.status' : 'peer.review',
        parsed.action === 'status'
          ? { project: parsed.project }
          : { project: parsed.project, plan: parsed.plan, vendor: parsed.vendor, focus: parsed.focus },
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
    if (operation === 'preview' || operation.startsWith('preview.')) {
      const { previewDispatch } = await import('./preview/service.ts');
      return success(operation, await previewDispatch(operation, parsed, root));
    }
    const oracle = await sharedOracle();
    const deployment = new DeploymentService(oracle);
    let data: unknown;
    switch (operation) {
      case 'panel.status':
        data = await new PanelService(root).snapshot();
        break;
      case 'version':
        data = { version: VERSION, node: process.version };
        break;
      case 'doctor': {
        const report = await doctor(root);
        const result = success(operation, report);
        result.diagnostics.push(...lockDiagnostics(report.toolchainLock));
        return result;
      }
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
      case 'project.scaffold': {
        const { scaffold } = await import('./scaffold.ts');
        data = await scaffold(await loadProject(root), text('specFile'), text('env'));
        break;
      }
      case 'connection.add':
        data = await configureConnection(text('name'), {
          project: text('project'),
          sqlclName: text('sqlclName'),
          ordsUrl: text('ordsUrl'),
          ordsUsername: text('ordsUsername'),
          passwordFile: text('passwordFile'),
          envFile: text('envFile'),
          usernameKey: text('usernameKey'),
          passwordKey: text('passwordKey'),
          urlKey: text('urlKey'),
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
      case 'settings.status':
        data = await settingsStatus();
        break;
      case 'settings.configure':
        data = await configureGlobalSettings({
          ...(parsed.decisionApi ? { decisionApi: parsed.decisionApi === 'on' } : {}),
          ...(parsed.apiKeyEnv ? { apiKeyEnv: text('apiKeyEnv') } : {}),
          ...(parsed.decisionTimeoutMs !== undefined
            ? { decisionTimeoutMs: Number(parsed.decisionTimeoutMs) }
            : {}),
          ...(parsed.catalog ? { catalog: parsed.catalog === 'on' } : {}),
          ...(parsed.usageLog ? { usageLog: parsed.usageLog === 'on' } : {}),
        });
        break;
      case 'usage.status':
        data = await usageStatus(Number(parsed.limit));
        break;
      case 'usage.import':
        data = await importUsage(
          parsed.host as 'codex' | 'claude',
          text('file'),
          parsed.elapsedMs as number | undefined,
          parsed.counterMode as 'cumulative-session' | undefined,
        );
        break;
      case 'docs.search':
        await requireCatalog();
        data = await referenceSearch(text('query'), text('version'), schemas['docs.search'].parse(parsed));
        break;
      case 'docs.select':
        await requireCatalog();
        data = await referenceSelect(schemas['docs.select'].parse(parsed), signal);
        break;
      case 'docs.read':
        await requireCatalog();
        data = await referenceRead(
          text('id'),
          Number(parsed.offset),
          Number(parsed.limit),
          text('project'),
          text('version'),
        );
        break;
      case 'docs.sync':
        data = await referenceSync(text('version'), Boolean(parsed.dryRun));
        break;
      case 'peer.status':
        data = await peerStatus(parsed.project ? await loadProject(root) : undefined);
        break;
      case 'apex.validate': {
        // --source-dir validates any APEXlang folder; without it the project's application is used.
        // A project validation is bound to the source revision observed before the compiler's
        // staged copy (which itself refuses drift while staging), and recorded for that revision.
        const bound = parsed.sourceDir ? undefined : await validationRevision(root);
        const startedAt = new Date().toISOString();
        data = await validateApplication(
          oracle,
          await validationSource(root, {
            project: parsed.project as string | undefined,
            sourceDir: parsed.sourceDir as string | undefined,
          }),
          parseDiagnostics,
          signal,
        );
        if (bound) {
          const warnings = Number((data as { warningCount?: unknown }).warningCount ?? 0);
          await recordRevision(bound.root, 'validated', {
            revision: bound.revision,
            startedAt,
            finishedAt: new Date().toISOString(),
            detail: { warnings },
          });
          data = { ...(data as object), revision: bound.revision };
        }
        break;
      }
      default: {
        const ctx = await loadProject(root);
        switch (operation) {
          case 'compose.plan':
            data = await composePlan(ctx, schemas['compose.plan'].parse(parsed), oracle, signal);
            break;
          case 'compose.materialize':
            data = await composeMaterialize(ctx, schemas['compose.materialize'].parse(parsed), signal);
            break;
          case 'dev.start':
            // The runtime entry sits next to this bundle (dist/runtime/apexrest.mjs), as for MCP workers.
            data = await startBroker(
              ctx,
              path.join(path.dirname(fileURLToPath(import.meta.url)), 'apexrest.mjs'),
            );
            break;
          case 'dev.status':
            data = await brokerStatus(ctx);
            break;
          case 'dev.stop':
            data = await stopBroker(ctx, Number(parsed.waitSeconds ?? 30));
            break;
          case 'project.insert':
            data = await insertComponents(ctx, schemas['project.insert'].parse(parsed));
            break;
          case 'project.context':
            data = await pageContext(ctx, String(parsed.page));
            break;
          case 'project.patch':
            data = await patchPage(ctx, schemas['project.patch'].parse(parsed));
            break;
          case 'project.undo':
            data = await undoEdit(ctx);
            break;
          case 'project.redo':
            data = await redoEdit(ctx);
            break;
          case 'project.history':
            data = await editHistory(ctx);
            break;
          case 'project.recipe':
            data = await runRecipe(ctx, schemas['project.recipe'].parse(parsed));
            break;
          case 'entity.list':
            data = await listEntities(ctx);
            break;
          case 'entity.check':
            data = await checkEntityBinding(ctx, schemas['entity.check'].parse(parsed), {
              oracle,
              environment: (name) => environment(ctx, name),
              connection: (env) => resolveConnection(env.readConnectionRef),
              lovExists: (key) =>
                lovFile(ctx, key).then(
                  () => true,
                  () => false,
                ),
              signal,
            });
            break;
          case 'lov.context':
            data = await lovContext(ctx, String(parsed.lov));
            break;
          case 'lov.edit':
            data = await lovEdit(ctx, schemas['lov.edit'].parse(parsed));
            break;
          case 'project.edit':
            data = await editPage(ctx, schemas['project.edit'].parse(parsed));
            break;
          case 'project.inspect':
            data = await projectInspect(ctx, parsed.detail as 'full' | 'summary');
            break;
          case 'metadata.read': {
            const env = environment(ctx, text('env'));
            const { project: _p, env: _e, debugTimings: _debug, ...request } = parsed;
            data = await metadataRead(
              oracle,
              env,
              await resolveConnection(env.readConnectionRef),
              request,
              _debug === true,
            );
            break;
          }
          case 'apex.generate': {
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
            if (parsed.action === 'changes') {
              data = await deployment.serverChanges(ctx, text('env'));
              break;
            }
            data = await deployment.sync(
              ctx,
              text('env'),
              parsed.action as 'init' | 'status' | 'refresh' | 'invalidate',
              signal,
            );
            break;
          case 'project.adopt':
          case 'apex.export': {
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
          case 'peer.review':
            data = await peerReview(
              ctx,
              {
                plan: parsed.plan as string | undefined,
                vendor: parsed.vendor as PeerVendor | undefined,
                focus: parsed.focus as string | undefined,
              },
              (value) => deployment.checkLocal(ctx, value),
              signal,
            );
            break;
          case 'ship': {
            if (parsed.mode === 'recover') {
              if (!parsed.run)
                throw new Fault('INVALID_INPUT', 'Recover requires the original deployment run UUID.', 2);
              const recovered = await deployment.recover(ctx, text('run'), text('env'));
              data =
                recovered.status === 'succeeded'
                  ? recovered
                  : await shipApply(
                      ctx,
                      recovered.retryPlan,
                      text('userRequest'),
                      deployment,
                      signal,
                      progress,
                    );
              break;
            }
            if (parsed.confirmation && !parsed.plan)
              throw new Fault(
                'INVALID_INPUT',
                'Confirmation requires the exact saved reviewed plan path.',
                2,
              );
            const planned = parsed.plan
              ? await (async () => {
                  const { plan } = await deployment.checkLocal(
                    ctx,
                    await readRequestedPlan(ctx.root, text('plan'), text('env')),
                  );
                  return { plan, planPath: text('plan'), phases: [], preview: planPreview(ctx, plan) };
                })()
              : await shipPlan(ctx, text('env'), deployment, parseDiagnostics, progress, {
                  importMode: parsed.importMode as 'auto' | 'full' | 'files',
                  ...(parsed.files ? { files: parsed.files as string[] } : {}),
                });
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
            const peer = await peerReviewGate(ctx, planned.plan);
            const applied = await shipApply(
              ctx,
              planned.plan,
              text('userRequest'),
              deployment,
              signal,
              progress,
              parsed.confirmation as PlanConfirmation | undefined,
            );
            data = {
              mode: 'apply',
              ...applied,
              planPath: planned.planPath,
              phases: [...planned.phases, ...applied.phases],
              ...(peer ? { peerReview: peer } : {}),
            };
            break;
          }
          case 'ship.intent': {
            const { runShipIntent } = await import('./ship-intent.ts');
            data = await runShipIntent(ctx, text('intent'), deployment, parseDiagnostics, signal, progress);
            break;
          }
          case 'ship.apply': {
            const plan = await readRequestedPlan(ctx.root, text('plan'), text('env'));
            const peer = await peerReviewGate(ctx, plan);
            data = await shipApply(
              ctx,
              plan,
              text('userRequest'),
              deployment,
              signal,
              progress,
              parsed.confirmation as PlanConfirmation | undefined,
            );
            if (peer) data = { ...(data as object), peerReview: peer };
            break;
          }
          case 'apex.diff': {
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
            const plan = await deployment.plan(ctx, text('env'), {
              importMode: parsed.importMode as 'auto' | 'full' | 'files',
              ...(parsed.files ? { files: parsed.files as string[] } : {}),
            });
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
          case 'deploy.reconcile':
            data = await reconcileRun(ctx, schemas['deploy.reconcile'].parse(parsed));
            break;
          case 'deploy.status':
            // Reconciliation resolves the read connection and exports the target.
            data = await deployment.reconcile(ctx, text('run'));
            break;
          case 'deploy.restore-plan': {
            const plan = await deployment.restorePlan(ctx, text('backup'));
            await writeJson(await contained(ctx.root, text('out')), plan);
            data = plan;
            break;
          }
          case 'browser.open': {
            const { openVerificationBrowser } = await import('./browser.ts');
            data = await openVerificationBrowser(
              ctx,
              text('env'),
              parsed.browserMode as 'codex' | 'host' | 'chrome' | 'edge' | undefined,
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
    if (!observationOnly.has(operation)) await rememberProject(root);
    return success(operation, data);
  } catch (error) {
    return failure(operation, error);
  }
}
// Status reads (including desktop widgets polling them) never change the current project.
const observationOnly = new Set([
  'panel.status',
  'status',
  'doctor',
  'version',
  'settings.status',
  'usage.status',
  'usage.import',
  'jobs.status',
  'peer.status',
  // Status reads that must not change the current project.
  'connection.list',
  'preview.status',
]);
/**
 * The project a successful operation ran in becomes the machine's current
 * project: the --project it named (absolute or relative), else the working
 * directory when that directory holds apexrest.json.
 */
async function rememberProject(root: string) {
  try {
    const ctx = await loadProject(path.resolve(root));
    await recordProject(ctx.root, ctx.config.projectId);
  } catch {
    /* not a configured project: nothing to remember */
  }
}
