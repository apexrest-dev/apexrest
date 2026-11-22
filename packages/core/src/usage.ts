import { AsyncLocalStorage } from 'node:async_hooks';
import { constants, lstat, open } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { managedHome, parse } from './config.ts';
import { exists, hash, withLock, writeJson } from './fs.ts';
import { usageLogEnabled } from './global-settings.ts';
import { Fault, type Result } from './result.ts';

const count = z.number().int().nonnegative().safe();
const duration = z
  .number()
  .finite()
  .nonnegative()
  .max(7 * 86400000);
const modelName = z
  .string()
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
const STORE_MAXIMUM_ENTRIES = 1000;
const STORE_MAXIMUM_BYTES = 2 * 1024 * 1024;
// Read older schema-valid records so their first subsequent write can apply byte retention.
const STORE_MIGRATION_READ_BYTES = 8 * 1024 * 1024;
const countersSchema = z
  .strictObject({
    inputTokens: count,
    cachedInputTokens: count,
    cacheWriteInputTokens: count.optional(),
    outputTokens: count,
    reasoningOutputTokens: count.optional(),
    totalTokens: count,
  })
  .superRefine((counters, ctx) => {
    if (
      counters.cachedInputTokens + (counters.cacheWriteInputTokens ?? 0) > counters.inputTokens ||
      (counters.reasoningOutputTokens ?? 0) > counters.outputTokens ||
      counters.inputTokens + counters.outputTokens !== counters.totalTokens
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Token subsets and totals must agree with their parent counters.',
      });
  });
type Counters = z.infer<typeof countersSchema>;
const tokensSchema = z.discriminatedUnion('available', [
  z.strictObject({ available: z.literal(false), reason: z.literal('host-counters-unavailable') }),
  countersSchema.safeExtend({
    available: z.literal(true),
    source: z.enum(['openai-decisions', 'codex-cli', 'claude-cli']),
    model: modelName.optional(),
    models: z.array(modelName).min(1).max(16).optional(),
  }),
]);
const entrySchema = z.strictObject({
  at: z.iso.datetime(),
  scope: z.enum(['plugin-operation', 'host-run']),
  operation: z.string().regex(/^[a-z][a-z0-9.-]{0,60}$/),
  host: z.enum(['codex', 'claude', 'unknown']),
  ok: z.boolean(),
  durationMs: duration.nullable(),
  durationSource: z.enum(['plugin-clock', 'host-report', 'caller-measured', 'unavailable']),
  sqlclMs: duration.optional(),
  tokens: tokensSchema,
  importDigest: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  nativeSessionHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  counterMode: z.enum(['single-turn', 'cumulative-session']).optional(),
});
type Entry = z.infer<typeof entrySchema>;
const storeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entries: z.array(entrySchema).max(STORE_MAXIMUM_ENTRIES),
});

/** Retention bounds the exact pretty-printed file written by writeJson, including its newline. */
function retain(store: z.infer<typeof storeSchema>) {
  store.entries = store.entries.slice(-STORE_MAXIMUM_ENTRIES);
  let bytes = Buffer.byteLength(JSON.stringify(store, null, 2) + '\n');
  let discarded = 0;
  while (bytes > STORE_MAXIMUM_BYTES && discarded < store.entries.length) {
    const entry = JSON.stringify(store.entries[discarded], null, 2).replace(/^/gm, '    ');
    bytes -= Buffer.byteLength(entry) + 2; // The entry and its comma/newline separator.
    discarded++;
  }
  store.entries = store.entries.slice(discarded);
  return store;
}
const file = () => path.join(managedHome(), 'usage-log.json');

