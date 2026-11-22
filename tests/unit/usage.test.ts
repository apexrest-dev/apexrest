import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dispatch } from '../../packages/core/src/service.ts';
import { observeUsage, importUsage, usageStatus } from '../../packages/core/src/usage.ts';
import { success } from '../../packages/core/src/result.ts';

async function setup(t: import('node:test').TestContext, enabled = true) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-usage-'));
  const previous = {
    home: process.env.APEXREST_HOME,
    usage: process.env.APEXREST_USAGE,
    host: process.env.APEXREST_HOST,
  };
  process.env.APEXREST_HOME = root;
  process.env.APEXREST_HOST = 'codex';
  delete process.env.APEXREST_USAGE;
  t.after(async () => {
    for (const [key, value] of Object.entries({
      APEXREST_HOME: previous.home,
      APEXREST_USAGE: previous.usage,
      APEXREST_HOST: previous.host,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  });
  if (enabled) assert.equal((await dispatch('settings.configure', { usageLog: 'on' })).ok, true);
  return { root, file: path.join(root, 'usage-log.json') };
}

test('usage logging is opt-in and the master off switch prevents writes', async (t) => {
  const { root, file } = await setup(t, false);
  await dispatch('version');
  await assert.rejects(readFile(file), { code: 'ENOENT' });
  assert.equal((await usageStatus()).enabled, false);
  await assert.rejects(importUsage('codex', path.join(root, 'not-read')), { code: 'USAGE_LOG_DISABLED' });
  await dispatch('settings.configure', { usageLog: 'on' });
  process.env.APEXREST_USAGE = '0';
  await dispatch('version');
  await assert.rejects(readFile(file), { code: 'ENOENT' });
});

test('nested dispatch logs one outcome with measured backend time and unavailable host tokens', async (t) => {
  const { file } = await setup(t);
  const result = await dispatch('reference', { mode: 'search', query: 'interactive grid' });
  assert.equal(result.ok, true);
  const status = await usageStatus();
  assert.equal(status.entries.length, 1);
  const entry = status.entries[0]!;
  assert.equal(entry.scope, 'plugin-operation');
  assert.equal(entry.operation, 'reference');
  assert.equal(entry.host, 'codex');
  assert.equal(entry.durationSource, 'plugin-clock');
  assert.ok(typeof entry.durationMs === 'number' && entry.durationMs >= 0);
  assert.deepEqual(entry.tokens, { available: false, reason: 'host-counters-unavailable' });
  assert.equal((await dispatch('usage.status', {})).ok, true);
  assert.equal((await usageStatus()).retainedEntries, 1, 'reading the log never creates a record');
  if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o077, 0);
  assert.ok(!(await readFile(file, 'utf8')).includes('interactive grid'));
});

test('Decisions usage stores measured counters with provenance and no payload, prompt or credential data', async (t) => {
  const { file } = await setup(t);
  const result = success('docs.select', {
    selection: {
      model: 'gpt-6-luna',
      usage: {
        input_tokens: 100,
        input_tokens_details: { cached_tokens: 30, cache_write_tokens: 20 },
        output_tokens: 15,
        output_tokens_details: { reasoning_tokens: 5 },
        total_tokens: 115,
      },
    },
    prompt: 'private fixture prompt',
    api_key: 'fixture-credential',
  });
  assert.equal(
    await observeUsage(
      'docs.select',
      async () => result,
      () => 12,
    ),
    result,
  );
  const entry = (await usageStatus()).entries[0]!;
  assert.equal(entry.sqlclMs, 12);
  assert.deepEqual(entry.tokens, {
    available: true,
    source: 'openai-decisions',
    model: 'gpt-6-luna',
    inputTokens: 100,
    cachedInputTokens: 30,
    cacheWriteInputTokens: 20,
    outputTokens: 15,
    reasoningOutputTokens: 5,
    totalTokens: 115,
  });
  const stored = await readFile(file, 'utf8');
  assert.ok(!stored.includes('private fixture prompt') && !stored.includes('fixture-credential'));
});

test('native Codex imports are content-deduplicated and distinct from backend timings', async (t) => {
  const { root, file } = await setup(t);
  const input = path.join(root, 'run.jsonl');
  const events = [
    { type: 'thread.started', thread_id: 'fixture-thread', model: 'gpt-6.1-sol' },
    { type: 'item.completed', item: { text: 'private fixture prompt' } },
    { type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 10 } },
  ];
  await writeFile(input, events.map((event) => JSON.stringify(event)).join('\n'));
  const imported = await importUsage('codex', input, 1234);
  assert.equal(imported.recorded, true);
  assert.equal(imported.entry.scope, 'host-run');
  assert.equal(imported.entry.durationMs, 1234);
  assert.equal(imported.entry.durationSource, 'caller-measured');
  assert.deepEqual(imported.entry.tokens, {
    available: true,
    source: 'codex-cli',
    model: 'gpt-6.1-sol',
    inputTokens: 100,
    cachedInputTokens: 40,
    outputTokens: 10,
    totalTokens: 110,
  });
  const repeated = await importUsage('codex', input, 5678);
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.entry.durationMs, 1234, 'duplicate imports return the stored measurement');
  assert.equal((await usageStatus()).retainedEntries, 1);
  const stored = await readFile(file, 'utf8');
  assert.ok(
    !stored.includes(input) &&
      !stored.includes('private fixture prompt') &&
      !stored.includes('fixture-thread'),
  );
  const other = path.join(root, 'other.jsonl');
  await writeFile(other, events.map((event) => JSON.stringify(event)).join('\n'));
  assert.equal(
    (await importUsage('codex', other)).duplicate,
    true,
    'same contents at another path do not double count',
  );
});

