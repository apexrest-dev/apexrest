import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { ProjectContext } from '../config.ts';
import { atomicWrite, withLock } from '../fs.ts';
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
  doc: ApexLangDocument;
  /** The scanned `page` component (offsets into `source`). */
  node: ComponentNode;
  /** The parsed `page` component (values). */
  parsed: ApxComponent;
}

/** A planned operation: text edits against the snapshot and a check of the parsed result. */
export interface PlannedEdit {
  edits: TextEdit[];
  verify: (page: ApxComponent) => void;
  /** Targets the operation changed or created, for the result's context delta. */
  targets?: string[];
}

/** Plans one group of operations of the same kind; throws a Fault for anything it cannot do. */
export type Planner<T> = (snapshot: PageSnapshot, operations: T[]) => PlannedEdit;

export interface TransactionInput<T> {
  page: string;
  operations: T[];
  expectedDigest?: string | undefined;
  dryRun?: boolean | undefined;
}

export interface TransactionResult {
  file: string;
  page: string;
  beforeDigest: string;
  afterDigest: string;
  written: boolean;
  operations: number;
  change?: SourceChange;
  /** The edited text (internal: callers derive their compact results from it). */
  result: string;
  targets: string[];
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

export function snapshotOf(source: string, pageId: string): PageSnapshot {
  const doc = new ApexLangDocument(source);
  const node = ApexLangDocument.one(doc.roots, 'page', pageId, 'The file');
  const parsed = parseApexLang(source, 'page').find((c) => c.type === 'page' && c.id === node.key);
  if (!parsed) throw new Fault('TARGET_NOT_FOUND', `No page ${pageId} in its file.`, 2);
  return { source, pageId, doc, node, parsed };
}

/** Plans, applies and validates a group sequence in memory; nothing is written. */
export function transformPage(
  source: string,
  pageId: string,
  groups: ((snapshot: PageSnapshot) => PlannedEdit)[],
): { result: string; edits: number; targets: string[] } {
  const snapshot = snapshotOf(source, pageId);
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
  return { result, edits: edits.length, targets: [...new Set(plans.flatMap((plan) => plan.targets ?? []))] };
}

/**
 * Runs a page transaction: dry run or digest-bound write. Without `expectedDigest` (and without
 * `dryRun`) the operations are still validated, then `EXPECTED_DIGEST_REQUIRED` names the digest.
 */
export async function runPageTransaction<T>(
  ctx: ProjectContext,
  input: TransactionInput<T>,
  groups: (operations: T[]) => ((snapshot: PageSnapshot) => PlannedEdit)[],
): Promise<TransactionResult> {
  if (!/^\d{1,5}$/u.test(input.page)) throw new Fault('INVALID_INPUT', 'page is a page number.', 2);
  if (!input.operations.length || input.operations.length > 50)
    throw new Fault('INVALID_INPUT', 'Give 1-50 operations.', 2);
  const pageId = String(Number(input.page));
  const file = await pageFile(ctx, pageId);
  const relative = path.relative(ctx.root, file).split(path.sep).join('/');
  const plan = async () => {
    const source = await readFile(file, 'utf8');
    return { source, digest: digestOf(source), ...transformPage(source, pageId, groups(input.operations)) };
  };
  if (input.dryRun || !input.expectedDigest) {
    const planned = await plan();
    if (!input.dryRun)
      throw new Fault(
        'EXPECTED_DIGEST_REQUIRED',
        `Pass expectedDigest ${planned.digest} (the ${relative} you read) to apply the edit.`,
        2,
        'blocked',
        { file: relative, currentDigest: planned.digest },
      );
    return {
      file: relative,
      page: input.page,
      beforeDigest: planned.digest,
      afterDigest: digestOf(planned.result),
      written: false,
      operations: input.operations.length,
      result: planned.result,
      targets: planned.targets,
      next: `Apply with expectedDigest ${planned.digest}.`,
    };
  }
  return withLock(path.join(ctx.root, '.apexrest', 'source-edit.lock'), async () => {
    const before = await sourceInventory(ctx);
    const planned = await plan();
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
    return {
      file: relative,
      page: input.page,
      beforeDigest: planned.digest,
      afterDigest: digestOf(planned.result),
      written: true,
      operations: input.operations.length,
      change: sourceChange(before, after, ctx.config.application.sourceDir),
      result: planned.result,
      targets: planned.targets,
      next: 'Source edited only. Validate or ship to check it with the compiler and import it.',
    };
  });
}
