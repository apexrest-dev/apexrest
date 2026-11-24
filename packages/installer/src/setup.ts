import { VERSION } from '../../core/src/version.ts';
import path from 'node:path';
import { homedir } from 'node:os';
import { rm } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { exists, writeJson, containedChild, withLock } from '../../core/src/fs.ts';
import { managedHome } from '../../core/src/config.ts';
import { toolCatalog } from '../../core/src/operations.ts';
import { Fault } from '../../core/src/result.ts';
import { codexRun, codexInvoke, listMarketplaces } from './registration.ts';
import { installNative, installationState } from './native.ts';
import { resolveNativePlugin, validateNative } from './package-source.ts';
export { validateNative } from './package-source.ts';
import { ToolchainService, canonicalHome, runtimeState } from './toolchain.ts';
import type { SetupRequest } from './toolchain.ts';

async function checkMcpRuntime(root: string, node: string, home: string, version: string) {
  const client = new Client({ name: 'apexrest-installer', version: VERSION });
  const transport = new StdioClientTransport({
    command: node,
    args: [path.join(root, 'runtime/mcp.mjs')],
    cwd: root,
    env: { APEXREST_HOME: home },
    stderr: 'ignore',
  });
  try {
    const options = { timeout: 20000 };
    await client.connect(transport, options);
    const server = client.getServerVersion();
    const { tools, nextCursor } = await client.listTools({}, options);
    const names = new Set(tools.map((tool) => tool.name));
    // Other package versions can ship a different inventory. They must still
    // publish the shared action tools and identify the exact requested package.
    const expected =
      version === VERSION
        ? toolCatalog.map((tool) => tool.name)
        : ['apexrest_status', 'apexrest_project', 'apexrest_ship'];
    if (
      server?.name !== 'apexrest-apex' ||
      server.version !== version ||
      nextCursor ||
      names.size !== tools.length ||
      (version === VERSION && names.size !== expected.length) ||
      expected.some((name) => !names.has(name))
    )
      throw new Fault(
        'MCP_CATALOG_MISMATCH',
        'The candidate did not identify itself or advertise the expected APEXREST tools. Existing registration was left unchanged.',
        3,
        'blocked',
      );
  } catch (error) {
    if (error instanceof Fault) throw error;
    throw new Fault(
      'MCP_STARTUP_FAILED',
      'The candidate did not complete MCP startup. Existing registration was left unchanged.',
      3,
      'blocked',
    );
  } finally {
    await client.close().catch(() => {});
  }
}

