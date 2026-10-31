import test from 'node:test';
import assert from 'node:assert/strict';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const join = (...lines: string[]) =>
  `wwv_flow_string.join(wwv_flow_t_varchar2(${lines.map((line) => `'${line.replaceAll("'", "''")}'`).join(',\n')}))`;

/** A page template that places the developer toolbar like Universal Theme does. */
const DEV_TEMPLATE = `
begin
wwv_flow_imp_shared.create_template(
 p_id=>wwv_flow_imp.id(9100)
,p_name=>'Dev Page'
,p_static_id=>'devpage'
,p_header_template=>${join('<!DOCTYPE html>', '<html><head><title>#TITLE#</title>#APEX_CSS#</head>', '<body>#FORM_OPEN#')}
,p_box=>${join('<main>#SUCCESS_MESSAGE##NOTIFICATION_MESSAGE##BODY#</main>')}
,p_footer_template=>${join('#FORM_CLOSE##DEVELOPER_TOOLBAR##APEX_JAVASCRIPT##GENERATED_JAVASCRIPT#</body></html>')}
,p_success_message=>'<div class="t-Alert--success">#SUCCESS_MESSAGE#</div>'
,p_notification_message=>'<div class="t-Alert--warning">#MESSAGE#</div>'
,p_grid_max_columns=>12
,p_grid_template=>'<div class="container">#ROWS#</div>'
,p_grid_row_template=>'<div class="row">#COLUMNS#</div>'
,p_grid_column_template=>'<div class="col">#CONTENT#</div>'
);
end;
/
`;

const FILES: Record<string, string> = {
  'shared-components/acl-roles.apx': `role ADMINISTRATOR (
    name: Administrator
)

role CONTRIBUTOR (
    name: Contributor
)
`,
  'shared-components/authorizations.apx': `authorization administration-rights (
    name: Administration Rights
    type: isInRoleOrGroup
    settings {
        names: Administrator
    }
    error {
        errorMessage: Insufficient privileges, user is not an Administrator
    }
)

authorization contribution-rights (
    name: Contribution Rights
    type: plSqlFunctionBody
    settings {
        plsqlFunctionBody:
            \`\`\`plsql
            return apex_acl.has_user_role (
                p_application_id => :APP_ID,
                p_user_name      => :APP_USER,
                p_role_static_id => 'CONTRIBUTOR');
            \`\`\`
    }
)
`,
  'shared-components/workflows/approval.apx': `workflow approval (
    name: Approval
    title: Approval
    version v1 (
        workflowVersion: 1.0
        settings {
            state: active
        }
        activity start (
            name: Start
            type: workflowStart
            connection (
                name: to review
                activity {
                    to: @review
                }
            )
        )
        activity review (
            name: Manager Review
            type: humanTaskCreate
            connection (
                name: Approved
                activity {
                    to: @finish
                }
            )
        )
        activity finish (
            name: Done
            type: workflowEnd
        )
    )
)
`,
  'pages/p00004-admin.apx': `page 4 (
    name: Admin
    alias: ADMIN
    appearance {
        pageTemplate: @/devpage
    }
    security {
        authorizationScheme: @administration-rights
    }

    region secret (
        name: Admin Only
        type: staticContent
        source {
            htmlCode: <p id="admin-body">Admin body</p>
        }
        layout {
            sequence: 10
        }
    )
)
`,
  'pages/p00005-tools.apx': `page 5 (
    name: Tools
    alias: TOOLS
    appearance {
        pageTemplate: @/devpage
    }

    region contributors (
        name: Contributors
        type: staticContent
        source {
            htmlCode: <p id="contrib-body">Contributor area</p>
        }
        layout {
            sequence: 10
        }
        security {
            authorizationScheme: @contribution-rights
        }
    )

    region flow (
        name: Flow
        type: workflowDiagram
        layout {
            sequence: 20
        }
    )

    pageItem P5_PROMPT (
        type: textField
        layout {
            sequence: 10
        }
    )

    pageItem P5_ANSWER (
        type: textarea
        layout {
            sequence: 20
        }
    )

    button go (
        buttonName: GO
        label: Go
        layout {
            sequence: 10
        }
    )

    process ask-ai (
        name: Ask AI
        type: generateTextWithAi
        inputValue {
            type: item
            item: P5_PROMPT
        }
        useResponse {
            item: P5_ANSWER
        }
        execution {
            sequence: 10
        }
    )

    process notify (
        name: Notify
        type: sendPushNotification
        settings {
            to: &APP_USER.
            title: Hello
            body: Your answer is ready
        }
        execution {
            sequence: 20
        }
    )

    dynamicAction summarize (
        when {
            event: change
            selectionType: items
            items: [P5_PROMPT]
        }
        action generate (
            action: generateTextWithAi
            affectedElements {
                selectionType: items
                items: [P5_ANSWER]
            }
            inputValue {
                type: item
                item: P5_PROMPT
            }
        )
    )
)
`,
};

