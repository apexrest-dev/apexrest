import { registerRendererSetup } from '../../extensions.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { activeRuntime, withRuntime } from './apex-api.ts';
import { Interpreter, itemText, plsqlLibrary, RecordValue, Collection, type Value } from './plsql.ts';

/**
 * Makes the application's PL/SQL (packages.ts) callable from SQL and runs the install scripts'
 * anonymous blocks once per fresh local database.
 *
 * Functions are called from SQL by the database's function hook: `pkg.fn(col)` in a region query,
 * LOV or PL/SQL cursor runs `fn` per row in the interpreter with the session of the request being
 * rendered.
 */

function contextFor(renderer: ApexRenderer): RenderContext | undefined {
  const runtime = activeRuntime();
  if (runtime && runtime.renderer === renderer) return runtime.ctx;
  if (renderer.lastContext) return renderer.lastContext;
  const pageId = [...renderer.app.pages.keys()].find((id) => id !== '0');
  if (!pageId) return undefined;
  return renderer.prepare({ id: 'apex-local-setup', user: 'DEVELOPER', items: {}, pagination: {} }, pageId);
}

function sqlValue(value: Value): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof RecordValue || value instanceof Collection) return itemText(value) || null;
  return value;
}

function registerFunctions(renderer: ApexRenderer): void {
  const library = plsqlLibrary(renderer);
  const register = (name: string, chain: string[], params: string[]) =>
    renderer.db.registerLocalFunction(name, params, (args) => {
      const ctx = contextFor(renderer);
      if (!ctx) return null;
      const interpreter = new Interpreter(renderer, ctx, { label: `function ${name}` });
      const result = withRuntime(interpreter, () => interpreter.callWithValues(chain, args as Value[]));
      if (!result)
        throw new Error(
          `ORA-06553: PLS-306: wrong number or types of arguments in call to ${name.toUpperCase()}`,
        );
      return sqlValue(result.value);
    });
  for (const pkg of library.packages.values())
    for (const [member, overloads] of pkg.routines)
      if (overloads.some((routine) => routine.isFunction))
        register(
          `${pkg.name}.${member}`,
          [pkg.name, member],
          overloads.find((r) => r.isFunction)!.params.map((p) => p.name),
        );
  for (const [name, overloads] of library.routines)
    if (overloads[0]!.isFunction)
      register(
        name,
        [name],
        overloads[0]!.params.map((p) => p.name),
      );
}

/** Anonymous install blocks run once, after every unit is known, so they may call the application's packages. */
function runInstallBlocks(renderer: ApexRenderer): void {
  const db = renderer.db;
  const library = plsqlLibrary(renderer);
  if (!library.blocks.length) return;
  db.db.exec('create table if not exists apex_local_plsql_state (name text primary key, value text)');
  if (db.db.prepare("select 1 from apex_local_plsql_state where name = 'install_blocks'").get()) return;
  db.db.prepare("insert into apex_local_plsql_state values ('install_blocks', 'run')").run();
  const ctx = contextFor(renderer);
  if (!ctx) return;
  for (const block of library.blocks) {
    const interpreter = new Interpreter(renderer, ctx, { label: `install block in ${block.script}` });
    const result = interpreter.run(block.source.replace(/\n\s*\/\s*$/u, ''), 'block');
    if (!result.ok && result.failure)
      renderer.diagnose(
        'warning',
        `Seed script: ${block.script}: anonymous block: ${result.failure.message}${result.failure.line ? ` (line ${result.failure.line})` : ''}; the rest of the block did not run`,
      );
  }
}

registerRendererSetup((renderer) => {
  if (renderer.oracle) return;
  registerFunctions(renderer);
  runInstallBlocks(renderer);
});
