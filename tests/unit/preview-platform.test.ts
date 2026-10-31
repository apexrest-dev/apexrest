import test from 'node:test';
import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Session } from '../../packages/core/src/preview/render.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { runPlsql } from '../../packages/core/src/preview/extensions/server/plsql.ts';
import { workspace } from '../fixtures/preview.ts';

const SHARED = `role ADMINISTRATOR (
    name: Administrator
)

role READER (
    name: Reader
)

buildOption feature-feedback (
    name: Feature: Feedback
    status {
        status: include
    }
    advanced {
        featureIdentifier: APPLICATION_FEEDBACK
    }
)

lov status-lov (
    name: STATUS_LOV
    source {
        location: staticValues
    }

    entry open (
        sequence: 1
        display: Open
        return: O
    )

    entry closed (
        sequence: 2
        display: Closed
        return: C
    )
)

emailTemplate welcome (
    name: Welcome
    emailSubject: Welcome #NAME#
    htmlFormat {
        body: <p>Hello #NAME#, your order #ORDER# is ready.</p>
    }
    plainTextFormat {
        content: Hello #NAME#
    }
    advanced {
        staticId: WELCOME
    }
)

restDataSource employees (
    name: Employees
    source {
        type: http
        urlPathPrefix: https://example.com/ords/hr/employees/
    }
    advanced {
        staticId: employees
    }
    dataProfile {
        name: Employees
        format: json
        rowSelector: items
    }

    operation get (
        operation {
            databaseOperation: fetchRows
            httpMethod: get
            urlPattern: .
        }
    )

    operation put (
        operation {
            databaseOperation: update
            httpMethod: put
            urlPattern: :id
        }
    )

    dataProfileColumn EMPNO (
        columnName: EMPNO
        source {
            sequence: 1
            dataType: number
        }
        parsing {
            selector: empno
        }
    )

    dataProfileColumn ENAME (
        columnName: ENAME
        source {
            sequence: 2
            dataType: varchar2
        }
        parsing {
            selector: name.full
        }
    )
)

workflow approval (
    name: Approval
    title: Approve request
)

taskDefinition expense (
    name: Expense approval
    subject: Expense &P50_AMOUNT.
)
`;

const PAGE = `page 50 (
    name: Platform
    alias: PLATFORM

    region roles (
        name: Roles
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select role_static_id, role_name from apex_appl_acl_roles where application_id = :APP_ID order by 1
        }
        layout {
            sequence: 10
            slot: body
        }
    )

    region staff (
        name: Staff
        type: classicReport
        source {
            location: restSource
            restSource: @employees
        }
        layout {
            sequence: 20
            slot: body
        }
    )

    pageItem P50_AMOUNT (
        type: textField
        layout {
            sequence: 10
            region: @roles
        }
    )

    pageItem P50_MESSAGE (
        type: textField
        layout {
            sequence: 20
            region: @roles
        }
    )

    pageItem P50_TASK_ID (
        type: hidden
        layout {
            sequence: 30
            region: @roles
        }
    )

    pageItem P50_THEME (
        type: textField
        layout {
            sequence: 40
            region: @roles
        }
    )

    button go (
        buttonName: GO
        label: Go
        layout {
            sequence: 10
            region: @roles
        }
    )

    process chain (
        name: Chain
        type: executionChain
        backgroundExecution {
            runInBackground: true
        }
        execution {
            sequence: 10
        }
    )

    process chain-step-2 (
        name: Step 2
        type: executeCode
        executionChain: @chain
        source {
            plsqlCode: insert into chain_log (step) values ('two');
        }
        execution {
            sequence: 20
        }
    )

    process chain-step-1 (
        name: Step 1
        type: executeCode
        executionChain: @chain
        source {
            plsqlCode: insert into chain_log (step) values ('one');
        }
        execution {
            sequence: 10
        }
    )

    process mail (
        name: Mail
        type: sendEMail
        emailHeader {
            from: noreply@example.com
            to: &APP_USER.@example.com
        }
        emailTemplate {
            emailTemplate: @welcome
            placeholderValues: {"NAME": "Ada", "ORDER": "<42>"}
        }
        execution {
            sequence: 30
        }
    )

    process remember (
        name: Remember theme
        type: userPreferences
        action {
            type: setToItemValueIfNotNull
            preferenceName: FAVORITE_THEME
            item: P50_THEME
        }
        execution {
            sequence: 40
        }
    )

    process raise (
        name: Raise
        type: invokeApi
        invoke {
            type: restSource
            restSource: @employees
            operation: @put
        }
        execution {
            sequence: 50
        }

        parameter (
            name: @message
            parameter {
                ignoreOutput: false
            }
            value {
                type: item
                item: P50_MESSAGE
            }
        )
    )

    process task (
        name: Task
        type: humanTaskCreate
        humanTask {
            definition: @expense
            taskIdItem: P50_TASK_ID
        }
        execution {
            sequence: 60
        }
    )

    process start (
        name: Start
        type: workflow
        workflow {
            definition: @approval
        }
        execution {
            sequence: 70
        }
    )
)
`;

