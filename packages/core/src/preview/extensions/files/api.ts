import { str } from '../../apexlang.ts';
import {
  registerOracleFunction,
  registerTableFunction,
  type BlobSqlValue,
  type LocalDatabase,
} from '../../database.ts';
import type { ApexRenderer, Session } from '../../render.ts';
import {
  activeRuntime,
  STUBS,
  stubArgs,
  type Runtime,
  type Stub,
  type StubArgs,
} from '../server/apex-api.ts';
import { RecordValue } from '../server/plsql.ts';
import { itemPage, route } from './blob.ts';
import {
  definitionProfile,
  discoverProfile,
  FILE_TYPES,
  findDefinition,
  loadData,
  parserRows,
  profileColumns,
  readProfile,
  type ParserArgs,
} from './loading.ts';
import { formatOf, xlsxWorksheets } from './parse.ts';
import { mimeType, queueDownload } from './store.ts';

/**
 * APEX file APIs for PL/SQL and SQL: apex_data_parser, apex_data_loading, apex_util BLOB helpers,
 * dbms_lob/utl_raw basics and wpg_docload / apex_http downloads.
 */

let current: ApexRenderer | undefined;
/** The renderer of the request being served; SQL functions outside PL/SQL use it. */
export const setCurrentRenderer = (renderer: ApexRenderer) => {
  current = renderer;
};
const rendererOf = (rt: Runtime | undefined) => rt?.renderer ?? activeRuntime()?.renderer ?? current;
const dbOf = (rt: Runtime | undefined): LocalDatabase | undefined => rendererOf(rt)?.db;

const text = (value: unknown): string | undefined =>
  value === null || value === undefined || value === '' ? undefined : String(value);
const number = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(parsed)
    ? undefined
    : parsed;
};
const flag = (value: unknown) => value === true || /^(Y|YES|TRUE|1)$/iu.test(String(value ?? ''));

function bytesOf(value: unknown, db: LocalDatabase | undefined): Uint8Array | undefined {
  if (value instanceof Uint8Array) return value;
  if (typeof value !== 'string') return undefined;
  return db?.blob(value) ?? Buffer.from(value, 'utf8');
}

const PARSE_PARAMS = [
  'p_content',
  'p_file_name',
  'p_file_type',
  'p_file_profile',
  'p_detect_data_types',
  'p_decimal_char',
  'p_xlsx_sheet_name',
  'p_row_selector',
  'p_csv_row_delimiter',
  'p_csv_col_delimiter',
  'p_csv_enclosed',
  'p_skip_rows',
  'p_add_headers_row',
  'p_nullif',
  'p_file_charset',
  'p_max_rows',
  'p_return_rows',
  'p_store_profile_to_collection',
];

function parserArgs(args: Record<string, unknown>): ParserArgs {
  return {
    fileName: text(args.p_file_name),
    fileType: number(args.p_file_type),
    profile: readProfile(args.p_file_profile),
    sheet: text(args.p_xlsx_sheet_name),
    rowSelector: text(args.p_row_selector),
    separator: text(args.p_csv_col_delimiter),
    enclosedBy: text(args.p_csv_enclosed),
    skipRows: number(args.p_skip_rows),
    addHeadersRow:
      args.p_add_headers_row === undefined || args.p_add_headers_row === null
        ? undefined
        : flag(args.p_add_headers_row),
    maxRows: number(args.p_max_rows) ?? number(args.p_return_rows),
    encoding: text(args.p_file_charset),
  };
}

const named = (params: string[], values: unknown[]) =>
  Object.fromEntries(params.map((param, index) => [param, values[index]]));

function guard<T>(label: string, fallback: T, run: () => T): T {
  try {
    return run();
  } catch (error) {
    rendererOf(undefined)?.diagnose('warning', `${label}: ${(error as Error).message}`);
    return fallback;
  }
}

// ---------------------------------------------------------------- SQL table functions

