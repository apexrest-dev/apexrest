import { str, type ApxComponent } from '../apexlang.ts';
import { registerExtension, type RouteRequest, type RouteResponse } from '../extensions.ts';
import type { ApexRenderer, Session } from '../render.ts';
import {
  addReviewComment,
  deleteReviewComments,
  describeReviewComment,
  editReviewComment,
  listReviewComments,
  REVIEW_INTENTS,
  ReviewError,
  reviewSourceDir,
  setReviewStatus,
} from '../review.ts';
import { escapeHtml } from '../theme.ts';
import { REVIEW_CSS, REVIEW_JS } from './review/client.ts';

/**
 * Review mode of the local preview. With the developer toolbar on, "Review" lets a developer
 * point at a region, item, button, report column, the page or any element, and leave a comment
 * ("rename this column", "move this region below the chart"). Comments are stored in the
 * project's `.apexrest/review/comments.json` (see review.ts) with the APEXlang component, its
 * source file and line, so an agent can apply them later. The preview never edits source here.
 */

interface MapEntry {
  kind: 'region' | 'item' | 'button' | 'column';
  id: string;
  label: string;
  file: string;
  line: number;
  /** DOM ids that identify the component (regions, items, buttons) or the column's header keys. */
  keys: string[];
  /** Owning region id and DOM id of a column. */
  region?: string;
  regionDom?: string;
  /** Page that declares the component (0 for the global page). */
  page: string;
}

const json = (body: unknown, status = 200): RouteResponse => ({
  status,
  type: 'json',
  body: JSON.stringify(body),
});

function columnLabel(column: ApxComponent): string {
  return str(column.props, 'heading.heading', column.id);
}

/** Components of the rendered page (and the global page) the browser can map selections to. */
export function reviewMap(renderer: ApexRenderer, page: ApxComponent): MapEntry[] {
  const entries: MapEntry[] = [];
  const pages = [
    page,
    ...(page.id !== '0' ? [renderer.app.pages.get('0')].filter(Boolean) : []),
  ] as ApxComponent[];
  for (const owner of pages)
    for (const child of owner.children) {
      const base = { id: child.id, file: child.file, line: child.line, page: owner.id };
      if (child.type === 'region') {
        const dom = renderer.regionDomId(child);
        entries.push({ ...base, kind: 'region', label: str(child.props, 'name', child.id), keys: [dom] });
        for (const column of child.children.filter((entry) => entry.type === 'column')) {
          const upper = column.id.toUpperCase();
          entries.push({
            kind: 'column',
            id: column.id,
            label: columnLabel(column),
            file: column.file,
            line: column.line,
            page: owner.id,
            region: child.id,
            regionDom: dom,
            keys: [...new Set([`${dom}_${column.id}`, `${dom}_${upper}`, upper, column.id])],
          });
        }
      } else if (child.type === 'pageItem') {
        const name = child.id.toUpperCase();
        entries.push({
          ...base,
          kind: 'item',
          label: renderer.label(child),
          keys: [`${name}_CONTAINER`, name, `${name}_LABEL`, `${name}_DISPLAY`],
        });
      } else if (child.type === 'button') {
        entries.push({
          ...base,
          kind: 'button',
          label: str(child.props, 'label', str(child.props, 'name', child.id)),
          keys: [renderer.buttonDomId(child)],
        });
      }
    }
  return entries;
}

function parse(request: RouteRequest): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(request.body || '{}') as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

const ids = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value])
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
    .slice(0, 500);

/**
 * `GET ?page=<id>[&status=open|resolved|all][&format=text]` lists comments.
 * `POST { op: add | edit | resolve | reopen | delete, ... }` changes them.
 */
