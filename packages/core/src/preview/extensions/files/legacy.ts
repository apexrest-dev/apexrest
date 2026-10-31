import { isObject, isRef, str, type ApxComponent, type ApxObject, type ApxValue } from '../../apexlang.ts';
import type { ProcessResult, RegionRenderer } from '../../extensions.ts';
import type { ApexRenderer, RenderContext, Session } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import { parseFile } from './parse.ts';
import { storedFile } from './store.ts';

/**
 * The legacy data upload wizard (Parse Uploaded Data, Data Upload Column Mapping region,
 * Prepare Uploaded Data, Load Uploaded Data). APEX keeps the state in collections; the
 * preview keeps it per session.
 */

interface LegacyUpload {
  definition?: string | undefined;
  headers: string[];
  rows: string[][];
  mapping?: string[];
  prepared?: { values: Record<string, string>[]; inserts: number; updates: number; errors: number };
}

const uploads = new WeakMap<Session, LegacyUpload>();
const arrays = new WeakMap<Session, Record<string, string[]>>();

/** f01-f50 arrays of the last submit (the column mapping selects post as f01). */
export function rememberArrays(session: Session, form: URLSearchParams): void {
  const values: Record<string, string[]> = {};
  for (const key of new Set(form.keys()))
    if (/^f\d\d$/iu.test(key)) values[key.toLowerCase()] = form.getAll(key);
  arrays.set(session, values);
}

/** First value named `key` anywhere in the property tree. */
function deep(props: ApxObject, key: string): string {
  for (const [name, value] of Object.entries(props)) {
    if (name === key) return isRef(value) ? value.ref : typeof value === 'string' ? value : '';
    if (isObject(value as ApxValue)) {
      const found = deep(value as ApxObject, key);
      if (found) return found;
    }
  }
  return '';
}

function legacyDefinition(
  renderer: ApexRenderer,
  process: ApxComponent | undefined,
): ApxComponent | undefined {
  const id = process ? deep(process.props, 'dataLoadDefinition') : '';
  return (
    (id ? renderer.shared('legacyDataLoadDefinition', id) : undefined) ??
    renderer.app.shared.find((component) => component.type === 'legacyDataLoadDefinition')
  );
}

const itemValue = (ctx: RenderContext, props: ApxObject, key: string) => {
  const item = deep(props, key);
  return item ? (ctx.session.items[item.toUpperCase()] ?? '') : '';
};

const counts = (ctx: RenderContext, process: ApxComponent, values: Record<string, number>) => {
  for (const [key, value] of Object.entries(values)) {
    const item = deep(process.props, key);
    if (item) ctx.session.items[item.toUpperCase()] = String(value);
  }
};

export function parseUploadedData(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): ProcessResult {
  const definition = legacyDefinition(renderer, process);
  const importFrom = itemValue(ctx, process.props, 'importFromItem').toUpperCase();
  const pasted = itemValue(ctx, process.props, 'copyAndPasteItem');
  const fileName = itemValue(ctx, process.props, 'fileNameItem');
  const usePaste = importFrom.includes('PASTE') || (!fileName && pasted);
  const file = !usePaste && fileName ? storedFile(renderer.db, fileName.split(':')[0]!) : undefined;
  const bytes = usePaste ? Buffer.from(pasted, 'utf8') : file?.bytes;
  if (!bytes?.length)
    return {
      ran: false,
      errors: [{ type: 'error', location: ['page'], message: 'No data to upload.', unsafe: false }],
    };
  const separator = itemValue(ctx, process.props, 'separatorItem') || undefined;
  const enclosedBy = itemValue(ctx, process.props, 'enclosedByItem') || '"';
  const firstRow = itemValue(ctx, process.props, 'firstRowItem');
  const table = parseFile(bytes, usePaste ? 'pasted.csv' : file?.filename, {
    separator: separator === '\\t' ? '\t' : separator,
    enclosedBy,
    headers: !/^(N|NO|FALSE|0)$/iu.test(firstRow),
  });
  uploads.set(ctx.session, { definition: definition?.id, headers: table.columns, rows: table.rows });
  renderer.diagnose(
    'info',
    `Parse Uploaded Data: ${table.rows.length} rows kept in the preview session (no collections)`,
    ctx.pageId,
    process.id,
  );
  return { ran: true };
}

function targetColumns(renderer: ApexRenderer, definition: ApxComponent | undefined): string[] {
  const table = definition ? str(definition.props, 'target.tableName') : '';
  return table && renderer.db.tableExists(table)
    ? renderer.db.tableColumns(table).map((column) => column.name)
    : [];
}