/** Read a bounded owner-controlled file, never a transcript discovered by scanning the host. */
async function readPrivate(file: string, maximum: number) {
  const before = await lstat(file);
  if (!before.isFile() || before.isSymbolicLink() || before.size > maximum)
    throw new Fault('USAGE_SOURCE_UNSAFE', 'Usage sources must be bounded regular local files.', 2);
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    if (
      !info.isFile() ||
      info.size > maximum ||
      info.dev !== before.dev ||
      info.ino !== before.ino ||
      (typeof process.getuid === 'function' && info.uid !== process.getuid())
    )
      throw new Fault('USAGE_SOURCE_UNSAFE', 'Usage source changed or belongs to another user.', 2);
    const data = Buffer.alloc(maximum + 1);
    let bytesRead = 0;
    while (bytesRead < data.length) {
      const next = await handle.read(data, bytesRead, data.length - bytesRead, bytesRead);
      if (next.bytesRead === 0) break;
      bytesRead += next.bytesRead;
    }
    if (bytesRead > maximum || bytesRead !== info.size)
      throw new Fault('USAGE_SOURCE_UNSAFE', 'Usage source changed or exceeds the input limit.', 2);
    return data.toString('utf8', 0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function readStore() {
  if (!(await exists(file()))) return { schemaVersion: 1 as const, entries: [] as Entry[] };
  return retain(parse(storeSchema, JSON.parse(await readPrivate(file(), STORE_MIGRATION_READ_BYTES))));
}

async function saveLocked(entry: Entry) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withLock(path.join(managedHome(), 'usage-log.lock'), async () => {
        const store = await readStore();
        const existing =
          entry.importDigest && store.entries.find((old) => old.importDigest === entry.importDigest);
        if (existing) return { recorded: false, duplicate: true, entry: existing };
        const sessionIndex = entry.nativeSessionHash
          ? store.entries.findIndex(
              (old) => old.host === entry.host && old.nativeSessionHash === entry.nativeSessionHash,
            )
          : -1;
        if (sessionIndex >= 0) {
          const previous = store.entries[sessionIndex]!;
          if (
            previous.counterMode !== 'cumulative-session' ||
            entry.counterMode !== 'cumulative-session' ||
            !previous.tokens.available ||
            !entry.tokens.available
          )
            throw new Fault(
              'USAGE_SESSION_OVERLAP',
              'This native session already has an imported capture. Import one nonoverlapping whole session; only explicit cumulative-session snapshots can revise a prior cumulative snapshot.',
              2,
            );
          const keys = [
            'inputTokens',
            'cachedInputTokens',
            'cacheWriteInputTokens',
            'outputTokens',
            'reasoningOutputTokens',
            'totalTokens',
          ] as const;
          const beforeTokens = previous.tokens,
            afterTokens = entry.tokens;
          for (const key of keys) {
            const before = beforeTokens[key],
              after = afterTokens[key];
            if (before !== undefined && (after === undefined || after < before))
              throw new Fault(
                'USAGE_SESSION_OVERLAP',
                'A cumulative session revision must retain every known counter without decreasing it.',
                2,
              );
          }
          const sameCounters = keys.every((key) => beforeTokens[key] === afterTokens[key]);
          if (sameCounters && previous.durationMs === entry.durationMs)
            return { recorded: false, duplicate: true, entry: previous };
          if (
            previous.durationMs === null ||
            entry.durationMs === null ||
            entry.durationMs < previous.durationMs
          )
            throw new Fault(
              'USAGE_SESSION_OVERLAP',
              'A cumulative session revision requires nondecreasing measured elapsed time for the whole session.',
              2,
            );
          store.entries.splice(sessionIndex, 1);
          store.entries.push(entry);
          await writeJson(file(), retain(store));
          return { recorded: true, duplicate: false, revised: true, entry };
        }
        store.entries.push(entry);
        await writeJson(file(), retain(store));
        return { recorded: true, duplicate: false, entry };
      });
    } catch (error) {
      if (!(error instanceof Fault) || error.code !== 'LOCKED' || attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}

const writes = new Map<string, Promise<unknown>>();
async function save(entry: Entry) {
  const home = managedHome();
  const write = (writes.get(home) ?? Promise.resolve()).catch(() => {}).then(() => saveLocked(entry));
  writes.set(home, write);
  try {
    return await write;
  } finally {
    if (writes.get(home) === write) writes.delete(home);
  }
}

const observing = new AsyncLocalStorage<boolean>();
/** One entry per outer dispatch. Nested action routing never duplicates counters or duration. */
export async function observeUsage(operation: string, execute: () => Promise<Result>, sqlclMs: () => number) {
  if (observing.getStore() || operation.startsWith('usage.') || operation.startsWith('settings.'))
    return execute();
  let enabled = false;
  try {
    enabled = await usageLogEnabled();
  } catch {
    /* Logging never changes an operation outcome. */
  }
  if (!enabled) return execute();
  const started = performance.now();
  return observing.run(true, async () => {
    const result = await execute();
    try {
      const data = result.data as { selection?: Record<string, unknown> } | undefined;
      const selection = data?.selection;
      const usage = selection?.usage as Record<string, any> | undefined;
      const tokens = usage
        ? tokensSchema.safeParse({
            available: true,
            source: 'openai-decisions',
            inputTokens: usage.input_tokens,
            cachedInputTokens: usage.input_tokens_details?.cached_tokens,
            cacheWriteInputTokens: usage.input_tokens_details?.cache_write_tokens,
            outputTokens: usage.output_tokens,
            reasoningOutputTokens: usage.output_tokens_details?.reasoning_tokens,
            totalTokens: usage.total_tokens,
            model: selection?.model,
          })
        : undefined;
      const host = process.env.APEXREST_HOST;
      await save(
        parse(entrySchema, {
          at: new Date().toISOString(),
          scope: 'plugin-operation',
          operation,
          host: host === 'codex' || host === 'claude' ? host : 'unknown',
          ok: result.ok,
          durationMs: Math.round(performance.now() - started),
          durationSource: 'plugin-clock',
          sqlclMs: Math.round(sqlclMs()),
          tokens: tokens?.success ? tokens.data : { available: false, reason: 'host-counters-unavailable' },
        }),
      );
    } catch {
      /* A full disk, disabled logging or a competing writer never fails work. */
    }
    return result;
  });
}

function records(text: string): Record<string, any>[] {
  try {
    try {
      const value: unknown = JSON.parse(text);
      if (value && typeof value === 'object' && !Array.isArray(value)) return [value as Record<string, any>];
    } catch {
      /* Native stream output is JSON-lines. */
    }
    return text
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const value: unknown = JSON.parse(line);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        return value as Record<string, any>;
      });
  } catch {
    throw new Fault('USAGE_SOURCE_INVALID', 'Supply native CLI JSON or JSON-lines event output.', 2);
  }
}
function measured(value: unknown) {
  return parse(count, value);
}
function model(value: unknown) {
  return modelName.safeParse(value).data;
}

