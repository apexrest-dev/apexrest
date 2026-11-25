import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { ProjectContext } from '../config.ts';
import { atomicWrite, contained, withLock } from '../fs.ts';
import { sourceRelease } from '../partial-import.ts';
import { Fault } from '../result.ts';
import { sourceInventory } from '../deploy.ts';
import { sourceChange, type SourceChange } from '../revision.ts';
import type { ApxComponent } from '../preview/apexlang.ts';
import {
  ApexLangDocument,
  applyEdits,
  digestOf,
  parseApexLang,
  type ComponentNode,
  type TextEdit,
} from './apexlang-edit.ts';
import { pageFile } from './page-file.ts';
import type { Release } from './columns.ts';
import { contextDelta, contextOf, type ContextDelta, type PageContext } from './context.ts';

/**
 * One source transaction for an existing page (`project action:edit`). Every operation is resolved
 * against the same immutable snapshot of the page file, its text edits are combined and applied in
 * memory, the result is parsed and each operation reads its own change back, and only then is the
 * file replaced atomically under the project's source-edit lock, after its digest is checked again.
 * Any failure leaves the file byte-identical. Components an operation inserts cannot be targeted by
 * another operation of the same transaction: targets always name components of the snapshot read.
 *
 * `project action:patch` and `action:insert` are single-kind transactions through the same path.
 */

/** What an operation planner sees: the scanned page and its parsed form, both of the snapshot. */
export interface PageSnapshot {
  source: string;
  pageId: string;
  /** APEXlang release of the application sources (`.apex/apexlang.json`); 26.2 when unknown. */
  release: Release;
  doc: ApexLangDocument;
  /** The scanned `page` component (offsets into `source`). */
  node: ComponentNode;
  /** The parsed `page` component (values). */
  parsed: ApxComponent;
  /** Other source files an operation depends on, read in the same transaction (`page:N`). */
  related: Map<string, Related>;
}
export interface Related {
  file: string;
  digest: string;
  parsed: ApxComponent;
}

/** A planned operation: text edits against the snapshot and a check of the parsed result. */
export interface PlannedEdit {
  edits: TextEdit[];
  verify: (page: ApxComponent) => void;
  /** Targets the operation changed or created, for the result's context delta. */
  targets?: string[];
  /** Things the operation deliberately did not change but the caller should review. */
  warnings?: string[];
}

/** Plans one group of operations of the same kind; throws a Fault for anything it cannot do. */
export type Planner<T> = (snapshot: PageSnapshot, operations: T[]) => PlannedEdit;

export type ContextMode = 'delta' | 'full' | 'none';
export interface TransactionInput<T> {
  page: string;
  operations: T[];
  expectedDigest?: string | undefined;
  dryRun?: boolean | undefined;
  /** What the result carries of the edited page: the delta (default), the whole context or none. */
  context?: ContextMode | undefined;
}

export interface TransactionResult {
  file: string;
  page: string;
  beforeDigest: string;
  afterDigest: string;
  written: boolean;
  operations: number;
  change?: SourceChange;
  /** Context of the exact edited bytes (the planned bytes for a dry run). */
  context?: ContextDelta | PageContext;
  /** The edited text (internal: callers derive their compact results from it). */
  result: string;
  targets: string[];
  warnings?: string[];
  next?: string;
}

/**
 * Combines planned edits into one text change. Insertions at the same offset keep the order of
 * their operations; overlapping replacements are a conflict.
 */
function combine(plans: PlannedEdit[]): TextEdit[] {
  const edits: TextEdit[] = [];
  for (const plan of plans)
    for (const edit of plan.edits) {
      const same =
        edit.start === edit.end &&
        edits.find((other) => other.start === edit.start && other.end === edit.start);
      if (same) same.content += edit.content;
      else edits.push({ ...edit });
    }
  return edits;
}

export function snapshotOf(
  source: string,
  pageId: string,
  release: Release = '26.2',
  related: Map<string, Related> = new Map(),
): PageSnapshot {
  const doc = new ApexLangDocument(source);
  const node = ApexLangDocument.one(doc.roots, 'page', pageId, 'The file');
  const parsed = parseApexLang(source, 'page').find((c) => c.type === 'page' && c.id === node.key);
  if (!parsed) throw new Fault('TARGET_NOT_FOUND', `No page ${pageId} in its file.`, 2);
  return { source, pageId, release, doc, node, parsed, related };
}

/** Plans, applies and validates a group sequence in memory; nothing is written. */
export function transformPage(
  source: string,
  pageId: string,
  groups: ((snapshot: PageSnapshot) => PlannedEdit)[],
  release: Release = '26.2',
  related: Map<string, Related> = new Map(),
): { result: string; edits: number; targets: string[]; warnings: string[] } {
  const snapshot = snapshotOf(source, pageId, release, related);
  const plans = groups.map((plan) => plan(snapshot));
  const edits = combine(plans);
  const result = applyEdits(source, edits);
  let after: ApxComponent | undefined;
  try {
    after = parseApexLang(result, 'edit').find((c) => c.type === 'page' && c.id === snapshot.node.key);
  } catch (error) {
    throw new Fault('TRANSFORM_INVALID', `The edited page does not parse: ${(error as Error).message}`, 5);
  }
  // The lossless scanner must still accept the result, so later edits stay possible.
  new ApexLangDocument(result);
  if (!after) throw new Fault('TRANSFORM_INVALID', `Page ${pageId} did not read back.`, 5);
  for (const plan of plans) plan.verify(after);
  return {
    result,
    edits: edits.length,
    targets: [...new Set(plans.flatMap((plan) => plan.targets ?? []))],
    warnings: [...new Set(plans.flatMap((plan) => plan.warnings ?? []))],
  };
}

