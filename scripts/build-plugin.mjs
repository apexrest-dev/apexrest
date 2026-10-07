import { build } from 'esbuild';
import { mkdir, readFile, writeFile, cp, rm, chmod } from 'node:fs/promises';
import { buildComponentCatalog } from './build-component-catalog.mjs';
import { buildPatternCatalog } from './build-pattern-catalog.mjs';
import { buildComposerCatalog } from './build-composer-catalog.mjs';
await buildComposerCatalog(true);
await buildComponentCatalog('resources/components', true);
await buildPatternCatalog('resources/patterns', true);
const metadata = JSON.parse(await readFile('plugins/metadata.json', 'utf8'));
await rm('dist/runtime', { recursive: true, force: true });
await mkdir('dist/runtime', { recursive: true });
await rm('dist/resources', { recursive: true, force: true });
await mkdir('dist/resources/third-party', { recursive: true });
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const { readdir } = await import('node:fs/promises');
// Notices cover packages bundled into the runtime: production dependencies only.
// Dev tooling and OS/CPU-specific optional packages are excluded, so the notice
// set is identical whichever platform runs the build.
const bundled = Object.entries(lock.packages)
  .filter(
    ([folder, entry]) =>
      folder.includes('node_modules/') &&
      !entry.dev &&
      !entry.devOptional &&
      !entry.link &&
      !(entry.optional && (entry.os || entry.cpu)),
  )
  .map(([folder]) => folder)
  .sort();
for (const folder of bundled) {
  let list;
  try {
    list = await readdir(folder);
  } catch {
    throw new Error(`Installed production dependency is missing: ${folder}. Run npm ci.`);
  }
  for (const file of list.filter((f) => /^(LICENSE|LICENCE|NOTICE)(?:[.-].*)?$/i.test(f)).sort()) {
    const destination = 'dist/resources/third-party/' + folder.replaceAll('/', '__') + '__' + file;
    await cp(folder + '/' + file, destination, { recursive: true });
  }
}
for (const folder of ['toolchains', 'schemas', 'templates'])
  await cp(folder, `dist/resources/${folder}`, { recursive: true });
await cp('resources', 'dist/resources', { recursive: true });
await build({
  entryPoints: { apexrest: 'packages/cli/src/main.ts', mcp: 'packages/mcp/src/main.ts' },
  outdir: 'dist/runtime',
  outExtension: { '.js': '.mjs' },
  // Keep chunks beside the entrypoints: resource and job paths use import.meta.url.
  chunkNames: 'chunk-[hash]',
  splitting: true,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});
for (const name of ['apexrest', 'mcp']) await chmod(`dist/runtime/${name}.mjs`, 0o755);
// Codex is the only product target. Remove the former generated experimental package.
await rm('dist/portable', { recursive: true, force: true });
const profile = 'codex-compat';
const root = `dist/${profile}/plugins/apexrest-apex`;
await rm(`dist/${profile}`, { recursive: true, force: true });
await mkdir(`${root}/.codex-plugin`, { recursive: true });
await cp('plugins/apexrest-apex/skills', `${root}/skills`, { recursive: true });
await cp('plugins/apexrest-apex/assets', `${root}/assets`, { recursive: true });
await cp('dist/runtime', `${root}/runtime`, { recursive: true });
for (const file of ['LICENSE', 'NOTICE']) await cp(file, `${root}/${file}`);
await cp('dist/resources', `${root}/resources`, { recursive: true });
await writeFile(
  `${root}/.codex-plugin/plugin.json`,
  JSON.stringify(
    {
      ...metadata,
      skills: './skills/',
      mcpServers: './.mcp.json',
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  `${root}/.mcp.json`,
  JSON.stringify(
    {
      mcpServers: { apexrest: { command: 'node', args: ['runtime/mcp.mjs'], cwd: '.' } },
    },
    null,
    2,
  ) + '\n',
);
// Claude Code reads the same skills and runtime through its own manifest. The MCP
// server path uses the host-expanded plugin root, so no cwd assumption is needed.
await mkdir(`${root}/.claude-plugin`, { recursive: true });
await writeFile(
  `${root}/.claude-plugin/plugin.json`,
  JSON.stringify(
    {
      name: 'apexrest',
      version: metadata.version,
      description: metadata.description,
      author: metadata.author,
      homepage: 'https://apex.rest',
      repository: 'https://github.com/apexrest-dev/apexrest',
      license: metadata.license,
      keywords: ['oracle', 'apex', 'apexlang', 'sqlcl', 'ords'],
      skills: './skills/',
      mcpServers: {
        apexrest: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/runtime/mcp.mjs'] },
      },
    },
    null,
    2,
  ) + '\n',
);
await mkdir(`dist/${profile}/.claude-plugin`, { recursive: true });
await writeFile(
  `dist/${profile}/.claude-plugin/marketplace.json`,
  JSON.stringify(
    {
      name: 'apexrest',
      owner: { name: 'APEXREST', url: 'https://apex.rest' },
      metadata: { description: 'Oracle APEX development, deployment and testing', version: metadata.version },
      plugins: [
        {
          name: 'apexrest',
          source: './plugins/apexrest-apex',
          description: metadata.description,
          version: metadata.version,
          category: 'productivity',
        },
      ],
    },
    null,
    2,
  ) + '\n',
);
await mkdir(`dist/${profile}/.agents/plugins`, { recursive: true });
await writeFile(
  `dist/${profile}/.agents/plugins/marketplace.json`,
  JSON.stringify(
    {
      name: 'apexrest',
      interface: { displayName: 'APEXREST' },
      plugins: [
        {
          name: metadata.name,
          source: { source: 'local', path: './plugins/apexrest-apex' },
          policy: { installation: 'AVAILABLE', authentication: 'ON_USE', products: ['codex'] },
          category: 'Productivity',
        },
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log('Built the self-contained Codex and Claude Code plugin package.');
