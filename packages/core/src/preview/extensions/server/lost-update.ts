import { str, type ApxComponent } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { Session } from '../../render.ts';

/**
 * Lost update detection of form regions. When Form Initialization fetches a row the preview
 * remembers its row version column value (Lost Update Type "Row Version Column") or a checksum
 * of the form's column values ("Row Values", the default). Automatic Row Processing compares
 * the current row with it before an update or delete, as APEX does with its hidden checksum.
 */

export const LOST_UPDATE_MESSAGE =
  'Current version of data in database has changed since user initiated update process.';

interface Snapshot {
  key: string;
  checksum: string;
}

const snapshots = new WeakMap<Session, Map<string, Snapshot>>();

const slot = (pageId: string, region: ApxComponent) => `${pageId}:${region.id}`;

/** The configured row version column, or undefined for row-value checksums. */
export function rowVersionColumn(region: ApxComponent): string | undefined {
  const type = str(region.props, 'edit.lostUpdateType');
  const column = str(region.props, 'edit.rowVersionColumn');
  return /version/iu.test(type) && column ? column.toUpperCase() : undefined;
}

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));

export function checksum(region: ApxComponent, row: Row, columns: string[]): string {
  const version = rowVersionColumn(region);
  if (version) return `v:${text(row[version])}`;
  return JSON.stringify([...new Set(columns)].sort().map((column) => [column, text(row[column])]));
}

/** Remembers the fetched row of a form region for the session (`key`: its primary key values). */
export function rememberRow(
  session: Session,
  pageId: string,
  region: ApxComponent,
  key: string,
  row: Row,
  columns: string[],
): void {
  let map = snapshots.get(session);
  if (!map) snapshots.set(session, (map = new Map()));
  map.set(slot(pageId, region), { key, checksum: checksum(region, row, columns) });
}

export function forgetRow(session: Session, pageId: string, region: ApxComponent): void {
  snapshots.get(session)?.delete(slot(pageId, region));
}

/**
 * True when the row identified by `key` was fetched in this session and has changed (or is gone)
 * since. `current` is the row as it is now, undefined when it no longer exists.
 */
export function rowChanged(
  session: Session,
  pageId: string,
  region: ApxComponent,
  key: string,
  current: Row | undefined,
  columns: string[],
): boolean {
  const snapshot = snapshots.get(session)?.get(slot(pageId, region));
  if (!snapshot || snapshot.key !== key) return false;
  return !current || checksum(region, current, columns) !== snapshot.checksum;
}
