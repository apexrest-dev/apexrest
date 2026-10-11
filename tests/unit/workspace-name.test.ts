import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { environmentSchema } from '../../packages/core/src/config.ts';
import { fixture } from '../fixtures/project.ts';

test('hyphenated real APEX workspace is accepted without relaxing SQL schema identifiers', async () => {
  const { ctx } = await fixture();
  const env = { ...ctx.config.environments.dev!, workspace: 'APEX-APP' };
  assert.equal(environmentSchema.parse(env).workspace, 'APEX-APP');
  assert.equal(environmentSchema.safeParse({ ...env, parsingSchema: 'WKSP-APEXAPP' }).success, false);
  for (const workspace of ['APEX-APP\nexit', 'APEX APP', "APEX'APP", '../APEX', ''])
    assert.equal(environmentSchema.safeParse({ ...env, workspace }).success, false);
  const schema = JSON.parse(await readFile('schemas/project.schema.json', 'utf8'));
  const workspace = schema.properties.environments.additionalProperties.properties.workspace;
  const pattern = new RegExp(workspace.pattern);
  assert.equal(pattern.test('APEX-APP'), true);
  assert.equal(pattern.test('APEX-APP\nexit'), false);
});