function reviewRoute(renderer: ApexRenderer, _session: Session, request: RouteRequest): RouteResponse {
  const file = renderer.reviewFile;
  if (!file)
    return json({ error: 'Review comments need a project folder; start the preview from a project.' }, 409);
  try {
    if (request.method === 'GET') {
      const status = request.params.get('status') ?? 'all';
      if (!['open', 'resolved', 'all'].includes(status))
        return json({ error: 'status must be open, resolved or all' }, 400);
      const page = request.params.get('page') ?? undefined;
      const comments = listReviewComments(file, {
        status: status as 'open' | 'resolved' | 'all',
        ...(page ? { page } : {}),
      });
      if (request.params.get('format') === 'text')
        return { type: 'text', body: comments.map(describeReviewComment).join('\n') };
      return json({ file, comments, open: listReviewComments(file, { status: 'open' }).length });
    }
    if (request.method !== 'POST') return json({ error: 'use GET or POST' }, 405);
    const input = parse(request);
    if (!input) return json({ error: 'invalid JSON' }, 400);
    switch (input.op) {
      case 'add': {
        const pageId = String(input.page ?? '');
        const page = renderer.findPage(pageId);
        if (!page) return json({ error: `Page ${pageId} does not exist` }, 400);
        const comment = addReviewComment(file, {
          page: { id: page.id, name: str(page.props, 'name') },
          sourceDir: reviewSourceDir(file, renderer.app.root),
          target: input.target,
          intent: input.intent,
          text: input.text,
        });
        return json({ ok: true, comment });
      }
      case 'edit':
        return json({
          ok: true,
          comment: editReviewComment(file, String(input.id ?? ''), {
            text: input.text,
            intent: input.intent,
          }),
        });
      case 'resolve':
      case 'reopen':
        return json({
          ok: true,
          ...setReviewStatus(
            file,
            ids(input.ids ?? input.id),
            input.op === 'resolve' ? 'resolved' : 'open',
            input.note === undefined ? undefined : String(input.note),
          ),
        });
      case 'delete':
        return json({ ok: true, ...deleteReviewComments(file, ids(input.ids ?? input.id)) });
      default:
        return json({ error: 'op must be add, edit, resolve, reopen or delete' }, 400);
    }
  } catch (error) {
    if (error instanceof ReviewError) return json({ error: error.message }, error.status);
    return json({ error: (error as Error).message }, 500);
  }
}

registerExtension({
  name: 'review',
  css: REVIEW_CSS,
  client: REVIEW_JS,
  toolbar: (renderer, ctx) => {
    if (!renderer.reviewFile) return '';
    const open = listSafe(renderer, ctx.pageId);
    const config = {
      page: ctx.pageId,
      pageName: str(ctx.page.props, 'name'),
      pageFile: ctx.page.file,
      pageLine: ctx.page.line,
      intents: REVIEW_INTENTS,
      map: reviewMap(renderer, ctx.page),
    };
    const badge = open
      ? `<span class="apex-local-badge is-review" data-apex-local-review-count>${open}</span>`
      : '<span class="apex-local-badge is-review" data-apex-local-review-count hidden></span>';
    return (
      `<button type="button" class="apex-local-tb-button" data-apex-local-panel="review" title="Review: select components and leave comments for your agent (Alt+Shift+C)"><span class="fa fa-comment-o" aria-hidden="true"></span><span class="apex-local-tb-label">Review</span>${badge}</button>` +
      `<div class="apex-local-panel" data-panel="review" hidden><header><strong>Review comments · page ${escapeHtml(ctx.pageId)}</strong>` +
      `<button type="button" class="apex-local-action is-primary" data-apex-local-review-pick title="Select a component on the page (Alt+Shift+C)">Select on page</button>` +
      `<label class="apex-local-muted"><input type="checkbox" data-apex-local-review-resolved> Resolved</label>` +
      `<label class="apex-local-muted"><input type="checkbox" data-apex-local-review-all> All pages</label>` +
      `<button type="button" class="apex-local-action" data-apex-local-review-copy title="Copy the open comments as text for an agent">Copy</button></header>` +
      `<p class="apex-local-review-hint">Comments are saved in <code>.apexrest/review/comments.json</code>. Ask your agent to “apply the preview review comments”.</p>` +
      `<ol class="apex-local-review-list" data-apex-local-review-list><li class="apex-local-muted">Loading…</li></ol></div>` +
      `<script type="application/json" id="apexLocalReviewConfig">${JSON.stringify(config).replaceAll('<', '\\u003c')}</script>`
    );
  },
  routes: { review: reviewRoute },
});

function listSafe(renderer: ApexRenderer, page: string): number {
  try {
    return listReviewComments(renderer.reviewFile!, { status: 'open', page }).length;
  } catch {
    return 0;
  }
}
