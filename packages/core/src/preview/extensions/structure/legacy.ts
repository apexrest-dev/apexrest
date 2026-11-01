import { get, isObject, num, ref, str, type ApxComponent, type ApxObject } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import { itemRenderer, regionRenderer, type ProcessHandler } from '../../extensions.ts';
import type { ApexError, ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import { stateKey } from '../reports/shared.ts';
import { fullCalendarScript } from '../charts/calendar.ts';

/**
 * Legacy region and item types mapped onto the modern renderers: jQuery Mobile reflow and
 * column toggle reports (responsive classic report markup), tabular forms (editable rows saved
 * by the Tabular Form processes), the legacy calendar, legacy charts and the jQuery date picker.
 */

const note = (renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent, message: string) =>
  renderer.diagnose('info', message, ctx.pageId, region.id);

// ------------------------------------------------------------------ reflow / column toggle

function classic(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const render = regionRenderer('classicReport');
  return render ? render(renderer, ctx, region, {}) : renderer.report(ctx, region, 'classic');
}

/** Column labels by column name, read from the rendered headings (`<th id="NAME">label</th>`). */
function headings(html: string): Map<string, string> {
  const labels = new Map<string, string>();
  for (const match of html.matchAll(/<th\b[^>]*\bid="([^"]+)"[^>]*>([^]*?)<\/th>/gu))
    labels.set(match[1]!, match[2]!.replace(/<[^>]*>/gu, '').trim());
  return labels;
}

/**
 * Adds attributes to the heading and data cells of each column: cells are matched by their
 * `headers` attribute, or by position when the report template does not emit one.
 */
function annotate(html: string, labels: Map<string, string>, extra: (name: string) => string): string {
  const names = [...labels.keys()];
  const withHeadings = html.replace(/<th\b([^>]*?)\sid="([^"]+)"/gu, (whole, before: string, name: string) =>
    labels.has(name) ? `<th${before} id="${name}"${extra(name)}` : whole,
  );
  return withHeadings.replace(/<tr\b[^>]*>([^]*?)<\/tr>/gu, (row: string) => {
    let index = 0;
    return row.replace(/<td\b([^>]*)>/gu, (cell, attributes: string) => {
      const named = /\bheaders="([^"]+)"/u.exec(attributes)?.[1];
      const name = named ?? names[index];
      index += 1;
      return name && labels.has(name) && !/\bcolspan=/u.test(attributes)
        ? `<td${attributes}${extra(name)}>`
        : cell;
    });
  });
}

function columnSetting(region: ApxComponent, name: string, key: string): string {
  const column = region.children.find((child) => child.type === 'column' && child.id.toUpperCase() === name);
  return column ? str(column.props, `settings.${key}`) : '';
}

function layoutClasses(region: ApxComponent): string {
  const options = str(region.props, 'settings.layoutOptions', 'stripes:stroke').toLowerCase();
  return [
    /strip/u.test(options) ? 'apex-local-rwd--stripes' : '',
    /stroke/u.test(options) ? 'apex-local-rwd--stroke' : '',
    str(region.props, 'settings.cssClasses'),
  ]
    .filter(Boolean)
    .join(' ');
}

export function reflowReport(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  note(
    renderer,
    ctx,
    region,
    `Reflow report ${region.id} is rendered as a responsive classic report (no jQuery Mobile)`,
  );
  const html = classic(renderer, ctx, region);
  const labels = headings(html);
  const body = annotate(html, labels, (name) => ` data-label="${escapeHtml(labels.get(name)!)}"`);
  return `<div class="apex-local-rwd apex-local-reflow ${escapeHtml(layoutClasses(region))}">${body}</div>`;
}

