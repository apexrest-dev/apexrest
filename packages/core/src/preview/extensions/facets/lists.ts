import { bool, get, num, ref, str, type ApxComponent } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import { rowTemplate } from '../components/row-template.ts';
import { strings } from './model.ts';

/**
 * `settings.features` as APEXlang names (`enableSearch`, `insetList`, `showListDivider`,
 * `advancedFormatting`, `showImage`, ...); stored return values and the older short names are
 * accepted as aliases.
 */
const FEATURE_ALIASES: Record<string, string> = {
  search: 'enableSearch',
  inset: 'insetList',
  divider: 'showListDivider',
  listDivider: 'showListDivider',
  image: 'showImage',
  advanced: 'advancedFormatting',
  advanced_formatting: 'advancedFormatting',
  split_button: 'hasSplitButton',
  nested: 'isNestedListView',
};

export function listViewFeatures(region: ApxComponent): Set<string> {
  return new Set(
    strings(region.props, 'settings.features')
      .flatMap((value) => value.split(/[\s,:]+/u))
      .filter(Boolean)
      .map((value) => FEATURE_ALIASES[value] ?? FEATURE_ALIASES[value.toLowerCase()] ?? value),
  );
}

/** List View region (the jQuery Mobile-free `a-ListView` markup), with an optional search bar. */
export function renderListView(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const domId = renderer.regionDomId(region);
  const sql = renderer.regionSql(ctx, region);
  if (!sql)
    return `<div class="apex-local-unsupported">List View “${escapeHtml(str(region.props, 'name', region.id))}” has no local source.</div>`;
  const result = renderer.query(
    ctx,
    region,
    sql,
    num(region.props, 'reportLayout.numberOfRows', num(region.props, 'settings.numberOfRows', 1_000)),
  );
  ctx.onload.push(
    `apexLocalFacets.partRegion(${JSON.stringify(domId).replaceAll('<', '\\u003c')}, "_lv", "ListView");`,
  );
  if (result.error)
    return `<div class="t-Alert t-Alert--danger t-Alert--wizard"><div class="t-Alert-body">${escapeHtml(result.error)}</div></div>`;
  const options = listViewFeatures(region);
  const advanced = options.has('advancedFormatting');
  const setting = (key: string) => str(region.props, `settings.${key}`);
  const column = (...keys: string[]) => (keys.map((key) => setting(key)).find(Boolean) ?? '').toUpperCase();
  const html = (template: string, row: Row) => rowTemplate(renderer, ctx, template, row, true);
  const text = column('textColumn') || result.columns[0] || '';
  const target = get(region.props, 'settings.linkTarget') ?? get(region.props, 'link.target');
  const info = column('supplementalInfoColumn', 'supplementalInformationColumn');
  const counter = column('counterColumn');
  const icon = column('iconClassColumn');
  const imageType = setting('imageType');
  const imageUrl = column('imageUrlColumn');
  const dividerColumn = options.has('showListDivider') ? column('listDividerColumn') : '';
  let divider: string | undefined;
  const items = result.rows
    .map((row) => {
      const label =
        advanced && setting('textFormatting')
          ? html(setting('textFormatting'), row)
          : escapeHtml(row[text] ?? '');
      const supplemental =
        advanced && setting('supplementalInfoFormatting')
          ? html(setting('supplementalInfoFormatting'), row)
          : info && row[info] !== null && row[info] !== undefined
            ? escapeHtml(row[info])
            : '';
      let image = '';
      if (options.has('showImage') && /Url$/u.test(imageType) && imageUrl && row[imageUrl]) {
        const kind = imageType === 'iconUrl' ? 'ui-li-icon' : 'ui-li-thumb';
        image = `<img class="${kind}" src="${escapeHtml(row[imageUrl])}" alt="">`;
      } else if (icon && row[icon])
        image = `<span class="ui-li-icon fa ${escapeHtml(row[icon])}" aria-hidden="true"></span>`;
      const body = `${image}${label}${supplemental ? `<p class="ui-li-aside">${supplemental}</p>` : ''}${counter && row[counter] !== null ? `<span class="ui-li-count">${escapeHtml(row[counter])}</span>` : ''}`;
      let heading = '';
      if (dividerColumn && String(row[dividerColumn] ?? '') !== divider) {
        divider = String(row[dividerColumn] ?? '');
        const dividerHtml =
          advanced && setting('listDividerFormatting')
            ? html(setting('listDividerFormatting'), row)
            : escapeHtml(divider);
        heading = `<li class="a-ListView-divider" role="heading">${dividerHtml}</li>`;
      }
      const href = target ? renderer.link(ctx, target, row, `apex.jQuery('#${domId}')`) : '';
      const entryAttributes =
        advanced && setting('listEntryAttrs') ? ` ${html(setting('listEntryAttrs'), row)}` : '';
      return `${heading}<li class="a-ListView-item${image ? ' has-icon' : ''}${counter ? ' has-count' : ''}"${entryAttributes}>${href ? `<a class="ui-btn" href="${escapeHtml(href)}">${body}</a>` : body}</li>`;
    })
    .join('');
  const placeholder = renderer.substitute(
    ctx.session,
    setting('searchBoxPlaceholder') || 'Search...',
    ctx.page,
    'HTML',
  );
  const search = options.has('enableSearch')
    ? `<div class="a-ListView-searchbar"><input type="search" class="apex-item-text" placeholder="${placeholder}" aria-label="Search" data-apex-local-listview="${escapeHtml(domId)}"></div>`
    : '';
  const empty = result.rows.length
    ? ''
    : `<span class="nodatafound">${renderer.substitute(ctx.session, str(region.props, 'messages.whenNoDataFound', 'No data found.'), ctx.page, 'HTML')}</span>`;
  const listAttributes =
    advanced && setting('listAttrs')
      ? ` ${renderer.substitute(ctx.session, setting('listAttrs'), ctx.page, 'HTML')}`
      : '';
  return `${search}<div id="${escapeHtml(domId)}_lv"><ul class="a-ListView${options.has('insetList') ? ' a-ListView--inset' : ''}" id="${escapeHtml(domId)}_listview" data-role="listview"${listAttributes}>${items}</ul>${empty}</div>`;
}

