// Page items register first so the file module's item renderers override theirs.
import './items.ts';
import { bool, ref, str, type ApxComponent, type ApxObject } from '../apexlang.ts';
import { registerExtension, type ProcessHandler, type RouteHandler } from '../extensions.ts';
import type { ApexRenderer, RenderContext } from '../render.ts';
import { setCurrentRenderer } from './files/api.ts';
import {
  columnRoute,
  displayImage,
  displayImageColumn,
  downloadBlobColumn,
  downloadFiles,
  downloadProcess,
  downloadRoute,
  dynamicActionChild,
  fileContext,
  fileAttributes,
  isFileItem,
  itemRoute,
  route,
  storageType,
  tempRoute,
} from './files/blob.ts';
import { dataLoadingProcess } from './files/loading.ts';
import {
  columnMappingRegion,
  loadUploadedData,
  parseUploadedData,
  prepareUploadedData,
  rememberArrays,
} from './files/legacy.ts';
import { printRoute, printUrl } from './files/print.ts';
import {
  fileResponse,
  keepDownload,
  purgeRequestFiles,
  storedFile,
  storeUpload,
  takeDownload,
} from './files/store.ts';
import { setFileAttributes } from './items/render.ts';

/**
 * Files and data: uploads (multipart page submits) into APEX_APPLICATION_TEMP_FILES or a form's
 * BLOB column, BLOB display and download, data loading (CSV/TSV/JSON/XML/XLSX) and report
 * printing as print-friendly HTML.
 */

setFileAttributes(fileAttributes);

/** File items that write into the form's BLOB column on automatic row processing. */
function blobItems(renderer: ApexRenderer, ctx: RenderContext, regionId: string | undefined) {
  return renderer
    .formItems(ctx, regionId)
    .filter((item) => isFileItem(item) && storageType(item) === 'blobCol');
}

function operation(ctx: RenderContext, pressed: ApxComponent | undefined): string {
  const action = pressed ? str(pressed.props, 'behavior.databaseAction') : '';
  if (action === 'insert' || /^(CREATE|INSERT|ADD)$/u.test(ctx.request)) return 'insert';
  if (action === 'update' || /^(SAVE|APPLY CHANGES|UPDATE)$/u.test(ctx.request)) return 'update';
  if (action === 'delete' || /^(DELETE|REMOVE)$/u.test(ctx.request)) return 'delete';
  return '';
}

/** Form DML that leaves BLOB file items out of the generated SQL and stores their uploads afterwards. */
const formAutoRowProcessing: ProcessHandler = (renderer, ctx, process, point, pressed) => {
  if (point !== 'submit') return { ran: false };
  const regionId = ref(process.props, 'formRegion');
  const items = blobItems(renderer, ctx, regionId);
  if (!items.length) return { ran: renderer.processForm(ctx, regionId, pressed) };
  const sources = items.map((item) => item.props.source as ApxObject);
  const saved = sources.map((source) => source.queryOnly);
  sources.forEach((source) => (source.queryOnly = true));
  let ran: boolean;
  try {
    ran = renderer.processForm(ctx, regionId, pressed);
  } finally {
    sources.forEach((source, index) => {
      if (saved[index] === undefined) delete source.queryOnly;
      else source.queryOnly = saved[index]!;
    });
  }
  const kind = operation(ctx, pressed);
  if (!ran || (kind !== 'insert' && kind !== 'update')) return { ran };
  const region = renderer.pageComponents(ctx, 'region').find((candidate) => candidate.id === regionId);
  const table = region ? str(region.props, 'source.tableName') : '';
  const keys = renderer
    .formItems(ctx, regionId)
    .filter((item) => bool(item.props, 'source.primaryKey', false));
  for (const item of items) {
    const value = ctx.session.items[item.id.toUpperCase()] ?? '';
    const file = value ? storedFile(renderer.db, value.split(':')[0]!) : undefined;
    if (!file || !table || !keys.length) continue;
    const assignments = [[str(item.props, 'source.column'), 'APEX_LOCAL_BLOB']];
    const binds: Record<string, string | number | null> = {
      APEX_LOCAL_BLOB: renderer.db.blobToken(file.bytes),
      APEX_LOCAL_MIME: file.mimeType,
      APEX_LOCAL_NAME: file.filename,
    };
    const mime = str(item.props, 'storage.mimeTypeColumn');
    const name = str(item.props, 'storage.filenameColumn');
    const updated =
      str(item.props, 'storage.blobLastUpdatedColumn') || str(item.props, 'storage.bobLastUpdatedColumn');
    const charset = str(item.props, 'storage.charSetColumn');
    if (mime) assignments.push([mime, 'APEX_LOCAL_MIME']);
    if (name) assignments.push([name, 'APEX_LOCAL_NAME']);
    const set = assignments.map(([column, bind]) => `"${column!.toUpperCase()}" = :${bind}`);
    if (updated) set.push(`"${updated.toUpperCase()}" = datetime('now','localtime')`);
    if (charset) set.push(`"${charset.toUpperCase()}" = 'AL32UTF8'`);
    const where = keys.map((key, index) => {
      binds[`APEX_LOCAL_K${index}`] = ctx.session.items[key.id.toUpperCase()] ?? '';
      return `"${str(key.props, 'source.column').toUpperCase()}" = :APEX_LOCAL_K${index}`;
    });
    try {
      renderer.db.execute(`update ${table} set ${set.join(', ')} where ${where.join(' and ')}`, binds);
    } catch (error) {
      renderer.diagnose(
        'error',
        `Storing ${item.id} in ${table} failed: ${(error as Error).message}`,
        ctx.pageId,
        item.id,
      );
    }
  }
  return { ran };
};

