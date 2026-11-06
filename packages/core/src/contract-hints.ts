import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { resourceRoot } from './project.ts';

/** One property line of a 26.2 inventory contract. */
interface ContractProperty {
  group: string;
  name: string;
  /** When the property applies, e.g. `settings.useDefaults = N`; undefined when always. */
  condition?: string;
}
interface Contract {
  kind: string;
  variant?: string;
  /** Directory segments under app/, kebab-case, for parent matching. */
  segments: string[];
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
    const property = /^- `([A-Za-z][\w]*)` — .*; (—|`.*`);\s*$/u.exec(line);
    if (!property) continue;
    const condition =
      property[2] === '—'
        ? undefined
        : property[2]!
            .replace(/`/gu, '')
            .replace(/\b[A-Za-z]+\[([^\]]+)\]/gu, '$1')
            .split(' or ')
            .map((clause) => [...new Set(clause.split(' and '))].join(' and '))
            .filter((clause, i, all) => all.indexOf(clause) === i)
            .join(' or ')
            .slice(0, 240);
    properties.push({ group, name: property[1]!, ...(condition ? { condition } : {}) });
  }
  return { kind, ...(at >= 0 ? { variant: camel(segments[at + 1]!) } : {}), segments, properties };
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
  const matching = all.filter(
    (c) => c.kind === component.kind && (component.type ? c.variant === component.type : !c.variant),
  );
  const kebab = parent?.kind.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`);
  return (kebab && matching.find((c) => c.segments.includes(kebab))) ?? matching[0];
}

const list = (names: string[]) => [...new Set(names)].slice(0, 30).join(', ');

/**
 * A repair hint for an INVALID_PROPERTY compiler error, from the 26.2 inventory contract of the
 * component the error sits in: where the property belongs and when it applies, or what the group
 * accepts. Undefined when the contract is unknown; never fails the diagnostic.
 */
export async function propertyFix(type: string, message: string, hint: string | undefined) {
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
