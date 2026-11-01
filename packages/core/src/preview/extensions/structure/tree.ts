import { get, isObject, str, type ApxComponent } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { RouteResponse } from '../../extensions.ts';
import type { ApexRenderer, RenderContext, Session } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';

/**
 * Tree regions on Oracle's own treeView widget (`apex.widget.tree.init`, as the native region
 * does). Hierarchies come either pre-computed (level and status columns, typically from a
 * `connect by` query) or are computed here from node id / parent key columns.
 */

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  link?: string;
  tooltip?: string;
  children?: TreeNode[];
}

export interface TreeModel {
  data: TreeNode;
  showRoot: boolean;
  expanded: string[];
  selected?: string;
  tooltip: boolean;
  error?: string;
}

const upper = (value: string) => value.replaceAll('"', '').toUpperCase();
const value = (row: Row, column: string) => {
  const raw = column ? row[upper(column)] : undefined;
  return raw === null || raw === undefined ? '' : String(raw);
};

/** `#COLUMN#` substitution in tooltip templates and link targets. */
function rowText(template: string, row: Row, escape: boolean): string {
  return template.replace(/#([A-Z0-9_$]+)#/giu, (whole, name: string) => {
    const key = name.toUpperCase();
    if (!(key in row)) return whole;
    const text = row[key] === null || row[key] === undefined ? '' : String(row[key]);
    return escape ? escapeHtml(text) : text;
  });
}

