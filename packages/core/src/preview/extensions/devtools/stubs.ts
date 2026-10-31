import { get, isRef, ref, str, type ApxComponent, type ApxValue } from '../../apexlang.ts';
import { evaluateExpression, type ProcessResult } from '../../extensions.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';

/**
 * Honest stand-ins for features that need Oracle services: a static workflow diagram, AI text
 * generation (labelled placeholder text, never a network call), geocoding (values unchanged)
 * and push notifications (written to the debug log). Each one reports itself as a diagnostic.
 */

export const AI_PLACEHOLDER = '[Local preview placeholder] Generative AI is not called in the local preview.';

const shared = (renderer: ApexRenderer, type: string): ApxComponent[] =>
  [...renderer.app.shared, ...renderer.app.app.children].filter((component) => component.type === type);

const refOf = (value: ApxValue | undefined) =>
  isRef(value) ? value.ref : typeof value === 'string' ? value : '';

export function aiPlaceholder(prompt: string, agent: string): string {
  const shown = prompt.replace(/\s+/gu, ' ').trim();
  return `${AI_PLACEHOLDER}${agent ? ` AI agent: ${agent}.` : ''}${shown ? ` Prompt: “${shown.length > 160 ? `${shown.slice(0, 157)}…` : shown}”` : ''}`;
}

// ------------------------------------------------------------------ processes

function inputValue(renderer: ApexRenderer, ctx: RenderContext, process: ApxComponent): string {
  const props = process.props;
  const type = str(props, 'inputValue.type', 'item');
  if (type === 'item') return ctx.session.items[str(props, 'inputValue.item').toUpperCase()] ?? '';
  if (type === 'sqlQuery') {
    try {
      return String(
        renderer.db.scalar(str(props, 'inputValue.sqlQuery'), renderer.binds(ctx.session, ctx.page)) ?? '',
      );
    } catch (error) {
      renderer.diagnose(
        'warning',
        `Process ${process.id}: input query failed — ${(error as Error).message}`,
        ctx.pageId,
        process.id,
      );
      return '';
    }
  }
  if (type === 'expression' || type === 'functionBody') {
    const code = str(
      props,
      type === 'expression' ? 'inputValue.plsqlExpression' : 'inputValue.plsqlFunctionBody',
    );
    const value = code
      ? evaluateExpression(
          renderer,
          ctx,
          code,
          type === 'expression' ? 'plsqlExpression' : 'plsqlFunctionBody',
        )
      : undefined;
    return value === undefined || value === null ? '' : String(value);
  }
  return '';
}

export function generateTextProcess(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): ProcessResult {
  const target = str(process.props, 'useResponse.item').toUpperCase();
  const prompt = [str(process.props, 'genAI.systemPrompt'), inputValue(renderer, ctx, process)]
    .filter(Boolean)
    .join(' ');
  const agent = ref(process.props, 'genAI.agent') ?? '';
  const text = aiPlaceholder(prompt, agent);
  if (target) ctx.session.items[target] = text;
  renderer.diagnose(
    'info',
    `Process ${process.id} (generateTextWithAi) returns placeholder text${target ? ` into ${target}` : ''}; no AI service is called locally`,
    ctx.pageId,
    process.id,
  );
  renderer.trace(ctx, { type: 'info', name: `AI placeholder (${process.id})`, detail: text });
  return { ran: true };
}

export function pushNotificationProcess(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): ProcessResult {
  const value = (key: string) => renderer.substitute(ctx.session, str(process.props, key), ctx.page, 'RAW');
  const detail = `to ${value('settings.to') || '(nobody)'}: ${value('settings.title')} — ${value('settings.body')}`;
  renderer.trace(ctx, { type: 'info', name: `Push notification not sent (${process.id})`, detail });
  renderer.diagnose(
    'info',
    `Process ${process.id} (sendPushNotification) is written to the debug log instead of being sent`,
    ctx.pageId,
    process.id,
  );
  return { ran: true };
}

export function geocodingProcess(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): ProcessResult {
  renderer.diagnose(
    'info',
    `Process ${process.id} (serverSideGeocoding) is not simulated (no geocoding service offline); item values are left unchanged`,
    ctx.pageId,
    process.id,
  );
  renderer.trace(ctx, { type: 'info', name: `Geocoding skipped (${process.id})`, level: 'warning' });
  return { ran: false };
}

// ------------------------------------------------------------------ dynamic actions

const ACTION_NOTES: Record<string, string> = {
  generateTextWithAi: 'returns clearly labelled placeholder text; no AI service is called locally',
  showAiAssistant: 'opens a placeholder assistant; no AI service is called locally',
  triggerGeocoding: 'is not simulated (no geocoding service offline); item values are left unchanged',
  download: 'is not simulated locally (no file is produced)',
  printReport: 'is not simulated locally (no report server)',
};