test('Claude result imports normalize cache accounting, preserve model and use host duration', async (t) => {
  const { root } = await setup(t);
  const input = path.join(root, 'run.json');
  await writeFile(
    input,
    JSON.stringify(
      {
        type: 'result',
        is_error: false,
        result: 'private answer',
        duration_ms: 1450,
        modelUsage: { 'claude-opus-5-5': {} },
        usage: {
          input_tokens: 10,
          cache_read_input_tokens: 30,
          cache_creation_input_tokens: 20,
          output_tokens: 15,
        },
      },
      null,
      2,
    ),
  );
  const imported = await importUsage('claude', input);
  assert.equal(imported.entry.durationMs, 1450);
  assert.equal(imported.entry.durationSource, 'host-report');
  assert.deepEqual(imported.entry.tokens, {
    available: true,
    source: 'claude-cli',
    model: 'claude-opus-5-5',
    inputTokens: 60,
    cachedInputTokens: 30,
    cacheWriteInputTokens: 20,
    outputTokens: 15,
    totalTokens: 75,
  });
});

test('Codex cumulative optional counters retain the final complete report without summing subsets', async (t) => {
  const { root } = await setup(t);
  const input = path.join(root, 'optional-counters.jsonl');
  const turns = [
    {
      type: 'turn.completed',
      usage: {
        input_tokens: 100,
        cached_input_tokens: 40,
        cache_write_input_tokens: 0,
        output_tokens: 10,
        reasoning_output_tokens: 4,
      },
    },
    {
      type: 'turn.completed',
      usage: {
        input_tokens: 120,
        cached_input_tokens: 45,
        cache_write_input_tokens: 3,
        output_tokens: 15,
        reasoning_output_tokens: 6,
      },
    },
  ];
  const write = (values: object[], id = 'fixture-thread') =>
    writeFile(
      input,
      [{ type: 'thread.started', thread_id: id }, ...values].map((event) => JSON.stringify(event)).join('\n'),
    );
  await write(turns);
  const complete = await importUsage('codex', input, 100, 'cumulative-session');
  assert.ok(complete.entry.tokens.available);
  assert.equal(complete.entry.tokens.cacheWriteInputTokens, 3);
  assert.equal(complete.entry.tokens.reasoningOutputTokens, 6);
  assert.equal(
    'model' in complete.entry.tokens,
    false,
    'model identity is present only when native events report it',
  );
  const total = (await usageStatus()).totalsByScopeAndSource[0]!.tokens!;
  assert.equal(total.cacheWriteInputTokens, 3);
  assert.equal(total.reasoningOutputTokens, 6);

  const partial = structuredClone(turns);
  delete (partial[1]!.usage as Partial<(typeof partial)[1]['usage']>).cache_write_input_tokens;
  delete (partial[1]!.usage as Partial<(typeof partial)[1]['usage']>).reasoning_output_tokens;
  await write(partial, 'partial-cumulative');
  await assert.rejects(importUsage('codex', input, 100, 'cumulative-session'), {
    code: 'USAGE_SOURCE_INVALID',
  });
  await write([partial[1]!], 'partial-single');
  const incomplete = await importUsage('codex', input);
  assert.ok(incomplete.entry.tokens.available);
  assert.equal('cacheWriteInputTokens' in incomplete.entry.tokens, false);
  assert.equal('reasoningOutputTokens' in incomplete.entry.tokens, false);
  const mixed = (await usageStatus()).totalsByScopeAndSource[0]!.tokens!;
  assert.equal('cacheWriteInputTokens' in mixed, false);
  assert.equal('reasoningOutputTokens' in mixed, false);

  for (const [source, bad] of [
    ['cache_write_input_tokens', 101],
    ['reasoning_output_tokens', 11],
  ] as const) {
    const invalid = structuredClone(turns);
    invalid[0]!.usage[source] = bad;
    await write(invalid);
    await assert.rejects(importUsage('codex', input, 100, 'cumulative-session'), {
      code: 'USAGE_SOURCE_INVALID',
    });
  }
});

