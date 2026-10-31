import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalDatabase, translateOracleSql } from '../../packages/core/src/preview/database.ts';
import type { Session } from '../../packages/core/src/preview/render.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { runPlsql } from '../../packages/core/src/preview/extensions/server/plsql.ts';
import { workspace } from '../fixtures/preview.ts';

const SCHEMA = `create table tasks (
  task_id integer primary key,
  title varchar2(200) not null,
  status varchar2(20)
);
insert into tasks (title, status) values ('Design review', 'DONE');
insert into tasks (title) values ('Ship it');
create sequence task_seq start with 100;
`;

async function preview(t: import('node:test').TestContext, files: Record<string, string> = {}) {
  const { app, assets } = await workspace(t, { '.apex-local/01-schema.sql': SCHEMA, ...files });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  return server;
}

function runner(server: PreviewServer) {
  const renderer = server.renderer;
  const session: Session = { id: '1', user: 'SCOTT', items: {}, pagination: {} };
  const ctx = renderer.prepareSubmit(session, '1', 'SAVE');
  const exec = (
    code: string,
    mode: 'block' | 'functionBody' | 'plsqlExpression' | 'sqlExpression' = 'block',
  ) => runPlsql(renderer, ctx, code, mode, { label: 'test' });
  return { renderer, session, ctx, exec };
}

test('PL/SQL interpreter runs blocks, control flow, SQL and exceptions', async (t) => {
  const server = await preview(t);
  const { session, exec, renderer } = runner(server);

  let result = exec(`
declare
  l_total number := 0;
  l_text  varchar2(100);
  c_max   constant pls_integer := 4;
begin
  for i in 1 .. c_max loop
    continue when i = 2;
    l_total := l_total + i;
  end loop;
  while l_total < 20 loop
    l_total := l_total * 2;
    exit when l_total > 15;
  end loop;
  if l_total > 100 then
    l_text := 'big';
  elsif l_total between 10 and 100 then
    l_text := 'medium';
  else
    l_text := 'small';
  end if;
  case l_text
    when 'medium' then :P1_SIZE := initcap(l_text) || ' (' || l_total || ')';
    else :P1_SIZE := 'other';
  end case;
  :P1_RATIO := 7 / 2;
  :P1_NULLCAT := 'a' || null || 'b';
end;`);
  assert.equal(result.ok, true, result.failure?.message);
  assert.equal(session.items.P1_SIZE, 'Medium (16)');
  assert.equal(session.items.P1_RATIO, '3.5');
  assert.equal(session.items.P1_NULLCAT, 'ab');

  result = exec(`
declare
  l_title tasks.title%type;
  l_count number;
  l_id    number;
begin
  select count(*) into l_count from tasks;
  :P1_COUNT := l_count;
  insert into tasks (task_id, title) values (task_seq.nextval, 'From PL/SQL') returning task_id into l_id;
  :P1_NEW_ID := l_id;
  update tasks set status = 'OPEN' where status is null;
  :P1_UPDATED := sql%rowcount;
  for r in (select title from tasks order by task_id) loop
    l_title := case when l_title is null then r.title else l_title || ', ' || r.title end;
  end loop;
  :P1_TITLES := l_title;
  begin
    select title into l_title from tasks where task_id = -1;
  exception
    when no_data_found then :P1_MISSING := 'none';
  end;
  begin
    select title into l_title from tasks;
  exception
    when too_many_rows then :P1_MANY := 'many';
  end;
end;`);
  assert.equal(result.ok, true, result.failure?.message);
  assert.equal(session.items.P1_COUNT, '2');
  assert.equal(session.items.P1_NEW_ID, '100');
  assert.equal(session.items.P1_UPDATED, '2');
  assert.equal(session.items.P1_TITLES, 'Design review, Ship it, From PL/SQL');
  assert.equal(session.items.P1_MISSING, 'none');
  assert.equal(session.items.P1_MANY, 'many');
  assert.equal(server.db.scalar("select status from tasks where title = 'Ship it'"), 'OPEN');

  result = exec(`
declare
  e_custom exception;
  function twice(p_value in number) return number is
  begin
    return p_value * 2;
  end twice;
  procedure label(p_in in varchar2, p_out out varchar2) is
  begin
    p_out := '<' || p_in || '>';
  end;
begin
  :P1_TWICE := twice(21);
  label('x', :P1_LABEL);
  raise e_custom;
exception
  when e_custom then
    :P1_CAUGHT := 'custom';
    raise_application_error(-20001, 'Task ' || :P1_TWICE || ' is locked');
end;`);
  assert.equal(result.ok, false);
  assert.equal(result.failure?.kind, 'app');
  assert.equal(result.failure?.message, 'Task 42 is locked');
  assert.equal(session.items.P1_TWICE, '42');
  assert.equal(session.items.P1_LABEL, '<x>');
  assert.equal(session.items.P1_CAUGHT, 'custom');

  result = exec(`begin :P1_X := 1 / 0; exception when others then :P1_ERR := sqlerrm; end;`);
  assert.equal(result.ok, true);

  assert.equal(exec(`return :P1_COUNT > 1;`, 'functionBody').value, 1);
  assert.equal(exec(`:P1_MISSING is not null and :P1_COUNT = 2`, 'plsqlExpression').value, 1);
  assert.equal(
    exec(`if :P1_UNSET is null then return 'empty'; end if; return 'set';`, 'functionBody').value,
    'empty',
  );

  result = exec(`
declare
  l_list apex_t_varchar2;
  l_out  varchar2(400);
begin
  l_list := apex_string.split('a,b,c', ',');
  for i in 1 .. l_list.count loop
    l_out := l_out || upper(l_list(i));
  end loop;
  apex_util.set_session_state('P1_STATE', l_out || ':' || apex_string.join(l_list, '-'));
  :P1_URL := apex_page.get_url(p_page => 1, p_items => 'P1_TITLE', p_values => 'x');
  :P1_USER := v('APP_USER') || '/' || sys_context('APEX$SESSION', 'APP_USER');
  apex_application.g_print_success_message := 'Saved ' || l_list.count;
  apex_debug.message('ignored %s', l_out);
  htp.p('<b>' || apex_escape.html('<i>') || '</b>');
  some_pkg.do_something(p_id => 1);
end;`);
  assert.equal(result.ok, true, result.failure?.message);
  assert.equal(session.items.P1_STATE, 'ABC:a-b-c');
  assert.equal(session.items.P1_URL, '/r/demo/home?p1_title=x');
  assert.equal(session.items.P1_USER, 'SCOTT/SCOTT');
  assert.equal(session.success, 'Saved 3');
  assert.equal(result.output, '<b>&lt;i&gt;</b>\n');
  assert.ok(
    renderer.diagnostics.some((entry) => /some_pkg\.do_something is not simulated/.test(entry.message)),
  );

  result = exec(`begin execute immediate 'drop table x'; :P1_AFTER := 'yes'; end;`);
  assert.equal(result.ok, true);
  assert.equal(session.items.P1_AFTER, 'yes');
  assert.ok(renderer.diagnostics.some((entry) => /EXECUTE statements are not simulated/.test(entry.message)));

  result = exec(`begin if :P1_X then null; end;`);
  assert.equal(result.ok, false);
  assert.equal(result.failure?.kind, 'unsupported');
});

