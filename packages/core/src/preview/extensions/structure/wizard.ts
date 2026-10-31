import { get, isObject, list, ref, str, type ApxComponent, type ApxObject } from '../../apexlang.ts';
import type { ProcessHandler, ProcessResult } from '../../extensions.ts';
import type { ApexError, ApexRenderer, RenderContext } from '../../render.ts';
import { stateKey } from '../reports/shared.ts';

/**
 * Wizard and legacy form processing: Form Pagination (previous/next primary key), Reset
 * Pagination, the legacy Automatic Row Fetch / Automatic Row Processing (DML) processes and the
 * report pagination behind "Next Page" / "Previous Page" buttons.
 */

/** Process attributes appear under `target`, `source`, `settings` or directly on the process. */
function attribute(props: ApxObject, key: string): string {
  for (const path of [`target.${key}`, `source.${key}`, `settings.${key}`, `resetPagination.${key}`, key]) {
    const value = get(props, path);
    if (value !== undefined && value !== null && !isObject(value))
      return Array.isArray(value) ? value.map(String).join(',') : String(value);
  }
  return '';
}

const column = (name: string) => `"${name.replaceAll('"', '').toUpperCase()}"`;
const upper = (name: string) => name.replaceAll('"', '').toUpperCase();

/** Legacy page items bound to table columns (`source.type: databaseColumn`). */
function columnItems(renderer: ApexRenderer, ctx: RenderContext): { item: string; column: string }[] {
  return renderer
    .pageComponents(ctx, 'pageItem')
    .map((item) => ({
      item: item.id.toUpperCase(),
      column:
        str(item.props, 'source.type') === 'databaseColumn'
          ? str(item.props, 'source.databaseColumn') || str(item.props, 'source.column')
          : '',
    }))
    .filter((entry) => entry.column);
}

function tableOf(renderer: ApexRenderer, ctx: RenderContext, process: ApxComponent): string {
  const table = attribute(process.props, 'tableName');
  if (table) return table;
  const regionId = ref(process.props, 'formRegion') ?? ref(process.props, 'editableRegion');
  const region = renderer.pageComponents(ctx, 'region').find((candidate) => candidate.id === regionId);
  return region ? str(region.props, 'source.tableName') : '';
}

function keyCondition(process: ApxComponent): { where: string; items: string[] } | undefined {
  const pkColumn = attribute(process.props, 'pkColumn');
  const pkItem = attribute(process.props, 'pkItem');
  if (!pkColumn || !pkItem) return undefined;
  const parts = [`${pkColumn.toUpperCase() === 'ROWID' ? 'rowid' : column(pkColumn)} = :${upper(pkItem)}`];
  const items = [upper(pkItem)];
  const secondColumn = attribute(process.props, 'secondaryKeyColumn');
  const secondItem = attribute(process.props, 'secondaryKeyItem');
  if (secondColumn && secondItem) {
    parts.push(`${column(secondColumn)} = :${upper(secondItem)}`);
    items.push(upper(secondItem));
  }
  return { where: parts.join(' and '), items };
}

/** Legacy Automatic Row Fetch: loads the row identified by the primary key item into the page items. */
export const autoRowFetch: ProcessHandler = (renderer, ctx, process) => {
  const table = tableOf(renderer, ctx, process);
  const key = keyCondition(process);
  if (!table || !key) {
    renderer.diagnose(
      'warning',
      `Automatic Row Fetch ${process.id} needs a table, primary key column and item`,
      ctx.pageId,
      process.id,
    );
    return { ran: false };
  }
  if (key.items.some((item) => !ctx.session.items[item])) return { ran: false };
  const items = columnItems(renderer, ctx);
  renderer.ensureTable(ctx, table, [
    { name: attribute(process.props, 'pkColumn'), type: 'number', pk: true },
    ...items.map((entry) => ({ name: entry.column, type: 'varchar2' })),
  ]);
  const runtime = attribute(process.props, 'runtimeWhereClause');
  try {
    const result = renderer.db.query(
      `select * from ${table} where ${key.where}${runtime ? ` and (${runtime})` : ''}`,
      renderer.binds(ctx.session, ctx.page),
      1,
    );
    const row = result.rows[0];
    if (!row) return { ran: false };
    for (const entry of items) {
      const value = row[upper(entry.column)];
      if (value !== undefined) ctx.session.items[entry.item] = value === null ? '' : String(value);
    }
    return { ran: true };
  } catch (error) {
    renderer.diagnose(
      'warning',
      `Automatic Row Fetch ${process.id} failed: ${(error as Error).message}`,
      ctx.pageId,
      process.id,
    );
    return { ran: false };
  }
};