test('actual resumed Codex cumulative reports require an explicit mode and reconcile with rollout deltas', async (t) => {
  const { root, file } = await setup(t);
  const input = path.join(root, 'resumed.jsonl');
  const first = {
    input_tokens: 294114,
    cached_input_tokens: 259712,
    cache_write_input_tokens: 0,
    output_tokens: 1735,
    reasoning_output_tokens: 136,
  };
  const final = {
    input_tokens: 381346,
    cached_input_tokens: 345728,
    cache_write_input_tokens: 0,
    output_tokens: 1863,
    reasoning_output_tokens: 136,
  };
  const capture = [
    { type: 'thread.started', thread_id: 'private-resumed-thread' },
    { type: 'turn.started' },
    { type: 'turn.completed', usage: first },
    { type: 'thread.started', thread_id: 'private-resumed-thread' },
    { type: 'turn.started' },
    { type: 'turn.completed', usage: final },
  ];
  await writeFile(input, capture.map((event) => JSON.stringify(event)).join('\n'));
  await assert.rejects(importUsage('codex', input, 88159.168417), { code: 'USAGE_COUNTER_MODE_REQUIRED' });
  assert.equal((await usageStatus()).retainedEntries, 0);
  const routed = await dispatch('usage.import', {
    host: 'codex',
    file: input,
    elapsedMs: 88159.168417,
    counterMode: 'cumulative-session',
  });
  assert.equal(routed.ok, true);
  const imported = routed.data as Awaited<ReturnType<typeof importUsage>>;
  assert.deepEqual(imported.entry.tokens, {
    available: true,
    source: 'codex-cli',
    inputTokens: 381346,
    cachedInputTokens: 345728,
    cacheWriteInputTokens: 0,
    outputTokens: 1863,
    reasoningOutputTokens: 136,
    totalTokens: 383209,
  });
  assert.equal(imported.entry.counterMode, 'cumulative-session');
  assert.match(imported.entry.nativeSessionHash!, /^[a-f0-9]{64}$/);
  assert.equal(final.input_tokens - first.input_tokens, 87232);
  assert.equal(final.output_tokens - first.output_tokens, 128);
  assert.equal((await importUsage('codex', input, 88159.168417, 'cumulative-session')).duplicate, true);
  assert.equal((await usageStatus()).retainedEntries, 1);
  assert.equal((await readFile(file, 'utf8')).includes('private-resumed-thread'), false);
  for (const invalid of [
    capture.map((event, index) => (index === 3 ? { ...event, thread_id: 'other-thread' } : event)),
    capture.slice(0, -1),
    [...capture, { type: 'thread.started', thread_id: 'private-resumed-thread' }],
    [
      ...capture.slice(0, -1),
      { type: 'turn.completed', usage: { ...final, input_tokens: 100, cached_input_tokens: 40 } },
    ],
  ]) {
    await writeFile(input, invalid.map((event) => JSON.stringify(event)).join('\n'));
    await assert.rejects(importUsage('codex', input, 88159.168417, 'cumulative-session'));
  }
  assert.equal((await usageStatus()).retainedEntries, 1);
});

