import { ArtifactService } from '../../core/src/artifacts.ts';
import { loadProject } from '../../core/src/config.ts';
import { sanitized, type Result } from '../../core/src/result.ts';
import { hash } from '../../core/src/fs.ts';

const inlineLimit = 8192;
const readerLimit = 32768;
const archives = new Map<string, { artifactId: string; capturedRunId: string }>();
const pruneIntervalMs = 3600000;
const pruned = new Map<string, number>();

// Expired result archives are removed opportunistically: once per project when
// this process first archives, then at most hourly. Pruning errors never affect output.
async function pruneArchives(service: ArtifactService, project: string, now = Date.now()) {
  const last = pruned.get(project);
  if (last !== undefined && now - last < pruneIntervalMs) return;
  pruned.set(project, now);
  if (pruned.size > 32) pruned.delete(pruned.keys().next().value!);
  await service.prune('results').catch(() => undefined);
}

function preview(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return { count: value.length };
  if (!value || typeof value !== 'object') return typeof value === 'string' ? value.slice(0, 400) : value;
  const data = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of [
    'id',
    'jobId',
    'projectId',
    'project',
    'root',
    'status',
    'ok',
    'operation',
    'exitCode',
    'summary',
    'configured',
    'trusted',
    'browserMode',
    'nextAction',
    'digest',
    'sourceDigest',
    'targetDigest',
    'environment',
    'expiresAt',
    'scope',
    'compiler',
    'approval',
    'backupRequired',
    'mode',
    'backupStrategy',
    'syncId',
    'revision',
    'exportedAt',
    'dirty',
    'blocked',
    'blockedReason',
    'serverFreshness',
    'backupId',
    'importingRunId',
    'phase',
    'runner',
    'planId',
    'planDigest',
    'planPath',
    'runId',
    'warningCount',
  ]) {
    const entry = data[key];
    if (['string', 'number', 'boolean'].includes(typeof entry))
      result[key] = typeof entry === 'string' ? entry.slice(0, 400) : entry;
  }
  for (const key of ['sync', 'jobs', 'deployments', 'diagnostics', 'artifacts', 'verification'])
    if (Array.isArray(data[key])) result[key + 'Count'] = data[key].length;
  if (Array.isArray(data.diagnostics))
    result.diagnostics = data.diagnostics
      .slice(0, 5)
      .map((entry) =>
        entry && typeof entry === 'object'
          ? Object.fromEntries(
              ['severity', 'code', 'message', 'file', 'line', 'column', 'type', 'hint']
                .filter((key) => ['string', 'number'].includes(typeof entry[key]))
                .map((key) => [key, typeof entry[key] === 'string' ? entry[key].slice(0, 600) : entry[key]]),
            )
          : String(entry).slice(0, 300),
      );
  for (const key of ['application', 'grant', 'verification', 'sources'])
    if (data[key] && typeof data[key] === 'object' && JSON.stringify(data[key]).length <= 1200)
      result[key] = data[key];
  if (Array.isArray(data.phases) && JSON.stringify(data.phases).length <= 1200) result.phases = data.phases;
  for (const key of ['artifacts', 'nextActions', 'risks'])
    if (Array.isArray(data[key])) {
      result[key] = data[key].slice(0, 4).map((entry) => String(entry).slice(0, 200));
      result[key + 'Omitted'] = Math.max(0, data[key].length - 4);
    }
  if (data.lastSuccessfulImport && typeof data.lastSuccessfulImport === 'object')
    result.lastSuccessfulImport = data.lastSuccessfulImport;
  if (data.workingCopy && typeof data.workingCopy === 'object') result.workingCopy = data.workingCopy;
  if (depth < 2 && data.result && typeof data.result === 'object')
    result.result = preview(data.result, depth + 1);
  if (data.operation === 'deploy.plan' && data.data && depth < 2) result.data = preview(data.data, depth + 1);
  const plan = data.scope === 'full-application-import' && typeof data.digest === 'string';
  if (plan) {
    const operations = data.operations;
    if (Array.isArray(operations))
      result.operationCounts = Object.fromEntries(
        ['migration', 'package', 'import', 'verify', 'test'].map((kind) => [
          kind,
          operations.filter((entry) => entry?.kind === kind).length,
        ]),
      );
    if (data.target && typeof data.target === 'object') {
      if (JSON.stringify(data.target).length <= 1200) result.target = data.target;
      else result.targetOmitted = true;
    }
    if (data.sources && typeof data.sources === 'object')
      result.sourceCount = Object.keys(data.sources).length;
  } else if (data.sources && typeof data.sources === 'object')
    result.sourceCounts = Object.fromEntries(
      Object.entries(data.sources)
        .slice(0, 8)
        .map(([key, files]) => [
          key.slice(0, 80),
          files && typeof files === 'object' ? Object.keys(files).length : null,
        ]),
    );
  return result;
}