const SCHEMA = 'create table chain_log (id integer primary key, step varchar2(20));\n';

async function preview(t: import('node:test').TestContext) {
  const { app, assets } = await workspace(t, {
    'shared-components/platform.apx': SHARED,
    'pages/p00050-platform.apx': PAGE,
    '.apex-local/01-schema.sql': SCHEMA,
    '.apex-local/rest/employees.json': JSON.stringify({
      items: [
        { empno: 7839, name: { full: 'KING' } },
        { empno: 7698, name: { full: 'BLAKE' } },
      ],
    }),
    '.apex-local/rest/employees.put.json': JSON.stringify({
      status: 200,
      headers: { 'X-Trace': 'abc' },
      body: { message: 'Salary raised' },
    }),
    '.apex-local/rest/v1_rates.json': JSON.stringify({ eur: 1.08 }),
  });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  return { server, app };
}

const session = (id = 's1'): Session => ({ id, user: 'SCOTT', items: {}, pagination: {} });

function exec(server: PreviewServer, s: Session, code: string, mode: 'block' | 'functionBody' = 'block') {
  const ctx = server.renderer.prepareSubmit(s, '50', '');
  return runPlsql(server.renderer, ctx, code, mode, { label: 'test' });
}

test('apex_collection API is backed by SQLite and APEX_COLLECTIONS is per session', async (t) => {
  const { server } = await preview(t);
  const one = session('one');
  let result = exec(
    server,
    one,
    `begin
      apex_collection.create_or_truncate_collection('CART');
      apex_collection.add_member(p_collection_name => 'CART', p_c001 => 'apple', p_n001 => 3);
      apex_collection.add_member(p_collection_name => 'CART', p_c001 => 'pear', p_n001 => 1);
      apex_collection.update_member_attribute(p_collection_name => 'CART', p_seq => 2, p_attr_number => 1, p_attr_value => 'plum');
      apex_collection.create_collection_from_query(p_collection_name => 'ROLES', p_query => 'select role_static_id from apex_appl_acl_roles order by 1');
      for r in (select c001, n001 from apex_collections where collection_name = 'CART' order by seq_id) loop
        htp.p(r.c001 || ':' || r.n001);
      end loop;
      htp.p(apex_collection.collection_member_count('ROLES'));
      if apex_collection.collection_exists('CART') then htp.p('exists'); end if;
      apex_collection.delete_member('CART', 1);
      htp.p(apex_collection.collection_member_count(p_collection_name => 'CART'));
    end;`,
  );
  assert.equal(result.ok, true, result.failure?.message);
  assert.deepEqual(result.output.split('\n').filter(Boolean), ['apple:3', 'plum:1', '2', 'exists', '1']);

  result = exec(
    server,
    session('two'),
    `declare n number; begin select count(*) into n from apex_collections; htp.p(n);
      apex_collection.add_member('CART', 'x'); end;`,
  );
  assert.equal(result.output.trim(), '0');
  assert.equal(result.ok, false);
  assert.match(result.failure!.message, /CART does not exist/u);
});

