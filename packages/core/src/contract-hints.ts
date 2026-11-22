import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { componentExample, componentUsage, type PropertyUsage } from './component-examples.ts';
import { resourceRoot } from './project.ts';

/** One property line of a 26.2 inventory contract. */
interface ContractProperty {
  group: string;
  name: string;
  /** When the property applies, e.g. `settings.useDefaults = N`; undefined when always. */
  condition?: string;
  /** Declared value type such as `<STRING>` or `<@entry>`. */
  type?: string;
  required?: boolean;
  /** Enum value names, when the property has a fixed list. */
  values?: string[];
  /** A fixed list the inventory names without its values (`lovType=EVENTS`). */
  namedList?: boolean;
}
interface Contract {
  kind: string;
  variant?: string;
  /** Directory segments under app/, kebab-case, for parent matching. */
  segments: string[];
  /** Parent type this contract is for, from `appliesWhen: region[identification.type] = classicReport`. */
  parentType?: string;
  properties: ContractProperty[];
}

let contracts: Promise<Contract[]> | undefined;

const camel = (s: string) => s.replace(/-([a-z])/gu, (_m, c: string) => c.toUpperCase());

function parseContract(text: string, segments: string[]): Contract | undefined {
  const kind = /^- componentType: `([^`]+)`/mu.exec(text)?.[1];
  if (!kind) return undefined;
  const at = segments.findIndex((s) => s === 'plugin-variants' || s === 'template-component');
  const properties: ContractProperty[] = [];
  let group = '';
  for (const line of text.split('\n')) {
    const heading = /^### (\S+)/u.exec(line);
    if (heading) {
      group = line.includes('(direct group)') ? '' : heading[1]!;
      continue;
    }
    // Since November 2026 Oracle groups conditions with parentheses: `a` and (`b` or `c`).
    const property = /^- `([A-Za-z][\w]*)` — .*; (—|[`(].*[`)]);\s*$/u.exec(line);
    if (!property) continue;
    const conditionText =
      property[2] === '—'
        ? undefined
        : property[2]!.replace(/`/gu, '').replace(/\b[A-Za-z]+\[([^\]]+)\]/gu, '$1');
    // Older inventories repeat clauses in a flat or-of-ands; grouped ones are already minimal.
    const condition = conditionText
      ? (conditionText.includes('(')
          ? conditionText
          : conditionText
              .split(' or ')
              .map((clause) => [...new Set(clause.split(' and '))].join(' and '))
              .filter((clause, i, all) => all.indexOf(clause) === i)
              .join(' or ')
        ).slice(0, 240)
      : undefined;
    const type = / — `(<[^`]+>)`/u.exec(line)?.[1];
    const required = /`; [^;]*; (Yes|No); /u.exec(line)?.[1];
    const enumeration = /`<enum:\[(.*?)\]>`/u.exec(line)?.[1];
    const labelled = enumeration
      ? [...enumeration.matchAll(/(?:^|, )([\w-]+):"/gu)].map((m) => m[1]!)
      : undefined;
    // Some lists carry no labels (process types): plain names separated by commas.
    const plain = enumeration && !labelled!.length ? enumeration.split(', ') : [];
    const values = labelled?.length
      ? [...new Set(labelled)]
      : plain.every((name) => /^[A-Za-z][\w-]*$/u.test(name))
        ? [...new Set(plain)]
        : undefined;
    properties.push({
      group,
      name: property[1]!,
      ...(condition ? { condition } : {}),
      ...(type ? { type } : {}),
      ...(required ? { required: required === 'Yes' } : {}),
      ...(values?.length ? { values } : {}),
      ...(/; lovType=EVENTS; /u.test(line) ? { namedList: true } : {}),
    });
  }
  const parentType = /^- appliesWhen: `[a-zA-Z]+\[identification\.type\] = ([A-Za-z]\w*)`\s*$/mu.exec(
    text,
  )?.[1];
  return {
    kind,
    ...(at >= 0 ? { variant: camel(segments[at + 1]!) } : {}),
    segments,
    ...(parentType ? { parentType } : {}),
    properties,
  };
}

