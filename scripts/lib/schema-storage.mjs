import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Compare generated contract bytes before any build copies them into a release. */
export async function storeSchemas(schemas, { directory = path.resolve('schemas'), check = false } = {}) {
  const names = Object.keys(schemas).sort();
  if (!names.length || names.some((name) => !/^[a-z][a-z0-9-]*$/.test(name)))
    throw new Error('Schema names must be nonempty contained lowercase identifiers.');
  if (!check) await mkdir(directory, { recursive: true });
  const root = path.resolve(directory);
  const info = await lstat(root).catch((error) => {
    if (error.code === 'ENOENT' && check) return null;
    throw error;
  });
  if (!info) throw new Error('Generated schemas are missing. Run npm run schemas:build.');
  if (!info.isDirectory() || info.isSymbolicLink() || (await realpath(root)) !== root)
    throw new Error('Schema output must be a physical directory without symlink ancestors.');
  const stale = [];
  for (const name of names) {
    const file = path.join(root, name + '.schema.json');
    const info = await lstat(file).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (info && (!info.isFile() || info.isSymbolicLink()))
      throw new Error(`Schema output is not a regular file: ${name}.schema.json`);
    const expected = JSON.stringify(schemas[name], null, 2) + '\n';
    if (check) {
      if (!info || (await readFile(file, 'utf8')) !== expected) stale.push(name + '.schema.json');
    } else await writeFile(file, expected);
  }
  if (stale.length)
    throw new Error(`Stale generated schemas: ${stale.join(', ')}. Run npm run schemas:build.`);
  return { status: check ? 'checked' : 'generated', schemas: names.length };
}
