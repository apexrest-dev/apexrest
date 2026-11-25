import { Fault } from '../result.ts';
import { defaultAssetsDir, loadAssets } from '../preview/assets.ts';
import { indexTheme, type ThemeIndex } from '../preview/theme.ts';
import type { ApexLangDocument, ComponentNode, TextEdit } from './apexlang-edit.ts';
import type { Release } from './columns.ts';

/**
 * Typed template and grid-layout properties for `patch`/`edit` (26.2 sources):
 *
 * | Property          | Components            | APEXlang path                                         | Reset (`""`)      |
 * | ----------------- | --------------------- | ----------------------------------------------------- | ----------------- |
 * | `template`        | page, region          | `appearance.pageTemplate` / `appearance.template` (`@/id`) | theme default |
 * | `templateOptions` | page, region          | `appearance.templateOptions` (scalar or `[ … ]`)      | template defaults |
 * | `column`          | region, item          | `layout.column` (1-12)                                | automatic         |
 * | `columnSpan`      | region, item          | `layout.columnSpan` (1-12)                            | automatic         |
 * | `startNewRow`     | region, item          | `layout.startNewRow` (`true`/`false`)                 | `true`            |
 *
 * Template ids are checked against the installed Universal Theme (the preview's theme index of
 * APEX 26.2) or, without it, against the templates Oracle's Universal Theme 26.2 Reference app
 * uses (UPL-1.0). Template options are CSS classes the installed theme defines for the template, at
 * most one per option group; they need the installed theme (`apexrest_preview action:setup`).
 * A reset removes the property so the theme default applies. Nothing else is written.
 */

export const LAYOUT_PROPERTIES = [
  'template',
  'templateOptions',
  'column',
  'columnSpan',
  'startNewRow',
] as const;
export type LayoutProperty = (typeof LAYOUT_PROPERTIES)[number];
export const isLayoutProperty = (value: string): value is LayoutProperty =>
  (LAYOUT_PROPERTIES as readonly string[]).includes(value);

/** Templates used by Oracle's Universal Theme 26.2 Reference app (oracle/apex fbe095e4, UPL-1.0). */
const REFERENCE_TEMPLATES = {
  page: [
    'standard',
    'left-side-column',
    'right-side-column',
    'left-and-right-side-columns',
    'marquee',
    'login',
    'minimal-no-navigation',
  ],
  region: [
    'alert',
    'blank-with-attributes',
    'blank-with-attributes-no-grid',
    'buttons-container',
    'cards-container',
    'carousel-container',
    'collapsible',
    'content-block',
    'hero',
    'image',
    'inline-dialog',
    'inline-drawer',
    'inline-popup',
    'interactive-report',
    'login',
    'search-results-container',
    'standard',
    'tabs-container',
    'title-bar',
    'wizard-container',
  ],
};
/** Templates that only fit one region family. */
const REGION_TYPES: Record<string, string[]> = {
  'interactive-report': ['interactiveReport', 'interactiveGrid'],
  'cards-container': ['cards'],
};

export interface ThemeCatalog {
  source: 'installed' | 'reference';
  pages: Set<string>;
  regions: Set<string>;
  /** css class -> option group (undefined: no group) per template id; only for the installed theme. */
  options?: (kind: 'page' | 'region', template: string) => Map<string, string | undefined> | undefined;
}

let installed: ThemeIndex | null | undefined;
function installedTheme(): ThemeIndex | undefined {
  if (installed === undefined)
    try {
      installed = indexTheme(loadAssets(defaultAssetsDir()).theme);
    } catch {
      installed = null;
    }
  return installed ?? undefined;
}
/** Forget the loaded theme (tests). */
export const resetThemeCatalog = (theme?: ThemeIndex | null) => {
  installed = theme;
};

