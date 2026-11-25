// Manually invoked: node scripts/bench/run.mjs scripts/bench/preview-load-phases.ts --app <26.2 APEXlang folder> [--page p00010-customers.apx] [--out FILE]
//
// Times the preview's load phases (parse, renderer with the shared theme index, setup, property
// checks, lint) on a small and a large copy of an application: the given page file is copied to
// make N pages. Reports the first load and the reload after editing one page, so reused property
// findings show separately from the lint that stays global. Uses the installed preview assets.
// Results describe this dataset and host only.
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { cpus, platform, release, tmpdir } from 'node:os';
import path from 'node:path';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { defaultAssetsDir } from '../../packages/core/src/preview/assets.ts';

const argument = (name: string) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const source = argument('--app');
if (!source) throw new Error('Pass --app <APEXlang application folder>.');
const pageFile = argument('--page') ?? 'p00010-customers.apx';
const out = argument('--out');
const SIZES = [10, 300];

const results = [];
for (const pages of SIZES) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-load-phases-'));
  const app = path.join(root, 'app');
  try {
    await cp(source, app, { recursive: true });
    const template = await readFile(path.join(app, 'pages', pageFile), 'utf8');
    const id = /^page (\d+) \(/mu.exec(template)![1]!;
    for (let i = 0; i < pages; i++) {
      const page = 2000 + i;
      await writeFile(
        path.join(app, 'pages', `p${String(page).padStart(5, '0')}-copy.apx`),
        template
          .replace(new RegExp(`^page ${id} \\(`, 'mu'), `page ${page} (`)
          .replace(/^ {4}alias: .*$/mu, `    alias: COPY${page}`)
          .replaceAll(`P${id}_`, `P${page}_`),
      );
    }
    const files = (await readdir(path.join(app, 'pages'))).length;
    const server = new PreviewServer({ sourceDir: app, assetsDir: defaultAssetsDir(), database: ':memory:' });
    await server.start();
    try {
      const first = server.loadTimings;
      const edited = path.join(app, 'pages', 'p02000-copy.apx');
      await writeFile(edited, (await readFile(edited, 'utf8')).replace(/^( {4}name: .*)$/mu, '$1 edited'));
      await new Promise((resolve) => setTimeout(resolve, 2100));
      await fetch(`${server.url}/r/${path.basename(source).toLowerCase()}/copy2000`).catch(() => undefined);
      results.push({ pageFiles: files, firstLoad: first, afterOnePageEdit: server.loadTimings });
    } finally {
      await server.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const report = {
  kind: 'manually invoked preview load phase measurement',
  date: new Date().toISOString(),
  host: { platform: platform(), release: release(), cpu: cpus()[0]?.model, node: process.version },
  dataset: `${path.basename(source)} with ${pageFile} copied to make ${SIZES.join(' and ')} extra pages`,
  results,
};
const text = JSON.stringify(report, null, 2) + '\n';
if (out) await writeFile(out, text);
process.stdout.write(text);
