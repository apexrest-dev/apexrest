import { createHash } from 'node:crypto';
import type { Runtime, Stub, StubArgs } from '../server/apex-api.ts';
import { PlsqlException } from '../server/plsql.ts';
import { ensureDictionary } from './dictionary.ts';
import { all, now, one, raw } from './store.ts';

/**
 * `apex_collection` backed by SQLite: members live in `apex_local_collection_members`, keyed by
 * the preview session, and the `APEX_COLLECTIONS` view shows the current session's members.
 */

const pad = (index: number) => String(index).padStart(3, '0');
const C = Array.from({ length: 50 }, (_, index) => `c${pad(index + 1)}`);
const N = Array.from({ length: 5 }, (_, index) => `n${pad(index + 1)}`);
const D = Array.from({ length: 5 }, (_, index) => `d${pad(index + 1)}`);
const LOBS = ['clob001', 'blob001', 'xmltype001'];
const ATTRIBUTES = [...C, ...N, ...D, ...LOBS];

function raise(code: number, message: string): never {
  throw new PlsqlException(`ora${code}`, code, message, 'app', `ORA${code}: ${message}`);
}

interface Scope {
  rt: Runtime;
  session: string;
}

function scope(rt: Runtime | undefined): Scope | undefined {
  if (!rt) return undefined;
  ensureDictionary(rt.renderer);
  return { rt, session: rt.ctx.session.id };
}

const db = (scope: Scope) => raw(scope.rt.renderer);
const nameOf = (args: StubArgs) => String(args.p_collection_name ?? '').toUpperCase();

const exists = (scope: Scope, name: string) =>
  one(
    db(scope),
    'select 1 as x from apex_local_collections where session_id = ? and collection_name = ?',
    scope.session,
    name,
  ) !== undefined;

function requireCollection(scope: Scope, name: string): void {
  if (!exists(scope, name)) raise(-20101, `Collection ${name} does not exist`);
}

function changed(scope: Scope, name: string): void {
  db(scope)
    .prepare("update apex_local_collections set collection_changed = 'Y' where session_id = ? and collection_name = ?")
    .run(scope.session, name);
}

function create(scope: Scope, name: string, truncate: boolean): void {
  if (!name) raise(-20104, 'Collection name cannot be null');
  if (exists(scope, name)) {
    if (!truncate) raise(-20101, `Collection ${name} already exists`);
    db(scope)
      .prepare('delete from apex_local_collection_members where session_id = ? and collection_name = ?')
      .run(scope.session, name);
    changed(scope, name);
    return;
  }
  db(scope)
    .prepare(
      "insert into apex_local_collections (session_id, collection_name, collection_changed, created_on) values (?, ?, 'N', ?)",
    )
    .run(scope.session, name, now());
}

function remove(scope: Scope, name: string): void {
  for (const table of ['apex_local_collection_members', 'apex_local_collections'])
    db(scope).prepare(`delete from ${table} where session_id = ? and collection_name = ?`).run(scope.session, name);
}

const text = (value: unknown) =>
  value === null || value === undefined || value === '' ? null : typeof value === 'number' ? value : String(value);

const md5 = (values: unknown[]) =>
  createHash('md5')
    .update(values.map((value) => (value === null || value === undefined ? '' : String(value))).join('|'))
    .digest('hex');

/** Attribute values from `p_c001`, `p_n001`, ... arguments. */
function attributes(args: StubArgs): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const attribute of ATTRIBUTES) {
    const value = args[`p_${attribute}`];
    if (value !== undefined) values[attribute] = text(value);
  }
  return values;
}

function nextSeq(scope: Scope, name: string): number {
  const row = one(
    db(scope),
    'select coalesce(max(seq_id), 0) + 1 as seq from apex_local_collection_members where session_id = ? and collection_name = ?',
    scope.session,
    name,
  );
  return Number(row?.seq ?? 1);
}

function addMember(scope: Scope, name: string, values: Record<string, unknown>, generateMd5: boolean): number {
  requireCollection(scope, name);
  const seq = nextSeq(scope, name);
  const columns = Object.keys(values);
  const md5Value = generateMd5 ? md5(C.map((column) => values[column])) : null;
  db(scope)
    .prepare(
      `insert into apex_local_collection_members (session_id, collection_name, seq_id, md5_original${columns.map((column) => `, ${column}`).join('')}) values (?, ?, ?, ?${columns.map(() => ', ?').join('')})`,
    )
    .run(
      scope.session,
      name,
      seq,
      md5Value,
      ...columns.map((column) => values[column] as string | number | null),
    );
  changed(scope, name);
  return seq;
}