const PARSE_COLUMNS = [
  'LINE_NUMBER',
  ...Array.from({ length: 300 }, (_, index) => `COL${String(index + 1).padStart(3, '0')}`),
];

registerTableFunction('apex_data_parser.parse', PARSE_PARAMS, PARSE_COLUMNS, (values) => {
  const args = named(PARSE_PARAMS, values);
  const bytes = bytesOf(args.p_content, dbOf(undefined));
  if (!bytes?.length) return [];
  return guard('apex_data_parser.parse', [], () => parserRows(bytes, parserArgs(args)));
});

registerTableFunction(
  'apex_data_parser.get_xlsx_worksheets',
  ['p_content'],
  ['SHEET_SEQUENCE', 'SHEET_DISPLAY_NAME', 'SHEET_FILE_NAME', 'SHEET_PATH'],
  ([content]) => {
    const bytes = bytesOf(content, dbOf(undefined));
    if (!bytes?.length || bytes[0] !== 0x50) return [];
    return guard('apex_data_parser.get_xlsx_worksheets', [], () =>
      xlsxWorksheets(bytes).map((sheet) => ({
        SHEET_SEQUENCE: sheet.sequence,
        SHEET_DISPLAY_NAME: sheet.name,
        SHEET_FILE_NAME: sheet.file,
        SHEET_PATH: sheet.path,
      })),
    );
  },
);

registerTableFunction(
  'apex_data_parser.get_columns',
  ['p_profile'],
  [
    'COLUMN_POSITION',
    'COLUMN_NAME',
    'DATA_TYPE',
    'DATA_TYPE_LEN',
    'DECIMAL_CHAR',
    'GROUP_CHAR',
    'FORMAT_MASK',
    'SELECTOR',
  ],
  ([profile]) => {
    const parsed = readProfile(profile);
    return parsed ? profileColumns(parsed) : [];
  },
);

// ---------------------------------------------------------------- functions for SQL and PL/SQL

type Fn = (args: StubArgs, rt: Runtime | undefined) => unknown;

/** Adds a PL/SQL stub; with `sql`, also a SQLite function that sees BLOBs as bytes. */
function api(name: string, params: string[], fn: Fn, sql = false): void {
  const stub: Stub = { params, fn, ...(sql ? { sql: true } : {}) };
  STUBS[name] = stub;
  if (sql)
    registerOracleFunction(
      name,
      params,
      (values) => {
        const result = fn(stubArgs(stub, values, {}), activeRuntime());
        return result === undefined || typeof result === 'boolean'
          ? result
            ? 1
            : result === false
              ? 0
              : null
          : (result as BlobSqlValue);
      },
      { blobs: true },
    );
}

const discover = (args: StubArgs, rt: Runtime | undefined) => {
  const bytes = bytesOf(args.p_content, dbOf(rt));
  if (!bytes?.length) return null;
  return guard('apex_data_parser.discover', null, () =>
    JSON.stringify(discoverProfile(bytes, parserArgs(args))),
  );
};
api(
  'apex_data_parser.discover',
  [
    'p_content',
    'p_file_name',
    'p_file_type',
    'p_decimal_char',
    'p_xlsx_sheet_name',
    'p_row_selector',
    'p_csv_row_delimiter',
    'p_csv_col_delimiter',
    'p_csv_enclosed',
    'p_skip_rows',
    'p_file_charset',
    'p_max_rows',
  ],
  discover,
  true,
);
api(
  'apex_data_parser.get_file_type',
  ['p_file_name'],
  (args) => FILE_TYPES[formatOf(text(args.p_file_name))],
  true,
);
api('apex_data_parser.assert_file_type', ['p_file_name', 'p_file_type'], (args) => {
  const wanted = number(args.p_file_type);
  const name = text(args.p_file_name) ?? '';
  const extension = name.toLowerCase().split('.').pop() ?? '';
  const known: Record<string, number> = { xlsx: 1, csv: 2, txt: 2, tsv: 2, xml: 3, json: 4 };
  return wanted === undefined ? extension in known : known[extension] === wanted;
});
for (const [name, value] of Object.entries(FILE_TYPES))
  api(`apex_data_parser.c_file_type_${name}`, [], () => value);

