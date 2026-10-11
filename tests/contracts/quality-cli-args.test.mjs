import test from 'node:test';
import assert from 'node:assert/strict';
import { qualityCliArgs } from '../../scripts/lib/quality-cli-args.mjs';
test('CLI parity uses one project argument and preserves private-copy selection', () => {
  const args = qualityCliArgs('/runtime/apexrest.mjs', 'apex validate', '/default', {
    project: '/fault-copy',
  });
  assert.deepEqual(args, ['/runtime/apexrest.mjs', 'apex', 'validate', '--project', '/fault-copy', '--json']);
  assert.equal(args.filter((value) => value === '--project').length, 1);
});
