import {
  bool,
  get,
  isObject,
  num,
  str,
  type ApxComponent,
  type ApxObject,
  type ApxValue,
} from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { isDateFormat, parseDate, type ValueFormat } from './format.ts';

/** One data item after `columnMapping` is applied. */
export interface ChartPoint {
  group: string;
  value: number | null;
  x?: number | undefined;
  y?: number | undefined;
  z?: number | undefined;
  low?: number | undefined;
  high?: number | undefined;
  target?: number | undefined;
  min?: number | undefined;
  max?: number | undefined;
  color?: string | undefined;
  link?: string | undefined;
  tooltip?: string | undefined;
}

export interface ChartSeries {
  id: string;
  name: string;
  type: string;
  color?: string | undefined;
  y2: boolean;
  stackCategory: string;
  points: ChartPoint[];
  label: { show: boolean; position: string; displayAs: string };
  line: { style: string; type: string; width: number };
  marker: { show: string; shape: string };
  referenceLines: { value: number; color?: string | undefined }[];
}

export interface ChartAxis {
  title: string;
  show: boolean;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  format: ValueFormat;
  baselineZero: boolean;
  grid: boolean;
  tickLabels: boolean;
  rotate: boolean;
  position: string;
  log: boolean;
}

export interface ChartModel {
  id: string;
  name: string;
  type: string;
  orientation: 'vertical' | 'horizontal';
  stack: boolean;
  stackLabel: boolean;
  height: number;
  maxWidth?: number | undefined;
  title: string;
  legend: { show: boolean; position: string; title: string };
  tooltip: { show: boolean; series: boolean; group: boolean; value: boolean };
  value: ValueFormat & { otherThreshold: number; valueType: string };
  gauge: {
    orientation: string;
    startAngle: number;
    angleExtent: number;
    innerRadius: number;
    plotArea: boolean;
    showValue: boolean;
  };
  timeAxis: boolean;
  groups: string[];
  series: ChartSeries[];
  axes: { x: ChartAxis; y: ChartAxis; y2: ChartAxis };
  errors: string[];
  noDataFound: string;
}

/** Region and child properties this renderer understands; anything else is reported once. */
const SUPPORTED_REGION = new Set([
  'chart.type',
  'chartAppearance.orientation',
  'chartAppearance.stack',
  'chartAppearance.stackLabel',
  'chartLayout.height',
  'chartLayout.maxWidth',
  'legend.show',
  'legend.position',
  'legend.title',
  'tooltip.show',
  'tooltip.showSeriesName',
  'tooltip.showGroupName',
  'tooltip.showValue',
  'value.format',
  'value.decimalPlaces',
  'value.currency',
  'value.formatScaling',
  'value.pieChartOtherThreshold',
  'value.valueType',
  'value.show',
  'value.position',
  'gauge.orientation',
  'gauge.startAngle',
  'gauge.angleExtent',
  'gauge.innerRadius',
  'gauge.showPlotArea',
  'gauge.indicatorSize',
  'settings.timeAxisType',
  'settings.initialZooming',
  'settings.zoomAndScroll',
  'settings.pieSelectionEffect',
  'settings.renderAs',
  'title.title',
  'performance.lazyLoading',
  'animation.onDisplay',
  'animation.onDataChange',
  'dataCursor.cursor',
  'dataCursor.behavior',
  'dataCursor.dimOnHover',
  'messages.noDataFound',
  'security.escapeSpecialChars',
]);

const CHART_GROUPS = [
  'chart',
  'chartAppearance',
  'chartLayout',
  'legend',
  'tooltip',
  'value',
  'gauge',
  'settings',
  'title',
  'animation',
  'dataCursor',
  'overview',
  'multiSeriesChartData',
  'componentAdvanced',
  'autoRefresh',
];

const SUPPORTED_SERIES = new Set([
  'name',
  'type',
  'execution.sequence',
  'appearance.color',
  'appearance.assignedToY2Axis',
  'appearance.stackCategory',
  'label.show',
  'label.position',
  'label.displayAs',
  'line.style',
  'line.type',
  'line.width',
  'marker.show',
  'marker.shape',
  'link.type',
  'link.target',
  'link.targetUrl',
  'performance.maxRowsToProcess',
  'referenceLines.values',
  'referenceLines.colors',
]);

