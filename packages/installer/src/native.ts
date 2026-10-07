import path from 'node:path';
import { cp, mkdir, readFile, rm, chmod } from 'node:fs/promises';
import {
  canonical,
  exists,
  hash,
  inventory,
  readJson,
  withLock,
  writeJson,
  atomicWrite,
  contained,
} from '../../core/src/fs.ts';
import { Fault } from '../../core/src/result.ts';
import { nativeMarketplace, resolveNativePlugin, validateNative } from './package-source.ts';
import { checkCodex, codexInvoke, inspectRegistration, listMarketplaces } from './registration.ts';
import { canonicalHome, renameWithRetry } from './toolchain.ts';
export interface NativeInstallRequest {
  source: string;
  home: string;
  codexHome: string;
  codex?: string;
  node?: string;
  dryRun?: boolean;
  expectedRegistration?: string;
}
interface ClaudeManifest {
  name: string;
  version: string;
  description?: string;
  author?: { name: string; url?: string };
  mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }>;
}
const claudeFile = '.claude-plugin/plugin.json';
/** Normalize only installer-owned launch bindings; metadata remains part of payload integrity. */
function normalizeClaude(manifest: ClaudeManifest) {
  const server = manifest.mcpServers?.apexrest;
  if (manifest.name !== 'apexrest' || !server || Object.keys(manifest.mcpServers).length !== 1)
    throw new Fault('INVALID_PACKAGE', 'Claude Code must expose the same apexrest MCP server.', 2);
  server.command = 'node';
  server.args = ['${CLAUDE_PLUGIN_ROOT}/runtime/mcp.mjs'];
  delete server.env;
  return manifest;
}
export async function installNative(r: NativeInstallRequest) {
  const source = await resolveNativePlugin(r.source);
  await validateNative(source);
  const payload = Object.fromEntries(
    Object.entries(await inventory(source)).map(([file, digest]) => [
      'plugins/apexrest-apex/' + file,
      digest,
    ]),
  );
  payload['.agents/plugins/marketplace.json'] = hash(JSON.stringify(nativeMarketplace, null, 2) + '\n');
  const claude = (await exists(path.join(source, claudeFile)))
    ? ((await readJson(path.join(source, claudeFile))) as ClaudeManifest)
    : undefined;
  const claudeMarketplace = claude
    ? {
        name: 'apexrest',
        owner: claude.author ?? { name: 'APEXREST' },
        metadata: { description: 'Oracle APEX development, deployment and testing', version: claude.version },
        plugins: [
          {
            name: claude.name,
            source: './plugins/apexrest-apex',
            description: claude.description,
            version: claude.version,
            category: 'productivity',
          },
        ],
      }
    : undefined;
  if (claudeMarketplace)
    payload['.claude-plugin/marketplace.json'] = hash(JSON.stringify(claudeMarketplace, null, 2) + '\n');
  const copyDigest = hash(canonical(payload));
  const sourceMcpFile = (await exists(path.join(source, 'plugin.json'))) ? 'mcp.json' : '.mcp.json';
  const mcpKey = 'plugins/apexrest-apex/' + sourceMcpFile;
  const claudeKey = 'plugins/apexrest-apex/' + claudeFile;
  // Both hosts share the managed Node/home. Only their launch bindings may differ from source.
  const expectedFiles = canonical({
    ...payload,
    [mcpKey]: undefined,
    ...(claude ? { [claudeKey]: undefined } : {}),
  });
  const expectedClaude = claude ? canonical(normalizeClaude(claude)) : undefined;
  const sourceMcp = (await readJson(path.join(source, sourceMcpFile))) as {
    mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }>;
  };
  const sourceServer = sourceMcp.mcpServers.apexrest;
  if (!sourceServer) throw new Fault('INVALID_PACKAGE', 'Native package has no apexrest MCP server.', 2);
  // A managed CLI can install itself again without embedding its previous home in
  // the package identity. Only the fields this installer owns are normalized.
  sourceServer.command = 'node';
  sourceServer.args = ['runtime/mcp.mjs'];
  delete sourceServer.env;
  payload[mcpKey] = hash(JSON.stringify(sourceMcp, null, 2) + '\n');
  if (claude) payload[claudeKey] = hash(JSON.stringify(claude, null, 2) + '\n');
  const digest = hash(canonical(payload));
  if (!r.dryRun) {
    await mkdir(r.home, { recursive: true, mode: 0o700 });
    await mkdir(r.codexHome, { recursive: true, mode: 0o700 });
  }
  const home = await canonicalHome(r.home);
  const codexHome = await canonicalHome(r.codexHome);
  const node = r.node ?? process.execPath;
  // Runtime bindings are part of the installation identity, so switching Node never
  // rewrites a plugin that is still registered from the previous installation.
  const destination = path.join(home, 'native', hash(canonical({ sourceDigest: digest, node, home })));
  const root = path.join(destination, 'plugins/apexrest-apex');
  const cli = path.join(root, 'runtime/apexrest.mjs');
  // Fail before any registration change if a launcher cannot represent these paths safely.
  const launchers = launcherScripts(home, node, cli);
  const invoke = codexInvoke(codexHome, (await exists(home)) ? home : process.cwd(), r.codex);
  if (!(await exists(codexHome))) await checkCodex(codexHome, r.codex);
  const inspect = async () =>
    inspectRegistration(
      (await exists(codexHome)) ? await listMarketplaces(invoke) : [],
      home,
      codexHome,
      destination,
    );
  let registration = await inspect();
  if (r.expectedRegistration && r.expectedRegistration !== registration.fingerprint)
    throw new Fault(
      'MARKETPLACE_CHANGED',
      'The Codex registration changed after setup preflight. Review setup again.',
      5,
      'conflict',
    );
  if (r.dryRun)
    return {
      state: 'planned',
      source,
      scope: 'apexrest-plugin-only',
      sourceDigest: digest,
      destination,
      node,
      codexHome,
      registration,
    };
  return withLock(path.join(home, 'install.lock'), async () => {
    await mkdir(codexHome, { recursive: true, mode: 0o700 });
    const config = path.join(codexHome, 'config.toml');
    const stamp = Date.now();
    const configBackup = path.join(home, 'config-before-install-' + stamp + '.toml');
    if (await exists(config)) await cp(config, configBackup);
    const repaired =
      (await exists(destination)) && !(await reusable(destination, expectedFiles, mcpKey, expectedClaude));
    if (repaired) {
      // A content-addressed directory that no longer matches its address is rebuilt, never reused.
      const broken = `${destination}.broken-${stamp}`;
      await renameWithRetry(destination, broken);
      await rm(broken, { recursive: true, force: true });
    }
    if (!(await exists(destination))) {
      const staging = destination + '.staging';
      await rm(staging, { recursive: true, force: true });
      await mkdir(staging, { recursive: true, mode: 0o700 });
      await mkdir(path.join(staging, 'plugins'), { recursive: true });
      await cp(source, path.join(staging, 'plugins/apexrest-apex'), { recursive: true });
      await writeJson(path.join(staging, '.agents/plugins/marketplace.json'), nativeMarketplace);
      if (claudeMarketplace)
        await writeJson(path.join(staging, '.claude-plugin/marketplace.json'), claudeMarketplace);
      if (hash(canonical(await inventory(staging))) !== copyDigest)
        throw new Fault('PACKAGE_COPY_INVALID', 'Native package copy changed.', 5);
      await renameWithRetry(staging, destination);
    }
    const portable = await exists(path.join(root, 'plugin.json'));
    const mcpPath = path.join(root, portable ? 'mcp.json' : '.mcp.json');
    const mcp = JSON.parse(await readFile(mcpPath, 'utf8')) as {
      mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }>;
    };
    const server = mcp.mcpServers.apexrest;
    if (!server) throw new Fault('INVALID_PACKAGE', 'Native package has no apexrest MCP server.', 2);
    server.command = node;
    server.args = [path.join(root, 'runtime/mcp.mjs')];
    server.env = { APEXREST_HOME: home };
    await writeJson(mcpPath, mcp);
    if (claude) {
      const installedClaude = normalizeClaude(
        (await readJson(path.join(root, claudeFile))) as ClaudeManifest,
      );
      installedClaude.mcpServers.apexrest!.command = node;
      installedClaude.mcpServers.apexrest!.env = { APEXREST_HOME: home };
      // Claude expands its cache root; do not bind it to Codex's installation directory.
      await writeJson(path.join(root, claudeFile), installedClaude);
    }
    // Repairing the payload that is itself the registered marketplace changes its file
    // fingerprint; the repaired, verified content becomes the baseline under the lock.
    if (repaired && registration.previousRoot === destination) registration = await inspect();
    const current = await inspect();
    if (current.fingerprint !== registration.fingerprint)
      throw new Fault(
        'MARKETPLACE_CHANGED',
        'The Codex registration changed during setup. Nothing was re-registered; review setup again.',
        5,
        'conflict',
      );
    const transition = path.join(home, 'registration-before-install-' + stamp + '.json');
    const previousListing = registration.previousRoot
      ? await invoke(['plugin', 'list', '--marketplace', 'apexrest', '--json'])
      : undefined;
    const previousPlugin = (
      previousListing as { installed?: { pluginId: string; enabled: boolean }[] } | undefined
    )?.installed?.find((plugin) => plugin.pluginId === 'apexrest-apex@apexrest');
    const record = { registration, destination, codexHome, configBackup, previousListing };
    await writeJson(transition, { status: 'prepared', ...record });
    let marketplace: unknown, installed: unknown, listing: unknown;
    const replacing = registration.previousRoot && registration.previousRoot !== destination;
    try {
      if (replacing) await invoke(['plugin', 'marketplace', 'remove', 'apexrest', '--json']);
      marketplace = await invoke(['plugin', 'marketplace', 'add', destination, '--json']);
      installed = await invoke(['plugin', 'add', 'apexrest-apex@apexrest', '--json']);
      const cached = (installed as { installedPath?: string }).installedPath;
      if (
        !cached ||
        canonical(await inventory(await contained(codexHome, cached))) !== canonical(await inventory(root))
      )
        throw new Fault('NATIVE_CACHE_MISMATCH', 'Codex did not install the reviewed plugin files.', 5);
      listing = await invoke(['plugin', 'list', '--marketplace', 'apexrest', '--json']);
      if (
        !(listing as { installed?: { pluginId: string; enabled: boolean }[] }).installed?.some(
          (plugin) => plugin.pluginId === 'apexrest-apex@apexrest' && plugin.enabled,
        )
      )
        throw new Fault(
          'NATIVE_PLUGIN_NOT_ENABLED',
          'Codex did not enable the installed APEXREST plugin.',
          3,
        );
      const after = await listMarketplaces(invoke);
      if (
        after.find((m) => m.name === 'apexrest')?.root !== destination ||
        canonical(after.filter((m) => m.name !== 'apexrest')) !==
          canonical(registration.markets.filter((m) => m.name !== 'apexrest'))
      )
        throw new Fault(
          'MARKETPLACE_CHANGED',
          'Codex registration verification failed. Inspect the saved registration record before retrying.',
          5,
          'conflict',
        );
      await writeJson(transition, { status: 'registered', ...record });
    } catch (error) {
      let recovery = 'needs-review';
      let unknown = error instanceof Fault && error.status === 'outcome_unknown';
      if (replacing && !(error instanceof Fault && error.status === 'outcome_unknown')) {
        try {
          const after = await listMarketplaces(invoke);
          const selected = after.find((m) => m.name === 'apexrest');
          if (
            canonical(after.filter((m) => m.name !== 'apexrest')) !==
              canonical(registration.markets.filter((m) => m.name !== 'apexrest')) ||
            (await inspectRegistration(registration.markets, home, codexHome, destination)).fingerprint !==
              registration.fingerprint
          )
            throw new Error('The prior registration or source changed externally.');
          if (selected && selected.root !== destination && selected.root !== registration.previousRoot)
            throw new Error('Registration changed externally.');
          if (selected?.root === destination)
            await invoke(['plugin', 'marketplace', 'remove', 'apexrest', '--json']);
          if (selected?.root !== registration.previousRoot)
            await invoke(['plugin', 'marketplace', 'add', registration.previousRoot!, '--json']);
          if (previousPlugin?.enabled) {
            const restored = (await invoke(['plugin', 'add', 'apexrest-apex@apexrest', '--json'])) as {
              installedPath?: string;
            };
            const previousRoot = await resolveNativePlugin(registration.previousRoot!);
            if (
              !restored.installedPath ||
              canonical(await inventory(await contained(codexHome, restored.installedPath))) !==
                canonical(await inventory(previousRoot))
            )
              throw new Error('The previous cached plugin could not be verified.');
          }
          if (
            (await listMarketplaces(invoke)).find((m) => m.name === 'apexrest')?.root !==
            registration.previousRoot
          )
            throw new Error('The previous marketplace could not be verified.');
          recovery = previousPlugin?.enabled
            ? 'previous-registration-restored'
            : 'previous-marketplace-restored; plugin-state-needs-review';
        } catch (recoveryError) {
          unknown ||= recoveryError instanceof Fault && recoveryError.status === 'outcome_unknown';
          recovery = unknown ? 'outcome-unknown' : 'needs-review';
        }
      } else if (error instanceof Fault && error.status === 'outcome_unknown') recovery = 'outcome-unknown';
      await writeJson(transition, { status: 'failed', recovery, ...record });
      throw new Fault(
        error instanceof Fault ? error.code : 'CODEX_REGISTRATION_FAILED',
        `${error instanceof Error ? error.message : 'Registration failed.'} Recovery: ${recovery}. Record: ${transition}`,
        unknown ? 6 : error instanceof Fault ? error.exitCode : 3,
        unknown ? 'outcome_unknown' : error instanceof Fault ? error.status : 'blocked',
      );
    }
    const state = {
      schemaVersion: 1,
      state: 'registered',
      sourceDigest: digest,
      destination,
      root,
      node,
      codexHome,
      marketplace,
      installed,
      listing,
      registration: { ...registration, transition },
      actions: ['CODEX_RELOAD_REQUIRED', 'NATIVE_HOST_VERIFICATION_REQUIRED'],
    };
    await writeJson(path.join(home, 'installation.json'), state);
    await mkdir(path.join(home, 'bin'), { recursive: true });
    for (const [name, contents] of Object.entries(launchers)) {
      await atomicWrite(path.join(home, 'bin', name), contents);
      if (name === 'apexrest') await chmod(path.join(home, 'bin', name), 0o700);
    }
    await writeJson(transition, { status: 'completed', ...record });
    return state;
  });
}
export async function installationState(home: string) {
  return readJson(path.join(home, 'installation.json'));
}

