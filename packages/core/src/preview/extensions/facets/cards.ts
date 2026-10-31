import { bool, get, isObject, num, str, type ApxComponent, type ApxObject } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { applyDirectives, applyEscape, escapeHtml } from '../../theme.ts';
import { strings } from './model.ts';

/**
 * Cards region with the genuine `a-CardView` markup of the native Cards plug-in
 * (rendered on the server instead of by tableModelView).
 */

const KNOWN_GROUPS = new Set([
  'title',
  'subtitle',
  'body',
  'secondaryBody',
  'iconAndBadge',
  'media',
  'card',
  'componentAppearance',
  'pagination',
  'orderBy',
  'source',
  'layout',
  'appearance',
  'messages',
  'serverSideCondition',
  'advanced',
  'accessibility',
  'config',
  'security',
  'help',
  'comments',
  'performance',
  'name',
  'type',
]);

/** `#COLUMN#` placeholders (with `!RAW`/`!HTML`/... filters) and `{if/}` directives over a row. */
export function rowTemplate(
  renderer: ApexRenderer,
  ctx: RenderContext,
  template: string,
  row: Row,
  escape: boolean,
): string {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) values[key.toUpperCase()] = String(value ?? '');
  const substituted = renderer.substitute(ctx.session, template, ctx.page, 'HTML');
  return applyDirectives(substituted, values).replace(
    /#([A-Z][A-Z0-9_$]*)(?:!([A-Z]+))?#/gu,
    (whole, name: string, filter?: string) => {
      if (!(name in values)) return whole;
      if (filter) return applyEscape(values[name]!, filter);
      return escape ? escapeHtml(values[name]) : values[name]!;
    },
  );
}

/** Two-letter initials the way APEX computes them for card icons. */
export function initials(value: string): string {
  const words = value
    .trim()
    .split(/[\s._@-]+/u)
    .filter(Boolean);
  if (!words.length) return '';
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : words[0]!.slice(0, 2);
  return letters.toUpperCase();
}

interface CardAction {
  position: string;
  label: string;
  component: ApxComponent;
}

/** Action positions by their normalized APEXlang name. */
function position(value: string): string {
  return value.replace(/[^a-z]/giu, '').toLowerCase();
}

