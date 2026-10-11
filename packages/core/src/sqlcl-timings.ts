import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';

export type SqlclLabel =
  | 'session'
  | 'verifyTarget'
  | 'applicationMetadata'
  | 'targetWithMetadata'
  | 'versionedTarget'
  | 'metadata-batch'
  | 'export'
  | 'import'
  | 'restore'
  | 'validate'
  | 'capability'
  | 'codescan';
export interface SqlclExecutionTiming {
  queueMs: number;
  statementMs?: number[];
  spawnMs: number | null;
  connectMs: number | null;
  executeMs: number;
  totalMs: number;
  reused: boolean;
  mutation: boolean;
  connected: boolean;
  transport: 'mcp-pool' | 'mcp' | 'cli';
}
export interface SqlclTiming extends SqlclExecutionTiming {
  label: SqlclLabel;
}
const storage = new AsyncLocalStorage<SqlclTiming[]>();
const labels = new Set<SqlclLabel>([
  'session',
  'verifyTarget',
  'applicationMetadata',
  'targetWithMetadata',
  'versionedTarget',
  'metadata-batch',
  'export',
  'import',
  'restore',
  'validate',
  'capability',
  'codescan',
]);
/** Nested calls share one recorder; independent operations never share observations. */
export function withSqlclTimings<T>(action: () => Promise<T>): Promise<T> {
  return storage.getStore() ? action() : storage.run([], action);
}
export function sqlclTimings() {
  return storage.getStore()?.map((r) => ({ ...r })) ?? [];
}
/** Explicit field selection and bounded labels prevent SQL, bindings and identity leakage. */
export function recordSqlclTiming(label: SqlclLabel, r: SqlclExecutionTiming) {
  storage.getStore()?.push({
    queueMs: r.queueMs,
    ...(r.statementMs ? { statementMs: [...r.statementMs] } : {}),
    label: labels.has(label) ? label : 'session',
    spawnMs: r.spawnMs,
    connectMs: r.connectMs,
    executeMs: r.executeMs,
    totalMs: r.totalMs,
    reused: r.reused,
    mutation: r.mutation,
    connected: r.connected,
    transport: r.transport,
  });
}
export function executionTiming(
  transport: SqlclExecutionTiming['transport'],
  mutation = false,
  connected = false,
): SqlclExecutionTiming {
  return {
    queueMs: 0,
    spawnMs: 0,
    connectMs: null,
    executeMs: 0,
    totalMs: 0,
    reused: false,
    mutation,
    connected,
    transport,
  };
}
export function emitSqlclTiming(
  callback: ((r: SqlclExecutionTiming) => void) | undefined,
  timing: SqlclExecutionTiming,
  started: number,
) {
  timing.totalMs = performance.now() - started;
  try {
    callback?.({ ...timing });
  } catch {
    /* Observation must never alter execution. */
  }
}

/** Attach only validated local statement durations to the current batch record. */
export function recordStatementTimings(label: SqlclLabel, durations: number[]) {
  const records = storage.getStore();
  const record = records?.findLast((r) => r.label === label);
  if (record) record.statementMs = [...durations];
}