/**
 * Runs a page transaction: dry run or digest-bound write. Without `expectedDigest` (and without
 * `dryRun`) the operations are still validated, then `EXPECTED_DIGEST_REQUIRED` names the digest.
 */
export async function runPageTransaction<T>(
  ctx: ProjectContext,
  input: TransactionInput<T>,
  groups: (operations: T[]) => ((snapshot: PageSnapshot) => PlannedEdit)[],
  /**
   * Other source files the operations read, as `page:N` (a dialog's modal page) or `lov:ID` (a shared
   * LOV); read with the page under the same lock and exposed as `snapshot.related`.
   */
  dependencies: (operations: T[]) => string[] = () => [],
): Promise<TransactionResult> {
  if (!/^\d{1,5}$/u.test(input.page)) throw new Fault('INVALID_INPUT', 'page is a page number.', 2);
  if (!input.operations.length || input.operations.length > 50)
    throw new Fault('INVALID_INPUT', 'Give 1-50 operations.', 2);
  const pageId = String(Number(input.page));
  const file = await pageFile(ctx, pageId);
  const relative = path.relative(ctx.root, file).split(path.sep).join('/');
  const found = await sourceRelease(await contained(ctx.root, ctx.config.application.sourceDir));
  const release: Release = found === '26.1' ? '26.1' : '26.2';
  const plan = async () => {
    const source = await readFile(file, 'utf8');
    const related = new Map<string, Related>();
    for (const key of new Set(dependencies(input.operations))) {
      const found = await loadRelated(ctx, key);
      if (found) related.set(key, found);
    }
    return {
      source,
      digest: digestOf(source),
      ...transformPage(source, pageId, groups(input.operations), release, related),
    };
  };
  const described = (source: string, result: string) => {
    const mode = input.context ?? 'delta';
    if (mode === 'none') return {};
    return {
      context: mode === 'full' ? contextOf(result, relative) : contextDelta(source, result, relative),
    };
  };
  const outcome = await guardedEdit(ctx, { file, relative, ...input, plan });
  const { planned } = outcome;
  return {
    file: relative,
    page: input.page,
    beforeDigest: planned.digest,
    afterDigest: digestOf(planned.result),
    written: outcome.written,
    operations: input.operations.length,
    ...(outcome.change ? { change: outcome.change } : {}),
    ...described(planned.source, planned.result),
    result: planned.result,
    targets: planned.targets,
    ...(planned.warnings.length ? { warnings: planned.warnings } : {}),
    next: outcome.written
      ? 'Source edited only. Validate or ship to check it with the compiler and import it.'
      : `Apply with expectedDigest ${planned.digest}.`,
  };
}

/** Reads one dependency (`page:N` or `lov:ID`); a missing one is left out for the planner to refuse. */
async function loadRelated(ctx: ProjectContext, key: string): Promise<Related | undefined> {
  const [kind, id = ''] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  let file: string | undefined;
  if (kind === 'page') file = await pageFile(ctx, String(Number(id))).catch(() => undefined);
  else if (kind === 'lov') file = await (await import('./lov.ts')).lovFile(ctx, id).catch(() => undefined);
  if (!file) return undefined;
  const text = await readFile(file, 'utf8');
  const parsed = parseApexLang(text, 'related').find(
    (c) =>
      c.type === kind &&
      (kind === 'page' ||
        c.id.toUpperCase() === id.toUpperCase() ||
        String(c.props.name ?? '').toUpperCase() === id.toUpperCase()),
  );
  if (!parsed) return undefined;
  return { file: path.relative(ctx.root, file).split(path.sep).join('/'), digest: digestOf(text), parsed };
}

/**
 * The digest-bound write of one source file: a dry run (or a call without `expectedDigest`, which
 * then fails with `EXPECTED_DIGEST_REQUIRED` naming the digest) only plans; otherwise the file is
 * planned again under the project's source-edit lock, its digest compared and the result written
 * atomically. `plan` reads the file itself and throws before anything is written.
 */
export async function guardedEdit<P extends { source: string; digest: string; result: string }>(
  ctx: ProjectContext,
  input: {
    file: string;
    relative: string;
    expectedDigest?: string | undefined;
    dryRun?: boolean | undefined;
    plan: () => Promise<P>;
  },
): Promise<{ planned: P; written: boolean; change?: SourceChange }> {
  const { file, relative } = input;
  if (input.dryRun || !input.expectedDigest) {
    const planned = await input.plan();
    if (!input.dryRun)
      throw new Fault(
        'EXPECTED_DIGEST_REQUIRED',
        `Pass expectedDigest ${planned.digest} (the ${relative} you read) to apply the edit.`,
        2,
        'blocked',
        { file: relative, currentDigest: planned.digest },
      );
    return { planned, written: false };
  }
  return withLock(path.join(ctx.root, '.apexrest', 'source-edit.lock'), async () => {
    const before = await sourceInventory(ctx);
    const planned = await input.plan();
    if (planned.digest !== input.expectedDigest)
      throw new Fault(
        'TRANSFORM_CONFLICT',
        `${relative} changed since it was read; read it again and retry.`,
        5,
        'conflict',
        { file: relative, currentDigest: planned.digest },
      );
    await atomicWrite(file, planned.result);
    const after = await sourceInventory(ctx);
    return { planned, written: true, change: sourceChange(before, after, ctx.config.application.sourceDir) };
  });
}
