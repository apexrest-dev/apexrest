import { z } from 'zod';
import { identifier, relativePath } from '../config.ts';

export const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const name = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
export const version = z.string().regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/);
export const blockId = z.string().regex(/^block:[a-z0-9-]+\/[a-z0-9-]+$/);
/** Owned generated source and reviewed extension code. Kept in sync with plan read limits. */
export const OWNED_TEXT_LIMIT = 1024 * 1024;
const text = z.string().max(OWNED_TEXT_LIMIT);
/** Enumerated values become SQL literals inside generated code fences. */
export const literalValue = z
  .string()
  .max(128)
  .regex(/^[^\x00-\x1f\x7f`]*$/, 'Enumerated values must be single-line text without backticks.');
export const fieldSchema = z.strictObject({
  column: identifier,
  type: z.enum(['string', 'integer', 'decimal', 'date', 'timestamp', 'boolean']),
  nullable: z.boolean(),
  maxLength: z.number().int().positive().optional(),
  precision: z.number().int().positive().optional(),
  scale: z.number().int().optional(),
  enum: z.array(literalValue).max(100).optional(),
});
const contractBase = {
  schemaVersion: z.literal(1),
  provenance: z.string().min(1).max(512),
};
export const contractSchema = z.discriminatedUnion('kind', [
  z
    .strictObject({
      ...contractBase,
      kind: z.literal('authorization'),
      rowPredicate: text.optional(),
      expression: text.optional(),
    })
    .refine(
      (c) => Boolean(c.rowPredicate?.trim() || c.expression?.trim()),
      'Authorization requires a server expression or row predicate.',
    ),
  z.strictObject({ ...contractBase, kind: z.literal('key'), fields: z.array(name).min(1).max(16) }),
  z.strictObject({
    ...contractBase,
    kind: z.literal('command'),
    transaction: z.literal('caller-owned'),
    overload: z.string().min(1).max(32).optional(),
    parameters: z.record(
      identifier,
      z.strictObject({
        mode: z.enum(['in', 'out', 'in-out']),
        type: z.enum([
          'NUMBER',
          'PLS_INTEGER',
          'BINARY_INTEGER',
          'VARCHAR2',
          'CHAR',
          'NVARCHAR2',
          'NCHAR',
          'DATE',
          'TIMESTAMP',
        ]),
        defaulted: z.boolean().default(false),
      }),
    ),
  }),
  z.strictObject({ ...contractBase, kind: z.literal('errors') }),
]);
export const entitySchema = z.strictObject({
  read: z.strictObject({
    kind: z.enum(['oracle-table', 'oracle-view']),
    object: identifier,
    key: z.array(name).min(1).max(16),
    keyContract: z.string().optional(),
    fields: z.record(name, fieldSchema),
  }),
  authorization: z.strictObject({ readContract: z.string(), writeContract: z.string().optional() }),
  capabilities: z.strictObject({ optimisticLock: z.strictObject({ field: name }).optional() }).default({}),
});
export const commandSchema = z.strictObject({
  kind: z.literal('oracle-procedure'),
  package: identifier,
  procedure: identifier,
  signatureRef: z.string(),
  transaction: z.literal('caller-owned'),
  inputs: z.record(identifier, z.strictObject({ from: z.string(), mode: z.enum(['in', 'in-out']) })),
  outputs: z.strictObject({
    recordKey: z.strictObject({ from: identifier }),
    recordVersion: z.strictObject({ from: identifier }),
  }),
  errorContract: z.string(),
  authorizationContract: z.string(),
});
export const parametersSchema = z.strictObject({
  title: z.string().min(1).max(180),
  editableFields: z.array(name).max(32).default([]),
  createEnabled: z.boolean().default(false),
  editEnabled: z.boolean().default(false),
  deleteEnabled: z.literal(false).default(false),
  groupField: name.optional(),
  filterField: name.optional(),
  timeField: name.optional(),
  detailField: name.optional(),
  parentField: name.optional(),
});
export const instanceSchema = z.strictObject({
  use: z.string().regex(/^block:[a-z0-9-]+\/[a-z0-9-]+@\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/),
  parameters: parametersSchema,
  bindings: z.strictObject({ records: z.string(), saveRecord: z.string().optional() }),
  ownership: z.enum(['managed', 'extended', 'detached']).default('managed'),
  extensions: z.partialRecord(z.enum(['beforeSaveValidation', 'afterSaveNotification']), text).default({}),
});
export const blueprintSchema = z.strictObject({
  schemaVersion: z.literal(1),
  application: z.strictObject({
    mode: z.literal('extend'),
    environment: name.optional(),
    compatibilityProfile: z.string(),
    preserve: z.strictObject({
      authentication: z.literal(true),
      authorization: z.literal(true),
      unmanagedSource: z.literal(true),
    }),
  }),
  entities: z.record(name, entitySchema),
  commands: z.record(name, commandSchema).default({}),
  contracts: z.record(z.string().regex(/^project:[a-z0-9-]+$/), contractSchema).default({}),
  blocks: z.record(name, instanceSchema),
  connections: z
    .array(
      z.strictObject({
        from: z.string(),
        to: z.string(),
        behavior: z.strictObject({ coalesce: z.literal(true) }),
      }),
    )
    .max(256)
    .default([]),
});
export const blockSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: blockId,
  version,
  kind: z.literal('block'),
  name: z.string().min(1).max(180),
  aliases: z.array(z.string().max(128)),
  status: z.enum(['draft', 'experimental', 'verified', 'deprecated', 'revoked']),
  license: z.string(),
  origin: z.string(),
  recipeRefs: z.array(z.string()),
  compatibility: z.strictObject({ profileRefs: z.array(z.string()) }),
  renderer: z.enum([
    'report-dialog',
    'status-summary',
    'filtered-list',
    'read-only-detail',
    'history-timeline',
    'master-detail',
  ]),
  ports: z.strictObject({
    inputs: z.array(z.enum(['records', 'saveRecord'])),
    outputs: z.array(z.literal('saved')),
  }),
  requires: z.strictObject({ blocks: z.array(z.string()), capabilities: z.array(z.string()) }),
  source: z.strictObject({ files: z.array(relativePath) }),
  effects: z.strictObject({
    local: z.array(z.string()),
    deployment: z.array(z.string()),
    applicationRuntime: z.array(z.string()),
    authentication: z.literal('preserve'),
  }),
  limitations: z.array(z.string()),
});
export const allocationSchema = z.strictObject({
  page: z.number().int().positive(),
  dialog: z.number().int().positive().nullable(),
  prefix: name,
});
export const rendererSchema = z.strictObject({
  schemaVersion: z.literal(1),
  renderer: blockSchema.shape.renderer,
  escape: z.literal('native-plain-text'),
  transaction: z.literal('caller-owned'),
  savedPayload: z.tuple([
    z.literal('entityRef'),
    z.literal('recordKey'),
    z.literal('recordVersion'),
    z.literal('operation'),
    z.literal('originInstance'),
    z.literal('correlationId'),
  ]),
});
export const ownerSchema = z.strictObject({
  instanceId: name,
  blockId,
  version,
  mode: z.enum(['managed', 'extended', 'detached']),
  files: z.record(relativePath, digest),
  bases: z.record(relativePath, digest),
  allocation: allocationSchema,
  consumers: z.array(name),
  provenance: digest,
});
export const stateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  generatorVersion: z.literal('1'),
  generationDigest: digest,
  blueprintDigest: digest,
  lockDigest: digest,
  owners: z.record(name, ownerSchema),
});
export const lockSchema = z.strictObject({
  schemaVersion: z.literal(1),
  generatorVersion: z.literal('1'),
  resolverPolicyVersion: z.literal('1'),
  blueprintSemanticDigest: digest,
  catalogDigest: digest,
  compatibilityProfile: z.string(),
  packages: z.record(z.string(), digest),
  contractDigest: digest,
});
export const diagnosticSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
});
export const operationSchema = z.strictObject({
  path: relativePath,
  before: digest.nullable(),
  after: digest.nullable(),
  content: text.nullable(),
  reason: z.string(),
});
export const planSchema = z.strictObject({
  schemaVersion: z.literal(1),
  generatorVersion: z.literal('1'),
  kind: z.enum(['composition', 'recovery-resume', 'recovery-restore']),
  status: z.enum(['materializable', 'blocked']),
  projectId: z.string(),
  blueprintPath: relativePath,
  blueprintDigest: digest,
  catalogDigest: digest,
  configurationDigest: digest,
  toolchainDigest: digest,
  sourceInventory: z.record(relativePath, digest),
  stateDigest: digest.nullable(),
  validation: z.enum(['compiler', 'source-only']),
  mode: z.enum(['offline', 'connected']),
  contextDigest: digest,
  environment: z.string().nullable(),
  review: z.strictObject({
    entities: z.record(name, entitySchema),
    commands: z.record(name, commandSchema),
    contracts: z.record(z.string(), contractSchema),
    packages: z.record(
      z.string(),
      z.strictObject({
        digest,
        origin: z.string(),
        license: z.string(),
        effects: blockSchema.shape.effects,
        dependencies: z.array(z.string()),
      }),
    ),
  }),
  recovery: z
    .strictObject({ journalId: z.uuid(), sourcePlanDigest: digest, recordsDigest: digest })
    .optional(),
  allocations: z.record(name, allocationSchema),
  operations: z.array(operationSchema).max(2048),
  state: stateSchema.nullable(),
  lock: lockSchema.nullable(),
  diagnostics: z.array(diagnosticSchema),
  digest,
});
export const evidenceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.enum([
    'schema',
    'unit',
    'compiler',
    'sql-read',
    'sql-write',
    'import',
    'browser-observation',
    'browser-automation',
    'authorization',
    'upgrade',
    'packaging',
  ]),
  status: z.enum(['passed', 'failed', 'not-run', 'blocked', 'stale']),
  sourceDigest: digest,
  generatorDigest: digest,
  configurationDigest: digest,
  fixtureDigest: digest,
  profile: z.string(),
  tool: z.string(),
  runner: z.enum(['local', 'mock', 'oracle', 'native-host']),
  timestamp: z.string(),
  artifacts: z.array(z.string()),
  reason: z.string(),
});
export type Blueprint = z.infer<typeof blueprintSchema>;
export type Block = z.infer<typeof blockSchema>;
export type CompositionPlan = z.infer<typeof planSchema>;
export type CompositionState = z.infer<typeof stateSchema>;
export type Owner = z.infer<typeof ownerSchema>;
export type Entity = z.infer<typeof entitySchema>;
export type Instance = z.infer<typeof instanceSchema>;
export type Allocation = z.infer<typeof allocationSchema>;