// Keep operation outcome separate from transport size. A large successful
// operation must never become a failure that invites replaying a write.
export async function toolOutput(original: Result, project?: string) {
  const full = sanitized(original) as Result;
  const serialized = JSON.stringify(full);
  const reader = ['docs.read', 'artifacts.read', 'reference'].includes(full.operation);
  let result = full;
  if (serialized.length > (reader ? readerLimit : inlineLimit)) {
    let artifactId: string | undefined;
    let capturedRunId: string | undefined;
    try {
      if (!project) throw new Error('No project is available for a local result artifact.');
      const service = new ArtifactService(await loadProject(project));
      await pruneArchives(service, project);
      const key = hash(project + JSON.stringify({ ...full, runId: '' }));
      const cached = archives.get(key);
      if (
        cached &&
        (await service.read(cached.artifactId, 0, 1).then(
          () => true,
          () => false,
        ))
      ) {
        ({ artifactId, capturedRunId } = cached);
      } else {
        artifactId = await service.saveJson(full, 'mcp-result');
        capturedRunId = full.runId;
        archives.set(key, { artifactId, capturedRunId });
        if (archives.size > 32) archives.delete(archives.keys().next().value!);
      }
    } catch {
      artifactId = undefined;
    }
    // The first five diagnostics travel complete (file, line, column, hint);
    // the compiler's own ordering already puts the blocking errors first.
    result = {
      ...full,
      summary: full.summary.slice(0, 600),
      diagnostics: full.diagnostics.slice(0, 5),
      artifacts: artifactId ? [artifactId] : [],
      nextActions: [
        ...full.nextActions.slice(0, 3),
        artifactId
          ? 'For omitted details, use apexrest_artifact_read with output.artifactId and the same project. Follow nextOffset as needed; do not repeat the operation.'
          : 'The complete result could not be archived. Inspect the existing local operation record; do not rerun a completed operation.',
      ],
      data: {
        ...(preview(full.data) as Record<string, unknown>),
        output: {
          compacted: true,
          characters: serialized.length,
          diagnosticsCount: full.diagnostics.length,
          artifactsCount: full.artifacts.length,
          ...(artifactId ? { artifactId, capturedRunId } : { recovery: 'unavailable' }),
        },
      },
    };
    if (JSON.stringify(result).length > inlineLimit) {
      const data = result.data as Record<string, unknown>;
      result.data = Object.fromEntries(
        ['id', 'jobId', 'status', 'phase', 'ok', 'output']
          .filter((key) => data[key] !== undefined)
          .map((key) => [key, data[key]]),
      );
      if (data.result && typeof data.result === 'object') {
        const nested = data.result as Record<string, unknown>;
        (result.data as Record<string, unknown>).result = Object.fromEntries(
          ['id', 'ok', 'status', 'exitCode', 'operation', 'summary']
            .filter((field) => ['string', 'number', 'boolean'].includes(typeof nested[field]))
            .map((field) => [field, nested[field]]),
        );
      }
      if (JSON.stringify(result).length > inlineLimit)
        result.diagnostics = result.diagnostics.map((d) => ({ ...d, message: d.message.slice(0, 400) }));
    }
  }
  return {
    isError: !result.ok,
    content: [{ type: 'text' as const, text: result === full ? serialized : JSON.stringify(result) }],
  };
}
