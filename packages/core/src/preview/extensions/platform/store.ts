import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { get, isRef, str, type ApxComponent, type ApxValue } from '../../apexlang.ts';
import { isoDate } from '../../database.ts';
import type { ApexRenderer } from '../../render.ts';

/**
 * SQLite plumbing shared by the platform services: deterministic component IDs, generated
 * (read-only) dictionary tables, persistent `apex_local_*` state tables and the views over them.
 */

export const WORKSPACE = 'PREVIEW';
export const WORKSPACE_ID = 1_000_000_000;

export type Row = Record<string, unknown>;

/** A stable positive numeric ID for a component, so links survive hot reloads. */
export function hashId(...parts: string[]): number {
  let hash = 0x811c9dc5;
  for (const char of parts.join('|')) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return 1_000_000 + (hash % 900_000_000);
}

export const now = () => isoDate(new Date());

export const raw = (renderer: ApexRenderer): DatabaseSync => renderer.db.db;

function sqlValue(value: unknown): SQLInputValue {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** `"name n, other d, text"` → column DDL; `n` is NUMBER, `d` is DATE, anything else VARCHAR2. */
function columnsOf(spec: string): { name: string; type: string }[] {
  return spec
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, kind] = part.split(/\s+/u);
      return {
        name: name!.toUpperCase(),
        type: kind === 'n' ? 'NUMBER' : kind === 'd' ? 'DATE' : 'VARCHAR2(4000)',
      };
    });
}

function dropObject(db: DatabaseSync, name: string): void {
  const kind = (
    db.prepare('select type from sqlite_master where upper(name) = upper(?)').get(name) as
      | { type: string }
      | undefined
  )?.type;
  if (kind === 'view') db.exec(`drop view "${name}"`);
  else if (kind === 'table') db.exec(`drop table "${name}"`);
}

/** Replaces a generated dictionary table with fresh rows. */
export function replaceTable(db: DatabaseSync, name: string, spec: string, rows: Row[]): void {
  const columns = columnsOf(spec);
  dropObject(db, name);
  db.exec(`create table "${name}" (${columns.map((column) => `"${column.name}" ${column.type}`).join(', ')})`);
  if (!rows.length) return;
  const insert = db.prepare(
    `insert into "${name}" (${columns.map((column) => `"${column.name}"`).join(', ')}) values (${columns.map(() => '?').join(', ')})`,
  );
  for (const row of rows) {
    const upper = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toUpperCase(), value]));
    insert.run(...columns.map((column) => sqlValue(upper[column.name])));
  }
}

/** Replaces a view (dictionary views over state tables are rebuilt with the metadata). */
export function replaceView(db: DatabaseSync, name: string, select: string): void {
  dropObject(db, name);
  db.exec(`create view "${name}" as ${select}`);
}

/** Creates a persistent state table once; later starts keep its rows. */
export function stateTable(db: DatabaseSync, name: string, spec: string, extra = ''): void {
  const columns = columnsOf(spec);
  db.exec(
    `create table if not exists "${name}" (${columns.map((column) => `"${column.name}" ${column.type}`).join(', ')}${extra ? `, ${extra}` : ''})`,
  );
  const existing = new Set(
    (db.prepare(`pragma table_info("${name}")`).all() as { name: string }[]).map((column) =>
      column.name.toUpperCase(),
    ),
  );
  for (const column of columns)
    if (!existing.has(column.name)) db.exec(`alter table "${name}" add column "${column.name}" ${column.type}`);
}

export function insertRow(db: DatabaseSync, table: string, row: Row): number {
  const keys = Object.keys(row);
  const result = db
    .prepare(
      `insert into "${table}" (${keys.map((key) => `"${key.toUpperCase()}"`).join(', ')}) values (${keys.map(() => '?').join(', ')})`,
    )
    .run(...keys.map((key) => sqlValue(row[key])));
  return Number(result.lastInsertRowid);
}

const lower = (row: Row): Row =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));

/** Rows with lower-case keys (state tables declare upper-case column names). */
export function all(db: DatabaseSync, sql: string, ...params: SQLInputValue[]): Row[] {
  return (db.prepare(sql).all(...params) as Row[]).map(lower);
}

export function one(db: DatabaseSync, sql: string, ...params: SQLInputValue[]): Row | undefined {
  const row = db.prepare(sql).get(...params) as Row | undefined;
  return row ? lower(row) : undefined;
}

// ------------------------------------------------------------------ APEXlang helpers

/** Application-level components: shared-components/ files plus children of application.apx. */
export const sharedOf = (renderer: ApexRenderer, ...types: string[]) =>
  [...renderer.app.shared, ...renderer.app.app.children].filter((component) =>
    types.includes(component.type),
  );

export const refName = (value: ApxValue | undefined): string =>
  isRef(value) ? value.ref : typeof value === 'string' ? value : '';

export const sequenceOf = (component: ApxComponent) =>
  Number(
    get(component.props, 'execution.sequence') ??
      get(component.props, 'layout.sequence') ??
      get(component.props, 'sequence') ??
      get(component.props, 'source.sequence') ??
      0,
  );

export const bySequence = (components: ApxComponent[]) =>
  [...components].sort((a, b) => sequenceOf(a) - sequenceOf(b));

/** Static ID of a shared component: `advanced.staticId`, `staticId`, or its APEXlang identifier. */
export const staticIdOf = (component: ApxComponent) =>
  str(component.props, 'advanced.staticId') || str(component.props, 'staticId') || component.id;

/** Finds a shared component of a type by identifier, static ID or name (case-insensitive). */
export function findShared(renderer: ApexRenderer, type: string, key: string): ApxComponent | undefined {
  const lower = key.toLowerCase();
  return sharedOf(renderer, type).find(
    (component) =>
      component.id.toLowerCase() === lower ||
      staticIdOf(component).toLowerCase() === lower ||
      str(component.props, 'name').toLowerCase() === lower,
  );
}

export const yesNo = (value: boolean) => (value ? 'Yes' : 'No');