function requireMember(scope: Scope, name: string, seq: number): void {
  requireCollection(scope, name);
  const found = one(
    db(scope),
    'select 1 as x from apex_local_collection_members where session_id = ? and collection_name = ? and seq_id = ?',
    scope.session,
    name,
    seq,
  );
  if (!found) raise(-20102, `Member ${seq} does not exist in collection ${name}`);
}

/** Loads a query's rows: positional columns map to c001.. (or n/d first for `_queryb2`). */
function fromQuery(rt: Runtime, args: StubArgs, numericFirst: boolean): number {
  const target = scope(rt)!;
  const name = nameOf(args);
  const sql = String(args.p_query ?? '');
  const binds = rt.renderer.binds(rt.ctx.session, rt.ctx.page);
  const names = Array.isArray(args.p_names) ? args.p_names.map((entry) => String(entry).toUpperCase()) : [];
  const values = Array.isArray(args.p_values) ? args.p_values : [];
  names.forEach((bind, index) => {
    binds[bind] = values[index] === undefined || values[index] === null ? null : String(values[index]);
  });
  const max = Number(args.p_max_row_count ?? 0) || 1_000_000;
  const result = rt.renderer.db.query(sql, binds, max);
  create(target, name, Boolean(args._truncate));
  for (const row of result.rows) {
    const mapped: Record<string, unknown> = {};
    const cells = result.columns.map((column) => row[column]);
    if (numericFirst) {
      cells.slice(0, 5).forEach((cell, index) => (mapped[N[index]!] = cell ?? null));
      cells.slice(5, 10).forEach((cell, index) => (mapped[D[index]!] = cell ?? null));
      cells.slice(10).forEach((cell, index) => (mapped[C[index]!] = text(cell)));
    } else cells.slice(0, 50).forEach((cell, index) => (mapped[C[index]!] = text(cell)));
    addMember(target, name, mapped, /^y/iu.test(String(args.p_generate_md5 ?? 'NO')));
  }
  return result.rows.length;
}

const ATTRIBUTE_PARAMS = ATTRIBUTES.map((attribute) => `p_${attribute}`);

const withScope =
  (fn: (scope: Scope, args: StubArgs) => unknown) =>
  (args: StubArgs, rt: Runtime | undefined): unknown => {
    const current = scope(rt);
    if (!current) return null;
    return fn(current, args);
  };

const fromQueryStub = (numericFirst: boolean, truncate: boolean): Stub => ({
  params: ['p_collection_name', 'p_query', 'p_generate_md5'],
  fn: (args, rt) => {
    if (!rt) return null;
    fromQuery(rt, { ...args, _truncate: truncate }, numericFirst);
    return null;
  },
});

const fromQueryBStub = (numericFirst: boolean, truncate: boolean): Stub => ({
  params: ['p_collection_name', 'p_query', 'p_names', 'p_values', 'p_max_row_count'],
  fn: (args, rt) => {
    if (!rt) return null;
    fromQuery(rt, { ...args, _truncate: truncate }, numericFirst);
    return null;
  },
});