export async function setup(input: Record<string, unknown>) {
  const text = (key: string) => input[key] as string | undefined;
  // Canonicalize once; toolchain records, the native install and APEXREST_HOME then agree.
  const home = await canonicalHome(
    text('home') ??
      (input.scope === 'project'
        ? path.join(text('project') ?? process.cwd(), '.apexrest/managed')
        : managedHome()),
  );
  if (input.scope === 'project') {
    throw new Fault(
      'PROJECT_HOST_SCOPE_UNAVAILABLE',
      'Codex 0.154.0 plugin add enables in the selected user profile. Use --scope user with a dedicated --codex-home until project-only enablement is verified.',
      3,
      'blocked',
    );
  }
  const source = await resolveNativePlugin(text('from'));
  const validation = await validateNative(source);
  if (text('version') && text('version') !== validation.version)
    throw new Fault(
      'VERSION_MISMATCH',
      'Requested version does not match the supplied immutable package.',
      2,
    );
  const codexHome = await canonicalHome(
    text('codexHome') ?? process.env.CODEX_HOME ?? path.join(homedir(), '.codex'),
  );
  const codex = text('codex');
  const request: SetupRequest = {
    home,
    ...(text('cacheDir') ? { cacheDir: text('cacheDir')! } : {}),
    offline: Boolean(input.offline),
    dryRun: Boolean(input.dryRun),
    yes: Boolean(input.yes),
    nonInteractive: Boolean(input.nonInteractive),
    acceptOracleLicense: Boolean(input.acceptOracleLicense),
    // The project's toolchain lock selects SQLcl; without --project the current folder's project, else the baseline.
    ...(text('project') ? { project: text('project')! } : {}),
  };
  const existingRuntime = await runtimeState(home);
  const nativePlan = await installNative({
    source,
    home,
    codexHome,
    ...(codex ? { codex } : {}),
    dryRun: true,
    node: existingRuntime.node ?? process.execPath,
  });
  if (input.dryRun)
    return {
      status: 'planned',
      package: validation,
      toolchain: input.nativeOnly
        ? { status: 'not-requested', components: {} }
        : await new ToolchainService().plan(request),
      native: nativePlan,
    };
  if (!input.yes)
    throw new Fault(
      'SETUP_APPROVAL_REQUIRED',
      'Use --dry-run to review, then --yes for technical installation steps.',
      4,
      'needs-user-action',
    );
  const toolchain = input.nativeOnly
    ? { status: 'not-requested', components: {} }
    : await new ToolchainService().apply(request);
  const runtime = await runtimeState(home);
  const native = await installNative({
    source,
    home,
    codexHome,
    ...(codex ? { codex } : {}),
    node: runtime.node ?? process.execPath,
    expectedRegistration: nativePlan.registration.fingerprint,
    checkRuntime: (root, node, home) => checkMcpRuntime(root, node, home, validation.version),
  });
  if (!('root' in native)) throw new Fault('INSTALL_NOT_COMPLETED', 'Native install remained a plan.', 3);
  const result = {
    schemaVersion: 1,
    status: 'needs-user-action',
    components: {
      ...('components' in toolchain ? toolchain.components : {}),
      nativePlugin: 'registered',
      mcp: 'verified',
      database: 'not-configured',
    },
    actions: [{ code: 'CODEX_RELOAD_REQUIRED' }, { code: 'DATABASE_CONNECTION_REQUIRED' }],
    native,
    toolchain,
  };
  await writeJson(path.join(home, 'setup-result.json'), result);
  return result;
}
const ownedDestination = (home: string, destination: unknown) => {
  // Only a content-addressed child of <home>/native may be removed; never home or native itself.
  if (
    typeof destination !== 'string' ||
    !path.isAbsolute(destination) ||
    path.dirname(destination) !== path.join(home, 'native') ||
    !/^[a-f0-9]{64}$/.test(path.basename(destination))
  )
    throw new Fault(
      'MARKETPLACE_OWNERSHIP_CONFLICT',
      'The installation record does not name a managed native payload under this home; nothing was removed.',
      5,
      'conflict',
    );
  return destination;
};
export async function uninstallNative(
  homeInput: string,
  keepRuntime: boolean,
  options: { codex?: string } = {},
) {
  const home = await canonicalHome(homeInput);
  return withLock(path.join(home, 'install.lock'), async () => {
    const state = (await installationState(home)) as { codexHome?: unknown; destination?: unknown };
    if (typeof state.codexHome !== 'string' || !path.isAbsolute(state.codexHome))
      throw new Fault('INSTALLATION_RECORD_INVALID', 'The installation record has no Codex profile.', 5);
    const codexHome = state.codexHome;
    const destination = ownedDestination(home, state.destination);
    const run = codexRun(codexHome, home, options.codex);
    // Invalid or partial Codex output is outcome-unknown: nothing is removed.
    const markets = await listMarketplaces(codexInvoke(codexHome, home, options.codex));
    if (!markets.some((m) => m.name === 'apexrest' && m.root === destination))
      throw new Fault(
        'MARKETPLACE_OWNERSHIP_CONFLICT',
        'Current marketplace no longer belongs to this installation; nothing was removed.',
        5,
      );
    const result = await run(['plugin', 'remove', 'apexrest-apex@apexrest'], 30000);
    if (result.code !== 0) throw new Fault('UNINSTALL_FAILED', result.stderr, 3);
    const removal = await run(['plugin', 'marketplace', 'remove', 'apexrest'], 30000);
    if (removal.code !== 0) throw new Fault('MARKETPLACE_REMOVE_FAILED', removal.stderr, 3);
    const listing = await run(['plugin', 'list', '--json'], 30000);
    if (listing.code !== 0 || listing.stdout.includes('apexrest-apex@apexrest'))
      throw new Fault('UNINSTALL_UNCONFIRMED', 'Codex still lists this plugin.', 3);
    if (!keepRuntime && (await exists(destination)))
      await rm(await containedChild(path.join(home, 'native'), destination), {
        recursive: true,
        force: true,
      });
    await writeJson(path.join(home, 'uninstalled.json'), {
      at: new Date().toISOString(),
      keepRuntime,
      sharedRuntimePreserved: true,
    });
    return {
      status: 'uninstalled',
      projectsPreserved: true,
      backupsPreserved: true,
      credentialsPreserved: true,
      sharedRuntimePreserved: true,
    };
  });
}