test('cumulative session revisions replace one entry under the journal lock and refuse overlap or regression', async (t) => {
  const { root, file } = await setup(t);
  const input = path.join(root, 'cumulative.jsonl');
  const capture = async (usage: object, extra: object[] = []) =>
    writeFile(
      input,
      [
        { type: 'thread.started', thread_id: 'revision-thread' },
        { type: 'turn.started' },
        { type: 'turn.completed', usage },
        ...extra,
      ]
        .map((event) => JSON.stringify(event))
        .join('\n'),
    );
  const first = { input_tokens: 100, cached_input_tokens: 40, output_tokens: 10, reasoning_output_tokens: 2 };
  const final = {
    input_tokens: 250,
    cached_input_tokens: 100,
    output_tokens: 30,
    reasoning_output_tokens: 5,
  };
  await capture(first);
  await importUsage('codex', input, 100, 'cumulative-session');
  await capture(final);
  const revised = await importUsage('codex', input, 180, 'cumulative-session');
  assert.equal('revised' in revised && revised.revised, true);
  assert.equal((await usageStatus()).retainedEntries, 1);
  assert.equal((await usageStatus()).totalsByScopeAndSource[0]!.tokens!.inputTokens, 250);
  const stable = await readFile(file, 'utf8');
  assert.equal((await importUsage('codex', input, 180, 'cumulative-session')).duplicate, true);
  assert.equal(await readFile(file, 'utf8'), stable);
  await capture(final, [{ type: 'capture-note', message: 'same native counters, different file bytes' }]);
  assert.equal((await importUsage('codex', input, 180, 'cumulative-session')).duplicate, true);
  assert.equal(await readFile(file, 'utf8'), stable);
  for (const [usage, elapsed] of [
    [{ ...final, input_tokens: 200 }, 190],
    [{ ...final, reasoning_output_tokens: undefined }, 190],
    [{ ...final, input_tokens: 300 }, 170],
    [{ ...final, input_tokens: 300 }, undefined],
  ] as const) {
    await capture(usage);
    await assert.rejects(importUsage('codex', input, elapsed, 'cumulative-session'), {
      code: 'USAGE_SESSION_OVERLAP',
    });
  }
  await capture({ ...final, input_tokens: 300 });
  await assert.rejects(importUsage('codex', input, 200), { code: 'USAGE_SESSION_OVERLAP' });
  assert.equal(await readFile(file, 'utf8'), stable);
  // Distinct fresh single-turn imports retain historical accounting; old entries without identity stay unchanged.
  const stored = JSON.parse(stable);
  delete stored.entries[0].nativeSessionHash;
  delete stored.entries[0].counterMode;
  await writeFile(file, JSON.stringify(stored));
  const legacy = structuredClone(stored.entries[0]);
  await writeFile(
    input,
    JSON.stringify({ type: 'thread.started', thread_id: 'fresh-thread' }) +
      '\n' +
      JSON.stringify({ type: 'turn.completed', usage: first }),
  );
  const fresh = await importUsage('codex', input, 10);
  assert.ok(fresh.entry.tokens.available);
  assert.equal(fresh.entry.tokens.inputTokens, 100);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).entries[0], legacy);
  await capture({ ...first, input_tokens: 101 });
  // A default single-turn prefix cannot be silently merged into another capture of the same session.
  await writeFile(input, (await readFile(input, 'utf8')).replace('revision-thread', 'fresh-thread'));
  await assert.rejects(importUsage('codex', input, 20, 'cumulative-session'), {
    code: 'USAGE_SESSION_OVERLAP',
  });
});

test('a revised live session moves after older records so bounded retention keeps its newest capture', async (t) => {
  const { root, file } = await setup(t);
  const input = path.join(root, 'retained-session.jsonl');
  const capture = (inputTokens: number) =>
    writeFile(
      input,
      [
        { type: 'thread.started', thread_id: 'long-live-session' },
        {
          type: 'turn.completed',
          usage: { input_tokens: inputTokens, cached_input_tokens: 0, output_tokens: 10 },
        },
      ]
        .map((event) => JSON.stringify(event))
        .join('\n'),
    );
  await capture(100);
  const prefix = await importUsage('codex', input, 100, 'cumulative-session');
  const older = { ...prefix.entry, at: '2026-01-01T00:00:00.000Z' };
  delete older.importDigest;
  delete older.nativeSessionHash;
  delete older.counterMode;
  await writeFile(
    file,
    JSON.stringify({
      schemaVersion: 1,
      entries: [prefix.entry, ...Array.from({ length: 999 }, () => older)],
    }),
  );
  await capture(200);
  const revised = await importUsage('codex', input, 200, 'cumulative-session');
  let entries = JSON.parse(await readFile(file, 'utf8')).entries;
  assert.equal(entries.length, 1000);
  assert.equal(entries.at(-1).nativeSessionHash, revised.entry.nativeSessionHash);
  await writeFile(
    input,
    JSON.stringify({ type: 'thread.started', thread_id: 'next-session' }) +
      '\n' +
      JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } }),
  );
  await importUsage('codex', input, 1);
  entries = JSON.parse(await readFile(file, 'utf8')).entries;
  assert.equal(entries.length, 1000);
  const retained = entries.filter(
    (entry: { nativeSessionHash?: string }) => entry.nativeSessionHash === revised.entry.nativeSessionHash,
  );
  assert.equal(retained.length, 1);
  assert.equal(retained[0].tokens.inputTokens, 200);
});

