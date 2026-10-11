import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileInventory } from './plugin-harness.mjs';

// Indentation and other source bytes remain significant; only trailing
// whitespace, CRLF and terminal newlines may differ after removing the fault.
export async function repairedSourceMatches(source, baseline) {
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
    if (
      normalize(await readFile(path.join(source, file), 'utf8')) !==
      normalize(await readFile(path.join(baseline, file), 'utf8'))
    )
      return false;
  }
  return true;
}
