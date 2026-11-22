import path from 'node:path';
import { canonical, exists, hash, inventory, readJson } from '../../core/src/fs.ts';
import { runCommand } from './command.ts';
import { Fault } from '../../core/src/result.ts';
import { nativeMarketplace, resolveNativePlugin, validateNative } from './package-source.ts';
import { snapshotForeignConfig, type ForeignConfigSnapshot } from './registration-config.ts';

export interface Marketplace {
  name: string;
  root: string;
  marketplaceSource?: { sourceType: string; source: string };
}
export type CodexInvoke = (args: string[]) => Promise<unknown>;
export type RegistrationDiscovery =
  | { scope: 'complete'; markets: Marketplace[] }
  | { scope: 'apexrest'; market: Marketplace; config: ForeignConfigSnapshot }
  | { scope: 'apexrest-removed'; config: ForeignConfigSnapshot; removal: 'confirmed-apexrest-removal' };
export interface RegistrationInspection {
  action: 'install' | 'update' | 'adopt';
  fingerprint: string;
  discovery: RegistrationDiscovery;
  markets?: Marketplace[];
  previousRoot?: string;
  previousVersion?: string;
}

export const apexrestMarketplace = (state: RegistrationDiscovery) =>
  state.scope === 'complete'
    ? state.markets.find((m) => m.name === 'apexrest')
    : state.scope === 'apexrest'
      ? state.market
      : undefined;

export function foreignRegistrationsUnchanged(a: RegistrationDiscovery, b: RegistrationDiscovery) {
  if (a.scope === 'complete' && b.scope === 'complete')
    return (
      canonical(a.markets.filter((m) => m.name !== 'apexrest')) ===
      canonical(b.markets.filter((m) => m.name !== 'apexrest'))
    );
  return (
    a.scope !== 'complete' &&
    b.scope !== 'complete' &&
    a.config.file === b.config.file &&
    a.config.foreignContentSha256 === b.config.foreignContentSha256 &&
    a.config.foreignRegistrySha256 === b.config.foreignRegistrySha256
  );
}
export async function checkCodex(codexHome: string, codex = 'codex') {
  const result = await runCommand({
    executable: codex,
    args: ['--version'],
    cwd: process.cwd(),
    env: { ...process.env, CODEX_HOME: codexHome },
    timeoutMs: 10000,
  });
  if (result.code !== 0 || result.timedOut || result.truncated || !/^codex-cli\s+\d+\./.test(result.stdout))
    throw new Fault(
      'DEPENDENCY_MISSING',
      'A working Codex CLI is required for plugin setup. Install Codex, then preview setup again.',
      3,
      'dependency_missing',
    );
}
/** Run Codex with this profile; .cmd shims on Windows are resolved via PATHEXT. */
export function codexRun(codexHome: string, cwd: string, codex = 'codex') {
  return (args: string[], timeoutMs = 60000) =>
    runCommand({
      executable: codex,
      args,
      cwd,
      env: { ...process.env, CODEX_HOME: codexHome },
      timeoutMs,
    });
}
export function codexInvoke(codexHome: string, cwd: string, codex = 'codex'): CodexInvoke {
  const run = codexRun(codexHome, cwd, codex);
  return async (args) => {
    const result = await run(args);
    if (result.timedOut || result.cancelled || result.truncated || result.code === null)
      throw new Fault(
        'CODEX_REGISTRATION_UNKNOWN',
        'Codex did not return a complete result. Inspect the registration before retrying.',
        6,
        'outcome_unknown',
      );
    if (result.code !== 0)
      throw new Fault('CODEX_REGISTRATION_FAILED', result.stderr || result.stdout, 3, 'blocked');
    try {
      return JSON.parse(result.stdout) as unknown;
    } catch {
      throw new Fault(
        'CODEX_REGISTRATION_UNKNOWN',
        'Codex returned an invalid registration response.',
        6,
        'outcome_unknown',
      );
    }
  };
}
export async function listMarketplaces(invoke: CodexInvoke): Promise<Marketplace[]> {
  const result = (await invoke(['plugin', 'marketplace', 'list', '--json'])) as {
    marketplaces?: Marketplace[];
  };
  if (
    !Array.isArray(result.marketplaces) ||
    result.marketplaces.some((m) => typeof m.name !== 'string' || typeof m.root !== 'string')
  )
    throw new Fault(
      'CODEX_REGISTRATION_UNKNOWN',
      'Codex returned an invalid marketplace listing.',
      6,
      'outcome_unknown',
    );
  return result.marketplaces;
}

