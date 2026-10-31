import { get, str, type ApxComponent } from '../apexlang.ts';
import { registerExtension, type RouteHandler, type RouteResponse } from '../extensions.ts';
import type { ApexRenderer, RenderContext, Session } from '../render.ts';
import { escapeHtml } from '../theme.ts';
import { ITEMS_CLIENT, ITEMS_CSS } from './items/client.ts';
import { libVersions, lovRows, splitValues, type LovEntry } from './items/common.ts';
import { choices, ITEM_RENDERERS, itemTemplate, qrMarkup } from './items/render.ts';

/**
 * Page items: genuine APEX 26.2 item markup plus the client widgets that drive it (date picker,
 * popup LOV, combobox, shuttle, star rating, ...). Server calls the widgets make through
 * apex.server.plugin arrive at `items.ajax`; item help arrives at `items.help`.
 */

const reply = (body: unknown, status = 200): RouteResponse => ({
  status,
  type: 'json',
  body: JSON.stringify(body),
});

interface PluginRequest {
  ctx: RenderContext;
  item: ApxComponent;
  name: string;
  form: URLSearchParams;
  json: {
    regions?: {
      id?: string;
      ajaxIdentifier?: string;
      fetchData?: { search?: string | null; firstRow?: number; maxRows?: number };
    }[];
    pageItems?: { itemsToSubmit?: { n: string; v: string | string[] }[] } | { n: string; v: string }[];
  };
}

function pluginRequest(
  renderer: ApexRenderer,
  session: Session,
  body: string,
): PluginRequest | RouteResponse {
  const form = new URLSearchParams(body);
  let json: PluginRequest['json'] = {};
  try {
    json = JSON.parse(form.getAll('p_json').join('') || '{}') as PluginRequest['json'];
  } catch {
    return reply({ error: 'p_json is not valid JSON' }, 400);
  }
  // apex.model requests carry the identifier per region instead of in p_request.
  const identifier =
    (form.get('p_request') ?? '').replace(/^PLUGIN=/u, '') || (json.regions?.[0]?.ajaxIdentifier ?? '');
  const [prefix, pageId, name] = identifier.split(':');
  if (prefix !== 'LOCAL' || !pageId || !name)
    return reply({ error: `Unknown ajax identifier ${identifier}` }, 400);
  // Items sent along with the request become session state, as in wwv_flow.ajax.
  const submitted = Array.isArray(json.pageItems) ? json.pageItems : (json.pageItems?.itemsToSubmit ?? []);
  for (const entry of submitted)
    session.items[entry.n.toUpperCase()] = Array.isArray(entry.v) ? entry.v.join(':') : String(entry.v ?? '');
  if (!renderer.findPage(pageId)) return reply({ error: `Page ${pageId} not found` }, 404);
  const ctx = renderer.prepareSubmit(session, pageId, '');
  const item = renderer
    .pageComponents(ctx, 'pageItem')
    .find((candidate) => candidate.id.toUpperCase() === name);
  if (!item) return reply({ error: `Item ${name} not found on page ${pageId}` }, 404);
  return { ctx, item, name, form, json };
}

const escaped = (entries: LovEntry[]) =>
  entries.map((entry) => ({ r: escapeHtml(entry.r), d: escapeHtml(entry.d) }));

function matches(text: string, search: string): boolean {
  return text.toLowerCase().includes(search.toLowerCase());
}

/** Popup LOV: model fetches (search, pagination) and display values for set values. */
function popupLovResponse(renderer: ApexRenderer, request: PluginRequest): RouteResponse {
  const { ctx, item, name, form, json } = request;
  const lov = lovRows(renderer, ctx, item);
  const fields = [...lov.columns.map((column) => column.name)];
  if (!fields.includes(lov.returned)) fields.push(lov.returned);
  const action = form.get('p_widget_action');
  if (action === 'get-row-values') {
    const values = form.getAll('f01').flatMap((value) => splitValues(item, value));
    return reply(
      Object.fromEntries(
        values.map((value) => {
          const row = lov.rows.find((candidate) => candidate[lov.returned] === value);
          return [value, { display: row?.[lov.display] ?? value, columns: row ?? {} }];
        }),
      ),
    );
  }
  if (action === 'get-default-values') return reply({});
  const region = json.regions?.[0];
  const fetchData = region?.fetchData ?? {};
  const search = (fetchData.search ?? '').trim();
  const searchable = lov.columns.filter((column) => column.searchable).map((column) => column.name);
  const rows = search
    ? lov.rows.filter((row) => searchable.some((column) => matches(row[column] ?? '', search)))
    : lov.rows;
  const first = Math.max(1, Number(fetchData.firstRow ?? 1));
  const max = Number(fetchData.maxRows ?? 0) || rows.length;
  const page = rows.slice(first - 1, first - 1 + max);
  return reply({
    regions: [
      {
        id: region?.id ?? name,
        fetchedData: {
          values: page.map((row) => fields.map((field) => row[field] ?? '')),
          firstRow: first,
          moreData: first - 1 + max < rows.length,
        },
      },
    ],
  });
}

