import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  compareApexlangSource,
  compareApplicationExports,
} from '../../packages/core/src/apexlang-equivalence.ts';
import { inventory } from '../../packages/core/src/fs.ts';

const item = (layout: string, type = 'selectList') => `page 1 (
    title: Exact title
    pageItem P1_QUALIFICATION (
        type: ${type}
        layout {
            sequence: 10
${layout}
            columnSpan: 6
        }
    )
)
`;

test('qualified page-item default omission and structural whitespace match with explicit evidence', () => {
  const expected = item('            startNewRow: true');
  const actual = item('').replace('    pageItem', '\n    pageItem');
  const result = compareApexlangSource(expected, actual);
  assert.equal(result.equivalent, true);
  assert.ok(result.rules.includes('pageItem.selectList.layout.startNewRow:true-default'));
  assert.equal(compareApexlangSource(expected, expected).rules.length, 0);
  assert.equal(compareApexlangSource(item(''), item('').replace('    title:', '\ttitle:')).equivalent, true);
  assert.equal(
    compareApexlangSource(item(''), '// structural comment\n/* structural\ncomment */\n' + item(''))
      .equivalent,
    true,
  );
});

test('default rule is restricted by component, native type and startNewLayout conditions', () => {
  for (const [left, right] of [
    [item('            startNewRow: false'), item('')],
    [
      item('            startNewLayout: true\n            startNewRow: true'),
      item('            startNewLayout: true'),
    ],
    [item('            startNewRow: true', 'hidden'), item('', 'hidden')],
    [item('            startNewRow: true', 'customPlugin'), item('', 'customPlugin')],
    [
      item('            startNewRow: true').replace('pageItem', 'button'),
      item('').replace('pageItem', 'button'),
    ],
    [
      item('            startNewRow: true\n            startNewRow: false'),
      item('            startNewRow: false'),
    ],
    [
      item('            startNewRow: true').replace('layout {', 'appearance {'),
      item('').replace('layout {', 'appearance {'),
    ],
  ])
    assert.equal(compareApexlangSource(left!, right!).equivalent, false, left);
  assert.equal(
    compareApexlangSource(
      item('            startNewLayout: false\n            startNewRow: true'),
      item('            startNewLayout: false'),
    ).equivalent,
    true,
  );
});

test('scalar values, quoted values, HTML and comment-like text are never whitespace normalized', () => {
  for (const [left, right] of [
    ['Exact title', 'Exact  title'],
    ['"Exact title"', '"Exact  title"'],
    ['Text // literal comment', 'Text'],
    ['Text /* literal comment */', 'Text'],
    ['<p>Exact title</p>', '<p>Exact  title</p>'],
    ['Exact title ', 'Exact title'],
  ])
    assert.equal(
      compareApexlangSource(item('').replace('Exact title', left!), item('').replace('Exact title', right!))
        .equivalent,
      false,
    );
  assert.equal(
    compareApexlangSource(item(''), item('').replace('P1_QUALIFICATION', 'P1_OTHER')).equivalent,
    false,
  );
});

test('fenced SQL and code payloads retain whitespace, comments and apparent APEXlang declarations', () => {
  const code =
    "page 1 (\n source {\n sqlQuery:\n  ```sql\n  select 'two  spaces' as value -- keep\n  /* keep this */\n  ```\n }\n)\n";
  assert.equal(compareApexlangSource(code, '\n' + code).equivalent, true);
  assert.equal(compareApexlangSource(code, code.replace('two  spaces', 'two spaces')).equivalent, false);
  assert.equal(compareApexlangSource(code, code.replace('-- keep', '-- changed')).equivalent, false);
  assert.equal(compareApexlangSource(code, code.replace('  select ', ' select ')).equivalent, false);
  const apparentCode =
    'page 1 (\n source {\n htmlCode:\n ```\n' + item('            startNewRow: true') + ' ```\n }\n)\n';
  assert.equal(
    compareApexlangSource(apparentCode, apparentCode.replace('            startNewRow: true', '')).equivalent,
    false,
  );
  assert.equal(compareApexlangSource(code, code.replace('  ```\n', '')).equivalent, false);
});