const SERIES_GROUPS = [
  'appearance',
  'label',
  'line',
  'marker',
  'link',
  'referenceLines',
  'thresholds',
  'timeline',
];

const SUPPORTED_AXIS = new Set([
  'name',
  'title',
  'showAxis',
  'value.min',
  'value.max',
  'value.step',
  'value.format',
  'value.decimalPlaces',
  'value.currency',
  'value.formatScaling',
  'value.baselineScaling',
  'value.scale',
  'majorTicks.show',
  'minorTicks.show',
  'tickLabel.show',
  'tickLabel.rotation',
  'appearance.position',
  'advanced.staticId',
]);

function leafPaths(props: ApxObject, prefix = ''): string[] {
  return Object.entries(props).flatMap(([key, value]) =>
    isObject(value) && key !== 'target' ? leafPaths(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

function reportUnsupported(
  renderer: ApexRenderer,
  ctx: RenderContext,
  owner: ApxComponent,
  component: ApxComponent,
  groups: string[],
  supported: Set<string>,
  label: string,
) {
  const ignored = leafPaths(component.props).filter(
    (path) =>
      (groups.includes(path.split('.')[0]!) || !path.includes('.')) &&
      !supported.has(path) &&
      !/(^|\.)(font\w*|cssStyling)$/u.test(path),
  );
  const own = ignored.filter((path) => path.includes('.') || label !== 'Chart');
  if (own.length)
    renderer.diagnose(
      'info',
      `${label} ${component.id} of chart ${owner.id}: ${own.join(', ')} not simulated by the local SVG chart`,
      ctx.pageId,
      owner.id,
    );
}

const numberOf = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/,/gu, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const optionalNumber = (value: unknown) => numberOf(value) ?? undefined;

/** Replaces `&COLUMN.` with values of the current row (series color, custom tooltips). */
export function rowSubstitute(value: string, row: Row): string {
  return value.replace(/&([A-Za-z][\w$#]*)\./gu, (whole, name: string) => {
    const key = name.toUpperCase();
    return key in row ? String(row[key] ?? '') : whole;
  });
}

function axisModel(component: ApxComponent | undefined, fallback: ValueFormat): ChartAxis {
  const props = component?.props ?? {};
  const major = str(props, 'majorTicks.show', 'auto');
  return {
    title: str(props, 'title'),
    show: bool(props, 'showAxis', true),
    min: optionalNumber(str(props, 'value.min')),
    max: optionalNumber(str(props, 'value.max')),
    step: optionalNumber(str(props, 'value.step')),
    format: {
      format: str(props, 'value.format') || fallback.format,
      decimalPlaces: optionalNumber(str(props, 'value.decimalPlaces')) ?? fallback.decimalPlaces,
      currency: str(props, 'value.currency') || fallback.currency,
      scaling: str(props, 'value.formatScaling') || undefined,
    },
    baselineZero: str(props, 'value.baselineScaling', 'zero') !== 'min',
    grid: major !== 'false',
    tickLabels: bool(props, 'tickLabel.show', true),
    rotate: bool(props, 'tickLabel.rotation', true),
    position: str(props, 'appearance.position', 'auto'),
    log: str(props, 'value.scale') === 'log',
  };
}

function seriesSql(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent, series: ApxComponent) {
  const location = str(series.props, 'source.location');
  if (location === 'regionSource' || (!isObject(series.props.source) && isObject(region.props.source)))
    return renderer.regionSql(ctx, region);
  return renderer.regionSql(ctx, series);
}

export function chartModel(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): ChartModel {
  const props = region.props;
  const type = str(props, 'chart.type', 'bar');
  const value: ChartModel['value'] = {
    format: str(props, 'value.format') || undefined,
    decimalPlaces: optionalNumber(str(props, 'value.decimalPlaces')),
    currency: str(props, 'value.currency') || undefined,
    scaling: str(props, 'value.formatScaling') || undefined,
    otherThreshold: num(props, 'value.pieChartOtherThreshold', 0),
    valueType: str(props, 'value.valueType', 'number'),
  };
  const axes = region.children.filter((child) => child.type === 'axis');
  const axis = (name: string) => axes.find((entry) => str(entry.props, 'name', entry.id) === name);
  const timeAxisType = str(props, 'settings.timeAxisType', 'auto');
  const model: ChartModel = {
    id: region.id,
    name: str(props, 'name', region.id),
    type,
    orientation: str(props, 'chartAppearance.orientation') === 'horizontal' ? 'horizontal' : 'vertical',
    stack: bool(props, 'chartAppearance.stack', false),
    stackLabel: bool(props, 'chartAppearance.stackLabel', false),
    height: num(props, 'chartLayout.height', 0) || heightOption(props) || 400,
    maxWidth: num(props, 'chartLayout.maxWidth', 0) || undefined,
    title: str(props, 'title.title'),
    legend: {
      show: bool(props, 'legend.show', true),
      position: str(props, 'legend.position', 'auto'),
      title: str(props, 'legend.title'),
    },
    tooltip: {
      show: bool(props, 'tooltip.show', true),
      series: bool(props, 'tooltip.showSeriesName', true),
      group: bool(props, 'tooltip.showGroupName', true),
      value: bool(props, 'tooltip.showValue', true),
    },
    value,
    gauge: {
      orientation: str(props, 'gauge.orientation', 'circular'),
      startAngle: num(props, 'gauge.startAngle', 90),
      angleExtent: num(props, 'gauge.angleExtent', 360),
      innerRadius: num(props, 'gauge.innerRadius', 0.7),
      plotArea: bool(props, 'gauge.showPlotArea', true),
      showValue: bool(props, 'value.show', true),
    },
    timeAxis: timeAxisType === 'enabled' || timeAxisType === 'mixedFrequency' || timeAxisType === 'skipGaps',
    groups: [],
    series: [],
    axes: {
      x: axisModel(axis('x'), {}),
      y: axisModel(axis('y'), value),
      y2: axisModel(axis('y2'), value),
    },
    errors: [],
    noDataFound: str(props, 'messages.noDataFound', 'No data found.'),
  };

  const definitions = region.children
    .filter((child) => child.type === 'series')
    .sort((a, b) => num(a.props, 'execution.sequence', 0) - num(b.props, 'execution.sequence', 0));
  reportUnsupported(renderer, ctx, region, region, CHART_GROUPS, SUPPORTED_REGION, 'Chart');
  for (const entry of axes)
    reportUnsupported(renderer, ctx, region, entry, Object.keys(entry.props), SUPPORTED_AXIS, 'Axis');
  const groups = new Map<string, true>();
  for (const definition of definitions) {
    if (!renderer.condition(ctx, definition.props)) continue;
    reportUnsupported(renderer, ctx, region, definition, SERIES_GROUPS, SUPPORTED_SERIES, 'Series');
    const sql = seriesSql(renderer, ctx, region, definition);
    if (!sql) {
      model.errors.push(`Series ${str(definition.props, 'name', definition.id)} has no SQL source.`);
      continue;
    }
    const result = renderer.query(
      ctx,
      region,
      sql,
      num(definition.props, 'performance.maxRowsToProcess', 0) || 10_000,
    );
    if (result.error) {
      model.errors.push(result.error);
      continue;
    }
    const mapping = (key: string, fallback = '') =>
      (str(definition.props, `columnMapping.${key}`) || fallback).toUpperCase();
    const labelColumn = mapping('label', result.columns[0]);
    const valueColumn = mapping(
      'value',
      result.columns.find((column) => column !== labelColumn) ?? result.columns[1] ?? '',
    );
    const seriesColumn = mapping('seriesName');
    const colorSpec = str(definition.props, 'appearance.color');
    const customTooltip = mapping('customTooltip');
    const link = linkResolver(renderer, ctx, definition);
    const base = {
      type:
        str(definition.props, 'type') ||
        (type === 'combination' ? 'bar' : type === 'radar' || type === 'polar' ? 'line' : type),
      y2: bool(definition.props, 'appearance.assignedToY2Axis', false),
      stackCategory: str(definition.props, 'appearance.stackCategory'),
      label: {
        show: bool(definition.props, 'label.show', false),
        position: str(definition.props, 'label.position', 'auto'),
        displayAs: str(
          definition.props,
          'label.displayAs',
          type === 'pie' || type === 'donut' ? 'percentage' : 'value',
        ),
      },
      line: {
        style: str(definition.props, 'line.style', 'solid'),
        type: str(definition.props, 'line.type', 'auto'),
        width: num(definition.props, 'line.width', 0) || (type === 'radar' ? 2 : 3),
      },
      marker: {
        show: str(definition.props, 'marker.show', 'auto'),
        shape: str(definition.props, 'marker.shape', 'auto'),
      },
      referenceLines: referenceLines(definition),
    };
    const bySeries = new Map<string, ChartSeries>();
    const fixedName = str(definition.props, 'name', definition.id);
    for (const row of result.rows) {
      const name = seriesColumn ? String(row[seriesColumn] ?? '') : fixedName;
      let series = bySeries.get(name);
      if (!series) {
        series = { ...base, id: `${definition.id}-${bySeries.size}`, name, points: [] };
        if (colorSpec && !colorSpec.includes('&')) series.color = colorSpec;
        bySeries.set(name, series);
      }
      const group = labelText(row[labelColumn], model);
      groups.set(group, true);
      series.points.push({
        group,
        value: numberOf(row[valueColumn]),
        x: optionalNumber(row[mapping('x')]),
        y: optionalNumber(row[mapping('y')]),
        z: optionalNumber(row[mapping('z')]),
        low: optionalNumber(row[mapping('low')]),
        high: optionalNumber(row[mapping('high')] ?? row[mapping('close')]),
        target: optionalNumber(row[mapping('targetValue')]),
        min: optionalNumber(row[mapping('minValue')]),
        max: optionalNumber(row[mapping('maxValue')]),
        color: colorSpec.includes('&') ? rowSubstitute(colorSpec, row) || undefined : undefined,
        link: link(row),
        tooltip: customTooltip ? String(row[customTooltip] ?? '') : undefined,
      });
    }
    if (type === 'stock') {
      for (const series of bySeries.values()) {
        const close = mapping('close');
        series.type = 'line';
        series.points.forEach((point, index) => {
          point.value = numberOf(result.rows[index]?.[close]) ?? point.value;
        });
      }
    }
    model.series.push(...bySeries.values());
  }
  model.groups = [...groups.keys()];
  if (model.timeAxis || isDateFormat(model.axes.x.format.format)) {
    const dated = model.groups.map((group) => [group, parseDate(group)] as const);
    if (dated.every(([, date]) => date)) {
      dated.sort((a, b) => a[1]!.getTime() - b[1]!.getTime());
      model.groups = dated.map(([group]) => group);
      model.timeAxis = true;
    }
  }
  return model;
}

function heightOption(props: ApxObject): number {
  const options = get(props, 'appearance.templateOptions');
  const values = Array.isArray(options) ? options.map(String) : typeof options === 'string' ? [options] : [];
  for (const option of values) {
    const match = /\bi-h(\d{3})\b/u.exec(option);
    if (match) return Number(match[1]) - 32;
  }
  return 0;
}

function labelText(value: unknown, model: ChartModel): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  const text = String(value);
  if (model.timeAxis && /^\d{4}-\d{2}-\d{2}$/u.test(text)) return `${text} 00:00:00`;
  return text;
}

function referenceLines(series: ApxComponent) {
  const values = str(series.props, 'referenceLines.values')
    .split(/[,:]/u)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
  const colors = str(series.props, 'referenceLines.colors').split(/[,:]/u);
  return values.map((value, index) => ({ value, color: colors[index]?.trim() || undefined }));
}

function linkResolver(renderer: ApexRenderer, ctx: RenderContext, series: ApxComponent) {
  const type = str(series.props, 'link.type');
  const target = get(series.props, 'link.target');
  const targetUrl = str(series.props, 'link.targetUrl');
  if (!type && target === undefined && !targetUrl) return () => undefined;
  return (row: Row): string | undefined => {
    if (type === 'redirectUrlReturnedByFirstCol') {
      const first = Object.values(row)[0];
      return first === null || first === undefined ? undefined : String(first);
    }
    if (type === 'redirectUrl' || (targetUrl && target === undefined))
      return renderer.link(ctx, { type: 'url', url: rowSubstitute(targetUrl, row) }, row);
    return target === undefined ? undefined : renderer.link(ctx, substituteDeep(target, row), row);
  };
}

/** Chart links reference row values as `&COLUMN.`; resolve them before session substitution. */
export function substituteDeep(value: ApxValue, row: Row): ApxValue {
  if (typeof value === 'string') return rowSubstitute(value, row);
  if (Array.isArray(value)) return value.map((entry) => substituteDeep(entry, row));
  if (isObject(value))
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, substituteDeep(entry, row)]));
  return value;
}
