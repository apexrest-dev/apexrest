import { bool, get, str, type ApxComponent } from '../apexlang.ts';
import { registerExtension, type RegionParts } from '../extensions.ts';
import type { Row } from '../database.ts';
import type { ApexRenderer, RenderContext } from '../render.ts';
import { escapeHtml, fill, text } from '../theme.ts';
import { registerNamedTemplates } from './components/directives.ts';
import { componentIndex } from './components/plugins.ts';
import {
  renderTemplateComponentColumn,
  renderTemplateComponentRegion,
  wrapRegionOnly,
} from './components/template-component.ts';

/**
 * Universal Theme components and region behaviors: theme template components, the template
 * directive engine for `{with/}{apply/}` composition, sub-region templates (Tabs, Carousel),
 * Region Display Selector, Static Content settings, Help Text and URL regions, region template
 * JavaScript/CSS files, and the Open/Close Region dynamic actions for inline dialogs and popups.
 */

/** Body HTML a region renderer produced, so `wrapRegion` can move the region components above it. */
const bodies = new WeakMap<ApxComponent, string>();

function staticContent(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const source = str(region.props, 'source.htmlCode') || str(region.props, 'source.text');
  const outputAs = str(region.props, 'settings.outputAs', 'html');
  if (bool(region.props, 'settings.expandShortcuts', false))
    renderer.diagnose(
      'info',
      `Region ${region.id}: shortcuts are not expanded locally`,
      ctx.pageId,
      region.id,
    );
  let html: string;
  if (outputAs === 'text') {
    // "Text (escape special characters)": substitutions are escaped together with the text.
    html = escapeHtml(renderer.substitute(ctx.session, source, ctx.page, 'RAW'));
    if (bool(region.props, 'settings.showLineBreaks', true)) html = html.replace(/\r?\n/gu, '<br>');
  } else html = renderer.substitute(ctx.session, source, ctx.page, 'RAW');
  bodies.set(region, html);
  return html;
}

function helpText(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const own = str(region.props, 'source.htmlCode') || str(region.props, 'source.text');
  const help = own || str(ctx.page.props, 'help.helpText');
  if (!help) return '<p>No help is available for this page.</p>';
  return renderer.substitute(ctx.session, help, ctx.page, 'RAW');
}

function url(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const target = str(region.props, 'source.url') || str(region.props, 'settings.url');
  renderer.diagnose(
    'info',
    `URL region ${region.id} is not fetched locally; a placeholder links to the address`,
    ctx.pageId,
    region.id,
  );
  const href = renderer.substitute(ctx.session, target, ctx.page, 'RAW');
  return `<div class="apex-local-unsupported"><span class="fa fa-globe" aria-hidden="true"></span> URL region “${escapeHtml(str(region.props, 'name', region.id))}”${href ? `: <a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(href)}</a>` : ''}</div>`;
}