test('unknown and malformed forms fail closed instead of receiving default normalization', () => {
  for (const source of [
    item('') + 'unknown!\n',
    item('').replace(')\n', '}\n'),
    'value: """\n' + item('') + '"""\n',
  ])
    assert.equal(compareApexlangSource(source, '\n' + source).equivalent, false);
});

test('application comparison normalizes selected APEXlang only and records exact before/after hashes', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-equivalence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const expected = path.join(root, 'expected'),
    actual = path.join(root, 'actual');
  await mkdir(path.join(expected, 'pages'), { recursive: true });
  await mkdir(path.join(actual, 'pages'), { recursive: true });
  const file = 'pages/p00001-home.apx';
  await writeFile(path.join(expected, file), item('            startNewRow: true'));
  await writeFile(path.join(actual, file), item(''));
  const before = await inventory(expected),
    after = await inventory(actual);
  const result = await compareApplicationExports(expected, actual, before, after, [file]);
  assert.equal(result.equivalent, true);
  assert.deepEqual(result.mismatchedFiles, []);
  assert.deepEqual(result.normalizations[0], {
    file,
    expectedSha256: before[file],
    actualSha256: after[file],
    rules: ['structural-whitespace-and-comments', 'pageItem.selectList.layout.startNewRow:true-default'],
  });
  assert.equal(
    (await compareApplicationExports(expected, actual, before, after, [])).equivalent,
    false,
    'unselected application files stay byte-exact',
  );
  for (const name of ['metadata.json', 'query.sql', 'static.txt']) {
    await writeFile(path.join(expected, name), item('            startNewRow: true'));
    await writeFile(path.join(actual, name), item(''));
  }
  const strict = await compareApplicationExports(
    expected,
    actual,
    await inventory(expected),
    await inventory(actual),
    [file, 'metadata.json', 'query.sql', 'static.txt'],
  );
  assert.equal(strict.equivalent, false);
  assert.deepEqual(strict.mismatchedFiles, ['metadata.json', 'query.sql', 'static.txt']);
  await writeFile(path.join(actual, file), item('').replace('Exact title', 'Unexpected title'));
  assert.equal(
    (await compareApplicationExports(expected, actual, before, after, [file])).equivalent,
    false,
    'stale inventory hashes cannot hide concurrent file changes',
  );
});

// Native Oracle 26.2 page export uses target/items colon-map boundaries.
test('native target/items maps tolerate formatting but preserve every target and item scalar', () => {
  const page = `page 10 (
 button open (
 behavior {
 target: {
 page: 80
 items: {
 P80_ID: #ID#
 }
 clearCache: 80
 }
 }
 )
)
`;
  assert.equal(compareApexlangSource(page, page + '\n').equivalent, true);
  assert.equal(compareApexlangSource(page, page.replace('page: 80', 'page: 81')).equivalent, false);
  assert.equal(
    compareApexlangSource(page, page.replace('P80_ID: #ID#', 'P80_ID: #OTHER#')).equivalent,
    false,
  );
  assert.equal(compareApexlangSource(page, page.replace('items: {', 'items: invalid {')).equivalent, false);
});

const dashboard = (security: string, row: string, chart: string, reverse = false) => {
  const regions = [
    `region summary (\n type: cards\n layout {\n sequence: 10\n ${row}\n }\n )`,
    `region trend (\n type: chart\n layout {\n sequence: 20\n }\n ${chart}\n )`,
  ];
  return `page 50 (\n title: Dashboard\n ${security}\n ${(reverse ? regions.reverse() : regions).join('\n')}\n)\n`;
};
test('Oracle dashboard default elision and explicitly sequenced region order are equivalent', () => {
  const authored = dashboard(
    'security {\n pageAccessProtection: argumentsMustHaveChecksum\n }',
    'startNewRow: true',
    'chart {\n type: bar\n }',
  );
  const exported = dashboard('', '', '', true);
  assert.equal(compareApexlangSource(authored, exported).equivalent, true);
  for (const changed of [
    authored.replace('argumentsMustHaveChecksum', 'unrestricted'),
    authored.replace('startNewRow: true', 'startNewRow: false'),
    authored.replace('type: bar', 'type: pie'),
    authored.replace('sequence: 20', 'sequence: 21'),
    authored.replace('sequence: 20', 'sequence: 10'),
    authored.replace('region trend', 'region summary'),
  ])
    assert.equal(compareApexlangSource(changed, exported).equivalent, false);
});