api(
  'apex_data_loading.get_file_profile',
  ['p_application_id', 'p_static_id'],
  (args, rt) => {
    const renderer = rendererOf(rt);
    const definition = renderer ? findDefinition(renderer, text(args.p_static_id) ?? '') : undefined;
    return definition ? JSON.stringify(definitionProfile(definition)) : null;
  },
  true,
);

api(
  'apex_data_loading.load_data',
  ['p_application_id', 'p_static_id', 'p_data_to_load', 'p_xlsx_sheet_name', 'p_skip_validation'],
  (args, rt) => {
    const renderer = rendererOf(rt);
    const definition = renderer ? findDefinition(renderer, text(args.p_static_id) ?? '') : undefined;
    const bytes = bytesOf(args.p_data_to_load, renderer?.db);
    if (!renderer || !rt || !definition || !bytes) {
      rt?.note(
        'warning',
        `apex_data_loading.load_data: data load definition ${text(args.p_static_id) ?? ''} not found`,
      );
      return new RecordValue({ processed_rows: 0, error_rows: 0 });
    }
    const format = str(definition.props, 'dataProfile.format', 'csv');
    const result = loadData(
      renderer,
      rt.ctx,
      definition,
      bytes,
      `data.${format}`,
      text(args.p_xlsx_sheet_name),
    );
    return new RecordValue({ processed_rows: result.processed, error_rows: result.errors });
  },
);

api(
  'apex_util.get_blob_file_src',
  ['p_item_name', 'p_v1', 'p_v2', 'p_content_disposition'],
  (args, rt) => {
    const renderer = rendererOf(rt);
    const item = text(args.p_item_name);
    if (!renderer || !item) return null;
    return route(renderer, 'files.item', {
      page:
        rt?.ctx.pageId &&
        renderer
          .findPage(rt.ctx.pageId)
          ?.children.some((child) => child.id.toUpperCase() === item.toUpperCase())
          ? rt.ctx.pageId
          : itemPage(renderer, item)?.id,
      item: item.toUpperCase(),
      v1: text(args.p_v1),
      v2: text(args.p_v2),
      inline: String(args.p_content_disposition ?? '').toLowerCase() === 'inline' ? 'Y' : undefined,
    });
  },
  true,
);

api(
  'dbms_lob.getlength',
  ['lob_loc'],
  (args, rt) => {
    const value = args.lob_loc;
    if (value === null || value === undefined) return null;
    return value instanceof Uint8Array
      ? value.length
      : (dbOf(rt)?.blob(value)?.length ?? String(value).length);
  },
  true,
);
api(
  'dbms_lob.substr',
  ['lob_loc', 'amount', 'offset'],
  (args, rt) => {
    const value = args.lob_loc;
    const bytes = value instanceof Uint8Array ? value : dbOf(rt)?.blob(value);
    const offset = (number(args.offset) ?? 1) - 1;
    const amount = number(args.amount) ?? 32_767;
    if (bytes)
      return Buffer.from(bytes.subarray(offset, offset + amount))
        .toString('hex')
        .toUpperCase();
    return value === null || value === undefined ? null : String(value).slice(offset, offset + amount);
  },
  true,
);
api(
  'dbms_lob.instr',
  ['lob_loc', 'pattern', 'offset', 'nth'],
  (args) => {
    const index = String(args.lob_loc ?? '').indexOf(
      String(args.pattern ?? ''),
      (number(args.offset) ?? 1) - 1,
    );
    return index + 1;
  },
  true,
);
for (const name of ['createtemporary', 'freetemporary', 'open', 'close', 'trim'])
  api(`dbms_lob.${name}`, [], () => null);
