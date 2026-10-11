import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { tokenSnapshot, tokenDelta, statistics } from '../../scripts/lib/plugin-test-metrics.mjs';

test('host metrics ignore content, count cached tokens once and reject stale/reset/cross-session usage', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'plugin-metrics-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'session.jsonl');
  const usage = (input, cached, output) => ({
    input_tokens: input,
    cached_input_tokens: cached,
    output_tokens: output,
    total_tokens: input + output,
  });
  const event = (u, timestamp) => ({
    type: 'event_msg',
    timestamp,
    payload: { type: 'token_count', info: { total_token_usage: u } },
  });
  await writeFile(
    file,
    [
      { type: 'session_meta', payload: { id: 'session-one' } },
      { type: 'response_item', payload: { text: 'PRIVATE_SENTINEL' } },
      event(usage(100, 80, 10), '2026-10-11T00:00:00Z'),
    ]
      .map(JSON.stringify)
      .join('\n') + '\n',
  );
  const before = await tokenSnapshot(file);
  await writeFile(file, JSON.stringify(event(usage(160, 120, 30), '2026-10-11T00:01:00Z')) + '\n', {
    flag: 'a',
  });
  const after = await tokenSnapshot(file);
  const delta = tokenDelta(before, after);
  assert.equal(delta.counters.total_tokens, 80);
  assert.equal(delta.counters.uncached_input_tokens, 20);
  assert.equal(JSON.stringify(after).includes('PRIVATE_SENTINEL'), false);
  assert.equal(tokenDelta(after, after).available, false);
  assert.equal(tokenDelta(before, { ...after, sessionId: 'another' }).available, false);
  assert.equal(tokenDelta(after, { ...before, events: after.events + 1 }).available, false);
  assert.equal((await tokenSnapshot(path.join(root, 'missing'))).available, false);
  assert.equal((await tokenSnapshot()).available, false);
});

test('latency statistics use nearest ranks and label insufficient samples', () => {
  assert.equal(statistics([]), null);
  assert.deepEqual([statistics([4, 1, 3, 2]).medianMs, statistics([4, 1, 3, 2]).p95Ms], [2, 4]);
  assert.match(statistics([1]).interpretation, /Small sample/);
});