const report = (reverse = false) => {
  const columns = [
    `column TOTAL (\n reportColumnQueryId: 1\n layout {\n sequence: 10\n }\n )`,
    `column ACTIVE (\n reportColumnQueryId: 2\n layout {\n sequence: 20\n }\n )`,
  ];
  return `page 70 (\n region kpis (\n type: classicReport\n layout {\n sequence: 10\n }\n ${(reverse ? columns.reverse() : columns).join('\n')}\n )\n)\n`;
};
test('Oracle key-ordered report columns with explicit unique sequences are equivalent', () => {
  const authored = report();
  assert.equal(compareApexlangSource(authored, report(true)).equivalent, true);
  assert.ok(
    compareApexlangSource(authored, report(true)).rules.includes('explicit-unique-report-column-order'),
  );
  for (const changed of [
    authored.replace('sequence: 20', 'sequence: 10'),
    authored.replace('reportColumnQueryId: 2', 'reportColumnQueryId: 3'),
    authored.replace('column ACTIVE', 'column INACTIVE'),
  ])
    assert.equal(compareApexlangSource(changed, report(true)).equivalent, false);
});

test('report column order remains strict outside qualified classic reports and explicit unique sequences', () => {
  for (const type of ['interactiveReport', 'interactiveGrid', 'chart', 'customPlugin']) {
    const authored = report().replace('type: classicReport', `type: ${type}`);
    const exported = report(true).replace('type: classicReport', `type: ${type}`);
    assert.equal(compareApexlangSource(authored, exported).equivalent, false, type);
  }
  for (const [from, to] of [
    ['sequence: 20', 'sequence: 10'],
    ['sequence: 20', ''],
    ['sequence: 20', 'sequence: invalid'],
  ])
    assert.equal(
      compareApexlangSource(report().replace(from!, to!), report(true).replace(from!, to!)).equivalent,
      false,
    );
});

