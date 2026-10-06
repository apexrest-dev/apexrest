import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);

// packages/mcp/src/main.ts
if (Number(process.versions.node.split(".")[0]) < 24) {
  process.stderr.write("APEXREST requires Node.js 24 or newer.\n");
  process.exit(3);
}
var { startMcp } = await import("./chunk-AAGX2G2R.mjs");
await startMcp();