export function themeCatalog(): ThemeCatalog {
  const theme = installedTheme();
  if (!theme)
    return {
      source: 'reference',
      pages: new Set(REFERENCE_TEMPLATES.page),
      regions: new Set(REFERENCE_TEMPLATES.region),
    };
  return {
    source: 'installed',
    pages: new Set(theme.pages.keys()),
    regions: new Set(theme.regions.keys()),
    options: (kind, template) => {
      const owner = (kind === 'page' ? theme.pages : theme.regions).get(template.toLowerCase());
      if (!owner) return undefined;
      const key = kind === 'page' ? 'page_template_id' : 'region_template_id';
      const type = kind === 'page' ? 'PAGE' : 'REGION';
      const options = new Map<string, string | undefined>();
      for (const params of theme.options)
        if (
          params.template_types === type &&
          (params[key] === owner.id || params[key] === undefined || params[key] === null)
        )
          for (const css of String(params.css_classes ?? '')
            .split(/\s+/u)
            .filter(Boolean))
            options.set(css, params.group_id ? String(params.group_id) : undefined);
      return options;
    },
  };
}

const refOf = (raw: string | undefined) => raw?.replace(/^@\/?/u, '');
const TEMPLATE = /^[a-z][a-z0-9-]{0,127}$/u;

/** Lines of a property holding a `[ … ]` array: its own line through the closing bracket. */
function propertySpan(doc: ApexLangDocument, node: ComponentNode, path: string) {
  const property = node.properties.get(path);
  if (!property) return undefined;
  let end = property.line;
  if (property.value === '[') while (doc.lines[end]!.text.trim() !== ']') end++;
  else if (property.opaque)
    throw new Fault('TRANSFORM_UNSUPPORTED', `${path} holds a multi-line value; edit it in source.`, 5);
  const first = doc.lines[property.line]!;
  const last = doc.lines[end]!;
  return {
    start: first.offset,
    end: last.offset + last.text.length + last.eol.length,
    values: doc.lines.slice(property.line + 1, end).map((line) => line.text.trim()),
  };
}
export function currentOptions(doc: ApexLangDocument, node: ComponentNode): string[] {
  const property = node.properties.get('appearance.templateOptions');
  if (!property) return [];
  return property.value === '['
    ? propertySpan(doc, node, 'appearance.templateOptions')!.values
    : property.value.split(/\s+/u).filter(Boolean);
}

/**
 * The change of one layout property: a value to set at `path` (`text` in APEXlang form) or a
 * replacement/removal `edit`; `""` resets. Throws before anything is written.
 */