/** a-combobox / a-select / a-autocomplete searches and display-value lookups. */
function comboResponse(renderer: ApexRenderer, request: PluginRequest, displayOnly: boolean): RouteResponse {
  const { ctx, item, form } = request;
  const lov = lovRows(renderer, ctx, item);
  const extra = lov.columns.filter((column) => column.name !== lov.display);
  const toChoice = (row: Record<string, string>) => ({
    ...(displayOnly ? {} : { r: row[lov.returned] ?? '' }),
    d: row[lov.display] ?? '',
    ...(extra.length ? { cols: extra.map((column) => row[column.name] ?? '') } : {}),
  });
  const fields = extra.length
    ? Object.fromEntries(
        extra.map((column, index) => [column.name, { index, searchable: column.searchable }]),
      )
    : undefined;
  if (form.get('p_widget_action') === 'get-display-values') {
    const values = splitValues(item, form.get('x03') ?? '');
    return reply({
      ...(fields ? { fields } : {}),
      data: lov.rows.filter((row) => values.includes(row[lov.returned] ?? '')).map(toChoice),
    });
  }
  const search = form.get('x01') ?? '';
  const max = Number(form.get('x02') ?? 0) || 250;
  const offset = Math.max(0, Number(form.get('x04') ?? 1) - 1);
  const rows = (search ? lov.rows.filter((row) => matches(row[lov.display] ?? '', search)) : lov.rows).slice(
    offset,
    offset + max,
  );
  return reply({ ...(fields ? { fields } : {}), data: rows.map(toChoice) });
}

const ajax: RouteHandler = (renderer, session, request) => {
  const parsed = pluginRequest(renderer, session, request.body);
  if ('type' in parsed) return parsed;
  const { ctx, item, name, form } = parsed;
  const type = str(item.props, 'type', 'textField');
  switch (type) {
    case 'selectList':
    case 'shuttle':
      // Cascading refresh: the widgets keep their own null entry.
      return reply({ values: escaped(renderer.lov(ctx, get(item.props, 'lov'), name)) });
    case 'radioGroup':
    case 'checkboxGroup':
      return reply({
        html: choices(renderer, ctx, item, name, '', type === 'radioGroup' ? 'radio' : 'checkbox'),
      });
    case 'popupLov':
      return popupLovResponse(renderer, parsed);
    case 'combobox':
    case 'selectOne':
    case 'selectMany':
      return comboResponse(renderer, parsed, false);
    case 'textFieldWithAutocomplete':
    case 'autoComplete':
      return comboResponse(renderer, parsed, true);
    case 'qrCode':
      return reply({
        QR: qrMarkup(item, form.get('x01') ?? '', form.get('x02') || undefined, form.get('x03') || undefined),
      });
    default:
      renderer.diagnose('info', `Ajax call of item ${name} (${type}) is not simulated`, ctx.pageId, name);
      return reply({});
  }
};

/** `apex.theme.popupFieldHelp` JSON: `{ title, helpText }`. */
const help: RouteHandler = (renderer, session, request) => {
  const pageId = request.params.get('page') ?? '';
  const name = (request.params.get('p_item_id') ?? '').toUpperCase();
  if (!renderer.findPage(pageId)) return reply({ error: `Page ${pageId} not found` }, 404);
  const ctx = renderer.prepareSubmit(session, pageId, '');
  const item = renderer
    .pageComponents(ctx, 'pageItem')
    .find((candidate) => candidate.id.toUpperCase() === name);
  const text = item ? str(item.props, 'help.helpText') : '';
  if (!item || !text) return reply({ error: `No help for ${name}` }, 404);
  return reply({
    title: escapeHtml(renderer.substitute(session, renderer.label(item), ctx.page, 'RAW')),
    helpText: `<div class="apex-help-dialog">${renderer.substitute(session, text, ctx.page, 'HTML')}</div>`,
  });
};

/** Item properties that the local preview reads but does not act on. */
const IGNORED: [string, string][] = [
  ['gen-ai', 'genAi'],
  ['geocoding', 'geocodingInput'],
  ['session state encryption', 'security.encryptSessionState'],
  ['restricted characters', 'security.restrictedChars'],
  ['session state protection', 'security.sessionStateProtection'],
  ['client-side init JavaScript function', 'advanced.initJavaScriptFunction'],
];

registerExtension({
  name: 'items',
  items: ITEM_RENDERERS,
  itemTemplate: (renderer, ctx, item, values) => {
    itemTemplate(renderer, ctx, item, values);
    for (const [label, key] of IGNORED)
      if (get(item.props, key) !== undefined)
        renderer.diagnose(
          'info',
          `Item ${item.id.toUpperCase()}: ${label} is not simulated locally`,
          ctx.pageId,
          item.id.toUpperCase(),
        );
  },
  page: (renderer, ctx) => {
    ctx.onload.unshift(
      `apex.libVersions = Object.assign(${JSON.stringify(libVersions(renderer))}, apex.libVersions);`,
    );
  },
  routes: { 'items.ajax': ajax, 'items.help': help },
  client: ITEMS_CLIENT,
  css: ITEMS_CSS,
});