async function start(t: import('node:test').TestContext, toolbar = true) {
  const { app, assets } = await workspace(t, FILES, DEV_TEMPLATE);
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:', toolbar });
  await server.start();
  t.after(() => server.stop());
  let cookie = '';
  const call = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${server.url}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), ...(cookie ? { cookie } : {}) },
    });
    const set = response.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]!;
    return response;
  };
  const post = (name: string, body: unknown) =>
    call(`/r/demo/__apex/x/${name}?page=5`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const submit = (page: string, request: string, items: Record<string, string>) =>
    call('/r/demo/wwv_flow.accept', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        p_flow_id: '100',
        p_flow_step_id: page,
        p_request: request,
        p_json: JSON.stringify({
          pageItems: { itemsToSubmit: Object.entries(items).map(([n, v]) => ({ n, v })) },
        }),
      }).toString(),
    });
  return { server, call, post, submit };
}

test('developer toolbar renders the APEX-style bar with session, debug, view as, pages, viewport and reset', async (t) => {
  const { server, call } = await start(t);
  const html = await (await call('/r/demo/tools?p5_prompt=Hello')).text();
  assert.match(html, /<div class="apex-local-toolbar" id="apexLocalToolbar"/);
  for (const panel of ['diagnostics', 'session', 'debug', 'viewas', 'pages'])
    assert.match(html, new RegExp(`data-apex-local-panel="${panel}"`), panel);
  for (const mode of ['desktop', 'tablet', 'phone'])
    assert.match(html, new RegExp(`data-apex-local-viewport="${mode}"`));
  assert.match(html, /data-apex-local-reset/);
  // Session state shows the item with its current value; quick links cover every page.
  assert.match(html, /data-apex-local-item="P5_PROMPT" data-original="Hello"/);
  for (const path of ['/r/demo/home', '/r/demo/admin', '/r/demo/tools'])
    assert.match(html, new RegExp(`href="${path}"`));
  assert.match(html, /<li class="is-current"><a href="\/r\/demo\/tools">/);
  // View as lists the ACL roles and schemes.
  assert.match(html, /name="role" value="ADMINISTRATOR"/);
  assert.match(html, /name="deny" value="contribution-rights"/);
  // The theme-style picker keeps its option markup.
  const toolbar = server.renderer.toolbar(
    server.renderer.prepare({ id: '9', user: 'DEVELOPER', items: {}, pagination: {} }, '5'),
  );
  assert.match(toolbar, /<option value="vita">Vita<\/option>/);
  assert.match(toolbar, /apex_theme_style=/);

  const runtime = await (await call('/__apex/runtime.js')).text();
  assert.match(runtime, /hasAction: function/);
  for (const name of ['generateTextWithAi', 'showAiAssistant', 'triggerGeocoding', 'expandTree'])
    assert.match(runtime, new RegExp(`${name}:`), name);
  const css = await (await call('/__apex/runtime.css')).text();
  assert.match(css, /\.apex-local-tb-bar\{/);
  assert.match(css, /\.apex-local-viewport\{/);
});

test('the toolbar stays opt-out', async (t) => {
  const { call } = await start(t, false);
  const html = await (await call('/r/demo/tools')).text();
  assert.doesNotMatch(html, /apexLocalToolbar/);
});

test('debug log records rendering and submit steps per session', async (t) => {
  const { call, submit } = await start(t);
  await call('/r/demo/home');
  const failed = (await (await submit('1', 'ADD', { P1_TITLE: '' })).json()) as { errors?: unknown[] };
  assert.ok(failed.errors?.length);
  const ok = (await (await submit('1', 'ADD', { P1_TITLE: 'Write tests' })).json()) as {
    redirectURL?: string;
  };
  assert.equal(ok.redirectURL, '/r/demo/home');
  const log = (await (await call('/r/demo/__apex/x/debug-log')).json()) as {
    entries: { title: string; ms: number; events: { type: string; name: string; detail?: string }[] }[];
  };
  const [latest, previous, render] = log.entries;
  assert.equal(render!.title, 'Show page 1');
  assert.ok(render!.events.some((event) => event.type === 'end' && event.name === 'Page rendered'));
  assert.equal(previous!.title, 'Process page 1');
  assert.ok(
    previous!.events.some(
      (event) => event.type === 'validation' && /value required/u.test(event.detail ?? ''),
    ),
  );
  assert.ok(previous!.events.some((event) => event.type === 'end' && event.name === 'Submit stopped'));
  const process = latest!.events.find((event) => event.type === 'process' && event.name === 'add-task');
  assert.match(process!.detail!, /executeCode: ran/);
  assert.ok(
    latest!.events.some(
      (event) => event.type === 'end' && /redirect \/r\/demo\/home/u.test(event.detail ?? ''),
    ),
  );
  assert.ok(latest!.ms >= 0);

  // Another session has its own log; clearing empties it.
  const other = (await (
    await fetch(`${new URL((await call('/r/demo/home')).url).origin}/r/demo/__apex/x/debug-log`)
  ).json()) as {
    entries: unknown[];
  };
  assert.equal(other.entries.length, 0);
  await call('/r/demo/__apex/x/debug-log', { method: 'POST', body: JSON.stringify({ clear: true }) });
  const cleared = (await (await call('/r/demo/__apex/x/debug-log')).json()) as { entries: unknown[] };
  assert.equal(cleared.entries.length, 0);
});

test('session state can be edited from the toolbar route', async (t) => {
  const { call, post } = await start(t);
  await call('/r/demo/tools');
  await post('session-state', { items: { P5_PROMPT: 'Edited', 'bad name': 'x', G_FLAG: 'Y' } });
  const state = (await (await call('/r/demo/__apex/x/session-state')).json()) as {
    items: Record<string, string>;
  };
  assert.equal(state.items.P5_PROMPT, 'Edited');
  assert.equal(state.items.G_FLAG, 'Y');
  assert.equal(state.items['BAD NAME'], undefined);
  const html = await (await call('/r/demo/tools')).text();
  assert.match(html, /data-apex-local-item="P5_PROMPT" data-original="Edited"/);
  assert.match(html, /data-apex-local-item="G_FLAG"/);
  await post('session-state', { clearPage: '5' });
  const after = (await (await call('/r/demo/__apex/x/session-state')).json()) as {
    items: Record<string, string>;
  };
  assert.equal(after.items.P5_PROMPT, undefined);
  assert.equal(after.items.G_FLAG, 'Y');
});

test('view as enforces authorization schemes and ACL roles only when chosen', async (t) => {
  const { call, post } = await start(t);
  // Default: permissive.
  let admin = await (await call('/r/demo/admin')).text();
  assert.match(admin, /id="admin-body"/);
  let tools = await (await call('/r/demo/tools')).text();
  assert.match(tools, /id="contrib-body"/);

  // A user without roles is denied the page and the region.
  await post('view-as', { roles: [], deny: [] });
  admin = await (await call('/r/demo/admin')).text();
  assert.doesNotMatch(admin, /id="admin-body"/);
  assert.match(admin, /Access denied by page security check/);
  assert.match(admin, /Insufficient privileges, user is not an Administrator/);
  assert.match(admin, /View as: no roles/);
  tools = await (await call('/r/demo/tools')).text();
  assert.doesNotMatch(tools, /id="contrib-body"/);

  // Roles grant access through isInRoleOrGroup (by role name) and apex_acl (by static ID).
  await post('view-as', { roles: ['ADMINISTRATOR', 'CONTRIBUTOR'], deny: [] });
  admin = await (await call('/r/demo/admin')).text();
  assert.match(admin, /id="admin-body"/);
  tools = await (await call('/r/demo/tools')).text();
  assert.match(tools, /id="contrib-body"/);

  // A scheme can be forced to deny.
  await post('view-as', { roles: ['ADMINISTRATOR', 'CONTRIBUTOR'], deny: ['contribution-rights'] });
  tools = await (await call('/r/demo/tools')).text();
  assert.doesNotMatch(tools, /id="contrib-body"/);

  await post('view-as', { off: true });
  admin = await (await call('/r/demo/admin')).text();
  assert.match(admin, /id="admin-body"/);
  const state = (await (await call('/r/demo/__apex/x/view-as')).json()) as {
    viewAs: unknown;
    roles: string[];
  };
  assert.equal(state.viewAs, null);
  assert.deepEqual(state.roles, ['ADMINISTRATOR', 'CONTRIBUTOR']);
});

test('reset data re-seeds the database', async (t) => {
  const { server, call, submit, post } = await start(t);
  await call('/r/demo/home');
  await submit('1', 'ADD', { P1_TITLE: 'Temporary' });
  assert.equal(server.db.scalar('select count(*) from tasks'), 3);
  assert.equal((await call('/r/demo/__apex/x/reset-data')).status, 405);
  const result = (await (await post('reset-data', {})).json()) as { ok: boolean; problems: string[] };
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
  assert.equal(server.db.scalar('select count(*) from tasks'), 2);
});

test('workflow diagram, AI, push notification and geocoding stand-ins are honest', async (t) => {
  const { server, call, submit } = await start(t);
  const html = await (await call('/r/demo/tools')).text();
  assert.match(html, /<svg class="apex-local-wf-svg"/);
  for (const name of ['Start', 'Manager Review', 'Done', 'Approved'])
    assert.match(html, new RegExp(`>${name}<`));
  assert.equal((html.match(/class="apex-local-wf-edge/gu) ?? []).length, 2);
  const config = JSON.parse(/apexLocal\.init\((.*?)\);\n/u.exec(html)![1]!) as {
    dynamicActions: { actions: { action: string; groups: Record<string, Record<string, string>> }[] }[];
  };
  assert.deepEqual(config.dynamicActions[0]!.actions[0]!.groups.inputValue, {
    type: 'item',
    item: 'P5_PROMPT',
  });

  const result = (await (await submit('5', 'GO', { P5_PROMPT: 'Summarize the week' })).json()) as {
    redirectURL?: string;
  };
  assert.equal(result.redirectURL, '/r/demo/tools');
  const state = (await (await call('/r/demo/__apex/x/session-state')).json()) as {
    items: Record<string, string>;
  };
  assert.match(state.items.P5_ANSWER!, /^\[Local preview placeholder\] Generative AI is not called/);
  assert.match(state.items.P5_ANSWER!, /Summarize the week/);
  const log = (await (await call('/r/demo/__apex/x/debug-log')).json()) as {
    entries: { events: { name: string; detail?: string }[] }[];
  };
  const push = log.entries[0]!.events.find((event) => /Push notification not sent/u.test(event.name));
  assert.equal(push!.detail, 'to DEVELOPER: Hello — Your answer is ready');

  const messages = server.diagnostics().map((diagnostic) => diagnostic.message);
  assert.ok(
    messages.some((message) =>
      /Workflow Diagram flow shows a static diagram of Approval 1\.0/u.test(message),
    ),
  );
  assert.ok(
    messages.some((message) => /generateTextWithAi returns clearly labelled placeholder text/u.test(message)),
  );
  assert.ok(messages.some((message) => /sendPushNotification\) is written to the debug log/u.test(message)));
  assert.ok(!messages.some((message) => /workflowDiagram.*not simulated/u.test(message)));
});
