import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { workingCopyFixture } from './working-copy.ts';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { DeploymentService } from '../../packages/core/src/deploy.ts';
import { SyncStore } from '../../packages/core/src/sync.ts';
import type { Connection } from '../../packages/core/src/connections.ts';

/** Real adapter/batch boundaries over a fake server: session counts, never Oracle evidence. */
export async function observedWorkingCopy() {
  const f = await workingCopyFixture();
  await f.service.sync(f.ctx, 'dev', 'init');
  const store = new SyncStore(f.ctx, f.env, 'dev');
  const state = (await store.read())!;
  const connections: string[] = [];
  let observations = 0;
  const controls = { beforeObservation: (_number: number) => {} };
  const oracle = new OracleAdapter(async (request) => {
    connections.push(request.args.join(' '));
    const input = request.input ?? '';
    const markers = [...input.matchAll(/prompt (APEXREST_ROWS_\w+_\d+)/g)].map((m) => m[1]!);
    if (input.includes("'identity' target_record")) controls.beforeObservation(++observations);
    const target = await f.oracle.verifyTarget();
    const identity = [
      { target_record: 'identity', ...target.identity },
      { target_record: 'workspace', ...target.workspace },
      ...(target.application ? [{ target_record: 'application', ...target.application }] : []),
    ];
    const rows: Record<string, unknown>[][] = [identity];
    if (input.includes('last_updated_on_is_null')) {
      const metadata = await f.oracle.applicationMetadata();
      rows.push([{ last_updated_on: metadata.lastUpdatedOn, last_updated_by: metadata.lastUpdatedBy }]);
    }
    const envelope = (items: unknown[]) => JSON.stringify({ results: [{ items }] });
    return {
      code: 0,
      stdout: markers.length
        ? markers.map((marker, index) => envelope(rows[index]!) + '\n' + marker).join('\n')
        : input.includes("'identity' target_record")
          ? envelope(identity)
          : 'APEXREST_APEX_IMPORT_COMPLETE',
      stderr: '',
      timedOut: false,
      cancelled: false,
      truncated: false,
    };
  });
  const stage = await mkdtemp(path.join(tmpdir(), 'apexrest-observations-'));
  oracle.stage = async () => stage;
  oracle.settings = async () => ({
    schemaVersion: 1,
    executable: 'sql',
    javaHome: undefined,
    mode: 'cli',
    mcpRestrictLevel: '4',
  });
  oracle.requireCapability = f.oracle.requireCapability as unknown as OracleAdapter['requireCapability'];
  oracle.requireMutationSupport = f.oracle.requireMutationSupport;
  oracle.validate = f.oracle.validate as unknown as OracleAdapter['validate'];
  oracle.exportApplication = f.oracle.exportApplication as unknown as OracleAdapter['exportApplication'];
  oracle.importApplication = async (ctx, env, connection, source) => {
    await oracle.session(
      'prompt APEXREST_APEX_IMPORT_COMPLETE',
      connection,
      true,
      undefined,
      undefined,
      'text',
      undefined,
      undefined,
      'import',
    );
    await f.oracle.importApplication(ctx, env, connection, source);
    return 'APEXREST_APEX_IMPORT_COMPLETE';
  };
  const service = new DeploymentService(oracle);
  return {
    ...f,
    oracle,
    service,
    state,
    store,
    connections,
    observationControls: controls,
    connection: { kind: 'sqlcl-store', name: 'read' } as Connection,
  };
}