export type LayoutChange = { path: string; text: string } | { edit: TextEdit | undefined };
export function layoutEdit(
  doc: ApexLangDocument,
  node: ComponentNode,
  property: LayoutProperty,
  value: string,
  context: {
    release: Release;
    catalog: ThemeCatalog;
    template?: string | undefined;
    /** Grid values the same batch sets on this component. */
    grid?: { column?: string | undefined; columnSpan?: string | undefined };
  },
): LayoutChange {
  if (context.release !== '26.2')
    throw new Fault(
      'OPERATION_UNSUPPORTED',
      `${property} edits are qualified for 26.2 sources; edit 26.1 pages in source.`,
      2,
    );
  const kind =
    node.kind === 'page'
      ? 'page'
      : node.kind === 'region'
        ? 'region'
        : node.kind === 'pageItem'
          ? 'item'
          : '';
  const path = {
    template: kind === 'page' ? 'appearance.pageTemplate' : 'appearance.template',
    templateOptions: 'appearance.templateOptions',
    column: 'layout.column',
    columnSpan: 'layout.columnSpan',
    startNewRow: 'layout.startNewRow',
  }[property];
  const reset = (): LayoutChange => {
    const span = propertySpan(doc, node, path);
    return { edit: span ? { start: span.start, end: span.end, content: '' } : undefined };
  };
  if (property === 'template') {
    if (kind !== 'page' && kind !== 'region')
      throw new Fault('OPERATION_UNSUPPORTED', 'template applies to pages and regions.', 2);
    if (value === '') return reset();
    if (!TEMPLATE.test(value)) throw new Fault('INVALID_INPUT', `${value} is not a template id.`, 2);
    if (kind === 'page' && String(node.properties.get('appearance.pageMode')?.value ?? '') === 'modalDialog')
      throw new Fault(
        'OPERATION_UNSUPPORTED',
        'Modal dialog templates are not supported; edit them in source.',
        2,
      );
    const known = kind === 'page' ? context.catalog.pages : context.catalog.regions;
    if (!known.has(value))
      throw new Fault(
        'TEMPLATE_UNKNOWN',
        `${value} is not a ${kind} template of the ${context.catalog.source} Universal Theme 26.2.`,
        2,
      );
    const type = String(node.properties.get('type')?.value ?? '');
    if (kind === 'region' && REGION_TYPES[value] && !REGION_TYPES[value]!.includes(type))
      throw new Fault(
        'TEMPLATE_INCOMPATIBLE',
        `${value} is for ${REGION_TYPES[value]!.join(' or ')} regions, not ${type || 'this region'}.`,
        2,
      );
    return { path, text: `@/${value}` };
  }
  if (property === 'templateOptions') {
    if (kind !== 'page' && kind !== 'region')
      throw new Fault('OPERATION_UNSUPPORTED', 'templateOptions apply to pages and regions.', 2);
    if (value === '') return reset();
    const tokens = [...new Set(value.split(/[\s,]+/u).filter(Boolean))];
    const template =
      context.template ??
      refOf(
        node.properties.get(kind === 'page' ? 'appearance.pageTemplate' : 'appearance.template')?.value,
      ) ??
      'standard';
    const valid = context.catalog.options?.(kind, template);
    if (!valid)
      throw new Fault(
        'THEME_UNAVAILABLE',
        'Template options are checked against the installed Universal Theme; run apexrest_preview action:setup first.',
        2,
      );
    const groups = new Map<string, string>();
    for (const token of tokens) {
      if (token === '#DEFAULT#') continue;
      if (!valid.has(token))
        throw new Fault('TEMPLATE_OPTION_UNKNOWN', `${token} is not an option of template ${template}.`, 2);
      const group = valid.get(token);
      if (group && groups.has(group))
        throw new Fault(
          'TEMPLATE_OPTION_CONFLICT',
          `${token} and ${groups.get(group)} belong to the same option group.`,
          2,
        );
      if (group) groups.set(group, token);
    }
    const indent = ' '.repeat(node.indent + 8);
    const text =
      tokens.length === 1
        ? `templateOptions: ${tokens[0]}`
        : ['templateOptions: [', ...tokens.map((token) => `    ${token}`), ']'].join(doc.eol + indent);
    const span = propertySpan(doc, node, path);
    if (span) return { edit: { start: span.start, end: span.end, content: indent + text + doc.eol } };
    return { path, text: text.slice('templateOptions: '.length) };
  }
  if (kind !== 'region' && kind !== 'item')
    throw new Fault('OPERATION_UNSUPPORTED', `${property} applies to regions and items.`, 2);
  if (value === '') return reset();
  if (property === 'startNewRow') {
    if (value !== 'true' && value !== 'false')
      throw new Fault('INVALID_INPUT', 'startNewRow is "true" or "false".', 2);
    return { path, text: value };
  }
  if (!/^(?:[1-9]|1[0-2])$/u.test(value))
    throw new Fault('INVALID_INPUT', `${property} is a grid column from 1 to 12.`, 2);
  const column = Number(
    property === 'column'
      ? value
      : (context.grid?.column ?? node.properties.get('layout.column')?.value ?? 0),
  );
  const span = Number(
    property === 'columnSpan'
      ? value
      : (context.grid?.columnSpan ?? node.properties.get('layout.columnSpan')?.value ?? 0),
  );
  if (column && span && column - 1 + span > 12)
    throw new Fault(
      'INVALID_INPUT',
      `Column ${column} with span ${span} does not fit the 12-column grid.`,
      2,
    );
  return { path, text: value };
}
