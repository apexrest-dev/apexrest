import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  Fault
} from "./chunk-HRRL6FHO.mjs";

// packages/core/src/spans.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
var storage = new AsyncLocalStorage();
var now = () => performance.timeOrigin + performance.now();
function withTrace(action, options = {}) {
  if (storage.getStore()) return action();
  return storage.run(
    {
      trace: {
        correlationId: options.correlationId ?? randomUUID(),
        origin: options.origin ?? now(),
        spans: []
      }
    },
    action
  );
}
var correlationId = () => storage.getStore()?.trace.correlationId;
var status = (error) => {
  if (error instanceof Fault) {
    if (error.code === "CANCELLED" || error.status === "cancelled") return "cancelled";
    if (error.code === "OUTCOME_UNKNOWN" || error.status === "outcome_unknown") return "unknown";
  }
  return "failed";
};
function openSpan(name, attributes, options = {}) {
  const store = storage.getStore();
  if (!store) return { end: () => void 0, fail: () => void 0, set: () => void 0, id: void 0 };
  const { trace } = store;
  const parent = options.parent ?? store.parent;
  const span = {
    id: trace.spans.length + 1,
    name,
    ...parent ? { parent } : {},
    startMs: now() - trace.origin,
    endMs: null,
    status: "unfinished",
    ...options.background ? { background: true } : {},
    ...attributes ? { attributes: { ...attributes } } : {}
  };
  trace.spans.push(span);
  const set = (more) => {
    span.attributes = { ...span.attributes, ...more };
  };
  return {
    id: span.id,
    set,
    end: (more) => {
      if (span.status !== "unfinished") return;
      if (more) set(more);
      span.endMs = now() - trace.origin;
      span.status = "ok";
    },
    /** A failure or cancellation ends now; an unknown outcome keeps no end time. */
    fail: (error) => {
      if (span.status !== "unfinished") return;
      span.status = status(error);
      if (span.status !== "unknown") span.endMs = now() - trace.origin;
    }
  };
}
async function spanned(name, action, attributes, parent) {
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
function measuredSpan(name, start, end, attributes, parent) {
  const store = storage.getStore();
  if (!store) return void 0;
  const { trace } = store;
  const id = trace.spans.length + 1;
  trace.spans.push({
    id,
    name,
    ...parent ? { parent } : {},
    startMs: start - trace.origin,
    endMs: end - trace.origin,
    status: "ok",
    ...attributes ? { attributes: { ...attributes } } : {}
  });
  return id;
}
var round = (value) => Math.round(value * 10) / 10;
function traceReport() {
  const store = storage.getStore();
  if (!store) return void 0;
  const { trace } = store;
  const top = trace.spans.filter((span) => !span.parent && !span.background && span.endMs !== null);
  let covered = 0, reach = -Infinity;
  for (const span of [...top].sort((a, b) => a.startMs - b.startMs)) {
    const start = Math.max(span.startMs, reach);
    if (span.endMs > start) covered += span.endMs - start;
    reach = Math.max(reach, span.endMs);
  }
  const sum = (spans) => spans.reduce((total, span) => total + (span.endMs - span.startMs), 0);
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
      endMs: span.endMs === null ? null : round(span.endMs)
    }))
  };
}

export {
  withTrace,
  correlationId,
  openSpan,
  spanned,
  measuredSpan,
  traceReport
};
