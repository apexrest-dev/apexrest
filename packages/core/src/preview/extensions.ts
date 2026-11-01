import type { ApxComponent, ApxObject } from './apexlang.ts';
import type { ApexError, ApexRenderer, RenderContext, Session, TraceEvent } from './render.ts';
import type { TemplateParams } from './theme.ts';

/**
 * Feature modules plug into the local preview here instead of growing render.ts.
 * Each module registers itself from `extensions/index.ts`; the renderer consults the
 * registry before its built-in behavior, so a module can add a type or replace one.
 */

/** Body HTML of a region; `slots` holds rendered buttons keyed by placeholder. */
export type RegionRenderer = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  slots: Record<string, string>,
) => string;

/** Cell HTML of a report column by column `type` (e.g. `themeTemplateComponent/badge`). */
export type ColumnRenderer = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  column: ApxComponent,
  row: Record<string, unknown>,
) => string;

/** Element HTML of a page item (the label/field template wraps it). */
export type ItemRenderer = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  item: ApxComponent,
  name: string,
  value: string,
) => string;

/** A region's template, its filled positions and the rendered sub-regions by placeholder. */
export interface RegionParts {
  template: TemplateParams;
  values: Record<string, string>;
  children: Map<string, { component: ApxComponent; html: string }[]>;
}

/** Final region HTML (instead of filling the region template), or undefined for the default. */
export type RegionWrapper = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  parts: RegionParts,
) => string | undefined;

/**
 * Adjusts the label/field template placeholders of a rendered item (ITEM_CSS_CLASSES,
 * CURRENT_ITEM_PRE_TEXT, ...) after its element HTML was produced. Runs for every visible item.
 */
export type ItemTemplateHook = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  item: ApxComponent,
  values: Record<string, string>,
) => void;

export interface ProcessResult {
  ran: boolean;
  closeDialog?: boolean;
  redirectURL?: string;
  errors?: ApexError[];
}

/** Page process by `type`; runs for beforeHeader and submit points alike (inspect `point`). */
export type ProcessHandler = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
  point: 'beforeHeader' | 'submit',
  pressed: ApxComponent | undefined,
) => ProcessResult;

/** Server-side condition by type. Return undefined to fall through. */
export type ConditionHandler = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  condition: ApxObject,
) => boolean | undefined;

/** Validation by `validation.type`. Return an error message, null when valid, undefined to fall through. */
export type ValidationHandler = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  validation: ApxComponent,
) => string | null | undefined;

/**
 * Runs server code (PL/SQL bodies of processes, dynamic actions, computations).
 * Return true when executed, false when it failed and was reported, undefined to fall through.
 */
export type CodeRunner = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  code: string,
  owner: ApxComponent,
) => boolean | undefined;

/** Evaluates a PL/SQL or SQL expression; undefined when not understood. */
export type ExpressionEvaluator = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  expression: string,
  language: 'plsqlExpression' | 'plsqlFunctionBody' | 'sqlExpression',
) => string | number | boolean | null | undefined;

/**
 * Rewrites the SQL of a data region before ordering is applied (e.g. faceted search filters).
 * Return undefined to leave it unchanged.
 */
export type RegionSqlFilter = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  sql: string,
) => string | undefined;

/**
 * Supplies the SQL of a data region whose source is not a local query (e.g. a REST Data
 * Source answered from fixtures). Return undefined to use the region's own SQL or table.
 */
export type RegionSourceProvider = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
) => string | undefined;

/** A file part of a multipart request (`p_files` of apex.page.submit or apex.server calls). */
export interface UploadedFile {
  field: string;
  filename: string;
  mimeType: string;
  data: Buffer;
}

export interface RouteRequest {
  method: string;
  params: URLSearchParams;
  /** The body; multipart requests arrive as the url-encoded text fields. */
  body: string;
  files?: UploadedFile[];
}

export interface RouteResponse {
  status?: number;
  type: 'json' | 'html' | 'text' | 'js' | 'binary';
  body: string;
  /** Content of a `binary` response (a downloaded file or an image). */
  data?: Uint8Array;
  /** Overrides the content type of the response type. */
  contentType?: string;
  headers?: Record<string, string>;
}

/** Served at `/r/<alias>/__apex/x/<name>` with the caller's session. */
export type RouteHandler = (renderer: ApexRenderer, session: Session, request: RouteRequest) => RouteResponse;