/** Native Region Display Selector: tabs for regions marked `advanced.regionDisplaySelector`. */
function regionDisplaySelector(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const domId = renderer.regionDomId(region);
  const targets = renderer
    .pageComponents(ctx, 'region')
    .filter(
      (candidate) =>
        candidate !== region &&
        bool(candidate.props, 'advanced.regionDisplaySelector', false) &&
        renderer.visible(ctx, candidate),
    )
    .sort(
      (a, b) => Number(get(a.props, 'layout.sequence') ?? 0) - Number(get(b.props, 'layout.sequence') ?? 0),
    );
  // settings.mode: viewSingleRegion (STANDARD, default) or scrollWindow (JUMP); Show All exists only in
  // STANDARD mode.
  const jump = str(region.props, 'settings.mode', 'viewSingleRegion') === 'scrollWindow';
  const includeShowAll = !jump && bool(region.props, 'settings.includeShowAll', true);
  const tab = (id: string, label: string, first: boolean) =>
    `<li class="apex-rds-item${first ? ' apex-rds-first' : ''}" role="presentation" id="${escapeHtml(id)}_tab"><a class="a-RDS-link" href="#${escapeHtml(id)}" role="tab" aria-controls="${escapeHtml(id)}" aria-selected="false" tabindex="-1"><span class="a-RDS-icon a-Icon " aria-hidden="true"></span><span class="a-RDS-label">${label}</span></a></li>`;
  const tabs = [
    ...(includeShowAll ? [tab('SHOW_ALL', 'Show All', true)] : []),
    ...targets.map((target, index) =>
      tab(
        renderer.regionDomId(target),
        renderer.substitute(
          ctx.session,
          str(target.props, 'title', str(target.props, 'name', target.id)),
          ctx.page,
          'HTML',
        ),
        !includeShowAll && index === 0,
      ),
    ),
  ];
  // settings.rememberSelection: byUser (default; a server-side preference in APEX, kept for the browser
  // session locally), bySession, or false.
  const remember = str(region.props, 'settings.rememberSelection', 'byUser');
  ctx.jsFiles.add('#APEX_FILES#libraries/apex/#MIN_DIRECTORY#widget.apexTabs#MIN#.js?v=#APEX_VERSION#');
  ctx.onload.push(
    `apex.widget.regionDisplaySelector(${JSON.stringify(domId)},${JSON.stringify({
      mode: jump ? 'jump' : 'standard',
      useSlider: bool(region.props, 'settings.useSlider', true),
      useSessionStorage: remember !== 'false' && remember !== 'N',
    })});`,
  );
  if (!targets.length)
    renderer.diagnose(
      'info',
      `Region Display Selector ${region.id} has no regions to select`,
      ctx.pageId,
      region.id,
    );
  return `<div class="apex-rds-container"><ul class="apex-rds a-Tabs is-disabled" id="${escapeHtml(domId)}_RDS" role="tablist">${tabs.join('')}</ul></div>`;
}

/** A View Single Region (standard mode) selector hides the regions that are not selected. */
const hasStandardSelector = (renderer: ApexRenderer, ctx: RenderContext) =>
  renderer
    .pageComponents(ctx, 'region')
    .some(
      (region) =>
        str(region.props, 'type') === 'regionDisplaySelector' &&
        str(region.props, 'settings.mode', 'viewSingleRegion') !== 'scrollWindow',
    );