export type NativeCounterMode = 'cumulative-session';

function nativeUsage(
  host: 'codex' | 'claude',
  events: Record<string, any>[],
  counterMode?: NativeCounterMode,
) {
  let totals: Counters = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const models = new Set<string>();
  for (const event of events) {
    const observed = model(event.model ?? event.model_id);
    if (observed) models.add(observed);
  }
  let elapsed: number | undefined;
  let nativeSessionHash: string | undefined;
  let ok = true;
  if (host === 'codex') {
    const sessions = events.filter((event) => event.type === 'thread.started');
    const reportsTurnStarts = events.some((event) => event.type === 'turn.started');
    let openTurn = false;
    for (const event of events) {
      if (event.type === 'turn.started') {
        if (openTurn)
          throw new Fault(
            'USAGE_SOURCE_INVALID',
            'Codex output starts a turn before the prior turn ended.',
            2,
          );
        openTurn = true;
      } else if (event.type === 'turn.completed') {
        if (reportsTurnStarts && !openTurn)
          throw new Fault('USAGE_SOURCE_INVALID', 'Codex output completes a turn that never started.', 2);
        openTurn = false;
      } else if (event.type === 'turn.failed')
        throw new Fault(
          'USAGE_COUNTERS_UNAVAILABLE',
          'A failed Codex turn has no completed usage report for the whole run.',
          2,
        );
    }
    if (openTurn)
      throw new Fault(
        'USAGE_COUNTERS_UNAVAILABLE',
        'Codex output ends before its last turn reports completed usage.',
        2,
      );
    const turns = events.filter((event) => event.type === 'turn.completed');
    if (
      events.findLastIndex((event) => event.type === 'thread.started') >
      events.findLastIndex((event) => event.type === 'turn.completed')
    )
      throw new Fault(
        'USAGE_COUNTERS_UNAVAILABLE',
        'The resumed Codex capture ends before reporting a completed turn.',
        2,
      );
    const sessionIds = new Set(sessions.map((event) => event.thread_id));
    if (
      !sessions.length ||
      sessionIds.size !== 1 ||
      typeof sessions[0]!.thread_id !== 'string' ||
      !sessions[0]!.thread_id ||
      sessions[0]!.thread_id.length > 4096 ||
      !turns.length
    )
      throw new Fault(
        'USAGE_COUNTERS_UNAVAILABLE',
        'Codex output must identify one thread and completed turns with usage.',
        2,
      );
    if ((turns.length > 1 || sessions.length > 1) && counterMode !== 'cumulative-session')
      throw new Fault(
        'USAGE_COUNTER_MODE_REQUIRED',
        'Multiple Codex turns or resumed captures require counterMode cumulative-session and complete cumulative CLI output. Historical per-turn counters cannot be inferred.',
        2,
      );
    nativeSessionHash = hash('codex\n' + sessions[0]!.thread_id);
    let previous: Record<string, number> | undefined;
    for (const event of turns) {
      const input = measured(event.usage?.input_tokens),
        output = measured(event.usage?.output_tokens);
      if (
        measured(event.usage?.cached_input_tokens ?? 0) +
          measured(event.usage?.cache_write_input_tokens ?? 0) >
        input
      )
        throw new Fault('USAGE_SOURCE_INVALID', 'Input token subsets exceed the reported input counter.', 2);
      const current: Record<string, number> = {
        input_tokens: input,
        cached_input_tokens: measured(event.usage?.cached_input_tokens ?? 0),
        output_tokens: output,
      };
      totals = {
        inputTokens: input,
        cachedInputTokens: current.cached_input_tokens!,
        outputTokens: output,
        totalTokens: input + output,
      };
      for (const [source, target, bound] of [
        ['cache_write_input_tokens', 'cacheWriteInputTokens', 'input_tokens'],
        ['reasoning_output_tokens', 'reasoningOutputTokens', 'output_tokens'],
      ] as const) {
        const reported = event.usage?.[source];
        if (reported !== undefined) {
          const value = measured(reported);
          if (value > measured(event.usage?.[bound]))
            throw new Fault('USAGE_SOURCE_INVALID', 'A reported token subset exceeds its parent counter.', 2);
          totals[target] = value;
          current[source] = value;
        }
      }
      if (previous)
        for (const [key, value] of Object.entries(previous))
          if (current[key] === undefined || current[key]! < value)
            throw new Fault(
              'USAGE_SOURCE_INVALID',
              'Cumulative Codex counters must retain known fields and never decrease; per-turn or mixed formats are unsupported.',
              2,
            );
      previous = current;
    }
    ok = !events.some((event) => event.type === 'turn.failed' || event.type === 'error');
  } else {
    if (counterMode !== undefined)
      throw new Fault(
        'USAGE_SOURCE_INVALID',
        'counterMode cumulative-session is only for Codex captures.',
        2,
      );
    const results = events.filter((event) => event.type === 'result');
    if (results.length !== 1)
      throw new Fault(
        'USAGE_COUNTERS_UNAVAILABLE',
        'Claude output must include exactly one final result with usage.',
        2,
      );
    const result = results[0]!;
    const usage = result.usage;
    const uncached = measured(usage?.input_tokens),
      output = measured(usage?.output_tokens);
    const cached = measured(usage?.cache_read_input_tokens ?? 0),
      written = measured(usage?.cache_creation_input_tokens ?? 0);
    const actualModels = Object.keys(result.modelUsage ?? {}).some((name) => model(name));
    const providerMessage = events.some((event) => event.type === 'assistant' && model(event.message?.model));
    if (
      result.is_error === true &&
      uncached + cached + written + output === 0 &&
      !actualModels &&
      !providerMessage
    )
      throw new Fault(
        'USAGE_COUNTERS_UNAVAILABLE',
        'The failed Claude run has no provider-backed usage; synthetic error counters are not measured zero usage.',
        2,
      );
    totals = {
      inputTokens: uncached + cached + written,
      cachedInputTokens: cached,
      cacheWriteInputTokens: written,
      outputTokens: output,
      totalTokens: uncached + cached + written + output,
    };
    for (const name of Object.keys(result.modelUsage ?? {})) {
      const observed = model(name);
      if (observed) models.add(observed);
    }
    elapsed = duration.safeParse(result.duration_ms).data;
    ok = result.is_error !== true;
  }
  if (models.size > 16)
    throw new Fault('USAGE_SOURCE_INVALID', 'The run contains too many model identities.', 2);
  const verified = countersSchema.safeParse(totals);
  if (!verified.success)
    throw new Fault('USAGE_SOURCE_INVALID', 'Native token subsets and totals do not agree.', 2);
  return { counters: verified.data, models: [...models].sort(), elapsed, ok, nativeSessionHash };
}

