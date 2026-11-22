import test from 'node:test';
import assert from 'node:assert/strict';
import { scaffoldSchema } from '../../packages/core/src/scaffold-spec.ts';
import { renderPageBody, validateSpec } from '../../packages/core/src/scaffold-renderer.ts';
import { parseApexLang } from '../../packages/core/src/preview/apexlang.ts';

const formPage = {
  id: 41,
  name: 'Customer',
  mode: 'modalDialog',
  authorizationScheme: 'administration-rights',
  regions: [
    {
      id: 'customer-form',
      name: 'Customer',
      type: 'form',
      table: 'APEXREST_CUSTOMERS',
      edit: { operations: ['add', 'update', 'delete'] },
    },
  ],
  items: [
    {
      name: 'P41_ID',
      type: 'hidden',
      region: 'customer-form',
      sourceColumn: 'ID',
      dataType: 'number',
      primaryKey: true,
    },
    { name: 'P41_NAME', type: 'textField', label: 'Name', region: 'customer-form', sourceColumn: 'NAME' },
  ],
};
const gridPage = {
  id: 42,
  name: 'Notes',
  authorizationScheme: 'administration-rights',
  regions: [
    {
      id: 'customers-grid',
      name: 'Customers',
      type: 'interactiveGrid',
      table: 'APEXREST_CUSTOMERS',
      columns: [
        { name: 'ID', dataType: 'number', primaryKey: true, hidden: true },
        { name: 'NAME', heading: 'Name', dataType: 'varchar2' },
      ],
    },
    {
      id: 'notes-grid',
      name: 'Notes',
      type: 'interactiveGrid',
      table: 'APEXREST_CUSTOMER_NOTES',
      master: 'customers-grid',
      edit: { operations: ['add', 'update'], rowVersionColumn: 'ROW_VERSION' },
      columns: [
        { name: 'ID', dataType: 'number', primaryKey: true, hidden: true },
        { name: 'CUSTOMER_ID', dataType: 'number', hidden: true, masterColumn: 'ID' },
        { name: 'NOTE', heading: 'Note', dataType: 'varchar2' },
        { name: 'ROW_VERSION', dataType: 'number', hidden: true, queryOnly: true },
      ],
    },
  ],
};
const facetPage = {
  id: 43,
  name: 'Search',
  regions: [
    {
      id: 'facets',
      name: 'Filters',
      type: 'facetedSearch',
      filteredRegion: 'results',
      facets: [
        { item: 'P43_SEARCH', type: 'search', label: 'Search', columns: ['NAME', 'EMAIL'] },
        { item: 'P43_STATUS', type: 'checkboxGroup', label: 'Status', columns: ['STATUS'] },
      ],
    },
    {
      id: 'results',
      name: 'Customers',
      type: 'classicReport',
      sql: 'select id, name, email, status from apexrest_customers',
      columns: ['ID', 'NAME', 'EMAIL', 'STATUS'].map((name) => ({
        name,
        heading: name,
        dataType: 'varchar2',
      })),
      refreshOnDialogClose: true,
    },
  ],
};

const spec = (...pages: unknown[]) => scaffoldSchema.parse({ pages });
const body = (page: unknown) => {
  const parsed = spec(page);
  validateSpec(parsed);
  const text = renderPageBody(parsed.pages[0]!, '26.2');
  return {
    text,
    nodes: parseApexLang(`page ${parsed.pages[0]!.id} (\n${text}\n)\n`, 'page.apx')[0]!.children,
  };
};