/** Legacy Automatic Row Processing (DML): insert, update or delete by request or button action. */
export const autoRowProcessing: ProcessHandler = (renderer, ctx, process, point, pressed) => {
  if (point !== 'submit') return { ran: false };
  const table = tableOf(renderer, ctx, process);
  const key = keyCondition(process);
  if (!table || !key) {
    renderer.diagnose(
      'warning',
      `Automatic Row Processing ${process.id} needs a table, primary key column and item`,
      ctx.pageId,
      process.id,
    );
    return { ran: false };
  }
  const supported = (attribute(process.props, 'supportedOperations') || 'insert,update,delete').toLowerCase();
  const allows = (operation: string) =>
    new RegExp(`(^|[^a-z])(${operation}|${operation[0]})([^a-z]|$)`, 'u').test(supported);
  const action = pressed ? str(pressed.props, 'behavior.databaseAction') : '';
  const request = ctx.request.toUpperCase();
  const operation =
    action === 'insert' || /^(CREATE|INSERT|ADD|CREATE_AGAIN|CREATE AGAIN)$/u.test(request)
      ? 'insert'
      : action === 'update' ||
          /^(SAVE|APPLY CHANGES|UPDATE|APPLY_CHANGES|NEXT|PREVIOUS|GET_NEXT|GET_PREVIOUS)/u.test(request)
        ? 'update'
        : action === 'delete' || /^(DELETE|REMOVE|MULTI_ROW_DELETE)$/u.test(request)
          ? 'delete'
          : '';
  if (!operation || !allows(operation)) return { ran: false };
  const items = columnItems(renderer, ctx);
  const pkColumn = attribute(process.props, 'pkColumn');
  const pkItem = upper(attribute(process.props, 'pkItem'));
  renderer.ensureTable(ctx, table, [
    { name: pkColumn, type: 'number', pk: true },
    ...items.map((entry) => ({ name: entry.column, type: 'varchar2' })),
  ]);
  const existing = new Set(renderer.db.tableColumns(table.replaceAll('"', '')).map((entry) => entry.name));
  const values = items.filter(
    (entry) => existing.has(upper(entry.column)) && upper(entry.column) !== upper(pkColumn),
  );
  const binds = renderer.binds(ctx.session, ctx.page);
  try {
    if (operation === 'insert') {
      if (!ctx.session.items[pkItem] && pkColumn.toUpperCase() !== 'ROWID') {
        const next = renderer.db.scalar(`select coalesce(max(${column(pkColumn)}), 0) + 1 from ${table}`);
        ctx.session.items[pkItem] = String(next);
        binds[pkItem] = String(next);
      }
      const names = [
        ...(pkColumn.toUpperCase() === 'ROWID' ? [] : [{ item: pkItem, column: pkColumn }]),
        ...values,
      ];
      renderer.db.execute(
        `insert into ${table} (${names.map((entry) => column(entry.column)).join(', ')}) values (${names.map((entry) => `:${entry.item}`).join(', ')})`,
        binds,
      );
      const returnItem = upper(attribute(process.props, 'returnKeyIntoItem'));
      if (returnItem) ctx.session.items[returnItem] = ctx.session.items[pkItem] ?? '';
    } else if (operation === 'update') {
      if (key.items.some((item) => !ctx.session.items[item]) || !values.length) return { ran: false };
      renderer.db.execute(
        `update ${table} set ${values.map((entry) => `${column(entry.column)} = :${entry.item}`).join(', ')} where ${key.where}`,
        binds,
      );
    } else {
      if (key.items.some((item) => !ctx.session.items[item])) return { ran: false };
      renderer.db.execute(`delete from ${table} where ${key.where}`, binds);
    }
    ctx.session.success ??= 'Action Processed.';
    return { ran: true };
  } catch (error) {
    renderer.diagnose(
      'error',
      `Automatic Row Processing on ${table} failed: ${(error as Error).message}`,
      ctx.pageId,
      process.id,
    );
    const message: ApexError = {
      type: 'error',
      location: ['page'],
      message: (error as Error).message,
      unsafe: false,
    };
    return { ran: false, errors: [message] };
  }
};

