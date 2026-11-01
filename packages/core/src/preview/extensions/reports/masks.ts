import { formatOracle } from '../../database.ts';

/**
 * Column format masks shared by reports, grids and template components: the Oracle number/date
 * masks of database.ts plus the APEX special masks `SINCE`, `SINCE_SHORT`, `FILESIZE` and
 * `PCT_GRAPH:...` (rendered as markup by the report cell renderer).
 */

const SINCE_UNITS: [number, string, string][] = [
  [31_536_000, 'year', 'y'],
  [2_592_000, 'month', 'mo'],
  [604_800, 'week', 'w'],
  [86_400, 'day', 'd'],
  [3600, 'hour', 'h'],
  [60, 'minute', 'm'],
];

/** Human date difference used by the `SINCE` (`3 days ago`) and `SINCE_SHORT` (`3d`) masks. */
export function since(value: unknown, now = Date.now(), short = false): string {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(typeof value === 'number' ? value : String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  const seconds = Math.round((now - date.getTime()) / 1000);
  const future = seconds < 0;
  const abs = Math.abs(seconds);
  for (const [size, unit, letter] of SINCE_UNITS) {
    const count = Math.floor(abs / size);
    if (count >= 1) {
      if (short) return future ? `in ${count}${letter}` : `${count}${letter}`;
      return `${count} ${unit}${count === 1 ? '' : 's'} ${future ? 'from now' : 'ago'}`;
    }
  }
  if (short) return future ? `in ${abs}s` : `${abs}s`;
  return `${abs} second${abs === 1 ? '' : 's'} ${future ? 'from now' : 'ago'}`;
}

/**
 * `FILESIZE` (apex_util.filesize_mask): bytes shown in the largest binary unit with one decimal
 * place, e.g. `512B`, `6.2KB`, `1.3MB`, `2GB`.
 */
export function filesize(value: unknown): string {
  const bytes = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(bytes)) return String(value);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = Math.abs(bytes);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const rounded = Math.round(size * 10) / 10;
  return `${bytes < 0 ? '-' : ''}${unit === 0 ? Math.round(size) : rounded}${units[unit]}`;
}

export function formatValue(raw: unknown, mask: string): string {
  if (raw === null || raw === undefined) return '';
  if (!mask) return String(raw);
  if (/^since$/iu.test(mask)) return since(raw);
  if (/^since_short$/iu.test(mask)) return since(raw, Date.now(), true);
  if (/^filesize$/iu.test(mask)) return filesize(raw);
  if (/^pct_graph/iu.test(mask)) return String(raw);
  return formatOracle(raw, mask) ?? '';
}

/** Masks the local formatter reproduces exactly (others are approximated with a diagnostic). */
export const SUPPORTED_MASK =
  /^(FM)?[L$]?[0-9GD,.]+$|9|^since(_short)?$|^filesize$|^pct_graph|^[A-Z]{0,4}(YYYY|RR|YY|MON|MM|DD|HH24|HH12|HH|MI|SS|[ ./:-]|AM|PM|DS|DL|MONTH|FM)+$/iu;
