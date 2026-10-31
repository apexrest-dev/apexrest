import { get, isRef, list, num, ref, str, type ApxComponent } from '../../apexlang.ts';
import type { Binds, Row } from '../../database.ts';
import type { ApexError, ApexRenderer, RenderContext } from '../../render.ts';
import { authorizeExtensions } from '../../extensions.ts';
import { escapeHtml } from '../../theme.ts';
import { aggregateText, aggregateValue, emptyViews, gridViews, highlightRow } from './ir-views.ts';
import {
  applyFiltersAndSort,
  bySequence,
  Cells,
  columnRef,
  compareValues,
  diagnoseSavedReport,
  filterLabel,
  findRegion,
  primarySavedReport,
  regionColumns,
  reportState,
  rowLimit,
  savedFilters,
  savedSorts,
  stateKey,
  stringList,
  type GridChange,
  type ReportState,
} from './shared.ts';

/** Column item types that edit a value; everything else is display only. */
const EDITORS: Record<string, string> = {
  textField: 'text',
  textFieldWithAutocomplete: 'text',
  autoComplete: 'text',
  numberField: 'number',
  textarea: 'textarea',
  richTextEditor: 'textarea',
  markdownEditor: 'textarea',
  selectList: 'select',
  selectOne: 'select',
  combobox: 'select',
  radioGroup: 'radio',
  checkboxGroup: 'checkboxGroup',
  popupLov: 'popupLov',
  datePicker: 'date',
  datePickerApex: 'date',
  datePickerJquery: 'date',
  datePickerHtml: 'date',
  checkbox: 'checkbox',
  singleCheckbox: 'checkbox',
  switch: 'switch',
  yesNo: 'switch',
  password: 'password',
  colorPicker: 'color',
  starRating: 'stars',
};

/** Editors that need a small apex.item implementation in the browser. */
const CUSTOM_EDITORS = new Set(['popupLov', 'checkbox', 'switch', 'stars', 'date']);

const DISPLAY_TYPES = new Set([
  'displayOnly',
  'htmlExpression',
  'link',
  'hidden',
  'percentGraph',
  'rowSelector',
  'actionsMenu',
]);

export const GRID_DOWNLOAD_FORMATS = ['csv', 'html', 'excel', 'pdf'];

export const ROW_ID = 'APEX$ROWID';

export interface GridColumn {
  name: string;
  component: ApxComponent;
  type: string;
  databaseColumn?: string;
  primaryKey: boolean;
  hidden: boolean;
  editor?: string;
  masterColumn?: string;
}

export interface GridModel {
  region: ApxComponent;
  domId: string;
  state: ReportState;
  cells: Cells;
  columns: GridColumn[];
  byName: Map<string, GridColumn>;
  identity: string[];
  table?: string;
  rows: Row[];
  error?: string;
  editable: boolean;
  allowed: { add: boolean; update: boolean; delete: boolean };
  master?: { region: ApxComponent; row?: Row };
  /** Enabled control break columns, outermost first. */
  breaks: GridColumn[];
}

/**
 * Edit authorization follows the preview's authorization policy: schemes are evaluated and
 * reported by the server extension, and only deny when developer tools enforce them ("view as").
 */
export function authorizationAllows(renderer: ApexRenderer, ctx: RenderContext, value: unknown): boolean {
  const name = isRef(value as never)
    ? (value as { ref: string }).ref
    : typeof value === 'string'
      ? value
      : '';
  return !name || authorizeExtensions(renderer, ctx, name) !== false;
}

/** Allowed grid operations after `editAuthorization` schemes are evaluated. */
function editOperations(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  ops: string[],
): { add: boolean; update: boolean; delete: boolean } {
  const allowed = {
    add: ops.includes('add'),
    update: ops.includes('update'),
    delete: ops.includes('delete'),
  };
  for (const op of ['add', 'update', 'delete'] as const) {
    const scheme = get(region.props, `editAuthorization.${op}`);
    if (!allowed[op] || scheme === undefined) continue;
    if (!authorizationAllows(renderer, ctx, scheme)) {
      allowed[op] = false;
      renderer.diagnose(
        'info',
        `Interactive Grid ${region.id}: edit authorization denies ${op} for ${ctx.session.user} locally`,
        ctx.pageId,
        region.id,
      );
    }
  }
  return allowed;
}

export function igState(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): ReportState {
  return reportState(ctx.session, stateKey(ctx.pageId, region.id), () => {
    const saved = primarySavedReport(region);
    const rowsPerPage = num(saved?.props ?? {}, 'view.rowsPerPage', 0);
    const hidden = (saved?.children ?? [])
      .filter((child) => child.type === 'displayColumn')
      .filter((child) => get(child.props, 'layout.show') === false)
      .map(columnRef);
    const shown = bySequence(
      (saved?.children ?? []).filter(
        (child) => child.type === 'displayColumn' && get(child.props, 'layout.show') !== false,
      ),
    ).map(columnRef);
    return {
      filters: savedFilters(renderer, ctx, region, saved),
      sort: savedSorts(saved),
      ...(rowsPerPage ? { rowsPerPage } : {}),
      ...(shown.length || hidden.length ? { columns: shown } : {}),
      views: gridViews(renderer, ctx, region, saved),
    };
  });
}

