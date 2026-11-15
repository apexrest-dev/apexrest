import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  atomicWrite,
  canonical,
  contained,
  exists,
  hash,
  inventory,
  readJson,
  withLock,
  writeJson,
} from './fs.ts';
import { environment, parse, type ProjectContext } from './config.ts';
import { Fault } from './result.ts';
import { sourceRelease } from './partial-import.ts';
import { get, parseApexLang } from './preview/apexlang.ts';
import { scaffoldObservationsSql } from './scaffold-observations.ts';

const text = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .regex(/^[^\x00-\x1f\x7f]+$/);
const column = z.string().regex(/^[A-Z][A-Z0-9_$#]{0,127}$/);
const sql = z
  .string()
  .trim()
  .min(1)
  .max(16000)
  .refine(
    (v) => /^(?:select|with)\b/i.test(v) && !v.includes('```') && !/[\x00\r]/.test(v),
    'Supply a SELECT query without code-fence delimiters',
  );
const common = { name: text, sql };
export const scaffoldSchema = z.strictObject({
  applicationName: text.optional(),
  pages: z
    .array(
      z.strictObject({
        id: z.number().int().min(1).max(9998),
        name: text,
        regions: z
          .array(
            z.discriminatedUnion('type', [
              z.strictObject({
                ...common,
                type: z.literal('interactiveReport'),
                columns: z
                  .array(
                    z.strictObject({
                      name: column,
                      heading: text,
                      dataType: z.enum(['varchar2', 'number', 'date', 'timestamp']),
                      formatMask: text.optional(),
                    }),
                  )
                  .min(1)
                  .max(100),
                emptyMessage: text.optional(),
              }),
              z.strictObject({
                ...common,
                type: z.literal('cards'),
                titleColumn: column,
                bodyColumn: column,
              }),
              z.strictObject({
                ...common,
                type: z.literal('barChart'),
                labelColumn: column,
                valueColumn: column,
                xTitle: text,
                yTitle: text,
              }),
            ]),
          )
          .min(1)
          .max(20),
      }),
    )
    .min(1)
    .max(30),
});
type Region = z.infer<typeof scaffoldSchema>['pages'][number]['regions'][number];
const stateSchema = z.strictObject({
  version: z.literal(1),
  files: z.record(z.string(), z.string()),
  shells: z.record(z.string(), z.string()),
});
const q = (value: string) => JSON.stringify(value);
const reportAlias = (index: number) => {
  let alias = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    alias = String.fromCharCode(65 + ((n - 1) % 26)) + alias;
  return alias;
};
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'page';
const group = (name: string, body: string, level = 2) =>
  `${'    '.repeat(level)}${name} {\n${body}\n${'    '.repeat(level)}}`;
const property = (name: string, value: string, level = 3) => `${'    '.repeat(level)}${name}: ${value}`;
const block = (head: string, body: string, level = 1) =>
  `${'    '.repeat(level)}${head} (\n${body}\n${'    '.repeat(level)})`;
const source = (query: string, level = 2) =>
  group(
    'source',
    [
      property('location', 'localDatabase', level + 1),
      property('type', 'sqlQuery', level + 1),
      property(
        'sqlQuery',
        '\n' +
          `${'    '.repeat(level + 2)}\x60\x60\x60sql\n` +
          query
            .split('\n')
            .map((l) => '    '.repeat(level + 2) + l)
            .join('\n') +
          `\n${'    '.repeat(level + 2)}\x60\x60\x60`,
        level + 1,
      ),
    ].join('\n'),
    level,
  );

export function renderRegion(region: Region, index: number) {
  const p = (key: string, value: string) => property(key, value);
  const parts = [
    property('name', q(region.name), 2),
    property('type', region.type === 'barChart' ? 'chart' : region.type, 2),
  ];
  if (region.type !== 'barChart') parts.push(source(region.sql));
  parts.push(group('layout', p('sequence', String((index + 1) * 10)) + '\n' + p('slot', 'body')));
  parts.push(
    group(
      'appearance',
      p(
        'template',
        '@/' +
          { interactiveReport: 'interactive-report', cards: 'cards-container', barChart: 'standard' }[
            region.type
          ],
      ) +
        '\n' +
        p('templateOptions', '#DEFAULT#'),
    ),
  );
  if (region.type === 'cards') {
    parts.push(
      group('title', p('column', region.titleColumn)),
      group('body', p('column', region.bodyColumn)),
    );
  } else if (region.type === 'barChart') {
    parts.push(group('security', p('escapeSpecialChars', 'true')), group('chart', p('type', 'bar')));
    for (const [axis, title] of [
      ['x', region.xTitle],
      ['y', region.yTitle],
    ])
      parts.push(
        block(`axis ${axis}`, property('name', axis!, 3) + '\n' + property('title', q(title!), 3), 2),
      );
    parts.push(
      block(
        'series values',
        [
          property('name', q(region.name), 3),
          group('execution', property('sequence', '10', 4), 3),
          source(region.sql, 3),
          group(
            'columnMapping',
            property('label', region.labelColumn, 4) + '\n' + property('value', region.valueColumn, 4),
            3,
          ),
        ].join('\n'),
        2,
      ),
    );
  } else {
    if (new Set(region.columns.map((c) => c.name)).size !== region.columns.length)
      throw new Fault('INVALID_INPUT', 'Report column names must be unique.', 2);
    parts.push(
      group('pagination', p('type', 'rowRangesXToYOfZ')),
      group(
        'messages',
        p('whenNoDataFound', q(region.emptyMessage ?? 'No rows found. Clear filters or add source data.')),
      ),
      group('link', p('linkColumn', 'exclude')),
    );
    for (const [i, c] of region.columns.entries()) {
      const body = [
        property('type', 'plainText', 3),
        group('heading', property('heading', q(c.heading), 4), 3),
        group('layout', property('sequence', String(i + 1), 4), 3),
        group('source', property('dataType', c.dataType, 4), 3),
        group('advanced', property('endUserAlias', reportAlias(i), 4), 3),
      ];
      if (i === 0) body.push(group('accessibility', property('valueIdentifiesRow', 'true', 4), 3));
      if (c.formatMask) body.push(group('appearance', property('formatMask', q(c.formatMask), 4), 3));
      parts.push(block(`column ${c.name}`, body.join('\n'), 2));
    }
    parts.push(
      block(
        'savedReport 1001',
        [
          property('visibility', 'primaryDefault', 3),
          group('view', property('rowsPerPage', '25', 4), 3),
          ...region.columns.map((c, i) =>
            block(`displayColumn ${c.name}`, property('sequence', String(i + 1), 4), 3),
          ),
        ].join('\n'),
        2,
      ),
    );
  }
  return block(`region r${index + 1}`, parts.join('\n'));
}

/** Local source generation only. Oracle compiler, plan and import remain the ship workflow. */
export async function scaffold(ctx: ProjectContext, specFile: string, name?: string) {
  const file = await contained(ctx.root, specFile);
  const raw = await readFile(file, 'utf8');
  if (Buffer.byteLength(raw) > 256 * 1024)
    throw new Fault('INVALID_INPUT', 'Scaffold specification exceeds 256 KiB.', 2);
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Fault('INVALID_INPUT', 'specFile must contain valid JSON.', 2);
  }
  const spec = parse(scaffoldSchema, input);
  const target = name ? environment(ctx, name) : undefined;
  if (new Set(spec.pages.map((p) => p.id)).size !== spec.pages.length)
    throw new Fault('INVALID_INPUT', 'Page IDs must be unique.', 2);
  const root = await contained(ctx.root, ctx.config.application.sourceDir);
  if ((await sourceRelease(root)) !== '26.2')
    throw new Fault(
      'SCAFFOLD_RELEASE_UNSUPPORTED',
      'Scaffolding requires an Oracle-generated 26.2 application.',
      3,
    );
  return withLock(await contained(ctx.root, '.apexrest/scaffold.lock'), async () => {
    const stateFile = await contained(ctx.root, '.apexrest/scaffold.json');
    const state = (await exists(stateFile))
      ? parse(stateSchema, await readJson(stateFile))
      : { version: 1 as const, files: {} as Record<string, string>, shells: {} as Record<string, string> };
    const before = await inventory(root),
      writes: Record<string, string> = {};
    const conflict = (name: string) =>
      new Fault(
        'LOCAL_EDITS_CONFLICT',
        `Scaffold cannot replace unowned or edited source: ${name}. Preserve the file and edit it manually.`,
        5,
        'conflict',
      );
    const navFile = 'shared-components/lists/navigation-menu.apx';
    const navigation = await readFile(await contained(root, navFile), 'utf8');
    const nav = parseApexLang(navigation, navFile);
    if (nav.length !== 1 || nav[0]!.type !== 'list' || nav[0]!.id !== 'navigation-menu')
      throw conflict(navFile);
    let navText = navigation;
    for (const page of spec.pages) {
      const files = Object.keys(before).filter(
        (f) =>
          f.startsWith('pages/') &&
          /^p\d+-/.test(path.basename(f)) &&
          Number(/^p(\d+)-/.exec(path.basename(f))?.[1]) === page.id,
      );
      if (files.length > 1) throw conflict(`page ${page.id}`);
      const name = files[0] ?? `pages/p${String(page.id).padStart(5, '0')}-${slug(page.name)}.apx`;
      const body = page.regions.map(renderRegion).join('\n\n');
      if (files[0] && !state.files[name]) {
        const old = await readFile(await contained(root, name), 'utf8');
        const [home, ...extra] = parseApexLang(old, name);
        // The sole special case: append to Oracle's blank Home, retaining all its properties.
        if (
          page.id !== 1 ||
          extra.length ||
          home?.type !== 'page' ||
          home.id !== '1' ||
          home.children.length !== 1 ||
          home.children[0]!.id !== 'app-name' ||
          home.children[0]!.props.type !== 'staticContent' ||
          home.props.name !== page.name
        )
          throw conflict(name);
        const at = old.lastIndexOf(')');
        state.shells[name] = old;
        writes[name] = old.slice(0, at) + body + '\n' + old.slice(at);
      } else {
        if (files[0] && state.files[name] !== before[name]) throw conflict(name);
        const shell = state.shells[name];
        writes[name] = shell
          ? shell.slice(0, shell.lastIndexOf(')')) + body + '\n' + shell.slice(shell.lastIndexOf(')'))
          : block(
              `page ${page.id}`,
              [
                property('name', q(page.name), 1),
                property(
                  'alias',
                  q(
                    path
                      .basename(name)
                      .replace(/^p\d+-/, '')
                      .replace(/\.apx$/, '')
                      .toUpperCase(),
                  ),
                  1,
                ),
                property('title', q(page.name), 1),
                group(
                  'appearance',
                  property('pageTemplate', '@/standard', 2) +
                    '\n' +
                    property('templateOptions', '#DEFAULT#', 2),
                  1,
                ),
                body,
              ].join('\n'),
              0,
            ) + '\n';
      }
      const entry = nav[0]!.children.find(
        (e) => e.type === 'entry' && String(get(e.props, 'link.target.page')) === String(page.id),
      );
      if (!entry) {
        const id = `scaffold-p${page.id}`;
        if (nav[0]!.children.some((e) => e.id === id)) throw conflict(navFile);
        const addition = block(
          `entry ${id}`,
          [
            property('label', q(page.name), 2),
            group('layout', property('sequence', String(page.id + 10), 3)),
            group('link', group('target:', property('page', String(page.id), 4), 3)),
          ].join('\n'),
        );
        const at = navText.lastIndexOf(')');
        navText = navText.slice(0, at) + addition + '\n' + navText.slice(at);
      }
    }
    if (navText !== navigation) writes[navFile] = navText;
    if (spec.applicationName) {
      const name = 'application.apx';
      const original = await readFile(await contained(root, name), 'utf8');
      if (!/^    name: .+$/m.test(original)) throw conflict(name);
      writes[name] = original.replace(/^    name: .+$/m, () => '    name: ' + q(spec.applicationName!));
    }
    // Every output is parsed before any source is touched. Keep a durable before/after
    // tree for inspection/recovery if the process stops between atomic file writes.
    for (const [name, value] of Object.entries(writes)) parseApexLang(value, name);
    const stage = await contained(ctx.root, `.apexrest/scaffolds/${randomUUID()}`);
    const observationsFile = path.join(stage, 'observations.sql');
    if (target)
      await atomicWrite(
        observationsFile,
        await scaffoldObservationsSql(
          target,
          spec.pages.map((p) => p.id),
        ),
      );
    for (const [name, value] of Object.entries(writes)) {
      if (before[name])
        await atomicWrite(path.join(stage, 'before', name), await readFile(await contained(root, name)));
      await atomicWrite(path.join(stage, 'after', name), value);
    }
    if (canonical(await inventory(root)) !== canonical(before))
      throw new Fault('SOURCE_DRIFT', 'Source changed during scaffolding; staged outputs retained.', 5);
    for (const [name, value] of Object.entries(writes)) {
      const target = await contained(root, name);
      const current = (await exists(target)) ? hash(await readFile(target)) : undefined;
      if (current !== before[name])
        throw new Fault('SOURCE_DRIFT', `Source changed before writing ${name}; staged copies retained.`, 5);
      await atomicWrite(target, value);
      state.files[name] = hash(value);
    }
    await writeJson(stateFile, state);
    return {
      files: Object.keys(writes),
      pages: spec.pages.map((p) => ({ id: p.id, name: p.name })),
      sourceDigest: hash(canonical(await inventory(root))),
      compilerValidation: 'required-by-ship',
      nextAction: 'apexrest_ship mode:apply',
      stage: path.relative(ctx.root, stage),
      ...(target
        ? {
            readback: {
              sqlFile: path.relative(ctx.root, observationsFile),
              environment: name,
              connectionRef: target.readConnectionRef,
              purpose:
                'Only if requested: manually execute read-only metadata/query observations after import. Not executed by scaffold or ship.',
            },
          }
        : {}),
    };
  });
}
