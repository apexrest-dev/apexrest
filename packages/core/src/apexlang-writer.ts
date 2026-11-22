/**
 * APEXlang writing primitives shared by the generators (`project scaffold`/`insert` and Composer):
 * four-space indentation, property groups, named components and fenced code. Both generators
 * build source text from these, so the same construct is written the same way everywhere.
 */

/** Indents every non-empty line; empty lines stay empty. */
export const indent = (value: string, depth = 4) =>
  value
    .split('\n')
    .map((line) => (line ? ' '.repeat(depth) + line : line))
    .join('\n');

/** A property group: `name {` … `}`. */
export const group = (name: string, value: string) => `${name} {\n${indent(value)}\n}`;

/** A component: `kind id (` … `)`; array parts skip empty entries. */
export const node = (kind: string, id: string, value: string | string[]) =>
  `${kind} ${id} (\n${indent(Array.isArray(value) ? value.filter(Boolean).join('\n') : value)}\n)\n`;

/** A fenced code value, indented one level under its property. */
export const fence = (language: string, value: string) =>
  `\n${indent('```' + language + '\n' + value + '\n```')}`;

/** A region or item appearance with a theme template and default options. */
export const appearance = (template: string) =>
  group('appearance', `template: @/${template}\ntemplateOptions: #DEFAULT#`);

/** A dynamic action step that refreshes one region and does not run on page load. */
export const refreshAction = (key: string, region: string, sequence: number) =>
  node('action', key, [
    'action: refresh',
    group('affectedElements', `selectionType: region\nregion: @${region}`),
    group('execution', `sequence: ${sequence}\nfireOnInit: false`),
  ]);
