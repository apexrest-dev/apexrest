import { ref, str, type ApxComponent } from '../../apexlang.ts';
import { formatOracle } from '../../database.ts';
import type { RouteHandler } from '../../extensions.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import { dynamicActionChild, route } from './blob.ts';

/**
 * Report printing: Print Report processes and dynamic actions (report queries) and region
 * printing render a print-friendly HTML page instead of a PDF or Office document.
 */

interface PrintTable {
  title: string;
  headings: string[];
  rows: string[][];
  error?: string;
}

const heading = (name: string) =>
  name
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ');

function queryTable(renderer: ApexRenderer, ctx: RenderContext, title: string, sql: string): PrintTable {
  try {
    const result = renderer.db.query(sql, renderer.binds(ctx.session, ctx.page), 5000);
    return {
      title,
      headings: result.columns.map(heading),
      rows: result.rows.map((row) => result.columns.map((column) => String(row[column] ?? ''))),
    };
  } catch (error) {
    return { title, headings: [], rows: [], error: (error as Error).message };
  }
}

function regionTable(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): PrintTable {
  const title = renderer.substitute(ctx.session, str(region.props, 'name', region.id), ctx.page, 'RAW');
  const sql = renderer.regionSql(ctx, region);
  if (!sql) return { title, headings: [], rows: [], error: 'The region has no SQL source to print.' };
  const result = renderer.query(ctx, region, sql, 5000);
  const declared = result.columns.length ? renderer.columns(region, result.columns) : [];
  const printable = declared.filter(
    (column) =>
      str(column.props, 'exportPrinting.includeInExportPrint') !== 'false' &&
      result.columns.includes(column.id.toUpperCase()),
  );
  return {
    title,
    headings: printable.map((column) => str(column.props, 'heading.heading') || heading(column.id)),
    rows: result.rows.map((row) =>
      printable.map((column) => {
        const value = row[column.id.toUpperCase()];
        const mask = str(column.props, 'appearance.formatMask');
        return value === null || value === undefined
          ? ''
          : mask
            ? (formatOracle(value, mask) ?? '')
            : String(value);
      }),
    ),
    ...(result.error ? { error: result.error } : {}),
  };
}

function reportQueryTables(renderer: ApexRenderer, ctx: RenderContext, query: ApxComponent): PrintTable[] {
  const sources = query.children
    .filter((child) => child.type === 'sourceQuery')
    .sort((a, b) => Number(str(a.props, 'sequence', '0')) - Number(str(b.props, 'sequence', '0')));
  return sources.map((source) =>
    queryTable(
      renderer,
      ctx,
      str(source.props, 'name', source.id),
      str(source.props, 'source.sqlQuery') ||
        str(source.props, 'sqlQuery') ||
        str(source.props, 'source.query'),
    ),
  );
}

export function printDocument(
  renderer: ApexRenderer,
  title: string,
  tables: PrintTable[],
  note: string,
): string {
  const body = tables
    .map(
      (table) =>
        `<section><h2>${escapeHtml(table.title)}</h2>${
          table.error
            ? `<p class="error">${escapeHtml(table.error)}</p>`
            : `<table><thead><tr>${table.headings.map((name) => `<th>${escapeHtml(name)}</th>`).join('')}</tr></thead><tbody>${table.rows
                .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
                .join('')}</tbody></table><p class="count">${table.rows.length} rows</p>`
        }</section>`,
    )
    .join('');
  const app = escapeHtml(str(renderer.app.app.props, 'name', renderer.alias));
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light}
body{font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d1d1f;margin:24px auto;max-width:1100px;padding:0 16px;background:#fff}
header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #1d1d1f;padding-bottom:8px;margin-bottom:16px}
h1{font-size:20px;margin:0}header small{color:#555}
h2{font-size:15px;margin:20px 0 6px}
.note{background:#fff7e0;border:1px solid #e8c766;border-radius:4px;padding:8px 10px;margin:0 0 16px;color:#5c4400}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9c9cc;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#f1f1f3}tbody tr:nth-child(even) td{background:#fafafa}.count{color:#666;font-size:12px}.error{color:#a4000f}
button{font:inherit;padding:6px 12px;border-radius:4px;border:1px solid #888;background:#fff;cursor:pointer}
@media print{.note,.actions{display:none}body{margin:0;max-width:none}thead{display:table-header-group}tr{break-inside:avoid}}
</style></head><body>
<header><div><h1>${escapeHtml(title)}</h1><small>${app} · printed ${escapeHtml(new Date().toLocaleString('en-GB'))}</small></div>
<div class="actions"><button type="button" onclick="window.print()">Print</button> <button type="button" onclick="history.length > 1 ? history.back() : window.close()">Close</button></div></header>
<p class="note">${escapeHtml(note)}</p>${body}</body></html>`;
}

const NOTE =
  'Local preview: report printing is rendered as print-friendly HTML. A real APEX instance produces the PDF, Word or Excel document from the report layout.';

/** `?page=&region=` (region printing) or `?page=&process=` / `?page=&action=<da>/<action>` (report query). */
export const printRoute: RouteHandler = (renderer, session, request) => {
  const pageId = request.params.get('page') ?? '';
  if (!renderer.findPage(pageId)) return { status: 404, type: 'text', body: 'Page not found' };
  const ctx = renderer.prepareSubmit(session, pageId, '');
  const regionId = request.params.get('region');
  if (regionId) {
    const region = renderer.pageComponents(ctx, 'region').find((child) => child.id === regionId);
    if (!region) return { status: 404, type: 'text', body: 'Region not found' };
    const table = regionTable(renderer, ctx, region);
    return { type: 'html', body: printDocument(renderer, table.title, [table], NOTE) };
  }
  const processId = request.params.get('process');
  const actionId = request.params.get('action');
  const owner = processId
    ? renderer.pageComponents(ctx, 'process').find((child) => child.id === processId)
    : actionId
      ? dynamicActionChild(ctx, actionId)
      : undefined;
  if (!owner) return { status: 404, type: 'text', body: 'Print definition not found' };
  const queryId = ref(owner.props, 'source.reportQuery') ?? ref(owner.props, 'settings.reportQuery');
  const query = queryId ? renderer.shared('reportQuery', queryId) : undefined;
  if (!query) {
    renderer.diagnose(
      'warning',
      `Print report ${owner.id}: report query ${queryId ?? ''} not found`,
      pageId,
      owner.id,
    );
    return { status: 404, type: 'text', body: 'Report query not found' };
  }
  const title = str(query.props, 'name', query.id);
  return {
    type: 'html',
    body: printDocument(renderer, title, reportQueryTables(renderer, ctx, query), NOTE),
  };
};

export const printUrl = (renderer: ApexRenderer, params: Record<string, string>) =>
  route(renderer, 'files.print', params);
