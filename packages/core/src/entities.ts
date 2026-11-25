import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ProjectContext } from './config.ts';
import { exists } from './fs.ts';
import { Fault } from './result.ts';

/**
 * Project entity contracts (`entities/<id>.json` next to `apexrest.json`): the reviewed, reusable
 * data binding a page recipe needs — where rows are read from, the ordered key, typed and labelled
 * fields, who may read and write, which writes are allowed and how lost updates are detected. A
 * contract is data, not code: SQL is opaque reviewed text that is never executed here, and nothing
 * is inferred from table names. Every security-relevant choice is explicit: read authorization is a
 * named scheme or an explicit `public: true`, and a write contract needs its own scheme, table and
 * lost-update rule. Contracts are a binding layer for scaffold recipes; the scaffold and Composer
 * specification models are separate and unchanged.
 */

export const ENTITY_SCHEMA_VERSION = 1;
const identifier = z.string().regex(/^[A-Za-z][A-Za-z0-9_$#]{0,127}$/u, 'Oracle identifier');
const id = z.string().regex(/^[a-z][a-z0-9-]{0,62}$/u, 'Lowercase id: letters, digits and hyphens');
const text = z.string().min(1).max(255);
const sql = z
  .string()
  .min(1)
  .max(64000)
  .refine((value) => /^\s*(select|with)\b/iu.test(value), 'Supply a SELECT query')
  .refine(
    (value) => !value.includes('```') && !/[\x00\r]/u.test(value),
    'No fence delimiters or control characters',
  );
const scheme = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,254}$/u, 'Authorization scheme name');

export const entityFieldSchema = z.strictObject({
  type: z.enum(['varchar2', 'number', 'date', 'timestamp']),
  label: text,
  required: z.boolean().default(false),
  readOnly: z.boolean().default(false),
  maxLength: z.number().int().positive().max(32767).optional(),
  formatMask: z.string().min(1).max(255).optional(),
  /** A reviewed shared LOV (id or name) or explicit static values. */
  lov: z
    .union([
      z.strictObject({ shared: z.string().min(1).max(255) }),
      z.strictObject({
        values: z
          .array(z.strictObject({ label: text, value: z.string().min(1).max(255) }))
          .min(1)
          .max(100),
      }),
    ])
    .optional(),
});

export const entityContractSchema = z.strictObject({
  schemaVersion: z.literal(ENTITY_SCHEMA_VERSION),
  id,
  label: text,
  pluralLabel: text,
  /** Where rows are read from: complete reviewed SQL or a table/view. */
  read: z.union([
    z.strictObject({ sql }),
    z.strictObject({ table: identifier, owner: identifier.optional() }),
  ]),
  /** Ordered key columns; every one is a declared, required field. */
  key: z.array(identifier).min(1).max(8),
  fields: z.record(identifier, entityFieldSchema),
  authorization: z.strictObject({
    read: z.union([z.strictObject({ scheme }), z.strictObject({ public: z.literal(true) })]),
    write: z.strictObject({ scheme }).optional(),
  }),
  /** Omit for a read-only entity. */
  write: z
    .strictObject({
      table: identifier,
      operations: z
        .array(z.enum(['insert', 'update', 'delete']))
        .min(1)
        .max(3),
      lostUpdate: z.union([z.strictObject({ rowVersion: identifier }), z.literal('rowValues')]),
    })
    .optional(),
  /** Where the contract came from (a review, a ticket); recorded, not interpreted. */
  provenance: z.string().min(1).max(512).optional(),
});
export type EntityContract = z.infer<typeof entityContractSchema>;

export interface EntityDiagnostic {
  code: string;
  message: string;
  path?: string;
}

