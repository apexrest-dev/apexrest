import { z } from 'zod';

const text = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .regex(/^[^\x00-\x1f\x7f]+$/);
const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,127}$/);
const item = z.string().regex(/^P\d+_[A-Z][A-Z0-9_]{0,100}$/);
const column = z.string().regex(/^[A-Z][A-Z0-9_$#]{0,127}$/);
const literal = z
  .string()
  .max(4000)
  .regex(/^[^\x00-\x1f\x7f]*$/);
const code = z
  .string()
  .trim()
  .min(1)
  .max(64000)
  .refine(
    (v) => !v.includes('```') && !/[\x00\r]/.test(v),
    'Code cannot contain APEXlang fence delimiters or control characters',
  );
const sql = code.refine((v) => /^(select|with)\b/i.test(v), 'Supply a SELECT query');
export const scaffoldTarget = z.strictObject({
  page: z.number().int().min(1).max(9999),
  items: z.record(item, literal).optional(),
  clearCache: z.array(z.number().int().min(1).max(9999)).max(30).optional(),
});
const condition = z.discriminatedUnion('type', [
  z.strictObject({ type: z.enum(['always', 'never', 'userIsAuthenticated', 'userIsPublicUser']) }),
  z.strictObject({ type: z.enum(['itemIsNull', 'itemIsNotNull']), item }),
  z.strictObject({ type: z.enum(['item=value', 'item!=value']), item, value: literal }),
  z.strictObject({ type: z.enum(['request=Value', 'request!=Value']), value: literal }),
  z.strictObject({ type: z.literal('expression'), plsqlExpression: code }),
]);
const guards = {
  condition: condition.optional(),
  authorizationScheme: id.optional(),
  buildOption: id.optional(),
};
const query = { sql, itemsToSubmit: z.array(item).max(100).optional() };
const region = { id: id.optional(), name: text, ...guards };
const reportColumn = z.strictObject({
  name: column,
  heading: text,
  dataType: z.enum(['varchar2', 'number', 'date', 'timestamp']),
  formatMask: text.optional(),
  link: scaffoldTarget.optional(),
  linkText: literal.optional(),
});
const table = column;
/**
 * Write contract of an editable form or grid: the allowed DML operations and lost-update detection
 * (a row version column, or APEX's row-value checksum when omitted). Editable regions also need an
 * authorization scheme on the region or page; APEX native DML runs in the page submit transaction.
 */
const edit = z.strictObject({
  operations: z
    .array(z.enum(['add', 'update', 'delete']))
    .min(1)
    .max(3),
  rowVersionColumn: column.optional(),
});
const gridColumn = z.strictObject({
  name: column,
  heading: text.optional(),
  dataType: z.enum(['varchar2', 'number', 'date', 'timestamp']),
  primaryKey: z.boolean().optional(),
  hidden: z.boolean().optional(),
  queryOnly: z.boolean().optional(),
  /** Detail grids: the master grid column this column joins to. */
  masterColumn: column.optional(),
});
const reportExtras = { refreshOnDialogClose: z.boolean().optional() };
const regions = z.discriminatedUnion('type', [
  z.strictObject({
    ...region,
    ...query,
    type: z.enum(['interactiveReport', 'classicReport']),
    columns: z.array(reportColumn).min(1).max(100),
    emptyMessage: text.optional(),
    link: scaffoldTarget.optional(),
    ...reportExtras,
  }),
  z.strictObject({
    ...region,
    ...query,
    type: z.literal('cards'),
    titleColumn: column,
    bodyColumn: column,
    keyColumn: column.optional(),
    link: scaffoldTarget.optional(),
    ...reportExtras,
  }),
  z.strictObject({
    ...region,
    ...query,
    type: z.literal('barChart'),
    labelColumn: column,
    valueColumn: column,
    xTitle: text,
    yTitle: text,
  }),
  z.strictObject({
    ...region,
    type: z.literal('chart'),
    chartType: z.enum(['bar', 'line', 'pie', 'donut']),
    series: z
      .array(
        z.strictObject({
          ...query,
          id: id.optional(),
          name: text,
          labelColumn: column,
          valueColumn: column,
          link: scaffoldTarget.optional(),
        }),
      )
      .min(1)
      .max(12),
    xTitle: text.optional(),
    yTitle: text.optional(),
  }),
  z.strictObject({
    ...region,
    ...query,
    type: z.literal('calendar'),
    displayColumn: column,
    startDateColumn: column,
    endDateColumn: column.optional(),
    keyColumn: column.optional(),
    showTime: z.boolean().optional(),
    initialDate: z.iso.date().optional(),
    link: scaffoldTarget.optional(),
  }),
  z.strictObject({
    ...region,
    type: z.literal('form'),
    sql: sql.optional(),
    itemsToSubmit: z.array(item).max(100).optional(),
    table: table.optional(),
    edit: edit.optional(),
  }),
  z.strictObject({
    ...region,
    type: z.literal('interactiveGrid'),
    table,
    columns: z.array(gridColumn).min(1).max(100),
    edit: edit.optional(),
    /** Detail grid of a master-detail page: the master grid region on the same page. */
    master: id.optional(),
  }),
  z.strictObject({
    ...region,
    type: z.literal('facetedSearch'),
    filteredRegion: id,
    facets: z
      .array(
        z.strictObject({
          item,
          type: z.enum(['search', 'checkboxGroup', 'radioGroup']),
          label: text,
          columns: z.array(column).min(1).max(20),
        }),
      )
      .min(1)
      .max(20),
  }),
  z.strictObject({ ...region, type: z.literal('staticContent'), html: code.optional() }),
]);
const processFields = {
  id,
  plsql: code,
  point: z.enum(['beforeHeader', 'afterSubmit', 'processing', 'ajaxCallback']).optional(),
  sequence: z.number().int().min(1).max(9999).optional(),
  ...guards,
  successMessage: text.optional(),
};
const pageProcess = z.strictObject({ ...processFields, button: id.optional() });
export const scaffoldSchema = z.strictObject({
  applicationName: text.optional(),
  applicationProcesses: z
    .array(z.strictObject(processFields).omit({ successMessage: true }))
    .max(100)
    .optional(),
  pages: z
    .array(
      z.strictObject({
        id: z.number().int().min(1).max(9998),
        name: text,
        alias: id.optional(),
        /** modalDialog pages leave the navigation menu unless navigation is true. */
        mode: z.enum(['normal', 'modalDialog']).optional(),
        navigation: z.boolean().optional(),
        ...guards,
        regions: z.array(regions).min(1).max(30),
        items: z
          .array(
            z.strictObject({
              name: item,
              type: z.enum([
                'selectList',
                'datePicker',
                'numberField',
                'textField',
                'textarea',
                'hidden',
                'displayOnly',
              ]),
              region: id,
              label: text.optional(),
              required: z.boolean().optional(),
              defaultValue: literal.optional(),
              formatMask: text.optional(),
              sourceColumn: column.optional(),
              dataType: z.enum(['varchar2', 'number', 'date', 'timestamp']).optional(),
              primaryKey: z.boolean().optional(),
              lov: z
                .union([
                  z
                    .array(z.strictObject({ label: text, value: literal }))
                    .min(1)
                    .max(100),
                  z.strictObject({ sql }),
                ])
                .optional(),
              ...guards,
            }),
          )
          .max(100)
          .optional(),
        buttons: z
          .array(
            z.strictObject({
              id,
              label: text,
              region: id,
              action: z.enum(['submitPage', 'redirectToPage']).optional(),
              target: scaffoldTarget.optional(),
              confirmation: z
                .strictObject({
                  message: text,
                  style: z.enum(['information', 'warning', 'danger']).optional(),
                })
                .optional(),
              ...guards,
            }),
          )
          .max(100)
          .optional(),
        processes: z.array(pageProcess).max(100).optional(),
        validations: z
          .array(
            z.strictObject({
              id,
              plsql: code,
              errorMessage: text,
              item: item.optional(),
              button: id.optional(),
              ...guards,
            }),
          )
          .max(100)
          .optional(),
        branches: z
          .array(z.strictObject({ id, target: scaffoldTarget, button: id.optional(), ...guards }))
          .max(100)
          .optional(),
        refreshes: z
          .array(
            z.strictObject({ items: z.array(item).min(1).max(100), regions: z.array(id).min(1).max(30) }),
          )
          .max(30)
          .optional(),
      }),
    )
    .min(1)
    .max(30),
});
export type ScaffoldSpec = z.infer<typeof scaffoldSchema>;
export type ScaffoldPage = ScaffoldSpec['pages'][number];
export type ScaffoldRegion = ScaffoldPage['regions'][number];
export type ScaffoldProcess = NonNullable<ScaffoldPage['processes']>[number];
export type ScaffoldTarget = z.infer<typeof scaffoldTarget>;