/** Reports dynamic action types that only run as stand-ins. */
export function reportDynamicActions(renderer: ApexRenderer, ctx: RenderContext): void {
  for (const da of renderer.pageComponents(ctx, 'dynamicAction')) {
    for (const action of da.children) {
      const name = str(action.props, 'action');
      const note = ACTION_NOTES[name];
      if (note && action.type === 'action')
        renderer.diagnose('info', `Dynamic action ${da.id}: ${name} ${note}`, ctx.pageId, da.id);
    }
  }
}

// ------------------------------------------------------------------ workflow diagram

interface Node {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
}

interface Edge {
  from: string;
  to: string;
  name: string;
  type: string;
}

const NODE_W = 172;
const NODE_H = 48;
const GAP_X = 36;
const GAP_Y = 64;
const PAD = 24;

function workflowFor(renderer: ApexRenderer, region: ApxComponent): ApxComponent | undefined {
  const workflows = shared(renderer, 'workflow');
  const wanted = (
    refOf(get(region.props, 'source.workflow')) ||
    refOf(get(region.props, 'settings.workflow')) ||
    refOf(get(region.props, 'workflow'))
  ).toLowerCase();
  return (
    (wanted
      ? workflows.find(
          (workflow) =>
            workflow.id.toLowerCase() === wanted ||
            str(workflow.props, 'advanced.staticId').toLowerCase() === wanted,
        )
      : undefined) ?? workflows[0]
  );
}

function graph(version: ApxComponent): { nodes: Node[]; edges: Edge[] } {
  const activities = version.children.filter((child) => child.type === 'activity');
  const edges: Edge[] = [];
  const connection = (component: ApxComponent, from: string | undefined) => {
    const source = ref(component.props, 'activity.from') ?? from;
    const target = ref(component.props, 'activity.to') ?? ref(component.props, 'to');
    if (source && target)
      edges.push({
        from: source.toLowerCase(),
        to: target.toLowerCase(),
        name: str(component.props, 'name'),
        type: str(component.props, 'type', 'normal'),
      });
  };
  for (const activity of activities)
    for (const child of activity.children) if (child.type === 'connection') connection(child, activity.id);
  for (const child of version.children) if (child.type === 'connection') connection(child, undefined);

  // Layered layout: a node sits one row below its deepest predecessor (back edges ignored).
  const ids = activities.map((activity) => activity.id.toLowerCase());
  const level = new Map<string, number>();
  const start = activities.find((activity) => /start/iu.test(str(activity.props, 'type'))) ?? activities[0];
  const visit = (id: string, depth: number, path: Set<string>) => {
    if (path.has(id) || (level.get(id) ?? -1) >= depth) return;
    level.set(id, depth);
    path.add(id);
    for (const edge of edges) if (edge.from === id && ids.includes(edge.to)) visit(edge.to, depth + 1, path);
    path.delete(id);
  };
  if (start) visit(start.id.toLowerCase(), 0, new Set());
  let next = Math.max(-1, ...level.values()) + 1;
  for (const id of ids) if (!level.has(id)) level.set(id, next++);
  const rows = new Map<number, string[]>();
  for (const id of ids) rows.set(level.get(id)!, [...(rows.get(level.get(id)!) ?? []), id]);
  const widest = Math.max(1, ...[...rows.values()].map((row) => row.length));
  const width = widest * NODE_W + (widest - 1) * GAP_X;
  const nodes = activities.map((activity): Node => {
    const id = activity.id.toLowerCase();
    const row = rows.get(level.get(id)!)!;
    const rowWidth = row.length * NODE_W + (row.length - 1) * GAP_X;
    return {
      id,
      name: str(activity.props, 'name', activity.id),
      type: str(activity.props, 'type', 'activity'),
      x: PAD + (width - rowWidth) / 2 + row.indexOf(id) * (NODE_W + GAP_X),
      y: PAD + level.get(id)! * (NODE_H + GAP_Y),
    };
  });
  return { nodes, edges };
}

const ICONS: Record<string, string> = {
  workflowStart: 'Start',
  workflowEnd: 'End',
  switch: 'Switch',
  humanTaskCreate: 'Human task',
  executeCode: 'Code',
  sendEMail: 'E-mail',
  invokeApi: 'API',
  wait: 'Wait',
  invokeWorkflow: 'Workflow',
  parallelFlow: 'Parallel',
  generateTextWithAi: 'AI',
  sendPushNotification: 'Push',
  serverSideGeocoding: 'Geocode',
};