/** A failed complete listing may fall back only to positive, independently bound APEXREST state. */
export async function discoverRegistration(
  invoke: CodexInvoke,
  codexHome: string,
): Promise<RegistrationDiscovery> {
  try {
    return { scope: 'complete', markets: await listMarketplaces(invoke) };
  } catch (error) {
    // Incomplete/invalid/unknown outcomes are not evidence for another discovery attempt.
    if (
      !(error instanceof Fault) ||
      error.code !== 'CODEX_REGISTRATION_FAILED' ||
      error.status === 'outcome_unknown'
    )
      throw error;
  }
  const config = await snapshotForeignConfig(codexHome);
  const configured = config.apexrest;
  if (!configured)
    throw new Fault(
      'CODEX_REGISTRATION_UNKNOWN',
      'Configured APEXREST source is missing.',
      6,
      'outcome_unknown',
    );
  const result = (await invoke(['plugin', 'list', '--marketplace', 'apexrest', '--available', '--json'])) as {
    installed?: unknown[];
    available?: unknown[];
  } | null;
  const invalid = (): never => {
    throw new Fault(
      'CODEX_REGISTRATION_UNKNOWN',
      'Codex did not positively identify the configured local APEXREST marketplace. Inspect the current profile and any saved transition before retrying.',
      6,
      'outcome_unknown',
    );
  };
  if (!result || !Array.isArray(result.installed) || !Array.isArray(result.available)) return invalid();
  const entries = [...result.installed!, ...result.available!];
  if (!entries.length) invalid();
  for (const raw of entries) {
    const entry = raw as {
      pluginId?: unknown;
      name?: unknown;
      marketplaceName?: unknown;
      source?: { source?: unknown; path?: unknown };
      marketplaceSource?: { sourceType?: unknown; source?: unknown };
    } | null;
    if (
      !entry ||
      entry.pluginId !== 'apexrest-apex@apexrest' ||
      entry.name !== 'apexrest-apex' ||
      entry.marketplaceName !== 'apexrest' ||
      entry.source?.source !== 'local' ||
      entry.marketplaceSource?.sourceType !== 'local' ||
      typeof entry.source.path !== 'string' ||
      typeof entry.marketplaceSource.source !== 'string' ||
      !path.isAbsolute(entry.source.path) ||
      !path.isAbsolute(entry.marketplaceSource.source) ||
      path.resolve(entry.marketplaceSource.source) !== path.resolve(configured.source) ||
      path.resolve(entry.source.path) !== path.join(path.resolve(configured.source), 'plugins/apexrest-apex')
    )
      invalid();
  }
  if ((await snapshotForeignConfig(codexHome)).wholeSha256 !== config.wholeSha256)
    throw new Fault(
      'MARKETPLACE_CHANGED',
      'Codex configuration changed during scoped discovery. Inspect the current profile and any saved transition before retrying.',
      5,
      'conflict',
    );
  return {
    scope: 'apexrest',
    market: {
      name: 'apexrest',
      root: path.resolve(configured.source),
      marketplaceSource: { sourceType: 'local', source: configured.source },
    },
    config,
  };
}