/** Data Upload Column Mapping region: one select per uploaded column (posted as f01) above the first rows. */
export const columnMappingRegion: RegionRenderer = (renderer, ctx, region) => {
  const upload = uploads.get(ctx.session);
  if (!upload)
    return '<div class="apex-local-unsupported">Upload a file first; the column mapping shows the parsed data of this session.</div>';
  const definition = upload.definition
    ? renderer.shared('legacyDataLoadDefinition', upload.definition)
    : legacyDefinition(renderer, undefined);
  const columns = targetColumns(renderer, definition);
  const options = (header: string, index: number) => {
    const chosen =
      upload.mapping?.[index] ??
      columns.find((column) => column === header.toUpperCase().replace(/\W+/gu, '_')) ??
      '';
    return [
      `<option value="">- Do not load -</option>`,
      ...columns.map(
        (column) =>
          `<option value="${escapeHtml(column)}"${column === chosen ? ' selected' : ''}>${escapeHtml(column)}</option>`,
      ),
    ].join('');
  };
  const head = upload.headers
    .map(
      (header, index) =>
        `<th class="t-Report-colHead"><label class="u-VisuallyHidden" for="${region.id}_map_${index}">${escapeHtml(header)}</label><select class="selectlist apex-item-select" name="f01" id="${region.id}_map_${index}">${options(header, index)}</select><div>${escapeHtml(header)}</div></th>`,
    )
    .join('');
  const body = upload.rows
    .slice(0, 10)
    .map(
      (row) => `<tr>${row.map((cell) => `<td class="t-Report-cell">${escapeHtml(cell)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<div class="t-Report t-Report--stretch"><div class="t-Report-tableWrap"><table class="t-Report-report"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div><div class="t-Report-pagination">${upload.rows.length} rows</div></div>`;
};

function uniqueColumns(definition: ApxComponent | undefined): string[] {
  if (!definition) return [];
  return [1, 2, 3]
    .map((index) => str(definition.props, `uniqueKeys.uniqueColumn${index}`).toUpperCase())
    .filter(Boolean);
}

export function prepareUploadedData(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): ProcessResult {
  const upload = uploads.get(ctx.session);
  if (!upload) return { ran: false };
  const definition = legacyDefinition(renderer, process);
  const table = definition ? str(definition.props, 'target.tableName') : '';
  const submitted = arrays.get(ctx.session)?.f01;
  upload.mapping = upload.headers.map(
    (header, index) =>
      submitted?.[index] ??
      (targetColumns(renderer, definition).includes(header.toUpperCase()) ? header.toUpperCase() : ''),
  );
  const keys = uniqueColumns(definition);
  let inserts = 0;
  let updates = 0;
  const values = upload.rows.map((row) => {
    const record: Record<string, string> = {};
    upload.mapping!.forEach((column, index) => {
      if (column) record[column] = row[index] ?? '';
    });
    const exists =
      table && keys.length && keys.every((key) => key in record)
        ? Number(
            renderer.db.scalar(
              `select count(*) from ${table} where ${keys.map((key, index) => `"${key}" = :K${index}`).join(' and ')}`,
              Object.fromEntries(keys.map((key, index) => [`K${index}`, record[key]!])),
            ),
          ) > 0
        : false;
    if (exists) updates += 1;
    else inserts += 1;
    return record;
  });
  upload.prepared = { values, inserts, updates, errors: 0 };
  counts(ctx, process, {
    insertCountItem: inserts,
    updateCountItem: updates,
    errorCountItem: 0,
    reviewCountItem: 0,
  });
  return { ran: true };
}

export function loadUploadedData(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): ProcessResult {
  const upload = uploads.get(ctx.session);
  if (!upload?.prepared) {
    if (upload) prepareUploadedData(renderer, ctx, process);
    if (!uploads.get(ctx.session)?.prepared) return { ran: false };
  }
  const prepared = uploads.get(ctx.session)!.prepared!;
  const definition = legacyDefinition(renderer, process);
  const table = definition ? str(definition.props, 'target.tableName') : '';
  if (!table || !renderer.db.tableExists(table)) {
    renderer.diagnose(
      'warning',
      `Load Uploaded Data: target table ${table || '(none)'} does not exist`,
      ctx.pageId,
      process.id,
    );
    return { ran: false };
  }
  const keys = uniqueColumns(definition);
  let inserts = 0;
  let updates = 0;
  let errors = 0;
  for (const record of prepared.values) {
    const names = Object.keys(record);
    const binds = Object.fromEntries(names.map((name, index) => [`V${index}`, record[name]!]));
    const bind = (name: string) => `:V${names.indexOf(name)}`;
    try {
      const where =
        keys.length && keys.every((key) => names.includes(key))
          ? keys.map((key) => `"${key}" = ${bind(key)}`).join(' and ')
          : '';
      const others = names.filter((name) => !keys.includes(name));
      const changed =
        where && others.length
          ? renderer.db.execute(
              `update ${table} set ${others.map((name) => `"${name}" = ${bind(name)}`).join(', ')} where ${where}`,
              binds,
            ).changes
          : 0;
      if (changed) updates += 1;
      else {
        renderer.db.execute(
          `insert into ${table} (${names.map((name) => `"${name}"`).join(', ')}) values (${names.map(bind).join(', ')})`,
          binds,
        );
        inserts += 1;
      }
    } catch (error) {
      errors += 1;
      renderer.diagnose('warning', `Load Uploaded Data: ${(error as Error).message}`, ctx.pageId, process.id);
    }
  }
  counts(ctx, process, {
    insertCountItem: inserts,
    updateCountItem: updates,
    errorCountItem: errors,
    reviewCountItem: 0,
  });
  uploads.delete(ctx.session);
  ctx.session.success = `${inserts + updates + errors} rows processed: ${inserts} inserted, ${updates} updated, ${errors} with errors.`;
  return { ran: true };
}
