import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSync } from 'esbuild';

export async function runTypeScriptChild(source: string, args: string[] = []) {
  const directory = await mkdtemp(path.resolve('.apexrest/test-build/unit/child-'));
  try {
    const built = buildSync({
      stdin: { contents: source, resolveDir: process.cwd(), sourcefile: 'child-runner.mjs' },
      bundle: true,
      packages: 'external',
      platform: 'node',
      format: 'esm',
      target: 'node24',
      write: false,
    });
    const file = path.join(directory, 'main.mjs');
    await writeFile(file, built.outputFiles[0]!.contents);
    return spawnSync(process.execPath, [file, ...args], { encoding: 'utf8' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