async function load(): Promise<Contract[]> {
  const root = path.join(resourceRoot(), 'references', '26.2', 'documents', 'app');
  const found: Contract[] = [];
  const walk = async (dir: string, segments: string[]): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), [...segments, entry.name]);
      else if (entry.name.endsWith('.md') && entry.name === `${segments.at(-1)}.md`) {
        const contract = parseContract(await readFile(path.join(dir, entry.name), 'utf8'), segments);
        if (contract) found.push(contract);
      }
    }
  };
  await walk(root, []);
  return found;
}

interface Label {
  kind: string;
  name?: string;
  type?: string;
}
/** `inside settings of pageItem P1_X (type: switch) of page 1` → labels, innermost first. */
function labels(hint: string): Label[] {
  return hint
    .replace(/^inside /u, '')
    .split(' of ')
    .map((part) => {
      const match = /^(\S+)(?: ([^\s(]+))?(?: \(type: ([^)]+)\))?$/u.exec(part.trim());
      if (!match) return { kind: '' };
      const type = match[3]?.split('/').at(-1);
      return { kind: match[1]!, ...(match[2] ? { name: match[2] } : {}), ...(type ? { type } : {}) };
    });
}

function contractFor(all: Contract[], component: Label, parent?: Label) {
  const kebab = parent?.kind.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`);
  const pick = (matching: Contract[]) =>
    (parent?.type && matching.find((c) => c.parentType === parent.type)) ||
    (kebab && matching.find((c) => c.segments.includes(kebab))) ||
    matching[0];
  const variant = pick(
    all.filter(
      (c) => c.kind === component.kind && (component.type ? c.variant === component.type : !c.variant),
    ),
  );
  if (variant || !component.type) return variant;
  // A type that is a value of the plain contract's own `type` (a hidden column), not a plug-in variant.
  const plain = pick(all.filter((c) => c.kind === component.kind && !c.variant));
  return plain?.properties.some((p) => !p.group && p.name === 'type' && p.values?.includes(component.type!))
    ? plain
    : undefined;
}

const list = (names: string[]) => [...new Set(names)].slice(0, 30).join(', ');

/**
 * A repair hint for an INVALID_PROPERTY compiler error, from the 26.2 inventory contract of the
 * component the error sits in: where the property belongs and when it applies, or what the group
 * accepts. Undefined when the contract is unknown; never fails the diagnostic.
 */
export async function propertyFix(type: string, message: string, hint: string | undefined) {
  // Processes without their own mapping identifier all map to null and collide.
  if (type === 'DUPLICATED_COMPONENT' && /executionMappingIdentifier: null/u.test(message))
    return 'give every process of the page its own advanced { executionMappingIdentifier: <distinct numeric identifier> }';
  if (type.startsWith('MISSING_REQUIRED')) return missingFix(message, hint);
  if (type !== 'INVALID_PROPERTY' || !hint) return undefined;
  const property = /Invalid property: ([A-Za-z]\w*)/u.exec(message)?.[1];
  if (!property) return undefined;
  try {
    contracts ??= load();
    const all = await contracts;
    const chain = labels(hint);
    const named = chain.findIndex((label) => label.name);
    if (named < 0) return undefined;
    const group = chain
      .slice(0, named)
      .map((label) => label.kind)
      .reverse()
      .join('.');
    // The contract lists heading for every classic report column, but the compiler refuses it on a
    // hidden one; none of the 766 hidden classic report columns in Oracle's samples has a heading.
    if (
      group === 'heading' &&
      chain[named]!.kind === 'column' &&
      chain[named]!.type === 'hidden' &&
      chain[named + 1]?.type === 'classicReport'
    )
      return `remove the whole heading { … } group from column ${chain[named]!.name}: a hidden classicReport column takes no heading (keep layout { sequence })`;
    const contract = contractFor(all, chain[named]!, chain[named + 1]);
    if (!contract) return undefined;
    const where = contract.properties.filter((p) => p.name === property);
    const component = `${contract.kind}${contract.variant ? ` (type: ${contract.variant})` : ''}`;
    if (where.length) {
      const here = where.filter((p) => p.group === group);
      if (here.length && here.every((p) => p.condition))
        return `${property} applies to ${component} only when ${[...new Set(here.map((p) => p.condition))].join(' or ')}`;
      // A name that several groups share (type, sequence) says nothing about where it belongs here.
      if (!here.length && new Set(where.map((p) => p.group)).size === 1)
        return `${property} belongs in ${where
          .map((p) => (p.group ? `group ${p.group}` : 'the component itself (no group)'))
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(' or ')} of ${component}${where[0]!.condition ? ` when ${where[0]!.condition}` : ''}`;
      if (here.length) return undefined;
    }
    const valid = contract.properties.filter((p) => p.group === group).map((p) => p.name);
    if (where.length)
      return `${property} is not valid in ${group || 'the component itself'} of ${component}; valid there: ${list(valid)}`;
    return valid.length
      ? `${component} has no ${property}; ${group || 'its direct properties'}: ${list(valid)}`
      : `${component} has no ${property} and no group ${group}; groups: ${list(contract.properties.map((p) => p.group).filter(Boolean))}`;
  } catch {
    return undefined;
  }
}

/** `a | b | c`, bounded; component-specific values (`region/map/…`) are never parsed into the list. */
const choices = (values: string[], limit: number) =>
  values.slice(0, limit).join(' | ') + (values.length > limit ? ` | … ${values.length - limit} more` : '');

/**
 * A repair hint for a MISSING_REQUIRED_PROPERTY compiler error
 * (`Missing required parameter (387): componentAppearance - breadcrumbTemplate (string)`): the
 * group and property to add, with the allowed values, the theme template an Oracle sample names,
 * or the value type. `hint` names the component the property is missing from, innermost first.
 */
async function missingFix(message: string, hint: string | undefined) {
  const missing = /Missing required parameter(?: \(\d+\))?: (\w+) - (\w+)(?: \((\w+)\))?/u.exec(message);
  if (!missing) return undefined;
  // The compiler calls a component's direct properties `identification`.
  const group = missing[1] === 'identification' ? '' : missing[1]!;
  const name = missing[2]!;
  let value = `<${missing[3] ?? 'value'}>`;
  let target = 'the component that starts at the reported line';
  let note = '';
  try {
    const chain = hint ? labels(hint) : [];
    const component = chain[0]?.name ? chain[0] : undefined;
    contracts ??= load();
    const contract = component && contractFor(await contracts, component, chain[1]);
    const found = contract?.properties.filter((p) => p.group === group && p.name === name) ?? [];
    if (component && found.length) {
      target = `${component.kind} ${component.name}`;
      const used = (await componentUsage(component.kind, component.type)).find(
        (entry) => entry.property === (group ? `${group}.${name}` : name),
      );
      const values = valueList(contract!, group, name, undefined, used?.values ?? []);
      const sample = (await componentExample(component.type, { kind: component.kind }))?.text.match(
        new RegExp(`^\\s*${name}: (\\S{1,80})$`, 'mu'),
      )?.[1];
      // A sample value helps only when it is a shared theme name (`@/breadcrumb`), not sample data.
      if (values) value = values;
      else if (sample?.startsWith('@/')) value = sample;
      else if (found[0]!.type) value = found[0]!.type;
      // `= sample` stands for a value the inventory does not name.
      const condition = found.every((p) => p.condition) ? found[0]!.condition! : '';
      if (condition && !condition.includes('= sample')) note = ` (required when ${condition.slice(0, 160)})`;
    }
  } catch {
    // The bare group and property still tell where to add it.
  }
  return `add to ${target}: ${group ? `${group} { ${name}: ${value} }` : `${name}: ${value}`}${note}`;
}

/**
 * What a sample block of a component kind does not say about itself. Every process in Oracle's
 * 26.2 samples carries its own mapping identifier, and the compiler reports DUPLICATED_COMPONENT
 * for processes of one page that lack it; the number looks generated, so drafts tend to drop it.
 */
export function componentNote(kind: string): string | undefined {
  return kind === 'process'
    ? 'Keep advanced { executionMappingIdentifier } on every process, a different integer for each process of the page (for example page * 100 + n): 26.2 reports DUPLICATED_COMPONENT without it.'
    : undefined;
}

type Frame = { contract?: Contract | undefined; label: Label; path: string; group?: string; depth: number };

/** Share of a component's sample blocks from which a property counts as commonly used. */
const COMMON_SHARE = 0.25;

/** Closes a list taken from the samples because the inventory names it without its values. */
const PARTIAL = '(most used in Oracle samples; the compiler error lists all)';

/**
 * The value list of one property. A variant contract repeats its family's properties, so a name
 * can carry several lists (four `pagination.type` lists on a region): the list that covers the
 * value shown and the values Oracle's samples of the component use wins; a tie stays unanswered.
 */
function valueList(
  contract: Contract,
  group: string,
  name: string,
  shown: string | undefined,
  sampled: string[],
): string | undefined {
  const defined = contract.properties.filter((p) => p.group === group && p.name === name);
  const lists = [
    ...new Map(defined.flatMap((p) => (p.values ? [[p.values.join(), p.values]] : []))).values(),
  ];
  if (!lists.length) {
    // The inventory names the list only (events): show what the samples use, marked as partial.
    const used = sampled.filter((value) => !value.includes('/')).slice(0, 12);
    return defined.some((p) => p.namedList) && used.length ? `${used.join(' | ')} | … ${PARTIAL}` : undefined;
  }
  const score = (list: string[]) =>
    (shown && list.includes(shown) ? 1000 : 0) + sampled.filter((value) => list.includes(value)).length;
  const ranked = lists.map((list) => ({ list, score: score(list) })).sort((a, b) => b.score - a.score);
  if (ranked.length > 1 && ranked[0]!.score === ranked[1]!.score) return undefined;
  // A single value is what the sample already shows.
  return ranked[0]!.list.length > 1 ? choices(ranked[0]!.list, 12) : undefined;
}

/**
 * The allowed values of the enum properties a sample block shows and of those Oracle's samples of
 * the component commonly set, as `group.property` → `a | b | c` (nested components are prefixed
 * with their keyword: `column.heading.alignment`). A sample shows one value only; this lists the
 * rest, so a value is picked, not guessed. Ordered by how open the choice is in Oracle's samples
 * (often stated, with no dominant value): the block's own properties before nested ones, those the
 * samples always set alike last.
 * `id` is the block's `oracle:26.2:inventory/app/<path>/<name>` contract; without it the block's
 * own keyword and type decide. Undefined when nothing applies.
 */
export async function exampleValues(text: string, id?: string): Promise<Record<string, string> | undefined> {
  try {
    contracts ??= load();
    const all = await contracts;
    const at = id?.indexOf('inventory/app/') ?? -1;
    const path =
      at < 0
        ? undefined
        : id!
            .slice(at + 'inventory/app/'.length)
            .split('/')
            .slice(0, -1)
            .join('/');
    const root = path === undefined ? undefined : all.find((c) => c.segments.join('/') === path);
    const lines = text.split('\n');
    const indent = (line: string) => line.length - line.trimStart().length;
    // `open`: how much of a choice the property is in the samples (0 when they never vary it).
    const found = new Map<string, { values: string; nested: boolean; open: number }>();
    const usage = new Map<string, PropertyUsage[]>();
    const sampled = async (label: Label, property: string) => {
      const key = `${label.kind}:${label.type ?? ''}`;
      if (!usage.has(key)) usage.set(key, await componentUsage(label.kind, label.type));
      return usage.get(key)!.find((entry) => entry.property === property);
    };
    const stack: Frame[] = [];
    let first: Frame | undefined;
    for (const [i, line] of lines.entries()) {
      if (!line.trim()) continue;
      const depth = indent(line);
      while (stack.length && stack.at(-1)!.depth >= depth) stack.pop();
      const parent = stack.at(-1);
      const opener = /^\s*([a-z][A-Za-z]*)(?: (\S+))? \($/u.exec(line);
      if (opener) {
        // The block's own type is the `type:` line one level below its opening line.
        let type: string | undefined;
        for (let j = i + 1; j < lines.length && !type; j += 1) {
          if (lines[j]!.trim() && indent(lines[j]!) <= depth) break;
          if (indent(lines[j]!) === depth + 4)
            type = /^\s*type: (?:[A-Za-z]+\/)?([A-Za-z]\w*)\s*$/u.exec(lines[j]!)?.[1];
        }
        const label = { kind: opener[1]!, ...(type ? { type } : {}) };
        const contract = !stack.length && root ? root : contractFor(all, label, parent?.label);
        stack.push({ depth, label, contract, path: stack.length ? `${parent!.path}${opener[1]}.` : '' });
        first ??= stack[0];
        continue;
      }
      if (!parent) continue;
      const group = /^\s*([A-Za-z]\w*) \{$/u.exec(line)?.[1];
      if (group) {
        stack.push({ ...parent, depth, group: parent.group ? `${parent.group}.${group}` : group });
        continue;
      }
      const property = /^\s*([A-Za-z]\w*): (\S.*)$/u.exec(line);
      // A block's own `type` selects the component; its contract is the answer, not a value list.
      if (!property || !parent.contract || (property[1] === 'type' && !parent.group)) continue;
      const name = `${parent.group ? `${parent.group}.` : ''}${property[1]}`;
      if (found.has(parent.path + name)) continue;
      const used = await sampled(parent.label, name);
      const values = valueList(
        parent.contract,
        parent.group ?? '',
        property[1]!,
        property[2]!.trimEnd(),
        used?.values ?? [],
      );
      if (values)
        found.set(parent.path + name, {
          values,
          nested: Boolean(parent.path),
          open: used ? used.share * (1 - used.dominance) : 0,
        });
    }
    // What the samples of this component commonly set, although this one block does not show it.
    if (first?.contract)
      for (const entry of await componentUsage(first.label.kind, first.label.type)) {
        if (entry.share < COMMON_SHARE) break;
        const [group, name] = entry.property.split('.');
        if (!name || found.has(entry.property)) continue;
        const values = valueList(first.contract, group!, name, undefined, entry.values);
        if (values)
          found.set(entry.property, { values, nested: false, open: entry.share * (1 - entry.dominance) });
      }
    // A list the inventory does not carry can be read nowhere else: it leads its block.
    const rank = (entry: { values: string; nested: boolean; open: number }) =>
      (entry.open <= 0 ? 4 : entry.nested ? 2 : 0) - (entry.values.endsWith(PARTIAL) ? 1 : entry.open);
    const ordered = [...found].sort((a, b) => rank(a[1]) - rank(b[1]));
    return ordered.length
      ? Object.fromEntries(ordered.map(([key, entry]) => [key, entry.values]))
      : undefined;
  } catch {
    return undefined;
  }
}

// Groups a first draft rarely needs; the full contract stays readable with apexrest_reference.
const SKELETON_SKIP = new Set([
  'security',
  'config',
  'comments',
  'serverSideCondition',
  'help',
  'userDefinedAttributes',
  'clickCounting',
  'advanced',
]);

/**
 * An APEXlang-shaped outline of a 26.2 inventory contract without sample code (breadcrumb and list
 * entries): every always-applicable property in the group it belongs to, with its value type or
 * values. Undefined for unknown contracts. `id` is `oracle:26.2:inventory/app/<path>/<name>`.
 */
export async function contractSkeleton(id: string): Promise<string | undefined> {
  const at = id.indexOf('inventory/app/');
  if (at < 0) return undefined;
  const segments = id
    .slice(at + 'inventory/app/'.length)
    .split('/')
    .slice(0, -1);
  try {
    contracts ??= load();
    const contract = (await contracts).find((c) => c.segments.join('/') === segments.join('/'));
    if (!contract) return undefined;
    const value = (p: ContractProperty) =>
      p.values
        ? p.values.slice(0, 6).join(' | ') + (p.values.length > 6 ? ' | …' : '')
        : (p.type ?? '<value>');
    const shown = contract.properties.filter((p) => !p.condition && !SKELETON_SKIP.has(p.group));
    const groups = [...new Set(shown.map((p) => p.group))];
    const lines = [`${contract.kind} <name> (`];
    for (const group of groups) {
      const members = shown.filter((p) => p.group === group);
      const rows = members.map((p) => `${p.name}: ${value(p)}${p.required ? '' : '  (optional)'}`);
      if (!group) lines.push(...rows.map((row) => `    ${row}`));
      else lines.push(`    ${group} {`, ...rows.map((row) => `        ${row}`), '    }');
    }
    lines.push(')');
    return lines.join('\n');
  } catch {
    return undefined;
  }
}