/** Print Report process: the print view follows the submit (opened in the same window). */
const printReportProcess: ProcessHandler = (renderer, ctx, process, point) => {
  if (point !== 'submit') return { ran: false };
  renderer.diagnose(
    'info',
    `Print Report ${process.id} renders print-friendly HTML locally, not a PDF`,
    ctx.pageId,
    process.id,
  );
  return { ran: true, redirectURL: printUrl(renderer, { page: ctx.pageId, process: process.id }) };
};

/** Server half of the Download and Print Report dynamic actions: `?page=&action=<da>/<action>`. */
const actionRoute: RouteHandler = (renderer, session, request) => {
  const page = request.params.get('page') ?? '';
  if (!renderer.findPage(page)) return { status: 404, type: 'json', body: '{"error":"page not found"}' };
  const ctx = fileContext(renderer, session, page)!;
  let items: Record<string, string> = {};
  try {
    items = (JSON.parse(request.body || '{}') as { items?: Record<string, string> }).items ?? {};
  } catch {
    /* no items submitted */
  }
  for (const [name, value] of Object.entries(items)) session.items[name.toUpperCase()] = String(value ?? '');
  const action = dynamicActionChild(ctx, request.params.get('action') ?? '');
  if (!action) return { status: 404, type: 'json', body: '{"error":"action not found"}' };
  if (str(action.props, 'action') === 'printReport')
    return {
      type: 'json',
      body: JSON.stringify({
        url: printUrl(renderer, { page, action: request.params.get('action')! }),
        inline: true,
      }),
    };
  const download = downloadFiles(renderer, ctx, action.props, action.id);
  if (!download) return { type: 'json', body: JSON.stringify({ error: 'The query returned no file.' }) };
  return {
    type: 'json',
    body: JSON.stringify({
      url: route(renderer, 'files.download', { id: keepDownload(session, download) }),
      inline: download.inline,
    }),
  };
};

const CLIENT = String.raw`
(function () {
  function run(action, event, trigger) {
    var settings = action.settings || {};
    var items = {};
    String(settings.localItems || "").split(",").forEach(function (name) {
      name = name.trim();
      if (name && apex.item(name).node) items[name] = apex.item(name).getValue();
    });
    var inline = settings.localInline === "Y";
    // open the window inside the click so popup blockers allow it
    var win = inline ? window.open("", "_blank") : null;
    var base = location.pathname.replace(/\/[^/]*$/, "");
    return fetch(base + "/__apex/x/files.action?page=" + encodeURIComponent(apex.env.APP_PAGE_ID) + "&action=" + encodeURIComponent(settings.localAction || ""), {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ items: items })
    }).then(function (response) { return response.json(); }).then(function (result) {
      if (!result || !result.url) {
        if (win) win.close();
        apex.message.showErrors([{ type: "error", location: "page", message: (result && result.error) || "Download failed", unsafe: false }]);
        return;
      }
      if (win) win.location.href = result.url; else window.location.href = result.url;
    });
  }
  apexLocal.registerAction("download", run);
  apexLocal.registerAction("printReport", run);
})();
`;

