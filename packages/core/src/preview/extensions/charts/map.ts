import { bool, get, isObject, num, str, type ApxComponent, type ApxObject } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import { registerExtension } from '../../extensions.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import { niceScale, ticks, truncate } from './format.ts';
import { PALETTE } from './svg.ts';
import { rowSubstitute, substituteDeep } from './model.ts';

type Position = [number, number];

/** Per-row drawing style of a feature (Appearance and Point Objects attributes of its layer). */
interface Style {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillOpacity: number;
  dash: string;
  shape: string;
  scale: number;
}

interface Feature {
  layer: number;
  kind: 'point' | 'line' | 'polygon';
  parts: Position[][];
  /** Tooltip text (Tooltip column or HTML expression, as text). */
  label: string;
  /** Info window markup shown on click. */
  info: string;
  link?: string | undefined;
  style: Style;
  /** Heat map weight (Value Column), when set. */
  weight?: number | undefined;
}

interface Layer {
  name: string;
  type: string;
  color: string;
  stroke: string;
  count: number;
  legend: boolean;
  error?: string | undefined;
}

const esc = escapeHtml;
const fixed = (value: number) => Number(value.toFixed(2));

/** Flattens GeoJSON geometry into point/line/polygon parts (lon, lat). */
function geometry(value: unknown): { kind: Feature['kind']; parts: Position[][] }[] {
  let json: unknown = value;
  if (typeof value === 'string') {
    try {
      json = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!json || typeof json !== 'object') return [];
  const object = json as {
    type?: string;
    coordinates?: unknown;
    geometry?: unknown;
    geometries?: unknown[];
    features?: unknown[];
  };
  const coordinates = object.coordinates as never;
  switch (object.type) {
    case 'Feature':
      return geometry(object.geometry);
    case 'FeatureCollection':
      return (object.features ?? []).flatMap(geometry);
    case 'GeometryCollection':
      return (object.geometries ?? []).flatMap(geometry);
    case 'Point':
      return [{ kind: 'point', parts: [[coordinates as Position]] }];
    case 'MultiPoint':
      return (coordinates as Position[]).map((point) => ({ kind: 'point' as const, parts: [[point]] }));
    case 'LineString':
      return [{ kind: 'line', parts: [coordinates as Position[]] }];
    case 'MultiLineString':
      return [{ kind: 'line', parts: coordinates as Position[][] }];
    case 'Polygon':
      return [{ kind: 'polygon', parts: coordinates as Position[][] }];
    case 'MultiPolygon':
      return (coordinates as Position[][][]).map((rings) => ({ kind: 'polygon' as const, parts: rings }));
    default:
      return [];
  }
}

const mercator = ([lon, lat]: Position): Position => {
  const clamped = Math.max(-85, Math.min(85, lat));
  return [lon, (Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360)) * 180) / Math.PI];
};

/** `&COLUMN.` substitution with HTML-escaped values, as APEX applies to HTML expressions. */
function htmlSubstitute(template: string, row: Row): string {
  return template.replace(/&([A-Za-z][\w$#]*)\./gu, (whole, name: string) => {
    const key = name.toUpperCase();
    return key in row ? esc(String(row[key] ?? '')) : whole;
  });
}

const textOf = (html: string) =>
  html
    .replace(/<br\s*\/?>/giu, ' ')
    .replace(/<[^>]*>/gu, '')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&amp;/gu, '&')
    .replace(/\s+/gu, ' ')
    .trim();

const DASHES: Record<string, string> = {
  dashed: '6 4',
  dash: '6 4',
  dotted: '1.5 4',
  dot: '1.5 4',
  dashDot: '6 3 1.5 3',
};

