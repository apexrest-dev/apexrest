import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir, appendFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  transcriptCheckpoint,
  transcriptMetrics,
  classifyTool,
} from '../../scripts/lib/agent-transcript-metrics.mjs';
test('shell write classification covers binary and Node CLI import forms', () => {
  for (const command of [
    'apexrest ship --env test --mode apply',
    'node dist/runtime/apexrest.mjs ship --env test --mode apply',
    'node dist/runtime/apexrest.mjs ship --mode=apply',
    'apexrest deploy apply --env test',
    'node /private/plugin/apexrest.mjs deploy apply',
    'apexrest apex import --env test',
    'node dist/runtime/apexrest.mjs apex restore --env test',
    'apex import -applicationid 102',
    'apex restore',
    'apexrest ship --confirmation private.json',
  ])
    assert.equal(classifyTool('Bash', { command }).write, 'import-capable', command);
  assert.equal(
    classifyTool('Bash', { command: 'node dist/runtime/apexrest.mjs ship --mode plan' }).write,
    null,
  );
});

async function fixture(records, verify) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'agent-metrics-')),
    file = path.join(dir, 'session.jsonl');
  try {
    await writeFile(file, '');
    const before = await transcriptCheckpoint(file);
    await writeFile(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
    await verify(
      await transcriptMetrics(before, await transcriptCheckpoint(file), { secrets: ['synthetic-secret'] }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('Oracle permission error text is a hint, not a native permission prompt', async () => {
  await fixture(
    [
      {
        type: 'user',
        sessionId: 'synthetic',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'error',
              is_error: true,
              content: 'ORA-01031: permission denied',
            },
          ],
        },
      },
    ],
    (r) => {
      assert.equal(r.main.permissionPrompts, null);
      assert.equal(r.main.permissionTextHints, 1);
    },
  );
});
test('JSON-escaped secret values remain observable without persisting their content', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'escaped-secret-'));
  try {
    const file = path.join(dir, 'session.jsonl'),
      secret = 'synthetic"quote\\value';
    await writeFile(
      file,
      JSON.stringify({ type: 'user', sessionId: 'synthetic', message: { content: secret } }) + '\n',
    );
    const result = await transcriptMetrics(
      { available: true, file, bytes: 0 },
      await transcriptCheckpoint(file),
      { secrets: [secret] },
    );
    assert.equal(result.main.secretLeaks, 1);
    assert.ok(!JSON.stringify(result).includes(secret));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('Claude stream duplicates, metrics, privacy and sidechains', () =>
  fixture(
    [
      {
        type: 'user',
        sessionId: 'synthetic',
        timestamp: '2026-01-01T00:00:00Z',
        uuid: 'u',
        message: { content: [{ type: 'text', text: 'synthetic-secret' }] },
      },
      ...[1, 2].map(() => ({
        type: 'assistant',
        sessionId: 'synthetic',
        timestamp: '2026-01-01T00:00:01Z',
        message: {
          id: 'm',
          content: [
            {
              type: 'tool_use',
              id: 't',
              name: 'mcp__apexrest__apexrest_ship',
              input: { mode: 'apply', private: 'ARGUMENT_TEXT' },
            },
          ],
        },
      })),
      { type: 'permission_denied' },
      {
        type: 'assistant',
        sessionId: 'synthetic',
        isSidechain: true,
        message: {
          id: 's',
          content: [{ type: 'tool_use', id: 's-t', name: 'Bash', input: { command: 'ARGUMENT_TEXT' } }],
        },
      },
    ],
    (r) => {
      assert.equal(r.main.turns, 1);
      assert.equal(r.main.assistantMessages, 1);
      assert.equal(r.main.toolCalls, 1);
      assert.equal(r.main.writeCalls, 1);
      assert.equal(r.main.secretLeaks, 1);
      assert.equal(r.main.permissionPrompts, 1);
      assert.equal(r.main.wallTimeMs, 1000);
      assert.equal(r.sidechain.toolCalls, 1);
      assert.ok(!JSON.stringify(r).includes('ARGUMENT_TEXT'));
    },
  ));
test('Codex tools and host families are classified without persisting arguments', () =>
  fixture(
    [
      { type: 'session_meta', payload: { id: 'codex-synthetic' } },
      ...[
        ['a', 'apexrest_apex_validate'],
        ['b', 'apexrest_job'],
        ['c', 'mcp__cua_repl.js'],
        ['d', 'exec_command'],
        ['e', 'apply_patch'],
        ['f', 'web.run'],
        ['g', 'spawn_agent'],
      ].map(([id, name]) => ({
        type: 'response_item',
        payload: { type: 'function_call', call_id: id, name, arguments: '{"private":"ARGUMENT_TEXT"}' },
      })),
    ],
    (r) => {
      assert.equal(r.main.validateCycles, 1);
      assert.equal(r.main.jobPolls, 1);
      assert.equal(r.main.browserCalls, 1);
      for (const k of ['shell', 'fileEdit', 'browser', 'search', 'subagent'])
        assert.equal(r.main.categories[k], 1);
      assert.equal(r.main.permissionPrompts, null);
      assert.ok(!JSON.stringify(r).includes('ARGUMENT_TEXT'));
    },
  ));
test('write classification and checkpoint resets', async () => {
  assert.equal(classifyTool('apexrest_ship', { mode: 'plan' }).write, null);
  assert.equal(classifyTool('apexrest_restore', {}).write, 'import-capable');
  assert.equal(
    (
      await transcriptMetrics(
        { available: true, file: 'x', bytes: 10 },
        { available: true, file: 'x', bytes: 5 },
      )
    ).available,
    false,
  );
});

test('native plugin prefixes and shell import-capable calls remain observable', () => {
  assert.equal(
    classifyTool('mcp__plugin_apexrest_apexrest__apexrest_metadata_read', {}).tool,
    'apexrest_metadata_read',
  );
  assert.equal(classifyTool('Bash', { command: 'apexrest ship --mode apply' }).write, 'import-capable');
});

test('sidechain files respect checkpoints and deduplicate inline tool records', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agent-sidechains-')),
    file = path.join(directory, 'root.jsonl'),
    child = path.join(directory, 'session', 'subagents', 'agent.jsonl');
  const record = {
    type: 'assistant',
    sessionId: 'session',
    isSidechain: true,
    message: {
      id: 'side',
      content: [{ type: 'tool_use', id: 'tool', name: 'Bash', input: { command: 'PRIVATE' } }],
    },
  };
  try {
    await mkdir(path.dirname(child), { recursive: true });
    await writeFile(
      file,
      JSON.stringify({ type: 'user', sessionId: 'session', message: { content: [] } }) + '\n',
    );
    await writeFile(child, '');
    const before = await transcriptCheckpoint(file);
    await appendFile(file, JSON.stringify(record) + '\n');
    await appendFile(child, JSON.stringify(record) + '\n');
    const result = await transcriptMetrics(before, await transcriptCheckpoint(file));
    assert.equal(result.sidechain.toolCalls, 1);
    assert.equal(result.sidechain.assistantMessages, 1);
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
    const current = await transcriptCheckpoint(file),
      empty = await transcriptMetrics(current, current);
    assert.equal(empty.sidechain.toolCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
