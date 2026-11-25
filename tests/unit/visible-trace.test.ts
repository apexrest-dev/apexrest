import test from 'node:test';
import assert from 'node:assert/strict';
import { BROWSER_WAIT, operationReport, type StageEvent } from '../../scripts/bench/lib/visible-trace.ts';

const op = 'op-1';
const at = (
  stage: StageEvent['stage'],
  startedAt: number,
  endedAt: number,
  extra: Partial<StageEvent> = {},
) => ({
  operationId: op,
  stage,
  startedAt,
  endedAt,
  ...extra,
});

test('a complete trace reports elapsed visible time separately from stage durations and gaps', () => {
  const events: StageEvent[] = [
    at('prompt', 0, 100),
    at('model', 400, 2400),
    at('tool', 2500, 2600),
    at('source-mutation', 2600, 2610, { marker: 'M1', revision: 'r1' }),
    at('preview-ready', 2610, 2640),
    at('live-notification', 2610, 2760),
    at('dom-update', 2760, 3100, { marker: 'M1' }),
    at('visible-frame', 3100, 3133, { marker: 'M1' }),
  ];
  const report = operationReport(op, events);
  assert.equal(report.elapsedVisibleMs, 3133);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.gapsMs.slice(0, 2), [
    { after: 'prompt', before: 'model', ms: 300 },
    { after: 'model', before: 'tool', ms: 100 },
  ]);
  assert.equal(report.sumOfStagesMs, 100 + 2000 + 100 + 10 + 30 + 150 + 340 + 33);
});

test('missing observations stay unknown and no visible total is fabricated', () => {
  const report = operationReport(op, [
    at('source-mutation', 0, 1, { marker: 'M1', revision: 'r1' }),
    at('preview-ready', 1, 20),
    at('live-notification', 1, 150),
  ]);
  assert.equal(report.elapsedVisibleMs, null);
  assert.deepEqual(report.missing, ['prompt', 'model', 'tool', 'dom-update', 'visible-frame']);
  assert.equal(report.stages['visible-frame'], 'unknown');
});

test('overlapping edits are never credited to each other', () => {
  const events: StageEvent[] = [
    at('source-mutation', 0, 1, { marker: 'M1', revision: 'r1' }),
    // The next edit's browser result and another operation's notification.
    at('dom-update', 50, 90, { marker: 'M2' }),
    at('visible-frame', 90, 100, { marker: 'M2' }),
    at('preview-ready', 1, 20, { revision: 'r2' }),
    { ...at('live-notification', 1, 150), operationId: 'op-2' },
  ];
  const report = operationReport(op, events);
  assert.deepEqual(
    report.misattributed.map((entry) => entry.stage),
    ['dom-update', 'visible-frame', 'preview-ready'],
  );
  assert.equal(report.stages['dom-update'], 'unknown');
  assert.equal(report.stages['live-notification'], 'unknown', 'another operation is ignored');
  assert.equal(report.elapsedVisibleMs, null);
});

test('the browser check needs the marker, no running refresh and a rendered frame', async () => {
  const frames: (() => void)[] = [];
  let busy = true;
  const page = { innerText: 'old title' };
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = { document: globals.document, requestAnimationFrame: globals.requestAnimationFrame };
  globals.document = {
    body: page,
    querySelector: () => (busy ? {} : null),
  };
  globals.requestAnimationFrame = (callback: () => void) => frames.push(callback);
  try {
    const wait = (
      new Function(`return ${BROWSER_WAIT}`)() as (
        marker: string,
        timeoutMs: number,
      ) => Promise<{ domAt: number; frameAt: number }>
    )('M1', 2000);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(frames.length, 0, 'marker absent');
    page.innerText = 'title M1';
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(frames.length, 0, 'a region is still refreshing');
    busy = false;
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(frames.length, 1);
    frames.shift()!();
    assert.equal(frames.length, 1, 'waits for a second frame');
    frames.shift()!();
    const result = await wait;
    assert.ok(result.frameAt >= result.domAt);
  } finally {
    globals.document = saved.document;
    globals.requestAnimationFrame = saved.requestAnimationFrame;
  }
});
