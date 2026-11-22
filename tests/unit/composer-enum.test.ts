import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldSchema } from '../../packages/core/src/composer/schemas.ts';

const field = { column: 'STATUS', type: 'string' as const, nullable: false };

test('Composer rejects Oracle NULL enum values before producing a NOT IN validation', () => {
  for (const nullable of [false, true])
    for (const values of [[''], ['', 'ACTIVE'], ['ACTIVE', '']]) {
      const result = fieldSchema.safeParse({ ...field, nullable, enum: values });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.match(result.error.message, /Oracle NULL/);
        assert.ok(result.error.issues.some((issue) => issue.path[0] === 'enum'));
      }
    }
});

test('Composer requires a nonempty distinct enum and retains explicit nullability', () => {
  assert.equal(fieldSchema.safeParse({ ...field, enum: [] }).success, false);
  assert.equal(fieldSchema.safeParse({ ...field, enum: ['ACTIVE', 'ACTIVE'] }).success, false);
  assert.deepEqual(fieldSchema.parse(field), field);
  for (const nullable of [false, true]) {
    const value = { ...field, nullable, enum: ['ACTIVE', 'Active', "O'Reilly", '0'] };
    assert.deepEqual(fieldSchema.parse(value), value);
  }
});