export function columnToggleReport(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  note(
    renderer,
    ctx,
    region,
    `Column toggle report ${region.id} is rendered as a classic report with a column chooser (no jQuery Mobile)`,
  );
  const domId = renderer.regionDomId(region);
  const html = classic(renderer, ctx, region);
  const labels = headings(html);
  const priority = (name: string) => {
    const value = columnSetting(region, name, 'priority');
    return value === 'always' || value === 'ALWAYS' ? '' : value;
  };
  const body = annotate(html, labels, (name) => {
    const level = priority(name);
    return ` data-col="${escapeHtml(name)}"${level ? ` data-priority="${escapeHtml(level)}"` : ''}`;
  });
  const button = escapeHtml(str(region.props, 'settings.colButtonText', 'Columns...'));
  const choices = [...labels]
    .map(
      ([name, label]) =>
        `<label class="apex-local-coltoggle-choice"><input type="checkbox" checked value="${escapeHtml(name)}" data-apex-local-coltoggle="${escapeHtml(domId)}"> ${escapeHtml(label)}</label>`,
    )
    .join('');
  return `<div class="apex-local-rwd apex-local-coltoggle ${escapeHtml(layoutClasses(region))}" data-region="${escapeHtml(domId)}"><div class="apex-local-coltoggle-bar"><button type="button" class="t-Button t-Button--small apex-local-coltoggle-button" aria-expanded="false">${button}</button><div class="apex-local-coltoggle-menu" hidden>${choices}</div></div>${body}</div>`;
}

// ------------------------------------------------------------------ tabular form

const EDITABLE = new Set([
  'textField',
  'textArea',
  'selectList',
  'radioGroup',
  'popupLovShowsDisplaysValue',
  'popupLovShowsReturnValue',
  'simpleCheckbox',
  'datePicker',
  'datePickerClassic',
  'hiddenSavesState',
  'plainTextSavesState',
]);

export const tabformItem = (region: ApxComponent) =>
  `APEXLOCAL_TABFORM_${region.id.toUpperCase().replace(/[^A-Z0-9_]/gu, '_')}`;
const addKey = (pageId: string, region: ApxComponent) => `${stateKey(pageId, region.id)}:tabformAdd`;

function tabformProcesses(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): ApxComponent[] {
  return renderer
    .pageComponents(ctx, 'process')
    .filter(
      (process) =>
        /^tabform/u.test(str(process.props, 'type')) &&
        (ref(process.props, 'formRegion') === region.id ||
          ref(process.props, 'editableRegion') === region.id),
    );
}

const attribute = (props: ApxObject, key: string) =>
  str(props, `target.${key}`) ||
  str(props, `source.${key}`) ||
  str(props, `settings.${key}`) ||
  str(props, key);

function tabformKey(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  columns: string[],
): string {
  for (const process of tabformProcesses(renderer, ctx, region)) {
    const pk = attribute(process.props, 'pkColumn');
    if (pk) return pk.toUpperCase();
  }
  return columns[0] ?? '';
}

function tabformTable(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  for (const process of tabformProcesses(renderer, ctx, region)) {
    const table = attribute(process.props, 'tableName');
    if (table) return table;
  }
  const table = str(region.props, 'source.tableName');
  if (table) return table;
  return /\bfrom\s+("?[\w$#]+"?(?:\."?[\w$#]+"?)?)/iu.exec(str(region.props, 'source.sqlQuery'))?.[1] ?? '';
}

