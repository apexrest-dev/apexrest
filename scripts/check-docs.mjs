import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { files } from './lib/release.mjs';
import { renderMarkdown } from './lib/site-markdown.mjs';

// Human documentation is English only. Historical specifications, machine-readable
// evidence, third-party notices and agent skills retain their sources.
const documents = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md'];
for (const root of ['docs', 'site/content', 'templates', 'plugins/apexrest-apex/skills']) {
  for (const file of await files(root)) {
    if (file.endsWith('.md')) documents.push(root + '/' + file);
  }
}
const context = {
  base: '/codex/',
  pages: [],
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
  for (const href of (await inspect(file)).links) {
    if (/^[a-z][a-z\d+.-]*:/i.test(href)) continue;
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
// Historical working inputs keep their original form and language; they are not
// translated or rewritten, but must remain present.
for (const file of ['APEXREST_CODEX_PLUGIN_BUILD_SPEC.md', 'APEXREST_COMPOSER_IMPLEMENTATION_PLAN.md']) {
  assert.ok(!documents.includes(file), `${file}: historical input must not be a translated document`);
  assert.ok(await stat(file).catch(() => null), `${file}: missing historical input`);
}
console.log(
  `Documentation: ${allDocuments.length} documents; local targets/anchors and documented script commands verified.`,
);
