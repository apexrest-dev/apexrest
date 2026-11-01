import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { RUNTIME_JS } from '../../packages/core/src/preview/client.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const SCHEMA = `create table tasks (
  task_id integer primary key,
  title varchar2(200) not null,
  status varchar2(20),
  row_version number default 1
);
insert into tasks (task_id, title, status) values (1, 'Design review', 'DONE');
insert into tasks (task_id, title) values (2, 'Ship it');
create table products (
  product_id integer primary key,
  name varchar2(100),
  price number,
  stock number
);
insert into products values (1, 'Lamp', 10, 5);
insert into products values (2, 'Desk', 200, 1);
`;

const button = (id: string, name: string, sequence: number) => `
    button ${id} (
        buttonName: ${name}
        label: ${name}
        layout {
            sequence: ${sequence}
        }
    )`;

const process = (id: string, sequence: number, when: string, code: string, extra = '') => `
    process ${id} (
        name: ${id}
        type: executeCode
        source {
            plsqlCode:
                \`\`\`plsql
${code}
                \`\`\`
        }
        execution {
            sequence: ${sequence}
        }
        successMessage {
            successMessage: ${id} done.
        }${extra}
        serverSideCondition {
            whenButtonPressed: @${when}
        }
    )`;

const LAB = `page 3 (
    name: Lab
    alias: LAB
    region main (
        name: Main
        type: staticContent
        layout {
            sequence: 10
        }
    )
    region list (
        name: Tasks
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select title from tasks where (:P3_FILTER is null or status = :P3_FILTER) order by task_id
            pageItemsToSubmit: [
                P3_FILTER
            ]
        }
        layout {
            sequence: 20
        }
    )
    pageItem P3_FILTER (
        type: textField
        layout {
            sequence: 5
            region: @main
        }
    )
    pageItem P3_OTHER (
        type: textField
        layout {
            sequence: 6
            region: @main
        }
    )
    pageItem P3_EMAIL (
        type: textField
        label {
            label: E-mail address
        }
        layout {
            sequence: 10
            region: @main
        }
    )
    validation email-format (
        name: E-mail format
        execution {
            sequence: 10
        }
        validation {
            type: itemMatchesRegexp
            item: P3_EMAIL
            regexp: ^[^@]+@[^@]+$
        }
        error {
            errorMessage: #LABEL# must be a valid e-mail address.
        }
    )
${button('boom', 'BOOM', 10)}
${button('raise', 'RAISE', 20)}
${button('keep', 'KEEP', 30)}
${button('sp', 'SP', 40)}
${button('later', 'LATER', 50)}
${process(
  'boom',
  10,
  'boom',
  `begin
  insert into tasks (task_id, title) values (10, 'before engine error');
  insert into no_such_table values (1);
end;`,
)}
${process(
  'raise',
  20,
  'raise',
  `begin
  insert into tasks (task_id, title) values (11, 'before raise');
  raise_application_error(-20010, 'Credit limit exceeded.');
end;`,
)}
${process(
  'keep',
  30,
  'keep',
  `begin
  insert into tasks (task_id, title) values (12, 'committed');
  commit;
  insert into tasks (task_id, title) values (13, 'rolled back');
  raise_application_error(-20011, 'After commit.');
end;`,
)}
${process(
  'sp',
  40,
  'sp',
  `begin
  insert into tasks (task_id, title) values (14, 'kept');
  savepoint before_second;
  insert into tasks (task_id, title) values (15, 'undone');
  rollback to savepoint before_second;
end;`,
)}
${process(
  'later-first',
  50,
  'later',
  `begin
  insert into tasks (task_id, title) values (16, 'first process');
end;`,
)}
${process(
  'later-second',
  60,
  'later',
  `begin
  update tasks set title = null where task_id = 16;
end;`,
)}
    branch to-home (
        name: Go home
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 1
                clearCache: [
                    3
                    RP
                ]
            }
        }
    )
    dynamicAction on-click (
        name: Click
        when {
            event: click
            selectionType: button
            button: @boom
        }
        action cancel (
            action: cancelEvent
            execution {
                sequence: 10
            }
        )
        action hide-it (
            action: hide
            affectedElements {
                selectionType: eventSource
            }
            execution {
                sequence: 20
            }
        )
    )
)
`;

const FORM = `page 4 (
    name: Task
    alias: TASK
    region task (
        name: Task
        type: form
        source {
            location: localDatabase
            tableName: TASKS
        }
        layout {
            sequence: 10
        }
        edit {
            enabled: true
            allowedOperations: [
                update
            ]
            lostUpdateType: rowVersionColumn
            rowVersionColumn: ROW_VERSION
        }
    )
    region other (
        name: Other
        type: form
        source {
            location: localDatabase
            tableName: TASKS
        }
        layout {
            sequence: 20
        }
        edit {
            enabled: true
        }
    )
    pageItem P4_TASK_ID (
        type: hidden
        layout {
            sequence: 10
            region: @task
        }
        source {
            formRegion: @task
            column: TASK_ID
            primaryKey: true
        }
    )
    pageItem P4_TITLE (
        type: textField
        layout {
            sequence: 20
            region: @task
        }
        source {
            formRegion: @task
            column: TITLE
        }
    )
    pageItem P4_ROW_VERSION (
        type: hidden
        layout {
            sequence: 30
            region: @task
        }
        source {
            formRegion: @task
            column: ROW_VERSION
        }
    )
    pageItem P4_OTHER_ID (
        type: hidden
        layout {
            sequence: 40
            region: @other
        }
        source {
            formRegion: @other
            column: TASK_ID
            primaryKey: true
        }
    )
    pageItem P4_OTHER_TITLE (
        type: textField
        layout {
            sequence: 50
            region: @other
        }
        source {
            formRegion: @other
            column: TITLE
        }
    )
${button('save', 'SAVE', 10)}
${button('save-other', 'UPDATE', 20)}
    process init-task (
        name: Init
        type: formInitialization
        formRegion: @task
        execution {
            sequence: 10
            point: beforeHeader
        }
    )
    process init-other (
        name: Init other
        type: formInitialization
        formRegion: @other
        execution {
            sequence: 20
            point: beforeHeader
        }
    )
    process dml-task (
        name: Save task
        type: formAutoRowProcessing
        formRegion: @task
        execution {
            sequence: 10
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )
    process dml-other (
        name: Save other
        type: formAutoRowProcessing
        formRegion: @other
        execution {
            sequence: 20
        }
        serverSideCondition {
            whenButtonPressed: @save-other
        }
    )
)
`;

const GRID = `page 5 (
    name: Grid
    alias: GRID
    region products (
        name: Products
        type: interactiveGrid
        source {
            location: localDatabase
            tableName: PRODUCTS
        }
        layout {
            sequence: 10
        }
        edit {
            enabled: true
            allowedOperations: [
                add
                update
                delete
            ]
        }
        column PRODUCT_ID (
            type: hidden
            source {
                databaseColumn: PRODUCT_ID
                dataType: number
                primaryKey: true
            }
        )
        column NAME (
            type: textField
            heading {
                heading: Product
            }
        )
        column PRICE (
            type: numberField
            heading {
                heading: Unit Price
            }
        )
        column STOCK (
            type: numberField
            heading {
                heading: In Stock
            }
        )
    )
    validation price-positive (
        name: Price positive
        execution {
            sequence: 10
        }
        validation {
            editableRegion: @products
            type: expression
            language: sql
            sqlExpression: to_number(:PRICE) > 0
        }
        error {
            errorMessage: #COLUMN_HEADER# must be greater than zero.
            associatedColumn: PRICE
        }
    )
    validation stock-not-negative (
        name: Stock not negative
        execution {
            sequence: 20
        }
        validation {
            editableRegion: @products
            type: expression
            language: sql
            sqlExpression: :STOCK is null or to_number(:STOCK) >= 0
        }
        error {
            errorMessage: #COLUMN_HEADER# cannot be negative.
            associatedColumn: STOCK
        }
    )
    validation name-required (
        name: Name required
        execution {
            sequence: 30
        }
        validation {
            editableRegion: @products
            type: columnIsNotNull
            column: NAME
        }
        error {
            errorMessage: #COLUMN_HEADER# is required.
            associatedColumn: NAME
        }
    )
${button('save', 'SAVE', 10)}
    process save-products (
        name: Save products
        type: interactiveGridAutoRowProcessing
        editableRegion: @products
        execution {
            sequence: 10
        }
    )
)
`;

async function start(t: import('node:test').TestContext) {
  const { app, assets } = await workspace(t, {
    '.apex-local/01-schema.sql': SCHEMA,
    'pages/p00003-lab.apx': LAB,
    'pages/p00004-task.apx': FORM,
    'pages/p00005-grid.apx': GRID,
  });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const first = await fetch(`${server.url}/r/demo/lab`);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  const html = await first.text();
  type Accepted = {
    redirectURL?: string;
    errors?: {
      message: string;
      pageItem?: string;
      regionDomId?: string;
      recordId?: string;
      columnName?: string;
    }[];
  };
  const submit = async (page: string, request: string, items: Record<string, string> = {}) =>
    (await (
      await fetch(`${server.url}/r/demo/wwv_flow.accept`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          p_flow_step_id: page,
          p_request: request,
          p_json: JSON.stringify({
            pageItems: { itemsToSubmit: Object.entries(items).map(([n, v]) => ({ n, v })) },
          }),
        }),
      })
    ).json()) as Accepted;
  const post = async (pathname: string, body: unknown) =>
    (await (
      await fetch(`${server.url}/r/demo/__apex/${pathname}`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    ).json()) as Record<string, unknown>;
  const get = async (pathname: string) =>
    (await fetch(`${server.url}/r/demo/${pathname}`, { headers: { cookie } })).text();
  const count = (where: string) => Number(server.db.scalar(`select count(*) from tasks where ${where}`));
  return { server, cookie, html, submit, post, get, count };
}

