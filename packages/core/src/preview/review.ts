import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Review comments left in the local preview: a developer selects a page component (region, item,
 * button, report column, the page itself, or any element) and writes what should change. The
 * comments are kept in one JSON file outside the deployed source tree, so an agent (Codex,
 * Claude Code or any other) can read them later through `apexrest preview comments` or the MCP
 * `apexrest_preview action:comments`, apply them and mark them resolved.
 *
 * The file is local working state, never deployment input: nothing here reaches Oracle.
 */

export const REVIEW_INTENTS = [
  'change',
  'rename',
  'move',
  'remove',
  'add',
  'style',
  'bug',
  'question',
] as const;
export type ReviewIntent = (typeof REVIEW_INTENTS)[number];
export const REVIEW_TARGET_KINDS = ['page', 'region', 'item', 'button', 'column', 'element'] as const;
export type ReviewTargetKind = (typeof REVIEW_TARGET_KINDS)[number];
export type ReviewStatus = 'open' | 'resolved';

export interface ReviewTarget {
  kind: ReviewTargetKind;
  /** APEXlang component id (column id for `column`; empty for `element`). */
  id?: string;
  /** Region id that owns a column or the nearest mapped region of an element. */
  region?: string;
  /** Human-readable label shown on the page (heading, label, region title). */
  label?: string;
  /** Source file relative to the APEXlang source folder, and the component's line. */
  file?: string;
  line?: number;
  /** CSS selector of the selected element, for `element` targets and re-highlighting. */
  selector?: string;
  /** Visible text of the selected element (trimmed), so a stale selector can still be identified. */
  text?: string;
}

export interface ReviewComment {
  id: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  page: { id: string; name?: string };
  /** APEXlang source folder relative to the project root (target.file is relative to it). */
  sourceDir?: string;
  target: ReviewTarget;
  intent?: ReviewIntent;
  text: string;
  resolution?: { at: string; note?: string };
}

interface ReviewFile {
  version: 1;
  comments: ReviewComment[];
}

export const REVIEW_LIMITS = {
  text: 4000,
  label: 300,
  selector: 1000,
  elementText: 300,
  note: 2000,
  comments: 2000,
};

export class ReviewError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** `<project root>/.apexrest/review/comments.json`: Git-ignored local working state of the project. */
export function reviewFilePath(projectRoot: string): string {
  return path.join(projectRoot, '.apexrest', 'review', 'comments.json');
}

/** The source folder as recorded in a comment: relative to the project root, '/' separated. */
export function reviewSourceDir(file: string, sourceDir: string): string {
  const projectRoot = path.resolve(path.dirname(file), '..', '..');
  const relative = path.relative(projectRoot, sourceDir);
  if (!relative) return '.';
  return relative.startsWith('..') || path.isAbsolute(relative)
    ? sourceDir
    : relative.split(path.sep).join('/');
}

function emptyFile(): ReviewFile {
  return { version: 1, comments: [] };
}

export function readReview(file: string): ReviewFile {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyFile();
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ReviewError(`${file} is not valid JSON; fix or remove it`, 500);
  }
  const value = parsed as Partial<ReviewFile>;
  if (!value || value.version !== 1 || !Array.isArray(value.comments))
    throw new ReviewError(`${file} is not an APEXREST review file (version 1)`, 500);
  return { version: 1, comments: value.comments.filter(isComment) };
}

function isComment(value: unknown): value is ReviewComment {
  const entry = value as ReviewComment;
  return (
    !!entry &&
    typeof entry.id === 'string' &&
    (entry.status === 'open' || entry.status === 'resolved') &&
    typeof entry.text === 'string' &&
    !!entry.page &&
    typeof entry.page.id === 'string' &&
    !!entry.target &&
    REVIEW_TARGET_KINDS.includes(entry.target.kind)
  );
}

/** Replaces the file atomically: a reader never sees a half-written file. */
function writeReview(file: string, content: ReviewFile): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(content, null, 2)}\n`, { mode: 0o600 });
  try {
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function update(file: string, change: (content: ReviewFile) => void): ReviewFile {
  const content = readReview(file);
  change(content);
  writeReview(file, content);
  return content;
}

const clip = (value: unknown, limit: number): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const text = String(value).replace(/\s+/gu, ' ').trim();
  return text ? text.slice(0, limit) : undefined;
};

function requiredText(value: unknown, limit: number, name: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new ReviewError(`${name} is required`);
  if (text.length > limit) throw new ReviewError(`${name} is longer than ${limit} characters`);
  return text;
}

function target(value: unknown): ReviewTarget {
  const input = (value ?? {}) as Record<string, unknown>;
  const kind = String(input.kind ?? '') as ReviewTargetKind;
  if (!REVIEW_TARGET_KINDS.includes(kind))
    throw new ReviewError(`target.kind must be one of ${REVIEW_TARGET_KINDS.join(', ')}`);
  const line = Number(input.line);
  const result: ReviewTarget = { kind };
  const id = clip(input.id, REVIEW_LIMITS.label);
  const region = clip(input.region, REVIEW_LIMITS.label);
  const label = clip(input.label, REVIEW_LIMITS.label);
  const file = clip(input.file, REVIEW_LIMITS.label);
  const selector = clip(input.selector, REVIEW_LIMITS.selector);
  const text = clip(input.text, REVIEW_LIMITS.elementText);
  if (id) result.id = id;
  if (region) result.region = region;
  if (label) result.label = label;
  if (file && !path.isAbsolute(file) && !file.split(/[\\/]/u).includes('..')) result.file = file;
  if (Number.isInteger(line) && line > 0) result.line = line;
  if (selector) result.selector = selector;
  if (text) result.text = text;
  if (kind !== 'element' && kind !== 'page' && !result.id)
    throw new ReviewError(`target.id is required for ${kind}`);
  return result;
}

function intent(value: unknown): ReviewIntent | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (!REVIEW_INTENTS.includes(value as ReviewIntent))
    throw new ReviewError(`intent must be one of ${REVIEW_INTENTS.join(', ')}`);
  return value as ReviewIntent;
}

function newId(): string {
  return `rc-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
}