test('dictionary views describe the APEXlang application and ACL users', async (t) => {
  const { server } = await preview(t);
  const renderer = server.renderer;
  const s = session();
  const html = renderer.renderPage(renderer.prepare(s, '50'));
  assert.match(html, /ADMINISTRATOR/u);
  assert.match(html, /KING/u);
  assert.match(html, /BLAKE/u);
  const q = (sql: string) => renderer.db.query(sql, { APP_ID: renderer.appId, APP_SESSION: s.id }).rows;
  assert.deepEqual(q("select page_id, page_name from apex_application_pages where page_alias = 'PLATFORM'"), [
    { PAGE_ID: 50, PAGE_NAME: 'Platform' },
  ]);
  assert.equal(q('select count(*) n from apex_application_page_items where page_id = 50')[0]!.N, 4);
  assert.deepEqual(
    q(
      "select display_value, return_value from apex_application_lov_entries where list_of_values_name = 'STATUS_LOV' order by display_sequence",
    ),
    [
      { DISPLAY_VALUE: 'Open', RETURN_VALUE: 'O' },
      { DISPLAY_VALUE: 'Closed', RETURN_VALUE: 'C' },
    ],
  );
  assert.equal(q('select build_option_status s from apex_application_build_options')[0]!.S, 'Include');
  // The first preview user is seeded as an ACL administrator.
  assert.deepEqual(q('select user_name, role_names from apex_appl_acl_users'), [
    { USER_NAME: 'SCOTT', ROLE_NAMES: 'Administrator' },
  ]);
  // Forms on APEX_APPL_ACL_USERS write through instead-of triggers.
  const reader = q("select role_id from apex_appl_acl_roles where role_static_id = 'READER'")[0]!.ROLE_ID;
  renderer.db.execute(
    `insert into APEX_APPL_ACL_USERS (application_id, user_name, role_ids) values (:APP_ID, 'ann', '${reader}')`,
    {
      APP_ID: renderer.appId,
    },
  );
  assert.equal(
    q("select role_static_id from apex_appl_acl_user_roles where user_name = 'ANN'")[0]!.ROLE_STATIC_ID,
    'READER',
  );
  const result = exec(
    server,
    s,
    `begin
      apex_acl.add_user_role(p_application_id => :APP_ID, p_user_name => 'ANN', p_role_static_id => 'ADMINISTRATOR');
      if apex_acl.has_user_role(p_application_id => :APP_ID, p_user_name => 'ANN', p_role_static_id => 'ADMINISTRATOR') then htp.p('admin'); end if;
      apex_util.set_build_option_status(p_application_id => :APP_ID, p_id => null, p_build_status => 'EXCLUDE', p_build_option_name => 'Feature: Feedback');
      apex_util.submit_feedback(p_comment => 'Nice', p_page_id => 50, p_rating => 3);
      apex_app_setting.set_value('THEME_NAME', 'dark');
      htp.p(apex_app_setting.get_value('THEME_NAME'));
    end;`,
  );
  assert.equal(result.ok, true, result.failure?.message);
  assert.deepEqual(result.output.split('\n').filter(Boolean), ['admin', 'dark']);
  assert.equal(q('select build_option_status s from apex_application_build_options')[0]!.S, 'Exclude');
  assert.deepEqual(
    q('select feedback, feedback_rating, page_name, feedback_status from apex_team_feedback'),
    [{ FEEDBACK: 'Nice', FEEDBACK_RATING: 3, PAGE_NAME: 'Platform', FEEDBACK_STATUS: 0 }],
  );
  // Page views are logged.
  assert.ok(Number(q('select count(*) n from apex_activity_log where step_id = 50')[0]!.N) >= 1);
  assert.ok(Number(q('select median(elap) m from apex_activity_log')[0]!.M) >= 0);
});

