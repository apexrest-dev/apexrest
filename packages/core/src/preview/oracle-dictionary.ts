import type { DatabaseSync } from 'node:sqlite';
import { registerDatabaseSetup } from './database.ts';

/**
 * Oracle data dictionary views over the local SQLite schema, for application code that inspects
 * its own objects: USER_TABLES, USER_TAB_COLUMNS, USER_VIEWS, USER_OBJECTS/ALL_OBJECTS,
 * USER_SOURCE (the PL/SQL units the install scripts created, line by line), USER_SEQUENCES and
 * the privilege views. The local schema is called APEX_LOCAL; preview bookkeeping tables are
 * not listed. They are views, so they always show the current schema.
 */

const OWNER = "'APEX_LOCAL'";
const MINE =
  "name not like 'sqlite\\_%' escape '\\' and name not like 'apex\\_local\\_%' escape '\\' and name not like 'apex\\_%' escape '\\' and upper(name) not in (" +
  [
    'TABLES',
    'VIEWS',
    'TAB_COLUMNS',
    'INDEXES',
    'TRIGGERS',
    'SEQUENCES',
    'OBJECTS',
    'SOURCE',
    'SYS_PRIVS',
    'ROLE_PRIVS',
  ]
    .flatMap((suffix) => ['USER', 'ALL', 'DBA'].map((prefix) => `'${prefix}_${suffix}'`))
    .concat([
      "'SESSION_PRIVS'",
      "'SESSION_ROLES'",
      "'ALL_USERS'",
      "'DUAL'",
      "'V$TIMEZONE_NAMES'",
      "'V$VERSION'",
      "'V$INSTANCE'",
      "'V$DATABASE'",
    ])
    .join(', ') +
  ')';

const VIEWS: Record<string, string> = {
  USER_TABLES: `select upper(name) as table_name, 'USERS' as tablespace_name, null as num_rows, 'VALID' as status from sqlite_master where type = 'table' and ${MINE}`,
  USER_VIEWS: `select upper(name) as view_name, length(sql) as text_length, sql as text from sqlite_master where type = 'view' and ${MINE}`,
  USER_TAB_COLUMNS: `select upper(m.name) as table_name, upper(p.name) as column_name, coalesce(nullif(upper(p.type), ''), 'VARCHAR2') as data_type, case p."notnull" when 1 then 'N' else 'Y' end as nullable, p.cid + 1 as column_id, p.dflt_value as data_default from sqlite_master m join pragma_table_info(m.name) p where m.type in ('table', 'view') and ${MINE.replaceAll('name not like', 'm.name not like').replace('upper(name)', 'upper(m.name)')}`,
  USER_INDEXES: `select upper(name) as index_name, upper(tbl_name) as table_name, 'NORMAL' as index_type, 'VALID' as status from sqlite_master where type = 'index' and ${MINE}`,
  USER_TRIGGERS: `select upper(name) as trigger_name, upper(tbl_name) as table_name, 'ENABLED' as status from sqlite_master where type = 'trigger' and name like 'apex\\_local\\_%' escape '\\'`,
  USER_SEQUENCES: `select upper(name) as sequence_name, value as last_number, increment as increment_by, 1 as min_value from apex_local_sequences`,
  USER_OBJECTS: `select upper(name) as object_name, upper(type) as object_type, 'VALID' as status, datetime('now','localtime') as created, datetime('now','localtime') as last_ddl_time from sqlite_master where type in ('table', 'view', 'index') and ${MINE}
    union all select upper(name), 'SEQUENCE', 'VALID', datetime('now','localtime'), datetime('now','localtime') from apex_local_sequences
    union all select upper(name), upper(kind), 'VALID', datetime('now','localtime'), datetime('now','localtime') from apex_local_plsql_units where kind <> 'block'`,
  USER_SOURCE: `with recursive lines(name, type, line, text, rest) as (
      select upper(name), upper(kind), 1, substr(source, 1, instr(source || char(10), char(10)) - 1), substr(source, instr(source || char(10), char(10)) + 1)
        from apex_local_plsql_units where kind <> 'block'
      union all
      select name, type, line + 1, substr(rest, 1, instr(rest || char(10), char(10)) - 1), substr(rest, instr(rest || char(10), char(10)) + 1)
        from lines where rest <> '')
    select name, type, line, text || char(10) as text from lines`,
  SESSION_PRIVS: `select column1 as privilege from (values ('CREATE SESSION'), ('CREATE TABLE'), ('CREATE VIEW'), ('CREATE SEQUENCE'), ('CREATE PROCEDURE'), ('CREATE TRIGGER'), ('CREATE TYPE'), ('CREATE JOB'), ('CREATE SYNONYM'))`,
  USER_SYS_PRIVS: `select ${OWNER} as username, privilege, 'NO' as admin_option from session_privs`,
  USER_ROLE_PRIVS: `select ${OWNER} as username, column1 as granted_role, 'NO' as admin_option, 'YES' as default_role from (values ('CONNECT'), ('RESOURCE'))`,
  SESSION_ROLES: `select column1 as role from (values ('CONNECT'), ('RESOURCE'))`,
  ALL_USERS: `select ${OWNER} as username, 1 as user_id, datetime('now','localtime') as created`,
  V$TIMEZONE_NAMES: `select column1 as tzname, column1 as tzabbrev, 0 as con_id from (values ${zones()})`,
  V$VERSION: `select 'Oracle AI Database 23ai (local APEXREST preview)' as banner, 'Oracle AI Database 23ai' as banner_full`,
  V$INSTANCE: `select 'apexlocal' as instance_name, 'localhost' as host_name, '23.0.0.0.0' as version, 'OPEN' as status`,
  V$DATABASE: `select 'APEXLOCAL' as name, 'APEXLOCAL' as db_unique_name, 'READ WRITE' as open_mode`,
};

/** `ALL_`/`DBA_` variants add the owner. */
const OWNED = ['TABLES', 'VIEWS', 'TAB_COLUMNS', 'INDEXES', 'TRIGGERS', 'SEQUENCES', 'OBJECTS', 'SOURCE'];

function zones(): string {
  const list = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC'];
  return (list.includes('UTC') ? list : ['UTC', ...list])
    .map((zone) => `('${zone.replaceAll("'", "''")}')`)
    .join(', ');
}

export function createOracleDictionary(db: DatabaseSync): void {
  // DUAL exists so `from dual` also works where the SQL translation does not remove it.
  db.exec('create table if not exists dual (dummy varchar2(1))');
  if (!db.prepare('select 1 from dual').get()) db.exec("insert into dual values ('X')");
  db.exec(
    'create table if not exists apex_local_plsql_units (seq integer primary key, kind text, name text, source text, script text)',
  );
  db.exec(
    'create table if not exists apex_local_sequences (name text primary key, value integer, increment integer, start integer)',
  );
  const create = (name: string, sql: string) => {
    try {
      db.exec(`drop view if exists ${name}`);
      db.exec(`create view ${name} as ${sql}`);
    } catch {
      // A view the schema already defines as a table keeps the table.
    }
  };
  for (const [name, sql] of Object.entries(VIEWS)) create(name.includes('$') ? `"${name}"` : name, sql);
  for (const suffix of OWNED)
    for (const prefix of ['ALL', 'DBA'])
      create(`${prefix}_${suffix}`, `select ${OWNER} as owner, v.* from USER_${suffix} v`);
}

registerDatabaseSetup((db) => createOracleDictionary(db.db));