test('Oracle SQL shims cover sequences, MERGE, rownum, connect by, listagg order and masks', () => {
  const db = new LocalDatabase(':memory:');
  try {
    db.execute('create table emp (id number primary key, name varchar2(30), dept varchar2(10), sal number)');
    db.execute('create sequence emp_seq start with 10 increment by 5');
    for (const [name, dept, sal] of [
      ['Ann', 'A', 300],
      ['Bob', 'B', 200],
      ['Cid', 'A', 100],
    ] as const)
      db.execute('insert into emp values (emp_seq.nextval, :N, :D, :S)', { N: name, D: dept, S: sal });
    assert.equal(db.scalar('select emp_seq.currval from dual'), 20);
    assert.equal(
      db.scalar("select listagg(name, ', ') within group (order by sal) from emp"),
      'Cid, Bob, Ann',
    );
    assert.equal(db.scalar('select count(*) from (select * from emp where rownum <= 2)'), 2);
    assert.equal(db.scalar('select sum(level) from dual connect by level <= 4'), 10);
    assert.equal(db.scalar("select instr('a-b-c', '-', 1, 2)"), 4);
    assert.equal(
      db.scalar("select to_char(to_date('2026-03-05 14:07:00'), 'FMDD Month YYYY FMHH24:MI')"),
      '5 March 2026 14:07',
    );
    assert.equal(
      db.scalar("select to_char(to_date('05/03/2026', 'DD/MM/YYYY'), 'Dy, DD-MON-YY')"),
      'Thu, 05-MAR-26',
    );
    assert.equal(db.scalar("select trunc(to_date('2026-08-17'), 'MM')"), '2026-08-01');
    assert.equal(db.scalar("select extract(year from to_date('2026-08-17'))"), 2026);
    assert.equal(db.scalar("select to_char(1234.5, '999G999D00')"), '1,234.50');
    assert.equal(db.scalar("select regexp_substr('ab12cd345', '[0-9]+', 1, 2)"), '345');
    assert.equal(db.scalar("select apex_escape.html('<a>')"), '&lt;a&gt;');
    assert.equal(db.scalar("select count(*) from table(apex_string.split('a:b:c', ':'))"), 3);
    db.execute(
      `merge into emp e using (select 'Bob' name, 999 sal from dual union all select 'Dan', 50 from dual) s
         on (e.name = s.name)
       when matched then update set e.sal = s.sal
       when not matched then insert (id, name, dept, sal) values (emp_seq.nextval, s.name, 'C', s.sal)`,
    );
    assert.equal(db.scalar("select sal from emp where name = 'Bob'"), 999);
    assert.equal(db.scalar("select id from emp where name = 'Dan'"), 25);
    assert.equal(
      translateOracleSql('select * from t where rownum = 1 and x = 2'),
      'select * from t where x = 2 limit 1',
    );
  } finally {
    db.close();
  }
});