api(
  'utl_raw.cast_to_raw',
  ['c'],
  (args, rt) => {
    const value = text(args.c);
    return value === undefined ? null : (dbOf(rt)?.blobToken(Buffer.from(value, 'utf8')) ?? value);
  },
  true,
);
api(
  'utl_raw.cast_to_varchar2',
  ['r'],
  (args, rt) => {
    const bytes = bytesOf(args.r, dbOf(rt));
    return bytes ? Buffer.from(bytes).toString('utf8') : null;
  },
  true,
);
api(
  'apex_util.blob_to_clob',
  ['p_blob', 'p_charset'],
  (args, rt) => {
    const bytes = bytesOf(args.p_blob, dbOf(rt));
    return bytes ? Buffer.from(bytes).toString('utf8') : null;
  },
  true,
);
api(
  'apex_util.clob_to_blob',
  ['p_clob', 'p_charset', 'p_include_bom'],
  (args, rt) => {
    const value = text(args.p_clob);
    return value === undefined ? null : (dbOf(rt)?.blobToken(Buffer.from(value, 'utf8')) ?? value);
  },
  true,
);

// ---------------------------------------------------------------- downloads from PL/SQL

const headers = new WeakMap<Session, { mime?: string; filename?: string }>();

function filenameFromOutput(rt: Runtime): string | undefined {
  const line = rt.output.join('').match(/content-disposition:[^\n]*filename\*?=(?:UTF-8'')?"?([^";\n]+)"?/iu);
  return line?.[1] ? decodeURIComponent(line[1].trim()) : undefined;
}

function download(
  rt: Runtime | undefined,
  bytes: Uint8Array | undefined,
  mime?: string,
  filename?: string,
  inline = false,
): null {
  if (!rt || !bytes) return null;
  const session = rt.ctx.session;
  const pending = headers.get(session);
  const name = filename ?? pending?.filename ?? filenameFromOutput(rt) ?? 'download';
  const disposition = /content-disposition:\s*inline/iu.test(rt.output.join(''));
  queueDownload(session, {
    bytes,
    filename: name,
    mimeType: mimeType(bytes, name, mime ?? pending?.mime),
    inline: inline || disposition,
  });
  headers.delete(session);
  // header lines printed with htp.p belong to the HTTP response, not to the page
  rt.output.length = 0;
  rt.note('info', `File download prepared locally: ${name} (${bytes.length} bytes)`);
  return null;
}

api('owa_util.mime_header', ['ccontent_type', 'bclose_header', 'ccharset'], (args, rt) => {
  if (rt)
    headers.set(rt.ctx.session, {
      ...headers.get(rt.ctx.session),
      ...(text(args.ccontent_type) ? { mime: text(args.ccontent_type)! } : {}),
    });
  return null;
});
api('owa_util.http_header_close', [], () => null);
api('htp.init', [], (_args, rt) => {
  if (rt) rt.output.length = 0;
  return null;
});
api('wpg_docload.download_file', ['p_blob'], (args, rt) => {
  const value = args.p_blob;
  const db = dbOf(rt);
  const bytes = value instanceof Uint8Array ? value : db?.blob(value);
  if (bytes) return download(rt, bytes);
  // download_file(file_name) serves a stored file by name (APEX_APPLICATION_FILES)
  const name = text(value);
  const row = name
    ? (db?.db
        .prepare('select blob_content, mime_type, filename from apex_application_files where name = ?')
        .get(name) as { blob_content: Uint8Array; mime_type: string; filename: string } | undefined)
    : undefined;
  return row ? download(rt, row.blob_content, row.mime_type, row.filename) : download(rt, bytesOf(value, db));
});
api('apex_http.download', ['p_blob', 'p_content_type', 'p_filename', 'p_is_inline', 'p_clob'], (args, rt) =>
  download(
    rt,
    bytesOf(args.p_blob ?? args.p_clob, dbOf(rt)),
    text(args.p_content_type),
    text(args.p_filename),
    flag(args.p_is_inline),
  ),
);