function rowStyle(props: ApxObject, row: Row, layer: Layer, kind: string): Style {
  const value = (path: string) => rowSubstitute(str(props, path), row).trim();
  const number = (path: string, fallback: number) => {
    const parsed = Number(value(path));
    return value(path) !== '' && Number.isFinite(parsed) ? parsed : fallback;
  };
  const fill = value('appearance.fillColor');
  const stroke = value('appearance.strokeColor');
  return {
    fill: fill && !fill.includes('&') ? fill : layer.color,
    stroke: stroke && !stroke.includes('&') ? stroke : kind === 'points' ? '#ffffff' : layer.stroke,
    strokeWidth: number('appearance.strokeWidth', kind === 'lines' ? 3 : 1.5),
    fillOpacity: number('appearance.fillOpacity', kind === 'polygons' ? 0.35 : 1),
    dash: DASHES[value('appearance.strokeStyle')] ?? '',
    shape: value('pointObjects.shape') || 'Default',
    scale: Math.max(0.2, Math.min(5, number('pointObjects.shapeScale', 1))),
  };
}

export function renderMap(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const layers: Layer[] = [];
  const features: Feature[] = [];
  const definitions = region.children
    .filter((child) => child.type === 'layer')
    .sort((a, b) => num(a.props, 'layout.sequence', 0) - num(b.props, 'layout.sequence', 0));
  const domId = renderer.regionDomId(region);
  for (const definition of definitions) {
    if (!renderer.condition(ctx, definition.props)) continue;
    const props = definition.props;
    const index = layers.length;
    const type = str(props, 'layerType', 'points');
    const color = str(props, 'appearance.fillColor') || PALETTE[index % PALETTE.length]!;
    const layer: Layer = {
      name: str(props, 'name', definition.id),
      type,
      color: color.includes('&') ? PALETTE[index % PALETTE.length]! : color,
      stroke: str(props, 'appearance.strokeColor') || color,
      count: 0,
      legend: bool(props, 'legend.show', true),
    };
    if (layer.stroke.includes('&')) layer.stroke = layer.color;
    layers.push(layer);
    if (type === 'extrudedPolygons')
      renderer.diagnose(
        'info',
        `Map layer ${definition.id} (extrudedPolygons) is drawn as flat polygons locally`,
        ctx.pageId,
        region.id,
      );
    const location = str(props, 'source.location');
    const fromRegion = location === 'regionSource' || !isObject(props.source);
    const sql = fromRegion ? renderer.regionSql(ctx, region) : renderer.regionSql(ctx, definition);
    if (!sql) {
      layer.error = 'no SQL source';
      continue;
    }
    const result = renderer.query(ctx, region, sql, num(props, 'performance.maxRowsToProcess', 0) || 5_000);
    if (result.error) {
      layer.error = result.error;
      continue;
    }
    const column = (key: string) => str(props, `columnMapping.${key}`).toUpperCase();
    const dataType = str(props, 'columnMapping.geometryColumnDataType', 'longitudeLatitude');
    const lon = column('longitudeColumn');
    const lat = column('latitudeColumn');
    const geometryColumn = column('geojsonColumn') || column('geometryColumn');
    const tooltipColumn = str(props, 'tooltip.column').toUpperCase();
    const tooltipHtml = bool(props, 'tooltip.advancedFormatting', false)
      ? str(props, 'tooltip.htmlExpression')
      : '';
    const infoHtml = bool(props, 'infoWindow.advancedFormatting', false)
      ? str(props, 'infoWindow.htmlExpression')
      : '';
    const titleColumn = str(props, 'infoWindow.titleColumn').toUpperCase();
    const bodyColumn = str(props, 'infoWindow.bodyColumn').toUpperCase();
    const labelColumn = str(props, 'label.label');
    const valueColumn = str(props, 'appearance.valueColumn').toUpperCase();
    // Layers sharing the region source take only the rows assigned to them.
    const assignColumn = fromRegion ? str(props, 'rowAssignment.column').toUpperCase() : '';
    const assignValue = str(props, 'rowAssignment.valueForThisLayer');
    const target = get(props, 'link.target');
    if (dataType === 'sdoGeometry')
      renderer.diagnose(
        'warning',
        `Map layer ${definition.id} uses SDO_GEOMETRY; only GeoJSON text in that column can be drawn locally`,
        ctx.pageId,
        region.id,
      );
    for (const row of result.rows) {
      if (assignColumn && String(row[assignColumn] ?? '') !== assignValue) continue;
      const shapes =
        dataType === 'longitudeLatitude'
          ? Number.isFinite(Number(row[lon])) &&
            Number.isFinite(Number(row[lat])) &&
            row[lon] !== null &&
            row[lat] !== null &&
            row[lon] !== undefined &&
            row[lat] !== undefined
            ? [{ kind: 'point' as const, parts: [[[Number(row[lon]), Number(row[lat])] as Position]] }]
            : []
          : geometry(row[geometryColumn]);
      if (!shapes.length) continue;
      const label =
        (tooltipHtml && textOf(htmlSubstitute(tooltipHtml, row as Row))) ||
        (tooltipColumn && String(row[tooltipColumn] ?? '')) ||
        (titleColumn && String(row[titleColumn] ?? '')) ||
        (labelColumn &&
          rowSubstitute(labelColumn.includes('&') ? labelColumn : `&${labelColumn}.`, row as Row)) ||
        '';
      const info = infoHtml
        ? htmlSubstitute(infoHtml, row as Row)
        : titleColumn || bodyColumn
          ? `${titleColumn ? `<h4>${esc(String(row[titleColumn] ?? ''))}</h4>` : ''}${bodyColumn ? `<p>${esc(String(row[bodyColumn] ?? ''))}</p>` : ''}`
          : '';
      const link = target === undefined ? undefined : renderer.link(ctx, substituteDeep(target, row), row);
      const style = rowStyle(props, row as Row, layer, type);
      const weight =
        valueColumn && Number.isFinite(Number(row[valueColumn])) ? Number(row[valueColumn]) : undefined;
      for (const shape of shapes) features.push({ layer: index, ...shape, label, info, link, style, weight });
      layer.count += 1;
    }
  }
  renderer.diagnose(
    'info',
    `Map ${region.id} is drawn offline on a plain canvas; background map tiles are not loaded`,
    ctx.pageId,
    region.id,
  );
  // Region attribute map.height (Map > Height, default 640 px).
  const height = num(region.props, 'map.height', 0) || num(region.props, 'appearance.height', 0) || 640;
  return mapHtml(region, domId, layers, features, height);
}

