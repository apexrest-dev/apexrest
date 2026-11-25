/**
 * Prompt-to-visible-change trace (V11). One operation id links the observed stages of one edit:
 * host/model/tool events (when the host supplies them), the source mutation, preview readiness, the
 * live notification and the browser's display of the expected content. Each edit carries a unique
 * marker and the source revision it produced, so overlapping edits are never credited to each
 * other. Missing observations stay `unknown`; a total is reported only when every stage of the
 * path was observed.
 */
export type StageName =
  | 'prompt'
  | 'model'
  | 'tool'
  | 'source-mutation'
  | 'preview-ready'
  | 'live-notification'
  | 'dom-update'
  | 'visible-frame';
export interface StageEvent {
  operationId: string;
  stage: StageName;
  /** Epoch milliseconds. */
  startedAt: number;
  endedAt: number;
  /** The source revision (or preview revision) this observation belongs to. */
  revision?: string | number;
  /** For the browser stages: the marker the page must show. */
  marker?: string;
  detail?: Record<string, string | number | boolean>;
}

/** Stages that must all be observed before an end-to-end visible total is claimed. */
export const VISIBLE_PATH: StageName[] = [
  'source-mutation',
  'preview-ready',
  'live-notification',
  'dom-update',
  'visible-frame',
];
const ORDER: StageName[] = ['prompt', 'model', 'tool', ...VISIBLE_PATH];

export interface OperationReport {
  operationId: string;
  marker: string | null;
  revision: string | number | null;
  stages: Record<StageName, { durationMs: number; startedAt: number; endedAt: number } | 'unknown'>;
  /** Idle time between consecutive observed stages (waiting for a model, tool or delivery). */
  gapsMs: { after: StageName; before: StageName; ms: number }[];
  /** From the first observed stage to the visible frame; null unless the visible path is complete. */
  elapsedVisibleMs: number | null;
  sumOfStagesMs: number;
  missing: StageName[];
  /** Observations that name a different marker or revision than the operation: rejected. */
  misattributed: { stage: StageName; reason: string }[];
}

export function operationReport(operationId: string, events: StageEvent[]): OperationReport {
  const own = events.filter((event) => event.operationId === operationId);
  const mutation = own.find((event) => event.stage === 'source-mutation');
  const marker = mutation?.marker ?? null;
  const revision = mutation?.revision ?? null;
  const misattributed: OperationReport['misattributed'] = [];
  const accepted = own.filter((event) => {
    if (event.marker !== undefined && marker !== null && event.marker !== marker) {
      misattributed.push({ stage: event.stage, reason: `marker ${event.marker} is not ${marker}` });
      return false;
    }
    if (
      event.stage !== 'source-mutation' &&
      event.revision !== undefined &&
      revision !== null &&
      typeof event.revision === typeof revision &&
      event.revision !== revision
    ) {
      misattributed.push({ stage: event.stage, reason: `revision ${event.revision} is not ${revision}` });
      return false;
    }
    return true;
  });
  const stages = Object.fromEntries(
    ORDER.map((stage) => {
      const found = accepted.filter((event) => event.stage === stage);
      if (!found.length) return [stage, 'unknown'];
      const startedAt = Math.min(...found.map((event) => event.startedAt));
      const endedAt = Math.max(...found.map((event) => event.endedAt));
      return [stage, { startedAt, endedAt, durationMs: endedAt - startedAt }];
    }),
  ) as OperationReport['stages'];
  const observed = ORDER.filter((stage) => stages[stage] !== 'unknown').map((stage) => ({
    stage,
    ...(stages[stage] as { startedAt: number; endedAt: number; durationMs: number }),
  }));
  const gapsMs: OperationReport['gapsMs'] = [];
  for (let i = 1; i < observed.length; i++) {
    const ms = observed[i]!.startedAt - observed[i - 1]!.endedAt;
    if (ms > 0) gapsMs.push({ after: observed[i - 1]!.stage, before: observed[i]!.stage, ms });
  }
  const missing = ORDER.filter((stage) => stages[stage] === 'unknown');
  const complete = VISIBLE_PATH.every((stage) => stages[stage] !== 'unknown');
  const last = stages['visible-frame'];
  return {
    operationId,
    marker,
    revision,
    stages,
    gapsMs,
    elapsedVisibleMs: complete && last !== 'unknown' ? last.endedAt - observed[0]!.startedAt : null,
    sumOfStagesMs: observed.reduce((total, stage) => total + stage.durationMs, 0),
    missing,
    misattributed,
  };
}

/**
 * The page-side check of the browser mode: waits until the expected marker is present, no APEX
 * region is still refreshing, and two animation frames have been rendered after that, then
 * resolves with the page's clock. Runs in the page (as a string), never in Node.
 */
export const BROWSER_WAIT = String.raw`(marker, timeoutMs) => new Promise((resolve, reject) => {
  const started = Date.now();
  const busy = () => document.querySelector('.apex-local-region-refreshing, .u-Processing, .a-IRR-loading');
  const check = () => {
    if (Date.now() - started > timeoutMs) return reject(new Error('marker not visible'));
    if (!document.body || !document.body.innerText.includes(marker) || busy()) return setTimeout(check, 10);
    const domAt = Date.now();
    requestAnimationFrame(() => requestAnimationFrame(() => resolve({ domAt, frameAt: Date.now() })));
  };
  check();
})`;