const CSS = `.apex-local-blob-image{max-width:120px;max-height:120px;object-fit:contain}
.display_image{max-width:100%;height:auto}`;

registerExtension({
  name: 'files',
  items: { displayImage },
  columns: { displayImage: displayImageColumn, downloadBlob: downloadBlobColumn },
  regions: { dataUploadColMapping: columnMappingRegion },
  processes: {
    formAutoRowProcessing,
    download: (renderer, ctx, process, point) => downloadProcess(renderer, ctx, process, point),
    dataLoading: (renderer, ctx, process, point) =>
      point === 'submit' ? dataLoadingProcess(renderer, ctx, process) : { ran: false },
    parseUploadedData: (renderer, ctx, process) => parseUploadedData(renderer, ctx, process),
    prepareUploadedData: (renderer, ctx, process) => prepareUploadedData(renderer, ctx, process),
    loadUploadedData: (renderer, ctx, process) => loadUploadedData(renderer, ctx, process),
    printReport: printReportProcess,
  },
  routes: {
    'files.item': itemRoute,
    'files.column': columnRoute,
    'files.temp': tempRoute,
    'files.download': downloadRoute,
    'files.print': printRoute,
    'files.action': actionRoute,
  },
  client: CLIENT,
  css: CSS,
  point: (renderer) => {
    setCurrentRenderer(renderer);
    return undefined;
  },
  page: (renderer, ctx) => {
    setCurrentRenderer(renderer);
    // the client action handlers find their server definition and items through settings
    for (const da of ctx.page.children.filter((child) => child.type === 'dynamicAction'))
      for (const action of da.children.filter((child) => child.type === 'action')) {
        const type = str(action.props, 'action');
        if (type !== 'download' && type !== 'printReport') continue;
        const settings = (action.props.settings ??= {}) as ApxObject;
        settings.localAction = `${da.id}/${action.id}`;
        settings.localItems =
          str(action.props, 'source.itemsToSubmit') || str(action.props, 'settings.itemsToSubmit');
        settings.localInline =
          type === 'printReport' ||
          (!bool(action.props, 'fileHandling.multipleFiles', false) &&
            str(action.props, 'fileHandling.viewFileAs', 'attachment').toLowerCase() === 'inline')
            ? 'Y'
            : 'N';
      }
  },
  submit: (renderer, session, submit) => {
    setCurrentRenderer(renderer);
    rememberArrays(session, submit.form);
    const page = renderer.findPage(submit.pageId);
    if (!page) return undefined;
    const ctx = fileContext(renderer, session, submit.pageId, submit.request)!;
    const items = new Map(
      renderer.pageComponents(ctx, 'pageItem').map((item) => [item.id.toUpperCase(), item]),
    );
    const requestFiles: string[] = [];
    for (const entry of submit.items) {
      if (entry.fileIndex === undefined || !entry.fileCount) continue;
      const item = items.get(entry.n.toUpperCase());
      // fileIndex is 1-based (apex.server counts p_files from 1)
      const files = submit.files.slice(entry.fileIndex - 1, entry.fileIndex - 1 + entry.fileCount);
      if (!files.length) continue;
      const type = item ? storageType(item) : 'appTempFiles';
      const purge = item
        ? str(item.props, 'storage.purgeFileAt') || str(item.props, 'storage.purgeFilesAt') || 'endOfSession'
        : 'endOfSession';
      const names = files.map((file) =>
        storeUpload(
          renderer,
          session,
          file,
          type === 'wwvFlowFiles' ? 'files' : 'temp',
          type === 'blobCol' ? 'endOfRequest' : purge,
        ),
      );
      if (type === 'blobCol' || purge === 'endOfRequest') requestFiles.push(...names);
      submit.values[entry.n] = names.join(':');
    }
    return (result) => {
      purgeRequestFiles(renderer.db, requestFiles);
      const download = takeDownload(session);
      if (download && !result.errors?.length)
        return { redirectURL: route(renderer, 'files.download', { id: keepDownload(session, download) }) };
      return result;
    };
  },
  respond: (_renderer, ctx) => {
    const download = takeDownload(ctx.session);
    return download ? fileResponse(download) : undefined;
  },
});