/** SVG path of a marker centred on (x, y) for the APEX point shape names. */
function marker(
  shape: string,
  x: number,
  y: number,
  scale: number,
): { kind: 'circle' | 'path'; d: string; r: number } {
  const r = 6 * scale;
  const name = shape.toLowerCase();
  if (name === 'circle' || name === 'dot') return { kind: 'circle', d: '', r };
  if (name === 'square')
    return {
      kind: 'path',
      d: `M${fixed(x - r)} ${fixed(y - r)}h${fixed(2 * r)}v${fixed(2 * r)}h${fixed(-2 * r)}Z`,
      r,
    };
  if (name === 'diamond')
    return {
      kind: 'path',
      d: `M${fixed(x)} ${fixed(y - r * 1.3)}L${fixed(x + r * 1.3)} ${fixed(y)}L${fixed(x)} ${fixed(y + r * 1.3)}L${fixed(x - r * 1.3)} ${fixed(y)}Z`,
      r,
    };
  if (name === 'triangle')
    return {
      kind: 'path',
      d: `M${fixed(x)} ${fixed(y - r * 1.3)}L${fixed(x + r * 1.2)} ${fixed(y + r)}L${fixed(x - r * 1.2)} ${fixed(y + r)}Z`,
      r,
    };
  // Default, Pin Circle, Pin Square, Balloon and the icon-like shapes: a map pin whose tip marks the spot.
  const h = 22 * scale;
  const w = 8 * scale;
  return {
    kind: 'path',
    d: `M${fixed(x)} ${fixed(y)}C${fixed(x - w * 0.3)} ${fixed(y - h * 0.35)} ${fixed(x - w)} ${fixed(y - h * 0.5)} ${fixed(x - w)} ${fixed(y - h * 0.7)}A${fixed(w)} ${fixed(w)} 0 1 1 ${fixed(x + w)} ${fixed(y - h * 0.7)}C${fixed(x + w)} ${fixed(y - h * 0.5)} ${fixed(x + w * 0.3)} ${fixed(y - h * 0.35)} ${fixed(x)} ${fixed(y)}Z`,
    r,
  };
}

