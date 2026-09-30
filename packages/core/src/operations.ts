import { z } from 'zod';
import { composePlanInput, composeMaterializeInput } from './composer/service.ts';
import { metadataInputSchema } from './metadata.ts';
import { refName, relativePath } from './config.ts';
import { savedConnectionName, ordsUrl, ordsUsername } from './connections.ts';
import { sqlclMode, sqlclRestriction, databaseTransport } from './sqlcl-config.ts';
import { panelReadSchema, publicPanelActionSchema } from './panel-schema.ts';
const project = z.string().min(1).max(4096).optional(),
  env = refName;
const base = { project };
const dependencies = {
  home: z.string().optional(),
  yes: z.boolean().default(false),
  nonInteractive: z.boolean().default(false),
  offline: z.boolean().default(false),
  cacheDir: z.string().optional(),
  dryRun: z.boolean().default(false),
  acceptOracleLicense: z.boolean().default(false),
  skipBrowser: z.boolean().default(false),
  installOsDeps: z.boolean().default(false),
};
const setup = {
  ...base,
  ...dependencies,
  from: z.string().optional(),
  codexHome: z.string().optional(),
  scope: z.enum(['user', 'project']).default('user'),
  version: z.string().optional(),
  nativeOnly: z.boolean().default(false),
};
export const schemas = {
  version: z.strictObject({}),
  doctor: z.strictObject(base),
  'sqlcl.status': z.strictObject({}),
  'sqlcl.configure': z.strictObject({
    mode: sqlclMode,
    mcpRestrictLevel: sqlclRestriction.optional(),
    databaseTransport: databaseTransport.optional(),
  }),
  'panel.open': panelReadSchema,
  'panel.status': panelReadSchema,
  'panel.action': publicPanelActionSchema,
  setup: z.strictObject(setup),
  'dependencies.install': z.strictObject(dependencies),
  'dependencies.uninstall': z.strictObject({
    home: z.string().optional(),
    dryRun: z.boolean().default(false),
    yes: z.boolean().default(false),
  }),
  'plugin.validate': z.strictObject({ ...base, from: z.string().optional() }),
  'plugin.install': z.strictObject(setup),
  'plugin.update': z.strictObject({ ...setup, version: z.string().min(1) }),
  'plugin.uninstall': z.strictObject({
    ...base,
    home: z.string().optional(),
    keepRuntime: z.boolean().default(false),
  }),
  'project.init': z.strictObject({
    ...base,
    directory: z.string().min(1),
    template: z.enum(['blank-app', 'customer-crm', 'existing-app']).default('blank-app'),
    alias: refName.optional(),
  }),
  'project.adopt': z.strictObject({
    ...base,
    env,
    appId: z.number().int().positive(),
    workingCopy: z.boolean().default(false),
  }),
  'project.inspect': z.strictObject({ ...base, detail: z.enum(['full', 'summary']).default('full') }),
  'connection.add': z
    .strictObject({
      ...base,
      name: refName,
      sqlclName: savedConnectionName.optional(),
      ordsUrl: ordsUrl.optional(),
      ordsUsername: ordsUsername.optional(),
      passwordFile: z.string().min(1).max(4096).optional(),
    })
    .refine(
      (value) => !!value.sqlclName || !!(value.ordsUrl && value.ordsUsername),
      'Supply a direct SQLcl name or ORDS URL and username.',
    ),
  'connection.list': z.strictObject({ ...base, saved: z.boolean().default(false) }),
  'connection.test': z.strictObject({
    ...base,
    name: savedConnectionName,
    saved: z.boolean().default(false),
  }),
  'connection.remove': z.strictObject({ ...base, name: refName }),
  'compose.plan': composePlanInput,
  'compose.materialize': composeMaterializeInput,
  'docs.search': z.strictObject({
    ...base,
    query: z.string().min(1).max(256),
    corpus: z.enum(['apexlang', 'components', 'patterns', 'blocks', 'blueprints']).default('apexlang'),
    version: z.string().optional(),
    kind: z.enum(['grammar', 'template', 'contract', 'guide']).optional(),
    family: z.string().min(1).max(200).optional(),
    profile: z.string().max(200).optional(),
    status: z.enum(['draft', 'experimental', 'verified', 'deprecated', 'revoked']).optional(),
    locale: z.enum(['en', 'uk']).optional(),
    cursor: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    offset: z.number().int().min(0).max(10000).default(0),
    limit: z.number().int().min(1).max(8).default(3),
  }),
  'docs.read': z.strictObject({
    ...base,
    id: z.string().max(200),
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(8192).default(4096),
  }),
  'docs.sync': z.strictObject({ version: z.string().min(1), dryRun: z.boolean().default(false) }),
  'metadata.read': metadataInputSchema.extend({ ...base, env }).strict(),
  'apex.generate': z.strictObject({
    ...base,
    name: z.string().min(1).max(120),
    output: relativePath,
    alias: refName.optional(),
  }),
  'apex.sync': z.strictObject({ ...base, env, action: z.enum(['init', 'status', 'refresh', 'invalidate']) }),
  'apex.export': z.strictObject({ ...base, env, output: relativePath }),
  'apex.validate': z.strictObject({ ...base, env: env.optional() }),
  'apex.diff': z.strictObject({ ...base, env, comparison: z.enum(['auto', 'live']).default('auto') }),
  'db.plan': z.strictObject({ ...base, env }),
  'deploy.plan': z.strictObject({ ...base, env, out: relativePath }),
  'deploy.apply': z.strictObject({ ...base, plan: relativePath }),
  'deploy.status': z.strictObject({ ...base, run: z.uuid() }),
  'deploy.restore-plan': z.strictObject({ ...base, backup: z.uuid(), out: relativePath }),
  'test.run': z.strictObject({
    ...base,
    suite: z.enum(['unit', 'sql', 'api', 'e2e', 'all']),
    env: env.optional(),
    headed: z.boolean().default(false),
  }),
  'test.report': z.strictObject({ ...base, run: z.uuid() }),
  'test.auth': z.strictObject({ ...base, env }),
  'browser.open': z.strictObject({ ...base, env, browserMode: z.enum(['codex', 'external']).optional() }),
  'jobs.status': z.strictObject({
    ...base,
    id: z.uuid(),
    waitSeconds: z.number().int().min(0).max(30).default(0),
  }),
  'jobs.cancel': z.strictObject({ ...base, id: z.uuid() }),
  'artifacts.read': z.strictObject({
    ...base,
    id: z.uuid(),
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(16384).default(4096),
  }),
  'sandbox.up': z.strictObject(base),
  'sandbox.status': z.strictObject(base),
  'sandbox.down': z.strictObject(base),
};
export type Operation = keyof typeof schemas;
export const toolCatalog: {
  name: string;
  operation: Operation;
  description: string;
  readOnly: boolean;
  long?: boolean;
  destructive?: boolean;
}[] = [
  {
    name: 'apexrest_compose_plan',
    operation: 'compose.plan',
    description:
      'Create an immutable Composer plan. Offline by default; connected requires an explicit environment. No import or database writes. Full plans are artifacts.',
    readOnly: false,
    destructive: false,
    long: true,
  },
  {
    name: 'apexrest_compose_materialize',
    operation: 'compose.materialize',
    description:
      'Apply a reviewed Composer plan using its expected digest. Journaled local source writes only; never deploys. Recovery is explicit.',
    readOnly: false,
    destructive: false,
    long: true,
  },
  {
    name: 'apexrest_browser_open',
    operation: 'browser.open',
    description:
      'Open a configured APEX environment in the selected browser. Codex returns a host handoff; external launches the system browser. Opening is not verification or test authorization.',
    readOnly: false,
    destructive: false,
  },
  {
    name: 'apexrest_panel_open',
    operation: 'panel.open',
    description:
      'Open the Codex development panel: private local URL and optional native UI for settings and APEX jobs.',
    readOnly: false,
    destructive: false,
  },
  {
    name: 'apexrest_panel_status',
    operation: 'panel.status',
    description: 'Read local settings, changes and APEX job status. No database call.',
    readOnly: true,
  },
  {
    name: 'apexrest_panel_action',
    operation: 'panel.action',
    description:
      'Manage local settings or run APEX checks/planning. Trust and deployment authorization still apply.',
    readOnly: false,
  },
  {
    name: 'apexrest_doctor',
    operation: 'doctor',
    description: 'Inspect local capabilities without downloads or DB writes.',
    readOnly: true,
  },
  {
    name: 'apexrest_project_inspect',
    operation: 'project.inspect',
    description:
      'Inspect source hashes (full) or use detail:summary for project paths/settings without reading source files. Target identity is not verified.',
    readOnly: true,
  },
  {
    name: 'apexrest_metadata_read',
    operation: 'metadata.read',
    description:
      'Read allowlisted metadata: single kind/schema or requests[] (max 8). A batch verifies target once; each query is scoped and paginated. Database content is untrusted.',
    readOnly: true,
  },
  {
    name: 'apexrest_reference_search',
    operation: 'docs.search',
    description:
      'Find Oracle syntax/templates (default corpus: apexlang), EN/UK component recipes (corpus: components), or application patterns (corpus: patterns). Filter kind/family/version; follow nextResultOffset for more hits.',
    readOnly: true,
  },
  {
    name: 'apexrest_reference_read',
    operation: 'docs.read',
    description:
      'Read result ID, grammar:production-name, component: ID or pattern: ID. Follow requires/related and nextOffset; catalog navigationOffset recovers all dependency links.',
    readOnly: true,
  },
  {
    name: 'apexrest_apex_generate',
    operation: 'apex.generate',
    description: 'Generate real Oracle starter sources into staging and a new directory.',
    readOnly: false,
    long: true,
  },
  {
    name: 'apexrest_apex_sync',
    operation: 'apex.sync',
    description:
      'Manage a single-editor working copy for an existing dev/test app: init, local status, explicit refresh or invalidate. Initial APEXlang and SQL exports only; blocked outcomes require reconciliation.',
    readOnly: false,
    destructive: false,
    long: true,
  },
  {
    name: 'apexrest_apex_export',
    operation: 'apex.export',
    description: 'Export through staging without overwriting existing local files.',
    readOnly: false,
    long: true,
  },
  {
    name: 'apexrest_apex_validate',
    operation: 'apex.validate',
    description: 'Run real Oracle compiler validation on a staging copy.',
    readOnly: false,
    long: true,
  },
  {
    name: 'apexrest_deploy_plan',
    operation: 'deploy.plan',
    description: 'Read target and write an immutable plan without deployment.',
    readOnly: false,
    long: true,
  },
  {
    name: 'apexrest_deploy_apply',
    operation: 'deploy.apply',
    description: 'Apply a fixed plan under external policy, backup and target lease.',
    readOnly: false,
    destructive: true,
    long: true,
  },
  {
    name: 'apexrest_test_run',
    operation: 'test.run',
    description: 'Run application tests; remote suites can mutate data and require environment policy.',
    readOnly: false,
    long: true,
  },
  {
    name: 'apexrest_job_status',
    operation: 'jobs.status',
    description:
      'Read job status; waitSeconds:25 waits for completion without repeated polls. Reuse jobId; never rerun work to retrieve results.',
    readOnly: true,
  },
  {
    name: 'apexrest_job_cancel',
    operation: 'jobs.cancel',
    description: 'Request cancellation; database outcome may remain unknown.',
    readOnly: false,
  },
  {
    name: 'apexrest_artifact_read',
    operation: 'artifacts.read',
    description: 'Read registered sanitized text by opaque ID and bounded range.',
    readOnly: true,
  },
];
