import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { files } from './lib/release.mjs';
import { renderMarkdown } from './lib/site-markdown.mjs';

// Human documentation is English only; functional references, licenses and agent skills retain their sources.
const documents = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md'];
for (const root of ['docs', 'site/content', 'templates', 'plugins/apexrest-apex/skills']) {
  for (const file of await files(root)) {
    if (file.endsWith('.md')) documents.push(root + '/' + file);
  }
}
const site = JSON.parse(await readFile('site/site.config.json', 'utf8'));
const publisher = JSON.parse(await readFile('publisher.config.json', 'utf8'));
const context = {
  base: site.basePath,
  origin: publisher.siteOrigin,
  pages: site.pages,
  repository: 'https://github.com/apexrest-dev/apexrest',
};
const cache = new Map();
async function inspect(file) {
  if (!cache.has(file)) {
    const text = await readFile(file, 'utf8');
    const tokens = marked.lexer(text);
    const links = [];
    marked.walkTokens(tokens, (token) => {
      if (token.type === 'link' || token.type === 'image') links.push(token.href);
    });
    const html = renderMarkdown(text, { ...context, source: file });
    cache.set(file, {
      text,
      links,
      code: tokens.filter((token) => token.type === 'code').map(({ lang, text }) => ({ lang, text })),
      headings: tokens.filter((token) => token.type === 'heading').map((token) => token.depth),
      ids: [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
    });
  }
  return cache.get(file);
}
const allDocuments = [...new Set(documents)];
for (const file of allDocuments) {
  for (let href of (await inspect(file)).links) {
    if (href.startsWith(publisher.siteOrigin + site.basePath)) {
      const url = new URL(href);
      const page = site.pages.find(
        (page) => site.basePath + (page.slug ? page.slug + '/' : '') === url.pathname,
      );
      assert.ok(
        page || url.pathname === site.basePath + 'acceptance.json',
        `${file}: unknown Pages route: ${href}`,
      );
      href = path.posix.relative(path.posix.dirname(file), page?.source ?? 'docs/acceptance.json') + url.hash;
    } else if (/^[a-z][a-z\d+.-]*:/i.test(href)) continue;
    const [location, fragment] = href.split('#');
    const target = location
      ? path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(location)))
      : file;
    assert.ok(!target.startsWith('../'), `${file}: link escapes repository: ${href}`);
    const info = await stat(target).catch(() => null);
    assert.ok(info, `${file}: missing link target: ${href}`);
    if (fragment && target.endsWith('.md')) {
      assert.ok(
        (await inspect(target)).ids.includes(decodeURIComponent(fragment)),
        `${file}: missing heading: ${href}`,
      );
    }
  }
}
// Documented commands must resolve: `node scripts/<file>` to an existing file and
// `npm run <script>` to a root package script. Evidence JSON is not scanned.
const { scripts: npmScripts } = JSON.parse(await readFile('package.json', 'utf8'));
const scriptFiles = new Map();
for (const file of allDocuments) {
  const { text } = await inspect(file);
  for (const [, script] of text.matchAll(/\bnode\s+(scripts\/[\w./-]+\.[cm]?[jt]s)\b/g)) {
    if (!scriptFiles.has(script)) scriptFiles.set(script, await stat(script).catch(() => null));
    assert.ok(scriptFiles.get(script), `${file}: missing script: node ${script}`);
  }
  for (const [, name] of text.matchAll(/\bnpm\s+run\s+([\w:.-]+)/g)) {
    assert.ok(Object.hasOwn(npmScripts, name), `${file}: missing npm script: npm run ${name}`);
  }
}
// Required current repository contracts must remain present.
for (const file of [
  'AGENTS.md',
  'docs/acceptance.json',
  'docs/implementation-status.md',
  'docs/next-actions.md',
]) {
  assert.ok(await stat(file).catch(() => null), `${file}: missing current repository contract`);
}
console.log(
  `Documentation: ${allDocuments.length} documents; local targets/anchors and documented script commands verified.`,
);
