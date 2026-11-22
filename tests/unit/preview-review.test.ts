import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import {
  addReviewComment,
  deleteReviewComments,
  describeReviewComment,
  editReviewComment,
  listReviewComments,
  readReview,
  reviewFilePath,
  reviewSourceDir,
  setReviewStatus,
} from '../../packages/core/src/preview/review.ts';
import { previewDispatch } from '../../packages/core/src/preview/service.ts';
import { workspace } from '../fixtures/preview.ts';

const join = (...lines: string[]) =>
  `wwv_flow_string.join(wwv_flow_t_varchar2(${lines.map((line) => `'${line.replaceAll("'", "''")}'`).join(',\n')}))`;

/** A page template with the developer toolbar, like Universal Theme. */
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

const PAGE = `page 3 (
    name: Orders
    alias: ORDERS
    appearance {
        pageTemplate: @devpage
    }
    region orders (
        name: Orders
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select task_id, title from tasks
                \`\`\`
        }
        layout {
            sequence: 10
        }
        advanced {
            htmlDomId: orders_report
        }
        column TASK_ID (
            type: plainText
            heading {
                heading: Number
            }
        )
        column TITLE (
            type: plainText
            heading {
                heading: Title
            }
        )
    )
    pageItem P3_SEARCH (
        type: textField
        label {
            label: Search
        }
        layout {
            sequence: 5
        }
    )
    button refresh (
        buttonName: REFRESH
        label: Refresh
        layout {
            sequence: 10
            region: @orders
        }
    )
)
`;

async function temporary(t: import('node:test').TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-review-'));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  return root;
}

test('review store adds, edits, resolves, reopens and deletes comments atomically', async (t) => {
  const file = reviewFilePath(await temporary(t));
  assert.deepEqual(readReview(file), { version: 1, comments: [] });
  const comment = addReviewComment(file, {
    page: { id: '3', name: 'Orders' },
    target: {
      kind: 'column',
      id: 'TITLE',
      region: 'orders',
      label: 'Title',
      file: 'pages/p00003-orders.apx',
      line: 24,
    },
    intent: 'rename',
    text: 'Rename to “Task title”',
  });
  assert.match(comment.id, /^rc-[a-z0-9]+-[a-f0-9]{6}$/u);
  assert.equal(comment.status, 'open');
  assert.equal(
    describeReviewComment(comment),
    `[${comment.id}] page 3: column TITLE of region orders "Title" (pages/p00003-orders.apx:24) — rename: Rename to “Task title”`,
  );
  editReviewComment(file, comment.id, { text: 'Rename to "Summary"', intent: 'change' });
  assert.equal(listReviewComments(file)[0]!.text, 'Rename to "Summary"');
  assert.deepEqual(setReviewStatus(file, [comment.id, 'rc-missing'], 'resolved', 'Renamed heading'), {
    changed: [comment.id],
    missing: ['rc-missing'],
  });
  assert.equal(listReviewComments(file).length, 0);
  assert.equal(listReviewComments(file, { status: 'resolved' })[0]!.resolution?.note, 'Renamed heading');
  setReviewStatus(file, [comment.id], 'open');
  assert.equal(listReviewComments(file)[0]!.resolution, undefined);
  assert.deepEqual(deleteReviewComments(file, [comment.id]), { deleted: [comment.id], missing: [] });
  assert.equal(JSON.parse(await readFile(file, 'utf8')).comments.length, 0);
});

test('review comments record the source folder relative to the project root', async (t) => {
  const root = await temporary(t);
  const file = reviewFilePath(root);
  assert.equal(reviewSourceDir(file, path.join(root, 'src', 'apex', 'crm')), 'src/apex/crm');
  assert.equal(reviewSourceDir(file, root), '.');
  const outside = path.join(tmpdir(), 'elsewhere-app');
  assert.equal(reviewSourceDir(file, outside), outside);
  const comment = addReviewComment(file, {
    page: { id: '1' },
    sourceDir: 'src/apex/crm',
    target: { kind: 'item', id: 'P1_NAME', file: 'pages/p00001-home.apx', line: 12 },
    text: 'Make it required',
  });
  assert.match(describeReviewComment(comment), /\(src\/apex\/crm\/pages\/p00001-home\.apx:12\)/u);
});

test('review store rejects invalid input without changing the file', async (t) => {
  const file = reviewFilePath(await temporary(t));
  assert.throws(
    () => addReviewComment(file, { page: { id: '1' }, target: { kind: 'region' }, text: 'x' }),
    /target.id/u,
  );
  assert.throws(
    () => addReviewComment(file, { page: { id: '1' }, target: { kind: 'nope' }, text: 'x' }),
    /target.kind/u,
  );
  assert.throws(
    () => addReviewComment(file, { page: { id: '1' }, target: { kind: 'page' }, text: '  ' }),
    /text/u,
  );
  assert.throws(
    () =>
      addReviewComment(file, {
        page: { id: '1' },
        target: { kind: 'page' },
        intent: 'delete-all',
        text: 'x',
      }),
    /intent/u,
  );
  // Absolute and parent paths are not kept as source locations.
  const comment = addReviewComment(file, {
    page: { id: '1' },
    target: { kind: 'element', file: '../../etc/passwd', selector: '#x', text: '  Hello   world ' },
    text: 'Fix',
  });
  assert.equal(comment.target.file, undefined);
  assert.equal(comment.target.text, 'Hello world');
  assert.equal(listReviewComments(file).length, 1);
});