/** Checks the schema does not express: field, key and write-contract consistency. */
export function checkEntity(contract: EntityContract): EntityDiagnostic[] {
  const diagnostics: EntityDiagnostic[] = [];
  const add = (code: string, message: string, at?: string) =>
    diagnostics.push({ code, message, ...(at ? { path: at } : {}) });
  const names = Object.keys(contract.fields);
  const upper = new Map<string, string[]>();
  for (const name of names) upper.set(name.toUpperCase(), [...(upper.get(name.toUpperCase()) ?? []), name]);
  for (const [, duplicates] of upper)
    if (duplicates.length > 1)
      add('ENTITY_DUPLICATE_FIELD', `Fields ${duplicates.join(', ')} differ only in case.`, 'fields');
  const field = (name: string) => names.find((candidate) => candidate.toUpperCase() === name.toUpperCase());
  const keys = contract.key.map((name) => name.toUpperCase());
  if (new Set(keys).size !== keys.length) add('ENTITY_KEY_INVALID', 'Key columns repeat.', 'key');
  for (const name of contract.key) {
    const declared = field(name);
    if (!declared) add('ENTITY_KEY_INVALID', `Key column ${name} is not a declared field.`, 'key');
    else {
      const definition = contract.fields[declared]!;
      if (!definition.required)
        add('ENTITY_KEY_INVALID', `Key column ${name} must be required.`, `fields.${declared}`);
      if (definition.type === 'date' || definition.type === 'timestamp')
        add(
          'ENTITY_KEY_INVALID',
          `Key column ${name} is a ${definition.type}; use a number or varchar2 key.`,
          `fields.${declared}`,
        );
    }
  }
  for (const [name, definition] of Object.entries(contract.fields)) {
    if (definition.maxLength !== undefined && definition.type !== 'varchar2')
      add('ENTITY_FIELD_INVALID', `${name}: maxLength applies to varchar2 fields.`, `fields.${name}`);
    if (definition.formatMask !== undefined && definition.type === 'varchar2')
      add('ENTITY_FIELD_INVALID', `${name}: formatMask applies to number and date fields.`, `fields.${name}`);
  }
  if (contract.write) {
    if (!contract.authorization.write)
      add(
        'ENTITY_WRITE_INCOMPLETE',
        'A write contract needs authorization.write (its own scheme).',
        'authorization.write',
      );
    const lost = contract.write.lostUpdate;
    if (typeof lost === 'object') {
      const declared = field(lost.rowVersion);
      if (!declared)
        add(
          'ENTITY_WRITE_INCOMPLETE',
          `Row version column ${lost.rowVersion} is not a declared field.`,
          'write.lostUpdate',
        );
      else if (contract.fields[declared]!.type !== 'number')
        add(
          'ENTITY_WRITE_INCOMPLETE',
          `Row version column ${lost.rowVersion} must be a number.`,
          `fields.${declared}`,
        );
    }
    if (new Set(contract.write.operations).size !== contract.write.operations.length)
      add('ENTITY_WRITE_INCOMPLETE', 'Write operations repeat.', 'write.operations');
    // Inserts set every required field, except read-only key columns the database assigns.
    const unset = Object.entries(contract.fields)
      .filter(
        ([name, definition]) =>
          definition.required && definition.readOnly && !keys.includes(name.toUpperCase()),
      )
      .map(([name]) => name);
    if (contract.write.operations.includes('insert') && unset.length)
      add(
        'ENTITY_WRITE_INCOMPLETE',
        `Inserts cannot set required read-only fields ${unset.join(', ')}.`,
        'fields',
      );
  } else if (contract.authorization.write)
    add(
      'ENTITY_WRITE_INCOMPLETE',
      'authorization.write is set but the entity has no write contract.',
      'authorization.write',
    );
  if (
    'table' in contract.read &&
    contract.write &&
    contract.write.table.toUpperCase() !== contract.read.table.toUpperCase()
  )
    diagnostics.push({
      code: 'ENTITY_WRITE_TABLE',
      message: `Rows are read from ${contract.read.table} but written to ${contract.write.table}; review that both describe the same rows.`,
      path: 'write.table',
    });
  return diagnostics;
}

/** Canonical JSON (sorted keys) of a parsed contract; its digest identifies the reviewed content. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export const entityDigest = (contract: EntityContract) =>
  createHash('sha256').update(canonical(contract), 'utf8').digest('hex');

const directory = (ctx: ProjectContext) => path.join(ctx.root, 'entities');

export interface LoadedEntity {
  id: string;
  file: string;
  schemaVersion: number;
  digest: string;
  contract: EntityContract;
  diagnostics: EntityDiagnostic[];
}

/** Reads and checks one contract; invalid JSON or schema errors are faults, consistency issues diagnostics. */
export async function loadEntity(ctx: ProjectContext, entity: string): Promise<LoadedEntity> {
  if (!/^[a-z][a-z0-9-]{0,62}$/u.test(entity))
    throw new Fault('INVALID_INPUT', `${entity} is not an entity id.`, 2);
  const file = path.join(directory(ctx), `${entity}.json`);
  if (!(await exists(file)))
    throw new Fault('TARGET_NOT_FOUND', `No entity contract entities/${entity}.json.`, 2);
  const raw = await readFile(file, 'utf8');
  if (Buffer.byteLength(raw) > 256 * 1024)
    throw new Fault('INVALID_INPUT', 'Entity contracts are limited to 256 KiB.', 2);
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Fault('INVALID_INPUT', `entities/${entity}.json is not valid JSON.`, 2);
  }
  const parsed = entityContractSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Fault(
      'ENTITY_INVALID',
      `entities/${entity}.json: ${issue?.path.join('.')} ${issue?.message}`,
      2,
    );
  }
  if (parsed.data.id !== entity)
    throw new Fault(
      'ENTITY_INVALID',
      `entities/${entity}.json declares id ${parsed.data.id}; the file name is the id.`,
      2,
    );
  return {
    id: entity,
    file: path.relative(ctx.root, file).split(path.sep).join('/'),
    schemaVersion: parsed.data.schemaVersion,
    digest: entityDigest(parsed.data),
    contract: parsed.data,
    diagnostics: checkEntity(parsed.data),
  };
}

/** Lists every contract with its digest and diagnostics; a broken file is listed with its fault. */
export async function listEntities(ctx: ProjectContext) {
  const dir = directory(ctx);
  const files = (await exists(dir))
    ? (await readdir(dir)).filter((name) => name.endsWith('.json')).sort()
    : [];
  const entities = [];
  for (const name of files) {
    const entity = name.slice(0, -'.json'.length);
    try {
      const loaded = await loadEntity(ctx, entity);
      entities.push({
        id: loaded.id,
        file: loaded.file,
        schemaVersion: loaded.schemaVersion,
        digest: loaded.digest,
        label: loaded.contract.label,
        writable: loaded.contract.write?.operations ?? [],
        diagnostics: loaded.diagnostics,
      });
    } catch (error) {
      entities.push({
        id: entity,
        file: `entities/${name}`,
        diagnostics: [{ code: (error as Fault).code ?? 'ENTITY_INVALID', message: (error as Error).message }],
      });
    }
  }
  return {
    directory: 'entities',
    entities,
    next: entities.length
      ? 'Use an entity id and digest in a recipe request; fix diagnostics first.'
      : 'Add reviewed contracts as entities/<id>.json.',
  };
}
