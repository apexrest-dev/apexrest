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
import { scaffoldSchema, type ScaffoldSpec } from './scaffold-spec.ts';
import {
  renderRegion,
  renderPageBody,
  renderProcess,
  validateSpec,
  pageGuards,
} from './scaffold-renderer.ts';
import { declarations, editSpans } from './composer/reader.ts';

export { scaffoldSchema, renderRegion };
const stateSchema = z.strictObject({
  version: z.literal(1),
  files: z.record(z.string(), z.string()),
  shells: z.record(z.string(), z.string()),
  navigation: z.record(z.string(), z.string()).optional(),
});
const q = (value: string) => JSON.stringify(value);
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
  const specDigest = hash(raw);
  return scaffoldSpec(ctx, parse(scaffoldSchema, input), raw, name, async () => {
    if (hash(await readFile(file, 'utf8')) !== specDigest)
      throw new Fault(
        'SOURCE_DRIFT',
        'The scaffold specification changed before writing; the staged exact input is retained.',
        5,
      );
  });
}

/**
 * Generates a parsed specification from a file or an expanded recipe. `raw` is the exact input
 * text (staged and digested); `recheck` runs right before the write and throws when an input the
 * specification came from changed.
 */
export async function scaffoldSpec(
  ctx: ProjectContext,
  spec: ScaffoldSpec,
  raw: string,
  name: string | undefined,
  recheck: () => Promise<void>,
) {
  const specDigest = hash(raw);
  const target = name ? environment(ctx, name) : undefined;
  validateSpec(spec);
  const root = await contained(ctx.root, ctx.config.application.sourceDir);
  const release = await sourceRelease(root);
  if (release !== '26.1' && release !== '26.2')
    throw new Fault(
      'SCAFFOLD_RELEASE_UNSUPPORTED',
      'Scaffolding requires an Oracle-generated 26.1 or 26.2 application.',
      3,
    );
  return withLock(await contained(ctx.root, '.apexrest/scaffold.lock'), async () => {
    const stateFile = await contained(ctx.root, '.apexrest/scaffold.json');
    const state = (await exists(stateFile))
      ? parse(stateSchema, await readJson(stateFile))
      : {
          version: 1 as const,
          files: {} as Record<string, string>,
          shells: {} as Record<string, string>,
          navigation: {} as Record<string, string>,
        };
    const ownedNavigation = (state.navigation ??= {});
    const before = await inventory(root),
      writes: Record<string, string> = {};
    const conflict = (name: string) =>
      new Fault(
        'LOCAL_EDITS_CONFLICT',
        `Scaffold cannot replace unowned or edited source: ${name}. Preserve the file and edit it manually.`,
        5,
        'conflict',
      );
    const navFile =
      release === '26.1' ? 'shared-components/lists.apx' : 'shared-components/lists/navigation-menu.apx';
    const navigation = await readFile(await contained(root, navFile), 'utf8');
    const nav = parseApexLang(navigation, navFile);
    const menus = nav.filter((node) => node.type === 'list' && node.id === 'navigation-menu');
    if (menus.length !== 1) throw conflict(navFile);
    const menu = menus[0]!;
    let navText = navigation;
    const aliases = new Map<string, number>();
    for (const file of Object.keys(before).filter(
      (name) => name.startsWith('pages/') && name.endsWith('.apx'),
    )) {
      for (const node of parseApexLang(await readFile(await contained(root, file), 'utf8'), file)) {
        if (node.type === 'page' && typeof node.props.alias === 'string')
          aliases.set(node.props.alias.toUpperCase(), Number(node.id));
      }
    }
    for (const page of spec.pages) {
      const files = Object.keys(before).filter(
        (f) =>
          f.startsWith('pages/') &&
          /^p\d+-/.test(path.basename(f)) &&
          Number(/^p(\d+)-/.exec(path.basename(f))?.[1]) === page.id,
      );
      if (files.length > 1) throw conflict(`page ${page.id}`);
      let alias = page.alias?.toLowerCase() ?? slug(page.name);
      if (!page.alias) {
        const base = alias;
        for (
          let attempt = 0;
          alias === 'page' ||
          (aliases.has(alias.toUpperCase()) && aliases.get(alias.toUpperCase()) !== page.id);
          attempt++
        ) {
          alias = `${base}-${page.id}${attempt ? '-' + attempt : ''}`;
        }
      }
      if (
        page.alias &&
        aliases.has(page.alias.toUpperCase()) &&
        aliases.get(page.alias.toUpperCase()) !== page.id
      )
        throw conflict(`page alias ${page.alias}`);
      const name = files[0] ?? `pages/p${String(page.id).padStart(5, '0')}-${alias}.apx`;
      aliases.set(
        (
          page.alias ??
          path
            .basename(name)
            .replace(/^p\d+-/, '')
            .replace(/\.apx$/, '')
        ).toUpperCase(),
        page.id,
      );
      if (
        files[0] &&
        page.alias &&
        !state.shells[name] &&
        page.alias.toLowerCase() !==
          path
            .basename(name)
            .replace(/^p\d+-/, '')
            .replace(/\.apx$/, '')
      )
        throw conflict('Changing a page alias requires an explicit source rename.');
      const body = renderPageBody(page, release);
      if (
        (state.shells[name] || (page.id === 1 && files[0] && !state.files[name])) &&
        (page.condition || page.authorizationScheme || page.buildOption)
      )
        throw conflict(
          'Preserve the existing Home page security; place guards on its regions and processes.',
        );
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
          home.children[0]!.props.type !== 'staticContent'
        )
          throw conflict(name);
        if (page.alias && page.alias !== home.props.alias) throw conflict('existing Home page alias');
        state.shells[name] = old
          .replace(/^    name: .+$/m, () => '    name: ' + q(page.name))
          .replace(/^    title: .+$/m, () => '    title: ' + q(page.name));
        const shell = state.shells[name]!;
        const close = shell.lastIndexOf(')');
        writes[name] = shell.slice(0, close) + body + '\n' + shell.slice(close);
      } else {
        if (files[0] && state.files[name] !== before[name]) throw conflict(name);
        let shell = state.shells[name];
        if (shell) {
          if (page.alias && page.alias !== parseApexLang(shell, name)[0]?.props.alias)
            throw conflict('existing Home page alias');
          shell = shell
            .replace(/^    name: .+$/m, () => '    name: ' + q(page.name))
            .replace(/^    title: .+$/m, () => '    title: ' + q(page.name));
          state.shells[name] = shell;
        }
        writes[name] = shell
          ? shell.slice(0, shell.lastIndexOf(')')) + body + '\n' + shell.slice(shell.lastIndexOf(')'))
          : block(
              `page ${page.id}`,
              [
                property('name', q(page.name), 1),
                property(
                  'alias',
                  // The compiler requires upper-case aliases (VALUE_NOT_UPPERCASE), given or derived.
                  q(
                    (
                      page.alias ??
                      path
                        .basename(name)
                        .replace(/^p\d+-/, '')
                        .replace(/\.apx$/, '')
                    ).toUpperCase(),
                  ),
                  1,
                ),
                property('title', q(page.name), 1),
                group(
                  'appearance',
                  (page.mode === 'modalDialog'
                    ? property('pageMode', 'modalDialog', 2) +
                      '\n' +
                      property('dialogTemplate', '@/modal-dialog', 2)
                    : property('pageTemplate', '@/standard', 2)) +
                    '\n' +
                    property('templateOptions', '#DEFAULT#', 2),
                  1,
                ),
                pageGuards(page),
                body,
              ].join('\n'),
              0,
            ) + '\n';
      }
      const entry = menu.children.find(
        (e) => e.type === 'entry' && String(get(e.props, 'link.target.page')) === String(page.id),
      );
      // Dialog pages open from other pages, so they stay out of the menu unless asked.
      if ((page.navigation ?? page.mode !== 'modalDialog') === false) {
        if (!entry) continue;
        if (entry.id !== `scaffold-p${page.id}` || !ownedNavigation[entry.id])
          throw conflict(`${navFile} unowned entry ${entry.id}`);
        const nodes = declarations(navText),
          owner = nodes.find((node) => node.kind === 'list' && node.key === 'navigation-menu');
        const node = nodes.find(
          (node) =>
            node.kind === 'entry' &&
            node.key === entry.id &&
            owner &&
            node.start > owner.start &&
            node.end < owner.end,
        );
        if (!node || ownedNavigation[entry.id] !== node.digest)
          throw conflict(`${navFile} entry ${entry.id}`);
        navText = editSpans(navText, [{ ...node, expectedDigest: node.digest, content: '' }]);
        delete ownedNavigation[entry.id];
        continue;
      }
      if (entry && (entry.id === `scaffold-p${page.id}` || (page.id === 1 && state.shells[name]))) {
        const owners = declarations(navText),
          owner = owners.find((node) => node.kind === 'list' && node.key === 'navigation-menu');
        const node = owners.find(
          (node) =>
            node.kind === 'entry' &&
            node.key === entry.id &&
            owner &&
            node.start > owner.start &&
            node.end < owner.end,
        );
        if (!node) throw conflict(navFile);
        const old = navText.slice(node.start, node.end);
        if (ownedNavigation[entry.id] && ownedNavigation[entry.id] !== hash(old))
          throw conflict(`${navFile} entry ${entry.id}`);
        if (
          !ownedNavigation[entry.id] &&
          state.files[navFile] &&
          state.files[navFile] !== before[navFile] &&
          entry.props.label !== page.name
        )
          throw conflict(`${navFile} entry ${entry.id}`);
        if (!/^        label: .+$/m.test(old)) throw conflict(navFile);
        const content = old.replace(/^        label: .+$/m, () => '        label: ' + q(page.name));
        navText = editSpans(navText, [
          {
            ...node,
            expectedDigest: node.digest,
            content,
          },
        ]);
        ownedNavigation[entry.id] = hash(content);
      }
      if (!entry) {
        const id = `scaffold-p${page.id}`;
        if (menu.children.some((e) => e.id === id)) throw conflict(navFile);
        const addition = block(
          `entry ${id}`,
          [
            property('label', q(page.name), 2),
            group('layout', property('sequence', String(page.id + 10), 3)),
            group('link', group('target:', property('page', String(page.id), 4), 3)),
          ].join('\n'),
        );
        const owner = declarations(navText).find(
          (node) => node.kind === 'list' && node.key === 'navigation-menu',
        );
        if (!owner) throw conflict(navFile);
        const at = navText.lastIndexOf(')', owner.end - 1);
        navText = navText.slice(0, at) + addition + '\n' + navText.slice(at);
        const nodes = declarations(navText),
          scope = nodes.find((node) => node.kind === 'list' && node.key === 'navigation-menu');
        const added = nodes.find(
          (node) =>
            node.kind === 'entry' &&
            node.key === id &&
            scope &&
            node.start > scope.start &&
            node.end < scope.end,
        );
        if (!added) throw conflict(navFile);
        ownedNavigation[id] = hash(navText.slice(added.start, added.end));
      }
    }
    if (navText !== navigation) writes[navFile] = navText;
    if (spec.applicationProcesses !== undefined) {
      const file = 'shared-components/app-processes.apx';
      if (state.files[file] && state.files[file] !== before[file]) throw conflict(file);
      const old = before[file] ? await readFile(await contained(root, file), 'utf8') : '';
      const shell = state.shells[file] ?? old;
      for (const source of Object.keys(before).filter((name) => name.endsWith('.apx'))) {
        const text = source === file ? shell : await readFile(await contained(root, source), 'utf8');
        if (!/\bappProcess\s/.test(text)) continue;
        const nodes = parseApexLang(text, source);
        const found = (list: typeof nodes): boolean =>
          list.some(
            (node) =>
              (node.type === 'appProcess' &&
                spec.applicationProcesses!.some((process) => process.id === node.id)) ||
              found(node.children),
          );
        if (found(nodes)) throw conflict(source);
      }
      state.shells[file] = shell;
      writes[file] =
        shell +
        (spec.applicationProcesses.length ? '\n' : '') +
        spec.applicationProcesses
          .map((value, i) => renderProcess({ ...value, sequence: value.sequence ?? (i + 1) * 10 }, i, true))
          .join('\n');
    }
    if (spec.applicationName) {
      const name = 'application.apx';
      const original = await readFile(await contained(root, name), 'utf8');
      if (!/^    name: .+$/m.test(original)) throw conflict(name);
      writes[name] = original.replace(/^    name: .+$/m, () => '    name: ' + q(spec.applicationName!));
    }
    // Execution IDs are numeric but kept as strings when checking existing vendor IDs.
    // The generated 15-digit range stays exact in JavaScript; no 20-digit rounding collisions.
    const executionIds = new Map<string, string>();
    for (const source of new Set([...Object.keys(before), ...Object.keys(writes)])) {
      if (!source.endsWith('.apx')) continue;
      const text = writes[source] ?? (await readFile(await contained(root, source), 'utf8'));
      if (!text.includes('executionMappingIdentifier')) continue;
      const nodes = parseApexLang(text, source);
      const check = (list: typeof nodes) => {
        for (const node of list) {
          const mapping = get(node.props, 'advanced.executionMappingIdentifier');
          if (mapping !== undefined) {
            const key = String(mapping),
              previous = executionIds.get(key);
            if (previous && (writes[source] || writes[previous])) throw conflict(`execution ID ${key}`);
            executionIds.set(key, source);
          }
          check(node.children);
        }
      };
      check(nodes);
    }
    // Every output is parsed before any source is touched. Keep a durable before/after
    // tree for inspection/recovery if the process stops between atomic file writes.
    for (const [name, value] of Object.entries(writes)) {
      const nodes = parseApexLang(value, name);
      const unique = (list: typeof nodes) => {
        // Anonymous components (grid display columns, branches) have no identity to collide.
        const keys = list.filter((node) => node.id).map((node) => `${node.type}:${node.id}`);
        if (new Set(keys).size !== keys.length) throw conflict(`duplicate components in ${name}`);
        list.forEach((node) => unique(node.children));
      };
      unique(nodes);
    }
    const stage = await contained(ctx.root, `.apexrest/scaffolds/${randomUUID()}`);
    await atomicWrite(path.join(stage, 'spec.json'), raw);
    const observationsFile = path.join(stage, 'observations.sql');
    if (target && release === '26.2')
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
    await recheck();
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
      specDigest,
      compilerValidation: 'required-by-ship',
      nextAction: 'apexrest_ship mode:apply',
      stage: path.relative(ctx.root, stage),
      ...(target && release === '26.2'
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
      ...(target && release === '26.1'
        ? {
            readbackUnavailable:
              'The optional scaffold SQL observations are qualified for 26.2 only. Use scoped metadata reads for 26.1.',
          }
        : {}),
    };
  });
}
