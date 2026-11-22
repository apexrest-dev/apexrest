import test from 'node:test';
import assert from 'node:assert/strict';
import { waitsForCompilerPrewarm } from '../../packages/core/src/service.ts';

test('only compiling operations and connected preview starts wait for the compiler preload', () => {
  assert.equal(waitsForCompilerPrewarm('apex.validate', {}), true);
  assert.equal(waitsForCompilerPrewarm('ship', { mode: 'plan' }), true);
  for (const action of ['setup', 'start', 'check', 'status', 'stop', 'comments', 'resolve'])
    assert.equal(waitsForCompilerPrewarm('preview', { action }), false, `local preview ${action}`);
  assert.equal(waitsForCompilerPrewarm('preview', { action: 'start', env: 'dev' }), true);
  assert.equal(waitsForCompilerPrewarm('preview', { action: 'check', env: 'test' }), true);
  assert.equal(waitsForCompilerPrewarm('preview', { action: 'stop', env: 'dev' }), false);
  assert.equal(waitsForCompilerPrewarm('project', { action: 'inspect' }), false);
  assert.equal(waitsForCompilerPrewarm('status', {}), false);
});
