import { createReadStream } from 'node:fs';
import { stat, readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';

export async function transcriptCheckpoint(file) {
  if (!file) return { available: false, reason: 'No transcript source.' };
  try {
    const bytes = (await stat(file)).size;
    const { sessionId } = await scan(file, 0, 0, []);
    const sidechainFiles = {};
    if (sessionId && /^[\w-]+$/.test(sessionId)) {
      const directory = path.join(path.dirname(file), sessionId, 'subagents');
      for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => []))
        if (entry.isFile() && entry.name.endsWith('.jsonl'))
          sidechainFiles[entry.name] = (await stat(path.join(directory, entry.name))).size;
    }
    return { available: true, file, bytes, sessionId, sidechainFiles };
  } catch {
    return { available: true, file, bytes: 0 };
  }
}
function empty() {
  return {
    turns: 0,
    assistantMessages: 0,
    toolCalls: 0,
    tools: {},
    categories: { shell: 0, fileEdit: 0, browser: 0, search: 0, subagent: 0, other: 0 },
    writeCalls: 0,
    writeClassifications: {},
    browserCalls: 0,
    validateCycles: 0,
    jobPolls: 0,
    secretLeaks: 0,
    permissionPrompts: null,
    permissionReason: 'No permission request/denial records were recorded by this host.',
    wallTimeMs: null,
  };
}
function canonical(name) {
  return [...name.matchAll(/apexrest_[a-z]+(?:_[a-z]+)*/g)].at(-1)?.[0] ?? name;
}
export function classifyTool(name, args) {
  const tool = canonical(name),
    serialized = typeof args === 'string' ? args : JSON.stringify(args ?? {});
  let parsed = args;
  if (typeof args === 'string')
    try {
      parsed = JSON.parse(args);
    } catch {
      parsed = {};
    }
  const category = /browser|chrome|cua|playwright/i.test(name)
    ? 'browser'
    : /exec_command|write_stdin|Bash|shell|terminal/i.test(name)
      ? 'shell'
      : /apply_patch|Edit|Write|file_edit/i.test(name)
        ? 'fileEdit'
        : /search|reference|Grep|Glob|WebFetch|web.*run/i.test(name)
          ? 'search'
          : /spawn_agent|Task$|Agent$|subagent/i.test(name)
            ? 'subagent'
            : 'other';
  const apply =
    tool === 'apexrest_ship' &&
    (parsed?.mode === 'apply' || /\bmode\s*[=:]\s*["']apply["']/.test(serialized));
  const shellWrite =
    category === 'shell' &&
    /(?:^|[\s/])apexrest(?:\.mjs)?\s+(?:ship\b[^\n]*--mode[=\s]+apply\b|deploy\s+apply\b|apex\s+(?:import|restore)\b)|(?:^|[\s/])apex\s+(?:import|restore)\b|(?:^|[\s/])apexrest(?:\.mjs)?\s+[^\n]*--confirmation\b/i.test(
      parsed?.command ?? parsed?.cmd ?? serialized,
    );
  const dangerous =
    shellWrite ||
    /restore|import|deploy_apply|ship_apply/.test(tool) ||
    (tool === 'apexrest_project' && ['adopt', 'create', 'import', 'deploy'].includes(parsed?.action));
  return { tool, category, write: apply || dangerous ? (apply ? 'ship-apply' : 'import-capable') : null };
}
async function scan(file, start, end, secrets, forceSidechain = false, state = {}) {
  const main = empty(),
    sidechain = empty(),
    ids = (state.ids ??= new Set()),
    assistants = (state.assistants ??= new Set()),
    turns = (state.turns ??= new Set());
  let first, last, sessionId;
  const input = createReadStream(file, { encoding: 'utf8' });
  input.on('error', () => {});
  let offset = 0;
  try {
    for await (const line of createInterface({ input, crlfDelay: Infinity })) {
      const position = offset;
      offset += Buffer.byteLength(line) + 1;
      let r;
      try {
        r = JSON.parse(line);
      } catch {
        continue;
      }
      sessionId ??= r.sessionId ?? (r.type === 'session_meta' ? r.payload?.id : undefined);
      if (position < start || position >= end) continue;
      const side = forceSidechain || r.isSidechain === true,
        m = side ? sidechain : main;
      for (const secret of secrets.filter((s) => s && s.length >= 4)) {
        let from = 0;
        while ((from = line.indexOf(secret, from)) !== -1) {
          m.secretLeaks++;
          from += secret.length;
        }
      }
      const timestamp = Date.parse(r.timestamp);
      if (!side && Number.isFinite(timestamp)) {
        first = first == null ? timestamp : Math.min(first, timestamp);
        last = last == null ? timestamp : Math.max(last, timestamp);
      }
      if (
        /permission.*(?:request|deni)|(?:request|deni).*permission/i.test(
          r.type + ' ' + (r.payload?.type ?? r.subtype ?? ''),
        )
      ) {
        m.permissionPrompts = (m.permissionPrompts ?? 0) + 1;
        delete m.permissionReason;
      }
      const denials =
        r.message?.content?.filter?.(
          (b) =>
            b.type === 'tool_result' &&
            b.is_error === true &&
            /permission|denied|not allowed/i.test(JSON.stringify(b.content)),
        ) ?? [];
      for (const denial of denials) {
        const key = (side ? 'side:' : 'main:') + 'permission:' + (denial.tool_use_id ?? position);
        if (!ids.has(key)) {
          ids.add(key);
          m.permissionPrompts = (m.permissionPrompts ?? 0) + 1;
          delete m.permissionReason;
        }
      }
      const p = r.payload ?? r;
      const role = r.type === 'response_item' ? p.role : r.message?.role;
      const assistant =
        r.type === 'assistant' ||
        (r.type === 'response_item' && p.type === 'message' && role === 'assistant');
      if (assistant) {
        const id = r.message?.id ?? r.uuid ?? p.id ?? `${position}`;
        const key = (side ? 'side:' : 'main:') + id;
        if (!assistants.has(key)) {
          assistants.add(key);
          m.assistantMessages++;
        }
      }
      const user =
        (r.type === 'user' && !r.message?.content?.some?.((b) => b.type === 'tool_result')) ||
        (r.type === 'response_item' && p.type === 'message' && role === 'user');
      if (user) {
        const key = (side ? 'side:' : 'main:') + (r.uuid ?? p.id ?? position);
        if (!turns.has(key)) {
          turns.add(key);
          m.turns++;
        }
      }
      const calls =
        r.type === 'assistant'
          ? (r.message?.content?.filter((b) => b.type === 'tool_use') ?? [])
          : r.type === 'response_item' && ['function_call', 'custom_tool_call'].includes(p.type)
            ? [{ id: p.call_id, name: p.name, input: p.arguments ?? p.input }]
            : [];
      for (const call of calls) {
        const key = (side ? 'side:' : 'main:') + (call.id ?? `${position}:${call.name}`);
        if (ids.has(key)) continue;
        ids.add(key);
        const c = classifyTool(call.name, call.input);
        m.tools[c.tool] = (m.tools[c.tool] ?? 0) + 1;
        m.toolCalls++;
        m.categories[c.category]++;
        if (c.category === 'browser') m.browserCalls++;
        if (c.tool === 'apexrest_apex_validate') m.validateCycles++;
        if (c.tool === 'apexrest_job' && !/"action"\s*:\s*"cancel"/.test(JSON.stringify(call.input)))
          m.jobPolls++;
        if (c.write) {
          m.writeCalls++;
          m.writeClassifications[c.write] = (m.writeClassifications[c.write] ?? 0) + 1;
        }
        // Codex wrappers may invoke tools inside functions.exec. Classify observed nested names without persisting code.
        if (/(?:^|\.)exec$/.test(call.name)) {
          const code = typeof call.input === 'string' ? call.input : JSON.stringify(call.input);
          for (const match of code.matchAll(/tools\.(\w+)\s*\(/g)) {
            const nested = classifyTool(match[1], code);
            m.tools[nested.tool] = (m.tools[nested.tool] ?? 0) + 1;
            m.toolCalls++;
            m.categories[nested.category]++;
            if (nested.category === 'browser') m.browserCalls++;
            if (nested.tool === 'apexrest_apex_validate') m.validateCycles++;
            if (nested.tool === 'apexrest_job') m.jobPolls++;
            if (nested.write) {
              m.writeCalls++;
              m.writeClassifications[nested.write] = (m.writeClassifications[nested.write] ?? 0) + 1;
            }
          }
        }
      }
    }
  } catch {
    return { available: false, reason: 'Transcript source unreadable.' };
  }
  main.wallTimeMs = first == null ? null : last - first;
  return {
    available: true,
    sessionId,
    main,
    sidechain,
    firstTimestamp: first == null ? null : new Date(first).toISOString(),
    lastTimestamp: last == null ? null : new Date(last).toISOString(),
  };
}
export async function transcriptMetrics(before, after, { secrets = [] } = {}) {
  if (!before?.available || !after?.available || before.file !== after.file || after.bytes < before.bytes)
    return { available: false, reason: 'Missing, different or reset transcript checkpoint.' };
  if (before.sessionId && after.sessionId && before.sessionId !== after.sessionId)
    return { available: false, reason: 'Session changed.' };
  const state = {};
  const result = await scan(before.file, before.bytes, after.bytes, secrets, false, state);
  if (!result.available) return result;
  result.sidechainFound =
    result.sidechain.toolCalls + result.sidechain.assistantMessages + result.sidechain.turns > 0;
  const id = result.sessionId;
  if (id && /^[\w-]+$/.test(id)) {
    const directory = path.join(path.dirname(before.file), id, 'subagents');
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => []))
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        const child = await scan(
          path.join(directory, entry.name),
          before.sidechainFiles?.[entry.name] ?? 0,
          after.sidechainFiles?.[entry.name] ?? Infinity,
          secrets,
          true,
          state,
        );
        if (child.available) {
          result.sidechainFound = true;
          for (const key of [
            'turns',
            'assistantMessages',
            'toolCalls',
            'writeCalls',
            'browserCalls',
            'validateCycles',
            'jobPolls',
            'secretLeaks',
          ])
            result.sidechain[key] += child.sidechain[key];
          for (const key of ['tools', 'categories', 'writeClassifications'])
            for (const [name, count] of Object.entries(child.sidechain[key]))
              result.sidechain[key][name] = (result.sidechain[key][name] ?? 0) + count;
        }
      }
  }
  return result;
}
