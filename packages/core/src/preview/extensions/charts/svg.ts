import { escapeHtml } from '../../theme.ts';
import {
  formatDate,
  formatTick,
  formatValue,
  niceScale,
  parseDate,
  textWidth,
  ticks,
  truncate,
} from './format.ts';
import type { ChartAxis, ChartModel, ChartPoint, ChartSeries } from './model.ts';

/** Oracle JET Redwood data-visualization palette (`--oj-palette-dvt-rgb-1..12`). */
export const PALETTE = [
  '#245d63',
  '#d7790f',
  '#31a09c',
  '#4e4137',
  '#699e61',
  '#b47282',
  '#83401e',
  '#9e7fcc',
  '#a88e00',
  '#58316e',
  '#5999b5',
  '#317a45',
];

const esc = escapeHtml;
const fixed = (value: number) => Number(value.toFixed(2));

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LegendItem {
  name: string;
  color: string;
  shape: 'square' | 'line' | 'circle';
}

const seriesColor = (model: ChartModel, series: ChartSeries) =>
  series.color ?? PALETTE[model.series.indexOf(series) % PALETTE.length]!;

const attr = (name: string, value: string | number | undefined) =>
  value === undefined || value === '' ? '' : ` ${name}="${esc(value)}"`;

function linked(markup: string, link: string | undefined): string {
  return link ? `<a href="${esc(link)}" class="ajc-link">${markup}</a>` : markup;
}

function tooltip(
  model: ChartModel,
  series: ChartSeries | undefined,
  point: ChartPoint,
  value: string,
  extra: string[] = [],
): string {
  if (!model.tooltip.show) return '';
  if (point.tooltip) return attr('data-tip', point.tooltip);
  const lines: string[] = [];
  if (series && model.tooltip.series && model.series.length > 0) lines.push(`Series\t${series.name}`);
  if (model.tooltip.group && point.group !== '') lines.push(`Group\t${groupLabel(model, point.group)}`);
  if (model.tooltip.value) lines.push(`Value\t${value}`);
  lines.push(...extra);
  return attr('data-tip', lines.join('\n'));
}

function groupLabel(model: ChartModel, group: string): string {
  if (!model.timeAxis) return group;
  const format = model.axes.x.format.format;
  if (format) return formatDate(group, format);
  const date = parseDate(group);
  return formatDate(group, date && (date.getHours() || date.getMinutes()) ? 'datetimeShort' : 'dateMedium');
}

function textEl(
  x: number,
  y: number,
  value: string,
  options: {
    anchor?: string;
    cls?: string;
    size?: number;
    rotate?: number;
    baseline?: string;
    fill?: string | undefined;
  } = {},
): string {
  const transform = options.rotate ? ` transform="rotate(${options.rotate} ${fixed(x)} ${fixed(y)})"` : '';
  return `<text x="${fixed(x)}" y="${fixed(y)}"${attr('class', options.cls ?? 'ajc-label')}${attr('text-anchor', options.anchor)}${attr('dominant-baseline', options.baseline ?? 'middle')}${options.size ? ` font-size="${options.size}"` : ''}${options.fill ? ` style="fill:${esc(options.fill)}"` : ''}${transform}>${esc(value)}</text>`;
}

/** Text color that reads on top of a fill. */
function contrast(color: string): string {
  const hex = /^#?([0-9a-f]{6})$/iu.exec(color.trim())?.[1];
  if (!hex) return '#fff';
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return 0.299 * r! + 0.587 * g! + 0.114 * b! > 160 ? '#161513' : '#fff';
}

// ---------------------------------------------------------------- legend

function legend(
  model: ChartModel,
  items: LegendItem[],
  box: Box,
  pieLike: boolean,
): { svg: string; plot: Box } {
  if (!model.legend.show || !items.length) return { svg: '', plot: box };
  let position = model.legend.position;
  if (position === 'auto') position = pieLike && box.w >= 420 ? 'end' : 'bottom';
  const itemWidth = (item: LegendItem) => Math.min(textWidth(item.name), 180) + 26;
  const title = model.legend.title;
  const swatch = (item: LegendItem, x: number, y: number) =>
    item.shape === 'line'
      ? `<line x1="${fixed(x)}" y1="${fixed(y)}" x2="${fixed(x + 14)}" y2="${fixed(y)}" stroke="${esc(item.color)}" stroke-width="3" stroke-linecap="round"/>`
      : item.shape === 'circle'
        ? `<circle cx="${fixed(x + 7)}" cy="${fixed(y)}" r="5" fill="${esc(item.color)}"/>`
        : `<rect x="${fixed(x + 1)}" y="${fixed(y - 6)}" width="12" height="12" rx="2" fill="${esc(item.color)}"/>`;
  const entry = (item: LegendItem, x: number, y: number) =>
    `<g class="ajc-legend-item" data-series="${esc(item.name)}">${swatch(item, x, y)}${textEl(x + 20, y, truncate(item.name, 180), { cls: 'ajc-legend-text' })}</g>`;
  if (position === 'start' || position === 'end') {
    const width = Math.min(box.w * 0.4, Math.max(...items.map(itemWidth), title ? textWidth(title) : 0) + 12);
    const lineHeight = 22;
    const visible = items.slice(0, Math.max(1, Math.floor((box.h - (title ? 22 : 0)) / lineHeight)));
    const total = visible.length * lineHeight + (title ? 22 : 0);
    const x = position === 'end' ? box.x + box.w - width + 8 : box.x + 4;
    let y = box.y + Math.max(0, (box.h - total) / 2) + 11;
    let svg = '';
    if (title) {
      svg += textEl(x, y, title, { cls: 'ajc-legend-title' });
      y += 22;
    }
    for (const item of visible) {
      svg += entry(item, x, y);
      y += lineHeight;
    }
    const plot =
      position === 'end'
        ? { ...box, w: box.w - width - 8 }
        : { ...box, x: box.x + width + 8, w: box.w - width - 8 };
    return { svg: `<g class="ajc-legend">${svg}</g>`, plot };
  }
  const rows: LegendItem[][] = [[]];
  let used = title ? textWidth(title) + 16 : 0;
  for (const item of items) {
    const width = itemWidth(item) + 14;
    if (used + width > box.w && rows.at(-1)!.length) {
      rows.push([]);
      used = 0;
    }
    rows.at(-1)!.push(item);
    used += width;
  }
  const shown = rows.slice(0, 3);
  const height = shown.length * 22 + 6;
  let svg = '';
  shown.forEach((row, index) => {
    const widths = row.map((item) => itemWidth(item) + 14);
    const titleWidth = index === 0 && title ? textWidth(title) + 16 : 0;
    const total = widths.reduce((sum, width) => sum + width, 0) - 14 + titleWidth;
    let x = box.x + Math.max(0, (box.w - total) / 2);
    const y = position === 'top' ? box.y + 11 + index * 22 : box.y + box.h - height + 14 + index * 22;
    if (titleWidth) {
      svg += textEl(x, y, title, { cls: 'ajc-legend-title' });
      x += titleWidth;
    }
    row.forEach((item, itemIndex) => {
      svg += entry(item, x, y);
      x += widths[itemIndex]!;
    });
  });
  const plot =
    position === 'top' ? { ...box, y: box.y + height, h: box.h - height } : { ...box, h: box.h - height };
  return { svg: `<g class="ajc-legend">${svg}</g>`, plot };
}

// ---------------------------------------------------------------- entry point