/** Transitional absence is proved independently, and only after this installer removed its target. */
export async function discoverAfterOwnedRemoval(
  invoke: CodexInvoke,
  codexHome: string,
  before: RegistrationDiscovery,
  response: unknown,
): Promise<RegistrationDiscovery> {
  if (
    before.scope !== 'apexrest' ||
    !response ||
    (response as { marketplaceName?: unknown }).marketplaceName !== 'apexrest'
  )
    throw new Fault(
      'CODEX_REGISTRATION_UNKNOWN',
      'The owned marketplace removal was not confirmed.',
      6,
      'outcome_unknown',
    );
  const config = await snapshotForeignConfig(codexHome, true);
  const removed: RegistrationDiscovery = {
    scope: 'apexrest-removed',
    config,
    removal: 'confirmed-apexrest-removal',
  };
  if (config.apexrest || !foreignRegistrationsUnchanged(before, removed))
    throw new Fault(
      'MARKETPLACE_CHANGED',
      'Configuration changed outside the confirmed APEXREST removal. Inspect the saved transition.',
      5,
      'conflict',
    );
  const listed = (await invoke(['plugin', 'list', '--marketplace', 'apexrest', '--available', '--json'])) as {
    installed?: unknown[];
    available?: unknown[];
  } | null;
  if (
    !listed ||
    !Array.isArray(listed.installed) ||
    !Array.isArray(listed.available) ||
    listed.installed.length ||
    listed.available.length ||
    (await snapshotForeignConfig(codexHome, true)).wholeSha256 !== config.wholeSha256
  )
    throw new Fault(
      'CODEX_REGISTRATION_UNKNOWN',
      'Removed APEXREST marketplace state could not be verified.',
      6,
      'outcome_unknown',
    );
  return removed;
}

export async function inspectRegistration(
  input: Marketplace[] | RegistrationDiscovery,
  home: string,
  codexHome: string,
  destination: string,
): Promise<RegistrationInspection> {
  const discovery: RegistrationDiscovery = Array.isArray(input)
    ? { scope: 'complete', markets: input }
    : input;
  if (discovery.scope === 'apexrest-removed')
    throw new Fault(
      'CODEX_REGISTRATION_UNKNOWN',
      'A transitional removal is not an installation preflight.',
      6,
      'outcome_unknown',
    );
  const entries =
    discovery.scope === 'complete'
      ? discovery.markets.filter((m) => m.name === 'apexrest')
      : [discovery.market];
  const context = discovery.scope === 'complete' ? { discovery, markets: discovery.markets } : { discovery };
  const identity = discovery.scope === 'complete' ? discovery.markets : discovery;
  const conflict = (reason: string): never => {
    throw new Fault(
      'MARKETPLACE_OWNERSHIP_CONFLICT',
      `Cannot verify the apexrest marketplace at ${entries[0]?.root ?? '(unknown)'} in ${codexHome}: ${reason} Inspect the current Codex registration and any saved transition before retrying.`,
      5,
      'conflict',
    );
  };
  if (entries.length > 1) conflict('more than one registration was found.');
  const existing = entries[0];
  if (!existing) return { action: 'install' as const, fingerprint: hash(canonical(identity)), ...context };
  let version: string, files: Record<string, string>;
  try {
    if (existing.marketplaceSource && existing.marketplaceSource.sourceType !== 'local')
      conflict('automatic migration supports a local APEXREST marketplace only.');
    const metadata = await readJson(path.join(existing.root, '.agents/plugins/marketplace.json'));
    if (canonical(metadata) !== canonical(nativeMarketplace))
      conflict('its metadata does not identify the dedicated APEXREST marketplace.');
    const plugin = await resolveNativePlugin(existing.root);
    if (path.relative(existing.root, plugin).split(path.sep).join('/') !== 'plugins/apexrest-apex')
      conflict('its plugin source is not the expected local bundle.');
    version = (await validateNative(plugin)).version;
    files = await inventory(plugin);
  } catch (error) {
    if (error instanceof Fault && error.code === 'MARKETPLACE_OWNERSHIP_CONFLICT') throw error;
    conflict('its APEXREST plugin bundle could not be validated.');
  }
  const receipt = path.join(home, 'installation.json');
  const previous = (await exists(receipt))
    ? ((await readJson(receipt)) as { destination?: string; codexHome?: string })
    : undefined;
  const managed =
    existing.root === destination ||
    (existing.root === previous?.destination && previous?.codexHome === codexHome);
  return {
    action: managed ? ('update' as const) : ('adopt' as const),
    previousRoot: existing.root,
    previousVersion: version!,
    fingerprint: hash(canonical({ markets: identity, files: files! })),
    ...context,
  };
}