/** Table targeted by row processing: `source.tableName` or a single-table SQL query. */
export function dmlTable(region: ApxComponent): string | undefined {
  const table = str(region.props, 'source.tableName');
  if (table) return table;
  const sql = str(region.props, 'source.sqlQuery');
  const match = /\bfrom\s+("?[\w$#]+"?(?:\."?[\w$#]+"?)?)(\s+\w+)?\s*(where\b|order\b|$)/iu.exec(sql.trim());
  return match && !/\bjoin\b|,/iu.test(sql.slice(match.index, match.index + match[0].length))
    ? match[1]!.replaceAll('"', '')
    : undefined;
}

function columnDefinitions(region: ApxComponent, resultColumns: string[]): GridColumn[] {
  return regionColumns(region, resultColumns).map((component) => {
    const name = component.id.toUpperCase();
    const type = str(component.props, 'type', 'textField');
    const special = /^APEX\$/u.test(name);
    const queryOnly = get(component.props, 'source.queryOnly') === true;
    const sourceType = str(component.props, 'source.type', 'databaseColumn');
    const databaseColumn =
      special || queryOnly || sourceType !== 'databaseColumn'
        ? undefined
        : str(component.props, 'source.databaseColumn', name).toUpperCase();
    const editor = EDITORS[type];
    return {
      name,
      component,
      type,
      ...(databaseColumn ? { databaseColumn } : {}),
      primaryKey: get(component.props, 'source.primaryKey') === true,
      hidden: type === 'hidden',
      ...(editor && databaseColumn && get(component.props, 'readOnly.type') !== 'always' ? { editor } : {}),
      ...(ref(component.props, 'masterDetail.masterColumn')
        ? { masterColumn: ref(component.props, 'masterDetail.masterColumn')!.toUpperCase() }
        : {}),
    };
  });
}

function identityOf(row: Row, identity: string[]): string {
  return identity
    .map((name) => (row[name] === null || row[name] === undefined ? '' : String(row[name])))
    .join('|');
}

/** Data, columns and identity of an interactive grid for the session's state (master-detail aware). */
export function gridModel(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  depth = 0,
): GridModel {
  const state = igState(renderer, ctx, region);
  const cells = new Cells(renderer, ctx, region);
  const domId = renderer.regionDomId(region);
  let sql = renderer.regionSql(ctx, region);
  const declared = region.children.filter((child) => child.type === 'column');
  const hasKey = declared.some((column) => get(column.props, 'source.primaryKey') === true);
  const table = dmlTable(region);
  if (sql && !hasKey && str(region.props, 'source.tableName')) {
    // Without a declared key the grid uses ROWID, like APEX does for tables without primary keys.
    const where = str(region.props, 'source.whereClause') || str(region.props, 'source.where');
    const orderBy = str(region.props, 'source.orderByClause') || str(region.props, 'source.orderBy');
    sql = `select rowid as "${ROW_ID}", t.* from ${table} t`;
    if (where) sql = `select * from (${sql}) where ${where}`;
    if (orderBy) sql = `${sql} order by ${orderBy}`;
  }
  const edit = get(region.props, 'edit.enabled') === true;
  const operations = stringList(list(region.props, 'edit.allowedOperations'));
  const ops = operations.length ? operations : ['add', 'update', 'delete'];
  const result = sql
    ? renderer.query(ctx, region, sql, rowLimit(region, 10_000))
    : { columns: [], rows: [], error: 'no local source' };
  const columns = columnDefinitions(
    region,
    result.columns.filter((name) => name !== ROW_ID),
  );
  const identity = hasKey
    ? columns.filter((column) => column.primaryKey).map((column) => column.name)
    : result.columns.includes(ROW_ID)
      ? [ROW_ID]
      : [];
  const byName = new Map(columns.map((column) => [column.name, column]));
  const visibleColumns = columns.filter((column) => !column.hidden && !/^APEX\$/u.test(column.name));
  let rows = applyFiltersAndSort(
    result.rows,
    cells,
    new Map(columns.map((column) => [column.name, column.component])),
    visibleColumns.map((column) => column.component),
    state.filters,
    state.sort,
  );
  const views = (state.views ??= emptyViews());
  const breaks = views.breaks
    .filter((entry) => entry.enabled && byName.has(entry.column))
    .map((entry) => byName.get(entry.column)!);
  if (breaks.length) {
    const indexed = rows.map((row, index) => ({ row, index }));
    indexed.sort((a, b) => {
      for (const column of breaks) {
        const lov = cells.lov(column.component);
        const left = lov ? cells.text(column.component, a.row) : a.row[column.name];
        const right = lov ? cells.text(column.component, b.row) : b.row[column.name];
        const empty = (value: unknown) => value === null || value === undefined || value === '';
        if (empty(left) || empty(right)) {
          if (empty(left) && empty(right)) continue;
          return empty(left) ? 1 : -1;
        }
        const compared = compareValues(left, right);
        if (compared) return compared;
      }
      return a.index - b.index;
    });
    rows = indexed.map((entry) => entry.row);
  }
  let master: GridModel['master'];
  const masterId = ref(region.props, 'masterDetail.masterRegion');
  const masterRegion = masterId ? findRegion(renderer, ctx, masterId) : undefined;
  if (masterRegion && depth < 5) {
    const masterModel =
      str(masterRegion.props, 'type') === 'interactiveGrid'
        ? gridModel(renderer, ctx, masterRegion, depth + 1)
        : undefined;
    const selected = masterModel
      ? (masterModel.rows.find(
          (row) => identityOf(row, masterModel.identity) === masterModel.state.selected,
        ) ?? masterModel.rows[0])
      : undefined;
    master = { region: masterRegion, ...(selected ? { row: selected } : {}) };
    const links = columns.filter((column) => column.masterColumn);
    rows = selected
      ? rows.filter((row) =>
          links.every(
            (column) => String(row[column.name] ?? '') === String(selected[column.masterColumn!] ?? ''),
          ),
        )
      : [];
  }
  return {
    region,
    domId,
    state,
    cells,
    columns,
    byName,
    identity,
    ...(table ? { table } : {}),
    rows,
    ...(result.error ? { error: result.error } : {}),
    editable: edit && identity.length > 0,
    allowed: edit ? editOperations(renderer, ctx, region, ops) : { add: false, update: false, delete: false },
    ...(master ? { master } : {}),
    breaks,
  };
}

