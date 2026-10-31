import { randomInt } from 'node:crypto';
import path from 'node:path';
import { registerDatabaseSetup, type LocalDatabase } from '../../database.ts';
import type { RouteResponse, UploadedFile } from '../../extensions.ts';
import type { ApexRenderer, Session } from '../../render.ts';

/**
 * Local file storage: uploaded files land in APEX_APPLICATION_TEMP_FILES (or
 * APEX_APPLICATION_FILES / WWV_FLOW_FILES) inside the preview's SQLite database, with item values
 * set to the generated file name as APEX does (`<id>/<filename>`).
 */

registerDatabaseSetup((db) => {
  db.db.exec(`create table if not exists apex_application_temp_files (
    id integer primary key,
    application_id number,
    name varchar2(400) not null,
    filename varchar2(400),
    mime_type varchar2(255),
    created_on date default (datetime('now','localtime')),
    blob_content blob,
    apex_local_session varchar2(40),
    apex_local_purge varchar2(20)
  )`);
  db.db.exec(`create table if not exists apex_application_files (
    id integer primary key,
    flow_id number,
    name varchar2(400) not null,
    filename varchar2(400),
    title varchar2(255),
    mime_type varchar2(255),
    doc_size number,
    dad_charset varchar2(128),
    created_by varchar2(255),
    created_on date default (datetime('now','localtime')),
    updated_by varchar2(255),
    updated_on date,
    last_updated date default (datetime('now','localtime')),
    content_type varchar2(128),
    blob_content blob,
    language varchar2(30),
    description varchar2(4000),
    file_type varchar2(255),
    file_charset varchar2(128)
  )`);
  db.db.exec('create view if not exists wwv_flow_files as select * from apex_application_files');
});

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.zip': 'application/zip',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** MIME type from the stored value, else magic bytes, else the file name. */
export function mimeType(bytes: Uint8Array | undefined, filename = '', stored?: unknown): string {
  if (typeof stored === 'string' && stored && stored !== 'application/octet-stream') return stored;
  if (bytes && bytes.length >= 4) {
    const hex = Buffer.from(bytes.subarray(0, 12)).toString('hex');
    if (hex.startsWith('89504e47')) return 'image/png';
    if (hex.startsWith('ffd8ff')) return 'image/jpeg';
    if (hex.startsWith('47494638')) return 'image/gif';
    if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return 'image/webp';
    if (hex.startsWith('25504446')) return 'application/pdf';
    const head = Buffer.from(bytes.subarray(0, 256)).toString('utf8').trimStart();
    if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg')))
      return 'image/svg+xml';
  }
  return (
    MIME[path.extname(filename).toLowerCase()] ??
    (typeof stored === 'string' && stored ? stored : 'application/octet-stream')
  );
}

export interface StoredFile {
  name: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}

function tempName(filename: string): string {
  return `${randomInt(1e9, 9e9)}${randomInt(1e5, 9e5)}/${filename}`;
}

/** Stores an upload and returns the generated name (the item value). */
export function storeUpload(
  renderer: ApexRenderer,
  session: Session,
  file: UploadedFile,
  target: 'temp' | 'files',
  purge = 'endOfSession',
): string {
  const name = tempName(file.filename);
  const mime = mimeType(file.data, file.filename, file.mimeType);
  if (target === 'files')
    renderer.db.db
      .prepare(
        `insert into apex_application_files (flow_id, name, filename, title, mime_type, doc_size, created_by, content_type, blob_content)
         values (?, ?, ?, ?, ?, ?, ?, 'BLOB', ?)`,
      )
      .run(
        Number(renderer.appId) || 0,
        name,
        file.filename,
        file.filename,
        mime,
        file.data.length,
        session.user,
        file.data,
      );
  else
    renderer.db.db
      .prepare(
        `insert into apex_application_temp_files (application_id, name, filename, mime_type, blob_content, apex_local_session, apex_local_purge)
         values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(Number(renderer.appId) || 0, name, file.filename, mime, file.data, session.id, purge);
  return name;
}

/** A stored upload by its generated name. */
export function storedFile(db: LocalDatabase, name: string): StoredFile | undefined {
  for (const table of ['apex_application_temp_files', 'apex_application_files']) {
    const row = db.db
      .prepare(`select name, filename, mime_type, blob_content from ${table} where name = ? order by id desc`)
      .get(name) as
      { name: string; filename: string; mime_type: string; blob_content: Uint8Array | null } | undefined;
    if (row)
      return {
        name: row.name,
        filename: row.filename ?? '',
        mimeType: mimeType(row.blob_content ?? undefined, row.filename ?? '', row.mime_type),
        bytes: row.blob_content ?? new Uint8Array(),
      };
  }
  return undefined;
}

export function purgeRequestFiles(db: LocalDatabase, names: string[]): void {
  const statement = db.db.prepare(
    "delete from apex_application_temp_files where name = ? and apex_local_purge = 'endOfRequest'",
  );
  for (const name of names) statement.run(name);
}

// ---------------------------------------------------------------- downloads

export interface Download {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  inline: boolean;
}

const pending = new WeakMap<Session, Download>();
const ready = new WeakMap<Session, Map<string, Download>>();

/** Queues a download for the current request (wpg_docload, apex_http, download processes). */
export function queueDownload(session: Session, download: Download): void {
  pending.set(session, download);
}

export function takeDownload(session: Session): Download | undefined {
  const download = pending.get(session);
  pending.delete(session);
  return download;
}

/** Keeps a download for a follow-up GET (after an Ajax submit) and returns its id. */
export function keepDownload(session: Session, download: Download): string {
  let map = ready.get(session);
  if (!map) ready.set(session, (map = new Map()));
  const id = String(randomInt(1e9, 9e9));
  map.set(id, download);
  for (const key of map.keys()) {
    if (map.size <= 10) break;
    map.delete(key);
  }
  return id;
}

export function keptDownload(session: Session, id: string): Download | undefined {
  return ready.get(session)?.get(id);
}

function contentDisposition(filename: string, inline: boolean): string {
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/gu, '_') || 'download';
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename || 'download')}`;
}

export function fileResponse(download: Download): RouteResponse {
  return {
    type: 'binary',
    body: '',
    data: download.bytes,
    contentType: download.mimeType,
    headers: {
      'content-disposition': contentDisposition(download.filename, download.inline),
      'content-length': String(download.bytes.length),
      'x-content-type-options': 'nosniff',
      // uploaded SVG or HTML must not run script in the preview's origin
      'content-security-policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
    },
  };
}

export const notFound = (message: string): RouteResponse => ({ status: 404, type: 'text', body: message });
