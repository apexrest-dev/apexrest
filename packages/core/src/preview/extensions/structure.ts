import { registerExtension, type RouteRequest } from '../extensions.ts';
import { STRUCTURE_CSS, STRUCTURE_JS, STRUCTURE_MESSAGES } from './structure/client.ts';
import { translateHierarchy } from './structure/hierarchy.ts';
import {
  columnToggleReport,
  datePickerJquery,
  legacyCalendar,
  legacyChart,
  reflowReport,
  tabform,
  tabformAddRows,
  tabformDelete,
  tabformUpdate,
} from './structure/legacy.ts';
import { renderSearch, searchRoute } from './structure/search.ts';
import { renderTree, treeRoute } from './structure/tree.ts';
import { LEGACY_PROCESSES, pageReports, runAfterHeader } from './structure/wizard.ts';

/**
 * Structure and navigation: tree regions on the genuine treeView widget (with `connect by`
 * hierarchies translated for SQLite), the Search region with search configurations, wizard and
 * legacy form processes, and legacy region types mapped onto the modern renderers.
 */

function body(request: RouteRequest): { items?: Record<string, string>; x02?: string } {
  try {
    const parsed = JSON.parse(request.body || '{}') as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as { items?: Record<string, string>; x02?: string })
      : {};
  } catch {
    return {};
  }
}

registerExtension({
  name: 'structure',
  regions: {
    tree: renderTree,
    classicTree: renderTree,
    search: renderSearch,
    reflowReport,
    columnToggleReport,
    tabform,
    legacyCalendar,
    simpleChart: legacyChart,
    svgChart: legacyChart,
  },
  items: {
    datePickerJquery,
    stopAndStartGridLayout: () => '',
  },
  processes: { ...LEGACY_PROCESSES, tabformUpdate, tabformDelete, tabformAddRows },
  regionSql: (renderer, ctx, region, sql) => {
    // Oracle runs CONNECT BY itself.
    if (renderer.data.dialect === 'oracle') return undefined;
    const result = translateHierarchy(sql);
    if (result.unsupported)
      renderer.diagnose(
        'warning',
        `Region ${region.id}: hierarchical query not translated (${result.unsupported})`,
        ctx.pageId,
        region.id,
      );
    else if (result.sql !== sql)
      renderer.diagnose(
        'info',
        `Region ${region.id}: CONNECT BY query runs as a SQLite recursive CTE`,
        ctx.pageId,
        region.id,
      );
    return result.sql === sql ? undefined : result.sql;
  },
  point: (renderer, ctx, point) => {
    if (point === 'afterHeader') runAfterHeader(renderer, ctx);
    if (point === 'afterSubmit') pageReports(renderer, ctx);
    return undefined;
  },
  routes: {
    tree: (renderer, session, request) =>
      treeRoute(renderer, session, request.params, body(request).items ?? {}),
    search: (renderer, session, request) => searchRoute(renderer, session, request.params, body(request)),
  },
  client: `apex.lang.addMessages(${JSON.stringify(STRUCTURE_MESSAGES)});\n${STRUCTURE_JS}`,
  css: STRUCTURE_CSS,
});