function diagnoseGrid(renderer: ApexRenderer, ctx: RenderContext, model: GridModel): void {
  const { region } = model;
  const note = (message: string) => renderer.diagnose('info', message, ctx.pageId, region.id);
  if (get(region.props, 'edit.enabled') === true && !model.identity.length)
    note(`Interactive Grid ${region.id} has no primary key or table ROWID; it is shown read-only`);
  for (const column of model.columns) {
    if (/^APEX\$/u.test(column.name) || column.editor || DISPLAY_TYPES.has(column.type)) continue;
    note(`Interactive Grid column ${region.id}.${column.name} of type ${column.type} is shown as text`);
  }
  if (str(region.props, 'edit.lostUpdateType') === 'rowVersionColumn')
    note(`Interactive Grid ${region.id}: lost update detection is not simulated`);
  if (get(region.props, 'edit.allowedRowOperationsColumn') !== undefined)
    note(`Interactive Grid ${region.id}: allowed row operations column is not simulated`);
  const formats = stringList(list(region.props, 'download.formats'));
  const other = formats.filter((format) => !GRID_DOWNLOAD_FORMATS.includes(format));
  if (other.length)
    note(`Interactive Grid ${region.id}: download formats ${other.join(', ')} are not simulated`);
  if (formats.includes('pdf'))
    note(`Interactive Grid ${region.id}: PDF download is a print-friendly HTML page locally`);
  for (const column of model.columns)
    if (column.type === 'popupLov' && column.editor)
      note(`Interactive Grid column ${region.id}.${column.name}: popup LOV is a local search dialog`);
    else if ((column.type === 'richTextEditor' || column.type === 'markdownEditor') && column.editor)
      note(`Interactive Grid column ${region.id}.${column.name}: ${column.type} is edited as a text area`);
  if (str(region.props, 'heading.fixedTo') === 'region')
    note(`Interactive Grid ${region.id}: fixed report height is not simulated`);
  for (const column of model.columns) {
    if (get(column.component.props, 'cascadingLov.parentColumns') !== undefined)
      note(`Interactive Grid column ${region.id}.${column.name}: cascading LOV is not simulated`);
    if (
      get(column.component.props, 'readOnly.type') !== undefined &&
      get(column.component.props, 'readOnly.type') !== 'always'
    )
      note(`Interactive Grid column ${region.id}.${column.name}: conditional read-only is not simulated`);
  }
}

const VISUAL_TYPES = new Set([
  'starRating',
  'colorPicker',
  'checkbox',
  'singleCheckbox',
  'switch',
  'yesNo',
  'richTextEditor',
]);

/** Columns whose cells are markup (links, HTML expressions, stars, swatches, check marks). */
function isMarkup(column: GridColumn): boolean {
  const props = column.component.props;
  return (
    column.type === 'link' ||
    column.type === 'htmlExpression' ||
    VISUAL_TYPES.has(column.type) ||
    get(props, 'link.target') !== undefined ||
    str(props, 'columnFormatting.htmlExpression') !== '' ||
    str(props, 'settings.htmlExpression') !== ''
  );
}

/** On/off values and labels of checkbox and switch columns. */
function switchValues(column: GridColumn) {
  const props = column.component.props;
  const checkbox = column.editor === 'checkbox' || /checkbox/iu.test(column.type);
  return {
    on: str(props, 'settings.checkedValue', str(props, 'settings.onValue', 'Y')),
    off: str(props, 'settings.uncheckedValue', str(props, 'settings.offValue', 'N')),
    onLabel: str(props, 'settings.onLabel', checkbox ? 'Checked' : 'On'),
    offLabel: str(props, 'settings.offLabel', checkbox ? 'Unchecked' : 'Off'),
  };
}

const starCount = (column: GridColumn) =>
  Math.max(1, num(column.component.props, 'settings.numberOfStars', 5));

/** Display markup of the visual column types, shared with the browser item implementations. */
export function visualDisplay(column: GridColumn, value: string): string {
  switch (column.type) {
    case 'starRating': {
      const max = starCount(column);
      const count = Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
      return `<span class="apex-local-stars" role="img" aria-label="${count} of ${max}">${'<span class="fa fa-star is-active" aria-hidden="true"></span>'.repeat(count)}${'<span class="fa fa-star" aria-hidden="true"></span>'.repeat(max - count)}</span>`;
    }
    case 'colorPicker':
      return value
        ? `<span class="apex-local-swatch" style="background-color:${escapeHtml(value)}" aria-hidden="true"></span> ${escapeHtml(value)}`
        : '';
    case 'richTextEditor':
      // Rendered like APEX does, without scripts or event handlers.
      return value
        .replace(/<(script|style|iframe)[\s\S]*?<\/\1>/giu, '')
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/giu, '');
    default: {
      const values = switchValues(column);
      const on = value === values.on;
      return `<span class="apex-local-check${on ? ' is-checked' : ''}" role="img" aria-label="${escapeHtml(on ? values.onLabel : values.offLabel)}"><span class="fa ${on ? 'fa-check-square-o' : 'fa-square-o'}" aria-hidden="true"></span></span>`;
    }
  }
}