test('an unhandled PL/SQL error stops page processing, is shown and rolls the submit back', async (t) => {
  const { server, submit, get, count } = await start(t);

  // SQL error (engine): shown, no success message, no branch, earlier DML rolled back
  const boom = await submit('3', 'BOOM');
  assert.equal(boom.redirectURL, undefined);
  assert.match(boom.errors?.[0]?.message ?? '', /no such table/iu);
  assert.equal(count('task_id = 10'), 0);
  assert.doesNotMatch(await get('home'), /boom done/u);

  // raise_application_error after an insert
  const raised = await submit('3', 'RAISE');
  assert.deepEqual(
    raised.errors?.map((error) => error.message),
    ['Credit limit exceeded.'],
  );
  assert.equal(count('task_id = 11'), 0);

  // COMMIT keeps the work before it; the rest is rolled back
  const kept = await submit('3', 'KEEP');
  assert.equal(kept.errors?.[0]?.message, 'After commit.');
  assert.equal(count('task_id = 12'), 1);
  assert.equal(count('task_id = 13'), 0);

  // SAVEPOINT / ROLLBACK TO SAVEPOINT; success commits and branches (clearCache list kept)
  const saved = await submit('3', 'SP');
  assert.equal(saved.errors, undefined);
  assert.equal(saved.redirectURL, '/r/demo/home?clear=3%2CRP');
  assert.equal(count('task_id = 14'), 1);
  assert.equal(count('task_id = 15'), 0);

  // a later failing process undoes the DML of an earlier, successful one
  const later = await submit('3', 'LATER');
  assert.match(later.errors?.[0]?.message ?? '', /NOT NULL/iu);
  assert.equal(count('task_id = 16'), 0);
  assert.ok(
    server
      .diagnostics()
      .some((entry) =>
        /later-second: PL\/SQL failed .*processing stopped with this error/u.test(entry.message),
      ),
  );
});

