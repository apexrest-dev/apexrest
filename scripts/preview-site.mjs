import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const { basePath: base } = JSON.parse(await readFile('site/site.config.json', 'utf8'));
const root = path.resolve('docs');
const port = Number(process.env.APEXREST_SITE_PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/') {
      response.writeHead(302, { Location: base }).end();
      return;
    }
    if (!url.pathname.startsWith(base)) {
      response.writeHead(404).end('Not found');
      return;
    }
    const relative = decodeURIComponent(url.pathname.slice(base.length));
    if (
      relative.split('/').some((part) => part.startsWith('.') || part === 'evidence') ||
      relative.includes('\\')
    ) {
      response.writeHead(404).end('Not found');
      return;
    }
    let file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) && file !== root) {
      response.writeHead(404).end('Not found');
      return;
    }
    if ((await stat(file)).isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        response.writeHead(302, { Location: url.pathname + '/' + url.search }).end();
        return;
      }
      file = path.join(file, 'index.html');
    }
    const bytes = await readFile(file);
    response
      .writeHead(200, {
        'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      .end(bytes);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`Local GitHub Pages preview: http://127.0.0.1:${port}${base}`),
);
