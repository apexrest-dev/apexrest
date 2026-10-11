import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, chmod, readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';

const counters = [
  'input_tokens',
  'cached_input_tokens',
  'cache_write_input_tokens',
  'output_tokens',
  'reasoning_output_tokens',
  'total_tokens',
];

// Inspect only usage records. Never copy messages, tool arguments or credentials.
async function codexSnapshot(file) {
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

export function usageSelection(values) {
  if (values.rollout && values.transcript) throw new Error('Choose --rollout or --transcript, not both.');
  const source = values['usage-source'] ?? (values.transcript ? 'claude' : 'codex');
  if (!['auto', 'codex', 'claude'].includes(source)) throw new Error('Unknown usage source.');
  return { file: values.transcript ?? values.rollout, source };
}
async function readRecords(file, visit) {
  const input = createReadStream(file, { encoding: 'utf8' });
  input.on('error', () => {});
  try {
    for await (const line of createInterface({ input, crlfDelay: Infinity })) {
      let r;
      try {
        r = JSON.parse(line);
      } catch {
        continue;
      }
      visit(r);
    }
    return true;
  } catch {
    return false;
  }
}
function normalizedClaude(usage) {
  const keys = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens'];
  if (!usage || keys.some((k) => usage[k] != null && (!Number.isFinite(usage[k]) || usage[k] < 0)))
    return null;
  if (usage.input_tokens == null || usage.output_tokens == null) return null;
  const input =
    usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const result = {
    input_tokens: input,
    cached_input_tokens: usage.cache_read_input_tokens ?? 0,
    cache_write_input_tokens: usage.cache_creation_input_tokens ?? 0,
    output_tokens: usage.output_tokens,
    total_tokens: input + usage.output_tokens,
  };
  const thinking = usage.output_tokens_details?.thinking_tokens;
  if (Number.isFinite(thinking) && thinking >= 0) result.reasoning_output_tokens = thinking;
  return result;
}
function sumMessages(messages) {
  const summed = {};
  for (const { counters: value } of messages.values())
    for (const [key, n] of Object.entries(value)) summed[key] = (summed[key] ?? 0) + n;
  // Partial reasoning accounting is not a total for messages which omit it.
  if ([...messages.values()].some((m) => m.counters.reasoning_output_tokens == null))
    delete summed.reasoning_output_tokens;
  return summed;
}
async function claudeSnapshot(file) {
  const main = new Map(),
    side = new Map(),
    sessions = new Set();
  let model,
    timestamp,
    sidechainsFound = false;
  const visit = (r, sideFile = false) => {
    if (r.sessionId && !sideFile) sessions.add(r.sessionId);
    if (r.type !== 'assistant' || !r.message?.id) return;
    const normalized = normalizedClaude(r.message.usage);
    if (!normalized) return;
    const sidechain = sideFile || r.isSidechain === true;
    if (sidechain) sidechainsFound = true;
    (sidechain ? side : main).set(r.message.id, { counters: normalized });
    if (!sidechain) {
      model = r.message.model;
      timestamp = r.timestamp;
    }
  };
  if (!(await readRecords(file, visit)))
    return { available: false, reason: 'Host usage source is unreadable.' };
  if (sessions.size !== 1)
    return { available: false, reason: 'Claude transcript has absent or mixed session IDs.' };
  const sessionId = [...sessions][0];
  // Claude's session-scoped subagent directory only; never scan unrelated sessions.
  if (/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    const directory = join(dirname(file), sessionId, 'subagents');
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries)
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        sidechainsFound = true;
        if (!(await readRecords(join(directory, entry.name), (r) => visit(r, true))))
          return { available: false, reason: 'Session subagent usage is unreadable.' };
      }
  }
  if (!main.size) return { available: false, reason: 'Host supplied no assistant usage records.' };
  return {
    available: true,
    source: 'claude-code-transcript-usage',
    sessionId,
    model,
    timestamp,
    events: main.size,
    messageIds: [...main.keys()],
    counters: sumMessages(main),
    sidechainsFound,
    sidechainEvents: side.size,
    sidechainCounters: sumMessages(side),
  };
}
export async function tokenSnapshot(file, source = 'codex') {
  if (file && typeof file === 'object') {
    source = file.source;
    file = file.file;
  }
  if (!file) return { available: false, reason: 'No host usage source supplied.' };
  if (source === 'auto') {
    let detected;
    if (
      !(await readRecords(file, (r) => {
        if (detected) return;
        if (r.type === 'session_meta' || r.payload?.type === 'token_count') detected = 'codex';
        else if (r.type === 'assistant' && r.message?.usage) detected = 'claude';
      }))
    )
      return { available: false, reason: 'Host usage source is unreadable.' };
    source = detected;
  }
  if (source === 'claude') return claudeSnapshot(file);
  if (source === 'codex') return codexSnapshot(file);
  return { available: false, reason: 'Unknown host usage format.' };
}

export function tokenDelta(before, after) {
  const unavailable = (reason) => ({ available: false, reason });
  if (!before?.available || !after?.available) return unavailable('Missing usage checkpoint.');
  if (!before.sessionId || before.sessionId !== after.sessionId)
    return unavailable('Checkpoints are not bound to the same host session.');
  if ((before.source ?? 'codex-host-token_count') !== (after.source ?? 'codex-host-token_count'))
    return unavailable('Usage sources differ.');
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
  const claude = after.source === 'claude-code-transcript-usage';
  let sidechainCounters;
  if (claude) {
    if (after.sidechainEvents < before.sidechainEvents) return unavailable('Sidechain counter reset.');
    sidechainCounters = {};
    for (const key of counters) {
      if (after.sidechainCounters[key] == null) continue;
      const value = after.sidechainCounters[key] - (before.sidechainCounters[key] ?? 0);
      if (value < 0) return unavailable('Sidechain counter reset.');
      sidechainCounters[key] = value;
    }
  }
  return {
    available: true,
    source: after.source ?? 'codex-host-token_count',
    scope: 'entire host session between checkpoints; not individual tool billing',
    sessionId: after.sessionId,
    model: after.model,
    startEvent: before.timestamp,
    endEvent: after.timestamp,
    counters: delta,
    ...(claude ? { sidechainsFound: after.sidechainsFound, sidechainCounters } : {}),
    accounting: claude
      ? 'Input is normalized to include cache reads and writes; reasoning is a subset of output when reported.'
      : 'Cached input is a subset of input; reasoning output is a subset of output. Do not add subsets again.',
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
