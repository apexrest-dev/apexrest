import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  prepareAgentInstructions,
  instructionReadObserved,
  auditPrivateArtifacts,
} from '../../scripts/lib/agent-run-project.mjs';
test('instruction evidence requires a read call, not an instruction-file write', () => {
  const record = (name) => [
    {
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name, input: { file_path: '/private/CLAUDE.md' } }] },
    },
  ];
  assert.equal(instructionReadObserved(record('Read'), 'CLAUDE.md'), true);
  assert.equal(instructionReadObserved(record('Write'), 'CLAUDE.md'), false);
});
test('native project instructions reference the original ENV without copying its content', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'native-instructions-'));
  const env = path.join(root, 'original.env'),
    project = path.join(root, 'project');
  const { mkdir } = await import('node:fs/promises');
  try {
    await writeFile(env, 'PASSWORD=synthetic-quoted-secret\n');
    await mkdir(project);
    await prepareAgentInstructions(project, env, 'test');
    assert.deepEqual((await readdir(project)).sort(), ['AGENTS.md', 'CLAUDE.md']);
    const agents = await readFile(path.join(project, 'AGENTS.md'), 'utf8');
    assert.equal(agents, await readFile(path.join(project, 'CLAUDE.md'), 'utf8'));
    assert.ok(agents.includes(env));
    assert.ok(!agents.includes('synthetic-quoted-secret'));
    assert.ok(!(await readdir(project)).includes('test.env'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('private artifact cleanup leaves neither ENV copies nor credential values', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'artifact-audit-'));
  try {
    await writeFile(path.join(root, 'test.env'), 'PASSWORD=synthetic-value');
    await writeFile(path.join(root, 'accidental.json'), JSON.stringify({ secret: 'synthetic-value' }));
    await writeFile(path.join(root, 'safe.json'), '{}');
    assert.deepEqual(await auditPrivateArtifacts(root, ['synthetic-value']), {
      envCopiesRemoved: 1,
      credentialFilesRemoved: 1,
    });
    assert.deepEqual(await readdir(root), ['safe.json']);
    assert.ok(!(await readFile(path.join(root, 'safe.json'), 'utf8')).includes('synthetic-value'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