async function start(t: import('node:test').TestContext, reviewFile?: string) {
  const { app, assets } = await workspace(t, { 'pages/p00003-orders.apx': PAGE }, DEV_TEMPLATE);
  const server = new PreviewServer({
    sourceDir: app,
    assetsDir: assets,
    database: ':memory:',
    ...(reviewFile ? { reviewFile } : {}),
  });
  await server.start();
  t.after(() => server.stop());
  let cookie = '';
  const call = async (pathname: string, init: RequestInit = {}) => {
    const response = await fetch(`${server.url}${pathname}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), ...(cookie ? { cookie } : {}) },
    });
    const set = response.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]!;
    return response;
  };
  return { server, call };
}

test('review mode maps page components and stores comments from the browser', async (t) => {
  const file = reviewFilePath(await temporary(t));
  const { call } = await start(t, file);
  const html = await (await call('/r/demo/orders')).text();
  const config = JSON.parse(
    /<script type="application\/json" id="apexLocalReviewConfig">(.*?)<\/script>/su.exec(html)![1]!,
  );
  assert.equal(config.page, '3');
  assert.equal(config.pageFile, 'pages/p00003-orders.apx');
  const byKind = (kind: string, id: string) =>
    config.map.find((entry: { kind: string; id: string }) => entry.kind === kind && entry.id === id);
  assert.deepEqual(byKind('region', 'orders').keys, ['orders_report']);
  assert.equal(byKind('column', 'TITLE').regionDom, 'orders_report');
  assert.ok(byKind('column', 'TITLE').keys.includes('orders_report_TITLE'));
  assert.ok(byKind('item', 'P3_SEARCH').keys.includes('P3_SEARCH_CONTAINER'));
  assert.equal(byKind('item', 'P3_SEARCH').label, 'Search');
  assert.deepEqual(byKind('button', 'refresh').keys, ['B_refresh']);
  assert.equal(byKind('column', 'TITLE').file, 'pages/p00003-orders.apx');
  // The rendered DOM really carries the ids the map points at.
  for (const id of ['orders_report', 'orders_report_TITLE', 'P3_SEARCH_CONTAINER', 'B_refresh'])
    assert.match(html, new RegExp(`id="${id}"`, 'u'), id);
  assert.match(html, /data-apex-local-panel="review"/u);

  const post = (body: unknown) =>
    call('/r/demo/__apex/x/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const added = await (
    await post({
      op: 'add',
      page: '3',
      target: {
        kind: 'column',
        id: 'TITLE',
        region: 'orders',
        label: 'Title',
        file: 'pages/p00003-orders.apx',
        line: 30,
      },
      intent: 'move',
      text: 'Move before Number',
    })
  ).json();
  assert.equal(added.ok, true);
  assert.equal(added.comment.page.name, 'Orders');
  const unknownPage = await post({ op: 'add', page: '404', target: { kind: 'page' }, text: 'x' });
  assert.equal(unknownPage.status, 400);
  const bad = await post({ op: 'add', page: '3', target: { kind: 'item' }, text: 'x' });
  assert.equal(bad.status, 400);

  const listed = await (await call('/r/demo/__apex/x/review?page=3&status=open')).json();
  assert.equal(listed.comments.length, 1);
  const text = await (await call('/r/demo/__apex/x/review?status=open&format=text')).text();
  assert.match(
    text,
    /column TITLE of region orders "Title" \([^)]*pages\/p00003-orders\.apx:30\) — move: Move before Number/u,
  );

  // The next page render shows the open count on the toolbar button.
  assert.match(await (await call('/r/demo/orders')).text(), /data-apex-local-review-count>1</u);

  const resolved = await (await post({ op: 'resolve', ids: [added.comment.id], note: 'Moved' })).json();
  assert.deepEqual(resolved.changed, [added.comment.id]);
  assert.equal(listReviewComments(file).length, 0);
  const foreign = await call('/r/demo/__apex/x/review', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://evil.example' },
    body: JSON.stringify({ op: 'delete', ids: [added.comment.id] }),
  });
  assert.equal(foreign.status, 403);
  assert.equal(listReviewComments(file, { status: 'all' }).length, 1);
});

test('review mode is off without a review file', async (t) => {
  const { call } = await start(t);
  const html = await (await call('/r/demo/orders')).text();
  assert.doesNotMatch(html, /apexLocalReviewConfig/u);
  assert.equal((await call('/r/demo/__apex/x/review')).status, 409);
});

test('preview comments and resolve read the project review file without a running preview', async (t) => {
  const root = await temporary(t);
  const file = reviewFilePath(root);
  const comment = addReviewComment(file, {
    page: { id: '3' },
    target: { kind: 'region', id: 'orders', label: 'Orders', file: 'pages/p00003-orders.apx', line: 6 },
    text: 'Show 25 rows per page',
  });
  const listed = (await previewDispatch('preview.comments', { status: 'open' }, root)) as {
    count: number;
    summary: string[];
    file: string;
  };
  assert.equal(listed.count, 1);
  assert.equal(listed.file, file);
  assert.match(
    listed.summary[0]!,
    /region orders "Orders" \(pages\/p00003-orders\.apx:6\): Show 25 rows per page/u,
  );
  const resolved = (await previewDispatch(
    'preview',
    { action: 'resolve', ids: [comment.id], note: 'Done' },
    root,
  )) as {
    changed: string[];
  };
  assert.deepEqual(resolved.changed, [comment.id]);
  assert.equal(((await previewDispatch('preview.comments', {}, root)) as { count: number }).count, 0);
  await assert.rejects(previewDispatch('preview.resolve', { ids: [] }, root), /ids/u);
});