const SUBMIT_PAGE = `page 3 (
    name: Edit Task
    alias: EDIT
    region edit (
        name: Edit
        type: staticContent
        layout {
            sequence: 10
        }
    )
    region info (
        name: Info
        type: plSqlDynamicContent
        source {
            plsqlCode:
                \`\`\`plsql
                declare
                  l_open number;
                begin
                  select count(*) into l_open from tasks where status is null;
                  sys.htp.p('<p class="open-count">' || l_open || ' open for ' || apex_escape.html(:APP_USER) || '</p>');
                  for r in (select title from tasks order by task_id) loop
                    htp.prn('<li>' || apex_escape.html(r.title) || '</li>');
                  end loop;
                end;
                \`\`\`
        }
        layout {
            sequence: 20
        }
        serverSideCondition {
            type: expression
            plsqlExpression: :P3_HIDE_INFO is null
        }
    )
    pageItem P3_TITLE (
        type: textField
        label {
            label: Title
        }
        layout {
            sequence: 10
            region: @edit
        }
    )
    pageItem P3_GREETING (
        type: displayOnly
        layout {
            sequence: 20
            region: @edit
        }
        source {
            type: functionBody
            plsqlFunctionBody:
                \`\`\`plsql
                return 'Hello ' || initcap(:APP_USER);
                \`\`\`
        }
    )
    pageItem P3_DEFAULTED (
        type: hidden
        layout {
            sequence: 30
            region: @edit
        }
        default {
            type: expression
            plsqlExpression: to_char(40 + 2)
        }
    )
    pageItem P3_SLUG (
        type: hidden
        layout {
            sequence: 40
            region: @edit
        }
    )
    pageItem P3_ID (
        type: hidden
        layout {
            sequence: 50
            region: @edit
        }
    )
    button save (
        buttonName: SAVE
        label: Save
        layout {
            sequence: 10
            region: @edit
        }
    )
    computation p3-slug (
        itemName: P3_SLUG
        execution {
            sequence: 10
            point: afterSubmit
        }
        computation {
            type: expression
            plsqlExpression: lower(replace(:P3_TITLE, ' ', '-'))
        }
    )
    validation title-not-reserved (
        name: Title not reserved
        execution {
            sequence: 10
        }
        validation {
            type: functionBodyReturningBoolean
            plsqlFunctionBody:
                \`\`\`plsql
                if upper(:P3_TITLE) in ('ADMIN', 'ROOT') then
                    return false;
                end if;
                return true;
                \`\`\`
        }
        error {
            errorMessage: &P3_TITLE. is reserved.
            associatedItem: @P3_TITLE
        }
    )
    validation title-unique (
        name: Title unique
        execution {
            sequence: 20
        }
        validation {
            type: functionBody
            plsqlFunctionBody:
                \`\`\`plsql
                declare
                  l_count number;
                begin
                  select count(*) into l_count from tasks where lower(title) = lower(:P3_TITLE);
                  if l_count > 0 then
                    return 'A task named ' || :P3_TITLE || ' already exists.';
                  end if;
                  return null;
                end;
                \`\`\`
        }
        error {
            associatedItem: @P3_TITLE
        }
    )
    process save-task (
        name: Save Task
        type: executeCode
        source {
            plsqlCode:
                \`\`\`plsql
                declare
                  l_id tasks.task_id%type;
                begin
                  if :P3_TITLE = 'Boom' then
                    raise_application_error(-20001, 'Boom is not allowed');
                  end if;
                  insert into tasks (task_id, title, status)
                  values (task_seq.nextval, :P3_TITLE, null)
                  returning task_id into l_id;
                  :P3_ID := l_id;
                  apex_application.g_print_success_message := 'Task ' || l_id || ' (' || :P3_SLUG || ') saved.';
                end;
                \`\`\`
        }
        execution {
            sequence: 10
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )
    branch go-home (
        name: Go home
        behavior {
            type: functionReturningPage
            plsqlFunctionBody: return case when :P3_ID >= 100 then 'HOME' else '3' end;
        }
        execution {
            sequence: 10
        }
    )
)
`;

