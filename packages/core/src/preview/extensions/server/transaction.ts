import type { DatabaseSync } from 'node:sqlite';

/**
 * Page-processing transactions of the local preview. APEX runs a page submit (and an Ajax
 * request such as Execute Server-side Code) in one database transaction: it commits when
 * processing ends without error and rolls back when an unhandled error stops it. PL/SQL
 * COMMIT/ROLLBACK/SAVEPOINT statements act on that transaction.
 */

interface State {
  /** The transaction was opened here with BEGIN (false: a savepoint inside someone else's). */
  owned: boolean;
  savepoints: string[];
}

const OUTER = 'apex_local_page';
const active = new WeakMap<DatabaseSync, State>();

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

function open(db: DatabaseSync): State {
  const owned = !db.isTransaction;
  db.exec(owned ? 'begin' : `savepoint ${OUTER}`);
  return { owned, savepoints: [] };
}

function close(db: DatabaseSync, state: State, commit: boolean): void {
  if (state.owned) {
    if (db.isTransaction) db.exec(commit ? 'commit' : 'rollback');
    return;
  }
  if (!db.isTransaction) return;
  if (!commit) db.exec(`rollback to ${OUTER}`);
  db.exec(`release ${OUTER}`);
}

/** True while page processing runs in a transaction managed here. */
export function inTransaction(db: DatabaseSync): boolean {
  return active.has(db);
}

/**
 * Runs `work` in a transaction: committed unless `work` throws or `failed(result)` is true, in
 * which case everything it changed is rolled back. Nested calls join the outer transaction.
 */
export function transaction<T>(db: DatabaseSync, work: () => T, failed: (result: T) => boolean): T {
  if (active.has(db) || !db.isOpen) return work();
  const state = open(db);
  active.set(db, state);
  let ok = false;
  try {
    const result = work();
    ok = !failed(result);
    return result;
  } finally {
    active.delete(db);
    close(db, state, ok);
  }
}

/** PL/SQL COMMIT: makes the work so far permanent; later work starts a new transaction. */
export function commitWork(db: DatabaseSync): void {
  const state = active.get(db);
  if (!state || !state.owned) return;
  if (db.isTransaction) db.exec('commit');
  db.exec('begin');
  state.savepoints = [];
}

/** PL/SQL ROLLBACK [TO SAVEPOINT name]. Returns false when the savepoint does not exist. */
export function rollbackWork(db: DatabaseSync, savepoint?: string): boolean {
  const state = active.get(db);
  if (savepoint) {
    const name = savepoint.toUpperCase();
    const index = state?.savepoints.lastIndexOf(name) ?? -1;
    if (!state || index < 0) return false;
    db.exec(`rollback to ${quote(`apex_sp_${name}`)}`);
    state.savepoints.length = index + 1;
    return true;
  }
  if (!state) return true;
  if (state.owned) {
    if (db.isTransaction) db.exec('rollback');
    db.exec('begin');
  } else if (db.isTransaction) db.exec(`rollback to ${OUTER}`);
  state.savepoints = [];
  return true;
}

/** PL/SQL SAVEPOINT name (outside page processing it is ignored). */
export function savepoint(db: DatabaseSync, name: string): void {
  const state = active.get(db);
  if (!state) return;
  const upper = name.toUpperCase();
  db.exec(`savepoint ${quote(`apex_sp_${upper}`)}`);
  state.savepoints.push(upper);
}
