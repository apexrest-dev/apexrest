import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import type { ProjectContext } from '../config.ts';
import { contained } from '../fs.ts';
import { Fault } from '../result.ts';

/** The page's own file: exactly one `.apx` under `pages/` declaring `page <id>`. */
export async function pageFile(ctx: ProjectContext, page: string): Promise<string> {
  const app = await contained(ctx.root, ctx.config.application.sourceDir);
  const dir = path.join(app, 'pages');
  const matches: string[] = [];
  for (const name of (await readdir(dir)).filter((file) => file.endsWith('.apx')).sort()) {
    const head = (await readFile(path.join(dir, name), 'utf8')).slice(0, 4096);
    if (new RegExp(`^page\\s+${page}\\s*\\(`, 'mu').test(head)) matches.push(path.join(dir, name));
  }
  if (matches.length !== 1)
    throw new Fault(
      matches.length ? 'TARGET_AMBIGUOUS' : 'TARGET_NOT_FOUND',
      matches.length ? `Several files declare page ${page}.` : `No page file declares page ${page}.`,
      matches.length ? 5 : 2,
    );
  return matches[0]!;
}
