import path from 'node:path';
import { canonical, exists, hash, inventory, readJson } from '../../core/src/fs.ts';
import { runCommand } from './command.ts';
import { Fault } from '../../core/src/result.ts';
import { nativeMarketplace, resolveNativePlugin, validateNative } from './package-source.ts';

export interface Marketplace {
  name: string;
  root: string;
  marketplaceSource?: { sourceType: string; source: string };
}
export type CodexInvoke = (args: string[]) => Promise<unknown>;
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

export async function inspectRegistration(
  markets: Marketplace[],
  home: string,
  codexHome: string,
  destination: string,
) {
  const entries = markets.filter((m) => m.name === 'apexrest');
  const conflict = (reason: string): never => {
    throw new Fault(
      'MARKETPLACE_OWNERSHIP_CONFLICT',
      `Cannot update the apexrest marketplace at ${entries[0]?.root ?? '(unknown)'} in ${codexHome}: ${reason} It was left unchanged. Select another Codex profile directory in Advanced options, or review this registration in Codex.`,
      5,
      'conflict',
    );
  };
  if (entries.length > 1) conflict('more than one registration was found.');
  const existing = entries[0];
  if (!existing) return { action: 'install' as const, fingerprint: hash(canonical(markets)), markets };
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
    fingerprint: hash(canonical({ markets, files: files! })),
    markets,
  };
}