function wrapRegion(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent, parts: RegionParts) {
  const { template, values, children } = parts;
  registerNamedTemplates(componentIndex(renderer.assets.theme).named);
  // Region templates such as Tabs Container and Carousel Container load their own widgets.
  for (const file of text(template, 'javascript_file_urls').split('\n').filter(Boolean))
    ctx.jsFiles.add(file);
  for (const file of text(template, 'css_file_urls').split('\n').filter(Boolean)) ctx.cssFiles.add(file);
  const type = str(region.props, 'type');
  if (type.startsWith('themeTemplateComponent/')) {
    const html = wrapRegionOnly(renderer, ctx, region, values, children);
    if (html !== undefined) return html;
  }
  // Image, Hero and Login templates: alt text, image attributes and the advanced region image.
  const substitute = (path: string, escape: 'HTML' | 'RAW') =>
    renderer.substitute(ctx.session, str(region.props, path), ctx.page, escape);
  values.REGION_IMAGE_ALT_TEXT ||= escapeHtml(substitute('image.accessibleDescription', 'RAW'));
  values.REGION_IMAGE_ATTRIBUTES ||=
    substitute('image.customAttributes', 'RAW') || substitute('advanced.imageTagAttributes', 'RAW');
  const advancedImage = substitute('advanced.regionImage', 'RAW');
  if (!values.REGION_IMAGE_URL && advancedImage) {
    values.REGION_IMAGE_URL = escapeHtml(advancedImage);
    values.REGION_IMAGE = fill(text(template, 'image_template'), {
      REGION_IMAGE_URL: values.REGION_IMAGE_URL,
    });
  }
  // Regions shown by a View Single Region selector; the widget toggles apex-rds-element-selected. In
  // Scroll Window mode every region stays visible.
  if (bool(region.props, 'advanced.regionDisplaySelector', false) && hasStandardSelector(renderer, ctx))
    values.REGION_CSS_CLASSES = `${values.REGION_CSS_CLASSES ?? ''} apex-rds-region`.trim();
  // apexTabs scopes the remembered tab by the closest .apex-tabs-region id.
  if (type === 'regionDisplaySelector')
    values.REGION_CSS_CLASSES = `${values.REGION_CSS_CLASSES ?? ''} apex-tabs-region`.trim();
  const body = bodies.get(region);
  if (
    body &&
    str(region.props, 'appearance.renderComponents') === 'aboveContent' &&
    values.BODY?.startsWith(body)
  )
    values.BODY = values.BODY.slice(body.length) + body;
  const sub = text(template, 'sub_plug_template');
  const own = children.get('SUB_REGIONS');
  if (sub && children.get('BODY')?.length)
    renderer.diagnose(
      'info',
      `Sub-regions of ${region.id} are in the region body slot; only the template's sub-region slot (e.g. tabs, slides) becomes tabs or slides`,
      ctx.pageId,
      region.id,
    );
  if (!sub || !own?.length) return undefined;
  // Each sub-region is wrapped individually (no grid) so the theme widget can build tabs/slides.
  values.SUB_REGIONS = own
    .map(({ component, html }) =>
      fill(sub, {
        SUB_REGION_TITLE: renderer.substitute(
          ctx.session,
          str(component.props, 'title', str(component.props, 'name', component.id)),
          ctx.page,
          'HTML',
        ),
        SUB_REGION_ID: renderer.regionDomId(component),
        SUB_REGION: html,
      }),
    )
    .join('\n');
  return fill(text(template, 'template'), values);
}

const CLIENT = String.raw`
(function ($) {
  "use strict";
  // Open Region / Close Region dynamic actions (inline dialog, drawer and popup regions).
  function regionAction(action) {
    var method = action.action === "openRegion" ? "openRegion" : "closeRegion";
    action.action = "executeJsCode";
    action.settings = { jsCode: "this.affectedElements.each(function(){ apex.theme." + method + "(this.id || $(this)); });" };
  }
  var init = apexLocal.init;
  apexLocal.init = function (config) {
    (config.dynamicActions || []).forEach(function (da) {
      (da.actions || []).forEach(function (action) {
        if (action.action === "openRegion" || action.action === "closeRegion") regionAction(action);
      });
    });
    return init.apply(this, arguments);
  };
  // Template component action menus after a region refresh.
  $(document).on("apexafterrefresh", function (event) {
    $("[data-apex-local-menu]", event.target).each(function () {
      if (!$(this).hasClass("a-Menu")) $(this).menu({ owningRegion: event.target.id });
    });
  });
})(apex.jQuery);
`;

registerExtension({
  name: 'components',
  regions: {
    themeTemplateComponent: (renderer, ctx, region) => renderTemplateComponentRegion(renderer, ctx, region),
    staticContent,
    helpText,
    url,
    regionDisplaySelector,
  },
  columns: {
    themeTemplateComponent: (renderer, ctx, region, column, row) =>
      renderTemplateComponentColumn(renderer, ctx, region, column, row as Row),
  },
  wrapRegion,
  page(renderer, ctx) {
    // `fill` (region, list and page templates) resolves {apply THEME$…/} from the current theme.
    registerNamedTemplates(componentIndex(renderer.assets.theme).named);
    // The APEX engine turns `js-hidden` (inline dialogs, drawers, popups) into inline display:none.
    ctx.onload.unshift('apex.util.applySafeHidden();');
  },
  client: CLIENT,
  css: '.apex-local-tc-pagination{display:flex;justify-content:center;padding:8px 0}',
});
