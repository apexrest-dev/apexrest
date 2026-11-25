import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  managedHome,
  parse
} from "./chunk-FMCSJH7I.mjs";
import {
  contained,
  exists,
  readJson,
  withLock,
  writeJson
} from "./chunk-RW7D7AJD.mjs";
import {
  Fault,
  external_exports
} from "./chunk-OWILYJ3V.mjs";

// packages/core/src/sqlcl-config.ts
import path from "node:path";
var sqlclMode = external_exports.enum(["cli", "mcp"]);
var sqlclRestriction = external_exports.enum(["4", "1"]);
var databaseTransport = external_exports.enum(["direct", "ords"]);
var sqlclConfigSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  mode: sqlclMode,
  mcpRestrictLevel: sqlclRestriction,
  databaseTransport: databaseTransport.optional()
});
async function sqlclConfig() {
  const home = managedHome();
  if (!await exists(home)) return { schemaVersion: 1, mode: "cli", mcpRestrictLevel: "4" };
  const file = await contained(home, "sqlcl.json");
  return await exists(file) ? parse(sqlclConfigSchema, await readJson(file)) : { schemaVersion: 1, mode: "cli", mcpRestrictLevel: "4" };
}
async function configureSqlcl(mode, level, transport) {
  const home = managedHome();
  return withLock(path.join(home, "sqlcl-config.lock"), async () => {
    const previous = await sqlclConfig();
    const configuration = parse(sqlclConfigSchema, {
      ...previous,
      mode,
      mcpRestrictLevel: level ?? previous.mcpRestrictLevel,
      ...transport ? { databaseTransport: transport } : {}
    });
    if (configuration.mode === "mcp" && configuration.databaseTransport === "ords")
      throw new Fault(
        "ORDS_CLI_REQUIRED",
        "ORDS HTTP requires SQLcl CLI mode. Select CLI execution for this transport.",
        3,
        "blocked"
      );
    await writeJson(await contained(home, "sqlcl.json"), configuration);
    return configuration;
  });
}

export {
  sqlclMode,
  sqlclRestriction,
  databaseTransport,
  sqlclConfigSchema,
  sqlclConfig,
  configureSqlcl
};
