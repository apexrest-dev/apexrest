import zlib from 'node:zlib';
import { bool, get, ref, str, type ApxComponent, type ApxObject } from '../../apexlang.ts';
import type { Binds } from '../../database.ts';
import type { ColumnRenderer, ItemRenderer, ProcessResult, RouteHandler } from '../../extensions.ts';
import { LOCAL_PREFIX, type ApexRenderer, type RenderContext, type Session } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import {
  fileResponse,
  keepDownload,
  keptDownload,
  mimeType,
  notFound,
  queueDownload,
  storedFile,
  type Download,
} from './store.ts';

/**
 * BLOBs end to end: display image items and report columns, download BLOB columns, file items
 * stored in a BLOB column, the Download process and dynamic action, all served through routes
 * that resolve table and column names from the APEXlang source (never from the URL).
 */

export const route = (renderer: ApexRenderer, name: string, params: Record<string, string | undefined>) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '',
    ),
  );
  return `${renderer.baseUrl}${LOCAL_PREFIX}/x/${name}?${query}`;
};

const identifier = (value: string) => {
  const name = value.trim().replaceAll('"', '');
  if (!/^[A-Za-z_][\w$#]*(?:\.[A-Za-z_][\w$#]*)?$/u.test(name))
    throw new Error(`Invalid identifier ${value}`);
  return name;
};

export const isFileItem = (item: ApxComponent) =>
  ['fileUpload', 'fileBrowse', 'imageUpload'].includes(str(item.props, 'type'));
export const storageType = (item: ApxComponent) => str(item.props, 'storage.type', 'blobCol');

/** The page that defines an item (for links built outside that page, e.g. apex_util.get_blob_file_src). */
export function itemPage(renderer: ApexRenderer, name: string): ApxComponent | undefined {
  const upper = name.toUpperCase();
  for (const page of renderer.app.pages.values())
    if (page.children.some((child) => child.type === 'pageItem' && child.id.toUpperCase() === upper))
      return page;
  return undefined;
}

function findItem(renderer: ApexRenderer, ctx: RenderContext, name: string): ApxComponent | undefined {
  return renderer
    .pageComponents(ctx, 'pageItem')
    .find((candidate) => candidate.id.toUpperCase() === name.toUpperCase());
}

interface BlobRow {
  bytes?: Uint8Array | undefined;
  filename?: string | undefined;
  mimeType?: string | undefined;
  updated?: string | undefined;
}

function blobRow(
  renderer: ApexRenderer,
  table: string,
  columns: { blob: string; mime?: string; filename?: string; updated?: string },
  where: string,
  binds: Binds,
): BlobRow | undefined {
  const select = [columns.blob, columns.mime, columns.filename, columns.updated].map((column) =>
    column ? `"${identifier(column).toUpperCase()}"` : 'null',
  );
  const result = renderer.db.rawQuery(
    `select ${select.join(', ')} from ${identifier(table)} where ${where}`,
    binds,
    1,
  );
  const row = result.rows[0];
  if (!row) return undefined;
  const value = row[0];
  return {
    bytes:
      value instanceof Uint8Array
        ? value
        : typeof value === 'string'
          ? (renderer.db.blob(value) ?? Buffer.from(value))
          : undefined,
    filename: typeof row[2] === 'string' ? row[2] : undefined,
    mimeType: typeof row[1] === 'string' ? row[1] : undefined,
    updated: row[3] === null || row[3] === undefined ? undefined : String(row[3]),
  };
}

/**
 * The form row behind an item whose source is a BLOB column of a form region, keyed by the
 * form's primary key items (or explicit key values).
 */
function formBlob(
  renderer: ApexRenderer,
  ctx: RenderContext,
  item: ApxComponent,
  keyValues: string[] = [],
): BlobRow | undefined {
  const regionId = ref(item.props, 'source.formRegion');
  const region = renderer.pageComponents(ctx, 'region').find((candidate) => candidate.id === regionId);
  const table = region ? str(region.props, 'source.tableName') : '';
  const column = str(item.props, 'source.column');
  if (!table || !column || !renderer.db.tableExists(table.replaceAll('"', ''))) return undefined;
  const keys = renderer
    .formItems(ctx, regionId)
    .filter((candidate) => bool(candidate.props, 'source.primaryKey', false));
  if (!keys.length) return undefined;
  const binds: Binds = {};
  const where = keys.map((key, index) => {
    const value = keyValues[index] ?? ctx.session.items[key.id.toUpperCase()] ?? '';
    binds[`APEX_LOCAL_K${index}`] = value;
    return `"${identifier(str(key.props, 'source.column')).toUpperCase()}" = :APEX_LOCAL_K${index}`;
  });
  if (keys.some((_, index) => !binds[`APEX_LOCAL_K${index}`])) return undefined;
  const settings = (key: string) => str(item.props, `storage.${key}`) || str(item.props, `settings.${key}`);
  try {
    return blobRow(
      renderer,
      table,
      {
        blob: column,
        mime: settings('mimeTypeColumn'),
        filename: settings('filenameColumn'),
        updated: settings('blobLastUpdatedColumn') || settings('bobLastUpdatedColumn'),
      },
      where.join(' and '),
      binds,
    );
  } catch (error) {
    renderer.diagnose(
      'warning',
      `BLOB of ${item.id} could not be read: ${(error as Error).message}`,
      ctx.pageId,
      item.id,
    );
    return undefined;
  }
}

function sqlBlob(renderer: ApexRenderer, ctx: RenderContext, sql: string): BlobRow | undefined {
  try {
    const row = renderer.db.rawQuery(sql, renderer.binds(ctx.session, ctx.page), 1).rows[0];
    if (!row) return undefined;
    const value = row[0];
    return {
      bytes:
        value instanceof Uint8Array
          ? value
          : typeof value === 'string'
            ? (renderer.db.blob(value) ?? Buffer.from(value))
            : undefined,
      mimeType: typeof row[1] === 'string' ? row[1] : undefined,
      filename: typeof row[2] === 'string' ? row[2] : undefined,
    };
  } catch (error) {
    renderer.diagnose('warning', `BLOB query failed: ${(error as Error).message}`, ctx.pageId);
    return undefined;
  }
}

const asDownload = (row: BlobRow, inline: boolean, fallbackName = 'download'): Download => ({
  bytes: row.bytes ?? new Uint8Array(),
  filename: row.filename || fallbackName,
  mimeType: mimeType(row.bytes, row.filename ?? fallbackName, row.mimeType),
  inline,
});

// ---------------------------------------------------------------- items

/** Display Image: an image URL in the item value, the form's BLOB column or a BLOB from SQL. */
export const displayImage: ItemRenderer = (renderer, ctx, item, name, value) => {
  const basedOn = str(
    item.props,
    'settings.basedOn',
    str(item.props, 'source.column') ? 'blobColItem' : 'url',
  );
  const alt = (text: string) => renderer.substitute(ctx.session, text, ctx.page, 'RAW');
  let src = '';
  let altText = str(item.props, 'settings.altText') ? alt(str(item.props, 'settings.altText')) : '';
  if (basedOn === 'url') src = value;
  else if (basedOn === 'blobColSql') {
    const row = sqlBlob(renderer, ctx, str(item.props, 'settings.sqlQuery'));
    if (row?.bytes?.length)
      src = route(renderer, 'files.item', {
        page: ctx.pageId,
        item: name,
        inline: 'Y',
        t: String(row.bytes.length),
      });
  } else {
    const row = formBlob(renderer, ctx, item);
    if (row?.bytes?.length) {
      src = route(renderer, 'files.item', {
        page: ctx.pageId,
        item: name,
        inline: 'Y',
        t: row.updated ?? String(row.bytes.length),
      });
      const altColumn = str(item.props, 'settings.altTextColumn');
      if (altColumn && !altText) altText = row.filename ?? '';
    }
  }
  const classes = [
    'display_image',
    ...String(str(item.props, 'advanced.cssClasses')).split(/\s+/u).filter(Boolean),
  ];
  return src
    ? `<img id="${name}" class="${escapeHtml(classes.join(' '))}" src="${escapeHtml(src)}" alt="${escapeHtml(altText)}" title="${escapeHtml(altText)}">`
    : `<span id="${name}" class="display_only apex-item-display-only"></span>`;
};

/** Attributes of <a-file-upload> for the item's current file: name, size, type and preview link. */
export function fileAttributes(
  renderer: ApexRenderer,
  ctx: RenderContext,
  item: ApxComponent,
  value: string,
): Record<string, string | undefined> {
  const name = item.id.toUpperCase();
  const image = str(item.props, 'type') === 'imageUpload';
  if (storageType(item) === 'blobCol') {
    const row = formBlob(renderer, ctx, item);
    if (!row?.bytes?.length) return {};
    const inline = str(item.props, 'display.contentDisposition', 'attachment') === 'inline';
    const download = route(renderer, 'files.item', {
      page: ctx.pageId,
      item: name,
      inline: inline ? 'Y' : undefined,
    });
    const preview = route(renderer, 'files.item', {
      page: ctx.pageId,
      item: name,
      inline: 'Y',
      t: row.updated ?? String(row.bytes.length),
    });
    const linked = bool(item.props, 'display.displayDownloadLink', true);
    return {
      filename: row.filename || (image ? undefined : 'file'),
      'file-size': String(row.bytes.length),
      'mime-type': mimeType(row.bytes, row.filename, row.mimeType),
      link: image ? preview : linked ? download : undefined,
      'download-link': linked ? download : undefined,
      'download-text': linked ? str(item.props, 'display.downloadLinkText') || undefined : undefined,
    };
  }
  const stored = value ? storedFile(renderer.db, value.split(':')[0]!) : undefined;
  if (!stored) return { filename: value || undefined };
  return {
    filename: stored.filename,
    'file-size': String(stored.bytes.length),
    'mime-type': stored.mimeType,
    link: image ? route(renderer, 'files.temp', { name: stored.name }) : undefined,
  };
}

// ---------------------------------------------------------------- report columns

function columnSetting(column: ApxComponent, key: string): string {
  return (
    str(column.props, `appearance.${key}`) || str(column.props, `settings.${key}`) || str(column.props, key)
  );
}

const blobAttribute = (column: ApxComponent, key: string) => str(column.props, `blobAttributes.${key}`);

function columnLink(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  column: ApxComponent,
  row: Record<string, unknown>,
  inline: boolean,
): string | undefined {
  const pk1 = blobAttribute(column, 'primaryKeyColumn1').toUpperCase();
  const pk2 = blobAttribute(column, 'primaryKeyColumn2').toUpperCase();
  const length = row[column.id.toUpperCase()];
  // the column value is usually dbms_lob.getlength(blob): empty or zero means no file
  if (length === null || length === undefined || length === '' || length === 0 || length === '0')
    return undefined;
  if (!pk1 || row[pk1] === undefined || row[pk1] === null) return undefined;
  return route(renderer, 'files.column', {
    page: ctx.pageId,
    region: region.id,
    column: column.id,
    pk1: String(row[pk1]),
    pk2: pk2 && row[pk2] !== undefined && row[pk2] !== null ? String(row[pk2]) : undefined,
    inline: inline ? 'Y' : undefined,
    t: row[blobAttribute(column, 'lastUpdatedColumn').toUpperCase()] as string | undefined,
  });
}

export const displayImageColumn: ColumnRenderer = (renderer, ctx, region, column, row) => {
  const url = columnLink(renderer, ctx, region, column, row, true);
  if (!url) return '';
  const description =
    str(column.props, 'accessibility.imageDescription') || columnSetting(column, 'imageDescription');
  const alt = description.replace(/#([A-Z0-9_$]+)#/gu, (whole, key: string) =>
    key in row ? String(row[key] ?? '') : whole,
  );
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" title="${escapeHtml(alt)}" class="apex-local-blob-image" loading="lazy">`;
};

export const downloadBlobColumn: ColumnRenderer = (renderer, ctx, region, column, row) => {
  const inline = columnSetting(column, 'viewFileAs') === 'inline';
  const url = columnLink(renderer, ctx, region, column, row, inline);
  if (!url) return '';
  const text = (columnSetting(column, 'downloadText') || 'Download').replace(
    /#([A-Z0-9_$]+)#/gu,
    (whole, key: string) => (key in row ? String(row[key] ?? '') : whole),
  );
  return `<a href="${escapeHtml(url)}"${inline ? ' target="_blank" rel="noopener"' : ''}>${escapeHtml(text)}</a>`;
};

// ---------------------------------------------------------------- routes

function pageContext(renderer: ApexRenderer, session: Session, page: string): RenderContext | undefined {
  if (!page || !renderer.findPage(page)) return undefined;
  return renderer.prepareSubmit(session, page, '');
}

/** BLOB of a display image or file item: `?page=&item=[&v1=&v2=][&inline=Y]`. */
export const itemRoute: RouteHandler = (renderer, session, request) => {
  const itemName = request.params.get('item') ?? '';
  const page = request.params.get('page') || itemPage(renderer, itemName)?.id || '';
  const ctx = pageContext(renderer, session, page);
  const item = ctx ? findItem(renderer, ctx, itemName) : undefined;
  if (!ctx || !item) return notFound('Item not found');
  const inline = request.params.get('inline') === 'Y';
  const keys = [request.params.get('v1'), request.params.get('v2')].filter(
    (value): value is string => !!value,
  );
  const row =
    str(item.props, 'settings.basedOn') === 'blobColSql'
      ? sqlBlob(renderer, ctx, str(item.props, 'settings.sqlQuery'))
      : formBlob(renderer, ctx, item, keys);
  if (!row?.bytes?.length) return notFound('No file');
  return fileResponse(asDownload(row, inline, item.id.toLowerCase()));
};

/** BLOB of a report column: `?page=&region=&column=&pk1=[&pk2=][&inline=Y]`. */
export const columnRoute: RouteHandler = (renderer, session, request) => {
  const ctx = pageContext(renderer, session, request.params.get('page') ?? '');
  const regionId = request.params.get('region') ?? '';
  const region =
    ctx?.page.children.find((child) => child.type === 'region' && child.id === regionId) ??
    (ctx ? renderer.pageComponents(ctx, 'region').find((child) => child.id === regionId) : undefined);
  const column = region?.children.find(
    (child) =>
      child.type === 'column' &&
      child.id.toUpperCase() === (request.params.get('column') ?? '').toUpperCase(),
  );
  if (!ctx || !column) return notFound('Column not found');
  const table = blobAttribute(column, 'tableName');
  const blob = blobAttribute(column, 'blobColumn');
  const pk1 = blobAttribute(column, 'primaryKeyColumn1');
  if (!table || !blob || !pk1) return notFound('Column has no BLOB attributes');
  const pk2 = blobAttribute(column, 'primaryKeyColumn2');
  const binds: Binds = {
    APEX_LOCAL_PK1: request.params.get('pk1') ?? '',
    APEX_LOCAL_PK2: request.params.get('pk2') ?? '',
  };
  try {
    const owner = blobAttribute(column, 'tableOwner');
    const row = blobRow(
      renderer,
      owner ? `${identifier(owner)}.${identifier(table)}`.replace(/^[^.]+\./u, '') : table,
      {
        blob,
        mime: blobAttribute(column, 'mimeTypeColumn'),
        filename: blobAttribute(column, 'filenameColumn'),
        updated: blobAttribute(column, 'lastUpdatedColumn'),
      },
      `"${identifier(pk1).toUpperCase()}" = :APEX_LOCAL_PK1${pk2 ? ` and "${identifier(pk2).toUpperCase()}" = :APEX_LOCAL_PK2` : ''}`,
      binds,
    );
    if (!row?.bytes?.length) return notFound('No file');
    return fileResponse(asDownload(row, request.params.get('inline') === 'Y', column.id.toLowerCase()));
  } catch (error) {
    renderer.diagnose(
      'warning',
      `BLOB column ${column.id}: ${(error as Error).message}`,
      ctx.pageId,
      column.id,
    );
    return notFound((error as Error).message);
  }
};

/** An uploaded file of this session (image upload preview): `?name=`. */
export const tempRoute: RouteHandler = (renderer, session, request) => {
  const name = request.params.get('name') ?? '';
  const owned = renderer.db.db
    .prepare(
      'select 1 from apex_application_temp_files where name = ? and (apex_local_session = ? or apex_local_session is null)',
    )
    .get(name, session.id);
  const file = owned ? storedFile(renderer.db, name) : undefined;
  if (!file) return notFound('No file');
  return fileResponse({ bytes: file.bytes, filename: file.filename, mimeType: file.mimeType, inline: true });
};

/** A file prepared by a download process, dynamic action or wpg_docload: `?id=`. */
export const downloadRoute: RouteHandler = (_renderer, session, request) => {
  const download = keptDownload(session, request.params.get('id') ?? '');
  return download ? fileResponse(download) : notFound('The download has expired; run it again.');
};

// ---------------------------------------------------------------- download process and action

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A deflated zip archive (Download with multiple files). */
export function zipFiles(files: { name: string; bytes: Uint8Array }[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const used = new Set<string>();
  for (const file of files) {
    let name = file.name || 'file';
    for (let index = 2; used.has(name); index += 1) name = file.name.replace(/(\.[^.]*)?$/u, ` (${index})$1`);
    used.add(name);
    const nameBytes = Buffer.from(name, 'utf8');
    const data = zlib.deflateRawSync(file.bytes);
    const crc = crc32(file.bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(file.bytes.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(file.bytes.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    central.push(entry, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/** Files of a download definition: `select blob, filename, mime_type from ...` (BLOB or CLOB first). */
export function downloadFiles(
  renderer: ApexRenderer,
  ctx: RenderContext,
  props: ApxObject,
  owner: string,
): Download | undefined {
  const sql = str(props, 'source.sqlQuery') || str(props, 'sqlQuery');
  if (!sql) {
    renderer.diagnose(
      'info',
      `Download ${owner}: only a SQL query source is simulated locally`,
      ctx.pageId,
      owner,
    );
    return undefined;
  }
  const multiple = bool(props, 'fileHandling.multipleFiles', false);
  const inline = !multiple && str(props, 'fileHandling.viewFileAs', 'attachment').toLowerCase() === 'inline';
  let rows: (string | number | null | Uint8Array)[][];
  try {
    rows = renderer.db.rawQuery(sql, renderer.binds(ctx.session, ctx.page), multiple ? 1000 : 1).rows;
  } catch (error) {
    renderer.diagnose('warning', `Download ${owner}: ${(error as Error).message}`, ctx.pageId, owner);
    return undefined;
  }
  const files = rows.map((row, index) => {
    const value = row[0];
    const bytes =
      value instanceof Uint8Array
        ? value
        : typeof value === 'string'
          ? (renderer.db.blob(value) ?? Buffer.from(value, 'utf8'))
          : new Uint8Array();
    const name = typeof row[1] === 'string' && row[1] ? row[1] : `file-${index + 1}`;
    return { name, bytes, mime: typeof row[2] === 'string' ? row[2] : undefined };
  });
  if (!files.length) {
    renderer.diagnose('info', `Download ${owner}: the query returned no file`, ctx.pageId, owner);
    return undefined;
  }
  if (multiple) {
    const name = renderer.substitute(
      ctx.session,
      str(props, 'fileHandling.filename', 'files.zip'),
      ctx.page,
      'RAW',
    );
    return {
      bytes: zipFiles(files),
      filename: name.toLowerCase().endsWith('.zip') ? name : `${name}.zip`,
      mimeType: 'application/zip',
      inline: false,
    };
  }
  const file = files[0]!;
  return {
    bytes: file.bytes,
    filename: file.name,
    mimeType: mimeType(file.bytes, file.name, file.mime),
    inline,
  };
}

/** Process type `download`: the file replaces the page (before header) or follows the submit. */
export function downloadProcess(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
  point: 'beforeHeader' | 'submit',
): ProcessResult {
  const download = downloadFiles(renderer, ctx, process.props, process.id);
  if (!download) return { ran: false };
  if (point === 'beforeHeader') {
    queueDownload(ctx.session, download);
    return { ran: true };
  }
  return {
    ran: true,
    redirectURL: route(renderer, 'files.download', { id: keepDownload(ctx.session, download) }),
  };
}

/** A dynamic action (download or print report) by `<dynamicAction>/<action>` on a page. */
export function dynamicActionChild(ctx: RenderContext, key: string): ApxComponent | undefined {
  const [daId, actionId] = key.split('/');
  const da = ctx.page.children.find((child) => child.type === 'dynamicAction' && child.id === daId);
  return da?.children.find((child) => child.type === 'action' && child.id === actionId);
}

export const isObjectProps = (value: unknown): value is ApxObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export { get };
