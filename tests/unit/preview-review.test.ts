import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
import { parse, projectSchema } from '../../packages/core/src/config.ts';

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
    /column TITLE of region orders "Title" \([^)]*pages\/p00003-orders\.apx:\d+\) \[patch column:orders\.TITLE on page 3\] — move: Move before Number/u,
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

/** A project whose APEXlang source is the preview workspace, with its review file. */
async function project(t: import('node:test').TestContext) {
  const { app, assets } = await workspace(t, { 'pages/p00003-orders.apx': PAGE }, DEV_TEMPLATE);
  const root = path.dirname(app);
  const config = parse(projectSchema, {
    schemaVersion: 1,
    projectId: 'review-edit',
    application: { sourceDir: path.basename(app), alias: 'demo' },
    database: { migrationsDir: 'db/migrations', packagesDir: 'db/packages' },
    toolchain: { lockFile: 'toolchain.json' },
    environments: {},
    artifacts: { directory: '.apexrest/artifacts', retentionDays: 7 },
  });
  await writeFile(path.join(root, 'apexrest.json'), JSON.stringify(config, null, 2));
  const reviewFile = reviewFilePath(root);
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:', reviewFile });
  await server.start();
  t.after(() => server.stop());
  const call = (pathname: string, init: RequestInit = {}) => fetch(`${server.url}${pathname}`, init);
  const post = (body: unknown) =>
    call('/r/demo/__apex/x/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const pageFile = path.join(app, 'pages', 'p00003-orders.apx');
  return { root, call, post, pageFile, reviewFile };
}

const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const configOf = (html: string) =>
  JSON.parse(/<script type="application\/json" id="apexLocalReviewConfig">(.*?)<\/script>/su.exec(html)![1]!);

test('a preview selection binds to its patch target and page-file revision', async (t) => {
  const { root, call, post, pageFile } = await project(t);
  const config = configOf(await (await call('/r/demo/orders')).text());
  const source = await readFile(pageFile, 'utf8');
  assert.equal(config.digests['pages/p00003-orders.apx'], sha(source));
  const title = config.map.find(
    (entry: { kind: string; id: string }) => entry.kind === 'column' && entry.id === 'TITLE',
  );
  assert.equal(title.patch, 'column:orders.TITLE');
  assert.equal(title.values.heading, 'Title');
  assert.deepEqual(config.editable.column, ['heading', 'format', 'sequence']);
  assert.equal(config.pageValues.title, '');

  // The server binds the selection itself; a forged digest or patch target from the browser is ignored.
  const added = await (
    await post({
      op: 'add',
      page: '3',
      target: { kind: 'region', id: 'orders', patch: 'item:P3_SEARCH', digest: 'f'.repeat(64) },
      text: 'Show 25 rows',
    })
  ).json();
  assert.equal(added.comment.target.patch, 'region:orders');
  assert.equal(added.comment.target.sourcePage, '3');
  assert.equal(added.comment.target.digest, sha(source));
  assert.equal(added.comment.target.file, 'pages/p00003-orders.apx');

  const context = async () =>
    (
      (await previewDispatch('preview.comments', {}, root)) as {
        comments: { context?: Record<string, unknown> }[];
      }
    ).comments[0]!.context!;
  const first = await context();
  assert.equal(first.target, 'region:orders');
  assert.equal(first.digest, sha(source));
  assert.equal(first.changedSinceSelection, false);
  assert.equal((first.component as { title: string }).title, 'Orders');
  assert.match(String((first.component as { query: string }).query), /select task_id, title from tasks/u);
  await writeFile(pageFile, source.replace('heading: Number', 'heading: No.'));
  const moved = await context();
  assert.equal(moved.changedSinceSelection, true);
  assert.notEqual(moved.digest, sha(source));
});

test('preview edits change one property through the digest-bound patch service', async (t) => {
  const { post, pageFile } = await project(t);
  const before = await readFile(pageFile, 'utf8');
  const applied = await post({
    op: 'patch',
    page: '3',
    target: 'column:orders.TITLE',
    property: 'heading',
    value: 'Task title',
    digest: sha(before),
  });
  assert.equal(applied.status, 200);
  const result = (await applied.json()).result;
  assert.equal(result.written, true);
  const after = await readFile(pageFile, 'utf8');
  assert.equal(result.afterDigest, sha(after));
  // A minimal source change: only the heading line differs.
  assert.equal(after, before.replace('heading: Title', 'heading: Task title'));

  // A stale digest never overwrites the newer file.
  const stale = await post({
    op: 'patch',
    page: '3',
    target: 'region:orders',
    property: 'title',
    value: 'Old',
    digest: sha(before),
  });
  assert.equal(stale.status, 409);
  const conflict = await stale.json();
  assert.equal(conflict.code, 'TRANSFORM_CONFLICT');
  assert.equal(conflict.currentDigest, sha(after));
  assert.equal(await readFile(pageFile, 'utf8'), after);

  for (const body of [
    { property: 'query', value: 'select 1 from dual' },
    { property: 'heading', value: 'x', digest: 'nope' },
  ]) {
    const refused = await post({
      op: 'patch',
      page: '3',
      target: 'column:orders.TITLE',
      digest: sha(after),
      ...body,
    });
    assert.equal(refused.status, 400);
  }
  const unsupported = await post({
    op: 'patch',
    page: '3',
    target: 'button:refresh',
    property: 'heading',
    value: 'x',
    digest: sha(after),
  });
  assert.equal(unsupported.status, 400);
  assert.equal(await readFile(pageFile, 'utf8'), after);
});

test('a project preview records the source revision it rendered, separately from deploys', async (t) => {
  const { root } = await project(t);
  const { previewRevisionRecorder } = await import('../../packages/core/src/preview/service.ts');
  const { loadProject } = await import('../../packages/core/src/config.ts');
  const { sourceInventory } = await import('../../packages/core/src/deploy.ts');
  const { revisionStatus, sourceRevision } = await import('../../packages/core/src/revision.ts');
  const ctx = await loadProject(root);
  const app = path.join(root, ctx.config.application.sourceDir);
  // Only the project's own APEXlang folder is recorded.
  assert.equal(await previewRevisionRecorder(root, path.join(root, 'assets')), undefined);
  const record = (await previewRevisionRecorder(root, app))!;
  const status = async () => revisionStatus(root, sourceRevision(await sourceInventory(ctx), ctx.config));
  const settled = async (check: (value: Awaited<ReturnType<typeof status>>) => boolean) => {
    for (let i = 0; i < 100; i++) {
      const value = await status();
      if (check(value)) return value;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return status();
  };
  record(new Date().toISOString());
  const first = await settled((value) => !!value.preview);
  assert.equal(first.preview?.current, true);
  assert.equal(first.validated, null);
  assert.deepEqual(first.deployed, {});
  // A later source edit makes the recorded preview revision stale until the next load.
  const page = path.join(app, 'pages', 'p00003-orders.apx');
  await writeFile(page, (await readFile(page, 'utf8')).replace('name: Orders', 'name: Orders 2'));
  assert.equal((await status()).preview?.current, false);
  record(new Date().toISOString());
  assert.equal((await settled((value) => value.preview?.current === true)).preview?.current, true);
});

test('preview edits save a batch of properties across components as one atomic change', async (t) => {
  const { post, pageFile } = await project(t);
  const before = await readFile(pageFile, 'utf8');
  const operations = [
    { target: 'column:orders.TITLE', property: 'heading', value: 'Task title' },
    { target: 'column:orders.TITLE', property: 'format', value: 'UPPER' },
    { target: 'region:orders', property: 'title', value: 'Open tasks' },
  ];
  const applied = await post({ op: 'patch', page: '3', digest: sha(before), operations });
  assert.equal(applied.status, 200);
  const result = (await applied.json()).result;
  assert.equal(result.operations, 3);
  const after = await readFile(pageFile, 'utf8');
  assert.equal(result.afterDigest, sha(after));
  assert.match(after, /heading: Task title/u);
  assert.match(after, /formatMask: UPPER/u);
  assert.match(after, /region orders \(\n {8}name: Open tasks/u);
  // Unrelated bytes and ids stay: the button and item are unchanged.
  assert.ok(after.includes(before.slice(before.indexOf('    pageItem P3_SEARCH ('))));
  assert.match(String(result.next), /Source edited only/u);

  // One invalid operation rejects the batch and is named; nothing is written.
  const invalid = await post({
    op: 'patch',
    page: '3',
    digest: sha(after),
    operations: [
      { target: 'region:orders', property: 'title', value: 'Again' },
      { target: 'button:refresh', property: 'heading', value: 'x' },
    ],
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).operation, 1);
  const refused = await post({
    op: 'patch',
    page: '3',
    digest: sha(after),
    operations: [{ target: 'region:orders', property: 'query', value: 'select 1 from dual' }],
  });
  assert.equal(refused.status, 400);
  assert.equal((await refused.json()).operation, 0);
  // Two operations setting the same property conflict together: no single culprit is named.
  const duplicate = await post({
    op: 'patch',
    page: '3',
    digest: sha(after),
    operations: [
      { target: 'region:orders', property: 'title', value: 'A' },
      { target: 'region:orders', property: 'title', value: 'B' },
    ],
  });
  assert.equal(duplicate.status, 422);
  assert.equal((await duplicate.json()).operation, undefined);
  // A stale digest is the usual conflict.
  const stale = await post({
    op: 'patch',
    page: '3',
    digest: sha(before),
    operations: operations.slice(0, 1),
  });
  assert.equal(stale.status, 409);
  assert.equal(await readFile(pageFile, 'utf8'), after);
});

test('template and grid pickers: offered for 26.2 sources with current values and the theme choices', async (t) => {
  const { call, post, pageFile, root } = await project(t);
  const app = path.dirname(path.dirname(pageFile));
  // Without a declared 26.2 source release the layout controls are left out and the form says why.
  const plain = configOf(await (await call('/r/demo/orders')).text());
  assert.deepEqual(plain.editable.region, ['title', 'sequence']);
  assert.match(plain.layoutUnavailable, /26\.2/u);
  await mkdir(path.join(app, '.apex'), { recursive: true });
  await writeFile(path.join(app, '.apex/apexlang.json'), JSON.stringify({ mmdVersion: '26.2.0+3479' }));
  const page = await readFile(pageFile, 'utf8');
  await writeFile(
    pageFile,
    page.replace(
      '        advanced {\n            htmlDomId: orders_report',
      '        appearance {\n            template: @/standard\n        }\n        advanced {\n            htmlDomId: orders_report',
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  const config = configOf(await (await call('/r/demo/orders')).text());
  assert.ok(config.editable.region.includes('template') && config.editable.region.includes('columnSpan'));
  assert.equal(config.layoutUnavailable, undefined);
  const orders = config.map.find((entry: { patch: string }) => entry.patch === 'region:orders');
  assert.equal(orders.values.template, 'standard');
  assert.equal(orders.values.columnSpan, '');
  // The pickers' choices come from the theme the preview renders with.
  const choices = await (await call('/r/demo/__apex/x/review?choices=1')).json();
  assert.ok(choices.templates.region.some((entry: { id: string }) => entry.id === 'standard'));
  assert.ok(choices.templates.page.some((entry: { id: string }) => entry.id === 'devpage'));
  assert.ok(typeof choices.options.region.standard !== 'undefined');
  // A picker's choice is an ordinary patch proposal: saved with the batch through the shared service.
  const before = await readFile(pageFile, 'utf8');
  const saved = await post({
    op: 'patch',
    page: '3',
    digest: sha(before),
    operations: [
      { target: 'region:orders', property: 'columnSpan', value: '6' },
      { target: 'region:orders', property: 'startNewRow', value: 'false' },
      { target: 'region:orders', property: 'template', value: '' },
    ],
  });
  assert.equal(saved.status, 200, await saved.clone().text());
  const after = await readFile(pageFile, 'utf8');
  assert.match(after, /columnSpan: 6/u);
  assert.doesNotMatch(after, /template: @\/standard/u);
  void root;
});

test('the column editor reads every report column from source and saves order, visibility and headings at once', async (t) => {
  const { call, post, pageFile } = await project(t);
  // A default saved report that shows TITLE only; TASK_ID is a declared column without a display entry.
  const withReport = (await readFile(pageFile, 'utf8')).replace(
    '            heading {\n                heading: Title\n            }\n        )\n    )',
    '            heading {\n                heading: Title\n            }\n        )\n        savedReport 1 (\n            visibility: primaryDefault\n            displayColumn TITLE (\n                sequence: 1\n            )\n        )\n    )',
  );
  await writeFile(pageFile, withReport);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const read = async () => (await call('/r/demo/__apex/x/review?columns=orders&page=3')).json();
  const before = await read();
  assert.equal(before.digest, sha(withReport));
  assert.deepEqual(
    before.columns.map((c: { name: string; visible: boolean; heading: string }) => [
      c.name,
      c.visible,
      c.heading,
    ]),
    [
      ['TASK_ID', false, 'Number'],
      ['TITLE', true, 'Title'],
    ],
  );
  const saved = await post({
    op: 'patch',
    page: '3',
    digest: before.digest,
    operations: [
      { target: 'column:orders.TASK_ID', property: 'heading', value: 'No.' },
      { op: 'orderColumns', region: 'orders', order: ['TITLE', 'TASK_ID'], visible: { TASK_ID: true } },
    ],
  });
  assert.equal(saved.status, 200, await saved.clone().text());
  const after = await read();
  assert.deepEqual(after.order, ['TITLE', 'TASK_ID']);
  assert.deepEqual(
    after.columns.map((c: { name: string; visible: boolean; heading: string }) => [
      c.name,
      c.visible,
      c.heading,
    ]),
    [
      ['TASK_ID', true, 'No.'],
      ['TITLE', true, 'Title'],
    ],
  );
  const text = await readFile(pageFile, 'utf8');
  assert.match(text, /select task_id, title from tasks/u);
  assert.match(
    text,
    /displayColumn TITLE \(\n {16}sequence: 1[\s\S]*displayColumn TASK_ID \(\n {16}sequence: 2/u,
  );

  // An invalid order is named and nothing changes; a stale digest keeps the file.
  const invalid = await post({
    op: 'patch',
    page: '3',
    digest: after.digest,
    operations: [
      { target: 'column:orders.TITLE', property: 'heading', value: 'Task' },
      { op: 'orderColumns', region: 'orders', order: ['TITLE'] },
    ],
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).operation, 1);
  const stale = await post({
    op: 'patch',
    page: '3',
    digest: before.digest,
    operations: [{ op: 'orderColumns', region: 'orders', order: ['TASK_ID', 'TITLE'] }],
  });
  assert.equal(stale.status, 409);
  assert.equal(await readFile(pageFile, 'utf8'), text);
  assert.equal((await call('/r/demo/__apex/x/review?columns=nope&page=3')).status, 404);
});

test('visual moves send the shared move operation; rejected moves name the reason and write nothing', async (t) => {
  const { call, post, pageFile } = await project(t);
  const config = configOf(await (await call('/r/demo/orders')).text());
  // The form offers the move primitive's own slot rules and each region's type.
  assert.deepEqual(config.moves.item, ['regionBody', 'body', 'contentBody']);
  assert.ok(config.moves.buttonInInteractiveReport.includes('rightOfInteractiveReportSearchBar'));
  assert.equal(
    config.map.find((entry: { patch: string }) => entry.patch === 'region:orders').regionType,
    'interactiveReport',
  );
  const before = await readFile(pageFile, 'utf8');
  const moved = await post({
    op: 'patch',
    page: '3',
    digest: sha(before),
    operations: [
      {
        op: 'moveComponent',
        component: 'item:P3_SEARCH',
        to: { region: 'orders', slot: 'regionBody', sequence: 1 },
      },
      { target: 'item:P3_SEARCH', property: 'label', value: 'Find' },
    ],
  });
  assert.equal(moved.status, 200, await moved.clone().text());
  const after = await readFile(pageFile, 'utf8');
  assert.match(
    after,
    /pageItem P3_SEARCH \([\s\S]*?label: Find[\s\S]*?region: @orders\n {12}slot: regionBody/u,
  );
  const rejected = await post({
    op: 'patch',
    page: '3',
    digest: sha(after),
    operations: [
      { op: 'moveComponent', component: 'button:refresh', to: { region: 'orders', slot: 'dialogFooter' } },
    ],
  });
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /Slot dialogFooter is not supported/u);
  assert.equal(await readFile(pageFile, 'utf8'), after);
});

test('the review panel undoes and redoes the last local source edit', async (t) => {
  const { post, pageFile } = await project(t);
  const before = await readFile(pageFile, 'utf8');
  await post({
    op: 'patch',
    page: '3',
    target: 'region:orders',
    property: 'title',
    value: 'Undo me',
    digest: sha(before),
  });
  const undo = await post({ op: 'undo' });
  assert.equal(undo.status, 200);
  assert.match((await undo.json()).result.next, /not reverted/u);
  assert.equal(await readFile(pageFile, 'utf8'), before);
  const redo = await post({ op: 'redo' });
  assert.equal(redo.status, 200);
  assert.match(await readFile(pageFile, 'utf8'), /name: Undo me/u);
  assert.equal((await post({ op: 'redo' })).status, 400);
});

test('a preview record is skipped when the loaded snapshot no longer matches the files', async (t) => {
  const { root } = await project(t);
  const { previewRevisionRecorder } = await import('../../packages/core/src/preview/service.ts');
  const { loadProject } = await import('../../packages/core/src/config.ts');
  const { apxSignatures } = await import('../../packages/core/src/preview/source-index.ts');
  const ctx = await loadProject(root);
  const app = path.join(root, ctx.config.application.sourceDir);
  const record = (await previewRevisionRecorder(root, app))!;
  const revisions = path.join(root, '.apexrest', 'revisions.json');
  const stale = apxSignatures(app);
  stale.set('pages/p00003-orders.apx', '1:1');
  record(new Date().toISOString(), stale);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const read = async () => JSON.parse(await readFile(revisions, 'utf8').catch(() => '{}'));
  assert.equal((await read()).preview, undefined);
  record(new Date().toISOString(), apxSignatures(app));
  for (let i = 0; i < 100 && !(await read()).preview; i++)
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok((await read()).preview);
});

test('an edit landing while the preview loads keeps the last good page and is read again', async (t) => {
  const { call, pageFile } = await project(t);
  const fs = (await import('node:fs')).default;
  assert.match(await (await call('/r/demo/orders')).text(), /Orders/u);
  await writeFile(
    pageFile,
    (await readFile(pageFile, 'utf8')).replace('name: Orders', 'name: Changed orders'),
  );
  // The integrity recheck after parsing sees a different signature once: a mixed observation.
  const original = fs.statSync;
  let interfere = true;
  (fs as { statSync: unknown }).statSync = ((file: string, ...rest: unknown[]) => {
    const info = (original as (...args: unknown[]) => import('node:fs').Stats)(file, ...rest);
    if (
      interfere &&
      String(file).endsWith('p00003-orders.apx') &&
      new Error().stack?.includes('statSignature')
    ) {
      interfere = false;
      return {
        ...info,
        size: info.size + 1,
        mtimeMs: info.mtimeMs,
        isFile: () => true,
        isDirectory: () => false,
      };
    }
    return info;
  }) as typeof fs.statSync;
  t.after(() => {
    (fs as { statSync: unknown }).statSync = original;
  });
  const during = await (await call('/r/demo/orders')).text();
  assert.equal(interfere, false, 'the load observed the edit and rechecked it');
  assert.doesNotMatch(during, /Changed orders/u);
  const after = await (await call('/r/demo/orders')).text();
  assert.match(after, /Changed orders/u);
});
