import { get, isObject, num, str, type ApxComponent } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import { niceScale, ticks, truncate } from './format.ts';
import { PALETTE } from './svg.ts';
import { rowSubstitute, substituteDeep } from './model.ts';

type Position = [number, number];

interface Feature {
  layer: number;
  kind: 'point' | 'line' | 'polygon';
  parts: Position[][];
  label: string;
  link?: string | undefined;
}

interface Layer {
  name: string;
  type: string;
  color: string;
  stroke: string;
  count: number;
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

export function renderMap(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const layers: Layer[] = [];
  const features: Feature[] = [];
  const definitions = region.children
    .filter((child) => child.type === 'layer')
    .sort((a, b) => num(a.props, 'layout.sequence', 0) - num(b.props, 'layout.sequence', 0));
  for (const definition of definitions) {
    if (!renderer.condition(ctx, definition.props)) continue;
    const index = layers.length;
    const type = str(definition.props, 'layerType', 'points');
    const color = str(definition.props, 'appearance.fillColor') || PALETTE[index % PALETTE.length]!;
    const layer: Layer = {
      name: str(definition.props, 'name', definition.id),
      type,
      color: color.includes('&') ? PALETTE[index % PALETTE.length]! : color,
      stroke: str(definition.props, 'appearance.strokeColor') || color,
      count: 0,
    };
    layers.push(layer);
    if (type === 'heatMap' || type === 'extrudedPolygons')
      renderer.diagnose(
        'info',
        `Map layer ${definition.id} (${type}) is drawn as plain ${type === 'heatMap' ? 'points' : 'polygons'} locally`,
        ctx.pageId,
        region.id,
      );
    const location = str(definition.props, 'source.location');
    const sql =
      location === 'regionSource' || !isObject(definition.props.source)
        ? renderer.regionSql(ctx, region)
        : renderer.regionSql(ctx, definition);
    if (!sql) {
      layer.error = 'no SQL source';
      continue;
    }
    const result = renderer.query(
      ctx,
      region,
      sql,
      num(definition.props, 'performance.maxRowsToProcess', 0) || 5_000,
    );
    if (result.error) {
      layer.error = result.error;
      continue;
    }
    const column = (key: string) => str(definition.props, `columnMapping.${key}`).toUpperCase();
    const dataType = str(definition.props, 'columnMapping.geometryColumnDataType', 'longitudeLatitude');
    const lon = column('longitudeColumn');
    const lat = column('latitudeColumn');
    const geometryColumn = column('geojsonColumn') || column('geometryColumn');
    const tooltipColumn = str(definition.props, 'tooltip.column').toUpperCase();
    const titleColumn = str(definition.props, 'infoWindow.titleColumn').toUpperCase();
    const labelColumn = str(definition.props, 'label.label');
    const target = get(definition.props, 'link.target');
    if (dataType === 'sdoGeometry')
      renderer.diagnose(
        'warning',
        `Map layer ${definition.id} uses SDO_GEOMETRY; only GeoJSON text in that column can be drawn locally`,
        ctx.pageId,
        region.id,
      );
    for (const row of result.rows) {
      const shapes =
        dataType === 'longitudeLatitude'
          ? Number.isFinite(Number(row[lon])) &&
            Number.isFinite(Number(row[lat])) &&
            row[lon] !== null &&
            row[lat] !== null
            ? [{ kind: 'point' as const, parts: [[[Number(row[lon]), Number(row[lat])] as Position]] }]
            : []
          : geometry(row[geometryColumn]);
      if (!shapes.length) continue;
      const label =
        (tooltipColumn && String(row[tooltipColumn] ?? '')) ||
        (titleColumn && String(row[titleColumn] ?? '')) ||
        (labelColumn &&
          rowSubstitute(labelColumn.includes('&') ? labelColumn : `&${labelColumn}.`, row as Row)) ||
        '';
      const link = target === undefined ? undefined : renderer.link(ctx, substituteDeep(target, row), row);
      for (const shape of shapes) features.push({ layer: index, ...shape, label, link });
      layer.count += 1;
    }
  }
  renderer.diagnose(
    'info',
    `Map ${region.id} is drawn offline on a plain canvas; background map tiles are not loaded`,
    ctx.pageId,
    region.id,
  );
  return mapHtml(
    region,
    renderer.regionDomId(region),
    layers,
    features,
    num(region.props, 'appearance.height', 0) || 420,
  );
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
  const shapes = features
    .map((feature) => {
      const layer = layers[feature.layer]!;
      const tip = feature.label
        ? ` data-tip="${esc(`${layer.name}\t${feature.label}`)}"`
        : ` data-tip="${esc(layer.name)}"`;
      let markup: string;
      if (feature.kind === 'point') {
        const [x, y] = toScreen(feature.parts[0]![0]!);
        markup = `<circle class="apex-local-map-point" cx="${fixed(x)}" cy="${fixed(y)}" r="6" fill="${esc(layer.color)}"${tip}/>`;
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
            ? `<path class="apex-local-map-shape" d="${d}" fill="${esc(layer.color)}" fill-opacity="0.35" stroke="${esc(layer.stroke)}" stroke-width="1.5" fill-rule="evenodd"${tip}/>`
            : `<path class="apex-local-map-shape" d="${d}" fill="none" stroke="${esc(layer.stroke)}" stroke-width="3"${tip}/>`;
      }
      return feature.link ? `<a href="${esc(feature.link)}">${markup}</a>` : markup;
    })
    .join('');
  const labelled = features.filter((feature) => feature.label).slice(0, 40);
  const items = labelled
    .map((feature) => {
      const layer = layers[feature.layer]!;
      const [lon, lat] = feature.parts[0]![0]!;
      const text = esc(feature.label);
      return `<li><span class="apex-local-map-swatch" style="background:${esc(layer.color)}"></span>${feature.link ? `<a href="${esc(feature.link)}">${text}</a>` : text} <span class="apex-local-map-count">${lat.toFixed(3)}, ${lon.toFixed(3)}</span></li>`;
    })
    .join('');
  const more = features.filter((feature) => feature.label).length - labelled.length;
  return `<div class="apex-local-map" id="${esc(domId)}_map" data-map-region="${esc(region.id)}">${note}<svg xmlns="http://www.w3.org/2000/svg" class="apex-local-map-canvas" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(str(region.props, 'name', region.id))}"><rect class="apex-local-map-bg" x="0" y="0" width="${width}" height="${height}"/>${grid.join('')}${shapes}</svg><ul class="apex-local-map-layers">${summary}</ul>${items ? `<ul class="apex-local-map-features">${items}${more > 0 ? `<li class="apex-local-map-count">… ${more} more</li>` : ''}</ul>` : ''}</div>`;
}
