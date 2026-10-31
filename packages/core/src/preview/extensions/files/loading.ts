import { bool, num, ref, str, type ApxComponent } from '../../apexlang.ts';
import { isoDate, parseOracleDate, type Binds, type LocalDatabase } from '../../database.ts';
import type { ProcessResult } from '../../extensions.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { columnName, detectType, formatOf, parseFile, type FileFormat, type ParseOptions } from './parse.ts';
import { storedFile } from './store.ts';

/**
 * Data loading: data load definitions as file profiles, apex_data_parser over uploaded files and
 * the Data Loading process inserting into SQLite with processed/error row counts.
 */

export const FILE_TYPES: Record<FileFormat, number> = { xlsx: 1, csv: 2, xml: 3, json: 4 };
const FORMAT_BY_TYPE: Record<number, FileFormat> = { 1: 'xlsx', 2: 'csv', 3: 'xml', 4: 'json' };
const DATA_TYPES: Record<string, number> = { VARCHAR2: 1, NUMBER: 2, DATE: 3, TIMESTAMP: 4, CLOB: 6 };
const DATA_TYPE_NAMES: Record<number, string> = {
  1: 'VARCHAR2',
  2: 'NUMBER',
  3: 'DATE',
  4: 'TIMESTAMP',
  6: 'CLOB',
};

export interface ProfileColumn {
  name: string;
  'data-type': number;
  'data-type-len'?: number;
  selector?: string;
  'selector-type'?: 'name' | 'sequence' | 'regexp';
  'column-number'?: number;
  'format-mask'?: string;
  'decimal-char'?: string;
  'group-char'?: string;
  'is-primary-key'?: boolean;
  'line-number'?: boolean;
  'regex-pattern'?: string;
  hidden?: boolean;
  /** Not part of APEX's profile JSON: the definition column (transformations, lookups, computations). */
  'apex-local-column'?: string;
}

/** A file profile in apex_data_parser's JSON shape. */
export interface FileProfile {
  'file-type': number;
  'file-encoding'?: string;
  'headings-in-first-row'?: boolean;
  'csv-col-delimiter'?: string;
  'csv-enclosed'?: string;
  'skip-rows'?: number;
  'xlsx-worksheet'?: string;
  'row-selector'?: string;
  'parsed-rows'?: number;
  columns: ProfileColumn[];
}

const DATA_TYPE_OF: Record<string, string> = {
  varchar2: 'VARCHAR2',
  number: 'NUMBER',
  date: 'DATE',
  timestamp: 'TIMESTAMP',
  timestampWithTimeZone: 'TIMESTAMP',
  timestampWithLocalTimeZone: 'TIMESTAMP',
  clob: 'CLOB',
};

export function findDefinition(renderer: ApexRenderer, staticId: string): ApxComponent | undefined {
  const wanted = staticId.toLowerCase();
  return renderer.app.shared.find(
    (component) =>
      component.type === 'dataLoadDefinition' &&
      [str(component.props, 'advanced.staticId'), component.id, str(component.props, 'name')].some(
        (key) => key && key.toLowerCase() === wanted,
      ),
  );
}

const definitionColumns = (definition: ApxComponent) =>
  definition.children
    .filter((child) => child.type === 'dataProfileColumn')
    .sort((a, b) => num(a.props, 'source.sequence', 0) - num(b.props, 'source.sequence', 0));

