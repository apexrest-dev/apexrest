import type { Environment, ProjectContext } from './config.ts';
import type { Connection } from './connections.ts';
import type { OracleAdapter } from './oracle.ts';
import { Fault } from './result.ts';
import { readMetadataBatch } from './composer/service.ts';
import { oracleType } from './composer/binding.ts';
import { loadEntity, type EntityContract, type EntityDiagnostic } from './entities.ts';

/**
 * Entity contract validation (`project action:entity_check`). Offline it repeats the structural
 * checks, confirms referenced shared LOVs exist in the sources and lists every assumption it cannot
 * verify — it never calls the database. With an `env` it reads the referenced tables' columns and
 * constraints through the existing batched, paginated, target-verified metadata service (one read
 * per table and kind, however often a table is referenced) and diagnoses missing tables or columns,
 * changed types, a key that differs from the primary key and lengths that no longer fit. Nothing is
 * rewritten: the contract stays as reviewed. A connected result binds the contract digest and the
 * observed target; `expectedDigest` refuses a contract that changed since it was reviewed.
 */

const TYPES: Record<string, string[]> = {
  varchar2: ['VARCHAR2', 'NVARCHAR2', 'CHAR', 'NCHAR', 'CLOB', 'NCLOB'],
  number: ['NUMBER', 'INTEGER', 'FLOAT', 'BINARY_FLOAT', 'BINARY_DOUBLE'],
  date: ['DATE'],
  timestamp: ['TIMESTAMP', 'TIMESTAMP WITH TIME ZONE', 'TIMESTAMP WITH LOCAL TIME ZONE'],
};

/** Tables whose columns the contract names: the read table and the write table. */
function tables(contract: EntityContract): string[] {
  const names = new Set<string>();
  if ('table' in contract.read) names.add(contract.read.table.toUpperCase());
  if (contract.write) names.add(contract.write.table.toUpperCase());
  return [...names];
}

function assumptions(contract: EntityContract): string[] {
  const found = [];
  for (const table of tables(contract))
    found.push(`${table} exists with the declared columns, types, lengths and primary key.`);
  if ('sql' in contract.read)
    found.push(
      'The read SQL returns every declared field; the compiler checks the query, this check does not run it.',
    );
  if (contract.authorization.read && 'scheme' in contract.authorization.read)
    found.push(`Authorization scheme ${contract.authorization.read.scheme} exists in the application.`);
  if (contract.authorization.write)
    found.push(`Authorization scheme ${contract.authorization.write.scheme} exists in the application.`);
  return found;
}

export interface EntityCheckInput {
  entity: string;
  env?: string | undefined;
  expectedDigest?: string | undefined;
}
export interface EntityCheckDependencies {
  oracle: OracleAdapter;
  environment: (name: string) => Environment;
  connection: (env: Environment) => Promise<Connection>;
  lovExists: (key: string) => Promise<boolean>;
  signal?: AbortSignal | undefined;
}

