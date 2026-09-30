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
for (const folder of Object.keys(lock.packages).filter((p) => p.includes('node_modules/'))) {
  let list;
  try {
    list = await readdir(folder);
  } catch {
    continue;
  }
  for (const file of list.filter((f) => /^(LICENSE|LICENCE|NOTICE)(?:[.-].*)?$/i.test(f))) {
    const destination = 'dist/resources/third-party/' + folder.replaceAll('/', '__') + '__' + file;
    try {
      await cp(folder + '/' + file, destination, { recursive: true });
    } catch {
      /* absent optional package */
    }
  }
}
for (const folder of ['toolchains', 'schemas', 'templates'])
  await cp(folder, `dist/resources/${folder}`, { recursive: true });
await cp('resources', 'dist/resources', { recursive: true });
await mkdir('dist/resources/panel', { recursive: true });
for (const file of ['index.html', 'panel.css'])
  await cp('packages/panel/src/' + file, 'dist/resources/panel/' + file);
await build({
  entryPoints: ['packages/panel/src/panel.ts'],
  outfile: 'dist/resources/panel/panel.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  loader: { '.svg': 'dataurl' },
});
await build({
  entryPoints: ['packages/testkit/src/apex.ts'],
  outfile: 'dist/resources/testkit/apex.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  external: ['@playwright/test'],
});
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
console.log('Built the self-contained Codex native package.');