function cellEditor(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  column: ApxComponent | undefined,
  name: string,
  raw: unknown,
  row: Row | undefined,
): string {
  const type = column ? str(column.props, 'type', 'plainText') : 'plainText';
  const text = raw === null || raw === undefined ? '' : String(raw);
  const value = escapeHtml(text);
  const data = `data-tabform-col="${escapeHtml(name)}" data-orig="${value}"`;
  const width = column ? num(column.props, 'appearance.width', 0) : 0;
  const label = escapeHtml(str(column?.props ?? {}, 'heading.heading', name));
  switch (type) {
    case 'textField':
    case 'datePicker':
    case 'datePickerClassic':
    case 'popupLovShowsDisplaysValue':
    case 'popupLovShowsReturnValue':
      return `<input type="text" class="text_field" ${data} value="${value}"${width ? ` size="${width}"` : ''} aria-label="${label}">`;
    case 'textArea':
      return `<textarea class="textarea" ${data} rows="${num(column!.props, 'appearance.height', 2)}" aria-label="${label}">${value}</textarea>`;
    case 'selectList':
    case 'radioGroup': {
      const options = renderer.lov(ctx, column!.props.lov, `${region.id}.${name}`);
      const nullOption = get(column!.props, 'lov.displayNullValue') === true;
      const known = options.some((option) => option.r === text);
      return `<select class="selectlist" ${data} aria-label="${label}">${nullOption ? `<option value="${escapeHtml(str(column!.props, 'lov.nullReturnValue'))}">${escapeHtml(str(column!.props, 'lov.nullDisplayValue'))}</option>` : ''}${!known && text ? `<option value="${value}" selected>${value}</option>` : ''}${options.map((option) => `<option value="${escapeHtml(option.r)}"${option.r === text ? ' selected' : ''}>${escapeHtml(option.d)}</option>`).join('')}</select>`;
    }
    case 'simpleCheckbox': {
      const [checkedValue = 'Y', uncheckedValue = ''] = str(column!.props, 'lov.checkboxValues', 'Y').split(
        ',',
      );
      return `<input type="checkbox" ${data} value="${escapeHtml(checkedValue)}" data-unchecked="${escapeHtml(uncheckedValue)}"${text === checkedValue ? ' checked' : ''} aria-label="${label}">`;
    }
    case 'hiddenSavesState':
      return `<input type="hidden" ${data} value="${value}">`;
    case 'plainTextSavesState':
      return `${value}<input type="hidden" ${data} value="${value}">`;
    case 'link': {
      const target = get(column!.props, 'link.target');
      if (!row || target === undefined) return value;
      const linkText = str(column!.props, 'link.linkText', '#' + name + '#').replace(
        /#([A-Z0-9_$]+)#/giu,
        (whole, key: string) =>
          key.toUpperCase() in row ? escapeHtml(String(row[key.toUpperCase()] ?? '')) : whole,
      );
      return `<a href="${escapeHtml(renderer.link(ctx, isObject(target) || typeof target === 'string' ? target : undefined, row))}">${linkText}</a>`;
    }
    case 'plainTextBasedOnLov': {
      const options = renderer.lov(ctx, column!.props.lov, `${region.id}.${name}`);
      return escapeHtml(options.find((option) => option.r === text)?.d ?? text);
    }
    default:
      return value;
  }
}

