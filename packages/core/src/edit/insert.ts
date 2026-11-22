import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { ProjectContext } from '../config.ts';
import { atomicWrite, withLock } from '../fs.ts';
import { Fault } from '../result.ts';
import { sourceInventory } from '../deploy.ts';
import { sourceChange } from '../revision.ts';
import { renderPageBody, renderRegion } from '../scaffold-renderer.ts';
import { scaffoldSchema, type ScaffoldPage } from '../scaffold-spec.ts';
import { ApexLangDocument, appendChild, applyEdits, digestOf, parseApexLang } from './apexlang-edit.ts';
import { pageFile } from './patch.ts';

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
}

function fragment(source: string, pageId: string, components: InsertInput['components']) {
  const doc = new ApexLangDocument(source);
  const node = ApexLangDocument.one(doc.roots, 'page', pageId, 'The file');
  const parsed = parseApexLang(source, 'page').find((c) => c.type === 'page')!;
  const spec = scaffoldSchema.safeParse({
    applicationName: 'insert',
    pages: [
      {
        id: Number(pageId),
        name: 'insert',
        regions: components.regions ?? [],
        ...(components.items ? { items: components.items } : {}),
        ...(components.refreshes ? { refreshes: components.refreshes } : {}),
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
  let rest = renderPageBody({ ...page, regions: [] }, '26.2');
  const actions = existing('dynamicAction');
  (page.refreshes ?? []).forEach((_refresh, index) => {
    let n = index + 1;
    while (actions.has(`REFRESH-${n}`)) n++;
    actions.add(`REFRESH-${n}`);
    rest = rest
      .replace(`dynamicAction refresh-${index + 1} (`, `dynamicAction refresh-${n} (\u0000`)
      .replace(`name: Refresh dependent regions ${index + 1}`, `name: Refresh dependent regions ${n}`);
  });
  rest = rest.replaceAll('\u0000', '');
  text = [text, rest].filter(Boolean).join('\n');
  const lines = text.split('\n').join(doc.eol) + doc.eol;
  const result = applyEdits(source, [appendChild(doc, node, lines)]);
  let after;
  try {
    after = parseApexLang(result, 'page').find((c) => c.type === 'page');
  } catch (error) {
    throw new Fault('TRANSFORM_INVALID', `The edited page does not parse: ${(error as Error).message}`, 5);
  }
  new ApexLangDocument(result);
  for (const region of page.regions)
    if (!after?.children.some((c) => c.type === 'region' && c.id === region.id))
      throw new Fault('TRANSFORM_INVALID', `Region ${region.id} did not read back.`, 5);
  return result;
}

export async function insertComponents(ctx: ProjectContext, input: InsertInput) {
  if (!/^\d{1,5}$/u.test(input.page)) throw new Fault('INVALID_INPUT', 'page is a page number.', 2);
  const pageId = String(Number(input.page));
  const file = await pageFile(ctx, pageId);
  const relative = path.relative(ctx.root, file).split(path.sep).join('/');
  if (input.dryRun || !input.expectedDigest) {
    const source = await readFile(file, 'utf8');
    const result = fragment(source, pageId, input.components);
    if (!input.dryRun)
      throw new Fault(
        'EXPECTED_DIGEST_REQUIRED',
        `Pass expectedDigest ${digestOf(source)} (the ${relative} you read).`,
        2,
        'blocked',
        {
          file: relative,
          currentDigest: digestOf(source),
        },
      );
    return { file: relative, beforeDigest: digestOf(source), afterDigest: digestOf(result), written: false };
  }
  return withLock(path.join(ctx.root, '.apexrest', 'source-edit.lock'), async () => {
    const before = await sourceInventory(ctx);
    const source = await readFile(file, 'utf8');
    if (digestOf(source) !== input.expectedDigest)
      throw new Fault(
        'TRANSFORM_CONFLICT',
        `${relative} changed since it was read; read it again and retry.`,
        5,
        'conflict',
        {
          file: relative,
          currentDigest: digestOf(source),
        },
      );
    const result = fragment(source, pageId, input.components);
    await atomicWrite(file, result);
    return {
      file: relative,
      beforeDigest: digestOf(source),
      afterDigest: digestOf(result),
      written: true,
      change: sourceChange(before, await sourceInventory(ctx), ctx.config.application.sourceDir),
      next: 'Source edited only. Validate or ship to check it with the compiler and import it.',
    };
  });
}

export const _forTests = { fragment };