export function renderCards(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const domId = renderer.regionDomId(region);
  const props = region.props;
  for (const key of Object.keys(props))
    if (!KNOWN_GROUPS.has(key))
      renderer.diagnose('info', `Cards ${region.id}: ${key} is not simulated`, ctx.pageId, region.id);
  let sql = renderer.regionSql(ctx, region);
  if (!sql)
    return `<div class="apex-local-unsupported">Cards “${escapeHtml(str(props, 'name', region.id))}” have no local source.</div>`;
  const order = orderBy(renderer, ctx, region);
  if (order.clause) sql = `select * from (${sql}) order by ${order.clause}`;
  const result = renderer.query(ctx, region, sql);
  // Refreshes replace only the cards view so the order-by item and region chrome stay in place.
  ctx.onload.push(`apexLocalFacets.cardsRegion(${JSON.stringify(domId).replaceAll('<', '\\u003c')});`);
  if (result.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(result.error)}</div></div>`;

  const paginationType = str(props, 'pagination.type', 'scroll');
  const perPage = Math.max(1, num(props, 'pagination.cardsPerPage', paginationType === 'page' ? 15 : 20));
  const pageNumber = Math.max(1, ctx.session.pagination[`${ctx.pageId}:${region.id}`] ?? 1);
  const scroll = paginationType !== 'page';
  const first = scroll ? 0 : (pageNumber - 1) * perPage;
  const rows = result.rows.slice(first, pageNumber * perPage);

  const layout = str(props, 'componentAppearance.layout', 'grid');
  const columns = str(props, 'componentAppearance.gridColumns');
  const listClass =
    layout === 'float'
      ? 'a-CardView-items--float'
      : layout === 'horizontal'
        ? 'a-CardView-items--row'
        : `a-CardView-items--grid${columns ? ` a-CardView-items--grid${columns}col` : ''}`;
  const actions: CardAction[] = region.children
    .filter((child) => child.type === 'action' && renderer.condition(ctx, child.props))
    .sort((a, b) => num(a.props, 'layout.sequence', 0) - num(b.props, 'layout.sequence', 0))
    .map((component) => ({
      component,
      position: position(str(component.props, 'position')),
      label: str(component.props, 'label'),
    }));
  for (const action of actions)
    if (str(action.component.props, 'serverSideCondition.executeCondition') === 'forEachRow')
      renderer.diagnose(
        'info',
        `Cards ${region.id}: per-row action conditions are evaluated once locally`,
        ctx.pageId,
        region.id,
      );
  const cards = rows.map((row) => renderCard(renderer, ctx, region, row, actions)).join('\n');
  const noData = renderer.substitute(
    ctx.session,
    str(props, 'messages.whenNoDataFound', 'No data found'),
    ctx.page,
    'HTML',
  );
  const total = result.rows.length;
  const shown = first + rows.length;
  let footer = '';
  if (!scroll && total > perPage) {
    const button = (target: number, icon: string, label: string, disabled: boolean) =>
      `<button type="button" class="a-TMV-pageButton a-TMV-pageButton--nav a-Button" title="${label}" aria-label="${label}"${disabled ? ' disabled' : ` data-apex-local-cards-page="${target}" data-region="${escapeHtml(domId)}"`}><span class="a-Icon ${icon}" aria-hidden="true"></span></button>`;
    footer = `<div class="a-TMV-footer"><div class="a-TMV-pagination" role="region" aria-label="Pagination">${button(pageNumber - 1, 'icon-prev', 'Previous', pageNumber <= 1)}<span class="a-TMV-pageRange">${first + 1} - ${shown}${bool(props, 'pagination.showTotalCount', true) ? ` of ${total}` : ''}</span>${button(pageNumber + 1, 'icon-next', 'Next', shown >= total)}</div></div>`;
  } else if (scroll && shown < total) {
    footer = `<div class="a-TMV-loadMore"><button type="button" class="a-Button js-load a-TMV-loadMoreButton" data-apex-local-cards-page="${pageNumber + 1}" data-region="${escapeHtml(domId)}">Load More</button></div>`;
  }
  const orderAttribute = order.item ? ` data-apex-local-orderby="${escapeHtml(order.item)}"` : '';
  const body = rows.length
    ? `<ul class="a-CardView-items ${listClass}" role="list">${cards}</ul>`
    : `<div class="a-TMV-altMessage a-TMV-noDataMessage" role="region"><div class="a-TMV-altMessage-icon" aria-hidden="true"><span class="a-Icon icon-irr-no-results"></span></div><div role="status"><span class="a-TMV-altMessage-text">${noData}</span></div></div>`;
  return `<div class="a-TMV a-TMV--cards" id="${escapeHtml(domId)}_cards" data-region="${escapeHtml(domId)}"${orderAttribute}><div class="a-TMV-body"><div class="a-TMV-w-scroll">${body}</div></div>${footer}</div>`;
}

/** `orderBy { type: item, item: { itemName, orderBys } }` or a static `orderByClause`. */
function orderBy(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
): { clause: string; item?: string } {
  const props = region.props;
  const type = str(props, 'orderBy.type');
  const item = get(props, 'orderBy.item');
  if ((type === 'item' || (!type && isObject(item))) && isObject(item)) {
    const name = str(item, 'itemName').toUpperCase();
    const choices = get(item, 'orderBys');
    const selected = ctx.session.items[name] ?? '';
    let clause = '';
    if (isObject(choices)) {
      const key = Object.keys(choices).find((entry) => entry.toUpperCase() === selected.toUpperCase());
      const fallback = Object.keys(choices)[0];
      const chosen = key ?? fallback;
      clause = chosen ? String((choices as ApxObject)[chosen] ?? '') : '';
    }
    return { clause, ...(name ? { item: name } : {}) };
  }
  return { clause: str(props, 'orderBy.orderByClause') };
}

function part(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  group: string,
  row: Row,
  escape: boolean,
): { html: string; css: string } {
  const props = region.props;
  const css = strings(props, `${group}.cssClasses`).join(' ');
  if (bool(props, `${group}.advancedFormatting`, false))
    return { html: rowTemplate(renderer, ctx, str(props, `${group}.htmlExpression`), row, escape), css };
  const column = str(props, `${group}.column`).toUpperCase();
  return { html: column && column in row ? escapeOrNot(row[column], escape) : '', css };
}

const escapeOrNot = (value: unknown, escape: boolean) =>
  escape ? escapeHtml(value ?? '') : String(value ?? '');

const urlOf = (renderer: ApexRenderer, ctx: RenderContext, template: string, row: Row) =>
  rowTemplate(renderer, ctx, template, row, false);

function actionHref(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  action: ApxComponent,
  row: Row,
) {
  const props = action.props;
  const type = str(props, 'behavior.type', 'redirectThisApp');
  if (type === 'redirectUrl' || str(props, 'behavior.targetUrl'))
    return urlOf(renderer, ctx, str(props, 'behavior.targetUrl'), row);
  if (type === 'triggerAction') {
    renderer.diagnose(
      'info',
      `Card action ${action.id} triggers an action; not simulated`,
      ctx.pageId,
      region.id,
    );
    return '#';
  }
  const target = get(props, 'behavior.target') ?? get(props, 'link.target');
  return renderer.link(ctx, target, row, `apex.jQuery('#${renderer.regionDomId(region)}')`);
}

function renderCard(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  row: Row,
  actions: CardAction[],
): string {
  const props = region.props;
  const escape = bool(props, 'security.escapeSpecialChars', true);
  const title = part(renderer, ctx, region, 'title', row, escape);
  const subtitle = part(renderer, ctx, region, 'subtitle', row, escape);
  const body = part(renderer, ctx, region, 'body', row, escape);
  const secondary = part(renderer, ctx, region, 'secondaryBody', row, escape);
  const at = (where: string) => actions.filter((action) => action.position === where);
  const linkAttributes = (action: CardAction) => {
    const attributes = str(action.component.props, 'behavior.linkAttributes');
    return attributes ? ` ${rowTemplate(renderer, ctx, attributes, row, true)}` : '';
  };
  const wrap = (where: string, html: string) => {
    const action = at(where)[0];
    if (!action || !html) return html;
    return `<a href="${escapeHtml(actionHref(renderer, ctx, region, action.component, row))}"${linkAttributes(action)}>${html}</a>`;
  };
  const classes = ['a-CardView'];

  // Icon
  const iconSource = str(props, 'iconAndBadge.iconSource');
  let icon = '';
  if (iconSource) {
    const iconColumn = str(props, 'iconAndBadge.iconColumn').toUpperCase();
    const iconCss = rowTemplate(renderer, ctx, str(props, 'iconAndBadge.iconCssClasses'), row, true);
    const description = rowTemplate(renderer, ctx, str(props, 'iconAndBadge.iconDescription'), row, true);
    const label = description ? ` role="img" aria-label="${description}"` : ' aria-hidden="true"';
    if (iconSource === 'initials')
      icon = `<span class="a-CardView-initials u-color${iconCss ? ` ${iconCss}` : ''}"${label}>${escapeHtml(initials(String(row[iconColumn] ?? '')))}</span>`;
    else if (iconSource === 'iconClass' || iconSource === 'iconClassColumn') {
      const classesValue = iconSource === 'iconClass' ? iconCss : String(row[iconColumn] ?? '');
      const fa = /(^|\s)fa-/u.test(classesValue) && !/(^|\s)fa(\s|$)/u.test(classesValue) ? 'fa ' : '';
      icon = `<span class="a-CardView-icon u-color ${escapeHtml(fa + classesValue)}"${label}></span>`;
    } else if (iconSource === 'imageUrl')
      icon = `<img class="a-CardView-iconImg" src="${escapeHtml(urlOf(renderer, ctx, str(props, 'iconAndBadge.imageUrl'), row))}" alt="${description}">`;
    else {
      renderer.diagnose('info', `Cards ${region.id}: BLOB icons are not simulated`, ctx.pageId, region.id);
      icon = `<span class="a-CardView-icon u-color fa fa-image"${label}></span>`;
    }
    classes.push('has-icon');
  }
  const iconPosition = str(props, 'iconAndBadge.iconPosition', 'start');
  const iconWrap = icon
    ? `<div class="a-CardView-iconWrap${iconPosition === 'top' ? ' a-CardView-iconWrap--top' : iconPosition === 'end' ? ' a-CardView-iconWrap--end' : ''}">${icon}</div>`
    : '';

  // Badge
  const badgeColumn = str(props, 'iconAndBadge.badgeColumn').toUpperCase();
  let badge = '';
  if (badgeColumn && row[badgeColumn] !== null && row[badgeColumn] !== undefined && row[badgeColumn] !== '') {
    const badgeLabel = rowTemplate(renderer, ctx, str(props, 'iconAndBadge.badgeLabel'), row, true);
    const badgeCss = strings(props, 'iconAndBadge.badgeCssClasses').join(' ');
    badge = `<div class="a-CardView-badge${badgeCss ? ` ${escapeHtml(badgeCss)}` : ''}">${badgeLabel ? `<span class="a-CardView-badgeLabel">${badgeLabel}</span>` : ''}<span class="a-CardView-badgeValue">${escapeOrNot(row[badgeColumn], escape)}</span></div>`;
    classes.push('has-badge');
  }

  // Media
  let media = '';
  const mediaCss = strings(props, 'media.cssClasses').join(' ');
  const mediaPosition = str(props, 'media.position', 'first');
  if (bool(props, 'media.advancedFormatting', false)) {
    const html = rowTemplate(renderer, ctx, str(props, 'media.htmlExpression'), row, escape);
    if (html)
      media = `<div class="a-CardView-media a-CardView-media--${mediaPosition} ${escapeHtml(mediaCss)}">${wrap('media', html)}</div>`;
  } else {
    const source = str(props, 'media.source');
    let url = '';
    if (source === 'imageUrl') url = urlOf(renderer, ctx, str(props, 'media.url'), row);
    else if (source === 'urlColumn') url = String(row[str(props, 'media.urlColumn').toUpperCase()] ?? '');
    else if (source === 'blobColumn')
      renderer.diagnose('info', `Cards ${region.id}: BLOB media is not simulated`, ctx.pageId, region.id);
    if (url) {
      const alt = rowTemplate(renderer, ctx, str(props, 'media.imageDescription'), row, true);
      const appearance = str(props, 'media.appearance', 'widescreen');
      const sizing = str(props, 'media.sizing', 'cover');
      media = `<div class="a-CardView-media a-CardView-media--${mediaPosition} a-CardView-media--${appearance} a-CardView-media--${sizing}${mediaCss ? ` ${escapeHtml(mediaCss)}` : ''}">${wrap('media', `<img class="a-CardView-mediaImg" src="${escapeHtml(url)}" alt="${alt}" loading="lazy">`)}</div>`;
    }
  }
  if (media) classes.push('has-media', `has-media--${mediaPosition}`);

  // Header
  const titleAction = at('title')[0];
  const titleHtml = title.html
    ? `<h3 class="a-CardView-title${title.css ? ` ${escapeHtml(title.css)}` : ''}">${
        titleAction
          ? `<a class="a-CardView-titleLink" href="${escapeHtml(actionHref(renderer, ctx, region, titleAction.component, row))}"${linkAttributes(titleAction)}>${title.html}</a>`
          : title.html
      }</h3>`
    : '';
  if (title.html) classes.push('has-title');
  const subtitleHtml = subtitle.html
    ? `<h4 class="a-CardView-subTitle${subtitle.css ? ` ${escapeHtml(subtitle.css)}` : ''}">${wrap('subtitle', subtitle.html)}</h4>`
    : '';
  if (subtitle.html) classes.push('has-subtitle');
  const header =
    iconWrap || titleHtml || subtitleHtml || badge
      ? `<div class="a-CardView-header">${iconPosition === 'end' ? '' : iconWrap}<div class="a-CardView-headerBody">${titleHtml}${subtitleHtml}</div>${badge}${iconPosition === 'end' ? iconWrap : ''}</div>`
      : '';

  // Body
  const bodyHtml =
    body.html || secondary.html
      ? `<div class="a-CardView-body">${body.html ? `<div class="a-CardView-mainContent${body.css ? ` ${escapeHtml(body.css)}` : ''}">${wrap('body', body.html)}</div>` : ''}${secondary.html ? `<div class="a-CardView-subContent${secondary.css ? ` ${escapeHtml(secondary.css)}` : ''}">${wrap('secondarybody', secondary.html)}</div>` : ''}</div>`
      : '';
  if (body.html) classes.push('has-body');
  if (secondary.html) classes.push('has-secondary');

  // Buttons
  const button = (action: CardAction, hotDefault: boolean) => {
    const actionProps = action.component.props;
    const display = str(actionProps, 'appearance.displayType', 'text');
    const iconValue = str(actionProps, 'appearance.icon');
    const iconClass =
      /(^|\s)fa-/u.test(iconValue) && !/(^|\s)fa(\s|$)/u.test(iconValue) ? `fa ${iconValue}` : iconValue;
    const label = escapeHtml(rowTemplate(renderer, ctx, action.label, row, false));
    const disabled = bool(actionProps, 'appearance.showAsDisabled', false);
    const css = [
      'a-CardView-button',
      bool(actionProps, 'appearance.hot', hotDefault) ? 'a-CardView-button--hot' : '',
      ...strings(actionProps, 'appearance.cssClasses'),
    ]
      .filter(Boolean)
      .join(' ');
    const inner = `${display !== 'text' && iconClass ? `<span class="a-CardView-buttonIcon ${escapeHtml(iconClass)}" aria-hidden="true"></span>` : ''}${display !== 'icon' ? `<span class="a-CardView-buttonLabel">${label}</span>` : ''}`;
    return disabled
      ? `<button type="button" class="${escapeHtml(css)}" disabled${display === 'icon' ? ` title="${label}" aria-label="${label}"` : ''}>${inner}</button>`
      : `<a class="${escapeHtml(css)}" href="${escapeHtml(actionHref(renderer, ctx, region, action.component, row))}"${display === 'icon' ? ` title="${label}" aria-label="${label}"` : ''}${linkAttributes(action)}>${inner}</a>`;
  };
  const primary = at('primary')
    .map((action) => button(action, false))
    .join('');
  const secondaryButtons = at('secondary')
    .map((action) => button(action, false))
    .join('');
  const actionsHtml =
    primary || secondaryButtons
      ? `<div class="a-CardView-actions"><div class="a-CardView-actionsPrimary">${primary}</div><div class="a-CardView-actionsSecondary">${secondaryButtons}</div></div>`
      : '';
  if (actionsHtml) classes.push('has-actions');
  const full = at('fullcard')[0] ?? at('card')[0];
  const fullLink = full
    ? `<a class="a-CardView-fullLink" href="${escapeHtml(actionHref(renderer, ctx, region, full.component, row))}"${linkAttributes(full)} aria-label="${escapeHtml(title.html.replace(/<[^>]*>/gu, ''))}"></a>`
    : '';
  if (full) classes.push('has-actions--full');
  for (const action of actions)
    if (
      ![
        'title',
        'subtitle',
        'body',
        'secondarybody',
        'media',
        'primary',
        'secondary',
        'fullcard',
        'card',
      ].includes(action.position)
    )
      renderer.diagnose(
        'info',
        `Cards ${region.id}: action position ${str(action.component.props, 'position')} is not simulated`,
        ctx.pageId,
        region.id,
      );
  classes.push(...strings(props, 'card.cssClasses'));
  const key = str(props, 'card.primaryKeyColumn1').toUpperCase();
  const dataId = key && key in row ? ` data-id="${escapeHtml(row[key] ?? '')}"` : '';
  const before = mediaPosition === 'first' || mediaPosition === 'background' ? media : '';
  const inBody = mediaPosition === 'body' ? media : '';
  return `<li class="a-CardView-item"${dataId}><div class="${escapeHtml(classes.join(' '))}">${before}${header}${inBody}${bodyHtml}${actionsHtml}${fullLink}</div></li>`;
}
