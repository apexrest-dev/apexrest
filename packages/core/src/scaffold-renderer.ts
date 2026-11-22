import { Fault } from './result.ts';
import {
  scaffoldSchema,
  type ScaffoldPage,
  type ScaffoldProcess,
  type ScaffoldRegion,
  type ScaffoldSpec,
  type ScaffoldTarget,
} from './scaffold-spec.ts';

export { scaffoldSchema };
type Release = '26.1' | '26.2';
const q = (v: string) => JSON.stringify(v);
const indent = (v: string) =>
  v
    .split('\n')
    .map((line) => (line ? '    ' + line : line))
    .join('\n');
const g = (name: string, value: string) => `${name} {\n${indent(value)}\n}`;
const n = (kind: string, id: string, value: string[]) =>
  `${kind} ${id} (\n${indent(value.filter(Boolean).join('\n'))}\n)\n`;
const fence = (language: string, value: string) => `\n${indent('```' + language + '\n' + value + '\n```')}`;
const invalid = (message: string): never => {
  throw new Fault('INVALID_INPUT', message, 2);
};
const ref = (value: string) => '@' + value;
type Guards = Pick<ScaffoldPage, 'condition' | 'authorizationScheme' | 'buildOption'>;
function condition(value: Guards, button?: string) {
  const parts = button ? [`whenButtonPressed: ${ref(button)}`] : [];
  for (const [key, field] of Object.entries(value.condition ?? {}))
    parts.push(`${key}: ${key === 'type' ? field : q(field)}`);
  if (value.condition?.type === 'expression') parts.push('language: plsql');
  return parts.length ? g('serverSideCondition', parts.join('\n')) : '';
}
function guards(value: Guards, button?: string, securityExtra = '') {
  const security = [
    value.authorizationScheme ? `authorizationScheme: ${ref(value.authorizationScheme)}` : '',
    securityExtra,
  ]
    .filter(Boolean)
    .join('\n');
  return [
    condition(value, button),
    security ? g('security', security) : '',
    value.buildOption ? g('config', `buildOption: ${ref(value.buildOption)}`) : '',
  ].filter(Boolean);
}
function target(value: ScaffoldTarget) {
  return g(
    'target:',
    [
      `page: ${value.page}`,
      value.items
        ? g(
            'items:',
            Object.entries(value.items)
              .map(([key, val]) => `${key}: ${q(val)}`)
              .join('\n'),
          )
        : '',
      value.clearCache?.length ? `clearCache: ${value.clearCache.join(',')}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}
function query(value: { sql: string; itemsToSubmit?: string[] | undefined }, location = true) {
  return g(
    'source',
    [
      location ? 'location: localDatabase' : '',
      'type: sqlQuery',
      value.itemsToSubmit?.length ? `pageItemsToSubmit: ${value.itemsToSubmit.join(',')}` : '',
      `sqlQuery:${fence('sql', value.sql)}`,
    ]
      .filter(Boolean)
      .join('\n'),
  );
}
function appearance(template: string) {
  return g('appearance', `template: @/${template}\ntemplateOptions: #DEFAULT#`);
}
const reportAlias = (index: number) => {
  let alias = '';
  for (let num = index + 1; num; num = Math.floor((num - 1) / 26))
    alias = String.fromCharCode(65 + ((num - 1) % 26)) + alias;
  return alias;
};

export function renderRegion(region: ScaffoldRegion, index: number, release: Release = '26.2') {
  const chart = region.type === 'chart' || region.type === 'barChart';
  const parts = [
    `name: ${q(region.name)}`,
    `type: ${chart ? 'chart' : region.type}`,
    g('layout', `sequence: ${(index + 1) * 10}\nslot: body`),
    appearance(
      region.type === 'cards'
        ? 'cards-container'
        : ['interactiveReport', 'classicReport'].includes(region.type)
          ? 'interactive-report'
          : 'standard',
    ),
    ...guards(region, undefined, chart ? 'escapeSpecialChars: true' : ''),
  ];
  if ('sql' in region) parts.push(query(region));
  if (region.type === 'staticContent' && region.html)
    parts.push(g('source', `htmlCode:${fence('html', region.html)}`));
  if (region.type === 'form') parts.push(g('edit', 'enabled: false'));
  if (region.type === 'calendar') {
    if (region.initialDate)
      parts.push(
        g(
          'componentAdvanced',
          `initJavaScriptFunction:${fence('javascript-browser', `function(options) { options.initialDate = ${q(region.initialDate)}; return options; }`)}`,
        ),
      );
    parts.push(
      g(
        'settings',
        [
          `displayColumn: ${region.displayColumn}`,
          `startDateColumn: ${region.startDateColumn}`,
          region.endDateColumn ? `endDateColumn: ${region.endDateColumn}` : '',
          region.keyColumn ? `pkColumn: ${region.keyColumn}` : '',
          `showTime: ${region.showTime ?? false}`,
          region.link ? target(region.link).replace(/^target:/, 'viewEditLink:') : '',
        ]
          .filter(Boolean)
          .join('\n'),
      ),
    );
  }
  if (region.type === 'cards') {
    parts.push(g('title', `column: ${region.titleColumn}`), g('body', `column: ${region.bodyColumn}`));
    if (region.keyColumn) parts.push(g('card', `primaryKeyColumn1: ${region.keyColumn}`));
    if (region.link)
      parts.push(
        n('action', 'open', [
          'type: fullCard',
          g('layout', 'sequence: 10'),
          g('behavior', 'type: redirectThisApp\n' + target(region.link)),
        ]),
      );
  }
  if (chart) {
    const kind = region.type === 'barChart' ? 'bar' : region.chartType;
    parts.push(g('chart', `type: ${kind}`));
    if (kind !== 'pie' && kind !== 'donut')
      for (const [axis, title] of [
        ['x', region.xTitle],
        ['y', region.yTitle],
      ])
        parts.push(n('axis', axis!, [`name: ${axis}`, title ? `title: ${q(title)}` : '']));
    const series = region.type === 'barChart' ? [{ ...region, id: 'values' }] : region.series;
    series.forEach((entry, ordinal) =>
      parts.push(
        n('series', entry.id ?? `s${ordinal + 1}`, [
          `name: ${q(entry.name)}`,
          g('execution', `sequence: ${(ordinal + 1) * 10}`),
          query(entry, false),
          g('columnMapping', `label: ${entry.labelColumn}\nvalue: ${entry.valueColumn}`),
          'link' in entry && entry.link ? g('link', 'type: redirectThisApp\n' + target(entry.link)) : '',
        ]),
      ),
    );
  }
  if (region.type === 'interactiveReport' || region.type === 'classicReport') {
    if (region.type === 'classicReport')
      parts.push(g('componentAppearance', 'template: @/standard\ntemplateOptions: #DEFAULT#'));
    else
      parts.push(
        g('pagination', 'type: rowRangesXToYOfZ'),
        g('link', region.link ? 'linkColumn: customTarget\n' + target(region.link) : 'linkColumn: exclude'),
      );
    parts.push(
      g(
        'messages',
        `whenNoDataFound: ${q(region.emptyMessage ?? 'No rows found. Clear filters or add source data.')}`,
      ),
    );
    region.columns.forEach((column, i) => {
      const body = [
        region.type === 'classicReport'
          ? `${column.link ? 'type: link\n' : ''}reportColumnQueryId: ${i + 1}\nderivedColumn: N`
          : `type: ${column.link ? 'link' : 'plainText'}`,
        g('heading', `heading: ${q(column.heading)}`),
        g('layout', `sequence: ${(i + 1) * 10}`),
      ];
      if (region.type === 'interactiveReport')
        body.push(
          g(
            'source',
            `dataType: ${release === '26.1' ? { varchar2: 'STRING', number: 'NUMBER', date: 'DATE', timestamp: 'TIMESTAMP' }[column.dataType] : column.dataType}`,
          ),
          g('advanced', `endUserAlias: ${reportAlias(i)}`),
        );
      if (i === 0) body.push(g('accessibility', 'valueIdentifiesRow: true'));
      if (column.formatMask) body.push(g('appearance', `formatMask: ${q(column.formatMask)}`));
      if (column.link)
        body.push(
          g('link', `linkText: ${q(column.linkText ?? '#' + column.name + '#')}\n${target(column.link)}`),
        );
      parts.push(n('column', column.name, body));
    });
    if (region.type === 'interactiveReport')
      parts.push(
        n('savedReport', '1001', [
          'visibility: primaryDefault',
          g('view', 'rowsPerPage: 25'),
          ...region.columns.map((c, i) => n('displayColumn', c.name, [`sequence: ${i + 1}`])),
        ]),
      );
  }
  return indent(n('region', region.id ?? `r${index + 1}`, parts));
}

export function renderProcess(value: ScaffoldProcess, mapping: number, shared = false) {
  return n(shared ? 'appProcess' : 'process', value.id, [
    `name: ${q(value.id)}`,
    'type: executeCode',
    shared ? '' : g('advanced', `executionMappingIdentifier: ${mapping}`),
    g('source', `plsqlCode:${fence('plsql', value.plsql)}`),
    g(
      'execution',
      `sequence: ${value.sequence ?? 10}\npoint: ${value.point ?? (shared ? 'beforeHeader' : 'afterSubmit')}`,
    ),
    ...guards(value, shared ? undefined : value.button),
    value.successMessage && !shared ? g('successMessage', `successMessage: ${q(value.successMessage)}`) : '',
  ]);
}

/** Explicit source only: supplied SQL and PL/SQL are never executed by scaffolding. */
export function renderPageBody(page: ScaffoldPage, release: Release) {
  const parts = page.regions.map((region, index) => renderRegion(region, index, release));
  page.items?.forEach((item, i) => {
    const hidden = item.type === 'hidden';
    const fields = [
      `type: ${item.type}`,
      hidden ? '' : g('label', `label: ${q(item.label ?? item.name)}`),
      g('layout', `sequence: ${(i + 1) * 10}\nregion: ${ref(item.region)}\nslot: regionBody`),
      hidden
        ? ''
        : g(
            'appearance',
            `template: @/${item.required ? 'required-floating' : 'optional-floating'}\ntemplateOptions: #DEFAULT#${item.formatMask ? '\nformatMask: ' + q(item.formatMask) : ''}`,
          ),
      hidden || item.type === 'displayOnly'
        ? ''
        : g('validation', `valueRequired: ${item.required ?? false}`),
      ...guards(item, undefined, hidden ? 'sessionStateProtection: checksumRequiredSessionLevel' : ''),
    ];
    if (item.defaultValue !== undefined)
      fields.push(g('default', `type: static\nstaticValue: ${q(item.defaultValue)}`));
    if (item.lov)
      fields.push(
        g(
          'lov',
          Array.isArray(item.lov)
            ? `type: staticValues\nstaticValues: ${q('STATIC:' + item.lov.map((option) => `${option.label};${option.value}`).join(','))}\ndisplayNullValue: true\nnullDisplayValue: - Select -`
            : `type: sqlQuery\nsqlQuery:${fence('sql', item.lov.sql)}\ndisplayNullValue: true\nnullDisplayValue: - Select -`,
        ),
      );
    if (item.sourceColumn)
      fields.push(
        g(
          'source',
          `formRegion: ${ref(item.region)}\ncolumn: ${item.sourceColumn}\ndataType: ${item.dataType ?? 'varchar2'}\nqueryOnly: true${item.primaryKey ? '\nprimaryKey: true' : ''}`,
        ),
      );
    parts.push(indent(n('pageItem', item.name, fields)));
  });
  page.buttons?.forEach((button, i) =>
    parts.push(
      indent(
        n('button', button.id, [
          `buttonName: ${button.id.replaceAll('-', '_').toUpperCase()}`,
          `label: ${q(button.label)}`,
          g(
            'layout',
            `sequence: ${(i + 1) * 10}\nregion: ${ref(button.region)}\nslot: ${release === '26.1' ? 'next' : 'NEXT'}`,
          ),
          g('appearance', 'buttonTemplate: @/text\ntemplateOptions: #DEFAULT#'),
          g(
            'behavior',
            (button.target ? 'action: redirectThisApp\n' + target(button.target) : 'action: submitPage') +
              (button.confirmation ? '\nrequiresConfirmation: true' : ''),
          ),
          button.confirmation
            ? g(
                'confirmation',
                `message: ${q(button.confirmation.message)}${button.confirmation.style ? '\nstyle: ' + button.confirmation.style : ''}`,
              )
            : '',
          ...guards(button),
        ]),
      ),
    ),
  );
  const mapping = (i: number) => 760000000000000 + page.id * 1000 + i + 1;
  page.processes?.forEach((process, i) =>
    parts.push(indent(renderProcess({ ...process, sequence: process.sequence ?? (i + 1) * 10 }, mapping(i)))),
  );
  page.regions
    .filter((region) => region.type === 'form')
    .forEach((region, i) =>
      parts.push(
        indent(
          n('process', `initialize-${region.id ?? 'r' + (page.regions.indexOf(region) + 1)}`, [
            'name: Initialize form',
            'type: formInitialization',
            `formRegion: ${ref(region.id ?? 'r' + (page.regions.indexOf(region) + 1))}`,
            g('advanced', `executionMappingIdentifier: ${mapping(100 + i)}`),
            g('execution', `sequence: 10\npoint: beforeHeader`),
          ]),
        ),
      ),
    );
  page.validations?.forEach((validation, i) =>
    parts.push(
      indent(
        n('validation', validation.id, [
          `name: ${q(validation.id)}`,
          g('execution', `sequence: ${(i + 1) * 10}`),
          g(
            'validation',
            `type: functionBodyReturningBoolean\nplsqlFunctionBody:${fence('plsql', validation.plsql)}`,
          ),
          g(
            'error',
            `errorMessage: ${q(validation.errorMessage)}${validation.item ? '\nassociatedItem: ' + ref(validation.item) : ''}`,
          ),
          ...guards(validation, validation.button),
        ]),
      ),
    ),
  );
  page.branches?.forEach((branch, i) =>
    parts.push(
      indent(
        n('branch', branch.id, [
          `name: ${q(branch.id)}`,
          g('behavior', 'type: pageOrUrl\n' + target(branch.target)),
          g('execution', `point: afterProcessing\nsequence: ${(i + 1) * 10}`),
          ...guards(branch, branch.button),
        ]),
      ),
    ),
  );
  page.refreshes?.forEach((refresh, i) =>
    parts.push(
      indent(
        n('dynamicAction', `refresh-${i + 1}`, [
          `name: Refresh dependent regions ${i + 1}`,
          g('execution', `sequence: ${(i + 1) * 10}`),
          g('when', `event: change\nselectionType: items\nitems: ${refresh.items.join(',')}`),
          ...refresh.regions.map((region, ordinal) =>
            n('action', `refresh-${ordinal + 1}`, [
              'action: refresh',
              g('affectedElements', `selectionType: region\nregion: ${ref(region)}`),
              g('execution', `sequence: ${(ordinal + 1) * 10}\nfireOnInit: false`),
            ]),
          ),
        ]),
      ),
    ),
  );
  return parts.join('\n');
}

export function validateSpec(spec: ScaffoldSpec) {
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) invalid(`${label} must be unique.`);
  };
  unique(
    spec.pages.map((page) => String(page.id)),
    'Page IDs',
  );
  const checkTarget = (target: ScaffoldTarget | undefined) => {
    if (target && Object.keys(target.items ?? {}).some((name) => !name.startsWith(`P${target.page}_`)))
      invalid('Target item names must belong to the target page.');
  };
  unique(
    (spec.applicationProcesses ?? []).map((process) => process.id),
    'Application process IDs',
  );
  for (const page of spec.pages) {
    const regions = page.regions.map((region, i) => region.id ?? `r${i + 1}`),
      items = page.items?.map((item) => item.name) ?? [],
      buttons = page.buttons?.map((button) => button.id) ?? [];
    unique(regions, 'Region IDs');
    unique(items, 'Item names');
    unique(buttons, 'Button IDs');
    unique(
      buttons.map((id) => id.replaceAll('-', '_').toUpperCase()),
      'Button request names',
    );
    for (const list of [page.processes, page.validations, page.branches])
      unique(
        (list ?? []).map((value) => value.id),
        'Component IDs',
      );
    const requireRegion = (id: string) => {
      if (!regions.includes(id)) invalid(`Unknown page ${page.id} region ${id}.`);
    };
    const requireItem = (name: string) => {
      if (!items.includes(name)) invalid(`Unknown page ${page.id} item ${name}.`);
    };
    page.items?.forEach((item) => {
      if (!item.name.startsWith(`P${page.id}_`)) invalid(`Item ${item.name} must belong to page ${page.id}.`);
      requireRegion(item.region);
      if (item.type === 'selectList' && !item.lov) invalid('Select list items require a LOV.');
      if (item.lov && item.type !== 'selectList') invalid('Only select lists accept a LOV.');
      if (Array.isArray(item.lov) && item.lov.some((option) => /[,;]/.test(option.label + option.value)))
        invalid('Static LOV labels/values cannot contain comma or semicolon; use a SQL LOV.');
      if (item.sourceColumn && page.regions[regions.indexOf(item.region)]?.type !== 'form')
        invalid('sourceColumn requires a native form region.');
      if (!item.sourceColumn && (item.primaryKey !== undefined || item.dataType !== undefined))
        invalid('Form dataType/primaryKey require sourceColumn.');
      if (item.required && ['hidden', 'displayOnly'].includes(item.type))
        invalid('Hidden/display-only items cannot require editable input.');
      if (item.type === 'hidden' && item.formatMask)
        invalid('Hidden items cannot have a display format mask.');
    });
    page.buttons?.forEach((button) => {
      requireRegion(button.region);
      if (button.action === 'redirectToPage' && !button.target) invalid('Redirect buttons require target.');
      if (button.action === 'submitPage' && button.target) invalid('Submit buttons cannot have a target.');
      checkTarget(button.target);
    });
    for (const value of [...(page.processes ?? []), ...(page.validations ?? []), ...(page.branches ?? [])])
      if (value.button && !buttons.includes(value.button))
        invalid(`Unknown page ${page.id} button ${value.button}.`);
    page.validations?.forEach((validation) => {
      if (validation.item) requireItem(validation.item);
    });
    page.branches?.forEach((branch) => checkTarget(branch.target));
    page.refreshes?.forEach((refresh) => {
      refresh.items.forEach(requireItem);
      refresh.regions.forEach(requireRegion);
      for (const id of refresh.regions) {
        const region = page.regions[regions.indexOf(id)]!;
        const sources = region.type === 'chart' ? region.series : 'sql' in region ? [region] : [];
        if (
          !sources.length ||
          sources.some((source) => refresh.items.some((item) => !source.itemsToSubmit?.includes(item)))
        )
          invalid(`Refresh region ${id} must submit every triggering item on every query/series.`);
      }
    });
    for (const region of page.regions) {
      if ('link' in region) checkTarget(region.link);
      if ('columns' in region)
        region.columns.forEach((column) => {
          checkTarget(column.link);
          if (column.linkText !== undefined && !column.link) invalid('Column linkText requires a link.');
        });
      if (region.type === 'classicReport' && region.link)
        invalid('Classic report links belong to individual columns.');
      if (region.type === 'chart') region.series.forEach((series) => checkTarget(series.link));
      if ('columns' in region)
        unique(
          region.columns.map((column) => column.name),
          'Report columns',
        );
      if (region.type === 'chart')
        unique(
          region.series.map((series, i) => series.id ?? `s${i + 1}`),
          'Series IDs',
        );
      for (const source of region.type === 'chart' ? region.series : 'sql' in region ? [region] : [])
        source.itemsToSubmit?.forEach(requireItem);
      if (region.type === 'cards' && region.link && !region.keyColumn)
        invalid('Linked cards require a keyColumn.');
      if (region.type === 'calendar' && region.link && !region.keyColumn)
        invalid('Linked calendars require a keyColumn.');
    }
  }
}

export function pageGuards(page: ScaffoldPage) {
  return guards(page, undefined, 'pageAccessProtection: argumentsMustHaveChecksum').map(indent).join('\n');
}
