import test from 'node:test';
import assert from 'node:assert/strict';
import { readMetadataBatch } from '../../packages/core/src/composer/service.ts';
import type { OracleAdapter } from '../../packages/core/src/oracle.ts';
import type { Environment } from '../../packages/core/src/config.ts';
import type { Connection } from '../../packages/core/src/connections.ts';
import { Fault } from '../../packages/core/src/result.ts';

const env = { parsingSchema: 'FIXTURE', workspace: 'WS', applicationId: 100 } as Environment;
const connection = { kind: 'sqlcl-store', name: 'fixture' } as unknown as Connection;

/** Each object has `size` rows; queries answer the requested page like Oracle's offset/fetch. */
function fixture(sizes: Record<string, number>, options: { mismatch?: boolean } = {}) {
  const batches: { name: string; offset: number; limit: number }[][] = [];
  let checks = 0;
  const adapter = {
    async verifyTarget() {
      checks++;
      if (options.mismatch) throw new Fault('TARGET_MISMATCH', 'Target identity changed.', 5);
    },
    async jsonQueryBatch(queries: { sql: string; bindings?: Record<string, string | number> }[]) {
      const scoped = queries.slice(1).map((entry) => ({
        name: String(entry.bindings!.p_name),
        offset: Number(entry.bindings!.p_offset),
        limit: Number(entry.bindings!.p_limit),
      }));
      batches.push(scoped);
      return [
        [{ workspace: 'WS' }],
        ...scoped.map(({ name, offset, limit }) =>
          Array.from({ length: Math.max(0, Math.min(limit, (sizes[name] ?? 0) - offset)) }, (_, i) => ({
            column_name: `${name}_${offset + i}`,
          })),
        ),
      ];
    },
  };
  const read = (wanted: { kind: 'columns' | 'signatures'; name: string }[]) =>
    readMetadataBatch(adapter as unknown as OracleAdapter, env, connection, wanted);
  return { read, batches, checks: () => checks };
}

test('Composer metadata reads are deduplicated, batched by eight and paginate only incomplete requests', async () => {
  const names = Array.from({ length: 10 }, (_, i) => `T${i}`);
  const f = fixture({ ...Object.fromEntries(names.map((name) => [name, 3])), T0: 250 });
  const rows = await f.read([
    ...names.map((name) => ({ kind: 'columns' as const, name })),
    { kind: 'columns', name: 't0' },
    { kind: 'columns', name: 'T1' },
  ]);
  assert.equal(rows.size, 10);
  // Batch 1: T0..T7; batch 2: T0 page 2 plus T8, T9; batch 3: T0 page 3 only.
  assert.deepEqual(
    f.batches.map((batch) => batch.map(({ name, offset }) => `${name}@${offset}`)),
    [
      ['T0@0', 'T1@0', 'T2@0', 'T3@0', 'T4@0', 'T5@0', 'T6@0', 'T7@0'],
      ['T0@100', 'T8@0', 'T9@0'],
      ['T0@200'],
    ],
  );
  assert.ok(f.batches.every((batch) => batch.length <= 8 && batch.every((entry) => entry.limit === 100)));
  assert.equal(f.checks(), 3, 'every round trip verifies the target identity');
  const t0 = rows.get('columns:T0')!;
  assert.equal(t0.length, 250);
  assert.deepEqual(t0.slice(0, 2), [{ COLUMN_NAME: 'T0_0' }, { COLUMN_NAME: 'T0_1' }]);
  assert.equal(t0.at(-1)!.COLUMN_NAME, 'T0_249');
  assert.equal(rows.get('columns:T9')!.length, 3);
});

test('Composer metadata batches keep kinds apart and refuse a target mismatch', async () => {
  const f = fixture({ PKG: 2 });
  const rows = await f.read([
    { kind: 'columns', name: 'PKG' },
    { kind: 'signatures', name: 'PKG' },
  ]);
  assert.equal(f.batches.length, 1);
  assert.equal(f.batches[0]!.length, 2);
  assert.equal(rows.get('columns:PKG')!.length, 2);
  assert.equal(rows.get('signatures:PKG')!.length, 2);
  assert.deepEqual(await fixture({}).read([]), new Map());
  await assert.rejects(fixture({ A: 1 }, { mismatch: true }).read([{ kind: 'columns', name: 'A' }]), {
    code: 'TARGET_MISMATCH',
  });
});

test('Composer metadata batches stop at the per-object limit', async () => {
  await assert.rejects(fixture({ BIG: 20000 }).read([{ kind: 'columns', name: 'BIG' }]), {
    code: 'METADATA_LIMIT',
  });
});