function svgFor(nodes: Node[], edges: Edge[], title: string): string {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const width = Math.max(...nodes.map((node) => node.x + NODE_W), 200) + PAD;
  const height = Math.max(...nodes.map((node) => node.y + NODE_H), 80) + PAD;
  const lines = edges
    .map((edge) => {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) return '';
      const x1 = from.x + NODE_W / 2;
      const y1 = from.y + NODE_H;
      const x2 = to.x + NODE_W / 2;
      const y2 = to.y;
      const back = y2 <= y1;
      const path = back
        ? `M${x1} ${y1} C${x1 + NODE_W * 0.75} ${y1 + 40}, ${x2 + NODE_W * 0.75} ${y2 - 40}, ${x2} ${y2}`
        : `M${x1} ${y1} C${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`;
      const label =
        edge.name && !/^(connection|normal)\b/iu.test(edge.name)
          ? `<text class="apex-local-wf-label" x="${(x1 + x2) / 2 + 6}" y="${(y1 + y2) / 2}">${escapeHtml(edge.name)}</text>`
          : '';
      return `<path class="apex-local-wf-edge is-${escapeHtml(edge.type)}" d="${path}" marker-end="url(#apexLocalWfArrow)"/>${label}`;
    })
    .join('');
  const boxes = nodes
    .map((node) => {
      const kind = ICONS[node.type] ?? node.type;
      const terminal = node.type === 'workflowStart' || node.type === 'workflowEnd';
      const shape = terminal
        ? `<rect class="apex-local-wf-node is-${node.type}" x="${node.x}" y="${node.y}" width="${NODE_W}" height="${NODE_H}" rx="${NODE_H / 2}"/>`
        : node.type === 'switch'
          ? `<polygon class="apex-local-wf-node is-switch" points="${node.x + NODE_W / 2},${node.y} ${node.x + NODE_W},${node.y + NODE_H / 2} ${node.x + NODE_W / 2},${node.y + NODE_H} ${node.x},${node.y + NODE_H / 2}"/>`
          : `<rect class="apex-local-wf-node is-${escapeHtml(node.type)}" x="${node.x}" y="${node.y}" width="${NODE_W}" height="${NODE_H}" rx="6"/>`;
      const name = node.name.length > 24 ? `${node.name.slice(0, 23)}…` : node.name;
      return `<g><title>${escapeHtml(`${node.name} (${node.type})`)}</title>${shape}<text class="apex-local-wf-kind" x="${node.x + NODE_W / 2}" y="${node.y + 18}">${escapeHtml(kind)}</text><text class="apex-local-wf-name" x="${node.x + NODE_W / 2}" y="${node.y + 34}">${escapeHtml(name)}</text></g>`;
    })
    .join('');
  return `<svg class="apex-local-wf-svg" role="img" aria-label="${escapeHtml(title)}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><defs><marker id="apexLocalWfArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs>${lines}${boxes}</svg>`;
}

/**
 * Workflow Diagram region. APEX draws a workflow instance with JointJS+ (DiagramBuilder) from
 * data it fetches by Ajax; no instance exists locally, so the definition of the workflow is drawn
 * as a static SVG of its activities and connections.
 */
export function workflowDiagram(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const workflow = workflowFor(renderer, region);
  const versions = workflow?.children.filter((child) => child.type === 'version') ?? [];
  const version =
    versions.find((candidate) => str(candidate.props, 'settings.state') === 'active') ?? versions.at(-1);
  if (!workflow || !version) {
    renderer.diagnose(
      'info',
      `Workflow Diagram ${region.id}: no workflow definition found; a placeholder is shown`,
      ctx.pageId,
      region.id,
    );
    return `<div class="apex-local-unsupported"><span class="fa fa-info-circle" aria-hidden="true"></span> <strong>Workflow Diagram</strong> “${escapeHtml(str(region.props, 'name', region.id))}”: workflow instances do not run locally and no workflow definition was found.</div>`;
  }
  const { nodes, edges } = graph(version);
  const title = `${str(workflow.props, 'name', workflow.id)} ${str(version.props, 'workflowVersion')}`.trim();
  renderer.diagnose(
    'info',
    `Workflow Diagram ${region.id} shows a static diagram of ${title} (no workflow instance runs locally; APEX draws it with JointJS+)`,
    ctx.pageId,
    region.id,
  );
  const empty = nodes.length
    ? ''
    : '<p class="apex-local-muted">This workflow version has no activities.</p>';
  return `<div class="apex-local-wf" data-workflow="${escapeHtml(workflow.id)}"><div class="apex-local-wf-caption"><span class="fa fa-workflow" aria-hidden="true"></span> ${escapeHtml(title)} <span class="apex-local-wf-note">Definition only · local preview</span></div>${empty || svgFor(nodes, edges, title)}</div>`;
}
