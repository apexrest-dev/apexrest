import { bool, get, num, ref, str, type ApxComponent } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { applyEscape, escapeHtml } from '../../theme.ts';
import { strings } from './model.ts';

/** `&COLUMN.` / `&COLUMN!FILTER.` from the row first, then session state and built-ins. */
function rowSubstitute(renderer: ApexRenderer, ctx: RenderContext, template: string, row: Row): string {
  const upper = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toUpperCase(), value]));
  const replaced = template.replace(
    /&([A-Za-z][\w$#]*?)(?:!([A-Z]+))?\./gu,
    (whole, name: string, filter?: string) => {
      const key = name.toUpperCase();
      return key in upper ? applyEscape(String(upper[key] ?? ''), filter ?? 'HTML') : whole;
    },
  );
  return renderer.substitute(ctx.session, replaced, ctx.page, 'HTML');
}

const features = (region: ApxComponent) =>
  strings(region.props, 'settings.features').flatMap((value) => value.split(/[\s,:]+/u));

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
  const options = new Set(features(region));
  const column = (key: string) => str(region.props, `settings.${key}`).toUpperCase();
  const text = column('textColumn') || result.columns[0] || '';
  const format = str(region.props, 'settings.textFormatting');
  const target = get(region.props, 'settings.linkTarget') ?? get(region.props, 'link.target');
  let divider = '';
  const items = result.rows
    .map((row) => {
      const label =
        options.has('advancedFormatting') && format
          ? rowSubstitute(renderer, ctx, format, row)
          : escapeHtml(row[text] ?? '');
      const info = column('supplementalInformationColumn');
      const counter = column('counterColumn');
      const icon = column('iconClassColumn');
      const body = `${icon && row[icon] ? `<span class="ui-li-icon fa ${escapeHtml(row[icon])}" aria-hidden="true"></span>` : ''}${label}${info && row[info] !== null ? `<p class="ui-li-aside">${escapeHtml(row[info])}</p>` : ''}${counter && row[counter] !== null ? `<span class="ui-li-count">${escapeHtml(row[counter])}</span>` : ''}`;
      const dividerColumn = column('listDividerColumn');
      let heading = '';
      if (dividerColumn && String(row[dividerColumn] ?? '') !== divider) {
        divider = String(row[dividerColumn] ?? '');
        heading = `<li class="a-ListView-divider" role="heading">${escapeHtml(divider)}</li>`;
      }
      const href = target ? renderer.link(ctx, target, row, `apex.jQuery('#${domId}')`) : '';
      return `${heading}<li class="a-ListView-item${icon ? ' has-icon' : ''}${counter ? ' has-count' : ''}">${href ? `<a class="ui-btn" href="${escapeHtml(href)}">${body}</a>` : body}</li>`;
    })
    .join('');
  const search = options.has('search')
    ? `<div class="a-ListView-searchbar"><input type="search" class="apex-item-text" placeholder="Search..." aria-label="Search" data-apex-local-listview="${escapeHtml(domId)}"></div>`
    : '';
  const empty = result.rows.length
    ? ''
    : `<span class="nodatafound">${renderer.substitute(ctx.session, str(region.props, 'messages.whenNoDataFound', 'No data found.'), ctx.page, 'HTML')}</span>`;
  return `${search}<div id="${escapeHtml(domId)}_lv"><ul class="a-ListView${options.has('inset') ? ' a-ListView--inset' : ''}" id="${escapeHtml(domId)}_listview" data-role="listview">${items}</ul>${empty}</div>`;
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
