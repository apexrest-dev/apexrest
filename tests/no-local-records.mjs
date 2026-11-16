// Preloaded by the contract and packaging test scripts (and inherited by the CLI and MCP
// processes they spawn): test runs never add local usage counts, operation timings or
// recent projects to the developer's APEXREST home.
process.env.APEXREST_USAGE = '0';