export const COLLECTION_STUBS: Record<string, Stub> = {
  'apex_collection.create_collection': {
    params: ['p_collection_name', 'p_truncate_if_exists'],
    fn: withScope((current, args) => {
      create(current, nameOf(args), /^y/iu.test(String(args.p_truncate_if_exists ?? 'NO')));
      return null;
    }),
  },
  'apex_collection.create_or_truncate_collection': {
    params: ['p_collection_name'],
    fn: withScope((current, args) => {
      create(current, nameOf(args), true);
      return null;
    }),
  },
  'apex_collection.truncate_collection': {
    params: ['p_collection_name'],
    fn: withScope((current, args) => {
      requireCollection(current, nameOf(args));
      create(current, nameOf(args), true);
      return null;
    }),
  },
  'apex_collection.delete_collection': {
    params: ['p_collection_name'],
    fn: withScope((current, args) => {
      requireCollection(current, nameOf(args));
      remove(current, nameOf(args));
      return null;
    }),
  },
  'apex_collection.delete_all_collections': {
    params: [],
    fn: withScope((current) => {
      for (const table of ['apex_local_collection_members', 'apex_local_collections'])
        db(current).prepare(`delete from ${table} where session_id = ?`).run(current.session);
      return null;
    }),
  },
  'apex_collection.collection_exists': {
    params: ['p_collection_name'],
    fn: withScope((current, args) => exists(current, nameOf(args))),
  },
  'apex_collection.collection_member_count': {
    params: ['p_collection_name'],
    fn: withScope((current, args) => {
      const row = one(
        db(current),
        'select count(*) as n from apex_local_collection_members where session_id = ? and collection_name = ?',
        current.session,
        nameOf(args),
      );
      return Number(row?.n ?? 0);
    }),
  },
  'apex_collection.add_member': {
    params: ['p_collection_name', ...ATTRIBUTE_PARAMS, 'p_generate_md5'],
    fn: withScope((current, args) =>
      addMember(current, nameOf(args), attributes(args), /^y/iu.test(String(args.p_generate_md5 ?? 'NO'))),
    ),
  },
  'apex_collection.add_members': {
    params: ['p_collection_name', ...ATTRIBUTE_PARAMS, 'p_generate_md5'],
    fn: withScope((current, args) => {
      const lists: [string, unknown[]][] = ATTRIBUTES.filter((attribute) =>
        Array.isArray(args[`p_${attribute}`]),
      ).map((attribute) => [attribute, args[`p_${attribute}`] as unknown[]]);
      const count = Math.max(0, ...lists.map(([, values]) => values.length));
      for (let index = 0; index < count; index += 1)
        addMember(
          current,
          nameOf(args),
          Object.fromEntries(lists.map(([attribute, values]) => [attribute, text(values[index])])),
          /^y/iu.test(String(args.p_generate_md5 ?? 'NO')),
        );
      return null;
    }),
  },
  'apex_collection.update_member': {
    params: ['p_collection_name', 'p_seq', ...ATTRIBUTE_PARAMS],
    fn: withScope((current, args) => {
      const name = nameOf(args);
      const seq = Number(args.p_seq);
      requireMember(current, name, seq);
      const values = attributes(args);
      db(current)
        .prepare(
          `update apex_local_collection_members set ${ATTRIBUTES.map((attribute) => `${attribute} = ?`).join(', ')} where session_id = ? and collection_name = ? and seq_id = ?`,
        )
        .run(
          ...ATTRIBUTES.map((attribute) => (values[attribute] ?? null) as string | number | null),
          current.session,
          name,
          seq,
        );
      changed(current, name);
      return null;
    }),
  },
  'apex_collection.update_member_attribute': {
    params: [
      'p_collection_name',
      'p_seq',
      'p_attr_number',
      'p_attr_value',
      'p_number_value',
      'p_date_value',
      'p_clob_value',
      'p_blob_value',
      'p_xmltype_value',
    ],
    fn: withScope((current, args) => {
      const name = nameOf(args);
      const seq = Number(args.p_seq);
      requireMember(current, name, seq);
      const position = Number(args.p_attr_number ?? 0);
      let column: string | undefined;
      let value: unknown;
      if (args.p_number_value !== undefined) [column, value] = [N[position - 1], args.p_number_value];
      else if (args.p_date_value !== undefined) [column, value] = [D[position - 1], args.p_date_value];
      else if (args.p_clob_value !== undefined) [column, value] = ['clob001', args.p_clob_value];
      else if (args.p_blob_value !== undefined) [column, value] = ['blob001', args.p_blob_value];
      else if (args.p_xmltype_value !== undefined) [column, value] = ['xmltype001', args.p_xmltype_value];
      else [column, value] = [C[position - 1], args.p_attr_value];
      if (!column) raise(-20103, `Invalid attribute number ${position}`);
      db(current)
        .prepare(
          `update apex_local_collection_members set ${column} = ? where session_id = ? and collection_name = ? and seq_id = ?`,
        )
        .run(text(value) as string | number | null, current.session, name, seq);
      changed(current, name);
      return null;
    }),
  },
  'apex_collection.delete_member': {
    params: ['p_collection_name', 'p_seq'],
    fn: withScope((current, args) => {
      const name = nameOf(args);
      requireMember(current, name, Number(args.p_seq));
      db(current)
        .prepare('delete from apex_local_collection_members where session_id = ? and collection_name = ? and seq_id = ?')
        .run(current.session, name, Number(args.p_seq));
      changed(current, name);
      return null;
    }),
  },
  'apex_collection.delete_members': {
    params: ['p_collection_name', 'p_attr_number', 'p_attr_value'],
    fn: withScope((current, args) => {
      const name = nameOf(args);
      requireCollection(current, name);
      const column = C[Number(args.p_attr_number ?? 1) - 1];
      if (!column) raise(-20103, `Invalid attribute number ${String(args.p_attr_number)}`);
      const value = text(args.p_attr_value);
      db(current)
        .prepare(
          `delete from apex_local_collection_members where session_id = ? and collection_name = ? and ${value === null ? `${column} is null` : `${column} = ?`}`,
        )
        .run(current.session, name, ...(value === null ? [] : [value]));
      changed(current, name);
      return null;
    }),
  },
  'apex_collection.resequence_collection': {
    params: ['p_collection_name'],
    fn: withScope((current, args) => {
      const name = nameOf(args);
      requireCollection(current, name);
      const rows = all(
        db(current),
        'select rowid as r from apex_local_collection_members where session_id = ? and collection_name = ? order by seq_id',
        current.session,
        name,
      );
      rows.forEach((row, index) =>
        db(current)
          .prepare('update apex_local_collection_members set seq_id = ? where rowid = ?')
          .run(index + 1, row.r as number),
      );
      return null;
    }),
  },
  'apex_collection.move_member_up': {
    params: ['p_collection_name', 'p_seq'],
    fn: withScope((current, args) => swap(current, nameOf(args), Number(args.p_seq), -1)),
  },
  'apex_collection.move_member_down': {
    params: ['p_collection_name', 'p_seq'],
    fn: withScope((current, args) => swap(current, nameOf(args), Number(args.p_seq), 1)),
  },
  'apex_collection.sort_members': {
    params: ['p_collection_name', 'p_sort_on_column_number'],
    fn: withScope((current, args) => {
      const name = nameOf(args);
      requireCollection(current, name);
      const column = C[Number(args.p_sort_on_column_number ?? 1) - 1] ?? 'c001';
      const rows = all(
        db(current),
        `select rowid as r from apex_local_collection_members where session_id = ? and collection_name = ? order by ${column}`,
        current.session,
        name,
      );
      rows.forEach((row, index) =>
        db(current)
          .prepare('update apex_local_collection_members set seq_id = ? where rowid = ?')
          .run(index + 1, row.r as number),
      );
      return null;
    }),
  },
  'apex_collection.collection_has_changed': {
    params: ['p_collection_name'],
    fn: withScope((current, args) => {
      const row = one(
        db(current),
        'select collection_changed as c from apex_local_collections where session_id = ? and collection_name = ?',
        current.session,
        nameOf(args),
      );
      return row?.c === 'Y';
    }),
  },
  'apex_collection.reset_collection_changed': {
    params: ['p_collection_name'],
    fn: withScope((current, args) => {
      db(current)
        .prepare("update apex_local_collections set collection_changed = 'N' where session_id = ? and collection_name = ?")
        .run(current.session, nameOf(args));
      return null;
    }),
  },
  'apex_collection.reset_collection_changed_all': {
    params: [],
    fn: withScope((current) => {
      db(current).prepare("update apex_local_collections set collection_changed = 'N' where session_id = ?").run(current.session);
      return null;
    }),
  },
  'apex_collection.get_member_md5': {
    params: ['p_collection_name', 'p_seq'],
    fn: withScope((current, args) => {
      const row = one(
        db(current),
        `select ${C.join(', ')} from apex_local_collection_members where session_id = ? and collection_name = ? and seq_id = ?`,
        current.session,
        nameOf(args),
        Number(args.p_seq),
      );
      return row ? md5(C.map((column) => row[column])) : null;
    }),
  },
  'apex_collection.create_collection_from_query': fromQueryStub(false, false),
  'apex_collection.create_collection_from_query2': fromQueryStub(true, false),
  'apex_collection.create_collection_from_query_b': fromQueryBStub(false, false),
  'apex_collection.create_collection_from_queryb2': fromQueryBStub(true, false),
  'apex_collection.create_coll_from_query_b': fromQueryBStub(false, false),
};

function swap(current: Scope, name: string, seq: number, direction: number): null {
  requireMember(current, name, seq);
  const neighbour = one(
    db(current),
    `select seq_id from apex_local_collection_members where session_id = ? and collection_name = ? and seq_id ${direction < 0 ? '<' : '>'} ? order by seq_id ${direction < 0 ? 'desc' : 'asc'} limit 1`,
    current.session,
    name,
    seq,
  );
  if (!neighbour) return null;
  const other = Number(neighbour.seq_id);
  const update = db(current).prepare(
    'update apex_local_collection_members set seq_id = ? where session_id = ? and collection_name = ? and seq_id = ?',
  );
  update.run(-1, current.session, name, seq);
  update.run(seq, current.session, name, other);
  update.run(other, current.session, name, -1);
  return null;
}
