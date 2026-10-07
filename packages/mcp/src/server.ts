import { VERSION } from '../../core/src/version.ts';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatch, shutdownOracle } from '../../core/src/service.ts';
import { schemas, toolCatalog } from '../../core/src/operations.ts';
import type { Operation } from '../../core/src/operations.ts';
import { failure, Fault } from '../../core/src/result.ts';
import { parse, loadProject } from '../../core/src/config.ts';
import { JobService, settleInlineJobs } from '../../core/src/jobs.ts';
import { toolOutput } from './output.ts';
import { jobToolResult, jobWaitSeconds, runJobTool, shipWaitSeconds } from './job-tools.ts';

const absoluteProject = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (value) =>
      path.isAbsolute(value) &&
      (process.platform !== 'win32' || /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+)/.test(value)),
    'Provide the absolute project directory containing apexrest.json; the plugin runs from its installation directory.',
  )
  .describe('Absolute project directory containing apexrest.json; never the plugin cache.');

// Tools that work without a project: references are offline, status/doctor and
// project init/connections operate on the managed home.
const projectOptional = new Set<Operation>(['reference', 'status', 'project']);
// MCP hosts may launch this process from a plugin cache. Keep this constraint
// at the transport boundary so the CLI retains its current-directory behavior.
export const mcpSchemas = new Map<Operation, z.ZodType<Record<string, unknown>>>();
for (const { operation, long } of toolCatalog) {
  const schema = schemas[operation];
  const transportSchema =
    'project' in schema.shape
      ? schema.safeExtend({
          project: projectOptional.has(operation) ? absoluteProject.optional() : absoluteProject,
        })
      : schema;
  const boundarySchema =
    operation === 'project'
      ? transportSchema.safeExtend({
          directory: absoluteProject.describe('Absolute directory for init.').optional(),
          passwordFile: absoluteProject.describe('Absolute private password file.').optional(),
          envFile: absoluteProject.describe('Absolute ignored local ENV credential file.').optional(),
        })
      : transportSchema;
  mcpSchemas.set(
    operation,
    long
      ? boundarySchema.safeExtend({ waitSeconds: operation === 'ship' ? shipWaitSeconds : jobWaitSeconds })
      : boundarySchema,
  );
}
export function listTools(): Tool[] {
  return toolCatalog.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: z.toJSONSchema(mcpSchemas.get(t.operation)!, { target: 'draft-7', io: 'input' }) as {
      type: 'object';
    },
    annotations: {
      readOnlyHint: t.readOnly,
      destructiveHint: t.destructive ?? false,
      idempotentHint: t.readOnly,
      openWorldHint: t.openWorld ?? false,
    },
  }));
}
/** Database writes remain in a detached worker. */
export function detachedJob(operation: Operation, _input: Record<string, unknown>) {
  const tool = toolCatalog.find((t) => t.operation === operation);
  return tool?.worker ?? false;
}

export async function startMcp() {
  const server = new Server({ name: 'apexrest-apex', version: VERSION }, { capabilities: { tools: {} } });
  let catalog: { tools: Tool[] } | undefined;
  const runtime = path.join(path.dirname(fileURLToPath(import.meta.url)), 'apexrest.mjs');
  server.setRequestHandler(ListToolsRequestSchema, async () => (catalog ??= { tools: listTools() }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const tool = toolCatalog.find((t) => t.name === request.params.name);
    let result;
    let project: string | undefined;
    try {
      if (!tool) throw new Fault('UNKNOWN_TOOL', 'Tool is not in the catalog.', 2);
      const input = parse(mcpSchemas.get(tool.operation)!, request.params.arguments ?? {});
      project = typeof input.project === 'string' ? input.project : undefined;
      const localSync = tool.operation === 'apex.sync' && input.action === 'status';
      const planOnly = tool.operation === 'ship' && input.mode === 'plan';
      if (localSync || planOnly) delete input.waitSeconds;
      if (tool.long && !localSync && !planOnly) {
        const jobs = new JobService(await loadProject(String(input.project)));
        if (tool.operation === 'ship' && input.mode === 'apply') {
          // Validate and plan in-process (no writes); the apply phase runs in a
          // detached worker so a database write survives MCP termination.
          const { waitSeconds, ...domainInput } = input;
          const planned = await dispatch('ship', { ...domainInput, mode: 'plan' }, extra.signal);
          if (!planned.ok) result = planned;
          else {
            const planPath = (planned.data as { planPath: string }).planPath;
            const job = await runJobTool(
              jobs,
              'ship.apply',
              {
                project: input.project,
                env: input.env,
                plan: planPath,
                userRequest: input.userRequest,
                confirmation: input.confirmation,
                waitSeconds,
              },
              runtime,
              extra.signal,
              { waitSchema: shipWaitSeconds },
            );
            result = jobToolResult('ship.apply', job);
            result = {
              ...result,
              operation: 'ship',
              data: { ...(result.data as object), plan: planned.data },
            };
          }
        } else {
          const inline = detachedJob(tool.operation, input)
            ? undefined
            : (operation: string, domainInput: Record<string, unknown>) =>
                jobs.startInline(operation, domainInput, (op, args, signal, progress) =>
                  dispatch(op, args, signal, progress),
                );
          result = jobToolResult(
            tool.operation,
            await runJobTool(jobs, tool.operation, input, runtime, extra.signal, inline ? { inline } : {}),
          );
        }
      } else result = await dispatch(tool.operation, input, extra.signal);
    } catch (e) {
      result = failure(tool?.operation ?? 'unknown', e);
    }
    return toolOutput(result, project);
  });
  const transport = new StdioServerTransport();
  // Pooled SQLcl sessions and in-process jobs belong to this process: settle
  // local jobs and close sessions when the host closes the transport.
  const shutdown = async () => {
    await settleInlineJobs();
    await shutdownOracle();
  };
  for (const signal of ['SIGTERM', 'SIGINT'] as const)
    process.once(signal, () => {
      void shutdown().finally(() => process.exit(0));
    });
  await server.connect(transport);
  server.onclose = () => {
    void shutdown().finally(() => process.exit(0));
  };
}