function mapHtml(
  region: ApxComponent,
  domId: string,
  layers: Layer[],
  features: Feature[],
  height: number,
): string {
  const width = 800;
  const all = features
    .flatMap((feature) => feature.parts.flat())
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  const summary = layers
    .filter((layer) => layer.legend || layer.error)
    .map(
      (layer) =>
        `<li><span class="apex-local-map-swatch" style="background:${esc(layer.color)}"></span>${esc(layer.name)} <span class="apex-local-map-count">${layer.error ? `(${esc(truncate(layer.error, 120))})` : `${layer.count} ${layer.type}`}</span></li>`,
    )
    .join('');
  const note = `<div class="apex-local-map-note"><span class="fa fa-map-o" aria-hidden="true"></span> Offline map preview: background tiles are not loaded.</div>`;
  if (!all.length) {
    return `<div class="apex-local-map" id="${esc(domId)}_map">${note}<div class="apex-local-unsupported">No mappable rows${layers.length ? '' : ' (the map has no layers)'}.</div><ul class="apex-local-map-layers">${summary}</ul></div>`;
  }
  const projected = all.map(mercator);
  let minX = Math.min(...projected.map((point) => point[0]));
  let maxX = Math.max(...projected.map((point) => point[0]));
  let minY = Math.min(...projected.map((point) => point[1]));
  let maxY = Math.max(...projected.map((point) => point[1]));
  const padX = Math.max((maxX - minX) * 0.08, 0.5);
  const padY = Math.max((maxY - minY) * 0.08, 0.5);
  minX -= padX;
  maxX += padX;
  minY -= padY;
  maxY += padY;
  // Keep the aspect ratio of the projected box.
  const scale = Math.min(width / (maxX - minX), height / (maxY - minY));
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;
  const toScreen = (position: Position): Position => {
    const [x, y] = mercator(position);
    return [offsetX + (x - minX) * scale, height - (offsetY + (y - minY) * scale)];
  };
  const grid: string[] = [];
  const lonScale = niceScale(minX, maxX, { ticks: 6, includeZero: false });
  for (const lon of ticks(lonScale)) {
    const [x] = toScreen([lon, 0]);
    if (x < 0 || x > width) continue;
    grid.push(
      `<line class="ajc-grid" x1="${fixed(x)}" y1="0" x2="${fixed(x)}" y2="${height}"/><text class="ajc-tick" x="${fixed(x + 3)}" y="${height - 6}" font-size="10">${esc(`${Math.abs(lon)}°${lon < 0 ? 'W' : lon > 0 ? 'E' : ''}`)}</text>`,
    );
  }
  const latitudes = [minY, maxY].map((y) => (Math.atan(Math.sinh((y * Math.PI) / 180)) * 180) / Math.PI);
  const latScale = niceScale(latitudes[0]!, latitudes[1]!, { ticks: 5, includeZero: false });
  for (const lat of ticks(latScale)) {
    const [, y] = toScreen([0, lat]);
    if (y < 0 || y > height) continue;
    grid.push(
      `<line class="ajc-grid" x1="0" y1="${fixed(y)}" x2="${width}" y2="${fixed(y)}"/><text class="ajc-tick" x="4" y="${fixed(y - 3)}" font-size="10">${esc(`${Math.abs(lat)}°${lat < 0 ? 'S' : lat > 0 ? 'N' : ''}`)}</text>`,
    );
  }
  // Heat map layers: blurred radial blobs weighted by the Value Column.
  const gradients: string[] = [];
  const weights = new Map<number, { min: number; max: number }>();
  layers.forEach((layer, index) => {
    if (layer.type !== 'heatMap') return;
    gradients.push(
      `<radialGradient id="${esc(domId)}_heat${index}"><stop offset="0" stop-color="${esc(layer.color)}" stop-opacity="0.85"/><stop offset="0.45" stop-color="${esc(layer.color)}" stop-opacity="0.4"/><stop offset="1" stop-color="${esc(layer.color)}" stop-opacity="0"/></radialGradient>`,
    );
    const values = features
      .filter((feature) => feature.layer === index && feature.weight !== undefined)
      .map((feature) => feature.weight!);
    if (values.length) weights.set(index, { min: Math.min(...values), max: Math.max(...values) });
  });
  const shapes = features
    .map((feature) => {
      const layer = layers[feature.layer]!;
      const style = feature.style;
      const tip = feature.label
        ? ` data-tip="${esc(`${layer.name}\t${feature.label}`)}"`
        : ` data-tip="${esc(layer.name)}"`;
      const info = feature.info ? ` data-info="${esc(feature.info)}"` : '';
      const href = feature.link && feature.info ? ` data-href="${esc(feature.link)}"` : '';
      const dash = style.dash ? ` stroke-dasharray="${style.dash}"` : '';
      let markup: string;
      if (layer.type === 'heatMap') {
        const [x, y] = toScreen(feature.parts[0]![0]!);
        const range = weights.get(feature.layer);
        const ratio =
          range && feature.weight !== undefined && range.max > range.min
            ? (feature.weight - range.min) / (range.max - range.min)
            : 0.6;
        markup = `<circle class="apex-local-map-heat" cx="${fixed(x)}" cy="${fixed(y)}" r="${fixed(18 + 26 * ratio)}" fill="url(#${esc(domId)}_heat${feature.layer})" fill-opacity="${fixed(0.45 + 0.55 * ratio)}"${tip}/>`;
      } else if (feature.kind === 'point') {
        const [x, y] = toScreen(feature.parts[0]![0]!);
        const shape = marker(style.shape, x, y, style.scale);
        const paint = `fill="${esc(style.fill)}" fill-opacity="${style.fillOpacity}" stroke="${esc(style.stroke)}" stroke-width="${style.strokeWidth}"`;
        markup =
          shape.kind === 'circle'
            ? `<circle class="apex-local-map-point" cx="${fixed(x)}" cy="${fixed(y)}" r="${fixed(shape.r)}" ${paint}${tip}${info}${href}/>`
            : `<path class="apex-local-map-point" d="${shape.d}" ${paint}${tip}${info}${href}/>`;
      } else {
        const d = feature.parts
          .map(
            (part) =>
              part
                .map((position, index) => {
                  const [x, y] = toScreen(position);
                  return `${index ? 'L' : 'M'}${fixed(x)} ${fixed(y)}`;
                })
                .join('') + (feature.kind === 'polygon' ? 'Z' : ''),
          )
          .join('');
        markup =
          feature.kind === 'polygon'
            ? `<path class="apex-local-map-shape" d="${d}" fill="${esc(style.fill)}" fill-opacity="${style.fillOpacity}" stroke="${esc(style.stroke)}" stroke-width="${style.strokeWidth}"${dash} fill-rule="evenodd"${tip}${info}${href}/>`
            : `<path class="apex-local-map-shape" d="${d}" fill="none" stroke="${esc(style.stroke)}" stroke-width="${style.strokeWidth}"${dash}${tip}${info}${href}/>`;
      }
      // Without an info window a linked feature navigates directly.
      return feature.link && !feature.info ? `<a href="${esc(feature.link)}">${markup}</a>` : markup;
    })
    .join('');
  const labelled = features.filter((feature) => feature.label && layers[feature.layer]!.type !== 'heatMap');
  const items = labelled
    .slice(0, 40)
    .map((feature) => {
      const layer = layers[feature.layer]!;
      const [lon, lat] = feature.parts[0]![0]!;
      const text = esc(feature.label);
      return `<li><span class="apex-local-map-swatch" style="background:${esc(layer.color)}"></span>${feature.link ? `<a href="${esc(feature.link)}">${text}</a>` : text} <span class="apex-local-map-count">${lat.toFixed(3)}, ${lon.toFixed(3)}</span></li>`;
    })
    .join('');
  const more = labelled.length - Math.min(labelled.length, 40);
  return `<div class="apex-local-map" id="${esc(domId)}_map" data-map-region="${esc(region.id)}">${note}<div class="apex-local-map-frame"><svg xmlns="http://www.w3.org/2000/svg" class="apex-local-map-canvas" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet" style="height:${height}px" role="img" aria-label="${esc(str(region.props, 'name', region.id))}">${gradients.length ? `<defs>${gradients.join('')}</defs>` : ''}${grid.join('')}${shapes}</svg></div><ul class="apex-local-map-layers">${summary}</ul>${items ? `<ul class="apex-local-map-features">${items}${more > 0 ? `<li class="apex-local-map-count">… ${more} more</li>` : ''}</ul>` : ''}</div>`;
}

