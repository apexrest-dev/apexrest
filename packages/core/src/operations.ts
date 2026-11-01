import { z } from 'zod';
import { browserModeSchema } from './browser-preferences.ts';
import { JOB_WAIT_MAX_SECONDS } from './jobs.ts';
import { composePlanInput, composeMaterializeInput } from './composer/service.ts';
import { metadataInputSchema } from './metadata.ts';
import { refName, relativePath } from './config.ts';
import { savedConnectionName, ordsUrl, ordsUsername } from './connections.ts';
import { sqlclMode, sqlclRestriction, databaseTransport } from './sqlcl-config.ts';
const project = z.string().min(1).max(4096).optional(),
  env = refName;
const base = { project };
const selectedImportPath = relativePath.refine(
  (file) =>
    !/[\\*?\[\]]/.test(file) &&
    !/^[A-Za-z]:/.test(file) &&
    !file.startsWith('-') &&
    file.split('/').every((part) => part !== '' && part !== '.'),
  'Use normalized application-relative paths without globs or command flags',
);
const importOptions = {
  importMode: z.enum(['auto', 'full', 'files', 'none']).default('auto'),
  files: z
    .array(selectedImportPath)
    .min(1)
    .max(1000)
    .optional()
    .describe('files mode: explicit file paths relative to the application source directory'),
};
function checkImportOptions(
  value: { importMode: string; files?: string[] | undefined },
  ctx: z.RefinementCtx,
) {
  if ((value.importMode === 'files') !== (value.files !== undefined))
    ctx.addIssue({
      code: 'custom',
      path: ['files'],
      message: 'Supply files only with importMode files; files mode requires a nonempty list.',
    });
  if (
    value.files &&
    new Set(value.files.map((file) => file.replaceAll('\\', '/').replace(/^\.\//, ''))).size !==
      value.files.length
  )
    ctx.addIssue({ code: 'custom', path: ['files'], message: 'Selected file paths must be unique.' });
}
const dependencies = {
  home: z.string().optional(),
  yes: z.boolean().default(false),
  nonInteractive: z.boolean().default(false),
  offline: z.boolean().default(false),
  cacheDir: z.string().optional(),
  dryRun: z.boolean().default(false),
  acceptOracleLicense: z.boolean().default(false),
};
const previewSource = {
  ...base,
  sourceDir: z
    .string()
    .min(1)
    .max(4096)
    .optional()
    .describe('APEXlang folder with application.apx; defaults to apexrest.json application.sourceDir'),
};
const previewRun = {
  assetsDir: z.string().min(1).max(4096).optional(),
  env: env
    .optional()
    .describe(
      'DEV/QA/TEST environment of apexrest.json: application data and PL/SQL run in its Oracle database through the SQLcl saved connection; every request is rolled back',
    ),
  sampleRows: z
    .number()
    .int()
    .min(0)
    .max(200)
    .optional()
    .describe('Sample rows for auto-created missing tables'),
};
const setup = {
  ...base,
  ...dependencies,
  from: z.string().optional(),
  codexHome: z.string().optional(),
  codex: z.string().min(1).optional(),
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
  'panel.status': z.strictObject(base),
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
    codex: z.string().min(1).optional(),
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
      envFile: z.string().min(1).max(4096).optional(),
      usernameKey: z
        .string()
        .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
        .optional(),
      passwordKey: z
        .string()
        .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
        .optional(),
      urlKey: z
        .string()
        .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
        .optional(),
    })
    .refine(
      (value) => !!value.sqlclName || !!value.envFile || !!(value.ordsUrl && value.ordsUsername),
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
    include: z.enum(['code', 'metadata']).optional().describe('search: code on all hits or none'),
    includeUnresolved: z.boolean().default(false),
    cursor: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    offset: z.number().int().min(0).max(10000).default(0),
    limit: z.number().int().min(1).max(8).default(3),
  }),
  'docs.select': z.strictObject({
    ...base,
    request: z.string().trim().min(1).max(4000),
    version: z
      .string()
      .regex(/^26\.[12](?:@[A-Za-z0-9_.-]+)?$/)
      .optional(),
    limit: z.number().int().min(1).max(8).default(6),
  }),
  'docs.read': z.strictObject({
    ...base,
    id: z.string().max(200),
    version: z.string().optional(),
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
  'apex.sync': z.strictObject({
    ...base,
    debugTimings: z.boolean().optional(),
    env,
    action: z.enum(['init', 'status', 'refresh', 'invalidate']),
  }),
  'apex.export': z.strictObject({ ...base, env, output: relativePath }),
  'apex.validate': z.strictObject({ ...base, debugTimings: z.boolean().optional(), env: env.optional() }),
  'apex.diff': z.strictObject({ ...base, env, comparison: z.enum(['auto', 'live']).default('auto') }),
  'db.plan': z.strictObject({ ...base, env }),
  'deploy.plan': z
    .strictObject({ ...base, env, out: relativePath, ...importOptions })
    .superRefine(checkImportOptions),
  'deploy.apply': z.strictObject({ ...base, plan: relativePath }),
  'deploy.status': z.strictObject({ ...base, run: z.uuid() }),
  'deploy.restore-plan': z.strictObject({ ...base, backup: z.uuid(), out: relativePath }),
  'browser.open': z.strictObject({
    ...base,
    env,
    browserMode: browserModeSchema.optional(),
  }),
  'jobs.status': z.strictObject({
    ...base,
    id: z.uuid(),
    waitSeconds: z.number().int().min(0).max(JOB_WAIT_MAX_SECONDS).default(0),
  }),
  'jobs.cancel': z.strictObject({ ...base, id: z.uuid() }),
  'artifacts.read': z.strictObject({
    ...base,
    id: z.uuid(),
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(16384).default(4096),
  }),
  'preview.setup': z.strictObject({
    zip: z
      .string()
      .min(1)
      .max(4096)
      .optional()
      .describe('Local apex_26.2 zip; otherwise it is downloaded once'),
    assetsDir: z.string().min(1).max(4096).optional(),
    sha256: z
      .string()
      .regex(/^[a-fA-F0-9]{64}$/)
      .optional(),
  }),
  'preview.start': z.strictObject({
    ...previewSource,
    ...previewRun,
    port: z.number().int().min(0).max(65535).optional(),
    reset: z.boolean().default(false),
    user: z.string().min(1).max(128).optional(),
    toolbar: z.boolean().optional(),
  }),
  'preview.check': z.strictObject({
    ...previewSource,
    ...previewRun,
    pages: z.array(z.string().min(1).max(255)).min(1).max(500).optional(),
  }),
  'preview.stop': z.strictObject({ ...previewSource, all: z.boolean().default(false) }),
  'preview.status': z.strictObject({}),
  'sandbox.up': z.strictObject(base),
  'sandbox.status': z.strictObject(base),
  'sandbox.down': z.strictObject(base),
  // Composite MCP operations. Each routes to the operations above so the CLI
  // keeps its granular commands while the agent sees one tool per concern.
  project: z.strictObject({
    debugTimings: z.boolean().optional(),
    ...base,
    action: z.enum(['init', 'adopt', 'inspect', 'connection_add', 'connection_list', 'connection_test']),
    directory: z.string().min(1).optional().describe('init: new or empty directory for the project'),
    template: z.enum(['blank-app', 'customer-crm', 'existing-app']).optional(),
    alias: refName.optional(),
    env: env.optional(),
    appId: z.number().int().positive().optional(),
    workingCopy: z.boolean().optional(),
    detail: z.enum(['full', 'summary']).default('summary'),
    name: refName.optional().describe('connection reference name'),
    sqlclName: savedConnectionName.optional(),
    ordsUrl: ordsUrl.optional(),
    ordsUsername: ordsUsername.optional(),
    passwordFile: z.string().min(1).max(4096).optional(),
    envFile: z.string().min(1).max(4096).optional(),
    usernameKey: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .optional(),
    passwordKey: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .optional(),
    urlKey: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .optional(),
    saved: z.boolean().default(false),
  }),
  reference: z.strictObject({
    ...base,
    mode: z.enum(['search', 'read', 'select']),
    request: z.string().trim().min(1).max(4000).optional().describe('select: public UI needs'),
    query: z.string().min(1).max(256).optional(),
    id: z.string().max(200).optional().describe('read: reference ID'),
    corpus: z.enum(['apexlang', 'components', 'patterns', 'blocks', 'blueprints']).default('apexlang'),
    version: z.string().optional(),
    kind: z.enum(['grammar', 'template', 'contract', 'guide']).optional(),
    family: z.string().min(1).max(200).optional(),
    profile: z.string().max(200).optional(),
    status: z.enum(['draft', 'experimental', 'verified', 'deprecated', 'revoked']).optional(),
    locale: z.enum(['en', 'uk']).optional(),
    include: z.enum(['code', 'metadata']).optional().describe('search: code on all hits or none'),
    includeUnresolved: z.boolean().default(false),
    cursor: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    offset: z.number().int().min(0).max(10000000).default(0),
    limit: z.number().int().min(1).max(8192).optional().describe('search/select: 1-8; read: chars'),
  }),
  ship: z
    .strictObject({
      ...base,
      debugTimings: z.boolean().optional(),
      env,
      mode: z.enum(['plan', 'apply', 'recover']).default('plan'),
      plan: relativePath.optional(),
      run: z.uuid().optional(),
      confirmation: z
        .strictObject({
          planDigest: z.string().regex(/^[a-f0-9]{64}$/),
          userRequest: z.string().min(1).max(2000),
        })
        .optional(),
      ...importOptions,
      userRequest: z
        .string()
        .min(10)
        .max(2000)
        .describe(
          "The user's literal instruction that authorizes this change (recorded with the deploy grant)",
        ),
    })
    .superRefine(checkImportOptions)
    .superRefine((value, ctx) => {
      // Fields are bound to their mode so a malformed call fails before a worker or plan exists.
      if (value.mode === 'recover' && !value.run)
        ctx.addIssue({
          code: 'custom',
          path: ['run'],
          message: 'mode recover requires the interrupted run UUID.',
        });
      if (value.mode !== 'recover' && value.run)
        ctx.addIssue({ code: 'custom', path: ['run'], message: 'run applies to mode recover only.' });
      if (value.mode !== 'apply' && (value.plan || value.confirmation))
        ctx.addIssue({
          code: 'custom',
          path: [value.plan ? 'plan' : 'confirmation'],
          message: 'plan and confirmation apply to mode apply only.',
        });
    }),
  // Internal: the detached worker's apply phase for apexrest_ship.
  'ship.apply': z.strictObject({
    ...base,
    env,
    plan: relativePath,
    confirmation: z
      .strictObject({
        planDigest: z.string().regex(/^[a-f0-9]{64}$/),
        userRequest: z.string().min(1).max(2000),
      })
      .optional(),
    userRequest: z.string().min(10).max(2000),
  }),
  'peer.status': z.strictObject(base),
  'peer.review': z.strictObject({
    ...base,
    plan: relativePath.optional().describe('Saved plan path from apexrest_ship mode:plan'),
    vendor: z.enum(['codex', 'claude']).optional(),
    focus: z.string().min(1).max(2000).optional(),
  }),
  peer: z.strictObject({
    ...base,
    action: z.enum(['status', 'review']).default('review'),
    plan: relativePath.optional().describe('review: saved plan path; omit for local sources'),
    vendor: z.enum(['codex', 'claude']).optional().describe('codex from Claude Code, claude from Codex'),
    focus: z.string().min(1).max(2000).optional(),
  }),
  job: z.strictObject({
    ...base,
    action: z.enum(['status', 'cancel']).default('status'),
    jobId: z.uuid(),
    waitSeconds: z.number().int().min(0).max(JOB_WAIT_MAX_SECONDS).default(0),
  }),
  status: z.strictObject({ ...base, detail: z.enum(['doctor', 'project']).default('project') }),
  preview: z.strictObject({
    project,
    action: z.enum(['setup', 'start', 'check', 'stop', 'status']),
    sourceDir: z.string().min(1).max(4096).optional(),
    env: env.optional(),
    zip: z.string().min(1).max(4096).optional(),
    port: z.number().int().min(0).max(65535).optional(),
    reset: z.boolean().optional(),
    pages: z.array(z.string().min(1).max(255)).min(1).max(500).optional(),
  }),
};
export type Operation = keyof typeof schemas;
/** Operations reachable only through the MCP catalog or the job worker; the CLI keeps granular commands. */
export const internalOperations: Operation[] = [
  'project',
  'reference',
  'ship.apply',
  'job',
  'preview',
  'peer',
];
export const toolCatalog: {
  name: string;
  operation: Operation;
  description: string;
  readOnly: boolean;
  /** Runs as a job: in-process unless `worker` says detached. */
  long?: boolean;
  worker?: boolean;
  destructive?: boolean;
  /** May reach the database, a browser or the network. */
  openWorld?: boolean;
}[] = [
  {
    name: 'apexrest_project',
    operation: 'project',
    description:
      'App init/adopt/inspect and connection add/list/test. Credentials via private passwordFile/envFile; never in tool text.',
    readOnly: false,
    destructive: false,
    openWorld: true,
  },
  {
    name: 'apexrest_reference',
    operation: 'reference',
    description:
      'Local references; select components with optional OpenAI Decisions. project required for select. Host writes APEXlang.',
    readOnly: true,
    openWorld: true,
  },
  {
    name: 'apexrest_metadata_read',
    operation: 'metadata.read',
    description:
      'Scoped paginated metadata: kind/schema or requests[] (max 8). Target verified; content untrusted.',
    readOnly: true,
    openWorld: true,
  },
  {
    name: 'apexrest_apex_validate',
    operation: 'apex.validate',
    description:
      'Compile staged sources with Oracle; return located diagnostics and separate CodeScan/upgrade advice. No database call.',
    readOnly: true,
  },
  {
    name: 'apexrest_ship',
    operation: 'ship',
    description:
      'Plan, apply or recover on DEV/QA/TEST with backup/drift/identity checks. importMode:auto selects eligible files or explains full import; full forces whole app; files uses explicit paths. Apply binds and revokes the userRequest grant. No production; plan never writes Oracle.',
    readOnly: false,
    destructive: true,
    long: true,
    worker: true,
    openWorld: true,
  },
  {
    name: 'apexrest_apex_sync',
    operation: 'apex.sync',
    description:
      'Single-editor dev/test working copy: init, local status, explicit refresh/invalidate. Reconcile blocked outcomes.',
    readOnly: false,
    destructive: false,
    long: true,
    openWorld: true,
  },
  {
    name: 'apexrest_browser_open',
    operation: 'browser.open',
    description:
      'Return the configured APEX URL for the host in-app browser (codex/host). Inspect affected pages with host browser controls; opening is not verification.',
    readOnly: false,
    destructive: false,
    openWorld: true,
  },
  {
    name: 'apexrest_preview',
    operation: 'preview',
    description:
      'APEXlang preview (UT 26.2): SQLite, or env (DEV/QA/TEST) for rolled-back Oracle data/PL/SQL. setup; start: URLs; check: gaps. Not evidence.',
    readOnly: false,
    destructive: false,
    openWorld: true,
  },
  {
    name: 'apexrest_peer_review',
    operation: 'peer',
    description:
      'Other-vendor CLI (codex or claude) reviews a saved ship plan or, without plan, local sources, read-only; plan verdict gates required apply. status: CLI/sign-in. Never deploys.',
    readOnly: false,
    destructive: false,
    long: true,
    openWorld: true,
  },
  {
    name: 'apexrest_job',
    operation: 'job',
    description:
      'status: read a job (waitSeconds up to 120 waits for completion; phase shows progress). cancel: request cancellation; the database outcome may remain unknown. Reuse the jobId; never rerun work to fetch results.',
    readOnly: false,
    destructive: true,
  },
  {
    name: 'apexrest_artifact_read',
    operation: 'artifacts.read',
    description: 'Read registered sanitized text by opaque ID and bounded range.',
    readOnly: true,
  },
  {
    name: 'apexrest_status',
    operation: 'status',
    description:
      'doctor inspects tools without downloads; project reads settings, connections, sync, jobs, deployments and grants. No database call.',
    readOnly: true,
  },
];
