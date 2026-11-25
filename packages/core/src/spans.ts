import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Fault } from './result.ts';

/**
 * Operation spans of one ship (plan, queue, worker, apply), under one correlation id. Observation
 * only: a span never changes control flow, and an unavailable trace records nothing. Spans exist
 * only in the returned result and the run journal; nothing is collected or kept elsewhere.
 *
 * Names and attributes are a fixed vocabulary of numbers, booleans and short enumerations, so a
 * report never carries SQL, credentials, connection details or source contents.
 */
export type SpanName =
  | 'planning'
  | 'queue'
  | 'workerStartup'
  | 'setup'
  | 'ownershipWait'
  | 'compilerPreparation'
  | 'targetObservation'
  | 'backup'
  | 'backupExport'
  | 'backupCopyHash'
  | 'backupDriftCheck'
  | 'sourceFreeze'
  | 'prewriteObservation'
  | 'scripts'
  | 'importSubmission'
  | 'readback';
export type SpanStatus = 'ok' | 'failed' | 'cancelled' | 'unknown' | 'unfinished';
type Attributes = Record<string, string | number | boolean>;

export interface Span {
  id: number;
  name: SpanName;
  parent?: number;
  /** Milliseconds since the trace origin. */
  startMs: number;
  /** Null while running, when the run stopped inside it, or when its outcome is unknown. */
  endMs: number | null;
  status: SpanStatus;
  /** Work that runs alongside the sequential path (for example compiler preparation). */
  background?: true;
  attributes?: Attributes;
}
interface Trace {
  correlationId: string;
  origin: number;
  spans: Span[];
}
const storage = new AsyncLocalStorage<{ trace: Trace; parent?: number | undefined }>();
const now = () => performance.timeOrigin + performance.now();

/** Runs `action` in a trace; a nested call joins the trace already running. */
export function withTrace<T>(
  action: () => Promise<T>,
  options: { correlationId?: string; origin?: number } = {},
): Promise<T> {
  if (storage.getStore()) return action();
  return storage.run(
    {
      trace: {
        correlationId: options.correlationId ?? randomUUID(),
        origin: options.origin ?? now(),
        spans: [],
      },
    },
    action,
  );
}
export const correlationId = () => storage.getStore()?.trace.correlationId;

const status = (error: unknown): SpanStatus => {
  if (error instanceof Fault) {
    if (error.code === 'CANCELLED' || error.status === 'cancelled') return 'cancelled';
    if (error.code === 'OUTCOME_UNKNOWN' || error.status === 'outcome_unknown') return 'unknown';
  }
  return 'failed';
};

/** Starts a span; `end` closes it. A span left open is reported as unfinished, without an end. */
export function openSpan(
  name: SpanName,
  attributes?: Attributes,
  options: { background?: boolean; parent?: number | undefined } = {},
) {
  const store = storage.getStore();
  if (!store) return { end: () => undefined, fail: () => undefined, set: () => undefined, id: undefined };
  const { trace } = store;
  const parent = options.parent ?? store.parent;
  const span: Span = {
    id: trace.spans.length + 1,
    name,
    ...(parent ? { parent } : {}),
    startMs: now() - trace.origin,
    endMs: null,
    status: 'unfinished',
    ...(options.background ? { background: true as const } : {}),
    ...(attributes ? { attributes: { ...attributes } } : {}),
  };
  trace.spans.push(span);
  const set = (more: Attributes) => {
    span.attributes = { ...span.attributes, ...more };
  };
  return {
    id: span.id,
    set,
    end: (more?: Attributes) => {
      if (span.status !== 'unfinished') return;
      if (more) set(more);
      span.endMs = now() - trace.origin;
      span.status = 'ok';
    },
    /** A failure or cancellation ends now; an unknown outcome keeps no end time. */
    fail: (error: unknown) => {
      if (span.status !== 'unfinished') return;
      span.status = status(error);
      if (span.status !== 'unknown') span.endMs = now() - trace.origin;
    },
  };
}

/** Runs `action` as a span; spans opened inside it are its children. */
export async function spanned<T>(
  name: SpanName,
  action: (span: ReturnType<typeof openSpan>) => Promise<T>,
  attributes?: Attributes,
  parent?: number,
): Promise<T> {
  const store = storage.getStore();
  if (!store) return action(openSpan(name));
  const span = openSpan(name, attributes, { parent });
  try {
    const value = await storage.run({ trace: store.trace, parent: span.id }, () => action(span));
    span.end();
    return value;
  } catch (error) {
    span.fail(error);
    throw error;
  }
}

/** Records work measured elsewhere (epoch milliseconds), such as queueing before this process. */
export function measuredSpan(
  name: SpanName,
  start: number,
  end: number,
  attributes?: Attributes,
  parent?: number,
) {
  const store = storage.getStore();
  if (!store) return undefined;
  const { trace } = store;
  const id = trace.spans.length + 1;
  trace.spans.push({
    id,
    name,
    ...(parent ? { parent } : {}),
    startMs: start - trace.origin,
    endMs: end - trace.origin,
    status: 'ok',
    ...(attributes ? { attributes: { ...attributes } } : {}),
  });
  return id;
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * The trace so far. `wallMs` is the elapsed time; `sequentialMs` is the union of the top-level
 * sequential spans (overlapping time is counted once); `spanTotalMs` is their plain sum, so the
 * difference shows overlap; background spans (compiler preparation) are totalled separately and
 * are never part of the sequential time. Unfinished spans count up to the report time in no total.
 */
export function traceReport() {
  const store = storage.getStore();
  if (!store) return undefined;
  const { trace } = store;
  const top = trace.spans.filter((span) => !span.parent && !span.background && span.endMs !== null);
  let covered = 0,
    reach = -Infinity;
  for (const span of [...top].sort((a, b) => a.startMs - b.startMs)) {
    const start = Math.max(span.startMs, reach);
    if (span.endMs! > start) covered += span.endMs! - start;
    reach = Math.max(reach, span.endMs!);
  }
  const sum = (spans: Span[]) => spans.reduce((total, span) => total + (span.endMs! - span.startMs), 0);
  const spanTotal = sum(top);
  return {
    correlationId: trace.correlationId,
    wallMs: round(now() - trace.origin),
    sequentialMs: round(covered),
    spanTotalMs: round(spanTotal),
    overlapMs: round(spanTotal - covered),
    backgroundMs: round(sum(trace.spans.filter((span) => span.background && span.endMs !== null))),
    spans: trace.spans.map((span) => ({
      ...span,
      startMs: round(span.startMs),
      endMs: span.endMs === null ? null : round(span.endMs),
    })),
  };
}
export type TraceReport = NonNullable<ReturnType<typeof traceReport>>;
