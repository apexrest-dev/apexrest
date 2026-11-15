import { unitBody, type PlsqlUnitKind } from '../../seed.ts';
import { isWord, Parser, PlsqlSyntaxError, type Block, type Decl, type Routine } from './parser.ts';

/**
 * The application's own PL/SQL, read from the units its install scripts create: packages (spec
 * and body), standalone functions and procedures, and anonymous blocks. The interpreter calls
 * these routines instead of reporting them as not simulated, keeps package variables per request
 * and initializes a package once, the first time a request touches it.
 */

export interface PlsqlPackage {
  name: string;
  /** Specification then body declarations: variables, constants, cursors, types, exceptions, routines. */
  decls: Decl[];
  /** The body's initialization section. */
  init?: Block;
  /** Routines by name; several entries are overloads. */
  routines: Map<string, Routine[]>;
  hasBody: boolean;
}

export interface PlsqlLibrary {
  packages: Map<string, PlsqlPackage>;
  /** Standalone functions and procedures by name (overloads are not possible, but kept as a list). */
  routines: Map<string, Routine[]>;
  /** Anonymous blocks of the install scripts, in script order (data generation and setup). */
  blocks: { source: string; script: string }[];
  problems: string[];
}

export interface StoredUnit {
  kind: PlsqlUnitKind;
  name: string;
  source: string;
  script: string;
}

const empty = (): PlsqlLibrary => ({ packages: new Map(), routines: new Map(), blocks: [], problems: [] });

function addRoutine(map: Map<string, Routine[]>, routine: Routine): void {
  const list = map.get(routine.name) ?? [];
  // A body routine replaces the same signature declared earlier (spec forward declaration is not kept).
  const index = list.findIndex(
    (entry) =>
      entry.params.length === routine.params.length &&
      entry.params.every((param, at) => param.name === routine.params[at]!.name),
  );
  if (index >= 0) list[index] = routine;
  else list.push(routine);
  map.set(routine.name, list);
}

/** Skips AUTHID, ACCESSIBLE BY, SHARING and similar clauses up to IS/AS. */
function afterHeader(parser: Parser): void {
  while (parser.peek() && !isWord(parser.peek(), 'is', 'as')) parser.next();
  parser.expectWord('is', 'as');
}

function parsePackage(source: string, body: boolean): { decls: Decl[]; init?: Block } {
  const parser = new Parser(unitBody(source));
  afterHeader(parser);
  const decls = parser.declarations(true);
  let init: Block | undefined;
  if (body && isWord(parser.peek(), 'begin')) {
    init = parser.block();
  } else {
    parser.expectWord('end');
  }
  return { decls, ...(init ? { init } : {}) };
}

function parseStandalone(source: string, kind: 'function' | 'procedure', name: string): Routine | undefined {
  const parser = new Parser(`${kind} ${name} ${unitBody(source)}`);
  // Past the kind keyword; `routine` reads the name itself.
  parser.pos = 1;
  return parser.routine(kind === 'function');
}

export function buildLibrary(units: StoredUnit[]): PlsqlLibrary {
  const library = empty();
  const parsed = new Map<string, { spec?: Decl[]; body?: { decls: Decl[]; init?: Block } }>();
  for (const unit of units) {
    try {
      switch (unit.kind) {
        case 'package':
        case 'package body': {
          const entry = parsed.get(unit.name) ?? {};
          if (unit.kind === 'package') entry.spec = parsePackage(unit.source, false).decls;
          else entry.body = parsePackage(unit.source, true);
          parsed.set(unit.name, entry);
          break;
        }
        case 'function':
        case 'procedure': {
          const routine = parseStandalone(unit.source, unit.kind, unit.name);
          if (routine) library.routines.set(unit.name, [routine]);
          break;
        }
        case 'block':
          library.blocks.push({ source: unit.source, script: unit.script });
          break;
        default:
          break;
      }
    } catch (error) {
      const line = error instanceof PlsqlSyntaxError ? ` (line ${error.line})` : '';
      library.problems.push(
        `${unit.script}: ${unit.kind} ${unit.name}: ${(error as Error).message}${line}; its routines are not run locally`,
      );
    }
  }
  for (const [name, entry] of parsed) {
    const decls = [...(entry.spec ?? []), ...(entry.body?.decls ?? [])];
    const routines = new Map<string, Routine[]>();
    for (const decl of decls) if (decl.kind === 'routine') addRoutine(routines, decl.routine);
    library.packages.set(name, {
      name,
      decls,
      ...(entry.body?.init ? { init: entry.body.init } : {}),
      routines,
      hasBody: Boolean(entry.body),
    });
  }
  return library;
}

/**
 * The overload a call means: every named argument names a parameter, the positional arguments
 * fit, and every parameter without a default gets a value. Fewest unused parameters wins.
 */
export function pickOverload(routines: Routine[], positional: number, named: string[]): Routine | undefined {
  let best: { routine: Routine; spare: number } | undefined;
  for (const routine of routines) {
    const names = routine.params.map((param) => param.name);
    if (positional > names.length) continue;
    if (!named.every((name) => names.includes(name))) continue;
    const given = new Set([...names.slice(0, positional), ...named]);
    if (routine.params.some((param) => !given.has(param.name) && !param.init && param.mode !== 'out'))
      continue;
    const spare = names.length - given.size;
    if (!best || spare < best.spare) best = { routine, spare };
  }
  return best?.routine ?? (routines.length === 1 ? routines[0] : undefined);
}
