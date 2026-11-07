import { isObject, str, type ApxApplication, type ApxComponent, type ApxObject } from './apexlang.ts';

/**
 * Source features that the preview reads but never runs, found statically so that `start`,
 * `check` and `status` report them before anyone relies on the local rendering. A page that
 * looks right in the preview can still differ on APEX where one of these applies.
 */
export interface LocalGap {
  pageId: string;
  component: string;
  property: string;
  file: string;
  line: number;
  message: string;
}

const NOT_APPLIED = new Set(['initJavaScriptFunction']);

function properties(props: ApxObject, prefix = ''): string[] {
  return Object.entries(props).flatMap(([key, value]) => {
    const dotted = prefix ? `${prefix}.${key}` : key;
    if (NOT_APPLIED.has(key) && value !== undefined && value !== '') return [dotted];
    return isObject(value) ? properties(value, dotted) : [];
  });
}

function collect(pageId: string, component: ApxComponent, into: LocalGap[]): void {
  for (const property of properties(component.props))
    into.push({
      pageId,
      component: `${component.type} ${component.id}`,
      property,
      file: component.file,
      line: component.line,
      message: `Page ${pageId}, ${component.type} ${component.id}: ${property} does not run in the local preview; check its effect (formats, axes, tooltips, widget options) on the imported application.`,
    });
  for (const child of component.children) collect(pageId, child, into);
}

export function localGaps(app: ApxApplication): LocalGap[] {
  const gaps: LocalGap[] = [];
  for (const [pageId, page] of [...app.pages.entries()].sort((a, b) => Number(a[0]) - Number(b[0])))
    collect(pageId, page, gaps);
  return gaps;
}

/**
 * A region's initialization JavaScript function. The 26.2 contract places it in `componentAdvanced`;
 * the compiler also accepts `advanced`, and APEX runs either.
 */
export function initFunction(region: ApxComponent): string {
  return (
    str(region.props, 'componentAdvanced.initJavaScriptFunction') ||
    str(region.props, 'advanced.initJavaScriptFunction')
  );
}
