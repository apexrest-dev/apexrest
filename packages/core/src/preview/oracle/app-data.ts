import { bindNames, type AppData, type Binds, type QueryResult, type SqlValue } from '../database.ts';
import type { OracleLink } from './bridge.ts';
import {
  DBMS_OUTPUT_BLOCK,
  HTP_BIND,
  HTP_INIT_BLOCK,
  HTP_READ_BLOCK,
  OUTPUT_BIND,
  OracleError,
  ROWID_BIND,
  ROWS_BIND,
  batch,
  bindName,
  declareBinds,
  dmlBlock,
  jsonRows,
  plsqlSegment,
  querySegment,
  referencedBinds,
  segmentError,
  segments,
  selectBindsSegment,
  sqlText,
} from './protocol.ts';

const TX_BEFORE = 'APEXREST_TX_BEFORE';
const TX_AFTER = 'APEXREST_TX_AFTER';
const DDL = /^\s*(create|alter|drop|truncate|rename|comment|grant|revoke|flashback|purge|analyze)\b/iu;

export interface ApexContext {
  applicationId: number;
  pageId: number;
  user: string;
  /** Installed item names (upper case) that may receive session state. */
  items: Set<string>;
}

/** A preview server's connected-mode state (connect.ts). */
export interface ConnectedOracle {
  data: OracleAppData;
  environment: string;
  /** `DB_UNIQUE_NAME/SERVICE_NAME`, from the identity check. */
  target: string;
  /** Present when the application is installed in the target workspace. */
  apex?: { applicationId: number; items: Set<string>; pages: number[] };
  /** Set after APEX session setup failed once; database code then runs with binds only. */
  apexError?: string;
  warnings: string[];
}

export interface PlsqlCall {
  block: string;
  binds: Record<string, string | number | null>;
  /** Extra outputs computed after the block, e.g. `v('P1_X')` read back from APEX session state. */
  after?: Record<string, string>;
  apex?: ApexContext | undefined;
  htp?: boolean;
}

export interface PlsqlReply {
  error?: OracleError;
  values: Record<string, string | null>;
  output: string;
  htp: string;
}

function text(value: string | number | null | undefined): string | null {
  return value === null || value === undefined ? null : String(value);
}

/**
 * Application data and PL/SQL in a real Oracle session. Every preview request
 * ends with endRequest(), which rolls back; DDL is refused because it commits.
 */
export class OracleAppData implements AppData {
  readonly dialect = 'oracle' as const;
  readonly link: OracleLink;
  readonly schema: string;
  #columns = new Map<string, { name: string; pk: boolean; type: string }[]>();
  #keys = new Map<string, 'default' | 'none'>();
  #dirty = false;

  constructor(link: OracleLink, schema: string) {
    this.link = link;
    this.schema = schema.toUpperCase();
  }