/** Region Display Selector: the genuine apexTabs widget over the regions flagged for it. */
export function renderDisplaySelector(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
): string {
  const domId = renderer.regionDomId(region);
  const parent = ref(region.props, 'layout.parentRegion');
  const regions = renderer
    .pageComponents(ctx, 'region')
    .filter(
      (candidate) =>
        candidate !== region &&
        bool(candidate.props, 'advanced.regionDisplaySelector', false) &&
        ref(candidate.props, 'layout.parentRegion') === parent &&
        renderer.visible(ctx, candidate),
    )
    .sort((a, b) => num(a.props, 'layout.sequence', 0) - num(b.props, 'layout.sequence', 0));
  if (!regions.length) {
    renderer.diagnose(
      'info',
      `Region Display Selector ${region.id} has no regions with regionDisplaySelector: true`,
      ctx.pageId,
      region.id,
    );
    return '';
  }
  const mode = str(region.props, 'settings.mode', 'standard');
  const jump = /scroll|jump/iu.test(mode);
  const showAll = bool(region.props, 'settings.includeShowAll', !jump);
  const tab = (id: string, label: string, first: boolean) =>
    `<li class="apex-rds-item${first ? ' apex-rds-first' : ''}" role="presentation" id="${escapeHtml(id)}_tab"><a class="a-RDS-link" href="#${escapeHtml(id)}" role="tab" aria-controls="${escapeHtml(id)}"><span class="a-RDS-icon a-Icon " aria-hidden="true"></span><span class="a-RDS-label">${label}</span></a></li>`;
  const tabs = [
    showAll ? tab('SHOW_ALL', 'Show All', true) : '',
    ...regions.map((entry, index) =>
      tab(
        renderer.regionDomId(entry),
        escapeHtml(
          renderer.substitute(
            ctx.session,
            str(entry.props, 'title') || str(entry.props, 'name', entry.id),
            ctx.page,
            'RAW',
          ),
        ),
        !showAll && index === 0,
      ),
    ),
  ].join('');
  ctx.jsFiles.add('#APEX_FILES#libraries/apex/#MIN_DIRECTORY#widget.apexTabs#MIN#.js?v=#APEX_VERSION#');
  const options = {
    mode: jump ? 'jump' : 'standard',
    useSlider: true,
    useLocationHash: false,
    useSessionStorage: bool(region.props, 'settings.rememberLastSelection', true),
  };
  ctx.onload.push(`apex.widget.regionDisplaySelector('${domId}', ${JSON.stringify(options)});`);
  return `<div class="apex-rds-container"><ul class="apex-rds is-disabled" id="${escapeHtml(domId)}_RDS" role="tablist">${tabs}</ul></div>`;
}