export function tabform(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const domId = renderer.regionDomId(region);
  note(
    renderer,
    ctx,
    region,
    `Tabular form ${region.id} is rendered as an editable classic report; Tabular Form processes save it locally`,
  );
  const sql = renderer.regionSql(ctx, region);
  if (!sql)
    return `<div class="apex-local-unsupported">Tabular form “${escapeHtml(str(region.props, 'name', region.id))}” has no local source.</div>`;
  if (/\bapex_item\s*\./iu.test(sql))
    renderer.diagnose(
      'warning',
      `Tabular form ${region.id}: APEX_ITEM calls in the query are not available locally`,
      ctx.pageId,
      region.id,
    );
  const result = renderer.query(ctx, region, sql, 1000);
  if (result.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(result.error)}</div></div>`;
  const declared = region.children
    .filter((child) => child.type === 'column')
    .sort((a, b) => num(a.props, 'layout.sequence', 0) - num(b.props, 'layout.sequence', 0));
  const byName = new Map(declared.map((column) => [column.id.toUpperCase(), column]));
  const names = declared.length
    ? declared
        .map((column) => column.id.toUpperCase())
        .filter((name) => result.columns.includes(name) || byName.get(name)?.props.type === 'rowSelector')
    : result.columns;
  const key = tabformKey(renderer, ctx, region, result.columns);
  const hidden = (name: string) => /^hidden/u.test(str(byName.get(name)?.props ?? {}, 'type'));
  const visible = names.filter((name) => !hidden(name));
  const perPage = Math.max(1, num(region.props, 'reportLayout.numberOfRows', 15));
  const pageCount = Math.max(1, Math.ceil(result.rows.length / perPage));
  const page = Math.min(pageCount, Math.max(1, ctx.session.pagination[stateKey(ctx.pageId, region.id)] ?? 1));
  const rows = result.rows.slice((page - 1) * perPage, page * perPage);
  const added = ctx.session.pagination[addKey(ctx.pageId, region)] ?? 0;
  const selector = `<input type="checkbox" class="u-selector" data-tabform-select aria-label="Select row">`;
  const cell = (name: string, row: Row | undefined) => {
    const column = byName.get(name);
    if (str(column?.props ?? {}, 'type') === 'rowSelector') return selector;
    const raw = row ? row[name] : '';
    if (!row && (!column || !EDITABLE.has(str(column.props, 'type')))) return '';
    return cellEditor(renderer, ctx, region, column, name, raw, row);
  };
  const hiddenInputs = (row: Row | undefined) =>
    names
      .filter((name) => hidden(name))
      .map(
        (name) =>
          `<input type="hidden" data-tabform-col="${escapeHtml(name)}" data-orig="${escapeHtml(row ? String(row[name] ?? '') : '')}" value="${escapeHtml(row ? String(row[name] ?? '') : '')}">`,
      )
      .join('');
  const line = (row: Row | undefined) =>
    `<tr data-tabform-row data-tabform-key="${escapeHtml(row ? String(row[key] ?? '') : '')}">${visible
      .map(
        (name, position) =>
          `<td class="t-Report-cell" headers="${escapeHtml(name)}">${position === 0 ? hiddenInputs(row) : ''}${cell(name, row)}</td>`,
      )
      .join('')}</tr>`;
  const head = visible
    .map((name) => {
      const column = byName.get(name);
      const label =
        str(column?.props ?? {}, 'type') === 'rowSelector'
          ? `<input type="checkbox" class="u-selector" data-tabform-select-all aria-label="Select all rows">`
          : escapeHtml(
              str(
                column?.props ?? {},
                'heading.heading',
                name.charAt(0) + name.slice(1).toLowerCase().replaceAll('_', ' '),
              ),
            );
      return `<th class="t-Report-colHead" id="${escapeHtml(name)}">${label}</th>`;
    })
    .join('');
  const body = [
    ...rows.map((row) => line(row)),
    ...Array.from({ length: added }, () => line(undefined)),
  ].join('');
  const pager =
    pageCount > 1
      ? `<div class="t-Report-pagination apex-local-tabform-pages">${page > 1 ? `<a href="javascript:apexLocalReports.paginate('${escapeHtml(domId)}',${page - 1})" class="t-Report-paginationLink t-Report-paginationLink--prev">Previous</a>` : ''}<span class="t-Report-paginationText">${(page - 1) * perPage + 1} - ${(page - 1) * perPage + rows.length} of ${result.rows.length}</span>${page < pageCount ? `<a href="javascript:apexLocalReports.paginate('${escapeHtml(domId)}',${page + 1})" class="t-Report-paginationLink t-Report-paginationLink--next">Next</a>` : ''}</div>`
      : '';
  const item = tabformItem(region);
  return (
    `<div class="t-Report t-Report--altRowsDefault apex-local-tabform" id="report_${escapeHtml(domId)}" data-region-id="${escapeHtml(domId)}" data-item="${item}">` +
    `<input type="hidden" id="${item}" name="${item}" value="">` +
    `<div class="t-Report-wrap"><div class="t-Report-tableWrap"><table class="t-Report-report" aria-label="${escapeHtml(str(region.props, 'title', str(region.props, 'name')))}"><thead><tr>${head}</tr></thead><tbody>` +
    (body ||
      `<tr><td colspan="${visible.length || 1}" class="t-Report-cell"><span class="nodatafound">${escapeHtml(str(region.props, 'messages.whenNoDataFound', 'no data found'))}</span></td></tr>`) +
    `</tbody></table></div>${pager}</div></div>`
  );
}

interface TabformRow {
  key: string;
  selected: boolean;
  changed: boolean;
  values: Record<string, string>;
}

function submittedRows(ctx: RenderContext, region: ApxComponent): TabformRow[] {
  const raw = ctx.session.items[tabformItem(region)] ?? '';
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TabformRow[]) : [];
  } catch {
    return [];
  }
}

function tabformTarget(renderer: ApexRenderer, ctx: RenderContext, process: ApxComponent) {
  const regionId = ref(process.props, 'formRegion') ?? ref(process.props, 'editableRegion');
  const region = renderer.pageComponents(ctx, 'region').find((candidate) => candidate.id === regionId);
  if (!region) {
    renderer.diagnose(
      'warning',
      `Tabular form process ${process.id}: region not found`,
      ctx.pageId,
      process.id,
    );
    return undefined;
  }
  const table = attribute(process.props, 'tableName') || tabformTable(renderer, ctx, region);
  const pk = (attribute(process.props, 'pkColumn') || tabformKey(renderer, ctx, region, [])).toUpperCase();
  if (!table || !pk) {
    renderer.diagnose(
      'warning',
      `Tabular form process ${process.id} needs a table and primary key column`,
      ctx.pageId,
      process.id,
    );
    return undefined;
  }
  return { region, table, pk };
}

const quote = (name: string) => `"${name.replaceAll('"', '').toUpperCase()}"`;

function failure(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
  error: unknown,
): { ran: false; errors: ApexError[] } {
  const message = (error as Error).message;
  renderer.diagnose('error', `Tabular form process ${process.id} failed: ${message}`, ctx.pageId, process.id);
  return { ran: false, errors: [{ type: 'error', location: ['page'], message, unsafe: false }] };
}

export const tabformUpdate: ProcessHandler = (renderer, ctx, process, point) => {
  if (point !== 'submit') return { ran: false };
  const target = tabformTarget(renderer, ctx, process);
  if (!target) return { ran: false };
  const columns = new Set(
    renderer.data.tableColumns(target.table.replaceAll('"', '')).map((entry) => entry.name),
  );
  let updated = 0;
  let inserted = 0;
  try {
    for (const row of submittedRows(ctx, target.region)) {
      const values = Object.entries(row.values).filter(
        ([name]) => columns.has(name.toUpperCase()) && name.toUpperCase() !== target.pk,
      );
      const binds: Record<string, string> = Object.fromEntries(
        values.map(([, value], index) => [`APEX_LOCAL_V${index}`, value]),
      );
      if (row.key) {
        if (!row.changed || !values.length) continue;
        renderer.data.execute(
          `update ${target.table} set ${values.map(([name], index) => `${quote(name)} = :APEX_LOCAL_V${index}`).join(', ')} where ${quote(target.pk)} = :APEX_LOCAL_KEY`,
          { ...binds, APEX_LOCAL_KEY: row.key },
        );
        updated += 1;
      } else if (values.some(([, value]) => value !== '')) {
        const provided = row.values[target.pk];
        const key =
          provided ||
          String(
            renderer.data.scalar(`select coalesce(max(${quote(target.pk)}), 0) + 1 from ${target.table}`),
          );
        renderer.data.execute(
          `insert into ${target.table} (${[quote(target.pk), ...values.map(([name]) => quote(name))].join(', ')}) values (:APEX_LOCAL_KEY${values.map((_value, index) => `, :APEX_LOCAL_V${index}`).join('')})`,
          { ...binds, APEX_LOCAL_KEY: key },
        );
        inserted += 1;
      }
    }
  } catch (error) {
    return failure(renderer, ctx, process, error);
  }
  delete ctx.session.pagination[addKey(ctx.pageId, target.region)];
  if (updated || inserted) ctx.session.success ??= `${updated} row(s) updated, ${inserted} row(s) inserted.`;
  return { ran: updated + inserted > 0 };
};

export const tabformDelete: ProcessHandler = (renderer, ctx, process, point) => {
  if (point !== 'submit') return { ran: false };
  const target = tabformTarget(renderer, ctx, process);
  if (!target) return { ran: false };
  const keys = submittedRows(ctx, target.region)
    .filter((row) => row.selected && row.key)
    .map((row) => row.key);
  try {
    for (const key of keys)
      renderer.data.execute(`delete from ${target.table} where ${quote(target.pk)} = :APEX_LOCAL_KEY`, {
        APEX_LOCAL_KEY: key,
      });
  } catch (error) {
    return failure(renderer, ctx, process, error);
  }
  if (keys.length) ctx.session.success ??= `${keys.length} row(s) deleted.`;
  return { ran: keys.length > 0 };
};

export const tabformAddRows: ProcessHandler = (renderer, ctx, process, point) => {
  if (point !== 'submit') return { ran: false };
  const regionId = ref(process.props, 'formRegion') ?? ref(process.props, 'editableRegion');
  const region = renderer.pageComponents(ctx, 'region').find((candidate) => candidate.id === regionId);
  if (!region) return { ran: false };
  const count = Math.max(1, Number(attribute(process.props, 'noOfRows')) || 1);
  const key = addKey(ctx.pageId, region);
  ctx.session.pagination[key] = (ctx.session.pagination[key] ?? 0) + count;
  return { ran: true };
};

// ------------------------------------------------------------------ calendar, charts, date picker

/**
 * The legacy calendar becomes the modern Calendar: the component is switched to type `calendar`
 * (with the legacy date/display columns mapped) so the calendar's event feed serves it as well.
 */
export function legacyCalendar(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  note(renderer, ctx, region, `Legacy calendar ${region.id} is shown as the modern Calendar (FullCalendar)`);
  const settings = isObject(region.props.settings) ? region.props.settings : (region.props.settings = {});
  const pick = (...keys: string[]) => keys.map((key) => settings[key]).find((value) => value !== undefined);
  settings.startDateColumn ??= pick('dateColumn', 'beginDateColumn', 'startDate') ?? '';
  settings.displayColumn ??= pick('displayColumn', 'displayItem', 'titleColumn') ?? '';
  region.props.type = 'calendar';
  const script = fullCalendarScript(renderer);
  if (script) ctx.jsFiles.add(script);
  const render = regionRenderer('calendar');
  return render ? render(renderer, ctx, region, {}) : '';
}

const LEGACY_CHART_TYPES: Record<string, string> = {
  pie: 'pie',
  donut: 'donut',
  line: 'line',
  area: 'area',
  bar: 'bar',
};

/** Legacy simple/SVG charts become JET-style charts drawn by the charts module. */
export function legacyChart(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const legacy = str(region.props, 'type');
  note(renderer, ctx, region, `Legacy chart ${region.id} (${legacy}) is drawn by the local chart renderer`);
  const declared = str(region.props, 'chart.type') || str(region.props, 'settings.chartType');
  const type =
    Object.entries(LEGACY_CHART_TYPES).find(([key]) => declared.toLowerCase().includes(key))?.[1] ?? 'bar';
  region.props.type = 'chart';
  region.props.chart = { ...(isObject(region.props.chart) ? region.props.chart : {}), type };
  if (!region.children.some((child) => child.type === 'series') && isObject(region.props.source)) {
    region.children.push({
      type: 'series',
      id: `${region.id}-series`,
      props: { name: str(region.props, 'name', 'Series'), source: { location: 'regionSource' } },
      children: [],
      file: region.file,
      line: region.line,
    });
  }
  const render = regionRenderer('chart');
  return render ? render(renderer, ctx, region, {}) : '';
}

export function datePickerJquery(
  renderer: ApexRenderer,
  ctx: RenderContext,
  item: ApxComponent,
  name: string,
  value: string,
): string {
  const ignored = [
    'minDate',
    'maxDate',
    'show',
    'navigationListFor',
    'noOfMonths',
    'yearRange',
    'showOtherMonths',
    'highlightedDate',
  ].filter((key) => get(item.props, `settings.${key}`) !== undefined);
  renderer.diagnose(
    'info',
    `Item ${name} (jQuery date picker) is rendered with the a-date-picker web component${ignored.length ? `; settings ${ignored.join(', ')} are not applied` : ''}`,
    ctx.pageId,
    name,
  );
  const render = itemRenderer('datePicker');
  return render
    ? render(renderer, ctx, item, name, value)
    : `<input type="text" id="${name}" name="${name}" class="datepicker apex-item-text apex-item-datepicker" value="${escapeHtml(value)}">`;
}