/**
 * Application lifecycle points: `beforeHeader` (before page computations), `afterHeader`
 * (after before-header processing, before regions render), `afterSubmit` (after item values
 * are stored, before validations) and `processing` (before page processes).
 * Returned errors stop a submit and are shown like validation errors.
 */
export type PreviewPoint = 'beforeHeader' | 'afterHeader' | 'afterSubmit' | 'processing';

export type PointHandler = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  point: PreviewPoint,
) => ApexError[] | undefined;

/** Outcome of `wwv_flow.accept`. */
export interface AcceptResult {
  redirectURL?: string;
  errors?: ApexError[];
}

export interface SubmitRequest {
  pageId: string;
  request: string;
  /** All submitted fields (p_json, f01-f50, x01-x20, ...). */
  form: URLSearchParams;
  files: UploadedFile[];
  /** pageItems.itemsToSubmit of p_json; the 1-based `fileIndex` and `fileCount` point into `files`. */
  items: { n: string; v: string | string[]; fileIndex?: number; fileCount?: number }[];
  /** Item values passed on to the submit; hooks may change them. */
  values: Record<string, string>;
}

/**
 * Runs before a page submit is accepted (uploads, legacy f01-f50 arrays). The returned
 * function, if any, sees and may replace the result once the submit was processed.
 */
export type SubmitHook = (
  renderer: ApexRenderer,
  session: Session,
  submit: SubmitRequest,
) => ((result: AcceptResult) => AcceptResult) | undefined;

/** Replaces the response of a rendered page, e.g. a file download started by a before-header process. */
export type PageResponder = (renderer: ApexRenderer, ctx: RenderContext) => RouteResponse | undefined;

/**
 * Receives the renderer's debug trace: request begin/end, computations, processes, validations,
 * branches, authorization and diagnostics (see TraceEvent). `ctx` is undefined for events raised
 * outside a page context (diagnostics), which belong to the request currently being handled.
 */
export type TraceHandler = (
  renderer: ApexRenderer,
  ctx: RenderContext | undefined,
  event: TraceEvent,
) => void;

/**
 * Decides an authorization scheme by name for the current session: true allows, false denies,
 * undefined falls through (the preview allows by default).
 */
export type AuthorizationHandler = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  scheme: string,
) => boolean | undefined;

export interface PreviewExtension {
  name: string;
  regions?: Record<string, RegionRenderer>;
  items?: Record<string, ItemRenderer>;
  columns?: Record<string, ColumnRenderer>;
  /** Template placeholder adjustments for items; see ItemTemplateHook. */
  itemTemplate?: ItemTemplateHook;
  processes?: Record<string, ProcessHandler>;
  conditions?: Record<string, ConditionHandler>;
  validations?: Record<string, ValidationHandler>;
  code?: CodeRunner;
  expression?: ExpressionEvaluator;
  routes?: Record<string, RouteHandler>;
  regionSql?: RegionSqlFilter;
  regionSource?: RegionSourceProvider;
  /** Browser JavaScript appended to /__apex/runtime.js; `apexLocal` and `apex` are available. */
  client?: string;
  /** CSS appended to /__apex/runtime.css. */
  css?: string;
  /** Wraps a rendered region, e.g. sub-region templates or template components displayed as the region. */
  wrapRegion?: RegionWrapper;
  /** Called once per page render before the template is filled (add ctx.jsFiles, ctx.cssFiles, ctx.onload). */
  page?: (renderer: ApexRenderer, ctx: RenderContext) => void;
  /**
   * HTML appended inside the developer toolbar bar. Buttons with `data-apex-local-panel="name"`
   * toggle `<div class="apex-local-panel" data-panel="name">` panels, which open above the bar.
   */
  toolbar?: (renderer: ApexRenderer, ctx: RenderContext) => string;
  point?: PointHandler;
  /**
   * Validations of editable regions (interactive grids) for the rows a page submit changes;
   * runs with the page validations, the errors are collected with theirs.
   */
  rowValidation?: (renderer: ApexRenderer, ctx: RenderContext) => ApexError[];
  submit?: SubmitHook;
  respond?: PageResponder;
  trace?: TraceHandler;
  authorize?: AuthorizationHandler;
}

export const extensions: PreviewExtension[] = [];

export function registerExtension(extension: PreviewExtension): void {
  const existing = extensions.findIndex((entry) => entry.name === extension.name);
  if (existing >= 0) extensions.splice(existing, 1, extension);
  else extensions.push(extension);
}

