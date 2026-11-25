import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadProject } from '../../config.ts';
import { patchPage, PATCH_PROPERTIES, type PatchProperty } from '../../edit/patch.ts';
import { Fault } from '../../result.ts';
import { get, str, type ApxComponent } from '../apexlang.ts';
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
 * source file and line, so an agent can apply them later.
 *
 * Each selection is bound to its source revision: the component's `project patch` target, the
 * page that declares it and the SHA-256 of that page file at selection time. "Edit" applies a
 * title, label, heading, format or sequence change through the same digest-bound `patchPage`
 * service as the CLI and MCP; a newer file is never overwritten (409 with its digest). The preview
 * never writes APEX metadata; the edit is an ordinary source change for Git, validate and ship.
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
  /** `project patch` target. */
  patch: string;
  /** Current values of the properties the visual editor may change. */
  values: Partial<Record<PatchProperty, string>>;
}

/** Editable properties per map kind; the patch service is the authority and refuses the rest. */
const EDITABLE: Record<MapEntry['kind'] | 'page', PatchProperty[]> = {
  page: ['title', 'template', 'templateOptions'],
  region: ['title', 'sequence', 'template', 'templateOptions', 'columnSpan', 'column', 'startNewRow'],
  item: ['label', 'sequence', 'columnSpan', 'column', 'startNewRow'],
  button: ['label', 'sequence'],
  column: ['heading', 'format', 'sequence'],
};
/** Template and grid properties: 26.2 sources only (see edit/layout.ts). */
const LAYOUT: PatchProperty[] = ['template', 'templateOptions', 'column', 'columnSpan', 'startNewRow'];
const VALUE_PATHS: Record<string, Partial<Record<PatchProperty, string>>> = {
  page: {
    title: 'title',
    template: 'appearance.pageTemplate',
    templateOptions: 'appearance.templateOptions',
  },
  region: {
    title: 'name',
    sequence: 'layout.sequence',
    template: 'appearance.template',
    templateOptions: 'appearance.templateOptions',
    column: 'layout.column',
    columnSpan: 'layout.columnSpan',
    startNewRow: 'layout.startNewRow',
  },
  item: {
    label: 'label.label',
    sequence: 'layout.sequence',
    column: 'layout.column',
    columnSpan: 'layout.columnSpan',
    startNewRow: 'layout.startNewRow',
  },
  button: { label: 'label', sequence: 'layout.sequence' },
  column: { heading: 'heading.heading', format: 'appearance.formatMask', sequence: 'layout.sequence' },
};
/** A source value as the form shows it: template ids without `@/`, options space-separated, `""` when unset. */
function valueText(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  if (Array.isArray(raw)) return raw.map(String).join(' ');
  if (typeof raw === 'object' && 'ref' in raw)
    return String((raw as { ref: unknown }).ref).replace(/^\//u, '');
  return String(raw);
}
function values(kind: keyof typeof VALUE_PATHS, component: ApxComponent) {
  return Object.fromEntries(
    Object.entries(VALUE_PATHS[kind] ?? {}).map(([property, dotted]) => [
      property,
      valueText(get(component.props, dotted)),
    ]),
  ) as Partial<Record<PatchProperty, string>>;
}
/** The APEXlang release of the previewed sources (`.apex/apexlang.json`), when declared. */
function sourceRelease(root: string): string | undefined {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(root, '.apex/apexlang.json'), 'utf8')) as {
      mmdVersion?: unknown;
    };
    return typeof value.mmdVersion === 'string' ? value.mmdVersion.match(/^\d+\.\d+/u)?.[0] : undefined;
  } catch {
    return undefined;
  }
}
/** Editable properties for these sources: template and grid controls only for 26.2. */
function editableFor(root: string) {
  if (sourceRelease(root) === '26.2') return { editable: EDITABLE };
  return {
    editable: Object.fromEntries(
      Object.entries(EDITABLE).map(([kind, list]) => [
        kind,
        list.filter((property) => !LAYOUT.includes(property)),
      ]),
    ),
    layoutUnavailable: 'Template and layout controls need 26.2 sources.',
  };
}
/** Page and region templates and their option groups, from the theme the preview renders with. */
function choices(renderer: ApexRenderer) {
  const theme = renderer.theme;
  const name = (params: Record<string, unknown>) => String(params.name ?? params.static_id ?? '');
  const options = (
    type: 'PAGE' | 'REGION',
    key: 'page_template_id' | 'region_template_id',
    templates: Map<string, Record<string, unknown>>,
  ) =>
    Object.fromEntries(
      [...templates].map(([id, params]) => [
        id,
        theme.options
          .filter(
            (option) =>
              option.template_types === type &&
              (option[key] === params.id || option[key] === undefined || option[key] === null),
          )
          .map((option) => ({
            css: String(option.css_classes ?? ''),
            label: String(option.display_name ?? option.name ?? option.css_classes ?? ''),
            ...(option.group_id ? { group: String(option.group_id) } : {}),
          }))
          .filter((option) => option.css && !/\s/u.test(option.css)),
      ]),
    );
  return {
    templates: {
      page: [...theme.pages].map(([id, params]) => ({ id, name: name(params) })),
      region: [...theme.regions].map(([id, params]) => ({ id, name: name(params) })),
    },
    options: {
      page: options('PAGE', 'page_template_id', theme.pages),
      region: options('REGION', 'region_template_id', theme.regions),
    },
    groups: Object.fromEntries(
      theme.groups.map((group) => [
        String(group.id),
        { label: String(group.display_name ?? group.name ?? ''), none: String(group.null_text ?? 'Default') },
      ]),
    ),
  };
}

