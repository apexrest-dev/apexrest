// APE-386/390 qualification probe: what a reused connected SQLcl session carries from one
// operation to the next, what a reset clears, and how errors stop a session. Explicitly invoked
// on an authorized DEV/QA/TEST schema; it creates and drops its own APEXREST_PROBE_* objects.
// Usage: node scripts/bench/session-reuse.mjs --connection NAME --schema OWNER [--out FILE]
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const name = args.get('connection');
if (!name) throw new Error('--connection is required');
const owner = String(args.get('schema') ?? '').toUpperCase();
if (!/^[A-Z][A-Z0-9_$#]*$/.test(owner)) throw new Error('--schema OWNER is required');
const sql = (body) => {
  const run = spawnSync('sql', ['-S', '/nolog'], {
    input: `conn -name ${name}\nset feedback off heading off pagesize 0\n${body}\nexit\n`,
    encoding: 'utf8',
  });
  return { code: run.status, out: run.stdout.replace(/\u001b\[[0-9;]*m/g, '') };
};
const value = (out, tag) => (new RegExp(`${tag}=(\\S*)`).exec(out) ?? [])[1];
const RESET = `rollback;\nexec dbms_session.modify_package_state(dbms_session.reinitialize)\nbegin execute immediate 'alter session set current_schema = ' || sys_context('USERENV','SESSION_USER'); end;\n/`;

sql(
  `begin execute immediate 'drop table apexrest_probe_t'; exception when others then null; end;\n/\ncreate table apexrest_probe_t (n number);\ncreate or replace package apexrest_probe_p as g number := 0; end;\n/`,
);
const results = {};
// One SQLcl process stands for a reused session: operation A, optional reset, operation B.
for (const reset of [false, true]) {
  const out = sql(
    `insert into apexrest_probe_t values (1);\nexec apexrest_probe_p.g := 42\nalter session set current_schema = SYS;\n${reset ? RESET : ''}\nselect 'ROWS='||count(*) from ${owner}.apexrest_probe_t;\nset serveroutput on\nbegin dbms_output.put_line('PKG2='||${owner}.apexrest_probe_p.g); end;\n/\nselect 'SCHEMA='||sys_context('USERENV','CURRENT_SCHEMA') from dual;\nrollback;`,
  ).out;
  results[reset ? 'withReset' : 'withoutReset'] = {
    uncommittedRowsSeenByNextOperation: Number(value(out, 'ROWS') ?? -1),
    packageGlobalSeenByNextOperation: Number(value(out, 'PKG2') ?? -1),
    currentSchemaOfNextOperation: value(out, 'SCHEMA'),
  };
}
// Error stop: a failing statement under WHENEVER SQLERROR EXIT ends the session before the marker.
const failed = sql(
  `whenever sqlerror exit failure rollback\ninsert into apexrest_probe_t values (7);\nselect 1/0 from dual;\nprompt APEXREST_MARKER\ninsert into apexrest_probe_t values (8);`,
);
const afterFail = sql(`select 'ROWS='||count(*) from apexrest_probe_t;`).out;
results.errorStop = {
  exitCode: failed.code,
  markerPrinted: failed.out.includes('APEXREST_MARKER'),
  rowsLeftByFailedSession: Number(value(afterFail, 'ROWS') ?? -1),
};
// Exit semantics of today's one-process-per-script model: pending DML at exit.
sql(`insert into apexrest_probe_t values (9);`);
const afterExit = sql(`select 'ROWS='||count(*) from apexrest_probe_t;`).out;
results.exitCommitsPendingDml = Number(value(afterExit, 'ROWS') ?? -1) === 1;
const version = sql(`select 'DB='||version_full from product_component_version where rownum = 1;`).out;
results.database = value(version, 'DB');
results.sqlcl = spawnSync('sql', ['-V'], { encoding: 'utf8' }).stdout.trim();
sql(`drop table apexrest_probe_t purge;\ndrop package apexrest_probe_p;`);
console.log(JSON.stringify(results, null, 2));
if (args.get('out'))
  writeFileSync(
    args.get('out'),
    JSON.stringify({ at: new Date().toISOString(), connection: name, ...results }, null, 2) + '\n',
  );
