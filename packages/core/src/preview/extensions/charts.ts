import { str, type ApxComponent } from '../apexlang.ts';
import { registerExtension, type RouteResponse } from '../extensions.ts';
import type { ApexRenderer, RenderContext, Session } from '../render.ts';
import { escapeHtml } from '../theme.ts';
import { calendarEvents, fullCalendarScript, renderCalendar } from './charts/calendar.ts';
import { CHARTS_CSS, CHARTS_JS } from './charts/client.ts';
import { renderMap } from './charts/map.ts';
import { chartModel } from './charts/model.ts';
import { renderChartSvg } from './charts/svg.ts';

/**
 * Data visualization for the local preview: a dependency-free SVG stand-in for Oracle JET
 * charts, the genuine FullCalendar for calendar regions, and an offline map canvas.
 */

const DEFAULT_WIDTH = 640;
const UNSUPPORTED_TYPES = new Set(['gantt', 'boxPlot']);

function chartBody(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent, width: number): string {
  const model = chartModel(renderer, ctx, region);
  return renderChartSvg(model, width);
}

function renderChartRegion(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const type = str(region.props, 'chart.type', 'bar');
  const domId = renderer.regionDomId(region);
  ctx.clientConfig.regions.push({ id: domId, kind: 'chart' });
  if (UNSUPPORTED_TYPES.has(type)) {
    renderer.diagnose(
      'warning',
      `Chart ${region.id} (${type}) is not simulated; its data is drawn as a bar chart`,
      ctx.pageId,
      region.id,
    );
  } else {
    renderer.diagnose(
      'info',
      `Chart ${region.id} (${type}) is drawn by the local SVG renderer, not Oracle JET`,
      ctx.pageId,
      region.id,
    );
  }
  if (str(region.props, 'componentAdvanced.initJavaScriptFunction'))
    renderer.diagnose(
      'info',
      `Chart ${region.id}: the initialization JavaScript function is not applied locally`,
      ctx.pageId,
      region.id,
    );
  const model = chartModel(renderer, ctx, UNSUPPORTED_TYPES.has(type) ? asBar(region) : region);
  const maxWidth = model.maxWidth ? `max-width:${model.maxWidth}px;` : '';
  return `<div class="apex-local-jet a-JET-chart" id="${escapeHtml(domId)}_jet" data-chart-region="${escapeHtml(region.id)}" data-chart-type="${escapeHtml(type)}" data-width="${DEFAULT_WIDTH}" style="${maxWidth}min-height:${model.height}px">${renderChartSvg(model, DEFAULT_WIDTH)}</div>`;
}

function asBar(region: ApxComponent): ApxComponent {
  return { ...region, props: { ...region.props, chart: { type: 'bar' } } };
}

function findRegion(renderer: ApexRenderer, ctx: RenderContext, id: string): ApxComponent | undefined {
  return renderer
    .pageComponents(ctx, 'region')
    .find((candidate) => candidate.id === id || renderer.regionDomId(candidate) === id);
}

function routeContext(
  renderer: ApexRenderer,
  session: Session,
  params: URLSearchParams,
  type: string,
): { ctx: RenderContext; region: ApxComponent } | RouteResponse {
  const page = params.get('page') ?? '';
  if (!renderer.findPage(page)) return { status: 404, type: 'text', body: `Page ${page} does not exist` };
  const ctx = renderer.prepare(session, page);
  const region = findRegion(renderer, ctx, params.get('region') ?? '');
  if (!region || str(region.props, 'type') !== type)
    return {
      status: 404,
      type: 'text',
      body: `No ${type} region ${params.get('region') ?? ''} on page ${page}`,
    };
  return { ctx, region };
}

const parseRange = (value: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

registerExtension({
  name: 'charts',
  regions: {
    chart: renderChartRegion,
    calendar: (renderer, ctx, region) => renderCalendar(renderer, ctx, region),
    map: (renderer, ctx, region) => renderMap(renderer, ctx, region),
  },
  routes: {
    /** Redraws a chart at the width the browser measured: `?page=&region=&width=`. */
    chart(renderer, session, request) {
      const found = routeContext(renderer, session, request.params, 'chart');
      if (!('ctx' in found)) return found;
      const width = Math.max(160, Math.min(4000, Number(request.params.get('width')) || DEFAULT_WIDTH));
      const type = str(found.region.props, 'chart.type', 'bar');
      const region = UNSUPPORTED_TYPES.has(type) ? asBar(found.region) : found.region;
      return { type: 'html', body: chartBody(renderer, found.ctx, region, width) };
    },
    /** FullCalendar event feed: `?page=&region=&start=ISO&end=ISO`. */
    calendar(renderer, session, request) {
      const found = routeContext(renderer, session, request.params, 'calendar');
      if (!('ctx' in found)) return found;
      const { events, error } = calendarEvents(renderer, found.ctx, found.region, {
        start: parseRange(request.params.get('start')),
        end: parseRange(request.params.get('end')),
      });
      if (error && !events.length) return { status: 500, type: 'json', body: JSON.stringify({ error }) };
      return { type: 'json', body: JSON.stringify(events) };
    },
  },
  page(renderer, ctx) {
    if (!renderer.pageComponents(ctx, 'region').some((region) => str(region.props, 'type') === 'calendar'))
      return;
    const script = fullCalendarScript(renderer);
    if (script) ctx.jsFiles.add(script);
    else
      renderer.diagnose(
        'warning',
        'FullCalendar is missing from the preview assets; calendar events are listed instead',
        ctx.pageId,
      );
  },
  client: CHARTS_JS,
  css: CHARTS_CSS,
});
