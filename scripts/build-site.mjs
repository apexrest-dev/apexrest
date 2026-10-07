import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import path from 'node:path';
import { escapeHtml as escape, renderMarkdown } from './lib/site-markdown.mjs';
import { files } from './lib/release.mjs';

const config = JSON.parse(await readFile('site/site.config.json', 'utf8')),
  locales = JSON.parse(await readFile('site/locales.json', 'utf8')),
  publisher = JSON.parse(await readFile('publisher.config.json', 'utf8')),
  pkg = JSON.parse(await readFile('package.json', 'utf8'));
const base = process.env.APEXREST_SITE_BASE_PATH ?? publisher.basePath ?? config.basePath;
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('basePath must be an absolute directory path');
const check = process.argv.includes('--check');
const preview = process.argv.includes('--preview');
if (base !== config.basePath && !preview) throw new Error('Use --preview for a temporary basePath override');
const repository = 'https://github.com/apexrest-dev/apexrest';
const origin = new URL(publisher.siteOrigin).origin;
const assets = (await readdir('docs/assets', { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(?:svg|png|jpe?g|webp)$/.test(entry.name))
  .map((entry) => 'docs/assets/' + entry.name);
const downloads = ['docs/acceptance.json'];
const routes = new Set();
for (const page of config.pages) {
  if (!/^(?:[a-z0-9][a-z0-9.-]*\/)*(?:[a-z0-9][a-z0-9.-]*)?$/.test(page.slug) || routes.has(page.slug))
    throw new Error(`Invalid or duplicate page route: ${page.slug}`);
  routes.add(page.slug);
}
await rm('site-dist', { recursive: true, force: true });
await mkdir('site-dist/assets', { recursive: true });
for (const file of ['styles.css', 'search.js']) await cp('site/' + file, 'site-dist/assets/' + file);
for (const asset of assets) await cp(asset, 'site-dist/assets/' + asset.slice('docs/assets/'.length));
for (const file of downloads) await cp(file, 'site-dist/' + file.slice('docs/'.length));
await writeFile('site-dist/.nojekyll', '');
const search = Object.fromEntries(Object.keys(locales).map((lang) => [lang, []]));
const routeFor = (page) => base + (page.slug ? page.slug + '/' : '');
for (const page of config.pages) {
  const locale = locales[page.lang];
  if (!locale) throw new Error(`Unknown documentation language: ${page.lang}`);
  const localeBase = base + locale.prefix;
  const text = (await readFile(page.source, 'utf8')).replaceAll('{{version}}', pkg.version);
  const route = routeFor(page);
  search[page.lang].push({ title: page.title, url: route, text: text.replace(/[`#*]/g, '') });
  const navigationPages = config.pages.filter((p) => p.lang === page.lang);
  const nav = config.groups
    .map(
      (group) =>
        `<li class="nav-group"><span>${escape(group)}</span><ul>${navigationPages
          .filter((p) => p.group === group)
          .map(
            (p) =>
              `<li><a href="${routeFor(p)}"${p.slug === page.slug ? ' aria-current="page"' : ''}>${escape(p.title)}</a></li>`,
          )
          .join('')}</ul></li>`,
    )
    .join('');
  const alternates = Object.entries(locales).map(([lang, translation]) => {
    const counterpart = config.pages.find((p) => p.lang === lang && p.key === page.key);
    if (!counterpart) throw new Error(`Missing ${lang} page for ${page.key}`);
    return { lang, name: translation.name, url: routeFor(counterpart) };
  });
  const languages =
    alternates.length > 1
      ? `<nav class="languages" aria-label="${escape(locale.language)}">${alternates
          .map(
            (p) =>
              `<a lang="${p.lang}" hreflang="${p.lang}" href="${p.url}"${p.lang === page.lang ? ' aria-current="page"' : ''}>${escape(p.name)}</a>`,
          )
          .join('')}</nav>`
      : '';
  const alternateLinks = alternates
    .map((p) => `<link rel="alternate" hreflang="${p.lang}" href="${origin + p.url}">`)
    .join('');
  const body = renderMarkdown(text, {
    source: page.source,
    base,
    pages: config.pages,
    assets,
    downloads,
    origin,
    repository,
    tableLabel: locale.table,
  });
  const sections = [...body.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)]
    .map(([, id, label]) => `<li><a href="#${id}">${label.replace(/<[^>]*>/g, '')}</a></li>`)
    .join('');
  const html = `<!doctype html><html lang="${page.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'"><meta name="description" content="${escape(locale.description)}"><title>${escape(page.title)} · APEXREST</title><link rel="canonical" href="${origin + route}">${alternateLinks}<link rel="icon" href="${base}assets/apexrest-logo.svg" type="image/svg+xml"><link rel="stylesheet" href="${base}assets/styles.css"><script src="${base}assets/search.js" defer></script></head><body data-base="${localeBase}" data-search-empty="${escape(locale.empty)}" data-search-error="${escape(locale.error)}"><a class="skip" href="#main">${escape(locale.skip)}</a><header class="top"><a class="brand" href="${localeBase}"><img src="${base}assets/apexrest-logo.svg" width="40" height="40" alt=""><span>APEXREST<span class="brand-subtitle">Documentation</span></span></a><div class="top-links">${languages}<a href="${repository}">GitHub</a><span class="badge">${pkg.version}</span></div></header><div class="layout"><aside class="sidebar"><div class="search"><label class="search-label" for="search">${escape(locale.search)}</label><input id="search" type="search" placeholder="${escape(locale.placeholder)}" autocomplete="off" aria-controls="search-results"><ul class="search-results" id="search-results" aria-live="polite"></ul></div><details open><summary>${escape(locale.documentation)}</summary><nav aria-label="${escape(locale.documentation)}"><ul>${nav}</ul></nav></details></aside><main id="main" tabindex="-1"><div class="eyebrow">${escape(page.group)} / ${escape(page.title)}</div>${body.replace(/<\/h1>/, `</h1>${sections ? `<details class="on-this-page"><summary>On this page</summary><ul>${sections}</ul></details>` : ''}`)}<p class="source-link"><a href="${repository}/blob/main/${page.source}">View this page source</a></p></main></div><footer>APEXREST · Apache-2.0 · ${escape(locale.sourceBuild)} ${pkg.version} · ${escape(locale.independent)}</footer></body></html>\n`;
  const output = (page.slug ? page.slug + '/' : '') + 'index.html';
  await mkdir(path.dirname('site-dist/' + output), { recursive: true });
  await writeFile('site-dist/' + output, html);
  // Preserve the flat .html URLs previously served by GitHub's Markdown/Jekyll build.
  if (page.source.startsWith('docs/') && page.source !== 'docs/index.md') {
    const alias = path.basename(page.source, '.md') + '.html';
    // A full rendered page preserves old #anchors without client-side redirects.
    await writeFile('site-dist/' + alias, html);
  }
}
for (const [lang, entries] of Object.entries(search))
  await writeFile('site-dist/' + locales[lang].prefix + 'search-index.json', JSON.stringify(entries) + '\n');
await writeFile(
  'site-dist/llms.txt',
  `# APEXREST for Codex and Claude Code\nSource version ${pkg.version}. See implementation status for verification limits.\n\n` +
    Object.values(search)
      .flat()
      .map((p) => `- [${p.title}](${origin + p.url})`)
      .join('\n') +
    '\n',
);
// The branch-hosted website is source-controlled. Never replace or recursively clear docs/.
// Shared source assets/downloads are copied to the release preview but are not managed output.
const sharedFiles = [...assets, ...downloads].map((file) => file.slice('docs/'.length));
const outputFiles = (await files('site-dist')).filter((file) => !sharedFiles.includes(file));
const manifest =
  JSON.stringify(
    {
      schemaVersion: 1,
      basePath: base,
      siteOrigin: origin,
      pages: config.pages.map(({ source, slug }) => ({ source, route: routeFor({ slug }) })),
      files: outputFiles,
    },
    null,
    2,
  ) + '\n';
let previous;
try {
  previous = JSON.parse(await readFile('docs/site-manifest.json', 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const stale = (previous?.files ?? []).filter((file) => !outputFiles.includes(file));
// Only generated HTML/chrome files can be removed from a previous output manifest.
for (const file of stale) {
  if (
    !/^(?:[a-z0-9][a-z0-9.-]*\/)?index\.html$|^[a-z0-9][a-z0-9.-]*\.html$|^(?:\.nojekyll|llms\.txt|search-index\.json|assets\/(?:styles\.css|search\.js))$/.test(
      file,
    )
  )
    throw new Error(`Refusing to remove non-site output: ${file}`);
}
if (!preview) {
  if (check) {
    const mismatches = [];
    for (const file of outputFiles) {
      const current = await readFile('docs/' + file).catch(() => null);
      if (!current?.equals(await readFile('site-dist/' + file))) mismatches.push(file);
    }
    if (
      manifest !== (await readFile('docs/site-manifest.json', 'utf8').catch(() => '')) ||
      stale.length ||
      mismatches.length
    )
      throw new Error(
        `GitHub Pages output is stale; run npm run site:build. Changed: ${[...stale, ...mismatches].join(', ')}`,
      );
  } else {
    for (const file of stale) await rm('docs/' + file, { force: true });
    for (const file of outputFiles) {
      await mkdir(path.dirname('docs/' + file), { recursive: true });
      await cp('site-dist/' + file, 'docs/' + file);
    }
    await writeFile('docs/site-manifest.json', manifest);
  }
}
console.log(
  JSON.stringify({
    status: check ? 'checked' : 'built',
    directory: preview ? 'site-dist' : 'docs',
    preview: 'site-dist',
    basePath: base,
    pages: config.pages.length,
    generatedFiles: outputFiles.length,
    languages: Object.keys(locales),
    published: false,
  }),
);
