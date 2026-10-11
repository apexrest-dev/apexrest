import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { tokenSnapshot, tokenDelta, usageSelection } from '../../scripts/lib/plugin-test-metrics.mjs';
const message = (id, usage, extra = {}) => ({
  type: 'assistant',
  sessionId: 'session-one',
  timestamp: '2026-10-11T10:00:00Z',
  message: {
    id,
    model: 'fixture-model',
    usage,
    content: [{ text: 'PRIVATE_TEXT', input: { secret: 'PRIVATE_ARGUMENT' } }],
  },
  ...extra,
});
async function fixture(records) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-claude-metrics-'));
  const file = path.join(root, 'session-one.jsonl');
  await writeFile(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return { file, root };
}

test('Claude streamed usage deduplicates IDs with the last cache-normalized record', async () => {
  const { file } = await fixture([
    message('m1', { input_tokens: 2, output_tokens: 1 }),
    message('m1', {
      input_tokens: 3,
      cache_creation_input_tokens: 5,
      cache_read_input_tokens: 7,
      output_tokens: 4,
      output_tokens_details: { thinking_tokens: 2 },
    }),
  ]);
  const r = await tokenSnapshot(file, 'claude');
  assert.equal(r.events, 1);
  assert.deepEqual(r.counters, {
    input_tokens: 15,
    cached_input_tokens: 7,
    cache_write_input_tokens: 5,
    output_tokens: 4,
    total_tokens: 19,
    reasoning_output_tokens: 2,
  });
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE_TEXT|PRIVATE_ARGUMENT|content|secret/);
});

test('Claude cache-only turns and absent thinking counters yield actual normalized deltas', async () => {
  const { file } = await fixture([message('m1', { input_tokens: 2, output_tokens: 1 })]);
  const before = await tokenSnapshot(file, 'claude');
  await appendFile(
    file,
    JSON.stringify(
      message('m2', {
        input_tokens: 0,
        cache_read_input_tokens: 8,
        cache_creation_input_tokens: 3,
        output_tokens: 2,
      }),
    ) + '\n',
  );
  const delta = tokenDelta(before, await tokenSnapshot(file, 'auto'));
  assert.equal(delta.source, 'claude-code-transcript-usage');
  assert.equal(delta.counters.input_tokens, 11);
  assert.equal(delta.counters.uncached_input_tokens, 3);
  assert.equal('reasoning_output_tokens' in delta.counters, false);
  assert.match(delta.accounting, /normalized/);
});

test('inline and session-directory subagents remain separate and deduplicated', async () => {
  const { file, root } = await fixture([
    message('m1', { input_tokens: 2, output_tokens: 1 }),
    message('s1', { input_tokens: 4, output_tokens: 2 }, { isSidechain: true }),
  ]);
  await mkdir(path.join(root, 'session-one/subagents'), { recursive: true });
  await writeFile(
    path.join(root, 'session-one/subagents/agent-1.jsonl'),
    JSON.stringify(message('s1', { input_tokens: 5, output_tokens: 3 })) + '\n',
  );
  const r = await tokenSnapshot(file, 'claude');
  assert.equal(r.counters.total_tokens, 3);
  assert.equal(r.sidechainCounters.total_tokens, 8);
  assert.equal(r.sidechainEvents, 1);
  assert.equal(r.sidechainsFound, true);
});

test('Claude usage rejects unchanged events, cross-session and shrinking counters', async () => {
  const { file } = await fixture([message('m1', { input_tokens: 10, output_tokens: 3 })]);
  const before = await tokenSnapshot(file, 'claude');
  assert.equal(tokenDelta(before, before).available, false);
  assert.equal(tokenDelta(before, { ...before, sessionId: 'different', events: 2 }).available, false);
  assert.equal(
    tokenDelta(before, { ...before, events: 2, counters: { ...before.counters, input_tokens: 1 } }).available,
    false,
  );
  assert.equal(tokenDelta(before, { ...before, events: 0 }).available, false);
});

test('unknown formats, unreadable files and conflicting CLI selectors fail closed', async () => {
  const { file } = await fixture([{ unknown: 'PRIVATE_TEXT' }]);
  assert.equal((await tokenSnapshot(file, 'auto')).available, false);
  assert.equal((await tokenSnapshot(file + '-absent', 'claude')).available, false);
  assert.throws(() => usageSelection({ rollout: 'x', transcript: 'y' }));
  assert.deepEqual(usageSelection({ transcript: 'x' }), { file: 'x', source: 'claude' });
});