async function reusable(destination: string, expectedFiles: string, mcpKey: string, expectedClaude?: string) {
  try {
    const files: Record<string, string | undefined> = await inventory(destination);
    if (!files[mcpKey]) return false;
    if (expectedClaude) {
      const claudeKey = 'plugins/apexrest-apex/' + claudeFile;
      if (!files[claudeKey]) return false;
      if (
        canonical(normalizeClaude((await readJson(path.join(destination, claudeKey))) as ClaudeManifest)) !==
        expectedClaude
      )
        return false;
      files[claudeKey] = undefined;
    }
    return canonical({ ...files, [mcpKey]: undefined }) === expectedFiles;
  } catch {
    return false;
  }
}

// cmd.exe expands % and ! and ends quoted text at ", even inside "set" quotes.
const cmdUnsafe = /[%!"\x00-\x1f]/;

/** Launcher scripts for the managed CLI. Windows gets both PowerShell and cmd.exe entry points. */
export function launcherScripts(
  home: string,
  node: string,
  cli: string,
  platform = process.platform,
): Record<string, string> {
  if (platform !== 'win32') {
    const quote = (value: string) => "'" + value.replaceAll("'", "'\"'\"'") + "'";
    return {
      apexrest: `#!/bin/sh\nexport APEXREST_HOME=${quote(home)}\nexec ${quote(node)} ${quote(cli)} "$@"\n`,
    };
  }
  if ([home, node, cli].some((value) => cmdUnsafe.test(value)))
    throw new Fault(
      'UNSAFE_LAUNCHER_PATH',
      'The managed home, Node.js or plugin path contains characters a Windows launcher cannot represent safely (% ! " or control characters). Choose another home directory.',
      2,
      'blocked',
    );
  const ps = (value: string) => "'" + value.replaceAll("'", "''") + "'";
  return {
    // Restore the caller's APEXREST_HOME: a dot-sourced or in-session call must not leak it.
    'apexrest.ps1':
      `$apexrestPreviousHome = $env:APEXREST_HOME\n` +
      `$env:APEXREST_HOME = ${ps(home)}\n` +
      `try {\n  & ${ps(node)} ${ps(cli)} @args\n  $apexrestExitCode = $LASTEXITCODE\n} finally {\n  $env:APEXREST_HOME = $apexrestPreviousHome\n}\n` +
      `exit $apexrestExitCode\n`,
    'apexrest.cmd': `@echo off\r\nsetlocal\r\nset "APEXREST_HOME=${home}"\r\n"${node}" "${cli}" %*\r\nexit /b %ERRORLEVEL%\r\n`,
  };
}