test('Execute Server-side Code reports its error and rolls back', async (t) => {
  const { post, count } = await start(t);
  const failed = await post('server-code?page=3', {
    code: "begin insert into tasks (task_id, title) values (20, 'x'); :P3_OTHER := 'set'; raise_application_error(-20001, 'Nope.'); end;",
    items: {},
    returnItems: ['P3_OTHER'],
  });
  assert.deepEqual(failed.errors, [{ type: 'error', location: ['page'], message: 'Nope.', unsafe: false }]);
  assert.equal(count('task_id = 20'), 0);
  const ok = await post('server-code?page=3', {
    code: "begin insert into tasks (task_id, title) values (21, 'y'); end;",
    items: {},
    returnItems: [],
  });
  assert.deepEqual(ok, {});
  assert.equal(count('task_id = 21'), 1);
});

test('custom validation messages substitute #LABEL#', async (t) => {
  const { submit } = await start(t);
  const result = await submit('3', 'NONE', { P3_EMAIL: 'not-an-email' });
  assert.deepEqual(
    result.errors?.map((error) => [error.pageItem, error.message]),
    [['P3_EMAIL', 'E-mail address must be a valid e-mail address.']],
  );
});

test('region refresh submits the region Page Items to Submit', async (t) => {
  const { html, server, cookie, get } = await start(t);
  const config = JSON.parse(/apexLocal\.init\((\{[\s\S]*?\})\);/u.exec(html)![1]!) as {
    regionItems?: Record<string, string[]>;
    dynamicActions: { actions: { action: string; selector: string }[] }[];
  };
  assert.deepEqual(config.regionItems?.list, ['P3_FILTER']);
  assert.equal(config.dynamicActions[0]!.actions[1]!.selector, 'triggeringElement');

  const refresh = async (items: Record<string, string>) =>
    (
      await fetch(`${server.url}/r/demo/__apex/region?page=3&region=list`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      })
    ).text();
  const done = await refresh({ P3_FILTER: 'DONE', P3_OTHER: 'ignored' });
  assert.match(done, /Design review/u);
  assert.doesNotMatch(done, /Ship it/u);
  // the session keeps the submitted value; undeclared items are not taken
  assert.doesNotMatch(await get('__apex/region?page=3&region=list'), /Ship it/u);
  assert.doesNotMatch(await get('lab'), /value="ignored"/u);
  const none = await refresh({ P3_FILTER: 'OPEN' });
  assert.doesNotMatch(none, /Design review|Ship it/u);
  const query = await get(
    `__apex/region?page=3&region=list&items=${encodeURIComponent(JSON.stringify({ P3_FILTER: 'DONE' }))}`,
  );
  assert.doesNotMatch(query, /Ship it/u);
});

