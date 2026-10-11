import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname } from 'node:path';

const counters = [
  'input_tokens',
  'cached_input_tokens',
  'cache_write_input_tokens',
  'output_tokens',
  'reasoning_output_tokens',
  'total_tokens',
];

// Inspect only usage records. Never copy messages, tool arguments or credentials.
export async function tokenSnapshot(file) {
  if (!file) return { available: false, reason: 'No host usage source supplied.' };
  let latest;
  let sessionId;
  let model;
  let events = 0;
  const input = createReadStream(file, { encoding: 'utf8' });
  input.on('error', () => {});
  try {
    for await (const line of createInterface({ input, crlfDelay: Infinity })) {
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (record.type === 'session_meta') sessionId = record.payload?.id;
      if (record.type === 'turn_context') model = record.payload?.model;
      if (record.type !== 'event_msg' || record.payload?.type !== 'token_count') continue;
      const usage = record.payload.info?.total_token_usage;
      if (
        !usage ||
        counters.some((key) => usage[key] != null && (!Number.isFinite(usage[key]) || usage[key] < 0))
      )
        continue;
      events++;
      latest = {
        available: true,
        timestamp: record.timestamp,
        counters: Object.fromEntries(
          counters.filter((key) => usage[key] != null).map((key) => [key, usage[key]]),
        ),
      };
    }
  } catch {
    return { available: false, reason: 'Host usage source is unreadable.' };
  }
  return latest
    ? { ...latest, sessionId, model, events }
    : { available: false, reason: 'Host supplied no token_count records.' };
}

export function tokenDelta(before, after) {
  const unavailable = (reason) => ({ available: false, reason });
  if (!before?.available || !after?.available) return unavailable('Missing usage checkpoint.');
  if (!before.sessionId || before.sessionId !== after.sessionId)
    return unavailable('Checkpoints are not bound to the same host session.');
  if (after.events <= before.events)
    return unavailable('No new host usage event; zero usage cannot be inferred.');
  const delta = {};
  for (const key of counters) {
    if (before.counters[key] == null || after.counters[key] == null) continue;
    delta[key] = after.counters[key] - before.counters[key];
    if (delta[key] < 0) return unavailable('Host counter reset; delta is invalid.');
  }
  if (delta.input_tokens != null && delta.cached_input_tokens != null)
    delta.uncached_input_tokens = delta.input_tokens - delta.cached_input_tokens;
  return {
    available: true,
    source: 'codex-host-token_count',
    scope: 'entire host session between checkpoints; not individual tool billing',
    sessionId: after.sessionId,
    model: after.model,
    startEvent: before.timestamp,
    endEvent: after.timestamp,
    counters: delta,
    accounting:
      'Cached input is a subset of input; reasoning output is a subset of output. Do not add subsets again.',
  };
}

export function statistics(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (q) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)];
  return {
    samples: sorted.length,
    minMs: sorted[0],
    medianMs: rank(0.5),
    p95Ms: rank(0.95),
    maxMs: sorted.at(-1),
    meanMs: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    interpretation:
      sorted.length < 20 ? 'Small sample; descriptive only, not a qualified p95.' : 'Nearest-rank p95.',
  };
}

export async function savePrivateJson(file, value) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await chmod(file, 0o600);
}

export async function checkpoint(command, file, rollout, caseId) {
  if (command === 'start') {
    await savePrivateJson(file, {
      caseId,
      startedAt: new Date().toISOString(),
      usage: await tokenSnapshot(rollout),
    });
    return { caseId, state: 'started' };
  }
  const start = JSON.parse(await readFile(file, 'utf8'));
  const finish = new Date();
  const result = {
    ...start,
    finishedAt: finish.toISOString(),
    wallTimeMs: finish.getTime() - Date.parse(start.startedAt),
    tokens: tokenDelta(start.usage, await tokenSnapshot(rollout)),
  };
  delete result.usage;
  await savePrivateJson(file.replace(/\.json$/, '') + '.result.json', result);
  return result;
}