test('Claude provider-less synthetic error zeros remain unavailable while genuine error usage is retained', async (t) => {
  const { root } = await setup(t);
  const input = path.join(root, 'claude-error.jsonl');
  const error = {
    type: 'result',
    is_error: true,
    terminal_reason: 'api_error',
    duration_api_ms: 0,
    duration_ms: 48,
    modelUsage: {},
    usage: { input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 0 },
  };
  await writeFile(
    input,
    JSON.stringify({ type: 'assistant', message: { model: '<synthetic>', usage: error.usage } }) +
      '\n' +
      JSON.stringify(error),
  );
  await assert.rejects(importUsage('claude', input), { code: 'USAGE_COUNTERS_UNAVAILABLE' });
  assert.equal((await usageStatus()).retainedEntries, 0);
  await writeFile(input, JSON.stringify({ ...error, usage: { ...error.usage, input_tokens: 12 } }));
  const measured = await importUsage('claude', input);
  assert.equal(measured.entry.ok, false);
  assert.ok(measured.entry.tokens.available);
  assert.equal(measured.entry.tokens.inputTokens, 12);
  await writeFile(input, JSON.stringify({ ...error, modelUsage: { 'claude-opus-5-5': {} } }));
  const providerZero = await importUsage('claude', input);
  assert.ok(providerZero.entry.tokens.available);
  assert.equal(providerZero.entry.tokens.totalTokens, 0);
  await assert.rejects(importUsage('claude', input, 48, 'cumulative-session'), {
    code: 'USAGE_SOURCE_INVALID',
  });
});

test('imports refuse missing counters, mixed runs and oversized files', async (t) => {
  const { root } = await setup(t);
  const input = path.join(root, 'run.jsonl');
  for (const events of [
    [{ type: 'thread.started', thread_id: 'one' }],
    [
      { type: 'thread.started', thread_id: 'one' },
      { type: 'thread.started', thread_id: 'two' },
      { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } },
    ],
  ]) {
    await writeFile(input, events.map((event) => JSON.stringify(event)).join('\n'));
    await assert.rejects(importUsage('codex', input), { code: 'USAGE_COUNTERS_UNAVAILABLE' });
  }
  await writeFile(input, 'x'.repeat(8 * 1024 * 1024 + 1));
  await assert.rejects(importUsage('codex', input), { code: 'USAGE_SOURCE_UNSAFE' });
  assert.equal((await usageStatus()).retainedEntries, 0);
});

test('concurrent logging is bounded and logging failures preserve successful outcomes', async (t) => {
  const { file } = await setup(t);
  const result = success('version', { version: 'fixture' });
  await Promise.all(
    Array.from({ length: 8 }, () =>
      observeUsage(
        'version',
        async () => result,
        () => 0,
      ),
    ),
  );
  assert.equal((await usageStatus()).retainedEntries, 8);
  const stored = JSON.parse(await readFile(file, 'utf8'));
  stored.entries = Array.from({ length: 1000 }, () => stored.entries[0]);
  await writeFile(file, JSON.stringify(stored));
  await observeUsage(
    'version',
    async () => result,
    () => 0,
  );
  assert.equal((await usageStatus()).retainedEntries, 1000);
  await writeFile(file, 'broken log');
  assert.equal(
    await observeUsage(
      'version',
      async () => result,
      () => 0,
    ),
    result,
  );
});

test('Decisions rejects impossible subsets and totals while preserving the operation outcome', async (t) => {
  await setup(t);
  const valid = {
    input_tokens: 100,
    input_tokens_details: { cached_tokens: 30, cache_write_tokens: 20 },
    output_tokens: 15,
    output_tokens_details: { reasoning_tokens: 5 },
    total_tokens: 115,
  };
  for (const usage of [
    { ...valid, input_tokens_details: { cached_tokens: 101, cache_write_tokens: 0 } },
    { ...valid, input_tokens_details: { cached_tokens: 70, cache_write_tokens: 50 } },
    { ...valid, output_tokens_details: { reasoning_tokens: 16 } },
    { ...valid, total_tokens: 114 },
  ]) {
    const result = success('docs.select', { selection: { model: 'fixture-model', usage } });
    assert.equal(
      await observeUsage(
        'docs.select',
        async () => result,
        () => 0,
      ),
      result,
    );
  }
  const status = await usageStatus();
  assert.equal(status.retainedEntries, 4);
  assert.ok(status.entries.every((entry) => !entry.tokens.available));
});

