import path from 'node:path';
import { Marked, Renderer } from 'marked';

export const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const encodedPath = (value) => value.split('/').map(encodeURIComponent).join('/');

export function documentationUrl(
  href,
  { source, base, pages, assets = [], downloads = [], origin, repository },
  image = false,
) {
  if (typeof href !== 'string' || /[\x00-\x20\\<>"']/.test(href)) return null;
  if (/^https:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      // Public README links stay absolute on GitHub/npm but resolve locally in a preview.
      if (!image && origin && url.origin === origin && url.pathname.startsWith(base))
        return url.pathname + url.search + url.hash;
      return url.href;
    } catch {
      return null;
    }
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) return null;
  if (href.startsWith('#')) return image ? null : href;
  const [, rawPath, suffix = ''] = href.match(/^([^?#]*)([?#].*)?$/) ?? [];
  if (!rawPath) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (/[\x00-\x1f\\<>"':]/.test(decoded)) return null;
  const target = path.posix.normalize(
    decoded.startsWith('/') ? decoded.slice(1) : path.posix.join(path.posix.dirname(source), decoded),
  );
  if (target === '..' || target.startsWith('../')) return null;
  if (assets.includes(target))
    return base + 'assets/' + encodedPath(target.slice('docs/assets/'.length)) + suffix;
  if (image) return null;
  if (downloads.includes(target)) return base + encodedPath(target.slice('docs/'.length)) + suffix;
  const page = pages.find((entry) => entry.source === target || entry.aliases?.includes(target));
  if (page) return base + (page.slug ? page.slug + '/' : '') + suffix;
  // Preserve legacy links to configured site routes while new content uses
  // repository-relative Markdown paths that also work directly on GitHub.
  const route = pages.find((entry) => entry.slug === decoded.replace(/\/$/, ''));
  if (route) return base + (route.slug ? route.slug + '/' : '') + suffix;
  return `${repository}/${decoded.endsWith('/') ? 'tree' : 'blob'}/main/${encodedPath(target)}${suffix}`;
}

export function renderMarkdown(text, context) {
  const ids = new Set(['main', 'search', 'search-results']);
  const defaultRenderer = new Renderer();
  const markdown = new Marked({
    gfm: true,
    async: false,
    renderer: {
      // Markdown is not a trusted HTML template. All authored HTML is shown
      // literally; only the renderer can emit tags and attributes.
      html({ text }) {
        return escapeHtml(text);
      },
      heading({ tokens, depth, text }) {
        const slug =
          text
            .toLowerCase()
            .replace(/<[^>]*>/g, '')
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
            .trim()
            .replace(/\s/g, '-') || 'section';
        let id = slug;
        for (let count = 1; ids.has(id); count++) id = `${slug}-${count}`;
        ids.add(id);
        return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const label = this.parser.parseInline(tokens);
        const url = documentationUrl(href, context);
        return url
          ? `<a href="${escapeHtml(url)}"${title ? ` title="${escapeHtml(title)}"` : ''}>${label}</a>`
          : label;
      },
      image({ href, title, text }) {
        const url = documentationUrl(href, context, true);
        return url
          ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" decoding="async">`
          : escapeHtml(text);
      },
      table(token) {
        defaultRenderer.parser = this.parser;
        return `<div class="table-scroll" role="region" aria-label="${escapeHtml(context.tableLabel ?? 'Documentation table')}" tabindex="0">${defaultRenderer.table(token)}</div>\n`;
      },
    },
  });
  return markdown.parse(text);
}