export async function checkEntityBinding(
  ctx: ProjectContext,
  input: EntityCheckInput,
  deps: EntityCheckDependencies,
) {
  const loaded = await loadEntity(ctx, input.entity);
  if (input.expectedDigest && input.expectedDigest !== loaded.digest)
    throw new Fault(
      'TRANSFORM_CONFLICT',
      `${loaded.file} changed since it was reviewed; read it again.`,
      5,
      'conflict',
      { file: loaded.file, currentDigest: loaded.digest },
    );
  const { contract } = loaded;
  const diagnostics: EntityDiagnostic[] = [...loaded.diagnostics];
  // Shared LOVs are source components: checked offline in the application sources.
  for (const [name, field] of Object.entries(contract.fields))
    if (field.lov && 'shared' in field.lov && !(await deps.lovExists(field.lov.shared)))
      diagnostics.push({
        code: 'ENTITY_LOV_MISSING',
        message: `${name} uses shared LOV ${field.lov.shared}, which the application sources do not declare.`,
        path: `fields.${name}.lov`,
      });
  const base = { entity: loaded.id, file: loaded.file, digest: loaded.digest };
  if (!input.env)
    return {
      ...base,
      mode: 'offline' as const,
      databaseCalls: 0,
      diagnostics,
      assumptions: assumptions(contract),
      verified: false,
      next: 'Pass env to check the assumptions against the configured DEV/QA/TEST target.',
    };
  const env = deps.environment(input.env);
  const names = tables(contract);
  const wanted = names.flatMap((name) => [
    { kind: 'columns' as const, name },
    { kind: 'constraint-columns' as const, name },
  ]);
  const rows = await readMetadataBatch(deps.oracle, env, await deps.connection(env), wanted, deps.signal);
  const remaining: string[] =
    'sql' in contract.read ? [assumptions(contract).find((a) => a.startsWith('The read SQL'))!] : [];
  for (const table of names) {
    const columns = rows.get(`columns:${table}`) ?? [];
    if (!columns.length) {
      diagnostics.push({
        code: 'ENTITY_TABLE_MISSING',
        message: `${table} is not visible in ${env.parsingSchema}.`,
      });
      continue;
    }
    const column = (name: string) =>
      columns.find((row) => String(row.COLUMN_NAME).toUpperCase() === name.toUpperCase());
    // Fields are checked against a table when it is the read table, or the write table for writable fields.
    const isRead = 'table' in contract.read && contract.read.table.toUpperCase() === table;
    for (const [name, field] of Object.entries(contract.fields)) {
      if (!isRead && field.readOnly) continue;
      const observed = column(name);
      if (!observed) {
        diagnostics.push({
          code: 'ENTITY_COLUMN_MISSING',
          message: `${table} has no column ${name}.`,
          path: `fields.${name}`,
        });
        continue;
      }
      const type = oracleType(observed.DATA_TYPE);
      if (!TYPES[field.type]!.includes(type))
        diagnostics.push({
          code: 'ENTITY_TYPE_CHANGED',
          message: `${table}.${name} is ${type}, not a ${field.type} column.`,
          path: `fields.${name}.type`,
        });
      const length = Number(observed.CHAR_LENGTH ?? 0) || Number(observed.DATA_LENGTH ?? 0);
      if (field.type === 'varchar2' && field.maxLength && length && field.maxLength > length)
        diagnostics.push({
          code: 'ENTITY_LENGTH_CHANGED',
          message: `${table}.${name} holds ${length} characters; the contract allows ${field.maxLength}.`,
          path: `fields.${name}.maxLength`,
        });
      if (
        field.required &&
        String(observed.NULLABLE ?? '') === 'Y' &&
        contract.key.some((key) => key.toUpperCase() === name.toUpperCase())
      )
        diagnostics.push({
          code: 'ENTITY_KEY_CHANGED',
          message: `Key column ${table}.${name} is nullable.`,
          path: 'key',
        });
    }
    if (contract.write?.table.toUpperCase() === table) {
      const primary = (rows.get(`constraint-columns:${table}`) ?? [])
        .filter((row) => row.CONSTRAINT_TYPE === 'P')
        .sort((a, b) => Number(a.POSITION) - Number(b.POSITION))
        .map((row) => String(row.COLUMN_NAME).toUpperCase());
      const key = contract.key.map((name) => name.toUpperCase());
      if (JSON.stringify(primary) !== JSON.stringify(key))
        diagnostics.push({
          code: 'ENTITY_KEY_CHANGED',
          message: primary.length
            ? `${table} primary key is ${primary.join(', ')}; the contract key is ${key.join(', ')}.`
            : `${table} has no primary key; the contract key ${key.join(', ')} cannot identify rows for writes.`,
          path: 'key',
        });
    }
  }
  return {
    ...base,
    mode: 'connected' as const,
    target: {
      env: input.env,
      workspace: env.workspace,
      applicationId: env.applicationId,
      schema: env.parsingSchema,
    },
    tablesRead: names,
    diagnostics,
    assumptions: [
      ...remaining,
      ...assumptions(contract).filter((assumption) => assumption.startsWith('Authorization scheme')),
    ],
    // Bound to this digest and target: any change to either needs a new check.
    verified: diagnostics.length === 0,
    next: diagnostics.length
      ? 'Review the contract against these differences; it was not changed.'
      : 'Use this digest with this target for generation.',
  };
}