test('submit runs PL/SQL validations, computations, processes and computed branches', async (t) => {
  const server = await preview(t, {
    'pages/p00003-edit.apx': SUBMIT_PAGE,
    'shared-components/app-processes.apx': `appProcess set-banner (
    name: Set Banner
    type: executeCode
    source {
        plsqlCode: :BANNER := 'Welcome ' || :APP_USER;
    }
    execution {
        sequence: 10
        point: beforeHeader
    }
)
`,
    'shared-components/app-items.apx': `appItem BANNER (
    name: BANNER
)
`,
  });
  await server.start();
  t.after(() => server.stop());
  const page = `${server.url}/r/demo/edit`;
  const first = await fetch(page);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  const html = await first.text();
  assert.match(html, /<p class="open-count">1 open for DEVELOPER<\/p>/);
  assert.match(html, /<li>Design review<\/li><li>Ship it<\/li>/);
  assert.match(html, /Hello Developer/);
  assert.match(html, /value="42"/);

  const submit = (title: string) =>
    fetch(`${server.url}/r/demo/wwv_flow.accept`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        p_flow_step_id: '3',
        p_request: 'SAVE',
        p_json: JSON.stringify({ pageItems: { itemsToSubmit: [{ n: 'P3_TITLE', v: title }] } }),
      }),
    }).then(
      (response) =>
        response.json() as Promise<{
          errors?: { pageItem?: string; message: string }[];
          redirectURL?: string;
        }>,
    );

  const reserved = await submit('admin');
  assert.deepEqual(
    reserved.errors?.map((error) => [error.pageItem, error.message]),
    [['P3_TITLE', 'admin is reserved.']],
  );
  const duplicate = await submit('Ship it');
  assert.equal(duplicate.errors?.[0]?.message, 'A task named Ship it already exists.');
  const boom = await submit('Boom');
  assert.equal(boom.errors?.[0]?.message, 'Boom is not allowed');

  const saved = await submit('Write the docs');
  assert.equal(saved.redirectURL, '/r/demo/home');
  assert.equal(server.db.scalar("select task_id from tasks where title = 'Write the docs'"), 100);
  const home = await (await fetch(`${server.url}/r/demo/home`, { headers: { cookie } })).text();
  assert.match(home, /Task 100 \(write-the-docs\) saved\./);

  const value = await fetch(`${server.url}/r/demo/__apex/x/set-value?page=3`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'sqlQuery',
      sqlQuery: 'select count(*) from tasks where title like :P3_TITLE',
      items: { P3_TITLE: 'S%' },
    }),
  });
  assert.deepEqual(await value.json(), { value: '1' });
  const plsql = await fetch(`${server.url}/r/demo/__apex/x/set-value?page=3`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'plsqlFunctionBody', plsqlFunctionBody: "return 'Hi ' || :BANNER;" }),
  });
  assert.deepEqual(await plsql.json(), { value: 'Hi Welcome DEVELOPER' });

  const serverCode = await fetch(`${server.url}/r/demo/__apex/server-code?page=3`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      code: "select count(*) into :P3_ID from tasks where title like :P3_TITLE || '%';",
      items: { P3_TITLE: 'Write' },
      returnItems: ['P3_ID'],
    }),
  });
  assert.deepEqual(await serverCode.json(), { P3_ID: '1' });

  const hidden = await fetch(`${server.url}/r/demo/edit?p3_hide_info=Y`, { headers: { cookie } });
  assert.doesNotMatch(await hidden.text(), /open-count/);
  assert.equal(
    server.diagnostics().filter((entry) => /not evaluated|was skipped|not interpreted/.test(entry.message))
      .length,
    0,
    JSON.stringify(server.diagnostics(), null, 1),
  );
});