export function definitionProfile(definition: ApxComponent): FileProfile {
  const format = (str(definition.props, 'dataProfile.format', 'csv') as FileFormat) || 'csv';
  const optional = <T>(key: string, value: T | undefined | '') =>
    value === undefined || value === '' ? {} : { [key]: value };
  return {
    'file-type': FILE_TYPES[format] ?? 2,
    ...optional('file-encoding', str(definition.props, 'advanced.encoding')),
    'headings-in-first-row': bool(definition.props, 'advanced.firstLineContainsHeaders', true),
    ...optional('csv-col-delimiter', str(definition.props, 'advanced.csvSeparator')),
    ...optional('csv-enclosed', str(definition.props, 'advanced.csvEnclosedBy')),
    ...optional('skip-rows', num(definition.props, 'advanced.skipRows', 0) || undefined),
    ...optional('xlsx-worksheet', str(definition.props, 'advanced.defaultXlsxSheetName')),
    ...optional('row-selector', str(definition.props, 'dataProfile.rowSelector')),
    columns: definitionColumns(definition).map((column) => {
      const dataType = DATA_TYPE_OF[str(column.props, 'source.dataType', 'varchar2')] ?? 'VARCHAR2';
      const selectorType = str(column.props, 'parsing.selectorType');
      return {
        name: str(column.props, 'columnName', column.id).toUpperCase(),
        'data-type': DATA_TYPES[dataType] ?? 1,
        ...optional('data-type-len', num(column.props, 'source.maxLength', 0) || undefined),
        ...optional(
          'selector',
          str(column.props, 'parsing.selector') || str(column.props, 'parsing.pathExpression'),
        ),
        ...optional('selector-type', selectorType as ProfileColumn['selector-type']),
        ...optional('column-number', num(column.props, 'parsing.columnNumber', 0) || undefined),
        ...optional('format-mask', str(column.props, 'parsing.formatMask')),
        ...optional('decimal-char', str(column.props, 'parsing.decimalChar')),
        ...optional('group-char', str(column.props, 'parsing.groupChar')),
        ...optional('regex-pattern', str(column.props, 'source.regexPattern')),
        ...(bool(column.props, 'source.primaryKey', false) ? { 'is-primary-key': true } : {}),
        ...(bool(column.props, 'source.lineNumber', false) ? { 'line-number': true } : {}),
        ...(bool(column.props, 'advanced.hidden', false) ? { hidden: true } : {}),
        'apex-local-column': column.id,
      };
    }),
  };
}

export interface ParserArgs {
  fileName?: string | undefined;
  fileType?: number | undefined;
  profile?: FileProfile | undefined;
  sheet?: string | undefined;
  rowSelector?: string | undefined;
  separator?: string | undefined;
  enclosedBy?: string | undefined;
  skipRows?: number | undefined;
  addHeadersRow?: boolean | undefined;
  maxRows?: number | undefined;
  encoding?: string | undefined;
}

function profileOptions(args: ParserArgs, bytes: Uint8Array): ParseOptions & { format: FileFormat } {
  const profile = args.profile;
  const format =
    FORMAT_BY_TYPE[args.fileType ?? 0] ??
    FORMAT_BY_TYPE[profile?.['file-type'] ?? 0] ??
    formatOf(args.fileName, bytes);
  return {
    format,
    separator: args.separator ?? profile?.['csv-col-delimiter'],
    enclosedBy: args.enclosedBy ?? profile?.['csv-enclosed'],
    skipRows: args.skipRows ?? profile?.['skip-rows'],
    sheet: args.sheet || profile?.['xlsx-worksheet'],
    rowSelector: args.rowSelector ?? profile?.['row-selector'],
    encoding: args.encoding ?? profile?.['file-encoding'],
  };
}

/** Index of a profile column in the parsed columns, or -1. */
function sourceIndex(columns: string[], column: ProfileColumn, position: number): number {
  if (column['column-number']) return column['column-number'] - 1;
  const selector = column.selector;
  if (!selector) return columns.length > position ? position : -1;
  if (column['selector-type'] === 'sequence' && /^\d+$/u.test(selector)) return Number(selector) - 1;
  if (column['selector-type'] === 'regexp') {
    const pattern = new RegExp(selector, 'iu');
    return columns.findIndex((name) => pattern.test(name));
  }
  const wanted = selector
    .replace(/^\$\.?/u, '')
    .replace(/^\/+/u, '')
    .toLowerCase();
  return columns.findIndex(
    (name) => name.toLowerCase() === wanted || name.toLowerCase().replace(/^@/u, '') === wanted,
  );
}

/** Rows of apex_data_parser.parse: LINE_NUMBER plus COL001..COL300. */
export function parserRows(bytes: Uint8Array, args: ParserArgs): Record<string, string | number | null>[] {
  const options = profileOptions(args, bytes);
  const profile = args.profile;
  const tabular = options.format === 'csv' || options.format === 'xlsx';
  const headers = profile ? profile['headings-in-first-row'] !== false : false;
  const table = parseFile(bytes, args.fileName, { ...options, headers: tabular ? headers : true });
  const columns = profile?.columns.length
    ? profile.columns.map((column, position) => sourceIndex(table.columns, column, position))
    : table.columns.map((_, index) => index);
  const firstLine = (options.skipRows ?? 0) + (tabular && headers ? 1 : 0);
  const headerLine = !tabular && !profile && args.addHeadersRow !== false;
  const out: Record<string, string | number | null>[] = [];
  if (headerLine) {
    // JSON and XML have no header line; like APEX, line 1 then carries the column names
    const header: Record<string, string | number | null> = { LINE_NUMBER: 1 };
    table.columns.slice(0, 300).forEach((name, index) => (header[columnName(index)] = name));
    out.push(header);
  }
  table.rows.forEach((row, index) => {
    if (args.maxRows && out.length >= args.maxRows) return;
    const record: Record<string, string | number | null> = {
      LINE_NUMBER: tabular ? firstLine + index + 1 : index + (headerLine ? 2 : 1),
    };
    columns.slice(0, 300).forEach((source, position) => {
      const value = source >= 0 ? (row[source] ?? '') : '';
      record[columnName(position)] = value === '' ? null : value;
    });
    out.push(record);
  });
  return out;
}