export function treeModel(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): TreeModel {
  const settings = (key: string) => str(region.props, `settings.${key}`);
  const empty: TreeModel = {
    data: { id: '__root', label: 'Root', children: [] },
    showRoot: false,
    expanded: [],
    tooltip: false,
  };
  const sql = renderer.regionSql(ctx, region);
  if (!sql) return { ...empty, error: 'The tree has no local source.' };
  const result = renderer.query(ctx, region, sql, 10_000);
  if (result.error) return { ...empty, error: result.error };

  const labelColumn = settings('nodeLabelColumn') || result.columns[1] || result.columns[0] || '';
  const valueColumn = settings('nodeValueColumn');
  const idColumn = settings('nodeIdColumn') || valueColumn;
  const iconColumn = settings('iconCssClassColumn');
  const linkColumn = settings('linkColumn');
  const linkTarget = get(region.props, 'settings.link');
  const tooltipType = settings('tooltip');
  const tooltipColumn = settings('tooltipColumn');
  const tooltipValue = settings('tooltipValue');
  const hasTooltip =
    (tooltipType === 'databaseCol' && Boolean(tooltipColumn)) ||
    ((tooltipType === 'htmlExpression' || tooltipType === 'legacyTemplate') && Boolean(tooltipValue));

  const node = (row: Row, index: number): TreeNode => {
    const id = value(row, valueColumn) || value(row, idColumn) || String(index + 1);
    const entry: TreeNode = { id, label: value(row, labelColumn) };
    const icon = value(row, iconColumn);
    if (icon) entry.icon = icon;
    const link = linkColumn
      ? value(row, linkColumn)
      : linkTarget !== undefined
        ? renderer.link(
            ctx,
            isObject(linkTarget) || typeof linkTarget === 'string' ? linkTarget : undefined,
            row,
          )
        : '';
    if (link && link !== '#')
      entry.link = rowText(renderer.substitute(ctx.session, link, ctx.page, 'RAW'), row, false);
    if (hasTooltip) {
      const tip =
        tooltipType === 'databaseCol'
          ? value(row, tooltipColumn)
          : rowText(tooltipValue, row, true).replace(/<[^>]*>/gu, '');
      if (tip) entry.tooltip = tip;
    }
    return entry;
  };

  const roots: TreeNode[] = [];
  const expanded: string[] = [];
  if (settings('hierarchy') === 'notComputed') {
    // Pre-computed: rows arrive in tree order with a level and a status (1 expanded, -1 collapsed, 0 leaf).
    const levelColumn = settings('hierarchyLevelColumn') || 'LEVEL';
    const statusColumn = settings('nodeStatusColumn');
    const stack: TreeNode[] = [];
    result.rows.forEach((row, index) => {
      const entry = node(row, index);
      const level = Math.max(1, Number(value(row, levelColumn)) || 1);
      stack.length = Math.min(stack.length, level - 1);
      const parent = stack.at(-1);
      if (parent) (parent.children ??= []).push(entry);
      else roots.push(entry);
      stack.push(entry);
      if (value(row, statusColumn) === '1') expanded.push(entry.id);
    });
  } else {
    // Computed with SQL: node id / parent key, start with, order siblings by.
    const parentColumn = settings('parentKeyColumn');
    if (!idColumn || !parentColumn)
      renderer.diagnose(
        'warning',
        `Tree ${region.id}: computed hierarchy needs node ID and parent key columns; rows are shown flat`,
        ctx.pageId,
        region.id,
      );
    const start = settings('startTreeWith') || 'valueIsNull';
    let startValues: string[] | undefined;
    if (start === 'basedOnStaticValue')
      startValues = [renderer.substitute(ctx.session, settings('staticValue'), ctx.page, 'RAW')];
    else if (start === 'basedOnExistingItem')
      startValues = [ctx.session.items[upper(settings('item'))] ?? ''];
    else if (start === 'basedOnSqlQuery') {
      try {
        const rows = renderer.data.query(settings('sqlQuery'), renderer.binds(ctx.session, ctx.page), 1000);
        startValues = rows.rows.map((row) => String(row[rows.columns[0]!] ?? ''));
      } catch (error) {
        renderer.diagnose(
          'warning',
          `Tree ${region.id}: start query failed: ${(error as Error).message}`,
          ctx.pageId,
          region.id,
        );
        startValues = [];
      }
    }
    const order = upper(settings('orderSiblingsBy'));
    const rows = order
      ? [...result.rows].sort((a, b) => {
          const left = a[order];
          const right = b[order];
          if (typeof left === 'number' && typeof right === 'number') return left - right;
          return String(left ?? '').localeCompare(String(right ?? ''));
        })
      : result.rows;
    const nodes = rows.map((row, index) => ({ row, entry: node(row, index), key: value(row, idColumn) }));
    const byParent = new Map<string, typeof nodes>();
    for (const item of nodes) {
      const parent = parentColumn ? value(item.row, parentColumn) : '';
      byParent.set(parent, [...(byParent.get(parent) ?? []), item]);
    }
    const isRoot = (item: (typeof nodes)[number]) =>
      startValues ? startValues.includes(item.key) : !parentColumn || value(item.row, parentColumn) === '';
    const seen = new Set<string>();
    const attach = (item: (typeof nodes)[number], depth: number) => {
      if (seen.has(item.key) || depth > 64) return;
      seen.add(item.key);
      const kids = item.key ? (byParent.get(item.key) ?? []) : [];
      for (const kid of kids) {
        if (seen.has(kid.key)) continue;
        (item.entry.children ??= []).push(kid.entry);
        attach(kid, depth + 1);
      }
    };
    for (const item of nodes.filter(isRoot)) {
      roots.push(item.entry);
      attach(item, 1);
    }
  }
  const selectedItem = settings('selectedNodePageItem');
  const selected = selectedItem ? (ctx.session.items[upper(selectedItem)] ?? '') : '';
  const single = roots.length === 1;
  return {
    data: single ? roots[0]! : { id: '__root', label: str(region.props, 'name', 'Root'), children: roots },
    showRoot: single,
    expanded,
    ...(selected ? { selected } : {}),
    tooltip: hasTooltip,
  };
}