/** Value sent to the client model: raw value, or `{ v, d }` when the display differs. */
function modelValue(model: GridModel, column: GridColumn, row: Row, trigger: string) {
  const raw = row[column.name];
  const value = raw === null || raw === undefined ? '' : String(raw);
  if (VISUAL_TYPES.has(column.type)) return { v: value, d: visualDisplay(column, value) };
  if (isMarkup(column)) return { v: value, d: model.cells.html(column.component, row, trigger) };
  const display = model.cells.text(column.component, row);
  return display === value ? value : { v: value, d: display };
}

const alignmentName = (alignment: string) =>
  alignment === 'u-tR' ? 'end' : alignment === 'u-tC' ? 'center' : 'start';

function hasTime(column: GridColumn): boolean {
  return /HH|MI/u.test(str(column.component.props, 'appearance.formatMask'));
}

/** Column item markup: native controls apex.item understands, or containers the browser completes. */
function columnItem(model: GridModel, column: GridColumn, id: string): string {
  const props = column.component.props;
  const label = escapeHtml(model.cells.label(column.component));
  const max = num(props, 'validation.maxLength', 0);
  const required = get(props, 'validation.valueRequired') === true ? ' required' : '';
  const lov = () => [...(model.cells.lov(column.component) ?? new Map<string, string>())];
  switch (column.editor) {
    case 'select': {
      const nullOption =
        get(props, 'lov.displayNullValue') === false
          ? ''
          : `<option value="${escapeHtml(str(props, 'lov.nullReturnValue'))}">${escapeHtml(str(props, 'lov.nullDisplayValue'))}</option>`;
      return `<select id="${id}" class="selectlist apex-item-select" aria-label="${label}"${required}>${nullOption}${lov()
        .map(([value, display]) => `<option value="${escapeHtml(value)}">${escapeHtml(display)}</option>`)
        .join('')}</select>`;
    }
    case 'radio':
    case 'checkboxGroup': {
      const input = column.editor === 'radio' ? 'radio' : 'checkbox';
      return `<div id="${id}" tabindex="-1" class="${input === 'radio' ? 'radio_group apex-item-radio' : 'checkbox_group apex-item-checkbox'} apex-item-group apex-item-group--rc" role="${input === 'radio' ? 'radiogroup' : 'group'}" aria-label="${label}">${lov()
        .map(
          ([value, display], index) =>
            `<div class="apex-item-option"><input type="${input}" id="${id}_${index}" name="${id}" value="${escapeHtml(value)}"><label for="${id}_${index}">${escapeHtml(display)}</label></div>`,
        )
        .join('')}</div>`;
    }
    case 'popupLov':
      return `<div id="${id}" class="apex-local-ig-popupLov apex-item-group apex-item-group--popup-lov" aria-label="${label}"><input type="hidden" id="${id}_value"><input type="text" id="${id}_display" class="text_field apex-item-text apex-item-popup-lov" aria-label="${label}" readonly${required}><button type="button" class="a-Button a-Button--popupLOV" id="${id}_lov_btn" tabindex="-1" aria-label="List of Values" title="List of Values"><span class="a-Icon icon-popup-lov" aria-hidden="true"></span></button></div>`;
    case 'checkbox':
      return `<span id="${id}" class="apex-local-ig-check apex-item-single-checkbox"><input type="checkbox" id="${id}_input" aria-label="${label}"></span>`;
    case 'switch':
      return `<span id="${id}" class="a-Switch apex-local-ig-switch"><input type="checkbox" id="${id}_input" class="a-Switch-input" aria-label="${label}"><span class="a-Switch-toggle"></span></span>`;
    case 'stars':
      return `<div id="${id}" class="apex-local-ig-stars a-StarRating" role="radiogroup" aria-label="${label}">${Array.from(
        { length: starCount(column) },
        (_unused, index) =>
          `<button type="button" class="apex-local-ig-star" data-value="${index + 1}" aria-label="${index + 1}" tabindex="-1"><span class="fa fa-star" aria-hidden="true"></span></button>`,
      ).join(
        '',
      )}<button type="button" class="apex-local-ig-star-clear" data-value="" aria-label="Clear" title="Clear"><span class="fa fa-times-circle-o" aria-hidden="true"></span></button></div>`;
    case 'color':
      return `<input type="color" id="${id}" class="apex-item-color-picker apex-local-ig-color" aria-label="${label}">`;
    case 'textarea':
      return `<textarea id="${id}" class="textarea apex-item-textarea" rows="${column.type === 'textarea' ? 2 : 4}" aria-label="${label}"${max ? ` maxlength="${max}"` : ''}${required}></textarea>`;
    case 'number':
      return `<input type="text" id="${id}" class="number_field apex-item-text apex-item-number" inputmode="decimal" aria-label="${label}"${required}>`;
    case 'date':
      return `<input type="${hasTime(column) ? 'datetime-local' : 'date'}" id="${id}" class="datepicker apex-item-text apex-item-datepicker" aria-label="${label}"${required}>`;
    case 'password':
      return `<input type="password" id="${id}" class="password apex-item-text" aria-label="${label}"${required}>`;
    default:
      return `<input type="text" id="${id}" class="text_field apex-item-text" aria-label="${label}"${max ? ` maxlength="${max}"` : ''}${required}>`;
  }
}