export async function importUsage(
  host: 'codex' | 'claude',
  source: string,
  elapsedMs?: number,
  counterMode?: NativeCounterMode,
) {
  if (!(await usageLogEnabled()))
    throw new Fault(
      'USAGE_LOG_DISABLED',
      'Enable local usage logging with settings configure --usage-log on.',
      2,
    );
  const contents = await readPrivate(path.resolve(source), 8 * 1024 * 1024);
  const native = nativeUsage(host, records(contents), counterMode);
  const elapsed = elapsedMs === undefined ? native.elapsed : parse(duration, elapsedMs);
  const entry = parse(entrySchema, {
    at: new Date().toISOString(),
    scope: 'host-run',
    operation: 'host.run',
    host,
    ok: native.ok,
    durationMs: elapsed ?? null,
    durationSource:
      elapsedMs !== undefined ? 'caller-measured' : elapsed !== undefined ? 'host-report' : 'unavailable',
    tokens: {
      available: true,
      source: host === 'codex' ? 'codex-cli' : 'claude-cli',
      ...native.counters,
      ...(native.models.length === 1
        ? { model: native.models[0] }
        : native.models.length
          ? { models: native.models }
          : {}),
    },
    importDigest: hash(host + '\n' + contents),
    ...(native.nativeSessionHash
      ? {
          nativeSessionHash: native.nativeSessionHash,
          counterMode: counterMode ?? 'single-turn',
        }
      : {}),
  });
  return save(entry);
}