function markup(node: TreeNode, iconType: string, defaultIcon: string, level: number): string {
  const kids = node.children ?? [];
  const icon = node.icon || defaultIcon;
  const label = escapeHtml(node.label);
  const content = node.link
    ? `<a class="a-TreeView-label" href="${escapeHtml(node.link)}" tabindex="-1">${label}</a>`
    : `<span class="a-TreeView-label" tabindex="-1">${label}</span>`;
  return `<li class="a-TreeView-node${level === 1 ? ' a-TreeView-node--topLevel' : ''}${kids.length ? ' is-expandable' : ' is-leaf'}" data-id="${escapeHtml(node.id)}"${node.tooltip ? ` title="${escapeHtml(node.tooltip)}"` : ''}><div class="a-TreeView-content">${icon ? `<span class="${escapeHtml(`${iconType} ${icon}`)}" aria-hidden="true"></span>` : ''}${content}</div>${kids.length ? `<ul>${kids.map((kid) => markup(kid, iconType, defaultIcon, level + 1)).join('')}</ul>` : ''}</li>`;
}

export function renderTree(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const domId = renderer.regionDomId(region);
  const type = str(region.props, 'type');
  if (type === 'classicTree')
    renderer.diagnose(
      'info',
      `Classic tree ${region.id} is rendered with the treeView widget of the Tree region`,
      ctx.pageId,
      region.id,
    );
  if (str(region.props, 'settings.staticTreeId'))
    renderer.diagnose(
      'info',
      `Tree ${region.id}: the static tree ID is used as the widget ID only`,
      ctx.pageId,
      region.id,
    );
  const model = treeModel(renderer, ctx, region);
  if (model.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(model.error)}</div></div>`;
  ctx.jsFiles.add('#APEX_FILES#libraries/apex/#MIN_DIRECTORY#widget.treeView#MIN#.js?v=#APEX_VERSION#');
  const iconType = str(region.props, 'settings.iconTypeCssClass', 'a-Icon');
  const defaultIcon = str(region.props, 'settings.defaultIconCssClass', 'icon-tree-folder');
  const config = {
    region: domId,
    data: model.data,
    showRoot: model.showRoot,
    expanded: model.expanded,
    selected: model.selected ?? null,
    tooltip: model.tooltip,
    iconType,
    defaultIcon,
    doubleClick: str(region.props, 'settings.activateNodeLinkWith') === 'doubleClick',
  };
  const treeId = str(region.props, 'settings.staticTreeId') || `${domId}_tree`;
  const nodes = model.showRoot ? [model.data] : (model.data.children ?? []);
  const fallback = nodes.length
    ? `<ul>${nodes.map((entry) => markup(entry, iconType, defaultIcon, 1)).join('')}</ul>`
    : `<span class="nodatafound">${escapeHtml(str(region.props, 'messages.whenNoDataFound', 'no data found'))}</span>`;
  return `<div id="${escapeHtml(treeId)}" class="a-TreeView apex-local-tree" role="tree" data-apex-local-tree="${escapeHtml(JSON.stringify(config))}">${fallback}</div>`;
}

/** Ajax refresh of a tree region (the widget's `apex.server.plugin` call). */
export function treeRoute(
  renderer: ApexRenderer,
  session: Session,
  params: URLSearchParams,
  items: Record<string, string>,
): RouteResponse {
  const json = (body: unknown, status = 200): RouteResponse => ({
    status,
    type: 'json',
    body: JSON.stringify(body),
  });
  const page = params.get('page') ?? '';
  const regionId = params.get('region') ?? '';
  let ctx: RenderContext;
  try {
    for (const [name, item] of Object.entries(items)) session.items[name.toUpperCase()] = item;
    ctx = renderer.prepare(session, page);
  } catch (error) {
    return json({ error: (error as Error).message }, 404);
  }
  const region = renderer
    .pageComponents(ctx, 'region')
    .find((candidate) => renderer.regionDomId(candidate) === regionId || candidate.id === regionId);
  if (!region) return json({ error: `Region ${regionId} not found` }, 404);
  const model = treeModel(renderer, ctx, region);
  return json({
    data: model.data,
    showRoot: model.showRoot,
    navigation: true,
    hasIdentity: true,
    expanded: model.expanded,
  });
}