/** Browser-side apex.item implementations for the custom column editors. */
function customItem(model: GridModel, column: GridColumn, id: string) {
  if (!column.editor || !CUSTOM_EDITORS.has(column.editor)) return undefined;
  const base = { id, kind: column.editor, column: column.name };
  switch (column.editor) {
    case 'popupLov':
      return {
        ...base,
        title: model.cells.label(column.component),
        lov: [...(model.cells.lov(column.component) ?? new Map<string, string>())].map(([r, d]) => ({
          r,
          d,
        })),
      };
    case 'checkbox':
    case 'switch':
      return { ...base, ...switchValues(column) };
    case 'stars':
      return { ...base, max: starCount(column) };
    default:
      return { ...base, time: hasTime(column) };
  }
}

function defaultValue(model: GridModel, column: GridColumn): string | undefined {
  const props = column.component.props;
  if (column.masterColumn && model.master?.row) {
    const value = model.master.row[column.masterColumn];
    return value === null || value === undefined ? '' : String(value);
  }
  if (str(props, 'default.type') === 'staticValue' || get(props, 'default.staticValue') !== undefined)
    return str(props, 'default.staticValue');
  return undefined;
}

const META_FIELD = 'APEX$LOCAL_META';

const AGGREGATE_NAMES: Record<string, string> = {
  sum: 'SUM',
  average: 'AVG',
  count: 'COUNT',
  countDistinct: 'COUNT_DISTINCT',
  min: 'MIN',
  max: 'MAX',
  median: 'MEDIAN',
};

/**
 * Model records with metadata: highlights (`meta.highlight`, `meta.fields[COL].highlight`),
 * control break ends and server-computed aggregate records, as the APEX grid expects them.
 */
function gridViewData(model: GridModel, fields: string[], trigger: string) {
  const views = model.state.views ?? emptyViews();
  const components = new Map(model.columns.map((column) => [column.name, column.component]));
  const highlights = views.highlights.filter((highlight) => highlight.enabled);
  const highlightOptions = Object.fromEntries(
    highlights.map((highlight, index) => [
      `h${index}`,
      {
        seq: highlight.sequence,
        row: highlight.type === 'row',
        ...(highlight.background ? { background: highlight.background } : {}),
        ...(highlight.text ? { color: highlight.text } : {}),
      },
    ]),
  );
  const aggregates = views.aggregates.filter(
    (aggregate) =>
      aggregate.enabled !== false && AGGREGATE_NAMES[aggregate.fn] && model.byName.has(aggregate.column),
  );
  const functions = [...new Set(aggregates.map((aggregate) => aggregate.fn))];
  const aggregateLabels = Object.fromEntries(
    functions.map((fn) => {
      const label =
        {
          sum: 'Sum',
          average: 'Average',
          count: 'Count',
          countDistinct: 'Count Distinct',
          min: 'Minimum',
          max: 'Maximum',
          median: 'Median',
        }[fn] ?? fn;
      return [AGGREGATE_NAMES[fn]!, { label, overallLabel: `Overall ${label}` }];
    }),
  );
  const record = (row: Row) =>
    fields.map((name) => {
      const column = model.byName.get(name);
      if (!column) return row[name] === null || row[name] === undefined ? '' : String(row[name]);
      if (/^APEX\$/u.test(name)) return '';
      return modelValue(model, column, row, trigger);
    });
  const breakKey = (row: Row) => JSON.stringify(model.breaks.map((column) => row[column.name] ?? ''));
  let counter = 0;
  const aggregateRecords = (rows: Row[], grandTotal: boolean) =>
    functions
      .filter(
        (fn) =>
          !grandTotal ||
          !model.breaks.length ||
          aggregates.some((entry) => entry.fn === fn && entry.grandTotal !== false),
      )
      .map((fn) => {
        counter += 1;
        const values = fields.map((name) => {
          if (model.identity.includes(name)) return `apex-local-agg-${counter}`;
          const aggregate = aggregates.find((entry) => entry.fn === fn && entry.column === name);
          if (!aggregate) return '';
          const column = model.byName.get(name)!;
          return aggregateText(
            fn,
            aggregateValue(
              fn,
              rows.map((row) => row[name]),
            ),
            str(column.component.props, 'appearance.formatMask'),
          );
        });
        return [...values, { agg: AGGREGATE_NAMES[fn], ...(grandTotal ? { grandTotal: true } : {}) }];
      });
  const data: unknown[][] = [];
  model.rows.forEach((row, index) => {
    const meta: {
      highlight?: string;
      fields?: Record<string, { highlight: string }>;
      endControlBreak?: boolean;
    } = {};
    highlights.forEach((highlight, position) => {
      const match = highlightRow([highlight], row, model.cells, components);
      if (match.row && !meta.highlight) meta.highlight = `h${position}`;
      for (const name of match.cells.keys()) {
        meta.fields ??= {};
        meta.fields[name] ??= { highlight: `h${position}` };
      }
    });
    const next = model.rows[index + 1];
    const endBreak = model.breaks.length > 0 && (!next || breakKey(next) !== breakKey(row));
    if (endBreak) meta.endControlBreak = true;
    data.push([...record(row), meta]);
    if (endBreak && functions.length) {
      const key = breakKey(row);
      data.push(
        ...aggregateRecords(
          model.rows.filter((candidate) => breakKey(candidate) === key),
          false,
        ),
      );
    }
  });
  if (functions.length && model.rows.length) data.push(...aggregateRecords(model.rows, true));
  return { data, highlights: highlightOptions, aggregateLabels };
}