test('unfinished Codex output cannot be imported before its final usage event', async (t) => {
  const { root } = await setup(t);
  const file = path.join(root, 'partial-native.jsonl');
  const partial = [
    { type: 'thread.started', thread_id: 'one-thread' },
    { type: 'turn.started' },
    { type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 } },
    { type: 'turn.started' },
  ];
  await writeFile(file, partial.map((event) => JSON.stringify(event)).join('\n'));
  await assert.rejects(importUsage('codex', file), { code: 'USAGE_COUNTERS_UNAVAILABLE' });
  assert.equal((await usageStatus()).retainedEntries, 0);
  const failed = [...partial, { type: 'turn.failed', error: { message: 'fixture failure' } }];
  await writeFile(file, failed.map((event) => JSON.stringify(event)).join('\n'));
  await assert.rejects(importUsage('codex', file), { code: 'USAGE_COUNTERS_UNAVAILABLE' });
  const complete = [
    ...partial,
    {
      type: 'turn.completed',
      usage: { input_tokens: 120, cached_input_tokens: 0, output_tokens: 15 },
    },
  ];
  await writeFile(file, complete.map((event) => JSON.stringify(event)).join('\n'));
  assert.equal((await importUsage('codex', file, 100, 'cumulative-session')).recorded, true);
  assert.equal((await importUsage('codex', file, 100, 'cumulative-session')).duplicate, true);
  const summary = (await usageStatus()).totalsByScopeAndSource;
  assert.equal(summary[0]!.tokens!.inputTokens, 120);
  assert.equal(summary[0]!.records, 1);
});

test('Codex imports reject repeated sessions, unmatched completions and invalid per-turn subsets', async (t) => {
  const { root } = await setup(t);
  const file = path.join(root, 'invalid-native.jsonl');
  const session = { type: 'thread.started', thread_id: 'one-thread' };
  const completed = {
    type: 'turn.completed',
    usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 },
  };
  const cases = [
    {
      events: [session, session, completed],
      code: 'USAGE_COUNTER_MODE_REQUIRED',
      mode: undefined,
    },
    {
      events: [session, { type: 'turn.started' }, completed, completed],
      code: 'USAGE_SOURCE_INVALID',
      mode: 'cumulative-session' as const,
    },
    {
      events: [
        session,
        {
          ...completed,
          usage: { ...completed.usage, cached_input_tokens: 80, cache_write_input_tokens: 80 },
        },
        { ...completed, usage: { ...completed.usage, cache_write_input_tokens: 0 } },
      ],
      code: 'USAGE_SOURCE_INVALID',
      mode: 'cumulative-session' as const,
    },
  ];
  for (const { events, code, mode } of cases) {
    await writeFile(file, events.map((event) => JSON.stringify(event)).join('\n'));
    await assert.rejects(importUsage('codex', file, 100, mode), { code });
  }
  assert.equal((await usageStatus()).retainedEntries, 0);
});

test('usage retention keeps schema-valid model-heavy records within the readable byte limit', async (t) => {
  const { root, file } = await setup(t);
  const input = path.join(root, 'many-models.json');
  await writeFile(
    input,
    JSON.stringify({
      type: 'result',
      duration_ms: 1,
      modelUsage: Object.fromEntries(
        Array.from({ length: 16 }, (_, index) => [
          'm' + String(index).padStart(2, '0') + 'x'.repeat(117),
          {},
        ]),
      ),
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
  );
  const imported = await importUsage('claude', input);
  // Compatibility fixture for the old valid store that exceeded its own read limit.
  await writeFile(
    file,
    JSON.stringify({
      schemaVersion: 1,
      entries: Array.from({ length: 1000 }, () => imported.entry),
    }),
  );
  assert.ok((await stat(file)).size > 2 * 1024 * 1024);
  const retained = await usageStatus();
  assert.ok(retained.retainedEntries > 0 && retained.retainedEntries < 1000);
  const result = success('version', { version: 'fixture' });
  assert.equal(
    await observeUsage(
      'version',
      async () => result,
      () => 0,
    ),
    result,
  );
  assert.ok((await stat(file)).size <= 2 * 1024 * 1024);
  assert.equal((await usageStatus()).entries[0]!.scope, 'plugin-operation');
});
