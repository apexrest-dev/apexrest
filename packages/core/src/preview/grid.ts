/** APEX fixed-grid column placement (Column / Column Span of regions, items and buttons). */

import type { ApxComponent } from './apexlang.ts';

/** A component placed on the grid; its markup may depend on the column span it receives. */
export interface GridCell {
  component: ApxComponent;
  html: string | ((span: number) => string);
}

export interface GridRequest {
  /** 1-based start column, 0 for automatic. */
  column: number;
  /** Column span, 0 for automatic. */
  span: number;
}

export interface GridPlacement {
  /** Empty columns emitted before this one (a later explicit start column). */
  gap: number;
  span: number;
}

/**
 * Places the columns of one grid row. Explicit start columns split the row into segments; automatic
 * spans share what is left of their segment, and the space before an explicit start column that the
 * previous columns do not fill becomes an empty leading column.
 */
export function layoutGridRow(columns: GridRequest[], max: number): GridPlacement[] {
  const result: GridPlacement[] = [];
  let position = 1;
  let index = 0;
  while (index < columns.length) {
    let next = index + 1;
    while (next < columns.length && !(columns[next]!.column > 0)) next += 1;
    const requested = columns[index]!.column;
    const start = requested > position && requested <= max ? requested : position;
    const followingStart = next < columns.length ? columns[next]!.column : 0;
    const end = followingStart > start && followingStart <= max ? followingStart : max + 1;
    const segment = columns.slice(index, next);
    const explicit = segment.reduce((sum, column) => sum + column.span, 0);
    const automatic = segment.filter((column) => !column.span).length;
    const share = automatic ? Math.max(1, Math.floor((end - start - explicit) / automatic)) : 0;
    let used = 0;
    segment.forEach((column, offset) => {
      const span = Math.min(max, column.span || share || max);
      result.push({ gap: offset === 0 ? start - position : 0, span });
      used += span;
    });
    position = start + used;
    index = next;
  }
  return result;
}