/** Interactive grid region: genuine APEX grid + toolbar widgets over a local model. */
export function interactiveGrid(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  if (!renderer.regionSql(ctx, region))
    return `<div class="apex-local-unsupported">Interactive Grid “${escapeHtml(str(region.props, 'name', region.id))}” has no local source.</div>`;
  const model = gridModel(renderer, ctx, region);
  if (model.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(model.error)}</div></div>`;
  diagnoseGrid(renderer, ctx, model);
  diagnoseSavedReport(renderer, ctx, region, primarySavedReport(region), {
    children: new Set(['aggregate', 'controlBreak', 'highlight']),
  });
  const { domId, state, cells } = model;
  const id = escapeHtml(domId);
  ctx.clientConfig.regions.push({ id: domId, kind: 'interactiveGrid' });
  for (const file of [
    'model',
    'tooltipManager',
    'widget.toolbar',
    'widget.tableModelViewBase',
    'widget.grid',
  ])
    ctx.jsFiles.add(`#APEX_FILES#libraries/apex/#MIN_DIRECTORY#${file}#MIN#.js?v=#APEX_VERSION#`);

  const trigger = `apex.jQuery('#${domId}')`;
  const fields = [
    ...model.columns.map((column) => column.name),
    ...(model.identity[0] === ROW_ID ? [ROW_ID] : []),
  ];
  const grid = gridViewData(model, fields, trigger);
  const data = grid.data;
  const order = state.columns;
  const sortIndex = new Map(state.sort.map((entry, index) => [entry.column, { ...entry, index }]));
  const hasSelector = model.columns.some((column) => column.type === 'rowSelector');
  const hasActions = model.columns.some((column) => column.type === 'actionsMenu');
  const editable = model.editable && (model.allowed.update || model.allowed.add || model.allowed.delete);
  const items: string[] = [];
  const customItems: Record<string, unknown>[] = [];
  const gridColumns: Record<string, unknown> = {};
  const breakIndex = new Map(model.breaks.map((column, index) => [column.name, index + 1]));
  model.columns.forEach((column, index) => {
    if (column.type === 'rowSelector') return;
    const props = column.component.props;
    const sort = sortIndex.get(column.name);
    const itemId = `${domId}_ig_c_${column.name.replace(/\W/gu, '_')}`;
    const canEdit = editable && model.allowed.update && column.editor !== undefined && !column.primaryKey;
    const canInsert = editable && model.allowed.add && column.editor !== undefined;
    if (canEdit || canInsert) {
      items.push(`<div class="a-GV-columnItem">${columnItem(model, column, itemId)}</div>`);
      const custom = customItem(model, column, itemId);
      if (custom) customItems.push(custom);
    }
    const shownByReport = order ? order.includes(column.name) : true;
    const markup = isMarkup(column);
    if (column.type === 'actionsMenu') {
      gridColumns[column.name] = {
        heading: '',
        label: 'Actions',
        seq: -1,
        width: 40,
        noStretch: true,
        noHeaderActivate: true,
        canHide: false,
        canSort: false,
        virtual: true,
        noCopy: true,
        readonly: true,
        escape: false,
        alignment: 'center',
        cellTemplate: `<button type="button" class="a-Button a-Button--noLabel a-Button--iconTextButton a-Button--small apex-local-ig-rowActions" aria-label="Row Actions" title="Row Actions"><span class="a-Icon icon-ig-row-actions" aria-hidden="true"></span></button>`,
      };
      return;
    }
    const width = num(props, 'appearance.width', 0);
    gridColumns[column.name] = {
      heading: cells.heading(column.component),
      label: cells.label(column.component),
      headingAlignment: alignmentName(
        str(props, 'heading.alignment')
          ? /end|right/u.test(str(props, 'heading.alignment'))
            ? 'u-tR'
            : /center/u.test(str(props, 'heading.alignment'))
              ? 'u-tC'
              : 'u-tL'
          : renderer.alignment(column.component, model.rows[0]?.[column.name]),
      ),
      alignment: alignmentName(renderer.alignment(column.component, model.rows[0]?.[column.name])),
      seq: order && order.includes(column.name) ? order.indexOf(column.name) + 1 : 1000 + index,
      hidden: column.hidden || !shownByReport || /^APEX\$/u.test(column.name) || breakIndex.has(column.name),
      ...(breakIndex.has(column.name)
        ? { controlBreakIndex: breakIndex.get(column.name), controlBreakDirection: 'asc' }
        : {}),
      canHide: !column.hidden && get(props, 'enableUsersTo.hide') !== false,
      canSort: !column.hidden && get(props, 'enableUsersTo.sort') !== false,
      readonly: !(canEdit || canInsert),
      escape: !markup,
      isRequired: get(props, 'validation.valueRequired') === true,
      ...(width ? { width } : {}),
      ...(sort ? { sortDirection: sort.direction, sortIndex: sort.index + 1 } : {}),
      ...(canEdit || canInsert ? { elementId: itemId } : {}),
      ...(stringList(list(props, 'appearance.cssClasses')).length
        ? { columnCssClasses: stringList(list(props, 'appearance.cssClasses')).join(' ') }
        : {}),
    };
  });
  const modelFields: Record<string, unknown> = {};
  fields.forEach((name, index) => {
    const column = model.byName.get(name);
    const fallback = column ? defaultValue(model, column) : undefined;
    modelFields[name] = {
      index,
      ...(fallback !== undefined ? { defaultValue: fallback } : {}),
      ...(column && /^APEX\$/u.test(name) ? { virtual: true } : {}),
    };
  });
  modelFields[META_FIELD] = { index: fields.length };
  const pagination = str(region.props, 'pagination.type', 'scroll');
  const details = renderer
    .pageComponents(ctx, 'region')
    .filter((candidate) => ref(candidate.props, 'masterDetail.masterRegion') === region.id)
    .map((candidate) => renderer.regionDomId(candidate));
  const controls = stringList(list(region.props, 'toolbar.controls'));
  const config = {
    region: domId,
    modelName: `${domId}_ig_grid`,
    fields: modelFields,
    identity: model.identity,
    data,
    columns: gridColumns,
    editable,
    allowed: model.allowed,
    rowSelector: hasSelector,
    rowActions: hasActions,
    rowsPerPage:
      state.rowsPerPage && state.rowsPerPage > 0 ? state.rowsPerPage : pagination === 'page' ? 50 : 0,
    pagination,
    showTotal: get(region.props, 'pagination.showTotalCount') !== false,
    toolbar: get(region.props, 'toolbar.show') !== false,
    controls: controls.length
      ? controls
      : ['searchCol', 'searchField', 'actionsMenu', 'resetButton', 'saveButton', 'editButton'],
    addLabel: str(region.props, 'toolbar.addButtonLabel', 'Add Row'),
    details,
    master: model.master ? renderer.regionDomId(model.master.region) : null,
    selected: state.selected ?? null,
    noData: renderer.substitute(
      ctx.session,
      str(region.props, 'messages.whenNoDataFound', 'No data found'),
      ctx.page,
      'RAW',
    ),
    filters: state.filters.map((filter) => {
      const column = filter.column ? model.byName.get(filter.column) : undefined;
      return {
        label: filterLabel(filter, column ? cells.label(column.component) : filter.column),
        enabled: filter.enabled,
        row: !filter.column,
      };
    }),
    searchColumns: model.columns
      .filter((column) => !column.hidden && !/^APEX\$/u.test(column.name))
      .map((column) => ({ name: column.name, label: cells.label(column.component) })),
    formats: (() => {
      const formats = stringList(list(region.props, 'download.formats')).filter((format) =>
        GRID_DOWNLOAD_FORMATS.includes(format),
      );
      return formats.length ? formats : ['csv', 'html'];
    })(),
    metaField: META_FIELD,
    customItems,
    highlights: grid.highlights,
    aggregateLabels: grid.aggregateLabels,
    views: {
      breaks: state.views?.breaks ?? [],
      highlights: state.views?.highlights ?? [],
      aggregates: state.views?.aggregates ?? [],
    },
  };
  return `<div class="a-IG" id="${id}_ig" role="group" aria-label="${escapeHtml(str(region.props, 'title', str(region.props, 'name')))}" data-apex-local-ig="${id}">
<div class="a-IG-header" id="${id}_ig_toolbar"></div>
<div class="a-IG-controlsContainer" id="${id}_ig_controls"></div>
<div class="a-IG-body"><div class="a-IG-contentContainer"><div class="a-IG-gridView">
<div class="u-vh" aria-hidden="true">${items.join('')}</div>
<div id="${id}_ig_grid_vc"></div>
</div></div></div>
<script type="application/json" id="${id}_ig_config">${JSON.stringify(config).replaceAll('<', '\\u003c')}</script>
</div>`;
}