/** Info windows: a popup at the clicked feature with its HTML and, for linked layers, the link. */
const MAP_JS = String.raw`
(function ($) {
  "use strict";
  function close() { $(".apex-local-map-info").remove(); }
  $(document).on("click", ".apex-local-map [data-info]", function (event) {
    var feature = this, frame = $(feature).closest(".apex-local-map-frame");
    var html = feature.getAttribute("data-info") || "", href = feature.getAttribute("data-href");
    event.preventDefault();
    close();
    var offset = frame[0].getBoundingClientRect();
    var popup = $('<div class="apex-local-map-info" role="dialog"><button type="button" class="apex-local-map-info-close" aria-label="Close">&times;</button><div class="apex-local-map-info-body"></div></div>');
    popup.find(".apex-local-map-info-body").html(html);
    if (href) popup.append($('<a class="apex-local-map-info-link"></a>').attr("href", href).text("Open"));
    popup.css({ left: Math.max(4, event.clientX - offset.left - 20) + "px", top: Math.max(4, event.clientY - offset.top + 12) + "px" });
    frame.append(popup);
  });
  $(document).on("click", ".apex-local-map-info-close", close);
  $(document).on("keydown", function (event) { if (event.key === "Escape") close(); });
})(apex.jQuery);
`;

const MAP_CSS = String.raw`
.apex-local-map-frame{position:relative}
.apex-local-map-canvas{background:#eef3f6}
.apex-local-map [data-info]{cursor:pointer}
.apex-local-map-heat{pointer-events:all}
.apex-local-map-info{position:absolute;z-index:20;min-width:160px;max-width:300px;background:var(--ut-component-background-color,#fff);color:var(--ut-body-text-color,#161513);border:1px solid rgba(22,21,19,.12);border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.18);padding:8px 28px 8px 12px;font-size:13px;line-height:1.4}
.apex-local-map-info h3,.apex-local-map-info h4{margin:0 0 4px;font-size:14px}
.apex-local-map-info p{margin:0 0 4px}
.apex-local-map-info-close{position:absolute;top:2px;right:4px;border:0;background:none;font-size:18px;line-height:1;cursor:pointer;color:inherit}
.apex-local-map-info-link{display:inline-block;margin-top:4px;font-weight:600}
`;

registerExtension({ name: 'maps', client: MAP_JS, css: MAP_CSS });
