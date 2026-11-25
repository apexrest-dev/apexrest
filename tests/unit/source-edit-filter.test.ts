import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { editGroups, type EditOperation } from '../../packages/core/src/edit/page-edit.ts';
import { transformPage } from '../../packages/core/src/edit/transaction.ts';
import { parseApexLang } from '../../packages/core/src/edit/apexlang-edit.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const PAGE = `page 3 (
    name: Tasks
    alias: TASKS
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
            sqlQuery:
                \`\`\`sql
                select task_id, title from tasks order by task_id
                \`\`\`
        }
        layout {
            sequence: 20
        }
        column TITLE (
            type: plainText
        )
    )
    region board (
        name: Board
        type: cards
        source {
            location: localDatabase
            type: sqlQuery
            pageItemsToSubmit: [
                P3_OWNER
            ]
            sqlQuery:
                \`\`\`sql
                select title from tasks where (:P3_STATUS is null or status = :P3_STATUS) and (:P3_OWNER is null or 1 = 1)
                \`\`\`
        }
    )
    region chart (
        name: By status
        type: chart
        series counts (
            name: Counts
            source {
                type: sqlQuery
                sqlQuery:
                    \`\`\`sql
                    select status, count(*) n from tasks group by status
                    \`\`\`
            }
        )
    )
    pageItem P3_OWNER (
        type: textField
        layout {
            sequence: 5
            region: @main
        }
    )
    dynamicAction refresh-1 (
        name: Existing refresh
    )
)
`;
const LIST_SQL =
  'select task_id, title from tasks where (:P3_STATUS is null or status = :P3_STATUS) order by task_id';
const CHART_SQL =
  'select status, count(*) n from tasks where (:P3_STATUS is null or status = :P3_STATUS) group by status';
const filter: EditOperation = {
  op: 'addFilter',
  region: { id: 'filters', type: 'staticContent', name: 'Filters' },
  item: { name: 'P3_STATUS', region: 'filters', type: 'textField', label: 'Status' },
  targets: [
    { region: 'list', sql: LIST_SQL, columns: [{ name: 'TASK_ID' }, { name: 'TITLE' }] },
    { region: 'board' },
    { region: 'chart', series: [{ id: 'counts', sql: CHART_SQL }] },
  ],
};
const apply = (operations: EditOperation[], source = PAGE) =>
  transformPage(source, '3', editGroups(operations)).result;

test('addFilter submits, binds and refreshes every target in one transaction', () => {
  const result = apply([filter]);
  // Existing components, their ids and the existing dynamic action keep their bytes.
  assert.ok(result.includes('    dynamicAction refresh-1 (\n        name: Existing refresh\n    )'));
  const [page] = parseApexLang(result);
  const region = (id: string) => page!.children.find((c) => c.type === 'region' && c.id === id)!;
  const submit = (component: { props: Record<string, unknown> }) =>
    (component.props.source as { pageItemsToSubmit: unknown }).pageItemsToSubmit;
  assert.equal(submit(region('list')), 'P3_STATUS');
  // An Oracle-exported array gets one more element; nothing is reformatted.
  assert.deepEqual(submit(region('board')), ['P3_OWNER', 'P3_STATUS']);
  assert.match(result, / {16}P3_OWNER\n {16}P3_STATUS\n {12}\]/u);
  const series = region('chart').children.find((c) => c.type === 'series')!;
  assert.equal(submit(series), 'P3_STATUS');
  assert.match(String((series.props.source as { sqlQuery: string }).sqlQuery), /:P3_STATUS/u);
  assert.match(String((region('list').props.source as { sqlQuery: string }).sqlQuery), /:P3_STATUS/u);
  // The item lives in the new filter region; one new refresh lists every target region.
  assert.ok(page!.children.some((c) => c.type === 'pageItem' && c.id === 'P3_STATUS'));
  const refresh = page!.children.find((c) => c.type === 'dynamicAction' && c.id === 'refresh-2')!;
  assert.deepEqual(
    refresh.children.map(
      (action) => (action.props.affectedElements as { region: { ref: string } }).region.ref,
    ),
    ['list', 'board', 'chart'],
  );
  assert.equal((refresh.props.when as { items: string }).items, 'P3_STATUS');
});

test('unbound queries, unsupported regions and bad series are refused before anything changes', () => {
  const refuse = (operation: EditOperation, code: string) =>
    assert.throws(() => apply([operation]), { code }, code);
  const base = filter as Extract<EditOperation, { op: 'addFilter' }>;
  // The report query does not reference the item and no replacement is given: predicates are not rewritten.
  refuse({ ...base, targets: [{ region: 'list' }] }, 'FILTER_NOT_BOUND');
  refuse({ ...base, targets: [{ region: 'chart' }] }, 'FILTER_NOT_BOUND');
  refuse({ ...base, targets: [{ region: 'main' }] }, 'OPERATION_UNSUPPORTED');
  refuse(
    { ...base, targets: [{ region: 'chart', series: [{ id: 'nope', sql: CHART_SQL }] }] },
    'TARGET_NOT_FOUND',
  );
  refuse({ ...base, targets: [{ region: 'missing' }] }, 'TARGET_NOT_FOUND');
  refuse(
    { ...base, item: { ...base.item, name: 'P3_OWNER' }, targets: [{ region: 'board' }] },
    'TARGET_EXISTS',
  );
  // A separate query edit of the same report in the same request is a conflict, not a merge.
  assert.throws(
    () =>
      apply([
        filter,
        {
          op: 'set',
          target: 'region:list',
          property: 'query',
          value: 'select title from tasks',
          columns: [{ name: 'TITLE' }],
        },
      ]),
    { code: 'TRANSFORM_CONFLICT' },
  );
});

test('a filtered report returns initial, changed and empty results in the local preview', async (t) => {
  const result = apply([
    {
      ...(filter as Extract<EditOperation, { op: 'addFilter' }>),
      targets: [filter.op === 'addFilter' ? filter.targets[0]! : { region: 'list' }],
    },
  ]);
  const { app, assets } = await workspace(t, {
    '.apex-local/01-schema.sql': `create table tasks (task_id integer primary key, title varchar2(200), status varchar2(20));
insert into tasks values (1, 'Design review', 'DONE');
insert into tasks values (2, 'Ship it', 'OPEN');
`,
  });
  await writeFile(path.join(app, 'pages/p00003-tasks.apx'), result);
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const first = await fetch(`${server.url}/r/demo/tasks`);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  const html = await first.text();
  assert.match(html, /Design review/u);
  assert.match(html, /Ship it/u);
  const config = JSON.parse(/apexLocal\.init\((\{[\s\S]*?\})\);/u.exec(html)![1]!) as {
    regionItems?: Record<string, string[]>;
  };
  assert.deepEqual(config.regionItems?.list, ['P3_STATUS']);
  const refresh = async (value: string) =>
    (
      await fetch(`${server.url}/r/demo/__apex/region?page=3&region=list`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ items: { P3_STATUS: value } }),
      })
    ).text();
  const done = await refresh('DONE');
  assert.match(done, /Design review/u);
  assert.doesNotMatch(done, /Ship it/u);
  const empty = await refresh('NONE');
  assert.doesNotMatch(empty, /Design review|Ship it/u);
  const cleared = await refresh('');
  assert.match(cleared, /Design review/u);
  assert.match(cleared, /Ship it/u);
});