/** Later registrations win, so a module can override an earlier one. */
function lookup<K extends keyof PreviewExtension>(key: K, type: string) {
  for (let index = extensions.length - 1; index >= 0; index -= 1) {
    const table = extensions[index]![key] as Record<string, unknown> | undefined;
    if (table && Object.hasOwn(table, type)) return table[type];
  }
  return undefined;
}

export const regionRenderer = (type: string) => lookup('regions', type) as RegionRenderer | undefined;
export const itemRenderer = (type: string) => lookup('items', type) as ItemRenderer | undefined;
/** By full type, then by the part before `/` (`themeTemplateComponent/badge` -> `themeTemplateComponent`). */
export const columnRenderer = (type: string) =>
  (lookup('columns', type) ?? (type.includes('/') ? lookup('columns', type.split('/')[0]!) : undefined)) as
    ColumnRenderer | undefined;
export const processHandler = (type: string) => lookup('processes', type) as ProcessHandler | undefined;
export const conditionHandler = (type: string) => lookup('conditions', type) as ConditionHandler | undefined;
export const validationHandler = (type: string) =>
  lookup('validations', type) as ValidationHandler | undefined;
export const routeHandler = (name: string) => lookup('routes', name) as RouteHandler | undefined;

export function runCodeExtensions(
  renderer: ApexRenderer,
  ctx: RenderContext,
  code: string,
  owner: ApxComponent,
): boolean | undefined {
  for (let index = extensions.length - 1; index >= 0; index -= 1) {
    const result = extensions[index]!.code?.(renderer, ctx, code, owner);
    if (result !== undefined) return result;
  }
  return undefined;
}

export function evaluateExpression(
  renderer: ApexRenderer,
  ctx: RenderContext,
  expression: string,
  language: 'plsqlExpression' | 'plsqlFunctionBody' | 'sqlExpression',
): string | number | boolean | null | undefined {
  for (let index = extensions.length - 1; index >= 0; index -= 1) {
    const result = extensions[index]!.expression?.(renderer, ctx, expression, language);
    if (result !== undefined) return result;
  }
  return undefined;
}

export function runPointExtensions(
  renderer: ApexRenderer,
  ctx: RenderContext,
  point: PreviewPoint,
): ApexError[] {
  const errors: ApexError[] = [];
  for (const extension of extensions) errors.push(...(extension.point?.(renderer, ctx, point) ?? []));
  return errors;
}

export function runRowValidationExtensions(renderer: ApexRenderer, ctx: RenderContext): ApexError[] {
  return extensions.flatMap((extension) => extension.rowValidation?.(renderer, ctx) ?? []);
}

export function traceExtensions(
  renderer: ApexRenderer,
  ctx: RenderContext | undefined,
  event: TraceEvent,
): void {
  for (const extension of extensions) extension.trace?.(renderer, ctx, event);
}

export function authorizeExtensions(
  renderer: ApexRenderer,
  ctx: RenderContext,
  scheme: string,
): boolean | undefined {
  for (let index = extensions.length - 1; index >= 0; index -= 1) {
    const result = extensions[index]!.authorize?.(renderer, ctx, scheme);
    if (result !== undefined) return result;
  }
  return undefined;
}

export function filterRegionSql(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  sql: string,
): string {
  let result = sql;
  for (const extension of extensions) result = extension.regionSql?.(renderer, ctx, region, result) ?? result;
  return result;
}

export function regionSourceSql(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
): string | undefined {
  for (let index = extensions.length - 1; index >= 0; index -= 1) {
    const sql = extensions[index]!.regionSource?.(renderer, ctx, region);
    if (sql !== undefined) return sql;
  }
  return undefined;
}

export const extensionClient = () =>
  extensions
    .filter((entry) => entry.client)
    .map((entry) => `\n/* ${entry.name} */\n${entry.client}`)
    .join('\n');

export const extensionCss = () =>
  extensions
    .filter((entry) => entry.css)
    .map((entry) => `\n/* ${entry.name} */\n${entry.css}`)
    .join('\n');

export function runSubmitExtensions(
  renderer: ApexRenderer,
  session: Session,
  submit: SubmitRequest,
): ((result: AcceptResult) => AcceptResult)[] {
  return extensions.flatMap((extension) => extension.submit?.(renderer, session, submit) ?? []);
}

export function pageResponse(renderer: ApexRenderer, ctx: RenderContext): RouteResponse | undefined {
  for (const extension of extensions) {
    const response = extension.respond?.(renderer, ctx);
    if (response) return response;
  }
  return undefined;
}
