import path from 'node:path';
import { lstat, realpath } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { exists, inventory, readJson } from '../../core/src/fs.ts';
import { resourceRoot } from '../../core/src/project.ts';
import { Fault } from '../../core/src/result.ts';

async function rejectLink(file: string) {
  if ((await lstat(file)).isSymbolicLink())
    throw new Fault('SYMLINK_NOT_ALLOWED', 'Source and bundle inventories reject symlinks.', 2);
}

async function pluginAt(root: string): Promise<string | undefined> {
  if (
    (await exists(path.join(root, '.codex-plugin/plugin.json'))) ||
    (await exists(path.join(root, 'plugin.json')))
  )
    return root;
  const plugins = path.join(root, 'plugins');
  if (!(await exists(plugins))) return;
  await rejectLink(plugins);
  const plugin = path.join(plugins, 'apexrest-apex');
  if (!(await exists(plugin))) return;
  await rejectLink(plugin);
  if (
    (await exists(path.join(plugin, '.codex-plugin/plugin.json'))) ||
    (await exists(path.join(plugin, 'plugin.json')))
  )
    return plugin;
}

/** Resolve only supported package layouts; never inventory the surrounding workspace. */
export async function resolveNativePlugin(source?: string): Promise<string> {
  const candidates = source
    ? [path.resolve(source)]
    : [path.resolve(resourceRoot(), '..'), path.resolve(resourceRoot(), '../codex-compat')];
  for (const candidate of candidates) {
    if (!(await exists(candidate))) continue;
    // An explicitly selected root may be an alias, but package children may not be links.
    const plugin = await pluginAt(await realpath(candidate));
    if (plugin) return plugin;
  }
  throw new Fault(
    'INVALID_PACKAGE',
    'No APEXREST plugin bundle found. Set the source to a built plugin directory or its marketplace directory.',
    2,
  );
}

export const nativeMarketplace = {
  name: 'apexrest',
  interface: { displayName: 'APEXREST' },
  plugins: [
    {
      name: 'apexrest-apex',
      source: { source: 'local', path: './plugins/apexrest-apex' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_USE', products: ['codex'] },
      category: 'Productivity',
    },
  ],
};

export async function validateNative(source?: string) {
  const root = await resolveNativePlugin(source);
  await inventory(root);
  const portable = await exists(path.join(root, 'plugin.json'));
  const manifest = (await readJson(
    path.join(root, portable ? 'plugin.json' : '.codex-plugin/plugin.json'),
  )) as { name: string; version: string; skills?: string; mcpServers?: string };
  if (
    manifest.name !== 'apexrest-apex' ||
    !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(manifest.version)
  )
    throw new Fault('INVALID_PACKAGE', 'Invalid plugin identity or version.', 2);
  const mcp = (await readJson(path.join(root, portable ? 'mcp.json' : '.mcp.json'))) as {
    mcpServers: Record<string, { command: string; args: string[] }>;
  };
  if (!mcp.mcpServers.apexrest || Object.keys(mcp.mcpServers).length !== 1)
    throw new Fault('INVALID_PACKAGE', 'Package must expose exactly its own MCP server.', 2);
  if (portable) {
    const ajv = new Ajv2020({ strict: false });
    for (const [file, value] of [
      ['plugin', manifest],
      ['mcp', mcp],
    ] as const)
      if (
        !ajv.validate(
          (await readJson(path.join(resourceRoot(), `schemas/vendor/${file}.schema.json`))) as object,
          value,
        )
      )
        throw new Fault('MANIFEST_SCHEMA_INVALID', ajv.errorsText(), 2);
  } else if (manifest.mcpServers !== './.mcp.json')
    throw new Fault('MANIFEST_SCHEMA_INVALID', 'Compatibility manifest must use the companion .mcp.json.', 2);
  // Legacy Codex-only payloads remain valid; a dual-host payload must bind the same flow.
  if (await exists(path.join(root, '.claude-plugin/plugin.json'))) {
    const claude = (await readJson(path.join(root, '.claude-plugin/plugin.json'))) as {
      name: string;
      version: string;
      skills: string;
      mcpServers: typeof mcp.mcpServers;
    };
    if (
      claude.name !== 'apexrest' ||
      claude.version !== manifest.version ||
      claude.skills !== (manifest.skills ?? './skills/') ||
      !claude.mcpServers?.apexrest ||
      Object.keys(claude.mcpServers).length !== 1 ||
      JSON.stringify(claude.mcpServers.apexrest.args) !==
        JSON.stringify(['${CLAUDE_PLUGIN_ROOT}/runtime/mcp.mjs'])
    )
      throw new Fault(
        'MANIFEST_SCHEMA_INVALID',
        'Claude Code must use the same version, skills and runtime as Codex.',
        2,
      );
  }
  for (const file of ['runtime/mcp.mjs', 'runtime/apexrest.mjs', 'skills/apexrest-setup/SKILL.md'])
    if (!(await exists(path.join(root, file)))) throw new Fault('INCOMPLETE_PACKAGE', `Missing ${file}`, 2);
  return { status: 'valid', profile: portable ? 'portable' : 'codex-compat', version: manifest.version };
}