/** apex_data_parser.discover: a profile with detected column names and types. */
export function discoverProfile(bytes: Uint8Array, args: ParserArgs): FileProfile {
  const options = profileOptions(args, bytes);
  const table = parseFile(bytes, args.fileName, { ...options, headers: true });
  return {
    'file-type': FILE_TYPES[options.format],
    'file-encoding': 'AL32UTF8',
    'headings-in-first-row': options.format === 'csv' || options.format === 'xlsx',
    ...(options.format === 'csv'
      ? { 'csv-col-delimiter': options.separator ?? ',', 'csv-enclosed': '"' }
      : {}),
    ...(options.sheet ? { 'xlsx-worksheet': options.sheet } : {}),
    ...(options.rowSelector ? { 'row-selector': options.rowSelector } : {}),
    'parsed-rows': table.rows.length,
    columns: table.columns.map((name, index) => {
      const detected = detectType(table.rows.slice(0, 200).map((row) => row[index] ?? ''));
      return {
        name:
          name
            .toUpperCase()
            .replace(/[^A-Z0-9_$#]+/gu, '_')
            .replace(/^_+|_+$/gu, '') || columnName(index),
        'data-type': DATA_TYPES[detected.type] ?? 1,
        'data-type-len': detected.length,
        selector: name,
        ...(detected.mask ? { 'format-mask': detected.mask } : {}),
      };
    }),
  };
}

export function profileColumns(profile: FileProfile): Record<string, string | number | null>[] {
  return profile.columns.map((column, index) => ({
    COLUMN_POSITION: index + 1,
    COLUMN_NAME: column.name,
    DATA_TYPE: DATA_TYPE_NAMES[column['data-type']] ?? 'VARCHAR2',
    DATA_TYPE_LEN: column['data-type-len'] ?? null,
    DECIMAL_CHAR: column['decimal-char'] ?? null,
    GROUP_CHAR: column['group-char'] ?? null,
    FORMAT_MASK: column['format-mask'] ?? null,
    SELECTOR: column.selector ?? null,
  }));
}

export function readProfile(value: unknown): FileProfile | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const profile = JSON.parse(value) as FileProfile;
    return Array.isArray(profile.columns) ? profile : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- loading

export interface LoadResult {
  processed: number;
  inserted: number;
  updated: number;
  errors: number;
  messages: string[];
}

function transform(column: ApxComponent | undefined, value: string): string {
  if (!column) return value;
  const type = str(column.props, 'transformation.type');
  const find = str(column.props, 'transformation.find');
  const replace = str(column.props, 'transformation.replaceWith');
  const trimChars = str(column.props, 'transformation.trimChars');
  const regexp = str(column.props, 'transformation.regexp');
  const escape = (chars: string) => chars.replace(/[\\\]^-]/gu, '\\$&');
  switch (type) {
    case 'trim':
      return trimChars
        ? value.replace(new RegExp(`^[${escape(trimChars)}]+|[${escape(trimChars)}]+$`, 'gu'), '')
        : value.trim();
    case 'leftTrim':
      return trimChars ? value.replace(new RegExp(`^[${escape(trimChars)}]+`, 'u'), '') : value.trimStart();
    case 'rightTrim':
      return trimChars ? value.replace(new RegExp(`[${escape(trimChars)}]+$`, 'u'), '') : value.trimEnd();
    case 'upper':
      return value.toUpperCase();
    case 'lower':
      return value.toLowerCase();
    case 'replace':
      return find ? value.replaceAll(find, replace) : value;
    case 'nullIf':
      return value === str(column.props, 'transformation.value') ? '' : value;
    case 'regexpReplace':
      return regexp ? value.replace(new RegExp(regexp, 'gu'), replace) : value;
    case 'regexpNullIf':
      return regexp && new RegExp(regexp, 'u').test(value) ? '' : value;
    default:
      return value;
  }
}

function convert(column: ProfileColumn, value: string): string | number | null {
  if (value === '') return null;
  const type = DATA_TYPE_NAMES[column['data-type']] ?? 'VARCHAR2';
  if (type === 'NUMBER') {
    const group = column['group-char'] ?? ',';
    const decimal = column['decimal-char'] ?? '.';
    const normalized = value
      .trim()
      .replace(/[\s$€£%]/gu, '')
      .replaceAll(group, '')
      .replace(decimal, '.');
    const number = Number(normalized);
    if (!normalized || !Number.isFinite(number)) throw new Error(`ORA-01722: invalid number (${value})`);
    return number;
  }
  if (type === 'DATE' || type === 'TIMESTAMP') {
    const date = parseOracleDate(value.trim(), column['format-mask'] || undefined);
    if (!date) throw new Error(`ORA-01861: literal does not match format string (${value})`);
    return isoDate(date, type === 'TIMESTAMP' || /\d:\d/u.test(value));
  }
  const max = column['data-type-len'];
  if (max && value.length > max)
    throw new Error(
      `ORA-12899: value too large for column ${column.name} (actual: ${value.length}, maximum: ${max})`,
    );
  if (column['regex-pattern'] && !new RegExp(column['regex-pattern'], 'u').test(value))
    throw new Error(`Value ${value} of ${column.name} does not match ${column['regex-pattern']}`);
  return value;
}

function createTarget(db: LocalDatabase, table: string, profile: FileProfile): void {
  const definitions = profile.columns.map((column) => {
    const type = DATA_TYPE_NAMES[column['data-type']] ?? 'VARCHAR2';
    return `"${column.name}" ${type === 'VARCHAR2' ? `VARCHAR2(${column['data-type-len'] ?? 4000})` : type}`;
  });
  db.execute(`create table "${table}" (${definitions.join(', ')})`);
}

/** Loads parsed rows into the definition's target table. */
export function loadData(
  renderer: ApexRenderer,
  ctx: RenderContext,
  definition: ApxComponent,
  bytes: Uint8Array,
  fileName: string,
  sheet?: string,
): LoadResult {
  const db = renderer.db;
  const profile = definitionProfile(definition);
  const result: LoadResult = { processed: 0, inserted: 0, updated: 0, errors: 0, messages: [] };
  const targetType = str(definition.props, 'target.type', 'table');
  const table = str(definition.props, 'target.tableName').replaceAll('"', '').toUpperCase();
  if (targetType === 'collection' || !table) {
    renderer.diagnose(
      'info',
      `Data load definition ${definition.id}: loading into a collection is not simulated (no apex_collection)`,
      ctx.pageId,
      definition.id,
    );
    return result;
  }
  const method = str(definition.props, 'target.loadingMethod', 'append');
  const onError = str(definition.props, 'errorHandling.whenOnError', 'stop');
  const columns = definitionColumns(definition);
  const options = profileOptions({ fileName, profile, sheet }, bytes);
  const parsed = parseFile(bytes, fileName, {
    ...options,
    headers:
      options.format === 'csv' || options.format === 'xlsx'
        ? profile['headings-in-first-row'] !== false
        : true,
  });
  const indexes = profile.columns.map((column, position) => sourceIndex(parsed.columns, column, position));
  if (!db.tableExists(table)) {
    createTarget(db, table, profile);
    renderer.diagnose(
      'info',
      `Table ${table} did not exist; created it from data load definition ${definition.id}. Put real DDL in .apex-local/*.sql`,
      ctx.pageId,
      definition.id,
    );
  }
  const existing = new Set(db.tableColumns(table).map((column) => column.name));
  const keys = profile.columns.filter((column) => column['is-primary-key'] && existing.has(column.name));
  const firstLine = (options.skipRows ?? 0) + (profile['headings-in-first-row'] !== false ? 1 : 0);
  const sessionBinds = renderer.binds(ctx.session, ctx.page);
  db.db.exec('savepoint apex_local_load');
  try {
    if (method === 'replace') db.execute(`delete from "${table}"`);
    parsed.rows.forEach((row, rowIndex) => {
      // empty lines and spreadsheet rows are skipped, as APEX does
      if (row.every((cell) => cell.trim() === '')) return;
      result.processed += 1;
      try {
        const values: Binds = {};
        profile.columns.forEach((column, position) => {
          const definitionColumn = columns.find((entry) => entry.id === column['apex-local-column']);
          const kind = definitionColumn ? str(definitionColumn.props, 'source.type', 'data') : 'data';
          if (column['line-number']) values[column.name] = firstLine + rowIndex + 1;
          else if (kind === 'data') {
            const source = indexes[position]!;
            values[column.name] = convert(
              column,
              transform(definitionColumn, source >= 0 ? (row[source] ?? '') : ''),
            );
          }
        });
        for (const [position, column] of profile.columns.entries()) {
          const definitionColumn = columns.find((entry) => entry.id === column['apex-local-column']);
          if (!definitionColumn) continue;
          const kind = str(definitionColumn.props, 'source.type', 'data');
          const binds = { ...sessionBinds, ...values };
          if (kind === 'sqlExpression' || kind === 'sqlQuery') {
            const sql =
              kind === 'sqlExpression'
                ? `select ${str(definitionColumn.props, 'computation.sqlExpression')}`
                : str(definitionColumn.props, 'computation.sqlQuery');
            values[column.name] = db.scalar(sql, binds);
          } else if (kind === 'lookup') {
            const lookupTable = str(definitionColumn.props, 'lookup.tableName');
            const conditions = [1, 2, 3]
              .map((index) => ({
                table: str(definitionColumn.props, `lookup.tableColumn${index}`),
                data: str(definitionColumn.props, `lookup.dataColumn${index}`).toUpperCase(),
              }))
              .filter((pair) => pair.table && pair.data);
            const source = indexes[position]!;
            const raw = source >= 0 ? (row[source] ?? '') : '';
            const lookupBinds: Binds = { ...binds };
            const where = conditions.map((pair, index) => {
              const data = values[pair.data] ?? (index === 0 ? raw : null);
              lookupBinds[`APEX_LOCAL_L${index}`] = data === undefined ? null : data;
              return `${pair.table} = :APEX_LOCAL_L${index}`;
            });
            const extra = str(definitionColumn.props, 'lookup.whereClause');
            if (extra) where.push(`(${extra})`);
            const found = db.query(
              `select ${str(definitionColumn.props, 'lookup.returnColumn')} from ${lookupTable}${where.length ? ` where ${where.join(' and ')}` : ''}`,
              lookupBinds,
              1,
            );
            const hit = found.rows[0];
            if (!hit) throw new Error(`Lookup of ${column.name} in ${lookupTable} found no row for ${raw}`);
            values[column.name] = hit[found.columns[0]!] ?? null;
          }
        }
        const names = Object.keys(values).filter((name) => existing.has(name));
        const bindName = (name: string) => `C_${name.replace(/\W/gu, '_')}`;
        const binds = Object.fromEntries(names.map((name) => [bindName(name), values[name]]));
        if (method === 'merge' && keys.length) {
          const where = keys.map((key) => `"${key.name}" = :${bindName(key.name)}`).join(' and ');
          const others = names.filter((name) => !keys.some((key) => key.name === name));
          const changed = others.length
            ? db.execute(
                `update "${table}" set ${others.map((name) => `"${name}" = :${bindName(name)}`).join(', ')} where ${where}`,
                binds,
              ).changes
            : Number(db.scalar(`select count(*) from "${table}" where ${where}`, binds));
          if (changed) {
            result.updated += 1;
            return;
          }
        }
        db.execute(
          `insert into "${table}" (${names.map((name) => `"${name}"`).join(', ')}) values (${names.map((name) => `:${bindName(name)}`).join(', ')})`,
          binds,
        );
        result.inserted += 1;
      } catch (error) {
        result.errors += 1;
        const message = `Line ${firstLine + rowIndex + 1}: ${(error as Error).message}`;
        result.messages.push(message);
        if (onError === 'logIntoErrorLog') {
          const errorTable = str(definition.props, 'errorHandling.tableName');
          try {
            if (errorTable)
              db.execute(`insert into ${errorTable} (ora_err_mesg$) values (:MESSAGE)`, { MESSAGE: message });
          } catch {
            /* the error log table is optional locally */
          }
        }
        if (onError === 'stop') throw error;
      }
    });
    db.db.exec('release apex_local_load');
  } catch (error) {
    db.db.exec('rollback to apex_local_load');
    db.db.exec('release apex_local_load');
    result.inserted = 0;
    result.updated = 0;
    if (!result.messages.length) result.messages.push((error as Error).message);
  }
  if (onError === 'logErrorIntoCollection' && result.errors)
    renderer.diagnose(
      'info',
      `Data load ${definition.id}: ${result.errors} error rows would be logged into collection ${str(definition.props, 'errorHandling.name')} (collections are not simulated)`,
      ctx.pageId,
      definition.id,
    );
  return result;
}

function fileFromItem(renderer: ApexRenderer, ctx: RenderContext, item: string) {
  const value = ctx.session.items[item.toUpperCase()] ?? '';
  return value ? storedFile(renderer.db, value.split(':')[0]!) : undefined;
}

/** Process type dataLoading (Data Loading with a data load definition). */
export function dataLoadingProcess(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): ProcessResult {
  const definitionId =
    ref(process.props, 'dataLoading.dataLoadDefinition') ??
    str(process.props, 'dataLoading.dataLoadDefinition');
  const definition = definitionId
    ? (renderer.shared('dataLoadDefinition', definitionId) ?? findDefinition(renderer, definitionId))
    : undefined;
  if (!definition) {
    renderer.diagnose(
      'warning',
      `Data loading process ${process.id}: data load definition ${definitionId ?? ''} not found`,
      ctx.pageId,
      process.id,
    );
    return { ran: false };
  }
  const sourceType = str(process.props, 'sourceData.sourceDataType', 'fileBrowseItem');
  let bytes: Uint8Array | undefined;
  let fileName = '';
  if (sourceType === 'textareaItem') {
    const text = ctx.session.items[str(process.props, 'sourceData.textareaItem').toUpperCase()] ?? '';
    bytes = Buffer.from(text, 'utf8');
    fileName = `pasted.${str(definition.props, 'dataProfile.format', 'csv')}`;
  } else if (sourceType === 'sqlQuery') {
    const sql = str(process.props, 'sourceData.sqlQuery');
    const result = sql ? renderer.db.rawQuery(sql, renderer.binds(ctx.session, ctx.page), 1) : undefined;
    const first = result?.rows[0];
    const value = first?.[0];
    bytes =
      value instanceof Uint8Array
        ? value
        : typeof value === 'string'
          ? Buffer.from(value, 'utf8')
          : undefined;
    fileName = typeof first?.[1] === 'string' ? first[1] : '';
  } else {
    const file = fileFromItem(renderer, ctx, str(process.props, 'sourceData.fileBrowseItem'));
    bytes = file?.bytes;
    fileName = file?.filename ?? '';
  }
  if (!bytes?.length) {
    return {
      ran: false,
      errors: [
        {
          type: 'error',
          location: ['page'],
          message: 'No data found to load. Choose a file first.',
          unsafe: false,
        },
      ],
    };
  }
  const sheetItem = str(process.props, 'sourceData.xlsxSheetNameItem');
  const sheet = sheetItem ? ctx.session.items[sheetItem.toUpperCase()] || undefined : undefined;
  let result: LoadResult;
  try {
    result = loadData(renderer, ctx, definition, bytes, fileName, sheet);
  } catch (error) {
    return {
      ran: false,
      errors: [{ type: 'error', location: ['page'], message: (error as Error).message, unsafe: false }],
    };
  }
  const set = (key: string, value: number) => {
    const item = str(process.props, `processingResult.${key}`);
    if (item) ctx.session.items[item.toUpperCase()] = String(value);
  };
  set('processedRowCountItem', result.processed);
  set('errorRowCountItem', result.errors);
  set('errorCountItem', result.errors);
  set('insertCountItem', result.inserted);
  set('updateCountItem', result.updated);
  set('reviewCountItem', 0);
  const summary = `${result.processed} rows processed: ${result.inserted} inserted, ${result.updated} updated, ${result.errors} with errors.`;
  renderer.diagnose(
    result.errors ? 'warning' : 'info',
    `Data loading ${definition.id} into ${str(definition.props, 'target.tableName')}: ${summary}${result.messages.length ? ` First error: ${result.messages[0]}` : ''}`,
    ctx.pageId,
    process.id,
  );
  if (result.errors && str(definition.props, 'errorHandling.whenOnError', 'stop') === 'stop')
    return {
      ran: false,
      errors: [
        {
          type: 'error',
          location: ['page'],
          message: result.messages[0] ?? 'Data loading failed',
          unsafe: false,
        },
      ],
    };
  ctx.session.success = summary;
  return { ran: true };
}
