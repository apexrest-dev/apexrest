import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { ProjectContext } from '../config.ts';
import { atomicWrite, contained, exists, withLock } from '../fs.ts';
import { Fault } from '../result.ts';
import { sourceInventory } from '../deploy.ts';
import { sourceChange } from '../revision.ts';
import { digestOf } from './apexlang-edit.ts';

/**
 * Undo and redo of page edits (`project action:undo` / `action:redo`). Every successful page
 * transaction — `patch`, `insert`, `edit` and the preview's visual edits, compound or not — is one
 * entry: the page file, its exact digests before and after, and the inverse (the changed middle of
 * the file). Undo and redo run under the same source-edit lock as edits and write only when the file
 * still has the digest the entry expects, so a newer edit from anywhere is never overwritten; a
 * mismatch writes nothing. A new edit after an undo drops the redo branch. The history lives in
 * `.apexrest/edit-history.json`, holds at most 50 entries and forgets entries older than 14 days.
 * It is local source only: undoing never reverts a deployed application, and scaffold output,
 * shared-component edits, database changes, imports and manual file edits are not recorded.
 */

export const HISTORY_LIMIT = 50;
export const HISTORY_DAYS = 14;
const FILE = '.apexrest/edit-history.json';

interface Entry {
  id: string;
  at: string;
  file: string;
  page: string;
  /** What the edit did, for the undo/redo labels. */
  summary: string;
  before: string;
  after: string;
  /** The file is `prefix + middle + suffix`; before and after differ only in `middle`. */
  prefix: number;
  suffix: number;
  beforeMiddle: string;
  afterMiddle: string;
}
interface History {
  version: 1;
  undo: Entry[];
  redo: Entry[];
}

async function load(ctx: ProjectContext): Promise<History> {
  const file = await contained(ctx.root, FILE);
  let history: History = { version: 1, undo: [], redo: [] };
  if (await exists(file))
    try {
      const value = JSON.parse(await readFile(file, 'utf8')) as History;
      if (value.version === 1 && Array.isArray(value.undo) && Array.isArray(value.redo)) history = value;
    } catch {
      // A damaged history is dropped, never trusted.
    }
  const oldest = Date.now() - HISTORY_DAYS * 24 * 3600 * 1000;
  const fresh = (entry: Entry) => Date.parse(entry.at) >= oldest;
  return {
    version: 1,
    undo: history.undo.filter(fresh).slice(-HISTORY_LIMIT),
    redo: history.redo.filter(fresh).slice(-HISTORY_LIMIT),
  };
}
const save = async (ctx: ProjectContext, history: History) =>
  atomicWrite(await contained(ctx.root, FILE), JSON.stringify(history) + '\n');

/** The changed middle of two texts (common prefix and suffix are not stored). */
function difference(before: string, after: string) {
  let prefix = 0;
  const limit = Math.min(before.length, after.length);
  while (prefix < limit && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < limit - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix])
    suffix++;
  return {
    prefix,
    suffix,
    beforeMiddle: before.slice(prefix, before.length - suffix),
    afterMiddle: after.slice(prefix, after.length - suffix),
  };
}

/**
 * Records a written page edit. Called by the page transaction while it still holds the
 * source-edit lock, so the history and the file change together.
 */
export async function recordEdit(
  ctx: ProjectContext,
  edit: { file: string; page: string; summary: string; before: string; after: string },
) {
  const history = await load(ctx);
  history.undo.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    file: edit.file,
    page: edit.page,
    summary: edit.summary.slice(0, 200),
    before: digestOf(edit.before),
    after: digestOf(edit.after),
    ...difference(edit.before, edit.after),
  });
  history.undo = history.undo.slice(-HISTORY_LIMIT);
  history.redo = [];
  await save(ctx, history);
}

export async function editHistory(ctx: ProjectContext) {
  const history = await load(ctx);
  const describe = (entry: Entry) => ({
    id: entry.id,
    at: entry.at,
    file: entry.file,
    page: entry.page,
    summary: entry.summary,
  });
  return {
    undo: history.undo.slice(-10).reverse().map(describe),
    redo: history.redo.slice(-10).reverse().map(describe),
    limit: HISTORY_LIMIT,
    retentionDays: HISTORY_DAYS,
    scope: 'Local page source only; undo never reverts a deployed application.',
  };
}

async function step(ctx: ProjectContext, direction: 'undo' | 'redo') {
  return withLock(path.join(ctx.root, '.apexrest', 'source-edit.lock'), async () => {
    const history = await load(ctx);
    const entry = (direction === 'undo' ? history.undo : history.redo).at(-1);
    if (!entry) throw new Fault('HISTORY_EMPTY', `Nothing to ${direction}.`, 2);
    const file = await contained(ctx.root, entry.file);
    const current = (await exists(file)) ? await readFile(file, 'utf8') : '';
    const expected = direction === 'undo' ? entry.after : entry.before;
    if (digestOf(current) !== expected)
      throw new Fault(
        'TRANSFORM_CONFLICT',
        `${entry.file} changed since that edit; ${direction} would overwrite newer work, so nothing was written.`,
        5,
        'conflict',
        { file: entry.file, currentDigest: digestOf(current) },
      );
    const middle = direction === 'undo' ? entry.beforeMiddle : entry.afterMiddle;
    const result = current.slice(0, entry.prefix) + middle + current.slice(current.length - entry.suffix);
    if (digestOf(result) !== (direction === 'undo' ? entry.before : entry.after))
      throw new Fault(
        'HISTORY_INVALID',
        `The recorded ${direction} of ${entry.file} does not reproduce its digest.`,
        5,
      );
    const before = await sourceInventory(ctx);
    await atomicWrite(file, result);
    const after = await sourceInventory(ctx);
    if (direction === 'undo') {
      history.undo.pop();
      history.redo.push(entry);
    } else {
      history.redo.pop();
      history.undo.push(entry);
    }
    await save(ctx, history);
    return {
      [direction === 'undo' ? 'undone' : 'redone']: { id: entry.id, summary: entry.summary },
      file: entry.file,
      page: entry.page,
      beforeDigest: digestOf(current),
      afterDigest: digestOf(result),
      written: true,
      change: sourceChange(before, after, ctx.config.application.sourceDir),
      remaining: { undo: history.undo.length, redo: history.redo.length },
      next: 'Local source only; a deployed application is not reverted. Validate or ship to deploy this state.',
    };
  });
}
export const undoEdit = (ctx: ProjectContext) => step(ctx, 'undo');
export const redoEdit = (ctx: ProjectContext) => step(ctx, 'redo');
