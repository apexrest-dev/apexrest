import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileInventory } from './plugin-harness.mjs';

// Indentation and other source bytes remain significant; only trailing
// whitespace, CRLF and terminal newlines may differ after removing the fault.
export async function repairedSourceMatches(source, baseline, repairedFile) {
  const actual = await fileInventory(source),
    expected = await fileInventory(baseline);
  if (JSON.stringify(Object.keys(actual)) !== JSON.stringify(Object.keys(expected))) return false;
  const normalize = (text) =>
    text
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .replace(/\n+$/, '');
  for (const file of Object.keys(expected)) {
    if (actual[file] === expected[file]) continue;
    // Only the file containing the injected compiler fault may be normalized.
    // Binary assets, metadata and unrelated application files remain byte-exact.
    if (file !== repairedFile || !file.endsWith('.apx')) return false;
    if (
      normalize(await readFile(path.join(source, file), 'utf8')) !==
      normalize(await readFile(path.join(baseline, file), 'utf8'))
    )
      return false;
  }
  return true;
}