export interface NewReviewComment {
  page: { id: string; name?: string };
  sourceDir?: string;
  target: unknown;
  intent?: unknown;
  text: unknown;
}

export function addReviewComment(file: string, input: NewReviewComment): ReviewComment {
  const pageId = requiredText(input.page?.id, 64, 'page.id');
  const now = new Date().toISOString();
  const name = clip(input.page?.name, REVIEW_LIMITS.label);
  const comment: ReviewComment = {
    id: newId(),
    status: 'open',
    createdAt: now,
    updatedAt: now,
    page: { id: pageId, ...(name ? { name } : {}) },
    ...(input.sourceDir ? { sourceDir: input.sourceDir } : {}),
    target: target(input.target),
    text: requiredText(input.text, REVIEW_LIMITS.text, 'text'),
  };
  const kind = intent(input.intent);
  if (kind) comment.intent = kind;
  update(file, (content) => {
    if (content.comments.length >= REVIEW_LIMITS.comments)
      throw new ReviewError(
        `The review file already holds ${REVIEW_LIMITS.comments} comments; resolve or delete some`,
      );
    content.comments.push(comment);
  });
  return comment;
}

function find(content: ReviewFile, id: string): ReviewComment {
  const comment = content.comments.find((entry) => entry.id === id);
  if (!comment) throw new ReviewError(`Review comment ${id} does not exist`, 404);
  return comment;
}

export function editReviewComment(
  file: string,
  id: string,
  change: { text?: unknown; intent?: unknown },
): ReviewComment {
  let result!: ReviewComment;
  update(file, (content) => {
    result = find(content, id);
    if (change.text !== undefined) result.text = requiredText(change.text, REVIEW_LIMITS.text, 'text');
    if (change.intent !== undefined) {
      const kind = intent(change.intent);
      if (kind) result.intent = kind;
      else delete result.intent;
    }
    result.updatedAt = new Date().toISOString();
  });
  return result;
}

/** Marks comments resolved (or open again with `reopen`). Unknown ids are reported, not fatal. */
export function setReviewStatus(
  file: string,
  ids: string[],
  status: ReviewStatus,
  note?: string,
): { changed: string[]; missing: string[] } {
  const changed: string[] = [];
  const missing: string[] = [];
  const text = clip(note, REVIEW_LIMITS.note);
  update(file, (content) => {
    const now = new Date().toISOString();
    for (const id of ids) {
      const comment = content.comments.find((entry) => entry.id === id);
      if (!comment) {
        missing.push(id);
        continue;
      }
      comment.status = status;
      comment.updatedAt = now;
      if (status === 'resolved') comment.resolution = { at: now, ...(text ? { note: text } : {}) };
      else delete comment.resolution;
      changed.push(id);
    }
  });
  return { changed, missing };
}

export function deleteReviewComments(file: string, ids: string[]): { deleted: string[]; missing: string[] } {
  const deleted: string[] = [];
  const wanted = new Set(ids);
  update(file, (content) => {
    content.comments = content.comments.filter((entry) => {
      if (!wanted.has(entry.id)) return true;
      deleted.push(entry.id);
      return false;
    });
  });
  return { deleted, missing: ids.filter((id) => !deleted.includes(id)) };
}

export function listReviewComments(
  file: string,
  filter: { status?: ReviewStatus | 'all'; page?: string } = {},
): ReviewComment[] {
  const status = filter.status ?? 'open';
  return readReview(file).comments.filter(
    (entry) =>
      (status === 'all' || entry.status === status) && (!filter.page || entry.page.id === filter.page),
  );
}

/** One comment as a line an agent can act on: where, what, and the request. */
export function describeReviewComment(comment: ReviewComment): string {
  const where = comment.target;
  const component =
    where.kind === 'page'
      ? `page ${comment.page.id}`
      : where.kind === 'column'
        ? `column ${where.id} of region ${where.region ?? '?'}`
        : where.kind === 'element'
          ? `element ${where.selector ?? ''}${where.region ? ` in region ${where.region}` : ''}`
          : `${where.kind} ${where.id}`;
  const label = where.label ? ` "${where.label}"` : '';
  const file =
    where.file && comment.sourceDir && comment.sourceDir !== '.'
      ? `${comment.sourceDir}/${where.file}`
      : where.file;
  const source = file ? ` (${file}${where.line ? `:${where.line}` : ''})` : '';
  return `[${comment.id}] page ${comment.page.id}: ${component}${label}${source}${comment.intent ? ` — ${comment.intent}` : ''}: ${comment.text}`;
}
