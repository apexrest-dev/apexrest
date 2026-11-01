import type { Row } from '../../database.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { applyTemplate } from './directives.ts';

/**
 * Row substitution for region attributes that APEX evaluates once per row (Cards, List View,
 * template component actions): `&COLUMN.` / `&COLUMN!FILTER.` and `#COLUMN#` / `#COLUMN!FILTER#`
 * column values, template directives over the row, then `&ITEM.` session state and built-ins.
 *
 * Without an explicit filter `&COLUMN.` is HTML escaped (RAW in URL contexts), while `#COLUMN#`
 * follows the region's "Escape special characters" setting.
 */

/** Row values keyed by upper-case column name, NULL as the empty string. */
export function rowValues(row: Row): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(row))
    values[key.toUpperCase()] = value === null || value === undefined ? '' : String(value);
  return values;
}

const AMPERSAND = /&(?:"([^"]+)"|([A-Za-z][\w$#]*?))(?:!([A-Z]+))?\./gu;

/** `&COLUMN[!FILTER].` of row columns as `#COLUMN!FILTER#` placeholders; other names stay. */
export function columnPlaceholders(
  template: string,
  values: Record<string, string>,
  defaultFilter: 'HTML' | 'RAW',
): string {
  if (!template.includes('&')) return template;
  return template.replace(AMPERSAND, (whole, quoted?: string, plain?: string, filter?: string) => {
    const name = (quoted ?? plain ?? '').toUpperCase();
    if (!Object.hasOwn(values, name) || !/^[_$A-Z0-9]+$/u.test(name)) return whole;
    return `#${name}!${filter ?? defaultFilter}#`;
  });
}

/**
 * Substitutes one row into `template`. `escape` selects HTML escaping for unfiltered `#COLUMN#`
 * placeholders and `&COLUMN.`; pass false for URLs and values the caller escapes itself.
 */
export function rowTemplate(
  renderer: ApexRenderer,
  ctx: RenderContext,
  template: string,
  row: Row,
  escape: boolean,
): string {
  if (!template) return '';
  const values = rowValues(row);
  const converted = columnPlaceholders(template, values, escape ? 'HTML' : 'RAW');
  const substituted = renderer.substitute(ctx.session, converted, ctx.page, escape ? 'HTML' : 'RAW');
  return applyTemplate(substituted, values, {
    defaultEscape: escape ? 'HTML' : false,
    removeUnknown: false,
  });
}
