import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { escapeHtml as escape, renderMarkdown } from './lib/site-markdown.mjs';
const config = JSON.parse(await readFile('site/site.config.json', 'utf8')),
  locales = JSON.parse(await readFile('site/locales.json', 'utf8')),
  publisher = JSON.parse(await readFile('publisher.config.json', 'utf8')),
  pkg = JSON.parse(await readFile('package.json', 'utf8'));
const base = process.env.APEXREST_SITE_BASE_PATH ?? publisher.basePath ?? config.basePath;
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('basePath must be an absolute directory path');
const repository = 'https://github.com/apexrest-dev/apexrest';
const assets = (await readdir('docs/assets', { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(?:svg|png|jpe?g|webp)$/.test(entry.name))
  .map((entry) => 'docs/assets/' + entry.name);
await rm('site-dist', { recursive: true, force: true });
await mkdir('site-dist/assets', { recursive: true });
for (const file of ['styles.css', 'search.js']) await cp('site/' + file, 'site-dist/assets/' + file);
for (const asset of assets) await cp(asset, 'site-dist/assets/' + asset.slice('docs/assets/'.length));
const search = Object.fromEntries(Object.keys(locales).map((lang) => [lang, []]));
for (const page of config.pages) {
  const locale = locales[page.lang];
  if (!locale) throw new Error(`Unknown documentation language: ${page.lang}`);
  const localeBase = base + locale.prefix;
  const text = (await readFile(page.source, 'utf8')).replaceAll('{{version}}', pkg.version);
  const route = base + (page.slug ? page.slug + '/' : '');
  search[page.lang].push({ title: page.title, url: route, text: text.replace(/[`#*]/g, '') });
  const nav = config.pages
    .filter((p) => p.lang === page.lang)
    .map(
      (p) =>
        `<li><a href="${base + (p.slug ? p.slug + '/' : '')}"${p.slug === page.slug ? ' aria-current="page"' : ''}>${escape(p.title)}</a></li>`,
    )
    .join('');
  const alternates = Object.entries(locales).map(([lang, translation]) => {
    const counterpart = config.pages.find((p) => p.lang === lang && p.key === page.key);
    if (!counterpart) throw new Error(`Missing ${lang} page for ${page.key}`);
    return { lang, name: translation.name, url: base + (counterpart.slug ? counterpart.slug + '/' : '') };
  });
  const languages = alternates
    .map(
      (p) =>
        `<a lang="${p.lang}" hreflang="${p.lang}" href="${p.url}"${p.lang === page.lang ? ' aria-current="page"' : ''}>${escape(p.name)}</a>`,
    )
    .join('');
  const alternateLinks = alternates
    .map((p) => `<link rel="alternate" hreflang="${p.lang}" href="${p.url}">`)
    .join('');
  const html = `<!doctype html><html lang="${page.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'"><meta name="description" content="${escape(locale.description)}"><title>${escape(page.title)} · APEXREST</title>${alternateLinks}<link rel="stylesheet" href="${base}assets/styles.css"><script src="${base}assets/search.js" defer></script></head><body data-base="${localeBase}" data-search-empty="${escape(locale.empty)}" data-search-error="${escape(locale.error)}"><a class="skip" href="#main">${escape(locale.skip)}</a><header class="top"><a class="brand" href="${localeBase}" aria-label="APEXREST for Codex"><img src="${base}assets/apexrest-logo.svg" width="56" height="56" alt="APEXREST"></a><nav class="languages" aria-label="${escape(locale.language)}">${languages}</nav><span class="badge">${pkg.version}</span></header><div class="layout"><aside class="sidebar"><details open><summary>${escape(locale.documentation)}</summary><nav aria-label="${escape(locale.documentation)}"><ul>${nav}</ul></nav></details><label class="search-label" for="search">${escape(locale.search)}</label><input id="search" type="search" placeholder="${escape(locale.placeholder)}" autocomplete="off"><ul class="search-results" id="search-results" aria-live="polite"></ul></aside><main id="main" tabindex="-1"><div class="eyebrow">${escape(locale.eyebrow)}</div>${renderMarkdown(text, { source: page.source, base, pages: config.pages, assets, repository, tableLabel: locale.table })}</main></div><footer>APEXREST · Apache-2.0 · ${escape(locale.sourceBuild)} ${pkg.version} · ${escape(locale.independent)}</footer></body></html>`;
  await mkdir('site-dist/' + page.slug, { recursive: true });
  await writeFile('site-dist/' + page.slug + (page.slug ? '/' : '') + 'index.html', html);
}
for (const [lang, entries] of Object.entries(search)) {
  await writeFile('site-dist/' + locales[lang].prefix + 'search-index.json', JSON.stringify(entries));
}
await writeFile(
  'site-dist/llms.txt',
  `# APEXREST for Codex\nVersion ${pkg.version}. See release notes and implementation status for publication and verification evidence.\n\n` +
    Object.values(search)
      .flat()
      .map((p) => `- [${p.title}](${p.url})`)
      .join('\n') +
    '\n',
);
await mkdir('site-dist/releases', { recursive: true });
await writeFile(
  'site-dist/releases/manifest.json',
  JSON.stringify(
    {
      schemaVersion: 1,
      version: pkg.version,
      published: false,
      status: 'run release:dry-run to populate exact artifact hashes',
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    status: 'built',
    directory: 'site-dist',
    basePath: base,
    pages: config.pages.length,
    languages: Object.keys(locales),
    published: false,
  }),
);