const sha256 = (file: string): string | undefined => {
  try {
    return createHash('sha256').update(fs.readFileSync(file, 'utf8'), 'utf8').digest('hex');
  } catch {
    return undefined;
  }
};

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
        entries.push({
          ...base,
          kind: 'region',
          label: str(child.props, 'name', child.id),
          keys: [dom],
          patch: `region:${child.id}`,
          values: values('region', child),
        });
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
            patch: `column:${child.id}.${column.id}`,
            values: values('column', column),
          });
        }
      } else if (child.type === 'pageItem') {
        const name = child.id.toUpperCase();
        entries.push({
          ...base,
          kind: 'item',
          label: renderer.label(child),
          keys: [`${name}_CONTAINER`, name, `${name}_LABEL`, `${name}_DISPLAY`],
          patch: `item:${child.id}`,
          values: values('item', child),
        });
      } else if (child.type === 'button') {
        entries.push({
          ...base,
          kind: 'button',
          label: str(child.props, 'label', str(child.props, 'name', child.id)),
          keys: [renderer.buttonDomId(child)],
          patch: `button:${child.id}`,
          values: values('button', child),
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

/** Binds a selection to the mapped component's patch target, declaring page and file revision. */
function bindTarget(renderer: ApexRenderer, page: ApxComponent, input: unknown): unknown {
  const target = { ...((input ?? {}) as Record<string, unknown>) };
  delete target.patch;
  delete target.sourcePage;
  delete target.digest;
  const kind = String(target.kind ?? '');
  const entry =
    kind === 'page'
      ? { patch: 'page', page: page.id, file: page.file, line: page.line }
      : reviewMap(renderer, page).find(
          (candidate) =>
            candidate.kind === kind &&
            candidate.id === target.id &&
            (kind !== 'column' || candidate.region === target.region),
        );
  if (!entry) return target;
  const digest = sha256(path.join(renderer.app.root, entry.file));
  return {
    ...target,
    file: entry.file,
    line: entry.line,
    patch: entry.patch,
    sourcePage: entry.page,
    ...(digest ? { digest } : {}),
  };
}

/** Properties the visual form edits; report SQL stays in source editing. */
const VISUAL_PROPERTIES: readonly PatchProperty[] = PATCH_PROPERTIES.filter(
  (property) => property !== 'query',
);
const MAX_BATCH = 50;

/**
 * Applies visual property edits through the shared, digest-bound patch service: one operation
 * (`target`, `property`, `value`) or a batch (`operations: [...]`) of one declaring page file, as
 * one atomic replacement. Any invalid, duplicate or conflicting operation rejects the batch with
 * nothing written; the response names the first operation that fails on its own (`operation`).
 */
async function patchRoute(file: string, input: Record<string, unknown>): Promise<RouteResponse> {
  const page = String(input.page ?? '');
  const digest = String(input.digest ?? '');
  const raw = Array.isArray(input.operations)
    ? (input.operations as Record<string, unknown>[])
    : [{ target: input.target, property: input.property, value: input.value }];
  if (!/^\d{1,5}$/u.test(page) || !/^[0-9a-f]{64}$/u.test(digest))
    return json({ error: 'patch needs page, target, property, value and the file digest' }, 400);
  if (!raw.length || raw.length > MAX_BATCH) return json({ error: `Give 1-${MAX_BATCH} operations.` }, 400);
  const operations: { target: string; property: PatchProperty; value: string }[] = [];
  for (const [index, entry] of raw.entries()) {
    const property = String(entry?.property ?? '') as PatchProperty;
    const target = String(entry?.target ?? '');
    const value = typeof entry?.value === 'string' ? entry.value : '';
    if (!VISUAL_PROPERTIES.includes(property))
      return json({ error: `property must be ${VISUAL_PROPERTIES.join(', ')}`, operation: index }, 400);
    if (!target)
      return json(
        { error: 'patch needs page, target, property, value and the file digest', operation: index },
        400,
      );
    if (value.length > 4000)
      return json({ error: 'value is longer than 4000 characters', operation: index }, 400);
    operations.push({ target, property, value });
  }
  let ctx;
  try {
    ctx = await loadProject(path.resolve(path.dirname(file), '..', '..'));
    const result = await patchPage(ctx, { page, operations, expectedDigest: digest });
    return json({ ok: true, result });
  } catch (error) {
    if (error instanceof Fault) {
      const status =
        error.code === 'TRANSFORM_CONFLICT' && error.status === 'conflict'
          ? 409
          : error.exitCode === 2
            ? 400
            : 422;
      // Point at the operation that fails by itself (a dry run writes nothing); a pair that
      // only conflicts together has no single culprit.
      let operation: number | undefined;
      if (ctx && status !== 409 && operations.length > 1)
        for (const [index, entry] of operations.entries()) {
          const alone = await patchPage(ctx, { page, operations: [entry], dryRun: true }).then(
            () => undefined,
            () => index,
          );
          if (alone !== undefined) {
            operation = alone;
            break;
          }
        }
      return json(
        {
          error: error.message,
          code: error.code,
          ...(error.details ?? {}),
          ...(operation !== undefined ? { operation } : {}),
        },
        status,
      );
    }
    return json({ error: (error as Error).message }, 500);
  }
}

/**
 * `GET ?page=<id>[&status=open|resolved|all][&format=text]` lists comments.
 * `POST { op: add | edit | resolve | reopen | delete, ... }` changes them;
 * `POST { op: patch, page, digest, target, property, value | operations: [...] }` edits the source (see patchRoute).
 */
function reviewRoute(
  renderer: ApexRenderer,
  _session: Session,
  request: RouteRequest,
): RouteResponse | Promise<RouteResponse> {
  const file = renderer.reviewFile;
  if (!file)
    return json({ error: 'Review comments need a project folder; start the preview from a project.' }, 409);
  try {
    if (request.method === 'GET') {
      if (request.params.get('choices') === '1') return json(choices(renderer));
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
          target: bindTarget(renderer, page, input.target),
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
      case 'patch':
        return patchRoute(file, input);
      default:
        return json({ error: 'op must be add, edit, resolve, reopen, delete or patch' }, 400);
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
      pageValues: values('page', ctx.page),
      ...editableFor(renderer.app.root),
      digests: digestsFor(renderer, ctx.page),
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

/** Page file revisions the visual editor binds to: the page and, when used, the global page. */
function digestsFor(renderer: ApexRenderer, page: ApxComponent): Record<string, string> {
  const files = [page.file, ...(page.id !== '0' ? [renderer.app.pages.get('0')?.file] : [])].filter(
    (file): file is string => !!file,
  );
  return Object.fromEntries(
    files.flatMap((file) => {
      const digest = sha256(path.join(renderer.app.root, file));
      return digest ? [[file, digest]] : [];
    }),
  );
}

function listSafe(renderer: ApexRenderer, page: string): number {
  try {
    return listReviewComments(renderer.reviewFile!, { status: 'open', page }).length;
  } catch {
    return 0;
  }
}
