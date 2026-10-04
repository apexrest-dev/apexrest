import { z } from 'zod';
import { identifier, parse } from './config.ts';
import type { Environment } from './config.ts';
import type { Connection } from './connections.ts';
import { OracleAdapter } from './oracle.ts';
import { Fault } from './result.ts';
const metadataOffset = z.number().int().min(0).max(100000);
const metadataLimit = z.number().int().min(1).max(100);
export const metadataRequest = z.strictObject({
  kind: z.enum([
    'objects',
    'columns',
    'constraints',
    'constraint-columns',
    'signatures',
    'applications',
    'pages',
  ]),
  schema: identifier,
  name: identifier.optional(),
  offset: metadataOffset.default(0),
  limit: metadataLimit.default(30),
});
const metadataRequests = z.array(metadataRequest).min(1).max(8);
const metadataBatchRequest = z.strictObject({ requests: metadataRequests });
// A plain object remains extendable by project/env in the MCP schema. Runtime
// validation below requires exactly one request form before any Oracle call.
export const metadataInputSchema = z.strictObject({
  kind: metadataRequest.shape.kind.optional(),
  schema: metadataRequest.shape.schema.optional(),
  name: metadataRequest.shape.name,
  offset: metadataOffset.optional(),
  limit: metadataLimit.optional(),
  requests: metadataRequests.optional(),
});
const queries = {
  objects:
    "select object_name, object_type from all_objects where owner=:p_owner and object_type in ('TABLE','VIEW','PACKAGE') and (:p_name is null or object_name=:p_name) order by object_name, object_type",
  columns:
    'select table_name,column_name,data_type,data_length,char_length,char_used,data_precision,data_scale,nullable,column_id from all_tab_columns where owner=:p_owner and table_name=:p_name order by column_id',
  constraints:
    'select table_name,constraint_name,constraint_type,r_owner,r_constraint_name,status,validated from all_constraints where owner=:p_owner and table_name=:p_name order by constraint_name',
  'constraint-columns':
    'select c.table_name,c.constraint_name,c.constraint_type,c.status,c.validated,cc.column_name,cc.position,c.r_owner,c.r_constraint_name,rc.table_name referenced_table,rcc.column_name referenced_column from all_constraints c join all_cons_columns cc on cc.owner=c.owner and cc.constraint_name=c.constraint_name and cc.table_name=c.table_name left join all_constraints rc on rc.owner=c.r_owner and rc.constraint_name=c.r_constraint_name and rc.owner=:p_owner left join all_cons_columns rcc on rcc.owner=rc.owner and rcc.constraint_name=rc.constraint_name and rcc.position=cc.position where c.owner=:p_owner and c.table_name=:p_name order by c.constraint_name,cc.position',
  signatures:
    'select package_name,object_name,argument_name,position,sequence,data_level,in_out,data_type,type_owner,type_name,type_subname,defaulted,overload,subprogram_id from all_arguments where owner=:p_owner and package_name=:p_name order by object_name,overload,sequence',
  applications:
    'select application_id,application_name,alias from apex_applications where owner=:p_owner and application_id=:p_app_id order by application_id',
  pages:
    'select application_id,page_id,page_name,page_alias from apex_application_pages where application_id=:p_app_id and workspace=:p_workspace order by page_id',
};
export async function metadataRead(
  adapter: OracleAdapter,
  env: Environment,
  connection: Connection,
  value: unknown,
) {
  const input = parse(z.union([metadataRequest, metadataBatchRequest]), value);
  const batch = 'requests' in input;
  const requests = batch ? input.requests : [input];
  for (const r of requests) {
    if (r.schema !== env.parsingSchema)
      throw new Fault('SCHEMA_DENIED', 'Metadata is restricted to the configured parsing schema.', 4);
    if (['columns', 'constraints', 'constraint-columns', 'signatures'].includes(r.kind) && !r.name)
      throw new Fault('OBJECT_REQUIRED', 'Select a specific object first.', 2);
  }
  await adapter.verifyTarget(env, connection);
  const query = (r: z.infer<typeof metadataRequest>) => ({
    sql: queries[r.kind] + ' offset :p_offset rows fetch next :p_limit rows only',
    bindings: {
      p_owner: r.schema,
      p_name: r.name ?? '',
      p_app_id: env.applicationId,
      p_workspace: env.workspace,
      p_offset: r.offset,
      p_limit: r.limit,
    },
  });
  const page = (r: z.infer<typeof metadataRequest>, rows: Record<string, unknown>[]) => ({
    dataClassification: 'untrusted_database_content',
    rows,
    offset: r.offset,
    nextOffset: rows.length === r.limit ? r.offset + r.limit : null,
  });
  if (!batch) {
    const q = query(input);
    return page(input, await adapter.jsonQuery(q.sql, connection, q.bindings));
  }
  // One SQLcl session answers the whole batch in order. Any failure rejects
  // the operation; do not fabricate a partial success.
  const rows = await adapter.jsonQueryBatch(requests.map(query), connection);
  const results = requests.map((r, index) => ({
    index,
    kind: r.kind,
    ...(r.name ? { name: r.name } : {}),
    ...page(r, rows[index] ?? []),
  }));
  if (rows.length !== requests.length)
    throw new Fault('EMPTY_QUERY_RESULT', 'SQLcl did not answer every metadata request.', 1);
  return { results, targetVerifiedOnce: true };
}
