import type { ApxComponent, ApxObject } from './apexlang.ts';
import type { ApexError, ApexRenderer, RenderContext, Session } from './render.ts';

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

/** Element HTML of a page item (the label/field template wraps it). */
export type ItemRenderer = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  item: ApxComponent,
  name: string,
  value: string,
) => string;

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

export interface RouteRequest {
  method: string;
  params: URLSearchParams;
  body: string;
}

export interface RouteResponse {
  status?: number;
  type: 'json' | 'html' | 'text' | 'js';
  body: string;
}

/** Served at `/r/<alias>/__apex/x/<name>` with the caller's session. */
export type RouteHandler = (renderer: ApexRenderer, session: Session, request: RouteRequest) => RouteResponse;

export interface PreviewExtension {
  name: string;
  regions?: Record<string, RegionRenderer>;
  items?: Record<string, ItemRenderer>;
  /** Template placeholder adjustments for items; see ItemTemplateHook. */
  itemTemplate?: ItemTemplateHook;
  processes?: Record<string, ProcessHandler>;
  conditions?: Record<string, ConditionHandler>;
  validations?: Record<string, ValidationHandler>;
  code?: CodeRunner;
  expression?: ExpressionEvaluator;
  routes?: Record<string, RouteHandler>;
  /** Browser JavaScript appended to /__apex/runtime.js; `apexLocal` and `apex` are available. */
  client?: string;
  /** CSS appended to /__apex/runtime.css. */
  css?: string;
  /** Called once per page render before the template is filled (add ctx.jsFiles, ctx.cssFiles, ctx.onload). */
  page?: (renderer: ApexRenderer, ctx: RenderContext) => void;
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