test('page processes: execution chain, e-mail template, preferences, invoke API, tasks and workflows', async (t) => {
  const { server } = await preview(t);
  const renderer = server.renderer;
  const s = session();
  renderer.renderPage(renderer.prepare(s, '50'));
  const outcome = renderer.accept(s, '50', 'GO', { P50_AMOUNT: '120', P50_THEME: 'vita-dark' });
  assert.equal(outcome.errors, undefined, JSON.stringify(outcome.errors));
  const q = (sql: string) => renderer.db.query(sql, { APP_ID: renderer.appId, APP_SESSION: s.id }).rows;
  // Chain children run once each, in sequence order.
  assert.deepEqual(q('select step from chain_log order by id'), [{ STEP: 'one' }, { STEP: 'two' }]);
  assert.ok(renderer.diagnostics.some((d) => /runs it inline/u.test(d.message)));
  const mail = q('select mail_to, mail_subj, mail_body_html, mail_body from apex_mail_queue');
  assert.deepEqual(mail, [
    {
      MAIL_TO: 'SCOTT@example.com',
      MAIL_SUBJ: 'Welcome Ada',
      MAIL_BODY_HTML: '<p>Hello Ada, your order &lt;42&gt; is ready.</p>',
      MAIL_BODY: 'Hello Ada',
    },
  ]);
  assert.deepEqual(q('select preference_name, preference_value from apex_workspace_preferences'), [
    { PREFERENCE_NAME: 'FAVORITE_THEME', PREFERENCE_VALUE: 'vita-dark' },
  ]);
  assert.equal(s.items.P50_MESSAGE, 'Salary raised');
  assert.equal(q('select subject, state_code from apex_tasks')[0]!.SUBJECT, 'Expense 120');
  assert.equal(s.items.P50_TASK_ID, '1');
  assert.deepEqual(q('select workflow_def_static_id, state_code from apex_workflows'), [
    { WORKFLOW_DEF_STATIC_ID: 'approval', STATE_CODE: 'ACTIVE' },
  ]);
  const result = exec(
    server,
    s,
    `declare l clob; begin
      apex_approval.approve_task(p_task_id => 1);
      l := apex_web_service.make_rest_request(p_url => 'https://api.example.com/v1/rates', p_http_method => 'GET');
      htp.p(l || ' ' || apex_web_service.g_status_code);
      l := apex_web_service.make_rest_request(p_url => 'https://api.example.com/missing', p_http_method => 'GET');
      htp.p(nvl(l, 'none') || ' ' || apex_web_service.g_status_code);
      htp.p(apex_util.get_preference('FAVORITE_THEME'));
      apex_mail.send(p_to => 'b@example.com', p_from => 'a@example.com', p_subj => 'Hi', p_body => 'Text');
      apex_mail.push_queue;
    end;`,
  );
  assert.equal(result.ok, true, result.failure?.message);
  assert.deepEqual(result.output.split('\n').filter(Boolean), ['{"eur":1.08} 200', 'none 404', 'vita-dark']);
  assert.equal(q('select outcome_code from apex_tasks')[0]!.OUTCOME_CODE, 'APPROVED');
  assert.equal(q('select count(*) n from apex_mail_log')[0]!.N, 2);

  await server.start();
  t.after(() => server.stop());
  assert.match(renderer.toolbar(renderer.prepare(s, '50')), /__apex\/x\/outbox[^>]*>.*Outbox \(2\)/u);
  const outbox = await (await fetch(`${server.url}/r/demo/__apex/x/outbox`)).text();
  assert.match(outbox, /Welcome Ada/u);
  assert.match(outbox, /employees\.put\.json/u);
});

test('missing REST fixtures are diagnosed and the dictionary follows hot reloads', async (t) => {
  const { server, app } = await preview(t);
  await rm(path.join(app, '.apex-local', 'rest', 'employees.json'));
  const renderer = server.renderer;
  const html = renderer.renderPage(renderer.prepare(session(), '50'));
  assert.doesNotMatch(html, /KING/u);
  assert.ok(renderer.diagnostics.some((d) => /no REST fixture for employees/u.test(d.message)));

  // A new role appears in APEX_APPL_ACL_ROLES once the edited source is hot-reloaded.
  await server.start();
  t.after(() => server.stop());
  assert.doesNotMatch(await (await fetch(`${server.url}/r/demo/platform`)).text(), /AUDITOR/u);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await writeFile(
    path.join(app, 'shared-components', 'roles-extra.apx'),
    'role AUDITOR (\n    name: Auditor\n)\n',
  );
  assert.match(await (await fetch(`${server.url}/r/demo/platform`)).text(), /AUDITOR/u);
});
