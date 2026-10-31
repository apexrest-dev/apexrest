import { processDirectives } from './extensions/components/directives.ts';
import type { SqlValue, ThemeCall } from './theme-sql.ts';

export type TemplateParams = Record<string, SqlValue>;

export interface ThemeIndex {
  theme: TemplateParams;
  pages: Map<string, TemplateParams>;
  regions: Map<string, TemplateParams>;
  fields: Map<string, TemplateParams>;
  buttons: Map<string, TemplateParams>;
  lists: Map<string, TemplateParams>;
  reports: Map<string, TemplateParams>;
  breadcrumbs: Map<string, TemplateParams>;
  styles: Map<string, TemplateParams>;
  /** template id -> apexlang slot name -> placeholder */
  slots: Map<string, Map<string, string>>;
  byId: Map<string, TemplateParams>;
}

const KIND_TO_MAP = {
  template: 'pages',
  plug_template: 'regions',
  field_template: 'fields',
  button_templates: 'buttons',
  list_template: 'lists',
  row_template: 'reports',
  menu_template: 'breadcrumbs',
  theme_style: 'styles',
} as const;

export function indexTheme(calls: ThemeCall[]): ThemeIndex {
  const index: ThemeIndex = {
    theme: {},
    pages: new Map(),
    regions: new Map(),
    fields: new Map(),
    buttons: new Map(),
    lists: new Map(),
    reports: new Map(),
    breadcrumbs: new Map(),
    styles: new Map(),
    slots: new Map(),
    byId: new Map(),
  };
  for (const call of calls) {
    const params = call.params;
    if (call.kind === 'theme') index.theme = params;
    const target = KIND_TO_MAP[call.kind as keyof typeof KIND_TO_MAP];
    if (target && typeof params.static_id === 'string')
      index[target].set(params.static_id.toLowerCase(), params);
    if (typeof params.id === 'string' && target) index.byId.set(params.id, params);
    if (call.kind === 'page_tmpl_display_point' || call.kind === 'plug_tmpl_display_point') {
      const owner = String(params.page_template_id ?? params.plug_template_id ?? '');
      const slots = index.slots.get(owner) ?? new Map<string, string>();
      if (typeof params.apexlang_name === 'string' && typeof params.placeholder === 'string') {
        slots.set(params.apexlang_name, params.placeholder);
      }
      index.slots.set(owner, slots);
    }
  }
  return index;
}

export function text(params: TemplateParams | undefined, key: string): string {
  const value = params?.[key];
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
}

/** Static ID of a theme default such as `default_page_template`. */
export function defaultStaticId(index: ThemeIndex, key: string, fallback: string): string {
  const id = index.theme[key];
  const params = typeof id === 'string' ? index.byId.get(id) : undefined;
  return typeof params?.static_id === 'string' ? params.static_id : fallback;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

export function escapeJs(value: unknown): string {
  return JSON.stringify(String(value ?? ''))
    .slice(1, -1)
    .replaceAll('<', '\\u003c')
    .replaceAll("'", '\\u0027');
}

export function applyEscape(value: string, filter: string | undefined): string {
  switch ((filter ?? '').toUpperCase()) {
    case 'RAW':
      return value;
    case 'JS':
      return escapeJs(value);
    case 'STRIPHTML':
      return value.replace(/<[^>]*>/gu, '');
    case 'URL':
      return encodeURIComponent(value);
    default:
      return escapeHtml(value);
  }
}

/**
 * Template directives (`{if}`, `{case}`, `{loop}`, `{with/}{apply}`, …) as `apex.util.applyTemplate`
 * evaluates them; see extensions/components/directives.ts. Placeholders are left for `fill`.
 */
export function applyDirectives(template: string, values: Record<string, string>): string {
  return processDirectives(template, values);
}

/**
 * Replaces `#NAME#` placeholders. Placeholders that are not supplied are removed when `strict` is false,
 * which mirrors how APEX drops unused template positions.
 */
export function fill(template: string, values: Record<string, string>, removeUnknown = true): string {
  const upper = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.toUpperCase(), value]));
  return applyDirectives(template, upper).replace(
    /#([A-Z][A-Z0-9_$]*)(?:!([A-Z]+))?#/gu,
    (whole, name: string, filter?: string) => {
      if (name in upper) return filter ? applyEscape(upper[name]!, filter) : upper[name]!;
      return removeUnknown ? '' : whole;
    },
  );
}

/** `#DEFAULT#` plus explicit template option classes. */
export function templateOptions(options: string[], defaults: string): string {
  const classes: string[] = [];
  // APEXlang omits properties left at their default, so no options means the template defaults.
  for (const option of options.length ? options : ['#DEFAULT#']) {
    if (option === '#DEFAULT#') classes.push(...defaults.split(/[:\s]+/u).filter(Boolean));
    else classes.push(...option.split(/\s+/u).filter(Boolean));
  }
  return [...new Set(classes)].join(' ');
}
