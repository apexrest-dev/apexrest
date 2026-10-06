---
name: apexrest-setup
description: Check and set up the APEXREST toolchain and connections - doctor, Node/Java/SQLcl/Playwright dependencies, SQLcl mode and ORDS transport, connection references and the project status snapshot. Use for setup, missing tools or connection onboarding.
---

# Setup

Call `apexrest_status` `detail:doctor` first. It probes SQLcl and Java; Codex availability is informational for Claude Code without downloads or database calls and reports `sqlcl.mode` (`cli` direct SQLcl, `mcp` the official SQLcl stdio server) and `databaseTransport` (`direct` or `ords`). A detected tool is not a validated compiler or a live connection; say which was observed.

Dependencies. Missing SQLcl or Java is a reason to install, not to stop. Use the bundled CLI at `../../runtime/apexrest.mjs` relative to this skill directory, resolved to an absolute path and run with `node` from the user's project directory (native installation adds nothing to PATH):

```sh
node "<plugin-root>/runtime/apexrest.mjs" dependencies install --dry-run --json
node "<plugin-root>/runtime/apexrest.mjs" dependencies install --yes --json
```

Preview first and summarize versions, destinations and license requirements. Add `--accept-oracle-license` only after the user accepted the Oracle terms linked in the preview; `--skip-browser` omits Playwright/Chromium; `--install-os-deps` needs explicit authorization. Use the pinned lockfile versions only. Rerun the doctor afterwards; with a custom `--home`, set `APEXREST_HOME` for the CLI and the MCP process.

SQLcl backend. `apexrest sqlcl configure --mode cli|mcp --database-transport direct|ords --json`; `sqlcl status --json` reads it. ORDS requires `cli` mode and plugin-level connection credentials ([ORDS notes](references/ords.md)). Never silently retry through the other backend or transport.

Connections. `apexrest_project` `action:connection_add` with `name` plus either `sqlclName` (saved SQLcl connection) or `ordsUrl` and `ordsUsername` with `passwordFile` (a private local file). `action:connection_list` and `action:connection_test` check references. Never ask for or relay passwords in chat; each environment in `apexrest.json` needs `readConnectionRef` and `deployConnectionRef`, the workspace, parsing schema, application ID, base URL and database identity. Ask only for missing non-secret values; never infer production.

Project status. `apexrest_status` `detail:project` returns one read-only snapshot: configuration, SQLcl settings, connection references without secrets, browser preference (`.apexrest/panel/preferences.json`, `browserMode: codex|external`), Git changes, sync state, recent jobs and deployments, and active grants. `trusted: false` or `configured: false` are findings; trust is granted by the user in `APEXREST_HOME/policy.json`.

A clean supported APEX installation is enough: APEXREST service tables and utPLSQL are not prerequisites. After reinstalling the plugin, start a new host session. Implementation continues in [work](../apexrest-work/SKILL.md).