// ---------------------------------------------------------------- saving

export interface SaveResult {
  ok: boolean;
  saved: number;
  errors: { id?: string; column?: string; message: string }[];
}

/** Applies grid changes with interactiveGridAutoRowProcessing semantics (insert/update/delete by key). */
export function saveGrid(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  changes: GridChange[],
): SaveResult {
  const model = gridModel(renderer, ctx, region);
  const errors: SaveResult['errors'] = [];
  if (!model.editable)
    return { ok: false, saved: 0, errors: [{ message: `Region ${region.id} is not editable.` }] };
  if (!model.table)
    return {
      ok: false,
      saved: 0,
      errors: [
        {
          message: `Interactive Grid ${region.id}: set source.tableName so the local preview knows which table to change.`,
        },
      ],
    };
  const table = model.table.toUpperCase();
  const tableColumns = new Set(renderer.db.tableColumns(table).map((column) => column.name.toUpperCase()));
  const label = (column: GridColumn) => model.cells.label(column.component);
  for (const change of changes) {
    const allowed =
      change.op === 'insert'
        ? model.allowed.add
        : change.op === 'update'
          ? model.allowed.update
          : model.allowed.delete;
    if (!allowed)
      errors.push({
        ...(change.id ? { id: change.id } : {}),
        message: `${change.op} is not allowed in ${region.id}.`,
      });
    if (change.op === 'delete') continue;
    for (const column of model.columns) {
      if (!column.databaseColumn || column.primaryKey) continue;
      const value = change.values[column.name];
      const props = column.component.props;
      const text = value === null || value === undefined ? '' : String(value);
      const location = { ...(change.id ? { id: change.id } : {}), column: column.name };
      if (get(props, 'validation.valueRequired') === true && text === '')
        errors.push({ ...location, message: `${label(column)} must have some value.` });
      const max = num(props, 'validation.maxLength', 0);
      if (max && text.length > max)
        errors.push({ ...location, message: `${label(column)} must have at most ${max} characters.` });
      if (column.type === 'numberField' && text !== '' && !Number.isFinite(Number(text.replaceAll(',', ''))))
        errors.push({ ...location, message: `${label(column)} must be Numeric.` });
    }
  }
  if (errors.length) return { ok: false, saved: 0, errors };

  const keyColumns = model.identity.map((name) =>
    name === ROW_ID ? 'rowid' : `"${(model.byName.get(name)?.databaseColumn ?? name).toUpperCase()}"`,
  );
  const keyBinds = (change: GridChange): Binds => {
    const parts = (change.id ?? '').split('|');
    return Object.fromEntries(
      model.identity.map((name, index) => [
        `K${index}`,
        name === ROW_ID ? (parts[index] ?? '') : String(change.values[name] ?? parts[index] ?? ''),
      ]),
    );
  };
  const where = keyColumns.map((column, index) => `${column} = :K${index}`).join(' and ');
  const bindName = (column: GridColumn) => `C_${column.name.replace(/\W/gu, '_')}`;
  const value = (column: GridColumn, raw: string | null | undefined) => {
    const text = raw === null || raw === undefined ? '' : String(raw);
    // Oracle treats empty strings as NULL.
    if (text === '') return null;
    if (column.type === 'numberField') return text.replaceAll(',', '');
    return text;
  };
  let saved = 0;
  renderer.db.execute('savepoint apex_local_ig');
  try {
    for (const change of changes) {
      if (change.op === 'delete') {
        saved += renderer.db.execute(`delete from "${table}" where ${where}`, keyBinds(change)).changes;
        continue;
      }
      const writable = model.columns.filter(
        (column) =>
          column.databaseColumn &&
          tableColumns.has(column.databaseColumn) &&
          column.name in change.values &&
          (change.op === 'insert' || !column.primaryKey),
      );
      if (change.op === 'insert') {
        const insert = writable.filter((column) => {
          const raw = change.values[column.name];
          // Temporary model identities (t1000) and empty keys are left to the table default.
          return !(column.primaryKey && (raw === '' || raw === null || /^t\d+$/u.test(String(raw ?? ''))));
        });
        const binds = Object.fromEntries(
          insert.map((column) => [bindName(column), value(column, change.values[column.name])]),
        );
        saved += renderer.db.execute(
          insert.length
            ? `insert into "${table}" (${insert.map((column) => `"${column.databaseColumn}"`).join(', ')}) values (${insert.map((column) => `:${bindName(column)}`).join(', ')})`
            : `insert into "${table}" default values`,
          binds,
        ).changes;
        continue;
      }
      if (!writable.length) continue;
      saved += renderer.db.execute(
        `update "${table}" set ${writable.map((column) => `"${column.databaseColumn}" = :${bindName(column)}`).join(', ')} where ${where}`,
        {
          ...Object.fromEntries(
            writable.map((column) => [bindName(column), value(column, change.values[column.name])]),
          ),
          ...keyBinds(change),
        },
      ).changes;
    }
    renderer.db.execute('release savepoint apex_local_ig');
  } catch (error) {
    renderer.db.execute('rollback to savepoint apex_local_ig');
    renderer.db.execute('release savepoint apex_local_ig');
    renderer.diagnose(
      'error',
      `Interactive Grid save failed in ${region.id}: ${(error as Error).message}`,
      ctx.pageId,
      region.id,
    );
    return { ok: false, saved: 0, errors: [{ message: (error as Error).message }] };
  }
  return { ok: true, saved, errors: [] };
}

/** Page errors in the shape `apex.message.showErrors` expects. */
export function pageErrors(region: ApxComponent, result: SaveResult): ApexError[] {
  return result.errors.map((error) => ({
    type: 'error',
    location: ['page'],
    message: `${str(region.props, 'name', region.id)}: ${error.message}`,
    unsafe: false,
  }));
}

/** Rows and headings for CSV/HTML downloads of a grid (visible columns, current filters and sort). */
export function gridExport(model: GridModel): {
  headings: string[];
  rows: string[][];
  columns: GridColumn[];
} {
  const order = model.state.columns;
  const columns = model.columns
    .filter((column) => !column.hidden && !/^APEX\$/u.test(column.name))
    .filter((column) => get(column.component.props, 'exportPrinting.includeInExportPrint') !== false)
    .filter((column) => !order || order.includes(column.name))
    .sort((a, b) => (order ? order.indexOf(a.name) - order.indexOf(b.name) : 0));
  return {
    headings: columns.map((column) => model.cells.label(column.component)),
    rows: model.rows.map((row) => columns.map((column) => model.cells.text(column.component, row))),
    columns,
  };
}

export { identityOf };
