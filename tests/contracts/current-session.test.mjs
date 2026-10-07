import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('removed agent entrypoints cannot start work through CLI, MCP or legacy environment flags', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-no-agents-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = {
    ...process.env,
    APEXREST_HOME: root,
    APEXREST_TEAM_WORKER: '1',
    APEXREST_TEAM_ROLE: 'manager',
  };
  const cli = (...args) =>
    spawnSync(process.execPath, ['dist/runtime/apexrest.mjs', ...args], {
      env,
      encoding: 'utf8',
      timeout: 10000,
    });
  for (const args of [
    ['team', 'start', 'task'],
    ['team', 'wait', 'id'],
    ['work', 'start', 'task'],
    ['--team-worker', root, 'id'],
  ]) {
    const result = cli(...args);
    assert.notEqual(result.status, 0, args.join(' '));
    assert.equal(JSON.parse(result.stdout).ok, false);
  }
  const help = cli('--help');
  assert.equal(help.status, 0);
  assert.doesNotMatch(help.stdout, /team start|work start|execution-mode|developers|team-worker/);
  const client = new Client({ name: 'current-session-contract', version: '1' });
  t.after(() => client.close());
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve('dist/runtime/mcp.mjs')],
      env,
      stderr: 'pipe',
    }),
  );
  const catalog = await client.listTools();
  assert.equal(catalog.tools.length, 10);
  assert.ok(
    catalog.tools.some((tool) => tool.name === 'apexrest_ship'),
    'Legacy reviewer flags cannot change current tools',
  );
  assert.doesNotMatch(
    JSON.stringify(catalog),
    /multiAgentEnabled|executionMode|teamId|requestId|apexrest_team_|apexrest_work_start/,
  );
  for (const name of [
    'apexrest_team_start',
    'apexrest_team_wait',
    'apexrest_team_status',
    'apexrest_team_message',
    'apexrest_team_cancel',
    'apexrest_work_start',
    'apexrest_panel_open',
    'apexrest_panel_action',
  ]) {
    const response = await client.callTool({ name, arguments: { project: root } });
    assert.equal(response.isError, true);
    assert.equal(JSON.parse(response.content[0].text).diagnostics[0].code, 'UNKNOWN_TOOL');
  }
  assert.deepEqual(await readdir(root), [], 'Rejected starts do not create durable agent state');
});

test('distributed runtime and skills contain no model orchestration', async () => {
  const root = 'dist/codex-compat/plugins/apexrest-apex';
  const skills = (await readdir(root + '/skills')).sort();
  assert.deepEqual(skills, [
    'apexrest-apexlang',
    'apexrest-pattern-catalog',
    'apexrest-safety',
    'apexrest-setup',
    'apexrest-work',
  ]);
  const work = await readFile(root + '/skills/apexrest-work/SKILL.md', 'utf8');
  assert.match(work, /current host session \(Codex or Claude Code\)/);
  assert.doesNotMatch(work, /apexrest_work_start|apexrest_team_|requestId|\$apexrest-/);
  let bytes = 0;
  for (const skill of skills) bytes += (await readFile(`${root}/skills/${skill}/SKILL.md`)).length;
  assert.ok(bytes < 20000, `skills total ${bytes} bytes`);
  for (const name of await readdir(root + '/runtime')) {
    const text = await readFile(root + '/runtime/' + name, 'utf8');
    assert.doesNotMatch(
      text,
      /--team-worker|APEXREST_TEAM_|thread\/start|turn\/start|multiAgentEnabled|team_context|team_message|codex app-server/,
    );
  }
});