test('a modal editable form gets native DML buttons, row processing, close and cancel together', () => {
  const { text, nodes } = body(formPage);
  assert.match(text, /slot: contentBody/u);
  assert.match(text, /tableName: APEXREST_CUSTOMERS/u);
  assert.match(text, /enabled: true[\s\S]*lostUpdateType: rowValues/u);
  const buttons = nodes.filter((node) => node.type === 'button').map((node) => node.id);
  assert.deepEqual(buttons, [
    'cancel-customer-form',
    'delete-customer-form',
    'save-customer-form',
    'create-customer-form',
  ]);
  const processes = nodes.filter((node) => node.type === 'process').map((node) => node.props.type);
  assert.deepEqual(processes, ['formInitialization', 'formAutoRowProcessing', 'closeDialog']);
  assert.ok(nodes.some((node) => node.type === 'dynamicAction' && node.id === 'cancel-customer-form'));
  // The key stays query-only; edited columns are written.
  const name = nodes.find((node) => node.id === 'P41_NAME')!;
  assert.equal((name.props.source as Record<string, unknown>).queryOnly, undefined);
  assert.equal(
    (nodes.find((node) => node.id === 'P41_ID')!.props.source as Record<string, unknown>).queryOnly,
    true,
  );
  // Rendering is deterministic: the same spec gives the same source.
  assert.equal(body(formPage).text, text);
});

test('a master-detail grid binds the detail to its master and saves with a row version', () => {
  const { text, nodes } = body(gridPage);
  assert.match(text, /masterRegion: @customers-grid/u);
  assert.match(text, /masterColumn: @ID/u);
  assert.match(text, /lostUpdateType: rowVersionColumn\s+rowVersionColumn: ROW_VERSION/u);
  assert.match(text, /valueIdentifiesRow: true/u);
  // Each grid has a full toolbar; only the editable one has Save.
  assert.equal(text.match(/controls: \[/gu)?.length, 2);
  assert.equal(text.match(/saveButton/gu)?.length, 1);
  const saves = nodes.filter((node) => node.type === 'process').map((node) => node.id);
  assert.deepEqual(saves, ['save-notes-grid']);
});

test('a faceted search filters its report, and dialog closes refresh the report', () => {
  const { text, nodes } = body(facetPage);
  assert.match(text, /filteredRegion: @results/u);
  assert.match(text, /dbColumns: NAME,EMAIL/u);
  assert.match(text, /type: distinctValues[\s\S]*databaseColumn: STATUS/u);
  const refresh = nodes.find((node) => node.type === 'dynamicAction' && node.id === 'dialog-closed-results');
  assert.ok(refresh);
});

test('recipe write contracts and references are checked before rendering', () => {
  const refuse = (page: unknown, pattern: RegExp) =>
    assert.throws(
      () => validateSpec(spec(page)),
      (error: Error) => pattern.test(error.message),
    );
  refuse({ ...formPage, authorizationScheme: undefined }, /authorizationScheme/u);
  refuse({ ...formPage, items: formPage.items.slice(1) }, /exactly one primaryKey item/u);
  refuse(
    { ...formPage, regions: [{ ...formPage.regions[0], sql: 'select 1 from dual' }] },
    /exactly one of sql or table/u,
  );
  refuse(
    {
      ...gridPage,
      regions: [
        gridPage.regions[0],
        {
          ...gridPage.regions[1],
          columns: gridPage.regions[1]!.columns.map((column) =>
            'masterColumn' in column ? { ...column, masterColumn: 'MISSING' } : column,
          ),
        },
      ],
    },
    /unknown master column MISSING/u,
  );
  refuse({ ...gridPage, regions: [gridPage.regions[1]] }, /master must be another interactive grid/u);
  refuse(
    {
      ...facetPage,
      regions: [
        {
          ...facetPage.regions[0],
          facets: [{ item: 'P43_CITY', type: 'checkboxGroup', label: 'City', columns: ['CITY'] }],
        },
        facetPage.regions[1],
      ],
    },
    /uses CITY/u,
  );
  refuse(
    {
      ...facetPage,
      regions: [
        {
          ...facetPage.regions[0],
          facets: [{ item: 'P43_STATUS', type: 'radioGroup', label: 'S', columns: ['STATUS', 'NAME'] }],
        },
        facetPage.regions[1],
      ],
    },
    /filters exactly one column/u,
  );
});