// Forms observed in Oracle APEX 26.2.0 page exports after authored imports (local DEV, 2026-10-15).
const drawer = (variant: {
  order?: 'authored' | 'exported';
  options?: string;
  html?: 'fenced' | 'quoted';
  defaults?: boolean;
  identifier?: string;
}) => {
  const html =
    variant.html === 'quoted'
      ? '        htmlExpression: "<span class=\\"t-Badge\\">#STATUS!HTML#</span>"\n'
      : '        htmlExpression:\n            ```html\n            <span class="t-Badge">#STATUS!HTML#</span>\n            ```\n';
  const parameter = (key: string, direction: string, type: string, seq: number, out = false) =>
    `        parameter ${key} (\n` +
    (variant.defaults === false && direction === 'in' && type === 'varchar2'
      ? ''
      : `            parameter {\n` +
        (variant.defaults === false && direction === 'in'
          ? ''
          : `                direction: ${direction}\n`) +
        (variant.defaults === false && type === 'varchar2' ? '' : `                dataType: ${type}\n`) +
        (out && variant.defaults !== false ? '                ignoreOutput: false\n' : '') +
        `            }\n`) +
    `            value {\n                type: item\n                item: P2_${key.toUpperCase()}\n            }\n` +
    `            advanced {\n                displaySequence: ${seq}\n            }\n        )\n`;
  const items = [
    `    pageItem P2_ID (\n        type: hidden\n        layout {\n            sequence: 10\n        }\n    )\n`,
    `    pageItem P2_NAME (\n        type: textField\n        layout {\n            sequence: 20\n        }\n    )\n`,
  ];
  const processes = [
    `    process save (\n        type: invokeApi\n        invoke {\n            package: ${variant.identifier ?? 'example_api'}\n            procedureOrFunction: save_row\n        }\n` +
      parameter('p_name', 'in', 'varchar2', 1) +
      parameter('p_id', 'out', 'number', 2, true) +
      `        execution {\n            sequence: 20\n        }\n    )\n`,
    `    process load (\n        type: executeCode\n        execution {\n            sequence: 10\n            point: beforeHeader\n        }\n    )\n`,
  ];
  const region =
    `    region rows (\n        type: staticContent\n        layout {\n            sequence: 10\n        }\n` +
    `        appearance {\n            templateOptions: [\n${variant.options ?? '                #DEFAULT#\n                t-Region--scrollBody\n'}            ]\n        }\n` +
    `        messages {\n            whenNoDataFound: None\n        }\n${html}    )\n`;
  const authored = variant.order !== 'exported';
  const regionText = authored
    ? region
    : region.replace(
        /        appearance \{[\s\S]*?\n        \}\n        messages \{[\s\S]*?\n        \}\n/,
        (block) => {
          const [appearance, messages] = block.split(/(?=        messages \{)/);
          return messages! + appearance!;
        },
      );
  const da =
    `    dynamicAction refresh (\n        execution {\n            sequence: 10\n        }\n        when {\n` +
    (authored || variant.defaults !== false ? '            event: change\n' : '') +
    `            selectionType: items\n            items: P2_NAME\n        }\n    )\n`;
  return (
    'page 2 (\n' +
    regionText +
    (authored ? items.join('') : [...items].reverse().join('')) +
    da +
    (authored ? processes.join('') : [...processes].reverse().join('')) +
    ')\n'
  );
};

test('Oracle 26.2 export forms: lists, member order, quoted literals, invokeApi defaults and key order', () => {
  const authored = drawer({});
  const exported = drawer({ order: 'exported', html: 'quoted', defaults: false, identifier: 'EXAMPLE_API' });
  const result = compareApexlangSource(authored, exported);
  assert.equal(result.equivalent, true, result.reason);
  for (const rule of [
    'unique-property-and-group-order',
    'single-line-literal-quoting',
    'invokeApi.parameter.direction:in,dataType:varchar2,ignoreOutput:false-default',
    'invokeApi.invoke.identifier-case',
    'dynamicAction.when.items.event:change-default',
    'key-ordered-page-components',
  ])
    assert.ok(result.rules.includes(rule), rule);
});

test('new Oracle 26.2 rules never hide value, order or default changes', () => {
  const exported = drawer({ order: 'exported', html: 'quoted', defaults: false, identifier: 'EXAMPLE_API' });
  for (const changed of [
    drawer({ options: '                t-Region--scrollBody\n                #DEFAULT#\n' }),
    drawer({ options: '                #DEFAULT#\n' }),
    drawer({}).replace(
      '#STATUS!HTML#</span>\n            ```',
      '#STATUS!HTML#</span>\n            <br>\n            ```',
    ),
    drawer({}).replace('t-Badge">#STATUS', 't-Badge u-danger">#STATUS'),
    drawer({}).replace('direction: in', 'direction: out'),
    drawer({}).replace('dataType: varchar2', 'dataType: clob'),
    drawer({}).replace('ignoreOutput: false', 'ignoreOutput: true'),
    drawer({}).replace('procedureOrFunction: save_row', 'procedureOrFunction: save_rows'),
    drawer({}).replace('package: example_api', 'package: "example_api"'),
    drawer({}).replace('event: change', 'event: click'),
    drawer({}).replace('displaySequence: 2', 'displaySequence: 3'),
    drawer({}).replace(
      'sequence: 20\n        }\n    )\n    process load',
      'sequence: 21\n        }\n    )\n    process load',
    ),
  ])
    assert.equal(compareApexlangSource(changed, exported).equivalent, false, changed);
  const unsequenced = (text: string) =>
    text.replace(
      '            sequence: 10\n            point: beforeHeader\n',
      '            point: beforeHeader\n',
    );
  assert.equal(compareApexlangSource(unsequenced(drawer({})), unsequenced(exported)).equivalent, false);
  assert.equal(
    compareApexlangSource(
      'page 1 (\n    title: A\n    pageItems: [\n        P1_A\n    ]\n)\n',
      'page 1 (\n    title: A\n    pageItems: [\n        P1_A\n)\n',
    ).equivalent,
    false,
  );
});