  /** Runs segments; the failing segment's error is returned, transport failures throw. */
  #run(parts: string[], dirty = true): { texts: string[]; errors: (OracleError | undefined)[] } {
    if (dirty) this.#dirty = true;
    const { text: input, markers } = batch(parts);
    const texts = segments(this.link.run(input), markers);
    return { texts, errors: texts.map(segmentError) };
  }

  #binds(sql: string, binds: Binds) {
    return referencedBinds(bindNames(sql), binds);
  }

  query(sql: string, binds: Binds = {}, maxRows = 10_000): QueryResult {
    const values = this.#binds(sql, binds);
    const parts = [declareBinds(values), querySegment(sql, maxRows)];
    const { texts, errors } = this.#run(parts);
    const error = errors[0] ?? errors[1];
    if (error) throw error;
    return jsonRows(texts[1]!);
  }

  rawQuery(sql: string, binds: Binds = {}, maxRows = 10_000) {
    const result = this.query(sql, binds, maxRows);
    return {
      columns: result.columns,
      rows: result.rows.map((row) => result.columns.map((column) => (row[column] ?? null) as SqlValue)),
    };
  }

  scalar(sql: string, binds: Binds = {}): string | number | null {
    const result = this.query(sql, binds, 1);
    const row = result.rows[0];
    return row ? (row[result.columns[0]!] ?? null) : null;
  }

  execute(sql: string, binds: Binds = {}): { changes: number; lastInsertRowid: number | string } {
    if (DDL.test(sql))
      throw new OracleError(-20996, 'DDL is not run in the connected preview because Oracle commits it');
    // SQLite-only savepoint release; Oracle savepoints end with the transaction.
    if (/^\s*release\s+savepoint\b/iu.test(sql)) return { changes: 0, lastInsertRowid: 0 };
    const control = /^\s*(savepoint\s+[\w$#]+|rollback\s+to\s+(?:savepoint\s+)?[\w$#]+)\s*;?\s*$/iu.exec(sql);
    const values = { ...this.#binds(sql, binds), [ROWS_BIND]: null, [ROWID_BIND]: null };
    const block = control ? `begin\n${control[1]};\nend;` : dmlBlock(sql, true);
    const { texts, errors } = this.#run([
      declareBinds(values),
      plsqlSegment(block),
      selectBindsSegment([ROWS_BIND, ROWID_BIND]),
    ]);
    const error = errors[0] ?? errors[1] ?? errors[2];
    if (error) throw error;
    const row = jsonRows(texts[2]!).rows[0] ?? {};
    return { changes: Number(row[ROWS_BIND] ?? 0), lastInsertRowid: text(row[ROWID_BIND]) ?? 0 };
  }

  #owned(table: string): { owner: string; name: string } {
    const parts = table.replaceAll('"', '').toUpperCase().split('.');
    return parts.length > 1 ? { owner: parts[0]!, name: parts[1]! } : { owner: this.schema, name: parts[0]! };
  }

  tableColumns(table: string): { name: string; pk: boolean; type: string }[] {
    const { owner, name } = this.#owned(table);
    const key = `${owner}.${name}`;
    let columns = this.#columns.get(key);
    if (!columns) {
      // USER_ views when the table is in the session schema: ALL_ dictionary joins take seconds on ADB.
      const own = owner === this.schema;
      const dictionary = (view: string) => (own ? `user_${view}` : `all_${view}`);
      const ownedBy = (alias: string) => (own ? '' : ` and ${alias}.owner = :APEXREST_OWNER`);
      const result = this.query(
        `select c.column_name, c.data_type, nvl2(p.column_name, 'Y', 'N') is_pk
           from ${dictionary('tab_columns')} c
           left join (select kc.column_name
                        from ${dictionary('constraints')} k
                        join ${dictionary('cons_columns')} kc on kc.constraint_name = k.constraint_name${own ? '' : ' and kc.owner = k.owner'}
                       where k.table_name = :APEXREST_TABLE and k.constraint_type = 'P'${ownedBy('k')}) p
             on p.column_name = c.column_name
          where c.table_name = :APEXREST_TABLE${ownedBy('c')}
          order by c.column_id`,
        { APEXREST_OWNER: owner, APEXREST_TABLE: name },
      );
      columns = result.rows.map((row) => ({
        name: String(row.COLUMN_NAME),
        pk: row.IS_PK === 'Y',
        type: String(row.DATA_TYPE),
      }));
      this.#columns.set(key, columns);
    }
    return columns;
  }

  tableExists(table: string): boolean {
    return this.tableColumns(table).length > 0;
  }

  /** Oracle fills a key from an identity column, a default or an insert trigger; never max + 1. */
  keySource(table: string, column: string): 'default' | 'none' {
    const { owner, name } = this.#owned(table);
    const key = `${owner}.${name}.${column.toUpperCase()}`;
    let source = this.#keys.get(key);
    if (!source) {
      const own = owner === this.schema;
      const found = this.scalar(
        `select count(*) from ${own ? 'user_tab_columns' : 'all_tab_columns'}
          where table_name = :APEXREST_TABLE and column_name = :APEXREST_COLUMN${own ? '' : ' and owner = :APEXREST_OWNER'}
            and (identity_column = 'YES' or default_length > 0)
         union all
         select count(*) from ${own ? 'user_triggers' : 'all_triggers'}
          where table_name = :APEXREST_TABLE${own ? '' : ' and table_owner = :APEXREST_OWNER'}
            and triggering_event like '%INSERT%' and status = 'ENABLED'
         order by 1 desc`,
        { APEXREST_OWNER: owner, APEXREST_TABLE: name, APEXREST_COLUMN: column.toUpperCase() },
      );
      source = Number(found) > 0 ? 'default' : 'none';
      this.#keys.set(key, source);
    }
    return source;
  }

  /** One PL/SQL unit with IN OUT binds, optional APEX session context and HTP capture. */
  plsql(call: PlsqlCall): PlsqlReply {
    const after = call.after ?? {};
    const declared = {
      ...Object.fromEntries(Object.keys(after).map((name) => [name, null])),
      ...call.binds,
      [OUTPUT_BIND]: null,
      ...(call.htp ? { [HTP_BIND]: null } : {}),
    };
    const parts = [declareBinds({ ...declared, [TX_BEFORE]: null, [TX_AFTER]: null })];
    if (call.apex) parts.push(plsqlSegment(apexContextBlock(call.apex, call.binds)));
    if (call.htp) parts.push(plsqlSegment(HTP_INIT_BLOCK));
    // Tripwire: Oracle blocks COMMIT only in stored code, so a unit that ends the transaction is detected here.
    parts.push(plsqlSegment(`begin\n  :${TX_BEFORE} := dbms_transaction.local_transaction_id(true);\nend;`));
    const unit = parts.push(plsqlSegment(call.block)) - 1;
    parts.push(plsqlSegment(`begin\n  :${TX_AFTER} := dbms_transaction.local_transaction_id;\nend;`));
    if (Object.keys(after).length)
      parts.push(
        plsqlSegment(
          `begin\n${Object.entries(after)
            .map(([name, expression]) => `  :${bindName(name)} := ${expression};`)
            .join('\n')}\nend;`,
        ),
      );
    parts.push(plsqlSegment(DBMS_OUTPUT_BLOCK));
    if (call.htp) parts.push(plsqlSegment(HTP_READ_BLOCK));
    const names = [...Object.keys(declared), TX_BEFORE, TX_AFTER].map(bindName);
    parts.push(selectBindsSegment(names));
    const { texts, errors } = this.#run(parts);
    const setup = errors.slice(0, unit).find(Boolean);
    if (setup) throw setup;
    const read = errors.at(-1);
    if (read) throw read;
    const row = jsonRows(texts.at(-1)!).rows[0] ?? {};
    const values = Object.fromEntries(names.map((name) => [name, text(row[name])]));
    const ended = values[TX_BEFORE] !== values[TX_AFTER];
    delete values[TX_BEFORE];
    delete values[TX_AFTER];
    const error = ended
      ? new OracleError(
          -20997,
          'The code ended the Oracle transaction (COMMIT, ROLLBACK or DDL); work done before that point may be committed',
        )
      : errors[unit];
    return {
      ...(error ? { error } : {}),
      values,
      output: values[OUTPUT_BIND] ?? '',
      // owa.get_page starts with the CGI header block; dynamic content needs only the body.
      htp: (values[HTP_BIND] ?? '').replace(/^(?:[\w-]+:[^\n]*\n)+\n/u, ''),
    };
  }

  /** Ends the preview request: everything it changed in Oracle is rolled back. */
  endRequest(): void {
    if (!this.#dirty) return;
    this.#dirty = false;
    const { errors } = this.#run(['rollback;'], false);
    if (errors[0]) throw errors[0];
  }

  close(): void {
    try {
      this.endRequest();
    } finally {
      this.link.close();
    }
  }
}

/** Creates an APEX session for the installed application and copies item values into it. */
export function apexContextBlock(apex: ApexContext, binds: Record<string, string | number | null>): string {
  const items = Object.entries(binds)
    .filter(([name]) => apex.items.has(name.toUpperCase()))
    .map(([name]) => `  apex_util.set_session_state(${sqlText(name.toUpperCase())}, :${bindName(name)});`);
  return `begin
  apex_session.create_session(p_app_id => ${apex.applicationId}, p_page_id => ${apex.pageId}, p_username => ${sqlText(apex.user)});
${items.join('\n')}
end;`;
}