/** Form Pagination: sets the previous/next primary key items (and "row X of Y") for the current key. */
export const formPagination: ProcessHandler = (renderer, ctx, process) => {
  const table = tableOf(renderer, ctx, process);
  const pkColumn = attribute(process.props, 'pkColumn') || 'ROWID';
  const pkItem = upper(attribute(process.props, 'pkItem'));
  const nextItem = upper(attribute(process.props, 'nextPkItem'));
  const prevItem = upper(attribute(process.props, 'prevPkItem'));
  const countItem = upper(attribute(process.props, 'currentRowCountItem'));
  if (!table || !pkItem) {
    renderer.diagnose(
      'warning',
      `Form Pagination ${process.id} needs a table and primary key item`,
      ctx.pageId,
      process.id,
    );
    return { ran: false };
  }
  if (attribute(process.props, 'secondaryKeyColumn'))
    renderer.diagnose(
      'info',
      `Form Pagination ${process.id}: secondary keys are ignored locally`,
      ctx.pageId,
      process.id,
    );
  const key = pkColumn.toUpperCase() === 'ROWID' ? 'rowid' : column(pkColumn);
  renderer.ensureTable(
    ctx,
    table,
    pkColumn.toUpperCase() === 'ROWID' ? [] : [{ name: pkColumn, type: 'number', pk: true }],
  );
  const order = [
    attribute(process.props, 'navigationOrderColumn'),
    attribute(process.props, 'secondaryNavigationOrderColumn'),
  ]
    .filter(Boolean)
    .map(column);
  const runtime = attribute(process.props, 'runtimeWhereClause');
  try {
    const result = renderer.db.query(
      `select ${key} as "APEX_LOCAL_KEY" from ${table}${runtime ? ` where ${runtime}` : ''} order by ${[...order, key].join(', ')}`,
      renderer.binds(ctx.session, ctx.page),
      100_000,
    );
    const keys = result.rows.map((row) => String(row.APEX_LOCAL_KEY ?? ''));
    const index = keys.indexOf(ctx.session.items[pkItem] ?? '');
    if (nextItem) ctx.session.items[nextItem] = index >= 0 ? (keys[index + 1] ?? '') : '';
    if (prevItem) ctx.session.items[prevItem] = index > 0 ? (keys[index - 1] ?? '') : '';
    if (countItem) ctx.session.items[countItem] = index >= 0 ? `${index + 1} of ${keys.length}` : '';
    return { ran: true };
  } catch (error) {
    renderer.diagnose(
      'warning',
      `Form Pagination ${process.id} failed: ${(error as Error).message}`,
      ctx.pageId,
      process.id,
    );
    return { ran: false };
  }
};

/** Reset Pagination: this page, listed pages or all pages. */
export const resetPagination: ProcessHandler = (renderer, ctx, process) => {
  const target = attribute(process.props, 'target') || 'thisPage';
  const pages =
    target === 'allPages'
      ? undefined
      : target === 'pages'
        ? list(process.props, 'resetPagination.pages').length
          ? list(process.props, 'resetPagination.pages').map(String)
          : attribute(process.props, 'pages')
              .split(/[,:\s]+/u)
              .filter(Boolean)
        : [ctx.pageId];
  const ids = pages?.map((page) => renderer.findPage(page)?.id ?? page);
  for (const key of Object.keys(ctx.session.pagination)) {
    const page = key.split(':')[0]!;
    if (!ids || ids.includes(page)) delete ctx.session.pagination[key];
  }
  return { ran: true } satisfies ProcessResult;
};

export const LEGACY_PROCESSES: Record<string, ProcessHandler> = {
  autoRowFetch,
  autoRowProcessing,
  legacyAutoRowProcessing: autoRowProcessing,
  formPagination,
  resetPagination,
};

const RENDER_POINTS = new Set(['afterHeader', 'beforeRegions']);

/** Runs the legacy process types placed after the header (the core only runs Before Header ones). */
export function runAfterHeader(renderer: ApexRenderer, ctx: RenderContext): void {
  const processes = renderer
    .pageComponents(ctx, 'process')
    .filter(
      (process) =>
        RENDER_POINTS.has(str(process.props, 'execution.point')) &&
        LEGACY_PROCESSES[str(process.props, 'type')],
    )
    .sort(
      (a, b) =>
        Number(get(a.props, 'execution.sequence') ?? 0) - Number(get(b.props, 'execution.sequence') ?? 0),
    );
  for (const process of processes) {
    if (!renderer.condition(ctx, process.props)) continue;
    LEGACY_PROCESSES[str(process.props, 'type')]!(renderer, ctx, process, 'beforeHeader', undefined);
  }
}

/**
 * "Next Page" / "Previous Page" buttons page the report regions that use external pagination
 * buttons (or the report the button belongs to), then the page reloads.
 */
export function pageReports(renderer: ApexRenderer, ctx: RenderContext): void {
  const pressed = renderer
    .pageComponents(ctx, 'button')
    .find((button) => str(button.props, 'buttonName', button.id.toUpperCase()) === ctx.request);
  const action = pressed ? str(pressed.props, 'behavior.action') : '';
  if (!pressed || (action !== 'nextPage' && action !== 'previousPage')) return;
  const regions = renderer.pageComponents(ctx, 'region');
  const external = regions.filter(
    (region) => str(region.props, 'pagination.type') === 'externalPaginationButtons',
  );
  const own = regions.filter(
    (region) =>
      region.id === ref(pressed.props, 'layout.region') && /report|tabform/iu.test(str(region.props, 'type')),
  );
  const targets = external.length ? external : own;
  for (const region of targets) {
    const key = stateKey(ctx.pageId, region.id);
    const current = ctx.session.pagination[key] ?? 1;
    ctx.session.pagination[key] = Math.max(1, current + (action === 'nextPage' ? 1 : -1));
  }
  if (!targets.length)
    renderer.diagnose(
      'info',
      `Button ${pressed.id} (${action}) submits the page; no report with external pagination buttons to page`,
      ctx.pageId,
      pressed.id,
    );
}