test('form regions detect lost updates by row version column and by row values', async (t) => {
  const { server, submit, get } = await start(t);
  await get('task?p4_task_id=2&p4_other_id=2');
  server.db.execute('update tasks set row_version = 2 where task_id = 2');
  const stale = await submit('4', 'SAVE', { P4_TASK_ID: '2', P4_TITLE: 'Mine', P4_ROW_VERSION: '1' });
  assert.deepEqual(
    stale.errors?.map((error) => error.message),
    ['Current version of data in database has changed since user initiated update process.'],
  );
  assert.equal(server.db.scalar('select title from tasks where task_id = 2'), 'Ship it');

  // fetched again: the update goes through
  await get('task?p4_task_id=2&p4_other_id=2');
  const fresh = await submit('4', 'SAVE', { P4_TASK_ID: '2', P4_TITLE: 'Mine', P4_ROW_VERSION: '2' });
  assert.equal(fresh.errors, undefined);
  assert.equal(server.db.scalar('select title from tasks where task_id = 2'), 'Mine');

  // row values checksum (default lost update type)
  await get('task?p4_task_id=1&p4_other_id=1');
  server.db.execute("update tasks set title = 'Changed elsewhere' where task_id = 1");
  const changed = await submit('4', 'UPDATE', { P4_OTHER_ID: '1', P4_OTHER_TITLE: 'Mine too' });
  assert.match(changed.errors?.[0]?.message ?? '', /has changed since/u);
  assert.equal(server.db.scalar('select title from tasks where task_id = 1'), 'Changed elsewhere');
});

test('interactive grid validations run per changed row on Save and on page submit', async (t) => {
  const { server, post } = await start(t);
  const save = await post('x/ig-save', {
    page: '5',
    region: 'products',
    changes: [
      { op: 'update', id: '1', values: { PRODUCT_ID: '1', NAME: 'Lamp', PRICE: '0', STOCK: '-1' } },
      { op: 'insert', id: 't1000', values: { PRODUCT_ID: 't1000', NAME: '', PRICE: '5', STOCK: '1' } },
      { op: 'delete', id: '2', values: { PRODUCT_ID: '2' } },
    ],
  });
  assert.equal(save.ok, false);
  assert.deepEqual(save.errors, [
    { id: '1', column: 'PRICE', message: 'Unit Price must be greater than zero.' },
    { id: '1', column: 'STOCK', message: 'In Stock cannot be negative.' },
    { id: 't1000', column: 'NAME', message: 'Product is required.' },
  ]);
  assert.equal(server.db.scalar('select count(*) from products'), 2);
});