export async function usageStatus(limit = 20) {
  parse(z.number().int().min(1).max(1000), limit);
  const store = await readStore();
  const totals = new Map<
    string,
    {
      scope: Entry['scope'];
      tokenSource: string;
      records: number;
      failures: number;
      measuredDurationMs: number;
      missingDurationRecords: number;
      tokens: Counters | null;
    }
  >();
  for (const entry of store.entries) {
    const tokenSource = entry.tokens.available ? entry.tokens.source : 'unavailable';
    const key = entry.scope + '/' + tokenSource;
    const total = totals.get(key) ?? {
      scope: entry.scope,
      tokenSource,
      records: 0,
      failures: 0,
      measuredDurationMs: 0,
      missingDurationRecords: 0,
      tokens: entry.tokens.available
        ? {
            inputTokens: 0,
            cachedInputTokens: 0,
            cacheWriteInputTokens: 0,
            outputTokens: 0,
            reasoningOutputTokens: 0,
            totalTokens: 0,
          }
        : null,
    };
    total.records++;
    if (!entry.ok) total.failures++;
    if (entry.durationMs === null) total.missingDurationRecords++;
    else total.measuredDurationMs += entry.durationMs;
    if (entry.tokens.available && total.tokens) {
      total.tokens.inputTokens += entry.tokens.inputTokens;
      total.tokens.cachedInputTokens += entry.tokens.cachedInputTokens;
      total.tokens.outputTokens += entry.tokens.outputTokens;
      total.tokens.totalTokens += entry.tokens.totalTokens;
      for (const key of ['cacheWriteInputTokens', 'reasoningOutputTokens'] as const) {
        if (total.tokens[key] !== undefined && entry.tokens[key] !== undefined)
          total.tokens[key] += entry.tokens[key];
        else delete total.tokens[key];
      }
    }
    totals.set(key, total);
  }
  return {
    enabled: await usageLogEnabled(),
    file: file(),
    retainedEntries: store.entries.length,
    maximumEntries: STORE_MAXIMUM_ENTRIES,
    maximumBytes: STORE_MAXIMUM_BYTES,
    totalsByScopeAndSource: [...totals.values()],
    entries: store.entries.slice(-limit).reverse(),
    hostTokens:
      'Available only from explicitly imported native host counters. Plugin and host-run records are separate scopes.',
  };
}
