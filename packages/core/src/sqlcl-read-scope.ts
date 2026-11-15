import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { closeSqlclReadScope } from './sqlcl-session.ts';

/**
 * One connected SQLcl server for the read-only batches of one operation.
 *
 * Planning and applying a deployment read the target many times (identity,
 * versions, metadata, exports). Each read used to start its own SQLcl JVM and
 * connection, about 2-3 s before the query ran; an export also loaded its
 * classes again. Inside a read scope those batches run on one server: every
 * observation is still a new query against the database at the moment it is
 * requested, and the adapter resets the session state before each batch.
 *
 * The scope never carries a write: a write runs as its own restricted SQLcl
 * process or prepared import server. Reads after a write (post-import
 * verification) are new queries on the scope's server; each batch starts with
 * ROLLBACK and a package-state reset, so they observe the committed result.
 */
interface ReadScope {
  id: string;
}
const storage = new AsyncLocalStorage<ReadScope>();

export function connectedReadsDisabled() {
  return /^(?:0|false|off)$/i.test(process.env.APEXREST_CONNECTED_READS ?? '');
}
/** Nested calls share the outer scope; the outermost call closes the server. */
export async function withConnectedReads<T>(action: () => Promise<T>): Promise<T> {
  if (storage.getStore() || connectedReadsDisabled()) return action();
  const scope: ReadScope = { id: randomUUID() };
  try {
    return await storage.run(scope, action);
  } finally {
    await closeSqlclReadScope(scope.id);
  }
}
export function currentReadScope() {
  return storage.getStore()?.id;
}
