import type { ProjectContext } from '../config.ts';
import { Fault } from '../result.ts';
import type { ApxComponent } from '../preview/apexlang.ts';
import { renderPageBody, renderRegion } from '../scaffold-renderer.ts';
import { scaffoldSchema, type ScaffoldPage } from '../scaffold-spec.ts';
import { appendChild } from './apexlang-edit.ts';
import {
  runPageTransaction,
  transformPage,
  type ContextMode,
  type PageSnapshot,
  type PlannedEdit,
} from './transaction.ts';

/**
 * Adds scaffold-defined regions, items and refresh relationships to an existing page
 * (`project insert`): the same native emitter as `project scaffold`, appended after the page's
 * existing components, so nothing already there changes. Region ids are explicit and new; item
 * names carry the page prefix and are new; refresh dynamic actions get unused names. The edit is
 * bound to the page file digest and written atomically, like `project patch`.
 */

export interface InsertInput {
  page: string;
  /** Scaffold page fragment: `regions`, optional `items` and `refreshes`. */
  components: { regions?: unknown[]; items?: unknown[]; refreshes?: unknown[] };
  expectedDigest?: string | undefined;
  dryRun?: boolean | undefined;
  context?: ContextMode | undefined;
}

type Components = InsertInput['components'];

/** Merges several insert operations of one transaction into one fragment (ids stay unique across them). */
function merged(list: Components[]): Components {
  return {
    regions: list.flatMap((c) => c.regions ?? []),
    items: list.flatMap((c) => c.items ?? []),
    refreshes: list.flatMap((c) => c.refreshes ?? []),
  };
}

/** Plans appended components against the page snapshot; throws before anything is written. */
export function planInsert(snapshot: PageSnapshot, list: Components[]): PlannedEdit {
  const { doc, node, parsed, pageId } = snapshot;
  const components = merged(list);
  const spec = scaffoldSchema.safeParse({
    applicationName: 'insert',
    pages: [
      {
        id: Number(pageId),
        name: 'insert',
        regions: components.regions ?? [],
        ...(components.items?.length ? { items: components.items } : {}),
        ...(components.refreshes?.length ? { refreshes: components.refreshes } : {}),
      },
    ],
  });
  if (!spec.success)
    throw new Fault(
      'INVALID_INPUT',
      `Invalid components: ${spec.error.issues[0]?.path.join('.')} ${spec.error.issues[0]?.message}`,
      2,
    );
  const page = spec.data.pages[0]! as ScaffoldPage;
  if (!page.regions.length && !page.items?.length && !page.refreshes?.length)
    throw new Fault('INVALID_INPUT', 'Give regions, items or refreshes to insert.', 2);
  const existing = (type: string) =>
    new Set(parsed.children.filter((c) => c.type === type).map((c) => c.id.toUpperCase()));
  const regions = existing('region');
  for (const region of page.regions) {
    if (!region.id) throw new Fault('INVALID_INPUT', 'Inserted regions need an explicit id.', 2);
    if (regions.has(region.id.toUpperCase()))
      throw new Fault('TARGET_EXISTS', `Region ${region.id} already exists.`, 5);
    regions.add(region.id.toUpperCase());
  }
  const items = existing('pageItem');
  for (const item of page.items ?? []) {
    if (!new RegExp(`^P${pageId}_`, 'u').test(item.name.toUpperCase()))
      throw new Fault('INVALID_INPUT', `Item ${item.name} must start with P${pageId}_.`, 2);
    if (items.has(item.name.toUpperCase()))
      throw new Fault('TARGET_EXISTS', `Item ${item.name} already exists.`, 5);
    if (!regions.has(item.region.toUpperCase()))
      throw new Fault('TARGET_NOT_FOUND', `No region ${item.region} for ${item.name}.`, 2);
    items.add(item.name.toUpperCase());
  }
  for (const refresh of page.refreshes ?? []) {
    for (const item of refresh.items)
      if (!items.has(item.toUpperCase()))
        throw new Fault('TARGET_NOT_FOUND', `Refresh item ${item} does not exist.`, 2);
    for (const region of refresh.regions)
      if (!regions.has(region.toUpperCase()))
        throw new Fault('TARGET_NOT_FOUND', `Refresh region ${region} does not exist.`, 2);
  }
  // New regions follow the existing ones; items and refreshes use the page emitter unchanged.
  const offset = parsed.children.filter((c) => c.type === 'region').length;
  let text = page.regions.map((region, index) => renderRegion(region, offset + index, '26.2')).join('\n');
  let rest = renderPageBody(page, '26.2', { regions: false });
  const actions = existing('dynamicAction');
  const refreshNames: string[] = [];
  (page.refreshes ?? []).forEach((_refresh, index) => {
    let n = index + 1;
    while (actions.has(`REFRESH-${n}`)) n++;
    actions.add(`REFRESH-${n}`);
    refreshNames.push(`refresh-${n}`);
    rest = rest
      .replace(`dynamicAction refresh-${index + 1} (`, `dynamicAction refresh-${n} (\u0000`)
      .replace(`name: Refresh dependent regions ${index + 1}`, `name: Refresh dependent regions ${n}`);
  });
  rest = rest.replaceAll('\u0000', '');
  text = [text, rest].filter(Boolean).join('\n');
  const lines = text.split('\n').join(doc.eol) + doc.eol;
  const verify = (after: ApxComponent) => {
    for (const region of page.regions)
      if (!after.children.some((c) => c.type === 'region' && c.id === region.id))
        throw new Fault('TRANSFORM_INVALID', `Region ${region.id} did not read back.`, 5);
    for (const item of page.items ?? [])
      if (
        !after.children.some((c) => c.type === 'pageItem' && c.id.toUpperCase() === item.name.toUpperCase())
      )
        throw new Fault('TRANSFORM_INVALID', `Item ${item.name} did not read back.`, 5);
  };
  return {
    edits: [appendChild(doc, node, lines)],
    verify,
    targets: [
      ...page.regions.map((region) => `region:${region.id}`),
      ...(page.items ?? []).map((item) => `item:${item.name.toUpperCase()}`),
      ...refreshNames.map((name) => `dynamicAction:${name}`),
    ],
  };
}

function fragment(source: string, pageId: string, components: Components) {
  return transformPage(source, pageId, [(snapshot) => planInsert(snapshot, [components])]).result;
}

export async function insertComponents(ctx: ProjectContext, input: InsertInput) {
  const outcome = await runPageTransaction(
    ctx,
    {
      page: input.page,
      operations: [input.components],
      expectedDigest: input.expectedDigest,
      dryRun: input.dryRun,
    },
    (list) => [(snapshot) => planInsert(snapshot, list)],
  );
  return {
    file: outcome.file,
    beforeDigest: outcome.beforeDigest,
    afterDigest: outcome.afterDigest,
    written: outcome.written,
    ...(outcome.change ? { change: outcome.change } : {}),
    ...(outcome.context ? { context: outcome.context } : {}),
    ...(outcome.written ? { next: outcome.next } : {}),
  };
}

export const _forTests = { fragment };