export function renderChartSvg(model: ChartModel, width: number): string {
  const height = model.height;
  const W = Math.max(160, Math.round(model.maxWidth ? Math.min(width, model.maxWidth) : width));
  let box: Box = { x: 8, y: 8, w: W - 16, h: height - 16 };
  let head = '';
  if (model.title) {
    head = textEl(W / 2, 18, model.title, { anchor: 'middle', cls: 'ajc-title' });
    box = { ...box, y: box.y + 24, h: box.h - 24 };
  }
  let body: string;
  const hasData = model.series.some((series) => series.points.length);
  if (model.errors.length && !hasData) {
    body = textEl(W / 2, height / 2, model.errors[0]!, { anchor: 'middle', cls: 'ajc-message' });
  } else if (!hasData) {
    body = textEl(W / 2, height / 2, model.noDataFound, { anchor: 'middle', cls: 'ajc-message' });
  } else {
    switch (model.type) {
      case 'pie':
      case 'donut':
        body = pie(model, box);
        break;
      case 'funnel':
      case 'pyramid':
        body = funnel(model, box);
        break;
      case 'statusMeterGauge':
        body = gauges(model, box);
        break;
      case 'scatter':
      case 'bubble':
        body = scatter(model, box);
        break;
      case 'radar':
      case 'polar':
        body = radar(model, box);
        break;
      default:
        body = cartesian(model, box);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="ajc-svg" width="100%" height="${height}" viewBox="0 0 ${W} ${height}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="${esc(model.name)}" data-type="${esc(model.type)}">${head}${body}</svg>`;
}

// ---------------------------------------------------------------- bar / line / area / combination

type Scale = { min: number; max: number; step: number; log?: boolean };

const project = (scale: Scale, value: number, start: number, length: number) => {
  if (scale.log) {
    const lo = Math.log10(Math.max(scale.min, 1e-9));
    const hi = Math.log10(scale.max);
    return start + ((Math.log10(Math.max(value, 1e-9)) - lo) / (hi - lo || 1)) * length;
  }
  return start + ((value - scale.min) / (scale.max - scale.min || 1)) * length;
};

function valueScale(values: number[], axis: ChartAxis, includeZero: boolean): Scale {
  const finite = values.filter(Number.isFinite);
  const low = finite.length ? Math.min(...finite) : 0;
  const high = finite.length ? Math.max(...finite) : 1;
  if (axis.log && low > 0) {
    const min = axis.min ?? 10 ** Math.floor(Math.log10(low));
    const max = axis.max ?? 10 ** Math.ceil(Math.log10(high) + (high === low ? 1 : 0));
    return { min, max, step: 10, log: true };
  }
  if (!includeZero || !axis.baselineZero) {
    const pad = (high - low) * 0.05 || Math.abs(high) * 0.1 || 1;
    return niceScale(low - pad, high + pad, {
      min: axis.min ?? undefined,
      max: axis.max,
      step: axis.step,
      ticks: 5,
      includeZero: false,
    });
  }
  return niceScale(low, high, { min: axis.min, max: axis.max, step: axis.step, ticks: 5 });
}

function scaleTicks(scale: Scale): number[] {
  if (!scale.log) return ticks(scale);
  const values: number[] = [];
  for (let value = scale.min; value <= scale.max * 1.0001; value *= 10) values.push(value);
  return values;
}

const isBar = (series: ChartSeries) => series.type === 'bar' || series.type === 'barRange';
const isArea = (series: ChartSeries) =>
  series.type === 'area' || series.type === 'lineWithArea' || series.type === 'areaRange';

function cartesian(model: ChartModel, outer: Box): string {
  const groups = model.groups;
  const all = model.series;
  const horizontal = model.orientation === 'horizontal' && model.type !== 'line';
  const legendItems = all.map((series) => ({
    name: series.name,
    color: seriesColor(model, series),
    shape: isBar(series) || isArea(series) ? ('square' as const) : ('line' as const),
  }));
  const { svg: legendSvg, plot: area } = legend(model, legendItems, outer, false);

  // Stack totals per axis, stack category and sign.
  const stacked = new Map<string, number>();
  const stackKey = (series: ChartSeries, group: string, sign: number) =>
    `${series.y2 ? 'y2' : 'y'}|${isBar(series) ? 'bar' : 'area'}|${series.stackCategory}|${group}|${sign}`;
  const extents: Record<'y' | 'y2', number[]> = { y: [], y2: [] };
  const stackable = (series: ChartSeries) =>
    model.stack && (isBar(series) || isArea(series)) && !series.type.endsWith('Range');
  for (const series of all) {
    const bucket = extents[series.y2 ? 'y2' : 'y'];
    for (const point of series.points) {
      if (series.type.endsWith('Range')) {
        if (point.low !== undefined) bucket.push(point.low);
        if (point.high !== undefined) bucket.push(point.high);
        continue;
      }
      if (point.value === null) continue;
      if (stackable(series)) {
        const key = stackKey(series, point.group, point.value < 0 ? -1 : 1);
        const total = (stacked.get(key) ?? 0) + point.value;
        stacked.set(key, total);
        bucket.push(total);
      } else bucket.push(point.value);
      for (const line of series.referenceLines) bucket.push(line.value);
    }
  }
  const anyBar = all.some(isBar);
  const yScale = valueScale(extents.y, model.axes.y, anyBar || all.some(isArea) || true);
  const hasY2 = all.some((series) => series.y2);
  const y2Scale = hasY2 ? valueScale(extents.y2, model.axes.y2, true) : undefined;

  const yTicks = scaleTicks(yScale);
  const yLabels = yTicks.map((value) => formatTick(value, model.axes.y.format, yScale.step));
  const y2Ticks = y2Scale ? scaleTicks(y2Scale) : [];
  const y2Labels = y2Scale
    ? y2Ticks.map((value) => formatTick(value, model.axes.y2.format, y2Scale.step))
    : [];
  const groupLabels = groups.map((group) => groupLabel(model, group));
  const xAxis = model.axes.x;
  const yAxis = model.axes.y;

  // Margins.
  const valueLabelWidth = Math.max(...yLabels.map((label) => textWidth(label)), 10);
  const y2LabelWidth = y2Labels.length ? Math.max(...y2Labels.map((label) => textWidth(label))) : 0;
  let left: number;
  let right: number;
  let bottom: number;
  let rotate = false;
  let skip = 1;
  const top = 6;
  const maxGroupLabel = Math.max(...groupLabels.map((label) => textWidth(label)), 10);
  if (horizontal) {
    left = xAxis.show && xAxis.tickLabels ? Math.min(maxGroupLabel, area.w * 0.35) + 10 : 4;
    if (xAxis.title) left += 20;
    bottom = yAxis.show && yAxis.tickLabels ? 22 : 6;
    if (yAxis.title) bottom += 20;
    right = 12;
  } else {
    left = yAxis.show && yAxis.tickLabels ? valueLabelWidth + 10 : 4;
    if (yAxis.title) left += 20;
    right = y2Scale ? y2LabelWidth + 10 + (model.axes.y2.title ? 20 : 0) : 12;
    const band = (area.w - left - right) / Math.max(1, groups.length);
    bottom = 22;
    if (xAxis.show && xAxis.tickLabels && maxGroupLabel + 6 > band) {
      if (xAxis.rotate && band >= 14) {
        rotate = true;
        bottom = Math.min(maxGroupLabel, area.h * 0.3) * 0.72 + 16;
        // The first rotated label hangs to the left of its bar; keep it inside the chart.
        left = Math.max(left, Math.min(maxGroupLabel, area.h * 0.3) * 0.72 - band / 2 + 4);
      } else skip = Math.ceil((maxGroupLabel + 10) / Math.max(band, 1));
    }
    if (!xAxis.show || !xAxis.tickLabels) bottom = 6;
    if (xAxis.title) bottom += 20;
  }
  const plot: Box = {
    x: area.x + left,
    y: area.y + top,
    w: Math.max(20, area.w - left - right),
    h: Math.max(20, area.h - top - bottom),
  };
  const categoryLength = horizontal ? plot.h : plot.w;
  const band = categoryLength / Math.max(1, groups.length);
  const groupCenter = (index: number) =>
    horizontal ? plot.y + band * (index + 0.5) : plot.x + band * (index + 0.5);
  const valuePos = (scale: Scale, value: number) =>
    horizontal ? project(scale, value, plot.x, plot.w) : plot.y + plot.h - project(scale, value, 0, plot.h);

  const out: string[] = [];
  // Gridlines and value axis labels.
  if (yAxis.grid || yAxis.show) {
    yTicks.forEach((value, index) => {
      const pos = valuePos(yScale, value);
      if (yAxis.grid)
        out.push(
          horizontal
            ? `<line class="ajc-grid" x1="${fixed(pos)}" y1="${fixed(plot.y)}" x2="${fixed(pos)}" y2="${fixed(plot.y + plot.h)}"/>`
            : `<line class="ajc-grid" x1="${fixed(plot.x)}" y1="${fixed(pos)}" x2="${fixed(plot.x + plot.w)}" y2="${fixed(pos)}"/>`,
        );
      if (yAxis.show && yAxis.tickLabels)
        out.push(
          horizontal
            ? textEl(pos, plot.y + plot.h + 12, yLabels[index]!, { anchor: 'middle', cls: 'ajc-tick' })
            : textEl(plot.x - 6, pos, yLabels[index]!, { anchor: 'end', cls: 'ajc-tick' }),
        );
    });
  }
  if (y2Scale && model.axes.y2.show && !horizontal) {
    y2Ticks.forEach((value, index) => {
      out.push(textEl(plot.x + plot.w + 6, valuePos(y2Scale, value), y2Labels[index]!, { cls: 'ajc-tick' }));
    });
  }
  // Baseline at zero (or the axis minimum).
  const zero = valuePos(yScale, Math.min(Math.max(0, yScale.min), yScale.max));
  if (xAxis.show)
    out.push(
      horizontal
        ? `<line class="ajc-axis" x1="${fixed(zero)}" y1="${fixed(plot.y)}" x2="${fixed(zero)}" y2="${fixed(plot.y + plot.h)}"/>`
        : `<line class="ajc-axis" x1="${fixed(plot.x)}" y1="${fixed(zero)}" x2="${fixed(plot.x + plot.w)}" y2="${fixed(zero)}"/>`,
    );
  // Category labels.
  if (xAxis.show && xAxis.tickLabels) {
    groupLabels.forEach((label, index) => {
      if (index % skip) return;
      const center = groupCenter(index);
      if (horizontal)
        out.push(textEl(plot.x - 6, center, truncate(label, left - 10), { anchor: 'end', cls: 'ajc-tick' }));
      else if (rotate)
        out.push(
          textEl(center, plot.y + plot.h + 8, truncate(label, (bottom - 16) / 0.72), {
            anchor: 'end',
            cls: 'ajc-tick',
            rotate: -45,
            baseline: 'hanging',
          }),
        );
      else
        out.push(
          textEl(center, plot.y + plot.h + 12, truncate(label, band * skip - 4), {
            anchor: 'middle',
            cls: 'ajc-tick',
          }),
        );
    });
  }
  // Axis titles.
  if (xAxis.title) {
    out.push(
      horizontal
        ? textEl(area.x + 8, plot.y + plot.h / 2, xAxis.title, {
            anchor: 'middle',
            cls: 'ajc-axis-title',
            rotate: -90,
          })
        : textEl(plot.x + plot.w / 2, area.y + area.h - 8, xAxis.title, {
            anchor: 'middle',
            cls: 'ajc-axis-title',
          }),
    );
  }
  if (yAxis.title) {
    out.push(
      horizontal
        ? textEl(plot.x + plot.w / 2, area.y + area.h - 8, yAxis.title, {
            anchor: 'middle',
            cls: 'ajc-axis-title',
          })
        : textEl(area.x + 8, plot.y + plot.h / 2, yAxis.title, {
            anchor: 'middle',
            cls: 'ajc-axis-title',
            rotate: -90,
          }),
    );
  }
  if (y2Scale && model.axes.y2.title && !horizontal) {
    out.push(
      textEl(area.x + area.w - 8, plot.y + plot.h / 2, model.axes.y2.title, {
        anchor: 'middle',
        cls: 'ajc-axis-title',
        rotate: 90,
      }),
    );
  }

  // Bars.
  const barSeries = all.filter(isBar);
  const slots: string[] = [];
  for (const series of barSeries) {
    const slot = model.stack ? `${series.y2 ? 'y2' : 'y'}|${series.stackCategory}` : series.id;
    if (!slots.includes(slot)) slots.push(slot);
  }
  const groupWidth = band * (slots.length > 1 ? 0.75 : 0.6);
  const slotWidth = groupWidth / Math.max(1, slots.length);
  const barWidth = Math.max(1, slotWidth * (slots.length > 1 ? 0.92 : 1));
  const running = new Map<string, number>();
  const stackTotals = new Map<string, { value: number; pos: number; center: number }>();
  const labels: string[] = [];
  for (const series of barSeries) {
    const color = seriesColor(model, series);
    const scale = series.y2 && y2Scale ? y2Scale : yScale;
    const slot = slots.indexOf(model.stack ? `${series.y2 ? 'y2' : 'y'}|${series.stackCategory}` : series.id);
    const bars: string[] = [];
    for (const point of series.points) {
      const index = groups.indexOf(point.group);
      if (index < 0) continue;
      let from: number;
      let to: number;
      if (series.type === 'barRange') {
        if (point.low === undefined || point.high === undefined) continue;
        from = point.low;
        to = point.high;
      } else {
        if (point.value === null) continue;
        from = 0;
        to = point.value;
        if (stackable(series)) {
          const key = stackKey(series, point.group, point.value < 0 ? -1 : 1);
          from = running.get(key) ?? 0;
          to = from + point.value;
          running.set(key, to);
        }
      }
      const clampedFrom = Math.min(Math.max(from, scale.min), scale.max);
      const clampedTo = Math.min(Math.max(to, scale.min), scale.max);
      const a = valuePos(scale, clampedFrom);
      const b = valuePos(scale, clampedTo);
      const offset = groupCenter(index) - groupWidth / 2 + slotWidth * slot + (slotWidth - barWidth) / 2;
      const rect = horizontal
        ? { x: Math.min(a, b), y: offset, w: Math.max(Math.abs(b - a), 0.5), h: barWidth }
        : { x: offset, y: Math.min(a, b), w: barWidth, h: Math.max(Math.abs(b - a), 0.5) };
      const fill = point.color ?? color;
      const formatted =
        series.type === 'barRange'
          ? `${formatValue(from, model.value)} – ${formatValue(to, model.value)}`
          : formatValue(point.value, scale === y2Scale ? model.axes.y2.format : model.axes.y.format);
      bars.push(
        linked(
          `<rect class="ajc-bar" x="${fixed(rect.x)}" y="${fixed(rect.y)}" width="${fixed(rect.w)}" height="${fixed(rect.h)}" fill="${esc(fill)}"${tooltip(model, series, point, formatted)}/>`,
          point.link,
        ),
      );
      if (model.stack && model.stackLabel && series.type !== 'barRange') {
        const key = `${slot}|${index}|${to < 0 ? -1 : 1}`;
        stackTotals.set(key, {
          value: (stackTotals.get(key)?.value ?? 0) + (point.value ?? 0),
          pos: b,
          center: offset + barWidth / 2,
        });
      }
      if (series.label.show && series.label.position !== 'none') {
        const text = dataLabel(series, point, formatted, model);
        const inside = horizontal
          ? rect.w > textWidth(text, 11) + 8
          : rect.h > 16 && rect.w > textWidth(text, 11) * 0.6;
        const outsidePosition = series.label.position === 'outsideBarEdge' || !inside;
        const negative = to < from;
        if (horizontal) {
          const x = outsidePosition
            ? negative
              ? rect.x - 4
              : rect.x + rect.w + 4
            : series.label.position === 'insideBarEdge'
              ? negative
                ? rect.x + 4
                : rect.x + rect.w - 4
              : rect.x + rect.w / 2;
          const anchor = outsidePosition
            ? negative
              ? 'end'
              : 'start'
            : series.label.position === 'insideBarEdge'
              ? negative
                ? 'start'
                : 'end'
              : 'middle';
          labels.push(
            textEl(x, rect.y + rect.h / 2, text, {
              anchor,
              cls: 'ajc-value',
              size: 11,
              fill: outsidePosition ? undefined : contrast(fill),
            }),
          );
        } else {
          const y = outsidePosition
            ? negative
              ? rect.y + rect.h + 8
              : rect.y - 8
            : series.label.position === 'insideBarEdge'
              ? negative
                ? rect.y + rect.h - 9
                : rect.y + 9
              : rect.y + rect.h / 2;
          labels.push(
            textEl(rect.x + rect.w / 2, y, text, {
              anchor: 'middle',
              cls: 'ajc-value',
              size: 11,
              fill: outsidePosition ? undefined : contrast(fill),
            }),
          );
        }
      }
    }
    out.push(`<g class="ajc-series" data-series="${esc(series.name)}">${bars.join('')}</g>`);
  }
  for (const total of stackTotals.values()) {
    const text = formatValue(total.value, model.axes.y.format);
    labels.push(
      horizontal
        ? textEl(total.pos + 4, total.center, text, { cls: 'ajc-value ajc-stack-label', size: 11 })
        : textEl(total.center, total.pos - 8, text, {
            anchor: 'middle',
            cls: 'ajc-value ajc-stack-label',
            size: 11,
          }),
    );
  }

  // Areas first (underneath), then lines.
  const lineLike = all.filter((series) => !isBar(series));
  const areaBase = new Map<string, number>();
  const ordered = [...lineLike.filter(isArea), ...lineLike.filter((series) => !isArea(series))];
  for (const series of ordered) {
    const color = seriesColor(model, series);
    const scale = series.y2 && y2Scale ? y2Scale : yScale;
    const coordinates: ({ x: number; y: number; base: number; point: ChartPoint; value: number } | null)[] =
      groups.map(() => null);
    for (const point of series.points) {
      const index = groups.indexOf(point.group);
      if (index < 0) continue;
      let value = point.value;
      let base = series.type === 'areaRange' ? (point.low ?? 0) : Math.max(scale.min, Math.min(0, scale.max));
      if (series.type === 'areaRange') value = point.high ?? null;
      if (value === null) continue;
      if (stackable(series)) {
        const key = stackKey(series, point.group, value < 0 ? -1 : 1);
        base = areaBase.get(key) ?? 0;
        value = base + value;
        areaBase.set(key, value);
      }
      const center = groupCenter(index);
      const pos = valuePos(scale, Math.min(Math.max(value, scale.min), scale.max));
      const basePos = valuePos(scale, Math.min(Math.max(base, scale.min), scale.max));
      coordinates[index] = horizontal
        ? { x: pos, y: center, base: basePos, point, value }
        : { x: center, y: pos, base: basePos, point, value };
    }
    const segments: (typeof coordinates)[] = [[]];
    for (const coordinate of coordinates) {
      if (coordinate) segments.at(-1)!.push(coordinate);
      else if (segments.at(-1)!.length) segments.push([]);
    }
    const parts: string[] = [];
    for (const segment of segments) {
      const points = segment.filter((entry) => entry !== null);
      if (!points.length) continue;
      const path = linePath(
        points.map((entry) => [entry.x, entry.y]),
        series.line.type,
        horizontal,
      );
      if (isArea(series)) {
        const baseline = points
          .map((entry) => (horizontal ? [entry.base, entry.y] : [entry.x, entry.base]))
          .reverse();
        const close = linePath(baseline as [number, number][], series.line.type, horizontal).replace(
          /^M/u,
          'L',
        );
        parts.push(
          `<path class="ajc-area" d="${path} ${close} Z" fill="${esc(color)}" fill-opacity="${series.type === 'area' ? 0.85 : 0.2}"/>`,
        );
      }
      if (series.type !== 'area') {
        const dash =
          series.line.style === 'dashed'
            ? ' stroke-dasharray="8 5"'
            : series.line.style === 'dotted'
              ? ' stroke-dasharray="2 4"'
              : '';
        parts.push(
          `<path class="ajc-line" d="${path}" fill="none" stroke="${esc(color)}" stroke-width="${series.line.width}" stroke-linejoin="round" stroke-linecap="round"${dash}/>`,
        );
      }
    }
    const showMarkers =
      series.marker.show === 'true' || (series.marker.show === 'auto' && series.points.length <= 1);
    for (const entry of coordinates) {
      if (!entry) continue;
      const formatted = formatValue(
        entry.point.value,
        scale === y2Scale ? model.axes.y2.format : model.axes.y.format,
      );
      const markerFill = entry.point.color ?? color;
      const visible = showMarkers ? marker(series.marker.shape, entry.x, entry.y, 4.5, markerFill) : '';
      parts.push(
        linked(
          `<g class="ajc-point"${tooltip(model, series, entry.point, formatted)}>${visible}<circle class="ajc-hit" cx="${fixed(entry.x)}" cy="${fixed(entry.y)}" r="9" fill="transparent"/><circle class="ajc-hover" cx="${fixed(entry.x)}" cy="${fixed(entry.y)}" r="4.5" fill="${esc(markerFill)}"/></g>`,
          entry.point.link,
        ),
      );
      if (series.label.show && series.label.position !== 'none') {
        const text = dataLabel(series, entry.point, formatted, model);
        const below = series.label.position === 'belowMarker';
        labels.push(
          textEl(entry.x, entry.y + (below ? 14 : -12), text, {
            anchor: 'middle',
            cls: 'ajc-value',
            size: 11,
          }),
        );
      }
    }
    out.push(`<g class="ajc-series" data-series="${esc(series.name)}">${parts.join('')}</g>`);
  }

  // Reference lines.
  for (const series of all) {
    for (const line of series.referenceLines) {
      const pos = valuePos(series.y2 && y2Scale ? y2Scale : yScale, line.value);
      out.push(
        horizontal
          ? `<line class="ajc-reference" x1="${fixed(pos)}" y1="${fixed(plot.y)}" x2="${fixed(pos)}" y2="${fixed(plot.y + plot.h)}"${attr('stroke', line.color)}/>`
          : `<line class="ajc-reference" x1="${fixed(plot.x)}" y1="${fixed(pos)}" x2="${fixed(plot.x + plot.w)}" y2="${fixed(pos)}"${attr('stroke', line.color)}/>`,
      );
    }
  }
  return `<g class="ajc-plot">${out.join('')}</g><g class="ajc-labels">${labels.join('')}</g>${legendSvg}`;
}

function dataLabel(
  series: ChartSeries,
  point: ChartPoint,
  formatted: string,
  model: ChartModel,
  percent?: number,
) {
  const pct = percent === undefined ? '' : formatValue(percent, { format: 'percent', decimalPlaces: 0 });
  const label = groupLabel(model, point.group);
  switch (series.label.displayAs) {
    case 'label':
      return label;
    case 'percentage':
      return pct || formatted;
    case 'labelValue':
      return `${label}: ${formatted}`;
    case 'labelPercentage':
      return `${label}: ${pct || formatted}`;
    case 'labelPercentageValue':
      return `${label}: ${pct} (${formatted})`;
    case 'percentageValue':
      return pct ? `${pct} (${formatted})` : formatted;
    default:
      return formatted;
  }
}

function marker(shape: string, x: number, y: number, r: number, fill: string): string {
  const f = esc(fill);
  switch (shape) {
    case 'square':
      return `<rect class="ajc-marker" x="${fixed(x - r)}" y="${fixed(y - r)}" width="${fixed(r * 2)}" height="${fixed(r * 2)}" fill="${f}"/>`;
    case 'diamond':
      return `<path class="ajc-marker" d="M${fixed(x)} ${fixed(y - r * 1.3)}L${fixed(x + r * 1.3)} ${fixed(y)}L${fixed(x)} ${fixed(y + r * 1.3)}L${fixed(x - r * 1.3)} ${fixed(y)}Z" fill="${f}"/>`;
    case 'triangleUp':
      return `<path class="ajc-marker" d="M${fixed(x)} ${fixed(y - r * 1.2)}L${fixed(x + r * 1.2)} ${fixed(y + r)}L${fixed(x - r * 1.2)} ${fixed(y + r)}Z" fill="${f}"/>`;
    case 'triangleDown':
      return `<path class="ajc-marker" d="M${fixed(x)} ${fixed(y + r * 1.2)}L${fixed(x + r * 1.2)} ${fixed(y - r)}L${fixed(x - r * 1.2)} ${fixed(y - r)}Z" fill="${f}"/>`;
    case 'plus':
      return `<path class="ajc-marker" d="M${fixed(x - r)} ${fixed(y)}H${fixed(x + r)}M${fixed(x)} ${fixed(y - r)}V${fixed(y + r)}" stroke="${f}" stroke-width="2.5"/>`;
    default:
      return `<circle class="ajc-marker" cx="${fixed(x)}" cy="${fixed(y)}" r="${r}" fill="${f}"/>`;
  }
}

function linePath(points: [number, number][], type: string, horizontal: boolean): string {
  if (!points.length) return '';
  const [first] = points;
  let d = `M${fixed(first![0])} ${fixed(first![1])}`;
  if (points.length === 1) return `${d}h0.01`;
  for (let index = 1; index < points.length; index += 1) {
    const [x, y] = points[index]!;
    const [px, py] = points[index - 1]!;
    if (type === 'stepped') d += horizontal ? `V${fixed(y)}H${fixed(x)}` : `H${fixed(x)}V${fixed(y)}`;
    else if (type === 'centeredStepped') {
      if (horizontal) {
        const mid = (py + y) / 2;
        d += `V${fixed(mid)}H${fixed(x)}V${fixed(y)}`;
      } else {
        const mid = (px + x) / 2;
        d += `H${fixed(mid)}V${fixed(y)}H${fixed(x)}`;
      }
    } else if (type === 'curved') {
      const before = points[index - 2] ?? points[index - 1]!;
      const after = points[index + 1] ?? points[index]!;
      const c1x = px + (x - before[0]) / 6;
      const c1y = py + (y - before[1]) / 6;
      const c2x = x - (after[0] - px) / 6;
      const c2y = y - (after[1] - py) / 6;
      d += `C${fixed(c1x)} ${fixed(c1y)} ${fixed(c2x)} ${fixed(c2y)} ${fixed(x)} ${fixed(y)}`;
    } else d += `L${fixed(x)} ${fixed(y)}`;
  }
  return d;
}

// ---------------------------------------------------------------- pie / donut

const polar = (cx: number, cy: number, r: number, angle: number) => [
  cx + r * Math.cos(angle),
  cy + r * Math.sin(angle),
];

function arcPath(cx: number, cy: number, r: number, inner: number, start: number, end: number): string {
  if (end - start >= Math.PI * 2 - 1e-6) {
    const outerRing = `M${fixed(cx - r)} ${fixed(cy)}a${r} ${r} 0 1 0 ${fixed(r * 2)} 0a${r} ${r} 0 1 0 ${fixed(-r * 2)} 0`;
    return inner > 0
      ? `${outerRing}M${fixed(cx - inner)} ${fixed(cy)}a${inner} ${inner} 0 1 1 ${fixed(inner * 2)} 0a${inner} ${inner} 0 1 1 ${fixed(-inner * 2)} 0Z`
      : `${outerRing}Z`;
  }
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = polar(cx, cy, r, start);
  const [x2, y2] = polar(cx, cy, r, end);
  if (inner <= 0)
    return `M${fixed(cx)} ${fixed(cy)}L${fixed(x1!)} ${fixed(y1!)}A${r} ${r} 0 ${large} 1 ${fixed(x2!)} ${fixed(y2!)}Z`;
  const [x3, y3] = polar(cx, cy, inner, end);
  const [x4, y4] = polar(cx, cy, inner, start);
  return `M${fixed(x1!)} ${fixed(y1!)}A${r} ${r} 0 ${large} 1 ${fixed(x2!)} ${fixed(y2!)}L${fixed(x3!)} ${fixed(y3!)}A${inner} ${inner} 0 ${large} 0 ${fixed(x4!)} ${fixed(y4!)}Z`;
}

interface Slice {
  series: ChartSeries;
  point: ChartPoint;
  value: number;
  color: string;
  name: string;
}

function slices(model: ChartModel): Slice[] {
  // APEX maps each row of a pie series to a slice; multiple series contribute slices in order.
  const list: Slice[] = [];
  for (const series of model.series) {
    for (const point of series.points) {
      if (point.value === null || point.value <= 0) continue;
      const name = model.series.length > 1 && !point.group ? series.name : point.group;
      list.push({
        series,
        point,
        value: point.value,
        name,
        color: point.color ?? series.color ?? PALETTE[list.length % PALETTE.length]!,
      });
    }
  }
  const total = list.reduce((sum, slice) => sum + slice.value, 0);
  const threshold = model.value.otherThreshold;
  if (threshold > 0 && total > 0) {
    const small = list.filter((slice) => slice.value / total < threshold);
    if (small.length > 1) {
      const kept = list.filter((slice) => !small.includes(slice));
      const value = small.reduce((sum, slice) => sum + slice.value, 0);
      kept.push({
        series: small[0]!.series,
        point: { group: 'Other', value },
        value,
        name: 'Other',
        color: '#7b7570',
      });
      return kept;
    }
  }
  return list;
}

function pie(model: ChartModel, outer: Box): string {
  const list = slices(model);
  const total = list.reduce((sum, slice) => sum + slice.value, 0);
  const { svg: legendSvg, plot } = legend(
    model,
    list.map((slice) => ({ name: slice.name, color: slice.color, shape: 'square' as const })),
    outer,
    true,
  );
  if (!total)
    return textEl(outer.x + outer.w / 2, outer.y + outer.h / 2, model.noDataFound, {
      anchor: 'middle',
      cls: 'ajc-message',
    });
  const labelled = list.some((slice) => slice.series.label.show);
  const outside = list.some(
    (slice) => slice.series.label.show && ['outsideSlice', 'auto'].includes(slice.series.label.position),
  );
  const margin = outside ? 34 : 6;
  const cx = plot.x + plot.w / 2;
  const cy = plot.y + plot.h / 2;
  const r = Math.max(10, Math.min(plot.w / 2 - (outside ? 60 : margin), plot.h / 2 - margin));
  const inner = model.type === 'donut' ? r * 0.55 : 0;
  let angle = -Math.PI / 2;
  const paths: string[] = [];
  const labels: string[] = [];
  for (const slice of list) {
    const sweep = (slice.value / total) * Math.PI * 2;
    const formatted = formatValue(slice.value, model.value);
    const percent = slice.value / total;
    paths.push(
      linked(
        `<path class="ajc-slice" d="${arcPath(cx, cy, r, inner, angle, angle + sweep)}" fill="${esc(slice.color)}"${tooltip(model, slice.series, { ...slice.point, group: slice.name }, formatted, [`Percent\t${formatValue(percent, { format: 'percent', decimalPlaces: 1 })}`])}/>`,
        slice.point.link,
      ),
    );
    if (labelled && slice.series.label.show && slice.series.label.position !== 'none') {
      const text = dataLabel(slice.series, { ...slice.point, group: slice.name }, formatted, model, percent);
      const mid = angle + sweep / 2;
      const ring = r - inner;
      const fitsInside = sweep * (inner + ring / 2) > textWidth(text, 11) * 0.9 && ring > 18;
      const position = slice.series.label.position;
      if (
        position === 'center' ||
        (position === 'auto' && fitsInside) ||
        (position === 'inside' && fitsInside)
      ) {
        const [lx, ly] = polar(cx, cy, inner ? (r + inner) / 2 : r * 0.62, mid);
        labels.push(
          textEl(lx!, ly!, text, {
            anchor: 'middle',
            cls: 'ajc-value',
            size: 11,
            fill: contrast(slice.color),
          }),
        );
      } else {
        const [ax, ay] = polar(cx, cy, r, mid);
        const [bx, by] = polar(cx, cy, r + 14, mid);
        const rightSide = Math.cos(mid) >= 0;
        const ex = bx! + (rightSide ? 10 : -10);
        labels.push(
          `<path class="ajc-leader" d="M${fixed(ax!)} ${fixed(ay!)}L${fixed(bx!)} ${fixed(by!)}L${fixed(ex)} ${fixed(by!)}" fill="none"/>`,
          textEl(
            ex + (rightSide ? 3 : -3),
            by!,
            truncate(text, Math.max(40, (rightSide ? outer.x + outer.w - ex : ex - outer.x) - 6), 11),
            {
              anchor: rightSide ? 'start' : 'end',
              cls: 'ajc-value',
              size: 11,
            },
          ),
        );
      }
    }
    angle += sweep;
  }
  let center = '';
  if (inner > 24) {
    const value = formatValue(total, model.value);
    const size = Math.max(12, Math.min(28, (inner * 1.4) / Math.max(3, value.length * 0.6)));
    center = `<g class="ajc-center">${textEl(cx, cy - (inner > 40 ? 8 : 0), value, { anchor: 'middle', cls: 'ajc-center-value', size })}${inner > 40 ? textEl(cx, cy + size / 2 + 4, 'Total', { anchor: 'middle', cls: 'ajc-center-label', size: 12 }) : ''}</g>`;
  }
  return `<g class="ajc-plot ajc-pie">${paths.join('')}</g>${center}<g class="ajc-labels">${labels.join('')}</g>${legendSvg}`;
}

// ---------------------------------------------------------------- funnel / pyramid

function funnel(model: ChartModel, outer: Box): string {
  const list = slices(model);
  const { svg: legendSvg, plot } = legend(
    model,
    list.map((slice) => ({ name: slice.name, color: slice.color, shape: 'square' as const })),
    outer,
    true,
  );
  const total = list.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const pyramid = model.type === 'pyramid';
  const gap = 2;
  const usable = plot.h - gap * (list.length - 1);
  const minimum = Math.min(18, usable / Math.max(1, list.length));
  const heights = list.map((slice) => Math.max(minimum, (slice.value / total) * usable));
  const scale = usable / heights.reduce((sum, height) => sum + height, 0);
  const width = Math.min(plot.w, plot.h * (pyramid ? 1.15 : 1.6));
  const cx = plot.x + plot.w / 2;
  const half = (t: number) => (pyramid ? (width / 2) * t : (width / 2) * (1 - t * 0.72));
  let y = plot.y;
  const parts: string[] = [];
  list.forEach((slice, index) => {
    const height = heights[index]! * scale;
    const t0 = (y - plot.y) / plot.h;
    const t1 = (y + height - plot.y) / plot.h;
    const top = half(t0);
    const bottom = half(t1);
    const formatted = formatValue(slice.value, model.value);
    const d = `M${fixed(cx - top)} ${fixed(y)}L${fixed(cx + top)} ${fixed(y)}L${fixed(cx + bottom)} ${fixed(y + height)}L${fixed(cx - bottom)} ${fixed(y + height)}Z`;
    parts.push(
      linked(
        `<path class="ajc-slice" d="${d}" fill="${esc(slice.color)}"${tooltip(model, slice.series, { ...slice.point, group: slice.name }, formatted)}/>`,
        slice.point.link,
      ),
    );
    const text = slice.series.label.show
      ? dataLabel(slice.series, { ...slice.point, group: slice.name }, formatted, model, slice.value / total)
      : formatted;
    if (height >= 14 && Math.min(top, bottom) * 2 > textWidth(text, 11) + 8)
      parts.push(
        textEl(cx, y + height / 2, text, {
          anchor: 'middle',
          cls: 'ajc-value',
          size: 11,
          fill: contrast(slice.color),
        }),
      );
    y += height + gap;
  });
  return `<g class="ajc-plot ajc-funnel">${parts.join('')}</g>${legendSvg}`;
}

// ---------------------------------------------------------------- status meter gauge

function gauges(model: ChartModel, outer: Box): string {
  const entries = model.series
    .flatMap((series) => series.points.map((point) => ({ series, point })))
    .slice(0, 24);
  const orientation = model.gauge.orientation;
  const columns =
    orientation === 'horizontal'
      ? 1
      : Math.max(1, Math.min(entries.length, Math.floor(outer.w / (orientation === 'vertical' ? 90 : 180))));
  const rows = Math.ceil(entries.length / columns);
  const cellW = outer.w / columns;
  const cellH = orientation === 'horizontal' ? Math.min(64, outer.h / rows) : outer.h / rows;
  const parts: string[] = [];
  entries.forEach(({ series, point }, index) => {
    const cell: Box = {
      x: outer.x + (index % columns) * cellW,
      y: outer.y + Math.floor(index / columns) * cellH,
      w: cellW,
      h: cellH,
    };
    const min = point.min ?? 0;
    const max = point.max ?? (model.value.valueType === 'percent' ? 100 : Math.max(100, point.value ?? 0));
    const value = point.value ?? 0;
    const fraction = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
    const color = point.color ?? series.color ?? thresholdColor(series, value) ?? PALETTE[0]!;
    const shown =
      model.value.valueType === 'percent'
        ? formatValue(fraction, { format: 'percent', decimalPlaces: model.value.decimalPlaces ?? 0 })
        : formatValue(value, model.value);
    const tip = tooltip(model, series, point, shown, [
      `Range\t${formatValue(min, model.value)} – ${formatValue(max, model.value)}`,
    ]);
    const label = point.group || series.name;
    if (orientation === 'horizontal') {
      const barY = cell.y + 22;
      const barH = Math.min(18, cell.h - 30);
      const trackW = cell.w - 70;
      parts.push(
        textEl(cell.x + 4, cell.y + 10, truncate(label, trackW), { cls: 'ajc-tick' }),
        model.gauge.plotArea
          ? `<rect class="ajc-gauge-track" x="${fixed(cell.x + 4)}" y="${fixed(barY)}" width="${fixed(trackW)}" height="${fixed(barH)}" rx="${fixed(barH / 2)}"/>`
          : '',
        linked(
          `<rect class="ajc-gauge-value" x="${fixed(cell.x + 4)}" y="${fixed(barY)}" width="${fixed(Math.max(barH, trackW * fraction))}" height="${fixed(barH)}" rx="${fixed(barH / 2)}" fill="${esc(color)}"${tip}/>`,
          point.link,
        ),
        model.gauge.showValue
          ? textEl(cell.x + trackW + 12, barY + barH / 2, shown, { cls: 'ajc-gauge-text', size: 14 })
          : '',
      );
      return;
    }
    if (orientation === 'vertical') {
      const barW = Math.min(28, cell.w * 0.35);
      const trackH = cell.h - 44;
      const x = cell.x + cell.w / 2 - barW / 2;
      const filled = Math.max(barW, trackH * fraction);
      parts.push(
        model.gauge.plotArea
          ? `<rect class="ajc-gauge-track" x="${fixed(x)}" y="${fixed(cell.y + 4)}" width="${fixed(barW)}" height="${fixed(trackH)}" rx="${fixed(barW / 2)}"/>`
          : '',
        linked(
          `<rect class="ajc-gauge-value" x="${fixed(x)}" y="${fixed(cell.y + 4 + trackH - filled)}" width="${fixed(barW)}" height="${fixed(filled)}" rx="${fixed(barW / 2)}" fill="${esc(color)}"${tip}/>`,
          point.link,
        ),
        model.gauge.showValue
          ? textEl(cell.x + cell.w / 2, cell.y + trackH + 18, shown, {
              anchor: 'middle',
              cls: 'ajc-gauge-text',
              size: 14,
            })
          : '',
        textEl(cell.x + cell.w / 2, cell.y + trackH + 34, truncate(label, cell.w - 8), {
          anchor: 'middle',
          cls: 'ajc-tick',
        }),
      );
      return;
    }
    const extent = Math.max(1, Math.min(360, model.gauge.angleExtent));
    const start = (-model.gauge.startAngle * Math.PI) / 180;
    const sweep = (extent * Math.PI) / 180;
    const partial = extent < 360;
    const available = cell.h - 22;
    const r = Math.max(
      12,
      Math.min(cell.w / 2 - 6, partial && extent <= 180 ? available * 0.9 : available / 2 - 4),
    );
    const cx = cell.x + cell.w / 2;
    const cy = partial && extent <= 180 ? cell.y + 6 + r : cell.y + 4 + r;
    const inner = r * Math.max(0, Math.min(0.95, model.gauge.innerRadius));
    if (model.gauge.plotArea)
      parts.push(`<path class="ajc-gauge-track" d="${arcPath(cx, cy, r, inner, start, start + sweep)}"/>`);
    if (fraction > 0)
      parts.push(
        linked(
          `<path class="ajc-gauge-value" d="${arcPath(cx, cy, r, inner, start, start + sweep * fraction)}" fill="${esc(color)}"${tip}/>`,
          point.link,
        ),
      );
    else parts.push(`<circle cx="${fixed(cx)}" cy="${fixed(cy)}" r="${fixed(r)}" fill="transparent"${tip}/>`);
    for (const line of series.referenceLines) {
      const t = Math.max(0, Math.min(1, (line.value - min) / (max - min || 1)));
      const [x1, y1] = polar(cx, cy, inner - 2, start + sweep * t);
      const [x2, y2] = polar(cx, cy, r + 3, start + sweep * t);
      parts.push(
        `<line class="ajc-reference" x1="${fixed(x1!)}" y1="${fixed(y1!)}" x2="${fixed(x2!)}" y2="${fixed(y2!)}"${attr('stroke', line.color)}/>`,
      );
    }
    if (model.gauge.showValue)
      parts.push(
        textEl(cx, partial && extent <= 180 ? cy - inner * 0.3 : cy, shown, {
          anchor: 'middle',
          cls: 'ajc-gauge-text',
          size: Math.max(12, Math.min(28, inner * 0.45)),
        }),
      );
    parts.push(
      textEl(
        cx,
        Math.min(cell.y + cell.h - 8, cy + (partial && extent <= 180 ? 16 : r + 14)),
        truncate(label, cell.w - 8),
        {
          anchor: 'middle',
          cls: 'ajc-tick',
        },
      ),
    );
  });
  return `<g class="ajc-plot ajc-gauge">${parts.join('')}</g>`;
}

/** APEX thresholds: reference line colors double as value thresholds when the series has no color. */
function thresholdColor(series: ChartSeries, value: number): string | undefined {
  const sorted = [...series.referenceLines].filter((line) => line.color).sort((a, b) => a.value - b.value);
  return sorted.find((line) => value <= line.value)?.color;
}

// ---------------------------------------------------------------- scatter / bubble

function scatter(model: ChartModel, outer: Box): string {
  const items = model.series.map((series) => ({
    name: series.name,
    color: seriesColor(model, series),
    shape: 'circle' as const,
  }));
  const { svg: legendSvg, plot: area } = legend(model, items, outer, false);
  const points = model.series.flatMap((series) =>
    series.points.map((point) => ({
      series,
      point,
      x: point.x ?? (Number.isFinite(Number(point.group)) ? Number(point.group) : undefined),
      y: point.y ?? point.value ?? undefined,
      z: point.z,
    })),
  );
  const valid = points.filter((entry) => entry.x !== undefined && entry.y !== undefined);
  const xScale = valueScale(
    valid.map((entry) => entry.x!),
    model.axes.x,
    false,
  );
  const yScale = valueScale(
    valid.map((entry) => entry.y!),
    model.axes.y,
    false,
  );
  const xTicks = scaleTicks(xScale);
  const yTicks = scaleTicks(yScale);
  const yLabels = yTicks.map((value) => formatTick(value, model.axes.y.format, yScale.step));
  const left = Math.max(...yLabels.map((label) => textWidth(label))) + 10 + (model.axes.y.title ? 20 : 0);
  const bottom = 22 + (model.axes.x.title ? 20 : 0);
  const plot: Box = { x: area.x + left, y: area.y + 8, w: area.w - left - 12, h: area.h - bottom - 8 };
  const px = (value: number) => project(xScale, value, plot.x, plot.w);
  const py = (value: number) => plot.y + plot.h - project(yScale, value, 0, plot.h);
  const out: string[] = [];
  yTicks.forEach((value, index) => {
    out.push(
      `<line class="ajc-grid" x1="${fixed(plot.x)}" y1="${fixed(py(value))}" x2="${fixed(plot.x + plot.w)}" y2="${fixed(py(value))}"/>`,
      textEl(plot.x - 6, py(value), yLabels[index]!, { anchor: 'end', cls: 'ajc-tick' }),
    );
  });
  xTicks.forEach((value) => {
    out.push(
      `<line class="ajc-grid" x1="${fixed(px(value))}" y1="${fixed(plot.y)}" x2="${fixed(px(value))}" y2="${fixed(plot.y + plot.h)}"/>`,
      textEl(px(value), plot.y + plot.h + 12, formatTick(value, model.axes.x.format, xScale.step), {
        anchor: 'middle',
        cls: 'ajc-tick',
      }),
    );
  });
  out.push(
    `<line class="ajc-axis" x1="${fixed(plot.x)}" y1="${fixed(plot.y + plot.h)}" x2="${fixed(plot.x + plot.w)}" y2="${fixed(plot.y + plot.h)}"/>`,
  );
  if (model.axes.x.title)
    out.push(
      textEl(plot.x + plot.w / 2, area.y + area.h - 8, model.axes.x.title, {
        anchor: 'middle',
        cls: 'ajc-axis-title',
      }),
    );
  if (model.axes.y.title)
    out.push(
      textEl(area.x + 8, plot.y + plot.h / 2, model.axes.y.title, {
        anchor: 'middle',
        cls: 'ajc-axis-title',
        rotate: -90,
      }),
    );
  const bubble = model.type === 'bubble';
  const zMax = Math.max(...valid.map((entry) => Math.abs(entry.z ?? 0)), 1);
  const rMax = Math.max(8, Math.min(plot.w, plot.h) * 0.09);
  const marks = valid
    .map(({ series, point, x, y, z }) => {
      const color = point.color ?? seriesColor(model, series);
      const r = bubble ? Math.max(3, Math.sqrt(Math.abs(z ?? 0) / zMax) * rMax) : 5;
      const formatted = `${formatValue(x!, model.axes.x.format)}, ${formatValue(y!, model.axes.y.format)}`;
      const extra = bubble && z !== undefined ? [`Z\t${formatValue(z, model.value)}`] : [];
      const label =
        series.label.show && series.label.position !== 'none'
          ? textEl(px(x!), py(y!) - r - 7, dataLabel(series, point, formatted, model), {
              anchor: 'middle',
              cls: 'ajc-value',
              size: 11,
            })
          : '';
      return (
        linked(
          `<circle class="ajc-bubble" cx="${fixed(px(x!))}" cy="${fixed(py(y!))}" r="${fixed(r)}" fill="${esc(color)}" fill-opacity="${bubble ? 0.7 : 1}"${tooltip(model, series, point, formatted, extra)}/>`,
          point.link,
        ) + label
      );
    })
    .join('');
  return `<g class="ajc-plot">${out.join('')}<g class="ajc-series">${marks}</g></g>${legendSvg}`;
}

// ---------------------------------------------------------------- radar / polar

function radar(model: ChartModel, outer: Box): string {
  const items = model.series.map((series) => ({
    name: series.name,
    color: seriesColor(model, series),
    shape: isArea(series) || isBar(series) ? ('square' as const) : ('line' as const),
  }));
  const { svg: legendSvg, plot } = legend(model, items, outer, true);
  const groups = model.groups;
  const n = Math.max(1, groups.length);
  const labelSpace = Math.min(90, Math.max(...groups.map((group) => textWidth(group)), 20) + 8);
  const r = Math.max(20, Math.min(plot.w / 2 - labelSpace, plot.h / 2 - 22));
  const cx = plot.x + plot.w / 2;
  const cy = plot.y + plot.h / 2;
  const values = model.series.flatMap((series) => series.points.map((point) => point.value ?? 0));
  const scale = niceScale(Math.min(0, ...values), Math.max(...values, 1), {
    min: model.axes.y.min,
    max: model.axes.y.max,
    step: model.axes.y.step,
    ticks: 4,
  });
  const angle = (index: number) => -Math.PI / 2 + (index / n) * Math.PI * 2;
  const radius = (value: number) => ((value - scale.min) / (scale.max - scale.min || 1)) * r;
  const out: string[] = [];
  const circular = model.type === 'polar';
  for (const tick of ticks(scale).slice(1)) {
    const tr = radius(tick);
    out.push(
      circular || n < 3
        ? `<circle class="ajc-grid" cx="${fixed(cx)}" cy="${fixed(cy)}" r="${fixed(tr)}" fill="none"/>`
        : `<polygon class="ajc-grid" fill="none" points="${groups
            .map((_, index) => polar(cx, cy, tr, angle(index)).map(fixed).join(','))
            .join(' ')}"/>`,
      textEl(cx + 3, cy - tr, formatTick(tick, model.axes.y.format, scale.step), {
        cls: 'ajc-tick',
        size: 10,
      }),
    );
  }
  groups.forEach((group, index) => {
    const [x, y] = polar(cx, cy, r, angle(index));
    const [lx, ly] = polar(cx, cy, r + 12, angle(index));
    const cos = Math.cos(angle(index));
    out.push(
      `<line class="ajc-grid" x1="${fixed(cx)}" y1="${fixed(cy)}" x2="${fixed(x!)}" y2="${fixed(y!)}"/>`,
      textEl(lx!, ly!, truncate(groupLabel(model, group), labelSpace - 8), {
        anchor: Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end',
        cls: 'ajc-tick',
      }),
    );
  });
  for (const series of model.series) {
    const color = seriesColor(model, series);
    const coordinates = groups.map((group, index) => {
      const point = series.points.find((entry) => entry.group === group);
      const value = point?.value ?? scale.min;
      const [x, y] = polar(cx, cy, radius(Math.max(scale.min, value)), angle(index));
      return { x: x!, y: y!, point, value };
    });
    if (isBar(series)) {
      const width = ((Math.PI * 2) / n) * 0.7;
      out.push(
        coordinates
          .map((entry, index) =>
            entry.point
              ? linked(
                  `<path class="ajc-slice" d="${arcPath(cx, cy, Math.max(0.5, radius(entry.value)), 0, angle(index) - width / 2, angle(index) + width / 2)}" fill="${esc(entry.point.color ?? color)}" fill-opacity="0.85"${tooltip(model, series, entry.point, formatValue(entry.point.value, model.axes.y.format))}/>`,
                  entry.point.link,
                )
              : '',
          )
          .join(''),
      );
      continue;
    }
    const pointsAttr = coordinates.map((entry) => `${fixed(entry.x)},${fixed(entry.y)}`).join(' ');
    out.push(
      `<polygon class="ajc-line" points="${pointsAttr}" fill="${isArea(series) ? esc(color) : 'none'}" fill-opacity="${series.type === 'area' ? 0.5 : 0.2}" stroke="${esc(color)}" stroke-width="${series.line.width}" stroke-linejoin="round"/>`,
    );
    for (const entry of coordinates) {
      if (!entry.point) continue;
      out.push(
        linked(
          `<g class="ajc-point"${tooltip(model, series, entry.point, formatValue(entry.point.value, model.axes.y.format))}><circle class="ajc-hit" cx="${fixed(entry.x)}" cy="${fixed(entry.y)}" r="9" fill="transparent"/><circle class="ajc-hover" cx="${fixed(entry.x)}" cy="${fixed(entry.y)}" r="4" fill="${esc(color)}"/></g>`,
          entry.point.link,
        ),
      );
    }
  }
  return `<g class="ajc-plot ajc-radar">${out.join('')}</g>${legendSvg}`;
}