test('interactive grid row errors of a page submit point at the row and column', async (t) => {
  const { server, post, submit } = await start(t);
  await post('x/ig-stage', {
    page: '5',
    region: 'products',
    changes: [{ op: 'update', id: '2', values: { PRODUCT_ID: '2', NAME: 'Desk', PRICE: '-3', STOCK: '-2' } }],
  });
  const result = await submit('5', 'SAVE');
  assert.deepEqual(
    result.errors?.map((error) => [error.regionDomId, error.recordId, error.columnName, error.message]),
    [
      ['products', '2', 'PRICE', 'Unit Price must be greater than zero.'],
      ['products', '2', 'STOCK', 'In Stock cannot be negative.'],
    ],
  );
  assert.equal(server.db.scalar('select price from products where product_id = 2'), 200);

  await post('x/ig-stage', {
    page: '5',
    region: 'products',
    changes: [{ op: 'update', id: '2', values: { PRODUCT_ID: '2', NAME: 'Desk', PRICE: '150', STOCK: '3' } }],
  });
  const ok = await submit('5', 'SAVE');
  assert.equal(ok.errors, undefined);
  assert.equal(server.db.scalar('select price from products where product_id = 2'), 150);
});

/** Minimal jQuery/apex stand-ins: enough for apexLocal.init to bind a click dynamic action. */
function clientSandbox() {
  const handlers: { event: string; handler: (event: unknown) => void }[] = [];
  const hidden: unknown[] = [];
  const wrap = (target: unknown) => {
    const list = Array.isArray(target) ? target : [target];
    const api = {
      on: (event: string, ...rest: unknown[]) => {
        handlers.push({ event, handler: rest[rest.length - 1] as (event: unknown) => void });
        return api;
      },
      one: (event: string, ...rest: unknown[]) => api.on(event, ...rest),
      toArray: () => (typeof target === 'string' ? [] : list),
      each: (fn: (this: unknown) => void) => {
        for (const element of typeof target === 'string' ? [] : list) fn.call(element);
        return api;
      },
      show: () => api,
      hide: () => {
        hidden.push(...list);
        return api;
      },
    };
    return api;
  };
  const $ = Object.assign((target: unknown) => wrap(target), {});
  const apex = {
    jQuery: $,
    item: () => ({ node: null }),
    region: Object.assign(() => ({}), { isRegion: () => false, create: () => {}, destroy: () => {} }),
    debug: { error: () => {} },
    event: { gCancelFlag: false },
    util: { escapeCSS: (value: string) => value },
  };
  const context = vm.createContext({ apex, document: {}, location: { pathname: '/r/demo/lab' }, Promise });
  context.window = context;
  vm.runInContext(RUNTIME_JS, context);
  return { context, handlers, hidden, apex };
}

test('dynamic actions cancel the event synchronously and act on the event source', () => {
  const { context, handlers, hidden, apex } = clientSandbox();
  (context.apexLocal as { init: (config: unknown) => void }).init({
    regions: [],
    dynamicActions: [
      {
        id: 'on-click',
        event: 'click',
        selector: '#B_BOOM',
        scope: 'static',
        container: '',
        timing: 'immediate',
        condition: null,
        actions: [
          { action: 'hide', selector: 'triggeringElement', whenFalse: false, wait: true },
          { action: 'cancelEvent', selector: '', whenFalse: false, wait: true },
        ],
      },
    ],
  });
  const click = handlers.findLast((entry) => entry.event === 'click')!;
  let prevented = false;
  const element = { id: 'B_BOOM' };
  click.handler.call(element, { preventDefault: () => (prevented = true) });
  // both ran before the handler returned: a synthetic element.click() is cancelled too
  assert.equal(prevented, true);
  assert.equal(apex.event.gCancelFlag, true);
  assert.deepEqual(hidden, [element]);
});
