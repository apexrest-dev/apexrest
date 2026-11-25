import type { ProjectContext } from '../config.ts';
import { Fault } from '../result.ts';
import { planSets, type PatchOperation } from './patch.ts';
import { planInsert, type InsertInput } from './insert.ts';
import {
  runPageTransaction,
  type PageSnapshot,
  type PlannedEdit,
  type TransactionResult,
} from './transaction.ts';

/**
 * Compound page edits (`project action:edit`): property and query changes (`op: set`, the `patch`
 * operations) and appended components (`op: insert`, the `insert` fragment) on one existing page,
 * planned against one snapshot and written as one atomic, digest-bound replacement.
 */

export type EditOperation =
  ({ op: 'set' } & PatchOperation) | { op: 'insert'; components: InsertInput['components'] };

export interface EditInput {
  page: string;
  operations: EditOperation[];
  expectedDigest?: string | undefined;
  dryRun?: boolean | undefined;
}

export type Group = (snapshot: PageSnapshot) => PlannedEdit;

/** Groups operations by kind, keeping each kind's order: sets are planned together, inserts merged. */
export function editGroups(operations: EditOperation[]): Group[] {
  const sets: PatchOperation[] = [];
  const inserts: InsertInput['components'][] = [];
  for (const operation of operations) {
    if (operation.op === 'set') {
      const { op: _op, ...set } = operation;
      sets.push(set);
    } else if (operation.op === 'insert') inserts.push(operation.components);
    else throw new Fault('INVALID_INPUT', `Unknown edit op ${(operation as { op: string }).op}.`, 2);
  }
  const groups: Group[] = [];
  if (sets.length) groups.push((snapshot) => planSets(snapshot, sets));
  if (inserts.length) groups.push((snapshot) => planInsert(snapshot, inserts));
  return groups;
}

export async function editPage(ctx: ProjectContext, input: EditInput) {
  const { result: _text, ...outcome }: TransactionResult = await runPageTransaction(ctx, input, editGroups);
  return outcome;
}
