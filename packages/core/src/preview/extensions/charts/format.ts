/** Number and date formatting that mirrors the Oracle JET converters APEX configures for charts. */

export interface ValueFormat {
  format?: string | undefined;
  decimalPlaces?: number | undefined;
  currency?: string | undefined;
  scaling?: string | undefined;
}

const SCALES: [string, number, string][] = [
  ['quadrillion', 1e15, 'P'],
  ['trillion', 1e12, 'T'],
  ['billion', 1e9, 'B'],
  ['million', 1e6, 'M'],
  ['thousand', 1e3, 'K'],
];

const DATE_STYLES: Record<string, Intl.DateTimeFormatOptions> = {
  dateShort: { dateStyle: 'short' },
  dateMedium: { dateStyle: 'medium' },
  dateLong: { dateStyle: 'long' },
  dateFull: { dateStyle: 'full' },
  timeShort: { timeStyle: 'short' },
  timeMedium: { timeStyle: 'medium' },
  timeLong: { timeStyle: 'medium' },
  timeFull: { timeStyle: 'medium' },
  datetimeShort: { dateStyle: 'short', timeStyle: 'short' },
  datetimeMedium: { dateStyle: 'medium', timeStyle: 'short' },
  datetimeLong: { dateStyle: 'long', timeStyle: 'short' },
  datetimeFull: { dateStyle: 'full', timeStyle: 'short' },
};

export const isDateFormat = (format: string | undefined) => !!format && format in DATE_STYLES;

/** SQLite hands dates back as ISO-like text; anything else is not treated as a date. */
export function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/u.exec(value.trim());
  if (!match) return undefined;
  const [, y, m, d, hh = '0', mm = '0', ss = '0'] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatDate(value: unknown, format = 'dateShort'): string {
  const date = parseDate(value);
  if (!date) return String(value ?? '');
  return new Intl.DateTimeFormat('en-US', DATE_STYLES[format] ?? DATE_STYLES.dateShort).format(date);
}

/** Formats a data value (labels, tooltips). */
export function formatValue(value: number | null | undefined, spec: ValueFormat = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const { format, currency } = spec;
  let scaled = value;
  let suffix = '';
  const scaling = spec.scaling ?? 'none';
  if (scaling !== 'none') {
    const entry =
      scaling === 'auto'
        ? SCALES.find(([, factor]) => Math.abs(value) >= factor)
        : SCALES.find(([name]) => name === scaling);
    if (entry) {
      scaled = value / entry[1];
      suffix = entry[2];
    }
  }
  const digits =
    spec.decimalPlaces ?? (suffix ? (Math.abs(scaled) < 10 && scaled % 1 !== 0 ? 1 : 0) : undefined);
  const options: Intl.NumberFormatOptions =
    digits === undefined
      ? { maximumFractionDigits: Math.abs(scaled) < 1 && scaled !== 0 ? 4 : 2 }
      : { minimumFractionDigits: digits, maximumFractionDigits: digits };
  if (format === 'percent') {
    return `${new Intl.NumberFormat('en-US', { ...options, style: 'percent' }).format(scaled)}${suffix}`;
  }
  if (format === 'currency') {
    let text: string;
    try {
      text = new Intl.NumberFormat('en-US', {
        ...options,
        style: 'currency',
        currency: /^[A-Z]{3}$/u.test(currency ?? '') ? currency : 'USD',
      }).format(scaled);
    } catch {
      text = `$${new Intl.NumberFormat('en-US', options).format(scaled)}`;
    }
    return `${text}${suffix}`;
  }
  return `${new Intl.NumberFormat('en-US', options).format(scaled)}${suffix}`;
}

/** Axis tick labels: JET scales large values automatically unless told otherwise. */
export function formatTick(value: number, spec: ValueFormat, step: number): string {
  const scaling = spec.scaling ?? 'auto';
  const magnitude = Math.max(Math.abs(value), Math.abs(step));
  const entry =
    scaling === 'auto'
      ? SCALES.find(([, factor]) => magnitude >= factor)
      : SCALES.find(([name]) => name === scaling);
  const factor = entry?.[1] ?? 1;
  const stepDigits = Math.max(0, Math.ceil(-Math.log10(Math.abs(step / factor) || 1) + 0.0001));
  const digits = spec.decimalPlaces ?? Math.min(4, stepDigits);
  return formatValue(value, {
    ...spec,
    scaling: entry ? entry[0] : 'none',
    decimalPlaces: spec.format === 'percent' ? Math.max(0, digits - 2) : digits,
  });
}

/** "Nice" linear axis: rounded bounds and a 1/2/5 step. */
export function niceScale(
  low: number,
  high: number,
  options: {
    min?: number | undefined;
    max?: number | undefined;
    step?: number | undefined;
    ticks?: number;
    includeZero?: boolean;
  } = {},
): { min: number; max: number; step: number } {
  const zero = options.includeZero ?? true;
  let min = options.min ?? (zero ? Math.min(0, low) : low);
  let max = options.max ?? (zero ? Math.max(0, high) : high);
  if (!(max > min)) {
    if (options.max === undefined) max = min + (Math.abs(min) || 1);
    else min = max - (Math.abs(max) || 1);
  }
  const target = options.ticks ?? 5;
  let step = options.step;
  if (!step || step <= 0) {
    const raw = (max - min) / target;
    const power = 10 ** Math.floor(Math.log10(raw));
    const fraction = raw / power;
    step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * power;
  }
  if (options.min === undefined) min = Math.floor(min / step + 1e-9) * step;
  if (options.max === undefined) max = Math.ceil(max / step - 1e-9) * step;
  if (max === min) max = min + step;
  return { min, max, step };
}

export function ticks(scale: { min: number; max: number; step: number }): number[] {
  const values: number[] = [];
  const count = Math.min(200, Math.round((scale.max - scale.min) / scale.step));
  for (let index = 0; index <= count; index += 1) {
    values.push(Number((scale.min + index * scale.step).toPrecision(12)));
  }
  return values;
}

/** Rough text width for the SVG layout (Oracle Sans at ~0.55em per glyph). */
export const textWidth = (value: string, size = 12) => value.length * size * 0.56;

export function truncate(value: string, maxWidth: number, size = 12): string {
  if (textWidth(value, size) <= maxWidth) return value;
  const chars = Math.max(1, Math.floor(maxWidth / (size * 0.56)) - 1);
  return `${value.slice(0, chars)}…`;
}
