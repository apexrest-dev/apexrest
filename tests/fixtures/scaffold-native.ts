/** Synthetic, schema-independent authoring input; no business tables or persistent DDL. */
export const nativeScaffoldSpec = {
  applicationName: 'Operations Console',
  applicationProcesses: [
    { id: 'prepare-request', authorizationScheme: 'administration-rights', plsql: 'begin null; end;' },
  ],
  pages: [
    {
      id: 1,
      name: 'Overview',
      regions: [
        {
          id: 'totals',
          type: 'cards',
          name: 'Summary',
          sql: "select 1 ID, 'Open work' TITLE, '3 records' BODY from dual",
          titleColumn: 'TITLE',
          bodyColumn: 'BODY',
          keyColumn: 'ID',
          link: { page: 10 },
        },
        {
          id: 'trend',
          type: 'chart',
          chartType: 'line',
          name: 'Trend',
          xTitle: 'Day',
          yTitle: 'Count',
          series: [
            {
              name: 'Count',
              sql: "select 'Monday' LABEL, 3 VALUE from dual",
              labelColumn: 'LABEL',
              valueColumn: 'VALUE',
            },
          ],
        },
        {
          type: 'chart',
          chartType: 'pie',
          name: 'Distribution',
          series: [
            {
              name: 'Distribution',
              sql: "select 'Open' LABEL, 3 VALUE from dual",
              labelColumn: 'LABEL',
              valueColumn: 'VALUE',
            },
          ],
        },
        {
          type: 'barChart',
          name: 'Workload',
          sql: "select 'Team A' LABEL, 3 VALUE from dual",
          labelColumn: 'LABEL',
          valueColumn: 'VALUE',
          xTitle: 'Team',
          yTitle: 'Count',
        },
        {
          type: 'chart',
          chartType: 'donut',
          name: 'Categories',
          series: [
            {
              name: 'Categories',
              sql: "select 'Open' LABEL, 3 VALUE from dual",
              labelColumn: 'LABEL',
              valueColumn: 'VALUE',
            },
          ],
        },
      ],
    },
    {
      id: 10,
      name: 'Records',
      regions: [
        {
          id: 'controls',
          type: 'staticContent',
          name: 'Controls',
          html: '<p>Filter and inspect records.</p>',
        },
        {
          id: 'records',
          type: 'interactiveReport',
          name: 'Records',
          sql: "select 1 ID, 'Record' TITLE, 3 QUANTITY from dual where :P10_SEARCH is null or :P10_SEARCH = 'Record'",
          itemsToSubmit: ['P10_SEARCH'],
          columns: [
            {
              name: 'ID',
              heading: 'ID',
              dataType: 'number',
              link: { page: 20, items: { P20_ID: '#ID#' }, clearCache: [20] },
            },
            { name: 'TITLE', heading: 'Title', dataType: 'varchar2' },
            { name: 'QUANTITY', heading: 'Quantity', dataType: 'number', formatMask: 'FM9990D00' },
          ],
        },
        {
          id: 'summary',
          type: 'classicReport',
          name: 'Record summary',
          sql: "select 'Open' STATUS, 3 QUANTITY from dual",
          columns: [
            {
              name: 'STATUS',
              heading: 'Status',
              dataType: 'varchar2',
              link: { page: 20, items: { P20_ID: '#QUANTITY#' } },
            },
            { name: 'QUANTITY', heading: 'Quantity', dataType: 'number' },
          ],
        },
      ],
      items: [{ name: 'P10_SEARCH', type: 'textField', label: 'Search', region: 'controls' }],
      buttons: [
        {
          id: 'create',
          label: 'Create',
          region: 'controls',
          action: 'redirectToPage',
          target: { page: 20, clearCache: [20] },
        },
      ],
      refreshes: [{ items: ['P10_SEARCH'], regions: ['records'] }],
    },
    {
      id: 20,
      name: 'Edit record',
      navigation: false,
      regions: [{ id: 'fields', type: 'staticContent', name: 'Record fields' }],
      items: [
        { name: 'P20_ID', type: 'hidden', region: 'fields' },
        { name: 'P20_NAME', type: 'textField', label: 'Name', region: 'fields', required: true },
        {
          name: 'P20_QUANTITY',
          type: 'numberField',
          label: 'Quantity',
          region: 'fields',
          defaultValue: '1',
          formatMask: 'FM9990D00',
        },
        {
          name: 'P20_DATE',
          type: 'datePicker',
          label: 'Due date',
          region: 'fields',
          formatMask: 'YYYY-MM-DD',
        },
        {
          name: 'P20_STATE',
          type: 'selectList',
          label: 'State',
          region: 'fields',
          lov: [
            { label: 'Open', value: 'OPEN' },
            { label: 'Closed', value: 'CLOSED' },
          ],
        },
        { name: 'P20_NOTE', type: 'textarea', label: 'Note', region: 'fields' },
        { name: 'P20_RESULT', type: 'displayOnly', label: 'Result', region: 'fields' },
      ],
      buttons: [
        {
          id: 'calculate',
          label: 'Calculate',
          region: 'fields',
          confirmation: { message: 'Recalculate this draft?', style: 'warning' },
        },
        { id: 'cancel', label: 'Cancel', region: 'fields', target: { page: 10 } },
      ],
      processes: [
        {
          id: 'load-record',
          point: 'beforeHeader',
          condition: { type: 'itemIsNotNull', item: 'P20_ID' },
          plsql: "begin :P20_NAME := 'Record'; end;",
        },
        {
          id: 'calculate-record',
          button: 'calculate',
          plsql: 'begin :P20_RESULT := to_char(to_number(:P20_QUANTITY) * 2); end;',
          successMessage: 'Draft calculated.',
        },
      ],
      validations: [
        {
          id: 'positive-quantity',
          button: 'calculate',
          item: 'P20_QUANTITY',
          errorMessage: 'Enter a positive quantity.',
          plsql: 'begin return to_number(:P20_QUANTITY) > 0; end;',
        },
      ],
      branches: [{ id: 'return-records', button: 'calculate', target: { page: 10 } }],
    },
    {
      id: 30,
      name: 'Schedule',
      regions: [
        {
          id: 'schedule',
          type: 'calendar',
          name: 'Schedule',
          sql: "select 1 ID, 'Planning' TITLE, date '2027-03-01' START_DATE, date '2027-03-02' END_DATE from dual",
          displayColumn: 'TITLE',
          startDateColumn: 'START_DATE',
          endDateColumn: 'END_DATE',
          keyColumn: 'ID',
          initialDate: '2027-03-01',
          link: { page: 20, items: { P20_ID: '&ID.' }, clearCache: [20] },
        },
      ],
    },
    {
      id: 40,
      name: 'Record detail',
      regions: [
        { id: 'detail', type: 'form', name: 'Record detail', sql: "select 1 ID, 'Record' TITLE from dual" },
      ],
      items: [
        {
          name: 'P40_ID',
          type: 'hidden',
          region: 'detail',
          sourceColumn: 'ID',
          dataType: 'number',
          primaryKey: true,
        },
        { name: 'P40_TITLE', type: 'displayOnly', region: 'detail', sourceColumn: 'TITLE' },
      ],
    },
  ],
};
